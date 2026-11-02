// Auth settings shared by browser and server. Only NEXT_PUBLIC_AUTH_MODE reaches the browser (set at build time
// in next.config.ts); the Neon Auth URL and the cookie secret stay on the server.

/** Server only: the Neon Auth base URL of this branch, for example https://ep-....neonauth.../neondb/auth. */
export function neonAuthBaseUrl() {
  return (process.env.NEON_AUTH_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/** Server only: signs the SDK's session cache cookie. At least 32 characters. */
export function neonAuthCookieSecret() {
  return process.env.NEON_AUTH_COOKIE_SECRET ?? "";
}

export const MIN_COOKIE_SECRET_LENGTH = 32;

/** Why the auth configuration of this server is unusable, or null when it is complete and valid. */
export function authConfigProblem(): string | null {
  const base = neonAuthBaseUrl();
  const secret = neonAuthCookieSecret();
  if (!base && !secret) return "missing";
  if (!base) return "NEON_AUTH_BASE_URL fehlt";
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return "NEON_AUTH_BASE_URL ist keine gültige Adresse";
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:" && !hostedRuntime())) return "NEON_AUTH_BASE_URL muss https verwenden";
  if (url.search || url.hash || url.username || url.password) return "NEON_AUTH_BASE_URL darf keine Parameter oder Zugangsdaten enthalten";
  if (secret.length < MIN_COOKIE_SECRET_LENGTH) return "NEON_AUTH_COOKIE_SECRET ist kürzer als 32 Zeichen";
  return null;
}

/**
 * Whether this process runs on a hosting platform rather than on a developer machine or in a test. On a host a
 * missing or broken auth configuration must never fall back to anonymous play, where a claimed player ID
 * would be trusted. Netlify and Vercel are detected at runtime and also at build time (next.config.ts bakes
 * GOAL_CLICKER_HOSTED_BUILD in), so a Netlify Drop upload of a local build is still caught by the runtime check.
 */
export function hostedRuntime() {
  // Written out as process.env.NAME: Next.js inlines GOAL_CLICKER_HOSTED_BUILD only in that literal form.
  return Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.SITE_ID || process.env.DEPLOY_ID || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY_FUNCTIONS_TOKEN || process.env.GOAL_CLICKER_HOSTED_BUILD === "1" || process.env.AUTH_REQUIRED === "1");
}

export function authConfigured() {
  return authConfigProblem() === null;
}

/**
 * "neon": login through Neon Auth. "anonymous": no login configured on a developer machine or in tests; the old
 * player ID capability stays. "misconfigured": a hosted server, or one with an incomplete or invalid
 * configuration; it refuses everything that needs an identity instead of trusting claimed player IDs.
 */
export function authMode(): "neon" | "anonymous" | "misconfigured" {
  const problem = authConfigProblem();
  if (problem === null) return "neon";
  if (problem !== "missing") return "misconfigured";
  return hostedRuntime() ? "misconfigured" : "anonymous";
}

/** What the browser build was told (next.config.ts): "neon", "misconfigured" or "" for local anonymous play. */
export function browserAuthMode(): "neon" | "misconfigured" | "" {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE;
  return mode === "neon" || mode === "misconfigured" ? mode : "";
}

/**
 * The issuer every identity of this server is recorded under: the Neon Auth base URL without a trailing slash.
 * Staging and production have different Auth URLs, so a staging login can never open a production account.
 */
export function authIssuer() {
  const base = neonAuthBaseUrl();
  try {
    const url = new URL(base);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return "";
  }
}

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_SIGNOUT_PATH = "/auth/signout";

/** Only same origin relative paths, never the auth routes themselves. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local" || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/api/")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
