// Owner rule of 16 November 2026: fictional AI clubs may only START in the lowest league (Liga 15); every other league
// starts with real clubs under their official names. This file covers the world league (done) and keeps the rest of
// the work visible as an exact backlog that can only shrink (docs/real-club-catalog.md).
import assert from "node:assert/strict";
import test from "node:test";
import { HOME_CITY_IDS, catalogOf, worldCatalog } from "../app/home-cities.ts";
import { OWN_CLUB_ID, advanceAiLeagues, normalizeAiLeagues } from "../app/season-leagues.ts";
import { LEAGUE_MEMBERS, SEASON_CLUBS, VENUES, defaultAiLeagues, seasonClubsOf, venueForClubName } from "../app/travel-geography.ts";
import { matchColours } from "../app/match-colours.ts";

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
  bern: { 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 13: 1, 14: 1 },
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
