import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { authMode, safeReturnPath } from '../app/auth/config.ts';
import { clearAccountCacheForTests, resolvePlayer } from '../app/auth/player.ts';
import type { AccountResolution } from '../app/auth/identity.ts';
import { AuthUnavailableError, browserSetCookies } from '../app/auth/server.ts';
import type { AuthSession } from '../app/auth/server.ts';

const ENV_KEYS = ['NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET', 'VERCEL', 'NETLIFY', 'SITE_ID', 'AWS_LAMBDA_FUNCTION_NAME', 'AUTH_REQUIRED', 'GOAL_CLICKER_HOSTED_BUILD'];
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
  // A port nobody listens on: a test that would really call Neon Auth fails instead of reaching the internet.
  process.env.NEON_AUTH_BASE_URL = 'http://127.0.0.1:9/neondb/auth';
  process.env.NEON_AUTH_COOKIE_SECRET = 'test-cookie-secret-with-32-characters!';
}

const request = new Request('http://localhost/api/multiplayer');
type ErrorBody = { errorCode?: string; playerId?: string };
const bodyOf = async (r: Awaited<ReturnType<typeof resolvePlayer>>) => (r.ok ? {} : await r.response.json()) as ErrorBody;
const session = (subject: string): AuthSession => ({ issuer: 'https://auth.example', subject, email: null, name: '', sessionCookie: `__Secure-neon-auth.session_token=${subject}` });

/** Logins (subject) → game accounts, and game accounts → player IDs. */
function deps(signedIn: string | null, identities = new Map<string, string>(), links = new Map<string, string>(), { revoked = false } = {}) {
  return {
    getSession: async (_request: Request, options?: { fresh?: boolean }) => signedIn && !(options?.fresh && revoked) ? session(signedIn) : null,
    lookupAccount: async (login: AuthSession): Promise<AccountResolution> => identities.has(login.subject) ? { ok: true, accountId: identities.get(login.subject)!, method: 'google', created: false } : { ok: false, status: 409, errorCode: 'ACCOUNT_SETUP_REQUIRED', error: 'setup' },
    getPlayerLink: async (accountId: string) => links.has(accountId) ? { playerId: links.get(accountId)! } : null,
    linkPlayer: async (accountId: string, playerId: string) => {
      if ([...links.values()].includes(playerId)) return links.has(accountId) ? { playerId: links.get(accountId)! } : null;
      if (!links.has(accountId)) links.set(accountId, playerId);
      return { playerId: links.get(accountId)! };
    },
    isPlayerLinked: async (playerId: string) => [...links.values()].includes(playerId),
  };
}

test('without auth settings local development stays anonymous, a host refuses', async () => {
  assert.equal(authMode(), 'anonymous');
  assert.deepEqual(await resolvePlayer(request, 'player-local-1', { loginRequired: true }), { ok: true, playerId: 'player-local-1', accountId: null });
  for (const host of ['VERCEL', 'NETLIFY']) {
    process.env[host] = '1';
    assert.equal(authMode(), 'misconfigured');
    const refused = await resolvePlayer(request, 'player-local-1', { loginRequired: false });
    assert.equal(!refused.ok && refused.response.status, 503);
    assert.equal((await bodyOf(refused)).errorCode, 'AUTH_NOT_CONFIGURED');
    delete process.env[host];
  }
  configure();
  assert.equal(authMode(), 'neon');
  // A broken secret is not "no login": it refuses instead of trusting claimed player IDs.
  process.env.NEON_AUTH_COOKIE_SECRET = 'short';
  const refused = await resolvePlayer(request, 'player-local-1', { loginRequired: false });
  assert.equal(!refused.ok && refused.response.status, 503);
});

