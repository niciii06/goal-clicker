// Browser smoke test against the production build served by next start.
// Run with: npm run test:browser (CI runs it after npm test, which builds .next).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import type { Socket } from 'node:net';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { SEASON_MODE_MATCHES_PER_SEASON, TOURNAMENTS, advanceCupMatch, beginSeasonCupMatch, getStarXISelection, normalizeGameFeatures, resumeCupMatch, setBestStarXI, STAR_XI_PLAYERS } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { getPlayerMilestones, prepareCareerMatch } from '../../app/career-data.ts';
import { ALBUM_MILESTONES_STORAGE_KEY, TUTORIAL_STORAGE_KEY, WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { createJourney, fixtureFor } from '../../app/travel-data.ts';
import { TUTORIAL_INTRO_PAGES } from '../../app/tutorial.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.SMOKE_PORT ?? 8799);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }, { name: 'tablet portrait', width: 834, height: 1194 }, { name: 'tablet landscape', width: 1194, height: 834 }] as const;
const TABS = ['Home', 'Spiele', 'Saison', 'Kader', 'Karriere', 'Packs & Album', 'Club & Mehr'];
// Nothing is expected to fail to load.
const IGNORED_URL = /^$/;

let server: ChildProcess | undefined;
let browser: Browser;
let baseSave: Record<string, unknown> & { features: GameFeatures };

async function waitForServer(timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server on ${BASE} did not start`);
}

before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Run npm run build first (npm test builds .next).');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { stdio: 'ignore', detached: true, env: { ...process.env, PORT: String(PORT) } });
  await waitForServer(120000);
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

function richFeatures(now: number) {
  const f = normalizeGameFeatures(structuredClone(baseSave.features));
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => p.rating < 97).slice(0, 120).map((p) => p.id) });
  // Random full screen events would make the run non deterministic.
  f.nextEventAt = now + 1e9; f.nextVarAt = now + 1e9; f.transferSaga.nextAt = now + 1e9;
  return normalizeGameFeatures(f);
}

function save(features: GameFeatures, now: number) {
  return JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, stars: 10, features, lastSaved: now });
}

function liveMatch(now: number) {
  const f = richFeatures(now);
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}

function finishedMatch(now: number) {
  const f = liveMatch(now);
  for (let i = 0; i < 2000 && f.cup.active; i++) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 20000), Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
  }
  const shift = now - 30000 - f.cup.matchEndsAt;
  f.cup = { ...f.cup, matchStartedAt: f.cup.matchStartedAt + shift, matchEndsAt: f.cup.matchEndsAt + shift, lastTickAt: f.cup.lastTickAt + shift };
  return f;
}

/** `whatsNewSeen: false` leaves the newest release notes unread, so the "Was ist neu" window opens. */
async function openWithSave(viewport: { width: number; height: number }, saveJson: string, colorScheme: 'light' | 'dark' = 'light', whatsNewSeen = true) {
  const page = await browser.newPage({ viewport, colorScheme });
  // tsx keeps function names with a __name helper; functions passed to page.evaluate need it in the browser too.
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400 && !IGNORED_URL.test(response.url())) problems.push(`${response.status()} ${response.url()}`); });
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(`console: ${message.text()}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); if (seen) localStorage.setItem(seenKey, seen); }, [SAVE_KEY, saveJson, WHATS_NEW_STORAGE_KEY, whatsNewSeen ? WHATS_NEW[0].id : '']);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { page, problems };
}

async function openTab(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true }).first();
  if (await button.count()) { await button.click(); await page.waitForTimeout(700); return true; }
  return false;
}

/** Layout checks: horizontal overflow, overlapping text and text that hardly differs from its background. */
async function layoutProblems(page: Page) {
  await page.evaluate('globalThis.__name ??= (fn) => fn;');
  return page.evaluate(() => {
    // Computed colours can be color(srgb …) or oklab(…) after color-mix(); a canvas turns any of them into RGBA.
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const parse = (c: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
    const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const visible = (e: Element) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > .2 && r.width > 2 && r.height > 2; };
    const hidden = (e: Element) => Boolean(e.closest('canvas,svg,script,style,[aria-hidden=true],.toast,[role=status],button:disabled')) || Boolean(e.closest('details:not([open])') && !e.closest('summary'));
    const fixed = (e: Element) => { for (let a: Element | null = e; a; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
    const ownText = (e: Element) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').trim();
    const texts = [...document.querySelectorAll('body *')].filter((e) => ownText(e) && !hidden(e) && !fixed(e) && visible(e));
    const problems: string[] = [];
    if (document.documentElement.scrollWidth - innerWidth > 1) problems.push(`horizontal overflow ${document.documentElement.scrollWidth - innerWidth}px`);
    for (const e of texts) {
      const text = ownText(e);
      if (!/[A-Za-zÄÖÜäöü0-9]{2}/.test(text)) continue; // symbols and emoji
      let bg: number[] | null = null;
      for (let a: Element | null = e; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.backgroundImage !== 'none') break; const c = parse(s.backgroundColor); if (c.length < 4 || c[3] > .5) { bg = c; break; } }
      if (!bg) continue;
      const fg = parse(getComputedStyle(e).color), a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if (ratio < 2) problems.push(`low contrast ${ratio.toFixed(2)}: "${text.slice(0, 40)}"`);
    }
    const clipOf = (e: Element) => { let box = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 }; for (let a = e.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { const r = a.getBoundingClientRect(); box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top), r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom) }; } } return box; };
    const rects = texts.map((e) => { const range = document.createRange(); range.selectNodeContents(e); const c = clipOf(e), s = getComputedStyle(e), clipsSelf = s.overflowX !== 'visible' || s.textOverflow === 'ellipsis'; const own = e.getBoundingClientRect(); return { e, size: parseFloat(s.fontSize), list: [...range.getClientRects()].map((r) => ({ l: Math.max(r.left, c.l, clipsSelf ? own.left : -1e9), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r, clipsSelf ? own.right : 1e9), b: Math.min(r.bottom, c.b) })).filter((r) => r.r - r.l > 1 && r.b - r.t > 1) }; });
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const x = rects[i], y = rects[j];
      if (x.e.contains(y.e) || y.e.contains(x.e)) continue;
      for (const p of x.list) for (const q of y.list) {
        // Glyph boxes include generous line height; compare the central part of each line only.
        const ph = (p.b - p.t) * .25, qh = (q.b - q.t) * .25;
        const w = Math.min(p.r, q.r) - Math.max(p.l, q.l), h = Math.min(p.b - ph, q.b - qh) - Math.max(p.t + ph, q.t + qh);
        if (w > 4 && h > 2) problems.push(`overlap: "${ownText(x.e).slice(0, 30)}" / "${ownText(y.e).slice(0, 30)}"`);
      }
    }
    return [...new Set(problems)].slice(0, 15);
  });
}

