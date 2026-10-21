// Stadium size and look for the match canvas, from the real venue of the fixture.
// Capacities are rounded public figures where they are known (source "known"); smaller grounds
// without a published figure get a conservative estimate from the club's league tier
// (source "estimated"). The home ground of the player's club grows with its league.
import { HOME_VENUE, SEASON_CLUBS } from './travel-geography';
import type { Venue } from './travel-geography';

export type StadiumCategory = 'amateur' | 'regional' | 'pro-small' | 'pro-medium' | 'national' | 'elite';
export type StandType = 'none' | 'terrace' | 'stand' | 'covered' | 'tiered';
export type StadiumSignature = 'san-siro' | 'wembley' | 'allianz';
export type StadiumProfile = {
  name: string;
  category: StadiumCategory;
  capacity: number;
  attendance: number;
  capacitySource: 'known' | 'estimated' | 'club-growth';
  /** Stands behind the top touchline, the bottom (main) touchline and both goals. */
  stands: { top: StandType; bottom: StandType; left: StandType; right: StandType };
  tiers: 1 | 2 | 3;
  roof: boolean;
  floodlights: 'poles' | 'masts' | 'roof';
  boards: boolean;
  signature?: StadiumSignature;
};

export const STADIUM_CATEGORY_LABELS: Record<StadiumCategory, string> = {
  amateur: 'Amateurplatz', regional: 'Regionaler Fussballplatz', 'pro-small': 'Kleines Profistadion',
  'pro-medium': 'Mittelgrosses Profistadion', national: 'Grosses Stadion', elite: 'Elitestadion',
};

/** Rounded capacities by venue ID. */
const KNOWN: Record<string, { capacity: number; signature?: StadiumSignature }> = {
  milan: { capacity: 75800, signature: 'san-siro' }, munich: { capacity: 75000, signature: 'allianz' }, wembley: { capacity: 90000, signature: 'wembley' },
  dortmund: { capacity: 81300 }, madrid: { capacity: 78300 }, barcelona: { capacity: 62000 }, atletico: { capacity: 70500 }, manchester: { capacity: 74000 },
  rio: { capacity: 78800 }, tokyo: { capacity: 68000 }, liverpool: { capacity: 61300 }, london: { capacity: 60700 }, tottenham: { capacity: 62800 },
  lisbon: { capacity: 64600 }, amsterdam: { capacity: 55900 }, naples: { capacity: 54700 }, city: { capacity: 61500 }, istanbul: { capacity: 52200 },
  porto: { capacity: 50000 }, vienna: { capacity: 50900 }, paris: { capacity: 47900 }, leipzig: { capacity: 47000 }, turin: { capacity: 41500 },
  chelsea: { capacity: 40300 }, eindhoven: { capacity: 35000 }, leverkusen: { capacity: 30200 }, monaco: { capacity: 16400 }, sydney: { capacity: 82500 }, miami: { capacity: 26700 },
  // Swiss anchors used by tournaments and season fixtures.
  basel: { capacity: 38500 }, bern: { capacity: 31500 }, geneva: { capacity: 30000 }, zurich: { capacity: 26100 }, stgallen: { capacity: 19700 },
  luzern: { capacity: 16500 }, sion: { capacity: 14300 }, lausanne: { capacity: 12500 }, thun: { capacity: 10000 }, winterthur: { capacity: 8400 }, biel: { capacity: 5200 },
};
/** Swiss grounds matched by stadium name. The name wins over the venue ID, so a stadium has one capacity
 * whether it is reached as a tournament anchor or as a season club's ground. */
const KNOWN_BY_STADIUM: Record<string, number> = {
  'St. Jakob-Park': 38500, 'Stadion Wankdorf': 31500, 'Stade de Genève': 30000, 'Stadion Letzigrund': 26100, Letzigrund: 26100, swissporarena: 16500, Swissporarena: 16500,
  'Berit Sitterstadion': 19700, Kybunpark: 19700, 'Stade de Tourbillon': 14300, 'Stade de la Tuilière': 12500, 'Stade de la Maladière': 12000,
  'VISANA STADION': 10000, 'Stadion Brügglifeld': 8000, 'Schützenwiese': 8400, 'Tissot Arena': 5200, 'AIL Arena': 8800,
  'Stade de la Charrière': 12700, 'Stadion Brühl': 10000, 'Stade de Bouleyres': 5000, 'Stadion Niedermatten': 3700, 'Stadion Linthstrasse': 2800,
};
const MILAN_ALIASES = ['San Siro', 'Stadio Giuseppe Meazza'];

/** League tier (15 entry, 1 top) of the strongest season club playing on this ground; a ground
 * shared by several clubs is sized for the biggest of them, so it keeps one capacity. */
