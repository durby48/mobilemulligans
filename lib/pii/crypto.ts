// lib/pii/crypto.ts — application-level encryption for the most sensitive
// employee fields (SSN, bank account / routing numbers).
//
// WHY app-level (not just Postgres at-rest): the durable-plane routes talk to
// Supabase through the SERVICE-ROLE key, which bypasses RLS. Disk encryption and
// RLS alone would still leave plaintext readable to anyone holding that key (or
// to Supabase staff / a DB dump). Encrypting here means the database only ever
// stores ciphertext; the plaintext exists only transiently in the route handler
// after a deliberate, audited decrypt. Many state breach-notification laws also
// grant a safe harbor only when the exposed SSN / financial-account number was
// encrypted — so this is a compliance control, not just hygiene.
//
// Algorithm: AES-256-GCM (authenticated encryption). The key comes from the
// server-only env var EMPLOYEE_PII_KEY and is NEVER shipped to the browser.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce, recommended for GCM
const TAG_LEN = 16; // 128-bit auth tag

/**
 * Resolve the 32-byte key from EMPLOYEE_PII_KEY. Accepts a base64 (preferred) or
 * hex encoding. Throws loudly if missing/wrong length so a misconfigured deploy
 * fails closed instead of silently storing weakly-protected data.
 *
 * Generate one with:  openssl rand -base64 32
 */
function getKey(): Buffer {
  const raw = process.env.EMPLOYEE_PII_KEY;
  if (!raw) {
    throw new Error(
      "EMPLOYEE_PII_KEY is not set. Generate one with `openssl rand -base64 32` and add it to the server environment.",
    );
  }
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    key = Buffer.from(raw.trim(), "hex");
  } else {
    key = Buffer.from(raw.trim(), "base64");
  }
  if (key.length !== 32) {
    throw new Error(
      `EMPLOYEE_PII_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
    );
  }
  return key;
}

/** True when a usable key is configured (lets routes fail with a clear 500). */
export function piiKeyConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt a plaintext string. Returns a self-describing token:
 *   v1:<base64( iv || tag || ciphertext )>
 * Empty / null input returns null (we store NULL, not an encryption of "").
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${Buffer.concat([iv, tag, ct]).toString("base64")}`;
}

/**
 * Decrypt a token produced by encryptField. Returns null for null/empty input.
 * Throws if the token is malformed or authentication fails (tampering / wrong
 * key) — callers should surface that as a 500, never silently return garbage.
 */
export function decryptField(token: string | null | undefined): string | null {
  if (token == null || token === "") return null;
  if (!token.startsWith("v1:")) {
    throw new Error("ciphertext format not recognized");
  }
  const key = getKey();
  const buf = Buffer.from(token.slice(3), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/** Mask an SSN for display: keep only the last 4 → "•••-••-1234". */
export function maskSsn(ssn: string | null): string | null {
  if (!ssn) return null;
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "•••-••-••••";
  return `•••-••-${digits.slice(-4)}`;
}

/** Mask a bank account number: keep only the last 4 → "••••6789". */
export function maskAccount(acct: string | null): string | null {
  if (!acct) return null;
  const digits = acct.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `••••${digits.slice(-4)}`;
}
