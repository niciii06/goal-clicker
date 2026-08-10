import assert from "node:assert/strict";
import test from "node:test";
import { advanceCupMatch, beginCupMatch, canStarXIPlayerFillSlot, getCupMatchStrength, getCupPlayerMatchRating, getGoalBoostedPassiveReward, getGoalBoostMultiplier, getRandomEventDelay, getStarFormation, getStarXIPlayerMatchRating, getTournamentGoalBoostMultiplier, initialGameFeatures, openStarPack, pauseGameFeatureTimers, resolveRandomEvent, resolveVarEvent, setStarXIBenchPlayer, setStarXIStarter, startTournamentGoalBoost, STAR_PACKS, STAR_XI_PLAYERS, TOURNAMENT_GOAL_BOOST_DURATION_MS } from "../app/feature-data.ts";
import { MAX_PUBLIC_LEADERBOARD_SCORE, parseLeaderboardScore, preserveLeaderboardProgress } from "../app/leaderboard-safety.ts";
import { getSeasonPath } from "../app/season-progression.ts";
import { calculateBulkUpgradePurchase, getUpgradeCostAtLevel } from "../app/upgrade-purchase.ts";

function seededRandom(seed = 246813579) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function positionGroup(position: string) {
  if (position === "TW") return "goalkeeper";
  if (["LV", "LAV", "IV", "RV", "RAV"].includes(position)) return "defence";
  if (["ZDM", "ZM", "ZOM", "LM", "RM"].includes(position)) return "midfield";
  return "attack";
}

test("pack odds are complete and remain intentionally conservative", () => {
  for (const pack of STAR_PACKS) {
    assert.ok(Math.abs(pack.odds.reduce((sum, band) => sum + band.chance, 0) - 1) < 1e-9);
  }
  const scout = STAR_PACKS.find((pack) => pack.id === "scout")!;
  const elite = STAR_PACKS.find((pack) => pack.id === "elite")!;
  const legend = STAR_PACKS.find((pack) => pack.id === "legend")!;
  assert.ok(Math.abs(scout.odds.slice(2).reduce((sum, band) => sum + band.chance, 0) - 0.01) < 1e-9);
  assert.ok(Math.abs(elite.odds.slice(2).reduce((sum, band) => sum + band.chance, 0) - 0.07) < 1e-9);
  assert.ok(Math.abs(legend.odds.slice(2).reduce((sum, band) => sum + band.chance, 0) - 0.4) < 1e-9);

  const expectedHundredChances = { scout: 0.00001, elite: 0.0001, legend: 0.01 };
  for (const pack of STAR_PACKS) {
    const topWalkout = pack.odds.find((band) => band.minRating === 90 && band.maxRating === 99)!;
    const hundred = pack.odds.find((band) => band.minRating === 100 && band.maxRating === 100)!;
    assert.equal(hundred.chance, expectedHundredChances[pack.id as keyof typeof expectedHundredChances]);
    assert.ok(hundred.chance < topWalkout.chance, `${pack.id} rating 100 must remain rarer than 90–99`);
    if (pack.id !== "legend") assert.ok(hundred.chance * 90 < topWalkout.chance, `${pack.id} rating 100 must remain much rarer than 90–99`);
  }
});

test("pack positions follow a football squad distribution instead of source ordering", () => {
  const random = seededRandom();
  const counts = { goalkeeper: 0, defence: 0, midfield: 0, attack: 0 };
  const pulls = 12000;
  for (let index = 0; index < pulls; index += 1) {
    const opening = openStarPack("scout", [], random);
    counts[positionGroup(opening.player.position) as keyof typeof counts] += 1;
  }
  assert.ok(counts.goalkeeper / pulls > 0.07 && counts.goalkeeper / pulls < 0.12);
  assert.ok(counts.defence / pulls > 0.32 && counts.defence / pulls < 0.41);
  assert.ok(counts.midfield / pulls > 0.23 && counts.midfield / pulls < 0.32);
  assert.ok(counts.attack / pulls > 0.23 && counts.attack / pulls < 0.32);
});

test("duplicates stay close to one in twenty while unseen cards remain", () => {
  const ownedIds = STAR_XI_PLAYERS.filter((_, index) => index % 2 === 0).map((player) => player.id);
  const random = seededRandom(97531);
  const pulls = 16000;
  let duplicates = 0;
  for (let index = 0; index < pulls; index += 1) if (openStarPack("elite", ownedIds, random).duplicate) duplicates += 1;
  const duplicateRate = duplicates / pulls;
  assert.ok(duplicateRate > 0.04 && duplicateRate < 0.06, `duplicate rate was ${duplicateRate}`);
});

