// Collects documented real sports grounds (OpenStreetMap via Nominatim) for the home cities of stadium Phase 1
// (docs/home-stadium-phase1.md) and writes app/home-cities/pitches.json. Run by hand, never in tests or CI:
//
//   npx tsx scripts/home-cities/fetch-pitches.mts [cacheDir]
//
// Respects the Nominatim usage policy: one request at a time, at least 1.5 s apart, a descriptive User-Agent, every
// answer cached on disk so a rerun asks nothing again. Only the grounds land in the repository (name, OSM object,
// coordinates, municipality); the clubs playing there are fictional (app/home-cities.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Ground = { name: string; osm: string; lat: number; lon: number; municipality: string; canton: string; kind: string };
type Band = { division: number; places: string[]; minKm: number; maxKm: number; match?: string[] };
type CityPlan = { id: string; canton: string; home: { query: string; nameIncludes: string }; terms: string[]; bands: Band[]; extra?: string[] };

const CACHE = process.argv[2] ?? '.cache/home-cities';
const UA = 'goal-clicker-home-cities/1.0 (game data build script)';
const TYPES = new Set(['pitch', 'sports_centre', 'stadium', 'recreation_ground']);
const NOT_FOOTBALL = /kart|padel|tennis|golf|schwimm|piscine|bad\b|minigolf|reit|eis|patinoire|squash|beach|skate|boccia|pétanque|petanque|curling|kletter|basket|volley|badminton|tir\b|schiess/i;
// Grounds of professional clubs or famous stadiums: the fictional clubs must not be mistaken for them.
// Names that carry a club (FC Urdorf, SC ...) are left out: the club playing there in the game is fictional.
const CLUB_NAME = /\b(FC|SC|SV|FCB|US|AS|CS|ES|FCZ|GC)\b/;
const RESERVED = /letzigrund|hardturm|hardhof|st\. jakob|joggeli|stade de genève|stade de geneve|landhof|stade de la praille|schützenwiese|utogrund|brügglifeld|niedermatten|kybunpark/i;

