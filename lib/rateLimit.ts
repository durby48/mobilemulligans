/**
 * Tiny in-memory sliding-window rate limiter for the public form endpoints.
 *
 * State lives in a module-level Map, so on Vercel each serverless instance
 * keeps its own counters and they reset whenever the instance is recycled.
 * That makes this best-effort abuse damping — NOT a hard guarantee (traffic
 * spread across instances can exceed the limit). That trade-off is
 * intentional: no external store, no new dependencies, and it still stops
 * the common case of a single client hammering a form.
 */

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_KEYS = 5000; // hard cap so the Map can't grow unbounded

// key → timestamps (ms) of requests inside the current window.
const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  opts?: { limit?: number; windowMs?: number }
): { allowed: boolean; retryAfterSec: number } {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();

  // Prune timestamps that have slid out of the window.
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    // Full again once the oldest hit in the window expires.
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    hits.set(key, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  // Delete + set moves the key to the end of the Map's insertion order, so
  // the eviction below drops the least-recently-used keys first.
  hits.delete(key);
  hits.set(key, recent);

  while (hits.size > MAX_KEYS) {
    const oldest = hits.keys().next().value;
    if (oldest === undefined) break;
    hits.delete(oldest);
  }

  return { allowed: true, retryAfterSec: 0 };
}
