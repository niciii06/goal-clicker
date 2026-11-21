// The DE/EN defects found in the QA of the combined candidate (15 November 2026): labels that stayed German in
// English (career statistics, outcomes and streaks, leaderboard sorting, match ratings, archived season names,
// reserve pages, upgrade buy button, Fabrizio's action buttons), the single draw in the form chips, dates in the
// format of the language and the short mobile tab label. German must read exactly as before, saves never change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The panels are imported while the page is German, as in the browser before a language switch: labels built at
// import time would stay German after the switch (the defect of ALL_TIME_COLUMNS, SEASON_OUTCOME_LABELS and SORTS).
const runtime = await import('../app/i18n/runtime.ts');
const { STAR_XI_PLAYERS, beginSeasonCupMatch, cardPackRating, getStarXIPlayer, getStarXISelection, initialGameFeatures, normalizeGameFeatures, recordSeasonModeMatch, setBestStarXI, transferKeepConsequence, TRANSFER_OFFER_DURATION_MS } = await import('../app/feature-data.ts');
type GameFeatures = ReturnType<typeof initialGameFeatures>;
const { emptyPlayerStats, getCareerCard, prepareCareerMatch, recordCareerMatch } = await import('../app/career-data.ts');
const { AllTimePlayerTable, ClubChroniclePanel, MatchRatingsPanel } = await import('../app/career-panels.tsx');
const { LeaderboardPanel } = await import('../app/leaderboard-panel.tsx');
const { SeasonPanel } = await import('../app/season-panel.tsx');
const { TransferOfferActions } = await import('../app/transfer-offer-actions.tsx');
const { dataText } = await import('../app/i18n/data-text.ts');

function english() {
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    window: { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } } },
    navigator: { languages: ['en-GB'], language: 'en-GB' },
    document: { documentElement: { lang: 'de' } },
  });
  runtime.resetLocaleForTests();
  runtime.initLocaleFromDevice();
}
function german() {
  for (const key of ['window', 'navigator', 'document']) delete (globalThis as Record<string, unknown>)[key];
  runtime.resetLocaleForTests();
}
const html = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const START = Date.UTC(2026, 10, 9, 12);
/** A club with three recorded league matches (win, draw, loss), a finished season with promotion and a crowd record. */
function savedClub() {
  const f = initialGameFeatures(START);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => cardPackRating(p) < 95).slice(0, 60).map((p) => p.id) });
  let features = normalizeGameFeatures(f);
  [[3, 0], [1, 1], [0, 2]].forEach(([home, away], i) => {
    const now = START + i * 1000;
    features.cup = beginSeasonCupMatch(features.cup, features.seasonMode, now, getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds), features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
    prepareCareerMatch(features);
    features.cup.homeScore = home; features.cup.awayScore = away; features.cup.active = false;
    const result = recordSeasonModeMatch(features.seasonMode, home, away, features.club.name, now, () => .99, features.cup.opponentIds[0]);
    recordCareerMatch(features, now, result.entry);
    features.seasonMode = result.state;
  });
  features.chronicle.records.recordCrowd = { value: 1234, score: '', opponent: 'FC Testgegner', competition: 'Saison 1', at: START, prestige: 0 };
  features.chronicle.seasons = [{ ...features.chronicle.seasons[0], id: 'season-1', season: 1, prestige: 0, division: 1, place: 1, points: 22, wins: 7, draws: 1, losses: 2, goalsFor: 20, goalsAgainst: 9, topScorer: null, bestPlayerId: null, outcome: 'promoted', at: START } as GameFeatures['chronicle']['seasons'][number]];
  features = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  return features;
}

