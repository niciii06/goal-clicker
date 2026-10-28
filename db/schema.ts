import { sql } from "drizzle-orm";
import { bigint, boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";

// Supabase exposes the public schema through its REST API. Row level security without any policy keeps
// these tables closed to the browser keys; the server connects as the database owner, which bypasses it.

/** ISO 8601 in UTC, the same text format the API writes into every timestamp column. */
const isoNow = sql`to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const coopRooms = pgTable("coop_rooms", {
  code: text("code").primaryKey(),
  roomName: text("room_name").notNull().default("Meine Welt"),
  hostPlayerId: text("host_player_id").notNull(),
  hostName: text("host_name").notNull(),
  hostLastSeenAt: text("host_last_seen_at").notNull().default(""),
  guestPlayerId: text("guest_player_id"),
  guestName: text("guest_name"),
  guestLastSeenAt: text("guest_last_seen_at").notNull().default(""),
  player3PlayerId: text("player3_player_id"),
  player3Name: text("player3_name"),
  player3LastSeenAt: text("player3_last_seen_at").notNull().default(""),
  player4PlayerId: text("player4_player_id"),
  player4Name: text("player4_name"),
  player4LastSeenAt: text("player4_last_seen_at").notNull().default(""),
  sharedCoins: doublePrecision("shared_coins").notNull().default(0),
  hostGoals: doublePrecision("host_goals").notNull().default(0),
  guestGoals: doublePrecision("guest_goals").notNull().default(0),
  player3Goals: doublePrecision("player3_goals").notNull().default(0),
  player4Goals: doublePrecision("player4_goals").notNull().default(0),
  hostClicks: bigint("host_clicks", { mode: "number" }).notNull().default(0),
  guestClicks: bigint("guest_clicks", { mode: "number" }).notNull().default(0),
  player3Clicks: bigint("player3_clicks", { mode: "number" }).notNull().default(0),
  player4Clicks: bigint("player4_clicks", { mode: "number" }).notNull().default(0),
  sharedUpgradeLevel: integer("shared_upgrade_level").notNull().default(0),
  sharedTotalGoals: doublePrecision("shared_total_goals").notNull().default(0),
  sharedSeasonGoals: doublePrecision("shared_season_goals").notNull().default(0),
  sharedUpgradesJson: text("shared_upgrades_json").notNull().default("{}"),
  sharedAchievementsJson: text("shared_achievements_json").notNull().default("[]"),
  sharedStars: integer("shared_stars").notNull().default(0),
  sharedSeasons: integer("shared_seasons").notNull().default(0),
  sharedMinigameWins: integer("shared_minigame_wins").notNull().default(0),
  // Leaderboard values the server derives from the world on every save (league 1 is the top).
  sharedBestLeague: integer("shared_best_league").notNull().default(15),
  sharedTrophies: integer("shared_trophies").notNull().default(0),
  sharedMiniGameCooldownsJson: text("shared_minigame_cooldowns_json").notNull().default("{}"),
  sharedFeaturesJson: text("shared_features_json").notNull().default("{}"),
  sharedStateBackupJson: text("shared_state_backup_json").notNull().default("{}"),
  sharedStateVersion: bigint("shared_state_version", { mode: "number" }).notNull().default(0),
  redeemedBonusCodesJson: text("redeemed_bonus_codes_json").notNull().default("[]"),
  lastPassiveAt: text("last_passive_at").notNull().default(""),
  pendingPlayerId: text("pending_player_id"),
  pendingUpgradeId: text("pending_upgrade_id"),
  pendingUpgradeName: text("pending_upgrade_name"),
  pendingCost: doublePrecision("pending_cost"),
  pendingUpgradeCount: integer("pending_upgrade_count"),
  updatedAt: text("updated_at").notNull().default(isoNow),
}, (t) => [
  // The world list looks a player up in every seat.
  index("coop_rooms_host_player_idx").on(t.hostPlayerId),
  index("coop_rooms_guest_player_idx").on(t.guestPlayerId),
  index("coop_rooms_player3_player_idx").on(t.player3PlayerId),
  index("coop_rooms_player4_player_idx").on(t.player4PlayerId),
  // The leaderboard sorts worlds by their goals.
  index("coop_rooms_total_goals_idx").on(t.sharedTotalGoals.desc()),
]).enableRLS();

// Solo journey receipts use the existing player capability, like shared worlds.
export const soloTravel = pgTable("solo_travel", {
  owner: text("owner").notNull(),
  fixtureId: text("fixture_id").notNull(),
  journeyJson: jsonb("journey_json").notNull(),
}, (t) => [primaryKey({ columns: [t.owner, t.fixtureId] })]).enableRLS();

// Links a Supabase Auth user (Google login) to the game's player ID. The player ID stays the key of every
// world seat and receipt, so worlds played before the login keep working once the ID is linked.
export const playerAccounts = pgTable("player_accounts", {
  userId: uuid("user_id").primaryKey(),
  playerId: text("player_id").notNull().unique(),
  email: text("email"),
  createdAt: text("created_at").notNull().default(isoNow),
}).enableRLS();

// The profile every account creates after its first login. username_key (lower case) keeps usernames unique
// regardless of case; username keeps the spelling the player chose.
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  username: text("username").notNull(),
  usernameKey: text("username_key").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Only for accounts with username and password: the generated login address behind the username.
  // It never leaves the server and no mail is ever sent to it.
  loginEmail: text("login_email"),
  usernameChangedAt: text("username_changed_at").notNull().default(isoNow),
  createdAt: text("created_at").notNull().default(isoNow),
  updatedAt: text("updated_at").notNull().default(isoNow),
}).enableRLS();

// The single player save of an account, as the goalClicker localStorage keys of the last device that saved.
// version grows with every save, so a device can only overwrite the save it loaded. active is false when the
// device only collected passive goals since its previous save, nobody clicked or typed there.
export const cloudSaves = pgTable("cloud_saves", {
  userId: uuid("user_id").primaryKey(),
  saveJson: text("save_json").notNull(),
  version: bigint("version", { mode: "number" }).notNull().default(1),
  active: boolean("active").notNull().default(true),
  /** The last version a played device stored (not just passive goals). A device may only replace the save
   * without asking when nothing was played since the version it loaded. */
  activeVersion: bigint("active_version", { mode: "number" }).notNull().default(0),
  updatedAt: text("updated_at").notNull().default(isoNow),
}).enableRLS();
