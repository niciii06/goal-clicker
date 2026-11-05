// The co-op client normalizes the world only when its features change (P10).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoopGameNormalizer } from '../app/game/coop.ts';
import { initialGame, normalizeRuntimeGame } from '../app/game/storage.ts';

test('slim co-op answers with the same features object reuse the normalized features', () => {
  const normalize = createCoopGameNormalizer();
  const features = JSON.parse(JSON.stringify(initialGame().features));
  const first = normalize({ goals: 10, totalGoals: 10, upgrades: {}, features }, true);
  // Next poll: new game object (new goals), the very same features object (slim answer, same featuresKey).
  const second = normalize({ goals: 25, totalGoals: 25, upgrades: {}, features }, false);
  assert.equal(second.features, first.features, 'the same normalized features reference');
  assert.equal(second.goals, 25);
  assert.equal(second.sound, false);
  assert.deepEqual(second, normalizeRuntimeGame({ goals: 25, totalGoals: 25, upgrades: {}, features }, false));
});

test('new features (a full answer) are normalized again', () => {
  const normalize = createCoopGameNormalizer();
  const features = JSON.parse(JSON.stringify(initialGame().features));
  const first = normalize({ goals: 1, features }, true);
  const changed = { ...features, club: { ...features.club, name: 'FC Neu' } };
  const second = normalize({ goals: 1, features: changed }, true);
  assert.notEqual(second.features, first.features);
  assert.equal(second.features.club.name, 'FC Neu');
  assert.deepEqual(second, normalizeRuntimeGame({ goals: 1, features: changed }, true));
});

test('the normalized world is computed once for many polls', () => {
  const normalize = createCoopGameNormalizer();
  const features = JSON.parse(JSON.stringify(initialGame().features));
  const before = normalize({ goals: 0, features }, true).features;
  for (let i = 0; i < 200; i += 1) assert.equal(normalize({ goals: i, features }, true).features, before);
});