for (const viewport of VIEWPORTS) for (const colorScheme of ['light', 'dark'] as const) {
  test(`${viewport.name} ${colorScheme}: every tab loads without errors, overflow, overlapping or unreadable text`, async () => {
    const now = Date.now();
    const { page, problems } = await openWithSave(viewport, save(richFeatures(now), now), colorScheme);
    for (const tab of TABS) {
      assert.ok(await openTab(page, tab), `tab ${tab} missing`);
      const found = await layoutProblems(page);
      assert.deepEqual(found, [], `${viewport.name} ${colorScheme} / ${tab}`);
    }
    assert.deepEqual(problems, []);
    await page.close();
  });
}

test('click combo reaches x1,5 and the daily reward can be claimed once', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[0], save(richFeatures(now), now));
  const ball = await page.getByRole('button', { name: 'Fussball anklicken' }).boundingBox();
  for (let i = 0; i < 22; i++) await page.mouse.click(ball!.x + ball!.width / 2, ball!.y + ball!.height / 2);
  assert.match(await page.locator('.combo-label').innerText(), /COMBO x1,5|COMBO x2/);
  await page.getByRole('button', { name: /Prämie abholen/ }).click();
  await page.waitForTimeout(500);
  assert.match(await page.locator('.daily-reward').innerText(), /abgeholt/);
  assert.equal(await page.getByRole('button', { name: /Prämie abholen/ }).count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

test('a live interactive match draws the 2D pitch with stands and the match tabs work', async () => {
  for (const viewport of VIEWPORTS) {
    const now = Date.now();
    const { page, problems } = await openWithSave(viewport, save(liveMatch(now), now));
    const sounds: string[] = [];
    page.on('response', (response) => { if (response.url().includes('/sounds/') && response.ok()) sounds.push(response.url()); });
    assert.ok(await openTab(page, 'Spiele · LIVE'), 'live tab missing');
    const canvas = page.locator('canvas.gc-viewer-pitch').first();
    await canvas.waitFor({ timeout: 15000 });
    // A blank canvas compresses to a few hundred bytes; pitch, players and stands need far more.
    // The render worker loads its chunks first, so wait for its first frame instead of a fixed time.
    let size = 0;
    for (const until = Date.now() + 8000; Date.now() < until && size <= 15000; await page.waitForTimeout(250)) size = (await canvas.screenshot()).length;
    assert.ok(size > 15000, 'canvas looks empty');
    for (const tab of ['Live Ticker', 'Statistik', '2D', 'Wechsel']) {
      await page.getByRole('button', { name: tab, exact: true }).first().click();
      await page.waitForTimeout(500);
      assert.deepEqual((await layoutProblems(page)).filter((p) => !p.startsWith('overlap')), [], `${viewport.name} / ${tab}`);
    }
    // The stadium sound loads its crowd recordings once the match is on screen.
    assert.ok(['crowd-murmur', 'crowd-applause', 'crowd-ooh'].every((name) => sounds.some((url) => url.includes(name))), `stadium sounds: ${sounds.join(', ')}`);
    assert.deepEqual(problems, []);
    await page.close();
  }
});

test('a real mouse drag in the live substitution editor lights up the drop targets', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[0], save(liveMatch(now), now));
  assert.ok(await openTab(page, 'Spiele · LIVE'), 'live tab missing');
  await page.getByRole('button', { name: 'Wechsel', exact: true }).first().click();
  const source = page.locator('.starxi-pitch-slot[draggable="true"]').nth(7);
  await source.waitFor({ timeout: 10000 });
  const box = (await source.boundingBox())!;
  // Chrome fires pointercancel when the native drag starts; the highlight has to survive it.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width / 2 + i * 25, box.y + box.height / 2 - i * 8); await page.waitForTimeout(30); }
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.squad-dragging').count(), 1);
  assert.ok(await page.locator('.squad-drop-ready').count() > 0, 'no drop target lit up');
  await page.mouse.up();
  assert.deepEqual(problems, []);
  await page.close();
});

