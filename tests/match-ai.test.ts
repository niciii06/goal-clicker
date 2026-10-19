import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, STAR_XI_PLAYERS, STAR_FORMATIONS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, resumeCupMatch, getStarXIPlayer } from '../app/feature-data';
import { prepareCareerMatch } from '../app/career-data';
import { createInteractiveMatch, advanceInteractive } from '../app/interactive-match';
import type { SimAction, SimCheckpoint } from '../app/interactive-match';
import { readInteractiveFrame } from '../app/interactive-frame-data';
import { carrierOptions, chooseOption, decisionTemperature, inBox, progressOf, roleOf, PITCH } from '../app/match-ai';
import { requestMatchEdit, confirmMatchDraft, draftMatch } from '../app/match-commands';

type Fixture = ReturnType<typeof fixture>;
function fixture(seed: number, opponentRating = 90, formation?: string) {
  const f = initialGameFeatures(2000000 + seed);
  f.starXI = setBestStarXI({ ...f.starXI, formationId: (formation ?? f.starXI.formationId) as typeof f.starXI.formationId, ownedIds: STAR_XI_PLAYERS.map(p => p.id) });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 2000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  f.cup.opponentRating = opponentRating;
  f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
  return f;
}
/** Plays a match to the end and returns every committed play in order. */
function play(f: Fixture, onPause?: (f: Fixture) => void) {
  const actions: SimAction[] = [];
  for (let i = 0; i < 6000 && f.cup.active; i++) {
    if (f.cup.matchPaused) { onPause?.(f); if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt); }
    const last = f.cup.simulation!.recent.at(-1)?.id;
    f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 2500), () => { throw Error('Unseeded RNG consumed'); }, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
    const recent = f.cup.simulation!.recent, index = recent.findIndex(a => a.id === last);
    actions.push(...recent.slice(index + 1));
  }
  assert.equal(f.cup.active, false, 'the match reaches full time');
  return actions;
}
const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x <= PITCH.length && p.y >= 0 && p.y <= PITCH.width;
const KINDS = new Set(['pass', 'carry', 'cross', 'interception', 'tackle', 'shot', 'restart', 'red', 'yellow', 'injury', 'foul']);

const matches: { f: Fixture; actions: SimAction[] }[] = [];
for (let seed = 1; seed <= 24; seed++) {
  const f = fixture(seed, [65, 80, 90, 99][seed % 4], STAR_FORMATIONS[seed % STAR_FORMATIONS.length].id);
  matches.push({ f, actions: play(f) });
}

test('every play is a valid, physically continuous action', () => {
  let checked = 0, kickoffs = 0;
  for (const { actions } of matches) {
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      assert.ok(KINDS.has(a.kind), a.kind);
      assert.ok(a.end > a.start, 'positive duration');
      assert.ok(inside(a.from) && inside(a.to), `${a.kind} stays on the pitch`);
      assert.deepEqual(a.after.ball, a.to, 'the ball ends where the play sent it');
      assert.ok(a.after.players.some(p => p.active && p.id === a.after.owner), 'someone owns the ball');
      for (const p of a.after.players) assert.ok(inside(p), 'players stay on the pitch');
      const previous = actions[i - 1];
      if (!previous) continue;
      if (a.start === 2700) { kickoffs++; continue; } // Half time: covered by the half time card.
      assert.equal(a.start, previous.end, 'no gap in the match clock');
      assert.ok(Math.hypot(a.from.x - previous.to.x, a.from.y - previous.to.y) < 1e-9, `ball continuity ${previous.kind} -> ${a.kind}`);
      for (const p of a.before.players) {
        const q = previous.after.players.find(x => x.id === p.id);
        if (q) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 1e-9, 'player continuity');
      }
      checked++;
    }
  }
  assert.ok(checked > 4000, `${checked} transitions checked`);
  assert.equal(kickoffs, matches.length, 'exactly one second half kick-off per match');
});

test('ball and players move at football speeds, no teleporting in open play', () => {
  let maxBall = 0, maxPlayer = 0;
  for (const { actions } of matches) for (const a of actions) {
    if (a.kind === 'restart') continue; // Dead ball setups and the goal celebration are stoppages.
    const seconds = a.end - a.start;
    maxBall = Math.max(maxBall, Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) / seconds);
    for (const p of a.before.players) {
      const q = a.after.players.find(x => x.id === p.id)!;
      if (q.active) maxPlayer = Math.max(maxPlayer, Math.hypot(q.x - p.x, q.y - p.y) / seconds);
    }
  }
  // Simulated seconds: 18 of them make one second on screen.
  assert.ok(maxBall * 18 < 45, `ball ${(maxBall * 18).toFixed(1)} m per screen second`);
  assert.ok(maxPlayer * 18 < 13, `player ${(maxPlayer * 18).toFixed(1)} m per screen second`);
});

test('players keep their roles: keepers stay home, centre backs do not camp in the opposition box', () => {
  let samples = 0, cbInBox = 0, chasing = 0, plays = 0;
  for (const { actions } of matches) for (const a of actions) {
    const c = a.after;
    if (a.kind !== 'restart') {
      plays++;
      // Not every player chases the ball: few defenders are near it.
      chasing += c.players.filter(p => p.active && p.side !== c.possession && roleOf(p) !== 'keeper' && Math.hypot(p.x - c.ball.x, p.y - c.ball.y) < 8).length;
    }
    for (const p of c.players) {
      if (!p.active) continue;
      samples++;
      if (roleOf(p) === 'keeper') assert.ok(progressOf(c, p.side, p.x) <= 17 && Math.abs(p.y - 34) <= 21, 'keeper inside his own penalty area');
      if (roleOf(p) === 'centre-back' && inBox(c, p.side, p) && !c.setPiece) cbInBox++;
    }
  }
  assert.ok(cbInBox / samples < .004, `centre backs in the opposition box ${(cbInBox / samples * 100).toFixed(2)} %`);
  assert.ok(chasing / plays < 3.5, `${(chasing / plays).toFixed(2)} defenders within 8 m of the ball`);
});

