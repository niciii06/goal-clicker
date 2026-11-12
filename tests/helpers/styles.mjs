// The game's stylesheets in the cascade order of app/layout.tsx (globals.css was split by area, audit P14).
import { readFileSync } from "node:fs";

export const STYLE_FILES = ["globals.css", "styles/base.css", "styles/match.css", "styles/walkout.css", "styles/album.css", "styles/travel.css", "styles/season.css", "styles/coop.css", "qol/qol.css"];

/** All game styles as one text, in cascade order. */
export function readStyles() {
  return STYLE_FILES.map((file) => readFileSync(new URL(`../../app/${file}`, import.meta.url), "utf8")).join("\n");
}
