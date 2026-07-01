// lib/emailTemplates.ts — company-branded customer email templates that Eli Eagle
// uses when drafting (estimate / invoice / payment). Each renders a polished HTML
// email with the company logo, the document context, an optional personalized note
// from Eli, and an invitation to leave a review. The file is identical in both
// sites; it adapts to the company automatically via siteConfig.

import { siteConfig } from "@/lib/site";
import { escapeHtml } from "@/lib/email";

export type EmailTemplateKey = "estimate" | "invoice" | "payment" | "receipt" | "scheduled";

export interface EmailTemplateCtx {
  customerName?: string | null;
  documentNumber?: string | null;
  amount?: number | null;
  currency?: string | null;
  /** Scheduling-confirmation context. */
  jobName?: string | null;
  scheduledFor?: string | null; // YYYY-MM-DD
  scheduledEnd?: string | null; // YYYY-MM-DD
  /** Job service/site address — appended to the subject line when present. */
  jobAddress?: string | null;
  /** Optional personalized line(s) from Eli, slotted into the body. */
  note?: string | null;
}

function prettyDate(s: string | null | undefined): string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  try {
    return new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

const IS_DC = siteConfig.domain.includes("dcsolarkc");
/** The per-company word for a `job` (DC Solar) / `event` (Mobile Mulligans). */
const SCHED_NOUN = IS_DC ? "job" : "event";
const BRAND = {
  accent: IS_DC ? "#1f6f8b" : "#c9a227",
  accentDark: IS_DC ? "#16505f" : "#9e7d18",
  logoUrl: `${siteConfig.url}${IS_DC ? "/logo.png" : "/logo.svg"}`,
  reviewUrl: process.env.REVIEW_URL || siteConfig.reviewUrl,
};

function money(currency: string | null | undefined, n: number | null | undefined): string {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${currency || "USD"} ${n.toFixed(2)}`;
  }
}

interface Copy {
  subject: (ctx: EmailTemplateCtx) => string;
  lead: (ctx: EmailTemplateCtx) => string;
  reviewLine: string;
}

const COPY: Record<EmailTemplateKey, Copy> = {
  estimate: {
    subject: (c) => `Your ${siteConfig.name} estimate${c.documentNumber ? ` ${c.documentNumber}` : ""}`,
    lead: (c) =>
      `Thank you for the opportunity to earn your business. Your estimate${c.documentNumber ? ` <strong>${escapeHtml(c.documentNumber)}</strong>` : ""} is ready` +
      `${c.amount != null ? `, with an estimated total of <strong>${money(c.currency, c.amount)}</strong>` : ""}. ` +
      `We'd love the chance to work with you — just reply with any questions and we'll be glad to help.`,
    reviewLine: "Already worked with us before?",
  },
  invoice: {
    subject: (c) => `Your ${siteConfig.name} invoice${c.documentNumber ? ` ${c.documentNumber}` : ""}`,
    lead: (c) =>
      `Here is your invoice${c.documentNumber ? ` <strong>${escapeHtml(c.documentNumber)}</strong>` : ""}` +
      `${c.amount != null ? `, for <strong>${money(c.currency, c.amount)}</strong>` : ""}. ` +
      `Thank you for choosing ${escapeHtml(siteConfig.name)} — please reply if you have any questions about your invoice or payment options.`,
    reviewLine: "Happy with our work?",
  },
  payment: {
    subject: () => `Thank you for your payment — ${siteConfig.name}`,
    lead: (c) =>
      `Thank you so much for your payment${c.amount != null ? ` of <strong>${money(c.currency, c.amount)}</strong>` : ""}! ` +
      `We truly appreciate your business and the trust you've placed in ${escapeHtml(siteConfig.name)}.`,
    reviewLine: "We'd love your feedback —",
  },
  receipt: {
    subject: (c) => `Your ${siteConfig.name} receipt${c.documentNumber ? ` ${c.documentNumber}` : ""}`,
    lead: (c) =>
      `Thank you for your payment${c.amount != null ? ` of <strong>${money(c.currency, c.amount)}</strong>` : ""} — this confirms we've received it` +
      `${c.documentNumber ? `, receipt <strong>${escapeHtml(c.documentNumber)}</strong>` : ""}. ` +
      `We truly appreciate your business, and your receipt is attached for your records.`,
    reviewLine: "Thanks again for choosing us —",
  },
  scheduled: {
    subject: () => `Your ${siteConfig.name} ${SCHED_NOUN} is scheduled`,
    lead: (c) => {
      const when = prettyDate(c.scheduledFor);
      const end = prettyDate(c.scheduledEnd);
      return (
        `Great news — your ${SCHED_NOUN}${c.jobName ? ` "<strong>${escapeHtml(c.jobName)}</strong>"` : ""} is confirmed` +
        `${when ? ` for <strong>${when}</strong>` : ""}${end && end !== when ? ` through <strong>${end}</strong>` : ""}. ` +
        `We're looking forward to it! Please reply if you need to make any changes or have questions before then.`
      );
    },
    reviewLine: "Worked with us before?",
  },
};

/** Render the branded HTML (and subject) for a template + context. */
export function renderEmail(key: EmailTemplateKey, ctx: EmailTemplateCtx): { subject: string; html: string } {
  const copy = COPY[key];
  const name = (ctx.customerName ?? "").trim() || "there";
  const note = (ctx.note ?? "").trim();
  const addr = (ctx.jobAddress ?? "").trim();
  const subject = copy.subject(ctx) + (addr ? ` — ${addr}` : "");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f6f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#1f2a33;">
        <tr>
          <td style="background:${BRAND.accent};padding:22px 28px;" align="left">
            <img src="${BRAND.logoUrl}" alt="${escapeHtml(siteConfig.name)}" height="40" style="height:40px;max-height:40px;display:block;border:0;" />
            <div style="color:#ffffff;font-size:18px;font-weight:bold;margin-top:8px;">${escapeHtml(siteConfig.name)}</div>
            <div style="color:#eaf3f7;font-size:12px;margin-top:2px;">${escapeHtml(siteConfig.tagline ?? "")}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="font-size:15px;margin:0 0 14px;">Hi ${escapeHtml(name)},</p>
            <p style="font-size:14px;line-height:1.6;margin:0 0 14px;">${copy.lead(ctx)}</p>
            ${note ? `<p style="font-size:14px;line-height:1.6;margin:0 0 14px;">${escapeHtml(note)}</p>` : ""}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
              <tr><td>
                <a href="${escapeHtml(BRAND.reviewUrl)}" style="background:${BRAND.accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 20px;border-radius:8px;display:inline-block;">★ Leave us a review</a>
              </td></tr>
            </table>
            <p style="font-size:13px;color:#5a6b75;line-height:1.6;margin:0;">${copy.reviewLine} A quick review helps our small business more than you know — thank you!</p>
            <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">Warm regards,<br/>The ${escapeHtml(siteConfig.name)} team</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0f1b22;padding:18px 28px;color:#9fb2bd;font-size:12px;line-height:1.6;">
            <strong style="color:#ffffff;">${escapeHtml(siteConfig.name)}</strong><br/>
            ${escapeHtml(siteConfig.phone ?? "")} · <a href="mailto:${escapeHtml(siteConfig.email)}" style="color:#9fb2bd;">${escapeHtml(siteConfig.email)}</a><br/>
            ${escapeHtml(siteConfig.serviceArea ?? "")}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
  </body></html>`;

  return { subject, html };
}
