// New accounts with a real e-mail address (GOAL_CLICKER_EMAIL_SIGNUP=1) end to end against the Neon Auth stand-in:
// the game stays closed until the code sent to the address is entered (wrong code, retry, new code), the address
// signs in, a forgotten password is reset with a code, and with the switch on an original username account and a
// Google login still open their own accounts. Nothing is ever joined by e-mail address.
// Needs TEST_DATABASE_URL (an empty scratch database) and Chromium; builds its own copy into .next-email.
import assert from 'node:assert/strict';
import { hash } from 'bcryptjs';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { after, before, test } from 'node:test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { startMockNeonAuth } from './mock-neon-auth.ts';

const databaseUrl = process.env.TEST_DATABASE_URL ?? '';
const skip = databaseUrl ? false : 'TEST_DATABASE_URL is not set';
const AUTH_PORT = 54398;
const PORT = Number(process.env.EMAIL_TEST_PORT ?? 8797);
const BASE = `http://127.0.0.1:${PORT}`;
const env = {
  ...process.env,
  NEXT_DIST_DIR: '.next-email',
  GOAL_CLICKER_EMAIL_SIGNUP: '1',
  NEON_AUTH_BASE_URL: `http://127.0.0.1:${AUTH_PORT}/neondb/auth`,
  NEON_AUTH_COOKIE_SECRET: 'browser-test-cookie-secret-0123456789abcdef',
  LEGACY_PASSWORD_DATABASE_URL: databaseUrl,
  AUTH_SESSION_CACHE_SECONDS: '0',
  DATABASE_URL: databaseUrl,
};

let admin: postgres.Sql;
let auth: ReturnType<typeof startMockNeonAuth>;
let server: ChildProcess | undefined;
let browser: Browser;
const problems: string[] = [];

before(async () => {
  if (!databaseUrl) return;
  admin = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(admin), { migrationsFolder: 'drizzle' });
  await admin`truncate coop_rooms, solo_travel, player_accounts, profiles, cloud_saves, auth_identities, legacy_identities, account_recovery, recovery_codes, rate_limits`;
  await admin`create schema if not exists migration_private`;
  await admin`create table if not exists migration_private.legacy_passwords(account_id uuid primary key,login_email text unique not null,password_hash text not null)`;
  await admin`truncate migration_private.legacy_passwords`;
  auth = startMockNeonAuth(AUTH_PORT);
  if (process.env.EMAIL_TEST_REUSE_BUILD !== '1') {
    const build = spawnSync('node_modules/.bin/next', ['build'], { env, stdio: 'inherit' });
    assert.equal(build.status, 0, 'next build with e-mail sign-up failed');
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  page.on('pageerror', (error) => problems.push(`${name}: ${error.message}`));
  page.on('dialog', (dialog) => void dialog.accept());
  return page;
}

async function closeWelcomePack(page: Page) {
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor({ timeout: 30000 });
  const skipButton = page.getByRole('dialog').getByRole('button', { name: 'Überspringen' });
  try {
    await skipButton.waitFor({ timeout: 6000 });
    await skipButton.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Beenden' }).click();
  } catch { /* no tutorial for this save */ }
}

async function signIn(page: Page, name: string, password: string) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByLabel('Benutzername oder E-Mail').fill(name);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
}

const MAIL = 'lea.keller@example.org';
const gameOpen = (page: Page) => page.getByRole('button', { name: 'Fussball anklicken' }).count();

