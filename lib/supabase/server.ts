import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for use in API routes / server actions.
 *
 * Prefers the service role key when present (bypasses RLS for trusted server
 * inserts). Falls back to the anon key, which works fine when you have an RLS
 * INSERT policy that allows anonymous booking submissions (see README SQL).
 *
 * The service role key must NEVER be imported into client components.
 */

export function getSupabaseServerClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const key = serviceRoleKey || anonKey;

  if (!supabaseUrl || !key) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and an anon or service role key."
    );
  }

  return createClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
