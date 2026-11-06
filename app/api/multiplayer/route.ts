export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { withGzip } from "../compression";
import { requestMatchEdit, confirmMatchDraft } from '../../match-commands';
import type { MatchDraft } from '../../match-commands';
import { fixtureFor, travelGate, consumeTravel, eligibilityError, payTravelFines, settleTravel } from '../../travel-data';
import { claimAlbumRewards, prepareCareerMatch, recordCareerMatch } from "../../career-data";
import { banCause, competitionFor, getBannedPlayerIds, nextCompetition, squadBanError } from "../../discipline";
import { getDb } from "../../../db";
import { nameRecoveryAllowed, resolvePlayer } from "../../auth/player";
import type { LightRoomRow, RoomRow, RoomSeats, RoomUpdate } from "../../../db";
import { createHash } from "node:crypto";
import { SPECIAL_CARD_PACK, coalesceHistory, toggleFavoriteCard, awardMatchStamp, maybeGrantStarterSquad, purchaseSpecialCardPack, queueMatchChanges, applyPendingMatchChanges, releaseMatchSquad, activatePendingTransferLoans, addHistory, addStarXIPlayer, advanceCupMatch, applyCupSubstitution, beginCupMatch, beginSeasonCupMatch, canStarXIPlayerFillSlot, completeTournamentRun, finishActiveTransferLoans, getCupMatchMinute, getGoalBoostedPassiveReward, getOpenTransferSquadVacancies, getRandomEventDelay, getStarFormation, getStarPack, getStarXIEffectiveMatchRating, getStarXIPlayer, getStarXIPositions, getStarXISelection, getStarXIRating, getTournament, getTournamentRewardPack, isRewardPack, openEarnedPack, getBestXIUnavailablePlayerIds, getUnavailableStarXIPlayerIds, initialGameFeatures, normalizeGameFeatures, openStarPack, pauseGameFeatureTimers, recordSeasonModeMatch, resolveCupPenalty, resolveRandomEvent, resolveTransferInsiderEvent, acceptTransferOffer, declineTransferOffer, expireTransferOffer, resolveVarEvent, restoreStarXIAfterMatch, resumeCupMatch, setBestStarXI, setStarXIBenchPlayer, setStarXIFormation, setStarXIStarter, shouldTriggerPackTroll, STAR_FORMATIONS, STAR_XI_BENCH_SIZE, STAR_XI_MAX_SUBSTITUTIONS, STAR_XI_SQUAD_SIZE } from "../../feature-data";
import type { GameFeatures, PenaltyDirection, StarFormationId } from "../../feature-data";
import { isSupportedMultiplayerProtocol, MULTIPLAYER_UPDATE_MESSAGE } from "../../multiplayer-protocol";
import { getFormationUnlockLeague, getPackUnlockLeague, getReachedLeague, getTournamentUnlockLeague, getUpgradeUnlockLeague, isLeagueContentUnlocked } from "../../season-progression";
import { calculateBulkUpgradePurchase } from "../../upgrade-purchase";
import { MAX_MULTIPLAYER_BODY_BYTES, readJsonBody, refuseUnsafePost, RequestBodyTooLargeError } from "../request-body";
import { WORLD_DAILY_KEY, claimDailyReward, mergeDailyRewardsForWorld } from "../../daily-reward";
import { claimWeeklyGoal, ensureWeeklyGoals, notePackOpened } from "../../weekly-goals";
import { ACHIEVEMENTS, BALANCE_VERSION, MAX_MULTIPLIER_LEVEL, MAX_SEASON_STARS, MINI_GAME_COOLDOWN_SECONDS, MINI_GAME_IDS } from "../../game/constants";
import { capGoalsAfterRebalance, getBaseClickPower, getBasePassivePower, getClickPower, getCost, getLevel, getMiniGameMaxReward, getPassiveIncomePower } from "../../game/economy";
import { getUpgrade } from "../../game/upgrades";
import { describeReplacements, fillStarXIGaps, movePlayerToEmptyBench, movePlayerToReserve, withBestBench } from "../../game/lineup-tools";
import { abandonTournamentRun } from "../../game/tournament-abandon";
import { applyGamePrestige } from "../../game/prestige";
import { getTicketIncome, recordTicketIncome } from "../../ticket-income";

import { answerPressConference, getPressReward } from "../../press-conference";
import { applyServerClicks, readServerClickState } from "../../coop-clicks";
import { rateLimited } from "../rate-limit";

const MAX_NAME_LENGTH = 18;
const MAX_ROOM_NAME_LENGTH = 28;
const MAX_PLAYER_ID_LENGTH = 80;
// A mini game takes several taps; a reward claimed within a second of the start, or long after it, was not played.
const MINI_GAME_MIN_RUN_MS = 1000;
const MINI_GAME_MAX_RUN_MS = 30 * 60 * 1000;
// Passive income is additive over time, so it is saved now and then instead of on every poll.
const GET_PASSIVE_REFRESH_MIN_MS = 30_000;
const TICK_PASSIVE_REFRESH_MIN_MS = 5000;
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PRESENCE_TIMEOUT_MS = 180000;
const SIMULATION_LEADER_TIMEOUT_MS = 5000;
// Presence is written at most this often per seat: online (3 minutes) only needs a rough time. The simulation
// leader is the exception, its seat must stay fresh within SIMULATION_LEADER_TIMEOUT_MS, so it writes every
// LEADER_PRESENCE_TOUCH_MS; a polling seat that finds no fresh leader before it takes over at once.
const PRESENCE_TOUCH_INTERVAL_MS = 15000;
const LEADER_PRESENCE_TOUCH_MS = 2500;
// Conditional writes of the shared world: retried on the server against the newest state before the client
// sees a conflict (8 attempts, like the upgrade purchase before). Every attempt recomputes the action from that
// state, and only one write can succeed.
// Receipts let a client resend an action after a lost answer without applying it twice.
const RECEIPTS_KEY = "_receipts";
const RECEIPT_TTL_MS = 5 * 60_000;
const MAX_RECEIPTS = 12;
const MAX_RECEIPT_EXTRAS_BYTES = 4096;
const PASSIVE_BACKGROUND_GRACE_MS = 24 * 60 * 60 * 1000;
const TRANSFER_MARKET_CLOSED_MESSAGE = "Der Transfermarkt ist geschlossen. Fabrizio Romario bleibt aktiv.";

type MiniGameCooldowns = Record<string, number>;
type CoopGameState = {
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
const COOP_ROLES = ["host", "guest", "player3", "player4"] as const;
type CoopRole = typeof COOP_ROLES[number];
type CoopRoomUpdate = RoomUpdate;
/** A world row with or without its big JSON columns: enough for seats, names and counters. */
type AnyRoomRow = RoomRow | LightRoomRow;

function getRoomPlayer(room: AnyRoomRow, role: CoopRole) {
  if (role === "host") return { role, playerId: room.hostPlayerId, name: room.hostName, lastSeenAt: room.hostLastSeenAt, goals: room.hostGoals, clicks: room.hostClicks };
  if (role === "guest") return { role, playerId: room.guestPlayerId, name: room.guestName, lastSeenAt: room.guestLastSeenAt, goals: room.guestGoals, clicks: room.guestClicks };
  if (role === "player3") return { role, playerId: room.player3PlayerId, name: room.player3Name, lastSeenAt: room.player3LastSeenAt, goals: room.player3Goals, clicks: room.player3Clicks };
  return { role, playerId: room.player4PlayerId, name: room.player4Name, lastSeenAt: room.player4LastSeenAt, goals: room.player4Goals, clicks: room.player4Clicks };
}

function getRoomPlayers(room: AnyRoomRow) {
  return COOP_ROLES.map((role) => getRoomPlayer(room, role));
}

function getOccupiedRoomPlayers(room: AnyRoomRow) {
  return getRoomPlayers(room).filter((player) => Boolean(player.playerId));
}

function roleIdentityUpdate(role: CoopRole, playerId: string, name: string, lastSeenAt: string): CoopRoomUpdate {
  if (role === "host") return { hostPlayerId: playerId, hostName: name, hostLastSeenAt: lastSeenAt };
  if (role === "guest") return { guestPlayerId: playerId, guestName: name, guestLastSeenAt: lastSeenAt };
  if (role === "player3") return { player3PlayerId: playerId, player3Name: name, player3LastSeenAt: lastSeenAt };
  return { player4PlayerId: playerId, player4Name: name, player4LastSeenAt: lastSeenAt };
}

function rolePresenceUpdate(role: CoopRole, lastSeenAt: string): CoopRoomUpdate {
  if (role === "host") return { hostLastSeenAt: lastSeenAt };
  if (role === "guest") return { guestLastSeenAt: lastSeenAt };
  if (role === "player3") return { player3LastSeenAt: lastSeenAt };
  return { player4LastSeenAt: lastSeenAt };
}

function roomPlayerName(room: AnyRoomRow, role: CoopRole) {
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
const SEEN_KEY = "_seen";
/** Player IDs that left or were removed: a page reload does not put them back into a free seat by itself. */
const REMOVED_KEY = "_removed";
const REMOVED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PRESTIGE_VOTE_KEY = "_prestigeVote";
const PRESTIGE_VOTE_RESULT_KEY = "_prestigeVoteResult";
/** How long the online members have to agree to a Prestige. */
export const PRESTIGE_VOTE_MS = 60_000;
/**
 * Offline marks written before the activity was tracked carry no last activity at all; such a member counts as
 * active on this day, so an update never hands a host seat over at once.
 */
const SEAT_ACTIVITY_TRACKED_SINCE = Date.parse("2026-11-06T00:00:00.000Z");
const OFFLINE_MARK_BEFORE = Date.parse("2000-01-01T00:00:00.000Z");

type ClickState = Record<string, unknown>;

function readClickState(room: AnyRoomRow): ClickState {
  const state = parseJson<unknown>(room.clickStateJson, {});
  return state && typeof state === "object" && !Array.isArray(state) ? state as ClickState : {};
}

function readDeparted(state: ClickState) {
  const raw = state[DEPARTED_KEY] as { goals?: unknown; clicks?: unknown } | undefined;
  return { goals: Math.max(0, finite(raw?.goals)), clicks: Math.max(0, Math.floor(finite(raw?.clicks))) };
}

function readStringMap(state: ClickState, key: string): Record<string, string> {
  const raw = state[key];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** When the member on `role` was last active (ms), or 0 for an empty seat. */
function seatLastActiveAt(room: AnyRoomRow, role: CoopRole, state = readClickState(room)) {
  const seat = getRoomPlayer(room, role);
  if (!seat.playerId) return 0;
  const seen = Date.parse(seat.lastSeenAt || "");
  const recorded = Date.parse(readStringMap(state, SEEN_KEY)[seat.playerId] ?? "");
  const known = Math.max(Number.isFinite(seen) ? seen : 0, Number.isFinite(recorded) ? recorded : 0);
  return known < OFFLINE_MARK_BEFORE ? SEAT_ACTIVITY_TRACKED_SINCE : known;
}

function seatInactive(room: AnyRoomRow, role: CoopRole, now: number, state = readClickState(room)) {
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
function hostSuccessor(room: AnyRoomRow, state = readClickState(room), except?: CoopRole) {
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

function withPresence<T extends AnyRoomRow>(room: T, role: CoopRole, at: string): T {
  return { ...room, ...rolePresenceUpdate(role, at) };
}

/**
 * The columns and click state of a seat change, computed from the current row (the write is versioned; on a
 * conflict it is computed again). `leaving`: the seat whose member leaves or is removed; `handover`: the member
 * who moves into the host seat. Counters of a leaving member move to the departed totals, so the shared clicks
 * and goals stay; the seat itself is empty again.
 */
function seatChange(room: AnyRoomRow, change: { leaving?: CoopRole; handover?: CoopRole }, now: number) {
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

// ---- Prestige vote ----------------------------------------------------------------------------------------

type PrestigeVote = { id: string; proposer: string; proposerName: string; keepNormalId: string | null; prestigeCount: number; createdAt: number; expiresAt: number; required: string[]; approvals: string[] };
type PrestigeVoteOutcome = "approved" | "declined" | "cancelled" | "expired" | "failed";
type PrestigeVoteResult = { id: string; outcome: PrestigeVoteOutcome; by?: string; reason?: string; prestigeCount: number; at: number };

function readPrestigeVote(state: ClickState): PrestigeVote | null {
  const raw = state[PRESTIGE_VOTE_KEY] as Partial<PrestigeVote> | undefined;
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || typeof raw.proposer !== "string" || !Number.isFinite(raw.expiresAt) || !Number.isFinite(raw.prestigeCount)) return null;
  const ids = (value: unknown) => Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  return {
    id: raw.id, proposer: raw.proposer, proposerName: typeof raw.proposerName === "string" ? raw.proposerName : "Mitspieler",
    keepNormalId: typeof raw.keepNormalId === "string" ? raw.keepNormalId : null, prestigeCount: Number(raw.prestigeCount),
    createdAt: finite(raw.createdAt), expiresAt: Number(raw.expiresAt), required: ids(raw.required), approvals: ids(raw.approvals),
  };
}

function readPrestigeVoteResult(state: ClickState): PrestigeVoteResult | null {
  const raw = state[PRESTIGE_VOTE_RESULT_KEY] as Partial<PrestigeVoteResult> | undefined;
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || typeof raw.outcome !== "string" || !Number.isFinite(raw.at)) return null;
  return { id: raw.id, outcome: raw.outcome as PrestigeVoteOutcome, by: typeof raw.by === "string" ? raw.by : undefined, reason: typeof raw.reason === "string" ? raw.reason : undefined, prestigeCount: finite(raw.prestigeCount), at: Number(raw.at) };
}

/**
 * Where a vote stands. Members who must still agree: those online when it was proposed, still in a seat and still
 * online now. A member who goes offline no longer blocks; the proposer leaving cancels it.
 */
function prestigeVoteStatus(room: AnyRoomRow, vote: PrestigeVote, now: number) {
  const seats = getOccupiedRoomPlayers(room);
  const seatOf = (id: string) => seats.find((player) => player.playerId === id);
  if (!seatOf(vote.proposer)) return { status: "cancelled" as const, waiting: [] as CoopRole[] };
  if (now >= vote.expiresAt) return { status: "expired" as const, waiting: [] as CoopRole[] };
  const waiting = vote.required.filter((id) => !vote.approvals.includes(id)).map(seatOf).filter((seat): seat is NonNullable<typeof seat> => Boolean(seat && isOnline(seat.lastSeenAt))).map((seat) => seat.role);
  return { status: waiting.length ? "pending" as const : "ready" as const, waiting };
}

/** What a client sees of the vote: roles and names, never player IDs. */
function prestigeVoteView(room: AnyRoomRow, state: ClickState, now: number, viewerId?: string) {
  const vote = readPrestigeVote(state);
  if (!vote) return null;
  const { status, waiting } = prestigeVoteStatus(room, vote, now);
  if (status !== "pending" && status !== "ready") return null;
  const roleOf = (id: string) => getOccupiedRoomPlayers(room).find((player) => player.playerId === id)?.role;
  const keep = vote.keepNormalId ? getStarXIPlayer(vote.keepNormalId) : null;
  return {
    id: vote.id,
    proposerRole: roleOf(vote.proposer) ?? null,
    proposerName: vote.proposerName,
    keepNormalId: vote.keepNormalId,
    keepName: keep?.name ?? null,
    prestigeCount: vote.prestigeCount,
    expiresAt: vote.expiresAt,
    expiresInMs: Math.max(0, vote.expiresAt - now),
    approvedRoles: vote.approvals.map(roleOf).filter((role): role is CoopRole => Boolean(role)),
    waitingRoles: waiting,
    viewerIsProposer: Boolean(viewerId && viewerId === vote.proposer),
    viewerMustVote: Boolean(viewerId && waiting.includes(roleOf(viewerId) as CoopRole)),
    viewerApproved: Boolean(viewerId && vote.approvals.includes(viewerId)),
  };
}

/**
 * Settles a vote that is over (expired, proposer gone) or complete (every online member agreed): a complete vote
 * runs the Prestige of the proposer once, with the vote id as request id. Returns the click state patch and the
 * outcome, or null when nothing changes.
 */
function settlePrestigeVote(game: CoopGameState, room: AnyRoomRow, now: number) {
  const vote = readPrestigeVote(readClickState(room));
  if (!vote) return null;
  const { status } = prestigeVoteStatus(room, vote, now);
  if (status === "pending") return null;
  if (vote.prestigeCount !== game.features.seasonMode.prestigeCount) return finishPrestigeVote(vote, "cancelled", now);
  if (status === "cancelled" || status === "expired") return finishPrestigeVote(vote, status, now);
  const result = applyGamePrestige(game, vote.keepNormalId, now, vote.id);
  if (result.duplicate) return finishPrestigeVote(vote, "approved", now);
  if (result.error) return finishPrestigeVote(vote, "failed", now, undefined, result.error);
  Object.assign(game, result.game);
  return finishPrestigeVote(vote, "approved", now);
}

function finishPrestigeVote(vote: PrestigeVote, outcome: PrestigeVoteOutcome, now: number, by?: string, reason?: string) {
  const result: PrestigeVoteResult = { id: vote.id, outcome, by, reason, prestigeCount: vote.prestigeCount, at: now };
  return {
    outcome,
    result,
    patch: (state: ClickState) => {
      if (readPrestigeVote(state)?.id === vote.id) delete state[PRESTIGE_VOTE_KEY];
      state[PRESTIGE_VOTE_RESULT_KEY] = result;
    },
  };
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH) : "";
}

function cleanRoomName(value: unknown, fallback = "Meine Welt") {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_ROOM_NAME_LENGTH) : "";
  return cleaned || fallback;
}

function cleanPlayerId(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_PLAYER_ID_LENGTH) : "";
}

function cleanCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 6) : "";
}

