// Server side Neon Auth: verifies the session cookie of a request against Neon Auth and talks to the documented
// Better Auth endpoints (sign-up/email, sign-in/email, list-accounts, delete-user, ...) on behalf of the player.
// The route handlers take a Request, so the tests can swap all of this.
import { createHash } from "node:crypto";
import { authIssuer, neonAuthBaseUrl } from "./config";

/** The cookie Neon Auth keeps the session in (the SDK's NEON_AUTH_SESSION_COOKIE_NAME). */
export const SESSION_COOKIE = "__Secure-neon-auth.session_token";
/** All Neon Auth cookies start with this; others are never sent upstream. */
export const NEON_COOKIE_PREFIX = "__Secure-neon-auth";

/** A verified login. subject is the Neon Auth user ID; it is never the game account ID. */
export type AuthSession = {
  issuer: string;
  subject: string;
  email: string | null;
  name: string;
  /** "name=value" of the session cookie, to call Neon Auth as this user. */
  sessionCookie: string;
  /** Set-Cookie values Neon Auth sent while verifying (a renewed session); relayed by POST /api/account. */
  refreshCookies?: string[];
};

/** Neon Auth did not answer (network, 5xx): not proof that the user is signed out, the request must be retried. */
export class AuthUnavailableError extends Error {
  constructor(message = "Der Login Dienst ist gerade nicht erreichbar.") {
    super(message);
  }
}

export function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (name && !cookies.has(name)) cookies.set(name, part.slice(index + 1).trim());
  }
  return cookies;
}

/** Only the Neon Auth cookies of a request, as one Cookie header. */
export function neonCookieHeader(request: Request) {
  return [...parseCookies(request.headers.get("cookie"))].filter(([name]) => name.startsWith(NEON_COOKIE_PREFIX)).map(([name, value]) => `${name}=${value}`).join("; ");
}

// Verified sessions per server instance, keyed by a hash of the session token. Frequent polls then do not ask
// Neon Auth every 1.5 seconds. The cache is short (default 30 s, at most 60 s) and every operation that creates
// or deletes data, binds a login or changes ownership passes fresh: true and asks Neon Auth again, so a revoked
// session, a deleted user or a banned user is refused there at once and everywhere else within the cache time.
const sessionCache = new Map<string, { session: AuthSession; until: number }>();
const MAX_CACHED_SESSIONS = 5000;

function sessionCacheMs() {
  const seconds = Number(process.env.AUTH_SESSION_CACHE_SECONDS ?? 30);
  return Math.max(0, Math.min(60, Number.isFinite(seconds) ? seconds : 30)) * 1000;
}

function tokenKey(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function forgetSession(request: Request) {
  const token = parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE);
  if (token) sessionCache.delete(tokenKey(token));
}

export function clearSessionCacheForTests() {
  sessionCache.clear();
}

/** The address the browser used. Behind the platform proxy request.url can name the internal host. */
export function publicOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (!host || !/^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) return url.origin;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * Cross site request protection for every state changing account call: a browser always sends Origin on a
 * cross origin POST, so a foreign Origin is refused. Requests without Origin (same origin navigation, server
 * to server) pass; they cannot carry the victim's cookies from another site in a modern browser (SameSite=Lax).
 */
export function sameOrigin(request: Request) {
  const from = request.headers.get("origin");
  if (!from) return request.headers.get("sec-fetch-site") !== "cross-site";
  return from === publicOrigin(request);
}

type UpstreamResult<T> = { status: number; data: T | null; setCookies: string[]; code?: string };

/**
 * Calls a Neon Auth (Better Auth) endpoint the way the SDK's server API does: Origin of the app, only the Neon
 * Auth cookies and the proxy header. Network failures and 5xx answers throw AuthUnavailableError.
 */
