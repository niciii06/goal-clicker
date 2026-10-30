// Storage keys, balance limits, mini game settings and static lists used by the main game page.
import type { CoopRole, CrossbarHeight, IconName, LayoutCardId, MatchPrediction, MiniGameId, PenaltyDirection, PurchaseMode } from "./types";

export const COOP_ROLES: readonly CoopRole[] = ["host", "guest", "player3", "player4"];

export const STORAGE_KEY = "goalClickerSiteSaveV3";
export const BACKUP_STORAGE_KEY = "goalClickerSiteSaveBackupV3";
export const RECOVERY_STORAGE_KEY = "goalClickerSiteSaveRecoveryV3";
export const PLAYER_ID_KEY = "goalClickerPlayerIdV3";
export const PLAYER_NAME_KEY = "goalClickerPlayerName";
export const COOP_ROOM_KEY = "goalClickerActiveCoopRoomV3";
export const LEGACY_STORAGE_KEYS = ["goalClickerSiteSaveV2", "goalClickerSiteSave", "goalClickerSave"];

export const LEGACY_PLAYER_ID_KEYS = ["goalClickerPlayerIdV2", "goalClickerPlayerId"];

export const LAYOUT_STORAGE_KEY = "goalClickerLayoutV3";
export const BALANCE_VERSION = 4;
export const MAX_MULTIPLIER_LEVEL = 8;
export const MAX_SEASON_STARS = 20;
export const PURCHASE_MODES: PurchaseMode[] = [1, 10, 100, "max"];

export const PENALTY_DIRECTIONS: PenaltyDirection[] = ["links", "mitte", "rechts"];

export const CROSSBAR_HEIGHTS: CrossbarHeight[] = ["hoch", "mitte", "tief"];

export const MATCH_PREDICTIONS: MatchPrediction[] = ["heim", "remis", "auswärts"];

export const MINI_GAME_IDS: MiniGameId[] = ["penalty", "dribble", "crossbar", "prediction"];

export const MINI_GAME_COOLDOWN_SECONDS: Record<MiniGameId, number> = { penalty: 60, dribble: 75, crossbar: 90, prediction: 120 };

export const MINI_GAME_NAMES: Record<MiniGameId, string> = { penalty: "Penalty Challenge", dribble: "Dribble Run", crossbar: "Latten Challenge", prediction: "Matchday Tipp" };

export const LAYOUT_CARD_IDS: LayoutCardId[] = ["hero", "feature", "shop", "side"];

export const DEFAULT_LAYOUT_ORDER: LayoutCardId[] = ["hero", "shop", "feature", "side"];

export const STAR_RARE_REVEAL_DURATION_MS = 2600;
export const PACK_TROLL_INTRO_MS = 2800;
export const RESERVE_PAGE_SIZE = 48;
export const STAR_RATING_FILTERS = [
  { id: "all", label: "Alle" },
  { id: "67-78", label: "67–78" },
  { id: "79-85", label: "79–85" },
  { id: "86-89", label: "86–89" },
  { id: "90-94", label: "90–94" },
  { id: "95-100", label: "95–100" },
] as const;
export const GOAL_CONFETTI = Array.from({ length: 46 }, (_, index) => ({ left: `${(index * 37) % 101}%`, delay: `${(index % 12) * 45}ms`, duration: `${2300 + (index % 7) * 180}ms`, color: ["#0071e3", "#34c759", "#ffcc00", "#ff375f", "#af52de", "#ffffff"][index % 6] }));
export const GOLD_CONFETTI = ["#ffe28d", "#f6c94c", "#fff4bd", "#d49b19"];

