// Seats, the click state column and action receipts of a co-op world, moved out of route.ts (Notion: Monolithische
// UI, Styles und Multiplayer-API schrittweise modularisieren). Pure functions over a room row: they compute columns
// and click state patches, the route writes them with its versioned update. No database access here.
import type { LightRoomRow, RoomRow, RoomUpdate } from "../../../db";

export function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Receipts let a client resend an action after a lost answer without applying it twice.
const RECEIPTS_KEY = "_receipts";
const RECEIPT_TTL_MS = 5 * 60_000;
const MAX_RECEIPTS = 12;
const MAX_RECEIPT_EXTRAS_BYTES = 4096;

export const COOP_ROLES = ["host", "guest", "player3", "player4"] as const;
export type CoopRole = typeof COOP_ROLES[number];
export type CoopRoomUpdate = RoomUpdate;
/** A world row with or without its big JSON columns: enough for seats, names and counters. */
export type AnyRoomRow = RoomRow | LightRoomRow;

export function getRoomPlayer(room: AnyRoomRow, role: CoopRole) {
  if (role === "host") return { role, playerId: room.hostPlayerId, name: room.hostName, lastSeenAt: room.hostLastSeenAt, goals: room.hostGoals, clicks: room.hostClicks };
  if (role === "guest") return { role, playerId: room.guestPlayerId, name: room.guestName, lastSeenAt: room.guestLastSeenAt, goals: room.guestGoals, clicks: room.guestClicks };
  if (role === "player3") return { role, playerId: room.player3PlayerId, name: room.player3Name, lastSeenAt: room.player3LastSeenAt, goals: room.player3Goals, clicks: room.player3Clicks };
  return { role, playerId: room.player4PlayerId, name: room.player4Name, lastSeenAt: room.player4LastSeenAt, goals: room.player4Goals, clicks: room.player4Clicks };
}

export function getRoomPlayers(room: AnyRoomRow) {
  return COOP_ROLES.map((role) => getRoomPlayer(room, role));
}

export function getOccupiedRoomPlayers(room: AnyRoomRow) {
  return getRoomPlayers(room).filter((player) => Boolean(player.playerId));
}

export function roleIdentityUpdate(role: CoopRole, playerId: string, name: string, lastSeenAt: string): CoopRoomUpdate {
  if (role === "host") return { hostPlayerId: playerId, hostName: name, hostLastSeenAt: lastSeenAt };
  if (role === "guest") return { guestPlayerId: playerId, guestName: name, guestLastSeenAt: lastSeenAt };
  if (role === "player3") return { player3PlayerId: playerId, player3Name: name, player3LastSeenAt: lastSeenAt };
  return { player4PlayerId: playerId, player4Name: name, player4LastSeenAt: lastSeenAt };
}

export function rolePresenceUpdate(role: CoopRole, lastSeenAt: string): CoopRoomUpdate {
  if (role === "host") return { hostLastSeenAt: lastSeenAt };
  if (role === "guest") return { guestLastSeenAt: lastSeenAt };
  if (role === "player3") return { player3LastSeenAt: lastSeenAt };
  return { player4LastSeenAt: lastSeenAt };
}

export function roomPlayerName(room: AnyRoomRow, role: CoopRole) {
  return getRoomPlayer(room, role).name ?? "Mitspieler";
}

// ---- Seat management (leave, remove, host handover) ---------------------------------------------------------
// Everything below lives in the existing click state column (JSON), next to the seats' click states and the
// receipts: no schema change. Keys start with "_", so they never collide with a seat role.

/** A member counts as inactive (may be removed by the host; a host hands over) after this many days. */
export const SEAT_INACTIVE_DAYS = 7;
const SEAT_INACTIVE_MS = SEAT_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
/** Clicks and goals of members who left: the shared counters are sums over the seats, so they move here. */
const DEPARTED_KEY = "_departed";
/** When each member was last active before an offline mark (the offline mark itself sets the seat to 1970). */
export const SEEN_KEY = "_seen";
/** Player IDs that left or were removed: a page reload does not put them back into a free seat by itself. */
export const REMOVED_KEY = "_removed";
const REMOVED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Offline marks written before the activity was tracked carry no last activity at all; such a member counts as
 * active on this day, so an update never hands a host seat over at once.
 */
