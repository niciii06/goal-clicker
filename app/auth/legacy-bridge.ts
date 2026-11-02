// TEMPORARY RECOVERY BRIDGE to the original Supabase project (iocdsjgmgkqdkojmciyx). Retire it as described in
// docs/neon-netlify-migration.md ("Brücke abschalten") once all six username accounts are recovered or the owner
// decides otherwise.
//
// Neon's Managed Better Auth cannot import Supabase password hashes, and the generated login addresses of the six
// username accounts cannot receive mail. So the old password is checked once, on the server, against the still
// running Supabase Auth (documented GoTrue endpoint POST /auth/v1/token?grant_type=password). The session it
// returns is revoked again at once; nothing is stored, the password is never logged.
//
// Server only variables: LEGACY_SUPABASE_URL and LEGACY_SUPABASE_PUBLISHABLE_KEY (the public key of that project).

export type LegacyCheck = { result: "valid"; userId: string } | { result: "invalid" } | { result: "unavailable" } | { result: "rate-limited" };

export function legacyBridgeConfigured() {
  return Boolean(legacyUrl() && process.env.LEGACY_SUPABASE_PUBLISHABLE_KEY);
}

function legacyUrl() {
  const value = (process.env.LEGACY_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : "";
  } catch {
    return "";
  }
}

/** Checks the old login address and password at Supabase Auth; the caller compares userId with the account. */
export async function verifyLegacyPassword(email: string, password: string): Promise<LegacyCheck> {
  const base = legacyUrl();
  const key = process.env.LEGACY_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!base || !key) return { result: "unavailable" };
  let response: Response;
  try {
    response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    return { result: "unavailable" };
  }
  if (response.status === 429) return { result: "rate-limited" };
  if (response.status >= 500) return { result: "unavailable" };
  const body = await response.json().catch(() => null) as { access_token?: string; user?: { id?: string } } | null;
  if (!response.ok || !body?.access_token || typeof body.user?.id !== "string") return { result: "invalid" };
  // The proof is all that is needed: end that Supabase session right away.
  await fetch(`${base}/auth/v1/logout?scope=local`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${body.access_token}` }, signal: AbortSignal.timeout(5000) }).catch(() => undefined);
  return { result: "valid", userId: body.user.id };
}
