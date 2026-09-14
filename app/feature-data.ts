import { FC26_STAR_PROFILES, type StarPosition } from "./fc26-player-pool";
import { getFC27Positions } from "./fc27-positions";
import { getFC27Rating } from "./fc27-ratings";
import { getFunnyPlayerName } from "./funny-player-names";

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
export type CupMatchMode = "tournament" | "season";
export type PenaltyDirection = "left" | "center" | "right";

export type GoalBoostState = {
  tournamentId: TournamentId | null;
  multiplier: number;
  startedAt: number;
  endsAt: number;
};

export type CupState = {
  active: boolean;
  mode: CupMatchMode;
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
  opponentIds: string[];
  strategyId: CupStrategyId;
  substitutionsUsed: number;
  matchMomentum: number;
  originalLineupIds: string[];
  originalBenchIds: string[];
  playerEnteredAt: Record<string, number>;
  playerExitedAt: Record<string, number>;
  playerMatchPositions: Record<string, StarPosition>;
  lastGoal: CupGoalEvent | null;
  lastInjury: CupInjuryEvent | null;
  matchEvents: CupGoalEvent[];
  cardEvents: CupCardEvent[];
  injuryEvents: CupInjuryEvent[];
  sentOffPlayerIds: string[];
  suspendedPlayerIds: string[];
  injuredPlayerIds: Record<string, number>;
  matchPaused: boolean;
  pendingNextRound: boolean;
  nextTournamentAt: number;
  penaltyHomeScore: number;
  penaltyAwayScore: number;
  penaltyHomeTaken: number;
  penaltyAwayTaken: number;
  penaltyTurn: "home" | "away";
  penaltyEvents: CupPenaltyEvent[];
  penaltyMessage: string;
  allTimeScorers: Record<string, number>;
  allTimeAppearances: Record<string, number>;
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

export type CupCardEvent = {
  id: string;
  side: "home" | "away";
  playerId: string | null;
  player: string;
  reason: string;
  card: "red";
  minute: number;
  createdAt: number;
  homeScore: number;
  awayScore: number;
};

export type CupInjuryEvent = {
  id: string;
  playerId: string;
  player: string;
  reason: string;
  matches: number;
  minute: number;
  createdAt: number;
  homeScore: number;
  awayScore: number;
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
  isCustom?: boolean;
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
  fragments: number;
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
  fragmentCompensation: number;
  source?: "pack" | "custom-draw";
};

export type StarPackReveal = StarPackOpening & {
  openedAt: number;
  openedBy: string;
  troll: boolean;
};

export type TournamentOpponent = {
  id: string;
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
  rounds: number;
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

export type TransferInsiderOutcome = "loan" | "sale" | "failed" | "return";

export type TransferLoan = {
  playerId: string;
  club: string;
  status: "pending" | "active";
  tournamentId: TournamentId | null;
  createdAt: number;
};

export type TransferSquadVacancy = {
  area: "lineup" | "bench";
  index: number;
  requiredPlayers: number;
  createdAt: number;
};

export type TransferInsiderEvent = {
  id: string;
  outcome: TransferInsiderOutcome;
  playerId: string | null;
  playerName: string | null;
  club: string;
  headline: string;
  message: string;
  reason: string;
  fee: number;
  createdAt: number;
};

export type TransferSagaState = {
  loans: TransferLoan[];
  vacancies: TransferSquadVacancy[];
  archive: TransferInsiderEvent[];
  latestEvent: TransferInsiderEvent | null;
  lastFailedReason: string;
  nextAt: number;
  deadlineDayStartedAt: number;
  deadlineDayEndsAt: number;
};

export type TournamentGazetteIssue = {
  id: string;
  headline: string;
  strapline: string;
  body: string;
  tone: "champion" | "exit";
  tournamentId: TournamentId;
  opponent: string;
  homeScore: number;
  awayScore: number;
  completedRound: number;
  tieBreak: boolean;
  createdAt: number;
};

export type TournamentCompletionSummary = {
  tournamentId: TournamentId;
  tournamentWon: boolean;
  completedRound: number;
  opponent: string;
  homeScore: number;
  awayScore: number;
  tieBreak: boolean;
};

export type SeasonTableRow = {
  id: string;
  name: string;
  rating: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

export type SeasonMatchHistoryEntry = {
  id: string;
  division: number;
  matchday: number;
  opponent: string;
  opponentRating: number;
  clubScore: number;
  opponentScore: number;
  outcome: "win" | "draw" | "loss";
  completedSeason: boolean;
  seasonOutcome: "promoted" | "relegated" | "stayed" | "hall-of-fame" | null;
  createdAt: number;
};

export type SeasonModeState = {
  division: number;
  highestDivision: number;
  matchday: number;
  table: SeasonTableRow[];
  lastTable: SeasonTableRow[];
  lastResult: string;
  lastMatchAt: number;
  history: SeasonMatchHistoryEntry[];
  hallOfFame: boolean;
  prestigeCount: number;
};

export type GameFeatures = {
  schemaVersion: number;
  transferMarket: TransferMarketState;
  starXI: StarXIState;
  club: ClubProfile;
  cup: CupState;
  seasonMode: SeasonModeState;
  goalBoost: GoalBoostState;
  missions: CoopMission[];
  history: MatchHistoryEntry[];
  randomEvent: RandomEvent | null;
  starPackReveal: StarPackReveal | null;
  transferSaga: TransferSagaState;
  gazetteIssues: TournamentGazetteIssue[];
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
export const TOURNAMENT_COOLDOWN_MS = 5 * 60 * 1000;
export const RED_CARD_CHANCE_PER_SECOND = 0.0012;
export const CUP_INJURY_CHANCE_PER_SECOND = 0.00065;
export const CUP_MIN_INJURY_MATCHES = 1;
export const CUP_MAX_INJURY_MATCHES = 3;
export const RED_CARD_MATCH_RATING_DROP = 6;
export const CUP_RED_CARD_MOMENTUM_DROP = 8;
export const CUP_MAX_MOMENTUM = 12;
export const CUP_MOMENTUM_RATING_WEIGHT = 0.45;
export const TOURNAMENT_GOAL_BOOST_DURATION_MS = 180000;
export const TOURNAMENT_GOAL_BOOST_MULTIPLIERS: Readonly<Record<TournamentId, number>> = {
  stadium: 1.5,
  champions: 2,
  world: 3,
};
export const STAR_PACK_ROLL_DURATION_MS = 8000;
export const STAR_XI_SQUAD_SIZE = 11;
export const STAR_XI_BENCH_SIZE = 12;
export const STAR_XI_MAX_SUBSTITUTIONS = 5;
export const GAME_FEATURES_SCHEMA_VERSION = 3;
export const SEASON_MODE_DIVISION_COUNT = 15;
export const SEASON_MODE_MATCHES_PER_SEASON = 10;
export const SEASON_MODE_TABLE_SIZE = 6;
export const TRANSFER_EVENT_MIN_DELAY_MS = 480000;
export const TRANSFER_EVENT_MAX_DELAY_MS = 720000;
export const TRANSFER_LOAN_CHANCE = 0.30;
export const TRANSFER_SALE_CHANCE = 0.10;
export const TRANSFER_PAID_SALE_CHANCE = 0.60;
export const TRANSFER_DEADLINE_LOAN_CHANCE = 0.60;
export const TRANSFER_DEADLINE_EVENT_MIN_DELAY_MS = 45000;
export const TRANSFER_DEADLINE_EVENT_MAX_DELAY_MS = 75000;
export const PACK_TROLL_CHANCE = 0.05;
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
export const TOURNAMENT_OPPONENT_MULTIPLIER = 4;
const TOURNAMENT_SEEDS: readonly TournamentDefinition[] = [
  {
    id: "stadium",
    label: "Stadionpokal",
    trophyName: "Stadionpokal",
    trophyIcon: "🏆",
    description: "Drei Spiele am Stück · 12 mögliche Gegner für deine erste Star XI.",
    minimumRating: 55,
    rounds: 3,
    opponents: [
      { id: "stadium-servette-genevois", name: "Servette Genevois", rating: 56, strategyId: "ballbesitz", scorers: ["Dereck Kutesa", "Enzo Crivelli", "Miroslav Stevanovic"] },
      { id: "stadium-fc-sionais", name: "FC Sionais", rating: 57, strategyId: "konter", scorers: ["Benjamin Kololli", "Dejan Sorgic", "Joël Schmied"] },
      { id: "stadium-fc-thoune", name: "FC Thoune", rating: 57, strategyId: "angriff", scorers: ["Marc Gut", "Miguel Castroman", "Kreshnik Hajrizi"] },
      { id: "stadium-fc-winterthure", name: "FC Winterthure", rating: 58, strategyId: "ballbesitz", scorers: ["Matteo Di Giusto", "Aldin Turkes", "Nishan Burkart"] },
      { id: "stadium-fc-luzerne", name: "FC Luzerne", rating: 59, strategyId: "konter", scorers: ["Lars Villiger", "Luca Jaquez", "Pius Dorn"] },
      { id: "stadium-fc-st-gallo", name: "FC St. Gallo", rating: 60, strategyId: "angriff", scorers: ["Chadrac Akolo", "Willem Geubbels", "Jordi Quintilla"] },
      { id: "stadium-fc-lausanne", name: "FC Lausanne", rating: 60, strategyId: "ballbesitz", scorers: ["Alvyn Sanches", "Kaly Sene", "Brighton Labeau"] },
      { id: "stadium-grasshopper-zurich", name: "Grasshopper Zürich", rating: 61, strategyId: "konter", scorers: ["Giotto Morandi", "Pascal Schürpf", "Awer Mabil"] },
      { id: "stadium-fc-lugano", name: "FC Lugano", rating: 62, strategyId: "angriff", scorers: ["Mattia Bottani", "Shkelqim Vladi", "Ignacio Aliseda"] },
      { id: "stadium-bsc-young-burs", name: "BSC Young Burs", rating: 63, strategyId: "angriff", scorers: ["Cédric Ittan", "Joël Monteiroh", "Filip Ugrinic"] },
      { id: "stadium-fc-zurique", name: "FC Zurique", rating: 64, strategyId: "ballbesitz", scorers: ["Jonathan Okita", "Bledian Krasniqi", "Antonio Marchesano"] },
      { id: "stadium-fc-basilea", name: "FC Basilea", rating: 68, strategyId: "konter", scorers: ["Xherdan Shaqiry", "Albian Ajati", "Kevin Carloso"] },
    ],
    accent: "#16845b",
  },
  {
    id: "champions",
    label: "Champions Cup",
    trophyName: "Champions Pokal",
    trophyIcon: "🏆",
    description: "Vier Runden · 16 mögliche Gegner auf internationalem Topniveau.",
    minimumRating: 74,
    rounds: 4,
    opponents: [
      { id: "champions-benfica-lissabonne", name: "Benfica Lissabonne", rating: 74, strategyId: "ballbesitz", scorers: ["Angel Di Maria", "Vangelis Pavlidis", "Rafa Silvaz"] },
      { id: "champions-ajax-amsterdamo", name: "Ajax Amsterdamo", rating: 74, strategyId: "angriff", scorers: ["Brian Brobbey", "Steven Berghuiss", "Kenneth Taylor"] },
      { id: "champions-porto-alegre", name: "Porto Alegre", rating: 75, strategyId: "konter", scorers: ["Pepê Costao", "Samu Omorodion", "Galeno"] },
      { id: "champions-psv-eindhoven", name: "PSV Eindhoven", rating: 75, strategyId: "ballbesitz", scorers: ["Luuk de Jong", "Noa Lang", "Johan Bakayoko"] },
      { id: "champions-borussia-dortmundt", name: "Borussia Dortmundt", rating: 76, strategyId: "ballbesitz", scorers: ["Serhou Girassy", "Karim Adejemi", "Julian Brandto"] },
      { id: "champions-rb-leipziga", name: "RB Leipziga", rating: 77, strategyId: "angriff", scorers: ["Benjamin Sesko", "Lois Openda", "Xavi Simons"] },
      { id: "champions-napoli-italiano", name: "Napoli Italiano", rating: 77, strategyId: "konter", scorers: ["Romelu Lukaku", "Khvicha Kvaradona", "Scott McTominay"] },
      { id: "champions-juventus-turino", name: "Juventus Turino", rating: 78, strategyId: "ballbesitz", scorers: ["Dusan Vlahovic", "Kenan Yildiz", "Teun Koopmeiners"] },
      { id: "champions-monaco-asm", name: "AS Monaco", rating: 78, strategyId: "konter", scorers: ["Folarin Balogun", "Takumi Minamino", "Breel Embolo"] },
      { id: "champions-chelsea-londra", name: "Chelsea Londra", rating: 79, strategyId: "angriff", scorers: ["Cole Palmer", "Nicolas Jackson", "Christopher Nkunku"] },
      { id: "champions-inter-milano", name: "Inter Milano", rating: 79, strategyId: "ballbesitz", scorers: ["Lautaro Martinezo", "Marcus Thuram", "Nicolo Barella"] },
      { id: "champions-tottenham-hotspur", name: "Tottenham Hotspur", rating: 80, strategyId: "konter", scorers: ["Heung-min Son", "James Maddison", "Dominic Solanke"] },
      { id: "champions-ac-milana", name: "AC Milana", rating: 80, strategyId: "angriff", scorers: ["Rafael Leao", "Kristjan Pulisik", "Santiago Gimenez"] },
      { id: "champions-barceloneta", name: "FC Barceloneta", rating: 82, strategyId: "ballbesitz", scorers: ["Robert Lewandowski", "Lamine Yamalo", "Raphinha"] },
      { id: "champions-atletico-madrido", name: "Atlético Madrido", rating: 84, strategyId: "konter", scorers: ["Antwan Griezman", "Julián Alvares", "Alexander Sorloth"] },
      { id: "champions-arsenal-londra", name: "Arsenal Londra", rating: 88, strategyId: "ballbesitz", scorers: ["Bukayo Sako", "Martin Odegard", "Kai Hawertz"] },
    ],
    accent: "#0071e3",
  },
  {
    id: "world",
    label: "Weltmeisterschaft",
    trophyName: "Weltpokal",
    trophyIcon: "🌍",
    description: "Sechs Runden · 24 mögliche Gegner aus der Weltspitze.",
    minimumRating: 86,
    rounds: 6,
    opponents: [
      { id: "world-napoli-italiano", name: "Napoli Italiano", rating: 86, strategyId: "konter", scorers: ["Romelu Lukaku", "Khvicha Kvaradona", "Scott McTominay"] },
      { id: "world-benfica-lissabonne", name: "Benfica Lissabonne", rating: 86, strategyId: "ballbesitz", scorers: ["Angel Di Maria", "Vangelis Pavlidis", "Rafa Silvaz"] },
      { id: "world-porto-alegre", name: "Porto Alegre", rating: 86, strategyId: "angriff", scorers: ["Pepê Costao", "Samu Omorodion", "Galeno"] },
      { id: "world-psv-eindhoven", name: "PSV Eindhoven", rating: 86, strategyId: "ballbesitz", scorers: ["Luuk de Jong", "Noa Lang", "Johan Bakayoko"] },
      { id: "world-ajax-amsterdam", name: "Ajax Amsterdam", rating: 86, strategyId: "konter", scorers: ["Brian Brobbey", "Steven Berghuiss", "Kenneth Taylor"] },
      { id: "world-galatasaray", name: "Galatasaray", rating: 86, strategyId: "angriff", scorers: ["Victor Osimhen", "Mauro Icardi", "Dries Mertens"] },
      { id: "world-borussia-dortmundt", name: "Borussia Dortmundt", rating: 87, strategyId: "ballbesitz", scorers: ["Serhou Girassy", "Karim Adejemi", "Julian Brandto"] },
      { id: "world-tottenham-hotspur", name: "Tottenham Hotspur", rating: 87, strategyId: "konter", scorers: ["Heung-min Son", "James Maddison", "Dominic Solanke"] },
      { id: "world-juventus-turino", name: "Juventus Turino", rating: 87, strategyId: "ballbesitz", scorers: ["Dusan Vlahovic", "Kenan Yildiz", "Teun Koopmeiners"] },
      { id: "world-inter-miami", name: "Inter Miami", rating: 87, strategyId: "angriff", scorers: ["Lionel Messy", "Luis Suarezo", "Jordi Alba"] },
      { id: "world-paris-saint-german", name: "Paris Saint German", rating: 88, strategyId: "angriff", scorers: ["Ousmane Dembelé", "Khvicha Kvaradona", "Bradley Barcolá"] },
      { id: "world-chelsea-londra", name: "Chelsea Londra", rating: 88, strategyId: "ballbesitz", scorers: ["Cole Palmer", "Nicolas Jackson", "Christopher Nkunku"] },
      { id: "world-ac-milana", name: "AC Milana", rating: 88, strategyId: "konter", scorers: ["Rafael Leao", "Kristjan Pulisik", "Santiago Gimenez"] },
      { id: "world-bayer-leverkusen", name: "Bayer Leverkusen", rating: 88, strategyId: "ballbesitz", scorers: ["Florian Wirtz", "Victor Boniface", "Patrik Schick"] },
      { id: "world-atletico-madrido", name: "Atlético Madrido", rating: 89, strategyId: "konter", scorers: ["Antwan Griezman", "Julián Alvares", "Alexander Sorloth"] },
      { id: "world-manchester-united", name: "Manchester United", rating: 89, strategyId: "angriff", scorers: ["Bruno Fernandes", "Rasmus Hojlundo", "Alejandro Garnacho"] },
      { id: "world-inter-milano", name: "Inter Milano", rating: 90, strategyId: "ballbesitz", scorers: ["Lautaro Martinezo", "Marcus Thuram", "Nicolo Barella"] },
      { id: "world-arsenal-londra", name: "Arsenal Londra", rating: 90, strategyId: "ballbesitz", scorers: ["Bukayo Sako", "Martin Odegard", "Kai Hawertz"] },
      { id: "world-liverpuhl-fc", name: "Liverpuhl FC", rating: 91, strategyId: "ballbesitz", scorers: ["Mohamed Salahm", "Luis Diazo", "Darwin Nunez"] },
      { id: "world-fc-barceloneta", name: "FC Barceloneta", rating: 92, strategyId: "angriff", scorers: ["Robert Lewandowski", "Lamine Yamalo", "Raphinha"] },
      { id: "world-bayern-muenchan", name: "Bayern Münchan", rating: 94, strategyId: "konter", scorers: ["Harry Kané", "Jamal Musiala", "Michael Olisé"] },
      { id: "world-manchester-cite", name: "Manchester Cité", rating: 96, strategyId: "ballbesitz", scorers: ["Erling Haland", "Phil Fodenh", "Kevin de Bruyne"] },
      { id: "world-real-madreto", name: "Real Madreto", rating: 98, strategyId: "angriff", scorers: ["Kylian Mbappo", "Vinícius Juniora", "Jude Bellingam"] },
      { id: "world-galacticos-xi", name: "Galácticos XI", rating: 99, strategyId: "konter", scorers: ["Cristiano Rinaldo", "Lionel Messy", "Ronaldo Nazárioh"] },
    ],
    accent: "#c69214",
  },
];

export const TOURNAMENTS: readonly TournamentDefinition[] = TOURNAMENT_SEEDS.map((tournament) => ({
  ...tournament,
  opponents: tournament.opponents.map((opponent) => ({
    ...opponent,
    scorers: opponent.scorers.map((scorer) => getFunnyPlayerName(scorer, `tournament-scorer:${scorer}`, { position: "ST", rating: opponent.rating })),
  })),
}));

export function getRandomEventDelay(random = Math.random()) {
  return 60000 + Math.floor(Math.max(0, Math.min(0.999999, random)) * 120000);
}

export function getTransferEventDelay(random = Math.random()) {
  const roll = Math.max(0, Math.min(0.999999, random));
  return TRANSFER_EVENT_MIN_DELAY_MS + Math.floor(roll * (TRANSFER_EVENT_MAX_DELAY_MS - TRANSFER_EVENT_MIN_DELAY_MS));
}

export function getTransferDeadlineEventDelay(random = Math.random()) {
  const roll = Math.max(0, Math.min(0.999999, random));
  return TRANSFER_DEADLINE_EVENT_MIN_DELAY_MS + Math.floor(roll * (TRANSFER_DEADLINE_EVENT_MAX_DELAY_MS - TRANSFER_DEADLINE_EVENT_MIN_DELAY_MS));
}

export function shouldTriggerPackTroll(player: StarXIPlayer, random: () => number = Math.random) {
  const eligible = player.rating >= 86 || player.cardType === "icon" || player.cardType === "legendary";
  return eligible && Math.max(0, Math.min(0.999999, Number(random()) || 0)) < PACK_TROLL_CHANCE;
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
    isCustom: true,
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
    isCustom: true,
    name: "Flurin Fabrice",
    position: "ZM",
    positions: ["ZM"],
    rating: 69,
    price: 1000,
    accent: "#8e8e93",
    cardType: "legendary",
    packWeight: 0.04,
  },
  {
    id: "star-benxli",
    isCustom: true,
    countryCode: "CH",
    name: "Mikeboy Jr.",
    position: "ST",
    positions: ["ST"],
    rating: 67,
    price: 1000,
    accent: "#1f7a4f",
    cardType: "legendary",
    packWeight: 0.04,
  },
  {
    id: "star-maetthu",
    isCustom: true,
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
    isCustom: true,
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
    isCustom: true,
    countryCode: "CH",
    name: "Silvuz",
    position: "LF",
    positions: ["LF", "LM", "RF"],
    rating: 100,
    price: 5000000000,
    accent: "#d71920",
    packWeight: 0.02,
  },
  {
    id: "star-nedu-mann-yesss",
    isCustom: true,
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
  {
    id: "star-di-santo",
    isCustom: true,
    countryCode: "NL",
    name: "Di Santo",
    position: "ST",
    positions: ["ST"],
    rating: 100,
    price: 5000000000,
    accent: "#f36c21",
    cardType: "legendary",
    packWeight: 0.02,
  },
];

// The YB cards are kept in the shared pool as well. Two of
// them already exist in the imported base dataset; the source-id list below
// covers the complete YB set so it cannot silently lose a player when the
// dataset changes.
export const YB_FC26_SOURCE_IDS = [
  "215556", "260272", "258924", "220665", "251617", "256726", "234913", "225853",
  "229900", "193468", "251532", "252526", "225533", "258230", "270371", "75499", "257319",
] as const;

type YBPlayerSeed = readonly [sourceId: string, name: string, rating: number, positions: readonly StarPosition[], countryCode?: string];

const YB_FC26_PLAYER_SEEDS: readonly YBPlayerSeed[] = [
  ["215556", "Edimilson Fernandis", 74, ["ZDM", "IV", "ZM"], "CH"],
  ["258924", "Joël Monteiroh", 73, ["LM", "RM", "ZM", "LF"], "CH"],
  ["220665", "Gregory Wüthricha", 73, ["IV"], "CH"],
  ["251617", "Armin Gigovik", 72, ["ZM", "ZDM"], "BA"],
  ["234913", "Christian Fassnachtt", 72, ["RM", "LM", "ST", "RF"], "CH"],
  ["225853", "Rayan Ravelosonn", 71, ["ZM", "ZDM"]],
  ["229900", "Sandro Lauperr", 70, ["IV", "ZDM", "ZM"], "CH"],
  ["193468", "Loris Benitto", 70, ["IV"], "CH"],
  ["251532", "Meschack Eliá", 70, ["ST"]],
  ["252526", "Darian Malesz", 70, ["RM", "LM", "ZOM", "ST"], "CH"],
  ["225533", "Chris Bediaa", 70, ["ST"], "CI"],
  ["258230", "Jaouen Hadjamm", 69, ["LV"], "FR"],
  ["270371", "Ryan Andrewz", 68, ["RV", "RM"], "EN"],
  ["75499", "Dominik Pechh", 68, ["ZM"], "CZ"],
  ["257319", "Alan Virginiuz", 68, ["RM", "LM", "RF"], "FR"],
];

const YB_FC26_PLAYERS: StarXIPlayer[] = YB_FC26_PLAYER_SEEDS.map(([sourceId, name, previousRating, positions, countryCode]) => {
  const rating = getFC27Rating(sourceId, previousRating);
  const updatedPositions = getFC27Positions(sourceId, positions);
  return {
    id: `yb-${sourceId}`,
    sourceId,
    countryCode,
    name: getFunnyPlayerName(name, `yb-${sourceId}`, { position: updatedPositions[0], rating }),
    position: updatedPositions[0],
    positions: [...updatedPositions],
    rating,
    price: Math.round(Math.min(1500000000, 5000 * 1.28 ** (rating - 70))),
    accent: "#f4c400",
  };
});

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
  name: getFunnyPlayerName(name, `icon-${id}`, { position: positions[0], rating }),
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
  ...YB_FC26_PLAYERS,
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

export const STAR_XI_BASE_CARD_COUNT = FC26_STAR_PROFILES.length + YB_FC26_PLAYERS.length;
export const STAR_XI_ICON_CARD_COUNT = FC26_ICON_PLAYERS.length;
export const STAR_XI_SPECIAL_CARD_COUNT = SPECIAL_STAR_XI_PLAYERS.length;
export const STAR_XI_TOTAL_CARD_COUNT = STAR_XI_PLAYERS.length;

const STAR_XI_PLAYER_BY_ID = new Map(STAR_XI_PLAYERS.map((player) => [player.id, player]));

export const STAR_XI_CUSTOM_PLAYERS = STAR_XI_PLAYERS.filter((player) => player.isCustom === true);
export const STAR_XI_RANDOM_CUSTOM_CARD_COST = 25000;

export function getStarXIFragmentCompensation(player: StarXIPlayer) {
  const ratingStep = Math.max(1, Math.min(34, Math.floor(player.rating) - 66));
  if (player.isCustom) return ratingStep * 600;
  if (player.cardType === "icon") return ratingStep * 75;
  if (player.cardType === "legendary") return ratingStep * 150;
  return ratingStep * 15;
}

export const STAR_PACKS: readonly StarPackDefinition[] = [
  { id: "scout", label: "Scout Pack", price: 25000, description: "Früh verfügbar und ideal zum Aufbau, starke Karten bleiben extrem selten", odds: [{ label: "Standard 65–79", minRating: 65, maxRating: 79, chance: 0.9 }, { label: "Selten 80–85", minRating: 80, maxRating: 85, chance: 0.09 }, { label: "Walkout 86–89", minRating: 86, maxRating: 89, chance: 0.009 }, { label: "Top Walkout 90–99", minRating: 90, maxRating: 99, chance: 0.00099 }, { label: "Legendär 100", minRating: 100, maxRating: 100, chance: 0.00001 }] },
  { id: "elite", label: "Elite Pack", price: 250000000, description: "Midgame Pack mit besseren Chancen, aber ohne geschenkte Topelf", odds: [{ label: "Standard 65–79", minRating: 65, maxRating: 79, chance: 0.55 }, { label: "Selten 80–85", minRating: 80, maxRating: 85, chance: 0.38 }, { label: "Walkout 86–89", minRating: 86, maxRating: 89, chance: 0.06 }, { label: "Top Walkout 90–99", minRating: 90, maxRating: 99, chance: 0.0099 }, { label: "Legendär 100", minRating: 100, maxRating: 100, chance: 0.0001 }] },
  { id: "legend", label: "Legenden Pack", price: 5000000000, description: "Teures Endgame Risiko mit klar besseren, aber weiterhin seltenen Topkarten", odds: [{ label: "Standard 65–79", minRating: 65, maxRating: 79, chance: 0.18 }, { label: "Selten 80–85", minRating: 80, maxRating: 85, chance: 0.42 }, { label: "Walkout 86–89", minRating: 86, maxRating: 89, chance: 0.34 }, { label: "Top Walkout 90–99", minRating: 90, maxRating: 99, chance: 0.05 }, { label: "Legendär 100", minRating: 100, maxRating: 100, chance: 0.01 }] },
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

const SEASON_DIVISION_LABELS = [
  "Kreisliga",
  "2. Liga",
  "1. Liga",
  "Regionalliga",
  "Challenge League",
  "Super League",
  "Conference League",
  "Europa League",
  "Europa League Elite",
  "Champions League",
  "Champions League Elite",
  "Weltliga",
  "Weltliga Elite",
  "Global League",
  "Hall of Fame",
] as const;

const SEASON_OPPONENT_NAMES = [
  "FC Tabellenkeller",
  "SV Unentschieden",
  "Real Zufall",
  "FC Arbeitszeitbetrug",
  "Inter Timeout",
] as const;

export function getSeasonModeDivisionLabel(division: number) {
  const index = Math.max(1, Math.min(SEASON_MODE_DIVISION_COUNT, Math.floor(Number(division) || 1))) - 1;
  return SEASON_DIVISION_LABELS[index] ?? SEASON_DIVISION_LABELS[0];
}

function getSeasonOpponentRating(division: number, index: number) {
  return Math.round(clamp(54 + (Math.max(1, division) - 1) * 3 + index * 2, 54, 99));
}

function createSeasonTable(division: number, clubName: string): SeasonTableRow[] {
  return [
    { id: "club", name: clubName || "FC Goal", rating: 0 },
    ...SEASON_OPPONENT_NAMES.map((name, index) => ({ id: `season-opponent-${index + 1}`, name, rating: getSeasonOpponentRating(division, index + 1) })),
  ].map((team) => ({ ...team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }));
}

function normalizeSeasonTable(raw: unknown, division: number, clubName: string) {
  const saved = Array.isArray(raw) ? raw.map(asRecord) : [];
  return createSeasonTable(division, clubName).map((fallback) => {
    const source = saved.find((candidate) => candidate.id === fallback.id) ?? {};
    return {
      id: fallback.id,
      name: fallback.id === "club" ? clubName || fallback.name : safeString(source.name, fallback.name).slice(0, 42),
      rating: fallback.id === "club" ? 0 : Math.max(1, Math.min(99, Math.floor(Number(source.rating) || fallback.rating))),
      played: Math.max(0, Math.floor(Number(source.played) || 0)),
      wins: Math.max(0, Math.floor(Number(source.wins) || 0)),
      draws: Math.max(0, Math.floor(Number(source.draws) || 0)),
      losses: Math.max(0, Math.floor(Number(source.losses) || 0)),
      goalsFor: Math.max(0, Math.floor(Number(source.goalsFor) || 0)),
      goalsAgainst: Math.max(0, Math.floor(Number(source.goalsAgainst) || 0)),
      points: Math.max(0, Math.floor(Number(source.points) || 0)),
    };
  });
}

function sortSeasonTable(table: readonly SeasonTableRow[]) {
  return [...table].sort((first, second) => second.points - first.points
    || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
    || second.goalsFor - first.goalsFor
    || (first.id === "club" ? -1 : second.id === "club" ? 1 : first.name.localeCompare(second.name)));
}

export function initialSeasonMode(clubName = "FC Goal"): SeasonModeState {
  const table = createSeasonTable(1, clubName);
  return {
    division: 1,
    highestDivision: 1,
    matchday: 0,
    table,
    lastTable: table,
    lastResult: "Die Saison wartet auf ihren ersten Anpfiff.",
    lastMatchAt: 0,
    history: [],
    hallOfFame: false,
    prestigeCount: 0,
  };
}

export function normalizeSeasonModeState(value: unknown, clubName = "FC Goal", legacyCompletedSeasons = 0): SeasonModeState {
  const source = asRecord(value);
  const hasSavedSeasonMode = Object.keys(source).length > 0;
  const legacyDivision = Math.min(SEASON_MODE_DIVISION_COUNT, Math.max(1, Math.floor(Number(legacyCompletedSeasons) || 0) + 1));
  const division = Math.min(SEASON_MODE_DIVISION_COUNT, Math.max(1, Math.floor(Number(source.division) || (hasSavedSeasonMode ? 1 : legacyDivision))));
  const highestDivision = Math.max(division, Math.min(SEASON_MODE_DIVISION_COUNT, Math.max(1, Math.floor(Number(source.highestDivision) || (hasSavedSeasonMode ? division : legacyDivision)))));
  const legacyHallOfFame = !hasSavedSeasonMode && Number(legacyCompletedSeasons) >= SEASON_MODE_DIVISION_COUNT - 1;
  const history = (Array.isArray(source.history) ? source.history : []).map((item) => asRecord(item)).map((item, index): SeasonMatchHistoryEntry | null => {
    const outcome = item.outcome === "win" || item.outcome === "draw" || item.outcome === "loss" ? item.outcome : null;
    if (!outcome) return null;
    const seasonOutcome = item.seasonOutcome === "promoted" || item.seasonOutcome === "relegated" || item.seasonOutcome === "stayed" || item.seasonOutcome === "hall-of-fame" ? item.seasonOutcome : null;
    return {
      id: safeString(item.id, `season-match-${index}`),
      division: Math.max(1, Math.min(SEASON_MODE_DIVISION_COUNT, Math.floor(Number(item.division) || division))),
      matchday: Math.max(1, Math.min(SEASON_MODE_MATCHES_PER_SEASON, Math.floor(Number(item.matchday) || 1))),
      opponent: safeString(item.opponent, "Unbekannter Gegner").slice(0, 42),
      opponentRating: Math.max(1, Math.min(99, Math.floor(Number(item.opponentRating) || 54))),
      clubScore: Math.max(0, Math.min(20, Math.floor(Number(item.clubScore) || 0))),
      opponentScore: Math.max(0, Math.min(20, Math.floor(Number(item.opponentScore) || 0))),
      outcome,
      completedSeason: item.completedSeason === true,
      seasonOutcome,
      createdAt: Math.max(1, Math.floor(Number(item.createdAt) || Date.now())),
    };
  }).filter((item): item is SeasonMatchHistoryEntry => Boolean(item)).slice(-30);
  const table = normalizeSeasonTable(source.table, division, clubName);
  const lastTable = normalizeSeasonTable(source.lastTable, division, clubName);
  return {
    division,
    highestDivision,
    matchday: Math.max(0, Math.min(SEASON_MODE_MATCHES_PER_SEASON - 1, Math.floor(Number(source.matchday) || 0))),
    table,
    lastTable,
    lastResult: safeString(source.lastResult, initialSeasonMode(clubName).lastResult).slice(0, 220),
    lastMatchAt: Math.max(0, Math.floor(Number(source.lastMatchAt) || 0)),
    history,
    hallOfFame: source.hallOfFame === true || legacyHallOfFame,
    prestigeCount: Math.max(0, Math.floor(Number(source.prestigeCount) || 0)),
  };
}

function rollSeasonScore(strength: number, random: () => number) {
  const expected = clamp(0.55 + strength * 0.035, 0.2, 3.8);
  let score = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const chance = clamp(expected / (attempt + 2.2), 0.035, 0.84);
    if (boundedRandom(random) < chance) score += 1;
  }
  return score;
}

function updateSeasonTableRow(row: SeasonTableRow, goalsFor: number, goalsAgainst: number) {
  const won = goalsFor > goalsAgainst;
  const draw = goalsFor === goalsAgainst;
  return {
    ...row,
    played: row.played + 1,
    wins: row.wins + (won ? 1 : 0),
    draws: row.draws + (draw ? 1 : 0),
    losses: row.losses + (!won && !draw ? 1 : 0),
    goalsFor: row.goalsFor + goalsFor,
    goalsAgainst: row.goalsAgainst + goalsAgainst,
    points: row.points + (won ? 3 : draw ? 1 : 0),
  };
}

export function getSeasonModeNextOpponent(value: unknown, clubName = "FC Goal") {
  const state = normalizeSeasonModeState(value, clubName);
  const opponentIndex = (state.matchday % (SEASON_MODE_TABLE_SIZE - 1)) + 1;
  const opponent = state.table.find((team) => team.id === `season-opponent-${opponentIndex}`) ?? state.table[1];
  const strategyIds: readonly CupStrategyId[] = ["ballbesitz", "konter", "angriff"];
  return {
    id: opponent?.id ?? `season-opponent-${opponentIndex}`,
    name: opponent?.name ?? "Unbekannter Gegner",
    rating: opponent?.rating ?? getSeasonOpponentRating(state.division, opponentIndex),
    strategyId: strategyIds[(opponentIndex - 1) % strategyIds.length] ?? "ballbesitz",
  };
}

export function recordSeasonModeMatch(value: unknown, clubScore: number, opponentScore: number, clubName = "FC Goal", now = Date.now(), random: () => number = Math.random, opponentId?: string) {
  const state = normalizeSeasonModeState(value, clubName);
  if (state.hallOfFame) return { state, played: false, entry: null as SeasonMatchHistoryEntry | null };
  const matchday = state.matchday + 1;
  const nextOpponent = getSeasonModeNextOpponent(state, clubName);
  const opponent = state.table.find((team) => team.id === opponentId) ?? state.table.find((team) => team.id === nextOpponent.id) ?? state.table[1];
  const safeClubScore = Math.max(0, Math.min(20, Math.floor(Number(clubScore) || 0)));
  const safeOpponentScore = Math.max(0, Math.min(20, Math.floor(Number(opponentScore) || 0)));
  const opponentRating = opponent?.rating ?? nextOpponent.rating;
  const outcome: SeasonMatchHistoryEntry["outcome"] = safeClubScore > safeOpponentScore ? "win" : safeClubScore === safeOpponentScore ? "draw" : "loss";
  let table = state.table.map((team) => team.id === "club" ? updateSeasonTableRow({ ...team, name: clubName || team.name }, safeClubScore, safeOpponentScore) : team.id === opponent?.id ? updateSeasonTableRow(team, safeOpponentScore, safeClubScore) : team);
  const backgroundTeams = table.filter((team) => team.id !== "club" && team.id !== opponent?.id);
  for (let index = 0; index + 1 < backgroundTeams.length; index += 2) {
    const first = backgroundTeams[index];
    const second = backgroundTeams[index + 1];
    const firstScore = rollSeasonScore(first.rating - second.rating + 1, random);
    const secondScore = rollSeasonScore(second.rating - first.rating - 1, random);
    table = table.map((team) => team.id === first.id ? updateSeasonTableRow(team, firstScore, secondScore) : team.id === second.id ? updateSeasonTableRow(team, secondScore, firstScore) : team);
  }
  const lastTable = sortSeasonTable(table);
  const completedSeason = matchday >= SEASON_MODE_MATCHES_PER_SEASON;
  let seasonOutcome: SeasonMatchHistoryEntry["seasonOutcome"] = null;
  let nextDivision = state.division;
  let nextHighestDivision = state.highestDivision;
  let hallOfFame = false;
  let lastResult = `${safeClubScore}:${safeOpponentScore} gegen ${opponent?.name ?? nextOpponent.name}. ${matchday} von ${SEASON_MODE_MATCHES_PER_SEASON} Saisonspielen gespielt.`;
  if (completedSeason) {
    const position = lastTable.findIndex((team) => team.id === "club") + 1;
    if (state.division === SEASON_MODE_DIVISION_COUNT && position <= 2) {
      hallOfFame = true;
      seasonOutcome = "hall-of-fame";
      nextDivision = SEASON_MODE_DIVISION_COUNT;
      lastResult = `Hall of Fame erreicht. Dein Club beendet die Saison auf Platz ${position}.`;
    } else if (position <= 2 && state.division < SEASON_MODE_DIVISION_COUNT) {
      seasonOutcome = "promoted";
      nextDivision = state.division + 1;
      lastResult = `Saison beendet: Platz ${position} und Aufstieg in Saison ${nextDivision}.`;
    } else if (position >= SEASON_MODE_TABLE_SIZE - 1 && state.division > 1) {
      seasonOutcome = "relegated";
      nextDivision = state.division - 1;
      lastResult = `Saison beendet: Platz ${position} und Abstieg in Saison ${nextDivision}.`;
    } else {
      seasonOutcome = "stayed";
      lastResult = `Saison beendet: Platz ${position}. Dein Club bleibt in ${getSeasonModeDivisionLabel(state.division)}.`;
    }
    nextHighestDivision = Math.max(nextHighestDivision, nextDivision);
  }
  const entry: SeasonMatchHistoryEntry = {
    id: `season-match-${now}-${matchday}`,
    division: state.division,
    matchday,
    opponent: opponent?.name ?? nextOpponent.name,
    opponentRating,
    clubScore: safeClubScore,
    opponentScore: safeOpponentScore,
    outcome,
    completedSeason,
    seasonOutcome,
    createdAt: now,
  };
  const nextState: SeasonModeState = {
    ...state,
    division: nextDivision,
    highestDivision: nextHighestDivision,
    matchday: completedSeason ? 0 : matchday,
    table: completedSeason && !hallOfFame ? createSeasonTable(nextDivision, clubName) : lastTable,
    lastTable,
    lastResult,
    lastMatchAt: now,
    history: [...state.history, entry].slice(-30),
    hallOfFame,
  };
  return { state: nextState, played: true, entry };
}

export function playSeasonModeMatch(value: unknown, starRating: number, clubName = "FC Goal", now = Date.now(), random: () => number = Math.random) {
  const state = normalizeSeasonModeState(value, clubName);
  if (state.hallOfFame) return { state, played: false, entry: null as SeasonMatchHistoryEntry | null };
  const opponent = getSeasonModeNextOpponent(state, clubName);
  const homeAdvantage = state.matchday % 2 === 0 ? 1.5 : -1.5;
  const clubScore = rollSeasonScore((Number(starRating) || 55) - opponent.rating + homeAdvantage, random);
  const opponentScore = rollSeasonScore((opponent.rating - (Number(starRating) || 55)) - homeAdvantage, random);
  return recordSeasonModeMatch(state, clubScore, opponentScore, clubName, now, random, opponent.id);
}

export function startSeasonPrestige(value: unknown, clubName = "FC Goal", now = Date.now()) {
  const state = normalizeSeasonModeState(value, clubName);
  if (!state.hallOfFame) return state;
  const freshTable = createSeasonTable(1, clubName);
  return {
    ...state,
    division: 1,
    matchday: 0,
    table: freshTable,
    lastTable: freshTable,
    lastResult: `Prestige ${state.prestigeCount + 1} gestartet. Die Jagd auf die Hall of Fame beginnt von vorn.`,
    lastMatchAt: now,
    hallOfFame: false,
    prestigeCount: state.prestigeCount + 1,
  };
}

export function getStarXIPlayer(id: string) {
  return STAR_XI_PLAYER_BY_ID.get(id);
}

export function drawRandomStarXICustomCard(state: StarXIState, random = Math.random) {
  const next = normalizeStarXIState(state);
  const cost = STAR_XI_RANDOM_CUSTOM_CARD_COST;
  if (next.fragments < cost || STAR_XI_CUSTOM_PLAYERS.length === 0) {
    return { state: next, drawn: false, cost, player: null, duplicate: false, fragmentCompensation: 0, source: "custom-draw" as const };
  }
  const roll = clamp(Number(random()) || 0, 0, 0.999999999);
  const player = STAR_XI_CUSTOM_PLAYERS[Math.floor(roll * STAR_XI_CUSTOM_PLAYERS.length)];
  const duplicate = next.ownedIds.includes(player.id);
  next.fragments -= cost;
  const fragmentCompensation = duplicate ? getStarXIFragmentCompensation(player) : 0;
  if (duplicate) next.fragments += fragmentCompensation;
  else next.ownedIds = addStarXIPlayer(next, player.id).ownedIds;
  return {
    state: next,
    drawn: true,
    cost,
    packId: "legend" as const,
    packName: "Spezialkarten-Zug",
    player,
    duplicate,
    fragmentCompensation,
    source: "custom-draw" as const,
  };
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

function normalizeLineupSlots(ownedIds: string[], rawLineupIds: unknown, formationPositions: readonly StarPosition[], blockedIds: ReadonlySet<string> = new Set()) {
  const lineupIds = Array.from({ length: STAR_XI_SQUAD_SIZE }, () => "");
  const requested = Array.isArray(rawLineupIds) ? rawLineupIds : [];
  const used = new Set<string>();
  const displaced: string[] = [];
  const preservedEmptySlots = new Set<number>();

  for (let index = 0; index < STAR_XI_SQUAD_SIZE; index += 1) {
    const rawId = requested[index];
    if (rawId === "" || (typeof rawId === "string" && blockedIds.has(rawId))) preservedEmptySlots.add(index);
    const id = typeof rawId === "string" && ownedIds.includes(rawId) && !blockedIds.has(rawId) ? rawId : "";
    if (!id || used.has(id)) continue;
    if (canStarXIPlayerFillSlot(id, index, formationPositions)) {
      lineupIds[index] = id;
      used.add(id);
    } else {
      displaced.push(id);
    }
  }

  const candidates = [...displaced, ...ownedIds.filter((id) => !used.has(id) && !displaced.includes(id) && !blockedIds.has(id))];
  for (const id of candidates) {
    const openIndex = lineupIds.findIndex((current, index) => !current && !preservedEmptySlots.has(index) && canStarXIPlayerFillSlot(id, index, formationPositions));
    if (openIndex < 0) continue;
    lineupIds[openIndex] = id;
    used.add(id);
  }
  return lineupIds;
}

function normalizeBenchSlots(ownedIds: string[], lineupIds: string[], rawBenchIds: unknown, blockedIds: ReadonlySet<string> = new Set()) {
  const benchIds = Array.from({ length: STAR_XI_BENCH_SIZE }, () => "");
  const requested = Array.isArray(rawBenchIds) ? rawBenchIds : [];
  const used = new Set(lineupIds.filter(Boolean));
  const preservedEmptySlots = new Set<number>();
  for (let index = 0; index < STAR_XI_BENCH_SIZE; index += 1) {
    const rawId = requested[index];
    if (rawId === "" || (typeof rawId === "string" && blockedIds.has(rawId))) preservedEmptySlots.add(index);
    const id = typeof rawId === "string" && ownedIds.includes(rawId) && !blockedIds.has(rawId) ? rawId : "";
    if (!id || used.has(id)) continue;
    benchIds[index] = id;
    used.add(id);
  }
  for (const id of ownedIds) {
    if (used.has(id) || blockedIds.has(id)) continue;
    const openIndex = benchIds.findIndex((current, index) => !current && !preservedEmptySlots.has(index));
    if (openIndex < 0) break;
    benchIds[openIndex] = id;
    used.add(id);
  }
  return benchIds;
}

export function normalizeStarXIState(value: unknown, blockedPlayerIds: readonly string[] = []) {
  const source = asRecord(value);
  const ownedIds = uniqueKnownStarIds(source.ownedIds);
  const fragments = Math.max(0, Math.floor(Number(source.fragments) || 0));
  const blockedIds = new Set(blockedPlayerIds);
  const requestedPositions = normalizeFormationPositions(source.formationPositions);
  const formation = STAR_FORMATIONS.find((item) => item.id === source.formationId)
    ?? STAR_FORMATIONS.find((item) => item.slots.every((slot, index) => slot.position === requestedPositions[index]))
    ?? getStarFormation("433");
  const formationPositions = formation.slots.map((slot) => slot.position);
  const lineupIds = normalizeLineupSlots(ownedIds, source.lineupIds, formationPositions, blockedIds);
  const benchIds = normalizeBenchSlots(ownedIds, lineupIds, source.benchIds, blockedIds);
  return { ownedIds, fragments, lineupIds, benchIds, formationId: formation.id, formationPositions };
}

export function removeStarXIPlayersFromSquad(state: StarXIState, playerIds: readonly string[], removeFromLineup = true) {
  const next = normalizeStarXIState(state);
  const blocked = new Set(playerIds);
  if (!blocked.size) return next;
  const lineupIds = removeFromLineup ? next.lineupIds.map((id) => blocked.has(id) ? "" : id) : [...next.lineupIds];
  const used = new Set(lineupIds.filter(Boolean));
  const benchIds = next.benchIds.map((id) => blocked.has(id) || used.has(id) ? "" : id);
  return { ...next, lineupIds, benchIds };
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

export function setStarXIStarter(state: StarXIState, lineupIndex: number, playerId: string, blockedPlayerIds: readonly string[] = []) {
  const next = normalizeStarXIState(state);
  const blocked = new Set(blockedPlayerIds);
  if (!Number.isInteger(lineupIndex) || lineupIndex < 0 || lineupIndex >= STAR_XI_SQUAD_SIZE || blocked.has(playerId) || !next.ownedIds.includes(playerId) || !canStarXIPlayerFillSlot(playerId, lineupIndex, next.formationPositions)) return next;
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
      if (currentPlayerId && !blocked.has(currentPlayerId)) next.benchIds[benchIndex] = currentPlayerId;
      else next.benchIds[benchIndex] = "";
    }
  }
  next.lineupIds = lineupIds;
  return blocked.size ? removeStarXIPlayersFromSquad(next, blockedPlayerIds, false) : normalizeStarXIState(next);
}

export function setStarXIFormation(state: StarXIState, formationId: StarFormationId, blockedPlayerIds: readonly string[] = []) {
  const next = normalizeStarXIState(state);
  const formation = STAR_FORMATIONS.find((item) => item.id === formationId);
  if (!formation || formation.id === next.formationId) return next;
  const formationPositions = formation.slots.map((slot) => slot.position);
  const blocked = new Set(blockedPlayerIds);
  const lineupIds = normalizeLineupSlots(next.ownedIds, next.lineupIds, formationPositions, blocked);
  const benchIds = normalizeBenchSlots(next.ownedIds, lineupIds, next.benchIds, blocked);
  return { ...next, formationId: formation.id, formationPositions, lineupIds, benchIds };
}

export function setStarXIBenchPlayer(state: StarXIState, benchIndex: number, playerId: string, blockedPlayerIds: readonly string[] = []) {
  const next = normalizeStarXIState(state);
  if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= STAR_XI_BENCH_SIZE || blockedPlayerIds.includes(playerId) || !next.ownedIds.includes(playerId) || next.lineupIds.includes(playerId)) return next;
  const currentPlayerId = next.benchIds[benchIndex];
  const otherBenchIndex = next.benchIds.indexOf(playerId);
  if (otherBenchIndex >= 0) next.benchIds[otherBenchIndex] = currentPlayerId;
  next.benchIds[benchIndex] = playerId;
  return blockedPlayerIds.length ? removeStarXIPlayersFromSquad(next, blockedPlayerIds, false) : normalizeStarXIState(next);
}

function compareStarXIPlayers(first: StarXIPlayer, second: StarXIPlayer) {
  return second.rating - first.rating || first.id.localeCompare(second.id);
}

function isDedicatedStarXIGoalkeeper(player: StarXIPlayer) {
  const positions = getStarXIPositions(player);
  return positions.length > 0 && positions.every((position) => position === "TW");
}

function countBits(value: number) {
  let count = 0;
  let current = value;
  while (current) {
    current &= current - 1;
    count += 1;
  }
  return count;
}

/**
 * Finds the highest-rated valid assignment for the current formation.
 *
 * The dynamic program uses a bit for each of the eleven slots. Only the
 * eleven highest-rated candidates for a slot are needed: an assignment can
 * use at most ten other players to block those candidates, so a lower-ranked
 * twelfth candidate can always be replaced by a free higher-ranked one.
 */
export function getBestStarXISelection(ownedIds: string[], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, blockedPlayerIds: readonly string[] = []) {
  const positions = Array.from({ length: STAR_XI_SQUAD_SIZE }, (_, index) => formationPositions[index] ?? STAR_XI_FORMATION_POSITIONS[index]);
  const blocked = new Set(blockedPlayerIds);
  const players = [...new Set(ownedIds)]
    .map((id) => getStarXIPlayer(id))
    .filter((player): player is StarXIPlayer => Boolean(player) && !blocked.has(player.id));
  const candidateIds = new Set<string>();

  for (const position of positions) {
    players
      .filter((player) => canStarXIPlayerPlayPosition(player, position))
      .sort(compareStarXIPlayers)
      .slice(0, STAR_XI_SQUAD_SIZE)
      .forEach((player) => candidateIds.add(player.id));
  }

  const candidates = players.filter((player) => candidateIds.has(player.id)).sort(compareStarXIPlayers);
  const stateCount = 1 << STAR_XI_SQUAD_SIZE;
  let scores = new Float64Array(stateCount);
  scores.fill(Number.NEGATIVE_INFINITY);
  scores[0] = 0;
  const scoreLayers: Float64Array[] = [scores];

  for (const player of candidates) {
    const nextScores = new Float64Array(scores);
    const compatibleSlots = positions.reduce((mask, position, index) => canStarXIPlayerPlayPosition(player, position) ? mask | (1 << index) : mask, 0);
    for (let mask = 0; mask < stateCount; mask += 1) {
      if (!Number.isFinite(scores[mask])) continue;
      let openSlots = compatibleSlots & ~mask;
      while (openSlots) {
        const slotBit = openSlots & -openSlots;
        const nextMask = mask | slotBit;
        const nextScore = scores[mask] + player.rating;
        if (nextScore > nextScores[nextMask]) nextScores[nextMask] = nextScore;
        openSlots ^= slotBit;
      }
    }
    scores = nextScores;
    scoreLayers.push(scores);
  }

  let bestMask = 0;
  let bestCount = 0;
  let bestRating = 0;
  for (let mask = 0; mask < stateCount; mask += 1) {
    const rating = scores[mask];
    if (!Number.isFinite(rating)) continue;
    const count = countBits(mask);
    if (count > bestCount || (count === bestCount && rating > bestRating)) {
      bestMask = mask;
      bestCount = count;
      bestRating = rating;
    }
  }

  const lineupIds = Array.from({ length: STAR_XI_SQUAD_SIZE }, () => "");
  let mask = bestMask;
  for (let playerIndex = candidates.length; playerIndex > 0 && mask; playerIndex -= 1) {
    const player = candidates[playerIndex - 1];
    const currentScore = scoreLayers[playerIndex][mask];
    if (currentScore === scoreLayers[playerIndex - 1][mask]) continue;
    for (let slotIndex = 0; slotIndex < STAR_XI_SQUAD_SIZE; slotIndex += 1) {
      const slotBit = 1 << slotIndex;
      if (!(mask & slotBit)) continue;
      if (!canStarXIPlayerPlayPosition(player, positions[slotIndex])) continue;
      const previousMask = mask ^ slotBit;
      const previousScore = scoreLayers[playerIndex - 1][previousMask];
      if (!Number.isFinite(previousScore) || previousScore + player.rating !== currentScore) continue;
      lineupIds[slotIndex] = player.id;
      mask = previousMask;
      break;
    }
  }
  return lineupIds;
}

export function setBestStarXI(state: StarXIState, blockedPlayerIds: readonly string[] = []) {
  const next = removeStarXIPlayersFromSquad(normalizeStarXIState(state), blockedPlayerIds);
  const lineupIds = getBestStarXISelection(next.ownedIds, next.formationPositions, blockedPlayerIds);
  const benchIds = getBestStarXIBenchSelection(next.ownedIds, lineupIds, next.formationPositions, blockedPlayerIds);
  return { ...next, lineupIds, benchIds };
}

/**
 * Builds a substitute bench that mirrors the role demand of the formation.
 * Repeated positions stay repeated, so a back three reserves several centre
 * backs instead of filling the bench with whichever midfielders rate highest.
 */
export function getBestStarXIBenchSelection(
  ownedIds: string[],
  lineupIds: readonly string[],
  formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS,
  blockedPlayerIds: readonly string[] = [],
) {
  const blocked = new Set(blockedPlayerIds);
  const used = new Set(lineupIds.filter(Boolean));
  const requiredPositions = formationPositions.slice(0, STAR_XI_SQUAD_SIZE);
  const positionDemand = requiredPositions.reduce((counts, position) => {
    counts[position] = (counts[position] ?? 0) + 1;
    return counts;
  }, {} as Partial<Record<StarPosition, number>>);
  const activePositions = Object.keys(positionDemand) as StarPosition[];
  const benchCandidates = [...new Set(ownedIds)]
    .filter((playerId) => !used.has(playerId) && !blocked.has(playerId))
    .map((playerId) => getStarXIPlayer(playerId))
    .filter((player): player is StarXIPlayer => Boolean(player) && requiredPositions.some((position) => canStarXIPlayerPlayPosition(player, position)))
    .sort(compareStarXIPlayers);

  if (!requiredPositions.length || !benchCandidates.length) return Array.from({ length: STAR_XI_BENCH_SIZE }, () => "");
  const selectedBenchPlayers: StarXIPlayer[] = [];
  const selectedIds = new Set<string>();
  const coverage = Object.fromEntries(activePositions.map((position) => [position, 0])) as Record<StarPosition, number>;
  const demandOrder = requiredPositions
    .map((position, index) => ({ position, index }))
    .sort((first, second) => (positionDemand[first.position] ?? 0) - (positionDemand[second.position] ?? 0)
      || benchCandidates.filter((player) => canStarXIPlayerPlayPosition(player, first.position)).length - benchCandidates.filter((player) => canStarXIPlayerPlayPosition(player, second.position)).length
      || first.index - second.index);
  const candidateScore = (player: StarXIPlayer, assignmentPosition?: StarPosition) => {
    let score = player.rating * 10 + (assignmentPosition && player.position === assignmentPosition ? 30 : 0);
    for (const position of activePositions) {
      if (!canStarXIPlayerPlayPosition(player, position)) continue;
      const demand = Math.max(1, positionDemand[position] ?? 1);
      if (position !== assignmentPosition) score -= 35 / demand;
      const excess = coverage[position] + 1 - demand;
      if (excess > 0) score -= excess * 140;
    }
    return score;
  };
  const selectPlayer = (player: StarXIPlayer) => {
    selectedIds.add(player.id);
    selectedBenchPlayers.push(player);
    for (const position of activePositions) if (canStarXIPlayerPlayPosition(player, position)) coverage[position] += 1;
  };

  for (const { position } of demandOrder) {
    const player = benchCandidates
      .filter((candidate) => !selectedIds.has(candidate.id) && canStarXIPlayerPlayPosition(candidate, position))
      .sort((first, second) => candidateScore(second, position) - candidateScore(first, position) || compareStarXIPlayers(first, second))[0];
    if (player) selectPlayer(player);
  }

  while (selectedBenchPlayers.length < STAR_XI_BENCH_SIZE) {
    const dedicatedGoalkeeperSelected = selectedBenchPlayers.some(isDedicatedStarXIGoalkeeper);
    const player = benchCandidates
      .filter((candidate) => !selectedIds.has(candidate.id) && !(dedicatedGoalkeeperSelected && isDedicatedStarXIGoalkeeper(candidate)))
      .sort((first, second) => candidateScore(second) - candidateScore(first) || compareStarXIPlayers(first, second))[0];
    if (!player) break;
    // Keep the earlier UCL-style rule: one dedicated substitute goalkeeper is enough.
    selectPlayer(player);
  }

  return Array.from({ length: STAR_XI_BENCH_SIZE }, (_, index) => selectedBenchPlayers[index]?.id ?? "");
}

export function restoreStarXIAfterMatch(state: StarXIState, cup: CupState) {
  const next = normalizeStarXIState(state);
  if (cup.originalLineupIds.length !== STAR_XI_SQUAD_SIZE) return next;
  const restored = {
    ...next,
    lineupIds: [...cup.originalLineupIds],
    benchIds: cup.originalBenchIds.length === STAR_XI_BENCH_SIZE ? [...cup.originalBenchIds] : next.benchIds,
  };
  const injuredIds = Object.entries(cup.injuredPlayerIds ?? {}).filter(([, matches]) => Number(matches) > 0).map(([playerId]) => playerId);
  return removeStarXIPlayersFromSquad(restored, [...new Set([...cup.suspendedPlayerIds, ...injuredIds])]);
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

export type CupSubstitutionImpact = {
  cup: CupState;
  incomingRating: number;
  outgoingRating: number;
  ratingDelta: number;
  outgoingMatchRating: number;
  momentumDelta: number;
};

export function applyCupSubstitution(cup: CupState, outgoingPlayerId: string | undefined, incomingPlayerId: string, minute: number): CupSubstitutionImpact {
  const incoming = getStarXIPlayer(incomingPlayerId);
  const outgoing = outgoingPlayerId ? getStarXIPlayer(outgoingPlayerId) : undefined;
  if (!incoming || !outgoing) return { cup, incomingRating: incoming?.rating ?? 0, outgoingRating: outgoing?.rating ?? 0, ratingDelta: 0, outgoingMatchRating: 6.5, momentumDelta: 0 };

  const substitutionMinute = Math.max(1, Math.min(120, Math.floor(Number(minute) || 1)));
  const outgoingMatchRating = getCupPlayerMatchRating(cup, outgoing.id, substitutionMinute) ?? 6.5;
  const ratingDelta = incoming.rating - outgoing.rating;
  const ratingMomentum = clamp(ratingDelta * 0.18, -4, 4);
  const formMomentum = clamp((6.5 - outgoingMatchRating) * 0.9, -2.2, 2.2);
  const freshnessMomentum = substitutionMinute >= 75 ? 1.2 : substitutionMinute >= 60 ? 0.8 : 0.25;
  const momentumDelta = Math.round(clamp(ratingMomentum + formMomentum + freshnessMomentum, -4.5, 4.5) * 10) / 10;
  const nextMomentum = Math.round(clamp((Number(cup.matchMomentum) || 0) + momentumDelta, -CUP_MAX_MOMENTUM, CUP_MAX_MOMENTUM) * 10) / 10;
  const allTimeAppearances = { ...(cup.allTimeAppearances ?? {}) };
  allTimeAppearances[incoming.id] = Math.max(0, Math.floor(Number(allTimeAppearances[incoming.id]) || 0)) + 1;
  const ratingLabel = `${ratingDelta >= 0 ? "+" : ""}${ratingDelta} OVR`;
  const momentumLabel = `${momentumDelta >= 0 ? "+" : ""}${momentumDelta.toFixed(1)}`;
  return {
    cup: { ...cup, matchMomentum: nextMomentum, allTimeAppearances, matchPaused: false, lastResult: `Wechsel: ${incoming.name} für ${outgoing.name}. ${ratingLabel} · Momentum ${momentumLabel}.` },
    incomingRating: incoming.rating,
    outgoingRating: outgoing.rating,
    ratingDelta,
    outgoingMatchRating,
    momentumDelta,
  };
}

export function getStarXIEffectiveMatchRating(ownedIds: string[], lineupIds: string[], cup: CupState, minute: number) {
  const sentOff = new Set(cup.sentOffPlayerIds);
  const injured = new Set(Object.entries(cup.injuredPlayerIds ?? {}).filter(([, matches]) => Number(matches) > 0).map(([playerId]) => playerId));
  const starters = getStarXISelection(ownedIds, lineupIds).filter((player) => !sentOff.has(player.id) && !injured.has(player.id));
  if (!starters.length) return 55;
  const missing = STAR_XI_SQUAD_SIZE - starters.length;
  const effectiveTotal = starters.reduce((total, player) => {
    const liveForm = getCupPlayerMatchRating(cup, player.id, minute) ?? 6.4;
    return total + player.rating + (liveForm - 6.5) * 2.8;
  }, missing * 55);
  const squadRating = Math.round((effectiveTotal / STAR_XI_SQUAD_SIZE) * 10) / 10;
  const momentumRating = (Number(cup.matchMomentum) || 0) * CUP_MOMENTUM_RATING_WEIGHT;
  return clamp(squadRating - sentOff.size * RED_CARD_MATCH_RATING_DROP - injured.size * 3 + momentumRating, 40, 100);
}

export function getStarPack(id: string) {
  return STAR_PACKS.find((pack) => pack.id === id);
}

export function getTournament(id: string) {
  return TOURNAMENTS.find((tournament) => tournament.id === id);
}

function boundedRandom(random: () => number) {
  const value = Number(random());
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
}

export function getTournamentOpponentSchedule(tournament: TournamentDefinition, random = Math.random) {
  const shuffled = [...tournament.opponents];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(boundedRandom(random) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, tournament.rounds).map((opponent) => opponent.id);
}

function getTournamentOpponentById(tournament: TournamentDefinition, opponentId: string | undefined) {
  return opponentId ? tournament.opponents.find((opponent) => opponent.id === opponentId) : undefined;
}

function getTournamentOpponentAt(tournament: TournamentDefinition, round: number, opponentIds: readonly string[] = [], savedName = "", savedRating = 0, allowSavedOpponent = true) {
  const scheduledOpponent = getTournamentOpponentById(tournament, opponentIds[round]);
  if (scheduledOpponent) return scheduledOpponent;
  const savedOpponent = allowSavedOpponent
    ? tournament.opponents.find((opponent) => opponent.name === savedName) ?? tournament.opponents.find((opponent) => savedRating > 0 && opponent.rating === savedRating)
    : undefined;
  const alreadyUsed = new Set(opponentIds.slice(0, Math.max(0, round)));
  const unusedOpponent = tournament.opponents.find((opponent) => !alreadyUsed.has(opponent.id));
  return savedOpponent ?? unusedOpponent ?? tournament.opponents[Math.min(Math.max(0, round), tournament.opponents.length - 1)] ?? tournament.opponents[0];
}

function normalizeTournamentOpponentSchedule(value: unknown, tournament: TournamentDefinition, round: number, savedName: string, savedRating: number, matchActive: boolean, pendingNextRound: boolean) {
  if (!matchActive && !pendingNextRound) return [];
  const validIds = new Set(tournament.opponents.map((opponent) => opponent.id));
  const rawIds = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && validIds.has(id)) : [];
  const savedOpponent = tournament.opponents.find((opponent) => opponent.name === savedName) ?? tournament.opponents.find((opponent) => savedRating > 0 && opponent.rating === savedRating);
  const uniqueIds = [...new Set(rawIds)];
  const currentOpponentId = matchActive ? rawIds[round] ?? savedOpponent?.id : undefined;
  const previousOpponentId = pendingNextRound ? rawIds[round - 1] ?? savedOpponent?.id : undefined;
  const reservedIds = new Set([currentOpponentId, previousOpponentId].filter((id): id is string => Boolean(id)));
  const schedule = uniqueIds.filter((id) => !reservedIds.has(id));
  for (const opponent of tournament.opponents) {
    if (schedule.length >= tournament.rounds) break;
    if (!schedule.includes(opponent.id) && !reservedIds.has(opponent.id)) schedule.push(opponent.id);
  }
  if (previousOpponentId) {
    schedule.splice(Math.min(Math.max(0, round - 1), schedule.length), 0, previousOpponentId);
  }
  if (currentOpponentId) {
    schedule.splice(Math.min(Math.max(0, round), schedule.length), 0, currentOpponentId);
  }
  return schedule.slice(0, tournament.rounds);
}

function getCupOpponent(cup: CupState, tournament: TournamentDefinition) {
  if (cup.mode === "season") {
    return {
      id: cup.opponentIds[0] ?? "season-opponent-1",
      name: cup.opponent || "Unbekannter Gegner",
      rating: Math.max(40, Math.min(99, cup.opponentRating || 54)),
      strategyId: cup.opponentStrategyId || "ballbesitz",
      scorers: [] as readonly string[],
    };
  }
  return getTournamentOpponentAt(tournament, cup.round, cup.opponentIds, cup.opponent, cup.opponentRating);
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
  const opponent = getCupOpponent(cup, tournament);
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
  return { packId: pack.id, packName: pack.label, player, duplicate, fragmentCompensation: duplicate ? getStarXIFragmentCompensation(player) : 0 };
}

function startTournamentRound(cup: CupState, tournament: TournamentDefinition, round: number, now: number, resetStrategy = false, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, allowSavedOpponent = true): CupState {
  const opponent = getTournamentOpponentAt(tournament, round, cup.opponentIds, cup.opponent, cup.opponentRating, allowSavedOpponent);
  const playerEnteredAt = Object.fromEntries(homePlayers.map((player) => [player.id, 1]));
  const playerMatchPositions = Object.fromEntries(homePlayers.map((player, index) => [player.id, formationPositions[index] ?? player.position])) as Record<string, StarPosition>;
  const allTimeAppearances = { ...(cup.allTimeAppearances ?? {}) };
  homePlayers.forEach((player) => {
    allTimeAppearances[player.id] = Math.max(0, Math.floor(Number(allTimeAppearances[player.id]) || 0)) + 1;
  });
  return {
    ...cup,
    mode: "tournament",
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
    opponentIds: [...cup.opponentIds],
    strategyId: resetStrategy ? "konter" : cup.strategyId,
    substitutionsUsed: 0,
    matchMomentum: 0,
    playerEnteredAt,
    playerExitedAt: {},
    playerMatchPositions,
    lastGoal: null,
    lastInjury: null,
    matchEvents: [],
    cardEvents: [],
    injuryEvents: [],
    sentOffPlayerIds: [],
    matchPaused: false,
    penaltyHomeScore: 0,
    penaltyAwayScore: 0,
    penaltyHomeTaken: 0,
    penaltyAwayTaken: 0,
    penaltyTurn: "home",
    penaltyEvents: [],
    penaltyMessage: "",
    allTimeAppearances,
    lastResult: `Runde ${round + 1} von ${tournament.rounds} gegen ${opponent.name} beginnt.`,
  };
}

export function beginCupMatch(cup: CupState, now = Date.now(), tournamentId = cup.tournamentId, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, originalLineupIds: readonly string[] = homePlayers.map((player) => player.id), originalBenchIds: readonly string[] = [], random = Math.random): CupState {
  const tournament = getTournament(tournamentId) ?? TOURNAMENTS[0];
  if (!cup.pendingNextRound && cup.nextTournamentAt > now) return cup;
  if (cup.pendingNextRound && cup.tournamentId === tournament.id && cup.round < tournament.rounds) {
    const hasStoredOpponentPlan = cup.opponentIds.some((opponentId) => tournament.opponents.some((opponent) => opponent.id === opponentId));
    const opponentIds = normalizeTournamentOpponentSchedule(cup.opponentIds, tournament, cup.round, hasStoredOpponentPlan ? "" : cup.opponent, hasStoredOpponentPlan ? 0 : cup.opponentRating, false, true);
    return startTournamentRound({
      ...cup,
      pendingNextRound: false,
      opponentIds,
      suspendedPlayerIds: [],
      originalLineupIds: [...originalLineupIds],
      originalBenchIds: [...originalBenchIds],
    }, tournament, cup.round, now, false, homePlayers, formationPositions, false);
  }
  const opponentIds = getTournamentOpponentSchedule(tournament, random);
  return startTournamentRound({ ...cup, round: 0, opponentIds, pendingNextRound: false, nextTournamentAt: 0, suspendedPlayerIds: [], originalLineupIds: [...originalLineupIds], originalBenchIds: [...originalBenchIds] }, tournament, 0, now, true, homePlayers, formationPositions);
}

export function beginSeasonCupMatch(cup: CupState, seasonValue: unknown, now = Date.now(), homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, originalLineupIds: readonly string[] = homePlayers.map((player) => player.id), originalBenchIds: readonly string[] = []): CupState {
  const season = normalizeSeasonModeState(seasonValue);
  const opponent = getSeasonModeNextOpponent(season);
  const playerEnteredAt = Object.fromEntries(homePlayers.map((player) => [player.id, 1]));
  const playerMatchPositions = Object.fromEntries(homePlayers.map((player, index) => [player.id, formationPositions[index] ?? player.position])) as Record<string, StarPosition>;
  const allTimeAppearances = { ...(cup.allTimeAppearances ?? {}) };
  homePlayers.forEach((player) => {
    allTimeAppearances[player.id] = Math.max(0, Math.floor(Number(allTimeAppearances[player.id]) || 0)) + 1;
  });
  return {
    ...cup,
    mode: "season",
    tournamentId: "stadium",
    round: 0,
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
    opponentIds: [opponent.id],
    strategyId: cup.strategyId,
    substitutionsUsed: 0,
    matchMomentum: 0,
    originalLineupIds: [...originalLineupIds],
    originalBenchIds: [...originalBenchIds],
    playerEnteredAt,
    playerExitedAt: {},
    playerMatchPositions,
    lastGoal: null,
    lastInjury: null,
    matchEvents: [],
    cardEvents: [],
    injuryEvents: [],
    sentOffPlayerIds: [],
    suspendedPlayerIds: [],
    matchPaused: false,
    pendingNextRound: false,
    nextTournamentAt: 0,
    penaltyHomeScore: 0,
    penaltyAwayScore: 0,
    penaltyHomeTaken: 0,
    penaltyAwayTaken: 0,
    penaltyTurn: "home",
    penaltyEvents: [],
    penaltyMessage: "",
    allTimeAppearances,
    lastResult: `Spieltag ${season.matchday + 1} von ${SEASON_MODE_MATCHES_PER_SEASON} gegen ${opponent.name} beginnt.`,
  };
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

function selectRedCardedPlayer(homePlayers: readonly StarXIPlayer[], formationPositions: readonly StarPosition[], random: () => number) {
  const candidates = homePlayers.map((player, index) => {
    const position = formationPositions[index] ?? player.position;
    const ratingRisk = 1 + (100 - clamp(player.rating, 67, 100)) / 45;
    return { player, weight: (DEFENSIVE_FAULT_WEIGHTS[position] ?? 0.2) * ratingRisk };
  });
  return selectWeightedPlayer(candidates, random);
}

function getRedCardReason(position: StarPosition, random: () => number) {
  const reasons = position === "TW"
    ? ["Handspiel ausserhalb des Strafraums", "Notbremse"]
    : position === "IV" || position === "LV" || position === "LAV" || position === "RV" || position === "RAV" || position === "ZDM"
      ? ["Notbremse", "grobes Foulspiel", "Tätlichkeit"]
      : ["grobes Foulspiel", "Tätlichkeit", "Handspiel auf der Linie"];
  const index = Math.floor(clamp(random(), 0, 0.999999) * reasons.length);
  return reasons[index] ?? reasons[0];
}

function selectInjuredPlayer(homePlayers: readonly StarXIPlayer[], formationPositions: readonly StarPosition[], random: () => number) {
  const candidates = homePlayers.map((player, index) => {
    const position = formationPositions[index] ?? player.position;
    const positionRisk = position === "TW" ? 0.65 : position === "IV" || position === "LV" || position === "LAV" || position === "RV" || position === "RAV" ? 1.25 : position === "ZDM" || position === "ZM" ? 1.1 : 0.9;
    const ratingRisk = 0.85 + (100 - clamp(player.rating, 67, 100)) / 100;
    return { player, weight: positionRisk * ratingRisk };
  });
  return selectWeightedPlayer(candidates, random);
}

function getInjuryReason(position: StarPosition, random: () => number) {
  const reasons = position === "TW"
    ? ["bei einer Parade umgeknickt", "mit dem Pfosten diskutiert und verloren", "nach einer spektakulären Landung liegen geblieben"]
    : position === "IV" || position === "LV" || position === "LAV" || position === "RV" || position === "RAV"
      ? ["nach einem Zweikampf am Boden geblieben", "die Wade zugemacht", "beim Klärungsversuch falsch aufgetreten"]
      : ["einen Sprint etwas zu ernst genommen", "beim Pressing die Muskulatur überredet", "nach einem Dribbling medizinische Hilfe angefordert"];
  return reasons[Math.floor(clamp(random(), 0, 0.999999) * reasons.length)] ?? reasons[0];
}

function decrementCupInjuries(injuredPlayerIds: Record<string, number>) {
  return Object.fromEntries(Object.entries(injuredPlayerIds).map(([playerId, matches]) => [playerId, Math.max(0, Math.floor(Number(matches) || 0) - 1)]).filter(([, matches]) => matches > 0));
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
    totalRounds: cup.mode === "season" ? 1 : tournament.rounds,
    teamStrength: strength.teamStrength,
    opponentStrength: strength.opponentStrength,
    tacticalOutcome: strength.tactical.label,
  };
}

function finishCupRound(cup: CupState, starRating: number, won: boolean, now: number, tieBreak: boolean) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const baseResult = getCupBaseResult(cup, starRating);
  const round = cup.round;
  const completedRound = round + 1;
  if (cup.mode === "season") {
    const nextCup: CupState = {
      ...cup,
      active: false,
      phase: "regular",
      pendingNextRound: false,
      nextTournamentAt: 0,
      round: 0,
      injuredPlayerIds: decrementCupInjuries(cup.injuredPlayerIds ?? {}),
      matchPaused: false,
      lastResult: `${cup.homeScore}:${cup.awayScore} gegen ${cup.opponent} beendet.`,
    };
    return { cup: nextCup, ...baseResult, finished: true, won, tieBreak, tournamentWon: false, runEnded: true, nextRoundStarted: false, completedRound: 1, seasonMatch: true };
  }
  const tournamentWon = won && completedRound >= tournament.rounds;
  const decisionLabel = tieBreak ? " im Elfmeterschiessen" : cup.phase === "extra-time" ? " nach Verlängerung" : "";
  const nextCup: CupState = {
    ...cup,
    wins: cup.wins + (won ? 1 : 0),
    best: Math.max(cup.best, won ? completedRound : round),
    injuredPlayerIds: decrementCupInjuries(cup.injuredPlayerIds ?? {}),
    matchPaused: false,
  };

  if (won && !tournamentWon) {
    nextCup.active = false;
    nextCup.pendingNextRound = true;
    nextCup.nextTournamentAt = 0;
    nextCup.round = completedRound;
    const suspendedNames = nextCup.suspendedPlayerIds.map((playerId) => getStarXIPlayer(playerId)?.name).filter((name): name is string => Boolean(name));
    const replacementRequired = nextCup.suspendedPlayerIds.length > 0;
    nextCup.lastResult = replacementRequired
      ? `Runde ${completedRound}${decisionLabel} gewonnen. ${suspendedNames.join(", ") || "Ein Spieler"} muss vor der nächsten Partie ersetzt werden.`
      : `Runde ${completedRound}${decisionLabel} gewonnen. Passe deine Aufstellung an und starte Runde ${completedRound + 1} manuell.`;
    return { cup: nextCup, ...baseResult, finished: true, won: true, tieBreak, nextRoundStarted: false, completedRound, replacementRequired };
  }

  nextCup.active = false;
  nextCup.pendingNextRound = false;
  nextCup.nextTournamentAt = now + TOURNAMENT_COOLDOWN_MS;
  nextCup.round = 0;
  if (tournamentWon) nextCup.trophies = { ...nextCup.trophies, [tournament.id]: nextCup.trophies[tournament.id] + 1 };
  nextCup.lastResult = tournamentWon
    ? `${tournament.trophyName}${decisionLabel} gewonnen! Der temporäre Goalboost ist aktiv.`
    : `Turnieraus in Runde ${completedRound} gegen ${cup.opponent}${decisionLabel}.`;
  return { cup: nextCup, ...baseResult, finished: true, won, tieBreak, tournamentWon, runEnded: true, completedRound };
}

export function advanceCupMatch(cup: CupState, starRating: number, now = Date.now(), random = Math.random, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const opponent = getCupOpponent(cup, tournament);
  const baseResult = getCupBaseResult(cup, starRating);
  if (!cup.active) return { cup, ...baseResult };
  if (cup.matchPaused) return { cup, ...baseResult };
  if (cup.phase === "penalties") return { cup, ...baseResult };
  const endAt = Math.max(cup.matchStartedAt, Math.min(now, cup.matchEndsAt));
  const from = Math.max(cup.matchStartedAt, Math.min(cup.lastTickAt || cup.matchStartedAt, endAt));
  const phaseSeconds = cup.phase === "extra-time" ? CUP_EXTRA_TIME_DURATION_MS / 1000 : CUP_MATCH_DURATION_MS / 1000;
  const seconds = Math.min(phaseSeconds, Math.max(0, Math.floor((endAt - from) / 1000)));
  let homeScore = cup.homeScore;
  let awayScore = cup.awayScore;
  let lastGoal = cup.lastGoal;
  let lastInjury = cup.lastInjury;
  let matchEvents = [...cup.matchEvents];
  let cardEvents = [...cup.cardEvents];
  let injuryEvents = [...cup.injuryEvents];
  const sentOffPlayerIds = [...cup.sentOffPlayerIds];
  const suspendedPlayerIds = [...cup.suspendedPlayerIds];
  const injuredPlayerIds = { ...(cup.injuredPlayerIds ?? {}) };
  const playerExitedAt = { ...cup.playerExitedAt };
  let activeHomePlayers = homePlayers.filter((player) => !sentOffPlayerIds.includes(player.id) && !(Number(injuredPlayerIds[player.id]) > 0));
  const allTimeScorers = { ...cup.allTimeScorers };
  let lastResult = cup.lastResult;
  let currentStarRating = starRating;
  let matchMomentum = clamp(Number(cup.matchMomentum) || 0, -CUP_MAX_MOMENTUM, CUP_MAX_MOMENTUM);
  let matchPaused = false;
  let processedUntil = endAt;
  const getScoringChances = (liveStarRating: number) => {
    const liveStrength = getCupMatchStrength(cup, liveStarRating);
    const liveStrengthDifference = liveStrength.teamStrength - liveStrength.opponentStrength;
    const homeExpectedGoals = clamp(0.55 + liveStrength.teamStrength * 0.014 + liveStrengthDifference * 0.07, 0.15, 5.2);
    const awayExpectedGoals = clamp(0.55 + liveStrength.opponentStrength * 0.014 - liveStrengthDifference * 0.07, 0.15, 5.2);
    return { homeChance: homeExpectedGoals / 180, awayChance: awayExpectedGoals / 180 };
  };
  let { homeChance, awayChance } = getScoringChances(currentStarRating);
  for (let second = 0; second < seconds; second += 1) {
    let redCardOccurred = false;
    const goalAt = from + (second + 1) * 1000;
    processedUntil = goalAt;
    const minute = Math.min(120, Math.max(1, Math.floor((goalAt - cup.matchStartedAt) / 2000) + 1));
    if (activeHomePlayers.length && !sentOffPlayerIds.length && random() < RED_CARD_CHANCE_PER_SECOND) {
      const redCardedPlayer = selectRedCardedPlayer(activeHomePlayers, formationPositions, random);
      if (redCardedPlayer) {
        const redCardedPlayerIndex = homePlayers.findIndex((player) => player.id === redCardedPlayer.id);
        const redCardReason = getRedCardReason(formationPositions[redCardedPlayerIndex] ?? redCardedPlayer.position, random);
        sentOffPlayerIds.push(redCardedPlayer.id);
        suspendedPlayerIds.push(redCardedPlayer.id);
        playerExitedAt[redCardedPlayer.id] = minute;
        const cardEvent: CupCardEvent = { id: `${goalAt}-${redCardedPlayer.id}-red`, side: "home", playerId: redCardedPlayer.id, player: redCardedPlayer.name, reason: redCardReason, card: "red", minute, createdAt: goalAt, homeScore, awayScore };
        cardEvents = [...cardEvents, cardEvent].slice(-12);
        activeHomePlayers = activeHomePlayers.filter((player) => player.id !== redCardedPlayer.id);
        matchMomentum = clamp(matchMomentum - CUP_RED_CARD_MOMENTUM_DROP, -CUP_MAX_MOMENTUM, CUP_MAX_MOMENTUM);
        currentStarRating = Math.max(40, currentStarRating - RED_CARD_MATCH_RATING_DROP - CUP_RED_CARD_MOMENTUM_DROP * CUP_MOMENTUM_RATING_WEIGHT);
        ({ homeChance, awayChance } = getScoringChances(currentStarRating));
        redCardOccurred = true;
        lastResult = `Rote Karte für ${redCardedPlayer.name}. Das Momentum kippt, dein Team ist in Unterzahl. Die nächste Partie darf erst nach einem Ersatz starten.`;
      }
    }
    const injuryRoll = random();
    if (!redCardOccurred && activeHomePlayers.length && cup.substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS && injuryRoll > 0 && injuryRoll < CUP_INJURY_CHANCE_PER_SECOND) {
      const injuredPlayer = selectInjuredPlayer(activeHomePlayers, formationPositions, random);
      if (injuredPlayer) {
        const injuredIndex = homePlayers.findIndex((player) => player.id === injuredPlayer.id);
        const injuryMatches = CUP_MIN_INJURY_MATCHES + Math.floor(clamp(random(), 0, 0.999999) * (CUP_MAX_INJURY_MATCHES - CUP_MIN_INJURY_MATCHES + 1));
        const injuryEvent: CupInjuryEvent = {
          id: `${goalAt}-${injuredPlayer.id}-injury`,
          playerId: injuredPlayer.id,
          player: injuredPlayer.name,
          reason: getInjuryReason(formationPositions[injuredIndex] ?? injuredPlayer.position, random),
          matches: injuryMatches,
          minute,
          createdAt: goalAt,
          homeScore,
          awayScore,
        };
        injuredPlayerIds[injuredPlayer.id] = Math.max(Number(injuredPlayerIds[injuredPlayer.id]) || 0, injuryMatches);
        playerExitedAt[injuredPlayer.id] = minute;
        injuryEvents = [...injuryEvents, injuryEvent].slice(-12);
        lastInjury = injuryEvent;
        activeHomePlayers = activeHomePlayers.filter((player) => player.id !== injuredPlayer.id);
        matchPaused = true;
        currentStarRating = Math.max(40, currentStarRating - 5);
        lastResult = `${injuredPlayer.name} ist verletzt (${injuryMatches} ${injuryMatches === 1 ? "Spiel" : "Spiele"}). Das Spiel ist pausiert. Ersetze den Spieler manuell.`;
        break;
      }
    }
    const roll = random();
    if (roll < homeChance) {
      homeScore += 1;
      const scorer = selectHomeScorer(activeHomePlayers, cup, minute, random, formationPositions, matchEvents);
      const assist = selectHomeAssist(activeHomePlayers, scorer?.id, formationPositions, random);
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
      const ratingImpacts = getConcededGoalRatingImpacts(activeHomePlayers, formationPositions, random);
      lastGoal = { id: `${goalAt}-${homeScore}-${awayScore}-away`, side: "away", scorerId: null, scorer, minute, createdAt: goalAt, homeScore, awayScore, ratingImpacts };
      matchEvents = [...matchEvents, lastGoal].slice(-40);
    }
  }
  const nextCup = { ...cup, homeScore, awayScore, lastTickAt: matchPaused ? processedUntil : endAt, lastGoal, lastInjury, matchEvents, cardEvents, injuryEvents, sentOffPlayerIds, suspendedPlayerIds, injuredPlayerIds, playerExitedAt, allTimeScorers, lastResult, matchMomentum: Math.round(matchMomentum * 10) / 10, matchPaused };
  const liveBaseResult = getCupBaseResult(cup, currentStarRating);
  if (matchPaused) return { cup: nextCup, ...liveBaseResult };
  if (now < cup.matchEndsAt) return { cup: nextCup, ...liveBaseResult };
  if (homeScore !== awayScore) return finishCupRound(nextCup, currentStarRating, homeScore > awayScore, now, false);

  if (cup.phase === "regular") {
    return {
      cup: {
        ...nextCup,
        phase: "extra-time" as const,
        matchEndsAt: cup.matchEndsAt + CUP_EXTRA_TIME_DURATION_MS,
        lastResult: "90 Minuten vorbei. Es geht bis 120′ in die Verlängerung.",
      },
      ...liveBaseResult,
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
    ...liveBaseResult,
  };
}

export function resumeCupMatch(value: CupState) {
  if (!value.active || !value.matchPaused) return value;
  return { ...value, matchPaused: false, lastResult: "Die Partie läuft weiter. Die medizinische Abteilung beobachtet den Rest von der Seitenlinie." };
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
  const opponent = getCupOpponent(cup, tournament);
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
  return finishCupRound(nextCup, starRating, winner, now, true);
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
    starXI: { ownedIds: [], fragments: 0, lineupIds: Array.from({ length: STAR_XI_SQUAD_SIZE }, () => ""), benchIds: Array.from({ length: STAR_XI_BENCH_SIZE }, () => ""), formationId: "433", formationPositions: [...STAR_XI_FORMATION_POSITIONS] },
    club: { name: "FC Goal", badge: "⚽", color: "#0071e3" },
    cup: { active: false, mode: "season", phase: "regular", tournamentId: "stadium", round: 0, wins: 0, best: 0, trophies: { stadium: 0, champions: 0, world: 0 }, lastResult: "Noch kein Saisonspiel.", matchStartedAt: 0, matchEndsAt: 0, lastTickAt: 0, homeScore: 0, awayScore: 0, opponent: "", opponentRating: 58, opponentStrategyId: "ballbesitz", opponentIds: [], strategyId: "konter", substitutionsUsed: 0, matchMomentum: 0, originalLineupIds: [], originalBenchIds: [], playerEnteredAt: {}, playerExitedAt: {}, playerMatchPositions: {}, lastGoal: null, lastInjury: null, matchEvents: [], cardEvents: [], injuryEvents: [], sentOffPlayerIds: [], suspendedPlayerIds: [], injuredPlayerIds: {}, matchPaused: false, pendingNextRound: false, nextTournamentAt: 0, penaltyHomeScore: 0, penaltyAwayScore: 0, penaltyHomeTaken: 0, penaltyAwayTaken: 0, penaltyTurn: "home", penaltyEvents: [], penaltyMessage: "", allTimeScorers: {}, allTimeAppearances: {} },
    seasonMode: initialSeasonMode("FC Goal"),
    goalBoost: { tournamentId: null, multiplier: 1, startedAt: 0, endsAt: 0 },
    missions: initialMissions(),
    history: [],
    randomEvent: null,
    starPackReveal: null,
    transferSaga: { loans: [], vacancies: [], archive: [], latestEvent: null, lastFailedReason: "", nextAt: now + getTransferEventDelay(), deadlineDayStartedAt: 0, deadlineDayEndsAt: 0 },
    gazetteIssues: [],
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

function normalizeTransferInsiderEvent(value: unknown): TransferInsiderEvent | null {
  const source = asRecord(value);
  const outcome: TransferInsiderOutcome | null = source.outcome === "loan" || source.outcome === "sale" || source.outcome === "failed" || source.outcome === "return" ? source.outcome : null;
  const createdAt = Math.floor(Number(source.createdAt) || 0);
  if (!outcome || createdAt <= 0) return null;
  const playerId = typeof source.playerId === "string" && getStarXIPlayer(source.playerId) ? source.playerId : null;
  return {
    id: safeString(source.id, `transfer-${createdAt}`),
    outcome,
    playerId,
    playerName: typeof source.playerName === "string" && source.playerName.trim() ? source.playerName.trim().slice(0, 120) : playerId ? getStarXIPlayer(playerId)?.name ?? null : null,
    club: safeString(source.club, "Transfermarkt").slice(0, 42),
    headline: safeString(source.headline, "Transfermeldung").slice(0, 80),
    message: safeString(source.message, "Der Transfermarkt bewegt sich.").slice(0, 360),
    reason: typeof source.reason === "string" ? source.reason.trim().slice(0, 160) : "",
    fee: Math.max(0, Math.floor(Number(source.fee) || 0)),
    createdAt,
  };
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

function normalizeCupCardEvent(value: unknown): CupCardEvent | null {
  const source = asRecord(value);
  if (typeof source.id !== "string" || (source.side !== "home" && source.side !== "away") || source.card !== "red" || Number(source.createdAt) <= 0) return null;
  const playerId = typeof source.playerId === "string" && getStarXIPlayer(source.playerId) ? source.playerId : null;
  return {
    id: safeString(source.id, "red-card-event"),
    side: source.side,
    playerId,
    player: safeString(source.player, playerId ? getStarXIPlayer(playerId)?.name ?? "Spieler" : "Spieler"),
    reason: safeString(source.reason, "grobes Foulspiel").slice(0, 90),
    card: "red",
    minute: Math.max(1, Math.min(120, Math.floor(Number(source.minute) || 1))),
    createdAt: Math.floor(Number(source.createdAt)),
    homeScore: Math.max(0, Math.floor(Number(source.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(source.awayScore) || 0)),
  };
}

function normalizeCupInjuryEvent(value: unknown): CupInjuryEvent | null {
  const source = asRecord(value);
  const playerId = typeof source.playerId === "string" && getStarXIPlayer(source.playerId) ? source.playerId : "";
  if (typeof source.id !== "string" || !playerId || Number(source.createdAt) <= 0) return null;
  return {
    id: safeString(source.id, "injury-event"),
    playerId,
    player: safeString(source.player, getStarXIPlayer(playerId)?.name ?? "Spieler"),
    reason: safeString(source.reason, "musste verletzt vom Platz").slice(0, 110),
    matches: Math.max(CUP_MIN_INJURY_MATCHES, Math.min(CUP_MAX_INJURY_MATCHES, Math.floor(Number(source.matches) || CUP_MIN_INJURY_MATCHES))),
    minute: Math.max(1, Math.min(120, Math.floor(Number(source.minute) || 1))),
    createdAt: Math.floor(Number(source.createdAt)),
    homeScore: Math.max(0, Math.floor(Number(source.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(source.awayScore) || 0)),
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
  const clubName = safeString(club.name, defaults.club.name).slice(0, 22);
  const seasonModeSource = asRecord(source.seasonMode);
  const normalizedSeasonMode = normalizeSeasonModeState(seasonModeSource, clubName, Math.max(0, Math.floor(Number(source.seasons) || 0)));
  const goalBoostSource = asRecord(source.goalBoost);
  const rawMissions = Array.isArray(source.missions) ? source.missions : [];
  const missions = initialMissions().map((mission) => {
    const saved = asRecord(rawMissions.find((item) => asRecord(item).id === mission.id));
    return { ...mission, claimed: saved.claimed === true };
  });
  const history = Array.isArray(source.history) ? source.history.map((item) => asRecord(item)).filter((item) => typeof item.title === "string").slice(-30).map((item, index) => ({
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
  const transferSagaSource = asRecord(source.transferSaga);
  const knownStarOwnedIds = uniqueKnownStarIds(starXI.ownedIds);
  const seenLoanIds = new Set<string>();
  const loans = (Array.isArray(transferSagaSource.loans) ? transferSagaSource.loans : [])
    .map((item) => asRecord(item))
    .filter((item) => typeof item.playerId === "string" && knownStarOwnedIds.includes(item.playerId) && !seenLoanIds.has(item.playerId) && Boolean(getStarXIPlayer(item.playerId)))
    .map((item) => {
      const playerId = String(item.playerId);
      seenLoanIds.add(playerId);
      const tournamentId = item.status === "active" ? getTournament(String(item.tournamentId))?.id ?? null : null;
      return {
        playerId,
        club: safeString(item.club, "Auswärtiger Club").slice(0, 42),
        status: item.status === "active" ? "active" as const : "pending" as const,
        tournamentId,
        createdAt: Math.max(1, Math.floor(Number(item.createdAt) || Date.now())),
      };
    });
  const latestTransferEvent = normalizeTransferInsiderEvent(transferSagaSource.latestEvent);
  const archiveIds = new Set<string>();
  const transferArchive = (Array.isArray(transferSagaSource.archive) ? transferSagaSource.archive : [])
    .map(normalizeTransferInsiderEvent)
    .filter((event): event is TransferInsiderEvent => Boolean(event) && event.outcome !== "failed")
    .filter((event) => {
      if (archiveIds.has(event.id)) return false;
      archiveIds.add(event.id);
      return true;
    })
    .slice(-30);
  const deadlineDayStartedAt = Math.max(0, Math.floor(Number(transferSagaSource.deadlineDayStartedAt) || 0));
  const deadlineDayEndsAt = Math.max(deadlineDayStartedAt, Math.floor(Number(transferSagaSource.deadlineDayEndsAt) || 0));
  const transferSaga: TransferSagaState = {
    loans,
    vacancies: (Array.isArray(transferSagaSource.vacancies) ? transferSagaSource.vacancies : []).map((item) => asRecord(item)).filter((item) => item.area === "lineup" || item.area === "bench").map((item) => ({
      area: item.area as TransferSquadVacancy["area"],
      index: Math.floor(Number(item.index)),
      requiredPlayers: Math.max(1, Math.min(STAR_XI_SQUAD_SIZE + STAR_XI_BENCH_SIZE, Math.floor(Number(item.requiredPlayers) || 1))),
      createdAt: Math.max(1, Math.floor(Number(item.createdAt) || Date.now())),
    })).filter((item) => item.index >= 0 && item.index < (item.area === "lineup" ? STAR_XI_SQUAD_SIZE : STAR_XI_BENCH_SIZE)).slice(-20),
    archive: transferArchive,
    latestEvent: latestTransferEvent,
    lastFailedReason: typeof transferSagaSource.lastFailedReason === "string" ? transferSagaSource.lastFailedReason.trim().slice(0, 160) : latestTransferEvent?.outcome === "failed" ? latestTransferEvent.reason : "",
    nextAt: Number(transferSagaSource.nextAt) > 0 ? Number(transferSagaSource.nextAt) : defaults.transferSaga.nextAt,
    deadlineDayStartedAt,
    deadlineDayEndsAt,
  };
  const starPackRevealSource = asRecord(source.starPackReveal);
  const starPack = getStarPack(String(starPackRevealSource.packId));
  const starPlayerSource = asRecord(starPackRevealSource.player);
  const starPlayer = getStarXIPlayer(String(starPlayerSource.id));
  const starPackReveal = starPack && starPlayer && Number(starPackRevealSource.openedAt) > 0 ? {
    packId: starPack.id,
    packName: safeString(starPackRevealSource.packName, starPack.label).slice(0, 32),
    player: starPlayer,
    duplicate: starPackRevealSource.duplicate === true,
    fragmentCompensation: Math.max(0, Math.floor(Number(starPackRevealSource.fragmentCompensation) || 0)),
    source: starPackRevealSource.source === "custom-draw" ? "custom-draw" : "pack",
    openedAt: Math.floor(Number(starPackRevealSource.openedAt)),
    openedBy: safeString(starPackRevealSource.openedBy, "Mitspieler").slice(0, 22),
    troll: starPackRevealSource.troll === true,
  } satisfies StarPackReveal : null;
  const gazetteIssues = (Array.isArray(source.gazetteIssues) ? source.gazetteIssues : [])
    .map((item) => asRecord(item))
    .map((item): TournamentGazetteIssue | null => {
      const tournamentId = getTournament(String(item.tournamentId))?.id;
      const createdAt = Math.floor(Number(item.createdAt) || 0);
      if (!tournamentId || createdAt <= 0) return null;
      return {
        id: safeString(item.id, `gazette-${createdAt}`),
        headline: safeString(item.headline, "DAS TURNIER IST ENTSCHEIDEN").slice(0, 100),
        strapline: safeString(item.strapline, "Die Goal Gazette berichtet.").slice(0, 180),
        body: safeString(item.body, "Ein Turnier voller Geschichten ist beendet.").slice(0, 420),
        tone: item.tone === "champion" ? "champion" : "exit",
        tournamentId,
        opponent: safeString(item.opponent, "Unbekannter Gegner").slice(0, 80),
        homeScore: Math.max(0, Math.floor(Number(item.homeScore) || 0)),
        awayScore: Math.max(0, Math.floor(Number(item.awayScore) || 0)),
        completedRound: Math.max(1, Math.floor(Number(item.completedRound) || 1)),
        tieBreak: item.tieBreak === true,
        createdAt,
      };
    })
    .filter((issue): issue is TournamentGazetteIssue => Boolean(issue))
    .slice(-12);
  const ownedIds = Array.isArray(market.ownedIds) ? market.ownedIds.filter((id): id is string => typeof id === "string" && TRANSFER_PLAYERS.some((player) => player.id === id)) : [];
  const offerIds = Array.isArray(market.offerIds) ? market.offerIds.filter((id): id is string => typeof id === "string" && TRANSFER_PLAYERS.some((player) => player.id === id)).slice(0, 3) : [];
  const matchStartedAt = Math.max(0, Number(cup.matchStartedAt) || 0);
  const matchEndsAt = Math.max(0, Number(cup.matchEndsAt) || 0);
  const lastTickAt = Math.max(matchStartedAt, Number(cup.lastTickAt) || matchStartedAt);
  const matchMomentum = Math.round(clamp(Number(cup.matchMomentum) || 0, -CUP_MAX_MOMENTUM, CUP_MAX_MOMENTUM) * 10) / 10;
  const lastGoal = normalizeCupGoalEvent(cup.lastGoal);
  const lastInjury = normalizeCupInjuryEvent(cup.lastInjury);
  const matchEvents = Array.isArray(cup.matchEvents) ? cup.matchEvents.map(normalizeCupGoalEvent).filter((event): event is CupGoalEvent => Boolean(event)).slice(-40) : lastGoal ? [lastGoal] : [];
  const cardEvents = Array.isArray(cup.cardEvents) ? cup.cardEvents.map(normalizeCupCardEvent).filter((event): event is CupCardEvent => Boolean(event)).slice(-12) : [];
  const injuryEvents = Array.isArray(cup.injuryEvents) ? cup.injuryEvents.map(normalizeCupInjuryEvent).filter((event): event is CupInjuryEvent => Boolean(event)).slice(-12) : lastInjury ? [lastInjury] : [];
  const sentOffPlayerIds = uniqueKnownStarIds(cup.sentOffPlayerIds);
  const suspendedPlayerIds = uniqueKnownStarIds(cup.suspendedPlayerIds);
  const injuredPlayerIds = Object.fromEntries(Object.entries(asRecord(cup.injuredPlayerIds)).filter(([playerId, matches]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(matches)) && Number(matches) > 0).map(([playerId, matches]) => [playerId, Math.max(CUP_MIN_INJURY_MATCHES, Math.min(CUP_MAX_INJURY_MATCHES, Math.floor(Number(matches))))]));
  const penaltyEvents = Array.isArray(cup.penaltyEvents) ? cup.penaltyEvents.map(normalizeCupPenaltyEvent).filter((event): event is CupPenaltyEvent => Boolean(event)).slice(-40) : [];
  const allTimeScorers = Object.fromEntries(Object.entries(asRecord(cup.allTimeScorers)).filter(([playerId, goals]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(goals)) && Number(goals) > 0).map(([playerId, goals]) => [playerId, Math.max(0, Math.floor(Number(goals)))]));
  const allTimeAppearances = Object.fromEntries(Object.entries(asRecord(cup.allTimeAppearances)).filter(([playerId, appearances]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(appearances)) && Number(appearances) > 0).map(([playerId, appearances]) => [playerId, Math.max(0, Math.floor(Number(appearances)))]));
  Object.entries(allTimeScorers).forEach(([playerId, goals]) => {
    if (!allTimeAppearances[playerId]) allTimeAppearances[playerId] = goals > 0 ? 1 : 0;
  });
  const mode: CupMatchMode = cup.mode === "tournament" || cup.mode === "season" ? cup.mode : cup.active === true || cup.pendingNextRound === true ? "tournament" : "season";
  const tournament = getTournament(String(cup.tournamentId)) ?? TOURNAMENTS[0];
  const tournamentId = tournament.id;
  const active = cup.active === true && matchEndsAt > 0;
  const pendingNextRound = cup.pendingNextRound === true && !active && (mode === "season" || (Number(cup.round) >= 0 && Number(cup.round) < tournament.rounds));
  const nextTournamentAt = Math.max(0, Math.floor(Number(cup.nextTournamentAt) || 0));
  const loanedPlayerIds = transferSaga.loans.map((loan) => loan.playerId);
  const normalizedStarXI = removeStarXIPlayersFromSquad(normalizeStarXIState(starXI, loanedPlayerIds), [...new Set([...suspendedPlayerIds, ...Object.keys(injuredPlayerIds)])], !active);
  const normalizeSavedSquadSlots = (value: unknown, size: number) => {
    const slots = Array.isArray(value) ? value : [];
    return Array.from({ length: size }, (_, index) => {
      const playerId = slots[index];
      return typeof playerId === "string" && normalizedStarXI.ownedIds.includes(playerId) && !loanedPlayerIds.includes(playerId) && Boolean(getStarXIPlayer(playerId)) ? playerId : "";
    });
  };
  const savedOriginalLineupIds = normalizeSavedSquadSlots(cup.originalLineupIds, STAR_XI_SQUAD_SIZE);
  const originalLineupIds = savedOriginalLineupIds.some(Boolean) ? savedOriginalLineupIds : active ? [...normalizedStarXI.lineupIds] : [];
  const savedOriginalBenchIds = normalizeSavedSquadSlots(cup.originalBenchIds, STAR_XI_BENCH_SIZE);
  const originalBenchIds = savedOriginalBenchIds.some(Boolean) || Array.isArray(cup.originalBenchIds) ? savedOriginalBenchIds : active ? [...normalizedStarXI.benchIds] : [];
  const phase: CupMatchPhase = cup.phase === "extra-time" || cup.phase === "penalties" ? cup.phase : "regular";
  const round = mode === "season" ? 0 : active || pendingNextRound ? Math.max(0, Math.min(tournament.rounds - 1, Math.floor(Number(cup.round) || 0))) : 0;
  const savedOpponentName = safeString(cup.opponent, "");
  const savedOpponentRating = Math.floor(Number(cup.opponentRating) || 0);
  const seasonOpponent = getSeasonModeNextOpponent(normalizedSeasonMode, clubName);
  const opponentIds = mode === "season"
    ? (Array.isArray(cup.opponentIds) ? cup.opponentIds.filter((id): id is string => typeof id === "string").slice(0, 1) : [])
    : normalizeTournamentOpponentSchedule(cup.opponentIds, tournament, round, savedOpponentName, savedOpponentRating, active, pendingNextRound);
  const roundOpponent = mode === "season"
    ? { id: opponentIds[0] ?? seasonOpponent.id, name: savedOpponentName || seasonOpponent.name, rating: savedOpponentRating || seasonOpponent.rating, strategyId: cup.opponentStrategyId === "angriff" || cup.opponentStrategyId === "konter" || cup.opponentStrategyId === "ballbesitz" ? cup.opponentStrategyId : seasonOpponent.strategyId, scorers: [] as readonly string[] }
    : getTournamentOpponentAt(tournament, round, opponentIds, savedOpponentName, savedOpponentRating, active);
  const normalizedOpponentName = mode === "season" ? roundOpponent.name : (active || pendingNextRound) && opponentIds.length ? roundOpponent.name : savedOpponentName || roundOpponent.name;
  const normalizedOpponentRating = mode === "season" ? Math.max(40, Math.min(99, roundOpponent.rating)) : (active || pendingNextRound) && opponentIds.length ? roundOpponent.rating : Math.max(40, Math.min(99, savedOpponentRating || roundOpponent.rating));
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
    club: { name: clubName, badge: CLUB_BADGES.includes(String(club.badge)) ? String(club.badge) : defaults.club.badge, color: CLUB_COLORS.includes(String(club.color)) ? String(club.color) : defaults.club.color },
    cup: { active, mode, phase, tournamentId, round, wins: Math.max(0, Math.floor(Number(cup.wins) || 0)), best: Math.max(0, Math.min(TOURNAMENTS[TOURNAMENTS.length - 1].rounds, Math.floor(Number(cup.best) || 0))), trophies, lastResult: safeString(cup.lastResult, defaults.cup.lastResult), matchStartedAt, matchEndsAt, lastTickAt, homeScore: Math.max(0, Math.floor(Number(cup.homeScore) || 0)), awayScore: Math.max(0, Math.floor(Number(cup.awayScore) || 0)), opponent: normalizedOpponentName, opponentRating: normalizedOpponentRating, opponentStrategyId, opponentIds, strategyId, substitutionsUsed: Math.max(0, Math.min(STAR_XI_MAX_SUBSTITUTIONS, Math.floor(Number(cup.substitutionsUsed) || 0))), matchMomentum, originalLineupIds, originalBenchIds, playerEnteredAt, playerExitedAt, playerMatchPositions, lastGoal, lastInjury, matchEvents, cardEvents, injuryEvents, sentOffPlayerIds, suspendedPlayerIds, injuredPlayerIds, matchPaused: active && cup.matchPaused === true && Boolean(lastInjury), pendingNextRound, nextTournamentAt, penaltyHomeScore: Math.max(0, Math.floor(Number(cup.penaltyHomeScore) || 0)), penaltyAwayScore: Math.max(0, Math.floor(Number(cup.penaltyAwayScore) || 0)), penaltyHomeTaken: Math.max(0, Math.floor(Number(cup.penaltyHomeTaken) || 0)), penaltyAwayTaken: Math.max(0, Math.floor(Number(cup.penaltyAwayTaken) || 0)), penaltyTurn: cup.penaltyTurn === "away" ? "away" : "home", penaltyEvents, penaltyMessage: typeof cup.penaltyMessage === "string" ? cup.penaltyMessage.slice(0, 180) : "", allTimeScorers, allTimeAppearances },
    seasonMode: normalizedSeasonMode,
    goalBoost,
    missions,
    history,
    randomEvent,
    starPackReveal,
    transferSaga,
    gazetteIssues,
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
  features.transferSaga.nextAt += duration;
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

const TRANSFER_INTERESTED_CLUBS = [
  "Real Madreto",
  "FC Barceloneta",
  "Manchester Cité",
  "Bayern Münchan",
  "Liverpuhl FC",
  "Paris Saint German",
  "Inter Milano",
  "Galácticos XI",
  "Arsenal Londra",
  "Atlético Madrido",
] as const;

const TRANSFER_FAILURE_REASONS = [
  "der Medizincheck nicht bestanden wurde",
  "die Gehaltsforderung in letzter Minute zu hoch war",
  "die Unterlagen zu spät eingereicht wurden",
  "der Berater plötzlich nicht mehr erreichbar war",
  "sich die Clubs bei den Bonuszahlungen nicht einigen konnten",
  "der Spieler beim Club bleiben wollte",
  "auf dem Vertrag die falsche Unterschrift stand",
  "der Flug zum Medizincheck annulliert wurde",
  "die Dokumente beim falschen Club landeten",
  "der Trainer sein Veto eingelegt hat",
  "die Bildrechte ungeklärt blieben",
  "die Transferfrist wenige Sekunden vorher ablief",
  "der vorgesehene Tauschspieler abgesagt hat",
  "eine Rückkaufklausel den Abschluss blockierte",
  "das Faxgerät statt des Vertrags nur die Mittagskarte übertragen hat",
  "der Vertrag im Drucker stecken blieb und anschliessend als Konfetti herauskam",
  "der Spieler am Flughafen aus Versehen in den Ferienflieger nach Mallorca stieg",
  "der Berater sein Handy in einem Fondue versenkt hat",
  "Google Maps den Spieler zum Stadion des Erzrivalen geschickt hat",
  "die Vereinskatze über die Tastatur lief und drei Nullen zur Ablöse hinzufügte",
  "der neue Club nur mit Panini Stickern bezahlen wollte",
  "die gewünschte Rückennummer bereits dem Maskottchen gehörte",
  "der Spieler beim Fototermin das Trikot des falschen Clubs anzog",
  "der Präsident beim Unterschreiben einen Stift ohne Tinte erwischte",
  "die Präsentationsdrohne mit dem unterschriebenen Vertrag davongeflogen ist",
  "der Übersetzer Leihe mit Leier verwechselt hat",
  "der Spieler im falschen Gruppenchat schrieb, dass er eigentlich gar nicht wechseln wolle",
  "beim Medizincheck eine Kontaktlinse verloren ging und dadurch die Deadline verpasst wurde",
  "der Transferchef sein Passwort Transfer123 vergessen hat",
  "die Unterschrift versehentlich auf einer Pizzaschachtel statt auf dem Vertrag landete",
  "das Navi den Berater drei Stunden lang im Kreisverkehr festhielt",
  "der Club beim Videoanruf den Katzenfilter nicht mehr ausschalten konnte",
  "der Spieler glaubte, der Medizincheck sei ein Quiz, und nur Fussballfragen gelernt hatte",
  "das Vereinsmaskottchen den Vertrag gefressen hat",
  "die Siegespizza schon vor der Unterschrift geliefert wurde und alle die Deadline vergassen",
  "der Transfer im letzten Moment an einer fehlenden Büroklammer scheiterte",
  "der Spieler nur zugesagt hätte, wenn er Kapitän, Elfmeterspezialist und DJ wird",
  "der Präsident die Ablöse versehentlich in Schweizer Franken statt in Goals eingetragen hat",
  "der Scanner den Vertrag spiegelverkehrt gespeichert hat",
  "die Clublegende aus Versehen auf Ablehnen statt auf Annehmen klickte",
  "das neue Trikot beim Waschen auf Kindergrösse schrumpfte",
  "der Spieler beim Verhandlungstermin in einem Escape Room eingeschlossen war",
] as const;

const GAZETTE_CHAMPION_HEADLINES = [
  "DER POKAL GEHÖRT UNS",
  "DIE NACHT GEHÖRT DEM CLUB",
  "CHAMPIONS AUF DEM RASEN",
  "EIN TURNIER, EIN THRON",
  "DAS STADION BEBT NOCH IMMER",
  "TROPHÄE GESICHERT, STIMME VERLOREN",
  "DER BUS BRAUCHT EIN OFFENES DACH",
  "KONFETTI BIS MORGEN FRÜH",
] as const;

const GAZETTE_EXIT_HEADLINES = [
  "AUS, ABER NICHT LEISE",
  "DER POKAL FÄHRT OHNE UNS",
  "DRAMA BIS ZUM SCHLUSSPFIFF",
  "HEUTE KEIN KONFETTI",
  "DIE KABINE IST VERDÄCHTIG STILL",
  "KNAPP DANEBEN IST AUCH VORBEI",
  "DER TRAUM MACHT EINE PAUSE",
  "ROMARIO SUCHT SCHON VERSTÄRKUNG",
] as const;

function transferRandomIndex(length: number, random: () => number) {
  if (length <= 1) return 0;
  return Math.floor(clamp(random(), 0, 0.999999) * length);
}

function getNextTransferFailureReason(previousReason: string, random: () => number) {
  const available = TRANSFER_FAILURE_REASONS.filter((reason) => reason !== previousReason);
  return available[transferRandomIndex(available.length, random)] ?? TRANSFER_FAILURE_REASONS[0];
}

function appendTransferArchive(features: GameFeatures, event: TransferInsiderEvent) {
  if (event.outcome === "failed") return;
  features.transferSaga.archive = [...features.transferSaga.archive.filter((item) => item.id !== event.id), event].slice(-30);
}

export function isTransferDeadlineDay(value: GameFeatures, now = Date.now()) {
  return value.transferSaga.deadlineDayStartedAt > 0 && value.transferSaga.deadlineDayStartedAt <= now && value.transferSaga.deadlineDayEndsAt > now;
}

export function startTransferDeadlineDay(value: GameFeatures, now = Date.now(), random: () => number = Math.random) {
  const features = normalizeGameFeatures(value);
  const endsAt = features.cup.nextTournamentAt > now ? features.cup.nextTournamentAt : now + TOURNAMENT_COOLDOWN_MS;
  features.transferSaga.deadlineDayStartedAt = now;
  features.transferSaga.deadlineDayEndsAt = endsAt;
  features.transferSaga.nextAt = Math.min(endsAt - 1, now + 5000 + Math.floor(clamp(random(), 0, 0.999999) * 10000));
  return features;
}

export function publishTournamentGazette(value: GameFeatures, summary: TournamentCompletionSummary, now = Date.now(), random: () => number = Math.random) {
  const features = normalizeGameFeatures(value);
  const tournament = getTournament(summary.tournamentId) ?? TOURNAMENTS[0];
  const pool = summary.tournamentWon ? GAZETTE_CHAMPION_HEADLINES : GAZETTE_EXIT_HEADLINES;
  const previousHeadline = features.gazetteIssues.at(-1)?.headline ?? "";
  const available = pool.filter((headline) => headline !== previousHeadline);
  const headline = available[transferRandomIndex(available.length, random)] ?? pool[0];
  const score = `${summary.homeScore}:${summary.awayScore}`;
  const tieBreakLabel = summary.tieBreak ? " nach Elfmeterschiessen" : "";
  const issue: TournamentGazetteIssue = {
    id: `gazette-${now}-${summary.tournamentId}`,
    headline,
    strapline: summary.tournamentWon
      ? `${features.club.name} gewinnt ${tournament.trophyName}${tieBreakLabel}.`
      : `${features.club.name} scheidet in Runde ${summary.completedRound}${tieBreakLabel} aus.`,
    body: summary.tournamentWon
      ? `${score} gegen ${summary.opponent}. Die Trophäe ist da, die Fans feiern und der Platzwart hat das Konfetti offiziell aufgegeben.`
      : `${score} gegen ${summary.opponent}. Der Traum endet diesmal früh, doch im Club Office läuft die Analyse bereits auf höchster Lautstärke.`,
    tone: summary.tournamentWon ? "champion" : "exit",
    tournamentId: summary.tournamentId,
    opponent: summary.opponent,
    homeScore: summary.homeScore,
    awayScore: summary.awayScore,
    completedRound: summary.completedRound,
    tieBreak: summary.tieBreak,
    createdAt: now,
  };
  features.gazetteIssues = [...features.gazetteIssues, issue].slice(-12);
  addHistory(features, { title: `Goal Gazette · ${headline}`, detail: issue.strapline, tone: summary.tournamentWon ? "positive" : "negative" }, now);
  return { features, issue };
}

export function completeTournamentRun(value: GameFeatures, summary: TournamentCompletionSummary, now = Date.now(), random: () => number = Math.random) {
  let features = finishActiveTransferLoans(value, now).features;
  features = startTransferDeadlineDay(features, now, random);
  return publishTournamentGazette(features, summary, now, random).features;
}

export function getLoanedStarXIPlayerIds(features: GameFeatures) {
  return features.transferSaga.loans.map((loan) => loan.playerId);
}

export function getUnavailableStarXIPlayerIds(features: GameFeatures) {
  const injuredIds = Object.entries(features.cup.injuredPlayerIds ?? {}).filter(([, matches]) => Number(matches) > 0).map(([playerId]) => playerId);
  return [...new Set([...features.cup.suspendedPlayerIds, ...injuredIds, ...getLoanedStarXIPlayerIds(features)])];
}

export function getOpenTransferSquadVacancies(features: GameFeatures) {
  return features.transferSaga.vacancies.filter((vacancy) => {
    const activeSquadSize = features.starXI.lineupIds.filter(Boolean).length + features.starXI.benchIds.filter(Boolean).length;
    return activeSquadSize < vacancy.requiredPlayers;
  });
}

export function activatePendingTransferLoans(value: GameFeatures, tournamentId: TournamentId) {
  const features = normalizeGameFeatures(value);
  features.transferSaga.loans = features.transferSaga.loans.map((loan) => loan.status === "pending" ? { ...loan, status: "active", tournamentId } : loan);
  return features;
}

export function finishActiveTransferLoans(value: GameFeatures, now = Date.now()) {
  const features = normalizeGameFeatures(value);
  const returnedLoans = features.transferSaga.loans.filter((loan) => loan.status === "active");
  if (!returnedLoans.length) return { features, event: null as TransferInsiderEvent | null };
  const returnCompetition = features.cup.mode === "season" ? "der Saisonpartie" : "dem Turnier";
  features.transferSaga.loans = features.transferSaga.loans.filter((loan) => loan.status !== "active");
  const stillLoanedIds = getLoanedStarXIPlayerIds(features);
  features.starXI = normalizeStarXIState(features.starXI, [...stillLoanedIds, ...features.cup.suspendedPlayerIds]);
  const returnedNames = returnedLoans.map((loan) => getStarXIPlayer(loan.playerId)?.name).filter((name): name is string => Boolean(name));
  const event: TransferInsiderEvent = {
    id: `transfer-return-${now}`,
    outcome: "return",
    playerId: returnedLoans.length === 1 ? returnedLoans[0].playerId : null,
    playerName: returnedNames.join(", ") || "Deine Leihspieler",
    club: returnedLoans.length === 1 ? returnedLoans[0].club : "Leihstationen",
    headline: "Leihspieler zurück",
    message: `${returnedNames.join(", ") || "Deine Leihspieler"} ${returnedNames.length === 1 ? "ist" : "sind"} nach ${returnCompetition} wieder für deinen Club verfügbar.`,
    reason: "Leihe beendet",
    fee: 0,
    createdAt: now,
  };
  features.transferSaga.latestEvent = event;
  appendTransferArchive(features, event);
  addHistory(features, { title: "Fabrizio Romario · Rückkehr", detail: event.message, tone: "positive" }, now);
  return { features, event };
}

export function resolveTransferInsiderEvent(value: GameFeatures, random: () => number = Math.random, now = Date.now()) {
  const features = normalizeGameFeatures(value);
  const deadlineDay = isTransferDeadlineDay(features, now);
  const loanChance = deadlineDay ? TRANSFER_DEADLINE_LOAN_CHANCE : TRANSFER_LOAN_CHANCE;
  const eventRoll = clamp(random(), 0, 0.999999);
  const requestedOutcome: "loan" | "sale" | "failed" = eventRoll < loanChance
    ? "loan"
    : eventRoll < loanChance + TRANSFER_SALE_CHANCE
      ? "sale"
      : "failed";
  const club = TRANSFER_INTERESTED_CLUBS[transferRandomIndex(TRANSFER_INTERESTED_CLUBS.length, random)] ?? TRANSFER_INTERESTED_CLUBS[0];
  const loanedIds = new Set(getLoanedStarXIPlayerIds(features));
  const squadCandidateIds = [...new Set([...features.starXI.lineupIds, ...features.starXI.benchIds])]
    .filter((playerId) => Boolean(playerId) && features.starXI.ownedIds.includes(playerId) && !loanedIds.has(playerId) && Boolean(getStarXIPlayer(playerId)));
  const candidateStartIndex = transferRandomIndex(squadCandidateIds.length, random);
  const matchInProgress = features.cup.active;
  const candidateId: string | null = squadCandidateIds[candidateStartIndex] ?? null;
  const player = candidateId ? getStarXIPlayer(candidateId) ?? null : null;
  const outcome = requestedOutcome !== "failed" && player && !matchInProgress ? requestedOutcome : "failed";
  let event: TransferInsiderEvent;
  let goalDelta = 0;

  if (outcome === "loan" && player) {
    const lineupIndex = features.starXI.lineupIds.indexOf(player.id);
    const benchIndex = features.starXI.benchIds.indexOf(player.id);
    const requiredPlayers = features.starXI.lineupIds.filter(Boolean).length + features.starXI.benchIds.filter(Boolean).length;
    const vacancy: TransferSquadVacancy = lineupIndex >= 0
      ? { area: "lineup", index: lineupIndex, requiredPlayers, createdAt: now }
      : { area: "bench", index: benchIndex, requiredPlayers, createdAt: now };
    features.transferSaga.vacancies = [...getOpenTransferSquadVacancies(features), vacancy].slice(-20);
    const competition = features.cup.mode === "season"
      ? { current: "der laufenden Saisonpartie", next: "der nächsten kompletten Saisonpartie", article: "eine Saisonpartie" }
      : { current: "des laufenden Turniers", next: "dem nächsten kompletten Turnier", article: "ein Turnier" };
    const joinsCurrentTournament = features.cup.pendingNextRound;
    features.transferSaga.loans = [...features.transferSaga.loans, { playerId: player.id, club, status: joinsCurrentTournament ? "active" : "pending", tournamentId: joinsCurrentTournament ? features.cup.tournamentId : null, createdAt: now }];
    const blockedPlayerIds = [...getUnavailableStarXIPlayerIds(features)];
    features.starXI = normalizeStarXIState(features.starXI, blockedPlayerIds);
    event = {
      id: `transfer-loan-${now}-${player.id}`,
      outcome,
      playerId: player.id,
      playerName: player.name,
      club,
      headline: "Leihe bestätigt",
      message: joinsCurrentTournament
        ? `Fabrizio Romario meldet: ${player.name} wechselt auf Leihbasis zu ${club}, fehlt für den Rest ${competition.current} und kehrt danach zurück.`
        : `Fabrizio Romario meldet: ${player.name} wechselt auf Leihbasis zu ${club} und fehlt deinem Club in ${competition.next}. Danach kehrt er zurück.`,
      reason: joinsCurrentTournament ? `Leihe für den Rest ${competition.current}` : `Leihe für ${competition.article}`,
      fee: 0,
      createdAt: now,
    };
  } else if (outcome === "sale" && player) {
    const lineupIndex = features.starXI.lineupIds.indexOf(player.id);
    const benchIndex = features.starXI.benchIds.indexOf(player.id);
    const requiredPlayers = features.starXI.lineupIds.filter(Boolean).length + features.starXI.benchIds.filter(Boolean).length;
    const vacancy: TransferSquadVacancy = lineupIndex >= 0
      ? { area: "lineup", index: lineupIndex, requiredPlayers, createdAt: now }
      : { area: "bench", index: benchIndex, requiredPlayers, createdAt: now };
    features.transferSaga.vacancies = [...getOpenTransferSquadVacancies(features), vacancy].slice(-20);
    const paidSale = clamp(random(), 0, 0.999999) < TRANSFER_PAID_SALE_CHANCE;
    const fee = paidSale ? Math.max(0, Math.floor(player.price)) : 0;
    goalDelta = fee;
    const soldState = {
      ...features.starXI,
      ownedIds: features.starXI.ownedIds.filter((playerId) => playerId !== player.id),
      lineupIds: features.starXI.lineupIds.map((playerId) => playerId === player.id ? "" : playerId),
      benchIds: features.starXI.benchIds.map((playerId) => playerId === player.id ? "" : playerId),
    };
    features.starXI = normalizeStarXIState(soldState, getUnavailableStarXIPlayerIds(features));
    event = {
      id: `transfer-sale-${now}-${player.id}`,
      outcome,
      playerId: player.id,
      playerName: player.name,
      club,
      headline: paidSale ? "HERE WE GOAL" : "Ablösefreier Abgang",
      message: paidSale
        ? `Fabrizio Romario meldet: ${player.name} wechselt dauerhaft zu ${club}. Dein Club erhält ${fee.toLocaleString("de-CH")} Goals Ablöse.`
        : `Fabrizio Romario meldet: ${player.name} wechselt dauerhaft und ablösefrei zu ${club}. Dein Club erhält keine Goals.`,
      reason: paidSale ? "Verkauf mit Ablöse" : "Ablösefreier Wechsel",
      fee,
      createdAt: now,
    };
  } else {
    const reason = getNextTransferFailureReason(features.transferSaga.lastFailedReason, random);
    const playerName = player?.name ?? "einem angefragten Spieler";
    event = {
      id: `transfer-failed-${now}-${player?.id ?? "none"}`,
      outcome: "failed",
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      club,
      headline: "Deal geplatzt",
      message: `Fabrizio Romario meldet: Der mögliche Wechsel von ${playerName} zu ${club} ist geplatzt, weil ${reason}.`,
      reason,
      fee: 0,
      createdAt: now,
    };
    features.transferSaga.lastFailedReason = reason;
  }

  features.transferSaga.latestEvent = event;
  appendTransferArchive(features, event);
  const nextDelay = deadlineDay ? getTransferDeadlineEventDelay(random()) : getTransferEventDelay(random());
  const deadlineCandidate = now + nextDelay;
  features.transferSaga.nextAt = deadlineDay && deadlineCandidate >= features.transferSaga.deadlineDayEndsAt
    ? features.transferSaga.deadlineDayEndsAt + getTransferEventDelay(random())
    : deadlineCandidate;
  addHistory(features, {
    title: `Fabrizio Romario · ${event.headline}`,
    detail: event.message,
    tone: event.outcome === "sale" ? "negative" : event.outcome === "loan" ? "neutral" : "neutral",
  }, now);
  return { features, event, goalDelta };
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
  features.history = [...features.history, { ...entry, id: `${now}-${Math.random().toString(36).slice(2, 7)}`, timestamp: now }].slice(-30);
}
