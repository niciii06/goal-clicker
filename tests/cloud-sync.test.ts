// CloudSync in a minimal browser: memory localStorage, an event target as window and a scripted /api/save.
import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';

const store = new Map<string, string>();
const target = new EventTarget();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() },
  window: Object.assign(target, { setInterval: () => 1, clearInterval: () => {}, setTimeout, clearTimeout }),
  document: { addEventListener: () => {}, removeEventListener: () => {}, visibilityState: 'visible' },
});
const { CloudSync, readCloudMeta, writeCloudMeta, CLOUD_META_KEY } = await import('../app/cloud-sync.ts');
const { STORAGE_KEY } = await import('../app/game/constants.ts');

const game = (goals: number) => JSON.stringify({ goals, totalGoals: goals, clicks: goals, seasons: 1, stars: 2 });
const goalsIn = (text: string | undefined) => text ? (JSON.parse(text) as { totalGoals: number }).totalGoals : 0;

/** The server: one save with a version; a PUT on an older base version is a conflict. */
function server(initialVersion: number, initialKeys: Record<string, string>) {
  const state = { version: initialVersion, keys: initialKeys, loseNextAnswer: false, requests: 0, gzipped: 0 };
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    state.requests++;
    // Uploads go out gzipped where the runtime can compress, like in the browser.
    const gzipped = (init?.headers as Record<string, string> | undefined)?.['content-encoding'] === 'gzip';
    if (gzipped) state.gzipped++;
    const text = gzipped ? gunzipSync(init!.body as Uint8Array).toString('utf8') : String(init?.body);
    const body = JSON.parse(text) as { baseVersion: number; keys: Record<string, string> };
    if (body.baseVersion !== state.version) return new Response(JSON.stringify({ errorCode: 'SAVE_CONFLICT', version: state.version, keys: state.keys, active: true, updatedAt: null }), { status: 409 });
    state.version++; state.keys = body.keys;
    if (state.loseNextAnswer) { state.loseNextAnswer = false; throw new TypeError('Failed to fetch'); }
    return new Response(JSON.stringify({ version: state.version }), { status: 200 });
  }) as typeof fetch;
  return state;
}

test('an upload that went through without an answer is recognised by the next upload, which keeps the newer progress', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(50));
  const cloud = server(1, { [STORAGE_KEY]: game(50) });
  writeCloudMeta({ userId: 'u', version: 1, hash: '', played: true });
  let reloadedWith: string | undefined;
  const sync = new CloudSync('u', { onNewerSave: (save) => { reloadedWith = save.keys?.[STORAGE_KEY]; } });

  // Upload A (100 goals, sent when syncing starts) reaches the server, but the answer is lost.
  store.set(STORAGE_KEY, game(100));
  cloud.loseNextAnswer = true;
  sync.start();
  // Meanwhile the player keeps playing (B, 150 goals); the next upload follows the lost one.
  store.set(STORAGE_KEY, game(150));
  window.dispatchEvent(new Event('pointerdown'));
  assert.equal(await sync.upload(), true);
  assert.equal(cloud.requests, 3, 'A, then B refused against the old version, then B on top of A');
  sync.stop();

  assert.equal(reloadedWith, undefined, 'the device did not load its own older save A');
  assert.equal(goalsIn(store.get(STORAGE_KEY)), 150, 'local progress stays');
  assert.equal(goalsIn(cloud.keys[STORAGE_KEY]), 150, 'the cloud has the newer progress');
  assert.equal(readCloudMeta('u')!.version, cloud.version);
  assert.equal(readCloudMeta('u')!.pending, undefined, 'nothing is left unanswered');
  assert.ok(store.has(CLOUD_META_KEY));
});

test('a newer save from another device still wins', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(80));
  server(5, { [STORAGE_KEY]: game(300) });
  writeCloudMeta({ userId: 'u', version: 4, hash: '', played: true });
  let reloadedWith: string | undefined;
  const sync = new CloudSync('u', { onNewerSave: (save) => { reloadedWith = save.keys?.[STORAGE_KEY]; } });
  sync.start();
  window.dispatchEvent(new Event('pointerdown'));
  assert.equal(await sync.upload(), false);
  sync.stop();
  assert.equal(goalsIn(reloadedWith), 300);
});

test('an upload answer that arrives after stop() does not write the cleared account data back', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(50));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  let answer: ((response: Response) => void) | undefined;
  globalThis.fetch = (() => new Promise<Response>((resolve) => { answer = resolve; })) as typeof fetch;
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  // The upload compresses first; wait until its request is out.
  while (!answer) await new Promise((resolve) => setTimeout(resolve, 0));
  sync.stop();
  store.clear();
  answer!(new Response(JSON.stringify({ version: 2 }), { status: 200 }));
  await sync.settle();
  assert.equal(store.get(CLOUD_META_KEY), undefined);
});

