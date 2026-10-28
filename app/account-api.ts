// Accounts with username and password, profiles and the cloud save. The route files only hand the request in,
// so the tests can swap the login and the database.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getDb } from "../db";
import type { CloudSave, GoalClickerDatabase, Profile } from "../db";
import { authConfigured, supabasePublishableKey, supabaseUrl } from "./auth/config";
import { getRequestUser } from "./auth/server";
import type { RequestUser } from "./auth/server";
import { readJsonBody, RequestBodyTooLargeError } from "./api/request-body";
import { cleanCloudSaveKeys, MAX_CLOUD_SAVE_BYTES, serializeCloudSaveKeys } from "./cloud-save-rules";
import { cleanDisplayName, displayNameError, nextUsernameChangeAt, PASSWORD_LOGIN_DOMAIN, passwordError, usernameChangeCutoff, usernameError, usernameKey } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";

type Store = Pick<GoalClickerDatabase, "getProfile" | "getProfileByUsername" | "isUsernameTaken" | "createProfile" | "updateDisplayName" | "changeUsername" | "getCloudSave" | "putCloudSave" | "deleteAccount" | "createPasswordLogin" | "deleteLogin">;
export type AccountApiDeps = {
  getUser: (request: Request) => Promise<RequestUser | null>;
  db: () => Store;
  now: () => Date;
  /** Registers through the Supabase Auth API, where the database cannot create logins itself (local Supabase, tests). */
  signUp: (email: string, password: string) => Promise<string | null>;
};

async function signUpThroughAuthApi(email: string, password: string) {
  const supabase = createClient(supabaseUrl(), supabasePublishableKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user?.id ?? null;
}

const defaults: AccountApiDeps = { getUser: getRequestUser, db: getDb, now: () => new Date(), signUp: signUpThroughAuthApi };
const noStore = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });
const MAX_PROFILE_BODY_BYTES = 4096;

export function publicProfile(profile: Profile): PublicProfile {
  return { username: profile.username, displayName: profile.displayName, usernameChangedAt: profile.usernameChangedAt, nextUsernameChangeAt: nextUsernameChangeAt(profile.usernameChangedAt) };
}

/** The save as the browser needs it; `since` leaves the keys out when the device already has that version. */
function cloudSaveBody(save: CloudSave | null, since = -1) {
  if (!save) return { version: 0, updatedAt: null, active: false, keys: null };
  if (save.version <= since) return { version: save.version, updatedAt: save.updatedAt, active: save.active, keys: null, unchanged: true };
  let keys: unknown = null;
  try {
    keys = JSON.parse(save.saveJson);
  } catch {
    // A broken stored save counts as none; the next upload replaces it.
  }
  return { version: save.version, updatedAt: save.updatedAt, active: save.active, keys: cleanCloudSaveKeys(keys) };
}

/** Runs a handler for a verified login and turns unexpected failures into a 503 the client can retry. */
async function withUser(request: Request, deps: AccountApiDeps, handler: (user: RequestUser) => Promise<Response>) {
  if (!authConfigured()) return json({ error: "Der Login ist nicht eingerichtet.", errorCode: "AUTH_NOT_CONFIGURED" }, 404);
  try {
    const user = await deps.getUser(request);
    if (!user) return json({ error: "Bitte melde dich an.", errorCode: "LOGIN_REQUIRED" }, 401);
    return await handler(user);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: error.message }, 413);
    if (error instanceof SyntaxError) return json({ error: "Die Anfrage ist ungültig." }, 400);
    return json({ error: "Das Profil ist gerade nicht erreichbar. Bitte versuche es gleich nochmal." }, 503);
  }
}

export function getProfileResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const profile = await deps.db().getProfile(user.id);
    return json({ email: user.email, profile: profile ? publicProfile(profile) : null });
  });
}

export function createProfileResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const body = await readJsonBody<{ username?: unknown; displayName?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const displayName = cleanDisplayName(typeof body.displayName === "string" ? body.displayName : "");
    const invalid = usernameError(username) ?? displayNameError(displayName);
    if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
    const result = await deps.db().createProfile(user.id, username, displayName, deps.now().toISOString());
    if (result.reason === "taken") return json({ error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN" }, 409);
    if (!result.profile) return json({ error: "Dein Konto hat schon ein Profil.", errorCode: "PROFILE_EXISTS" }, 409);
    return json({ profile: publicProfile(result.profile) }, 201);
  });
}

export function updateProfileResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const body = await readJsonBody<{ username?: unknown; displayName?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const store = deps.db();
    const now = deps.now();
    const current = await store.getProfile(user.id);
    if (!current) return json({ error: "Lege zuerst ein Profil an.", errorCode: "PROFILE_MISSING" }, 404);
    let profile: Profile = current;
    // Validate every field before the first write, so a rejected request changes nothing.
    const displayName = typeof body.displayName === "string" ? cleanDisplayName(body.displayName) : null;
    const username = typeof body.username === "string" && body.username.trim() !== current.username ? body.username.trim() : null;
    const invalid = (displayName !== null ? displayNameError(displayName) : null) ?? (username !== null ? usernameError(username) : null);
    if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
    // The username can still be refused by the database (taken, too soon), so it goes first.
    if (username !== null) {
      const result = await store.changeUsername(user.id, username, now.toISOString(), usernameChangeCutoff(now));
      if (result.reason === "taken") return json({ error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN", profile: publicProfile(profile) }, 409);
      if (result.reason === "too-soon") return json({ error: "Den Benutzernamen kannst du nur alle 30 Tage ändern.", errorCode: "USERNAME_TOO_SOON", profile: publicProfile(profile) }, 409);
      if (!result.profile) return json({ error: "Lege zuerst ein Profil an.", errorCode: "PROFILE_MISSING" }, 404);
      profile = result.profile;
    }
    if (displayName !== null) profile = await store.updateDisplayName(user.id, displayName, now.toISOString()) ?? profile;
    return json({ profile: publicProfile(profile) });
  });
}

