// Translation foundation (app/i18n, docs/i18n-plan.md): German stays exactly as today, only German is enabled,
// and every other language falls back to German key by key.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOGS, catalogGaps, placeholders, translate, translator } from '../app/i18n/translate.ts';
import { ENABLED_LOCALES, LOCALE_STORAGE_KEY, LOCALES, readStoredLocale, resolveLocale, storeLocale } from '../app/i18n/locales.ts';
import { de } from '../app/i18n/messages/de.ts';
import { STORAGE_FULL_MESSAGE, SAVE_TOO_LARGE_MESSAGE } from '../app/cloud-sync.ts';
import { NEWER_VERSION_MESSAGE } from '../app/game/save-schema.ts';
import { MULTIPLAYER_UPDATE_MESSAGE } from '../app/multiplayer-protocol.ts';

test('the German catalog has exactly the wording the game showed before the catalog', () => {
  // Frozen copies of the texts as they stood in the code (main 383421b): the constants now read the catalog,
  // so comparing with them alone would prove nothing.
  assert.equal(translate('de', 'sync.storageFull'), 'Gerätespeicher voll. Bitte Speicher freigeben oder Spielstand als Datei sichern.');
  assert.equal(translate('de', 'sync.saveTooLarge'), 'Der Spielstand ist zu gross für die Cloud und wird nur auf diesem Gerät gespeichert. Bitte sichere ihn als Datei.');
  assert.equal(translate('de', 'update.newerSave'), 'Neue Version verfügbar, bitte neu laden. Dein Spielstand wurde mit einer neueren Version gespeichert und bleibt unverändert.');
  assert.equal(translate('de', 'update.multiplayer'), 'Eine neue Goal Clicker Version ist verfügbar. Lade die Seite einmal neu. Dein Raum und Spielstand bleiben vollständig erhalten.');
  assert.equal(STORAGE_FULL_MESSAGE, translate('de', 'sync.storageFull'));
  assert.equal(SAVE_TOO_LARGE_MESSAGE, translate('de', 'sync.saveTooLarge'));
  assert.equal(NEWER_VERSION_MESSAGE, translate('de', 'update.newerSave'));
  assert.equal(MULTIPLAYER_UPDATE_MESSAGE, translate('de', 'update.multiplayer'));
  // The refund line of a duplicate special card (feature-data.ts) with the Swiss number format it uses.
  assert.equal(translate('de', 'pack.fragmentsBack', { amount: 12500 }), `+${(12500).toLocaleString('de-CH')} Fragmente zurück.`);
});

test('German and English can be chosen; French and Spanish never show until their catalogues exist', () => {
  assert.deepEqual([...ENABLED_LOCALES], ['de', 'en']);
  assert.equal(resolveLocale('en', ['de-CH']), 'en', 'the stored choice wins');
  assert.equal(resolveLocale(null, ['en-US']), 'en', 'without a choice the browser language');
  for (const stored of [null, 'fr', 'es', 'xx', 42]) assert.equal(resolveLocale(stored, ['fr-CH', 'es']), 'de', String(stored));
});

test('with a language enabled later, the stored choice wins, then the browser, then German', () => {
  const enabled = ['de', 'en'] as const;
  assert.equal(resolveLocale('en', ['de-CH'], enabled), 'en');
  assert.equal(resolveLocale(null, ['fr-CH', 'en-US'], enabled), 'en');
  assert.equal(resolveLocale('fr', ['fr-CH'], enabled), 'de', 'a language that is not enabled never shows');
  assert.equal(resolveLocale('EN_gb', [], enabled), 'en');
  assert.equal(resolveLocale(undefined, [], enabled), 'de');
});

