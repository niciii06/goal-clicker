import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cameraCenter, cameraReducer, flightAltitude, flightDistanceFraction, initialCamera, projectRoutes, vehicleAt, MAX_MAP_ZOOM } from '../app/travel-map-geometry.ts';
import { createJourney } from '../app/travel-data.ts';
import type { TravelFixture } from '../app/travel-data.ts';
import { distanceKm, routePoints, HOME_VENUE, VENUES } from '../app/travel-geography.ts';
import { planJourney } from '../app/journey-routing.ts';
import { TravelMap } from '../app/travel-map.tsx';

const now = 1900000000000;
const fixture = (venue: keyof typeof VENUES): TravelFixture => ({ id: `fixture-${venue}`, mode: 'tournament', tournamentId: 'world', opponentId: venue, opponent: venue, away: true, region: 14, venue: VENUES[venue], schedule: [] });

test('zooming while following keeps Follow active and the vehicle centred', () => {
  let camera = initialCamera(14, { x: .5, y: .3 });
  const vehicle = { x: .52, y: .31 };
  for (const delta of [1, 1, 1, -1, -1, -1, -1]) {
    camera = cameraReducer(camera, { type: 'zoom', delta });
    assert.equal(camera.follow, true, 'buttons, wheel and pinch all dispatch zoom and never end following');
    assert.deepEqual(cameraCenter(camera, vehicle), vehicle);
  }
  assert.equal(camera.zoom, 13);
  assert.equal(cameraReducer(initialCamera(MAX_MAP_ZOOM, vehicle), { type: 'zoom', delta: 1 }).zoom, MAX_MAP_ZOOM);
});

test('panning ends following and re-enabling Follow keeps the exact zoom level', () => {
  let camera = initialCamera(9, { x: .5, y: .3 });
  camera = cameraReducer(camera, { type: 'zoom', delta: 3 });
  camera = cameraReducer(camera, { type: 'pan', center: { x: .4, y: .2 } });
  assert.equal(camera.follow, false);
  assert.equal(camera.zoom, 12, 'panning does not change zoom');
  const vehicle = { x: .61, y: .33 };
  camera = cameraReducer(camera, { type: 'follow', vehicle });
  assert.equal(camera.follow, true);
  assert.equal(camera.zoom, 12, 'Follow only recentres');
  assert.deepEqual(cameraCenter(camera, vehicle), vehicle);
  // A new vehicle type may only suggest a zoom until the user has picked one.
  assert.equal(cameraReducer(camera, { type: 'suggest', zoom: 5 }).zoom, 12);
  assert.equal(cameraReducer(initialCamera(14, vehicle), { type: 'suggest', zoom: 5 }).zoom, 5);
  // Turning Follow off keeps the vehicle on screen instead of jumping to an old centre.
  const off = cameraReducer(camera, { type: 'unfollow', vehicle });
  assert.equal(off.follow, false);
  assert.deepEqual(off.center, vehicle);
  assert.equal(off.zoom, 12);
});

test('flight speed profile is continuous and monotonic from runway to runway', () => {
  let last = 0;
  for (let i = 0; i <= 1000; i++) {
    const value = flightDistanceFraction(i / 1000);
    assert.ok(value >= last - 1e-12, 'never flies backwards');
    assert.ok(value - last < .0025, 'no sudden jump');
    last = value;
  }
  assert.equal(flightDistanceFraction(0), 0);
  assert.ok(Math.abs(flightDistanceFraction(1) - 1) < 1e-12);
  assert.ok(flightDistanceFraction(.05) < .05, 'slow during take-off');
  assert.equal(flightAltitude(0), 0);
  assert.equal(flightAltitude(.5), 1);
});

test('flight routes are geodesic, continuous across the map and connect every leg', () => {
  for (const venue of ['tokyo', 'sydney', 'miami', 'rio', 'lisbon'] as const) {
    const plan = planJourney(VENUES[venue]);
    const flights = plan.segments.filter(s => s.mode === 'plane');
    assert.ok(flights.length >= 1, `${venue} is reached by air`);
    for (let i = 1; i < plan.segments.length; i++) assert.ok(distanceKm(plan.segments[i - 1].to, plan.segments[i].from) < .01, `${venue}: leg ${i} starts where the previous one ended`);
    for (const flight of flights) {
      assert.equal(flight.geometry, 'great-circle');
      assert.ok(distanceKm(flight.points[0], flight.from) < .01 && distanceKm(flight.points.at(-1)!, flight.to) < .01, 'starts and ends at the airports');
      assert.ok(flight.points.slice(1).every((p, i) => distanceKm(flight.points[i], p) <= 45), 'dense waypoints');
      // A great circle never is longer than the sum of its pieces by more than rounding.
      const along = flight.points.slice(1).reduce((n, p, i) => n + distanceKm(flight.points[i], p), 0);
      assert.ok(Math.abs(along - distanceKm(flight.from, flight.to)) < 1, `${venue}: no detours or loops`);
    }
    const journey = { ...createJourney(fixture(venue), now, () => .99), events: [] };
    const routes = projectRoutes(journey);
    for (const route of routes) for (let i = 1; i < route.projected.length; i++) assert.ok(Math.abs(route.projected[i].x - route.projected[i - 1].x) < .2, `${venue}: projected route never wraps across the map`);
    // Sample the whole trip: the vehicle moves continuously, also between legs.
    let previous = vehicleAt(routes, journey, journey.startedAt, 0).point;
    const steps = 4000;
    for (let i = 1; i <= steps; i++) {
      const at = journey.startedAt + (journey.endsAt - journey.startedAt) * i / steps;
      const current = vehicleAt(routes, journey, at, i / steps);
      assert.ok(Number.isFinite(current.point.x) && Number.isFinite(current.point.y) && Number.isFinite(current.bearing));
      assert.ok(Math.hypot(current.point.x - previous.x, current.point.y - previous.y) < .01, `${venue}: no teleport at step ${i}`);
      previous = current.point;
    }
  }
});

test('legacy journeys without a stored plan still render a great circle', () => {
  const route = routePoints(HOME_VENUE, VENUES.tokyo, true);
  assert.ok(route.length > 65);
  const journey = { ...createJourney(fixture('tokyo'), now, () => .99) };
  delete (journey as { plan?: unknown }).plan;
  const html = renderToStaticMarkup(createElement(TravelMap, { journey, now: now + 1000, progress: .5 }));
  assert.match(html, /Folgen/);
  assert.match(html, /aria-pressed="true"/);
});
