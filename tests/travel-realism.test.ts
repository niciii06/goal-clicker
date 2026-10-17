import assert from 'node:assert/strict';
import test from 'node:test';
import { planJourney } from '../app/journey-routing.ts';
import { HOME_VENUE, SEASON_CLUBS, VENUES, distanceKm } from '../app/travel-geography.ts';

const modes = (id: string) => planJourney(VENUES[id]).segments.filter((s) => s.mode !== 'wait').map((s) => s.mode);

test('every known destination travels on real road, rail or flight geometry', () => {
  const venues = new Map([...SEASON_CLUBS.map((c) => c.venue), ...Object.values(VENUES)].map((v) => [v.id, v]));
  venues.delete(HOME_VENUE.id);
  for (const venue of venues.values()) {
    for (const s of planJourney(venue).segments) {
      // A cached road may end a few metres before the stadium; only that last step is estimated.
      if (s.mode === 'bus') assert.ok(s.geometry === 'road' || (s.geometry === 'approximate' && s.distanceKm < .15), `${venue.id}: ${s.label}`);
      if (s.mode === 'train') assert.equal(s.geometry, 'rail', `${venue.id}: ${s.label}`);
      if (s.mode === 'plane') assert.equal(s.geometry, 'great-circle', `${venue.id}: ${s.label}`);
    }
  }
});

test('vehicles are chosen like a travelling team would', () => {
  assert.deepEqual(modes('basel'), ['bus']);
  assert.deepEqual(modes('munich'), ['bus']);
  assert.deepEqual(modes('lugano'), ['bus', 'train', 'bus']);
  assert.deepEqual(modes('paris'), ['bus', 'train', 'bus']);
  for (const id of ['leverkusen', 'dortmund', 'leipzig', 'amsterdam', 'vienna', 'london', 'madrid', 'tokyo']) assert.ok(modes(id).includes('plane'), id);
  assert.ok(!modes('london').includes('train'));
});

test('train and flight legs end at the hub next to the stadium', () => {
  const paris = planJourney(VENUES.paris).segments.find((s) => s.mode === 'train')!;
  assert.equal(paris.to.id, 'rail-paris');
  assert.match(paris.label, /TGV Lyria/);
  for (const [id, airport] of [['leverkusen', 'airport-CGN'], ['dortmund', 'airport-DTM'], ['leipzig', 'airport-LEJ'], ['eindhoven', 'airport-EIN']] as const) {
    const flight = planJourney(VENUES[id]).segments.filter((s) => s.mode === 'plane').at(-1)!;
    assert.equal(flight.to.id, airport);
    assert.ok(distanceKm(flight.to, VENUES[id]) < 35, id);
  }
});
