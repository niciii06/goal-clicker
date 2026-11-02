// A forgotten tab must not poll: hidden or untouched for 10 minutes counts as away (app/activity.ts).
import assert from 'node:assert/strict';
import test from 'node:test';

test('a hidden tab or one untouched for 10 minutes is away, the first input brings it back', async () => {
  const listeners = new Map<string, (() => void)[]>();
  const doc = { visibilityState: 'visible', addEventListener: (name: string, fn: () => void) => listeners.set(name, [...(listeners.get(name) ?? []), fn]) };
  Object.assign(globalThis, { document: doc, window: { addEventListener: (name: string, fn: () => void) => listeners.set(name, [...(listeners.get(name) ?? []), fn]) } });
  const { AWAY_AFTER_MS, isAway, markInputForTests, onReturn } = await import('../app/activity.ts');
  const now = Date.now();
  markInputForTests(now);
  assert.equal(isAway(now), false);
  assert.equal(isAway(now + AWAY_AFTER_MS - 1), false);
  assert.equal(isAway(now + AWAY_AFTER_MS), true);
  doc.visibilityState = 'hidden';
  assert.equal(isAway(now), true, 'hidden is always away');
  doc.visibilityState = 'visible';
  let returned = 0;
  onReturn(() => { returned += 1; });
  markInputForTests(now - AWAY_AFTER_MS - 1);
  for (const fn of listeners.get('pointerdown') ?? []) fn();
  assert.equal(returned, 1);
  assert.equal(isAway(), false);
  for (const fn of listeners.get('pointerdown') ?? []) fn();
  assert.equal(returned, 1, 'only the return from away is reported');
});
