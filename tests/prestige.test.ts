// Prestige (3 November 2026): own eligibility, special cards plus one chosen normal card stay, the album keeps every
// card, goals go to 0, +20 percentage points goal income per Prestige, safe in solo and co-op.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';
import {
  STAR_PACKS, STAR_XI_CUSTOM_PLAYERS, beginSeasonCupMatch, getStarXISelection, STAR_XI_PLAYERS, SEASON_MODE_DIVISION_COUNT, applySeasonPrestige, getPrestigeBlockReason, getPrestigeGoalMultiplier,
  getPrestigeKeepCandidates, getStarXIPlayer, initialGameFeatures, maybeGrantStarterSquad, normalizeGameFeatures, setBestStarXI, STARTER_SQUAD_UNLOCK_CLICKS,
} from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { getBaseClickPower, getBasePassivePower, getClickPower, getPassiveIncomePower, getPassivePower } from '../app/game/economy.ts';
import { advanceLocalGameWhileOpen } from '../app/game/storage.ts';
import { getPackUnlockLeague, getReachedLeague, isLeagueContentUnlocked } from '../app/season-progression.ts';

const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST, clearRoomCacheForTests } = await import('../app/api/multiplayer/route.ts');

const SPECIALS = ['star-goat-nicu', 'star-maetthu', 'star-pfuschi', 'star-champ-simu'];
const NORMALS = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.retired && !player.id.startsWith('scrap-')).slice(0, 24).map((player) => player.id);

/** A Hall of Fame club with a full squad of specials and normal cards, as a player has it before Prestige. */
function hallOfFame(prestigeCount = 0): GameFeatures {
  const features = initialGameFeatures(1_000_000);
  features.starterSquadGranted = true;
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: [...SPECIALS, ...NORMALS] }, []);
  features.career.collectedIds = ['star-di-santo'];
  features.seasonMode = { ...features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount };
  return normalizeGameFeatures(features);
}
/** The same club during a real, running league match. */
function playingHallOfFame() {
  const features = hallOfFame();
  features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, Date.now(), getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds), features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
  assert.equal(normalizeGameFeatures(JSON.parse(JSON.stringify(features))).cup.active, true);
  return features;
}
const keepFirst = (features: GameFeatures) => getPrestigeKeepCandidates(features)[0].id;

test('an incomplete lineup, an open squad slot or a suspended player never block Prestige; running operations do and say why', () => {
  const incomplete = hallOfFame();
  incomplete.starXI.lineupIds[3] = '';
  incomplete.starXI.benchIds = incomplete.starXI.benchIds.map(() => '');
  incomplete.cup.suspendedPlayerIds = [incomplete.starXI.lineupIds[5]];
  incomplete.transferSaga.vacancies = [{ area: 'lineup', index: 3, requiredPlayers: 18, createdAt: 1 }];
  assert.equal(getPrestigeBlockReason(incomplete), '');
  assert.equal(applySeasonPrestige(incomplete, keepFirst(incomplete), 5000).error, '');

  assert.match(getPrestigeBlockReason({ ...hallOfFame(), seasonMode: { ...hallOfFame().seasonMode, hallOfFame: false } }), /Hall of Fame/);
  const playing = playingHallOfFame();
  assert.match(getPrestigeBlockReason(playing), /laufende Partie/);
  const tournament = hallOfFame(); tournament.cup = { ...tournament.cup, pendingNextRound: true };
  assert.match(getPrestigeBlockReason(tournament), /Turnier/);
  // The last pack reveal stays saved for good; it is not a running operation.
  const reveal = hallOfFame(); reveal.starPackReveal = { packId: 'scout', packName: 'Scout', player: getStarXIPlayer(NORMALS[0])!, duplicate: false, fragmentCompensation: 0, openedAt: 1 } as GameFeatures['starPackReveal'];
  assert.equal(getPrestigeBlockReason(reveal), '');
  const travelling = hallOfFame(); travelling.travel = { ...travelling.travel, journey: { consumed: false } as GameFeatures['travel']['journey'] };
  assert.match(getPrestigeBlockReason(travelling), /Auswärtsreise/);
  // A blocked Prestige changes nothing.
  const before = JSON.stringify(playing);
  assert.ok(applySeasonPrestige(playing, keepFirst(playing), 5000).error);
  assert.equal(JSON.stringify(playing), before);
});

