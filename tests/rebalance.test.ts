import assert from "node:assert/strict";
import test from "node:test";
import { UPGRADES } from "../app/game/upgrades.ts";
import { capGoalsAfterRebalance, getBasePassivePower, REBALANCED_FEATURES_SCHEMA } from "../app/game/economy.ts";
import { STORAGE_KEY, WHATS_NEW_STORAGE_KEY } from "../app/game/constants.ts";
import { cleanCloudSaveKeys } from "../app/cloud-save-rules.ts";
import { WHATS_NEW } from "../app/whats-new.ts";
import { GAME_FEATURES_SCHEMA_VERSION, drawRandomStarXICustomCard, getSpecialCardChances, getStarXIPlayer, getTournamentRewardPack, initialGameFeatures, normalizeGameFeatures, SPECIAL_PACK_HUNDRED_CHANCE, STAR_PACKS, STAR_XI_CUSTOM_PLAYERS, STAR_XI_RANDOM_CUSTOM_CARD_COST } from "../app/feature-data.ts";
import { getPackUnlockLeague, getUpgradeUnlockLeague } from "../app/season-progression.ts";
import { getFirstLevelPayback, simulateEconomy } from "../scripts/balance/economy-model.ts";

function seededRandom(seed = 97531) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const hundredIds = STAR_XI_CUSTOM_PLAYERS.filter((player) => player.rating === 100).map((player) => player.id);

test("Flurin Fabrice is one of the 100 rated special cards", () => {
  const flurin = getStarXIPlayer("star-flurin-fabrice")!;
  assert.equal(flurin.rating, 100);
  assert.equal(flurin.isCustom, true);
  assert.deepEqual(flurin.positions, ["ZM", "ZOM"]);
  assert.ok(hundredIds.includes(flurin.id));
});

test("the special card pack awards a 100 rated card in 8% of draws, weighted by pack weight", () => {
  const random = seededRandom();
  const counts = new Map<string, number>();
  const draws = 200000;
  for (let index = 0; index < draws; index += 1) {
    const result = drawRandomStarXICustomCard({ ...initialGameFeatures().starXI, fragments: STAR_XI_RANDOM_CUSTOM_CARD_COST }, random);
    counts.set(result.player!.id, (counts.get(result.player!.id) ?? 0) + 1);
  }
  const hundredShare = hundredIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0) / draws;
  assert.equal(SPECIAL_PACK_HUNDRED_CHANCE, 0.08);
  assert.ok(Math.abs(hundredShare - 0.08) < 0.004, `100 rated share ${hundredShare}`);
  const chances = getSpecialCardChances();
  assert.ok(Math.abs([...chances.values()].reduce((sum, chance) => sum + chance, 0) - 1) < 1e-12);
  for (const player of STAR_XI_CUSTOM_PLAYERS) {
    const expected = chances.get(player.id)!;
    assert.ok(Math.abs((counts.get(player.id) ?? 0) / draws - expected) < Math.max(0.001, 6 * Math.sqrt(expected * (1 - expected) / draws)), player.id);
  }
  // Every 100 rated card is equally rare and gets the legendary walkout.
  assert.equal(new Set(hundredIds.map((id) => chances.get(id)!.toFixed(12))).size, 1);
  assert.ok(hundredIds.every((id) => getStarXIPlayer(id)!.cardType === "legendary"));
});

test("100 rated special cards drawn before Liga 3 leave an old save once", () => {
  const old = initialGameFeatures();
  const keep = STAR_XI_CUSTOM_PLAYERS.find((player) => player.rating < 100 && !player.benchOnly)!;
  old.schemaVersion = 5;
  old.seasonMode.division = 11;
  old.seasonMode.highestDivision = 11;
  old.starXI.ownedIds = [hundredIds[0], hundredIds[1], hundredIds[2], keep.id];
  old.starXI.lineupIds[0] = hundredIds[0];
  old.starXI.benchIds[0] = hundredIds[1];
  old.career.collectedIds = [hundredIds[0], hundredIds[1], hundredIds[2], keep.id];
  const migrated = normalizeGameFeatures(JSON.parse(JSON.stringify(old)));
  assert.equal(migrated.schemaVersion, GAME_FEATURES_SCHEMA_VERSION);
  assert.deepEqual(migrated.starXI.ownedIds, [keep.id]);
  assert.ok(!migrated.starXI.lineupIds.some((id) => hundredIds.includes(id)));
  assert.ok(!migrated.starXI.benchIds.some((id) => hundredIds.includes(id)));
  assert.ok(!migrated.career.collectedIds.some((id) => hundredIds.includes(id)));
  assert.equal(migrated.history.at(-1)?.title, "Spezialkarten neu verteilt");
  assert.match(migrated.history.at(-1)!.detail, /^3 100er Karten wurden entfernt/);

  // The migration runs once: a card drawn later survives every further load.
  migrated.starXI.ownedIds.push(hundredIds[3]);
  assert.ok(normalizeGameFeatures(JSON.parse(JSON.stringify(migrated))).starXI.ownedIds.includes(hundredIds[3]));

  // A club that already reached Liga 3 keeps its cards.
  const top = JSON.parse(JSON.stringify(old));
  top.seasonMode.division = 13;
  top.seasonMode.highestDivision = 13;
  assert.equal(normalizeGameFeatures(top).starXI.ownedIds.length, 4);
});

