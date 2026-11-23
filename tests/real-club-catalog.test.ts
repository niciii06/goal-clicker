// Owner rule of 16 November 2026: fictional AI clubs may only START in the lowest league (Liga 15); every other league
// starts with real clubs under their official names. This file covers the world league (done) and keeps the rest of
// the work visible as an exact backlog that can only shrink (docs/real-club-catalog.md).
import assert from "node:assert/strict";
import test from "node:test";
import { HOME_CITY_IDS, catalogOf, worldCatalog } from "../app/home-cities.ts";
import { OWN_CLUB_ID, advanceAiLeagues, normalizeAiLeagues } from "../app/season-leagues.ts";
import { LEAGUE_MEMBERS, SEASON_CLUBS, VENUES, defaultAiLeagues, seasonClubsOf, venueForClubName } from "../app/travel-geography.ts";
import { matchColours } from "../app/match-colours.ts";
import { planJourney } from "../app/journey-routing.ts";

/** The six clubs of the world league: stable id (minted for the old parody names), official name, catalogue ground. */
const WORLD_LEAGUE = [
  ["world-real-madreto", "Real Madrid CF", "madrid"],
  ["world-fc-barceloneta", "FC Barcelona", "barcelona"],
  ["world-liverpuhl-fc", "Liverpool FC", "liverpool"],
  ["world-manchester-cite", "Manchester City", "city"],
  ["world-bayern-muenchan", "FC Bayern München", "munich"],
  ["world-paris-saint-german", "Paris Saint-Germain", "paris"],
] as const;
const PARODY = /Madreto|Barceloneta|Liverpuhl|Manchester Cité|Münchan|Saint German/;

test("the world league has six real clubs with official names in all four home cities; ids and grounds are the old ones", () => {
  for (const city of HOME_CITY_IDS) {
    const league = worldCatalog(city).filter((club) => club.league === 1);
    assert.deepEqual(league.map((club) => club.id).sort(), WORLD_LEAGUE.map(([id]) => id).sort(), city);
    for (const [id, name, ground] of WORLD_LEAGUE) {
      const club = league.find((item) => item.id === id)!;
      assert.equal(club.name, name, `${city} ${id}`);
      assert.ok(!club.fictional, `${city} ${id} is a real club`);
      assert.equal(club.venue, VENUES[ground], `${city} ${id} keeps its audited catalogue ground (no new coordinates)`);
    }
    assert.ok(!worldCatalog(city).some((club) => PARODY.test(club.name)), `no parody name left in the ${city} catalogue`);
  }
});

/**
 * Fictional clubs outside the lowest league that are still in the initial catalogues, per city and league. This is the
 * remaining work of the real club rule: the numbers may only go down (replace a club, lower the number). Liga 15 is
 * allowed to be fictional and is not counted.
 */
const BACKLOG: Record<string, Record<number, number>> = {
  bern: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 13: 1, 14: 1 },
  zurich: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 6, 14: 5 },
  basel: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 5, 9: 6, 10: 6, 11: 6, 12: 5, 13: 6, 14: 5 },
  geneve: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 6, 9: 5, 10: 6, 11: 6, 12: 5, 13: 6, 14: 6 },
};
test("fictional clubs outside Liga 15 are only the documented backlog, and the world league is not part of it", () => {
  for (const city of HOME_CITY_IDS) {
    const counts: Record<number, number> = {};
    for (const club of worldCatalog(city)) if (club.fictional && club.league < 15) counts[club.league] = (counts[club.league] ?? 0) + 1;
    assert.deepEqual(counts, BACKLOG[city], city);
    assert.equal(counts[1] ?? 0, 0, "the world league has no fictional club");
  }
});

