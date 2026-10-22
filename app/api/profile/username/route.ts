// Live check of a username while the player types it.
import { usernameAvailabilityResponse } from "../../../account-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = (request: Request) => usernameAvailabilityResponse(request);
