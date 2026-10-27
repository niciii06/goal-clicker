import { leaderboardResponse } from "../../leaderboard-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return leaderboardResponse(request);
}
