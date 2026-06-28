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

/** Scheduling columns (added by ws-jobs-scheduling.sql); stripped on retry pre-migration. */
const SCHED_COLS = ["scheduled_for", "scheduled_end"] as const;
function isSchemaCacheMiss(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  return /column .* (does not exist|schema cache)/i.test(error.message ?? "");
}
const dateOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

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
  let ins = await admin
    .from("jobs")
    .insert({ ...baseRow, scheduled_for: dateOrNull(input.scheduled_for), scheduled_end: dateOrNull(input.scheduled_end) })
    .select("*")
    .single();
  if (ins.error && isSchemaCacheMiss(ins.error)) {
    ins = await admin.from("jobs").insert(baseRow).select("*").single();
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

  const admin = getSupabaseServerClient();
  let upd = await admin.from("jobs").update(patch).eq("id", id).eq("company", ctx.company).select("*").single();
  if (upd.error && isSchemaCacheMiss(upd.error)) {
    const stripped: Partial<Job> = { ...patch };
    for (const c of SCHED_COLS) delete stripped[c];
    upd = await admin.from("jobs").update(stripped).eq("id", id).eq("company", ctx.company).select("*").single();
  }
  const { data, error } = upd;
  if (error || !data) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
