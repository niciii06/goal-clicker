import assert from 'node:assert/strict';
import test from 'node:test';
import source from '../app/fc27-india-source.json';
import { readFile } from 'node:fs/promises';
import { CLIENT_COPY, renderClientCopy, slimIndiaSource } from '../scripts/client-data.mjs';
import { FC27_INDIA_PROFILES } from '../app/scrap-pack.ts';
import fullRoutes from '../app/travel-route-cache.ts';
import lazyRoutes, { loadRouteCache } from '../app/travel-route-cache-lazy.ts';

test('the browser copy of the FC 27 India export keeps every field the game reads', () => {
  type Slim = { edition: string; items: { id: number; overallRating: number; firstName: string; lastName: string; commonName: string | null; position: { shortLabel: string }; alternatePositions: { shortLabel: string }[]; stats: Record<string, { value: number }> }[] };
  const slim = slimIndiaSource(source) as Slim;
  assert.equal(slim.items.length, source.items.length);
  assert.equal(slim.edition, source.edition);
  assert.ok(JSON.stringify(slim).length < JSON.stringify(source).length * .6, 'slim copy should be much smaller');
  for (const [index, player] of slim.items.entries()) {
    const original = source.items[index], profile = FC27_INDIA_PROFILES[index];
    assert.equal(player.id, original.id);
    assert.equal(player.overallRating, profile.rating);
    assert.equal(player.commonName || `${player.firstName} ${player.lastName}`.trim(), profile.name);
    assert.deepEqual([player.position, ...player.alternatePositions].map((p) => p.shortLabel), [original.position, ...(original.alternatePositions ?? [])].map((p) => p.shortLabel));
    assert.deepEqual(Object.keys(player.stats), Object.keys(original.stats));
    for (const [key, stat] of Object.entries(original.stats)) assert.equal(player.stats[key].value, stat.value);
  }
});

test('the lazily loaded route cache ends up identical to the full cache once every home city part is loaded', async () => {
  assert.equal(await loadRouteCache(), true);
  for (const city of ['zurich', 'basel', 'geneve']) assert.equal(await loadRouteCache(city), true);
  // Compared key by key: a deepEqual failure on 4.6 MB of routes would print a diff of that size.
  assert.equal(Object.keys(lazyRoutes).length, Object.keys(fullRoutes).length);
  const full = fullRoutes as Record<string, unknown>, lazy = lazyRoutes as Record<string, unknown>;
  for (const key of Object.keys(full)) assert.ok(JSON.stringify(lazy[key]) === JSON.stringify(full[key]), key);
  assert.equal(await loadRouteCache('zurich'), true);
});

test('the committed browser copy is current (npm run generate:client-data)', async () => {
  assert.equal(await readFile(CLIENT_COPY, 'utf8'), await renderClientCopy());
});

test('browser builds resolve the slim and lazy copies through package.json imports', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.imports['#fc27-india-source'].browser, './app/fc27-india-source.client.json');
  assert.equal(pkg.imports['#travel-route-cache'].browser, './app/travel-route-cache-lazy.ts');
  for (const file of ['../app/scrap-pack.ts', '../app/journey-routing.ts']) assert.match(await readFile(new URL(file, import.meta.url), 'utf8'), /from '#(fc27-india-source|travel-route-cache)'/);
});

test('the page only loads the route cache once the Spiele tab is open (P12)', async () => {
  const page = await readFile(new URL('../app/game-app.tsx', import.meta.url), 'utf8');
  const effects = page.split('\n').filter((line) => line.includes('loadRouteCache('));
  assert.equal(effects.length, 1);
  assert.match(effects[0], /if \(!routesWanted\) return;/);
  assert.match(effects[0], /loadRouteCache\(routesCity\)/, 'only the part of the home city of the club on top of the shared part');
  assert.match(effects[0], /\[routesWanted, routesCity\]\);/);
  assert.match(page, /const routesWanted = featureTab === "cup";/);
  // The travel map still loads it itself wherever it is shown, for the home city of the trip.
  assert.match(await readFile(new URL('../app/travel-map.tsx', import.meta.url), 'utf8'), /loadRouteCache\(tripCity\)/);
});
