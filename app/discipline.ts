// Yellow card accumulation and one-match suspensions.
// League: every third yellow card in one league season bans a player for the next league match.
// Tournaments: every second yellow card in one tournament run bans a player for the next match of
// that tournament. Each competition keeps its own count; nothing is ever moved between them.
// The yellow card events of the match engine stay the only source; a match is processed once.
import { getStarXIPlayer, getTournament } from './feature-data';
import type { CupState, GameFeatures, TournamentId } from './feature-data';
import { pronounText } from './player-pronouns';

export const LEAGUE_YELLOW_LIMIT = 3;
export const TOURNAMENT_YELLOW_LIMIT = 2;
const PROCESSED_LIMIT = 200;
const TOURNAMENT_IDS: readonly TournamentId[] = ['stadium', 'champions', 'world'];

export type Competition = 'league' | `tournament:${TournamentId}`;
export type SuspensionBan = { id: string; playerId: string; competition: Competition; matches: number; yellowCards: number; createdAt: number; sourceMatchId: string };
export type DisciplineState = {
  version: 1;
  /** Yellow cards in the current league season, per player. Reset when a league season ends. */
  league: Record<string, number>;
  /** Yellow cards in the current run of each tournament. Reset when that run ends. */
  tournaments: Partial<Record<TournamentId, Record<string, number>>>;
  bans: SuspensionBan[];
  processedMatchIds: string[];
};

export function emptyDiscipline(): DisciplineState {
  return { version: 1, league: {}, tournaments: {}, bans: [], processedMatchIds: [] };
}

function counts(value: unknown) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([id, n]) => getStarXIPlayer(id) && Number.isFinite(Number(n)) && Number(n) > 0).map(([id, n]) => [id, Math.min(99, Math.floor(Number(n)))]));
}
function isCompetition(value: unknown): value is Competition {
  return value === 'league' || (typeof value === 'string' && TOURNAMENT_IDS.some(id => value === `tournament:${id}`));
}

/** Old saves have no disciplinary record: tracking starts now, nothing is inferred backwards. */
export function normalizeDiscipline(value: unknown): DisciplineState {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const tournaments: DisciplineState['tournaments'] = {};
  const savedTournaments = source.tournaments && typeof source.tournaments === 'object' ? source.tournaments as Record<string, unknown> : {};
  for (const id of TOURNAMENT_IDS) { const run = counts(savedTournaments[id]); if (Object.keys(run).length) tournaments[id] = run; }
  const bans = (Array.isArray(source.bans) ? source.bans : []).flatMap((raw): SuspensionBan[] => {
    const b = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const matches = Math.floor(Number(b.matches));
    if (typeof b.playerId !== 'string' || !getStarXIPlayer(b.playerId) || !isCompetition(b.competition) || !(matches >= 1)) return [];
    return [{ id: typeof b.id === 'string' ? b.id.slice(0, 240) : `${b.competition}:${b.playerId}`, playerId: b.playerId, competition: b.competition, matches: Math.min(10, matches), yellowCards: Math.max(0, Math.floor(Number(b.yellowCards) || 0)), createdAt: Number(b.createdAt) || 0, sourceMatchId: typeof b.sourceMatchId === 'string' ? b.sourceMatchId.slice(0, 240) : '' }];
  }).slice(-100);
  const processedMatchIds = Array.isArray(source.processedMatchIds) ? [...new Set(source.processedMatchIds.filter((id): id is string => typeof id === 'string').map(id => id.slice(0, 240)))].slice(-PROCESSED_LIMIT) : [];
  return { version: 1, league: counts(source.league), tournaments, bans, processedMatchIds };
}

export function competitionFor(mode: 'season' | 'tournament', tournamentId: TournamentId): Competition {
  return mode === 'season' ? 'league' : `tournament:${tournamentId}`;
}
export function competitionOfCup(cup: Pick<CupState, 'mode' | 'tournamentId'>): Competition {
  return competitionFor(cup.mode === 'season' ? 'season' : 'tournament', cup.tournamentId);
}
/** The competition of the next match the squad prepares for: a pending tournament round, else the league. */
export function nextCompetition(features: GameFeatures): Competition {
  return features.cup.pendingNextRound ? `tournament:${features.cup.tournamentId}` : 'league';
}
export function competitionLabel(competition: Competition) {
  if (competition === 'league') return 'Liga';
  return getTournament(competition.slice('tournament:'.length))?.label ?? 'Turnier';
}
export function yellowLimit(competition: Competition) {
  return competition === 'league' ? LEAGUE_YELLOW_LIMIT : TOURNAMENT_YELLOW_LIMIT;
}

