// globals.css split by area (audit P14): layout.tsx loads the files in the one cascade order the split was checked in.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { STYLE_FILES, readStyles } from "./helpers/styles.mjs";

test("layout.tsx imports every style file once and in cascade order", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const imported = [...layout.matchAll(/^import "\.\/([^"]+\.css)";$/gm)].map((match) => match[1]);
  assert.deepEqual(imported, STYLE_FILES);
});

test("globals.css only loads Tailwind; every area file has its own rules and keyframes stay unique", () => {
  assert.equal(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8").trim(), '@import "tailwindcss";');
  for (const file of STYLE_FILES.slice(1)) assert.ok(readFileSync(new URL(`../app/${file}`, import.meta.url), "utf8").length > 1000, file);
  const names = [...readStyles().matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);
  assert.equal(new Set(names).size, names.length);
  // The theme tokens stay first, so every area file can use them.
  assert.match(readFileSync(new URL("../app/styles/base.css", import.meta.url), "utf8"), /^\/\*[^\n]*\*\/\n:root \{/);
});
