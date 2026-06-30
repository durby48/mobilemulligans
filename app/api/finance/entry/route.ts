// app/api/finance/entry/route.ts — record one finance entry for the employee's
// company. Verify the Supabase session (401) → resolve the employee's company via
// the service-role client (403) → validate the body (422) → insert with the
// server-derived company.
//
// The company is NEVER taken from the request body; it is resolved from the
// employees row. Protected by middleware; in-route checks are defense-in-depth.
// Node runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { upsertCustomerByName } from "@/lib/customers";
import type { FinanceType, FinanceDirection, FinanceEntry } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<FinanceType>(["invoice", "estimate", "expense", "payment"]);
const VALID_DIRECTIONS = new Set<FinanceDirection>(["in", "out"]);

/** True when an error means a column isn't in the schema (migration not yet run). */
function isSchemaCacheMiss(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /column .* (does not exist|schema cache)/i.test(error.message ?? "");
}

/** The offending column name from a PostgREST schema-cache-miss error message. */
function missingColumn(error: { message?: string } | null): string | null {
  const m = /'([a-z_]+)' column|column "?([a-z_]+)"?/i.exec(error?.message ?? "");
  return (m && (m[1] || m[2])) || null;
}

/** Coerce incoming line items to {name, description, qty, rate}; null when empty. */
function sanitizeLineItems(
  v: unknown,
): Array<{ name: string | null; description: string | null; qty: number; rate: number }> | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null,
        description: typeof o.description === "string" && o.description.trim() ? o.description.trim() : null,
        qty: Number(o.qty) || 0,
        rate: Number(o.rate) || 0,
      };
    })
    .filter((l) => l.name || l.description || l.qty || l.rate);
  return out.length ? out : null;
}

export async function POST(request: Request) {
  // 1. Who is asking? (session from cookies)
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Is this user an authorized employee? (service-role lookup, bypasses RLS)
  const admin = getSupabaseServerClient();
  const { data: emp, error: empError } = await admin
    .from("employees")
    .select("company")
    .eq("email", user.email)
    .single();
  if (empError || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }
  const company = emp.company;

  // 3. Parse + validate the body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 422 });
  }
  const input = (body ?? {}) as Record<string, unknown>;

  const type = input.type;
  const direction = input.direction;
  const amount = input.amount;

  if (typeof type !== "string" || !VALID_TYPES.has(type as FinanceType)) {
    return NextResponse.json(
      { error: "type must be one of invoice, estimate, expense, payment" },
      { status: 422 },
    );
  }
  if (typeof direction !== "string" || !VALID_DIRECTIONS.has(direction as FinanceDirection)) {
    return NextResponse.json(
      { error: "direction must be 'in' or 'out'" },
      { status: 422 },
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount must be a finite number greater than 0" },
      { status: 422 },
    );
  }

  const currency =
    typeof input.currency === "string" && input.currency.trim() ? input.currency : "USD";
  const counterparty = typeof input.counterparty === "string" ? input.counterparty : null;
  const description = typeof input.description === "string" ? input.description : null;
  const occurred_on = typeof input.occurred_on === "string" ? input.occurred_on : null;
  const status =
    typeof input.status === "string" && input.status.trim() ? input.status : "recorded";
  const job_id = typeof input.job_id === "string" ? input.job_id : null;
  const document_number = typeof input.document_number === "string" ? input.document_number : null;
  const document_path = typeof input.document_path === "string" ? input.document_path : null;
  const line_items = sanitizeLineItems(input.line_items);

  // Resolve the customer: trust an explicit customer_id, else upsert one from the
  // counterparty name so every named entry links to a customer record.
  let customer_id = typeof input.customer_id === "string" ? input.customer_id : null;
  if (!customer_id && counterparty && counterparty.trim()) {
    const cust = await upsertCustomerByName(admin, company, { name: counterparty });
    if (cust.ok) customer_id = cust.customer.id;
  }

  // 4. Insert with the SERVER-DERIVED company (never the client's). The Pass 3
  // link columns may not exist yet (before the migration is run) — if so, retry
  // without them so adding entries keeps working (graceful degradation).
  const base = {
    company,
    type: type as FinanceType,
    direction: direction as FinanceDirection,
    amount,
    currency,
    counterparty,
    description,
    occurred_on,
    status,
  };
  const full = { ...base, customer_id, job_id, document_number, document_path, line_items };
  const fullRec = full as Record<string, unknown>; // mutation/inspection view
  let ins = await admin.from("finance_entries").insert(full).select("*").single();
  // Drop ONLY the column(s) the schema doesn't have yet, one at a time, so a
  // missing line_items column never costs us the (already-migrated) link columns.
  while (ins.error && isSchemaCacheMiss(ins.error)) {
    const col = missingColumn(ins.error);
    if (!col || !(col in fullRec)) break;
    delete fullRec[col];
    ins = await admin.from("finance_entries").insert(full).select("*").single();
  }
  const { data: created, error } = ins;

  if (error || !created) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json(created, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}

