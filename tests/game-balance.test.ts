import assert from "node:assert/strict";
import test from "node:test";
import { FC27_OFFICIAL_POSITION_COUNT, FC27_POSITION_BY_SOURCE_ID } from "../app/fc27-positions.ts";
import { FC27_OFFICIAL_RATING_COUNT, FC27_RATING_BY_SOURCE_ID, FC27_UNAVAILABLE_SOURCE_IDS } from "../app/fc27-ratings.ts";
import { activatePendingTransferLoans, advanceCupMatch, applyCupSubstitution, beginCupMatch, beginSeasonCupMatch, canStarXIPlayerFillSlot, completeTournamentRun, drawRandomStarXICustomCard, finishActiveTransferLoans, getCupMatchStrength, getCupPlayerMatchRating, getGoalBoostedPassiveReward, getGoalBoostMultiplier, getOpenTransferSquadVacancies, getRandomEventDelay, getStarFormation, getStarXIEffectiveMatchRating, getStarXIPlayerMatchRating, getStarXISelection, getStarXIFragmentCompensation, getTournamentGoalBoostMultiplier, getTournamentOpponentSchedule, getTransferDeadlineEventDelay, getTransferEventDelay, getUnavailableStarXIPlayerIds, initialGameFeatures, initialSeasonMode, isTransferDeadlineDay, normalizeGameFeatures, openStarPack, pauseGameFeatureTimers, playSeasonModeMatch, recordSeasonModeMatch, resolveRandomEvent, resolveTransferInsiderEvent, resolveVarEvent, restoreStarXIAfterMatch, resumeCupMatch, setBestStarXI, setStarXIBenchPlayer, setStarXIStarter, shouldTriggerPackTroll, startSeasonPrestige, startTournamentGoalBoost, STAR_PACKS, STAR_XI_BENCH_SIZE, STAR_XI_CUSTOM_PLAYERS, STAR_XI_PLAYERS, STAR_XI_RANDOM_CUSTOM_CARD_COST, STAR_XI_SQUAD_SIZE, TOURNAMENTS, TOURNAMENT_COOLDOWN_MS, TOURNAMENT_OPPONENT_MULTIPLIER, TOURNAMENT_GOAL_BOOST_DURATION_MS, TRANSFER_DEADLINE_LOAN_CHANCE, TRANSFER_LOAN_CHANCE, TRANSFER_PAID_SALE_CHANCE, TRANSFER_SALE_CHANCE, YB_FC26_SOURCE_IDS } from "../app/feature-data.ts";
import { getPackUnlockSeason, getSeasonPath } from "../app/season-progression.ts";
import { calculateBulkUpgradePurchase, getUpgradeCostAtLevel } from "../app/upgrade-purchase.ts";

function seededRandom(seed = 246813579) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function sequenceRandom(values: number[], fallback = 0.5) {
  let index = 0;
  return () => values[index++] ?? fallback;
}

function transferReadyFeatures(now = 1000) {
  const features = initialGameFeatures(now);
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.map((player) => player.id) });
  return features;
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

