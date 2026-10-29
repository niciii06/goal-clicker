import { competitionOfCup, emptyDiscipline, getBannedPlayerIds, nextCompetition, normalizeDiscipline } from './discipline';
import type { DisciplineState } from './discipline';
import type { CareerState } from "./career-data";
import type { ClubProfile, CoopMission, CupCardEvent, CupGoalEvent, CupInjuryEvent, CupMatchMode, CupMatchPhase, CupPenaltyEvent, CupState, CupStrategyId, CupSubstitutionImpact, EarnedPack, GoalBoostState, IconSeed, MatchChange, MatchHistoryEntry, MissionProgressSource, PenaltyDirection, RandomEvent, RewardPackId, SeasonFixture, SeasonMatchHistoryEntry, SeasonTableRow, StarFormationId, StarPackDefinition, StarPackId, StarPackOpening, StarPackReveal, StarXIEvaluationContext, StarXIPlayer, StarXIState, TournamentCompletionSummary, TournamentDefinition, TournamentGazetteIssue, TournamentId, TransferInsiderEvent, TransferInsiderOutcome, TransferMarketState, TransferOffer, TransferSagaState, TransferSquadVacancy, TransferUnhappyPlayer } from "./features/types";
import type { DailyRewardState } from "./daily-reward";
import type { GoalPattern } from "./match-broadcast";
import type { PressState } from "./press-conference";
import type { StarPosition } from "./fc26-player-pool";
import type { TravelState } from "./travel-data";
import type { Venue } from "./travel-geography";
import { ASSIST_POSITION_WEIGHTS, DEFENSIVE_FAULT_WEIGHTS, GOAL_POSITION_WEIGHTS, MISSION_TEMPLATES, STAR_FORMATIONS, STAR_POSITIONS, STAR_XI_FORMATION_POSITIONS, TOURNAMENTS, TRANSFER_PLAYERS, YB_FC26_PLAYERS, getStarFormation, specialAttributes } from "./features/catalog";
import { FC26_STAR_PROFILES } from "./fc26-player-pool";
import { FC27_RATING_BY_SOURCE_ID, getFC27CardAccent, isFC27Unavailable } from "./fc27-ratings";
import { FC27_WOMEN_PROFILES } from "./fc27-women-pool";
import { FC27_ADDED_MEN_SEEDS, FC27_ADDED_WOMEN_SEEDS, FC27_WITHDRAWN_SEEDS, withdrawnPositions } from "./fc27-added-players";
import { FC27_POSITION_BY_SOURCE_ID } from "./fc27-positions";
import { FC27_INDIA_PROFILES, SCRAP_RATING_GROUPS, drawScrapPlayer } from "./scrap-pack";
import { GAZETTE_CHAMPION_HEADLINES, GAZETTE_EXIT_HEADLINES, TRANSFER_INTERESTED_CLUBS, transferClubsForRating } from "./features/news-data";
import { HOME_VENUE, LEAGUE_LABELS, seasonGeography, venueForClubName } from "./travel-geography";
import { addBroadcastSubstitution, advanceMatchBroadcast, chooseGoalPattern, createMatchBroadcast, normalizeMatchBroadcast, recordedActionRating } from "./match-broadcast";
import { advanceInteractive, normalizeInteractive, resumeInteractive } from "./interactive-match";
import { emptyTravel, normalizeTravel } from "./travel-data";
import { getCareerCard, getPlayerForm, initialCareerState, normalizeCareerState } from "./career-data";
import { getPackUnlockLeague, hasReachedLeague, leagueForTier } from "./season-progression";
import { getFunnyPlayerName } from "./funny-player-names";
import { normalizeDailyRewards } from "./daily-reward";
import { normalizePress } from "./press-conference";
import { pronounText } from "./player-pronouns";
export type { ClubProfile, CoopMission, CupCardEvent, CupGoalEvent, CupInjuryEvent, CupMatchMode, CupMatchPhase, CupPenaltyEvent, CupState, CupStrategyId, CupSubstitutionImpact, EarnedPack, GoalBoostState, HistoryTone, MatchChange, MatchHistoryEntry, MissionKind, MissionProgressSource, PenaltyDirection, RandomEvent, RewardPackId, SeasonFixture, SeasonMatchHistoryEntry, SeasonTableRow, StarFormationDefinition, StarFormationId, StarFormationSlot, StarPackDefinition, StarPackId, StarPackOdds, StarPackOpening, StarPackReveal, StarXIEvaluationContext, StarXIPlayer, StarXIState, TournamentCompletionSummary, TournamentDefinition, TournamentGazetteIssue, TournamentId, TournamentOpponent, TransferInsiderEvent, TransferInsiderOutcome, TransferLoan, TransferMarketState, TransferPlayer, TransferOffer, TransferSagaState, TransferSquadVacancy, TransferUnhappyPlayer } from "./features/types";
export { STAR_FORMATIONS, STAR_POSITIONS, STAR_POSITION_NAMES, STAR_XI_FORMATION_POSITIONS, TOURNAMENTS, TOURNAMENT_OPPONENT_MULTIPLIER, TRANSFER_PLAYERS, YB_FC26_SOURCE_IDS, getStarFormation } from "./features/catalog";

export type { StarPosition } from "./fc26-player-pool";





































/** One played match of the running season, ours or between two other clubs; `matchday` counts from 1. */
export type SeasonResult = { matchday: number; homeId: string; awayId: string; homeScore: number; awayScore: number };

export type SeasonModeState = {
  fixtures?: SeasonFixture[];
  results?: SeasonResult[];
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
  earnedPacks: EarnedPack[];
  completedTournamentRuns: string[];
  travel: TravelState;
  career: CareerState;
  transferMarket: TransferMarketState;
  starXI: StarXIState;
  club: ClubProfile;
  cup: CupState;
  squadLock?: { fixtureId: string; playerIds: string[]; startedAt: number; transferRemaining: number; eventRemaining: number; varRemaining: number; offerRemaining?: number };
  /** Co-op mini game runs, by "<minigame>:<seat>": a reward needs a run the server saw start. */
  miniGameRuns?: Record<string, number>;
  seasonMode: SeasonModeState;
  goalBoost: GoalBoostState;
  missions: CoopMission[];
  history: MatchHistoryEntry[];
  randomEvent: RandomEvent | null;
  starPackReveal: StarPackReveal | null;
  /** IDs of executed fragment purchases; guards against double clicks and network retries. */
  purchaseReceipts: string[];
  /** Yellow card accumulation and suspensions per competition. */
  discipline: DisciplineState;
  transferSaga: TransferSagaState;
  gazetteIssues: TournamentGazetteIssue[];
  dailyRewards: DailyRewardState;
  press: PressState;
  nextEventAt: number;
  nextVarAt: number;
};


export const CLUB_BADGES = ["⚽", "🦅", "🔥", "🦁", "⭐", "🛡️"];
export const CLUB_COLORS = ["#0071e3", "#1d1d1f", "#e85d04", "#16845b", "#8b5cf6", "#d12c54"];
export const CUP_MATCH_DURATION_MS = 240000;
export const CUP_EXTRA_TIME_DURATION_MS = 80000;
export const TOURNAMENT_COOLDOWN_MS = 5 * 60 * 1000;
export const RED_CARD_CHANCE_PER_SECOND = 0.0012;
export const CUP_INJURY_CHANCE_PER_SECOND = 0.00065;
export const CUP_MIN_INJURY_MATCHES = 1;
export const CUP_MAX_INJURY_MATCHES = 3;

// Preserve the clock of matches saved before the six-minute update.
export function getCupRegularDurationMs(cup: Pick<CupState, "matchStartedAt" | "matchEndsAt" | "phase">) {
  const explicit=(cup as CupState).regularDurationMs;
  if(explicit && explicit>=180000 && explicit<=300000)return explicit;
  const total = Math.max(0, cup.matchEndsAt - cup.matchStartedAt);
  if (cup.phase === "regular") return total >= 60000 ? total : CUP_MATCH_DURATION_MS;
  // Legacy extra time totals 240 seconds; new extra time totals 480.
  return total > 300000 ? 360000 : 180000;
}

export function getCupMatchMinute(cup: Pick<CupState, "matchStartedAt" | "matchEndsAt" | "phase"> & Partial<Pick<CupState, "matchPaused" | "lastTickAt" | "active">>, now: number) {
  if ((cup as CupState).timedPause?.kind==='halftime')return 45;
  if (!cup.matchStartedAt) return 1;
  if (cup.phase === "penalties") return 120;
  const regular = getCupRegularDurationMs(cup);
  const at = (cup as CupState).timedPause?.frozenAt ?? ((cup.matchPaused || cup.active === false) && cup.lastTickAt ? cup.lastTickAt : now);
  const elapsed = Math.max(0, Math.min(at, cup.matchEndsAt) - cup.matchStartedAt);
  if (cup.phase === "regular" || elapsed <= regular)
    return Math.max(1, Math.min(90, Math.floor(elapsed / (regular / 90)) + 1));
  return Math.max(91, Math.min(120, 90 + Math.floor((elapsed - regular) / ((regular / 3) / 30)) + 1));
}
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
export const GAME_FEATURES_SCHEMA_VERSION = 8;
export const SEASON_MODE_DIVISION_COUNT = 15;
export const SEASON_MODE_MATCHES_PER_SEASON = 10;
export const SEASON_MODE_TABLE_SIZE = 6;
export const TRANSFER_EVENT_MIN_DELAY_MS = 480000;
export const TRANSFER_EVENT_MAX_DELAY_MS = 720000;
export const TRANSFER_LOAN_CHANCE = 0.30;
export const TRANSFER_SALE_CHANCE = 0.10;
export const TRANSFER_PAID_SALE_CHANCE = 0.60;
/** How long a sale offer waits for an answer (active play time; it pauses like the other Fabrizio timers). */
export const TRANSFER_OFFER_DURATION_MS = 3 * 60 * 1000;
/** A kept player who wanted to leave plays this many matches this much weaker. */
export const TRANSFER_UNHAPPY_MATCHES = 3;
export const TRANSFER_UNHAPPY_PENALTY = 2;
export const TRANSFER_DEADLINE_LOAN_CHANCE = 0.60;
export const TRANSFER_DEADLINE_EVENT_MIN_DELAY_MS = 45000;
export const TRANSFER_DEADLINE_EVENT_MAX_DELAY_MS = 75000;
export const PACK_TROLL_CHANCE = 0.05;







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