test("every world has 15 leagues with six clubs (five in the lowest league), none twice", () => {
  for (const city of HOME_CITY_IDS) {
    const catalog = worldCatalog(city);
    assert.equal(catalog.length, 89);
    assert.equal(new Set(catalog.map((club) => club.id)).size, 89, `${city}: ids are unique`);
    for (let league = 1; league <= 15; league++) {
      const clubs = catalog.filter((club) => club.league === league);
      assert.equal(clubs.length, league === 15 ? 5 : 6, `${city} league ${league}`);
      assert.equal(new Set(clubs.map((club) => club.name)).size, clubs.length, `${city} league ${league}: no duplicate name`);
    }
  }
});

test("old saved league assignments stay valid: same ids, defaults reproduce in every city, old club names still find their ground", () => {
  for (const city of HOME_CITY_IDS) {
    const catalog = catalogOf(city);
    for (let division = 1; division <= 15; division++) {
      const defaults = defaultAiLeagues(division, catalog);
      assert.deepEqual(normalizeAiLeagues(defaults, division, catalog), defaults, `${city} division ${division}`);
      // A save that stored the world league under the old ids: the world clubs are in division 15 (or 14 for the sixth).
      for (const [id] of WORLD_LEAGUE) assert.ok(id in defaults, `${city}: ${id} is still keyed`);
    }
  }
  // A saved table or journey may still carry a parody name; it resolves to the same audited ground as the official name.
  for (const [oldName, officialName, ground] of [["Real Madreto", "Real Madrid CF", "madrid"], ["FC Barceloneta", "FC Barcelona", "barcelona"], ["Liverpuhl FC", "Liverpool FC", "liverpool"], ["Manchester Cité", "Manchester City", "city"], ["Bayern Münchan", "FC Bayern München", "munich"], ["Paris Saint German", "Paris Saint-Germain", "paris"]] as const) {
    assert.equal(venueForClubName(oldName, 15, 1), VENUES[ground], oldName);
    assert.equal(venueForClubName(officialName, 15, 1), VENUES[ground], officialName);
  }
  // The kits follow the official names as they did the parody names.
  assert.equal(matchColours("Real Madrid CF", "#000000", false).opponent, matchColours("Real Madreto", "#000000", false).opponent);
  assert.equal(matchColours("Manchester City", "#000000", false).opponent, matchColours("Manchester Cité", "#000000", false).opponent);
});

test("promotion and relegation are unchanged: one up and one down per boundary in every city, real clubs keep id and official name, a Liga 15 club may rise", () => {
  const ratingOf = (_division: number, index: number) => 100 - index * 12;
  const rollScore = (strength: number) => (strength > 0 ? 2 : 0);
  for (const city of HOME_CITY_IDS) {
    const catalog = catalogOf(city);
    let aiLeagues = defaultAiLeagues(8, catalog);
    let division = 8;
    const lowest = seasonClubsOf(1, aiLeagues, catalog)[0];
    let seenLowestClubUp = false;
    for (let season = 0; season < 3; season++) {
      const members = seasonClubsOf(division, aiLeagues, catalog).map((club) => club.id);
      const result = advanceAiLeagues({ aiLeagues, playerDivision: division, playerLeagueOrder: [OWN_CLUB_ID, ...members], ownClubName: "FC Goal", catalog, ratingOf, rollScore, random: () => 0.5 });
      assert.equal(result.moves.length, 28, `${city} season ${season}: 14 boundaries, one up and one down`);
      for (let boundary = 1; boundary <= 14; boundary++) {
        assert.equal(result.moves.filter((move) => move.from === boundary && move.to === boundary + 1).length, 1, `${city} up ${boundary}`);
        assert.equal(result.moves.filter((move) => move.from === boundary + 1 && move.to === boundary).length, 1, `${city} down ${boundary}`);
      }
      const official = new Map<string, string>(WORLD_LEAGUE.map(([id, name]) => [id, name]));
      for (const move of result.moves) if (official.has(move.clubId)) assert.equal(move.name, official.get(move.clubId), "a moving world club carries its official name");
      if (result.moves.some((move) => move.clubId === lowest.id && move.from === 1 && move.to === 2)) { seenLowestClubUp = true; assert.equal(catalog.find((club) => club.id === lowest.id)!.name, lowest.name, "name and identity stay after the rise"); }
      aiLeagues = result.aiLeagues; division = result.playerDivision;
      assert.ok(normalizeAiLeagues(aiLeagues, division, catalog), `${city} season ${season}: a valid assignment, six per league`);
      for (let d = 1; d <= 15; d++) assert.equal(seasonClubsOf(d, aiLeagues, catalog).length + (d === division ? 1 : 0), LEAGUE_MEMBERS);
    }
    assert.ok(seenLowestClubUp, `${city}: the best Liga 15 club (fictional or real) rises normally`);
  }
  assert.equal(SEASON_CLUBS.filter((club) => club.league === 1).length, 6);
});

