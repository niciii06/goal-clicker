// The required login end to end against a stand-in for Neon Auth (tests/browser/mock-neon-auth.ts): registering and
// signing in with username and password, Google, the unique username, the cloud save across two devices (the
// profile's save always wins), recovering the original accounts (old password, old Google login), revoked sessions,
// and two accounts playing one multiplayer world at the same time.
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
import { startMockNeonAuth } from './mock-neon-auth.ts';

const databaseUrl = process.env.TEST_DATABASE_URL ?? '';
const skip = databaseUrl ? false : 'TEST_DATABASE_URL is not set';
const AUTH_PORT = 54399;
const PORT = Number(process.env.ACCOUNT_TEST_PORT ?? 8798);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-account',
  NEON_AUTH_BASE_URL: `http://127.0.0.1:${AUTH_PORT}/neondb/auth`,
  NEON_AUTH_COOKIE_SECRET: 'browser-test-cookie-secret-0123456789abcdef',
  LEGACY_SUPABASE_URL: `http://127.0.0.1:${AUTH_PORT}`,
  LEGACY_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  AUTH_SESSION_CACHE_SECONDS: '0',
  DATABASE_URL: databaseUrl,
};

let admin: postgres.Sql;
let auth: ReturnType<typeof startMockNeonAuth>;
let server: ChildProcess | undefined;
let browser: Browser;
const problems: string[] = [];
const devices: Record<string, { context: BrowserContext; page: Page }> = {};

before(async () => {
  if (!databaseUrl) return;
  admin = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(admin), { migrationsFolder: 'drizzle' });
  await admin`truncate coop_rooms, solo_travel, player_accounts, profiles, cloud_saves, auth_identities, legacy_identities, account_recovery, recovery_codes, rate_limits`;
  auth = startMockNeonAuth(AUTH_PORT);
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
  await closeWelcomePack(page);
}