const SPECIAL_STAR_XI_PLAYERS: StarXIPlayer[] = [
  { id: "star-pfuschi", name: "Pfuschi", isCustom: true, benchOnly: true,
    position: null, positions: [], rating: 67, price: 1000, accent: "#64748b",
    cardType: "legendary", symbol: "☠️", packWeight: .04, originalAttributes: specialAttributes(1) },
  { id: "star-di-certo", name: "Di Certo", pitchName: "Di Certo", isCustom: true, countryCode: "CH", position: "LV",
    positions: ["LV", "RV"], rating: 100, price: 5000000000, accent: "#c69214",
    cardType: "legendary", packWeight: .02, originalAttributes: specialAttributes(100) },
  {
    id: "star-goat-nicu",
    pitchName: "GOAT Nicu",
    isCustom: true,
    name: "GOAT Nicu",
    position: "ST",
    positions: ["TW", "LV", "LAV", "IV", "RV", "RAV", "ZDM", "ZM", "ZOM", "LM", "RM", "LF", "RF", "MS", "ST"],
    rating: 100,
    price: 5000000000,
    accent: "#c69214",
    cardType: "legendary",
    packWeight: 0.02,
  },
  {
    id: "star-flurin-fabrice",
    pitchName: "Flurin",
    isCustom: true,
    name: "Flurin Fabrice",
    position: "ZM",
    positions: ["ZM", "ZOM"],
    rating: 100,
    price: 5000000000,
    accent: "#c69214",
    cardType: "legendary",
    packWeight: 0.02,
  },
  {
    id: "star-benxli",
    pitchName: "Mikeboy",
    isCustom: true,
    countryCode: "CH",
    name: "Mikeboy Jr.",
    position: "IV",
    positions: ["IV"],
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
    cardType: "legendary",
  },
  {
    id: "star-champ-simu",
    pitchName: "Champ Simu",
    isCustom: true,
    name: "Champ Simu",
    position: "IV",
    positions: ["IV"],
    rating: 100,
    price: 5000000000,
    accent: "#c6cbd2",
    packWeight: 0.02,
    cardType: "legendary",
  },
  {
    id: "star-silvuz",
    isCustom: true,
    countryCode: "CH",
    name: "Silvanzambi",
    position: "LF",
    positions: ["LF", "LM", "RF"],
    rating: 100,
    price: 5000000000,
    accent: "#d71920",
    packWeight: 0.02,
    cardType: "legendary",
  },
  {
    id: "star-nedu-mann-yesss",
    pitchName: "Nedu",
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
    pitchName: "Di Santo",
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





// All 136 FC 27 Base Icons (Ultimate Team icon catalogue, captured 17 October 2026).
// Existing card IDs and spelling jokes stay stable for saves; ratings and positions are FC 27.
const FC27_ICON_DATA = [
  ["pele", "Peléo", 95, "BR", ["ZOM", "ST"]],
  ["diego-maradona", "Diego Maradono", 95, "AR", ["ZOM", "ST"]],
  ["ronaldo", "Ronaldo Nazárioh", 94, "BR", ["ST"]],
  ["zinedine-zidane", "Zinedine Zidané", 94, "FR", ["ZOM", "ZM"]],
  ["johan-cruyff", "Johan Cruyffo", 93, "NL", ["ZOM", "ST"]],
  ["mia-hamm", "Mia Hamms", 93, "US", ["ST", "ZOM", "RF"]],
  ["ronaldinho", "Ronaldinho Gaúchoz", 93, "BR", ["LF", "LM", "ZOM"]],
  ["franz-beckenbauer", "Franz Beckenbauar", 93, "DE", ["IV", "ZDM", "ZM"]],
  ["garrincha", "Garrincho", 93, "BR", ["RF", "RM"]],
  ["paolo-maldini", "Paolo Maldiny", 93, "IT", ["IV", "LV"]],
  ["nadine-angerer", "Nadine Angererr", 92, "DE", ["TW"]],
  ["bobby-charlton", "Bobby Charltono", 92, "EN", ["ZOM", "ZM", "LM", "LF"]],
  ["andres-iniesta", "Andrés Iniestá", 92, "ES", ["ZM", "LM", "ZOM", "LF"]],
  ["gerd-muller", "Gerd Müllar", 92, "DE", ["ST"]],
  ["birgit-prinz", "Birgit Prinzz", 92, "DE", ["ST"]],
  ["ferenc-puskas", "Ferenc Puskáz", 92, "HU", ["ST"]],
  ["gianluigi-buffon", "Gianluigi Buffono", 92, "IT", ["TW"]],
  ["christine-sinclair", "Christine Sinclaire", 92, "CA", ["ST", "ZOM"]],
  ["alex-morgan", "Alex Morgann", 91, "US", ["ST"]],
  ["roberto-baggio", "Roberto Baggiö", 91, "IT", ["ZOM", "ST"]],
  ["franco-baresi", "Franco Baresio", 91, "IT", ["IV"]],
  ["cafu", "Cafúu", 91, "BR", ["RV", "RM"]],
  ["carlos-alberto", "Carlos Albertó", 91, "BR", ["RV", "IV"]],
  ["eusebio", "Eusébioh", 91, "PT", ["ST"]],
  ["thierry-henry", "Thierry Henryk", 91, "FR", ["ST", "LM", "LF"]],
  ["zlatan-ibrahimovic", "Zlatan Ibrahimovik", 91, "SE", ["ST"]],
  ["oliver-kahn", "Oliver Kahnn", 91, "DE", ["TW"]],
  ["homare-sawa", "Homare Sawaa", 91, "JP", ["ZM", "ZOM"]],
  ["marco-van-basten", "Marco van Bastem", 91, "NL", ["ST"]],
  ["xavi", "Xaví", 91, "ES", ["ZM", "ZDM", "ZOM"]],
  ["zico", "Zicóo", 91, "BR", ["ZOM", "ZM"]],
  ["ruud-gullit", "Ruud Gullito", 91, "NL", ["ZOM", "IV", "ZDM", "ZM", "ST"]],
  ["camille-abily", "Camille Abilyy", 90, "FR", ["ZM", "ZOM"]],
  ["dennis-bergkamp", "Dennis Bergkampp", 90, "NL", ["ST", "ZOM"]],
  ["george-best", "George Besto", 90, "NI", ["RF", "RM", "LM", "ZOM", "LF"]],
  ["iker-casillas", "Iker Casillaz", 90, "ES", ["TW"]],
  ["alessandro-del-piero", "Alessandro Del Pierro", 90, "IT", ["ZOM", "ST"]],
  ["julie-foudy", "Julie Foudyy", 90, "US", ["ZM", "ZDM"]],
  ["toni-kroos", "Toni Krooz", 90, "DE", ["ZM", "ZDM", "ZOM"]],
  ["lothar-matthaus", "Lothar Matthäuz", 90, "DE", ["ZM", "IV", "ZDM"]],
  ["aya-miyama", "Aya Miyamaa", 90, "JP", ["LM", "ZM", "ZOM", "LF"]],
  ["bobby-moore", "Bobby Mooré", 90, "EN", ["IV"]],
  ["andrea-pirlo", "Andrea Pirloz", 90, "IT", ["ZM", "ZDM"]],
  ["raul", "Raúlo", 90, "ES", ["ST", "ZOM"]],
  ["rivaldo", "Rivaldoo", 90, "BR", ["LF", "LM", "ZOM"]],
  ["rivellino", "Rivellinó", 90, "BR", ["ZOM", "LM", "LF"]],
  ["roberto-carlos", "Roberto Carloso", 90, "BR", ["LV", "LM"]],
  ["lotta-schelin", "Lotta Schelinn", 90, "SE", ["ST", "LM", "LF"]],
  ["caroline-seger", "Caroline Segerz", 90, "SE", ["ZM", "ZDM"]],
  ["kenny-dalglish", "Kenny Dalglisho", 90, "SC", ["ST", "ZOM"]],
  ["luis-figo", "Luís Figoz", 90, "PT", ["RF", "RM", "ZOM"]],
  ["kaka", "Kakáh", 90, "BR", ["ZOM"]],
  ["wayne-rooney", "Wayne Roonie", 90, "EN", ["ST", "ZOM"]],
  ["formiga", "Formigah", 90, "BR", ["ZDM", "ZM"]],
  ["hege-riise", "Hege Riisé", 90, "NO", ["ZM", "ZDM", "ZOM"]],
  ["karl-heinz-rummenigge", "Karl-Heinz Rummeniggé", 90, "DE", ["ST", "LM", "LF"]],
  ["tobin-heath", "Tobin Heathh", 90, "US", ["RF", "RM", "LM", "LF"]],
  ["gabriel-batistuta", "Gabriel Batistutá", 89, "AR", ["ST"]],
  ["emilio-butragueno", "Emilio Butragueñó", 89, "ES", ["ST"]],
  ["fabio-cannavaro", "Fabio Cannavarro", 89, "IT", ["IV"]],
  ["eric-cantona", "Eric Cantoná", 89, "FR", ["ST"]],
  ["didier-drogba", "Didier Drogbo", 89, "CI", ["ST"]],
  ["samuel-etoo", "Samuel Etoh", 89, "CM", ["ST"]],
  ["philipp-lahm", "Philipp Lahmo", 89, "DE", ["RV", "LV", "ZDM"]],
  ["hugo-sanchez", "Hugo Sánchezz", 89, "MX", ["ST"]],
  ["jairzinho", "Jairzinhoh", 89, "BR", ["RF", "RM", "ST"]],
  ["gary-lineker", "Gary Linekerr", 89, "EN", ["ST"]],
  ["marcelo", "Marcelo Vieiro", 89, "BR", ["LV"]],
  ["alessandro-nesta", "Alessandro Nestae", 89, "IT", ["IV"]],
  ["ruud-van-nistelrooy", "Ruud van Nistelrooij", 89, "NL", ["ST"]],
  ["carles-puyol", "Carles Puyolo", 89, "ES", ["IV", "RV"]],
  ["peter-schmeichel", "Peter Schmeichell", 89, "DK", ["TW"]],
  ["alan-shearer", "Alan Shearerr", 89, "EN", ["ST"]],
  ["kelly-smith", "Kelly Smithh", 89, "EN", ["ST", "ZOM"]],
  ["socrates", "Sócrateso", 89, "BR", ["ZOM", "ZM"]],
  ["steffi-jones", "Steffi Joness", 89, "DE", ["IV"]],
  ["hristo-stoichkov", "Hristo Stoichkoff", 89, "BG", ["ST", "RF", "LF"]],
  ["francesco-totti", "Francesco Tottis", 89, "IT", ["ST", "ZOM"]],
  ["javier-zanetti", "Javier Zanettí", 89, "AR", ["RV", "LV", "ZDM", "RM", "ZM", "LM"]],
  ["marcel-desailly", "Marcel Desaillyy", 89, "FR", ["IV", "ZDM"]],
  ["rio-ferdinand", "Rio Ferdinando", 89, "EN", ["IV"]],
  ["steven-gerrard", "Steven Gerrardt", 89, "EN", ["ZM", "ZDM", "ZOM"]],
  ["ronald-koeman", "Ronald Koemann", 89, "NL", ["IV", "ZDM"]],
  ["pavel-nedved", "Pavel Nedvědy", 89, "CZ", ["LM", "ZOM", "LF"]],
  ["paul-scholes", "Paul Scholess", 89, "EN", ["ZM", "ZDM", "ZOM"]],
  ["andriy-shevchenko", "Andriy Shevchenkó", 89, "UA", ["ST", "RF"]],
  ["lilian-thuram", "Lilian Thuramm", 89, "FR", ["RV", "IV"]],
  ["frank-lampard", "Frank Lampardo", 89, "EN", ["ZM", "ZDM", "ZOM"]],
  ["roy-keane", "Roy Keané", 89, "IE", ["ZM", "ZDM"]],
  ["jean-pierre-papin", "Jean-Pierre Papinn", 89, "FR", ["ST"]],
  ["lucio", "Lúcioo", 89, "BR", ["IV"]],
  ["pepe", "Pepeh", 89, "PT", ["IV"]],
  ["sergio-aguero", "Sergio Agüerro", 89, "AR", ["ST"]],
  ["gareth-bale", "Gareth Baleo", 88, "WA", ["RF", "RM", "LM", "ST", "LF"]],
  ["david-beckham", "David Beckhamn", 88, "EN", ["RM", "ZM", "RF"]],
  ["laurent-blanc", "Laurent Blanco", 88, "FR", ["IV", "ZDM", "ZM", "ZOM"]],
  ["petr-cech", "Petr Čeck", 88, "CZ", ["TW"]],
  ["giorgio-chiellini", "Giorgio Chiellino", 88, "IT", ["IV"]],
  ["gheorghe-hagi", "Gheorghe Hagí", 88, "RO", ["ZOM", "ZM", "LM", "LF"]],
  ["fernando-hierro", "Fernando Hierroo", 88, "ES", ["IV", "ZDM"]],
  ["geoff-hurst", "Geoff Hursto", 88, "EN", ["ST"]],
  ["mario-kempes", "Mario Kempesz", 88, "AR", ["ST", "LM", "ZOM", "LF"]],
  ["miroslav-klose", "Miroslav Klosek", 88, "DE", ["ST"]],
  ["michael-laudrup", "Michael Laudrupp", 88, "DK", ["ZOM", "LM", "LF"]],
  ["michael-owen", "Michael Owenn", 88, "EN", ["ST"]],
  ["marinette-pichon", "Marinette Pichonn", 88, "FR", ["ST"]],
  ["franck-ribery", "Franck Ribéryy", 88, "FR", ["LM", "LF"]],
  ["juan-roman-riquelme", "Juan Román Riquelmé", 88, "AR", ["ZOM"]],
  ["bastian-schweinsteiger", "Bastian Schweinsteigar", 88, "DE", ["ZM", "ZDM", "RM", "LM"]],
  ["edwin-van-der-sar", "Edwin van der Sarr", 88, "NL", ["TW"]],
  ["robin-van-persie", "Robin van Persié", 88, "NL", ["ST"]],
  ["patrick-vieira", "Patrick Vieirá", 88, "FR", ["ZM", "ZDM"]],
  ["john-barnes", "John Barness", 88, "EN", ["LF", "LM", "ZOM"]],
  ["dunga", "Dungáo", 88, "BR", ["ZDM", "ZM"]],
  ["claude-makelele", "Claude Makélélè", 88, "FR", ["ZDM", "RM", "ZM"]],
  ["emmanuel-petit", "Emmanuel Petitt", 88, "FR", ["ZDM", "LV", "ZM"]],
  ["robert-pires", "Robert Pirèz", 88, "FR", ["LM", "RM", "ZOM", "RF", "LF"]],
  ["frank-rijkaard", "Frank Rijkaardo", 88, "NL", ["ZDM", "IV", "ZM"]],
  ["ian-rush", "Ian Rushh", 88, "WA", ["ST"]],
  ["fernando-torres", "Fernando Torrez", 88, "ES", ["ST"]],
  ["nemanja-vidic", "Nemanja Vidič", 88, "RS", ["IV"]],
  ["ian-wright", "Ian Wrightt", 88, "EN", ["ST"]],
  ["xabi-alonso", "Xabi Alonseo", 88, "ES", ["ZDM", "ZM"]],
  ["cha-bum-kun", "Cha Bum-Kuno", 88, "KR", ["ST", "RM", "RF"]],
  ["ashley-cole", "Ashley Colee", 88, "EN", ["LV"]],
  ["sol-campbell", "Sol Campbelll", 88, "EN", ["IV"]],
  ["hernan-crespo", "Hernán Crespó", 88, "AR", ["ST"]],
  ["michael-essien", "Michael Essieno", 88, "GH", ["ZDM", "ZM"]],
  ["gennaro-gattuso", "Gennaro Gattusso", 88, "IT", ["ZDM", "ZM"]],
  ["sissi", "Sissí do Brasil", 88, "BR", ["ZOM"]],
  ["gianluca-zambrotta", "Gianluca Zambrottá", 88, "IT", ["RV", "LV", "RM", "LM"]],
  ["ellen-white", "Ellen Whitey", 88, "EN", ["ST"]],
  ["maicon", "Maiconn", 88, "BR", ["RV", "RM"]],
  ["raphael-varane", "Raphaël Varanne", 88, "FR", ["IV"]],
  ["yaya-toure", "Yaya Tourée", 88, "CI", ["ZM", "ZDM", "ZOM"]],
  ["yuki-nagasato", "Yuki Nagasatoh", 88, "JP", ["ZOM", "RM", "RF", "ST"]],
] as const satisfies readonly IconSeed[];

// FC 26 Icons that are not part of FC 27. Owned cards stay valid; packs no longer contain them.
const RETIRED_FC26_ICON_DATA = [
  ["lev-yashin", "Lev Yashim", 92, "RU", ["TW"]],
  ["patrick-kluivert", "Patrick Kluiverto", 87, "NL", ["ST"]],
  ["davor-suker", "Davor Šukerr", 87, "HR", ["ST"]],
  ["gianfranco-zola", "Gianfranco Zolaa", 87, "IT", ["ZOM", "ST"]],
  ["luis-hernandez", "Luis Hernándezz", 86, "MX", ["ST"]],
  ["henrik-larsson", "Henrik Larssonn", 86, "SE", ["ST"]],
  ["juan-sebastian-veron", "Juan Sebastián Verónn", 86, "AR", ["ZM", "ZOM"]],
] as const satisfies readonly IconSeed[];

// Icons who played in women's football; texts and walkouts treat them like the FC 27 women.
const WOMEN_ICON_IDS = new Set(["mia-hamm", "nadine-angerer", "birgit-prinz", "christine-sinclair", "alex-morgan", "homare-sawa", "camille-abily", "julie-foudy", "aya-miyama", "lotta-schelin", "caroline-seger", "formiga", "hege-riise", "tobin-heath", "kelly-smith", "steffi-jones", "marinette-pichon", "sissi", "ellen-white", "yuki-nagasato"]);

function toIconPlayer([id, name, rating, countryCode, positions]: IconSeed, retired = false): StarXIPlayer {
  return {
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
    ...(retired ? { retired: true } : {}),
    ...(WOMEN_ICON_IDS.has(id) ? { isWomen: true } : {}),
  };
}

const FC27_ICON_PLAYERS: StarXIPlayer[] = FC27_ICON_DATA.map((seed) => toIconPlayer(seed));
const RETIRED_FC26_ICON_PLAYERS: StarXIPlayer[] = RETIRED_FC26_ICON_DATA.map((seed) => toIconPlayer(seed, true));

const EXISTING_STAR_XI_PLAYERS: StarXIPlayer[] = [
  ...SPECIAL_STAR_XI_PLAYERS,
  ...FC27_ICON_PLAYERS,
  ...RETIRED_FC26_ICON_PLAYERS,
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
    ...(isFC27Unavailable(profile.sourceId) ? { retired: true } : {}),
  })),
  ...FC27_WOMEN_PROFILES.map((profile) => ({
    id: profile.id,
    sourceId: profile.sourceId,
    countryCode: profile.countryCode,
    name: profile.name,
    position: profile.positions[0],
    positions: [...profile.positions],
    rating: profile.rating,
    price: Math.round(Math.min(1500000000, 5000 * 1.28 ** (profile.rating - 70))),
    accent: profile.accent,
    isWomen: true,
  })),
  // Everyone else EA rates 70+ in FC 27; they draw from packs like the launch pool.
  ...FC27_ADDED_MEN_SEEDS.map(([sourceId, name]) => addedPlayer(`star-fc27-${sourceId}`, sourceId, name)),
  ...FC27_ADDED_WOMEN_SEEDS.map(([sourceId, name, countryCode]) => ({ ...addedPlayer(`star-fc27w-${sourceId}`, sourceId, name), countryCode, isWomen: true })),
  // Taken from the FC 26 database by mistake; owned copies stay, packs never draw them.
  ...FC27_WITHDRAWN_SEEDS.map(([sourceId, name, rating, positionList, countryCode]): StarXIPlayer => {
    const positions = withdrawnPositions(positionList);
    return { id: countryCode ? `star-fc27w-${sourceId}` : `star-fc27-${sourceId}`, sourceId, name, position: positions[0], positions, rating, price: Math.round(Math.min(1500000000, 5000 * 1.28 ** (rating - 70))), accent: getFC27CardAccent(rating), retired: true, ...(countryCode ? { countryCode, isWomen: true } : {}) };
  }),
];

function addedPlayer(id: string, sourceId: string, name: string): StarXIPlayer {
  const rating = FC27_RATING_BY_SOURCE_ID[sourceId], positions = [...FC27_POSITION_BY_SOURCE_ID[sourceId]];
  return { id, sourceId, name, position: positions[0], positions, rating, price: Math.round(Math.min(1500000000, 5000 * 1.28 ** (rating - 70))), accent: getFC27CardAccent(rating) };
}

// Reuse existing source IDs; retired fictional cards are removed by save normalization.
export const SCRAP_PLAYERS: StarXIPlayer[] = FC27_INDIA_PROFILES.map(profile => {
  const existing = EXISTING_STAR_XI_PLAYERS.find(p => p.sourceId === profile.sourceId);
  return { ...existing, id:existing?.id ?? `scrap-ea-${profile.sourceId}`, sourceId:profile.sourceId, countryCode:'IN', name:profile.name, position:profile.positions[0], positions:[...profile.positions], rating:profile.rating, price:existing?.price ?? Math.round(5000 * 1.28 ** (profile.rating - 70)), accent:existing?.accent ?? '#8b8177', cardType:'base', originalAttributes:profile.attributes };
});
const SCRAP_PLAYER_IDS = new Set(SCRAP_PLAYERS.map(p => p.id));
export const STAR_XI_PLAYERS: StarXIPlayer[] = [...EXISTING_STAR_XI_PLAYERS.filter(p => !SCRAP_PLAYER_IDS.has(p.id)), ...SCRAP_PLAYERS];

// Cards that can still be drawn: every card except those missing from FC 27.
export const STAR_XI_ACTIVE_PLAYERS: StarXIPlayer[] = STAR_XI_PLAYERS.filter(p => !p.retired);

export const STAR_XI_BASE_CARD_COUNT = STAR_XI_ACTIVE_PLAYERS.filter(p => !p.isCustom && p.cardType !== "icon" && p.cardType !== "legendary").length;
export const STAR_XI_ICON_CARD_COUNT = FC27_ICON_PLAYERS.length;
export const STAR_XI_SPECIAL_CARD_COUNT = SPECIAL_STAR_XI_PLAYERS.length;
export const STAR_XI_TOTAL_CARD_COUNT = STAR_XI_ACTIVE_PLAYERS.length;

const STAR_XI_PLAYER_BY_ID = new Map(STAR_XI_PLAYERS.map((player) => [player.id, player]));

export const STAR_XI_CUSTOM_PLAYERS = STAR_XI_PLAYERS.filter((player) => player.isCustom === true);
export const STAR_XI_RANDOM_CUSTOM_CARD_COST = 50000;
/** Share of special card pack draws that award a 100 rated special card. */
export const SPECIAL_PACK_HUNDRED_CHANCE = 0.08;
// A duplicate special card refunds at most a tenth of the pack, so duplicates never pay for the next draw.
const CUSTOM_DUPLICATE_COMPENSATION_CAP = STAR_XI_RANDOM_CUSTOM_CARD_COST / 10;

function isHundredSpecialCard(player: StarXIPlayer) {
  return player.isCustom === true && player.rating >= 100;
}
const SPECIAL_PACK_GROUPS = [
  { chance: SPECIAL_PACK_HUNDRED_CHANCE, players: STAR_XI_CUSTOM_PLAYERS.filter(isHundredSpecialCard) },
  { chance: 1 - SPECIAL_PACK_HUNDRED_CHANCE, players: STAR_XI_CUSTOM_PLAYERS.filter((player) => !isHundredSpecialCard(player)) },
].filter((group) => group.players.length);

/** Picks by `packWeight` (default 1); `roll` is in [0, 1). */
function pickByPackWeight<T extends { packWeight?: number }>(candidates: readonly T[], roll: number) {
  const weight = (candidate: T) => Math.max(0.0001, candidate.packWeight ?? 1);
  let remaining = roll * candidates.reduce((sum, candidate) => sum + weight(candidate), 0);
  return candidates.find((candidate) => (remaining -= weight(candidate)) <= 0) ?? candidates[candidates.length - 1];
}

export function getStarXIFragmentCompensation(player: StarXIPlayer) {
  const ratingStep = Math.max(1, Math.min(34, Math.floor(player.rating) - 66));
  if (player.isCustom) return Math.min(CUSTOM_DUPLICATE_COMPENSATION_CAP, ratingStep * 600);
  if (player.cardType === "icon") return ratingStep * 75;
  if (player.cardType === "legendary") return ratingStep * 150;
  return ratingStep * 15;
}

/** Card tiers of the pack reveal (`getStarCardTier`): up to 70 common, 71 to 79 pro, 80 to 85 rare
 * (rare animation), from 86 walkout (walkout animation), from 90 top walkout. Every pack row stays
 * inside one tier and carries its name, so the odds name exactly what the reveal shows. */
