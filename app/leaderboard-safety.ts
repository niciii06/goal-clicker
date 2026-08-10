export const MAX_PUBLIC_LEADERBOARD_SCORE = 1e30;

export function parseLeaderboardScore(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= MAX_PUBLIC_LEADERBOARD_SCORE ? number : null;
}

export function preserveLeaderboardProgress(previous: number | null | undefined, submitted: number) {
  const safePrevious = typeof previous === "number" && Number.isFinite(previous) && previous >= 0 ? previous : 0;
  return Math.max(safePrevious, submitted);
}
