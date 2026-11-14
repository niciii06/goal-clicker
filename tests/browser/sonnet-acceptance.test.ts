// Function acceptance of the Sonnet tickets on the shared candidate, in German and English, phone, tablet and desktop widths:
// season table (form before Pkt, form boxes and tooltips also on a phone), card reveal timing, best XI with a pinned starter,
// promotion and relegation of AI clubs. Language neutral: texts are not compared here (translation belongs to its own ticket).
// Run: ACCEPT_PORT=8823 node --import tsx --test --test-concurrency=1 tests/browser/sonnet-acceptance.test.ts (after npm run build).
// Browser smoke test against the production build served by next start.
// Run with: npm run test:browser (CI runs it after npm test, which builds .next).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { SEASON_MODE_MATCHES_PER_SEASON, normalizeGameFeatures, normalizeSeasonModeState, recordSeasonModeMatch, setBestStarXI, STAR_XI_PLAYERS } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';
import { LOCALE_STORAGE_KEY } from '../../app/i18n/locales.ts';

const PORT = Number(process.env.ACCEPT_PORT ?? 8823);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';

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
  const page = await browser.newPage({ locale: 'de-CH' });
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


type Lang = 'de' | 'en';
async function openIn(lang: Lang, viewport: { width: number; height: number }, saveJson: string, touch = false) {
  const page = await browser.newPage({ viewport, locale: lang === 'en' ? 'en-US' : 'de-CH', ...(touch ? { hasTouch: true, isMobile: true } : {}) });
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) problems.push(`console: ${message.text()}`); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen, localeKey, locale]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); localStorage.setItem(localeKey, locale); }, [SAVE_KEY, saveJson, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id, LOCALE_STORAGE_KEY, lang]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { page, problems };
}
const gotoTab = async (page: Page, path: string) => { await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900); };
const SEASON_VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900, touch: false }, { name: 'tablet', width: 768, height: 1024, touch: false }, { name: 'phone', width: 390, height: 844, touch: true }];

for (const lang of ['de', 'en'] as const) for (const viewport of SEASON_VIEWPORTS) {
  test(`season table ${lang} ${viewport.name}: form before Pkt (phone: under the club name), every visible form box names its match on hover, focus or tap`, async () => {
    const now = Date.now();
    const features = richFeatures(now);
    const ids = features.seasonMode.table.map((team) => team.id);
    features.seasonMode.results = [
      { matchday: 1, homeId: 'club', awayId: ids[1], homeScore: 2, awayScore: 1 },
      { matchday: 2, homeId: ids[2], awayId: 'club', homeScore: 0, awayScore: 3 },
      { matchday: 3, homeId: 'club', awayId: ids[3], homeScore: 1, awayScore: 1 },
    ];
    const { page, problems } = await openIn(lang, viewport, save(features, now), viewport.touch);
    await gotoTab(page, '/saison');
    const heads = page.locator('.season-hub-table thead th');
    const count = await heads.count();
    assert.equal(count, 10, 'ten columns: # Club Sp S U N Tore +/- Form Pkt');
    assert.equal(await heads.nth(count - 2).getAttribute('class'), 'season-form-head', 'form is the column right before the points');
    if (!viewport.touch) assert.equal(await heads.nth(count - 2).isVisible(), true, 'the form column is visible');
    // The boxes of the club's row: visible ones only (a phone shows the copy under the club name, wider screens the column).
    const chips = page.locator('tr.club .season-form-chip:visible');
    assert.equal(await chips.count(), 3, 'three played matches, three visible boxes');
    const letters = await chips.allInnerTexts();
    assert.deepEqual(letters, ['S', 'S', 'U'], 'order, letters and results unchanged (win, win, draw)');
    const tip = page.locator('.season-form-tip');
    const opponent = features.seasonMode.table[1].name;
    if (viewport.touch) await chips.first().tap(); else await chips.first().hover();
    const first = await tip.innerText();
    assert.ok(first.includes(' 2:1 ') && first.includes(opponent) && first.includes(features.club.name), `the tip names result and both clubs: "${first}"`);
    const shell = (await page.locator('.season-hub-table-shell').first().boundingBox())!;
    const box = (await tip.boundingBox())!;
    assert.ok(box.x >= shell.x - 1 && box.x + box.width <= shell.x + shell.width + 1, 'the tip stays inside the table area');
    const target = (await chips.first().boundingBox())!;
    assert.ok(target.width >= 20 && target.height >= 20, `a box is big enough to hit (${Math.round(target.width)}x${Math.round(target.height)})`);
    if (viewport.touch) await chips.first().tap(); else await page.mouse.move(2, 2);
    assert.equal(await tip.count(), 0, 'it closes (leaving the box, or a second tap)');
    await chips.nth(1).focus();
    assert.ok((await tip.innerText()).includes(features.seasonMode.table[2].name), 'keyboard focus shows the second match');
    await page.keyboard.press('Escape');
    assert.equal(await tip.count(), 0, 'Escape closes the tip');
    // Points stay the last column and visible, and the table does not scroll the page sideways.
    assert.equal(await page.locator('tr.club td:last-child b').isVisible(), true);
    assert.deepEqual(await layoutProblems(page), [], `${lang} ${viewport.name}: no overflow, overlap or unreadable text`);
    assert.deepEqual(problems, []);
    await page.close();
  });
}

