export type UpgradeCostDefinition = {
  baseCost: number;
  scale: number;
  kind: string;
};

type BulkPurchaseOptions = {
  unlimitedMoney?: boolean;
  maxMultiplierLevel?: number;
  maxBulkCount?: number;
};

export function getUpgradeCostAtLevel(
  definition: UpgradeCostDefinition,
  level: number,
  maxMultiplierLevel = 8,
) {
  if (definition.kind === "multiplier" && level >= maxMultiplierLevel) return Infinity;
  return Math.floor(definition.baseCost * definition.scale ** level);
}

export function calculateBulkUpgradePurchase(
  definition: UpgradeCostDefinition,
  currentLevel: number,
  goals: number,
  requestedCount: number | "max",
  options: BulkPurchaseOptions = {},
) {
  const maxMultiplierLevel = options.maxMultiplierLevel ?? 8;
  const maxBulkCount = options.maxBulkCount ?? 1000;
  const requestedLimit = requestedCount === "max"
    ? maxBulkCount
    : Math.max(1, Math.min(maxBulkCount, Math.floor(Number(requestedCount)) || 1));

  // AZB purchases do not have a monetary price. Do not calculate enormous
  // exponential costs here: at high test levels those intentionally overflow
  // to Infinity and used to block every further upgrade.
  if (options.unlimitedMoney) {
    const count = definition.kind === "multiplier"
      ? Math.max(0, Math.min(requestedLimit, maxMultiplierLevel - currentLevel))
      : requestedLimit;
    return { count, totalCost: 0 };
  }

  let count = 0;
  let totalCost = 0;
  while (count < requestedLimit) {
    const cost = getUpgradeCostAtLevel(definition, currentLevel + count, maxMultiplierLevel);
    if (!Number.isFinite(cost) || totalCost + cost > goals) break;
    totalCost += cost;
    count += 1;
  }
  return { count, totalCost };
}
