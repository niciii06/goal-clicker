import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, getStarXIPlayer, applyCupSubstitution, matchChangeError } from '../app/feature-data';
import type { GameFeatures } from '../app/feature-data';
import { getCareerCard, getPlayerMilestones, prepareCareerMatch } from '../app/career-data';
import { createInteractiveMatch, advanceInteractive } from '../app/interactive-match';
import { confirmMatchDraft, draftMatch, matchBenchPreview, requestMatchEdit, validateMatchDraft } from '../app/match-commands';
import { MatchSquadEditor, MatchSubstitutions, lineupChanges, moveInMatchLineup } from '../app/match-substitutions';

function liveMatch(seed = 11) {
  const f = initialGameFeatures(3000000 + seed);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map(p => p.id) });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 3000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  return f;
}
/** A bench player who fits a starting slot, with the strongest milestone card unlocked. */
function benchSwap(f: GameFeatures) {
  for (let slot = 1; slot < 11; slot++) {
    const incoming = f.starXI.benchIds.find(id => id && getStarXIPlayer(id)!.rating <= 96 && !matchChangeError(f, [{ playerId: id, slot }]));
    if (incoming) return { slot, incoming, outgoing: f.starXI.lineupIds[slot] };
  }
  throw new Error('no compatible bench player');
}
function unlockMilestone(f: GameFeatures, id: string) {
  const player = getStarXIPlayer(id)!, best = [...getPlayerMilestones(f.career, player)].sort((a, b) => b.bonus - a.bonus)[0];
  f.career.milestoneCards[id] = [best.id];
  return getCareerCard(f.career, player).rating;
}

test('match substitutions render the squad board with milestone ratings', () => {
  const f = liveMatch(), { incoming } = benchSwap(f);
  const boosted = unlockMilestone(f, incoming);
  assert.ok(boosted > getStarXIPlayer(incoming)!.rating);
  const html = renderToStaticMarkup(createElement(MatchSubstitutions, { features: f, disabled: false, onConfirm: () => {}, onClose: () => {} }));
  for (const part of ['starxi-squad-layout', 'starxi-pitch-panel', 'starxi-formation-grid', 'starxi-pitch-slot', 'starxi-bank-panel', 'starxi-player-card bank', 'starxi-position-badges', 'data-squad-area="lineup"', 'data-squad-area="bench"', 'draggable="true"']) assert.ok(html.includes(part), part);
  const card = html.slice(html.indexOf(`>${getStarXIPlayer(incoming)!.name}<`));
  assert.match(card, new RegExp(`<b>${boosted}</b>`), 'bench card shows the milestone rating');
  assert.ok(!html.includes('gc-sub-pitch'), 'the separate substitution pitch is gone');
});

test('the interactive editor uses the same board', () => {
  const f = liveMatch(12);
  const html = renderToStaticMarkup(createElement(MatchSquadEditor, { features: f, title: 'Aufstellung bearbeiten', intro: '', disabled: false, validate: (lineup: string[]) => validateMatchDraft(f, { lineup, formation: f.starXI.formationId }), confirmLabel: () => 'Alles bestätigen', onConfirm: () => {}, onCancel: () => {} }));
  assert.ok(html.includes('starxi-pitch-slot') && html.includes('starxi-player-card bank'));
});

test('dropping a bench card swaps it in and the outgoing player takes its bench place', () => {
  const f = liveMatch(13), { slot, incoming, outgoing } = benchSwap(f);
  const bench = matchBenchPreview(f, f.starXI.lineupIds);
  const benchIndex = bench.indexOf(incoming);
  const next = moveInMatchLineup(f.starXI.lineupIds, bench, { playerId: incoming, area: 'bench', index: benchIndex }, { area: 'lineup', index: slot })!;
  assert.equal(next[slot], incoming);
  assert.equal(matchBenchPreview(f, next)[benchIndex], outgoing);
  assert.deepEqual(lineupChanges(f, next), [{ playerId: incoming, slot }]);
  assert.equal(matchChangeError(f, lineupChanges(f, next)), '');
  // Dragging the starter onto that bench card is the same substitution.
  assert.deepEqual(moveInMatchLineup(f.starXI.lineupIds, bench, { playerId: outgoing, area: 'lineup', index: slot }, { area: 'bench', index: benchIndex }), next);
  // Queued live changes only accept bench players, so swapping two starters is rejected there.
  const swapped = moveInMatchLineup(f.starXI.lineupIds, bench, { playerId: f.starXI.lineupIds[1], area: 'lineup', index: 1 }, { area: 'lineup', index: 2 })!;
  assert.notEqual(matchChangeError(f, lineupChanges(f, swapped)), '');
});

