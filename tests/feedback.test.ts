// In game feedback: the shared rules, /api/feedback with a stand-in store, and the panel source.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { FEEDBACK_SCREENSHOT_MAX_BYTES, parseFeedback, sniffImageType } from '../app/feedback-rules.ts';
import { feedbackStatusResponse, feedbackSubmitResponse } from '../app/feedback-api.ts';
import type { FeedbackDeps } from '../app/feedback-api.ts';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const dataUrl = (type: string, bytes: Uint8Array) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
const valid = { kind: 'bug', title: 'Ball hängt', description: 'Nach dem Tor bleibt der Ball an der Eckfahne stehen.' };

test('rules: kind, lengths and real image bytes decide, not the declared type', () => {
  assert.deepEqual(parseFeedback(valid), { ok: true, input: { ...valid, screenshot: null } });
  assert.deepEqual(parseFeedback({ ...valid, kind: 'spam' }), { ok: false, error: 'kind' });
  assert.deepEqual(parseFeedback({ ...valid, title: ' a ' }), { ok: false, error: 'titleShort' });
  assert.deepEqual(parseFeedback({ ...valid, title: 'x'.repeat(121) }), { ok: false, error: 'titleLong' });
  assert.deepEqual(parseFeedback({ ...valid, description: 'kurz' }), { ok: false, error: 'descriptionShort' });
  assert.deepEqual(parseFeedback({ ...valid, description: 'ä'.repeat(4001) }), { ok: false, error: 'descriptionLong' });
  assert.equal(sniffImageType(PNG), 'image/png');
  assert.equal(sniffImageType(JPEG), 'image/jpeg');
  assert.equal(sniffImageType(WEBP), 'image/webp');
  assert.equal(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  const withPng = parseFeedback({ ...valid, screenshot: dataUrl('image/png', PNG) });
  assert.ok(withPng.ok && withPng.input.screenshot?.type === 'image/png');
  // A declared PNG that is really something else, an SVG, a GIF type and broken base64 are refused.
  assert.deepEqual(parseFeedback({ ...valid, screenshot: dataUrl('image/png', JPEG) }), { ok: false, error: 'imageType' });
  assert.deepEqual(parseFeedback({ ...valid, screenshot: dataUrl('image/svg+xml', new TextEncoder().encode('<svg/>')) }), { ok: false, error: 'imageType' });
  assert.deepEqual(parseFeedback({ ...valid, screenshot: dataUrl('image/gif', Uint8Array.from([0x47, 0x49, 0x46, 0x38])) }), { ok: false, error: 'imageType' });
  assert.deepEqual(parseFeedback({ ...valid, screenshot: 'data:image/png;base64,@@@@' }), { ok: false, error: 'imageType' });
  const big = new Uint8Array(FEEDBACK_SCREENSHOT_MAX_BYTES + 1); big.set(PNG);
  assert.deepEqual(parseFeedback({ ...valid, screenshot: dataUrl('image/png', big) }), { ok: false, error: 'imageSize' });
});

function deps(overrides: Partial<FeedbackDeps> = {}) {
  const stored: Record<string, unknown>[] = [];
  const value: FeedbackDeps = {
    enabled: () => true,
    store: () => ({ feedbackReady: async () => true, insertFeedback: async (row) => { stored.push(row); return `id-${stored.length}`; } }),
    rateLimit: async () => null,
    accountOf: async () => null,
    ...overrides,
  };
  return { value, stored };
}
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('http://localhost/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost', ...headers }, body: JSON.stringify(body) });

test('api: off without the switch or the table, then stores exactly what was checked', async () => {
  assert.deepEqual(await (await feedbackStatusResponse(deps({ enabled: () => false }).value)).json(), { enabled: false });
  assert.deepEqual(await (await feedbackStatusResponse(deps({ store: () => ({ feedbackReady: async () => false, insertFeedback: async () => '' }) }).value)).json(), { enabled: false });
  assert.deepEqual(await (await feedbackStatusResponse(deps().value)).json(), { enabled: true });
  assert.equal((await feedbackSubmitResponse(post(valid), deps({ enabled: () => false }).value)).status, 503);

  const { value, stored } = deps({ accountOf: async () => '00000000-0000-4000-8000-000000000001' });
  const created = await feedbackSubmitResponse(post({ ...valid, kind: 'feature', screenshot: dataUrl('image/webp', WEBP), playerId: 'player-12345', locale: 'en' }), value);
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { id: 'id-1' });
  assert.deepEqual(stored[0], { kind: 'feature', title: valid.title, description: valid.description, accountId: '00000000-0000-4000-8000-000000000001', playerId: 'player-12345', locale: 'en', screenshotType: 'image/webp', screenshotBase64: Buffer.from(WEBP).toString('base64') });
  // An odd player id or locale is dropped, not stored.
  await feedbackSubmitResponse(post({ ...valid, playerId: '<script>', locale: 'fr' }), value);
  assert.equal(stored[1].playerId, null);
  assert.equal(stored[1].locale, null);
});

test('api: refuses a foreign origin, a non JSON body, invalid input and answers the rate limit', async () => {
  const { value, stored } = deps();
  assert.equal((await feedbackSubmitResponse(post(valid, { origin: 'https://evil.example' }), value)).status, 403);
  const form = new Request('http://localhost/api/feedback', { method: 'POST', headers: { 'content-type': 'text/plain', origin: 'http://localhost' }, body: 'x' });
  assert.equal((await feedbackSubmitResponse(form, value)).status, 415);
  const bad = await feedbackSubmitResponse(post({ ...valid, title: 'a' }), value);
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { errorCode: 'titleShort' });
  const limited = deps({ rateLimit: async () => Response.json({ errorCode: 'RATE_LIMITED' }, { status: 429 }) });
  assert.equal((await feedbackSubmitResponse(post(valid), limited.value)).status, 429);
  const failing = deps({ store: () => ({ feedbackReady: async () => true, insertFeedback: async () => { throw new Error('db down'); } }) });
  assert.equal((await feedbackSubmitResponse(post(valid), failing.value)).status, 503);
  assert.equal(stored.length, 0);
});

test('panel: hidden until the server offers the form; nothing is sent by mail yet', async () => {
  const panel = await readFile(new URL('../app/feedback-panel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /if \(!enabled\) return null;/);
  assert.match(panel, /accept=\{ACCEPT\}/);
  const api = await readFile(new URL('../app/feedback-api.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(api, /sendMail|nodemailer|resend|smtp/i);
  const migration = await readFile(new URL('../drizzle/0010_feedback_reports.sql', import.meta.url), 'utf8');
  assert.match(migration, /PREPARED, NOT APPLIED/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "feedback_reports"/);
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: { tag: string }[] };
  assert.equal(journal.entries.some((entry) => entry.tag.startsWith('0010')), false, 'applied by hand, not by db:migrate');
});
