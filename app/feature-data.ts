import { FC26_STAR_PROFILES, type StarPosition } from "./fc26-player-pool";

export type { StarPosition } from "./fc26-player-pool";

export type TransferPlayer = {
  id: string;
  name: string;
  position: string;
  rating: number;
  price: number;
  clickBonus: number;
  passiveBonus: number;
  incomeBonus: number;
  accent: string;
};

export type TransferMarketState = {
  offerIds: string[];
  ownedIds: string[];
};

export type ClubProfile = {
  name: string;
  badge: string;
  color: string;
};

export type TournamentId = "stadium" | "champions" | "world";
export type CupStrategyId = "angriff" | "konter" | "ballbesitz";
export type CupMatchPhase = "regular" | "extra-time" | "penalties";
export type PenaltyDirection = "left" | "center" | "right";

export type GoalBoostState = {
  tournamentId: TournamentId | null;
  multiplier: number;
  startedAt: number;
  endsAt: number;
};

export type CupState = {
  active: boolean;
  phase: CupMatchPhase;
  tournamentId: TournamentId;
  round: number;
  wins: number;
  best: number;
  trophies: Record<TournamentId, number>;
  lastResult: string;
  matchStartedAt: number;
  matchEndsAt: number;
  lastTickAt: number;
  homeScore: number;
  awayScore: number;
  opponent: string;
  opponentRating: number;
  opponentStrategyId: CupStrategyId;
  strategyId: CupStrategyId;
  substitutionsUsed: number;
  originalLineupIds: string[];
  originalBenchIds: string[];
  playerEnteredAt: Record<string, number>;
  playerExitedAt: Record<string, number>;
  playerMatchPositions: Record<string, StarPosition>;
  lastGoal: CupGoalEvent | null;
  matchEvents: CupGoalEvent[];
  penaltyHomeScore: number;
  penaltyAwayScore: number;
  penaltyHomeTaken: number;
  penaltyAwayTaken: number;
  penaltyTurn: "home" | "away";
  penaltyEvents: CupPenaltyEvent[];
  penaltyMessage: string;
  allTimeScorers: Record<string, number>;
};

export type CupGoalEvent = {
  id: string;
  side: "home" | "away";
  scorerId: string | null;
  scorer: string;
  minute: number;
  createdAt: number;
  homeScore: number;
  awayScore: number;
  ratingImpacts: Record<string, number>;
};

export type CupPenaltyEvent = {
  id: string;
  side: "home" | "away";
  playerId: string | null;
  player: string;
  direction: PenaltyDirection;
  keeperDirection: PenaltyDirection;
  outcome: "goal" | "save" | "miss";
  createdAt: number;
  homeScore: number;
  awayScore: number;
  homeTaken: number;
  awayTaken: number;
};

export type StarXIPlayer = {
  id: string;
  sourceId?: string;
  countryCode?: string;
  name: string;
  position: StarPosition;
  positions: StarPosition[];
  rating: number;
  price: number;
  accent: string;
  cardType?: "base" | "icon" | "legendary";
  packWeight?: number;
};

export type StarFormationId =
  | "3142" | "3412" | "3421" | "352" | "343"
  | "41212" | "41212-2" | "4132" | "4141" | "4213"
  | "4222" | "4231" | "4231-2" | "424" | "4312"
  | "4321" | "433" | "433-2" | "433-3" | "433-4"
  | "4411-2" | "442" | "442-2" | "451" | "451-2"
  | "5212" | "523" | "532" | "541";

export type StarFormationSlot = {
  position: StarPosition;
  x: number;
  y: number;
};

export type StarFormationDefinition = {
  id: StarFormationId;
  label: string;
  slots: readonly StarFormationSlot[];
};

export type StarXIState = {
  ownedIds: string[];
  lineupIds: string[];
  benchIds: string[];
  formationId: StarFormationId;
  formationPositions: StarPosition[];
};

export type StarPackId = "scout" | "elite" | "legend";

export type StarPackOdds = {
  label: string;
  minRating: number;
  maxRating: number;
  chance: number;
};

export type StarPackDefinition = {
  id: StarPackId;
  label: string;
  price: number;
  description: string;
  odds: readonly StarPackOdds[];
};

export type StarPackOpening = {
  packId: StarPackId;
  packName: string;
  player: StarXIPlayer;
  duplicate: boolean;
  compensation: number;
};

export type StarPackReveal = StarPackOpening & {
  openedAt: number;
  openedBy: string;
};

export type TournamentOpponent = {
  name: string;
  rating: number;
  strategyId: CupStrategyId;
  scorers: readonly string[];
};

export type TournamentDefinition = {
  id: TournamentId;
  label: string;
  trophyName: string;
  trophyIcon: string;
  description: string;
  minimumRating: number;
  opponents: readonly TournamentOpponent[];
  accent: string;
};

export type MissionKind = "goals" | "clicks" | "minigames" | "cupWins";

export type CoopMission = {
  id: string;
  title: string;
  description: string;
  kind: MissionKind;
  target: number;
  reward: number;
  claimed: boolean;
};

export type HistoryTone = "positive" | "negative" | "neutral";

export type MatchHistoryEntry = {
  id: string;
  title: string;
  detail: string;
  tone: HistoryTone;
  timestamp: number;
};

export type RandomEvent = {
  id: "var" | "elefantino" | "sponsor" | "fans" | "injury" | "weather";
  title: string;
  message: string;
  amount: number;
  tone: HistoryTone;
  createdAt: number;
};

export type GameFeatures = {
  schemaVersion: number;
  transferMarket: TransferMarketState;
  starXI: StarXIState;
  club: ClubProfile;
  cup: CupState;
  goalBoost: GoalBoostState;
  missions: CoopMission[];
  history: MatchHistoryEntry[];
  randomEvent: RandomEvent | null;
  starPackReveal: StarPackReveal | null;
  nextEventAt: number;
  nextVarAt: number;
};

export type MissionProgressSource = {
  seasonGoals: number;
  clicks: number;
  minigameWins: number;
  cupWins: number;
};

export const CLUB_BADGES = ["⚽", "🦅", "🔥", "🦁", "⭐", "🛡️"];
export const CLUB_COLORS = ["#0071e3", "#1d1d1f", "#e85d04", "#16845b", "#8b5cf6", "#d12c54"];
export const CUP_MATCH_DURATION_MS = 180000;
export const CUP_EXTRA_TIME_DURATION_MS = 60000;
export const TOURNAMENT_GOAL_BOOST_DURATION_MS = 180000;
export const TOURNAMENT_GOAL_BOOST_MULTIPLIERS: Readonly<Record<TournamentId, number>> = {
  stadium: 1.5,
  champions: 2,
  world: 3,
};
export const STAR_PACK_ROLL_DURATION_MS = 8000;
export const STAR_XI_SQUAD_SIZE = 11;
export const STAR_XI_BENCH_SIZE = 7;
export const STAR_XI_MAX_SUBSTITUTIONS = 5;
export const GAME_FEATURES_SCHEMA_VERSION = 1;
export const STAR_POSITIONS: readonly StarPosition[] = ["TW", "LV", "LAV", "IV", "RV", "RAV", "ZDM", "ZM", "ZOM", "LM", "RM", "LF", "RF", "MS", "ST"];
export const STAR_POSITION_NAMES: Record<StarPosition, string> = {
  TW: "Torwart",
  LV: "Linker Verteidiger",
  LAV: "Linker Aussenverteidiger",
  IV: "Innenverteidiger",
  RV: "Rechter Verteidiger",
  RAV: "Rechter Aussenverteidiger",
  ZDM: "Zentrales defensives Mittelfeld",
  ZM: "Zentrales Mittelfeld",
  ZOM: "Zentrales offensives Mittelfeld",
  LM: "Linkes Mittelfeld",
  RM: "Rechtes Mittelfeld",
  LF: "Linker Flügel",
  RF: "Rechter Flügel",
  MS: "Mittelstürmer",
  ST: "Stürmer",
};

function defineStarFormation(id: StarFormationId, label: string, rows: readonly (readonly StarPosition[])[]): StarFormationDefinition {
  const laidOutRows = rows.map((positions, rowIndex) => {
    const y = rows.length === 1 ? 50 : 11 + rowIndex * (80 / (rows.length - 1));
    return positions.map((position, positionIndex) => ({
      position,
      x: ((positionIndex + 1) / (positions.length + 1)) * 100,
      y,
    }));
  });
  return { id, label, slots: [...laidOutRows].reverse().flat() };
}

const BACK_THREE = ["IV", "IV", "IV"] as const;
const BACK_FOUR = ["LV", "IV", "IV", "RV"] as const;
const BACK_FIVE = ["LAV", "IV", "IV", "IV", "RAV"] as const;
const GOALKEEPER = ["TW"] as const;

