// Isolated browser audit (run by hand after npm run build, not part of npm run test:browser):
//   node --import tsx --test --test-concurrency=1 tests/browser/theme-audit-all-states.test.ts
// Light and dark audit of the late game states that the eight main tab smoke tests do not reach: the pause panel of the
// live match, the Prestige dialog, the penalty shootout, the trophy celebration and a random event. Local saves, no account.
// Every state is opened in both themes on a 390 px touch phone and on a 1280 px desktop and measured:
//  * text contrast (WCAG 4.5 to 1, 3 to 1 for large text) against the composited background of the element,
//  * large opaque surfaces of the wrong brightness for the theme (a light box in dark mode, a dark box in light mode),
//  * horizontal overflow of the page.
// Set THEME_AUDIT_REPORT=1 to print every finding instead of only failing on the unexplained ones.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { SEASON_MODE_MATCHES_PER_SEASON, advanceCupMatch, beginSeasonCupMatch, getStarXISelection, normalizeGameFeatures, resumeCupMatch, setBestStarXI, STAR_XI_PLAYERS } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { prepareCareerMatch } from '../../app/career-data.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';
import { measure } from './theme-measure.ts';

const PORT = Number(process.env.THEME_AUDIT_PORT ?? 8806), BASE = `http://127.0.0.1:${PORT}`, SAVE_KEY = 'goalClickerSiteSaveV3';
const REPORT = process.env.THEME_AUDIT_REPORT === '1';
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

function features(change: (f: GameFeatures, now: number) => void) {
  const now = Date.now();
  const f = normalizeGameFeatures(structuredClone(baseSave.features));
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => p.rating < 97).slice(0, 120).map((p) => p.id) });
  f.nextEventAt = now + 1e9; f.nextVarAt = now + 1e9; f.transferSaga.nextAt = now + 1e9;
  change(f, now); return normalizeGameFeatures(f);
}
const selection = (f: GameFeatures) => getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds);
function liveMatch(f: GameFeatures, now: number) {
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, selection(f), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
}

const PHONE = { name: 'phone 390', width: 390, height: 844, touch: true }, DESKTOP = { name: 'desktop 1280', width: 1280, height: 900, touch: false };
async function open(viewport: typeof PHONE, scheme: 'light' | 'dark', path: string, f: GameFeatures) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: 'de-CH', colorScheme: scheme, ...(viewport.touch ? { hasTouch: true, isMobile: true } : {}) });
  const page = await context.newPage();
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const save = JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, seasons: 14, features: f, lastSaved: Date.now() });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([k, v, sk, sv]) => { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [SAVE_KEY, save, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0]?.id ?? 'x']);
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  return { page, errors, close: () => context.close() };
}

