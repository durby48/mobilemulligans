// app/api/calendar/event/route.ts — create a Google Calendar event for a job/event.
//   POST { summary, description?, startDate, endDate? } → { id, htmlLink }
// Company is server-derived from the caller's employee row (never client-supplied).
// 501 until the Calendar integration is configured. Node runtime; never cached.

import { NextResponse } from "next/server";
import { createSupabaseServerAuthClient } from "@/lib/supabase/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createCalendarEvent, isCalendarConfigured } from "@/lib/gcal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveCaller(): Promise<{ company: string; role: string } | { error: string; status: number }> {
  const auth = createSupabaseServerAuthClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user?.email) return { error: "unauthenticated", status: 401 };
  const admin = getSupabaseServerClient();
  const { data: emp, error } = await admin.from("employees").select("company, role").eq("email", user.email).single();
  if (error || !emp) return { error: "not an authorized employee", status: 403 };
  return { company: emp.company, role: emp.role };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const ctx = await resolveCaller();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (ctx.role === "viewer") return NextResponse.json({ error: "viewers cannot create events" }, { status: 403 });
  if (!isCalendarConfigured()) {
    return NextResponse.json({ error: "Google Calendar is not configured (set GOOGLE_SA_KEY + calendar scope)" }, { status: 501 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 422 }); }
  const input = (body ?? {}) as Record<string, unknown>;
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const startDate = typeof input.startDate === "string" ? input.startDate.trim() : "";
  const endDate = typeof input.endDate === "string" && input.endDate.trim() ? input.endDate.trim() : undefined;
  const description = typeof input.description === "string" ? input.description : undefined;

  if (!summary) return NextResponse.json({ error: "summary is required" }, { status: 422 });
  if (!ISO_DATE.test(startDate)) return NextResponse.json({ error: "startDate must be YYYY-MM-DD" }, { status: 422 });
  if (endDate && !ISO_DATE.test(endDate)) return NextResponse.json({ error: "endDate must be YYYY-MM-DD" }, { status: 422 });

  try {
    const event = await createCalendarEvent(ctx.company, { summary, description, startDate, endDate });
    return NextResponse.json(event, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: `calendar event failed: ${(e as Error).message}` }, { status: 502 });
  }
}
