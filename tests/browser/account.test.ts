// The required login end to end: registering and signing in with username and password against a stand-in
// for Supabase Auth, the unique username, and the cloud save across two devices including a conflict.
// Needs TEST_DATABASE_URL (an empty scratch database) and Chromium; builds its own copy into .next-account.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { startMockAuth } from './mock-auth-server.ts';

const databaseUrl = process.env.TEST_DATABASE_URL ?? '';
const skip = databaseUrl ? false : 'TEST_DATABASE_URL is not set';
const AUTH_PORT = 54399;
const PORT = Number(process.env.ACCOUNT_TEST_PORT ?? 8798);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
const env = { ...process.env, NEXT_DIST_DIR: '.next-account', NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${AUTH_PORT}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', DATABASE_URL: databaseUrl };

let admin: postgres.Sql;
let auth: ReturnType<typeof startMockAuth>;
let server: ChildProcess | undefined;
let browser: Browser;
const problems: string[] = [];
const devices: Record<string, { context: BrowserContext; page: Page }> = {};

before(async () => {
  if (!databaseUrl) return;
  admin = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(admin), { migrationsFolder: 'drizzle' });
  await admin`truncate coop_rooms, solo_travel, player_accounts, profiles, cloud_saves`;
  auth = startMockAuth(AUTH_PORT);
  // ACCOUNT_TEST_REUSE_BUILD=1 skips the build while iterating on the test itself.
  if (process.env.ACCOUNT_TEST_REUSE_BUILD !== '1') {
    const build = spawnSync('node_modules/.bin/next', ['build'], { env, stdio: 'inherit' });
    assert.equal(build.status, 0, 'next build with the test login settings failed');
  }
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { env, stdio: 'ignore', detached: true });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

after(async () => {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid); } catch { /* already gone */ } }
  await auth?.close();
  await admin?.end();
});

async function device(name: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  page.on('pageerror', (error) => problems.push(`${name}: ${error.message}`));
  page.on('dialog', (dialog) => void dialog.accept());
  devices[name] = { context, page };
  return page;
}

async function register(page: Page, username: string, displayName: string, password: string) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Konto erstellen' }).click();
  await page.getByLabel('Benutzername').fill(username);
  await page.getByText('Dieser Benutzername ist frei.').waitFor();
  await page.getByLabel('Anzeigename').fill(displayName);
  await page.getByLabel(/^Passwort \(mindestens/).fill(password);
  await page.getByLabel('Passwort wiederholen').fill(password);
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
}

async function login(page: Page, username: string, password: string) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByLabel('Benutzername').fill(username);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

async function clickBall(page: Page, times: number) {
  const ball = page.getByRole('button', { name: 'Fussball anklicken' });
  await ball.waitFor();
  await ball.scrollIntoViewIfNeeded();
  const box = (await ball.boundingBox())!;
  for (let i = 0; i < times; i++) { await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(80); }
  await page.waitForTimeout(700);
}

/** The tab going to the background uploads right away instead of after the next interval. */
async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });
}

async function localGoals(page: Page) {
  return page.evaluate((key) => Number(JSON.parse(localStorage.getItem(key) ?? '{}').totalGoals ?? 0), SAVE_KEY);
}

async function cloudSave(username: string) {
  const [row] = await admin`select s.version, s.save_json from cloud_saves s join profiles p on p.user_id = s.user_id where p.username_key = ${username.toLowerCase()}`;
  return row ? { version: Number(row.version), totalGoals: Number(JSON.parse(JSON.parse(row.save_json)[SAVE_KEY]).totalGoals) } : null;
}

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, label: string) {
  let value = await read();
  for (let i = 0; i < 60 && !done(value); i++) { await new Promise((resolve) => setTimeout(resolve, 500)); value = await read(); }
  assert.ok(done(value), `${label}: ${JSON.stringify(value)}`);
  return value;
}

test('without a session the login is the first thing, not the game', { skip }, async () => {
  const page = await device('a');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Mit Google anmelden' }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Konto erstellen' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Fussball anklicken' }).count(), 0);
});

test('a new account with username and password starts the game and saves to the cloud', { skip }, async () => {
  const page = devices.a.page;
  await register(page, 'Striker', 'Nico', 'sicheres-passwort-1');
  await clickBall(page, 6);
  assert.equal(await page.getByRole('button', { name: 'Konto von Nico' }).count(), 1);
  await hideTab(page);
  const saved = await waitFor(() => cloudSave('Striker'), (s) => Boolean(s && s.totalGoals >= 6), 'first cloud save');
  assert.equal(saved!.version, 1);
  // The generated login address stays on the server; the account only knows its username.
  assert.equal(await page.locator('body').innerText().then((text) => text.includes('@players.')), false);
});

test('a wrong password is refused, the right one opens the same save on a second device', { skip }, async () => {
  const page = await device('b');
  await login(page, 'STRIKER', 'falsches-passwort');
  await page.getByText('Benutzername oder Passwort stimmt nicht.').waitFor();
  await page.getByLabel('Passwort').fill('sicheres-passwort-1');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  const cloud = await cloudSave('Striker');
  assert.equal(await localGoals(page), cloud!.totalGoals);
});

