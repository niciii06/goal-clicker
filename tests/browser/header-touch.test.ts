// Browser acceptance of «Mobiler Header auf iPhone/iPad zu blass» (re-reported on 14 November: blur on the iPad header): on touch
// screens (iPhone, iPad portrait and landscape; emulated with touch, since no WebKit runs here) the top bar is a solid bar without
// blur, in light and dark, at the top and after scrolling; text and icons reach 4.5:1; the buttons are at least 44 pt;
// desktop keeps its glass. Real iPad Safari still needs a look on the device.
// Run: HEADER_PORT=8828 node --import tsx --test --test-concurrency=1 tests/browser/header-touch.test.ts (after npm run build).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { normalizeGameFeatures } from '../../app/feature-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.HEADER_PORT ?? 8828);
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

const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a: number[], b: number[]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };

async function open(viewport: { width: number; height: number }, touch: boolean, scheme: 'light' | 'dark') {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: scheme, locale: 'de-CH' });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  const save = JSON.stringify({ ...baseSave, goals: 77e6, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(baseSave.features as never), lastSaved: Date.now() });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, save, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.topbar').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  return { page, context, problems };
}
const measure = (page: import('playwright-core').Page) => page.evaluate(() => {
  const rgba = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
  const bar = document.querySelector('.topbar') as HTMLElement, style = getComputedStyle(bar);
  const barBg = rgba(style.backgroundColor);
  const text = (selector: string) => { const el = document.querySelector(selector) as HTMLElement | null; return el ? rgba(getComputedStyle(el).color).slice(0, 3) : null; };
  const buttons = [...document.querySelectorAll('.topbar .top-actions button')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, op: Number(getComputedStyle(b).opacity) }; });
  const rect = bar.getBoundingClientRect();
  return { backdrop: style.backdropFilter || (style as unknown as Record<string, string>).webkitBackdropFilter || 'none', barBg, title: text('.brand-copy h1'), balance: text('.header-goals strong'), label: text('.header-goals span'), buttons, top: rect.top, position: style.position, height: rect.height, titleOpacity: Number(getComputedStyle(document.querySelector('.brand-copy h1')!).opacity) };
});

const devices = [{ name: 'iPhone', width: 390, height: 844 }, { name: 'iPad portrait', width: 820, height: 1180 }, { name: 'iPad landscape', width: 1180, height: 820 }];
for (const device of devices) for (const scheme of ['light', 'dark'] as const) {
  test(`${device.name} ${scheme}: solid header without blur, sharp and readable at the top and after scrolling`, async () => {
    const { page, context, problems } = await open(device, true, scheme);
    for (const phase of ['top', 'scrolled']) {
      if (phase === 'scrolled') { await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(400); }
      const m = await measure(page);
      assert.equal(m.backdrop, 'none', `${phase}: no backdrop blur on the touch header (${m.backdrop})`);
      assert.equal(m.barBg[3] ?? 1, 1, `${phase}: the header background is fully opaque (${m.barBg})`);
      assert.ok(m.titleOpacity === 1 && m.buttons.every((b) => b.op === 1), `${phase}: nothing is faded`);
      const bg = m.barBg.slice(0, 3);
      assert.ok(contrast(m.title!, bg) >= 4.5, `${phase}: title contrast ${contrast(m.title!, bg).toFixed(2)}`);
      assert.ok(contrast(m.balance!, bg) >= 4.5, `${phase}: balance contrast ${contrast(m.balance!, bg).toFixed(2)}`);
      if (phase === 'scrolled' && device.width <= 780) assert.ok(Math.abs(m.top) <= 1, `the pinned phone header stays at the top edge while scrolling (${m.top})`);
      if (phase === 'scrolled' && device.width > 780) assert.ok(m.position !== 'sticky' && m.top < 0, `on wide screens the header scrolls away, so the pinned tab bar never covers it (${m.position}, top ${m.top})`);
      assert.ok(m.buttons.length >= 3, 'profile, bell and sound are there');
      for (const b of m.buttons) assert.ok(b.w >= 44 && b.h >= 44, `${phase}: touch target ${b.w}x${b.h} is at least 44 pt`);
    }
    assert.deepEqual(problems, []);
    await context.close();
  });
}

for (const width of [780, 781, 900, 1024, 1280, 1440]) for (const scheme of ['light', 'dark'] as const) {
  test(`mouse or trackpad, ${width} px ${scheme}: header and goal balance stay visible while scrolling, the pinned tab bar never covers them`, async () => {
    const { page, context, problems } = await open({ width, height: 900 }, false, scheme);
    for (const scroll of [0, 400, 1500]) {
      await page.evaluate((y) => window.scrollTo(0, y), scroll);
      await page.waitForTimeout(350);
      const r = await page.evaluate(() => {
        const bar = document.querySelector('.topbar') as HTMLElement, nav = document.querySelector('.section-navigation') as HTMLElement;
        const box = (el: Element) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
        const balance = document.querySelector('.header-goals') as HTMLElement, logo = document.querySelector('.brand-copy h1') as HTMLElement;
        const top = (el: Element) => { const b = el.getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return Boolean(hit && bar.contains(hit)); };
        const actions = [...bar.querySelectorAll('.top-actions button')].map(top);
        return { position: getComputedStyle(bar).position, bar: box(bar), nav: box(nav), navFixed: getComputedStyle(nav).position, balanceOnTop: top(balance), logoOnTop: top(logo), actions, balance: box(balance), h: innerHeight, cssVar: getComputedStyle(document.documentElement).getPropertyValue('--topbar-h') };
      });
      const label = `${width}px scroll ${scroll}`;
      assert.equal(r.position, 'sticky', `${label}: the header is pinned`);
      if (scroll > 0) assert.ok(Math.abs(r.bar.top) <= 1, `${label}: the header sits at the top edge (${r.bar.top})`);
      assert.ok(r.balance.top >= 0 && r.balance.bottom <= r.h, `${label}: the goal balance is on screen`);
      assert.ok(r.balanceOnTop && r.logoOnTop && r.actions.every(Boolean), `${label}: nothing paints over logo, balance or icons (${JSON.stringify([r.balanceOnTop, r.logoOnTop, r.actions])})`);
      if (r.navFixed === 'sticky') assert.ok(r.nav.top >= r.bar.bottom - 1, `${label}: the pinned tab bar starts below the header (${r.nav.top} vs ${r.bar.bottom})`);
      else assert.equal(width, 780, `${label}: only the phone layout has the tab bar elsewhere`);
      assert.ok(Math.abs(Number.parseFloat(r.cssVar) - (r.bar.bottom - r.bar.top)) <= 1.5, `${label}: the measured header height matches (${r.cssVar})`);
    }
    assert.deepEqual(problems, []);
    await context.close();
  });
}

test('desktop (mouse): the header keeps its light glass', async () => {
  const { page, context } = await open({ width: 1440, height: 900 }, false, 'light');
  const m = await measure(page);
  assert.notEqual(m.backdrop, 'none', 'glass blur stays on desktop');
  assert.ok((m.barBg[3] ?? 1) < 1, 'translucent on desktop');
  await context.close();
});
