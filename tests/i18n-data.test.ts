// Game data in the chosen language (docs/i18n-plan.md, Etappe 5): the data stays German, dataText() shows it in the
// current language, and nothing English ever reaches a save (history entries keep their German wording).
import assert from 'node:assert/strict';
import test from 'node:test';

const runtime = await import('../app/i18n/runtime.ts');
const { dataText } = await import('../app/i18n/data-text.ts');
const { de } = await import('../app/i18n/messages/de.ts');
const { UPGRADES } = await import('../app/game/upgrades.ts');
const { ACHIEVEMENTS, RANKS, MINI_GAME_NAMES } = await import('../app/game/constants.ts');
const { STAR_PACKS, REWARD_PACKS, SPECIAL_CARD_PACK, initialGameFeatures, getSeasonModeDivisionLabel } = await import('../app/feature-data.ts');
const { TOURNAMENTS } = await import('../app/features/catalog.ts');
const { SEASON_MILESTONES } = await import('../app/season-roadmap.ts');
const { TUTORIAL_INTRO_PAGES, TUTORIAL_STEPS } = await import('../app/tutorial.ts');
const { WEEKLY_METRIC_DEFINITIONS, claimWeeklyGoal, ensureWeeklyGoals, getWeeklyGoalViews } = await import('../app/weekly-goals.ts');

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

const GERMAN_TEXTS = new Set<string>((Object.values(de) as unknown[]).filter((value): value is string => typeof value === 'string'));
const shown = [
  ...UPGRADES.flatMap((u) => [u.name, u.description]),
  ...ACHIEVEMENTS.flatMap((a) => [a.name, a.description]),
  ...RANKS.map((r) => r.name),
  ...Object.values(MINI_GAME_NAMES),
  ...[...STAR_PACKS, ...REWARD_PACKS, SPECIAL_CARD_PACK].flatMap((p) => [p.label, p.description]),
  ...TOURNAMENTS.flatMap((x) => [x.label, x.trophyName, x.description]),
  ...SEASON_MILESTONES.flatMap((m) => [m.title, m.description]),
  ...TUTORIAL_INTRO_PAGES.flatMap((p) => [p.title, p.text]),
  ...TUTORIAL_STEPS.flatMap((s) => [s.title, s.text]),
  ...Object.values(WEEKLY_METRIC_DEFINITIONS).map((d) => d.title),
];

