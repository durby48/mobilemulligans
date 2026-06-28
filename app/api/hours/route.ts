// app/api/hours/route.ts — employee time entries (labor) tied to a customer/job.
//   GET   → list (optional ?customer_id= / ?job_id=)
//   POST  → log hours
//   PATCH → edit an hours entry
// Labor cost = hours × rate; the finance summary route folds it into Expenses.
// Same auth chain as the finance/customers/jobs routes.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { EmployeeHours } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveCompany(): Promise<{ company: string } | { error: string; status: number }> {
  const auth = createSupabaseServerAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email) return { error: "unauthenticated", status: 401 };
  const admin = getSupabaseServerClient();
  const { data: emp, error } = await admin.from("employees").select("company").eq("email", user.email).single();
  if (error || !emp) return { error: "not an authorized employee", status: 403 };
  return { company: emp.company };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export async function GET(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const admin = getSupabaseServerClient();
  const url = new URL(request.url);
  let q = admin.from("employee_hours").select("*").eq("company", ctx.company);
  const cid = url.searchParams.get("customer_id");
  const jid = url.searchParams.get("job_id");
  if (cid) q = q.eq("customer_id", cid);
  if (jid) q = q.eq("job_id", jid);
  const { data, error } = await q.order("occurred_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  return NextResponse.json({ hours: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const employee = (str(input.employee) ?? "").trim();
  const hours = num(input.hours);
  if (!employee) return NextResponse.json({ error: "employee is required" }, { status: 422 });
  if (hours == null || hours < 0) return NextResponse.json({ error: "hours must be a number ≥ 0" }, { status: 422 });

  const admin = getSupabaseServerClient();
  const { data, error } = await admin.from("employee_hours").insert({
    company: ctx.company,
    employee,
    customer_id: str(input.customer_id),
    job_id: str(input.job_id),
    occurred_on: str(input.occurred_on),
    hours,
    rate: num(input.rate) ?? 0,
    description: str(input.description),
  }).select("*").single();
  if (error || !data) return NextResponse.json({ error: "insert failed" }, { status: 500 });
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const ctx = await resolveCompany();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const id = str(input.id);
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

  const patch: Partial<EmployeeHours> = {};
  if ("employee" in input && str(input.employee)) patch.employee = str(input.employee) as string;
  if ("customer_id" in input) patch.customer_id = str(input.customer_id);
  if ("job_id" in input) patch.job_id = str(input.job_id);
  if ("occurred_on" in input) patch.occurred_on = str(input.occurred_on);
  if ("hours" in input && num(input.hours) != null) patch.hours = num(input.hours) as number;
  if ("rate" in input && num(input.rate) != null) patch.rate = num(input.rate) as number;
  if ("description" in input) patch.description = str(input.description);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no editable fields" }, { status: 422 });

  const admin = getSupabaseServerClient();
  const { data, error } = await admin.from("employee_hours").update(patch).eq("id", id).eq("company", ctx.company).select("*").single();
  if (error || !data) return NextResponse.json({ error: "hours entry not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
