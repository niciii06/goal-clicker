// Notion P2 «2D-Match: Eckball realistisch vorbereiten»: in the corner set-up the taker walks to the flag without the
// ball; the ball stays where it went out, then lies at the flag. Corners come from the real engine (own and opposing,
// both flags, both halves). Rendering only: players, actions and the following play are unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceCupMatch, beginSeasonCupMatch, getStarXISelection, initialGameFeatures, normalizeGameFeatures, resumeCupMatch, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data';
import { prepareCareerMatch } from '../app/career-data';
import type { InteractiveMatch, SimAction } from '../app/interactive-match';
import { CORNER_BALL_PLACED_AT, readInteractiveFrame } from '../app/interactive-frame-data';
import { IndependentMatchRenderer } from '../app/match-renderer-core';

type Found = { sim: InteractiveMatch; action: SimAction };
/** Set-up plays of the given set piece from real matches, each with the simulation that still holds it. */
function collect(setPiece: string, want: number) {
  const found = new Map<string, Found>();
  for (let m = 0; m < 12 && found.size < want; m++) {
    const now = 2_000_000_000_000 + m * 97, f = normalizeGameFeatures(initialGameFeatures(now));
    f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => p.rating < 97 && !p.isCustom).slice(0, 80).map((p) => p.id) });
    f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
    prepareCareerMatch(f);
    let cup = f.cup;
    for (let i = 0; i < 900 && cup.active && found.size < want; i++) {
      if (cup.matchPaused) cup = resumeCupMatch(cup, cup.lastTickAt);
      cup = advanceCupMatch(cup, 85, Math.min(cup.matchEndsAt, cup.lastTickAt + 1500), Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
      const sim = cup.simulation; if (!sim) break;
      for (const a of [...sim.recent, ...sim.buffer]) if (a.kind === 'restart' && a.setPiece === setPiece && a.style === 'hold' && !found.has(a.id)) found.set(a.id, { sim: structuredClone(sim), action: a });
    }
  }
  return [...found.values()];
}
const SHARES = Array.from({ length: 41 }, (_, i) => i / 40);
const at = (f: Found, share: number) => readInteractiveFrame(f.sim, f.action.start + (f.action.end - f.action.start) * share);
const takerAt = (frame: ReturnType<typeof readInteractiveFrame>, id: string) => frame.players.find((p) => p.id === id)!;

const corners = collect('corner', 24);

test('enough real corners: own and opposing, both flags, both halves', () => {
  const sides = new Set(corners.map((c) => c.action.side)), flags = new Set(corners.map((c) => `${c.action.to.x < 52.5 ? 'L' : 'R'}${c.action.to.y < 34 ? 'T' : 'B'}`));
  const halves = new Set(corners.map((c) => c.action.start < 2700 ? 1 : 2));
  assert.ok(corners.length >= 16, `corners found: ${corners.length}`);
  assert.deepEqual([...sides].sort(), ['club', 'opponent']);
  assert.ok(flags.size >= 3, `flags: ${[...flags]}`); assert.deepEqual([...halves].sort(), [1, 2]);
  for (const c of corners) assert.ok((c.action.to.x === 0 || c.action.to.x === 105) && (c.action.to.y === 0 || c.action.to.y === 68), `corner spot ${JSON.stringify(c.action.to)}`);
});

