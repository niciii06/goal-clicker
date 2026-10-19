import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialGameFeatures, normalizeGameFeatures, purchaseSpecialCardPack, getSpecialCardPackOdds, SPECIAL_CARD_PACK, STAR_XI_CUSTOM_PLAYERS, STAR_XI_PLAYERS, setBestStarXI, beginSeasonCupMatch, getStarXISelection, advanceCupMatch, resumeCupMatch } from '../app/feature-data';
import { getReachedLeague, hasReachedLeague, isLeagueContentUnlocked, leagueForTier, getPackUnlockLeague, getTournamentUnlockLeague, getFormationUnlockLeague, getUpgradeUnlockLeague } from '../app/season-progression';
import { prepareCareerMatch, recordCareerMatch } from '../app/career-data';
import { PlayerStatsSummary } from '../app/career-panels';

test('league numbers count down: Liga 15 is the entry, Liga 1 the top', () => {
  assert.equal(leagueForTier(1), 15);
  assert.equal(leagueForTier(15), 1);
  assert.equal(getReachedLeague(0), 15, 'a new save starts in Liga 15');
  assert.equal(getReachedLeague(4), 11);
  // Lower numbers are more progress, the comparison must not be reversed.
  assert.equal(hasReachedLeague(10, 5), true, 'Liga 5 has passed Liga 10');
  assert.equal(hasReachedLeague(5, 10), false, 'Liga 10 has not reached Liga 5');
  assert.equal(hasReachedLeague(5, 5), true);
});

test('every former season requirement maps to its league equivalent', () => {
  assert.equal(getPackUnlockLeague('scout'), 15);
  assert.equal(getPackUnlockLeague('elite'), 11, 'was Saison 5');
  assert.equal(getPackUnlockLeague('legend'), 6, 'was Saison 10');
  assert.equal(getPackUnlockLeague(SPECIAL_CARD_PACK.id), 15, 'the fragment pack stays available from the start');
  assert.equal(getTournamentUnlockLeague('champions'), 10, 'was Saison 6');
  assert.equal(getTournamentUnlockLeague('world'), 4, 'was Saison 12');
  assert.equal(getFormationUnlockLeague('541'), 1);
  assert.equal(getUpgradeUnlockLeague('legacy'), 2);
  assert.equal(isLeagueContentUnlocked(getPackUnlockLeague('legend'), getReachedLeague(8), false), false);
  assert.equal(isLeagueContentUnlocked(getPackUnlockLeague('legend'), getReachedLeague(9), false), true);
  assert.equal(isLeagueContentUnlocked(1, 15, true), true, 'test mode keeps its bypass');
});

test('unlocks are permanent: relegation and old saves keep their entitlements', () => {
  // Reached Liga 6 once (division 10), then relegated to Liga 8: the legend pack stays unlocked.
  const save = { seasons: 9, highestDivision: 10, currentDivision: 8 };
  assert.equal(getReachedLeague(save.seasons, save.highestDivision), 6);
  assert.equal(isLeagueContentUnlocked(getPackUnlockLeague('legend'), getReachedLeague(save.seasons, save.highestDivision)), true);
  // A save whose season counter is ahead of the league (older clicker progress) is never downgraded.
  assert.equal(getReachedLeague(12, 3), 3);
  // A save whose season counter lags behind the league uses the league.
  assert.equal(getReachedLeague(0, 7), 9);
});

