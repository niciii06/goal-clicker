// Measures database round trips, query time and database egress of the real API handlers on a DISPOSABLE local
// PostgreSQL (docs/db-profile.md). Synthetic worlds and saves only; refuses any server that is not local.
//
//   scripts/db-rehearsal/local-cluster.sh start
//   PROFILE_DATABASE_URL=postgres://tester@127.0.0.1:55432/postgres npx tsx scripts/db-profile/profile.mts [--with-0009] [--json out.json]
//
// Egress is counted on the wire: the handlers talk to Postgres through a local TCP relay that counts the bytes in
// both directions (what Neon bills as egress is the server to client side). Query counts and times come from
// pg_stat_statements of the profiling database. Local timings are far below Neon's (no network, warm compute); the
// counts and bytes are what transfers to Neon, the milliseconds only rank the queries against each other.
import { spawnSync } from 'node:child_process';
import { createServer, connect, type AddressInfo } from 'node:net';
import { writeFileSync } from 'node:fs';
import postgres from 'postgres';

const raw = process.env.PROFILE_DATABASE_URL;
if (!raw || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(raw).hostname)) {
  console.error('PROFILE_DATABASE_URL muss auf einen lokalen Server zeigen (scripts/db-rehearsal/local-cluster.sh start).');
  process.exit(2);
}
const WITH_0009 = process.argv.includes('--with-0009');
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : '';
const NAME = `gc_profile_${process.pid}`;
const target = new URL(raw);
const admin = postgres(raw, { max: 1, onnotice: () => {} });
await admin.unsafe(`create database "${NAME}"`);
const dbUrl = new URL(raw); dbUrl.pathname = `/${NAME}`;
const sql = postgres(dbUrl.toString(), { max: 1, onnotice: () => {} });

// ---- Byte counting relay ------------------------------------------------------------------------------------
const wire = { toClient: 0, toServer: 0 };
const relay = createServer((client) => {
  const server = connect(Number(target.port || 5432), target.hostname);
  client.on('data', (chunk) => { wire.toServer += chunk.length; server.write(chunk); });
  server.on('data', (chunk) => { wire.toClient += chunk.length; client.write(chunk); });
  client.on('close', () => server.destroy());
  server.on('close', () => client.destroy());
  client.on('error', () => server.destroy());
  server.on('error', () => client.destroy());
});
await new Promise<void>((resolve) => relay.listen(0, '127.0.0.1', resolve));
const relayUrl = new URL(dbUrl); relayUrl.host = `127.0.0.1:${(relay.address() as AddressInfo).port}`;

