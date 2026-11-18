// Prestige decisions of 16 and 17 November 2026 (Notion P0 «Prestige: Spezialkarten, gewählte Karte und Reset»):
// after a Prestige the Club Office upgrades and the buyable packs are locked again like in a new game and unlock again
// league by league with the new run; the goal bonus is +10 percentage points per Prestige, additive. Formations,
// tournaments, the best league ever, owned packs, fragments and cards are not touched. Solo and co-op use the same rule.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
import {
  SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, SPECIAL_CARD_PACK, STAR_FORMATIONS, STAR_PACKS, STAR_XI_PLAYERS, getPrestigeGoalMultiplier,
  initialGameFeatures, normalizeGameFeatures, recordSeasonModeMatch, setBestStarXI,
} from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { applyGamePrestige } from '../app/game/prestige.ts';
import { UPGRADES } from '../app/game/upgrades.ts';
import { getFormationUnlockLeague, getPackUnlockLeague, getReachedLeague, getShopReachedLeague, getUpgradeUnlockLeague, isLeagueContentUnlocked, leagueForTier } from '../app/season-progression.ts';

const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST, clearRoomCacheForTests } = await import('../app/api/multiplayer/route.ts');

const NOW = 2_000_000_000_000;
const roundTrip = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
type Game = { goals: number; totalGoals: number; seasonGoals: number; clicks: number; stars: number; seasons: number; upgrades: Record<string, number>; achievements: string[]; lastSaved: number; features: GameFeatures };

const PACKS = [...STAR_PACKS.map((pack) => pack.id), SPECIAL_CARD_PACK.id];
/** What the shop offers: upgrades and buyable packs unlocked by the league of this run. */
function shop(game: Pick<Game, 'seasons' | 'features'>) {
  const league = getShopReachedLeague(game.seasons, game.features.seasonMode);
  return {
    league,
    upgrades: UPGRADES.filter((upgrade) => isLeagueContentUnlocked(getUpgradeUnlockLeague(upgrade.id), league)).map((upgrade) => upgrade.id),
    packs: PACKS.filter((id) => isLeagueContentUnlocked(getPackUnlockLeague(id), league)),
  };
}
const freshGame = (): Game => ({ goals: 0, totalGoals: 0, seasonGoals: 0, clicks: 0, stars: 0, seasons: 0, upgrades: {}, achievements: [], lastSaved: NOW, features: normalizeGameFeatures(initialGameFeatures(NOW)) });

function hallOfFameGame(prestigeCount = 0): Game {
  const f = initialGameFeatures(NOW - 1_000_000);
  f.starterSquadGranted = true;
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => !p.isCustom && !p.retired && p.rating < 85).slice(0, 23).map((p) => p.id) });
  f.starXI.fragments = 12_345;
  f.seasonMode = { ...f.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount, ...(prestigeCount ? { runHighestDivision: SEASON_MODE_DIVISION_COUNT } : {}) };
  f.earnedPacks = [{ id: 'kept-reward', packId: 'reward-1', earnedAt: NOW - 5000 }] as GameFeatures['earnedPacks'];
  return { goals: 5_000_000, totalGoals: 9e9, seasonGoals: 8e6, clicks: 12_345, stars: 20, seasons: 14, upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 3])), achievements: [], lastSaved: NOW, features: normalizeGameFeatures(roundTrip(f)) };
}
function prestige(game: Game, request = 'p') {
  const result = applyGamePrestige(game, game.features.starXI.ownedIds.find((id) => !STAR_XI_PLAYERS.find((p) => p.id === id)?.isCustom) ?? null, NOW, request);
  assert.equal(result.error, '');
  return { ...result.game, features: normalizeGameFeatures(roundTrip(result.game.features)) } as Game;
}
/** Finishes the running season through the real season code: first place promotes, last place relegates. */
function finishSeason(game: Game, place: 'first' | 'last'): Game {
  const features = roundTrip(game.features);
  const season = features.seasonMode;
  season.matchday = SEASON_MODE_MATCHES_PER_SEASON - 1;
  season.table = season.table.map((row) => ({ ...row, played: SEASON_MODE_MATCHES_PER_SEASON - 1, points: row.id === 'club' ? (place === 'first' ? 99 : 0) : (place === 'first' ? 1 : 50), goalsFor: row.id === 'club' ? (place === 'first' ? 99 : 0) : 10, goalsAgainst: 5 }));
  const result = recordSeasonModeMatch(season, place === 'first' ? 5 : 0, place === 'first' ? 0 : 5, features.club.name, NOW, () => .5);
  features.seasonMode = result.state;
  return { ...game, features: normalizeGameFeatures(roundTrip(features)) };
}

