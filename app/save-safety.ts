export type StoredGameLike = {
  goals?: unknown;
  totalGoals?: unknown;
  seasonGoals?: unknown;
  clicks?: unknown;
  stars?: unknown;
  seasons?: unknown;
  upgrades?: unknown;
  achievements?: unknown;
  features?: unknown;
  lastSaved?: unknown;
};

export type StoredGameCandidate = {
  key: string;
  raw: string | null;
};

function nonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function parseStoredGame(raw: string | null): StoredGameLike | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as StoredGameLike : null;
  } catch {
    return null;
  }
}

export function getStoredGameProgress(value: StoredGameLike | null): readonly number[] {
  if (!value) return [0, 0, 0, 0, 0, 0, 0, 0] as const;
  const upgrades = value.upgrades && typeof value.upgrades === "object" && !Array.isArray(value.upgrades)
    ? Object.values(value.upgrades as Record<string, unknown>).reduce<number>((sum, level) => sum + nonNegative(level), 0)
    : 0;
  const features = value.features && typeof value.features === "object" && !Array.isArray(value.features)
    ? value.features as Record<string, unknown>
    : {};
  const starXI = features.starXI && typeof features.starXI === "object" && !Array.isArray(features.starXI)
    ? features.starXI as Record<string, unknown>
    : {};
  const ownedPlayers = Array.isArray(starXI.ownedIds) ? starXI.ownedIds.length : 0;
  const cup = features.cup && typeof features.cup === "object" && !Array.isArray(features.cup)
    ? features.cup as Record<string, unknown>
    : {};
  const trophies = cup.trophies && typeof cup.trophies === "object" && !Array.isArray(cup.trophies)
    ? Object.values(cup.trophies as Record<string, unknown>).reduce<number>((sum, count) => sum + nonNegative(count), 0)
    : 0;
  return [
    nonNegative(value.totalGoals),
    nonNegative(value.seasons),
    nonNegative(value.stars),
    ownedPlayers,
    trophies,
    nonNegative(value.clicks),
    upgrades,
    nonNegative(value.lastSaved),
  ] as const;
}

export function compareStoredGameProgress(first: StoredGameLike | null, second: StoredGameLike | null) {
  const left = getStoredGameProgress(first);
  const right = getStoredGameProgress(second);
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue !== rightValue) return leftValue > rightValue ? 1 : -1;
  }
  return 0;
}

export function selectSafestStoredGame(candidates: StoredGameCandidate[]) {
  let safest: { key: string; raw: string; saved: StoredGameLike } | null = null;
  for (const candidate of candidates) {
    const saved = parseStoredGame(candidate.raw);
    if (!saved || !candidate.raw) continue;
    if (!safest || compareStoredGameProgress(saved, safest.saved) > 0) safest = { key: candidate.key, raw: candidate.raw, saved };
  }
  return safest;
}

export function shouldRejectRegressedSave(current: StoredGameLike | null, next: StoredGameLike | null) {
  if (!current || !next) return false;
  const currentProgress = getStoredGameProgress(current);
  const nextProgress = getStoredGameProgress(next);
  if (currentProgress[0] > nextProgress[0]) return true;
  return currentProgress[0] === nextProgress[0] && compareStoredGameProgress(current, next) > 0;
}
