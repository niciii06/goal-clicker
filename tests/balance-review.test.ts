import assert from "node:assert/strict";
import test from "node:test";
import { UPGRADES } from "../app/game/upgrades.ts";
import { CLICK_PASSIVE_SHARE_CAP } from "../app/game/constants.ts";
import { getBaseClickPower, getBasePassivePower, getClickPassiveShare } from "../app/game/economy.ts";
import { ALBUM_MILESTONES, claimAlbumReward, getAlbumGroups } from "../app/career-data.ts";
import { DAILY_REWARD_DAYS, WORLD_DAILY_KEY, claimDailyReward, getDailyRewardStatus, getPreviousRewardDay, getRewardDay, mergeDailyRewardsForWorld } from "../app/daily-reward.ts";
import { MATCH_PACK_STAMP_TARGET, SCRAP_PACK_PLAYERS, STAR_PACKS, STAR_XI_CUSTOM_PLAYERS, STAR_XI_PLAYERS, STARTER_SQUAD_UNLOCK_CLICKS, awardMatchStamp, canStarXIPlayerFillSlot, getSeasonOpponentRating, getStarXIPlayer, grantWelcomePack, initialGameFeatures, maybeGrantStarterSquad, normalizeGameFeatures, openEarnedPack, openEarnedPackDraw, openStarPack } from "../app/feature-data.ts";
import { FULL_COMBO_FACTOR, activeClicks, clickUpgradeReport, simulateEconomy } from "../scripts/balance/economy-model.ts";

function seededRandom(seed = 4242) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const ROUND_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8];
function isRound(value: number) {
  const power = 10 ** Math.floor(Math.log10(value));
  return ROUND_STEPS.some((step) => Math.abs(value - step * power) < 1e-6 * value);
}

test("every pack price and every upgrade base price is a round amount", () => {
  for (const pack of STAR_PACKS) assert.ok(isRound(pack.price), `${pack.label}: ${pack.price}`);
  for (const upgrade of UPGRADES) assert.ok(isRound(upgrade.baseCost), `${upgrade.name}: ${upgrade.baseCost}`);
});

test("income keeps growing by at least a quarter per league in the late leagues", () => {
  const snapshots = simulateEconomy();
  for (const league of [5, 4, 3, 2, 1]) {
    const current = snapshots.find((snapshot) => snapshot.league === league)!;
    const previous = snapshots.find((snapshot) => snapshot.league === league + 1)!;
    const growth = current.averageIncomePerSecond / previous.averageIncomePerSecond;
    assert.ok(growth >= 1.25, `Liga ${league} grows by ${growth.toFixed(2)}`);
  }
});

test("click upgrades add a capped share of the passive income per click", () => {
  const shares = UPGRADES.filter((upgrade) => upgrade.passiveShare);
  assert.deepEqual(shares.map((upgrade) => upgrade.id), ["striker", "longshot", "freekick", "worldclass", "ballondor", "captain"]);
  // Together the maxima are exactly the cap, so no upgrade is pushed out by the others.
  assert.ok(Math.abs(shares.reduce((sum, upgrade) => sum + upgrade.passiveShareMax!, 0) - CLICK_PASSIVE_SHARE_CAP) < 1e-12);
  const maxed = Object.fromEntries(shares.map((upgrade) => [upgrade.id, 200]));
  assert.ok(Math.abs(getClickPassiveShare(maxed) - 0.05) < 1e-12);
  // Golden Boot raises the fixed goals per click, never the share beyond the cap.
  assert.ok(Math.abs(getClickPassiveShare({ ...maxed, golden: 8 }) - 0.05) < 1e-12);
  const levels = { ...maxed, ballboy: 100, coach: 50 };
  const passive = getBasePassivePower(levels);
  const fixed = getBaseClickPower({ ballboy: 100, coach: 50, ...Object.fromEntries(shares.map((upgrade) => [upgrade.id, 200])) }) - 0.05 * passive;
  assert.ok(fixed > 0);
  // Three clicks a second: +15% of the passive income without combo, about +34% with a full combo and streak.
  assert.ok(Math.abs(3 * CLICK_PASSIVE_SHARE_CAP - 0.15) < 1e-12);
  assert.ok(Math.abs(3 * CLICK_PASSIVE_SHARE_CAP * FULL_COMBO_FACTOR - 0.3366) < 1e-4);
  assert.equal(activeClicks(3, 4), 12 * FULL_COMBO_FACTOR);
});

test("the captain's armband pays back within 15 minutes in Liga 6 and every level still adds income", () => {
  const rows = clickUpgradeReport("captain", 6);
  assert.equal(rows.length, 8);
  assert.ok(rows[0].payback <= 15 * 60, `level 1 pays back in ${(rows[0].payback / 60).toFixed(1)} minutes`);
  rows.forEach((row) => assert.ok(row.gainThreeClicks > 0 && row.gainOneClick > 0, `level ${row.level} adds nothing`));
  rows.slice(1).forEach((row, index) => assert.ok(row.payback > rows[index].payback, `level ${row.level} pays back faster than ${rows[index].level}`));
});