function makeRoomCode() {
  // 32 symbols divide 256 evenly, so byte % 32 has no modulo bias.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

function finite(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function initialCooldowns(): MiniGameCooldowns {
  return { penalty: 0, dribble: 0, crossbar: 0, prediction: 0 };
}

function normalizeCooldowns(value: unknown): MiniGameCooldowns {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result = initialCooldowns();
  for (const id of Object.keys(result)) result[id] = Math.max(0, finite(source[id]));
  return result;
}

function normalizeUpgrades(value: unknown): Record<string, number> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result: Record<string, number> = {};
  for (const [id, rawLevel] of Object.entries(source)) {
    const level = Math.max(0, Math.floor(finite(rawLevel)));
    result[id] = id === "golden" || id === "legacy" ? Math.min(MAX_MULTIPLIER_LEVEL, level) : level;
  }
  return result;
}

function initialGame(): CoopGameState {
  return {
    goals: 0,
    totalGoals: 0,
    seasonGoals: 0,
    clicks: 0,
    upgrades: {},
    achievements: [],
    stars: 0,
    seasons: 0,
    balanceVersion: BALANCE_VERSION,
    sound: true,
    lastSaved: Date.now(),
    miniGameCooldowns: initialCooldowns(),
    minigameWins: 0,
    features: initialGameFeatures(),
  };
}

/**
 * `light`: the row came without its features (a slim answer). Then the features are neither read nor normalized
 * (the answer leaves them out anyway), and the one-time rebalance cap, which needs the stored features, is skipped:
 * without them it would wrongly cut the shared goals of every slim answer to the minimum.
 */
function readGame(row: RoomRow, light = false): CoopGameState {
  const storedUpgrades = parseJson<Record<string, number>>(row.sharedUpgradesJson, {});
  const storedCooldowns = parseJson<MiniGameCooldowns>(row.sharedMiniGameCooldownsJson, {});
  const primaryFeatures = light ? undefined : parseJson<unknown>(row.sharedFeaturesJson, undefined);
  const primaryFeatureRecord = primaryFeatures && typeof primaryFeatures === "object" && !Array.isArray(primaryFeatures) ? primaryFeatures as Record<string, unknown> : {};
  // The backup copy is only read when the primary features are missing.
  const storedFeatures = light ? undefined : Object.keys(primaryFeatureRecord).length ? primaryFeatures : parseJson<Partial<CoopGameState>>(row.sharedStateBackupJson, {}).features;
  const legacyRoom = row.sharedUpgradesJson === "{}" && row.sharedTotalGoals === 0 && row.sharedSeasonGoals === 0 && row.sharedCoins > 0;
  // Members who left keep their share of the shared counters (the seat columns are emptied for the next member).
  const departed = readDeparted(readClickState(row));
  const legacyTotal = Math.max(row.sharedCoins, row.hostGoals + row.guestGoals + row.player3Goals + row.player4Goals + departed.goals);
  const game = initialGame();
  game.goals = Math.max(0, finite(row.sharedCoins));
  game.totalGoals = Math.max(0, finite(row.sharedTotalGoals || (legacyRoom ? legacyTotal : 0)));
  game.seasonGoals = Math.max(0, finite(row.sharedSeasonGoals || (legacyRoom ? legacyTotal : 0)));
  game.clicks = Math.max(0, Math.floor(row.hostClicks + row.guestClicks + row.player3Clicks + row.player4Clicks + departed.clicks));
  game.upgrades = normalizeUpgrades(storedUpgrades);
  const storedAchievements = parseJson<unknown>(row.sharedAchievementsJson, []);
  game.achievements = Array.isArray(storedAchievements) ? storedAchievements.filter((value): value is string => typeof value === "string") : [];
  game.stars = Math.max(0, Math.min(MAX_SEASON_STARS, Math.floor(finite(row.sharedStars))));
  game.seasons = Math.max(0, Math.floor(finite(row.sharedSeasons)));
  game.miniGameCooldowns = normalizeCooldowns(storedCooldowns);
  game.minigameWins = Math.max(0, Math.floor(finite(row.sharedMinigameWins)));
  if (light) {
    unlockAchievements(game);
    return game;
  }
  game.features = normalizeGameFeatures(storedFeatures);
  // The world's week starts with the first full read in it (baseline of every counter, see app/weekly-goals.ts).
  ensureWeeklyGoals(game.features, Date.now(), game.minigameWins);
  // The whole world shares one daily reward; older worlds still keep one entry per seat.
  game.features.dailyRewards = mergeDailyRewardsForWorld(game.features.dailyRewards);
  game.goals = capGoalsAfterRebalance(game.goals, storedFeatures, game.upgrades, game.stars, game.features);
  unlockAchievements(game);
  return game;
}

/** Best league the shared world ever reached; unlocks never depend on the season counter alone. */
function reachedLeagueOf(game: CoopGameState) {
  return getReachedLeague(game.seasons, game.features.seasonMode.highestDivision);
}

function unlockAchievements(game: CoopGameState) {
  const unlocked = new Set(game.achievements);
  for (const { id, threshold } of ACHIEVEMENTS) if (game.totalGoals >= threshold) unlocked.add(id);
  game.achievements = [...unlocked];
}

function getBulkPurchase(id: string, game: CoopGameState, requestedCount: number, unlimitedMoney = false) {
  const upgrade = getUpgrade(id);
  if (!upgrade) return { count: 0, totalCost: 0 };
  return calculateBulkUpgradePurchase(upgrade, getLevel(game.upgrades, id), game.goals, requestedCount, {
    unlimitedMoney,
    maxMultiplierLevel: MAX_MULTIPLIER_LEVEL,
  });
}

function startSeasonCupMatch(game: CoopGameState, now: number) {
  if (game.features.seasonMode.hallOfFame) return "Die Hall of Fame ist erreicht. Starte zuerst Prestige.";
  if (game.features.cup.active) return "Es läuft bereits ein Saisonspiel.";
  if (game.features.cup.pendingNextRound) return "Schliesse zuerst die aktuelle Turnierrunde ab.";
  const openTransferVacancies = getOpenTransferSquadVacancies(game.features);
  if (openTransferVacancies.length > 0) {
    const location = game.features.starXI.lineupIds.filter(Boolean).length < STAR_XI_SQUAD_SIZE ? "in der Startelf" : "auf der Bank";
    return `Besetze zuerst den freien Platz ${location}. Verkaufte oder verliehene Spieler werden nicht automatisch ersetzt.`;
  }
  if (getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE) return "Für das Saisonspiel brauchst du 11 passende Spieler in der Startelf.";
  const suspendedOnSquad = game.features.cup.suspendedPlayerIds.some((playerId) => game.features.starXI.lineupIds.includes(playerId) || game.features.starXI.benchIds.includes(playerId));
  if (suspendedOnSquad) return "Ein Spieler mit Roter Karte muss vor dem Anpfiff ersetzt werden und darf nicht auf der Bank sitzen.";
  // Every kick-off action ends here, so the yellow card bans are checked for all of them.
  const leagueBanError = squadBanError(game.features, competitionFor("season", "stadium"));
  if (leagueBanError) return leagueBanError;
  const fixture = fixtureFor(game.features, "season");
  const travelError = travelGate(game.features, fixture, now);
  if (travelError) return travelError;
  game.features = activatePendingTransferLoans(game.features, "stadium");
  const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
  game.features.cup = beginSeasonCupMatch(game.features.cup, game.features.seasonMode, now, homePlayers, game.features.starXI.formationPositions, game.features.starXI.lineupIds, game.features.starXI.benchIds);
  consumeTravel(game.features, fixture);
  prepareCareerMatch(game.features);
  return null;
}

function recordMultiplayerSeasonMatch(game: CoopGameState, now: number) {
  // The stadium and the table still show the match that was played, so the takings are counted first.
  const tickets = getTicketIncome(game.features, getBasePassivePower(game.upgrades, game.stars, game.features));
  const result = recordSeasonModeMatch(game.features.seasonMode, game.features.cup.homeScore, game.features.cup.awayScore, game.features.club.name, now, Math.random, game.features.cup.opponentIds[0]);
  if (!result.played || !result.entry) return;
  recordCareerMatch(game.features, now, result.entry);
  if (tickets) {
    recordTicketIncome(game.features, tickets, now);
    game.goals += tickets.income;
    game.seasonGoals += tickets.income;
    game.totalGoals += tickets.income;
  }
  game.features.seasonMode = result.state;
  game.features.seasonMode.table = game.features.seasonMode.table.map((team) => team.id === "club" ? { ...team, name: game.features.club.name } : team);
  awardMatchStamp(game.features, now);
  game.features = finishActiveTransferLoans(game.features, now, { hallOfFameReached: result.entry.seasonOutcome === "hall-of-fame" }).features;
  game.seasons = Math.max(game.seasons, result.state.highestDivision - 1);
  // Stars only for a league never reached before (getSeasonStarReward), never for promotion after relegation.
  game.stars = Math.min(MAX_SEASON_STARS, game.stars + result.starReward);
  const outcomeLabel = result.entry.seasonOutcome === "promoted" ? "Aufstieg" : result.entry.seasonOutcome === "relegated" ? "Abstieg" : result.entry.seasonOutcome === "hall-of-fame" ? "Hall of Fame" : result.entry.completedSeason ? "Klassenerhalt" : result.entry.outcome === "win" ? "Sieg" : result.entry.outcome === "loss" ? "Niederlage" : "Remis";
  addHistory(game.features, { title: `Saisonspiel · ${outcomeLabel}`, detail: result.state.lastResult, tone: result.entry.seasonOutcome === "relegated" || result.entry.outcome === "loss" ? "negative" : result.entry.outcome === "win" || result.entry.seasonOutcome === "promoted" || result.entry.seasonOutcome === "hall-of-fame" ? "positive" : "neutral" });
}

/**
 * The columns of a world write. The features (and the backup copy of the whole game) are only part of it when
 * they differ from `previousFeaturesJson`, the features the write builds on: most writes (passive income,
 * counters, upgrades) change numbers only, and the features are by far the biggest part of a world.
 */
function gameColumns(game: CoopGameState, timestamp: string, previousRevision = 0, previousFeaturesJson?: string) {
  unlockAchievements(game);
  const sharedFeaturesJson = JSON.stringify(game.features);
  const featuresChanged = previousFeaturesJson === undefined || sharedFeaturesJson !== previousFeaturesJson;
  return {
    sharedCoins: game.goals,
    sharedUpgradeLevel: Object.values(game.upgrades).reduce((total, level) => total + level, 0),
    sharedTotalGoals: game.totalGoals,
    sharedSeasonGoals: game.seasonGoals,
    sharedUpgradesJson: JSON.stringify(game.upgrades),
    sharedAchievementsJson: JSON.stringify(game.achievements),
    sharedStars: game.stars,
    sharedSeasons: game.seasons,
    sharedMinigameWins: game.minigameWins,
    sharedBestLeague: getReachedLeague(game.seasons, game.features.seasonMode.highestDivision),
    sharedTrophies: Object.values(game.features.cup.trophies).reduce((total, count) => total + count, 0),
    sharedMiniGameCooldownsJson: JSON.stringify(game.miniGameCooldowns),
    // The backup is a second copy for recovery (readGame reads it when the features are empty), so it only has
    // to follow the features.
    ...(featuresChanged ? { sharedFeaturesJson, sharedStateBackupJson: JSON.stringify(game) } : {}),
    sharedStateVersion: Math.max(0, Math.floor(previousRevision)) + 1,
    lastPassiveAt: timestamp,
    pendingPlayerId: null,
    pendingUpgradeId: null,
    pendingUpgradeName: null,
    pendingCost: null,
    pendingUpgradeCount: null,
    updatedAt: timestamp,
  };
}

/**
 * An action that wants the game saved; the shared write itself happens in mutateWorld. `clickStatePatch` changes
 * the click state column (seat management, Prestige vote) on top of the row the write builds on, so a click batch
 * of another seat that came in between is kept. `strict`: the action depends on more than the features (seats and
 * their counters), so after any conflict it is computed again instead of being stored on top of new clicks.
 */
type SaveRequest = { kind: "save"; extraColumns: CoopRoomUpdate; responseExtras: Record<string, unknown>; clickStatePatch?: (state: ClickState) => void; strict?: boolean };
/** Nothing to save; the answer is the world as it is. */
type NoChange = { kind: "unchanged"; responseExtras: Record<string, unknown> };
type ActionOutcome = Response | SaveRequest | NoChange;

function persistGameResponse(
  _db: unknown,
  _room: RoomRow,
  _game: CoopGameState,
  _timestamp: string,
  _playerId: string,
  _role: CoopRole,
  extraColumns: CoopRoomUpdate = {},
  responseExtras: Record<string, unknown> = {},
  more: Pick<SaveRequest, "clickStatePatch" | "strict"> = {},
): SaveRequest {
  return { kind: "save", extraColumns, responseExtras, ...more };
}

function unchanged(responseExtras: Record<string, unknown> = {}): NoChange {
  return { kind: "unchanged", responseExtras };
}

/**
 * Books passive income and the timer shift of the time nobody was there over [lastPassiveAt, now] into `game`.
 * `presence`: the seats as they were before this request marked its player present; past income depends on them.
 */
function bookPassive(game: CoopGameState, room: AnyRoomRow, now: number, presence: AnyRoomRow = room) {
  const last = Date.parse(room.lastPassiveAt || room.updatedAt) || now;
  const fullElapsed = Math.max(0, now - last);
  const latestSeenAt = Math.max(...getOccupiedRoomPlayers(presence).map((player) => Date.parse(player.lastSeenAt || "") || 0), 0);
  const activeLeaseEndsAt = latestSeenAt + PASSIVE_BACKGROUND_GRACE_MS;
  const activeUntil = getOccupiedRoomPlayers(room).length >= 2 ? Math.min(now, Math.max(last, activeLeaseEndsAt)) : last;
  const activeElapsed = Math.max(0, Math.min(fullElapsed, activeUntil - last));
  const inactiveElapsed = Math.max(0, fullElapsed - activeElapsed);
  const passiveReward = getGoalBoostedPassiveReward(getPassiveIncomePower(game.upgrades, game.stars, game.features), game.features, last, last + activeElapsed);
  if (passiveReward > 0) {
    game.goals += passiveReward;
    game.seasonGoals += passiveReward;
    game.totalGoals += passiveReward;
  }
  if (inactiveElapsed > 0) {
    const inactiveStartedAt = last + activeElapsed;
    game.features = pauseGameFeatureTimers(game.features, inactiveElapsed, now);
    for (const id of Object.keys(game.miniGameCooldowns)) {
      if (game.miniGameCooldowns[id] > inactiveStartedAt) game.miniGameCooldowns[id] += inactiveElapsed;
    }
  }
}

/** One version guarded write of `game` on top of `room`; counters only when the features did not change. */
async function writeWorld(db: ReturnType<typeof getDb>, room: RoomRow, game: CoopGameState, timestamp: string, extraColumns: CoopRoomUpdate = {}) {
  const columns = gameColumns(game, timestamp, room.sharedStateVersion, room.sharedFeaturesJson);
  const updated = await db.updateRoom(
    room.code,
    { ...columns, ...extraColumns },
    { sharedStateVersion: room.sharedStateVersion },
    { sharedFeaturesJson: room.sharedFeaturesJson, sharedStateBackupJson: room.sharedStateBackupJson },
  );
  return updated ? rememberRoom(updated)! : null;
}

type Receipt = { id: string; role: string; action: string; at: number; extras?: Record<string, unknown> };

function readReceipts(room: AnyRoomRow, now = Date.now()): Receipt[] {
  const raw = parseJson<Record<string, unknown>>(room.clickStateJson, {})[RECEIPTS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Receipt => Boolean(item) && typeof item === "object" && typeof (item as Receipt).id === "string" && typeof (item as Receipt).role === "string" && Number.isFinite((item as Receipt).at) && now - (item as Receipt).at < RECEIPT_TTL_MS);
}

function findReceipt(room: AnyRoomRow, actionId: string, role: CoopRole) {
  return actionId ? readReceipts(room).find((receipt) => receipt.id === actionId && receipt.role === role) ?? null : null;
}

/** The click state column with this receipt and patch added; the seats' click states stay as they are. */
function nextClickState(room: AnyRoomRow, receipt: Receipt | null, patch?: (state: ClickState) => void) {
  const state = readClickState(room);
  patch?.(state);
  if (receipt) {
    const extras = receipt.extras && JSON.stringify(receipt.extras).length <= MAX_RECEIPT_EXTRAS_BYTES ? receipt.extras : undefined;
    state[RECEIPTS_KEY] = [...readReceipts(room, receipt.at), { ...receipt, extras }].slice(-MAX_RECEIPTS);
  }
  return JSON.stringify(state);
}

type WorldContext = { db: ReturnType<typeof getDb>; playerId: string; role: CoopRole; action: string; knownFeaturesKey: string; actionId: string };
type WorldOptions = {
  /** Book passive income into the action's own write (no separate write before it). */
  passive: boolean;
  /** Seats before this request touched its presence, for the passive income of the past. */
  presence?: AnyRoomRow;
  /** Mark the player present in the same write (foreground actions). */
  touch: boolean;
  /** Settle travel and pay its fines with the write, like every action did before. */
  settleTravel: boolean;
};

/**
 * The time of a world write: never at or before the last one, so every write moves lastPassiveAt forward and a
 * changed lastPassiveAt always means another world write happened (clock differences between instances).
 */
function worldWriteTime(room: AnyRoomRow) {
  const last = Date.parse(room.lastPassiveAt || "");
  const now = Date.now();
  return Number.isFinite(last) && now <= last ? last + 1 : now;
}

/**
 * Whether `latest` differs from `room` only by click batches (counters, click states, presence): no world write
 * came in between, since each one moves lastPassiveAt. An action computed on `room` can then be stored on top of
 * `latest` as if it had happened just before those clicks.
 */
export function onlyClicksMoved(room: RoomRow, latest: RoomRow) {
  return room.lastPassiveAt === latest.lastPassiveAt
    && room.sharedFeaturesJson === latest.sharedFeaturesJson
    && room.sharedUpgradesJson === latest.sharedUpgradesJson
    && room.sharedAchievementsJson === latest.sharedAchievementsJson
    && room.sharedMiniGameCooldownsJson === latest.sharedMiniGameCooldownsJson
    && room.sharedStars === latest.sharedStars
    && room.sharedSeasons === latest.sharedSeasons
    && room.sharedMinigameWins === latest.sharedMinigameWins
    && room.redeemedBonusCodesJson === latest.redeemedBonusCodesJson
    && COOP_ROLES.every((role) => getRoomPlayer(room, role).playerId === getRoomPlayer(latest, role).playerId)
    && latest.sharedCoins >= room.sharedCoins
    && latest.sharedTotalGoals >= room.sharedTotalGoals;
}

/**
 * Runs `apply` against the current world and saves the result with the shared state version as condition. A
 * conflict reloads the world. When only click batches came in between, the computed action is stored on top of
 * their goals at once; otherwise `apply` runs again on the newest state. Either way every action is applied at
 * most once and never on an outdated state. Only after 8 conflicts in a row does the client get STALE_STATE.
 */
async function mutateWorld(context: WorldContext, initial: RoomRow, apply: (game: CoopGameState, room: RoomRow, timestamp: string) => ActionOutcome | Promise<ActionOutcome>, options: WorldOptions) {
  const { db, playerId, role, knownFeaturesKey, actionId } = context;
  const respond = (target: AnyRoomRow, extras: Record<string, unknown> = {}) => Response.json({ serverNow: Date.now(), room: shapeRoom(target, playerId, knownFeaturesKey), role, ...extras });
  let room = initial;
  let prepared: { game: CoopGameState; outcome: SaveRequest; now: number; timestamp: string } | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!prepared) {
      const receipt = findReceipt(room, actionId, role);
      if (receipt) return respond(room, { ...(receipt.extras ?? {}), duplicate: true });
      const now = worldWriteTime(room);
      const timestamp = new Date(now).toISOString();
      const game = readGame(room);
      if (options.passive) bookPassive(game, room, now, attempt === 0 ? options.presence ?? room : room);
      const historyBefore = new Set(game.features.history.map((entry) => entry.id));
      const outcome = await apply(game, room, timestamp);
      // Entries this member's own action wrote name the member (Q62); background ticks stay without a name.
      if (!(outcome instanceof Response) && outcome.kind === "save" && context.action !== "tick" && context.action !== "cup-tick") {
        const actor = roomPlayerName(room, role).slice(0, 24);
        game.features.history = coalesceHistory(game.features.history.map((entry) => historyBefore.has(entry.id) || entry.actor ? entry : { ...entry, actor }));
      }
      if (outcome instanceof Response) {
        if (options.touch) await touchPresence(db, room, role, timestamp);
        return outcome;
      }
      if (outcome.kind === "unchanged") {
        const touched = options.touch ? await touchPresence(db, room, role, timestamp) : room;
        return respond(touched, outcome.responseExtras);
      }
      if (options.settleTravel) {
        game.features.travel = settleTravel(game.features.travel, now);
        // Fines from the journey (speeding, parking) are paid once the team has arrived.
        const travelFine = payTravelFines(game.features, game.goals, getBasePassivePower(game.upgrades, game.stars, game.features), now);
        game.goals -= travelFine;
        game.seasonGoals = Math.max(0, game.seasonGoals - travelFine);
      }
      prepared = { game, outcome, now, timestamp };
    }
    const { game, outcome, now, timestamp } = prepared;
    const extraColumns: CoopRoomUpdate = {
      ...(options.touch ? rolePresenceUpdate(role, timestamp) : {}),
      ...(actionId || outcome.clickStatePatch ? { clickStateJson: nextClickState(room, actionId ? { id: actionId, role, action: context.action, at: now, extras: outcome.responseExtras } : null, outcome.clickStatePatch) } : {}),
      ...outcome.extraColumns,
    };
    const updated = await writeWorld(db, room, game, timestamp, extraColumns);
    if (updated) return respond(updated, outcome.responseExtras);
    const latest = (await loadRoom(room.code)).room;
    if (!latest) return jsonError("Dieser Raum wurde gelöscht.", 404);
    if (!outcome.strict && onlyClicksMoved(room, latest)) {
      // The goals the clicks added in between stay; the action itself is unchanged.
      game.goals += latest.sharedCoins - room.sharedCoins;
      game.totalGoals += latest.sharedTotalGoals - room.sharedTotalGoals;
      game.seasonGoals += latest.sharedSeasonGoals - room.sharedSeasonGoals;
    } else {
      prepared = null;
    }
    room = latest;
    // A short random pause after repeated conflicts, so racing requests do not collide again in lockstep.
    if (attempt >= 1) await new Promise((resolve) => setTimeout(resolve, Math.random() * 15 * attempt));
  }
  return Response.json({
    error: "Der gemeinsame Spielstand wurde gleichzeitig geändert. Die Aktion wird automatisch nochmals ausgeführt.",
    errorCode: "STALE_STATE",
    serverNow: Date.now(), room: shapeRoom(room, playerId, knownFeaturesKey),
    role,
  }, { status: 409 });
}