test('+10 percentage points per Prestige, additive, from the saved prestigeCount only', () => {
  const at = (count: number) => { const f = initialGameFeatures(NOW); f.seasonMode.prestigeCount = count; return Number(getPrestigeGoalMultiplier(f).toFixed(4)); };
  assert.deepEqual([0, 1, 2, 3, 5].map(at), [1, 1.1, 1.2, 1.3, 1.5]);
  const after = prestige(hallOfFameGame());
  assert.equal(getPrestigeGoalMultiplier(after.features), 1.1);
  assert.match(after.features.history[0].detail, /\+10 % Tore/);
  // An existing save with three Prestiges reads its count; nothing in it changes by loading.
  const old = hallOfFameGame(3);
  assert.equal(getPrestigeGoalMultiplier(normalizeGameFeatures(roundTrip(old.features))), 1.3);
  assert.equal(normalizeGameFeatures(roundTrip(old.features)).seasonMode.prestigeCount, 3);
});

test('right after the first Prestige the shop is the one of a new game: Liga 15, the same upgrades and packs', () => {
  const before = hallOfFameGame();
  assert.equal(shop(before).league, 1, 'before: everything unlocked');
  const after = prestige(before);
  const fresh = shop(freshGame());
  assert.equal(fresh.league, 15);
  assert.deepEqual(shop(after), fresh);
  assert.ok(fresh.upgrades.length < UPGRADES.length && fresh.packs.length < PACKS.length, 'a new game has locked upgrades and packs');
  // Kept: the best league ever (other unlocks), owned packs, fragments, cards; formations still follow the best league.
  assert.equal(after.features.seasonMode.highestDivision, SEASON_MODE_DIVISION_COUNT);
  assert.equal(getReachedLeague(after.seasons, after.features.seasonMode.highestDivision), 1);
  assert.ok(STAR_FORMATIONS.every((formation) => isLeagueContentUnlocked(getFormationUnlockLeague(formation.id), getReachedLeague(after.seasons, after.features.seasonMode.highestDivision))));
  assert.deepEqual(after.features.earnedPacks.map((pack) => pack.id), ['kept-reward']);
  assert.equal(after.features.starXI.fragments, 12_345);
  assert.ok(after.features.starXI.ownedIds.length > 0);
  assert.equal(after.features.seasonMode.runHighestDivision, 1);
});

test('promotion unlocks again on the same league limits as a new game; a later relegation takes nothing back', () => {
  let run = prestige(hallOfFameGame());
  let fresh = freshGame();
  for (let season = 0; season < 4; season++) {
    run = finishSeason(run, 'first'); fresh = finishSeason({ ...fresh, seasons: fresh.seasons + 1 }, 'first');
    assert.equal(run.features.seasonMode.division, season + 2);
    assert.deepEqual(shop(run).upgrades, shop({ ...fresh, seasons: 14 }).upgrades.filter((id) => isLeagueContentUnlocked(getUpgradeUnlockLeague(id), leagueForTier(season + 2))), `after promotion ${season + 1}`);
    assert.equal(shop(run).league, leagueForTier(season + 2));
  }
  const best = shop(run);
  run = finishSeason(run, 'last');
  assert.equal(run.features.seasonMode.division, 4, 'relegated');
  assert.deepEqual(shop(run), best, 'relegation keeps what this run unlocked');
  // Reload keeps the run value.
  assert.deepEqual(shop({ ...run, features: normalizeGameFeatures(roundTrip(run.features)) }), best);
});