test("pack prices and season unlocks match the current progression", () => {
  const scout = STAR_PACKS.find((pack) => pack.id === "scout")!;
  const legend = STAR_PACKS.find((pack) => pack.id === "legend")!;
  assert.equal(scout.price, 25000);
  assert.equal(getPackUnlockSeason("legend"), 10);
  assert.equal(legend.label, "Legenden Pack");
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

test("duplicates always award fragments instead of goal compensation", () => {
  const allOwned = STAR_XI_PLAYERS.map((player) => player.id);
  const opening = openStarPack("scout", allOwned, () => 0);
  assert.equal(opening.duplicate, true);
  assert.equal(opening.fragmentCompensation, getStarXIFragmentCompensation(opening.player));
  assert.equal("compensation" in opening, false);
});

test("fragment compensation rises with rating and card rarity", () => {
  const normal68 = STAR_XI_PLAYERS.find((player) => !player.isCustom && !player.cardType && player.rating === 68)!;
  const normal69 = STAR_XI_PLAYERS.find((player) => !player.isCustom && !player.cardType && player.rating === 69)!;
  const highestNormal = Math.max(...STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.cardType).map((player) => getStarXIFragmentCompensation(player)));
  const icon = STAR_XI_PLAYERS.find((player) => player.cardType === "icon")!;
  const special = STAR_XI_CUSTOM_PLAYERS.find((player) => player.rating === 67)!;

  assert.ok(getStarXIFragmentCompensation(normal69) > getStarXIFragmentCompensation(normal68));
  assert.ok(getStarXIFragmentCompensation(icon) > getStarXIFragmentCompensation(normal69));
  assert.ok(getStarXIFragmentCompensation(special) > getStarXIFragmentCompensation(normal68));
  assert.ok(getStarXIFragmentCompensation(special) > highestNormal);
  assert.notEqual(getStarXIFragmentCompensation(normal68), getStarXIFragmentCompensation(normal69));
});

test("custom cards are only available through the fixed random 25k fragment draw", () => {
  assert.ok(STAR_XI_CUSTOM_PLAYERS.length > 0);
  const initial = initialGameFeatures(1000).starXI;
  const opening = drawRandomStarXICustomCard({ ...initial, fragments: STAR_XI_RANDOM_CUSTOM_CARD_COST }, () => 0);
  assert.equal(opening.drawn, true);
  assert.equal(opening.cost, STAR_XI_RANDOM_CUSTOM_CARD_COST);
  assert.ok(opening.player?.isCustom);
  assert.equal(opening.state.fragments, 0);
  assert.equal(opening.state.ownedIds.includes(opening.player!.id), true);

  const duplicate = drawRandomStarXICustomCard({ ...initial, fragments: STAR_XI_RANDOM_CUSTOM_CARD_COST, ownedIds: [opening.player!.id] }, () => 0);
  assert.equal(duplicate.drawn, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.fragmentCompensation, getStarXIFragmentCompensation(opening.player!));
  assert.equal(duplicate.state.fragments, getStarXIFragmentCompensation(opening.player!));
});

test("contains every tracked YB player with its FC27 rating where available", () => {
  const ybPlayers = YB_FC26_SOURCE_IDS.map((sourceId) => STAR_XI_PLAYERS.find((player) => player.sourceId === sourceId));
  assert.equal(ybPlayers.filter(Boolean).length, YB_FC26_SOURCE_IDS.length);
  assert.equal(new Set(ybPlayers.filter(Boolean).map((player) => player!.sourceId)).size, YB_FC26_SOURCE_IDS.length);
  ybPlayers.forEach((player) => {
    assert.ok(player);
    assert.ok(player!.rating >= 65 && player!.rating <= 99);
  });
  assert.equal(ybPlayers.find((player) => player!.sourceId === "234913")!.rating, 73);
  assert.equal(ybPlayers.find((player) => player!.sourceId === "193468")!.rating, 71);
  assert.equal(ybPlayers.find((player) => player!.sourceId === "225533")!.rating, 70);
});

test("FC27 ratings cover every current base card without changing stable player IDs", () => {
  const officialIds = Object.keys(FC27_RATING_BY_SOURCE_ID);
  const unavailableIds = new Set<string>(FC27_UNAVAILABLE_SOURCE_IDS);
  const basePlayers = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.cardType);

  assert.equal(officialIds.length, FC27_OFFICIAL_RATING_COUNT);
  assert.equal(FC27_OFFICIAL_RATING_COUNT, 1406);
  assert.equal(unavailableIds.size, 107);
  assert.deepEqual(officialIds.filter((sourceId) => unavailableIds.has(sourceId)), []);
  assert.equal(new Set(basePlayers.map((player) => player.sourceId)).size, basePlayers.length);
  assert.deepEqual(
    basePlayers.filter((player) => !player.sourceId || (!(player.sourceId in FC27_RATING_BY_SOURCE_ID) && !unavailableIds.has(player.sourceId))),
    [],
  );
  assert.equal(FC27_RATING_BY_SOURCE_ID["239085"], 91);
  assert.equal(FC27_RATING_BY_SOURCE_ID["277427"], 83);
  assert.equal(FC27_RATING_BY_SOURCE_ID["203376"], 88);
});

test("FC27 primary and alternate positions cover the same official base cards", () => {
  const ratingIds = Object.keys(FC27_RATING_BY_SOURCE_ID).sort();
  const positionIds = Object.keys(FC27_POSITION_BY_SOURCE_ID).sort();
  const unavailableIds = new Set<string>(FC27_UNAVAILABLE_SOURCE_IDS);
  const allowedPositions = new Set(["TW", "LV", "LAV", "IV", "RV", "RAV", "ZDM", "ZM", "ZOM", "LM", "RM", "LF", "RF", "MS", "ST"]);
  const basePlayers = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.cardType);

  assert.equal(FC27_OFFICIAL_POSITION_COUNT, 1406);
  assert.equal(positionIds.length, FC27_OFFICIAL_POSITION_COUNT);
  assert.deepEqual(positionIds, ratingIds);
  assert.deepEqual(positionIds.filter((sourceId) => unavailableIds.has(sourceId)), []);

  Object.values(FC27_POSITION_BY_SOURCE_ID).forEach((positions) => {
    assert.ok(positions.length >= 1 && positions.length <= 4);
    assert.equal(new Set(positions).size, positions.length);
    positions.forEach((position) => assert.ok(allowedPositions.has(position), `unsupported FC27 position ${position}`));
  });

  basePlayers.forEach((player) => {
    if (player.sourceId && player.sourceId in FC27_POSITION_BY_SOURCE_ID) {
      assert.deepEqual(player.positions, FC27_POSITION_BY_SOURCE_ID[player.sourceId]);
      assert.equal(player.position, player.positions[0]);
    }
  });

  assert.deepEqual(FC27_POSITION_BY_SOURCE_ID["234378"], ["ZDM", "ZM"]);
  assert.deepEqual(FC27_POSITION_BY_SOURCE_ID["231747"], ["ST", "LF"]);
  assert.deepEqual(FC27_POSITION_BY_SOURCE_ID["277643"], ["RF", "RM"]);
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
  assert.equal(strength.opponentStrength, Math.round((0.7 * cup.opponentRating + 0.3 * 28) * 10) / 10);
});

