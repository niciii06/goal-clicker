// Isolated browser audit (run by hand, not part of npm run test:browser or test:account):
//   TEST_DATABASE_URL=postgres://... node --import tsx --test --test-concurrency=1 tests/browser/theme-audit-account-states.test.ts
// Light and dark audit of the states that need a login: the guest (start screen, playing as guest, the locked co-op prompt and the sign up that
// takes the guest save along) and the co-op world with its two seats. It uses the stand-in for Neon Auth and an empty scratch database like
// tests/browser/account.test.ts, and builds its own copy into .next-account. Every state is measured in both themes on a 390 px touch phone
// and on a 1280 px desktop (text contrast, large surfaces of the wrong brightness, horizontal overflow; see theme-measure.ts).
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
import { measure } from './theme-measure.ts';

const databaseUrl = process.env.TEST_DATABASE_URL ?? '';
const skip = databaseUrl ? false : 'TEST_DATABASE_URL is not set';
const AUTH_PORT = 54398, PORT = Number(process.env.THEME_ACCOUNT_PORT ?? 8797), BASE = `http://127.0.0.1:${PORT}`;
const REPORT = process.env.THEME_AUDIT_REPORT === '1';
const env = {
  ...process.env, NEXT_DIST_DIR: '.next-account', NEON_AUTH_BASE_URL: `http://127.0.0.1:${AUTH_PORT}/neondb/auth`,
  NEON_AUTH_COOKIE_SECRET: 'browser-test-cookie-secret-0123456789abcdef', LEGACY_PASSWORD_DATABASE_URL: databaseUrl, AUTH_SESSION_CACHE_SECONDS: '0', DATABASE_URL: databaseUrl,
};
let admin: postgres.Sql, auth: ReturnType<typeof startMockNeonAuth>, server: ChildProcess | undefined, browser: Browser;
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
  if (process.env.ACCOUNT_TEST_REUSE_BUILD !== '1') {
    const build = spawnSync('node_modules/.bin/next', ['build'], { env, stdio: 'inherit' });
    assert.equal(build.status, 0, 'next build with the test login settings failed');
  }
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { env, stdio: 'ignore', detached: true });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid); } catch { /* gone */ } }
  await auth?.close(); await admin?.end();
});

const PHONE = { name: 'phone 390', width: 390, height: 844, touch: true }, DESKTOP = { name: 'desktop 1280', width: 1280, height: 900, touch: false };
async function device(viewport: typeof PHONE, scheme: 'light' | 'dark'): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'de-CH', colorScheme: scheme, ...(viewport.touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('dialog', (dialog) => void dialog.accept());
  return { page, context };
}
async function closeWelcome(page: Page) {
  await page.getByRole('button', { name: 'Fussball anklicken' }).waitFor();
  const skipButton = page.getByRole('dialog').getByRole('button', { name: 'Überspringen' });
  try { await skipButton.waitFor({ timeout: 6000 }); await skipButton.click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Beenden' }).click(); } catch { /* no tutorial */ }
}
async function register(page: Page, username: string, displayName: string) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: 'Konto erstellen' }).click();
  await page.getByLabel('Benutzername').fill(username);
  await page.getByText('Dieser Benutzername ist frei.').waitFor();
  await page.getByLabel('Anzeigename').fill(displayName);
  await page.getByLabel(/^Passwort \(mindestens/).fill('sicheres-passwort-9');
  await page.getByLabel('Passwort wiederholen', { exact: true }).fill('sicheres-passwort-9');
  await page.getByRole('button', { name: 'Konto erstellen', exact: true }).click();
  await closeWelcome(page);
}

