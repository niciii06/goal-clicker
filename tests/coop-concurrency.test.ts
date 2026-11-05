// Shared world writes under concurrency: every action is applied exactly once, conflicts with click batches are
// retried on the server, resends after a lost answer are answered from a receipt, and writes stay slim (one world
// write per action, counters only when the features did not change, slim answers for clients that have them).
import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { coopRooms } from '../db/schema.ts';
import type { RoomRow, RoomUpdate } from '../db/index.ts';
import { initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_PACKS, STAR_XI_PLAYERS } from '../app/feature-data.ts';
import { getCost } from '../app/game/economy.ts';
import { getUpgrade } from '../app/game/upgrades.ts';
import { MULTIPLAYER_PROTOCOL_VERSION } from '../app/multiplayer-protocol.ts';
import { coopRetryDelay, coopUpdateReloadDue, COOP_UPDATE_RELOAD_GRACE_MS } from '../app/game/coop.ts';
import { NETWORK_RETRY_UNSAFE_COOP_ACTIONS } from '../app/game/constants.ts';
import { refuseUnsafePost } from '../app/api/request-body.ts';
import { installLightRoomMocks, lightRow } from './helpers/light-room-mock.ts';

const { GoalClickerDatabase } = await import('../db/index.ts');
// The real light read, before the tests replace it with the memory mock.
const realGetLightRoom = GoalClickerDatabase.prototype.getLightRoom;
const { POST, clearRoomCacheForTests, describeError, onlyClicksMoved, presenceWriteDue } = await import('../app/api/multiplayer/route.ts');

let row: RoomRow;
const writes = { world: 0, features: 0, touches: 0 };
// Every database call yields once, so concurrent requests really interleave between read and write.
const turn = () => new Promise((resolve) => setImmediate(resolve));
GoalClickerDatabase.prototype.getRoom = async (code) => { await turn(); return code === row.code ? structuredClone(row) : null; };
GoalClickerDatabase.prototype.updateRoom = async (code, values: RoomUpdate, conditions = {}) => {
  await turn();
  if (code !== row.code) return null;
  if (conditions.sharedStateVersion !== undefined && conditions.sharedStateVersion !== row.sharedStateVersion) return null;
  if (conditions.lastPassiveAt !== undefined && conditions.lastPassiveAt !== row.lastPassiveAt) return null;
  if (values.sharedStateVersion !== undefined) writes.world++;
  else writes.touches++;
  if (values.sharedFeaturesJson !== undefined) writes.features++;
  row = { ...row, ...values };
  return structuredClone(row);
};
// Like the SQL: adds the amount, bumps the version and books only on the click state it was computed from.
GoalClickerDatabase.prototype.applyClick = async (code, role, amount, clickCount, _timestamp, previous = null, next = null, presence = {}) => {
  await turn();
  if (code !== row.code) return null;
  const states = JSON.parse(row.clickStateJson || '{}') as Record<string, unknown>;
  if (next && JSON.stringify(states[role] ?? null) !== JSON.stringify(previous)) return null;
  const goals = `${role}Goals` as 'hostGoals', clicks = `${role}Clicks` as 'hostClicks';
  row = { ...row, ...presence, sharedCoins: row.sharedCoins + amount, sharedTotalGoals: row.sharedTotalGoals + amount, sharedSeasonGoals: row.sharedSeasonGoals + amount, sharedStateVersion: row.sharedStateVersion + 1, [goals]: row[goals] + amount, [clicks]: row[clicks] + clickCount, clickStateJson: next ? JSON.stringify({ ...states, [role]: next }) : row.clickStateJson };
  return structuredClone(row) as never;
};
installLightRoomMocks(GoalClickerDatabase);