// ---- FC Heimberg replaces the fictional sixth club of Liga 12 in the Bern world (first verified regional slot).
// Evidence: FVBJ ground listing "Waldgarten" (Hauptplatz natural grass 96 x 61 m, floodlights, training pitch 84 x 42 m, club at
// Schützenstrasse 73), swisstopo address register (Schützenstrasse 73, 3627 Heimberg at 46.79110, 7.59736), OpenStreetMap soccer pitch way 93077552.
const HEIMBERG_ID = "extra-12-fc-worblental-rangers";
/** Corners of OpenStreetMap way 93077552 (lat, lon). */
const HEIMBERG_PITCH: [number, number][] = [[46.7912046, 7.5974467], [46.7913326, 7.5982535], [46.7904685, 7.5985459], [46.7903405, 7.5977392]];
const METRES = (lat: number) => ({ y: 111320, x: 111320 * Math.cos((lat * Math.PI) / 180) });
const inPolygon = (lat: number, lon: number, polygon: [number, number][]) => polygon.some((_, i) => {
  const [aLat, aLon] = polygon[i], [bLat, bLon] = polygon[(i + 1) % polygon.length];
  return (aLat > lat) !== (bLat > lat) && lon < ((bLon - aLon) * (lat - aLat)) / (bLat - aLat) + aLon;
}) && polygon.filter((_, i) => { const [aLat, aLon] = polygon[i], [bLat, bLon] = polygon[(i + 1) % polygon.length]; return (aLat > lat) !== (bLat > lat) && lon < ((bLon - aLon) * (lat - aLat)) / (bLat - aLat) + aLon; }).length % 2 === 1;
const metresBetween = (a: [number, number], b: [number, number]) => { const m = METRES(a[0]); return Math.hypot((a[0] - b[0]) * m.y, (a[1] - b[1]) * m.x); };

test("FC Heimberg is the real sixth club of Liga 12 in Bern: old id, real name, no longer fictional, no other club of that name", () => {
  const bern = worldCatalog("bern");
  const club = bern.find((item) => item.id === HEIMBERG_ID)!;
  assert.ok(club, "the id of the old fictional club is kept");
  assert.equal(club.name, "FC Heimberg");
  assert.equal(club.league, 12);
  assert.ok(!club.fictional);
  assert.equal(bern.filter((item) => item.name === "FC Heimberg").length, 1);
  assert.equal(bern.filter((item) => item.league === 12).length, 6);
  assert.ok(!bern.some((item) => item.name === "FC Worblental Rangers"));
});

