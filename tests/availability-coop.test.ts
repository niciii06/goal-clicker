// Co-op and client call sites for player availability and transfer offers (audit L07, L13, B38, Gelbsperren banner).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import { beginSeasonCupMatch, initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_XI_PLAYERS, TRANSFER_OFFER_DURATION_MS } from '../app/feature-data.ts';
import type { GameFeatures, TransferOffer } from '../app/feature-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';

type TestResponse = { room: { game: { features: GameFeatures } }; error?: string };
const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST } = await import('../app/api/multiplayer/route.ts');
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code || conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion || conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values };
  return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);
function setup(features: GameFeatures) {
  const now = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, col]) => [key, col.default ?? null]));
  row = { ...defaults, code: 'AVAIL', hostPlayerId: 'host-player-123', hostName: 'Nicolas', guestPlayerId: 'guest-player-123', guestName: 'Silvan', hostLastSeenAt: now, guestLastSeenAt: now, lastPassiveAt: now, updatedAt: now, sharedFeaturesJson: JSON.stringify(features) } as RoomRow;
}
async function action(name: string, extra: Record<string, unknown> = {}) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: name, code: 'AVAIL', playerId: 'host-player-123', protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as TestResponse };
}
function squadWithReserve() {
  let features = initialGameFeatures();
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => !p.benchOnly).slice(0, 40).map((p) => p.id) });
  features = normalizeGameFeatures(features);
  const reserve = features.starXI.ownedIds.find((id) => !features.starXI.lineupIds.includes(id) && !features.starXI.benchIds.includes(id))!;
  return { features, reserve };
}
const ban = (playerId: string) => ({ id: `ban-${playerId}`, playerId, competition: 'league', matches: 1, yellowCards: 3, createdAt: 1 }) as GameFeatures['discipline']['bans'][number];

test('L13: co-op refuses a yellow-banned reserve player for the bench and the eleven', async () => {
  const { features, reserve } = squadWithReserve();
  features.discipline.bans = [ban(reserve)];
  setup(features);
  const bench = await action('star-bench', { benchIndex: 0, starPlayerId: reserve });
  assert.equal(bench.status, 409);
  assert.match(bench.data.error ?? '', /Gelben Karten/);
  const slot = features.starXI.formationPositions.findIndex((position) => STAR_XI_PLAYERS.find((p) => p.id === reserve)?.positions?.includes(position) || STAR_XI_PLAYERS.find((p) => p.id === reserve)?.position === position);
  const lineup = await action('star-lineup', { lineupIndex: Math.max(0, slot), starPlayerId: reserve });
  assert.equal(lineup.status, 409);
  assert.match(lineup.data.error ?? "", /Gelben Karten/);
  assert.ok(!JSON.parse(row.sharedFeaturesJson).starXI.benchIds.includes(reserve));
  // Without the ban the same move goes through.
  features.discipline.bans = [];
  setup(features);
  assert.equal((await action('star-bench', { benchIndex: 0, starPlayerId: reserve })).status, 200);
});

test('B38: in co-op an offer due during a home match is kept and saved with its time left', async () => {
  const { features } = squadWithReserve();
  const playerId = features.starXI.lineupIds.find(Boolean)!;
  const now = Date.now();
  const createdAt = now - TRANSFER_OFFER_DURATION_MS - 1000;
  const offer: TransferOffer = { id: 'offer-coop', outcome: 'offer', playerId, playerName: 'Test', club: 'Testclub', headline: 'Angebot', message: '', reason: '', fee: 500, createdAt, expiresAt: createdAt + TRANSFER_OFFER_DURATION_MS };
  features.transferSaga.pendingOffer = offer;
  features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, createdAt + 60_000);
  setup(features);
  const result = await action('transfer-insider-event');
  assert.equal(result.status, 200);
  const saved = JSON.parse(row.sharedFeaturesJson) as GameFeatures;
  assert.ok(saved.transferSaga.pendingOffer, 'the offer is still open');
  assert.ok(saved.transferSaga.pendingOffer!.expiresAt > now);
  assert.ok(!saved.transferSaga.unhappy.some((entry) => entry.playerId === playerId), 'no penalty for the player');
  assert.equal((await action('transfer-decline')).status, 409, 'keeping is blocked during the match like selling');
});

test('client call sites: drag checks yellow bans, pack reveal waits for the update, banner lists owned cards', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const drop = page.slice(page.indexOf('function canDropSquadPlayer'), page.indexOf('async function dropSquadPlayer'));
  assert.match(drop, /source\.area === "reserve" && getBannedPlayerIds\(/);
  const buy = page.slice(page.indexOf('const opening = openStarPack(pack.id, latestGame'), page.indexOf('async function buySpecialCardPack'));
  assert.match(buy, /settle\(false\); return current;/);
  assert.ok(buy.indexOf('presentStarReveal(reveal)') < buy.indexOf('setGame('), 'the reveal is only scheduled from the updater');
  assert.match(page, /ownedDisciplineBans = displayGame\.features\.discipline\.bans\.filter\(\(ban\) => displayGame\.features\.starXI\.ownedIds\.includes\(ban\.playerId\)\)/);
  assert.match(page, /if \(result\.event \|\| result\.deferred\) setGame/);
});
