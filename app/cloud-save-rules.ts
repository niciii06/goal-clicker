// Which localStorage keys travel with the account's cloud save. Shared by the browser sync and the API.
// Device specific keys stay local: the player ID comes from the account, the backups are copies of the
// main save, and the active world and nickname are set per device.
import { LAYOUT_STORAGE_KEY, STORAGE_KEY, VIBRATION_STORAGE_KEY, WHATS_NEW_STORAGE_KEY } from "./game/constants";

export const SYNCED_SAVE_KEYS = [STORAGE_KEY, LAYOUT_STORAGE_KEY, VIBRATION_STORAGE_KEY, WHATS_NEW_STORAGE_KEY] as const;
export const MAX_CLOUD_SAVE_BYTES = 2 * 1024 * 1024;

export type CloudSaveKeys = Partial<Record<(typeof SYNCED_SAVE_KEYS)[number], string>>;

/** Only the synced keys with string values, or null when the game itself is missing or broken. */
export function cleanCloudSaveKeys(value: unknown): CloudSaveKeys | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const keys: CloudSaveKeys = {};
  for (const key of SYNCED_SAVE_KEYS) if (typeof source[key] === "string") keys[key] = source[key];
  const game = keys[STORAGE_KEY];
  if (!game) return null;
  try {
    const parsed = JSON.parse(game) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  } catch {
    return null;
  }
  return keys;
}

/** Same keys in the same order give the same text, so devices can compare saves by hash. */
export function serializeCloudSaveKeys(keys: CloudSaveKeys) {
  return JSON.stringify(Object.fromEntries(SYNCED_SAVE_KEYS.filter((key) => keys[key] !== undefined).map((key) => [key, keys[key]])));
}

/** FNV-1a, enough to notice that a save changed since the last upload. */
export function hashText(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export type SaveSummary = { totalGoals: number; seasons: number; stars: number; clicks: number };

/** The numbers a player recognises a save by, for the choice between two saves. */
export function summarizeSave(keys: CloudSaveKeys | null): SaveSummary | null {
  const game = keys?.[STORAGE_KEY];
  if (!game) return null;
  try {
    const parsed = JSON.parse(game) as Record<string, unknown>;
    const number = (value: unknown) => Math.max(0, Number(value) || 0);
    return { totalGoals: number(parsed.totalGoals), seasons: Math.floor(number(parsed.seasons)), stars: Math.floor(number(parsed.stars)), clicks: Math.floor(number(parsed.clicks)) };
  } catch {
    return null;
  }
}

/** A save worth keeping: someone clicked or earned a goal. */
export function hasProgress(summary: SaveSummary | null) {
  return Boolean(summary && (summary.totalGoals > 0 || summary.clicks > 0 || summary.seasons > 0));
}
