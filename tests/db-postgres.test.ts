// Runs against a real PostgreSQL database (a local Supabase stack or plain PostgreSQL 15+).
// Set TEST_DATABASE_URL to an empty scratch database; the test applies the migrations and truncates the tables.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'TEST_DATABASE_URL is not set';
let admin: postgres.Sql;
let db: Awaited<typeof import('../db/index.ts')>['getDb'] extends () => infer T ? T : never;
let closeDb: () => Promise<void>;

before(async () => {
  if (!url) return;
  admin = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(admin), { migrationsFolder: 'drizzle' });
  await admin`truncate coop_rooms, solo_travel, player_accounts, profiles, cloud_saves`;
  process.env.DATABASE_URL = url;
  process.env.DATABASE_POOL_MAX = '10';
  const dbModule = await import('../db/index.ts');
  db = dbModule.getDb();
  closeDb = dbModule.closeDb;
});

after(async () => {
  await closeDb?.();
  await admin?.end();
});

const iso = () => new Date().toISOString();
function room(code: string) {
  return { code, hostPlayerId: `host-${code}`, hostName: 'Host', hostLastSeenAt: iso(), lastPassiveAt: '2026-01-01T00:00:00.000Z', updatedAt: iso() };
}

test('rooms round trip with numbers, defaults and ISO timestamps', { skip }, async () => {
  const created = await db.insertRoom({ ...room('RT01'), sharedCoins: 1.5e15, hostClicks: 2 ** 40 });
  assert.equal(created.sharedCoins, 1.5e15);
  assert.equal(created.hostClicks, 2 ** 40);
  assert.equal(created.sharedStateVersion, 0);
  assert.equal(created.roomName, 'Meine Welt');
  assert.equal(created.guestPlayerId, null);
  const [{ updated_at }] = await admin`insert into coop_rooms (code, host_player_id, host_name) values ('RT02', 'h', 'H') returning updated_at`;
  assert.match(updated_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.deepEqual(await db.getRoom('nope'), null);
});

test('only one of many writers with the same state version wins', { skip }, async () => {
  await db.insertRoom(room('VER1'));
  const results = await Promise.all(Array.from({ length: 25 }, (_, i) => db.updateRoom('VER1', { sharedStateVersion: 1, sharedFeaturesJson: JSON.stringify({ writer: i }) }, { sharedStateVersion: 0 })));
  assert.equal(results.filter(Boolean).length, 1);
  const stored = await db.getRoom('VER1');
  assert.equal(stored!.sharedStateVersion, 1);
  assert.equal(stored!.sharedFeaturesJson, results.find(Boolean)!.sharedFeaturesJson);
});

test('an empty seat is claimed exactly once and a taken seat only by its owner', { skip }, async () => {
  await db.insertRoom(room('SEAT'));
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => db.updateRoom('SEAT', { guestPlayerId: `guest-${i}`, guestName: `Gast ${i}` }, { seat: { role: 'guest', playerId: null } })));
  const winners = claims.filter(Boolean);
  assert.equal(winners.length, 1);
  const owner = winners[0]!.guestPlayerId!;
  assert.equal(await db.updateRoom('SEAT', { guestName: 'Fremd' }, { seat: { role: 'guest', playerId: 'someone-else' } }), null);
  assert.equal((await db.updateRoom('SEAT', { guestName: 'Neu' }, { seat: { role: 'guest', playerId: owner } }))!.guestName, 'Neu');
});

test('the passive income timestamp guards a single refresh', { skip }, async () => {
  await db.insertRoom(room('PASS'));
  const before = (await db.getRoom('PASS'))!.lastPassiveAt;
  const refreshes = await Promise.all(Array.from({ length: 15 }, (_, i) => db.updateRoom('PASS', { lastPassiveAt: `2026-02-01T00:00:${String(i).padStart(2, '0')}.000Z`, sharedCoins: i }, { lastPassiveAt: before })));
  assert.equal(refreshes.filter(Boolean).length, 1);
});

