// Match pauses at 90 and 105 minutes (Notion ticket «Matchpausen vor und während der Verlängerung»): the evidence that
// tests/interactive-match.test.ts does not already give. There: the pauses themselves, nothing plays on in a hidden tab, after
// a reload or a long absence, no third pause, no extra pause in league matches. Here: substitutions in both pauses work as at
// half time, the timeline moves by the pause, the limits stay, and a match from before the change (no simulation) is untouched.
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, resumeCupMatch, getStarXIPlayer } from '../app/feature-data.ts';
import type { GameFeatures } from '../app/feature-data.ts';
import { emptyPlayerStats, prepareCareerMatch } from '../app/career-data.ts';
import { createInteractiveMatch } from '../app/interactive-match.ts';
import { confirmMatchDraft, draftMatch } from '../app/match-commands.ts';

function fixture(seed: number) {
  const f = initialGameFeatures(1000000 + seed);
  for (const p of STAR_XI_PLAYERS.filter((player) => player.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
  f.starXI = setBestStarXI({ ...f.starXI, formationId: '433' as GameFeatures['starXI']['formationId'], ownedIds: STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}
const play = (f: GameFeatures, now: number) => { f.cup = advanceCupMatch(f.cup, 85, now, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup; };

/** A knockout match that is drawn after 90 minutes, played like a player (every pause continued). `legacy`: a match from before the simulation. */
function drawnKnockout(legacy = false) {
  for (let seed = 900; seed < 1300; seed++) {
    const f = fixture(seed);
    f.cup.mode = 'tournament' as typeof f.cup.mode;
    f.cup.regularDurationMs = 300000;
    f.cup.matchEndsAt = f.cup.matchStartedAt + 300000;
    f.cup.opponentRating = 99;
    if (legacy) delete f.cup.simulation; else f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
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
/** Plays on until the next pause of extra time (105 minutes). */
function toSecondExtraTimeBreak() {
  const f = drawnKnockout();
  f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
  let now = f.cup.lastTickAt;
  for (let i = 0; i < 400 && f.cup.active && !f.cup.matchPaused && f.cup.phase === 'extra-time'; i++) { now += 60000; play(f, now); }
  return f;
}
/** A legal draft with one substitution (a bench player for a starter of the same position), or null. */
function oneChange(f: GameFeatures) {
  const draft = draftMatch(f);
  for (let slot = 0; slot < 11; slot++) {
    const incoming = f.starXI.benchIds.find((id) => id && !draft.lineup.includes(id) && getStarXIPlayer(id)?.positions.includes(f.starXI.formationPositions[slot]));
    if (incoming) { draft.lineup[slot] = incoming; return { draft, incoming, outgoing: f.starXI.lineupIds[slot] }; }
  }
  return null;
}

for (const [label, minute, build] of [['90 minutes (before extra time)', 5400, () => drawnKnockout()], ['105 minutes (half time of extra time)', 6300, () => toSecondExtraTimeBreak()]] as const) {
  test(`substitutions in the pause at ${label} work as at half time: no window used, the match continues from the same second`, () => {
    const f = build();
    assert.ok(f.cup.matchPaused);
    assert.equal(f.cup.simulation!.time, minute);
    const windowsBefore = f.cup.subWindowsUsed ?? 0, usedBefore = f.cup.substitutionsUsed;
    const change = oneChange(f)!;
    assert.ok(change, 'the bench has a player for a free position');
    const result = confirmMatchDraft(f, change.draft, f.cup.lastTickAt + 1000);
    assert.equal(result.error, '');
    const cup = result.features.cup;
    assert.equal(cup.substitutionsUsed, usedBefore + 1);
    assert.equal(cup.subWindowsUsed ?? 0, windowsBefore, 'a break is no substitution window (the same rule as at 45 minutes)');
    assert.ok(result.features.starXI.lineupIds.includes(change.incoming) && !result.features.starXI.lineupIds.includes(change.outgoing));
    assert.equal(cup.simulation!.time, minute, 'continues from exactly this second, nothing is skipped');
    assert.equal(cup.matchPaused, false, 'confirming continues the match, as at half time');
    assert.equal(cup.phase, 'extra-time');
    // Not paused a second time for the same break.
    const g = result.features;
    play(g, g.cup.lastTickAt + 5000);
    assert.ok(!g.cup.matchPaused || g.cup.simulation!.time > minute, 'no double pause');
  });

  test(`the timeline moves by the length of the pause at ${label}: waiting does not use up match time`, () => {
    const f = build();
    const endsBefore = f.cup.matchEndsAt, simBefore = f.cup.simulation!.time;
    const pausedAt = f.cup.lastTickAt;
    const resumed = resumeCupMatch(f.cup, pausedAt + 20 * 60 * 1000);
    assert.equal(resumed.matchEndsAt - endsBefore, 20 * 60 * 1000, 'the end moves by the 20 minutes waited');
    assert.equal(resumed.simulation!.time, simBefore, 'the match clock itself did not move');
    assert.equal(resumed.matchPaused, false);
  });

  test(`limits stay in the pause at ${label}: no sixth substitution, a player twice in the eleven is refused, a refused draft changes nothing`, () => {
    const f = build();
    // The substitution limit counts for this pause too.
    const limited = structuredClone(f);
    limited.cup.substitutionsUsed = 5;
    const change = oneChange(limited)!;
    assert.ok(confirmMatchDraft(limited, change.draft, limited.cup.lastTickAt + 1000).error, 'six substitutions are refused');
    // A player twice in the eleven is refused.
    const twice = draftMatch(f);
    twice.lineup[1] = twice.lineup[0];
    assert.ok(confirmMatchDraft(f, twice, f.cup.lastTickAt + 1000).error);
    // A refused draft changes nothing.
    const snapshot = JSON.stringify(f);
    confirmMatchDraft(f, twice, f.cup.lastTickAt + 1000);
    assert.equal(JSON.stringify(f), snapshot);
  });
}

test('a match from before the change (no simulation) keeps its old timing: no new pause, it reaches the end or the shoot out', () => {
  const f = drawnKnockout(true);
  assert.equal(f.cup.phase, 'extra-time');
  assert.equal(f.cup.simulation, undefined, 'a legacy match stays a legacy match');
  assert.equal(f.cup.matchPaused, false, 'no pause is added to a running legacy match');
  let now = f.cup.lastTickAt, guard = 0;
  while (f.cup.active && guard++ < 2000) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    now += 60000;
    play(f, now);
  }
  // It ends in a decision or, when still level after 120 minutes, in the penalty shoot out (which the player takes).
  assert.ok(!f.cup.active || f.cup.phase === 'penalties', `ended or at the shoot out, not stuck (phase ${f.cup.phase}, paused ${f.cup.matchPaused})`);
});