test('career statistics, outcomes, streaks, match ratings and archived seasons follow the language; German is unchanged', () => {
  german();
  const features = savedClub();
  const saved = JSON.stringify(features);
  assert.equal(features.career.reports.at(-1)?.competition, 'Saison 1', 'the report keeps its German competition name');
  const de = html(React.createElement(ClubChroniclePanel, { features })) + html(React.createElement(AllTimePlayerTable, { features })) + html(React.createElement(MatchRatingsPanel, { features }));
  for (const text of ['Sp.', 'Ø', 'S / U / N', 'ungeschlagen · längste Siegesserie', 'gegen FC Testgegner · Saison 1 · 9.11.2026', `${(1234).toLocaleString('de-CH')} Zuschauer`, 'Aufstieg', 'Saison 1 · 9.11.2026', ' Minuten · ']) assert.ok(de.includes(text), `German: ${text}`);

  english();
  const en = html(React.createElement(ClubChroniclePanel, { features })) + html(React.createElement(AllTimePlayerTable, { features })) + html(React.createElement(MatchRatingsPanel, { features }));
  for (const text of ['Apps', 'Avg', 'W / D / L', 'unbeaten · longest winning run', 'against FC Testgegner · Season 1 · 09/11/2026', `${(1234).toLocaleString('en-GB')} spectators`, 'Promotion', 'Season 1 · 09/11/2026', ' minutes · ']) assert.ok(en.includes(text), `English: ${text}`);
  for (const german of ['Sp.', 'S / U / N', 'ungeschlagen', 'Siegesserie', 'Zuschauer', 'gegen ', 'Aufstieg', 'Saison ', 'Minuten', ' Tore ', '9.11.2026']) assert.ok(!en.includes(german), `no German "${german}" in English`);
  assert.equal(JSON.stringify(features), saved, 'showing the panels in either language never changes the save');
  german();
});

test('one minute, one goal and one spectator take the singular in English; German reads as before', () => {
  english();
  assert.deepEqual([runtime.t('career.reportMinutes', { count: 1 }), runtime.t('career.reportGoals', { count: 1 }), runtime.t('career.spectators', { count: 1 }), runtime.t('career.unbeatenRun', { count: 1 })], ['1 minute', '1 goal', '1 spectator', '1 match unbeaten']);
  german();
  assert.deepEqual([runtime.t('career.reportMinutes', { count: 90 }), runtime.t('career.reportGoals', { count: 2 }), runtime.t('career.unbeatenRun', { count: 1 }), runtime.t('career.unbeatenRun', { count: 4 })], ['90 Minuten', '2 Tore', '1 Spiel ungeschlagen', '4 Spiele ungeschlagen']);
});

test('the stored "Saison 3" of older match reports shows as "Season 3" in English', () => {
  english();
  assert.equal(dataText('Saison 3'), 'Season 3');
  assert.equal(dataText('Liga 15'), 'League 15');
  german();
  assert.equal(dataText('Saison 3'), 'Saison 3');
});

test('leaderboard sorting follows a language switch after the panel module was loaded', () => {
  german();
  assert.match(html(React.createElement(LeaderboardPanel, { playerId: '' })), /Tore .*Liga .*Trophäen/);
  english();
  const en = html(React.createElement(LeaderboardPanel, { playerId: '' }));
  assert.match(en, /Goals .*League .*Trophies/);
  assert.doesNotMatch(en, /Trophäen/);
  german();
});

