export type SeasonMilestone = {
  /** Progression tier (1 = entry, 15 = top); shown to players as Liga 16 - season. */
  season: number;
  title: string;
  description: string;
  rewards: readonly string[];
};

const UPGRADE_UNLOCK_SEASONS: Record<string, number> = {
  boots: 1,
  ballboy: 1,
  technique: 1,
  instinct: 1,
  striker: 1,
  coach: 1,
  academy: 2,
  longshot: 2,
  floodlight: 3,
  freekick: 3,
  scout: 4,
  var: 5,
  worldclass: 5,
  stadium: 6,
  broadcast: 7,
  ballondor: 7,
  sponsor: 8,
  superclub: 9,
  captain: 10,
  rights: 10,
  golden: 11,
  merch: 11,
  brand: 12,
  campus: 13,
  legacy: 14,
  franchise: 14,
  empire: 15,
};

// Tier = 16 - league: every pack opens in the league whose opponents match its cards.
const PACK_UNLOCK_SEASONS: Record<string, number> = {
  scrap: 1,
  regional: 3,
  scout: 5,
  profi: 7,
  elite: 9,
  weltklasse: 11,
  legend: 12,
  // The fragment priced special card pack holds the 100 rated cards, so it opens only in Liga 3.
  special: 13,
};

const TOURNAMENT_UNLOCK_SEASONS: Record<string, number> = {
  stadium: 1,
  champions: 6,
  world: 12,
};

const FORMATION_UNLOCK_SEASONS: Record<string, number> = {
  "433": 1,
  "442": 1,
  "4231": 1,
  "41212-2": 1,
  "433-2": 2,
  "4411-2": 2,
  "433-4": 3,
  "4312": 3,
  "4231-2": 4,
  "4141": 4,
  "4222": 5,
  "4132": 5,
  "4321": 6,
  "41212": 6,
  "433-3": 7,
  "451": 7,
  "442-2": 8,
  "451-2": 8,
  "4213": 9,
  "424": 9,
  "352": 10,
  "3412": 10,
  "343": 11,
  "3421": 11,
  "3142": 12,
  "5212": 12,
  "523": 13,
  "532": 14,
  "541": 15,
};

export const SEASON_MILESTONES: readonly SeasonMilestone[] = [
  { season: 1, title: "Der Anpfiff", description: "Das Fundament für deinen neuen Club.", rewards: ["6 Basis Upgrades", "Schrott-Pack", "Stadionpokal", "4 Formationen"] },
  { season: 2, title: "Nachwuchsprojekt", description: "Der Club beginnt, eigene Talente aufzubauen.", rewards: ["Nachwuchsakademie", "Distanzschütze", "2 neue Formationen"] },
  { season: 3, title: "Abendspiele", description: "Mehr Reichweite und neue taktische Möglichkeiten.", rewards: ["Flutlichtanlage", "Freistoss-Spezialist", "Regional-Pack", "2 neue Formationen"] },
  { season: 4, title: "Scouting Netzwerk", description: "Dein Club sucht jetzt weit über die Region hinaus.", rewards: ["Talent Scouting", "2 neue Formationen"] },
  { season: 5, title: "Video Ära", description: "Technik und das Scout Pack verändern den Club.", rewards: ["VAR 2.0", "Weltklasse-Abschluss", "Scout Pack", "2 neue Formationen"] },
  { season: 6, title: "Grosse Bühne", description: "Das Stadion wächst und Europa schaut zu.", rewards: ["Arena Ausbau", "Champions Cup", "2 neue Formationen"] },
  { season: 7, title: "Medienhaus", description: "Jedes Spiel wird in die ganze Welt übertragen.", rewards: ["Weltweite Übertragung", "Ballon-d'Or-Angreifer", "Profi-Pack", "2 neue Formationen"] },
  { season: 8, title: "Weltmarke", description: "Der erste globale Partner steigt ein.", rewards: ["Globaler Sponsor", "2 neue Formationen"] },
  { season: 9, title: "Superclub", description: "Aus einem Verein wird ein internationales Netzwerk.", rewards: ["Superclub Netzwerk", "Elite Pack", "2 neue Formationen"] },
  { season: 10, title: "Captain Era", description: "Ein Leader prägt die nächste Generation.", rewards: ["Kapitänsbinde", "2 neue Formationen"] },
  { season: 11, title: "Goldene Generation", description: "Deine Klicks werden zur echten Weltklasse.", rewards: ["Goldener Schuh", "Weltklasse-Pack", "2 neue Formationen"] },
  { season: 12, title: "Weltbühne", description: "Jetzt wartet das härteste Turnier im Spiel.", rewards: ["Weltmeisterschaft", "Legenden Pack", "2 neue Formationen"] },
  { season: 13, title: "Legendenjagd", description: "Die seltensten Karten kommen in Reichweite.", rewards: ["Spezialkarten-Pack", "Formation 5-2-3"] },
  { season: 14, title: "Vereins Dynastie", description: "Dein Club verdient dauerhaft auf höchstem Niveau.", rewards: ["Vereins Dynastie", "Formation 5-3-2"] },
  { season: 15, title: "Hall of Fame", description: "Liga 1 ist erreicht. Dein Club gehört jetzt zur ewigen Elite.", rewards: ["Hall of Fame Status", "Prestige freigeschaltet", "Alle 29 Formationen"] },
] as const;

