// Translation foundation (app/i18n, docs/i18n-plan.md): German stays exactly as today, only German is enabled,
// and every other language falls back to German key by key.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CATALOGS, catalogGaps, placeholders, translate, translator } from '../app/i18n/translate.ts';
import { ENABLED_LOCALES, LOCALE_STORAGE_KEY, LOCALES, readStoredLocale, resolveLocale, storeLocale } from '../app/i18n/locales.ts';
import { de } from '../app/i18n/messages/de.ts';
import { STORAGE_FULL_MESSAGE, SAVE_TOO_LARGE_MESSAGE } from '../app/cloud-sync.ts';
import { NEWER_VERSION_MESSAGE } from '../app/game/save-schema.ts';
import { MULTIPLAYER_UPDATE_MESSAGE } from '../app/multiplayer-protocol.ts';

test('the German catalog has exactly the wording the game shows today', () => {
  assert.equal(translate('de', 'sync.storageFull'), STORAGE_FULL_MESSAGE);
  assert.equal(translate('de', 'sync.saveTooLarge'), SAVE_TOO_LARGE_MESSAGE);
  assert.equal(translate('de', 'update.newerSave'), NEWER_VERSION_MESSAGE);
  assert.equal(translate('de', 'update.multiplayer'), MULTIPLAYER_UPDATE_MESSAGE);
  // The refund line of a duplicate special card (feature-data.ts) with the Swiss number format it uses.
  assert.equal(translate('de', 'pack.fragmentsBack', { amount: 12500 }), `+${(12500).toLocaleString('de-CH')} Fragmente zurück.`);
});

test('only German is enabled: no stored or browser language switches the game', () => {
  assert.deepEqual([...ENABLED_LOCALES], ['de']);
  for (const stored of [null, 'de', 'en', 'fr', 'es', 'xx', 42]) {
    assert.equal(resolveLocale(stored, ['en-GB', 'fr-CH', 'es']), 'de', String(stored));
  }
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
  assert.equal(storeLocale(storage, 'en'), false, 'English is not enabled');
  assert.equal(map.size, 0);
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

test('nothing in the game imports the translation layer yet (no partial language switch)', () => {
  const app = ['app/page.tsx', 'app/game-app.tsx', 'app/layout.tsx'];
  for (const file of app) assert.doesNotMatch(readFileSync(file, 'utf8'), /i18n\//, file);
});
