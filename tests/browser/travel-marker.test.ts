// Browser acceptance of «Stadion-Standorte auf Reisekarte, Zielmarker (Wankdorf)» on the production build: for a trip to the
// Wankdorf the drawn destination marker sits exactly on the audited stadium position (not at a city centre, not in the
// forest) at several zoom levels on phone and desktop and after a reload, and the road route ends at the stadium.
// The map tiles (OpenStreetMap) are not loaded here; the check is on the projection the tiles are aligned with.
// Run: TRAVELMARKER_PORT=8827 node --import tsx --test --test-concurrency=1 tests/browser/travel-marker.test.ts (after npm run build).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { normalizeGameFeatures } from '../../app/feature-data.ts';
import { createJourney, fixtureFor } from '../../app/travel-data.ts';
import { VENUES } from '../../app/travel-geography.ts';
import { project } from '../../app/travel-map-geometry.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.TRAVELMARKER_PORT ?? 8827);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
let server: ChildProcess | undefined;
let browser: Browser;
let baseSave: Record<string, unknown>;

before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Run npm run build first.');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { stdio: 'ignore', detached: true, env: { ...process.env, PORT: String(PORT) } });
  for (const until = Date.now() + 120000; Date.now() < until;) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 500)); }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), SAVE_KEY, { timeout: 30000 });
  baseSave = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!);
  await page.close();
});
after(async () => {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); } }
});

/** A trip from Zurich to the Wankdorf, started a little while ago. */
function wankdorfSave(now: number) {
  const f = normalizeGameFeatures(structuredClone(baseSave.features));
  f.nextEventAt = now + 1e9; f.nextVarAt = now + 1e9; f.transferSaga.nextAt = now + 1e9;
  (f.seasonMode as { homeCity: string }).homeCity = 'zurich';
  const fixture = fixtureFor(f, 'season');
  const wankdorf = { ...fixture, away: true, venue: { ...VENUES.bern } } as typeof fixture;
  f.travel.journey = createJourney(wankdorf, now - 60000, () => 0.5, f);
  const journey = f.travel.journey!;
  return { json: JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(f), lastSaved: now }), city: journey.fixture.venue.city };
}
const metersPerPixel = (zoom: number, lat: number) => 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** zoom;

for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`${viewport.name}: the destination marker sits on the audited Wankdorf position at every zoom level and after a reload; the route ends at the stadium`, async () => {
    const now = Date.now();
    const { json, city } = wankdorfSave(now);
    assert.equal(city, 'Bern');
    const page = await browser.newPage({ viewport, locale: 'de-CH' });
    await page.addInitScript('globalThis.__name = (fn) => fn;');
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, json, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
    const target = project(VENUES.bern);
    const measure = async () => page.evaluate(() => {
      const marker = document.querySelector('.travel-map circle[fill="#c69214"]') as SVGCircleElement | null;
      const lines = [...document.querySelectorAll('.travel-map polyline[stroke="white"]')];
      const last = (lines.at(-1)?.getAttribute('points') ?? '').trim().split(' ').at(-1)!.split(',').map(Number);
      return marker ? { cx: Number(marker.getAttribute('cx')), cy: Number(marker.getAttribute('cy')), routeX: last[0], routeY: last[1] } : null;
    });
    const check = async (label: string) => {
      const m = (await measure())!;
      assert.ok(m, `${label}: destination marker drawn`);
      const scale = m.cx / target.x;
      const zoom = Math.log2(scale / 256);
      assert.ok(Math.abs(zoom - Math.round(zoom)) < 1e-6, `${label}: marker x fits a whole zoom level (${zoom})`);
      assert.ok(Math.abs(m.cy / target.y - scale) < 1e-3 * scale, `${label}: marker y fits the same projection of the Wankdorf (${m.cy / target.y} vs ${scale})`);
      const mpp = metersPerPixel(zoom, VENUES.bern.lat);
      const routeGap = Math.hypot(m.routeX - m.cx, m.routeY - m.cy) * mpp;
      assert.ok(routeGap < 100, `${label}: the route ends ${routeGap.toFixed(0)} m from the marker`);
    };
    for (const attempt of [0, 1]) {
      await page.goto(`${BASE}/spiele`, { waitUntil: 'networkidle' });
      await page.getByRole('region', { name: 'Auswärtsreise' }).waitFor({ timeout: 20000 });
      await page.locator('.travel-map').waitFor();
      await page.getByRole('button', { name: 'Route', exact: true }).click();
      await check(`${viewport.name} fit ${attempt ? 'after reload' : ''}`);
      for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: /vergrössern/i }).click(); await page.waitForTimeout(150); await check(`${viewport.name} zoom +${i + 1}`); }
      if (!attempt) await page.reload({ waitUntil: 'networkidle' });
    }
    assert.deepEqual(problems, []);
    await page.close();
  });
}
