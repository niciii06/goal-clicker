import assert from "node:assert/strict";
import test from "node:test";
import { UPGRADES } from "../app/game/upgrades.ts";
import { CLICK_PASSIVE_SHARE_CAP, MAX_MULTIPLIER_LEVEL, MINI_GAME_IDS } from "../app/game/constants.ts";
import { roundPrice } from "../app/upgrade-purchase.ts";
import { MINI_GAME_BASE_MAX_REWARD, MINI_GAME_MAX_REWARD_SECONDS, getBulkPurchase, getCostAtLevel, getBaseClickPower, getBasePassivePower, getClickPassiveShare, getMiniGameMaxReward, scaleMiniGameReward } from "../app/game/economy.ts";
import { ALBUM_MILESTONES, ALBUM_REWARD_SECONDS, claimAlbumReward, claimAlbumRewards, claimAllAlbumRewards, getAlbumGoalReward, getAlbumGroups } from "../app/career-data.ts";
import { DAILY_REWARD_DAYS, WORLD_DAILY_KEY, claimDailyReward, getDailyRewardStatus, getPreviousRewardDay, getRewardDay, mergeDailyRewardsForWorld } from "../app/daily-reward.ts";
import type { RewardPackId, StarXIPlayer } from "../app/feature-data.ts";
import { beginSeasonCupMatch, getStarXISelection, pauseGameFeatureTimers, setBestStarXI, MIN_DRAWABLE_RATING, REWARD_PACKS, cardPackRating, getRewardPackOdds, resolveRandomEvent, resolveVarEvent, SCRAP_PACK_PLAYERS, STAR_PACKS, STAR_XI_CUSTOM_PLAYERS, STAR_XI_PLAYERS, STARTER_SQUAD_UNLOCK_CLICKS, canStarXIPlayerFillSlot, getSeasonOpponentRating, getStarXIPlayer, grantWelcomePack, initialGameFeatures, maybeGrantStarterSquad, normalizeGameFeatures, openEarnedPack, openEarnedPackDraw, openStarPack } from "../app/feature-data.ts";
import { prepareCareerMatch, recordCareerMatch } from "../app/career-data.ts";
import { DEFAULT_FAN_MOOD, FAN_MOOD_RESULT_CHANGE, applyMatchResultToFanMood } from "../app/press-conference.ts";
import { expectedHomeCrowd } from "../app/ticket-income.ts";
import { FULL_COMBO_FACTOR, activeClicks, clickUpgradeReport, savingMinutes, simulateEconomy } from "../scripts/balance/economy-model.ts";

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

/** Significant digits of the shortest decimal text JavaScript prints for the price (what players see). */
function significantDigits(value: number) {
  const [digits] = value.toExponential().split("e");
  return digits.replace(".", "").replace(/0+$/, "").length;
}

