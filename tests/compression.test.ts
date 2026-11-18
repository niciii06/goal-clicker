import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { gzipJsonResponse, withGzip } from '../app/api/compression.ts';
import { readJsonBody, RequestBodyTooLargeError } from '../app/api/request-body.ts';

const big = { ids: Array.from({ length: 2000 }, (_, index) => `fc27-player-${index}`) };

test('routes answer with identity JSON: status, headers and body pass through, and no content-encoding is set by the route', async () => {
  const request = new Request('http://test/api', { headers: { 'accept-encoding': 'gzip, deflate, br' } });
  const response = await gzipJsonResponse(request, Response.json(big, { status: 201, headers: { 'cache-control': 'no-store' } }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-encoding'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), big);
  const wrapped = await withGzip(() => Response.json({ error: 'nope' }, { status: 409 }))(request);
  assert.equal(wrapped.status, 409);
  assert.equal(wrapped.headers.get('content-encoding'), null);
  assert.deepEqual(await wrapped.json(), { error: 'nope' });
  const text = await gzipJsonResponse(request, new Response('x'.repeat(5000), { headers: { 'content-type': 'text/plain' } }));
  assert.equal(text.headers.get('content-encoding'), null);
});

test('gzipped request bodies are read, and may not unpack beyond the limit', async () => {
  const body = gzipSync(Buffer.from(JSON.stringify(big)));
  const request = () => new Request('http://test/api', { method: 'PUT', headers: { 'content-encoding': 'gzip', 'content-type': 'application/json' }, body });
  assert.deepEqual(await readJsonBody(request(), 1024 * 1024), big);
  // Small on the wire, too large unpacked.
  await assert.rejects(readJsonBody(request(), 4096), RequestBodyTooLargeError);
});
