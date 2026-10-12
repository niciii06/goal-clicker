import assert from "node:assert/strict";
import test from "node:test";
import { beginSeasonCupMatch, getCupMatchMinute, getCupRegularDurationMs, initialGameFeatures, CUP_MATCH_DURATION_MS, CUP_EXTRA_TIME_DURATION_MS } from "../app/feature-data.ts";
import { getViewerEvents } from "../app/match-viewer.tsx";

test("new regular fixture has six real minutes and a synchronized 90-minute clock", () => {
  const now = 1_000_000;
  const features = initialGameFeatures(now);
  const cup = beginSeasonCupMatch(features.cup, features.seasonMode, now);
  assert.equal(cup.matchEndsAt - cup.matchStartedAt, 360_000);
  assert.equal(CUP_MATCH_DURATION_MS, 360_000);
  assert.equal(CUP_EXTRA_TIME_DURATION_MS, 120_000);
  assert.equal(getCupMatchMinute(cup, now), 1);
  assert.equal(getCupMatchMinute(cup, now + 180_000), 46);
  assert.equal(getCupMatchMinute(cup, now + 359_999), 90);
});

test("saved three-minute fixture keeps its old match clock and event calibration", () => {
  const now = 1_000_000;
  const f = initialGameFeatures(now);
  const cup = { ...beginSeasonCupMatch(f.cup, f.seasonMode, now), matchEndsAt: now + 180_000 };
  assert.equal(getCupRegularDurationMs(cup), 180_000);
  assert.equal(getCupMatchMinute(cup, now + 90_000), 46);
  assert.equal(getCupMatchMinute(cup, now + 179_999), 90);
  const legacyOvertime = { ...cup, phase: "extra-time" as const, matchEndsAt: now + 240_000 };
  assert.equal(getCupMatchMinute(legacyOvertime, now + 210_000), 106);
  const currentOvertime = { ...cup, phase: "extra-time" as const, matchEndsAt: now + 480_000 };
  assert.equal(getCupMatchMinute(currentOvertime, now + 420_000), 106);
});

test("visual match events come exclusively from recorded authoritative goal, card and penalty events", () => {
  const f = initialGameFeatures(1_000_000);
  const cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1_000_000);
  assert.deepEqual(getViewerEvents(cup), []);
  const modified = {
    ...cup,
    matchEvents: [{ id: "goal-1", side: "home" as const, scorerId: "player-1", scorer: "Torjäger", minute: 38, createdAt: 1_152_000, homeScore: 1, awayScore: 0, ratingImpacts: {} }],
    cardEvents: [{ id: "red-1", side: "away" as const, playerId: null, player: "Verteidiger", reason: "Notbremse", card: "red" as const, minute: 55, createdAt: 1_216_000, homeScore: 1, awayScore: 0 }],
  };
  const result = getViewerEvents(modified);
  assert.deepEqual(result.map((e) => [e.id,e.kind,e.side,e.minute]), [["goal-1","goal","club",38],["red-1","card","opponent",55]]);
});
