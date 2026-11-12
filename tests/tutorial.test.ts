import assert from "node:assert/strict";
import test from "node:test";
import { STARTER_SQUAD_UNLOCK_CLICKS, beginSeasonCupMatch, claimWelcomePack, forfeitWelcomePack, getStarXISelection, initialGameFeatures, maybeGrantStarterSquad, normalizeGameFeatures, startWelcomePack, unlockWelcomePack, welcomePackOpen } from "../app/feature-data.ts";
import { SYNCED_SAVE_KEYS } from "../app/cloud-save-rules.ts";
import { ALBUM_MILESTONES_STORAGE_KEY, TUTORIAL_STORAGE_KEY } from "../app/game/constants.ts";
import { TUTORIAL_STEPS, advanceTutorial, currentTutorialStep, hasStartedMatch, hasStartedSeasonMatch, newTutorial, parseTutorialState, serializeTutorialState, type TutorialGame, type TutorialState } from "../app/tutorial.ts";

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
  game.features.welcomePack = "pending"; // a brand new club
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
  assert.equal(currentTutorialStep(state)?.id, "packs", "the welcome pack is the second to last step");
  assert.deepEqual(TUTORIAL_STEPS.map((step) => step.id), ["clicks", "upgrade", "squad", "packs", "match"], "the season match is the very last step");
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

  // The kick off counts only after the welcome pack step: without it the season match does not tick the last step.
  const early = advanceTutorial({ status: "active", done: ["clicks", "upgrade", "squad"], visited: ["squad"] }, { ...game, features: { ...features, welcomePack: "available" } }, "cup");
  assert.ok(!early.done.includes("match"));
  assert.equal(currentTutorialStep(early)?.id, "packs");
  const state = advanceTutorial({ status: "active", done: ["clicks", "upgrade", "squad"], visited: ["squad"] }, { ...game, features: { ...features, welcomePack: "claimed" } }, "cup");
  assert.ok(state.done.includes("packs") && state.done.includes("match"));
  assert.equal(currentTutorialStep(state), null);
  assert.equal(state.status, "done", "the kick off of the season match finishes the tutorial");
});

test("the last step finishes the tutorial; steps done during the welcome window wait for it", () => {
  const game = freshGame();
  game.features.welcomePack = "available";
  game.clicks = STARTER_SQUAD_UNLOCK_CLICKS;
  game.upgrades = { boots: 2 };
  game.features.seasonMode.lastMatchAt = 1;
  let state = advanceTutorial(newTutorial(), game, "squad");
  state = advanceTutorial(state, game, "packs");
  assert.equal(currentTutorialStep(state)?.id, "packs", "an unopened welcome pack is never skipped by visiting the shop");
  game.features.welcomePack = "claimed";
  state = advanceTutorial(state, game, "packs");
  assert.equal(state.status, "intro", "the welcome window still shows");
  assert.equal(currentTutorialStep(state), null);
  state = advanceTutorial({ ...state, status: "active" }, game);
  assert.equal(state.status, "done");
  assert.equal(advanceTutorial(state, game, "packs"), state);
});

test("only a regular season match kick off completes the tutorial: not a tournament, not the tab, not a journey", () => {
  const features = initialGameFeatures();
  assert.equal(hasStartedSeasonMatch(features), false);
  features.cup = { ...features.cup, active: true, mode: "tournament", matchStartedAt: 5000 };
  assert.equal(hasStartedSeasonMatch(features), false, "a tournament match does not count");
  features.cup = { ...features.cup, mode: "season", active: false, matchStartedAt: 0 };
  features.squadLock = { playerIds: [] } as unknown as typeof features.squadLock;
  assert.equal(hasStartedSeasonMatch(features), false, "the journey alone does not count");
  features.squadLock = undefined;
  features.cup = { ...features.cup, active: true, matchStartedAt: 5000 };
  assert.equal(hasStartedSeasonMatch(features), true, "the kick off does");
});

test("the welcome pack: invisible until the shop step, one random walkout, once; ending the tutorial forfeits it for good", () => {
  const features = initialGameFeatures();
  assert.equal(features.welcomePack, undefined, "an older club has no welcome pack and is not changed");
  assert.equal(claimWelcomePack(features), null);
  startWelcomePack(features);
  assert.equal(features.welcomePack, "pending");
  assert.equal(claimWelcomePack(features), null, "a pending pack cannot be opened (no shop visit unlocks it)");
  assert.equal(features.starXI.ownedIds.length, 0);
  unlockWelcomePack(features);
  assert.equal(features.welcomePack, "available");
  const reveal = claimWelcomePack(features, 1234, () => 0.5)!;
  assert.ok(reveal.player.rating >= 86 && reveal.player.rating <= 89, "exactly one walkout card");
  assert.equal(reveal.packName, "Willkommenspack");
  assert.equal(features.welcomePack, "claimed");
  assert.equal(features.starXI.ownedIds.filter((id) => id === reveal.player.id).length, 1);
  const owned = features.starXI.ownedIds.length;
  assert.equal(claimWelcomePack(features), null, "no second pack, not after a reload either");
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.equal(reloaded.welcomePack, "claimed");
  assert.equal(claimWelcomePack(reloaded), null);
  assert.equal(reloaded.starXI.ownedIds.length, owned);
  assert.equal(welcomePackOpen(reloaded), false);

  // Ended before opening: gone for good, also in a repeated tutorial and after a reload.
  for (const stage of ["pending", "available"] as const) {
    const quit = initialGameFeatures();
    quit.welcomePack = stage;
    forfeitWelcomePack(quit);
    assert.equal(quit.welcomePack, "forfeited", stage);
    unlockWelcomePack(quit); startWelcomePack(quit);
    assert.equal(quit.welcomePack, "forfeited", "nothing brings it back");
    assert.equal(claimWelcomePack(normalizeGameFeatures(JSON.parse(JSON.stringify(quit)))), null);
  }
  // After the pack was opened, ending the tutorial takes nothing away.
  forfeitWelcomePack(features);
  assert.equal(features.welcomePack, "claimed");
  // A repeated tutorial of a club that has no pack to wait for does not block on the shop step.
  const old = initialGameFeatures();
  const game: TutorialGame = { clicks: 0, upgrades: {}, features: old };
  const restart = advanceTutorial({ ...newTutorial(), status: "active", done: ["clicks", "upgrade", "squad"] }, game);
  assert.ok(restart.done.includes("packs"));
});

test("the shop shows the welcome pack only at its step, without odds; ending the tutorial asks first", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const card = page.slice(page.indexOf('welcomePack === "available" && <div className="star-pack-grid">'), page.indexOf("earnedPacks.some(p=>!p.opening)"));
  assert.ok(card.includes("Willkommenspack öffnen") && card.length > 100);
  assert.doesNotMatch(card, /star-pack-odds|Chancen|Wahrscheinlichkeit|getRewardPackOdds|%/);
  // Both ways out of the tutorial go through the question while the pack is still to be had.
  assert.match(page, /onSkip=\{requestEndTutorial\}/);
  assert.match(page, /onEnd=\{requestEndTutorial\}/);
  assert.match(page, /Wenn du das Tutorial jetzt abbrichst, erhältst du das Willkommenspack nicht\./);
  assert.match(page, /function requestEndTutorial\(\) \{\s*if \(welcomePackOpen\(gameRef\.current\.features\)\) setTutorialEndDialog\(true\);/);
  // A new club no longer gets the walkout on the first start.
  assert.doesNotMatch(page, /grantWelcomePack\(features\);\s*setGame/);
});