test('multiplayer needs a login, solo play does not', async () => {
  configure();
  const anonymous = await resolvePlayer(request, 'player-solo-12', { loginRequired: true }, deps(null));
  assert.equal(!anonymous.ok && anonymous.response.status, 401);
  assert.equal((await bodyOf(anonymous)).errorCode, 'LOGIN_REQUIRED');
  assert.deepEqual(await resolvePlayer(request, 'player-solo-12', { loginRequired: false }, deps(null)), { ok: true, playerId: 'player-solo-12', accountId: null });
});

test('a guest plays solo with its own player ID, but never with the ID of an account', async () => {
  configure();
  const links = new Map([['account-1', 'account-player-1']]);
  assert.deepEqual(await resolvePlayer(request, 'guest-player-1', { loginRequired: false }, deps(null, new Map(), links)), { ok: true, playerId: 'guest-player-1', accountId: null });
  const refused = await resolvePlayer(request, 'account-player-1', { loginRequired: false }, deps(null, new Map(), links));
  assert.equal(!refused.ok && refused.response.status, 401);
});

test('the login opens its game account, and the account (not the login) owns the player ID', async () => {
  configure();
  const identities = new Map([['neon-user-1', 'account-1']]);
  const links = new Map<string, string>();
  const first = await resolvePlayer(request, 'old-player-from-save', { loginRequired: true }, deps('neon-user-1', identities, links));
  assert.deepEqual(first, { ok: true, playerId: 'old-player-from-save', accountId: 'account-1' });
  assert.deepEqual([...links], [['account-1', 'old-player-from-save']]);
  clearAccountCacheForTests();
  const other = await resolvePlayer(request, 'fresh-device-id', { loginRequired: true }, deps('neon-user-1', identities, links));
  assert.equal(!other.ok && other.response.status, 409);
  const body = await bodyOf(other);
  assert.equal(body.errorCode, 'PLAYER_MISMATCH');
  assert.equal(body.playerId, 'old-player-from-save');
});

test('a login without a game account is not let into worlds', async () => {
  configure();
  const result = await resolvePlayer(request, 'some-player-id', { loginRequired: true }, deps('neon-user-unbound'));
  assert.equal(!result.ok && result.response.status, 409);
  assert.equal((await bodyOf(result)).errorCode, 'ACCOUNT_SETUP_REQUIRED');
});

test('a player ID that belongs to another account cannot be taken over', async () => {
  configure();
  const identities = new Map([['neon-intruder', 'account-intruder']]);
  const links = new Map([['account-owner', 'victim-player-id']]);
  const result = await resolvePlayer(request, 'victim-player-id', { loginRequired: true }, deps('neon-intruder', identities, links));
  assert.equal(!result.ok && result.response.status, 409);
  assert.equal((await bodyOf(result)).errorCode, 'PLAYER_TAKEN');
});

test('a revoked session cannot create the first player link, even while it is still in the short cache', async () => {
  configure();
  const identities = new Map([['neon-user-1', 'account-1']]);
  const links = new Map<string, string>();
  const result = await resolvePlayer(request, 'new-player-id-1', { loginRequired: true }, deps('neon-user-1', identities, links, { revoked: true }));
  assert.equal(result.ok, false);
  assert.equal(links.size, 0);
});

