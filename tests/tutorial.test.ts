import assert from "node:assert/strict";
import test from "node:test";
import { STARTER_SQUAD_UNLOCK_CLICKS, beginSeasonCupMatch, getStarXISelection, initialGameFeatures, maybeGrantStarterSquad } from "../app/feature-data.ts";
import { SYNCED_SAVE_KEYS } from "../app/cloud-save-rules.ts";
import { ALBUM_MILESTONES_STORAGE_KEY, TUTORIAL_STORAGE_KEY } from "../app/game/constants.ts";
import { TUTORIAL_STEPS, advanceTutorial, currentTutorialStep, hasStartedMatch, newTutorial, parseTutorialState, serializeTutorialState, type TutorialGame, type TutorialState } from "../app/tutorial.ts";

const freshGame = (): TutorialGame => ({ clicks: 0, upgrades: {}, features: initialGameFeatures() });

test("a missing, broken or unknown tutorial value counts as finished", () => {
  for (const raw of [null, "", "{", "null", "[]", JSON.stringify({ status: "maybe" })]) assert.equal(parseTutorialState(raw).status, "done", String(raw));
  const parsed = parseTutorialState(JSON.stringify({ status: "active", done: ["clicks", "clicks", "unknown", 3], visited: ["packs", "club"] }));
  assert.deepEqual(parsed, { status: "active", done: ["clicks"], visited: ["packs"] });
  const state = { status: "active" as const, done: ["clicks", "upgrade"], visited: ["squad"] };
  assert.deepEqual(parseTutorialState(serializeTutorialState(state)), state);
});

test("the tutorial progress travels with the cloud save", () => {
  assert.ok((SYNCED_SAVE_KEYS as readonly string[]).includes(TUTORIAL_STORAGE_KEY));
  assert.ok((SYNCED_SAVE_KEYS as readonly string[]).includes(ALBUM_MILESTONES_STORAGE_KEY), "the album switch too");
});

test("tutorial steps tick off from the game in order and stay done", () => {
  let state: TutorialState = { ...newTutorial(), status: "active" };
  const game = freshGame();
  assert.equal(advanceTutorial(state, game, "home"), state, "nothing changes on a fresh game");
  assert.equal(currentTutorialStep(state)?.id, "clicks");
  assert.deepEqual(TUTORIAL_STEPS[0].progress?.(game), { value: 0, goal: STARTER_SQUAD_UNLOCK_CLICKS });

  game.clicks = STARTER_SQUAD_UNLOCK_CLICKS - 1;
  assert.equal(advanceTutorial(state, game).done.length, 0);
  game.clicks = STARTER_SQUAD_UNLOCK_CLICKS;
  state = advanceTutorial(state, game);
  assert.deepEqual(state.done, ["clicks"]);
  assert.equal(currentTutorialStep(state)?.id, "upgrade");

  game.upgrades = { boots: 1 };
  state = advanceTutorial(state, game, "squad");
  assert.deepEqual(state.done, ["clicks", "upgrade", "squad"]);
  // A later spend or another tab never takes a step back.
  game.upgrades = {};
  state = advanceTutorial(state, game, "home");
  assert.deepEqual(state.done, ["clicks", "upgrade", "squad"]);
  assert.equal(currentTutorialStep(state)?.id, "match");
});

test("the first league match counts at kick off, while the season history is still empty", () => {
  const features = initialGameFeatures();
  maybeGrantStarterSquad(features, STARTER_SQUAD_UNLOCK_CLICKS, 1000, () => 0.5);
  const game: TutorialGame = { clicks: STARTER_SQUAD_UNLOCK_CLICKS, upgrades: {}, features };
  assert.equal(hasStartedMatch(features), false, "no match before kick off");

  const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
  features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, 5000, homePlayers, features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
  assert.equal(features.cup.active, true);
  assert.equal(features.cup.mode, "season");
  assert.equal(features.seasonMode.history.length, 0, "the history fills only after the final whistle");
  assert.equal(hasStartedMatch(features), true);

  const state = advanceTutorial({ status: "active", done: ["clicks", "upgrade", "squad"], visited: ["squad"] }, game, "cup");
  assert.ok(state.done.includes("match"));
  assert.equal(currentTutorialStep(state)?.id, "packs");
});

test("the last step finishes the tutorial; steps done during the welcome window wait for it", () => {
  const game = freshGame();
  game.clicks = STARTER_SQUAD_UNLOCK_CLICKS;
  game.upgrades = { boots: 2 };
  game.features.seasonMode.lastMatchAt = 1;
  let state = advanceTutorial(newTutorial(), game, "squad");
  state = advanceTutorial(state, game, "packs");
  assert.equal(state.status, "intro", "the welcome window still shows");
  assert.equal(currentTutorialStep(state), null);
  state = advanceTutorial({ ...state, status: "active" }, game);
  assert.equal(state.status, "done");
  assert.equal(advanceTutorial(state, game, "packs"), state);
});
