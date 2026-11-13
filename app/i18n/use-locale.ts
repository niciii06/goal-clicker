"use client";

import { useEffect, useSyncExternalStore } from "react";
import { currentLocale, initLocaleFromDevice, subscribeLocale } from "./runtime";
import { SOURCE_LOCALE } from "./locales";

/**
 * The current language for a component; it renders again when the player switches. The first render matches the
 * server (German), then the stored choice applies, so hydration never mismatches.
 */
export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, currentLocale, () => SOURCE_LOCALE);
  useEffect(() => { initLocaleFromDevice(); }, []);
  return locale;
}
