import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';
import { gzipJsonResponse, withGzip } from '../app/api/compression.ts';
import { readJsonBody, RequestBodyTooLargeError } from '../app/api/request-body.ts';

const big = { ids: Array.from({ length: 2000 }, (_, index) => `fc27-player-${index}`) };

test('large JSON answers go out gzipped when the client accepts it, and unpack to the same JSON', async () => {
  const request = new Request('http://test/api', { headers: { 'accept-encoding': 'gzip, deflate, br' } });
  const response = await gzipJsonResponse(request, Response.json(big, { status: 201, headers: { 'cache-control': 'no-store' } }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('vary') ?? '', /accept-encoding/);
  const packed = new Uint8Array(await response.arrayBuffer());
  assert.ok(packed.byteLength * 5 < JSON.stringify(big).length, `${packed.byteLength} bytes is not much smaller`);
  assert.deepEqual(JSON.parse(gunzipSync(packed).toString('utf8')), big);
});

test('small answers, clients without gzip and non JSON answers stay as they are', async () => {
  const gzipClient = new Request('http://test/api', { headers: { 'accept-encoding': 'gzip' } });
  const small = await gzipJsonResponse(gzipClient, Response.json({ ok: true }));
  assert.equal(small.headers.get('content-encoding'), null);
  assert.deepEqual(await small.json(), { ok: true });
  const plain = await withGzip(() => Response.json(big))(new Request('http://test/api'));
  assert.equal(plain.headers.get('content-encoding'), null);
  assert.deepEqual(await plain.json(), big);
  const text = await gzipJsonResponse(gzipClient, new Response('x'.repeat(5000), { headers: { 'content-type': 'text/plain' } }));
  assert.equal(text.headers.get('content-encoding'), null);
});

test('gzipped request bodies are read, and may not unpack beyond the limit', async () => {
  const body = gzipSync(Buffer.from(JSON.stringify(big)));
  const request = () => new Request('http://test/api', { method: 'PUT', headers: { 'content-encoding': 'gzip', 'content-type': 'application/json' }, body });
  assert.deepEqual(await readJsonBody(request(), 1024 * 1024), big);
  // Small on the wire, too large unpacked.
  await assert.rejects(readJsonBody(request(), 4096), RequestBodyTooLargeError);
});
