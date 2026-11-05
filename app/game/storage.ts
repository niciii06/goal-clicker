// Local save handling, normalisation of stored games and mini game cooldowns.
import type { GameState, LayoutCardId, MiniGameCooldowns, MiniGameId } from "./types";
import { ACHIEVEMENTS, BACKUP_STORAGE_KEY, BALANCE_VERSION, DEFAULT_LAYOUT_ORDER, LAYOUT_CARD_IDS, LEGACY_STORAGE_KEYS, MAX_SEASON_STARS, MINI_GAME_COOLDOWN_SECONDS, MINI_GAME_IDS, RECOVERY_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { compareStoredGameProgress, parseStoredGame, selectSafestStoredGame, shouldRejectRegressedSave } from "../save-safety";
import { getPassiveIncomePower, normalizeUpgrades } from "./economy";
import { getGoalBoostedPassiveReward, initialGameFeatures, normalizeGameFeatures } from "../feature-data";
import { bumpSaveRevision, readSaveRevision, SAVE_WRITER_KEY, setLocalSaveFailed } from "./save-revision";
import { isGameFromNewerVersion } from "./save-schema";
import { getCurrentTime } from "./clock";

/**
 * The most passive income a hidden tab earns when it comes back (or saves in the background): 8 hours. The time
 * itself is measured with the monotonic clock (app/game/clock.ts), so changing the system clock earns nothing.
 */
export const MAX_BACKGROUND_CATCH_UP_MS = 8 * 60 * 60_000;

export function normalizeLayoutOrder(value: unknown) {
  const saved = Array.isArray(value) ? value.filter((id): id is LayoutCardId => typeof id === "string" && LAYOUT_CARD_IDS.includes(id as LayoutCardId)) : [];
  return [...new Set(saved), ...DEFAULT_LAYOUT_ORDER.filter((id) => !saved.includes(id))];
}

export function initialMiniGameCooldowns(): MiniGameCooldowns {
  return { penalty: 0, dribble: 0, crossbar: 0, prediction: 0 };
}

export function normalizeMiniGameCooldowns(cooldowns: Partial<MiniGameCooldowns> | undefined): MiniGameCooldowns {
  const normalized = initialMiniGameCooldowns();
  for (const id of MINI_GAME_IDS) normalized[id] = Math.max(0, Number(cooldowns?.[id]) || 0);
  return normalized;
}

export function readStoredGame() {
  const safest = selectSafestStoredGame([
    { key: STORAGE_KEY, raw: localStorage.getItem(STORAGE_KEY) },
    { key: BACKUP_STORAGE_KEY, raw: localStorage.getItem(BACKUP_STORAGE_KEY) },
    { key: RECOVERY_STORAGE_KEY, raw: localStorage.getItem(RECOVERY_STORAGE_KEY) },
    ...LEGACY_STORAGE_KEYS.map((key) => ({ key, raw: localStorage.getItem(key) })),
  ]);
  return { saved: safest?.saved as Partial<GameState> | undefined, recovered: Boolean(safest && safest.key !== STORAGE_KEY) };
}

let persistenceSuspended = false;

// Several tabs share one localStorage. Only one of them saves at a time (the one last used), and a tab that
// loaded an older revision than the stored one must load the newer save before it may write again.
const TAB_ID = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const WRITER_FRESH_MS = 3 * 60_000;
let knownRevision = 0;

/**
 * What a save attempt did. "stale": another tab saved since this one loaded; it has to load that save first.
 * "outdated": the stored game comes from a newer version of the game; this page must not write over it.
 */
export type LocalSaveResult = "saved" | "kept" | "stale" | "other-tab" | "failed" | "suspended" | "outdated";

/** Remembers the revision this tab just loaded; call it right after reading the stored game at start. */
export function markLocalSaveLoaded() {
  try {
    knownRevision = readSaveRevision(localStorage);
  } catch {
    knownRevision = 0;
  }
}

function otherWriterActive(now: number) {
  try {
    const writer = JSON.parse(localStorage.getItem(SAVE_WRITER_KEY) ?? "null") as { id?: unknown; at?: unknown } | null;
    return Boolean(writer && writer.id !== TAB_ID && now - Number(writer.at) < WRITER_FRESH_MS);
  } catch {
    return false;
  }
}

function markWriter(now: number) {
  localStorage.setItem(SAVE_WRITER_KEY, JSON.stringify({ id: TAB_ID, at: now }));
}

/** Whether this tab is the one that saves right now. */
export function isLocalSaveWriter() {
  try {
    const writer = JSON.parse(localStorage.getItem(SAVE_WRITER_KEY) ?? "null") as { id?: unknown } | null;
    return writer?.id === TAB_ID;
  } catch {
    return false;
  }
}

/** Makes this tab the one that saves, when the player uses it. "stale": it must load the newer save first. */
export function claimLocalSave(now = Date.now()): "ok" | "stale" {
  try {
    if (readSaveRevision(localStorage) > knownRevision) return "stale";
    markWriter(now);
  } catch {
    // Without storage there is nothing to coordinate.
  }
  return "ok";
}

/** Stops all autosaves until the page reloads, so an imported save file is not overwritten on the way out. */
export function suspendLocalPersistence() {
  persistenceSuspended = true;
}

/** Saves again after an import that did not go through; the previous game is still the one in storage. */
export function resumeLocalPersistence() {
  persistenceSuspended = false;
}

/** Forgets every stored copy of the game, including backups and old save versions, so a reset stays a reset. */
export function clearStoredGames() {
  for (const key of [STORAGE_KEY, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) localStorage.removeItem(key);
  // Other tabs still hold the old game; the new revision keeps them from saving it back.
  try {
    knownRevision = bumpSaveRevision(localStorage);
    markWriter(Date.now());
  } catch {
    // The reset itself went through.
  }
}

export function persistLocalGame(state: GameState): LocalSaveResult {
  if (persistenceSuspended) return "suspended";
  const now = Date.now();
  try {
    // A tab in the background leaves the save to the tab in use; it only catches up once it is used itself.
    if (otherWriterActive(now)) return "other-tab";
    if (readSaveRevision(localStorage) > knownRevision) return "stale";
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    // Normalizing would drop what the newer version stored; the stored game stays exactly as it is.
    if (isGameFromNewerVersion(currentRaw)) return "outdated";
    const current = parseStoredGame(currentRaw);
    // A stale tab cannot restore an already consumed reward receipt.
    if(current?.features){const saved=normalizeGameFeatures(current.features);for(const receipt of saved.earnedPacks){const next=state.features.earnedPacks.find(p=>p.id===receipt.id);if(next&&receipt.opening&&!next.opening)next.opening=receipt.opening;else if(!next)state.features.earnedPacks.push(receipt);}state.features.completedTournamentRuns=[...new Set([...state.features.completedTournamentRuns,...saved.completedTournamentRuns])];}
    const nextRaw = JSON.stringify(state);
    const next = parseStoredGame(nextRaw);
    if (shouldRejectRegressedSave(current, next)) {
      if (currentRaw) localStorage.setItem(BACKUP_STORAGE_KEY, currentRaw);
      setLocalSaveFailed(false);
      return "kept";
    }
    const backupRaw = localStorage.getItem(BACKUP_STORAGE_KEY);
    const backup = parseStoredGame(backupRaw);
    if (currentRaw && current && (!backup || compareStoredGameProgress(current, backup) >= 0)) {
      if (backupRaw && backup) localStorage.setItem(RECOVERY_STORAGE_KEY, backupRaw);
      localStorage.setItem(BACKUP_STORAGE_KEY, currentRaw);
    }
    localStorage.setItem(STORAGE_KEY, nextRaw);
    knownRevision = bumpSaveRevision(localStorage);
    markWriter(now);
    setLocalSaveFailed(false);
    return "saved";
  } catch {
    // A full browser storage must never crash the game or replace a valid save, but it must not look saved either.
    setLocalSaveFailed(true);
    return "failed";
  }
}

export function pauseMiniGameCooldowns(cooldowns: Partial<MiniGameCooldowns> | undefined, pausedMs: number, pausedAt: number) {
  const shifted = normalizeMiniGameCooldowns(cooldowns);
  for (const id of MINI_GAME_IDS) if (shifted[id] > pausedAt) shifted[id] += pausedMs;
  return shifted;
}

/**
 * How much hidden time to pay out now. `hiddenAt` is the monotonic reading of the last payout (or of hiding the
 * tab), `budgetMs` what is left of this hidden period's MAX_BACKGROUND_CATCH_UP_MS. A tab hidden for days still
 * earns at most the budget in total, however often it saves in the background.
 */
export function takeBackgroundTime(hiddenAt: number | null, budgetMs: number, now: number) {
  if (hiddenAt === null || !Number.isFinite(hiddenAt) || !Number.isFinite(now)) return { elapsedMs: 0, budgetMs };
  const elapsedMs = Math.min(Math.max(0, budgetMs), Math.max(0, now - hiddenAt));
  return { elapsedMs, budgetMs: Math.max(0, budgetMs - elapsedMs) };
}

/** Adds the passive income of a hidden tab for `elapsedMs` (monotonic), at most MAX_BACKGROUND_CATCH_UP_MS. */
export function advanceLocalGameWhileOpen(state: GameState, elapsedMs: number, now = Date.now()): GameState {
  const durationMs = Math.min(MAX_BACKGROUND_CATCH_UP_MS, Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  if (!durationMs) return { ...state, lastSaved: now };
  const passiveReward = getGoalBoostedPassiveReward(getPassiveIncomePower(state.upgrades, state.stars, state.features), state.features, now - durationMs, now);
  return {
    ...state,
    goals: state.goals + passiveReward,
    seasonGoals: state.seasonGoals + passiveReward,
    totalGoals: state.totalGoals + passiveReward,
    lastSaved: now,
  };
}

/** Written with the same session clock the cooldown is checked with (getCurrentTime), not the wall clock. */
export function getMiniGameCooldownUntil(id: MiniGameId, now = getCurrentTime()) {
  return now + MINI_GAME_COOLDOWN_SECONDS[id] * 1000;
}

export function normalizeAchievements(value: unknown) {
  if (!Array.isArray(value)) return [];
  const knownIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
  return [...new Set(value.filter((id): id is string => typeof id === "string" && knownIds.has(id)))];
}

export function initialGame(): GameState {
  return { goals: 0, totalGoals: 0, seasonGoals: 0, clicks: 0, upgrades: {}, achievements: [], stars: 0, seasons: 0, balanceVersion: BALANCE_VERSION, sound: true, lastSaved: Date.now(), miniGameCooldowns: initialMiniGameCooldowns(), minigameWins: 0, features: initialGameFeatures() };
}

export function normalizeRuntimeGame(value: unknown, soundFallback = true): GameState {
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

export function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 18);
}
