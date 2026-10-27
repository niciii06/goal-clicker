// Shared types of the main game page (app/page.tsx).
import type { GameFeatures, SeasonMatchHistoryEntry, SeasonTableRow, StarPackReveal } from "../feature-data";

export type UpgradeKind = "click" | "auto" | "multiplier";
export type Tab = "all" | UpgradeKind;
export type PurchaseMode = 1 | 10 | 100 | "max";
export type MiniGameId = "penalty" | "dribble" | "crossbar" | "prediction";
export type PenaltyDirection = "links" | "mitte" | "rechts";
export type CrossbarHeight = "hoch" | "mitte" | "tief";
export type MatchPrediction = "heim" | "remis" | "auswärts";
export type IconName = "ball" | "boot" | "worker" | "striker" | "board" | "light" | "screen" | "crown" | "number" | "flame" | "stadium" | "diamond" | "rookie" | "starter" | "scorer" | "star" | "rocket" | "sound" | "mute" | "broadcast" | "home" | "trophy" | "squad" | "career" | "cards" | "shield" | "bell" | "vibrate" | "grip" | "table";
export type AppMode = "single" | "coop";
export type CoopRole = "host" | "guest" | "player3" | "player4";
export type LayoutCardId = "hero" | "feature" | "shop" | "side";
export type SquadArea = "lineup" | "bench" | "reserve";
export type SquadDragSource = { playerId: string; area: SquadArea; index: number | null };

export type SquadDropTarget = { area: "lineup" | "bench"; index: number };

export type SeasonStandingsAnnouncement = { entry: SeasonMatchHistoryEntry; table: SeasonTableRow[] };

export type StarXIPositionBadgeVariant = "reveal" | "walkout" | "rare" | "compact";
export type CoopRoom = {
  code: string;
  roomName: string;
  status: "waiting" | "live";
  hostName: string;
  guestName: string | null;
  hostOnline: boolean;
  guestOnline: boolean;
  playerCount: number;
  maxPlayers: number;
  players: Array<{
    role: CoopRole;
    name: string | null;
    online: boolean;
    occupied: boolean;
    goals: number;
    clicks: number;
  }>;
  viewerRole?: CoopRole;
  canDelete?: boolean;
  sharedCoins: number;
  hostGoals: number;
  guestGoals: number;
  hostClicks: number;
  guestClicks: number;
  sharedUpgradeLevel: number;
  revision: number;
  testMode: boolean;
  /** md5 of the shared features; a response with `featuresOmitted` leaves them out because they did not change. */
  featuresKey?: string;
  featuresOmitted?: boolean;
  game: GameState;
};

export type CoopSession = { code: string; role: CoopRole; playerId: string; room: CoopRoom };

export type CoopApiResponse = { room?: CoopRoom; rooms?: CoopRoom[]; role?: CoopRole; deleted?: boolean; error?: string; errorCode?: string; packReveal?: StarPackReveal; dailyReward?: { amount: number; dayIndex: number; streak: number; pack: boolean }; press?: { reward: number; mood: number; fanMood: number } };

export type UpgradeDefinition = {
  id: string;
  icon: IconName;
  name: string;
  description: string;
  baseCost: number;
  scale: number;
  kind: UpgradeKind;
};

export type GameState = {
  goals: number;
  totalGoals: number;
  seasonGoals: number;
  clicks: number;
  upgrades: Record<string, number>;
  achievements: string[];
  stars: number;
  seasons: number;
  balanceVersion: number;
  sound: boolean;
  lastSaved: number;
  miniGameCooldowns: MiniGameCooldowns;
  minigameWins: number;
  features: GameFeatures;
};

export type FeedEntry = { id: number; icon: IconName; text: string };

export type ClickEffect = { id: number; x: number; y: number; amount: number; critical: boolean; combo: number };

export type PenaltyGame = { shots: number; goals: number; message: string; finished: boolean; reward: number };

export type DribbleGame = { sequence: PenaltyDirection[]; step: number; attempts: number; misses: number; message: string; finished: boolean; reward: number };

export type CrossbarGame = { shots: number; hits: number; message: string; finished: boolean; reward: number };

export type PredictionGame = { round: number; wins: number; message: string; finished: boolean; reward: number };

export type MiniGameCooldowns = Record<MiniGameId, number>;