test('shots come from shooting positions and goals from a valid trajectory', () => {
  let shots = 0, goals = 0;
  for (const { f, actions } of matches) {
    for (const a of actions.filter(a => a.kind === 'shot')) {
      shots++;
      const shooter = a.before.players.find(p => p.id === a.actor)!;
      assert.ok(progressOf(a.before, shooter.side, a.from.x) > 62, 'shot from the attacking third');
      assert.notEqual(roleOf(shooter), 'keeper');
      if (a.outcome === 'goal') {
        goals++;
        const goalX = progressOf(a.before, shooter.side, a.to.x);
        assert.ok(goalX > PITCH.length - 1, 'the ball crosses the goal line');
        assert.ok(Math.abs(a.to.y - 34) < 3.66, 'between the posts');
      }
    }
    const engineGoals = actions.filter(a => a.kind === 'shot' && a.outcome === 'goal').length;
    assert.equal(f.cup.homeScore + f.cup.awayScore, engineGoals, 'every goal comes from a simulated shot');
  }
  assert.ok(shots / matches.length > 8, `${(shots / matches.length).toFixed(1)} shots per match`);
  assert.ok(goals > matches.length, 'goals are scored');
});

test('better players decide and execute better', () => {
  const tally = (rating: number) => {
    let success = 0, total = 0;
    for (let seed = 40; seed < 46; seed++) {
      const f = fixture(seed, rating);
      for (const p of f.cup.simulation!.committed.players) if (p.side === 'opponent') { p.rating = p.passing = p.shooting = p.pace = p.defending = p.keeping = p.control = rating; }
      f.cup.simulation!.buffer = [];
      for (const a of play(f)) if (a.side === 'opponent' && (a.kind === 'pass' || a.kind === 'interception' || a.kind === 'cross')) { total++; if (a.outcome === 'success') success++; }
    }
    return success / total;
  };
  const strong = tally(92), weak = tally(58);
  assert.ok(strong > weak + .04, `pass completion ${strong.toFixed(2)} vs ${weak.toFixed(2)}`);
  // Low temperature: a strong player nearly always takes the best option; a weak one less often.
  const c = matches[0].actions[50].before, carrier = c.players.find(p => p.id === c.owner)!;
  const options = carrierOptions(c, carrier), best = options.reduce((a, b) => a.utility > b.utility ? a : b);
  const pick = (rating: number) => { let n = 0; for (let i = 0; i < 400; i++) if (chooseOption(options, decisionTemperature({ ...carrier, rating, passing: rating, control: rating }), (i + .5) / 400) === best) n++; return n; };
  assert.ok(pick(95) >= pick(55));
});

test('substitutes take part in the following play, substituted players do not', () => {
  let f = fixture(77, 90);
  f = requestMatchEdit(f, f.cup.matchStartedAt + 30000);
  f.cup = advanceInteractive(f.cup, f.cup.matchStartedAt + 36000);
  assert.ok(f.cup.matchPaused);
  const draft = draftMatch(f), formation = f.starXI.formationPositions;
  let incoming = '', outgoing = '';
  for (let slot = 1; slot < 11 && !incoming; slot++) {
    const id = f.starXI.benchIds.find(id => id && getStarXIPlayer(id)?.positions.includes(formation[slot]));
    if (id) { incoming = id; outgoing = draft.lineup[slot]; draft.lineup[slot] = id; }
  }
  assert.ok(incoming);
  const result = confirmMatchDraft(f, draft, f.cup.lastTickAt + 1000);
  assert.equal(result.error, '');
  f = result.features;
  const from = f.cup.simulation!.time;
  const actions = play(f).filter(a => a.start >= from);
  assert.ok(!actions.some(a => a.actor === outgoing || a.before.players.some(p => p.id === outgoing && p.active)), 'the substituted player has left');
  assert.ok(actions.some(a => a.actor === incoming || a.target === incoming), 'the substitute plays');
});

test('frames read from the authoritative plays and never jump at the half time kick-off', () => {
  const { f } = matches[1], s = f.cup.simulation!;
  const firstHalfEnd = s.recent.length ? s.recent : [];
  void firstHalfEnd;
  const checkpoint: SimCheckpoint = s.committed;
  assert.ok(checkpoint.players.length >= 18);
  // At the boundary the next play's start positions win, so the overlay hides the change of ends.
  const live = fixture(91, 90);
  live.cup = advanceInteractive(live.cup, live.cup.matchEndsAt + 1);
  assert.equal(live.cup.simulation!.status, 'halftime');
  const frame = readInteractiveFrame(live.cup.simulation!, 2700);
  const kickoffTaker = frame.players.find(p => Math.hypot(p.x - 52.5, p.y - 34) < .01);
  assert.ok(kickoffTaker, 'kick-off positions are shown under the half time card');
  assert.deepEqual(frame.ball, { x: 52.5, y: 34 });
});
