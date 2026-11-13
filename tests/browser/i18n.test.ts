// Language choice in the real game (production build, next start): switch to English in the settings of this device,
// the navigation follows at once, <html lang> changes, the choice survives a reload, the save is never touched, and
// phone, tablet and desktop widths show no horizontal scrolling. Run with: npm run test:browser (after npm test).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { TUTORIAL_STORAGE_KEY, WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';
import { LOCALE_STORAGE_KEY } from '../../app/i18n/locales.ts';

const PORT = Number(process.env.I18N_PORT ?? 8797);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
const VIEWPORTS = [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 834, height: 1194 }, { name: 'desktop', width: 1280, height: 900 }];

let server: ChildProcess | undefined;
let browser: Browser;

before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Run npm run build first (npm test builds .next).');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { stdio: 'ignore', detached: true, env: { ...process.env, PORT: String(PORT) } });
  const until = Date.now() + 120000;
  while (Date.now() < until) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 500)); }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); } }
});

/** A fresh game with the tutorial and the release notes already seen, in a browser that prefers German. */
async function openGame(viewport: { width: number; height: number }) {
  const page = await browser.newPage({ viewport, locale: 'de-CH' });
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), SAVE_KEY, { timeout: 30000 });
  await page.evaluate(([tutorial, whatsNew, seen]) => { localStorage.setItem(tutorial, JSON.stringify({ status: 'done' })); localStorage.setItem(whatsNew, seen); }, [TUTORIAL_STORAGE_KEY, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0]?.id ?? ''] as string[]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { page, problems };
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const lang = (page: Page) => page.evaluate(() => document.documentElement.lang);
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: English from the device settings, kept after a reload, German again on the way back`, async () => {
    const { page, problems } = await openGame(viewport);
    assert.equal(await lang(page), 'de', 'German without a choice in a German browser');
    await page.getByRole('button', { name: 'Club & Mehr', exact: true }).first().click();
    await page.waitForTimeout(600);
    const picker = page.getByRole('radiogroup', { name: 'Sprache' });
    await picker.scrollIntoViewIfNeeded();
    const saveBefore = JSON.parse((await stored(page, SAVE_KEY))!) as Record<string, unknown>;
    await picker.getByRole('radio', { name: 'English' }).click();
    await page.waitForTimeout(400);
    assert.equal(await lang(page), 'en');
    assert.equal(await stored(page, LOCALE_STORAGE_KEY), 'en', 'remembered on this device');
    assert.equal(await page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English' }).getAttribute('aria-checked'), 'true');
    for (const name of ['Squad', 'Club & More']) assert.ok(await page.getByRole('button', { name, exact: true }).first().count(), `${name} in the navigation`);
    assert.equal(await page.getByRole('button', { name: 'Kader', exact: true }).count(), 0, 'no German tab left');
    assert.ok(await page.getByText('SETTINGS / THIS DEVICE').count(), 'the device settings are English');
    assert.ok(await overflow(page) <= 0, `${viewport.name}: no horizontal scrolling in English`);
    // The choice never goes into the save: same game, no language field.
    const saveAfter = JSON.parse((await stored(page, SAVE_KEY))!) as Record<string, unknown>;
    assert.deepEqual(Object.keys(saveAfter).sort(), Object.keys(saveBefore).sort());
    assert.doesNotMatch(JSON.stringify(saveAfter), /goalClickerLocale|"locale"/);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    assert.equal(await lang(page), 'en', 'still English after a reload');
    assert.ok(await page.getByRole('button', { name: 'Squad', exact: true }).first().count());
    await page.getByRole('button', { name: 'Club & More', exact: true }).first().click();
    await page.waitForTimeout(600);
    await page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'Deutsch' }).click();
    await page.waitForTimeout(400);
    assert.equal(await lang(page), 'de');
    assert.equal(await stored(page, LOCALE_STORAGE_KEY), 'de');
    assert.ok(await page.getByRole('button', { name: 'Kader', exact: true }).first().count());
    assert.deepEqual(problems, []);
    await page.close();
  });
}

test('an English browser without a choice starts in English; French falls back to German', async () => {
  for (const [locale, expected, tab] of [['en-US', 'en', 'Squad'], ['fr-CH', 'de', 'Kader']] as const) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), SAVE_KEY, { timeout: 30000 });
    await page.evaluate(([tutorial, whatsNew, seen]) => { localStorage.setItem(tutorial, JSON.stringify({ status: 'done' })); localStorage.setItem(whatsNew, seen); }, [TUTORIAL_STORAGE_KEY, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0]?.id ?? ''] as string[]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    assert.equal(await lang(page), expected, locale);
    assert.ok(await page.getByRole('button', { name: tab, exact: true }).first().count(), `${locale}: ${tab}`);
    assert.equal(await stored(page, LOCALE_STORAGE_KEY), null, 'nothing is stored without a choice');
    await page.close();
  }
});
