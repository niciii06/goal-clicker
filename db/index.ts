import { and, asc, desc, eq, getTableColumns, gt, isNull, lte, notLike, or, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { accountRecovery, authIdentities, cloudSaves, coopRooms, legacyIdentities, playerAccounts, profiles, rateLimits, recoveryCodes, soloTravel } from "./schema";

/** Longest player name on a world seat (the same limit the multiplayer API applies when joining). */
const ROOM_SEAT_NAME_MAX = 18;

export type RoomRow = typeof coopRooms.$inferSelect;
export type RoomUpdate = Partial<Omit<RoomRow, "code">>;
export type PlayerAccount = typeof playerAccounts.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type CloudSave = typeof cloudSaves.$inferSelect;
export type AuthIdentity = typeof authIdentities.$inferSelect;
export type LegacyIdentity = typeof legacyIdentities.$inferSelect;
export type AccountRecovery = typeof accountRecovery.$inferSelect;
export type BindResult = { ok: true; identity: AuthIdentity } | { ok: false; reason: "account-bound" | "subject-bound" };
export type RecoveryCompletion = { ok: true; identity: AuthIdentity; already: boolean } | { ok: false; reason: "no-claim" | "expired" | "code-used" | "account-bound" | "subject-bound" | "consumed-by-other" };

export type RoomSeatRole = "host" | "guest" | "player3" | "player4";

// Egress: every byte Postgres sends to the server counts against the database quota, uncompressed. A world
// row holds the shared features (several hundred KB) and a full backup copy of the game (as much again),
// and open worlds are polled every few seconds. So the backup is only read where the features are missing
// (old rooms), the features only where they are needed, and their md5 is computed inside Postgres. Once the
// prepared migration 0009 is applied, a trigger stores that md5 in features_key whenever the features are
// written, so a poll reads the stored key instead of hashing the features again.
const { sharedStateBackupJson: backupColumn, sharedFeaturesJson: featuresColumn, ...lightColumns } = getTableColumns(coopRooms);
const backupIfNeeded = sql<string>`case when ${featuresColumn} in ('', '{}') then ${backupColumn} else '' end`;
/** Every column except the backup copy, which comes along only when the features are empty. */
const ROOM_FIELDS = { ...lightColumns, sharedFeaturesJson: featuresColumn, sharedStateBackupJson: backupIfNeeded };
/** A world without its features and backup, plus the md5 of the features to tell whether they changed. */
const LIGHT_ROOM_FIELDS = { ...lightColumns, featuresKey: sql<string>`md5(${featuresColumn})` };
/** The same with the stored key of migration 0009; rows the trigger has not seen yet fall back to md5. */
const STORED_KEY_LIGHT_ROOM_FIELDS = { ...lightColumns, featuresKey: sql<string>`coalesce(${sql.identifier("features_key")}, md5(${featuresColumn}))` };
/** How long an instance trusts "the column is not there yet" before it looks again. */
const COLUMN_RECHECK_MS = 5 * 60_000;
export type LightRoomRow = Omit<RoomRow, "sharedFeaturesJson" | "sharedStateBackupJson"> & { featuresKey: string };
const SEAT_FIELDS = {
  hostPlayerId: coopRooms.hostPlayerId, hostName: coopRooms.hostName, hostLastSeenAt: coopRooms.hostLastSeenAt,
  guestPlayerId: coopRooms.guestPlayerId, guestName: coopRooms.guestName, guestLastSeenAt: coopRooms.guestLastSeenAt,
  player3PlayerId: coopRooms.player3PlayerId, player3Name: coopRooms.player3Name, player3LastSeenAt: coopRooms.player3LastSeenAt,
  player4PlayerId: coopRooms.player4PlayerId, player4Name: coopRooms.player4Name, player4LastSeenAt: coopRooms.player4LastSeenAt,
};
export type RoomSeats = { [K in keyof typeof SEAT_FIELDS]: RoomRow[K] };

export type LeaderboardSort = "goals" | "league" | "trophies";
/** Only the small columns a leaderboard row shows, plus the seats to mark the reader's own worlds. */
const LEADERBOARD_FIELDS = {
  ...SEAT_FIELDS,
  roomName: coopRooms.roomName,
  totalGoals: coopRooms.sharedTotalGoals,
  bestLeague: coopRooms.sharedBestLeague,
  trophies: coopRooms.sharedTrophies,
  updatedAt: coopRooms.updatedAt,
};
export type LeaderboardRow = RoomSeats & { roomName: string; totalGoals: number; bestLeague: number; trophies: number; updatedAt: string };

/** A cloud save without the save itself, for writes that already have it. */
const { saveJson: _saveColumn, ...SAVE_META_FIELDS } = getTableColumns(cloudSaves);
void _saveColumn;

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

/** Connections per server instance: DATABASE_POOL_MAX, default 3, never more than 10 (serverless instances multiply it). */
export function poolMax(value = process.env.DATABASE_POOL_MAX) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(10, parsed) : 3;
}

function createDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Die bestehenden Welten werden dadurch nicht verändert.",
    );
  }
  // Transaction poolers (Neon's -pooler host, PgBouncer in transaction mode) do not keep prepared statements
  // between queries. No array columns, so the type lookup every new connection would run is skipped.
  // idle_timeout closes idle connections soon, so Neon's compute can suspend between players.
  connection = postgres(url, { prepare: false, fetch_types: false, max: poolMax(), idle_timeout: 20, connect_timeout: 15 });
  return drizzle(connection, { schema });
}

type Database = ReturnType<typeof createDatabase>;

/** `column + amount` as a column reference and a bound parameter, never as SQL text. */
function increment(column: AnyColumn, amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return sql`${column} + ${safeAmount}`;
}

/** drizzle wraps the driver error; the Postgres code is on the error or its cause. */
function errorCode(error: unknown) {
  const failure = error as { code?: string; cause?: { code?: string } } | null;
  return failure?.code ?? failure?.cause?.code;
}

/** 23505 is a unique violation. */
function isUniqueViolation(error: unknown) {
  return errorCode(error) === "23505";
}

/** 42703: a column the query names does not exist (a prepared migration was rolled back). */
function isUndefinedColumn(error: unknown) {
  return errorCode(error) === "42703";
}

function roleClickUpdate(role: string, amount: number, clickCount: number) {
  if (role === "host") return { hostGoals: increment(coopRooms.hostGoals, amount), hostClicks: increment(coopRooms.hostClicks, clickCount) };
  if (role === "guest") return { guestGoals: increment(coopRooms.guestGoals, amount), guestClicks: increment(coopRooms.guestClicks, clickCount) };
  if (role === "player3") return { player3Goals: increment(coopRooms.player3Goals, amount), player3Clicks: increment(coopRooms.player3Clicks, clickCount) };
  return { player4Goals: increment(coopRooms.player4Goals, amount), player4Clicks: increment(coopRooms.player4Clicks, clickCount) };
}

