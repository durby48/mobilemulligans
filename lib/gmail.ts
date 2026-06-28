// lib/gmail.ts — read-only Gmail access via a Google service account with
// domain-wide delegation. SERVER-ONLY (uses the SA private key + node:crypto).
//
// No `googleapis` SDK: we mint the OAuth2 service-account assertion JWT ourselves
// (RS256 via node:crypto), exchange it for an access token that impersonates the
// target mailbox, then call the Gmail REST API with fetch. Keeps the Vercel
// bundle lean and the dependency surface at zero.
//
// Configuration (Vercel env, per site — see config/EMAIL_SETUP.md):
//   GOOGLE_SA_KEY            — the service-account key JSON (the whole file).
//                              Accepts raw JSON or base64-encoded JSON.
//   GOOGLE_DELEGATED_SUBJECT — (optional) fallback mailbox to impersonate. The
//                              routes always pass a server-derived mailbox, so
//                              this only matters if that derivation has no answer.
//
// With domain-wide delegation granted in the Workspace Admin console (the SA's
// client id + the gmail.readonly scope), one SA can impersonate ANY mailbox in
// its Workspace. The mailbox to impersonate is the `sub` of the assertion JWT.
//
// IMPORTANT: the client never names a mailbox. The API routes derive it from the
// logged-in employee (see resolveMailbox) — the same server-derived-tenant rule
// the finance routes use.

import crypto from "node:crypto";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
// Drafting needs compose; the SA's domain-wide delegation must authorize this
// scope too (see config/EMAIL_SETUP.md). Reads still use readonly above.
const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

/** How many inbox messages to surface in the list view. */
const INBOX_PAGE_SIZE = 25;

export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string | null;
  unread: boolean;
}

export interface FullMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  body: string;
  bodyIsHtml: boolean;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** Is the Gmail integration configured at all? Used to 501 the routes until set up. */
export function isGmailConfigured(): boolean {
  return !!process.env.GOOGLE_SA_KEY;
}

/**
 * Derive the mailbox an employee may read, SERVER-SIDE ONLY. Never trust a
 * client-supplied mailbox. Keyed on the employee's `company` so this code is
 * identical across both site repos.
 *   • mobile-mulligans → shared inbox info@mobilemulligans.net (all MM staff).
 *   • dc-solar → each employee sees THEIR OWN mailbox (devon@/isaiah@); we use an
 *     explicit `employees.mailbox` override if present, else the login email when
 *     it is a @dcsolarkc.com address, else a configured default.
 */
export function resolveMailbox(emp: {
  email: string;
  company: string;
  mailbox?: string | null;
}): string | null {
  if (emp.mailbox && emp.mailbox.trim()) return emp.mailbox.trim();
  if (emp.company === "mobile-mulligans") {
    return process.env.MM_SHARED_MAILBOX || "info@mobilemulligans.net";
  }
  if (emp.company === "dc-solar") {
    if (emp.email && emp.email.toLowerCase().endsWith("@dcsolarkc.com")) return emp.email;
    return process.env.DC_DEFAULT_MAILBOX || "devon@dcsolarkc.com";
  }
  // Unknown company: fall back to the login email (lets a future tenant work
  // without a code change if their mailbox == their login).
  return emp.email || process.env.GOOGLE_DELEGATED_SUBJECT || null;
}

/** The mailbox whose Drafts folder receives agent-drafted customer emails. */
export function draftsMailbox(company: string): string | null {
  if (company === "dc-solar") return process.env.DC_DRAFTS_MAILBOX || "devon@dcsolarkc.com";
  if (company === "mobile-mulligans") return process.env.MM_DRAFTS_MAILBOX || "info@mobilemulligans.net";
  return null;
}

/** RFC822-ish header-safe single line (no CR/LF injection). */
function headerSafe(s: string): string {
  return String(s ?? "").replace(/[\r\n]+/g, " ").trim();
}

/**
 * Create a Gmail DRAFT (not sent) in `mailbox`'s Drafts folder. Requires the SA
 * to be delegated the gmail.compose scope for that mailbox's Workspace.
 */
