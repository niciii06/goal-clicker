// The profile of the signed in account: read, create (first login), change and delete.
import { createProfileResponse, deleteProfileResponse, getProfileResponse, updateProfileResponse } from "../../account-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = (request: Request) => getProfileResponse(request);
export const POST = (request: Request) => createProfileResponse(request);
export const PATCH = (request: Request) => updateProfileResponse(request);
export const DELETE = (request: Request) => deleteProfileResponse(request);
