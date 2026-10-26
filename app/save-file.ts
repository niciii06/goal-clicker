// Single player saves live in localStorage under goalClicker keys, which a new domain cannot see.
// A save file carries every such key, including the player ID that links multiplayer worlds.
export const SAVE_FILE_FORMAT = "goal-clicker-save";
export const SAVE_FILE_VERSION = 1;
export const SAVE_KEY_PREFIX = "goalClicker";
const MAX_SAVE_FILE_BYTES = 8 * 1024 * 1024;
/** One of these must be present, otherwise the file holds no game. */
const GAME_KEYS = ["goalClickerSiteSaveV3", "goalClickerSiteSaveBackupV3", "goalClickerSiteSaveV2", "goalClickerSiteSave", "goalClickerSave"];
/** The keys present before the last import, so an import can be undone by hand. */
export const PRE_IMPORT_BACKUP_KEY = "goalClickerBeforeImportV1";
// Which account and cloud version this browser holds; it belongs to the device, not to a save.
const DEVICE_KEYS = new Set(["goalClickerCloudMetaV1", "goalClickerProfileCacheV1"]);

export type SaveFile = { format: typeof SAVE_FILE_FORMAT; version: number; exportedAt: string; origin: string; keys: Record<string, string> };
type KeyStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

function saveKeys(storage: Pick<Storage, "length" | "key">) {
  return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key?.startsWith(SAVE_KEY_PREFIX)) && key !== PRE_IMPORT_BACKUP_KEY && !DEVICE_KEYS.has(key ?? ""));
}

export function createSaveFile(storage: Pick<Storage, "length" | "key" | "getItem">, origin: string, now = new Date()): SaveFile {
  const keys = Object.fromEntries(saveKeys(storage).map((key) => [key, storage.getItem(key) ?? ""]));
  return { format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, exportedAt: now.toISOString(), origin, keys };
}

export function saveFileName(now = new Date()) {
  return `goal-clicker-spielstand-${now.toISOString().slice(0, 10)}.json`;
}

export function parseSaveFile(text: string): { ok: true; file: SaveFile } | { ok: false; error: string } {
  if (text.length > MAX_SAVE_FILE_BYTES) return { ok: false, error: "Die Datei ist zu gross für einen Spielstand." };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "Die Datei ist kein Goal Clicker Spielstand." };
  }
  const file = value as Partial<SaveFile>;
  if (!file || typeof file !== "object" || file.format !== SAVE_FILE_FORMAT) return { ok: false, error: "Die Datei ist kein Goal Clicker Spielstand." };
  if (file.version !== SAVE_FILE_VERSION) return { ok: false, error: "Diese Spielstand Version wird nicht unterstützt." };
  if (!file.keys || typeof file.keys !== "object" || Array.isArray(file.keys)) return { ok: false, error: "Der Spielstand ist unvollständig." };
  const entries = Object.entries(file.keys);
  if (entries.some(([key, raw]) => !key.startsWith(SAVE_KEY_PREFIX) || key === PRE_IMPORT_BACKUP_KEY || DEVICE_KEYS.has(key) || typeof raw !== "string")) return { ok: false, error: "Der Spielstand enthält unerwartete Einträge." };
  const game = GAME_KEYS.map((key) => file.keys![key]).find((raw) => typeof raw === "string");
  if (!game) return { ok: false, error: "Im Spielstand fehlt das Spiel." };
  // The game must be a game: an object with a goal count, not null, a number or a list.
  let parsedGame: unknown;
  try {
    parsedGame = JSON.parse(game);
  } catch {
    return { ok: false, error: "Der Spielstand ist beschädigt." };
  }
  const goals = parsedGame && typeof parsedGame === "object" && !Array.isArray(parsedGame) ? (parsedGame as { totalGoals?: unknown; goals?: unknown }) : null;
  if (!goals || !Number.isFinite(Number(goals.totalGoals ?? goals.goals))) return { ok: false, error: "Der Spielstand ist beschädigt." };
  return { ok: true, file: { format: SAVE_FILE_FORMAT, version: SAVE_FILE_VERSION, exportedAt: String(file.exportedAt ?? ""), origin: String(file.origin ?? ""), keys: Object.fromEntries(entries) as Record<string, string> } };
}

/** Replaces every goalClicker key with the file's keys and keeps the previous ones under PRE_IMPORT_BACKUP_KEY. */
export function applySaveFile(storage: KeyStorage, file: SaveFile) {
  const previous = Object.fromEntries(saveKeys(storage).map((key) => [key, storage.getItem(key) ?? ""]));
  for (const key of Object.keys(previous)) storage.removeItem(key);
  try {
    for (const [key, raw] of Object.entries(file.keys)) storage.setItem(key, raw);
  } catch (error) {
    // Storage full: put the previous game back untouched.
    for (const key of saveKeys(storage)) storage.removeItem(key);
    for (const [key, raw] of Object.entries(previous)) storage.setItem(key, raw);
    throw error;
  }
  try {
    storage.setItem(PRE_IMPORT_BACKUP_KEY, JSON.stringify(previous));
  } catch {
    // The backup is a convenience; a full storage must not undo the import.
  }
}

/** The player ID inside a save file, if any. */
export function savedPlayerId(file: SaveFile) {
  return file.keys.goalClickerPlayerIdV3 ?? file.keys.goalClickerPlayerIdV2 ?? file.keys.goalClickerPlayerId ?? "";
}
