// Home cities of stadium Phase 1 (owner's decision of 12 November 2026; docs/home-cities-data.md): Bern, Zürich,
// Basel and Genève. Each city has a fixed home ground for a fictional home club and its own clubs for divisions 1 to 8;
// divisions 9 to 15 are the same for every world. Data only: nothing in the game reads this module yet, so every
// save plays in Bern as before. Bern returns exactly today's catalogue, so old saves stay valid once it is wired in.
import pitches from "./home-cities/pitches.json";
import { HOME_VENUE, LEAGUE_LABELS, SEASON_CLUBS } from "./travel-geography";
import type { SeasonClub, Venue } from "./travel-geography";

export const HOME_CITY_IDS = ["bern", "zurich", "basel", "geneve"] as const;
export type HomeCityId = (typeof HOME_CITY_IDS)[number];
export const DEFAULT_HOME_CITY: HomeCityId = "bern";
/** The divisions with local clubs; from division 9 on every world plays the same national and world leagues. */
export const REGIONAL_DIVISIONS = 8;

/** A local club; `clubSource` names the club's own website that states its home ground (real clubs only). */
export type RegionalClub = SeasonClub & { clubSource?: { url: string; quote: string; placeUrl?: string } };
export type HomeCity = {
  id: HomeCityId;
  name: string;
  canton: string;
  /** Key of the rail station in journey-routing STATIONS. */
  station: "bern" | "zurich" | "basel" | "geneva";
  homeVenue: Venue;
  /** Names of divisions 1 to 8. */
  leagueLabels: readonly string[];
  regionalClubs: RegionalClub[];
};

type Ground = { name: string; osm: string; lat: number; lon: number; municipality: string; canton: string; kind: string };
type Slot = { ground: Ground; distanceKm: number; real?: { name: string; source: string; quote: string; place?: string }; shared?: boolean };
type CityData = { canton: string; home: Ground; divisions: Record<string, Slot[]> };
const DATA = (pitches as unknown as { cities: Record<string, CityData> }).cities;

const osmUrl = (osm: string) => `https://www.openstreetmap.org/${osm}`;
/** Grounds mapped without a proper name ("Sportplatz") get their municipality. */
function groundName(ground: Ground) {
  const name = ground.name.split(",")[0].trim();
  return /^(sportplatz|sportanlage|\d+ terrain de football|terrain de football)$/i.test(name) ? `${name} ${ground.municipality}` : name;
}
function venueOf(id: string, ground: Ground, verified: boolean): Venue {
  return {
    id, stadium: groundName(ground), city: ground.municipality, country: "Schweiz", canton: ground.canton, lat: ground.lat, lon: ground.lon,
    source: osmUrl(ground.osm), coordinateSource: osmUrl(ground.osm),
    verification: verified ? "stadium" : "pitch-fallback",
    coordinateNote: verified ? "Heimplatz laut offizieller Vereinsseite, Lage aus OpenStreetMap." : "Fiktiver Club auf einem realen kartierten Sportplatz.",
  };
}

// Clearly fictional local clubs, in the tone of the Bern Chaosliga. Real clubs come only from VERIFIED in
// scripts/home-cities/fetch-pitches.mts (their own website names their home ground).
const FICTIONAL_NAMES: Record<Exclude<HomeCityId, "bern">, { prefixes: string[]; themes: string[] }> = {
  zurich: {
    prefixes: ["FC", "SC", "SV", "Inter", "Real", "Sporting", "Atletico", "Dynamo", "Racing", "Olympia"],
    themes: ["Sechseläuten", "Böögg", "Limmatschwäne", "Uetliberg", "Tram Elf", "Gschnätzlets", "Bahnhofstrass", "Zürisee Möwen", "Langstrass", "Polybahn", "Chuchichäschtli", "Glatttal Biber", "Hönggerberg Igel", "Bratwurst Oerlike", "Dolder Bähnli", "Seebach Frösche", "Hardbrücke", "Lindenhof Eulen", "Paradeplatz", "Pfannenstiel", "Albis Gämsen", "Furttal Füchse", "Limmattal Lerchen", "Tössbergland", "Rafzerfeld", "Säuliamt", "Weinland Reben", "Oberland Hirsche", "Greifensee Hechte", "Türlersee", "Reppisch Forellen", "Sihltal Biber", "Katzensee", "Irchel Igel", "Bachtel Murmeli", "Lägern Luchse", "Gleis Siebzehn", "Pistenbully", "Wädi Wellen", "Zimmerberg", "Gubrist Stau", "Milchbuck", "Hirschengraben", "Fraumünster Spatzen", "Pfauen Tüüfel", "Schanzengraben", "Rietberg Raben", "Zürihegel"],
  },
  basel: {
    prefixes: ["FC", "SC", "SV", "Inter", "Real", "Sporting", "Atletico", "Dynamo", "Racing", "Olympia"],
    themes: ["Rheinknie Chaoten", "Fasnachtslarve", "Mässmogge", "Läckerli", "Fähri", "Dreiländereck", "Morgestraich", "Waggis", "Rhyschwimmer", "Spalenberg", "Gundeli Gnome", "Birsig", "Wiese Wellen", "Chrischona", "Wasserfallen", "Belchen", "Ergolz", "Diegter Bach", "Blauen", "Gempen Geissen", "Hülften", "Kleinbasler Kämpfer", "Schänzli", "Augusta Raurica", "Fricktal Kirschen", "Laufental", "Schwarzbuben", "Tierstein", "Passwang", "Rheinlachse", "Birseck", "Eggflue", "Sissacher Fluh", "Gondel Reigoldswil", "Homburg", "Frenke", "Wiesental", "Hardwald", "Margarethen", "Leimental", "Bruderholz", "Pfeffinger Schloss", "Domglocke", "Rebberg", "Kirschbaum", "Tinguely", "Zolli Flamingos", "Drummeli"],
  },
  geneve: {
    prefixes: ["FC", "Olympique", "Racing", "Sporting", "Union", "Athletic"],
    themes: ["Jet d'Eau", "Escalade", "Bains des Pâquis", "Mouettes du Léman", "Salève", "Cornavin Express", "Plainpalais Puces", "Rhône Bleu", "Arve Grise", "Mont-Blanc", "Horloge Fleurie", "Moitié-Moitié", "Longeole", "Pont-Rouge", "Tour de l'Île", "Bise Noire", "Vengeron", "Molard", "Treille", "Carouge Sarde", "Mandement", "Champagne Genevoise", "Allondon", "Truites de Versoix", "Jura Vaudois", "Côte Lémanique", "Dôle", "Bois de la Bâtie", "Bastions", "Bout du Lac", "Cygnes du Léman", "Mur des Réformateurs", "Mouettes Genevoises", "Rade", "Perle du Lac", "Bains de Champel", "Pierres du Niton", "Cardinal", "Marmite", "Cardon Genevois", "Vieille Ville", "Saint-Pierre", "Quai Wilson", "Petit Lac", "Barque des Pâquis", "Fêtes de Genève", "Chouette du Salève", "Bise Blanche"],
  },
};
const fictionalName = (city: Exclude<HomeCityId, "bern">, index: number) => {
  const { prefixes, themes } = FICTIONAL_NAMES[city];
  return `${prefixes[index % prefixes.length]} ${themes[index % themes.length]}`;
};

