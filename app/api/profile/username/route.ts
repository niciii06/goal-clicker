// Live check of a username while the player types it.
import { usernameAvailabilityResponse } from "../../../account-api";
import { withRateLimit } from "../../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withRateLimit("username", (request) => usernameAvailabilityResponse(request));
