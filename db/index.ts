import { and, desc, eq, getTableColumns, isNull, lte, or, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { cloudSaves, coopRooms, playerAccounts, profiles, soloTravel } from "./schema";

/** Longest player name on a world seat (the same limit the multiplayer API applies when joining). */
const ROOM_SEAT_NAME_MAX = 18;

export type RoomRow = typeof coopRooms.$inferSelect;
export type RoomUpdate = Partial<Omit<RoomRow, "code">>;
export type PlayerAccount = typeof playerAccounts.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type CloudSave = typeof cloudSaves.$inferSelect;

export type RoomSeatRole = "host" | "guest" | "player3" | "player4";

// Egress: every byte Postgres sends to the server counts against the Supabase quota, uncompressed. A world
// row holds the shared features (several hundred KB) and a full backup copy of the game (as much again),
// and open worlds are polled every few seconds. So the backup is only read where the features are missing
// (old rooms), the features only where they are needed, and their md5 is computed inside Postgres.
const { sharedStateBackupJson: backupColumn, sharedFeaturesJson: featuresColumn, ...lightColumns } = getTableColumns(coopRooms);
const backupIfNeeded = sql<string>`case when ${featuresColumn} in ('', '{}') then ${backupColumn} else '' end`;
/** Every column except the backup copy, which comes along only when the features are empty. */
const ROOM_FIELDS = { ...lightColumns, sharedFeaturesJson: featuresColumn, sharedStateBackupJson: backupIfNeeded };
/** A world without its features and backup, plus the md5 of the features to tell whether they changed. */
const LIGHT_ROOM_FIELDS = { ...lightColumns, featuresKey: sql<string>`md5(${featuresColumn})` };
export type LightRoomRow = Omit<RoomRow, "sharedFeaturesJson" | "sharedStateBackupJson"> & { featuresKey: string };
const SEAT_FIELDS = {
  hostPlayerId: coopRooms.hostPlayerId, hostName: coopRooms.hostName, hostLastSeenAt: coopRooms.hostLastSeenAt,
  guestPlayerId: coopRooms.guestPlayerId, guestName: coopRooms.guestName, guestLastSeenAt: coopRooms.guestLastSeenAt,
  player3PlayerId: coopRooms.player3PlayerId, player3Name: coopRooms.player3Name, player3LastSeenAt: coopRooms.player3LastSeenAt,
  player4PlayerId: coopRooms.player4PlayerId, player4Name: coopRooms.player4Name, player4LastSeenAt: coopRooms.player4LastSeenAt,
};
export type RoomSeats = { [K in keyof typeof SEAT_FIELDS]: RoomRow[K] };

type RoomConditions = {
  sharedStateVersion?: number;
  lastPassiveAt?: string;
  /** Guards a seat write: null requires a still empty seat, a string requires the seat to still belong to that player. */
  seat?: { role: RoomSeatRole; playerId: string | null };
};

function seatPlayerColumn(role: RoomSeatRole) {
  if (role === "host") return coopRooms.hostPlayerId;
  if (role === "guest") return coopRooms.guestPlayerId;
  if (role === "player3") return coopRooms.player3PlayerId;
  return coopRooms.player4PlayerId;
}

let connection: postgres.Sql | null = null;

function createDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Die bestehenden Welten werden dadurch nicht verändert.",
    );
  }
  // Supabase's transaction pooler (port 6543) does not keep prepared statements between queries.
  connection = postgres(url, { prepare: false, max: Number(process.env.DATABASE_POOL_MAX) || 5, idle_timeout: 20 });
  return drizzle(connection, { schema });
}

type Database = ReturnType<typeof createDatabase>;

/** `column + amount` as a column reference and a bound parameter, never as SQL text. */
function increment(column: AnyColumn, amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return sql`${column} + ${safeAmount}`;
}

/** drizzle wraps the driver error; 23505 is a unique violation. */
function isUniqueViolation(error: unknown) {
  const failure = error as { code?: string; cause?: { code?: string } };
  return (failure.code ?? failure.cause?.code) === "23505";
}

/** A database without the Supabase auth schema (local tests) has no such schema or function. */
function isMissingObject(error: unknown) {
  const failure = error as { code?: string; cause?: { code?: string } };
  return ["3F000", "42883", "42P01"].includes(failure.code ?? failure.cause?.code ?? "");
}

function roleClickUpdate(role: string, amount: number, clickCount: number) {
  if (role === "host") return { hostGoals: increment(coopRooms.hostGoals, amount), hostClicks: increment(coopRooms.hostClicks, clickCount) };
  if (role === "guest") return { guestGoals: increment(coopRooms.guestGoals, amount), guestClicks: increment(coopRooms.guestClicks, clickCount) };
  if (role === "player3") return { player3Goals: increment(coopRooms.player3Goals, amount), player3Clicks: increment(coopRooms.player3Clicks, clickCount) };
  return { player4Goals: increment(coopRooms.player4Goals, amount), player4Clicks: increment(coopRooms.player4Clicks, clickCount) };
}