const CARD_TIERS = [
  { name: "Gewöhnlich", min: 0, max: 70 },
  { name: "Profi", min: 71, max: 79 },
  { name: "Selten", min: 80, max: 85 },
  { name: "Walkout", min: 86, max: 89 },
  { name: "Top Walkout", min: 90, max: 99 },
  { name: "Legendär", min: 100, max: 100 },
] as const;

function tierBand(minRating: number, maxRating: number, chance: number) {
  const tier = CARD_TIERS.find((item) => minRating >= item.min && maxRating <= item.max);
  if (!tier) throw new Error(`Pack row ${minRating}–${maxRating} crosses a card tier.`);
  const range = minRating === 0 ? `bis ${maxRating}` : minRating === maxRating ? `${minRating}` : `${minRating}–${maxRating}`;
  return { label: `${tier.name} ${range}`, minRating, maxRating, chance };
}

// One pack per league band: every pack unlocks where its cards fit the opponents of that league.
// The ladder only climbs: for every tier a dearer pack has at least the chance of a cheaper one.
// 100 rated cards are mostly a special card pack draw; the two top packs hold them at 0.001% and 0.01%.
export const STAR_PACKS: readonly StarPackDefinition[] = [
  { id: "scrap", label: "Schrott-Pack", price: 15000, description: "Günstig einsteigen und dein Team ergänzen. Enthält eine Basiskarte.", odds: SCRAP_RATING_GROUPS.map(group => tierBand(group.minRating, group.maxRating, group.chance)) },
  { id: "regional", label: "Regional-Pack", price: 10000000, description: "Gewöhnliche und Profi Karten für den Aufbau", odds: [tierBand(65, 70, 0.7), tierBand(71, 79, 0.3)] },
  { id: "scout", label: "Scout Pack", price: 50000000, description: "Meist Profis, seltene Karten sind die Ausnahme", odds: [tierBand(68, 70, 0.35), tierBand(71, 79, 0.62), tierBand(80, 85, 0.03)] },
  { id: "profi", label: "Profi-Pack", price: 350000000, description: "Profis für die Liga Mitte, Walkouts sind sehr selten", odds: [tierBand(71, 79, 0.85), tierBand(80, 85, 0.14), tierBand(86, 89, 0.01)] },
  { id: "elite", label: "Elite Pack", price: 3000000000, description: "Für die oberen Ligen, Walkouts sind möglich, aber selten", odds: [tierBand(75, 79, 0.6), tierBand(80, 85, 0.33), tierBand(86, 89, 0.06), tierBand(90, 99, 0.01)] },
  { id: "weltklasse", label: "Weltklasse-Pack", price: 6000000000, description: "Starke Karten für den Aufstiegskampf, mehr Walkouts", odds: [tierBand(77, 79, 0.4), tierBand(80, 85, 0.47999), tierBand(86, 89, 0.1), tierBand(90, 99, 0.02), tierBand(100, 100, 0.00001)] },
  { id: "legend", label: "Legenden Pack", price: 15000000000, description: "Das teuerste Pack mit den besten Walkout Chancen", odds: [tierBand(80, 85, 0.5499), tierBand(86, 89, 0.35), tierBand(90, 99, 0.1), tierBand(100, 100, 0.0001)] },
];

const REWARD_BRACKETS = [[0,64],[65,70],[71,79],[80,85],[86,89],[90,99]] as const;
const REWARD_PERCENTAGES = [[60,30,9,1,0,0],[25,45,25,4.5,.5,0],[5,20,55,18,1.9,.1],[0,5,40,48,6.5,.5],[0,0,20,55,23,2],[0,0,5,50,40,5]] as const;
export const REWARD_PACKS:readonly StarPackDefinition[] = ['Kleines Prämienpack','Basis-Prämienpack','Solides Prämienpack','Hochwertiges Prämienpack','Premium-Prämienpack','Top-Prämienpack'].map((label,i)=>({id:`reward-${i+1}` as RewardPackId,label,price:0,description:'Eine originale Basiskarte als Turnierprämie. Doppelte Karten geben Fragmente.',odds:REWARD_BRACKETS.map(([minRating,maxRating],b)=>tierBand(minRating,maxRating,REWARD_PERCENTAGES[i][b]/100))}));
/** Reward tier by the best league reached (Liga 15 to 13 the smallest pack, Liga 2 and 1 the top pack); the World Cup adds one tier. */
export function getTournamentRewardPack(id:TournamentId, highestDivision=1) {
  const league=SEASON_MODE_DIVISION_COUNT+1-clamp(Math.floor(Number(highestDivision))||1,1,SEASON_MODE_DIVISION_COUNT);
  const tier=league>=13?0:league>=10?1:league>=7?2:league>=5?3:league>=3?4:5;
  return REWARD_PACKS[Math.min(REWARD_PACKS.length-1,tier+(id==='world'?1:0))];
}
export function isRewardPack(id:string):id is RewardPackId {return REWARD_PACKS.some(p=>p.id===id);}
const rewardPoolCache=new Map<RewardPackId,ReturnType<typeof calculateRewardPackOdds>>();
export function getRewardPackOdds(id:RewardPackId,players:readonly StarXIPlayer[]=STAR_XI_ACTIVE_PLAYERS) {
 if(players===STAR_XI_ACTIVE_PLAYERS){const cached=rewardPoolCache.get(id);if(cached)return cached;const groups=calculateRewardPackOdds(id,players);rewardPoolCache.set(id,groups);return groups;}return calculateRewardPackOdds(id,players);
}
function calculateRewardPackOdds(id:RewardPackId,players:readonly StarXIPlayer[]=STAR_XI_ACTIVE_PLAYERS) {
 const pack=REWARD_PACKS.find(p=>p.id===id)!;
 const base=players.filter(p=>!p.retired&&!p.isCustom&&p.cardType!=='icon'&&p.cardType!=='legendary');
 const groups=pack.odds.map(o=>({...o,players:base.filter(p=>p.rating>=o.minRating&&p.rating<=o.maxRating)})).filter(o=>o.players.length&&o.chance>0);
 const total=groups.reduce((sum,o)=>sum+o.chance,0);if(!total)throw new Error('Keine gültigen Prämienkarten verfügbar.');
 return groups.map(o=>({...o,chance:o.chance/total}));
}
export function openEarnedPack(features:GameFeatures,id:string,now=Date.now(),random=Math.random,canonical?:StarPackOpening) {
 const earned=features.earnedPacks.find(p=>p.id===id);
 if(!earned||earned.opening||features.cup.active)return null;
 const opening=canonical??openStarPack(earned.packId,features.starXI.ownedIds,random);
 if(opening.packId!==earned.packId||!getStarXIPlayer(opening.player.id))return null;
 // Duplicate compensation is decided against the collection at application time.
 const player=getStarXIPlayer(opening.player.id)!,duplicate=features.starXI.ownedIds.includes(player.id);
 const result={...opening,player,duplicate,fragmentCompensation:duplicate?getStarXIFragmentCompensation(player):0};
 earned.opening=result;
 if(duplicate)features.starXI.fragments+=result.fragmentCompensation;else features.starXI=addStarXIPlayer(features.starXI,player.id);
 features.starPackReveal={...result,openedAt:now,openedBy:'Du',troll:shouldTriggerPackTroll(player)};
 addHistory(features,{title:`${earned.packId}: ${player.name}`,detail:duplicate?`+${result.fragmentCompensation} Fragmente`:`${player.positions.join(' / ')} · Rating ${player.rating}`,tone:'positive'},now);
 return features.starPackReveal;
}

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
    // Of the special cards only the 100 rated ones can come from a normal pack, in its 100 row.
    if (!STAR_RATING_POOLS.has(key)) STAR_RATING_POOLS.set(key, EXISTING_STAR_XI_PLAYERS.filter((player) => !player.retired && (!player.isCustom || isHundredSpecialCard(player)) && player.rating >= odds.minRating && player.rating <= odds.maxRating));
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

const SEASON_DIVISION_LABELS = LEAGUE_LABELS;

const SEASON_OPPONENT_NAMES = [
  "FC Tabellenkeller",
  "SV Unentschieden",
  "Real Zufall",
  "FC Arbeitszeitbetrug",
  "Inter Timeout",
] as const;

export function getSeasonModeDivisionLabel(division: number) {
  const index = Math.max(1, Math.min(SEASON_MODE_DIVISION_COUNT, Math.floor(Number(division) || 1))) - 1;
  return `Liga ${15-index} · ${SEASON_DIVISION_LABELS[index] ?? SEASON_DIVISION_LABELS[0]}`;
}

function getSeasonOpponentRating(division: number, index: number) {
  if(division===15)return [98,92,91,96,94][Math.max(0,Math.min(4,index-1))];
  return Math.round(clamp(40 + (Math.max(1, division) - 1) * 3.4 + index * 1.5, 40, 99));
}

function createSeasonTable(division: number, clubName: string): SeasonTableRow[] {
  return [
    { id: "club", name: clubName || "FC Goal", rating: 0 },
    ...SEASON_OPPONENT_NAMES.map((_, index) => ({ id: `season-opponent-${index + 1}`, name: seasonGeography(division, index).name, clubId: seasonGeography(division,index).id, venue: seasonGeography(division,index).venue, rating: getSeasonOpponentRating(division, index + 1) })),
  ].map((team) => ({ ...team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }));
}

