// Same origin proxy to Neon Auth for the browser SDK (@neon/auth/next), through the SDK's own handler.
// Only the calls the game uses are passed on. Creating logins with an e-mail address, signing in with one, changing
// the e-mail and deleting the user go through this server's own endpoints instead (/api/register, /api/login,
// DELETE /api/profile), so the game controls which login addresses exist and how an account is deleted.
import { authConfigured } from "../../../auth/config";
import { neonAuth } from "../../../auth/neon-sdk";
import { sameOrigin } from "../../../auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED: Record<string, readonly string[]> = {
  "get-session": ["GET"],
  "sign-out": ["POST"],
  "sign-in/social": ["POST"],
  "link-social": ["POST"],
  "list-accounts": ["GET"],
  "unlink-account": ["POST"],
  "change-password": ["POST"],
  "list-sessions": ["GET"],
  "revoke-session": ["POST"],
  "revoke-sessions": ["POST"],
  "revoke-other-sessions": ["POST"],
};

type Context = { params: Promise<{ path: string[] }> };
const refuse = (status: number, error: string) => Response.json({ error, code: status === 404 ? "NOT_FOUND" : "FORBIDDEN" }, { status, headers: { "cache-control": "no-store" } });

async function handle(request: Request, context: Context) {
  if (!authConfigured()) return refuse(503, "Der Login ist auf diesem Server nicht eingerichtet.");
  const path = (await context.params).path.join("/");
  if (!ALLOWED[path]?.includes(request.method)) return refuse(404, "Nicht vorhanden.");
  if (request.method !== "GET" && !sameOrigin(request)) return refuse(403, "Nicht erlaubt.");
  const handler = neonAuth()!.handler();
  const method = request.method as "GET" | "POST";
  return handler[method](request, context);
}

export const GET = handle;
export const POST = handle;
