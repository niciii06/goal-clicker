// Render isolation (audit P09): passive ticks collect in a store and reach the App state about once per second.
// Nothing may be earned differently than with one state commit per 200 ms tick.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addPassiveGoals, createPassiveGoalsStore } from "../app/game/live-goals.ts";
import { createClickFeedbackStore } from "../app/game/live-display.tsx";

type Totals = { goals: number; seasonGoals: number; totalGoals: number; clicks: number };

test("collected passive ticks add up to the same goals as one commit per tick", () => {
  const ticks = [3, 3, 3.6, 120.4, 0.2, 1e9 / 7, 5, 5, 5, 5, 0.1];
  let reference: Totals = { goals: 10, seasonGoals: 4, totalGoals: 99, clicks: 7 };
  for (const amount of ticks) reference = { ...reference, goals: reference.goals + amount, seasonGoals: reference.seasonGoals + amount, totalGoals: reference.totalGoals + amount };

  const store = createPassiveGoalsStore(10);
  let state: Totals = { goals: 10, seasonGoals: 4, totalGoals: 99, clicks: 7 };
  ticks.forEach((amount, index) => {
    store.addPending(amount);
    if (index % 4 === 3) state = addPassiveGoals(state, store.takePending());
  });
  state = addPassiveGoals(state, store.takePending());
  assert.equal(store.getPending(), 0);
  for (const key of ["goals", "seasonGoals", "totalGoals"] as const) assert.ok(Math.abs(state[key] - reference[key]) <= Math.abs(reference[key]) * 1e-12, key);
  assert.equal(state.clicks, 7);
});

test("a game update sees the collected goals first: a purchase right after a tick is charged against exact goals", () => {
  // The page's setGame commits the pending goals before the update, like React applies queued updaters in order.
  const store = createPassiveGoalsStore(0);
  const queue: ((current: Totals) => Totals)[] = [];
  const setGame = (update: (current: Totals) => Totals) => {
    const amount = store.takePending();
    if (amount) queue.push((current) => addPassiveGoals(current, amount));
    queue.push(update);
  };
  let state: Totals = { goals: 95, seasonGoals: 95, totalGoals: 95, clicks: 0 };
  store.addPending(3); store.addPending(3);
  let charged = false;
  setGame((current) => { if (current.goals < 100) return current; charged = true; return { ...current, goals: current.goals - 100 }; });
  for (const update of queue) state = update(state);
  assert.ok(charged, "the purchase sees 101 goals, not the 95 of the last commit");
  assert.equal(state.goals, 1);
  assert.equal(state.totalGoals, 101);
});

test("no tick is lost or counted twice when an update replaces the state with a copy that already has them", () => {
  // Saves and the return from a hidden tab build the next state from the exact running copy (gameRef) and set it.
  const store = createPassiveGoalsStore(0);
  let state: Totals = { goals: 50, seasonGoals: 50, totalGoals: 50, clicks: 0 };
  let running = state;
  for (let i = 0; i < 4; i++) { store.addPending(2); running = addPassiveGoals(running, 2); }
  const replaced = { ...running };
  const amount = store.takePending();
  state = addPassiveGoals(state, amount);
  state = replaced;
  assert.equal(state.goals, 58);
  assert.equal(store.getPending(), 0);
});

test("the counter store only notifies on a new value and the click feedback store keeps the old behaviour", () => {
  const store = createPassiveGoalsStore(5);
  let calls = 0;
  const stop = store.subscribe(() => { calls++; });
  store.setDisplay(5);
  store.setDisplay(6);
  store.setDisplay(6);
  stop();
  store.setDisplay(7);
  assert.equal(calls, 1);
  assert.equal(store.getDisplay(), 7);

  const feedback = createClickFeedbackStore();
  feedback.addEffect({ id: 1, x: 1, y: 2, amount: 3, critical: false, combo: 1 });
  feedback.addEffect({ id: 2, x: 1, y: 2, amount: 3, critical: true, combo: 2 });
  feedback.removeEffect(1);
  assert.deepEqual(feedback.get().effects.map((effect) => effect.id), [2]);
  const pulse = feedback.get().pulse;
  feedback.togglePulse();
  assert.equal(feedback.get().pulse, !pulse);
  feedback.setBurst({ id: 9, text: "COMBO x1,5" });
  feedback.setBurst((current) => current?.id === 8 ? null : current);
  assert.equal(feedback.get().burst?.id, 9);
  feedback.setBurst((current) => current?.id === 9 ? null : current);
  assert.equal(feedback.get().burst, null);
  feedback.setCombo({ count: 12, multiplier: 1.5 });
  assert.deepEqual(feedback.get().combo, { count: 12, multiplier: 1.5 });
});

test("the page commits passive goals through the store and flushes them before every other game update", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  // The 200 ms tick no longer sets the App state.
  const tick = page.slice(page.indexOf("const tick = window.setInterval(() => {"), page.indexOf("}, 200);"));
  assert.doesNotMatch(tick, /setGame|setGameState/);
  assert.match(tick, /passiveGoals\.addPending\(power \/ 5\)/);
  // Every setGame first adds what was collected.
  assert.match(page, /const setGame = useCallback\(\(update: SetStateAction<GameState>\) => \{\s*flushPassiveGoals\(\);\s*setGameState\(update\);/);
  assert.equal(page.match(/setGameState\(/g)?.length, 2, "only the flush and the setGame wrapper touch the state directly");
  // A press commits first, so handlers render with exact goals; the 1 s clock commits the rest.
  assert.match(page, /window\.addEventListener\("pointerdown", commit/);
  assert.match(page, /window\.addEventListener\("keydown", commit/);
  assert.match(page, /flushPassiveGoals\(\); setCountdownNow\(getCurrentTime\(\)\);/);
});