const HOST = 'host-player-123', GUEST = 'guest-player-123';
function setup(features = initialGameFeatures(), extra: Partial<RoomRow> = {}) {
  const iso = new Date().toISOString();
  const defaults = Object.fromEntries(Object.entries(getTableColumns(coopRooms)).map(([key, column]) => [key, column.default ?? null]));
  // Stored as the server stores it (normalised), so an unchanged game really serialises to the same text.
  row = { ...defaults, code: 'CONCUR', hostPlayerId: HOST, hostName: 'Nicolas', guestPlayerId: GUEST, guestName: 'Silvan', hostLastSeenAt: iso, guestLastSeenAt: iso, lastPassiveAt: iso, updatedAt: iso, sharedCoins: 1_000_000, sharedTotalGoals: 1_000_000, sharedSeasonGoals: 1_000_000, sharedFeaturesJson: JSON.stringify(normalizeGameFeatures(features)), ...extra } as RoomRow;
  clearRoomCacheForTests();
  writes.world = 0; writes.features = 0; writes.touches = 0;
}
type Room = { featuresKey: string; featuresOmitted: boolean; sharedCoins: number; revision: number; game: { upgrades: Record<string, number>; features?: unknown } };
type Answer = { room?: Room; error?: string; errorCode?: string; duplicate?: boolean; clicks?: { amount: number }; dailyReward?: { amount: number }; packReveal?: { openedAt: number; player: { id: string } } };
async function post(action: string, extra: Record<string, unknown> = {}, playerId = HOST, headers: Record<string, string> = {}) {
  const response = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ action, code: 'CONCUR', playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }) }));
  return { status: response.status, data: await response.json() as Answer };
}

test('a purchase racing many click batches is charged exactly once and no click is lost', async (t) => {
  const clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  setup();
  const upgrade = getUpgrade('boots')!;
  const other = getUpgrade('ballboy')!;
  const costs = getCost(upgrade, {}) + getCost(other, {});
  const before = row.sharedCoins;
  const clickers = Array.from({ length: 12 }, (_, i) => post('click', { clickCount: 1 }, i % 2 ? GUEST : HOST));
  const results = await Promise.all([post('buy', { upgradeId: 'boots', count: 1, actionId: 'buy-1' }), ...clickers, post('buy', { upgradeId: 'ballboy', count: 1, actionId: 'buy-2' }, GUEST)]);
  const [buy, ...rest] = results;
  const buyOther = rest.pop()!;
  assert.equal(buy.status, 200, JSON.stringify(buy.data.error));
  assert.equal(buyOther.status, 200, JSON.stringify(buyOther.data.error));
  const clicked = rest.filter((r) => r.status === 200).reduce((sum, r) => sum + (r.data.clicks?.amount ?? 0), 0);
  assert.ok(clicked > 0);
  const upgrades = JSON.parse(row.sharedUpgradesJson) as Record<string, number>;
  assert.equal(upgrades.boots, 1, 'bought once');
  assert.equal(upgrades.ballboy, 1, 'the other purchase is not lost');
  // The clock stands still, so passive income is at most the millisecond each world write moves lastPassiveAt on.
  assert.ok(Math.abs(row.sharedCoins - (before + clicked - costs)) < 0.01, `${row.sharedCoins} vs ${before + clicked - costs}`);
  assert.equal(row.hostGoals + row.guestGoals, clicked);
});

