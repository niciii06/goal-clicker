import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { authMode, safeReturnPath } from '../app/auth/config.ts';
import { clearAccountCacheForTests, resolvePlayer } from '../app/auth/player.ts';
import { applySaveFile, createSaveFile, parseSaveFile, PRE_IMPORT_BACKUP_KEY, savedPlayerId } from '../app/save-file.ts';

const ENV_KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VERCEL', 'AUTH_REQUIRED'];
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  clearAccountCacheForTests();
});
afterEach(() => {
  for (const key of ENV_KEYS) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
});
function configure() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
}

const request = new Request('http://localhost/api/multiplayer');
type ErrorBody = { errorCode?: string; playerId?: string };
const bodyOf = async (r: Awaited<ReturnType<typeof resolvePlayer>>) => (r.ok ? {} : await r.response.json()) as ErrorBody;
function deps(user: { id: string; email: string | null } | null, accounts = new Map<string, string>()) {
  return {
    getUser: async () => user,
    getAccount: async (userId: string) => accounts.has(userId) ? { playerId: accounts.get(userId)! } : null,
    linkAccount: async (userId: string, playerId: string) => {
      if ([...accounts.values()].includes(playerId)) return accounts.has(userId) ? { playerId: accounts.get(userId)! } : null;
      if (!accounts.has(userId)) accounts.set(userId, playerId);
      return { playerId: accounts.get(userId)! };
    },
  };
}

test('without Supabase keys local development stays anonymous, a deployment refuses', async () => {
  assert.equal(authMode(), 'anonymous');
  assert.deepEqual(await resolvePlayer(request, 'player-local-1', { loginRequired: true }), { ok: true, playerId: 'player-local-1', userId: null });
  process.env.VERCEL = '1';
  assert.equal(authMode(), 'misconfigured');
  const refused = await resolvePlayer(request, 'player-local-1', { loginRequired: false });
  assert.equal(refused.ok, false);
  assert.equal(!refused.ok && refused.response.status, 503);
  configure();
  assert.equal(authMode(), 'supabase');
});

test('multiplayer needs a login, solo play does not', async () => {
  configure();
  const anonymous = await resolvePlayer(request, 'player-solo-12', { loginRequired: true }, deps(null));
  assert.equal(!anonymous.ok && anonymous.response.status, 401);
  assert.equal((await bodyOf(anonymous)).errorCode, 'LOGIN_REQUIRED');
  assert.deepEqual(await resolvePlayer(request, 'player-solo-12', { loginRequired: false }, deps(null)), { ok: true, playerId: 'player-solo-12', userId: null });
});

test('the first login links the device player ID, later devices get the account ID', async () => {
  configure();
  const accounts = new Map<string, string>();
  const first = await resolvePlayer(request, 'old-player-from-save', { loginRequired: true }, deps({ id: 'user-1', email: 'a@example.com' }, accounts));
  assert.deepEqual(first, { ok: true, playerId: 'old-player-from-save', userId: 'user-1' });
  clearAccountCacheForTests();
  const other = await resolvePlayer(request, 'fresh-device-id', { loginRequired: true }, deps({ id: 'user-1', email: 'a@example.com' }, accounts));
  assert.equal(!other.ok && other.response.status, 409);
  const body = await bodyOf(other);
  assert.equal(body.errorCode, 'PLAYER_MISMATCH');
  assert.equal(body.playerId, 'old-player-from-save');
});

test('a player ID that belongs to another account cannot be taken over', async () => {
  configure();
  const accounts = new Map([['owner', 'victim-player-id']]);
  const result = await resolvePlayer(request, 'victim-player-id', { loginRequired: true }, deps({ id: 'intruder', email: null }, accounts));
  assert.equal(!result.ok && result.response.status, 409);
  assert.equal((await bodyOf(result)).errorCode, 'PLAYER_TAKEN');
});

