// Profile and cloud save API of signed in players. The route files only hand the request in, so the
// tests can swap the login and the database.
import { getDb } from "../db";
import type { CloudSave, GoalClickerDatabase, Profile } from "../db";
import { authConfigured } from "./auth/config";
import { getRequestUser } from "./auth/server";
import type { RequestUser } from "./auth/server";
import { readJsonBody, RequestBodyTooLargeError } from "./api/request-body";
import { cleanCloudSaveKeys, MAX_CLOUD_SAVE_BYTES, serializeCloudSaveKeys } from "./cloud-save-rules";
import { cleanDisplayName, displayNameError, nextUsernameChangeAt, usernameChangeCutoff, usernameError, usernameKey } from "./profile-rules";
import type { PublicProfile } from "./profile-rules";

type Store = Pick<GoalClickerDatabase, "getProfile" | "isUsernameTaken" | "createProfile" | "updateDisplayName" | "changeUsername" | "getCloudSave" | "putCloudSave" | "deleteAccount">;
export type AccountApiDeps = { getUser: (request: Request) => Promise<RequestUser | null>; db: () => Store; now: () => Date };

const defaults: AccountApiDeps = { getUser: getRequestUser, db: getDb, now: () => new Date() };
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
    if (typeof body.displayName === "string") {
      const displayName = cleanDisplayName(body.displayName);
      const invalid = displayNameError(displayName);
      if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
      profile = await store.updateDisplayName(user.id, displayName, now.toISOString()) ?? profile;
    }
    if (typeof body.username === "string" && body.username.trim() !== profile.username) {
      const username = body.username.trim();
      const invalid = usernameError(username);
      if (invalid) return json({ error: invalid, errorCode: "INVALID" }, 400);
      const result = await store.changeUsername(user.id, username, now.toISOString(), usernameChangeCutoff(now));
      if (result.reason === "taken") return json({ error: "Dieser Benutzername ist schon vergeben.", errorCode: "USERNAME_TAKEN", profile: publicProfile(profile) }, 409);
      if (result.reason === "too-soon") return json({ error: "Den Benutzernamen kannst du nur alle 30 Tage ändern.", errorCode: "USERNAME_TOO_SOON", profile: publicProfile(profile) }, 409);
      if (!result.profile) return json({ error: "Lege zuerst ein Profil an.", errorCode: "PROFILE_MISSING" }, 404);
      profile = result.profile;
    }
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

export function usernameAvailabilityResponse(request: Request, deps = defaults) {
  return withUser(request, deps, async (user) => {
    const username = (new URL(request.url).searchParams.get("name") ?? "").trim();
    const invalid = usernameError(username);
    if (invalid) return json({ available: false, error: invalid });
    const taken = await deps.db().isUsernameTaken(usernameKey(username), user.id);
    return json(taken ? { available: false, error: "Dieser Benutzername ist schon vergeben." } : { available: true });
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
