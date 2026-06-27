// app/api/email/inbox/route.ts — the employee's company email inbox (read-only).
//
// Verify the Supabase session (401) → resolve the employee via the service-role
// client (403) → derive the mailbox SERVER-SIDE from that employee (never the
// client) → list the most recent INBOX messages via the Gmail API.
//
// Until the Google Workspace service account + Vercel env are configured, this
// returns 501 (see config/EMAIL_SETUP.md). Node runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isGmailConfigured, listInbox, resolveMailbox } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGmailConfigured()) {
    return NextResponse.json(
      { error: "email not configured", setup: "config/EMAIL_SETUP.md" },
      { status: 501 },
    );
  }

  // 1. Who is asking? (session from cookies)
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Authorized employee? (service-role lookup, bypasses RLS). select("*") so a
  //    not-yet-added `mailbox` column is simply absent, never an error.
  const admin = getSupabaseServerClient();
  const { data: emp, error: empError } = await admin
    .from("employees")
    .select("*")
    .eq("email", user.email)
    .single();
  if (empError || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }

  // 3. Server-derived mailbox — the client never names it.
  const mailbox = resolveMailbox(emp as { email: string; company: string; mailbox?: string | null });
  if (!mailbox) {
    return NextResponse.json({ error: "no mailbox mapped for this employee" }, { status: 403 });
  }

  // 4. Read the inbox.
  try {
    const messages = await listInbox(mailbox);
    return NextResponse.json({ mailbox, messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("email inbox error:", err);
    return NextResponse.json({ error: "failed to load inbox" }, { status: 502 });
  }
}
