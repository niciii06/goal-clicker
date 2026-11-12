// AI clubs move between the leagues of a world: at every league boundary, as many AI clubs are promoted from the
// lower league as are relegated from the upper one. The number is the existing relegation rule of the season table
// (the last two of six places go down, the first two go up), so it is not a new rule. The own club keeps its rules
// and does not count: the five AI clubs of every league stay five, so the league sizes stay balanced.
import { SEASON_CLUBS, seasonClubsOf } from "./travel-geography";
import type { AiLeagues } from "./travel-geography";

export const AI_CLUBS_PER_LEAGUE = 5;
const DIVISIONS = 15;

export type AiMove = { clubId: string; name: string; from: number; to: number };

/** A saved assignment is only kept when every catalogue club has a league and each league holds exactly five. */
export function normalizeAiLeagues(raw: unknown): AiLeagues | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const result: AiLeagues = {};
  const counts = new Array<number>(DIVISIONS + 1).fill(0);
  for (const club of SEASON_CLUBS) {
    const division = Number(source[club.id]);
    if (!Number.isInteger(division) || division < 1 || division > DIVISIONS) return undefined;
    result[club.id] = division;
    counts[division] += 1;
  }
  if (counts.slice(1).some((count) => count !== AI_CLUBS_PER_LEAGUE)) return undefined;
  const catalogue = SEASON_CLUBS.every((club) => result[club.id] === 16 - club.league);
  return catalogue ? undefined : result;
}

export function normalizeAiMoves(raw: unknown): AiMove[] {
  return (Array.isArray(raw) ? raw : []).map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : {})).map((item) => ({
    clubId: String(item.clubId ?? ""), name: String(item.name ?? "").slice(0, 42), from: Number(item.from), to: Number(item.to),
  })).filter((move) => move.clubId && move.name && Number.isInteger(move.from) && Number.isInteger(move.to) && move.from >= 1 && move.from <= DIVISIONS && move.to >= 1 && move.to <= DIVISIONS).slice(0, 4 * DIVISIONS);
}

type RankingOptions = { division: number; aiLeagues?: AiLeagues; ratingOf: (division: number, index: number) => number; rollScore: (strength: number, random: () => number) => number; random: () => number };

/** A double round robin between the five AI clubs of a league nobody plays in; the best come first. */
function simulateRanking({ division, aiLeagues, ratingOf, rollScore, random }: RankingOptions): string[] {
  const clubs = seasonClubsOf(division, aiLeagues);
  const rows = clubs.map((club) => ({ id: club.id, points: 0, goalsFor: 0, goalsAgainst: 0 }));
  for (let home = 0; home < rows.length; home++) for (let away = 0; away < rows.length; away++) {
    if (home === away) continue;
    const homeStrength = ratingOf(division, home) - ratingOf(division, away) + 1;
    const homeScore = rollScore(homeStrength, random), awayScore = rollScore(-homeStrength, random);
    rows[home].goalsFor += homeScore; rows[home].goalsAgainst += awayScore; rows[away].goalsFor += awayScore; rows[away].goalsAgainst += homeScore;
    if (homeScore > awayScore) rows[home].points += 3; else if (homeScore < awayScore) rows[away].points += 3; else { rows[home].points += 1; rows[away].points += 1; }
  }
  return rows.sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.id.localeCompare(b.id)).map((row) => row.id);
}

/**
 * The new league assignment after a finished season. `playerDivision` is the league the own club played in; its AI
 * clubs are ranked by the real table (`playerLeagueAiOrder`, best first). All other leagues are simulated once.
 * `places` clubs go up and `places` go down across every boundary; all movements are computed from the final tables
 * before any club moves, so nobody moves twice and every league keeps five AI clubs.
 */
export function advanceAiLeagues(options: { aiLeagues?: AiLeagues; playerDivision: number; playerLeagueAiOrder: string[]; places: number; ratingOf: RankingOptions["ratingOf"]; rollScore: RankingOptions["rollScore"]; random: () => number }) {
  const { aiLeagues, playerDivision, playerLeagueAiOrder, places } = options;
  if (places * 2 > AI_CLUBS_PER_LEAGUE) throw new Error("Auf und Abstieg dürfen sich in einer Liga nicht überschneiden.");
  const current: AiLeagues = {};
  for (const club of SEASON_CLUBS) current[club.id] = aiLeagues?.[club.id] ?? 16 - club.league;
  const next: AiLeagues = { ...current };
  const moves: AiMove[] = [];
  const nameOf = new Map(SEASON_CLUBS.map((club) => [club.id, club.name]));
  const members = (division: number) => new Set(seasonClubsOf(division, current).map((club) => club.id));
  for (let division = 1; division <= DIVISIONS; division++) {
    const real = division === playerDivision && playerLeagueAiOrder.length === AI_CLUBS_PER_LEAGUE && playerLeagueAiOrder.every((id) => members(division).has(id));
    const ranking = real ? playerLeagueAiOrder : simulateRanking({ division, aiLeagues: current, ratingOf: options.ratingOf, rollScore: options.rollScore, random: options.random });
    if (division < DIVISIONS) for (const id of ranking.slice(0, places)) { next[id] = division + 1; moves.push({ clubId: id, name: nameOf.get(id) ?? id, from: division, to: division + 1 }); }
    if (division > 1) for (const id of ranking.slice(-places)) { next[id] = division - 1; moves.push({ clubId: id, name: nameOf.get(id) ?? id, from: division, to: division - 1 }); }
  }
  return { aiLeagues: normalizeAiLeagues(next), moves };
}
