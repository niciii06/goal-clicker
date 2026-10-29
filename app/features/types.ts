// Types of the game features (re-exported by app/feature-data.ts).
import type { CareerState } from "../career-data";
import type { GoalPattern, MatchBroadcast } from "../match-broadcast";
import type { InteractiveMatch } from "../interactive-match";
import type { StarPosition } from "../fc26-player-pool";
import type { Venue } from "../travel-geography";
import { FC27_INDIA_PROFILES } from "../scrap-pack";

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
  simulation?: InteractiveMatch;
  broadcast?: MatchBroadcast;
  fixture?: {id:string;away:boolean;neutral?:boolean;venue:Venue;opponentId:string};
  careerMatchId?: string;
  careerRatingSeed?: number;
  /** Random draw for the next tournament run; rerolled whenever a run starts. */
  drawSeed?: number;
  careerBonuses?: Record<string, number>;
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
  restartAt?: number;
  restartSide?: 'club'|'opponent';
  regularDurationMs?: number;
  halftimeTaken?: boolean;
  timedPause?: {kind:'goal'|'halftime';id:string;startsAt:number;endsAt:number;frozenAt:number};
  subWindowsUsed?: number;
  pendingSubstitutions?: {id: string; requestedAt: number; changes: {playerId:string;slot:number;outgoingId:string}[]};
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
  assistId?: string | null;
  assistName?: string;
  pattern?: GoalPattern;
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
  position: StarPosition | null;
  benchOnly?: boolean;
  symbol?: string;
  positions: StarPosition[];
  rating: number;
  price: number;
  accent: string;
  isCustom?: boolean;
  cardType?: "base" | "icon" | "legendary";
  packWeight?: number;
  /** Caption under the player on the ball in the 2D match; defaults to the last word of the name. */
  pitchName?: string;
  // Not part of FC 27: kept so existing saves stay valid, never drawn again.
  retired?: boolean;
  isWomen?: boolean;
  originalAttributes?: (typeof FC27_INDIA_PROFILES)[number]["attributes"];
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
  lockedPlayerIds?: string[];
  ownedIds: string[];
  fragments: number;
  lineupIds: string[];
  benchIds: string[];
  formationId: StarFormationId;
  formationPositions: StarPosition[];
};

export type RewardPackId = `reward-${1|2|3|4|5|6}`;
export type StarPackId = "scrap" | "regional" | "scout" | "profi" | "elite" | "weltklasse" | "legend" | RewardPackId;
export type EarnedPack = { id:string; packId:RewardPackId; earnedAt:number; opening?:StarPackOpening };

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

// "offer" waits for the player to sell or keep; "declined" is a kept player after an offer.
export type TransferInsiderOutcome = "loan" | "sale" | "failed" | "return" | "offer" | "declined";
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

/** A sale offer Fabrizio brought in; it counts as declined once `expiresAt` has passed. */
export type TransferOffer = TransferInsiderEvent & { expiresAt: number };
/** A player who wanted to leave and was kept plays weaker for a few matches. */
export type TransferUnhappyPlayer = { playerId: string; club: string; matchesLeft: number };

export type TransferSagaState = {
  pendingOffer: TransferOffer | null;
  unhappy: TransferUnhappyPlayer[];
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
  clubId?: string;
  venue?: Venue;
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

export type SeasonFixture = { opponentId:string; away:boolean; venue:Venue; clubId:string };

export type MissionProgressSource = {
  seasonGoals: number;
  clicks: number;
  minigameWins: number;
  cupWins: number;
};

export type YBPlayerSeed = readonly [sourceId: string, name: string, rating: number, positions: readonly StarPosition[], countryCode?: string];
// The imported FC26 base-player dataset does not contain Ultimate Team ICON
// items. This separate pool contains the full 129-player FC26 Icon roster.
// Names stay deliberately altered, as requested for the rest of the game.
export type IconSeed = readonly [id: string, name: string, rating: number, countryCode: string, positions: readonly StarPosition[]];

export type StarXIEvaluationContext = { career?: CareerState; cup?: CupState; minute?: number };

export type CupSubstitutionImpact = {
  cup: CupState;
  incomingRating: number;
  outgoingRating: number;
  ratingDelta: number;
  outgoingMatchRating: number;
  momentumDelta: number;
};

export type MatchChange = {playerId:string;slot:number};
