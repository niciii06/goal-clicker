// In-memory stand-ins for the account tables and for Neon Auth, with the same rules as db/index.ts and the
// Better Auth endpoints the server uses. Every method finishes synchronously after its first await, like a
// single SQL statement or transaction, so concurrent calls interleave the way PostgreSQL would serialise them.
import type { AccountApiDeps } from '../../app/account-api.ts';
import type { AccountRecovery, AuthIdentity, CloudSave, LegacyIdentity, Profile } from '../../db/index.ts';
import type { AuthSession } from '../../app/auth/server.ts';
import type { NeonLogin } from '../../app/auth/neon-accounts.ts';

export const ISSUER = 'https://ep-test.neonauth.example/neondb/auth';

export function memoryStore() {
  const profiles = new Map<string, Profile>();
  const saves = new Map<string, CloudSave>();
  const identities: AuthIdentity[] = [];
  const legacy: LegacyIdentity[] = [];
  const recovery: AccountRecovery[] = [];
  const codes: { codeHash: string; accountId: string; issuer: string; expiresAt: string; usedAt: string | null; createdAt: string }[] = [];
  const playerLinks = new Map<string, string>();
  const tick = () => Promise.resolve();
  const store = {
    profiles, saves, identities, legacy, recovery, codes, playerLinks,
    getProfile: async (userId: string) => { await tick(); return profiles.get(userId) ?? null; },
    getProfileByUsername: async (key: string) => { await tick(); return [...profiles.values()].find((p) => p.usernameKey === key) ?? null; },
    isUsernameTaken: async (key: string, except?: string) => { await tick(); return [...profiles.values()].some((p) => p.usernameKey === key && p.userId !== except); },
    createProfile: async (userId: string, username: string, displayName: string, now: string, loginEmail: string | null = null) => {
      await tick();
      if ([...profiles.values()].some((p) => p.usernameKey === username.toLowerCase())) return { reason: 'taken' as const };
      if (profiles.has(userId)) return { reason: 'exists' as const };
      const profile = { userId, username, usernameKey: username.toLowerCase(), displayName, loginEmail, usernameChangedAt: now, createdAt: now, updatedAt: now };
      profiles.set(userId, profile);
      return { profile };
    },
    updateDisplayName: async (userId: string, displayName: string) => { await tick(); const p = profiles.get(userId); if (p) p.displayName = displayName; return p ?? null; },
    changeUsername: async (userId: string, username: string, now: string, cutoff: string) => {
      await tick();
      const p = profiles.get(userId);
      if (!p) return { reason: 'missing' as const };
      if (p.usernameKey === username.toLowerCase()) { p.username = username; return { profile: p }; }
      if ([...profiles.values()].some((o) => o.usernameKey === username.toLowerCase())) return { reason: 'taken' as const };
      if (p.usernameChangedAt > cutoff) return { reason: 'too-soon' as const };
      Object.assign(p, { username, usernameKey: username.toLowerCase(), usernameChangedAt: now });
      return { profile: p };
    },
    getCloudSave: async (userId: string) => { await tick(); return saves.get(userId) ?? null; },
    getCloudSaveSince: async (userId: string, since: number) => {
      await tick();
      const save = saves.get(userId);
      return save ? { ...save, saveJson: save.version > since ? save.saveJson : null } : null;
    },
    putCloudSave: async (userId: string, saveJson: string, baseVersion: number, now: string, active = true) => {
      await tick();
      const current = saves.get(userId);
      if ((current?.version ?? 0) !== baseVersion) return { conflict: current ?? null };
      const save = { userId, saveJson, version: baseVersion + 1, active, activeVersion: active ? baseVersion + 1 : current?.activeVersion ?? 0, updatedAt: now };
      saves.set(userId, save);
      return { save };
    },
    getIdentity: async (issuer: string, subject: string) => { await tick(); return identities.find((i) => i.issuer === issuer && i.subject === subject) ?? null; },
    getIdentityForAccount: async (issuer: string, accountId: string) => { await tick(); return identities.find((i) => i.issuer === issuer && i.accountId === accountId) ?? null; },
    bindIdentity: async (values: { issuer: string; subject: string; accountId: string; method: string; loginEmail?: string | null; createdAt: string }) => {
      await tick();
      const bySubject = identities.find((i) => i.issuer === values.issuer && i.subject === values.subject);
      if (bySubject) return bySubject.accountId === values.accountId && !bySubject.deletedAt ? { ok: true as const, identity: bySubject } : { ok: false as const, reason: 'subject-bound' as const };
      if (identities.some((i) => i.issuer === values.issuer && i.accountId === values.accountId)) return { ok: false as const, reason: 'account-bound' as const };
      if (values.loginEmail && identities.some((i) => i.loginEmail === values.loginEmail)) return { ok: false as const, reason: 'account-bound' as const };
      const identity = { issuer: values.issuer, subject: values.subject, accountId: values.accountId, method: values.method, loginEmail: values.loginEmail ?? null, deletedAt: null, createdAt: values.createdAt };
      identities.push(identity);
      return { ok: true as const, identity };
    },
    unbindIdentity: async (issuer: string, subject: string) => { await tick(); const index = identities.findIndex((i) => i.issuer === issuer && i.subject === subject); if (index >= 0) identities.splice(index, 1); },
    findLegacyIdentity: async (provider: string, providerSubject: string) => { await tick(); return legacy.find((l) => l.provider === provider && l.providerSubject === providerSubject) ?? null; },
    listLegacyIdentities: async (accountId: string) => { await tick(); return legacy.filter((l) => l.accountId === accountId); },
    accountExists: async (accountId: string) => { await tick(); return profiles.has(accountId); },
    openRecoveryClaim: async (values: { accountId: string; issuer: string; method: string; destinationEmail: string; claimExpiresAt: string; now: string }) => {
      await tick();
      let row = recovery.find((r) => r.accountId === values.accountId && r.issuer === values.issuer);
      if (!row) {
        row = { accountId: values.accountId, issuer: values.issuer, destinationEmail: values.destinationEmail, method: values.method, claimExpiresAt: values.claimExpiresAt, consumedAt: null, subject: null, createdAt: values.now, updatedAt: values.now };
        recovery.push(row);
      } else if (!row.consumedAt) Object.assign(row, { method: values.method, claimExpiresAt: values.claimExpiresAt, updatedAt: values.now });
      return { ...row };
    },
    rotateRecoveryDestination: async (accountId: string, issuer: string, destinationEmail: string, now: string) => {
      await tick();
      const row = recovery.find((r) => r.accountId === accountId && r.issuer === issuer && !r.consumedAt);
      if (!row) return null;
      Object.assign(row, { destinationEmail, updatedAt: now });
      return { ...row };
    },
    completeRecovery: async (values: { accountId: string; issuer: string; subject: string; loginEmail: string; method: string; now: string; codeHash?: string }) => {
      await tick();
      const claim = recovery.find((r) => r.accountId === values.accountId && r.issuer === values.issuer);
      if (!claim) return { ok: false as const, reason: 'no-claim' as const };
      if (claim.consumedAt) {
        const bound = identities.find((i) => i.issuer === values.issuer && i.subject === values.subject);
        return bound && bound.accountId === values.accountId && !bound.deletedAt ? { ok: true as const, identity: bound, already: true } : { ok: false as const, reason: 'consumed-by-other' as const };
      }
      if (!claim.claimExpiresAt || claim.claimExpiresAt <= values.now) return { ok: false as const, reason: 'expired' as const };
      if (claim.destinationEmail !== values.loginEmail) return { ok: false as const, reason: 'no-claim' as const };
      if (values.codeHash) {
        const code = codes.find((c) => c.codeHash === values.codeHash && c.accountId === values.accountId && c.issuer === values.issuer && !c.usedAt && c.expiresAt > values.now);
        if (!code) return { ok: false as const, reason: 'code-used' as const };
        code.usedAt = values.now;
      }
      if (identities.some((i) => i.issuer === values.issuer && i.accountId === values.accountId)) return { ok: false as const, reason: 'account-bound' as const };
      if (identities.some((i) => i.issuer === values.issuer && i.subject === values.subject)) return { ok: false as const, reason: 'subject-bound' as const };
      const identity = { issuer: values.issuer, subject: values.subject, accountId: values.accountId, method: values.method, loginEmail: values.loginEmail, deletedAt: null, createdAt: values.now };
      identities.push(identity);
      Object.assign(claim, { consumedAt: values.now, subject: values.subject, claimExpiresAt: null, updatedAt: values.now });
      return { ok: true as const, identity, already: false };
    },
    findRecoveryCode: async (codeHash: string, issuer: string, now: string) => { await tick(); return codes.find((c) => c.codeHash === codeHash && c.issuer === issuer && !c.usedAt && c.expiresAt > now) ?? null; },
    deleteAccountData: async (accountId: string, now: string) => {
      await tick();
      saves.delete(accountId);
      profiles.delete(accountId);
      playerLinks.delete(accountId);
      for (const list of [legacy, recovery, codes] as { accountId: string }[][]) for (let i = list.length - 1; i >= 0; i--) if (list[i].accountId === accountId) list.splice(i, 1);
      for (const identity of identities) if (identity.accountId === accountId && !identity.deletedAt) identity.deletedAt = now;
    },
    finishAccountDeletion: async (accountId: string) => { await tick(); for (let i = identities.length - 1; i >= 0; i--) if (identities[i].accountId === accountId) identities.splice(i, 1); },
  };
  return store;
}

