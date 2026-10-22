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

/** The three kinds of codes Supabase mails: login without password, confirming a new account, new password. */
export type EmailCodeKind = "email" | "signup" | "recovery";

/** Sends a login code; an unknown address gets a new account. */
export async function sendLoginCode(email: string) {
  const { error } = await requireClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string, kind: EmailCodeKind) {
  const { error } = await requireClient().auth.verifyOtp({ email, token, type: kind });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Registers with a password; Supabase then mails a code to confirm the address. For an address that already
 * has an account Supabase answers the same way without sending anything, so nobody can probe addresses.
 */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await requireClient().auth.signUp({ email, password });
  if (error) throw error;
  return { alreadyRegistered: Boolean(data.user && data.user.identities?.length === 0) };
}

export async function resendSignupCode(email: string) {
  const { error } = await requireClient().auth.resend({ type: "signup", email });
  if (error) throw error;
}

export async function sendPasswordResetCode(email: string) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/** Sets or changes the password of the signed in account, also for accounts that started with Google. */
export async function setAccountPassword(password: string) {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "E-Mail oder Passwort stimmt nicht.",
  email_not_confirmed: "Bestätige zuerst deine E-Mail Adresse mit dem Code aus der Mail.",
  otp_expired: "Der Code ist falsch oder abgelaufen. Fordere einen neuen an.",
  over_email_send_rate_limit: "Es wurden gerade zu viele Mails verschickt. Bitte warte ein paar Minuten.",
  over_request_rate_limit: "Zu viele Versuche. Bitte warte kurz und versuche es dann nochmal.",
  weak_password: "Das Passwort ist zu schwach. Nimm mindestens 8 Zeichen mit Buchstaben und Zahlen.",
  same_password: "Das neue Passwort muss sich vom alten unterscheiden.",
  email_address_invalid: "Diese E-Mail Adresse ist ungültig.",
  user_already_exists: "Für diese Adresse gibt es schon ein Konto. Melde dich an.",
  email_exists: "Für diese Adresse gibt es schon ein Konto. Melde dich an.",
  signup_disabled: "Neue Konten sind gerade nicht möglich.",
  email_provider_disabled: "Die Anmeldung mit E-Mail ist noch nicht eingeschaltet.",
  otp_disabled: "Die Anmeldung mit Code ist noch nicht eingeschaltet.",
  validation_failed: "Bitte prüfe deine Eingaben.",
  reauthentication_needed: "Melde dich zuerst neu an, um das Passwort zu ändern.",
};

/** A German message for a Supabase Auth error. */
export function authErrorMessage(error: unknown) {
  const failure = error as { code?: string; status?: number; message?: string };
  if (failure?.code && AUTH_ERRORS[failure.code]) return AUTH_ERRORS[failure.code];
  if (failure?.status === 429) return AUTH_ERRORS.over_request_rate_limit;
  if (/Error sending/i.test(failure?.message ?? "")) return "Die Mail konnte nicht verschickt werden. Bitte versuche es später nochmal.";
  if (error instanceof TypeError) return "Keine Verbindung. Prüfe dein Internet.";
  return "Das hat nicht geklappt. Bitte versuche es nochmal.";
}
