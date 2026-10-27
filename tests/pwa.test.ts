import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { config } from '../proxy.ts';

test('the service worker never answers API, login or non GET requests from its cache', async () => {
  const sw = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /if \(request\.method !== "GET"\) return;/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\) \|\| url\.pathname\.startsWith\("\/auth\/"\)\) return;/);
  // Pages always come from the network; only the offline page is a fallback.
  assert.match(sw, /request\.mode === "navigate"\) event\.respondWith\(networkOrOffline\(request\)\)/);
});

test('app shell files skip the proxy while pages and the API still pass through it', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const path of ['/sw.js', '/manifest.webmanifest', '/offline.html', '/sounds/crowd-ooh.mp3', '/icons/icon-192.png']) assert.doesNotMatch(path, matcher, path);
  for (const path of ['/', '/kader', '/api/save', '/auth/signout']) assert.match(path, matcher, path);
});
