// A new account with username, display name and password; no e-mail is involved.
import { registerResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("register", (request) => registerResponse(request));