test('every special card and the one chosen normal card stay; the rest leaves the squad but stays in the album', () => {
  const features = hallOfFame();
  const keep = NORMALS[7];
  const { features: next, error } = applySeasonPrestige(features, keep, 5000);
  assert.equal(error, '');
  assert.deepEqual([...next.starXI.ownedIds].sort(), [...SPECIALS, keep].sort());
  // Starting XI and bench point only at retained cards.
  for (const id of [...next.starXI.lineupIds, ...next.starXI.benchIds].filter(Boolean)) assert.ok(next.starXI.ownedIds.includes(id), id);
  // The album keeps every card ever collected, including the ones that left and older entries.
  for (const id of [...SPECIALS, ...NORMALS, 'star-di-santo']) assert.ok(next.career.collectedIds.includes(id), id);
  assert.equal(next.seasonMode.prestigeCount, 1);
  assert.equal(next.seasonMode.division, 1);
  assert.equal(next.seasonMode.matchday, 0);
  assert.equal(next.seasonMode.hallOfFame, false);
  assert.equal(next.seasonMode.highestDivision, SEASON_MODE_DIVISION_COUNT, 'earned unlocks stay');
  assert.deepEqual(next.transferSaga.vacancies, []);
  // The input object is not modified.
  assert.equal(features.starXI.ownedIds.length, SPECIALS.length + NORMALS.length);
});

test('invalid selections are rejected without changes; with no normal card the specials alone continue', () => {
  const features = hallOfFame();
  const before = JSON.stringify(features);
  assert.match(applySeasonPrestige(features, null, 5000).error, /Wähle/);
  assert.match(applySeasonPrestige(features, 'star-goat-nicu', 5000).error, /nicht in deinem Kader/, 'a special card is not the normal pick');
  const notOwned = STAR_XI_PLAYERS.find((player) => !player.isCustom && !features.starXI.ownedIds.includes(player.id))!.id;
  assert.match(applySeasonPrestige(features, notOwned, 5000).error, /nicht in deinem Kader/);
  assert.match(applySeasonPrestige(features, 'no-such-card', 5000).error, /nicht in deinem Kader/);
  assert.equal(JSON.stringify(features), before);

  const onlySpecials = hallOfFame();
  onlySpecials.starXI = setBestStarXI({ ...onlySpecials.starXI, ownedIds: [...SPECIALS] }, []);
  assert.equal(getPrestigeKeepCandidates(onlySpecials).length, 0);
  const result = applySeasonPrestige(onlySpecials, null, 5000);
  assert.equal(result.error, '');
  assert.deepEqual([...result.features.starXI.ownedIds].sort(), [...SPECIALS].sort());
});

test('the same request counts once; a kept normal card can be kept again; reload keeps everything', () => {
  const first = applySeasonPrestige(hallOfFame(), NORMALS[2], 5000, 'request-a');
  const retry = applySeasonPrestige(first.features, NORMALS[2], 6000, 'request-a');
  assert.equal(retry.duplicate, true);
  assert.equal(retry.features.seasonMode.prestigeCount, 1);
  // Back in the Hall of Fame later: the kept card is offered again.
  const again = normalizeGameFeatures(JSON.parse(JSON.stringify(first.features)));
  again.seasonMode = { ...again.seasonMode, hallOfFame: true, division: SEASON_MODE_DIVISION_COUNT };
  assert.deepEqual(getPrestigeKeepCandidates(again).map((player) => player.id), [NORMALS[2]]);
  const second = applySeasonPrestige(again, NORMALS[2], 7000, 'request-b');
  assert.equal(second.features.seasonMode.prestigeCount, 2);
  const reloaded = normalizeGameFeatures(JSON.parse(JSON.stringify(second.features)));
  assert.deepEqual(reloaded.starXI.ownedIds, second.features.starXI.ownedIds);
  assert.deepEqual(reloaded.career.collectedIds, second.features.career.collectedIds);
  assert.equal(reloaded.seasonMode.prestigeCount, 2);
});

