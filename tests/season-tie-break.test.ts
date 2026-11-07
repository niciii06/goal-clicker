// Owner decision 3 (2026-11-06): league ranking by points, goal difference, goals scored, then head-to-head,
// then a fixed order by name. Our own club gets no automatic advantage in a tie.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SEASON_MODE_MATCHES_PER_SEASON, initialSeasonMode, normalizeSeasonModeState, recordSeasonModeMatch, sortSeasonTable } from "../app/feature-data.ts";
import type { SeasonModeState } from "../app/feature-data.ts";
import { getSeasonTitle } from "../app/season-trophy.tsx";

type Row = SeasonModeState["table"][number];
const row = (id: string, name: string, points: number, goalsFor: number, goalsAgainst: number): Row => ({ id, name, rating: id === "club" ? 0 : 50, played: 9, wins: 0, draws: 0, losses: 0, goalsFor, goalsAgainst, points });

test("points, goal difference and goals come first, then head-to-head, then the name", () => {
  const table = [row("club", "FC Test", 10, 9, 5), row("season-opponent-1", "Aarau", 10, 9, 5), row("season-opponent-2", "Basel", 10, 12, 8), row("season-opponent-3", "Chur", 11, 1, 9)];
  // Without results the old rule put our club first in every tie; now a fixed order by name decides last.
  assert.deepEqual(sortSeasonTable(table).map((team) => team.id), ["season-opponent-3", "season-opponent-2", "season-opponent-1", "club"]);
  // Head-to-head: Aarau lost to our club.
  const results = [{ matchday: 1, homeId: "club", awayId: "season-opponent-1", homeScore: 2, awayScore: 1 }, { matchday: 2, homeId: "season-opponent-2", awayId: "season-opponent-3", homeScore: 0, awayScore: 5 }];
  assert.deepEqual(sortSeasonTable(table, results).map((team) => team.id), ["season-opponent-3", "season-opponent-2", "club", "season-opponent-1"]);
  // Chur (11 points) leads despite the worst goals; Basel (+4, 12 goals) is ahead of the +4 clubs with 9 goals.
  assert.deepEqual(sortSeasonTable(table, [{ matchday: 1, homeId: "season-opponent-1", awayId: "club", homeScore: 3, awayScore: 0 }]).map((team) => team.id), ["season-opponent-3", "season-opponent-2", "season-opponent-1", "club"]);
});

test("a three-way tie is decided by the mini table of the matches between the three", () => {
  const table = [row("club", "FC Test", 12, 10, 6), row("season-opponent-1", "Aarau", 12, 10, 6), row("season-opponent-2", "Basel", 12, 10, 6)];
  const results = [
    { matchday: 1, homeId: "club", awayId: "season-opponent-1", homeScore: 1, awayScore: 1 },
    { matchday: 2, homeId: "season-opponent-2", awayId: "club", homeScore: 2, awayScore: 0 },
    { matchday: 3, homeId: "season-opponent-1", awayId: "season-opponent-2", homeScore: 3, awayScore: 0 },
    // A match against a club outside the tie does not count for head-to-head.
    { matchday: 4, homeId: "club", awayId: "season-opponent-3", homeScore: 9, awayScore: 0 },
  ];
  // Aarau 4 points (+3), Basel 3 (-1), our club 1 (-2).
  assert.deepEqual(sortSeasonTable(table, results).map((team) => team.id), ["season-opponent-1", "season-opponent-2", "club"]);
});

