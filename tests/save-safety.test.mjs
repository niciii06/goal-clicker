import assert from "node:assert/strict";
import test from "node:test";
import { selectSafestStoredGame, shouldRejectRegressedSave } from "../app/save-safety.ts";

const save = (totalGoals, extra = {}) => JSON.stringify({ goals: totalGoals, totalGoals, clicks: totalGoals, ...extra });

test("loads the strongest valid save instead of an empty primary save", () => {
  const selected = selectSafestStoredGame([
    { key: "primary", raw: save(0) },
    { key: "backup", raw: save(15000, { seasons: 2 }) },
  ]);
  assert.equal(selected?.key, "backup");
  assert.equal(selected?.saved.totalGoals, 15000);
});

test("keeps a progressed primary save when a new render tries to write zero", () => {
  assert.equal(shouldRejectRegressedSave(JSON.parse(save(50000)), JSON.parse(save(0))), true);
});

test("accepts normal progress and purchases without comparing the spendable balance", () => {
  const current = JSON.parse(save(50000, { goals: 40000 }));
  const next = JSON.parse(save(51000, { goals: 1000 }));
  assert.equal(shouldRejectRegressedSave(current, next), false);
});

test("uses the newest valid snapshot when progress is otherwise identical", () => {
  const selected = selectSafestStoredGame([
    { key: "backup", raw: save(50000, { goals: 12000, lastSaved: 1000 }) },
    { key: "primary", raw: save(50000, { goals: 18000, lastSaved: 2000 }) },
  ]);
  assert.equal(selected?.key, "primary");
  assert.equal(selected?.saved.goals, 18000);
});
