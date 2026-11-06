// Quality of life (audit section E): status signals, shopping hints, toasts, preferences and squad helpers.
import assert from 'node:assert/strict';
import test from 'node:test';
import { STAR_XI_PLAYERS, initialGameFeatures, normalizeGameFeatures, setBestStarXI, getStarXIPlayer, canStarXIPlayerFillSlot } from '../app/feature-data.ts';
import { appBadgeCount, formatAwayDuration, getOpenActions, readyMiniGames, returnSummary, sectionBadges, statusTitle } from '../app/qol/status.ts';
import { bestValueUpgrade, formatEta, nextLevelGain, savingsHint, secondsUntilAffordable } from '../app/qol/economy-hints.ts';
import { nextToast, pushToast, toastDuration } from '../app/qol/toast-queue.ts';
import { parsePurchaseMode, parseSavingsGoal, pickStringFields } from '../app/qol/prefs.ts';
import { describeReplacements, fillStarXIGaps, lineupChanges, ratingAfterLineupMove, formatRatingDelta, lineupRating } from '../app/game/lineup-tools.ts';
import { UPGRADES } from '../app/game/upgrades.ts';
import { getUpgradeCostAtLevel } from '../app/upgrade-purchase.ts';
import { formatNumber } from '../app/game/format.ts';

const NOW = Date.parse('2026-11-06T12:00:00Z');

function squadFeatures() {
  const features = initialGameFeatures();
  features.starXI.ownedIds = STAR_XI_PLAYERS.filter((player) => player.rating < 90 && !player.benchOnly).slice(0, 60).map((player) => player.id);
  features.starXI = setBestStarXI(features.starXI);
  return normalizeGameFeatures(features);
}

test('open actions: daily reward, unopened packs, Fabrizio offer and the tab title', () => {
  const features = initialGameFeatures();
  features.earnedPacks.push({ id: 'p1', packId: 'reward-1', earnedAt: NOW });
  const actions = getOpenActions({ features, now: NOW });
  const ids = actions.map((action) => action.id);
  assert.ok(ids.includes('daily'), 'a club that never claimed has the daily reward ready');
  assert.ok(ids.includes('packs'));
  assert.equal(actions.find((action) => action.id === 'packs')?.section, 'packs');
  assert.deepEqual(Object.keys(sectionBadges(actions)).sort(), ['home', 'packs']);
  assert.equal(appBadgeCount(actions), 2);
  assert.equal(statusTitle('Home', features, NOW, actions), '🎁 Prämie bereit · Home · Goal Clicker');
  assert.equal(statusTitle('Home', features, NOW, []), 'Home · Goal Clicker');
});

test('tab title shows the live score and minute', () => {
  const features = initialGameFeatures();
  features.cup = { ...features.cup, active: true, phase: 'regular', homeScore: 2, awayScore: 1, matchStartedAt: NOW - 120_000, matchEndsAt: NOW + 120_000 };
  const title = statusTitle('Spiele', features, NOW, []);
  assert.match(title, /^⚽ 2:1 · \d+′ · Goal Clicker$/);
});

test('mini games are ready again only after they were played', () => {
  assert.deepEqual(readyMiniGames({ penalty: 0, dribble: NOW - 1, crossbar: NOW + 5000 }, NOW), ['dribble']);
  assert.equal(appBadgeCount([{ id: 'minigame', label: 'x', tab: 'home', section: 'home', count: 1 }]), 0, 'mini games are no app badge');
});

test('return summary names how long the player was away and what waits', () => {
  assert.equal(formatAwayDuration(8 * 3600_000 + 12 * 60_000), '8 h 12 min');
  assert.equal(formatAwayDuration(30_000), 'unter 1 min');
  assert.equal(formatAwayDuration(26 * 3600_000), '1 Tag 2 h');
  assert.equal(returnSummary(35 * 60_000, [{ id: 'daily', label: 'Tagesprämie bereit', tab: 'home', section: 'home', count: 1 }]), '35 min weg · Tagesprämie bereit');
});

test('next level gain, payback and the best value upgrade', () => {
  const upgrades: Record<string, number> = {};
  const auto = UPGRADES.filter((upgrade) => upgrade.kind === 'auto').slice(0, 3);
  const gains = auto.map((upgrade) => nextLevelGain(upgrade, upgrades, 0));
  for (const gain of gains) {
    assert.ok(gain.passiveGain > 0, `${gain.id} adds passive income`);
    assert.ok(Math.abs(gain.paybackSeconds! - gain.cost / gain.passiveGain) < 1e-9);
  }
  const best = bestValueUpgrade(gains);
  const fastest = [...gains].sort((a, b) => a.paybackSeconds! - b.paybackSeconds!)[0];
  assert.equal(best, fastest.id);
  const click = UPGRADES.find((upgrade) => upgrade.kind === 'click')!;
  const clickGain = nextLevelGain(click, upgrades, 0);
  assert.ok(clickGain.clickGain > 0);
  assert.equal(bestValueUpgrade([clickGain]), null, 'click upgrades have no passive payback');
});

test('upgrade hints use the shared rounded level price', () => {
  for (const upgrade of UPGRADES.filter((item) => item.kind === 'auto').slice(0, 3)) {
    for (const level of [0, 1, 5, 17]) {
      const gain = nextLevelGain(upgrade, { [upgrade.id]: level }, 0);
      assert.equal(gain.cost, getUpgradeCostAtLevel(upgrade, level), `${upgrade.id} level ${level}`);
      assert.ok(Math.abs(gain.paybackSeconds! - gain.cost / gain.passiveGain) < 1e-9);
    }
  }
});

