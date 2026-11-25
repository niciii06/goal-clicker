// Prestige texts after the decision of 16 and 17 November 2026 (+10 % per Prestige, upgrades and packs unlock again
// from Liga 15): German reads exactly as on main 308007b, English says the same and no longer "unlocks stay".
import assert from 'node:assert/strict';
import test from 'node:test';

const runtime = await import('../app/i18n/runtime.ts');
const { prestigeBonusPercent, prestigeBonusLabel } = await import('../app/prestige-dialog.tsx');

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

const keys = () => ({
  keeps: runtime.t('games.prestigeKeeps', { bonus: prestigeBonusPercent(2) }),
  started: runtime.t('logic.prestigeStartedSolo'),
  intro: runtime.t('prestige.intro', { count: 27 }),
  rebuy: runtime.t('prestige.rebuy'),
  top: runtime.t('season.topReached', { bonus: prestigeBonusPercent(1) }),
});

test('Prestige texts in German: exactly the wording of main 308007b', () => {
  german();
  assert.deepEqual(keys(), {
    keeps: 'Spezialkarten und eine Karte deiner Wahl bleiben. Upgrades starten wieder bei Stufe 0 und werden wie Packs ab Liga 15 neu freigeschaltet. Danach +20 % Tore.',
    started: 'Prestige gestartet: zurück auf Saison 1, alle Upgrades wieder auf Stufe 0. Upgrades und Packs werden ab Liga 15 wieder Liga für Liga freigeschaltet.',
    intro: 'Der Aufstiegslauf beginnt wieder in Saison 1. Alle 27 Upgrades im Club Office starten wieder bei Stufe 0. Upgrades und Packs werden wie in einem neuen Spiel ab Liga 15 wieder Liga für Liga freigeschaltet. Fragmente, ungeöffnete Packs und Vereinssterne bleiben.',
    rebuy: '. Upgrades und Packs werden ab Liga 15 wieder Liga für Liga freigeschaltet.',
    top: 'Die höchste Saison ist erreicht. Prestige startet wieder in Saison 1: Spezialkarten bleiben, dazu eine Karte deiner Wahl. Torstand und alle Upgrades beginnen bei 0, Upgrades und Packs werden ab Liga 15 wieder Liga für Liga freigeschaltet. Jedes Prestige gibt +10 % Tore auf Klicks und passives Einkommen.',
  });
  assert.equal(prestigeBonusLabel(2), 'Prestige 2 · +20 % Tore');
});

test('Prestige texts in English: league 15 again, +10 % per Prestige, no German and no "unlocks stay"', () => {
  english();
  const en = keys();
  for (const text of Object.values(en)) {
    assert.doesNotMatch(text, /Liga|Freischalt|Stufe|bleiben|Tore/, text);
    assert.doesNotMatch(text, /unlocks stay|buy unlocked upgrades again/i, text);
  }
  for (const text of [en.started, en.intro, en.rebuy, en.top, en.keeps]) assert.match(text, /league 15/, text);
  assert.match(en.top, /\+10 % goals/);
  assert.match(en.keeps, /\+20 % goals/);
  assert.equal(prestigeBonusLabel(2), 'Prestige 2 · +20 % goals');
  german();
});