try {
  // ---- Schema and fixtures ----------------------------------------------------------------------------------
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
  if (WITH_0009) {
    const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', dbUrl.toString(), '-c', 'set client_min_messages = warning', '-f', 'drizzle/0009_coop_features_key_solo_travel_created_at.sql'], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
  }
  await sql`create extension if not exists pg_stat_statements`;

  process.env.DATABASE_URL = relayUrl.toString();
  process.env.DATABASE_POOL_MAX = '3';
  delete process.env.AUTH_REQUIRED;
  const { getDb, closeDb } = await import('../../db/index.ts');
  const { POST, GET, clearRoomCacheForTests } = await import('../../app/api/multiplayer/route.ts');
  const { MULTIPLAYER_PROTOCOL_VERSION: protocol } = await import('../../app/multiplayer-protocol.ts');
  const { getCloudSaveResponse, putCloudSaveResponse } = await import('../../app/account-api.ts');
  const { lookupAccount } = await import('../../app/auth/identity.ts');
  const { leaderboardResponse } = await import('../../app/leaderboard-api.ts');
  const fd = await import('../../app/feature-data.ts');
  const { emptyPlayerStats } = await import('../../app/career-data.ts');
  const { STORAGE_KEY } = await import('../../app/game/constants.ts');
  const db = getDb();

  /** A late game world: every card owned, career stats, a running season match (the heaviest common state). */
  function lateGameFeatures(seed: number) {
    const f = fd.initialGameFeatures(1_000_000 + seed);
    for (const p of fd.STAR_XI_PLAYERS.filter((p) => p.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
    f.starXI = fd.setBestStarXI({ ...f.starXI, ownedIds: fd.STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
    for (let i = 0; i < 30; i++) fd.addHistory(f, { title: `Spiel ${i}`, detail: `Synthetischer Eintrag ${i}`, tone: 'good' } as never, 1_000_000 + i * 3_600_000);
    return f;
  }

  const post = async (body: Record<string, unknown>) => {
    const r = await POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocol, ...body }) }));
    const text = await r.text();
    return { status: r.status, bytes: text.length, data: JSON.parse(text) as Record<string, unknown> & { room?: { code: string; featuresKey: string; status?: string } } };
  };
  const get = async (query: string) => {
    const r = await GET(new Request(`http://localhost/api/multiplayer?protocol=${protocol}&${query}`));
    const text = await r.text();
    return { status: r.status, bytes: text.length, data: JSON.parse(text) as Record<string, unknown> & { room?: { featuresKey: string } } };
  };

  // Background: 2000 small worlds for the list and the leaderboard, as Postgres would hold after a while.
  await sql`insert into coop_rooms (code, host_player_id, host_name, guest_player_id, guest_name, shared_total_goals, shared_best_league, shared_trophies, updated_at, shared_features_json)
    select 'BG' || lpad(i::text, 4, '0'), 'bg-host-' || (i % 700), 'Host', case when i % 3 = 0 then 'bg-guest-' || (i % 500) end, 'Gast', (i * 7919) % 100000, 1 + i % 9, i % 13,
           to_char(now() - make_interval(secs => i), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '{"small":true}'
    from generate_series(1, 2000) i`;
  await sql`analyze`;

  const created = await post({ action: 'create', playerId: 'profile-host-0001', nickname: 'Host' });
  const code = created.data.room!.code;
  await post({ action: 'join', code, playerId: 'profile-guest-0001', nickname: 'Gast' });
  const heavy = JSON.stringify(lateGameFeatures(1));
  await sql`update coop_rooms set shared_features_json = ${heavy} where code = ${code}`;
  // One normal write (favourite on and off) so the world is stored the way the route stores it (normalized,
  // with its backup copy), not as the raw fixture.
  for (let i = 0; i < 2; i++) await post({ action: 'star-favorite', code, playerId: 'profile-host-0001', starPlayerId: fd.STAR_XI_PLAYERS[0].id });

  const user = '00000000-0000-4000-8000-00000000f001';
  await db.linkAccount(user, 'profile-host-0001', null);
  await db.bindIdentity({ issuer: 'https://auth.example.test', subject: 'profile-subject', accountId: user, method: 'email', loginEmail: 'profile@example.test', createdAt: new Date().toISOString() });
  const saveKeys = { [STORAGE_KEY]: JSON.stringify({ goals: 5e9, totalGoals: 5e9, clicks: 1e6, seasons: 12, stars: 40, features: lateGameFeatures(2) }) };
  const deps = {
    getSession: async () => ({ issuer: 'https://auth.example.test', subject: 'profile-subject', email: 'profile@example.test', name: 'Profil', cookie: '' }),
    lookupAccount: (session: never) => lookupAccount(session, { store: () => db as never }),
    db: () => db, configured: () => true, now: () => new Date(), rateLimit: async () => null,
  } as never;

  // ---- Measurement ------------------------------------------------------------------------------------------
  type Row = { scenario: string; featuresBytes: number; requests: number; statuses: string; dbCalls: number; dbMs: number; egressBytes: number; ingressBytes: number; responseBytes: number; p50: number; p95: number; top: { query: string; calls: number; meanMs: number; rows: number }[] };
  const results: Row[] = [];
  async function measure(scenario: string, requests: number, once: (i: number) => Promise<{ status: number; bytes: number }>) {
    await new Promise((r) => setTimeout(r, 50));
    const [{ fb }] = await sql`select coalesce(max(octet_length(shared_features_json)), 0)::int as fb from coop_rooms where code = ${code}`;
    await sql`select pg_stat_statements_reset()`;
    const before = { ...wire };
    const times: number[] = []; const statuses = new Map<number, number>(); let responseBytes = 0;
    for (let i = 0; i < requests; i++) {
      const start = performance.now();
      const r = await once(i);
      times.push(performance.now() - start);
      statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
      responseBytes += r.bytes;
    }
    const egressBytes = wire.toClient - before.toClient;
    const ingressBytes = wire.toServer - before.toServer;
    const [{ dbid }] = await sql`select oid as dbid from pg_database where datname = current_database()`;
    const stats = await sql<{ query: string; calls: string; total: number; mean: number; rows: string }[]>`
      select query, calls, total_exec_time as total, mean_exec_time as mean, rows from pg_stat_statements
      where dbid = ${dbid} and query not ilike '%pg_stat_statements%' and query not ilike '%from pg_database%' and query not in ('BEGIN', 'COMMIT') order by total_exec_time desc`;
    times.sort((a, b) => a - b);
    results.push({
      scenario, featuresBytes: fb, requests, statuses: [...statuses].map(([s, n]) => `${s}x${n}`).join(' '),
      dbCalls: stats.reduce((n, s) => n + Number(s.calls), 0), dbMs: Math.round(stats.reduce((n, s) => n + s.total, 0) * 10) / 10,
      egressBytes, ingressBytes, responseBytes, p50: Math.round(times[Math.floor(times.length / 2)]), p95: Math.round(times[Math.floor(times.length * 0.95)] ?? times.at(-1)!),
      top: stats.slice(0, 3).map((s) => ({ query: s.query.replace(/\s+/g, ' ').slice(0, 140), calls: Number(s.calls), meanMs: Math.round(s.mean * 100) / 100, rows: Number(s.rows) })),
    });
  }

  clearRoomCacheForTests();
  const first = await get(`code=${code}&playerId=profile-guest-0001`);
  const key = first.data.room!.featuresKey;

  await measure('Poll Warteraum, Features bekannt (quickPoll)', 40, () => get(`code=${code}&playerId=profile-guest-0001&featuresKey=${key}`));
  await measure('Poll ohne bekannte Features, warme Instanz', 20, () => get(`code=${code}&playerId=profile-guest-0001`));
  await measure('Poll ohne bekannte Features, kalte Instanz', 20, () => { clearRoomCacheForTests(); return get(`code=${code}&playerId=profile-guest-0001`); });
  await measure('Klickbatch', 40, () => post({ action: 'click', code, playerId: 'profile-host-0001', amount: 3, clickCount: 3 }));
  await measure('Tick mit bekannten Features, warm', 40, () => post({ action: 'tick', code, playerId: 'profile-host-0001', featuresKey: key }));
  await measure('Tick, kalte Instanz', 20, () => { clearRoomCacheForTests(); return post({ action: 'tick', code, playerId: 'profile-host-0001', featuresKey: key }); });
  const card = fd.STAR_XI_PLAYERS[0].id;
  await measure('Spielaktion mit Featureänderung (Favorit)', 20, () => post({ action: 'star-favorite', code, playerId: 'profile-host-0001', starPlayerId: card }));
  await measure('Weltenliste (15 s Intervall)', 20, () => get('playerId=bg-host-7&list=1'));
  await measure('Rangliste Tore', 10, async () => { const r = await leaderboardResponse(new Request('http://localhost/api/leaderboard?playerId=profile-host-0001&sort=goals'), { db: () => db, resolve: async (_r: Request, playerId: string) => ({ ok: true, playerId }) } as never); return { status: r.status, bytes: (await r.text()).length }; });
  await measure('Rangliste Liga', 10, async () => { const r = await leaderboardResponse(new Request('http://localhost/api/leaderboard?playerId=profile-host-0001&sort=league'), { db: () => db, resolve: async (_r: Request, playerId: string) => ({ ok: true, playerId }) } as never); return { status: r.status, bytes: (await r.text()).length }; });

  let version = 0;
  await measure('Cloud Save hochladen', 20, async () => {
    const r = await putCloudSaveResponse(new Request('http://localhost/api/save', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseVersion: version, keys: saveKeys, active: true }) }), deps);
    const text = await r.text(); const data = JSON.parse(text) as { version?: number };
    if (data.version) version = data.version;
    return { status: r.status, bytes: text.length };
  });
  await measure('Cloud Save prüfen, unverändert (since)', 40, async () => { const r = await getCloudSaveResponse(new Request(`http://localhost/api/save?since=${version}`), deps); return { status: r.status, bytes: (await r.text()).length }; });
  await measure('Cloud Save laden, vollständig', 10, async () => { const r = await getCloudSaveResponse(new Request('http://localhost/api/save'), deps); return { status: r.status, bytes: (await r.text()).length }; });

  // ---- Plans of the queries that scan more than one row -----------------------------------------------------
  const plans: Record<string, string> = {};
  const plan = async (label: string, text: string) => { plans[label] = (await sql.unsafe(`explain (analyze, buffers, costs off, timing off, summary off) ${text}`)).map((r) => r['QUERY PLAN']).join('\n'); };
  await plan('Weltenliste', `select code from coop_rooms where host_player_id = 'bg-host-7' or guest_player_id = 'bg-host-7' or player3_player_id = 'bg-host-7' or player4_player_id = 'bg-host-7' order by updated_at desc limit 12`);
  await plan('Rangliste Tore', `select code from coop_rooms where shared_total_goals > 0 and redeemed_bonus_codes_json not like '%"AZB"%' order by shared_total_goals desc, code asc limit 50`);
  await plan('Rangliste Liga', `select code from coop_rooms where shared_total_goals > 0 and redeemed_bonus_codes_json not like '%"AZB"%' order by shared_best_league asc, shared_total_goals desc, code asc limit 50`);
  await plan('Rate Limit aufräumen', `select key from rate_limits where window_start < 0`);

  const sizes = (await sql`select octet_length(shared_features_json) as features, octet_length(shared_state_backup_json) as backup from coop_rooms where code = ${code}`)[0];
  const saveSize = (await sql`select octet_length(save_json) as save from cloud_saves where user_id = ${user}`)[0];
  const report = { variant: WITH_0009 ? 'mit 0009' : 'ohne 0009', featuresBytes: sizes.features, backupBytes: sizes.backup, saveBytes: saveSize?.save ?? 0, results, plans };

  console.log(`Variante: ${report.variant}; Features der Welt ${report.featuresBytes} B, Backup ${report.backupBytes} B, Cloud Spielstand ${report.saveBytes} B`);
  console.log(['Szenario', 'Features B', 'Anfragen', 'Status', 'DB Abfragen/Anfr.', 'DB ms/Anfr.', 'DB Egress B/Anfr.', 'DB Ingress B/Anfr.', 'Antwort B/Anfr.', 'p50 ms', 'p95 ms'].join(' | '));
  for (const r of results) {
    const per = (n: number) => Math.round(n / r.requests * 10) / 10;
    console.log([r.scenario, r.featuresBytes, r.requests, r.statuses, per(r.dbCalls), per(r.dbMs), Math.round(r.egressBytes / r.requests), Math.round(r.ingressBytes / r.requests), Math.round(r.responseBytes / r.requests), r.p50, r.p95].join(' | '));
    for (const t of r.top) console.log(`    ${t.calls}x ${t.meanMs} ms ${t.rows} Zeilen: ${t.query}`);
  }
  for (const [label, text] of Object.entries(plans)) console.log(`\nPlan ${label}:\n${text}`);
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  await closeDb();
} finally {
  await sql.end({ timeout: 5 });
  relay.close();
  await admin.unsafe(`drop database if exists "${NAME}" with (force)`);
  await admin.end({ timeout: 5 });
}
