"use client";
// Browser side Supabase client. It keeps the session in cookies, so the API routes see the same login.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authConfigured, supabasePublishableKey, supabaseUrl, AUTH_CALLBACK_PATH } from "./config";

let client: SupabaseClient | null = null;

export function browserSupabase() {
  if (!authConfigured()) return null;
  client ??= createBrowserClient(supabaseUrl(), supabasePublishableKey());
  return client;
}

export async function signInWithGoogle(returnTo = "/") {
  const supabase = browserSupabase();
  if (!supabase) throw new Error("Der Login ist nicht eingerichtet.");
  const redirectTo = `${window.location.origin}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(returnTo)}`;
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) throw error;
}