test('the starter squad does not come back and Season 1 can be rebuilt with packs', () => {
  const { features } = applySeasonPrestige(hallOfFame(), NORMALS[0], 5000);
  assert.equal(maybeGrantStarterSquad(features, STARTER_SQUAD_UNLOCK_CLICKS * 10, 6000), null);
  // Even an old save that never got the starter squad does not get one after Prestige.
  const old = hallOfFame(); old.starterSquadGranted = false;
  const afterOld = applySeasonPrestige(old, NORMALS[0], 5000).features;
  assert.equal(maybeGrantStarterSquad(afterOld, STARTER_SQUAD_UNLOCK_CLICKS * 10, 6000), null);
  assert.equal(afterOld.starXI.ownedIds.length, SPECIALS.length + 1);
  // Packs stay unlocked by the highest league reached and cost goals that clicks and passive income earn again.
  const reached = getReachedLeague(0, features.seasonMode.highestDivision);
  const available = STAR_PACKS.filter((pack) => isLeagueContentUnlocked(getPackUnlockLeague(pack.id), reached));
  assert.ok(available.length >= 3, 'packs stay open after Prestige');
  assert.ok(available.some((pack) => pack.price <= 15_000), 'the scrap pack (15 000 goals) is always there');
  assert.ok(getClickPower({}, 0, features, 0) > 0, 'clicks earn goals from 0');
});

test('the goal income bonus is additive: +20 %, +40 %, +60 % on clicks and passive goals, not on base rewards', () => {
  const upgrades = { ballboy: 5, boots: 3 } as Record<string, number>;
  const withCount = (count: number) => ({ ...hallOfFame(count) });
  assert.deepEqual([0, 1, 2, 3].map((count) => getPrestigeGoalMultiplier(withCount(count)).toFixed(2)), ['1.00', '1.20', '1.40', '1.60']);
  const base = withCount(0), third = withCount(3);
  const ratio = (a: number, b: number) => Number((a / b).toFixed(6));
  assert.ok(getBasePassivePower(upgrades, 0, base) > 0);
  {
    assert.equal(ratio(getPassivePower(upgrades, 0, third, 0), getPassivePower(upgrades, 0, base, 0)), 1.6);
    assert.equal(ratio(getPassiveIncomePower(upgrades, 0, third), getBasePassivePower(upgrades, 0, third)), 1.6);
  }
  assert.equal(ratio(getClickPower(upgrades, 0, third, 0), getClickPower(upgrades, 0, base, 0)), 1.6);
  // Tickets, daily and press rewards read the Base values: unchanged by Prestige.
  assert.equal(getBaseClickPower(upgrades, 0, third), getBaseClickPower(upgrades, 0, base));
  assert.equal(getBasePassivePower(upgrades, 0, third), getBasePassivePower(upgrades, 0, base));
  // Passive goals while the tab stays open in the background carry the bonus as well.
  const passiveUpgrades = { ballboy: 10 } as Record<string, number>;
  const state = (features: GameFeatures) => ({ goals: 0, seasonGoals: 0, totalGoals: 0, upgrades: passiveUpgrades, stars: 0, features, lastSaved: 0 }) as unknown as Parameters<typeof advanceLocalGameWhileOpen>[0];
  const plain = advanceLocalGameWhileOpen(state(base), 60_000, 60_000).goals, boosted = advanceLocalGameWhileOpen(state(withCount(2)), 60_000, 60_000).goals;
  assert.ok(plain > 0);
  assert.equal(ratio(boosted, plain), 1.4);
});

