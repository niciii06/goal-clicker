import { leaderboardResponse } from "../../leaderboard-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";

// Every call sorts the worlds in the database, so one address may only ask now and then.
export const GET = withRateLimit("leaderboard", (request) => leaderboardResponse(request));