function isOnline(lastSeenAt: string | null | undefined) {
  const lastSeen = Date.parse(lastSeenAt || "");
  return Number.isFinite(lastSeen) && Date.now() - lastSeen <= PRESENCE_TIMEOUT_MS;
}

/**
 * The seat that simulates matches and books passive income: the first seat seen within
 * SIMULATION_LEADER_TIMEOUT_MS. `present`: a seat whose request is being answered right now counts as seen.
 */
function getSimulationLeaderRole(room: AnyRoomRow, now = Date.now(), present?: CoopRole) {
  return getOccupiedRoomPlayers(room).find((player) => {
    if (player.role === present) return true;
    const lastSeen = Date.parse(player.lastSeenAt || "");
    return Number.isFinite(lastSeen) && now - lastSeen <= SIMULATION_LEADER_TIMEOUT_MS;
  })?.role ?? null;
}

function withoutFeatures<T extends { features: unknown }>(game: T): Omit<T, "features"> {
  const copy: Partial<T> = { ...game };
  delete copy.features;
  return copy as Omit<T, "features">;
}

// The md5 of the features last hashed per world, so the same features are not hashed on every answer.
const featuresKeyCache = new Map<string, { json: string; key: string }>();

/** md5 of the shared features, the same value Postgres computes (or stores) for a light row. */
function featuresKeyOf(row: AnyRoomRow) {
  if ("featuresKey" in row) return row.featuresKey;
  const cached = featuresKeyCache.get(row.code);
  if (cached && cached.json === row.sharedFeaturesJson) return cached.key;
  const key = createHash("md5").update(row.sharedFeaturesJson, "utf8").digest("hex");
  featuresKeyCache.delete(row.code);
  featuresKeyCache.set(row.code, { json: row.sharedFeaturesJson, key });
  if (featuresKeyCache.size > ROOM_CACHE_LIMIT) featuresKeyCache.delete(featuresKeyCache.keys().next().value!);
  return key;
}

/** The world without its big columns, keeping the key of the features it had. */
function lightened(row: AnyRoomRow): LightRoomRow {
  if (!("sharedFeaturesJson" in row)) return row;
  const { sharedFeaturesJson: _features, sharedStateBackupJson: _backup, ...columns } = row;
  void _features; void _backup;
  return { ...columns, featuresKey: featuresKeyOf(row) };
}

/**
 * The room as the client sees it. From a light row (no features read) the game comes without its features,
 * marked `featuresOmitted`; the client keeps the features it already has for the same `featuresKey`.
 */
