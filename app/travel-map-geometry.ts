// Pure geometry and camera state for the travel map. No React and no network work lives here,
// so the follow and zoom rules and the vehicle path can be tested without a browser.
import { HOME_VENUE } from './travel-geography';
import { distanceKm, routePoints } from './travel-geography';
import type { GeoPoint } from './travel-geography';
import { journeyClock, segmentAt } from './journey-routing';
import type { Journey } from './travel-data';

export type MapPoint = { x: number; y: number };
export type MapMode = 'walk'|'bike'|'car'|'bus'|'train'|'plane'|'wait';
export type ProjectedRoute = { id: string; mode: MapMode; geometry: string; points: GeoPoint[]; projected: MapPoint[]; cumulative: number[]; length: number; name?: string };
export type VehicleState = { point: MapPoint; bearing: number; mode: MapMode; index: number; altitude: number };

export const MIN_MAP_ZOOM = 1, MAX_MAP_ZOOM = 17;
/** Share of a flight's time spent accelerating on take-off and decelerating on landing. */
export const FLIGHT_RAMP = .12;

/** Web Mercator projection to the unit square used by the OSM tiles. */
export function project(p: GeoPoint): MapPoint {
  const lat = Math.max(-85, Math.min(85, p.lat));
  return { x: (p.lon + 180) / 360, y: (1 - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) / Math.PI) / 2 };
}

/** Projects every segment and keeps x continuous across the date line, so a route never jumps across the map. */
export function projectRoutes(journey: Journey): ProjectedRoute[] {
  const segments = journey.plan?.segments ?? [{ id: 'legacy', mode: journey.transport, geometry: 'approximate', points: routePoints(journey.origin ?? HOME_VENUE, journey.fixture.venue, journey.transport === 'plane'), to: undefined }];
  let previous: number | undefined;
  return segments.map(segment => {
    const projected = segment.points.map(p => {
      const value = project(p);
      if (previous !== undefined) value.x += Math.round(previous - value.x);
      previous = value.x;
      return value;
    });
    const cumulative = [0];
    for (let i = 1; i < segment.points.length; i++) cumulative.push(cumulative[i - 1] + distanceKm(segment.points[i - 1], segment.points[i]));
    const to = 'to' in segment ? segment.to as { name?: string } | undefined : undefined;
    return { id: segment.id, mode: segment.mode as MapMode, geometry: segment.geometry, points: segment.points, projected, cumulative, length: cumulative.at(-1) ?? 0, name: to?.name };
  });
}

/** Fraction of the flown distance after a fraction of the flight time: smooth take-off, cruise and landing. */
export function flightDistanceFraction(timeFraction: number, ramp = FLIGHT_RAMP) {
  const u = Math.max(0, Math.min(1, timeFraction)), area = 1 - ramp;
  if (u < ramp) return u * u / (2 * ramp) / area;
  if (u <= 1 - ramp) return (u - ramp / 2) / area;
  return 1 - (1 - u) * (1 - u) / (2 * ramp) / area;
}

/** Visual altitude between 0 (runway) and 1 (cruise) for the flight icon. */
export function flightAltitude(timeFraction: number) {
  const u = Math.max(0, Math.min(1, timeFraction)), climb = .2;
  return u < climb ? u / climb : u > 1 - climb ? (1 - u) / climb : 1;
}

function pointAlong(route: ProjectedRoute, distance: number) {
  const { cumulative, projected } = route;
  if (projected.length < 2 || route.length <= 0) return { point: { ...projected[0] }, segment: 0 };
  const d = Math.max(0, Math.min(route.length, distance));
  let low = 0, high = cumulative.length - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (cumulative[mid] <= d) low = mid; else high = mid; }
  const span = cumulative[high] - cumulative[low], t = span > 0 ? (d - cumulative[low]) / span : 0, a = projected[low], b = projected[high];
  return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, segment: low };
}

