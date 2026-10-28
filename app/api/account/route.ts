// The login state of this browser and the player ID of the account.
// POST links the player ID of this device on the first login, or returns the account's existing ID.
import { authConfigured } from "../../auth/config";
import { accountPlayerId } from "../../auth/player";
import { getRequestUser } from "../../auth/server";
import { readJsonBody, RequestBodyTooLargeError } from "../request-body";
import { rateLimited } from "../rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "cache-control": "no-store" };

function cleanPlayerId(value: unknown) {
  const id = typeof value === "string" ? value.trim().slice(0, 80) : "";
  return id.length >= 8 ? id : "";
}

export async function GET(request: Request) {
  if (!authConfigured()) return Response.json({ configured: false, signedIn: false }, { headers: noStore });
  const user = await getRequestUser(request);
  return Response.json({ configured: true, signedIn: Boolean(user), email: user?.email ?? null }, { headers: noStore });
}

export async function POST(request: Request) {
  try {
    const limited = rateLimited(request, "account");
    if (limited) return limited;
    if (!authConfigured()) return Response.json({ error: "Der Login ist nicht eingerichtet." }, { status: 503, headers: noStore });
    const user = await getRequestUser(request);
    if (!user) return Response.json({ error: "Nicht angemeldet.", errorCode: "LOGIN_REQUIRED" }, { status: 401, headers: noStore });
    const body = await readJsonBody<{ playerId?: unknown }>(request, 4096);
    const claimed = cleanPlayerId(body.playerId);
    const playerId = await accountPlayerId(user, claimed, undefined, request);
    if (!playerId) return Response.json({ error: "Diese Spieler-ID gehört bereits zu einem anderen Konto.", errorCode: "PLAYER_TAKEN" }, { status: 409, headers: noStore });
    return Response.json({ signedIn: true, email: user.email, playerId }, { headers: noStore });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ error: error.message }, { status: 413, headers: noStore });
    return Response.json({ error: "Das Konto konnte gerade nicht geladen werden." }, { status: 503, headers: noStore });
  }
}
