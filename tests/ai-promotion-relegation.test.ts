// Owner decisions (12 Nov 2026): one place goes up and one goes down across each league boundary every season, for every
// club including the own one, as a strict one for one swap. Every league has six members: five AI clubs plus the own
// club in its league, six AI clubs everywhere else, and the own club keeps its ten fixtures.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SEASON_MODE_MATCHES_PER_SEASON, SEASON_MODE_TABLE_SIZE, SEASON_PROMOTION_PLACES, SEASON_RELEGATION_PLACES, createSeasonFixtures, getSeasonOpponentRating, normalizeSeasonModeState, recordSeasonModeMatch, startSeasonPrestige } from "../app/feature-data.ts";
import type { SeasonModeState } from "../app/feature-data.ts";
import { LEAGUE_MEMBERS, SEASON_CLUBS, VENUES, defaultAiLeagues, seasonClubsOf, seasonGeography } from "../app/travel-geography.ts";
import { OWN_CLUB_ID, advanceAiLeagues, normalizeAiLeagues } from "../app/season-leagues.ts";
import { createJourney } from "../app/travel-data.ts";
import { planJourney } from "../app/journey-routing.ts";

const lcg = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const rollScore = (strength: number, random: () => number) => { let score = 0; const expected = Math.max(0.2, Math.min(3.8, 0.55 + strength * 0.035)); for (let i = 0; i < 5; i++) if (random() < Math.max(0.035, Math.min(0.84, expected / (i + 2.2)))) score++; return score; };
const league = (division: number) => normalizeSeasonModeState({ division, highestDivision: division }, "FC Goal");
/** All members of every league: the AI clubs plus the own club in its division. */
function members(state: SeasonModeState) {
  const map = state.aiLeagues ?? defaultAiLeagues(state.division);
  return Array.from({ length: 15 }, (_, i) => [...seasonClubsOf(i + 1, map).map((club) => club.id), ...(state.division === i + 1 ? [OWN_CLUB_ID] : [])]);
}
function assertBalanced(state: SeasonModeState, label = "") {
  const all = members(state);
  assert.deepEqual(all.map((list) => list.length), new Array(15).fill(LEAGUE_MEMBERS), `six members in every league ${label}`);
  const flat = all.flat();
  assert.equal(new Set(flat).size, flat.length, `no club twice ${label}`);
  assert.equal(flat.length, SEASON_CLUBS.length + 1, `no club missing ${label}`);
  assert.ok(flat.includes(OWN_CLUB_ID));
  const opponents = state.table.filter((row) => row.id !== "club");
  assert.equal(opponents.length, 5, `the own club has five opponents ${label}`);
  assert.equal(new Set(opponents.map((row) => row.clubId)).size, 5);
  assert.equal(state.fixtures?.length, SEASON_MODE_MATCHES_PER_SEASON, `ten fixtures ${label}`);
}
/** Plays a whole season where our club wins all (1st), loses all (last) or draws all. */
function playSeason(state: SeasonModeState, result: "win" | "lose" | "draw", random: () => number, now = 1_000) {
  const [clubScore, opponentScore] = result === "win" ? [3, 0] : result === "lose" ? [0, 3] : [1, 1];
  let current = state;
  for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON; day++) current = recordSeasonModeMatch(current, clubScore, opponentScore, "FC Goal", now + day, random).state;
  return current;
}
/** A league at its last matchday where our club ends on `place` (1 to 6); points are far apart, so the last match cannot change it. */
function lastMatchday(division: number, place: number) {
  const base = league(division);
  const others = ["season-opponent-1", "season-opponent-2", "season-opponent-3", "season-opponent-4", "season-opponent-5"];
  const ids: string[] = [];
  for (let i = 1; i <= 6; i++) ids.push(i === place ? "club" : others.shift()!);
  const table = base.table.map((row) => ({ ...row, played: 9, points: (6 - ids.indexOf(row.id)) * 40 }));
  return { ...base, matchday: 9, table, lastTable: table, results: [] } as SeasonModeState;
}
const finish = (state: SeasonModeState) => recordSeasonModeMatch(state, 1, 1, "FC Goal", 5_000, lcg(4), "season-opponent-5").state;
/** Per boundary: how many clubs (own club included) went up and how many went down. */
function boundaryCounts(moves: NonNullable<SeasonModeState["lastAiMoves"]>) {
  return Array.from({ length: 14 }, (_, i) => ({ up: moves.filter((m) => m.from === i + 1 && m.to === i + 2).length, down: moves.filter((m) => m.from === i + 2 && m.to === i + 1).length }));
}