test("tournaments draw four times as many tier-safe opponents as they have rounds", () => {
  for (const tournament of TOURNAMENTS) {
    assert.equal(tournament.opponents.length, tournament.rounds * TOURNAMENT_OPPONENT_MULTIPLIER);
    const schedule = getTournamentOpponentSchedule(tournament, () => 0.15);
    assert.equal(schedule.length, tournament.rounds);
    assert.equal(new Set(schedule).size, tournament.rounds);
    schedule.forEach((opponentId) => assert.ok(tournament.opponents.some((opponent) => opponent.id === opponentId)));

    const alternateSchedule = getTournamentOpponentSchedule(tournament, () => 0.95);
    assert.notDeepEqual(alternateSchedule, schedule);
  }

  const stadium = TOURNAMENTS.find((tournament) => tournament.id === "stadium")!;
  assert.ok(stadium.opponents.every((opponent) => opponent.rating <= 68));
  assert.equal(stadium.opponents.some((opponent) => opponent.name.includes("Paris Saint")), false);

  const features = initialGameFeatures(1000);
  features.cup = beginCupMatch(features.cup, 1000, "world", [], [], [], [], seededRandom(4242));
  const restored = normalizeGameFeatures(features);
  assert.deepEqual(restored.cup.opponentIds, features.cup.opponentIds);
  assert.equal(restored.cup.opponent, features.cup.opponent);
  assert.equal(restored.cup.opponentRating, features.cup.opponentRating);
});

test("best XI chooses a full valid high-rated lineup without duplicate players", () => {
  const formation = getStarFormation("433");
  const state = {
    ...initialGameFeatures(1000).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  };
  const best = setBestStarXI(state);
  const selected = best.lineupIds.filter(Boolean);
  assert.equal(selected.length, 11);
  assert.equal(new Set(selected).size, 11);
  assert.equal(best.benchIds.length, STAR_XI_BENCH_SIZE);
  assert.equal(best.benchIds.filter(Boolean).length, STAR_XI_BENCH_SIZE);
  selected.forEach((playerId, index) => assert.equal(canStarXIPlayerFillSlot(playerId, index, best.formationPositions), true));
  assert.equal(best.lineupIds[0], "star-maetthu");
  assert.ok(best.lineupIds.includes("star-goat-nicu"));
});

test("best XI bench only contains players who fit the active formation", () => {
  const formation = getStarFormation("343");
  const state = {
    ...initialGameFeatures(1000).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  };
  const best = setBestStarXI(state);
  const activePositions = new Set(best.formationPositions);
  best.benchIds.filter(Boolean).forEach((playerId) => {
    const player = STAR_XI_PLAYERS.find((candidate) => candidate.id === playerId)!;
    assert.ok(player.positions.some((position) => activePositions.has(position)), `${player.name} is not usable in ${formation.label}`);
  });
});

test("best XI bench spreads available players across the active roles", () => {
  const formation = getStarFormation("433");
  const state = {
    ...initialGameFeatures(1000).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  };
  const best = setBestStarXI(state);
  const benchPlayers = best.benchIds.filter(Boolean).map((playerId) => STAR_XI_PLAYERS.find((player) => player.id === playerId)!);
  const activeRoles = new Set(best.formationPositions.map((position) => position === "TW" ? "goalkeeper" : ["LV", "LAV", "IV", "RV", "RAV"].includes(position) ? "defence" : ["ZDM", "ZM", "ZOM", "LM", "RM"].includes(position) ? "midfield" : "attack"));
  const benchRoles = new Set(benchPlayers.flatMap((player) => player.positions.filter((position) => best.formationPositions.includes(position)).map((position) => position === "TW" ? "goalkeeper" : ["LV", "LAV", "IV", "RV", "RAV"].includes(position) ? "defence" : ["ZDM", "ZM", "ZOM", "LM", "RM"].includes(position) ? "midfield" : "attack")));
  for (const role of activeRoles) assert.ok(benchRoles.has(role), `bank does not cover ${role}`);
});

