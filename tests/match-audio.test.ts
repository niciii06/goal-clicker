import assert from 'node:assert/strict';
import test from 'node:test';
import { homeTeamOf, legacyCues, simulationCues, crowdSize } from '../app/match-audio';
import type { SimAction } from '../app/interactive-match';

const action = (id: string, kind: SimAction['kind'], side: SimAction['side'], end: number, outcome: SimAction['outcome'] = 'success') =>
  ({ id, kind, side, start: end - 2, end, actor: 'a', from: { x: 50, y: 30 }, to: { x: 100, y: 34 }, outcome }) as SimAction;

test('the crowd reacts to what finishes on the pitch, from the point of view of the home fans', () => {
  const actions = [action('g', 'shot', 'club', 100, 'goal'), action('s', 'shot', 'opponent', 110, 'save'), action('f', 'foul', 'club', 120), action('y', 'yellow', 'opponent', 130), action('p', 'pass', 'club', 125)];
  assert.deepEqual(simulationCues(actions, 90, 140, 'club'), [{ kind: 'goal', home: true }, { kind: 'chance', home: false, save: true }, { kind: 'foul' }, { kind: 'card', red: false, againstHome: true }]);
  // On an away day the stadium belongs to the opponent: our goal is their groan.
  assert.deepEqual(simulationCues(actions, 90, 105, 'opponent'), [{ kind: 'goal', home: false }]);
  // Each action sounds once: windows that do not contain its end stay silent.
  assert.deepEqual(simulationCues(actions, 100, 105, 'club'), []);
  assert.deepEqual(simulationCues([...actions, ...actions], 95, 101, 'club'), [{ kind: 'goal', home: true }]);
});

test('matches without the simulation use goals and cards by wall time; home and crowd size', () => {
  const cup = { fixture: { id: 'f', away: true, venue: {} as never, opponentId: 'x' }, matchEvents: [{ side: 'home', createdAt: 1000 }], cardEvents: [{ side: 'away', createdAt: 3000, card: 'red' }] } as unknown as Parameters<typeof legacyCues>[0];
  assert.equal(homeTeamOf(cup), 'opponent');
  assert.deepEqual(legacyCues(cup, 0, 5000), [{ kind: 'goal', home: false }, { kind: 'card', red: true, againstHome: true }]);
  assert.deepEqual(legacyCues(cup, 1750, 2900), []);
  assert.ok(crowdSize(60) < .1 && crowdSize(70000) === 1 && crowdSize(20000) > crowdSize(5000));
});
