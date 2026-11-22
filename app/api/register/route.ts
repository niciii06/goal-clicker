// A new account with username, display name and password; with GOAL_CLICKER_EMAIL_SIGNUP also a real e-mail address that a mailed code confirms.
import { registerResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("register", (request) => registerResponse(request));