function shapeRoom(input: AnyRoomRow, viewerId?: string, knownFeaturesKey = "") {
  // A client that already has these features gets the same slim answer as from a light row.
  const source = knownFeaturesKey && "sharedFeaturesJson" in input && featuresKeyOf(input) === knownFeaturesKey ? lightened(input) : input;
  const light = !("sharedFeaturesJson" in source);
  const row: RoomRow = light ? { ...source, sharedFeaturesJson: "{}", sharedStateBackupJson: "" } : source as RoomRow;
  const game = readGame(row, light);
  if (!light) game.features.travel = settleTravel(game.features.travel, Date.now());
  const redeemedCodes = parseJson<string[]>(row.redeemedBonusCodesJson, []);
  const roomPlayers = getRoomPlayers(row);
  const occupiedPlayers = roomPlayers.filter((player) => Boolean(player.playerId));
  const viewerRole = viewerId ? roomPlayers.find((player) => player.playerId === viewerId)?.role : undefined;
  const now = Date.now();
  const clickState = readClickState(row);
  const voteResult = readPrestigeVoteResult(clickState);
  return {
    code: row.code,
    roomName: row.roomName,
    status: occupiedPlayers.length >= 2 ? "live" : "waiting",
    playerCount: occupiedPlayers.length,
    maxPlayers: COOP_ROLES.length,
    players: roomPlayers.map((player) => ({
      role: player.role,
      name: player.name,
      online: Boolean(player.playerId && isOnline(player.lastSeenAt)),
      occupied: Boolean(player.playerId),
      goals: player.goals,
      clicks: player.clicks,
      // Last activity (rounded to minutes) and whether the host may remove the member without a second confirmation.
      lastActiveAt: player.playerId ? Math.floor(seatLastActiveAt(row, player.role, clickState) / 60_000) * 60_000 : null,
      inactive: Boolean(player.playerId && seatInactive(row, player.role, now, clickState)),
    })),
    inactiveDays: SEAT_INACTIVE_DAYS,
    prestigeVote: prestigeVoteView(row, clickState, now, viewerId),
    prestigeVoteResult: voteResult && now - voteResult.at < 5 * 60_000 ? { ...voteResult, ageMs: Math.max(0, now - voteResult.at) } : null,
    hostName: row.hostName,
    guestName: row.guestName,
    hostOnline: isOnline(row.hostLastSeenAt),
    guestOnline: Boolean(row.guestPlayerId && isOnline(row.guestLastSeenAt)),
    viewerRole,
    canDelete: viewerRole === "host",
    sharedCoins: game.goals,
    hostGoals: row.hostGoals,
    guestGoals: row.guestGoals,
    player3Goals: row.player3Goals,
    player4Goals: row.player4Goals,
    hostClicks: row.hostClicks,
    guestClicks: row.guestClicks,
    player3Clicks: row.player3Clicks,
    player4Clicks: row.player4Clicks,
    sharedUpgradeLevel: Object.values(game.upgrades).reduce((total, level) => total + level, 0),
    revision: Math.max(0, Math.floor(row.sharedStateVersion)),
    testMode: redeemedCodes.includes("AZB"),
    lastPassiveAt: row.lastPassiveAt,
    featuresKey: featuresKeyOf(source),
    featuresOmitted: light,
    game: light ? withoutFeatures({ ...game, lastSaved: Date.now(), sound: true }) : { ...game, lastSaved: Date.now(), sound: true },
  };
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * What a failed request logs: the error code and the first line of the message. A failed query repeats its
 * parameters (the whole shared features) in its message and cause, so neither is logged.
 */
export function describeError(error: unknown) {
  const failure = error as { name?: string; code?: string; message?: string; cause?: { code?: string; message?: string } } | null;
  const code = failure?.code ?? failure?.cause?.code ?? "";
  const message = String(failure?.message ?? "").split("\n")[0].replace(/\bparams:[\s\S]*$/, "").slice(0, 200);
  const cause = String(failure?.cause?.message ?? "").split("\n")[0].slice(0, 200);
  return [failure?.name ?? "Error", code, message, cause].filter(Boolean).join(" | ");
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  console.error("[multiplayer]", describeError(error));
  if (message.includes("no such table") || message.includes("no such column") || message.includes("Failed query")) return "Die Koop-Datenbank wird gerade aktualisiert. Bitte lade die Seite in einem Moment nochmals.";
  if (message === "Die Welt konnte nicht gespeichert werden." || message.startsWith("Cloudflare D1 binding")) return message;
  return "Unbekannter Serverfehler. Bitte erneut versuchen.";
}

// Rows this server instance read or wrote last, keyed by room code. A light read (everything but the big
// features, plus their md5 from Postgres) tells whether the cached features are still current; only when they
// are not does the server read them again. Every byte Postgres sends counts against the Supabase quota.
const roomCache = new Map<string, RoomRow>();
const ROOM_CACHE_LIMIT = 64;
function rememberRoom(room: RoomRow | null) {
  if (!room) return room;
  roomCache.delete(room.code);
  roomCache.set(room.code, room);
  if (roomCache.size > ROOM_CACHE_LIMIT) roomCache.delete(roomCache.keys().next().value!);
  return room;
}
export function clearRoomCacheForTests() {
  roomCache.clear();
}

/** The full world, its features from the cache when Postgres reports the same md5. */
async function loadRoom(code: string) {
  const db = getDb();
  const light = await db.getLightRoom(code);
  if (!light) { roomCache.delete(code); return { db, room: null }; }
  const cached = roomCache.get(code);
  if (cached && featuresKeyOf(cached) === light.featuresKey) {
    const { featuresKey: _key, ...columns } = light;
    void _key;
    return { db, room: rememberRoom({ ...columns, sharedFeaturesJson: cached.sharedFeaturesJson, sharedStateBackupJson: cached.sharedStateBackupJson }) };
  }
  return { db, room: rememberRoom(await db.getRoom(code)) };
}

/**
 * Whether this request has to write the player's presence. Online needs only a rough time, so a seat writes it at
 * most every PRESENCE_TOUCH_INTERVAL_MS. The simulation leader (or the seat that is about to become it) keeps its
 * presence within SIMULATION_LEADER_TIMEOUT_MS, so the leader never changes just because a write was skipped.
 */
export function presenceWriteDue(room: AnyRoomRow, role: CoopRole, now = Date.now()) {
  const lastSeen = Date.parse(getRoomPlayer(room, role).lastSeenAt || "");
  if (!Number.isFinite(lastSeen)) return true;
  const age = now - lastSeen;
  if (age >= PRESENCE_TOUCH_INTERVAL_MS) return true;
  return age >= LEADER_PRESENCE_TOUCH_MS && getSimulationLeaderRole(room, now, role) === role;
}

/** Marks the player as present and puts the fresh seats into the room; no game travels back. */
async function touchPresence<T extends AnyRoomRow>(db: ReturnType<typeof getDb>, room: T, role: CoopRole, at = new Date().toISOString()): Promise<T> {
  if (!presenceWriteDue(room, role, Date.parse(at))) return room;
  const seats: RoomSeats | null = await db.touchRoom(room.code, rolePresenceUpdate(role, at));
  return seats ? { ...room, ...seats } : room;
}

/**
 * A poll from a client that already has the current features: answers from a light read, with the game
 * but without its features. Returns null when the full path is needed (features changed, passive income
 * due, unknown room or player).
 */
async function quickPoll(code: string, playerId: string, knownFeaturesKey: string, passiveMinMs: number, leaderOnly: boolean) {
  if (!knownFeaturesKey) return null;
  const db = getDb();
  const light = await db.getLightRoom(code);
  if (!light || light.featuresKey !== knownFeaturesKey) return null;
  const role = roomRole(light, playerId);
  if (!role) return null;
  const now = Date.now();
  if (hostHandoverDue(light, now, role)) return null;
  const elapsed = now - (Date.parse(light.lastPassiveAt || light.updatedAt) || now);
  // Passive income due: the full path books it with the presence as it was, and only then marks the player present.
  // Marking first would make a long absence look like presence and pay the whole gap.
  if (elapsed >= passiveMinMs && (!leaderOnly || getSimulationLeaderRole(light, now, role) === role)) return null;
  const room = await touchPresence(db, light, role, new Date(now).toISOString());
  return Response.json({ serverNow: Date.now(), room: shapeRoom(room, playerId), role });
}

/**
 * Saves passive income on its own (polls, joins), at most every `minElapsedMs`. Actions book it into their
 * own write instead (mutateWorld). `presence`: the seats as they were before this request marked its player
 * present; past income depends on them.
 */
async function refreshPassive(db: ReturnType<typeof getDb>, room: RoomRow, minElapsedMs = 0, presence: AnyRoomRow = room) {
  const now = Date.now();
  const last = Date.parse(room.lastPassiveAt || room.updatedAt) || now;
  // Passive income and timer shifts are additive over [last, now], so a deferred refresh loses nothing.
  if (now - last < minElapsedMs) return room;
  const writeAt = worldWriteTime(room);
  const game = readGame(room);
  bookPassive(game, room, writeAt, presence);
  // A Prestige vote that is over or complete is settled with this write too (the presence is the one before).
  const settled = settlePrestigeVote(game, presence, writeAt);
  const updated = await writeWorld(db, room, game, new Date(writeAt).toISOString(), settled ? { clickStateJson: nextClickState(room, null, settled.patch) } : {});
  if (updated) return updated;
  return (await loadRoom(room.code)).room ?? room;
}

/**
 * Hands the host seat to the most recently active member once the host has been inactive for SEAT_INACTIVE_DAYS:
 * the two swap seats (with their counters and click states), so the old host stays a member. A versioned world
 * write like every other; it runs again on the newest state after a conflict and does nothing once it is no
 * longer due.
 */
async function handOverInactiveHost(db: ReturnType<typeof getDb>, initial: RoomRow, playerId: string) {
  let room = initial;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const writeAt = worldWriteTime(room);
    const present = roomRole(room, playerId) ?? undefined;
    const successor = hostHandoverDue(room, writeAt, present);
    if (!successor) return room;
    const game = readGame(room);
    bookPassive(game, room, writeAt);
    // The successor's seat moves with its presence of this moment, when it is the member asking.
    const change = seatChange(present ? withPresence(room, present, new Date(writeAt).toISOString()) : room, { handover: successor }, writeAt);
    const timestamp = new Date(writeAt).toISOString();
    addHistory(game.features, { title: "Neuer Host", detail: `${roomPlayerName(room, "host")} war ${SEAT_INACTIVE_DAYS} Tage nicht aktiv. ${roomPlayerName(room, successor)} ist jetzt Host dieser Welt.`, tone: "neutral" }, writeAt);
    const updated = await writeWorld(db, room, game, timestamp, { ...change.columns, clickStateJson: nextClickState(room, null, change.patch) });
    if (updated) return updated;
    const latest = (await loadRoom(room.code)).room;
    if (!latest) return room;
    room = latest;
  }
  return room;
}

function roomRole(room: AnyRoomRow, playerId: string) {
  return getRoomPlayers(room).find((player) => player.playerId === playerId)?.role ?? null;
}

function requireLive(room: RoomRow) {
  return getOccupiedRoomPlayers(room).length >= 2 ? null : jsonError("Warte, bis der zweite Spieler beigetreten ist.", 409);
}