test("one place up and one place down per boundary", () => {
  assert.equal(SEASON_PROMOTION_PLACES, 1);
  assert.equal(SEASON_RELEGATION_PLACES, 1);
  assert.equal(SEASON_MODE_TABLE_SIZE, LEAGUE_MEMBERS, "a league table has six members");
});

test("the catalogue has six clubs per league, five in the lowest league where the own club starts", () => {
  assert.equal(SEASON_CLUBS.length, 89);
  assert.equal(new Set(SEASON_CLUBS.map((club) => club.id)).size, 89);
  for (let l = 1; l <= 15; l++) assert.equal(SEASON_CLUBS.filter((club) => club.league === l).length, l === 15 ? 5 : 6, `league ${l}`);
  const added = SEASON_CLUBS.filter((club) => club.id.startsWith("extra-") || club.id === "world-paris-saint-german");
  assert.equal(added.length, 14, "one new club in every other division");
  for (const club of added) {
    // Source backed grounds only: the venue is a ground the catalogue already audits, or a catalogue venue of the world league.
    const owners = SEASON_CLUBS.filter((other) => other.venue.id === club.venue.id);
    assert.ok(owners.length >= 2 || Object.values(VENUES).some((venue) => venue.id === club.venue.id), `${club.name} has an existing ground`);
    assert.ok(club.venue.lat && club.venue.lon);
  }
  assert.ok(added.filter((club) => club.fictional).every((club) => seasonClubsOf(16 - club.league, defaultAiLeagues(1)).some((other) => !other.fictional && other.venue.id === club.venue.id)), "a fictional sixth club shares the ground of a real club of its league");
  assert.equal(added.filter((club) => !club.fictional).length, 3, "real clubs only where their audited stadium exists");
});

test("legacy saves and new worlds keep their five opponents; the sixth club of the own league plays in the lowest league", () => {
  for (const division of [1, 2, 5, 9, 14, 15]) {
    const state = league(division);
    assert.equal(state.aiLeagues, undefined, "a world that never moved stores no assignment");
    const originals = SEASON_CLUBS.filter((club) => club.league === 16 - division).slice(0, 5).map((club) => club.id);
    assert.deepEqual(state.table.filter((row) => row.id !== "club").map((row) => row.clubId), originals, `division ${division}`);
    assert.deepEqual(state.table.filter((row) => row.id !== "club").map((row, i) => seasonGeography(division, i).id), originals);
    const map = defaultAiLeagues(division);
    for (let d = 1; d <= 15; d++) assert.equal(seasonClubsOf(d, map).length, d === division ? 5 : 6, `division ${d} for own division ${division}`);
    assertBalanced(state, `legacy ${division}`);
  }
});

test("the own club that wins goes up and swaps with the club that comes down; no extra AI club is promoted", () => {
  for (const division of [1, 7, 14]) {
    const before = league(division);
    const after = finish(lastMatchday(division, 1));
    assert.equal(after.division, division + 1);
    const moves = after.lastAiMoves!;
    assert.equal(moves.length, 28, "14 boundaries, one up and one down");
    for (const [i, count] of boundaryCounts(moves).entries()) assert.deepEqual(count, { up: 1, down: 1 }, `boundary ${i + 1}|${i + 2}`);
    assert.deepEqual(moves.filter((m) => m.from === division && m.to === division + 1).map((m) => m.clubId), [OWN_CLUB_ID], "only the own club goes up from its league");
    const swapped = moves.filter((m) => m.from === division + 1 && m.to === division);
    assert.equal(swapped.length, 1);
    assert.ok(members(after)[division - 1].includes(swapped[0].clubId), "the relegated club took the own club's place");
    assert.equal(after.table.filter((row) => row.id !== "club").length, 5);
    assertBalanced(after, `up from ${division}`);
    assert.deepEqual(before.table.length, 6);
  }
});

test("the own club that finishes last goes down and swaps with the best club of the league below", () => {
  for (const division of [3, 8, 15]) {
    const after = finish(lastMatchday(division, 6));
    assert.equal(after.division, division - 1);
    const moves = after.lastAiMoves!;
    for (const [i, count] of boundaryCounts(moves).entries()) assert.deepEqual(count, { up: 1, down: 1 }, `boundary ${i + 1}|${i + 2}`);
    assert.deepEqual(moves.filter((m) => m.from === division && m.to === division - 1).map((m) => m.clubId), [OWN_CLUB_ID]);
    assert.equal(moves.filter((m) => m.from === division - 1 && m.to === division).length, 1);
    assertBalanced(after, `down from ${division}`);
  }
});

