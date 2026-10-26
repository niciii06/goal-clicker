// Which player an API request acts for. With Google login the player ID comes from the account link,
// so knowing someone's player ID is no longer enough to enter their worlds.
import { getDb } from "../../db";
import { authMode } from "./config";
import { getRequestUser } from "./server";
import type { RequestUser } from "./server";

export type PlayerResolution = { ok: true; playerId: string; userId: string | null } | { ok: false; response: Response };

type Dependencies = {
  getUser: (request: Request) => Promise<RequestUser | null>;
  getAccount: (userId: string) => Promise<{ playerId: string } | null>;
  linkAccount: (userId: string, playerId: string, email: string | null) => Promise<{ playerId: string } | null>;
};

const defaults: Dependencies = {
  getUser: getRequestUser,
  getAccount: (userId) => getDb().getAccount(userId),
  linkAccount: (userId, playerId, email) => getDb().linkAccount(userId, playerId, email),
};

// Warm server instances skip the account lookup on the frequent multiplayer polls.
const linkCache = new Map<string, { playerId: string; at: number }>();
const LINK_CACHE_MS = 60_000;

function deny(status: number, error: string, extra: Record<string, unknown> = {}): PlayerResolution {
  return { ok: false, response: Response.json({ error, ...extra }, { status, headers: { "cache-control": "no-store" } }) };
}

/** The account's player ID; links the claimed ID of this device on the first login. */
export async function accountPlayerId(user: RequestUser, claimedPlayerId: string, deps: Dependencies = defaults) {
  const cached = linkCache.get(user.id);
  if (cached && Date.now() - cached.at < LINK_CACHE_MS) return cached.playerId;
  let account = await deps.getAccount(user.id);
  if (!account && claimedPlayerId) account = await deps.linkAccount(user.id, claimedPlayerId, user.email);
  if (account) linkCache.set(user.id, { playerId: account.playerId, at: Date.now() });
  return account?.playerId ?? null;
}

/**
 * Resolves the acting player of a request. `loginRequired` routes (multiplayer worlds) refuse anonymous
 * requests once login is configured; solo routes keep working without an account.
 */
export async function resolvePlayer(request: Request, claimedPlayerId: string, { loginRequired }: { loginRequired: boolean }, deps: Dependencies = defaults): Promise<PlayerResolution> {
  const mode = authMode();
  if (mode === "misconfigured") return deny(503, "Der Login ist auf diesem Server nicht eingerichtet.", { errorCode: "AUTH_NOT_CONFIGURED" });
  if (mode === "anonymous") return { ok: true, playerId: claimedPlayerId, userId: null };
  const user = await deps.getUser(request);
  if (!user) return loginRequired ? deny(401, "Bitte melde dich mit Google an, um Multiplayer zu spielen.", { errorCode: "LOGIN_REQUIRED" }) : { ok: true, playerId: claimedPlayerId, userId: null };
  const playerId = await accountPlayerId(user, claimedPlayerId, deps);
  if (!playerId) return deny(409, "Diese Spieler-ID gehört bereits zu einem anderen Konto.", { errorCode: "PLAYER_TAKEN" });
  if (claimedPlayerId && playerId !== claimedPlayerId) return deny(409, "Dein Konto nutzt eine andere Spieler-ID. Bitte lade die Seite neu.", { errorCode: "PLAYER_MISMATCH", playerId });
  return { ok: true, playerId, userId: user.id };
}

/**
 * Whether a world seat may be reclaimed by its player name. Only without accounts, where a new device has no
 * other way back in. With accounts the seat follows the account's player ID to every device, and a name plus
 * an expired presence prove no ownership.
 */
export function nameRecoveryAllowed(userId: string | null) {
  return userId === null;
}

export function forgetAccountLink(userId: string) {
  linkCache.delete(userId);
}

export function clearAccountCacheForTests() {
  linkCache.clear();
}
