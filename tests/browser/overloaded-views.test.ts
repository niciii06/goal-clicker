// Browser acceptance of «Zwei weitere überladene Spielansichten optisch aufräumen» on the production build: the paused match with
// the substitution editor open (Spiele) and the save card above the club identity (Club & Mehr) on phone, iPad and desktop, light
// and dark: nothing overflows sideways, the editor sits clearly below the tab strip with a visible heading, hint and close
// button, the sections keep their distance and no text spills out of its card. Screenshots go to SHOTS_DIR when set.
// Run: OVERLOADED_PORT=8830 node --import tsx --test --test-concurrency=1 tests/browser/overloaded-views.test.ts (after npm run build).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { STAR_XI_PLAYERS, advanceCupMatch, beginSeasonCupMatch, getStarXISelection, initialGameFeatures, normalizeGameFeatures, resumeCupMatch, setBestStarXI } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { emptyPlayerStats, prepareCareerMatch } from '../../app/career-data.ts';
import { createInteractiveMatch } from '../../app/interactive-match.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.OVERLOADED_PORT ?? 8830);
const BASE = `http://127.0.0.1:${PORT}`;
const SAVE_KEY = 'goalClickerSiteSaveV3';
let server: ChildProcess | undefined;
let browser: Browser;
let baseSave: Record<string, unknown>;

before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Run npm run build first.');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { stdio: 'ignore', detached: true, env: { ...process.env, PORT: String(PORT) } });
  const until = Date.now() + 120000;
  while (Date.now() < until) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((resolve) => setTimeout(resolve, 500)); }
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

const saveOf = (features: GameFeatures, now: number) => JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(features), lastSaved: now });