/** Screen bearing in degrees (0 = north, clockwise) from the projected direction of travel. */
function bearingAt(route: ProjectedRoute, distance: number) {
  const step = Math.max(route.length * .01, .05), ahead = pointAlong(route, Math.min(route.length, distance + step)).point, behind = pointAlong(route, Math.max(0, distance - step)).point;
  const dx = ahead.x - behind.x, dy = ahead.y - behind.y;
  return dx || dy ? Math.atan2(dx, -dy) * 180 / Math.PI : 0;
}

/** Vehicle position for an elapsed game time. Uses the stored plan, so it is identical after a reload. */
export function vehicleAt(routes: ProjectedRoute[], journey: Journey, now: number, progress: number): VehicleState {
  // The event clock stops the vehicle in a jam and speeds it up after a saving, so it arrives at the arrival time.
  const stage = journey.plan ? segmentAt(journey.plan, (now >= journey.endsAt ? journey.baseMs : journeyClock(journey, now)) / 1000) : null;
  const index = stage?.index ?? 0, route = routes[index] ?? routes[0], time = stage?.fraction ?? progress;
  const plane = route.mode === 'plane';
  const distance = route.length * (plane ? flightDistanceFraction(time) : Math.max(0, Math.min(1, time)));
  if (route.mode === 'wait') {
    // Waiting keeps the vehicle on the previous route end and its last heading.
    const before = routes[index - 1];
    return { point: { ...route.projected[0] }, bearing: before ? bearingAt(before, before.length) : 0, mode: 'wait', index, altitude: 0 };
  }
  return { point: pointAlong(route, distance).point, bearing: bearingAt(route, distance), mode: route.mode, index, altitude: plane ? flightAltitude(time) : 0 };
}

/** Suggested zoom for a vehicle type, used until the user picks a zoom level. */
export function suggestedZoom(mode: MapMode, fitZoom: number) {
  return mode === 'plane' ? Math.min(6, fitZoom + 1) : mode === 'train' ? 10 : mode === 'wait' ? 12 : 14;
}

export function fitRoutes(routes: ProjectedRoute[]) {
  const points = routes.flatMap(r => r.projected), xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const zoom = Math.max(MIN_MAP_ZOOM, Math.min(15, Math.floor(Math.log2(Math.min(650 / Math.max(.00001, maxx - minx) / 256, 230 / Math.max(.00001, maxy - miny) / 256)))));
  return { zoom, center: { x: (minx + maxx) / 2, y: (miny + maxy) / 2 } };
}

// Camera: follow state, centre and zoom are independent. Zooming never ends following;
// only a manual pan does, and re-enabling Follow only moves the centre.
export type MapCamera = { zoom: number; center: MapPoint; follow: boolean; userZoom: boolean };
export type CameraAction =
  | { type: 'zoom'; delta: number }
  | { type: 'pan'; center: MapPoint }
  | { type: 'follow'; vehicle: MapPoint }
  | { type: 'unfollow'; vehicle: MapPoint }
  | { type: 'fit'; zoom: number; center: MapPoint }
  | { type: 'suggest'; zoom: number };

export function initialCamera(zoom: number, center: MapPoint): MapCamera {
  return { zoom: clampZoom(zoom), center, follow: true, userZoom: false };
}
export function clampZoom(zoom: number) { return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, Math.round(zoom))); }

export function cameraReducer(state: MapCamera, action: CameraAction): MapCamera {
  switch (action.type) {
    case 'zoom': { const zoom = clampZoom(state.zoom + action.delta); return zoom === state.zoom ? state : { ...state, zoom, userZoom: true }; }
    case 'pan': return { ...state, center: { x: action.center.x, y: Math.max(0, Math.min(1, action.center.y)) }, follow: false };
    case 'follow': return { ...state, center: { ...action.vehicle }, follow: true };
    case 'unfollow': return { ...state, center: { ...action.vehicle }, follow: false };
    case 'fit': return { zoom: clampZoom(action.zoom), center: action.center, follow: false, userZoom: true };
    case 'suggest': return state.userZoom || clampZoom(action.zoom) === state.zoom ? state : { ...state, zoom: clampZoom(action.zoom) };
  }
}

export function cameraCenter(state: MapCamera, vehicle: MapPoint) { return state.follow ? vehicle : state.center; }
