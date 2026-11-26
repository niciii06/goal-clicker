// The route cache: the browser parts in app/route-cache/ add up to exactly the canonical cache, every home city other
// than Bern has road or rail geometry for each bus and train leg it can plan, and the browser loads only its parts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import canonical from '../app/travel-route-cache.json' with { type: 'json' };
import { HOME_CITY_IDS, homeCityOf, homeVenueOf, worldCatalog } from '../app/home-cities.ts';
import { journeyCandidates, planJourney, STATIONS } from '../app/journey-routing.ts';
import { tournamentVenue, VENUES } from '../app/travel-geography.ts';
import type { Venue } from '../app/travel-geography.ts';
import { TOURNAMENTS } from '../app/features/catalog.ts';

const cache = canonical as Record<string, { geometry: string; points: unknown[] }>;
const part = (name: string) => JSON.parse(readFileSync(new URL(`../app/route-cache/${name}.json`, import.meta.url), 'utf8')) as Record<string, unknown>;
const OTHER_CITIES = HOME_CITY_IDS.filter((id) => id !== 'bern');
const coords = (p: { lat: number; lon: number }) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;

test('the browser parts add up to exactly the canonical cache, without overlap', () => {
  const names = ['base', ...OTHER_CITIES];
  const seen = new Map<string, string>();
  for (const name of names) for (const [key, route] of Object.entries(part(name))) {
    assert.equal(seen.has(key), false, `${key} is in ${seen.get(key)} and ${name}`);
    seen.set(key, name);
    assert.deepEqual(route, cache[key], `${key} in ${name} equals the canonical entry`);
  }
  assert.equal(seen.size, Object.keys(cache).length);
  // A city part only holds legs that leave from that city's home ground or home station.
  for (const city of OTHER_CITIES) {
    const starts = [coords(homeVenueOf(city)), coords(STATIONS[homeCityOf(city).station])];
    for (const key of Object.keys(part(city))) assert.ok(starts.includes(key.split(':')[1]), `${key} leaves from ${city}`);
  }
});

test('every bus and train leg from Zürich, Basel and Genève has road or rail geometry', () => {
  for (const city of OTHER_CITIES) {
    const origin = homeVenueOf(city), station = STATIONS[homeCityOf(city).station];
    const destinations = new Map<string, Venue>();
    for (const club of worldCatalog(city)) if (club.venue && club.venue.id !== origin.id) destinations.set(club.venue.id, club.venue as Venue);
    for (const t of TOURNAMENTS) for (const o of t.opponents) { const v = tournamentVenue(o.id); if (v.id !== origin.id) destinations.set(v.id, v); }
    destinations.set(VENUES.wembley.id, VENUES.wembley);
    let planned = 0;
    for (const venue of destinations.values()) {
      const c = journeyCandidates(venue, origin, station);
      for (const s of [...(c.roadAllowed ? c.road : []), ...(c.rail ?? []), ...c.air.flat()]) {
        if (s.mode !== 'bus' && s.mode !== 'train') continue;
        assert.ok(cache[s.id] && cache[s.id].geometry !== 'approximate' && cache[s.id].points.length > 2, `${city}: ${s.id} (${s.label}) has geometry`);
      }
      // The plan the game actually makes draws no departure leg as a straight line.
      const first = planJourney(venue, cache as never, origin, station).segments.find((s) => s.mode === 'bus' || s.mode === 'train');
      if (first) { assert.notEqual(first.geometry, 'approximate', `${city} → ${venue.stadium}: first leg on the road or rail`); planned++; }
    }
    assert.ok(planned > 50, `${city}: ${planned} journeys checked`);
  }
});

test('the browser loads the shared part and only the part of its home city', async () => {
  const lazy = await import('../app/travel-route-cache-lazy.ts');
  const routes = lazy.default as Record<string, unknown>;
  assert.equal(await lazy.loadRouteCache('zurich'), true);
  for (const key of Object.keys(part('base'))) assert.ok(key in routes);
  for (const key of Object.keys(part('zurich'))) assert.ok(key in routes);
  assert.equal(Object.keys(part('basel')).some((key) => key in routes), false, 'nothing of Basel');
  // Bern and old saves without a city need only the shared part; an unknown value is ignored.
  assert.equal(await lazy.loadRouteCache(undefined), true);
  assert.equal(await lazy.loadRouteCache('atlantis'), true);
  assert.equal(Object.keys(part('geneve')).some((key) => key in routes), false, 'nothing of Genève');
});
