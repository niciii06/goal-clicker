// Username logins at Neon Auth, created and used by the server: the player only ever sees the username, the
// generated login address (p-<random>@players.goal-clicker.vercel.app) never leaves the server.
import { AuthUnavailableError, neonAuthFetch, sessionCookieFromSetCookies, verifySessionCookie } from "./server";

export type NeonLogin = { ok: true; subject: string; setCookies: string[]; sessionCookie: string } | { ok: false; reason: "exists" | "invalid" | "rate-limited" | "rejected"; code?: string };

type AuthBody = { user?: { id?: string } | null; token?: string | null };

function loginResult(result: { status: number; data: AuthBody | null; setCookies: string[]; code?: string }): NeonLogin {
  const subject = result.data?.user?.id;
  const sessionCookie = sessionCookieFromSetCookies(result.setCookies);
  if (result.status === 200 && typeof subject === "string" && sessionCookie) return { ok: true, subject, setCookies: result.setCookies, sessionCookie };
  if (result.status === 429) return { ok: false, reason: "rate-limited", code: result.code };
  if (result.status === 422 || /ALREADY_EXISTS/.test(result.code ?? "")) return { ok: false, reason: "exists", code: result.code };
  if (result.status === 401 || result.status === 403) return { ok: false, reason: "invalid", code: result.code };
  return { ok: false, reason: "rejected", code: result.code };
}

export async function signUpEmail(email: string, password: string, name: string, origin: string): Promise<NeonLogin> {
  return loginResult(await neonAuthFetch<AuthBody>("sign-up/email", { origin, body: { email, password, name, rememberMe: true } }));
}

export async function signInEmail(email: string, password: string, origin: string): Promise<NeonLogin> {
  return loginResult(await neonAuthFetch<AuthBody>("sign-in/email", { origin, body: { email, password, rememberMe: true } }));
}

export async function signOutSession(sessionCookie: string, origin: string) {
  const result = await neonAuthFetch("sign-out", { origin, cookie: sessionCookie, body: {} }).catch(() => null);
  return result?.setCookies ?? [];
}

/** Ends every session of the login (revoke-sessions), then this one; best effort, failures are not fatal. */
export async function endAllSessions(sessionCookie: string, origin: string) {
  await neonAuthFetch("revoke-sessions", { origin, cookie: sessionCookie, body: {} }).catch(() => null);
  await neonAuthFetch("sign-out", { origin, cookie: sessionCookie, body: {} }).catch(() => null);
}

export type DeleteOutcome = "deleted" | "needs-reauth" | "not-deleted";

/**
 * Deletes the Neon Auth user of a session (Better Auth /delete-user) and then checks that it is really gone:
 * the session must no longer verify. Neon's Managed Better Auth answers 404 (no self service deletion, checked
 * on staging), which counts as not deleted; the caller then files a deletion request instead. A delete that
 * only sent a confirmation mail, is switched off on the branch or needs a fresh sign in does not count either.
 */
export async function deleteNeonUser(sessionCookie: string, origin: string, password?: string): Promise<DeleteOutcome> {
  const result = await neonAuthFetch<{ success?: boolean; message?: string }>("delete-user", { origin, cookie: sessionCookie, body: password ? { password } : {} });
  if (result.status !== 200) return result.code === "SESSION_EXPIRED" || result.status === 401 || result.code === "INVALID_PASSWORD" ? "needs-reauth" : "not-deleted";
  try {
    return await verifySessionCookie(sessionCookie, origin) ? "not-deleted" : "deleted";
  } catch (error) {
    if (error instanceof AuthUnavailableError) return "not-deleted";
    throw error;
  }
}