export class GoalClickerDatabase {
  private database: Database | null = null;
  /** Whether coop_rooms.features_key (migration 0009) exists; null until first asked. */
  private storedFeaturesKey: { present: boolean; checkedAt: number } | null = null;

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
  /** Whether a player ID belongs to an account; a guest without login may not act for it. */
  async isPlayerLinked(playerId: string) {
    const [account] = await this.client.select({ userId: playerAccounts.userId }).from(playerAccounts).where(eq(playerAccounts.playerId, playerId)).limit(1);
    return Boolean(account);
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
   * The save only when it is newer than `since`: the version check runs inside PostgreSQL, so a device that is
   * up to date receives the few metadata columns instead of the whole save (egress). saveJson is null then.
   */
  async getCloudSaveSince(userId: string, since: number): Promise<(Omit<CloudSave, "saveJson"> & { saveJson: string | null }) | null> {
    const [save] = await this.client.select({ ...SAVE_META_FIELDS, saveJson: sql<string | null>`case when ${cloudSaves.version} > ${since} then ${cloudSaves.saveJson} else null end` }).from(cloudSaves).where(eq(cloudSaves.userId, userId)).limit(1);
    return save ?? null;
  }

  /**
   * Stores a save only on top of the version the device loaded (0: no save yet). Two devices that loaded the
   * same version cannot both write; the second gets the current save back as a conflict. A successful write
   * does not send the save back, the caller already has it.
   */
  async putCloudSave(userId: string, saveJson: string, baseVersion: number, now: string, active = true): Promise<{ save: CloudSave; conflict?: undefined } | { save?: undefined; conflict: CloudSave | null }> {
    if (baseVersion === 0) {
      const [created] = await this.client.insert(cloudSaves).values({ userId, saveJson, version: 1, active, activeVersion: active ? 1 : 0, updatedAt: now }).onConflictDoNothing().returning(SAVE_META_FIELDS);
      if (created) return { save: { ...created, saveJson } };
    } else {
      // A passive save keeps the version of the last played one, so the played progress stays protected.
      const [updated] = await this.client.update(cloudSaves).set({ saveJson, version: increment(cloudSaves.version, 1), active, ...(active ? { activeVersion: increment(cloudSaves.version, 1) } : {}), updatedAt: now }).where(and(eq(cloudSaves.userId, userId), eq(cloudSaves.version, baseVersion))).returning(SAVE_META_FIELDS);
      if (updated) return { save: { ...updated, saveJson } };
    }
    return { conflict: await this.getCloudSave(userId) };
  }

  // ---- Logins (Neon Auth) and game accounts -------------------------------------------------------------

  async getIdentity(issuer: string, subject: string): Promise<AuthIdentity | null> {
    const [identity] = await this.client.select().from(authIdentities).where(and(eq(authIdentities.issuer, issuer), eq(authIdentities.subject, subject))).limit(1);
    return identity ?? null;
  }

  async getIdentityForAccount(issuer: string, accountId: string): Promise<AuthIdentity | null> {
    const [identity] = await this.client.select().from(authIdentities).where(and(eq(authIdentities.issuer, issuer), eq(authIdentities.accountId, accountId))).limit(1);
    return identity ?? null;
  }

  /**
   * Binds a verified login to a game account, once. Both directions are unique (one account per login and one
   * login per account and issuer), so concurrent attempts cannot bind twice; the loser learns why. Binding the
   * same pair again is a success (retries).
   */
  async bindIdentity(values: { issuer: string; subject: string; accountId: string; method: string; loginEmail?: string | null; createdAt: string }): Promise<BindResult> {
    try {
      const [created] = await this.client.insert(authIdentities).values({ ...values, loginEmail: values.loginEmail ?? null }).onConflictDoNothing().returning();
      if (created) return { ok: true, identity: created };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const bySubject = await this.getIdentity(values.issuer, values.subject);
    if (bySubject) return bySubject.accountId === values.accountId && !bySubject.deletedAt ? { ok: true, identity: bySubject } : { ok: false, reason: "subject-bound" };
    return { ok: false, reason: "account-bound" };
  }

  async findLegacyIdentity(provider: string, providerSubject: string): Promise<LegacyIdentity | null> {
    const [identity] = await this.client.select().from(legacyIdentities).where(and(eq(legacyIdentities.provider, provider), eq(legacyIdentities.providerSubject, providerSubject))).limit(1);
    return identity ?? null;
  }

  async listLegacyIdentities(accountId: string): Promise<LegacyIdentity[]> {
    return this.client.select().from(legacyIdentities).where(eq(legacyIdentities.accountId, accountId));
  }

  /** Whether an account ID belongs to any game data at all (a recovery must never invent an account). */
  async accountExists(accountId: string) {
    const [profile] = await this.client.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.userId, accountId)).limit(1);
    return Boolean(profile);
  }

