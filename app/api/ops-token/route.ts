// app/api/ops-token/route.ts — mint a short-lived ops session token.
//
// The embedded operations client (public/ops-client) fetches this after the
// employee logs in. Flow: verify the Supabase session → look up the employee's
// company + role → sign an HS256 token (claims = @durbin/contracts
// OpsSessionClaims) → return { token }. The PC verifies the signature/issuer/exp
// and enforces scope server-side; this route never grants more than the
// employee's row allows.
//
// Protected by middleware (401 if unauthenticated); the in-route checks are
// defense-in-depth. Node runtime (node:crypto signing); never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mintOpsToken, type OperatorRole } from "@/lib/ops-jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES = new Set<OperatorRole>(["owner", "operator", "viewer"]);

export async function GET() {
  // 1. Who is asking? (session from cookies)
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Required signing config — fail loudly if the deploy is misconfigured.
  const secret = process.env.OPS_TOKEN_SECRET;
  const issuer = process.env.OPS_ISSUER;
  if (!secret || !issuer) {
    console.error("ops-token: OPS_TOKEN_SECRET / OPS_ISSUER not set");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  // 3. Is this user an authorized employee? (service-role lookup, bypasses RLS)
  const admin = getSupabaseServerClient();
  const { data: emp, error } = await admin
    .from("employees")
    .select("company, role, display_name")
    .eq("email", user.email)
    .single();

  if (error || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }
  if (!VALID_ROLES.has(emp.role as OperatorRole)) {
    return NextResponse.json({ error: "invalid role" }, { status: 403 });
  }

  // 4. Mint. Owner → scope "all"; everyone else → their single company.
  const { token } = mintOpsToken({
    userId: user.id,
    email: user.email,
    displayName: emp.display_name,
    company: emp.company,
    role: emp.role as OperatorRole,
    issuer,
    secret,
  });

  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
