// Small per device preferences (buy mode, filters, viewer settings, savings goal). Every read validates what it
// finds and falls back to the default; blocked storage only means the choice lasts for this visit.
import type { PurchaseMode } from "../game/types";
import { PURCHASE_MODES } from "../game/constants";

export const PREF_KEYS = {
  purchaseMode: "goal-clicker-purchase-mode",
  tournament: "goal-clicker-last-tournament",
  reserveFilters: "goal-clicker-reserve-filters",
  albumFilters: "goal-clicker-album-filters",
  careerFilters: "goal-clicker-career-filters",
  viewer: "goal-clicker-match-viewer",
  savingsGoal: "goal-clicker-savings-goal",
  stadiumSound: "goal-clicker-stadium-sound",
  notifications: "goal-clicker-notifications",
  historySeenAt: "goal-clicker-history-seen-at",
  squadSeen: "goal-clicker-squad-seen",
  feedExpanded: "goal-clicker-feed-expanded",
} as const;

export function readPref(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); } catch { return null; }
}

export function writePref(key: string, value: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* only this visit remembers it */ }
}

export function readJsonPref<T>(key: string, parse: (value: unknown) => T): T {
  const raw = readPref(key);
  let value: unknown = undefined;
  try { value = raw ? JSON.parse(raw) : undefined; } catch { value = undefined; }
  return parse(value);
}

export function writeJsonPref(key: string, value: unknown) {
  writePref(key, JSON.stringify(value));
}

export function parsePurchaseMode(raw: string | null): PurchaseMode {
  const mode = raw === "max" ? "max" : Number(raw);
  return PURCHASE_MODES.includes(mode as PurchaseMode) ? mode as PurchaseMode : 1;
}

/** Keeps known string fields of a saved filter object, everything else gets its default. */
export function pickStringFields<T extends Record<string, string | boolean>>(value: unknown, defaults: T, allowed: Partial<Record<keyof T, readonly string[]>> = {}): T {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const raw = source[key as string];
    const fallback = defaults[key];
    if (typeof fallback === "boolean") { if (typeof raw === "boolean") result[key] = raw as T[keyof T]; continue; }
    if (typeof raw !== "string" || raw.length > 80) continue;
    const options = allowed[key];
    if (options && !options.includes(raw)) continue;
    result[key] = raw as T[keyof T];
  }
  return result;
}

/** A pinned savings goal: an upgrade or a pack the club saves for. */
export type SavingsGoal = { kind: "upgrade" | "pack"; id: string };
export function parseSavingsGoal(value: unknown): SavingsGoal | null {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : null;
  if (!source || (source.kind !== "upgrade" && source.kind !== "pack") || typeof source.id !== "string" || source.id.length > 60) return null;
  return { kind: source.kind, id: source.id };
}
