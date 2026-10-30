// A greedy club that always buys the upgrade with the shortest payback, used to balance
// upgrade gains and pack prices against the league in which they unlock.
import { UPGRADES } from "../../app/game/upgrades";
import { getBaseClickPower, getBasePassivePower, getCostAtLevel } from "../../app/game/economy";
import { getUpgradeUnlockLeague, LEAGUE_COUNT } from "../../app/season-progression";
import { resolveRandomEvent, resolveVarEvent } from "../../app/feature-data";

/** `startGoals`: what the first clicks earn before the club runs on passive income alone. */
export type EconomyOptions = { clicksPerSecond?: number; minutesPerLeague?: number; startGoals?: number };
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
export function simulateEconomy({ clicksPerSecond = 0, minutesPerLeague = 45, startGoals = 60 }: EconomyOptions = {}) {
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
      let best: { id: string; cost: number; payback: number } | null = null;
      for (const upgrade of UPGRADES) {
        if (getUpgradeUnlockLeague(upgrade.id) < league) continue;
        const cost = getCostAtLevel(upgrade, levels[upgrade.id] ?? 0);
        if (!Number.isFinite(cost)) continue;
        const gain = getIncomePerSecond({ ...levels, [upgrade.id]: (levels[upgrade.id] ?? 0) + 1 }, clicksPerSecond) - income;
        const payback = gain > 0 ? cost / gain : Infinity;
        if (!best || payback < best.payback) best = { id: upgrade.id, cost, payback };
      }
      if (!best || best.cost > goals) break;
      goals -= best.cost;
      levels[best.id] = (levels[best.id] ?? 0) + 1;
      income = getIncomePerSecond(levels, clicksPerSecond);
    }
  }
  return snapshots;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Typical minutes (median of `runs`) to save `price` at `incomePerSecond`, with the VAR and the random events
 * hitting the balance every 1 to 3 minutes as in the game (`resolveVarEvent`, `resolveRandomEvent`).
 */
export function medianSavingMinutes(incomePerSecond: number, price: number, runs = 301, seed = 7) {
  if (!(incomePerSecond > 0)) return Infinity;
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
  return minutes[Math.floor(runs / 2)];
}
