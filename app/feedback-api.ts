// /api/feedback: players report a bug, an improvement or a feature wish, optionally with a screenshot.
// Off unless GOAL_CLICKER_FEEDBACK=1 and the table of migration 0010 exists. Reports are stored first; a mail to the
// operator follows once address and mail service are decided (Nicolas, 25.11.2026), so nothing is sent yet.
import { getDb } from "../db";
import { refuseUnsafePost, readJsonBody, RequestBodyTooLargeError } from "./api/request-body";
import { sharedRateLimited } from "./api/rate-limit";
import { getAuthSession } from "./auth/server";
import { lookupAccount } from "./auth/identity";
import { FEEDBACK_MAX_BODY_BYTES, parseFeedback } from "./feedback-rules";

export type FeedbackStore = {
  feedbackReady: () => Promise<boolean>;
  insertFeedback: (values: { kind: string; title: string; description: string; accountId: string | null; playerId: string | null; locale: string | null; screenshotType: string | null; screenshotBase64: string | null }) => Promise<string>;
};
export type FeedbackDeps = {
  enabled: () => boolean;
  store: () => FeedbackStore;
  rateLimit: (request: Request) => Promise<Response | null>;
  accountOf: (request: Request) => Promise<string | null>;
};

const NO_STORE = { "cache-control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export const feedbackDefaults: FeedbackDeps = {
  enabled: () => process.env.GOAL_CLICKER_FEEDBACK === "1",
  store: () => getDb(),
  rateLimit: (request) => sharedRateLimited(request, "feedback"),
  // A signed in player's report carries the account; a failed lookup simply leaves it out.
  accountOf: async (request) => {
    try {
      const session = await getAuthSession(request);
      if (!session) return null;
      const account = await lookupAccount(session);
      return account.ok ? account.accountId : null;
    } catch {
      return null;
    }
  },
};

async function available(deps: FeedbackDeps) {
  if (!deps.enabled()) return false;
  try { return await deps.store().feedbackReady(); } catch { return false; }
}

/** Whether the form may be shown. */
export async function feedbackStatusResponse(deps = feedbackDefaults) {
  return json({ enabled: await available(deps) });
}

export async function feedbackSubmitResponse(request: Request, deps = feedbackDefaults) {
  const refused = refuseUnsafePost(request);
  if (refused) return refused;
  if (!(await available(deps))) return json({ errorCode: "FEEDBACK_UNAVAILABLE" }, 503);
  const limited = await deps.rateLimit(request);
  if (limited) return limited;
  let body: { kind?: unknown; title?: unknown; description?: unknown; screenshot?: unknown; playerId?: unknown; locale?: unknown };
  try {
    body = await readJsonBody(request, FEEDBACK_MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ errorCode: "IMAGE_SIZE" }, 413);
    return json({ errorCode: "INVALID" }, 400);
  }
  const parsed = parseFeedback(body ?? {});
  if (!parsed.ok) return json({ errorCode: parsed.error }, 400);
  const playerId = typeof body.playerId === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(body.playerId) ? body.playerId : null;
  const locale = body.locale === "en" || body.locale === "de" ? body.locale : null;
  try {
    const id = await deps.store().insertFeedback({
      kind: parsed.input.kind, title: parsed.input.title, description: parsed.input.description,
      accountId: await deps.accountOf(request), playerId, locale,
      screenshotType: parsed.input.screenshot?.type ?? null, screenshotBase64: parsed.input.screenshot?.base64 ?? null,
    });
    return json({ id }, 201);
  } catch {
    return json({ errorCode: "STORE_FAILED" }, 503);
  }
}
