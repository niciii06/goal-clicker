// English leaks after the 955e410 release check: press conference, substitution counters, career milestones and form
// labels, reward pack odds. German reads exactly as before and the saved data stays German; English shows English.
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const runtime = await import('../app/i18n/runtime.ts');
const { placeholders } = await import('../app/i18n/translate.ts');
const { dataText } = await import('../app/i18n/data-text.ts');
const { pressDe } = await import('../app/i18n/messages/press.de.ts');
const { pressEn } = await import('../app/i18n/messages/press.en.ts');
const { PRESS_QUESTIONS, answerPressConference, getPressConference, normalizePress } = await import('../app/press-conference.ts');
const { PressConferencePanel } = await import('../app/press-conference-panel.tsx');
const { initialGameFeatures, normalizeGameFeatures, REWARD_PACKS, getRewardPackOdds } = await import('../app/feature-data.ts');
const { CAREER_MILESTONES, MILESTONE_METRIC_LABELS } = await import('../app/career-data.ts');

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
const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const GERMAN = /[äöüÄÖÜ]|\b(und|der|die|das|den|dem|nicht|ist|gegen|für|noch|auf|wird|nach|Wechsel|Fenster|Tore|Fans im|Fanstimmung|Wirkung|PRESSEKONFERENZ|MEDIENPRÄMIE|Gewöhnlich|Profi|Selten|Torjäger|Einsätze|Vereinstreue|Spielmacher|Clubheld|Dauerbrenner|Vorlagengeber|Formtief|Stabil|Basiskarte)\b/;

test('every press question and answer: German catalogue equals the game data, English has it with the same placeholders', () => {
  const de = pressDe as Record<string, string>, en = pressEn as Record<string, string>;
  let count = 0;
  for (const q of PRESS_QUESTIONS) {
    for (const [key, source] of [[`press.q.${q.id}`, q.text], ...q.answers.map((a, i) => [`press.a.${q.id}.${i}`, a.text])]) {
      count++;
      assert.equal(de[key], source, key);
      assert.ok(en[key], `${key} missing in English`);
      assert.deepEqual(placeholders(en[key]), placeholders(source), key);
      assert.doesNotMatch(en[key].replace('Bümplizstrasse', ''), /[äöüÄÖÜ]|\{(er|Er|ihn|ihm|sein|Sein|seine|seinen|diesem Spieler)\}/, key);
    }
  }
  assert.equal(count, PRESS_QUESTIONS.length * 4);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort());
});

// A finished career match won 2:0 at home with a goal by a known player, so the scorer questions can come up too.
function finishedMatch(seed: string) {
  const f = normalizeGameFeatures(initialGameFeatures(2_000_000_000_000));
  f.cup = { ...f.cup, active: false, careerMatchId: seed, matchStartedAt: 1, homeScore: 2, awayScore: 0, opponent: 'FC Testwil', penaltyEvents: [], matchEvents: [] };
  return f;
}
const panel = (f: ReturnType<typeof finishedMatch>) => React.createElement(PressConferencePanel, { features: f, busy: false, reward: 1200, onAnswer: () => {}, format: (n: number) => String(n) });

