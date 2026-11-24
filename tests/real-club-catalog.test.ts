// Owner rule of 16 November 2026: fictional AI clubs may only START in the lowest league (Liga 15); every other league
// starts with real clubs under their official names. This file covers the world league (done) and keeps the rest of
// the work visible as an exact backlog that can only shrink (docs/real-club-catalog.md).
import assert from "node:assert/strict";
import test from "node:test";
import { HOME_CITIES, HOME_CITY_IDS, catalogOf, worldCatalog } from "../app/home-cities.ts";
import routes from "../app/travel-route-cache.ts";
import { STATIONS, journeyCandidates } from "../app/journey-routing.ts";
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
  bern: {},
  zurich: { 8: 6, 9: 6, 10: 6, 11: 6, 12: 6, 13: 4, 14: 5 },
  basel: { 8: 5, 9: 4, 10: 6, 11: 6, 12: 5, 13: 6, 14: 5 },
  geneve: { 8: 6, 9: 5, 10: 6, 11: 6, 12: 5, 13: 6, 14: 5 },
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

test("all verified replacements together: ids and names unique, six clubs per league, old names keep their old grounds, journeys end at the new grounds", () => {
  const catalog = catalogOf("bern");
  assert.equal(new Set(catalog.map((club) => club.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((club) => club.name)).size, catalog.length);
  for (const league of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) assert.equal(catalog.filter((club) => club.league === league).length, 6, `league ${league}`);
  const replaced = [
    [YVERDON_ID, "Yverdon Sport FC", 4, "FC Alpenfestung"],
    [WIL_ID, "FC Wil 1900", 5, "FC Gotthard Murmeltiere"],
    [RAPPERSWIL_ID, "FC Rapperswil-Jona", 6, "FC Léman Mouettes"],
    [LOCARNO_ID, "FC Locarno", 7, "FC Zürisee Böötler"],
    [ORPUND_ID, "FC Orpund Safnern", 8, "FC Röstigraben United"],
    [ITTIGEN_ID, "SC Ittigen", 14, "FC Aarefüchse Bern"],
    [HEIMBERG_ID, "FC Heimberg", 12, "FC Worblental Rangers"],
    [STETTLEN_ID, "FC Stettlen 08", 11, "FC Gürbetal Kickers"],
    [OBERDIESSBACH_ID, "FC Oberdiessbach", 9, "FC Seeland Hechte"],
    [GROSSHOECHSTETTEN_ID, "FC Grosshöchstetten-Schlosswil", 10, "FC Emmental Käsekicker"],
    [GOLDSTERN_ID, "FC Goldstern", 13, "SC Marzili Bern"],
  ] as const;
  for (const [id, name, league, oldName] of replaced) {
    const club = catalog.find((item) => item.id === id)!;
    assert.equal(club.name, name);
    assert.equal(club.league, league);
    assert.ok(!club.fictional, name);
    assert.equal(defaultAiLeagues(1, catalog)[id], 16 - league, `${name}: same division as the old club (own league below, so the sixth club of the own league rule does not apply)`);
    const last = planJourney(club.venue).segments.at(-1)!.points.at(-1)!;
    assert.ok(metresBetween([last.lat, last.lon], [club.venue.lat, club.venue.lon]) < 100, `${name}: the journey ends at the ground`);
    // A saved table or journey that still carries the old name keeps the old ground of that league.
    assert.equal(venueForClubName(oldName, league, 0, catalog), catalog.find((item) => item.league === league && !replaced.some(([other]) => other === item.id))!.venue, oldName);
    assert.equal(venueForClubName(name, league, 0, catalog), club.venue, name);
  }
  // The shared slots (Liga 4 to 7) change in every world, the Bern slots only in Bern.
  for (const city of HOME_CITY_IDS) {
    const names = worldCatalog(city).map((club) => club.name);
    for (const [id, name] of replaced) assert.equal(names.includes(name), id === YVERDON_ID || id === WIL_ID || id === RAPPERSWIL_ID || id === LOCARNO_ID || city === "bern", `${city}: ${name}`);
    assert.equal(new Set(worldCatalog(city).map((club) => club.id)).size, worldCatalog(city).length, `${city}: ids unique`);
  }
});

// ---- FC Oberdiessbach (Liga 9) and FC Grosshöchstetten-Schlosswil (Liga 10) in the Bern world.
// Evidence: FVBJ ground listings (Work, 23 November 2026). Leimen: natural grass main field 100 x 64 m, synthetic field 90 x 57.6 m,
// Helisbühlstrasse. Arniacher: main field 100 x 64 m. The mapped pitches are larger by the run-off the map includes (about 3 m per side).
const OBERDIESSBACH_ID = "extra-9-fc-seeland-hechte";
const GROSSHOECHSTETTEN_ID = "extra-10-fc-emmental-k-sekicker";
/** Corners of OpenStreetMap way 208125381 (grass, Leimen) and way 185813961 (grass, Arniacher). */
const OBERDIESSBACH_PITCH: [number, number][] = [[46.8326755, 7.6158545], [46.8321609, 7.6170332], [46.8316364, 7.6165431], [46.8321508, 7.6153657]];
const GROSSHOECHSTETTEN_PITCH: [number, number][] = [[46.9117204, 7.6312431], [46.9107678, 7.6312969], [46.9107821, 7.6322165], [46.9117413, 7.6321749]];
const minRectangle = (polygon: [number, number][]) => {
  const mid = METRES(polygon[0][0]);
  const points = polygon.map(([lat, lon]) => ({ x: lon * mid.x, y: lat * mid.y }));
  let best = { area: Infinity, length: 0, width: 0 };
  for (let degrees = 0; degrees < 180; degrees += 0.5) {
    const c = Math.cos((degrees * Math.PI) / 180), s = Math.sin((degrees * Math.PI) / 180);
    const us = points.map((p) => p.x * c + p.y * s), vs = points.map((p) => -p.x * s + p.y * c);
    const w = Math.max(...us) - Math.min(...us), h = Math.max(...vs) - Math.min(...vs);
    if (w * h < best.area) best = { area: w * h, length: Math.max(w, h), width: Math.min(w, h) };
  }
  return best;
};

test("FC Oberdiessbach and FC Grosshöchstetten-Schlosswil are real clubs in their slots, with the old ids and no duplicates", () => {
  const bern = worldCatalog("bern");
  for (const [id, name, league] of [[OBERDIESSBACH_ID, "FC Oberdiessbach", 9], [GROSSHOECHSTETTEN_ID, "FC Grosshöchstetten-Schlosswil", 10]] as const) {
    const club = bern.find((item) => item.id === id)!;
    assert.ok(club, `${name}: the id of the old fictional club is kept`);
    assert.equal(club.name, name);
    assert.equal(club.league, league);
    assert.ok(!club.fictional);
    assert.equal(bern.filter((item) => item.name === name).length, 1);
  }
  assert.ok(!bern.some((item) => item.name === "FC Seeland Hechte" || item.name === "FC Emmental Käsekicker"));
});

test("Leimen and Arniacher: the points lie inside the mapped main pitches, which match the FVBJ sizes plus the map's run-off; road and address are next to them", () => {
  const bern = worldCatalog("bern");
  const leimen = bern.find((item) => item.id === OBERDIESSBACH_ID)!.venue, arniacher = bern.find((item) => item.id === GROSSHOECHSTETTEN_ID)!.venue;
  for (const [venue, polygon, length, width, source] of [
    [leimen, OBERDIESSBACH_PITCH, 100, 64, "https://www.openstreetmap.org/way/208125381"],
    [arniacher, GROSSHOECHSTETTEN_PITCH, 100, 64, "https://www.openstreetmap.org/way/185813961"],
  ] as const) {
    assert.equal(venue.verification, "stadium");
    assert.equal(venue.coordinateSource, source);
    assert.ok(inPolygon(venue.lat, venue.lon, [...polygon]), `${venue.stadium}: inside the pitch polygon`);
    const best = minRectangle([...polygon]);
    assert.ok(best.length >= length && best.length <= length + 8, `${venue.stadium}: length ${best.length.toFixed(1)}`);
    assert.ok(best.width >= width && best.width <= width + 8, `${venue.stadium}: width ${best.width.toFixed(1)}`);
  }
  // The second pitch at Leimen is the synthetic field (90 x 57.6 m, mapped 95.6 x 63.5 m); the main field is the natural grass one.
  assert.equal(leimen.postalCode, "3672");
  assert.ok(metresBetween([leimen.lat, leimen.lon], [46.83212, 7.61709]) < 80, "Helisbühlstrasse 6a (swisstopo) is next to the pitch");
  assert.ok(metresBetween([leimen.lat, leimen.lon], [46.832562, 7.615532]) < 100, "public road endpoint at Leimen (Thunstrasse)");
  assert.ok(metresBetween([arniacher.lat, arniacher.lon], [46.91203, 7.63131]) < 150, "the field name Arniacher (swisstopo) is next to the pitch");
  assert.ok(metresBetween([arniacher.lat, arniacher.lon], [46.911278, 7.632258]) < 100, "public road endpoint at Arniacher (Gwattbergweg)");
});

// ---- Yverdon Sport FC (Liga 4) and FC Wil 1900 (Liga 5): the first two shared slots, replaced in every world.
// Evidence: Yverdon Sport: Stade Municipal, Rue des Pêcheurs 16, 1400 Yverdon-les-Bains (club page, public parking at the Patinoire);
// swisstopo: building "Stade municipal d'Yverdon-les-Bains" at 46.78357, 6.64639. FC Wil 1900: Lidl Arena in the Sportpark Bergholz,
// the club's artificial turf stadium since 2013/14 (club page); swisstopo: building "Lidl Arena" at 47.45815, 9.03685, and the pitch
// way 581466821 lies inside the OpenStreetMap way that is named Lidl Arena.
const YVERDON_ID = "extra-4-fc-alpenfestung";
const WIL_ID = "extra-5-fc-gotthard-murmeltiere";
/** Corners of OpenStreetMap way 79701353 (Stade Municipal) and way 581466821 (Lidl Arena). */
const YVERDON_PITCH: [number, number][] = [[46.7838649, 6.6469908], [46.783574, 6.6477739], [46.7827414, 6.6471254], [46.7830292, 6.6463433]];
const WIL_PITCH: [number, number][] = [[47.4589841, 9.0363659], [47.4583337, 9.0361509], [47.4581156, 9.0375939], [47.458766, 9.037809]];

test("Yverdon Sport FC and FC Wil 1900 are real clubs in their slots in all four worlds, with the old ids and no duplicates", () => {
  for (const city of HOME_CITY_IDS) {
    const catalog = worldCatalog(city);
    for (const [id, name, league] of [[YVERDON_ID, "Yverdon Sport FC", 4], [WIL_ID, "FC Wil 1900", 5]] as const) {
      const club = catalog.find((item) => item.id === id)!;
      assert.ok(club, `${city} ${name}: the id of the old fictional club is kept`);
      assert.equal(club.name, name);
      assert.equal(club.league, league);
      assert.ok(!club.fictional);
      assert.equal(catalog.filter((item) => item.name === name).length, 1);
    }
    assert.ok(!catalog.some((item) => item.name === "FC Alpenfestung" || item.name === "FC Gotthard Murmeltiere"), city);
  }
});

test("Stade Municipal and Lidl Arena: the points lie inside the mapped stadium pitches, which have stadium size; stadium building, address and road endpoint are next to them", () => {
  const catalog = worldCatalog("bern");
  const yverdon = catalog.find((item) => item.id === YVERDON_ID)!.venue, wil = catalog.find((item) => item.id === WIL_ID)!.venue;
  for (const [venue, polygon, lengths, widths, source] of [
    [yverdon, YVERDON_PITCH, [102, 110], [65, 71], "https://www.openstreetmap.org/way/79701353"],
    [wil, WIL_PITCH, [105, 115], [68, 78], "https://www.openstreetmap.org/way/581466821"],
  ] as const) {
    assert.equal(venue.verification, "stadium");
    assert.equal(venue.coordinateSource, source);
    assert.ok(inPolygon(venue.lat, venue.lon, [...polygon]), `${venue.stadium}: inside the pitch polygon`);
    const best = minRectangle([...polygon]);
    assert.ok(best.length >= lengths[0] && best.length <= lengths[1], `${venue.stadium}: length ${best.length.toFixed(1)}`);
    assert.ok(best.width >= widths[0] && best.width <= widths[1], `${venue.stadium}: width ${best.width.toFixed(1)}`);
  }
  assert.equal(yverdon.address, "Rue des Pêcheurs 16");
  assert.ok(metresBetween([yverdon.lat, yverdon.lon], [46.78357, 6.64639]) < 100, "the Stade Municipal building (swisstopo) is next to the pitch");
  assert.ok(metresBetween([yverdon.lat, yverdon.lon], [46.78309, 6.64602]) < 100, "Rue des Pêcheurs 16 (swisstopo) is next to the pitch");
  assert.ok(metresBetween([yverdon.lat, yverdon.lon], [46.783612, 6.646213]) < 100, "road endpoint of the route: Rue des Pêcheurs");
  assert.ok(metresBetween([wil.lat, wil.lon], [47.45815, 9.03685]) < 80, "the Lidl Arena building (swisstopo) is next to the pitch");
  assert.ok(metresBetween([wil.lat, wil.lon], [47.458705, 9.035941]) < 100, "road endpoint of the route: the stadium car park");
});

// ---- FC Goldstern (Liga 13, Bern). The current men's first team (2. Liga regional) plays its league games on the main pitch of the
// Sportanlage Bremgarten bB (FVBJ ground listing, Kalchackerstrasse, 3047 Bremgarten: exactly one synthetic field of 90.2 x 57.7 m),
// not at the clubhouse Waldruhe. The municipality confirms the public parking of the sports grounds (Parkierungsverordnung 2025).
const GOLDSTERN_ID = "extra-13-sc-marzili-bern";
/** Corners of OpenStreetMap way 72707053, the only artificial turf pitch of the site. */
const GOLDSTERN_PITCH: [number, number][] = [[46.9771363, 7.4333282], [46.9762766, 7.4334089], [46.976313, 7.4342411], [46.9771726, 7.4341604]];

test("FC Goldstern is the real sixth club of Liga 13 in Bern: old id, real name, no longer fictional, one club of that name", () => {
  const bern = worldCatalog("bern");
  const club = bern.find((item) => item.id === GOLDSTERN_ID)!;
  assert.ok(club, "the id of the old fictional club is kept");
  assert.equal(club.name, "FC Goldstern");
  assert.equal(club.league, 13);
  assert.ok(!club.fictional);
  assert.equal(bern.filter((item) => item.name === "FC Goldstern").length, 1);
  assert.ok(!bern.some((item) => item.name === "SC Marzili Bern"));
});

test("FC Goldstern ground: the Bremgarten synthetic pitch, not the clubhouse Waldruhe; size of the FVBJ listing plus run-off; street and parking approach next to it", () => {
  const venue = worldCatalog("bern").find((item) => item.id === GOLDSTERN_ID)!.venue;
  assert.equal(venue.verification, "stadium");
  assert.equal(venue.city, "Bremgarten bei Bern");
  assert.equal(venue.postalCode, "3047");
  assert.equal(venue.coordinateSource, "https://www.openstreetmap.org/way/72707053");
  assert.ok(inPolygon(venue.lat, venue.lon, GOLDSTERN_PITCH), "inside the pitch polygon");
  const best = minRectangle(GOLDSTERN_PITCH);
  assert.ok(best.length >= 90.2 && best.length <= 98.2, `length ${best.length.toFixed(1)}`);
  assert.ok(best.width >= 57.7 && best.width <= 65.7, `width ${best.width.toFixed(1)}`);
  // The Waldruhe pitch in Uettligen (46.9826, 7.4058) is not the ground of the first team.
  assert.ok(metresBetween([venue.lat, venue.lon], [46.982589, 7.4058465]) > 2000, "not the Waldruhe pitch");
  assert.ok(metresBetween([venue.lat, venue.lon], [46.977333, 7.433776]) < 100, "road endpoint of the route: Johanniterstrasse next to the sports grounds parking");
});

// ---- FC Rapperswil-Jona (Liga 6, all worlds). OFV ground listing: main pitch 105 x 68 m; municipality: "Hauptspielfeld mit Zuschauertribüne
// (800 Plätze), Garderobentrakt und Clubraum (FC Rapperswil-Jona)". The municipal site plan (2024, drawn with north at the bottom: the tennis
// courts, the sports hall and the artificial turf field 3 lie opposite to the map) shows it as "Fussballfeld 1" (G1) next to the
// "Fussballstadion, Garderoben". That is OpenStreetMap way 203508979, 7 m from the mapped grandstand (way 220366252). The neighbouring way
// 203509029 (102.4 x 70.6 m) is shorter than the 105 m main pitch and is not it. The club allows no direct access over the Blumenaustrasse:
// the journey ends at the paid public car park at the Grünfeldstrasse.
const RAPPERSWIL_ID = "extra-6-fc-l-man-mouettes";
/** Corners of OpenStreetMap way 203509029, the neighbouring pitch (102.4 m long). */
const RAPPERSWIL_NEIGHBOUR: [number, number][] = [[47.221718, 8.8414558], [47.2217311, 8.8428075], [47.2210999, 8.8428207], [47.2210868, 8.841469]];
/** Corners of OpenStreetMap way 203508979. */
const RAPPERSWIL_PITCH: [number, number][] = [[47.2208534, 8.8407673], [47.2208682, 8.8422925], [47.2201883, 8.8423068], [47.2201735, 8.8407816]];

test("FC Rapperswil-Jona is a real club in Liga 6 of all four worlds, with the old id and no duplicates", () => {
  for (const city of HOME_CITY_IDS) {
    const catalog = worldCatalog(city);
    const club = catalog.find((item) => item.id === RAPPERSWIL_ID)!;
    assert.ok(club, `${city}: the id of the old fictional club is kept`);
    assert.equal(club.name, "FC Rapperswil-Jona");
    assert.equal(club.league, 6);
    assert.ok(!club.fictional);
    assert.equal(catalog.filter((item) => item.name === "FC Rapperswil-Jona").length, 1);
    assert.ok(!catalog.some((item) => item.name === "FC Léman Mouettes"), city);
  }
});

test("Stadion Grünfeld: the point lies in the main pitch next to the grandstand, which is at least 105 x 68 m; the other candidate is too short; the route ends at the legal car park", () => {
  const venue = worldCatalog("bern").find((item) => item.id === RAPPERSWIL_ID)!.venue;
  assert.equal(venue.verification, "stadium");
  assert.equal(venue.coordinateSource, "https://www.openstreetmap.org/way/203508979");
  assert.ok(inPolygon(venue.lat, venue.lon, RAPPERSWIL_PITCH), "inside the pitch polygon");
  const best = minRectangle(RAPPERSWIL_PITCH);
  assert.ok(best.length >= 105 && best.length <= 120, `length ${best.length.toFixed(1)}`);
  assert.ok(best.width >= 68 && best.width <= 80, `width ${best.width.toFixed(1)}`);
  // The mapped grandstand (way 220366252) and the swisstopo building "Stadion Grünfeld" lie at the pitch; way 203509029 is only 102.4 m long.
  assert.ok(metresBetween([venue.lat, venue.lon], [47.220963, 8.841258]) < 80, "the grandstand is next to the pitch");
  assert.ok(metresBetween([venue.lat, venue.lon], [47.22098, 8.84158]) < 80, "the swisstopo building Stadion Grünfeld is next to the pitch");
  const shorter = minRectangle(RAPPERSWIL_NEIGHBOUR);
  assert.ok(shorter.length < 105, "the neighbouring pitch (way 203509029, about 102 m) cannot be the 105 m main pitch");
  // Both routes end at the car park Grünfeldstrasse (parking aisle at 47.22211, 8.844756), not at the restricted Blaubrunnenstrasse south of the pitch.
  const plan = planJourney(venue);
  const road = plan.segments.filter((segment) => segment.mode === "bus").at(-1)!;
  const arrival = road.points.at(-2)!;
  assert.ok(metresBetween([arrival.lat, arrival.lon], [47.22211, 8.844756]) < 40, "the road ends at the car park");
  assert.ok(metresBetween([arrival.lat, arrival.lon], [47.2201, 8.84155]) > 150, "not at the Blaubrunnenstrasse (agricultural access only)");
});

// ---- FC Locarno (Liga 7, all worlds). Club page (fclocarno.ch/societa/stadio) and regional tourism: home games in the Stadio del Lido, main pitch
// 105 x 68 m; the Ticino federation lists Via Respini, "Terreno principale". The OpenStreetMap stadium "Stadio Lido" (way 486867520, with the
// athletics track) contains exactly one soccer pitch, way 278977348; ways 278977344 and 486872270 lie outside it and are the training pitches.
// The mapped polygon (99.9 x 64.4 m) is 5 m shorter than the official size, so it is used for the position only.
const LOCARNO_ID = "extra-7-fc-z-risee-b-tler";
/** Outline of OpenStreetMap way 486867520 (Stadio Lido, stadium with track). */
const LOCARNO_STADIUM: [number, number][] = [[46.1632502, 8.8003488], [46.1632058, 8.8003474], [46.1632036, 8.8003635], [46.1631981, 8.8003778], [46.1631897, 8.8003889], [46.1631794, 8.8003958], [46.1631681, 8.8003976], [46.1631569, 8.8003942], [46.1631469, 8.8003859], [46.1631393, 8.8003734], [46.1631348, 8.8003581], [46.163134, 8.8003462], [46.1630895, 8.8003454], [46.1630893, 8.800325], [46.1630675, 8.8003248], [46.1629143, 8.8003238], [46.1629086, 8.8002724], [46.1624848, 8.8002646], [46.1624123, 8.8002627], [46.1624116, 8.8003185], [46.1623437, 8.800316], [46.162295, 8.8003143], [46.1622382, 8.8003123], [46.1622207, 8.8027023], [46.1622205, 8.8027766], [46.162276, 8.8027768], [46.1630827, 8.8027908], [46.1630828, 8.8027701], [46.1631279, 8.8027696], [46.1631293, 8.802754], [46.163134, 8.8027398], [46.1631416, 8.8027285], [46.1631512, 8.8027211], [46.1631619, 8.8027184], [46.1631728, 8.8027207], [46.1631826, 8.8027278], [46.1631904, 8.802739], [46.1631953, 8.8027532], [46.1631969, 8.8027689], [46.1632421, 8.8027685]];
/** The pitch inside the track (way 278977348) and the two training pitches outside (way 278977344, way 486872270). */
const LOCARNO_PITCH: [number, number][] = [[46.1629725, 8.8008856], [46.162971, 8.8021809], [46.1623944, 8.8021792], [46.162397, 8.800887]];
const LOCARNO_TRAINING: [number, number][][] = [
  [[46.163862, 8.800401], [46.163851, 8.801697], [46.163292, 8.801687], [46.163303, 8.800391]],
  [[46.164063, 8.80187], [46.163381, 8.801865], [46.163378, 8.802748], [46.16406, 8.802752]],
];

test("FC Locarno is a real club in Liga 7 of all four worlds, with the old id and no duplicates", () => {
  for (const city of HOME_CITY_IDS) {
    const catalog = worldCatalog(city);
    const club = catalog.find((item) => item.id === LOCARNO_ID)!;
    assert.ok(club, `${city}: the id of the old fictional club is kept`);
    assert.equal(club.name, "FC Locarno");
    assert.equal(club.league, 7);
    assert.ok(!club.fictional);
    assert.equal(catalog.filter((item) => item.name === "FC Locarno").length, 1);
    assert.ok(!catalog.some((item) => item.name === "FC Zürisee Böötler"), city);
  }
});

test("Stadio del Lido: the point lies in the pitch inside the track, not in the two training pitches; the route ends on a public street at the Viale Respini", () => {
  const venue = worldCatalog("bern").find((item) => item.id === LOCARNO_ID)!.venue;
  assert.equal(venue.verification, "stadium");
  assert.equal(venue.coordinateSource, "https://www.openstreetmap.org/way/278977348");
  assert.ok(inPolygon(venue.lat, venue.lon, LOCARNO_PITCH), "inside the pitch polygon");
  assert.ok(inPolygon(venue.lat, venue.lon, LOCARNO_STADIUM), "inside the stadium outline with the track");
  for (const [index, training] of LOCARNO_TRAINING.entries()) {
    const centre: [number, number] = [training.reduce((n, p) => n + p[0], 0) / 4, training.reduce((n, p) => n + p[1], 0) / 4];
    assert.ok(!inPolygon(centre[0], centre[1], LOCARNO_STADIUM), `training pitch ${index + 1} lies outside the stadium outline`);
    assert.ok(!inPolygon(venue.lat, venue.lon, training), `the point is not in training pitch ${index + 1}`);
  }
  // The mapped pitch is 5 m shorter than 105 x 68 m, but of full size; the point is the pitch centre.
  const best = minRectangle(LOCARNO_PITCH);
  assert.ok(best.length >= 95 && best.length <= 112 && best.width >= 60 && best.width <= 75, `pitch ${best.length.toFixed(1)} x ${best.width.toFixed(1)}`);
  assert.equal(venue.address, "Via Respini");
  // Route end (Via della Posta / Viale al Lido / Viale Gioacchino Respini, public residential streets) and the stadium building (swisstopo).
  const plan = planJourney(venue);
  const arrival = plan.segments.filter((segment) => segment.mode === "bus").at(-1)!.points.at(-2)!;
  assert.ok(metresBetween([arrival.lat, arrival.lon], [46.162161, 8.801525]) < 30, "the road ends at the junction of the public streets");
  assert.ok(metresBetween([venue.lat, venue.lon], [46.16316, 8.80154]) < 80, "the swisstopo building Stadio del Lido is next to the pitch");
});

// ---- SC Ittigen (Liga 14) and FC Orpund Safnern (Liga 8): the last two fictional regional slots of the Bern world.
// Ittigen: club page "Hubelgut: Hier trägt der SC-Ittigen die Heimspiele in den Meisterschaften aus", men's first team in the 3. Liga;
// FVBJ main pitch 96 x 62 m. Orpund: club page (ground "an der Aare in Orpund", 3. Liga men, Garderobeneinteilung Orpund for the home games),
// FVBJ main pitch 99 x 60 m; OpenStreetMap describes way 228514411 as "Aare Hauptplatz FC Orpund", way 228514412 is the "Nebenplatz".
const ITTIGEN_ID = "extra-14-fc-aaref-chse-bern";
const ORPUND_ID = "extra-8-fc-r-stigraben-united";
/** Corners of OpenStreetMap way 26463168 (Hubelgut) and way 228514411 (Aare Hauptplatz). */
const ITTIGEN_PITCH: [number, number][] = [[46.9791342, 7.4559486], [46.9791576, 7.4567811], [46.9782441, 7.4568357], [46.9782265, 7.4560087]];
const ORPUND_PITCH: [number, number][] = [[47.136885, 7.3093583], [47.1371391, 7.3106198], [47.1366013, 7.3108604], [47.1363421, 7.3096015]];

test("SC Ittigen and FC Orpund Safnern are real clubs in the last two Bern slots, with the old ids and no duplicates, in Bern only", () => {
  for (const city of HOME_CITY_IDS) {
    const names = worldCatalog(city).map((item) => item.name);
    for (const name of ["SC Ittigen", "FC Orpund Safnern"]) assert.equal(names.includes(name), city === "bern", `${city}: ${name}`);
  }
  const bern = worldCatalog("bern");
  for (const [id, name, league] of [[ITTIGEN_ID, "SC Ittigen", 14], [ORPUND_ID, "FC Orpund Safnern", 8]] as const) {
    const club = bern.find((item) => item.id === id)!;
    assert.ok(club, `${name}: the id of the old fictional club is kept`);
    assert.equal(club.name, name);
    assert.equal(club.league, league);
    assert.ok(!club.fictional);
    assert.equal(bern.filter((item) => item.name === name).length, 1);
  }
  assert.ok(!bern.some((item) => item.name === "FC Aarefüchse Bern" || item.name === "FC Röstigraben United"));
  assert.equal(bern.filter((item) => item.league < 15 && item.fictional).length, 0, "no fictional club left outside Liga 15 in the Bern world");
});

test("Hubelgut and Aare: the points lie inside the mapped main pitches, which match the FVBJ sizes plus run-off; the routes end on public streets next to them", () => {
  const bern = worldCatalog("bern");
  const hubelgut = bern.find((item) => item.id === ITTIGEN_ID)!.venue, aare = bern.find((item) => item.id === ORPUND_ID)!.venue;
  for (const [venue, polygon, lengths, widths, source] of [
    [hubelgut, ITTIGEN_PITCH, [96, 108], [62, 70], "https://www.openstreetmap.org/way/26463168"],
    [aare, ORPUND_PITCH, [99, 107], [60, 68], "https://www.openstreetmap.org/way/228514411"],
  ] as const) {
    assert.equal(venue.verification, "stadium");
    assert.equal(venue.coordinateSource, source);
    assert.ok(inPolygon(venue.lat, venue.lon, [...polygon]), `${venue.stadium}: inside the pitch polygon`);
    const best = minRectangle([...polygon]);
    assert.ok(best.length >= lengths[0] && best.length <= lengths[1], `${venue.stadium}: length ${best.length.toFixed(1)}`);
    assert.ok(best.width >= widths[0] && best.width <= widths[1], `${venue.stadium}: width ${best.width.toFixed(1)}`);
  }
  // The Aare training pitch (way 228514412, "Nebenplatz") lies 60 m south of the main pitch point.
  assert.ok(metresBetween([aare.lat, aare.lon], [47.136209, 7.310367]) > 40, "not the Nebenplatz");
  assert.ok(metresBetween([hubelgut.lat, hubelgut.lon], [46.9799, 7.45598]) < 200, "Hubelgutstrasse 1 (swisstopo) is next to the pitch");
  assert.ok(metresBetween([hubelgut.lat, hubelgut.lon], [46.97871, 7.457047]) < 100, "road endpoint of the route: Tiefenaustrasse");
  assert.ok(metresBetween([aare.lat, aare.lon], [47.137119, 7.310013]) < 100, "road endpoint of the route: Byfangstrasse / service road at the Aare grounds");
});

// ---- FC Seefeld ZH (Zürich, Liga 13), FC Black Stars (Basel, Liga 9) and Lancy FC (Genève, Liga 14) replace one fictional slot each in their own world.
// Étoile Carouge (professional club) stays out of the Genève regional leagues (docs/home-cities-data.md); Lancy FC takes the Genève place.
// Evidence: Sportamt Zürich, Lengg: R1 Naturrasen 100 x 64 m, 1. Liga, "Keine Parkplätze vorhanden"; FVRZ first-team home game at Lengg R1.
// FVNWS home game 105653 on Buschweilerhof A (the only full pitch of the site is the grass one, the training pitch is 46 x 30 m artificial turf).
// ACGF: Stade de Marignac, Terrain 1 (Naturrasen, 100/64), first-team home games on 12.09. and 26.09.
/** Corners of OpenStreetMap ways 40808587 (Lengg), 39976253 (Buschweilerhof), 49722965 (Marignac), as (lat, lon). */
const LENGG_PITCH: [number, number][] = [[47.348926, 8.5718066], [47.3486606, 8.5709586], [47.3495519, 8.5703449], [47.3498213, 8.5711932]];
const BUSCHWEILER_PITCH: [number, number][] = [[47.558916, 7.5620943], [47.5598614, 7.5619736], [47.5599141, 7.5628854], [47.5589568, 7.5630314]];
const MARIGNAC_PITCH: [number, number][] = [[46.179308, 6.1234728], [46.1787331, 6.1235219], [46.1786813, 6.1222228], [46.1792584, 6.1221748]];
// SV Muttenz (Basel, Liga 9): FVNWS and Erste Liga facility entry sa=610216: field 1, main pitch natural grass 100 x 64 m, Sandgrubenweg 10, 1. Liga; first-team home
// game 105642 on 07.11. The only mapped grass pitch of that size is way 946997664 (101 x 65 m); the others are 96 x 68, 109 x 70 (larger) and the artificial turf 97 x 60 m.
const MARGELACKER_PITCH: [number, number][] = [[47.5305912, 7.6316866], [47.5301927, 7.6328842], [47.529675, 7.6325029], [47.5300723, 7.6313017]];
// FC Wiedikon ZH (Zürich, Liga 13): FVRZ first-team home games 163483 and 163522 at Heuried; the City of Zürich lists one football field there, KR1 synthetic 100 x 64 m
// (2. Liga), public paid parking. OSM way 34945595 (artificial turf, alt_name KR1, operator Sportamt, 109 x 70 m with run-off) is the only full field of the site.
const HEURIED_PITCH: [number, number][] = [[47.3660113, 8.5030756], [47.3669721, 8.5028242], [47.3670823, 8.503743], [47.3661216, 8.5039943]];
const REGIONAL_REPLACED = [
  { city: "zurich", id: "zh-3-6", name: "FC Seefeld ZH", league: 13, oldName: "Sporting Seebach Frösche", polygon: LENGG_PITCH, length: [105, 115], width: [66, 75], end: [47.348989, 8.570622], endMetres: 60 },
  { city: "basel", id: "bs-7-1", name: "FC Black Stars", league: 9, oldName: "Inter Gondel Reigoldswil", polygon: BUSCHWEILER_PITCH, length: [100, 112], width: [64, 74], end: [47.559355, 7.563063], endMetres: 60 },
  { city: "basel", id: "bs-7-2", name: "SV Muttenz", league: 9, oldName: "Real Homburg", polygon: MARGELACKER_PITCH, length: [99, 104], width: [63, 67], end: [47.529627, 7.631809], endMetres: 100 },
  { city: "zurich", id: "zh-3-3", name: "FC Wiedikon ZH", league: 13, oldName: "SV Hönggerberg Igel", polygon: HEURIED_PITCH, length: [105, 112], width: [66, 74], end: [47.365132, 8.501444], endMetres: 260 },
  { city: "geneve", id: "ge-2-1", name: "Lancy FC", league: 14, oldName: "Athletic Cornavin Express", polygon: MARIGNAC_PITCH, length: [99, 104], width: [63, 67], end: [46.17769, 6.123535], endMetres: 170 },
] as const;

test("Seefeld ZH, Black Stars and Lancy FC are real clubs in their slots with the old ids, official names, no duplicates in any world and unchanged names for the other clubs", () => {
  for (const item of REGIONAL_REPLACED) {
    const catalog = worldCatalog(item.city);
    const club = catalog.find((c) => c.id === item.id)!;
    assert.ok(club, `${item.name}: the slot id stays`);
    assert.equal(club.name, item.name);
    assert.equal(club.league, item.league);
    assert.ok(!club.fictional);
    assert.equal(club.venue.verification, "stadium");
    assert.equal(catalog.filter((c) => c.league === item.league).length, 6);
    assert.equal(catalog.filter((c) => c.name === item.name).length, 1);
    for (const other of HOME_CITY_IDS) if (other !== item.city) assert.ok(!worldCatalog(other).some((c) => c.name === item.name), `${item.name} exists in the ${item.city} world only`);
    // The old fictional name is still known and finds its old ground, which is not the new one.
    assert.ok(!catalog.some((c) => c.name === item.oldName));
    const old = venueForClubName(item.oldName, item.league, 0, catalog);
    assert.notEqual(old.id, undefined);
    // Black Stars take over the very ground the old fictional club already used; the other two moved to the real home pitch.
    const moved = metresBetween([old.lat, old.lon], [club.venue.lat, club.venue.lon]);
    assert.ok(item.id === "bs-7-1" ? moved < 1 : moved > 500, `${item.oldName} keeps its old ground`);
  }
  // Names of the remaining fictional clubs did not move when a slot became real.
  const names = (city: Parameters<typeof worldCatalog>[0], ids: string[]) => ids.map((id) => worldCatalog(city).find((c) => c.id === id)!.name);
  assert.deepEqual(names("zurich", ["zh-3-5", "zh-8-6"]), ["Real Dolder Bähnli", "Sporting Schanzengraben"]);
  assert.deepEqual(names("basel", ["bs-8-6"]), ["Inter Rebberg"]);
  assert.deepEqual(names("geneve", ["ge-8-6"]), ["Racing Barque des Pâquis"]);
  // Étoile Carouge is a professional club and not part of any regional league.
  for (const city of HOME_CITY_IDS) assert.ok(!worldCatalog(city).some((c) => /Étoile Carouge/.test(c.name)));
});

test("Lengg R1, Buschweilerhof and Marignac Terrain 1: the points lie inside the mapped main pitches with the official size plus run-off, the routes end on public streets next to them", () => {
  for (const item of REGIONAL_REPLACED) {
    const city = HOME_CITIES[item.city];
    const club = city.regionalClubs.find((c) => c.id === item.id)!;
    assert.ok(inPolygon(club.venue.lat, club.venue.lon, [...item.polygon]), `${item.name}: inside the pitch polygon`);
    const best = minRectangle([...item.polygon]);
    assert.ok(best.length >= item.length[0] && best.length <= item.length[1], `${item.name}: length ${best.length.toFixed(1)}`);
    assert.ok(best.width >= item.width[0] && best.width <= item.width[1], `${item.name}: width ${best.width.toFixed(1)}`);
    assert.ok(best.length * best.width >= 3500);
    // The cached road starts at the city home, ends at the pitch, and its last road point is the public street checked in OSM.
    const leg = journeyCandidates(club.venue, city.homeVenue, STATIONS[city.station]).road[0];
    const route = (routes as Record<string, { points: { lat: number; lon: number }[]; geometry: string; km: number }>)[leg.id];
    assert.ok(route && route.geometry === "road" && route.points.length > 10, `${item.name}: cached road route`);
    assert.deepEqual(route.points.at(-1), { lat: club.venue.lat, lon: club.venue.lon });
    const roadEnd = route.points.at(-2)!;
    assert.ok(metresBetween([roadEnd.lat, roadEnd.lon], [item.end[0], item.end[1]]) < 10, `${item.name}: road ends at the checked street point`);
    assert.ok(metresBetween([roadEnd.lat, roadEnd.lon], [club.venue.lat, club.venue.lon]) < item.endMetres, `${item.name}: street end next to the pitch`);
    assert.ok(route.km > 3 && route.km < 12, `${item.name}: ${route.km.toFixed(1)} km`);
    const plan = planJourney(club.venue, undefined, city.homeVenue, STATIONS[city.station]);
    assert.ok(plan.segments.some((segment) => segment.geometry === "road"), `${item.name}: the journey uses the cached road`);
  }
  assert.equal(HOME_CITIES.zurich.regionalClubs.find((c) => c.id === "zh-3-6")!.venue.coordinateSource, "https://www.openstreetmap.org/way/40808587");
  assert.equal(HOME_CITIES.basel.regionalClubs.find((c) => c.id === "bs-7-1")!.venue.coordinateSource, "https://www.openstreetmap.org/way/39976253");
  assert.equal(HOME_CITIES.geneve.regionalClubs.find((c) => c.id === "ge-2-1")!.venue.coordinateSource, "https://www.openstreetmap.org/way/49722965");
  assert.equal(HOME_CITIES.zurich.regionalClubs.find((c) => c.id === "zh-3-3")!.venue.coordinateSource, "https://www.openstreetmap.org/way/34945595");
  assert.equal(HOME_CITIES.basel.regionalClubs.find((c) => c.id === "bs-7-2")!.venue.coordinateSource, "https://www.openstreetmap.org/way/946997664");
});

// ---- CS Chênois (already a real club of Liga 6 in all four worlds): its ground was only the municipality centre. ACGF stadium entry
// (dev-matchcenter.acgf.ch, sa=628516): Stade des Trois-Chêne, main field A natural grass 105 x 68 m, Route de Sous-Moulin 22; direct vehicle
// access is blocked by construction, the P+R Sous-Moulin is recommended. The journey therefore ends at the P+R and walks to the field.
const CHENOIS_PITCH: [number, number][] = [[46.1912763, 6.1911046], [46.1918777, 6.1915538], [46.1923464, 6.190243], [46.1917447, 6.1897955]];
test("CS Chênois: stable id, official name, the point lies in main field A (105 x 68 m plus run-off), the road ends at the public P+R Sous-Moulin", () => {
  for (const city of HOME_CITY_IDS) {
    const club = worldCatalog(city).find((item) => item.id === "cs-chenois")!;
    assert.equal(club.name, "CS Chênois");
    assert.equal(club.league, 6);
    assert.equal(worldCatalog(city).filter((item) => item.name === "CS Chênois").length, 1);
    assert.equal(club.venue.verification, "stadium");
    assert.equal(club.venue.address, "Route de Sous-Moulin 22");
  }
  const venue = worldCatalog("bern").find((item) => item.id === "cs-chenois")!.venue;
  assert.equal(venue.coordinateSource, "https://www.openstreetmap.org/way/132470618");
  assert.ok(inPolygon(venue.lat, venue.lon, CHENOIS_PITCH), "inside the pitch polygon");
  const best = minRectangle(CHENOIS_PITCH);
  assert.ok(best.length >= 105 && best.length <= 118 && best.width >= 68 && best.width <= 78, `${best.length.toFixed(1)} x ${best.width.toFixed(1)}`);
  // The other mapped pitches of the site are too short for 105 x 68 m (99 x 66, 106 x 65 m).
  assert.ok(metresBetween([venue.lat, venue.lon], [46.19226, 6.19159]) < 120, "Route de Sous-Moulin 22 (swisstopo) is next to the pitch");
  const route = (routes as Record<string, { points: { lat: number; lon: number }[]; geometry: string }>)[`bus:46.94689,7.39373:${venue.lat.toFixed(5)},${venue.lon.toFixed(5)}`];
  assert.ok(route && route.geometry === "road", "cached road route from Bern");
  assert.deepEqual(route.points.at(-1), { lat: venue.lat, lon: venue.lon });
  const end = route.points.at(-2)!;
  assert.ok(metresBetween([end.lat, end.lon], [46.190308, 6.192606]) < 40, "the road ends at the P+R Sous-Moulin (OSM way 35514353)");
  assert.ok(metresBetween([end.lat, end.lon], [venue.lat, venue.lon]) > 150, "not at the blocked direct access");
});
