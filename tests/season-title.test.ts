import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSeasonMode, recordSeasonModeMatch, SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON } from '../app/feature-data.ts';
import type { SeasonModeState } from '../app/feature-data.ts';
import { getSeasonTitle } from '../app/season-trophy.tsx';

/** The last matchday of a season in the given league, with the club and its rival far ahead of the others. */
function lastMatchday(division: number, clubPoints: number, rivalPoints: number): SeasonModeState {
  const start = initialSeasonMode('FC Test');
  const rivalId = start.table.find((team) => team.id !== 'club')!.id;
  const table = start.table.map((team) => ({ ...team, played: SEASON_MODE_MATCHES_PER_SEASON - 1, points: team.id === 'club' ? clubPoints : team.id === rivalId ? rivalPoints : 0 }));
  return { ...start, division, highestDivision: division, matchday: SEASON_MODE_MATCHES_PER_SEASON - 1, table };
}

test('in Liga 1 only the champion reaches the Hall of Fame; second place stays', () => {
  const second = recordSeasonModeMatch(lastMatchday(SEASON_MODE_DIVISION_COUNT, 50, 100), 0, 0, 'FC Test', 5000, () => 0.5);
  assert.equal(second.entry?.completedSeason, true);
  assert.equal(second.entry?.seasonOutcome, 'stayed');
  assert.equal(second.state.hallOfFame, false);
  assert.equal(second.state.division, SEASON_MODE_DIVISION_COUNT);
  assert.equal(getSeasonTitle(second.entry, second.state.lastTable), null, 'no trophy for second place');

  const champion = recordSeasonModeMatch(lastMatchday(SEASON_MODE_DIVISION_COUNT, 100, 50), 0, 0, 'FC Test', 5000, () => 0.5);
  assert.equal(champion.entry?.seasonOutcome, 'hall-of-fame');
  assert.equal(champion.state.hallOfFame, true);
  const title = getSeasonTitle(champion.entry, champion.state.lastTable);
  assert.equal(title?.division, SEASON_MODE_DIVISION_COUNT);
  assert.equal(title?.club.id, 'club');
});

test('every league title gets the trophy, second place still goes up below Liga 1', () => {
  const champion = recordSeasonModeMatch(lastMatchday(5, 100, 50), 2, 0, 'FC Test', 5000, () => 0.5);
  assert.equal(champion.entry?.seasonOutcome, 'promoted');
  assert.ok(getSeasonTitle(champion.entry, champion.state.lastTable));
  const second = recordSeasonModeMatch(lastMatchday(5, 50, 100), 0, 0, 'FC Test', 5000, () => 0.5);
  assert.equal(second.entry?.seasonOutcome, 'promoted');
  assert.equal(getSeasonTitle(second.entry, second.state.lastTable), null);
  // A matchday in the middle of the season is no title, even when the club leads.
  const midSeason = recordSeasonModeMatch({ ...lastMatchday(5, 100, 50), matchday: 3 }, 2, 0, 'FC Test', 5000, () => 0.5);
  assert.equal(getSeasonTitle(midSeason.entry, midSeason.state.lastTable), null);
});
