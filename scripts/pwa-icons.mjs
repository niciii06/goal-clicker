// Renders the app icons for the web app manifest from public/favicon.svg. Run once after changing the favicon:
// node scripts/pwa-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const favicon = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url);

for (const size of [192, 512]) {
  await writeFile(out(`icon-${size}.png`), await sharp(Buffer.from(favicon), { density: 72 * size / 64 }).resize(size, size).png().toBuffer());
}

// Maskable icons may be cut to a circle, so the ball sits in the inner 80% on a full bleed background.
const ball = favicon.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0071e3"/><g transform="translate(32 32) scale(0.72) translate(-32 -32)">${ball}</g></svg>`;
await writeFile(out("icon-maskable-512.png"), await sharp(Buffer.from(maskable), { density: 72 * 8 }).resize(512, 512).png().toBuffer());