export class GoalClickerDatabase {
  private database: Database | null = null;

  /** The pool opens on the first query, so a missing DATABASE_URL only fails requests that need it. */
  constructor(private readonly connect: () => Database) {}

  private get client() {
    this.database ??= this.connect();
    return this.database;
  }

  async getSoloJourney(owner: string, fixtureId: string) {
    const [row] = await this.client.select().from(soloTravel).where(and(eq(soloTravel.owner,owner),eq(soloTravel.fixtureId,fixtureId))).limit(1);
    // Typed like the JSON.parse result it replaces; callers validate the receipt shape.
    return row ? row.journeyJson as ReturnType<typeof JSON.parse> : null;
  }
  async putSoloJourney(owner: string, fixtureId: string, journey: unknown) {
    await this.client.insert(soloTravel).values({owner,fixtureId,journeyJson:journey}).onConflictDoNothing();
    return this.getSoloJourney(owner,fixtureId);
  }
  async consumeSoloJourney(owner: string, fixtureId: string, journey: unknown) {
    // Only a receipt that is not consumed yet (consumed missing, null, false or 0) can be consumed, once.
    const rows=await this.client.update(soloTravel).set({journeyJson:journey}).where(and(eq(soloTravel.owner,owner),eq(soloTravel.fixtureId,fixtureId),sql`coalesce(${soloTravel.journeyJson}->'consumed', 'null'::jsonb) in ('null'::jsonb, 'false'::jsonb, '0'::jsonb)`)).returning();
    return rows.length===1;
  }
  async getAccount(userId: string): Promise<PlayerAccount | null> {
    const [account] = await this.client.select().from(playerAccounts).where(eq(playerAccounts.userId, userId)).limit(1);
    return account ?? null;
  }

  /**
   * Links a login to a player ID once. The first link of a user wins, and a player ID belongs to one user:
   * both are unique, so concurrent first logins cannot create two links. Returns null when the player ID
   * already belongs to another account.
   */
  async linkAccount(userId: string, playerId: string, email: string | null): Promise<PlayerAccount | null> {
    const [created] = await this.client.insert(playerAccounts).values({ userId, playerId, email }).onConflictDoNothing().returning();
    return created ?? await this.getAccount(userId);
  }

  /**
   * Moves the account to an imported player ID, but only while its current player ID has no world seat yet
   * (a fresh device that logged in before importing the old save). The update is conditional on the
   * current link, and the unique player ID keeps two accounts from claiming the same ID.
   */
  async relinkAccount(userId: string, playerId: string): Promise<{ account: PlayerAccount | null; reason?: "has-worlds" | "taken" }> {
    const current = await this.getAccount(userId);
    if (!current || current.playerId === playerId) return { account: current };
    const seat = or(eq(coopRooms.hostPlayerId, current.playerId), eq(coopRooms.guestPlayerId, current.playerId), eq(coopRooms.player3PlayerId, current.playerId), eq(coopRooms.player4PlayerId, current.playerId));
    const [world] = await this.client.select({ code: coopRooms.code }).from(coopRooms).where(seat).limit(1);
    if (world) return { account: current, reason: "has-worlds" };
    try {
      const [moved] = await this.client.update(playerAccounts).set({ playerId }).where(and(eq(playerAccounts.userId, userId), eq(playerAccounts.playerId, current.playerId))).returning();
      return { account: moved ?? await this.getAccount(userId) };
    } catch (error) {
      if (isUniqueViolation(error)) return { account: current, reason: "taken" };
      throw error;
    }
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const [profile] = await this.client.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    return profile ?? null;
  }

  async getProfileByUsername(key: string): Promise<Profile | null> {
    const [profile] = await this.client.select().from(profiles).where(eq(profiles.usernameKey, key)).limit(1);
    return profile ?? null;
  }

