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

/** Base prices and pack prices are one of these steps times a power of ten (see CLAUDE.md, Balance). */
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

/** A price with at most two significant digits: mantissa times ten to the exponent, both integers. */
type TwoDigitPrice = { mantissa: number; exponent: number };

function priceValue({ mantissa, exponent }: TwoDigitPrice) {
  // Built from the decimal text, so 1.2e26 is exactly the double nearest to 12e25, never 1.2000000000000001e26.
  return Number(`${mantissa}e${exponent}`);
}

/** Rounds a positive value to two significant digits; below 100 that is a whole number of at least 1. */
function toTwoDigitPrice(value: number): TwoDigitPrice {
  if (value < 99.5) return { mantissa: Math.max(1, Math.round(value)), exponent: 0 };
  const [digits, power] = value.toExponential(1).split("e");
  return { mantissa: Math.round(Number(digits) * 10), exponent: Number(power) - 1 };
}

/** The next price with at most two significant digits above the given one. */
function nextTwoDigitPrice({ mantissa, exponent }: TwoDigitPrice): TwoDigitPrice {
  if (exponent === 0 && mantissa < 99) return { mantissa: mantissa + 1, exponent: 0 };
  if (mantissa >= 99) return { mantissa: 10, exponent: exponent + 1 };
  return { mantissa: mantissa + 1, exponent };
}

/** Level prices per curve (base cost and scale), computed once from level 0 upwards. */
const levelPriceCache = new Map<string, number[]>();

function getLevelPrices(definition: UpgradeCostDefinition, level: number) {
  const key = `${definition.baseCost}:${definition.scale}`;
  let prices = levelPriceCache.get(key);
  if (!prices) {
    prices = [definition.baseCost];
    levelPriceCache.set(key, prices);
  }
  let previous = toTwoDigitPrice(prices[prices.length - 1]);
  while (prices.length <= level && Number.isFinite(prices[prices.length - 1])) {
    const raw = definition.baseCost * definition.scale ** prices.length;
    if (!Number.isFinite(raw)) {
      prices.push(Infinity);
      break;
    }
    const last = prices[prices.length - 1];
    let price = toTwoDigitPrice(raw);
    if (priceValue(price) <= last) price = nextTwoDigitPrice(previous);
    while (priceValue(price) <= last) price = nextTwoDigitPrice(price);
    prices.push(priceValue(price));
    previous = price;
  }
  return prices[level] ?? Infinity;
}

export function getUpgradeCostAtLevel(
  definition: UpgradeCostDefinition,
  level: number,
  maxMultiplierLevel = 8,
) {
  if (definition.kind === "multiplier" && level >= maxMultiplierLevel) return Infinity;
  // Level 0 is the round base price. Every further level follows the exponential curve rounded to two
  // significant digits (12, 150, 4800, 1.2e6) and always costs more than the level before.
  return getLevelPrices(definition, Math.max(0, Math.floor(level)));
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