test("best XI bench mirrors a back three without overloading the number ten role", () => {
  const formation = getStarFormation("3412");
  const state = {
    ...initialGameFeatures(1000).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  };
  const best = setBestStarXI(state);
  const benchPlayers = best.benchIds.filter(Boolean).map((playerId) => STAR_XI_PLAYERS.find((player) => player.id === playerId)!);
  const centreBacks = benchPlayers.filter((player) => player.positions.includes("IV"));
  const attackingMidfielders = benchPlayers.filter((player) => player.positions.includes("ZOM"));

  assert.ok(centreBacks.length >= 3, `back three only had ${centreBacks.length} centre-back replacements`);
  assert.ok(attackingMidfielders.length <= 2, `single number ten role produced ${attackingMidfielders.length} replacements`);
  new Set(best.formationPositions).forEach((position) => assert.ok(benchPlayers.some((player) => player.positions.includes(position)), `bank does not cover ${position}`));
});

test("best XI bench keeps at most one dedicated goalkeeper", () => {
  const formation = getStarFormation("433");
  const state = {
    ...initialGameFeatures(1000).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  };
  const best = setBestStarXI(state);
  const dedicatedGoalkeepers = best.benchIds
    .filter(Boolean)
    .map((playerId) => STAR_XI_PLAYERS.find((player) => player.id === playerId)!)
    .filter((player) => player.positions.length > 0 && player.positions.every((position) => position === "TW"));
  assert.ok(dedicatedGoalkeepers.length <= 1);
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

test("a won tournament round pauses before the next manual kickoff", () => {
  const now = 1000000;
  const cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium");
  cup.homeScore = 1;
  cup.awayScore = 0;
  cup.lastTickAt = cup.matchEndsAt;

  const result = advanceCupMatch(cup, 100, cup.matchEndsAt, () => 0.5);

  assert.equal(result.finished, true);
  assert.equal(result.won, true);
  assert.equal(result.nextRoundStarted, false);
  assert.equal(result.cup.active, false);
  assert.equal(result.cup.pendingNextRound, true);
  assert.equal(result.cup.nextTournamentAt, 0);
  assert.equal(result.cup.round, 1);
  assert.match(result.cup.lastResult, /manuell/i);
  assert.equal(normalizeGameFeatures({ ...initialGameFeatures(now), cup: result.cup }).cup.pendingNextRound, true);

  const restarted = beginCupMatch(result.cup, now + 1000, "stadium");
  assert.equal(restarted.active, true);
  assert.equal(restarted.round, 1);
});

test("a completed tournament blocks a new run for exactly five minutes", () => {
  const now = 1000000;
  const cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium");
  cup.homeScore = 0;
  cup.awayScore = 1;
  cup.lastTickAt = cup.matchEndsAt;

  const result = advanceCupMatch(cup, 100, cup.matchEndsAt, () => 0.5);

  assert.equal(result.runEnded, true);
  assert.equal(result.cup.nextTournamentAt, cup.matchEndsAt + TOURNAMENT_COOLDOWN_MS);
  assert.equal(normalizeGameFeatures({ ...initialGameFeatures(now), cup: result.cup }).cup.nextTournamentAt, result.cup.nextTournamentAt);
  assert.equal(beginCupMatch(result.cup, result.cup.nextTournamentAt - 1, "stadium").active, false);
  const restarted = beginCupMatch(result.cup, result.cup.nextTournamentAt, "stadium");
  assert.equal(restarted.active, true);
  assert.equal(restarted.nextTournamentAt, 0);
});

test("manual tournament rounds never reuse the previous opponent after restore", () => {
  const now = 1000000;
  let cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium", [], [], [], [], () => 0.5);
  const opponents: string[] = [];

  for (let round = 0; round < 3; round += 1) {
    opponents.push(cup.opponent);
    cup.homeScore = 1;
    cup.awayScore = 0;
    cup.lastTickAt = cup.matchEndsAt;
    const result = advanceCupMatch(cup, 100, cup.matchEndsAt, () => 0.5);
    assert.equal(result.won, true);
    if (round < 2) {
      const restored = normalizeGameFeatures({
        ...initialGameFeatures(now),
        cup: { ...result.cup, opponentIds: [] },
      }).cup;
      cup = beginCupMatch(restored, now + (round + 1) * 1000, "stadium");
    }
  }

  assert.equal(new Set(opponents).size, opponents.length);
});

test("season mode advances by table matches and resets after ten fixtures", () => {
  let state = initialSeasonMode("FC Goal");
  const random = seededRandom(424242);
  let lastEntry: ReturnType<typeof playSeasonModeMatch>["entry"] = null;
  for (let matchday = 0; matchday < 10; matchday += 1) {
    const result = playSeasonModeMatch(state, 82, "FC Goal", 2000000 + matchday, random);
    assert.equal(result.played, true);
    state = result.state;
    lastEntry = result.entry;
  }
  assert.equal(lastEntry?.completedSeason, true);
  assert.equal(state.history.length, 10);
  assert.equal(state.matchday, 0);
  assert.equal(state.table.every((team) => team.played === 0), true);
  assert.ok(state.lastTable.some((team) => team.played > 0));
  assert.ok(state.lastResult.length > 0);
});

test("season fixtures use the live cup state and record the real final score", () => {
  const now = 3000000;
  const features = initialGameFeatures(now);
  const starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.map((player) => player.id) });
  const homePlayers = getStarXISelection(starXI.ownedIds, starXI.lineupIds);
  const started = beginSeasonCupMatch(features.cup, features.seasonMode, now, homePlayers, starXI.formationPositions, starXI.lineupIds, starXI.benchIds);

  assert.equal(started.mode, "season");
  assert.equal(started.active, true);
  assert.equal(started.matchEndsAt, now + 180000);
  assert.deepEqual(started.originalLineupIds, starXI.lineupIds);
  assert.deepEqual(started.originalBenchIds, starXI.benchIds);
  assert.equal(started.opponentIds.length, 1);

  const recorded = recordSeasonModeMatch(features.seasonMode, 3, 1, "FC Goal", now + 180000, () => 0.5, started.opponentIds[0]);
  assert.equal(recorded.played, true);
  assert.equal(recorded.entry?.clubScore, 3);
  assert.equal(recorded.entry?.opponentScore, 1);
  assert.equal(recorded.state.matchday, 1);
  assert.equal(recorded.state.table.find((team) => team.id === "club")?.points, 3);
  assert.equal(recorded.state.lastTable.find((team) => team.id === "club")?.points, 3);
});