export type MemoryStore = ReturnType<typeof memoryStore>;

/** A stand-in for Neon Auth: users with password and/or Google, sessions as cookies. */
export function fakeNeon() {
  let next = 0;
  const users = new Map<string, { id: string; email: string; password: string | null; name: string; google: string | null }>();
  const sessions = new Map<string, string>();
  const calls: string[] = [];
  const login = (userId: string): NeonLogin => {
    const token = `token-${++next}`;
    sessions.set(token, userId);
    const cookie = `__Secure-neon-auth.session_token=${token}`;
    return { ok: true, subject: userId, setCookies: [`${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax`], sessionCookie: cookie };
  };
  const neon = {
    users, sessions, calls,
    /** Fails the next N sign ups (simulating a Neon Auth outage at that moment). */
    failSignUps: 0,
    deleteWorks: true,
    signUp: async (email: string, password: string, name: string): Promise<NeonLogin> => {
      calls.push(`sign-up:${email}`);
      await Promise.resolve();
      if (neon.failSignUps > 0) { neon.failSignUps -= 1; return { ok: false, reason: 'rejected' }; }
      if ([...users.values()].some((u) => u.email === email)) return { ok: false, reason: 'exists' };
      const id = `neon-user-${++next}`;
      users.set(id, { id, email, password, name, google: null });
      return login(id);
    },
    signIn: async (email: string, password: string): Promise<NeonLogin> => {
      calls.push(`sign-in:${email}`);
      await Promise.resolve();
      const user = [...users.values()].find((u) => u.email === email);
      if (!user || user.password !== password) return { ok: false, reason: 'invalid' };
      return login(user.id);
    },
    signOut: async (sessionCookie: string) => { sessions.delete(sessionCookie.split('=')[1]); return []; },
    deleteUser: async (sessionCookie: string) => {
      const userId = sessions.get(sessionCookie.split('=')[1]);
      if (!userId || !neon.deleteWorks) return 'not-deleted' as const;
      users.delete(userId);
      for (const [token, owner] of sessions) if (owner === userId) sessions.delete(token);
      return 'deleted' as const;
    },
    /** A Google sign in: a new Neon user with a Google account (Neon creates one per Google sub). */
    googleLogin: (sub: string, email = `${sub}@gmail.example`) => {
      let user = [...users.values()].find((u) => u.google === sub);
      if (!user) { user = { id: `neon-user-${++next}`, email, password: null, name: 'Google Spieler', google: sub }; users.set(user.id, user); }
      return login(user.id);
    },
    session: (cookie: string): AuthSession | null => {
      const userId = sessions.get(cookie.split('=')[1]);
      const user = userId ? users.get(userId) : undefined;
      return user ? { issuer: ISSUER, subject: user.id, email: user.email, name: user.name, sessionCookie: cookie } : null;
    },
    listAccounts: async (session: AuthSession) => {
      const user = users.get(session.subject);
      if (!user) throw new Error('no user');
      return [...(user.password !== null ? [{ providerId: 'credential', accountId: user.id }] : []), ...(user.google ? [{ providerId: 'google', accountId: user.google }] : [])];
    },
    unlink: async (session: AuthSession, _origin: string, providerId: string) => {
      const user = users.get(session.subject);
      if (user && providerId === 'google') user.google = null;
      return true;
    },
  };
  return neon;
}