test('the multiplayer API answers 401 without a session once login is configured', async () => {
  configure();
  const { GET } = await import('../app/api/multiplayer/route.ts');
  const { MULTIPLAYER_PROTOCOL_VERSION } = await import('../app/multiplayer-protocol.ts');
  const response = await GET(new Request(`http://localhost/api/multiplayer?protocol=${MULTIPLAYER_PROTOCOL_VERSION}&playerId=someone-12345&list=1`));
  assert.equal(response.status, 401);
});

test('the OAuth callback and logout only redirect inside the site', async () => {
  configure();
  assert.equal(safeReturnPath('/?tab=club'), '/?tab=club');
  for (const evil of ['https://evil.example/', '//evil.example', '/auth/callback', 'javascript:alert(1)', null]) assert.equal(safeReturnPath(evil), '/');
  const { GET } = await import('../app/auth/callback/route.ts');
  const missing = await GET(new Request('http://localhost/auth/callback?next=https://evil.example'));
  assert.equal(missing.status, 303);
  assert.equal(missing.headers.get('location'), 'http://localhost/?login=abgebrochen');
  const { POST } = await import('../app/auth/signout/route.ts');
  const foreign = await POST(new Request('http://localhost/auth/signout', { method: 'POST', headers: { origin: 'https://evil.example' } }));
  assert.equal(foreign.status, 403);
  const own = await POST(new Request('http://localhost/auth/signout', { method: 'POST', headers: { origin: 'http://localhost' } }));
  assert.equal(own.status, 303);
  assert.equal(own.headers.get('location'), 'http://localhost/');
});

class MemoryStorage {
  private data = new Map<string, string>();
  constructor(entries: Record<string, string> = {}) { for (const [k, v] of Object.entries(entries)) this.data.set(k, v); }
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
  snapshot() { return Object.fromEntries(this.data); }
}

test('a save file carries every goalClicker key and restores it on another address', () => {
  const old = new MemoryStorage({ goalClickerSiteSaveV3: JSON.stringify({ goals: 42 }), goalClickerPlayerIdV3: 'old-player-from-save', goalClickerLayoutV3: '[]', otherApp: 'x' });
  const file = createSaveFile(old, 'https://old.example', new Date('2026-10-21T10:00:00Z'));
  assert.deepEqual(Object.keys(file.keys).sort(), ['goalClickerLayoutV3', 'goalClickerPlayerIdV3', 'goalClickerSiteSaveV3']);
  const parsed = parseSaveFile(JSON.stringify(file));
  assert.ok(parsed.ok);
  assert.equal(savedPlayerId(parsed.file), 'old-player-from-save');
  const fresh = new MemoryStorage({ goalClickerSiteSaveV3: JSON.stringify({ goals: 1 }), goalClickerPlayerIdV3: 'fresh-device-id', otherApp: 'keep' });
  applySaveFile(fresh, parsed.file);
  const after = fresh.snapshot();
  assert.equal(after.goalClickerPlayerIdV3, 'old-player-from-save');
  assert.equal(JSON.parse(after.goalClickerSiteSaveV3).goals, 42);
  assert.equal(after.otherApp, 'keep');
  assert.equal(JSON.parse(after[PRE_IMPORT_BACKUP_KEY]).goalClickerPlayerIdV3, 'fresh-device-id');
});

test('broken or foreign files are rejected before anything is replaced', () => {
  assert.equal(parseSaveFile('nope').ok, false);
  assert.equal(parseSaveFile(JSON.stringify({ format: 'other' })).ok, false);
  assert.equal(parseSaveFile(JSON.stringify({ format: 'goal-clicker-save', version: 1, keys: { goalClickerPlayerIdV3: 'x' } })).ok, false);
  assert.equal(parseSaveFile(JSON.stringify({ format: 'goal-clicker-save', version: 1, keys: { goalClickerSiteSaveV3: '{broken' } })).ok, false);
  assert.equal(parseSaveFile(JSON.stringify({ format: 'goal-clicker-save', version: 1, keys: { goalClickerSiteSaveV3: '{}', evil: 'x' } })).ok, false);
});