  /**
   * TEMPORARY recovery bridge: opens (or reopens) the claim window of an account after a verified proof of
   * ownership. The generated destination login address is created once per account and issuer and then kept,
   * so a retry after a partial failure signs into the same new login instead of creating another one.
   */
  async openRecoveryClaim(values: { accountId: string; issuer: string; method: string; destinationEmail: string; claimExpiresAt: string; now: string }): Promise<AccountRecovery> {
    const [row] = await this.client.insert(accountRecovery).values({ accountId: values.accountId, issuer: values.issuer, destinationEmail: values.destinationEmail, method: values.method, claimExpiresAt: values.claimExpiresAt, createdAt: values.now, updatedAt: values.now })
      .onConflictDoUpdate({ target: [accountRecovery.accountId, accountRecovery.issuer], set: { method: values.method, claimExpiresAt: values.claimExpiresAt, updatedAt: values.now }, setWhere: isNull(accountRecovery.consumedAt) })
      .returning();
    if (row) return row;
    const [existing] = await this.client.select().from(accountRecovery).where(and(eq(accountRecovery.accountId, values.accountId), eq(accountRecovery.issuer, values.issuer))).limit(1);
    if (!existing) throw new Error("Die Wiederherstellung konnte nicht vorbereitet werden.");
    return existing;
  }

  /** A new destination address, when the old one is held by a login whose password is not known (never consumed rows only). */
  async rotateRecoveryDestination(accountId: string, issuer: string, destinationEmail: string, now: string): Promise<AccountRecovery | null> {
    const [row] = await this.client.update(accountRecovery).set({ destinationEmail, updatedAt: now }).where(and(eq(accountRecovery.accountId, accountId), eq(accountRecovery.issuer, issuer), isNull(accountRecovery.consumedAt))).returning();
    return row ?? null;
  }

  /**
   * Binds the new login to the original account inside one transaction: the claim row is locked, must still be
   * open, a code (if any) is used up, the login is bound and the claim consumed. A retry by the same login after
   * success answers `already`. Nothing in profiles, cloud_saves, player_accounts or coop_rooms changes.
   */
  async completeRecovery(values: { accountId: string; issuer: string; subject: string; loginEmail: string; method: string; now: string; codeHash?: string }): Promise<RecoveryCompletion> {
    return this.client.transaction(async (tx) => {
      const [claim] = await tx.select().from(accountRecovery).where(and(eq(accountRecovery.accountId, values.accountId), eq(accountRecovery.issuer, values.issuer))).for("update").limit(1);
      if (!claim) return { ok: false, reason: "no-claim" } as const;
      if (claim.consumedAt) {
        const [bound] = await tx.select().from(authIdentities).where(and(eq(authIdentities.issuer, values.issuer), eq(authIdentities.subject, values.subject))).limit(1);
        return bound && bound.accountId === values.accountId && !bound.deletedAt ? { ok: true, identity: bound, already: true } as const : { ok: false, reason: "consumed-by-other" } as const;
      }
      if (!claim.claimExpiresAt || claim.claimExpiresAt <= values.now) return { ok: false, reason: "expired" } as const;
      if (claim.destinationEmail !== values.loginEmail) return { ok: false, reason: "no-claim" } as const;
      if (values.codeHash) {
        const [used] = await tx.update(recoveryCodes).set({ usedAt: values.now }).where(and(eq(recoveryCodes.codeHash, values.codeHash), eq(recoveryCodes.accountId, values.accountId), eq(recoveryCodes.issuer, values.issuer), isNull(recoveryCodes.usedAt), gt(recoveryCodes.expiresAt, values.now))).returning({ codeHash: recoveryCodes.codeHash });
        if (!used) return { ok: false, reason: "code-used" } as const;
      }
      const [byAccount] = await tx.select().from(authIdentities).where(and(eq(authIdentities.issuer, values.issuer), eq(authIdentities.accountId, values.accountId))).limit(1);
      if (byAccount) return { ok: false, reason: "account-bound" } as const;
      const [bySubject] = await tx.select().from(authIdentities).where(and(eq(authIdentities.issuer, values.issuer), eq(authIdentities.subject, values.subject))).limit(1);
      if (bySubject) return { ok: false, reason: "subject-bound" } as const;
      const [identity] = await tx.insert(authIdentities).values({ issuer: values.issuer, subject: values.subject, accountId: values.accountId, method: values.method, loginEmail: values.loginEmail, createdAt: values.now }).returning();
      await tx.update(accountRecovery).set({ consumedAt: values.now, subject: values.subject, claimExpiresAt: null, updatedAt: values.now }).where(and(eq(accountRecovery.accountId, values.accountId), eq(accountRecovery.issuer, values.issuer)));
      return { ok: true, identity, already: false } as const;
    });
  }

