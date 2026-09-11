import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("walkout avatar renders the revealed player without crashing", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /avatar-torso[\s\S]*?starReveal\.player\.rating/);
  assert.doesNotMatch(pageSource, /starWalkout\.player/);
});

test("walkout keeps only the fireworks and confetti effects", async () => {
  const [pageSource, styleSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /className="star-walkout-pyro"/);
  assert.match(pageSource, /className="star-walkout-confetti"/);
  assert.doesNotMatch(pageSource, /star-walkout-banter|STADIONSPRECHER|starWalkoutBanter|star-walkout-smoke|star-walkout-beams|star-walkout-doors|star-walkout-flashes|star-walkout-crowd/);
  assert.doesNotMatch(styleSource, /star-walkout-banter|star-walkout-smoke|star-walkout-beams|star-walkout-doors|star-walkout-flashes|star-walkout-crowd|star-walkout-glow|star-walkout-rays|star-walkout-floor|star-walkout-beam|star-walkout-flash|star-walkout-door|star-walkout-crowd/);
  assert.match(styleSource, /\.star-walkout-pyro\s*\{/);
  assert.match(styleSource, /\.star-walkout-confetti\s*\{/);
  assert.match(pageSource, /starWalkoutIsTop/);
  assert.match(pageSource, /star-reveal-top-walkout/);
  assert.match(styleSource, /\.star-reveal-top-walkout \.star-walkout-pyro i/);
  assert.match(styleSource, /\.star-reveal-top-walkout \.star-walkout-avatar-wrap/);
});

test("walkout continue action unlocks when the visible animation finishes", async () => {
  const [pageSource, styleSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /const STAR_WALKOUT_ANIMATION_MS = 9500/);
  assert.match(pageSource, /const STAR_TOP_WALKOUT_ANIMATION_MS = 11500/);
  assert.match(pageSource, /const STAR_WALKOUT_READY_MS = 7500/);
  assert.match(pageSource, /const STAR_TOP_WALKOUT_READY_MS = 10900/);
  assert.match(pageSource, /"--walkout-duration": `\$\{starWalkoutAnimationDuration\}ms`/);
  assert.match(pageSource, /onAnimationEnd=\{finishStarWalkout\}/);
  assert.match(pageSource, /event\.animationName !== "star-avatar-walk"/);
  assert.match(pageSource, /star-walkout-dismiss\$\{starWalkoutReady \? " ready" : ""\}`} disabled=\{!starWalkoutReady\} onClick=\{dismissStarReveal\}>\{starRevealTrollActive[\s\S]*?starWalkoutReady[\s\S]*?Walkout läuft …/);
  assert.match(pageSource, /"WALKOUT LÄUFT"/);
  assert.match(pageSource, /PACK_TROLL_INTRO_MS/);
  assert.match(pageSource, /star-pack-troll-mascot/);
  assert.doesNotMatch(pageSource, /Walkout überspringen|ÜBERSPRINGEN MÖGLICH/);
  assert.match(styleSource, /\.star-reveal-walkout \.star-walkout-dismiss:disabled \{ cursor: not-allowed; opacity: \.42; \}/);
  assert.match(styleSource, /animation: star-avatar-walk var\(--walkout-duration, 9500ms\)/);
});

test("every Icon and current 86+ base card has a fixed appearance", async () => {
  const [featureSource, walkoutSource, poolSource, ratingSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/fc26-player-pool.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/fc27-ratings.ts", import.meta.url), "utf8"),
  ]);
  const iconBlock = featureSource.match(/const FC26_ICON_DATA = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  const appearanceBlock = walkoutSource.match(/const ICON_APPEARANCE_BY_PLAYER_ID[^=]*= \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const iconIds = [...iconBlock.matchAll(/^  \["([^"]+)",/gm)].map((match) => `icon-${match[1]}`).sort();
  const appearanceIds = [...appearanceBlock.matchAll(/^  "(icon-[^"]+)":/gm)].map((match) => match[1]).sort();

  assert.equal(iconIds.length, 129);
  assert.deepEqual(appearanceIds, iconIds);
  assert.match(appearanceBlock, /"icon-ferenc-puskas": \[S1, "slick", BLACK/);

  const officialRatings = new Map(
    [...ratingSource.matchAll(/^  "(\d+)": (\d+),$/gm)].map((match) => [match[1], Number(match[2])]),
  );
  const baseWalkouts = [...poolSource.matchAll(/\{ id: "[^"]+", sourceId: "([^"]+)", name: "[^"]+", rating: (\d+)/g)]
    .filter((match) => (officialRatings.get(match[1]) ?? Number(match[2])) >= 86)
    .map((match) => match[1]);
  const rawProfileBlock = walkoutSource.match(/const RAW_PROFILES[^=]*= \[([\s\S]*?)\n\];/)?.[1] ?? "";
  const fixedBaseProfiles = new Set([...rawProfileBlock.matchAll(/^  \["([^"]+)",/gm)].map((match) => match[1]));
  assert.equal(baseWalkouts.length, 65);
  assert.deepEqual(baseWalkouts.filter((sourceId) => !fixedBaseProfiles.has(sourceId)), []);

  const physicalBlock = walkoutSource.match(/const FC26_PHYSICAL_BY_SOURCE_ID[^=]*= \{([\s\S]*?)\n\};/)?.[1] ?? "";
  const physicalIds = new Set([...physicalBlock.matchAll(/^  "([^"]+)":/gm)].map((match) => match[1]));
  assert.equal(physicalIds.size, 103);
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

test("Flurin Fabrice is a 69-rated card with a slim fixed walkout appearance independent of clothing", async () => {
  const [featureSource, walkoutSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
  ]);
  const flurinProfile = walkoutSource.match(/"star-flurin-fabrice": \{([\s\S]*?)\n  \},/)?.[1] ?? "";

  assert.match(featureSource, /id: "star-flurin-fabrice",[\s\S]*?name: "Flurin Fabrice",[\s\S]*?rating: 69,/);
  assert.match(flurinProfile, /hair: "medium"/);
  assert.match(flurinProfile, /hairColor: LIGHT_BROWN/);
  assert.match(flurinProfile, /face: "long"/);
  assert.match(flurinProfile, /height: \.98/);
  assert.match(flurinProfile, /build: \.84/);
  assert.doesNotMatch(flurinProfile, /kitPrimary|kitSecondary/);
});

test("Champ Simu keeps a slim long-haired walkout appearance independent of clothing", async () => {
  const walkoutSource = await readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8");
  const champProfile = walkoutSource.match(/"star-champ-simu": \{([\s\S]*?)\n  \},/)?.[1] ?? "";

  assert.match(champProfile, /hair: "pony"/);
  assert.match(champProfile, /hairColor: BLACK/);
  assert.match(champProfile, /beard: "short"/);
  assert.match(champProfile, /face: "long"/);
  assert.match(champProfile, /height: 1\.06/);
  assert.match(champProfile, /build: \.92/);
  assert.doesNotMatch(champProfile, /kitPrimary|kitSecondary|boots/);
});

test("Mätthu matches Nedu's strong walkout appearance except for being bald", async () => {
  const walkoutSource = await readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8");
  const maetthuProfile = walkoutSource.match(/"star-maetthu": \{([\s\S]*?)\n  \},/)?.[1] ?? "";

  assert.match(maetthuProfile, /hair: "bald"/);
  assert.match(maetthuProfile, /hairColor: BLACK/);
  assert.match(maetthuProfile, /beard: "full"/);
  assert.match(maetthuProfile, /face: "round"/);
  assert.match(maetthuProfile, /height: 1\.03/);
  assert.match(maetthuProfile, /build: 1\.1/);
  assert.match(maetthuProfile, /celebration: "arms"/);
  assert.doesNotMatch(maetthuProfile, /kitPrimary|kitSecondary|boots/);
});

test("Silvuz is a fixed Swiss 100-rated pack player with the SILVAN lobby code", async () => {
  const [apiSource, featureSource, walkoutSource, pageSource] = await Promise.all([
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /id: "star-silvuz",[\s\S]*?countryCode: "CH",[\s\S]*?name: "Silvuz",[\s\S]*?position: "LF",[\s\S]*?positions: \["LF", "LM", "RF"\],[\s\S]*?rating: 100,[\s\S]*?packWeight: 0\.02/);
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
  assert.match(pageSource, /function formatStableInteger\(value: number\)/);
  assert.match(pageSource, /formatStableInteger\(STAR_XI_TOTAL_CARD_COUNT\)/);
  assert.match(pageSource, /STAR_XI_SPECIAL_CARD_COUNT} einzigartige Spezialkarten/);
});

test("Nedu Mann Yesss is a Bosnian legendary 100-rated ZM and ZDM pack player", async () => {
  const [featureSource, walkoutSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /id: "star-nedu-mann-yesss",[\s\S]*?countryCode: "BA",[\s\S]*?name: "Nedu Mann Yesss",[\s\S]*?position: "ZM",[\s\S]*?positions: \["ZM", "ZDM"\],[\s\S]*?rating: 100,[\s\S]*?cardType: "legendary",[\s\S]*?packWeight: 0\.02/);
  assert.match(walkoutSource, /BA: \{ name: "Bosnien und Herzegowina"/);
  const neduProfile = walkoutSource.match(/"star-nedu-mann-yesss": \{([\s\S]*?)\n  \},/)?.[1] ?? "";
  assert.match(neduProfile, /\.\.\.GOAT_PROFILE/);
  assert.match(neduProfile, /countryCode: "BA"/);
  assert.match(neduProfile, /hair: "slick"/);
  assert.match(neduProfile, /hairColor: BLACK/);
  assert.match(neduProfile, /beard: "full"/);
  assert.match(neduProfile, /face: "round"/);
  assert.match(neduProfile, /height: 1\.03/);
  assert.match(neduProfile, /build: 1\.1/);
  assert.match(pageSource, /AR, BA, BE/);
});

test("Di Santo is a Dutch 100-rated ST whose walkout borrows only the body", async () => {
  const [featureSource, walkoutSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/walkout-data.ts", import.meta.url), "utf8"),
  ]);
  const diSantoProfile = walkoutSource.match(/"star-di-santo": \{([\s\S]*?)\n  \},/)?.[1] ?? "";

  assert.match(featureSource, /id: "star-di-santo",[\s\S]*?countryCode: "NL",[\s\S]*?name: "Di Santo",[\s\S]*?position: "ST",[\s\S]*?positions: \["ST"\],[\s\S]*?rating: 100,[\s\S]*?cardType: "legendary",[\s\S]*?packWeight: 0\.02/);
  assert.match(diSantoProfile, /skin: S2/);
  assert.match(diSantoProfile, /hair: "slick"/);
  assert.match(diSantoProfile, /hairColor: BLACK/);
  assert.match(diSantoProfile, /beard: "short"/);
  assert.match(diSantoProfile, /face: "angular"/);
  assert.match(diSantoProfile, /height: 1\.04/);
  assert.match(diSantoProfile, /build: 1\.02/);
  assert.doesNotMatch(diSantoProfile, /kitPrimary|kitSecondary|boots/);
  assert.match(walkoutSource, /function fromSpecialBody\(player: StarXIPlayer, body: WalkoutBodyProfile\)/);
});
