// Isolated browser proof (run by hand after npm run build, not part of npm run test:browser):
//   node --import tsx --test --test-concurrency=1 tests/browser/match-ticker-scoreboard.test.ts
// 1) The scoreboard of the interactive match keeps its height for 0:0, 1:0, 4:0, 0:5 and 5:5 (also with very long team and scorer
//    names) and both team names stay on one line. 2) The live ticker shows the newest event first, keeps the source order of the
//    events (equal minutes included), starts at the newest when it is opened, keeps the reading position when new events arrive
//    and adds every new event exactly once (one announcement). Local isolated saves only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { advanceCupMatch, beginSeasonCupMatch, getStarXISelection, initialGameFeatures, normalizeGameFeatures, resumeCupMatch, setBestStarXI, STAR_XI_PLAYERS } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { emptyPlayerStats, prepareCareerMatch } from '../../app/career-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { getViewerEvents } from '../../app/match-visual-frame.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.TICKER_PORT ?? 8806), BASE = `http://127.0.0.1:${PORT}`, SAVE_KEY = 'goalClickerSiteSaveV3';
let server: ChildProcess | undefined, browser: Browser, baseSave: Record<string, unknown> & { features: GameFeatures };
before(async () => {
  assert.ok(existsSync('.next/BUILD_ID'), 'Run npm run build first.');
  server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT), '-H', '127.0.0.1'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 120; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage(); await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction((key) => Boolean(localStorage.getItem(key)), SAVE_KEY, { timeout: 30000 });
  baseSave = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY))!); await page.close();
});
after(async () => { await browser?.close(); if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* gone */ } } });

/** A match in its second half: running, or paused for a substitution (nothing moves while the page is measured). */
function match(paused: boolean, until = 1500, agoMs = 120000) {
  const f = initialGameFeatures(1000011);
  for (const p of STAR_XI_PLAYERS.filter((player) => player.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
  f.starXI = setBestStarXI({ ...f.starXI, formationId: '433' as GameFeatures['starXI']['formationId'], ownedIds: STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
  f.nextEventAt = Date.now() + 1e9; f.nextVarAt = Date.now() + 1e9; f.transferSaga.nextAt = Date.now() + 1e9;
  const start = Date.now() - agoMs;
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, start, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  let now = start;
  for (let i = 0; i < 60 && f.cup.active && f.cup.simulation!.time < until; i++) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    now = Math.max(now, f.cup.lastTickAt) + 3000;
    f.cup = advanceCupMatch(f.cup, 85, now, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
  }
  if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
  if (paused) { f.cup.matchPaused = true; f.cup.simulation!.status = 'editing'; f.cup.simulation!.buffer = []; f.cup.simulation!.pauseRequested = false; }
  return f;
}
const NAMES = ['Zinedine Zidané', 'Franco Baresio', 'Gabriel Batistutá', 'Paolo Maldiny', 'Johan Cruyffo', 'Ferenc Puskáz', 'Garrincho', 'Di Santo'];
const LONG = 'Alexandros Konstantinopoulos-Papadimitriou von Hohenzollern-Sigmaringen';
/** Exactly this score, the goals of both sides spread over the first half; the real goals of the fixture are replaced. */
function withScore(f: GameFeatures, home: number, away: number, long = false) {
  const base = Date.now() - 600000; let h = 0, a = 0;
  const sides = [...Array(home).fill('home'), ...Array(away).fill('away')] as ('home' | 'away')[];
  sides.sort((x, y) => (x === y ? 0 : (sides.indexOf(x) % 2) - (sides.indexOf(y) % 2)));
  f.cup.matchEvents = sides.map((side, i) => { if (side === 'home') h++; else a++; return { id: `goal-${String(i).padStart(3, '0')}`, side, scorerId: null, scorer: long ? `${LONG} ${i + 1}` : NAMES[i % NAMES.length], minute: 3 + i * 4, createdAt: base + i * 1000, homeScore: h, awayScore: a, ratingImpacts: {} } as GameFeatures['cup']['matchEvents'][number]; });
  f.cup.homeScore = home; f.cup.awayScore = away;
  if (long) { f.cup.opponent = 'FC Arbeitszeitbetrug Rapperswil-Jona Unterhaltungsverein'; f.club.name = 'Fussballclub Grosse Grümpelturnier-Meister der Unterhaltung'; }
  return f;
}
async function open(width: number, height: number, features: GameFeatures, view: 'pitch' | 'ticker' = 'pitch') {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'de-CH', ...(width < 900 ? { hasTouch: true, isMobile: true } : {}) });
  const page = await context.newPage(); await page.addInitScript('globalThis.__name = (fn) => fn;');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen, viewKey, viewValue]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); localStorage.setItem(viewKey, viewValue); }, [SAVE_KEY, JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(features), lastSaved: Date.now() }), WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id, 'goal-clicker-interactive-view', view]);
  await page.goto(`${BASE}/spiele`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  return { context, page };
}
const SCOREBOARD = `(() => { const sb = document.querySelector('.gc-interactive-match .gc-viewer-scoreboard'); if (!sb) return null; const r = sb.getBoundingClientRect(); const names = [...sb.querySelectorAll('strong')].map((e) => Math.round(e.getBoundingClientRect().top * 10) / 10); const labels = [...sb.querySelectorAll('small')].filter((e) => /^(HEIM|AUSWÄRTS)$/.test(e.textContent || '')).map((e) => Math.round(e.getBoundingClientRect().top * 10) / 10); const next = sb.nextElementSibling ? Math.round((sb.nextElementSibling.getBoundingClientRect().top - r.top) * 10) / 10 : -1; const zones = [...sb.querySelectorAll('.gc-score-scorers')].map((z) => ({ h: Math.round(z.getBoundingClientRect().height * 10) / 10, text: (z.textContent || '').replace(/\\s+/g, ' ').trim(), spans: [...z.children].map((c) => (c.textContent || '').trim()), scrolls: z.scrollHeight > z.clientHeight + 1 })); return { height: Math.round(r.height * 10) / 10, names, labels, next, zones, overflow: document.documentElement.scrollWidth - innerWidth }; })()`;