  /** Stores the hash of an owner issued recovery code. */
  async insertRecoveryCode(values: { codeHash: string; accountId: string; issuer: string; expiresAt: string; createdAt: string }) {
    await this.client.insert(recoveryCodes).values(values);
  }

  /** The account of an unused, unexpired recovery code (looked up by its hash, so no timing on the code itself). */
  async findRecoveryCode(codeHash: string, issuer: string, now: string): Promise<typeof recoveryCodes.$inferSelect | null> {
    const [code] = await this.client.select().from(recoveryCodes).where(and(eq(recoveryCodes.codeHash, codeHash), eq(recoveryCodes.issuer, issuer), isNull(recoveryCodes.usedAt), gt(recoveryCodes.expiresAt, now))).limit(1);
    return code ?? null;
  }

  /** Counts a hit in a fixed window shared by all server instances; returns the hits of this window. */
  async hitRateLimit(key: string, windowStart: number) {
    const [row] = await this.client.insert(rateLimits).values({ key, windowStart, hits: 1 }).onConflictDoUpdate({
      target: rateLimits.key,
      set: { hits: sql`case when ${rateLimits.windowStart} = ${windowStart} then ${rateLimits.hits} + 1 else 1 end`, windowStart },
    }).returning({ hits: rateLimits.hits });
    return row?.hits ?? 1;
  }

  async pruneRateLimits(before: number) {
    await this.client.delete(rateLimits).where(lte(rateLimits.windowStart, before));
  }

  /**
   * First step of deleting an account: removes the game data of the account (profile, cloud save, player link,
   * imported old logins and recovery state) and marks its logins as being deleted. Worlds stay, because other
   * players share them. Until the login itself is gone (finishAccountDeletion), the marked login can neither
   * create a new account nor reach the deleted one, and a retry can finish the deletion.
   */
  async deleteAccountData(accountId: string, now: string) {
    await this.client.transaction(async (tx) => {
      // Solo journey and reward receipts are keyed by the account's player ID; worlds stay (shared).
      const [link] = await tx.select({ playerId: playerAccounts.playerId }).from(playerAccounts).where(eq(playerAccounts.userId, accountId)).limit(1);
      if (link) await tx.delete(soloTravel).where(eq(soloTravel.owner, link.playerId));
      await tx.delete(cloudSaves).where(eq(cloudSaves.userId, accountId));
      await tx.delete(profiles).where(eq(profiles.userId, accountId));
      await tx.delete(playerAccounts).where(eq(playerAccounts.userId, accountId));
      await tx.delete(legacyIdentities).where(eq(legacyIdentities.accountId, accountId));
      await tx.delete(accountRecovery).where(eq(accountRecovery.accountId, accountId));
      await tx.delete(recoveryCodes).where(eq(recoveryCodes.accountId, accountId));
      await tx.update(authIdentities).set({ deletedAt: now }).where(and(eq(authIdentities.accountId, accountId), isNull(authIdentities.deletedAt)));
    });
  }

  /** Last step, once Neon Auth confirmed that the login is gone. */
  async finishAccountDeletion(accountId: string) {
    await this.client.delete(authIdentities).where(eq(authIdentities.accountId, accountId));
  }

  /**
   * Locks a login whose registration failed half way: it is kept as a marked (deleted_at) row, so it can never
   * open an account and the owner's deletion script removes the login at Neon Auth together with this row.
   */
  async lockFailedLogin(values: { issuer: string; subject: string; accountId: string; loginEmail: string | null; now: string }) {
    await this.client.insert(authIdentities).values({ issuer: values.issuer, subject: values.subject, accountId: values.accountId, method: "failed-registration", loginEmail: values.loginEmail, deletedAt: values.now, createdAt: values.now })
      .onConflictDoUpdate({ target: [authIdentities.issuer, authIdentities.subject], set: { deletedAt: values.now } });
  }

