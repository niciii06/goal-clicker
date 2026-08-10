import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("walkout avatar renders the revealed player without crashing", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /avatar-torso[\s\S]*?starReveal\.player\.rating/);
  assert.doesNotMatch(pageSource, /starWalkout\.player/);
});

test("every Icon has a fixed appearance and Puskas never uses the random fallback", async () => {
  const [featureSource, walkoutSource, poolSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/fc26-player-pool.ts", import.meta.url), "utf8"),
  ]);
  const iconBlock = featureSource.match(/const FC26_ICON_DATA = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  const appearanceBlock = walkoutSource.match(/const ICON_APPEARANCE_BY_PLAYER_ID[^=]*= \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const iconIds = [...iconBlock.matchAll(/^  \["([^"]+)",/gm)].map((match) => `icon-${match[1]}`).sort();
  const appearanceIds = [...appearanceBlock.matchAll(/^  "(icon-[^"]+)":/gm)].map((match) => match[1]).sort();

  assert.equal(iconIds.length, 129);
  assert.deepEqual(appearanceIds, iconIds);
  assert.match(appearanceBlock, /"icon-ferenc-puskas": \[S1, "slick", BLACK/);

  const baseWalkouts = [...poolSource.matchAll(/\{ id: "[^"]+", sourceId: "([^"]+)", name: "[^"]+", rating: (\d+)/g)]
    .filter((match) => Number(match[2]) >= 86)
    .map((match) => match[1]);
  const rawProfileBlock = walkoutSource.match(/const RAW_PROFILES[^=]*= \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const fixedBaseProfiles = new Set([...rawProfileBlock.matchAll(/^  \["([^"]+)",/gm)].map((match) => match[1]));
  assert.equal(baseWalkouts.length, 65);
  assert.deepEqual(baseWalkouts.filter((sourceId) => !fixedBaseProfiles.has(sourceId)), []);

  const physicalBlock = walkoutSource.match(/const FC26_PHYSICAL_BY_SOURCE_ID[^=]*= \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const physicalIds = new Set([...physicalBlock.matchAll(/^  "([^"]+)":/gm)].map((match) => match[1]));
  assert.equal(physicalIds.size, 95);
  assert.deepEqual([...fixedBaseProfiles].filter((sourceId) => !physicalIds.has(sourceId)), []);
  assert.match(physicalBlock, /"239085": \[195, 94, "unique"\]/);
});

test("walkout uses real SVG flags and shortens GOAT Nicu positions", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /country-flag-icons\/react\/3x2/);
  assert.match(pageSource, /<WalkoutCountryFlag code=\{starWalkoutPresentation\.countryCode\}/);
  assert.match(pageSource, /player\.id === "star-goat-nicu" \? "Alle Positionen"/);
  assert.doesNotMatch(pageSource, /star-walkout-country"><span aria-hidden="true">/);
});

test("Silvuz is a fixed Swiss 100-rated pack player with the SILVAN lobby code", async () => {
  const [apiSource, featureSource, walkoutSource, pageSource] = await Promise.all([
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /id: "star-silvuz",[\s\S]*?countryCode: "CH",[\s\S]*?name: "Silvuz",[\s\S]*?position: "LF",[\s\S]*?positions: \["LF", "LM"\],[\s\S]*?rating: 100,[\s\S]*?packWeight: 0\.02/);
  assert.match(walkoutSource, /"star-silvuz": \{ \.\.\.GOAT_PROFILE/);
  assert.match(apiSource, /bonusCode !== "SILVAN"/);
  assert.match(apiSource, /addStarXIPlayer\(game\.features\.starXI, silvuz\.id\)/);
  assert.match(pageSource, /Silvan Code eingelöst: Silvuz ist für euren gemeinsamen Club freigeschaltet/);
});

test("Benxli is a Swiss 67-rated legendary goalkeeper with a fixed walkout", async () => {
  const [featureSource, walkoutSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /id: "star-benxli",[\s\S]*?countryCode: "CH",[\s\S]*?name: "Benxli",[\s\S]*?position: "TW",[\s\S]*?positions: \["TW"\],[\s\S]*?rating: 67,[\s\S]*?cardType: "legendary",[\s\S]*?packWeight: 0\.04/);
  assert.match(walkoutSource, /"star-benxli": \{ \.\.\.GOAT_PROFILE/);
  assert.match(pageSource, /1’634 Spieler\. Jeder Pull zählt\./);
  assert.match(pageSource, /7 einzigartige Spezialkarten/);
});

test("Nedu Mann Yesss is a Bosnian legendary 100-rated ZM and ZDM pack player", async () => {
  const [featureSource, walkoutSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /id: "star-nedu-mann-yesss",[\s\S]*?countryCode: "BA",[\s\S]*?name: "Nedu Mann Yesss",[\s\S]*?position: "ZM",[\s\S]*?positions: \["ZM", "ZDM"\],[\s\S]*?rating: 100,[\s\S]*?cardType: "legendary",[\s\S]*?packWeight: 0\.02/);
  assert.match(walkoutSource, /BA: \{ name: "Bosnien und Herzegowina"/);
  assert.match(walkoutSource, /"star-nedu-mann-yesss": \{ \.\.\.GOAT_PROFILE/);
  assert.match(pageSource, /AR, BA, BE/);
});
