// lib/gcal.ts — create Google Calendar events via the SAME Google service account
// used by lib/gmail.ts (domain-wide delegation, RS256 JWT minted with node:crypto,
// no googleapis SDK). SERVER-ONLY.
//
// Configuration (Vercel env, per site):
//   GOOGLE_SA_KEY   — the service-account key JSON (shared with Gmail). The SA's
//                     domain-wide delegation must ALSO authorize the calendar
//                     scope below in the Workspace Admin console.
//   DC_CALENDAR_ID / MM_CALENDAR_ID — (optional) a specific calendar id to write
//                     to; defaults to the impersonated subject's "primary".
//
// The calendar is owned by a mailbox in the Workspace; we impersonate that mailbox
// (the `sub` of the assertion JWT) and write to its calendar. The client never
// names the calendar — the route derives it from the logged-in employee's company.

import crypto from "node:crypto";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** Is the Calendar integration configured at all? (Routes 501 until set up.) */
export function isCalendarConfigured(): boolean {
  return !!process.env.GOOGLE_SA_KEY;
}

/**
 * Which calendar to write to, per company — SERVER-SIDE ONLY. The subject is the
 * mailbox we impersonate (must own/share the calendar); calendarId defaults to
 * that subject's primary calendar unless an explicit id is configured.
 */
export function resolveCalendar(company: string): { subject: string; calendarId: string } | null {
  if (company === "dc-solar") {
    const subject = process.env.DC_DRAFTS_MAILBOX || "devon@dcsolarkc.com";
    return { subject, calendarId: process.env.DC_CALENDAR_ID || subject };
  }
  if (company === "mobile-mulligans") {
    const subject = process.env.MM_DRAFTS_MAILBOX || "info@mobilemulligans.net";
    return { subject, calendarId: process.env.MM_CALENDAR_ID || subject };
  }
  return null;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  /** All-day start date "YYYY-MM-DD". */
  startDate: string;
  /** All-day end date "YYYY-MM-DD" (optional; defaults to start). */
  endDate?: string;
}

/** Create an all-day event. Returns the event id + htmlLink. */
export async function createCalendarEvent(
  company: string,
  input: CalendarEventInput,
): Promise<{ id: string; htmlLink: string }> {
  const cal = resolveCalendar(company);
  if (!cal) throw new Error(`no calendar configured for company "${company}"`);
  const token = await getAccessToken(cal.subject, CALENDAR_SCOPE);

  // Google all-day events use an EXCLUSIVE end date, so add a day to the last day.
  const start = input.startDate;
  const lastDay = input.endDate && input.endDate >= start ? input.endDate : start;
  const end = addDay(lastDay);

  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(cal.calendarId)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description ?? "",
      start: { date: start },
      end: { date: end },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`calendar events.insert failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string; htmlLink?: string };
  return { id: json.id ?? "", htmlLink: json.htmlLink ?? "" };
}

/** "YYYY-MM-DD" + 1 day (UTC-safe string math). */
function addDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SA_KEY;
  if (!raw) throw new Error("GOOGLE_SA_KEY is not set");
  let text = raw.trim();
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      /* fall through */
    }
  }
  const sa = JSON.parse(text) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_SA_KEY is missing client_email / private_key");
  }
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(subject: string, scope: string): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: subject,
      scope,
      aud: sa.token_uri || TOKEN_URI,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), sa.private_key);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(sa.token_uri || TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`token exchange failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("token exchange returned no access_token");
  return json.access_token;
}
