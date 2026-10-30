// Google sends the user back here through Supabase with a one time code (PKCE). The code becomes a session cookie.
// With ?link=google the player linked Google to a username account; the game then says how that went (?google=...).
import { authConfigured, safeReturnPath } from "../config";
import { publicOrigin, redirectWithCookies, supabaseForRequest } from "../server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const origin = publicOrigin(request);
  const linking = url.searchParams.get("link") === "google";
  const failed = (reason: string) => redirectWithCookies(linking ? `${origin}/?google=${reason}` : `${origin}/?login=${reason}`, []);
  if (!authConfigured()) return failed("nicht-konfiguriert");
  if (url.searchParams.get("error_code") === "identity_already_exists") return failed("vergeben");
  if (!code || url.searchParams.get("error")) return failed("abgebrochen");
  const { client, setCookies } = supabaseForRequest(request);
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return failed(error.code === "identity_already_exists" ? "vergeben" : "fehler");
  if (!linking) return redirectWithCookies(`${origin}${next}`, setCookies);
  const target = new URL(next, origin);
  target.searchParams.set("google", "verknuepft");
  return redirectWithCookies(target.toString(), setCookies);
}