test("Hall of Fame prestige starts a fresh table without losing the record", () => {
  const hallOfFame = { ...initialSeasonMode("FC Goal"), division: 15, highestDivision: 15, hallOfFame: true, prestigeCount: 2 };
  const prestige = startSeasonPrestige(hallOfFame, "FC Goal", 3000000);
  assert.equal(prestige.hallOfFame, false);
  assert.equal(prestige.division, 1);
  assert.equal(prestige.highestDivision, 15);
  assert.equal(prestige.prestigeCount, 3);
  assert.equal(prestige.table.every((team) => team.played === 0), true);
});

test("a red card removes the player and blocks the next round until replacement", () => {
  const now = 1000000;
  const formation = getStarFormation("433");
  const state = setBestStarXI({
    ...initialGameFeatures(now).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  });
  const homePlayers = getStarXISelection(state.ownedIds, state.lineupIds);
  const cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium", homePlayers, state.formationPositions, state.lineupIds, state.benchIds, () => 0.5);
  const ratingBeforeCard = getStarXIEffectiveMatchRating(state.ownedIds, state.lineupIds, cup, 1);
  const shortMatch = { ...cup, matchEndsAt: now + 1000 };
  const shortResult = advanceCupMatch(shortMatch, ratingBeforeCard, now + 1000, () => 0, homePlayers, state.formationPositions);
  const ratingAfterCard = getStarXIEffectiveMatchRating(state.ownedIds, state.lineupIds, shortResult.cup, 1);
  assert.ok(ratingAfterCard < ratingBeforeCard - 5);
  assert.ok(getCupMatchStrength(shortResult.cup, ratingAfterCard).teamStrength < getCupMatchStrength(cup, ratingBeforeCard).teamStrength - 3);

  const result = advanceCupMatch(cup, 100, cup.matchEndsAt, () => 0, homePlayers, state.formationPositions);
  const card = result.cup.cardEvents[0];

  assert.ok(card);
  assert.equal(card.card, "red");
  assert.equal(card.side, "home");
  assert.ok(card.reason.length > 0);
  assert.equal(result.cup.suspendedPlayerIds.includes(card.playerId!), true);
  assert.equal(result.cup.pendingNextRound, true);
  assert.equal(result.nextRoundStarted, false);

  const restored = restoreStarXIAfterMatch(state, result.cup);
  assert.equal(restored.lineupIds.includes(card.playerId!), false);
  assert.equal(restored.benchIds.includes(card.playerId!), false);
  assert.equal(restored.lineupIds.filter(Boolean).length, 10);

  const emptySlot = restored.lineupIds.findIndex((playerId) => !playerId);
  const replacement = STAR_XI_PLAYERS.find((player) => !restored.lineupIds.includes(player.id) && !restored.benchIds.includes(player.id) && canStarXIPlayerFillSlot(player.id, emptySlot, restored.formationPositions));
  assert.ok(replacement);
  const replaced = setStarXIStarter(restored, emptySlot, replacement!.id, result.cup.suspendedPlayerIds);
  assert.equal(replaced.lineupIds.filter(Boolean).length, STAR_XI_SQUAD_SIZE);
  assert.equal(result.cup.suspendedPlayerIds.some((playerId) => replaced.lineupIds.includes(playerId) || replaced.benchIds.includes(playerId)), false);

  const restarted = beginCupMatch(result.cup, now + 200000, "stadium", getStarXISelection(replaced.ownedIds, replaced.lineupIds), replaced.formationPositions, replaced.lineupIds, replaced.benchIds, () => 0.5);
  assert.equal(restarted.active, true);
  assert.equal(restarted.round, 1);
  assert.deepEqual(restarted.suspendedPlayerIds, []);
});

