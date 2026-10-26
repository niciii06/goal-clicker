// The stadium of the running match: the venue stored with the fixture (also the travel destination),
// with a crowd that depends on the opponent, derby, table, cup round, weather and kick-off time.
import { rivalryKey } from './career-data';
import { getTournament } from './feature-data';
import type { GameFeatures } from './feature-data';
import { computeAmbience, venueWeekday } from './stadium-ambience';
import { stadiumProfile } from './stadium-profiles';
import type { CrowdFactors, StadiumProfile } from './stadium-profiles';

type MatchFeatures = Pick<GameFeatures, 'cup' | 'seasonMode' | 'press'> & Partial<Pick<GameFeatures, 'career'>>;

export function matchCrowd(features: MatchFeatures): CrowdFactors {
  const cup = features.cup, fanMood = features.press.fanMood;
  // Weather and time of day as the canvas shows them (the same seed as the interactive renderer).
  const ambience = computeAmbience(cup, fanMood, cup.simulation?.seed);
  const crowd: CrowdFactors = { opponentRating: cup.opponentRating, derby: Boolean(features.career?.rivals?.[rivalryKey(cup.opponent)]?.active), weather: ambience.weather, time: ambience.time, weekday: venueWeekday(cup) };
  if (cup.mode === 'tournament') {
    const rounds = getTournament(cup.tournamentId)?.rounds;
    if (rounds) { crowd.cupRound = Math.min(rounds, Math.max(1, cup.round + 1)); crowd.cupRounds = rounds; }
  } else {
    const table = [...features.seasonMode.table].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name));
    if (table.some((team) => team.played > 0)) {
      const position = (id?: string) => id ? table.findIndex((team) => team.id === id || team.clubId === id) + 1 || undefined : undefined;
      crowd.tableSize = table.length;
      crowd.tablePosition = cup.fixture?.away ? position(cup.fixture.opponentId) : position('club');
      crowd.opponentTablePosition = cup.fixture?.away ? position('club') : position(cup.fixture?.opponentId);
    }
  }
  return crowd;
}

export function matchStadium(features: MatchFeatures): StadiumProfile {
  const cup = features.cup, fixture = cup.fixture;
  return stadiumProfile(fixture?.venue, { home: Boolean(fixture && !fixture.away && !fixture.neutral) || !fixture, homeDivision: features.seasonMode.division, fanMood: features.press.fanMood, seed: cup.careerMatchId ?? String(cup.matchStartedAt), crowd: matchCrowd(features) });
}