test('the press conference appears after a finished match and accepts one answer', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[1], save(finishedMatch(now), now));
  assert.ok(await openTab(page, 'Spiele'), 'games tab missing');
  const panel = page.locator('.press-conference');
  await panel.waitFor({ timeout: 10000 });
  await panel.locator('.press-answers button').first().click();
  await page.waitForTimeout(500);
  assert.match(await page.locator('.press-conference').innerText(), /BEANTWORTET/);
  assert.deepEqual(await layoutProblems(page), []);
  assert.deepEqual(problems, []);
  await page.close();
});

test('the leaderboard tab lists co-op worlds and marks your own', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[1], save(richFeatures(now), now));
  const sorts: string[] = [];
  // The test server has no database; the API answer is the one leaderboard-api.ts builds.
  await page.route('**/api/leaderboard?**', (route) => {
    const sort = new URL(route.request().url()).searchParams.get('sort') ?? 'goals';
    sorts.push(sort);
    return route.fulfill({ json: { sort, entries: [
      { rank: 1, roomName: 'Torfabrik Bümpliz mit einem sehr langen Weltnamen', players: ['Nicolas', 'Silvan', 'Anna', 'Ben'], totalGoals: 9.4e12, bestLeague: 1, trophies: 12, mine: false },
      { rank: 2, roomName: 'Meine Welt', players: ['Nicolas'], totalGoals: 1.2e9, bestLeague: 6, trophies: 1, mine: true },
    ] } });
  });
  assert.ok(await openTab(page, 'Club & Mehr'));
  await page.getByRole('tab', { name: 'Rangliste' }).click();
  assert.equal(new URL(page.url()).pathname, '/club/rangliste');
  await page.locator('.leaderboard-list li').nth(1).waitFor({ timeout: 10000 });
  assert.match(await page.locator('.leaderboard-list li.mine').innerText(), /Deine Welt/);
  await page.getByRole('radio', { name: 'Liga' }).click();
  await page.locator('.leaderboard-value', { hasText: 'Liga 1' }).waitFor({ timeout: 10000 });
  assert.deepEqual(sorts, ['goals', 'league']);
  assert.deepEqual(await layoutProblems(page), []);
  assert.deepEqual(problems, []);
  await page.close();
});

test('every tab has its own address, and switching tabs or going back keeps the game running', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[0], save(richFeatures(now), now));
  const current = () => page.locator('nav[aria-label="Hauptnavigation"] [aria-current="page"]').getAttribute('aria-label');
  await openTab(page, 'Kader');
  assert.equal(new URL(page.url()).pathname, '/kader');
  // State that lives only in the mounted game: it survives tab changes and the back button.
  await page.getByLabel('Spieler im Reservekader suchen').fill('Zidane');
  await openTab(page, 'Spiele');
  assert.equal(new URL(page.url()).pathname, '/spiele');
  await openTab(page, 'Club & Mehr');
  await page.getByRole('tab', { name: 'Wochenziele' }).click();
  assert.equal(new URL(page.url()).pathname, '/club/missionen');
  await page.goBack(); await page.goBack(); await page.goBack();
  await page.waitForTimeout(500);
  assert.equal(new URL(page.url()).pathname, '/kader');
  assert.equal(await current(), 'Kader');
  assert.equal(await page.getByLabel('Spieler im Reservekader suchen').inputValue(), 'Zidane', 'the game was not reloaded');
  // Direct links open their tab; other spellings lead to the real address; unknown paths do not exist.
  await page.goto(`${BASE}/Karriere`, { waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).pathname, '/karriere');
  assert.equal(await current(), 'Karriere');
  await page.goto(`${BASE}/packs/album`, { waitUntil: 'networkidle' });
  assert.equal(await current(), 'Packs & Album');
  assert.equal(await page.getByRole('tab', { name: 'Sammelalbum' }).getAttribute('aria-selected'), 'true');
  assert.equal((await fetch(`${BASE}/gibt-es-nicht`)).status, 404);
  assert.deepEqual(problems, []);
  await page.close();
});

test('switching from co-op back to single player asks first', async () => {
  const now = Date.now();
  const { page } = await openWithSave(VIEWPORTS[0], save(richFeatures(now), now));
  const single = page.getByRole('button', { name: 'Singleplayer', exact: true });
  const coop = page.getByRole('button', { name: 'Koop Multiplayer', exact: true });
  await single.click();
  assert.equal(await page.getByRole('alertdialog').count(), 0, 'no question while already in single player');
  await coop.click();
  await single.click();
  const dialog = page.getByRole('alertdialog', { name: 'Zum Singleplayer wechseln?' });
  await dialog.waitFor({ timeout: 3000 });
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  assert.equal(await dialog.count(), 0);
  assert.match(await coop.getAttribute('class') ?? '', /active/, 'cancel stays in co-op');
  await single.click();
  await page.keyboard.press('Escape');
  assert.match(await coop.getAttribute('class') ?? '', /active/, 'Escape stays in co-op');
  await single.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Wechseln' }).click();
  assert.match(await single.getAttribute('class') ?? '', /active/, 'confirm switches to single player');
  await page.close();
});