// PATCH — edit an existing entry. Same auth chain as POST. The row is updated
// WHERE id = body.id AND company = <server-derived company>, so an employee can
// only ever edit their OWN company's entries (the service-role client bypasses
// RLS, so we enforce containment with the explicit company filter). Only the
// fields present in the body are changed; everything else is left as-is.
export async function PATCH(request: Request) {
  // 1. Session.
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Authorized employee → company.
  const admin = getSupabaseServerClient();
  const { data: emp, error: empError } = await admin
    .from("employees")
    .select("company")
    .eq("email", user.email)
    .single();
  if (empError || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }
  const company = emp.company;

  // 3. Parse body + the target id.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 422 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const id = input.id;
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 422 });
  }

  // 4. Build the patch from ONLY the provided, valid fields.
  const patch: Partial<FinanceEntry> = {};
  if ("type" in input) {
    if (typeof input.type !== "string" || !VALID_TYPES.has(input.type as FinanceType)) {
      return NextResponse.json(
        { error: "type must be one of invoice, estimate, expense, payment" },
        { status: 422 },
      );
    }
    patch.type = input.type as FinanceType;
  }
  if ("direction" in input) {
    if (typeof input.direction !== "string" || !VALID_DIRECTIONS.has(input.direction as FinanceDirection)) {
      return NextResponse.json({ error: "direction must be 'in' or 'out'" }, { status: 422 });
    }
    patch.direction = input.direction as FinanceDirection;
  }
  if ("amount" in input) {
    if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a finite number greater than 0" },
        { status: 422 },
      );
    }
    patch.amount = input.amount;
  }
  if ("currency" in input) {
    patch.currency =
      typeof input.currency === "string" && input.currency.trim() ? input.currency : "USD";
  }
  if ("counterparty" in input) {
    patch.counterparty = typeof input.counterparty === "string" ? input.counterparty : null;
  }
  if ("description" in input) {
    patch.description = typeof input.description === "string" ? input.description : null;
  }
  if ("occurred_on" in input) {
    patch.occurred_on =
      typeof input.occurred_on === "string" && input.occurred_on.trim() ? input.occurred_on : null;
  }
  if ("status" in input) {
    patch.status =
      typeof input.status === "string" && input.status.trim() ? input.status : "recorded";
  }
  // Pass 3 links (customer/job/document). Used by the document write-back and the
  // editable finance↔document hyperlink. Empty string clears the link.
  for (const f of ["customer_id", "job_id", "document_number", "document_path"] as const) {
    if (f in input) {
      const v = input[f];
      patch[f] = typeof v === "string" && v.trim() ? v : null;
    }
  }
  if ("line_items" in input) {
    patch.line_items = sanitizeLineItems(input.line_items);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields supplied" }, { status: 422 });
  }

  // 5. Update, constrained to the employee's own company. If a column isn't in the
  // schema yet (pre-migration), drop ONLY that column and retry — so a missing
  // line_items column never strips the (already-migrated) link columns.
  const patchRec = patch as Record<string, unknown>; // mutation/inspection view
  let upd = await admin
    .from("finance_entries")
    .update(patch)
    .eq("id", id)
    .eq("company", company)
    .select("*")
    .single();
  while (upd.error && isSchemaCacheMiss(upd.error)) {
    const col = missingColumn(upd.error);
    if (!col || !(col in patchRec)) break;
    delete patchRec[col];
    if (Object.keys(patchRec).length === 0) break;
    upd = await admin
      .from("finance_entries")
      .update(patch)
      .eq("id", id)
      .eq("company", company)
      .select("*")
      .single();
  }
  const { data: updated, error } = upd;

  if (error || !updated) {
    // No row matched the id within this company → not found (or not theirs).
    return NextResponse.json({ error: "entry not found" }, { status: 404 });
  }

  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}

// DELETE — remove an entry. Same auth chain; constrained to the caller's own
// company so an employee can only delete their company's rows. Id comes from the
// query string (?id=…). This removes only the finance row; any already-generated
// document PDF in the company folder is left in place (records are kept).
export async function DELETE(request: Request) {
  // 1. Session.
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Authorized employee → company + role.
  const admin = getSupabaseServerClient();
  const { data: emp, error: empError } = await admin
    .from("employees")
    .select("company, role")
    .eq("email", user.email)
    .single();
  if (empError || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }
  if (emp.role === "viewer") {
    return NextResponse.json({ error: "viewers cannot delete entries" }, { status: 403 });
  }

  // 3. Target id from the query string.
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !id.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 422 });
  }

  // 4. Delete, constrained to the employee's own company.
  const { data: deleted, error } = await admin
    .from("finance_entries")
    .delete()
    .eq("id", id)
    .eq("company", emp.company)
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "entry not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