test("tournament rewards follow the best league reached and the World Cup adds one tier", () => {
  assert.equal(getTournamentRewardPack("stadium", 1).id, "reward-1");
  assert.equal(getTournamentRewardPack("stadium", 3).id, "reward-1");
  assert.equal(getTournamentRewardPack("champions", 6).id, "reward-2");
  assert.equal(getTournamentRewardPack("champions", 9).id, "reward-3");
  assert.equal(getTournamentRewardPack("stadium", 11).id, "reward-4");
  assert.equal(getTournamentRewardPack("world", 12).id, "reward-6");
  assert.equal(getTournamentRewardPack("world", 15).id, "reward-6");
  assert.equal(getTournamentRewardPack("champions", 15).id, "reward-6");
});

test("economy grows evenly by league and packs cost real playing time", () => {
  const snapshots = simulateEconomy();
  for (const upgrade of UPGRADES.filter((item) => item.kind === "auto")) {
    assert.ok(getFirstLevelPayback(upgrade.id) >= 115, `${upgrade.id} pays back too fast`);
  }
  // Later upgrades take longer to pay back than earlier ones.
  const lateAuto = UPGRADES.filter((item) => item.kind === "auto" && getUpgradeUnlockLeague(item.id) <= 12);
  lateAuto.slice(1).forEach((upgrade, index) => assert.ok(getFirstLevelPayback(upgrade.id) > getFirstLevelPayback(lateAuto[index].id), upgrade.id));
  snapshots.slice(1).forEach((snapshot, index) => {
    const growth = snapshot.averageIncomePerSecond / snapshots[index].averageIncomePerSecond;
    assert.ok(growth <= 3.5, `Liga ${snapshot.league} grows by ${growth.toFixed(2)}`);
  });
  for (const pack of STAR_PACKS.filter((item) => item.id !== "scrap")) {
    const league = getPackUnlockLeague(pack.id);
    const income = snapshots.find((snapshot) => snapshot.league === league)!.averageIncomePerSecond;
    assert.ok(pack.price / income >= 15 * 60, `${pack.label} costs ${(pack.price / income / 60).toFixed(1)} minutes`);
  }
});

test("every upgrade description states its gain", () => {
  for (const upgrade of UPGRADES.filter((item) => item.kind !== "multiplier")) {
    const unit = upgrade.kind === "click" ? "pro Klick" : "pro Sekunde";
    assert.equal(upgrade.description, `+${upgrade.gain.toLocaleString("de-DE")} ${upgrade.gain === 1 ? "Tor" : "Tore"} ${unit}`);
  }
  assert.equal(UPGRADES.find((item) => item.id === "golden")!.description, `+${UPGRADES.find((item) => item.id === "golden")!.gain * 100}% Klickpower`);
  assert.equal(UPGRADES.find((item) => item.id === "legacy")!.description, `+${UPGRADES.find((item) => item.id === "legacy")!.gain * 100}% auf alle Einnahmen`);
});

test("goals saved under the old economy are capped once to one hour of new passive income", () => {
  const upgrades = { ballboy: 40, coach: 30, academy: 20, floodlight: 15, scout: 12, var: 10 };
  const features = initialGameFeatures();
  const hour = Math.floor(getBasePassivePower(upgrades, 0, features) * 3600);
  assert.ok(hour > 1_000_000);
  assert.equal(capGoalsAfterRebalance(9e12, { schemaVersion: 6 }, upgrades, 0, features), hour);
  assert.equal(features.history.at(-1)?.title, "Kontostand angepasst");
  // Saves without a schema count as old; small balances, new saves and the minimum stay untouched.
  assert.equal(capGoalsAfterRebalance(9e12, {}, upgrades, 0, initialGameFeatures()), hour);
  assert.equal(capGoalsAfterRebalance(hour - 1, { schemaVersion: 5 }, upgrades, 0, initialGameFeatures()), hour - 1);
  assert.equal(capGoalsAfterRebalance(9e12, { schemaVersion: REBALANCED_FEATURES_SCHEMA }, upgrades, 0, initialGameFeatures()), 9e12);
  assert.equal(capGoalsAfterRebalance(5e6, { schemaVersion: 6 }, {}, 0, initialGameFeatures()), 1_000_000);
  assert.ok(GAME_FEATURES_SCHEMA_VERSION >= REBALANCED_FEATURES_SCHEMA, "new saves are never capped");
});

