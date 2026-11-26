// The «Verlauf» tab as its own component (modularisation step 1): its filters live in the panel, labels follow the
// language, and a co-op member's name appears once even when the stored text already starts with it.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { historyLine } from '../app/qol/history-filter.ts';
import { HistoryPanel } from '../app/qol/history-panel.tsx';
import * as runtime from '../app/i18n/runtime.ts';

const entries = [
  { id: 'a', title: 'Tägliche Prämie · Tag 7', detail: 'Lea holt ein Spezialkarten-Pack. Serie: 7 Tage.', tone: 'positive', timestamp: 1_800_000_000_000, actor: 'Lea' },
  { id: 'b', title: 'Pack geöffnet', detail: 'Neue Karte im Kader.', tone: 'positive', timestamp: 1_800_000_060_000, actor: 'Max' },
] as never[];

test('historyLine names the member once', () => {
  assert.equal(historyLine('Lea', 'Lea holt ein Spezialkarten-Pack.'), 'Lea holt ein Spezialkarten-Pack.');
  assert.equal(historyLine('Max', 'Neue Karte im Kader.'), 'Max · Neue Karte im Kader.');
  assert.equal(historyLine(undefined, 'Ohne Mitglied.'), 'Ohne Mitglied.');
  const long = 'Sehr Langer Anzeigename Fü';
  assert.equal(historyLine(long.slice(0, 24), `${long} holt 5 Tore.`), `${long} holt 5 Tore.`);
});

test('the panel lists the newest first, names each member once and translates its filters', () => {
  runtime.resetLocaleForTests();
  runtime.chooseLocale('de');
  const de = renderToStaticMarkup(createElement(HistoryPanel, { history: entries }));
  assert.ok(de.indexOf('Pack geöffnet') < de.indexOf('Tägliche Prämie'), 'newest first');
  assert.match(de, /<small>Lea holt ein Spezialkarten-Pack\. Serie: 7 Tage\.<\/small>/, 'Lea once in her line');
  assert.doesNotMatch(de, /Lea · Lea/);
  assert.match(de, /Max · Neue Karte im Kader\./);
  assert.match(de, />Alle</);
  runtime.chooseLocale('en');
  const en = renderToStaticMarkup(createElement(HistoryPanel, { history: entries }));
  for (const label of ['All', 'Games', 'Squad']) assert.match(en, new RegExp(`aria-pressed="(true|false)">${label}<`), `${label} on an English filter button`);
  assert.doesNotMatch(en, /aria-pressed="(true|false)">(Alle|Spiele|Kader)</);
  runtime.resetLocaleForTests();
});

test('the filters live in the panel, not in the game screen', async () => {
  const page = await readFile(new URL('../app/game-app.tsx', import.meta.url), 'utf8');
  assert.match(page, /<HistoryPanel history=\{displayGame\.features\.history\} \/>/);
  assert.doesNotMatch(page, /setHistoryTopic|setHistoryActor|filterHistory\(/);
});
