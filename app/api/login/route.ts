// Turns a username into the login address the browser then signs in with.
import { loginEmailResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("login", (request) => loginEmailResponse(request));
