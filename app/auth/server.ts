// Server side Supabase session: reads the auth cookies of a request and verifies the access token.
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { authConfigured, supabasePublishableKey, supabaseUrl } from "./config";

export type RequestUser = { id: string; email: string | null };

/** A Supabase client bound to one request; cookies it writes are collected as Set-Cookie values. */
export function supabaseForRequest(request: Request) {
  const setCookies: string[] = [];
  const client = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => parseCookieHeader(request.headers.get("cookie") ?? "").map(({ name, value }) => ({ name, value: value ?? "" })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) setCookies.push(serializeCookieHeader(name, value, options));
      },
    },
  });
  return { client, setCookies };
}

/** The signed in user, from a verified access token (getClaims checks the JWT signature). */
export async function getRequestUser(request: Request): Promise<RequestUser | null> {
  if (!authConfigured()) return null;
  const { client } = supabaseForRequest(request);
  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

export function redirectWithCookies(location: string, setCookies: readonly string[]) {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