test('displayed requirements and purchase checks use the same league rules', async () => {
  const [page, api] = await Promise.all([readFile(new URL('../app/page.tsx', import.meta.url), 'utf8'), readFile(new URL('../app/api/multiplayer/route.ts', import.meta.url), 'utf8')]);
  assert.doesNotMatch(page, /Ab Saison|in Saison \$\{unlock|Freischaltung in Saison|SAISON \$\{unlock/);
  assert.match(page, /Verfügbar ab Liga \$\{unlockLeague\}/);
  assert.doesNotMatch(api, /in Saison \$\{(?:upgrade|formation|pack|tournament)Unlock/);
  assert.doesNotMatch(page, /FRAGMENTE \/ SPEZIALKARTEN|custom-card-shop/, 'the standalone fragment section is gone');
  assert.match(page, /SPECIAL_CARD_PACK\.label/);
});

test('fragments buy the special card pack exactly once per purchase', () => {
  const f = initialGameFeatures(1000);
  f.starXI.fragments = 60000;
  const ownedBefore = f.starXI.ownedIds.length;
  const first = purchaseSpecialCardPack(f, 'buy-1', { random: () => 0, now: 5000 });
  assert.ok(first.ok);
  assert.equal(first.reveal.player.id, STAR_XI_CUSTOM_PLAYERS[0].id, 'awards the card drawn by the pack logic');
  assert.equal(first.reveal.packName, 'Spezialkarten-Pack');
  assert.equal(f.starXI.fragments, 60000 - SPECIAL_CARD_PACK.price);
  assert.ok(f.starXI.ownedIds.includes(first.reveal.player.id), 'the collection updates immediately');
  assert.equal(f.starXI.ownedIds.length, ownedBefore + 1);
  // The same request again (double click or network retry) changes nothing.
  const snapshot = JSON.stringify(f);
  const retry = purchaseSpecialCardPack(f, 'buy-1', { random: () => 0, now: 5001 });
  assert.equal(retry.ok, false);
  assert.ok(!retry.ok && retry.duplicateRequest);
  assert.equal(JSON.stringify(f), snapshot);
  // Receipts survive save and reload.
  const reloaded = normalizeGameFeatures(JSON.parse(snapshot));
  assert.equal(purchaseSpecialCardPack(reloaded, 'buy-1').ok, false);
  // A duplicate card refunds fragments without a second inventory entry.
  const duplicate = purchaseSpecialCardPack(f, 'buy-2', { random: () => 0, now: 6000 });
  assert.ok(duplicate.ok && duplicate.reveal.duplicate);
  assert.equal(f.starXI.ownedIds.filter(id => id === STAR_XI_CUSTOM_PLAYERS[0].id).length, 1);
  assert.equal(f.starXI.fragments, 60000 - 2 * SPECIAL_CARD_PACK.price + duplicate.reveal.fragmentCompensation);
});

test('insufficient fragments and live matches block the purchase without side effects', () => {
  const f = initialGameFeatures(1000);
  f.starXI.fragments = SPECIAL_CARD_PACK.price - 1;
  const before = JSON.stringify(f);
  const poor = purchaseSpecialCardPack(f, 'poor');
  assert.equal(poor.ok, false);
  assert.equal(JSON.stringify(f), before);
  f.starXI.fragments = SPECIAL_CARD_PACK.price;
  f.cup.active = true;
  assert.equal(purchaseSpecialCardPack(f, 'live').ok, false);
  assert.equal(f.starXI.fragments, SPECIAL_CARD_PACK.price);
  const odds = getSpecialCardPackOdds([]);
  assert.equal(odds.total, STAR_XI_CUSTOM_PLAYERS.length);
  assert.ok(Math.abs(odds.perCard * odds.total - 1) < 1e-12);
  assert.equal(odds.newCard, 1);
});

test('player statistics equal the authoritative match records and are counted once', () => {
  const f = initialGameFeatures(1000000);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.map(p => p.id) });
  f.cup = beginSeasonCupMatch(f.cup, f.seasonMode, 1000000, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions, f.starXI.lineupIds, f.starXI.benchIds);
  prepareCareerMatch(f);
  for (let i = 0; i < 1000 && f.cup.active; i++) {
    if (f.cup.matchPaused) f.cup = resumeCupMatch(f.cup, f.cup.lastTickAt);
    f.cup = advanceCupMatch(f.cup, 85, Math.min(f.cup.matchEndsAt, f.cup.lastTickAt + 360000), Math.random, getStarXISelection(f.starXI.ownedIds, f.starXI.lineupIds), f.starXI.formationPositions).cup;
  }
  recordCareerMatch(f, f.cup.lastTickAt);
  const report = f.career.reports.at(-1)!;
  for (const p of report.players) {
    const career = f.career.players[p.playerId];
    assert.equal(career.appearances, 1);
    assert.equal(career.goals, p.goals);
    assert.equal(career.assists, p.assists);
  }
  const ownGoals = f.cup.matchEvents.filter(e => e.side === 'home');
  assert.equal(report.players.reduce((n, p) => n + p.goals, 0), ownGoals.length, 'goals come from real match events');
  const once = JSON.stringify(f.career);
  recordCareerMatch(f, f.cup.lastTickAt + 1000);
  assert.equal(JSON.stringify(f.career), once, 'reprocessing the same match does not count twice');
  const scorer = ownGoals[0]?.scorerId ?? report.players[0].playerId;
  const html = renderToStaticMarkup(createElement(PlayerStatsSummary, { features: f, playerId: scorer, view: 'career', onView: () => {} }));
  assert.match(html, /Spielerstatistik/);
  assert.match(html, new RegExp(`<dt>Spiele</dt><dd>1</dd><dt>Tore</dt>|<dt>Spiele</dt><dd>1</dd>`));
  assert.match(html, new RegExp(`<dt>Tore</dt><dd>${f.career.players[scorer].goals}</dd>`));
  assert.match(html, new RegExp(`<dt>Assists</dt><dd>${f.career.players[scorer].assists}</dd>`));
});