test("late season targets keep growing instead of collapsing into ten second seasons", () => {
  const seasonNine = getSeasonPath(Number.MAX_SAFE_INTEGER, 8).target;
  const seasonFifteen = getSeasonPath(Number.MAX_SAFE_INTEGER, 14).target;
  const finalSeason = getSeasonPath(Number.MAX_SAFE_INTEGER, 19).target;
  assert.equal(seasonNine, 64000000);
  assert.ok(seasonFifteen > 1000000000);
  assert.ok(finalSeason > 10000000000);
});

test("tournament strength really uses seventy percent squad and thirty percent tactics", () => {
  const cup = beginCupMatch(initialGameFeatures(1000).cup, 1000, "champions");
  cup.strategyId = "angriff";
  cup.opponentStrategyId = "ballbesitz";
  const strength = getCupMatchStrength(cup, 90);
  assert.equal(strength.tactical.score, 72);
  assert.equal(strength.teamStrength, 84.6);
  assert.equal(strength.opponentStrength, 61.6);
});

test("complete tournament wins award the exact three-minute goal boosts", () => {
  const now = 1000000;
  const expected = { stadium: 1.5, champions: 2, world: 3 } as const;
  for (const [tournamentId, multiplier] of Object.entries(expected)) {
    const boost = startTournamentGoalBoost(tournamentId as keyof typeof expected, now);
    assert.equal(getTournamentGoalBoostMultiplier(tournamentId as keyof typeof expected), multiplier);
    assert.equal(boost.endsAt - boost.startedAt, TOURNAMENT_GOAL_BOOST_DURATION_MS);
    assert.equal(getGoalBoostMultiplier(boost, now), multiplier);
    assert.equal(getGoalBoostMultiplier(boost, now + TOURNAMENT_GOAL_BOOST_DURATION_MS - 1), multiplier);
    assert.equal(getGoalBoostMultiplier(boost, now + TOURNAMENT_GOAL_BOOST_DURATION_MS), 1);
  }
});

test("tournament rounds and trophies no longer award direct goals", () => {
  const now = 1000000;
  const cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium");
  cup.round = 2;
  cup.homeScore = 1;
  cup.awayScore = 0;
  cup.lastTickAt = cup.matchEndsAt;
  const result = advanceCupMatch(cup, 100, cup.matchEndsAt, () => 0.5);
  assert.equal(result.tournamentWon, true);
  assert.equal("reward" in result, false);
  assert.doesNotMatch(result.cup.lastResult, /\+?[\d.,]+\s*Tore/i);
});

test("goal boosts multiply only the active part of passive production", () => {
  const now = 1000000;
  const boost = startTournamentGoalBoost("stadium", now);
  assert.equal(getGoalBoostedPassiveReward(100, boost, now, now + 200000), 29000);
  assert.equal(getGoalBoostedPassiveReward(100, boost, now - 20000, now + 20000), 5000);
});

test("a closed game pauses the remaining tournament boost", () => {
  const now = 1000000;
  const features = initialGameFeatures(now);
  features.goalBoost = startTournamentGoalBoost("champions", now);
  const resumedAt = now + 60000;
  const resumed = pauseGameFeatureTimers(features, 60000, resumedAt);
  assert.equal(resumed.goalBoost.endsAt, now + TOURNAMENT_GOAL_BOOST_DURATION_MS + 60000);
  assert.equal(getGoalBoostMultiplier(resumed, resumedAt), 2);
});

test("match form is stable, gradual and goals improve it", () => {
  const startedAt = 123456789;
  const early = getStarXIPlayerMatchRating("star-goat-nicu", startedAt, 5);
  const late = getStarXIPlayerMatchRating("star-goat-nicu", startedAt, 75);
  const repeated = getStarXIPlayerMatchRating("star-goat-nicu", startedAt, 75);
  const withGoal = getStarXIPlayerMatchRating("star-goat-nicu", startedAt, 75, 1);
  assert.ok(Math.abs(early - 6.35) < 0.7);
  assert.ok(Math.abs(late - early) < 2.2);
  assert.equal(repeated, late);
  assert.ok(withGoal > late);
});

test("bench players have no live form until they enter the match", () => {
  const cup = beginCupMatch(initialGameFeatures(1000).cup, 1000, "stadium", [], [], [], []);
  assert.equal(getCupPlayerMatchRating(cup, "star-goat-nicu", 40), null);
  cup.playerEnteredAt["star-goat-nicu"] = 35;
  assert.notEqual(getCupPlayerMatchRating(cup, "star-goat-nicu", 40), null);
});

