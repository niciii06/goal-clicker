// Club chronicle and record hall (decision of 6 November 2026): lifetime totals of the club, its records, one archive
// row per finished season, dated titles and the final Hall of Fame table of every Prestige run. Everything is written
// on the existing match paths (recordCareerMatch, completeTournamentRun, recordTicketIncome, applySeasonPrestige), in
// single player and on the co-op server alike, and is history only: nothing here changes a rule or a reward.
import type { CareerState } from './career-data';
import type { SeasonMatchHistoryEntry, SeasonTableRow } from './features/types';

/** Lifetime counters of the club. They only grow (Prestige keeps them); the weekly goals count their differences. */
export type ChronicleTotals = {
  matches: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number;
  leagueWins: number; tournamentWins: number; cleanSheets: number; derbyWins: number; packsOpened: number;
};
export const CHRONICLE_TOTAL_KEYS = ['matches', 'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'leagueWins', 'tournamentWins', 'cleanSheets', 'derbyWins', 'packsOpened'] as const satisfies readonly (keyof ChronicleTotals)[];

/** One remarkable match: `value` is what the record compares (goal margin, goals, spectators). */
export type ChronicleMatchRecord = { value: number; score: string; opponent: string; competition: string; at: number; prestige: number };
/** A run of matches: `current` is the running one, `best` the longest so far and when it was last extended. */
export type ChronicleStreak = { current: number; best: number; bestAt: number };
export type ChronicleRecords = {
  biggestWin: ChronicleMatchRecord | null;
  mostGoals: ChronicleMatchRecord | null;
  recordCrowd: ChronicleMatchRecord | null;
  unbeaten: ChronicleStreak;
  winning: ChronicleStreak;
};
/** One finished season. `place`, `points` and the record are missing for seasons derived from older saves. */
export type SeasonArchiveRow = {
  id: string; season: number; prestige: number | null; division: number; place: number | null; points: number | null;
  wins: number | null; draws: number | null; losses: number | null; goalsFor: number | null; goalsAgainst: number | null;
  outcome: SeasonMatchHistoryEntry['seasonOutcome']; topScorer: { playerId: string; goals: number } | null; bestPlayerId: string | null; at: number;
};
export type ChronicleTitleKind = 'tournament' | 'league' | 'hall-of-fame';
export type ChronicleTitle = { id: string; kind: ChronicleTitleKind; label: string; at: number; prestige: number; tournamentId?: string };
export type HallOfFameTableRow = { name: string; club: boolean; points: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number };
export type HallOfFameTable = { prestige: number; at: number; rows: HallOfFameTableRow[] };
export type ClubChronicle = { totals: ChronicleTotals; records: ChronicleRecords; seasons: SeasonArchiveRow[]; titles: ChronicleTitle[]; hallOfFame: HallOfFameTable[] };

export const CHRONICLE_SEASON_LIMIT = 200;
export const CHRONICLE_TITLE_LIMIT = 200;
export const CHRONICLE_HALL_OF_FAME_LIMIT = 50;

/** The few parts of the game the chronicle reads and writes; GameFeatures fits it. */
export type ChronicleHost = { chronicle: ClubChronicle; seasonMode: { prestigeCount: number; hallOfFame: boolean; lastTable: SeasonTableRow[] } };

export function emptyChronicleTotals(): ChronicleTotals {
  return { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, leagueWins: 0, tournamentWins: 0, cleanSheets: 0, derbyWins: 0, packsOpened: 0 };
}
export function emptyChronicle(): ClubChronicle {
  return { totals: emptyChronicleTotals(), records: { biggestWin: null, mostGoals: null, recordCrowd: null, unbeaten: { current: 0, best: 0, bestAt: 0 }, winning: { current: 0, best: 0, bestAt: 0 } }, seasons: [], titles: [], hallOfFame: [] };
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function count(value: unknown, max = 1e12) { const n = Math.floor(Number(value)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0; }
function optionalCount(value: unknown, max = 1e9) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? null : count(value, max); }
function text(value: unknown, max: number, fallback = '') { return typeof value === 'string' && value.trim() ? value.slice(0, max) : fallback; }
const SEASON_OUTCOMES = new Set(['promoted', 'relegated', 'stayed', 'hall-of-fame']);

function normalizeMatchRecord(value: unknown): ChronicleMatchRecord | null {
  const v = object(value);
  if (!Number.isFinite(Number(v.value)) || typeof v.opponent !== 'string') return null;
  return { value: count(v.value, 1e7), score: text(v.score, 24), opponent: text(v.opponent, 60, 'Unbekannter Gegner'), competition: text(v.competition, 80), at: count(v.at, 1e15), prestige: count(v.prestige, 1e4) };
}
function normalizeStreak(value: unknown): ChronicleStreak {
  const v = object(value), current = count(v.current, 1e6);
  return { current, best: Math.max(current, count(v.best, 1e6)), bestAt: count(v.bestAt, 1e15) };
}
function normalizeSeasonRow(value: unknown, index: number): SeasonArchiveRow | null {
  const v = object(value);
  const division = count(v.division, 15);
  if (!division) return null;
  const scorer = object(v.topScorer);
  return {
    id: text(v.id, 120, `season-${index}`), season: Math.max(1, count(v.season, 1e6)), prestige: optionalCount(v.prestige, 1e4), division,
    place: optionalCount(v.place, 6), points: optionalCount(v.points, 99), wins: optionalCount(v.wins, 99), draws: optionalCount(v.draws, 99), losses: optionalCount(v.losses, 99),
    goalsFor: optionalCount(v.goalsFor, 999), goalsAgainst: optionalCount(v.goalsAgainst, 999),
    outcome: SEASON_OUTCOMES.has(String(v.outcome)) ? v.outcome as SeasonArchiveRow['outcome'] : null,
    topScorer: typeof scorer.playerId === 'string' && scorer.playerId ? { playerId: scorer.playerId.slice(0, 80), goals: count(scorer.goals, 999) } : null,
    bestPlayerId: typeof v.bestPlayerId === 'string' && v.bestPlayerId ? v.bestPlayerId.slice(0, 80) : null,
    at: count(v.at, 1e15),
  };
}
function normalizeTableRow(value: unknown): HallOfFameTableRow | null {
  const v = object(value);
  if (typeof v.name !== 'string') return null;
  return { name: text(v.name, 42, 'Unbekannt'), club: v.club === true, points: count(v.points, 99), wins: count(v.wins, 99), draws: count(v.draws, 99), losses: count(v.losses, 99), goalsFor: count(v.goalsFor, 999), goalsAgainst: count(v.goalsAgainst, 999) };
}

/**
 * The stored chronicle, or for an older save one derived from what it already holds: club records from the last
 * match reports, and an archive row (league, season, top scorer, best player) from each season award. Places,
 * points, totals and titles were never recorded, so they stay empty rather than being guessed.
 */
export function normalizeChronicle(value: unknown, career?: Pick<CareerState, 'reports' | 'awards'>): ClubChronicle {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return career ? deriveChronicle(career) : emptyChronicle();
  const source = object(value), totalsSource = object(source.totals), records = object(source.records);
  const totals = emptyChronicleTotals();
  for (const key of CHRONICLE_TOTAL_KEYS) totals[key] = count(totalsSource[key]);
  return {
    totals,
    records: { biggestWin: normalizeMatchRecord(records.biggestWin), mostGoals: normalizeMatchRecord(records.mostGoals), recordCrowd: normalizeMatchRecord(records.recordCrowd), unbeaten: normalizeStreak(records.unbeaten), winning: normalizeStreak(records.winning) },
    seasons: (Array.isArray(source.seasons) ? source.seasons : []).slice(-CHRONICLE_SEASON_LIMIT).map(normalizeSeasonRow).filter((row): row is SeasonArchiveRow => Boolean(row)),
    titles: (Array.isArray(source.titles) ? source.titles : []).slice(-CHRONICLE_TITLE_LIMIT).map(object).filter((t) => typeof t.label === 'string' && (t.kind === 'tournament' || t.kind === 'league' || t.kind === 'hall-of-fame')).map((t, index) => ({
      id: text(t.id, 120, `title-${index}`), kind: t.kind as ChronicleTitleKind, label: text(t.label, 80, 'Titel'), at: count(t.at, 1e15), prestige: count(t.prestige, 1e4),
      ...(typeof t.tournamentId === 'string' ? { tournamentId: t.tournamentId.slice(0, 40) } : {}),
    })),
    hallOfFame: (Array.isArray(source.hallOfFame) ? source.hallOfFame : []).slice(-CHRONICLE_HALL_OF_FAME_LIMIT).map(object).map((t) => ({
      prestige: count(t.prestige, 1e4), at: count(t.at, 1e15),
      rows: (Array.isArray(t.rows) ? t.rows : []).slice(0, 12).map(normalizeTableRow).filter((row): row is HallOfFameTableRow => Boolean(row)),
    })).filter((t) => t.rows.length > 0),
  };
}

function deriveChronicle(career: Pick<CareerState, 'reports' | 'awards'>): ClubChronicle {
  const chronicle = emptyChronicle();
  for (const report of career.reports) {
    const competition = report.competition ?? (report.mode === 'season' ? 'Liga' : 'Turnier');
    noteMatchRecords(chronicle.records, { opponent: report.opponent, homeScore: report.homeScore, awayScore: report.awayScore, competition, at: report.createdAt, prestige: 0, penaltyScore: report.penaltyScore });
    if (report.tickets) noteCrowd(chronicle.records, report.tickets.attendance, report.opponent, competition, report.createdAt, 0);
  }
  chronicle.seasons = career.awards.map((award) => ({
    id: `derived-${award.id}`.slice(0, 120), season: award.seasonNumber, prestige: null, division: award.division, place: null, points: null, wins: null, draws: null, losses: null, goalsFor: null, goalsAgainst: null, outcome: null,
    topScorer: award.scorer ? { playerId: award.scorer.playerId, goals: count(Number.parseInt(award.scorer.value, 10)) } : null,
    bestPlayerId: award.best?.playerId ?? null, at: award.createdAt,
  }));
  return chronicle;
}

type MatchFacts = { opponent: string; homeScore: number; awayScore: number; competition: string; at: number; prestige: number; penaltyScore?: string };
const scoreLabel = (m: MatchFacts) => `${m.homeScore}:${m.awayScore}${m.penaltyScore ? ` (${m.penaltyScore} i.E.)` : ''}`;
function noteMatchRecords(records: ChronicleRecords, m: MatchFacts) {
  const record = (value: number): ChronicleMatchRecord => ({ value, score: scoreLabel(m), opponent: m.opponent.slice(0, 60), competition: m.competition.slice(0, 80), at: m.at, prestige: m.prestige });
  const margin = m.homeScore - m.awayScore;
  // Equal records stay with the first club to set them; a bigger win with more goals breaks a tie on the margin.
  const best = records.biggestWin;
  if (margin > 0 && (!best || margin > best.value || (margin === best.value && m.homeScore > Number.parseInt(best.score, 10)))) records.biggestWin = record(margin);
  if (m.homeScore > 0 && (!records.mostGoals || m.homeScore > records.mostGoals.value)) records.mostGoals = record(m.homeScore);
}
function noteCrowd(records: ChronicleRecords, attendance: number, opponent: string, competition: string, at: number, prestige: number) {
  const value = count(attendance, 1e7);
  if (value > 0 && (!records.recordCrowd || value > records.recordCrowd.value)) records.recordCrowd = { value, score: '', opponent: opponent.slice(0, 60), competition: competition.slice(0, 80), at, prestige };
}
function extend(streak: ChronicleStreak, continues: boolean, at: number) {
  streak.current = continues ? streak.current + 1 : 0;
  if (streak.current > streak.best) { streak.best = streak.current; streak.bestAt = at; }
}

export type ChronicleMatch = MatchFacts & { mode: 'season' | 'tournament'; won: boolean; draw: boolean; derby: boolean };
/** One finished competitive match (called once per match, behind the career receipt in recordCareerMatch). */
export function recordChronicleMatch(host: ChronicleHost, match: ChronicleMatch) {
  const { totals, records } = host.chronicle;
  const lost = !match.won && !match.draw;
  totals.matches += 1;
  totals.wins += Number(match.won);
  totals.draws += Number(match.draw);
  totals.losses += Number(lost);
  totals.goalsFor += match.homeScore;
  totals.goalsAgainst += match.awayScore;
  if (match.won && match.mode === 'season') totals.leagueWins += 1;
  if (match.won && match.mode === 'tournament') totals.tournamentWins += 1;
  if (match.awayScore === 0) totals.cleanSheets += 1;
  if (match.won && match.derby) totals.derbyWins += 1;
  noteMatchRecords(records, match);
  extend(records.unbeaten, !lost, match.at);
  extend(records.winning, match.won, match.at);
}

/** The spectators of a home match with ticket income. */
export function recordChronicleCrowd(host: ChronicleHost, attendance: number, opponent: string, competition: string, at: number) {
  noteCrowd(host.chronicle.records, attendance, opponent, competition, at, host.seasonMode.prestigeCount);
}

export function recordChroniclePackOpened(host: Pick<ChronicleHost, 'chronicle'>) {
  host.chronicle.totals.packsOpened += 1;
}

function addTitle(host: ChronicleHost, title: Omit<ChronicleTitle, 'prestige'>) {
  if (host.chronicle.titles.some((t) => t.id === title.id)) return;
  host.chronicle.titles = [...host.chronicle.titles, { ...title, prestige: host.seasonMode.prestigeCount }].slice(-CHRONICLE_TITLE_LIMIT);
}
export function recordChronicleTournamentTitle(host: ChronicleHost, runId: string, tournamentId: string, label: string, at: number) {
  addTitle(host, { id: `tournament:${runId}`, kind: 'tournament', label, at, tournamentId });
}

const tableRow = (row: SeasonTableRow): HallOfFameTableRow => ({ name: row.name.slice(0, 42), club: row.id === 'club', points: row.points, wins: row.wins, draws: row.draws, losses: row.losses, goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst });
function archiveHallOfFameTable(host: ChronicleHost, table: readonly SeasonTableRow[], at: number) {
  const prestige = host.seasonMode.prestigeCount;
  if (!table.length || host.chronicle.hallOfFame.some((t) => t.prestige === prestige)) return;
  host.chronicle.hallOfFame = [...host.chronicle.hallOfFame, { prestige, at, rows: table.map(tableRow) }].slice(-CHRONICLE_HALL_OF_FAME_LIMIT);
}

export type ChronicleSeason = { id: string; entry: SeasonMatchHistoryEntry; season: number; topScorer: { playerId: string; goals: number } | null; bestPlayerId: string | null; at: number; leagueLabel: string };
/** A finished season: its archive row, a title for first place, and the final table when it reached the Hall of Fame. */
export function recordChronicleSeason(host: ChronicleHost, s: ChronicleSeason) {
  const table = s.entry.finalTable ?? [];
  const clubIndex = table.findIndex((row) => row.id === 'club');
  const club = clubIndex >= 0 ? table[clubIndex] : null;
  const row: SeasonArchiveRow = {
    id: s.id.slice(0, 120), season: s.season, prestige: host.seasonMode.prestigeCount, division: s.entry.division, place: club ? clubIndex + 1 : null,
    points: club?.points ?? null, wins: club?.wins ?? null, draws: club?.draws ?? null, losses: club?.losses ?? null, goalsFor: club?.goalsFor ?? null, goalsAgainst: club?.goalsAgainst ?? null,
    outcome: s.entry.seasonOutcome, topScorer: s.topScorer, bestPlayerId: s.bestPlayerId, at: s.at,
  };
  if (host.chronicle.seasons.some((r) => r.id === row.id)) return;
  host.chronicle.seasons = [...host.chronicle.seasons, row].slice(-CHRONICLE_SEASON_LIMIT);
  if (s.entry.seasonOutcome === 'hall-of-fame') {
    addTitle(host, { id: `hall-of-fame:${row.id}`, kind: 'hall-of-fame', label: 'Hall of Fame', at: s.at });
    archiveHallOfFameTable(host, table, s.at);
  } else if (row.place === 1) addTitle(host, { id: `league:${row.id}`, kind: 'league', label: `Meister ${s.leagueLabel}`, at: s.at });
}

/**
 * Prestige ends a run: the final Hall of Fame table still shown in the season (lastTable) is archived for this run,
 * unless the season's completion already did. This also covers a Hall of Fame reached before the chronicle existed.
 */
export function archiveHallOfFameBeforePrestige(host: ChronicleHost, at: number) {
  if (host.seasonMode.hallOfFame) archiveHallOfFameTable(host, host.seasonMode.lastTable, at);
}
