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

// Every main tab in both languages: one text the tab always shows (German exactly as before), the navigation label,
// no horizontal scrolling and no page errors. Game data (upgrade names, leagues, packs) is still German in English
// (docs/i18n-plan.md, Etappe 5), so the check looks at interface texts only.
const TAB_TEXTS = [
  { de: 'Home', en: 'Home', deText: 'Ein Klick. Ein Tor. Eine völlig übertriebene Karriere.', enText: 'One click. One goal. A completely over the top career.' },
  { de: 'Spiele', en: 'Matches', deText: 'Wähle deine nächste Partie.', enText: 'Choose your next match.' },
  { de: 'Saison', en: 'Season', deText: 'Bei gleich vielen Punkten zählen Tordifferenz, erzielte Tore und danach die direkten Begegnungen.', enText: 'On equal points, goal difference counts first, then goals scored, then head to head results.' },
  { de: 'Kader', en: 'Squad', deText: 'STARTELF · 11 PLÄTZE', enText: 'STARTING XI · 11 PLACES' },
  { de: 'Karriere', en: 'Career', deText: 'Deine Spieler entwickeln Geschichte.', enText: 'Your players make history.' },
  { de: 'Packs & Album', en: 'Packs & Album', deText: 'Neu für deinen Club', enText: 'New for your club' },
  { de: 'Club & Mehr', en: 'Club & More', deText: 'Deine gewonnenen Pokale.', enText: 'Your cups won.' },
];

for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
  for (const locale of ['de', 'en'] as const) {
    test(`${viewport.name} ${locale}: every main tab shows its interface texts in this language, without overflow or errors`, async () => {
      const { page, problems } = await openGame(viewport);
      if (locale === 'en') {
        await page.evaluate(([key]) => localStorage.setItem(key, 'en'), [LOCALE_STORAGE_KEY]);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
      }
      assert.equal(await lang(page), locale);
      for (const tab of TAB_TEXTS) {
        const name = locale === 'en' ? tab.en : tab.de;
        await page.getByRole('button', { name, exact: true }).first().click();
        await page.waitForTimeout(700);
        const wanted = locale === 'en' ? tab.enText : tab.deText;
        const other = locale === 'en' ? tab.deText : tab.enText;
        assert.ok(await page.getByText(wanted, { exact: true }).first().isVisible(), `${viewport.name} ${locale} ${name}: "${wanted}" is shown`);
        assert.equal(await page.getByText(other, { exact: true }).count(), 0, `${viewport.name} ${locale} ${name}: no "${other}" from the other language`);
        assert.ok(await overflow(page) <= 0, `${viewport.name} ${locale} ${name}: no horizontal scrolling`);
        if (tab.de === 'Kader') assert.ok(await page.getByRole('button', { name: locale === 'en' ? 'Best bench' : 'Beste Bank', exact: true }).first().isVisible(), `${viewport.name} ${locale}: best bench button in this language`);
      }
      assert.deepEqual(problems, []);
      await page.close();
    });
  }
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

// QA fixes of 15 November 2026: on a phone the Matches tab shows a short label that fits ("Games"), its accessible
// name stays "Matches"; the upgrade buy button and its accessible name follow the language; switching the language
// in the running game with an existing save changes neither the save nor the German texts on the way back.
test('phone: short Matches tab label fits, buy button and its name follow a language switch, the save stays the same', async () => {
  const { page, problems } = await openGame(VIEWPORTS[0]);
  const shortLabel = (name: string) => page.getByRole('button', { name, exact: true }).first().locator('.tab-label-short');
  const fits = (name: string) => shortLabel(name).evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && getComputedStyle(element).display !== 'none');
  const buyButton = page.locator('.upgrade-item button[aria-label]').first();
  assert.equal(await shortLabel('Spiele').innerText(), 'Spiele');
  assert.match((await buyButton.getAttribute('aria-label'))!, / kaufen$|Preis$/);
  const saveBefore = await stored(page, SAVE_KEY);
  await page.getByRole('button', { name: 'Club & Mehr', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('radiogroup', { name: 'Sprache' }).getByRole('radio', { name: 'English' }).click();
  await page.waitForTimeout(400);
  assert.equal(await shortLabel('Matches').innerText(), 'Games', 'short label on the phone');
  assert.ok(await fits('Matches'), 'the short label is not cut off');
  await page.getByRole('button', { name: 'Home', exact: true }).first().click();
  await page.waitForTimeout(600);
  const enLabel = (await buyButton.getAttribute('aria-label'))!;
  assert.match(enLabel, /^(Buy|Price|Buy x\d+|League \d+)(: .+)$/, enLabel);
  assert.doesNotMatch(enLabel + await buyButton.innerText(), /kaufen|Preis/);
  await page.getByRole('button', { name: 'Club & More', exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'Deutsch' }).click();
  await page.waitForTimeout(400);
  assert.equal(await shortLabel('Spiele').innerText(), 'Spiele');
  const saveAfter = JSON.parse((await stored(page, SAVE_KEY))!) as Record<string, unknown>;
  const before = JSON.parse(saveBefore!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(saveAfter).sort(), Object.keys(before).sort());
  assert.doesNotMatch(JSON.stringify(saveAfter), /goalClickerLocale|"locale"|Faster boots|"Buy/);
  assert.ok(await overflow(page) <= 0);
  assert.deepEqual(problems, []);
  await page.close();
});
