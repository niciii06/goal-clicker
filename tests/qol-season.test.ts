// Quality of life for matches, the season tab, the history and co-op invites (audit section E5, E6).
import assert from 'node:assert/strict';
import test from 'node:test';
import { initialGameFeatures, normalizeGameFeatures, SEASON_MODE_DIVISION_COUNT } from '../app/feature-data.ts';
import type { SeasonResult, SeasonTableRow } from '../app/feature-data.ts';
import { formGuide, formMatches, formMatchLabel, promotionOutlook, seasonTopScorers } from '../app/qol/season-insights.ts';
import { SeasonPanel } from '../app/season-panel.tsx';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { abandonTournamentRun, canAbandonTournament } from '../app/game/tournament-abandon.ts';
import { filterHistory, historyActors, historyTopic } from '../app/qol/history-filter.ts';
import { inviteUrl, joinCodeFromSearch, shortcutFor } from '../app/qol/invite.ts';
import { reserveCardType, filterAndSortReserve } from '../app/game/reserve-filter.ts';
import { albumGroupIncludes, nationGroupScope } from '../app/career-data.ts';
import { STAR_XI_PLAYERS, toggleFavoriteCard } from '../app/feature-data.ts';

const row = (id: string, points: number, played: number, goalsFor = 0, goalsAgainst = 0): SeasonTableRow => ({ id, name: id, rating: 60, played, wins: 0, draws: 0, losses: 0, goalsFor, goalsAgainst, points } as SeasonTableRow);

test('form guide lists the last five results of a team, oldest first', () => {
  const results: SeasonResult[] = [
    { matchday: 1, homeId: 'club', awayId: 'a', homeScore: 2, awayScore: 0 },
    { matchday: 2, homeId: 'b', awayId: 'club', homeScore: 1, awayScore: 1 },
    { matchday: 3, homeId: 'club', awayId: 'c', homeScore: 0, awayScore: 3 },
  ];
  assert.deepEqual(formGuide('club', results), ['S', 'U', 'N']);
  assert.deepEqual(formGuide('a', results), ['N']);
});

test('promotion outlook: sure, gap with games left, impossible', () => {
  const sure = [row('club', 27, 9), row('a', 24, 9), row('b', 9, 9), row('c', 6, 9), row('d', 3, 9), row('e', 0, 9)];
  assert.equal(promotionOutlook(sure, [], 3), 'Aufstieg sicher');
  const chase = [row('a', 15, 6), row('b', 12, 6), row('club', 9, 6), row('c', 6, 6), row('d', 3, 6), row('e', 0, 6)];
  assert.equal(promotionOutlook(chase, [], 3), '3 Punkte Rückstand auf Platz 2 · noch 4 Spiele');
  const gone = [row('a', 27, 9), row('b', 25, 9), row('club', 20, 9), row('c', 6, 9), row('d', 3, 9), row('e', 0, 9)];
  assert.equal(promotionOutlook(gone, [], 3), 'Aufstieg nicht mehr möglich · noch 1 Spiel');
  const top = [row('club', 27, 9), row('a', 20, 9), row('b', 9, 9), row('c', 6, 9), row('d', 3, 9), row('e', 0, 9)];
  assert.equal(promotionOutlook(top, [], SEASON_MODE_DIVISION_COUNT), 'Hall of Fame sicher');
});

test('season top scorers come from the season statistics', () => {
  const top = seasonTopScorers({ a: { goals: 2, assists: 1, appearances: 3 }, b: { goals: 5, assists: 0, appearances: 4 }, c: { goals: 0, assists: 4, appearances: 4 } });
  assert.deepEqual(top.map((entry) => entry.playerId), ['b', 'a']);
});

