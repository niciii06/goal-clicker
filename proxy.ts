// Next.js 16 proxy (formerly middleware): sends odd spellings of tab addresses to the real one, refreshes
// an expiring Supabase session before pages and API routes read it, and passes the renewed cookies to
// both the route and the browser.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfigured, supabasePublishableKey, supabaseUrl } from "./app/auth/config";
import { canonicalTabPath } from "./app/tab-routes";

export async function proxy(request: NextRequest) {
  // /Kader or /kader/ lead to /kader.
  const canonical = canonicalTabPath(request.nextUrl.pathname);
  if (canonical) { const url = request.nextUrl.clone(); url.pathname = canonical; return NextResponse.redirect(url, 308); }
  if (!authConfigured()) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        for (const { name, value } of cookies) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {})) response.headers.set(name, value);
      },
    },
  });
  // Verifies the token and refreshes it when it is about to expire.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Everything except static files and the app shell files; the OAuth callback exchanges its code itself.
  matcher: ["/((?!_next/static|_next/image|auth/callback|favicon\\.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sounds/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
