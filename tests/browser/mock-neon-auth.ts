// A stand-in for Neon Auth (Managed Better Auth) for the account browser test, with the endpoints the game and
// the @neon/auth SDK use, a fake Google consent page, and the old Supabase password endpoint the TEMPORARY recovery
// bridge calls. Sessions are opaque tokens in __Secure-neon-auth.session_token, like the real service.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';

type User = { id: string; email: string; name: string; password: string | null; google: string | null; createdAt: string };
type Pending = { challenge: string; callbackURL: string; errorCallbackURL: string; linkUser: string | null; sub: string | null };

const COOKIE = '__Secure-neon-auth.session_token';
const CHALLENGE = '__Secure-neon-auth.session_challenge';

export function startMockNeonAuth(port: number) {
  const origin = `http://127.0.0.1:${port}`;
  const base = '/neondb/auth';
  const users = new Map<string, User>();
  const sessions = new Map<string, { userId: string; expiresAt: number }>();
  const pending = new Map<string, Pending>();
  const verifiers = new Map<string, { challenge: string; userId: string }>();
  /** The Google account the next visit of the fake consent page signs in with. */
  const google = { nextSub: '', nextEmail: '' };
  /** The old Supabase project: login address → user ID and password (TEMPORARY bridge). */
  const legacy = new Map<string, { id: string; password: string }>();
  const log: string[] = [];

  const cookies = (request: IncomingMessage) => new Map((request.headers.cookie ?? '').split(';').map((part) => part.trim().split('=')).filter((pair) => pair.length >= 2).map(([name, ...value]) => [name, value.join('=')]));
  const sessionUser = (request: IncomingMessage) => {
    const token = cookies(request).get(COOKIE);
    const session = token ? sessions.get(token) : undefined;
    return session && session.expiresAt > Date.now() ? { token: token!, user: users.get(session.userId) ?? null } : null;
  };
  const newSession = (userId: string) => {
    const token = randomBytes(24).toString('base64url');
    sessions.set(token, { userId, expiresAt: Date.now() + 7 * 86_400_000 });
    return { token, cookie: `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` };
  };
  const sessionBody = (token: string, user: User) => ({ session: { id: token.slice(0, 8), token, userId: user.id, expiresAt: new Date(sessions.get(token)!.expiresAt).toISOString() }, user: { id: user.id, email: user.email, name: user.name, emailVerified: Boolean(user.google), image: null, createdAt: user.createdAt, updatedAt: user.createdAt } });

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', origin);
    const send = (status: number, body: unknown, setCookies: string[] = []) => {
      response.writeHead(status, { 'content-type': 'application/json', ...(setCookies.length ? { 'set-cookie': setCookies } : {}) });
      response.end(JSON.stringify(body));
    };
    const redirect = (location: string) => { response.writeHead(302, { location }); response.end(); };
    const fail = (status: number, code: string, message = code) => send(status, { code, message });
    let raw = '';
    request.on('data', (chunk) => { raw += chunk; });
    request.on('end', () => {
      const body = raw ? JSON.parse(raw) as Record<string, string & boolean> : {};
      const path = url.pathname.startsWith(base) ? url.pathname.slice(base.length + 1) : url.pathname;
      log.push(`${request.method} ${path}`);
      // ---- the old Supabase project (TEMPORARY recovery bridge) ----
      if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
        const entry = legacy.get(String(body.email));
        if (!entry || entry.password !== body.password) return send(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return send(200, { access_token: `legacy-${randomUUID()}`, token_type: 'bearer', user: { id: entry.id } });
      }
      if (path === '/auth/v1/logout') return send(204, {});
      // ---- the fake Google consent page ----
      if (path === '/mock-google') {
        const state = pending.get(url.searchParams.get('state') ?? '');
        if (!state || !google.nextSub) return redirect(`${state?.errorCallbackURL ?? '/'}${state?.errorCallbackURL.includes('?') ? '&' : '?'}error=access_denied`);
        const sub = google.nextSub;
        let user = [...users.values()].find((u) => u.google === sub) ?? null;
        if (state.linkUser) {
          if (user && user.id !== state.linkUser) return redirect(`${state.errorCallbackURL}&error=account_already_linked_to_different_user`);
          user = users.get(state.linkUser)!;
          user.google = sub;
        } else if (!user) {
          user = { id: randomUUID(), email: google.nextEmail || `${sub}@gmail.example`, name: 'Google Spieler', password: null, google: sub, createdAt: new Date().toISOString() };
          users.set(user.id, user);
        }
        const verifier = randomBytes(16).toString('hex');
        verifiers.set(verifier, { challenge: state.challenge, userId: user.id });
        const target = new URL(state.callbackURL);
        target.searchParams.set('neon_auth_session_verifier', verifier);
        return redirect(target.toString());
      }
      if (path === 'get-session') {
        const verifier = url.searchParams.get('neon_auth_session_verifier');
        if (verifier) {
          const entry = verifiers.get(verifier);
          verifiers.delete(verifier);
          if (!entry || cookies(request).get(CHALLENGE) !== entry.challenge) return send(401, { code: 'INVALID_VERIFIER' });
          const { token, cookie } = newSession(entry.userId);
          return send(200, sessionBody(token, users.get(entry.userId)!), [cookie, `${CHALLENGE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
        }
        const current = sessionUser(request);
        return send(200, current?.user ? sessionBody(current.token, current.user) : null);
      }
      if (path === 'sign-up/email') {
        if ([...users.values()].some((u) => u.email === body.email)) return fail(422, 'USER_ALREADY_EXISTS');
        if (String(body.password).length < 8) return fail(400, 'PASSWORD_TOO_SHORT');
        const user: User = { id: randomUUID(), email: String(body.email), name: String(body.name ?? ''), password: String(body.password), google: null, createdAt: new Date().toISOString() };
        users.set(user.id, user);
        const { token, cookie } = newSession(user.id);
        return send(200, { token, user: { id: user.id, email: user.email, name: user.name } }, [cookie]);
      }
      if (path === 'sign-in/email') {
        const user = [...users.values()].find((u) => u.email === body.email);
        if (!user || user.password === null || user.password !== body.password) return fail(401, 'INVALID_EMAIL_OR_PASSWORD');
        const { token, cookie } = newSession(user.id);
        return send(200, { token, user: { id: user.id, email: user.email, name: user.name } }, [cookie]);
      }
      if (path === 'sign-in/social' || path === 'link-social') {
        const current = sessionUser(request);
        if (path === 'link-social' && !current?.user) return fail(401, 'UNAUTHORIZED');
        const state = randomUUID();
        const challenge = randomBytes(16).toString('hex');
        pending.set(state, { challenge, callbackURL: String(body.callbackURL), errorCallbackURL: String(body.errorCallbackURL ?? body.callbackURL), linkUser: path === 'link-social' ? current!.user!.id : null, sub: null });
        return send(200, { url: `${origin}/mock-google?state=${state}`, redirect: true }, [`${CHALLENGE}=${challenge}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`]);
      }
      const current = sessionUser(request);
      if (path === 'sign-out') {
        if (current) sessions.delete(current.token);
        return send(200, { success: true }, [`${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
      }
      if (!current?.user) return fail(401, 'UNAUTHORIZED');
      const user = current.user;
      if (path === 'list-accounts') return send(200, [...(user.password !== null ? [{ id: `cred-${user.id}`, providerId: 'credential', accountId: user.id, userId: user.id }] : []), ...(user.google ? [{ id: `g-${user.id}`, providerId: 'google', accountId: user.google, userId: user.id }] : [])]);
      if (path === 'unlink-account') {
        if (body.providerId === 'google') user.google = null;
        return send(200, { status: true });
      }
      if (path === 'change-password') {
        if (user.password !== body.currentPassword) return fail(400, 'INVALID_PASSWORD');
        user.password = String(body.newPassword);
        if (body.revokeOtherSessions) for (const [token, session] of sessions) if (session.userId === user.id && token !== current.token) sessions.delete(token);
        return send(200, { token: null });
      }
      if (path === 'delete-user') {
        users.delete(user.id);
        for (const [token, session] of sessions) if (session.userId === user.id) sessions.delete(token);
        return send(200, { success: true, message: 'User deleted' });
      }
      return fail(404, 'NOT_FOUND', `No mock for ${request.method} ${path}`);
    });
  });
  server.listen(port, '127.0.0.1');
  return { server, users, sessions, google, legacy, log, baseUrl: `${origin}${base}`, origin, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}
