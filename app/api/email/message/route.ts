// app/api/email/message/route.ts — read one full message from the employee's
// own company mailbox (read-only).
//
// Same auth chain as the inbox route: session (401) → employee (403) → mailbox
// derived SERVER-SIDE. The `id` is an opaque Gmail message id; because we fetch
// it while impersonating the employee's own mailbox, an id belonging to another
// mailbox simply isn't found — there is no cross-mailbox read.
//
// 501 until configured (see config/EMAIL_SETUP.md). Node runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMessage, isGmailConfigured, resolveMailbox } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isGmailConfigured()) {
    return NextResponse.json(
      { error: "email not configured", setup: "config/EMAIL_SETUP.md" },
      { status: 501 },
    );
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const admin = getSupabaseServerClient();
  const { data: emp, error: empError } = await admin
    .from("employees")
    .select("*")
    .eq("email", user.email)
    .single();
  if (empError || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }

  const mailbox = resolveMailbox(emp as { email: string; company: string; mailbox?: string | null });
  if (!mailbox) {
    return NextResponse.json({ error: "no mailbox mapped for this employee" }, { status: 403 });
  }

  try {
    const message = await getMessage(mailbox, id);
    return NextResponse.json(message, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("email message error:", err);
    return NextResponse.json({ error: "failed to load message" }, { status: 502 });
  }
}
