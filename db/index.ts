import { and, desc, eq, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { coopRooms } from "./schema";

export type RoomRow = typeof coopRooms.$inferSelect;
export type RoomUpdate = Partial<Omit<RoomRow, "code">>;

type RoomConditions = {
  sharedStateVersion?: number;
  lastPassiveAt?: string;
};

function createDatabase() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding \`DB\` ist nicht verfügbar. Die bestehenden Welten werden dadurch nicht verändert.",
    );
  }
  return drizzle(env.DB, { schema });
}

type Database = ReturnType<typeof createDatabase>;

function increment(column: string, amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return sql.raw('"' + column + '" + ' + String(safeAmount));
}

function roleClickUpdate(role: string, amount: number, clickCount: number) {
  if (role === "host") return { hostGoals: increment("host_goals", amount), hostClicks: increment("host_clicks", clickCount) };
  if (role === "guest") return { guestGoals: increment("guest_goals", amount), guestClicks: increment("guest_clicks", clickCount) };
  if (role === "player3") return { player3Goals: increment("player3_goals", amount), player3Clicks: increment("player3_clicks", clickCount) };
  return { player4Goals: increment("player4_goals", amount), player4Clicks: increment("player4_clicks", clickCount) };
}

export class GoalClickerDatabase {
  constructor(private readonly client: Database) {}

  async getRoom(code: string) {
    const [room] = await this.client.select().from(coopRooms).where(eq(coopRooms.code, code)).limit(1);
    return room ?? null;
  }

  async listRoomsForPlayer(playerId: string) {
    return this.client
      .select()
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

  async insertRoom(values: Partial<typeof coopRooms.$inferInsert>) {
    const [room] = await this.client.insert(coopRooms).values(values).returning();
    if (!room) throw new Error("Die Welt konnte nicht gespeichert werden.");
    return room;
  }

  async updateRoom(code: string, values: RoomUpdate, conditions: RoomConditions = {}) {
    const predicates = [eq(coopRooms.code, code)];
    if (conditions.sharedStateVersion !== undefined) predicates.push(eq(coopRooms.sharedStateVersion, conditions.sharedStateVersion));
    if (conditions.lastPassiveAt !== undefined) predicates.push(eq(coopRooms.lastPassiveAt, conditions.lastPassiveAt));
    const [room] = await this.client
      .update(coopRooms)
      .set(values)
      .where(and(...predicates))
      .returning();
    return room ?? null;
  }

  async deleteRoom(code: string) {
    await this.client.delete(coopRooms).where(eq(coopRooms.code, code));
  }

  async applyClick(code: string, role: string, amount: number, clickCount: number, timestamp: string) {
    const [room] = await this.client
      .update(coopRooms)
      .set({
        sharedCoins: increment("shared_coins", amount),
        sharedTotalGoals: increment("shared_total_goals", amount),
        sharedSeasonGoals: increment("shared_season_goals", amount),
        sharedStateVersion: increment("shared_state_version", 1), // shared_state_version + 1
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
      .returning();
    return room ?? null;
  }

}

let database: GoalClickerDatabase | null = null;

export function getDb() {
  database ??= new GoalClickerDatabase(createDatabase());
  return database;
}