test("release notes are listed newest first and their seen marker syncs with the cloud save", () => {
  assert.ok(WHATS_NEW.length > 0);
  assert.equal(new Set(WHATS_NEW.map((entry) => entry.id)).size, WHATS_NEW.length);
  const dates = WHATS_NEW.map((entry) => entry.id.slice(0, 10));
  assert.deepEqual(dates, [...dates].sort().reverse(), "ids start with the date, newest first");
  for (const entry of WHATS_NEW) {
    assert.match(entry.id, /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
    assert.ok(entry.title.trim() && entry.items.length && entry.items.every((item) => item.trim()));
  }
  const keys = cleanCloudSaveKeys({ [STORAGE_KEY]: JSON.stringify({ goals: 1 }), [WHATS_NEW_STORAGE_KEY]: WHATS_NEW[0].id });
  assert.equal(keys?.[WHATS_NEW_STORAGE_KEY], WHATS_NEW[0].id);
});

test("special cards with several words show a fixed name under the player on the ball", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const player of STAR_XI_CUSTOM_PLAYERS.filter((item) => item.name.includes(" "))) {
    assert.ok(player.pitchName, `${player.name} needs a pitch name`);
  }
  assert.equal(getStarXIPlayer("star-nedu-mann-yesss")!.pitchName, "Nedu");
  assert.equal(getStarXIPlayer("star-benxli")!.pitchName, "Mikeboy");
  assert.equal(getStarXIPlayer("star-silvuz")!.name, "Silvanzambi");
  const canvas = await readFile(new URL("../app/match-canvas-drawing.ts", import.meta.url), "utf8");
  assert.match(canvas, /owner\.caption\?\?owner\.label\.split\(' '\)\.slice\(-1\)\[0\]/);
});

test("every 100 rated card leaves the album once, whatever the league", () => {
  const save = initialGameFeatures();
  const inSquad = hundredIds[0], archived = hundredIds[1];
  const normal = STAR_XI_CUSTOM_PLAYERS.find((player) => player.rating < 100 && !player.benchOnly)!;
  const stats = { appearances: 30, minutes: 2700, goals: 60, assists: 30, ratingTotal: 240, ratedMatches: 30, motm: 12, subAppearances: 0, subRatingTotal: 0, subMinutes: 0, recent: [] };
  save.schemaVersion = 7;
  save.seasonMode.division = 14;
  save.seasonMode.highestDivision = 14;
  save.starXI.ownedIds = [inSquad, normal.id];
  save.starXI.lineupIds[0] = inSquad;
  save.career.collectedIds = [inSquad, archived, normal.id];
  save.career.players = { [inSquad]: stats, [archived]: stats, [normal.id]: stats };
  save.career.seasonPlayers = { [inSquad]: stats };
  save.career.milestoneCards = { [inSquad]: ["hero"], [archived]: ["hero"], [normal.id]: ["hero"] };
  const cleaned = normalizeGameFeatures(JSON.parse(JSON.stringify(save)));
  assert.equal(cleaned.schemaVersion, GAME_FEATURES_SCHEMA_VERSION);
  assert.ok(!cleaned.career.collectedIds.includes(archived), "no longer in the club archive");
  assert.equal(cleaned.career.milestoneCards[inSquad], undefined);
  assert.equal(cleaned.career.milestoneCards[archived], undefined);
  assert.equal(cleaned.career.players[inSquad], undefined);
  assert.equal(cleaned.career.players[archived], undefined);
  assert.equal(cleaned.career.seasonPlayers[inSquad], undefined);
  assert.ok(cleaned.starXI.ownedIds.includes(inSquad), "a card in the squad stays in the squad");
  assert.ok(cleaned.career.collectedIds.includes(normal.id));
  assert.ok(cleaned.career.milestoneCards[normal.id]?.length);
  assert.equal(cleaned.history.at(-1)?.title, "Sammelalbum bereinigt");
  // Runs once: later progress of a 100 rated card stays.
  cleaned.career.players[inSquad] = stats;
  const again = normalizeGameFeatures(JSON.parse(JSON.stringify(cleaned)));
  assert.ok(again.career.milestoneCards[inSquad]?.length);
});