const PLANS: CityPlan[] = [
  {
    id: 'zurich', canton: 'ZH', home: { query: 'Sportanlage Neudorf Zürich', nameIncludes: 'Neudorf' }, terms: ['Sportanlage', 'Sportplatz'],
    bands: [
      { division: 1, places: ['Zürich Oerlikon', 'Zürich Seebach', 'Zürich Affoltern', 'Zürich Schwamendingen', 'Zürich Unterstrass', 'Zürich Wipkingen', 'Zürich Höngg', 'Zürich Altstetten', 'Zürich Albisrieden', 'Zürich Wiedikon', 'Zürich Wollishofen', 'Zürich Hottingen', 'Zürich Witikon', 'Zürich Hirslanden', 'Zürich Leimbach', 'Zürich'], match: ['Zürich'], minKm: 0, maxKm: 5 },
      { division: 2, places: ['Zürich Oerlikon', 'Zürich Seebach', 'Zürich Affoltern', 'Zürich Schwamendingen', 'Zürich Unterstrass', 'Zürich Wipkingen', 'Zürich Höngg', 'Zürich Altstetten', 'Zürich Albisrieden', 'Zürich Wiedikon', 'Zürich Wollishofen', 'Zürich Hottingen', 'Zürich Witikon', 'Zürich Hirslanden', 'Zürich Leimbach', 'Zürich'], match: ['Zürich'], minKm: 0, maxKm: 8 },
      { division: 3, places: ['Zürich Oerlikon', 'Zürich Seebach', 'Zürich Affoltern', 'Zürich Schwamendingen', 'Zürich Unterstrass', 'Zürich Wipkingen', 'Zürich Höngg', 'Zürich Altstetten', 'Zürich Albisrieden', 'Zürich Wiedikon', 'Zürich Wollishofen', 'Zürich Hottingen', 'Zürich Witikon', 'Zürich Hirslanden', 'Zürich Leimbach', 'Zürich'], match: ['Zürich'], minKm: 1, maxKm: 12 },
      { division: 4, places: ['Wallisellen', 'Dübendorf', 'Opfikon', 'Regensdorf', 'Schlieren', 'Adliswil', 'Zollikon', 'Rümlang'], minKm: 4, maxKm: 15 },
      { division: 5, places: ['Bülach', 'Uster', 'Volketswil', 'Thalwil', 'Horgen', 'Meilen', 'Dietikon', 'Effretikon'], minKm: 8, maxKm: 25 },
      { division: 6, places: ['Winterthur', 'Wetzikon', 'Wädenswil', 'Andelfingen', 'Hinwil', 'Embrach', 'Dielsdorf', 'Affoltern am Albis'], minKm: 15, maxKm: 45 },
      { division: 7, places: ['Kloten', 'Bassersdorf', 'Urdorf', 'Birmensdorf', 'Küsnacht', 'Fällanden', 'Oberengstringen'], minKm: 5, maxKm: 20 },
      { division: 8, places: ['Baden', 'Wettingen', 'Zug', 'Baar', 'Rapperswil-Jona', 'Wil', 'Bremgarten'], minKm: 15, maxKm: 60 },
    ],
  },
  {
    id: 'basel', extra: ['Liestal', 'Muttenz', 'Birsfelden', 'Allschwil', 'Binningen', 'Bottmingen', 'Oberwil', 'Therwil', 'Itingen', 'Lausen', 'Bubendorf', 'Magden', 'Zeiningen', 'Zwingen', 'Nunningen', 'Hochwald', 'Seewen', 'Duggingen', 'Stein', 'Mumpf', 'Giebenach', 'Augst', 'Ziefen', 'Reigoldswil', 'Gempen', 'Büren', 'Riehen', 'Bettingen', 'Basel Gundeldingen', 'Basel Kleinbasel'], canton: 'BS', home: { query: 'Sportplatz Rheinacker Basel', nameIncludes: 'Rheinacker' }, terms: ['Sportplatz', 'Sportanlage'],
    bands: [
      { division: 1, places: ['Basel Kleinbasel', 'Basel Hirzbrunnen', 'Basel St. Johann', 'Basel Gundeldingen', 'Basel Bachletten', 'Basel Iselin', 'Basel St. Alban', 'Basel Bruderholz', 'Basel Kleinhüningen', 'Basel', 'Riehen'], match: ['Basel', 'Riehen'], minKm: 0, maxKm: 5 },
      { division: 2, places: ['Basel Kleinbasel', 'Basel Hirzbrunnen', 'Basel St. Johann', 'Basel Gundeldingen', 'Basel Bachletten', 'Basel Iselin', 'Basel St. Alban', 'Basel Bruderholz', 'Basel Kleinhüningen', 'Basel', 'Riehen'], match: ['Basel', 'Riehen'], minKm: 0, maxKm: 8 },
      { division: 3, places: ['Basel Kleinbasel', 'Basel Hirzbrunnen', 'Basel St. Johann', 'Basel Gundeldingen', 'Basel Bachletten', 'Basel Iselin', 'Basel St. Alban', 'Basel Bruderholz', 'Basel Kleinhüningen', 'Basel', 'Riehen'], match: ['Basel', 'Riehen', 'Bettingen'], minKm: 1, maxKm: 12 },
      { division: 4, places: ['Binningen', 'Allschwil', 'Birsfelden', 'Muttenz', 'Münchenstein', 'Bottmingen', 'Reinach', 'Oberwil'], minKm: 3, maxKm: 15 },
      { division: 5, places: ['Pratteln', 'Aesch', 'Liestal', 'Arlesheim', 'Dornach', 'Therwil', 'Frenkendorf', 'Rheinfelden'], minKm: 6, maxKm: 25 },
      { division: 6, places: ['Sissach', 'Gelterkinden', 'Laufen', 'Waldenburg', 'Oberdorf', 'Möhlin', 'Kaiseraugst', 'Lausen'], minKm: 10, maxKm: 40 },
      { division: 7, places: ['Ettingen', 'Biel-Benken', 'Schönenbuch', 'Pfeffingen', 'Grellingen', 'Hölstein', 'Füllinsdorf'], minKm: 4, maxKm: 25 },
      { division: 8, places: ['Frick', 'Laufenburg', 'Breitenbach', 'Delémont', 'Olten', 'Stein', 'Zwingen'], minKm: 15, maxKm: 60 },
    ],
  },
  {
    id: 'geneve', extra: ['Vernier', 'Meyrin', 'Lancy', 'Onex', 'Carouge', 'Thônex', 'Plan-les-Ouates', 'Veyrier', 'Versoix', 'Bernex', 'Satigny', 'Grand-Saconnex', 'Pregny-Chambésy', 'Genthod', 'Collex-Bossy', 'Presinge', 'Corsier', 'Aire-la-Ville', 'Avusy', 'Laconnex', 'Soral', 'Russin', 'Commugny', 'Mies', 'Tannay', 'Prangins', 'Begnins', 'Trélex', 'Genolier', 'Chêne-Bougeries', 'Vésenaz'], canton: 'GE', home: { query: 'Centre sportif du Bout-du-Monde Genève', nameIncludes: 'Bout-du-Monde' }, terms: ['Stade', 'Centre sportif', 'Terrain de football', 'Terrain de sport'],
    bands: [
      { division: 1, places: ['Genève Champel', 'Genève Eaux-Vives', 'Genève Plainpalais', 'Genève Servette', 'Genève Petit-Saconnex', 'Genève Jonction', 'Genève Pâquis', 'Genève Acacias', 'Genève', 'Carouge', 'Lancy'], match: ['Genève', 'Carouge', 'Lancy'], minKm: 0, maxKm: 5 },
      { division: 2, places: ['Genève Champel', 'Genève Eaux-Vives', 'Genève Plainpalais', 'Genève Servette', 'Genève Petit-Saconnex', 'Genève Jonction', 'Genève Pâquis', 'Genève Acacias', 'Genève', 'Carouge', 'Lancy'], match: ['Genève', 'Carouge', 'Lancy'], minKm: 0, maxKm: 8 },
      { division: 3, places: ['Genève Champel', 'Genève Eaux-Vives', 'Genève Plainpalais', 'Genève Servette', 'Genève Petit-Saconnex', 'Genève Jonction', 'Genève Pâquis', 'Genève Acacias', 'Genève', 'Carouge', 'Lancy'], match: ['Genève', 'Carouge', 'Lancy', 'Chêne-Bougeries'], minKm: 1, maxKm: 12 },
      { division: 4, places: ['Lancy', 'Onex', 'Vernier', 'Meyrin', 'Thônex', 'Chêne-Bourg', 'Grand-Saconnex', 'Plan-les-Ouates', 'Veyrier'], minKm: 2, maxKm: 15 },
      { division: 5, places: ['Versoix', 'Bernex', 'Satigny', 'Collonge-Bellerive', 'Confignon', 'Bellevue', 'Puplinge', 'Anières'], minKm: 5, maxKm: 25 },
      { division: 6, places: ['Céligny', 'Chancy', 'Dardagny', 'Jussy', 'Hermance', 'Avully', 'Cartigny', 'Gy'], minKm: 8, maxKm: 30 },
      { division: 7, places: ['Meinier', 'Choulex', 'Troinex', 'Bardonnex', 'Perly-Certoux', 'Vandœuvres', 'Cologny'], minKm: 3, maxKm: 20 },
      { division: 8, places: ['Nyon', 'Gland', 'Rolle', 'Morges', 'Coppet', 'Founex', 'Aubonne'], minKm: 10, maxKm: 60 },
    ],
  },
];

