// Fills the travel route cache with real road and rail geometry for every bus and train leg
// that planJourney can choose (scripts/travel, run with: npx tsx scripts/travel/fetch-real-routes.mts).
// Roads: FOSSGIS OSRM. Rails: BRouter rail profile. The private home origin is never sent to a
// routing service: legs from the home ground keep the locally computed Overpass corridor for the
// first kilometres and only continue from a public road point in the neighbourhood.
// Requests, simplification and writing the cache: route-fetch-lib.mts (responses cached in ROUTE_FETCH_CACHE).
import { journeyCandidates } from '../../app/journey-routing.ts';
import type { Segment } from '../../app/journey-routing.ts';
import { HOME_VENUE, SEASON_CLUBS, VENUES, distanceKm } from '../../app/travel-geography.ts';
import type { GeoPoint } from '../../app/travel-geography.ts';
import { anchored, brouterRail, osrm, pathKm, readCache, simplify, writeCache } from './route-fetch-lib.mts';

const DATE = '2026-10-17';
const cache = readCache();
const original = readCache();

const homePrefix = `bus:${HOME_VENUE.lat.toFixed(5)},${HOME_VENUE.lon.toFixed(5)}:`;
// Public road points on the locally computed corridors from the home ground, 0.6 to 3 km out.
const anchors = Object.entries(original).filter(([key, r]) => key.startsWith(homePrefix) && !r.source.includes('OSRM') && r.points.length >= 10).flatMap(([, r]) => {
  const found: { prefix: GeoPoint[]; prefixKm: number; anchor: GeoPoint }[] = [];
  let travelled = 0;
  for (let i = 1; i < r.points.length - 1 && travelled < 3; i++) {
    travelled += distanceKm(r.points[i - 1], r.points[i]);
    if (travelled >= .6 && (!found.length || travelled - found.at(-1)!.prefixKm >= .4)) found.push({ prefix: r.points.slice(0, i + 1), prefixKm: travelled, anchor: r.points[i] });
  }
  return found;
});

function roadFromHome(to: GeoPoint) {
  // Three most promising public road points, then the fastest complete route among them.
  const estimate = (a: (typeof anchors)[number]) => a.prefixKm + distanceKm(a.anchor, to) * 1.3;
  const choices: typeof anchors = [];
  for (const a of [...anchors].sort((x, y) => estimate(x) - estimate(y))) {
    if (choices.every((c) => distanceKm(c.anchor, a.anchor) > .2)) choices.push(a);
    if (choices.length === 3) break;
  }
  const routes = choices.map((c) => {
    const road = osrm(c.anchor, to);
    // Neighbourhood streets at about 30 km/h before the public road point.
    return { points: [...c.prefix, ...road.points], km: c.prefixKm + road.km, seconds: c.prefixKm / 30 * 3600 + road.seconds };
  });
  return routes.reduce((best, r) => r.seconds < best.seconds ? r : best);
}

const venues = new Map<string, (typeof SEASON_CLUBS)[number]['venue']>();
for (const club of SEASON_CLUBS) venues.set(club.venue.id, club.venue);
for (const venue of Object.values(VENUES)) if (!venues.has(venue.id)) venues.set(venue.id, venue);
venues.delete(HOME_VENUE.id);

// A cached road that already ends within 100 m of the target is spliced by planJourney with a
// short estimated final connection (tests/stadium-audit.test.ts keeps that path for the Wankdorf).
const nearlyCached = (s: Segment) => Object.entries(original).some(([key, r]) => key.startsWith('bus:') && r.geometry === 'road' && r.points.length >= 3 && distanceKm(r.points[0], s.from) < .001 && distanceKm(r.points.at(-1)!, s.to) < .1);
const legs = new Map<string, Segment>();
for (const venue of venues.values()) {
  const c = journeyCandidates(venue);
  for (const s of [...(c.roadAllowed ? c.road : []), ...(c.rail ?? []), ...c.air.flat()]) {
    if ((s.mode === 'bus' || s.mode === 'train') && (original[s.id] ? original[s.id].geometry === 'approximate' || original[s.id].source.includes(DATE) : !nearlyCached(s))) legs.set(s.id, s);
  }
}
console.log(`legs to fetch: ${legs.size} (${[...legs.values()].filter((s) => s.mode === 'train').length} railway)`);

let done = 0;
for (const [key, s] of legs) {
  if (s.mode === 'train') {
    const rail = brouterRail(s.from, s.to), points = anchored(s.from, rail.points, s.to), km = pathKm(points);
    cache[key] = { points: simplify(points, km), seconds: km / 95 * 3600 + 600, km, geometry: 'rail', source: `© OpenStreetMap contributors / BRouter rail profile, ${DATE}. Railway track geometry; station approaches approximate; journey time estimated, not a verified passenger service.` };
  } else if (key.startsWith(homePrefix)) {
    const road = roadFromHome(s.to), points = [...road.points, { lat: s.to.lat, lon: s.to.lon }], km = pathKm(points);
    cache[key] = { points: simplify(points, km), seconds: road.seconds, km, geometry: 'road', source: `© OpenStreetMap contributors / Overpass, 2026-10-12 (local first kilometres) and FOSSGIS OSRM, ${DATE}. Road geometry; the home origin was not sent to a routing service; bus time estimated.` };
  } else {
    const road = osrm(s.from, s.to), points = anchored(s.from, road.points, s.to), km = pathKm(points);
    cache[key] = { points: simplify(points, km), seconds: road.seconds, km, geometry: 'road', source: `© OpenStreetMap contributors / FOSSGIS OSRM, ${DATE}. Road geometry; endpoint approaches approximate; bus time estimated.` };
  }
  done++;
  if (done % 10 === 0) console.log(`  ${done}/${legs.size}`);
}

const written = writeCache(cache);
console.log(`cache entries ${written.entries}, ${written.bytes} bytes, browser parts ${JSON.stringify(written.parts)}`);
