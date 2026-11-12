// Owner decisions (12 Nov 2026): one place goes up and one goes down across each league boundary every season, for
// every club including the own one; exactly as many AI clubs go up from the lower league as go down from the upper one.
import assert from "node:assert/strict";
import test from "node:test";
import { SEASON_MODE_MATCHES_PER_SEASON, SEASON_MODE_TABLE_SIZE, SEASON_PROMOTION_PLACES, SEASON_RELEGATION_PLACES, getSeasonOpponentRating, normalizeSeasonModeState, recordSeasonModeMatch, startSeasonPrestige } from "../app/feature-data.ts";
import type { SeasonModeState } from "../app/feature-data.ts";
import { SEASON_CLUBS, seasonClubsOf, seasonGeography } from "../app/travel-geography.ts";
import { AI_CLUBS_PER_LEAGUE, advanceAiLeagues, normalizeAiLeagues } from "../app/season-leagues.ts";

const lcg = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const rollScore = (strength: number, random: () => number) => { let score = 0; const expected = Math.max(0.2, Math.min(3.8, 0.55 + strength * 0.035)); for (let i = 0; i < 5; i++) if (random() < Math.max(0.035, Math.min(0.84, expected / (i + 2.2)))) score++; return score; };

/** Plays a whole season; `clubWins` decides whether our club wins every match (goes up) or loses every match (goes down). */
function playSeason(state: SeasonModeState, clubWins: boolean | null, random: () => number, now = 1_000) {
  let current = state;
  for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON; day++) {
    const [clubScore, opponentScore] = clubWins === true ? [3, 0] : clubWins === false ? [0, 3] : [1, 1];
    current = recordSeasonModeMatch(current, clubScore, opponentScore, "FC Goal", now + day, random).state;
  }
  return current;
}
const leagueSizes = (aiLeagues: SeasonModeState["aiLeagues"]) => Array.from({ length: 15 }, (_, i) => seasonClubsOf(i + 1, aiLeagues).length);

test("one place up and one place down per boundary, the same number for AI clubs", () => {
  assert.equal(SEASON_PROMOTION_PLACES, 1);
  assert.equal(SEASON_RELEGATION_PLACES, 1);
  assert.equal(SEASON_MODE_TABLE_SIZE, AI_CLUBS_PER_LEAGUE + 1, "a league is five AI clubs and the own club");
});

test("after a season exactly one AI club goes up and one goes down at every boundary, the own club's rules stay", () => {
  const league5 = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, "FC Goal");
  const after = playSeason(league5, true, lcg(7));
  assert.equal(after.division, 6, "the own club won every match and goes up as before");
  const moves = after.lastAiMoves!;
  assert.equal(moves.length, 14 * (SEASON_PROMOTION_PLACES + SEASON_RELEGATION_PLACES), "28 moves: one up and one down at each of the 14 boundaries");
  for (let boundary = 1; boundary < 15; boundary++) {
    assert.equal(moves.filter((m) => m.from === boundary && m.to === boundary + 1).length, SEASON_PROMOTION_PLACES, `up across ${boundary}|${boundary + 1}`);
    assert.equal(moves.filter((m) => m.from === boundary + 1 && m.to === boundary).length, SEASON_RELEGATION_PLACES, `down across ${boundary}|${boundary + 1}`);
  }
  assert.deepEqual(leagueSizes(after.aiLeagues), new Array(15).fill(AI_CLUBS_PER_LEAGUE));
  // The own league: the two best AI clubs of the real table went up, the two worst went down.
  const ranked = after.lastTable.filter((row) => row.id !== "club").map((row) => row.clubId!);
  assert.deepEqual(moves.filter((m) => m.from === 5 && m.to === 6).map((m) => m.clubId), ranked.slice(0, SEASON_PROMOTION_PLACES));
  assert.deepEqual(moves.filter((m) => m.from === 5 && m.to === 4).map((m) => m.clubId), ranked.slice(-SEASON_RELEGATION_PLACES));
});