async function handleGet(request: Request) {
  try {
    const limited = rateLimited(request, "multiplayer");
    if (limited) return limited;
    const url = new URL(request.url);
    if (!isSupportedMultiplayerProtocol(url.searchParams.get("protocol"))) return jsonError(MULTIPLAYER_UPDATE_MESSAGE, 426);
    const playerId = cleanPlayerId(url.searchParams.get("playerId"));
    if (!playerId) return jsonError("Spieler-ID fehlt.");
    const auth = await resolvePlayer(request, playerId, { loginRequired: true });
    if (!auth.ok) return auth.response;
    if (url.searchParams.get("list") === "1") {
      const db = getDb();
      const rooms = await db.listRoomsForPlayer(playerId);
      return Response.json({ rooms: rooms.map((item) => shapeRoom(item, playerId)) });
    }
    const code = cleanCode(url.searchParams.get("code"));
    if (!code) return jsonError("Raumcode fehlt.");
    const knownFeaturesKey = url.searchParams.get("featuresKey") ?? "";
    const quick = await quickPoll(code, playerId, knownFeaturesKey, GET_PASSIVE_REFRESH_MIN_MS, false);
    if (quick) return quick;
    const { db, room } = await loadRoom(code);
    if (!room) return jsonError("Raum nicht gefunden.", 404);
    const askingRole = roomRole(room, playerId);
    if (!askingRole) return jsonError("Du bist nicht in diesem Raum.", 403);
    const handedOver = hostHandoverDue(room, Date.now(), askingRole) ? await handOverInactiveHost(db, room, playerId) : room;
    const role = roomRole(handedOver, playerId);
    if (!role) return jsonError("Du bist nicht in diesem Raum.", 403);
    const refreshed = await refreshPassive(db, handedOver, GET_PASSIVE_REFRESH_MIN_MS);
    return Response.json({ serverNow: Date.now(), room: shapeRoom(await touchPresence(db, refreshed, role), playerId, knownFeaturesKey), role });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

async function handlePost(request: Request) {
  try {
    const limited = rateLimited(request, "multiplayer");
    if (limited) return limited;
    const refused = refuseUnsafePost(request);
    if (refused) return refused;
    const payload = await readJsonBody<{
      action?: unknown;
      mode?: unknown;
      groupId?: unknown;
      code?: unknown;
      playerId?: unknown;
      nickname?: unknown;
      amount?: unknown;
      clickCount?: unknown;
      upgradeId?: unknown;
      count?: unknown;
      reward?: unknown;
      minigameId?: unknown;
      transferId?: unknown;
      packId?: unknown;
      lineupIndex?: unknown;
      changes?: unknown;
      benchIndex?: unknown;
      starPlayerId?: unknown;
      formationId?: unknown;
      strategy?: unknown;
      purchaseId?: unknown;
      requestId?: unknown;
      keepNormalId?: unknown;
      expectedPrestigeCount?: unknown;
      draft?: unknown;
      direction?: unknown;
      expectedPenaltyStep?: unknown;
      tournamentId?: unknown;
      missionId?: unknown;
      goalId?: unknown;
      name?: unknown;
      badge?: unknown;
      color?: unknown;
      roomName?: unknown;
      preferredRole?: unknown;
      matchId?: unknown;
      questionId?: unknown;
      answerIndex?: unknown;
      protocol?: unknown;
      featuresKey?: unknown;
      actionId?: unknown;
      targetRole?: unknown;
      force?: unknown;
      voteId?: unknown;
      decision?: unknown;
    }>(request, MAX_MULTIPLAYER_BODY_BYTES);
    if (!isSupportedMultiplayerProtocol(payload.protocol)) return jsonError(MULTIPLAYER_UPDATE_MESSAGE, 426);
    const action = typeof payload.action === "string" ? payload.action : "";
    const playerId = cleanPlayerId(payload.playerId);
    const nickname = cleanName(payload.nickname);
    if (playerId.length < 8) return jsonError("Spieler-ID fehlt.");
    // With Google login the world seats belong to the account's player ID, not to whoever knows the ID.
    const auth = await resolvePlayer(request, playerId, { loginRequired: true });
    if (!auth.ok) return auth.response;

    if (action === "create") {
      if (nickname.length < 2) return jsonError("Der Spielername muss mindestens 2 Zeichen haben.");
      const db = getDb();
      const now = new Date().toISOString();
      const roomName = cleanRoomName(payload.roomName, `${nickname}s Welt`);
      // The insert itself decides whether a code is free: a taken code (also one taken a moment ago by a
      // concurrent request) gives null and the next code is tried.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const room = await db.insertRoom({ code: makeRoomCode(), roomName, hostPlayerId: playerId, hostName: nickname, hostLastSeenAt: now, lastPassiveAt: now, updatedAt: now });
        if (room) return Response.json({ serverNow: Date.now(), room: shapeRoom(room, playerId), role: "host" }, { status: 201 });
      }
      return jsonError("Es konnte gerade kein freier Raumcode erzeugt werden. Bitte erneut versuchen.", 503);
    }

    const code = cleanCode(payload.code);
    if (!code) return jsonError("Raumcode fehlt.");
    // The regular background poll of a live world: nothing to send but counters and seats most of the time.
    if (action === "tick") {
      const quick = await quickPoll(code, playerId, typeof payload.featuresKey === "string" ? payload.featuresKey : "", TICK_PASSIVE_REFRESH_MIN_MS, true);
      if (quick) return quick;
    }
    const loaded = await loadRoom(code);
    let room = loaded.room;
    const db = loaded.db;
    if (!room) return jsonError("Raum nicht gefunden.", 404);

    if (action === "join") {
      if (nickname.length < 2) return jsonError("Der Spielername muss mindestens 2 Zeichen haben.");
      const now = new Date().toISOString();
      const requestedRole = typeof payload.preferredRole === "string" && COOP_ROLES.includes(payload.preferredRole as CoopRole) ? payload.preferredRole as CoopRole : null;
      const directRole = roomRole(room, playerId);
      const hasSameName = (player: ReturnType<typeof getRoomPlayer>) => player.name?.localeCompare(nickname, "de-CH", { sensitivity: "base" }) === 0;
      // Name based recovery may only reclaim a seat whose owner is offline. An active
      // player can never be displaced by someone who only knows the code and the name.
      // With accounts a seat belongs to the account's player ID, which follows the player to every device,
      // so a seat is never handed over by name: a nickname and an expired presence prove no ownership.
      const isReclaimable = (player: ReturnType<typeof getRoomPlayer>) => nameRecoveryAllowed(auth.accountId) && Boolean(player.playerId) && !isOnline(player.lastSeenAt);
      const sameNamePlayers = getOccupiedRoomPlayers(room).filter(hasSameName);
      const matchingNameRoles = sameNamePlayers.filter(isReclaimable).map((player) => player.role);
      const requestedPlayer = requestedRole ? getRoomPlayer(room, requestedRole) : null;
      const restoredRole = requestedPlayer?.playerId && hasSameName(requestedPlayer) && isReclaimable(requestedPlayer)
        ? requestedRole
        : matchingNameRoles.length === 1
          ? matchingNameRoles[0]
          : null;
      // A page reload of a member who left or was removed brings the stored room back with its old role; it does not
      // take a free seat by itself. Joining again with the code (no stored role) is allowed while a seat is free.
      if (!directRole && requestedRole && readStringMap(readClickState(room), REMOVED_KEY)[playerId]) return jsonError("Du bist nicht mehr in dieser Welt. Mit dem Raumcode kannst du wieder beitreten, wenn ein Platz frei ist.", 403);
      const reconnectRole = directRole ?? restoredRole;
      if (reconnectRole) {
        room = await refreshPassive(db, room);
        const seatOwner = getRoomPlayer(room, reconnectRole).playerId ?? null;
        const reconnected = await db.updateRoom(code, { ...roleIdentityUpdate(reconnectRole, playerId, nickname, now), updatedAt: now }, { seat: { role: reconnectRole, playerId: seatOwner } });
        if (!reconnected) return jsonError("Dieser Platz wurde gerade neu vergeben. Bitte erneut versuchen.", 409);
        return Response.json({ serverNow: Date.now(), room: shapeRoom(reconnected, playerId), role: reconnectRole });
      }
      if (sameNamePlayers.some((player) => isOnline(player.lastSeenAt))) return jsonError("Dieser Spielername ist in dieser Welt gerade aktiv. Wähle einen anderen Namen oder versuche es in drei Minuten erneut.", 409);

      let joinRoom: RoomRow = room;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const candidateRoom = joinRoom;
        const openRole = (["guest", "player3", "player4"] as const).find((role) => !getRoomPlayer(candidateRoom, role).playerId);
        if (!openRole) return jsonError("Dieser Raum ist bereits voll. Maximal vier Spieler können gemeinsam spielen.", 409);
        const wasWaiting = getOccupiedRoomPlayers(candidateRoom).length < 2;
        const joined = await db.updateRoom(code, {
          ...roleIdentityUpdate(openRole, playerId, nickname, now),
          ...(wasWaiting ? { lastPassiveAt: now } : {}),
          updatedAt: now,
        }, { seat: { role: openRole, playerId: null } });
        if (joined) return Response.json({ serverNow: Date.now(), room: shapeRoom(joined, playerId), role: openRole });
        const latest = await db.getRoom(code);
        if (!latest) return jsonError("Raum nicht gefunden.", 404);
        joinRoom = latest;
      }
      return jsonError("Der Raum wurde gerade gleichzeitig betreten. Bitte erneut versuchen.", 409);
    }

    const askingRole = roomRole(room, playerId);
    if (!askingRole) return jsonError("Du bist nicht in diesem Raum.", 403);
    // A host inactive for days hands the host seat over to the most recently active member first.
    if (action !== "presence-offline" && hostHandoverDue(room, Date.now(), askingRole)) room = await handOverInactiveHost(db, room, playerId);
    const role = roomRole(room, playerId);
    if (!role) return jsonError("Du bist nicht in diesem Raum.", 403);
    if (action === "delete") {
      if (role !== "host") return jsonError("Nur der Host kann diesen Raum löschen.", 403);
      await db.deleteRoom(code);
      return Response.json({ deleted: true, role });
    }
    if (action === "rename-room") {
      if (role !== "host") return jsonError("Nur der Host kann den Namen dieser Welt ändern.", 403);
      const roomName = cleanRoomName(payload.roomName, room.roomName);
      const renamed = await db.updateRoom(code, { roomName, updatedAt: new Date().toISOString() });
      return Response.json({ serverNow: Date.now(), room: shapeRoom(renamed ?? room, playerId), role });
    }
    const knownFeaturesKey = typeof payload.featuresKey === "string" ? payload.featuresKey.slice(0, 64) : "";
    const isBackgroundAction = action === "tick" || action === "cup-tick";
    // Foreground actions may carry an id, so a resend after a lost answer is answered from its receipt.
    const actionId = !isBackgroundAction && action !== "click" && typeof payload.actionId === "string" ? payload.actionId.slice(0, 80) : "";
    const context: WorldContext = { db, playerId, role, action, knownFeaturesKey, actionId };
    if (action === "presence-offline") {
      // The income of the time before is booked with the presence as it was, in the same write as the offline mark.
      const offlineAt = "1970-01-01T00:00:00.000Z";
      // The offline mark hides when the member was last active, so that time is kept for the seat management.
      const seenPatch = (state: ClickState) => { state[SEEN_KEY] = { ...readStringMap(state, SEEN_KEY), [playerId]: new Date().toISOString() }; };
      return mutateWorld({ ...context, actionId: "" }, room, (game, current, timestamp) => persistGameResponse(db, current, game, timestamp, playerId, role, rolePresenceUpdate(role, offlineAt), {}, { clickStatePatch: seenPatch }), { passive: true, touch: false, settleTravel: false });
    }
    if (action === "leave-seat" || action === "kick") {
      // Seats change in a versioned world write; the world, its progress and the other seats stay as they are.
      return mutateWorld(context, room, (game, current, timestamp) => {
        const now = Date.parse(timestamp);
        const own = roomRole(current, playerId);
        if (!own) return jsonError("Du bist nicht in diesem Raum.", 403);
        const members = getOccupiedRoomPlayers(current);
        let leaving: CoopRole;
        if (action === "leave-seat") {
          // The last member keeps the world: leaving would leave a world nobody can open, rename or delete.
          if (members.length <= 1) return jsonError("Du bist das letzte Mitglied dieser Welt. Lösche die Welt, wenn du sie nicht mehr brauchst.", 409);
          leaving = own;
        } else {
          if (own !== "host") return jsonError("Nur der Host kann Mitspieler entfernen.", 403);
          const target = typeof payload.targetRole === "string" && COOP_ROLES.includes(payload.targetRole as CoopRole) ? payload.targetRole as CoopRole : null;
          if (!target || target === "host") return jsonError("Diesen Platz kannst du nicht freigeben.");
          if (!getRoomPlayer(current, target).playerId) return jsonError("Dieser Platz ist schon frei.", 409);
          // An inactive member can be removed at once; an active one only after the host confirmed it a second time.
          if (!seatInactive(current, target, now) && payload.force !== true) return jsonError(`${roomPlayerName(current, target)} war in den letzten ${SEAT_INACTIVE_DAYS} Tagen aktiv. Bestätige das Entfernen ausdrücklich.`, 409);
          leaving = target;
        }
        const leaverName = roomPlayerName(current, leaving);
        const successor = leaving === "host" ? hostSuccessor(current, undefined, leaving) : null;
        const change = seatChange(current, { leaving, handover: successor ?? undefined }, now);
        const detail = action === "kick" ? `${leaverName} wurde vom Host aus der Welt entfernt.` : `${leaverName} hat die Welt verlassen.`;
        addHistory(game.features, { title: action === "kick" ? "Mitspieler entfernt" : "Mitspieler gegangen", detail: successor ? `${detail} ${roomPlayerName(current, successor)} ist jetzt Host.` : detail, tone: "neutral" }, now);
        return persistGameResponse(db, current, game, timestamp, playerId, role, change.columns, { left: leaving, newHost: successor }, { clickStatePatch: change.patch, strict: true });
      }, { passive: true, touch: true, settleTravel: false });
    }
    let presenceBefore: AnyRoomRow | undefined;
    if (isBackgroundAction) {
      const presenceTimestamp = new Date().toISOString();
      const beforePresence = room;
      room = await touchPresence(db, room, role, presenceTimestamp);
      if (getSimulationLeaderRole(room, Date.parse(presenceTimestamp)) !== role) return Response.json({ serverNow: Date.now(), room: shapeRoom(room, playerId, knownFeaturesKey), role });
      presenceBefore = beforePresence;
      if (action === "tick") {
        // The leader books passive income every few seconds; most of the time only the counters change.
        const last = Date.parse(room.lastPassiveAt || room.updatedAt) || Date.now();
        if (Date.now() - last < TICK_PASSIVE_REFRESH_MIN_MS) return Response.json({ serverNow: Date.now(), room: shapeRoom(room, playerId, knownFeaturesKey), role });
        return mutateWorld(context, room, (game, current, timestamp) => {
          // An open Prestige vote ends here when nobody answers: expired, proposer gone, or every member who still had
          // to agree went offline (then it passes).
          const settled = settlePrestigeVote(game, current, Date.parse(timestamp));
          return persistGameResponse(db, current, game, timestamp, playerId, role, {}, {}, settled ? { clickStatePatch: settled.patch } : {});
        }, { passive: true, presence: beforePresence, touch: false, settleTravel: false });
      }
    }
    // Lobby codes are switched off; worlds that redeemed AZB earlier keep their test mode.
    if (action === "redeem-lobby-code") return jsonError("Lobby Codes sind deaktiviert.", 409);
    const liveError = requireLive(room);
    if (liveError) return liveError;
    const testMode = parseJson<string[]>(room.redeemedBonusCodesJson, []).includes("AZB");

    if (action === "click") {
      // Clicks arrive every few hundred milliseconds. Passive income adds up over time, so it is booked at most every
      // few seconds (counters only, unless timers moved) instead of on each batch; the click marks the player present.
      room = await refreshPassive(db, room, TICK_PASSIVE_REFRESH_MIN_MS);
      const clickGame = readGame(room);
      const clickPower = getClickPower(clickGame.upgrades, clickGame.stars, clickGame.features, Date.now());
      const requested = Math.max(1, Math.min(50, Math.floor(finite(payload.clickCount, 1))));
      // The client only says how often it clicked; budget, combo, streak and critical hits are the server's.
      let clickRoom: AnyRoomRow = room;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const previous = readServerClickState(parseJson<Record<string, unknown>>(clickRoom.clickStateJson, {})[role]);
        const now = Date.now();
        const clicks = applyServerClicks(previous, requested, now, clickPower);
        if (!clicks.accepted) return jsonError("Zu viele Klicks in zu kurzer Zeit.", 429);
        const updated = await db.applyClick(code, role, clicks.amount, clicks.accepted, new Date(now).toISOString(), previous, clicks.state, rolePresenceUpdate(role, new Date(now).toISOString()), playerId);
        if (updated) return Response.json({ serverNow: Date.now(), room: shapeRoom(updated, playerId), role, clicks: { accepted: clicks.accepted, amount: clicks.amount } });
        // Another click batch of this seat came first; count on top of it.
        const fresh = await db.getLightRoom(code);
        if (!fresh) return jsonError("Dieser Raum wurde gelöscht.", 404);
        // The seat was given up or handed over meanwhile: the clicks belong to nobody's seat any more.
        if (roomRole(fresh, playerId) !== role) return jsonError("Du bist nicht in diesem Raum.", 403);
        clickRoom = fresh;
      }
      return jsonError("Die Klicks konnten gerade nicht gezählt werden.", 409);
    }

    // Every other action runs against the current world inside mutateWorld: passive income goes into the action's
    // own write, the presence too (foreground), and a conflict runs the action again on the newest state.
    const applyAction = async (game: CoopGameState, room: RoomRow, timestamp: string): Promise<ActionOutcome> => {
    if (action === "starter-squad") {
      // Once per world: the flag lives in the shared features and is written with the version check.
      const result = maybeGrantStarterSquad(game.features, game.clicks, Date.now());
      if (!result) return jsonError("Der Starterkader wurde in dieser Welt schon vergeben.", 409);
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { starterSquad: { added: result.added.length, complete: result.complete } });
    }

    if (action === "daily-claim") {
      const claim = claimDailyReward(game.features.dailyRewards, WORLD_DAILY_KEY, getBasePassivePower(game.upgrades, game.stars, game.features), getBaseClickPower(game.upgrades, game.stars, game.features), Date.now());
      if (!claim) return jsonError("Die tägliche Prämie für heute ist schon abgeholt.", 409);
      game.features.dailyRewards = claim.state;
      game.goals += claim.amount;
      game.seasonGoals += claim.amount;
      game.totalGoals += claim.amount;
      if (claim.pack && !game.features.earnedPacks.some((pack) => pack.id === claim.pack!.id)) game.features.earnedPacks.push(claim.pack);
      addHistory(game.features, { title: `Tägliche Prämie · Tag ${claim.dayIndex}`, detail: `${getRoomPlayer(room, role).name ?? "Ein Spieler"} holt ${Math.floor(claim.amount).toLocaleString("de-CH")} Tore${claim.pack ? " und ein Prämienpack" : ""}. Serie: ${claim.streak} Tage.`, tone: "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { dailyReward: { amount: claim.amount, dayIndex: claim.dayIndex, streak: claim.streak, pack: Boolean(claim.pack) } });
    }

    if (action === "press-answer") {
      const matchId = typeof payload.matchId === "string" ? payload.matchId.slice(0, 200) : "";
      const questionId = typeof payload.questionId === "string" ? payload.questionId.slice(0, 40) : "";
      const answerIndex = Math.floor(finite(payload.answerIndex, -1));
      const result = answerPressConference(game.features.press, game.features.cup, game.features.club.name, matchId, questionId, answerIndex, Date.now());
      if (!result) return jsonError("Diese Pressekonferenz ist schon vorbei.", 409);
      const reward = getPressReward(getBasePassivePower(game.upgrades, game.stars, game.features), getBaseClickPower(game.upgrades, game.stars, game.features));
      game.features.press = result.press;
      game.goals += reward;
      game.seasonGoals += reward;
      game.totalGoals += reward;
      addHistory(game.features, { title: "Pressekonferenz", detail: `«${result.answer}» · Fanstimmung ${result.mood >= 0 ? "+" : ""}${result.mood}`, tone: result.mood >= 0 ? "positive" : "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { press: { reward, mood: result.mood, fanMood: result.fanMood } });
    }

    if (action === "transfer-insider-event") {
      const transferNow = Date.now();
      // An unanswered offer runs out first; while it is open Fabrizio brings nothing new.
      const offer = game.features.transferSaga.pendingOffer;
      if (offer) {
        const expired = expireTransferOffer(game.features, transferNow);
        if (!expired.event && !expired.deferred) return unchanged();
        game.features = expired.features;
        return persistGameResponse(db, room, game, timestamp, playerId, role);
      }
      if (game.features.transferSaga.nextAt > transferNow) return unchanged();
      if (game.features.squadLock || game.features.cup.active) return Response.json({ serverNow: Date.now(), room: shapeRoom(room, playerId), role });
      const result = resolveTransferInsiderEvent(game.features, Math.random, transferNow);
      game.features = result.features;
      game.goals += result.goalDelta;
      game.seasonGoals += result.goalDelta;
      game.totalGoals += result.goalDelta;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "transfer-accept" || action === "transfer-decline") {
      // Anyone in the world may answer; the version check on saving lets only the first answer count.
      const hadOffer = Boolean(game.features.transferSaga.pendingOffer);
      const result = action === "transfer-accept" ? acceptTransferOffer(game.features, Date.now()) : declineTransferOffer(game.features, Date.now());
      // Still open (match running) or already answered by someone else: nothing to save.
      if (!hadOffer || result.features.transferSaga.pendingOffer) return jsonError(result.error ?? "Es liegt kein Angebot vor.", 409);
      game.features = result.features;
      game.goals += result.goalDelta;
      game.seasonGoals += result.goalDelta;
      game.totalGoals += result.goalDelta;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "event") {
      if (game.features.squadLock) return unchanged();
      if (game.features.nextEventAt > Date.now()) return unchanged();
      const event = resolveRandomEvent(game.goals, getBasePassivePower(game.upgrades, game.stars, game.features));
      game.goals = Math.max(0, game.goals + event.amount);
      game.seasonGoals = Math.max(0, game.seasonGoals + event.amount);
      game.totalGoals = Math.max(0, game.totalGoals + Math.max(0, event.amount));
      game.features.randomEvent = event;
      game.features.nextEventAt = Date.now() + getRandomEventDelay();
      addHistory(game.features, { title: event.title, detail: event.message, tone: event.tone });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "var-event") {
      if (game.features.squadLock) return unchanged();
      if (game.features.nextVarAt > Date.now()) return unchanged();
      const event = resolveVarEvent(game.goals, getBasePassivePower(game.upgrades, game.stars, game.features));
      game.goals = Math.max(0, game.goals + event.amount);
      game.seasonGoals = Math.max(0, game.seasonGoals + event.amount);
      game.totalGoals = Math.max(0, game.totalGoals + Math.max(0, event.amount));
      game.features.randomEvent = event;
      game.features.nextVarAt = Date.now() + getRandomEventDelay();
      addHistory(game.features, { title: event.title, detail: event.message, tone: event.tone });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "buy") {
      const upgradeId = typeof payload.upgradeId === "string" ? payload.upgradeId : "";
      if (!getUpgrade(upgradeId)) return jsonError("Dieses Upgrade gibt es nicht.");
      const requestedCount = finite(payload.count, 1);
      // Checked and paid against the game of this attempt; mutateWorld retries a conflict on the newest goals.
      const upgradeUnlockLeague = getUpgradeUnlockLeague(upgradeId);
      if (getLevel(game.upgrades, upgradeId) === 0 && !isLeagueContentUnlocked(upgradeUnlockLeague, reachedLeagueOf(game), testMode)) return jsonError(`Dieses Upgrade wird ab Liga ${upgradeUnlockLeague} freigeschaltet.`, 409);
      const purchase = getBulkPurchase(upgradeId, game, requestedCount, testMode);
      if (purchase.count === 0) {
        const price = getCost(getUpgrade(upgradeId)!, game.upgrades);
        return jsonError(`${getUpgrade(upgradeId)!.name} kostet ${price.toLocaleString("de-CH")} Tore.`);
      }
      if (!testMode) game.goals -= purchase.totalCost;
      game.upgrades[upgradeId] = getLevel(game.upgrades, upgradeId) + purchase.count;
      // Who bought what (Q62); purchases of one member within a few minutes share one entry (addHistory).
      addHistory(game.features, { title: "Upgrade gekauft", detail: `${getUpgrade(upgradeId)!.name} auf Level ${game.upgrades[upgradeId]}${purchase.count > 1 ? ` (+${purchase.count})` : ""}.`, tone: "neutral", kind: "upgrade" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "transfer-buy") return jsonError(TRANSFER_MARKET_CLOSED_MESSAGE, 410);
    if (action === "transfer-refresh") return jsonError(TRANSFER_MARKET_CLOSED_MESSAGE, 410);

    if (action === "profile") {
      const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/g, " ").slice(0, 22) : "FC Goal";
      const badge = typeof payload.badge === "string" && ["⚽", "🦅", "🔥", "🦁", "⭐", "🛡️"].includes(payload.badge) ? payload.badge : "⚽";
      const color = typeof payload.color === "string" && ["#0071e3", "#1d1d1f", "#e85d04", "#16845b", "#8b5cf6", "#d12c54"].includes(payload.color) ? payload.color : "#0071e3";
      game.features.club = { name: name || "FC Goal", badge, color };
      game.features.seasonMode.table = game.features.seasonMode.table.map((team) => team.id === "club" ? { ...team, name: game.features.club.name } : team);
      game.features.seasonMode.lastTable = game.features.seasonMode.lastTable.map((team) => team.id === "club" ? { ...team, name: game.features.club.name } : team);
      addHistory(game.features, { title: "Clubprofil aktualisiert", detail: `${badge} ${game.features.club.name} ist bereit.`, tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-formation") {
      const formationId = typeof payload.formationId === "string" ? payload.formationId as StarFormationId : "433";
      if (game.features.cup.active) return jsonError("Während eines laufenden Spiels kann die Formation nicht geändert werden.", 409);
      if (!STAR_FORMATIONS.some((formation) => formation.id === formationId)) return jsonError("Diese Formation ist ungültig.", 409);
      const formationUnlockLeague = getFormationUnlockLeague(formationId);
      if (!isLeagueContentUnlocked(formationUnlockLeague, reachedLeagueOf(game), testMode)) return jsonError(`Diese Formation wird ab Liga ${formationUnlockLeague} freigeschaltet.`, 409);
      const formation = getStarFormation(formationId);
      game.features.starXI = setStarXIFormation(game.features.starXI, formationId, getUnavailableStarXIPlayerIds(game.features));
      addHistory(game.features, { title: "Formation angepasst", detail: `Die Startelf spielt jetzt im ${formation.label}.`, tone: "neutral", kind: "squad" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if(action==='cup-substitutions'){
      if(!Array.isArray(payload.changes)||payload.changes.length>5)return jsonError('Ungültiges Wechselpaket.',409);
      const changes=payload.changes.map(x=>({playerId:String(x?.playerId??''),slot:Number(x?.slot)}));
      const error=queueMatchChanges(game.features,changes,Date.now());
      if(error)return jsonError(error,409);
      return persistGameResponse(db,room,game,timestamp,playerId,role);
    }

    if (action === "star-lineup") {
      if(game.features.cup.active && game.features.squadLock && !game.features.squadLock.playerIds.includes(String(payload.starPlayerId))) return jsonError('Dieser Spieler gehört nicht zum Spieltagskader.',409);
      if(game.features.cup.active&&game.features.cup.simulation)return jsonError('Nutze Wechsel in der Matchansicht.',409);
      const lineupIndex = Number(payload.lineupIndex);
      const starPlayerId = typeof payload.starPlayerId === "string" ? payload.starPlayerId : "";
      const starPlayer = getStarXIPlayer(starPlayerId);
      if(game.features.cup.active){
        const error=queueMatchChanges(game.features,[{playerId:starPlayerId,slot:lineupIndex}],Date.now());
        if(error)return jsonError(error,409);
        return persistGameResponse(db,room,game,timestamp,playerId,role);
      }
      if (!Number.isInteger(lineupIndex) || lineupIndex < 0 || lineupIndex >= STAR_XI_SQUAD_SIZE) return jsonError("Dieser Aufstellungsplatz ist ungültig.", 409);
      if (!starPlayer || !game.features.starXI.ownedIds.includes(starPlayerId)) return jsonError("Dieser Spieler gehört noch nicht zum Kader.", 409);
      if (game.features.transferSaga.loans.some((loan) => loan.playerId === starPlayerId)) return jsonError(`${starPlayer.name} ist ausgeliehen und aktuell nicht im Team.`, 409);
      if (game.features.cup.suspendedPlayerIds.includes(starPlayerId)) return jsonError(`${starPlayer.name} ist nach der Roten Karte für die nächste Partie gesperrt.`, 409);
      if (!game.features.starXI.lineupIds.includes(starPlayerId) && !game.features.starXI.benchIds.includes(starPlayerId) && getBannedPlayerIds(game.features, nextCompetition(game.features)).includes(starPlayerId)) return jsonError(`${starPlayer.name} ist ${banCause(game.features, nextCompetition(game.features), [starPlayerId])} für das nächste Spiel gesperrt.`, 409);
      if (!canStarXIPlayerFillSlot(starPlayerId, lineupIndex, game.features.starXI.formationPositions)) return jsonError(`${starPlayer.name} kann auf dieser Position nicht spielen.`, 409);
      const comesFromBench = game.features.starXI.benchIds.includes(starPlayerId);
      if (game.features.cup.active && !comesFromBench) return jsonError("Im laufenden Spiel darf nur von der Bank gewechselt werden.", 409);
      if (game.features.cup.active && game.features.cup.substitutionsUsed >= STAR_XI_MAX_SUBSTITUTIONS) return jsonError("Alle fünf Wechsel sind bereits gebraucht.", 409);
      if (game.features.cup.active && game.features.cup.playerExitedAt[starPlayerId]) return jsonError(`${starPlayer.name} wurde bereits ausgewechselt und darf nicht zurück aufs Feld.`, 409);
      const outgoingPlayerId = game.features.starXI.lineupIds[lineupIndex];
      if (game.features.cup.active && outgoingPlayerId && game.features.cup.sentOffPlayerIds.includes(outgoingPlayerId)) {
        const outgoingPlayer = getStarXIPlayer(outgoingPlayerId);
        return jsonError(`${outgoingPlayer?.name ?? "Dieser Spieler"} kann nach einer Roten Karte nicht ausgewechselt werden.`, 409);
      }
      game.features.starXI = setStarXIStarter(game.features.starXI, lineupIndex, starPlayerId, getUnavailableStarXIPlayerIds(game.features));
      if (game.features.cup.active) {
        const substitutionMinute = getCupMatchMinute(game.features.cup, Date.now());
        game.features.cup = applyCupSubstitution(game.features.cup, outgoingPlayerId, starPlayerId, substitutionMinute).cup;
        if (outgoingPlayerId) game.features.cup.playerExitedAt[outgoingPlayerId] = Math.min(game.features.cup.playerExitedAt[outgoingPlayerId] ?? substitutionMinute, substitutionMinute);
        game.features.cup.playerEnteredAt[starPlayerId] = substitutionMinute;
        game.features.cup.playerMatchPositions[starPlayerId] = game.features.starXI.formationPositions[lineupIndex] ?? starPlayer.position;
        game.features.cup.substitutionsUsed += 1;
      }
      addHistory(game.features, { title: game.features.cup.active ? `${starPlayer.name} eingewechselt` : "Star XI umgestellt", detail: `${starPlayer.name} spielt jetzt auf Platz ${lineupIndex + 1}.`, tone: "neutral", ...(game.features.cup.active ? {} : { kind: "squad" as const }) });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-best-lineup") {
      if (game.features.cup.active) return jsonError("Während eines Pokalspiels kann die Startelf nicht automatisch geändert werden.", 409);
      game.features.starXI = setBestStarXI(game.features.starXI, getBestXIUnavailablePlayerIds(game.features), { career: game.features.career, cup: game.features.cup });
      const selectedCount = game.features.starXI.lineupIds.filter(Boolean).length;
      if (!selectedCount) return jsonError("Du hast noch keine passenden Spieler im Kader.", 409);
      addHistory(game.features, { title: "Beste Startelf aufgestellt", detail: `${selectedCount} von ${STAR_XI_SQUAD_SIZE} Positionen mit den stärksten passenden Spielern besetzt.`, tone: "positive", kind: "squad" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    // "Lücken füllen": only empty and unavailable places change; every other choice of the players stays.
    if (action === "star-fill-gaps") {
      if (game.features.cup.active) return jsonError("Während eines Spiels füllst du Lücken über die Wechsel.", 409);
      const { starXI, replacements } = fillStarXIGaps(game.features, { career: game.features.career, cup: game.features.cup });
      if (!replacements.length) return jsonError("Es gibt keine Lücke, die ein passender Spieler füllen kann.", 409);
      game.features.starXI = starXI;
      addHistory(game.features, { title: "Lücken gefüllt", detail: describeReplacements(replacements).join(" · "), tone: "neutral", kind: "squad" });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { replacements: describeReplacements(replacements) });
    }

    if (action === "star-best-bench") {
      if (game.features.cup.active) return jsonError("Während des Spiels kann die Bank nicht neu zusammengestellt werden.", 409);
      game.features.starXI = withBestBench(game.features, { career: game.features.career, cup: game.features.cup });
      addHistory(game.features, { title: "Beste Bank aufgestellt", detail: `${game.features.starXI.benchIds.filter(Boolean).length} Bankplätze mit den stärksten passenden Spielern besetzt.`, tone: "neutral", kind: "squad" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    // A player leaves his place without a replacement: onto an empty bench place, or back to the reserve.
    if (action === "star-unassign") {
      if (game.features.cup.active) return jsonError("Während des Spiels wechselst du nur über die Wechsel.", 409);
      const starPlayerId = typeof payload.starPlayerId === "string" ? payload.starPlayerId : "";
      const toBench = payload.benchIndex !== undefined && payload.benchIndex !== null;
      const next = toBench ? movePlayerToEmptyBench(game.features.starXI, starPlayerId, Number(payload.benchIndex)) : movePlayerToReserve(game.features.starXI, starPlayerId);
      if (!next) return jsonError("Dieser Spieler kann dort nicht abgelegt werden.", 409);
      game.features.starXI = next;
      addHistory(game.features, { title: "Kader umgestellt", detail: `${getStarXIPlayer(starPlayerId)?.name ?? "Spieler"} ${toBench ? "sitzt jetzt auf der Bank" : "ist jetzt in der Reserve"}.`, tone: "neutral", kind: "squad" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    // "Turnier aufgeben" (Q51): ends a run that waits for its next round, like an elimination.
    if (action === "cup-abandon") {
      const abandoned = abandonTournamentRun(game.features, Date.parse(timestamp));
      if (!abandoned) return jsonError("Es wartet kein Turnierlauf, der aufgegeben werden kann.", 409);
      game.features = abandoned;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    // Favourite cards (Q38) are shared by the world like the squad itself.
    if (action === "star-favorite") {
      const starPlayerId = typeof payload.starPlayerId === "string" ? payload.starPlayerId : "";
      if (!toggleFavoriteCard(game.features, starPlayerId)) return jsonError("Diese Karte gehört nicht zum Club.", 409);
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "star-bench") {
      if(game.features.cup.active && game.features.squadLock && !game.features.squadLock.playerIds.includes(String(payload.starPlayerId))) return jsonError('Dieser Spieler gehört nicht zum Spieltagskader.',409);
      const benchIndex = Number(payload.benchIndex);
      const starPlayerId = typeof payload.starPlayerId === "string" ? payload.starPlayerId : "";
      const starPlayer = getStarXIPlayer(starPlayerId);
      if (!Number.isInteger(benchIndex) || benchIndex < 0 || benchIndex >= STAR_XI_BENCH_SIZE) return jsonError("Dieser Bankplatz ist ungültig.", 409);
      if (!starPlayer || !game.features.starXI.ownedIds.includes(starPlayerId) || game.features.starXI.lineupIds.includes(starPlayerId)) return jsonError("Dieser Spieler kann nicht auf die Bank verschoben werden.", 409);
      if (game.features.transferSaga.loans.some((loan) => loan.playerId === starPlayerId)) return jsonError(`${starPlayer.name} ist ausgeliehen und aktuell nicht im Team.`, 409);
      if (game.features.cup.suspendedPlayerIds.includes(starPlayerId)) return jsonError(`${starPlayer.name} darf nach einer Roten Karte nicht auf die Bank.`, 409);
      if (!game.features.starXI.lineupIds.includes(starPlayerId) && !game.features.starXI.benchIds.includes(starPlayerId) && getBannedPlayerIds(game.features, nextCompetition(game.features)).includes(starPlayerId)) return jsonError(`${starPlayer.name} ist ${banCause(game.features, nextCompetition(game.features), [starPlayerId])} für das nächste Spiel gesperrt.`, 409);
      if (game.features.cup.active) return jsonError("Während des Spiels kann die Bank nicht neu zusammengestellt werden.", 409);
      game.features.starXI = setStarXIBenchPlayer(game.features.starXI, benchIndex, starPlayerId, getUnavailableStarXIPlayerIds(game.features));
      addHistory(game.features, { title: "Bank umgestellt", detail: `${starPlayer.name} sitzt jetzt auf Bankplatz ${benchIndex + 1}.`, tone: "neutral", kind: "squad" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if(action==='reward-pack') {
      const id=typeof (payload as unknown as {rewardId?:string}).rewardId==='string'?(payload as unknown as {rewardId:string}).rewardId:'';
      const reveal=openEarnedPack(game.features,id,Date.now());
      if(!reveal)return jsonError('Diese Prämie wurde bereits geöffnet oder ist nicht verfügbar.',409);
      return persistGameResponse(db,room,game,timestamp,playerId,role,{}, {packReveal:reveal});
    }

    if (action === "star-pack") {
      const packId = typeof payload.packId === "string" ? payload.packId : "";
      const pack = getStarPack(packId);
      if (!pack || isRewardPack(pack.id)) return jsonError("Dieses Pack gibt es nicht im Shop.");
      const packUnlockLeague = getPackUnlockLeague(pack.id);
      if (!isLeagueContentUnlocked(packUnlockLeague, reachedLeagueOf(game), testMode)) return jsonError(`Dieses Pack wird ab Liga ${packUnlockLeague} freigeschaltet.`, 409);
      if (game.features.cup.active) return jsonError("Während eines Pokalspiels keine Packs öffnen.", 409);
      if (!testMode && game.goals < pack.price) return jsonError(`${pack.label} kostet ${pack.price.toLocaleString("de-CH")} Tore.`);
      const opening = openStarPack(pack.id, game.features.starXI.ownedIds, Math.random, game.features.starXI.formationPositions);
      const openedAt = Date.now();
      const openedBy = roomPlayerName(room, role);
      const reveal = { ...opening, openedAt, openedBy, troll: shouldTriggerPackTroll(opening.player) };
      if (!testMode) game.goals -= pack.price;
      game.features.starPackReveal = reveal;
      notePackOpened(game.features, openedAt);
      if (!opening.duplicate) game.features.starXI = addStarXIPlayer(game.features.starXI, opening.player.id, getBestXIUnavailablePlayerIds(game.features));
      if (opening.fragmentCompensation > 0) {
        game.features.starXI.fragments += opening.fragmentCompensation;
      }
      const historyTitle = opening.duplicate ? `Doppelter Star: ${opening.player.name}` : `${opening.player.name} in die Star XI gezogen`;
      const historyDetail = opening.duplicate ? `+${opening.fragmentCompensation.toLocaleString("de-CH")} Fragmente · nur für Custom-Karten.` : `${getStarXIPositions(opening.player).join(" / ")} · Rating ${opening.player.rating}`;
      addHistory(game.features, { title: historyTitle, detail: historyDetail, tone: opening.duplicate ? "neutral" : "positive" });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { packReveal: reveal });
    }

    if (action === "special-pack") {
      const purchaseId = typeof payload.purchaseId === "string" ? payload.purchaseId : "";
      const unlockLeague = getPackUnlockLeague(SPECIAL_CARD_PACK.id);
      if (!isLeagueContentUnlocked(unlockLeague, reachedLeagueOf(game), testMode)) return jsonError(`Dieses Pack wird ab Liga ${unlockLeague} freigeschaltet.`, 409);
      const result = purchaseSpecialCardPack(game.features, purchaseId, { openedBy: roomPlayerName(room, role), unlimited: testMode });
      if (!result.ok) return result.duplicateRequest ? Response.json({ error: result.error, errorCode: "DUPLICATE_PURCHASE", serverNow: Date.now(), room: shapeRoom(room, playerId), role }, { status: 409 }) : jsonError(result.error, 409);
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { packReveal: result.reveal });
    }

    if (action === "star-custom-draw" || action === "star-custom-buy") {
      // Clients from before the special card pack: same pack logic with a server issued receipt.
      const result = purchaseSpecialCardPack(game.features, `legacy-${crypto.randomUUID()}`, { openedBy: roomPlayerName(room, role), unlimited: testMode });
      if (!result.ok) return jsonError(result.error, 409);
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { packReveal: result.reveal });
    }

    if (action === "travel-start") {
      const mode = payload.mode === "season" ? "season" : "tournament";
      const t = getTournament(typeof payload.tournamentId === "string" ? payload.tournamentId : "stadium");
      if (!t) return jsonError("Unbekanntes Turnier.", 409);
      const now = Date.now();
      const error = eligibilityError(game.features, mode, t.id, now);
      if (error) return jsonError(error, 409);
      if (mode === "tournament" && !isLeagueContentUnlocked(getTournamentUnlockLeague(t.id), reachedLeagueOf(game), testMode)) return jsonError(`Das Turnier ist ab Liga ${getTournamentUnlockLeague(t.id)} verfügbar.`, 409);
      const fixture = fixtureFor(game.features, mode, t.id);
      if (!fixture.away) return jsonError("Für Heimspiele ist keine Reise nötig.", 409);
      const gate = travelGate(game.features, fixture, now, true);
      if (gate && !["Reise gestartet.", "Die Mannschaft ist noch unterwegs."].includes(gate)) return jsonError(gate,409);
      return persistGameResponse(db,room,game,timestamp,playerId,role);
    }

    if (action === "cup-start") {
      if (payload.mode === "season" || typeof payload.tournamentId !== "string") {
        const seasonStartError = startSeasonCupMatch(game, Date.now());
        if (seasonStartError) return jsonError(seasonStartError, 409);
        return persistGameResponse(db, room, game, timestamp, playerId, role);
      }
      const tournamentId = typeof payload.tournamentId === "string" ? payload.tournamentId : "stadium";
      const tournament = getTournament(tournamentId);
      if (!tournament) return jsonError("Dieses Turnier gibt es nicht.", 409);
      const cupNow = Date.now();
      if (!game.features.cup.pendingNextRound && game.features.cup.nextTournamentAt > cupNow) {
        const remainingSeconds = Math.max(0, Math.ceil((game.features.cup.nextTournamentAt - cupNow) / 1000));
        const remainingLabel = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
        return jsonError(`Neues Turnier in ${remainingLabel}.`, 409);
      }
      const openTransferVacancies = getOpenTransferSquadVacancies(game.features);
      if (openTransferVacancies.length > 0) {
        const location = game.features.starXI.lineupIds.filter(Boolean).length < STAR_XI_SQUAD_SIZE ? "in der Startelf" : "auf der Bank";
        return jsonError(`Besetze zuerst den freien Platz ${location}. Verkaufte oder verliehene Spieler werden nicht automatisch ersetzt.`, 409);
      }
      if (game.features.cup.pendingNextRound && tournament.id !== game.features.cup.tournamentId) return jsonError("Ersetze den gesperrten Spieler zuerst für die nächste Partie dieses Turniers.", 409);
      if (getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).length < STAR_XI_SQUAD_SIZE) return jsonError("Für den Pokal brauchst du 11 passende Spieler in der Startelf.", 409);
      const suspendedOnSquad = game.features.cup.suspendedPlayerIds.some((playerId) => game.features.starXI.lineupIds.includes(playerId) || game.features.starXI.benchIds.includes(playerId));
      if (suspendedOnSquad) return jsonError("Ein Spieler mit Roter Karte muss vor dem Anpfiff ersetzt werden und darf nicht auf der Bank sitzen.", 409);
      const tournamentBanError = squadBanError(game.features, competitionFor("tournament", tournament.id));
      if (tournamentBanError) return jsonError(tournamentBanError, 409);
      const tournamentUnlockLeague = getTournamentUnlockLeague(tournament.id);
      if (!isLeagueContentUnlocked(tournamentUnlockLeague, reachedLeagueOf(game), testMode)) return jsonError(`${tournament.label} wird ab Liga ${tournamentUnlockLeague} freigeschaltet.`, 409);
      const starRating = getStarXIRating(game.features.starXI.ownedIds, game.features.starXI.lineupIds);
      if (starRating < tournament.minimumRating) return jsonError(`${tournament.label} braucht mindestens ${tournament.minimumRating} OVR.`, 409);
      const fixture = fixtureFor(game.features, "tournament", tournament.id);
      const travelError = travelGate(game.features, fixture, cupNow);
      if (travelError) return jsonError(travelError,409);
      if (!game.features.cup.active) {
        if (!game.features.cup.pendingNextRound) game.features = activatePendingTransferLoans(game.features, tournament.id);
        const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
        game.features.cup = beginCupMatch(game.features.cup, cupNow, tournament.id, homePlayers, game.features.starXI.formationPositions, game.features.starXI.lineupIds, game.features.starXI.benchIds, Math.random, fixture.schedule);
        consumeTravel(game.features, fixture);
        prepareCareerMatch(game.features);
      }
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if(action==='cup-edit'){
      game.features=requestMatchEdit(game.features,Date.now());
      return persistGameResponse(db,room,game,timestamp,playerId,role);
    }
    if(action==='cup-batch'){
      const d=payload.draft as MatchDraft;
      if(!d||!Array.isArray(d.lineup)||!d.lineup.every(id=>typeof id==='string')||typeof d.formation!=='string')return jsonError('Aufstellung ungültig.',409);
      // Older clients may still send a strategy field; it no longer affects the match.
      const result=confirmMatchDraft(game.features,{lineup:d.lineup,formation:d.formation},Date.now());if(result.error)return jsonError(result.error,409);
      game.features=result.features;return persistGameResponse(db,room,game,timestamp,playerId,role);
    }
    if (action === "cup-play") return jsonError('Die auswählbaren Taktiken wurden entfernt.',410);

    if (action === "cup-resume") {
      if (!game.features.cup.active || !game.features.cup.matchPaused) return jsonError(`${game.features.cup.mode === "season" ? "Das Saisonspiel" : "Das Pokalspiel"} ist gerade nicht pausiert.`, 409);
      game.features.cup = resumeCupMatch(game.features.cup);
      addHistory(game.features, { title: "Verletzungspause beendet", detail: "Der verletzte Spieler bleibt draussen; die Partie läuft ohne Wechsel weiter.", tone: "neutral" });
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "cup-penalty") {
      if (!game.features.cup.active || game.features.cup.phase !== "penalties") return jsonError("Gerade läuft kein Elfmeterschiessen.", 409);
      const direction = payload.direction === "left" || payload.direction === "center" || payload.direction === "right" ? payload.direction as PenaltyDirection : null;
      if (!direction) return jsonError("Wähle links, Mitte oder rechts.", 409);
      const expectedPenaltyStep = Number(payload.expectedPenaltyStep);
      const currentPenaltyStep = game.features.cup.penaltyHomeTaken + game.features.cup.penaltyAwayTaken;
      if (!Number.isInteger(expectedPenaltyStep) || expectedPenaltyStep < 0) return jsonError("Der Elfmeterstand ist ungültig.", 409);
      if (expectedPenaltyStep !== currentPenaltyStep) return unchanged();
      const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
      const effectiveRating = getStarXIEffectiveMatchRating(game.features.starXI.ownedIds, game.features.starXI.lineupIds, game.features.cup, 120);
      const cupNow = Date.now();
      const result = resolveCupPenalty(game.features.cup, effectiveRating, direction, cupNow, Math.random, homePlayers, game.features.starXI.formationPositions);
      game.features.cup = result.cup;
      applyPendingMatchChanges(game.features, Date.now());
      if (result.finished) releaseMatchSquad(game.features, Date.now());
      if (result.finished) {
        game.features.starXI = restoreStarXIAfterMatch(game.features.starXI, game.features.cup);
        if (game.features.cup.mode === "season") {
          recordMultiplayerSeasonMatch(game, cupNow);
        } else {
          recordCareerMatch(game.features, cupNow);

          const tournament = getTournament(game.features.cup.tournamentId);

          addHistory(game.features, {
            title: result.tournamentWon ? `${tournament?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
            detail: result.tournamentWon ? `Elfmeterschiessen gewonnen · Trophäe erhalten · ${getTournamentRewardPack(result.cup.tournamentId, game.features.seasonMode.highestDivision).label}` : result.cup.pendingNextRound ? result.cup.suspendedPlayerIds.length ? "Elfmeterschiessen gewonnen · Gesperrten Spieler ersetzen und nächste Partie manuell starten" : "Elfmeterschiessen gewonnen · Aufstellung anpassen und nächste Partie manuell starten" : result.nextRoundStarted ? `Elfmeterschiessen gewonnen · Runde ${result.completedRound + 1} läuft bereits` : "Im Elfmeterschiessen ausgeschieden.",
            tone: result.won ? "positive" : "negative",
          });
          if (result.runEnded) game.features = completeTournamentRun(game.features, { tournamentId: result.cup.tournamentId, tournamentWon: result.tournamentWon, completedRound: result.completedRound, opponent: result.opponent, homeScore: result.cup.homeScore, awayScore: result.cup.awayScore, tieBreak: result.tieBreak }, cupNow);
        }
      }
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "cup-tick") {
      if (!game.features.cup.active) return unchanged();
      if (game.features.cup.phase === "penalties") return unchanged();
      const homePlayers = getStarXISelection(game.features.starXI.ownedIds, game.features.starXI.lineupIds).filter((player) => !game.features.cup.sentOffPlayerIds.includes(player.id));
      const cupNow = Date.now();
      const matchMinute = getCupMatchMinute(game.features.cup, cupNow);
      const effectiveRating = getStarXIEffectiveMatchRating(game.features.starXI.ownedIds, game.features.starXI.lineupIds, game.features.cup, matchMinute);
      const result = advanceCupMatch(game.features.cup, effectiveRating, cupNow, Math.random, homePlayers, game.features.starXI.formationPositions);
      game.features.cup = result.cup;
      applyPendingMatchChanges(game.features, Date.now());
      if (result.finished) releaseMatchSquad(game.features, Date.now());
      if (result.finished) {
        game.features.starXI = restoreStarXIAfterMatch(game.features.starXI, game.features.cup);
        if (game.features.cup.mode === "season") {
          recordMultiplayerSeasonMatch(game, cupNow);
        } else {
          recordCareerMatch(game.features, cupNow);

          const tournament = getTournament(game.features.cup.tournamentId);

          addHistory(game.features, {
            title: result.tournamentWon ? `${tournament?.trophyName ?? "Pokal"} gewonnen` : result.won ? `Runde ${result.completedRound} gewonnen` : `Turnieraus gegen ${result.opponent}`,
            detail: result.tournamentWon ? `Trophäe erhalten · ${getTournamentRewardPack(result.cup.tournamentId, game.features.seasonMode.highestDivision).label}` : result.cup.pendingNextRound ? result.cup.suspendedPlayerIds.length ? "Rote Karte · Gesperrten Spieler ersetzen und nächste Partie manuell starten" : "Aufstellung anpassen und nächste Partie manuell starten" : result.nextRoundStarted ? `Runde ${result.completedRound + 1} läuft bereits` : "Der nächste Turnierlauf kommt bestimmt.",
            tone: result.won ? "positive" : "negative",
          });
          if (result.runEnded) game.features = completeTournamentRun(game.features, { tournamentId: result.cup.tournamentId, tournamentWon: result.tournamentWon, completedRound: result.completedRound, opponent: result.opponent, homeScore: result.cup.homeScore, awayScore: result.cup.awayScore, tieBreak: result.tieBreak }, cupNow);
        }
      }
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "album-claim") {
      const groupId = typeof payload.groupId === "string" ? payload.groupId : "";
      const claim = claimAlbumRewards(game.features, groupId, getBasePassivePower(game.upgrades, game.stars, game.features));
      if (!claim.claimed) return jsonError("Diese Sammlung ist noch nicht vollständig oder ihre Prämie wurde bereits abgeholt.", 409);
      game.goals += claim.goals;
      game.seasonGoals += claim.goals;
      game.totalGoals += claim.goals;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "weekly-claim") {
      // The week's goals belong to the whole world; the claim list (and the week inside every goal id) pays each once.
      const goalId = typeof payload.goalId === "string" ? payload.goalId.slice(0, 80) : "";
      const claim = claimWeeklyGoal(game.features, goalId, Date.now(), game.minigameWins);
      if (!claim.ok) return jsonError(claim.error, claim.status);
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    // Clients from before the weekly goals: the one-time missions no longer pay anything.
    if (action === "mission-claim") return jsonError("Die Missionen wurden durch Wochenziele ersetzt. Bitte lade die Seite neu.", 409);

    if (action === "season-match" || action === "season") {
      const seasonStartError = startSeasonCupMatch(game, Date.now());
      if (seasonStartError) return jsonError(seasonStartError, 409);
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "season-prestige") {
      // Checked against the stored world: Hall of Fame, the chosen card and running operations. The request id
      // makes retries safe, the expected count rejects a second Prestige started from an outdated screen.
      // applyGamePrestige is the same reset single player uses: season, squad, card improvements, goals and all
      // upgrade levels change together and are written in one versioned update.
      const requestId = typeof payload.requestId === "string" ? payload.requestId.slice(0, 60) : "";
      if (!requestId) return jsonError("Lade die Seite neu, um Prestige zu starten.", 409);
      const keepNormalId = typeof payload.keepNormalId === "string" && payload.keepNormalId ? payload.keepNormalId : null;
      const now = Date.parse(timestamp);
      const clickState = readClickState(room);
      const openVote = readPrestigeVote(clickState);
      // The same proposal sent again (lost answer): the vote it opened is the answer.
      if (openVote?.id === requestId && openVote.prestigeCount === game.features.seasonMode.prestigeCount) return unchanged({ prestigeVote: "pending" });
      const result = applyGamePrestige(game, keepNormalId, now, requestId);
      if (result.duplicate) return Response.json({ serverNow: Date.now(), room: shapeRoom(room, playerId), role });
      // The room goes along, so the screen that asked shows the Prestige another seat already started.
      if (Number(payload.expectedPrestigeCount) !== game.features.seasonMode.prestigeCount) return Response.json({ error: "Prestige wurde in dieser Welt schon gestartet.", errorCode: "PRESTIGE_ALREADY_STARTED", serverNow: Date.now(), room: shapeRoom(room, playerId), role }, { status: 409 });
      if (result.error) return jsonError(result.error, 409);
      const openStatus = openVote && openVote.prestigeCount === game.features.seasonMode.prestigeCount ? prestigeVoteStatus(room, openVote, now).status : null;
      if (openStatus === "pending" || openStatus === "ready") return Response.json({ error: `${openVote!.proposerName} hat schon eine Prestige Abstimmung gestartet.`, errorCode: "PRESTIGE_VOTE_OPEN", serverNow: Date.now(), room: shapeRoom(room, playerId), role }, { status: 409 });
      // Prestige resets the whole world, so every member who is online right now has to agree (a vote); members
      // who are offline do not block it. Alone online, the proposal is the whole vote and Prestige starts at once.
      const others = getOccupiedRoomPlayers(room).filter((player) => player.playerId !== playerId && isOnline(player.lastSeenAt)).map((player) => player.playerId!);
      if (!others.length) {
        Object.assign(game, result.game);
        return persistGameResponse(db, room, game, timestamp, playerId, role, {}, {}, { clickStatePatch: (state) => { delete state[PRESTIGE_VOTE_KEY]; } });
      }
      const vote: PrestigeVote = { id: requestId, proposer: playerId, proposerName: roomPlayerName(room, role), keepNormalId, prestigeCount: game.features.seasonMode.prestigeCount, createdAt: now, expiresAt: now + PRESTIGE_VOTE_MS, required: others, approvals: [playerId] };
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { prestigeVote: "pending" }, { clickStatePatch: (state) => { state[PRESTIGE_VOTE_KEY] = vote; } });
    }

    if (action === "prestige-vote") {
      // Agree to or decline the open Prestige vote. The last missing agreement runs the Prestige of the proposer
      // once (its id is the request id of applyGamePrestige); declining or cancelling closes the vote for all.
      const voteId = typeof payload.voteId === "string" ? payload.voteId.slice(0, 60) : "";
      const decision = payload.decision === "approve" || payload.decision === "decline" ? payload.decision : null;
      if (!decision) return jsonError("Unbekannte Antwort auf die Abstimmung.");
      const now = Date.parse(timestamp);
      const vote = readPrestigeVote(readClickState(room));
      if (!vote || vote.id !== voteId) {
        const finished = readPrestigeVoteResult(readClickState(room));
        if (finished?.id === voteId) return unchanged({ prestigeVoteResult: finished.outcome });
        return Response.json({ error: "Diese Prestige Abstimmung ist schon vorbei.", errorCode: "PRESTIGE_VOTE_CLOSED", serverNow: Date.now(), room: shapeRoom(room, playerId), role }, { status: 409 });
      }
      if (decision === "decline") {
        const status = prestigeVoteStatus(room, vote, now).status;
        const finished = status === "expired" || status === "cancelled" ? finishPrestigeVote(vote, status, now) : finishPrestigeVote(vote, playerId === vote.proposer ? "cancelled" : "declined", now, roomPlayerName(room, role));
        return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { prestigeVoteResult: finished.outcome }, { clickStatePatch: finished.patch });
      }
      const approved: PrestigeVote = vote.approvals.includes(playerId) ? vote : { ...vote, approvals: [...vote.approvals, playerId] };
      // Settled against the room with this agreement in it: the presence of this request counts as online.
      const withApproval = { ...room, clickStateJson: JSON.stringify({ ...readClickState(room), [PRESTIGE_VOTE_KEY]: approved }), ...rolePresenceUpdate(role, timestamp) };
      const settled = settlePrestigeVote(game, withApproval, now);
      if (!settled) return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { prestigeVote: "pending" }, { clickStatePatch: (state) => { if (readPrestigeVote(state)?.id === vote.id) state[PRESTIGE_VOTE_KEY] = approved; } });
      if (settled.outcome === "failed" || settled.outcome === "expired" || settled.outcome === "cancelled") return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { prestigeVoteResult: settled.outcome, error: settled.result.reason }, { clickStatePatch: settled.patch });
      return persistGameResponse(db, room, game, timestamp, playerId, role, {}, { prestigeVoteResult: settled.outcome }, { clickStatePatch: settled.patch });
    }

    if (action === "minigame-start") {
      const minigameId = MINI_GAME_IDS.find((id) => id === payload.minigameId);
      if (!minigameId) return jsonError("Dieses Minigame gibt es nicht.");
      if (game.miniGameCooldowns[minigameId] > Date.now()) return jsonError("Dieses Minigame ist noch nicht bereit.", 409);
      game.features.miniGameRuns = { ...game.features.miniGameRuns, [`${minigameId}:${role}`]: Date.now() };
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    if (action === "minigame") {
      const minigameId = MINI_GAME_IDS.find((id) => id === payload.minigameId);
      if (!minigameId) return jsonError("Dieses Minigame gibt es nicht.");
      if (game.miniGameCooldowns[minigameId] > Date.now()) return jsonError("Dieses Minigame ist noch nicht bereit.", 409);
      // Only a run this player started here earns a reward, and not one finished faster than a person can play it.
      const runKey = `${minigameId}:${role}`;
      const startedAt = game.features.miniGameRuns?.[runKey];
      const runAge = startedAt === undefined ? -1 : Date.now() - startedAt;
      if (runAge < MINI_GAME_MIN_RUN_MS || runAge > MINI_GAME_MAX_RUN_MS) return jsonError("Starte das Minigame zuerst.", 409);
      const { [runKey]: _finished, ...openRuns } = game.features.miniGameRuns ?? {};
      void _finished;
      game.features.miniGameRuns = openRuns;
      // Highest reward the client can legitimately compute: the best run at the world's income (see miniGameReward in app/page.tsx).
      const reward = Math.max(0, Math.min(getMiniGameMaxReward(minigameId, getBasePassivePower(game.upgrades, game.stars, game.features)), Math.floor(finite(payload.reward))));
      game.goals += reward;
      game.seasonGoals += reward;
      game.totalGoals += reward;
      game.minigameWins += 1;
      game.miniGameCooldowns[minigameId] = Date.now() + MINI_GAME_COOLDOWN_SECONDS[minigameId] * 1000;
      return persistGameResponse(db, room, game, timestamp, playerId, role);
    }

    return jsonError("Unbekannte Aktion.");
    };
    return mutateWorld(context, room, applyAction, { passive: true, presence: presenceBefore, touch: !isBackgroundAction, settleTravel: true });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return jsonError(error.message, 413);
    if (error instanceof SyntaxError) return jsonError("Die Anfrage ist ungültig.", 400);
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

// Coop polls every 1.5 s and carries the whole world whenever its features change; gzip keeps that small.
export const GET = withGzip(handleGet);
export const POST = withGzip(handlePost);
