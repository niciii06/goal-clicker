import type { EarnedPack, EarnedPackId } from './feature-data';

/** One entry per claimer: "solo" in singleplayer, "world" for a whole shared world (older worlds kept one per seat role). */
export type DailyRewardEntry = { day: string; streak: number };
export type DailyRewardState = Record<string, DailyRewardEntry>;
export type DailyRewardDay = { day: number; minutes: number; floor: number; pack?: EarnedPackId; label: string };

export const DAILY_REWARD_TIME_ZONE = 'Europe/Zurich';
export const DAILY_REWARD_DAYS: readonly DailyRewardDay[] = [
  { day: 1, minutes: 5, floor: 500, label: 'Aufwärmen' },
  { day: 2, minutes: 10, floor: 1200, label: 'Trainingsplatz' },
  { day: 3, minutes: 15, floor: 2500, label: 'Taktikbesprechung' },
  { day: 4, minutes: 20, floor: 4000, label: 'Abschlusstraining' },
  { day: 5, minutes: 30, floor: 6500, label: 'Teambus' },
  { day: 6, minutes: 45, floor: 10000, label: 'Kabinenansprache' },
  { day: 7, minutes: 60, floor: 15000, pack: 'special', label: 'Matchday' },
];
/** A shared world claims once per day for everybody, under this key. */
export const WORLD_DAILY_KEY = 'world';
const ROLE_KEYS = ['host', 'guest', 'player3', 'player4'];
const DAILY_KEYS = new Set(['solo', WORLD_DAILY_KEY, ...ROLE_KEYS]);
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function zurichParts(now: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_REWARD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return { day: `${value('year')}-${value('month')}-${value('day')}`, hour: Number(value('hour')), minute: Number(value('minute')), second: Number(value('second')) };
}

export function getRewardDay(now = Date.now()) {
  return zurichParts(now).day;
}

export function getPreviousRewardDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date - 1)).toISOString().slice(0, 10);
}

/** How far the Zurich wall clock is ahead of UTC at a moment (one or two hours). */
function zurichOffset(at: number) {
  const { day, hour, minute, second } = zurichParts(at);
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date, hour, minute, second) - (at - (at % 1000));
}

/**
 * Milliseconds until the next midnight in Zurich, as an instant: on the days the clocks change the day has
 * 23 or 25 hours, so counting down from 24 hours would be an hour off.
 */
export function getMsUntilNextRewardDay(now = Date.now()) {
  const [year, month, date] = getRewardDay(now).split('-').map(Number);
  const midnight = Date.UTC(year, month - 1, date + 1);
  // The offset that applies at midnight decides the instant; one correction step settles it.
  let at = midnight - zurichOffset(now);
  at = midnight - zurichOffset(at);
  return Math.max(1000, at - now);
}

export function normalizeDailyRewards(value: unknown): DailyRewardState {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: DailyRewardState = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!DAILY_KEYS.has(key) || !raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.day !== 'string' || !DAY_PATTERN.test(entry.day)) continue;
    result[key] = { day: entry.day, streak: Math.max(1, Math.min(100000, Math.floor(Number(entry.streak) || 1))) };
  }
  return result;
}

/**
 * One shared reward for a world that still holds one entry per seat role (older saves). The claim day and the
 * streak are taken separately: if any role already claimed today, the world counts as claimed today, whichever
 * role has the longest streak; the streak is the longest one still alive on that day (claimed then or the day
 * before). Leaves a state that already has a world entry as it is.
 */
export function mergeDailyRewardsForWorld(state: DailyRewardState | undefined): DailyRewardState {
  const source = normalizeDailyRewards(state);
  if (source[WORLD_DAILY_KEY]) return { [WORLD_DAILY_KEY]: source[WORLD_DAILY_KEY] };
  const entries = ROLE_KEYS.map((key) => source[key]).filter((entry): entry is DailyRewardEntry => Boolean(entry));
  if (!entries.length) return {};
  const day = entries.map((entry) => entry.day).sort().at(-1)!;
  const before = getPreviousRewardDay(day);
  const alive = entries.filter((entry) => entry.day === day || entry.day === before);
  const streak = Math.max(...alive.map((entry) => entry.streak));
  return { [WORLD_DAILY_KEY]: { day, streak } };
}

export function getDailyRewardStatus(state: DailyRewardState | undefined, key: string, now = Date.now()) {
  const today = getRewardDay(now);
  const entry = state?.[key];
  const claimedToday = entry?.day === today;
  const continues = entry?.day === getPreviousRewardDay(today);
  const streak = claimedToday ? entry!.streak : continues ? entry!.streak + 1 : 1;
  const dayIndex = ((streak - 1) % DAILY_REWARD_DAYS.length) + 1;
  return { today, available: !claimedToday, claimedToday, streak, dayIndex, reward: DAILY_REWARD_DAYS[dayIndex - 1], broken: Boolean(entry) && !claimedToday && !continues, msUntilNext: getMsUntilNextRewardDay(now) };
}

export function getDailyRewardAmount(day: DailyRewardDay, passivePerSecond: number, clickPower: number) {
  const passive = Math.max(0, Number.isFinite(passivePerSecond) ? passivePerSecond : 0) * day.minutes * 60;
  const clicks = Math.max(0, Number.isFinite(clickPower) ? clickPower : 0) * day.minutes * 40;
  return Math.max(day.floor, Math.floor(Math.max(passive, clicks)));
}

export type DailyRewardClaim = { amount: number; dayIndex: number; streak: number; reward: DailyRewardDay; pack?: EarnedPack; state: DailyRewardState };

/** Pure claim: returns the next state, or null when today's reward was already collected. */
export function claimDailyReward(state: DailyRewardState | undefined, key: string, passivePerSecond: number, clickPower: number, now = Date.now()): DailyRewardClaim | null {
  if (!DAILY_KEYS.has(key)) return null;
  const status = getDailyRewardStatus(state, key, now);
  if (!status.available) return null;
  const amount = getDailyRewardAmount(status.reward, passivePerSecond, clickPower);
  const pack = status.reward.pack ? { id: `daily-${key}-${status.today}`, packId: status.reward.pack, earnedAt: now } : undefined;
  return { amount, dayIndex: status.dayIndex, streak: status.streak, reward: status.reward, pack, state: { ...(state ?? {}), [key]: { day: status.today, streak: status.streak } } };
}
