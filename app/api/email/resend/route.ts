// A new confirmation code; the same answer for every address (app/account-api.ts).
import { resendVerificationResponse } from "../../../account-api";
import { withRateLimit } from "../../../api/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("emailCode", (request) => resendVerificationResponse(request));
