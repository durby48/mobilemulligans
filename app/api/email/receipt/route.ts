// app/api/email/receipt/route.ts — email a payment receipt (PDF attached) to a
// customer via Resend. Operator-initiated: the employee clicks "Email receipt"
// in the finance panel, which reads the receipt PDF from the PC (base64) and
// POSTs it here.
//
// Auth chain mirrors the finance routes: verify the Supabase session (401) →
// confirm the caller is an authorized employee (403). The recipient + PDF come
// from the request (the operator confirmed the recipient). Resend is the send
// path because the Gmail integration is read-only. Node runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { escapeHtml, sendReceiptEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // 1. Session.
  const auth = createSupabaseServerAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // 2. Authorized employee?
  const admin = getSupabaseServerClient();
  const { data: emp, error: empErr } = await admin
    .from("employees")
    .select("company")
    .eq("email", user.email)
    .single();
  if (empErr || !emp) {
    return NextResponse.json({ error: "not an authorized employee" }, { status: 403 });
  }

  // 3. Parse + validate.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 422 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const to = typeof input.to === "string" ? input.to.trim() : "";
  const number = typeof input.number === "string" ? input.number : "";
  const pdfBase64 = typeof input.pdfBase64 === "string" ? input.pdfBase64 : "";
  const filename = typeof input.filename === "string" && input.filename ? input.filename : `${number || "receipt"}.pdf`;
  const customer = typeof input.customer === "string" ? input.customer : "";
  const amount = typeof input.amount === "number" ? input.amount : null;
  const currency = typeof input.currency === "string" && input.currency ? input.currency : "USD";

  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "a valid recipient email is required" }, { status: 422 });
  }
  if (!pdfBase64) {
    return NextResponse.json({ error: "receipt PDF is required" }, { status: 422 });
  }

  const amountStr =
    amount != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount)
      : null;

  const subject = `Payment receipt ${number} — ${siteConfig.name}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#222;max-width:520px">
      <h2 style="color:#1f6f8b;margin:0 0 12px">Payment receipt</h2>
      <p>Hi ${escapeHtml(customer || "there")},</p>
      <p>Thank you for your payment${amountStr ? ` of <strong>${amountStr}</strong>` : ""}.
      Your receipt <strong>${escapeHtml(number)}</strong> is attached as a PDF.</p>
      <p style="color:#666">— ${escapeHtml(siteConfig.name)}</p>
    </div>`;

  const sent = await sendReceiptEmail({ to, subject, html, pdfBase64, filename });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error ?? "send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to }, { headers: { "Cache-Control": "no-store" } });
}
