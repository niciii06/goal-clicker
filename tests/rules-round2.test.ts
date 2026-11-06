// Owner rule decisions of 2026-11-06 (round 2): loans at the Hall of Fame, stars only for a new best league,
// table tie-breaks with head-to-head, red card suspensions per competition and goalkeepers in the match engine.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, STAR_XI_PLAYERS,
  finishActiveTransferLoans, getSeasonStarReward, getUnavailableStarXIPlayerIds, initialGameFeatures, initialSeasonMode,
  normalizeGameFeatures, recordSeasonModeMatch, resolveTransferInsiderEvent, setBestStarXI,
} from "../app/feature-data.ts";
import type { GameFeatures, SeasonModeState } from "../app/feature-data.ts";

function fullSquad(now = 1000): GameFeatures {
  const features = initialGameFeatures(now);
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.map((player) => player.id) });
  return features;
}

function sequence(values: number[], fallback = 0.5) {
  let index = 0;
  return () => values[index++] ?? fallback;
}

/** A season in Liga 1 one matchday before the end, with the club far ahead. */
function lastMatchdayOfLeagueOne(prestigeCount = 0): SeasonModeState {
  // An empty table is rebuilt for the division when the state is read.
  let season: SeasonModeState = { ...initialSeasonMode("FC Test"), division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, prestigeCount, table: [], lastTable: [] };
  for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON - 1; day += 1) season = recordSeasonModeMatch(season, 9, 0, "FC Test", 1000 + day, sequence([], 0.99)).state;
  assert.equal(season.matchday, SEASON_MODE_MATCHES_PER_SEASON - 1);
  return season;
}

test("decision 1: a loan still waiting for its match ends when the Hall of Fame is reached", () => {
  const loan = resolveTransferInsiderEvent(fullSquad(), sequence([0.1, 0, 0, 0]), 2000);
  const playerId = loan.event!.playerId!;
  assert.equal(loan.features.transferSaga.loans[0].status, "pending");
  const features = loan.features;
  const finalMatch = recordSeasonModeMatch(lastMatchdayOfLeagueOne(), 5, 0, "FC Test", 5000);
  assert.equal(finalMatch.entry?.seasonOutcome, "hall-of-fame");
  features.seasonMode = finalMatch.state;
  features.cup.mode = "season";

  // An ordinary league match leaves a pending loan alone: it waits for its own match.
  assert.equal(finishActiveTransferLoans(features, 6000).features.transferSaga.loans.length, 1);

  const returned = finishActiveTransferLoans(features, 6000, { hallOfFameReached: true });
  assert.equal(returned.features.transferSaga.loans.length, 0);
  assert.equal(returned.event?.outcome, "return");
  assert.match(returned.event!.message, /Hall of Fame/);
  assert.ok(returned.features.starXI.ownedIds.includes(playerId));
  assert.ok(!getUnavailableStarXIPlayerIds(returned.features).includes(playerId), "the player is available again");
  assert.equal(normalizeGameFeatures(JSON.parse(JSON.stringify(returned.features))).transferSaga.loans.length, 0);
});

test("decision 1: solo and co-op end the pending loan with the Hall of Fame match", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8");
  for (const source of [page, route]) assert.match(source, /finishActiveTransferLoans\([^)]*\{ hallOfFameReached: result\.entry\.seasonOutcome === "hall-of-fame" \}\)/);
});

test("decision 5: stars only for a league never reached before", () => {
  const promoted = { seasonOutcome: "promoted" as const };
  // First climb from Liga 15 to Liga 14: new best league.
  assert.equal(getSeasonStarReward({ division: 1, highestDivision: 1, prestigeCount: 0 }, promoted), 1);
  // Relegated from division 5 to 4, promoted back to 5: nothing new.
  assert.equal(getSeasonStarReward({ division: 4, highestDivision: 5, prestigeCount: 0 }, promoted), 0);
  // After that the next promotion (to 6) is new again.
  assert.equal(getSeasonStarReward({ division: 5, highestDivision: 5, prestigeCount: 0 }, promoted), 1);
  // After a Prestige the climb starts again in division 1, but every league was reached already.
  assert.equal(getSeasonStarReward({ division: 3, highestDivision: SEASON_MODE_DIVISION_COUNT, prestigeCount: 1 }, promoted), 0);
  // The Hall of Fame pays its two stars the first time only.
  assert.equal(getSeasonStarReward({ division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, prestigeCount: 0 }, { seasonOutcome: "hall-of-fame" }), 2);
  assert.equal(getSeasonStarReward({ division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, prestigeCount: 1 }, { seasonOutcome: "hall-of-fame" }), 0);
  for (const seasonOutcome of ["stayed", "relegated", null] as const) assert.equal(getSeasonStarReward({ division: 2, highestDivision: 2, prestigeCount: 0 }, { seasonOutcome }), 0);
});

test("decision 5: relegation and promotion again pays no star through recordSeasonModeMatch", () => {
  const run = (season: SeasonModeState, clubScore: number) => {
    let reward = 0, current = season;
    for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON; day += 1) {
      const result = recordSeasonModeMatch(current, clubScore, clubScore ? 0 : 9, "FC Test", 1000 + day, sequence([], 0.99));
      reward += result.starReward; current = result.state;
    }
    return { reward, season: current };
  };
  const start: SeasonModeState = { ...initialSeasonMode("FC Test"), division: 3, highestDivision: 3, table: [], lastTable: [] };
  const promoted = run(start, 9);
  assert.equal(promoted.season.division, 4);
  assert.equal(promoted.reward, 1, "Liga 12 is new");
  const relegated = run(promoted.season, 0);
  assert.equal(relegated.season.division, 3);
  assert.equal(relegated.reward, 0);
  const again = run(relegated.season, 9);
  assert.equal(again.season.division, 4);
  assert.equal(again.reward, 0, "back into Liga 12 pays nothing");
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8");
  assert.match(page, /const seasonReward = result\.starReward;/);
  assert.match(route, /game\.stars = Math\.min\(MAX_SEASON_STARS, game\.stars \+ result\.starReward\);/);
});
