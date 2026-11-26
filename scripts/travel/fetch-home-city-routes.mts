// Fills the route cache for the home cities other than Bern (Zürich, Basel, Genève): every bus and train leg that
// planJourney can choose from their home ground and home station to the grounds of their regional catalogue, the
// tournament venues and the neutral final. Run with: npx tsx scripts/travel/fetch-home-city-routes.mts
// Roads: FOSSGIS OSRM. Rails: BRouter rail profile. The home grounds of these cities are fictional clubs on public,
// mapped pitches (app/home-cities.ts), so their coordinates may go to the routing services; Bern's private home
// origin stays with fetch-real-routes.mts. Existing cache entries are never overwritten.
import { journeyCandidates, STATIONS } from '../../app/journey-routing.ts';
import type { Segment } from '../../app/journey-routing.ts';
import { HOME_CITY_IDS, homeCityOf, homeVenueOf, worldCatalog } from '../../app/home-cities.ts';
import { tournamentVenue, VENUES } from '../../app/travel-geography.ts';
import type { Venue } from '../../app/travel-geography.ts';
import { TOURNAMENTS } from '../../app/features/catalog.ts';
import { anchored, brouterRail, osrm, pathKm, readCache, simplify, writeCache } from './route-fetch-lib.mts';

const DATE = new Date().toISOString().slice(0, 10);
const cache = readCache();
const legs = new Map<string, Segment>();
for (const city of HOME_CITY_IDS.filter((id) => id !== 'bern')) {
  const origin = homeVenueOf(city), station = STATIONS[homeCityOf(city).station as keyof typeof STATIONS];
  const destinations = new Map<string, Venue>();
  for (const club of worldCatalog(city)) if (club.venue && club.venue.id !== origin.id) destinations.set(club.venue.id, club.venue as Venue);
  for (const t of TOURNAMENTS) for (const o of t.opponents) { const v = tournamentVenue(o.id); if (v.id !== origin.id) destinations.set(v.id, v); }
  destinations.set(VENUES.wembley.id, VENUES.wembley);
  for (const venue of destinations.values()) {
    const c = journeyCandidates(venue, origin, station);
    for (const s of [...(c.roadAllowed ? c.road : []), ...(c.rail ?? []), ...c.air.flat()]) {
      if ((s.mode === 'bus' || s.mode === 'train') && !cache[s.id]) legs.set(s.id, s);
    }
  }
}
console.log(`legs to fetch: ${legs.size} (${[...legs.values()].filter((s) => s.mode === 'train').length} railway)`);

let done = 0, failed = 0;
for (const [key, s] of legs) {
  try {
    if (s.mode === 'train') {
      const rail = brouterRail(s.from, s.to), points = anchored(s.from, rail.points, s.to), km = pathKm(points);
      cache[key] = { points: simplify(points, km), seconds: km / 95 * 3600 + 600, km, geometry: 'rail', source: `© OpenStreetMap contributors / BRouter rail profile, ${DATE}. Railway track geometry; station approaches approximate; journey time estimated.` };
    } else {
      const road = osrm(s.from, s.to), points = anchored(s.from, road.points, s.to), km = pathKm(points);
      cache[key] = { points: simplify(points, km), seconds: road.seconds, km, geometry: 'road', source: `© OpenStreetMap contributors / FOSSGIS OSRM, ${DATE}. Road geometry; endpoint approaches approximate; bus time estimated.` };
    }
  } catch (error) {
    failed++;
    console.warn(`  no geometry for ${key}: ${(error as Error).message}`);
  }
  done++;
  if (done % 20 === 0) console.log(`  ${done}/${legs.size}`);
}
const written = writeCache(cache);
console.log(`fetched ${done - failed}, failed ${failed}; cache entries ${written.entries}, ${written.bytes} bytes, browser parts ${JSON.stringify(written.parts)}`);
