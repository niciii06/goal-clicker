// Co-op clicks are counted by the server: it limits how many clicks are physically possible and rolls the
// combo, the streak bonus and critical hits itself, so a client can only report how often the ball was clicked.
import { getComboLevel, decayComboCount } from "./game/economy";
import { COMBO_MAX_COUNT } from "./game/constants";

/** Per player: the last click batch, the combo and streak at that time, and the click budget. */
export type ServerClickState = { at: number; count: number; streak: number; budgetAt: number };

/** One click every 50 ms at most (20 per second), with up to 2.5 seconds of clicks saved up after a pause. */
export const CLICK_MIN_INTERVAL_MS = 50;
export const CLICK_BURST_MS = 2500;
/** Clicks of one batch were made up to this long before it arrived (batching and network). */
const BATCH_SLACK_MS = 600;
const STREAK_WINDOW_MS = 1200;
const CRITICAL_CHANCE = 0.02;

export function readServerClickState(value: unknown): ServerClickState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const number = (key: string) => Number.isFinite(Number(raw[key])) ? Number(raw[key]) : 0;
  return { at: number("at"), count: Math.max(0, Math.floor(number("count"))), streak: Math.max(0, Math.floor(number("streak"))), budgetAt: number("budgetAt") };
}

/**
 * Applies a batch of `requested` clicks at `now`. Returns how many clicks the budget allowed, the goals they
 * earn and the player's new click state. With no budget left nothing is accepted.
 */
export function applyServerClicks(previous: ServerClickState | null, requested: number, now: number, clickPower: number, random: () => number = Math.random) {
  const state = previous ?? { at: 0, count: 0, streak: 0, budgetAt: 0 };
  const budgetFrom = Math.max(state.budgetAt, now - CLICK_BURST_MS);
  const accepted = Math.max(0, Math.min(Math.floor(requested), Math.floor((now - budgetFrom) / CLICK_MIN_INTERVAL_MS)));
  if (!accepted) return { accepted: 0, amount: 0, state };
  const idle = Math.max(0, now - state.at - BATCH_SLACK_MS);
  let count = decayComboCount(state.count, idle);
  let streak = idle < STREAK_WINDOW_MS ? state.streak : 0;
  let amount = 0;
  for (let click = 0; click < accepted; click += 1) {
    count = Math.min(COMBO_MAX_COUNT, count + 1);
    streak += 1;
    const streakBonus = streak >= 5 ? 1 + Math.min(0.1, streak * 0.01) : 1;
    const critical = random() < CRITICAL_CHANCE;
    amount += Math.max(1, Math.floor(clickPower * getComboLevel(count).multiplier * streakBonus * (critical ? 2 : 1)));
  }
  return { accepted, amount, state: { at: now, count, streak, budgetAt: budgetFrom + accepted * CLICK_MIN_INTERVAL_MS } };
}
