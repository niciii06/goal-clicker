// CloudSync in a minimal browser: memory localStorage, an event target as window and a scripted /api/save.
import assert from 'node:assert/strict';
import test from 'node:test';

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
  const state = { version: initialVersion, keys: initialKeys, loseNextAnswer: false, requests: 0 };
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    state.requests++;
    const body = JSON.parse(String(init?.body)) as { baseVersion: number; keys: Record<string, string> };
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
  let answer!: (response: Response) => void;
  globalThis.fetch = (() => new Promise<Response>((resolve) => { answer = resolve; })) as typeof fetch;
  const sync = new CloudSync('u', { onNewerSave: () => {} });
  sync.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  sync.stop();
  store.clear();
  answer(new Response(JSON.stringify({ version: 2 }), { status: 200 }));
  await sync.settle();
  assert.equal(store.get(CLOUD_META_KEY), undefined);
});
