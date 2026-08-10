import { asc, desc, eq, lte } from "drizzle-orm";
import { getDb } from "../../../db";
import { leaderboardEntries } from "../../../db/schema";
import { MAX_PUBLIC_LEADERBOARD_SCORE, parseLeaderboardScore, preserveLeaderboardProgress } from "../../leaderboard-safety";

const MAX_NAME_LENGTH = 18;
const MAX_PLAYER_ID_LENGTH = 80;

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH) : "";
}

function cleanPlayerId(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_PLAYER_ID_LENGTH) : "";
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unbekannter Serverfehler";
  if (message.includes("no such table")) return "Die Online-Datenbank wird gerade eingerichtet. Bitte gleich nochmals versuchen.";
  return message;
}

export async function GET() {
  try {
    const db = getDb();
    const entries = await db
      .select()
      .from(leaderboardEntries)
      .where(lte(leaderboardEntries.totalGoals, MAX_PUBLIC_LEADERBOARD_SCORE))
      .orderBy(desc(leaderboardEntries.totalGoals), desc(leaderboardEntries.seasonGoals), asc(leaderboardEntries.updatedAt))
      .limit(100);
    return Response.json({ entries });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      playerId?: unknown;
      nickname?: unknown;
      totalGoals?: unknown;
      seasonGoals?: unknown;
      minigameWins?: unknown;
    };
    const playerId = cleanPlayerId(payload.playerId);
    const nickname = cleanName(payload.nickname);
    if (playerId.length < 8) return Response.json({ error: "Spieler-ID fehlt." }, { status: 400 });
    if (nickname.length < 2) return Response.json({ error: "Der Spielername muss mindestens 2 Zeichen haben." }, { status: 400 });

    const submittedTotalGoals = parseLeaderboardScore(payload.totalGoals);
    const submittedSeasonGoals = parseLeaderboardScore(payload.seasonGoals);
    const submittedMinigameWins = parseLeaderboardScore(payload.minigameWins);
    if (submittedTotalGoals === null || submittedSeasonGoals === null || submittedMinigameWins === null) {
      return Response.json({ error: "Dieser Spielstand enthält einen ungültigen Ranglistenwert." }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(leaderboardEntries).where(eq(leaderboardEntries.playerId, playerId)).limit(1);
    const values = {
      playerId,
      nickname,
      totalGoals: preserveLeaderboardProgress(existing?.totalGoals, submittedTotalGoals),
      seasonGoals: submittedSeasonGoals,
      minigameWins: preserveLeaderboardProgress(existing?.minigameWins, Math.floor(submittedMinigameWins)),
      updatedAt: new Date().toISOString(),
    };
    await db
      .insert(leaderboardEntries)
      .values(values)
      .onConflictDoUpdate({
        target: leaderboardEntries.playerId,
        set: {
          nickname: values.nickname,
          totalGoals: values.totalGoals,
          seasonGoals: values.seasonGoals,
          minigameWins: values.minigameWins,
          updatedAt: values.updatedAt,
        },
      });
    const [entry] = await db.select().from(leaderboardEntries).where(eq(leaderboardEntries.playerId, playerId)).limit(1);
    return Response.json({ entry });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
