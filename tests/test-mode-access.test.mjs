import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isSeasonContentUnlocked } from "../app/season-progression.ts";

test("AZB bypasses season locks without changing normal progression", () => {
  assert.equal(isSeasonContentUnlocked(20, 0, true), true);
  assert.equal(isSeasonContentUnlocked(20, 0, false), false);
  assert.equal(isSeasonContentUnlocked(1, 0, false), true);
});

test("AZB upgrade purchases bypass overflowed prices in client and multiplayer", async () => {
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /getBulkPurchase\(upgrade, displayGame\.upgrades, spendableGoals, purchaseMode, hasInfiniteMoney\)/);
  assert.match(apiSource, /calculateBulkUpgradePurchase\(upgrade, getLevel\(game\.upgrades, id\), game\.goals, requestedCount/);
  assert.match(apiSource, /unlimitedMoney,/);
  assert.match(pageSource, /try \{[\s\S]*?sendCoopAction\("buy"[\s\S]*?finally \{[\s\S]*?setCoopBusy\(false\)/);
});

test("new AZB redemptions are disabled without removing existing test rooms", async () => {
  const apiSource = await readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8");

  assert.match(apiSource, /const AZB_CODE_ENABLED = false/);
  assert.match(apiSource, /bonusCode === "AZB" && !AZB_CODE_ENABLED[\s\S]*?momentan deaktiviert/);
  assert.match(apiSource, /const testMode = parseJson<string\[]>\(room\.redeemedBonusCodesJson, \[\]\)\.includes\("AZB"\)/);
});

test("client and multiplayer server apply AZB to every season gated category", async () => {
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /isSeasonContentUnlocked\(unlockSeason, displayGame\.seasons, hasFullTestAccess\)/);
  assert.match(pageSource, /isSeasonContentUnlocked\(getFormationUnlockSeason\(formation\.id\), displayGame\.seasons, hasFullTestAccess\)/);

  for (const unlockVariable of ["upgradeUnlockSeason", "formationUnlockSeason", "packUnlockSeason", "tournamentUnlockSeason"]) {
    const gameVariable = unlockVariable === "upgradeUnlockSeason" ? "(?:game|purchaseGame)" : "game";
    assert.match(apiSource, new RegExp(`isSeasonContentUnlocked\\(${unlockVariable}, ${gameVariable}\\.seasons, testMode\\)`));
  }
});

test("lobby code history stays hidden while duplicate codes remain blocked", async () => {
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(apiSource, /12345/);
  assert.match(apiSource, /redeemedCodes\.includes\(bonusCode\)[\s\S]*?bereits eingelöst/);
  assert.doesNotMatch(pageSource, /bonusCodeRedeemed|silvanCodeRedeemed|coop-bonus-used/);
});

test("season mode uses the live match flow and table results instead of goal targets", async () => {
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /beginSeasonCupMatch\(features\.cup, features\.seasonMode/);
  assert.match(apiSource, /beginSeasonCupMatch\(game\.features\.cup, game\.features\.seasonMode/);
  assert.match(pageSource, /sendCoopAction\("cup-start", \{ mode: "season" \}\)/);
  assert.match(apiSource, /payload\.mode === "season"/);
  assert.match(pageSource, /recordSeasonModeMatch\(features\.seasonMode, features\.cup\.homeScore, features\.cup\.awayScore/);
  assert.match(apiSource, /recordSeasonModeMatch\(game\.features\.seasonMode, game\.features\.cup\.homeScore, game\.features\.cup\.awayScore/);
  assert.doesNotMatch(pageSource, /playSeasonModeMatch\(displayGame\.features\.seasonMode/);
  assert.doesNotMatch(apiSource, /playSeasonModeMatch\(game\.features\.seasonMode/);
  assert.doesNotMatch(pageSource, /seasonTarget|seasonPath/);
  assert.doesNotMatch(apiSource, /seasonTarget|seasonPath/);
});

test("season match results open a large standings takeover", async () => {
  const [pageSource, featureSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /season-standings-takeover/);
  assert.match(pageSource, /displayGame\.features\.seasonMode\.lastTable/);
  assert.match(pageSource, /TOR-DIFF\./);
  assert.match(pageSource, /formatGoalDifference\(team\)/);
  assert.match(pageSource, /seasonHistoryRef\.current/);
  assert.match(pageSource, /Rangliste aktualisiert/);
  assert.match(featureSource, /lastTable: SeasonTableRow\[\]/);
  assert.match(featureSource, /lastTable,\n    lastResult/);
});

test("purchase surfaces always show full prices instead of missing amounts", async () => {
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /`\$\{formatNumber\(pack\.price\)\} · Pack öffnen`/);
  assert.doesNotMatch(pageSource, /formatNumber\((?:pack\.price|player\.price|nextCost) -/);
  assert.doesNotMatch(apiSource, /Für (?:dieses Pack|dieses Upgrade|diesen Transfer) fehlen/);
});

test("progress surfaces show full targets instead of remaining amounts", async () => {
  const [pageSource, apiSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /Saisonspiel starten/);
  assert.match(pageSource, /`\$\{formatNumber\(nextRank\.minimum\)\} Tore für \$\{nextRank\.name\}`/);
  assert.match(pageSource, /`\$\{seasonNextOpponent\.rating\} OVR/);
  assert.match(pageSource, /`\$\{STAR_XI_SQUAD_SIZE\} passende Startplätze erforderlich`/);
  assert.match(pageSource, /tournament-picker/);
  assert.match(pageSource, /season-competition-card/);
  assert.match(pageSource, /startCup\(selectedTournament\.id\)/);
  assert.match(pageSource, /TOURNAMENTS\.map/);
  assert.doesNotMatch(pageSource, /LEGACY-MATCH|Neue Spiele starten ab jetzt direkt im Saisonmodus/);
  assert.doesNotMatch(pageSource, /seasonPath\.remaining|nextRank\.minimum - displayGame\.totalGoals/);
  assert.doesNotMatch(apiSource, /seasonPath\.remaining/);
});
