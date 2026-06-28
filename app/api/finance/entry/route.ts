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
import type { FinanceType, FinanceDirection, FinanceEntry } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<FinanceType>(["invoice", "estimate", "expense", "payment"]);
const VALID_DIRECTIONS = new Set<FinanceDirection>(["in", "out"]);

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

  // 4. Insert with the SERVER-DERIVED company (never the client's).
  const { data: created, error } = await admin
    .from("finance_entries")
    .insert({
      company,
      type: type as FinanceType,
      direction: direction as FinanceDirection,
      amount,
      currency,
      counterparty,
      description,
      occurred_on,
      status,
    })
    .select("*")
    .single();

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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no editable fields supplied" }, { status: 422 });
  }

  // 5. Update, constrained to the employee's own company.
  const { data: updated, error } = await admin
    .from("finance_entries")
    .update(patch)
    .eq("id", id)
    .eq("company", company)
    .select("*")
    .single();

  if (error || !updated) {
    // No row matched the id within this company → not found (or not theirs).
    return NextResponse.json({ error: "entry not found" }, { status: 404 });
  }

  return NextResponse.json(updated, { headers: { "Cache-Control": "no-store" } });
}
