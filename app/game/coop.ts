// Client helpers for coop rooms: roles, saved rooms and API requests.
import type { CoopApiResponse, CoopRole, CoopRoom } from "./types";
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

export async function readCoopResponse(response: Response) {
  const data = (await response.json()) as CoopApiResponse;
  if (response.status === 426 && typeof window !== "undefined") {
    const reloadUrl = new URL(window.location.href);
    reloadUrl.searchParams.set("goal-clicker-update", String(Date.now()));
    window.location.replace(reloadUrl.toString());
  }
  return data;
}