let last = 0;
async function search(query: string): Promise<Record<string, unknown>[]> {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${encodeURIComponent(query)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = last + 1500 + attempt * 4000 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '40', countrycodes: 'ch', addressdetails: '1', extratags: '1' })}`;
    const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
    const text = await response.text();
    if (!response.ok || !text.startsWith('[')) continue;
    writeFileSync(file, text);
    return JSON.parse(text);
  }
  throw new Error(`Nominatim answered nothing usable for ${query}`);
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

function toGround(raw: Record<string, unknown>): Ground | null {
  const address = (raw.address ?? {}) as Record<string, string>;
  const extra = (raw.extratags ?? {}) as Record<string, string>;
  const name = String(raw.name || '').trim();
  // School sports grounds count when their name says so ("Schul- und Sportanlage"): mapped as a school, with pitches.
  const schoolGround = raw.category === 'amenity' && raw.type === 'school' && /sportanlage|sportplatz|terrain|stade/i.test(name);
  if (!name || !(schoolGround || (raw.category === 'leisure' && TYPES.has(String(raw.type))))) return null;
  if (NOT_FOOTBALL.test(name) || RESERVED.test(name) || CLUB_NAME.test(name)) return null;
  if (extra.sport && !/soccer|multi/.test(extra.sport)) return null;
  const municipality = address.city || address.town || address.village || address.municipality || '';
  const canton = (address['ISO3166-2-lvl4'] || '').replace('CH-', '');
  if (!municipality || !canton || address.country_code !== 'ch') return null;
  return { name, osm: `${raw.osm_type}/${raw.osm_id}`, lat: Number(Number(raw.lat).toFixed(5)), lon: Number(Number(raw.lon).toFixed(5)), municipality, canton, kind: schoolGround ? 'school-sports' : String(raw.type) };
}

// Bern's league geography is the model: for every Bern club of divisions 1 to 8 (sorted by distance from the Bern
// home), the unused ground of the region whose distance from the city's home is closest takes its place. So every
// city keeps Bern's distance profile per league, and travel times and rewards stay comparable.
const geo = await import('../../app/travel-geography.ts');
const bernProfile: Record<number, number[]> = {};
for (let division = 1; division <= 8; division++) {
  bernProfile[division] = geo.seasonClubsOf(division, geo.defaultAiLeagues(1)).filter((club) => club.league === 16 - division)
    .map((club) => km(geo.HOME_VENUE, club.venue)).sort((a, b) => a - b);
}
const output: Record<string, { canton: string; home: Ground; divisions: Record<string, Ground[]> }> = {};
for (const plan of PLANS) {
  const home = (await search(plan.home.query)).map(toGround).find((g) => g && g.name.includes(plan.home.nameIncludes));
  if (!home) throw new Error(`No home ground for ${plan.id}`);
  const pool: Ground[] = [];
  const places = [...new Set([...plan.bands.flatMap((band) => band.places), ...(plan.extra ?? [])])];
  for (const place of places) for (const term of plan.terms) for (const raw of await search(`${term} ${place}`)) {
    const ground = toGround(raw);
    if (!ground || km(home, ground) > 60) continue;
    if ([home, ...pool].some((other) => other.osm === ground.osm || km(other, ground) < 0.15)) continue;
    pool.push(ground);
  }
  const divisions: Record<string, Ground[]> = {};
  for (let division = 1; division <= 8; division++) {
    const picked: Ground[] = [];
    for (const target of bernProfile[division]) {
      const best = pool.filter((g) => !picked.includes(g)).sort((a, b) => Math.abs(km(home, a) - target) - Math.abs(km(home, b) - target))[0];
      if (!best) throw new Error(`${plan.id} division ${division}: pool exhausted (${pool.length} grounds)`);
      picked.push(best);
      pool.splice(pool.indexOf(best), 1);
    }
    divisions[division] = picked;
    console.log(`${plan.id} D${division}: ${picked.map((g) => `${g.name} (${g.municipality}, ${km(home, g).toFixed(1)} km)`).join('; ')}`);
  }
  console.log(`${plan.id}: ${pool.length} grounds left unused`);
  output[plan.id] = { canton: plan.canton, home, divisions };
}
writeFileSync('app/home-cities/pitches.json', `${JSON.stringify({ source: 'OpenStreetMap contributors via Nominatim (ODbL)', generatedAt: new Date().toISOString().slice(0, 10), cities: output }, null, 1)}\n`);
console.log('app/home-cities/pitches.json written');
