// Every byte Postgres sends counts against the Supabase quota. Polls of a world must not read its big
// features (several hundred KB) when nothing changed, and must never read the backup copy.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { initialGameFeatures } from '../app/feature-data.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { featureReads, installLightRoomMocks, lightRow } from './helpers/light-room-mock.ts';
const { GoalClickerDatabase } = await import('../db/index.ts');
const { GET, POST, clearRoomCacheForTests } = await import('../app/api/multiplayer/route.ts');

let row: RoomRow;
GoalClickerDatabase.prototype.getRoom = async (code) => code === row.code ? structuredClone(row) : null;
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  row = { ...row, ...values }; return structuredClone(row);
};
GoalClickerDatabase.prototype.listRoomsForPlayer = async (playerId) => [row].filter((r) => r.hostPlayerId === playerId).map((r) => { const { sharedFeaturesJson: _f, sharedStateBackupJson: _b, ...light } = r; void _f; void _b; return { ...light, featuresKey: 'x' }; });
GoalClickerDatabase.prototype.applyClick = async (code, role, amount) => { void role; row = { ...row, sharedCoins: row.sharedCoins + amount, sharedTotalGoals: row.sharedTotalGoals + amount, sharedStateVersion: row.sharedStateVersion + 1 }; return structuredClone(row) as never; };
installLightRoomMocks(GoalClickerDatabase);

function setup(lastPassiveAt = new Date().toISOString()) {
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([k, c]) => [k, c.default ?? null]));
  row = { ...defaults, code: 'EGRESS', hostPlayerId: 'host-player-123', hostName: 'Nicolas', guestPlayerId: 'guest-player-123', guestName: 'Silvan', hostLastSeenAt: iso, guestLastSeenAt: iso, lastPassiveAt, updatedAt: iso, sharedFeaturesJson: JSON.stringify(initialGameFeatures(Date.now())) } as RoomRow;
  clearRoomCacheForTests();
  featureReads.count = 0;
}
type Room = { featuresKey: string; featuresOmitted: boolean; sharedCoins: number; game: { features?: unknown } };
const post = async (action: string, extra: Record<string, unknown> = {}, playerId = 'host-player-123') => {
  const r = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code: 'EGRESS', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: r.status, room: (await r.json() as { room: Room }).room };
};
const get = async (featuresKey: string) => {
  const r = await GET(new Request(`http://localhost/api/multiplayer?code=EGRESS&playerId=guest-player-123&featuresKey=${featuresKey}&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));
  return { status: r.status, room: (await r.json() as { room: Room }).room };
};

test('a tick from a client that has the current features gets counters and seats, not the features', async () => {
  setup();
  const first = await post('tick');
  assert.equal(first.room.featuresOmitted, false, 'a client without a key gets everything');
  assert.ok(first.room.game.features);
  featureReads.count = 0;
  for (let i = 0; i < 10; i++) {
    const again = await post('tick', { featuresKey: first.room.featuresKey });
    assert.equal(again.status, 200);
    assert.equal(again.room.featuresOmitted, true);
    assert.equal(again.room.game.features, undefined);
    assert.equal(again.room.featuresKey, first.room.featuresKey);
  }
  assert.equal(featureReads.count, 0, 'ten polls read no features');
});

test('clicks return counters only; a changed game or due passive income sends the features again', async () => {
  setup();
  const { room } = await post('tick');
  const click = await post('click', { amount: 5, clickCount: 1 });
  assert.equal(click.room.featuresOmitted, true);
  assert.ok(click.room.sharedCoins > room.sharedCoins, 'the counters still arrive');
  // Another player changes the shared game: the stale key gets the full room.
  const features = JSON.parse(row.sharedFeaturesJson); features.club.name = 'FC Neu'; row.sharedFeaturesJson = JSON.stringify(features);
  const changed = await post('tick', { featuresKey: room.featuresKey });
  assert.equal(changed.room.featuresOmitted, false);
  assert.notEqual(changed.room.featuresKey, room.featuresKey);
  // The waiting room GET: same key and no passive income due is slim too.
  const slim = await get(changed.room.featuresKey);
  assert.equal(slim.room.featuresOmitted, true);
});

test('passive income is still saved by the leading player, just not on every poll', async () => {
  setup(new Date(Date.now() - 60_000).toISOString());
  const before = row.lastPassiveAt;
  const due = await post('tick', { featuresKey: lightRow(row).featuresKey });
  assert.notEqual(row.lastPassiveAt, before, 'income older than the interval is saved');
  const saved = row.lastPassiveAt;
  await post('tick', { featuresKey: due.room.featuresKey });
  assert.equal(row.lastPassiveAt, saved, 'not again a moment later');
});

test('the world list and the server cache never read the backup copy', async () => {
  setup();
  row.sharedStateBackupJson = JSON.stringify({ huge: 'x'.repeat(1000) });
  const r = await GET(new Request(`http://localhost/api/multiplayer?list=1&playerId=host-player-123&protocol=${MULTIPLAYER_PROTOCOL_VERSION}`));
  const { rooms } = await r.json() as { rooms: Room[] };
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].featuresOmitted, true, 'the list shows no game');
  assert.equal(rooms[0].game.features, undefined);
  assert.equal(featureReads.count, 0);
});

test('the leading player booking income every few seconds gets no features while they stay the same', async () => {
  setup(new Date(Date.now() - 60_000).toISOString());
  const { room } = await post('tick');
  for (let i = 0; i < 5; i++) {
    row.lastPassiveAt = new Date(Date.now() - 60_000).toISOString();
    const booked = await post('tick', { featuresKey: room.featuresKey });
    assert.equal(booked.room.featuresOmitted, true);
    assert.equal(booked.room.featuresKey, room.featuresKey);
  }
  // A full poll of the waiting room with the current key is slim as well.
  row.lastPassiveAt = new Date(Date.now() - 60_000).toISOString();
  const polled = await get(room.featuresKey);
  assert.equal(polled.room.featuresOmitted, true);
});