test('concurrent clicks add up exactly and bump the version each time', { skip }, async () => {
  await db.insertRoom(room('CLIK'));
  await Promise.all(Array.from({ length: 40 }, () => db.applyClick('CLIK', 'host', 1.5, 3, iso())));
  await Promise.all(Array.from({ length: 10 }, () => db.applyClick('CLIK', 'player4', 2, 1, iso())));
  const stored = (await db.getRoom('CLIK'))!;
  assert.equal(stored.sharedCoins, 80);
  assert.equal(stored.sharedTotalGoals, 80);
  assert.equal(stored.hostGoals, 60);
  assert.equal(stored.hostClicks, 120);
  assert.equal(stored.player4Clicks, 10);
  assert.equal(stored.sharedStateVersion, 50);
  // Non finite amounts never reach the SQL text; they add nothing.
  await db.applyClick('CLIK', 'host', Number.NaN, Number.POSITIVE_INFINITY, iso());
  assert.equal((await db.getRoom('CLIK'))!.sharedCoins, 80);
});

test('the world list finds a player in any seat, newest first', { skip }, async () => {
  await db.insertRoom({ ...room('LST1'), guestPlayerId: 'lister', updatedAt: '2026-01-01T00:00:00.000Z' });
  await db.insertRoom({ ...room('LST2'), player3PlayerId: 'lister', updatedAt: '2026-02-01T00:00:00.000Z' });
  await db.insertRoom({ ...room('LST3'), hostPlayerId: 'lister', updatedAt: '2026-03-01T00:00:00.000Z' });
  assert.deepEqual((await db.listRoomsForPlayer('lister')).map((r) => r.code), ['LST3', 'LST2', 'LST1']);
  await db.deleteRoom('LST3');
  assert.deepEqual((await db.listRoomsForPlayer('lister')).map((r) => r.code), ['LST2', 'LST1']);
});

test('a solo journey receipt is created once and consumed once', { skip }, async () => {
  const first = await db.putSoloJourney('owner-1', 'fixture-1', { id: 'a', consumed: false, nested: { km: 12.5 } });
  const second = await db.putSoloJourney('owner-1', 'fixture-1', { id: 'b', consumed: false });
  assert.deepEqual(first, { id: 'a', consumed: false, nested: { km: 12.5 } });
  assert.deepEqual(second, first);
  const consumed = await Promise.all(Array.from({ length: 10 }, (_, i) => db.consumeSoloJourney('owner-1', 'fixture-1', { id: 'a', consumed: true, by: i })));
  assert.equal(consumed.filter(Boolean).length, 1);
  assert.equal((await db.getSoloJourney('owner-1', 'fixture-1')).consumed, true);
  assert.equal(await db.consumeSoloJourney('owner-1', 'fixture-1', { consumed: true }), false);
  // Receipts without the flag (reward receipts) or with a legacy 0 still count as not consumed.
  await db.putSoloJourney('owner-1', 'reward-1', { opening: { id: 'x' } });
  assert.equal(await db.consumeSoloJourney('owner-1', 'reward-1', { opening: { id: 'x' }, consumed: true }), true);
  await admin`insert into solo_travel values ('owner-1', 'legacy-0', '{"consumed":0}')`;
  assert.equal(await db.consumeSoloJourney('owner-1', 'legacy-0', { consumed: true }), true);
  assert.equal(await db.getSoloJourney('owner-2', 'fixture-1'), null);
});

test('row level security keeps the tables closed to the Supabase browser roles', { skip }, async () => {
  const rows = await admin`select relname, relrowsecurity from pg_class where relname in ('coop_rooms', 'solo_travel') order by relname`;
  assert.deepEqual(rows.map((r) => [r.relname, r.relrowsecurity]), [['coop_rooms', true], ['solo_travel', true]]);
  const accountTables = await admin`select relname, relrowsecurity from pg_class where relname in ('player_accounts', 'profiles', 'cloud_saves') order by relname`;
  assert.deepEqual(accountTables.map((r) => [r.relname, r.relrowsecurity]), [['cloud_saves', true], ['player_accounts', true], ['profiles', true]]);
  const policies = await admin`select count(*)::int as n from pg_policies where tablename in ('coop_rooms', 'solo_travel')`;
  assert.equal(policies[0].n, 0);
});