test("a live injury pauses the match and a replacement resumes it", () => {
  const now = 4000000;
  const formation = getStarFormation("433");
  const state = setBestStarXI({
    ...initialGameFeatures(now).starXI,
    ownedIds: STAR_XI_PLAYERS.map((player) => player.id),
    formationId: formation.id,
    formationPositions: formation.slots.map((slot) => slot.position),
  });
  const homePlayers = getStarXISelection(state.ownedIds, state.lineupIds);
  const cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium", homePlayers, state.formationPositions, state.lineupIds, state.benchIds, () => 0.5);
  const injuryRolls = sequenceRandom([0.5, 0.0001, 0.5, 0.5, 0.5]);
  const result = advanceCupMatch({ ...cup, matchEndsAt: now + 3000 }, 82, now + 1000, injuryRolls, homePlayers, state.formationPositions);
  const injury = result.cup.lastInjury;
  assert.ok(injury);
  assert.equal(result.cup.matchPaused, true);
  assert.equal(result.cup.injuryEvents.length, 1);
  assert.equal(result.cup.injuredPlayerIds[injury!.playerId], injury!.matches);
  assert.equal(normalizeGameFeatures({ ...initialGameFeatures(now), cup: result.cup }).cup.matchPaused, true);

  const incoming = state.benchIds.map((playerId) => STAR_XI_PLAYERS.find((player) => player.id === playerId)).find((player): player is typeof STAR_XI_PLAYERS[number] => Boolean(player));
  assert.ok(incoming);
  const substitution = applyCupSubstitution(result.cup, injury!.playerId, incoming!.id, injury!.minute);
  assert.equal(substitution.cup.matchPaused, false);
  assert.equal(resumeCupMatch(result.cup).matchPaused, false);
});

test("substitutions update both live OVR and match momentum", () => {
  const now = 1000000;
  const formation = getStarFormation("433");
  const positions = formation.slots.map((slot) => slot.position);
  const outgoing = [...STAR_XI_PLAYERS].sort((first, second) => first.rating - second.rating).find((player) => canStarXIPlayerFillSlot(player.id, 0, positions))!;
  const incoming = STAR_XI_PLAYERS.find((player) => player.id !== outgoing.id && player.rating > outgoing.rating && canStarXIPlayerFillSlot(player.id, 0, positions))!;
  assert.ok(outgoing);
  assert.ok(incoming);
  const state = {
    ...initialGameFeatures(now).starXI,
    ownedIds: [outgoing.id, incoming.id],
    lineupIds: [outgoing.id, ...Array.from({ length: STAR_XI_SQUAD_SIZE - 1 }, () => "")],
    benchIds: [incoming.id, ...Array.from({ length: STAR_XI_BENCH_SIZE - 1 }, () => "")],
    formationId: formation.id,
    formationPositions: positions,
  };
  const cup = beginCupMatch(initialGameFeatures(now).cup, now, "stadium", [outgoing], positions, state.lineupIds, state.benchIds);
  assert.equal(cup.allTimeAppearances[outgoing.id], 1);
  const before = getStarXIEffectiveMatchRating(state.ownedIds, state.lineupIds, cup, 70);
  const impact = applyCupSubstitution(cup, outgoing.id, incoming.id, 70);
  const replaced = setStarXIStarter(state, 0, incoming.id);
  const after = getStarXIEffectiveMatchRating(replaced.ownedIds, replaced.lineupIds, impact.cup, 70);

  assert.equal(impact.ratingDelta, incoming.rating - outgoing.rating);
  assert.ok(impact.ratingDelta > 0);
  assert.ok(impact.momentumDelta > 0);
  assert.ok(after > before);
  assert.equal(impact.cup.matchMomentum, impact.momentumDelta);
  assert.equal(impact.cup.allTimeAppearances[incoming.id], 1);
  assert.equal(normalizeGameFeatures({ ...initialGameFeatures(now), cup: impact.cup }).cup.matchMomentum, impact.cup.matchMomentum);
  assert.equal(normalizeGameFeatures({ ...initialGameFeatures(now), cup: impact.cup }).cup.allTimeAppearances[incoming.id], 1);
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
  const remainingPlayers = STAR_XI_PLAYERS.filter((candidate) => !used.has(candidate.id)).slice(0, STAR_XI_BENCH_SIZE + 1);
  const benchIds = [benchStarter.id, ...remainingPlayers.slice(0, STAR_XI_BENCH_SIZE - 1).map((player) => player.id)];
  const reservePlayer = remainingPlayers[STAR_XI_BENCH_SIZE - 1];
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
  assert.equal(afterReserveDrop.benchIds.length, STAR_XI_BENCH_SIZE);
  assert.equal(afterReserveDrop.benchIds[1], reservePlayer.id);
  assert.equal(afterReserveDrop.lineupIds.includes(displacedBenchPlayer) || afterReserveDrop.benchIds.includes(displacedBenchPlayer), false);
  assert.ok(afterReserveDrop.ownedIds.includes(displacedBenchPlayer));
});

