// app/api/employees/route.ts — the company's team roster.
//   GET   → list employees (any authorized employee)
//   POST  → add an employee record (OWNER only)
//   PATCH → edit display_name / role (OWNER only)
// Note: adding a row here does NOT create a login. For an employee to sign in,
// the owner must also create a matching Supabase Auth user (same email).
// Same service-role pattern as the other routes; company is server-derived.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Employee, OperatorRole } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: OperatorRole[] = ["owner", "operator", "viewer"];

async function resolveCaller(): Promise<{ company: string; role: OperatorRole } | { error: string; status: number }> {
  const auth = createSupabaseServerAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email) return { error: "unauthenticated", status: 401 };
  const admin = getSupabaseServerClient();
  const { data: emp, error } = await admin.from("employees").select("company, role").eq("email", user.email).single();
  if (error || !emp) return { error: "not an authorized employee", status: 403 };
  return { company: emp.company, role: emp.role as OperatorRole };
}

export async function GET() {
  const ctx = await resolveCaller();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const admin = getSupabaseServerClient();
  const { data, error } = await admin
    .from("employees")
    .select("id, email, company, role, display_name, created_at")
    .eq("company", ctx.company)
    .order("display_name", { ascending: true });
  if (error) return NextResponse.json({ error: "query failed" }, { status: 500 });
  return NextResponse.json({ employees: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const ctx = await resolveCaller();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const role = typeof input.role === "string" && ROLES.includes(input.role as OperatorRole) ? (input.role as OperatorRole) : "operator";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "a valid email is required" }, { status: 422 });

  const admin = getSupabaseServerClient();
  const { data, error } = await admin
    .from("employees")
    .insert({ email, company: ctx.company, role, display_name: typeof input.display_name === "string" ? input.display_name : null })
    .select("id, email, company, role, display_name, created_at")
    .single();
  if (error || !data) {
    const dup = /duplicate|unique/i.test(error?.message ?? "");
    return NextResponse.json({ error: dup ? "an employee with that email already exists" : "insert failed" }, { status: dup ? 409 : 500 });
  }
  return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const ctx = await resolveCaller();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner only" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 422 });

  const patch: Partial<Employee> = {};
  if ("display_name" in input) patch.display_name = typeof input.display_name === "string" ? input.display_name : null;
  if ("role" in input && ROLES.includes(input.role as OperatorRole)) patch.role = input.role as OperatorRole;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "no editable fields" }, { status: 422 });

  const admin = getSupabaseServerClient();
  const { data, error } = await admin
    .from("employees")
    .update(patch)
    .eq("id", id)
    .eq("company", ctx.company)
    .select("id, email, company, role, display_name, created_at")
    .single();
  if (error || !data) return NextResponse.json({ error: "employee not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
