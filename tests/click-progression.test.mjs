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
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  for (const [id, power] of clickTiers) {
    assert.match(pageSource, new RegExp(`id: \\"${id}\\"[^\\n]*description: \\"\\+${power} (?:Tor|Tore) pro Klick\\"`));
    assert.match(apiSource, new RegExp(`${id}: \\{[^\\n]*description: \\"\\+${power} (?:Tor|Tore) pro Klick\\"`));
    assert.match(pageSource, new RegExp(`getLevel\\(upgrades, \\"${id}\\"\\)${power === 1 ? "" : ` \\* ${power}`}`));
    assert.match(apiSource, new RegExp(`getLevel\\(upgrades, \\"${id}\\"\\)${power === 1 ? "" : ` \\* ${power}`}`));
  }

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