test('the "Was ist neu" window opens once for an existing game and stays closed after reading', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[1], save(richFeatures(now), now), 'light', false);
  const dialog = page.getByRole('dialog', { name: WHATS_NEW[0].title });
  await dialog.waitFor();
  assert.deepEqual(await layoutProblems(page), []);
  await dialog.getByRole('button', { name: 'Verstanden' }).click();
  assert.equal(await dialog.count(), 0);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), WHATS_NEW_STORAGE_KEY), WHATS_NEW[0].id);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  assert.equal(await page.getByRole('dialog', { name: WHATS_NEW[0].title }).count(), 0, 'shown only once');
  assert.deepEqual(problems, []);
  await page.close();
  // A brand new player (fresh browser storage) starts without the window.
  const fresh = await browser.newPage({ viewport: VIEWPORTS[1] });
  await fresh.goto(BASE, { waitUntil: 'networkidle' });
  await fresh.waitForTimeout(1200);
  assert.equal(await fresh.getByRole('dialog', { name: WHATS_NEW[0].title }).count(), 0, 'no release notes for a new game');
  assert.equal(await fresh.evaluate((key) => localStorage.getItem(key), WHATS_NEW_STORAGE_KEY), WHATS_NEW[0].id);
  await fresh.close();
});

/** A brand new game opens the free welcome pack first; its walkout covers the game until it is taken over. */
/** Takes over the walkout of the welcome pack (opened from the shop at the tutorial's shop step). */
async function closeWelcomePack(page: Page) {
  const reveal = page.locator('.star-reveal');
  await reveal.waitFor({ timeout: 10000 });
  const takeOver = reveal.getByRole('button', { name: /^Weiter/ });
  await takeOver.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('.star-reveal .star-walkout-dismiss')?.disabled, undefined, { timeout: 20000 });
  await takeOver.click();
  await reveal.waitFor({ state: 'detached', timeout: 10000 });
}

test('a new player gets the welcome window first (no walkout), then guided tasks that tick off; ending asks about the welcome pack', async () => {
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[1]]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript('globalThis.__name = (fn) => fn;');
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const intro = page.getByRole('dialog', { name: TUTORIAL_INTRO_PAGES[0].title });
    await intro.waitFor();
    assert.equal(await page.locator('.star-reveal').count(), 0, `${viewport.name}: no walkout on the first start`);
    assert.deepEqual(await layoutProblems(page), [], `${viewport.name}: welcome window layout`);
    for (const pageInfo of TUTORIAL_INTRO_PAGES.slice(1)) {
      await page.getByRole('dialog').getByRole('button', { name: 'Weiter' }).click();
      await page.getByRole('dialog', { name: pageInfo.title }).waitFor();
    }
    await page.getByRole('dialog').getByRole('button', { name: "Los geht's" }).click();
    const coach = page.getByRole('region', { name: 'Tutorial' });
    await coach.waitFor();
    assert.match(await coach.innerText(), /SCHRITT 1 \/ 5/);
    assert.deepEqual(await layoutProblems(page), [], `${viewport.name}: tutorial card layout`);
    const ball = page.getByRole('button', { name: 'Fussball anklicken' });
    await ball.scrollIntoViewIfNeeded();
    for (let i = 0; i < 50; i++) await ball.click({ delay: 5 });
    await page.waitForFunction(() => /SCHRITT 2 \/ 5/.test(document.querySelector('.tutorial-coach')?.textContent ?? ''), undefined, { timeout: 10000 });
    // The guided path: only the tab of the step is open, the shop (and its welcome pack) and the co-op mode wait for later.
    for (const locked of ['Spiele', 'Saison', 'Kader', 'Karriere', 'Packs & Album', 'Club & Mehr']) assert.equal(await page.getByRole('button', { name: locked, exact: true }).first().isDisabled(), true, `${viewport.name}: ${locked} is locked at step 2`);
    assert.equal(await page.getByRole('button', { name: 'Home', exact: true }).first().isDisabled(), false);
    assert.equal(await page.getByRole('button', { name: /^Koop Multiplayer/ }).isDisabled(), true, `${viewport.name}: co-op mode waits for the end`);
    assert.equal(await page.getByRole('button', { name: 'Willkommenspack öffnen' }).count(), 0, `${viewport.name}: invisible before its step`);
    // The progress survives a reload.
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'networkidle' });
    await coach.waitFor();
    assert.match(await coach.innerText(), /SCHRITT 2 \/ 5/);
    // Ending asks first: keeping on playing changes nothing, confirming gives the pack up for good.
    await coach.getByRole('button', { name: 'Tutorial beenden' }).click();
    const warning = page.getByRole('alertdialog');
    await warning.waitFor();
    assert.match(await warning.innerText(), /Wenn du das Tutorial jetzt abbrichst, erhältst du das Willkommenspack nicht\./);
    await warning.getByRole('button', { name: 'Weiter spielen' }).click();
    assert.equal(await coach.count(), 1, 'the tutorial goes on after "Weiter spielen"');
    await coach.getByRole('button', { name: 'Tutorial beenden' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Beenden' }).click();
    assert.equal(await coach.count(), 0);
    assert.equal(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), TUTORIAL_STORAGE_KEY))!).status, 'done');
    await page.waitForTimeout(2500);
    const endedSave = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!);
    assert.equal(endedSave.features.welcomePack, 'forfeited');
    assert.equal(endedSave.features.starXI.lineupIds.filter(Boolean).length, 11, `${viewport.name}: ending the tutorial early still leaves a full starting eleven`);
    assert.equal(await page.getByRole('button', { name: 'Kader', exact: true }).first().isDisabled(), false, `${viewport.name}: the lock is gone`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    assert.equal(await page.getByRole('region', { name: 'Tutorial' }).count(), 0, `${viewport.name}: ended stays ended`);
    // Club & Mehr starts it again; the forfeited pack does not come back.
    await openTab(page, 'Club & Mehr');
    await page.getByRole('button', { name: 'Tutorial erneut starten' }).click();
    await intro.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await intro.count(), 0, 'Escape skips the welcome window');
    await openTab(page, 'Packs & Album');
    assert.equal(await page.getByRole('button', { name: 'Willkommenspack öffnen' }).count(), 0, `${viewport.name}: forfeited for good`);
    assert.deepEqual(problems, []);
    await page.close();
  }
});