test("places 2 to 5 stay: two AI clubs of the own league move, one up and one down", () => {
  for (const place of [2, 3, 4, 5]) {
    const state = lastMatchday(7, place);
    const after = finish(state);
    assert.equal(after.division, 7);
    const moves = after.lastAiMoves!;
    assert.equal(moves.length, 28);
    assert.ok(moves.every((m) => m.clubId !== OWN_CLUB_ID));
    // The own league's table decides: first up, last down (the order of the final table).
    const order = after.lastTable.map((row) => row.clubId ?? OWN_CLUB_ID);
    assert.deepEqual(moves.filter((m) => m.from === 7 && m.to === 8).map((m) => m.clubId), [order[0]]);
    assert.deepEqual(moves.filter((m) => m.from === 7 && m.to === 6).map((m) => m.clubId), [order[5]]);
    assertBalanced(after, `place ${place}`);
  }
});

test("top and bottom league: Hall of Fame for the world league champion, no relegation below the lowest league", () => {
  const champion = finish(lastMatchday(15, 1));
  assert.equal(champion.hallOfFame, true);
  assert.equal(champion.division, 15);
  assert.equal(finish(lastMatchday(15, 2)).history.at(-1)!.seasonOutcome, "stayed");
  const last15 = finish(lastMatchday(15, 6));
  assert.equal(last15.history.at(-1)!.seasonOutcome, "relegated");
  assert.equal(last15.division, 14);
  const bottom = finish(lastMatchday(1, 6));
  assert.equal(bottom.history.at(-1)!.seasonOutcome, "stayed");
  assert.equal(bottom.division, 1);
  assert.equal(boundaryCounts(bottom.lastAiMoves!).every((c) => c.up === 1 && c.down === 1), true);
  assertBalanced(bottom, "bottom");
  const top = finish(lastMatchday(1, 1));
  assert.equal(top.division, 2);
  assertBalanced(top, "bottom up");
  // Nothing goes up from league 1 (division 15) and nothing goes down from league 15 (division 1).
  assert.equal(top.lastAiMoves!.filter((m) => m.to === 16 || m.to === 0).length, 0);
});

test("many seasons with the own club moving both ways never duplicate or lose a club and keep ten fixtures", () => {
  for (const seed of [3, 17, 99]) {
    const random = lcg(seed);
    let state = league(1);
    let seasons = 0, ups = 0, downs = 0, stays = 0;
    for (let season = 0; season < 40 && !state.hallOfFame; season++) {
      const roll = random();
      const before = state.division;
      state = playSeason(state, roll < .45 ? "win" : roll < .7 ? "lose" : "draw", random, 1_000 + season * 100);
      seasons++;
      if (state.division > before) ups++; else if (state.division < before) downs++; else stays++;
      assertBalanced(state, `seed ${seed} season ${season}`);
      for (const [i, count] of boundaryCounts(state.lastAiMoves!).entries()) assert.deepEqual(count, { up: 1, down: 1 }, `seed ${seed} season ${season} boundary ${i + 1}`);
      // Reload keeps everything.
      const reloaded = normalizeSeasonModeState(JSON.parse(JSON.stringify(state)), "FC Goal");
      assert.deepEqual(reloaded.aiLeagues, state.aiLeagues);
      assertBalanced(reloaded, "reloaded");
    }
    assert.ok(seasons >= 15 && ups > 0 && downs > 0 && stays > 0, `seed ${seed}: ${seasons} seasons, ${ups} up, ${downs} down, ${stays} stayed`);
  }
});

test("the next opponents come from the moved leagues and keep identity, ground and travel data", () => {
  let state = playSeason(league(5), "win", lcg(11));
  const clubIds = state.table.filter((row) => row.id !== "club").map((row) => row.clubId);
  assert.deepEqual(clubIds, seasonClubsOf(6, state.aiLeagues).map((club) => club.id));
  for (const row of state.table.filter((team) => team.id !== "club")) {
    const club = SEASON_CLUBS.find((candidate) => candidate.id === row.clubId)!;
    assert.equal(row.venue?.id, club.venue.id);
    assert.equal(row.name, club.name);
    // Away trips to every club of the league can be planned with a route that follows the cached roads.
    const plan = planJourney(club.venue);
    assert.ok(plan.segments.length > 0, club.name);
    const journey = createJourney({ id: `t-${club.id}`, mode: "season", tournamentId: "stadium", opponentId: row.id, opponent: club.name, away: true, region: 5, venue: club.venue, schedule: [] }, 0, () => .99);
    assert.ok(journey.plan && journey.plan.segments.some((segment) => (segment.mode === "bus" || segment.mode === "train") ? segment.points.length > 2 : true), club.name);
  }
  // The relegated club of the league above can be an opponent after a relegation.
  state = playSeason(state, "lose", lcg(2), 9_000);
  assert.equal(state.division, 5);
  assertBalanced(state, "back down");
});

