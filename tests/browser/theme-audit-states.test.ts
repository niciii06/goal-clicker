// Isolated browser proof (run by hand after npm run build, not part of npm run test:browser):
//   node --import tsx --test --test-concurrency=1 tests/browser/theme-audit-states.test.ts
// Light/dark audit of two states that only appear late in the game, with a local save and no account:
//  1. Phone header after Prestige: the balance row (bonus chip + "Prestige bereit") wraps instead of pushing the page wider than the screen.
//  2. Trophy room: the small total badge keeps a text contrast of at least 4.5 to 1 in both themes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { TOURNAMENTS, normalizeGameFeatures } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.THEME_AUDIT_PORT ?? 8805), BASE = `http://127.0.0.1:${PORT}`, SAVE_KEY = 'goalClickerSiteSaveV3';
let server: ChildProcess | undefined, browser: Browser, baseSave: Record<string, unknown> & { features: GameFeatures };
before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Run npm run build first.');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage(); await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), SAVE_KEY, { timeout: 30000 });
  baseSave = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!); await page.close();
});
after(async () => { await browser?.close(); if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ } } });

function features(change: (f: GameFeatures) => void) {
  const f = normalizeGameFeatures(structuredClone(baseSave.features));
  f.nextEventAt = Date.now() + 1e9; f.nextVarAt = Date.now() + 1e9; f.transferSaga.nextAt = Date.now() + 1e9;
  change(f); return f;
}
async function open(width: number, scheme: 'light' | 'dark', path: string, f: GameFeatures) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'de-CH', colorScheme: scheme, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;'); // tsx marks named helper functions, the browser has no __name
  const save = JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, seasons: 14, features: normalizeGameFeatures(f), lastSaved: Date.now() });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v, sk, sv]) => { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [SAVE_KEY, save, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0]?.id ?? 'x']);
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  return { page, close: () => context.close() };
}
/** Elements that stick out to the right of the screen (fixed layers and horizontal scrollers excluded). */
const stickingOut = (page: Page, width: number) => page.evaluate((w) => {
  const clipped = (el: Element) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).overflowX !== 'visible') return true; return false; };
  const out: string[] = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > w + 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.getAttribute('class') || '').split(' ')[0]} right=${Math.round(r.right)}`);
  }
  return out;
}, width);

for (const width of [360, 390]) for (const scheme of ['light', 'dark'] as const) {
  test(`phone ${width} ${scheme}: header after Prestige stays inside the screen`, async () => {
    const { page, close } = await open(width, scheme, '/spiele', features((f) => { f.seasonMode.hallOfFame = true; f.seasonMode.prestigeCount = 2; f.cup = { ...f.cup, active: false }; }));
    await page.locator('.header-prestige-ready').waitFor({ timeout: 10000 });
    assert.ok(await page.locator('.header-prestige').count(), 'the bonus chip is shown');
    assert.deepEqual(await stickingOut(page, width), [], 'nothing sticks out to the right');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll');
    const ready = await page.locator('.header-prestige-ready').boundingBox();
    assert.ok(ready && ready.x >= 0 && ready.x + ready.width <= width, 'the Prestige ready button is fully on screen');
    await close();
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`trophy room ${scheme}: total badge keeps 4.5 to 1`, async () => {
    const { page, close } = await open(390, scheme, '/club', features((f) => { for (const t of TOURNAMENTS.slice(0, 3)) f.cup.trophies = { ...f.cup.trophies, [t.id]: 2 }; }));
    const badge = page.locator('.trophy-room-heading > span').first();
    await badge.waitFor({ timeout: 10000 });
    const ratio = await badge.evaluate((el) => {
      const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const rgb = (c: string) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
      const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
      const cs = getComputedStyle(el), a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor));
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(ratio >= 4.5, `${scheme}: contrast ${ratio.toFixed(2)} to 1`);
    await close();
  });
}