test('the welcome pack opens once from the shop at its tutorial step: one walkout, no odds, then the season match is the last step', async () => {
  const now = Date.now();
  const features = richFeatures(now);
  features.welcomePack = 'available';
  const { page, problems } = await openWithSave(VIEWPORTS[0], save(features, now));
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TUTORIAL_STORAGE_KEY, JSON.stringify({ status: 'active', done: ['clicks', 'upgrade', 'lineup'], visited: ['squad'] })] as [string, string]);
  await page.reload({ waitUntil: 'networkidle' });
  const coach = page.getByRole('region', { name: 'Tutorial' });
  await coach.waitFor();
  assert.match(await coach.innerText(), /SCHRITT 4 \/ 5/);
  await openTab(page, 'Packs & Album');
  const card = page.getByRole('article', { name: 'Willkommenspack' });
  await card.waitFor();
  assert.doesNotMatch(await card.innerText(), /Chance|Wahrscheinlichkeit|%/);
  assert.deepEqual(await layoutProblems(page), []);
  await card.getByRole('button', { name: 'Willkommenspack öffnen' }).click();
  await closeWelcomePack(page);
  await page.waitForFunction(() => /SCHRITT 5 \/ 5/.test(document.querySelector('.tutorial-coach')?.textContent ?? ''), undefined, { timeout: 10000 });
  assert.equal(await page.getByRole('article', { name: 'Willkommenspack' }).count(), 0, 'given once');
  await page.waitForTimeout(2500);
  assert.equal(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!).features.welcomePack, 'claimed');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  assert.equal(await page.getByRole('button', { name: 'Packs & Album', exact: true }).first().isDisabled(), true, 'the shop closes with its step, the pack is not offered again');
  assert.match(await page.getByRole('region', { name: 'Tutorial' }).innerText(), /SCHRITT 5 \/ 5/);
  assert.deepEqual(problems, []);
  await page.close();
});

test('the first starting eleven is built by the player through the real lineup actions; the guide follows the steps', async () => {
  const page = await browser.newPage({ viewport: VIEWPORTS[0] });
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  for (let i = 0; i < TUTORIAL_INTRO_PAGES.length - 1; i++) await page.getByRole('dialog').getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: "Los geht's" }).click();
  const coach = page.getByRole('region', { name: 'Tutorial' });
  const ball = page.getByRole('button', { name: 'Fussball anklicken' });
  for (let i = 0; i < 50; i++) await ball.click({ delay: 5 });
  await page.waitForFunction(() => /SCHRITT 2 \/ 5/.test(document.querySelector('.tutorial-coach')?.textContent ?? ''), undefined, { timeout: 10000 });
  // Step 2 asks for an upgrade; the guide moves on to the squad by itself afterwards.
  assert.match(await page.locator('.app-shell').getAttribute('data-tutorial-step') ?? '', /upgrade/);
  await page.locator('.shop-card').getByRole('button', { name: /Kaufen|kaufen/ }).first().click();
  await page.waitForFunction(() => /SCHRITT 3 \/ 5/.test(document.querySelector('.tutorial-coach')?.textContent ?? ''), undefined, { timeout: 10000 });
  assert.match(page.url(), /\/kader$/, 'the guide opens the squad tab');
  assert.match(await coach.innerText(), /0 \/ 11/, 'no place is filled for the new club');
  assert.equal(await page.getByRole('button', { name: 'Spiele', exact: true }).first().isDisabled(), true, 'Spiele waits for its step');
  assert.deepEqual(await layoutProblems(page), []);
  // Two places by hand: tap a place, then a fitting card.
  for (let place = 0; place < 2; place++) {
    await page.locator('[data-squad-area="lineup"]').nth(place).click();
    await page.locator('.starxi-reserve-list > div').filter({ hasText: /Auf [A-Z]+ einsetzen/ }).first().locator('button').first().click();
    await page.waitForFunction((count) => new RegExp(`${count} / 11`).test(document.querySelector('.tutorial-coach')?.textContent ?? ''), place + 1, { timeout: 10000 });
  }
  assert.match(await coach.innerText(), /2 \/ 11/);
  assert.match(await coach.innerText(), /SCHRITT 3 \/ 5/, 'two of eleven places do not finish the step');
  // The rest through the real "Beste Startelf" action (with its preview); the last place completes the step and the guide goes to the shop.
  await page.getByRole('button', { name: /Beste Startelf/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: /^Übernehmen/ }).click();
  await page.waitForFunction(() => /SCHRITT 4 \/ 5/.test(document.querySelector('.tutorial-coach')?.textContent ?? ''), undefined, { timeout: 15000 });
  assert.match(page.url(), /\/packs$/, 'the guide opens the shop for the welcome pack');
  await page.getByRole('article', { name: 'Willkommenspack' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Kader', exact: true }).first().isDisabled(), true, 'the squad closes again once its step is done');
  await page.waitForTimeout(2500);
  const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!);
  assert.equal(saved.features.starXI.lineupIds.filter(Boolean).length, 11);
  assert.deepEqual(problems, []);
  await page.close();
});