test('every shown game data text has its German wording in the catalogue (or is the same in both languages)', () => {
  const missing = shown.filter((text) => !GERMAN_TEXTS.has(text) && !/^[A-Z][\w .'-]*$/.test(text) && !/^\+\d/.test(text));
  assert.deepEqual(missing, []);
});

test('German shows the data exactly as it is; English translates it and leaves names alone', () => {
  german();
  for (const text of shown) assert.equal(dataText(text), text);
  english();
  assert.equal(dataText('Schnellere Stiefel'), 'Faster boots');
  assert.equal(dataText('Gewöhnlich 55–59'), 'Common 55–59');
  assert.equal(dataText('Gewöhnlich bis 70'), 'Common up to 70');
  assert.equal(dataText('Legendär 100'), 'Legendary 100');
  assert.equal(dataText(getSeasonModeDivisionLabel(1)), 'League 15 · Chaosliga');
  assert.equal(dataText('4 Formationen'), '4 formations');
  assert.equal(dataText('Formation 4-3-3 (4) Offensiv'), 'Formation 4-3-3 (4) Attacking');
  assert.equal(dataText('1’000 Fragmente'), '1,000 fragments');
  assert.equal(dataText('Stadionpokal'), 'Stadium Cup');
  for (const name of ['FC Feierabendbier', 'Bümplizstrasse 45', 'Kylian Mbappé', '']) assert.equal(dataText(name), name);
  // Every upgrade, pack and tournament has an English text.
  for (const text of [...UPGRADES.map((u) => u.name), ...STAR_PACKS.map((p) => p.label), ...TOURNAMENTS.map((x) => x.trophyName)]) {
    if (text !== 'VAR 2.0') assert.notEqual(dataText(text), text, text);
  }
  german();
});

test('a weekly goal shows in English, but its history entry keeps the German title', () => {
  english();
  const now = Date.UTC(2026, 10, 11, 12, 0);
  const features = initialGameFeatures(now);
  ensureWeeklyGoals(features, now, 0);
  features.weekly!.goals = [{ id: `${features.weekly!.week}:1:cleanSheets`, metric: 'cleanSheets', target: 1, reward: { kind: 'fragments', amount: 600 } }];
  features.chronicle.totals.cleanSheets += 1;
  const view = getWeeklyGoalViews(features, 0)[0];
  assert.equal(view.title, 'Clean sheets');
  assert.equal(view.description, 'Keep a clean sheet once.');
  const claim = claimWeeklyGoal(features, view.id, now, 0);
  assert.equal(claim.ok, true);
  assert.equal(features.history[0]?.title, 'Wochenziel erreicht: Zu Null');
  german();
  assert.equal(getWeeklyGoalViews(features, 0)[0].description, 'Spiele einmal zu Null.');
});

test('server answers (multiplayer route) show in English, values included; German stays exactly as the server sent it', () => {
  english();
  assert.equal(runtime.localizeText('Dieser Raum ist bereits voll. Maximal vier Spieler können gemeinsam spielen.'), 'This room is already full. At most four players can play together.');
  assert.equal(runtime.localizeText('Das Turnier ist ab Liga 12 verfügbar.'), 'The tournament is available from league 12.');
  assert.equal(runtime.localizeText('Schnellere Stiefel kostet 1’200 Tore.'), 'Faster boots costs 1’200 goals.');
  assert.equal(runtime.localizeText('Neo ist nach der Roten Karte für die nächste Partie gesperrt.'), 'Neo is suspended for the next match after the red card.');
  assert.equal(runtime.localizeText('Eine Meldung, die der Katalog nicht kennt.'), 'Eine Meldung, die der Katalog nicht kennt.');
  german();
  assert.equal(runtime.localizeText('Das Turnier ist ab Liga 12 verfügbar.'), 'Das Turnier ist ab Liga 12 verfügbar.');
});

test('every server answer in the catalogue is a text the server really sends', async () => {
  const { readFileSync } = await import('node:fs');
  const route = readFileSync('app/api/multiplayer/route.ts', 'utf8');
  const server = Object.entries(de).filter(([key, value]) => key.startsWith('server.') && key !== 'server.unavailable' && typeof value === 'string') as [string, string][]; // server.unavailable: the account API (Etappe 1)
  assert.ok(server.length > 80);
  for (const [key, text] of server) {
    // Placeholders stand for ${…} in the route; the words around them must be there as written.
    for (const part of text.split(/\{\w+\}/).map((piece) => piece.trim()).filter((piece) => piece.length > 3)) assert.ok(route.includes(part), `${key}: "${part}"`);
  }
});

test('saved history entries show in English when displayed; the saved German text stays exactly as it is', () => {
  english();
  const saved = [
    { title: 'Saisonspiel · Sieg', detail: '2:1 gegen FC Goal · Spieltag 3/10' },
    { title: 'Stadionpokal gewonnen', detail: 'Elfmeterschiessen gewonnen · Trophäe erhalten · Kleines Prämienpack' },
    { title: 'Runde 2 gewonnen', detail: 'Runde 3 läuft bereits' },
    { title: 'Wochenziel erreicht: Zu Null', detail: '+600 Fragmente' },
    { title: 'Neuer Host', detail: 'Ein Eintrag, den der Katalog nicht kennt.' },
  ];
  const before = JSON.stringify(saved);
  assert.deepEqual(saved.map((entry) => [runtime.localizeText(entry.title), runtime.localizeText(entry.detail)]), [
    ['Season match · Win', '2:1 against FC Goal · matchday 3/10'],
    ['Stadium Cup won', 'Shoot-out won · trophy received · Small reward pack'],
    ['Round 2 won', 'Round 3 is already under way'],
    ['Weekly goal reached: Clean sheets', '+600 Fragmente'],
    ['New host', 'Ein Eintrag, den der Katalog nicht kennt.'],
  ]);
  assert.equal(JSON.stringify(saved), before, 'displaying never changes the saved entries');
  german();
  assert.equal(runtime.localizeText('Runde 2 gewonnen'), 'Runde 2 gewonnen');
});

test('co-op history entries written by the multiplayer route show in English too', () => {
  english();
  assert.equal(runtime.localizeText('Mia hat die Welt verlassen. Leo ist jetzt Host.'), 'Mia left the world. Leo is now host.');
  assert.equal(runtime.localizeText('Mia wurde vom Host aus der Welt entfernt.'), 'Mia was removed from the world by the host.');
  assert.equal(runtime.localizeText('Leo holt 1’200 Tore und ein Prämienpack. Serie: 7 Tage.'), 'Leo collects 1’200 goals and a reward pack. Streak: 7 days.');
  assert.equal(runtime.localizeText('Schnellere Stiefel auf Level 4 (+3).'), 'Faster boots to level 4 (+3).');
  assert.equal(runtime.localizeText('Neo war 7 Tage nicht aktiv. Mia ist jetzt Host dieser Welt.'), 'Neo was not active for 7 days. Mia is now host of this world.');
  german();
});

test('the squad tools (pin, fill gaps, best bench) come from the catalogue in both languages', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync('app/game-app.tsx', 'utf8');
  assert.doesNotMatch(page, /"Fixieren"|>Beste Bank<|>Lücken füllen \(/);
  assert.match(page, /t\("squad\.pin"\)/);
  assert.match(page, /t\("squad\.fillGapsCount", \{ count: squadGapCount \}\)/);
  assert.match(page, /t\("logic\.bestBench"\)/);
  english();
  assert.deepEqual([runtime.t('squad.pin'), runtime.t('squad.fillGapsCount', { count: 2 }), runtime.t('logic.bestBench')], ['Pin', 'Fill gaps (2)', 'Best bench']);
  german();
  assert.deepEqual([runtime.t('squad.pin'), runtime.t('squad.fillGapsCount', { count: 2 }), runtime.t('logic.bestBench')], ['Fixieren', 'Lücken füllen (2)', 'Beste Bank']);
});