  async isUsernameTaken(key: string, exceptUserId?: string) {
    const [owner] = await this.client.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.usernameKey, key)).limit(1);
    return Boolean(owner && owner.userId !== exceptUserId);
  }

  /** One profile per account; the unique username_key decides concurrent claims of the same name. */
  async createProfile(userId: string, username: string, displayName: string, now: string, loginEmail: string | null = null): Promise<{ profile: Profile; reason?: undefined } | { profile?: undefined; reason: "taken" | "exists" }> {
    try {
      const [created] = await this.client.insert(profiles).values({ userId, username, usernameKey: username.toLowerCase(), displayName, loginEmail, usernameChangedAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing({ target: profiles.userId }).returning();
      return created ? { profile: created } : { reason: "exists" };
    } catch (error) {
      if (isUniqueViolation(error)) return { reason: "taken" };
      throw error;
    }
  }

  /** The display name is the player's name in every world, so the seats of the account's player follow it. */
  async updateDisplayName(userId: string, displayName: string, now: string): Promise<Profile | null> {
    const [profile] = await this.client.update(profiles).set({ displayName, updatedAt: now }).where(eq(profiles.userId, userId)).returning();
    if (!profile) return null;
    const account = await this.getAccount(userId);
    if (account) {
      const seatName = displayName.trim().replace(/\s+/g, " ").slice(0, ROOM_SEAT_NAME_MAX);
      await this.client.update(coopRooms).set({ hostName: seatName, updatedAt: now }).where(eq(coopRooms.hostPlayerId, account.playerId));
      await this.client.update(coopRooms).set({ guestName: seatName, updatedAt: now }).where(eq(coopRooms.guestPlayerId, account.playerId));
      await this.client.update(coopRooms).set({ player3Name: seatName, updatedAt: now }).where(eq(coopRooms.player3PlayerId, account.playerId));
      await this.client.update(coopRooms).set({ player4Name: seatName, updatedAt: now }).where(eq(coopRooms.player4PlayerId, account.playerId));
    }
    return profile;
  }

  /**
   * A new username at most once per period: the update only matches while the last change is older than
   * `cutoff`. Changing only the case of the own name is always allowed and keeps the period running.
   */
  async changeUsername(userId: string, username: string, now: string, cutoff: string): Promise<{ profile: Profile; reason?: undefined } | { profile?: undefined; reason: "too-soon" | "taken" | "missing" }> {
    const key = username.toLowerCase();
    try {
      const [renamed] = await this.client.update(profiles).set({ username, updatedAt: now }).where(and(eq(profiles.userId, userId), eq(profiles.usernameKey, key))).returning();
      if (renamed) return { profile: renamed };
      const [changed] = await this.client.update(profiles).set({ username, usernameKey: key, usernameChangedAt: now, updatedAt: now }).where(and(eq(profiles.userId, userId), lte(profiles.usernameChangedAt, cutoff))).returning();
      if (changed) return { profile: changed };
    } catch (error) {
      if (isUniqueViolation(error)) return { reason: "taken" };
      throw error;
    }
    return { reason: await this.getProfile(userId) ? "too-soon" : "missing" };
  }

  async getCloudSave(userId: string): Promise<CloudSave | null> {
    const [save] = await this.client.select().from(cloudSaves).where(eq(cloudSaves.userId, userId)).limit(1);
    return save ?? null;
  }

  /**
   * Stores a save only on top of the version the device loaded (0: no save yet). Two devices that loaded the
   * same version cannot both write; the second gets the current save back as a conflict.
   */
  async putCloudSave(userId: string, saveJson: string, baseVersion: number, now: string, active = true): Promise<{ save: CloudSave; conflict?: undefined } | { save?: undefined; conflict: CloudSave | null }> {
    if (baseVersion === 0) {
      const [created] = await this.client.insert(cloudSaves).values({ userId, saveJson, version: 1, active, updatedAt: now }).onConflictDoNothing().returning();
      if (created) return { save: created };
    } else {
      const [updated] = await this.client.update(cloudSaves).set({ saveJson, version: increment(cloudSaves.version, 1), active, updatedAt: now }).where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.version, baseVersion))).returning();
      if (updated) return { save: updated };
    }
    return { conflict: await this.getCloudSave(userId) };
  }

  /**
   * Creates a confirmed Supabase Auth login with e-mail and password, without any mail, through a function only
   * the production database has (see docs/supabase-datenbank.md). Returns null where it does not exist.
   */
  async createPasswordLogin(email: string, password: string): Promise<string | null> {
    try {
      const rows = await this.client.execute(sql`select goal_clicker_private.create_password_user(${email}, ${password}) as id`);
      return String((rows as unknown as { id: string }[])[0].id);
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  /** Deletes only the login, for a registration that lost its username to a parallel one. */
  async deleteLogin(userId: string) {
    try {
      await this.client.execute(sql`select goal_clicker_private.delete_user(${userId}::uuid)`);
      return true;
    } catch (error) {
      if (isMissingObject(error)) return false;
      throw error;
    }
  }

  /**
   * Removes everything stored for an account. Worlds stay, because other players share them. The login itself
   * is deleted by a function only the production database has (see docs/supabase-datenbank.md).
   */
  async deleteAccount(userId: string) {
    await this.client.transaction(async (tx) => {
      await tx.delete(cloudSaves).where(eq(cloudSaves.userId, userId));
      await tx.delete(profiles).where(eq(profiles.userId, userId));
      await tx.delete(playerAccounts).where(eq(playerAccounts.userId, userId));
    });
    return { loginDeleted: await this.deleteLogin(userId) };
  }

  async getRoom(code: string): Promise<RoomRow | null> {
    const [room] = await this.client.select(ROOM_FIELDS).from(coopRooms).where(eq(coopRooms.code, code)).limit(1);
    return room ?? null;
  }

  /** The world without its big JSON columns: enough to answer "nothing changed" to a poll. */
  async getLightRoom(code: string): Promise<LightRoomRow | null> {
    const [room] = await this.client.select(LIGHT_ROOM_FIELDS).from(coopRooms).where(eq(coopRooms.code, code)).limit(1);
    return room ?? null;
  }

  /** Writes small columns such as a presence timestamp and returns only the seats, not the game. */
  async touchRoom(code: string, values: RoomUpdate): Promise<RoomSeats | null> {
    const [seats] = await this.client.update(coopRooms).set(values).where(eq(coopRooms.code, code)).returning(SEAT_FIELDS);
    return seats ?? null;
  }

  /** The worlds of a player for the world list; the list shows no game, so it reads none. */
  async listRoomsForPlayer(playerId: string): Promise<LightRoomRow[]> {
    return this.client
      .select(LIGHT_ROOM_FIELDS)
      .from(coopRooms)
      .where(or(
        eq(coopRooms.hostPlayerId, playerId),
        eq(coopRooms.guestPlayerId, playerId),
        eq(coopRooms.player3PlayerId, playerId),
        eq(coopRooms.player4PlayerId, playerId),
      ))
      .orderBy(desc(coopRooms.updatedAt))
      .limit(12);
  }

  async insertRoom(values: typeof coopRooms.$inferInsert) {
    const [room] = await this.client.insert(coopRooms).values(values).returning(ROOM_FIELDS);
    if (!room) throw new Error("Die Welt konnte nicht gespeichert werden.");
    return room;
  }

  /**
   * Updates a world and returns it. The features are never sent back: a write that sets them already has
   * them, and only the rare writes without them (joining, renaming) read them once afterwards.
   */
  async updateRoom(code: string, values: RoomUpdate, conditions: RoomConditions = {}): Promise<RoomRow | null> {
    const predicates = [eq(coopRooms.code, code)];
    if (conditions.sharedStateVersion !== undefined) predicates.push(eq(coopRooms.sharedStateVersion, conditions.sharedStateVersion));
    if (conditions.lastPassiveAt !== undefined) predicates.push(eq(coopRooms.lastPassiveAt, conditions.lastPassiveAt));
    if (conditions.seat) {
      const seatColumn = seatPlayerColumn(conditions.seat.role);
      predicates.push(conditions.seat.playerId === null ? isNull(seatColumn) : eq(seatColumn, conditions.seat.playerId));
    }
    const [room] = await this.client
      .update(coopRooms)
      .set(values)
      .where(and(...predicates))
      .returning(lightColumns);
    if (!room) return null;
    if (typeof values.sharedFeaturesJson === "string" && values.sharedFeaturesJson !== "{}") return { ...room, sharedFeaturesJson: values.sharedFeaturesJson, sharedStateBackupJson: "" };
    const [game] = await this.client.select({ sharedFeaturesJson: featuresColumn, sharedStateBackupJson: backupIfNeeded }).from(coopRooms).where(eq(coopRooms.code, code)).limit(1);
    return game ? { ...room, ...game } : null;
  }

  async deleteRoom(code: string) {
    await this.client.delete(coopRooms).where(eq(coopRooms.code, code));
  }

  /** Clicks change only counters, so the world comes back without its features (with their md5). */
  async applyClick(code: string, role: string, amount: number, clickCount: number, timestamp: string): Promise<LightRoomRow | null> {
    const [room] = await this.client
      .update(coopRooms)
      .set({
        sharedCoins: increment(coopRooms.sharedCoins, amount),
        sharedTotalGoals: increment(coopRooms.sharedTotalGoals, amount),
        sharedSeasonGoals: increment(coopRooms.sharedSeasonGoals, amount),
        sharedStateVersion: increment(coopRooms.sharedStateVersion, 1), // shared_state_version = shared_state_version + 1
        lastPassiveAt: timestamp,
        pendingPlayerId: null,
        pendingUpgradeId: null,
        pendingUpgradeName: null,
        pendingCost: null,
        pendingUpgradeCount: null,
        updatedAt: timestamp,
        ...roleClickUpdate(role, amount, clickCount),
      })
      .where(eq(coopRooms.code, code))
      .returning(LIGHT_ROOM_FIELDS);
    return room ?? null;
  }

}

let database: GoalClickerDatabase | null = null;

export function getDb() {
  database ??= new GoalClickerDatabase(createDatabase);
  return database;
}

/** Closes the pool, for scripts and tests that must exit. */
export async function closeDb() {
  const current = connection;
  connection = null;
  database = null;
  await current?.end({ timeout: 5 });
}