test('a single drawn match in the form chips is "Draw", wins and losses as before', () => {
  german();
  const features = savedClub();
  const chips = (text: string) => [...text.matchAll(/aria-label="(Win|Draw|Draws|Loss|Sieg|Unentschieden|Niederlage): /g)].map((m) => m[1]);
  english();
  const en = chips(renderToStaticMarkup(React.createElement(SeasonPanel, { features })));
  assert.ok(en.includes('Draw') && !en.includes('Draws'), `English chips: ${en}`);
  german();
  const de = chips(renderToStaticMarkup(React.createElement(SeasonPanel, { features })));
  assert.ok(de.includes('Unentschieden'), `German chips: ${de}`);
});

test('reserve pages, the upgrade buy button and its accessible name in both languages', () => {
  const page = readFileSync('app/game-app.tsx', 'utf8');
  assert.doesNotMatch(page, / von \{reservePageCount\}| bis \{Math\.min|"kaufen"|\$\{dataText\(upgrade\.name\)\} \$\{purchaseLabel\}/);
  german();
  assert.deepEqual([runtime.t('squad.reservePageOf', { page: '1', total: '3' }), runtime.t('squad.reserveRange', { from: '1', to: '48', total: '1097' }), runtime.t('shop.buy'), runtime.t('shop.upgradeAction', { name: 'Schnellere Stiefel', action: runtime.t('shop.buy') })],
    ['Seite 1 von 3', '1 bis 48 von 1097', 'kaufen', 'Schnellere Stiefel kaufen']);
  english();
  assert.deepEqual([runtime.t('squad.reservePageOf', { page: '1', total: '3' }), runtime.t('squad.reserveRange', { from: '1', to: '48', total: '1097' }), runtime.t('shop.buy'), runtime.t('shop.upgradeAction', { name: dataText('Schnellere Stiefel'), action: runtime.t('shop.buyCount', { count: 10 }) })],
    ['Page 1 of 3', '1 to 48 of 1097', 'Buy', 'Buy x10: Faster boots']);
  german();
});

test('the mobile tab of Matches is short in English, the accessible name stays "Matches"; German unchanged', () => {
  const page = readFileSync('app/game-app.tsx', 'utf8');
  assert.match(page, /text:t\('nav\.games'\),short:t\('nav\.gamesShort'\)/);
  english();
  assert.deepEqual([runtime.t('nav.games'), runtime.t('nav.gamesShort')], ['Matches', 'Games']);
  german();
  assert.deepEqual([runtime.t('nav.games'), runtime.t('nav.gamesShort')], ['Spiele', 'Spiele']);
});

test("Fabrizio's action buttons and the consequence of keeping follow the language; German is exactly the old text", () => {
  german();
  const now = START;
  const features = initialGameFeatures(now);
  const normal = STAR_XI_PLAYERS.find((p) => !p.isCustom && !p.isWomen && p.rating < 90)!;
  const woman = STAR_XI_PLAYERS.find((p) => !p.isCustom && p.isWomen && p.rating < 90)!;
  features.starXI = setBestStarXI({ ...features.starXI, ownedIds: [normal.id, woman.id] });
  for (const id of [normal.id, woman.id]) features.career.players[id] = { ...emptyPlayerStats(), appearances: 30, minutes: 2400, goals: 12 };
  const f = normalizeGameFeatures(JSON.parse(JSON.stringify(features)));
  const offer = (player: typeof normal, fee: number) => ({ id: `offer-${player.id}`, outcome: 'offer' as const, playerId: player.id, playerName: player.name, club: 'Testclub', headline: '', message: '', reason: '', fee, createdAt: now, expiresAt: now + TRANSFER_OFFER_DURATION_MS });
  const render = (o: ReturnType<typeof offer>) => html(React.createElement(TransferOfferActions, { offer: o, features: f, now, busy: false, onAnswer: () => {}, onLater: () => {} }));
  const bonus = getCareerCard(f.career, getStarXIPlayer(normal.id)!).bonus;
  assert.ok(bonus > 0);
  const deText = render(offer(normal, 59030));
  assert.ok(deText.includes(`${transferKeepConsequence(f, offer(normal, 59030))} Ohne Antwort verfällt das Angebot in 03:00, er bleibt dann ohne Folgen.`), deText);
  for (const label of ['Verkaufen · +59K Goals', 'Behalten', 'Später entscheiden']) assert.ok(deText.includes(label), label);
  assert.ok(render(offer(normal, 0)).includes('Gehen lassen'));

  english();
  const en = render(offer(normal, 59030));
  assert.ok(en.includes(`Keeping resets his milestones (−${bonus} OVR). He has to earn them again with new appearances. Without an answer the offer lapses in 03:00; he then stays without consequences.`), en);
  for (const label of ['Sell · +59K goals', 'Keep', 'Decide later']) assert.ok(en.includes(label), label);
  assert.doesNotMatch(en, /Verkaufen|Behalten|Später|Ohne Antwort/);
  assert.match(render(offer(woman, 1000)), /resets her milestones .* She has to earn them .* she then stays/);
  assert.ok(render(offer(normal, 0)).includes('Let go') && render(offer(normal, 0)).includes('Keeping has no consequences.'));
  german();
});