test("FC Heimberg ground: the point lies inside the mapped main pitch, the pitch matches the FVBJ size, the address and the public road are next to it", () => {
  const venue = worldCatalog("bern").find((item) => item.id === HEIMBERG_ID)!.venue;
  assert.equal(venue.verification, "stadium");
  assert.equal(venue.address, "Schützenstrasse 73");
  assert.equal(venue.postalCode, "3627");
  assert.equal(venue.coordinateSource, "https://www.openstreetmap.org/way/93077552");
  assert.ok(inPolygon(venue.lat, venue.lon, HEIMBERG_PITCH), "inside the pitch polygon");
  // Size of the mapped pitch (smallest rectangle) against the FVBJ Hauptplatz 96 x 61 m: the map includes about 1.5 m run-off on each side.
  const mid = METRES(venue.lat);
  const points = HEIMBERG_PITCH.map(([lat, lon]) => ({ x: lon * mid.x, y: lat * mid.y }));
  let best = { area: Infinity, length: 0, width: 0 };
  for (let degrees = 0; degrees < 180; degrees += 0.5) {
    const c = Math.cos((degrees * Math.PI) / 180), s = Math.sin((degrees * Math.PI) / 180);
    const us = points.map((p) => p.x * c + p.y * s), vs = points.map((p) => -p.x * s + p.y * c);
    const w = Math.max(...us) - Math.min(...us), h = Math.max(...vs) - Math.min(...vs);
    if (w * h < best.area) best = { area: w * h, length: Math.max(w, h), width: Math.min(w, h) };
  }
  assert.ok(best.length >= 96 && best.length <= 101, `length ${best.length.toFixed(1)}`);
  assert.ok(best.width >= 61 && best.width <= 66, `width ${best.width.toFixed(1)}`);
  assert.ok(best.area >= 3500, "full size pitch");
  // Address Schützenstrasse 73 (swisstopo address register) and the public road in front of the ground (OSRM nearest road: Schützenstrasse).
  assert.ok(metresBetween([venue.lat, venue.lon], [46.79110, 7.59736]) < 80, "the club address is next to the pitch");
  assert.ok(metresBetween([venue.lat, venue.lon], [46.791334, 7.597882]) < 80, "the public road endpoint is next to the pitch");
});

test("FC Heimberg: old saved league assignments and journeys keep working, the old club name still finds its old ground, the journey ends at the new ground", () => {
  const catalog = catalogOf("bern");
  const defaults = defaultAiLeagues(8, catalog);
  assert.ok(HEIMBERG_ID in defaults, "the id is still keyed");
  assert.deepEqual(normalizeAiLeagues(defaults, 8, catalog), defaults);
  assert.equal(defaults[HEIMBERG_ID], 16 - 12, "still in the division of the old club (Liga 12)");
  const oldGround = venueForClubName("FC Worblental Rangers", 12, 0, catalog);
  const club = catalog.find((item) => item.id === HEIMBERG_ID)!;
  assert.notEqual(oldGround, club.venue, "a saved table that still carries the old name keeps its old ground");
  assert.equal(oldGround, catalog.find((item) => item.league === 12 && item.id !== HEIMBERG_ID)!.venue);
  assert.equal(venueForClubName("FC Heimberg", 12, 0, catalog), club.venue);
  const plan = planJourney(club.venue);
  const last = plan.segments.at(-1)!.points.at(-1)!;
  assert.ok(metresBetween([last.lat, last.lon], [club.venue.lat, club.venue.lon]) < 100, "the journey ends at the ground");
});

// ---- FC Stettlen 08 replaces the fictional sixth club of Liga 11 in the Bern world.
// Evidence: the club's own page (Spieltag) says the home games are played "auf dem Naturrasen beim Schulhaus in Walkringen"
// (training is in Stettlen, a different place). swisstopo: school area Primar and Sekundarschule Walkringen at 46.94925, 7.61889,
// address Dornistrasse 10, 3512 Walkringen. The only soccer pitch of Walkringen in OpenStreetMap is way 318117223.
const STETTLEN_ID = "extra-11-fc-g-rbetal-kickers";
const STETTLEN_PITCH: [number, number][] = [[46.9492003, 7.6194637], [46.9497349, 7.6197936], [46.9500671, 7.6186215], [46.9495243, 7.6183077]];

test("FC Stettlen 08 is the real sixth club of Liga 11 in Bern: old id, real name, no longer fictional, one club of that name", () => {
  const bern = worldCatalog("bern");
  const club = bern.find((item) => item.id === STETTLEN_ID)!;
  assert.ok(club, "the id of the old fictional club is kept");
  assert.equal(club.name, "FC Stettlen 08");
  assert.equal(club.league, 11);
  assert.ok(!club.fictional);
  assert.equal(bern.filter((item) => item.name === "FC Stettlen 08").length, 1);
  assert.equal(bern.filter((item) => item.league === 11).length, 6);
  assert.ok(!bern.some((item) => item.name === "FC Gürbetal Kickers"));
});

