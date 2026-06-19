import { siteConfig } from "@/lib/site";

/**
 * Sends transactional notification emails via the Resend HTTP API.
 *
 * Uses fetch (no SDK dependency) so it works on Vercel without extra installs.
 * Requires these environment variables:
 *   - RESEND_API_KEY     (required to actually send)
 *   - NOTIFICATION_TO    (optional, defaults to siteConfig.email)
 *   - NOTIFICATION_FROM  (optional, defaults to a notifications@<domain> sender)
 *
 * Failures are logged but never thrown, so a missing/broken email setup will
 * not break a booking or waitlist submission.
 */

type SendArgs = {
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendNotificationEmail({ subject, html, replyTo }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_TO || siteConfig.email;
  const from =
    process.env.NOTIFICATION_FROM ||
    `${siteConfig.name} <notifications@${siteConfig.domain}>`;

  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping notification email.");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Resend email failed:", res.status, detail);
    }
  } catch (err) {
    console.error("Resend email error:", err);
  }
}

/** Escapes user-supplied text so it is safe to embed in notification HTML. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
