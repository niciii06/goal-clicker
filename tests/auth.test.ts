import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { authMode, safeReturnPath } from '../app/auth/config.ts';
import { clearAccountCacheForTests, resolvePlayer } from '../app/auth/player.ts';

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
    isPlayerLinked: async (playerId: string) => [...accounts.values()].includes(playerId),
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

test('a guest plays solo with its own player ID, but never with the ID of an account', async () => {
  configure();
  const accounts = new Map([['user-1', 'account-player-1']]);
  assert.deepEqual(await resolvePlayer(request, 'guest-player-1', { loginRequired: false }, deps(null, accounts)), { ok: true, playerId: 'guest-player-1', userId: null });
  const refused = await resolvePlayer(request, 'account-player-1', { loginRequired: false }, deps(null, accounts));
  assert.equal(!refused.ok && refused.response.status, 401);
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
  const proxied = await GET(new Request('http://internal:3000/auth/callback', { headers: { 'x-forwarded-host': 'goal-clicker.vercel.app', 'x-forwarded-proto': 'https' } }));
  assert.equal(proxied.headers.get('location'), 'https://goal-clicker.vercel.app/?login=abgebrochen');
  const spoofed = await GET(new Request('http://localhost/auth/callback', { headers: { 'x-forwarded-host': 'evil.example/path' } }));
  assert.equal(spoofed.headers.get('location'), 'http://localhost/?login=abgebrochen');
  const own = await POST(new Request('http://localhost/auth/signout', { method: 'POST', headers: { origin: 'http://localhost' } }));
  assert.equal(own.status, 303);
  assert.equal(own.headers.get('location'), 'http://localhost/');
});

test('the return from linking Google reports to the game instead of the login screen', async () => {
  configure();
  const { GET } = await import('../app/auth/callback/route.ts');
  const taken = await GET(new Request('http://localhost/auth/callback?link=google&next=/club&error=server_error&error_code=identity_already_exists'));
  assert.equal(taken.headers.get('location'), 'http://localhost/?google=vergeben');
  const cancelled = await GET(new Request('http://localhost/auth/callback?link=google&next=/club&error=access_denied'));
  assert.equal(cancelled.headers.get('location'), 'http://localhost/?google=abgebrochen');
  const evil = await GET(new Request('http://localhost/auth/callback?link=google&next=https://evil.example'));
  assert.equal(evil.headers.get('location'), 'http://localhost/?google=abgebrochen');
});

