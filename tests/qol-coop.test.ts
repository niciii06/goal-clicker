// Quality of life actions of a shared world (audit section E): fill gaps, best bench, free a place, favourites,
// give up a tournament, and who did what in the history. Every action runs through mutateWorld with an action id.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomSeatRole, RoomUpdate } from '../db/index.ts';
import { STAR_XI_PLAYERS, addHistory, canStarXIPlayerFillSlot, initialGameFeatures, normalizeGameFeatures, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { UPGRADES } from '../app/game/upgrades.ts';
import { installLightRoomMocks } from './helpers/light-room-mock.ts';

const { GoalClickerDatabase } = await import('../db/index.ts');
const { POST, clearRoomCacheForTests } = await import('../app/api/multiplayer/route.ts');

const SEAT_COLUMNS: Record<RoomSeatRole, 'hostPlayerId' | 'guestPlayerId' | 'player3PlayerId' | 'player4PlayerId'> = { host: 'hostPlayerId', guest: 'guestPlayerId', player3: 'player3PlayerId', player4: 'player4PlayerId' };
let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  if (conditions.seat && (row[SEAT_COLUMNS[conditions.seat.role]] ?? null) !== conditions.seat.playerId) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
installLightRoomMocks(GoalClickerDatabase);

const HOST = 'host-player-123', GUEST = 'guest-player-123';
function squad(): GameFeatures {
  const features = initialGameFeatures(1_000_000);
  features.starterSquadGranted = true;
  features.starXI.ownedIds = STAR_XI_PLAYERS.filter((player) => player.rating < 90 && !player.benchOnly && !player.isCustom).slice(0, 60).map((player) => player.id);
  features.starXI = setBestStarXI(features.starXI);
  return normalizeGameFeatures(features);
}
function setup(features: GameFeatures = squad()) {
  clearRoomCacheForTests();
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  row = {
    ...defaults, code: 'QOLQOL', roomName: 'Testwelt', hostPlayerId: HOST, hostName: 'Nicolas', guestPlayerId: GUEST, guestName: 'Silvan',
    hostLastSeenAt: iso, guestLastSeenAt: iso, lastPassiveAt: iso, updatedAt: iso,
    sharedCoins: 5_000_000, sharedTotalGoals: 8_000_000, sharedSeasonGoals: 6_000_000,
    clickStateJson: JSON.stringify({}), sharedFeaturesJson: JSON.stringify(features),
  } as RoomRow;
}
type Answer = { error?: string; duplicate?: boolean; replacements?: string[] };
async function post(action: string, extra: Record<string, unknown> = {}, playerId = HOST) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code: 'QOLQOL', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as Answer };
}
const features = () => normalizeGameFeatures(JSON.parse(row.sharedFeaturesJson));

test('star-fill-gaps replaces an injured starter once, names the member, and a resend is answered from the receipt', async () => {
  const start = squad();
  const slot = start.starXI.lineupIds.findIndex((id, index) => id && start.starXI.benchIds.some((bench) => bench && canStarXIPlayerFillSlot(bench, index, start.starXI.formationPositions)));
  const injured = start.starXI.lineupIds[slot];
  start.cup.injuredPlayerIds = { [injured]: 2 };
  // After a match the kick off lineup still names the injured player (his place itself is already empty).
  start.cup.originalLineupIds = [...start.starXI.lineupIds];
  setup(start);
  const first = await post('star-fill-gaps', { actionId: 'fill-1' }, GUEST);
  assert.equal(first.status, 200, first.data.error);
  assert.ok(first.data.replacements?.[0].includes('(verletzt)'));
  const after = features();
  assert.ok(after.starXI.lineupIds[slot] && after.starXI.lineupIds[slot] !== injured);
  const entry = after.history.at(-1)!;
  assert.equal(entry.title, 'Lücken gefüllt');
  assert.equal(entry.actor, 'Silvan', 'the history names who filled the gaps');
  const version = row.sharedStateVersion;
  const again = await post('star-fill-gaps', { actionId: 'fill-1' }, GUEST);
  assert.equal(again.data.duplicate, true);
  assert.equal(row.sharedStateVersion, version, 'the resend changes nothing');
  assert.equal((await post('star-fill-gaps', { actionId: 'fill-2' }, GUEST)).status, 409, 'without gaps the action is refused');
});