test('giving up a waiting tournament run ends it like an elimination', () => {
  const features = initialGameFeatures();
  assert.equal(canAbandonTournament(features), false);
  assert.equal(abandonTournamentRun(features, 1000), null);
  features.cup = { ...features.cup, mode: 'tournament', tournamentId: 'stadium', pendingNextRound: true, round: 2, matchStartedAt: 500 };
  const now = 10_000;
  const after = abandonTournamentRun(normalizeGameFeatures(features), now)!;
  assert.equal(after.cup.pendingNextRound, false);
  assert.equal(after.cup.round, 0);
  assert.ok(after.cup.nextTournamentAt > now, 'the usual break follows');
  assert.equal(after.earnedPacks.length, 0, 'no reward pack');
  assert.equal(after.cup.trophies.stadium, 0, 'no trophy');
  assert.match(after.history.at(-1)!.title, /aufgegeben/);
});

test('history topics, member filter and old entries', () => {
  assert.equal(historyTopic({ title: 'Saisonspiel · Sieg' }), 'matches');
  assert.equal(historyTopic({ title: 'Formation angepasst', kind: 'squad' }), 'squad');
  assert.equal(historyTopic({ title: 'Upgrade gekauft', kind: 'upgrade' }), 'club');
  assert.equal(historyTopic({ title: 'Doppelter Star: X' }), 'packs');
  const entries = [{ title: 'Saisonspiel · Sieg', actor: 'Silvan' }, { title: 'Upgrade gekauft', kind: 'upgrade' as const, actor: 'Nicolas' }, { title: 'Clubprofil aktualisiert' }];
  assert.deepEqual(historyActors(entries), ['Nicolas', 'Silvan']);
  assert.equal(filterHistory(entries, 'all', 'Silvan').length, 1);
  assert.equal(filterHistory(entries, 'club', '').length, 2);
});

test('invite link, join code and keyboard shortcuts', () => {
  assert.equal(inviteUrl('https://goal.example/', 'ABC123'), 'https://goal.example/home?join=ABC123');
  assert.equal(joinCodeFromSearch('?join=abc123'), 'ABC123');
  assert.equal(joinCodeFromSearch('?join=ABC'), '');
  assert.deepEqual(shortcutFor({ key: '3' }, false), { kind: 'tab', index: 2 });
  assert.equal(shortcutFor({ key: '3', targetTag: 'input' }, false), null);
  assert.equal(shortcutFor({ key: '3', ctrlKey: true }, false), null);
  assert.deepEqual(shortcutFor({ key: 'ArrowDown' }, true), { kind: 'penalty', direction: 'center' });
  assert.equal(shortcutFor({ key: '1' }, true), null, 'no tab change during a shootout');
});

test('reserve: sort, type and availability filters', () => {
  const entries = [
    { id: 'scrap-1', name: 'Bert', positions: ['ST' as const], rating: 50, type: 'scrap' as const, order: 0, status: 'available' as const },
    { id: 'b', name: 'Anna', positions: ['TW' as const], rating: 80, type: 'base' as const, order: 2, status: 'injured' as const, favorite: true },
    { id: 'c', name: 'Cleo', positions: ['IV' as const], rating: 70, type: 'icon' as const, order: 1, status: 'banned' as const, isNew: true },
  ];
  const ids = (options: Record<string, string>) => filterAndSortReserve(entries, { search: '', ratingFilter: 'all', positionFilter: 'all', ...options }).map((entry) => entry.id);
  assert.deepEqual(ids({ sort: 'name' }), ['b', 'scrap-1', 'c']);
  assert.deepEqual(ids({ sort: 'new' }), ['b', 'c', 'scrap-1']);
  assert.deepEqual(ids({ sort: 'position' }), ['b', 'c', 'scrap-1']);
  assert.deepEqual(ids({ type: 'scrap' }), ['scrap-1']);
  assert.deepEqual(ids({ status: 'injured' }), ['b']);
  assert.deepEqual(ids({ status: 'favorite' }), ['b']);
  assert.deepEqual(ids({ status: 'new' }), ['c']);
  assert.equal(reserveCardType({ id: 'scrap-9' }), 'scrap');
  assert.equal(reserveCardType({ id: 'x', isCustom: true }), 'special');
  assert.equal(reserveCardType({ id: 'x', cardType: 'icon' }), 'icon');
});