test('the standings: Pkt is the last column, every form box names its match on hover, focus and tap', async () => {
  const now = Date.now();
  const features = richFeatures(now);
  const ids = features.seasonMode.table.map((team) => team.id);
  features.seasonMode.results = [
    { matchday: 1, homeId: 'club', awayId: ids[1], homeScore: 2, awayScore: 1 },
    { matchday: 2, homeId: ids[2], awayId: 'club', homeScore: 0, awayScore: 3 },
    { matchday: 3, homeId: 'club', awayId: ids[3], homeScore: 1, awayScore: 1 },
  ];
  for (const viewport of [VIEWPORTS[0], { width: 768, height: 1024 }]) {
    const { page, problems } = await openWithSave(viewport, save(features, now));
    await openTab(page, 'Saison');
    const header = await page.locator('.season-hub-table thead th').allInnerTexts();
    assert.deepEqual(header.slice(-2), ['Form', 'Pkt'], `${viewport.width}: points last, form directly before`);
    const chips = page.locator('.season-form-chip');
    const tip = page.locator('.season-form-tip');
    await chips.first().hover();
    assert.equal(await tip.innerText(), `Spieltag 1 · Heim · ${features.club.name} 2:1 ${features.seasonMode.table[1].name}`);
    const shell = (await page.locator('.season-hub-table-shell').first().boundingBox())!;
    const box = (await tip.boundingBox())!;
    assert.ok(box.x >= shell.x - 1 && box.x + box.width <= shell.x + shell.width + 1, `${viewport.width}: the tip is not cut off`);
    await page.mouse.move(2, 2);
    assert.equal(await tip.count(), 0, 'it leaves with the mouse');
    await chips.nth(1).focus();
    assert.match(await tip.innerText(), /^Spieltag 2 · Auswärts · /);
    await page.keyboard.press('Escape');
    assert.equal(await tip.count(), 0, 'Escape closes it');
    await chips.nth(2).click();
    assert.match(await tip.innerText(), /^Spieltag 3 · Heim · /);
    await chips.nth(2).click();
    assert.equal(await tip.count(), 0, 'a second tap closes it');
    assert.deepEqual(problems, []);
    await page.close();
  }
});

test('an existing game never sees the tutorial', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[1], save(richFeatures(now), now));
  assert.equal(await page.getByRole('dialog', { name: TUTORIAL_INTRO_PAGES[0].title }).count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Tutorial' }).count(), 0);
  assert.equal(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), TUTORIAL_STORAGE_KEY))!).status, 'done');
  assert.deepEqual(problems, []);
  await page.close();
});

test('the album switch shows milestone ratings or the original ratings and remembers the choice', async () => {
  const now = Date.now();
  const f = richFeatures(now);
  const player = STAR_XI_PLAYERS.find((p) => p.id === f.starXI.lineupIds[0])!;
  const milestone = getPlayerMilestones(f.career, player).find((m) => m.bonus === 3)!;
  f.career.milestoneCards[player.id] = [milestone.id];
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[1]]) {
    const { page, problems } = await openWithSave(viewport, save(f, now));
    await openTab(page, 'Packs & Album');
    await page.getByRole('tab', { name: 'Sammelalbum' }).click();
    await page.getByLabel('Sammelalbum durchsuchen').fill(player.name);
    const card = page.locator('.career-album-card').filter({ hasText: player.name }).first();
    const toggle = page.getByRole('switch', { name: /Meilensteinboni/ });
    await toggle.waitFor();
    assert.equal(await toggle.isChecked(), true, `${viewport.name}: an account sees the milestone bonus by default`);
    assert.equal(await card.locator('b').first().innerText(), String(Math.min(100, player.rating + 3)));
    assert.deepEqual(await layoutProblems(page), [], `${viewport.name}: album with bonus`);
    await toggle.click();
    assert.equal(await card.locator('b').first().innerText(), String(player.rating));
    assert.equal(await card.locator('em').count(), 0);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), ALBUM_MILESTONES_STORAGE_KEY), 'off');
    assert.deepEqual(await layoutProblems(page), [], `${viewport.name}: album with original ratings`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await openTab(page, 'Packs & Album');
    await page.getByRole('tab', { name: 'Sammelalbum' }).click();
    assert.equal(await page.getByRole('switch', { name: /Meilensteinboni/ }).isChecked(), false, 'the choice is remembered');
    assert.deepEqual(problems, []);
    await page.close();
  }
});

