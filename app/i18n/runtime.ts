// The language this browser shows (docs/i18n-plan.md). On the server it is always German: API answers, saves and
// everything the server writes stay German. In the browser it comes from the stored choice, else the browser
// language, else German; `chooseLocale` stores a new choice on this device only (never in a save or an account).
import { de } from "./messages/de";
import type { MessageKey } from "./messages/de";
import { ENABLED_LOCALES, INTL_TAG, SOURCE_LOCALE, readStoredLocale, resolveLocale, storeLocale } from "./locales";
import type { Locale } from "./locales";
import { translate } from "./translate";
import type { MessageParams } from "./translate";

let current: Locale = SOURCE_LOCALE;
const listeners = new Set<() => void>();

export function currentLocale(): Locale {
  return current;
}

/** BCP 47 tag of the current language, for dates and numbers (de-CH for German as before). */
export function currentIntlTag() {
  return INTL_TAG[current];
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function apply(locale: Locale) {
  if (locale === current) return;
  current = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  for (const listener of listeners) listener();
}

function deviceStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** Reads the stored choice or the browser language once the page runs in the browser. */
export function initLocaleFromDevice() {
  if (typeof window === "undefined") return current;
  apply(resolveLocale(readStoredLocale(deviceStorage()), typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]));
  return current;
}

/** The player's choice: shown at once, remembered on this device. Only enabled languages are accepted. */
export function chooseLocale(locale: Locale) {
  if (!ENABLED_LOCALES.includes(locale)) return false;
  storeLocale(deviceStorage(), locale);
  apply(locale);
  return true;
}

/** A text of the catalogue in the current language (German where the language lacks it). */
export function t(key: MessageKey, params?: MessageParams) {
  return translate(current, key, params);
}

// German catalogue texts without placeholders, for texts that reach the browser already written out (API answers,
// constants computed at import). Built once.
const GERMAN_TEXT_TO_KEY = new Map<string, MessageKey>(
  (Object.entries(de) as [MessageKey, unknown][]).filter(([, value]) => typeof value === "string" && !/\{\w+\}/.test(value as string)).map(([key, value]) => [value as string, key]),
);

/** A German text from the server or a constant in the current language when the catalogue knows it; otherwise as it is. */
export function localizeText(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const key = GERMAN_TEXT_TO_KEY.get(text);
  return key ? t(key) : text;
}

/** Only for tests: back to German without touching storage. */
export function resetLocaleForTests() {
  apply(SOURCE_LOCALE);
}