test('star-best-bench keeps the eleven and fills the bench', async () => {
  const start = squad();
  start.starXI.benchIds = start.starXI.benchIds.map(() => '');
  setup(start);
  const answer = await post('star-best-bench', { actionId: 'bench-1' });
  assert.equal(answer.status, 200, answer.data.error);
  const after = features();
  assert.deepEqual(after.starXI.lineupIds, start.starXI.lineupIds);
  assert.ok(after.starXI.benchIds.filter(Boolean).length > 0);
});

test('star-unassign frees a place: to the reserve, or onto an empty bench place', async () => {
  const start = squad();
  const benchSlot = 0;
  start.starXI.benchIds[benchSlot] = '';
  setup(start);
  const starter = start.starXI.lineupIds[4];
  assert.equal((await post('star-unassign', { actionId: 'u-1', starPlayerId: starter, benchIndex: benchSlot })).status, 200);
  let after = features();
  assert.equal(after.starXI.benchIds[benchSlot], starter);
  assert.equal(after.starXI.lineupIds[4], '');
  assert.equal((await post('star-unassign', { actionId: 'u-2', starPlayerId: starter })).status, 200);
  after = features();
  assert.ok(!after.starXI.benchIds.includes(starter) && !after.starXI.lineupIds.includes(starter));
  assert.equal((await post('star-unassign', { actionId: 'u-3', starPlayerId: starter })).status, 409, 'a reserve player has no place to leave');
});

test('upgrade purchases are in the history with the buyer; quick buys of one member share an entry', async () => {
  setup();
  const upgrade = UPGRADES.find((item) => item.kind === 'auto')!;
  assert.equal((await post('buy', { actionId: 'b-1', upgradeId: upgrade.id, count: 1 }, GUEST)).status, 200);
  assert.equal((await post('buy', { actionId: 'b-2', upgradeId: upgrade.id, count: 1 }, GUEST)).status, 200);
  const entries = features().history.filter((entry) => entry.kind === 'upgrade');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].actor, 'Silvan');
  assert.match(entries[0].detail, /Level 2/);
  assert.equal((await post('buy', { actionId: 'b-3', upgradeId: upgrade.id, count: 1 }, HOST)).status, 200);
  assert.equal(features().history.filter((entry) => entry.kind === 'upgrade').length, 2, 'another member gets an own entry');
});

test('history: squad changes of one player within ten minutes share one entry; old saves load unchanged', () => {
  const start = initialGameFeatures();
  addHistory(start, { title: 'Formation angepasst', detail: 'A', tone: 'neutral', kind: 'squad' }, 1000);
  addHistory(start, { title: 'Beste Startelf aufgestellt', detail: 'B', tone: 'positive', kind: 'squad' }, 2000);
  addHistory(start, { title: 'Saisonspiel', detail: 'C', tone: 'positive' }, 3000);
  addHistory(start, { title: 'Formation angepasst', detail: 'D', tone: 'neutral', kind: 'squad' }, 4000);
  assert.deepEqual(start.history.map((entry) => entry.detail), ['B', 'C', 'D']);
  const legacy = normalizeGameFeatures({ ...JSON.parse(JSON.stringify(start)), history: [{ id: 'x', title: 'Alt', detail: 'd', tone: 'neutral', timestamp: 5 }] });
  assert.deepEqual(legacy.history, [{ id: 'x', title: 'Alt', detail: 'd', tone: 'neutral', timestamp: 5 }]);
});
