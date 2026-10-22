import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMBO_DECAY_MS } from '../app/game/constants.ts';
import { decayComboCount, getComboLevel } from '../app/game/economy.ts';

test('the combo drains by one click every third of a second', () => {
  assert.equal(COMBO_DECAY_MS, 1000 / 3);
  assert.equal(decayComboCount(40, 0), 40);
  assert.equal(decayComboCount(40, 300), 40);
  assert.equal(decayComboCount(40, 334), 39);
  assert.equal(decayComboCount(40, 1000), 37);
  assert.equal(getComboLevel(decayComboCount(40, 1000)).multiplier, 2);
  assert.equal(decayComboCount(40, 40 * COMBO_DECAY_MS), 0);
  assert.equal(decayComboCount(3, 60_000), 0);
});

test('after an announcement the last click lies in the future, which never drains', () => {
  assert.equal(decayComboCount(40, -1500), 40);
});
