// Remaining English leaks after 980568b: live ticker event names, the accessible name of the live pitch, the done
// state of the tutorial steps and the match rating reasons. German exactly as before, saved data stays German.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runtime = await import('../app/i18n/runtime.ts');
const { dataText, eventText } = await import('../app/i18n/data-text.ts');
const { eventLabel } = await import('../app/match-visual-frame.ts');
const { TUTORIAL_STEPS } = await import('../app/tutorial.ts');

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
const GERMAN = /[äöüÄÖÜ]|\b(Tor|Tore|Vorlagen?|Karte|Spieler|und|mit|für|auf|den|dem|der|die|das|erledigt|Fussballfeld|Wechsel|Ecke|Einwurf|Freistoss|Abseits|Konter|Gegentor\w*)\b/;
const KINDS = ['goal', 'card', 'injury', 'penalty', 'build-up', 'counter', 'wide', 'combination', 'shot', 'corner', 'free-kick', 'throw-in', 'yellow', 'substitution', 'offside', 'unknown-kind'];
const labels = () => [...KINDS.map((kind) => eventLabel({ kind } as never)), eventLabel({ kind: 'free-kick', style: 'penalty' } as never)];

test('live ticker event names: German as eventLabel builds it, English for every kind', () => {
  german();
  for (const label of labels()) assert.equal(eventText(label), label);
  assert.equal(eventText('Tor'), 'Tor');
  english();
  for (const label of labels()) { const en = eventText(label); assert.notEqual(en, label === 'Penalty' ? '' : label, label); assert.doesNotMatch(en, GERMAN, `${label} -> ${en}`); }
  assert.equal(eventText('Tor'), 'Goal');
  assert.equal(eventText('Wechsel'), 'Substitution');
  german();
  for (const file of ['app/match-viewer.tsx', 'app/interactive-match-panel.tsx']) assert.doesNotMatch(readFileSync(file, 'utf8'), /\{eventLabel\(/, `${file} shows eventLabel through eventText`);
});

test('accessible name of the live pitch: German unchanged, English in both canvases', () => {
  german();
  assert.equal(runtime.t('viewer.pitchAria'), 'Live Fussballfeld mit 22 bewegten Spielern und Ball; Spieler antippen für Details');
  assert.equal(runtime.t('viewer.pitchFallbackAria'), 'Fussballfeld');
  english();
  assert.equal(runtime.t('viewer.pitchAria'), 'Live football pitch with 22 moving players and the ball; tap a player for details');
  assert.equal(runtime.t('viewer.pitchFallbackAria'), 'Football pitch');
  german();
  for (const file of ['app/match-pitch-canvas.tsx', 'app/interactive-pitch-canvas.tsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /aria-label=\{t\("viewer\.pitchAria"\)\}/, file);
    assert.doesNotMatch(source, /Live Fussballfeld|aria-label="Fussballfeld"/, file);
    assert.match(source, /aria-label=\{t\("viewer\.pitchFallbackAria"\)\}/, file);
  }
});

test('tutorial step list: accessible names and the done state in English, German exactly as before', () => {
  german();
  const de = TUTORIAL_STEPS.map((step) => `${dataText(step.title)}${runtime.t('tutorialPanel.doneSuffix')}`);
  assert.deepEqual(de, TUTORIAL_STEPS.map((step) => `${step.title}, erledigt`));
  english();
  const en = TUTORIAL_STEPS.map((step) => `${dataText(step.title)}${runtime.t('tutorialPanel.doneSuffix')}`);
  for (const name of en) { assert.match(name, /, done$/); assert.doesNotMatch(name, GERMAN, name); }
  german();
  assert.match(readFileSync('app/tutorial-panel.tsx', 'utf8'), /aria-label=\{`\$\{dataText\(item\.title\)\}\$\{state\.done\.includes\(item\.id\) \? t\("tutorialPanel\.doneSuffix"\) : ""\}`\}/);
});

test('match rating reasons saved in German: shown in English, German unchanged', () => {
  const saved = ['Grundleistung und Tagesform', '1 Tor', '2 Tore', '1 Vorlage', '3 Vorlagen', 'Beteiligung an Gegentoren', 'Ohne Gegentor auf dem Platz', 'Spielstand: Tore und Gegentore auf dem Platz', 'Gegentore als Torhüter oder Verteidiger', 'Erfasste Aktionen: Zuspiele, Schüsse, Paraden und Karten', 'Rundung und Notengrenzen (4.5 bis 10)', 'Rote Karte: Team geschwächt, Einsatz beendet', 'Verletzungsbedingtes Einsatzende'];
  const source = readFileSync('app/career-data.ts', 'utf8');
  for (const label of saved.filter((x) => !/^\d/.test(x))) assert.ok(source.includes(`'${label}'`), `still the saved label: ${label}`);
  german();
  for (const label of saved) assert.equal(dataText(label), label);
  english();
  for (const label of saved) assert.doesNotMatch(dataText(label), GERMAN, `${label} -> ${dataText(label)}`);
  assert.deepEqual(['1 Tor', '2 Tore', '1 Vorlage', '3 Vorlagen'].map((x) => dataText(x)), ['1 goal', '2 goals', '1 assist', '3 assists']);
  german();
});
