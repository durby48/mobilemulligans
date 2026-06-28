// app/api/finance/summary/route.ts — finance dashboard rollup for the employee's
// company. Verify the Supabase session (401) → resolve the employee's company via
// the service-role client (403) → aggregate finance_entries for THAT company.
//
// The company is always server-derived from the employees row; a client-supplied
// company is never trusted. Protected by middleware; in-route checks are
// defense-in-depth. Node runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { FinanceEntry } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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

  // 3. Pull this company's entries (server-derived company only).
  const { data: entries, error } = await admin
    .from("finance_entries")
    .select(
      "id, type, direction, amount, currency, counterparty, description, occurred_on, status, created_at",
    )
    .eq("company", company);
  if (error) {
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  const rows = (entries ?? []) as Array<
    Pick<
      FinanceEntry,
      | "id"
      | "type"
      | "direction"
      | "amount"
      | "currency"
      | "counterparty"
      | "description"
      | "occurred_on"
      | "status"
      | "created_at"
    >
  >;

  // Cash-basis P&L. Revenue is money ACTUALLY RECEIVED (type 'payment'), never
  // estimates (proposals/projections) or invoices (billed but not yet paid).
  //   • payment  → revenue (cash in;   a 'payment' marked 'out' is a refund → −)
  //   • expense  → expenses (cash out; an 'expense' marked 'in' is a refund → −)
  //   • estimate → pipeline    (projection only, NOT in revenue/net)
  //   • invoice  → outstanding (billed/receivable, NOT in revenue/net until paid)
  let revenue = 0;
  let expenses = 0;
  let pipeline = 0; // estimates — projected, not realized
  let outstanding = 0; // invoices billed but not yet counted as revenue
  const byType: Record<string, number> = {};
  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    switch (r.type) {
      case "payment":
        revenue += r.direction === "out" ? -amount : amount;
        break;
      case "expense":
        expenses += r.direction === "in" ? -amount : amount;
        break;
      case "estimate":
        pipeline += amount;
        break;
      case "invoice":
        outstanding += amount;
        break;
    }
    byType[r.type] = (byType[r.type] ?? 0) + amount;
  }

  // recent = latest 20 by occurred_on desc (nulls last), then created_at desc.
  const recent = [...rows]
    .sort((a, b) => {
      const ao = a.occurred_on;
      const bo = b.occurred_on;
      if (ao !== bo) {
        if (ao === null) return 1; // nulls last
        if (bo === null) return -1;
        return ao < bo ? 1 : -1; // desc
      }
      return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
    })
    .slice(0, 20)
    .map((r) => ({
      id: r.id,
      type: r.type,
      direction: r.direction,
      amount: r.amount,
      currency: r.currency,
      counterparty: r.counterparty,
      description: r.description,
      occurred_on: r.occurred_on,
      status: r.status,
    }));

  return NextResponse.json(
    {
      company,
      revenue,
      expenses,
      net: revenue - expenses,
      pipeline,
      outstanding,
      byType,
      recent,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
