import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { coopRooms, soloTravel } from "./schema";

export type RoomRow = typeof coopRooms.$inferSelect;
export type RoomUpdate = Partial<Omit<RoomRow, "code">>;

export type RoomSeatRole = "host" | "guest" | "player3" | "player4";

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
  async getRoom(code: string): Promise<RoomRow | null> {
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

  async insertRoom(values: typeof coopRooms.$inferInsert) {
    const [room] = await this.client.insert(coopRooms).values(values).returning();
    if (!room) throw new Error("Die Welt konnte nicht gespeichert werden.");
    return room;
  }

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
      .returning();
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