test("transfer insider timing and outcome probabilities stay exact", () => {
  assert.equal(getTransferEventDelay(0), 480000);
  assert.equal(getTransferEventDelay(0.999999), 719999);
  assert.equal(TRANSFER_LOAN_CHANCE, 0.30);
  assert.equal(TRANSFER_SALE_CHANCE, 0.10);
  assert.equal(TRANSFER_PAID_SALE_CHANCE, 0.6);

  const loan = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.299999, 0, 0, 0]), 2000);
  const sale = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.30, 0, 0, 0, 0]), 2000);
  const failed = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.40, 0, 0, 0, 0]), 2000);
  assert.equal(loan.event.outcome, "loan");
  assert.equal(sale.event.outcome, "sale");
  assert.equal(failed.event.outcome, "failed");
});

test("Romario waits through a live match but can move a player after its final whistle", () => {
  const live = transferReadyFeatures();
  const originalOwnedIds = [...live.starXI.ownedIds];
  const originalLineupIds = [...live.starXI.lineupIds];
  live.cup.active = true;
  live.cup.matchStartedAt = 1000;
  live.cup.matchEndsAt = 181000;
  live.cup.lastTickAt = 1000;

  const blocked = resolveTransferInsiderEvent(live, sequenceRandom([0.1, 0, 0, 0, 0]), 2000);
  assert.equal(blocked.event.outcome, "failed");
  assert.deepEqual(blocked.features.starXI.ownedIds, originalOwnedIds);
  assert.deepEqual(blocked.features.starXI.lineupIds, originalLineupIds);
  assert.equal(blocked.features.transferSaga.archive.length, 0);

  const afterMatch = transferReadyFeatures();
  afterMatch.cup.active = false;
  afterMatch.cup.pendingNextRound = true;
  afterMatch.cup.round = 1;
  const allowed = resolveTransferInsiderEvent(afterMatch, sequenceRandom([0.1, 0, 0, 0]), 2000);
  assert.equal(allowed.event.outcome, "loan");
  assert.equal(allowed.features.starXI.lineupIds.includes(allowed.event.playerId!), false);
  assert.equal(allowed.features.transferSaga.loans[0].status, "active");
  assert.equal(finishActiveTransferLoans(allowed.features, 3000).features.transferSaga.loans.length, 0);
  assert.equal(allowed.features.transferSaga.archive.at(-1)?.id, allowed.event.id);
});

test("every completed tournament starts a five-minute Deadline Day and publishes a Gazette", () => {
  const now = 500000;
  const features = transferReadyFeatures(now);
  features.cup.nextTournamentAt = now + TOURNAMENT_COOLDOWN_MS;
  const completed = completeTournamentRun(features, { tournamentId: "stadium", tournamentWon: true, completedRound: 3, opponent: "FC Test", homeScore: 2, awayScore: 1, tieBreak: false }, now, sequenceRandom([0, 0]));

  assert.equal(completed.transferSaga.deadlineDayStartedAt, now);
  assert.equal(completed.transferSaga.deadlineDayEndsAt, now + TOURNAMENT_COOLDOWN_MS);
  assert.equal(isTransferDeadlineDay(completed, now + TOURNAMENT_COOLDOWN_MS - 1), true);
  assert.equal(isTransferDeadlineDay(completed, now + TOURNAMENT_COOLDOWN_MS), false);
  assert.equal(completed.gazetteIssues.length, 1);
  assert.equal(completed.gazetteIssues[0].tone, "champion");
  assert.equal(getTransferDeadlineEventDelay(0), 45000);
  assert.equal(getTransferDeadlineEventDelay(0.999999), 74999);
  assert.equal(TRANSFER_DEADLINE_LOAN_CHANCE, 0.60);

  const loan = resolveTransferInsiderEvent(completed, sequenceRandom([0.599999, 0, 0, 0]), now + 10000);
  const sale = resolveTransferInsiderEvent(completed, sequenceRandom([0.60, 0, 0, 0, 0]), now + 10000);
  assert.equal(loan.event.outcome, "loan");
  assert.equal(sale.event.outcome, "sale");
});

test("pack trolls stay rare and only target real walkout cards", () => {
  const walkout = STAR_XI_PLAYERS.find((player) => player.rating >= 90)!;
  const normal = STAR_XI_PLAYERS.find((player) => player.rating < 80 && player.cardType !== "icon" && player.cardType !== "legendary")!;
  assert.equal(typeof shouldTriggerPackTroll(walkout), "boolean");
  assert.equal(shouldTriggerPackTroll(walkout, () => 0), true);
  assert.equal(shouldTriggerPackTroll(walkout, () => 0.05), false);
  assert.equal(shouldTriggerPackTroll(normal, () => 0), false);
});

