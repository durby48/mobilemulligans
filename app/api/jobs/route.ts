// app/api/jobs/route.ts — per-company jobs/projects that hours, finance entries,
// and documents reference.
//   GET                  → list jobs (optional ?customer_id=)
//   POST {name,…}        → create a job
//   PATCH {id,…}         → update a job
// Same auth chain as the finance/customers routes.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Job, JobStatus } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: JobStatus[] = ["active", "completed", "on_hold"];

function isSchemaCacheMiss(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /column .* (does not exist|schema cache)/i.test(error.message ?? "");
}
const dateOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Offending column name from a PostgREST schema-cache-miss message. */
function missingColumn(error: { message?: string } | null): string | null {
  const m = /'([a-z_]+)' column|column "?([a-z_]+)"?/i.exec(error?.message ?? "");
  return (m && (m[1] || m[2])) || null;
}

/** companyId → short code used in the job moniker (MM-26001). */
const COMPANY_CODE: Record<string, string> = { "dc-solar": "DC", "mobile-mulligans": "MM" };

/** Allocate the next job moniker for a company + current year (e.g. MM-26001).
 *  Reconciles against existing job_numbers; returns null for an unknown company. */
async function allocateJobNumber(
  admin: ReturnType<typeof getSupabaseServerClient>,
  company: string,
): Promise<string | null> {
  const code = COMPANY_CODE[company];
  if (!code) return null;
  const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
  const { data } = await admin.from("jobs").select("*").eq("company", company);
  const re = new RegExp(`^${code}-${yy}(\\d+)$`);
  let max = 0;
  for (const r of (data ?? []) as Array<{ job_number?: string | null }>) {
    const m = re.exec(r.job_number ?? "");
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return `${code}-${yy}${String(max + 1).padStart(3, "0")}`;
}

async function resolveCompany(): Promise<{ company: string } | { error: string; status: number }> {
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) return { error: "unauthenticated", status: 401 };
  const admin = getSupabaseServerClient();
  const { data: emp, error } = await admin
    .from("employees")
    .select("company")
    .eq("email", user.email)
    .single();
  if (error || !emp) return { error: "not an authorized employee", status: 403 };
  return { company: emp.company };
}

export async function GET(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const admin = getSupabaseServerClient();
  const customerId = new URL(request.url).searchParams.get("customer_id");
  let q = admin.from("jobs").select("*").eq("company", ctx.company);
  if (customerId) q = q.eq("customer_id", customerId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 422 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 422 });
  const status = typeof input.status === "string" && STATUSES.includes(input.status as JobStatus)
    ? (input.status as JobStatus)
    : "active";

  const admin = getSupabaseServerClient();
  const baseRow = {
    company: ctx.company,
    name,
    customer_id: typeof input.customer_id === "string" ? input.customer_id : null,
    status,
    description: typeof input.description === "string" ? input.description : null,
  };
  const job_number = await allocateJobNumber(admin, ctx.company);
  const full = {
    ...baseRow,
    scheduled_for: dateOrNull(input.scheduled_for),
    scheduled_end: dateOrNull(input.scheduled_end),
    job_number,
    address: typeof input.address === "string" ? input.address : null,
  };
  const fullRec = full as Record<string, unknown>;
  let ins = await admin.from("jobs").insert(full).select("*").single();
  // Drop only the column(s) the schema lacks yet (job_number / scheduled_*).
  while (ins.error && isSchemaCacheMiss(ins.error)) {
    const col = missingColumn(ins.error);
    if (!col || !(col in fullRec)) break;
    delete fullRec[col];
    ins = await admin.from("jobs").insert(full).select("*").single();
  }
  const { data, error } = ins;
  if (error || !data) return NextResponse.json({ error: "insert failed" }, { status: 500 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 422 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

  const patch: Partial<Job> = { updated_at: new Date().toISOString() };
  if ("name" in input && typeof input.name === "string") patch.name = input.name;
  if ("customer_id" in input) patch.customer_id = typeof input.customer_id === "string" ? input.customer_id : null;
  if ("description" in input) patch.description = typeof input.description === "string" ? input.description : null;
  if ("status" in input && STATUSES.includes(input.status as JobStatus)) patch.status = input.status as JobStatus;
  if ("scheduled_for" in input) patch.scheduled_for = dateOrNull(input.scheduled_for);
  if ("scheduled_end" in input) patch.scheduled_end = dateOrNull(input.scheduled_end);
  if ("address" in input) patch.address = typeof input.address === "string" ? input.address : null;

  const admin = getSupabaseServerClient();
  const patchRec = patch as Record<string, unknown>;
  let upd = await admin.from("jobs").update(patch).eq("id", id).eq("company", ctx.company).select("*").single();
  // Drop only the column(s) the schema lacks yet (address / scheduled_*).
  while (upd.error && isSchemaCacheMiss(upd.error)) {
    const col = missingColumn(upd.error);
    if (!col || !(col in patchRec)) break;
    delete patchRec[col];
    if (Object.keys(patchRec).length === 0) break;
    upd = await admin.from("jobs").update(patch).eq("id", id).eq("company", ctx.company).select("*").single();
  }
  const { data, error } = upd;
  if (error || !data) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });
  const admin = getSupabaseServerClient();
  const { error } = await admin.from("jobs").delete().eq("id", id).eq("company", ctx.company);
  if (error) return NextResponse.json({ error: "delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
