// Isolated browser proof (run by hand after npm run build, not part of npm run test:browser):
//   node --import tsx --test --test-concurrency=1 tests/browser/pitch-label-sides.test.ts
// The two team labels under the 2D pitch must stand under the team that is really on that side of the pitch. The side is read
// from the pixels the renderer drew (club colour red #d12c54, opponent colour yellow), not from the code that decides it.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { advanceCupMatch, beginSeasonCupMatch, getStarXISelection, initialGameFeatures, normalizeGameFeatures, resumeCupMatch, setBestStarXI, STAR_XI_PLAYERS } from '../../app/feature-data.ts';
import type { GameFeatures } from '../../app/feature-data.ts';
import { emptyPlayerStats, prepareCareerMatch } from '../../app/career-data.ts';
import { createInteractiveMatch } from '../../app/interactive-match.ts';
import { HOME_VENUE } from '../../app/travel-geography.ts';
import { WHATS_NEW_STORAGE_KEY } from '../../app/game/constants.ts';
import { WHATS_NEW } from '../../app/whats-new.ts';

const PORT = Number(process.env.LABEL_PORT ?? 8807), BASE = `http://127.0.0.1:${PORT}`, SAVE_KEY = 'goalClickerSiteSaveV3';
// The goalkeepers stay at their own goal line (the outfield players cluster around the ball), so they show the side: the club's is purple, the opponent's light blue.
const CLUB = { name: 'FC Goal', colour: '#d12c54', keeper: [198, 132, 244] }, OPPONENT_KEEPER = [116, 208, 237];
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

