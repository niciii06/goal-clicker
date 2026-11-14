// Browser acceptance of «Startbildschirm mit springendem Fussball» against the login build (stand-in for Neon Auth,
// scratch PostgreSQL): the ball shows at once on a slow start, nothing of the game appears before the check, the game
// or the login follows right after the answers without a minimum wait, a network error offers a retry, and reduced
// motion, light and dark, phone, tablet and desktop all look right. Race conditions of the save are covered by
// tests/account-profile.test.ts, tests/cloud-sync.test.ts and tests/save-recovery.test.ts.
// Needs TEST_DATABASE_URL (scratch database) and Chromium; reuses .next-account (builds it when missing).
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { startMockNeonAuth } from './mock-neon-auth.ts';

const databaseUrl = process.env.TEST_DATABASE_URL ?? '';
const skip = databaseUrl ? false : 'TEST_DATABASE_URL is not set';
const AUTH_PORT = 54398;
const PORT = Number(process.env.BOOT_TEST_PORT ?? 8826);
const BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, NEXT_DIST_DIR: '.next-account', NEON_AUTH_BASE_URL: `http://127.0.0.1:${AUTH_PORT}/neondb/auth`, NEON_AUTH_COOKIE_SECRET: 'browser-test-cookie-secret-0123456789abcdef', LEGACY_PASSWORD_DATABASE_URL: databaseUrl, AUTH_SESSION_CACHE_SECONDS: '0', DATABASE_URL: databaseUrl };
let admin: postgres.Sql;
let auth: ReturnType<typeof startMockNeonAuth>;
let server: ChildProcess | undefined;
let browser: Browser;
let context: BrowserContext;
const problems: string[] = [];

before(async () => {
  if (!databaseUrl) return;
  admin = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(admin), { migrationsFolder: 'drizzle' });
  await admin`truncate coop_rooms, solo_travel, player_accounts, profiles, cloud_saves, auth_identities, legacy_identities, account_recovery, recovery_codes, rate_limits`;
  auth = startMockNeonAuth(AUTH_PORT);
  if (!existsSync('.next-account/BUILD_ID')) assert.equal(spawnSync('node_modules/.bin/next', ['build'], { env, stdio: 'inherit' }).status, 0, 'next build with the test login settings failed');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { env, stdio: 'ignore', detached: true });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 500)); }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-CH' });
});

after(async () => {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid); } catch { /* gone */ } }
  await auth?.close();
  await admin?.end();
});

async function fresh(options: { reduced?: boolean; scheme?: 'light' | 'dark'; viewport?: { width: number; height: number } } = {}) {
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  page.on('pageerror', (error) => problems.push(error.message));
  await page.emulateMedia({ reducedMotion: options.reduced ? 'reduce' : 'no-preference', colorScheme: options.scheme ?? 'light' });
  if (options.viewport) await page.setViewportSize(options.viewport);
  return page;
}
/** The account and profile answers wait until `release()` is called; returns the moment the answers were let through. */
async function holdAnswers(page: Page) {
  let open!: () => void;
  const gate = new Promise<void>((resolve) => { open = resolve; });
  await page.route(/\/api\/(account|profile)(\?|$)/, async (route) => { await gate; await route.continue(); });
  return () => { const at = Date.now(); open(); return at; };
}
const ballTop = (page: Page) => page.locator('.account-boot-ball').evaluate((el) => el.getBoundingClientRect().top);

test('without a session: the bouncing ball shows at once and moves, the login follows right after the answer without a minimum wait', { skip }, async () => {
  const page = await fresh();
  const release = await holdAnswers(page);
  await page.goto(BASE, { waitUntil: 'commit' });
  await page.locator('.account-boot-ball').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.getByText('FOOTBALL IDLE CLUB').count(), 0, 'not the plain status card');
  assert.equal(await page.getByLabel('Benutzername').count(), 0, 'no login form before the check');
  const tops = new Set<number>();
  for (let i = 0; i < 12; i++) { tops.add(Math.round(await ballTop(page))); await page.waitForTimeout(110); }
  assert.ok(tops.size >= 4, `the ball bounces (${[...tops].join(',')})`);
  assert.equal(await page.locator('.account-boot-ball').evaluate((el) => getComputedStyle(el).animationName), 'account-boot-bounce');
  const at = release();
  await page.getByLabel('Benutzername').waitFor({ state: 'visible', timeout: 5000 });
  assert.ok(Date.now() - at < 1500, `login right after the answer (${Date.now() - at} ms)`);
  await page.close();
});

