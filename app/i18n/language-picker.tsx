"use client";

// Language choice, built like the appearance choice next to it (a segmented radio group): every option names its
// language in that language, the chosen one is marked by state and border, and each option is at least 44 px high.
import { ENABLED_LOCALES } from "./locales";
import type { Locale } from "./locales";
import { chooseLocale, t } from "./runtime";
import { useLocale } from "./use-locale";

const NATIVE_NAMES: Record<Locale, string> = { de: "Deutsch", en: "English", fr: "Français", es: "Español" };

export function LanguagePicker({ className = "theme-picker language-picker" }: { className?: string }) {
  const locale = useLocale();
  return <div className={className}>
    <span id="language-picker-label">{t("settings.language")}</span>
    <div role="radiogroup" aria-labelledby="language-picker-label">
      {ENABLED_LOCALES.map((option) => <button key={option} type="button" role="radio" lang={option} aria-checked={locale === option} className={locale === option ? "active" : ""} onClick={() => chooseLocale(option)}>{NATIVE_NAMES[option]}</button>)}
    </div>
  </div>;
}