test('when both devices were played, the second one to save asks and can load the newer save', { skip }, async () => {
  const a = devices.a.page, b = devices.b.page;
  // Let both settle first: their passive saves resolve without a question, at most with a reload.
  await hideTab(a);
  await hideTab(b);
  await a.waitForTimeout(2500);
  await Promise.all([a.waitForLoadState('networkidle'), b.waitForLoadState('networkidle')]);
  await clickBall(a, 2);
  await clickBall(b, 3);
  await hideTab(a);
  await a.waitForTimeout(1500);
  await hideTab(b);
  const asked = await waitFor(async () => {
    for (const page of [a, b]) if (await page.getByText('Auf einem anderen Gerät wurde weitergespielt').count()) return page;
    return null;
  }, Boolean, 'one device asks');
  await asked!.getByRole('button', { name: /Stand aus dem Profil laden/ }).click();
  await asked!.waitForLoadState('networkidle');
  await asked!.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  assert.equal(await localGoals(asked!), (await cloudSave('Striker'))!.totalGoals);
  devices.asked = devices[asked === a ? 'a' : 'b'];
  devices.other = devices[asked === a ? 'b' : 'a'];
});

test('a device that was not played takes a newer save without asking when it comes back', { skip }, async () => {
  const idle = devices.asked.page, played = devices.other.page;
  await idle.waitForTimeout(1500);
  await clickBall(played, 4);
  await hideTab(played);
  const target = await localGoals(played);
  await waitFor(async () => (await cloudSave('Striker'))!.totalGoals, (goals) => goals === target, 'upload of the played device');
  // The idle tab comes back to the front.
  await idle.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await waitFor(() => localGoals(idle).catch(() => -1), (goals) => goals === target, 'idle device took the newer save');
  await idle.waitForLoadState('networkidle');
  assert.equal(await idle.getByText('Auf einem anderen Gerät wurde weitergespielt').count(), 0);
  assert.equal(await played.getByText('Auf einem anderen Gerät wurde weitergespielt').count(), 0);
});

test('a used username cannot be registered twice, in any case', { skip }, async () => {
  const page = await device('c');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Konto erstellen' }).click();
  await page.getByLabel('Benutzername').fill('STRIKER');
  await page.getByText('Dieser Benutzername ist schon vergeben.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Konto erstellen', exact: true }).isDisabled(), true);
  await register(page, 'Keeper', 'Goalie', 'anderes-passwort-2');
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
});

test('the profile settings change display name and password and delete the profile', { skip }, async () => {
  const page = devices.c.page;
  // The account button next to the notifications opens the profile settings.
  await page.getByRole('button', { name: /^Konto von / }).click();
  const panel = page.getByRole('dialog', { name: 'Konto' });
  // The keyboard stays inside the dialog: focus starts in it and Tab never reaches the page behind.
  for (let i = 0; i < 14; i++) {
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('.account-dialog'))), true, `focus left the dialog after ${i} tabs`);
    await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
  }
  await panel.getByLabel('Anzeigename').fill('Goalie 1');
  await panel.getByRole('button', { name: 'Speichern' }).click();
  // Feedback shows inside the dialog, above its dimmed background.
  await panel.getByRole('status').filter({ hasText: 'Anzeigename gespeichert.' }).waitFor();
  await panel.getByLabel('Neues Passwort').fill('neues-passwort-3');
  await panel.getByLabel('Wiederholen').fill('neues-passwort-3');
  await panel.getByRole('button', { name: 'Passwort ändern' }).click();
  await panel.getByRole('status').filter({ hasText: 'Neues Passwort gespeichert.' }).waitFor();
  const [{ user_id: userId }] = await admin`select user_id from profiles where username_key = 'keeper'`;
  assert.equal((await admin`select display_name from profiles where user_id = ${userId}::uuid`)[0].display_name, 'Goalie 1');
  await panel.getByText('Profil löschen').click();
  await panel.getByLabel(/eintippen/).fill('keeper');
  await panel.getByRole('button', { name: 'Endgültig löschen' }).click();
  await page.getByRole('button', { name: 'Mit Google anmelden' }).waitFor();
  assert.equal((await admin`select count(*)::int as n from profiles where user_id = ${userId}::uuid`)[0].n, 0);
});

test('signing out right after clicking still saves those clicks, then forgets the save on this device', { skip }, async () => {
  const page = devices.asked.page;
  await page.evaluate(() => window.dispatchEvent(new Event('goalclicker:flush-save')));
  const before = await localGoals(page);
  // Every click earns at least one goal; the game itself would only save them a few seconds later.
  await clickBall(page, 3);
  await page.getByRole('button', { name: /^Konto von / }).click();
  await page.getByRole('dialog', { name: 'Konto' }).getByRole('button', { name: 'Abmelden' }).click();
  await page.getByRole('button', { name: 'Mit Google anmelden' }).waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY), null);
  assert.ok((await cloudSave('Striker'))!.totalGoals >= before + 3, `cloud has ${(await cloudSave('Striker'))!.totalGoals}, before the clicks ${before}`);
  assert.deepEqual(problems, []);
});