test("Liga 1 opponents rise smoothly from Liga 2", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((index) => getSeasonOpponentRating(15, index)), [96, 90, 91, 94, 92]);
  assert.deepEqual([1, 2, 3, 4, 5].map((index) => getSeasonOpponentRating(14, index)), [86, 87, 89, 90, 92]);
});

test("the Schrott-Pack never hands out a card below an empty slot", () => {
  assert.ok(SCRAP_PACK_PLAYERS.length > 0 && SCRAP_PACK_PLAYERS.every((player) => player.rating >= 55));
  const random = seededRandom();
  for (let index = 0; index < 3000; index++) assert.ok(openStarPack("scrap", [], random).player.rating >= 55);
});

function welcomed() {
  const features = initialGameFeatures();
  grantWelcomePack(features, 1000, () => 0.5);
  return features;
}

test("the starter squad fills the eleven once after fifty clicks", () => {
  const features = welcomed();
  assert.equal(maybeGrantStarterSquad(features, STARTER_SQUAD_UNLOCK_CLICKS - 1, 2000, seededRandom()), null);
  assert.equal(features.starXI.ownedIds.length, 1);
  const result = maybeGrantStarterSquad(features, STARTER_SQUAD_UNLOCK_CLICKS, 2000, seededRandom())!;
  assert.equal(result.added.length, 10);
  assert.equal(result.complete, true);
  assert.equal(features.starXI.lineupIds.filter(Boolean).length, 11);
  assert.equal(new Set(features.starXI.ownedIds).size, 11);
  for (const player of result.added) {
    assert.ok(player.rating >= 55 && player.rating <= 69, `${player.name} ${player.rating}`);
    const slot = features.starXI.lineupIds.indexOf(player.id);
    assert.ok(canStarXIPlayerFillSlot(player.id, slot, features.starXI.formationPositions));
  }
  assert.ok(result.added.filter((player) => player.rating <= 59).length >= 8, "mostly 55 to 59");
  assert.match(features.history.at(-1)!.title, /^Starterkader: 10 Spieler/);
  assert.equal(maybeGrantStarterSquad(features, 500, 3000, seededRandom()), null);
  assert.equal(normalizeGameFeatures(JSON.parse(JSON.stringify(features))).starterSquadGranted, true);
});

test("a loaded save past fifty clicks gets the starter squad once, a full eleven never", () => {
  const loaded = normalizeGameFeatures(JSON.parse(JSON.stringify(welcomed())));
  assert.equal(loaded.starterSquadGranted, false);
  assert.ok(maybeGrantStarterSquad(loaded, 300, 2000, seededRandom())?.complete);
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(loaded)));
  assert.equal(maybeGrantStarterSquad(reloaded, 300, 3000, seededRandom()), null);
  // An older save that already fields eleven counts as served.
  const full = JSON.parse(JSON.stringify(loaded));
  delete full.starterSquadGranted;
  assert.equal(normalizeGameFeatures(full).starterSquadGranted, true);
  // No starter squad during a match.
  const playing = normalizeGameFeatures(JSON.parse(JSON.stringify(welcomed())));
  playing.cup.active = true;
  assert.equal(maybeGrantStarterSquad(playing, 300), null);
});

test("the starter squad reports a complete eleven only when eleven players stand in the lineup", () => {
  const features = initialGameFeatures();
  // Every scrap card is owned already, so no new one can fill the empty lineup.
  features.starXI.ownedIds = SCRAP_PACK_PLAYERS.map((player) => player.id);
  const result = maybeGrantStarterSquad(features, 100, 2000, seededRandom())!;
  assert.equal(result.added.length, 0);
  assert.equal(result.complete, false);
});

test("every fourth league match earns a reward pack for the best league reached", () => {
  const features = initialGameFeatures();
  features.seasonMode.highestDivision = 9;
  for (let match = 1; match < MATCH_PACK_STAMP_TARGET; match++) {
    assert.equal(awardMatchStamp(features, 1000 + match), null);
    assert.equal(features.matchStamps, match);
  }
  const earned = awardMatchStamp(features, 2000)!;
  assert.equal(earned.packId, "reward-3");
  assert.equal(features.matchStamps, 0);
  assert.deepEqual(features.earnedPacks.map((pack) => pack.id), ["stamp-2000"]);
  assert.match(features.history.at(-1)!.title, /^Matchstempel voll/);
  features.matchStamps = 2;
  assert.equal(normalizeGameFeatures(JSON.parse(JSON.stringify(features))).matchStamps, 2);
});