/** Findings that were looked at and are deliberate; none so far. */
const ACCEPTED: Record<string, RegExp[]> = {};
async function check(id: string, viewport: typeof PHONE, scheme: 'light' | 'dark', page: Page) {
  const { findings, unmeasured } = await measure(page, scheme);
  if (REPORT) console.log(`AUDIT ${id} | ${viewport.name} | ${scheme}: ${findings.length ? JSON.stringify(findings) : 'clean'} (text on gradients or images, not measured: ${unmeasured})`);
  const open = findings.filter((x) => !(ACCEPTED[id] ?? []).some((re) => re.test(`${x.kind} ${x.at} ${x.detail}`)));
  assert.deepEqual(open, [], `${id} ${viewport.name} ${scheme}`);
}

const shots = (page: Page, id: string, viewport: typeof PHONE, scheme: string) => process.env.THEME_AUDIT_SHOTS ? page.screenshot({ path: `${process.env.THEME_AUDIT_SHOTS}/${id.replace(/ /g, '-')}-${viewport.name.replace(/ /g, '')}-${scheme}.png` }) : Promise.resolve(undefined);

for (const viewport of [PHONE, DESKTOP]) for (const scheme of ['light', 'dark'] as const) {
  test(`guest: start screen, playing as guest, locked co-op prompt and sign up with the guest save, ${viewport.name}, ${scheme}`, { skip }, async () => {
    const { page, context } = await device(viewport, scheme);
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Als Gast fortfahren' }).waitFor();
    await shots(page, 'guest-start', viewport, scheme); await check('guest start screen', viewport, scheme, page);
    await page.getByRole('button', { name: 'Als Gast fortfahren' }).click();
    await closeWelcome(page); await page.waitForTimeout(800);
    await shots(page, 'guest-playing', viewport, scheme); await check('guest playing', viewport, scheme, page);
    await page.getByRole('button', { name: /Koop Multiplayer/ }).click();
    const prompt = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await prompt.getByText('Koop braucht ein Konto').waitFor();
    await page.waitForTimeout(500);
    await shots(page, 'guest-coop-prompt', viewport, scheme); await check('guest co-op prompt', viewport, scheme, page);
    await prompt.getByRole('button', { name: 'Anmelden' }).click();
    await page.getByText('Dein Gast Spielstand kommt in dein Konto').waitFor();
    await page.waitForTimeout(500);
    await shots(page, 'guest-signup', viewport, scheme); await check('guest sign up screen', viewport, scheme, page);
    await context.close();
  });
}

for (const viewport of [PHONE, DESKTOP]) for (const scheme of ['light', 'dark'] as const) {
  test(`co-op world with two seats, ${viewport.name}, ${scheme}`, { skip }, async () => {
    const suffix = `${viewport.touch ? 'p' : 'd'}${scheme[0]}`;
    const host = await device(viewport, scheme), guest = await device(viewport, scheme);
    await register(host.page, `Host${suffix}`, `Host ${suffix}`);
    await register(guest.page, `Gast${suffix}`, `Gast ${suffix}`);
    // The host opens a world in the lobby; the second account enters its room code, as two players do.
    await host.page.getByRole('button', { name: /Koop Multiplayer/ }).click();
    await host.page.getByRole('button', { name: 'Welt erstellen' }).click();
    await host.page.waitForTimeout(2500);
    const [room] = await admin`select code from coop_rooms where host_name = ${`Host ${suffix}`} order by code limit 1`;
    assert.ok(room?.code, 'the world exists');
    await guest.page.getByRole('button', { name: /Koop Multiplayer/ }).click();
    await guest.page.getByPlaceholder('ABC123').fill(String(room.code));
    await guest.page.getByPlaceholder('ABC123').press('Enter');
    await guest.page.waitForTimeout(2500);
    for (const [name, who] of [['host', host], ['guest', guest]] as const) {
      await who.page.waitForTimeout(500);
      await shots(who.page, `coop-${name}`, viewport, scheme);
      await check(`co-op seat ${name}`, viewport, scheme, who.page);
    }
    assert.deepEqual(problems.filter((message) => !message.includes('navigator.vibrate')), []);
    await host.context.close(); await guest.context.close();
  });
}
