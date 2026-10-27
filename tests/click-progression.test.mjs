import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clickTiers = [
  ["boots", 1],
  ["technique", 3],
  ["instinct", 5],
  ["striker", 10],
  ["longshot", 25],
  ["freekick", 50],
  ["worldclass", 100],
  ["ballondor", 250],
  ["captain", 500],
];

test("singleplayer and multiplayer share the complete click progression", async () => {
  const [pageSource, apiSource, upgradesSource, economySource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/upgrades.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/economy.ts", import.meta.url), "utf8"),
  ]);

  for (const [id, power] of clickTiers) {
    assert.match(upgradesSource, new RegExp(`id: \\"${id}\\"[^\\n]*description: \\"\\+${power} (?:Tor|Tore) pro Klick\\"`));
    assert.match(economySource, new RegExp(`getLevel\\(upgrades, \\"${id}\\"\\)${power === 1 ? "" : ` \\* ${power}`}`));
  }

  // Both sides read the one catalogue and the one formula instead of keeping their own copies.
  assert.match(pageSource, /import \{ UPGRADES \} from "\.\/game\/upgrades";/);
  assert.match(apiSource, /import \{ getUpgrade \} from "\.\.\/\.\.\/game\/upgrades";/);
  assert.match(apiSource, /import \{[^}]*\bgetClickPower\b[^}]*\} from "\.\.\/\.\.\/game\/economy";/);
  assert.doesNotMatch(apiSource, /const UPGRADES|function getBaseClickPower|function getBasePassivePower/);
  assert.doesNotMatch(pageSource, /const UPGRADES|function getBaseClickPower/);
  assert.match(pageSource, /CLUB OFFICE \/ 21 AUSBAUSTUFEN/);
});

test("holding Enter or Space cannot repeat ball clicks", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const keyboardHandler = pageSource.slice(
    pageSource.indexOf("function handleBallKeyDown"),
    pageSource.indexOf("function awardMiniGame"),
  );
  const ballButton = pageSource.match(/<button type="button" className=\{`ball-button[^\n]+<\/button>/)?.[0] ?? "";

  assert.match(keyboardHandler, /event\.key === "Enter"/);
  assert.match(keyboardHandler, /event\.key === " "/);
  assert.match(keyboardHandler, /event\.repeat/);
  assert.match(keyboardHandler, /event\.preventDefault\(\)/);
  assert.match(ballButton, /onClick=\{handleBallClick\}/);
  assert.match(ballButton, /onKeyDown=\{handleBallKeyDown\}/);
});