  /** Removes a login that was created for a registration or recovery that then failed, and never got data. */
  async unbindIdentity(issuer: string, subject: string) {
    await this.client.delete(authIdentities).where(and(eq(authIdentities.issuer, issuer), eq(authIdentities.subject, subject)));
  }

  /** The generated login address of a username login: the bound Neon login if there is one. */
  async getLoginEmail(issuer: string, accountId: string) {
    const identity = await this.getIdentityForAccount(issuer, accountId);
    return identity && !identity.deletedAt ? identity.loginEmail : null;
  }

  /**
   * The light columns with the cheapest features key this database offers. The code works the same before and
   * after migration 0009: without the column, Postgres hashes the features as before.
   */
  private async lightFields() {
    const now = Date.now();
    const known = this.storedFeaturesKey;
    if (known && (known.present || now - known.checkedAt < COLUMN_RECHECK_MS)) return known.present ? STORED_KEY_LIGHT_ROOM_FIELDS : LIGHT_ROOM_FIELDS;
    let present = false;
    try {
      const rows = await this.client.execute(sql`select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'coop_rooms' and column_name = 'features_key' limit 1`);
      present = Array.from(rows as ArrayLike<unknown>).length > 0;
    } catch {
      present = false;
    }
    this.storedFeaturesKey = { present, checkedAt: now };
    return present ? STORED_KEY_LIGHT_ROOM_FIELDS : LIGHT_ROOM_FIELDS;
  }

  /** Runs a light query; when the stored key column vanished (rollback), once more with md5. */
  private async withLightFields<T>(query: (fields: typeof LIGHT_ROOM_FIELDS) => Promise<T>): Promise<T> {
    const fields = await this.lightFields();
    try {
      return await query(fields);
    } catch (error) {
      if (fields === LIGHT_ROOM_FIELDS || !isUndefinedColumn(error)) throw error;
      this.storedFeaturesKey = { present: false, checkedAt: Date.now() };
      return query(LIGHT_ROOM_FIELDS);
    }
  }

  async getRoom(code: string): Promise<RoomRow | null> {
    const [room] = await this.client.select(ROOM_FIELDS).from(coopRooms).where(eq(coopRooms.code, code)).limit(1);
    return room ?? null;
  }

  /** The world without its big JSON columns: enough to answer "nothing changed" to a poll. */
  async getLightRoom(code: string): Promise<LightRoomRow | null> {
    const [room] = await this.withLightFields((fields) => this.client.select(fields).from(coopRooms).where(eq(coopRooms.code, code)).limit(1));
    return room ?? null;
  }

  /** Writes small columns such as a presence timestamp and returns only the seats, not the game. */
  async touchRoom(code: string, values: RoomUpdate): Promise<RoomSeats | null> {
    const [seats] = await this.client.update(coopRooms).set(values).where(eq(coopRooms.code, code)).returning(SEAT_FIELDS);
    return seats ?? null;
  }

  /** The worlds of a player for the world list; the list shows no game, so it reads none. */
  async listRoomsForPlayer(playerId: string): Promise<LightRoomRow[]> {
    return this.withLightFields((fields) => this.client
      .select(fields)
      .from(coopRooms)
      .where(or(
        eq(coopRooms.hostPlayerId, playerId),
        eq(coopRooms.guestPlayerId, playerId),
        eq(coopRooms.player3PlayerId, playerId),
        eq(coopRooms.player4PlayerId, playerId),
      ))
      .orderBy(desc(coopRooms.updatedAt))
      .limit(12));
  }

