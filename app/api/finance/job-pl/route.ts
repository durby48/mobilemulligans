// app/api/finance/job-pl/route.ts — per-JOB P&L rollup + forward-looking billables
// projection (this week / month / year, by the job schedule). Same auth chain as
// the other finance routes; company is server-derived. Node runtime; never cached.
//
// Per job: estimate (Σ estimates), invoiced (Σ invoices), paid (Σ payments = cash
// revenue), expenses (Σ job expenses + labor Σ hours×rate), net (paid − expenses),
// and billable = invoiced||estimate (expected revenue). Projection sums each job's
// billable into the week/month/year window its scheduled_for falls in.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FinanceEntry, Job } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current week (Sun–Sat) / month / year bounds, anchored on the caller's today. */
function bounds(today: string) {
  const d = new Date(`${today}T00:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const wkStart = new Date(d);
  wkStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
  const wkEnd = new Date(wkStart);
  wkEnd.setUTCDate(wkStart.getUTCDate() + 6);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return {
    week: [iso(wkStart), iso(wkEnd)] as const,
    month: [iso(new Date(Date.UTC(y, m, 1))), iso(new Date(Date.UTC(y, m + 1, 0)))] as const,
    year: [iso(new Date(Date.UTC(y, 0, 1))), iso(new Date(Date.UTC(y, 11, 31)))] as const,
  };
}
const inWindow = (date: string | null, w: readonly [string, string]) => !!date && date >= w[0] && date <= w[1];
const signed = (r: FinanceEntry) => (r.status === "refund" ? -Number(r.amount || 0) : Number(r.amount || 0));

export async function GET(request: Request) {
  const today = new URL(request.url).searchParams.get("today") ?? new Date().toISOString().slice(0, 10);

  const auth = createSupabaseServerAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = getSupabaseServerClient();
  const { data: emp, error: empErr } = await admin.from("employees").select("company").eq("email", user.email).single();
  if (empErr || !emp) return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  const company = emp.company;

  const [{ data: jobRows }, { data: entryRows }, { data: custRows }, hoursRes] = await Promise.all([
    admin.from("jobs").select("*").eq("company", company),
    admin.from("finance_entries").select("*").eq("company", company),
    admin.from("customers").select("id, name").eq("company", company),
    admin.from("employee_hours").select("hours, rate, job_id").eq("company", company),
  ]);

  const jobs = (jobRows ?? []) as Job[];
  const entries = (entryRows ?? []) as FinanceEntry[];
  const custName = new Map((custRows ?? []).map((c) => [c.id, c.name]));

  // Labor per job (Σ hours × rate). Degrades to 0 if the hours table is absent.
  const laborByJob = new Map<string, number>();
  for (const h of (hoursRes.data ?? []) as Array<{ hours: number; rate: number; job_id: string | null }>) {
    if (!h.job_id) continue;
    laborByJob.set(h.job_id, (laborByJob.get(h.job_id) ?? 0) + (Number(h.hours) || 0) * (Number(h.rate) || 0));
  }

  const rows = jobs.map((j) => {
    const je = entries.filter((e) => e.job_id === j.id);
    const estimate = je.filter((e) => e.type === "estimate").reduce((s, e) => s + Number(e.amount || 0), 0);
    const invoiced = je.filter((e) => e.type === "invoice").reduce((s, e) => s + Number(e.amount || 0), 0);
    const paid = je.filter((e) => e.type === "payment").reduce((s, e) => s + signed(e), 0);
    const labor = laborByJob.get(j.id) ?? 0;
    const expenses = je.filter((e) => e.type === "expense").reduce((s, e) => s + signed(e), 0) + labor;
    const billable = invoiced > 0 ? invoiced : estimate;
    return {
      job_id: j.id,
      job_number: j.job_number ?? null,
      name: j.name,
      customer: j.customer_id ? custName.get(j.customer_id) ?? null : null,
      status: j.status,
      scheduled_for: j.scheduled_for,
      scheduled_end: j.scheduled_end,
      estimate,
      invoiced,
      paid,
      labor,
      expenses,
      billable,
      net: paid - expenses,
    };
  });
  // Newest job number first (fallback: name).
  rows.sort((a, b) => (b.job_number ?? "").localeCompare(a.job_number ?? "") || a.name.localeCompare(b.name));

  const w = bounds(today);
  const sumBillable = (win: readonly [string, string]) =>
    rows.filter((r) => inWindow(r.scheduled_for, win)).reduce((s, r) => s + r.billable, 0);
  const projection = {
    week: { start: w.week[0], end: w.week[1], amount: sumBillable(w.week) },
    month: { start: w.month[0], end: w.month[1], amount: sumBillable(w.month) },
    year: { start: w.year[0], end: w.year[1], amount: sumBillable(w.year) },
    unscheduled: rows.filter((r) => !r.scheduled_for).reduce((s, r) => s + r.billable, 0),
  };

  return NextResponse.json({ company, today, projection, jobs: rows }, { headers: { "Cache-Control": "no-store" } });
}