test("every upgrade level costs at most two significant digits, more than the level before, and bulk buys add them up", () => {
  for (const upgrade of UPGRADES) {
    assert.equal(getCostAtLevel(upgrade, 0), upgrade.baseCost, `${upgrade.name}: level 0 keeps the round base price`);
    const levels = upgrade.kind === "multiplier" ? MAX_MULTIPLIER_LEVEL : 2000;
    let previous = 0;
    let passedHuge = false;
    for (let level = 0; level < levels; level++) {
      const cost = getCostAtLevel(upgrade, level);
      if (!Number.isFinite(cost)) break;
      assert.ok(Number.isInteger(cost) && cost >= 1, `${upgrade.name} Stufe ${level + 1}: ${cost}`);
      assert.ok(significantDigits(cost) <= 2, `${upgrade.name} Stufe ${level + 1}: ${cost} has more than two significant digits`);
      // No floating point noise such as 1.0000000000000001e26 or 9.999999999999999e25.
      assert.equal(cost, Number(cost.toPrecision(2)), `${upgrade.name} Stufe ${level + 1}: ${cost} is not built cleanly`);
      assert.ok(cost > previous, `${upgrade.name} Stufe ${level + 1} costs ${cost}, not more than ${previous}`);
      // Two digits are at most 5% off the curve; the strict increase bump may add one more step.
      const raw = upgrade.baseCost * upgrade.scale ** level;
      assert.ok(Math.abs(cost - raw) <= 0.1 * raw, `${upgrade.name} Stufe ${level + 1}: ${cost} for ${raw}`);
      previous = cost;
      if (cost > 1e30) passedHuge = true;
      if (cost > 1e32) break;
    }
    if (upgrade.kind !== "multiplier") assert.ok(passedHuge, `${upgrade.name} was not checked beyond 1e30`);
    // x10 and MAX charge exactly the single level prices, also at high levels.
    for (const start of [3, 150, 250]) {
      if (upgrade.kind === "multiplier" && start > 3) continue;
      const ten = getBulkPurchase(upgrade, { [upgrade.id]: start }, Number.MAX_VALUE, 10);
      const expected = Array.from({ length: ten.count }, (_, index) => getCostAtLevel(upgrade, start + index)).reduce((sum, cost) => sum + cost, 0);
      assert.equal(ten.totalCost, expected);
      assert.equal(ten.count, upgrade.kind === "multiplier" ? MAX_MULTIPLIER_LEVEL - 3 : 10);
    }
    const budget = getCostAtLevel(upgrade, 0) + getCostAtLevel(upgrade, 1);
    assert.deepEqual(getBulkPurchase(upgrade, {}, budget, "max"), { count: 2, totalCost: budget });
    assert.deepEqual(getBulkPurchase(upgrade, {}, budget - 1, "max"), { count: 1, totalCost: getCostAtLevel(upgrade, 0) });
  }
  const captain = UPGRADES.find((upgrade) => upgrade.id === "captain")!;
  assert.deepEqual(Array.from({ length: 11 }, (_, level) => getCostAtLevel(captain, level) / 1e6), [75, 110, 150, 210, 300, 430, 610, 870, 1200, 1800, 2500]);
  const ballboy = UPGRADES.find((upgrade) => upgrade.id === "ballboy")!;
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => getCostAtLevel(ballboy, 10 + index)), [93, 100, 120, 130, 150, 160, 180]);
  const brand = UPGRADES.find((upgrade) => upgrade.id === "brand")!;
  assert.deepEqual([176, 177, 178].map((level) => getCostAtLevel(brand, level)), [9.3e25, 1.2e26, 1.5e26]);
  // Pack prices and base prices keep the coarse round grid.
  assert.deepEqual([12, 17.5, 26, 34, 44, 55, 69, 77, 79, 91, 1234].map(roundPrice), [10, 20, 25, 30, 40, 60, 75, 75, 80, 100, 1000]);
  assert.equal(roundPrice(Infinity), Infinity);
});

