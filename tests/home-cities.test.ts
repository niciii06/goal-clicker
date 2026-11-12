// Stadium Phase 1 data (app/home-cities.ts, docs/home-cities-data.md): four home cities, local clubs for divisions 1
// to 8 that keep the six clubs per league of the one-up/one-down system, Bern exactly as today, documented grounds.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_HOME_CITY, HOME_CITIES, HOME_CITY_IDS, REGIONAL_DIVISIONS, homeCityOf, worldCatalog } from '../app/home-cities.ts';
import { HOME_VENUE, LEAGUE_LABELS, LEAGUE_MEMBERS, SEASON_CLUBS, distanceKm } from '../app/travel-geography.ts';
import { STATIONS } from '../app/journey-routing.ts';

const division = (club: { league: number }) => 16 - club.league;
const OTHERS = HOME_CITY_IDS.filter((id) => id !== 'bern');

test('Bern is the default and returns exactly today\'s catalogue, so old saves stay valid', () => {
  assert.equal(DEFAULT_HOME_CITY, 'bern');
  for (const saved of [undefined, null, '', 'paris', 42]) assert.equal(homeCityOf(saved).id, 'bern');
  const bern = HOME_CITIES.bern;
  assert.equal(bern.homeVenue, HOME_VENUE);
  assert.deepEqual(bern.leagueLabels, LEAGUE_LABELS.slice(0, REGIONAL_DIVISIONS));
  assert.deepEqual(bern.regionalClubs, SEASON_CLUBS.filter((club) => division(club) <= REGIONAL_DIVISIONS));
  assert.deepEqual(worldCatalog('bern'), [...SEASON_CLUBS].sort((a, b) => Number(division(a) > 8) - Number(division(b) > 8)));
  assert.deepEqual(new Set(worldCatalog('bern').map((c) => c.id)), new Set(SEASON_CLUBS.map((c) => c.id)));
});

test('every world keeps six members per league: 5 AI clubs in the lowest league, 6 in every other, 89 in all', () => {
  for (const id of HOME_CITY_IDS) {
    const catalog = worldCatalog(id);
    assert.equal(catalog.length, SEASON_CLUBS.length, id);
    for (let d = 1; d <= 15; d++) assert.equal(catalog.filter((c) => division(c) === d).length, d === 1 ? LEAGUE_MEMBERS - 1 : LEAGUE_MEMBERS, `${id} division ${d}`);
    // From division 9 on, every world plays the same clubs.
    assert.deepEqual(catalog.filter((c) => division(c) > 8).map((c) => c.id), SEASON_CLUBS.filter((c) => division(c) > 8).map((c) => c.id));
    assert.equal(HOME_CITIES[id].leagueLabels.length, REGIONAL_DIVISIONS);
  }
});

test('club ids are unique across all worlds; local clubs carry their city prefix', () => {
  const all = [...SEASON_CLUBS.map((c) => c.id), ...OTHERS.flatMap((id) => HOME_CITIES[id].regionalClubs.map((c) => c.id))];
  assert.equal(new Set(all).size, all.length);
  const prefix = { zurich: 'zh-', basel: 'bs-', geneve: 'ge-' } as const;
  for (const id of OTHERS) for (const club of HOME_CITIES[id].regionalClubs) assert.ok(club.id.startsWith(prefix[id]), club.id);
});

test('home grounds and every local ground are documented real places in Switzerland near their city', () => {
  for (const id of OTHERS) {
    const city = HOME_CITIES[id];
    assert.match(city.homeVenue.source, /^https:\/\/www\.openstreetmap\.org\/(way|node|relation)\/\d+$/);
    assert.ok(distanceKm(city.homeVenue, STATIONS[city.station]) < 8, `${id}: home ground close to ${city.station} station`);
    for (const club of city.regionalClubs) {
      const v = club.venue;
      assert.match(v.source, /^https:\/\/www\.openstreetmap\.org\/(way|node|relation)\/\d+$/, club.name);
      assert.equal(v.country, 'Schweiz');
      assert.match(v.canton ?? '', /^[A-Z]{2}$/, club.name);
      assert.ok(v.lat > 45.8 && v.lat < 47.9 && v.lon > 5.9 && v.lon < 10.5, `${club.name} lies in Switzerland`);
      assert.ok(distanceKm(city.homeVenue, v) <= 60, `${club.name} is local`);
      assert.ok(v.stadium.length > 3 && !/^(sportplatz|sportanlage)$/i.test(v.stadium), `${club.name}: ground has a readable name`);
    }
  }
});

