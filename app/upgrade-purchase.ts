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

/** Every price is one of these steps times a power of ten (see CLAUDE.md, Balance). */
export const ROUND_PRICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8] as const;

/** The nearest round price (1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 / 7.5 / 8 times a power of ten); a tie rounds up. */
export function roundPrice(value: number) {
  if (!Number.isFinite(value)) return value;
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  let best = 10 * power;
  for (const step of [...ROUND_PRICE_STEPS].reverse()) {
    const candidate = step * power;
    if (Math.abs(value - candidate) < Math.abs(value - best)) best = candidate;
  }
  return best;
}

export function getUpgradeCostAtLevel(
  definition: UpgradeCostDefinition,
  level: number,
  maxMultiplierLevel = 8,
) {
  if (definition.kind === "multiplier" && level >= maxMultiplierLevel) return Infinity;
  // The exponential curve stays; every level's price is rounded to the round grid. Prices never fall with a level.
  return roundPrice(definition.baseCost * definition.scale ** level);
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
