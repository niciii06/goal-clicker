// Supabase Auth settings shared by browser and server. NEXT_PUBLIC_ values are inlined into the browser build.
export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

/** The publishable key (sb_publishable_...) or, on older projects, the anon key. Both are public by design. */
export function supabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function authConfigured() {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

/**
 * "supabase": Google login through Supabase. "anonymous": no login configured, local development and tests
 * keep the old player ID capability. "misconfigured": a deployment without the keys; it must not fall back
 * to anonymous worlds.
 */
export function authMode(): "supabase" | "anonymous" | "misconfigured" {
  if (authConfigured()) return "supabase";
  return process.env.VERCEL || process.env.AUTH_REQUIRED === "1" ? "misconfigured" : "anonymous";
}

/**
 * Marks the frequent background polls (coop ticks, travel status). The proxy skips them: each pass through it
 * costs the whole request with its login cookies a second time in Fast Origin Transfer, and the browser client
 * keeps the session fresh on its own while the tab is open.
 */
export const BACKGROUND_POLL_HEADER = "x-goal-poll";

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_SIGNOUT_PATH = "/auth/signout";

/** Only same origin relative paths, never the auth routes themselves. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local" || url.pathname.startsWith("/auth/")) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
