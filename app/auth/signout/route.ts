// Ends the Neon Auth session on the server and clears the auth cookies, then returns to the game.
import { authConfigured } from "../config";
import { signOutSession } from "../neon-accounts";
import { browserSetCookies, forgetSession, NEON_COOKIE_PREFIX, parseCookies, publicOrigin, redirectWithCookies, sameOrigin, SESSION_COOKIE } from "../server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  // Only same origin forms and requests may log a user out.
  if (!sameOrigin(request)) return new Response("Nicht erlaubt", { status: 403 });
  if (!authConfigured()) return redirectWithCookies(`${origin}/`, []);
  const cookies = parseCookies(request.headers.get("cookie"));
  const token = cookies.get(SESSION_COOKIE);
  forgetSession(request);
  const upstream = token ? await signOutSession(`${SESSION_COOKIE}=${token}`, origin) : [];
  // Whatever Neon Auth answered, the browser forgets every auth cookie.
  const cleared = [...cookies.keys()].filter((name) => name.startsWith(NEON_COOKIE_PREFIX)).map((name) => `${name}=; Path=/; Max-Age=0; HttpOnly`);
  return redirectWithCookies(`${origin}/`, [...browserSetCookies(upstream), ...browserSetCookies(cleared)]);
}
