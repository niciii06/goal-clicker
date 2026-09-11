import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Fabrizio Romario transfer events are wired through singleplayer and coop", async () => {
  const [featureSource, apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /TRANSFER_LOAN_CHANCE = 0\.30/);
  assert.match(featureSource, /TRANSFER_SALE_CHANCE = 0\.10/);
  assert.match(featureSource, /TRANSFER_PAID_SALE_CHANCE = 0\.60/);
  assert.match(featureSource, /headline: paidSale \? "HERE WE GOAL"/);
  assert.doesNotMatch(featureSource, /Verkauf bestätigt/);
  assert.match(featureSource, /player\.price/);
  assert.match(featureSource, /finishActiveTransferLoans/);
  assert.match(featureSource, /getOpenTransferSquadVacancies/);
  assert.match(pageSource, /Besetze zuerst den freien Platz/);
  assert.match(apiSource, /Verkaufte oder verliehene Spieler werden nicht automatisch ersetzt/);
  assert.match(pageSource, /sendCoopAction\("transfer-insider-event"\)/);
  assert.match(pageSource, /resolveTransferInsiderEvent\(gameRef\.current\.features\)/);
  assert.match(pageSource, /transfer-insider-takeover/);
  assert.match(apiSource, /action === "transfer-insider-event"/);
  assert.match(apiSource, /if \(game\.features\.cup\.active\) return Response\.json/);
  assert.match(pageSource, /!displayGame\.features\.cup\.active && displayGame\.features\.transferSaga\.nextAt/);
  assert.match(apiSource, /activatePendingTransferLoans/);
  assert.ok((apiSource.match(/completeTournamentRun/g) ?? []).length >= 3);
  assert.match(pageSource, /Aktuell verliehen/);
  assert.match(pageSource, /Transferhistorie/);
  assert.match(pageSource, /DEADLINE DAY \/ ROMARIO LIVE/);
});

test("loaned players disappear from every squad list without looking suspended", async () => {
  const [featureSource, pageSource] = await Promise.all([
    readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(featureSource, /normalizeStarXIState\(features\.starXI, blockedPlayerIds\)/);
  assert.match(pageSource, /!loanedStarIds\.includes\(player\.id\)/);
  assert.match(pageSource, /IM NÄCHSTEN TURNIER NICHT IM TEAM/);
  assert.doesNotMatch(pageSource, /Fabrizio Romano/);
});

test("Fabrizio stays available while the player transfer market is closed", async () => {
  const [apiSource, pageSource] = await Promise.all([
    readFile(new URL("../app/api/multiplayer/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /type FeatureTab = "fabrizio"/);
  assert.match(pageSource, /\{ id: "fabrizio", label: "Fabrizio" \}/);
  assert.match(pageSource, /Keine Spielerkäufe bei Fabrizio/);
  assert.match(pageSource, /featureTab === "fabrizio"/);
  assert.doesNotMatch(pageSource, /buyTransfer/);
  assert.doesNotMatch(pageSource, /refreshTransferMarket/);
  assert.match(pageSource, /Aktuell verliehen/);
  assert.match(pageSource, /Transferhistorie/);
  assert.match(apiSource, /action === "transfer-buy"\) return jsonError\(TRANSFER_MARKET_CLOSED_MESSAGE, 410\)/);
  assert.match(apiSource, /action === "transfer-refresh"\) return jsonError\(TRANSFER_MARKET_CLOSED_MESSAGE, 410\)/);
  assert.match(apiSource, /TRANSFER_MARKET_CLOSED_MESSAGE/);
});

test("failed deals have a large pool of funny non-repeating reasons", async () => {
  const featureSource = await readFile(new URL("../app/feature-data.ts", import.meta.url), "utf8");
  const reasonsBlock = featureSource.match(/const TRANSFER_FAILURE_REASONS = \[([\s\S]*?)\n\] as const;/)?.[1] ?? "";
  const reasons = [...reasonsBlock.matchAll(/^  "([^"]+)",$/gm)].map((match) => match[1]);

  assert.ok(reasons.length >= 40);
  assert.equal(new Set(reasons).size, reasons.length);
  assert.match(reasonsBlock, /Faxgerät/);
  assert.match(reasonsBlock, /Vereinskatze/);
  assert.match(reasonsBlock, /Pizzaschachtel/);
  assert.match(featureSource, /filter\(\(reason\) => reason !== previousReason\)/);
});
