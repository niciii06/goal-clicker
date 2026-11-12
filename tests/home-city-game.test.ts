// Stadium Phase 1 in the game (owner's decision of 12 November 2026): a new game chooses Bern, Zürich, Basel or Genève;
// saves without a city stay in Bern exactly as before; the city sets home ground, local leagues and where journeys
// start; it changes only with a Prestige. Six clubs per league and one up, one down stay in every city.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SEASON_MODE_DIVISION_COUNT, SEASON_MODE_MATCHES_PER_SEASON, STAR_XI_PLAYERS, applySeasonPrestige, chooseHomeCity, getHomeCityBlockReason, getSeasonModeDivisionLabel, initialGameFeatures, normalizeGameFeatures, normalizeSeasonModeState, recordSeasonModeMatch, setBestStarXI } from '../app/feature-data.ts';
import type { GameFeatures, SeasonModeState } from '../app/feature-data.ts';
import { HOME_CITIES, catalogOf, homeVenueOf } from '../app/home-cities.ts';
import { HOME_VENUE, LEAGUE_MEMBERS, SEASON_CLUBS, VENUES, classifyDestination, defaultAiLeagues, seasonClubsOf } from '../app/travel-geography.ts';
import { OWN_CLUB_ID } from '../app/season-leagues.ts';
import { createJourney, fixtureFor, travelTiming } from '../app/travel-data.ts';
import { STATIONS, journeyCandidates, planJourney } from '../app/journey-routing.ts';
import { applyGamePrestige } from '../app/game/prestige.ts';

const lcg = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const opponents = (state: SeasonModeState) => state.table.filter((row) => row.id !== 'club').map((row) => row.clubId);
const reload = (features: GameFeatures) => normalizeGameFeatures(JSON.parse(JSON.stringify(features)));

test('an old save without a home city plays in Bern exactly as before', () => {
  const old = initialGameFeatures(1_000);
  assert.equal('homeCity' in old.seasonMode, false, 'nothing new is written into a Bern save');
  const reloaded = reload(old);
  assert.equal(reloaded.seasonMode.homeCity, undefined);
  assert.deepEqual(reloaded.seasonMode, normalizeSeasonModeState(JSON.parse(JSON.stringify(old.seasonMode)), old.club.name));
  // The Chaosliga clubs of today, the Bern home ground, Bern league names and Bern journeys.
  assert.deepEqual(opponents(reloaded.seasonMode), seasonClubsOf(1, undefined, SEASON_CLUBS).slice(0, 5).map((club) => club.id));
  assert.equal(reloaded.seasonMode.fixtures![0].venue, HOME_VENUE);
  assert.equal(getSeasonModeDivisionLabel(2, reloaded.seasonMode.homeCity), getSeasonModeDivisionLabel(2));
  const fixture = fixtureFor(reloaded, 'season');
  assert.equal(fixture.home, undefined);
  // An unknown or explicit Bern value is the same Bern save.
  for (const value of ['paris', 'bern', 42]) assert.equal(normalizeSeasonModeState({ ...old.seasonMode, homeCity: value }).homeCity, undefined);
  // Travel categories for every catalogue club are unchanged without a home region.
  for (const club of SEASON_CLUBS) assert.equal(classifyDestination(club.venue), classifyDestination(club.venue, false, undefined), club.name);
});

test('a new game chooses its city before the first league match; afterwards only a Prestige changes it', () => {
  const fresh = initialGameFeatures(1_000);
  assert.equal(getHomeCityBlockReason(fresh), '');
  const zurich = chooseHomeCity(fresh, 'zurich');
  assert.equal(zurich.error, '');
  const season = reload(zurich.features).seasonMode;
  assert.equal(season.homeCity, 'zurich', 'the choice survives a reload');
  const local = new Set(catalogOf('zurich').filter((club) => 16 - club.league === 1).map((club) => club.id));
  assert.ok(opponents(season).every((id) => id && local.has(id)), 'the Chaosliga opponents are the Zürich ones');
  assert.ok(opponents(season).every((id) => id!.startsWith('zh-')));
  assert.deepEqual(season.fixtures!.filter((f) => !f.away).map((f) => f.venue.id), new Array(5).fill(HOME_CITIES.zurich.homeVenue.id));
  assert.match(getSeasonModeDivisionLabel(2, season.homeCity), /Zürcher Quartierliga/);
  assert.match(getSeasonModeDivisionLabel(9, season.homeCity), /Deutschschweizer Liga/, 'national leagues keep their names');
  // Back to Bern removes the field again; a change of mind is free until kick-off.
  assert.equal('homeCity' in chooseHomeCity(zurich.features, 'bern').features.seasonMode, false);
  // After the first league match the city is fixed.
  const played = structuredClone(zurich.features);
  played.seasonMode = recordSeasonModeMatch(played.seasonMode, 2, 1, played.club.name, 2_000, lcg(1)).state;
  assert.match(getHomeCityBlockReason(played), /Prestige/);
  const refused = chooseHomeCity(played, 'basel');
  assert.match(refused.error, /Prestige/);
  assert.equal(refused.features.seasonMode.homeCity, 'zurich');
});