const CITY_META: Record<Exclude<HomeCityId, "bern">, { name: string; prefix: string; station: HomeCity["station"]; homeName: string; labels: string[] }> = {
  zurich: { name: "Zürich", prefix: "zh", station: "zurich", homeName: "Heimstadion Apfelbaum", labels: ["Chaosliga", "Zürcher Quartierliga", "Zürcher Stadtliga", "Zürcher Agglomerationsliga", "Zürcher Regionalliga", "Kantonsliga Zürich", "Zürcher Regionalelite", "Nordostschweizer Liga"] },
  basel: { name: "Basel", prefix: "bs", station: "basel", homeName: "Heimstadion Rheinacker", labels: ["Chaosliga", "Basler Quartierliga", "Basler Stadtliga", "Basler Agglomerationsliga", "Basler Regionalliga", "Kantonsliga beider Basel", "Basler Regionalelite", "Nordwestschweizer Liga"] },
  geneve: { name: "Genève", prefix: "ge", station: "geneva", homeName: "Heimstadion Bout du Monde", labels: ["Chaosliga", "Genfer Quartierliga", "Genfer Stadtliga", "Genfer Agglomerationsliga", "Genfer Regionalliga", "Kantonsliga Genf", "Genfer Regionalelite", "Genferseeliga"] },
};

function buildCity(id: Exclude<HomeCityId, "bern">): HomeCity {
  const meta = CITY_META[id], data = DATA[id];
  const homeVenue = { ...venueOf(`home-${meta.prefix}`, data.home, false), stadium: meta.homeName, registeredStadium: groundName(data.home), coordinateNote: "Fiktiver Heimclub auf einem realen kartierten Sportplatz." };
  const regionalClubs: RegionalClub[] = [];
  let fictional = 0;
  for (let division = 1; division <= REGIONAL_DIVISIONS; division++) {
    data.divisions[division].forEach((slot, index) => {
      const real = slot.real;
      const clubId = `${meta.prefix}-${division}-${index + 1}`;
      regionalClubs.push({
        id: clubId, name: real ? real.name : fictionalName(id, fictional++), league: 16 - division,
        venue: venueOf(`${clubId}-ground`, slot.ground, Boolean(real)),
        ...(real ? { clubSource: { url: real.source, quote: real.quote, ...(real.place ? { placeUrl: real.place } : {}) } } : { fictional: true }),
      });
    });
  }
  return { id, name: meta.name, canton: data.canton, station: meta.station, homeVenue, leagueLabels: meta.labels, regionalClubs };
}

const BERN: HomeCity = {
  id: "bern", name: "Bern", canton: "BE", station: "bern", homeVenue: HOME_VENUE,
  leagueLabels: LEAGUE_LABELS.slice(0, REGIONAL_DIVISIONS),
  // Exactly today's clubs of divisions 1 to 8, same objects and order.
  regionalClubs: SEASON_CLUBS.filter((club) => 16 - club.league <= REGIONAL_DIVISIONS),
};

export const HOME_CITIES: Record<HomeCityId, HomeCity> = { bern: BERN, zurich: buildCity("zurich"), basel: buildCity("basel"), geneve: buildCity("geneve") };

export function isHomeCityId(value: unknown): value is HomeCityId {
  return typeof value === "string" && (HOME_CITY_IDS as readonly string[]).includes(value);
}

/** A saved home city, Bern for every save without one or with an unknown value. */
export function homeCityOf(saved: unknown): HomeCity {
  return HOME_CITIES[isHomeCityId(saved) ? saved : DEFAULT_HOME_CITY];
}

/** All clubs of a world with this home city: its local clubs plus the common clubs of divisions 9 to 15. */
export function worldCatalog(city: HomeCityId): SeasonClub[] {
  return [...HOME_CITIES[city].regionalClubs, ...SEASON_CLUBS.filter((club) => 16 - club.league > REGIONAL_DIVISIONS)];
}
