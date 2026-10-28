// The profile of the signed in account: read, create (first login), change and delete.
import { createProfileResponse, deleteProfileResponse, getProfileResponse, updateProfileResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = (request: Request) => getProfileResponse(request);
export const POST = withRateLimit("profile", (request) => createProfileResponse(request));
export const PATCH = withRateLimit("profile", (request) => updateProfileResponse(request));
export const DELETE = withRateLimit("profile", (request) => deleteProfileResponse(request));
