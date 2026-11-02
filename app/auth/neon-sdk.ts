// The Neon Auth SDK instance (@neon/auth/next/server), created lazily: a missing or short cookie secret must not
// crash the build or unrelated routes, it only makes auth refuse (fail closed, see authMode()).
import { createNeonAuth } from "@neon/auth/next/server";
import { authConfigured, neonAuthBaseUrl, neonAuthCookieSecret } from "./config";

type NeonAuth = ReturnType<typeof createNeonAuth>;
let instance: { key: string; auth: NeonAuth } | null = null;

export function neonAuth(): NeonAuth | null {
  if (!authConfigured()) return null;
  const key = `${neonAuthBaseUrl()}\n${neonAuthCookieSecret()}`;
  if (instance?.key !== key) {
    instance = {
      key,
      auth: createNeonAuth({
        baseUrl: neonAuthBaseUrl(),
        // A short cache for the browser's own session reads; the server checks sessions itself (app/auth/server.ts).
        cookies: { secret: neonAuthCookieSecret(), sessionDataTtl: 60, sameSite: "lax" },
        logLevel: "warn",
      }),
    };
  }
  return instance.auth;
}
