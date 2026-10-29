// A greedy club that always buys the upgrade with the shortest payback, used to balance
// upgrade gains and pack prices against the league in which they unlock.
import { UPGRADES } from "../../app/game/upgrades";
import { getBaseClickPower, getBasePassivePower, getCostAtLevel } from "../../app/game/economy";
import { getUpgradeUnlockLeague, LEAGUE_COUNT } from "../../app/season-progression";

export type EconomyOptions = { clicksPerSecond?: number; minutesPerLeague?: number };
/** `incomePerSecond` at the start of the league, `averageIncomePerSecond` over the whole league. */
export type LeagueSnapshot = { league: number; incomePerSecond: number; averageIncomePerSecond: number; goals: number; levels: Record<string, number> };

export function getIncomePerSecond(levels: Record<string, number>, clicksPerSecond: number) {
  return getBasePassivePower(levels) + getBaseClickPower(levels) * clicksPerSecond;
}

/** Payback in seconds of the first level of an upgrade for an empty club office. */
export function getFirstLevelPayback(id: string, clicksPerSecond = 4) {
  const upgrade = UPGRADES.find((item) => item.id === id)!;
  const gain = getIncomePerSecond({ [id]: 1 }, clicksPerSecond) - getIncomePerSecond({}, clicksPerSecond);
  return gain > 0 ? getCostAtLevel(upgrade, 0) / gain : Infinity;
}

/** Income at the start of every league, from Liga 15 down to Liga 1. */
export function simulateEconomy({ clicksPerSecond = 4, minutesPerLeague = 45 }: EconomyOptions = {}) {
  const levels: Record<string, number> = {};
  const snapshots: LeagueSnapshot[] = [];
  let goals = 0;
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