test('album: group membership for the missing view and honest nation labels', () => {
  const icon = STAR_XI_PLAYERS.find((player) => player.cardType === 'icon')!;
  assert.equal(albumGroupIncludes('icons', icon), true);
  assert.equal(albumGroupIncludes('base', icon), false);
  assert.equal(nationGroupScope('DE'), 'Frauen und Icons');
  assert.equal(nationGroupScope('IN'), '', 'a nation with men cards needs no note');
});

test('favourites: only own cards, saved optionally, old saves unchanged', () => {
  const features = initialGameFeatures();
  const id = STAR_XI_PLAYERS[0].id;
  assert.equal(toggleFavoriteCard(features, id), false);
  features.starXI.ownedIds = [id];
  assert.equal(toggleFavoriteCard(features, id), true);
  assert.deepEqual(normalizeGameFeatures(features).favoriteIds, [id]);
  toggleFavoriteCard(features, id);
  assert.equal('favoriteIds' in features, false);
  assert.equal('favoriteIds' in normalizeGameFeatures(initialGameFeatures()), false);
});

test('form boxes name their real match: matchday, home or away, opponent and result', () => {
  const results: SeasonResult[] = [
    { matchday: 1, homeId: 'club', awayId: 'a', homeScore: 2, awayScore: 0 },
    { matchday: 2, homeId: 'b', awayId: 'club', homeScore: 1, awayScore: 1 },
    { matchday: 5, homeId: 'c', awayId: 'club', homeScore: 1, awayScore: 2 },
  ];
  const names: Record<string, string> = { club: 'FC Goal', a: 'FC Aarau', b: 'FC Basel', c: 'FC Luzern' };
  const nameOf = (id: string) => names[id];
  const matches = formMatches('club', results);
  assert.deepEqual(matches.map((match) => match.letter), ['S', 'U', 'S'], 'letters and order are unchanged');
  assert.deepEqual(formGuide('club', results), matches.map((match) => match.letter));
  assert.equal(formMatchLabel(matches[2], nameOf), 'Spieltag 5 · Auswärts · FC Luzern 1:2 FC Goal');
  assert.equal(formMatchLabel(matches[0], nameOf), 'Spieltag 1 · Heim · FC Goal 2:0 FC Aarau');
  assert.equal(matches[1].opponentId, 'b');
  // Only the last five matches count, never invented ones.
  const many: SeasonResult[] = Array.from({ length: 8 }, (_, index) => ({ matchday: index + 1, homeId: 'club', awayId: 'a', homeScore: 1, awayScore: 0 }));
  assert.deepEqual(formMatches('club', many).map((match) => match.matchday), [4, 5, 6, 7, 8]);
});

test('the season table ends with Form, then Pkt (points last)', () => {
  const features = initialGameFeatures();
  features.seasonMode.results = [{ matchday: 1, homeId: 'club', awayId: features.seasonMode.table[1].id, homeScore: 3, awayScore: 1 }];
  const html = renderToStaticMarkup(createElement(SeasonPanel, { features }));
  const header = html.match(/<thead>[\s\S]*?<\/thead>/)![0];
  const labels = [...header.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((match) => match[1]);
  assert.deepEqual(labels, ['#', 'Club', 'Sp', 'S', 'U', 'N', 'Tore', '+/-', 'Form', 'Pkt']);
  // Every body row follows the same order: the form cell (buttons) comes directly before the points cell.
  for (const body of html.match(/<tr class="[^"]*">[\s\S]*?<\/tr>/g) ?? []) assert.match(body, /<\/td><td><b>\d+<\/b><\/td><\/tr>$/);
  assert.match(html, /<button type="button" class="season-form-chip form-S" aria-label="Sieg: Spieltag 1 · Heim · /);
});
