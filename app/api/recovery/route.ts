import { recoveryCodeResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("recovery", (request) => recoveryCodeResponse(request));