test('a new account gives a real address and stays closed until its code: wrong code, new code, then the game', { skip }, async () => {
  const page = await device('mail');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Konto erstellen' }).click();
  await page.getByLabel('Benutzername').fill('LeaK');
  await page.getByText('Dieser Benutzername ist frei.').waitFor();
  await page.getByLabel('Anzeigename').fill('Lea');
  await page.getByLabel('E-Mail').fill('keine-adresse');
  await page.getByLabel(/^Passwort \(mindestens/).fill('sicheres-passwort-1');
  await page.getByLabel('Passwort wiederholen', { exact: true }).fill('sicheres-passwort-1');
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  // The browser's own check stops a malformed address; the server would refuse it too.
  assert.equal(await page.getByRole('heading', { name: 'E-Mail bestätigen' }).count(), 0);
  await page.getByLabel('E-Mail').fill(MAIL.toUpperCase());
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await page.getByRole('heading', { name: 'E-Mail bestätigen' }).waitFor();
  assert.equal(await gameOpen(page), 0, 'pending: no game');
  const [identity] = await admin`select method, login_email from auth_identities`;
  assert.deepEqual({ ...identity }, { method: 'email', login_email: MAIL });
  assert.equal((await admin`select count(*)::int as n from cloud_saves`)[0].n, 0);
  const first = auth.lastCode(MAIL);
  assert.match(first, /^\d{6}$/);

  // A reload keeps the account closed and the code step open.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'E-Mail bestätigen' }).waitFor();
  assert.equal(await gameOpen(page), 0);

  // A wrong code is refused, the field clears; a new code replaces the first one.
  await page.getByLabel('Code').fill(first === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await page.getByText('Der Code stimmt nicht oder ist abgelaufen.').waitFor();
  await page.getByRole('button', { name: 'Neuen Code senden' }).click();
  await page.getByText(`Wir haben einen neuen Code an ${MAIL} geschickt.`).waitFor();
  const second = auth.lastCode(MAIL);
  assert.notEqual(second, first);
  await page.getByLabel('Code').fill(second);
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await closeWelcomePack(page);
  await page.getByRole('button', { name: 'Konto von Lea' }).waitFor();
  assert.deepEqual(problems, []);
});

test('the address and the username both sign in to the same account', { skip }, async () => {
  const [{ account_id: accountId }] = await admin`select account_id from auth_identities where method = 'email'`;
  for (const name of [MAIL, 'leak']) {
    const page = await device(`signin-${name}`);
    await signIn(page, name, 'sicheres-passwort-1');
    await page.getByRole('button', { name: 'Konto von Lea' }).waitFor({ timeout: 30000 });
    assert.equal((await admin`select count(distinct account_id)::int as n from auth_identities where method = 'email'`)[0].n, 1);
    assert.equal(String(accountId).length, 36);
  }
  assert.deepEqual(problems, []);
});

test('a forgotten password: neutral answer, code and new password, the old one stops working', { skip }, async () => {
  const page = await device('reset');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Passwort vergessen?' }).click();
  // An address without an account reads exactly like one with an account, and no mail goes out.
  const sentBefore = auth.outbox.length;
  await page.getByLabel('E-Mail').fill('niemand@example.org');
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page.getByText('Falls zu niemand@example.org ein Konto gehört, ist ein Code unterwegs.', { exact: false }).waitFor();
  assert.equal(auth.outbox.length, sentBefore);
  await page.getByRole('button', { name: 'Neuen Code anfordern' }).click();
  await page.getByLabel('E-Mail').fill(MAIL);
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page.getByText(`Falls zu ${MAIL} ein Konto gehört`, { exact: false }).waitFor();
  const code = auth.lastCode(MAIL, 'forget-password');
  assert.match(code, /^\d{6}$/);
  await page.getByLabel('Code').fill(code);
  await page.getByRole('textbox', { name: /^Neues Passwort/ }).fill('neues-passwort-2');
  await page.getByLabel('Passwort wiederholen', { exact: true }).fill('neues-passwort-2');
  await page.getByRole('button', { name: 'Passwort ändern' }).click();
  await page.getByText('Dein Passwort ist geändert.', { exact: false }).waitFor();
  await signIn(page, MAIL, 'sicheres-passwort-1');
  await page.getByText(/stimmt nicht/).waitFor();
  await page.getByLabel('Passwort', { exact: true }).fill('neues-passwort-2');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.getByRole('button', { name: 'Konto von Lea' }).waitFor({ timeout: 30000 });
  assert.deepEqual(problems, []);
});

test('with the switch on, an original username account and a Google login open their own accounts as before', { skip }, async () => {
  const original = { id: '63cc2e63-0000-4000-8000-00000000b001', username: 'AltSpieler', loginEmail: 'p-original@players.goal-clicker.vercel.app' };
  await admin`insert into profiles (user_id, username, username_key, display_name, login_email) values (${original.id}::uuid, ${original.username}, ${original.username.toLowerCase()}, 'Alter Hase', ${original.loginEmail})`;
  await admin`insert into legacy_identities (provider, provider_subject, account_id) values ('email', ${original.id}, ${original.id}::uuid)`;
  await admin`insert into migration_private.legacy_passwords(account_id,login_email,password_hash) values(${original.id}::uuid,${original.loginEmail},${await hash('altes-passwort-7', 4)})`;
  const page = await device('original');
  await signIn(page, original.username, 'altes-passwort-7');
  await closeWelcomePack(page);
  await page.getByRole('button', { name: 'Konto von Alter Hase' }).waitFor();
  const [identity] = await admin`select method from auth_identities where account_id = ${original.id}::uuid`;
  assert.equal(identity.method, 'legacy-password');

  // A Google login with the same address as the e-mail account gets its own new account, never Lea's.
  const google = await device('google');
  auth.google.nextSub = '200000000000000000077';
  auth.google.nextEmail = MAIL;
  await google.goto(BASE, { waitUntil: 'networkidle' });
  await google.getByRole('button', { name: 'Mit Google anmelden' }).click();
  await google.getByRole('heading', { name: 'Dein Profil' }).waitFor({ timeout: 30000 });
  const accounts = await admin`select method, account_id from auth_identities where method in ('email', 'google')`;
  assert.equal(accounts.length, 2);
  assert.notEqual(accounts[0].account_id, accounts[1].account_id);
  assert.deepEqual(problems, []);
});
