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
