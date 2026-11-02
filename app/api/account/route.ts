// The login state of this browser, the game account it opens and the player ID of that account.
// GET is a cheap check (cached session). POST verifies the session with Neon Auth, binds a first login to its
// game account (see app/auth/identity.ts) and links the player ID of this device on the account's first use.
import { accountSessionDefaults, accountSessionResponse } from "../../account-api";
import { authConfigured, authMode } from "../../auth/config";
import { accountPlayerId } from "../../auth/player";
import { getAuthSession } from "../../auth/server";
import { rateLimited } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  if (!authConfigured()) return Response.json({ configured: false, mode: authMode(), signedIn: false }, { headers: noStore });
  try {
    const session = await getAuthSession(request);
    return Response.json({ configured: true, signedIn: Boolean(session) }, { headers: noStore });
  } catch {
    return Response.json({ configured: true, signedIn: null, error: "Die Anmeldung kann gerade nicht geprüft werden." }, { status: 503, headers: noStore });
  }
}

const sessionDeps = accountSessionDefaults((account, claimed) => accountPlayerId(account, claimed));

export async function POST(request: Request) {
  const limited = rateLimited(request, "account");
  if (limited) return limited;
  return accountSessionResponse(request, sessionDeps);
}