export const STAR_FORMATIONS: readonly StarFormationDefinition[] = [
  defineStarFormation("3142", "3-1-4-2", [["ST", "ST"], ["LM", "ZM", "ZM", "RM"], ["ZDM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("3412", "3-4-1-2", [["ST", "ST"], ["ZOM"], ["LM", "ZM", "ZM", "RM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("3421", "3-4-2-1", [["ST"], ["LF", "RF"], ["LM", "ZM", "ZM", "RM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("352", "3-5-2", [["ST", "ST"], ["LM", "ZOM", "RM"], ["ZDM", "ZDM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("343", "3-4-3", [["LF", "ST", "RF"], ["LM", "ZM", "ZM", "RM"], BACK_THREE, GOALKEEPER]),
  defineStarFormation("41212", "4-1-2-1-2 (Breit)", [["ST", "ST"], ["ZOM"], ["LM", "RM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("41212-2", "4-1-2-1-2 (Eng)", [["ST", "ST"], ["ZOM"], ["ZM", "ZM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4132", "4-1-3-2", [["ST", "ST"], ["LM", "ZM", "RM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4141", "4-1-4-1", [["ST"], ["LM", "ZM", "ZM", "RM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4213", "4-2-1-3", [["LF", "ST", "RF"], ["ZOM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4222", "4-2-2-2", [["ST", "ST"], ["ZOM", "ZOM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4231", "4-2-3-1 (Eng)", [["ST"], ["ZOM", "ZOM", "ZOM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4231-2", "4-2-3-1 (Breit)", [["ST"], ["LM", "ZOM", "RM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("424", "4-2-4", [["LF", "ST", "ST", "RF"], ["ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4312", "4-3-1-2", [["ST", "ST"], ["ZOM"], ["ZM", "ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4321", "4-3-2-1", [["ST"], ["LF", "RF"], ["ZM", "ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433", "4-3-3", [["LF", "ST", "RF"], ["ZM", "ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433-2", "4-3-3 (2) Holding", [["LF", "ST", "RF"], ["ZM", "ZM"], ["ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433-3", "4-3-3 (3) Defensiv", [["LF", "ST", "RF"], ["ZM"], ["ZDM", "ZDM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("433-4", "4-3-3 (4) Offensiv", [["LF", "ST", "RF"], ["ZOM"], ["ZM", "ZM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("4411-2", "4-4-1-1 (2)", [["ST"], ["ZOM"], ["LM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("442", "4-4-2", [["ST", "ST"], ["LM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("442-2", "4-4-2 (2) Holding", [["ST", "ST"], ["LM", "ZDM", "ZDM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("451", "4-5-1", [["ST"], ["LM", "ZM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("451-2", "4-5-1 (2) Offensiv", [["ST"], ["ZOM"], ["LM", "ZM", "ZM", "RM"], BACK_FOUR, GOALKEEPER]),
  defineStarFormation("5212", "5-2-1-2", [["ST", "ST"], ["ZOM"], ["ZM", "ZM"], BACK_FIVE, GOALKEEPER]),
  defineStarFormation("523", "5-2-3", [["LF", "ST", "RF"], ["ZM", "ZM"], BACK_FIVE, GOALKEEPER]),
  defineStarFormation("532", "5-3-2", [["ST", "ST"], ["ZM", "ZM", "ZM"], BACK_FIVE, GOALKEEPER]),
  defineStarFormation("541", "5-4-1", [["ST"], ["LM", "ZM", "ZM", "RM"], BACK_FIVE, GOALKEEPER]),
] as const;

export function getStarFormation(id: unknown) {
  return STAR_FORMATIONS.find((formation) => formation.id === id) ?? STAR_FORMATIONS.find((formation) => formation.id === "433")!;
}

export const STAR_XI_FORMATION_POSITIONS: readonly StarPosition[] = getStarFormation("433").slots.map((slot) => slot.position);
export const TOURNAMENTS: readonly TournamentDefinition[] = [
  {
    id: "stadium",
    label: "Stadionpokal",
    trophyName: "Stadionpokal",
    trophyIcon: "🏆",
    description: "Drei Spiele am Stück und faire Gegner für deine erste Star XI.",
    minimumRating: 55,
    opponents: [
      { name: "FC Winterthure", rating: 58, strategyId: "ballbesitz", scorers: ["Matteo Di Giusto", "Aldin Turkes", "Nishan Burkart"] },
      { name: "BSC Young Burs", rating: 63, strategyId: "angriff", scorers: ["Cédric Ittan", "Joël Monteiroh", "Filip Ugrinic"] },
      { name: "FC Basilea", rating: 68, strategyId: "konter", scorers: ["Xherdan Shaqiry", "Albian Ajati", "Kevin Carloso"] },
    ],
    accent: "#16845b",
  },
  {
    id: "champions",
    label: "Champions Cup",
    trophyName: "Champions Pokal",
    trophyIcon: "🏆",
    description: "Vier Runden gegen Clubs auf internationalem Topniveau.",
    minimumRating: 74,
    opponents: [
      { name: "Borussia Dortmundt", rating: 76, strategyId: "ballbesitz", scorers: ["Serhou Girassy", "Karim Adejemi", "Julian Brandto"] },
      { name: "AC Milana", rating: 80, strategyId: "angriff", scorers: ["Rafael Leao", "Kristjan Pulisik", "Santiago Gimenez"] },
      { name: "Atlético Madrido", rating: 84, strategyId: "konter", scorers: ["Antwan Griezman", "Julián Alvares", "Alexander Sorloth"] },
      { name: "Arsenal Londra", rating: 88, strategyId: "ballbesitz", scorers: ["Bukayo Sako", "Martin Odegard", "Kai Hawertz"] },
    ],
    accent: "#0071e3",
  },
  {
    id: "world",
    label: "Weltmeisterschaft",
    trophyName: "Weltpokal",
    trophyIcon: "🌍",
    description: "Sechs Runden am Stück gegen die stärksten Teams der Welt.",
    minimumRating: 86,
    opponents: [
      { name: "Paris Saint German", rating: 88, strategyId: "angriff", scorers: ["Ousmane Dembelé", "Khvicha Kvaradona", "Bradley Barcolá"] },
      { name: "Liverpuhl FC", rating: 91, strategyId: "ballbesitz", scorers: ["Mohamed Salahm", "Luis Diazo", "Darwin Nunez"] },
      { name: "Bayern Münchan", rating: 94, strategyId: "konter", scorers: ["Harry Kané", "Jamal Musiala", "Michael Olisé"] },
      { name: "Manchester Cité", rating: 96, strategyId: "ballbesitz", scorers: ["Erling Haland", "Phil Fodenh", "Kevin de Bruyne"] },
      { name: "Real Madreto", rating: 98, strategyId: "angriff", scorers: ["Kylian Mbappo", "Vinícius Juniora", "Jude Bellingam"] },
      { name: "Galácticos XI", rating: 99, strategyId: "konter", scorers: ["Cristiano Rinaldo", "Lionel Messy", "Ronaldo Nazárioh"] },
    ],
    accent: "#c69214",
  },
];

export function getRandomEventDelay(random = Math.random()) {
  return 60000 + Math.floor(Math.max(0, Math.min(0.999999, random)) * 120000);
}

export const TRANSFER_PLAYERS: TransferPlayer[] = [
  { id: "turbo", name: "Luca Turbo", position: "Flügel", rating: 78, price: 1800, clickBonus: 3, passiveBonus: 0, incomeBonus: 0, accent: "#0071e3" },
  { id: "wall", name: "Nora Wand", position: "Torhüterin", rating: 82, price: 3200, clickBonus: 0, passiveBonus: 30, incomeBonus: 0, accent: "#16845b" },
  { id: "maestro", name: "Milo Maestro", position: "Mittelfeld", rating: 86, price: 7500, clickBonus: 0, passiveBonus: 120, incomeBonus: 0.03, accent: "#8b5cf6" },
  { id: "finisher", name: "Sofia Finisher", position: "Sturm", rating: 89, price: 15000, clickBonus: 15, passiveBonus: 0, incomeBonus: 0, accent: "#d12c54" },
  { id: "engine", name: "Dario Dauerläufer", position: "Box to Box", rating: 91, price: 42000, clickBonus: 20, passiveBonus: 350, incomeBonus: 0, accent: "#e85d04" },
  { id: "captain", name: "Amira Captain", position: "Leaderin", rating: 94, price: 110000, clickBonus: 60, passiveBonus: 600, incomeBonus: 0.05, accent: "#c69214" },
  { id: "wonderkid", name: "Noah Wonderkid", position: "Talent", rating: 96, price: 280000, clickBonus: 120, passiveBonus: 1200, incomeBonus: 0.08, accent: "#0071e3" },
  { id: "legend", name: "Die Legende", position: "Ikone", rating: 99, price: 900000, clickBonus: 300, passiveBonus: 4000, incomeBonus: 0.12, accent: "#1d1d1f" },
];

const SPECIAL_STAR_XI_PLAYERS: StarXIPlayer[] = [
  {
    id: "star-goat-nicu",
    name: "GOAT Nicu",
    position: "ST",
    positions: ["TW", "LV", "LAV", "IV", "RV", "RAV", "ZDM", "ZM", "ZOM", "LM", "RM", "LF", "RF", "MS", "ST"],
    rating: 100,
    price: 5000000000,
    accent: "#c69214",
    cardType: "legendary",
    packWeight: 0.01,
  },
  {
    id: "star-flurin-fabrice",
    name: "Flurin Fabrice",
    position: "ZM",
    positions: ["ZM"],
    rating: 67,
    price: 1000,
    accent: "#8e8e93",
    cardType: "legendary",
    packWeight: 0.04,
  },
  {
    id: "star-benxli",
    countryCode: "CH",
    name: "Benxli",
    position: "TW",
    positions: ["TW"],
    rating: 67,
    price: 1000,
    accent: "#1f7a4f",
    cardType: "legendary",
    packWeight: 0.04,
  },
  {
    id: "star-maetthu",
    name: "Mätthu",
    position: "TW",
    positions: ["TW"],
    rating: 100,
    price: 5000000000,
    accent: "#c6cbd2",
    packWeight: 0.02,
  },
  {
    id: "star-champ-simu",
    name: "Champ Simu",
    position: "IV",
    positions: ["IV"],
    rating: 100,
    price: 5000000000,
    accent: "#c6cbd2",
    packWeight: 0.02,
  },
  {
    id: "star-silvuz",
    countryCode: "CH",
    name: "Silvuz",
    position: "LF",
    positions: ["LF", "LM"],
    rating: 100,
    price: 5000000000,
    accent: "#d71920",
    packWeight: 0.02,
  },
  {
    id: "star-nedu-mann-yesss",
    countryCode: "BA",
    name: "Nedu Mann Yesss",
    position: "ZM",
    positions: ["ZM", "ZDM"],
    rating: 100,
    price: 5000000000,
    accent: "#0033a0",
    cardType: "legendary",
    packWeight: 0.02,
  },
];

// The imported FC26 base-player dataset does not contain Ultimate Team ICON
// items. This separate pool contains the full 129-player FC26 Icon roster.
// Names stay deliberately altered, as requested for the rest of the game.
type IconSeed = readonly [id: string, name: string, rating: number, countryCode: string, positions: readonly StarPosition[]];
const FC26_ICON_DATA = [
  ["pele", "Peléo", 95, "BR", ["ZOM", "ST"]],
  ["diego-maradona", "Diego Maradono", 95, "AR", ["ZOM", "ST"]],
  ["ronaldo", "Ronaldo Nazárioh", 94, "BR", ["ST"]],
  ["zinedine-zidane", "Zinedine Zidané", 94, "FR", ["ZOM", "ZM"]],
  ["johan-cruyff", "Johan Cruyffo", 93, "NL", ["ZOM", "ST", "MS"]],
  ["mia-hamm", "Mia Hamms", 93, "US", ["ST", "ZOM", "RF"]],
  ["ronaldinho", "Ronaldinho Gaúchoz", 93, "BR", ["LF", "ZOM"]],
  ["nadine-angerer", "Nadine Angererr", 92, "DE", ["TW"]],
  ["franz-beckenbauer", "Franz Beckenbauar", 92, "DE", ["IV", "ZDM", "ZM"]],
  ["bobby-charlton", "Bobby Charltono", 92, "EN", ["ZOM", "ZM"]],
  ["garrincha", "Garrincho", 92, "BR", ["RF", "RM"]],
  ["andres-iniesta", "Andrés Iniestá", 92, "ES", ["ZM", "ZOM", "LF"]],
  ["paolo-maldini", "Paolo Maldiny", 92, "IT", ["IV", "LV"]],
  ["gerd-muller", "Gerd Müllar", 92, "DE", ["ST"]],
  ["birgit-prinz", "Birgit Prinzz", 92, "DE", ["ST"]],
  ["ferenc-puskas", "Ferenc Puskáz", 92, "HU", ["ST", "ZOM"]],
  ["lev-yashin", "Lev Yashim", 92, "RU", ["TW"]],
  ["alex-morgan", "Alex Morgann", 91, "US", ["ST", "LF"]],
  ["roberto-baggio", "Roberto Baggiö", 91, "IT", ["ZOM", "ST"]],
  ["franco-baresi", "Franco Baresio", 91, "IT", ["IV"]],
  ["gianluigi-buffon", "Gianluigi Buffono", 91, "IT", ["TW"]],
  ["cafu", "Cafúu", 91, "BR", ["RV", "RAV"]],
  ["carlos-alberto", "Carlos Albertó", 91, "BR", ["RV", "IV"]],
  ["eusebio", "Eusébioh", 91, "PT", ["ST"]],
  ["thierry-henry", "Thierry Henryk", 91, "FR", ["ST", "LF"]],
  ["zlatan-ibrahimovic", "Zlatan Ibrahimovik", 91, "SE", ["ST", "MS"]],
  ["oliver-kahn", "Oliver Kahnn", 91, "DE", ["TW"]],
  ["homare-sawa", "Homare Sawaa", 91, "JP", ["ZM", "ZOM"]],
  ["marco-van-basten", "Marco van Bastem", 91, "NL", ["ST"]],
  ["xavi", "Xaví", 91, "ES", ["ZM", "ZDM", "ZOM"]],
  ["zico", "Zicóo", 91, "BR", ["ZOM", "ZM"]],
  ["camille-abily", "Camille Abilyy", 90, "FR", ["ZM", "ZOM"]],
  ["dennis-bergkamp", "Dennis Bergkampp", 90, "NL", ["ST", "ZOM"]],
  ["george-best", "George Besto", 90, "NI", ["RF", "ZOM", "LF"]],
  ["iker-casillas", "Iker Casillaz", 90, "ES", ["TW"]],
  ["alessandro-del-piero", "Alessandro Del Pierro", 90, "IT", ["ZOM", "ST"]],
  ["julie-foudy", "Julie Foudyy", 90, "US", ["ZM", "ZDM"]],
  ["ruud-gullit", "Ruud Gullito", 90, "NL", ["ZOM", "ZM", "ST"]],
  ["toni-kroos", "Toni Krooz", 90, "DE", ["ZM", "ZDM", "ZOM"]],
  ["lothar-matthaus", "Lothar Matthäuz", 90, "DE", ["ZM", "IV", "ZDM"]],
  ["aya-miyama", "Aya Miyamaa", 90, "JP", ["LM", "ZM", "LF"]],
  ["bobby-moore", "Bobby Mooré", 90, "EN", ["IV"]],
  ["andrea-pirlo", "Andrea Pirloz", 90, "IT", ["ZM", "ZDM"]],
  ["raul", "Raúlo", 90, "ES", ["ST", "MS"]],
  ["rivaldo", "Rivaldoo", 90, "BR", ["LF", "LM", "ZOM"]],
  ["rivellino", "Rivellinó", 90, "BR", ["ZOM", "LM", "LF"]],
  ["roberto-carlos", "Roberto Carloso", 90, "BR", ["LV", "LAV"]],
  ["lotta-schelin", "Lotta Schelinn", 90, "SE", ["ST", "LM", "LF"]],
  ["caroline-seger", "Caroline Segerz", 90, "SE", ["ZM", "ZDM"]],
  ["gabriel-batistuta", "Gabriel Batistutá", 89, "AR", ["ST"]],
  ["emilio-butragueno", "Emilio Butragueñó", 89, "ES", ["ST", "MS"]],
  ["fabio-cannavaro", "Fabio Cannavarro", 89, "IT", ["IV"]],
  ["eric-cantona", "Eric Cantoná", 89, "FR", ["ST", "ZOM"]],
  ["didier-drogba", "Didier Drogbo", 89, "CI", ["ST"]],
  ["kenny-dalglish", "Kenny Dalglisho", 89, "SC", ["ST", "MS"]],
  ["samuel-etoo", "Samuel Etoh", 89, "CM", ["ST"]],
  ["luis-figo", "Luís Figoz", 89, "PT", ["RF", "RM", "ZOM"]],
  ["philipp-lahm", "Philipp Lahmo", 89, "DE", ["RV", "LV", "ZDM"]],
  ["hugo-sanchez", "Hugo Sánchezz", 89, "MX", ["ST"]],
  ["jairzinho", "Jairzinhoh", 89, "BR", ["RF", "RM", "ST"]],
  ["kaka", "Kakáh", 91, "BR", ["ZOM"]],
  ["gary-lineker", "Gary Linekerr", 89, "EN", ["ST"]],
  ["marcelo", "Marcelo Vieiro", 89, "BR", ["LV", "LAV", "LM"]],
  ["alessandro-nesta", "Alessandro Nestae", 89, "IT", ["IV"]],
  ["ruud-van-nistelrooy", "Ruud van Nistelrooij", 89, "NL", ["ST"]],
  ["carles-puyol", "Carles Puyolo", 89, "ES", ["IV", "RV"]],
  ["peter-schmeichel", "Peter Schmeichell", 89, "DK", ["TW"]],
  ["alan-shearer", "Alan Shearerr", 89, "EN", ["ST"]],
  ["kelly-smith", "Kelly Smithh", 89, "EN", ["ST"]],
  ["socrates", "Sócrateso", 89, "BR", ["ZOM", "ZM"]],
  ["steffi-jones", "Steffi Joness", 89, "DE", ["IV", "ZDM", "LV"]],
  ["hristo-stoichkov", "Hristo Stoichkoff", 89, "BG", ["ST", "RF", "LF"]],
  ["francesco-totti", "Francesco Tottis", 88, "IT", ["ST", "ZOM", "MS"]],
  ["javier-zanetti", "Javier Zanettí", 89, "AR", ["RV", "LV", "ZM"]],
  ["gareth-bale", "Gareth Baleo", 88, "WA", ["RF", "ST", "LF"]],
  ["david-beckham", "David Beckhamn", 88, "EN", ["RM", "ZM", "RF"]],
  ["laurent-blanc", "Laurent Blanco", 88, "FR", ["IV", "ZDM"]],
  ["petr-cech", "Petr Čeck", 88, "CZ", ["TW"]],
  ["giorgio-chiellini", "Giorgio Chiellino", 88, "IT", ["IV", "LV"]],
  ["marcel-desailly", "Marcel Desaillyy", 88, "FR", ["IV", "ZDM"]],
  ["rio-ferdinand", "Rio Ferdinando", 88, "EN", ["IV"]],
  ["steven-gerrard", "Steven Gerrardt", 89, "EN", ["ZM", "ZDM"]],
  ["gheorghe-hagi", "Gheorghe Hagí", 88, "RO", ["ZOM", "ZM", "LM"]],
  ["fernando-hierro", "Fernando Hierroo", 88, "ES", ["IV", "ZDM"]],
  ["geoff-hurst", "Geoff Hursto", 88, "EN", ["ST"]],
  ["mario-kempes", "Mario Kempesz", 88, "AR", ["ST", "ZOM"]],
  ["miroslav-klose", "Miroslav Klosek", 88, "DE", ["ST"]],
  ["ronald-koeman", "Ronald Koemann", 88, "NL", ["IV", "ZDM"]],
  ["michael-laudrup", "Michael Laudrupp", 88, "DK", ["ZOM", "LF"]],
  ["pavel-nedved", "Pavel Nedvědy", 88, "CZ", ["LM", "ZOM", "LF"]],
  ["michael-owen", "Michael Owenn", 88, "EN", ["ST"]],
  ["marinette-pichon", "Marinette Pichonn", 88, "FR", ["ST"]],
  ["franck-ribery", "Franck Ribéryy", 88, "FR", ["LM", "LF"]],
  ["juan-roman-riquelme", "Juan Román Riquelmé", 88, "AR", ["ZOM"]],
  ["wayne-rooney", "Wayne Roonie", 88, "EN", ["ST", "ZOM"]],
  ["paul-scholes", "Paul Scholess", 88, "EN", ["ZM", "ZOM"]],
  ["bastian-schweinsteiger", "Bastian Schweinsteigar", 88, "DE", ["ZM", "LM", "ZDM"]],
  ["andriy-shevchenko", "Andriy Shevchenkó", 88, "UA", ["ST", "RF"]],
  ["lilian-thuram", "Lilian Thuramm", 88, "FR", ["RV", "IV"]],
  ["edwin-van-der-sar", "Edwin van der Sarr", 88, "NL", ["TW"]],
  ["robin-van-persie", "Robin van Persié", 88, "NL", ["ST", "RF"]],
  ["patrick-vieira", "Patrick Vieirá", 88, "FR", ["ZM", "ZDM"]],
  ["john-barnes", "John Barness", 87, "EN", ["LF", "LM", "ZOM"]],
  ["dunga", "Dungáo", 87, "BR", ["ZDM", "ZM"]],
  ["patrick-kluivert", "Patrick Kluiverto", 87, "NL", ["ST"]],
  ["frank-lampard", "Frank Lampardo", 87, "EN", ["ZM", "ZOM"]],
  ["claude-makelele", "Claude Makélélè", 87, "FR", ["ZDM", "ZM", "RM"]],
  ["emmanuel-petit", "Emmanuel Petitt", 87, "FR", ["ZDM", "LV", "ZM"]],
  ["robert-pires", "Robert Pirèz", 87, "FR", ["LM", "ZOM", "LF"]],
  ["frank-rijkaard", "Frank Rijkaardo", 87, "NL", ["ZDM", "IV", "ZM"]],
  ["ian-rush", "Ian Rushh", 87, "WA", ["ST"]],
  ["davor-suker", "Davor Šukerr", 87, "HR", ["ST"]],
  ["fernando-torres", "Fernando Torrez", 87, "ES", ["ST"]],
  ["nemanja-vidic", "Nemanja Vidič", 87, "RS", ["IV"]],
  ["ian-wright", "Ian Wrightt", 87, "EN", ["ST"]],
  ["xabi-alonso", "Xabi Alonseo", 87, "ES", ["ZDM", "ZM"]],
  ["cha-bum-kun", "Cha Bum-Kuno", 88, "KR", ["ST", "RF"]],
  ["gianfranco-zola", "Gianfranco Zolaa", 87, "IT", ["ZOM", "ST"]],
  ["ashley-cole", "Ashley Colee", 86, "EN", ["LV"]],
  ["sol-campbell", "Sol Campbelll", 86, "EN", ["IV"]],
  ["hernan-crespo", "Hernán Crespó", 86, "AR", ["ST"]],
  ["michael-essien", "Michael Essieno", 86, "GH", ["ZDM", "ZM"]],
  ["gennaro-gattuso", "Gennaro Gattusso", 86, "IT", ["ZDM", "ZM"]],
  ["luis-hernandez", "Luis Hernándezz", 86, "MX", ["ST"]],
  ["roy-keane", "Roy Keané", 86, "IE", ["ZM", "ZDM"]],
  ["henrik-larsson", "Henrik Larssonn", 86, "SE", ["ST"]],
  ["sissi", "Sissí do Brasil", 86, "BR", ["ZOM"]],
  ["juan-sebastian-veron", "Juan Sebastián Verónn", 86, "AR", ["ZM", "ZOM"]],
  ["gianluca-zambrotta", "Gianluca Zambrottá", 86, "IT", ["RV", "LV"]],
] as const satisfies readonly IconSeed[];

const FC26_ICON_PLAYERS: StarXIPlayer[] = FC26_ICON_DATA.map(([id, name, rating, countryCode, positions]) => ({
  id: `icon-${id}`,
  countryCode,
  name,
  position: positions[0],
  positions: [...positions],
  rating,
  price: Math.round(Math.min(1500000000, 650000000 * 1.12 ** (rating - 86))),
  accent: "#d6dde8",
  cardType: "icon",
  packWeight: 0.015,
}));

export const STAR_XI_PLAYERS: StarXIPlayer[] = [
  ...SPECIAL_STAR_XI_PLAYERS,
  ...FC26_ICON_PLAYERS,
  ...FC26_STAR_PROFILES.map((profile) => ({
    id: profile.id,
    sourceId: profile.sourceId,
    name: profile.name,
    position: profile.positions[0],
    positions: [...profile.positions],
    rating: profile.rating,
    price: Math.round(Math.min(1500000000, 5000 * 1.28 ** (profile.rating - 70))),
    accent: profile.accent,
  })),
];

const STAR_XI_PLAYER_BY_ID = new Map(STAR_XI_PLAYERS.map((player) => [player.id, player]));

export const STAR_PACKS: readonly StarPackDefinition[] = [
  { id: "scout", label: "Scout Pack", price: 30000, description: "Früh verfügbar und ideal zum Aufbau, starke Karten bleiben extrem selten", odds: [{ label: "Standard 67–79", minRating: 67, maxRating: 79, chance: 0.9 }, { label: "Selten 80–85", minRating: 80, maxRating: 85, chance: 0.09 }, { label: "Walkout 86–89", minRating: 86, maxRating: 89, chance: 0.009 }, { label: "Top Walkout 90–99", minRating: 90, maxRating: 99, chance: 0.00099 }, { label: "Legendär 100", minRating: 100, maxRating: 100, chance: 0.00001 }] },
  { id: "elite", label: "Elite Pack", price: 250000000, description: "Midgame Pack mit besseren Chancen, aber ohne geschenkte Topelf", odds: [{ label: "Standard 67–79", minRating: 67, maxRating: 79, chance: 0.55 }, { label: "Selten 80–85", minRating: 80, maxRating: 85, chance: 0.38 }, { label: "Walkout 86–89", minRating: 86, maxRating: 89, chance: 0.06 }, { label: "Top Walkout 90–99", minRating: 90, maxRating: 99, chance: 0.0099 }, { label: "Legendär 100", minRating: 100, maxRating: 100, chance: 0.0001 }] },
  { id: "legend", label: "Legenden Pack", price: 5000000000, description: "Teures Endgame Risiko mit klar besseren, aber weiterhin seltenen Topkarten", odds: [{ label: "Standard 67–79", minRating: 67, maxRating: 79, chance: 0.18 }, { label: "Selten 80–85", minRating: 80, maxRating: 85, chance: 0.42 }, { label: "Walkout 86–89", minRating: 86, maxRating: 89, chance: 0.34 }, { label: "Top Walkout 90–99", minRating: 90, maxRating: 99, chance: 0.05 }, { label: "Legendär 100", minRating: 100, maxRating: 100, chance: 0.01 }] },
];

const PACK_POSITION_GROUPS = [
  { id: "goalkeeper", chance: 1 / 11, positions: ["TW"] },
  { id: "defence", chance: 4 / 11, positions: ["LV", "LAV", "IV", "RV", "RAV"] },
  { id: "midfield", chance: 3 / 11, positions: ["ZDM", "ZM", "ZOM", "LM", "RM"] },
  { id: "attack", chance: 3 / 11, positions: ["LF", "RF", "MS", "ST"] },
] as const;

const STAR_RATING_POOLS = new Map<string, StarXIPlayer[]>();
for (const pack of STAR_PACKS) {
  for (const odds of pack.odds) {
    const key = `${odds.minRating}-${odds.maxRating}`;
    if (!STAR_RATING_POOLS.has(key)) STAR_RATING_POOLS.set(key, STAR_XI_PLAYERS.filter((player) => player.rating >= odds.minRating && player.rating <= odds.maxRating));
  }
}

export const CUP_STRATEGIES = [
  { id: "angriff", label: "Offensivpressing", description: "Stark gegen Ballbesitz, anfällig für Konter", strongAgainst: "ballbesitz", weakAgainst: "konter" },
  { id: "konter", label: "Schneller Konter", description: "Stark gegen Pressing, anfällig für Ballbesitz", strongAgainst: "angriff", weakAgainst: "ballbesitz" },
  { id: "ballbesitz", label: "Ballbesitz", description: "Stark gegen Konter, anfällig für Pressing", strongAgainst: "konter", weakAgainst: "angriff" },
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function getStarXIPlayer(id: string) {
  return STAR_XI_PLAYER_BY_ID.get(id);
}

function uniqueKnownStarIds(ids: unknown) {
  return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && STAR_XI_PLAYER_BY_ID.has(id)))] : [];
}

export function getStarXIPositions(player: StarXIPlayer) {
  return player.positions.length ? player.positions : [player.position];
}

export function canStarXIPlayerPlayPosition(player: StarXIPlayer | undefined, position: StarPosition) {
  return Boolean(player && getStarXIPositions(player).includes(position));
}

export function canStarXIPlayerFillSlot(playerId: string, lineupIndex: number, formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS) {
  const requiredPosition = formationPositions[lineupIndex] ?? STAR_XI_FORMATION_POSITIONS[lineupIndex];
  return Boolean(requiredPosition && canStarXIPlayerPlayPosition(getStarXIPlayer(playerId), requiredPosition));
}

function normalizeFormationPositions(value: unknown) {
  const requested = Array.isArray(value) ? value : [];
  return Array.from({ length: STAR_XI_SQUAD_SIZE }, (_, index) => {
    const position = requested[index];
    return typeof position === "string" && STAR_POSITIONS.includes(position as StarPosition)
      ? position as StarPosition
      : STAR_XI_FORMATION_POSITIONS[index];
  });
}

function normalizeLineupSlots(ownedIds: string[], rawLineupIds: unknown, formationPositions: readonly StarPosition[]) {
  const lineupIds = Array.from({ length: STAR_XI_SQUAD_SIZE }, () => "");
  const requested = Array.isArray(rawLineupIds) ? rawLineupIds : [];
  const used = new Set<string>();
  const displaced: string[] = [];

  for (let index = 0; index < STAR_XI_SQUAD_SIZE; index += 1) {
    const rawId = requested[index];
    const id = typeof rawId === "string" && ownedIds.includes(rawId) ? rawId : "";
    if (!id || used.has(id)) continue;
    if (canStarXIPlayerFillSlot(id, index, formationPositions)) {
      lineupIds[index] = id;
      used.add(id);
    } else {
      displaced.push(id);
    }
  }

  const candidates = [...displaced, ...ownedIds.filter((id) => !used.has(id) && !displaced.includes(id))];
  for (const id of candidates) {
    const openIndex = lineupIds.findIndex((current, index) => !current && canStarXIPlayerFillSlot(id, index, formationPositions));
    if (openIndex < 0) continue;
    lineupIds[openIndex] = id;
    used.add(id);
  }
  return lineupIds;
}

function normalizeBenchSlots(ownedIds: string[], lineupIds: string[], rawBenchIds: unknown) {
  const benchIds = Array.from({ length: STAR_XI_BENCH_SIZE }, () => "");
  const requested = Array.isArray(rawBenchIds) ? rawBenchIds : [];
  const used = new Set(lineupIds.filter(Boolean));
  for (let index = 0; index < STAR_XI_BENCH_SIZE; index += 1) {
    const rawId = requested[index];
    const id = typeof rawId === "string" && ownedIds.includes(rawId) ? rawId : "";
    if (!id || used.has(id)) continue;
    benchIds[index] = id;
    used.add(id);
  }
  for (const id of ownedIds) {
    if (used.has(id)) continue;
    const openIndex = benchIds.findIndex((current) => !current);
    if (openIndex < 0) break;
    benchIds[openIndex] = id;
    used.add(id);
  }
  return benchIds;
}

export function normalizeStarXIState(value: unknown): StarXIState {
  const source = asRecord(value);
  const ownedIds = uniqueKnownStarIds(source.ownedIds);
  const requestedPositions = normalizeFormationPositions(source.formationPositions);
  const formation = STAR_FORMATIONS.find((item) => item.id === source.formationId)
    ?? STAR_FORMATIONS.find((item) => item.slots.every((slot, index) => slot.position === requestedPositions[index]))
    ?? getStarFormation("433");
  const formationPositions = formation.slots.map((slot) => slot.position);
  const lineupIds = normalizeLineupSlots(ownedIds, source.lineupIds, formationPositions);
  const benchIds = normalizeBenchSlots(ownedIds, lineupIds, source.benchIds);
  return { ownedIds, lineupIds, benchIds, formationId: formation.id, formationPositions };
}

export function addStarXIPlayer(state: StarXIState, playerId: string) {
  const next = normalizeStarXIState(state);
  if (!getStarXIPlayer(playerId) || next.ownedIds.includes(playerId)) return next;
  next.ownedIds = [...next.ownedIds, playerId];
  const openLineupIndex = next.lineupIds.findIndex((id, index) => !id && canStarXIPlayerFillSlot(playerId, index, next.formationPositions));
  if (openLineupIndex >= 0) next.lineupIds[openLineupIndex] = playerId;
  else {
    const openBenchIndex = next.benchIds.findIndex((id) => !id);
    if (openBenchIndex >= 0) next.benchIds[openBenchIndex] = playerId;
  }
  return next;
}

export function setStarXIStarter(state: StarXIState, lineupIndex: number, playerId: string) {
  const next = normalizeStarXIState(state);
  if (!Number.isInteger(lineupIndex) || lineupIndex < 0 || lineupIndex >= STAR_XI_SQUAD_SIZE || !next.ownedIds.includes(playerId) || !canStarXIPlayerFillSlot(playerId, lineupIndex, next.formationPositions)) return next;
  const lineupIds = [...next.lineupIds];
  const currentPlayerId = lineupIds[lineupIndex];
  const otherLineupIndex = lineupIds.indexOf(playerId);
  if (otherLineupIndex >= 0) {
    if (currentPlayerId && !canStarXIPlayerFillSlot(currentPlayerId, otherLineupIndex, next.formationPositions)) return next;
    lineupIds[otherLineupIndex] = currentPlayerId;
    lineupIds[lineupIndex] = playerId;
  } else {
    lineupIds[lineupIndex] = playerId;
    const benchIndex = next.benchIds.indexOf(playerId);
    if (benchIndex >= 0) {
      if (currentPlayerId) next.benchIds[benchIndex] = currentPlayerId;
      else next.benchIds = next.benchIds.filter((id) => id !== playerId);
    }
  }
  next.lineupIds = lineupIds;
  return normalizeStarXIState(next);
}

export function setStarXIFormation(state: StarXIState, formationId: StarFormationId) {
  const next = normalizeStarXIState(state);
  const formation = STAR_FORMATIONS.find((item) => item.id === formationId);
  if (!formation || formation.id === next.formationId) return next;
  const formationPositions = formation.slots.map((slot) => slot.position);
  const lineupIds = normalizeLineupSlots(next.ownedIds, next.lineupIds, formationPositions);
  const benchIds = normalizeBenchSlots(next.ownedIds, lineupIds, next.benchIds);
  return { ...next, formationId: formation.id, formationPositions, lineupIds, benchIds };
}

export function setStarXIBenchPlayer(state: StarXIState, benchIndex: number, playerId: string) {
  const next = normalizeStarXIState(state);
  if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= STAR_XI_BENCH_SIZE || !next.ownedIds.includes(playerId) || next.lineupIds.includes(playerId)) return next;
  const currentPlayerId = next.benchIds[benchIndex];
  const otherBenchIndex = next.benchIds.indexOf(playerId);
  if (otherBenchIndex >= 0) next.benchIds[otherBenchIndex] = currentPlayerId;
  next.benchIds[benchIndex] = playerId;
  return normalizeStarXIState(next);
}

export function restoreStarXIAfterMatch(state: StarXIState, cup: CupState) {
  const next = normalizeStarXIState(state);
  if (cup.originalLineupIds.length !== STAR_XI_SQUAD_SIZE) return next;
  return normalizeStarXIState({
    ...next,
    lineupIds: [...cup.originalLineupIds],
    benchIds: cup.originalBenchIds.length === STAR_XI_BENCH_SIZE ? [...cup.originalBenchIds] : next.benchIds,
  });
}

export function getStarXISelection(ownedIds: string[], lineupIds: string[] = []) {
  const selectedIds = lineupIds.some(Boolean) ? lineupIds : ownedIds;
  const selected = selectedIds.map((id) => getStarXIPlayer(id)).filter((player): player is StarXIPlayer => Boolean(player));
  return lineupIds.some(Boolean) ? selected.slice(0, STAR_XI_SQUAD_SIZE) : selected.sort((first, second) => second.rating - first.rating || first.id.localeCompare(second.id)).slice(0, STAR_XI_SQUAD_SIZE);
}

export function getStarXIRating(ownedIds: string[], lineupIds: string[] = []) {
  const starters = getStarXISelection(ownedIds, lineupIds);
  const missing = STAR_XI_SQUAD_SIZE - starters.length;
  return Math.round((starters.reduce((total, player) => total + player.rating, 0) + missing * 55) / STAR_XI_SQUAD_SIZE);
}

function getMatchSeed(playerId: string, matchStartedAt: number, salt: number) {
  const source = `${playerId}:${Math.floor(matchStartedAt / 1000)}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function getStarXIPlayerMatchRating(playerId: string, matchStartedAt: number, minute: number, goals = 0, enteredAtMinute = 1, performanceImpact = 0, position?: StarPosition) {
  const dayForm = (getMatchSeed(playerId, matchStartedAt, 1) + getMatchSeed(playerId, matchStartedAt, 2) + getMatchSeed(playerId, matchStartedAt, 3)) / 3;
  const targetRating = 5.7 + dayForm * 2.2;
  const openingRating = 6.35 + (getMatchSeed(playerId, matchStartedAt, 4) - 0.5) * 0.45;
  const playedMinutes = Math.max(0, minute - enteredAtMinute + 1);
  const progress = clamp(playedMinutes / 75, 0, 1);
  const revealCurve = 0.12 + 0.88 * (1 - (1 - progress) ** 1.15);
  const gentleDrift = (getMatchSeed(playerId, matchStartedAt, 5) - 0.5) * 0.2 * Math.sin(progress * Math.PI);
  const goalBoost = Math.min(1.8, Math.max(0, goals) * 0.6);
  const roleStability = position === "TW" || position === "IV" ? 0.04 : 0;
  return Math.round(clamp(openingRating + (targetRating - openingRating) * revealCurve + gentleDrift + goalBoost + performanceImpact + roleStability, 4.5, 10) * 10) / 10;
}

export function getCupPlayerMatchRating(cup: CupState, playerId: string, minute: number) {
  const enteredAtMinute = cup.playerEnteredAt[playerId];
  if (!enteredAtMinute || minute < enteredAtMinute) return null;
  const effectiveMinute = Math.max(enteredAtMinute, Math.min(minute, cup.playerExitedAt[playerId] ?? minute));
  const position = cup.playerMatchPositions[playerId] ?? getStarXIPlayer(playerId)?.position;
  const eventImpact = cup.matchEvents.reduce((total, event) => {
    if (event.minute < enteredAtMinute || event.minute > effectiveMinute) return total;
    return total + (event.ratingImpacts[playerId] ?? 0);
  }, 0);
  const concededWhilePlaying = cup.matchEvents.filter((event) => event.side === "away" && event.minute >= enteredAtMinute && event.minute <= effectiveMinute).length;
  const playedProgress = clamp((effectiveMinute - enteredAtMinute + 1) / 90, 0, 1);
  const cleanSheetBoost = concededWhilePlaying === 0
    ? playedProgress * (position === "TW" ? 0.42 : position === "IV" || position === "LV" || position === "LAV" || position === "RV" || position === "RAV" ? 0.3 : position === "ZDM" ? 0.14 : 0)
    : 0;
  return getStarXIPlayerMatchRating(playerId, cup.matchStartedAt, effectiveMinute, 0, enteredAtMinute, eventImpact + cleanSheetBoost, position);
}

export function getStarXIEffectiveMatchRating(ownedIds: string[], lineupIds: string[], cup: CupState, minute: number) {
  const starters = getStarXISelection(ownedIds, lineupIds);
  if (!starters.length) return 55;
  const missing = STAR_XI_SQUAD_SIZE - starters.length;
  const effectiveTotal = starters.reduce((total, player) => {
    const liveForm = getCupPlayerMatchRating(cup, player.id, minute) ?? 6.4;
    return total + player.rating + (liveForm - 6.5) * 2.8;
  }, missing * 55);
  return clamp(Math.round((effectiveTotal / STAR_XI_SQUAD_SIZE) * 10) / 10, 40, 100);
}

export function getStarPack(id: string) {
  return STAR_PACKS.find((pack) => pack.id === id);
}

export function getTournament(id: string) {
  return TOURNAMENTS.find((tournament) => tournament.id === id);
}

export function getTournamentGoalBoostMultiplier(tournamentId: TournamentId) {
  return TOURNAMENT_GOAL_BOOST_MULTIPLIERS[tournamentId] ?? 1;
}

export function startTournamentGoalBoost(tournamentId: TournamentId, now = Date.now()): GoalBoostState {
  const startedAt = Math.max(0, Math.floor(Number(now) || 0));
  return {
    tournamentId,
    multiplier: getTournamentGoalBoostMultiplier(tournamentId),
    startedAt,
    endsAt: startedAt + TOURNAMENT_GOAL_BOOST_DURATION_MS,
  };
}

function readGoalBoost(value: GameFeatures | GoalBoostState | undefined) {
  if (!value) return null;
  return "goalBoost" in value ? value.goalBoost : value;
}

export function getGoalBoostMultiplier(value: GameFeatures | GoalBoostState | undefined, now = Date.now()) {
  const boost = readGoalBoost(value);
  if (!boost || !boost.tournamentId || boost.startedAt > now || boost.endsAt <= now) return 1;
  return getTournamentGoalBoostMultiplier(boost.tournamentId);
}

export function getGoalBoostedPassiveReward(basePower: number, value: GameFeatures | GoalBoostState | undefined, from: number, to: number) {
  const safePower = Math.max(0, Number(basePower) || 0);
  const intervalStart = Math.min(from, to);
  const intervalEnd = Math.max(from, to);
  const durationMs = Math.max(0, intervalEnd - intervalStart);
  const boost = readGoalBoost(value);
  if (!boost || !boost.tournamentId || durationMs <= 0) return safePower * durationMs / 1000;
  const activeStart = Math.max(intervalStart, boost.startedAt);
  const activeEnd = Math.min(intervalEnd, boost.endsAt);
  const boostedMs = Math.max(0, activeEnd - activeStart);
  const multiplier = getTournamentGoalBoostMultiplier(boost.tournamentId);
  return safePower * (durationMs + boostedMs * (multiplier - 1)) / 1000;
}

export function getCupStrategy(id: string) {
  return CUP_STRATEGIES.find((strategy) => strategy.id === id) ?? CUP_STRATEGIES[1];
}

export function getCupTacticalMatchup(strategyId: CupStrategyId, opponentStrategyId: CupStrategyId) {
  if (strategyId === opponentStrategyId) return { score: 50, label: "Neutral", tone: "neutral" as const };
  const strategy = getCupStrategy(strategyId);
  if (strategy.strongAgainst === opponentStrategyId) return { score: 72, label: "Taktischer Vorteil", tone: "positive" as const };
  return { score: 28, label: "Taktischer Nachteil", tone: "negative" as const };
}

export function getCupMatchStrength(cup: CupState, starRating: number) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const opponent = tournament.opponents[cup.round] ?? tournament.opponents[tournament.opponents.length - 1];
  const opponentRating = cup.opponentRating || opponent.rating;
  const opponentStrategyId = cup.opponentStrategyId || opponent.strategyId;
  const tactical = getCupTacticalMatchup(cup.strategyId, opponentStrategyId);
  const teamStrength = 0.7 * clamp(starRating, 40, 100) + 0.3 * tactical.score;
  const opponentStrength = 0.7 * opponentRating + 0.3 * (100 - tactical.score);
  return {
    teamStrength: Math.round(teamStrength * 10) / 10,
    opponentStrength: Math.round(opponentStrength * 10) / 10,
    opponentRating,
    opponentStrategyId,
    tactical,
  };
}

export function openStarPack(packId: StarPackId, ownedIds: string[], random = Math.random): StarPackOpening {
  const pack = getStarPack(packId) ?? STAR_PACKS[0];
  const roll = Math.max(0, Math.min(0.999999, random()));
  let cursor = 0;
  const odds = pack.odds.find((entry) => {
    cursor += entry.chance;
    return roll <= cursor;
  }) ?? pack.odds[pack.odds.length - 1];
  const candidates = STAR_RATING_POOLS.get(`${odds.minRating}-${odds.maxRating}`) ?? STAR_XI_PLAYERS;
  const ownedIdSet = new Set(ownedIds);
  const ownedCandidates = candidates.filter((player) => ownedIdSet.has(player.id));
  const unownedCandidates = candidates.filter((player) => !ownedIdSet.has(player.id));
  const duplicateRoll = Math.max(0, Math.min(0.999999, random()));
  const ownershipPool = duplicateRoll < 0.05 && ownedCandidates.length ? ownedCandidates : unownedCandidates.length ? unownedCandidates : candidates;
  const positionRoll = Math.max(0, Math.min(0.999999, random()));
  let positionCursor = 0;
  const positionGroup = PACK_POSITION_GROUPS.find((group) => {
    positionCursor += group.chance;
    return positionRoll < positionCursor;
  }) ?? PACK_POSITION_GROUPS[PACK_POSITION_GROUPS.length - 1];
  const positionCandidates = ownershipPool.filter((player) => positionGroup.positions.some((position) => position === player.position));
  const selectionPool = positionCandidates.length ? positionCandidates : ownershipPool;
  const totalWeight = selectionPool.reduce((sum, candidate) => sum + Math.max(0.0001, candidate.packWeight ?? 1), 0);
  let weightedRoll = Math.max(0, Math.min(0.999999, random())) * totalWeight;
  const player = selectionPool.find((candidate) => {
    weightedRoll -= Math.max(0.0001, candidate.packWeight ?? 1);
    return weightedRoll <= 0;
  }) ?? selectionPool[selectionPool.length - 1] ?? STAR_XI_PLAYERS[0];
  const duplicate = ownedIdSet.has(player.id);
  return { packId: pack.id, packName: pack.label, player, duplicate, compensation: duplicate ? Math.floor(pack.price * 0.35) : 0 };
}

function startTournamentRound(cup: CupState, tournament: TournamentDefinition, round: number, now: number, resetStrategy = false, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS): CupState {
  const opponent = tournament.opponents[round] ?? tournament.opponents[tournament.opponents.length - 1];
  const playerEnteredAt = Object.fromEntries(homePlayers.map((player) => [player.id, 1]));
  const playerMatchPositions = Object.fromEntries(homePlayers.map((player, index) => [player.id, formationPositions[index] ?? player.position])) as Record<string, StarPosition>;
  return {
    ...cup,
    tournamentId: tournament.id,
    round,
    active: true,
    phase: "regular",
    matchStartedAt: now,
    matchEndsAt: now + CUP_MATCH_DURATION_MS,
    lastTickAt: now,
    homeScore: 0,
    awayScore: 0,
    opponent: opponent.name,
    opponentRating: opponent.rating,
    opponentStrategyId: opponent.strategyId,
    strategyId: resetStrategy ? "konter" : cup.strategyId,
    substitutionsUsed: 0,
    playerEnteredAt,
    playerExitedAt: {},
    playerMatchPositions,
    lastGoal: null,
    matchEvents: [],
    penaltyHomeScore: 0,
    penaltyAwayScore: 0,
    penaltyHomeTaken: 0,
    penaltyAwayTaken: 0,
    penaltyTurn: "home",
    penaltyEvents: [],
    penaltyMessage: "",
    lastResult: `Runde ${round + 1} von ${tournament.opponents.length} gegen ${opponent.name} beginnt.`,
  };
}

export function beginCupMatch(cup: CupState, now = Date.now(), tournamentId = cup.tournamentId, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, originalLineupIds: readonly string[] = homePlayers.map((player) => player.id), originalBenchIds: readonly string[] = []): CupState {
  const tournament = getTournament(tournamentId) ?? TOURNAMENTS[0];
  return startTournamentRound({ ...cup, round: 0, originalLineupIds: [...originalLineupIds], originalBenchIds: [...originalBenchIds] }, tournament, 0, now, true, homePlayers, formationPositions);
}

const GOAL_POSITION_WEIGHTS: Record<StarPosition, number> = {
  TW: 0.06,
  LV: 0.45,
  LAV: 0.55,
  IV: 0.34,
  RV: 0.45,
  RAV: 0.55,
  ZDM: 0.65,
  ZM: 1.25,
  ZOM: 2,
  LM: 1.9,
  RM: 1.9,
  LF: 3.2,
  RF: 3.2,
  MS: 4,
  ST: 4.8,
};

const ASSIST_POSITION_WEIGHTS: Record<StarPosition, number> = {
  TW: 0.02,
  LV: 0.65,
  LAV: 0.9,
  IV: 0.22,
  RV: 0.65,
  RAV: 0.9,
  ZDM: 0.85,
  ZM: 1.8,
  ZOM: 2.8,
  LM: 2.35,
  RM: 2.35,
  LF: 1.85,
  RF: 1.85,
  MS: 1.55,
  ST: 1.2,
};

const DEFENSIVE_FAULT_WEIGHTS: Record<StarPosition, number> = {
  TW: 1.8,
  LV: 1.45,
  LAV: 1.35,
  IV: 2.55,
  RV: 1.45,
  RAV: 1.35,
  ZDM: 1.05,
  ZM: 0.55,
  ZOM: 0.24,
  LM: 0.38,
  RM: 0.38,
  LF: 0.12,
  RF: 0.12,
  MS: 0.1,
  ST: 0.08,
};

function selectWeightedPlayer(candidates: { player: StarXIPlayer; weight: number }[], random: () => number) {
  const totalWeight = candidates.reduce((total, candidate) => total + Math.max(0, candidate.weight), 0);
  let cursor = clamp(random(), 0, 0.999999) * totalWeight;
  for (const candidate of candidates) {
    cursor -= Math.max(0, candidate.weight);
    if (cursor <= 0) return candidate.player;
  }
  return candidates[candidates.length - 1]?.player;
}

function selectHomeScorer(homePlayers: readonly StarXIPlayer[], cup: CupState, minute: number, random: () => number, formationPositions: readonly StarPosition[], matchEvents: readonly CupGoalEvent[]) {
  if (!homePlayers.length) return undefined;
  const liveCup = { ...cup, matchEvents };
  const candidates = homePlayers.map((player, index) => {
    const position = formationPositions[index] ?? STAR_XI_FORMATION_POSITIONS[index] ?? player.position;
    const skill = 0.4 + ((clamp(player.rating, 67, 100) - 67) / 33) ** 1.7 * 1.6;
    const form = clamp(0.55 + ((getCupPlayerMatchRating(liveCup, player.id, minute) ?? 6.4) - 5) * 0.25, 0.55, 1.7);
    return { player, weight: GOAL_POSITION_WEIGHTS[position] * skill * form };
  });
  return selectWeightedPlayer(candidates, random);
}

function selectHomeAssist(homePlayers: readonly StarXIPlayer[], scorerId: string | undefined, formationPositions: readonly StarPosition[], random: () => number) {
  const candidates = homePlayers.filter((player) => player.id !== scorerId).map((player) => {
    const index = homePlayers.findIndex((candidate) => candidate.id === player.id);
    const position = formationPositions[index] ?? player.position;
    return { player, weight: ASSIST_POSITION_WEIGHTS[position] * (0.7 + player.rating / 100) };
  });
  return selectWeightedPlayer(candidates, random);
}

function getConcededGoalRatingImpacts(homePlayers: readonly StarXIPlayer[], formationPositions: readonly StarPosition[], random: () => number) {
  const candidates = homePlayers.map((player, index) => {
    const position = formationPositions[index] ?? player.position;
    const errorRisk = 1 + (100 - clamp(player.rating, 67, 100)) / 55;
    return { player, weight: DEFENSIVE_FAULT_WEIGHTS[position] * errorRisk };
  });
  const mainCulprit = selectWeightedPlayer(candidates, random);
  if (!mainCulprit) return {};
  const impacts: Record<string, number> = { [mainCulprit.id]: -(0.55 + clamp(random(), 0, 0.999999) * 0.35) };
  if (random() < 0.34) {
    const secondary = selectWeightedPlayer(candidates.filter((candidate) => candidate.player.id !== mainCulprit.id), random);
    if (secondary) impacts[secondary.id] = -(0.2 + clamp(random(), 0, 0.999999) * 0.22);
  }
  return impacts;
}

function getCupBaseResult(cup: CupState, starRating: number) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const strength = getCupMatchStrength(cup, starRating);
  return {
    finished: false,
    won: false,
    opponent: cup.opponent,
    tieBreak: false,
    tournamentWon: false,
    runEnded: false,
    nextRoundStarted: false,
    completedRound: cup.round + 1,
    totalRounds: tournament.opponents.length,
    teamStrength: strength.teamStrength,
    opponentStrength: strength.opponentStrength,
    tacticalOutcome: strength.tactical.label,
  };
}

function finishCupRound(cup: CupState, starRating: number, won: boolean, now: number, tieBreak: boolean, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const baseResult = getCupBaseResult(cup, starRating);
  const round = cup.round;
  const completedRound = round + 1;
  const tournamentWon = won && completedRound >= tournament.opponents.length;
  const decisionLabel = tieBreak ? " im Elfmeterschiessen" : cup.phase === "extra-time" ? " nach Verlängerung" : "";
  const nextCup: CupState = {
    ...cup,
    wins: cup.wins + (won ? 1 : 0),
    best: Math.max(cup.best, won ? completedRound : round),
  };

  if (won && !tournamentWon) {
    const restoredHomePlayers = cup.originalLineupIds.map((playerId) => getStarXIPlayer(playerId)).filter((player): player is StarXIPlayer => Boolean(player));
    const nextRoundCup = startTournamentRound(nextCup, tournament, round + 1, now, false, restoredHomePlayers.length === STAR_XI_SQUAD_SIZE ? restoredHomePlayers : homePlayers, formationPositions);
    nextRoundCup.lastResult = `Runde ${completedRound}${decisionLabel} gewonnen. Runde ${completedRound + 1} startet sofort.`;
    return { cup: nextRoundCup, ...baseResult, finished: true, won: true, tieBreak, nextRoundStarted: true, completedRound };
  }

  nextCup.active = false;
  nextCup.round = 0;
  if (tournamentWon) nextCup.trophies = { ...nextCup.trophies, [tournament.id]: nextCup.trophies[tournament.id] + 1 };
  nextCup.lastResult = tournamentWon
    ? `${tournament.trophyName}${decisionLabel} gewonnen! Der temporäre Goalboost ist aktiv.`
    : `Turnieraus in Runde ${completedRound} gegen ${cup.opponent}${decisionLabel}.`;
  return { cup: nextCup, ...baseResult, finished: true, won, tieBreak, tournamentWon, runEnded: true, completedRound };
}

export function advanceCupMatch(cup: CupState, starRating: number, now = Date.now(), random = Math.random, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const opponent = tournament.opponents[cup.round] ?? tournament.opponents[tournament.opponents.length - 1];
  const strength = getCupMatchStrength(cup, starRating);
  const baseResult = getCupBaseResult(cup, starRating);
  if (!cup.active) return { cup, ...baseResult };
  if (cup.phase === "penalties") return { cup, ...baseResult };
  const endAt = Math.max(cup.matchStartedAt, Math.min(now, cup.matchEndsAt));
  const from = Math.max(cup.matchStartedAt, Math.min(cup.lastTickAt || cup.matchStartedAt, endAt));
  const phaseSeconds = cup.phase === "extra-time" ? CUP_EXTRA_TIME_DURATION_MS / 1000 : CUP_MATCH_DURATION_MS / 1000;
  const seconds = Math.min(phaseSeconds, Math.max(0, Math.floor((endAt - from) / 1000)));
  let homeScore = cup.homeScore;
  let awayScore = cup.awayScore;
  let lastGoal = cup.lastGoal;
  let matchEvents = [...cup.matchEvents];
  const allTimeScorers = { ...cup.allTimeScorers };
  const strengthDifference = strength.teamStrength - strength.opponentStrength;
  const homeExpectedGoals = clamp(0.55 + strength.teamStrength * 0.014 + strengthDifference * 0.07, 0.15, 5.2);
  const awayExpectedGoals = clamp(0.55 + strength.opponentStrength * 0.014 - strengthDifference * 0.07, 0.15, 5.2);
  const homeChance = homeExpectedGoals / 180;
  const awayChance = awayExpectedGoals / 180;
  for (let second = 0; second < seconds; second += 1) {
    const roll = random();
    const goalAt = from + (second + 1) * 1000;
    const minute = Math.min(120, Math.max(1, Math.floor((goalAt - cup.matchStartedAt) / 2000) + 1));
    if (roll < homeChance) {
      homeScore += 1;
      const scorer = selectHomeScorer(homePlayers, cup, minute, random, formationPositions, matchEvents);
      const assist = selectHomeAssist(homePlayers, scorer?.id, formationPositions, random);
      const ratingImpacts: Record<string, number> = {};
      if (scorer) ratingImpacts[scorer.id] = 0.7;
      if (assist) ratingImpacts[assist.id] = (ratingImpacts[assist.id] ?? 0) + 0.25;
      lastGoal = { id: `${goalAt}-${homeScore}-${awayScore}-home`, side: "home", scorerId: scorer?.id ?? null, scorer: scorer?.name ?? "Dein Club", minute, createdAt: goalAt, homeScore, awayScore, ratingImpacts };
      matchEvents = [...matchEvents, lastGoal].slice(-40);
      if (scorer) allTimeScorers[scorer.id] = (allTimeScorers[scorer.id] ?? 0) + 1;
    } else if (roll < homeChance + awayChance) {
      awayScore += 1;
      const opponentScorers = opponent.scorers.length ? opponent.scorers : [cup.opponent];
      const scorer = opponentScorers[Math.floor(Math.max(0, Math.min(0.999999, random())) * opponentScorers.length)] ?? cup.opponent;
      const ratingImpacts = getConcededGoalRatingImpacts(homePlayers, formationPositions, random);
      lastGoal = { id: `${goalAt}-${homeScore}-${awayScore}-away`, side: "away", scorerId: null, scorer, minute, createdAt: goalAt, homeScore, awayScore, ratingImpacts };
      matchEvents = [...matchEvents, lastGoal].slice(-40);
    }
  }
  const nextCup = { ...cup, homeScore, awayScore, lastTickAt: endAt, lastGoal, matchEvents, allTimeScorers };
  if (now < cup.matchEndsAt) return { cup: nextCup, ...baseResult };
  if (homeScore !== awayScore) return finishCupRound(nextCup, starRating, homeScore > awayScore, now, false, homePlayers, formationPositions);

  if (cup.phase === "regular") {
    return {
      cup: {
        ...nextCup,
        phase: "extra-time" as const,
        matchEndsAt: cup.matchEndsAt + CUP_EXTRA_TIME_DURATION_MS,
        lastResult: "90 Minuten vorbei. Es geht bis 120′ in die Verlängerung.",
      },
      ...baseResult,
    };
  }

  return {
    cup: {
      ...nextCup,
      phase: "penalties" as const,
      penaltyHomeScore: 0,
      penaltyAwayScore: 0,
      penaltyHomeTaken: 0,
      penaltyAwayTaken: 0,
      penaltyTurn: "home" as const,
      penaltyEvents: [],
      penaltyMessage: "Nach 120′ steht es unentschieden. Du beginnst am Punkt.",
      lastResult: "Elfmeterschiessen. Wähle für jeden Versuch selbst eine Richtung.",
    },
    ...baseResult,
  };
}

const PENALTY_DIRECTIONS: readonly PenaltyDirection[] = ["left", "center", "right"];

function getPenaltyDirectionLabel(direction: PenaltyDirection) {
  if (direction === "left") return "nach links";
  if (direction === "right") return "nach rechts";
  return "in die Mitte";
}

function getHomePenaltyTaker(homePlayers: readonly StarXIPlayer[], formationPositions: readonly StarPosition[], attempt: number) {
  const ordered = homePlayers.map((player, index) => ({
    player,
    score: player.rating * 10 + (GOAL_POSITION_WEIGHTS[formationPositions[index] ?? player.position] ?? 1),
  })).sort((first, second) => second.score - first.score || first.player.name.localeCompare(second.player.name));
  return ordered[attempt % Math.max(1, ordered.length)]?.player;
}

function getPenaltyWinner(homeScore: number, awayScore: number, homeTaken: number, awayTaken: number): boolean | null {
  const homeRemaining = Math.max(0, 5 - homeTaken);
  const awayRemaining = Math.max(0, 5 - awayTaken);
  if (homeScore > awayScore + awayRemaining) return true;
  if (awayScore > homeScore + homeRemaining) return false;
  if (homeTaken >= 5 && awayTaken >= 5 && homeTaken === awayTaken && homeScore !== awayScore) return homeScore > awayScore;
  return null;
}

export function resolveCupPenalty(cup: CupState, starRating: number, direction: PenaltyDirection, now = Date.now(), random = Math.random, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS) {
  const baseResult = getCupBaseResult(cup, starRating);
  if (!cup.active || cup.phase !== "penalties" || !PENALTY_DIRECTIONS.includes(direction)) return { cup, ...baseResult };
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const opponent = tournament.opponents[cup.round] ?? tournament.opponents[tournament.opponents.length - 1];
  let penaltyHomeScore = cup.penaltyHomeScore;
  let penaltyAwayScore = cup.penaltyAwayScore;
  let penaltyHomeTaken = cup.penaltyHomeTaken;
  let penaltyAwayTaken = cup.penaltyAwayTaken;
  let event: CupPenaltyEvent;
  let penaltyMessage = cup.penaltyMessage;

  if (cup.penaltyTurn === "home") {
    const player = getHomePenaltyTaker(homePlayers, formationPositions, penaltyHomeTaken);
    const keeperDirection = PENALTY_DIRECTIONS[Math.floor(clamp(random(), 0, 0.999999) * PENALTY_DIRECTIONS.length)] ?? "center";
    const sameDirection = direction === keeperDirection;
    const shooterRating = player?.rating ?? starRating;
    const shooterSkill = clamp((shooterRating - 67) / 33, 0, 1);
    const goalChance = sameDirection ? clamp(0.32 + shooterSkill * 0.25, 0.32, 0.6) : clamp(0.8 + shooterSkill * 0.16, 0.8, 0.96);
    const scored = random() < goalChance;
    const outcome: CupPenaltyEvent["outcome"] = scored ? "goal" : sameDirection && random() < 0.9 ? "save" : "miss";
    penaltyHomeTaken += 1;
    if (scored) penaltyHomeScore += 1;
    const playerName = player?.name ?? "Dein Schütze";
    penaltyMessage = scored
      ? `TOR! ${playerName} verwandelt ${getPenaltyDirectionLabel(direction)}.`
      : outcome === "save"
        ? `${playerName} scheitert. Der Keeper ist in der richtigen Ecke.`
        : `${playerName} setzt den Ball neben das Tor.`;
    event = { id: `${now}-${penaltyHomeTaken}-${penaltyAwayTaken}-home`, side: "home", playerId: player?.id ?? null, player: playerName, direction, keeperDirection, outcome, createdAt: now, homeScore: penaltyHomeScore, awayScore: penaltyAwayScore, homeTaken: penaltyHomeTaken, awayTaken: penaltyAwayTaken };
  } else {
    const shotDirection = PENALTY_DIRECTIONS[Math.floor(clamp(random(), 0, 0.999999) * PENALTY_DIRECTIONS.length)] ?? "center";
    const goalkeeperIndex = formationPositions.findIndex((position) => position === "TW");
    const goalkeeper = homePlayers[goalkeeperIndex] ?? homePlayers.find((player) => player.positions.includes("TW"));
    const opponentScorers = opponent.scorers.length ? opponent.scorers : [cup.opponent];
    const playerName = opponentScorers[penaltyAwayTaken % opponentScorers.length] ?? cup.opponent;
    const sameDirection = shotDirection === direction;
    const opponentSkill = clamp((cup.opponentRating - 55) / 44, 0, 1);
    const keeperSkill = clamp(((goalkeeper?.rating ?? starRating) - 67) / 33, 0, 1);
    const goalChance = sameDirection ? clamp(0.54 - keeperSkill * 0.28 + opponentSkill * 0.12, 0.16, 0.62) : clamp(0.79 + opponentSkill * 0.16 - keeperSkill * 0.05, 0.7, 0.96);
    const scored = random() < goalChance;
    const outcome: CupPenaltyEvent["outcome"] = scored ? "goal" : sameDirection && random() < 0.92 ? "save" : "miss";
    penaltyAwayTaken += 1;
    if (scored) penaltyAwayScore += 1;
    penaltyMessage = scored
      ? `${playerName} trifft ${getPenaltyDirectionLabel(shotDirection)}. Dein Torwart war ${getPenaltyDirectionLabel(direction)}.`
      : outcome === "save"
        ? `${goalkeeper?.name ?? "Dein Torwart"} hält! Du hast die richtige Ecke gewählt.`
        : `${playerName} verschiesst.`;
    event = { id: `${now}-${penaltyHomeTaken}-${penaltyAwayTaken}-away`, side: "away", playerId: null, player: playerName, direction: shotDirection, keeperDirection: direction, outcome, createdAt: now, homeScore: penaltyHomeScore, awayScore: penaltyAwayScore, homeTaken: penaltyHomeTaken, awayTaken: penaltyAwayTaken };
  }

  const nextCup: CupState = {
    ...cup,
    penaltyHomeScore,
    penaltyAwayScore,
    penaltyHomeTaken,
    penaltyAwayTaken,
    penaltyTurn: cup.penaltyTurn === "home" ? "away" : "home",
    penaltyEvents: [...cup.penaltyEvents, event],
    penaltyMessage,
  };
  const winner = getPenaltyWinner(penaltyHomeScore, penaltyAwayScore, penaltyHomeTaken, penaltyAwayTaken);
  if (winner === null) return { cup: nextCup, ...baseResult };
  nextCup.penaltyMessage = winner ? `${penaltyMessage} Das Elfmeterschiessen ist gewonnen.` : `${penaltyMessage} Das Elfmeterschiessen ist verloren.`;
  return finishCupRound(nextCup, starRating, winner, now, true, homePlayers, formationPositions);
}

const MISSION_TEMPLATES: Omit<CoopMission, "claimed">[] = [
  { id: "team-goals", title: "Druckphase", description: "Sammelt gemeinsam Tore in dieser Saison", kind: "goals", target: 2500, reward: 2500 },
  { id: "team-clicks", title: "Doppelpass", description: "Klickt gemeinsam 250 Mal", kind: "clicks", target: 250, reward: 1800 },
  { id: "team-tournament", title: "Turnierstarter", description: "Gewinnt zwei Turnierrunden", kind: "cupWins", target: 2, reward: 3000 },
  { id: "team-cup", title: "Pokalhungrig", description: "Gewinnt eine Pokalrunde", kind: "cupWins", target: 1, reward: 4500 },
];

export function initialMissions() {
  return MISSION_TEMPLATES.map((mission) => ({ ...mission, claimed: false }));
}

export function initialGameFeatures(now = Date.now()): GameFeatures {
  return {
    schemaVersion: GAME_FEATURES_SCHEMA_VERSION,
    transferMarket: { offerIds: ["turbo", "wall", "maestro"], ownedIds: [] },
    starXI: { ownedIds: [], lineupIds: Array.from({ length: STAR_XI_SQUAD_SIZE }, () => ""), benchIds: Array.from({ length: STAR_XI_BENCH_SIZE }, () => ""), formationId: "433", formationPositions: [...STAR_XI_FORMATION_POSITIONS] },
    club: { name: "FC Goal", badge: "⚽", color: "#0071e3" },
    cup: { active: false, phase: "regular", tournamentId: "stadium", round: 0, wins: 0, best: 0, trophies: { stadium: 0, champions: 0, world: 0 }, lastResult: "Noch kein Turnierspiel.", matchStartedAt: 0, matchEndsAt: 0, lastTickAt: 0, homeScore: 0, awayScore: 0, opponent: "", opponentRating: 58, opponentStrategyId: "ballbesitz", strategyId: "konter", substitutionsUsed: 0, originalLineupIds: [], originalBenchIds: [], playerEnteredAt: {}, playerExitedAt: {}, playerMatchPositions: {}, lastGoal: null, matchEvents: [], penaltyHomeScore: 0, penaltyAwayScore: 0, penaltyHomeTaken: 0, penaltyAwayTaken: 0, penaltyTurn: "home", penaltyEvents: [], penaltyMessage: "", allTimeScorers: {} },
    goalBoost: { tournamentId: null, multiplier: 1, startedAt: 0, endsAt: 0 },
    missions: initialMissions(),
    history: [],
    randomEvent: null,
    starPackReveal: null,
    nextEventAt: now + getRandomEventDelay(),
    nextVarAt: now + getRandomEventDelay(),
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeCupGoalEvent(value: unknown): CupGoalEvent | null {
  const source = asRecord(value);
  if (typeof source.id !== "string" || (source.side !== "home" && source.side !== "away") || Number(source.createdAt) <= 0) return null;
  const scorerId = typeof source.scorerId === "string" && getStarXIPlayer(source.scorerId) ? source.scorerId : null;
  const ratingImpacts = Object.fromEntries(Object.entries(asRecord(source.ratingImpacts)).filter(([playerId, impact]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(impact)) && Number(impact) !== 0).map(([playerId, impact]) => [playerId, clamp(Number(impact), -2, 2)]));
  if (!Object.keys(ratingImpacts).length && source.side === "home" && scorerId) ratingImpacts[scorerId] = 0.7;
  return {
    id: safeString(source.id, "goal-event"),
    side: source.side,
    scorerId,
    scorer: safeString(source.scorer, source.side === "home" ? "Dein Club" : "Gegner"),
    minute: Math.max(1, Math.min(120, Math.floor(Number(source.minute) || 1))),
    createdAt: Math.floor(Number(source.createdAt)),
    homeScore: Math.max(0, Math.floor(Number(source.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(source.awayScore) || 0)),
    ratingImpacts,
  };
}

function normalizeCupPenaltyEvent(value: unknown): CupPenaltyEvent | null {
  const source = asRecord(value);
  const direction = source.direction === "left" || source.direction === "center" || source.direction === "right" ? source.direction : null;
  const keeperDirection = source.keeperDirection === "left" || source.keeperDirection === "center" || source.keeperDirection === "right" ? source.keeperDirection : null;
  const outcome = source.outcome === "goal" || source.outcome === "save" || source.outcome === "miss" ? source.outcome : null;
  if (typeof source.id !== "string" || (source.side !== "home" && source.side !== "away") || !direction || !keeperDirection || !outcome || Number(source.createdAt) <= 0) return null;
  return {
    id: safeString(source.id, "penalty-event"),
    side: source.side,
    playerId: typeof source.playerId === "string" && getStarXIPlayer(source.playerId) ? source.playerId : null,
    player: safeString(source.player, source.side === "home" ? "Dein Schütze" : "Gegner"),
    direction,
    keeperDirection,
    outcome,
    createdAt: Math.floor(Number(source.createdAt)),
    homeScore: Math.max(0, Math.floor(Number(source.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(source.awayScore) || 0)),
    homeTaken: Math.max(0, Math.floor(Number(source.homeTaken) || 0)),
    awayTaken: Math.max(0, Math.floor(Number(source.awayTaken) || 0)),
  };
}

export function normalizeGameFeatures(value: unknown): GameFeatures {
  const source = asRecord(value);
  const defaults = initialGameFeatures();
  const market = asRecord(source.transferMarket);
  const starXI = asRecord(source.starXI);
  const club = asRecord(source.club);
  const cup = asRecord(source.cup);
  const goalBoostSource = asRecord(source.goalBoost);
  const rawMissions = Array.isArray(source.missions) ? source.missions : [];
  const missions = initialMissions().map((mission) => {
    const saved = asRecord(rawMissions.find((item) => asRecord(item).id === mission.id));
    return { ...mission, claimed: saved.claimed === true };
  });
  const history = Array.isArray(source.history) ? source.history.map((item) => asRecord(item)).filter((item) => typeof item.title === "string").slice(-12).map((item, index) => ({
    id: safeString(item.id, `history-${index}`),
    title: safeString(item.title, "Spielereignis"),
    detail: safeString(item.detail, ""),
    tone: item.tone === "negative" || item.tone === "positive" ? item.tone : "neutral",
    timestamp: Number(item.timestamp) || Date.now(),
  })) : [];
  const randomEventSource = asRecord(source.randomEvent);
  const randomEvent = typeof randomEventSource.title === "string" ? {
    id: randomEventSource.id === "var" || randomEventSource.id === "elefantino" || randomEventSource.id === "sponsor" || randomEventSource.id === "fans" || randomEventSource.id === "injury" || randomEventSource.id === "weather" ? randomEventSource.id : "fans",
    title: safeString(randomEventSource.title, "Stadionereignis"),
    message: safeString(randomEventSource.message, "Die Fans sorgen für Stimmung."),
    amount: Number(randomEventSource.amount) || 0,
    tone: randomEventSource.tone === "negative" || randomEventSource.tone === "positive" ? randomEventSource.tone : "neutral",
    createdAt: Number(randomEventSource.createdAt) || Date.now(),
  } : null;
  const starPackRevealSource = asRecord(source.starPackReveal);
  const starPack = getStarPack(String(starPackRevealSource.packId));
  const starPlayerSource = asRecord(starPackRevealSource.player);
  const starPlayer = getStarXIPlayer(String(starPlayerSource.id));
  const starPackReveal = starPack && starPlayer && Number(starPackRevealSource.openedAt) > 0 ? {
    packId: starPack.id,
    packName: safeString(starPackRevealSource.packName, starPack.label).slice(0, 32),
    player: starPlayer,
    duplicate: starPackRevealSource.duplicate === true,
    compensation: Math.max(0, Math.floor(Number(starPackRevealSource.compensation) || 0)),
    openedAt: Math.floor(Number(starPackRevealSource.openedAt)),
    openedBy: safeString(starPackRevealSource.openedBy, "Mitspieler").slice(0, 22),
  } satisfies StarPackReveal : null;
  const ownedIds = Array.isArray(market.ownedIds) ? market.ownedIds.filter((id): id is string => typeof id === "string" && TRANSFER_PLAYERS.some((player) => player.id === id)) : [];
  const offerIds = Array.isArray(market.offerIds) ? market.offerIds.filter((id): id is string => typeof id === "string" && TRANSFER_PLAYERS.some((player) => player.id === id)).slice(0, 3) : [];
  const normalizedStarXI = normalizeStarXIState(starXI);
  const matchStartedAt = Math.max(0, Number(cup.matchStartedAt) || 0);
  const matchEndsAt = Math.max(0, Number(cup.matchEndsAt) || 0);
  const lastTickAt = Math.max(matchStartedAt, Number(cup.lastTickAt) || matchStartedAt);
  const lastGoal = normalizeCupGoalEvent(cup.lastGoal);
  const matchEvents = Array.isArray(cup.matchEvents) ? cup.matchEvents.map(normalizeCupGoalEvent).filter((event): event is CupGoalEvent => Boolean(event)).slice(-40) : lastGoal ? [lastGoal] : [];
  const penaltyEvents = Array.isArray(cup.penaltyEvents) ? cup.penaltyEvents.map(normalizeCupPenaltyEvent).filter((event): event is CupPenaltyEvent => Boolean(event)).slice(-40) : [];
  const allTimeScorers = Object.fromEntries(Object.entries(asRecord(cup.allTimeScorers)).filter(([playerId, goals]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(goals)) && Number(goals) > 0).map(([playerId, goals]) => [playerId, Math.max(0, Math.floor(Number(goals)))]));
  const tournament = getTournament(String(cup.tournamentId)) ?? TOURNAMENTS[0];
  const tournamentId = tournament.id;
  const active = cup.active === true && matchEndsAt > 0;
  const normalizeSavedSquadSlots = (value: unknown, size: number) => {
    const slots = Array.isArray(value) ? value : [];
    return Array.from({ length: size }, (_, index) => {
      const playerId = slots[index];
      return typeof playerId === "string" && normalizedStarXI.ownedIds.includes(playerId) && Boolean(getStarXIPlayer(playerId)) ? playerId : "";
    });
  };
  const savedOriginalLineupIds = normalizeSavedSquadSlots(cup.originalLineupIds, STAR_XI_SQUAD_SIZE);
  const originalLineupIds = savedOriginalLineupIds.some(Boolean) ? savedOriginalLineupIds : active ? [...normalizedStarXI.lineupIds] : [];
  const savedOriginalBenchIds = normalizeSavedSquadSlots(cup.originalBenchIds, STAR_XI_BENCH_SIZE);
  const originalBenchIds = savedOriginalBenchIds.some(Boolean) || Array.isArray(cup.originalBenchIds) ? savedOriginalBenchIds : active ? [...normalizedStarXI.benchIds] : [];
  const phase: CupMatchPhase = cup.phase === "extra-time" || cup.phase === "penalties" ? cup.phase : "regular";
  const round = active ? Math.max(0, Math.min(tournament.opponents.length - 1, Math.floor(Number(cup.round) || 0))) : 0;
  const roundOpponent = tournament.opponents[round] ?? tournament.opponents[0];
  const strategyId = CUP_STRATEGIES.some((strategy) => strategy.id === cup.strategyId) ? cup.strategyId as CupStrategyId : defaults.cup.strategyId;
  const opponentStrategyId = CUP_STRATEGIES.some((strategy) => strategy.id === cup.opponentStrategyId) ? cup.opponentStrategyId as CupStrategyId : roundOpponent.strategyId;
  const trophiesSource = asRecord(cup.trophies);
  const trophies: Record<TournamentId, number> = {
    stadium: Math.max(0, Math.floor(Number(trophiesSource.stadium) || 0)),
    champions: Math.max(0, Math.floor(Number(trophiesSource.champions) || 0)),
    world: Math.max(0, Math.floor(Number(trophiesSource.world) || 0)),
  };
  const goalBoostTournament = getTournament(String(goalBoostSource.tournamentId))?.id ?? null;
  const goalBoostStartedAt = Math.max(0, Math.floor(Number(goalBoostSource.startedAt) || 0));
  const goalBoostEndsAt = Math.max(goalBoostStartedAt, Math.floor(Number(goalBoostSource.endsAt) || 0));
  const goalBoost: GoalBoostState = goalBoostTournament && goalBoostEndsAt > goalBoostStartedAt ? {
    tournamentId: goalBoostTournament,
    multiplier: getTournamentGoalBoostMultiplier(goalBoostTournament),
    startedAt: goalBoostStartedAt,
    endsAt: goalBoostEndsAt,
  } : defaults.goalBoost;
  const playerEnteredAt = Object.fromEntries(Object.entries(asRecord(cup.playerEnteredAt)).filter(([playerId, minute]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(minute)) && Number(minute) >= 1).map(([playerId, minute]) => [playerId, Math.max(1, Math.min(120, Math.floor(Number(minute))))]));
  const playerExitedAt = Object.fromEntries(Object.entries(asRecord(cup.playerExitedAt)).filter(([playerId, minute]) => Boolean(playerEnteredAt[playerId]) && Number.isFinite(Number(minute)) && Number(minute) >= playerEnteredAt[playerId]).map(([playerId, minute]) => [playerId, Math.max(playerEnteredAt[playerId], Math.min(120, Math.floor(Number(minute))))]));
  const playerMatchPositions = Object.fromEntries(Object.entries(asRecord(cup.playerMatchPositions)).filter(([playerId, position]) => Boolean(playerEnteredAt[playerId]) && STAR_POSITIONS.includes(position as StarPosition)).map(([playerId, position]) => [playerId, position as StarPosition])) as Record<string, StarPosition>;
  if (active && !Object.keys(playerEnteredAt).length) {
    normalizedStarXI.lineupIds.forEach((playerId, index) => {
      if (!playerId) return;
      playerEnteredAt[playerId] = 1;
      playerMatchPositions[playerId] = normalizedStarXI.formationPositions[index] ?? getStarXIPlayer(playerId)?.position ?? "ZM";
    });
  }
  Object.keys(playerEnteredAt).forEach((playerId) => {
    if (!playerMatchPositions[playerId]) playerMatchPositions[playerId] = getStarXIPlayer(playerId)?.position ?? "ZM";
  });
  return {
    schemaVersion: GAME_FEATURES_SCHEMA_VERSION,
    transferMarket: { offerIds: offerIds.length ? offerIds : defaults.transferMarket.offerIds, ownedIds: [...new Set(ownedIds)] },
    starXI: normalizedStarXI,
    club: { name: safeString(club.name, defaults.club.name).slice(0, 22), badge: CLUB_BADGES.includes(String(club.badge)) ? String(club.badge) : defaults.club.badge, color: CLUB_COLORS.includes(String(club.color)) ? String(club.color) : defaults.club.color },
    cup: { active, phase, tournamentId, round, wins: Math.max(0, Math.floor(Number(cup.wins) || 0)), best: Math.max(0, Math.min(TOURNAMENTS[TOURNAMENTS.length - 1].opponents.length, Math.floor(Number(cup.best) || 0))), trophies, lastResult: safeString(cup.lastResult, defaults.cup.lastResult), matchStartedAt, matchEndsAt, lastTickAt, homeScore: Math.max(0, Math.floor(Number(cup.homeScore) || 0)), awayScore: Math.max(0, Math.floor(Number(cup.awayScore) || 0)), opponent: safeString(cup.opponent, roundOpponent.name), opponentRating: Math.max(40, Math.min(99, Math.floor(Number(cup.opponentRating) || roundOpponent.rating))), opponentStrategyId, strategyId, substitutionsUsed: Math.max(0, Math.min(STAR_XI_MAX_SUBSTITUTIONS, Math.floor(Number(cup.substitutionsUsed) || 0))), originalLineupIds, originalBenchIds, playerEnteredAt, playerExitedAt, playerMatchPositions, lastGoal, matchEvents, penaltyHomeScore: Math.max(0, Math.floor(Number(cup.penaltyHomeScore) || 0)), penaltyAwayScore: Math.max(0, Math.floor(Number(cup.penaltyAwayScore) || 0)), penaltyHomeTaken: Math.max(0, Math.floor(Number(cup.penaltyHomeTaken) || 0)), penaltyAwayTaken: Math.max(0, Math.floor(Number(cup.penaltyAwayTaken) || 0)), penaltyTurn: cup.penaltyTurn === "away" ? "away" : "home", penaltyEvents, penaltyMessage: typeof cup.penaltyMessage === "string" ? cup.penaltyMessage.slice(0, 180) : "", allTimeScorers },
    goalBoost,
    missions,
    history,
    randomEvent,
    starPackReveal,
    nextEventAt: Number(source.nextEventAt) > 0 ? Number(source.nextEventAt) : defaults.nextEventAt,
    nextVarAt: Number(source.nextVarAt) > 0 ? Number(source.nextVarAt) : defaults.nextVarAt,
  };
}

export function pauseGameFeatureTimers(value: unknown, pausedMs: number, now = Date.now()): GameFeatures {
  const features = normalizeGameFeatures(value);
  const duration = Math.max(0, Math.floor(Number(pausedMs) || 0));
  if (duration <= 0) return features;
  features.nextEventAt += duration;
  features.nextVarAt += duration;
  if (features.cup.active) {
    features.cup.matchStartedAt += duration;
    features.cup.matchEndsAt += duration;
    features.cup.lastTickAt += duration;
  }
  const pausedAt = now - duration;
  if (features.goalBoost.endsAt > pausedAt) {
    features.goalBoost.startedAt += duration;
    features.goalBoost.endsAt += duration;
  }
  return features;
}

export function getTransferPlayer(id: string) {
  return TRANSFER_PLAYERS.find((player) => player.id === id);
}

export function getTransferBonuses(ownedIds: string[]) {
  return ownedIds.reduce((bonus, id) => {
    const player = getTransferPlayer(id);
    if (!player) return bonus;
    return { clickBonus: bonus.clickBonus + player.clickBonus, passiveBonus: bonus.passiveBonus + player.passiveBonus, incomeBonus: bonus.incomeBonus + player.incomeBonus };
  }, { clickBonus: 0, passiveBonus: 0, incomeBonus: 0 });
}

export function getFreshTransferOffers(ownedIds: string[], random = Math.random) {
  const available = TRANSFER_PLAYERS.filter((player) => !ownedIds.includes(player.id));
  const pool = available.length >= 3 ? available : TRANSFER_PLAYERS;
  const result: string[] = [];
  while (result.length < Math.min(3, pool.length)) {
    const player = pool[Math.floor(random() * pool.length)];
    if (player && !result.includes(player.id)) result.push(player.id);
  }
  return result;
}

export function getMissionProgress(mission: CoopMission, source: MissionProgressSource) {
  if (mission.kind === "goals") return Math.floor(source.seasonGoals);
  if (mission.kind === "clicks") return Math.floor(source.clicks);
  if (mission.kind === "minigames") return Math.floor(source.minigameWins);
  return Math.floor(source.cupWins);
}

export function resolveRandomEvent(goals: number, random = Math.random(), now = Date.now()): RandomEvent {
  const safeGoals = Math.max(0, goals);
  const eventRoll = Math.max(0, Math.min(0.999999, random));
  if (eventRoll < 0.01) {
    const amount = Math.ceil(safeGoals);
    return {
      id: "elefantino",
      title: "Johhny Elefantino",
      message: amount > 0
        ? `Johhny Elefantino erklärt dein gesamtes Guthaben von ${amount.toLocaleString("de-CH")} Toren zur offiziellen Fussballabgabe. Dein Konto steht auf 0.`
        : "Johhny Elefantino wollte dir alles wegnehmen, aber dein Konto war bereits leer.",
      amount: -amount,
      tone: amount > 0 ? "negative" : "neutral",
      createdAt: now,
    };
  }
  const regularRoll = (eventRoll - 0.01) / 0.99;
  if (regularRoll < 0.48) {
    const amount = Math.max(80, Math.floor(safeGoals * 0.025));
    return { id: "sponsor", title: "Sponsor im Stadion", message: `Ein Sponsor überrascht den Club mit ${amount.toLocaleString("de-CH")} Toren.`, amount, tone: "positive", createdAt: now };
  }
  if (regularRoll < 0.78) {
    const amount = Math.max(40, Math.floor(safeGoals * 0.018));
    return { id: "fans", title: "Fans drehen auf", message: `Die Kurve pusht das Team mit ${amount.toLocaleString("de-CH")} Extra Toren.`, amount, tone: "positive", createdAt: now };
  }
  if (regularRoll < 0.9) {
    const amount = Math.min(safeGoals, Math.max(20, Math.floor(safeGoals * 0.012)));
    return { id: "weather", title: "Platzregen", message: amount > 0 ? `Der Rasen ist unbespielbar. ${amount.toLocaleString("de-CH")} Tore gehen verloren.` : "Der Regen kommt, aber der Club hat noch keine Tore zu verlieren.", amount: -amount, tone: amount > 0 ? "negative" : "neutral", createdAt: now };
  }
  const amount = Math.min(safeGoals, Math.max(30, Math.floor(safeGoals * 0.016)));
  return { id: "injury", title: "Verletzungspech", message: amount > 0 ? `Die medizinische Abteilung kostet den Club ${amount.toLocaleString("de-CH")} Tore.` : "Die medizinische Abteilung meldet Entwarnung.", amount: -amount, tone: amount > 0 ? "negative" : "neutral", createdAt: now };
}

export function resolveVarEvent(goals: number, random = Math.random(), now = Date.now()): RandomEvent {
  const safeGoals = Math.max(0, goals);
  const varRoll = Math.max(0, Math.min(0.999999, random));
  const positive = varRoll < 0.2;
  const magnitudeRoll = positive ? varRoll / 0.2 : (varRoll - 0.2) / 0.8;
  const share = positive ? 0.50 + magnitudeRoll * 2 : 0.10 + magnitudeRoll * 0.60;
  const amount = positive ? Math.floor(safeGoals * share) : Math.min(safeGoals, Math.floor(safeGoals * share));
  const percent = safeGoals > 0 ? Math.round((amount / safeGoals) * 100) : 0;
  if (positive) return { id: "var", title: "VAR gibt Tor frei", message: amount > 0 ? `Nach langer Prüfung werden ${amount.toLocaleString("de-CH")} Tore, also ${percent}% deines aktuellen Guthabens, nachträglich anerkannt.` : "Der VAR erkennt noch kein zusätzliches Tor an.", amount, tone: amount > 0 ? "positive" : "neutral", createdAt: now };
  return { id: "var", title: "VAR greift ein", message: amount > 0 ? `Abseits! Der VAR aberkennt ${amount.toLocaleString("de-CH")} Tore, also ${percent}% deines aktuellen Guthabens.` : "Der VAR prüft lange, findet aber noch kein Tor zum Aberkennen.", amount: -amount, tone: amount > 0 ? "negative" : "neutral", createdAt: now };
}

export function addHistory(features: GameFeatures, entry: Omit<MatchHistoryEntry, "id" | "timestamp">, now = Date.now()) {
  features.history = [...features.history, { ...entry, id: `${now}-${Math.random().toString(36).slice(2, 7)}`, timestamp: now }].slice(-12);
}
