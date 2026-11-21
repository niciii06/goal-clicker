// Day 7 of the daily reward (the special card pack only, no goals) in German and English: tile, claim button, toast and
// feed texts, and the saved German history lines shown in English. German reads exactly as Sonnet's day 7 change.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const runtime = await import('../app/i18n/runtime.ts');
const { describeDailyReward, getPreviousRewardDay, getRewardDay } = await import('../app/daily-reward.ts');
const { DailyRewardCard } = await import('../app/daily-reward-panel.tsx');

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
const format = (n: number) => Math.floor(n).toLocaleString('de-CH');
function card(streakToday: number, coop = false) {
  const now = Date.UTC(2026, 5, 10, 10), today = getRewardDay(now);
  const state = { solo: { day: getPreviousRewardDay(today), streak: streakToday - 1 } };
  return renderToStaticMarkup(createElement(DailyRewardCard, { state, claimKey: 'solo', now, passivePerSecond: 1e9, clickPower: 1e7, busy: false, coop, onClaim: () => {}, format }));
}
const tileOf = (html: string, label: string) => html.slice(html.indexOf(`${label} 7</small>`), html.indexOf('</li>', html.indexOf(`${label} 7</small>`)));

test('day 7 tile and claim button: German as before, English names only the pack, never goals or a zero', () => {
  german();
  const de = card(7);
  assert.match(de, /<span>Spezialpack<\/span>/);
  assert.match(de, /Prämie abholen · Spezialkarten-Pack<\/button>/);
  english();
  const en = card(7);
  assert.match(en, /<span>Special pack<\/span>/);
  assert.match(en, /Collect reward · special card pack<\/button>/);
  assert.doesNotMatch(tileOf(en, 'Day'), /goals|\+|\d{3}/);
  assert.doesNotMatch(en.slice(en.indexOf('<button')), /goals|Spezial|Prämie/);
  // Day six keeps its goals in both languages.
  assert.match(card(6), /Collect reward · \+[\d,’'&#x;]+ goals<\/button>/);
  german();
  assert.match(card(6), /Prämie abholen · \+[\d’'&#x;]+ Tore<\/button>/);
});

test('toast and feed of a pack only claim, solo and co-op: German equals describeDailyReward, English without goals', () => {
  german();
  assert.equal(runtime.t('logic.dailyToastPackOnlyAlbum', { day: 7 }), `Tag 7: ${describeDailyReward(0, true, format, ' unter Packs & Album')}`);
  assert.equal(runtime.t('logic.dailyToastPackOnlyWorld', { day: 7 }), `Tag 7: ${describeDailyReward(0, true, format, ' für die ganze Welt')}`);
  assert.equal(runtime.t('logic.dailyPackOnly', { dayIndex: 7 }), `Tägliche Prämie Tag 7: ${describeDailyReward(0, true, format)}.`);
  english();
  const en = [runtime.t('logic.dailyToastPackOnlyAlbum', { day: 7 }), runtime.t('logic.dailyToastPackOnlyWorld', { day: 7 }), runtime.t('logic.dailyPackOnly', { dayIndex: 7 })];
  assert.deepEqual(en, ['Day 7: a special card pack under Packs & Album', 'Day 7: a special card pack for the whole world', 'Daily reward day 7: a special card pack.']);
  for (const text of en) assert.doesNotMatch(text, /goals|Tore|\b0\b/);
  german();
  const app = readFileSync('app/game-app.tsx', 'utf8');
  assert.match(app, /data\.dailyReward\.pack && data\.dailyReward\.amount <= 0 \? t\("logic\.dailyToastPackOnlyWorld"/, 'co-op toast');
  assert.match(app, /packOnly \? t\("logic\.dailyToastPackOnlyAlbum"/, 'solo toast');
  assert.match(app, /packOnly \? t\("logic\.dailyPackOnly"/, 'solo feed');
});

test('saved German history lines of a claim are shown in English, the data stays German', () => {
  const coop = 'Lea holt ein Spezialkarten-Pack. Serie: 14 Tage.';
  const solo = `${describeDailyReward(0, true, format)}. Serie: 7 Tage.`;
  const goals = `${describeDailyReward(12500, false, format)}. Serie: 3 Tage.`;
  german();
  for (const line of [coop, solo, goals]) assert.equal(runtime.localizeText(line), line);
  english();
  assert.equal(runtime.localizeText(coop), 'Lea collects a special card pack. Streak: 14 days.');
  assert.equal(runtime.localizeText(solo), 'A special card pack. Streak: 7 days.');
  assert.match(runtime.localizeText(goals), /^\+12[’',]500 goals\. Streak: 3 days\.$/);
  assert.equal(runtime.localizeText('Tägliche Prämie · Tag 7'), 'Daily reward · day 7');
  german();
});
