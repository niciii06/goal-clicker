// Weekly goals (Wochenziele, decision of 6 November 2026): three goals per Zurich week, Monday to Sunday, for single
// player and co-op alike. They replace the four one-time co-op missions. Each goal counts a lifetime counter of the
// club against its value when the week started (the baseline, like career.growthBase), so nothing done before the
// week counts. Rewards are fragments or a reward pack for the best league reached, never goals; every goal pays once.
import { getMsUntilNextRewardDay, getRewardDay } from './daily-reward';
import { addHistory, getStarXIPlayer, getTournamentRewardPack, isRewardPack } from './feature-data';
import type { GameFeatures, RewardPackId } from './feature-data';
import { GROWTH_POINTS_PER_LEVEL, hasPotential } from './career-data';
import { getTournamentUnlockLeague, hasReachedLeague, leagueForTier } from './season-progression';
import { recordChroniclePackOpened } from './club-chronicle';

export const WEEKLY_METRICS = ['leagueWins', 'matchWins', 'cleanSheets', 'goalsScored', 'derbyWins', 'tournamentWins', 'packsOpened', 'minigameWins', 'specialGrowth', 'albumCards'] as const;
export type WeeklyMetric = (typeof WEEKLY_METRICS)[number];
export type WeeklyReward = { kind: 'fragments'; amount: number } | { kind: 'pack'; packId: RewardPackId };
export type WeeklyGoal = { id: string; metric: WeeklyMetric; target: number; reward: WeeklyReward };
/** `week`: the Monday of the Zurich week (YYYY-MM-DD). `baseline`: the counters when the week started; a counter
 * that was not known then (mini game wins outside the full game state) is filled in at the next chance. */
export type WeeklyGoalsState = { week: string; division: number; goals: WeeklyGoal[]; baseline: Partial<Record<WeeklyMetric, number>>; claimed: string[] };
export const WEEKLY_GOAL_COUNT = 3;

type MetricDefinition = { title: string; text: (n: number) => string; targets: readonly [number, number, number] };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Targets per difficulty (easy, medium, hard). A normal week of play (10 league matches take about 40 minutes) clears them. */
export const WEEKLY_METRIC_DEFINITIONS: Record<WeeklyMetric, MetricDefinition> = {
  leagueWins: { title: 'Ligasiege', text: (n) => `Gewinne ${plural(n, 'Ligaspiel', 'Ligaspiele')}.`, targets: [2, 3, 5] },
  matchWins: { title: 'Siegeswoche', text: (n) => `Gewinne ${plural(n, 'Pflichtspiel', 'Pflichtspiele')} in Liga oder Turnier.`, targets: [3, 5, 7] },
  cleanSheets: { title: 'Zu Null', text: (n) => `Spiele ${n === 1 ? 'einmal' : `${n} Mal`} zu Null.`, targets: [1, 2, 3] },
  goalsScored: { title: 'Torhunger', text: (n) => `Erziele ${plural(n, 'Tor', 'Tore')} in Pflichtspielen.`, targets: [6, 10, 15] },
  derbyWins: { title: 'Derbytag', text: (n) => `Gewinne ${plural(n, 'Derby', 'Derbys')} gegen einen Rivalen.`, targets: [1, 1, 2] },
  tournamentWins: { title: 'Pokalnächte', text: (n) => `Gewinne ${plural(n, 'Turnierspiel', 'Turnierspiele')}.`, targets: [2, 3, 5] },
  packsOpened: { title: 'Packfieber', text: (n) => `Öffne ${plural(n, 'Pack', 'Packs')}.`, targets: [2, 4, 6] },
  minigameWins: { title: 'Trainingsplatz', text: (n) => `Gewinne ${plural(n, 'Minispiel', 'Minispiele')}.`, targets: [2, 4, 6] },
  specialGrowth: { title: 'Wachstumsschub', text: (n) => `Sammle ${plural(n, 'Wachstumspunkt', 'Wachstumspunkte')} mit deinen Spezialkarten.`, targets: [6, 10, 15] },
  albumCards: { title: 'Sammlerwoche', text: (n) => `Bringe ${plural(n, 'neue Karte', 'neue Karten')} ins Sammelalbum.`, targets: [2, 3, 5] },
};

