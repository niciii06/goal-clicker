// Google sends the player back here through Neon Auth. proxy.ts has already exchanged the one time
// neon_auth_session_verifier for the session cookie (the SDK's middleware) and removed it from the address.
// This route only decides where the game continues. With ?link=google the player linked Google to a username
// account; the game then says how that went (?google=...). A Google login that is the old login of another
// original account is unlinked again (app/auth/identity.ts, checkGoogleLinks).
import { authConfigured, safeReturnPath } from "../config";
import { checkGoogleLinks, lookupAccount } from "../identity";
import { getAuthSession, publicOrigin, redirectWithCookies } from "../server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"));
  const origin = publicOrigin(request);
  const linking = url.searchParams.get("link") === "google";
  const failed = (reason: string) => redirectWithCookies(linking ? `${origin}${next}${next.includes("?") ? "&" : "?"}google=${reason}` : `${origin}/?login=${reason}`, []);
  if (!authConfigured()) return failed("nicht-konfiguriert");
  const error = url.searchParams.get("error") ?? "";
  if (error) return failed(/already|linked|different/i.test(error) ? "vergeben" : /access_denied|cancel/i.test(error) ? "abgebrochen" : "fehler");
  if (url.searchParams.has("failed")) return failed("fehler");
  if (url.searchParams.has("neon_auth_session_verifier")) return failed("fehler");
  if (!linking) return redirectWithCookies(`${origin}${next}`, []);
  try {
    const session = await getAuthSession(request, { fresh: true });
    if (!session) return failed("fehler");
    const account = await lookupAccount(session);
    if (!account.ok) return failed("fehler");
    const result = await checkGoogleLinks(session, account.accountId, origin);
    if (result === "conflict") return failed("vergeben");
    if (result === "none") return failed("abgebrochen");
  } catch {
    return failed("fehler");
  }
  const target = new URL(next, origin);
  target.searchParams.set("google", "verknuepft");
  return redirectWithCookies(target.toString(), []);
}
