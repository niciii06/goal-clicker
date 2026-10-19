import assert from 'node:assert/strict';
import test from 'node:test';
import { stadiumProfile, homeCapacity, categoryForCapacity, stadiumLabel } from '../app/stadium-profiles';
import { matchStadium } from '../app/match-stadium';
import { HOME_VENUE, SEASON_CLUBS, VENUES, tournamentVenue } from '../app/travel-geography';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI } from '../app/feature-data';
import { createJourney, fixtureFor, consumeTravel } from '../app/travel-data';

const club = (name: string) => SEASON_CLUBS.find(c => c.name === name)!.venue;

test('small Bernese clubs play on compact grounds, Inter at San Siro', () => {
  const bethlehem = stadiumProfile(club('FC Bethlehem BE'));
  assert.equal(bethlehem.category, 'amateur');
  assert.equal(bethlehem.capacitySource, 'estimated');
  assert.equal(bethlehem.stands.top, 'none');
  const inter = stadiumProfile(tournamentVenue('champions-inter-milano'));
  assert.equal(inter.name, 'San Siro');
  assert.equal(inter.category, 'elite');
  assert.equal(inter.signature, 'san-siro');
  assert.equal(inter.capacitySource, 'known');
  const yb = stadiumProfile(club('BSC Young Boys'));
  assert.equal(yb.name, 'Stadion Wankdorf');
  assert.equal(yb.category, 'national');
  const thun = stadiumProfile(club('FC Thun Berner Oberland'));
  assert.equal(thun.category, 'pro-small');
  assert.ok(stadiumProfile(VENUES.wembley).capacity >= 90000);
  // Named sports fields stay small even in higher leagues.
  assert.ok(stadiumProfile(club('FC Langenthal')).capacity <= 2500);
});

test('categories grow with capacity and the home ground grows with the league', () => {
  assert.deepEqual([500, 2000, 8000, 20000, 40000, 70000].map(categoryForCapacity), ['amateur', 'regional', 'pro-small', 'pro-medium', 'national', 'elite']);
  for (let d = 2; d <= 15; d++) assert.ok(homeCapacity(d) > homeCapacity(d - 1));
  assert.equal(stadiumProfile(HOME_VENUE, { home: true, homeDivision: 1 }).category, 'amateur');
  assert.equal(stadiumProfile(HOME_VENUE, { home: true, homeDivision: 15 }).category, 'elite');
});

test('attendance depends on capacity and is not always a sell-out', () => {
  let below = 0;
  for (const c of SEASON_CLUBS) {
    const p = stadiumProfile(c.venue, { seed: c.id });
    assert.ok(p.attendance > 0 && p.attendance <= p.capacity, c.name);
    if (p.attendance < p.capacity) below++;
  }
  assert.ok(below > SEASON_CLUBS.length * .8);
  assert.ok(stadiumProfile(club('FC Bethlehem BE')).attendance < stadiumProfile(VENUES.milan).attendance / 100);
  assert.match(stadiumLabel(stadiumProfile(VENUES.milan, { seed: 'x' })), /San Siro · Elitestadion · .* Zuschauer von 75.800/);
});

test('the away journey and the match use the same stadium', () => {
  const f = initialGameFeatures(1000);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map(p => p.id) });
  f.seasonMode.matchday = 1;
  const fixture = fixtureFor(f, 'season');
  assert.equal(fixture.away, true);
  f.travel.journey = createJourney(fixture, 1000, () => .99, f);
  consumeTravel(f, fixture);
  const destination = stadiumProfile(f.travel.journey.fixture.venue);
  assert.equal(matchStadium(f).name, destination.name);
  assert.equal(matchStadium(f).capacity, destination.capacity);
  // Home matches use the club's own ground.
  const home = initialGameFeatures(1000);
  home.cup.fixture = { id: 'h', away: false, venue: HOME_VENUE, opponentId: 'x' };
  assert.equal(matchStadium(home).capacitySource, 'club-growth');
});
