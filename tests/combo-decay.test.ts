import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMBO_DECAY_MS, COMBO_HOLD_MS, COMBO_MAX_COUNT } from '../app/game/constants.ts';
import { decayComboCount, formatComboMultiplier, getComboLevel } from '../app/game/economy.ts';

test('the combo holds for three seconds after the last click', () => {
  assert.equal(COMBO_HOLD_MS, 3000);
  assert.equal(decayComboCount(40, 0), 40);
  assert.equal(decayComboCount(40, 3000), 40);
  assert.equal(decayComboCount(40, 3300), 40);
});

test('then it drains by one click every third of a second', () => {
  assert.equal(COMBO_DECAY_MS, 1000 / 3);
  assert.equal(decayComboCount(50, 3334), 49);
  assert.equal(getComboLevel(decayComboCount(50, 3334)).multiplier, 1.5);
  assert.equal(decayComboCount(50, 4000), 47);
  assert.equal(decayComboCount(50, COMBO_HOLD_MS + 50 * COMBO_DECAY_MS + 1), 0);
  assert.equal(decayComboCount(3, 60_000), 0);
});

test('the combo gives x1,5 from 20 clicks and at most x2 from 50 clicks', () => {
  assert.equal(getComboLevel(19).multiplier, 1);
  assert.equal(getComboLevel(20).multiplier, 1.5);
  assert.equal(getComboLevel(49).multiplier, 1.5);
  assert.equal(getComboLevel(50).multiplier, 2);
  assert.equal(getComboLevel(500).multiplier, 2);
  assert.equal(COMBO_MAX_COUNT, 50);
  assert.equal(formatComboMultiplier(1.5), 'x1,5');
});
