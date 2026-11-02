// Which game account a verified login opens. The game account ID (profiles.user_id, cloud_saves.user_id,
// player_accounts.user_id) is NOT the Neon Auth user ID: auth_identities maps (issuer, subject) to it.
//
// A login without a mapping is bound exactly once, and only here:
// * Google: the Google subject that Neon Auth verified (list-accounts, accountId of provider "google") is looked up
//   in legacy_identities, imported from the original Supabase project. A match opens that original account. No
//   e-mail address, username, display name or player ID is ever used as proof.
// * A Google login without an old account gets a new, empty account with a fresh random ID.
// * Username logins are created and bound by the registration and recovery endpoints themselves. A Neon login
//   with a password that is not bound is refused here; it was not created by this server (or a registration
//   failed half way) and must not silently become an account. This also defeats pre registering someone's
//   Google address with a password before they sign in with Google.
import { randomUUID } from "node:crypto";
import { getDb } from "../../db";
import type { AuthIdentity, BindResult, LegacyIdentity } from "../../db";
import { listLinkedAccounts, neonAuthFetch } from "./server";
import type { AuthSession } from "./server";

export type AccountResolution =
  | { ok: true; accountId: string; method: string; created: boolean }
  | { ok: false; status: number; errorCode: string; error: string };

export type IdentityStore = {
  getIdentity: (issuer: string, subject: string) => Promise<AuthIdentity | null>;
  bindIdentity: (values: { issuer: string; subject: string; accountId: string; method: string; loginEmail?: string | null; createdAt: string }) => Promise<BindResult>;
  findLegacyIdentity: (provider: string, providerSubject: string) => Promise<LegacyIdentity | null>;
  accountExists: (accountId: string) => Promise<boolean>;
};

export type IdentityDeps = {
  store: () => IdentityStore;
  listAccounts: (session: AuthSession, origin: string) => Promise<{ providerId: string; accountId: string }[]>;
  unlinkAccount: (session: AuthSession, origin: string, providerId: string, accountId: string) => Promise<boolean>;
  now: () => Date;
  newAccountId: () => string;
};

async function unlinkUpstream(session: AuthSession, origin: string, providerId: string, accountId: string) {
  const result = await neonAuthFetch("unlink-account", { cookie: session.sessionCookie, origin, body: { providerId, accountId } });
  return result.status === 200;
}

export const identityDefaults: IdentityDeps = { store: getDb, listAccounts: listLinkedAccounts, unlinkAccount: unlinkUpstream, now: () => new Date(), newAccountId: randomUUID };

const fail = (status: number, errorCode: string, error: string): AccountResolution => ({ ok: false, status, errorCode, error });
export const ACCOUNT_SETUP_REQUIRED = fail(409, "ACCOUNT_SETUP_REQUIRED", "Dein Konto wird noch eingerichtet. Bitte lade die Seite neu.");
export const DELETION_PENDING = fail(410, "ACCOUNT_DELETION_PENDING", "Dein Konto wird gerade gelöscht. Bitte lösche es im Kontofenster erneut, damit auch der Login entfernt wird.");

// Bound logins per server instance; a binding never changes, only a deletion removes it (see forgetIdentity).
const identityCache = new Map<string, { accountId: string; method: string; until: number }>();
const IDENTITY_CACHE_MS = 60_000;
const cacheKey = (session: AuthSession) => `${session.issuer}\n${session.subject}`;

export function forgetIdentity(session: AuthSession) {
  identityCache.delete(cacheKey(session));
}

export function clearIdentityCacheForTests() {
  identityCache.clear();
}

/** The account of a login that is already bound; never binds anything. For the frequent API calls. */
export async function lookupAccount(session: AuthSession, deps: Pick<IdentityDeps, "store"> = identityDefaults): Promise<AccountResolution> {
  const key = cacheKey(session);
  const cached = identityCache.get(key);
  if (cached && cached.until > Date.now()) return { ok: true, accountId: cached.accountId, method: cached.method, created: false };
  const identity = await deps.store().getIdentity(session.issuer, session.subject);
  if (!identity) return ACCOUNT_SETUP_REQUIRED;
  if (identity.deletedAt) return DELETION_PENDING;
  identityCache.set(key, { accountId: identity.accountId, method: identity.method, until: Date.now() + IDENTITY_CACHE_MS });
  return { ok: true, accountId: identity.accountId, method: identity.method, created: false };
}