for (const lang of ['de', 'en'] as const) {
  test(`card reveal ${lang}: no skip button, type and description stay empty while the animation runs and appear after it`, async () => {
    const now = Date.now();
    const features = richFeatures(now);
    features.seasonMode.highestDivision = 15;
    const { page, problems } = await openIn(lang, { width: 390, height: 844 }, save(features, now), true);
    await page.addInitScript('Math.random = () => 0.7;'); // a roll in the rare band (80 to 85) of the Elite pack
    await gotoTab(page, '/packs');
    await page.locator('article.star-pack-card', { hasText: 'Elite' }).first().locator('button.feature-buy-button').click();
    const dialog = page.locator('.star-reveal');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.getByRole('button', { name: /Überspringen|Skip/i }).count(), 0, 'no skip button for any card');
    const copy = dialog.locator('.star-walkout-copy, .star-reveal-walkout-label');
    assert.equal((await copy.allInnerTexts()).map((text) => text.replace(/ /g, '').trim()).join(''), '', 'the tier label and the description stay empty while it runs');
    const dismiss = dialog.locator('button.star-walkout-dismiss, button.event-takeover-dismiss').first();
    assert.equal(await dismiss.isDisabled(), true, 'nothing to press while it runs');
    await page.waitForFunction(() => { const button = document.querySelector('.star-reveal button.star-walkout-dismiss, .star-reveal button.event-takeover-dismiss') as HTMLButtonElement | null; return Boolean(button && !button.disabled); }, undefined, { timeout: 30000 });
    assert.notEqual((await copy.allInnerTexts()).map((text) => text.replace(/ /g, '').trim()).join(''), '', 'after the animation the type and the description are there');
    assert.deepEqual(problems, []);
    await page.close();
  });
}

for (const lang of ['de', 'en'] as const) {
  test(`best XI ${lang}: a pinned starter shows its chip, is saved, and stays in the eleven after the best XI`, async () => {
    const now = Date.now();
    const features = richFeatures(now);
    const { page, problems } = await openIn(lang, { width: 1280, height: 900 }, save(features, now));
    await gotoTab(page, '/kader');
    const weakest = features.starXI.lineupIds.filter(Boolean).map((id) => STAR_XI_PLAYERS.find((player) => player.id === id)!).sort((a, b) => a.rating - b.rating)[0];
    await page.getByText(weakest.name, { exact: false }).first().click();
    const pin = page.locator('.starxi-pin-button');
    assert.equal(await pin.isEnabled(), true, 'a chosen starter can be pinned');
    await pin.click();
    await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key)!).features.starXI.pinnedPlayerIds?.includes(id), [SAVE_KEY, weakest.id], { timeout: 15000 });
    assert.equal(await page.locator('.starxi-pin-chip').count(), 1, 'one chip on the pinned starter');
    assert.equal(await pin.getAttribute('aria-pressed'), 'true');
    // The best eleven keeps the pinned player although he is the weakest.
    await page.locator('button.starxi-best-button').click();
    await page.waitForTimeout(600);
    const apply = page.locator('.confirm-dialog button.mode-primary, .account-dialog button.mode-primary').first();
    if (await apply.count()) await apply.click();
    await page.waitForTimeout(1000);
    const lineup = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).features.starXI.lineupIds, SAVE_KEY);
    assert.ok(lineup.includes(weakest.id), 'the pinned weakest starter is still in the eleven');
    assert.deepEqual(problems, []);
    await page.close();
  });
}

for (const viewport of [SEASON_VIEWPORTS[0], SEASON_VIEWPORTS[2]]) {
  test(`AI promotion and relegation ${viewport.name}: one place up and one down per boundary, the list shows 14 and 14, legacy saves load`, async () => {
    const now = Date.now();
    let state = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, 'FC Goal');
    let seed = 7;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let day = 0; day < SEASON_MODE_MATCHES_PER_SEASON; day++) state = recordSeasonModeMatch(state, day < 9 ? 2 : 0, day < 9 ? 1 : 3, 'FC Goal', now + day, random).state;
    assert.equal(state.lastAiMoves?.length, 28);
    const features = richFeatures(now);
    features.seasonMode = state;
    const { page, problems } = await openIn('de', viewport, save(features, now), viewport.touch);
    await gotoTab(page, '/saison');
    const own = page.locator('.season-hub-table').first(); // the running table; the finished one of last season is folded below it
    assert.equal(await own.locator('tbody tr').count(), 6, 'six clubs in the own table');
    assert.equal(await own.locator('tbody tr.promotion').count(), 1, 'exactly one promotion place');
    assert.equal(await own.locator('tbody tr.relegation').count(), 1, 'exactly one relegation place');
    const list = page.locator('details.season-ai-moves');
    assert.equal(await list.count(), 1, 'the list of this season\'s moves is there after the season');
    await list.locator('summary').click();
    assert.equal(await page.locator('.season-ai-moves-grid li').count(), 28, '14 up and 14 down, the own club included');
    assert.deepEqual(await layoutProblems(page), []);
    assert.deepEqual(problems, []);
    await page.close();
    // A save from before the leagues moved has no assignment: five opponents, no list, nothing breaks.
    const legacy = richFeatures(now);
    legacy.seasonMode = normalizeSeasonModeState({ division: 5, highestDivision: 5 }, 'FC Goal');
    const old = await openIn('de', viewport, save(legacy, now), viewport.touch);
    await gotoTab(old.page, '/saison');
    assert.equal(await old.page.locator('.season-hub-table').first().locator('tbody tr').count(), 6);
    assert.equal(await old.page.locator('details.season-ai-moves').count(), 0);
    assert.deepEqual(old.problems, []);
    await old.page.close();
  });
}
