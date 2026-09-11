import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("multiplayer state writes use a monotonic revision and retry stale actions", async () => {
  const [apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  const databaseSource = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");

  assert.match(databaseSource, /shared_state_version.*shared_state_version \+ 1|apply_coop_click/);
  assert.match(apiSource, /sharedStateVersion: room\.sharedStateVersion/);
  assert.match(apiSource, /updateRoom\([\s\S]*sharedStateVersion: room\.sharedStateVersion/);
  assert.match(apiSource, /applyClick\(code, role, amount, clickCount, timestamp\)/);
  assert.match(apiSource, /errorCode: "STALE_STATE"/);
  assert.match(pageSource, /data\.errorCode === "STALE_STATE"/);
  assert.match(pageSource, /room\.revision < current\.room\.revision/);
  assert.match(pageSource, /clickCount: batch\.count/);
  assert.match(pageSource, /window\.setTimeout\(flushCoopClickBatch, 70\)/);
});

test("live tournament ticks yield to foreground upgrade purchases", async () => {
  const [apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /action === "tick" \|\| action === "cup-tick"/);
  assert.match(pageSource, /coopForegroundPendingRef\.current > 0 \|\| coopBackgroundActionRef\.current/);
  assert.match(pageSource, /if \(coopForegroundPendingRef\.current > 0\) \{[\s\S]*?setTimeout\(flushCoopClickBatch, 70\)/);
  assert.match(pageSource, /className="buy-button" disabled=\{!affordable \|\| coopBusy\}/);
  assert.match(pageSource, /Live Match · Upgrades bleiben kaufbar/);

  assert.match(apiSource, /SIMULATION_LEADER_TIMEOUT_MS = 5000/);
  assert.match(apiSource, /getSimulationLeaderRole\(room, Date\.parse\(presenceTimestamp\)\) !== role/);
  assert.match(apiSource, /for \(let attempt = 0; attempt < 8; attempt \+= 1\)/);
  assert.match(apiSource, /action === "buy"/);
  const buyHandler = apiSource.slice(apiSource.indexOf('if (action === "buy")'), apiSource.indexOf('if (action === "transfer-buy")'));
  assert.doesNotMatch(buyHandler, /cup\.active/);
});

test("singleplayer and multiplayer tournaments never add direct goal rewards", async () => {
  const [featureSource, apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(featureSource, /baseReward|rewardMultiplier/);
  assert.doesNotMatch(apiSource, /result\.reward/);
  assert.doesNotMatch(pageSource, /result\.reward/);
  assert.match(apiSource, /if \(result\.tournamentWon\) game\.features\.goalBoost = startTournamentGoalBoost/);
  assert.match(pageSource, /if \(result\.tournamentWon\) features\.goalBoost = startTournamentGoalBoost/);
});

test("tournament cooldown stays server-safe while season matches share the game picker", async () => {
  const [featureSource, apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /TOURNAMENT_COOLDOWN_MS = 5 \* 60 \* 1000/);
  assert.match(featureSource, /nextCup\.nextTournamentAt = now \+ TOURNAMENT_COOLDOWN_MS/);
  assert.match(apiSource, /!game\.features\.cup\.pendingNextRound && game\.features\.cup\.nextTournamentAt > cupNow/);
  assert.match(pageSource, /Saisonspiel starten/);
  assert.match(pageSource, /tournamentCooldownActive/);
  assert.match(pageSource, /season-competition-card/);
  assert.match(pageSource, /startCup\(selectedTournament\.id\)/);
});

test("minimised multiplayer sessions receive a long passive grace period", async () => {
  const apiSource = await readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8");
  assert.match(apiSource, /PASSIVE_BACKGROUND_GRACE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(apiSource, /activeLeaseEndsAt = latestSeenAt \+ PASSIVE_BACKGROUND_GRACE_MS/);
});

test("multiplayer rooms preserve old slots and accept four players", async () => {
  const [schemaSource, apiSource, pageSource, protocolSource] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/multiplayer-protocol.ts", import.meta.url), "utf8"),
  ]);

  assert.match(schemaSource, /player3PlayerId: text\("player3_player_id"\)/);
  assert.match(schemaSource, /player4PlayerId: text\("player4_player_id"\)/);
  assert.match(apiSource, /const COOP_ROLES = \["host", "guest", "player3", "player4"\] as const/);
  assert.match(apiSource, /Maximal vier Spieler können gemeinsam spielen/);
  assert.match(apiSource, /getOccupiedRoomPlayers\(room\)\.length >= 2/);
  assert.match(pageSource, /BIS ZU VIER SPIELER/);
  assert.match(pageSource, /room\.players\.map/);
  assert.match(protocolSource, /MULTIPLAYER_PROTOCOL_VERSION = 2/);
});
