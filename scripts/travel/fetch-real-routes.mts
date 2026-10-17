// Fills the travel route cache with real road and rail geometry for every bus and train leg
// that planJourney can choose (scripts/travel, run with: npx tsx scripts/travel/fetch-real-routes.mts).
// Roads: FOSSGIS OSRM. Rails: BRouter rail profile. The private home origin is never sent to a
// routing service: legs from the home ground keep the locally computed Overpass corridor for the
// first kilometres and only continue from a public road point in the neighbourhood.
// Responses are kept in ROUTE_FETCH_CACHE (default: the system temp directory) so reruns are offline.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeyCandidates } from '../../app/journey-routing.ts';
import type { Segment } from '../../app/journey-routing.ts';
import { HOME_VENUE, SEASON_CLUBS, VENUES, distanceKm } from '../../app/travel-geography.ts';
import type { GeoPoint } from '../../app/travel-geography.ts';

type Cached = { points: GeoPoint[]; seconds: number; km: number; source: string; geometry: 'road'|'rail'|'approximate' };
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const cachePath = join(root, 'app/travel-route-cache.json');
const partsDir = join(root, 'app/route-cache');
const indexPath = join(root, 'app/travel-route-cache.ts');
const responseDir = process.env.ROUTE_FETCH_CACHE ?? join(tmpdir(), 'goal-clicker-route-fetch');
const DATE = '2026-10-17';
const PART_BYTES = 165_000;
mkdirSync(responseDir, { recursive: true });

const cache: Record<string, Cached> = JSON.parse(readFileSync(cachePath, 'utf8'));
const original: Record<string, Cached> = JSON.parse(readFileSync(cachePath, 'utf8'));

let lastRequest = 0;
function get(url: string): unknown {
  const file = join(responseDir, `${createHash('sha1').update(url).digest('hex')}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  // Public demo servers: at most about one request per second.
  const pause = lastRequest + 1100 - Date.now();
  if (pause > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pause);
  lastRequest = Date.now();
  const body = execFileSync('curl', ['-sS', '-m', '120', '--retry', '3', '--retry-delay', '5', '-A', 'goal-clicker-route-cache/1.0', url], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const data = JSON.parse(body);
  writeFileSync(file, body);
  return data;
}

function osrm(a: GeoPoint, b: GeoPoint) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  const data = get(url) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
  if (!route) throw new Error(`OSRM found no road ${JSON.stringify([a, b])}: ${data.code}`);
  return { points: route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })), km: route.distance / 1000, seconds: route.duration };
}

function brouterRail(a: GeoPoint, b: GeoPoint) {
  const url = `https://brouter.de/brouter?lonlats=${a.lon},${a.lat}|${b.lon},${b.lat}&profile=rail&alternativeidx=0&format=geojson`;
  const data = get(url) as { features?: { geometry: { coordinates: number[][] }; properties: Record<string, string> }[] };
  const feature = data.features?.[0];
  if (!feature) throw new Error(`BRouter found no railway ${JSON.stringify([a, b])}`);
  return { points: feature.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })), km: Number(feature.properties['track-length']) / 1000 };
}

const pathKm = (points: GeoPoint[]) => points.slice(1).reduce((n, p, i) => n + distanceKm(points[i], p), 0);

// Douglas-Peucker in metres; long routes are drawn on a small map, so they keep fewer vertices.
function simplify(points: GeoPoint[], km: number) {
  const tolerance = km < 30 ? 4 : km < 150 ? 8 : km < 400 ? 20 : 40;
  if (points.length < 3) return points;
  const lat = points.reduce((n, p) => n + p.lat, 0) / points.length, sx = 111320 * Math.cos(lat * Math.PI / 180), sy = 111320;
  const keep = new Set([0, points.length - 1]), queue: [number, number][] = [[0, points.length - 1]];
  while (queue.length) {
    const [a, b] = queue.pop()!;
    const ax = points[a].lon * sx, ay = points[a].lat * sy, dx = points[b].lon * sx - ax, dy = points[b].lat * sy - ay, den = dx * dx + dy * dy;
    let worst = tolerance * tolerance, index = -1;
    for (let i = a + 1; i < b; i++) {
      const px = points[i].lon * sx - ax, py = points[i].lat * sy - ay, t = den ? Math.max(0, Math.min(1, (px * dx + py * dy) / den)) : 0;
      const d = (px - t * dx) ** 2 + (py - t * dy) ** 2;
      if (d > worst) { worst = d; index = i; }
    }
    if (index >= 0) { keep.add(index); queue.push([a, index], [index, b]); }
  }
  return [...keep].sort((x, y) => x - y).map((i) => ({ lat: +points[i].lat.toFixed(6), lon: +points[i].lon.toFixed(6) }));
}

// Exact endpoints first and last, so vehicles leave and reach the configured anchors.
const anchored = (a: GeoPoint, points: GeoPoint[], b: GeoPoint) => [{ lat: a.lat, lon: a.lon }, ...points, { lat: b.lat, lon: b.lon }];

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

writeFileSync(cachePath, JSON.stringify(cache));
// Browser chunks: parts of about PART_BYTES each, in canonical key order.
for (const file of readdirSync(partsDir)) if (/^part-\d+\.json$/.test(file)) rmSync(join(partsDir, file));
const parts: Record<string, Cached>[] = [{}];
let bytes = 0;
for (const [key, route] of Object.entries(cache)) {
  const size = JSON.stringify({ [key]: route }).length;
  if (bytes + size > PART_BYTES && Object.keys(parts.at(-1)!).length) { parts.push({}); bytes = 0; }
  parts.at(-1)![key] = route; bytes += size;
}
parts.forEach((part, i) => writeFileSync(join(partsDir, `part-${i}.json`), JSON.stringify(part)));
writeFileSync(indexPath, `// Generated from travel-route-cache.json; verified against the canonical cache in tests.
${parts.map((_, i) => `import part${i} from './route-cache/part-${i}.json';`).join('\n')}
const routes = {${parts.map((_, i) => `...part${i}`).join(',')}};
export default routes;
`);
console.log(`cache entries ${Object.keys(cache).length}, ${JSON.stringify(cache).length} bytes in ${parts.length} parts`);
