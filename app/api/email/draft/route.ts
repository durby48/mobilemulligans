// app/api/email/draft/route.ts — save an agent-drafted customer email into the
// company mailbox's Gmail DRAFTS folder (not sent). The operator/Eli supplies the
// recipient + subject + body; the mailbox is derived server-side per company
// (DC → devon@dcsolarkc.com, MM → info@mobilemulligans.net).
//
// Requires the service account to be delegated the gmail.compose scope (see
// config/EMAIL_SETUP.md). 501 until GOOGLE_SA_KEY is configured. Node runtime.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createDraft, draftsMailbox, isGmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isGmailConfigured()) {
    return NextResponse.json({ error: "email not configured", setup: "config/EMAIL_SETUP.md" }, { status: 501 });
  }

  const auth = createSupabaseServerAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = getSupabaseServerClient();
  const { data: emp, error: empErr } = await admin.from("employees").select("company").eq("email", user.email).single();
  if (empErr || !emp) return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });

  const mailbox = draftsMailbox(emp.company);
  if (!mailbox) return NextResponse.json({ error: "no drafts mailbox for this company" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const subject = typeof input.subject === "string" ? input.subject : "";
  const text = typeof input.body === "string" ? input.body : "";
  const to = typeof input.to === "string" ? input.to : null;
  if (!subject.trim() || !text.trim()) {
    return NextResponse.json({ error: "subject and body are required" }, { status: 422 });
  }

  try {
    const draft = await createDraft(mailbox, { to, subject, body: text });
    return NextResponse.json({ ok: true, mailbox, draftId: draft.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("email draft error:", err);
    return NextResponse.json({ error: "failed to create draft" }, { status: 502 });
  }
}
