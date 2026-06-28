// app/api/customers/route.ts — the per-company customer library.
//   GET            → list customers (or one via ?id=)
//   POST {name,…}  → upsert a customer by name (case-insensitive)
//   PATCH {id,…}   → update a customer by id
// Auth chain mirrors the finance routes: session (401) → employee → server-derived
// company (403). Writes via service role; company is NEVER taken from the body.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { upsertCustomerByName } from "@/lib/customers";
import type { Customer } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const { data, error } = await admin
      .from("customers")
      .select("*")
      .eq("company", ctx.company)
      .eq("id", id)
      .single();
    if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ customer: data }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data, error } = await admin
    .from("customers")
    .select("*")
    .eq("company", ctx.company)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  return NextResponse.json({ customers: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
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

  const admin = getSupabaseServerClient();
  const res = await upsertCustomerByName(admin, ctx.company, {
    name,
    email: typeof input.email === "string" ? input.email : null,
    phone: typeof input.phone === "string" ? input.phone : null,
    address: typeof input.address === "string" ? input.address : null,
    notes: typeof input.notes === "string" ? input.notes : null,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json(res.customer, { status: 201, headers: { "Cache-Control": "no-store" } });
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

  const patch: Partial<Customer> = { updated_at: new Date().toISOString() };
  if ("name" in input && typeof input.name === "string" && input.name.trim()) patch.name = input.name.trim();
  if ("email" in input) patch.email = typeof input.email === "string" ? input.email : null;
  if ("phone" in input) patch.phone = typeof input.phone === "string" ? input.phone : null;
  if ("address" in input) patch.address = typeof input.address === "string" ? input.address : null;
  if ("notes" in input) patch.notes = typeof input.notes === "string" ? input.notes : null;
  const admin = getSupabaseServerClient();
  const { data, error } = await admin
    .from("customers")
    .update(patch)
    .eq("id", id)
    .eq("company", ctx.company)
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: "customer not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