test("FC Stettlen 08 ground: the point lies inside the only mapped pitch of Walkringen, next to the school address and the public road", () => {
  const venue = worldCatalog("bern").find((item) => item.id === STETTLEN_ID)!.venue;
  assert.equal(venue.verification, "stadium");
  assert.equal(venue.city, "Walkringen", "the home games are in Walkringen, not in Stettlen");
  assert.equal(venue.address, "Dornistrasse 10");
  assert.equal(venue.postalCode, "3512");
  assert.equal(venue.coordinateSource, "https://www.openstreetmap.org/way/318117223");
  assert.ok(inPolygon(venue.lat, venue.lon, STETTLEN_PITCH), "inside the pitch polygon");
  const mid = METRES(venue.lat);
  const points = STETTLEN_PITCH.map(([lat, lon]) => ({ x: lon * mid.x, y: lat * mid.y }));
  let best = { area: Infinity, length: 0, width: 0 };
  for (let degrees = 0; degrees < 180; degrees += 0.5) {
    const c = Math.cos((degrees * Math.PI) / 180), s = Math.sin((degrees * Math.PI) / 180);
    const us = points.map((p) => p.x * c + p.y * s), vs = points.map((p) => -p.x * s + p.y * c);
    const w = Math.max(...us) - Math.min(...us), h = Math.max(...vs) - Math.min(...vs);
    if (w * h < best.area) best = { area: w * h, length: Math.max(w, h), width: Math.min(w, h) };
  }
  assert.ok(best.area >= 3500 && best.length >= 90 && best.width >= 55, `full size pitch ${best.length.toFixed(1)} x ${best.width.toFixed(1)}`);
  assert.ok(metresBetween([venue.lat, venue.lon], [46.94925, 7.61889]) < 80, "the school area (swisstopo) is next to the pitch");
  assert.ok(metresBetween([venue.lat, venue.lon], [46.949452, 7.618341]) < 80, "the road endpoint of the route is next to the pitch");
});

test("both verified replacements together: ids and names unique, six clubs per league, old names keep their old grounds, journeys end at the new grounds", () => {
  const catalog = catalogOf("bern");
  assert.equal(new Set(catalog.map((club) => club.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((club) => club.name)).size, catalog.length);
  for (const league of [11, 12]) assert.equal(catalog.filter((club) => club.league === league).length, 6, `league ${league}`);
  for (const [id, name, division] of [[HEIMBERG_ID, "FC Heimberg", 4], [STETTLEN_ID, "FC Stettlen 08", 5]] as const) {
    const club = catalog.find((item) => item.id === id)!;
    assert.equal(club.name, name);
    assert.equal(defaultAiLeagues(8, catalog)[id], division, `${name}: same division as the old club`);
    const last = planJourney(club.venue).segments.at(-1)!.points.at(-1)!;
    assert.ok(metresBetween([last.lat, last.lon], [club.venue.lat, club.venue.lon]) < 100, `${name}: the journey ends at the ground`);
  }
  const oldGround = venueForClubName("FC Gürbetal Kickers", 11, 0, catalog);
  assert.equal(oldGround, catalog.find((item) => item.league === 11 && item.id !== STETTLEN_ID)!.venue);
  assert.equal(venueForClubName("FC Stettlen 08", 11, 0, catalog), catalog.find((item) => item.id === STETTLEN_ID)!.venue);
  // Other worlds are not touched: the same ids still point to their own catalogues.
  for (const city of HOME_CITY_IDS) if (city !== "bern") assert.ok(!worldCatalog(city).some((club) => club.name === "FC Stettlen 08" || club.name === "FC Heimberg"), city);
});
