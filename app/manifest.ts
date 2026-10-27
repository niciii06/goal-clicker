import type { MetadataRoute } from "next";
import { TAB_PATHS } from "./tab-routes";
import { THEME_COLORS } from "./theme";

// Makes the game installable as an app on phones and desktops (served at /manifest.webmanifest).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Goal Clicker",
    short_name: "Goal Clicker",
    description: "Klick den Ball, sammle Tore und baue dein eigenes Fussball Imperium.",
    lang: "de",
    start_url: TAB_PATHS.home,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    categories: ["games", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Spiele", url: TAB_PATHS.cup, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Kader", url: TAB_PATHS.squad, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Packs", url: TAB_PATHS.packs, icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
