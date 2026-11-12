// Special cards (Spezialkarten): one pack, every card exactly the same chance (1 in N), duplicates allowed, no 100 category.
// Every duplicate special card pays 25,000 fragments (tests/special-duplicate-fragments.test.ts covers solo, co-op, bought and free).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SPECIAL_CARD_PACK, STAR_XI_CUSTOM_PLAYERS, STAR_XI_RANDOM_CUSTOM_CARD_COST, cardPackRating, drawRandomStarXICustomCard, getSpecialCardChances, getSpecialCardPackOdds, getStarXIFragmentCompensation, initialGameFeatures, normalizeGameFeatures, openEarnedPack, openEarnedPackDraw, purchaseSpecialCardPack } from "../app/feature-data.ts";
import type { StarXIState } from "../app/feature-data.ts";

const N = STAR_XI_CUSTOM_PLAYERS.length;
const state = (ownedIds: string[] = [], fragments = STAR_XI_RANDOM_CUSTOM_CARD_COST): StarXIState => ({ ...initialGameFeatures().starXI, ownedIds, fragments });

test("every special card has the chance 1 in N, whatever its rating, pack weight or owner status", () => {
  assert.ok(N >= 10);
  const chances = getSpecialCardChances();
  assert.equal(chances.size, N);
  for (const player of STAR_XI_CUSTOM_PLAYERS) assert.equal(chances.get(player.id), 1 / N, player.id);
  // The pack weights and ratings of the cards differ, and still nothing changes.
  assert.ok(new Set(STAR_XI_CUSTOM_PLAYERS.map((player) => player.packWeight)).size > 1);
  assert.ok(new Set(STAR_XI_CUSTOM_PLAYERS.map((player) => cardPackRating(player))).size > 1);
  assert.equal(getSpecialCardPackOdds([]).each, 1 / N);
  assert.equal(getSpecialCardPackOdds(STAR_XI_CUSTOM_PLAYERS.map((player) => player.id)).each, 1 / N);
});

test("deterministic sweep: the roll is split into N equal slices, one per card, and the owner status does not move a slice", () => {
  const steps = N * 1000;
  const counts = new Map<string, number>();
  for (let step = 0; step < steps; step++) {
    const roll = (step + 0.5) / steps;
    const fresh = drawRandomStarXICustomCard(state(), () => roll);
    const owned = drawRandomStarXICustomCard(state(STAR_XI_CUSTOM_PLAYERS.slice(0, N / 2).map((player) => player.id)), () => roll);
    assert.equal(owned.player!.id, fresh.player!.id, "the same roll gives the same card, owned or not");
    counts.set(fresh.player!.id, (counts.get(fresh.player!.id) ?? 0) + 1);
  }
  assert.equal(counts.size, N);
  for (const player of STAR_XI_CUSTOM_PLAYERS) assert.equal(counts.get(player.id), steps / N, player.id);
  // The edges of the roll: 0 is the first card, a roll just below 1 (and any bad roll) is the last, nothing is out of range.
  assert.equal(drawRandomStarXICustomCard(state(), () => 0).player!.id, STAR_XI_CUSTOM_PLAYERS[0].id);
  assert.equal(drawRandomStarXICustomCard(state(), () => 0.9999999).player!.id, STAR_XI_CUSTOM_PLAYERS[N - 1].id);
  assert.equal(drawRandomStarXICustomCard(state(), () => 5).player!.id, STAR_XI_CUSTOM_PLAYERS[N - 1].id);
  assert.equal(drawRandomStarXICustomCard(state(), () => Number.NaN).player!.id, STAR_XI_CUSTOM_PLAYERS[0].id);
});

