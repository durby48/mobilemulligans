// lib/ops-jwt.ts — mint the short-lived HS256 ops token this site hands to the
// embedded operations client. It must be byte-compatible with the PC's verifier
// (Global Operations/src/platform/server/jwt.ts → signJwtHS256): same header,
// base64url segments, and HMAC-SHA256 signature. Node runtime only (uses
// node:crypto); never import into a client component.
//
// Claims mirror @durbin/contracts OpsSessionClaims. The PC checks the signature,
// issuer, and expiry, then enforces scope/role — it trusts these claims but never
// calls back to this site.

import crypto from "node:crypto";

export type OperatorRole = "owner" | "operator" | "viewer";

export interface OpsClaims {
  readonly sub: string;
  readonly email: string;
  readonly displayName?: string;
  readonly companyId: string;
  /** "all" for the owner, else the single company id. */
  readonly scope: string;
  readonly role: OperatorRole;
  readonly iss: string;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
}

const encodeSegment = (obj: unknown): string =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const hmac = (data: string, secret: string): string =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

/** Sign a JWT with HS256 — identical primitive to the platform verifier. */
export function signJwtHS256(payload: Record<string, unknown>, secret: string): string {
  const header = encodeSegment({ alg: "HS256", typ: "JWT" });
  const body = encodeSegment(payload);
  const data = `${header}.${body}`;
  return `${data}.${hmac(data, secret)}`;
}

export interface MintInput {
  readonly userId: string;
  readonly email: string;
  readonly displayName?: string | null;
  readonly company: string;
  readonly role: OperatorRole;
  readonly issuer: string;
  readonly secret: string;
  /** Token lifetime in seconds. Default 300 (5 min) — short-lived by design. */
  readonly ttlSeconds?: number;
  /** Injectable clock (epoch seconds) for tests. */
  readonly now?: () => number;
}

/** Build + sign an ops token for an authenticated employee. */
export function mintOpsToken(input: MintInput): { token: string; claims: OpsClaims } {
  const now = (input.now ?? (() => Math.floor(Date.now() / 1000)))();
  const ttl = input.ttlSeconds ?? 300;
  const claims: OpsClaims = {
    sub: input.userId,
    email: input.email,
    ...(input.displayName ? { displayName: input.displayName } : {}),
    companyId: input.company,
    scope: input.role === "owner" ? "all" : input.company,
    role: input.role,
    iss: input.issuer,
    iat: now,
    exp: now + ttl,
    jti: crypto.randomUUID(),
  };
  return {
    token: signJwtHS256(claims as unknown as Record<string, unknown>, input.secret),
    claims,
  };
}