test('real clubs only with their own website as source and never in the Chaosliga; all others are marked fictional', () => {
  const realNames = new Set<string>();
  for (const id of OTHERS) for (const club of HOME_CITIES[id].regionalClubs) {
    if (club.clubSource) {
      realNames.add(club.name);
      assert.match(club.clubSource.url, /^https:\/\/www\.[a-z0-9-]+\.ch\/$/, club.name);
      assert.ok(club.clubSource.quote.length > 10, club.name);
      assert.equal(club.fictional, undefined, club.name);
      assert.equal(club.venue.verification, 'stadium');
      assert.ok(division(club) >= 2, `${club.name} is not in the Chaosliga`);
    } else {
      assert.equal(club.fictional, true, club.name);
      assert.equal(club.venue.verification, 'pitch-fallback');
    }
  }
  // Documented share per city (docs/home-cities-data.md).
  const share = Object.fromEntries(OTHERS.map((id) => [id, HOME_CITIES[id].regionalClubs.filter((c) => c.clubSource).length]));
  assert.deepEqual(share, { zurich: 1, basel: 3, geneve: 0 });
  // Fictional names never copy a real club of the catalogue or a verified one, and are unique within a world.
  const catalogNames = new Set(SEASON_CLUBS.map((c) => c.name));
  for (const id of OTHERS) {
    const names = worldCatalog(id).map((c) => c.name);
    assert.equal(new Set(names).size, names.length, `${id}: unique names`);
    for (const club of HOME_CITIES[id].regionalClubs.filter((c) => c.fictional)) {
      assert.ok(!catalogNames.has(club.name) && !realNames.has(club.name), club.name);
    }
  }
});

test('no two clubs of one league share a ground, and no ground hosts more than two clubs', () => {
  for (const id of OTHERS) {
    const uses = new Map<string, number>();
    for (let d = 1; d <= REGIONAL_DIVISIONS; d++) {
      const grounds = HOME_CITIES[id].regionalClubs.filter((c) => division(c) === d).map((c) => c.venue.source);
      assert.equal(new Set(grounds).size, grounds.length, `${id} division ${d}`);
      for (const g of grounds) uses.set(g, (uses.get(g) ?? 0) + 1);
    }
    assert.ok([...uses.values()].every((n) => n <= 2), id);
    assert.ok(!HOME_CITIES[id].regionalClubs.some((c) => c.venue.source === HOME_CITIES[id].homeVenue.source), `${id}: nobody plays on the home ground`);
  }
});

test('travel stays comparable to Bern: local leagues near, wider leagues farther, the same overall distance', () => {
  const mean = (id: (typeof HOME_CITY_IDS)[number], d: number) => {
    const city = HOME_CITIES[id];
    const list = city.regionalClubs.filter((c) => division(c) === d).map((c) => distanceKm(city.homeVenue, c.venue));
    return list.reduce((a, b) => a + b, 0) / list.length;
  };
  const overall = (id: (typeof HOME_CITY_IDS)[number]) => Array.from({ length: 8 }, (_, i) => mean(id, i + 1)).reduce((a, b) => a + b, 0) / 8;
  for (const id of OTHERS) {
    for (let d = 1; d <= 3; d++) assert.ok(mean(id, d) <= 15, `${id} division ${d}: ${mean(id, d).toFixed(1)} km`);
    assert.ok(mean(id, 6) > mean(id, 1) && mean(id, 8) > mean(id, 2), `${id}: the wider leagues are farther`);
    assert.ok(Math.abs(overall(id) - overall('bern')) <= 0.35 * overall('bern'), `${id}: ${overall(id).toFixed(1)} vs Bern ${overall('bern').toFixed(1)} km`);
  }
  // Zürich and Genève follow Bern's profile league by league; Basel's city leagues lie farther out (fewer mapped
  // grounds in Basel-Stadt), documented as a known deviation.
  for (const id of ['zurich', 'geneve'] as const) for (let d = 1; d <= 8; d++) {
    assert.ok(Math.abs(mean(id, d) - mean('bern', d)) <= Math.max(5, 0.5 * mean('bern', d)), `${id} division ${d}`);
  }
});