test("duplicates stay allowed: the chance of a duplicate is the share of owned special cards, nothing is rerolled", () => {
  for (const ownedCount of [0, 3, N]) {
    const ownedIds = STAR_XI_CUSTOM_PLAYERS.slice(0, ownedCount).map((player) => player.id);
    const odds = getSpecialCardPackOdds(ownedIds);
    assert.ok(Math.abs(odds.duplicate - ownedCount / N) < 1e-12, `${ownedCount} of ${N} owned`);
    assert.ok(Math.abs(odds.newCard - (N - ownedCount) / N) < 1e-12);
    assert.ok(Math.abs(odds.duplicate + odds.newCard - 1) < 1e-12);
    let duplicates = 0, calls = 0;
    const steps = N * 100;
    for (let step = 0; step < steps; step++) {
      const result = drawRandomStarXICustomCard(state(ownedIds), () => { calls++; return (step + 0.5) / steps; });
      if (result.duplicate) duplicates++;
    }
    assert.equal(duplicates / steps, ownedCount / N, `${ownedCount} owned`);
    assert.equal(calls, steps, "exactly one random number per draw: no reroll, no pity rule, no preference for missing cards");
  }
});

test("the duplicate compensation is 25,000 for every special card, credited once, and the price stays", () => {
  assert.ok(STAR_XI_CUSTOM_PLAYERS.every((player) => getStarXIFragmentCompensation(player) === 25000));
  assert.equal(SPECIAL_CARD_PACK.price, 50000);
  const owned = STAR_XI_CUSTOM_PLAYERS[0];
  const draw = drawRandomStarXICustomCard(state([owned.id]), () => 0);
  assert.equal(draw.duplicate, true);
  assert.equal(draw.fragmentCompensation, 25000);
  assert.equal(draw.state.fragments, STAR_XI_RANDOM_CUSTOM_CARD_COST - draw.cost + 25000);
  assert.equal(draw.state.ownedIds.filter((id) => id === owned.id).length, 1, "no second inventory entry");
});

test("bought and free special packs use the same draw, the free one has no 100 lock before Liga 3", () => {
  const hundred = STAR_XI_CUSTOM_PLAYERS.find((player) => cardPackRating(player) >= 100)!;
  const slice = (STAR_XI_CUSTOM_PLAYERS.indexOf(hundred) + 0.5) / N;
  const bought = purchaseSpecialCardPack({ ...initialGameFeatures(1000), starXI: state([], 200000) } as ReturnType<typeof initialGameFeatures>, "p-1", { random: () => slice, now: 1 });
  assert.ok(bought.ok && bought.reveal.player.id === hundred.id);
  const freeDraw = openEarnedPackDraw("special", [], 1, () => slice);
  assert.equal(freeDraw.player.id, hundred.id, "a free pack in league 1 draws the same card as a bought one");
  assert.equal(freeDraw.fragmentCompensation, 0);
  const features = initialGameFeatures(1000);
  features.seasonMode.highestDivision = 1;
  features.earnedPacks.push({ id: "gift-1", packId: "special", earnedAt: 1 });
  const reveal = openEarnedPack(features, "gift-1", 2, () => slice);
  assert.ok(reveal, "no longer refused below Liga 3");
  assert.equal(reveal.player.id, hundred.id);
  // A repeated request for the same pack gives nothing again.
  assert.equal(openEarnedPack(features, "gift-1", 3, () => slice), null);
});

test("saved packs and results stay: an opened free special pack and its card survive save and reload", () => {
  const features = initialGameFeatures(1000);
  features.earnedPacks.push({ id: "gift-2", packId: "special", earnedAt: 1 });
  const opened = openEarnedPack(features, "gift-2", 2, () => 0)!;
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.equal(reloaded.earnedPacks.find((pack) => pack.id === "gift-2")?.opening?.player.id, opened.player.id);
  assert.equal(reloaded.starXI.ownedIds.filter((id) => id === opened.player.id).length, 1);
  assert.equal(reloaded.starXI.fragments, features.starXI.fragments);
});

test("no draw rule, quota, lock or text of the old 100 category is left in the game code", () => {
  const feature = readFileSync(new URL("../app/feature-data.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../app/game-app.tsx", import.meta.url), "utf8");
  for (const source of [feature, ui]) assert.doesNotMatch(source, /SPECIAL_PACK_HUNDRED_CHANCE|SPECIAL_PACK_GROUPS|canDrawHundredSpecialCards|allowHundred|hundredChance|100er gibt es erst|nur 8% sind 100er|<em>100er Karte<\/em>/);
  assert.match(ui, /<em>Jede Karte<\/em>/);
  assert.match(SPECIAL_CARD_PACK.description, /gleich wahrscheinlich/);
});
