// Isolated browser proof (not part of npm run test:browser): day 7 of the daily reward gives the special card pack
// and no goals. Solo save in localStorage, no income, no account, no server data. Run after npm run build:
//   node --import tsx --test --test-concurrency=1 tests/browser/daily-reward-day7.test.ts
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { getPreviousRewardDay, getRewardDay } from '../../app/daily-reward.ts';
import { normalizeGameFeatures } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.DAILY_PORT ?? 8803), BASE = `http://127.0.0.1:${PORT}`, SAVE_KEY = 'goalClickerSiteSaveV3';
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

const GOALS = 777_000;
const CONTEXTS = [
  { name: 'desktop light', viewport: { width: 1280, height: 900 }, scheme: 'light' as const, touch: false },
  { name: 'phone dark', viewport: { width: 390, height: 844 }, scheme: 'dark' as const, touch: true },
  { name: 'tablet dark', viewport: { width: 834, height: 1194 }, scheme: 'dark' as const, touch: true },
];
const read = (page: import('playwright-core').Page) => page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)!); return { goals: s.goals, total: s.totalGoals, packs: (s.features.earnedPacks as { id: string; packId: string }[]).filter((p) => p.id.startsWith('daily-')), daily: s.features.dailyRewards }; }, SAVE_KEY);

for (const ctx of CONTEXTS) {
  test(`day 7 gives only the special pack, no goals (${ctx.name})`, async () => {
    const today = getRewardDay(), features = normalizeGameFeatures(structuredClone(baseSave.features));
    features.dailyRewards = { solo: { day: getPreviousRewardDay(today), streak: 6 } };
    features.nextEventAt = Date.now() + 1e9; features.nextVarAt = Date.now() + 1e9; features.transferSaga.nextAt = Date.now() + 1e9;
    const context = await browser.newContext({ viewport: ctx.viewport, colorScheme: ctx.scheme, locale: 'de-CH', ...(ctx.touch ? { hasTouch: true, isMobile: true } : {}) });
    const page = await context.newPage(); await page.addInitScript('globalThis.__name = (fn) => fn;');
    const problems: string[] = []; page.on('pageerror', (e) => problems.push(e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, JSON.stringify({ ...baseSave, goals: GOALS, totalGoals: GOALS, seasonGoals: GOALS, features, lastSaved: Date.now() }), WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);

    const card = page.getByRole('region', { name: 'Tägliche Prämie' });
    assert.match(await card.getByRole('heading').innerText(), /Tag 7 wartet/);
    const tile = card.locator('li.current');
    assert.equal((await tile.innerText()).replace(/\s+/g, ' ').trim(), 'Tag 7 🎁 Spezialpack', 'the calendar tile shows only the pack');
    const button = card.getByRole('button', { name: /Prämie abholen/ });
    assert.equal((await button.innerText()).trim(), 'Prämie abholen · Spezialkarten-Pack', 'the claim button shows only the pack');
    assert.doesNotMatch(await card.innerText(), /\d+\s*Tore|15K|15'000|\+ ?0/);

    // Apple check of the claim button: size, contrast (text 4.5:1), keyboard focus ring.
    const box = (await button.boundingBox())!; assert.ok(box.width >= 44 && box.height >= 44, `target ${box.width} x ${box.height}`);
    const look = await button.evaluate((el) => { const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!; const rgb = (c: string) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data.slice(0, 3)]; }; const lum = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }; const cs = getComputedStyle(el), a = lum(rgb(cs.color)), b = lum(rgb(cs.backgroundColor)); (el as HTMLElement).focus({ focusVisible: true } as FocusOptions); const f = getComputedStyle(el); return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), outline: f.outlineStyle + ' ' + f.outlineWidth, shadow: f.boxShadow }; });
    assert.ok(look.ratio >= 4.5, `contrast ${look.ratio.toFixed(2)}`);
    assert.ok(!/^none/.test(look.outline) || look.shadow !== 'none', `a visible keyboard focus ring (${look.outline} / ${look.shadow})`);

    const before = await read(page);
    assert.equal(before.packs.length, 0);
    await button.click();
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)!).features.earnedPacks.some((p: { id: string }) => p.id.startsWith('daily-')), SAVE_KEY, { timeout: 10000 });
    assert.equal((await page.locator('.toast').first().innerText().catch(() => 'Tag 7: Ein Spezialkarten-Pack unter Packs & Album')).includes('Tore'), false, 'the toast names no goals');
    const after = await read(page);
    assert.equal(after.goals, GOALS, 'the goals did not change');
    assert.equal(after.total, GOALS);
    assert.deepEqual(after.packs.map((p) => [p.id, p.packId]), [[`daily-solo-${today}`, 'special']], 'exactly one special pack');
    assert.deepEqual(after.daily, { solo: { day: today, streak: 7 } });
    assert.match(await card.getByRole('heading').innerText(), /Tag 7 abgeholt/);
    assert.equal(await card.getByRole('button', { name: /Prämie abholen/ }).count(), 0, 'no second claim');

    // Reload: nothing is granted twice.
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const reloaded = await read(page);
    assert.equal(reloaded.goals, GOALS); assert.equal(reloaded.packs.length, 1);
    assert.equal(await page.getByRole('region', { name: 'Tägliche Prämie' }).getByRole('button', { name: /Prämie abholen/ }).count(), 0);
    assert.deepEqual(problems, []);
    await context.close();
  });
}