test("every ground of the new clubs can be reached: route legs exist for each of the 14 new clubs", () => {
  for (const club of SEASON_CLUBS.filter((candidate) => candidate.id.startsWith("extra-") || candidate.id === "world-paris-saint-german")) {
    const plan = planJourney(club.venue);
    const ground = plan.segments.filter((segment) => segment.mode === "bus" || segment.mode === "train");
    assert.ok(ground.length > 0, club.name);
    for (const leg of ground) assert.ok(leg.points.length > 2 || leg.geometry === "approximate", `${club.name}: ${leg.mode}`);
  }
});

test("saving and reloading keep the leagues; damaged or old style data falls back to the default leagues", () => {
  const after = playSeason(league(5), "win", lcg(21));
  const reloaded = normalizeSeasonModeState(JSON.parse(JSON.stringify(after)), "FC Goal");
  assert.deepEqual(reloaded.aiLeagues, after.aiLeagues);
  assert.deepEqual(reloaded.lastAiMoves, after.lastAiMoves);
  assert.deepEqual(reloaded.table.map((row) => row.clubId), after.table.map((row) => row.clubId));
  assert.deepEqual(normalizeSeasonModeState(JSON.parse(JSON.stringify(reloaded)), "FC Goal"), reloaded);
  // A map that does not fit the own division, misses clubs or comes from the earlier five clubs model is ignored.
  assert.equal(normalizeAiLeagues(after.aiLeagues, after.division + 1), undefined);
  assert.equal(normalizeAiLeagues({}, 5), undefined);
  assert.equal(normalizeAiLeagues("x", 5), undefined);
  const fiveModel = Object.fromEntries(SEASON_CLUBS.filter((club) => !club.id.startsWith("extra-") && club.id !== "world-paris-saint-german").map((club) => [club.id, 16 - club.league]));
  assert.equal(normalizeAiLeagues(fiveModel, 5), undefined);
  const broken = normalizeSeasonModeState({ division: 5, highestDivision: 5, aiLeagues: fiveModel }, "FC Goal");
  assert.equal(broken.aiLeagues, undefined);
  assertBalanced(broken, "fallback");
});

test("a mid season save keeps its table; the leagues move at the end of the season", () => {
  const afterOne = playSeason(league(5), "win", lcg(5));
  const mid = recordSeasonModeMatch(afterOne, 2, 1, "FC Goal", 9_000, lcg(1)).state;
  const reloaded = normalizeSeasonModeState(JSON.parse(JSON.stringify(mid)), "FC Goal");
  const byId = (rows: SeasonModeState["table"]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(byId(reloaded.table), byId(mid.table));
  assert.equal(reloaded.matchday, mid.matchday);
  assert.deepEqual(reloaded.aiLeagues, mid.aiLeagues);
});

test("a new Prestige run starts in the default leagues again", () => {
  const top = normalizeSeasonModeState({ division: 15, highestDivision: 15, hallOfFame: true }, "FC Goal");
  const moved = advanceAiLeagues({ playerDivision: 15, playerLeagueOrder: [OWN_CLUB_ID, ...seasonClubsOf(15).map((club) => club.id)], ownClubName: "FC Goal", ratingOf: getSeasonOpponentRating, rollScore, random: lcg(2) });
  const fresh = startSeasonPrestige({ ...top, aiLeagues: moved.aiLeagues }, "FC Goal", 5_000);
  assert.equal(fresh.aiLeagues, undefined);
  assert.deepEqual(fresh.lastAiMoves, []);
  assert.equal(fresh.division, 1);
  assertBalanced({ ...fresh, fixtures: createSeasonFixtures(fresh.table) } as SeasonModeState, "prestige");
});

test("the own club's rules: only first place goes up and only last place goes down", () => {
  const outcomes = [1, 2, 3, 4, 5, 6].map((place) => finish(lastMatchday(7, place)).history.at(-1)!.seasonOutcome);
  assert.deepEqual(outcomes, ["promoted", "stayed", "stayed", "stayed", "stayed", "relegated"]);
});

test("the standings markers follow the rule: first place up, last place down", () => {
  const panel = readFileSync(new URL("../app/season-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /index < SEASON_PROMOTION_PLACES \? "promotion"/);
  assert.match(panel, /index >= rows\.length - SEASON_RELEGATION_PLACES && division > 1 \? "relegation"/);
  assert.doesNotMatch(panel, /Platz 1 und 2: Aufstieg|Platz 5 und 6: Abstieg/);
});