test('time until affordable', () => {
  assert.equal(secondsUntilAffordable(1000, 400, 10), 60);
  assert.equal(secondsUntilAffordable(1000, 2000, 10), 0);
  assert.equal(secondsUntilAffordable(1000, 400, 0), null);
  assert.equal(formatEta(60), 'ca. 1 min');
  assert.equal(formatEta(61), 'ca. 2 min');
  assert.equal(formatEta(3 * 3600), 'ca. 3 h');
  assert.equal(savingsHint(12_400, 0, 100, formatNumber), `noch ${formatNumber(12_400)} · ca. 3 min`);
  assert.equal(savingsHint(100, 200, 1, formatNumber), '');
});

test('toasts queue instead of overwriting, small click messages never push others away', () => {
  let state = pushToast({ current: null, queue: [] }, { text: 'Pack gekauft', priority: 'info' });
  state = pushToast(state, { text: 'Kritischer Abschluss', priority: 'minor' });
  assert.equal(state.current?.text, 'Pack gekauft');
  assert.equal(state.queue.length, 0, 'a click message is dropped while something else shows');
  state = pushToast(state, { text: 'Zweite Meldung', priority: 'info' });
  state = pushToast(state, { text: 'Fehler beim Speichern', priority: 'error' });
  assert.deepEqual(state.queue.map((item) => item.text), ['Fehler beim Speichern', 'Zweite Meldung']);
  state = nextToast(state);
  assert.equal(state.current?.text, 'Fehler beim Speichern');
  let minor = pushToast({ current: null, queue: [] }, { text: 'Kritischer Abschluss', priority: 'minor' });
  minor = pushToast(minor, { text: 'Wichtig', priority: 'info' });
  assert.equal(minor.current?.text, 'Wichtig', 'a real message replaces a click message at once');
  assert.equal(toastDuration({ text: 'kurz', priority: 'info' }), 2500);
  assert.equal(toastDuration({ text: 'x'.repeat(80), priority: 'info' }), 4800);
});

test('preferences validate what they read', () => {
  assert.equal(parsePurchaseMode('10'), 10);
  assert.equal(parsePurchaseMode('max'), 'max');
  assert.equal(parsePurchaseMode('7'), 1);
  assert.equal(parsePurchaseMode(null), 1);
  assert.deepEqual(pickStringFields({ sort: 'name', type: 'bogus', only: true }, { sort: 'ovr', type: 'all', only: false }, { type: ['all', 'icon'] }), { sort: 'name', type: 'all', only: true });
  assert.deepEqual(parseSavingsGoal({ kind: 'pack', id: 'profi' }), { kind: 'pack', id: 'profi' });
  assert.equal(parseSavingsGoal({ kind: 'car', id: 'x' }), null);
});

test('fill gaps replaces an injured starter with the fitting bench player and keeps everyone else', () => {
  const features = squadFeatures();
  const before = features.starXI;
  const slot = before.lineupIds.findIndex((id, index) => id && before.benchIds.some((benchId) => benchId && canStarXIPlayerFillSlot(benchId, index, before.formationPositions)));
  assert.ok(slot >= 0);
  const injured = before.lineupIds[slot];
  features.cup.injuredPlayerIds = { [injured]: 2 };
  const { starXI, replacements } = fillStarXIGaps(features);
  assert.notEqual(starXI.lineupIds[slot], injured);
  assert.ok(starXI.lineupIds[slot]);
  assert.ok(!starXI.lineupIds.includes(injured) && !starXI.benchIds.includes(injured));
  for (let index = 0; index < 11; index += 1) if (index !== slot) assert.equal(starXI.lineupIds[index], before.lineupIds[index], 'other places stay as chosen');
  const lineupReplacement = replacements.find((entry) => entry.area === 'lineup');
  assert.equal(lineupReplacement?.outId, injured);
  assert.equal(lineupReplacement?.reason, 'verletzt');
  assert.match(describeReplacements(replacements)[0], new RegExp(`ersetzt ${getStarXIPlayer(injured)!.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(verletzt\\)`));
  assert.equal(starXI.benchIds.filter(Boolean).length, before.benchIds.filter(Boolean).length, 'the bench place is refilled from the reserve');
});

test('fill gaps with a full squad changes nothing', () => {
  const features = squadFeatures();
  const { starXI, replacements } = fillStarXIGaps(features);
  assert.deepEqual(replacements, []);
  assert.deepEqual(starXI.lineupIds, features.starXI.lineupIds);
});

test('lineup changes and the rating after a move', () => {
  const features = squadFeatures();
  const before = features.starXI;
  const after = { ...before, lineupIds: [...before.lineupIds] };
  const swapped = after.lineupIds[3];
  after.lineupIds[3] = '';
  const changes = lineupChanges(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].outId, swapped);
  assert.ok(lineupRating(after) <= lineupRating(before));
  const benchId = before.benchIds.find(Boolean)!;
  const slot = before.lineupIds.findIndex((_, index) => canStarXIPlayerFillSlot(benchId, index, before.formationPositions));
  const rating = ratingAfterLineupMove(before, benchId, slot);
  assert.equal(typeof rating, 'number');
  assert.equal(formatRatingDelta(2), '+2 OVR');
  assert.equal(formatRatingDelta(-1), '−1 OVR');
  assert.equal(formatRatingDelta(0), '± 0 OVR');
});