test("day seven brings a special card pack: no 100 below Liga 3, the normal chance from Liga 3 on", () => {
  assert.equal(DAILY_REWARD_DAYS[6].pack, "special");
  const random = seededRandom(77);
  for (let index = 0; index < 2000; index++) {
    const opening = openEarnedPackDraw("special", [], 12, random);
    assert.ok(opening.player.isCustom);
    assert.ok(opening.player.rating < 100, "no 100 below Liga 3");
  }
  // A low roll is the 100 group, and from Liga 3 on it is open.
  assert.equal(openEarnedPackDraw("special", [], 13, () => 0.01).player.rating, 100);
  assert.ok(openEarnedPackDraw("special", [], 12, () => 0.01).player.rating < 100);
  // The free pack is opened once, costs no fragments and refuses a 100 handed in below Liga 3.
  const features = initialGameFeatures();
  features.seasonMode.highestDivision = 5;
  features.earnedPacks = [{ id: "daily-solo-2026-10-30", packId: "special", earnedAt: 1 }];
  const hundred = STAR_XI_CUSTOM_PLAYERS.find((player) => player.rating === 100)!;
  assert.equal(openEarnedPack(features, "daily-solo-2026-10-30", 2, Math.random, { packId: "legend", packName: "x", player: hundred, duplicate: false, fragmentCompensation: 0, source: "custom-draw" }), null);
  const reveal = openEarnedPack(features, "daily-solo-2026-10-30", 2, seededRandom(5))!;
  assert.ok(reveal.player.isCustom && reveal.player.rating < 100);
  assert.equal(features.starXI.fragments, 0);
  assert.equal(openEarnedPack(features, "daily-solo-2026-10-30", 3), null);
  // The earned special pack and its opening survive a reload.
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.equal(reloaded.earnedPacks[0].packId, "special");
  assert.equal(reloaded.earnedPacks[0].opening?.player.id, reveal.player.id);
});

test("album goals pay fragments once for 10, 25 and 50 different cards", () => {
  assert.deepEqual(ALBUM_MILESTONES.map((goal) => [goal.cards, goal.reward]), [[10, 100], [25, 250], [50, 500]]);
  const features = initialGameFeatures();
  features.starXI.ownedIds = STAR_XI_PLAYERS.filter((player) => !player.retired).slice(0, 25).map((player) => player.id);
  features.career.collectedIds = [...features.starXI.ownedIds];
  const groups = getAlbumGroups(features.career);
  assert.deepEqual(groups.slice(0, 3).map((group) => [group.id, group.collected, group.total]), [["collect-10", 10, 10], ["collect-25", 25, 25], ["collect-50", 25, 50]]);
  assert.equal(claimAlbumReward(features, "collect-10"), true);
  assert.equal(claimAlbumReward(features, "collect-25"), true);
  assert.equal(claimAlbumReward(features, "collect-50"), false);
  assert.equal(claimAlbumReward(features, "collect-10"), false);
  assert.equal(features.starXI.fragments, 350);
});

test("old per seat daily rewards merge into one world entry without an extra claim", () => {
  const now = Date.now(), today = getRewardDay(now), yesterday = getPreviousRewardDay(today), before = getPreviousRewardDay(yesterday);
  // The host claimed today on a short streak, the guest yesterday on a long one: today stays claimed, the long streak lives on.
  const merged = mergeDailyRewardsForWorld({ host: { day: today, streak: 2 }, guest: { day: yesterday, streak: 6 } });
  assert.deepEqual(merged, { [WORLD_DAILY_KEY]: { day: today, streak: 6 } });
  assert.equal(getDailyRewardStatus(merged, WORLD_DAILY_KEY, now).claimedToday, true);
  assert.equal(claimDailyReward(merged, WORLD_DAILY_KEY, 100, 1, now), null);
  // A streak that broke before yesterday starts over, and today is open.
  const broken = mergeDailyRewardsForWorld({ host: { day: before, streak: 9 } });
  assert.deepEqual(broken, { [WORLD_DAILY_KEY]: { day: before, streak: 9 } });
  const status = getDailyRewardStatus(broken, WORLD_DAILY_KEY, now);
  assert.equal(status.available, true);
  assert.equal(status.streak, 1);
  // A second run changes nothing; a world entry wins over leftover seats.
  assert.deepEqual(mergeDailyRewardsForWorld(merged), merged);
  assert.deepEqual(mergeDailyRewardsForWorld({ world: { day: yesterday, streak: 3 }, host: { day: today, streak: 1 } }), { world: { day: yesterday, streak: 3 } });
  assert.deepEqual(mergeDailyRewardsForWorld({}), {});
  assert.ok(getStarXIPlayer(STAR_XI_CUSTOM_PLAYERS[0].id));
});
