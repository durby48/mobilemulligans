/**
 * Boot-time environment validation.
 *
 * assertServerEnv() throws a single Error listing ALL missing critical server
 * env vars — a misconfigured deploy fails loudly on the first request instead
 * of surfacing as scattered 500s. Wired into app/api/ops-token/route.ts (the
 * first route every employee hits); no need to call it everywhere.
 *
 * warnOptionalEnv() only console.warns: each optional var degrades one
 * feature but nothing breaks without it.
 */

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPS_TOKEN_SECRET",
  "OPS_ISSUER",
] as const;

const OPTIONAL: ReadonlyArray<{ name: string; degrades: string }> = [
  { name: "RESEND_API_KEY", degrades: "notification emails will not send" },
  { name: "GOOGLE_SA_KEY", degrades: "Gmail + Google Calendar integrations are disabled" },
  { name: "EMPLOYEE_PII_KEY", degrades: "the encrypted employee records vault is unavailable" },
  { name: "REVIEW_URL", degrades: "customer emails fall back to the siteConfig review link" },
];

export function assertServerEnv(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variable(s): ${missing.join(", ")}. ` +
        "Set them in .env.local (dev) or the Vercel project settings (prod)."
    );
  }
}

export function warnOptionalEnv(): void {
  for (const { name, degrades } of OPTIONAL) {
    if (!process.env[name]) {
      console.warn(`Optional env var ${name} is not set — ${degrades}.`);
    }
  }
}
