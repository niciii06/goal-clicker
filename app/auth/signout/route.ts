// Ends the Supabase session on the server and clears the auth cookies, then returns to the game.
import { authConfigured } from "../config";
import { redirectWithCookies, supabaseForRequest } from "../server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  // Only same origin forms may log a user out.
  const from = request.headers.get("origin");
  if (from && from !== origin) return new Response("Nicht erlaubt", { status: 403 });
  if (!authConfigured()) return redirectWithCookies(`${origin}/`, []);
  const { client, setCookies } = supabaseForRequest(request);
  await client.auth.signOut();
  return redirectWithCookies(`${origin}/`, setCookies);
}
