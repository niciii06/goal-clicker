import assert from "node:assert/strict";
import test from "node:test";
import { UPGRADES } from "../app/game/upgrades.ts";
import { drawRandomStarXICustomCard, getSpecialCardChances, getStarXIPlayer, getTournamentRewardPack, initialGameFeatures, normalizeGameFeatures, SPECIAL_PACK_HUNDRED_CHANCE, STAR_PACKS, STAR_XI_CUSTOM_PLAYERS, STAR_XI_RANDOM_CUSTOM_CARD_COST } from "../app/feature-data.ts";
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
  assert.deepEqual(flurin.positions, ["ZM"]);
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
  // GOAT Nicu keeps the lowest pack weight and stays the rarest card.
  assert.equal(Math.min(...hundredIds.map((id) => chances.get(id)!)), chances.get("star-goat-nicu"));
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
  assert.equal(migrated.schemaVersion, 6);
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