test('the multiplayer API creates, joins and plays a world on PostgreSQL', { skip }, async () => {
  const { POST, GET } = await import('../app/api/multiplayer/route.ts');
  const { MULTIPLAYER_PROTOCOL_VERSION: protocol } = await import('../app/multiplayer-protocol.ts');
  const post = async (body: Record<string, unknown>) => { const r = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocol, ...body }) })); return { status: r.status, data: await r.json() as { room?: { code: string; playerCount: number; sharedCoins: number }; role?: string; error?: string } }; };
  const created = await post({ action: 'create', playerId: 'e2e-host-player', nickname: 'Nicolas' });
  assert.equal(created.status, 201, created.data.error);
  const code = created.data.room!.code;
  const joins = await Promise.all(['e2e-guest-a', 'e2e-guest-b', 'e2e-guest-c', 'e2e-guest-d'].map((playerId, i) => post({ action: 'join', code, playerId, nickname: `Gast${i}` })));
  assert.deepEqual(joins.map((j) => j.status).sort(), [200, 200, 200, 409]);
  assert.deepEqual(joins.filter((j) => j.status === 200).map((j) => j.data.role).sort(), ['guest', 'player3', 'player4']);
  const clicks = await Promise.all(Array.from({ length: 8 }, () => post({ action: 'click', code, playerId: 'e2e-host-player', amount: 1, clickCount: 1 })));
  assert.ok(clicks.every((c) => c.status === 200));
  const list = await GET(new Request(`http://localhost/api/multiplayer?protocol=${protocol}&playerId=e2e-host-player&list=1`));
  const rooms = (await list.json() as { rooms: { code: string; playerCount: number }[] }).rooms;
  assert.equal(rooms.find((r) => r.code === code)?.playerCount, 4);
  const stored = (await db.getRoom(code))!;
  assert.equal(stored.hostClicks, 8);
  assert.ok(stored.sharedStateVersion >= 8);
});

test('a login links one player ID, once, even when two devices log in at the same time', { skip }, async () => {
  const user = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
  const links = await Promise.all(['device-a-player', 'device-b-player', 'device-c-player'].map((id) => db.linkAccount(user, id, 'a@example.com')));
  assert.equal(new Set(links.map((l) => l!.playerId)).size, 1);
  const owned = links[0]!.playerId;
  // Another account can neither take that player ID nor link a second one for the same user.
  assert.equal(await db.linkAccount(other, owned, null), null);
  assert.equal((await db.linkAccount(user, 'yet-another-id', null))!.playerId, owned);
});

test('an account without worlds may switch to an imported player ID, one with worlds may not', { skip }, async () => {
  const fresh = '00000000-0000-4000-8000-000000000003', busy = '00000000-0000-4000-8000-000000000004';
  await db.linkAccount(fresh, 'fresh-random-id', null);
  assert.equal((await db.relinkAccount(fresh, 'imported-old-id')).account!.playerId, 'imported-old-id');
  await db.linkAccount('00000000-0000-4000-8000-000000000005', 'someone-elses-id', null);
  assert.equal((await db.relinkAccount(fresh, 'someone-elses-id')).reason, 'taken');
  await db.linkAccount(busy, 'busy-player-id', null);
  await db.insertRoom({ ...room('BUSY'), hostPlayerId: 'busy-player-id' });
  const refused = await db.relinkAccount(busy, 'another-imported-id');
  assert.equal(refused.reason, 'has-worlds');
  assert.equal(refused.account!.playerId, 'busy-player-id');
});

