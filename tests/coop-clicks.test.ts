import assert from 'node:assert/strict';
import test from 'node:test';
import { applyServerClicks, CLICK_BURST_MS, CLICK_MIN_INTERVAL_MS } from '../app/coop-clicks.ts';

test('the click budget allows 20 clicks a second with a short reserve after a pause', () => {
  const first = applyServerClicks(null, 50, 100_000, 1, () => 1);
  assert.equal(first.accepted, CLICK_BURST_MS / CLICK_MIN_INTERVAL_MS);
  assert.equal(applyServerClicks(first.state, 50, 100_000, 1, () => 1).accepted, 0);
  assert.equal(applyServerClicks(first.state, 50, 101_000, 1, () => 1).accepted, 20);
});

test('combo, streak and critical hits follow the solo rules, rolled by the server', () => {
  let state = null as ReturnType<typeof applyServerClicks>['state'] | null;
  let now = 0, total = 0;
  // Clicking steadily ten times a second builds the full combo (x2) within a few seconds.
  for (let i = 0; i < 60; i++) { now += 100; const result = applyServerClicks(state, 1, now, 10, () => 1); state = result.state; total = result.amount; }
  assert.equal(state!.count, 50);
  assert.equal(total, Math.floor(10 * 2 * 1.1));
  // A critical hit doubles a click; the chance is the server's random draw.
  assert.equal(applyServerClicks(state, 1, now + 100, 10, () => 0).amount, Math.floor(10 * 2 * 1.1 * 2));
  // After a long pause the combo is gone.
  assert.equal(applyServerClicks(state, 1, now + 60_000, 10, () => 1).amount, 10);
});
