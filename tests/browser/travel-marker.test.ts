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
function wankdorfSave(now: number, startedAgoMs = 60000) {
  const f = normalizeGameFeatures(structuredClone(baseSave.features));
  f.nextEventAt = now + 1e9; f.nextVarAt = now + 1e9; f.transferSaga.nextAt = now + 1e9;
  (f.seasonMode as { homeCity: string }).homeCity = 'zurich';
  const fixture = fixtureFor(f, 'season');
  const wankdorf = { ...fixture, away: true, venue: { ...VENUES.bern } } as typeof fixture;
  f.travel.journey = createJourney(wankdorf, now - startedAgoMs, () => 0.5, f);
  const journey = f.travel.journey!;
  return { json: JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(f), lastSaved: now }), city: journey.fixture.venue.city };
}
/** A real trip from Bern to the tournament in Zurich (bus, train, bus), started `startedAgoMs` ago. */
function tripSave(now: number, startedAgoMs: number) {
  const f = normalizeGameFeatures(structuredClone(baseSave.features));
  f.nextEventAt = now + 1e9; f.nextVarAt = now + 1e9; f.transferSaga.nextAt = now + 1e9;
  f.travel.journey = createJourney(fixtureFor(f, 'tournament', 'stadium'), now - startedAgoMs, () => 0.5, f);
  return JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(f), lastSaved: now });
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

// «Busanimation wieder entlang der Strasse führen»: while the bus is on its way, the vehicle sits on the drawn road, not on the straight line.
for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`${viewport.name}: the bus drives on the drawn road at several moments of the trip`, async () => {
    const onRoad: string[] = [];
    for (const minutes of [1, 2, 3, 5, 8, 12, 20, 40, 60, 80]) {
      const now = Date.now();
      const json = tripSave(now, minutes * 60000);
      const page = await browser.newPage({ viewport, locale: 'de-CH' });
      await page.addInitScript('globalThis.__name = (fn) => fn;');
      await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, json, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
      await page.goto(`${BASE}/spiele`, { waitUntil: 'networkidle' });
      await page.locator('.travel-map').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1200);
      const sample = await page.evaluate(() => {
        const body = document.querySelector('.travel-map circle[r="23"]')?.parentElement;
        const m = body?.getAttribute('transform')?.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
        const icon = body?.querySelector('text')?.textContent ?? '';
        const lines = [...document.querySelectorAll('.travel-map polyline[stroke="white"]')].map((l) => (l.getAttribute('points') ?? '').trim().split(' ').map((pair) => pair.split(',').map(Number)));
        if (!m) return null;
        const p = [Number(m[1]), Number(m[2])];
        let best = Infinity;
        for (const line of lines) for (let i = 1; i < line.length; i++) {
          const [a, b] = [line[i - 1], line[i]], dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
          best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
        }
        return { icon, best, points: Math.max(...lines.map((l) => l.length)) };
      });
      assert.ok(sample, `vehicle drawn at ${minutes} min`);
      if (sample!.icon.includes('🚌')) { assert.ok(sample!.points >= 20, `the drawn course follows a road with many points, not a straight line (${sample!.points})`); onRoad.push(`${minutes}min ${sample!.best.toFixed(2)}px`); assert.ok(sample!.best < 2, `the bus sits on the drawn road at ${minutes} min (${sample!.best.toFixed(2)} px away)`); }
      await page.close();
    }
    assert.ok(onRoad.length >= 2, `the bus was on the way at least twice (${onRoad.join(', ')})`);
    console.log(`${viewport.name}: ${onRoad.join(', ')}`);
  });
}