const SCORES: [number, number, boolean][] = [[0, 0, false], [1, 0, false], [4, 0, false], [0, 5, false], [5, 5, false], [5, 5, true], [0, 0, true]];
for (const [label, width, height] of [['phone 390', 390, 844], ['tablet 834', 834, 1194], ['desktop 1280', 1280, 900]] as const) {
  test(`scoreboard keeps its height and both names on one line (${label})`, async () => {
    let reference: { height: number; next: number } | null = null;
    for (const [home, away, long] of SCORES) {
      const { context, page } = await open(width, height, withScore(match(true), home, away, long));
      const m = (await page.evaluate(SCOREBOARD)) as { height: number; names: number[]; labels: number[]; next: number; zones: { h: number; text: string; spans: string[]; scrolls: boolean }[]; overflow: number } | null;
      assert.ok(m, 'the interactive scoreboard is on the page');
      const tag = `${home}:${away}${long ? ' long names' : ''}`;
      assert.equal(m.names.length, 2); assert.ok(Math.abs(m.names[0] - m.names[1]) <= 1, `${tag}: both team names on one line (${m.names.join(' / ')})`);
      assert.ok(Math.abs(m.labels[0] - m.labels[1]) <= 1, `${tag}: HEIM and AUSWÄRTS labels on one line`);
      assert.ok(m.overflow <= 1, `${tag}: no sideways scroll`);
      assert.ok(Math.abs(m.zones[0].h - m.zones[1].h) <= 1, `${tag}: both scorer zones are equally high`);
      if (process.env.SHOTS && width === 390 && ((home === 4 && away === 0) || (long && home === 5))) await page.locator('.gc-interactive-match .gc-viewer-scoreboard').screenshot({ path: `${process.env.SHOTS}/sb-${process.env.SHOT_TAG ?? 'x'}-${home}-${away}${long ? '-long' : ''}.png` });
      reference ??= { height: m.height, next: m.next };
      assert.ok(Math.abs(m.height - reference.height) <= 1.5, `${tag}: scoreboard ${m.height} px, expected ${reference.height} px`);
      assert.ok(Math.abs(m.next - reference.next) <= 1.5, `${tag}: the pitch area starts at the same place`);
      // Every goal stays reachable: all scorers are in the page, the newest first; more than two scroll inside their zone.
      const sides = withScore(match(true), home, away, long).cup.matchEvents;
      const homeGoals = sides.filter((e) => e.side === 'home'), awayGoals = sides.filter((e) => e.side === 'away');
      const fixtureAway = (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).features.cup.fixture?.away, SAVE_KEY)) === true;
      const [leftGoals, rightGoals] = fixtureAway ? [awayGoals, homeGoals] : [homeGoals, awayGoals];
      for (const [zone, goals] of [[m.zones[0], leftGoals], [m.zones[1], rightGoals]] as const) {
        assert.equal(zone.spans.length, goals.length, `${tag}: every goal is listed`);
        if (goals.length) assert.match(zone.spans[0], new RegExp(`${goals.at(-1)!.minute}′`), `${tag}: the newest goal is first`);
        assert.equal(zone.scrolls, goals.length > 2, `${tag}: only a long list scrolls`);
      }
      await context.close();
    }
  });
}

