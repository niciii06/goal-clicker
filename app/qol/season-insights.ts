// Season tab helpers (Q47 to Q49): form guide, what promotion still needs, top scorers of the running season. All
// read the table the game itself uses (sortSeasonTable: points, goal difference, goals, then head to head).
import type { SeasonResult, SeasonTableRow } from "../feature-data";
import { SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, SEASON_PROMOTION_PLACES, SEASON_RELEGATION_PLACES, sortSeasonTable } from "../feature-data";

export type FormLetter = "S" | "U" | "N";

/** One finished match of a team's form guide: what the form box stands for. */
export type FormMatch = { letter: FormLetter; matchday: number; home: boolean; homeId: string; awayId: string; homeScore: number; awayScore: number; opponentId: string };

/** The last five matches of a team, oldest first, with everything a form box needs to show its match. */
export function formMatches(teamId: string, results: readonly SeasonResult[], count = 5): FormMatch[] {
  return results.filter((result) => result.homeId === teamId || result.awayId === teamId)
    .sort((a, b) => a.matchday - b.matchday)
    .slice(-count)
    .map((result) => {
      const home = result.homeId === teamId, own = home ? result.homeScore : result.awayScore, other = home ? result.awayScore : result.homeScore;
      return { letter: own > other ? "S" : own < other ? "N" : "U", matchday: result.matchday, home, homeId: result.homeId, awayId: result.awayId, homeScore: result.homeScore, awayScore: result.awayScore, opponentId: home ? result.awayId : result.homeId };
    });
}

/** S/U/N of the last five matches of a team, oldest first. */
export function formGuide(teamId: string, results: readonly SeasonResult[], count = 5): FormLetter[] {
  return formMatches(teamId, results, count).map((match) => match.letter);
}

/** "Spieltag 5 · Auswärts · FC Luzern 1:2 FC Goal": the match behind one form box, from the real result only. */
export function formMatchLabel(match: FormMatch, nameOf: (teamId: string) => string) {
  return `Spieltag ${match.matchday} · ${match.home ? "Heim" : "Auswärts"} · ${nameOf(match.homeId)} ${match.homeScore}:${match.awayScore} ${nameOf(match.awayId)}`;
}

/**
 * One line on the club's chances: "Aufstieg sicher", "3 Punkte Rückstand auf Platz 2 · noch 4 Spiele",
 * "Abstiegsplatz · 2 Punkte bis Platz 4". Only points count as sure; ties are left open, because goal difference,
 * goals and head to head can still change.
 */
export function promotionOutlook(table: readonly SeasonTableRow[], results: readonly SeasonResult[], division: number) {
  const rows = sortSeasonTable(table, results);
  const index = rows.findIndex((team) => team.id === "club");
  if (index < 0) return "";
  const club = rows[index];
  const left = Math.max(0, SEASON_MODE_MATCHES_PER_SEASON - club.played);
  const maxOf = (team: SeasonTableRow) => team.points + 3 * Math.max(0, SEASON_MODE_MATCHES_PER_SEASON - team.played);
  const top = division >= SEASON_MODE_DIVISION_COUNT;
  const spots = top ? 1 : SEASON_PROMOTION_PLACES;
  const games = left === 1 ? "noch 1 Spiel" : `noch ${left} Spiele`;
  const goal = top ? "Hall of Fame" : "Aufstieg";
  // Sure: fewer than `spots` other teams can still reach the club's points.
  const chasers = rows.filter((team) => team.id !== "club" && maxOf(team) >= club.points).length;
  if (chasers < spots) return `${goal} sicher`;
  if (index < spots) return `${goal}splatz · ${games}`;
  const target = rows[spots - 1];
  const gap = target.points - club.points;
  if (maxOf(club) < target.points) return `${goal} nicht mehr möglich · ${games}`;
  const relegation = division > 1 && index >= rows.length - SEASON_RELEGATION_PLACES;
  const safe = rows[rows.length - SEASON_RELEGATION_PLACES - 1];
  if (relegation && safe) return `Abstiegsplatz · ${Math.max(0, safe.points - club.points)} ${safe.points - club.points === 1 ? "Punkt" : "Punkte"} bis Platz ${rows.length - SEASON_RELEGATION_PLACES} · ${games}`;
  return `${gap} ${gap === 1 ? "Punkt" : "Punkte"} Rückstand auf Platz ${spots} · ${games}`;
}

/** The best scorers of the running season from the season statistics (career.seasonPlayers). */
export function seasonTopScorers(seasonPlayers: Record<string, { goals: number; assists: number; appearances: number }>, limit = 5) {
  return Object.entries(seasonPlayers).filter(([, stats]) => stats.goals > 0)
    .sort(([, a], [, b]) => b.goals - a.goals || b.assists - a.assists || a.appearances - b.appearances)
    .slice(0, limit).map(([playerId, stats]) => ({ playerId, goals: stats.goals, assists: stats.assists, appearances: stats.appearances }));
}