test('"Kaderlücke schliessen" fills the free place with the best eleven and bench', async () => {
  const now = Date.now();
  const f = richFeatures(now);
  const required = f.starXI.lineupIds.filter(Boolean).length + f.starXI.benchIds.filter(Boolean).length;
  f.starXI.benchIds = f.starXI.benchIds.map((id, index) => index === 0 ? '' : id);
  f.transferSaga.vacancies = [{ area: 'bench', index: 0, requiredPlayers: required, createdAt: now }];
  const { page, problems } = await openWithSave(VIEWPORTS[0], save(f, now));
  await openTab(page, 'Spiele');
  const button = page.getByRole('button', { name: 'Kaderlücke schliessen' });
  await button.waitFor();
  assert.equal(await button.isEnabled(), true);
  await button.click();
  await page.waitForFunction(() => !document.querySelector('.cup-start.vacancy'), undefined, { timeout: 5000 });
  assert.equal(await page.getByRole('button', { name: 'Kaderlücke schliessen' }).count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

test('Prestige opens from the Hall of Fame despite an incomplete squad, cancels cleanly and resets after confirming', async () => {
  const now = Date.now();
  const f = richFeatures(now);
  const specials = ['star-goat-nicu', 'star-maetthu'];
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: [...specials, ...f.starXI.ownedIds] });
  f.career.collectedIds = [];
  f.seasonMode = { ...f.seasonMode, division: 15, highestDivision: 15, hallOfFame: true, prestigeCount: 0 };
  // An open place in the eleven, a suspended player and an open squad slot do not matter for Prestige.
  const removed = f.starXI.lineupIds[4];
  f.starXI.lineupIds = f.starXI.lineupIds.map((id, index) => index === 4 ? '' : id);
  f.cup.suspendedPlayerIds = [f.starXI.lineupIds[6]];
  f.transferSaga.vacancies = [{ area: 'lineup', index: 4, requiredPlayers: 23, createdAt: now }];
  for (const viewport of [VIEWPORTS[1], VIEWPORTS[0]]) {
    // Bought Club Office levels: Prestige sets every one of them back to 0.
    const { page, problems } = await openWithSave(viewport, JSON.stringify({ ...JSON.parse(save(f, now)), upgrades: { boots: 12, ballboy: 30, golden: 2 } }));
    const stored = async () => JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!) as { goals: number; upgrades: Record<string, number>; features: GameFeatures };
    await openTab(page, 'Spiele');
    const start = page.getByRole('button', { name: 'Prestige starten' });
    await start.waitFor();
    assert.equal(await start.isEnabled(), true, `${viewport.name}: Prestige is not greyed out`);
    await start.click();
    const dialog = page.getByRole('dialog', { name: /Prestige 1 starten/ });
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /\+20 % Tore/);
    assert.match(await dialog.innerText(), /GOAT Nicu/);
    assert.match(await dialog.innerText(), /44 Stufen → Stufe 0/);
    assert.deepEqual(await layoutProblems(page), [], `${viewport.name}: Prestige dialog`);
    // The strongest normal card is chosen already (Q71); cancelling changes nothing.
    assert.equal(await dialog.getByRole('radio', { checked: true }).count(), 1);
    assert.equal(await dialog.getByRole('button', { name: 'Prestige 1 starten' }).isEnabled(), true);
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await page.waitForTimeout(2600);
    assert.equal((await stored()).features.seasonMode.prestigeCount, 0);
    assert.ok((await stored()).goals > 1e12);
    if (viewport === VIEWPORTS[1]) { assert.deepEqual(problems, []); await page.close(); continue; }
    // Confirm with one chosen normal card.
    await start.click();
    const keep = f.starXI.lineupIds[0];
    const keepName = STAR_XI_PLAYERS.find((player) => player.id === keep)!.name;
    await dialog.getByRole('radio', { name: new RegExp(keepName) }).check();
    await dialog.getByRole('button', { name: 'Prestige 1 starten' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForTimeout(2600);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const after = await stored();
    assert.equal(after.features.seasonMode.prestigeCount, 1);
    assert.equal(after.features.seasonMode.division, 1);
    assert.ok(after.goals < 1e9, `goals reset (${after.goals})`);
    assert.deepEqual(after.upgrades, {}, 'every Club Office upgrade is back at level 0');
    const ownedSpecials = f.starXI.ownedIds.filter((id) => STAR_XI_PLAYERS.find((player) => player.id === id)?.isCustom);
    assert.ok(specials.every((id) => ownedSpecials.includes(id)));
    assert.deepEqual([...after.features.starXI.ownedIds].sort(), [...ownedSpecials, keep].sort());
    assert.match(await page.locator('.header-goals').innerText(), /Prestige 1 ·\s*\+20 % Tore/);
    // A card that left the squad is still in the album, marked as not in the squad.
    const removedName = STAR_XI_PLAYERS.find((player) => player.id === removed)!.name;
    await openTab(page, 'Packs & Album');
    await page.getByRole('tab', { name: 'Sammelalbum' }).click();
    await page.getByLabel('Sammelalbum durchsuchen').fill(removedName);
    const card = page.locator('.career-album-card').filter({ hasText: removedName }).first();
    assert.match(await card.innerText(), /GESAMMELT[\s\S]*Nicht im Kader/);
    assert.deepEqual(problems, []);
    await page.close();
  }
});

test('winning the league on the last matchday shows the trophy celebration', async () => {
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[1]]) {
    const now = Date.now();
    const f = richFeatures(now);
    // Last matchday, the club far ahead: whatever the score, it ends the season first.
    f.seasonMode = { ...f.seasonMode, matchday: SEASON_MODE_MATCHES_PER_SEASON - 1, table: f.seasonMode.table.map((team) => ({ ...team, played: SEASON_MODE_MATCHES_PER_SEASON - 1, points: team.id === 'club' ? 99 : 0 })) };
    // The earlier matchdays of the season are in the history, as in a real season.
    f.seasonMode.history = Array.from({ length: SEASON_MODE_MATCHES_PER_SEASON - 1 }, (_, index) => ({ id: `season-match-${now - 1e6 + index}-${index + 1}`, division: f.seasonMode.division, matchday: index + 1, opponent: 'Testgegner', opponentRating: 70, clubScore: 2, opponentScore: 0, outcome: 'win' as const, completedSeason: false, seasonOutcome: null, createdAt: now - 1e6 + index }));
    // The match is played almost to the end; the browser plays the last seconds and records the final table.
    f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
    prepareCareerMatch(f);
    for (let i = 0; i < 2000 && f.cup.active && f.cup.matchEndsAt - f.cup.lastTickAt > 3000; i++) {
      if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
      f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt - 2500, f.cup.lastTickAt + 20000), Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
    }
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    const shift = now - f.cup.lastTickAt;
    f.cup = { ...f.cup, matchStartedAt: f.cup.matchStartedAt + shift, matchEndsAt: f.cup.matchEndsAt + shift, lastTickAt: f.cup.lastTickAt + shift, restartAt: f.cup.restartAt === undefined ? undefined : f.cup.restartAt + shift, timedPause: undefined };
    const { page, problems } = await openWithSave(viewport, save(f, now));
    const celebration = page.getByRole('dialog', { name: /holt den Titel/ });
    await celebration.waitFor({ timeout: 20000 });
    await page.waitForTimeout(2200);
    assert.match(await celebration.innerText(), /MEISTER/);
    assert.deepEqual(await layoutProblems(page), [], `${viewport.name}: trophy layout`);
    await celebration.getByRole('button', { name: 'Weiter' }).click();
    assert.equal(await celebration.count(), 0);
    // A goal in the last seconds vibrates; Chrome refuses that before the first tap, which a real player has made.
    assert.deepEqual(problems.filter((problem) => !problem.includes('navigator.vibrate')), []);
    await page.close();
  }
});

