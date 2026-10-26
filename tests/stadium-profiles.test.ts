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

test('Tottenham Hotspur Stadium is far larger than Burgdorf and the caption says so', () => {
  const tottenham = stadiumProfile(tournamentVenue('champions-tottenham-hotspur'), { seed: 'spurs' });
  const burgdorf = stadiumProfile(club('SC Burgdorf 1898'), { seed: 'burgdorf' });
  assert.equal(tottenham.name, 'Tottenham Hotspur Stadium');
  assert.ok(tottenham.capacity > burgdorf.capacity * 10, `${tottenham.capacity} vs ${burgdorf.capacity}`);
  assert.match(stadiumLabel(tottenham), /Zuschauer von 62.800$/);
  assert.match(stadiumLabel(burgdorf), /Stadion Neumatt · .* \(Kapazität geschätzt\)$/);
});

test('one stadium has one capacity, whichever club or tournament leads there', () => {
  const byName = new Map<string, number>();
  for (const venue of [...Object.values(VENUES), ...SEASON_CLUBS.map(c => c.venue)]) {
    if (venue.id === HOME_VENUE.id || venue.id.startsWith('chaos-ground')) continue;
    const capacity = stadiumProfile(venue).capacity, seen = byName.get(venue.stadium);
    if (seen !== undefined) assert.equal(capacity, seen, venue.stadium);
    byName.set(venue.stadium, capacity);
  }
  assert.equal(stadiumProfile(VENUES.lugano).capacity, stadiumProfile(club('FC Lugano')).capacity);
  assert.equal(stadiumProfile(VENUES.stgallen).capacity, stadiumProfile(club('FC St. Gallen 1879')).capacity);
});

test('the crowd depends on the match: derby, final, weather, weekday and opponent', async () => {
  const { crowdBoost } = await import('../app/stadium-profiles');
  const venue = club('BSC Young Boys'), fill = (crowd: import('../app/stadium-profiles').CrowdFactors, seed = 'm') => stadiumProfile(venue, { seed, crowd }).attendance;
  const base = { opponentRating: 70, weather: 'clear' as const, time: 'day' as const, weekday: 6 };
  assert.ok(fill({ ...base, derby: true }) > fill(base), 'a derby draws more people');
  assert.ok(fill({ ...base, weather: 'rain' }) < fill(base), 'rain keeps people at home');
  assert.ok(fill({ ...base, weekday: 2 }) < fill(base), 'a weekday afternoon is emptier than a Saturday');
  assert.ok(fill({ ...base, opponentRating: 95 }) > fill({ ...base, opponentRating: 50 }), 'a strong opponent draws more people');
  assert.ok(fill({ ...base, cupRound: 3, cupRounds: 4 }) > fill({ ...base, cupRound: 1, cupRounds: 4 }), 'later cup rounds are fuller');
  assert.ok(crowdBoost({ tablePosition: 1, tableSize: 10 }) > crowdBoost({ tablePosition: 10, tableSize: 10 }), 'promotion race beats relegation battle');
  for (const seed of ['a', 'b', 'c', 'd']) {
    const final = stadiumProfile(venue, { seed, crowd: { ...base, weather: 'rain', cupRound: 4, cupRounds: 4 } });
    assert.ok(final.attendance >= final.capacity * .92 && final.attendance <= final.capacity, 'a final is close to sold out');
  }
  for (const c of SEASON_CLUBS.slice(0, 40)) for (const crowd of [{ ...base, derby: true, cupRound: 4, cupRounds: 4, opponentRating: 99 }, { weather: 'snow' as const, weekday: 2, time: 'day' as const, opponentRating: 40, tablePosition: 10, tableSize: 10 }]) {
    const p = stadiumProfile(c.venue, { seed: c.id, crowd });
    assert.ok(p.attendance > 0 && p.attendance <= p.capacity, c.name);
  }
});

test('the drawn stadium has every place visible and fills them like the attendance', async () => {
  const { computeAmbience, crowdSummary, stadiumBounds, stadiumView } = await import('../app/stadium-ambience');
  const small = stadiumProfile(club('FC Bethlehem BE'), { seed: 's' }), big = stadiumProfile(VENUES.milan, { seed: 's' });
  for (const profile of [small, big, stadiumProfile(club('BSC Young Boys'), { seed: 's' })]) {
    const ambience = { ...computeAmbience({ matchStartedAt: 1_000_000, fixture: undefined, careerMatchId: 'x', opponent: 'FC Test' }), stadium: profile };
    const { places, fans, away } = crowdSummary(ambience);
    assert.ok(places > 0, profile.name);
    assert.ok(Math.abs(fans / places - profile.attendance / profile.capacity) < .02, `${profile.name}: ${fans}/${places} vs ${profile.attendance}/${profile.capacity}`);
    assert.ok(away > 0 && away < fans / 4, `${profile.name}: away fans ${away}`);
    // The full camera shows the whole ground: its view contains the outer edge of every stand.
    const b = stadiumBounds(profile), v = stadiumView(profile);
    assert.ok(v.centerX - v.width / 2 < b.left && v.centerX + v.width / 2 > b.right && v.centerY - v.height / 2 < b.top && v.centerY + v.height / 2 > b.bottom);
  }
  assert.ok(stadiumView(big).width > stadiumView(small).width, 'a big stadium has deeper stands');
});
