// The stadium of the running match: the venue stored with the fixture (also the travel destination).
import type { GameFeatures } from './feature-data';
import { stadiumProfile } from './stadium-profiles';
import type { StadiumProfile } from './stadium-profiles';

export function matchStadium(features: Pick<GameFeatures, 'cup' | 'seasonMode' | 'press'>): StadiumProfile {
  const cup = features.cup, fixture = cup.fixture;
  return stadiumProfile(fixture?.venue, { home: Boolean(fixture && !fixture.away && !fixture.neutral) || !fixture, homeDivision: features.seasonMode.division, fanMood: features.press.fanMood, seed: cup.careerMatchId ?? String(cup.matchStartedAt) });
}
