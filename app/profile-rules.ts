// Rules for usernames, display names and passwords. The forms and the API share them.
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
  if (value.length < USERNAME_MIN) return `Der Benutzername braucht mindestens ${USERNAME_MIN} Zeichen.`;
  if (value.length > USERNAME_MAX) return `Der Benutzername darf höchstens ${USERNAME_MAX} Zeichen haben.`;
  if (!/^[A-Za-z0-9_]+$/.test(value)) return "Erlaubt sind nur Buchstaben ohne Umlaute, Zahlen und _.";
  if (RESERVED_USERNAMES.has(value.toLowerCase())) return "Dieser Benutzername ist reserviert.";
  return null;
}

/** Removes control and invisible direction characters and collapses spaces. */
export function cleanDisplayName(name: string) {
  return name.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g, "").trim().replace(/\s+/g, " ");
}

export function displayNameError(name: string): string | null {
  const value = cleanDisplayName(name);
  if (value.length < DISPLAY_NAME_MIN) return `Der Anzeigename braucht mindestens ${DISPLAY_NAME_MIN} Zeichen.`;
  if (value.length > DISPLAY_NAME_MAX) return `Der Anzeigename darf höchstens ${DISPLAY_NAME_MAX} Zeichen haben.`;
  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Das Passwort braucht mindestens ${PASSWORD_MIN} Zeichen.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return `Das Passwort darf höchstens ${PASSWORD_MAX} Zeichen haben.`;
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
