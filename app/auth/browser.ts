"use client";
// Browser side login. Google goes through the Neon Auth SDK (@neon/auth/next) and this site's /api/auth proxy, so
// the session cookie belongs to this site and the API routes see it. Username and password go to this server
// (/api/login, /api/register), which knows the generated login address behind a username and signs in at Neon Auth.
import { createAuthClient } from "@neon/auth/next";
import { AUTH_CALLBACK_PATH, AUTH_SIGNOUT_PATH, browserAuthMode } from "./config";

type AuthClient = ReturnType<typeof createAuthClient>;
let client: AuthClient | null = null;

export function authEnabled() {
  return browserAuthMode() === "neon";
}

function authClient() {
  if (!authEnabled()) throw new LoginError("Der Login ist auf diesem Server nicht eingerichtet.");
  client ??= createAuthClient();
  return client;
}

/** An error whose message is already meant for the player. */
class LoginError extends Error {}

type Result<T> = { data?: T | null; error?: { code?: string; message?: string; status?: number } | null };

/** The SDK reports failures in `error` instead of throwing. */
function unwrap<T>(result: Result<T>): T | null {
  if (result.error) throw Object.assign(new Error(result.error.message ?? "auth"), { code: result.error.code, status: result.error.status });
  return result.data ?? null;
}

function callbackUrl(params: Record<string, string>) {
  return `${window.location.origin}${AUTH_CALLBACK_PATH}?${new URLSearchParams(params).toString()}`;
}

function follow(data: { url?: string } | null) {
  // The SDK usually navigates itself; where it does not, the answer names the Google address.
  if (data?.url && /^https:\/\//.test(data.url)) window.location.assign(data.url);
}

export async function signInWithGoogle(returnTo = "/") {
  const data = unwrap(await authClient().signIn.social({ provider: "google", callbackURL: callbackUrl({ next: returnTo }), errorCallbackURL: callbackUrl({ failed: "1" }) }) as Result<{ url?: string }>);
  follow(data);
}

async function postJson<T>(path: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  } catch {
    throw new LoginError("Keine Verbindung. Prüfe dein Internet.");
  }
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new LoginError(data.error ?? "Das hat nicht geklappt. Bitte versuche es nochmal.");
  return data;
}

/** Username and password: the server signs in (and recovers an original account once, on the way). */
export async function signInWithUsername(username: string, password: string) {
  return postJson<{ signedIn: boolean; recovered?: boolean }>("/api/login", { username, password });
}

/** Creates the account with its profile on the server, which also signs the browser in. */
export async function registerWithUsername(username: string, displayName: string, password: string) {
  await postJson<{ profile: unknown }>("/api/register", { username, displayName, password });
}

/** TEMPORARY: takes over an original username account with a one time code from the owner and a new password. */
export async function recoverWithCode(username: string, code: string, password: string) {
  await postJson<{ signedIn: boolean }>("/api/recovery", { username, code, password });
}

/**
 * Links Google to the signed in account: afterwards Google and the username open the same account and save.
 * Returns through /auth/callback?link=google, where the server checks the link (app/auth/callback/route.ts).
 */
export async function linkGoogleAccount(returnTo = "/") {
  const data = unwrap(await authClient().linkSocial({ provider: "google", callbackURL: callbackUrl({ link: "google", next: returnTo }), errorCallbackURL: callbackUrl({ link: "google", next: returnTo, failed: "1" }) }) as Result<{ url?: string }>);
  follow(data);
}

/** "" when Google is linked to the signed in account (Neon Auth does not list its address), null without Google. */
export async function linkedGoogleEmail() {
  const accounts = unwrap(await authClient().listAccounts() as Result<{ providerId?: string }[]>) ?? [];
  return accounts.some((account) => account.providerId === "google") ? "" : null;
}

/** Changes the password of the signed in username account; other devices are signed out. */
export async function setAccountPassword(currentPassword: string, newPassword: string) {
  unwrap(await authClient().changePassword({ currentPassword, newPassword, revokeOtherSessions: true }) as Result<unknown>);
}

/** Ends the session at Neon Auth and removes the cookies (server route, works even if the SDK is not loaded). */
export async function signOutOfAuth() {
  await fetch(AUTH_SIGNOUT_PATH, { method: "POST", credentials: "same-origin", redirect: "manual" }).catch(() => undefined);
  client = null;
}

/** Asks the SDK for the session through the proxy, which also renews the session cookie when Neon Auth does. */
export async function refreshAuthSession() {
  if (!authEnabled()) return;
  await authClient().getSession().catch(() => undefined);
}

const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Benutzername oder Passwort stimmt nicht.",
  INVALID_PASSWORD: "Das aktuelle Passwort stimmt nicht.",
  PASSWORD_TOO_SHORT: "Das Passwort ist zu kurz. Nimm mindestens 8 Zeichen.",
  PASSWORD_TOO_LONG: "Das Passwort ist zu lang.",
  SESSION_EXPIRED: "Melde dich zuerst neu an, um das zu ändern.",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "Dieses Google Konto gehört schon zu einem anderen Spielerkonto.",
  ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER: "Dieses Google Konto gehört schon zu einem anderen Spielerkonto.",
  FAILED_TO_UNLINK_LAST_ACCOUNT: "Der letzte Login eines Kontos lässt sich nicht entfernen.",
  TOO_MANY_REQUESTS: "Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann nochmal.",
};

/** A German message for a failed login or password change. */
export function authErrorMessage(error: unknown) {
  if (error instanceof LoginError) return error.message;
  const failure = error as { code?: string; status?: number };
  if (failure?.code && AUTH_ERRORS[failure.code]) return AUTH_ERRORS[failure.code];
  if (failure?.status === 429) return AUTH_ERRORS.TOO_MANY_REQUESTS;
  if (error instanceof TypeError) return "Keine Verbindung. Prüfe dein Internet.";
  return "Das hat nicht geklappt. Bitte versuche es nochmal.";
}