test('press conference panel: German exactly as the game built it, English translated for many matches', () => {
  for (let i = 0; i < 40; i++) {
    const f = finishedMatch(`match-${i}`);
    const conference = getPressConference(f.press, f.cup, f.club.name)!;
    german();
    const de = text(panel(f));
    assert.ok(de.startsWith('PRESSEKONFERENZ · MEDIENPRÄMIE +1200 TORE'), de);
    assert.ok(de.includes(conference.text), de);
    for (const answer of conference.answers) assert.ok(de.includes(answer.text.replace(/'/g, '&#x27;')) || de.includes(answer.text), answer.text);
    assert.ok(de.includes('Deine Antwort beeinflusst die Stimmung der Fans im Stadion.'));
    english();
    const en = text(panel(f));
    assert.ok(en.startsWith('PRESS CONFERENCE · MEDIA BONUS +1200 GOALS'), en);
    assert.doesNotMatch(en.replace(/FC Testwil|Bümplizstrasse|Fabrizio Romario|Heinz/g, ''), GERMAN, en);
    assert.match(en, /Fan mood/);
    // The answer is saved in German; the answered panel shows it in English.
    const result = answerPressConference(f.press, f.cup, f.club.name, conference.matchId, conference.question.id, 1, 5)!;
    const answered = { ...f, press: result.press };
    assert.equal(result.press.last!.answer, conference.answers.find((a) => a.index === 1)!.text, 'saved answer stays German');
    const shownEn = text(panel(answered));
    assert.match(shownEn, /^PRESS CONFERENCE · ANSWERED «.+» Effect on the fans: [+-]\d+ Fan mood/);
    assert.doesNotMatch(shownEn.replace(/FC Testwil|Bümplizstrasse|Fabrizio Romario|Heinz/g, ''), GERMAN, shownEn);
    german();
    assert.ok(text(panel(answered)).includes(`«${result.answer}» Wirkung auf die Fans: `));
  }
  assert.deepEqual(normalizePress(undefined).answered, []);
});

test('substitution counters: German as before, English with plural', () => {
  german();
  assert.equal(runtime.t('subs.left', { count: 3 }), '3 Wechsel übrig ·');
  assert.equal(runtime.t('subs.left', { count: 1 }), '1 Wechsel übrig ·');
  assert.equal(`${runtime.t('subs.fixedDuringMatch')} ${runtime.t('subs.usedOf', { used: 2, max: 5 })}`, 'Während des Spiels fest · 2 von 5 Wechseln genutzt');
  assert.equal(runtime.t('viewer.subsAndWindows', { used: 2, windows: 1 }), '2/5 Wechsel · 1/3 Fenster');
  english();
  assert.equal(runtime.t('subs.left', { count: 3 }), '3 substitutions left ·');
  assert.equal(runtime.t('subs.left', { count: 1 }), '1 substitution left ·');
  assert.equal(runtime.t('subs.usedOf', { used: 2, max: 5 }), '2 of 5 substitutions used');
  assert.equal(runtime.t('viewer.subsAndWindows', { used: 2, windows: 1 }), '2/5 subs · 1/3 windows');
  german();
});

test('career milestones, metric names, form labels and the milestone history line', () => {
  german();
  for (const m of CAREER_MILESTONES) assert.equal(runtime.localizeText(m.label), m.label);
  for (const label of ['In Form', 'Formtief', 'Stabil']) assert.equal(runtime.localizeText(label), label);
  english();
  for (const m of CAREER_MILESTONES) assert.doesNotMatch(runtime.localizeText(m.label), GERMAN, m.label);
  assert.equal(runtime.localizeText('Torjäger 2'), 'Goalscorer 2');
  for (const metric of Object.values(MILESTONE_METRIC_LABELS)) assert.doesNotMatch(runtime.localizeText(metric), GERMAN, metric);
  assert.deepEqual(['In Form', 'Formtief', 'Stabil', 'Basiskarte'].map((x) => runtime.localizeText(x)), ['In form', 'Out of form', 'Steady', 'Base card']);
  assert.equal(runtime.localizeText('Torjäger 1-Karte freigeschaltet'), 'Goalscorer 1 card unlocked');
  assert.equal(runtime.localizeText('Lea Muster · 10 Tore. Die stärkste Version ist automatisch aktiv.'), 'Lea Muster · 10 Goals. The strongest version is active automatically.');
  assert.equal(runtime.localizeText('«Exactly.» · Fanstimmung +3'), '«Exactly.» · Fan mood +3');
  assert.equal(runtime.localizeText('«Leidenschaft.» · Fanstimmung +5'), '«Passion.» · Fan mood +5');
  german();
});

test('reward pack odds rows: German as saved, English tiers', () => {
  german();
  const rows = REWARD_PACKS.flatMap((pack) => getRewardPackOdds(pack.id as never).map((o) => o.label));
  assert.ok(rows.some((row) => /^Gewöhnlich \d+–\d+$/.test(row)), rows.join(', '));
  for (const row of rows) assert.equal(dataText(row), row);
  english();
  for (const row of rows) assert.doesNotMatch(dataText(row), GERMAN, row);
  german();
});