export const MAX_CAREER_SEASON = SEASON_MILESTONES.length;

export function getCurrentSeason(completedSeasons: number) {
  return Math.min(MAX_CAREER_SEASON, Math.max(1, Math.floor(Number.isFinite(completedSeasons) ? completedSeasons : 0) + 1));
}

// League based unlocks. The tables above are indexed by progression tier (1 = entry, 15 = top),
// which is the internal season mode division and the old "Saison" number. Players see leagues:
// Liga 15 is the entry league and Liga 1 the top, so a LOWER league number means MORE progress.
export const LEAGUE_COUNT = MAX_CAREER_SEASON;

export function leagueForTier(tier: number) {
  return LEAGUE_COUNT + 1 - Math.max(1, Math.min(LEAGUE_COUNT, Math.floor(Number.isFinite(tier) ? tier : 1)));
}

/** Best league ever reached. Permanent: relegation never takes an unlock away.
 * `completedSeasons` already stores the highest reached division minus one in every save,
 * so existing careers keep exactly the entitlements they had. */
export function getReachedLeague(completedSeasons: number, highestDivision = 1) {
  return Math.min(leagueForTier(getCurrentSeason(completedSeasons)), leagueForTier(highestDivision));
}

export function hasReachedLeague(requiredLeague: number, reachedLeague: number) {
  return reachedLeague <= requiredLeague;
}

export function isLeagueContentUnlocked(requiredLeague: number, reachedLeague: number, testMode = false) {
  return testMode || hasReachedLeague(requiredLeague, reachedLeague);
}

export function getUpgradeUnlockLeague(id: string) {
  return leagueForTier(UPGRADE_UNLOCK_SEASONS[id] ?? 1);
}

export function getPackUnlockLeague(id: string) {
  return leagueForTier(PACK_UNLOCK_SEASONS[id] ?? 1);
}

export function getTournamentUnlockLeague(id: string) {
  return leagueForTier(TOURNAMENT_UNLOCK_SEASONS[id] ?? 1);
}

export function getFormationUnlockLeague(id: string) {
  return leagueForTier(FORMATION_UNLOCK_SEASONS[id] ?? 1);
}

export function leagueUnlockLabel(league: number) {
  return `Liga ${league}`;
}

export function getSeasonMilestone(season: number) {
  const normalized = Math.max(1, Math.floor(season));
  return SEASON_MILESTONES.find((milestone) => milestone.season === normalized) ?? SEASON_MILESTONES[SEASON_MILESTONES.length - 1];
}

/** Formations for the picker: available ones first in catalogue order, locked ones after them
 * in the order they unlock (Liga 15 is the entry, so Liga 14 comes before Liga 13). */
export function sortFormationsForPicker<T extends { id: string }>(formations: readonly T[], isUnlocked: (formation: T) => boolean) {
  return formations.map((formation, index) => ({ formation, index, rank: isUnlocked(formation) ? 0 : 100 - getFormationUnlockLeague(formation.id) }))
    .sort((first, second) => first.rank - second.rank || first.index - second.index).map((entry) => entry.formation);
}