export type FakeNeon = ReturnType<typeof fakeNeon>;

export function cookieOf(request: Request) {
  const match = /__Secure-neon-auth\.session_token=([^;]+)/.exec(request.headers.get('cookie') ?? '');
  return match ? `__Secure-neon-auth.session_token=${match[1]}` : '';
}

/** AccountApiDeps wired to the memory store and the fake Neon Auth. */
export function accountDeps(store: MemoryStore, neon: FakeNeon, options: { now?: () => Date; legacy?: Record<string, { userId: string; password: string }>; legacyDown?: () => boolean } = {}): AccountApiDeps {
  let ids = 0;
  return {
    getSession: async (request) => { const cookie = cookieOf(request); return cookie ? neon.session(cookie) : null; },
    lookupAccount: async (session) => {
      const identity = store.identities.find((i) => i.issuer === session.issuer && i.subject === session.subject);
      if (!identity) return { ok: false, status: 409, errorCode: 'ACCOUNT_SETUP_REQUIRED', error: 'setup' };
      if (identity.deletedAt) return { ok: false, status: 410, errorCode: 'ACCOUNT_DELETION_PENDING', error: 'pending' };
      return { ok: true, accountId: identity.accountId, method: identity.method, created: false };
    },
    db: () => store,
    now: options.now ?? (() => new Date('2026-11-02T10:00:00.000Z')),
    newId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    neon: { signUp: (e, p, n) => neon.signUp(e, p, n), signIn: (e, p) => neon.signIn(e, p), signOut: (c) => neon.signOut(c), deleteUser: (c) => neon.deleteUser(c) },
    legacy: {
      configured: () => Boolean(options.legacy),
      verify: async (email, password) => {
        if (options.legacyDown?.()) return { result: 'unavailable' };
        const entry = options.legacy?.[email];
        return entry && entry.password === password ? { result: 'valid', userId: entry.userId } : { result: 'invalid' };
      },
    },
    rateLimit: async () => null,
    issuer: () => ISSUER,
    configured: () => true,
  };
}

export function call(handler: (request: Request, deps: AccountApiDeps) => Promise<Response>, deps: AccountApiDeps, method: string, path: string, body?: unknown, cookie = '') {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return handler(new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), deps);
}

export function sessionCookieFrom(response: Response) {
  for (const value of response.headers.getSetCookie()) if (value.startsWith('__Secure-neon-auth.session_token=')) return value.split(';')[0];
  return '';
}