test('every city keeps six clubs per league and one up, one down per boundary over several seasons', () => {
  for (const city of ['zurich', 'basel', 'geneve'] as const) {
    let state = chooseHomeCity(initialGameFeatures(1_000), city).features.seasonMode;
    const random = lcg(city.length);
    for (let season = 0; season < 3; season++) {
      for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON; day++) state = recordSeasonModeMatch(state, season === 1 ? 0 : 3, season === 1 ? 3 : 0, 'FC Goal', 10_000 * season + day, random).state;
      state = normalizeSeasonModeState(JSON.parse(JSON.stringify(state)));
      assert.equal(state.homeCity, city);
      const catalog = catalogOf(city);
      const map = state.aiLeagues ?? defaultAiLeagues(state.division, catalog);
      const all = Array.from({ length: 15 }, (_, i) => [...seasonClubsOf(i + 1, map, catalog).map((club) => club.id), ...(state.division === i + 1 ? [OWN_CLUB_ID] : [])]);
      assert.deepEqual(all.map((list) => list.length), new Array(15).fill(LEAGUE_MEMBERS), `${city} season ${season + 1}`);
      assert.equal(new Set(all.flat()).size, catalog.length + 1);
      assert.ok(state.lastAiMoves?.length, `${city}: clubs moved after season ${season + 1}`);
      {
        for (let b = 1; b < 15; b++) {
          assert.equal(state.lastAiMoves!.filter((m) => m.from === b && m.to === b + 1).length, 1, `${city} up at ${b}`);
          assert.equal(state.lastAiMoves!.filter((m) => m.from === b + 1 && m.to === b).length, 1, `${city} down at ${b}`);
        }
      }
      assert.ok(opponents(state).every((id) => catalog.some((club) => club.id === id)), 'opponents come from this city\'s catalogue');
    }
  }
});

const SPECIALS = ['star-goat-nicu', 'star-maetthu', 'star-pfuschi', 'star-champ-simu'];
const NORMALS = STAR_XI_PLAYERS.filter((player) => !player.isCustom && !player.retired && !player.id.startsWith('scrap-')).slice(0, 24).map((player) => player.id);
function hallOfFame(homeCity?: 'zurich'): GameFeatures {
  let features = initialGameFeatures(1_000_000);
  if (homeCity) features = chooseHomeCity(features, homeCity).features;
  features.starterSquadGranted = true;
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: [...SPECIALS, ...NORMALS] }, []);
  features.seasonMode = { ...features.seasonMode, division: SEASON_MODE_DIVISION_COUNT, highestDivision: SEASON_MODE_DIVISION_COUNT, hallOfFame: true, prestigeCount: 0, history: [{ id: 'h', division: 15, matchday: 10, opponent: 'X', opponentRating: 90, clubScore: 1, opponentScore: 0, outcome: 'win', completedSeason: true, seasonOutcome: 'hall-of-fame', createdAt: 1 }] };
  return normalizeGameFeatures(features);
}