test('a second Prestige locks again; the bonus grows to +20 %', () => {
  let run = prestige(hallOfFameGame());
  run = finishSeason(finishSeason(run, 'first'), 'first');
  assert.equal(shop(run).league, 13);
  const hof = { ...run, features: normalizeGameFeatures({ ...roundTrip(run.features), seasonMode: { ...run.features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, runHighestDivision: SEASON_MODE_DIVISION_COUNT } }) };
  assert.equal(shop(hof).league, 1);
  const second = prestige(hof, 'second');
  assert.equal(second.features.seasonMode.prestigeCount, 2);
  assert.equal(getPrestigeGoalMultiplier(second.features), 1.2);
  assert.deepEqual(shop(second), shop(freshGame()));
});

test('saves: no Prestige stays exactly as before; an old Prestige save proves its run by its league and chronicle', () => {
  // Never prestiged: the shop league is the old getReachedLeague and no new field is written.
  const plain = normalizeGameFeatures({ ...roundTrip(initialGameFeatures(NOW)), seasonMode: { ...initialGameFeatures(NOW).seasonMode, division: 5, highestDivision: 7 } });
  assert.equal(plain.seasonMode.runHighestDivision, undefined);
  assert.equal(getShopReachedLeague(6, plain.seasonMode), getReachedLeague(6, 7));
  // A Prestige save from before the field: current league only ...
  const legacy = roundTrip(initialGameFeatures(NOW)) as unknown as Record<string, Record<string, unknown>>;
  legacy.seasonMode = { ...legacy.seasonMode, prestigeCount: 1, division: 3, highestDivision: 15 };
  delete legacy.seasonMode.runHighestDivision;
  const onlyLeague = normalizeGameFeatures(legacy);
  assert.equal(onlyLeague.seasonMode.runHighestDivision, 3);
  assert.equal(getShopReachedLeague(14, onlyLeague.seasonMode), 13);
  // ... plus finished seasons of this run in the chronicle (a promotion counts one higher); other runs do not count.
  legacy.chronicle = { ...(legacy.chronicle ?? {}), seasons: [
    { id: 'a', season: 1, prestige: 0, division: 15, place: 1, points: 30, wins: 9, draws: 0, losses: 1, goalsFor: 30, goalsAgainst: 5, outcome: 'hall-of-fame', topScorer: null, bestPlayerId: null, at: 1 },
    { id: 'b', season: 2, prestige: 1, division: 4, place: 1, points: 30, wins: 9, draws: 0, losses: 1, goalsFor: 30, goalsAgainst: 5, outcome: 'promoted', topScorer: null, bestPlayerId: null, at: 2 },
    { id: 'c', season: 3, prestige: 1, division: 5, place: 6, points: 3, wins: 1, draws: 0, losses: 9, goalsFor: 5, goalsAgainst: 30, outcome: 'relegated', topScorer: null, bestPlayerId: null, at: 3 },
  ] } as never;
  const proven = normalizeGameFeatures(legacy);
  assert.equal(proven.seasonMode.runHighestDivision, 5);
  assert.equal(normalizeGameFeatures(roundTrip(proven)).seasonMode.runHighestDivision, 5, 'stable on reload');
  // Never above the best league ever, never below the current league.
  assert.equal(normalizeGameFeatures({ ...roundTrip(proven), seasonMode: { ...proven.seasonMode, runHighestDivision: 99 } }).seasonMode.runHighestDivision, 15);
  assert.equal(normalizeGameFeatures({ ...roundTrip(proven), seasonMode: { ...proven.seasonMode, runHighestDivision: 1 } }).seasonMode.runHighestDivision, 3);
  // Minimal or broken state loads as a new game.
  for (const value of [{}, null, { seasonMode: null }, { seasonMode: { prestigeCount: 'x' } }]) {
    const f = normalizeGameFeatures(value);
    assert.equal(getShopReachedLeague(0, f.seasonMode), 15);
  }
});

