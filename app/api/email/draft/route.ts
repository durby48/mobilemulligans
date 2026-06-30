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
import { renderEmail, type EmailTemplateKey } from "@/lib/emailTemplates";

const TEMPLATE_KEYS = new Set<EmailTemplateKey>(["estimate", "invoice", "payment", "receipt", "scheduled"]);

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
  const to = typeof input.to === "string" ? input.to : null;
  const template = typeof input.template === "string" ? input.template : "";

  // Preferred path: render the company-branded template (logo + review CTA).
  let subject = "";
  let content = "";
  let html = false;
  if (TEMPLATE_KEYS.has(template as EmailTemplateKey)) {
    const rendered = renderEmail(template as EmailTemplateKey, {
      customerName: typeof input.customerName === "string" ? input.customerName : null,
      documentNumber: typeof input.documentNumber === "string" ? input.documentNumber : null,
      amount: typeof input.amount === "number" ? input.amount : null,
      currency: typeof input.currency === "string" ? input.currency : null,
      jobName: typeof input.jobName === "string" ? input.jobName : null,
      scheduledFor: typeof input.scheduledFor === "string" ? input.scheduledFor : null,
      scheduledEnd: typeof input.scheduledEnd === "string" ? input.scheduledEnd : null,
      note: typeof input.note === "string" ? input.note : null,
    });
    subject = rendered.subject;
    content = rendered.html;
    html = true;
  } else {
    // Legacy/fallback: raw subject + body.
    subject = typeof input.subject === "string" ? input.subject : "";
    content = typeof input.body === "string" ? input.body : "";
  }
  if (!subject.trim() || !content.trim()) {
    return NextResponse.json({ error: "a template (or subject + body) is required" }, { status: 422 });
  }

  // Optional attachment (e.g. the generated PDF) — base64 from the PC.
  let attachment: { filename: string; mimeType: string; base64: string } | null = null;
  if (input.attachment && typeof input.attachment === "object") {
    const a = input.attachment as Record<string, unknown>;
    if (typeof a.base64 === "string" && a.base64) {
      attachment = {
        filename: typeof a.filename === "string" && a.filename ? a.filename : "document.pdf",
        mimeType: typeof a.mimeType === "string" && a.mimeType ? a.mimeType : "application/pdf",
        base64: a.base64,
      };
    }
  }

  try {
    const draft = await createDraft(mailbox, { to, subject, body: content, html, attachment });
    return NextResponse.json({ ok: true, mailbox, draftId: draft.id }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("email draft error:", err);
    return NextResponse.json({ error: "failed to create draft" }, { status: 502 });
  }
}
