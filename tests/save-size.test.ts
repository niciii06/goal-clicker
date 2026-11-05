import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, normalizeGameFeatures, resumeCupMatch, releaseMatchSquad, compactFinishedCup } from '../app/feature-data';
import { emptyPlayerStats, prepareCareerMatch } from '../app/career-data';
import { MatchStatistics } from '../app/match-viewer';
import { PostMatchSummary } from '../app/career-panels';

function runningMatch(seed = 1) {
  const f = initialGameFeatures(1_000_000 + seed);
  for (const p of STAR_XI_PLAYERS.filter((p) => p.potential)) f.career.players[p.id] = { ...emptyPlayerStats(), points: 200 };
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map((p) => p.id) }, [], { career: f.career });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1_000_000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}

/** Plays the match to the final whistle the way page.tsx and the co-op route do (releaseMatchSquad on finish). */
function finish(f: ReturnType<typeof runningMatch>) {
  let guard = 0;
  while (f.cup.active && guard++ < 1000) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    const now = Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 360000);
    const result = advanceCupMatch(f.cup, 85, now, () => 0.5, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions);
    f.cup = result.cup;
    if (result.finished) releaseMatchSquad(f, now);
  }
  assert.equal(f.cup.active, false);
  return f;
}

test('a finished match drops the interactive simulation from the save and keeps the post-match statistics', () => {
  const live = runningMatch(3);
  assert.ok(live.cup.simulation, 'the match runs on the interactive simulation');
  const f = finish(live);
  assert.equal(f.cup.simulation, undefined);
  assert.equal(f.cup.interactiveResult, true);
  assert.doesNotMatch(JSON.stringify(f), /"simulation"/, 'nothing of the simulation is saved');
  // Save round trip: the flag survives, nothing else is lost.
  const loaded = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.equal(loaded.cup.interactiveResult, true);
  assert.equal(loaded.cup.simulation, undefined);
  assert.deepEqual(loaded.cup.matchEvents, normalizeGameFeatures(f).cup.matchEvents);
  assert.equal(JSON.stringify(loaded.cup.broadcast), JSON.stringify(normalizeGameFeatures(f).cup.broadcast));
  assert.equal(JSON.stringify(normalizeGameFeatures(loaded)), JSON.stringify(loaded), 'normalizing again changes nothing');
  // The summary still shows shots, and the statistics still show xG like for a simulated match.
  const summary = renderToStaticMarkup(createElement(PostMatchSummary, { features: loaded, onCareer: () => {}, onContinue: () => {} }));
  assert.match(summary, /Schüsse:/);
  assert.match(renderToStaticMarkup(createElement(MatchStatistics, { features: loaded, clubName: 'FC Test' })), /xG/);
});

test('an old save with a finished match that still holds its simulation loads and is compacted', () => {
  const live = runningMatch(5);
  const simulation = live.cup.simulation;
  const f = finish(live);
  const oldSave = JSON.parse(JSON.stringify({ ...f, cup: { ...f.cup, interactiveResult: undefined, simulation } }));
  assert.ok(oldSave.cup.simulation);
  const loaded = normalizeGameFeatures(oldSave);
  assert.equal(loaded.cup.active, false);
  assert.equal(loaded.cup.simulation, undefined);
  assert.equal(loaded.cup.interactiveResult, true);
  assert.equal(loaded.cup.homeScore, f.cup.homeScore);
  assert.equal(loaded.cup.awayScore, f.cup.awayScore);
  assert.match(renderToStaticMarkup(createElement(PostMatchSummary, { features: loaded, onCareer: () => {}, onContinue: () => {} })), /Schüsse:/);
});

test('a running match keeps its simulation through a save round trip, a new match clears the result flag', () => {
  const live = runningMatch(7);
  assert.equal(compactFinishedCup(live.cup), live.cup);
  const loaded = normalizeGameFeatures(JSON.parse(JSON.stringify(live)));
  assert.ok(loaded.cup.active);
  assert.ok(loaded.cup.simulation);
  assert.equal(loaded.cup.interactiveResult, undefined);
  const done = finish(live);
  const next = beginSeasonCupMatch(done.cup, done.seasonMode, done.cup.lastTickAt + 60_000, getStarXISelection(done.starXI.ownedIds, done.starXI.lineupIds), done.starXI.formationPositions, done.starXI.lineupIds, done.starXI.benchIds);
  assert.equal(next.interactiveResult, undefined);
});

test('a legacy match without simulation does not claim interactive statistics', () => {
  const f = initialGameFeatures(1);
  const loaded = normalizeGameFeatures({ ...f, cup: { ...f.cup, active: false, matchStartedAt: 5, interactiveResult: 'yes' } });
  assert.equal(loaded.cup.interactiveResult, undefined);
});
