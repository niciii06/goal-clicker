// Co-op world leaderboard. Only worlds count, because the server computes their goals, league and trophies
// itself; a solo save comes from the browser unchecked. The route file only hands the request in, so tests
// can swap the player check and the database.
import { getDb } from "../db";
import type { GoalClickerDatabase, LeaderboardRow, LeaderboardSort } from "../db";
import { resolvePlayer } from "./auth/player";
import type { PlayerResolution } from "./auth/player";

export const LEADERBOARD_SIZE = 25;
export const LEADERBOARD_SORTS: readonly LeaderboardSort[] = ["goals", "league", "trophies"];

/** One world as the leaderboard shows it: no world code (it would let anyone join), only whether it is yours. */
export type LeaderboardEntry = { rank: number; roomName: string; players: string[]; totalGoals: number; bestLeague: number; trophies: number; mine: boolean };

export type LeaderboardApiDeps = {
  resolve: (request: Request, playerId: string) => Promise<PlayerResolution>;
  db: () => Pick<GoalClickerDatabase, "getLeaderboard">;
};

const defaults: LeaderboardApiDeps = { resolve: (request, playerId) => resolvePlayer(request, playerId, { loginRequired: true }), db: getDb };
// Names of other players: only for the signed-in reader, never cached by a shared cache.
const headers = { "cache-control": "private, max-age=30" };

export function leaderboardEntry(row: LeaderboardRow, rank: number, playerId: string): LeaderboardEntry {
  const seats = [[row.hostPlayerId, row.hostName], [row.guestPlayerId, row.guestName], [row.player3PlayerId, row.player3Name], [row.player4PlayerId, row.player4Name]] as const;
  return {
    rank,
    roomName: row.roomName,
    players: seats.filter(([id, name]) => id && name).map(([, name]) => name!),
    totalGoals: Math.max(0, Math.floor(row.totalGoals)),
    bestLeague: row.bestLeague,
    trophies: row.trophies,
    mine: seats.some(([id]) => id === playerId),
  };
}

export async function leaderboardResponse(request: Request, deps: LeaderboardApiDeps = defaults) {
  const url = new URL(request.url);
  const sort = LEADERBOARD_SORTS.find((value) => value === url.searchParams.get("sort")) ?? "goals";
  const playerId = (url.searchParams.get("playerId") ?? "").trim().slice(0, 80);
  if (playerId.length < 8) return Response.json({ error: "Spieler-ID fehlt." }, { status: 400, headers: { "cache-control": "no-store" } });
  const auth = await deps.resolve(request, playerId);
  if (!auth.ok) return auth.response;
  try {
    const rows = await deps.db().getLeaderboard(sort, LEADERBOARD_SIZE);
    return Response.json({ sort, entries: rows.map((row, index) => leaderboardEntry(row, index + 1, auth.playerId)) }, { headers });
  } catch {
    return Response.json({ error: "Die Rangliste ist gerade nicht erreichbar." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