test("the next season of the own club uses the moved clubs and keeps their identity and stadium", () => {
  const league5 = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, "FC Goal");
  const after = playSeason(league5, true, lcg(11));
  const clubIds = after.table.filter((row) => row.id !== "club").map((row) => row.clubId);
  assert.equal(new Set(clubIds).size, 5, "five different AI clubs");
  const expected = seasonClubsOf(6, after.aiLeagues).map((club) => club.id);
  assert.deepEqual(clubIds, expected);
  for (const row of after.table.filter((team) => team.id !== "club")) {
    const club = SEASON_CLUBS.find((candidate) => candidate.id === row.clubId)!;
    assert.equal(row.venue?.id, club.venue.id, "the stadium stays the club's own");
    assert.equal(row.name, club.name);
  }
  // A club that came down from league 6 can meet the own club in league 5 again.
  const relegated = after.lastAiMoves!.filter((m) => m.from === 6 && m.to === 5).map((m) => m.clubId);
  const lower = playSeason(normalizeSeasonModeState({ ...after, division: 5, table: undefined, lastTable: undefined, fixtures: undefined, results: [], matchday: 0 }, "FC Goal"), null, lcg(3));
  assert.ok(relegated.length === 1 && lower.lastTable.filter((row) => row.id !== "club").every((row) => !!row.clubId));
  assert.deepEqual(new Set(lower.lastTable.filter((row) => row.id !== "club").map((row) => row.clubId)).size, 5);
});

test("the top and bottom league only have one boundary, and many seasons never duplicate or lose a club", () => {
  for (const playerDivision of [1, 8, 15]) {
    let aiLeagues: SeasonModeState["aiLeagues"];
    for (let season = 0; season < 30; season++) {
      const random = lcg(season * 31 + playerDivision);
      const playerLeagueAiOrder = seasonClubsOf(playerDivision, aiLeagues).map((club) => club.id).sort(() => random() - .5);
      const result = advanceAiLeagues({ aiLeagues, playerDivision, playerLeagueAiOrder, places: SEASON_RELEGATION_PLACES, ratingOf: getSeasonOpponentRating, rollScore, random });
      aiLeagues = result.aiLeagues;
      assert.deepEqual(leagueSizes(aiLeagues), new Array(15).fill(5), `season ${season}`);
      const placed = new Set(Array.from({ length: 15 }, (_, i) => seasonClubsOf(i + 1, aiLeagues).map((club) => club.id)).flat());
      assert.equal(placed.size, SEASON_CLUBS.length, "no club twice and none missing");
      assert.equal(result.moves.length, 28);
      assert.ok(result.moves.every((m) => Math.abs(m.from - m.to) === 1), "only one league at a time");
      assert.ok(result.moves.filter((m) => m.from === 15 && m.to === 16).length === 0 && result.moves.filter((m) => m.from === 1 && m.to === 0).length === 0);
    }
  }
});

test("a team goes up and down only by its table place: a club that wins the lower league goes up", () => {
  const order = seasonClubsOf(4).map((club) => club.id);
  const result = advanceAiLeagues({ playerDivision: 9, playerLeagueAiOrder: [], places: 1, ratingOf: () => 50, rollScore: () => 0, random: () => 0.5 });
  // With all results equal the fixed tie order decides: the first club of every league goes up, the last one goes down.
  assert.deepEqual(result.moves.filter((m) => m.from === 4 && m.to === 5).map((m) => m.clubId), [[...order].sort()[0]]);
});

test("saving and reloading keep the leagues, old saves load unchanged, damaged data falls back to the catalogue", () => {
  const league5 = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, "FC Goal");
  const after = playSeason(league5, true, lcg(21));
  const reloaded = normalizeSeasonModeState(JSON.parse(JSON.stringify(after)), "FC Goal");
  assert.deepEqual(reloaded.aiLeagues, after.aiLeagues);
  assert.deepEqual(reloaded.lastAiMoves, after.lastAiMoves);
  assert.deepEqual(reloaded.table.map((row) => row.clubId), after.table.map((row) => row.clubId));
  const twice = normalizeSeasonModeState(JSON.parse(JSON.stringify(reloaded)), "FC Goal");
  assert.deepEqual(twice, reloaded);
  // An old save has no assignment: the catalogue leagues apply and the table is the one it always was.
  const old = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, "FC Goal");
  assert.equal(old.aiLeagues, undefined);
  assert.deepEqual(old.table.filter((row) => row.id !== "club").map((row) => row.clubId), Array.from({ length: 5 }, (_, i) => seasonGeography(5, i).id));
  // Wrong counts, missing clubs or unknown leagues are ignored instead of breaking the world.
  assert.equal(normalizeAiLeagues({ ...after.aiLeagues, [SEASON_CLUBS[0].id]: 15 }), undefined);
  assert.equal(normalizeAiLeagues({}), undefined);
  assert.equal(normalizeAiLeagues("x"), undefined);
});

