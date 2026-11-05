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

test('app shell files and the API skip the proxy while pages still pass through it', () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const path of ['/sw.js', '/manifest.webmanifest', '/offline.html', '/sounds/crowd-ooh.mp3', '/icons/icon-192.png']) assert.doesNotMatch(path, matcher, path);
  for (const path of ['/', '/kader', '/auth/signout', '/auth/callback']) assert.match(path, matcher, path);
  // API routes check sessions themselves; the proxy would only cost one more function run per poll.
  for (const path of ['/api/save', '/api/multiplayer', '/api/auth/get-session']) assert.doesNotMatch(path, matcher, path);
});
