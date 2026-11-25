// Password reset with a mailed one time code; neutral for unknown addresses (app/account-api.ts).
import { passwordResetResponse } from "../../account-api";
import { withRateLimit } from "../../api/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("passwordReset", (request) => passwordResetResponse(request));