/**
 * The account of a login, binding it on its first use as described at the top. Call only with a session that
 * was just verified with Neon Auth (fresh), never with a cached one.
 */
export async function resolveAccount(session: AuthSession, origin: string, deps: IdentityDeps = identityDefaults): Promise<AccountResolution> {
  if (!session.issuer || !session.subject) return fail(503, "AUTH_NOT_CONFIGURED", "Der Login ist auf diesem Server nicht eingerichtet.");
  const store = deps.store();
  const existing = await store.getIdentity(session.issuer, session.subject);
  if (existing?.deletedAt) return DELETION_PENDING;
  if (existing) {
    identityCache.set(cacheKey(session), { accountId: existing.accountId, method: existing.method, until: Date.now() + IDENTITY_CACHE_MS });
    return { ok: true, accountId: existing.accountId, method: existing.method, created: false };
  }
  // Any failure from here on throws: an unreadable login list must never turn into a new empty account.
  const linked = await deps.listAccounts(session, origin);
  const google = linked.filter((account) => account.providerId === "google");
  const others = linked.filter((account) => account.providerId !== "google");
  if (others.length > 0 || google.length !== 1) return fail(409, "IDENTITY_UNBOUND", "Dieser Login gehört zu keinem Spielerkonto. Melde dich mit deinem Benutzernamen oder mit Google an.");
  const legacy = await store.findLegacyIdentity("google", google[0].accountId);
  const now = deps.now().toISOString();
  if (legacy) {
    // The original account must still exist; a recovery never creates one.
    if (!(await store.accountExists(legacy.accountId))) return fail(409, "LEGACY_ACCOUNT_MISSING", "Das alte Spielerkonto zu diesem Google Konto wurde nicht gefunden. Bitte melde dich beim Besitzer des Spiels.");
    const bound = await store.bindIdentity({ issuer: session.issuer, subject: session.subject, accountId: legacy.accountId, method: "legacy-google", createdAt: now });
    if (!bound.ok) return fail(409, "ACCOUNT_ALREADY_CLAIMED", "Dieses Spielerkonto ist schon mit einem anderen Login verbunden. Bitte melde dich beim Besitzer des Spiels.");
    return { ok: true, accountId: legacy.accountId, method: "legacy-google", created: false };
  }
  const accountId = deps.newAccountId();
  const bound = await store.bindIdentity({ issuer: session.issuer, subject: session.subject, accountId, method: "google", createdAt: now });
  if (!bound.ok) {
    // A parallel first request of the same login won; use its account.
    const winner = await store.getIdentity(session.issuer, session.subject);
    if (winner && !winner.deletedAt) return { ok: true, accountId: winner.accountId, method: winner.method, created: false };
    return fail(409, "ACCOUNT_ALREADY_CLAIMED", "Dieser Login ist schon mit einem anderen Spielerkonto verbunden.");
  }
  return { ok: true, accountId, method: "google", created: true };
}

/**
 * After linking Google to an account: a Google login that is the old login of ANOTHER original account must not
 * stay linked here, or that account could never be recovered. It is unlinked again and reported as taken.
 */
export async function checkGoogleLinks(session: AuthSession, accountId: string, origin: string, deps: IdentityDeps = identityDefaults): Promise<"none" | "linked" | "conflict"> {
  const google = (await deps.listAccounts(session, origin)).filter((account) => account.providerId === "google");
  if (!google.length) return "none";
  const store = deps.store();
  for (const account of google) {
    const legacy = await store.findLegacyIdentity("google", account.accountId);
    if (legacy && legacy.accountId !== accountId) {
      await deps.unlinkAccount(session, origin, "google", account.accountId);
      return "conflict";
    }
  }
  return "linked";
}
