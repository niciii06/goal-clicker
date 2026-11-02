// Accounts with username and password, profiles, the cloud save and the TEMPORARY recovery of the accounts from
// the original Supabase project. The route files only hand the request in, so the tests can swap login and database.
//
// Three IDs, never mixed up:
// * the Neon Auth user ID (session.subject): who is signed in,
// * the game account ID (profiles.user_id, cloud_saves.user_id, player_accounts.user_id): whose data it is,
//   for the nine original accounts their old Supabase user ID,
// * the player ID (player_accounts.player_id): the seat in multiplayer worlds.
import { createHash, randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { AccountRecovery, AuthIdentity, CloudSave, GoalClickerDatabase, Profile, RecoveryCompletion } from "../db";
import { authConfigured, authIssuer } from "./auth/config";
import { checkGoogleLinks, forgetIdentity, lookupAccount, resolveAccount } from "./auth/identity";
import type { AccountResolution } from "./auth/identity";
import { legacyBridgeConfigured, verifyLegacyPassword } from "./auth/legacy-bridge";
import type { LegacyCheck } from "./auth/legacy-bridge";
import { deleteNeonUser, signInEmail, signOutSession, signUpEmail } from "./auth/neon-accounts";
import type { DeleteOutcome, NeonLogin } from "./auth/neon-accounts";
import { forgetAccountLink } from "./auth/player";
import { AuthUnavailableError, browserSetCookies, forgetSession, getAuthSession, publicOrigin, sameOrigin } from "./auth/server";
import type { AuthSession } from "./auth/server";
import { readJsonBody, RequestBodyTooLargeError } from "./api/request-body";
import { sharedRateLimited } from "./api/rate-limit";
import type { RateLimitName } from "./api/rate-limit";
import { cleanCloudSaveKeys, MAX_CLOUD_SAVE_BYTES, serializeCloudSaveKeys } from "./cloud-save-rules";
import { cleanDisplayName, displayNameError, nextUsernameChangeAt, PASSWORD_LOGIN_DOMAIN, passwordError, usernameChangeCutoff, usernameError, usernameKey } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";

type Store = Pick<GoalClickerDatabase,
  | "getProfile" | "getProfileByUsername" | "isUsernameTaken" | "createProfile" | "updateDisplayName" | "changeUsername"
  | "getCloudSave" | "getCloudSaveSince" | "putCloudSave"
  | "getIdentity" | "getIdentityForAccount" | "bindIdentity" | "unbindIdentity" | "listLegacyIdentities"
  | "openRecoveryClaim" | "rotateRecoveryDestination" | "completeRecovery" | "findRecoveryCode"
  | "deleteAccountData" | "finishAccountDeletion">;

export type AccountApiDeps = {
  getSession: (request: Request, options?: { fresh?: boolean }) => Promise<AuthSession | null>;
  lookupAccount: (session: AuthSession) => Promise<AccountResolution>;
  db: () => Store;
  now: () => Date;
  newId: () => string;
  neon: {
    signUp: (email: string, password: string, name: string, origin: string) => Promise<NeonLogin>;
    signIn: (email: string, password: string, origin: string) => Promise<NeonLogin>;
    signOut: (sessionCookie: string, origin: string) => Promise<string[]>;
    deleteUser: (sessionCookie: string, origin: string, password?: string) => Promise<DeleteOutcome>;
  };
  /** TEMPORARY: checks an old password at the original Supabase project. */
  legacy: { configured: () => boolean; verify: (email: string, password: string) => Promise<LegacyCheck> };
  rateLimit: (request: Request, name: RateLimitName, subject?: string) => Promise<Response | null>;
  issuer: () => string;
  configured: () => boolean;
};

const defaults: AccountApiDeps = {
  getSession: getAuthSession,
  lookupAccount: (session) => lookupAccount(session),
  db: getDb,
  now: () => new Date(),
  newId: randomUUID,
  neon: { signUp: signUpEmail, signIn: signInEmail, signOut: signOutSession, deleteUser: deleteNeonUser },
  legacy: { configured: legacyBridgeConfigured, verify: verifyLegacyPassword },
  rateLimit: (request, name, subject) => sharedRateLimited(request, name, subject),
  issuer: authIssuer,
  configured: authConfigured,
};

const noStore = { "cache-control": "no-store" };
const json = (body: unknown, status = 200, setCookies: readonly string[] = []) => {
  const response = Response.json(body, { status, headers: noStore });
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
};
const MAX_PROFILE_BODY_BYTES = 4096;
/** How long a verified proof of ownership may be turned into the new login. */
const CLAIM_MS = 10 * 60_000;
const INVALID_LOGIN = { error: "Benutzername oder Passwort stimmt nicht.", errorCode: "INVALID_LOGIN" };
const loginEmail = () => `p-${randomUUID()}@${PASSWORD_LOGIN_DOMAIN}`;
const PASSWORD_METHODS = new Set(["password", "legacy-password", "owner-code"]);

export function publicProfile(profile: Profile): PublicProfile {
  return { username: profile.username, displayName: profile.displayName, usernameChangedAt: profile.usernameChangedAt, nextUsernameChangeAt: nextUsernameChangeAt(profile.usernameChangedAt) };
}

/** The save as the browser needs it; `since` leaves the keys out when the device already has that version. */
function cloudSaveBody(save: (Omit<CloudSave, "saveJson"> & { saveJson: string | null }) | null, since = -1) {
  if (!save) return { version: 0, updatedAt: null, active: false, activeVersion: 0, keys: null };
  if (save.version <= since || save.saveJson === null) return { version: save.version, updatedAt: save.updatedAt, active: save.active, activeVersion: save.activeVersion, keys: null, unchanged: true };
  let keys: unknown = null;
  try {
    keys = JSON.parse(save.saveJson);
  } catch {
    // A broken stored save counts as none; the next upload replaces it.
  }
  return { version: save.version, updatedAt: save.updatedAt, active: save.active, activeVersion: save.activeVersion, keys: cleanCloudSaveKeys(keys) };
}

function failure(error: unknown) {
  if (error instanceof RequestBodyTooLargeError) return json({ error: error.message }, 413);
  if (error instanceof SyntaxError) return json({ error: "Die Anfrage ist ungültig." }, 400);
  if (error instanceof AuthUnavailableError) return json({ error: "Die Anmeldung kann gerade nicht geprüft werden. Bitte versuche es gleich nochmal.", errorCode: "AUTH_UNAVAILABLE" }, 503);
  return json({ error: "Der Server ist gerade nicht erreichbar. Bitte versuche es gleich nochmal." }, 503);
}

const notConfigured = () => json({ error: "Der Login ist auf diesem Server nicht eingerichtet.", errorCode: "AUTH_NOT_CONFIGURED" }, 503);
const crossSite = () => json({ error: "Nicht erlaubt.", errorCode: "CROSS_SITE" }, 403);

type Account = { session: AuthSession; accountId: string; method: string };

/**
 * Runs a handler for a verified login with its game account. `fresh` asks Neon Auth instead of the short session
 * cache; every handler that creates, changes or deletes data uses it.
 */
async function withAccount(request: Request, deps: AccountApiDeps, { fresh }: { fresh: boolean }, handler: (account: Account) => Promise<Response>) {
  if (!deps.configured()) return notConfigured();
  if (request.method !== "GET" && !sameOrigin(request)) return crossSite();
  try {
    const session = await deps.getSession(request, { fresh });
    if (!session) return json({ error: "Bitte melde dich an.", errorCode: "LOGIN_REQUIRED" }, 401);
    const account = await deps.lookupAccount(session);
    if (!account.ok) return json({ error: account.error, errorCode: account.errorCode }, account.status);
    return await handler({ session, accountId: account.accountId, method: account.method });
  } catch (error) {
    return failure(error);
  }
}

/** Runs a handler that needs no login (registration, login, recovery, the username check). */
async function withoutAccount(request: Request, deps: AccountApiDeps, handler: () => Promise<Response>) {
  if (!deps.configured()) return notConfigured();
  if (request.method !== "GET" && !sameOrigin(request)) return crossSite();
  try {
    return await handler();
  } catch (error) {
    return failure(error);
  }
}

export function getProfileResponse(request: Request, deps = defaults) {
  return withAccount(request, deps, { fresh: false }, async ({ session, accountId, method }) => {
    const profile = await deps.db().getProfile(accountId);
    return json({ email: PASSWORD_METHODS.has(method) ? null : session.email, profile: profile ? publicProfile(profile) : null });
  });
}

export function createProfileResponse(request: Request, deps = defaults) {
  return withAccount(request, deps, { fresh: true }, async ({ accountId }) => {
    const body = await readJsonBody<{ username?: unknown; displayName?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const displayName = cleanDisplayName(typeof body.displayName === "string" ? body.displayName : "");
    const invalid = usernameError(username) ?? displayNameError(displayName);
    if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
    // Never replaces a profile: an original account keeps its own (createProfile does nothing on an existing row).
    const result = await deps.db().createProfile(accountId, username, displayName, deps.now().toISOString());
    if (result.reason === "taken") return json({ error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN" }, 409);
    if (!result.profile) return json({ error: "Dein Konto hat schon ein Profil.", errorCode: "PROFILE_EXISTS" }, 409);
    return json({ profile: publicProfile(result.profile) }, 201);
  });
}

export function updateProfileResponse(request: Request, deps = defaults) {
  return withAccount(request, deps, { fresh: true }, async ({ accountId }) => {
    const body = await readJsonBody<{ username?: unknown; displayName?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const store = deps.db();
    const now = deps.now();
    const current = await store.getProfile(accountId);
    if (!current) return json({ error: "Lege zuerst ein Profil an.", errorCode: "PROFILE_MISSING" }, 404);
    let profile: Profile = current;
    // Validate every field before the first write, so a rejected request changes nothing.
    const displayName = typeof body.displayName === "string" ? cleanDisplayName(body.displayName) : null;
    const username = typeof body.username === "string" && body.username.trim() !== current.username ? body.username.trim() : null;
    const invalid = (displayName !== null ? displayNameError(displayName) : null) ?? (username !== null ? usernameError(username) : null);
    if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
    // The username can still be refused by the database (taken, too soon), so it goes first.
    if (username !== null) {
      const result = await store.changeUsername(accountId, username, now.toISOString(), usernameChangeCutoff(now));
      if (result.reason === "taken") return json({ error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN", profile: publicProfile(profile) }, 409);
      if (result.reason === "too-soon") return json({ error: "Den Benutzernamen kannst du nur alle 30 Tage ändern.", errorCode: "USERNAME_TOO_SOON", profile: publicProfile(profile) }, 409);
      if (!result.profile) return json({ error: "Lege zuerst ein Profil an.", errorCode: "PROFILE_MISSING" }, 404);
      profile = result.profile;
    }
    if (displayName !== null) profile = await store.updateDisplayName(accountId, displayName, now.toISOString()) ?? profile;
    return json({ profile: publicProfile(profile) });
  });
}

const DELETE_MESSAGES: Record<Exclude<DeleteOutcome, "deleted">, { error: string; errorCode: string }> = {
  "needs-reauth": { error: "Zum Löschen musst du dich zuerst neu anmelden. Melde dich ab, wieder an und lösche das Profil dann sofort.", errorCode: "REAUTH_REQUIRED" },
  "not-deleted": { error: "Der Login konnte nicht gelöscht werden. Es wurde nichts gelöscht. Bitte versuche es später nochmal.", errorCode: "LOGIN_NOT_DELETED" },
};

/**
 * Deletes the account: profile, cloud save, the link to the player ID and the login itself. The username must be
 * typed as confirmation. Order, so that success is only reported once the login is really gone:
 * 1. Neon Auth deletes the login (and its sessions); afterwards the session must no longer verify. If that
 *    fails, nothing at all was deleted and the player can simply try again.
 * 2. Then the game data is deleted in one transaction and the login is marked as deleted, then the mapping
 *    goes. If this step fails, the answer says so (the login is gone, the data is not yet) instead of "deleted".
 * Worlds stay, other players share them.
 */
export function deleteProfileResponse(request: Request, deps = defaults) {
  if (!deps.configured()) return Promise.resolve(notConfigured());
  if (!sameOrigin(request)) return Promise.resolve(crossSite());
  return (async () => {
    try {
      const body = await readJsonBody<{ confirm?: unknown; password?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
      const session = await deps.getSession(request, { fresh: true });
      if (!session) return json({ error: "Bitte melde dich an.", errorCode: "LOGIN_REQUIRED" }, 401);
      const store = deps.db();
      const identity = await store.getIdentity(session.issuer, session.subject);
      if (!identity) return json({ error: "Dieser Login gehört zu keinem Spielerkonto.", errorCode: "ACCOUNT_SETUP_REQUIRED" }, 409);
      const accountId = identity.accountId;
      const now = deps.now().toISOString();
      // A deletion that stopped half way is finished without asking again.
      if (!identity.deletedAt) {
        const profile = await store.getProfile(accountId);
        const confirm = typeof body.confirm === "string" ? usernameKey(body.confirm) : "";
        if (profile && confirm !== profile.usernameKey) return json({ error: "Zur Bestätigung den Benutzernamen eintippen.", errorCode: "CONFIRM_REQUIRED" }, 400);
      }
      const password = typeof body.password === "string" && body.password ? body.password : undefined;
      const outcome = await deps.neon.deleteUser(session.sessionCookie, publicOrigin(request), password);
      if (outcome !== "deleted") return json(DELETE_MESSAGES[outcome], outcome === "needs-reauth" ? 401 : 503);
      forgetSession(request);
      forgetIdentity(session);
      forgetAccountLink(accountId);
      try {
        await store.deleteAccountData(accountId, now);
        await store.finishAccountDeletion(accountId);
      } catch {
        return json({ error: "Dein Login ist gelöscht, aber das Spielerkonto noch nicht vollständig. Der Besitzer des Spiels schliesst das ab.", errorCode: "DATA_NOT_DELETED", loginDeleted: true }, 503);
      }
      return json({ deleted: true, loginDeleted: true }, 200, browserSetCookies(expiredSessionCookies()));
    } catch (error) {
      return failure(error);
    }
  })();
}

/** Clears the Neon Auth cookies in the browser. */
function expiredSessionCookies() {
  return ["__Secure-neon-auth.session_token", "__Secure-neon-auth.local.session_data", "__Secure-neon-auth.session_data", "__Secure-neon-auth.dont_remember"].map((name) => `${name}=; Path=/; Max-Age=0; HttpOnly`);
}

/** Also used before an account exists, while a new player picks a username. */
export function usernameAvailabilityResponse(request: Request, deps = defaults) {
  return withoutAccount(request, deps, async () => {
    const username = (new URL(request.url).searchParams.get("name") ?? "").trim();
    const invalid = usernameError(username);
    if (invalid) return json({ available: false, error: invalid });
    const session = await deps.getSession(request).catch(() => null);
    const own = session ? await deps.lookupAccount(session).catch(() => null) : null;
    const taken = await deps.db().isUsernameTaken(usernameKey(username), own?.ok ? own.accountId : undefined);
    return json(taken ? { available: false, error: "Dieser Benutzername ist schon vergeben." } : { available: true });
  });
}

/**
 * Creates an account with username and password, together with its profile, and signs the browser in. The Neon
 * login gets a generated address that never leaves the server. If anything after creating the login fails, the
 * login is deleted again, so no login without an account stays behind.
 */
export function registerResponse(request: Request, deps = defaults) {
  return withoutAccount(request, deps, async () => {
    const body = await readJsonBody<{ username?: unknown; displayName?: unknown; password?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const displayName = cleanDisplayName(typeof body.displayName === "string" ? body.displayName : "");
    const password = typeof body.password === "string" ? body.password : "";
    const invalid = usernameError(username) ?? displayNameError(displayName) ?? passwordError(password);
    if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
    const limited = await deps.rateLimit(request, "register");
    if (limited) return limited;
    const store = deps.db();
    const taken = { error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN" };
    if (await store.isUsernameTaken(usernameKey(username))) return json(taken, 409);
    const origin = publicOrigin(request);
    const email = loginEmail();
    const login = await deps.neon.signUp(email, password, displayName, origin);
    if (!login.ok) return login.reason === "rate-limited" ? json({ error: "Zu viele Versuche. Bitte warte ein paar Minuten.", errorCode: "RATE_LIMITED" }, 429) : json({ error: "Das Konto konnte nicht erstellt werden.", errorCode: "SIGNUP_FAILED" }, 503);
    const issuer = deps.issuer();
    const accountId = deps.newId();
    const undo = async () => {
      await store.unbindIdentity(issuer, login.subject).catch(() => undefined);
      await deps.neon.deleteUser(login.sessionCookie, origin).catch(() => "not-deleted");
    };
    try {
      const bound = await store.bindIdentity({ issuer, subject: login.subject, accountId, method: "password", loginEmail: email, createdAt: deps.now().toISOString() });
      if (!bound.ok) { await undo(); return json({ error: "Das Konto konnte nicht erstellt werden.", errorCode: "SIGNUP_FAILED" }, 503); }
      const result = await store.createProfile(accountId, username, displayName, deps.now().toISOString(), null);
      if (!result.profile) {
        // A parallel registration took the name between the check and now; the new login must not stay behind.
        await undo();
        return json(taken, 409);
      }
      return json({ profile: publicProfile(result.profile) }, 201, browserSetCookies(login.setCookies));
    } catch (error) {
      await undo();
      throw error;
    }
  });
}

type ProfileLookup = Pick<Profile, "userId" | "loginEmail" | "displayName">;

/** Profile and Neon login of a username, or null. Every failure of a login looks the same to the client. */
async function loginTarget(store: Store, issuer: string, username: string): Promise<{ profile: ProfileLookup; identity: AuthIdentity | null } | null> {
  if (usernameError(username)) return null;
  const profile = await store.getProfileByUsername(usernameKey(username));
  if (!profile) return null;
  return { profile, identity: await store.getIdentityForAccount(issuer, profile.userId) };
}

/**
 * Signs in with username and password. A username account from the original project that has no Neon login yet
 * is recovered on the way (TEMPORARY bridge): the old password is checked at Supabase, then the new login is
 * created with the same password and bound to the original account. The player just logs in as before.
 */
export function loginResponse(request: Request, deps = defaults) {
  return withoutAccount(request, deps, async () => {
    const body = await readJsonBody<{ username?: unknown; password?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || password.length > 256) return json(INVALID_LOGIN, 401);
    const limited = await deps.rateLimit(request, "login", usernameKey(username));
    if (limited) return limited;
    const store = deps.db();
    const issuer = deps.issuer();
    const origin = publicOrigin(request);
    const target = await loginTarget(store, issuer, username);
    if (!target) return json(INVALID_LOGIN, 401);
    const { profile, identity } = target;
    if (identity?.deletedAt) return json(INVALID_LOGIN, 401);
    if (identity) {
      if (!identity.loginEmail) return json(INVALID_LOGIN, 401);
      const login = await deps.neon.signIn(identity.loginEmail, password, origin);
      if (login.ok && login.subject === identity.subject) return json({ signedIn: true }, 200, browserSetCookies(login.setCookies));
      if (login.ok) { await deps.neon.signOut(login.sessionCookie, origin); return json(INVALID_LOGIN, 401); }
      if (login.reason === "rate-limited") return json({ error: "Zu viele Versuche. Bitte warte ein paar Minuten.", errorCode: "RATE_LIMITED" }, 429);
      return json(INVALID_LOGIN, 401);
    }
    // No Neon login yet: only an original username account (it still has its old generated address) can be recovered.
    if (!profile.loginEmail) return json(INVALID_LOGIN, 401);
    if (!(await isLegacyPasswordAccount(store, profile.userId))) return json(INVALID_LOGIN, 401);
    if (!deps.legacy.configured()) return json({ error: "Dein Konto muss einmalig übernommen werden, das ist gerade nicht möglich. Bitte melde dich beim Besitzer des Spiels.", errorCode: "RECOVERY_UNAVAILABLE" }, 503);
    const check = await deps.legacy.verify(profile.loginEmail, password);
    if (check.result === "rate-limited") return json({ error: "Zu viele Versuche. Bitte warte ein paar Minuten.", errorCode: "RATE_LIMITED" }, 429);
    if (check.result === "unavailable") return json({ error: "Dein Konto muss einmalig übernommen werden, der alte Login Dienst antwortet aber gerade nicht. Bitte versuche es später nochmal.", errorCode: "RECOVERY_UNAVAILABLE" }, 503);
    // The proof must be for exactly this account.
    if (check.result !== "valid" || check.userId !== profile.userId) return json(INVALID_LOGIN, 401);
    return migratePasswordLogin(deps, { accountId: profile.userId, password, name: profile.displayName, method: "legacy-password", origin });
  });
}

async function isLegacyPasswordAccount(store: Store, accountId: string) {
  return (await store.listLegacyIdentities(accountId)).some((identity) => identity.provider === "email" && identity.providerSubject === accountId);
}

const RECOVERY_FAILED = { error: "Die Übernahme deines Kontos hat nicht geklappt. Es wurde nichts verändert. Bitte versuche es nochmal.", errorCode: "RECOVERY_FAILED" };

/**
 * Creates the new username login for an original account after a verified proof and binds it, exactly once.
 * Safe to retry: the generated address is fixed per account, so a retry after a partial failure signs in to the
 * login the first attempt created (same password) and binds that. Concurrent attempts bind the same login.
 */
async function migratePasswordLogin(deps: AccountApiDeps, values: { accountId: string; password: string; name: string; method: "legacy-password" | "owner-code"; origin: string; codeHash?: string }) {
  const store = deps.db();
  const issuer = deps.issuer();
  const now = deps.now();
  let claim: AccountRecovery = await store.openRecoveryClaim({ accountId: values.accountId, issuer, method: values.method, destinationEmail: loginEmail(), claimExpiresAt: new Date(now.getTime() + CLAIM_MS).toISOString(), now: now.toISOString() });
  if (claim.consumedAt) {
    // Already recovered (a parallel or earlier request): sign in to the bound login instead.
    const identity = await store.getIdentityForAccount(issuer, values.accountId);
    if (identity?.loginEmail && !identity.deletedAt) {
      const login = await deps.neon.signIn(identity.loginEmail, values.password, values.origin);
      if (login.ok && login.subject === identity.subject) return json({ signedIn: true, recovered: true }, 200, browserSetCookies(login.setCookies));
    }
    return json(RECOVERY_FAILED, 409);
  }
  let login = await deps.neon.signUp(claim.destinationEmail, values.password, values.name, values.origin);
  if (!login.ok && login.reason === "exists") login = await deps.neon.signIn(claim.destinationEmail, values.password, values.origin);
  if (!login.ok && login.reason === "invalid") {
    // The address is held by a login from an earlier attempt with another password (owner code flow): use a new one.
    const rotated = await store.rotateRecoveryDestination(values.accountId, issuer, loginEmail(), now.toISOString());
    if (!rotated) return json(RECOVERY_FAILED, 409);
    claim = rotated;
    login = await deps.neon.signUp(claim.destinationEmail, values.password, values.name, values.origin);
  }
  if (!login.ok) return login.reason === "rate-limited" ? json({ error: "Zu viele Versuche. Bitte warte ein paar Minuten.", errorCode: "RATE_LIMITED" }, 429) : json(RECOVERY_FAILED, 503);
  let completion: RecoveryCompletion;
  try {
    completion = await store.completeRecovery({ accountId: values.accountId, issuer, subject: login.subject, loginEmail: claim.destinationEmail, method: values.method, now: deps.now().toISOString(), codeHash: values.codeHash });
  } catch (error) {
    // Not bound: leave no signed in session behind. The new login stays for the retry (same address).
    await deps.neon.signOut(login.sessionCookie, values.origin);
    throw error;
  }
  if (!completion.ok) {
    await deps.neon.signOut(login.sessionCookie, values.origin);
    const expired = completion.reason === "expired" || completion.reason === "code-used";
    return json(expired ? { error: "Die Übernahme ist abgelaufen. Bitte melde dich nochmal an.", errorCode: "RECOVERY_EXPIRED" } : RECOVERY_FAILED, 409);
  }
  return json({ signedIn: true, recovered: true }, 200, browserSetCookies(login.setCookies));
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.replace(/[\s-]/g, "").toUpperCase()).digest("hex");
}

/**
 * TEMPORARY: recovery with a one time code the owner issued for exactly one account (when the old password is
 * lost or the old service is gone). The player chooses a new password. The code only works for its account,
 * once, until it expires.
 */
export function recoveryCodeResponse(request: Request, deps = defaults) {
  return withoutAccount(request, deps, async () => {
    const body = await readJsonBody<{ username?: unknown; code?: unknown; password?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const invalidPassword = passwordError(password);
    if (invalidPassword) return json({ error: invalidPassword, errorCode: "INVALID" }, 400);
    const limited = await deps.rateLimit(request, "recovery", usernameKey(username));
    if (limited) return limited;
    const refused = json({ error: "Benutzername oder Wiederherstellungscode stimmt nicht.", errorCode: "INVALID_CODE" }, 401);
    if (!username || code.length < 16 || code.length > 64) return refused;
    const store = deps.db();
    const issuer = deps.issuer();
    const target = await loginTarget(store, issuer, username);
    const codeHash = hashRecoveryCode(code);
    const stored = await store.findRecoveryCode(codeHash, issuer, deps.now().toISOString());
    if (!target || !stored || stored.accountId !== target.profile.userId) return refused;
    if (target.identity) return json({ error: "Dieses Konto hat schon einen Login. Melde dich normal an.", errorCode: "ALREADY_RECOVERED" }, 409);
    return migratePasswordLogin(deps, { accountId: target.profile.userId, password, name: target.profile.displayName, method: "owner-code", origin: publicOrigin(request), codeHash });
  });
}

export function getCloudSaveResponse(request: Request, deps = defaults) {
  return withAccount(request, deps, { fresh: false }, async ({ accountId }) => {
    const since = Number(new URL(request.url).searchParams.get("since") ?? -1);
    const safeSince = Number.isSafeInteger(since) ? since : -1;
    return json(cloudSaveBody(await deps.db().getCloudSaveSince(accountId, safeSince), safeSince));
  });
}

/** Saves on top of `baseVersion`; a newer save from another device comes back as 409 with that save. */
export function putCloudSaveResponse(request: Request, deps = defaults) {
  // The first save creates a row and asks Neon Auth itself (fresh): a deleted login must not get one back.
  return withAccount(request, deps, { fresh: false }, async ({ accountId, session }) => {
    const body = await readJsonBody<{ baseVersion?: unknown; keys?: unknown; active?: unknown }>(request, MAX_CLOUD_SAVE_BYTES + 4096);
    const baseVersion = Number(body.baseVersion);
    if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) return json({ error: "Die Spielstand Version fehlt.", errorCode: "INVALID" }, 400);
    const keys = cleanCloudSaveKeys(body.keys);
    if (!keys) return json({ error: "Der Spielstand ist unvollständig.", errorCode: "INVALID" }, 400);
    if (baseVersion === 0) {
      const fresh = await deps.getSession(request, { fresh: true });
      if (!fresh || fresh.subject !== session.subject) return json({ error: "Dieses Konto gibt es nicht mehr. Bitte melde dich neu an.", errorCode: "LOGIN_REQUIRED" }, 401);
    }
    const result = await deps.db().putCloudSave(accountId, serializeCloudSaveKeys(keys), baseVersion, deps.now().toISOString(), body.active !== false);
    if (result.save) return json({ version: result.save.version, updatedAt: result.save.updatedAt });
    return json({ error: "Auf einem anderen Gerät wurde inzwischen weitergespielt.", errorCode: "SAVE_CONFLICT", ...cloudSaveBody(result.conflict) }, 409);
  });
}

type SessionDeps = {
  getSession: AccountApiDeps["getSession"];
  resolveAccount: (session: AuthSession, origin: string) => Promise<AccountResolution>;
  checkGoogle: (session: AuthSession, accountId: string, origin: string) => Promise<"none" | "linked" | "conflict">;
  linkPlayer: (account: { session: AuthSession; accountId: string }, claimedPlayerId: string) => Promise<string | null>;
  configured: () => boolean;
};

/**
 * POST /api/account: the start of every signed in visit. Verifies the session with Neon Auth, binds a new login
 * to its account (Google recovery or a new account, see app/auth/identity.ts), links the player ID of this
 * device on the account's first use, and relays a renewed session cookie.
 */
export async function accountSessionResponse(request: Request, deps: SessionDeps) {
  if (!deps.configured()) return notConfigured();
  if (!sameOrigin(request)) return crossSite();
  try {
    const body = await readJsonBody<{ playerId?: unknown; checkGoogle?: unknown }>(request, 4096);
    const claimed = typeof body.playerId === "string" && body.playerId.trim().length >= 8 ? body.playerId.trim().slice(0, 80) : "";
    const session = await deps.getSession(request, { fresh: true });
    if (!session) return json({ signedIn: false, error: "Nicht angemeldet.", errorCode: "LOGIN_REQUIRED" }, 401);
    const origin = publicOrigin(request);
    const account = await deps.resolveAccount(session, origin);
    if (!account.ok) return json({ signedIn: true, error: account.error, errorCode: account.errorCode }, account.status);
    const google = body.checkGoogle === true ? await deps.checkGoogle(session, account.accountId, origin) : undefined;
    const playerId = claimed ? await deps.linkPlayer({ session, accountId: account.accountId }, claimed) : null;
    if (claimed && !playerId) return json({ error: "Diese Spieler-ID gehört bereits zu einem anderen Konto.", errorCode: "PLAYER_TAKEN" }, 409);
    const passwordLogin = PASSWORD_METHODS.has(account.method);
    return json({ signedIn: true, accountId: account.accountId, email: passwordLogin ? null : session.email, passwordLogin, suggestedName: session.name, created: account.created, ...(google ? { google } : {}), ...(playerId ? { playerId } : {}) }, 200, browserSetCookies(session.refreshCookies ?? []));
  } catch (error) {
    return failure(error);
  }
}

export const accountSessionDefaults = (linkPlayer: SessionDeps["linkPlayer"]): SessionDeps => ({
  getSession: getAuthSession,
  resolveAccount: (session, origin) => resolveAccount(session, origin),
  checkGoogle: (session, accountId, origin) => checkGoogleLinks(session, accountId, origin),
  linkPlayer,
  configured: authConfigured,
});
