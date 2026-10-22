// Light, dark or whatever the device uses. A per device choice, so it stays out of the cloud save.
export const THEME_STORAGE_KEY = "goalClickerThemeV1";
export type ThemePreference = "system" | "light" | "dark";
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Automatisch" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

/**
 * Runs inline in <head> before the first paint, so a dark page never flashes light. Kept as a string because it
 * must not wait for the app bundle.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function setThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private windows may refuse storage; the choice then lasts until the page reloads.
  }
}