test('the save another account left in this browser is recognised as not this account\'s', async () => {
  const { holdsOtherAccountSave } = await import('../app/cloud-sync.ts');
  store.clear();
  assert.equal(holdsOtherAccountSave('b'), false, 'a save without an account may be taken over');
  writeCloudMeta({ userId: 'a', version: 3, hash: 'x' });
  assert.equal(holdsOtherAccountSave('a'), false);
  assert.equal(holdsOtherAccountSave('b'), true);
});

test('an upload stopped while it compresses writes nothing back', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(70));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ version: 2 }), { status: 200 }); }) as typeof fetch;
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  sync.stop();
  store.clear();
  await sync.settle();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 0);
  assert.equal(store.get(CLOUD_META_KEY), undefined);
});

test('uploads go out gzipped and the server reads them', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(90));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  const cloud = server(1, {});
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  sync.stop();
  assert.ok(cloud.gzipped >= 1);
  assert.equal(goalsIn(cloud.keys[STORAGE_KEY]), 90);
});

// ---- Save integrity (audit B02, B03, R01, R02, R03, R04) ------------------------------------------------------

const { applyCloudSave, subscribeSyncStatus, reportSyncProblem, STORAGE_FULL_MESSAGE, SAVE_TOO_LARGE_MESSAGE, NEWER_VERSION_MESSAGE } = await import('../app/cloud-sync.ts');
const { BACKUP_STORAGE_KEY } = await import('../app/game/constants.ts');
const { GAME_FEATURES_SCHEMA_VERSION } = await import('../app/feature-data.ts');

const gameWith = (goals: number, extra: Record<string, unknown> = {}) => JSON.stringify({ goals, totalGoals: goals, clicks: goals, seasons: 1, stars: 2, ...extra });
type Sent = { baseVersion: number; keys: Record<string, string>; schemaVersion?: number; keepalive: boolean; gzipped: boolean; bytes: number };

/** A scripted /api/save: `answer` decides the response for each PUT; every request body is recorded. */
function scripted(answer: (body: Sent, index: number) => { status: number; body: Record<string, unknown> }) {
  const sent: Sent[] = [];
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const gzipped = (init?.headers as Record<string, string> | undefined)?.['content-encoding'] === 'gzip';
    const raw = init!.body as Uint8Array | string;
    const text = gzipped ? gunzipSync(raw as Uint8Array).toString('utf8') : String(raw);
    const body = { ...(JSON.parse(text) as Omit<Sent, 'keepalive' | 'gzipped' | 'bytes'>), keepalive: init?.keepalive === true, gzipped, bytes: typeof raw === 'string' ? Buffer.byteLength(raw) : raw.byteLength };
    sent.push(body);
    const { status, body: answerBody } = answer(body, sent.length - 1);
    return new Response(JSON.stringify(answerBody), { status });
  }) as typeof fetch;
  return sent;
}

function watchStatus() {
  const seen = { status: '', message: null as string | null };
  const stop = subscribeSyncStatus((status, message) => { seen.status = status; seen.message = message; });
  return { seen, stop };
}

test('B02: a conflict without a cloud game (missing row) is never applied; the device creates the row again', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(400));
  store.set(BACKUP_STORAGE_KEY, game(390));
  writeCloudMeta({ userId: 'u', version: 6, hash: 'older' });
  const sent = scripted((body) => body.baseVersion === 0 ? { status: 200, body: { version: 1 } } : { status: 409, body: { errorCode: 'SAVE_CONFLICT', version: 0, keys: null, active: false, updatedAt: null } });
  let applied = false;
  const sync = new CloudSync('u', { onNewerSave: () => { applied = true; } });
  sync.start();
  await sync.settle();
  sync.stop();
  assert.equal(applied, false, 'the empty cloud answer was not loaded');
  assert.deepEqual(sent.map((item) => item.baseVersion), [6, 0], 're-created on base version 0');
  assert.equal(goalsIn(sent[1].keys[STORAGE_KEY]), 400);
  assert.equal(goalsIn(store.get(STORAGE_KEY)), 400, 'local game kept');
  assert.equal(goalsIn(store.get(BACKUP_STORAGE_KEY)), 390, 'local backup kept');
  assert.equal(readCloudMeta('u')!.version, 1);
});

test('B02: applyCloudSave refuses an answer without a game and leaves every local copy in place', () => {
  store.clear();
  store.set(STORAGE_KEY, game(400));
  store.set(BACKUP_STORAGE_KEY, game(390));
  assert.throws(() => applyCloudSave('u', { version: 0, updatedAt: null, active: false, keys: null }));
  assert.throws(() => applyCloudSave('u', { version: 3, updatedAt: null, active: true, keys: {} }));
  assert.equal(goalsIn(store.get(STORAGE_KEY)), 400);
  assert.equal(goalsIn(store.get(BACKUP_STORAGE_KEY)), 390);
});