test('a Prestige can move the club to another city; without a choice it keeps its city', () => {
  const zurichClub = hallOfFame('zurich');
  assert.match(getHomeCityBlockReason(zurichClub), /Prestige/, 'a club in the Hall of Fame changes city only through Prestige');
  const kept = applySeasonPrestige(zurichClub, NORMALS[0], 2_000_000, 'p-keep');
  assert.equal(kept.error, '');
  assert.equal(kept.features.seasonMode.homeCity, 'zurich');
  assert.equal(kept.features.seasonMode.division, 1);
  const moved = applySeasonPrestige(zurichClub, NORMALS[0], 2_000_000, 'p-move', 'geneve');
  assert.equal(moved.features.seasonMode.homeCity, 'geneve');
  assert.equal(moved.features.seasonMode.aiLeagues, undefined, 'the new run starts in the catalogue leagues of Genève');
  assert.ok(opponents(moved.features.seasonMode).every((id) => id!.startsWith('ge-')));
  assert.equal(moved.features.seasonMode.fixtures!.find((f) => !f.away)!.venue.id, HOME_CITIES.geneve.homeVenue.id);
  const toBern = applySeasonPrestige(zurichClub, NORMALS[0], 2_000_000, 'p-bern', 'bern');
  assert.equal('homeCity' in toBern.features.seasonMode, false);
  // An old Bern save chooses a city at its Prestige; the whole game reset carries it (single player and co-op).
  const game = { goals: 5, seasonGoals: 5, totalGoals: 5, seasons: 14, stars: 3, upgrades: {}, features: hallOfFame() };
  const result = applyGamePrestige(game, NORMALS[0], 2_000_000, 'p-game', 'basel');
  assert.equal(result.error, '');
  assert.equal(result.game.features.seasonMode.homeCity, 'basel');
  assert.match(getHomeCityBlockReason(result.game.features), /Prestige/, 'after a Prestige the choice is closed again (it was made in the Prestige)');
});

test('journeys start at the chosen home ground and use its station; Bern journeys stay unchanged', () => {
  const zurich = chooseHomeCity(initialGameFeatures(1_000), 'zurich').features;
  zurich.seasonMode = { ...zurich.seasonMode, matchday: 1 };
  const away = fixtureFor(zurich, 'season');
  assert.equal(away.away, true);
  assert.equal(away.home, 'zurich');
  const timing = travelTiming(away);
  assert.ok(timing.km < 15, `a Chaosliga trip in Zürich is short (${timing.km.toFixed(1)} km)`);
  const journey = createJourney(away, 3_000, lcg(2), zurich);
  assert.equal(journey.origin!.id, HOME_CITIES.zurich.homeVenue.id);
  assert.ok(Math.abs(journey.plan!.segments[0].from.lat - HOME_CITIES.zurich.homeVenue.lat) < 1e-6, 'the bus leaves from the Zürich ground');
  // A long domestic trip boards the train at Zürich HB, never at Bern.
  const candidates = journeyCandidates(VENUES.lausanne, HOME_CITIES.zurich.homeVenue, STATIONS.zurich);
  assert.ok(candidates.rail, 'Lausanne is reached by train');
  assert.equal(candidates.rail![0].to.id, STATIONS.zurich.id);
  assert.equal(candidates.rail![0].label, 'Teambus zum Zürich HB');
  assert.equal(candidates.rail!.find((s) => s.mode === 'train')!.from.id, STATIONS.zurich.id);
  const lausanne = planJourney(VENUES.lausanne, undefined, HOME_CITIES.zurich.homeVenue, STATIONS.zurich);
  assert.ok(!lausanne.segments.some((s) => s.from.id === STATIONS.bern.id || s.label.includes('Bahnhof Bern')));
  assert.equal(journeyCandidates(VENUES.geneva).rail![0].label, 'Teambus zum Bahnhof Bern', 'Bern keeps its wording');
  // Travel categories from Zürich: own city near, the Lake Geneva region in the other language region.
  assert.ok(classifyDestination(HOME_CITIES.zurich.regionalClubs[0].venue, false, { venue: homeVenueOf('zurich'), city: 'Zürich', cantons: ['ZH'], neighbours: ['AG'], language: 'de' }) <= 1);
  assert.equal(classifyDestination(VENUES.lausanne, false, { venue: homeVenueOf('zurich'), city: 'Zürich', cantons: ['ZH'], neighbours: ['AG'], language: 'de' }), 7);
  // Bern: the same plan as before (no origin given and origin Bern are identical, the train still boards in Bern).
  assert.deepEqual(planJourney(VENUES.geneva), planJourney(VENUES.geneva, undefined, HOME_VENUE, STATIONS.bern));
  const bernAway = fixtureFor({ ...initialGameFeatures(1_000), seasonMode: { ...initialGameFeatures(1_000).seasonMode, matchday: 1 } }, 'season');
  assert.equal(createJourney(bernAway, 3_000, lcg(2)).origin!.id, HOME_VENUE.id);
});
