// Next.js 16 proxy (formerly middleware): sends odd spellings of tab addresses to the real one and, on the
// return from Google, lets the Neon Auth SDK exchange the one time neon_auth_session_verifier for the session
// cookie. Every other request passes untouched: the API routes verify sessions themselves (app/auth/server.ts),
// and the game shows its own login screen instead of redirecting.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_CALLBACK_PATH } from "./app/auth/config";
import { neonAuth } from "./app/auth/neon-sdk";
import { canonicalTabPath } from "./app/tab-routes";

let callbackMiddleware: ((request: NextRequest) => Promise<NextResponse>) | null = null;
let callbackMiddlewareFor: unknown = null;

export async function proxy(request: NextRequest) {
  // /Kader or /kader/ lead to /kader.
  const canonical = canonicalTabPath(request.nextUrl.pathname);
  if (canonical) { const url = request.nextUrl.clone(); url.pathname = canonical; return NextResponse.redirect(url, 308); }
  if (request.nextUrl.pathname !== AUTH_CALLBACK_PATH || !request.nextUrl.searchParams.has("neon_auth_session_verifier")) return NextResponse.next();
  const auth = neonAuth();
  if (!auth) return NextResponse.next();
  if (callbackMiddlewareFor !== auth) {
    // The callback is a public route of the SDK; it never redirects to a login page from here.
    callbackMiddleware = auth.middleware({ loginUrl: "/", publicRoutes: [AUTH_CALLBACK_PATH] });
    callbackMiddlewareFor = auth;
  }
  return callbackMiddleware!(request);
}

export const config = {
  // Everything except the API (its routes check sessions themselves and the proxy has nothing to do there, so
  // polls skip one function run), static files and the app shell files.
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|offline\\.html|sounds/|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