test('Neon Auth being unreachable is a retryable 503, not a sign out', async () => {
  configure();
  const failing = { ...deps(null), getSession: async () => { throw new AuthUnavailableError(); } };
  const result = await resolvePlayer(request, 'player-1234', { loginRequired: true }, failing);
  assert.equal(!result.ok && result.response.status, 503);
  assert.equal((await bodyOf(result)).errorCode, 'AUTH_UNAVAILABLE');
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
  for (const evil of ['https://evil.example/', '//evil.example', '/\\evil.example', '/auth/callback', '/api/profile', 'javascript:alert(1)', null]) assert.equal(safeReturnPath(evil), '/');
  const { GET } = await import('../app/auth/callback/route.ts');
  const back = await GET(new Request('http://localhost/auth/callback?next=https://evil.example'));
  assert.equal(back.status, 303);
  assert.equal(back.headers.get('location'), 'http://localhost/');
  const cancelled = await GET(new Request('http://localhost/auth/callback?error=access_denied'));
  assert.equal(cancelled.headers.get('location'), 'http://localhost/?login=abgebrochen');
  // A verifier that the proxy could not exchange is a failed login, not a signed in one.
  const unexchanged = await GET(new Request('http://localhost/auth/callback?neon_auth_session_verifier=abc'));
  assert.equal(unexchanged.headers.get('location'), 'http://localhost/?login=fehler');
  const { POST } = await import('../app/auth/signout/route.ts');
  const foreign = await POST(new Request('http://localhost/auth/signout', { method: 'POST', headers: { origin: 'https://evil.example' } }));
  assert.equal(foreign.status, 403);
  const proxied = await GET(new Request('http://internal:3000/auth/callback?error=access_denied', { headers: { 'x-forwarded-host': 'goalglicker.netlify.app', 'x-forwarded-proto': 'https' } }));
  assert.equal(proxied.headers.get('location'), 'https://goalglicker.netlify.app/?login=abgebrochen');
  const spoofed = await GET(new Request('http://localhost/auth/callback?error=access_denied', { headers: { 'x-forwarded-host': 'evil.example/path' } }));
  assert.equal(spoofed.headers.get('location'), 'http://localhost/?login=abgebrochen');
  // Signing out clears every Neon Auth cookie of the browser, even when Neon Auth cannot be reached.
  const own = await POST(new Request('http://localhost/auth/signout', { method: 'POST', headers: { origin: 'http://localhost', cookie: '__Secure-neon-auth.session_token=abc; other=1' } }));
  assert.equal(own.status, 303);
  assert.equal(own.headers.get('location'), 'http://localhost/');
  assert.deepEqual(own.headers.getSetCookie(), ['__Secure-neon-auth.session_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']);
});

test('the return from linking Google reports to the game instead of the login screen', async () => {
  configure();
  const { GET } = await import('../app/auth/callback/route.ts');
  const taken = await GET(new Request('http://localhost/auth/callback?link=google&next=/club&error=account_already_linked_to_different_user'));
  assert.equal(taken.headers.get('location'), 'http://localhost/club?google=vergeben');
  const cancelled = await GET(new Request('http://localhost/auth/callback?link=google&next=/club&error=access_denied'));
  assert.equal(cancelled.headers.get('location'), 'http://localhost/club?google=abgebrochen');
  const evil = await GET(new Request('http://localhost/auth/callback?link=google&next=https://evil.example&failed=1'));
  assert.equal(evil.headers.get('location'), 'http://localhost/?google=fehler');
});

test('the auth proxy passes on only the calls the game uses', async () => {
  configure();
  const { GET, POST } = await import('../app/api/auth/[...path]/route.ts');
  const context = (path: string) => ({ params: Promise.resolve({ path: path.split('/') }) });
  for (const [method, path] of [['POST', 'sign-up/email'], ['POST', 'sign-in/email'], ['POST', 'delete-user'], ['POST', 'change-email'], ['POST', 'update-user'], ['GET', 'admin/list-users']] as const) {
    const handler = method === 'GET' ? GET : POST;
    const response = await handler(new Request(`http://localhost/api/auth/${path}`, { method, headers: { origin: 'http://localhost' } }), context(path));
    assert.equal(response.status, 404, path);
  }
  const crossSite = await POST(new Request('http://localhost/api/auth/sign-out', { method: 'POST', headers: { origin: 'https://evil.example' } }), context('sign-out'));
  assert.equal(crossSite.status, 403);
});

test('cookies from Neon Auth become first party cookies of this site', () => {
  assert.deepEqual(browserSetCookies(['__Secure-neon-auth.session_token=abc; Path=/; Domain=.neonauth.example; SameSite=None; Secure; Partitioned; HttpOnly; Max-Age=604800', 'tracking=1; Path=/']), ['__Secure-neon-auth.session_token=abc; Path=/; HttpOnly; Max-Age=604800; Secure; SameSite=Lax']);
});