test('a valid session: no game before the check, then straight into the game without a minimum wait', { skip }, async () => {
  const setup = await fresh();
  await setup.goto(BASE, { waitUntil: 'networkidle' });
  await setup.getByRole('tab', { name: 'Konto erstellen' }).click();
  await setup.getByLabel('Benutzername').fill('bootplayer');
  await setup.getByText('Dieser Benutzername ist frei.').waitFor();
  await setup.getByLabel('Anzeigename').fill('Boot Player');
  await setup.getByLabel(/^Passwort \(mindestens/).fill('boot-pass-12345');
  await setup.getByLabel('Passwort wiederholen', { exact: true }).fill('boot-pass-12345');
  await setup.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await setup.getByRole('button', { name: 'Fussball anklicken' }).waitFor({ timeout: 30000 });
  await setup.close();
  const page = await fresh();
  const release = await holdAnswers(page);
  await page.goto(BASE, { waitUntil: 'commit' });
  await page.locator('.account-boot-ball').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2500);
  assert.equal(await page.getByRole('button', { name: 'Fussball anklicken' }).count(), 0, 'the game stays away while the session and the save are checked');
  assert.equal(await page.locator('.account-boot-ball').count(), 1, 'the ball still shows');
  const at = release();
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor({ state: 'visible', timeout: 15000 });
  assert.ok(Date.now() - at < 4000, `game right after the checks (${Date.now() - at} ms)`);
  await page.close();
});

test('network error: an understandable message with retry, and the retry reaches the game', { skip }, async () => {
  const page = await fresh();
  await page.route(/\/api\/account(\?|$)/, (route) => route.abort('connectionfailed'));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /Keine Verbindung/ }).waitFor({ timeout: 15000 });
  const retry = page.getByRole('button', { name: /Erneut versuchen|Nochmals|Wiederholen/ });
  assert.ok(await retry.count() >= 1, 'a retry button');
  await page.unroute(/\/api\/account(\?|$)/);
  await retry.first().click();
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor({ state: 'visible', timeout: 20000 });
  await page.close();
});

test('reduced motion: a calm still image, nothing moves', { skip }, async () => {
  const page = await fresh({ reduced: true });
  await holdAnswers(page);
  await page.goto(BASE, { waitUntil: 'commit' });
  await page.locator('.account-boot-ball').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal(await page.locator('.account-boot-ball').evaluate((el) => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('.account-boot-shadow').evaluate((el) => getComputedStyle(el).animationName), 'none');
  const a = await ballTop(page); await page.waitForTimeout(700);
  assert.equal(await ballTop(page), a);
  await page.close();
});

const contrast = (fg: number[], bg: number[]) => { const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; }; const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 820, height: 1180 }, { name: 'desktop', width: 1440, height: 900 }]) for (const scheme of ['light', 'dark'] as const) {
  test(`${viewport.name} ${scheme}: the ball sits in the view, no sideways scroll, readable status text, safe area padding`, { skip }, async () => {
    const page = await fresh({ scheme, viewport });
    await holdAnswers(page);
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.locator('.account-boot-ball').waitFor({ state: 'visible', timeout: 5000 });
    const result = await page.evaluate(() => {
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const main = document.querySelector('.account-boot') as HTMLElement, status = document.querySelector('.account-boot-status') as HTMLElement;
      let node: HTMLElement | null = main, bg = 'rgba(0, 0, 0, 0)';
      while (node && /rgba\(.*, 0\)|transparent/.test(bg)) { bg = getComputedStyle(node).backgroundColor; node = node.parentElement; }
      const ball = document.querySelector('.account-boot-ball')!.getBoundingClientRect(), title = document.querySelector('.account-boot-title')!.getBoundingClientRect();
      return { fg: rgb(getComputedStyle(status).color), bg: rgb(bg), overflow: document.documentElement.scrollWidth - innerWidth, ball: { top: ball.top, bottom: ball.bottom, left: ball.left, right: ball.right }, titleBottom: title.bottom, w: innerWidth, h: innerHeight, pad: getComputedStyle(main).paddingTop };
    });
    assert.ok(contrast(result.fg, result.bg) >= 4.5, `status text contrast ${contrast(result.fg, result.bg).toFixed(2)} (fg ${result.fg}, bg ${result.bg})`);
    assert.ok(result.overflow <= 0, 'no sideways scroll');
    assert.ok(result.ball.left >= 0 && result.ball.right <= result.w && result.ball.top >= 0 && result.titleBottom <= result.h, 'ball and title inside the view');
    assert.ok(parseFloat(result.pad) >= 24, 'at least 24 px, or the notch inset, around the content');
    await page.close();
  });
}

test('no page errors during the start tests', { skip }, () => { assert.deepEqual(problems, []); });