export function getBans(features: GameFeatures, playerId?: string) {
  return features.discipline.bans.filter(ban => !playerId || ban.playerId === playerId);
}
export function getBannedPlayerIds(features: GameFeatures, competition: Competition) {
  return [...new Set(features.discipline.bans.filter(ban => ban.competition === competition).map(ban => ban.playerId))];
}
/** Players in the matchday squad (starting eleven or bench) who are banned for this competition. */
export function getSquadBanConflicts(features: GameFeatures, competition: Competition) {
  const banned = new Set(getBannedPlayerIds(features, competition));
  return [...features.starXI.lineupIds, ...features.starXI.benchIds].filter(id => id && banned.has(id));
}
export function squadBanError(features: GameFeatures, competition: Competition) {
  const conflicts = getSquadBanConflicts(features, competition);
  if (!conflicts.length) return null;
  const names = conflicts.map(id => getStarXIPlayer(id)?.name ?? 'Ein Spieler').join(', ');
  return `${names} ${conflicts.length === 1 ? 'ist' : 'sind'} nach Gelben Karten für dieses Spiel gesperrt. Ersetze ${conflicts.length === 1 ? pronounText('{ihn}', getStarXIPlayer(conflicts[0])) : 'sie'} in Startelf und Bank.`;
}

/** Short German label, for example "Gesperrt – 1 Spiel (3 Gelbe Karten) · Liga". */
export function suspensionLabel(ban: SuspensionBan) {
  return `Gesperrt – ${ban.matches} ${ban.matches === 1 ? 'Spiel' : 'Spiele'} (${ban.yellowCards} Gelbe Karten) · ${competitionLabel(ban.competition)}`;
}

/** Yellow cards toward the next ban per competition, for warnings such as "2/3 Gelbe Karten". */
export function yellowCardStatus(features: GameFeatures, playerId: string) {
  const rows: { competition: Competition; label: string; count: number; limit: number }[] = [];
  const league = features.discipline.league[playerId] ?? 0;
  if (league % LEAGUE_YELLOW_LIMIT) rows.push({ competition: 'league', label: 'Liga', count: league % LEAGUE_YELLOW_LIMIT, limit: LEAGUE_YELLOW_LIMIT });
  for (const id of TOURNAMENT_IDS) {
    const n = features.discipline.tournaments[id]?.[playerId] ?? 0;
    if (n % TOURNAMENT_YELLOW_LIMIT) rows.push({ competition: `tournament:${id}`, label: competitionLabel(`tournament:${id}`), count: n % TOURNAMENT_YELLOW_LIMIT, limit: TOURNAMENT_YELLOW_LIMIT });
  }
  return rows;
}

/** Yellow cards of our own players that count toward accumulation. Two yellows in one match
 * already produce a red card and its own suspension, so they do not count a second time. */
export function countableYellowCards(cup: CupState) {
  const yellow = (cup.broadcast?.events ?? []).filter(e => e.kind === 'yellow' && e.side === 'club' && getStarXIPlayer(e.playerId));
  const perPlayer = new Map<string, number>();
  for (const e of yellow) perPlayer.set(e.playerId, (perPlayer.get(e.playerId) ?? 0) + 1);
  for (const [id, n] of perPlayer) if (n >= 2 && cup.sentOffPlayerIds.includes(id)) perPlayer.delete(id);
  return perPlayer;
}

/**
 * Applies the disciplinary consequences of one completed match. Order matters:
 * first the match serves existing bans of its competition, then its own yellow cards
 * may create new bans (which therefore apply to the following match).
 */
export function processMatchDiscipline(features: GameFeatures, matchId: string, now: number, options: { seasonCompleted?: boolean } = {}) {
  const d = features.discipline, cup = features.cup;
  if (!matchId || d.processedMatchIds.includes(matchId)) return [] as SuspensionBan[];
  const competition = competitionOfCup(cup);
  const played = new Set(Object.keys(cup.playerEnteredAt ?? {}));
  d.bans = d.bans.flatMap(ban => ban.competition !== competition || played.has(ban.playerId) ? [ban] : ban.matches > 1 ? [{ ...ban, matches: ban.matches - 1 }] : []);
  const tournamentId = competition === 'league' ? null : cup.tournamentId;
  const tally = tournamentId ? (d.tournaments[tournamentId] ??= {}) : d.league;
  const limit = yellowLimit(competition), created: SuspensionBan[] = [];
  for (const [playerId, cards] of countableYellowCards(cup)) {
    const before = tally[playerId] ?? 0, after = before + cards;
    tally[playerId] = after;
    const earned = Math.floor(after / limit) - Math.floor(before / limit);
    if (earned > 0) created.push({ id: `${matchId}:${playerId}`, playerId, competition, matches: earned, yellowCards: limit, createdAt: now, sourceMatchId: matchId });
  }
  d.bans = [...d.bans, ...created];
  // Lifecycle: a league season resets the league count (bans still carry into the next league match).
  // A finished tournament run resets its count and its unserved bans expire with it.
  if (competition === 'league' && options.seasonCompleted) d.league = {};
  if (tournamentId && !cup.pendingNextRound) { delete d.tournaments[tournamentId]; d.bans = d.bans.filter(ban => ban.competition !== competition); }
  d.processedMatchIds = [...d.processedMatchIds, matchId].slice(-PROCESSED_LIMIT);
  return created.filter(ban => d.bans.some(b => b.id === ban.id));
}