test("AZB upgrades ignore overflowed prices while multiplier caps remain", () => {
  const normalUpgrade = { baseCost: 25, scale: 1.42, kind: "click" };
  assert.equal(getUpgradeCostAtLevel(normalUpgrade, 10000), Infinity);
  assert.deepEqual(calculateBulkUpgradePurchase(normalUpgrade, 10000, 0, "max", { unlimitedMoney: true }), { count: 1000, totalCost: 0 });
  assert.deepEqual(calculateBulkUpgradePurchase(normalUpgrade, 10000, Number.MAX_VALUE, 1), { count: 0, totalCost: 0 });

  const multiplier = { baseCost: 900000000, scale: 1.58, kind: "multiplier" };
  assert.deepEqual(calculateBulkUpgradePurchase(multiplier, 7, 0, 100, { unlimitedMoney: true, maxMultiplierLevel: 8 }), { count: 1, totalCost: 0 });
  assert.deepEqual(calculateBulkUpgradePurchase(multiplier, 8, 0, 100, { unlimitedMoney: true, maxMultiplierLevel: 8 }), { count: 0, totalCost: 0 });
});

test("drag-style squad moves swap starters, bench and reserve without losing players", () => {
  const formation = getStarFormation("433");
  const used = new Set<string>();
  const lineupIds = formation.slots.map((_, index) => {
    const player = STAR_XI_PLAYERS.find((candidate) => !used.has(candidate.id) && canStarXIPlayerFillSlot(candidate.id, index, formation.slots.map((slot) => slot.position)))!;
    assert.ok(player);
    used.add(player.id);
    return player.id;
  });
  const benchStarter = STAR_XI_PLAYERS.find((candidate) => !used.has(candidate.id) && canStarXIPlayerFillSlot(candidate.id, 0, formation.slots.map((slot) => slot.position)))!;
  used.add(benchStarter.id);
  const remainingPlayers = STAR_XI_PLAYERS.filter((candidate) => !used.has(candidate.id)).slice(0, 7);
  const benchIds = [benchStarter.id, ...remainingPlayers.slice(0, 6).map((player) => player.id)];
  const reservePlayer = remainingPlayers[6];
  const state = {
    ownedIds: [...lineupIds, ...benchIds, reservePlayer.id],
    lineupIds,
    benchIds,
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  };

  const oldStarter = lineupIds[0];
  const afterLiveStyleSwap = setStarXIStarter(state, 0, benchStarter.id);
  assert.equal(afterLiveStyleSwap.lineupIds[0], benchStarter.id);
  assert.equal(afterLiveStyleSwap.benchIds[0], oldStarter);

  const displacedBenchPlayer = afterLiveStyleSwap.benchIds[1];
  const afterReserveDrop = setStarXIBenchPlayer(afterLiveStyleSwap, 1, reservePlayer.id);
  assert.equal(afterReserveDrop.benchIds[1], reservePlayer.id);
  assert.equal(afterReserveDrop.lineupIds.includes(displacedBenchPlayer) || afterReserveDrop.benchIds.includes(displacedBenchPlayer), false);
  assert.ok(afterReserveDrop.ownedIds.includes(displacedBenchPlayer));
});

test("VAR keeps its exact timing, probability and payout rules", () => {
  assert.equal(getRandomEventDelay(0), 60000);
  assert.equal(getRandomEventDelay(0.999999), 179999);
  assert.equal(resolveVarEvent(1000, 0).amount, 500);
  assert.ok(resolveVarEvent(1000, 0.199999).amount >= 2499);
  assert.equal(resolveVarEvent(1000, 0.2).amount, -100);
  assert.ok(resolveVarEvent(1000, 0.999999).amount <= -699);

  const random = seededRandom(20260808);
  let positive = 0;
  const samples = 20000;
  for (let index = 0; index < samples; index += 1) if (resolveVarEvent(1000, random()).amount > 0) positive += 1;
  assert.ok(positive / samples > 0.19 && positive / samples < 0.21);
});

test("Johhny Elefantino remains a one-percent random-event risk", () => {
  assert.equal(resolveRandomEvent(1000, 0.009).id, "elefantino");
  assert.equal(resolveRandomEvent(1000, 0.01).id === "elefantino", false);
});

test("leaderboard rejects extreme values and never rolls total progress back", () => {
  assert.equal(parseLeaderboardScore(-1), null);
  assert.equal(parseLeaderboardScore(Number.POSITIVE_INFINITY), null);
  assert.equal(parseLeaderboardScore(MAX_PUBLIC_LEADERBOARD_SCORE * 10), null);
  assert.equal(parseLeaderboardScore(123456), 123456);
  assert.equal(preserveLeaderboardProgress(9000, 2000), 9000);
  assert.equal(preserveLeaderboardProgress(9000, 12000), 12000);
});
