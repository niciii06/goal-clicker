// A per address limit for the public endpoints that write or cost something. It counts in the memory of each
// server instance, which Vercel reuses for many requests: enough to stop a single client from flooding
// registrations, receipts or saves, without a database round trip on every request.
type Bucket = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  register: { limit: 5, windowMs: 10 * 60_000 },
  login: { limit: 20, windowMs: 60_000 },
  username: { limit: 60, windowMs: 60_000 },
  profile: { limit: 30, windowMs: 60_000 },
  account: { limit: 30, windowMs: 60_000 },
  save: { limit: 60, windowMs: 60_000 },
  rewards: { limit: 30, windowMs: 60_000 },
  travel: { limit: 60, windowMs: 60_000 },
  // Up to four players behind one address click, poll and tick several times a second.
  multiplayer: { limit: 3000, windowMs: 60_000 },
} satisfies Record<string, Bucket>;
export type RateLimitName = keyof typeof RATE_LIMITS;

const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

const LOOPBACK = /^(127\.|::1$|::ffff:127\.)/;

/** The client address Vercel reports. Requests without one, or from this machine (local runs, tests), are not limited. */
function clientAddress(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return LOOPBACK.test(address) ? "" : address;
}

/** A 429 answer when this address used up the bucket, else null; the request then counts. */
export function rateLimited(request: Request, name: RateLimitName, now = Date.now()): Response | null {
  const address = clientAddress(request);
  if (!address) return null;
  const { limit, windowMs } = RATE_LIMITS[name];
  const key = `${name}:${address}`;
  const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
    return Response.json({ error: "Zu viele Anfragen. Bitte warte einen Moment.", errorCode: "RATE_LIMITED" }, { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } });
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_TRACKED_KEYS) {
    for (const [tracked, times] of hits) if (!times.length || now - times[times.length - 1] >= 10 * 60_000) hits.delete(tracked);
  }
  return null;
}

/** Wraps a route handler with a limit. */
export function withRateLimit(name: RateLimitName, handler: (request: Request) => Promise<Response> | Response) {
  return (request: Request) => rateLimited(request, name) ?? handler(request);
}

export function clearRateLimitsForTests() {
  hits.clear();
}