function normalizeSeasonTable(raw: unknown, division: number, clubName: string) {
  const saved = Array.isArray(raw) ? raw.map(asRecord) : [];
  return createSeasonTable(division, clubName).map((fallback) => {
    const source = saved.find((candidate) => candidate.id === fallback.id) ?? {};
    return {
      id: fallback.id,
      clubId: typeof source.clubId==='string' ? source.clubId : fallback.clubId,
      venue: fallback.id==='club' ? HOME_VENUE : source.venue && typeof source.venue==='object' && Number.isFinite(Number(asRecord(source.venue).lat)) && Number.isFinite(Number(asRecord(source.venue).lon)) ? source.venue as Venue : venueForClubName(safeString(source.name,fallback.name),division,Number(fallback.id.split('-').at(-1))-1),
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

export function sortSeasonTable(table: readonly SeasonTableRow[]) {
  return [...table].sort((first, second) => second.points - first.points
    || (second.goalsFor - second.goalsAgainst) - (first.goalsFor - first.goalsAgainst)
    || second.goalsFor - first.goalsFor
    || (first.id === "club" ? -1 : second.id === "club" ? 1 : first.name.localeCompare(second.name)));
}

export function seasonBackgroundPairings(day:number) {
 const teams=['club','season-opponent-5','season-opponent-4','season-opponent-3','season-opponent-2','season-opponent-1'];
 for(let n=0;n<day%5;n++)teams.splice(1,0,teams.pop()!);
 return [[teams[1],teams[4]],[teams[2],teams[3]]];
}
/** Which club of a background pairing plays at home: they take turns from one matchday to the next. */
function seasonPairingHomeFirst(day:number) { return day%2===0; }

export type SeasonScheduleMatch = { homeId: string; awayId: string; home: string; away: string; homeScore?: number; awayScore?: number; club: boolean };
/** The whole season: every matchday with our match and the two others, with the score once it is played. */
export function getSeasonSchedule(state: SeasonModeState): { matchday: number; played: boolean; matches: SeasonScheduleMatch[] }[] {
  const name = (id: string) => state.table.find((team) => team.id === id)?.name ?? "Unbekannt";
  return Array.from({ length: SEASON_MODE_MATCHES_PER_SEASON }, (_, day) => {
    const fixture = state.fixtures?.[day], opponentId = fixture?.opponentId ?? `season-opponent-${day % (SEASON_MODE_TABLE_SIZE - 1) + 1}`;
    const clubAway = fixture?.away ?? day % 2 === 1;
    const pairs: [string, string, boolean][] = [[clubAway ? opponentId : "club", clubAway ? "club" : opponentId, true], ...seasonBackgroundPairings(day).map(([first, second]): [string, string, boolean] => seasonPairingHomeFirst(day) ? [first, second, false] : [second, first, false])];
    // Saves from before results were stored still know the club's own scores from the match history.
    const history = day < state.matchday ? state.history.slice(-state.matchday).find((entry) => entry.matchday === day + 1 && !entry.completedSeason) : undefined;
    const matches = pairs.map(([homeId, awayId, club]) => {
      const result = state.results?.find((entry) => entry.matchday === day + 1 && entry.homeId === homeId && entry.awayId === awayId)
        ?? (club && history ? { homeScore: clubAway ? history.opponentScore : history.clubScore, awayScore: clubAway ? history.clubScore : history.opponentScore } : undefined);
      return { homeId, awayId, home: name(homeId), away: name(awayId), club, ...(result ? { homeScore: result.homeScore, awayScore: result.awayScore } : {}) };
    });
    return { matchday: day + 1, played: day < state.matchday, matches };
  });
}

export function createSeasonFixtures(table:SeasonTableRow[]):SeasonFixture[] {
 return Array.from({length:10},(_,day)=>{const o=table.find(t=>t.id===`season-opponent-${day%5+1}`)!;return {opponentId:o.id,clubId:o.clubId??o.id,away:day%2===1,venue:day%2===1?o.venue!:HOME_VENUE};});
}

export function initialSeasonMode(clubName = "FC Goal"): SeasonModeState {
  const table = createSeasonTable(1, clubName);
  return {
    fixtures: createSeasonFixtures(table),
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
  const generated=createSeasonFixtures(table);
  const fixtures=generated.map((fallback,index)=>{const raw=asRecord((Array.isArray(source.fixtures)?source.fixtures:[])[index]);return raw.opponentId===fallback.opponentId&&typeof raw.away==='boolean'?{...fallback,away:raw.away,venue:raw.away?(table.find(t=>t.id===raw.opponentId)?.venue??fallback.venue):HOME_VENUE}:fallback;});
  const teamIds = new Set(table.map((team) => team.id));
  const results = (Array.isArray(source.results) ? source.results : []).map(asRecord).filter((item) => typeof item.homeId === "string" && typeof item.awayId === "string" && teamIds.has(item.homeId) && teamIds.has(item.awayId) && item.homeId !== item.awayId).map((item): SeasonResult => ({
    matchday: Math.max(1, Math.min(SEASON_MODE_MATCHES_PER_SEASON, Math.floor(Number(item.matchday) || 1))),
    homeId: String(item.homeId),
    awayId: String(item.awayId),
    homeScore: Math.max(0, Math.min(20, Math.floor(Number(item.homeScore) || 0))),
    awayScore: Math.max(0, Math.min(20, Math.floor(Number(item.awayScore) || 0))),
  })).slice(-SEASON_MODE_MATCHES_PER_SEASON * 3);
  return {
    fixtures,
    results,
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
  const clubAway = state.fixtures?.[state.matchday]?.away ?? state.matchday % 2 === 1, opponentRowId = opponent?.id ?? nextOpponent.id;
  const results: SeasonResult[] = [clubAway
    ? { matchday, homeId: opponentRowId, awayId: "club", homeScore: safeOpponentScore, awayScore: safeClubScore }
    : { matchday, homeId: "club", awayId: opponentRowId, homeScore: safeClubScore, awayScore: safeOpponentScore }];
  let table = state.table.map((team) => team.id === "club" ? updateSeasonTableRow({ ...team, name: clubName || team.name }, safeClubScore, safeOpponentScore) : team.id === opponent?.id ? updateSeasonTableRow(team, safeOpponentScore, safeClubScore) : team);
  for(const [firstId,secondId] of seasonBackgroundPairings(state.matchday)) {
    const first=table.find(t=>t.id===firstId)!,second=table.find(t=>t.id===secondId)!;
    const firstScore=rollSeasonScore(first.rating-second.rating+1,random),secondScore=rollSeasonScore(second.rating-first.rating-1,random);
    table=table.map(team=>team.id===first.id?updateSeasonTableRow(team,firstScore,secondScore):team.id===second.id?updateSeasonTableRow(team,secondScore,firstScore):team);
    results.push(seasonPairingHomeFirst(state.matchday)?{matchday,homeId:first.id,awayId:second.id,homeScore:firstScore,awayScore:secondScore}:{matchday,homeId:second.id,awayId:first.id,homeScore:secondScore,awayScore:firstScore});
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
      lastResult = `Saison beendet: Platz ${position} und Aufstieg in Liga ${16-nextDivision}.`;
    } else if (position >= SEASON_MODE_TABLE_SIZE - 1 && state.division > 1) {
      seasonOutcome = "relegated";
      nextDivision = state.division - 1;
      lastResult = `Saison beendet: Platz ${position} und Abstieg in Liga ${16-nextDivision}.`;
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
    fixtures: completedSeason && !hallOfFame ? createSeasonFixtures(createSeasonTable(nextDivision,clubName)) : state.fixtures,
    // A new season starts without results; the finished one stays visible through lastTable.
    results: completedSeason && !hallOfFame ? [] : [...(state.results ?? []), ...results],
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
    fixtures: createSeasonFixtures(freshTable),
    // The new season replays the same pairings; old scores must not show up as its results.
    results: [],
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
  // First the rarity (8% for a 100 rated card), then the card within it by pack weight.
  const groupTotal = SPECIAL_PACK_GROUPS.reduce((sum, group) => sum + group.chance, 0);
  let groupRoll = clamp(Number(random()) || 0, 0, 0.999999999) * groupTotal;
  const group = SPECIAL_PACK_GROUPS.find((entry) => (groupRoll -= entry.chance) < 0) ?? SPECIAL_PACK_GROUPS[SPECIAL_PACK_GROUPS.length - 1];
  const player = pickByPackWeight(group.players, clamp(Number(random()) || 0, 0, 0.999999999));
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

/** The special card pack replaces the former standalone fragment draw. It uses the same
 * price, card pool and duplicate compensation; only fragments can pay for it. */
export const SPECIAL_CARD_PACK = {
  id: "special" as const,
  label: "Spezialkarten-Pack",
  price: STAR_XI_RANDOM_CUSTOM_CARD_COST,
  currency: "fragments" as const,
  description: "Eine zufällige Spezialkarte, nur 8% sind 100er. Doppelte Karten geben ein paar Fragmente zurück.",
};
export const PURCHASE_RECEIPT_LIMIT = 50;

/** Chance of every special card in one pack draw, from the rarity groups and pack weights. */
export function getSpecialCardChances() {
  const groupTotal = SPECIAL_PACK_GROUPS.reduce((sum, group) => sum + group.chance, 0);
  return new Map(SPECIAL_PACK_GROUPS.flatMap((group) => {
    const weightTotal = group.players.reduce((sum, player) => sum + Math.max(0.0001, player.packWeight ?? 1), 0);
    return group.players.map((player) => [player.id, group.chance / groupTotal * Math.max(0.0001, player.packWeight ?? 1) / weightTotal] as const);
  }));
}

export function getSpecialCardPackOdds(ownedIds: readonly string[] = []) {
  const chances = getSpecialCardChances();
  const total = STAR_XI_CUSTOM_PLAYERS.length;
  const missingPlayers = STAR_XI_CUSTOM_PLAYERS.filter((player) => !ownedIds.includes(player.id));
  const hundredChance = STAR_XI_CUSTOM_PLAYERS.filter(isHundredSpecialCard).reduce((sum, player) => sum + (chances.get(player.id) ?? 0), 0);
  return { total, missing: missingPlayers.length, hundredChance, newCard: missingPlayers.reduce((sum, player) => sum + (chances.get(player.id) ?? 0), 0) };
}

export type SpecialPackPurchase = { ok: true; reveal: StarPackReveal } | { ok: false; error: string; duplicateRequest?: boolean };

/** Authoritative purchase: one receipt per purchase ID, so a repeated click or a network retry
 * of the same request can never charge fragments or award a card twice. */
export function purchaseSpecialCardPack(features: GameFeatures, purchaseId: string, options: { openedBy?: string; now?: number; random?: () => number; unlimited?: boolean } = {}): SpecialPackPurchase {
  const id = typeof purchaseId === "string" ? purchaseId.slice(0, 80) : "";
  if (!id) return { ok: false, error: "Ungültiger Kauf." };
  if (features.purchaseReceipts.includes(id)) return { ok: false, error: "Dieser Kauf wurde bereits ausgeführt.", duplicateRequest: true };
  if (features.cup.active) return { ok: false, error: "Während eines Spiels können keine Packs geöffnet werden." };
  const cost = SPECIAL_CARD_PACK.price;
  if (!options.unlimited && features.starXI.fragments < cost) return { ok: false, error: `${SPECIAL_CARD_PACK.label} kostet ${cost.toLocaleString("de-CH")} Fragmente.` };
  const state = options.unlimited ? { ...features.starXI, fragments: Math.max(features.starXI.fragments, cost) } : features.starXI;
  const opening = drawRandomStarXICustomCard(state, options.random);
  if (!opening.drawn || !opening.player) return { ok: false, error: "Das Spezialkarten-Pack konnte nicht geöffnet werden." };
  const now = options.now ?? Date.now();
  const reveal: StarPackReveal = { packId: opening.packId, packName: SPECIAL_CARD_PACK.label, player: opening.player, duplicate: opening.duplicate, fragmentCompensation: opening.fragmentCompensation, source: opening.source, openedAt: now, openedBy: options.openedBy ?? "Du", troll: shouldTriggerPackTroll(opening.player) };
  features.starXI = { ...opening.state, lockedPlayerIds: features.starXI.lockedPlayerIds };
  features.starPackReveal = reveal;
  features.purchaseReceipts = [...features.purchaseReceipts, id].slice(-PURCHASE_RECEIPT_LIMIT);
  addHistory(features, opening.duplicate
    ? { title: `Doppelter Spezialspieler: ${opening.player.name}`, detail: `+${opening.fragmentCompensation.toLocaleString("de-CH")} Fragmente zurück.`, tone: "neutral" }
    : { title: `${opening.player.name} aus dem Spezialkarten-Pack`, detail: `${formatStarXIPositionList(opening.player)} · Rating ${opening.player.rating}`, tone: "positive" }, now);
  return { ok: true, reveal };
}

function formatStarXIPositionList(player: StarXIPlayer) {
  const positions = getStarXIPositions(player);
  return positions.length ? positions.join(" / ") : "Nur Bank";
}

function uniqueKnownStarIds(ids: unknown) {
  return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && STAR_XI_PLAYER_BY_ID.has(id)))] : [];
}

export function getStarXIPositions(player: StarXIPlayer) {
  return player.benchOnly ? [] : player.positions.length ? player.positions : player.position ? [player.position] : [];
}

// FC 27 has no wing-back or centre-forward positions, so full-backs cover the
// wing-back slots of back-five formations and strikers cover centre-forward.
const FC27_SLOT_EQUIVALENTS: Partial<Record<StarPosition, StarPosition>> = { LAV: "LV", RAV: "RV", MS: "ST" };

export function canStarXIPlayerPlayPosition(player: StarXIPlayer | undefined, position: StarPosition) {
  if (!player || player.benchOnly) return false;
  const positions = getStarXIPositions(player);
  const equivalent = FC27_SLOT_EQUIVALENTS[position];
  return positions.includes(position) || (!!equivalent && positions.includes(equivalent));
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
  const lockedPlayerIds = Array.isArray(source.lockedPlayerIds) ? uniqueKnownStarIds(source.lockedPlayerIds) : undefined;
  blockedPlayerIds = [...new Set([...blockedPlayerIds, ...(lockedPlayerIds ? ownedIds.filter(id => !lockedPlayerIds.includes(id)) : [])])];
  const fragments = Math.max(0, Math.floor(Number(source.fragments) || 0));
  const blockedIds = new Set(blockedPlayerIds);
  const requestedPositions = normalizeFormationPositions(source.formationPositions);
  const formation = STAR_FORMATIONS.find((item) => item.id === source.formationId)
    ?? STAR_FORMATIONS.find((item) => item.slots.every((slot, index) => slot.position === requestedPositions[index]))
    ?? getStarFormation("433");
  const formationPositions = formation.slots.map((slot) => slot.position);
  const lineupIds = normalizeLineupSlots(ownedIds, source.lineupIds, formationPositions, blockedIds);
  const benchIds = normalizeBenchSlots(ownedIds, lineupIds, source.benchIds, blockedIds);
  return { ownedIds, lockedPlayerIds, fragments, lineupIds, benchIds, formationId: formation.id, formationPositions };
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
  if(next.lockedPlayerIds && !next.lockedPlayerIds.includes(playerId))return next;
  const openLineupIndex = next.lineupIds.findIndex((id, index) => !id && canStarXIPlayerFillSlot(playerId, index, next.formationPositions));
  if (openLineupIndex >= 0) next.lineupIds[openLineupIndex] = playerId;
  else {
    const openBenchIndex = next.benchIds.findIndex((id) => !id);
    if (openBenchIndex >= 0) next.benchIds[openBenchIndex] = playerId;
  }
  // Completing a weak starter team may require moving an existing multi-position card.
  return playerId.startsWith("scrap-") && next.lineupIds.some(id => !id) ? setBestStarXI(next) : next;
}

export function setStarXIStarter(state: StarXIState, lineupIndex: number, playerId: string, blockedPlayerIds: readonly string[] = []) {
  const next = normalizeStarXIState(state);
  const blocked = new Set([...blockedPlayerIds,...(next.lockedPlayerIds?next.ownedIds.filter(id=>!next.lockedPlayerIds!.includes(id)):[])]);
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
  if(next.lockedPlayerIds && !next.lockedPlayerIds.includes(playerId))return next;
  if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= STAR_XI_BENCH_SIZE || blockedPlayerIds.includes(playerId) || !next.ownedIds.includes(playerId) || next.lineupIds.includes(playerId)) return next;
  const currentPlayerId = next.benchIds[benchIndex];
  const otherBenchIndex = next.benchIds.indexOf(playerId);
  if (otherBenchIndex >= 0) next.benchIds[otherBenchIndex] = currentPlayerId;
  next.benchIds[benchIndex] = playerId;
  return blockedPlayerIds.length ? removeStarXIPlayersFromSquad(next, blockedPlayerIds, false) : normalizeStarXIState(next);
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


/** Matches the existing performance scale; live match notes never survive their match. */
export function getStarXISelectionRating(player: StarXIPlayer, context: StarXIEvaluationContext = {}) {
  const form = context.career ? getPlayerForm(context.career, player.id).bonus : 0;
  const card = context.career ? getCareerCard(context.career, player).bonus : 0;
  const cup = context.cup;
  const currentMatch = cup?.active && cup.matchStartedAt > 0;
  const prepared = currentMatch && cup.careerRatingSeed === cup.matchStartedAt
    ? cup.careerBonuses?.[player.id] : undefined;
  const base = Math.min(100, player.rating + (prepared ?? (form + card)));
  const live = currentMatch ? getCupPlayerMatchRating(cup, player.id, context.minute ?? 1) : null;
  const fitness=currentMatch?cup.broadcast?.fitness[player.id]??100:100;
  return base-Math.max(0,100-fitness)*.045+(live !== null && Number.isFinite(live) ? (live - 6.5) * 2.8 : 0);
}

/**
 * Finds the highest-rated valid assignment for the current formation.
 *
 * The dynamic program uses a bit for each of the eleven slots. Only the
 * eleven highest-rated candidates for a slot are needed: an assignment can
 * use at most ten other players to block those candidates, so a lower-ranked
 * twelfth candidate can always be replaced by a free higher-ranked one.
 */
export function getBestStarXISelection(ownedIds: string[], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, blockedPlayerIds: readonly string[] = [], context: StarXIEvaluationContext = {}) {
  const positions = Array.from({ length: STAR_XI_SQUAD_SIZE }, (_, index) => formationPositions[index] ?? STAR_XI_FORMATION_POSITIONS[index]);
  const blocked = new Set(blockedPlayerIds);
  const players = [...new Set(ownedIds)]
    .map((id) => getStarXIPlayer(id))
    .filter((player): player is StarXIPlayer => player !== undefined && !blocked.has(player.id));
  const ratings = new Map(players.map(player => [player.id, getStarXISelectionRating(player, context)]));
  const rating = (player: StarXIPlayer) => ratings.get(player.id)!;
  const compare = (a: StarXIPlayer, b: StarXIPlayer) => rating(b) - rating(a) || a.id.localeCompare(b.id);
  const candidateIds = new Set<string>();

  for (const position of positions) {
    players
      .filter((player) => canStarXIPlayerPlayPosition(player, position))
      .sort(compare)
      .slice(0, STAR_XI_SQUAD_SIZE)
      .forEach((player) => candidateIds.add(player.id));
  }

  const candidates = players.filter((player) => candidateIds.has(player.id)).sort(compare);
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
        const nextScore = scores[mask] + rating(player);
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
      if (!Number.isFinite(previousScore) || previousScore + rating(player) !== currentScore) continue;
      lineupIds[slotIndex] = player.id;
      mask = previousMask;
      break;
    }
  }
  return lineupIds;
}

export function setBestStarXI(state: StarXIState, blockedPlayerIds: readonly string[] = [], context: StarXIEvaluationContext = {}) {
  if (context.cup?.active) return state;
  blockedPlayerIds = [...blockedPlayerIds,...(state.lockedPlayerIds?state.ownedIds.filter(id=>!state.lockedPlayerIds!.includes(id)):[])];
  const next = removeStarXIPlayersFromSquad(normalizeStarXIState(state), blockedPlayerIds);
  const lineupIds = getBestStarXISelection(next.ownedIds, next.formationPositions, blockedPlayerIds, context);
  const currentScore = next.lineupIds.reduce((sum, id) => sum + (getStarXIPlayer(id) ? getStarXISelectionRating(getStarXIPlayer(id)!, context) : 0), 0);
  const selectedScore = lineupIds.reduce((sum, id) => sum + (getStarXIPlayer(id) ? getStarXISelectionRating(getStarXIPlayer(id)!, context) : 0), 0);
  if (next.lineupIds.filter(Boolean).length === lineupIds.filter(Boolean).length && Math.abs(currentScore - selectedScore) < 1e-9) lineupIds.splice(0, lineupIds.length, ...next.lineupIds);
  const benchIds = getBestStarXIBenchSelection(next.ownedIds, lineupIds, next.formationPositions, blockedPlayerIds, context);
  return { ...next, lineupIds, benchIds };
}

/**
 * Builds a substitute bench with one backup for every lineup slot, in lineup
 * order, chosen like the lineup itself: the best rated assignment of the
 * remaining players, whatever their main position. The twelfth seat goes to
 * the best player left who fits the formation.
 */
export function getBestStarXIBenchSelection(
  ownedIds: string[],
  lineupIds: readonly string[],
  formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS,
  blockedPlayerIds: readonly string[] = [],
  context: StarXIEvaluationContext = {},
) {
  const excluded = [...blockedPlayerIds, ...lineupIds.filter(Boolean)];
  const benchIds = [...getBestStarXISelection(ownedIds, formationPositions, excluded, context), ...Array.from({ length: STAR_XI_BENCH_SIZE - STAR_XI_SQUAD_SIZE }, () => "")];
  const used = new Set([...excluded, ...benchIds.filter(Boolean)]);
  const positions = formationPositions.slice(0, STAR_XI_SQUAD_SIZE);
  const rest = [...new Set(ownedIds)]
    .filter((playerId) => !used.has(playerId))
    .map((playerId) => getStarXIPlayer(playerId))
    .filter((player): player is StarXIPlayer => Boolean(player) && positions.some((position) => canStarXIPlayerPlayPosition(player, position)))
    .sort((a, b) => getStarXISelectionRating(b, context) - getStarXISelectionRating(a, context) || a.id.localeCompare(b.id));
  // One dedicated substitute goalkeeper is enough; the free seats go to outfield players first.
  const keeperOnBench = () => benchIds.some((id) => id && isDedicatedStarXIGoalkeeper(getStarXIPlayer(id)!));
  for (let index = 0; index < benchIds.length; index += 1) {
    if (benchIds[index]) continue;
    const pick = rest.find((player) => !keeperOnBench() || !isDedicatedStarXIGoalkeeper(player)) ?? rest[0];
    if (!pick) break;
    benchIds[index] = pick.id;
    rest.splice(rest.indexOf(pick), 1);
  }
  return benchIds;
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
  const selected = selectedIds.map((id) => getStarXIPlayer(id)).filter((player): player is StarXIPlayer => Boolean(player && !player.benchOnly));
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
  // Day form only sets the tone; goals, conceded goals and actions decide the rest.
  const targetRating = 5.9 + dayForm * 1.6;
  const openingRating = 6.35 + (getMatchSeed(playerId, matchStartedAt, 4) - 0.5) * 0.45;
  const playedMinutes = Math.max(0, minute - enteredAtMinute + 1);
  const progress = clamp(playedMinutes / 75, 0, 1);
  const revealCurve = 0.12 + 0.88 * (1 - (1 - progress) ** 1.15);
  const gentleDrift = (getMatchSeed(playerId, matchStartedAt, 5) - 0.5) * 0.2 * Math.sin(progress * Math.PI);
  const goalBoost = Math.min(1.8, Math.max(0, goals) * 0.6);
  const roleStability = position === "TW" || position === "IV" ? 0.04 : 0;
  return Math.round(clamp(openingRating + (targetRating - openingRating) * revealCurve + gentleDrift + goalBoost + performanceImpact + roleStability, 4.5, 10) * 10) / 10;
}

/**
 * What the score did to a player while he was on the pitch: every goal of his team lifts everyone a little,
 * every goal conceded costs everyone, the keeper and the defence most. Engines that already blame single
 * players for a goal (`ratingImpacts` below zero) keep that instead of the role penalty.
 */
export function getMatchScoreImpact(cup: Pick<CupState, "matchEvents">, from: number, to: number, position?: StarPosition | null) {
  const defence = position === "TW" ? .3 : position === "IV" || position === "LV" || position === "LAV" || position === "RV" || position === "RAV" ? .22 : position === "ZDM" ? .12 : 0;
  let team = 0, conceded = 0;
  for (const event of cup.matchEvents) {
    if (event.minute < from || event.minute > to) continue;
    if (event.side === "home") team += .1;
    else { team -= .12; if (!Object.values(event.ratingImpacts).some((impact) => impact < 0)) conceded -= defence; }
  }
  return { team, conceded };
}

export function getCupPlayerMatchRating(cup: CupState, playerId: string, minute: number) {
  const enteredAtMinute = cup.playerEnteredAt[playerId];
  if (getStarXIPlayer(playerId)?.benchOnly || !enteredAtMinute || minute < enteredAtMinute) return null;
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
  const score = getMatchScoreImpact(cup, enteredAtMinute, effectiveMinute, position);
  return getStarXIPlayerMatchRating(playerId, cup.careerRatingSeed ?? cup.matchStartedAt, effectiveMinute, 0, enteredAtMinute, eventImpact + cleanSheetBoost + score.team + score.conceded + recordedActionRating(cup,playerId,effectiveMinute), position);
}


export function applyCupSubstitution(cup: CupState, outgoingPlayerId: string | undefined, incomingPlayerId: string, minute: number, now = Date.now()): CupSubstitutionImpact {
  const incoming = getStarXIPlayer(incomingPlayerId);
  const outgoing = outgoingPlayerId ? getStarXIPlayer(outgoingPlayerId) : undefined;
  if (!incoming || incoming.benchOnly || !outgoing) return { cup, incomingRating: incoming?.rating ?? 0, outgoingRating: outgoing?.rating ?? 0, ratingDelta: 0, outgoingMatchRating: 6.5, momentumDelta: 0 };

  cup = resumeCupMatch(cup, now);
  const substitutionMinute = Math.max(1, Math.min(120, Math.floor(Number(minute) || 1)));
  const outgoingMatchRating = getCupPlayerMatchRating(cup, outgoing.id, substitutionMinute) ?? 6.5;
  // Same prepared match ratings (milestone card and form) the engine uses for every starter.
  const matchRating = (player: StarXIPlayer) => Math.min(100, player.rating + (cup.careerBonuses?.[player.id] ?? 0));
  const incomingRating = matchRating(incoming), outgoingRating = matchRating(outgoing);
  const ratingDelta = Math.round((incomingRating - outgoingRating) * 10) / 10;
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
    cup: { ...cup, broadcast: addBroadcastSubstitution(cup, outgoing.id, incoming.id, substitutionMinute), matchMomentum: nextMomentum, allTimeAppearances, matchPaused: false, lastResult: `Wechsel: ${incoming.name} für ${outgoing.name}. ${ratingLabel} · Momentum ${momentumLabel}.` },
    incomingRating,
    outgoingRating,
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
    return total + Math.min(100, player.rating + (cup.careerBonuses?.[player.id] ?? 0)) + (liveForm - 6.5) * 2.8;
  }, missing * 55);
  const squadRating = Math.round((effectiveTotal / STAR_XI_SQUAD_SIZE) * 10) / 10;
  const momentumRating = (Number(cup.matchMomentum) || 0) * CUP_MOMENTUM_RATING_WEIGHT;
  return clamp(squadRating - sentOff.size * RED_CARD_MATCH_RATING_DROP - injured.size * 3 + momentumRating, 40, 100);
}

export function getStarPack(id: string) {
  return [...STAR_PACKS,...REWARD_PACKS].find((pack) => pack.id === id);
}

export function getTournament(id: string) {
  return TOURNAMENTS.find((tournament) => tournament.id === id);
}

function boundedRandom(random: () => number) {
  const value = Number(random());
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
}

/** Unsigned 32 bit seed for the next tournament draw. */
export function newTournamentDrawSeed(random: () => number = Math.random) {
  return Math.floor(boundedRandom(random) * 0x100000000) >>> 0;
}

function isDrawSeed(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffffffff;
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

/** Saves from before the stored draw get a seed from their own match history, the same on every device. */
function legacyTournamentDrawSeed(cup: Record<string, unknown>) {
  let hash = 2166136261;
  for (const char of `${Number(cup.matchStartedAt) || 0}:${Number(cup.wins) || 0}:${Number(cup.best) || 0}:${JSON.stringify(cup.allTimeAppearances ?? {}).length}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
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
  void strategyId; void opponentStrategyId;
  return {score:50,label:'Neutral',tone:'neutral' as const};
}

export function getCupMatchStrength(cup: CupState, starRating: number) {
  const tournament = getTournament(cup.tournamentId) ?? TOURNAMENTS[0];
  const opponent = getCupOpponent(cup, tournament);
  const opponentRating = cup.opponentRating || opponent.rating;
  const opponentStrategyId = cup.opponentStrategyId || opponent.strategyId;
  const tactical = getCupTacticalMatchup(cup.strategyId, opponentStrategyId);
  const teamStrength = clamp(starRating,40,100);
  const opponentStrength = opponentRating;
  return {
    teamStrength: Math.round(teamStrength * 10) / 10,
    opponentStrength: Math.round(opponentStrength * 10) / 10,
    opponentRating,
    opponentStrategyId,
    tactical,
  };
}

export function openStarPack(packId: StarPackId, ownedIds: string[], random = Math.random, formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS): StarPackOpening {
  void formationPositions;
  const pack = getStarPack(packId) ?? getStarPack("scout")!;
  if(isRewardPack(pack.id)) {
    const groups=getRewardPackOdds(pack.id);let cursor=0;const roll=boundedRandom(random);
    const group=groups.find(o=>(cursor+=o.chance)>roll)??groups.at(-1)!;
    const player=group.players[Math.min(group.players.length-1,Math.floor(boundedRandom(random)*group.players.length))];
    const duplicate=ownedIds.includes(player.id);
    return {packId:pack.id,packName:pack.label,player,duplicate,fragmentCompensation:duplicate?getStarXIFragmentCompensation(player):0};
  }
  if (pack.id === 'scrap') {
    const owned = new Set(ownedIds);
    const player = drawScrapPlayer(SCRAP_PLAYERS, random);
    const duplicate = owned.has(player.id);
    return { packId: pack.id, packName: pack.label, player, duplicate, fragmentCompensation: duplicate ? getStarXIFragmentCompensation(player) : 0 };
  }
  const roll = Math.max(0, Math.min(0.999999, random()));
  let cursor = 0;
  const odds = pack.odds.find((entry) => {
    cursor += entry.chance;
    return roll <= cursor;
  }) ?? pack.odds[pack.odds.length - 1];
  const candidates = STAR_RATING_POOLS.get(`${odds.minRating}-${odds.maxRating}`) ?? STAR_XI_ACTIVE_PLAYERS;
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
  const player = selectionPool.length ? pickByPackWeight(selectionPool, Math.max(0, Math.min(0.999999, random()))) : STAR_XI_ACTIVE_PLAYERS[0];
  const duplicate = ownedIdSet.has(player.id);
  return { packId: pack.id, packName: pack.label, player, duplicate, fragmentCompensation: duplicate ? getStarXIFragmentCompensation(player) : 0 };
}

function startTournamentRound(cup: CupState, tournament: TournamentDefinition, round: number, now: number, resetStrategy = false, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, allowSavedOpponent = true): CupState {
  const opponent = getTournamentOpponentAt(tournament, round, cup.opponentIds, cup.opponent, cup.opponentRating, allowSavedOpponent);
  homePlayers = homePlayers.filter(p => !p.benchOnly);
  const playerEnteredAt = Object.fromEntries(homePlayers.map((player) => [player.id, 1]));
  const playerMatchPositions = Object.fromEntries(homePlayers.map((player, index) => [player.id, formationPositions[index] ?? player.position])) as Record<string, StarPosition>;
  const allTimeAppearances = { ...(cup.allTimeAppearances ?? {}) };
  homePlayers.forEach((player) => {
    allTimeAppearances[player.id] = Math.max(0, Math.floor(Number(allTimeAppearances[player.id]) || 0)) + 1;
  });
  return {
    ...cup,
    simulation: undefined,
    broadcast: undefined,
    careerRatingSeed: now,
    careerMatchId: `career-${now}-tournament-${opponent.name}`,
    careerBonuses: undefined,
    mode: "tournament",
    tournamentId: tournament.id,
    round,
    active: true,
    phase: "regular",
    matchStartedAt: now,
    regularDurationMs: tournamentMatchDuration(tournament.minimumRating),
    halftimeTaken: false,
    timedPause: undefined,
    restartAt: now,
    restartSide: "club",
    matchEndsAt: now + tournamentMatchDuration(tournament.minimumRating),
    lastTickAt: now,
    homeScore: 0,
    awayScore: 0,
    opponent: opponent.name,
    opponentRating: opponent.rating,
    opponentStrategyId: opponent.strategyId,
    opponentIds: [...cup.opponentIds],
    strategyId: resetStrategy ? "konter" : cup.strategyId,
    substitutionsUsed: 0,
    subWindowsUsed: 0,
    pendingSubstitutions: undefined,
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

export function beginCupMatch(cup: CupState, now = Date.now(), tournamentId = cup.tournamentId, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, originalLineupIds: readonly string[] = homePlayers.map((player) => player.id), originalBenchIds: readonly string[] = [], random = Math.random, plannedOpponentIds?: readonly string[]): CupState {
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
  const opponentIds = plannedOpponentIds?.length === tournament.rounds ? [...plannedOpponentIds] : getTournamentOpponentSchedule(tournament, random);
  return startTournamentRound({ ...cup, round: 0, opponentIds, drawSeed: newTournamentDrawSeed(random), pendingNextRound: false, nextTournamentAt: 0, suspendedPlayerIds: [], originalLineupIds: [...originalLineupIds], originalBenchIds: [...originalBenchIds] }, tournament, 0, now, true, homePlayers, formationPositions);
}

export function beginSeasonCupMatch(cup: CupState, seasonValue: unknown, now = Date.now(), homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS, originalLineupIds: readonly string[] = homePlayers.map((player) => player.id), originalBenchIds: readonly string[] = []): CupState {
  const season = normalizeSeasonModeState(seasonValue);
  const opponent = getSeasonModeNextOpponent(season);
  homePlayers = homePlayers.filter(p => !p.benchOnly);
  const playerEnteredAt = Object.fromEntries(homePlayers.map((player) => [player.id, 1]));
  const playerMatchPositions = Object.fromEntries(homePlayers.map((player, index) => [player.id, formationPositions[index] ?? player.position])) as Record<string, StarPosition>;
  const allTimeAppearances = { ...(cup.allTimeAppearances ?? {}) };
  homePlayers.forEach((player) => {
    allTimeAppearances[player.id] = Math.max(0, Math.floor(Number(allTimeAppearances[player.id]) || 0)) + 1;
  });
  return {
    ...cup,
    simulation: undefined,
    broadcast: undefined,
    careerRatingSeed: now,
    careerMatchId: `career-${now}-season-${opponent.name}`,
    careerBonuses: undefined,
    mode: "season",
    tournamentId: "stadium",
    round: 0,
    active: true,
    phase: "regular",
    matchStartedAt: now,
    regularDurationMs: season.division>=14?240000:210000,
    halftimeTaken: false,
    timedPause: undefined,
    restartAt: now,
    restartSide: "club",
    matchEndsAt: now + (season.division>=14?240000:210000),
    lastTickAt: now,
    homeScore: 0,
    awayScore: 0,
    opponent: opponent.name,
    opponentRating: opponent.rating,
    opponentStrategyId: opponent.strategyId,
    opponentIds: [opponent.id],
    strategyId: cup.strategyId,
    substitutionsUsed: 0,
    subWindowsUsed: 0,
    pendingSubstitutions: undefined,
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




function selectWeightedPlayer(candidates: { player: StarXIPlayer; weight: number }[], random: () => number) {
  const totalWeight = candidates.reduce((total, candidate) => total + Math.max(0, candidate.weight), 0);
  let cursor = clamp(random(), 0, 0.999999) * totalWeight;
  for (const candidate of candidates) {
    cursor -= Math.max(0, candidate.weight);
    if (cursor <= 0) return candidate.player;
  }
  return candidates[candidates.length - 1]?.player;
}

function matchAttribute(player:StarXIPlayer,key:string){
 const stats=player.originalAttributes?.stats as Record<string,{value:number}>|undefined;
 return Number.isFinite(stats?.[key]?.value)?stats![key].value:player.rating;
}
function selectHomeScorer(homePlayers: readonly StarXIPlayer[], cup: CupState, minute: number, random: () => number, formationPositions: readonly StarPosition[], matchEvents: readonly CupGoalEvent[]) {
  if (!homePlayers.length) return undefined;
  const liveCup = { ...cup, matchEvents: [...matchEvents] };
  const candidates = homePlayers.map((player, index) => {
    const position = cup.playerMatchPositions[player.id] ?? formationPositions[index] ?? player.position;
    const skill = 0.4 + ((clamp(player.rating, 67, 100) - 67) / 33) ** 1.7 * 1.6;
    const form = clamp(0.55 + ((getCupPlayerMatchRating(liveCup, player.id, minute) ?? 6.4) - 5) * 0.25, 0.55, 1.7);
    return { player, weight: GOAL_POSITION_WEIGHTS[position] * skill * form * clamp(1+(matchAttribute(player,'finishing')-player.rating)/100,.7,1.3) };
  });
  return selectWeightedPlayer(candidates, random);
}

function selectHomeAssist(homePlayers: readonly StarXIPlayer[], scorerId: string | undefined, formationPositions: readonly StarPosition[], random: () => number,cup:CupState) {
  const candidates = homePlayers.filter((player) => player.id !== scorerId).map((player) => {
    const index = homePlayers.findIndex((candidate) => candidate.id === player.id);
    const position = cup.playerMatchPositions[player.id] ?? formationPositions[index] ?? player.position;
    return { player, weight: ASSIST_POSITION_WEIGHTS[position] * (0.7 + matchAttribute(player,'shortPassing') / 100) };
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

/** One match served for every injury, except those picked up in this very match: they start with the next one. */
function decrementCupInjuries(injuredPlayerIds: Record<string, number>, injuredThisMatch: readonly { playerId: string }[] = []) {
  const fresh = new Set(injuredThisMatch.map((injury) => injury.playerId));
  return Object.fromEntries(Object.entries(injuredPlayerIds).map(([playerId, matches]) => [playerId, Math.max(0, Math.floor(Number(matches) || 0) - (fresh.has(playerId) ? 0 : 1))]).filter(([, matches]) => Number(matches) > 0));
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
      injuredPlayerIds: decrementCupInjuries(cup.injuredPlayerIds ?? {}, cup.injuryEvents ?? []),
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
    injuredPlayerIds: decrementCupInjuries(cup.injuredPlayerIds ?? {}, cup.injuryEvents ?? []),
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
    ? `${tournament.trophyName}${decisionLabel} gewonnen! Deine Prämie wartet im Packbereich.`
    : `Turnieraus in Runde ${completedRound} gegen ${cup.opponent}${decisionLabel}.`;
  return { cup: nextCup, ...baseResult, finished: true, won, tieBreak, tournamentWon, runEnded: true, completedRound };
}

export function advanceCupMatch(cup: CupState, starRating: number, now = Date.now(), random = Math.random, homePlayers: readonly StarXIPlayer[] = [], formationPositions: readonly StarPosition[] = STAR_XI_FORMATION_POSITIONS) {
  const baseResult = getCupBaseResult(cup, starRating);
  if (!cup.active) return { cup, ...baseResult };
  if(cup.timedPause){
    if(now<cup.timedPause.endsAt)return {cup,...baseResult};
    const pause=cup.timedPause;
    const shifted=shiftCupTimeline(cup,pause.endsAt-pause.frozenAt);
    const goal=cup.matchEvents.find(e=>e.id===pause.id);
    cup={...shifted,matchEvents:cup.matchEvents,lastGoal:cup.lastGoal,cardEvents:cup.cardEvents,injuryEvents:cup.injuryEvents,lastInjury:cup.lastInjury,broadcast:cup.broadcast,timedPause:undefined,halftimeTaken:cup.halftimeTaken||pause.kind==='halftime',restartAt:pause.endsAt,restartSide:pause.kind==='halftime'?'opponent':goal?.side==='home'?'opponent':'club'};
  }
  if (cup.matchPaused) return { cup, ...baseResult };
  if (cup.phase === "penalties") return { cup, ...baseResult };
  if (cup.simulation) {
    const next = advanceInteractive(cup, now);
    if (next.matchPaused || next.simulation!.time < (cup.phase === 'extra-time' ? 7200 : 5400)) return {cup:next,...baseResult};
    if (cup.mode === 'season' || next.homeScore !== next.awayScore) {
      next.simulation!.status='completed';
      return finishCupRound(next, starRating, next.homeScore > next.awayScore, now, false);
    }
    if(cup.phase === 'regular') return {cup:{...next,phase:'extra-time' as const,matchEndsAt:cup.matchEndsAt+getCupRegularDurationMs(cup)/3,lastResult:'Verlängerung bis 120′.'},...baseResult};
    next.simulation!.status='completed';
    return {cup:{...next,phase:'penalties' as const,penaltyTurn:'home' as const,lastResult:'Elfmeterschiessen. Wähle eine Richtung.'},...baseResult};
  }
  const halfAt=cup.matchStartedAt+getCupRegularDurationMs(cup)/2;
  if(!cup.halftimeTaken && cup.lastTickAt>halfAt)cup={...cup,halftimeTaken:true};
  const endAt = Math.max(cup.matchStartedAt, Math.min(now, cup.matchEndsAt, !cup.halftimeTaken&&cup.phase==='regular'?halfAt:Infinity));
  const from = Math.max(cup.matchStartedAt, Math.min(cup.lastTickAt || cup.matchStartedAt, endAt));
  const regularSeconds = getCupRegularDurationMs(cup) / 1000;
  const phaseSeconds = cup.phase === "extra-time" ? regularSeconds / 3 : regularSeconds;
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
  let activeHomePlayers = homePlayers.filter((player) => !player.benchOnly && !sentOffPlayerIds.includes(player.id) && !(Number(injuredPlayerIds[player.id]) > 0));
  const allTimeScorers = { ...cup.allTimeScorers };
  let lastResult = cup.lastResult;
  let currentStarRating = starRating;
  let matchMomentum = clamp(Number(cup.matchMomentum) || 0, -CUP_MAX_MOMENTUM, CUP_MAX_MOMENTUM);
  let matchPaused = false;
  let goalPause: CupState['timedPause'];
  let processedUntil = from;
  const getScoringChances = (liveStarRating: number) => {
    const liveStrength = getCupMatchStrength(cup, liveStarRating);
    const opponentDismissals = new Set(cardEvents.filter(e => e.side === 'away').map(e => e.playerId)).size;
    const liveStrengthDifference = liveStrength.teamStrength - liveStrength.opponentStrength + opponentDismissals * RED_CARD_MATCH_RATING_DROP;
    const technical=activeHomePlayers.reduce((n,p)=>n+(matchAttribute(p,'finishing')+matchAttribute(p,'shortPassing')+matchAttribute(p,'dribbling')-p.rating*3)/3,0)/Math.max(1,activeHomePlayers.length);
    const backline=activeHomePlayers.filter(p=>['TW','IV','LV','RV','ZDM'].includes(cup.playerMatchPositions[p.id]??p.position));
    const defence=backline.reduce((n,p)=>n+matchAttribute(p,p.position==='TW'?'gkReflexes':'standingTackle')-p.rating,0)/Math.max(1,backline.length);
    const homeExpectedGoals = clamp(0.55 + liveStrength.teamStrength * 0.014 + liveStrengthDifference * 0.07 + clamp(technical*.008,-.15,.15), 0.15, 5.2);
    const awayExpectedGoals = clamp(0.55 + liveStrength.opponentStrength * 0.014 - liveStrengthDifference * 0.07 - clamp(defence*.008,-.15,.15), 0.15, 5.2);
    return { homeChance: homeExpectedGoals / regularSeconds, awayChance: awayExpectedGoals / regularSeconds };
  };
  let { homeChance, awayChance } = getScoringChances(currentStarRating);
  for (let second = 0; second < seconds; second += 1) {
    let redCardOccurred = false;
    const goalAt = from + (second + 1) * 1000;
    processedUntil = goalAt;
    const minute = getCupMatchMinute(cup, goalAt);
    if (activeHomePlayers.length > 7 && random() < RED_CARD_CHANCE_PER_SECOND * 180 / regularSeconds) {
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
    const opponentRoster = cup.broadcast?.opponentXI ?? createMatchBroadcast(cup).opponentXI;
    const opponents = opponentRoster.filter(p => !cardEvents.some(e => e.side === 'away' && e.playerId === p.id));
    if (opponents.length > 7 && random() < RED_CARD_CHANCE_PER_SECOND * 180 / regularSeconds) {
      const defenders = opponents.filter(p => ['IV','LV','RV','ZDM'].includes(p.position));
      const pool = defenders.length ? defenders : opponents;
      const p = pool[Math.min(pool.length-1, Math.floor(boundedRandom(random)*pool.length))];
      const reason = getRedCardReason(p.position, random);
      cardEvents.push({id:`${goalAt}-${p.id}-red`,side:'away',playerId:p.id,player:p.name,reason,card:'red',minute,createdAt:goalAt,homeScore,awayScore});
      ({ homeChance, awayChance } = getScoringChances(currentStarRating));
      lastResult = `Rote Karte für ${p.name}. ${cup.opponent} spielt in Unterzahl.`;
      redCardOccurred = true;
    }
    const injuryRoll = random();
    if (!redCardOccurred && activeHomePlayers.length && cup.substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS && injuryRoll > 0 && injuryRoll < CUP_INJURY_CHANCE_PER_SECOND * 180 / regularSeconds) {
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
      const assist = selectHomeAssist(activeHomePlayers, scorer?.id, formationPositions, random,cup);
      const ratingImpacts: Record<string, number> = {};
      if (scorer) ratingImpacts[scorer.id] = 0.7;
      if (assist) ratingImpacts[assist.id] = (ratingImpacts[assist.id] ?? 0) + 0.25;
      lastGoal = { id: `${goalAt}-${homeScore}-${awayScore}-home`, side: "home", scorerId: scorer?.id ?? null, scorer: scorer?.name ?? "Dein Club", minute, createdAt: goalAt, homeScore, awayScore, ratingImpacts, assistId: assist?.id??null, assistName: assist?.name };
      lastGoal.pattern = chooseGoalPattern(lastGoal.id, scorer ? cup.playerMatchPositions[scorer.id] ?? scorer.position : "ST");
      if(lastGoal.pattern==='penalty'||lastGoal.pattern==='rebound'){if(assist)delete lastGoal.ratingImpacts[assist.id];lastGoal.assistId=null;lastGoal.assistName=undefined;}
      matchEvents = [...matchEvents, lastGoal].slice(-40);
      if (scorer) allTimeScorers[scorer.id] = (allTimeScorers[scorer.id] ?? 0) + 1;
    } else if (roll < homeChance + awayChance) {
      awayScore += 1;
      const opponentRoster = cup.broadcast?.opponentXI ?? createMatchBroadcast(cup).opponentXI;
      const opponentScorers = opponentRoster.filter(p=>!cardEvents.some(e=>e.side==='away'&&e.playerId===p.id)&&["ST","LF","RF","ZOM","MS"].includes(p.position)).map(p=>p.name);
      const scorer = opponentScorers[Math.floor(Math.max(0, Math.min(0.999999, random())) * opponentScorers.length)] ?? cup.opponent;
      const ratingImpacts = getConcededGoalRatingImpacts(activeHomePlayers, formationPositions, random);
      lastGoal = { pattern: chooseGoalPattern(`${goalAt}-${awayScore}-away`, "ST"), id: `${goalAt}-${homeScore}-${awayScore}-away`, side: "away", scorerId: opponentRoster.find(p=>p.name===scorer)?.id ?? null, scorer, minute, createdAt: goalAt, homeScore, awayScore, ratingImpacts };
      matchEvents = [...matchEvents, lastGoal].slice(-40);
    }
    if(lastGoal?.createdAt===goalAt){
      const lead=lastGoal.assistId?1150:750;
      goalPause={kind:'goal',id:lastGoal.id,startsAt:goalAt+lead,endsAt:goalAt+lead+4000,frozenAt:goalAt};
      break;
    }
  }
  const nextCup = { ...cup, timedPause:goalPause, homeScore, awayScore, lastTickAt: processedUntil, lastGoal, lastInjury, matchEvents, cardEvents, injuryEvents, sentOffPlayerIds, suspendedPlayerIds, injuredPlayerIds, playerExitedAt, allTimeScorers, lastResult, matchMomentum: Math.round(matchMomentum * 10) / 10, matchPaused };
  nextCup.broadcast = advanceMatchBroadcast(nextCup, homePlayers);
  for(const e of nextCup.broadcast.events.filter(e=>e.kind==='yellow')) {
    const yellows=nextCup.broadcast.events.filter(a=>a.kind==='yellow'&&a.side===e.side&&a.playerId===e.playerId&&a.at<=e.at);
    if(yellows.length<2||nextCup.cardEvents.some(c=>c.playerId===e.playerId))continue;
    const side=e.side==='club'?'home':'away';
    nextCup.cardEvents.push({id:`second-yellow:${e.id}`,side,playerId:e.playerId,player:e.player,reason:'zweites verwarnungswürdiges Foul',card:'red',minute:e.minute,createdAt:e.at,homeScore,awayScore});
    if(side==='home'){nextCup.sentOffPlayerIds.push(e.playerId);nextCup.suspendedPlayerIds.push(e.playerId);nextCup.playerExitedAt[e.playerId]=e.minute;}
  }
  const liveBaseResult = getCupBaseResult(cup, currentStarRating);
  if(goalPause||matchPaused)return {cup:nextCup,...liveBaseResult};
  if(!cup.halftimeTaken&&cup.phase==='regular'&&processedUntil>=halfAt){
    nextCup.timedPause={kind:'halftime',id:`half:${cup.careerMatchId??cup.careerRatingSeed??cup.matchStartedAt}`,startsAt:halfAt,endsAt:halfAt+10000,frozenAt:halfAt};
    nextCup.halftimeTaken=true;
    return {cup:nextCup,...liveBaseResult};
  }
  if (now < cup.matchEndsAt) return { cup: nextCup, ...liveBaseResult };
  if (homeScore !== awayScore) return finishCupRound(nextCup, currentStarRating, homeScore > awayScore, now, false);

  if (cup.phase === "regular") {
    return {
      cup: {
        ...nextCup,
        phase: "extra-time" as const,
        matchEndsAt: cup.matchEndsAt + getCupRegularDurationMs(cup) / 3,
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

// Shift the timeline when resuming, so an injury pause never catches up unseen play.
export function shiftCupTimeline(value: CupState, duration: number): CupState {
  if (duration <= 0) return value;
  return {...value, matchStartedAt:value.matchStartedAt+duration, matchEndsAt:value.matchEndsAt+duration, lastTickAt:value.lastTickAt+duration,
    careerRatingSeed:value.careerRatingSeed ?? value.matchStartedAt,
    lastGoal:value.lastGoal ? {...value.lastGoal,createdAt:value.lastGoal.createdAt+duration}:null,
    lastInjury:value.lastInjury ? {...value.lastInjury,createdAt:value.lastInjury.createdAt+duration}:null,
    matchEvents:value.matchEvents.map(e=>({...e,createdAt:e.createdAt+duration})),cardEvents:value.cardEvents.map(e=>({...e,createdAt:e.createdAt+duration})),injuryEvents:value.injuryEvents.map(e=>({...e,createdAt:e.createdAt+duration})),penaltyEvents:value.penaltyEvents.map(e=>({...e,createdAt:e.createdAt+duration})),
    broadcast:value.broadcast ? {...value.broadcast,events:value.broadcast.events.map(e=>({...e,at:e.at+duration}))} : value.broadcast};
}
export function resumeCupMatch(value: CupState, now = Date.now()) {
  if (!value.active || !value.matchPaused) return value;
  return { ...resumeInteractive(shiftCupTimeline(value,Math.max(0,now-value.lastTickAt))), matchPaused: false, lastResult: "Die Partie läuft weiter. Die medizinische Abteilung beobachtet den Rest von der Seitenlinie." };
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
    const opponentRoster = cup.broadcast?.opponentXI ?? createMatchBroadcast(cup).opponentXI;
      const opponentScorers = opponentRoster.filter(p=>["ST","LF","RF","ZOM","MS"].includes(p.position)).map(p=>p.name);
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


export function initialMissions() {
  return MISSION_TEMPLATES.map((mission) => ({ ...mission, claimed: false }));
}

export function initialGameFeatures(now = Date.now()): GameFeatures {
  return {
    schemaVersion: GAME_FEATURES_SCHEMA_VERSION,
    earnedPacks: [],
    completedTournamentRuns: [],
    travel: emptyTravel(),
    career: initialCareerState(),
    transferMarket: { offerIds: ["turbo", "wall", "maestro"], ownedIds: [] },
    starXI: { ownedIds: [], fragments: 0, lineupIds: Array.from({ length: STAR_XI_SQUAD_SIZE }, () => ""), benchIds: Array.from({ length: STAR_XI_BENCH_SIZE }, () => ""), formationId: "433", formationPositions: [...STAR_XI_FORMATION_POSITIONS] },
    club: { name: "FC Goal", badge: "⚽", color: "#0071e3" },
    cup: { active: false, mode: "season", phase: "regular", tournamentId: "stadium", round: 0, wins: 0, best: 0, trophies: { stadium: 0, champions: 0, world: 0 }, lastResult: "Noch kein Saisonspiel.", matchStartedAt: 0, matchEndsAt: 0, lastTickAt: 0, homeScore: 0, awayScore: 0, opponent: "", opponentRating: 58, opponentStrategyId: "ballbesitz", opponentIds: [], strategyId: "konter", substitutionsUsed: 0, matchMomentum: 0, originalLineupIds: [], originalBenchIds: [], playerEnteredAt: {}, playerExitedAt: {}, playerMatchPositions: {}, lastGoal: null, lastInjury: null, matchEvents: [], cardEvents: [], injuryEvents: [], sentOffPlayerIds: [], suspendedPlayerIds: [], injuredPlayerIds: {}, matchPaused: false, pendingNextRound: false, nextTournamentAt: 0, penaltyHomeScore: 0, penaltyAwayScore: 0, penaltyHomeTaken: 0, penaltyAwayTaken: 0, penaltyTurn: "home", penaltyEvents: [], penaltyMessage: "", allTimeScorers: {}, allTimeAppearances: {}, drawSeed: newTournamentDrawSeed() },
    seasonMode: initialSeasonMode("FC Goal"),
    goalBoost: { tournamentId: null, multiplier: 1, startedAt: 0, endsAt: 0 },
    missions: initialMissions(),
    history: [],
    randomEvent: null,
    starPackReveal: null,
    purchaseReceipts: [],
    discipline: emptyDiscipline(),
    transferSaga: { pendingOffer: null, unhappy: [], loans: [], vacancies: [], archive: [], latestEvent: null, lastFailedReason: "", nextAt: now + getTransferEventDelay(), deadlineDayStartedAt: 0, deadlineDayEndsAt: 0 },
    gazetteIssues: [],
    dailyRewards: {},
    press: normalizePress(undefined),
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
  const outcome: TransferInsiderOutcome | null = source.outcome === "loan" || source.outcome === "sale" || source.outcome === "failed" || source.outcome === "return" || source.outcome === "offer" || source.outcome === "declined" ? source.outcome : null;
  const createdAt = Math.floor(Number(source.createdAt) || 0);
  if (!outcome || createdAt <= 0) return null;
  const playerId = typeof source.playerId === "string" && (getStarXIPlayer(source.playerId) || source.side === "away" && /^opponent-([0-9]|10)$/.test(source.playerId)) ? source.playerId : null;
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
  const scorerId = typeof source.scorerId === "string" && (getStarXIPlayer(source.scorerId) || source.side === "away" && /^opponent-([0-9]|10)$/.test(source.scorerId)) ? source.scorerId : null;
  const ratingImpacts = Object.fromEntries(Object.entries(asRecord(source.ratingImpacts)).filter(([playerId, impact]) => Boolean(getStarXIPlayer(playerId)) && Number.isFinite(Number(impact)) && Number(impact) !== 0).map(([playerId, impact]) => [playerId, clamp(Number(impact), -2, 2)]));
  if (!Object.keys(ratingImpacts).length && source.side === "home" && scorerId) ratingImpacts[scorerId] = 0.7;
  return {
    pattern: ["one-on-one","low-shot","long-range","header","cross","rebound","corner","free-kick","penalty"].includes(String(source.pattern)) ? source.pattern as GoalPattern : undefined,
    id: safeString(source.id, "goal-event"),
    side: source.side,
    scorerId,
    scorer: safeString(source.scorer, source.side === "home" ? "Dein Club" : "Gegner"),
    minute: Math.max(1, Math.min(120, Math.floor(Number(source.minute) || 1))),
    createdAt: Math.floor(Number(source.createdAt)),
    homeScore: Math.max(0, Math.floor(Number(source.homeScore) || 0)),
    awayScore: Math.max(0, Math.floor(Number(source.awayScore) || 0)),
    ratingImpacts,
    assistId:source.assistId===null?null:typeof source.assistId==='string'&&(getStarXIPlayer(source.assistId)||source.side==='away'&&/^opponent-([0-9]|10)$/.test(source.assistId))?source.assistId:undefined,
    assistName:typeof source.assistName==='string'?source.assistName.slice(0,120):undefined,
  };
}

function normalizeCupCardEvent(value: unknown): CupCardEvent | null {
  const source = asRecord(value);
  if (typeof source.id !== "string" || (source.side !== "home" && source.side !== "away") || source.card !== "red" || Number(source.createdAt) <= 0) return null;
  const playerId = typeof source.playerId === "string" && (getStarXIPlayer(source.playerId) || source.side === "away" && /^opponent-([0-9]|10)$/.test(source.playerId)) ? source.playerId : null;
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

// A long career earns thousands of packs. Unopened ones always stay; of the opened ones only the latest are kept,
// together with the latest finished tournament runs, so every save stays well below the storage and request limits.
const MAX_OPENED_EARNED_PACKS = 100;
const MAX_COMPLETED_TOURNAMENT_RUNS = 200;
function keepRecentOpenedPacks(packs: EarnedPack[]) {
  const opened = packs.filter((pack) => pack.opening);
  if (opened.length <= MAX_OPENED_EARNED_PACKS) return packs;
  const dropped = new Set(opened.slice(0, opened.length - MAX_OPENED_EARNED_PACKS).map((pack) => pack.id));
  return packs.filter((pack) => !dropped.has(pack.id));
}

/** Schema 6 rebalance: 100 rated special cards drawn before Liga 3 leave the save once. Later draws stay. */
function removeEarlyHundredSpecialCards(source: Record<string, unknown>) {
  if (Number(source.schemaVersion) >= 6) return { source, removed: 0 };
  const seasonMode = asRecord(source.seasonMode);
  const highestDivision = Math.max(Math.floor(Number(seasonMode.highestDivision) || 0), Math.floor(Number(seasonMode.division) || 0), Math.floor(Number(source.seasons) || 0) + 1);
  if (hasReachedLeague(getPackUnlockLeague(SPECIAL_CARD_PACK.id), leagueForTier(highestDivision))) return { source, removed: 0 };
  const hundredIds = new Set(STAR_XI_CUSTOM_PLAYERS.filter(isHundredSpecialCard).map((player) => player.id));
  const starXI = asRecord(source.starXI);
  const ids = (value: unknown) => Array.isArray(value) ? value : [];
  const removed = new Set(ids(starXI.ownedIds).filter((id) => hundredIds.has(String(id)))).size;
  const career = asRecord(source.career);
  const squadLock = asRecord(source.squadLock);
  return {
    removed,
    source: {
      ...source,
      starXI: {
        ...starXI,
        ownedIds: ids(starXI.ownedIds).filter((id) => !hundredIds.has(String(id))),
        lineupIds: ids(starXI.lineupIds).map((id) => hundredIds.has(String(id)) ? "" : id),
        benchIds: ids(starXI.benchIds).map((id) => hundredIds.has(String(id)) ? "" : id),
        ...(Array.isArray(starXI.lockedPlayerIds) ? { lockedPlayerIds: starXI.lockedPlayerIds.filter((id) => !hundredIds.has(String(id))) } : {}),
      },
      ...(source.career ? { career: { ...career, collectedIds: ids(career.collectedIds).filter((id) => !hundredIds.has(String(id))) } } : {}),
      ...(Array.isArray(squadLock.playerIds) ? { squadLock: { ...squadLock, playerIds: squadLock.playerIds.filter((id) => !hundredIds.has(String(id))) } } : {}),
    } as Record<string, unknown>,
  };
}

/** Schema 8: every 100 rated card leaves the album once (collected status, milestones and the career
 * statistics they are earned from), whatever the league. A card in the squad stays in the squad. */
function clearHundredCardsFromAlbum(source: Record<string, unknown>) {
  if (Number(source.schemaVersion) >= 8 || !source.career) return { source, cleared: false };
  const hundredIds = new Set(STAR_XI_PLAYERS.filter((player) => player.rating >= 100).map((player) => player.id));
  const career = asRecord(source.career);
  const withoutHundreds = (value: unknown) => Object.fromEntries(Object.entries(asRecord(value)).filter(([id]) => !hundredIds.has(id)));
  const collectedIds = Array.isArray(career.collectedIds) ? career.collectedIds : [];
  const cleared = collectedIds.some((id) => hundredIds.has(String(id)))
    || [career.milestoneCards, career.players].some((value) => Object.keys(asRecord(value)).some((id) => hundredIds.has(id)));
  if (!cleared) return { source, cleared };
  return {
    cleared,
    source: {
      ...source,
      career: {
        ...career,
        collectedIds: collectedIds.filter((id) => !hundredIds.has(String(id))),
        milestoneCards: withoutHundreds(career.milestoneCards),
        milestoneCategories: withoutHundreds(career.milestoneCategories),
        players: withoutHundreds(career.players),
        seasonPlayers: withoutHundreds(career.seasonPlayers),
      },
    } as Record<string, unknown>,
  };
}

export function normalizeGameFeatures(value: unknown): GameFeatures {
  const migration = removeEarlyHundredSpecialCards(asRecord(value));
  const album = clearHundredCardsFromAlbum(migration.source);
  const source = album.source;
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
  const history: MatchHistoryEntry[] = Array.isArray(source.history) ? source.history.map((item) => asRecord(item)).filter((item) => typeof item.title === "string").slice(-30).map((item, index) => ({
    id: safeString(item.id, `history-${index}`),
    title: safeString(item.title, "Spielereignis"),
    detail: safeString(item.detail, ""),
    tone: item.tone === "negative" || item.tone === "positive" ? item.tone : "neutral",
    timestamp: Number(item.timestamp) || Date.now(),
  })) : [];
  const randomEventSource = asRecord(source.randomEvent);
  const randomEvent: RandomEvent | null = typeof randomEventSource.title === "string" ? {
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
    .filter((event): event is TransferInsiderEvent => event !== null && event.outcome !== "failed" && event.outcome !== "offer")
    .filter((event) => {
      if (archiveIds.has(event.id)) return false;
      archiveIds.add(event.id);
      return true;
    })
    .slice(-30);
  const deadlineDayStartedAt = Math.max(0, Math.floor(Number(transferSagaSource.deadlineDayStartedAt) || 0));
  const deadlineDayEndsAt = Math.max(deadlineDayStartedAt, Math.floor(Number(transferSagaSource.deadlineDayEndsAt) || 0));
  const offerSource = asRecord(transferSagaSource.pendingOffer);
  const offerEvent = normalizeTransferInsiderEvent(offerSource);
  const pendingOffer: TransferOffer | null = offerEvent?.outcome === "offer" && offerEvent.playerId && knownStarOwnedIds.includes(offerEvent.playerId) && Number(offerSource.expiresAt) > 0
    ? { ...offerEvent, expiresAt: Number(offerSource.expiresAt) }
    : null;
  const seenUnhappyIds = new Set<string>();
  const unhappy: TransferUnhappyPlayer[] = (Array.isArray(transferSagaSource.unhappy) ? transferSagaSource.unhappy : [])
    .map((item) => asRecord(item))
    .filter((item) => typeof item.playerId === "string" && knownStarOwnedIds.includes(item.playerId) && !seenUnhappyIds.has(item.playerId) && Boolean(seenUnhappyIds.add(item.playerId)))
    .map((item) => ({ playerId: String(item.playerId), club: safeString(item.club, "Auswärtiger Club").slice(0, 42), matchesLeft: Math.max(0, Math.min(TRANSFER_UNHAPPY_MATCHES, Math.floor(Number(item.matchesLeft) || 0))) }))
    .filter((item) => item.matchesLeft > 0);
  const transferSaga: TransferSagaState = {
    pendingOffer,
    unhappy,
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
  const savedLock = normalizeSquadLock(source.squadLock ?? asRecord(asRecord(source.travel).journey).squadLock);
  // The matchday squad is only fixed while the match runs; on the way there the lineup may still change.
  const normalizedStarXI = removeStarXIPlayersFromSquad(normalizeStarXIState({...starXI, lockedPlayerIds:active?savedLock?.playerIds:undefined}, loanedPlayerIds), [...new Set([...suspendedPlayerIds, ...Object.keys(injuredPlayerIds)])], !active);
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
  const normalized: GameFeatures = {
    schemaVersion: GAME_FEATURES_SCHEMA_VERSION,
    completedTournamentRuns: Array.isArray(source.completedTournamentRuns)?[...new Set(source.completedTournamentRuns.filter((id):id is string=>typeof id==='string'))].slice(-MAX_COMPLETED_TOURNAMENT_RUNS):[],
    earnedPacks: keepRecentOpenedPacks((Array.isArray(source.earnedPacks)?source.earnedPacks:[]).map(asRecord).filter(p=>typeof p.id==='string'&&isRewardPack(String(p.packId))).filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i).map(p=>{const saved=asRecord(p.opening),player=getStarXIPlayer(String(asRecord(saved.player).id));return {id:String(p.id),packId:p.packId as RewardPackId,earnedAt:Number(p.earnedAt)||0,...(player?{opening:{packId:p.packId as RewardPackId,packName:getStarPack(String(p.packId))!.label,player,duplicate:saved.duplicate===true,fragmentCompensation:Math.max(0,Number(saved.fragmentCompensation)||0)}}:{})};})),
    travel: normalizeTravel(source.travel),
    miniGameRuns: Object.fromEntries(Object.entries(asRecord(source.miniGameRuns)).filter(([key, startedAt]) => /^[a-z]+:[a-z0-9]+$/.test(key) && Number.isFinite(Number(startedAt))).slice(0, 16).map(([key, startedAt]) => [key, Number(startedAt)])),
    squadLock: normalizeSquadLock(source.squadLock ?? asRecord(asRecord(source.travel).journey).squadLock),
    career: normalizeCareerState(source.career, [...normalizedStarXI.ownedIds, ...loans.map(loan => loan.playerId)], { ...defaults.cup, ...cup, allTimeScorers, allTimeAppearances, playerEnteredAt, matchEvents, active } as CupState),
    transferMarket: { offerIds: offerIds.length ? offerIds : defaults.transferMarket.offerIds, ownedIds: [...new Set(ownedIds)] },
    starXI: { ...normalizedStarXI, lockedPlayerIds: active ? savedLock?.playerIds : undefined },
    club: { name: clubName, badge: CLUB_BADGES.includes(String(club.badge)) ? String(club.badge) : defaults.club.badge, color: CLUB_COLORS.includes(String(club.color)) ? String(club.color) : defaults.club.color },
    cup: { simulation: normalizeInteractive(cup.simulation), restartAt:Number.isFinite(cup.restartAt)?Number(cup.restartAt):undefined, restartSide:cup.restartSide==='opponent'?'opponent':'club', regularDurationMs: Number(cup.regularDurationMs)>=180000&&Number(cup.regularDurationMs)<=300000?Number(cup.regularDurationMs):undefined, halftimeTaken:cup.halftimeTaken===true, timedPause:normalizeTimedPause(cup.timedPause), subWindowsUsed: Math.min(3,Math.max(0,Math.floor(Number(cup.subWindowsUsed)||0))), pendingSubstitutions: normalizePendingSubstitutions(cup.pendingSubstitutions), broadcast: normalizeMatchBroadcast(cup.broadcast), fixture: cup.fixture && typeof cup.fixture==='object' ? cup.fixture as CupState['fixture'] : undefined, drawSeed: isDrawSeed(cup.drawSeed) ? cup.drawSeed : legacyTournamentDrawSeed(cup), careerRatingSeed: Number.isFinite(Number(cup.careerRatingSeed)) && Number(cup.careerRatingSeed) > 0 ? Number(cup.careerRatingSeed) : matchStartedAt, careerMatchId: typeof cup.careerMatchId === "string" ? cup.careerMatchId.slice(0, 200) : undefined, careerBonuses: Object.fromEntries(Object.entries(asRecord(cup.careerBonuses)).filter(([id, value]) => getStarXIPlayer(id) && Number.isFinite(Number(value))).map(([id, value]) => [id, clamp(Number(value), -2 - TRANSFER_UNHAPPY_PENALTY, 5)])), active, mode, phase, tournamentId, round, wins: Math.max(0, Math.floor(Number(cup.wins) || 0)), best: Math.max(0, Math.min(TOURNAMENTS[TOURNAMENTS.length - 1].rounds, Math.floor(Number(cup.best) || 0))), trophies, lastResult: safeString(cup.lastResult, defaults.cup.lastResult), matchStartedAt, matchEndsAt, lastTickAt, homeScore: Math.max(0, Math.floor(Number(cup.homeScore) || 0)), awayScore: Math.max(0, Math.floor(Number(cup.awayScore) || 0)), opponent: normalizedOpponentName, opponentRating: normalizedOpponentRating, opponentStrategyId, opponentIds, strategyId, substitutionsUsed: Math.max(0, Math.min(STAR_XI_MAX_SUBSTITUTIONS, Math.floor(Number(cup.substitutionsUsed) || 0))), matchMomentum, originalLineupIds, originalBenchIds, playerEnteredAt, playerExitedAt, playerMatchPositions, lastGoal, lastInjury, matchEvents, cardEvents, injuryEvents, sentOffPlayerIds, suspendedPlayerIds, injuredPlayerIds, matchPaused: active && cup.matchPaused === true && (Boolean(lastInjury) || Boolean(cup.simulation)), pendingNextRound, nextTournamentAt, penaltyHomeScore: Math.max(0, Math.floor(Number(cup.penaltyHomeScore) || 0)), penaltyAwayScore: Math.max(0, Math.floor(Number(cup.penaltyAwayScore) || 0)), penaltyHomeTaken: Math.max(0, Math.floor(Number(cup.penaltyHomeTaken) || 0)), penaltyAwayTaken: Math.max(0, Math.floor(Number(cup.penaltyAwayTaken) || 0)), penaltyTurn: cup.penaltyTurn === "away" ? "away" : "home", penaltyEvents, penaltyMessage: typeof cup.penaltyMessage === "string" ? cup.penaltyMessage.slice(0, 180) : "", allTimeScorers, allTimeAppearances },
    seasonMode: normalizedSeasonMode,
    goalBoost,
    missions,
    history,
    randomEvent,
    starPackReveal,
    purchaseReceipts: Array.isArray(source.purchaseReceipts) ? [...new Set(source.purchaseReceipts.filter((id): id is string => typeof id === "string").map((id) => id.slice(0, 80)))].slice(-PURCHASE_RECEIPT_LIMIT) : [],
    discipline: normalizeDiscipline(source.discipline),
    transferSaga,
    gazetteIssues,
    dailyRewards: normalizeDailyRewards(source.dailyRewards),
    press: normalizePress(source.press),
    nextEventAt: Number(source.nextEventAt) > 0 ? Number(source.nextEventAt) : defaults.nextEventAt,
    nextVarAt: Number(source.nextVarAt) > 0 ? Number(source.nextVarAt) : defaults.nextVarAt,
  };
  if (migration.removed) addHistory(normalized, { title: "Spezialkarten neu verteilt", detail: `${migration.removed} 100er ${migration.removed === 1 ? "Karte wurde" : "Karten wurden"} entfernt. Das Spezialkarten-Pack öffnet ab Liga ${getPackUnlockLeague(SPECIAL_CARD_PACK.id)}.`, tone: "neutral" });
  if (album.cleared) addHistory(normalized, { title: "Sammelalbum bereinigt", detail: "100er Karten zählen nicht mehr als gesammelt, ihre Meilensteine sind entfernt.", tone: "neutral" });
  return normalized;
}

export function pauseGameFeatureTimers(value: unknown, pausedMs: number, now = Date.now()): GameFeatures {
  const features = normalizeGameFeatures(value);
  const duration = Math.max(0, Math.floor(Number(pausedMs) || 0));
  if (duration <= 0) return features;
  features.nextEventAt += duration;
  features.nextVarAt += duration;
  features.transferSaga.nextAt += duration;
  if (features.transferSaga.pendingOffer) features.transferSaga.pendingOffer.expiresAt += duration;
  if (features.cup.active && (!features.cup.simulation || features.cup.matchPaused)) {
    features.cup = shiftCupTimeline(features.cup, duration);
  }
  const pausedAt = now - duration;
  if (features.goalBoost.endsAt > pausedAt) {
    features.goalBoost.startedAt += duration;
    features.goalBoost.endsAt += duration;
  }
  return features;
}


const TRANSFER_FAILURE_REASONS = [
  "der Medizincheck nicht bestanden wurde",
  "die Gehaltsforderung in letzter Minute zu hoch war",
  "die Unterlagen zu spät eingereicht wurden",
  "der Berater plötzlich nicht mehr erreichbar war",
  "sich die Clubs bei den Bonuszahlungen nicht einigen konnten",
  "{der Spieler} beim Club bleiben wollte",
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
  "{der Spieler} am Flughafen aus Versehen in den Ferienflieger nach Mallorca stieg",
  "der Berater sein Handy in einem Fondue versenkt hat",
  "Google Maps den Spieler zum Stadion des Erzrivalen geschickt hat",
  "die Vereinskatze über die Tastatur lief und drei Nullen zur Ablöse hinzufügte",
  "der neue Club nur mit Panini Stickern bezahlen wollte",
  "die gewünschte Rückennummer bereits dem Maskottchen gehörte",
  "{der Spieler} beim Fototermin das Trikot des falschen Clubs anzog",
  "der Präsident beim Unterschreiben einen Stift ohne Tinte erwischte",
  "die Präsentationsdrohne mit dem unterschriebenen Vertrag davongeflogen ist",
  "der Übersetzer Leihe mit Leier verwechselt hat",
  "{der Spieler} im falschen Gruppenchat schrieb, dass {er} eigentlich gar nicht wechseln wolle",
  "beim Medizincheck eine Kontaktlinse verloren ging und dadurch die Deadline verpasst wurde",
  "der Transferchef sein Passwort Transfer123 vergessen hat",
  "die Unterschrift versehentlich auf einer Pizzaschachtel statt auf dem Vertrag landete",
  "das Navi den Berater drei Stunden lang im Kreisverkehr festhielt",
  "der Club beim Videoanruf den Katzenfilter nicht mehr ausschalten konnte",
  "{der Spieler} glaubte, der Medizincheck sei ein Quiz, und nur Fussballfragen gelernt hatte",
  "das Vereinsmaskottchen den Vertrag gefressen hat",
  "die Siegespizza schon vor der Unterschrift geliefert wurde und alle die Deadline vergassen",
  "der Transfer im letzten Moment an einer fehlenden Büroklammer scheiterte",
  "{der Spieler} nur zugesagt hätte, wenn {er} Kapitän, Elfmeterspezialist und DJ wird",
  "der Präsident die Ablöse versehentlich in Schweizer Franken statt in Goals eingetragen hat",
  "der Scanner den Vertrag spiegelverkehrt gespeichert hat",
  "die Clublegende aus Versehen auf Ablehnen statt auf Annehmen klickte",
  "das neue Trikot beim Waschen auf Kindergrösse schrumpfte",
  "{der Spieler} beim Verhandlungstermin in einem Escape Room eingeschlossen war",
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
  if (event.outcome === "failed" || event.outcome === "offer") return;
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
  const runId=`${summary.tournamentId}:${features.cup.matchStartedAt}`;
  if(features.completedTournamentRuns.includes(runId))return features;
  features.completedTournamentRuns.push(runId);
  if(summary.tournamentWon){
    const pack=getTournamentRewardPack(summary.tournamentId,features.seasonMode.highestDivision);
    features.earnedPacks.push({id:runId,packId:pack.id as RewardPackId,earnedAt:now});
    addHistory(features,{title:`${pack.label} gewonnen`,detail:'Deine Prämie wartet im Packbereich.',tone:'positive'},now);
  }
  features = startTransferDeadlineDay(features, now, random);
  return publishTournamentGazette(features, summary, now, random).features;
}

export function getEligibleEventPlayers(features:GameFeatures,position?:StarPosition) {
 const unavailable=new Set([...getUnavailableStarXIPlayerIds(features),...features.cup.sentOffPlayerIds]);
 return [...new Set([...features.starXI.lineupIds,...features.starXI.benchIds])].filter(id=>features.starXI.ownedIds.includes(id)&&!unavailable.has(id)).map(getStarXIPlayer).filter((p):p is StarXIPlayer=>Boolean(p)&&(!position||p!.positions.includes(position)));
}

export function getLoanedStarXIPlayerIds(features: GameFeatures) {
  return features.transferSaga.loans.map((loan) => loan.playerId);
}

export function getUnavailableStarXIPlayerIds(features: GameFeatures) {
  const injuredIds = Object.entries(features.cup.injuredPlayerIds ?? {}).filter(([, matches]) => Number(matches) > 0).map(([playerId]) => playerId);
  return [...new Set([...features.cup.suspendedPlayerIds, ...injuredIds, ...getLoanedStarXIPlayerIds(features), ...(features.squadLock&&features.cup.active?features.starXI.ownedIds.filter(id=>!features.squadLock!.playerIds.includes(id)):[])])];
}

/** Players the automatic best eleven must leave out: unavailable ones plus players banned
 * after yellow cards for the competition the squad prepares for next. */
export function getBestXIUnavailablePlayerIds(features: GameFeatures) {
  return [...new Set([...getUnavailableStarXIPlayerIds(features), ...getBannedPlayerIds(features, nextCompetition(features))])];
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
  // While an offer waits for an answer, Fabrizio brings no new rumours.
  if (features.squadLock || features.transferSaga.pendingOffer) return { features, event: null, goalDelta: 0 };
  const deadlineDay = isTransferDeadlineDay(features, now);
  const loanChance = deadlineDay ? TRANSFER_DEADLINE_LOAN_CHANCE : TRANSFER_LOAN_CHANCE;
  const eventRoll = clamp(random(), 0, 0.999999);
  const requestedOutcome: "loan" | "sale" | "failed" = eventRoll < loanChance
    ? "loan"
    : eventRoll < loanChance + TRANSFER_SALE_CHANCE
      ? "sale"
      : "failed";
  const loanedIds = new Set(getLoanedStarXIPlayerIds(features));
  const squadCandidateIds = [...new Set([...features.starXI.lineupIds, ...features.starXI.benchIds])]
    .filter((playerId) => Boolean(playerId) && features.starXI.ownedIds.includes(playerId) && !loanedIds.has(playerId) && Boolean(getStarXIPlayer(playerId)));
  const candidateStartIndex = transferRandomIndex(squadCandidateIds.length, random);
  const matchInProgress = features.cup.active;
  const candidateId: string | null = squadCandidateIds[candidateStartIndex] ?? null;
  const player = candidateId ? getStarXIPlayer(candidateId) ?? null : null;
  // Only clubs that would really sign a player of this rating ask for him.
  const clubs = player ? transferClubsForRating(player.rating) : TRANSFER_INTERESTED_CLUBS;
  const club = clubs[transferRandomIndex(clubs.length, random)] ?? clubs[0];
  const outcome = requestedOutcome !== "failed" && player && !matchInProgress ? requestedOutcome : "failed";
  let event: TransferInsiderEvent;
  // Sales are offers now; their fee arrives with acceptTransferOffer.
  const goalDelta = 0;

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
        : `Fabrizio Romario meldet: ${player.name} wechselt auf Leihbasis zu ${club} und fehlt deinem Club in ${competition.next}. Danach kehrt ${pronounText("{er}", player)} zurück.`,
      reason: joinsCurrentTournament ? `Leihe für den Rest ${competition.current}` : `Leihe für ${competition.article}`,
      fee: 0,
      createdAt: now,
    };
  } else if (outcome === "sale" && player) {
    // A sale is an offer the player answers: sell for the fee, or keep a player who then is unhappy.
    const paidSale = clamp(random(), 0, 0.999999) < TRANSFER_PAID_SALE_CHANCE;
    const fee = paidSale ? Math.max(0, Math.floor(player.price)) : 0;
    event = {
      id: `transfer-offer-${now}-${player.id}`,
      outcome: "offer",
      playerId: player.id,
      playerName: player.name,
      club,
      headline: paidSale ? "Angebot auf dem Tisch" : pronounText("{Er} will ablösefrei weg", player),
      message: paidSale
        ? `Fabrizio Romario meldet: ${club} bietet ${fee.toLocaleString("de-CH")} Goals für ${player.name}. Verkaufen oder behalten?`
        : `Fabrizio Romario meldet: ${player.name} will ablösefrei zu ${club}. ${pronounText("Lässt du {ihn} gehen oder behältst du {ihn}?", player)}`,
      reason: paidSale ? "Kaufangebot" : "Wechselwunsch ohne Ablöse",
      fee,
      createdAt: now,
    };
    features.transferSaga.pendingOffer = { ...event, expiresAt: now + TRANSFER_OFFER_DURATION_MS };
  } else {
    // The stored reason keeps its {der Spieler} tokens, so the next one is never the same; texts say "die Spielerin" for women.
    const reasonTemplate = getNextTransferFailureReason(features.transferSaga.lastFailedReason, random);
    const reason = pronounText(reasonTemplate, player);
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
    features.transferSaga.lastFailedReason = reasonTemplate;
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

/** Time left on an open offer, kept while a match or journey locks the squad. */
function transferOfferRemaining(features: GameFeatures, now: number) {
  const offer = features.transferSaga.pendingOffer;
  return offer ? Math.max(0, offer.expiresAt - now) : 0;
}

/** Sells the player of the open offer: he leaves for good, his squad place stays open, the fee goes to the goals. */
export function acceptTransferOffer(value: GameFeatures, now = Date.now()): { features: GameFeatures; event: TransferInsiderEvent | null; goalDelta: number; error?: string } {
  const features = normalizeGameFeatures(value);
  const offer = features.transferSaga.pendingOffer;
  if (!offer) return { features, event: null, goalDelta: 0, error: "Es liegt kein Angebot vor." };
  if (features.squadLock || features.cup.active) return { features, event: null, goalDelta: 0, error: "Während eines Spiels oder einer Reise kannst du nicht verkaufen." };
  const player = offer.playerId ? getStarXIPlayer(offer.playerId) : undefined;
  features.transferSaga.pendingOffer = null;
  if (!player || !features.starXI.ownedIds.includes(player.id)) return { features, event: null, goalDelta: 0, error: "Der Spieler ist nicht mehr im Club." };
  const lineupIndex = features.starXI.lineupIds.indexOf(player.id);
  const benchIndex = features.starXI.benchIds.indexOf(player.id);
  // A player who moved to the reserves meanwhile leaves no gap in the matchday squad.
  if (lineupIndex >= 0 || benchIndex >= 0) {
    const requiredPlayers = features.starXI.lineupIds.filter(Boolean).length + features.starXI.benchIds.filter(Boolean).length;
    const vacancy: TransferSquadVacancy = lineupIndex >= 0
      ? { area: "lineup", index: lineupIndex, requiredPlayers, createdAt: now }
      : { area: "bench", index: benchIndex, requiredPlayers, createdAt: now };
    features.transferSaga.vacancies = [...getOpenTransferSquadVacancies(features), vacancy].slice(-20);
  }
  const paidSale = offer.fee > 0;
  const fee = offer.fee;
  const soldState = {
    ...features.starXI,
    ownedIds: features.starXI.ownedIds.filter((playerId) => playerId !== player.id),
    lineupIds: features.starXI.lineupIds.map((playerId) => playerId === player.id ? "" : playerId),
    benchIds: features.starXI.benchIds.map((playerId) => playerId === player.id ? "" : playerId),
  };
  features.transferSaga.unhappy = features.transferSaga.unhappy.filter((entry) => entry.playerId !== player.id);
  features.starXI = normalizeStarXIState(soldState, getUnavailableStarXIPlayerIds(features));
  const event: TransferInsiderEvent = {
    id: `transfer-sale-${now}-${player.id}`,
    outcome: "sale",
    playerId: player.id,
    playerName: player.name,
    club: offer.club,
    headline: paidSale ? "HERE WE GOAL" : "Ablösefreier Abgang",
    message: paidSale
      ? `Fabrizio Romario meldet: ${player.name} wechselt dauerhaft zu ${offer.club}. Dein Club erhält ${fee.toLocaleString("de-CH")} Goals Ablöse.`
      : `Fabrizio Romario meldet: ${player.name} wechselt dauerhaft und ablösefrei zu ${offer.club}. Dein Club erhält keine Goals.`,
    reason: paidSale ? "Verkauf mit Ablöse" : "Ablösefreier Wechsel",
    fee,
    createdAt: now,
  };
  features.transferSaga.latestEvent = event;
  appendTransferArchive(features, event);
  addHistory(features, { title: `Fabrizio Romario · ${event.headline}`, detail: event.message, tone: "negative" }, now);
  return { features, event, goalDelta: fee };
}

/** Keeps the player of the open offer; he wanted to leave and plays weaker for the next matches. */
export function declineTransferOffer(value: GameFeatures, now = Date.now(), expired = false): { features: GameFeatures; event: TransferInsiderEvent | null; goalDelta: number; error?: string } {
  const features = normalizeGameFeatures(value);
  const offer = features.transferSaga.pendingOffer;
  if (!offer) return { features, event: null, goalDelta: 0, error: "Es liegt kein Angebot vor." };
  features.transferSaga.pendingOffer = null;
  const player = offer.playerId ? getStarXIPlayer(offer.playerId) : undefined;
  if (!player || !features.starXI.ownedIds.includes(player.id)) return { features, event: null, goalDelta: 0 };
  features.transferSaga.unhappy = [...features.transferSaga.unhappy.filter((entry) => entry.playerId !== player.id), { playerId: player.id, club: offer.club, matchesLeft: TRANSFER_UNHAPPY_MATCHES }];
  const event: TransferInsiderEvent = {
    id: `transfer-declined-${now}-${player.id}`,
    outcome: "declined",
    playerId: player.id,
    playerName: player.name,
    club: offer.club,
    headline: expired ? "Angebot verfallen" : "Angebot abgelehnt",
    message: `${expired ? `Das Angebot von ${offer.club} ist verfallen.` : `Du hast ${offer.club} abgesagt.`} ${player.name} bleibt, ist aber unzufrieden und spielt die nächsten ${TRANSFER_UNHAPPY_MATCHES} Spiele mit −${TRANSFER_UNHAPPY_PENALTY} OVR.`,
    reason: expired ? "Keine Antwort auf das Angebot" : "Spieler behalten",
    fee: 0,
    createdAt: now,
  };
  features.transferSaga.latestEvent = event;
  appendTransferArchive(features, event);
  addHistory(features, { title: `Fabrizio Romario · ${event.headline}`, detail: event.message, tone: "negative" }, now);
  return { features, event, goalDelta: 0 };
}

/** An offer nobody answered in time counts as declined; matches and journeys stop its clock. */
export function expireTransferOffer(value: GameFeatures, now = Date.now()) {
  const offer = value.transferSaga.pendingOffer;
  if (!offer || value.squadLock || now < offer.expiresAt) return { features: value, event: null, goalDelta: 0 };
  return declineTransferOffer(value, now, true);
}

/** Matches an unhappy player still plays weaker, or 0. */
export function transferUnhappyMatches(features: Pick<GameFeatures, "transferSaga">, playerId: string) {
  return features.transferSaga.unhappy.find((entry) => entry.playerId === playerId)?.matchesLeft ?? 0;
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


function normalizeSquadLock(value: unknown): GameFeatures['squadLock'] {
  const v = asRecord(value);
  if (typeof v.fixtureId !== 'string' || !Array.isArray(v.playerIds) || !Number.isFinite(v.startedAt)) return undefined;
  const finite = (n: unknown) => Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0);
  return { fixtureId: v.fixtureId, playerIds: uniqueKnownStarIds(v.playerIds), startedAt: Number(v.startedAt), transferRemaining: finite(v.transferRemaining), eventRemaining: finite(v.eventRemaining), varRemaining: finite(v.varRemaining), offerRemaining: v.offerRemaining === undefined ? undefined : finite(v.offerRemaining) };
}
export function lockMatchSquad(features: GameFeatures, fixtureId: string, now: number) {
  if (features.squadLock) return;
  features.squadLock = {fixtureId, playerIds: [...new Set([...features.starXI.lineupIds,...features.starXI.benchIds].filter(Boolean))], startedAt:now, transferRemaining:Math.max(0,features.transferSaga.nextAt-now), eventRemaining:Math.max(0,features.nextEventAt-now), varRemaining:Math.max(0,features.nextVarAt-now), offerRemaining:transferOfferRemaining(features, now)};
  // The lock freezes the Fabrizio and event clocks; the squad itself stays open until kick-off.
}
export function releaseMatchSquad(features: GameFeatures, now: number) {
  const lock = features.squadLock;
  if (!lock) return;
  features.transferSaga.nextAt = now + lock.transferRemaining;
  // An open offer waits through the match and the journey like every other Fabrizio timer.
  if (features.transferSaga.pendingOffer) features.transferSaga.pendingOffer.expiresAt = now + (lock.offerRemaining ?? TRANSFER_OFFER_DURATION_MS);
  features.nextEventAt = now + lock.eventRemaining;
  features.nextVarAt = now + lock.varRemaining;
  delete features.squadLock;
  delete features.starXI.lockedPlayerIds;
  if(features.travel.journey) delete features.travel.journey.squadLock;
}

function normalizePendingSubstitutions(value: unknown): CupState['pendingSubstitutions'] {
 const v=asRecord(value);
 if(typeof v.id!=='string'||!Number.isFinite(v.requestedAt)||!Array.isArray(v.changes)||!v.changes.length||v.changes.length>5)return undefined;
 const changes=v.changes.map(asRecord).filter(c=>typeof c.playerId==='string'&&typeof c.outgoingId==='string'&&Number.isInteger(c.slot)&&Number(c.slot)>=0&&Number(c.slot)<11).map(c=>({playerId:String(c.playerId),outgoingId:String(c.outgoingId),slot:Number(c.slot)}));
 return changes.length===v.changes.length?{id:v.id,requestedAt:Number(v.requestedAt),changes}:undefined;
}
export function matchChangeError(features:GameFeatures,changes:readonly MatchChange[]) {
 const c=features.cup;
 if(!c.active||c.phase==='penalties')return 'Zurzeit ist kein Wechsel möglich.';
 if(!changes.length||changes.length+c.substitutionsUsed>5)return 'Maximal fünf Spielerwechsel pro Partie.';
 if(c.timedPause?.kind!=='halftime'&&(c.subWindowsUsed??0)>=3)return 'Alle drei Wechselfenster sind aufgebraucht.';
 if(new Set(changes.map(x=>x.slot)).size!==changes.length||new Set(changes.map(x=>x.playerId)).size!==changes.length)return 'Jeder Spieler und Feldplatz darf nur einmal vorkommen.';
 for(const x of changes){
  const outgoing=features.starXI.lineupIds[x.slot],incoming=getStarXIPlayer(x.playerId);
  if(!Number.isInteger(x.slot)||x.slot<0||x.slot>=11||!outgoing||c.sentOffPlayerIds.includes(outgoing))return 'Ein des Feldes verwiesener Spieler kann nicht ersetzt werden.';
  if(!incoming||incoming.benchOnly||!features.starXI.benchIds.includes(x.playerId)||c.playerExitedAt[x.playerId]||c.sentOffPlayerIds.includes(x.playerId)||getUnavailableStarXIPlayerIds(features).includes(x.playerId)||getBannedPlayerIds(features,competitionOfCup(c)).includes(x.playerId))return 'Dieser Bankspieler ist nicht spielberechtigt.';
  if(!canStarXIPlayerFillSlot(x.playerId,x.slot,features.starXI.formationPositions))return 'Die Position passt nicht.';
 }
 return '';
}
export function queueMatchChanges(features:GameFeatures,changes:readonly MatchChange[],now:number) {
 if(features.cup.pendingSubstitutions)return 'Es ist bereits ein Wechselpaket vorgemerkt.';
 const error=matchChangeError(features,changes);if(error)return error;
 features.cup.pendingSubstitutions={id:`subs:${features.cup.careerMatchId}:${features.cup.substitutionsUsed}`,requestedAt:now,changes:changes.map(x=>({...x,outgoingId:features.starXI.lineupIds[x.slot]}))};
 applyPendingMatchChanges(features,now);
 return '';
}
export function applyPendingMatchChanges(features:GameFeatures,now:number) {
 const c=features.cup,p=c.pendingSubstitutions;if(!p||!c.active)return;
 const halftime=c.timedPause?.kind==='halftime'&&now<c.timedPause.endsAt;
 const stoppage=halftime||c.matchPaused||[...c.matchEvents,...c.cardEvents].some(e=>e.createdAt>=p.requestedAt)||c.broadcast?.events.some(e=>e.at>=p.requestedAt&&['corner','throw-in','free-kick','yellow','offside'].includes(e.kind));
 if(!stoppage)return;
 if(p.changes.some(x=>features.starXI.lineupIds[x.slot]!==x.outgoingId)||matchChangeError(features,p.changes)){delete c.pendingSubstitutions;return;}
 const minute=getCupMatchMinute(c,now);
 for(const x of p.changes){
  features.cup=applyCupSubstitution(features.cup,x.outgoingId,x.playerId,minute,now).cup;
  features.starXI=setStarXIStarter(features.starXI,x.slot,x.playerId,getUnavailableStarXIPlayerIds(features));
  features.cup.playerExitedAt[x.outgoingId]=Math.min(features.cup.playerExitedAt[x.outgoingId]??minute,minute);
  features.cup.playerEnteredAt[x.playerId]=minute;
  features.cup.playerMatchPositions[x.playerId]=features.starXI.formationPositions[x.slot];
  features.cup.substitutionsUsed++;
 }
 features.cup.subWindowsUsed=(c.subWindowsUsed??0)+(halftime?0:1);
 delete features.cup.pendingSubstitutions;
}

function tournamentMatchDuration(minimumRating:number){return minimumRating>=85?300000:minimumRating>=70?270000:240000;}
function normalizeTimedPause(value:unknown):CupState['timedPause'] {
 const p=asRecord(value);
 if(!['goal','halftime'].includes(String(p.kind))||typeof p.id!=='string'||!Number.isFinite(p.startsAt)||!Number.isFinite(p.endsAt)||!Number.isFinite(p.frozenAt))return undefined;
 const duration=p.kind==='goal'?4000:10000;
 if(Number(p.endsAt)-Number(p.startsAt)!==duration||Number(p.startsAt)<Number(p.frozenAt))return undefined;
 return {kind:p.kind as 'goal'|'halftime',id:p.id,startsAt:Number(p.startsAt),endsAt:Number(p.endsAt),frozenAt:Number(p.frozenAt)};
}
