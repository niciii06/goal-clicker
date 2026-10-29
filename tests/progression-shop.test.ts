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
  assert.equal(getPackUnlockLeague('scrap'), 15);
  assert.equal(getPackUnlockLeague('regional'), 13);
  assert.equal(getPackUnlockLeague('scout'), 11);
  assert.equal(getPackUnlockLeague('profi'), 9);
  assert.equal(getPackUnlockLeague('elite'), 7);
  assert.equal(getPackUnlockLeague('weltklasse'), 5);
  assert.equal(getPackUnlockLeague('legend'), 4);
  assert.equal(getPackUnlockLeague(SPECIAL_CARD_PACK.id), 3, 'the 100 rated special cards open only in Liga 3');
  assert.equal(getTournamentUnlockLeague('champions'), 10, 'was Saison 6');
  assert.equal(getTournamentUnlockLeague('world'), 4, 'was Saison 12');
  assert.equal(getFormationUnlockLeague('541'), 1);
  assert.equal(getUpgradeUnlockLeague('legacy'), 2);
  assert.equal(isLeagueContentUnlocked(getPackUnlockLeague('legend'), getReachedLeague(10), false), false);
  assert.equal(isLeagueContentUnlocked(getPackUnlockLeague('legend'), getReachedLeague(11), false), true);
  assert.equal(isLeagueContentUnlocked(1, 15, true), true, 'test mode keeps its bypass');
});

test('unlocks are permanent: relegation and old saves keep their entitlements', () => {
  // Reached Liga 6 once (division 10), then relegated to Liga 8: the elite pack (Liga 7) stays unlocked.
  const save = { seasons: 9, highestDivision: 10, currentDivision: 8 };
  assert.equal(getReachedLeague(save.seasons, save.highestDivision), 6);
  assert.equal(isLeagueContentUnlocked(getPackUnlockLeague('elite'), getReachedLeague(save.seasons, save.highestDivision)), true);
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
  // A roll of 0 lands in the rare 100 group and on its first card.
  const firstHundred = STAR_XI_CUSTOM_PLAYERS.find(p => p.rating === 100)!;
  const f = initialGameFeatures(1000);
  f.starXI.fragments = 120000;
  const ownedBefore = f.starXI.ownedIds.length;
  const first = purchaseSpecialCardPack(f, 'buy-1', { random: () => 0, now: 5000 });
  assert.ok(first.ok);
  assert.equal(first.reveal.player.id, firstHundred.id, 'awards the card drawn by the pack logic');
  assert.equal(first.reveal.packName, 'Spezialkarten-Pack');
  assert.equal(f.starXI.fragments, 120000 - SPECIAL_CARD_PACK.price);
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
  assert.equal(f.starXI.ownedIds.filter(id => id === firstHundred.id).length, 1);
  assert.equal(f.starXI.fragments, 120000 - 2 * SPECIAL_CARD_PACK.price + duplicate.reveal.fragmentCompensation);
  assert.ok(duplicate.reveal.fragmentCompensation <= SPECIAL_CARD_PACK.price / 10, 'a duplicate never pays for the next pack');
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
  assert.ok(Math.abs(odds.hundredChance - 0.08) < 1e-12);
  assert.ok(Math.abs(odds.newCard - 1) < 1e-12);
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

test('formation picker lists available formations first, locked ones in unlock order', async () => {
  const { sortFormationsForPicker } = await import('../app/season-progression');
  const { STAR_FORMATIONS } = await import('../app/feature-data');
  const reached = 12;
  const available = (f: { id: string }) => isLeagueContentUnlocked(getFormationUnlockLeague(f.id), reached);
  const sorted = sortFormationsForPicker(STAR_FORMATIONS, available);
  assert.equal(sorted.length, STAR_FORMATIONS.length);
  const firstLocked = sorted.findIndex(f => !available(f));
  assert.ok(firstLocked > 0, 'some formations are available at Liga 12');
  assert.ok(sorted.slice(firstLocked).every(f => !available(f)), 'no available formation after a locked one');
  const lockedLeagues = sorted.slice(firstLocked).map(f => getFormationUnlockLeague(f.id));
  assert.deepEqual(lockedLeagues, [...lockedLeagues].sort((a, b) => b - a), 'locked formations follow the unlock order');
  const availableIds = sorted.slice(0, firstLocked).map(f => f.id);
  assert.deepEqual(availableIds, STAR_FORMATIONS.filter(available).map(f => f.id), 'available formations keep the catalogue order');
});
