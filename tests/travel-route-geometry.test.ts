// Buses follow real roads: every away fixture finds its cached road or rail, and journeys saved without
// geometry (planned before the route data arrived, or by an older version) are drawn on the road while their
// arrival time, events and fines stay exactly as saved.
import assert from 'node:assert/strict';
import test from 'node:test';
import { cachedLegPoints, ensureRouteCache, planJourney, routeCache, routeKey, withRouteGeometry } from '../app/journey-routing.ts';
import type { JourneyPlan } from '../app/journey-routing.ts';
import { HOME_VENUE, SEASON_CLUBS, VENUES, distanceKm, seasonGeography, tournamentVenue } from '../app/travel-geography.ts';
import type { Venue } from '../app/travel-geography.ts';
import { TOURNAMENTS } from '../app/feature-data.ts';
import { createJourney, emptyTravel, journeyView, normalizeTravel } from '../app/travel-data.ts';
import type { Journey, TravelFixture } from '../app/travel-data.ts';
import { projectRoutes, vehicleAt } from '../app/travel-map-geometry.ts';

const fixture = (venue: Venue): TravelFixture => ({ id: `test:${venue.id}`, mode: 'season', tournamentId: 'stadium', opponentId: 'test', opponent: 'Test', away: true, region: 5, venue, schedule: [] });

/** Every stadium a league match, a tournament round or the Wembley final can send the team to. */
function awayVenues() {
  const venues = new Map<string, Venue>();
  for (let division = 1; division <= 15; division++) for (let index = 0; index < 5; index++) { const v = seasonGeography(division, index).venue; venues.set(v.id, v); }
  for (const club of SEASON_CLUBS) venues.set(club.venue.id, club.venue);
  for (const t of TOURNAMENTS) for (const o of t.opponents) { const v = tournamentVenue(o.id); venues.set(v.id, v); }
  venues.set(VENUES.wembley.id, VENUES.wembley);
  venues.delete(HOME_VENUE.id);
  return [...venues.values()];
}

/** Straight legs between the hubs, as a plan made without the route data stores them. Times stay as planned. */
const straightened = (plan: JourneyPlan): JourneyPlan => ({ ...plan, segments: plan.segments.map((s) => s.mode === 'bus' || s.mode === 'train' ? { ...s, points: [s.from, s.to], geometry: 'approximate' as const } : s) });

test('every possible away fixture finds cached road or rail geometry for each ground leg', () => {
  const routes = routeCache(), venues = awayVenues();
  let legs = 0, exact = 0, spliced = 0, lastMetres = 0;
  for (const venue of venues) {
    const segments = planJourney(venue).segments;
    segments.forEach((s, i) => {
      if (s.mode !== 'bus' && s.mode !== 'train') return;
      legs++;
      if (routes[routeKey(s.from, s.to, s.mode)]) { exact++; assert.ok(s.points.length >= 3, `${venue.id}: ${s.label}`); return; }
      if (s.id.startsWith('road:')) { spliced++; assert.equal(s.geometry, 'road'); assert.ok(segments[i + 1].distanceKm < .15, `${venue.id}: ${s.label} ends too early`); return; }
      // Only the last metres after a cached road that ends next to the stadium are estimated.
      lastMetres++;
      assert.ok(segments[i - 1]?.id.startsWith('road:') && s.distanceKm < .15, `${venue.id}: ${s.label} has no geometry (${s.distanceKm.toFixed(2)} km)`);
    });
  }
  assert.ok(venues.length >= 100, `${venues.length} venues`);
  assert.equal(exact + spliced + lastMetres, legs);
  assert.ok(exact / legs > .8, `exact cache hits ${exact} of ${legs}`);
});

test('a plan made before the route data arrived has straight lines; the map draws it on the road with the same times', () => {
  for (const id of ['bern', 'luzern', 'basel', 'lugano', 'paris', 'madrid']) {
    const early = planJourney(VENUES[id], {});
    assert.ok(early.segments.filter((s) => s.mode === 'bus').every((s) => s.points.length === 2 && s.geometry === 'approximate'), id);
    const drawn = withRouteGeometry(early);
    assert.deepEqual(drawn.segments.map((s) => [s.id, s.realSeconds]), early.segments.map((s) => [s.id, s.realSeconds]), id);
    assert.equal(drawn.realSeconds, early.realSeconds);
    for (const s of drawn.segments) if ((s.mode === 'bus' && s.distanceKm > .15) || s.mode === 'train') assert.ok(s.points.length > 2 && (s.geometry === 'road' || s.geometry === 'rail'), `${id}: ${s.label}`);
  }
});

