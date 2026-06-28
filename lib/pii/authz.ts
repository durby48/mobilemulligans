// lib/pii/authz.ts — the single-identity gate for the employee records vault.
//
// Unlike the other durable-plane routes (which authorize by ROLE: owner /
// operator / viewer), the records vault is locked to ONE explicit login. Even an
// "owner" of the company is denied unless their email is the configured records
// admin. The allowed address is RECORDS_ADMIN_EMAIL (defaults to the project
// owner); set it in the server environment to change it. This is enforced here,
// server-side, on every request — and is backed by Postgres RLS that grants the
// table to the service role only (see config/EMPLOYEE_RECORDS_SETUP.md), so a
// second login, a leaked anon key, or the Supabase dashboard's anon context all
// still see nothing.

import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Default sole authorized identity. Override with env RECORDS_ADMIN_EMAIL. */
export const DEFAULT_RECORDS_ADMIN_EMAIL = "devonsd311@gmail.com";

function allowedEmails(): Set<string> {
  const raw = process.env.RECORDS_ADMIN_EMAIL ?? DEFAULT_RECORDS_ADMIN_EMAIL;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export interface RecordsAdmin {
  email: string;
  company: string;
}
export interface AuthzError {
  error: string;
  status: number;
}

/**
 * Verify the caller is the records admin and resolve which company's records
 * they are allowed to manage (their home company, from the employees table).
 * Returns a RecordsAdmin on success or an {error,status} otherwise.
 */
export async function requireRecordsAdmin(): Promise<RecordsAdmin | AuthzError> {
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return { error: "unauthenticated", status: 401 };

  // The hard gate: exact-match the single authorized login.
  if (!allowedEmails().has(email)) {
    return { error: "forbidden", status: 403 };
  }

  // Resolve the company scope from the employee row (same source of truth the
  // other routes use). The admin must exist as an employee on this site.
  const admin = getSupabaseServerClient();
  const { data: emp, error } = await admin
    .from("employees")
    .select("company")
    .eq("email", email)
    .single();
  if (error || !emp) {
    return { error: "records admin has no employee record on this site", status: 403 };
  }
  return { email, company: emp.company };
}

export type AuditAction =
  | "view"
  | "reveal"
  | "upsert"
  | "doc.upload"
  | "doc.download"
  | "doc.delete";

/**
 * Append an immutable audit entry. Best-effort: a logging failure must not block
 * the legitimate operation, but it is logged to the server console so a broken
 * audit pipeline is visible. Every read of decrypted data and every write should
 * call this.
 */
export async function writeAudit(params: {
  actorEmail: string;
  company: string;
  employeeId: string | null;
  action: AuditAction;
  detail?: string;
}): Promise<void> {
  try {
    const admin = getSupabaseServerClient();
    await admin.from("employee_record_audit").insert({
      actor_email: params.actorEmail,
      company: params.company,
      employee_id: params.employeeId,
      action: params.action,
      detail: params.detail ?? null,
    });
  } catch (e) {
    console.error("employee-records audit write failed:", e);
  }
}
