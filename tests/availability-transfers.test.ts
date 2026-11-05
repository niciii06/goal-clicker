// Player availability, transfer offers and the season schedule across systems (audit B08 to B13, B38, X01, X05, L08, L13).
import assert from "node:assert/strict";
import test from "node:test";
import {
  STAR_XI_PLAYERS, SEASON_MODE_MATCHES_PER_SEASON, TRANSFER_OFFER_DURATION_MS, acceptTransferOffer, addStarXIPlayer, beginSeasonCupMatch,
  declineTransferOffer, expireTransferOffer, getBestXIUnavailablePlayerIds, getSeasonSchedule, initialGameFeatures, initialSeasonMode, normalizeGameFeatures,
  normalizeStarXIState, recordSeasonModeMatch, resolveTransferInsiderEvent, setBestStarXI, setStarXIFormation, canStarXIPlayerFillSlot,
} from "../app/feature-data.ts";
import type { GameFeatures, TransferOffer } from "../app/feature-data.ts";

function seededRandom(seed = 13579) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const fullSquad = (now = 1000) => {
  const features = initialGameFeatures(now);
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => !p.id.startsWith("scrap-")).map((p) => p.id) });
  return features;
};

function withOffer(features: GameFeatures, now: number, playerId = features.starXI.lineupIds.find(Boolean)!): GameFeatures {
  const player = STAR_XI_PLAYERS.find((p) => p.id === playerId)!;
  const offer: TransferOffer = { id: `offer-${now}`, outcome: "offer", playerId, playerName: player.name, club: "Testclub", headline: "Angebot", message: "", reason: "", fee: 1000, createdAt: now, expiresAt: now + TRANSFER_OFFER_DURATION_MS };
  features.transferSaga.pendingOffer = offer;
  return features;
}

test("B11: a scrap card that completes the eleven leaves injured, banned and loaned players out", () => {
  const scrap = STAR_XI_PLAYERS.find((p) => p.id.startsWith("scrap-"));
  assert.ok(scrap, "a scrap card exists");
  const features = fullSquad();
  const [injured, banned, loaned] = features.starXI.lineupIds.filter(Boolean);
  features.cup.injuredPlayerIds = { [injured]: 2 };
  features.discipline.bans = [{ id: "ban-1", playerId: banned, competition: "league", matches: 1, yellowCards: 3, createdAt: 1 } as GameFeatures["discipline"]["bans"][number]];
  features.transferSaga.loans = [{ playerId: loaned, club: "Leihclub", status: "pending", tournamentId: null, createdAt: 1 }];
  const normalized = normalizeGameFeatures(features);
  // The unavailable players were taken out; the scrap card then rebuilds the eleven.
  normalized.starXI = normalizeStarXIState({ ...normalized.starXI, lineupIds: normalized.starXI.lineupIds.map((id) => [injured, banned, loaned].includes(id) ? "" : id), benchIds: normalized.starXI.benchIds.map((id) => [injured, banned, loaned].includes(id) ? "" : id) });
  const blocked = getBestXIUnavailablePlayerIds(normalized);
  for (const id of [injured, banned, loaned]) assert.ok(blocked.includes(id), `${id} is unavailable`);
  const next = addStarXIPlayer(normalized.starXI, scrap.id, blocked);
  for (const id of [injured, banned, loaned]) {
    assert.ok(!next.lineupIds.includes(id), `${id} stays out of the eleven`);
    assert.ok(!next.benchIds.includes(id), `${id} stays off the bench`);
  }
  assert.ok(next.ownedIds.includes(scrap.id));
});

