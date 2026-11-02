// Measures what one multiplayer world and one cloud save cost per request, on a SCRATCH database: database result
// size, HTTP body size with and without gzip, and the server time per request (route handlers called directly,
// so no network and no Netlify overhead is included). Creates its own world and save and deletes them again.
//
//   MEASURE_SCRATCH=1 DATABASE_URL=<empty scratch database with migrations> npx tsx scripts/migration/measure-traffic.mts
//
// Never point it at production. It refuses without MEASURE_SCRATCH=1.
import { gunzipSync } from 'node:zlib';
import { connect } from './shared.mts';

if (process.env.MEASURE_SCRATCH !== '1') {
  console.error('Nur gegen eine Testdatenbank: MEASURE_SCRATCH=1 setzen.');
  process.exit(2);
}
for (const name of ['NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET', 'NETLIFY', 'VERCEL']) delete process.env[name];

const { sql, host } = connect('DATABASE_URL');
const { GET, POST } = await import('../../app/api/multiplayer/route.ts');
const { MULTIPLAYER_PROTOCOL_VERSION: protocol } = await import('../../app/multiplayer-protocol.ts');
const { getDb, closeDb } = await import('../../db/index.ts');

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function measure(label: string, run: () => Promise<Response>, rounds = 15) {
  const times: number[] = [];
  let raw = 0, wire = 0, status = 0;
  for (let i = 0; i < rounds; i++) {
    const started = performance.now();
    const response = await run();
    const body = new Uint8Array(await response.arrayBuffer());
    times.push(performance.now() - started);
    status = response.status;
    wire = body.byteLength;
    raw = response.headers.get('content-encoding') === 'gzip' ? gunzipSync(body).byteLength : body.byteLength;
  }
  console.log(`${label.padEnd(44)} status ${status}  JSON ${String(raw).padStart(7)} B  gesendet ${String(wire).padStart(7)} B  Median ${median(times).toFixed(1)} ms`);
  return { raw, wire, ms: median(times) };
}
const gzip = { 'accept-encoding': 'gzip' };
async function readJson<T>(response: Response): Promise<T> {
  const body = new Uint8Array(await response.arrayBuffer());
  return JSON.parse((response.headers.get('content-encoding') === 'gzip' ? gunzipSync(body) : Buffer.from(body)).toString()) as T;
}
const post = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json', ...gzip }, body: JSON.stringify({ protocol, ...body }) }));
const get = (params: Record<string, string>) => GET(new Request(`http://localhost/api/multiplayer?${new URLSearchParams({ ...params, protocol: String(protocol) })}`, { headers: gzip }));

const host1 = `measure-host-${Date.now()}`, guest1 = `measure-guest-${Date.now()}`;
let code = '';
try {
  console.log(`Datenbank: ${host}`);
  const created = await post({ action: 'create', playerId: host1, nickname: 'Messung' });
  code = (await readJson<{ room: { code: string } }>(created)).room.code;
  await post({ action: 'join', code, playerId: guest1, nickname: 'Gast' });
  const [sizes] = await sql`select pg_column_size(shared_features_json) as features, pg_column_size(shared_state_backup_json) as backup, octet_length(shared_features_json) as features_text, pg_column_size(t.*) as row from coop_rooms t where code = ${code}`;
  console.log(`Welt in PostgreSQL: Zeile ${sizes.row} B (komprimiert gespeichert), Features ${sizes.features_text} B als Text, Backup ${sizes.backup} B`);
  const room = await readJson<{ featuresKey?: string; room?: { featuresKey?: string } }>(await get({ code, playerId: host1 }));
  const featuresKey = room.featuresKey ?? room.room?.featuresKey ?? '';
  await measure('Welt lesen, voll (ohne featuresKey)', () => get({ code, playerId: host1 }));
  if (featuresKey) await measure('Welt lesen, unverändert (mit featuresKey)', () => get({ code, playerId: host1, featuresKey }));
  await measure('Weltenliste', () => get({ playerId: host1, list: '1' }));
  if (featuresKey) await measure('Live Tick (unverändert)', () => post({ action: 'tick', code, playerId: host1, featuresKey }));
  await measure('Klick (1)', () => post({ action: 'click', code, playerId: host1, amount: 1, clickCount: 1 }), 10);

  // Cloud save: the version check in SQL against reading the whole save.
  const db = getDb();
  const account = '00000000-0000-4000-8000-0000000fffff';
  await sql`delete from cloud_saves where user_id = ${account}::uuid`;
  const save = JSON.stringify({ goalClickerSiteSaveV3: JSON.stringify({ totalGoals: 1, filler: 'x'.repeat(120_000) }) });
  await db.putCloudSave(account, save, 0, new Date().toISOString());
  const full2 = await db.getCloudSave(account);
  const since = await db.getCloudSaveSince(account, full2!.version);
  console.log(`Cloud Spielstand vom Server lesen: alt ${JSON.stringify(full2).length} B, unverändert jetzt ${JSON.stringify(since).length} B`);
  await sql`delete from cloud_saves where user_id = ${account}::uuid`;
} finally {
  if (code) await sql`delete from coop_rooms where code = ${code}`;
  await sql.end();
  await closeDb();
}
