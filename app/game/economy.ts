// Upgrade costs, click and passive power, ranks and the click combo.
import type { GameFeatures } from "../feature-data";
import type { PurchaseMode, UpgradeDefinition } from "./types";
import { COMBO_DECAY_MS, COMBO_HOLD_MS, COMBO_LEVELS, MAX_MULTIPLIER_LEVEL, MAX_SEASON_STARS, RANKS } from "./constants";
import { calculateBulkUpgradePurchase, getUpgradeCostAtLevel } from "../upgrade-purchase";
import { addHistory, getGoalBoostMultiplier, getTransferBonuses } from "../feature-data";
import { UPGRADES, getUpgrade } from "./upgrades";

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

/** Sum of level times gain over every upgrade of one kind, straight from the catalogue. */
function getFlatGain(upgrades: Record<string, number>, kind: UpgradeDefinition["kind"]) {
  return UPGRADES.reduce((total, upgrade) => upgrade.kind === kind ? total + getLevel(upgrades, upgrade.id) * upgrade.gain : total, 0);
}

function getMultiplierFactor(upgrades: Record<string, number>, id: string) {
  return (1 + (getUpgrade(id)?.gain ?? 0)) ** Math.min(MAX_MULTIPLIER_LEVEL, getLevel(upgrades, id));
}

export function getIncomeMultiplier(upgrades: Record<string, number>, stars: number) {
  return (1 + Math.min(MAX_SEASON_STARS, Math.max(0, stars)) * 0.02) * getMultiplierFactor(upgrades, "legacy");
}

export function getBaseClickPower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures) {
  const flat = 1 + getFlatGain(upgrades, "click");
  const transfer = getTransferBonuses(features?.transferMarket.ownedIds ?? []);
  return (flat + transfer.clickBonus) * getMultiplierFactor(upgrades, "golden") * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

export function getClickPower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures, now = Date.now()) {
  return getBaseClickPower(upgrades, stars, features) * getGoalBoostMultiplier(features, now);
}

export function getBasePassivePower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures) {
  const base = getFlatGain(upgrades, "auto");
  const transfer = getTransferBonuses(features?.transferMarket.ownedIds ?? []);
  return (base + transfer.passiveBonus) * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

export function getPassivePower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures, now = Date.now()) {
  return getBasePassivePower(upgrades, stars, features) * getGoalBoostMultiplier(features, now);
}

/** Feature schema of the league economy rebalance: older saves had their goals capped once on load. */
export const REBALANCED_FEATURES_SCHEMA = 7;
const REBALANCE_GOAL_CAP_SECONDS = 3600;
const REBALANCE_MIN_GOALS = 1_000_000;

/**
 * Goals saved under the old economy are capped once to one hour of passive income at the new rates,
 * so a stockpile cannot skip the new pack prices. `rawFeatures` is the stored, not yet normalized
 * features object; total and season goals stay untouched.
 */
export function capGoalsAfterRebalance(goals: number, rawFeatures: unknown, upgrades: Record<string, number>, stars: number, features: GameFeatures) {
  const raw = rawFeatures && typeof rawFeatures === "object" && !Array.isArray(rawFeatures) ? rawFeatures as Record<string, unknown> : {};
  if ((Number(raw.schemaVersion) || 0) >= REBALANCED_FEATURES_SCHEMA) return goals;
  const cap = Math.max(REBALANCE_MIN_GOALS, Math.floor(getBasePassivePower(upgrades, stars, features) * REBALANCE_GOAL_CAP_SECONDS));
  if (!(goals > cap)) return goals;
  addHistory(features, { title: "Kontostand angepasst", detail: `${Math.floor(goals).toLocaleString("de-CH")} Tore auf ${cap.toLocaleString("de-CH")} gekürzt (eine Stunde Einkommen nach dem Balance Update).`, tone: "neutral" });
  return cap;
}

export function getUpgradeEffect(upgrade: UpgradeDefinition, level: number) {
  const effectiveLevel = Math.min(level, MAX_MULTIPLIER_LEVEL);
  if (upgrade.id === "golden") return `Stufe ${effectiveLevel}: x${((1 + upgrade.gain) ** effectiveLevel).toFixed(2)} Klickpower`;
  if (upgrade.id === "legacy") return `Stufe ${effectiveLevel}: x${((1 + upgrade.gain) ** effectiveLevel).toFixed(2)} alle Einnahmen`;
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