function leagueOfVenue(venue: Venue) {
  const leagues = SEASON_CLUBS.filter(club => club.venue.id === venue.id || (club.venue.stadium === venue.stadium && club.venue.city === venue.city)).map(club => club.league);
  return leagues.length ? Math.min(...leagues) : undefined;
}
function estimateFromLeague(league: number) {
  // Liga 15/14 local pitches, 13 to 10 village grounds, 9 to 6 small stadiums, 5 to 4 Challenge League.
  return league >= 14 ? 300 : league >= 12 ? 600 : league >= 10 ? 1200 : league >= 8 ? 2500 : league >= 6 ? 3500 : league >= 4 ? 5500 : 12000;
}
/** Capacity of the player's own ground for an internal division (1 weakest, 15 strongest). */
export function homeCapacity(division: number) {
  const d = Math.max(1, Math.min(15, Math.floor(division) || 1));
  return [400, 500, 700, 1200, 2000, 3000, 4500, 6500, 9000, 13000, 18000, 26000, 38000, 52000, 70000][d - 1];
}
export function categoryForCapacity(capacity: number): StadiumCategory {
  return capacity < 1000 ? 'amateur' : capacity < 4000 ? 'regional' : capacity < 12000 ? 'pro-small' : capacity < 30000 ? 'pro-medium' : capacity < 55000 ? 'national' : 'elite';
}

function hash(text: string) { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967296; }

const LAYOUT: Record<StadiumCategory, Pick<StadiumProfile, 'stands' | 'tiers' | 'roof' | 'floodlights' | 'boards'>> = {
  amateur: { stands: { top: 'none', bottom: 'terrace', left: 'none', right: 'none' }, tiers: 1, roof: false, floodlights: 'poles', boards: false },
  regional: { stands: { top: 'terrace', bottom: 'covered', left: 'none', right: 'terrace' }, tiers: 1, roof: false, floodlights: 'poles', boards: true },
  'pro-small': { stands: { top: 'stand', bottom: 'covered', left: 'terrace', right: 'terrace' }, tiers: 1, roof: false, floodlights: 'masts', boards: true },
  'pro-medium': { stands: { top: 'covered', bottom: 'covered', left: 'stand', right: 'stand' }, tiers: 1, roof: true, floodlights: 'masts', boards: true },
  national: { stands: { top: 'covered', bottom: 'tiered', left: 'covered', right: 'covered' }, tiers: 2, roof: true, floodlights: 'roof', boards: true },
  elite: { stands: { top: 'tiered', bottom: 'tiered', left: 'tiered', right: 'tiered' }, tiers: 3, roof: true, floodlights: 'roof', boards: true },
};

/**
 * Stadium of a fixture venue. `homeDivision` sizes the player's own ground; `fanMood` (0 to 100)
 * and the seed set the attendance, which stays below capacity unless the mood is at its best.
 */
export function stadiumProfile(venue: Venue | undefined, options: { homeDivision?: number; fanMood?: number; seed?: string; home?: boolean } = {}): StadiumProfile {
  const v = venue ?? HOME_VENUE;
  const own = options.home || v.id === HOME_VENUE.id;
  let capacity: number, capacitySource: StadiumProfile['capacitySource'] = 'known', signature: StadiumSignature | undefined;
  const known = KNOWN[v.id] ?? (MILAN_ALIASES.includes(v.stadium) ? KNOWN.milan : undefined);
  if (own) { capacity = homeCapacity(options.homeDivision ?? 1); capacitySource = 'club-growth'; }
  else if (KNOWN_BY_STADIUM[v.stadium]) capacity = KNOWN_BY_STADIUM[v.stadium];
  else if (known) { capacity = known.capacity; signature = known.signature; }
  else {
    capacity = estimateFromLeague(leagueOfVenue(v) ?? (v.country === 'Schweiz' ? 12 : 4)); capacitySource = 'estimated';
    // A ground named as a sports field is a village or club ground, whatever the league.
    if (/^(Sportplatz|Fussballplatz|Sportanlage|Sportanlagen|Sportpark|Sportzentrum|Centre sportif|Centro Sportivo)\b/i.test(v.stadium)) capacity = Math.min(capacity, 2500);
  }
  const category = categoryForCapacity(capacity);
  // Small grounds are rarely full; big clubs usually are. Fan mood lifts the home crowd.
  const base = { amateur: .3, regional: .38, 'pro-small': .5, 'pro-medium': .62, national: .74, elite: .86 }[category];
  const mood = Math.max(0, Math.min(100, options.fanMood ?? 60)) / 100;
  const fill = Math.max(.12, Math.min(1, base + (own ? (mood - .5) * .3 : 0) + (hash(`${v.id}:${options.seed ?? ''}`) - .5) * .16));
  return { name: v.stadium, category, capacity, attendance: Math.round(capacity * fill / 10) * 10, capacitySource, ...LAYOUT[category], signature };
}

export function stadiumLabel(profile: StadiumProfile) {
  const number = (n: number) => n.toLocaleString('de-CH');
  return `${profile.name} · ${STADIUM_CATEGORY_LABELS[profile.category]} · ${number(profile.attendance)} Zuschauer${profile.capacitySource === 'estimated' ? ' (Kapazität geschätzt)' : ` von ${number(profile.capacity)}`}`;
}