// Co-op: the server enforces the same shop for every seat.
const SEAT = { host: 'hostPlayerId', guest: 'guestPlayerId', player3: 'player3PlayerId', player4: 'player4PlayerId' } as const;
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  if (conditions.seat && (row[SEAT[conditions.seat.role]] ?? null) !== conditions.seat.playerId) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
const HOST = 'host-player-unlock', GUEST = 'guest-player-unlock', CODE = 'UNLOCK';
function world(game: Game) {
  clearRoomCacheForTests();
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  row = { ...defaults, code: CODE, roomName: 'Unlock', hostPlayerId: HOST, hostName: 'Host', guestPlayerId: GUEST, guestName: 'Gast', hostLastSeenAt: iso, guestLastSeenAt: iso, lastPassiveAt: iso, updatedAt: iso,
    sharedCoins: 1e30, sharedTotalGoals: game.totalGoals, sharedSeasonGoals: game.seasonGoals, sharedSeasons: game.seasons, sharedUpgradesJson: JSON.stringify(game.upgrades), clickStateJson: '{}', sharedFeaturesJson: JSON.stringify({ ...game.features, starXI: { ...game.features.starXI, fragments: 1e9 } }) } as RoomRow;
}
async function post(playerId: string, action: string, extra: Record<string, unknown>) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code: CODE, playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, requestId: `${action}-${Math.random()}`, purchaseId: `p-${Math.random()}`, ...extra }) }));
  return response.status;
}
const topUpgrade = UPGRADES.map((u) => u.id).sort((a, b) => getUpgradeUnlockLeague(a) - getUpgradeUnlockLeague(b))[0];
const topPack = STAR_PACKS.map((p) => p.id).sort((a, b) => getPackUnlockLeague(a) - getPackUnlockLeague(b))[0];
const entryUpgrade = UPGRADES.find((u) => getUpgradeUnlockLeague(u.id) >= 15)!.id;
const topFormation = STAR_FORMATIONS.map((f) => f.id).sort((a, b) => getFormationUnlockLeague(a) - getFormationUnlockLeague(b))[0];

test('co-op: host and guest get the same locks from the server after a Prestige, and the same unlocks after promotion', async () => {
  const after = prestige(hallOfFameGame());
  for (const seat of [HOST, GUEST]) {
    world(after);
    assert.equal(await post(seat, 'buy', { upgradeId: topUpgrade, count: 1 }), 409, `${seat}: top upgrade locked`);
    assert.equal(await post(seat, 'star-pack', { packId: topPack }), 409, `${seat}: top pack locked`);
    assert.equal(await post(seat, 'special-pack', {}), 409, `${seat}: special card pack locked`);
    assert.equal(await post(seat, 'buy', { upgradeId: entryUpgrade, count: 1 }), 200, `${seat}: Liga 15 upgrade open`);
    // Not part of the decision: formations keep the best league ever.
    world(after);
    assert.equal(await post(seat, 'star-formation', { formationId: topFormation }), 200, `${seat}: formation unlock unchanged`);
  }
  // Promoted far enough in this run, the server opens the special card pack (Liga 3 or lower) like the browser does.
  let run = after;
  while (!isLeagueContentUnlocked(getPackUnlockLeague(SPECIAL_CARD_PACK.id), shop(run).league)) run = finishSeason(run, 'first');
  for (const seat of [HOST, GUEST]) { world(run); assert.equal(await post(seat, 'special-pack', {}), 200, `${seat}: unlocked again`); }
  // Before any Prestige nothing changes: a world at Liga 15 cannot buy the top upgrade, a Hall of Fame world can.
  world(freshGame());
  assert.equal(await post(GUEST, 'buy', { upgradeId: topUpgrade, count: 1 }), 409);
  world(hallOfFameGame());
  assert.equal(await post(GUEST, 'buy', { upgradeId: topUpgrade, count: 1 }), 200);
});
