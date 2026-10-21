import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialGameFeatures, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, getStarXIPlayer, getStarXIPositions, normalizeGameFeatures, advanceCupMatch, resumeCupMatch } from '../app/feature-data';
import { prepareCareerMatch } from '../app/career-data';
import { createInteractiveMatch } from '../app/interactive-match';
import { TravelStatsPanel } from '../app/travel-panel';
import { emptyTravel } from '../app/travel-data';

function fixture(seed = 1) {
  const f = initialGameFeatures(1000000 + seed);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map(p => p.id) });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000 + seed, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  return f;
}
function complete(f: ReturnType<typeof fixture>) {
  for (let i = 0; i < 1000 && f.cup.active; i++) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    const now = Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 360000);
    f.cup = advanceCupMatch(f.cup, 85, now, () => { throw Error('Unseeded RNG consumed'); }, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
  }
  return f;
}

test('Pfuschi has exactly 67 OVR and nothing else changed', () => {
  const pfuschi = STAR_XI_PLAYERS.filter(p => p.name === 'Pfuschi');
  assert.equal(pfuschi.length, 1, 'no second Pfuschi card');
  const p = getStarXIPlayer('star-pfuschi')!;
  assert.equal(p.rating, 67);
  assert.equal(p.name, 'Pfuschi');
  assert.equal(p.position, null);
  assert.deepEqual(getStarXIPositions(p), []);
  assert.equal(p.benchOnly, true);
  assert.equal(p.isCustom, true);
  assert.equal(p.cardType, 'legendary');
  assert.equal(p.symbol, '☠️');
  assert.equal(p.price, 1000);
  assert.ok(Object.values(p.originalAttributes!.stats).every(s => s.value === 1), 'special attributes stay untouched');
  // Owned Pfuschi cards in old saves keep their ID and collection status.
  const f = initialGameFeatures();
  f.starXI.ownedIds = [...f.starXI.ownedIds, 'star-pfuschi'];
  const restored = normalizeGameFeatures(JSON.parse(JSON.stringify(f)));
  assert.ok(restored.starXI.ownedIds.includes('star-pfuschi'));
  assert.ok(!setBestStarXI(restored.starXI).lineupIds.includes('star-pfuschi'), 'still bench only');
});

test('player names carry no artificial numeric disambiguation suffix', () => {
  for (const p of STAR_XI_PLAYERS) assert.doesNotMatch(p.name, /\s\d+$/, `${p.id} ${p.name}`);
  // The two Simeone cards stay two different players with their own IDs and source records.
  const giovanni = getStarXIPlayer('star-fc26-0710')!, giuliano = getStarXIPlayer('star-fc26-1328')!;
  assert.equal(giovanni.name, 'G. Simeono');
  assert.equal(giuliano.name, 'G. Simeono');
  assert.notEqual(giovanni.id, giuliano.id);
  assert.notEqual(giovanni.sourceId, giuliano.sourceId);
  assert.equal(new Set(STAR_XI_PLAYERS.map(p => p.id)).size, STAR_XI_PLAYERS.length, 'IDs stay unique');
});

test('the removed match tactics no longer change the simulation', () => {
  const base = fixture(77);
  const variants = (['angriff', 'konter', 'ballbesitz'] as const).map(strategy => {
    const f = structuredClone(base);
    f.cup.strategyId = strategy;
    f.cup.opponentStrategyId = strategy;
    f.cup.simulation = createInteractiveMatch(f.cup, f.starXI.lineupIds, f.starXI.formationId);
    complete(f);
    return JSON.stringify({ score: [f.cup.homeScore, f.cup.awayScore], goals: f.cup.matchEvents.map(e => [e.scorerId, e.minute]), stats: f.cup.broadcast?.clubStats });
  });
  assert.equal(variants[0], variants[1]);
  assert.equal(variants[1], variants[2]);
  // Saves with an old tactic preference still load.
  const legacy = JSON.parse(JSON.stringify(base));
  legacy.cup.strategyId = 'angriff';
  assert.equal(normalizeGameFeatures(legacy).cup.active, true);
});

test('club passport keeps its data in the club page component', () => {
  const travel = emptyTravel();
  travel.stats = { ...travel.stats, trips: 3, km: 1234.4, countries: ['Schweiz', 'Italien'], furthest: { opponent: 'Inter Milano', km: 230 }, opponents: { 'milan:Inter Milano': { name: 'Inter Milano', trips: 2 } } };
  const html = renderToStaticMarkup(createElement(TravelStatsPanel, { travel, now: 0, clubName: 'FC Test' }));
  assert.match(html, /CLUBPASS \/ FC TEST/);
  // The de-CH group separator depends on the ICU version (’ or '); React escapes the plain apostrophe.
  assert.ok(html.includes((1234).toLocaleString('de-CH').replaceAll("'", '&#x27;')), 'formatted distance');
  assert.match(html, /Inter Milano · 2 Reisen/);
  assert.match(html, /Schweiz · Italien/);
});
