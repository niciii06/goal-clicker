import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMBO_DECAY_MS, COMBO_HOLD_MS } from '../app/game/constants.ts';
import { decayComboCount, getComboLevel } from '../app/game/economy.ts';

test('the combo holds for three seconds after the last click', () => {
  assert.equal(COMBO_HOLD_MS, 3000);
  assert.equal(decayComboCount(40, 0), 40);
  assert.equal(decayComboCount(40, 3000), 40);
  assert.equal(decayComboCount(40, 3300), 40);
});

test('then it drains by one click every third of a second', () => {
  assert.equal(COMBO_DECAY_MS, 1000 / 3);
  assert.equal(decayComboCount(40, 3334), 39);
  assert.equal(getComboLevel(decayComboCount(40, 3334)).multiplier, 2);
  assert.equal(decayComboCount(40, 4000), 37);
  assert.equal(decayComboCount(40, COMBO_HOLD_MS + 40 * COMBO_DECAY_MS), 0);
  assert.equal(decayComboCount(3, 60_000), 0);
});