test('the stored preference survives broken storage and only takes enabled languages', () => {
  const map = new Map<string, string>();
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
  assert.equal(readStoredLocale(storage), null);
  assert.equal(storeLocale(storage, 'fr'), false, 'French is not enabled');
  assert.equal(map.size, 0);
  assert.equal(storeLocale(storage, 'en'), true);
  assert.equal(readStoredLocale(storage), 'en');
  assert.equal(storeLocale(storage, 'de'), true);
  assert.equal(map.get(LOCALE_STORAGE_KEY), 'de');
  assert.equal(readStoredLocale(storage), 'de');
  map.set(LOCALE_STORAGE_KEY, 'klingonisch');
  assert.equal(readStoredLocale(storage), null);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  assert.equal(readStoredLocale(broken), null);
  assert.equal(storeLocale(broken, 'de'), false);
  assert.equal(readStoredLocale(null), null);
});

test('missing translations fall back to German key by key, placeholders included', () => {
  assert.equal(translate('fr', 'sync.storageFull'), STORAGE_FULL_MESSAGE);
  const partial = { ...CATALOGS, en: { 'sync.storageFull': 'Full.' } };
  assert.equal(translate('en', 'sync.storageFull', {}, partial), 'Full.');
  assert.equal(translate('en', 'pack.fragmentsBack', { amount: 1234 }, partial), `+${(1234).toLocaleString('de-CH')} Fragmente zurück.`, 'German text with German number format');
  assert.equal(translate('en', 'pack.fragmentsBack', { amount: 1234 }), '+1,234 fragments refunded.');
});

test('plural forms follow the rules of each language', () => {
  assert.equal(translate('de', 'season.matchesLeft', { count: 1 }), 'Noch 1 Spiel');
  assert.equal(translate('de', 'season.matchesLeft', { count: 4 }), 'Noch 4 Spiele');
  assert.equal(translate('de', 'season.matchesLeft', { count: 0 }), 'Noch 0 Spiele');
  assert.equal(translate('en', 'season.matchesLeft', { count: 1 }), '1 match left');
  assert.equal(translate('en', 'season.matchesLeft', { count: 2 }), '2 matches left');
  assert.equal(translate('de', 'season.matchesLeft'), 'Noch {count} Spiele', 'a missing count shows instead of vanishing');
  const t = translator('de');
  assert.equal(t('season.matchesLeft', { count: 1 }), 'Noch 1 Spiel');
});

test('every catalog only uses German keys and keeps the placeholders of each message', () => {
  for (const locale of LOCALES) {
    const gaps = catalogGaps(locale);
    assert.deepEqual(gaps.unknown, [], `${locale}: keys German does not know`);
    for (const [key, message] of Object.entries(CATALOGS[locale])) {
      assert.deepEqual(placeholders(message!), placeholders(de[key as keyof typeof de]), `${locale} ${key}`);
    }
  }
  assert.deepEqual(catalogGaps('en').missing, [], 'English covers the seeded keys');
});

test('only app/i18n reads or stores the language; server texts stay German', () => {
  const files: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (path !== join('app', 'i18n')) walk(path); } else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
    }
  })('app');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /resolveLocale|storeLocale|readStoredLocale|LOCALE_STORAGE_KEY|ENABLED_LOCALES/, file);
    // Code outside app/i18n translates only into the source language.
    if (!/from "\.{1,2}\/(?:\.\.\/)*i18n\//.test(text)) continue;
    for (const match of text.matchAll(/(?<![.\w])translat(?:e|or)\(\s*([^,)\s]+)/g)) assert.equal(match[1], 'SOURCE_LOCALE', `${file}: ${match[0]}`);
  }
  // The server renders lang="de" as before; the browser switches it after reading the choice (app/i18n/runtime.ts).
  assert.match(readFileSync('app/layout.tsx', 'utf8'), /lang="de"/);
  assert.doesNotMatch(readFileSync('app/layout.tsx', 'utf8'), /i18n\//);
  // The game uses only the runtime layer (current language and its re-render hook), never the storage helpers.
  if (existsSync('app/game-app.tsx')) for (const match of readFileSync('app/game-app.tsx', 'utf8').matchAll(/from "\.\/i18n\/([\w-]+)"/g)) assert.ok(['runtime', 'use-locale'].includes(match[1]), match[0]);
});