async function tickerRows(page: Page) { return page.evaluate(() => [...document.querySelectorAll('.gc-interactive-ticker > div')].map((row) => (row.textContent || '').replace(/\s+/g, ' ').trim())); }
for (const count of [3, 20, 60]) {
  test(`ticker: newest event first, source order reversed, starts at the newest (${count} events)`, async () => {
    const f = match(true); const base = Date.now() - 900000; const goals: GameFeatures['cup']['matchEvents'] = [];
    // Pairs share one timestamp (the same minute): their order must be the stable source order, reversed as a whole.
    for (let i = 0; i < count; i++) goals.push({ id: `goal-${String(i).padStart(3, '0')}`, side: i % 3 === 0 ? 'away' : 'home', scorerId: null, scorer: `Torschütze ${i + 1}`, minute: 2 + Math.floor(i / 2), createdAt: base + Math.floor(i / 2) * 1000, homeScore: 0, awayScore: 0, ratingImpacts: {} } as GameFeatures['cup']['matchEvents'][number]);
    f.cup.matchEvents = goals; f.cup.broadcast = undefined as never; f.cup.cardEvents = []; f.cup.injuryEvents = []; f.cup.penaltyEvents = [];
    const source = getViewerEvents(normalizeGameFeatures(f).cup);
    const { context, page } = await open(390, 844, f);
    await page.getByRole('button', { name: 'Live Ticker' }).click(); await page.waitForTimeout(600);
    const rows = await tickerRows(page);
    assert.equal(rows.length, source.length, 'every event is listed once');
    const expected = source.slice().reverse().map((e) => e.player);
    for (let i = 0; i < rows.length; i++) assert.ok(rows[i].includes(expected[i]!), `row ${i}: ${rows[i]} should contain ${expected[i]}`);
    assert.equal(await page.locator('.gc-interactive-ticker').evaluate((el) => el.scrollTop), 0, 'opens at the newest event');
    assert.match(rows[0], new RegExp(`${source.at(-1)!.minute}′`));
    // The status line is not an event: it sits above the list, outside the log.
    assert.equal(await page.locator('[role=log][aria-label="Live Ticker"] .gc-ticker-status').count(), 0);
    assert.match(await page.locator('.gc-ticker-status').innerText(), /′/);
    // Closing and opening again starts at the newest once more.
    await page.getByRole('button', { name: '2D' }).click(); await page.getByRole('button', { name: 'Live Ticker' }).click(); await page.waitForTimeout(300);
    assert.equal(await page.locator('.gc-interactive-ticker').evaluate((el) => el.scrollTop), 0);
    await context.close();
  });
}

test('ticker in a running match: new events appear on top, the reading position stays and every event is added once', async () => {
  // A running match that already has a long list (25 earlier goals), so the ticker scrolls; the live events of the simulation come on top.
  const running = match(false, 150, 12000); const old = Date.now() - 900000;
  running.cup.matchEvents = Array.from({ length: 25 }, (_, i) => ({ id: `early-${String(i).padStart(3, '0')}`, side: i % 2 ? 'away' : 'home', scorerId: null, scorer: `Frühes Tor ${i + 1}`, minute: 1, createdAt: old + i * 1000, homeScore: 0, awayScore: 0, ratingImpacts: {} } as GameFeatures['cup']['matchEvents'][number]));
  const { context, page } = await open(390, 844, running, 'ticker');
  const log = page.locator('.gc-interactive-ticker');
  await page.evaluate(() => { const el = document.querySelector('.gc-interactive-ticker')!; (window as unknown as { __added: number; __removed: number }).__added = 0; (window as unknown as { __removed: number }).__removed = 0; new MutationObserver((records) => { for (const r of records) { (window as unknown as { __added: number }).__added += [...r.addedNodes].filter((n) => (n as Element).tagName === 'DIV').length; (window as unknown as { __removed: number }).__removed += [...r.removedNodes].filter((n) => (n as Element).tagName === 'DIV').length; } }).observe(el, { childList: true }); });
  // At the top the list stays on the newest event while more arrive.
  const before = (await tickerRows(page)).length; assert.ok(before > 3, 'the match has events');
  assert.equal(await log.evaluate((el) => el.scrollTop), 0);
  // Reading further down: scroll, remember one row, and wait for new events.
  await log.evaluate((el) => { el.scrollTop = Math.min(160, el.scrollHeight - el.clientHeight); });
  const anchor = await log.evaluate((el) => { const row = [...el.children][3] as HTMLElement; return { text: (row.textContent || '').trim(), offset: Math.round(row.getBoundingClientRect().top - el.getBoundingClientRect().top) }; });
  let grown = 0;
  for (let i = 0; i < 90 && grown === 0; i++) { await page.waitForTimeout(500); grown = (await tickerRows(page)).length - before; }
  assert.ok(grown > 0, 'new events arrived in the running match');
  const after = await log.evaluate((el, text) => { const row = [...el.children].find((r) => (r.textContent || '').trim() === text) as HTMLElement | undefined; return row ? Math.round(row.getBoundingClientRect().top - el.getBoundingClientRect().top) : null; }, anchor.text);
  assert.ok(after !== null && Math.abs(after - anchor.offset) <= 3, `the row being read stays in place (${anchor.offset} px before, ${after} px after)`);
  const counts = await page.evaluate(() => ({ added: (window as unknown as { __added: number }).__added, removed: (window as unknown as { __removed: number }).__removed }));
  assert.equal(counts.removed, 0, 'no event row is replaced');
  assert.equal(counts.added, (await tickerRows(page)).length - before, 'every new event is added exactly once (one announcement each)');
  assert.equal(await page.getByRole('log', { name: 'Live Ticker' }).count(), 1);
  await context.close();
});
