// The single player save of the signed in account, shared by all its devices.
import { getCloudSaveResponse, putCloudSaveResponse } from "../../account-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = (request: Request) => getCloudSaveResponse(request);
export const PUT = (request: Request) => putCloudSaveResponse(request);
