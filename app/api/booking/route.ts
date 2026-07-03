import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateBookingInput } from "@/lib/validation";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`booking:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests — please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 }
    );
  }

  const result = validateBookingInput(raw);
  if (!result.valid || !result.data) {
    return NextResponse.json(
      { ok: false, message: "Please fix the highlighted fields.", errors: result.errors },
      { status: 422 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("booking_requests")
      .insert({ ...result.data, status: "new" });

    if (error) {
      console.error("booking insert failed", error.code ?? "unknown");
      return NextResponse.json(
        { ok: false, message: "We couldn't save your request. Please try again or email us directly." },
        { status: 500 }
      );
    }

    const b = result.data;
    await sendNotificationEmail({
      subject: `New booking request — ${b.name}`,
      replyTo: b.email,
      html: `
        <h2>New booking request</h2>
        <table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
          <tr><td><strong>Name</strong></td><td>${escapeHtml(b.name)}</td></tr>
          <tr><td><strong>Email</strong></td><td>${escapeHtml(b.email)}</td></tr>
          <tr><td><strong>Phone</strong></td><td>${escapeHtml(b.phone)}</td></tr>
          <tr><td><strong>Event date</strong></td><td>${escapeHtml(b.event_date)}</td></tr>
          <tr><td><strong>Event type</strong></td><td>${escapeHtml(b.event_type)}</td></tr>
          <tr><td><strong>Guest count</strong></td><td>${escapeHtml(b.guest_count)}</td></tr>
          <tr><td><strong>Location</strong></td><td>${escapeHtml(b.event_location)}</td></tr>
          <tr><td valign="top"><strong>Message</strong></td><td>${escapeHtml(b.message)}</td></tr>
        </table>
      `,
    });
  } catch (err) {
    console.error(
      "booking submission failed",
      (err as { code?: string } | null)?.code ?? "unknown"
    );
    return NextResponse.json(
      { ok: false, message: "Booking service is not configured. Please email us directly." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, message: "Thanks! We received your request and will be in touch shortly." },
    { status: 201 }
  );
}
