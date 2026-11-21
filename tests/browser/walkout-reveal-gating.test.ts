// Isolated browser proof (run by hand after npm run build, not part of npm run test:browser):
//   node --import tsx --test --test-concurrency=1 tests/browser/walkout-reveal-gating.test.ts
// A fresh pack is opened with fed card rolls. Until the walkout is ready: no empty pill or ring, no tier text, no name or
// tier in the accessibility tree and no announcement; once ready the label, the description and one announcement appear.
// In reduced motion the card is there at once, so the label never comes before the card itself.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { normalizeGameFeatures } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.WALKOUT_PORT ?? 8804), BASE = `http://127.0.0.1:${PORT}`, SAVE_KEY = 'goalClickerSiteSaveV3';
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

// The two rolls of a pack purchase are fed right before the click: walkout 86+, top 90+, icon (Elite) and a legendary card (special pack).
const CASES = [
  { label: 'walkout 86+', special: false, pack: 'Profi-Pack', rolls: [0.991], text: /WALKOUT · 86\+/ },
  { label: 'top walkout 90+', special: false, pack: 'Elite', rolls: [0.991], text: /TOP WALKOUT · 90\+/ },
  { label: 'icon', special: false, pack: 'Elite', rolls: [0.9305, 0.0005], text: /ICON WALKOUT/ },
  { label: 'legendary', special: true, pack: 'Spezialkarten', rolls: [0.95, 0.95], text: /LEGENDÄRER WALKOUT/ },
];
const TIER_WORDS = /(ICON|LEGEND|\bTOP\b|86\+|90\+|90 plus|86 plus|WALKOUT KARTE)/i;
const STATE = `(() => { const d = document.querySelector('.star-reveal'); if (!d) return null;
 const visible = (el) => { for (let n = el; n && n !== d.parentElement; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < .05) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
 const label = d.querySelector('.star-reveal-walkout-label'), name = d.querySelector('.star-walkout-nameplate h2'), dismiss = d.querySelector('.star-walkout-dismiss'), status = d.querySelector('[role=status].sr-only');
 return { labelVisible: label ? visible(label) : false, labelText: label ? (label.textContent || '').replace(/\\u00a0/g, '').trim() : '', nameVisible: name ? visible(name) : false, ready: Boolean(dismiss) && !dismiss.disabled, announcement: status ? (status.textContent || '').trim() : '' }; })()`;

for (const reduced of [true, false]) for (const c of CASES) {
  test(`${c.label}: label, description and announcement wait for the reveal (${reduced ? 'reduced motion' : 'full animation'})`, async () => {
    const features = normalizeGameFeatures(structuredClone(baseSave.features)); features.seasonMode.highestDivision = 15; features.starXI.fragments = 120000;
    features.nextEventAt = Date.now() + 1e9; features.nextVarAt = Date.now() + 1e9; features.transferSaga.nextAt = Date.now() + 1e9;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-CH', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage(); await page.addInitScript('globalThis.__name = (fn) => fn;');
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features, lastSaved: Date.now() }), WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
    await page.goto(`${BASE}/packs`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    const button = c.special ? page.locator('article[aria-label^="Spezialkarten-Pack"] button.feature-buy-button') : page.locator('article.star-pack-card', { hasText: c.pack }).first().locator('button.feature-buy-button');
    await page.evaluate((rolls) => { const real = Math.random; (window as unknown as { __real: () => number }).__real = real; let i = 0; Math.random = () => rolls[i++ % rolls.length]; }, c.rolls);
    await button.click();
    await page.locator('.star-reveal').waitFor({ state: 'attached', timeout: 20000 });
    await page.evaluate(() => { Math.random = (window as unknown as { __real: () => number }).__real; });
    // At first sight: the accessibility tree names no tier, no card and no player yet.
    const tree = (await page.locator('.star-reveal').ariaSnapshot()).split('\n').map((line) => line.trim()).filter(Boolean);
    assert.deepEqual(tree.filter((line) => TIER_WORDS.test(line)), [], 'no tier or card text in the accessibility tree before the reveal');
    const t0 = Date.now(); let labelAt = -1, nameAt = -1, readyAt = -1;
    while (Date.now() - t0 < 14000) {
      const s = (await page.evaluate(STATE)) as { labelVisible: boolean; labelText: string; nameVisible: boolean; ready: boolean; announcement: string } | null;
      if (s) {
        if (s.labelVisible) assert.ok(s.labelText.length > 0, `an empty pill or ring is visible at +${Date.now() - t0} ms`);
        if (!s.ready) { assert.equal(s.labelText.length === 0 || !s.labelVisible, true, 'the tier label is not visible before ready'); assert.equal(s.announcement, '', 'nothing is announced before ready'); }
        if (s.labelVisible && labelAt < 0) { labelAt = Date.now() - t0; assert.ok(s.nameVisible, 'the card is already visible when the label appears'); assert.match(s.labelText, c.text); }
        if (s.nameVisible && nameAt < 0) nameAt = Date.now() - t0;
        if (s.ready && readyAt < 0) readyAt = Date.now() - t0;
        if (s.ready && s.labelVisible) { assert.match(s.announcement, /Walkout/); assert.match(s.announcement, /Rating \d+/); break; }
      }
      await page.waitForTimeout(60);
    }
    assert.ok(labelAt >= 0 && readyAt >= 0, 'the walkout became ready');
    assert.ok(nameAt >= 0 && nameAt <= labelAt, `the card (+${nameAt} ms) is visible before or with the label (+${labelAt} ms)`);
    if (!reduced) assert.ok(labelAt > 5000, `with the full animation the label comes at the end (+${labelAt} ms)`);
    await context.close();
  });
}
