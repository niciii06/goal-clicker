import assert from 'node:assert/strict';
import test from 'node:test';
import { clearRateLimitsForTests, rateLimited, RATE_LIMITS } from '../app/api/rate-limit.ts';

const from = (address: string) => new Request('http://localhost/api/register', { method: 'POST', headers: { 'x-forwarded-for': `${address}, 10.0.0.1` } });

test('registrations are limited per address and the limit lifts after its window', () => {
  clearRateLimitsForTests();
  const { limit, windowMs } = RATE_LIMITS.register;
  for (let i = 0; i < limit; i++) assert.equal(rateLimited(from('203.0.113.7'), 'register', 1000 + i), null);
  const refused = rateLimited(from('203.0.113.7'), 'register', 2000);
  assert.equal(refused?.status, 429);
  assert.ok(Number(refused?.headers.get('retry-after')) > 0);
  // Another address and another endpoint have their own budget.
  assert.equal(rateLimited(from('198.51.100.4'), 'register', 2000), null);
  assert.equal(rateLimited(from('203.0.113.7'), 'login', 2000), null);
  assert.equal(rateLimited(from('203.0.113.7'), 'register', 1000 + windowMs + 1), null);
});

test('requests without a client address (local runs) are not limited', () => {
  clearRateLimitsForTests();
  const local = new Request('http://localhost/api/register', { method: 'POST' });
  for (let i = 0; i < 50; i++) assert.equal(rateLimited(local, 'register'), null);
});

test('requests from this machine are not limited either', () => {
  clearRateLimitsForTests();
  for (let i = 0; i < 50; i++) assert.equal(rateLimited(from('127.0.0.1'), 'register'), null);
  for (let i = 0; i < 50; i++) assert.equal(rateLimited(from('::1'), 'register'), null);
});

test('on Netlify only the address the edge reports counts, a forged x-forwarded-for start does not', async () => {
  const { clientAddress } = await import('../app/api/rate-limit.ts');
  const saved = process.env.NETLIFY;
  try {
    const forged = new Request('http://localhost/api/login', { headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9', 'x-nf-client-connection-ip': '203.0.113.9' } });
    assert.equal(clientAddress(forged), '1.2.3.4');
    process.env.NETLIFY = 'true';
    assert.equal(clientAddress(forged), '203.0.113.9');
    assert.equal(clientAddress(new Request('http://localhost/api/login', { headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.10' } })), '203.0.113.10');
  } finally {
    if (saved === undefined) delete process.env.NETLIFY; else process.env.NETLIFY = saved;
  }
});

test('the shared limit counts across server instances and per username', async () => {
  const { sharedRateLimited } = await import('../app/api/rate-limit.ts');
  clearRateLimitsForTests();
  const counts = new Map<string, number>();
  const store = () => ({
    hitRateLimit: async (key: string, windowStart: number) => { const k = `${key}@${windowStart}`; counts.set(k, (counts.get(k) ?? 0) + 1); return counts.get(k)!; },
    pruneRateLimits: async () => undefined,
  });
  const { limit } = RATE_LIMITS.login;
  // Many addresses guessing one username are stopped by the per username budget.
  let refused = 0;
  for (let i = 0; i < limit * 3; i++) if (await sharedRateLimited(from(`198.51.100.${i}`), 'login', 'victim', store, 5000)) refused += 1;
  assert.equal(refused, limit);
  // A database that cannot count does not block logins (the per instance limit still applies).
  const broken = () => ({ hitRateLimit: async () => { throw new Error('down'); }, pruneRateLimits: async () => undefined });
  assert.equal(await sharedRateLimited(from('192.0.2.1'), 'login', 'someone', broken, 5000), null);
});
