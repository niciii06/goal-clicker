// Owner decision 4 (2026-11-06): the goalkeeper's rating changes the goals conceded, for both sides alike, and a side
// whose keeper left puts an outfield player in goal who keeps badly.
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, resumeCupMatch } from '../app/feature-data';
import { emptyPlayerStats, prepareCareerMatch } from '../app/career-data';
import { createInteractiveMatch, ensureKeepers } from '../app/interactive-match';
import type { SimCheckpoint, SimPlayer } from '../app/interactive-match';
import { shotQuality } from '../app/match-ai';
import { EMPTY_GOAL_FACTOR, keeperGoalFactor, keeperSkill, STAND_IN_KEEPING_CAP } from '../app/football-rules';

function fixture(seed = 1) {
  const f = initialGameFeatures(1000000 + seed);
  for (const p of STAR_XI_PLAYERS.filter(p => p.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map(p => p.id) }, [], { career: f.career });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f); return f;
}
const keeper = (c: SimCheckpoint, side: SimPlayer['side']) => c.players.find(p => p.active && p.side === side && p.role === 'TW');

test('keeper factor: better keepers concede less, a keeper of the shooter level keeps the old value', () => {
  for (const level of [45, 70, 95]) {
    assert.ok(Math.abs(keeperGoalFactor(level, level) - (1.38 - level / 280)) < 1e-9, 'neutral keeper = old engine value');
    assert.ok(keeperGoalFactor(level + 10, level) < keeperGoalFactor(level, level));
    assert.ok(keeperGoalFactor(level - 10, level) > keeperGoalFactor(level, level));
  }
  assert.equal(keeperGoalFactor(undefined, 80), EMPTY_GOAL_FACTOR);
  assert.ok(keeperGoalFactor(20, 80) < EMPTY_GOAL_FACTOR, 'a stand-in is still better than an empty goal');
  assert.ok(keeperGoalFactor(20, 80) > keeperGoalFactor(80, 80) * 1.25, 'but much worse than a real keeper');
  assert.equal(keeperSkill({ rating: 88, keeping: 92 }), 88);
  assert.equal(keeperSkill({ rating: 88, keeping: 92, standInRole: 'IV' }), STAND_IN_KEEPING_CAP);
  assert.equal(keeperSkill({ rating: 88, keeping: 22, standInRole: 'IV' }), 22);
});

test('the keeper changes the chance of a shot, the same way for both sides', () => {
  const f = fixture(3), c = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId).committed;
  for (const side of ['club', 'opponent'] as const) {
    const shooter = c.players.find(p => p.side === side && p.role !== 'TW')!, goalkeeper = keeper(c, side === 'club' ? 'opponent' : 'club')!;
    const from = { x: (c.direction > 0) === (side === 'club') ? 84 : 21, y: 26 };
    for (const p of c.players) if (p.side !== side && p !== goalkeeper) { p.x = 52.5; p.y = 66; } // nobody in the way
    const quality = (rating: number) => { goalkeeper.rating = rating; return shotQuality(c, shooter, from); };
    const weak = quality(shooter.rating - 15), equal = quality(shooter.rating), strong = quality(shooter.rating + 15);
    assert.ok(weak > equal && equal > strong, `${side}: ${weak} > ${equal} > ${strong}`);
    goalkeeper.rating = shooter.rating; goalkeeper.standInRole = 'IV'; goalkeeper.keeping = 20;
    const standInQuality = shotQuality(c, shooter, from);
    assert.ok(standInQuality > equal * 1.1, `${side}: an outfield player in goal concedes more (${standInQuality} vs ${equal})`);
    delete goalkeeper.standInRole;
  }
});

test('a side without a keeper puts an outfield player in goal; a real keeper takes over again', () => {
  const f = fixture(5), sim = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId), c = structuredClone(sim.committed);
  for (const side of ['club', 'opponent'] as const) {
    const original = keeper(c, side)!;
    original.active = false;
    ensureKeepers(sim, c);
    const standIn = keeper(c, side)!;
    assert.ok(standIn && standIn.id !== original.id && standIn.standInRole, `${side}: an outfield player is in goal`);
    assert.notEqual(standIn.standInRole, 'TW');
    assert.ok(keeperSkill(standIn) <= STAND_IN_KEEPING_CAP, 'weak keeping');
    const right = (side === 'club' ? c.direction : -c.direction) > 0;
    assert.equal(standIn.anchor.x, right ? 3 : 102, 'his place is the goal');
    assert.equal(c.players.filter(p => p.active && p.side === side && p.role === 'TW').length, 1);
    ensureKeepers(sim, c);
    assert.equal(keeper(c, side)!.id, standIn.id, 'stable from one play to the next');
    // A keeper comes back (a change at a break): the outfield player returns to his position.
    original.active = true;
    ensureKeepers(sim, c);
    assert.equal(keeper(c, side)!.id, original.id);
    assert.equal(standIn.role, standIn.standInRole ?? standIn.role);
    assert.equal(standIn.standInRole, undefined);
  }
});

test('a whole match with our keeper gone is played to the end with a stand-in in goal', () => {
  let conceded = 0, concededWithKeeper = 0;
  for (let seed = 21; seed <= 30; seed++) {
    for (const withoutKeeper of [true, false]) {
      const f = fixture(seed);
      f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
      if (withoutKeeper) { const k = keeper(f.cup.simulation.committed, 'club')!; k.active = false; f.cup.simulation.buffer = []; }
      for (let i = 0; f.cup.active && i < 1000; i++) {
        if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
        f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 360000), () => { throw Error('Unseeded RNG consumed'); }, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
      }
      assert.ok(!f.cup.active);
      if (withoutKeeper) {
        conceded += f.cup.awayScore;
        const standIn = keeper(f.cup.simulation!.committed, 'club')!;
        assert.ok(standIn.standInRole, 'the stand-in is still in goal at the final whistle');
      } else concededWithKeeper += f.cup.awayScore;
    }
  }
  assert.ok(conceded > concededWithKeeper, `with a stand-in ${conceded} goals against, with the keeper ${concededWithKeeper}`);
});