test('a conflict with a real world write recomputes the action instead of overwriting it', async () => {
  setup();
  // Two players claim the same daily reward at once: exactly one gets it, the other is told it is taken.
  const [a, b] = await Promise.all([post('daily-claim', { actionId: 'daily-a' }), post('daily-claim', { actionId: 'daily-b' }, GUEST)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const winner = a.status === 200 ? a : b;
  assert.equal(row.sharedCoins, 1_000_000 + winner.data.dailyReward!.amount);
});

test('a resent claim after a lost answer succeeds from its receipt and pays once', async () => {
  setup();
  const first = await post('daily-claim', { actionId: 'claim-123' });
  assert.equal(first.status, 200);
  const paid = row.sharedCoins;
  const resent = await post('daily-claim', { actionId: 'claim-123' });
  assert.equal(resent.status, 200, resent.data.error);
  assert.equal(resent.data.duplicate, true);
  assert.equal(resent.data.dailyReward!.amount, first.data.dailyReward!.amount);
  assert.equal(row.sharedCoins, paid, 'nothing paid twice');
  // A new press of the button (new id) still gets the honest answer.
  assert.equal((await post('daily-claim', { actionId: 'claim-456' })).status, 409);
  // The receipt is per seat: another player cannot reuse it.
  assert.equal((await post('daily-claim', { actionId: 'claim-123' }, GUEST)).status, 409);
});

test('a star pack resent with the same id opens one card and returns the same reveal', async () => {
  const f = initialGameFeatures();
  setup(f);
  const pack = STAR_PACKS.find((p) => p.id === 'scrap')!;
  const first = await post('star-pack', { packId: pack.id, actionId: 'pack-1' });
  assert.equal(first.status, 200, first.data.error);
  const coins = row.sharedCoins, owned = JSON.parse(row.sharedFeaturesJson).starXI.ownedIds.length;
  const again = await post('star-pack', { packId: pack.id, actionId: 'pack-1' });
  assert.equal(again.status, 200);
  assert.equal(again.data.duplicate, true);
  assert.equal(again.data.packReveal!.openedAt, first.data.packReveal!.openedAt);
  assert.equal(again.data.packReveal!.player.id, first.data.packReveal!.player.id);
  assert.equal(row.sharedCoins, coins);
  assert.equal(JSON.parse(row.sharedFeaturesJson).starXI.ownedIds.length, owned);
  // The same purchase resent concurrently: still one card.
  setup(f);
  const both = await Promise.all([post('star-pack', { packId: pack.id, actionId: 'pack-2' }), post('star-pack', { packId: pack.id, actionId: 'pack-2' })]);
  assert.ok(both.every((r) => r.status === 200));
  assert.equal(row.sharedCoins, 1_000_000 - pack.price);
});

test('the leader tick books passive income as a counter write and answers slim when the features match', async (t) => {
  const clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  setup(initialGameFeatures(), { sharedUpgradesJson: JSON.stringify({ ballboy: 3 }), lastPassiveAt: new Date(clock - 60_000).toISOString() });
  const key = lightRow(row).featuresKey;
  const before = row.sharedCoins;
  const tick = await post('tick', { featuresKey: key });
  assert.equal(tick.status, 200);
  assert.ok(row.sharedCoins > before, 'passive income booked');
  assert.equal(row.lastPassiveAt, new Date(clock).toISOString());
  assert.equal(writes.world, 1);
  assert.equal(writes.features, 0, 'only counters were written');
  assert.equal(tick.data.room!.featuresOmitted, true);
  assert.equal(tick.data.room!.game.features, undefined);
  assert.equal(tick.data.room!.featuresKey, key);
  // A client without the features still gets them.
  const full = await post('tick');
  assert.equal(full.data.room!.featuresOmitted, false);
});

test('a foreground action books passive income in its own write: one world write, same income', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  setup(initialGameFeatures(), { sharedUpgradesJson: JSON.stringify({ ballboy: 3 }) });
  // Reference: the same 60 s booked by a tick alone.
  clock += 60_000;
  row.hostLastSeenAt = row.guestLastSeenAt = new Date(clock).toISOString();
  const start = row.sharedCoins;
  await post('tick');
  const passive = row.sharedCoins - start;
  assert.ok(passive > 0);
  clock += 60_000;
  row.hostLastSeenAt = row.guestLastSeenAt = new Date(clock).toISOString();
  writes.world = 0; writes.touches = 0;
  const before = row.sharedCoins;
  const profile = await post('profile', { name: 'FC Eins', badge: '⚽', color: '#0071e3' });
  assert.equal(profile.status, 200);
  assert.equal(writes.world, 1, 'no separate passive write before the action');
  assert.equal(writes.touches, 0, 'the presence goes into the same write');
  assert.equal(row.sharedCoins - before, passive, 'the same income as before');
  assert.equal(JSON.parse(row.sharedFeaturesJson).club.name, 'FC Eins');
});

test('a co-op match second is one write for the leader; other seats get a slim answer when nothing changed', async (t) => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  let f = initialGameFeatures();
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map((p) => p.id) });
  f = normalizeGameFeatures(f);
  setup(f);
  const started = await post('cup-start', { mode: 'season' });
  assert.equal(started.status, 200, started.data.error);
  assert.equal(JSON.parse(row.sharedFeaturesJson).cup.active, true, "the home fixture kicked off");
  clock += 3000;
  row.hostLastSeenAt = new Date(clock).toISOString();
  writes.world = 0; writes.touches = 0;
  const before = row.sharedCoins;
  const tick = await post('cup-tick');
  assert.equal(tick.status, 200, tick.data.error);
  assert.equal(writes.world, 1, 'match step and passive income in one write');
  assert.ok(row.sharedCoins >= before);
  // The guest is not the leader: its tick writes nothing, and with the current key it gets no features.
  writes.world = 0;
  const key = lightRow(row).featuresKey;
  const guest = await post('cup-tick', { featuresKey: key }, GUEST);
  assert.equal(guest.status, 200);
  assert.equal(writes.world, 0);
  assert.equal(guest.data.room!.featuresOmitted, true);
});