type State = { id: string; path: string; setup: (f: GameFeatures, now: number) => void; arrive: (page: Page) => Promise<void> };
const STATES: State[] = [
  { id: 'pause panel', path: '/spiele', setup: (f, now) => { liveMatch(f, now); f.cup = { ...f.cup, matchPaused: true }; }, arrive: async (page) => { await page.locator('.gc-interactive-pause').waitFor({ timeout: 15000 }); } },
  { id: 'prestige dialog', path: '/spiele', setup: (f) => { f.seasonMode.hallOfFame = true; f.seasonMode.prestigeCount = 2; f.cup = { ...f.cup, active: false }; }, arrive: async (page) => { await page.getByRole('button', { name: 'Prestige starten' }).click(); await page.getByRole('dialog').waitFor({ timeout: 10000 }); await page.waitForTimeout(500); } },
  { id: 'penalty shootout', path: '/spiele', setup: (f, now) => { liveMatch(f, now); f.cup = { ...f.cup, phase: 'penalties', penaltyTurn: 'home', homeScore: 1, awayScore: 1, penaltyHomeScore: 1, penaltyAwayScore: 0, penaltyHomeTaken: 1, penaltyAwayTaken: 1, matchPaused: false }; }, arrive: async (page) => { await page.locator('.cup-penalty-panel').waitFor({ timeout: 15000 }); } },
  {
    id: 'trophy celebration', path: '/spiele',
    setup: (f, now) => {
      f.seasonMode = { ...f.seasonMode, matchday: SEASON_MODE_MATCHES_PER_SEASON - 1, table: f.seasonMode.table.map((team) => ({ ...team, played: SEASON_MODE_MATCHES_PER_SEASON - 1, points: team.id === 'club' ? 99 : 0 })) };
      f.seasonMode.history = Array.from({ length: SEASON_MODE_MATCHES_PER_SEASON - 1 }, (_, index) => ({ id: `season-match-${now - 1e6 + index}-${index + 1}`, division: f.seasonMode.division, matchday: index + 1, opponent: 'Testgegner', opponentRating: 70, clubScore: 2, opponentScore: 0, outcome: 'win' as const, completedSeason: false, seasonOutcome: null, createdAt: now - 1e6 + index }));
      liveMatch(f, now);
      for (let i = 0; i < 2000 && f.cup.active && f.cup.matchEndsAt - f.cup.lastTickAt > 3000; i++) {
        if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
        f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt - 2500, f.cup.lastTickAt + 20000), Math.random, selection(f), f.starXI.formationPositions).cup;
      }
      if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
      const shift = now - f.cup.lastTickAt;
      f.cup = { ...f.cup, matchStartedAt: f.cup.matchStartedAt + shift, matchEndsAt: f.cup.matchEndsAt + shift, lastTickAt: f.cup.lastTickAt + shift, restartAt: f.cup.restartAt === undefined ? undefined : f.cup.restartAt + shift, timedPause: undefined };
    },
    arrive: async (page) => { await page.getByRole('dialog', { name: /holt den Titel/ }).waitFor({ timeout: 25000 }); await page.waitForTimeout(2200); },
  },
  { id: 'random event', path: '/', setup: (f, now) => { f.cup = { ...f.cup, active: false }; f.nextEventAt = now - 1000; }, arrive: async (page) => { await page.locator('.gc-notification').first().waitFor({ timeout: 25000 }); await page.waitForTimeout(600); } },
];

/**
 * Findings that were looked at and are deliberate. The live match viewer is a dark stadium stage in both themes (its text is light and
 * reads at 10 to 17 to 1), and the status banners of events are dark iOS style notices with white text. Both are kept as designed;
 * whether they should follow the light theme is a design decision for Nicolas (docs/theme-audit-states.md), not a defect found here.
 */
const DELIBERATE = /^surface (section\.gc-match-viewer|div\.gc-viewer-pitch-shell|canvas\.gc-viewer-pitch|div\.gc-notification)/;
const ACCEPTED: Record<string, RegExp[]> = {};

for (const state of STATES) for (const viewport of [PHONE, DESKTOP]) for (const scheme of ['light', 'dark'] as const) {
  test(`${state.id}, ${viewport.name}, ${scheme}`, async () => {
    const { page, errors, close } = await open(viewport, scheme, state.path, features(state.setup));
    const shot = (suffix: string) => process.env.THEME_AUDIT_SHOTS ? page.screenshot({ path: `${process.env.THEME_AUDIT_SHOTS}/${state.id.replace(/ /g, '-')}-${viewport.name.replace(/ /g, '')}-${scheme}${suffix}.png` }) : Promise.resolve(undefined);
    try { await state.arrive(page); } catch (error) {
      await shot('-ARRIVAL-FAILED');
      console.log(`ARRIVAL ${state.id} ${viewport.name} ${scheme}: dialogs=${await page.locator('[role=dialog],[role=alertdialog]').count()} text=${(await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 260)}`);
      throw error;
    }
    await shot('');
    const { findings, unmeasured } = await measure(page, scheme);
    if (REPORT) console.log(`AUDIT ${state.id} | ${viewport.name} | ${scheme}: ${findings.length ? JSON.stringify(findings) : 'clean'} (text on gradients or images, not measured: ${unmeasured})`);
    const accepted = [DELIBERATE, ...(ACCEPTED[state.id] ?? [])];
    const open_ = findings.filter((x) => !accepted.some((re) => re.test(`${x.kind} ${x.at} ${x.detail}`)));
    assert.deepEqual(open_, [], `${state.id} ${viewport.name} ${scheme}`);
    assert.deepEqual(errors.filter((message) => !message.includes('navigator.vibrate')), []);
    await close();
  });
}
