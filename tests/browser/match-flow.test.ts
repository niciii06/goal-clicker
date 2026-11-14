// Browser acceptance of two Sonnet tickets on the shared candidate (production build, real Chromium):
//  * «Matchpausen bei 90 und 105 Minuten»: the break card shows, nothing plays on by itself or after a reload, substitutions open
//    as at half time, and continuing starts the match from that minute.
//  * «Prämienpacks nach vier Ligaspielen abschaffen» (solo path): a league match that ends in the browser gives no pack, although
//    the old counter stands at the old trigger value. The co-op path is covered in tests/league-no-reward-packs.test.ts.
// Run: MATCHFLOW_PORT=8825 node --import tsx --test --test-concurrency=1 tests/browser/match-flow.test.ts (after npm run build).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser, Page } from 'playwright-core';
import { STAR_XI_PLAYERS, advanceCupMatch, beginSeasonCupMatch, getCupRegularDurationMs, getStarXISelection, initialGameFeatures, normalizeGameFeatures, resumeCupMatch, setBestStarXI } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { emptyPlayerStats, prepareCareerMatch } from '../../app/career-data.ts';
import { createInteractiveMatch } from '../../app/interactive-match.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.MATCHFLOW_PORT ?? 8825);
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
async function open(viewport: { width: number; height: number }, saveJson: string) {
  const page = await browser.newPage({ viewport, locale: 'de-CH' });
  await page.addInitScript('globalThis.__name = (fn) => fn;');
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); }, [SAVE_KEY, saveJson, WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id]);
  await page.goto(`${BASE}/spiele`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { page, problems };
}
const stored = (page: Page) => page.evaluate((key) => { const f = JSON.parse(localStorage.getItem(key)!).features; return { time: f.cup.simulation?.time, status: f.cup.simulation?.status, paused: f.cup.matchPaused, active: f.cup.active, phase: f.cup.phase, history: f.seasonMode.history.length, packs: f.earnedPacks.map((pack: { id: string }) => pack.id), stamps: f.matchStamps }; }, SAVE_KEY);

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
function secondBreak() {
  const f = drawnKnockout();
  f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
  let now = f.cup.lastTickAt;
  for (let i = 0; i < 400 && f.cup.active && !f.cup.matchPaused && f.cup.phase === 'extra-time'; i++) { now += 60000; play(f, now); }
  return f;
}

for (const [label, minute, build] of [['90 minutes', 5400, drawnKnockout], ['105 minutes', 6300, secondBreak]] as const) for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test(`pause at ${label} on ${viewport.name}: the break card shows, nothing plays on by itself or after a reload, substitutions open, closing them continues from that minute`, async () => {
    const f = build();
    assert.equal(f.cup.simulation!.time, minute);
    const { page, problems } = await open(viewport, saveOf(f, Date.now()));
    const cover = page.locator('.gc-halftime-cover');
    await cover.waitFor({ state: 'visible', timeout: 15000 });
    assert.ok((await page.locator('.gc-halftime-kicker').innerText()).trim().length > 3, 'the break names itself');
    const buttons = page.locator('.gc-halftime-actions button');
    assert.equal(await buttons.count(), 2, 'substitutions and continue, like at half time');
    assert.equal(await buttons.first().isEnabled() && await buttons.nth(1).isEnabled(), true);
    // Waiting does not play on.
    await page.waitForTimeout(3500);
    let state = await stored(page);
    assert.equal(state.time, minute, 'the match clock stands');
    assert.equal(state.paused, true);
    assert.equal(state.phase, 'extra-time');
    // A reload keeps the break.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await cover.waitFor({ state: 'visible', timeout: 15000 });
    state = await stored(page);
    assert.equal(state.time, minute, 'the same minute after a reload');
    // The substitution editor opens as at half time.
    await buttons.first().click();
    await page.locator('.gc-sub-panel').first().waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('.gc-sub-panel').first().focus();
    await page.keyboard.press('Escape');
    await page.locator('.gc-sub-panel').first().waitFor({ state: 'detached', timeout: 8000 });
    // Closing the editor without a change continues the match, as at half time: the card leaves and the clock runs on from this minute.
    await page.waitForTimeout(3500);
    assert.equal(await cover.count(), 0, 'the break card is gone');
    state = await stored(page);
    assert.equal(state.paused, false, 'the match runs');
    assert.ok(state.time >= minute, `continues from the minute (${state.time})`);
    assert.deepEqual(problems, []);
    await page.close();
  });
}

test('a league match that ends in the browser gives no reward pack, although the old counter stands at the old trigger value', async () => {
  const f = rich(7);
  f.matchStamps = 3; // the old rule gave a pack when this reached four
  f.earnedPacks = [{ id: 'old-stamp-pack', packId: 'reward-3', earnedAt: 2000 }];
  const duration = 210000;
  const start = Date.now() - (duration - 14000);
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, start, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  assert.ok(f.cup.simulation);
  assert.ok(getCupRegularDurationMs(f.cup) >= 210000);
  let now = start;
  while (f.cup.active && now < Date.now() - 1000) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    now = Math.min(Date.now() - 500, Math.max(now, f.cup.lastTickAt) + 10000);
    play(f, now);
  }
  assert.ok(f.cup.active, 'the match is still on for the last seconds');
  const before = f.seasonMode.history.length;
  const { page, problems } = await open({ width: 1280, height: 900 }, saveOf(f, Date.now()));
  let state = await stored(page);
  for (const until = Date.now() + 75000; Date.now() < until && (state.active || state.history === before); state = await stored(page)) {
    if (await page.locator('.gc-halftime-actions button.primary, .gc-interactive-pause button').count()) await page.locator('.gc-halftime-actions button.primary, .gc-interactive-pause button').first().click().catch(() => undefined);
    await page.waitForTimeout(1000);
  }
  assert.equal(state.active, false, 'the league match was settled in the browser');
  assert.ok(state.history > before, 'and recorded in the season');
  assert.deepEqual(state.packs, ['old-stamp-pack'], 'no new pack, the saved one stays');
  assert.equal(state.stamps, 3, 'the old counter is neither raised nor reset');
  assert.equal(await page.getByText(/Matchstempel|match stamp/i).count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});