test('substitutes enter the simulation with their milestone rating', () => {
  const plain = liveMatch(14), { slot, incoming } = benchSwap(plain), boosted = structuredClone(plain);
  unlockMilestone(boosted, incoming);
  const enter = (f: GameFeatures) => {
    prepareCareerMatch(f);
    f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
    f = requestMatchEdit(f, f.cup.matchStartedAt + 30000);
    f.cup = advanceInteractive(f.cup, f.cup.matchStartedAt + 36000);
    const draft = draftMatch(f);
    draft.lineup[slot] = incoming;
    const result = confirmMatchDraft(f, draft, f.cup.lastTickAt + 1000);
    assert.equal(result.error, '');
    return result.features.cup.simulation!.committed.players.find(p => p.id === incoming)!.rating;
  };
  assert.ok(enter(boosted) > enter(plain));
});

test('the substitution impact compares prepared match ratings', () => {
  const f = liveMatch(15), { incoming, outgoing } = benchSwap(f);
  f.cup.careerBonuses = { [incoming]: 3, [outgoing]: 0 };
  const impact = applyCupSubstitution(f.cup, outgoing, incoming, 60);
  assert.equal(impact.ratingDelta, Math.min(100, getStarXIPlayer(incoming)!.rating + 3) - getStarXIPlayer(outgoing)!.rating);
});

test('two taps swap or substitute like a drag, in either order, and a third tap on the pick clears it', async () => {
  const { resolveSquadTap } = await import('../app/squad-board');
  type Source = import('../app/game/types').SquadDragSource; type Target = import('../app/game/types').SquadDropTarget;
  const f = liveMatch(5), lineup = [...f.starXI.lineupIds], bench = matchBenchPreview(f, lineup), { slot, incoming } = benchSwap(f);
  const canDrop = (source: Source, target: Target) => Boolean(moveInMatchLineup(lineup, bench, source, target));
  const benchIndex = bench.indexOf(incoming);
  const slotPick = { source: { playerId: lineup[slot], area: 'lineup' as const, index: slot }, target: { area: 'lineup' as const, index: slot } };
  const benchPick = { source: { playerId: incoming, area: 'bench' as const, index: benchIndex }, target: { area: 'bench' as const, index: benchIndex } };
  // Pitch player first, then the bench card: the bench player comes on for him.
  assert.deepEqual(resolveSquadTap(slotPick, benchPick, canDrop), { move: [slotPick.source, benchPick.target] });
  // Bench card first, then the pitch player: the same substitution.
  assert.deepEqual(resolveSquadTap(benchPick, slotPick, canDrop), { move: [benchPick.source, slotPick.target] });
  // Two pitch players swap their places.
  const other = { source: { playerId: lineup[slot === 1 ? 2 : 1], area: 'lineup' as const, index: slot === 1 ? 2 : 1 }, target: { area: 'lineup' as const, index: slot === 1 ? 2 : 1 } };
  const swap = resolveSquadTap(slotPick, other, canDrop);
  assert.ok('move' in swap);
  const swapped = moveInMatchLineup(lineup, bench, ...swap.move)!;
  assert.equal(swapped[slot], lineup[other.target.index]);
  assert.equal(swapped[other.target.index], lineup[slot]);
  // Tapping the pick again clears it; a move that is not allowed picks the new spot instead.
  assert.deepEqual(resolveSquadTap(slotPick, slotPick, canDrop), { pick: null });
  assert.deepEqual(resolveSquadTap(slotPick, other, () => false), { pick: other });
  assert.deepEqual(resolveSquadTap(null, benchPick, canDrop), { pick: benchPick });
});