test('R02: a cloud that went back behind this device (database restore) does not roll an unplayed device back', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(900));
  writeCloudMeta({ userId: 'u', version: 7, hash: 'older', played: false });
  const sent = scripted((body) => body.baseVersion === 3 ? { status: 200, body: { version: 4 } } : { status: 409, body: { errorCode: 'SAVE_CONFLICT', version: 3, keys: { [STORAGE_KEY]: game(500) }, active: true, activeVersion: 3, updatedAt: null } });
  let applied = false;
  const sync = new CloudSync('u', { onNewerSave: () => { applied = true; } });
  sync.start();
  await sync.settle();
  sync.stop();
  assert.equal(applied, false);
  assert.deepEqual(sent.map((item) => item.baseVersion), [7, 3], 'overwritten explicitly on top of the restored version');
  assert.equal(goalsIn(sent[1].keys[STORAGE_KEY]), 900);
  assert.equal(goalsIn(store.get(STORAGE_KEY)), 900);
});

test('R02: an older cloud version that holds more progress is still taken', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(100));
  writeCloudMeta({ userId: 'u', version: 7, hash: 'older', played: false });
  scripted(() => ({ status: 409, body: { errorCode: 'SAVE_CONFLICT', version: 3, keys: { [STORAGE_KEY]: game(5000) }, active: true, activeVersion: 3, updatedAt: null } }));
  let appliedGoals = 0;
  const sync = new CloudSync('u', { onNewerSave: (save) => { appliedGoals = goalsIn(save.keys?.[STORAGE_KEY]); } });
  sync.start();
  await sync.settle();
  sync.stop();
  assert.equal(appliedGoals, 5000);
});

test('B03: a full storage while loading the newer cloud save keeps the old game, stops uploading it and says why', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(80));
  writeCloudMeta({ userId: 'u', version: 4, hash: 'older', played: false });
  const sent = scripted(() => ({ status: 409, body: { errorCode: 'SAVE_CONFLICT', version: 5, keys: { [STORAGE_KEY]: game(300) }, active: true, activeVersion: 5, updatedAt: null } }));
  const { seen, stop } = watchStatus();
  const realSet = localStorage.setItem;
  // What account-gate does: apply inside try/catch, report the problem, never reload or upload.
  const sync = new CloudSync('u', { onNewerSave: (save) => {
    localStorage.setItem = (key: string, value: string) => { if (key === STORAGE_KEY && value.includes('300')) throw new DOMException('Quota exceeded', 'QuotaExceededError'); store.set(key, value); };
    try { applyCloudSave('u', save); } catch { reportSyncProblem(STORAGE_FULL_MESSAGE); } finally { localStorage.setItem = realSet; }
  } });
  sync.start();
  await sync.settle();
  assert.equal(goalsIn(store.get(STORAGE_KEY)), 80, 'the previous game is back');
  assert.deepEqual([seen.status, seen.message], ['failed', STORAGE_FULL_MESSAGE]);
  // The sync stopped: the older local game is not uploaded over the newer cloud save afterwards.
  store.set(STORAGE_KEY, game(81));
  assert.equal(await sync.upload(), false);
  assert.equal(sent.length, 1);
  stop();
});

test('R03: a save above the cloud limit is not sent, shown as failed (not offline) and not retried every minute', async () => {
  store.clear();
  store.set(STORAGE_KEY, gameWith(10, { filler: 'x'.repeat(2 * 1024 * 1024 + 8192) }));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  const sent = scripted(() => ({ status: 200, body: { version: 2 } }));
  const { seen, stop } = watchStatus();
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  assert.equal(sent.length, 0);
  assert.deepEqual([seen.status, seen.message], ['failed', SAVE_TOO_LARGE_MESSAGE]);
  sync.stop();
  stop();
});

test('R03: a 413 answer is a failed save with a clear message, and the same save is not sent again', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(10));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  const sent = scripted(() => ({ status: 413, body: { error: 'too large' } }));
  const { seen, stop } = watchStatus();
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  assert.equal(await sync.upload(), false);
  assert.equal(sent.length, 1);
  assert.deepEqual([seen.status, seen.message], ['failed', SAVE_TOO_LARGE_MESSAGE]);
  sync.stop();
  stop();
});

const bigGame = (goals: number) => gameWith(goals, { history: Array.from({ length: 4000 }, (_, i) => ({ id: `match-${i % 50}`, goals: i % 7, text: 'Tor durch den Mittelstürmer' })) });

