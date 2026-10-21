import assert from 'node:assert/strict';
import test from 'node:test';
import { beginCupMatch, initialGameFeatures, normalizeGameFeatures, TOURNAMENTS } from '../app/feature-data';
import { fixtureFor } from '../app/travel-data';

const RUNS = 3000;

for (const tournament of TOURNAMENTS) {
  test(`${tournament.id}: the first round opponent is spread across every opponent`, () => {
    let features = initialGameFeatures(1_000_000);
    const counts = new Map(tournament.opponents.map(o => [o.name, 0]));
    for (let run = 0; run < RUNS; run++) {
      const fixture = fixtureFor(features, 'tournament', tournament.id);
      counts.set(fixture.opponent, (counts.get(fixture.opponent) ?? 0) + 1);
      const cup = beginCupMatch(features.cup, 2_000_000 + run, tournament.id, [], features.starXI.formationPositions, [], [], Math.random, fixture.schedule);
      assert.equal(cup.opponent, fixture.opponent, 'the match is played against the announced opponent');
      // The run ends and a season match follows: that resets the cooldown to 0, which used to repeat the same draw.
      features = normalizeGameFeatures({ ...features, cup: { ...cup, active: false, pendingNextRound: false, round: 0, nextTournamentAt: 0, mode: 'season' } });
    }
    const expected = RUNS / tournament.opponents.length;
    for (const [name, count] of counts) {
      assert.ok(count > expected * 0.6 && count < expected * 1.4, `${name} drawn ${count} times, expected about ${Math.round(expected)}`);
    }
  });
}

test('the announced opponent stays the same until the run starts', () => {
  const features = initialGameFeatures(1_000_000), tournament = TOURNAMENTS[1];
  const first = fixtureFor(features, 'tournament', tournament.id);
  for (let i = 0; i < 20; i++) assert.deepEqual(fixtureFor(normalizeGameFeatures(structuredClone(features)), 'tournament', tournament.id).schedule, first.schedule);
});

test('fresh saves do not all meet the same first opponent', () => {
  const tournament = TOURNAMENTS[1];
  const first = new Set(Array.from({ length: 200 }, () => fixtureFor(initialGameFeatures(1_000_000), 'tournament', tournament.id).opponent));
  assert.equal(first.size, tournament.opponents.length);
});
