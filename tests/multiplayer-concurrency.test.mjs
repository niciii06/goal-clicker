import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("multiplayer state writes use a monotonic revision and retry stale actions", async () => {
  const [apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(apiSource, /sharedStateVersion: sql`\$\{coopRooms\.sharedStateVersion\} \+ 1`/);
  assert.match(apiSource, /eq\(coopRooms\.sharedStateVersion, room\.sharedStateVersion\)/);
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
