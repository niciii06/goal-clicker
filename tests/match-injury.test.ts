// Notion P2 «Bei Spieler-Verletzung sofort automatisch die Wechselansicht öffnen»: which pause opens the substitutions
// by itself. Only an own player's injury that paused the match does, keyed by the injury event, not by its time.
import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceCupMatch, beginSeasonCupMatch, getStarXISelection, initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_XI_PLAYERS } from '../app/feature-data';
import type { GameFeatures } from '../app/feature-data';
import { prepareCareerMatch } from '../app/career-data';
import { requestMatchEdit } from '../app/match-commands';
import { pendingOwnInjury } from '../app/match-injury';

function live(now: number) {
  const f = normalizeGameFeatures(initialGameFeatures(now));
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => p.rating < 97 && !p.isCustom).slice(0, 80).map((p) => p.id) });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, now, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}
/** Plays matches with the game's own step until it stops at the wanted pause. */
function playUntil(want: 'injury' | 'halftime'): GameFeatures {
  for (let i = 0; i < 400; i++) {
    const start = 2_000_000_000_000 + i * 11, f = live(start);
    let cup = f.cup;
    for (let t = start + 500; t < start + 300_000; t += 500) {
      cup = advanceCupMatch(cup, 85, t, Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
      if (cup.lastInjury) { if (want === 'injury') return { ...f, cup }; break; }
      if (cup.matchPaused) { if (want === 'halftime' && cup.simulation?.status === 'halftime') return { ...f, cup }; break; }
    }
  }
  throw new Error(`no ${want} found`);
}

test('an own injury that paused the match is pending, with its place in the eleven', () => {
  const f = playUntil('injury');
  assert.equal(f.cup.matchPaused, true); assert.equal(f.cup.simulation?.status, 'editing');
  const injury = pendingOwnInjury(f)!;
  assert.ok(injury, 'pending');
  assert.equal(injury.slot, f.starXI.lineupIds.indexOf(f.cup.lastInjury!.playerId));
  assert.equal(injury.player, f.cup.lastInjury!.player);
  assert.ok(injury.key.includes(f.cup.lastInjury!.id) && injury.key.startsWith(f.cup.careerMatchId!));
});

test('the key follows the injury event, not its time: a pause shift keeps it, another event changes it', () => {
  const f = playUntil('injury'), key = pendingOwnInjury(f)!.key;
  const shifted = structuredClone(f); shifted.cup.lastInjury = { ...shifted.cup.lastInjury!, createdAt: shifted.cup.lastInjury!.createdAt + 90_000 };
  assert.equal(pendingOwnInjury(shifted)!.key, key);
  const other = structuredClone(f); other.cup.lastInjury = { ...other.cup.lastInjury!, id: `${other.cup.lastInjury!.id}-2` };
  assert.notEqual(pendingOwnInjury(other)!.key, key);
});

test('ordinary pauses and settled injuries open nothing', () => {
  assert.equal(pendingOwnInjury(playUntil('halftime')), null, 'half time');
  const f = playUntil('injury');
  const resumed = structuredClone(f); resumed.cup.matchPaused = false; resumed.cup.simulation!.status = 'running';
  assert.equal(pendingOwnInjury(resumed), null, 'played on');
  const manual = live(2_000_000_000_000); const paused = requestMatchEdit(manual, 2_000_000_030_000);
  paused.cup = { ...paused.cup, matchPaused: true, simulation: paused.cup.simulation ? { ...paused.cup.simulation, status: 'editing' } : undefined, lastInjury: null };
  assert.equal(pendingOwnInjury(paused), null, 'a manual pause without injury');
  const penalties = structuredClone(f); penalties.cup.phase = 'penalties';
  assert.equal(pendingOwnInjury(penalties), null, 'penalties');
  const sentOff = structuredClone(f); sentOff.cup.sentOffPlayerIds = [...sentOff.cup.sentOffPlayerIds, sentOff.cup.lastInjury!.playerId];
  assert.equal(pendingOwnInjury(sentOff), null, 'not in the eleven any more');
  const ended = structuredClone(f); ended.cup.active = false;
  assert.equal(pendingOwnInjury(ended), null, 'match over');
});
