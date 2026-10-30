import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { config } from '../proxy.ts';
import { BACKGROUND_POLL_HEADER } from '../app/auth/config.ts';

test('the service worker never answers API, login or non GET requests from its cache', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /if \(request\.method !== "GET"\) return;/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\) \|\| url\.pathname\.startsWith\("\/auth\/"\)\) return;/);
  // Pages always come from the network; only the offline page is a fallback.
  assert.match(sw, /request\.mode === "navigate"\) event\.respondWith\(networkOrOffline\(request\)\)/);
});

test('app shell files skip the proxy while pages and the API still pass through it', () => {
  const matcher = new RegExp(`^${config.matcher[0].source}$`);
  for (const path of ['/sw.js', '/manifest.webmanifest', '/offline.html', '/sounds/crowd-ooh.mp3', '/icons/icon-192.png']) assert.doesNotMatch(path, matcher, path);
  for (const path of ['/', '/kader', '/api/save', '/auth/signout']) assert.match(path, matcher, path);
});

test('background polls skip the proxy, so their login cookies cross Fast Origin Transfer only once', () => {
  assert.deepEqual(config.matcher[0].missing, [{ type: 'header', key: BACKGROUND_POLL_HEADER }]);
});