const SEAT_ACTIVITY_TRACKED_SINCE = Date.parse("2026-11-06T00:00:00.000Z");
const OFFLINE_MARK_BEFORE = Date.parse("2000-01-01T00:00:00.000Z");

export type ClickState = Record<string, unknown>;

export function readClickState(room: AnyRoomRow): ClickState {
  const state = parseJson<unknown>(room.clickStateJson, {});
  return state && typeof state === "object" && !Array.isArray(state) ? state as ClickState : {};
}

export function readDeparted(state: ClickState) {
  const raw = state[DEPARTED_KEY] as { goals?: unknown; clicks?: unknown } | undefined;
  return { goals: Math.max(0, finite(raw?.goals)), clicks: Math.max(0, Math.floor(finite(raw?.clicks))) };
}

export function readStringMap(state: ClickState, key: string): Record<string, string> {
  const raw = state[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** When the member on `role` was last active (ms), or 0 for an empty seat. */
export function seatLastActiveAt(room: AnyRoomRow, role: CoopRole, state = readClickState(room)) {
  const seat = getRoomPlayer(room, role);
  if (!seat.playerId) return 0;
  const seen = Date.parse(seat.lastSeenAt || "");
  const recorded = Date.parse(readStringMap(state, SEEN_KEY)[seat.playerId] ?? "");
  const known = Math.max(Number.isFinite(seen) ? seen : 0, Number.isFinite(recorded) ? recorded : 0);
  return known < OFFLINE_MARK_BEFORE ? SEAT_ACTIVITY_TRACKED_SINCE : known;
}

export function seatInactive(room: AnyRoomRow, role: CoopRole, now: number, state = readClickState(room)) {
  const lastActive = seatLastActiveAt(room, role, state);
  return lastActive > 0 && now - lastActive >= SEAT_INACTIVE_MS;
}

type SeatColumns = { playerId: string | null; name: string | null; lastSeenAt: string | null; goals: number; clicks: number };

function seatValues(room: AnyRoomRow, role: CoopRole): SeatColumns {
  const seat = getRoomPlayer(room, role);
  return { playerId: seat.playerId ?? null, name: seat.name ?? null, lastSeenAt: seat.lastSeenAt ?? null, goals: seat.goals, clicks: seat.clicks };
}

function seatUpdate(role: CoopRole, seat: SeatColumns): CoopRoomUpdate {
  return {
    [`${role}PlayerId`]: seat.playerId,
    [`${role}Name`]: seat.name,
    [`${role}LastSeenAt`]: seat.lastSeenAt,
    [`${role}Goals`]: seat.goals,
    [`${role}Clicks`]: seat.clicks,
  } as CoopRoomUpdate;
}

const EMPTY_SEAT: SeatColumns = { playerId: null, name: null, lastSeenAt: null, goals: 0, clicks: 0 };

/** The member who takes over the host seat: the one active most recently (never the host itself). */
export function hostSuccessor(room: AnyRoomRow, state = readClickState(room), except?: CoopRole) {
  return getOccupiedRoomPlayers(room)
    .filter((player) => player.role !== "host" && player.role !== except)
    .map((player) => ({ role: player.role, lastActive: seatLastActiveAt(room, player.role, state) }))
    .sort((first, second) => second.lastActive - first.lastActive || COOP_ROLES.indexOf(first.role) - COOP_ROLES.indexOf(second.role))[0]?.role ?? null;
}

/** Whether the host has been inactive long enough and an active member can take the host seat over. */
export function hostHandoverDue(room: AnyRoomRow, now = Date.now(), present?: CoopRole) {
  if (present === "host") return null;
  const state = readClickState(room);
  if (!room.hostPlayerId || !seatInactive(room, "host", now, state)) return null;
  // The member whose request is being answered is active right now.
  const seen = present ? withPresence(room, present, new Date(now).toISOString()) : room;
  const successor = hostSuccessor(seen, state);
  if (!successor || seatInactive(seen, successor, now, state)) return null;
  return successor;
}

export function withPresence<T extends AnyRoomRow>(room: T, role: CoopRole, at: string): T {
  return { ...room, ...rolePresenceUpdate(role, at) };
}

/**
 * The columns and click state of a seat change, computed from the current row (the write is versioned; on a
 * conflict it is computed again). `leaving`: the seat whose member leaves or is removed; `handover`: the member
 * who moves into the host seat. Counters of a leaving member move to the departed totals, so the shared clicks
 * and goals stay; the seat itself is empty again.
 */
export function seatChange(room: AnyRoomRow, change: { leaving?: CoopRole; handover?: CoopRole }, now: number) {
  const columns: CoopRoomUpdate = {};
  const patches: ((state: ClickState) => void)[] = [];
  const { leaving, handover } = change;
  if (leaving) {
    const leaver = seatValues(room, leaving);
    patches.push((state) => {
      const departed = readDeparted(state);
      state[DEPARTED_KEY] = { goals: departed.goals + leaver.goals, clicks: departed.clicks + leaver.clicks };
      const removed = Object.fromEntries(Object.entries(readStringMap(state, REMOVED_KEY)).filter(([, at]) => now - Date.parse(at) < REMOVED_TTL_MS));
      if (leaver.playerId) removed[leaver.playerId] = new Date(now).toISOString();
      state[REMOVED_KEY] = Object.fromEntries(Object.entries(removed).slice(-24));
      delete state[leaving];
    });
  }
  if (handover) {
    const successor = seatValues(room, handover);
    const oldHost = seatValues(room, "host");
    if (leaving === "host") {
      Object.assign(columns, seatUpdate("host", successor), seatUpdate(handover, EMPTY_SEAT));
      patches.push((state) => { state.host = state[handover]; delete state[handover]; });
    } else {
      Object.assign(columns, seatUpdate("host", successor), seatUpdate(handover, oldHost));
      patches.push((state) => { const host = state.host; state.host = state[handover]; state[handover] = host; });
    }
  } else if (leaving) {
    Object.assign(columns, seatUpdate(leaving, EMPTY_SEAT));
  }
  // Only members keep a last activity entry.
  const members = new Set(getOccupiedRoomPlayers(room).map((player) => player.playerId).filter((id) => id !== (leaving ? getRoomPlayer(room, leaving).playerId : undefined)));
  patches.push((state) => {
    const seen = Object.fromEntries(Object.entries(readStringMap(state, SEEN_KEY)).filter(([id]) => members.has(id)));
    state[SEEN_KEY] = seen;
    for (const role of COOP_ROLES) if (state[role] === undefined) delete state[role];
  });
  return { columns, patch: (state: ClickState) => { for (const patch of patches) patch(state); } };
}


type Receipt = { id: string; role: string; action: string; at: number; extras?: Record<string, unknown> };

function readReceipts(room: AnyRoomRow, now = Date.now()): Receipt[] {
  const raw = parseJson<Record<string, unknown>>(room.clickStateJson, {})[RECEIPTS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Receipt => Boolean(item) && typeof item === "object" && typeof (item as Receipt).id === "string" && typeof (item as Receipt).role === "string" && Number.isFinite((item as Receipt).at) && now - (item as Receipt).at < RECEIPT_TTL_MS);
}

export function findReceipt(room: AnyRoomRow, actionId: string, role: CoopRole) {
  return actionId ? readReceipts(room).find((receipt) => receipt.id === actionId && receipt.role === role) ?? null : null;
}

/** The click state column with this receipt and patch added; the seats' click states stay as they are. */
export function nextClickState(room: AnyRoomRow, receipt: Receipt | null, patch?: (state: ClickState) => void) {
  const state = readClickState(room);
  patch?.(state);
  if (receipt) {
    const extras = receipt.extras && JSON.stringify(receipt.extras).length <= MAX_RECEIPT_EXTRAS_BYTES ? receipt.extras : undefined;
    state[RECEIPTS_KEY] = [...readReceipts(room, receipt.at), { ...receipt, extras }].slice(-MAX_RECEIPTS);
  }
  return JSON.stringify(state);
}
