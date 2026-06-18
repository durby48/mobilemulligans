import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateBookingInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
      console.error("Supabase insert error:", error.message);
      return NextResponse.json(
        { ok: false, message: "We couldn't save your request. Please try again or email us directly." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Booking submission failed:", err);
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