/** A season match (home or away fixture) played in the simulation up to `until` seconds of game time, then frozen (paused for a change). */
function match(away: boolean, until: number, opponent?: string) {
  const f = initialGameFeatures(1000011);
  for (const p of STAR_XI_PLAYERS.filter((player) => player.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
  f.starXI = setBestStarXI({ ...f.starXI, formationId: '433' as GameFeatures['starXI']['formationId'], ownedIds: STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
  f.nextEventAt = Date.now() + 1e9; f.nextVarAt = Date.now() + 1e9; f.transferSaga.nextAt = Date.now() + 1e9;
  f.club.name = CLUB.name; (f.club as { color?: string }).color = CLUB.colour;
  const start = Date.now() - 120000;
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, start, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  // The simulation reads the fixture when it is created: an away game starts with the club on the right-hand side.
  f.cup.fixture = { id: `side-test:${away ? 'away' : 'home'}`, away, venue: HOME_VENUE, opponentId: 'season-opponent-1' };
  f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
  assert.equal(f.cup.simulation.committed.direction, away ? -1 : 1, 'the simulation direction follows the fixture');
  let now = start;
  for (let i = 0; i < 400 && f.cup.active && f.cup.simulation!.time < until; i++) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    now = Math.max(now, f.cup.lastTickAt) + 3000;
    f.cup = advanceCupMatch(f.cup, 85, now, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
  }
  if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
  f.cup.matchPaused = true; f.cup.simulation!.status = 'editing'; f.cup.simulation!.buffer = []; f.cup.simulation!.pauseRequested = false;
  if (opponent) f.cup.opponent = opponent;
  return f;
}
/** A knockout match drawn after 90 minutes (found by trying seeds), played on into extra time up to `until` seconds, then frozen. */
function extraTime(away: boolean, until: number, opponent: string) {
  const play = (f: GameFeatures, now: number) => { f.cup = advanceCupMatch(f.cup, 85, now, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup; };
  for (let seed = 900; seed < 1300; seed++) {
    const f = initialGameFeatures(1000000 + seed);
    for (const p of STAR_XI_PLAYERS.filter((player) => player.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
    f.starXI = setBestStarXI({ ...f.starXI, formationId: '433' as GameFeatures['starXI']['formationId'], ownedIds: STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
    f.nextEventAt = Date.now() + 1e9; f.nextVarAt = Date.now() + 1e9; f.transferSaga.nextAt = Date.now() + 1e9;
    f.club.name = CLUB.name; (f.club as { color?: string }).color = CLUB.colour;
    f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
    prepareCareerMatch(f);
    f.cup.mode = 'tournament' as typeof f.cup.mode; f.cup.tournamentId = 'stadium' as typeof f.cup.tournamentId; f.cup.regularDurationMs = 300000; f.cup.matchEndsAt = f.cup.matchStartedAt + 300000; f.cup.opponentRating = 99;
    f.cup.fixture = { id: `side-test:et:${away ? 'away' : 'home'}`, away, venue: HOME_VENUE, opponentId: 'season-opponent-1' };
    f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
    let now = f.cup.matchStartedAt;
    for (let i = 0; i < 3000 && f.cup.active && f.cup.phase === 'regular'; i++) { if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt); now = Math.max(now, f.cup.lastTickAt) + 1000; play(f, now); }
    if (f.cup.phase !== 'extra-time') continue;
    for (let i = 0; i < 3000 && f.cup.active && f.cup.simulation!.time < until; i++) { if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt); now = Math.max(now, f.cup.lastTickAt) + 1000; play(f, now); }
    if (f.cup.simulation!.time < until) continue;
    f.cup.matchPaused = true; f.cup.simulation!.status = 'editing'; f.cup.simulation!.buffer = []; f.cup.simulation!.pauseRequested = false; f.cup.opponent = opponent;
    return f;
  }
  throw new Error('no drawn knockout match found');
}
const CASES: { label: string; away: boolean; until: number }[] = [
  { label: 'home game, first half', away: false, until: 400 },
  { label: 'away game, first half', away: true, until: 400 },
  { label: 'home game, second half (ends changed)', away: false, until: 3300 },
  { label: 'away game, second half (ends changed)', away: true, until: 3300 },
];
const EXTRA: { label: string; away: boolean; until: number }[] = [
  { label: 'home game, extra time first half', away: false, until: 5800 },
  { label: 'away game, extra time second half (105 minutes)', away: true, until: 6800 },
];
const LEGEND = `(() => { const spans = [...document.querySelectorAll('.gc-viewer-legend > span')].filter((s) => !s.classList.contains('gc-stadium-label')); const r = spans.map((s) => ({ text: (s.textContent || '').trim(), x: Math.round(s.getBoundingClientRect().left), right: Math.round(s.getBoundingClientRect().right), top: Math.round(s.getBoundingClientRect().top), dot: (() => { const i = s.querySelector('i'); return i ? getComputedStyle(i).backgroundColor : ''; })() })); return { spans: r, pitchLeft: Math.round(document.querySelector('canvas.gc-viewer-pitch')?.getBoundingClientRect().left ?? -1), pitchRight: Math.round(document.querySelector('canvas.gc-viewer-pitch')?.getBoundingClientRect().right ?? -1), overflow: document.documentElement.scrollWidth - innerWidth }; })()`;
/** Centre of mass (0 = left edge, 1 = right edge of the picture) of the pixels near a colour. */
const CENTROIDS = `(async (base64, club, opponent) => { const blob = await (await fetch('data:image/png;base64,' + base64)).blob(); const bmp = await createImageBitmap(blob); const cv = new OffscreenCanvas(bmp.width, bmp.height); const cx = cv.getContext('2d'); cx.drawImage(bmp, 0, 0); const data = cx.getImageData(0, 0, bmp.width, bmp.height).data;
 const x0 = 0, x1 = bmp.width, y0 = Math.floor(bmp.height * .3), y1 = Math.floor(bmp.height * .7); const stat = (rgb) => { let n = 0, sum = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * bmp.width + x) * 4; if (Math.abs(data[i] - rgb[0]) + Math.abs(data[i + 1] - rgb[1]) + Math.abs(data[i + 2] - rgb[2]) < 70) { n++; sum += x; } } return { n, x: n ? (sum / n - x0) / (x1 - x0) : -1 }; };
 return { club: stat(club), opponent: stat(opponent) }; })`;
async function open(width: number, features: GameFeatures) {
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, locale: 'de-CH', ...(width < 700 ? { hasTouch: true, isMobile: true } : {}) });
  const page = await context.newPage(); await page.addInitScript('globalThis.__name = (fn) => fn;');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([key, value, seenKey, seen, viewKey]) => { localStorage.clear(); localStorage.setItem(key, value); localStorage.setItem(seenKey, seen); localStorage.setItem(viewKey, 'pitch'); }, [SAVE_KEY, JSON.stringify({ ...baseSave, goals: 5e12, totalGoals: 9e12, seasonGoals: 5e12, clicks: 12345, seasons: 14, features: normalizeGameFeatures(features), lastSaved: Date.now() }), WHATS_NEW_STORAGE_KEY, WHATS_NEW[0].id, 'goal-clicker-interactive-view']);
  await page.goto(`${BASE}/spiele`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
  return { context, page };
}
type Legend = { spans: { text: string; x: number; right: number; top: number; dot: string }[]; pitchLeft: number; pitchRight: number; overflow: number };
async function check(width: number, features: GameFeatures, tag: string) {
  const { context, page } = await open(width, features);
  const canvas = page.locator('canvas.gc-viewer-pitch'); assert.equal(await canvas.count(), 1, `${tag}: the pitch is on the page`);
  const shotBuffer = await canvas.screenshot(); if (process.env.SHOTS) (await import('node:fs')).writeFileSync(`${process.env.SHOTS}/pl-${tag.replace(/[^a-z0-9]+/gi, '-')}.png`, shotBuffer);
  const shot = shotBuffer.toString('base64');
  const c = (await page.evaluate(`(${CENTROIDS})(${JSON.stringify(shot)}, ${JSON.stringify(CLUB.keeper)}, ${JSON.stringify(OPPONENT_KEEPER)})`)) as { club: { n: number; x: number }; opponent: { n: number; x: number } };
  assert.ok(c.club.n > 8 && c.opponent.n > 8, `${tag}: both goalkeepers are visible on the pitch (${c.club.n} / ${c.opponent.n} pixels)`);
  assert.ok(Math.abs(c.club.x - c.opponent.x) > 0.05, `${tag}: the teams are on different sides (${c.club.x.toFixed(2)} / ${c.opponent.x.toFixed(2)})`);
  if (process.env.SHOTS) await page.locator('.gc-viewer-pitch-shell').screenshot({ path: `${process.env.SHOTS}/shell-${tag.replace(/[^a-z0-9]+/gi, '-')}.png` });
  const legend = (await page.evaluate(LEGEND)) as Legend;
  await context.close();
  return { clubLeft: c.club.x < c.opponent.x, legend, centroids: c };
}
for (const [label, width] of [['phone 390', 390], ['desktop 1280', 1280]] as const) {
  test(`labels under the pitch stand under the team on that side (${label})`, async () => {
    const opponent = 'FC Rubigen';
    for (const kase of CASES) {
      const { clubLeft, legend, centroids } = await check(width, match(kase.away, kase.until, opponent), `${kase.label} ${label}`);
      assert.equal(legend.spans.length >= 2, true, `${kase.label}: two team labels under the pitch`);
      const [first, second] = [...legend.spans].sort((a, b) => a.x - b.x);
      const leftName = clubLeft ? CLUB.name : opponent, rightName = clubLeft ? opponent : CLUB.name;
      assert.ok(first.text.includes(leftName) && second.text.includes(rightName), `${kase.label} ${label}: left label "${first.text}" / right label "${second.text}", but the pitch shows ${leftName} on the left (club x ${centroids.club.x.toFixed(2)}, opponent x ${centroids.opponent.x.toFixed(2)})`);
      assert.ok(legend.overflow <= 1, 'no sideways scroll');
    }
    for (const kase of EXTRA) {
      const features = extraTime(kase.away, kase.until, opponent), knockoutOpponent = normalizeGameFeatures(features).cup.opponent;
      const { clubLeft, legend, centroids } = await check(width, features, `${kase.label} ${label}`);
      const [first, second] = [...legend.spans].sort((a, b) => a.x - b.x);
      const leftName = clubLeft ? CLUB.name : knockoutOpponent, rightName = clubLeft ? knockoutOpponent : CLUB.name;
      assert.ok(first.text.includes(leftName) && second.text.includes(rightName), `${kase.label} ${label}: left label "${first.text}" / right label "${second.text}", but the pitch shows ${leftName} on the left (club x ${centroids.club.x.toFixed(2)}, opponent x ${centroids.opponent.x.toFixed(2)})`);
    }
  });
}

test('very long team names at phone width: the labels stay in their corner, do not overlap and do not scroll sideways', async () => {
  const LONG_CLUB = 'Fussballclub Grosse Grümpelturnier-Meister der Unterhaltung', LONG_OPPONENT = 'FC Arbeitszeitbetrug Rapperswil-Jona Unterhaltungsverein';
  for (const away of [false, true]) {
    const features = match(away, 400, LONG_OPPONENT); features.club.name = LONG_CLUB;
    // The game shortens very long names itself; the labels must show whatever the game keeps.
    const kept = normalizeGameFeatures(features), clubName = kept.club.name, opponentName = kept.cup.opponent;
    assert.ok(clubName.length > 20 && opponentName.length > 20, `the names stay long (${clubName.length} / ${opponentName.length} characters)`);
    const { clubLeft, legend } = await check(390, features, `long names ${away ? 'away' : 'home'}`);
    const [first, second] = [...legend.spans].sort((a, b) => a.x - b.x);
    assert.ok(first.text.includes(clubLeft ? clubName : opponentName) && second.text.includes(clubLeft ? opponentName : clubName), `${away ? 'away' : 'home'}: long labels on the right sides ("${first.text}" / "${second.text}")`);
    assert.ok(first.x >= 0 && second.right <= 390, 'both labels inside the screen');
    assert.ok(first.right <= second.x + 1 || first.top !== second.top, 'the labels do not overlap');
    assert.ok(legend.overflow <= 1, 'no sideways scroll');
    assert.ok(Math.abs(first.top - second.top) <= 1, 'both labels start on one line');
  }
});
