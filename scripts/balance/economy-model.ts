// A greedy club that always buys the upgrade with the shortest payback, used to balance
// upgrade gains and pack prices against the league in which they unlock.
import { UPGRADES } from "../../app/game/upgrades";
import { getBaseClickPower, getBasePassivePower, getCostAtLevel } from "../../app/game/economy";
import { getUpgradeUnlockLeague, LEAGUE_COUNT } from "../../app/season-progression";
import { resolveRandomEvent, resolveVarEvent } from "../../app/feature-data";

/** Combo x2, streak up to x1.1 and on average 2% critical hits (x2): what a player with a full combo earns per click. */
export const FULL_COMBO_FACTOR = 2 * 1.1 * 1.02;
export type PurchaseRecord = { id: string; level: number; league: number; cost: number; gain: number; payback: number };
/**
 * `clicksPerSecond`: effective clicks per second of the whole club (see `activeClicks`).
 * `startGoals`: what the first clicks earn before the club runs on its income.
 */
export type EconomyOptions = { clicksPerSecond?: number; minutesPerLeague?: number; startGoals?: number; onPurchase?: (record: PurchaseRecord) => void };

/** Effective clicks per second of `players` active players clicking `perPlayer` times a second with a full combo. */
export function activeClicks(perPlayer: number, players = 1) {
  return perPlayer * players * FULL_COMBO_FACTOR;
}
/** `incomePerSecond` at the start of the league, `averageIncomePerSecond` over the whole league. */
export type LeagueSnapshot = { league: number; incomePerSecond: number; averageIncomePerSecond: number; goals: number; levels: Record<string, number> };

export function getIncomePerSecond(levels: Record<string, number>, clicksPerSecond: number) {
  return getBasePassivePower(levels) + getBaseClickPower(levels) * clicksPerSecond;
}

/** Payback in seconds of the first level of an upgrade for an empty club office. */
export function getFirstLevelPayback(id: string, clicksPerSecond = 0) {
  const upgrade = UPGRADES.find((item) => item.id === id)!;
  const gain = getIncomePerSecond({ [id]: 1 }, clicksPerSecond) - getIncomePerSecond({}, clicksPerSecond);
  return gain > 0 ? getCostAtLevel(upgrade, 0) / gain : Infinity;
}

/** Income at the start of every league, from Liga 15 down to Liga 1. */
// Default: passive income only. The first Balljunge (60 goals) comes from a few clicks, then no more clicks.
export function simulateEconomy({ clicksPerSecond = 0, minutesPerLeague = 45, startGoals = 60, onPurchase }: EconomyOptions = {}) {
  const levels: Record<string, number> = {};
  const snapshots: LeagueSnapshot[] = [];
  let goals = startGoals;
  let income = getIncomePerSecond(levels, clicksPerSecond);
  const secondsPerLeague = minutesPerLeague * 60;
  for (let second = 0; second < LEAGUE_COUNT * secondsPerLeague; second += 1) {
    const league = LEAGUE_COUNT - Math.floor(second / secondsPerLeague);
    if (second % secondsPerLeague === 0) snapshots.push({ league, incomePerSecond: income, averageIncomePerSecond: 0, goals, levels: { ...levels } });
    goals += income;
    snapshots[snapshots.length - 1].averageIncomePerSecond += income / secondsPerLeague;
    for (;;) {
      let best: { id: string; cost: number; gain: number; payback: number } | null = null;
      for (const upgrade of UPGRADES) {
        if (getUpgradeUnlockLeague(upgrade.id) < league) continue;
        const cost = getCostAtLevel(upgrade, levels[upgrade.id] ?? 0);
        if (!Number.isFinite(cost)) continue;
        const gain = getIncomePerSecond({ ...levels, [upgrade.id]: (levels[upgrade.id] ?? 0) + 1 }, clicksPerSecond) - income;
        const payback = gain > 0 ? cost / gain : Infinity;
        if (!best || payback < best.payback) best = { id: upgrade.id, cost, gain, payback };
      }
      if (!best || best.cost > goals) break;
      goals -= best.cost;
      levels[best.id] = (levels[best.id] ?? 0) + 1;
      onPurchase?.({ id: best.id, level: levels[best.id], league, cost: best.cost, gain: best.gain, payback: best.payback });
      income = getIncomePerSecond(levels, clicksPerSecond);
    }
  }
  return snapshots;
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Minutes to save `price` at `incomePerSecond` over `runs` seeded runs, with the VAR and the random events
 * hitting the balance every 1 to 3 minutes as in the game (`resolveVarEvent`, `resolveRandomEvent`).
 * `median` is the typical wait, `p90` the wait that one run in ten exceeds.
 */
export function savingMinutes(incomePerSecond: number, price: number, runs = 301, seed = 7) {
  if (!(incomePerSecond > 0)) return { median: Infinity, p90: Infinity };
  const random = seededRandom(seed);
  const minutes = Array.from({ length: runs }, () => {
    let goals = 0, second = 0, nextVar = 60 + random() * 120, nextEvent = 60 + random() * 120;
    while (goals < price && second < 24 * 3600) {
      second += 1;
      goals += incomePerSecond;
      if (second >= nextVar) { goals = Math.max(0, goals + resolveVarEvent(goals, random()).amount); nextVar = second + 60 + random() * 120; }
      if (second >= nextEvent) { goals = Math.max(0, goals + resolveRandomEvent(goals, random()).amount); nextEvent = second + 60 + random() * 120; }
    }
    return second / 60;
  }).sort((first, second) => first - second);
  return { median: minutes[Math.floor(runs / 2)], p90: minutes[Math.floor(runs * 0.9)] };
}

/** Typical minutes (median) to save `price`, see `savingMinutes`. */
export function medianSavingMinutes(incomePerSecond: number, price: number, runs = 301, seed = 7) {
  return savingMinutes(incomePerSecond, price, runs, seed).median;
}

export type ClickLevelReport = { level: number; cost: number; gainOneClick: number; gainThreeClicks: number; payback: number };
/**
 * Levels 1 to `levels` of a click upgrade bought one after the other at the start of `league`, for a club that
 * clicked three times a second with a full combo until then. The gain is what the level really adds after the
 * share caps, at one and at three clicks a second with a full combo; the payback uses the three clicks.
 */
export function clickUpgradeReport(id: string, league: number, levels = 8): ClickLevelReport[] {
  const upgrade = UPGRADES.find((item) => item.id === id)!;
  const base = { ...simulateEconomy({ clicksPerSecond: activeClicks(3) }).find((snapshot) => snapshot.league === league)!.levels };
  const start = base[id] ?? 0;
  return Array.from({ length: levels }, (_, index) => {
    const before = { ...base, [id]: start + index }, after = { ...base, [id]: start + index + 1 };
    const gain = (clicks: number) => getIncomePerSecond(after, activeClicks(clicks)) - getIncomePerSecond(before, activeClicks(clicks));
    const cost = getCostAtLevel(upgrade, start + index);
    return { level: start + index + 1, cost, gainOneClick: gain(1), gainThreeClicks: gain(3), payback: cost / gain(3) };
  });
}
