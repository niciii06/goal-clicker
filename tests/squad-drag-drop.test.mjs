import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("squad drag and drop keeps click controls, positions and multiplayer actions", async () => {
  const [pageSource, cssSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /application\/x-goal-clicker-player/);
  assert.match(pageSource, /function handleSquadDragStart/);
  assert.match(pageSource, /function handleSquadDragOver/);
  assert.match(pageSource, /function handleSquadDrop/);
  assert.match(pageSource, /canStarXIPlayerFillSlot\(source\.playerId, target\.index, activeFormationPositions\)/);
  assert.match(pageSource, /source\.area === "bench"[\s\S]*substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS/);
  assert.match(pageSource, /sendCoopAction\("star-lineup"/);
  assert.match(pageSource, /sendCoopAction\("star-bench"/);
  assert.match(pageSource, /Spieler ziehen und einrasten lassen · Anklicken bleibt möglich/);
  assert.match(pageSource, /onDragStart=\{\(event\) => dragSource && handleSquadDragStart/);
  assert.match(pageSource, /onDrop=\{\(event\) => void handleSquadDrop/);

  assert.match(cssSource, /\.starxi-pitch-slot\.squad-drop-ready/);
  assert.match(cssSource, /\.starxi-pitch-slot\.squad-drop-active/);
  assert.match(cssSource, /\.starxi-player-card\.squad-dragging/);
});