test("the strict increase bumps a level to the next two digit price when the curve rounds onto the level before", () => {
  // Scale 1.04 from 10: the curve stays near 10 and 11, so levels are pushed up one whole step at a time.
  const slow = { id: "slow", baseCost: 10, scale: 1.04, kind: "auto" } as unknown as Parameters<typeof getCostAtLevel>[0];
  assert.deepEqual(Array.from({ length: 6 }, (_, level) => getCostAtLevel(slow, level)), [10, 11, 12, 13, 14, 15]);
  // Around 99 the next step is 100, then 110.
  const edge = { id: "edge", baseCost: 98, scale: 1.005, kind: "auto" } as unknown as Parameters<typeof getCostAtLevel>[0];
  assert.deepEqual(Array.from({ length: 4 }, (_, level) => getCostAtLevel(edge, level)), [98, 99, 100, 110]);
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

test("reward packs never hand out a card below 55 and show the odds they draw with", () => {
  assert.equal(MIN_DRAWABLE_RATING, 55);
  const random = seededRandom(55);
  for (const pack of REWARD_PACKS) {
    const odds = getRewardPackOdds(pack.id as RewardPackId);
    // The shown rows are the rows drawn from: all at 55 or above, every row has cards, together 100%.
    assert.ok(odds.every((row) => row.minRating >= 55 && row.players.length > 0 && row.players.every((player) => player.rating >= row.minRating && player.rating <= row.maxRating)));
    assert.ok(Math.abs(odds.reduce((sum, row) => sum + row.chance, 0) - 1) < 1e-9);
    for (let index = 0; index < 1500; index++) assert.ok(openStarPack(pack.id, [], random).player.rating >= 55, pack.label);
  }
  // The smallest pack keeps its 60% weakest row, now from 55 to 64.
  const small = getRewardPackOdds("reward-1");
  assert.equal(small[0].label, "Gewöhnlich 55–64");
  assert.ok(Math.abs(small[0].chance - 0.6) < 1e-9);
});

test("every album group can be completed, Nation IN with the cards of the Schrott-Pack", () => {
  const scrap = new Set(SCRAP_PACK_PLAYERS.map((player) => player.id));
  const rewardBase = (player: StarXIPlayer) => !player.isCustom && player.cardType !== "icon" && player.cardType !== "legendary";
  const drawable = (player: StarXIPlayer) => player.isCustom || scrap.has(player.id)
    || STAR_PACKS.some((pack) => pack.id !== "scrap" && pack.odds.some((row) => row.chance > 0 && cardPackRating(player) >= row.minRating && cardPackRating(player) <= row.maxRating))
    || (rewardBase(player) && REWARD_PACKS.some((pack) => getRewardPackOdds(pack.id as RewardPackId).some((row) => row.players.some((candidate) => candidate.id === player.id))));
  const features = initialGameFeatures();
  features.career.collectedIds = STAR_XI_PLAYERS.filter((player) => !player.retired && drawable(player)).map((player) => player.id);
  const groups = getAlbumGroups(features.career);
  for (const group of groups) assert.equal(group.collected, group.total, `${group.label}: ${group.collected} / ${group.total}`);
  // Nation IN: exactly the 81 cards of the Schrott-Pack, so the Schrott-Pack alone completes it.
  const india = groups.find((group) => group.id === "nation-IN")!;
  assert.equal(india.total, SCRAP_PACK_PLAYERS.length);
  const onlyScrap = initialGameFeatures();
  onlyScrap.starXI.ownedIds = SCRAP_PACK_PLAYERS.map((player) => player.id);
  const before = onlyScrap.starXI.fragments;
  assert.equal(claimAlbumReward(onlyScrap, "nation-IN"), true);
  assert.equal(onlyScrap.starXI.fragments, before + 500);
  // A club that kept weaker Indian cards loses nothing: they simply no longer count.
  const old = initialGameFeatures();
  old.career.collectedIds = STAR_XI_PLAYERS.filter((player) => player.countryCode === "IN").map((player) => player.id);
  assert.equal(getAlbumGroups(old.career).find((group) => group.id === "nation-IN")!.collected, SCRAP_PACK_PLAYERS.length);
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

test("league matches no longer earn reward packs: no stamp rule, old counters and packs load unchanged", async () => {
  const { readFileSync } = await import("node:fs");
  const featureSource = readFileSync(new URL("../app/feature-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(featureSource, /awardMatchStamp|MATCH_PACK_STAMP_TARGET/);
  for (const file of ["../app/page.tsx", "../app/api/multiplayer/route.ts", "../app/season-panel.tsx"]) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), "utf8"), /awardMatchStamp|MATCH_PACK_STAMP_TARGET|Matchstempel/, file);
  }
  // A save from before the change: a stamp counter and an unopened stamp pack stay as they are, nothing is added.
  const features = initialGameFeatures();
  features.matchStamps = 3;
  features.earnedPacks = [{ id: "stamp-2000", packId: "reward-3", earnedAt: 2000 }];
  const loaded = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  assert.equal(loaded.matchStamps, 3);
  assert.deepEqual(loaded.earnedPacks.map((pack) => pack.id), ["stamp-2000"]);
});

test("day seven brings a special card pack: no 100 below Liga 3, the normal chance from Liga 3 on", () => {
  assert.equal(DAILY_REWARD_DAYS[6].pack, "special");
  const random = seededRandom(77);
  for (let index = 0; index < 2000; index++) {
    const opening = openEarnedPackDraw("special", [], 12, random);
    assert.ok(opening.player.isCustom);
    assert.ok(cardPackRating(opening.player) < 100, "no 100 below Liga 3");
  }
  // A low roll is the 100 group, and from Liga 3 on it is open.
  assert.equal(cardPackRating(openEarnedPackDraw("special", [], 13, () => 0.01).player), 100);
  assert.ok(cardPackRating(openEarnedPackDraw("special", [], 12, () => 0.01).player) < 100);
  // The free pack is opened once, costs no fragments and refuses a 100 handed in below Liga 3.
  const features = initialGameFeatures();
  features.seasonMode.highestDivision = 5;
  features.earnedPacks = [{ id: "daily-solo-2026-10-30", packId: "special", earnedAt: 1 }];
  const hundred = STAR_XI_CUSTOM_PLAYERS.find((player) => cardPackRating(player) === 100)!;
  assert.equal(openEarnedPack(features, "daily-solo-2026-10-30", 2, Math.random, { packId: "legend", packName: "x", player: hundred, duplicate: false, fragmentCompensation: 0, source: "custom-draw" }), null);
  const reveal = openEarnedPack(features, "daily-solo-2026-10-30", 2, seededRandom(5))!;
  assert.ok(reveal.player.isCustom && cardPackRating(reveal.player) < 100);
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

test("album groups also pay seconds of income in goals, once, at the income of the claim", () => {
  const features = initialGameFeatures();
  features.starXI.ownedIds = SCRAP_PACK_PLAYERS.map((player) => player.id);
  const groups = getAlbumGroups({ ...features.career, collectedIds: features.starXI.ownedIds });
  const india = groups.find((group) => group.id === "nation-IN")!, scrap = groups.find((group) => group.id === "scrap")!;
  assert.equal(india.rewardSeconds, ALBUM_REWARD_SECONDS.nation);
  assert.equal(getAlbumGoalReward(india, 2_000_000), 240_000_000);
  // Nothing without income, never negative.
  assert.equal(getAlbumGoalReward(india, 0), 0);
  assert.equal(getAlbumGoalReward(india, -5), 0);
  const single = claimAlbumRewards(features, "nation-IN", 1000);
  assert.deepEqual(single, { claimed: 1, fragments: 500, goals: 120_000 });
  assert.match(features.history.at(-1)!.detail, /\+500 Fragmente und \+120.000 Tore/);
  assert.deepEqual(claimAlbumRewards(features, "nation-IN", 1000), { claimed: 0, fragments: 0, goals: 0 });
  // "all" claims every other complete group: the milestones up to 50 cards and the scrap page.
  const all = claimAlbumRewards(features, "all", 1000);
  assert.equal(all.claimed, 4);
  assert.equal(all.fragments, 100 + 250 + 500 + scrap.reward);
  assert.equal(all.goals, (60 + 120 + 300 + ALBUM_REWARD_SECONDS.scrap) * 1000);
  assert.equal(claimAlbumRewards(features, "all", 1000).claimed, 0);
  // The old fragment-only helpers still work and pay no goals.
  const old = initialGameFeatures();
  old.starXI.ownedIds = SCRAP_PACK_PLAYERS.map((player) => player.id);
  assert.equal(claimAlbumReward(old, "all"), false);
  assert.equal(claimAlbumReward(old, "scrap"), true);
  assert.equal(claimAllAlbumRewards(old), 4);
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

test("mini game rewards grow with the income and keep the old amounts as the floor", () => {
  // A new club: the fixed amounts of before.
  assert.equal(scaleMiniGameReward("penalty", 1000, 0), 1000);
  assert.equal(scaleMiniGameReward("dribble", 60, 5), 60);
  // 1 Mio per second: the best run pays its seconds of income, a weaker run its share of the best run.
  for (const id of MINI_GAME_IDS) {
    assert.equal(getMiniGameMaxReward(id, 1_000_000), MINI_GAME_MAX_REWARD_SECONDS[id] * 1_000_000);
    assert.equal(getMiniGameMaxReward(id, 0), MINI_GAME_BASE_MAX_REWARD[id]);
  }
  assert.equal(scaleMiniGameReward("penalty", 250, 1_000_000), 2_500_000);
  assert.equal(scaleMiniGameReward("prediction", 335, 1_000_000), 15_000_000);
  // The server cap holds every reward an honest client computes.
  for (const id of MINI_GAME_IDS) for (const income of [0, 50, 3e4, 9e7]) {
    for (let base = 0; base <= MINI_GAME_BASE_MAX_REWARD[id]; base += 5) assert.ok(scaleMiniGameReward(id, base, income) <= getMiniGameMaxReward(id, income));
  }
  // From Liga 13 on a perfect penalty run is worth ten seconds of passive income instead of under one second.
  const liga13 = simulateEconomy().find((snapshot) => snapshot.league === 13)!.passivePerSecond;
  assert.ok(liga13 > 1000);
  assert.equal(getMiniGameMaxReward("penalty", liga13), Math.floor(10 * liga13));
});

test("VAR and random events hit a saving club like before: the same typical swing, no total loss", () => {
  const random = seededRandom(31);
  const income = 1000;
  const vars: number[] = [], events: number[] = [];
  for (let run = 0; run < 3000; run++) {
    // A club meets an event with zero to eight minutes of income in the bank.
    const goals = random() * 480 * income;
    vars.push(resolveVarEvent(goals, income, random()).amount / income);
    events.push(resolveRandomEvent(goals, income, random()).amount / income);
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  // Before: a typical VAR took about 70 seconds of income, a typical event gave about 4.
  assert.ok(median(vars) <= -60 && median(vars) >= -100, `VAR median ${median(vars)}`);
  assert.ok(mean(vars) < 0 && mean(vars) > -30, `VAR mean ${mean(vars)}`);
  assert.ok(median(events) >= 3 && median(events) <= 6, `event median ${median(events)}`);
  // Nothing takes more than ten minutes of income.
  assert.ok(Math.min(...vars, ...events) >= -600);
  // The dearest pack: the wait one run in ten exceeds stays well below the 34 minutes of the balance based VAR.
  const legend = simulateEconomy().find((snapshot) => snapshot.league === 4)!;
  const stats = savingMinutes(legend.incomePerSecond, STAR_PACKS.find((pack) => pack.id === "legend")!.price, legend.passivePerSecond);
  assert.ok(stats.p90 <= 28, `Legenden P90 ${stats.p90}`);
});

function finishedMatch(home: number, away: number, now = 1_000_000, penalties?: [number, number]) {
  let f = initialGameFeatures(now);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => cardPackRating(p) < 95).slice(0, 200).map((p) => p.id) });
  f = normalizeGameFeatures(f);
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  f.cup.homeScore = home;
  f.cup.awayScore = away;
  if (penalties) {
    f.cup.penaltyHomeScore = penalties[0];
    f.cup.penaltyAwayScore = penalties[1];
    f.cup.penaltyEvents = [{ id: 'p1', side: 'home', taker: 'A', scored: penalties[0] > 0, homeScore: penalties[0], awayScore: penalties[1], createdAt: now } as never];
  }
  f.cup.active = false;
  return f;
}

test('a result moves the fan mood: win up, draw a little, loss down, with a drift to the middle', () => {
  assert.deepEqual(FAN_MOOD_RESULT_CHANGE, { win: 3, draw: 1, loss: -3 });
  assert.equal(applyMatchResultToFanMood(50, 'win'), 53);
  assert.equal(applyMatchResultToFanMood(50, 'draw'), 51);
  assert.equal(applyMatchResultToFanMood(50, 'loss'), 47);
  // One point back toward 50 for every full ten points away.
  assert.equal(applyMatchResultToFanMood(60, 'win'), 62);
  assert.equal(applyMatchResultToFanMood(95, 'draw'), 92);
  assert.equal(applyMatchResultToFanMood(20, 'loss'), 20);
  // Never outside 0 to 100, also from broken values.
  assert.equal(applyMatchResultToFanMood(100, 'win'), 98);
  assert.equal(applyMatchResultToFanMood(0, 'loss'), 2);
  assert.equal(applyMatchResultToFanMood(Number.NaN, 'win'), DEFAULT_FAN_MOOD + 2);
  // Long runs settle: wins around 80, losses around 20, draws a little above the middle.
  const run = (outcome: 'win' | 'draw' | 'loss') => Array.from({ length: 60 }).reduce<number>((mood) => applyMatchResultToFanMood(mood, outcome), 50);
  assert.ok(run('win') >= 78 && run('win') <= 82, `wins ${run('win')}`);
  assert.ok(run('loss') >= 18 && run('loss') <= 22, `losses ${run('loss')}`);
  assert.ok(run('draw') >= 50 && run('draw') <= 60, `draws ${run('draw')}`);
});

test('every finished match changes the fan mood exactly once', () => {
  const win = finishedMatch(2, 0);
  assert.equal(win.press.fanMood, DEFAULT_FAN_MOOD);
  recordCareerMatch(win, 1_200_000);
  assert.equal(win.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'win'));
  // Recording the same match again, also after a reload, changes nothing.
  recordCareerMatch(win, 1_300_000);
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(win)));
  recordCareerMatch(reloaded, 1_400_000);
  const restored = pauseGameFeatureTimers(JSON.parse(JSON.stringify(win)), 20_000, 1_500_000);
  recordCareerMatch(restored, 1_600_000);
  assert.equal(win.press.fanMood, reloaded.press.fanMood);
  assert.equal(restored.press.fanMood, win.press.fanMood);

  const draw = finishedMatch(1, 1);
  recordCareerMatch(draw, 1_200_000);
  assert.equal(draw.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'draw'));
  const loss = finishedMatch(0, 3);
  recordCareerMatch(loss, 1_200_000);
  assert.equal(loss.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'loss'));
  // A shoot-out decides the match for the fans.
  const shootoutWin = finishedMatch(1, 1, 1_000_000, [5, 4]);
  recordCareerMatch(shootoutWin, 1_200_000);
  assert.equal(shootoutWin.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'win'));
  const shootoutLoss = finishedMatch(1, 1, 1_000_000, [3, 4]);
  recordCareerMatch(shootoutLoss, 1_200_000);
  assert.equal(shootoutLoss.press.fanMood, applyMatchResultToFanMood(DEFAULT_FAN_MOOD, 'loss'));
  // A running match changes nothing yet.
  const running = finishedMatch(3, 0);
  running.cup.active = true;
  recordCareerMatch(running, 1_200_000);
  assert.equal(running.press.fanMood, DEFAULT_FAN_MOOD);
});

test('the fan mood after a run of results fills or empties the home crowd', () => {
  const happy = initialGameFeatures(), angry = initialGameFeatures();
  for (let match = 0; match < 15; match++) {
    happy.press.fanMood = applyMatchResultToFanMood(happy.press.fanMood, 'win');
    angry.press.fanMood = applyMatchResultToFanMood(angry.press.fanMood, 'loss');
  }
  assert.ok(happy.press.fanMood > angry.press.fanMood + 40);
  assert.ok(expectedHomeCrowd(happy) > expectedHomeCrowd(angry));
});
