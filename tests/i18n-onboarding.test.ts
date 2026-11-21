// English release check on 955e410 (Notion «Englische Release-Abnahme auf 955e410»): the four German texts on the
// first path of a new player. German reads exactly as before, saved values stay German, English shows English.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const runtime = await import('../app/i18n/runtime.ts');
const { dataText } = await import('../app/i18n/data-text.ts');
const { UpgradeHints } = await import('../app/qol/shop-hints.tsx');
const { stadiumLabel, stadiumProfile } = await import('../app/stadium-profiles.ts');
const { HOME_VENUE } = await import('../app/travel-geography.ts');
const { getSeasonMilestone } = await import('../app/season-roadmap.ts');
const { beginSeasonCupMatch, getStarXISelection, initialGameFeatures, normalizeGameFeatures, setBestStarXI, STAR_XI_PLAYERS, advanceCupMatch, resumeCupMatch } = await import('../app/feature-data.ts');

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
const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the goals still missing under an upgrade: "noch 10" in German, "10 to go" in English', () => {
  const props = { gain: { id: 'boots', cost: 15, passiveGain: 0, clickGain: 1, paybackSeconds: null }, best: false, goals: 5, passivePerSecond: 0, pinned: false, onPin: () => {}, format: (n: number) => String(n) };
  german();
  assert.match(text(React.createElement(UpgradeHints, props)), /noch 10/);
  english();
  const en = text(React.createElement(UpgradeHints, props));
  assert.match(en, /10 to go/);
  assert.doesNotMatch(en, /noch/);
  german();
  assert.doesNotMatch(readFileSync('app/qol/shop-hints.tsx', 'utf8'), />noch /);
});

test('Home season heading and unlocks: shown through dataText, German unchanged, English translated', () => {
  const page = readFileSync('app/game-app.tsx', 'utf8');
  assert.match(page, /<h2>\{dataText\(currentSeasonMilestone\.title\)\}<\/h2>/);
  assert.match(page, /title=\{dataText\(currentSeasonMilestone\.title\)\}/);
  assert.match(page, /✓ \{dataText\(reward\)\}/);
  const first = getSeasonMilestone(1);
  german();
  assert.equal(dataText(first.title), 'Der Anpfiff');
  for (const reward of first.rewards) assert.equal(dataText(reward), reward);
  english();
  assert.equal(dataText(first.title), 'The kick-off');
  assert.notEqual(dataText(first.title), 'Der Anpfiff');
  const rewards = first.rewards.map((reward) => dataText(reward));
  assert.deepEqual(rewards.filter((reward) => /Basis Upgrades|Schrott-Pack|Stadionpokal|Formationen/.test(reward)), [], `English rewards: ${rewards.join(' · ')}`);
  german();
});

test('the stadium line of the first match: German exactly as before, English with its own words and number format', () => {
  const profile = { ...stadiumProfile(HOME_VENUE, { homeDivision: 1, seed: 'x', home: true }), attendance: 1230, capacity: 4000 };
  const estimated = { ...profile, capacitySource: 'estimated' as const };
  const known = { ...profile, capacitySource: 'known' as const };
  german();
  const oldLabel = (p: typeof profile) => `${p.name} · ${{ amateur: 'Amateurplatz', regional: 'Regionaler Fussballplatz', 'pro-small': 'Kleines Profistadion', 'pro-medium': 'Mittelgrosses Profistadion', national: 'Grosses Stadion', elite: 'Elitestadion' }[p.category]} · ${p.attendance.toLocaleString('de-CH')} Zuschauer${p.capacitySource === 'estimated' ? ' (Kapazität geschätzt)' : ` von ${p.capacity.toLocaleString('de-CH')}`}`;
  assert.equal(stadiumLabel(known), oldLabel(known));
  assert.equal(stadiumLabel(estimated), oldLabel(estimated));
  english();
  const en = stadiumLabel(known);
  assert.match(en, /^Home ground Bümplizstrasse 45 · .+ · 1,230 of 4,000 spectators$/);
  assert.doesNotMatch(en + stadiumLabel(estimated), /Zuschauer|Heimstadion|Amateurplatz|Kapazität/);
  assert.match(stadiumLabel(estimated), /1,230 spectators \(capacity estimated\)$/);
  german();
});

test('the first line of the match summary: the saved German line stays, English shows it in English', () => {
  german();
  const now = 2_000_000_000_000;
  const f = initialGameFeatures(now);
  f.starXI = setBestStarXI({ ...f.starXI, ownedIds: STAR_XI_PLAYERS.filter((p) => p.rating < 90 && !p.isCustom).slice(0, 40).map((p) => p.id) });
  const features = normalizeGameFeatures(f);
  // A decided league match played to the final whistle by the game itself (seeded; a draw would go to penalties).
  const play = (seed: number) => {
    let a = seed >>> 0; const random = () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    let c = beginSeasonCupMatch(features.cup, features.seasonMode, now, getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds), features.starXI.formationPositions, features.starXI.lineupIds, features.starXI.benchIds);
    for (let i = 0; i < 2000 && c.active; i++) { if (c.matchPaused) c = resumeCupMatch(c, c.lastTickAt); c = advanceCupMatch(c, 85, Math.min(c.matchEndsAt, c.lastTickAt + 20000), random, getStarXISelection(features.starXI.ownedIds, features.starXI.lineupIds), features.starXI.formationPositions).cup; }
    return c;
  };
  let cup = play(1);
  for (let seed = 2; seed < 40 && (cup.active || cup.homeScore === cup.awayScore); seed++) cup = play(seed);
  const saved = cup.lastResult;
  assert.match(saved, /^\d+:\d+ gegen .+ beendet\.$/, 'the game still saves the German line');
  assert.equal(runtime.localizeText(saved), saved);
  english();
  const en = runtime.localizeText(saved);
  assert.equal(en, `Full time: ${cup.homeScore}:${cup.awayScore} against ${cup.opponent}.`);
  assert.equal(cup.lastResult, saved, 'showing it never changes the saved value');
  german();
  assert.match(readFileSync('app/career-panels.tsx', 'utf8'), /<p>\{localizeText\(c\.lastResult\)\}/);
});
