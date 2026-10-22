// A small stand-in for Supabase Auth (GoTrue) for the account browser test: login codes are always the
// code below, mails are never sent, and the access tokens are real ES256 JWTs that the app verifies through
// the JWKS endpoint exactly like with Supabase.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';

export const MOCK_CODE = '123456';

type MockUser = { id: string; email: string; password: string | null; confirmed: boolean; createdAt: string };

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

export function startMockAuth(port: number) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const kid = randomUUID();
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig', key_ops: ['verify'] };
  const users = new Map<string, MockUser>();
  const refreshTokens = new Map<string, string>();
  const issuer = `http://127.0.0.1:${port}/auth/v1`;
  const mails: { email: string; type: string }[] = [];

  function jwt(user: MockUser) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid }));
    const payload = base64url(JSON.stringify({ iss: issuer, sub: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, exp: now + 3600, iat: now, aal: 'aal1', session_id: randomUUID(), is_anonymous: false }));
    const signature = sign('sha256', Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
    return `${header}.${payload}.${base64url(signature)}`;
  }

  function userJson(user: MockUser) {
    return { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, email_confirmed_at: user.confirmed ? user.createdAt : null, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [{ id: user.id, user_id: user.id, provider: 'email', identity_id: user.id, identity_data: { email: user.email, sub: user.id }, created_at: user.createdAt }], created_at: user.createdAt, updated_at: user.createdAt };
  }

  function session(user: MockUser) {
    const refresh = randomUUID();
    refreshTokens.set(refresh, user.email);
    return { access_token: jwt(user), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: refresh, user: userJson(user) };
  }

  function userFor(email: string, create: boolean) {
    const key = email.toLowerCase();
    let user = users.get(key);
    if (!user && create) {
      user = { id: randomUUID(), email: key, password: null, confirmed: false, createdAt: new Date().toISOString() };
      users.set(key, user);
    }
    return user ?? null;
  }

  function fromBearer(request: IncomingMessage) {
    const token = (request.headers.authorization ?? '').replace(/^Bearer /, '');
    try {
      const { sub } = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { sub?: string };
      return [...users.values()].find((user) => user.id === sub) ?? null;
    } catch {
      return null;
    }
  }

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const send = (status: number, body?: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': request.headers.origin ?? '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS' });
      response.end(body === undefined ? '' : JSON.stringify(body));
    };
    const fail = (status: number, code: string, msg: string) => send(status, { code, error_code: code, msg, message: msg });
    if (request.method === 'OPTIONS') return send(204);
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      const body = raw ? JSON.parse(raw) as Record<string, string> : {};
      const url = new URL(request.url ?? '/', issuer);
      const path = url.pathname.replace(/^\/auth\/v1/, '');
      if (path === '/.well-known/jwks.json') return send(200, { keys: [jwk] });
      if (path === '/otp') { userFor(body.email, true); mails.push({ email: body.email, type: 'email' }); return send(200, {}); }
      if (path === '/signup') {
        const existing = userFor(body.email, false);
        if (existing?.confirmed) return send(200, { ...userJson(existing), identities: [] });
        const user = userFor(body.email, true)!;
        user.password = body.password;
        mails.push({ email: user.email, type: 'signup' });
        return send(200, userJson(user));
      }
      if (path === '/resend' || path === '/recover') { mails.push({ email: body.email, type: path === '/recover' ? 'recovery' : body.type }); return send(200, {}); }
      if (path === '/verify') {
        const user = userFor(body.email, false);
        if (!user || body.token !== MOCK_CODE) return fail(403, 'otp_expired', 'Token has expired or is invalid');
        user.confirmed = true;
        return send(200, session(user));
      }
      if (path === '/token' && url.searchParams.get('grant_type') === 'password') {
        const user = userFor(body.email, false);
        if (!user || user.password !== body.password) return fail(400, 'invalid_credentials', 'Invalid login credentials');
        if (!user.confirmed) return fail(400, 'email_not_confirmed', 'Email not confirmed');
        return send(200, session(user));
      }
      if (path === '/token' && url.searchParams.get('grant_type') === 'refresh_token') {
        const email = refreshTokens.get(body.refresh_token);
        const user = email ? userFor(email, false) : null;
        return user ? send(200, session(user)) : fail(400, 'refresh_token_not_found', 'Invalid Refresh Token');
      }
      if (path === '/user') {
        const user = fromBearer(request);
        if (!user) return fail(401, 'bad_jwt', 'invalid JWT');
        if (request.method === 'PUT' && body.password) user.password = body.password;
        return send(200, userJson(user));
      }
      if (path === '/logout') return send(204);
      return fail(404, 'not_found', `No mock for ${request.method} ${path}`);
    });
  });
  server.listen(port, '127.0.0.1');
  return { server, mails, users, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
