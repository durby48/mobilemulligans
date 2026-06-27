// lib/supabase/auth-browser.ts — cookie-aware Supabase client for BROWSER use
// (the login form). Writes the session into cookies that the server auth client
// and middleware read back. Uses the public anon key only.

"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createSupabaseBrowserAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createBrowserClient<Database>(url, anon);
}