/** Deletes profile, cloud save, account link and the login. The username must be typed as confirmation. */
export function deleteProfileResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const body = await readJsonBody<{ confirm?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const store = deps.db();
    const profile = await store.getProfile(user.id);
    const confirm = typeof body.confirm === "string" ? usernameKey(body.confirm) : "";
    if (profile && confirm !== profile.usernameKey) return json({ error: "Zur Bestätigung den Benutzernamen eintippen.", errorCode: "CONFIRM_REQUIRED" }, 400);
    const { loginDeleted } = await store.deleteAccount(user.id);
    return json({ deleted: true, loginDeleted });
  });
}

/** Runs a handler that needs no login (registration, login, the username check). */
async function withoutUser(deps: AccountApiDeps, handler: () => Promise<Response>) {
  if (!authConfigured()) return json({ error: "Der Login ist nicht eingerichtet.", errorCode: "AUTH_NOT_CONFIGURED" }, 404);
  try {
    return await handler();
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: error.message }, 413);
    if (error instanceof SyntaxError) return json({ error: "Die Anfrage ist ungültig." }, 400);
    return json({ error: "Der Server ist gerade nicht erreichbar. Bitte versuche es gleich nochmal." }, 503);
  }
}

/** Also used before an account exists, while a new player picks a username. */
export function usernameAvailabilityResponse(request: Request, deps = defaults) {
  return withoutUser(deps, async () => {
    const username = (new URL(request.url).searchParams.get("name") ?? "").trim();
    const invalid = usernameError(username);
    if (invalid) return json({ available: false, error: invalid });
    const user = await deps.getUser(request);
    const taken = await deps.db().isUsernameTaken(usernameKey(username), user?.id);
    return json(taken ? { available: false, error: "Dieser Benutzername ist schon vergeben." } : { available: true });
  });
}

/**
 * Creates an account with username and password, together with its profile. The login address is generated and
 * returned, so the browser signs in with Supabase Auth itself; the player only ever sees the username.
 */
export function registerResponse(request: Request, deps = defaults) {
  return withoutUser(deps, async () => {
    const body = await readJsonBody<{ username?: unknown; displayName?: unknown; password?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const displayName = cleanDisplayName(typeof body.displayName === "string" ? body.displayName : "");
    const password = typeof body.password === "string" ? body.password : "";
    const invalid = usernameError(username) ?? displayNameError(displayName) ?? passwordError(password);
    if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
    const store = deps.db();
    const taken = { error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN" };
    if (await store.isUsernameTaken(usernameKey(username))) return json(taken, 409);
    const email = `p-${randomUUID()}@${PASSWORD_LOGIN_DOMAIN}`;
    const userId = await store.createPasswordLogin(email, password) ?? await deps.signUp(email, password);
    if (!userId) return json({ error: "Das Konto konnte nicht erstellt werden." }, 503);
    const result = await store.createProfile(userId, username, displayName, deps.now().toISOString(), email);
    if (!result.profile) {
      // A parallel registration took the name between the check and now; the new login must not stay behind.
      await store.deleteLogin(userId);
      return json(taken, 409);
    }
    return json({ email, profile: publicProfile(result.profile) }, 201);
  });
}

/** The login address behind a username. Only accounts with username and password have one. */
export function loginEmailResponse(request: Request, deps = defaults) {
  return withoutUser(deps, async () => {
    const body = await readJsonBody<{ username?: unknown }>(request, MAX_PROFILE_BODY_BYTES);
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const profile = username ? await deps.db().getProfileByUsername(usernameKey(username)) : null;
    if (!profile?.loginEmail) return json({ error: "Benutzername oder Passwort stimmt nicht.", errorCode: "INVALID_LOGIN" }, 404);
    return json({ email: profile.loginEmail });
  });
}

export function getCloudSaveResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const since = Number(new URL(request.url).searchParams.get("since") ?? -1);
    return json(cloudSaveBody(await deps.db().getCloudSave(user.id), Number.isSafeInteger(since) ? since : -1));
  });
}

/** Saves on top of `baseVersion`; a newer save from another device comes back as 409 with that save. */
export function putCloudSaveResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const body = await readJsonBody<{ baseVersion?: unknown; keys?: unknown; active?: unknown }>(request, MAX_CLOUD_SAVE_BYTES + 4096);
    const baseVersion = Number(body.baseVersion);
    if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) return json({ error: "Die Spielstand Version fehlt.", errorCode: "INVALID" }, 400);
    const keys = cleanCloudSaveKeys(body.keys);
    if (!keys) return json({ error: "Der Spielstand ist unvollständig.", errorCode: "INVALID" }, 400);
    const result = await deps.db().putCloudSave(user.id, serializeCloudSaveKeys(keys), baseVersion, deps.now().toISOString(), body.active !== false);
    if (result.save) return json({ version: result.save.version, updatedAt: result.save.updatedAt });
    return json({ error: "Auf einem anderen Gerät wurde inzwischen weitergespielt.", errorCode: "SAVE_CONFLICT", ...cloudSaveBody(result.conflict) }, 409);
  });
}