export async function neonAuthFetch<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; cookie?: string; origin: string; query?: Record<string, string> }): Promise<UpstreamResult<T>> {
  const base = neonAuthBaseUrl();
  if (!base) throw new AuthUnavailableError("Der Login ist nicht eingerichtet.");
  const url = new URL(`${base}/${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = { origin: options.origin, "x-neon-auth-middleware": "true", "user-agent": "goal-clicker-server" };
  if (options.cookie) headers.cookie = options.cookie;
  if (method === "POST") headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(url, { method, headers, body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined, signal: AbortSignal.timeout(8000), cache: "no-store" });
  } catch {
    throw new AuthUnavailableError();
  }
  if (response.status >= 500) throw new AuthUnavailableError();
  const data = await response.json().catch(() => null) as (T & { code?: string }) | null;
  return { status: response.status, data: response.ok ? data : null, setCookies: response.headers.getSetCookie(), code: response.ok ? undefined : (data as { code?: string } | null)?.code };
}

/**
 * Rewrites Neon Auth's Set-Cookie values for the browser exactly like the SDK's proxy: Secure, SameSite=Lax,
 * no Partitioned and no foreign Domain, so the cookie belongs to this site.
 */
export function browserSetCookies(setCookies: readonly string[]) {
  return setCookies.map((cookie) => {
    const [pair, ...attributes] = cookie.split(";").map((part) => part.trim()).filter(Boolean);
    const kept = attributes.filter((attribute) => !/^(domain|samesite|secure|partitioned)(=|$)/i.test(attribute));
    return [pair, ...kept, "Secure", "SameSite=Lax"].join("; ");
  }).filter((cookie) => cookie.startsWith(NEON_COOKIE_PREFIX));
}

/** A cookie header with only the session token from Set-Cookie values (to act as a user just signed in). */
export function sessionCookieFromSetCookies(setCookies: readonly string[]) {
  for (const cookie of setCookies) {
    const pair = cookie.split(";")[0].trim();
    if (pair.startsWith(`${SESSION_COOKIE}=`)) return pair;
  }
  return "";
}

type UpstreamSession = { session?: { id?: string; userId?: string; expiresAt?: string } | null; user?: { id?: string; email?: string | null; name?: string | null; banned?: boolean | null } | null } | null;

/** Checks a session cookie with Neon Auth itself (/get-session), never with a cached copy of the session. */
export async function verifySessionCookie(sessionCookie: string, origin: string): Promise<AuthSession | null> {
  const result = await neonAuthFetch<UpstreamSession>("get-session", { cookie: sessionCookie, origin, query: { disableCookieCache: "true" } });
  const session = result.data?.session;
  const user = result.data?.user;
  if (result.status !== 200 || !session || !user?.id || session.userId !== user.id || user.banned === true) return null;
  const expiresAt = Date.parse(session.expiresAt ?? "");
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { issuer: authIssuer(), subject: user.id, email: typeof user.email === "string" ? user.email : null, name: typeof user.name === "string" ? user.name : "", sessionCookie, refreshCookies: result.setCookies.length ? result.setCookies : undefined };
}

/**
 * The signed in login of a request, verified by Neon Auth. `fresh` skips the short per instance cache; use it
 * for every operation that creates, binds or deletes something.
 */
export async function getAuthSession(request: Request, { fresh = false } = {}): Promise<AuthSession | null> {
  const token = parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE);
  if (!token) return null;
  const key = tokenKey(token);
  const now = Date.now();
  const cached = sessionCache.get(key);
  if (!fresh && cached && cached.until > now) return cached.session;
  const session = await verifySessionCookie(`${SESSION_COOKIE}=${token}`, publicOrigin(request));
  if (!session) {
    sessionCache.delete(key);
    return null;
  }
  const ttl = sessionCacheMs();
  if (ttl > 0) {
    if (sessionCache.size >= MAX_CACHED_SESSIONS) for (const [cachedKey, entry] of sessionCache) if (entry.until <= now || sessionCache.size >= MAX_CACHED_SESSIONS) sessionCache.delete(cachedKey);
    sessionCache.set(key, { session: { ...session, refreshCookies: undefined }, until: now + ttl });
  }
  return session;
}

/** The logins (providers) of the signed in Neon Auth user: [{ providerId: "google", accountId: <Google sub> }, ...]. */
export async function listLinkedAccounts(session: AuthSession, origin: string) {
  const result = await neonAuthFetch<{ providerId?: string; accountId?: string }[]>("list-accounts", { cookie: session.sessionCookie, origin });
  if (result.status !== 200 || !Array.isArray(result.data)) throw new AuthUnavailableError("Die Logins des Kontos konnten nicht gelesen werden.");
  return result.data.filter((account): account is { providerId: string; accountId: string } => typeof account?.providerId === "string" && typeof account.accountId === "string");
}

export function redirectWithCookies(location: string, setCookies: readonly string[]) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
