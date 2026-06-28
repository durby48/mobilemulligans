// app/api/employee-records/route.ts — the sensitive employee records vault.
//
//   GET  /api/employee-records                  → summary of which employees have a record
//   GET  /api/employee-records?employee_id=…     → that record, SSN/bank MASKED
//   GET  /api/employee-records?employee_id=…&reveal=1 → full plaintext (audited)
//   PUT  /api/employee-records                   → create/update a record (encrypts SSN/bank)
//
// Locked to a SINGLE login (lib/pii/authz.requireRecordsAdmin). SSN, routing, and
// account numbers are encrypted at rest (lib/pii/crypto). Every decrypt and every
// write is written to employee_record_audit. Node runtime; never cached.

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireRecordsAdmin, writeAudit } from "@/lib/pii/authz";
import { decryptField, encryptField, piiKeyConfigured } from "@/lib/pii/crypto";
import type { EmployeeRecord } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function shapeMasked(row: EmployeeRecord) {
  // Strip the ciphertext columns entirely; expose only last-4 masks + presence.
  const { ssn_encrypted, routing_encrypted, account_encrypted, ...rest } = row;
  return {
    ...rest,
    has_ssn: !!ssn_encrypted,
    has_bank: !!account_encrypted,
    ssn_masked: row.ssn_last4 ? `•••-••-${row.ssn_last4}` : null,
    account_masked: row.account_last4 ? `••••${row.account_last4}` : null,
  };
}

function shapeRevealed(row: EmployeeRecord) {
  const base = shapeMasked(row);
  return {
    ...base,
    ssn: decryptField(row.ssn_encrypted),
    routing_number: decryptField(row.routing_encrypted),
    account_number: decryptField(row.account_encrypted),
  };
}

export async function GET(request: Request) {
  const ctx = await requireRecordsAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const admin = getSupabaseServerClient();
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employee_id");

  // Summary mode: which employees have a record (no sensitive data returned).
  if (!employeeId) {
    const { data, error } = await admin
      .from("employee_records")
      .select("employee_id, updated_at, ssn_encrypted, account_encrypted")
      .eq("company", ctx.company);
    if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
    const records = (data ?? []).map((r) => ({
      employee_id: r.employee_id,
      updated_at: r.updated_at,
      has_ssn: !!r.ssn_encrypted,
      has_bank: !!r.account_encrypted,
    }));
    return NextResponse.json({ records }, { headers: NO_STORE });
  }

  const { data: row, error } = await admin
    .from("employee_records")
    .select("*")
    .eq("company", ctx.company)
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  if (!row) {
    await writeAudit({ actorEmail: ctx.email, company: ctx.company, employeeId, action: "view", detail: "empty" });
    return NextResponse.json({ record: null }, { headers: NO_STORE });
  }

  const reveal = url.searchParams.get("reveal") === "1";
  if (reveal && !piiKeyConfigured()) {
    return NextResponse.json({ error: "encryption key not configured" }, { status: 500 });
  }
  await writeAudit({
    actorEmail: ctx.email,
    company: ctx.company,
    employeeId,
    action: reveal ? "reveal" : "view",
  });
  try {
    const record = reveal ? shapeRevealed(row) : shapeMasked(row);
    return NextResponse.json({ record }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "decryption failed" }, { status: 500 });
  }
}

// Fields written verbatim (non-secret). Present key ⇒ set (incl. null); absent ⇒ unchanged.
const PLAIN_FIELDS = [
  "legal_first_name", "legal_last_name", "date_of_birth",
  "address_line1", "address_line2", "city", "state", "postal_code", "phone",
  "bank_name", "account_type",
  "w4_filing_status", "w4_multiple_jobs", "w4_dependents_amount",
  "w4_other_income", "w4_deductions", "w4_extra_withholding",
  "pay_type", "pay_rate", "notes",
] as const;

export async function PUT(request: Request) {
  const ctx = await requireRecordsAdmin();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!piiKeyConfigured()) {
    return NextResponse.json({ error: "encryption key not configured (set EMPLOYEE_PII_KEY)" }, { status: 500 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const employeeId = typeof input.employee_id === "string" ? input.employee_id : "";
  if (!employeeId) return NextResponse.json({ error: "employee_id is required" }, { status: 422 });

  const admin = getSupabaseServerClient();
  // The employee must exist in THIS company — never let an arbitrary id be written.
  const { data: emp } = await admin
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("company", ctx.company)
    .maybeSingle();
  if (!emp) return NextResponse.json({ error: "unknown employee for this company" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  for (const f of PLAIN_FIELDS) {
    if (f in input) patch[f] = input[f] === "" ? null : input[f];
  }

  // Sensitive fields: present & non-empty ⇒ encrypt + set last4; present & "" ⇒ clear; absent ⇒ unchanged.
  const setSecret = (key: string, encCol: string, last4Col: string | null, last4From: (s: string) => string) => {
    if (!(key in input)) return;
    const v = input[key];
    if (typeof v !== "string" || v === "") {
      patch[encCol] = null;
      if (last4Col) patch[last4Col] = null;
      return;
    }
    patch[encCol] = encryptField(v);
    if (last4Col) patch[last4Col] = last4From(v);
  };
  const digitsLast4 = (s: string) => s.replace(/\D/g, "").slice(-4);
  setSecret("ssn", "ssn_encrypted", "ssn_last4", digitsLast4);
  setSecret("routing_number", "routing_encrypted", null, digitsLast4);
  setSecret("account_number", "account_encrypted", "account_last4", digitsLast4);

  patch.updated_at = new Date().toISOString();
  patch.updated_by = ctx.email;

  // Upsert: update if a row exists for this employee, else insert.
  const { data: existing } = await admin
    .from("employee_records")
    .select("id")
    .eq("company", ctx.company)
    .eq("employee_id", employeeId)
    .maybeSingle();

  let opError: string | null = null;
  if (existing) {
    const { error } = await admin
      .from("employee_records")
      .update(patch as Partial<EmployeeRecord>)
      .eq("id", existing.id)
      .eq("company", ctx.company);
    opError = error?.message ?? null;
  } else {
    const { error } = await admin
      .from("employee_records")
      .insert({ ...patch, company: ctx.company, employee_id: employeeId } as Partial<EmployeeRecord> & { company: string; employee_id: string });
    opError = error?.message ?? null;
  }
  if (opError) return NextResponse.json({ error: "save failed" }, { status: 500 });

  const changed = Object.keys(patch).filter((k) => !["updated_at", "updated_by"].includes(k));
  await writeAudit({
    actorEmail: ctx.email,
    company: ctx.company,
    employeeId,
    action: "upsert",
    detail: changed.join(","),
  });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