  /** The best worlds by goals, by league reached (1 is the top) or by trophies; ties go to more goals. */
  async getLeaderboard(sort: LeaderboardSort, limit: number): Promise<LeaderboardRow[]> {
    const order = sort === "league"
      ? [asc(coopRooms.sharedBestLeague), desc(coopRooms.sharedTotalGoals)]
      : sort === "trophies"
        ? [desc(coopRooms.sharedTrophies), desc(coopRooms.sharedTotalGoals)]
        : [desc(coopRooms.sharedTotalGoals)];
    return this.client
      .select(LEADERBOARD_FIELDS)
      .from(coopRooms)
      // Worlds with the AZB test code buy everything for free; they do not compete with real worlds.
      .where(and(gt(coopRooms.sharedTotalGoals, 0), notLike(coopRooms.redeemedBonusCodesJson, '%"AZB"%')))
      .orderBy(...order, asc(coopRooms.code))
      .limit(Math.max(1, Math.min(100, Math.floor(limit))));
  }

  /** Creates a world; null when its code is already taken (the caller picks another code). */
  async insertRoom(values: typeof coopRooms.$inferInsert): Promise<RoomRow | null> {
    try {
      const [room] = await this.client.insert(coopRooms).values(values).onConflictDoNothing({ target: coopRooms.code }).returning(ROOM_FIELDS);
      return room ?? null;
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  /**
   * Updates a world and returns it. The features are never sent back: a write that sets them already has
   * them, and only the rare writes without them (joining, renaming) read them once afterwards. `unchanged`:
   * the features (and backup) the caller read, for a write guarded by the shared state version that leaves them
   * as they were; a successful write proves they are still current, so they are not read again.
   */
  async updateRoom(code: string, values: RoomUpdate, conditions: RoomConditions = {}, unchanged?: Pick<RoomRow, "sharedFeaturesJson" | "sharedStateBackupJson">): Promise<RoomRow | null> {
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
    if (unchanged && values.sharedFeaturesJson === undefined && conditions.sharedStateVersion !== undefined) return { ...room, sharedFeaturesJson: unchanged.sharedFeaturesJson, sharedStateBackupJson: unchanged.sharedStateBackupJson };
    const [game] = await this.client.select({ sharedFeaturesJson: featuresColumn, sharedStateBackupJson: backupIfNeeded }).from(coopRooms).where(eq(coopRooms.code, code)).limit(1);
    return game ? { ...room, ...game } : null;
  }

  async deleteRoom(code: string) {
    await this.client.delete(coopRooms).where(eq(coopRooms.code, code));
  }

  /**
   * Books a batch of clicks the server counted. Clicks change only counters, so the world comes back without its
   * features (with their key). `previousClickState` is the seat's click state the amount was computed from; when
   * another request of the same seat changed it meanwhile, nothing is written (null).
   */
  async applyClick(code: string, role: string, amount: number, clickCount: number, timestamp: string, previousClickState: unknown = null, nextClickState: unknown = null, presence: RoomUpdate = {}): Promise<LightRoomRow | null> {
    const [room] = await this.withLightFields((fields) => this.client
      .update(coopRooms)
      .set({
        sharedCoins: increment(coopRooms.sharedCoins, amount),
        sharedTotalGoals: increment(coopRooms.sharedTotalGoals, amount),
        sharedSeasonGoals: increment(coopRooms.sharedSeasonGoals, amount),
        sharedStateVersion: increment(coopRooms.sharedStateVersion, 1), // shared_state_version = shared_state_version + 1
        pendingPlayerId: null,
        pendingUpgradeId: null,
        pendingUpgradeName: null,
        pendingCost: null,
        pendingUpgradeCount: null,
        updatedAt: timestamp,
        ...presence,
        ...(nextClickState ? { clickStateJson: sql`jsonb_set(${coopRooms.clickStateJson}::jsonb, array[${role}::text], ${JSON.stringify(nextClickState)}::jsonb)::text` } : {}),
        ...roleClickUpdate(role, amount, clickCount),
      })
      .where(and(
        eq(coopRooms.code, code),
        nextClickState ? sql`(${coopRooms.clickStateJson}::jsonb -> ${role}::text) is not distinct from ${previousClickState === null ? null : JSON.stringify(previousClickState)}::jsonb` : undefined,
      ))
      .returning(fields));
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