test('presence is written now and then, while the leader stays fresh', () => {
  const now = Date.parse('2026-11-05T12:00:00.000Z');
  const at = (ms: number) => new Date(now - ms).toISOString();
  const base = { code: 'X', hostPlayerId: HOST, guestPlayerId: GUEST, player3PlayerId: null, player4PlayerId: null } as unknown as RoomRow;
  // A non-leader seen 5 s ago does not write again; after 15 s it does.
  assert.equal(presenceWriteDue({ ...base, hostLastSeenAt: at(1000), guestLastSeenAt: at(5000) }, 'guest', now), false);
  assert.equal(presenceWriteDue({ ...base, hostLastSeenAt: at(1000), guestLastSeenAt: at(15_000) }, 'guest', now), true);
  // The leader refreshes before its seat could look stale to the others.
  assert.equal(presenceWriteDue({ ...base, hostLastSeenAt: at(1000), guestLastSeenAt: at(1000) }, 'host', now), false);
  assert.equal(presenceWriteDue({ ...base, hostLastSeenAt: at(3000), guestLastSeenAt: at(1000) }, 'host', now), true);
  // The leader left without a word: the next seat takes over on its next poll.
  assert.equal(presenceWriteDue({ ...base, hostLastSeenAt: at(9000), guestLastSeenAt: at(4000) }, 'guest', now), true);
});

test('only click batches in between let a computed action be stored on top of them', () => {
  setup();
  const after = { ...row, sharedCoins: row.sharedCoins + 50, sharedTotalGoals: row.sharedTotalGoals + 50, hostGoals: 50, sharedStateVersion: row.sharedStateVersion + 3 };
  assert.equal(onlyClicksMoved(row, after), true);
  assert.equal(onlyClicksMoved(row, { ...after, lastPassiveAt: new Date(Date.now() + 5).toISOString() }), false, 'another world write');
  assert.equal(onlyClicksMoved(row, { ...after, sharedUpgradesJson: '{"boots":1}' }), false);
  assert.equal(onlyClicksMoved(row, { ...after, sharedFeaturesJson: '{}' }), false);
});