/** Fragments for the easy and the medium goal by the best league reached; the hard goal pays a reward pack. */
export function getWeeklyFragmentRewards(highestDivision: number): readonly [number, number] {
  const league = leagueForTier(highestDivision);
  return league >= 11 ? [300, 600] : league >= 6 ? [500, 1000] : [750, 1500];
}

/** The Monday (YYYY-MM-DD) of the Zurich week of a moment; the week starts at midnight from Sunday to Monday. */
export function getWeekKey(now = Date.now()) {
  const [year, month, day] = getRewardDay(now).split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return new Date(Date.UTC(year, month - 1, day - weekday)).toISOString().slice(0, 10);
}
/** ISO calendar week of a week key, for "KW 45". */
export function getWeekNumber(weekKey: string) {
  const [year, month, day] = weekKey.split('-').map(Number);
  const thursday = new Date(Date.UTC(year, month - 1, day + 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7);
}
/** Milliseconds until the next Monday in Zurich (exact to the day change, at most an hour off on clock change days). */
export function getMsUntilNextWeek(now = Date.now()) {
  const [year, month, day] = getRewardDay(now).split('-').map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return getMsUntilNextRewardDay(now) + (6 - weekday) * 86400000;
}

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type CounterFeatures = Pick<GameFeatures, 'chronicle' | 'career' | 'starXI' | 'seasonMode'>;
function specialGrowthPoints(features: CounterFeatures) {
  let points = 0;
  for (const [id, stats] of Object.entries(features.career.players)) {
    const player = getStarXIPlayer(id);
    if (player && hasPotential(player)) points += Math.max(0, Math.floor(stats.points));
  }
  return points;
}
/** The lifetime counters the goals compare; `minigameWins` lives outside the features and may be unknown. */
export function getWeeklyCounters(features: CounterFeatures, minigameWins?: number): Partial<Record<WeeklyMetric, number>> {
  const t = features.chronicle.totals;
  return {
    leagueWins: t.leagueWins, matchWins: t.wins, cleanSheets: t.cleanSheets, goalsScored: t.goalsFor, derbyWins: t.derbyWins, tournamentWins: t.tournamentWins, packsOpened: t.packsOpened,
    ...(Number.isFinite(minigameWins) ? { minigameWins: Math.max(0, Math.floor(minigameWins!)) } : {}),
    specialGrowth: specialGrowthPoints(features),
    albumCards: new Set(features.career.collectedIds).size,
  };
}

/** Goals that can be reached from where the club stands at the start of the week. */
function availableMetrics(features: CounterFeatures): WeeklyMetric[] {
  const reached = leagueForTier(features.seasonMode.highestDivision);
  return WEEKLY_METRICS.filter((metric) => {
    if (metric === 'leagueWins') return !features.seasonMode.hallOfFame;
    if (metric === 'tournamentWins') return hasReachedLeague(getTournamentUnlockLeague('stadium'), reached);
    if (metric === 'derbyWins') return Object.values(features.career.rivals).some((rival) => rival.active);
    if (metric === 'specialGrowth') return features.starXI.ownedIds.some((id) => { const p = getStarXIPlayer(id); return Boolean(p && hasPotential(p)) && (features.career.players[id]?.points ?? 0) - (features.career.growthBase[id]?.points ?? 0) < GROWTH_POINTS_PER_LEVEL * ((p!.potential ?? p!.rating) - p!.rating); });
    return true;
  });
}

/** The three goals of a week, the same for everybody with the same week and best league (and what is available). */
export function generateWeeklyGoals(week: string, features: CounterFeatures): WeeklyGoal[] {
  const division = features.seasonMode.highestDivision;
  const random = seededRandom(`${week}|${division}`);
  const pool = availableMetrics(features);
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const [easy, medium] = getWeeklyFragmentRewards(division);
  const pack = getTournamentRewardPack('cup', division).id as RewardPackId;
  return pool.slice(0, WEEKLY_GOAL_COUNT).map((metric, tier) => ({
    id: `${week}:${tier + 1}:${metric}`, metric, target: WEEKLY_METRIC_DEFINITIONS[metric].targets[tier],
    reward: tier === 0 ? { kind: 'fragments', amount: easy } : tier === 1 ? { kind: 'fragments', amount: medium } : { kind: 'pack', packId: pack },
  }));
}

const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export function normalizeWeeklyGoals(value: unknown): WeeklyGoalsState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.week !== 'string' || !WEEK_PATTERN.test(source.week)) return undefined;
  const goals = (Array.isArray(source.goals) ? source.goals : []).slice(0, WEEKLY_GOAL_COUNT).map((raw): WeeklyGoal | null => {
    const g = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const metric = WEEKLY_METRICS.find((m) => m === g.metric);
    const reward = g.reward && typeof g.reward === 'object' ? g.reward as Record<string, unknown> : {};
    if (!metric || typeof g.id !== 'string' || !g.id.startsWith(`${source.week}:`)) return null;
    const target = Math.max(1, Math.min(1000, Math.floor(Number(g.target) || 1)));
    if (reward.kind === 'pack' && typeof reward.packId === 'string' && isRewardPack(reward.packId)) return { id: g.id.slice(0, 80), metric, target, reward: { kind: 'pack', packId: reward.packId } };
    if (reward.kind === 'fragments') return { id: g.id.slice(0, 80), metric, target, reward: { kind: 'fragments', amount: Math.max(0, Math.min(10000, Math.floor(Number(reward.amount) || 0))) } };
    return null;
  }).filter((g): g is WeeklyGoal => Boolean(g));
  const baselineSource = source.baseline && typeof source.baseline === 'object' ? source.baseline as Record<string, unknown> : {};
  const baseline: Partial<Record<WeeklyMetric, number>> = {};
  for (const metric of WEEKLY_METRICS) if (Number.isFinite(Number(baselineSource[metric])) && baselineSource[metric] !== null) baseline[metric] = Math.max(0, Math.floor(Number(baselineSource[metric])));
  const ids = new Set(goals.map((g) => g.id));
  const claimed = Array.isArray(source.claimed) ? [...new Set(source.claimed.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [];
  return { week: source.week, division: Math.max(1, Math.min(15, Math.floor(Number(source.division) || 1))), goals, baseline, claimed };
}

/**
 * Starts the current week when needed: new goals and the baseline of every counter. Within a week it only fills in
 * a counter that was unknown, and lowers a baseline whose counter fell below it (so progress never gets stuck).
 * A clock that runs behind never takes the club back to an older week. Returns whether anything changed.
 */
export function ensureWeeklyGoals(features: GameFeatures, now = Date.now(), minigameWins?: number) {
  const week = getWeekKey(now);
  const counters = getWeeklyCounters(features, minigameWins);
  const current = features.weekly;
  if (!current || current.week < week) {
    features.weekly = { week, division: features.seasonMode.highestDivision, goals: generateWeeklyGoals(week, features), baseline: counters, claimed: [] };
    return true;
  }
  let changed = false;
  const baseline = { ...current.baseline };
  for (const metric of WEEKLY_METRICS) {
    const value = counters[metric];
    if (value === undefined) continue;
    if (baseline[metric] === undefined || value < baseline[metric]!) { baseline[metric] = value; changed = true; }
  }
  if (changed) features.weekly = { ...current, baseline };
  return changed;
}

/** Whether ensureWeeklyGoals would change anything, without touching the state (cheap enough for a timer). */
export function weeklyGoalsNeedUpdate(features: GameFeatures, now = Date.now(), minigameWins?: number) {
  const current = features.weekly;
  if (!current || current.week < getWeekKey(now)) return true;
  const counters = getWeeklyCounters(features, minigameWins);
  return WEEKLY_METRICS.some((metric) => counters[metric] !== undefined && (current.baseline[metric] === undefined || counters[metric]! < current.baseline[metric]!));
}

/** A pack was opened (shop, reward or special card pack): the week starts first, so the pack counts for it. */
export function notePackOpened(features: GameFeatures, now = Date.now()) {
  ensureWeeklyGoals(features, now);
  recordChroniclePackOpened(features);
}

export function getWeeklyGoalProgress(state: WeeklyGoalsState, goal: WeeklyGoal, counters: Partial<Record<WeeklyMetric, number>>) {
  const value = counters[goal.metric], base = state.baseline[goal.metric];
  if (value === undefined || base === undefined) return 0;
  return Math.max(0, Math.min(goal.target, value - base));
}

export type WeeklyGoalView = WeeklyGoal & { title: string; description: string; progress: number; complete: boolean; claimed: boolean };
export function getWeeklyGoalViews(features: GameFeatures, minigameWins?: number): WeeklyGoalView[] {
  const state = features.weekly;
  if (!state) return [];
  const counters = getWeeklyCounters(features, minigameWins);
  return state.goals.map((goal) => {
    const progress = getWeeklyGoalProgress(state, goal, counters);
    return { ...goal, title: WEEKLY_METRIC_DEFINITIONS[goal.metric].title, description: WEEKLY_METRIC_DEFINITIONS[goal.metric].text(goal.target), progress, complete: progress >= goal.target, claimed: state.claimed.includes(goal.id) };
  });
}

export function weeklyRewardLabel(reward: WeeklyReward) {
  return reward.kind === 'fragments' ? `${reward.amount.toLocaleString('de-CH')} Fragmente` : getTournamentRewardPackLabel(reward.packId);
}
function getTournamentRewardPackLabel(packId: RewardPackId) {
  for (let division = 1; division <= 15; division += 1) { const pack = getTournamentRewardPack('cup', division); if (pack.id === packId) return pack.label; }
  return 'Prämienpack';
}

export type WeeklyClaim = { ok: true; goal: WeeklyGoalView; label: string } | { ok: false; error: string; status: number };
/**
 * Pays one finished goal of the current week once. The claim list belongs to the week and every goal id carries its
 * week, so a repeated or late request (also from another seat) is refused instead of paying again.
 */
export function claimWeeklyGoal(features: GameFeatures, goalId: string, now = Date.now(), minigameWins?: number): WeeklyClaim {
  ensureWeeklyGoals(features, now, minigameWins);
  const state = features.weekly!;
  const goal = getWeeklyGoalViews(features, minigameWins).find((g) => g.id === goalId);
  if (!goal) return { ok: false, error: 'Dieses Wochenziel gehört zu einer vergangenen Woche.', status: 409 };
  if (goal.claimed) return { ok: false, error: 'Dieses Wochenziel wurde bereits abgeholt.', status: 409 };
  if (!goal.complete) return { ok: false, error: 'Dieses Wochenziel ist noch nicht erreicht.', status: 409 };
  features.weekly = { ...state, claimed: [...state.claimed, goal.id] };
  if (goal.reward.kind === 'fragments') features.starXI = { ...features.starXI, fragments: features.starXI.fragments + goal.reward.amount };
  else {
    const id = `weekly-${goal.id}`;
    if (!features.earnedPacks.some((pack) => pack.id === id)) features.earnedPacks = [...features.earnedPacks, { id, packId: goal.reward.packId, earnedAt: now }];
  }
  const label = weeklyRewardLabel(goal.reward);
  addHistory(features, { title: `Wochenziel erreicht: ${goal.title}`, detail: goal.reward.kind === 'pack' ? `${label} liegt unter Packs & Album bereit.` : `+${label}`, tone: 'positive' }, now);
  return { ok: true, goal, label };
}