// ---- a knockout match that is drawn after 90 minutes, played like a player, in-process
function rich(seed: number) {
  const f = initialGameFeatures(1000000 + seed);
  for (const p of STAR_XI_PLAYERS.filter((player) => player.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
  f.starXI = setBestStarXI({ ...f.starXI, formationId: '433' as GameFeatures['starXI']['formationId'], ownedIds: STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
  f.nextEventAt = Date.now() + 1e9; f.nextVarAt = Date.now() + 1e9; f.transferSaga.nextAt = Date.now() + 1e9;
  return f;
}
const play = (f: GameFeatures, now: number) => { f.cup = advanceCupMatch(f.cup, 85, now, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup; };
function drawnKnockout() {
  for (let seed = 900; seed < 1300; seed++) {
    const f = rich(seed);
    f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
    prepareCareerMatch(f);
    f.cup.mode = 'tournament' as typeof f.cup.mode;
    f.cup.tournamentId = 'stadium' as typeof f.cup.tournamentId;
    f.cup.regularDurationMs = 300000;
    f.cup.matchEndsAt = f.cup.matchStartedAt + 300000;
    f.cup.opponentRating = 99;
    f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
    let now = f.cup.matchStartedAt;
    for (let i = 0; i < 3000 && f.cup.active && f.cup.phase === 'regular'; i++) {
      if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
      now = Math.max(now, f.cup.lastTickAt) + 1000;
      play(f, now);
    }
    if (f.cup.phase === 'extra-time') return f;
  }
  throw new Error('no drawn knockout match found');
}

const VIEWPORTS = [{ name: 'phone', width: 390, height: 844, touch: true }, { name: 'iPad portrait', width: 820, height: 1180, touch: true }, { name: 'desktop', width: 1280, height: 900, touch: false }];
const SHOTS = process.env.SHOTS_DIR;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

async function openScheme(viewport: (typeof VIEWPORTS)[number], scheme: 'light' | 'dark', saveJson: string, path = '/spiele') {
  const context = await browser.newContext({ viewport, hasTouch: viewport.touch, isMobile: viewport.touch, colorScheme: scheme, locale: 'de-CH' });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, saveJson, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { page, context, problems };
}

for (const viewport of VIEWPORTS) for (const scheme of ['light', 'dark'] as const) {
  test(`paused match with the substitution editor, ${viewport.name} ${scheme}: clear order, nothing sideways, nothing covered`, async () => {
    const f = drawnKnockout();
    const { page, context, problems } = await openScheme(viewport, scheme, saveOf(f, Date.now()));
    await page.locator('.gc-halftime-actions button').first().click();
    const panel = page.locator('.gc-sub-panel').first();
    await panel.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/paused-${viewport.name.replace(' ', '-')}-${scheme}.png`, fullPage: false });
    const m = await page.evaluate(() => {
      const box = (el: Element | null) => { const r = el?.getBoundingClientRect(); return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height } : null; };
      const panel = document.querySelector('.gc-sub-panel')!;
      const heading = panel.querySelector('h1, h2, h3, h4, strong');
      const tabs = document.querySelector('.feature-tabs, .gc-viewer-tabs, [role="tablist"]');
      const buttons = [...panel.querySelectorAll('button')].filter((b) => (b as HTMLElement).offsetParent).map((b) => box(b)!);
      const wide = [...panel.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').length;
      const clipped = [...panel.querySelectorAll('p, small, strong, span, h3')].filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden' && getComputedStyle(el).textOverflow !== 'ellipsis').length;
      const bar = document.querySelector('.topbar');
      let cover = '';
      if (bar && bar.getBoundingClientRect().bottom > 2) { const r = bar.getBoundingClientRect(); const hit = document.elementFromPoint(innerWidth / 2, Math.max(1, r.top) + Math.min(10, r.height / 2)); if (hit && !bar.contains(hit)) { const chain: string[] = []; for (let n: Element | null = hit; n && chain.length < 6; n = n.parentElement) chain.push(`${n.tagName.toLowerCase()}.${(n.className || '').toString().split(' ')[0]}[z=${getComputedStyle(n).zIndex}]`); cover = chain.join(' < '); } }
      return { cover, overflow: document.documentElement.scrollWidth - innerWidth, panel: box(panel), heading: box(heading), tabs: box(tabs), buttons, wide, clipped, w: innerWidth };
    });
    assert.equal(m.cover, '', 'the sticky header is never covered by the match view');
    assert.ok(m.overflow <= 0, `no sideways scroll (${m.overflow})`);
    assert.equal(m.wide, 0, 'nothing in the editor sticks out of the screen');
    assert.equal(m.clipped, 0, 'no text is cut off without an ellipsis');
    assert.ok(m.heading && m.heading.h > 0 && m.heading.left >= 0 && m.heading.right <= m.w, 'the editor heading is visible inside the screen');
    if (m.tabs) assert.ok(m.panel!.top >= m.tabs.bottom - 1 || m.panel!.bottom <= m.tabs.top + 1, 'the editor does not cover the tab strip');
    assert.ok(m.buttons.length >= 2, 'close and confirm are there');
    if (viewport.touch) for (const b of m.buttons) assert.ok(b.h >= 44 || b.w >= 44 && b.h >= 36, `touch target ${Math.round(b.w)}x${Math.round(b.h)}`);
    assert.deepEqual(problems, []);
    await context.close();
  });
  test(`Club & Mehr, ${viewport.name} ${scheme}: the save card has its own space above the club identity and keeps its text inside`, async () => {
    const f = rich(5);
    const { page, context, problems } = await openScheme(viewport, scheme, saveOf(f, Date.now()), '/');
    await page.getByRole('button', { name: 'Club & Mehr', exact: true }).first().click();
    await page.waitForTimeout(800);
    const card = page.locator('section.tutorial-restart').last();
    await card.scrollIntoViewIfNeeded();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/club-${viewport.name.replace(' ', '-')}-${scheme}.png`, fullPage: false });
    const m = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('section.tutorial-restart')];
      const save = cards.at(-1)!, identity = document.querySelector('.club-identity')!;
      const sb = save.getBoundingClientRect(), ib = identity.getBoundingClientRect();
      const inside = [...save.querySelectorAll('p, strong, small, button')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > sb.right + 1 || r.left < sb.left - 1; }).length;
      const small = [...save.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
      return { gap: ib.top - sb.bottom, inside, overflow: document.documentElement.scrollWidth - innerWidth, small, order: sb.top < ib.top };
    });
    assert.ok(m.order, 'the save card comes before the club identity');
    assert.ok(m.gap >= 12, `at least 12 px between the sections (${Math.round(m.gap)})`);
    assert.equal(m.inside, 0, 'no text or button leaves the save card');
    assert.ok(m.overflow <= 0, 'no sideways scroll');
    if (viewport.touch) for (const b of m.small) assert.ok(b.h >= 44, `button height ${Math.round(b.h)} is at least 44 pt`);
    assert.deepEqual(problems, []);
    await context.close();
  });
}
