// lib/customers.ts — customer-library helpers shared by the customers API route
// and the finance entry route (which auto-creates a customer from a counterparty
// name). Case-insensitive upsert by (company, name); never overwrites a non-empty
// field with an empty one, so manually-entered contact details survive a re-sync.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Customer, CustomerInput, Database } from "@/types/database";

/** Keep an existing non-empty value; otherwise take the incoming one (or null). */
function coalesce(existing: string | null | undefined, incoming: string | null | undefined): string | null {
  const e = (existing ?? "").trim();
  if (e) return e;
  const i = (incoming ?? "").trim();
  return i || null;
}

/** Escape Postgres ILIKE wildcards so a name matches literally (case-insensitive). */
function ilikeLiteral(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

export async function upsertCustomerByName(
  admin: SupabaseClient<Database>,
  company: string,
  input: CustomerInput,
): Promise<{ ok: true; customer: Customer } | { ok: false; error: string }> {
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, error: "name is required" };

  const { data: existing } = await admin
    .from("customers")
    .select("*")
    .eq("company", company)
    .ilike("name", ilikeLiteral(name))
    .limit(1)
    .maybeSingle();

  const merged = {
    email: coalesce(existing?.email, input.email),
    phone: coalesce(existing?.phone, input.phone),
    address: coalesce(existing?.address, input.address),
    notes: coalesce(existing?.notes, input.notes),
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await admin
      .from("customers")
      .update(merged)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "update failed" };
    return { ok: true, customer: data as Customer };
  }

  const { data, error } = await admin
    .from("customers")
    .insert({ company, name, ...merged })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
  return { ok: true, customer: data as Customer };
}