test("a mid season save keeps its table while the leagues are applied from the next season", () => {
  const league5 = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, "FC Goal");
  const afterOne = playSeason(league5, true, lcg(5));
  let mid = afterOne;
  mid = recordSeasonModeMatch(mid, 2, 1, "FC Goal", 9_000, lcg(1)).state;
  const reloaded = normalizeSeasonModeState(JSON.parse(JSON.stringify(mid)), "FC Goal");
  const byId = (rows: SeasonModeState["table"]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(byId(reloaded.table), byId(mid.table), "the running table is kept (the row order is the display order)");
  assert.equal(reloaded.matchday, mid.matchday);
});

test("a new Prestige run starts in the catalogue leagues again", () => {
  const top = normalizeSeasonModeState({ division: 15, highestDivision: 15, hallOfFame: true, aiLeagues: undefined }, "FC Goal");
  const moved = { ...top, aiLeagues: advanceAiLeagues({ playerDivision: 15, playerLeagueAiOrder: [], places: 1, ratingOf: getSeasonOpponentRating, rollScore, random: lcg(2) }).aiLeagues };
  assert.ok(moved.aiLeagues);
  const fresh = startSeasonPrestige(moved, "FC Goal", 5_000);
  assert.equal(fresh.aiLeagues, undefined);
  assert.deepEqual(fresh.lastAiMoves, []);
});

/** A league at the last matchday where our club ends on `place` (1 to 6); the points are far apart, so the last match cannot change it. */
function lastMatchday(division: number, place: number) {
  const base = normalizeSeasonModeState({ division, highestDivision: division }, "FC Goal");
  const order = ["season-opponent-1", "season-opponent-2", "season-opponent-3", "season-opponent-4", "season-opponent-5"];
  const others = order.slice();
  const ids: string[] = [];
  for (let i = 1; i <= 6; i++) ids.push(i === place ? "club" : others.shift()!);
  const table = base.table.map((row) => ({ ...row, played: row.id === "season-opponent-5" || row.id === "club" ? 9 : 9, points: (6 - ids.indexOf(row.id)) * 40 }));
  return { ...base, matchday: 9, table, lastTable: table, results: [] } as SeasonModeState;
}
const finish = (state: SeasonModeState) => recordSeasonModeMatch(state, 1, 1, "FC Goal", 5_000, lcg(4), "season-opponent-5").state;

test("the own club: only first place goes up and only last place goes down, places 2 to 5 stay", () => {
  const outcomes = [1, 2, 3, 4, 5, 6].map((place) => finish(lastMatchday(7, place)).history.at(-1)!.seasonOutcome);
  assert.deepEqual(outcomes, ["promoted", "stayed", "stayed", "stayed", "stayed", "relegated"]);
  assert.equal(finish(lastMatchday(7, 1)).division, 8);
  assert.equal(finish(lastMatchday(7, 6)).division, 6);
  assert.equal(finish(lastMatchday(7, 2)).division, 7);
});

test("top and bottom league: the world league champion reaches the Hall of Fame, second place stays, the lowest league has no relegation", () => {
  assert.equal(finish(lastMatchday(15, 1)).hallOfFame, true);
  assert.equal(finish(lastMatchday(15, 2)).history.at(-1)!.seasonOutcome, "stayed");
  assert.equal(finish(lastMatchday(15, 6)).history.at(-1)!.seasonOutcome, "relegated", "the last place of the top league goes down");
  assert.equal(finish(lastMatchday(1, 6)).history.at(-1)!.seasonOutcome, "stayed", "nobody goes below league 15");
  assert.equal(finish(lastMatchday(1, 6)).division, 1);
  assert.equal(finish(lastMatchday(1, 1)).division, 2);
});

test("league sizes stay balanced when the own club moves: one AI club goes up and one comes down besides it", () => {
  for (const place of [1, 3, 6]) {
    const after = finish(lastMatchday(7, place));
    assert.deepEqual(leagueSizes(after.aiLeagues), new Array(15).fill(5), `place ${place}`);
    assert.equal(after.table.filter((row) => row.id !== "club").length, 5, "the next table has five AI opponents");
    assert.equal(new Set(after.table.map((row) => row.clubId ?? row.id)).size, 6);
    assert.equal(after.lastAiMoves!.length, 28);
  }
});

test("the standings markers follow the new rule: first place up, last place down", async () => {
  const { readFileSync } = await import("node:fs");
  const panel = readFileSync(new URL("../app/season-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /index < SEASON_PROMOTION_PLACES \? "promotion"/);
  assert.match(panel, /index >= rows\.length - SEASON_RELEGATION_PLACES && division > 1 \? "relegation"/);
  assert.doesNotMatch(panel, /Platz 1 und 2: Aufstieg|Platz 5 und 6: Abstieg/);
});
