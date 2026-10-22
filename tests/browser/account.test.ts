// The required login end to end: e-mail code and password sign up against a stand-in for Supabase Auth,
// the profile with a unique username, and the cloud save across two devices including a conflict.
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
import { MOCK_CODE, startMockAuth } from './mock-auth-server.ts';

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

async function loginWithCode(page: Page, email: string) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByLabel('E-Mail').fill(email);
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page.getByLabel('Code aus der Mail').fill(MOCK_CODE);
  await page.getByRole('button', { name: 'Bestätigen' }).click();
}

async function createProfile(page: Page, username: string, displayName: string) {
  await page.getByLabel('Benutzername').fill(username);
  await page.getByText('Dieser Benutzername ist frei.').waitFor();
  await page.getByLabel('Anzeigename').fill(displayName);
  await page.getByRole('button', { name: 'Profil erstellen' }).click();
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

async function cloudSave(email: string) {
  const [row] = await admin`select s.version, s.save_json from cloud_saves s join profiles p on p.user_id = s.user_id where p.user_id = ${auth.users.get(email)!.id}::uuid`;
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
  assert.equal(await page.getByRole('tab', { name: 'Code per Mail' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Fussball anklicken' }).count(), 0);
});

test('a code login creates the profile once and the save goes to the cloud', { skip }, async () => {
  const page = devices.a.page;
  await loginWithCode(page, 'nico@example.com');
  await createProfile(page, 'Striker', 'Nico');
  await clickBall(page, 6);
  assert.match(await page.locator('.account-chip').innerText(), /Nico/);
  await hideTab(page);
  const saved = await waitFor(() => cloudSave('nico@example.com'), (s) => Boolean(s && s.totalGoals >= 6), 'first cloud save');
  assert.equal(saved!.version, 1);
});

test('a second device of the account starts with the same save and no profile step', { skip }, async () => {
  const page = await device('b');
  await loginWithCode(page, 'NICO@example.com');
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  const cloud = await cloudSave('nico@example.com');
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
  assert.equal(await localGoals(asked!), (await cloudSave('nico@example.com'))!.totalGoals);
  devices.asked = devices[asked === a ? 'a' : 'b'];
  devices.other = devices[asked === a ? 'b' : 'a'];
});

test('a device that was not played takes a newer save without asking when it comes back', { skip }, async () => {
  const idle = devices.asked.page, played = devices.other.page;
  await idle.waitForTimeout(1500);
  await clickBall(played, 4);
  await hideTab(played);
  const target = await localGoals(played);
  await waitFor(async () => (await cloudSave('nico@example.com'))!.totalGoals, (goals) => goals === target, 'upload of the played device');
  // The idle tab comes back to the front.
  await idle.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await waitFor(() => localGoals(idle).catch(() => -1), (goals) => goals === target, 'idle device took the newer save');
  await idle.waitForLoadState('networkidle');
  assert.equal(await idle.getByText('Auf einem anderen Gerät wurde weitergespielt').count(), 0);
  assert.equal(await played.getByText('Auf einem anderen Gerät wurde weitergespielt').count(), 0);
});

test('a password account confirms its address with a code and cannot take a used username', { skip }, async () => {
  const page = await device('c');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Passwort' }).click();
  await page.getByRole('button', { name: 'Neues Konto mit Passwort' }).click();
  await page.getByLabel('E-Mail').fill('keeper@example.com');
  await page.getByLabel(/^Passwort \(mindestens/).fill('sicheres-passwort-1');
  await page.getByLabel('Passwort wiederholen').fill('sicheres-passwort-1');
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await page.getByLabel('Code aus der Mail').fill(MOCK_CODE);
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await page.getByLabel('Benutzername').fill('STRIKER');
  await page.getByText('Dieser Benutzername ist schon vergeben.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Profil erstellen' }).isDisabled(), true);
  await createProfile(page, 'Keeper', 'Goalie');
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  assert.deepEqual(auth.mails.filter((mail) => mail.email === 'keeper@example.com').map((mail) => mail.type), ['signup']);
});

test('the profile settings change the display name and delete the profile', { skip }, async () => {
  const page = devices.c.page;
  await page.getByRole('button', { name: 'Club & Mehr', exact: true }).first().click();
  const panel = page.locator('.profile-panel');
  await panel.getByLabel('Anzeigename').fill('Goalie 1');
  await panel.getByRole('button', { name: 'Speichern' }).click();
  await page.getByText('Anzeigename gespeichert.').waitFor();
  const userId = auth.users.get('keeper@example.com')!.id;
  assert.equal((await admin`select display_name from profiles where user_id = ${userId}::uuid`)[0].display_name, 'Goalie 1');
  await panel.getByText('Profil löschen').click();
  await panel.getByLabel(/eintippen/).fill('keeper');
  await panel.getByRole('button', { name: 'Endgültig löschen' }).click();
  await page.getByRole('button', { name: 'Mit Google anmelden' }).waitFor();
  assert.equal((await admin`select count(*)::int as n from profiles where user_id = ${userId}::uuid`)[0].n, 0);
});

test('signing out saves, forgets the save on this device and shows the login again', { skip }, async () => {
  const page = devices.asked.page;
  await page.locator('.account-chip').getByRole('button', { name: 'Abmelden' }).click();
  await page.getByRole('button', { name: 'Mit Google anmelden' }).waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY), null);
  assert.deepEqual(problems, []);
});
