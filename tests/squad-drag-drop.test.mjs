import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("squad drag and drop keeps click controls, positions and multiplayer actions", async () => {
  const [pageSource, boardSource, cssSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/squad-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(boardSource, /application\/x-goal-clicker-player/);
  assert.match(boardSource, /function handleSquadDragStart/);
  assert.match(boardSource, /function handleSquadDragOver/);
  assert.match(boardSource, /function handleSquadDrop/);
  assert.match(boardSource, /onDragStart=\{\(event\) => dragSource && drag\.handleSquadDragStart/);
  assert.match(boardSource, /onDrop=\{\(event\) => void drag\.handleSquadDrop/);
  assert.match(boardSource, /getCareerCard\(features\.career, player\)\.rating/);

  assert.match(pageSource, /useSquadDrag\(\{/);
  assert.match(pageSource, /canStarXIPlayerFillSlot\(source\.playerId, target\.index, activeFormationPositions\)/);
  assert.match(pageSource, /source\.area === "bench"[\s\S]*substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS/);
  assert.match(pageSource, /sentOffPlayerIds\.includes\(outgoingPlayerId\)/);
  assert.match(pageSource, /can not be replaced|kann nach einer Roten Karte nicht ausgewechselt werden/);
  assert.match(pageSource, /sendCoopAction\("star-lineup"/);
  assert.match(pageSource, /sendCoopAction\("star-bench"/);
  assert.match(pageSource, /Spieler ziehen oder zwei Spieler nacheinander antippen zum Tauschen/);
  assert.match(pageSource, /resolveSquadTap\(pickedSquadSpot\(\), tapped, canDropSquadPlayer\)/);
  assert.match(pageSource, /<SquadPitchSlot /);
  assert.match(pageSource, /<SquadBenchCard /);

  assert.match(cssSource, /\.starxi-pitch-slot\.squad-drop-ready/);
  assert.match(cssSource, /\.starxi-pitch-slot\.squad-drop-active/);
  assert.match(cssSource, /\.starxi-player-card\.squad-dragging/);
});

test("both in-match substitution views reuse the squad board", async () => {
  const [substitutions, interactive] = await Promise.all([
    readFile(new URL("../app/match-substitutions.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/interactive-match-panel.tsx", import.meta.url), "utf8"),
  ]);
  for (const component of ["useSquadDrag", "SquadPitchPanel", "SquadPitchSlot", "SquadBenchPanel", "SquadBenchCard"]) assert.match(substitutions, new RegExp(component));
  assert.match(interactive, /<MatchSquadEditor /);
  assert.doesNotMatch(substitutions + interactive, /gc-sub-pitch|gc-sub-bank/);
});
