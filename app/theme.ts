// Light, dark or whatever the device uses. A per device choice, so it stays out of the cloud save.
export const THEME_STORAGE_KEY = "goalClickerThemeV1";
export type ThemePreference = "system" | "light" | "dark";
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Automatisch" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

/** Page background per theme, also used for the browser bar (theme-color). */
export const THEME_COLORS = { light: "#f3f6f4", dark: "#07130e" } as const;

/** Id of the theme-color tag a fixed choice puts first in <head>; the browser bar uses the first one. */
export const THEME_COLOR_META_ID = "gc-theme-color";

/**
 * Runs inline in <head> before the first paint, so a dark page never flashes light. Kept as a string because it
 * must not wait for the app bundle. React owns the theme-color tags from the layout and would add them again if
 * their content changed, so a fixed choice adds its own tag in front of them instead.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),c=${JSON.stringify(THEME_COLORS)};if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;var m=document.createElement("meta");m.name="theme-color";m.id=${JSON.stringify(THEME_COLOR_META_ID)};m.content=c[t];document.head.prepend(m)}}catch(e){}`;

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
  let meta = document.getElementById(THEME_COLOR_META_ID) as HTMLMetaElement | null;
  if (preference === "system") meta?.remove();
  else {
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.id = THEME_COLOR_META_ID;
      document.head.prepend(meta);
    }
    meta.content = THEME_COLORS[preference];
  }
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private windows may refuse storage; the choice then lasts until the page reloads.
  }
}