test('R04: the upload when the page closes is gzipped so a large save still fits into keepalive', async () => {
  store.clear();
  // Well above the 60 KB keepalive limit uncompressed.
  store.set(STORAGE_KEY, bigGame(10));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  const sent = scripted((_body, index) => ({ status: 200, body: { version: 2 + index } }));
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  store.set(STORAGE_KEY, bigGame(11));
  window.dispatchEvent(new Event('pagehide'));
  await new Promise((resolve) => setTimeout(resolve, 50));
  await sync.settle();
  sync.stop();
  const last = sent.at(-1)!;
  assert.ok(Buffer.byteLength(JSON.stringify(last.keys)) > 60 * 1024);
  assert.equal(last.gzipped, true);
  assert.ok(last.bytes < 60 * 1024, `gzipped body ${last.bytes} bytes`);
  assert.equal(last.keepalive, true);
});

test('R04: a small save is sent at once with keepalive when the page closes', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(10));
  writeCloudMeta({ userId: 'u', version: 1, hash: 'other' });
  const sent = scripted((_body, index) => ({ status: 200, body: { version: 2 + index } }));
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  store.set(STORAGE_KEY, game(11));
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(sent.at(-1)!.keepalive, true, 'sent synchronously, before the page is gone');
  assert.equal(sent.at(-1)!.gzipped, false);
  await sync.settle();
  sync.stop();
});

test('R01: a save from a newer game version is never uploaded from this (older) client', async () => {
  store.clear();
  store.set(STORAGE_KEY, gameWith(10, { features: { schemaVersion: GAME_FEATURES_SCHEMA_VERSION + 1, futureField: 'kept' } }));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  const sent = scripted(() => ({ status: 200, body: { version: 2 } }));
  const { seen, stop } = watchStatus();
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  assert.equal(sent.length, 0);
  assert.deepEqual([seen.status, seen.message], ['failed', NEWER_VERSION_MESSAGE]);
  assert.ok(store.get(STORAGE_KEY)!.includes('futureField'), 'the newer save stays untouched');
  sync.stop();
  stop();
});

test('R01: a played device never overwrites a newer-version cloud save and does not load it either', async () => {
  store.clear();
  store.set(STORAGE_KEY, game(10));
  writeCloudMeta({ userId: 'u', version: 4, hash: '', played: true });
  const sent = scripted(() => ({ status: 409, body: { errorCode: 'SAVE_CONFLICT', version: 5, keys: { [STORAGE_KEY]: gameWith(20, { features: { schemaVersion: GAME_FEATURES_SCHEMA_VERSION + 1 } }) }, active: false, activeVersion: 4, updatedAt: null } }));
  let applied = false;
  const sync = new CloudSync('u', { onNewerSave: () => { applied = true; } });
  sync.start();
  window.dispatchEvent(new Event('pointerdown'));
  await sync.settle();
  assert.equal(applied, false);
  assert.equal(sent.length, 1, 'no overwrite followed');
  assert.equal(await sync.upload(), false, 'the sync stays stopped');
  sync.stop();
});

test('R01: the upload names its schema version, and the server refusal for a newer stored save stops the sync', async () => {
  store.clear();
  store.set(STORAGE_KEY, gameWith(10, { features: { schemaVersion: GAME_FEATURES_SCHEMA_VERSION } }));
  writeCloudMeta({ userId: 'u', version: 1, hash: '' });
  const sent = scripted(() => ({ status: 409, body: { errorCode: 'SAVE_SCHEMA_NEWER', schemaVersion: GAME_FEATURES_SCHEMA_VERSION + 1 } }));
  const { seen, stop } = watchStatus();
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await sync.settle();
  assert.equal(sent[0].schemaVersion, GAME_FEATURES_SCHEMA_VERSION);
  assert.deepEqual([seen.status, seen.message], ['failed', NEWER_VERSION_MESSAGE]);
  assert.equal(sent.length, 1);
  sync.stop();
  stop();
});

test('older saves (no schema version, or below the current one) still sync normally', async () => {
  for (const features of [undefined, { schemaVersion: 5 }, { schemaVersion: GAME_FEATURES_SCHEMA_VERSION - 1 }]) {
    store.clear();
    store.set(STORAGE_KEY, gameWith(42, features ? { features } : {}));
    writeCloudMeta({ userId: 'u', version: 1, hash: '' });
    const sent = scripted(() => ({ status: 200, body: { version: 2 } }));
    const sync = new CloudSync('u', { onNewerSave: () => {} });
    sync.start();
    assert.equal(await sync.upload(), true);
    sync.stop();
    assert.equal(sent.length, 1);
    // The upload announces the schema this client writes (at least), never 0: the server would refuse it for good otherwise.
    assert.equal(sent[0].schemaVersion, Math.max(GAME_FEATURES_SCHEMA_VERSION, features?.schemaVersion ?? 0));
    assert.equal(goalsIn(sent[0].keys[STORAGE_KEY]), 42);
  }
});
