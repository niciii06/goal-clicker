// Shopping hints: what the next level of an upgrade adds, which upgrade pays back fastest and how long the club
// still has to save. They only read the economy; prices and effects stay exactly as they are.
import type { GameFeatures } from "../feature-data";
import type { UpgradeDefinition } from "../game/types";
import { getBaseClickPower, getBasePassivePower, getCost, getLevel } from "../game/economy";

export type UpgradeGain = { id: string; cost: number; passiveGain: number; clickGain: number; paybackSeconds: number | null };

/** Goals per second and per click the next level adds (before temporary boosts and Prestige, like the shop shows). */
export function nextLevelGain(upgrade: UpgradeDefinition, upgrades: Record<string, number>, stars: number, features?: GameFeatures): UpgradeGain {
  const cost = getCost(upgrade, upgrades);
  const next = { ...upgrades, [upgrade.id]: getLevel(upgrades, upgrade.id) + 1 };
  const passiveGain = Math.max(0, getBasePassivePower(next, stars, features) - getBasePassivePower(upgrades, stars, features));
  const clickGain = Math.max(0, getBaseClickPower(next, stars, features) - getBaseClickPower(upgrades, stars, features));
  return { id: upgrade.id, cost, passiveGain, clickGain, paybackSeconds: Number.isFinite(cost) && passiveGain > 0 ? cost / passiveGain : null };
}

/** The upgrade whose next level pays back its price fastest through passive income; null without any. */
export function bestValueUpgrade(gains: readonly UpgradeGain[]) {
  let best: UpgradeGain | null = null;
  for (const gain of gains) {
    if (gain.paybackSeconds === null) continue;
    if (!best || gain.paybackSeconds < best.paybackSeconds!) best = gain;
  }
  return best?.id ?? null;
}

/** Seconds of passive income until `cost` is reached; 0 when already affordable, null without income. */
export function secondsUntilAffordable(cost: number, goals: number, passivePerSecond: number) {
  if (!Number.isFinite(cost)) return null;
  const missing = cost - goals;
  if (missing <= 0) return 0;
  if (!(passivePerSecond > 0)) return null;
  return missing / passivePerSecond;
}

/** "ca. 3 min", "ca. 2 h 10 min", "über 2 Tage"; rounded up, so the estimate never promises too early. */
export function formatEta(seconds: number | null) {
  if (seconds === null) return "";
  if (seconds <= 0) return "jetzt";
  if (seconds < 60) return `ca. ${Math.ceil(seconds)} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `ca. ${minutes} min`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  if (hours >= 48) return `über ${Math.floor(hours / 24)} Tage`;
  return rest ? `ca. ${hours} h ${rest} min` : `ca. ${hours} h`;
}

/** "noch 12,4K · ca. 3 min" for a price the club cannot pay yet; empty when it can. */
export function savingsHint(cost: number, goals: number, passivePerSecond: number, format: (value: number) => string) {
  const seconds = secondsUntilAffordable(cost, goals, passivePerSecond);
  if (seconds === 0 || !Number.isFinite(cost)) return "";
  const eta = formatEta(seconds);
  return `noch ${format(cost - goals)}${eta ? ` · ${eta}` : ""}`;
}

/** Payback as short text: "zahlt sich in ca. 4 min aus". */
export function paybackLabel(gain: UpgradeGain) {
  return gain.paybackSeconds === null ? "" : `zahlt sich in ${formatEta(gain.paybackSeconds)} aus`;
}