test('the ball is never carried to the flag: it lies where it went out, then at the flag; the taker walks there alone', () => {
  let travelled = 0;
  for (const c of corners) {
    const a = c.action;
    let moves = 0;
    for (let i = 0; i < SHARES.length; i++) {
      const frame = at(c, SHARES[i]);
      if (frame.action?.id !== a.id) continue;
      assert.deepEqual(frame.ball, frame.progress < CORNER_BALL_PLACED_AT ? a.from : a.to, `${a.id} at ${SHARES[i]}`);
      if (i > 0) {
        const prev = at(c, SHARES[i - 1]), taker = takerAt(frame, a.actor), moved = Math.hypot(frame.ball.x - prev.ball.x, frame.ball.y - prev.ball.y);
        if (moved > 1e-9) { moves++; travelled += moved; }
        // The ball never moves along with the taker at his feet.
        if (moved > 1e-9) assert.ok(Math.hypot(frame.ball.x - taker.x, frame.ball.y - taker.y) > .5 || Math.hypot(a.from.x - a.to.x, a.from.y - a.to.y) < .5, `${a.id}: ball moved at the taker's feet`);
      }
    }
    assert.ok(moves <= 1, `${a.id}: the ball moves once (placed), not along a path (${moves})`);
    // The taker still walks the whole way and arrives at the flag where the ball lies.
    const end = at(c, .999), taker = takerAt(end, a.actor);
    assert.equal(end.action?.id, a.id);
    assert.ok(Math.hypot(taker.x - a.to.x, taker.y - a.to.y) < .2, 'taker reaches the flag');
    const engineTaker = a.after.players.find((p) => p.id === a.actor)!;
    assert.deepEqual({ x: engineTaker.x, y: engineTaker.y }, a.to, 'the engine still ends the set-up with the taker at the flag');
  }
  assert.ok(travelled > 0);
});

test('players, the action and the next play are untouched; the next play starts from the ball at the flag', () => {
  for (const c of corners) {
    const a = c.action;
    for (const share of SHARES) {
      const frame = at(c, share), t = frame.progress;
      if (frame.action?.id !== a.id) continue;
      for (const p of frame.players) { const from = a.before.players.find((q) => q.id === p.id)!, to = a.after.players.find((q) => q.id === p.id) ?? from; assert.ok(Math.abs(p.x - (from.x + (to.x - from.x) * t)) < 1e-9 && Math.abs(p.y - (from.y + (to.y - from.y) * t)) < 1e-9, `${p.id} moved differently`); }
    }
    assert.deepEqual(a.after.ball, a.to, 'the engine still leaves the ball at the flag');
    const next = [...c.sim.recent, ...c.sim.buffer].find((n) => n.start === a.end && n.id !== a.id);
    if (next) assert.deepEqual(next.from, a.to, `${a.id}: the corner is taken from the ball at the flag`);
  }
});

test('goal kicks, free kicks, penalties (and throw-ins, when the engine prepares one) keep their ball path (regression)', () => {
  for (const kind of ['goal-kick', 'free-kick', 'penalty', 'throw-in']) {
    const plays = collect(kind, 4);
    if (kind !== 'throw-in') assert.ok(plays.length > 0, `${kind} found`);
    for (const c of plays) for (const share of SHARES) {
      const frame = at(c, share), a = c.action; if (frame.action?.id !== a.id) continue;
      const ball = frame.ball, t = frame.progress;
      assert.ok(Math.abs(ball.x - (a.from.x + (a.to.x - a.from.x) * t)) < 1e-9 && Math.abs(ball.y - (a.from.y + (a.to.y - a.from.y) * t)) < 1e-9, `${kind} ball path`);
    }
  }
});

test('worker renderer and main thread fallback show the same corner frame (normal and reduced motion)', () => {
  for (const c of corners.slice(0, 8)) for (const share of [0, .2, .34, .36, .6, 1]) for (const reducedMotion of [false, true]) {
    const time = c.action.start + (c.action.end - c.action.start) * share;
    const renderer = new IndependentMatchRenderer();
    // Paused at this simulation time: the playback clock shows exactly that moment.
    renderer.sync({ simulation: { ...c.sim, time }, startedAt: 0, regularDuration: 210_000, paused: true, active: true, wallNow: 0, monotonicAt: 0, colours: { club: '#000', opponent: '#fff' }, yellowCards: [], width: 1, height: 1, reducedMotion } as never);
    const worker = renderer.frame(0)!, main = readInteractiveFrame(c.sim, time);
    assert.deepEqual(worker.ball, main.ball, `${c.action.id} ${share}`);
    assert.equal(worker.ballOwnerId, undefined, 'a restart never glues the ball to a player');
  }
});