test('the server plans with the route data loaded', async () => {
  assert.equal(await ensureRouteCache(), true);
  assert.ok(Object.keys(routeCache()).length > 100);
});

test('a saved journey without road geometry keeps arrival, events and fines; only the drawn line changes', () => {
  for (const id of ['luzern', 'thun', 'lugano', 'vienna']) {
    const fresh = createJourney(fixture(VENUES[id]), 1_000_000, () => .2);
    const saved: Journey = { ...fresh, plan: straightened(fresh.plan!), events: [{ id: 'jam', text: 'Stau', at: Math.round(fresh.baseMs * .3), delta: Math.round(fresh.baseMs * .1), fine: 30 }] };
    saved.endsAt = saved.startedAt + saved.baseMs + saved.events[0].delta;
    const restored = normalizeTravel({ journey: saved, stats: emptyTravel().stats }).journey!;
    assert.ok(restored, id);
    const before = structuredClone(restored);
    const routes = projectRoutes(restored);
    const step = Math.max(1, Math.round((restored.endsAt - restored.startedAt) / 37));
    for (let t = restored.startedAt; t <= restored.endsAt + 1000; t += step) vehicleAt(routes, restored, t, journeyView(restored, t).progress);
    assert.deepEqual(restored, before, 'drawing never changes the saved journey');
    assert.equal(restored.endsAt, saved.endsAt);
    assert.deepEqual(restored.events, saved.events);
    assert.equal(journeyView(restored, saved.endsAt - 1).arrived, false);
    assert.equal(journeyView(restored, saved.endsAt).arrived, true);
    assert.equal(routes.length, restored.plan!.segments.length, 'one drawn line per planned leg');
    const bus = routes.filter((r) => r.mode === 'bus' && r.length > .15);
    assert.ok(bus.length && bus.every((r) => r.points.length > 2 && r.geometry === 'road'), id);
  }
});

test('the bus of a straight saved plan drives on the cached road', () => {
  const fresh = createJourney(fixture(VENUES.luzern), 0, () => .99);
  const saved: Journey = { ...fresh, events: [], plan: straightened(fresh.plan!) };
  saved.endsAt = saved.startedAt + saved.baseMs;
  const road = fresh.plan!.segments[0].points;
  const offRoad = (p: { lat: number; lon: number }) => Math.min(...road.map((q) => distanceKm(p, q)));
  const unproject = (x: number, y: number) => ({ lon: x * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI });
  const routes = projectRoutes(saved), straight = projectRoutes({ ...saved, plan: saved.plan });
  assert.ok(straight[0].points.length > 2);
  let worst = 0;
  for (let f = .05; f < .95; f += .05) { const v = vehicleAt(routes, saved, saved.startedAt + saved.baseMs * f, f); worst = Math.max(worst, offRoad(unproject(v.point.x, v.point.y))); }
  assert.ok(worst < 1, `vehicle strays ${worst.toFixed(2)} km from the road`);
});

test('cached geometry is matched with tolerance and never invented', () => {
  const bern = planJourney(VENUES.bern).segments[0];
  // Hub coordinates that differ in the last digits still find the road from the same start.
  const shifted = cachedLegPoints({ mode: 'bus', from: { lat: HOME_VENUE.lat + .00001, lon: HOME_VENUE.lon - .00001 }, to: { lat: bern.to.lat + .002, lon: bern.to.lon } });
  assert.ok(shifted && shifted.points.length > 2 && shifted.geometry === 'road');
  assert.equal(cachedLegPoints({ mode: 'bus', from: { lat: 47.7, lon: 11.9 }, to: { lat: 48.9, lon: 11.9 } }), null);
  assert.equal(cachedLegPoints({ mode: 'plane', from: HOME_VENUE, to: VENUES.tokyo }), null);
  // A legacy journey without a plan is drawn on the cached road too.
  const legacy: Journey = { ...createJourney(fixture(VENUES.basel), 0, () => .99), plan: undefined, transport: 'bus' };
  const [route] = projectRoutes(legacy);
  assert.ok(route.points.length > 2 && route.geometry === 'road');
});
