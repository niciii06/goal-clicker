// Client helpers for coop rooms: roles, saved rooms and API requests.
import type { CoopApiResponse, CoopRole, CoopRoom, GameState } from "./types";
import type { GameFeatures } from "../feature-data";
import { normalizeGameFeatures } from "../feature-data";
import { normalizeRuntimeGame } from "./storage";
import { COOP_ROLES } from "./constants";
import { MULTIPLAYER_PROTOCOL_VERSION } from "../multiplayer-protocol";

export function isCoopRole(value: unknown): value is CoopRole {
  return typeof value === "string" && COOP_ROLES.includes(value as CoopRole);
}

export function coopRoleLabel(role: CoopRole) {
  if (role === "host") return "HOST";
  if (role === "guest") return "SPIELER 2";
  if (role === "player3") return "SPIELER 3";
  return "SPIELER 4";
}

export function occupiedCoopPlayers(room: CoopRoom) {
  return room.players.filter((player) => player.occupied);
}

export function upsertSavedRoom(rooms: CoopRoom[], room: CoopRoom) {
  const existing = rooms.find((item) => item.code === room.code);
  const freshest = existing && existing.revision > room.revision ? existing : room;
  return [freshest, ...rooms.filter((item) => item.code !== room.code)].slice(0, 12);
}

export function notifyCoopOffline(code: string | undefined, playerId: string | undefined) {
  if (!code || !playerId || typeof navigator === "undefined") return;
  const body = JSON.stringify({ action: "presence-offline", code, playerId, protocol: MULTIPLAYER_PROTOCOL_VERSION });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/multiplayer", blob)) return;
  void fetch("/api/multiplayer", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

export function multiplayerUrl(params: Record<string, string>) {
  const search = new URLSearchParams({ ...params, protocol: String(MULTIPLAYER_PROTOCOL_VERSION) });
  return `/api/multiplayer?${search.toString()}`;
}

/** Fired on window when the server speaks a newer protocol; the page shows a reload banner. */
export const COOP_UPDATE_REQUIRED_EVENT = "goal-clicker:update-required";
/** How long after the first 426 the page reloads on its own, so a running reveal or mini game can end first. */
export const COOP_UPDATE_RELOAD_GRACE_MS = 20_000;
const COOP_UPDATE_RELOAD_NOTICES = 3;

/**
 * Whether the page should reload by itself after these protocol refusals (timestamps): only when the server kept
 * refusing for a while, never on the first refusal in the middle of an action.
 */
export function coopUpdateReloadDue(notices: readonly number[], now = Date.now()) {
  return notices.length >= COOP_UPDATE_RELOAD_NOTICES && now - notices[0] >= COOP_UPDATE_RELOAD_GRACE_MS;
}

const updateNotices: number[] = [];

export function reloadForUpdate() {
  if (typeof window === "undefined") return;
  const reloadUrl = new URL(window.location.href);
  reloadUrl.searchParams.set("goal-clicker-update", String(Date.now()));
  window.location.replace(reloadUrl.toString());
}

export async function readCoopResponse(response: Response) {
  const data = (await response.json()) as CoopApiResponse;
  if (response.status === 426 && typeof window !== "undefined") {
    updateNotices.push(Date.now());
    if (coopUpdateReloadDue(updateNotices)) reloadForUpdate();
    else window.dispatchEvent(new CustomEvent(COOP_UPDATE_REQUIRED_EVENT));
  }
  return data;
}

/** One id per co-op action; a resend after a lost answer carries the same id and is answered from its receipt. */
export function newCoopActionId() {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `a-${random}`;
}

/** Pause before resend number `attempt` (1, 2, ...): growing, with jitter so several clients do not collide again. */
export function coopRetryDelay(attempt: number, random: () => number = Math.random) {
  const base = 120 * 2 ** Math.max(0, attempt - 1);
  return Math.round(base / 2 + random() * base);
}

/**
 * Normalizes the co-op world for display. Every poll and click answer brings a new game object, but a slim answer
 * keeps the very same features object (same `featuresKey`): its normalized copy is reused then instead of
 * normalizing the whole world again, so the views (and the match canvas) also keep the same features reference.
 */
export function createCoopGameNormalizer() {
  let cached: { source: unknown; features: GameFeatures } | null = null;
  return (game: unknown, sound: boolean): GameState => {
    const source = game && typeof game === "object" && !Array.isArray(game) ? (game as { features?: unknown }).features : undefined;
    if (!cached || cached.source !== source || source === undefined) cached = { source, features: normalizeGameFeatures(source) };
    return normalizeRuntimeGame(game, sound, cached.features);
  };
}