/** A brand new game opens the free welcome pack first; its walkout covers the game until it is taken over. */
async function closeWelcomePack(page: Page) {
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  const reveal = page.locator('.star-reveal');
  try { await reveal.waitFor({ timeout: 4000 }); } catch { return; }
  const takeOver = reveal.getByRole('button', { name: 'In Star XI übernehmen' });
  await takeOver.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.star-reveal .star-walkout-dismiss')?.disabled, undefined, { timeout: 20000 });
  await takeOver.click();
  await reveal.waitFor({ state: 'detached', timeout: 10000 });
  // A new club then gets the tutorial window; these tests skip it.
  const skip = page.getByRole('dialog').getByRole('button', { name: 'Überspringen' });
  try { await skip.waitFor({ timeout: 3000 }); await skip.click(); } catch { /* no tutorial for this save */ }
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

test('when both devices were played, the second one to save takes the newer save without asking', { skip }, async () => {
  const a = devices.a.page, b = devices.b.page;
  // Let both settle first: their passive saves resolve without a question, at most with a reload.
  await hideTab(a);
  await hideTab(b);
  await a.waitForTimeout(2500);
  await Promise.all([a.waitForLoadState('networkidle'), b.waitForLoadState('networkidle')]);
  await clickBall(a, 2);
  await clickBall(b, 3);
  const before = { a: await localGoals(a), b: await localGoals(b) };
  await hideTab(a);
  await a.waitForTimeout(1500);
  await hideTab(b);
  // Signing in is required, so the profile's save wins: the device that saved second loads it and asks nothing.
  await waitFor(async () => {
    const cloud = (await cloudSave('Striker'))!.totalGoals;
    return (await localGoals(a).catch(() => -1)) === cloud && (await localGoals(b).catch(() => -1)) === cloud;
  }, Boolean, 'both devices show the cloud save');
  for (const page of [a, b]) {
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
    assert.equal(await page.getByText('Welchen Spielstand willst du?').count(), 0);
  }
  const took = (await localGoals(a)) !== before.a ? 'a' : 'b';
  devices.asked = devices[took];
  devices.other = devices[took === 'a' ? 'b' : 'a'];
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
  assert.equal(await idle.getByText('Welchen Spielstand willst du?').count(), 0);
  assert.equal(await played.getByText('Welchen Spielstand willst du?').count(), 0);
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

test('the account menu switches between light and dark, and the choice survives a reload', { skip }, async () => {
  const page = devices.c.page;
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await background();
  await page.getByRole('button', { name: /^Konto von / }).click();
  await page.getByRole('dialog', { name: 'Konto' }).getByRole('radio', { name: 'Dunkel' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  const dark = await background();
  assert.notEqual(dark, light);
  // The browser bar follows the chosen theme, not only the device setting: it uses the first theme-color tag.
  const barColors = () => page.evaluate(() => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((meta) => meta.media ? `${meta.content} ${meta.media}` : meta.content));
  const deviceColors = ['#f3f6f4 (prefers-color-scheme: light)', '#07130e (prefers-color-scheme: dark)'];
  assert.deepEqual(await barColors(), ['#07130e', ...deviceColors]);
  // On a narrow phone the picker wraps instead of pushing the dialog sideways.
  await page.setViewportSize({ width: 340, height: 740 });
  assert.equal(await page.evaluate(() => { const dialog = document.querySelector('.account-dialog')!; return dialog.scrollWidth <= dialog.clientWidth; }), true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal(await background(), dark);
  assert.deepEqual(await barColors(), ['#07130e', ...deviceColors]);
  await page.getByRole('button', { name: /^Konto von / }).click();
  const automatic = page.getByRole('dialog', { name: 'Konto' }).getByRole('radio', { name: 'Automatisch' });
  await automatic.click();
  assert.equal(await automatic.getAttribute('aria-checked'), 'true');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
  assert.deepEqual(await barColors(), deviceColors);
  await page.keyboard.press('Escape');
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
  await panel.getByLabel('Aktuelles Passwort').fill('anderes-passwort-2');
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
  // Neon Auth cannot delete a login itself: the data is gone, the login is locked, and the game says exactly that.
  await page.getByText('Dein Login ist gesperrt und wird vom Besitzer des Spiels endgültig entfernt.').waitFor();
  assert.equal((await admin`select count(*)::int as n from profiles where user_id = ${userId}::uuid`)[0].n, 0);
  assert.equal((await admin`select count(*)::int as n from cloud_saves where user_id = ${userId}::uuid`)[0].n, 0);
  const [mark] = await admin`select subject, deleted_at from auth_identities where account_id = ${userId}::uuid`;
  assert.ok(mark.deleted_at, 'the login is marked for the owner');
  // The username is gone with the profile: signing in again opens nothing and creates nothing.
  await login(page, 'Keeper', 'neues-passwort-3');
  await page.getByText('Benutzername oder Passwort stimmt nicht.').waitFor();
  assert.equal((await admin`select count(*)::int as n from profiles where username_key = 'keeper'`)[0].n, 0);
  assert.ok([...auth.users.keys()].includes(mark.subject), 'the login waits for the owner');
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

test('a guest plays single player only, and signing up takes the guest save into the new account', { skip }, async () => {
  const page = await device('guest');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Als Gast fortfahren' }).click();
  await closeWelcomePack(page);
  await clickBall(page, 5);
  await page.evaluate(() => window.dispatchEvent(new Event('goalclicker:flush-save')));
  const guestGoals = await localGoals(page);
  assert.ok(guestGoals >= 5);
  // The choice is remembered: a reload goes straight back into the game.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Anmelden', exact: true }).count(), 1);
  // Co-op is locked for guests; the prompt leads to the login.
  await page.getByRole('button', { name: /Koop Multiplayer/ }).click();
  const prompt = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await prompt.getByText('Koop braucht ein Konto').waitFor();
  await prompt.getByRole('button', { name: 'Anmelden' }).click();
  await page.getByText('Dein Gast Spielstand kommt in dein Konto').waitFor();
  await page.getByRole('tab', { name: 'Konto erstellen' }).click();
  await page.getByLabel('Benutzername').fill('GuestFan');
  await page.getByText('Dieser Benutzername ist frei.').waitFor();
  await page.getByLabel('Anzeigename').fill('Gast');
  await page.getByLabel(/^Passwort \(mindestens/).fill('sicheres-passwort-9');
  await page.getByLabel('Passwort wiederholen').fill('sicheres-passwort-9');
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await page.getByRole('button', { name: 'Konto von Gast' }).waitFor();
  await hideTab(page);
  await waitFor(() => cloudSave('GuestFan'), (save) => Boolean(save && save.totalGoals >= guestGoals), 'guest save in the new account');
  assert.deepEqual(problems, []);
});

// ---- The original accounts from Supabase, Google, sessions and multiplayer -------------------------------------

/** Plants an original account the way the copied database holds it: profile, cloud save, player link, old login. */
async function plantOriginalAccount(values: { id: string; username: string; displayName: string; playerId: string; totalGoals: number; legacy: { provider: 'google' | 'email'; subject: string }; loginEmail?: string }) {
  const [template] = await admin`select save_json from cloud_saves s join profiles p on p.user_id = s.user_id where p.username_key = 'striker'`;
  const keys = JSON.parse(template.save_json) as Record<string, string>;
  const game = JSON.parse(keys[SAVE_KEY]) as Record<string, unknown>;
  keys[SAVE_KEY] = JSON.stringify({ ...game, totalGoals: values.totalGoals, goals: values.totalGoals });
  await admin`insert into profiles (user_id, username, username_key, display_name, login_email) values (${values.id}::uuid, ${values.username}, ${values.username.toLowerCase()}, ${values.displayName}, ${values.loginEmail ?? null})`;
  await admin`insert into cloud_saves (user_id, save_json, version, active, active_version) values (${values.id}::uuid, ${JSON.stringify(keys)}, 17, true, 17)`;
  await admin`insert into player_accounts (user_id, player_id) values (${values.id}::uuid, ${values.playerId})`;
  await admin`insert into legacy_identities (provider, provider_subject, account_id) values (${values.legacy.provider}, ${values.legacy.subject}, ${values.id}::uuid)`;
}

const ORIGINAL_PASSWORD = { id: '63cc2e63-0000-4000-8000-00000000a001', username: 'AltSpieler', displayName: 'Alter Hase', playerId: 'player-original-password', totalGoals: 424242, loginEmail: 'p-original@players.goal-clicker.vercel.app' };
const ORIGINAL_GOOGLE = { id: 'a55f881c-0000-4000-8000-00000000a002', username: 'AltGoogle', displayName: 'Google Alt', playerId: 'player-original-google', totalGoals: 515151, sub: '113983284348230000001' };

test('an original username account is taken over by simply logging in with the old password', { skip }, async () => {
  await plantOriginalAccount({ ...ORIGINAL_PASSWORD, legacy: { provider: 'email', subject: ORIGINAL_PASSWORD.id } });
  auth.legacy.set(ORIGINAL_PASSWORD.loginEmail, { id: ORIGINAL_PASSWORD.id, password: 'altes-passwort-7' });
  const before = await admin`select p.*, s.version, s.save_json from profiles p join cloud_saves s using (user_id) where p.user_id = ${ORIGINAL_PASSWORD.id}::uuid`;
  // A new site address starts with an empty browser.
  const page = await device('original-password');
  await login(page, ORIGINAL_PASSWORD.username, 'falsches-passwort');
  await page.getByText('Benutzername oder Passwort stimmt nicht.').waitFor();
  assert.equal((await admin`select count(*)::int as n from auth_identities where account_id = ${ORIGINAL_PASSWORD.id}::uuid`)[0].n, 0);
  await page.getByLabel('Passwort').fill('altes-passwort-7');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.getByRole('button', { name: `Konto von ${ORIGINAL_PASSWORD.displayName}` }).waitFor();
  // The original save is in the browser, nothing of the account changed, and the player ID is the original one.
  assert.equal(await localGoals(page), ORIGINAL_PASSWORD.totalGoals);
  await page.waitForFunction((id) => localStorage.getItem('goalClickerPlayerIdV3') === id, ORIGINAL_PASSWORD.playerId, { timeout: 15000 });
  const after = await admin`select p.*, s.version, s.save_json from profiles p join cloud_saves s using (user_id) where p.user_id = ${ORIGINAL_PASSWORD.id}::uuid`;
  assert.deepEqual(after, before);
  const [identity] = await admin`select method, login_email from auth_identities where account_id = ${ORIGINAL_PASSWORD.id}::uuid`;
  assert.equal(identity.method, 'legacy-password');
  assert.notEqual(identity.login_email, ORIGINAL_PASSWORD.loginEmail);
  // From now on it is a normal Neon login: a second device signs in with the same password, the bridge is not asked.
  auth.legacy.clear();
  const second = await device('original-password-2');
  await login(second, ORIGINAL_PASSWORD.username, 'altes-passwort-7');
  await second.getByRole('button', { name: `Konto von ${ORIGINAL_PASSWORD.displayName}` }).waitFor();
  assert.equal(await localGoals(second), ORIGINAL_PASSWORD.totalGoals);
  assert.deepEqual(problems, []);
});

test('an original Google account is taken over by its Google login, a new Google login gets a new account', { skip }, async () => {
  await plantOriginalAccount({ ...ORIGINAL_GOOGLE, legacy: { provider: 'google', subject: ORIGINAL_GOOGLE.sub } });
  const page = await device('original-google');
  auth.google.nextSub = ORIGINAL_GOOGLE.sub;
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click();
  await page.getByRole('button', { name: `Konto von ${ORIGINAL_GOOGLE.displayName}` }).waitFor({ timeout: 30000 });
  assert.equal(await localGoals(page), ORIGINAL_GOOGLE.totalGoals);
  assert.equal(new URL(page.url()).searchParams.has('neon_auth_session_verifier'), false);
  const [identity] = await admin`select method, subject from auth_identities where account_id = ${ORIGINAL_GOOGLE.id}::uuid`;
  assert.equal(identity.method, 'legacy-google');
  assert.notEqual(identity.subject, ORIGINAL_GOOGLE.id);
  // Someone else with a new Google login: a new, empty account that first asks for a profile.
  const stranger = await device('new-google');
  auth.google.nextSub = '200000000000000000042';
  await stranger.goto(BASE, { waitUntil: 'networkidle' });
  await stranger.getByRole('button', { name: 'Mit Google anmelden' }).click();
  await stranger.getByRole('heading', { name: 'Dein Profil' }).waitFor({ timeout: 30000 });
  await stranger.getByLabel('Benutzername').fill('NeuGoogle');
  await stranger.getByText('Dieser Benutzername ist frei.').waitFor();
  await stranger.getByLabel('Anzeigename').fill('Neu');
  await stranger.getByRole('button', { name: 'Profil erstellen' }).click();
  await closeWelcomePack(stranger);
  await stranger.getByRole('button', { name: 'Konto von Neu' }).waitFor();
  assert.equal((await admin`select count(*)::int as n from auth_identities`)[0].n >= 4, true);
  assert.deepEqual(problems, []);
});

test('a revoked session ends the game on the next check, and the reload shows the login', { skip }, async () => {
  const page = devices['original-google'].page;
  // Neon Auth revokes every session of that login (another device signed out everywhere, or an admin).
  const [identity] = await admin`select subject from auth_identities where account_id = ${ORIGINAL_GOOGLE.id}::uuid`;
  for (const [token, session] of auth.sessions) if (session.userId === identity.subject) auth.sessions.delete(token);
  const response = await page.evaluate(async () => (await fetch('/api/save')).status);
  assert.equal(response, 401);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Mit Google anmelden' }).waitFor();
});

test('two accounts play one world at the same time: joining, concurrent clicks and cross account refusal', { skip }, async () => {
  const host = devices['original-password'].page;
  const guest = devices['new-google'].page;
  const { MULTIPLAYER_PROTOCOL_VERSION: protocol } = await import('../../app/multiplayer-protocol.ts');
  const api = (page: Page, body: Record<string, unknown>) => page.evaluate(async ({ body, protocol }) => {
    const response = await fetch('/api/multiplayer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocol, ...body }) });
    return { status: response.status, data: await response.json() as { room?: { code: string; sharedCoins: number; playerCount: number }; error?: string; errorCode?: string } };
  }, { body, protocol });
  const playerOf = (page: Page) => page.evaluate(() => localStorage.getItem('goalClickerPlayerIdV3') ?? '');
  const hostId = await playerOf(host);
  const guestId = await playerOf(guest);
  assert.equal(hostId, ORIGINAL_PASSWORD.playerId);
  const created = await api(host, { action: 'create', playerId: hostId, nickname: ORIGINAL_PASSWORD.displayName });
  assert.equal(created.status, 201, created.data.error);
  const code = created.data.room!.code;
  // The guest cannot act as the host by naming the host's player ID.
  const impersonation = await api(guest, { action: 'click', code, playerId: hostId, amount: 1, clickCount: 1 });
  assert.equal(impersonation.status, 409);
  const joined = await api(guest, { action: 'join', code, playerId: guestId, nickname: 'Neu' });
  assert.equal(joined.status, 200, joined.data.error);
  assert.equal(joined.data.room!.playerCount, 2);
  const clicks = await Promise.all([...Array.from({ length: 6 }, () => api(host, { action: 'click', code, playerId: hostId, amount: 1, clickCount: 1 })), ...Array.from({ length: 6 }, () => api(guest, { action: 'click', code, playerId: guestId, amount: 1, clickCount: 1 }))]);
  assert.ok(clicks.every((click) => click.status === 200 || click.status === 409), JSON.stringify(clicks.map((click) => [click.status, click.data.errorCode])));
  const [row] = await admin`select host_clicks, guest_clicks, shared_state_version from coop_rooms where code = ${code}`;
  assert.ok(Number(row.host_clicks) >= 1 && Number(row.guest_clicks) >= 1, JSON.stringify(row));
  // Signed out, the world is closed.
  const anonymous = await (await fetch(`${BASE}/api/multiplayer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocol, action: 'click', code, playerId: hostId, amount: 1, clickCount: 1 }) })).status;
  assert.equal(anonymous, 401);
  assert.deepEqual(problems, []);
});

test('a deleted Google account stays locked: signing in with Google again shows the deletion, not a new account', { skip }, async () => {
  const page = devices['new-google'].page;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Konto von Neu' }).click();
  const panel = page.getByRole('dialog', { name: 'Konto' });
  await panel.getByText('Profil löschen').click();
  await panel.getByLabel(/eintippen/).fill('neugoogle');
  await panel.getByRole('button', { name: 'Endgültig löschen' }).click();
  await page.getByText('Dein Login ist gesperrt und wird vom Besitzer des Spiels endgültig entfernt.').waitFor();
  const accounts = (await admin`select count(*)::int as n from profiles`)[0].n;
  auth.google.nextSub = '200000000000000000042';
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click();
  await page.getByRole('heading', { name: 'Konto gelöscht' }).waitFor({ timeout: 30000 });
  assert.equal(await page.getByRole('heading', { name: 'Dein Profil' }).count(), 0);
  assert.equal((await admin`select count(*)::int as n from profiles`)[0].n, accounts, 'no new account was created');
  // The world the account played in stays for the other player.
  assert.equal((await admin`select count(*)::int as n from coop_rooms where host_player_id = ${ORIGINAL_PASSWORD.playerId}`)[0].n, 1);
  assert.deepEqual(problems, []);
});
