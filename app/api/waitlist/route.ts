import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { validateWaitlistInput } from "@/lib/validation";

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

  const result = validateWaitlistInput(raw);
  if (!result.valid || !result.data) {
    return NextResponse.json(
      { ok: false, message: "Please fix the highlighted fields.", errors: result.errors },
      { status: 422 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("waitlist_signups")
      .upsert(result.data, { onConflict: "email", ignoreDuplicates: true });

    if (error) {
      console.error("Supabase waitlist insert error:", error.message);
      return NextResponse.json(
        { ok: false, message: "We couldn't add you just now. Please try again shortly." },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Waitlist signup failed:", err);
    return NextResponse.json(
      { ok: false, message: "Waitlist service is not configured. Please email us directly." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, message: "You're on the list! We'll be in touch when we tee off in Kansas City." },
    { status: 201 }
  );
}
