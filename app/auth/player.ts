// Which player an API request acts for. With login the player ID comes from the game account's link
// (player_accounts), so knowing someone's player ID is not enough to enter their worlds.
import { getDb } from "../../db";
import { authMode } from "./config";
import { lookupAccount } from "./identity";
import type { AccountResolution } from "./identity";
import { AuthUnavailableError, getAuthSession } from "./server";
import type { AuthSession } from "./server";

export type PlayerResolution = { ok: true; playerId: string; accountId: string | null } | { ok: false; response: Response };

/** A signed in request: the verified login and the canonical game account it opens. */
export type RequestAccount = { session: AuthSession; accountId: string };

type Dependencies = {
  getSession: (request: Request, options?: { fresh?: boolean }) => Promise<AuthSession | null>;
  lookupAccount: (session: AuthSession) => Promise<AccountResolution>;
  getPlayerLink: (accountId: string) => Promise<{ playerId: string } | null>;
  linkPlayer: (accountId: string, playerId: string, email: string | null) => Promise<{ playerId: string } | null>;
  /** Whether a player ID belongs to an account. */
  isPlayerLinked?: (playerId: string) => Promise<boolean>;
};

const defaults: Dependencies = {
  getSession: getAuthSession,
  lookupAccount: (session) => lookupAccount(session),
  getPlayerLink: (accountId) => getDb().getAccount(accountId),
  linkPlayer: (accountId, playerId, email) => getDb().linkAccount(accountId, playerId, email),
  isPlayerLinked: (playerId) => getDb().isPlayerLinked(playerId),
};

// Warm server instances skip the player lookup on the frequent multiplayer polls.
const linkCache = new Map<string, { playerId: string; at: number }>();
const LINK_CACHE_MS = 60_000;

function deny(status: number, error: string, extra: Record<string, unknown> = {}): PlayerResolution {
  return { ok: false, response: Response.json({ error, ...extra }, { status, headers: { "cache-control": "no-store" } }) };
}

/**
 * The account's player ID; links the claimed ID of this device on the account's first use. `allowLink` is only
 * true for requests whose session was just verified with Neon Auth (fresh), so a deleted login cannot create a
 * link through a cached session.
 */
export async function accountPlayerId(account: RequestAccount, claimedPlayerId: string, deps: Pick<Dependencies, "getPlayerLink" | "linkPlayer"> = defaults, { allowLink = true } = {}) {
  const cached = linkCache.get(account.accountId);
  if (cached && Date.now() - cached.at < LINK_CACHE_MS) return cached.playerId;
  let link = await deps.getPlayerLink(account.accountId);
  if (!link && claimedPlayerId && allowLink) link = await deps.linkPlayer(account.accountId, claimedPlayerId, account.session.email);
  if (link) linkCache.set(account.accountId, { playerId: link.playerId, at: Date.now() });
  return link?.playerId ?? null;
}

/**
 * Resolves the acting player of a request. `loginRequired` routes (multiplayer worlds) refuse anonymous
 * requests once login is configured; solo routes keep working without an account. A server without a valid
 * auth configuration on a host refuses everything (503) instead of trusting the claimed player ID.
 */
export async function resolvePlayer(request: Request, claimedPlayerId: string, { loginRequired, loginMessage = "Bitte melde dich an, um Multiplayer zu spielen." }: { loginRequired: boolean; loginMessage?: string }, deps: Dependencies = defaults): Promise<PlayerResolution> {
  const mode = authMode();
  if (mode === "misconfigured") return deny(503, "Der Login ist auf diesem Server nicht eingerichtet.", { errorCode: "AUTH_NOT_CONFIGURED" });
  if (mode === "anonymous") return { ok: true, playerId: claimedPlayerId, accountId: null };
  let session: AuthSession | null;
  try {
    session = await deps.getSession(request);
  } catch (error) {
    if (error instanceof AuthUnavailableError) return deny(503, "Die Anmeldung kann gerade nicht geprüft werden. Bitte versuche es gleich nochmal.", { errorCode: "AUTH_UNAVAILABLE" });
    throw error;
  }
  if (!session) {
    if (loginRequired) return deny(401, loginMessage, { errorCode: "LOGIN_REQUIRED" });
    // A guest plays with its own player ID; the ID of an account is only usable signed in.
    if (claimedPlayerId && deps.isPlayerLinked && await deps.isPlayerLinked(claimedPlayerId)) return deny(401, "Diese Spieler-ID gehört zu einem Konto. Bitte melde dich an.", { errorCode: "LOGIN_REQUIRED" });
    return { ok: true, playerId: claimedPlayerId, accountId: null };
  }
  const account = await deps.lookupAccount(session);
  if (!account.ok) return deny(account.status, account.error, { errorCode: account.errorCode });
  // A poll only reads the link. The first link of an account asks Neon Auth again, so a session of a login that was
  // deleted meanwhile (still in the short cache) cannot create one.
  let playerId = await accountPlayerId({ session, accountId: account.accountId }, claimedPlayerId, deps, { allowLink: false });
  if (!playerId && claimedPlayerId) {
    const fresh = await deps.getSession(request, { fresh: true }).catch(() => null);
    if (fresh && fresh.subject === session.subject) playerId = await accountPlayerId({ session: fresh, accountId: account.accountId }, claimedPlayerId, deps);
    if (!playerId) return deny(409, "Diese Spieler-ID gehört bereits zu einem anderen Konto.", { errorCode: "PLAYER_TAKEN" });
  }
  if (!playerId) return deny(409, "Dein Konto ist noch nicht mit einer Spieler-ID verbunden. Bitte lade die Seite neu.", { errorCode: "ACCOUNT_SETUP_REQUIRED" });
  if (claimedPlayerId && playerId !== claimedPlayerId) return deny(409, "Dein Konto nutzt eine andere Spieler-ID. Bitte lade die Seite neu.", { errorCode: "PLAYER_MISMATCH", playerId });
  return { ok: true, playerId, accountId: account.accountId };
}

/**
 * Whether a world seat may be reclaimed by its player name. Only without accounts, where a new device has no
 * other way back in. With accounts the seat follows the account's player ID to every device, and a name plus
 * an expired presence prove no ownership.
 */
export function nameRecoveryAllowed(accountId: string | null) {
  return accountId === null;
}

export function forgetAccountLink(accountId: string) {
  linkCache.delete(accountId);
}

export function clearAccountCacheForTests() {
  linkCache.clear();
}
