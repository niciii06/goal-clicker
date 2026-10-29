// The single player save of the signed in account, shared by all its devices.
import { getCloudSaveResponse, putCloudSaveResponse } from "../../account-api";
import { withGzip } from "../compression";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withGzip((request: Request) => getCloudSaveResponse(request));
export const PUT = withGzip(withRateLimit("save", (request) => putCloudSaveResponse(request)));