/** The last matchday of Liga 15: our club and Aarau end level on points, goal difference and goals in second place. */
function promotionRace(headToHead: { homeScore: number; awayScore: number }): SeasonModeState {
  const base = initialSeasonMode("FC Test");
  const values: Record<string, [number, number, number]> = {
    club: [10, 10, 8], "season-opponent-1": [12, 11, 8], "season-opponent-2": [25, 20, 2], "season-opponent-3": [3, 2, 15], "season-opponent-4": [3, 2, 15], "season-opponent-5": [3, 2, 15],
  };
  return {
    ...base,
    matchday: SEASON_MODE_MATCHES_PER_SEASON - 1,
    table: base.table.map((team) => ({ ...team, played: 9, points: values[team.id][0], goalsFor: values[team.id][1], goalsAgainst: values[team.id][2] })),
    results: [{ matchday: 3, homeId: "season-opponent-1", awayId: "club", ...headToHead }],
  };
}

test("head-to-head decides promotion at the end of the season, and the club gets no tie advantage", () => {
  const noGoals = () => 0.99; // Every background match ends 0:0.
  // Our club wins the last match 1:0 and Aarau draws: both have 13 points and 11:8 goals.
  const lost = recordSeasonModeMatch(promotionRace({ homeScore: 2, awayScore: 1 }), 1, 0, "FC Test", 5000, noGoals, "season-opponent-5");
  const level = lost.state.lastTable.filter((team) => team.id === "club" || team.id === "season-opponent-1");
  assert.equal(level[0].points, level[1].points);
  assert.equal(level[0].goalsFor - level[0].goalsAgainst, level[1].goalsFor - level[1].goalsAgainst);
  assert.equal(level[0].goalsFor, level[1].goalsFor);
  assert.equal(lost.entry?.seasonOutcome, "stayed", "Aarau won the direct match and goes up");
  assert.equal(lost.state.division, 1);
  assert.equal(lost.state.lastResults?.length, 4, "the finished season keeps its results for the final table");
  assert.equal(sortSeasonTable(lost.state.lastTable, lost.state.lastResults)[2].id, "club");
  assert.equal(getSeasonTitle(lost.entry, lost.state.lastTable, lost.state.lastResults), null);

  const won = recordSeasonModeMatch(promotionRace({ homeScore: 0, awayScore: 1 }), 1, 0, "FC Test", 5000, noGoals, "season-opponent-5");
  assert.equal(won.entry?.seasonOutcome, "promoted");
  assert.equal(won.state.division, 2);
  assert.equal(sortSeasonTable(won.state.lastTable, won.state.lastResults)[1].id, "club");
  // The saved state keeps the results behind the final table.
  const restored = normalizeSeasonModeState(JSON.parse(JSON.stringify(won.state)), "FC Test");
  assert.deepEqual(restored.lastResults, won.state.lastResults);
  assert.equal(sortSeasonTable(restored.lastTable, restored.lastResults)[1].id, "club");
});

test("old saves without lastResults rank the running table with its results", () => {
  const running = promotionRace({ homeScore: 0, awayScore: 1 });
  const legacy = JSON.parse(JSON.stringify({ ...running, lastTable: running.table })) as Record<string, unknown>;
  delete legacy.lastResults;
  const restored = normalizeSeasonModeState(legacy, "FC Test");
  assert.equal(restored.lastResults?.length, 1);
  assert.deepEqual(restored.lastResults, restored.results);
  const fresh = normalizeSeasonModeState({ ...legacy, matchday: 0, results: [] }, "FC Test");
  assert.deepEqual(fresh.lastResults, []);
});

test("the solo announcement, the trophy and the season panel use the same ranking", () => {
  const page = readFileSync(new URL("../app/game-app.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../app/season-panel.tsx", import.meta.url), "utf8");
  assert.match(page, /sortSeasonTable\(seasonStandingsAnnouncement\.table, seasonStandingsAnnouncement\.results\)/);
  assert.match(page, /getSeasonTitle\(latest, displayGame\.features\.seasonMode\.lastTable, displayGame\.features\.seasonMode\.lastResults\)/);
  assert.match(panel, /results=\{season\.results \?\? \[\]\}/);
  assert.match(panel, /results=\{season\.lastResults \?\? \[\]\}/);
  assert.match(panel, /Tordifferenz, erzielte Tore und danach die direkten Begegnungen/);
});