export const SILVER_CONFETTI = ["#ffffff", "#dfe5ec", "#aeb7c2", "#f5f7fa"];
// A lost response for these actions may hide a purchase that the server already applied.
export const NETWORK_RETRY_UNSAFE_COOP_ACTIONS = new Set(["buy", "star-pack", "star-custom-draw", "star-custom-buy", "transfer-accept", "transfer-decline"]);
export const ACHIEVEMENTS: { id: string; icon: IconName; name: string; description: string; threshold: number }[] = [
  { id: "first", icon: "ball", name: "Ankick", description: "Das erste Tor", threshold: 1 },
  { id: "hundred", icon: "number", name: "Hunderterclub", description: "100 Tore insgesamt", threshold: 100 },
  { id: "thousand", icon: "flame", name: "Heisser Fuss", description: "1.000 Tore insgesamt", threshold: 1000 },
  { id: "tenK", icon: "stadium", name: "Volles Stadion", description: "10.000 Tore insgesamt", threshold: 10000 },
  { id: "hundredK", icon: "starter", name: "Profi-Vertrag", description: "100.000 Tore insgesamt", threshold: 100000 },
  { id: "million", icon: "diamond", name: "Millionenstürmer", description: "1 Million Tore insgesamt", threshold: 1000000 },
  { id: "tenMillion", icon: "scorer", name: "Goldene Generation", description: "10 Millionen Tore insgesamt", threshold: 10000000 },
  { id: "hundredMillion", icon: "star", name: "Weltpokalsieger", description: "100 Millionen Tore insgesamt", threshold: 100000000 },
  { id: "billion", icon: "crown", name: "Milliardenclub", description: "1 Milliarde Tore insgesamt", threshold: 1000000000 },
  { id: "tenBillion", icon: "rocket", name: "Globales Phänomen", description: "10 Milliarden Tore insgesamt", threshold: 10000000000 },
  { id: "hundredBillion", icon: "diamond", name: "Unantastbar", description: "100 Milliarden Tore insgesamt", threshold: 100000000000 },
  { id: "trillion", icon: "crown", name: "Fussballgott", description: "1 Billion Tore insgesamt", threshold: 1000000000000 },
  { id: "dynasty", icon: "stadium", name: "Eigene Dynastie", description: "1 Billiarde Tore insgesamt", threshold: 1000000000000000 },
];

export const RANKS: { icon: IconName; name: string; minimum: number }[] = [
  { icon: "rookie", name: "Kreisliga Knipser", minimum: 0 },
  { icon: "starter", name: "Stammspieler", minimum: 100 },
  { icon: "scorer", name: "Torschützenkönig", minimum: 1000 },
  { icon: "star", name: "Weltstar", minimum: 10000 },
  { icon: "stadium", name: "Profi-Legende", minimum: 100000 },
  { icon: "crown", name: "Fussballgott", minimum: 1000000 },
  { icon: "diamond", name: "Weltpokalsieger", minimum: 10000000 },
  { icon: "rocket", name: "Globaler Superstar", minimum: 100000000 },
  { icon: "crown", name: "Milliarden-Ikone", minimum: 1000000000 },
  { icon: "star", name: "Unaufhaltsam", minimum: 10000000000 },
  { icon: "diamond", name: "Hall of Fame", minimum: 100000000000 },
  { icon: "rocket", name: "Ewige Nummer 1", minimum: 1000000000000 },
];
// Every click adds to the combo. The multiplier never exceeds x2; tier names the look of each level.
/** At most 5% of the passive income per click from the click upgrades, before combo, streak and critical hits. */
export const CLICK_PASSIVE_SHARE_CAP = 0.05;
export const COMBO_LEVELS = [{ clicks: 0, multiplier: 1, tier: 1 }, { clicks: 20, multiplier: 1.5, tier: 2 }, { clicks: 50, multiplier: 2, tier: 3 }] as const;
// After the last click the combo holds for three seconds (also after a full screen announcement closed),
// then drains by one click every third of a second instead of ending at once.
export const COMBO_HOLD_MS = 3000;
export const COMBO_DECAY_MS = 1000 / 3;
// The count stops at the top threshold, so the drain leaves the top level right after the hold.
export const COMBO_MAX_COUNT = 50;
export const VIBRATION_STORAGE_KEY = "goalClickerVibrationV1";
/** Id of the newest "Was ist neu" entry the player closed; synced with the cloud save like the layout. */
export const WHATS_NEW_STORAGE_KEY = "goalClickerWhatsNewSeenV1";
/** Progress of the new player tutorial; travels with the cloud save like the "Was ist neu" key. */
export const TUTORIAL_STORAGE_KEY = "goalClickerTutorialV1";
