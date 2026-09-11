export type SeasonMilestone = {
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
  golden: 11,
  legacy: 14,
};

const PACK_UNLOCK_SEASONS: Record<string, number> = {
  scout: 1,
  elite: 5,
  legend: 10,
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
  { season: 1, title: "Der Anpfiff", description: "Das Fundament für deinen neuen Club.", rewards: ["6 Basis Upgrades", "Scout Pack", "Stadionpokal", "4 Formationen"] },
  { season: 2, title: "Nachwuchsprojekt", description: "Der Club beginnt, eigene Talente aufzubauen.", rewards: ["Nachwuchsakademie", "Distanzschütze", "2 neue Formationen"] },
  { season: 3, title: "Abendspiele", description: "Mehr Reichweite und neue taktische Möglichkeiten.", rewards: ["Flutlichtanlage", "Freistoss-Spezialist", "2 neue Formationen"] },
  { season: 4, title: "Scouting Netzwerk", description: "Dein Club sucht jetzt weit über die Region hinaus.", rewards: ["Talent Scouting", "2 neue Formationen"] },
  { season: 5, title: "Video Ära", description: "Technik und bessere Packs verändern den Club.", rewards: ["VAR 2.0", "Weltklasse-Abschluss", "Elite Pack", "2 neue Formationen"] },
  { season: 6, title: "Grosse Bühne", description: "Das Stadion wächst und Europa schaut zu.", rewards: ["Arena Ausbau", "Champions Cup", "2 neue Formationen"] },
  { season: 7, title: "Medienhaus", description: "Jedes Spiel wird in die ganze Welt übertragen.", rewards: ["Weltweite Übertragung", "Ballon-d'Or-Angreifer", "2 neue Formationen"] },
  { season: 8, title: "Weltmarke", description: "Der erste globale Partner steigt ein.", rewards: ["Globaler Sponsor", "2 neue Formationen"] },
  { season: 9, title: "Superclub", description: "Aus einem Verein wird ein internationales Netzwerk.", rewards: ["Superclub Netzwerk", "2 neue Formationen"] },
  { season: 10, title: "Captain Era", description: "Ein Leader prägt die nächste Generation.", rewards: ["Kapitänsbinde", "Legenden Pack", "2 neue Formationen"] },
  { season: 11, title: "Goldene Generation", description: "Deine Klicks werden zur echten Weltklasse.", rewards: ["Goldener Schuh", "2 neue Formationen"] },
  { season: 12, title: "Weltbühne", description: "Jetzt wartet das härteste Turnier im Spiel.", rewards: ["Weltmeisterschaft", "2 neue Formationen"] },
  { season: 13, title: "Legendenjagd", description: "Die seltensten Karten kommen in Reichweite.", rewards: ["Formation 5-2-3"] },
  { season: 14, title: "Vereins Dynastie", description: "Dein Club verdient dauerhaft auf höchstem Niveau.", rewards: ["Vereins Dynastie", "Formation 5-3-2"] },
  { season: 15, title: "Hall of Fame", description: "Die höchste Saison ist erreicht. Dein Club gehört jetzt zur ewigen Elite.", rewards: ["Hall of Fame Status", "Prestige freigeschaltet", "Alle 29 Formationen"] },
] as const;

export const MAX_CAREER_SEASON = SEASON_MILESTONES.length;

export function getCurrentSeason(completedSeasons: number) {
  return Math.min(MAX_CAREER_SEASON, Math.max(1, Math.floor(Number.isFinite(completedSeasons) ? completedSeasons : 0) + 1));
}

export function getUpgradeUnlockSeason(id: string) {
  return UPGRADE_UNLOCK_SEASONS[id] ?? 1;
}

export function getPackUnlockSeason(id: string) {
  return PACK_UNLOCK_SEASONS[id] ?? 1;
}

export function getTournamentUnlockSeason(id: string) {
  return TOURNAMENT_UNLOCK_SEASONS[id] ?? 1;
}

export function getFormationUnlockSeason(id: string) {
  return FORMATION_UNLOCK_SEASONS[id] ?? 1;
}

export function isUnlockedInSeason(unlockSeason: number, completedSeasons: number) {
  return getCurrentSeason(completedSeasons) >= unlockSeason;
}

export function isSeasonContentUnlocked(unlockSeason: number, completedSeasons: number, testMode = false) {
  return testMode || isUnlockedInSeason(unlockSeason, completedSeasons);
}

export function getSeasonMilestone(season: number) {
  const normalized = Math.max(1, Math.floor(season));
  return SEASON_MILESTONES.find((milestone) => milestone.season === normalized) ?? SEASON_MILESTONES[SEASON_MILESTONES.length - 1];
}

export function getSeasonPath(currentGoals: number, completedSeasons: number) {
  const goals = Math.max(0, Number.isFinite(currentGoals) ? currentGoals : 0);
  const completed = Math.max(0, Math.floor(Number.isFinite(completedSeasons) ? completedSeasons : 0));
  const earlyTarget = 250000 * 2 ** Math.min(completed, 8);
  const target = completed <= 8 ? earlyTarget : earlyTarget * 1.6 ** (completed - 8);
  const baseReward = Math.max(1, Math.min(1, Math.floor(Math.sqrt(goals / target))));
  const reward = getCurrentSeason(completed) + 1 === MAX_CAREER_SEASON ? baseReward + 1 : baseReward;

  return {
    target,
    progress: Math.max(0, Math.min(100, (goals / target) * 100)),
    canAdvance: goals >= target,
    reward,
  };
}
