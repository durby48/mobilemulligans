// app/api/finance/list/route.ts — latest 100 finance entries for the employee's
// company. Verify the Supabase session (401) → resolve the employee's company via
// the service-role client (403) → list finance_entries for THAT company.
//
// The company is always server-derived; a client-supplied company is never
// trusted. Protected by middleware; in-route checks are defense-in-depth. Node
// runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  // Optional filters (portfolio / per-job rollup).
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id");
  const jobId = url.searchParams.get("job_id");

  // 3. Latest 100 entries for this company (server-derived company only).
  let query = admin
    .from("finance_entries")
    .select("*")
    .eq("company", company)
    .order("occurred_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (customerId) query = query.eq("customer_id", customerId);
  if (jobId) query = query.eq("job_id", jobId);
  const { data: entries, error } = await query;
  if (error) {
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  return NextResponse.json(
    { company, entries: entries ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