test("B13: a formation change fills a slot left open by the old formation from the bench", () => {
  const features = fullSquad();
  const state = { ...features.starXI, lineupIds: [...features.starXI.lineupIds] };
  state.lineupIds[10] = "";
  const before = normalizeStarXIState(state);
  assert.equal(before.lineupIds.filter(Boolean).length, 10, "the empty slot is kept within the same formation");
  const target = before.formationId === "442" ? "433" : "442";
  const changed = setStarXIFormation(before, target);
  assert.equal(changed.lineupIds.filter(Boolean).length, 11, "the new formation has no gap the squad can fill");
  assert.equal(new Set([...changed.lineupIds, ...changed.benchIds].filter(Boolean)).size, [...changed.lineupIds, ...changed.benchIds].filter(Boolean).length);
});

test("B13: normalizing a lineup with the same id twice never places it twice and is idempotent", () => {
  const features = fullSquad();
  const positions = features.starXI.formationPositions;
  const fits = (id: string) => positions.map((_, index) => canStarXIPlayerFillSlot(id, index, positions));
  // A player who fits two open slots, requested twice in slots he cannot play.
  const id = features.starXI.ownedIds.find((candidate) => fits(candidate).filter(Boolean).length >= 2 && fits(candidate).filter((ok) => !ok).length >= 2)!;
  assert.ok(id);
  const wrong = fits(id).flatMap((ok, index) => ok ? [] : [index]).slice(0, 2);
  const lineupIds = Array.from({ length: 11 }, (_, index) => wrong.includes(index) ? id : null);
  const once = normalizeStarXIState({ ...features.starXI, ownedIds: [id], lineupIds, benchIds: [] });
  assert.equal(once.lineupIds.filter((entry) => entry === id).length, 1, "no id appears twice");
  assert.deepEqual(normalizeStarXIState(once), once);
});

test("B38/X01: an offer that would run out during a home match waits for the final whistle", () => {
  const start = 10_000;
  let features = withOffer(fullSquad(start), start);
  // Kick-off one minute later, two minutes are left on the offer.
  const kickoff = start + 60_000;
  features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, kickoff);
  const matchEndsAt = features.cup.matchEndsAt;
  const due = start + TRANSFER_OFFER_DURATION_MS + 1000;
  assert.ok(due < matchEndsAt, "the offer would run out during the match");
  const during = expireTransferOffer(features, due);
  assert.equal(during.event, null, "no decline during the match");
  assert.equal(during.deferred, true);
  assert.ok(during.features.transferSaga.pendingOffer);
  assert.equal(during.features.transferSaga.pendingOffer!.expiresAt, matchEndsAt + 120_000, "the time left at kick-off comes back after the match");
  // Repeated checks during the match change nothing more.
  assert.equal(expireTransferOffer(during.features, due + 5000).deferred, undefined);
  // Answering is blocked during the match, for selling and keeping alike.
  assert.ok(acceptTransferOffer(during.features, due).error);
  assert.ok(declineTransferOffer(during.features, due).error);
  assert.ok(declineTransferOffer(during.features, due).features.transferSaga.pendingOffer);
  // After the match the offer still runs out normally.
  features = normalizeGameFeatures(during.features);
  features.cup = { ...features.cup, active: false };
  assert.equal(expireTransferOffer(features, matchEndsAt + 60_000).event, null);
  assert.equal(expireTransferOffer(features, matchEndsAt + 120_000).event?.outcome, "declined");
});

test("B38: an offer already run out before kick-off still counts as declined", () => {
  const start = 10_000;
  const features = withOffer(fullSquad(start), start);
  features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, start + TRANSFER_OFFER_DURATION_MS + 1000);
  assert.equal(expireTransferOffer(features, start + TRANSFER_OFFER_DURATION_MS + 5000).event?.outcome, "declined");
});

