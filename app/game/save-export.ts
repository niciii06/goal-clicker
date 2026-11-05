// "Spielstand als Datei sichern" and loading such a file again. The file holds the same keys the cloud save holds
// (app/cloud-save-rules.ts), so it works with and without an account. An import never replaces the game silently:
// the file is checked first, the player sees what it holds and confirms, and the current game is saved as a file
// and kept as the local backup before it is replaced.
import { BACKUP_STORAGE_KEY, LEGACY_STORAGE_KEYS, RECOVERY_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { cleanCloudSaveKeys, hasProgress, readSaveSchemaVersion, serializeCloudSaveKeys, summarizeSave, SYNCED_SAVE_KEYS } from "../cloud-save-rules";
import type { CloudSaveKeys, SaveSummary } from "../cloud-save-rules";
import { isSaveFromNewerVersion } from "./save-schema";
import { bumpSaveRevision } from "./save-revision";

export const SAVE_FILE_FORMAT = "goal-clicker-save";
export const SAVE_FILE_FORMAT_VERSION = 1;
/** A save file is a few hundred KB; anything far larger is not one. */
export const MAX_SAVE_FILE_BYTES = 8 * 1024 * 1024;

export type SaveFile = { format: typeof SAVE_FILE_FORMAT; formatVersion: number; exportedAt: string; schemaVersion: number; keys: CloudSaveKeys };
export type ParsedSaveFile = { ok: true; keys: CloudSaveKeys; summary: SaveSummary; exportedAt: string | null } | { ok: false; error: string };

type KeyStorage = Pick<Storage, "getItem">;

/**
 * The synced keys of this browser. `currentGame` is the game as the running page holds it: when the browser
 * storage is full, the stored game is older than what is on screen, and the file must hold the newer one.
 */
export function collectSaveKeys(storage: KeyStorage, currentGame?: unknown): CloudSaveKeys {
  const keys: CloudSaveKeys = {};
  for (const key of SYNCED_SAVE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) keys[key] = value;
  }
  if (currentGame && typeof currentGame === "object") keys[STORAGE_KEY] = JSON.stringify(currentGame);
  return keys;
}

export function buildSaveFile(keys: CloudSaveKeys, now = new Date()): SaveFile {
  const clean = cleanCloudSaveKeys(keys) ?? {};
  return { format: SAVE_FILE_FORMAT, formatVersion: SAVE_FILE_FORMAT_VERSION, exportedAt: now.toISOString(), schemaVersion: readSaveSchemaVersion(clean), keys: JSON.parse(serializeCloudSaveKeys(clean)) as CloudSaveKeys };
}

export function saveFileName(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `goal-clicker-spielstand-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/** Checks a chosen file before anything is replaced; the answer says in German what is wrong with it. */
export function parseSaveFile(text: string): ParsedSaveFile {
  if (text.length > MAX_SAVE_FILE_BYTES) return { ok: false, error: "Die Datei ist zu gross für einen Spielstand." };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "Die Datei ist kein Goal Clicker Spielstand." };
  }
  const file = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<SaveFile> : null;
  if (!file || file.format !== SAVE_FILE_FORMAT) return { ok: false, error: "Die Datei ist kein Goal Clicker Spielstand." };
  if (Number(file.formatVersion) > SAVE_FILE_FORMAT_VERSION) return { ok: false, error: "Diese Datei stammt aus einer neueren Version. Bitte lade die Seite neu und versuche es nochmal." };
  const keys = cleanCloudSaveKeys(file.keys);
  if (!keys) return { ok: false, error: "In der Datei fehlt der Spielstand oder er ist beschädigt." };
  if (isSaveFromNewerVersion(keys)) return { ok: false, error: "Dieser Spielstand stammt aus einer neueren Version. Bitte lade die Seite neu und versuche es nochmal." };
  const summary = summarizeSave(keys);
  if (!summary || !hasProgress(summary)) return { ok: false, error: "Die Datei enthält keinen Fortschritt." };
  return { ok: true, keys, summary, exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : null };
}

type ReplaceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Replaces this browser's game with an imported one. The previous main game becomes the local backup (and the
 * previous backup the recovery copy), so it stays in this browser as long as the imported game is not further
 * along. On a full storage everything is put back and the error is thrown.
 */
export function replaceLocalSave(storage: ReplaceStorage, keys: CloudSaveKeys) {
  const incoming = cleanCloudSaveKeys(keys);
  if (!incoming) throw new Error("Der Spielstand ist unvollständig.");
  const touched = [...SYNCED_SAVE_KEYS, BACKUP_STORAGE_KEY, RECOVERY_STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
  const previous = touched.flatMap((key) => { const value = storage.getItem(key); return value === null ? [] : [[key, value] as const]; });
  const previousGame = storage.getItem(STORAGE_KEY);
  const previousBackup = storage.getItem(BACKUP_STORAGE_KEY);
  try {
    for (const key of touched) storage.removeItem(key);
    if (previousBackup !== null) storage.setItem(RECOVERY_STORAGE_KEY, previousBackup);
    if (previousGame !== null) storage.setItem(BACKUP_STORAGE_KEY, previousGame);
    for (const [key, value] of Object.entries(incoming)) if (value !== undefined) storage.setItem(key, value);
    // Other open tabs still hold the replaced game and must not save it back.
    bumpSaveRevision(storage);
  } catch (error) {
    for (const key of touched) storage.removeItem(key);
    for (const [key, value] of previous) { try { storage.setItem(key, value); } catch { /* keep restoring the rest */ } }
    throw error;
  }
}

/** Offers the save as a file download in the browser. Returns false where the browser refused. */
export function downloadSaveFile(keys: CloudSaveKeys, now = new Date()) {
  try {
    const blob = new Blob([JSON.stringify(buildSaveFile(keys, now))], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = saveFileName(now);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    return false;
  }
}
