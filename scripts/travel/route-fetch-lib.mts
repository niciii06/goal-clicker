// Shared helpers of the route cache generators (fetch-real-routes.mts for Bern, fetch-home-city-routes.mts for the
// other home cities): cached requests to the public routing services, simplification and writing the cache.
// Responses are kept in ROUTE_FETCH_CACHE (default: the system temp directory) so reruns are offline.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceKm } from '../../app/travel-geography.ts';
import { HOME_CITY_IDS, homeCityOf, homeVenueOf } from '../../app/home-cities.ts';
import type { HomeCityId } from '../../app/home-cities.ts';
import { STATIONS } from '../../app/journey-routing.ts';
import type { GeoPoint } from '../../app/travel-geography.ts';

export type Cached = { points: GeoPoint[]; seconds: number; km: number; source: string; geometry: 'road'|'rail'|'approximate' };
export const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const cachePath = join(root, 'app/travel-route-cache.json');
const partsDir = join(root, 'app/route-cache');
const responseDir = process.env.ROUTE_FETCH_CACHE ?? join(tmpdir(), 'goal-clicker-route-fetch');
mkdirSync(responseDir, { recursive: true });

export const readCache = (): Record<string, Cached> => JSON.parse(readFileSync(cachePath, 'utf8'));

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

export function osrm(a: GeoPoint, b: GeoPoint) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
  const data = get(url) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
  if (!route) throw new Error(`OSRM found no road ${JSON.stringify([a, b])}: ${data.code}`);
  return { points: route.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })), km: route.distance / 1000, seconds: route.duration };
}

export function brouterRail(a: GeoPoint, b: GeoPoint) {
  const url = `https://brouter.de/brouter?lonlats=${a.lon},${a.lat}|${b.lon},${b.lat}&profile=rail&alternativeidx=0&format=geojson`;
  const data = get(url) as { features?: { geometry: { coordinates: number[][] }; properties: Record<string, string> }[] };
  const feature = data.features?.[0];
  if (!feature) throw new Error(`BRouter found no railway ${JSON.stringify([a, b])}`);
  return { points: feature.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })), km: Number(feature.properties['track-length']) / 1000 };
}

export const pathKm = (points: GeoPoint[]) => points.slice(1).reduce((n, p, i) => n + distanceKm(points[i], p), 0);

// Douglas-Peucker in metres; long routes are drawn on a small map, so they keep fewer vertices.
export function simplify(points: GeoPoint[], km: number) {
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
export const anchored = (a: GeoPoint, points: GeoPoint[], b: GeoPoint) => [{ lat: a.lat, lon: a.lon }, ...points, { lat: b.lat, lon: b.lon }];

/** The home city a leg belongs to when it leaves from that city's home ground or home station, else null (shared). */
function ownerOf(key: string): HomeCityId | null {
  const from = key.split(':')[1];
  for (const city of HOME_CITY_IDS) {
    if (city === 'bern') continue;
    const home = homeVenueOf(city), station = STATIONS[homeCityOf(city).station as keyof typeof STATIONS];
    if ([home, station].some((p) => from === `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)) return city;
  }
  return null;
}

/**
 * Writes the canonical cache (server and tests import it whole) and the browser parts: base.json with Bern and every
 * shared leg, and one file per other home city with the legs that leave from its home ground or station.
 */
export function writeCache(cache: Record<string, Cached>) {
  writeFileSync(cachePath, JSON.stringify(cache));
  for (const file of readdirSync(partsDir)) if (/\.json$/.test(file)) rmSync(join(partsDir, file));
  const parts: Record<string, Record<string, Cached>> = { base: {} };
  for (const city of HOME_CITY_IDS) if (city !== 'bern') parts[city] = {};
  for (const [key, route] of Object.entries(cache)) parts[ownerOf(key) ?? 'base'][key] = route;
  for (const [name, part] of Object.entries(parts)) writeFileSync(join(partsDir, `${name}.json`), JSON.stringify(part));
  return { entries: Object.keys(cache).length, bytes: JSON.stringify(cache).length, parts: Object.fromEntries(Object.entries(parts).map(([name, part]) => [name, Object.keys(part).length])) };
}
