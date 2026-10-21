// Google sends the user back here through Supabase with a one time code (PKCE). The code becomes a session cookie.
import { authConfigured, safeReturnPath } from "../config";
import { publicOrigin, redirectWithCookies, supabaseForRequest } from "../server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const origin = publicOrigin(request);
  const failed = (reason: string) => redirectWithCookies(`${origin}/?login=${reason}`, []);
  if (!authConfigured()) return failed("nicht-konfiguriert");
  if (!code || url.searchParams.get("error")) return failed("abgebrochen");
  const { client, setCookies } = supabaseForRequest(request);
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return failed("fehler");
  return redirectWithCookies(`${origin}${next}`, setCookies);
}