export async function createDraft(
  mailbox: string,
  msg: { to?: string | null; subject: string; body: string; html?: boolean },
): Promise<{ id: string }> {
  const token = await getAccessToken(mailbox, GMAIL_COMPOSE_SCOPE);
  const contentType = msg.html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
  const lines = [
    msg.to ? `To: ${headerSafe(msg.to)}` : "",
    `Subject: ${headerSafe(msg.subject)}`,
    `Content-Type: ${contentType}`,
    "MIME-Version: 1.0",
    "",
    String(msg.body ?? ""),
  ].filter((l, i) => l !== "" || i >= 4); // keep the blank separator + body
  const raw = base64url(Buffer.from(lines.join("\r\n"), "utf8"));
  const url = `${GMAIL_API}/users/${encodeURIComponent(mailbox)}/drafts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gmail drafts.create failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  return { id: json.id ?? "" };
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SA_KEY;
  if (!raw) throw new Error("GOOGLE_SA_KEY is not set");
  let text = raw.trim();
  // Accept base64-encoded JSON (handy for single-line Vercel env values).
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(text, "base64").toString("utf8");
    } catch {
      /* fall through; JSON.parse will throw a clearer error */
    }
  }
  const sa = JSON.parse(text) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_SA_KEY is missing client_email / private_key");
  }
  // Vercel env often stores the key with literal "\n" — normalize to real newlines.
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Mint a service-account assertion JWT impersonating `subject`, exchange it for
 * a short-lived OAuth2 access token with the gmail.readonly scope.
 */
async function getAccessToken(subject: string, scope: string = GMAIL_SCOPE): Promise<string> {
  const sa = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: subject, // the mailbox to impersonate (domain-wide delegation)
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
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`token exchange failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("token exchange returned no access_token");
  return json.access_token;
}

async function gmailGet<T>(token: string, mailbox: string, path: string): Promise<T> {
  const url = `${GMAIL_API}/users/${encodeURIComponent(mailbox)}/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gmail ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function dateFromMessage(m: GmailMessage): string | null {
  if (m.internalDate) {
    const ms = Number(m.internalDate);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  const hdr = headerValue(m.payload?.headers, "Date");
  if (hdr) {
    const d = new Date(hdr);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** List the most recent INBOX messages (metadata only) for a mailbox. */
export async function listInbox(mailbox: string): Promise<InboxMessage[]> {
  const token = await getAccessToken(mailbox);
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    token,
    mailbox,
    `messages?labelIds=INBOX&maxResults=${INBOX_PAGE_SIZE}`,
  );
  const ids = (list.messages ?? []).map((m) => m.id);

  const metas = await Promise.all(
    ids.map((id) =>
      gmailGet<GmailMessage>(
        token,
        mailbox,
        `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      ).catch(() => null),
    ),
  );

  return metas
    .filter((m): m is GmailMessage => !!m)
    .map((m) => ({
      id: m.id,
      from: headerValue(m.payload?.headers, "From"),
      subject: headerValue(m.payload?.headers, "Subject"),
      snippet: decodeEntities(m.snippet ?? ""),
      date: dateFromMessage(m),
      unread: (m.labelIds ?? []).includes("UNREAD"),
    }));
}

/** Fetch one full message and extract a readable body (plain text, sanitized). */
export async function getMessage(mailbox: string, id: string): Promise<FullMessage> {
  const token = await getAccessToken(mailbox);
  const m = await gmailGet<GmailMessage>(
    token,
    mailbox,
    `messages/${encodeURIComponent(id)}?format=full`,
  );
  const { text } = extractBody(m.payload);
  return {
    id: m.id,
    from: headerValue(m.payload?.headers, "From"),
    to: headerValue(m.payload?.headers, "To"),
    subject: headerValue(m.payload?.headers, "Subject"),
    date: dateFromMessage(m),
    // V1 is plain-text only: we render HTML mail as stripped text to keep the
    // client free of any untrusted-HTML injection. (The panel supports an HTML
    // path for a future, properly-sanitized version.)
    body: text,
    bodyIsHtml: false,
  };
}

function decodeBody(data?: string): string {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Walk the MIME tree and return a readable plain-text body. Prefers text/plain;
 * falls back to text/html converted to text. Skips attachments.
 */
function extractBody(part: GmailPart | undefined): { text: string } {
  if (!part) return { text: "" };

  const plain = findPart(part, "text/plain");
  if (plain?.body?.data) return { text: decodeBody(plain.body.data).trim() };

  const html = findPart(part, "text/html");
  if (html?.body?.data) return { text: htmlToText(decodeBody(html.body.data)) };

  // Single-part message with the body at the top level.
  if (part.body?.data) {
    const raw = decodeBody(part.body.data);
    return { text: (part.mimeType === "text/html" ? htmlToText(raw) : raw).trim() };
  }
  return { text: "" };
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data && !part.filename) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}

/** Conservative HTML→text: drop scripts/styles, turn block tags into newlines. */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}
