import type { EarnedPack, RewardPackId } from './feature-data';

/** One entry per claimer: "solo" in singleplayer, the seat role in a shared world. */
export type DailyRewardEntry = { day: string; streak: number };
export type DailyRewardState = Record<string, DailyRewardEntry>;
export type DailyRewardDay = { day: number; minutes: number; floor: number; pack?: RewardPackId; label: string };

export const DAILY_REWARD_TIME_ZONE = 'Europe/Zurich';
export const DAILY_REWARD_DAYS: readonly DailyRewardDay[] = [
  { day: 1, minutes: 5, floor: 500, label: 'Aufwärmen' },
  { day: 2, minutes: 10, floor: 1200, label: 'Trainingsplatz' },
  { day: 3, minutes: 15, floor: 2500, label: 'Taktikbesprechung' },
  { day: 4, minutes: 20, floor: 4000, label: 'Abschlusstraining' },
  { day: 5, minutes: 30, floor: 6500, label: 'Teambus' },
  { day: 6, minutes: 45, floor: 10000, label: 'Kabinenansprache' },
  { day: 7, minutes: 60, floor: 15000, pack: 'reward-2', label: 'Matchday' },
];
const DAILY_KEYS = new Set(['solo', 'host', 'guest', 'player3', 'player4']);
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

/** Milliseconds until the next midnight in Zurich. */
export function getMsUntilNextRewardDay(now = Date.now()) {
  const { hour, minute, second } = zurichParts(now);
  return Math.max(1000, (24 * 3600 - (hour * 3600 + minute * 60 + second)) * 1000 - (now % 1000));
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
