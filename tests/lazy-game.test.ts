// Audit P13: the page shell (app/page.tsx) must not load the game or its card data statically; the game comes as
// its own chunk through the dynamic import of app/game-app.tsx.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "../app");

function resolveImport(from: string, spec: string) {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) if (existsSync(candidate) && !candidate.endsWith("/")) { try { readFileSync(candidate); return candidate; } catch { /* directory */ } }
  return null;
}

/** Every module the file pulls in through static (non type) imports and re-exports. */
function staticGraph(entry: string) {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/^(?:import|export)\s+(?!type\b)(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
      const target = resolveImport(file, match[1]);
      if (target) queue.push(target);
    }
  }
  return [...seen].map((file) => file.slice(APP.length + 1));
}

test("the page shell loads the account screen without the game and the card data", () => {
  const graph = staticGraph(`${APP}/page.tsx`);
  for (const heavy of ["game-app.tsx", "feature-data.ts", "fc26-player-pool.ts", "fc27-positions.ts", "fc27-ratings.ts", "fc27-added-players.ts", "fc27-women-pool.ts", "walkout-data.ts", "scrap-pack.ts", "game/storage.ts"]) {
    assert.ok(!graph.includes(heavy), `${heavy} is in the first bundle: ${graph.join(", ")}`);
  }
  assert.ok(graph.includes("account-gate.tsx"));
  const page = readFileSync(`${APP}/page.tsx`, "utf8");
  assert.match(page, /import\("\.\/game-app"\)/);
  assert.match(page, /export const dynamic = "force-dynamic";/);
});

test("the game module still reaches all of the game", () => {
  const graph = staticGraph(`${APP}/game-app.tsx`);
  for (const file of ["feature-data.ts", "fc27-positions.ts", "walkout-data.ts", "game/storage.ts", "account-gate.tsx"]) assert.ok(graph.includes(file), file);
});

test("the light modules keep one shared state with the game", async () => {
  const persistence = await import("../app/game/persistence.ts");
  const storage = await import("../app/game/storage.ts");
  assert.equal(storage.suspendLocalPersistence, persistence.suspendLocalPersistence);
  assert.equal(storage.resumeLocalPersistence, persistence.resumeLocalPersistence);
  const schema = await import("../app/features/schema-version.ts");
  const features = await import("../app/feature-data.ts");
  assert.equal(features.GAME_FEATURES_SCHEMA_VERSION, schema.GAME_FEATURES_SCHEMA_VERSION);
  const ui = await import("../app/game/ui.tsx");
  const boundary = await import("../app/game/error-boundary.tsx");
  assert.equal(ui.GameErrorBoundary, boundary.GameErrorBoundary);
});