test("a loaned squad player disappears for one whole tournament and then returns", () => {
  const loanResult = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.1, 0, 0, 0]), 2000);
  const playerId = loanResult.event.playerId!;
  assert.equal(loanResult.features.starXI.ownedIds.includes(playerId), true);
  assert.equal(loanResult.features.starXI.lineupIds.includes(playerId), false);
  assert.equal(loanResult.features.starXI.benchIds.includes(playerId), false);
  assert.equal(loanResult.features.starXI.lineupIds[0], "");
  assert.equal(getOpenTransferSquadVacancies(loanResult.features).length, 1);
  const normalizedLoan = normalizeGameFeatures(loanResult.features);
  assert.equal(normalizedLoan.starXI.lineupIds[0], "");
  assert.equal(getOpenTransferSquadVacancies(normalizedLoan).length, 1);
  const benchReplacementId = loanResult.features.starXI.benchIds.find((candidateId) => candidateId && canStarXIPlayerFillSlot(candidateId, 0, loanResult.features.starXI.formationPositions));
  assert.ok(benchReplacementId);
  const shiftedVacancy = {
    ...loanResult.features,
    starXI: setStarXIStarter(loanResult.features.starXI, 0, benchReplacementId!, getUnavailableStarXIPlayerIds(loanResult.features)),
  };
  assert.equal(shiftedVacancy.starXI.lineupIds.filter(Boolean).length, STAR_XI_SQUAD_SIZE);
  assert.equal(getOpenTransferSquadVacancies(shiftedVacancy).length, 1);
  assert.equal(loanResult.features.transferSaga.loans[0].status, "pending");

  const active = activatePendingTransferLoans(loanResult.features, "stadium");
  assert.equal(active.transferSaga.loans[0].status, "active");
  assert.equal(active.transferSaga.loans[0].tournamentId, "stadium");
  const returned = finishActiveTransferLoans(active, 3000);
  assert.equal(returned.features.transferSaga.loans.length, 0);
  assert.equal(returned.features.starXI.ownedIds.includes(playerId), true);
  assert.equal(returned.event?.outcome, "return");
});

test("a transfer from the bench leaves a manual vacancy until a reserve is selected", () => {
  const before = transferReadyFeatures();
  const loanResult = resolveTransferInsiderEvent(before, sequenceRandom([0.1, 0, 0.5, 0]), 2000);
  const vacancy = getOpenTransferSquadVacancies(loanResult.features)[0];

  assert.equal(vacancy.area, "bench");
  assert.equal(loanResult.features.starXI.benchIds.filter(Boolean).length, before.starXI.benchIds.filter(Boolean).length - 1);
  assert.equal(normalizeGameFeatures(loanResult.features).starXI.benchIds[vacancy.index], "");

  const replacement = STAR_XI_PLAYERS.find((player) => loanResult.features.starXI.ownedIds.includes(player.id) && !loanResult.features.starXI.lineupIds.includes(player.id) && !loanResult.features.starXI.benchIds.includes(player.id) && !getUnavailableStarXIPlayerIds(loanResult.features).includes(player.id));
  assert.ok(replacement);
  const manuallyFilled = {
    ...loanResult.features,
    starXI: setStarXIBenchPlayer(loanResult.features.starXI, vacancy.index, replacement!.id, getUnavailableStarXIPlayerIds(loanResult.features)),
  };
  assert.equal(getOpenTransferSquadVacancies(manuallyFilled).length, 0);
});

test("sales pay the card value sixty percent of the time and can be free", () => {
  const paid = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.31, 0, 0, 0.599999, 0]), 2000);
  const paidPlayer = STAR_XI_PLAYERS.find((player) => player.id === paid.event.playerId)!;
  assert.equal(paid.event.outcome, "sale");
  assert.equal(paid.goalDelta, paidPlayer.price);
  assert.equal(paid.event.fee, paidPlayer.price);
  assert.equal(paid.features.starXI.ownedIds.includes(paidPlayer.id), false);

  const free = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.31, 0, 0, 0.6, 0]), 2000);
  assert.equal(free.event.outcome, "sale");
  assert.equal(free.goalDelta, 0);
  assert.equal(free.event.fee, 0);
  assert.match(free.event.message, /ablösefrei/i);
});

test("failed Fabrizio Romario reports never repeat the previous reason", () => {
  const first = resolveTransferInsiderEvent(transferReadyFeatures(), sequenceRandom([0.5, 0, 0, 0, 0]), 2000);
  const second = resolveTransferInsiderEvent(first.features, sequenceRandom([0.5, 0, 0, 0, 0]), 3000);
  assert.equal(first.event.outcome, "failed");
  assert.equal(second.event.outcome, "failed");
  assert.notEqual(first.event.reason, second.event.reason);
  assert.match(second.event.message, /Fabrizio Romario/);
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
