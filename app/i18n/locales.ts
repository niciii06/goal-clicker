// Languages of the game (docs/i18n-plan.md). German is the source language and the only one switched on: until a
// language is in ENABLED_LOCALES, every resolution ends in German, so nothing visible changes for players.
export const SOURCE_LOCALE = "de" as const;
export const LOCALES = ["de", "en", "fr", "es"] as const;
export type Locale = (typeof LOCALES)[number];

/** Languages players can get. English joins only once its catalog covers the game and the switch is designed. */
export const ENABLED_LOCALES: readonly Locale[] = [SOURCE_LOCALE];

/** BCP 47 tags for Intl (numbers, plurals). German keeps the Swiss format the game uses today (de-CH). */
export const INTL_TAG: Record<Locale, string> = { de: "de-CH", en: "en-GB", fr: "fr-CH", es: "es-ES" };

/** Where a later language setting would be kept on the device. Not written by anything yet. */
export const LOCALE_STORAGE_KEY = "goalClickerLocaleV1";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** "en-US" → "en", "DE_ch" → "de"; anything else → null. */
export function baseLocale(tag: unknown): Locale | null {
  if (typeof tag !== "string") return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/**
 * The language to show: the stored choice when it is enabled, else the first enabled browser language, else German.
 * A stored or browser language that is not enabled (yet) falls back, it never shows a half translated game.
 */
export function resolveLocale(stored: unknown, browserLanguages: readonly string[] = [], enabled: readonly Locale[] = ENABLED_LOCALES): Locale {
  const choice = baseLocale(stored);
  if (choice && enabled.includes(choice)) return choice;
  for (const tag of browserLanguages) {
    const locale = baseLocale(tag);
    if (locale && enabled.includes(locale)) return locale;
  }
  return SOURCE_LOCALE;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** The stored language, or null (nothing stored, unknown value, storage blocked). */
export function readStoredLocale(storage: KeyValueStorage | null | undefined): Locale | null {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** Stores a language choice; only enabled languages, and never throws (private mode, full storage). */
export function storeLocale(storage: KeyValueStorage | null | undefined, locale: Locale, enabled: readonly Locale[] = ENABLED_LOCALES) {
  if (!enabled.includes(locale)) return false;
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
    return Boolean(storage);
  } catch {
    return false;
  }
}
