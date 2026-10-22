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

function requireClient() {
  const supabase = browserSupabase();
  if (!supabase) throw new Error("Der Login ist nicht eingerichtet.");
  return supabase;
}

/** An error whose message is already meant for the player. */
class LoginError extends Error {}

async function postJson<T>(path: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new LoginError("Keine Verbindung. Prüfe dein Internet.");
  }
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new LoginError(data.error ?? "Das hat nicht geklappt. Bitte versuche es nochmal.");
  return data;
}

async function signInWithLoginEmail(email: string, password: string) {
  const { error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Username and password: the server knows the login address behind the username, Supabase checks the password. */
export async function signInWithUsername(username: string, password: string) {
  const { email } = await postJson<{ email: string }>("/api/login", { username });
  await signInWithLoginEmail(email, password);
}

/** Creates the account with its profile on the server, then signs in like a normal login. */
export async function registerWithUsername(username: string, displayName: string, password: string) {
  const { email } = await postJson<{ email: string }>("/api/register", { username, displayName, password });
  await signInWithLoginEmail(email, password);
}

/** Changes the password of the signed in account. */
export async function setAccountPassword(password: string) {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Benutzername oder Passwort stimmt nicht.",
  over_request_rate_limit: "Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann nochmal.",
  weak_password: "Das Passwort ist zu schwach. Nimm mindestens 8 Zeichen mit Buchstaben und Zahlen.",
  same_password: "Das neue Passwort muss sich vom alten unterscheiden.",
  reauthentication_needed: "Melde dich zuerst neu an, um das Passwort zu ändern.",
};

/** A German message for a failed login or password change. */
export function authErrorMessage(error: unknown) {
  if (error instanceof LoginError) return error.message;
  const failure = error as { code?: string; status?: number };
  if (failure?.code && AUTH_ERRORS[failure.code]) return AUTH_ERRORS[failure.code];
  if (failure?.status === 429) return AUTH_ERRORS.over_request_rate_limit;
  if (error instanceof TypeError) return "Keine Verbindung. Prüfe dein Internet.";
  return "Das hat nicht geklappt. Bitte versuche es nochmal.";
}
