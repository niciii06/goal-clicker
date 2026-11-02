// Signs in with username and password on the server (the generated login address never reaches the browser).
// An original username account without a Neon login is recovered on the way (TEMPORARY bridge).
import { loginResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("login", (request) => loginResponse(request));