test('of many accounts claiming one username in any case, exactly one gets it', { skip }, async () => {
  const now = iso();
  const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => db.createProfile(`00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, i % 2 ? 'Striker' : 'STRIKER', `Spieler ${i}`, now)));
  assert.equal(claims.filter((c) => c.profile).length, 1);
  assert.equal(claims.filter((c) => c.reason === 'taken').length, 11);
  const owner = claims.find((c) => c.profile)!.profile!.userId;
  assert.equal((await db.createProfile(owner, 'another', 'Zwei', now)).reason, 'exists');
  assert.equal(await db.isUsernameTaken('striker'), true);
  assert.equal(await db.isUsernameTaken('striker', owner), false);
});

test('a username changes once per period, the own name may change its case any time', { skip }, async () => {
  const user = '00000000-0000-4000-8000-000000000201';
  await db.createProfile(user, 'Keeper', 'Torwart', '2026-10-01T10:00:00.000Z');
  assert.equal((await db.changeUsername(user, 'KEEPER', '2026-10-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z')).profile!.username, 'KEEPER');
  assert.equal((await db.changeUsername(user, 'Goalie', '2026-10-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z')).reason, 'too-soon');
  assert.equal((await db.changeUsername(user, 'striker', '2026-11-02T10:00:00.000Z', '2026-10-03T10:00:00.000Z')).reason, 'taken');
  const changed = await db.changeUsername(user, 'Goalie', '2026-11-02T10:00:00.000Z', '2026-10-03T10:00:00.000Z');
  assert.equal(changed.profile!.usernameKey, 'goalie');
  assert.equal(changed.profile!.usernameChangedAt, '2026-11-02T10:00:00.000Z');
  // The old name is free again.
  assert.equal(await db.isUsernameTaken('keeper'), false);
  assert.equal((await db.changeUsername('00000000-0000-4000-8000-000000000299', 'Nobody', iso(), iso())).reason, 'missing');
});

test('two devices saving on the same cloud version: one wins, the other gets the newer save', { skip }, async () => {
  const user = '00000000-0000-4000-8000-000000000301';
  const first = await Promise.all(Array.from({ length: 6 }, (_, i) => db.putCloudSave(user, `{"device":${i}}`, 0, iso())));
  assert.equal(first.filter((r) => r.save).length, 1);
  const winner = first.find((r) => r.save)!.save!;
  assert.equal(winner.version, 1);
  const next = await Promise.all(Array.from({ length: 6 }, (_, i) => db.putCloudSave(user, `{"round":2,"device":${i}}`, 1, iso())));
  assert.equal(next.filter((r) => r.save).length, 1);
  const losers = next.filter((r) => r.conflict);
  assert.equal(losers.length, 5);
  assert.equal(losers[0].conflict!.version, 2);
  assert.equal((await db.getCloudSave(user))!.saveJson, next.find((r) => r.save)!.save!.saveJson);
});

test('deleting an account removes profile, cloud save and link but keeps shared worlds', { skip }, async () => {
  const user = '00000000-0000-4000-8000-000000000401';
  await db.linkAccount(user, 'deleted-player-id', 'gone@example.com');
  await db.createProfile(user, 'Leaving', 'Weg', iso());
  await db.putCloudSave(user, '{}', 0, iso());
  await db.insertRoom({ ...room('KEEP'), hostPlayerId: 'deleted-player-id' });
  // The scratch database has no Supabase auth schema, so the login itself is not deleted here.
  assert.deepEqual(await db.deleteAccount(user), { loginDeleted: false });
  assert.equal(await db.getProfile(user), null);
  assert.equal(await db.getCloudSave(user), null);
  assert.equal(await db.getAccount(user), null);
  assert.ok(await db.getRoom('KEEP'));
});

test('a username account keeps its login address on the server and is found by its username', { skip }, async () => {
  const user = '00000000-0000-4000-8000-000000000501';
  // The scratch database has no Supabase auth schema; there the app registers through the Auth API instead.
  assert.equal(await db.createPasswordLogin('p-x@players.goal-clicker.vercel.app', 'sicheres-passwort'), null);
  assert.equal(await db.deleteLogin(user), false);
  await db.createProfile(user, 'Libero', 'Libero', iso(), 'p-libero@players.goal-clicker.vercel.app');
  assert.equal((await db.getProfileByUsername('libero'))!.loginEmail, 'p-libero@players.goal-clicker.vercel.app');
  assert.equal(await db.getProfileByUsername('nobody'), null);
});
