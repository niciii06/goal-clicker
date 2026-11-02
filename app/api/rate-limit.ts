// A per address limit for the public endpoints that write or cost something. rateLimited counts in the memory
// of each server instance: cheap enough for the frequent multiplayer requests, but NOT global, because every
// serverless instance has its own memory. sharedRateLimited (below) counts in PostgreSQL for all instances and
// guards the endpoints that guess passwords or create logins.
import { getDb } from "../../db";
type Bucket = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  register: { limit: 5, windowMs: 10 * 60_000 },
  login: { limit: 20, windowMs: 60_000 },
  recovery: { limit: 10, windowMs: 10 * 60_000 },
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

/** Whether this server runs on Netlify, whose edge sets x-nf-client-connection-ip itself. */
function onNetlify() {
  return Boolean(process.env.NETLIFY || process.env.SITE_ID || process.env.NETLIFY_FUNCTIONS_TOKEN);
}

/**
 * The client address. On Netlify only x-nf-client-connection-ip counts: Netlify's edge sets it and replaces any
 * value a client sends, while a client can put anything at the start of x-forwarded-for. Elsewhere (Vercel,
 * local) the first x-forwarded-for entry or x-real-ip, as the platform proxy sets them. Requests without an
 * address, or from this machine (local runs, tests), are not limited.
 */
export function clientAddress(request: Request) {
  const netlify = request.headers.get("x-nf-client-connection-ip")?.trim();
  const address = onNetlify()
    ? netlify || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || ""
    : request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  return LOOPBACK.test(address) ? "" : address.slice(0, 64);
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

type SharedStore = { hitRateLimit: (key: string, windowStart: number) => Promise<number>; pruneRateLimits: (before: number) => Promise<void> };

/**
 * A limit counted in PostgreSQL, so it holds across all serverless instances (fixed windows). `subject` adds a
 * second key, for example the username of a login attempt, so one account cannot be guessed at from many
 * addresses either. The route wrapper (withRateLimit) adds the per instance limit, which also covers a database that cannot count.
 */
export async function sharedRateLimited(request: Request, name: RateLimitName, subject = "", store: () => SharedStore = getDb, now = Date.now()): Promise<Response | null> {
  const address = clientAddress(request);
  const { limit, windowMs } = RATE_LIMITS[name];
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const keys = [address ? `${name}:ip:${address}` : "", subject ? `${name}:subject:${subject.toLowerCase()}` : ""].filter(Boolean);
  try {
    for (const key of keys) {
      const count = await store().hitRateLimit(key, windowStart);
      // Per subject a little more room, since players behind one address share it.
      if (count > (key.includes(":subject:") ? limit * 2 : limit)) {
        const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
        return Response.json({ error: "Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann nochmal.", errorCode: "RATE_LIMITED" }, { status: 429, headers: { "retry-after": String(retryAfter), "cache-control": "no-store" } });
      }
    }
    if (Math.random() < 0.01) await store().pruneRateLimits(now - 24 * 60 * 60_000);
  } catch {
    // The per instance limit of the route wrapper still applies.
  }
  return null;
}