test("sale: the sold card leaves no injury, yellow card count or ban behind", () => {
  const features = fullSquad();
  const sold = features.starXI.lineupIds.find(Boolean)!;
  features.cup.injuredPlayerIds = { [sold]: 2 };
  features.discipline.league = { [sold]: 2 };
  features.discipline.tournaments = { stadium: { [sold]: 1 } };
  features.discipline.bans = [{ id: "ban-1", playerId: sold, competition: "league", matches: 1, yellowCards: 3, createdAt: 1 } as GameFeatures["discipline"]["bans"][number]];
  const result = acceptTransferOffer(withOffer(normalizeGameFeatures(features), 2000, sold), 3000);
  assert.equal(result.error, undefined);
  assert.equal(result.features.starXI.ownedIds.includes(sold), false);
  assert.equal(result.features.cup.injuredPlayerIds[sold], undefined);
  assert.equal(result.features.discipline.league[sold], undefined);
  assert.equal(result.features.discipline.tournaments.stadium, undefined);
  assert.equal(result.features.discipline.bans.length, 0);
});

test("B08: a league match keeps the tournament break and its countdown", () => {
  const features = fullSquad();
  features.cup.nextTournamentAt = 500_000;
  const cup = beginSeasonCupMatch(features.cup, features.seasonMode, 100_000);
  assert.equal(cup.nextTournamentAt, 500_000);
});

test("B09: the simulated home advantage goes to the stored home team", () => {
  let homeGoals = 0, awayGoals = 0;
  const random = seededRandom(424242);
  for (let run = 0; run < 400; run += 1) {
    let season = initialSeasonMode("FC Test");
    for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON; day += 1) {
      const before = season.results?.length ?? 0;
      season = recordSeasonModeMatch(season, 1, 1, "FC Test", 1000 + day, random).state;
      if (day === SEASON_MODE_MATCHES_PER_SEASON - 1) break;
      for (const result of (season.results ?? []).slice(before)) {
        if (result.homeId === "club" || result.awayId === "club") continue;
        homeGoals += result.homeScore;
        awayGoals += result.awayScore;
      }
    }
  }
  assert.ok(homeGoals > awayGoals * 1.05, `home ${homeGoals} vs away ${awayGoals}`);
});

test("B10: after the Hall of Fame every matchday is played and none is next", () => {
  const season = { ...initialSeasonMode("FC Test"), hallOfFame: true, matchday: 0 };
  const schedule = getSeasonSchedule(season);
  assert.equal(schedule.length, SEASON_MODE_MATCHES_PER_SEASON);
  assert.ok(schedule.every((day) => day.played));
});

test("X05: a loan after the Hall of Fame names the next tournament, not a league match", () => {
  const features = fullSquad();
  features.seasonMode = { ...features.seasonMode, hallOfFame: true };
  features.cup.mode = "season";
  const sequence = [0.299999, 0, 0, 0];
  let index = 0;
  const loan = resolveTransferInsiderEvent(features, () => sequence[index++] ?? 0.5, 2000);
  assert.equal(loan.event?.outcome, "loan");
  assert.match(loan.event!.message, /Turnier/);
  assert.doesNotMatch(loan.event!.message, /Saisonpartie/);
});

test("L08: saving merges stored pack receipts without changing the game passed in", async () => {
  const store = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; } } });
  const storage = await import(`../app/game/storage.ts?${"no-mutation"}`) as typeof import("../app/game/storage.ts");
  const { STORAGE_KEY } = await import("../app/game/constants.ts");
  storage.markLocalSaveLoaded();
  const first = storage.initialGame();
  first.features.earnedPacks = [{ id: "receipt-1", packId: "special", earnedAt: 1 }];
  assert.equal(storage.persistLocalGame(first), "saved");
  const second = storage.initialGame();
  second.totalGoals = second.goals = 10;
  const packsBefore = second.features.earnedPacks;
  const snapshot = JSON.stringify(second);
  assert.equal(storage.persistLocalGame(second), "saved");
  assert.equal(JSON.stringify(second), snapshot, "the state passed in is unchanged");
  assert.equal(second.features.earnedPacks, packsBefore);
  const saved = JSON.parse(store.get(STORAGE_KEY)!) as { features: { earnedPacks: { id: string }[] } };
  assert.ok(saved.features.earnedPacks.some((pack) => pack.id === "receipt-1"), "the stored receipt is kept");
});
