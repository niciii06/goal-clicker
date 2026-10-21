// Production build check: `next start` serves the game page and the API with the expected headers.
// Run after `npm run build` (npm test does both).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { after, before, test } from "node:test";

const PORT = Number(process.env.RENDER_TEST_PORT ?? 3917);
const BASE = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first.");
  // Without Supabase keys the server runs in anonymous mode, exactly like local development.
  const env = { ...process.env, PORT: String(PORT) };
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VERCEL", "AUTH_REQUIRED"]) delete env[key];
  server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT), "-H", "127.0.0.1"], { stdio: "ignore", detached: true, env });
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("next start did not answer");
});

after(() => {
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); } }
});

const developmentPreviewMeta = /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders the production page with security headers and without preview metadata", async () => {
  const response = await fetch(BASE, { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("x-powered-by"), null);
  const html = await response.text();
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.match(html, /Goal Clicker/);
});

test("the account API reports that login is not configured on a server without keys", async () => {
  const response = await fetch(`${BASE}/api/account`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { configured: false, signedIn: false });
});
