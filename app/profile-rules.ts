// Rules for usernames, display names and passwords. The forms and the API share them.
// Validation messages in the current language: German on the server (API answers), the chosen one in the browser.
import { t } from "./i18n/runtime";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const DISPLAY_NAME_MIN = 2;
// Display names are also the multiplayer nickname, which the worlds store with at most 18 characters.
export const DISPLAY_NAME_MAX = 18;
export const USERNAME_CHANGE_DAYS = 30;
export const PASSWORD_MIN = 8;
// bcrypt, which Supabase Auth uses, only reads the first 72 bytes.
export const PASSWORD_MAX = 72;
/**
 * Accounts with username and password have a generated login address under this domain, because Supabase Auth
 * needs one. No mail is ever sent to it; the player only ever sees the username.
 */
export const PASSWORD_LOGIN_DOMAIN = "players.goal-clicker.vercel.app";

const RESERVED_USERNAMES = new Set(["admin", "administrator", "goalclicker", "goal_clicker", "support", "moderator", "mod", "system", "root", "null", "undefined", "staff", "team", "official", "help", "romario"]);

/** Usernames are unique regardless of upper and lower case. */
export function usernameKey(username: string) {
  return username.trim().toLowerCase();
}

export function usernameError(username: string): string | null {
  const value = username.trim();
  if (value.length < USERNAME_MIN) return t("profile.usernameTooShort", { min: USERNAME_MIN });
  if (value.length > USERNAME_MAX) return t("profile.usernameTooLong", { max: USERNAME_MAX });
  if (!/^[A-Za-z0-9_]+$/.test(value)) return t("profile.usernameCharacters");
  if (RESERVED_USERNAMES.has(value.toLowerCase())) return t("profile.usernameReserved");
  return null;
}

/** Removes control and invisible direction characters and collapses spaces. */
export function cleanDisplayName(name: string) {
  return name.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, "").trim().replace(/\s+/g, " ");
}

export function displayNameError(name: string): string | null {
  const value = cleanDisplayName(name);
  if (value.length < DISPLAY_NAME_MIN) return t("profile.displayNameTooShort", { min: DISPLAY_NAME_MIN });
  if (value.length > DISPLAY_NAME_MAX) return t("profile.displayNameTooLong", { max: DISPLAY_NAME_MAX });
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN) return t("profile.passwordTooShort", { min: PASSWORD_MIN });
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return t("profile.passwordTooLong", { max: PASSWORD_MAX });
  return null;
}

export function isPasswordLoginEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith(`@${PASSWORD_LOGIN_DOMAIN}`));
}

/** When the username may change again; the timestamps are ISO strings in UTC. */
export function nextUsernameChangeAt(changedAt: string) {
  const time = Date.parse(changedAt);
  return new Date((Number.isFinite(time) ? time : 0) + USERNAME_CHANGE_DAYS * 86_400_000).toISOString();
}

/** The latest previous change that still allows a new one at `now`. */
export function usernameChangeCutoff(now: Date) {
  return new Date(now.getTime() - USERNAME_CHANGE_DAYS * 86_400_000).toISOString();
}

export type PublicProfile = { username: string; displayName: string; usernameChangedAt: string; nextUsernameChangeAt: string };
