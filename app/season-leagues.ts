// AI clubs move between the leagues of a world, one for one with the own club. Every league has six members: five AI
// clubs plus the own club in its league, six AI clubs in every other league. Across each of the 14 league boundaries
// exactly one club goes up (the first of the lower league's table) and exactly one goes down (the last of the upper
// league's table), the own club included. The own club takes the place of whichever club it swaps with, so no league
// ever gets bigger or smaller.
import { LEAGUE_MEMBERS, SEASON_CLUBS, defaultAiLeagues, seasonClubsOf } from "./travel-geography";
import type { AiLeagues, SeasonClub } from "./travel-geography";

const DIVISIONS = 15;
export const OWN_CLUB_ID = "club";

/** A club that changed league after the season; `clubId` is OWN_CLUB_ID for the own club. */
export type AiMove = { clubId: string; name: string; from: number; to: number };

/** A saved assignment is only kept when it fits the own club's division: six per league, five in the own league. */
/** `catalog`: the clubs of the world (app/home-cities.ts worldCatalog); Bern's catalogue by default. */
export function normalizeAiLeagues(raw: unknown, playerDivision: number, catalog: readonly SeasonClub[] = SEASON_CLUBS): AiLeagues | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const result: AiLeagues = {};
  const counts = new Array<number>(DIVISIONS + 1).fill(0);
  for (const club of catalog) {
    const division = Number(source[club.id]);
    if (!Number.isInteger(division) || division < 1 || division > DIVISIONS) return undefined;
    result[club.id] = division;
    counts[division] += 1;
  }
  const own = Math.max(1, Math.min(DIVISIONS, Math.floor(playerDivision) || 1));
  for (let division = 1; division <= DIVISIONS; division++) if (counts[division] !== (division === own ? LEAGUE_MEMBERS - 1 : LEAGUE_MEMBERS)) return undefined;
  return result;
}

export function normalizeAiMoves(raw: unknown): AiMove[] {
  return (Array.isArray(raw) ? raw : []).map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : {})).map((item) => ({
    clubId: String(item.clubId ?? ""), name: String(item.name ?? "").slice(0, 42), from: Number(item.from), to: Number(item.to),
  })).filter((move) => move.clubId && move.name && Number.isInteger(move.from) && Number.isInteger(move.to) && move.from >= 1 && move.from <= DIVISIONS && move.to >= 1 && move.to <= DIVISIONS).slice(0, 2 * DIVISIONS);
}

type Sim = { catalog?: readonly SeasonClub[]; ratingOf: (division: number, index: number) => number; rollScore: (strength: number, random: () => number) => number; random: () => number };

/** A double round robin between the six AI clubs of a league nobody plays in; the best come first. */
function simulateRanking(division: number, aiLeagues: AiLeagues, { ratingOf, rollScore, random, catalog }: Sim): string[] {
  const clubs = seasonClubsOf(division, aiLeagues, catalog);
  const rows = clubs.map((club) => ({ id: club.id, points: 0, goalsFor: 0, goalsAgainst: 0 }));
  for (let home = 0; home < rows.length; home++) for (let away = 0; away < rows.length; away++) {
    if (home === away) continue;
    const homeStrength = ratingOf(division, home + 1) - ratingOf(division, away + 1) + 1;
    const homeScore = rollScore(homeStrength, random), awayScore = rollScore(-homeStrength, random);
    rows[home].goalsFor += homeScore; rows[home].goalsAgainst += awayScore; rows[away].goalsFor += awayScore; rows[away].goalsAgainst += homeScore;
    if (homeScore > awayScore) rows[home].points += 3; else if (homeScore < awayScore) rows[away].points += 3; else { rows[home].points += 1; rows[away].points += 1; }
  }
  return rows.sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.id.localeCompare(b.id)).map((row) => row.id);
}

/**
 * The new league assignment after a finished season. `playerLeagueOrder` is the real final table of the own league
 * (OWN_CLUB_ID and the five AI club ids, best first); every other league is simulated once. All movements come from
 * the final tables before any club moves, so nobody moves twice. Returns the moves, the own club included, and the new
 * AI assignment (valid for the division the own club plays in next).
 */
export function advanceAiLeagues(options: { aiLeagues?: AiLeagues; playerDivision: number; playerLeagueOrder: string[]; ownClubName: string } & Sim) {
  const { playerDivision, playerLeagueOrder } = options;
  const catalog = options.catalog ?? SEASON_CLUBS;
  const current: AiLeagues = { ...(options.aiLeagues ?? defaultAiLeagues(playerDivision, catalog)) };
  const next: AiLeagues = { ...current };
  const moves: AiMove[] = [];
  const nameOf = new Map(catalog.map((club) => [club.id, club.name]));
  let playerNext = playerDivision;
  const place = (id: string, from: number, to: number) => {
    moves.push({ clubId: id, name: id === OWN_CLUB_ID ? options.ownClubName : nameOf.get(id) ?? id, from, to });
    if (id === OWN_CLUB_ID) playerNext = to; else next[id] = to;
  };
  for (let division = 1; division <= DIVISIONS; division++) {
    const members = new Set(seasonClubsOf(division, current, catalog).map((club) => club.id));
    const real = division === playerDivision && playerLeagueOrder.length === LEAGUE_MEMBERS && playerLeagueOrder.includes(OWN_CLUB_ID) && playerLeagueOrder.every((id) => id === OWN_CLUB_ID || members.has(id));
    const ranking = real ? playerLeagueOrder : simulateRanking(division, current, options);
    if (division < DIVISIONS) place(ranking[0], division, division + 1);
    if (division > 1) place(ranking[ranking.length - 1], division, division - 1);
  }
  return { aiLeagues: next, moves, playerDivision: playerNext };
}
