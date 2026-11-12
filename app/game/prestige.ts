// Prestige on the whole game state, shared by single player (app/page.tsx) and the co-op server
// (app/api/multiplayer/route.ts), so both modes reset exactly the same way.
import { applySeasonPrestige } from "../feature-data";
import type { GameFeatures } from "../feature-data";
import type { HomeCityId } from "../home-cities";
import { MAX_CAREER_SEASON } from "../season-progression";
import { payTravelFines, settleTravel } from "../travel-data";
import { getBasePassivePower } from "./economy";

export type PrestigeGameState = {
  goals: number;
  seasonGoals: number;
  totalGoals: number;
  seasons: number;
  stars: number;
  upgrades: Record<string, number>;
  features: GameFeatures;
};

/**
 * One Prestige, all or nothing: open travel fines are paid from the goals the club still has, then season, squad,
 * album and card improvements change (applySeasonPrestige), the goal balance goes to 0 and every Club Office upgrade
 * goes back to level 0. Lifetime counters (`totalGoals`, `seasonGoals`, clicks), stars, fragments, packs and the
 * highest league (all unlocks) stay. A blocked or repeated request returns the given state unchanged.
 */
/** `homeCity`: the home city of the new run (the only moment it changes); the current one when not given. */
export function applyGamePrestige<T extends PrestigeGameState>(game: T, keepNormalId: string | null, now = Date.now(), requestId = "", homeCity?: HomeCityId): { game: T; error: string; duplicate?: boolean } {
  const precheck = applySeasonPrestige(game.features, keepNormalId, now, requestId, homeCity);
  if (precheck.duplicate) return { game, error: "", duplicate: true };
  if (precheck.error) return { game, error: precheck.error };
  // Fines of an arrived journey are settled first, with the income before the reset, so they are not waived.
  const features = structuredClone(game.features);
  features.travel = settleTravel(features.travel, now);
  const fine = payTravelFines(features, game.goals, getBasePassivePower(game.upgrades, game.stars, game.features), now);
  const result = applySeasonPrestige(features, keepNormalId, now, requestId, homeCity);
  if (result.error || result.duplicate) return { game, error: result.error, duplicate: result.duplicate };
  return {
    game: {
      ...game,
      features: result.features,
      goals: 0,
      seasonGoals: Math.max(0, game.seasonGoals - fine),
      // A new game has no upgrade levels at all; unlocks follow the highest league, which stays.
      upgrades: {},
      seasons: Math.max(game.seasons, MAX_CAREER_SEASON - 1),
    },
    error: "",
  };
}
