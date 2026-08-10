"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, ErrorInfo, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { AR, BA, BE, BG, BR, CH, CI, CM, CO, CZ, DE, DK, EC, EG, ES, FR, GB_ENG, GB_NIR, GB_SCT, GB_WLS, GE, GH, GN, HR, HU, IE, IT, JP, KR, MA, MX, NG, NL, NO, PL, PT, RO, RS, RU, SE, SI, TR, UA, US, UY } from "country-flag-icons/react/3x2";
import { addHistory, addStarXIPlayer, advanceCupMatch, beginCupMatch, canStarXIPlayerFillSlot, CLUB_BADGES, CLUB_COLORS, CUP_STRATEGIES, getCupMatchStrength, getCupPlayerMatchRating, getCupStrategy, getCupTacticalMatchup, getFreshTransferOffers, getGoalBoostedPassiveReward, getGoalBoostMultiplier, getMissionProgress, getRandomEventDelay, getStarFormation, getStarPack, getStarXIEffectiveMatchRating, getStarXIPlayer, getStarXIPositions, getStarXISelection, getStarXIRating, getTournament, getTournamentGoalBoostMultiplier, getTransferBonuses, getTransferPlayer, initialGameFeatures, normalizeGameFeatures, openStarPack, pauseGameFeatureTimers, resolveCupPenalty, resolveRandomEvent, resolveVarEvent, restoreStarXIAfterMatch, setStarXIBenchPlayer, setStarXIFormation, setStarXIStarter, startTournamentGoalBoost, STAR_FORMATIONS, STAR_PACKS, STAR_POSITIONS, STAR_XI_BENCH_SIZE, STAR_XI_MAX_SUBSTITUTIONS, STAR_XI_SQUAD_SIZE, TOURNAMENTS } from "./feature-data";
import type { CoopMission, CupGoalEvent, GameFeatures, PenaltyDirection as CupPenaltyDirection, RandomEvent, StarFormationId, StarPackId, StarPackReveal, TournamentId } from "./feature-data";
import { getStarCardTier, getWalkoutPresentation } from "./walkout-data";
import { getCurrentSeason, getFormationUnlockSeason, getPackUnlockSeason, getSeasonMilestone, getSeasonPath, getTournamentUnlockSeason, getUpgradeUnlockSeason, isSeasonContentUnlocked, MAX_CAREER_SEASON, SEASON_MILESTONES } from "./season-progression";
import { MULTIPLAYER_PROTOCOL_VERSION } from "./multiplayer-protocol";
import { compareStoredGameProgress, parseStoredGame, selectSafestStoredGame, shouldRejectRegressedSave } from "./save-safety";
import { calculateBulkUpgradePurchase, getUpgradeCostAtLevel } from "./upgrade-purchase";

type UpgradeKind = "click" | "auto" | "multiplier";
type Tab = "all" | UpgradeKind;
type PurchaseMode = 1 | 10 | 100 | "max";
type MiniGameId = "penalty" | "dribble" | "crossbar" | "prediction";
type PenaltyDirection = "links" | "mitte" | "rechts";
type CrossbarHeight = "hoch" | "mitte" | "tief";
type MatchPrediction = "heim" | "remis" | "auswärts";
type IconName = "ball" | "boot" | "worker" | "striker" | "board" | "light" | "screen" | "crown" | "number" | "flame" | "stadium" | "diamond" | "rookie" | "starter" | "scorer" | "star" | "rocket" | "sound" | "mute" | "broadcast";
type AppMode = "single" | "leaderboard" | "coop";
type CoopRole = "host" | "guest" | "player3" | "player4";
type FeatureTab = "market" | "cup" | "club" | "missions" | "history";
type LayoutCardId = "hero" | "feature" | "shop" | "side";
type SquadArea = "lineup" | "bench" | "reserve";
type SquadDragSource = { playerId: string; area: SquadArea; index: number | null };
type SquadDropTarget = { area: "lineup" | "bench"; index: number };

const WALKOUT_COUNTRY_FLAGS: Record<string, typeof FR> = {
  AR, BA, BE, BG, BR, CH, CI, CM, CO, CZ, DE, DK, EC, EG, EN: GB_ENG, ES, FR,
  GE, GH, GN, HR, HU, IE, IT, JP, KR, MA, MX, NG, NI: GB_NIR, NL, NO, PL,
  PT, RO, RS, RU, SC: GB_SCT, SE, SI, TR, UA, US, UY, WA: GB_WLS,
};

function WalkoutCountryFlag({ code, country, compact = false }: { code: string; country: string; compact?: boolean }) {
  const Flag = WALKOUT_COUNTRY_FLAGS[code] ?? CH;
  return <Flag className={compact ? "walkout-country-flag compact" : "walkout-country-flag"} role="img" aria-label={`Flagge von ${country}`} />;
}

function formatStarXIPositions(player: Parameters<typeof getStarXIPositions>[0], compact = false) {
  return player.id === "star-goat-nicu" ? "Alle Positionen" : getStarXIPositions(player).join(compact ? "/" : " / ");
}

const COOP_ROLES: readonly CoopRole[] = ["host", "guest", "player3", "player4"];

function isCoopRole(value: unknown): value is CoopRole {
  return typeof value === "string" && COOP_ROLES.includes(value as CoopRole);
}

function coopRoleLabel(role: CoopRole) {
  if (role === "host") return "HOST";
  if (role === "guest") return "SPIELER 2";
  if (role === "player3") return "SPIELER 3";
  return "SPIELER 4";
}

function occupiedCoopPlayers(room: CoopRoom) {
  return room.players.filter((player) => player.occupied);
}

type LeaderboardEntry = {
  playerId: string;
  nickname: string;
  totalGoals: number;
  seasonGoals: number;
  minigameWins: number;
  updatedAt: string;
};

type CoopRoom = {
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
  game: GameState;
};
type CoopSession = { code: string; role: CoopRole; playerId: string; room: CoopRoom };
type CoopApiResponse = { room?: CoopRoom; rooms?: CoopRoom[]; role?: CoopRole; deleted?: boolean; error?: string; errorCode?: string; packReveal?: StarPackReveal };

type UpgradeDefinition = {
  id: string;
  icon: IconName;
  name: string;
  description: string;
  baseCost: number;
  scale: number;
  kind: UpgradeKind;
};

