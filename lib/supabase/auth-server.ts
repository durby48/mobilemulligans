// lib/supabase/auth-server.ts — cookie-aware Supabase client for SERVER use
// (server components, route handlers). Reads the logged-in employee's session
// from the request cookies so /operations and /api/ops-token know who is asking.
//
// This is the AUTH client (anon key + the user's session). It is distinct from
// lib/supabase/server.ts, which uses the service-role key for trusted writes and
// the employee lookup in the token route.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export function createSupabaseServerAuthClient() {
  const cookieStore = cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Writing cookies from a Server Component throws; route handlers and
        // middleware can write. Swallow the SC case — the session is refreshed
        // in middleware anyway.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* called from a Server Component render; ignore */
        }
      },
    },
  });
}