test('while the team travels the match choice is hidden; it comes back without a journey', async () => {
  const now = Date.now();
  const f = richFeatures(now);
  const fixture = [fixtureFor(f, 'season'), ...TOURNAMENTS.map((t) => fixtureFor(f, 'tournament', t.id))].find((candidate) => candidate.away)!;
  f.travel.journey = createJourney(fixture, now, () => 0.5, f);
  const { page, problems } = await openWithSave(VIEWPORTS[1], save(f, now));
  await openTab(page, 'Spiele');
  await page.getByRole('region', { name: 'Auswärtsreise' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Saisonspiele und Turniere' }).count(), 0, 'no match choice while travelling');
  // The server keeps solo journeys in the database, which this test server does not have.
  assert.deepEqual(problems.filter((problem) => !problem.endsWith('/api/travel')), []);
  await page.close();
  const home = await openWithSave(VIEWPORTS[1], save(richFeatures(now), now));
  await openTab(home.page, 'Spiele');
  await home.page.getByRole('region', { name: 'Saisonspiele und Turniere' }).waitFor();
  await home.page.close();
});

test('the layout checker itself reports overlapping text, unreadable text and horizontal overflow', async () => {
  const page = await browser.newPage({ viewport: { width: 400, height: 600 } });
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  await page.setContent(`<body style="margin:0;background:#fff">
    <p style="position:absolute;top:20px;left:10px;margin:0;font-size:20px">Erster Text</p>
    <p style="position:absolute;top:22px;left:14px;margin:0;font-size:20px">Zweiter Text</p>
    <p style="margin:120px 0 0;color:#eeeeee">Kaum lesbar</p>
    <div style="width:900px">Zu breit</div></body>`);
  const found = (await layoutProblems(page)).join(' | ');
  assert.match(found, /overlap: "Erster Text"/);
  assert.match(found, /low contrast .*Kaum lesbar/);
  assert.match(found, /horizontal overflow/);
  await page.close();
});

test('the offline page also shows when the host redirects /offline.html (as the live host does), and the worker stores a plain copy', async () => {
  // A stand in for the live host: /offline.html answers 307 to /offline, which serves the offline page.
  const sockets = new Set<Socket>();
  const proxyPort = PORT + 1;
  const proxy = createServer((req, res) => {
    if (req.url === '/offline.html') { res.writeHead(307, { location: '/offline' }); res.end(); return; }
    const path = req.url === '/offline' ? '/offline.html' : req.url ?? '/';
    const upstream = httpRequest({ host: '127.0.0.1', port: PORT, path, method: req.method, headers: req.headers }, (answer) => { res.writeHead(answer.statusCode ?? 200, answer.headers); answer.pipe(res); });
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  proxy.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise<void>((resolve) => proxy.listen(proxyPort, '127.0.0.1', resolve));
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${proxyPort}/`, { waitUntil: 'domcontentloaded' });
    const stored = await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const name = (await caches.keys()).find((key) => key.includes('offline'));
      const response = name ? await (await caches.open(name)).match('/offline.html') : undefined;
      return { cached: Boolean(response), redirected: response?.redirected, status: response?.status };
    });
    assert.deepEqual(stored, { cached: true, redirected: false, status: 200 }, 'a redirected response cannot answer a navigation, so the plain copy is stored');
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true, 'the worker controls the page');
    // The host stops answering: a navigation now gets the offline page from the worker.
    await new Promise<void>((resolve) => { proxy.close(() => resolve()); for (const socket of sockets) socket.destroy(); });
    await page.goto(`http://127.0.0.1:${proxyPort}/kader`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    assert.equal(await page.title(), 'Goal Clicker · Keine Verbindung');
  } finally {
    await context.close();
    if (proxy.listening) await new Promise<void>((resolve) => { proxy.close(() => resolve()); for (const socket of sockets) socket.destroy(); });
  }
});
