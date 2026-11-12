// Central lookup for player facing texts (docs/i18n-plan.md). Not wired into the interface yet: nothing imports it
// outside tests, and German is the only enabled language, so the game looks exactly as before.
import { de, type Message, type MessageKey, type PluralForms } from "./messages/de";
import { en } from "./messages/en";
import { INTL_TAG, SOURCE_LOCALE, type Locale } from "./locales";

export type { MessageKey } from "./messages/de";
export type MessageParams = Record<string, string | number>;
type Catalog = Partial<Record<MessageKey, Message>>;

/** French and Spanish are planned (docs/i18n-plan.md); until they have catalogs they read German. */
export const CATALOGS: Record<Locale, Catalog> = { de, en, fr: {}, es: {} };

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralCategory(locale: Locale, count: number) {
  const tag = INTL_TAG[locale];
  let rules = pluralRules.get(tag);
  if (!rules) { rules = new Intl.PluralRules(tag); pluralRules.set(tag, rules); }
  return rules.select(count);
}

function isPlural(message: Message): message is PluralForms {
  return typeof message === "object" && message !== null && typeof message.other === "string";
}

/** Numbers in placeholders use the format of the language (de-CH: 1’234). Strings go in as they are. */
function formatParam(locale: Locale, value: string | number) {
  return typeof value === "number" ? value.toLocaleString(INTL_TAG[locale]) : value;
}

/**
 * The text of `key` in `locale`, German when the language lacks it. {name} placeholders take `params`; a plural
 * message picks its form by params.count. A placeholder without a value stays visible ({name}), so a missing
 * parameter shows up in tests instead of silently disappearing.
 */
export function translate(locale: Locale, key: MessageKey, params: MessageParams = {}, catalogs: Record<Locale, Catalog> = CATALOGS): string {
  const own = catalogs[locale]?.[key];
  const message: Message = own ?? catalogs[SOURCE_LOCALE][key] ?? de[key];
  const used: Locale = own === undefined ? SOURCE_LOCALE : locale;
  let text: string;
  if (isPlural(message)) {
    const count = Number(params.count);
    const forms: PluralForms = message;
    text = (Number.isFinite(count) ? forms[pluralCategory(used, count)] : undefined) ?? forms.other;
  } else {
    text = message;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? formatParam(used, params[name]) : match);
}

/** A translate function bound to one language, for a component tree or a server response. */
export function translator(locale: Locale) {
  return (key: MessageKey, params?: MessageParams) => translate(locale, key, params);
}

/** Keys a language lacks (it falls back to German for them) and keys it has that German no longer knows. */
export function catalogGaps(locale: Locale, catalogs: Record<Locale, Catalog> = CATALOGS) {
  const source = Object.keys(catalogs[SOURCE_LOCALE]);
  const own = Object.keys(catalogs[locale] ?? {});
  return { missing: source.filter((key) => !own.includes(key)), unknown: own.filter((key) => !source.includes(key)) };
}

/** Placeholder names of a message (every plural form), to check that a translation keeps them. */
export function placeholders(message: Message) {
  const texts = isPlural(message) ? Object.values(message) : [message];
  return [...new Set(texts.flatMap((text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
}
