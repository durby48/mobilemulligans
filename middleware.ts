// middleware.ts — session refresh + auth gate for the remote-operations routes.
//
// Runs on every request to /operations* and /api/ops-token*. It refreshes the
// Supabase session cookie (so server components see a current session) and blocks
// anyone who is not logged in: pages redirect to /login, API routes get 401.
//
// This is the WS4 replacement for the WS3 pre-auth gate. The page also keeps an
// OPS_PUBLIC_ENABLED feature flag (kill-switch) until launch + the tunnel are up.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // If Supabase isn't configured, fail closed on the protected routes.
  if (!url || !anon) {
    return denied(request);
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return denied(request);
  return response;
}

function denied(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/operations/:path*",
    "/api/ops-token/:path*",
    "/api/finance/:path*",
    "/api/email/:path*",
    "/api/customers/:path*",
    "/api/jobs/:path*",
    "/api/hours/:path*",
    "/api/employees/:path*",
  ],
};
