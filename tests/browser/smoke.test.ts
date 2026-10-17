// Browser smoke test against the production build (dist) served by wrangler dev.
// Run with: npm run test:browser (CI runs it after npm test, which builds dist).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { advanceCupMatch, beginSeasonCupMatch, getStarXISelection, normalizeGameFeatures, resumeCupMatch, setBestStarXI, STAR_XI_PLAYERS } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { prepareCareerMatch } from '../../app/career-data.ts';

const PORT = Number(process.env.SMOKE_PORT ?? 8799);
const BASE = `http://localhost:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }] as const;
const TABS = ['Home', 'Spiele', 'Kader', 'Karriere', 'Packs & Album', 'Club & Mehr'];
// The Geist font files point to a path that only exists on Sites (known, see docs); everything else must load.
const IGNORED_URL = /\/\.vinext\/fonts\//;

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
  assert.ok(existsSync('dist/server/index.js'), 'Run npm run build first (npm test builds dist).');
  server = spawn('npx', ['wrangler', 'dev', '--config', 'wrangler.external.json', '--port', String(PORT), '--ip', '127.0.0.1'], { stdio: 'ignore', env: { ...process.env, WRANGLER_LOG_PATH: '.wrangler/wrangler.log', WRANGLER_SEND_METRICS: 'false' }, detached: true });
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

async function openWithSave(viewport: { width: number; height: number }, saveJson: string) {
  const page = await browser.newPage({ viewport });
  // tsx keeps function names with a __name helper; functions passed to page.evaluate need it in the browser too.
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400 && !IGNORED_URL.test(response.url())) problems.push(`${response.status()} ${response.url()}`); });
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(`console: ${message.text()}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [SAVE_KEY, saveJson]);
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
    const parse = (c: string) => (c.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
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

for (const viewport of VIEWPORTS) {
  test(`${viewport.name}: every tab loads without errors, overflow, overlapping or unreadable text`, async () => {
    const now = Date.now();
    const { page, problems } = await openWithSave(viewport, save(richFeatures(now), now));
    for (const tab of TABS) {
      assert.ok(await openTab(page, tab), `tab ${tab} missing`);
      const found = await layoutProblems(page);
      assert.deepEqual(found, [], `${viewport.name} / ${tab}`);
    }
    assert.deepEqual(problems, []);
    await page.close();
  });
}

test('click combo reaches x2 and the daily reward can be claimed once', async () => {
  const now = Date.now();
  const { page, problems } = await openWithSave(VIEWPORTS[0], save(richFeatures(now), now));
  const ball = await page.getByRole('button', { name: 'Fussball anklicken' }).boundingBox();
  for (let i = 0; i < 18; i++) await page.mouse.click(ball!.x + ball!.width / 2, ball!.y + ball!.height / 2);
  assert.match(await page.locator('.combo-label').innerText(), /COMBO x2|COMBO x3/);
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
    assert.ok(await openTab(page, 'Spiele · LIVE'), 'live tab missing');
    const canvas = page.locator('canvas.gc-viewer-pitch').first();
    await canvas.waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    // A blank canvas compresses to a few hundred bytes; pitch, players and stands need far more.
    assert.ok((await canvas.screenshot()).length > 15000, 'canvas looks empty');
    for (const tab of ['Live Ticker', 'Statistik', '2D', 'Wechsel / Taktik']) {
      await page.getByRole('button', { name: tab, exact: true }).first().click();
      await page.waitForTimeout(500);
      assert.deepEqual((await layoutProblems(page)).filter((p) => !p.startsWith('overlap')), [], `${viewport.name} / ${tab}`);
    }
    assert.deepEqual(problems, []);
    await page.close();
  }
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