test('works before and after migration 0009: md5 without the column, the stored key with it, md5 again after a rollback', async () => {
  const dialect = new PgDialect();
  const keySql = (fields: Record<string, unknown>) => dialect.sqlToQuery(fields.featuresKey as SQL).sql;
  // The real getLightRoom, not the test mock.
  const getLightRoom = realGetLightRoom;
  const fakeDb = (columnExists: boolean, columnWorks: boolean, seen: string[]) => ({
    execute: async () => { seen.push('probe'); return columnExists ? [{ present: 1 }] : []; },
    select: (fields: Record<string, unknown>) => ({ from: () => ({ where: () => ({ limit: async () => {
      const text = keySql(fields);
      seen.push(text);
      if (text.includes('features_key') && !columnWorks) throw Object.assign(new Error('column "features_key" does not exist'), { code: '42703' });
      return [{ code: 'X', featuresKey: 'k' }];
    } }) }) }),
  });
  // Before the migration: md5 of the features, and the column is looked up once, not on every poll.
  const before: string[] = [];
  const unmigrated = new GoalClickerDatabase(() => fakeDb(false, false, before) as never);
  await getLightRoom.call(unmigrated, 'X');
  await getLightRoom.call(unmigrated, 'X');
  assert.equal(before.filter((s) => s === 'probe').length, 1);
  assert.ok(before.filter((s) => s !== 'probe').every((s) => s.startsWith('md5(') && !s.includes('features_key')));
  // After: the stored key, md5 only for rows the trigger has not filled.
  const after: string[] = [];
  await getLightRoom.call(new GoalClickerDatabase(() => fakeDb(true, true, after) as never), 'X');
  assert.match(after[1], /^coalesce\("features_key", md5\(/);
  // Rolled back while the instance still believed in the column: same call answers with md5.
  const rolledBack: string[] = [];
  assert.deepEqual(await getLightRoom.call(new GoalClickerDatabase(() => fakeDb(true, false, rolledBack) as never), 'X'), { code: 'X', featuresKey: 'k' });
  assert.ok(rolledBack.at(-1)!.startsWith('md5('));
});

test('error logs carry the code and the first line, never the query parameters', () => {
  const failure = Object.assign(new Error('Failed query: update "coop_rooms" set "shared_features_json" = $1\nparams: {"starXI":{"ownedIds":["secret"]}}'), { cause: Object.assign(new Error('deadlock detected'), { code: '40P01' }) });
  const logged = describeError(failure);
  assert.match(logged, /40P01/);
  assert.match(logged, /Failed query/);
  assert.doesNotMatch(logged, /secret|params/);
});

test('world, travel and reward POSTs accept only same origin JSON', async () => {
  const request = (headers: Record<string, string>) => new Request('http://localhost/api/multiplayer', { method: 'POST', headers });
  assert.equal(refuseUnsafePost(request({ 'content-type': 'application/json' })), null);
  assert.equal(refuseUnsafePost(request({ 'content-type': 'application/json; charset=utf-8', origin: 'http://localhost' })), null);
  assert.equal(refuseUnsafePost(request({ 'content-type': 'application/json', origin: 'https://evil.example' }))!.status, 403);
  assert.equal(refuseUnsafePost(request({ 'content-type': 'text/plain' }))!.status, 415);
  assert.equal(refuseUnsafePost(request({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }))!.status, 403);
  setup();
  const coins = row.sharedCoins;
  const crossSite = await post('daily-claim', {}, HOST, { origin: 'https://evil.example' });
  assert.equal(crossSite.status, 403);
  assert.equal(row.sharedCoins, coins);
  const travel = await import('../app/api/travel/route.ts');
  assert.equal((await travel.POST(new Request('http://localhost/api/travel', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' }))).status, 415);
  const rewards = await import('../app/api/rewards/route.ts');
  assert.equal((await rewards.POST(new Request('http://localhost/api/rewards', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' }))).status, 403);
});

test('a taken room code is rolled again instead of failing', async () => {
  let attempts = 0;
  const insert = GoalClickerDatabase.prototype.insertRoom;
  GoalClickerDatabase.prototype.insertRoom = async (values) => { attempts++; if (attempts < 3) return null; return { ...structuredClone(row), code: values.code, hostPlayerId: values.hostPlayerId, hostName: values.hostName } as RoomRow; };
  try {
    setup();
    const created = await post('create', { nickname: 'Nicolas' });
    assert.equal(created.status, 201, created.data.error);
    assert.equal(attempts, 3);
  } finally {
    GoalClickerDatabase.prototype.insertRoom = insert;
  }
});

test('client resends: growing jittered pauses, every purchase retryable, reload only after repeated refusals', () => {
  assert.ok(coopRetryDelay(1, () => 0) >= 60 && coopRetryDelay(1, () => 1) <= 180);
  assert.ok(coopRetryDelay(3, () => 0) > coopRetryDelay(1, () => 1));
  assert.notEqual(coopRetryDelay(2, () => 0), coopRetryDelay(2, () => 0.9));
  for (const action of ['buy', 'star-pack', 'transfer-accept', 'transfer-decline', 'daily-claim']) assert.equal(NETWORK_RETRY_UNSAFE_COOP_ACTIONS.has(action), false, action);
  const now = 1_000_000;
  assert.equal(coopUpdateReloadDue([now], now), false, 'never on the first refusal');
  assert.equal(coopUpdateReloadDue([now - 1000, now - 500, now], now), false, 'not in the middle of an action');
  assert.equal(coopUpdateReloadDue([now - COOP_UPDATE_RELOAD_GRACE_MS, now - 500, now], now), true);
});