test('Pfuschi, GOAT Nicu, Champ Simu, Flurin and Mätthu are Swiss, also for collected copies', () => {
  for (const id of ['star-pfuschi', 'star-goat-nicu', 'star-champ-simu', 'star-flurin-fabrice', 'star-maetthu']) assert.equal(getStarXIPlayer(id)?.countryCode, 'CH', id);
  // A save stores only ids; the card data comes from the catalogue.
  const saved = normalizeGameFeatures(JSON.parse(JSON.stringify(hallOfFame())));
  assert.ok(saved.starXI.ownedIds.map((id) => getStarXIPlayer(id)!).filter((player) => SPECIALS.includes(player.id)).every((player) => player.countryCode === 'CH'));
  assert.equal(STAR_XI_CUSTOM_PLAYERS.filter((player) => player.countryCode === 'CH').length, 8);
});

// Co-op: the server checks the stored world, the chosen card and the request id.
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
function setup(features: GameFeatures, goals = 5_000_000) {
  clearRoomCacheForTests();
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  row = { ...defaults, code: 'PRESTI', hostPlayerId: 'host-player-123', hostName: 'Nicolas', guestPlayerId: 'guest-player-123', guestName: 'Silvan', hostLastSeenAt: iso, guestLastSeenAt: iso, lastPassiveAt: iso, updatedAt: iso, sharedCoins: goals, sharedFeaturesJson: JSON.stringify(features) } as RoomRow;
}
async function prestige(extra: Record<string, unknown>, playerId = 'host-player-123') {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'season-prestige', code: 'PRESTI', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as { error?: string } };
}
const stored = () => normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));

test('co-op Prestige resets season, squad and goals together and counts a retried request once', async () => {
  setup(hallOfFame());
  const request = { requestId: 'coop-1', keepNormalId: NORMALS[4], expectedPrestigeCount: 0 };
  assert.equal((await prestige(request)).status, 200);
  assert.equal(stored().seasonMode.prestigeCount, 1);
  assert.equal(row.sharedCoins, 0);
  assert.deepEqual([...stored().starXI.ownedIds].sort(), [...SPECIALS, NORMALS[4]].sort());
  for (const id of NORMALS) assert.ok(stored().career.collectedIds.includes(id));
  // The retry (lost response) and a second click from the other seat change nothing.
  assert.equal((await prestige(request)).status, 200);
  assert.equal((await prestige(request, 'guest-player-123')).status, 200);
  assert.equal(stored().seasonMode.prestigeCount, 1);
  // A new request from an outdated screen does not start a second Prestige.
  const stale = await prestige({ requestId: 'coop-2', keepNormalId: NORMALS[4], expectedPrestigeCount: 0 });
  assert.equal(stale.status, 409);
  assert.equal(stored().seasonMode.prestigeCount, 1);
});

test('co-op rejects Prestige before the Hall of Fame, with a card from outside the squad, during a match, and leaves the world untouched', async () => {
  const cases: [GameFeatures, string | null, RegExp][] = [
    [{ ...hallOfFame(), seasonMode: { ...hallOfFame().seasonMode, hallOfFame: false } }, NORMALS[0], /Hall of Fame/],
    [hallOfFame(), STAR_XI_PLAYERS.find((player) => !player.isCustom && !NORMALS.includes(player.id))!.id, /nicht in deinem Kader/],
    [hallOfFame(), null, /Wähle/],
    [playingHallOfFame(), NORMALS[0], /laufende Partie/],
  ];
  for (const [features, keepNormalId, message] of cases) {
    setup(features);
    const before = stored(), coins = row.sharedCoins;
    const result = await prestige({ requestId: `bad-${String(message)}`, keepNormalId, expectedPrestigeCount: 0 });
    assert.equal(result.status, 409);
    assert.match(result.data.error ?? '', message);
    // Nothing of the reset happened (a running match may still save its own ticks).
    assert.equal(stored().seasonMode.prestigeCount, before.seasonMode.prestigeCount);
    assert.deepEqual(stored().seasonMode.hallOfFame, before.seasonMode.hallOfFame);
    assert.deepEqual(stored().starXI.ownedIds, before.starXI.ownedIds);
    assert.equal(row.sharedCoins, coins);
  }
  // Without a request id (an old client) nothing happens either.
  setup(hallOfFame());
  assert.equal((await prestige({ keepNormalId: NORMALS[0], expectedPrestigeCount: 0 })).status, 409);
  assert.equal(stored().seasonMode.prestigeCount, 0);
});
