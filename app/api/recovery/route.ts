// TEMPORARY recovery bridge: a username account takes over a one time code the owner issued for it and sets a new
// password (scripts/migration/issue-recovery-code.mts, docs/neon-netlify-migration.md).
import { recoveryCodeResponse } from "../../account-api";
import { withRateLimit } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const POST = withRateLimit("recovery", (request) => recoveryCodeResponse(request));
