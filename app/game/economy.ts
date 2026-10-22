// Upgrade costs, click and passive power, ranks and the click combo.
import type { GameFeatures } from "../feature-data";
import type { PurchaseMode, UpgradeDefinition } from "./types";
import { COMBO_DECAY_MS, COMBO_HOLD_MS, COMBO_LEVELS, MAX_MULTIPLIER_LEVEL, MAX_SEASON_STARS, RANKS } from "./constants";
import { calculateBulkUpgradePurchase, getUpgradeCostAtLevel } from "../upgrade-purchase";
import { getGoalBoostMultiplier, getTransferBonuses } from "../feature-data";

export function getLevel(upgrades: Record<string, number>, id: string) {
  return upgrades[id] ?? 0;
}

export function getCostAtLevel(definition: UpgradeDefinition, level: number) {
  return getUpgradeCostAtLevel(definition, level, MAX_MULTIPLIER_LEVEL);
}

export function getCost(definition: UpgradeDefinition, upgrades: Record<string, number>) {
  return getCostAtLevel(definition, getLevel(upgrades, definition.id));
}

export function getBulkPurchase(definition: UpgradeDefinition, upgrades: Record<string, number>, goals: number, mode: PurchaseMode, unlimitedMoney = false) {
  return calculateBulkUpgradePurchase(definition, getLevel(upgrades, definition.id), goals, mode, {
    unlimitedMoney,
    maxMultiplierLevel: MAX_MULTIPLIER_LEVEL,
  });
}

export function getIncomeMultiplier(upgrades: Record<string, number>, stars: number) {
  return (1 + Math.min(MAX_SEASON_STARS, Math.max(0, stars)) * 0.02) * 1.05 ** Math.min(MAX_MULTIPLIER_LEVEL, getLevel(upgrades, "legacy"));
}

export function getBasePassivePower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures) {
  const base = getLevel(upgrades, "ballboy") + getLevel(upgrades, "coach") * 15 + getLevel(upgrades, "academy") * 60 + getLevel(upgrades, "floodlight") * 300 + getLevel(upgrades, "scout") * 1200 + getLevel(upgrades, "var") * 10000 + getLevel(upgrades, "stadium") * 50000 + getLevel(upgrades, "broadcast") * 250000 + getLevel(upgrades, "sponsor") * 1200000 + getLevel(upgrades, "superclub") * 6000000;
  const transfer = getTransferBonuses(features?.transferMarket.ownedIds ?? []);
  return (base + transfer.passiveBonus) * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

export function getPassivePower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures, now = Date.now()) {
  return getBasePassivePower(upgrades, stars, features) * getGoalBoostMultiplier(features, now);
}

export function getUpgradeEffect(upgrade: UpgradeDefinition, level: number) {
  const effectiveLevel = Math.min(level, MAX_MULTIPLIER_LEVEL);
  if (upgrade.id === "golden") return `Stufe ${effectiveLevel}: x${(1.1 ** effectiveLevel).toFixed(2)} Klickpower`;
  if (upgrade.id === "legacy") return `Stufe ${effectiveLevel}: x${(1.05 ** effectiveLevel).toFixed(2)} alle Einnahmen`;
  return `${upgrade.description} · Stufe ${level}`;
}

export function normalizeUpgrades(value: unknown) {
  const upgrades = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const normalized: Record<string, number> = {};
  for (const [id, value] of Object.entries(upgrades)) {
    const level = Math.max(0, Math.floor(Number(value) || 0));
    normalized[id] = id === "golden" || id === "legacy" ? Math.min(MAX_MULTIPLIER_LEVEL, level) : level;
  }
  return normalized;
}

export function getRank(totalGoals: number) {
  let current = RANKS[0];
  for (const rank of RANKS) if (totalGoals >= rank.minimum) current = rank;
  return current;
}

export function getComboLevel(count: number) {
  let level: (typeof COMBO_LEVELS)[number] = COMBO_LEVELS[0];
  for (const item of COMBO_LEVELS) if (count >= item.clicks) level = item;
  return level;
}

/** The combo left after `idleMs` without a click: the hold, then one click less for every COMBO_DECAY_MS. */
export function decayComboCount(count: number, idleMs: number) {
  const lost = Math.floor(Math.max(0, idleMs - COMBO_HOLD_MS) / COMBO_DECAY_MS);
  return Math.max(0, count - lost);
}

/** "x1,5" in the German number format. */
export function formatComboMultiplier(multiplier: number) {
  return `x${String(multiplier).replace(".", ",")}`;
}

export function getComboProgress(count: number) {
  const level = getComboLevel(count), next = COMBO_LEVELS.find((item) => item.clicks > count);
  return next ? (count - level.clicks) / (next.clicks - level.clicks) : 1;
}

export function createClickResult(clickPower: number, lastClick: number, currentStreak: number) {
  const now = Date.now();
  const streak = now - lastClick < 1200 ? currentStreak + 1 : 1;
  const streakBonus = streak >= 5 ? 1 + Math.min(0.1, streak * 0.01) : 1;
  const critical = Math.random() < 0.02;
  const amount = Math.max(1, Math.floor(clickPower * streakBonus * (critical ? 2 : 1)));
  return { now, streak, critical, amount, effectId: now + Math.random() };
}