type GameState = {
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

type FeedEntry = { id: number; icon: IconName; text: string };
type ClickEffect = { id: number; x: number; y: number; amount: number; critical: boolean };
type PenaltyGame = { shots: number; goals: number; message: string; finished: boolean; reward: number };
type DribbleGame = { sequence: PenaltyDirection[]; step: number; attempts: number; misses: number; message: string; finished: boolean; reward: number };
type CrossbarGame = { shots: number; hits: number; message: string; finished: boolean; reward: number };
type PredictionGame = { round: number; wins: number; message: string; finished: boolean; reward: number };
type MiniGameCooldowns = Record<MiniGameId, number>;

const STORAGE_KEY = "goalClickerSiteSaveV3";
const BACKUP_STORAGE_KEY = "goalClickerSiteSaveBackupV3";
const RECOVERY_STORAGE_KEY = "goalClickerSiteSaveRecoveryV3";
const PLAYER_ID_KEY = "goalClickerPlayerIdV3";
const PLAYER_NAME_KEY = "goalClickerPlayerName";
const COOP_ROOM_KEY = "goalClickerActiveCoopRoomV3";
const LEGACY_STORAGE_KEYS = ["goalClickerSiteSaveV2", "goalClickerSiteSave", "goalClickerSave"];
const LEGACY_PLAYER_ID_KEYS = ["goalClickerPlayerIdV2", "goalClickerPlayerId"];
const LAYOUT_STORAGE_KEY = "goalClickerLayoutV3";
const BALANCE_VERSION = 4;
const MAX_MULTIPLIER_LEVEL = 8;
const MAX_SEASON_STARS = 20;
const PURCHASE_MODES: PurchaseMode[] = [1, 10, 100, "max"];
const PENALTY_DIRECTIONS: PenaltyDirection[] = ["links", "mitte", "rechts"];
const CROSSBAR_HEIGHTS: CrossbarHeight[] = ["hoch", "mitte", "tief"];
const MATCH_PREDICTIONS: MatchPrediction[] = ["heim", "remis", "auswärts"];
const MINI_GAME_IDS: MiniGameId[] = ["penalty", "dribble", "crossbar", "prediction"];
const MINI_GAME_COOLDOWN_SECONDS: Record<MiniGameId, number> = { penalty: 60, dribble: 75, crossbar: 90, prediction: 120 };
const MINI_GAME_NAMES: Record<MiniGameId, string> = { penalty: "Penalty Challenge", dribble: "Dribble Run", crossbar: "Latten Challenge", prediction: "Matchday Tipp" };
const LAYOUT_CARD_IDS: LayoutCardId[] = ["hero", "feature", "shop", "side"];
const DEFAULT_LAYOUT_ORDER: LayoutCardId[] = ["hero", "shop", "feature", "side"];
const SQUAD_DRAG_MIME = "application/x-goal-clicker-player";
const STAR_WALKOUT_DURATION_MS = 7500;
const STAR_RARE_REVEAL_DURATION_MS = 2600;
const RESERVE_PAGE_SIZE = 48;
const STAR_RATING_FILTERS = [
  { id: "all", label: "Alle" },
  { id: "67-78", label: "67–78" },
  { id: "79-85", label: "79–85" },
  { id: "86-89", label: "86–89" },
  { id: "90-94", label: "90–94" },
  { id: "95-100", label: "95–100" },
] as const;
const GOAL_CONFETTI = Array.from({ length: 46 }, (_, index) => ({ left: `${(index * 37) % 101}%`, delay: `${(index % 12) * 45}ms`, duration: `${2300 + (index % 7) * 180}ms`, color: ["#0071e3", "#34c759", "#ffcc00", "#ff375f", "#af52de", "#ffffff"][index % 6] }));
const GOLD_CONFETTI = ["#ffe28d", "#f6c94c", "#fff4bd", "#d49b19"];
const SILVER_CONFETTI = ["#ffffff", "#dfe5ec", "#aeb7c2", "#f5f7fa"];

function normalizeLayoutOrder(value: unknown) {
  const saved = Array.isArray(value) ? value.filter((id): id is LayoutCardId => typeof id === "string" && LAYOUT_CARD_IDS.includes(id as LayoutCardId)) : [];
  return [...new Set(saved), ...DEFAULT_LAYOUT_ORDER.filter((id) => !saved.includes(id))];
}

function upsertSavedRoom(rooms: CoopRoom[], room: CoopRoom) {
  const existing = rooms.find((item) => item.code === room.code);
  const freshest = existing && existing.revision > room.revision ? existing : room;
  return [freshest, ...rooms.filter((item) => item.code !== room.code)].slice(0, 12);
}

function mergeCoopSessionRoom(current: CoopSession | null, room: CoopRoom, role?: CoopRole) {
  if (!current || current.code !== room.code || room.revision < current.room.revision) return current;
  return { ...current, room, role: role ?? current.role };
}
function initialMiniGameCooldowns(): MiniGameCooldowns {
  return { penalty: 0, dribble: 0, crossbar: 0, prediction: 0 };
}

function normalizeMiniGameCooldowns(cooldowns: Partial<MiniGameCooldowns> | undefined): MiniGameCooldowns {
  const normalized = initialMiniGameCooldowns();
  for (const id of MINI_GAME_IDS) normalized[id] = Math.max(0, Number(cooldowns?.[id]) || 0);
  return normalized;
}

function readStoredGame() {
  const safest = selectSafestStoredGame([
    { key: STORAGE_KEY, raw: localStorage.getItem(STORAGE_KEY) },
    { key: BACKUP_STORAGE_KEY, raw: localStorage.getItem(BACKUP_STORAGE_KEY) },
    { key: RECOVERY_STORAGE_KEY, raw: localStorage.getItem(RECOVERY_STORAGE_KEY) },
    ...LEGACY_STORAGE_KEYS.map((key) => ({ key, raw: localStorage.getItem(key) })),
  ]);
  return { saved: safest?.saved as Partial<GameState> | undefined, recovered: Boolean(safest && safest.key !== STORAGE_KEY) };
}

function persistLocalGame(state: GameState) {
  try {
    const nextRaw = JSON.stringify(state);
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    const current = parseStoredGame(currentRaw);
    const next = parseStoredGame(nextRaw);
    if (shouldRejectRegressedSave(current, next)) {
      if (currentRaw) localStorage.setItem(BACKUP_STORAGE_KEY, currentRaw);
      return;
    }
    const backupRaw = localStorage.getItem(BACKUP_STORAGE_KEY);
    const backup = parseStoredGame(backupRaw);
    if (currentRaw && current && (!backup || compareStoredGameProgress(current, backup) >= 0)) {
      if (backupRaw && backup) localStorage.setItem(RECOVERY_STORAGE_KEY, backupRaw);
      localStorage.setItem(BACKUP_STORAGE_KEY, currentRaw);
    }
    localStorage.setItem(STORAGE_KEY, nextRaw);
  } catch {
    // A full browser storage must never crash the game or replace a valid save.
  }
}

function pauseMiniGameCooldowns(cooldowns: Partial<MiniGameCooldowns> | undefined, pausedMs: number, pausedAt: number) {
  const shifted = normalizeMiniGameCooldowns(cooldowns);
  for (const id of MINI_GAME_IDS) if (shifted[id] > pausedAt) shifted[id] += pausedMs;
  return shifted;
}

function advanceLocalGameWhileOpen(state: GameState, elapsedMs: number, now = Date.now()): GameState {
  const durationMs = Math.max(0, elapsedMs);
  if (!durationMs) return { ...state, lastSaved: now };
  const passiveReward = getGoalBoostedPassiveReward(getBasePassivePower(state.upgrades, state.stars, state.features), state.features, now - durationMs, now);
  return {
    ...state,
    goals: state.goals + passiveReward,
    seasonGoals: state.seasonGoals + passiveReward,
    totalGoals: state.totalGoals + passiveReward,
    lastSaved: now,
  };
}

function getMiniGameCooldownUntil(id: MiniGameId) {
  return Date.now() + MINI_GAME_COOLDOWN_SECONDS[id] * 1000;
}

function formatCountdown(until: number, now: number) {
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function getCupMatchMinute(matchStartedAt: number, now: number) {
  if (!matchStartedAt) return 1;
  return Math.min(120, Math.max(1, Math.floor(Math.max(0, now - matchStartedAt) / 2000) + 1));
}

function formatPackChance(chance: number) {
  const percentage = chance * 100;
  const precision = percentage < 0.01 ? 3 : percentage < 0.1 ? 2 : percentage < 1 ? 1 : 0;
  return `${percentage.toLocaleString("de-CH", { minimumFractionDigits: precision, maximumFractionDigits: precision })}%`;
}

function getCurrentTime() {
  return Date.now();
}

function notifyCoopOffline(code: string | undefined, playerId: string | undefined) {
  if (!code || !playerId || typeof navigator === "undefined") return;
  const body = JSON.stringify({ action: "presence-offline", code, playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/multiplayer", blob)) return;
  void fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

function multiplayerUrl(params: Record<string, string>) {
  const search = new URLSearchParams({ ...params, protocol: String(MULTIPLAYER_PROTOCOL_VERSION) });
  return `/api/multiplayer?${search.toString()}`;
}

async function readCoopResponse(response: Response) {
  const data = (await response.json()) as CoopApiResponse;
  if (response.status === 426 && typeof window !== "undefined") {
    const reloadUrl = new URL(window.location.href);
    reloadUrl.searchParams.set("goal-clicker-update", String(Date.now()));
    window.location.replace(reloadUrl.toString());
  }
  return data;
}

function getRandomItem<T>(items: readonly T[]) {
  const random = new Uint32Array(1);
  globalThis.crypto.getRandomValues(random);
  return items[random[0] % items.length];
}

function getRandomPenaltyDirection(): PenaltyDirection {
  return getRandomItem(PENALTY_DIRECTIONS);
}

function getRandomCrossbarHeight(): CrossbarHeight {
  return getRandomItem(CROSSBAR_HEIGHTS);
}

function getRandomMatchPrediction(): MatchPrediction {
  return getRandomItem(MATCH_PREDICTIONS);
}

function directionLabel(direction: PenaltyDirection) {
  return direction[0].toUpperCase() + direction.slice(1);
}

function heightLabel(height: CrossbarHeight) {
  return height[0].toUpperCase() + height.slice(1);
}

function predictionLabel(prediction: MatchPrediction) {
  if (prediction === "heim") return "Heimsieg";
  if (prediction === "auswärts") return "Auswärtssieg";
  return "Remis";
}

const UPGRADES: UpgradeDefinition[] = [
  { id: "boots", icon: "boot", name: "Schnellere Stiefel", description: "+1 Tor pro Klick", baseCost: 25, scale: 1.22, kind: "click" },
  { id: "ballboy", icon: "worker", name: "Balljunge", description: "+1 Tor pro Sekunde", baseCost: 120, scale: 1.2, kind: "auto" },
  { id: "technique", icon: "ball", name: "Schusstechnik", description: "+3 Tore pro Klick", baseCost: 260, scale: 1.24, kind: "click" },
  { id: "instinct", icon: "scorer", name: "Torinstinkt", description: "+5 Tore pro Klick", baseCost: 1400, scale: 1.26, kind: "click" },
  { id: "coach", icon: "board", name: "Taktiktafel", description: "+15 Tore pro Sekunde", baseCost: 3500, scale: 1.23, kind: "auto" },
  { id: "striker", icon: "striker", name: "Killerstürmer", description: "+10 Tore pro Klick", baseCost: 7500, scale: 1.28, kind: "click" },
  { id: "academy", icon: "board", name: "Nachwuchsakademie", description: "+60 Tore pro Sekunde", baseCost: 12500, scale: 1.25, kind: "auto" },
  { id: "floodlight", icon: "light", name: "Flutlichtanlage", description: "+300 Tore pro Sekunde", baseCost: 55000, scale: 1.27, kind: "auto" },
  { id: "longshot", icon: "flame", name: "Distanzschütze", description: "+25 Tore pro Klick", baseCost: 75000, scale: 1.3, kind: "click" },
  { id: "scout", icon: "star", name: "Talent-Scouting", description: "+1.200 Tore pro Sekunde", baseCost: 200000, scale: 1.29, kind: "auto" },
  { id: "var", icon: "screen", name: "VAR 2.0", description: "+10.000 Tore pro Sekunde", baseCost: 400000, scale: 1.3, kind: "auto" },
  { id: "freekick", icon: "ball", name: "Freistoss-Spezialist", description: "+50 Tore pro Klick", baseCost: 750000, scale: 1.32, kind: "click" },
  { id: "stadium", icon: "stadium", name: "Arena-Ausbau", description: "+50.000 Tore pro Sekunde", baseCost: 2000000, scale: 1.32, kind: "auto" },
  { id: "worldclass", icon: "striker", name: "Weltklasse-Abschluss", description: "+100 Tore pro Klick", baseCost: 7500000, scale: 1.34, kind: "click" },
  { id: "broadcast", icon: "broadcast", name: "Weltweite Übertragung", description: "+250.000 Tore pro Sekunde", baseCost: 8000000, scale: 1.34, kind: "auto" },
  { id: "sponsor", icon: "diamond", name: "Globaler Sponsor", description: "+1,2 Millionen Tore pro Sekunde", baseCost: 35000000, scale: 1.36, kind: "auto" },
  { id: "ballondor", icon: "crown", name: "Ballon-d'Or-Angreifer", description: "+250 Tore pro Klick", baseCost: 75000000, scale: 1.38, kind: "click" },
  { id: "superclub", icon: "crown", name: "Superclub-Netzwerk", description: "+6 Millionen Tore pro Sekunde", baseCost: 180000000, scale: 1.38, kind: "auto" },
  { id: "captain", icon: "star", name: "Kapitänsbinde", description: "+500 Tore pro Klick", baseCost: 350000000, scale: 1.42, kind: "click" },
  { id: "golden", icon: "crown", name: "Goldener Schuh", description: "+10% Klickpower", baseCost: 900000000, scale: 1.58, kind: "multiplier" },
  { id: "legacy", icon: "diamond", name: "Vereins-Dynastie", description: "+5% auf alle Einnahmen", baseCost: 6000000000, scale: 1.68, kind: "multiplier" },
];

const ACHIEVEMENTS: { id: string; icon: IconName; name: string; description: string; threshold: number }[] = [
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

function normalizeAchievements(value: unknown) {
  if (!Array.isArray(value)) return [];
  const knownIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
  return [...new Set(value.filter((id): id is string => typeof id === "string" && knownIds.has(id)))];
}

const RANKS: { icon: IconName; name: string; minimum: number }[] = [
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

function initialGame(): GameState {
  return { goals: 0, totalGoals: 0, seasonGoals: 0, clicks: 0, upgrades: {}, achievements: [], stars: 0, seasons: 0, balanceVersion: BALANCE_VERSION, sound: true, lastSaved: Date.now(), miniGameCooldowns: initialMiniGameCooldowns(), minigameWins: 0, features: initialGameFeatures() };
}

function normalizeRuntimeGame(value: unknown, soundFallback = true): GameState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const nonNegative = (raw: unknown) => {
    const number = Number(raw);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  };
  return {
    goals: nonNegative(source.goals),
    totalGoals: nonNegative(source.totalGoals),
    seasonGoals: nonNegative(source.seasonGoals),
    clicks: Math.floor(nonNegative(source.clicks)),
    upgrades: normalizeUpgrades(source.upgrades),
    achievements: normalizeAchievements(source.achievements),
    stars: Math.min(MAX_SEASON_STARS, Math.floor(nonNegative(source.stars))),
    seasons: Math.floor(nonNegative(source.seasons)),
    balanceVersion: BALANCE_VERSION,
    sound: typeof source.sound === "boolean" ? source.sound : soundFallback,
    lastSaved: Number.isFinite(Number(source.lastSaved)) ? Number(source.lastSaved) : Date.now(),
    miniGameCooldowns: normalizeMiniGameCooldowns(source.miniGameCooldowns as Partial<MiniGameCooldowns> | undefined),
    minigameWins: Math.floor(nonNegative(source.minigameWins)),
    features: normalizeGameFeatures(source.features),
  };
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "MAX";
  if (value <= 0) return "0";
  if (value < 1000) return Math.floor(value).toLocaleString("de-CH");
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Ud"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log10(value) / 3) - 1);
  if (Math.floor(Math.log10(value) / 3) - 1 >= units.length) return value.toExponential(2).replace("e+", "e");
  const divisor = 1000 ** (exponent + 1);
  const scaled = value / divisor;
  return `${scaled.toFixed(scaled < 10 ? 1 : 0)}${units[exponent]}`;
}

function formatHistoryTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function iconPaths(name: IconName): ReactNode {
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "ball": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="m12 8 2.4 1.7-.9 2.8H10.5l-.9-2.8L12 8Zm0 0L10.7 5.7m3.7 4 3.1-.9m-4.1 3.7 1.7 2.8m-4.6-2.8-1.7 2.8m.8-5.7-3-.9" {...stroke} /></>;
    case "boot": return <path d="M5 15.5c2 .8 3.7 1.4 5.1 1.9 2.5.8 4.3.7 5.8 0l2.1-1c.8-.4 1.7 0 1.9.8l.2.9c.2.8-.3 1.6-1.1 1.8-3.7 1-7.3.8-10.7-.4l-3.4-1.2c-.7-.3-1.1-1-.8-1.7l.2-.5c.1-.4.4-.6.7-.6Z M9.4 5.2 13 7l.8 4.2-3.5 2.8-4-1.8 1.8-4.7 1.3-2.3Z" {...stroke} />;
    case "worker": return <><circle cx="12" cy="7.5" r="2.8" {...stroke} /><path d="M6.5 19c.3-3.2 2.2-5 5.5-5s5.2 1.8 5.5 5M4.5 11.5h15" {...stroke} /></>;
    case "striker": return <path d="M13.4 2.9 5.7 13h5.2L10.2 21l8.1-11.1h-5.3l.4-7Z" {...stroke} />;
    case "board": return <><rect x="4" y="4" width="16" height="14" rx="1.5" {...stroke} /><path d="M8 8h8M8 12h5M8 16h8M9 18v3m6-3v3" {...stroke} /></>;
    case "light": return <><path d="M9 18h6M9.8 21h4.4M8 14.5c-1.2-1-2-2.5-2-4.2a6 6 0 1 1 12 0c0 1.7-.8 3.2-2 4.2-.7.6-1 1.1-1 1.8H9c0-.7-.3-1.2-1-1.8Z" {...stroke} /><path d="M12 2v2M4.9 4.9l1.4 1.4M19.1 4.9l-1.4 1.4" {...stroke} /></>;
    case "screen": return <><rect x="3" y="5" width="18" height="12" rx="2" {...stroke} /><path d="M8 21h8M12 17v4M7 9h10M7 12h5" {...stroke} /></>;
    case "crown": return <path d="m4 7 4 3 4-6 4 6 4-3-2 12H6L4 7Z M6 22h12" {...stroke} />;
    case "number": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M10 9.5c.7-.7 2.6-.7 3.1.3.5 1-.2 1.8-1.3 2.3-1.1.5-2 1.2-2 2.4 0 1.2 1 1.8 2.2 1.8.9 0 1.6-.3 2.1-.9" {...stroke} /></>;
    case "flame": return <path d="M12.1 21c3.6 0 6-2.1 6-5.2 0-2.1-1.1-3.7-2.8-5.1.2 1.7-.6 2.6-1.5 3.2.2-3.6-1.8-6.1-4.7-8.2.2 2.8-.4 4.7-1.8 6.2-1.1 1.2-1.8 2.4-1.8 4 0 3 2.5 5.1 6.6 5.1Z" {...stroke} />;
    case "stadium": return <><path d="M3 20V8l9-4 9 4v12M3 20h18M7 20v-7h10v7M9 13V9m3 4V8m3 5V9" {...stroke} /></>;
    case "diamond": return <path d="m12 3 7 6-7 12L5 9l7-6Z M5 9h14M9 9l3 12 3-12" {...stroke} />;
    case "rookie": return <><path d="M5 21v-9l7-3 7 3v9M8 21v-5h8v5M3 21h18" {...stroke} /><path d="M9 9V5h6v4" {...stroke} /></>;
    case "starter": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M12 7v5l3 2" {...stroke} /></>;
    case "scorer": return <><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="m12 6 1.8 3.7 4.2.6-3 2.9.7 4.1-3.7-1.9-3.7 1.9.7-4.1-3-2.9 4.2-.6L12 6Z" {...stroke} /></>;
    case "star": return <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3Z" {...stroke} />;
    case "rocket": return <><path d="M14.5 5.2c2.2-.8 4-.7 4.5-.2.5.5.6 2.3-.2 4.5-.9 2.5-2.6 4.8-4.6 6.8l-3.5-3.5c2-2 3.3-4.9 3.8-7.6Z" {...stroke} /><path d="m10.7 12.8-3.5 1.1-1.1 3.5 3.5-1.1 1.1-3.5ZM7.2 7.5 5 5.3M8.3 18.1l-2.4 2.4M5 12H2.5" {...stroke} /><circle cx="15.7" cy="8.3" r="1.2" {...stroke} /></>;
    case "sound": return <><path d="M4 10v4h3l4 3V7L7 10H4Z" {...stroke} /><path d="M15 9.5c1.4 1.3 1.4 3.7 0 5M17.5 7.3c2.5 2.4 2.5 7 0 9.4" {...stroke} /></>;
    case "mute": return <><path d="M4 10v4h3l4 3V7L7 10H4Z" {...stroke} /><path d="m16 10 4 4m0-4-4 4" {...stroke} /></>;
    case "broadcast": return <><circle cx="12" cy="12" r="2" {...stroke} /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" {...stroke} /></>;
    default: return <circle cx="12" cy="12" r="8" {...stroke} />;
  }
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg className="svg-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">{iconPaths(name)}</svg>;
}

function FootballGraphic() {
  return <svg viewBox="0 0 100 100" className="hero-football" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="#f3f5ef"/><path d="M50 30 63 39l-5 15H42l-5-15 13-9Z" fill="#101918"/><path d="m50 30-6-12M63 39l16-5M58 54l9 15M42 54l-9 15M37 39 21 34" stroke="#101918" strokeWidth="4" strokeLinecap="round"/><circle cx="50" cy="50" r="43" fill="none" stroke="#b6c2b9" strokeWidth="2"/></svg>;
}

function getLevel(upgrades: Record<string, number>, id: string) {
  return upgrades[id] ?? 0;
}

function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 18);
}

function getCostAtLevel(definition: UpgradeDefinition, level: number) {
  return getUpgradeCostAtLevel(definition, level, MAX_MULTIPLIER_LEVEL);
}

function getCost(definition: UpgradeDefinition, upgrades: Record<string, number>) {
  return getCostAtLevel(definition, getLevel(upgrades, definition.id));
}

function getBulkPurchase(definition: UpgradeDefinition, upgrades: Record<string, number>, goals: number, mode: PurchaseMode, unlimitedMoney = false) {
  return calculateBulkUpgradePurchase(definition, getLevel(upgrades, definition.id), goals, mode, {
    unlimitedMoney,
    maxMultiplierLevel: MAX_MULTIPLIER_LEVEL,
  });
}

function getIncomeMultiplier(upgrades: Record<string, number>, stars: number) {
  return (1 + Math.min(MAX_SEASON_STARS, Math.max(0, stars)) * 0.02) * 1.05 ** Math.min(MAX_MULTIPLIER_LEVEL, getLevel(upgrades, "legacy"));
}

function getBaseClickPower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures) {
  const flat = 1 + getLevel(upgrades, "boots") + getLevel(upgrades, "technique") * 3 + getLevel(upgrades, "instinct") * 5 + getLevel(upgrades, "striker") * 10 + getLevel(upgrades, "longshot") * 25 + getLevel(upgrades, "freekick") * 50 + getLevel(upgrades, "worldclass") * 100 + getLevel(upgrades, "ballondor") * 250 + getLevel(upgrades, "captain") * 500;
  const transfer = getTransferBonuses(features?.transferMarket.ownedIds ?? []);
  return (flat + transfer.clickBonus) * 1.1 ** Math.min(MAX_MULTIPLIER_LEVEL, getLevel(upgrades, "golden")) * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

function getClickPower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures, now = Date.now()) {
  return getBaseClickPower(upgrades, stars, features) * getGoalBoostMultiplier(features, now);
}

function getBasePassivePower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures) {
  const base = getLevel(upgrades, "ballboy") + getLevel(upgrades, "coach") * 15 + getLevel(upgrades, "academy") * 60 + getLevel(upgrades, "floodlight") * 300 + getLevel(upgrades, "scout") * 1200 + getLevel(upgrades, "var") * 10000 + getLevel(upgrades, "stadium") * 50000 + getLevel(upgrades, "broadcast") * 250000 + getLevel(upgrades, "sponsor") * 1200000 + getLevel(upgrades, "superclub") * 6000000;
  const transfer = getTransferBonuses(features?.transferMarket.ownedIds ?? []);
  return (base + transfer.passiveBonus) * getIncomeMultiplier(upgrades, stars) * (1 + transfer.incomeBonus);
}

function getPassivePower(upgrades: Record<string, number>, stars = 0, features?: GameFeatures, now = Date.now()) {
  return getBasePassivePower(upgrades, stars, features) * getGoalBoostMultiplier(features, now);
}

function getUpgradeEffect(upgrade: UpgradeDefinition, level: number) {
  const effectiveLevel = Math.min(level, MAX_MULTIPLIER_LEVEL);
  if (upgrade.id === "golden") return `Stufe ${effectiveLevel}: x${(1.1 ** effectiveLevel).toFixed(2)} Klickpower`;
  if (upgrade.id === "legacy") return `Stufe ${effectiveLevel}: x${(1.05 ** effectiveLevel).toFixed(2)} alle Einnahmen`;
  return `${upgrade.description} · Stufe ${level}`;
}

function normalizeUpgrades(value: unknown) {
  const upgrades = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const normalized: Record<string, number> = {};
  for (const [id, value] of Object.entries(upgrades)) {
    const level = Math.max(0, Math.floor(Number(value) || 0));
    normalized[id] = id === "golden" || id === "legacy" ? Math.min(MAX_MULTIPLIER_LEVEL, level) : level;
  }
  return normalized;
}

function getRank(totalGoals: number) {
  let current = RANKS[0];
  for (const rank of RANKS) if (totalGoals >= rank.minimum) current = rank;
  return current;
}

function createClickResult(clickPower: number, lastClick: number, currentStreak: number) {
  const now = Date.now();
  const streak = now - lastClick < 1200 ? currentStreak + 1 : 1;
  const streakBonus = streak >= 5 ? 1 + Math.min(0.1, streak * 0.01) : 1;
  const critical = Math.random() < 0.02;
  const amount = Math.max(1, Math.floor(clickPower * streakBonus * (critical ? 2 : 1)));
  return { now, streak, critical, amount, effectId: now + Math.random() };
}

function App() {
  const [game, setGame] = useState<GameState>(initialGame);
  const [hydrated, setHydrated] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>("single");
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardMessage, setLeaderboardMessage] = useState("");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [coopCodeInput, setCoopCodeInput] = useState("");
  const [coopRoomName, setCoopRoomName] = useState("Meine Welt");
  const [lobbyBonusCode, setLobbyBonusCode] = useState("");
  const [coopSession, setCoopSession] = useState<CoopSession | null>(null);
  const [savedRooms, setSavedRooms] = useState<CoopRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [coopMessage, setCoopMessage] = useState("");
  const [coopBusy, setCoopBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>(1);
  const [featureTab, setFeatureTab] = useState<FeatureTab>("cup");
  const [selectedTournamentId, setSelectedTournamentId] = useState<TournamentId>("stadium");
  const [selectedLineupSlot, setSelectedLineupSlot] = useState<number | null>(null);
  const [selectedBenchSlot, setSelectedBenchSlot] = useState<number | null>(null);
  const [starRatingFilter, setStarRatingFilter] = useState("all");
  const [starPositionFilter, setStarPositionFilter] = useState("all");
  const [starSearch, setStarSearch] = useState("");
  const [reservePage, setReservePage] = useState(0);
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [layoutOrder, setLayoutOrder] = useState<LayoutCardId[]>(DEFAULT_LAYOUT_ORDER);
  const [layoutReady, setLayoutReady] = useState(false);
  const [draggingLayoutCard, setDraggingLayoutCard] = useState<LayoutCardId | null>(null);
  const [dragOverLayoutCard, setDragOverLayoutCard] = useState<LayoutCardId | null>(null);
  const [draggingSquadPlayer, setDraggingSquadPlayer] = useState<SquadDragSource | null>(null);
  const [squadDropTarget, setSquadDropTarget] = useState<SquadDropTarget | null>(null);
  const [clubDraft, setClubDraft] = useState(initialGameFeatures().club);
  const [eventAnnouncement, setEventAnnouncement] = useState<RandomEvent | null>(null);
  const [cupGoalAnnouncement, setCupGoalAnnouncement] = useState<CupGoalEvent | null>(null);
  const [starReveal, setStarReveal] = useState<StarPackReveal | null>(null);
  const [starWalkoutReady, setStarWalkoutReady] = useState(false);
  const [activeMiniGame, setActiveMiniGame] = useState<MiniGameId | null>(null);
  const [penaltyGame, setPenaltyGame] = useState<PenaltyGame | null>(null);
  const [dribbleGame, setDribbleGame] = useState<DribbleGame | null>(null);
  const [crossbarGame, setCrossbarGame] = useState<CrossbarGame | null>(null);
  const [predictionGame, setPredictionGame] = useState<PredictionGame | null>(null);
  const [countdownNow, setCountdownNow] = useState(getCurrentTime);
  const [effects, setEffects] = useState<ClickEffect[]>([]);
  const [pulse, setPulse] = useState(false);
  const [toast, setToast] = useState("");
  const [offline, setOffline] = useState("");
  const [feed, setFeed] = useState<FeedEntry[]>([{ id: 1, icon: "broadcast", text: "Die Fans sind da. Klaus der Torwart auch." }]);
  const gameRef = useRef(game);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef(0);
  const streakRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cupGoalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedIdRef = useRef(2);
  const coopStatusRef = useRef<CoopRoom["status"] | null>(null);
  const coopPlayerCountRef = useRef(0);
  const coopEventRef = useRef<number | null>(null);
  const coopPackRevealRef = useRef<number | null>(null);
  const eventAnnouncementRef = useRef<RandomEvent | null>(null);
  const eventAnnouncementQueueRef = useRef<RandomEvent[]>([]);
  const coopClickBatchRef = useRef({ amount: 0, count: 0 });
  const coopClickBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cupGoalRef = useRef<string | null>(null);
  const coopControlQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const coopBackgroundActionRef = useRef<Promise<unknown> | null>(null);
  const coopForegroundPendingRef = useRef(0);
  const eventLockRef = useRef(false);
  const coopRestoreAttemptedRef = useRef(false);
  const pageInactiveAtRef = useRef<number | null>(null);

  const activeCoopCode = coopSession?.code;
  const activeCoopPlayerId = coopSession?.playerId;

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const data = (await response.json()) as { entries?: LeaderboardEntry[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Die Rangliste konnte nicht geladen werden.");
      setLeaderboard(data.entries ?? []);
      setLeaderboardMessage("");
    } catch (error) {
      setLeaderboardMessage(error instanceof Error ? error.message : "Die Rangliste ist gerade nicht erreichbar.");
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const loadSavedRooms = useCallback(async () => {
    if (!playerId) return;
    setRoomsLoading(true);
    try {
      const response = await fetch(multiplayerUrl({ list: "1", playerId }), { cache: "no-store" });
      const data = await readCoopResponse(response);
      if (!response.ok) throw new Error(data.error ?? "Die gespeicherten Räume konnten nicht geladen werden.");
      setSavedRooms(data.rooms ?? []);
    } catch (error) {
      if (appMode === "coop") setCoopMessage(error instanceof Error ? error.message : "Die gespeicherten Räume konnten nicht geladen werden.");
    } finally {
      setRoomsLoading(false);
    }
  }, [appMode, playerId]);

  const restoreCoopRoom = useCallback(async () => {
    const raw = localStorage.getItem(COOP_ROOM_KEY);
    if (!raw || !playerId) return;
    let stored: { code?: unknown; role?: unknown; playerId?: unknown } = {};
    try { stored = JSON.parse(raw) as { code?: unknown; role?: unknown; playerId?: unknown }; } catch { return; }
    const code = typeof stored.code === "string" ? stored.code.trim().toUpperCase().slice(0, 6) : "";
    if (code.length !== 6) return;
    try {
      const storedPlayerId = typeof stored.playerId === "string" ? stored.playerId : "";
      const candidateIds = [...new Set([storedPlayerId, playerId, ...LEGACY_PLAYER_ID_KEYS.map((key) => localStorage.getItem(key) ?? "")].filter((value) => value.length >= 8))];
      for (const candidateId of candidateIds) {
        const response = await fetch(multiplayerUrl({ code, playerId: candidateId }), { cache: "no-store" });
        const data = await readCoopResponse(response);
        if (response.status === 404) {
          localStorage.removeItem(COOP_ROOM_KEY);
          return;
        }
        if (!response.ok || !data.room) continue;
        localStorage.setItem(PLAYER_ID_KEY, candidateId);
        if (candidateId !== playerId) setPlayerId(candidateId);
        coopStatusRef.current = data.room.status;
        coopPlayerCountRef.current = data.room.playerCount;
        setSavedRooms((current) => upsertSavedRoom(current, data.room!));
        setCoopSession({ code: data.room.code, role: data.role ?? (isCoopRole(stored.role) ? stored.role : "host"), playerId: candidateId, room: data.room });
        setAppMode("coop");
        setCoopMessage("Dein Koop Raum wurde wieder geöffnet.");
        return;
      }
      const nickname = normalizeNickname(localStorage.getItem(PLAYER_NAME_KEY) ?? playerName);
      if (nickname.length < 2) return;
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", code, playerId, nickname, preferredRole: stored.role, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      if (!response.ok || !data.room) return;
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? (isCoopRole(stored.role) ? stored.role : "host"), playerId, room: data.room });
      setAppMode("coop");
      setCoopMessage("Dein Platz im Koop Raum wurde sicher wiederhergestellt.");
    } catch {
      setCoopMessage("Der gespeicherte Koop-Raum ist gerade nicht erreichbar.");
    }
  }, [playerId, playerName]);

  const syncCoopRoom = useCallback(async () => {
    if (!activeCoopCode || !activeCoopPlayerId) return;
    try {
      const response = await fetch(multiplayerUrl({ code: activeCoopCode, playerId: activeCoopPlayerId }), { cache: "no-store" });
      const data = await readCoopResponse(response);
      if (!response.ok) {
        if (response.status === 404) {
          localStorage.removeItem(COOP_ROOM_KEY);
          coopStatusRef.current = null;
          coopPlayerCountRef.current = 0;
          setCoopSession(null);
          void loadSavedRooms();
        }
        if (data.error) setCoopMessage(data.error);
        return;
      }
      if (data.room) {
        const previousStatus = coopStatusRef.current;
        const previousPlayerCount = coopPlayerCountRef.current;
        coopStatusRef.current = data.room.status;
        coopPlayerCountRef.current = data.room.playerCount;
        setSavedRooms((current) => upsertSavedRoom(current, data.room!));
        if (previousStatus && previousStatus !== data.room.status) setCoopMessage(data.room.status === "live" ? "Der zweite Spieler ist verbunden. Das Koop-Match läuft." : "Das Koop-Match wartet wieder auf einen zweiten Spieler.");
        else if (previousPlayerCount && previousPlayerCount !== data.room.playerCount) setCoopMessage(data.room.playerCount > previousPlayerCount ? `${data.room.playerCount} von 4 Spielern sind jetzt in dieser Welt.` : `Noch ${data.room.playerCount} von 4 Spielern sind in dieser Welt.`);
        setCoopSession((current) => mergeCoopSessionRoom(current, data.room!, data.role));
      }
    } catch {
      setCoopMessage("Die Verbindung zum Koop-Raum ist gerade unterbrochen.");
    }
  }, [activeCoopCode, activeCoopPlayerId, loadSavedRooms]);

  const rawCoopGame = coopSession?.room.game;
  const normalizedCoopGame = useMemo(() => coopSession?.room.status === "live" ? normalizeRuntimeGame(rawCoopGame, game.sound) : null, [coopSession?.room.status, game.sound, rawCoopGame]);
  const isCoopLive = appMode === "coop" && coopSession?.room.status === "live" && Boolean(normalizedCoopGame);
  const displayGame = isCoopLive && normalizedCoopGame ? { ...normalizedCoopGame, sound: game.sound, lastSaved: game.lastSaved } : game;
  const hasFullTestAccess = isCoopLive && Boolean(coopSession?.room.testMode);
  const hasInfiniteMoney = hasFullTestAccess;
  const spendableGoals = hasInfiniteMoney ? Number.MAX_VALUE : displayGame.goals;
  const displayBalance = hasInfiniteMoney ? "∞" : formatNumber(displayGame.goals);
  const sharedRandomEvent = isCoopLive ? displayGame.features.randomEvent : null;
  const sharedPackReveal = isCoopLive ? displayGame.features.starPackReveal : null;
  const displayedCupGoal = displayGame.features.cup.lastGoal;
  const cupMatchMinute = getCupMatchMinute(displayGame.features.cup.matchStartedAt, countdownNow);
  const starRevealAge = starReveal ? Math.max(0, countdownNow - starReveal.openedAt) : 0;
  const starRevealTier = starReveal ? getStarCardTier(starReveal.player) : "standard";
  const starRevealIsWalkout = starRevealTier === "walkout" || starRevealTier === "icon" || starRevealTier === "legendary";
  const starRevealIsIconic = starRevealTier === "icon";
  const starRevealIsLegendary = starRevealTier === "legendary";
  const starRevealIsRare = starRevealTier === "rare";
  const starWalkoutConfetti = starRevealIsLegendary ? GOLD_CONFETTI : starRevealIsIconic ? SILVER_CONFETTI : null;
  const starWalkoutElapsed = Math.min(STAR_WALKOUT_DURATION_MS, starRevealAge);
  const starRareElapsed = Math.min(STAR_RARE_REVEAL_DURATION_MS, starRevealAge);
  const starWalkoutPresentation = starReveal ? getWalkoutPresentation(starReveal.player) : null;
  const starWalkoutStyle = starWalkoutPresentation ? {
    "--walkout-skin": starWalkoutPresentation.skin,
    "--walkout-hair": starWalkoutPresentation.hairColor,
    "--walkout-primary": starWalkoutPresentation.kitPrimary,
    "--walkout-secondary": starWalkoutPresentation.kitSecondary,
    "--walkout-boots": starWalkoutPresentation.boots,
    "--walkout-height": starWalkoutPresentation.height,
    "--walkout-build": starWalkoutPresentation.build,
    "--walkout-delay": `${-starWalkoutElapsed}ms`,
    "--rare-delay": `${-starRareElapsed}ms`,
  } as CSSProperties : undefined;
  const otherCoopOnlineCount = isCoopLive && coopSession ? coopSession.room.players.filter((player) => player.occupied && player.role !== coopSession.role && player.online).length : 0;
  const otherCoopOnline = otherCoopOnlineCount > 0;
  const displayClubName = displayGame.features.club.name;
  const displayClubBadge = displayGame.features.club.badge;
  const displayClubColor = displayGame.features.club.color;
  const starXIState = displayGame.features.starXI;
  const ownedStarIds = starXIState.ownedIds;
  const lineupStarIds = starXIState.lineupIds;
  const benchStarIds = starXIState.benchIds;
  const ownedStarXIPlayers = useMemo(() => ownedStarIds.map((id) => getStarXIPlayer(id)).filter((player): player is NonNullable<ReturnType<typeof getStarXIPlayer>> => Boolean(player)), [ownedStarIds]);
  const startingStarXIPlayers = useMemo(() => Array.from({ length: STAR_XI_SQUAD_SIZE }, (_, index) => getStarXIPlayer(lineupStarIds[index] ?? "") ?? null), [lineupStarIds]);
  const startingStarXISelection = startingStarXIPlayers.filter((player): player is NonNullable<typeof player> => Boolean(player));
  const benchStarXIPlayers = useMemo(() => Array.from({ length: STAR_XI_BENCH_SIZE }, (_, index) => getStarXIPlayer(benchStarIds[index] ?? "") ?? null), [benchStarIds]);
  const benchStarXIPlayerCount = benchStarXIPlayers.filter(Boolean).length;
  const reserveStarXIPlayers = useMemo(() => ownedStarXIPlayers.filter((player) => !lineupStarIds.includes(player.id) && !benchStarIds.includes(player.id)), [benchStarIds, lineupStarIds, ownedStarXIPlayers]);
  const activeLineupSlot = selectedLineupSlot !== null && selectedLineupSlot < STAR_XI_SQUAD_SIZE ? selectedLineupSlot : null;
  const activeFormation = getStarFormation(starXIState.formationId);
  const activeFormationPositions = displayGame.features.starXI.formationPositions;
  const activeLineupPosition = activeLineupSlot !== null ? activeFormationPositions[activeLineupSlot] : null;
  const starXIRating = getStarXIRating(displayGame.features.starXI.ownedIds, displayGame.features.starXI.lineupIds);
  const cupEffectiveRating = displayGame.features.cup.active ? getStarXIEffectiveMatchRating(displayGame.features.starXI.ownedIds, displayGame.features.starXI.lineupIds, displayGame.features.cup, cupMatchMinute) : starXIRating;
  const cupMatchStrength = getCupMatchStrength(displayGame.features.cup, cupEffectiveRating);
  const opponentStrategy = getCupStrategy(displayGame.features.cup.opponentStrategyId);
  const cupStrengthShare = Math.max(8, Math.min(92, (cupMatchStrength.teamStrength / Math.max(1, cupMatchStrength.teamStrength + cupMatchStrength.opponentStrength)) * 100));
  const totalTrophies = TOURNAMENTS.reduce((total, tournament) => total + displayGame.features.cup.trophies[tournament.id], 0);
  const cupMatchEvents = [...displayGame.features.cup.matchEvents].reverse();
  const cupPenaltyHomeEvents = displayGame.features.cup.penaltyEvents.filter((event) => event.side === "home");
  const cupPenaltyAwayEvents = displayGame.features.cup.penaltyEvents.filter((event) => event.side === "away");
  const cupPenaltySlotCount = Math.max(5, cupPenaltyHomeEvents.length, cupPenaltyAwayEvents.length);
  const cupPenaltyIsSuddenDeath = displayGame.features.cup.penaltyHomeTaken >= 5 && displayGame.features.cup.penaltyAwayTaken >= 5;
  const allTimeTopScorers = Object.entries(displayGame.features.cup.allTimeScorers).map(([starPlayerId, goals]) => ({ player: getStarXIPlayer(starPlayerId), goals })).filter((entry): entry is { player: NonNullable<ReturnType<typeof getStarXIPlayer>>; goals: number } => Boolean(entry.player) && entry.goals > 0).sort((first, second) => second.goals - first.goals || second.player.rating - first.player.rating || first.player.name.localeCompare(second.player.name)).slice(0, 3);
  const starXIComplete = startingStarXISelection.length === STAR_XI_SQUAD_SIZE;
  const filteredReserveStarXIPlayers = useMemo(() => {
    const search = starSearch.trim().toLocaleLowerCase("de-CH");
    return reserveStarXIPlayers.filter((player) => {
      const filter = STAR_RATING_FILTERS.find((item) => item.id === starRatingFilter);
      const inRatingRange = !filter || filter.id === "all" || (() => {
        const [minimum, maximum] = filter.id.split("-").map(Number);
        return player.rating >= minimum && player.rating <= maximum;
      })();
      const inPosition = starPositionFilter === "all" || getStarXIPositions(player).includes(starPositionFilter as (typeof STAR_POSITIONS)[number]);
      return inRatingRange && inPosition && (!search || `${player.name} ${getStarXIPositions(player).join(" ")} ${player.rating}`.toLocaleLowerCase("de-CH").includes(search));
    }).sort((first, second) => {
      if (activeLineupSlot !== null) {
        const firstCompatible = canStarXIPlayerFillSlot(first.id, activeLineupSlot, activeFormationPositions);
        const secondCompatible = canStarXIPlayerFillSlot(second.id, activeLineupSlot, activeFormationPositions);
        if (firstCompatible !== secondCompatible) return firstCompatible ? -1 : 1;
      }
      return second.rating - first.rating || first.name.localeCompare(second.name);
    });
  }, [activeFormationPositions, activeLineupSlot, reserveStarXIPlayers, starPositionFilter, starRatingFilter, starSearch]);
  const reservePageCount = Math.max(1, Math.ceil(filteredReserveStarXIPlayers.length / RESERVE_PAGE_SIZE));
  const activeReservePage = Math.min(reservePage, reservePageCount - 1);
  const visibleReserveStarXIPlayers = useMemo(() => {
    const start = activeReservePage * RESERVE_PAGE_SIZE;
    return filteredReserveStarXIPlayers.slice(start, start + RESERVE_PAGE_SIZE);
  }, [activeReservePage, filteredReserveStarXIPlayers]);
  const currentRank = useMemo(() => getRank(displayGame.totalGoals), [displayGame.totalGoals]);
  const nextRank = useMemo(() => RANKS.find((rank) => rank.minimum > displayGame.totalGoals), [displayGame.totalGoals]);
  const goalBoostMultiplier = getGoalBoostMultiplier(displayGame.features, countdownNow);
  const goalBoostActive = goalBoostMultiplier > 1;
  const goalBoostLabel = String(goalBoostMultiplier).replace(".", ",");
  const goalBoostCountdown = formatCountdown(displayGame.features.goalBoost.endsAt, countdownNow);
  const clickPower = getClickPower(displayGame.upgrades, displayGame.stars, displayGame.features, countdownNow);
  const passivePower = getPassivePower(displayGame.upgrades, displayGame.stars, displayGame.features, countdownNow);
  const currentSeason = getCurrentSeason(displayGame.seasons);
  const currentSeasonMilestone = getSeasonMilestone(currentSeason);
  const nextSeasonMilestone = currentSeason < SEASON_MILESTONES.length ? getSeasonMilestone(currentSeason + 1) : null;
  const unlockedFormationCount = STAR_FORMATIONS.filter((formation) => isSeasonContentUnlocked(getFormationUnlockSeason(formation.id), displayGame.seasons, hasFullTestAccess)).length;
  const seasonPath = getSeasonPath(displayGame.goals, displayGame.seasons);
  const seasonTarget = seasonPath.target;
  const seasonProgress = seasonPath.progress;
  const seasonReward = seasonPath.reward;
  const seasonCareerComplete = currentSeason >= MAX_CAREER_SEASON;
  const canStartNewSeason = !seasonCareerComplete && seasonPath.canAdvance;
  const visibleUpgrades = UPGRADES.filter((upgrade) => activeTab === "all" || upgrade.kind === activeTab);
  const isMiniGameOnCooldown = (id: MiniGameId) => displayGame.miniGameCooldowns[id] > countdownNow;
  const miniGameCooldownLabel = (id: MiniGameId, availableLabel: string) => isMiniGameOnCooldown(id) ? `Bereit in ${formatCountdown(displayGame.miniGameCooldowns[id], countdownNow)}` : availableLabel;

  useEffect(() => {
    const storedId = localStorage.getItem(PLAYER_ID_KEY);
    const legacyId = LEGACY_PLAYER_ID_KEYS.map((key) => localStorage.getItem(key)).find((value) => Boolean(value));
    const nextId = storedId || legacyId || globalThis.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PLAYER_ID_KEY, nextId);
    window.setTimeout(() => {
      setPlayerId(nextId);
      setPlayerName(localStorage.getItem(PLAYER_NAME_KEY) ?? "");
    }, 0);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) setLayoutOrder(normalizeLayoutOrder(JSON.parse(saved)));
      } catch {
        // Keep the standard layout when local storage contains invalid data.
      }
      setLayoutReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || !layoutReady) return;
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutOrder));
  }, [hydrated, layoutReady, layoutOrder]);

  useEffect(() => {
    if (!coopSession) return;
    localStorage.setItem(COOP_ROOM_KEY, JSON.stringify({ code: coopSession.code, role: coopSession.role, playerId: coopSession.playerId }));
  }, [coopSession]);

  useEffect(() => {
    if (!coopSession?.room.roomName) return;
    const syncName = window.setTimeout(() => setCoopRoomName(coopSession.room.roomName), 0);
    return () => window.clearTimeout(syncName);
  }, [coopSession?.room.roomName]);

  useEffect(() => () => {
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    if (cupGoalTimerRef.current) window.clearTimeout(cupGoalTimerRef.current);
    if (coopClickBatchTimerRef.current) window.clearTimeout(coopClickBatchTimerRef.current);
  }, []);

  useEffect(() => {
    coopEventRef.current = null;
    coopPackRevealRef.current = null;
    cupGoalRef.current = null;
    eventAnnouncementRef.current = null;
    eventAnnouncementQueueRef.current = [];
    const resetGoal = window.setTimeout(() => {
      setCupGoalAnnouncement(null);
      setEventAnnouncement(null);
    }, 0);
    return () => window.clearTimeout(resetGoal);
  }, [activeCoopCode]);

  useEffect(() => {
    if (!isCoopLive || !sharedRandomEvent || coopEventRef.current === sharedRandomEvent.createdAt) return;
    coopEventRef.current = sharedRandomEvent.createdAt;
    presentEventAnnouncement(sharedRandomEvent);
    showToast(sharedRandomEvent.title);
    addFeed(sharedRandomEvent.message, sharedRandomEvent.tone === "negative" ? "screen" : sharedRandomEvent.id === "var" ? "screen" : "star");
    // Present the server-broadcast event on both devices.
  }, [isCoopLive, sharedRandomEvent]);

  useEffect(() => {
    if (!isCoopLive || !sharedPackReveal || coopPackRevealRef.current === sharedPackReveal.openedAt) return;
    if (getCurrentTime() - sharedPackReveal.openedAt > STAR_WALKOUT_DURATION_MS + 15000) {
      coopPackRevealRef.current = sharedPackReveal.openedAt;
      return;
    }
    coopPackRevealRef.current = sharedPackReveal.openedAt;
    presentStarReveal(sharedPackReveal);
    showToast(sharedPackReveal.duplicate ? "Doppelter Star · Entschädigung" : `${sharedPackReveal.player.name} gezogen`);
    // Present the shared pack result on both devices.
  }, [isCoopLive, sharedPackReveal]);

  useEffect(() => {
    if (!displayedCupGoal || cupGoalRef.current === displayedCupGoal.id || getCurrentTime() - displayedCupGoal.createdAt > 12000) return;
    cupGoalRef.current = displayedCupGoal.id;
    setCupGoalAnnouncement(displayedCupGoal);
    if (cupGoalTimerRef.current) window.clearTimeout(cupGoalTimerRef.current);
    cupGoalTimerRef.current = window.setTimeout(() => {
      setCupGoalAnnouncement(null);
      cupGoalTimerRef.current = null;
    }, 5200);
    addFeed(`${displayedCupGoal.scorer} trifft in der ${displayedCupGoal.minute}. Minute.`, "crown");
  }, [displayedCupGoal]);

  useEffect(() => {
    if (!hydrated || !playerId || coopRestoreAttemptedRef.current) return;
    coopRestoreAttemptedRef.current = true;
    void restoreCoopRoom();
  }, [hydrated, playerId, restoreCoopRoom]);

  useEffect(() => {
    if (!hydrated || appMode !== "coop" || !playerId || coopSession) return;
    const initialLoad = window.setTimeout(() => void loadSavedRooms(), 0);
    const timer = window.setInterval(() => void loadSavedRooms(), 5000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [appMode, coopSession, hydrated, loadSavedRooms, playerId]);

  useEffect(() => {
    if (!hydrated || appMode !== "leaderboard") return;
    const initialLoad = window.setTimeout(() => void loadLeaderboard(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [appMode, hydrated, loadLeaderboard]);

  useEffect(() => {
    if (!hydrated || appMode !== "coop" || !activeCoopCode || !activeCoopPlayerId || coopSession?.room.status === "live") return;
    const syncWhileOpen = () => void syncCoopRoom();
    const initialSync = window.setTimeout(syncWhileOpen, 0);
    const timer = window.setInterval(syncWhileOpen, 1500);
    return () => { window.clearTimeout(initialSync); window.clearInterval(timer); };
  }, [activeCoopCode, activeCoopPlayerId, appMode, coopSession?.room.status, hydrated, syncCoopRoom]);

  useEffect(() => {
    if (!hydrated || appMode !== "coop" || !activeCoopCode || !activeCoopPlayerId || coopSession?.room.status !== "live") return;
    const timer = window.setInterval(() => void sendCoopAction("tick"), 1500);
    return () => window.clearInterval(timer);
    // Background synchronisation is coalesced by sendCoopAction and must not restart on every room update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCoopCode, activeCoopPlayerId, appMode, coopSession?.room.status, hydrated]);

  useEffect(() => {
    if (!hydrated || !activeCoopCode || !activeCoopPlayerId) return;
    const markOffline = () => notifyCoopOffline(activeCoopCode, activeCoopPlayerId);
    window.addEventListener("beforeunload", markOffline);
    window.addEventListener("pagehide", markOffline);
    return () => {
      window.removeEventListener("beforeunload", markOffline);
      window.removeEventListener("pagehide", markOffline);
    };
  }, [activeCoopCode, activeCoopPlayerId, hydrated]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    const nextClub = { name: displayClubName, badge: displayClubBadge, color: displayClubColor };
    const syncClub = window.setTimeout(() => setClubDraft(nextClub), 0);
    return () => window.clearTimeout(syncClub);
  }, [displayClubBadge, displayClubColor, displayClubName]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => setCountdownNow(getCurrentTime()), 1000);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 1900);
  }

  function presentEventAnnouncement(event: RandomEvent) {
    if (eventAnnouncementRef.current) {
      const alreadyQueued = eventAnnouncementQueueRef.current.some((queued) => queued.createdAt === event.createdAt);
      if (!alreadyQueued && eventAnnouncementRef.current.createdAt !== event.createdAt) {
        eventAnnouncementQueueRef.current = [...eventAnnouncementQueueRef.current.slice(-3), event];
      }
      return;
    }
    eventAnnouncementRef.current = event;
    setEventAnnouncement(event);
  }

  function dismissEventAnnouncement() {
    const next = eventAnnouncementQueueRef.current.shift() ?? null;
    eventAnnouncementRef.current = next;
    setEventAnnouncement(next);
  }

  function clearEventAnnouncements() {
    eventAnnouncementQueueRef.current = [];
    eventAnnouncementRef.current = null;
    setEventAnnouncement(null);
  }

  function flushCoopClickBatch() {
    if (coopForegroundPendingRef.current > 0) {
      coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 70);
      return;
    }
    const batch = coopClickBatchRef.current;
    coopClickBatchRef.current = { amount: 0, count: 0 };
    coopClickBatchTimerRef.current = null;
    if (batch.count > 0) void sendCoopAction("click", { amount: batch.amount, clickCount: batch.count });
  }

  function queueCoopClick(amount: number) {
    if (coopClickBatchRef.current.count >= 50) flushCoopClickBatch();
    coopClickBatchRef.current.amount += amount;
    coopClickBatchRef.current.count += 1;
    if (coopClickBatchTimerRef.current) return;
    coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 70);
  }

  function addFeed(text: string, icon: IconName) {
    const entry = { id: feedIdRef.current++, icon, text };
    setFeed((current) => [entry, ...current].slice(0, 3));
  }

  function presentStarReveal(reveal: StarPackReveal) {
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    const elapsed = Math.max(0, Date.now() - reveal.openedAt);
    const tier = getStarCardTier(reveal.player);
    const revealDuration = tier === "rare" ? STAR_RARE_REVEAL_DURATION_MS : tier === "walkout" || tier === "icon" || tier === "legendary" ? STAR_WALKOUT_DURATION_MS : 0;
    setStarReveal(reveal);
    if (elapsed < revealDuration) {
      setStarWalkoutReady(false);
      starRevealTimerRef.current = window.setTimeout(() => {
        setStarWalkoutReady(true);
        starRevealTimerRef.current = null;
      }, revealDuration - elapsed);
      return;
    }
    setStarWalkoutReady(true);
    starRevealTimerRef.current = null;
  }

  function dismissStarReveal() {
    if (starRevealTimerRef.current) window.clearTimeout(starRevealTimerRef.current);
    starRevealTimerRef.current = null;
    setStarWalkoutReady(false);
    setStarReveal(null);
  }

  function dismissCupGoal() {
    if (cupGoalTimerRef.current) window.clearTimeout(cupGoalTimerRef.current);
    cupGoalTimerRef.current = null;
    setCupGoalAnnouncement(null);
  }

  function layoutOrderNumber(id: LayoutCardId) {
    return layoutOrder.indexOf(id) + 1;
  }

  function layoutCardClass(id: LayoutCardId, baseClass: string) {
    return `${baseClass} layout-card${layoutEditMode ? " layout-card-editing" : ""}${dragOverLayoutCard === id ? " layout-card-drag-over" : ""}`;
  }

  function handleLayoutDragStart(event: DragEvent<HTMLElement>, id: LayoutCardId) {
    if (!layoutEditMode) return;
    setDraggingLayoutCard(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleLayoutDragOver(event: DragEvent<HTMLElement>, id: LayoutCardId) {
    if (!layoutEditMode || !draggingLayoutCard || draggingLayoutCard === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverLayoutCard(id);
  }

  function handleLayoutDrop(event: DragEvent<HTMLElement>, targetId: LayoutCardId) {
    if (!layoutEditMode) return;
    event.preventDefault();
    const sourceId = draggingLayoutCard ?? event.dataTransfer.getData("text/plain") as LayoutCardId;
    if (!sourceId || sourceId === targetId || !LAYOUT_CARD_IDS.includes(sourceId)) {
      setDraggingLayoutCard(null);
      setDragOverLayoutCard(null);
      return;
    }
    setLayoutOrder((current) => {
      const next = current.filter((id) => id !== sourceId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceId);
      return normalizeLayoutOrder(next);
    });
    setDraggingLayoutCard(null);
    setDragOverLayoutCard(null);
  }

  function handleLayoutDragEnd() {
    setDraggingLayoutCard(null);
    setDragOverLayoutCard(null);
  }

  function moveLayoutCard(id: LayoutCardId, direction: -1 | 1) {
    setLayoutOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + direction));
      if (index < 0 || index === nextIndex) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function resetLayout() {
    setLayoutOrder(DEFAULT_LAYOUT_ORDER);
    showToast("Standardanordnung wiederhergestellt");
  }

  async function submitLeaderboard() {
    const nickname = normalizeNickname(playerName);
    if (!playerId) {
      setLeaderboardMessage("Deine Spieler-ID wird noch vorbereitet.");
      return;
    }
    if (nickname.length < 2) {
      setLeaderboardMessage("Gib zuerst einen Spielernamen mit mindestens 2 Zeichen ein.");
      return;
    }
    localStorage.setItem(PLAYER_NAME_KEY, nickname);
    setPlayerName(nickname);
    setLeaderboardMessage("Spielstand wird eingetragen …");
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, nickname, totalGoals: game.totalGoals, seasonGoals: game.seasonGoals, minigameWins: game.minigameWins }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Der Spielstand konnte nicht eingetragen werden.");
      setLeaderboardMessage("Dein Singleplayer-Spielstand ist online.");
      await loadLeaderboard();
    } catch (error) {
      setLeaderboardMessage(error instanceof Error ? error.message : "Die Rangliste ist gerade nicht erreichbar.");
    }
  }

  async function createCoopRoom() {
    const nickname = normalizeNickname(playerName);
    if (!playerId) {
      setCoopMessage("Deine Spieler-ID wird noch vorbereitet.");
      return;
    }
    if (nickname.length < 2) {
      setCoopMessage("Gib zuerst deinen Spielernamen ein.");
      return;
    }
    setCoopBusy(true);
    localStorage.setItem(PLAYER_NAME_KEY, nickname);
    setPlayerName(nickname);
    try {
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", playerId, nickname, roomName: coopRoomName, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      if (!response.ok || !data.room) throw new Error(data.error ?? "Der Koop-Raum konnte nicht erstellt werden.");
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? "host", playerId, room: data.room });
      setCoopMessage("Raum erstellt. Teile den Code mit bis zu drei Mitspielern.");
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : "Der Koop-Raum konnte nicht erstellt werden.");
    } finally {
      setCoopBusy(false);
    }
  }

  async function joinCoopRoom() {
    const nickname = normalizeNickname(playerName);
    const code = coopCodeInput.trim().toUpperCase().slice(0, 6);
    if (!playerId) {
      setCoopMessage("Deine Spieler-ID wird noch vorbereitet.");
      return;
    }
    if (nickname.length < 2) {
      setCoopMessage("Gib zuerst deinen Spielernamen ein.");
      return;
    }
    if (code.length !== 6) {
      setCoopMessage("Ein Raumcode besteht aus 6 Zeichen.");
      return;
    }
    setCoopBusy(true);
    localStorage.setItem(PLAYER_NAME_KEY, nickname);
    setPlayerName(nickname);
    try {
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", code, playerId, nickname, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      if (!response.ok || !data.room) throw new Error(data.error ?? "Der Raum konnte nicht betreten werden.");
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? "guest", playerId, room: data.room });
      setCoopMessage(`${data.room.playerCount} von 4 Spielern sind im Raum. Jetzt gemeinsam Tore sammeln.`);
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : "Der Raum konnte nicht betreten werden.");
    } finally {
      setCoopBusy(false);
    }
  }

  async function reopenSavedRoom(code: string) {
    if (!playerId || code.length !== 6) return;
    setCoopBusy(true);
    try {
      const response = await fetch(multiplayerUrl({ code, playerId }), { cache: "no-store" });
      const data = await readCoopResponse(response);
      if (!response.ok || !data.room) throw new Error(data.error ?? "Der Raum konnte nicht geöffnet werden.");
      coopStatusRef.current = data.room.status;
      coopPlayerCountRef.current = data.room.playerCount;
      setSavedRooms((current) => upsertSavedRoom(current, data.room!));
      setCoopSession({ code: data.room.code, role: data.role ?? "host", playerId, room: data.room });
      setAppMode("coop");
      setCoopMessage("Gespeicherter Koop-Raum geöffnet.");
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : "Der Raum konnte nicht geöffnet werden.");
      if (error instanceof Error && error.message.includes("nicht in diesem Raum")) {
        setSavedRooms((current) => current.filter((room) => room.code !== code));
      }
    } finally {
      setCoopBusy(false);
    }
  }

  function leaveCoopRoom() {
    notifyCoopOffline(coopSession?.code, coopSession?.playerId);
    localStorage.removeItem(COOP_ROOM_KEY);
    coopStatusRef.current = null;
    coopPlayerCountRef.current = 0;
    coopEventRef.current = null;
    coopPackRevealRef.current = null;
    clearEventAnnouncements();
    dismissStarReveal();
    setCoopSession(null);
    setCoopMessage("Du hast den Koop-Raum verlassen. Er bleibt gespeichert und kann später wieder geöffnet werden.");
    void loadSavedRooms();
  }

  async function deleteCoopRoom(code: string) {
    const room = coopSession?.code === code ? coopSession.room : savedRooms.find((item) => item.code === code);
    if (!room?.canDelete) {
      setCoopMessage("Nur der Host kann diesen Raum löschen.");
      return;
    }
    if (!window.confirm(`Raum ${code} wirklich löschen? Der gemeinsame Spielstand geht für alle verloren.`)) return;
    setCoopBusy(true);
    try {
      const response = await fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", code, playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION }) });
      const data = await readCoopResponse(response);
      if (!response.ok || !data.deleted) throw new Error(data.error ?? "Der Raum konnte nicht gelöscht werden.");
      localStorage.removeItem(COOP_ROOM_KEY);
      setSavedRooms((current) => current.filter((item) => item.code !== code));
      if (coopSession?.code === code) {
        coopStatusRef.current = null;
        coopPlayerCountRef.current = 0;
        coopEventRef.current = null;
        coopPackRevealRef.current = null;
        clearEventAnnouncements();
        dismissStarReveal();
        setCoopSession(null);
      }
      setCoopMessage("Raum gelöscht. Er ist bei allen Spielern entfernt.");
      void loadSavedRooms();
    } catch (error) {
      setCoopMessage(error instanceof Error ? error.message : "Der Raum konnte nicht gelöscht werden.");
    } finally {
      setCoopBusy(false);
    }
  }

  async function sendCoopAction(action: string, extra: Record<string, unknown> = {}) {
    if (!coopSession) return null;
    const run = async () => {
      const maxAttempts = action === "click" ? 1 : 4;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const response = await fetch("/api/multiplayer", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, code: coopSession.code, playerId: coopSession.playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION, ...extra }),
          });
          const data = await readCoopResponse(response);
          if (data.room) setCoopSession((current) => mergeCoopSessionRoom(current, data.room!, data.role));
          if (!response.ok && data.errorCode === "STALE_STATE" && attempt + 1 < maxAttempts) continue;
          if (!response.ok) {
            setCoopMessage(data.error ?? "Die Koop-Aktion ist fehlgeschlagen.");
            return null;
          }
          if (data.packReveal) {
            coopPackRevealRef.current = data.packReveal.openedAt;
            presentStarReveal(data.packReveal);
            showToast(data.packReveal.duplicate ? "Doppelter Star · Entschädigung" : `${data.packReveal.player.name} gezogen`);
          }
          return data;
        } catch {
          if (action !== "click" && attempt + 1 < Math.min(3, maxAttempts)) continue;
          setCoopMessage("Die Verbindung zum Koop-Raum ist gerade unterbrochen.");
          return null;
        }
      }
      setCoopMessage("Die Koop-Aktion konnte nach mehreren gleichzeitigen Änderungen nicht gespeichert werden.");
      return null;
    };
    // Klicks werden serverseitig atomar addiert. Hintergrund-Ticks werden
    // zusammengefasst, damit sie Käufe während eines Live-Spiels nie blockieren.
    if (action === "click") return run();
    if (action === "tick" || action === "cup-tick") {
      if (coopForegroundPendingRef.current > 0 || coopBackgroundActionRef.current) return null;
      const backgroundAction = run();
      coopBackgroundActionRef.current = backgroundAction;
      try {
        return await backgroundAction;
      } finally {
        if (coopBackgroundActionRef.current === backgroundAction) coopBackgroundActionRef.current = null;
      }
    }

    coopForegroundPendingRef.current += 1;
    const runForeground = async () => {
      const backgroundAction = coopBackgroundActionRef.current;
      if (backgroundAction) await backgroundAction;
      return run();
    };
    const queued = coopControlQueueRef.current.then(runForeground, runForeground);
    coopControlQueueRef.current = queued.then(() => undefined, () => undefined);
    try {
      return await queued;
    } finally {
      coopForegroundPendingRef.current = Math.max(0, coopForegroundPendingRef.current - 1);
      if (coopForegroundPendingRef.current === 0 && coopClickBatchRef.current.count > 0 && !coopClickBatchTimerRef.current) {
        coopClickBatchTimerRef.current = window.setTimeout(flushCoopClickBatch, 0);
      }
    }
  }

  async function copyCoopCode() {
    if (!coopSession) return;
    try {
      await navigator.clipboard?.writeText(coopSession.code);
      setCoopMessage("Raumcode kopiert.");
    } catch {
      setCoopMessage(`Raumcode: ${coopSession.code}`);
    }
  }

  async function renameCoopRoom() {
    if (!coopSession || coopSession.role !== "host") return;
    const roomName = coopRoomName.trim().replace(/\s+/g, " ").slice(0, 28);
    if (!roomName) {
      setCoopMessage("Gib deiner Welt zuerst einen Namen.");
      return;
    }
    setCoopBusy(true);
    const data = await sendCoopAction("rename-room", { roomName });
    if (data?.room) setCoopMessage(`Die Welt heisst jetzt ${data.room.roomName}.`);
    setCoopBusy(false);
  }

  async function redeemLobbyBonus() {
    if (!coopSession) return;
    const bonusCode = lobbyBonusCode.trim().toUpperCase();
    if (!bonusCode) {
      setCoopMessage("Gib zuerst einen Lobby Code ein.");
      return;
    }
    setCoopBusy(true);
    const data = await sendCoopAction("redeem-lobby-code", { bonusCode });
    if (data?.room) {
      setLobbyBonusCode("");
      if (bonusCode === "AZB") {
        setCoopMessage("AZB Testmodus aktiviert: Unbegrenztes Guthaben und alle Saison Inhalte sind freigeschaltet.");
        showToast("∞ Alles freigeschaltet");
      } else if (bonusCode === "SILVAN") {
        setCoopMessage("Silvan Code eingelöst: Silvuz ist für euren gemeinsamen Club freigeschaltet.");
        showToast("Silvuz · 100 Rating");
      }
    }
    setCoopBusy(false);
  }

  function applyLocalEvent(event: RandomEvent) {
    presentEventAnnouncement(event);
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const amount = Math.floor(event.amount);
      features.randomEvent = event;
      if (event.id === "var") features.nextVarAt = Date.now() + getRandomEventDelay();
      else features.nextEventAt = Date.now() + getRandomEventDelay();
      addHistory(features, { title: event.title, detail: event.message, tone: event.tone });
      return {
        ...current,
        goals: Math.max(0, current.goals + amount),
        seasonGoals: Math.max(0, current.seasonGoals + amount),
        totalGoals: Math.max(0, current.totalGoals + Math.max(0, amount)),
        features,
      };
    });
    addFeed(event.message, event.tone === "negative" ? "screen" : event.id === "var" ? "screen" : "star");
    showToast(event.title);
  }

  function triggerRandomEvent() {
    if (eventLockRef.current || gameRef.current.features.nextEventAt > getCurrentTime()) return;
    eventLockRef.current = true;
    const event = resolveRandomEvent(gameRef.current.goals);
    applyLocalEvent(event);
    window.setTimeout(() => { eventLockRef.current = false; }, 1200);
  }

  function triggerVarEvent() {
    if (eventLockRef.current || gameRef.current.features.nextVarAt > getCurrentTime()) return;
    eventLockRef.current = true;
    const event = resolveVarEvent(gameRef.current.goals);
    applyLocalEvent(event);
    window.setTimeout(() => { eventLockRef.current = false; }, 1200);
  }

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setInterval(() => {
      if (appMode === "coop" && isCoopLive) {
        if (displayGame.features.nextVarAt <= getCurrentTime()) void sendCoopAction("var-event");
        else if (displayGame.features.nextEventAt <= getCurrentTime()) void sendCoopAction("event");
      } else if (appMode === "single") {
        if (gameRef.current.features.nextVarAt <= getCurrentTime()) triggerVarEvent();
        else if (gameRef.current.features.nextEventAt <= getCurrentTime()) triggerRandomEvent();
      }
    }, 5000);
    return () => window.clearInterval(timer);
    // These handlers intentionally stay out of the dependency list so the five-second clock is not restarted on every click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, displayGame.features.nextEventAt, displayGame.features.nextVarAt, hydrated, isCoopLive]);

  async function saveClubProfile() {
    const profile = {
      name: clubDraft.name.trim().replace(/\s+/g, " ").slice(0, 22) || "FC Goal",
      badge: CLUB_BADGES.includes(clubDraft.badge) ? clubDraft.badge : CLUB_BADGES[0],
      color: CLUB_COLORS.includes(clubDraft.color) ? clubDraft.color : CLUB_COLORS[0],
    };
    setClubDraft(profile);
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("profile", profile);
      if (data) setCoopMessage("Clubprofil gemeinsam gespeichert.");
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.club = profile;
      addHistory(features, { title: "Clubprofil aktualisiert", detail: `${profile.badge} ${profile.name} ist bereit für die nächste Runde.`, tone: "neutral" });
      return { ...current, features };
    });
    showToast("Clubprofil gespeichert");
  }

  async function buyTransfer(playerIdToBuy: string) {
    const player = getTransferPlayer(playerIdToBuy);
    if (!player) return;
    if (displayGame.features.transferMarket.ownedIds.includes(player.id)) return;
    if (!hasInfiniteMoney && displayGame.goals < player.price) {
      showToast(`${player.name} kostet ${formatNumber(player.price)} Tore.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("transfer-buy", { transferId: player.id });
      if (data) setCoopMessage(`${player.name} spielt jetzt für den gemeinsamen Club.`);
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (current.goals < player.price || features.transferMarket.ownedIds.includes(player.id)) return current;
      features.transferMarket.ownedIds = [...features.transferMarket.ownedIds, player.id];
      const remaining = features.transferMarket.offerIds.filter((id) => id !== player.id);
      features.transferMarket.offerIds = [...remaining, ...getFreshTransferOffers(features.transferMarket.ownedIds)].filter((id, index, list) => list.indexOf(id) === index).slice(0, 3);
      addHistory(features, { title: `${player.name} verpflichtet`, detail: `${player.position} · ${player.rating} Rating · neuer Bonus aktiv`, tone: "positive" });
      return { ...current, goals: current.goals - player.price, features };
    });
    showToast(`${player.name} verpflichtet`);
  }

  async function refreshTransferMarket() {
    const refreshCost = 5000;
    if (!hasInfiniteMoney && displayGame.goals < refreshCost) {
      showToast(`Marktneustart kostet ${formatNumber(refreshCost)} Tore.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("transfer-refresh");
      if (data) setCoopMessage("Der Transfermarkt wurde neu gemischt.");
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (current.goals < refreshCost) return current;
      features.transferMarket.offerIds = getFreshTransferOffers(features.transferMarket.ownedIds);
      addHistory(features, { title: "Transfermarkt neu gemischt", detail: `Neue Angebote für ${formatNumber(refreshCost)} Tore.`, tone: "neutral" });
      return { ...current, goals: current.goals - refreshCost, features };
    });
    showToast("Neue Transferangebote");
  }

  async function buyStarPack(packId: StarPackId) {
    const pack = getStarPack(packId);
    if (!pack) return;
    const unlockSeason = getPackUnlockSeason(pack.id);
    if (!isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess)) {
      showToast(`${pack.label} wird in Saison ${unlockSeason} freigeschaltet.`);
      return;
    }
    if (displayGame.features.cup.active) {
      showToast("Während eines Pokalspiels keine Packs.");
      return;
    }
    if (!hasInfiniteMoney && displayGame.goals < pack.price) {
      showToast(`${pack.label} kostet ${formatNumber(pack.price)} Tore.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      try {
        await sendCoopAction("star-pack", { packId: pack.id });
      } finally {
        setCoopBusy(false);
      }
      return;
    }
    const opening = openStarPack(pack.id, displayGame.features.starXI.ownedIds);
    const reveal: StarPackReveal = { ...opening, openedAt: Date.now(), openedBy: "Du" };
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (current.goals < pack.price || features.cup.active) return current;
      features.starPackReveal = reveal;
      if (!opening.duplicate) features.starXI = addStarXIPlayer(features.starXI, opening.player.id);
      if (opening.duplicate) {
        addHistory(features, { title: `Doppelter Star: ${opening.player.name}`, detail: `+${formatNumber(opening.compensation)} Tore Entschädigung · Pack bleibt selten.`, tone: "neutral" });
      } else {
        addHistory(features, { title: `${opening.player.name} in die Star XI gezogen`, detail: `${formatStarXIPositions(opening.player)} · Rating ${opening.player.rating}`, tone: "positive" });
      }
      return { ...current, goals: current.goals - pack.price + opening.compensation, seasonGoals: current.seasonGoals + opening.compensation, totalGoals: current.totalGoals + opening.compensation, features };
    });
    presentStarReveal(reveal);
    showToast(opening.duplicate ? "Doppelter Star · Entschädigung" : `${opening.player.name} gezogen`);
  }

  async function moveStarXIPlayerToLineup(playerId: string, lineupIndex: number) {
    const player = getStarXIPlayer(playerId);
    if (!player || !Number.isInteger(lineupIndex) || lineupIndex < 0 || lineupIndex >= STAR_XI_SQUAD_SIZE || !displayGame.features.starXI.ownedIds.includes(playerId)) return;
    const lineupPosition = activeFormationPositions[lineupIndex];
    if (!canStarXIPlayerFillSlot(playerId, lineupIndex, activeFormationPositions)) {
      showToast(`${player.name} kann nicht auf ${lineupPosition} spielen.`);
      return;
    }
    const comesFromBench = displayGame.features.starXI.benchIds.includes(playerId);
    if (displayGame.features.cup.active && !comesFromBench) {
      showToast("Während des Spiels kannst du nur von der Bank wechseln.");
      return;
    }
    if (displayGame.features.cup.active && displayGame.features.cup.substitutionsUsed >= STAR_XI_MAX_SUBSTITUTIONS) {
      showToast("Alle fünf Wechsel sind bereits gebraucht.");
      return;
    }
    if (displayGame.features.cup.active && displayGame.features.cup.playerExitedAt[playerId]) {
      showToast(`${player.name} wurde bereits ausgewechselt und darf nicht zurück aufs Feld.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-lineup", { lineupIndex, starPlayerId: playerId });
      if (data) setCoopMessage(displayGame.features.cup.active ? `${player.name} wird live eingewechselt.` : `${player.name} spielt jetzt auf Position ${lineupPosition}.`);
      setCoopBusy(false);
      if (data) setSelectedLineupSlot(null);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const outgoingPlayerId = features.starXI.lineupIds[lineupIndex];
      features.starXI = setStarXIStarter(features.starXI, lineupIndex, playerId);
      if (features.cup.active) {
        const substitutionMinute = getCupMatchMinute(features.cup.matchStartedAt, getCurrentTime());
        if (outgoingPlayerId) features.cup.playerExitedAt[outgoingPlayerId] = substitutionMinute;
        features.cup.playerEnteredAt[playerId] = substitutionMinute;
        features.cup.playerMatchPositions[playerId] = features.starXI.formationPositions[lineupIndex] ?? player.position;
        features.cup.substitutionsUsed = Math.min(STAR_XI_MAX_SUBSTITUTIONS, features.cup.substitutionsUsed + 1);
      }
      return { ...current, features };
    });
    showToast(displayGame.features.cup.active ? `${player.name} wird eingewechselt` : `${player.name} auf ${lineupPosition} gesetzt`);
    setSelectedLineupSlot(null);
    setSelectedBenchSlot(null);
  }

  async function selectStarXIPlayer(playerId: string) {
    if (activeLineupSlot === null) {
      showToast("Wähle zuerst einen Platz in der Startelf oder ziehe den Spieler direkt aufs Feld.");
      return;
    }
    await moveStarXIPlayerToLineup(playerId, activeLineupSlot);
  }

  async function changeStarXIFormation(formationId: StarFormationId) {
    if (displayGame.features.cup.active || activeFormation.id === formationId) return;
    const formation = getStarFormation(formationId);
    const unlockSeason = getFormationUnlockSeason(formation.id);
    if (!isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess)) {
      showToast(`${formation.label} wird in Saison ${unlockSeason} freigeschaltet.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-formation", { formationId });
      if (data) setCoopMessage(`Formation auf ${formation.label} umgestellt.`);
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.starXI = setStarXIFormation(features.starXI, formationId);
      addHistory(features, { title: "Formation angepasst", detail: `Die Startelf spielt jetzt im ${formation.label}.`, tone: "neutral" });
      return { ...current, features };
    });
    setSelectedLineupSlot(null);
    showToast(`Formation: ${formation.label}`);
  }

  async function selectStarXIBenchPlayer(playerId: string, benchIndex: number) {
    const player = getStarXIPlayer(playerId);
    if (!player || displayGame.features.cup.active || !displayGame.features.starXI.ownedIds.includes(playerId) || displayGame.features.starXI.lineupIds.includes(playerId)) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("star-bench", { benchIndex, starPlayerId: playerId });
      if (data) setCoopMessage(`${player.name} sitzt jetzt auf Bankplatz ${benchIndex + 1}.`);
      setCoopBusy(false);
      if (data) setSelectedBenchSlot(null);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      features.starXI = setStarXIBenchPlayer(features.starXI, benchIndex, playerId);
      return { ...current, features };
    });
    setSelectedBenchSlot(null);
    showToast(`${player.name} auf die Bank verschoben`);
  }

  function chooseLineupSlot(index: number) {
    setSelectedLineupSlot((current) => current === index ? null : index);
    setSelectedBenchSlot(null);
    setReservePage(0);
  }

  function chooseBenchSlot(index: number) {
    if (displayGame.features.cup.active) {
      showToast("Wähle zuerst den Spieler in der Startelf, den du auswechseln willst.");
      return;
    }
    setSelectedBenchSlot((current) => current === index ? null : index);
    setSelectedLineupSlot(null);
    setReservePage(0);
  }

  function canDropSquadPlayer(source: SquadDragSource, target: SquadDropTarget) {
    const player = getStarXIPlayer(source.playerId);
    if (!player || coopBusy || !displayGame.features.starXI.ownedIds.includes(source.playerId)) return false;

    if (target.area === "lineup") {
      if (target.index < 0 || target.index >= STAR_XI_SQUAD_SIZE || !canStarXIPlayerFillSlot(source.playerId, target.index, activeFormationPositions)) return false;
      if (source.area === "lineup" && source.index === target.index) return false;
      if (displayGame.features.cup.active) {
        return source.area === "bench"
          && displayGame.features.cup.substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS
          && !displayGame.features.cup.playerExitedAt[source.playerId];
      }
      if (source.area === "lineup" && source.index !== null) {
        const displacedPlayerId = lineupStarIds[target.index];
        if (displacedPlayerId && !canStarXIPlayerFillSlot(displacedPlayerId, source.index, activeFormationPositions)) return false;
      }
      return true;
    }

    if (target.index < 0 || target.index >= STAR_XI_BENCH_SIZE || (source.area === "bench" && source.index === target.index)) return false;
    if (source.area !== "lineup") return !displayGame.features.cup.active;
    if (source.index === null) return false;
    const incomingPlayerId = benchStarIds[target.index];
    if (!incomingPlayerId || !canStarXIPlayerFillSlot(incomingPlayerId, source.index, activeFormationPositions)) return false;
    if (!displayGame.features.cup.active) return true;
    return displayGame.features.cup.substitutionsUsed < STAR_XI_MAX_SUBSTITUTIONS
      && !displayGame.features.cup.playerExitedAt[incomingPlayerId];
  }

  function squadDropClass(area: SquadDropTarget["area"], index: number) {
    if (!draggingSquadPlayer) return "";
    const target = { area, index } as SquadDropTarget;
    if (!canDropSquadPlayer(draggingSquadPlayer, target)) return " squad-drop-blocked";
    const active = squadDropTarget?.area === area && squadDropTarget.index === index;
    return ` squad-drop-ready${active ? " squad-drop-active" : ""}`;
  }

  function handleSquadDragStart(event: DragEvent<HTMLElement>, source: SquadDragSource) {
    if (layoutEditMode || coopBusy || (source.area === "reserve" && displayGame.features.cup.active)) {
      event.preventDefault();
      return;
    }
    setDraggingSquadPlayer(source);
    setSquadDropTarget(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(SQUAD_DRAG_MIME, JSON.stringify(source));
  }

  function readSquadDragSource(event: DragEvent<HTMLElement>) {
    if (draggingSquadPlayer) return draggingSquadPlayer;
    try {
      const parsed = JSON.parse(event.dataTransfer.getData(SQUAD_DRAG_MIME)) as Partial<SquadDragSource>;
      if (typeof parsed.playerId !== "string" || !["lineup", "bench", "reserve"].includes(String(parsed.area))) return null;
      return { playerId: parsed.playerId, area: parsed.area as SquadArea, index: Number.isInteger(parsed.index) ? Number(parsed.index) : null };
    } catch {
      return null;
    }
  }

  function handleSquadDragOver(event: DragEvent<HTMLElement>, target: SquadDropTarget) {
    const source = readSquadDragSource(event);
    if (!source || !canDropSquadPlayer(source, target)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setSquadDropTarget(target);
  }

  async function handleSquadDrop(event: DragEvent<HTMLElement>, target: SquadDropTarget) {
    event.preventDefault();
    const source = readSquadDragSource(event);
    setDraggingSquadPlayer(null);
    setSquadDropTarget(null);
    if (!source || !canDropSquadPlayer(source, target)) {
      showToast("Dieser Wechsel ist wegen Position oder Spielstatus nicht möglich.");
      return;
    }
    if (target.area === "lineup") {
      await moveStarXIPlayerToLineup(source.playerId, target.index);
      return;
    }
    if (source.area === "lineup" && source.index !== null) {
      const incomingPlayerId = benchStarIds[target.index];
      if (incomingPlayerId) await moveStarXIPlayerToLineup(incomingPlayerId, source.index);
      return;
    }
    await selectStarXIBenchPlayer(source.playerId, target.index);
  }

  function handleSquadDragEnd() {
    setDraggingSquadPlayer(null);
    setSquadDropTarget(null);
  }

  async function startCup(tournamentId: TournamentId = selectedTournamentId) {
    if (displayGame.features.cup.active) return;
    if (!starXIComplete) {
      showToast(`Für die Startelf werden ${STAR_XI_SQUAD_SIZE} passende Spieler benötigt.`);
      return;
    }
    const tournament = getTournament(tournamentId) ?? TOURNAMENTS[0];
    const unlockSeason = getTournamentUnlockSeason(tournament.id);
    if (!isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess)) {
      showToast(`${tournament.label} wird in Saison ${unlockSeason} freigeschaltet.`);
      return;
    }
    if (starXIRating < tournament.minimumRating) {
      showToast(`${tournament.label} braucht mindestens ${tournament.minimumRating} OVR.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("cup-start", { tournamentId: tournament.id });
      if (data) setCoopMessage(`${tournament.label} ist eröffnet.`);
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE || features.cup.active) return current;
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      features.cup = beginCupMatch(features.cup, getCurrentTime(), tournament.id, homePlayers, features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
      return { ...current, features };
    });
    showToast(`${tournament.label} · Anpfiff · 03:00`);
  }

  async function playCup(strategyId: string) {
    if (!displayGame.features.cup.active) return;
    if (!CUP_STRATEGIES.some((strategy) => strategy.id === strategyId)) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("cup-play", { strategy: strategyId });
      if (data) setCoopMessage("Taktik für das Live-Spiel geändert.");
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (!features.cup.active) return current;
      features.cup.strategyId = getCupStrategy(strategyId).id;
      return { ...current, features };
    });
    const strategy = CUP_STRATEGIES.find((item) => item.id === strategyId);
    showToast(`${strategy?.label ?? "Taktik"} aktiviert`);
  }

  async function takeCupPenalty(direction: CupPenaltyDirection) {
    const visibleCup = displayGame.features.cup;
    if (!visibleCup.active || visibleCup.phase !== "penalties" || coopBusy) return;
    if (isCoopLive) {
      setCoopBusy(true);
      const expectedPenaltyStep = visibleCup.penaltyHomeTaken + visibleCup.penaltyAwayTaken;
      const data = await sendCoopAction("cup-penalty", { direction, expectedPenaltyStep });
      if (data) setCoopMessage("Elfmeter ausgeführt und bei beiden Spielern synchronisiert.");
      setCoopBusy(false);
      return;
    }
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      if (!features.cup.active || features.cup.phase !== "penalties") return current;
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      const effectiveRating = getStarXIEffectiveMatchRating(features.starXI.ownedIds, features.starXI.lineupIds, features.cup, 120);
      const cupNow = getCurrentTime();
      const result = resolveCupPenalty(features.cup, effectiveRating, direction, cupNow, Math.random, homePlayers, features.starXI.formationPositions);
      features.cup = result.cup;
      if (result.finished) {
        features.starXI = restoreStarXIAfterMatch(features.starXI, features.cup);
        if (result.tournamentWon) features.goalBoost = startTournamentGoalBoost(features.cup.tournamentId, cupNow);
        const tournamentBoost = getTournamentGoalBoostMultiplier(features.cup.tournamentId);
        addHistory(features, {
          title: result.tournamentWon ? `${getTournament(features.cup.tournamentId)?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
          detail: result.tournamentWon ? `Elfmeterschiessen gewonnen · Trophäe erhalten · ${String(tournamentBoost).replace(".", ",")}× Goalboost für 03:00` : result.nextRoundStarted ? `Elfmeterschiessen gewonnen · Runde ${result.completedRound + 1} läuft bereits` : "Im Elfmeterschiessen ausgeschieden.",
          tone: result.won ? "positive" : "negative",
        });
      }
      return { ...current, features };
    });
  }

  function advanceLocalCup() {
    if (!gameRef.current.features.cup.active) return;
    const now = getCurrentTime();
    setGame((current) => {
      const features = normalizeGameFeatures(current.features);
      const homePlayers = getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds);
      const matchMinute = getCupMatchMinute(features.cup.matchStartedAt, now);
      const effectiveRating = getStarXIEffectiveMatchRating(features.starXI.ownedIds, features.starXI.lineupIds, features.cup, matchMinute);
      const result = advanceCupMatch(features.cup, effectiveRating, now, Math.random, homePlayers, features.starXI.formationPositions);
      if (!result.finished && result.cup.lastTickAt === features.cup.lastTickAt) return current;
      features.cup = result.cup;
      if (result.finished) {
        features.starXI = restoreStarXIAfterMatch(features.starXI, features.cup);
        if (result.tournamentWon) features.goalBoost = startTournamentGoalBoost(features.cup.tournamentId, now);
        const tournamentBoost = getTournamentGoalBoostMultiplier(features.cup.tournamentId);
        addHistory(features, {
          title: result.tournamentWon ? `${getTournament(features.cup.tournamentId)?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
          detail: result.tournamentWon ? `Trophäe erhalten · ${String(tournamentBoost).replace(".", ",")}× Goalboost für 03:00` : result.nextRoundStarted ? `Runde ${result.completedRound + 1} läuft bereits` : "Der nächste Turnierlauf kommt bestimmt.",
          tone: result.won ? "positive" : "negative",
        });
      }
      return { ...current, features };
    });
  }

  useEffect(() => {
    if (!hydrated || (appMode !== "single" && !isCoopLive)) return;
    const timer = window.setInterval(() => {
      if (appMode === "coop" && isCoopLive && displayGame.features.cup.active && displayGame.features.cup.phase !== "penalties") void sendCoopAction("cup-tick");
      else if (appMode === "single" && gameRef.current.features.cup.active) advanceLocalCup();
    }, 1000);
    return () => window.clearInterval(timer);
    // The one-second clock should stay stable while the match is live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appMode, displayGame.features.cup.active, hydrated, isCoopLive]);

  async function claimMission(mission: CoopMission) {
    const progress = getMissionProgress(mission, { seasonGoals: displayGame.seasonGoals, clicks: displayGame.clicks, minigameWins: displayGame.minigameWins, cupWins: displayGame.features.cup.wins });
    if (mission.claimed || progress < mission.target || !isCoopLive) return;
    setCoopBusy(true);
    const data = await sendCoopAction("mission-claim", { missionId: mission.id });
    if (data) setCoopMessage(`${mission.title} abgeschlossen. +${formatNumber(mission.reward)} Tore für das Team.`);
    setCoopBusy(false);
  }

  function playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.03, delay = 0) {
    if (!gameRef.current.sound || typeof window === "undefined") return;
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    if (!audioRef.current) audioRef.current = new AudioClass();
    const audio = audioRef.current;
    if (audio.state === "suspended") void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function handleBallClick(event: MouseEvent<HTMLButtonElement>) {
    const liveClickPower = getClickPower(displayGame.upgrades, displayGame.stars, displayGame.features, getCurrentTime());
    const result = createClickResult(liveClickPower, lastClickRef.current, streakRef.current);
    lastClickRef.current = result.now;
    streakRef.current = result.streak;
    if (isCoopLive) queueCoopClick(result.amount);
    else setGame((current) => ({ ...current, goals: current.goals + result.amount, seasonGoals: current.seasonGoals + result.amount, totalGoals: current.totalGoals + result.amount, clicks: current.clicks + 1 }));
    const rect = stageRef.current?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : 50;
    const y = rect ? event.clientY - rect.top : 50;
    const effect = { id: result.effectId, x, y, amount: result.amount, critical: result.critical };
    setEffects((current) => [...current, effect]);
    setTimeout(() => setEffects((current) => current.filter((item) => item.id !== effect.id)), 850);
    setPulse((value) => !value);
    playTone(result.critical ? 720 : 350, 0.07, "triangle", result.critical ? 0.055 : 0.025);
    if (result.critical) { showToast("Kritischer Abschluss"); playTone(980, 0.13, "square", 0.04, 0.07); }
    else if (result.streak === 10) showToast("Zehn Klicks am Stück");
  }

  function handleBallKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if ((event.key === "Enter" || event.key === " ") && event.repeat) event.preventDefault();
  }

  function awardMiniGame(reward: number, name: string, id: MiniGameId, icon: IconName = "star") {
    const safeReward = Math.max(0, Math.floor(reward));
    if (isCoopLive) void sendCoopAction("minigame", { minigameId: id, reward: safeReward });
    else setGame((current) => ({ ...current, goals: current.goals + safeReward, seasonGoals: current.seasonGoals + safeReward, totalGoals: current.totalGoals + safeReward, minigameWins: current.minigameWins + 1, miniGameCooldowns: { ...current.miniGameCooldowns, [id]: getMiniGameCooldownUntil(id) } }));
    addFeed(`${name}: +${formatNumber(safeReward)} Tore Prämie. Nächste Runde in ${MINI_GAME_COOLDOWN_SECONDS[id]} Sekunden.`, icon);
    showToast(`${name}: +${formatNumber(safeReward)} Tore`);
    playTone(523, 0.1, "triangle", 0.035);
    playTone(784, 0.18, "triangle", 0.04, 0.1);
  }

  function closeMiniGame() {
    setActiveMiniGame(null);
  }

  function startPenaltyGame() {
    if (isMiniGameOnCooldown("penalty")) {
      showToast(`${MINI_GAME_NAMES.penalty} ist noch ${formatCountdown(displayGame.miniGameCooldowns.penalty, countdownNow)} gesperrt.`);
      return;
    }
    setActiveMiniGame("penalty");
    setPenaltyGame({ shots: 0, goals: 0, message: "Such dir eine Ecke aus.", finished: false, reward: 0 });
  }

  function takePenalty(direction: PenaltyDirection) {
    if (!penaltyGame || penaltyGame.finished) return;
    const goalkeeper = getRandomPenaltyDirection();
    const scored = direction !== goalkeeper;
    const shots = penaltyGame.shots + 1;
    const goals = penaltyGame.goals + (scored ? 1 : 0);
    if (shots >= 5) {
      const reward = 250 + goals * 150;
      setPenaltyGame({ shots, goals, message: `${goals} von 5 Elfmetern drin. ${formatNumber(reward)} Tore Prämie.`, finished: true, reward });
      awardMiniGame(reward, `Penalty Challenge ${goals}/5`, "penalty", scored ? "ball" : "screen");
      return;
    }
    setPenaltyGame({ ...penaltyGame, shots, goals, message: scored ? "Tor. Der Goalie war in der falschen Ecke." : `Gehalten. Der Goalie war ${goalkeeper}.`, finished: false, reward: 0 });
  }

  function startDribbleGame() {
    if (isMiniGameOnCooldown("dribble")) {
      showToast(`${MINI_GAME_NAMES.dribble} ist noch ${formatCountdown(displayGame.miniGameCooldowns.dribble, countdownNow)} gesperrt.`);
      return;
    }
    const sequence = Array.from({ length: 6 }, () => getRandomPenaltyDirection());
    setActiveMiniGame("dribble");
    setDribbleGame({ sequence, step: 0, attempts: 0, misses: 0, message: `Erster Move: ${directionLabel(sequence[0])}.`, finished: false, reward: 0 });
  }

  function takeDribble(direction: PenaltyDirection) {
    if (!dribbleGame || dribbleGame.finished) return;
    const expected = dribbleGame.sequence[dribbleGame.step];
    const correct = direction === expected;
    const step = correct ? dribbleGame.step + 1 : 0;
    const attempts = dribbleGame.attempts + 1;
    const misses = dribbleGame.misses + (correct ? 0 : 1);
    if (correct && step >= dribbleGame.sequence.length) {
      const reward = 220 + Math.max(0, 3 - misses) * 45;
      setDribbleGame({ ...dribbleGame, step, attempts, misses, message: `Perfekte Ballführung in ${attempts} Moves.`, finished: true, reward });
      awardMiniGame(reward, "Dribble Run", "dribble", "striker");
      return;
    }
    if (!correct && misses >= 3) {
      const reward = 60 + dribbleGame.step * 15;
      setDribbleGame({ ...dribbleGame, step, attempts, misses, message: `Dreimal den Ball verloren. ${formatNumber(reward)} Tore Trostpreis.`, finished: true, reward });
      awardMiniGame(reward, "Dribble Run", "dribble", "boot");
      return;
    }
    setDribbleGame({ ...dribbleGame, step, attempts, misses, message: correct ? `Sauber. Als Nächstes: ${directionLabel(dribbleGame.sequence[step])}.` : "Ball verloren. Wieder von vorne.", finished: false, reward: 0 });
  }

  function startCrossbarGame() {
    if (isMiniGameOnCooldown("crossbar")) {
      showToast(`${MINI_GAME_NAMES.crossbar} ist noch ${formatCountdown(displayGame.miniGameCooldowns.crossbar, countdownNow)} gesperrt.`);
      return;
    }
    setActiveMiniGame("crossbar");
    setCrossbarGame({ shots: 0, hits: 0, message: "Zielhöhe wählen und die Latte treffen.", finished: false, reward: 0 });
  }

  function takeCrossbar(height: CrossbarHeight) {
    if (!crossbarGame || crossbarGame.finished) return;
    const target = getRandomCrossbarHeight();
    const hit = height === target;
    const shots = crossbarGame.shots + 1;
    const hits = crossbarGame.hits + (hit ? 1 : 0);
    if (shots >= 5) {
      const reward = 50 + hits * 45;
      setCrossbarGame({ shots, hits, message: `${hits} von 5 Latten getroffen. ${formatNumber(reward)} Tore Prämie.`, finished: true, reward });
      awardMiniGame(reward, `Latten Challenge ${hits}/5`, "crossbar", hit ? "star" : "screen");
      return;
    }
    setCrossbarGame({ ...crossbarGame, shots, hits, message: hit ? "Ping. Genau die richtige Höhe." : `Daneben. Das Ziel war ${heightLabel(target)}.`, finished: false, reward: 0 });
  }

  function startPredictionGame() {
    if (isMiniGameOnCooldown("prediction")) {
      showToast(`${MINI_GAME_NAMES.prediction} ist noch ${formatCountdown(displayGame.miniGameCooldowns.prediction, countdownNow)} gesperrt.`);
      return;
    }
    setActiveMiniGame("prediction");
    setPredictionGame({ round: 0, wins: 0, message: "Wer gewinnt das nächste Match?", finished: false, reward: 0 });
  }

  function takePrediction(prediction: MatchPrediction) {
    if (!predictionGame || predictionGame.finished) return;
    const outcome = getRandomMatchPrediction();
    const round = predictionGame.round + 1;
    const wins = predictionGame.wins + (prediction === outcome ? 1 : 0);
    if (round >= 3) {
      const reward = 70 + wins * 55 + (wins === 3 ? 100 : 0);
      setPredictionGame({ round, wins, message: `${wins} von 3 Tipps richtig. ${formatNumber(reward)} Tore Prämie.`, finished: true, reward });
      awardMiniGame(reward, `Matchday Tipp ${wins}/3`, "prediction", "broadcast");
      return;
    }
    setPredictionGame({ ...predictionGame, round, wins, message: prediction === outcome ? `Richtig: ${predictionLabel(outcome)}. Nächster Tipp.` : `Falsch: Es war ${predictionLabel(outcome)}. Nächster Tipp.`, finished: false, reward: 0 });
  }

  async function buyUpgrade(upgrade: UpgradeDefinition) {
    const unlockSeason = getUpgradeUnlockSeason(upgrade.id);
    const alreadyOwned = getLevel(displayGame.upgrades, upgrade.id) > 0;
    if (!alreadyOwned && !isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess)) {
      showToast(`${upgrade.name} wird in Saison ${unlockSeason} freigeschaltet.`);
      return;
    }
    const purchase = getBulkPurchase(upgrade, displayGame.upgrades, spendableGoals, purchaseMode, hasInfiniteMoney);
    if (purchase.count === 0) {
      const nextCost = getCost(upgrade, displayGame.upgrades);
      showToast(nextCost === Infinity ? "Dieses Upgrade ist auf dem Maximum." : `${upgrade.name} kostet ${formatNumber(nextCost)} Tore.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      try {
        const data = await sendCoopAction("buy", { upgradeId: upgrade.id, count: purchase.count });
        if (data) setCoopMessage(`${upgrade.name} wurde gemeinsam gekauft.`);
      } finally {
        setCoopBusy(false);
      }
      return;
    }
    const level = getLevel(game.upgrades, upgrade.id) + purchase.count;
    setGame((current) => ({ ...current, goals: current.goals - purchase.totalCost, upgrades: { ...current.upgrades, [upgrade.id]: level } }));
    addFeed(`${upgrade.name} x${purchase.count} für ${formatNumber(purchase.totalCost)} Tore.`, upgrade.icon);
    showToast(purchase.count === 1 ? `${upgrade.name} auf Level ${level}` : `${upgrade.name}: ${purchase.count} Level gekauft`);
    playTone(440, 0.08, "triangle", 0.03);
    playTone(660, 0.13, "triangle", 0.04, 0.08);
  }

  async function startNewSeason() {
    if (seasonCareerComplete) {
      showToast("Du hast die komplette Saisonkarriere gemeistert.");
      return;
    }
    if (!canStartNewSeason) {
      showToast(`Saison ${currentSeason + 1} benötigt ${formatNumber(seasonTarget)} aktuelle Tore.`);
      return;
    }
    if (isCoopLive) {
      setCoopBusy(true);
      const data = await sendCoopAction("season");
      if (data) {
        const unlocked = getSeasonMilestone(currentSeason + 1);
        setCoopMessage(`Saison ${currentSeason + 1}: ${unlocked.title} freigeschaltet.`);
      }
      setCoopBusy(false);
      return;
    }
    const reward = getSeasonPath(game.goals, game.seasons).reward;
    setGame((current) => ({ ...current, goals: 0, seasonGoals: 0, upgrades: {}, seasons: current.seasons + 1, stars: Math.min(MAX_SEASON_STARS, current.stars + reward) }));
    const unlocked = getSeasonMilestone(currentSeason + 1);
    addFeed(`Saison ${currentSeason + 1}: ${unlocked.title} freigeschaltet.`, "star");
    showToast(`Saison ${currentSeason + 1}: ${unlocked.title}`);
    playTone(523, 0.12, "triangle", 0.04);
    playTone(784, 0.2, "triangle", 0.05, 0.1);
  }

  function toggleSound() {
    setGame((current) => ({ ...current, sound: !current.sound }));
    showToast(game.sound ? "Sound aus" : "Sound an");
  }

  function resetGame() {
    if (isCoopLive) {
      if (!window.confirm("Soll der gemeinsame Koop Spielstand neu gestartet werden?")) return;
      setCoopBusy(true);
      void sendCoopAction("reset").then((data) => {
        if (data) setCoopMessage("Gemeinsamer Spielstand zurückgesetzt.");
        setCoopBusy(false);
      });
      return;
    }
    if (!window.confirm("Wirklich den kompletten Spielstand löschen?")) return;
    const sound = game.sound;
    setGame({ ...initialGame(), sound });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_STORAGE_KEY);
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    setOffline("");
    setFeed([{ id: feedIdRef.current++, icon: "broadcast", text: "Neuer Spielstand. Die Fans sind wieder da." }]);
    showToast("Spielstand zurückgesetzt");
  }

  useEffect(() => {
    const stored = readStoredGame();
    if (stored.saved) {
      try {
        const saved = stored.saved;
        const upgrades = normalizeUpgrades(saved.upgrades);
        const savedAt = Number(saved.lastSaved) || Date.now();
        const pausedMs = Math.max(0, Date.now() - savedAt);
        const totalGoalsValue = Number(saved.totalGoals);
        const totalGoals = Number.isFinite(totalGoalsValue) ? Math.max(0, totalGoalsValue) : 0;
        const savedSeasonGoals = Number(saved.seasonGoals);
        const seasonGoals = Number.isFinite(savedSeasonGoals) ? Math.max(0, savedSeasonGoals) : totalGoals;
        const stars = Math.min(MAX_SEASON_STARS, Math.max(0, Number(saved.stars) || 0));
        const seasons = Math.max(0, Number(saved.seasons) || 0);
        const minigameWins = Math.max(0, Math.floor(Number(saved.minigameWins) || 0));
        const miniGameCooldowns = pauseMiniGameCooldowns(saved.miniGameCooldowns, pausedMs, savedAt);
        const features = pauseGameFeatureTimers(saved.features, pausedMs);
        const goalsValue = Number(saved.goals);
        const clicksValue = Number(saved.clicks);
        const next: GameState = { ...initialGame(), upgrades, features, achievements: normalizeAchievements(saved.achievements), goals: Number.isFinite(goalsValue) ? Math.max(0, goalsValue) : 0, totalGoals, seasonGoals, clicks: Number.isFinite(clicksValue) ? Math.max(0, clicksValue) : 0, stars, seasons, balanceVersion: BALANCE_VERSION, sound: saved.sound !== false, lastSaved: Date.now(), miniGameCooldowns, minigameWins };
        if (stored.recovered) {
          window.setTimeout(() => setOffline("Die Hauptspeicherung war leer. Deine letzte intakte Sicherung wurde automatisch geladen."), 0);
        } else if (pausedMs > 10000 && (getPassivePower(upgrades, stars, features) > 0 || features.cup.active)) {
          window.setTimeout(() => setOffline("Das Spiel war pausiert, weil niemand auf der Seite war."), 0);
        }
        window.setTimeout(() => setGame(next), 0);
      } catch {
        window.setTimeout(() => setOffline("Der gespeicherte Stand konnte nicht gelesen werden. Die Sicherung bleibt unangetastet."), 0);
      }
    }
    window.setTimeout(() => setHydrated(true), 0);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const tick = window.setInterval(() => {
      if (document.hidden) return;
      const power = getPassivePower(gameRef.current.upgrades, gameRef.current.stars, gameRef.current.features);
      if (power <= 0) return;
      setGame((current) => ({ ...current, goals: current.goals + power / 5, seasonGoals: current.seasonGoals + power / 5, totalGoals: current.totalGoals + power / 5 }));
    }, 200);
    const save = window.setInterval(() => {
      const now = Date.now();
      const hiddenAt = pageInactiveAtRef.current;
      const next = document.hidden && hiddenAt
        ? advanceLocalGameWhileOpen(gameRef.current, now - hiddenAt, now)
        : { ...gameRef.current, lastSaved: now };
      if (document.hidden) pageInactiveAtRef.current = now;
      gameRef.current = next;
      persistLocalGame(next);
    }, 2200);
    return () => { window.clearInterval(tick); window.clearInterval(save); };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || isCoopLive) return;
    const newlyUnlocked = ACHIEVEMENTS.filter((achievement) => game.totalGoals >= achievement.threshold && !game.achievements.includes(achievement.id));
    if (!newlyUnlocked.length) return;
    window.setTimeout(() => setGame((current) => ({ ...current, achievements: [...current.achievements, ...newlyUnlocked.map((item) => item.id)] })), 0);
    const first = newlyUnlocked[0];
    window.setTimeout(() => {
      showToast(`Erfolg: ${first.name}`);
      addFeed(`${first.name} freigeschaltet. Die Kurve zeigt nach oben.`, first.icon);
      playTone(523, 0.12, "square", 0.035);
      playTone(659, 0.12, "square", 0.035, 0.1);
      playTone(784, 0.22, "square", 0.04, 0.2);
    }, 0);
  }, [game.totalGoals, game.achievements, hydrated, isCoopLive]);

  useEffect(() => {
    if (!hydrated) return;
    const saveOnExit = () => {
      const now = Date.now();
      const hiddenAt = pageInactiveAtRef.current;
      const next = hiddenAt ? advanceLocalGameWhileOpen(gameRef.current, now - hiddenAt, now) : { ...gameRef.current, lastSaved: now };
      if (hiddenAt) pageInactiveAtRef.current = now;
      gameRef.current = next;
      persistLocalGame(next);
    };
    const onVisibility = () => {
      if (document.hidden) {
        const hiddenAt = pageInactiveAtRef.current ?? Date.now();
        pageInactiveAtRef.current = hiddenAt;
        persistLocalGame({ ...gameRef.current, lastSaved: hiddenAt });
        return;
      }
      const hiddenAt = pageInactiveAtRef.current;
      if (!hiddenAt) return;
      pageInactiveAtRef.current = null;
      const now = Date.now();
      const next = advanceLocalGameWhileOpen(gameRef.current, now - hiddenAt, now);
      gameRef.current = next;
      persistLocalGame(next);
      setGame(next);
    };
    if (document.hidden) onVisibility();
    window.addEventListener("beforeunload", saveOnExit);
    window.addEventListener("pagehide", saveOnExit);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("beforeunload", saveOnExit); window.removeEventListener("pagehide", saveOnExit); document.removeEventListener("visibilitychange", onVisibility); };
  }, [hydrated]);

  const rankRange = nextRank ? nextRank.minimum - currentRank.minimum : 1;
  const rankProgress = nextRank ? Math.max(0, Math.min(100, ((displayGame.totalGoals - currentRank.minimum) / rankRange) * 100)) : 100;
  const selectedTournament = getTournament(selectedTournamentId) ?? TOURNAMENTS[0];
  const selectedTournamentUnlockSeason = getTournamentUnlockSeason(selectedTournament.id);
  const selectedTournamentSeasonUnlocked = isSeasonContentUnlocked(selectedTournamentUnlockSeason, displayGame.seasons, hasFullTestAccess);
  const activeTournament = getTournament(displayGame.features.cup.tournamentId) ?? TOURNAMENTS[0];
  const transferOffers = displayGame.features.transferMarket.offerIds.map((id) => getTransferPlayer(id)).filter((player): player is NonNullable<ReturnType<typeof getTransferPlayer>> => Boolean(player));
  const ownedTransferPlayers = displayGame.features.transferMarket.ownedIds.map((id) => getTransferPlayer(id)).filter((player): player is NonNullable<ReturnType<typeof getTransferPlayer>> => Boolean(player));
  const featureMissions = displayGame.features.missions;
  const featureHistory = [...displayGame.features.history].reverse();
  const featureTabs: { id: FeatureTab; label: string }[] = [
    { id: "cup", label: "Pokal" },
    { id: "club", label: "Clubprofil" },
    { id: "missions", label: "Missionen" },
    { id: "history", label: "Verlauf" },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-ball"><FootballGraphic /></div><div className="brand-copy"><p className="eyebrow">FOOTBALL IDLE CLUB / UPDATE 1.33</p><h1>GOAL <span>CLICKER</span></h1></div></div>
        <div className={`header-goals${goalBoostActive ? " goal-boost-active" : ""}`} aria-live="polite" aria-label={`Aktueller Kontostand: ${hasInfiniteMoney ? "unbegrenzt" : formatNumber(displayGame.goals)} Tore${goalBoostActive ? `; ${goalBoostLabel}-facher Goalboost noch ${goalBoostCountdown}` : ""}`}><span>{hasInfiniteMoney ? "AZB TESTMODUS" : "AKTUELLER STAND"}</span><strong>{displayBalance}</strong><small>TORE</small>{goalBoostActive && <em className="header-goal-boost">⚡ {goalBoostLabel}× · {goalBoostCountdown}</em>}</div>
        <div className="top-actions"><span className="save-status"><i /> auch minimiert aktiv · update sicher gespeichert</span><button className="icon-button" onClick={toggleSound} aria-label={game.sound ? "Sound ausschalten" : "Sound einschalten"}><Icon name={game.sound ? "sound" : "mute"} size={17} /></button><button className="reset-button" onClick={resetGame}>Reset</button></div>
      </header>

      <nav className="mode-switch" aria-label="Spielmodus">
        <button className={appMode === "single" ? "active" : ""} onClick={() => setAppMode("single")}>Singleplayer</button>
        <button className={appMode === "leaderboard" ? "active" : ""} onClick={() => setAppMode("leaderboard")}>Rangliste</button>
        <button className={appMode === "coop" ? "active" : ""} onClick={() => setAppMode("coop")}>Koop Multiplayer</button>
      </nav>

      {(appMode === "single" || isCoopLive) && <main className={`clicker-layout${isCoopLive ? " coop-clicker-layout" : ""}`}>
        {isCoopLive && coopSession && <><div className="coop-inline-room-bar"><div><p className="eyebrow">KOOP / {coopSession.room.roomName}</p><strong>{coopSession.code}</strong><span>{occupiedCoopPlayers(coopSession.room).map((player) => player.name).join(" · ")}</span></div><div className="coop-inline-room-actions"><span className={`coop-presence${otherCoopOnline ? " online" : ""}`}><i />{otherCoopOnline ? `${otherCoopOnlineCount} ${otherCoopOnlineCount === 1 ? "MITSPIELER" : "MITSPIELER"} ONLINE` : "MITSPIELER OFFLINE"}</span><span className="coop-live-badge">{coopSession.room.playerCount} / 4 SPIELER</span><span className="coop-live-badge">{hasInfiniteMoney ? "AZB VOLLZUGRIFF" : "GEMEINSAM GESPEICHERT"}</span><button className="mode-secondary" onClick={() => void copyCoopCode()}>Code kopieren</button>{coopSession.role === "host" && <button className="mode-secondary danger" onClick={() => void deleteCoopRoom(coopSession.code)}>Raum löschen</button>}<button className="mode-secondary quiet" onClick={leaveCoopRoom}>Verlassen</button></div></div><div className="coop-world-tools"><div><p className="eyebrow">WELT VERWALTEN</p>{coopSession.role === "host" ? <div className="coop-tool-input"><input className="mode-input" value={coopRoomName} maxLength={28} onChange={(event) => setCoopRoomName(event.target.value)} aria-label="Name der Welt" /><button className="mode-secondary" onClick={() => void renameCoopRoom()} disabled={coopBusy}>Name speichern</button></div> : <strong>{coopSession.room.roomName}</strong>}</div><div><p className="eyebrow">LOBBY CODES</p><div className="coop-tool-input"><input className="mode-input bonus-code-input" value={lobbyBonusCode} maxLength={10} placeholder="Code eingeben" onChange={(event) => setLobbyBonusCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") void redeemLobbyBonus(); }} /><button className="mode-primary" onClick={() => void redeemLobbyBonus()} disabled={coopBusy}>Einlösen</button></div></div></div></>}
        <div className={`layout-toolbar${layoutEditMode ? " active" : ""}`}>
          <div><p className="eyebrow">ANSICHT / LAYOUT</p><strong>{layoutEditMode ? "Karten im Raster anordnen." : "Dein Dashboard, deine Reihenfolge."}</strong><small>{layoutEditMode ? "Zieh den Griff. Beim Loslassen rastet jede Karte im nächsten Slot ein." : "Die Anordnung bleibt auf diesem Gerät gespeichert."}</small></div>
          <div className="layout-toolbar-actions">{layoutEditMode && <button className="mode-secondary" onClick={resetLayout}>Standard</button>}<button className={layoutEditMode ? "mode-primary" : "mode-secondary"} onClick={() => { setLayoutEditMode((current) => !current); setDraggingLayoutCard(null); setDragOverLayoutCard(null); }}>{layoutEditMode ? "Fertig" : "Ansicht bearbeiten"}</button></div>
        </div>
        <section className={layoutCardClass("hero", "click-zone-card")} style={{ order: layoutOrderNumber("hero") }} onDragOver={(event) => handleLayoutDragOver(event, "hero")} onDrop={(event) => handleLayoutDrop(event, "hero")}>
          {layoutEditMode && <div className="layout-card-handle" draggable onDragStart={(event) => handleLayoutDragStart(event, "hero")} onDragEnd={handleLayoutDragEnd} aria-label="Ball und Turniere verschieben"><span className="layout-handle-grip">⋮⋮</span><div><strong>Ball und Turniere</strong><small>ziehen und im Raster ablegen</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("hero", -1); }} aria-label="Ballkarte nach oben">↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("hero", 1); }} aria-label="Ballkarte nach unten">↓</button></div></div>}
          <div className="panel-intro"><div><p className="eyebrow">{isCoopLive ? "CO-OP CAREER / LIVE MATCH" : "CAREER MODE / 01"}</p><h2>{isCoopLive ? <>Gemeinsam<br /><span>zum Sieg.</span></> : <>Build your<br /><span>football empire.</span></>}</h2><p className="intro-copy">{isCoopLive ? `Bis zu vier Spieler. Ein gemeinsamer Club. Aktuell ${coopSession?.room.playerCount ?? 2} dabei.` : "Ein Klick. Ein Tor. Eine völlig übertriebene Karriere."}</p></div><div className="career-badges"><div className="rank-badge"><span className="rank-symbol"><Icon name={currentRank.icon} size={21} /></span><div><small>{isCoopLive ? "TEAM RANG" : "DEIN RANG"}</small><strong>{currentRank.name}</strong></div></div><div className="season-chip" title={currentSeasonMilestone.title}><Icon name="star" size={14} /><span>SAISON {currentSeason}</span><strong>★ {displayGame.stars}</strong></div></div></div>
          <div className="score-display"><span className="score-label">{hasInfiniteMoney ? "UNBEGRENZTES TESTGUTHABEN" : isCoopLive ? "GEMEINSAME TORE" : "DEINE TORE"}</span><strong>{displayBalance}</strong><span className="per-click-label">+{formatNumber(clickPower)} {isCoopLive ? "pro Team-Klick" : "pro Klick"}</span></div>
          <div className="ball-stage" ref={stageRef}>
            <div className="stadium-glow" /><div className="stadium-lights"><span /><span /><span /><span /><span /></div><div className="field-circle" /><div className="field-line field-line-one" /><div className="field-line field-line-two" /><div className="field-label">{isCoopLive ? "CO-OP CLICKER ARENA" : "GOAL CLICKER ARENA"}</div>
            <button type="button" className={`ball-button${pulse ? " hit" : ""}`} onClick={handleBallClick} onKeyDown={handleBallKeyDown} aria-label={isCoopLive ? "Team-Ball anklicken" : "Fussball anklicken"}><span className="ball-aura" /><FootballGraphic /></button>
            <p className="click-label"><span>CLICK</span> den Ball {isCoopLive ? "fürs Team" : "für Tore"}</p>
            <div className="floating-layer">{effects.map((effect) => <span className={`floating-number${effect.critical ? " critical" : ""}`} key={effect.id} style={{ left: effect.x, top: effect.y }}>{effect.critical ? `CRIT! +${formatNumber(effect.amount)}` : `+${formatNumber(effect.amount)}`}</span>)}</div>
          </div>
          <div className="production-strip"><div className="production-item"><span className="production-icon">/s</span><div><small>PRO SEKUNDE</small><strong>{formatNumber(passivePower)}</strong></div></div><div className="production-divider" /><div className="production-item"><span className="production-icon">+1</span><div><small>PRO KLICK</small><strong>{formatNumber(clickPower)}</strong></div></div><div className="production-divider" /><div className="production-item"><span className="production-icon">#</span><div><small>KLICKS</small><strong>{formatNumber(displayGame.clicks)}</strong></div></div></div>
          {!activeMiniGame && <div className="mini-game-hub">
            <div className="mini-game-hub-heading"><div><p className="eyebrow">STADION / ARCADE</p><h3>Matchday Minigames</h3></div><span>ROTIEREND</span></div>
            <div className="mini-game-grid">
              <button className={`mini-game-card${isMiniGameOnCooldown("penalty") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("penalty")} onClick={startPenaltyGame} aria-label={`${MINI_GAME_NAMES.penalty}${isMiniGameOnCooldown("penalty") ? `, ${miniGameCooldownLabel("penalty", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="star" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 01</small><strong>Penalty Challenge</strong><em>{miniGameCooldownLabel("penalty", "5 Schüsse · Präzision")}</em></span><b>{isMiniGameOnCooldown("penalty") ? "◷" : "↗"}</b></button>
              <button className={`mini-game-card${isMiniGameOnCooldown("dribble") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("dribble")} onClick={startDribbleGame} aria-label={`${MINI_GAME_NAMES.dribble}${isMiniGameOnCooldown("dribble") ? `, ${miniGameCooldownLabel("dribble", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="striker" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 02</small><strong>Dribble Run</strong><em>{miniGameCooldownLabel("dribble", "Muster · Ballkontrolle")}</em></span><b>{isMiniGameOnCooldown("dribble") ? "◷" : "↗"}</b></button>
              <button className={`mini-game-card${isMiniGameOnCooldown("crossbar") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("crossbar")} onClick={startCrossbarGame} aria-label={`${MINI_GAME_NAMES.crossbar}${isMiniGameOnCooldown("crossbar") ? `, ${miniGameCooldownLabel("crossbar", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="stadium" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 03</small><strong>Latten Challenge</strong><em>{miniGameCooldownLabel("crossbar", "5 Versuche · Timing")}</em></span><b>{isMiniGameOnCooldown("crossbar") ? "◷" : "↗"}</b></button>
              <button className={`mini-game-card${isMiniGameOnCooldown("prediction") ? " cooldown" : ""}`} disabled={isMiniGameOnCooldown("prediction")} onClick={startPredictionGame} aria-label={`${MINI_GAME_NAMES.prediction}${isMiniGameOnCooldown("prediction") ? `, ${miniGameCooldownLabel("prediction", "bereit")}` : " starten"}`}><span className="mini-game-icon"><Icon name="broadcast" size={17} /></span><span className="mini-game-card-copy"><small>MINIGAME / 04</small><strong>Matchday Tipp</strong><em>{miniGameCooldownLabel("prediction", "3 Tipps · Glück")}</em></span><b>{isMiniGameOnCooldown("prediction") ? "◷" : "↗"}</b></button>
            </div>
          </div>}
          {activeMiniGame === "penalty" && penaltyGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">MINIGAME / 01 · PRÄZISION</p><h3>Penalty Challenge</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label="Penalty Challenge schliessen">×</button></div><div className="penalty-meta"><span>{penaltyGame.shots} / 5 Schüsse</span><strong>{penaltyGame.goals} Tore</strong></div><div className="penalty-progress"><div style={{ width: `${(penaltyGame.shots / 5) * 100}%` }} /></div>{!penaltyGame.finished ? <div className="penalty-buttons">{PENALTY_DIRECTIONS.map((direction) => <button key={direction} onClick={() => takePenalty(direction)}><span>{directionLabel(direction)}</span><small>Schuss</small></button>)}</div> : <div className="mini-game-result"><strong>{penaltyGame.goals} / 5</strong><span>{penaltyGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("penalty")} onClick={startPenaltyGame}>{isMiniGameOnCooldown("penalty") ? `Bereit in ${formatCountdown(displayGame.miniGameCooldowns.penalty, countdownNow)}` : "Neue Runde"}</button></div>}<p className="mini-game-message">{penaltyGame.finished ? "Die Prämie wurde deinem Spielstand gutgeschrieben." : penaltyGame.message}</p></div>}
          {activeMiniGame === "dribble" && dribbleGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">MINIGAME / 02 · BALLKONTROLLE</p><h3>Dribble Run</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label="Dribble Run schliessen">×</button></div><p className="mini-game-intro">Folge dem Muster und bring den Ball durch sechs Hütchen.</p><div className="dribble-sequence" aria-label="Dribbling Muster">{dribbleGame.sequence.map((direction, index) => <span className={index < dribbleGame.step ? "done" : index === dribbleGame.step ? "current" : ""} key={`${direction}-${index}`}>{directionLabel(direction)}</span>)}</div><div className="penalty-meta"><span>{dribbleGame.step} / 6 Hütchen</span><strong>{dribbleGame.misses} Fehler</strong></div><div className="penalty-progress"><div style={{ width: `${(dribbleGame.step / dribbleGame.sequence.length) * 100}%` }} /></div>{!dribbleGame.finished ? <div className="penalty-buttons">{PENALTY_DIRECTIONS.map((direction) => <button key={direction} onClick={() => takeDribble(direction)}><span>{directionLabel(direction)}</span><small>Move</small></button>)}</div> : <div className="mini-game-result"><strong>{dribbleGame.step} / 6</strong><span>{dribbleGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("dribble")} onClick={startDribbleGame}>{isMiniGameOnCooldown("dribble") ? `Bereit in ${formatCountdown(displayGame.miniGameCooldowns.dribble, countdownNow)}` : "Neue Runde"}</button></div>}<p className="mini-game-message">{dribbleGame.message}</p></div>}
          {activeMiniGame === "crossbar" && crossbarGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">MINIGAME / 03 · TIMING</p><h3>Latten Challenge</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label="Latten Challenge schliessen">×</button></div><p className="mini-game-intro">Die Latte bewegt sich. Triff fünfmal die richtige Höhe.</p><div className="penalty-meta"><span>{crossbarGame.shots} / 5 Schüsse</span><strong>{crossbarGame.hits} Treffer</strong></div><div className="penalty-progress"><div style={{ width: `${(crossbarGame.shots / 5) * 100}%` }} /></div>{!crossbarGame.finished ? <div className="penalty-buttons crossbar-buttons">{CROSSBAR_HEIGHTS.map((height) => <button key={height} onClick={() => takeCrossbar(height)}><span>{heightLabel(height)}</span><small>Schuss</small></button>)}</div> : <div className="mini-game-result"><strong>{crossbarGame.hits} / 5</strong><span>{crossbarGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("crossbar")} onClick={startCrossbarGame}>{isMiniGameOnCooldown("crossbar") ? `Bereit in ${formatCountdown(displayGame.miniGameCooldowns.crossbar, countdownNow)}` : "Neue Runde"}</button></div>}<p className="mini-game-message">{crossbarGame.message}</p></div>}
          {activeMiniGame === "prediction" && predictionGame && <div className="mini-game-panel"><div className="mini-game-head"><div><p className="eyebrow">MINIGAME / 04 · MATCHDAY</p><h3>Matchday Tipp</h3></div><button className="mini-game-close" onClick={closeMiniGame} aria-label="Matchday Tipp schliessen">×</button></div><p className="mini-game-intro">Der Anpfiff ist gleich. Tippe drei fiktive Spiele richtig.</p><div className="penalty-meta"><span>{predictionGame.round} / 3 Tipps</span><strong>{predictionGame.wins} richtig</strong></div><div className="penalty-progress"><div style={{ width: `${(predictionGame.round / 3) * 100}%` }} /></div>{!predictionGame.finished ? <div className="prediction-buttons">{MATCH_PREDICTIONS.map((prediction) => <button key={prediction} onClick={() => takePrediction(prediction)}><span>{predictionLabel(prediction)}</span><small>Tipp abgeben</small></button>)}</div> : <div className="mini-game-result"><strong>{predictionGame.wins} / 3</strong><span>{predictionGame.message}</span><button className="mini-game-again" disabled={isMiniGameOnCooldown("prediction")} onClick={startPredictionGame}>{isMiniGameOnCooldown("prediction") ? `Bereit in ${formatCountdown(displayGame.miniGameCooldowns.prediction, countdownNow)}` : "Neue Runde"}</button></div>}<p className="mini-game-message">{predictionGame.message}</p></div>}
        </section>

        <section className={layoutCardClass("shop", "shop-card")} style={{ order: layoutOrderNumber("shop") }} onDragOver={(event) => handleLayoutDragOver(event, "shop")} onDrop={(event) => handleLayoutDrop(event, "shop")}><div className="layout-card-handle" draggable={layoutEditMode} onDragStart={(event) => handleLayoutDragStart(event, "shop")} onDragEnd={handleLayoutDragEnd} aria-label="Verstärkungen verschieben">{layoutEditMode && <><span className="layout-handle-grip">⋮⋮</span><div><strong>Verstärkungen</strong><small>ziehen und im Raster ablegen</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("shop", -1); }} aria-label="Verstärkungen nach oben">↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("shop", 1); }} aria-label="Verstärkungen nach unten">↓</button></div></>}</div><div className="shop-header"><div><p className="eyebrow">CLUB OFFICE / 21 AUSBAUSTUFEN</p><h2>Verstärkungen</h2><small className="shop-subtitle">{displayGame.features.cup.active ? "Live Match · Upgrades bleiben kaufbar" : hasFullTestAccess ? "AZB Vollzugriff · alle Stufen verfügbar" : "Saison für Saison wächst dein Club"}</small></div><div className="shop-balance"><span>{displayBalance}</span> TORE</div></div><div className="bulk-buy-bar"><div><span>KAUFMENGE</span><small>Mehrere Level mit einem Klick</small></div><div className="bulk-options" role="group" aria-label="Kaufmenge">{PURCHASE_MODES.map((mode) => <button className={purchaseMode === mode ? "active" : ""} key={String(mode)} onClick={() => setPurchaseMode(mode)}>{mode === "max" ? "MAX" : `x${mode}`}</button>)}</div></div><div className="shop-tabs" role="tablist"><button className={`tab-button${activeTab === "all" ? " active" : ""}`} onClick={() => setActiveTab("all")} role="tab">Alle</button><button className={`tab-button${activeTab === "click" ? " active" : ""}`} onClick={() => setActiveTab("click")} role="tab">Klicks</button><button className={`tab-button${activeTab === "auto" ? " active" : ""}`} onClick={() => setActiveTab("auto")} role="tab">Automatisch</button></div><div className="upgrade-list">{visibleUpgrades.map((upgrade) => { const level = getLevel(displayGame.upgrades, upgrade.id); const unlockSeason = getUpgradeUnlockSeason(upgrade.id); const unlocked = level > 0 || isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess); const purchase = getBulkPurchase(upgrade, displayGame.upgrades, spendableGoals, purchaseMode, hasInfiniteMoney); const affordable = unlocked && purchase.count > 0; const nextCost = getCost(upgrade, displayGame.upgrades); const purchaseLabel = !unlocked ? `Saison ${unlockSeason}` : purchase.count === 0 ? (nextCost === Infinity ? "MAX" : "Preis") : purchaseMode === "max" ? `MAX · x${purchase.count}` : purchaseMode === 1 ? "kaufen" : `x${purchase.count} kaufen`; const buttonCost = purchase.count > 0 ? purchase.totalCost : nextCost; return <div className={`upgrade-item${affordable ? " affordable" : ""}${unlocked ? "" : " season-locked"}`} key={upgrade.id}><div className="upgrade-icon"><Icon name={upgrade.icon} size={20} /></div><div className="upgrade-copy"><strong>{upgrade.name}</strong><small>{unlocked ? getUpgradeEffect(upgrade, level) : `Wird mit Saison ${unlockSeason} freigeschaltet`}</small><span className="upgrade-level">{unlocked ? `LEVEL ${level}` : "NOCH GESPERRT"}</span></div><button className="buy-button" disabled={!affordable || coopBusy} onClick={() => void buyUpgrade(upgrade)} aria-label={`${upgrade.name} ${purchaseLabel}`}>{unlocked ? hasInfiniteMoney ? "∞" : formatNumber(buttonCost) : "🔒"}<br /><small>{purchaseLabel}</small></button></div>; })}</div></section>

        <section className={layoutCardClass("feature", "feature-card")} style={{ order: layoutOrderNumber("feature") }} onDragOver={(event) => handleLayoutDragOver(event, "feature")} onDrop={(event) => handleLayoutDrop(event, "feature")}>
          {layoutEditMode && <div className="layout-card-handle" draggable onDragStart={(event) => handleLayoutDragStart(event, "feature")} onDragEnd={handleLayoutDragEnd} aria-label="Club World verschieben"><span className="layout-handle-grip">⋮⋮</span><div><strong>Club World</strong><small>ziehen und im Raster ablegen</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("feature", -1); }} aria-label="Club World nach oben">↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("feature", 1); }} aria-label="Club World nach unten">↓</button></div></div>}
          <div className="feature-card-heading"><div><p className="eyebrow">CLUB WORLD / NEUE MÖGLICHKEITEN</p><h2>Mehr als nur klicken.</h2><p>Pokalabende, Packs, Clubidentität und Ereignisse sorgen für neue Entscheidungen.</p></div><span className="feature-card-icon" style={{ color: displayGame.features.club.color, borderColor: `${displayGame.features.club.color}35` }}>{displayGame.features.club.badge}</span></div>
          {displayGame.features.randomEvent && <div className={`event-banner ${displayGame.features.randomEvent.tone}`}><span className="event-mark"><Icon name={displayGame.features.randomEvent.id === "var" ? "screen" : "star"} size={16} /></span><div><strong>{displayGame.features.randomEvent.title}</strong><p>{displayGame.features.randomEvent.message}</p></div><small>nächstes Ereignis automatisch</small></div>}
          <div className="feature-tabs" role="tablist" aria-label="Club World"><div>{featureTabs.map((tab) => <button key={tab.id} className={featureTab === tab.id ? "active" : ""} onClick={() => setFeatureTab(tab.id)} role="tab">{tab.label}</button>)}</div></div>

          {featureTab === "market" && <div className="feature-panel"><div className="feature-panel-heading"><div><p className="eyebrow">TRANSFERMARKT / KADER</p><h3>Wer soll deinen Club tragen?</h3></div><button className="mode-secondary" onClick={() => void refreshTransferMarket()} disabled={(!hasInfiniteMoney && displayGame.goals < 5000) || coopBusy}>Neu mischen · {hasInfiniteMoney ? "∞" : "5K"}</button></div><p className="feature-copy">Jeder Transfer gibt dauerhafte Boni auf Klicks, Tore pro Sekunde oder Einnahmen. Im Koop gilt der Kader für das ganze Team.</p><div className="transfer-grid">{transferOffers.map((player) => { const owned = displayGame.features.transferMarket.ownedIds.includes(player.id); return <article className="transfer-card" key={player.id} style={{ borderTopColor: player.accent }}><div className="transfer-card-top"><span className="transfer-avatar" style={{ color: player.accent, background: `${player.accent}12` }}>{player.name.slice(0, 1)}</span><span className="transfer-rating">{player.rating}</span></div><strong>{player.name}</strong><small>{player.position}</small><p>{player.clickBonus ? `+${formatNumber(player.clickBonus)} pro Klick` : ""}{player.clickBonus && player.passiveBonus ? " · " : ""}{player.passiveBonus ? `+${formatNumber(player.passiveBonus)} /s` : ""}{player.incomeBonus ? ` · +${Math.round(player.incomeBonus * 100)}% Einnahmen` : ""}</p><button className="feature-buy-button" onClick={() => void buyTransfer(player.id)} disabled={owned || (!hasInfiniteMoney && displayGame.goals < player.price) || coopBusy}>{owned ? "Im Kader" : hasInfiniteMoney ? "∞ Testkauf" : `${formatNumber(player.price)} Tore`}</button></article>; })}</div><div className="owned-strip"><span>DEIN KADER · {ownedTransferPlayers.length}</span><div>{ownedTransferPlayers.length ? ownedTransferPlayers.map((player) => <b key={player.id} title={player.name} style={{ borderColor: player.accent }}>{player.name.slice(0, 1)}</b>) : <small>Noch keine Transfers. Der Markt wartet.</small>}</div></div></div>}

          {featureTab === "cup" && <div className="feature-panel cup-panel">
            <div className="feature-panel-heading"><div><p className="eyebrow">POKALMODUS / STAR XI</p><h3>Dein Team muss sich verdienen.</h3></div><span className="feature-stat">{starXIRating} OVR</span></div>
            <p className="feature-copy">Jede Partie dauert 3 Minuten. Gewinne alle Runden eines Turniers am Stück. Teamrating zählt 70 Prozent, deine Taktik 30 Prozent. Die Tagesform entwickelt sich ruhig über das ganze Spiel und verändert die echte Spielstärke.</p>
            <div className="starxi-summary"><div><span>STAR XI RATING</span><strong>{starXIRating}</strong><small>Bewertung deiner aktuellen Startelf</small></div><div><span>STARTELF</span><strong>{startingStarXISelection.length} / {STAR_XI_SQUAD_SIZE}</strong><small>{starXIComplete ? "Alle 11 Positionen korrekt besetzt" : `${STAR_XI_SQUAD_SIZE} passende Startplätze erforderlich`}</small></div><div><span>BANK</span><strong>{benchStarXIPlayerCount} / {STAR_XI_BENCH_SIZE}</strong><small>{reserveStarXIPlayers.length} weitere Spieler im Speicher</small></div><div><span>{displayGame.features.cup.active ? "LIVE WECHSEL" : "TROPHÄEN"}</span><strong>{displayGame.features.cup.active ? `${displayGame.features.cup.substitutionsUsed} / ${STAR_XI_MAX_SUBSTITUTIONS}` : totalTrophies}</strong><small>{displayGame.features.cup.active ? "Startelf wählen, danach passenden Bankspieler" : `${displayGame.features.cup.wins} gewonnene Turnierpartien`}</small></div></div>
            <section className="trophy-room" aria-label="Gewonnene Pokale"><div className="trophy-room-heading"><div><p className="eyebrow">TROPHÄENRAUM</p><h4>Deine gewonnenen Pokale.</h4></div><span>{totalTrophies} GESAMT</span></div><div className="trophy-grid">{TOURNAMENTS.map((tournament) => { const count = displayGame.features.cup.trophies[tournament.id]; return <article className={`trophy-card${count > 0 ? " earned" : " locked"}`} key={`trophy-${tournament.id}`} style={{ "--trophy-accent": tournament.accent } as CSSProperties}><span className="trophy-icon" aria-hidden="true">{tournament.trophyIcon}</span><div><strong>{tournament.trophyName}</strong><small>{count > 0 ? `${count} Mal gewonnen` : `${tournament.opponents.length} Runden bis zum Pokal`}</small></div><b>{count}</b></article>; })}</div></section>
            <section className="club-scorer-board" aria-label="Ewige Torschützenliste"><div className="club-scorer-heading"><div><p className="eyebrow">CLUBREKORDE / EWIG</p><h4>Deine drei besten Torschützen.</h4></div><span>TURNIERTORE</span></div>{allTimeTopScorers.length ? <ol>{allTimeTopScorers.map(({ player, goals }, index) => <li key={`all-time-${player.id}`}><span>{index + 1}</span><div><strong>{player.name}</strong><small>{formatStarXIPositions(player)} · OVR {player.rating}</small></div><b>{goals} {goals === 1 ? "TOR" : "TORE"}</b></li>)}</ol> : <div className="club-scorer-empty"><strong>Die Rekordliste wartet.</strong><small>Das erste Turniertor eröffnet deine Klubgeschichte.</small></div>}</section>
            <div className="starxi-pack-heading"><div><p className="eyebrow">STAR XI / PACKS</p><h4>1’634 Spieler. Jeder Pull zählt.</h4><small>1’498 Basiskarten, alle 129 FC26 Icons und 7 einzigartige Spezialkarten.</small></div><span>{ownedStarXIPlayers.length} Spieler im Kader</span></div>
            <div className="star-pack-grid">{STAR_PACKS.map((pack) => { const unlockSeason = getPackUnlockSeason(pack.id); const unlocked = isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess); return <article className={`star-pack-card ${pack.id}${unlocked ? "" : " season-locked"}`} key={pack.id}><div className="star-pack-top"><span className="star-pack-icon">{unlocked ? "★" : "🔒"}</span><div><strong>{pack.label}</strong><small>{unlocked ? pack.description : `Freischaltung in Saison ${unlockSeason}`}</small></div><span className="star-pack-price">{unlocked ? hasInfiniteMoney ? "∞ TESTMODUS" : `${formatNumber(pack.price)} TORE` : `SAISON ${unlockSeason}`}</span></div><div className="star-pack-odds">{pack.odds.map((odd) => <span key={`${pack.id}-${odd.label}`}><em>{odd.label}</em><b>{formatPackChance(odd.chance)}</b></span>)}</div><button className="feature-buy-button" onClick={() => void buyStarPack(pack.id)} disabled={!unlocked || displayGame.features.cup.active || (!hasInfiniteMoney && displayGame.goals < pack.price) || coopBusy}>{!unlocked ? `Ab Saison ${unlockSeason}` : hasInfiniteMoney ? "∞ · Pack testen" : `${formatNumber(pack.price)} · Pack öffnen`}</button></article>; })}</div>
            <p className="star-pack-rarity-note">Icons stecken in ihrer jeweiligen Ratingstufe, sind darin aber nochmals deutlich seltener als normale Karten.</p>
            <div className="starxi-lineup-heading"><span>DEINE ELF / {activeFormation.label}</span><small>Spieler ziehen und einrasten lassen · Anklicken bleibt möglich</small></div>
            <div className="starxi-squad-layout">
              <section className="starxi-pitch-panel" aria-label="Startelf Aufstellung">
                <div className="starxi-pitch-toolbar"><span>STARTELF · 11 PLÄTZE</span><small>{activeLineupSlot === null ? "Startplatz wählen" : `Platz ${activeLineupSlot + 1} · ${activeLineupPosition}`}</small></div>
                <label className="starxi-formation-picker"><span><strong>FORMATION WÄHLEN</strong><small>{displayGame.features.cup.active ? "Während des Spiels gesperrt" : `${unlockedFormationCount} von ${STAR_FORMATIONS.length} Formationen freigeschaltet`}</small></span><select value={activeFormation.id} disabled={displayGame.features.cup.active || coopBusy} onChange={(event) => void changeStarXIFormation(event.target.value as StarFormationId)}>{STAR_FORMATIONS.map((formation) => { const unlockSeason = getFormationUnlockSeason(formation.id); const unlocked = isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess) || activeFormation.id === formation.id; return <option value={formation.id} key={formation.id} disabled={!unlocked}>{formation.label}{unlocked ? "" : ` · Saison ${unlockSeason}`}</option>; })}</select></label>
                <div className="starxi-pitch"><div className="starxi-pitch-markings" aria-hidden="true" /><div className="starxi-formation-grid">{activeFormation.slots.map((slot, index) => {
                  const player = startingStarXIPlayers[index];
                  const position = activeFormationPositions[index];
                  const selected = activeLineupSlot === index;
                  const liveRating = displayGame.features.cup.active && player ? getCupPlayerMatchRating(displayGame.features.cup, player.id, cupMatchMinute) : null;
                  const slotStyle = { "--slot-x": `${slot.x}%`, "--slot-y": `${slot.y}%` } as CSSProperties;
                  const dragSource: SquadDragSource | null = player ? { playerId: player.id, area: "lineup", index } : null;
                  return <button type="button" style={slotStyle} className={`starxi-pitch-slot${selected ? " selected" : ""}${player ? " filled" : " empty"}${liveRating !== null && liveRating < 6 ? " match-poor" : ""}${draggingSquadPlayer?.playerId === player?.id ? " squad-dragging" : ""}${squadDropClass("lineup", index)}`} key={`${activeFormation.id}-${index}`} onClick={() => chooseLineupSlot(index)} disabled={coopBusy} draggable={Boolean(dragSource && !layoutEditMode && !coopBusy)} onDragStart={(event) => dragSource && handleSquadDragStart(event, dragSource)} onDragOver={(event) => handleSquadDragOver(event, { area: "lineup", index })} onDrop={(event) => void handleSquadDrop(event, { area: "lineup", index })} onDragEnd={handleSquadDragEnd} aria-label={`${position}: ${player?.name ?? "offener Platz"}${player ? ", zum Wechseln ziehen" : ", Spieler hier ablegen"}`}><span className="starxi-slot-position">{position}</span><strong>{player?.name ?? "Offener Platz"}</strong><small>{player ? `OVR ${player.rating} · ${formatStarXIPositions(player)}` : `Nur ${position}`}</small>{liveRating !== null && <span className={`starxi-match-rating${liveRating < 6 ? " poor" : liveRating >= 8 ? " great" : ""}`}>FORM {liveRating.toFixed(1)}</span>}</button>;
                })}</div></div>
                <p className="starxi-pitch-help">{displayGame.features.cup.active ? `Live Wechsel: Bankspieler direkt auf den passenden Feldspieler ziehen oder wie bisher beide anklicken. Maximal ${STAR_XI_MAX_SUBSTITUTIONS} Wechsel, ${displayGame.features.cup.substitutionsUsed} bereits genutzt.` : activeLineupSlot !== null ? `Für ${activeLineupPosition} werden nur passende Spieler angezeigt. Du kannst sie auch direkt hierher ziehen.` : selectedBenchSlot !== null ? `Bankplatz ${selectedBenchSlot + 1} gewählt. Klicke einen Spieler an oder ziehe ihn auf den Bankplatz.` : `Ziehe Spieler zwischen Feld und Bank oder aus dem Speicher auf einen passenden Platz. Alles rastet automatisch ein.`}</p>
              </section>
              <div className="starxi-squad-side">
                <section className="starxi-bank-panel" aria-label="Bank">
                  <div className="starxi-subheading"><div><span className="eyebrow">BANK / LIVE WECHSEL</span><h4>Deine Bank</h4></div><strong>{benchStarXIPlayerCount} / {STAR_XI_BENCH_SIZE}</strong></div>
                  <div className="starxi-bank-grid">{Array.from({ length: STAR_XI_BENCH_SIZE }, (_, index) => {
                    const player = benchStarXIPlayers[index];
                    const compatible = Boolean(player && activeLineupSlot !== null && canStarXIPlayerFillSlot(player.id, activeLineupSlot, activeFormationPositions));
                    const selected = selectedBenchSlot === index;
                    const liveRating = displayGame.features.cup.active && player ? getCupPlayerMatchRating(displayGame.features.cup, player.id, cupMatchMinute) : null;
                    const alreadySubbedOut = Boolean(player && displayGame.features.cup.active && displayGame.features.cup.playerExitedAt[player.id]);
                    const dragSource: SquadDragSource | null = player ? { playerId: player.id, area: "bench", index } : null;
                    const dropHandlers = {
                      onDragOver: (event: DragEvent<HTMLElement>) => handleSquadDragOver(event, { area: "bench", index }),
                      onDrop: (event: DragEvent<HTMLElement>) => void handleSquadDrop(event, { area: "bench", index }),
                    };
                    return player ? <button type="button" className={`starxi-player-card bank${selected ? " selected" : ""}${activeLineupSlot !== null && (!compatible || alreadySubbedOut) ? " incompatible" : ""}${liveRating !== null && liveRating < 6 ? " match-poor" : ""}${draggingSquadPlayer?.playerId === player.id ? " squad-dragging" : ""}${squadDropClass("bench", index)}`} key={player.id} onClick={() => activeLineupSlot !== null ? void selectStarXIPlayer(player.id) : chooseBenchSlot(index)} disabled={coopBusy || (!draggingSquadPlayer && activeLineupSlot !== null && (!compatible || alreadySubbedOut || (displayGame.features.cup.active && displayGame.features.cup.substitutionsUsed >= STAR_XI_MAX_SUBSTITUTIONS)))} draggable={!layoutEditMode && !coopBusy} onDragStart={(event) => dragSource && handleSquadDragStart(event, dragSource)} onDragEnd={handleSquadDragEnd} {...dropHandlers}><span style={{ color: player.accent }}>{formatStarXIPositions(player, true)}</span><div><strong>{player.name}</strong><small>{liveRating !== null ? `FORM ${liveRating.toFixed(1)} · ` : ""}{alreadySubbedOut ? "Bereits ausgewechselt" : activeLineupSlot !== null ? compatible ? displayGame.features.cup.active ? "Nur für dieses Spiel einwechseln" : `Auf ${activeLineupPosition} einsetzen` : `Passt nicht auf ${activeLineupPosition}` : displayGame.features.cup.active ? "Auf einen Feldspieler ziehen" : `Bankplatz ${index + 1} · ziehen zum Tauschen`}</small></div><b>{player.rating}</b></button> : <button type="button" className={`starxi-bank-slot${selected ? " selected" : ""}${squadDropClass("bench", index)}`} key={`bank-empty-${index}`} onClick={() => chooseBenchSlot(index)} disabled={displayGame.features.cup.active || coopBusy} {...dropHandlers}><span>BANK {index + 1}</span><small>{selected ? "gewählt" : draggingSquadPlayer ? "hier ablegen" : "frei"}</small></button>;
                  })}</div>
                </section>
                <section className="starxi-reserve-panel" aria-label="Reservekader">
                  <div className="starxi-subheading"><div><span className="eyebrow">KADER / RESERVE</span><h4>Weitere Spieler</h4></div><strong>{reserveStarXIPlayers.length}</strong></div>
                  <div className="starxi-reserve-controls"><div className="starxi-filter-tools"><input className="starxi-search" value={starSearch} onChange={(event) => { setStarSearch(event.target.value); setReservePage(0); }} placeholder="Spieler suchen" aria-label="Spieler im Reservekader suchen" /><select className="starxi-position-filter" value={starPositionFilter} onChange={(event) => { setStarPositionFilter(event.target.value); setReservePage(0); }} aria-label="Position im Reservekader filtern"><option value="all">Alle Positionen</option>{STAR_POSITIONS.map((position) => <option value={position} key={`reserve-position-${position}`}>{position}</option>)}</select></div><div className="starxi-filter-row" role="group" aria-label="Ratingfilter">{STAR_RATING_FILTERS.map((filter) => <button type="button" className={starRatingFilter === filter.id ? "active" : ""} key={filter.id} onClick={() => { setStarRatingFilter(filter.id); setReservePage(0); }} aria-pressed={starRatingFilter === filter.id}>{filter.label}</button>)}</div></div>
                  <div className="starxi-reserve-list">{filteredReserveStarXIPlayers.length ? visibleReserveStarXIPlayers.map((player) => { const compatible = activeLineupSlot === null || canStarXIPlayerFillSlot(player.id, activeLineupSlot, activeFormationPositions); const dragSource: SquadDragSource = { playerId: player.id, area: "reserve", index: null }; return <button type="button" className={`starxi-player-card reserve${activeLineupSlot !== null && !compatible ? " incompatible" : ""}${draggingSquadPlayer?.playerId === player.id ? " squad-dragging" : ""}`} key={player.id} onClick={() => selectedBenchSlot !== null ? void selectStarXIBenchPlayer(player.id, selectedBenchSlot) : void selectStarXIPlayer(player.id)} disabled={displayGame.features.cup.active || coopBusy || (activeLineupSlot !== null && !compatible)} draggable={!layoutEditMode && !displayGame.features.cup.active && !coopBusy} onDragStart={(event) => handleSquadDragStart(event, dragSource)} onDragEnd={handleSquadDragEnd}><span style={{ color: player.accent }}>{formatStarXIPositions(player, true)}</span><div><strong>{player.name}</strong><small>{selectedBenchSlot !== null ? `Auf Bankplatz ${selectedBenchSlot + 1}` : activeLineupSlot !== null ? compatible ? `Auf ${activeLineupPosition} einsetzen` : `Kann nicht ${activeLineupPosition}` : "Auf Startelf oder Bank ziehen"}</small></div><b>{player.rating}</b></button>; }) : <div className="starxi-empty">Keine Spieler passen zu diesem Filter.</div>}</div>
                  {filteredReserveStarXIPlayers.length > 0 && <nav className="starxi-pagination" aria-label="Seiten im Reservekader"><button type="button" onClick={() => setReservePage(Math.max(0, activeReservePage - 1))} disabled={activeReservePage === 0}>← Zurück</button><span><strong>Seite {activeReservePage + 1} von {reservePageCount}</strong><small>{activeReservePage * RESERVE_PAGE_SIZE + 1} bis {Math.min((activeReservePage + 1) * RESERVE_PAGE_SIZE, filteredReserveStarXIPlayers.length)} von {filteredReserveStarXIPlayers.length}</small></span><button type="button" onClick={() => setReservePage(Math.min(reservePageCount - 1, activeReservePage + 1))} disabled={activeReservePage >= reservePageCount - 1}>Weiter →</button></nav>}
                </section>
              </div>
            </div>
            {!displayGame.features.cup.active && <div className="tournament-picker"><div className="tournament-picker-heading"><div><p className="eyebrow">TURNIERE / 3 SCHWIERIGKEITEN</p><h4>Wähle deinen Pokallauf.</h4></div><span>JEDE PARTIE · 03:00</span></div><div className="tournament-grid">{TOURNAMENTS.map((tournament) => {
              const unlockSeason = getTournamentUnlockSeason(tournament.id);
              const seasonUnlocked = isSeasonContentUnlocked(unlockSeason, displayGame.seasons, hasFullTestAccess);
              const locked = !seasonUnlocked || !starXIComplete || starXIRating < tournament.minimumRating;
              const firstOpponent = tournament.opponents[0];
              const finalOpponent = tournament.opponents[tournament.opponents.length - 1];
              const tier = tournament.id === "stadium" ? "EINSTIEG" : tournament.id === "champions" ? "PROFI" : "ELITE";
              const lockLabel = !seasonUnlocked ? `Ab Saison ${unlockSeason}` : !starXIComplete ? `${STAR_XI_SQUAD_SIZE} Spieler benötigt` : `${tournament.minimumRating} OVR benötigt`;
              const goalBoost = String(getTournamentGoalBoostMultiplier(tournament.id)).replace(".", ",");
              return <button className={"tournament-card" + (selectedTournamentId === tournament.id ? " selected" : "") + (locked ? " locked" : "")} key={tournament.id} onClick={() => setSelectedTournamentId(tournament.id)} disabled={locked} style={{ borderTopColor: tournament.accent }}><span className="tournament-card-top"><strong>{tournament.label}</strong><b>{tier}</b></span><small>{tournament.description}</small><span className="tournament-route-preview" aria-label={`${tournament.opponents.length} Runden`}>{tournament.opponents.map((opponent, index) => <i key={`${tournament.id}-${opponent.name}`} className={index === tournament.opponents.length - 1 ? "final" : ""}>{index + 1}</i>)}</span><span className="tournament-card-meta"><b>{tournament.opponents.length} Runden · ab {tournament.minimumRating} OVR</b><em>{firstOpponent.rating} → {finalOpponent.rating} OVR</em></span><span className="tournament-boost-reward">⚡ TURNIERSIEG · 03:00 · {goalBoost}× GOALS</span>{locked && <span className="tournament-lock">{lockLabel}</span>}</button>;
            })}</div></div>}
            {!displayGame.features.cup.active ? <div className="cup-start"><div><strong>{!selectedTournamentSeasonUnlocked ? `${selectedTournament.label} ist noch gesperrt.` : starXIComplete ? displayGame.features.cup.lastResult : `${STAR_XI_SQUAD_SIZE} passende Spieler werden bis zum Anpfiff benötigt.`}</strong><small>{!selectedTournamentSeasonUnlocked ? `Wird in Saison ${selectedTournamentUnlockSeason} freigeschaltet` : starXIComplete ? `${selectedTournament.label} · ${selectedTournament.opponents.length} Partien am Stück · Turniersieg: ${String(getTournamentGoalBoostMultiplier(selectedTournament.id)).replace(".", ",")}× Goals für 03:00` : "Alle elf Positionen müssen korrekt besetzt sein"}</small></div><button className="mode-primary" onClick={() => void startCup(selectedTournamentId)} disabled={!selectedTournamentSeasonUnlocked || !starXIComplete || starXIRating < selectedTournament.minimumRating || coopBusy}>{!selectedTournamentSeasonUnlocked ? `Ab Saison ${selectedTournamentUnlockSeason}` : starXIComplete ? `${selectedTournament.opponents.length} Runden starten` : "Startelf vervollständigen"}</button></div> : <div className="cup-match-live">
              <div className="cup-run-progress"><div>{activeTournament.opponents.map((opponent, index) => <span className={index < displayGame.features.cup.round ? "won" : index === displayGame.features.cup.round ? "current" : ""} key={`live-${activeTournament.id}-${opponent.name}`}><i>{index + 1}</i><small>{index === activeTournament.opponents.length - 1 ? "Final" : `R${index + 1}`}</small></span>)}</div><strong>{activeTournament.trophyIcon} {activeTournament.trophyName}</strong></div>
              <div className="cup-live-head"><span className={`cup-live-pill ${displayGame.features.cup.phase}`}><i /> {displayGame.features.cup.phase === "extra-time" ? "VERLÄNGERUNG" : displayGame.features.cup.phase === "penalties" ? "ELFMETERSCHIESSEN" : "LIVE"}</span><div><small>{activeTournament.label} · Runde {displayGame.features.cup.round + 1} von {activeTournament.opponents.length}</small><strong>{displayGame.features.cup.phase === "penalties" ? "ELFM." : `${cupMatchMinute}′`}</strong><small>{displayGame.features.cup.phase === "penalties" ? "Entscheidung vom Punkt" : "Ingame Minute"}</small></div></div>
              <div className="cup-scoreboard"><div><small>DEIN CLUB</small><strong>{displayGame.features.cup.homeScore}</strong><span>{displayGame.features.club.name}</span></div><em>:</em><div><small>GEGNER · {displayGame.features.cup.opponentRating} OVR</small><strong>{displayGame.features.cup.awayScore}</strong><span>{displayGame.features.cup.opponent}</span></div></div>
              <section className="cup-live-ticker" aria-label="Live Ticker"><div className="cup-live-ticker-heading"><span>LIVE TICKER</span><strong>{cupMatchEvents.length ? `${cupMatchEvents.length} TOR${cupMatchEvents.length === 1 ? "" : "E"}` : "ANPFIFF"}</strong></div>{cupMatchEvents.length ? <ol>{cupMatchEvents.slice(0, 6).map((event) => <li className={event.side} key={`ticker-${event.id}`}><time>{event.minute}′</time><div><strong>{event.scorer}</strong><small>{event.side === "home" ? displayGame.features.club.name : displayGame.features.cup.opponent}</small></div><b>{event.homeScore}:{event.awayScore}</b></li>)}</ol> : <p>Noch kein Tor. Die Partie läuft.</p>}</section>
              <div className="cup-live-meta"><span>RUNDE <b>{displayGame.features.cup.round + 1} / {activeTournament.opponents.length}</b></span><span>TEAM <b>{cupEffectiveRating.toFixed(1)} OVR</b></span><span>GEGNER <b>{displayGame.features.cup.opponentRating} OVR</b></span><span>WECHSEL <b>{displayGame.features.cup.substitutionsUsed} / {STAR_XI_MAX_SUBSTITUTIONS}</b></span></div>
              <div className="cup-strength-card"><div className="cup-strength-heading"><div><span>SPIELSTÄRKE</span><strong>{cupMatchStrength.teamStrength.toFixed(1)} : {cupMatchStrength.opponentStrength.toFixed(1)}</strong></div><small>70% Rating · 30% Taktik</small></div><div className="cup-strength-labels"><span>{displayGame.features.club.name}</span><b className={cupMatchStrength.tactical.tone}>{cupMatchStrength.tactical.label}</b><span>{displayGame.features.cup.opponent}</span></div><div className="cup-strength-meter"><span style={{ width: `${cupStrengthShare}%` }} /></div></div>
              <div className="opponent-plan"><span>GEGNERPLAN</span><strong>{opponentStrategy.label}</strong><small>{opponentStrategy.description}</small></div>
              {displayGame.features.cup.phase !== "penalties" && <div className="strategy-grid">{CUP_STRATEGIES.map((strategy) => { const matchup = getCupTacticalMatchup(strategy.id, displayGame.features.cup.opponentStrategyId); return <button className={`${displayGame.features.cup.strategyId === strategy.id ? "active " : ""}${matchup.tone}`} key={strategy.id} onClick={() => void playCup(strategy.id)} disabled={coopBusy}><strong>{strategy.label}</strong><small>{strategy.description}</small><em>{matchup.label}</em></button>; })}</div>}
              <p className="cup-live-note">Bei Gleichstand folgen Verlängerung bis 120′ und ein von dir gesteuertes Elfmeterschiessen. Nach einem Rundensieg startet die nächste Partie automatisch. Rote Form kann mit einem passenden Bankspieler ausgewechselt werden.</p>
            </div>}
          </div>}

          {featureTab === "club" && <div className="feature-panel"><div className="feature-panel-heading"><div><p className="eyebrow">CLUBIDENTITÄT / DEIN VEREIN</p><h3>Mach ihn zu deinem Club.</h3></div><span className="club-preview" style={{ color: clubDraft.color, borderColor: clubDraft.color }}>{clubDraft.badge}</span></div><div className="club-form"><label htmlFor="club-name">Clubname</label><input id="club-name" className="mode-input" value={clubDraft.name} maxLength={22} onChange={(event) => setClubDraft((current) => ({ ...current, name: event.target.value }))} /><div><span className="club-form-label">Wappen</span><div className="club-choice-row">{CLUB_BADGES.map((badge) => <button key={badge} className={clubDraft.badge === badge ? "selected" : ""} onClick={() => setClubDraft((current) => ({ ...current, badge }))}>{badge}</button>)}</div></div><div><span className="club-form-label">Clubfarbe</span><div className="club-choice-row colors">{CLUB_COLORS.map((color) => <button key={color} className={clubDraft.color === color ? "selected" : ""} style={{ background: color }} aria-label={`Clubfarbe ${color}`} onClick={() => setClubDraft((current) => ({ ...current, color }))} />)}</div></div><button className="mode-primary" onClick={() => void saveClubProfile()} disabled={coopBusy}>Clubprofil speichern</button></div></div>}

          {featureTab === "missions" && <div className="feature-panel">{!isCoopLive ? <div className="feature-empty"><Icon name="stadium" size={25} /><strong>Koop Missionen</strong><p>Starte ein Koop Match, um gemeinsame Ziele mit deinem Team freizuschalten.</p></div> : <><div className="feature-panel-heading"><div><p className="eyebrow">KOOP / GEMEINSAME ZIELE</p><h3>Missionen für euer Team.</h3></div><span className="feature-stat">SAISON {currentSeason}</span></div><div className="mission-list">{featureMissions.map((mission) => { const progress = getMissionProgress(mission, { seasonGoals: displayGame.seasonGoals, clicks: displayGame.clicks, minigameWins: displayGame.minigameWins, cupWins: displayGame.features.cup.wins }); const complete = progress >= mission.target; return <div className={`mission-row${mission.claimed ? " claimed" : ""}`} key={mission.id}><div className="mission-copy"><strong>{mission.title}</strong><small>{mission.description}</small><div className="mission-progress"><span style={{ width: `${Math.min(100, (progress / mission.target) * 100)}%` }} /></div><em>{formatNumber(Math.min(progress, mission.target))} / {formatNumber(mission.target)}</em></div><button className="feature-buy-button" onClick={() => void claimMission(mission)} disabled={mission.claimed || !complete || coopBusy}>{mission.claimed ? "Abgeholt" : complete ? `+${formatNumber(mission.reward)}` : "offen"}</button></div>; })}</div></>}</div>}

          {featureTab === "history" && <div className="feature-panel"><div className="feature-panel-heading"><div><p className="eyebrow">MATCH CENTER / VERLAUF</p><h3>Was im Club passiert.</h3></div><span className="feature-stat">{featureHistory.length} EINTRÄGE</span></div><div className="history-list">{featureHistory.length ? featureHistory.map((entry) => <div className={`history-row ${entry.tone}`} key={entry.id}><span><Icon name={entry.tone === "negative" ? "screen" : entry.title.includes("Pokal") ? "crown" : "star"} size={15} /></span><div><strong>{entry.title}</strong><small>{entry.detail}</small></div><em>{formatHistoryTime(entry.timestamp)}</em></div>) : <div className="feature-empty"><Icon name="broadcast" size={25} /><p>Noch keine Einträge. Das Stadion wartet auf seine erste Geschichte.</p></div>}</div></div>}
        </section>

        <aside className={layoutCardClass("side", "side-column")} style={{ order: layoutOrderNumber("side") }} onDragOver={(event) => handleLayoutDragOver(event, "side")} onDrop={(event) => handleLayoutDrop(event, "side")}>
          {layoutEditMode && <div className="layout-card-handle" draggable onDragStart={(event) => handleLayoutDragStart(event, "side")} onDragEnd={handleLayoutDragEnd} aria-label="Seitenkarten verschieben"><span className="layout-handle-grip">⋮⋮</span><div><strong>Seitenkarten</strong><small>ziehen und im Raster ablegen</small></div><div className="layout-order-controls"><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("side", -1); }} aria-label="Seitenkarten nach oben">↑</button><button type="button" onClick={(event) => { event.stopPropagation(); moveLayoutCard("side", 1); }} aria-label="Seitenkarten nach unten">↓</button></div></div>}
          {isCoopLive && coopSession && <div className="side-card coop-team-card"><div className="side-card-heading"><span className="heading-icon"><Icon name="stadium" size={16} /></span><div><p className="eyebrow">TEAM / {String(coopSession.room.playerCount).padStart(2, "0")} VON 04</p><h2>Dein Team</h2></div><span className="coop-live-badge">{hasInfiniteMoney ? "TEST" : "LIVE"}</span></div><div className="coop-players">{coopSession.room.players.map((player) => <div className={`coop-player-card${player.role === coopSession.role ? " you" : ""}${player.online ? " online" : ""}${!player.occupied ? " waiting" : ""}`} key={player.role}><span className="coop-player-tag">{player.role === coopSession.role ? `DU · ${coopRoleLabel(player.role)}` : coopRoleLabel(player.role)}</span><strong>{player.occupied ? player.name : "Freier Platz"}</strong><small>{player.occupied ? `${formatNumber(player.goals)} Tore · ${formatNumber(player.clicks)} Klicks · ${player.online ? "online" : "offline"}` : "Raumcode teilen"}</small></div>)}</div><div className="coop-team-total"><span>{hasInfiniteMoney ? "AZB TESTGUTHABEN" : "GEMEINSAMER KONTOSTAND"}</span><strong>{displayBalance} Tore</strong></div></div>}
          <div className="side-card"><div className="side-card-heading"><span className="heading-icon">↗</span><div><p className="eyebrow">AUFSTIEG</p><h2>Die Tabelle</h2></div></div><div className="rank-display"><span className="rank-symbol large"><Icon name={currentRank.icon} size={29} /></span><div><strong>{currentRank.name}</strong><small>{nextRank ? `${formatNumber(nextRank.minimum)} Tore für ${nextRank.name}` : "Du bist die Tabelle."}</small></div></div><div className="rank-progress"><div style={{ width: `${rankProgress}%` }} /></div><div className="rank-progress-labels"><span>{formatNumber(displayGame.totalGoals)} insgesamt</span><span>{nextRank ? formatNumber(nextRank.minimum) : "MAX"}</span></div></div>
          <div className="side-card season-card">
            <div className="side-card-heading"><span className="heading-icon">★</span><div><p className="eyebrow">SAISONPFAD / {currentSeason} VON {MAX_CAREER_SEASON}</p><h2>{currentSeasonMilestone.title}</h2></div><span className="season-stars">★ {displayGame.stars}</span></div>
            <p className="season-copy">{currentSeasonMilestone.description} Jeder Vereinsstern gibt dauerhaft 2% auf alle Einnahmen.</p>
            <div className="season-unlocks"><span>IN DIESER SAISON AKTIV</span><div>{currentSeasonMilestone.rewards.map((reward) => <b key={`${currentSeason}-${reward}`}>✓ {reward}</b>)}</div></div>
            <div className="season-stat"><span>{seasonCareerComplete ? "KARRIERE GEMEISTERT" : `${formatNumber(displayGame.goals)} / ${formatNumber(seasonTarget)} AKTUELL`}</span><strong>{seasonCareerComplete ? "HALL OF FAME" : `+${seasonReward} ${seasonReward === 1 ? "STERN" : "STERNE"}`}</strong></div>
            <div className="season-progress"><div style={{ width: `${seasonCareerComplete ? 100 : seasonProgress}%` }} /></div>
            {nextSeasonMilestone && <div className="season-next"><span>ALS NÄCHSTES · SAISON {nextSeasonMilestone.season}</span><strong>{nextSeasonMilestone.title}</strong><small>{nextSeasonMilestone.rewards.join(" · ")}</small></div>}
            <details className="season-roadmap"><summary>Alle Saison Freischaltungen <span>＋</span></summary><div>{SEASON_MILESTONES.map((milestone) => <article className={milestone.season < currentSeason ? "done" : milestone.season === currentSeason ? "current" : "future"} key={`season-roadmap-${milestone.season}`}><i>{milestone.season < currentSeason ? "✓" : milestone.season}</i><div><strong>{milestone.title}</strong><small>{milestone.rewards.join(" · ")}</small></div></article>)}</div></details>
            <button className="season-button" disabled={seasonCareerComplete || !canStartNewSeason || coopBusy} onClick={() => void startNewSeason()}>{seasonCareerComplete ? "Hall of Fame erreicht" : canStartNewSeason ? `Saison ${currentSeason + 1} starten` : `${formatNumber(seasonTarget)} aktuelle Tore benötigt`}</button>
          </div>
          <div className="side-card achievement-card"><div className="side-card-heading"><span className="heading-icon">◇</span><div><p className="eyebrow">ERFOLGE</p><h2>Pokalschrank</h2></div><span className="achievement-count">{displayGame.achievements.length} / {ACHIEVEMENTS.length}</span></div><div className="achievement-list">{ACHIEVEMENTS.map((achievement) => { const unlocked = displayGame.achievements.includes(achievement.id); return <div className={`achievement-row${unlocked ? " unlocked" : ""}`} key={achievement.id}><span><Icon name={achievement.icon} size={17} /></span><div><strong>{achievement.name}</strong><small>{achievement.description}</small></div><em>{unlocked ? "✓" : formatNumber(achievement.threshold)}</em></div>; })}</div></div>
          <div className="side-card feed-card"><div className="side-card-heading"><span className="heading-icon">≡</span><div><p className="eyebrow">STADIONFUNK</p><h2>Live aus dem Block</h2></div></div><div className="feed-list">{feed.map((item) => <div className="feed-item" key={item.id}><span className="feed-mark"><Icon name={item.icon} size={13} /></span><p>{item.text}</p></div>)}</div></div>
          <div className="coach-note"><span className="coach-avatar">COACH</span><div><strong>Trainer Tipp</strong><p>{nextSeasonMilestone ? `Saison ${nextSeasonMilestone.season} schaltet ${nextSeasonMilestone.rewards.join(" und ")} frei.` : "Hall of Fame erreicht. Alle Saisoninhalte und Turniere sind aktiv."}</p></div></div>
        </aside>
      </main>}

      {appMode === "leaderboard" && <main className="mode-page">
        <section className="mode-card leaderboard-card">
          <div className="mode-card-heading"><div><p className="eyebrow">GLOBAL SCOREBOARD / SINGLEPLAYER</p><h2>Die Welt schaut zu.</h2><p>Dein Singleplayer-Spielstand bleibt lokal. Nur wenn du ihn einträgst, erscheint er auf allen Geräten in dieser Rangliste.</p></div><span className="mode-card-icon"><Icon name="crown" size={24} /></span></div>
          <div className="leaderboard-submit"><div><label htmlFor="leaderboard-name">Spielername</label><input id="leaderboard-name" className="mode-input" value={playerName} maxLength={18} placeholder="z. B. Captain Goal" onChange={(event) => setPlayerName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitLeaderboard(); }} /><small>2–18 Zeichen · wird online angezeigt</small></div><button className="mode-primary" onClick={() => void submitLeaderboard()} disabled={leaderboardLoading}>{leaderboardLoading ? "Lädt …" : "Spielstand eintragen"}</button></div>
          {leaderboardMessage && <p className="mode-message" role="status">{leaderboardMessage}</p>}
          <div className="leaderboard-head"><span>RANG</span><span>SPIELER</span><span>TORE GESAMT</span></div>
          <div className="leaderboard-list">
            {leaderboard.length ? leaderboard.map((entry, index) => <div className={`leaderboard-row${entry.playerId === playerId ? " current" : ""}`} key={entry.playerId}><span className="leaderboard-position">{index + 1}</span><div className="leaderboard-player"><strong>{entry.nickname}</strong><small>Saison {formatNumber(entry.seasonGoals)} Tore</small></div><strong className="leaderboard-score">{formatNumber(entry.totalGoals)}</strong></div>) : <div className="empty-state"><Icon name="broadcast" size={22} /><p>Noch keine Einträge. Sei der erste Torschützenkönig.</p></div>}
          </div>
          <div className="leaderboard-footnote"><span><i /> online · Browser-Spielstände · ungültige Extremwerte werden ausgeblendet</span><button className="mode-secondary" onClick={() => void loadLeaderboard()} disabled={leaderboardLoading}>Aktualisieren</button></div>
        </section>
      </main>}

      {appMode === "coop" && !isCoopLive && <main className="mode-page coop-mode-page">
        <section className={`mode-card coop-card${coopSession?.room.status === "live" ? " is-live" : ""}`}>
          <div className="mode-card-heading"><div><p className="eyebrow">CO-OP CAREER / BIS ZU VIER SPIELER</p><h2>Zusammen auf die Torjagd.</h2><p>Ein Raum, ein gemeinsames Konto, bis zu vier Geräte. Der Singleplayer bleibt komplett separat.</p></div><span className="mode-card-icon"><Icon name="stadium" size={24} /></span></div>
          {!coopSession ? <div className="coop-lobby">
            <div className="coop-lobby-panel"><span className="coop-panel-number">01</span><div><p className="eyebrow">NEUE WELT ERÖFFNEN</p><h3>Du bist der Host.</h3><p>Gib deiner Welt einen Namen und teile den Raumcode mit bis zu drei Mitspielern.</p></div><input className="mode-input room-name-input" value={coopRoomName} maxLength={28} placeholder="z. B. Xevihans United" onChange={(event) => setCoopRoomName(event.target.value)} aria-label="Name der neuen Welt" /><button className="mode-primary" onClick={() => void createCoopRoom()} disabled={coopBusy}>Welt erstellen</button></div>
            <div className="coop-lobby-panel"><span className="coop-panel-number">02</span><div><p className="eyebrow">MIT RAUMCODE BEITRETEN</p><h3>Schon eingeladen?</h3><p>Code eingeben und direkt im gemeinsamen Match landen.</p></div><input className="mode-input code-input" value={coopCodeInput} maxLength={6} placeholder="ABC123" onChange={(event) => setCoopCodeInput(event.target.value.toUpperCase())} /><button className="mode-secondary" onClick={() => void joinCoopRoom()} disabled={coopBusy}>Beitreten</button></div>
            <div className="coop-name-field"><label htmlFor="coop-name">Dein Spielername für den Koop-Raum</label><input id="coop-name" className="mode-input" value={playerName} maxLength={18} placeholder="z. B. Team Captain" onChange={(event) => setPlayerName(event.target.value)} /><small>Dieser Name wird allen Personen im Raum angezeigt.</small></div>
            {savedRooms.length > 0 && <div className="saved-rooms"><div className="saved-rooms-heading"><div><p className="eyebrow">DEINE KOOP WELTEN</p><h3>Gespeicherte Matches</h3></div><button className="mode-secondary" onClick={() => void loadSavedRooms()} disabled={roomsLoading}>{roomsLoading ? "Lädt …" : "Aktualisieren"}</button></div><div className="saved-room-list">{savedRooms.map((room) => { const otherOnlineCount = room.players.filter((player) => player.occupied && player.role !== room.viewerRole && player.online).length; const otherOnline = otherOnlineCount > 0; const names = occupiedCoopPlayers(room).map((player) => player.name).join(" · "); return <div className={`saved-room-row${otherOnline ? " other-online" : ""}`} key={room.code}><button className="saved-room-main" onClick={() => void reopenSavedRoom(room.code)} disabled={coopBusy}><span className="saved-room-code">{room.code}</span><span className="saved-room-copy"><strong>{room.roomName}</strong><small>{names} · {room.playerCount}/4 Spieler · {room.testMode ? "∞ AZB Testmodus" : `${formatNumber(room.sharedCoins)} Tore`}</small></span><span className={`saved-room-presence${otherOnline ? " online" : ""}`}><i />{otherOnline ? `${otherOnlineCount} ONLINE` : "OFFLINE"}</span><span className="saved-room-open">Öffnen&nbsp;↗</span></button>{room.canDelete && <button className="saved-room-delete" onClick={() => void deleteCoopRoom(room.code)} disabled={coopBusy}>Löschen</button>}</div>; })}</div><p className="saved-rooms-note">Jede Welt erscheint bei allen vier Mitgliedern mit demselben gemeinsamen Spielstand. Nach Updates wird dein Platz automatisch wiederhergestellt.</p></div>}
          </div> : <div className="coop-room">
            <div className="coop-room-bar"><div><p className="eyebrow">{coopSession.room.roomName} / RAUMCODE</p><strong className="coop-code">{coopSession.code}</strong><span>{coopSession.room.status === "live" ? `LIVE · ${coopSession.room.playerCount} von 4 Spielern verbunden` : "WARTET · Code mit bis zu drei Mitspielern teilen"}</span></div><div className="coop-room-actions"><button className="mode-secondary" onClick={() => void copyCoopCode()}>Code kopieren</button>{coopSession.role === "host" && <button className="mode-secondary danger" onClick={() => void deleteCoopRoom(coopSession.code)}>Raum löschen</button>}<button className="mode-secondary quiet" onClick={leaveCoopRoom}>Verlassen</button></div></div>
            <div className="coop-world-tools waiting"><div><p className="eyebrow">WELTNAME</p>{coopSession.role === "host" ? <div className="coop-tool-input"><input className="mode-input" value={coopRoomName} maxLength={28} onChange={(event) => setCoopRoomName(event.target.value)} /><button className="mode-secondary" onClick={() => void renameCoopRoom()} disabled={coopBusy}>Speichern</button></div> : <strong>{coopSession.room.roomName}</strong>}</div><div><p className="eyebrow">LOBBY CODES</p><div className="coop-tool-input"><input className="mode-input bonus-code-input" value={lobbyBonusCode} maxLength={10} placeholder="Code eingeben" onChange={(event) => setLobbyBonusCode(event.target.value.toUpperCase())} /><button className="mode-primary" onClick={() => void redeemLobbyBonus()} disabled={coopBusy}>Einlösen</button></div></div></div>
            {coopSession.room.status !== "live" && <div className="coop-waiting-state">
              <div className="coop-waiting-icon"><Icon name="stadium" size={28} /></div>
              <div><p className="eyebrow">ANPFIFF VORBEREITET</p><h3>Warte auf den zweiten Spieler.</h3><p>Die gemeinsame Clicker-Ansicht startet ab zwei Personen. Danach können noch zwei weitere Spieler beitreten.</p></div>
              <div className="coop-players coop-waiting-players">{coopSession.room.players.map((player) => <div className={`coop-player-card${player.role === coopSession.role ? " you" : ""}${player.online ? " online" : ""}${!player.occupied ? " waiting" : ""}`} key={player.role}><span className="coop-player-tag">{player.role === coopSession.role ? `DU · ${coopRoleLabel(player.role)}` : coopRoleLabel(player.role)}</span><strong>{player.occupied ? player.name : "Wartet auf Beitritt …"}</strong><small>{player.occupied ? "Bereit für den Anpfiff" : "Raumcode teilen"}</small></div>)}</div>
            </div>}
          </div>}
          {coopMessage && <p className="mode-message" role="status">{coopMessage}</p>}
        </section>
      </main>}

      {displayGame.features.cup.active && displayGame.features.cup.phase === "penalties" && <div className={`cup-penalty-takeover ${displayGame.features.cup.penaltyTurn}`} role="dialog" aria-modal="true" aria-label="Elfmeterschiessen steuern">
        <div className="cup-penalty-panel">
          <div className="cup-penalty-topline"><span>POKAL / ELFMETERSCHIESSEN</span><b>{cupPenaltyIsSuddenDeath ? "SUDDEN DEATH" : "BEST OF FIVE"}</b></div>
          <div className="cup-penalty-match-score"><span>NACH 120′</span><strong>{displayClubName} {displayGame.features.cup.homeScore}:{displayGame.features.cup.awayScore} {displayGame.features.cup.opponent}</strong></div>
          <div className="cup-penalty-scoreboard">
            <div><small>DEIN CLUB</small><strong>{displayGame.features.cup.penaltyHomeScore}</strong><div className="cup-penalty-dots">{Array.from({ length: cupPenaltySlotCount }, (_, index) => { const event = cupPenaltyHomeEvents[index]; return <i className={!event ? "pending" : event.outcome === "goal" ? "goal" : "miss"} key={`home-penalty-${index}`}>{!event ? "" : event.outcome === "goal" ? "✓" : "×"}</i>; })}</div></div>
            <em>:</em>
            <div><small>GEGNER</small><strong>{displayGame.features.cup.penaltyAwayScore}</strong><div className="cup-penalty-dots">{Array.from({ length: cupPenaltySlotCount }, (_, index) => { const event = cupPenaltyAwayEvents[index]; return <i className={!event ? "pending" : event.outcome === "goal" ? "goal" : "miss"} key={`away-penalty-${index}`}>{!event ? "" : event.outcome === "goal" ? "✓" : "×"}</i>; })}</div></div>
          </div>
          <div className="cup-penalty-prompt"><span>{displayGame.features.cup.penaltyTurn === "home" ? "DU SCHIESST" : "DU BIST IM TOR"}</span><h2>{displayGame.features.cup.penaltyTurn === "home" ? "Wohin schiesst du?" : "Wohin springt dein Torwart?"}</h2><p>{displayGame.features.cup.penaltyMessage}</p></div>
          <div className="cup-penalty-goal" aria-label="Richtung wählen"><div className="cup-penalty-net" aria-hidden="true" />{(["left", "center", "right"] as CupPenaltyDirection[]).map((direction) => <button key={direction} className={direction} onClick={() => void takeCupPenalty(direction)} disabled={coopBusy}><span>{direction === "left" ? "↙" : direction === "right" ? "↘" : "↓"}</span><strong>{direction === "left" ? "LINKS" : direction === "right" ? "RECHTS" : "MITTE"}</strong><small>{displayGame.features.cup.penaltyTurn === "home" ? "SCHIESSEN" : "SPRINGEN"}</small></button>)}</div>
          <div className="cup-penalty-footer"><span>{coopBusy ? "VERSUCH WIRD AUSGEFÜHRT …" : isCoopLive ? "Die erste Eingabe zählt und erscheint sofort auf beiden Geräten." : "Du steuerst abwechselnd Schütze und Torwart."}</span><b>{displayGame.features.cup.penaltyHomeTaken + displayGame.features.cup.penaltyAwayTaken + 1}. VERSUCH</b></div>
        </div>
      </div>}
      {cupGoalAnnouncement && <div className={`cup-goal-takeover ${cupGoalAnnouncement.side}`} role="status" aria-live="assertive"><div className="cup-goal-card"><div className="cup-goal-confetti" aria-hidden="true">{GOAL_CONFETTI.map((particle, index) => <i key={index} style={{ left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration, background: particle.color }} />)}</div><span className="cup-goal-kicker">LIVE / TOOOOR</span><strong>{cupGoalAnnouncement.scorer}</strong><h2>TOR!</h2><p className="cup-goal-detail">{cupGoalAnnouncement.side === "home" ? `Treffer für ${displayClubName}.` : `Treffer für ${displayGame.features.cup.opponent}.`}</p><span className="cup-goal-minute">INGAME MINUTE {cupGoalAnnouncement.minute}′ · {cupGoalAnnouncement.homeScore}:{cupGoalAnnouncement.awayScore}</span><button className="event-takeover-dismiss" onClick={dismissCupGoal}>Weiter</button></div></div>}
      {starReveal && <div className={`star-reveal${starRevealIsWalkout ? " walkout-active" : ""}${starRevealIsRare ? " rare-active" : ""}`} role="dialog" aria-modal="true" aria-label="Star Pack geöffnet">
        <div className={`star-reveal-card${starRevealIsWalkout ? " star-reveal-walkout" : ""}${starRevealIsIconic ? " star-reveal-iconic" : ""}${starRevealIsLegendary ? " star-reveal-legendary" : ""}${starRevealIsRare ? " star-reveal-rare" : ""}`} style={{ borderColor: `${starReveal.player.accent}55` }}>
          {starRevealIsWalkout ? <>
            <span className="star-reveal-walkout-label">{starRevealIsLegendary ? "LEGENDÄRER WALKOUT · EINZIGARTIG" : starRevealIsIconic ? "ICON WALKOUT · SILBER" : "WALKOUT · 86+"}</span>
            <span className="star-reveal-kicker">{starReveal.packName} / STADION ENTHÜLLUNG</span>
            <div className="star-walkout-stage" aria-live="assertive" style={starWalkoutStyle}>
              <div className="star-walkout-smoke" aria-hidden="true" />
              <div className="star-walkout-beams" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
              <div className="star-walkout-doors" aria-hidden="true"><i /><i /></div>
              <div className="star-walkout-confetti" aria-hidden="true">{GOAL_CONFETTI.map((particle, index) => <i key={index} style={{ left: particle.left, animationDelay: `calc(${900 + index * 28}ms + var(--walkout-delay, 0ms))`, animationDuration: particle.duration, background: starWalkoutConfetti ? starWalkoutConfetti[index % starWalkoutConfetti.length] : particle.color }} />)}</div>
              {starWalkoutPresentation && <>
                <div className="star-walkout-country"><WalkoutCountryFlag code={starWalkoutPresentation.countryCode} country={starWalkoutPresentation.country} /><strong>{starWalkoutPresentation.country}</strong><small>{starWalkoutPresentation.countryCode}</small></div>
                <div className="star-walkout-rating-panel"><span>{formatStarXIPositions(starReveal.player)}</span><strong>{starReveal.player.rating}</strong><em>{starRevealIsLegendary ? "LEGENDÄRE KARTE" : starRevealIsIconic ? "ICON KARTE" : "WALKOUT KARTE"}</em></div>
                <div className={`star-walkout-avatar-wrap hair-${starWalkoutPresentation.hair} beard-${starWalkoutPresentation.beard} face-${starWalkoutPresentation.face} celebration-${starWalkoutPresentation.celebration}`} aria-label={`Ganzkörper Figur von ${starReveal.player.name}`}>
                  <div className="star-walkout-avatar">
                    <div className="avatar-head"><i className="avatar-ear left" /><i className="avatar-ear right" /><i className="avatar-hair" /><i className="avatar-brow left" /><i className="avatar-brow right" /><i className="avatar-eye left" /><i className="avatar-eye right" /><i className="avatar-nose" /><i className="avatar-mouth" /><i className="avatar-beard" /></div>
                    <div className="avatar-neck" />
                    <div className="avatar-torso"><i className="avatar-kit-stripe" /><span>{starReveal.player.rating}</span></div>
                    <div className="avatar-arm left"><i /></div><div className="avatar-arm right"><i /></div>
                    <div className="avatar-leg left"><i /></div><div className="avatar-leg right"><i /></div>
                  </div>
                </div>
                <div className="star-walkout-nameplate"><span><WalkoutCountryFlag compact code={starWalkoutPresentation.countryCode} country={starWalkoutPresentation.country} /> {starWalkoutPresentation.countryCode} · {formatStarXIPositions(starReveal.player)}</span><h2>{starReveal.player.name}</h2></div>
              </>}
            </div>
            <p className={`star-walkout-copy${starWalkoutReady ? " ready" : ""}`}>{`${isCoopLive ? `${starReveal.openedBy} hat das Pack geöffnet. ` : ""}${starReveal.duplicate ? `Doppelt gezogen. Du bekommst ${formatNumber(starReveal.compensation)} Tore Entschädigung.` : `${formatStarXIPositions(starReveal.player)} · Rating ${starReveal.player.rating}. Der Walkout gehört jetzt deinem Club.`}`}</p>
            <span className={`star-reveal-status star-walkout-status${starWalkoutReady ? " ready" : ""}`}>{starWalkoutReady ? starReveal.duplicate ? "DOPPELT · ENTSCHÄDIGUNG" : starRevealIsLegendary ? "LEGENDÄR · STAR XI" : starRevealIsIconic ? "ICON · STAR XI" : "WALKOUT · STAR XI" : "WALKOUT LÄUFT"}</span>
            <button className={`event-takeover-dismiss star-walkout-dismiss${starWalkoutReady ? " ready" : ""}`} disabled={!starWalkoutReady} onClick={dismissStarReveal}>{starWalkoutReady ? starReveal.duplicate || isCoopLive ? "Weiter" : "In Star XI übernehmen" : "Walkout läuft …"}</button>
          </> : starRevealIsRare ? <>
            <span className="star-reveal-walkout-label">SELTENE KARTE · 80 BIS 85</span>
            <span className="star-reveal-kicker">PACK GEÖFFNET / {starReveal.packName}</span>
            <div className="star-rare-stage" style={starWalkoutStyle} aria-live="assertive">
              <div className="star-rare-sparkles" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 96}%`, top: `${8 + (index * 23) % 78}%`, animationDelay: `calc(${index * 70}ms + var(--rare-delay, 0ms))` }} />)}</div>
              <div className="star-rare-card"><span>{formatStarXIPositions(starReveal.player)}</span><strong>{starReveal.player.rating}</strong><small>SELTEN</small><h2>{starReveal.player.name}</h2></div>
            </div>
            <p className={`star-walkout-copy${starWalkoutReady ? " ready" : ""}`}>{`${isCoopLive ? `${starReveal.openedBy} hat das Pack geöffnet. ` : ""}${starReveal.duplicate ? `Doppelt gezogen. Du bekommst ${formatNumber(starReveal.compensation)} Tore Entschädigung.` : `${formatStarXIPositions(starReveal.player)} · Rating ${starReveal.player.rating}. Seltene Karte für deinen Club.`}`}</p>
            <span className={`star-reveal-status star-walkout-status${starWalkoutReady ? " ready" : ""}`}>{starWalkoutReady ? starReveal.duplicate ? "DOPPELT · ENTSCHÄDIGUNG" : "SELTEN · STAR XI" : "SELTENE KARTE"}</span>
            <button className={`event-takeover-dismiss star-walkout-dismiss${starWalkoutReady ? " ready" : ""}`} disabled={!starWalkoutReady} onClick={dismissStarReveal}>{starWalkoutReady ? starReveal.duplicate || isCoopLive ? "Weiter" : "In Star XI übernehmen" : "Karte wird enthüllt …"}</button>
          </> : <>
            <span className="star-reveal-kicker">PACK GEÖFFNET / {starReveal.packName}</span>
            <div className="star-reveal-player"><span style={{ color: starReveal.player.accent }}>{formatStarXIPositions(starReveal.player, true)}</span><strong>{starReveal.player.rating}</strong></div>
            <h2>{starReveal.player.name}</h2>
            <p>{`${isCoopLive ? `${starReveal.openedBy} hat das Pack geöffnet. ` : ""}${starReveal.duplicate ? `Doppelt gezogen. Du bekommst ${formatNumber(starReveal.compensation)} Tore Entschädigung.` : `${formatStarXIPositions(starReveal.player)} · Rating ${starReveal.player.rating}. Der Spieler wird nur auf passenden Positionen eingesetzt.`}`}</p>
            <span className="star-reveal-status">{starReveal.duplicate ? "DOPPELT · ENTSCHÄDIGUNG" : starReveal.player.rating <= 70 ? "GEWÖHNLICHE KARTE" : "PROFI KARTE · STAR XI"}</span>
            <button className="event-takeover-dismiss" onClick={dismissStarReveal}>{starReveal.duplicate || isCoopLive ? "Weiter" : "In Star XI übernehmen"}</button>
          </>}
        </div>
      </div>}
      {eventAnnouncement && <div className={`event-takeover ${eventAnnouncement.tone}${eventAnnouncement.id === "elefantino" ? " elefantino" : ""}`} role="dialog" aria-modal="true" aria-label={eventAnnouncement.id === "var" ? "VAR Entscheidung" : eventAnnouncement.title}><div className="event-takeover-card"><span className="event-takeover-kicker">{eventAnnouncement.id === "var" ? "VAR / ENTSCHEIDUNG" : eventAnnouncement.id === "elefantino" ? "WELTFUSSBALL / NOTFALLSITZUNG" : "STADION / LIVE EREIGNIS"}</span><strong>{eventAnnouncement.id === "var" ? "VAR prüft." : eventAnnouncement.id === "elefantino" ? "Der Präsident ist da." : eventAnnouncement.title}</strong><h2>{eventAnnouncement.id === "var" ? (eventAnnouncement.amount < 0 ? "Tor aberkannt." : "Tor zählt doch.") : eventAnnouncement.id === "elefantino" ? "ALLES WEG." : eventAnnouncement.title}</h2><p>{eventAnnouncement.message}</p><span className="event-takeover-amount">{eventAnnouncement.amount < 0 ? `−${formatNumber(Math.abs(eventAnnouncement.amount))} TORE` : eventAnnouncement.amount > 0 ? `+${formatNumber(eventAnnouncement.amount)} TORE` : eventAnnouncement.id === "elefantino" ? "KONTO WAR SCHON LEER" : "KEINE ÄNDERUNG"}</span><button className="event-takeover-dismiss" onClick={dismissEventAnnouncement}>Weiter</button></div></div>}
      {offline && <div className="offline-banner"><span className="offline-mark">Ⅱ</span><p>{offline}</p><button onClick={() => setOffline("")} aria-label="Hinweis schliessen">×</button></div>}
      <footer className="footer-note">Klick den Ball · Kauf Verstärkungen · Werde Fussballgott · Made by xevihans und AntiNicu67</footer>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

class GameErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : "Unbekannter Startfehler" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Goal Clicker konnte den Spielstand nicht darstellen.", error, info);
  }

  private reload = () => window.location.reload();

  private returnToSingleplayer = () => {
    localStorage.removeItem(COOP_ROOM_KEY);
    window.location.reload();
  };

  private repair = () => {
    if (!window.confirm("Wirklich alle lokalen Goal-Clicker-Daten löschen und komplett neu starten?")) return;
    for (const key of Object.keys(localStorage)) if (key.startsWith("goalClicker")) localStorage.removeItem(key);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="game-recovery"><section><span className="eyebrow">GOAL CLICKER / WIEDERHERSTELLUNG</span><h1>Das Spiel konnte nicht gestartet werden.</h1><p>Dein gespeicherter Spielstand bleibt erhalten. Lade zuerst nochmals oder wechsle zum Singleplayer. Löschen passiert nur noch nach deiner ausdrücklichen Bestätigung.</p><small className="game-recovery-code">Fehler: {this.state.message}</small><div><button type="button" className="mode-secondary" onClick={this.reload}>Nochmals laden</button><button type="button" className="mode-secondary" onClick={this.returnToSingleplayer}>Zum Singleplayer</button><button type="button" className="mode-primary" onClick={this.repair}>Komplett neu starten</button></div></section></main>;
  }
}

export default function Home() { return <GameErrorBoundary><App /></GameErrorBoundary>; }
