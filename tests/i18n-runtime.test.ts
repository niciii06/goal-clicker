// Language choice at run time (app/i18n/runtime.ts): without a browser always German; in the browser the stored
// choice, else the browser language, else German; the choice is remembered on this device only, sets <html lang>, and
// texts that arrive already written in German (API answers, constants) are shown in the chosen language when the
// catalogue knows them. Nothing here touches a save.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const runtime = await import('../app/i18n/runtime.ts');
const { LOCALE_STORAGE_KEY } = await import('../app/i18n/locales.ts');
const { de } = await import('../app/i18n/messages/de.ts');
const { en } = await import('../app/i18n/messages/en.ts');
const { catalogGaps } = await import('../app/i18n/translate.ts');

function fakeBrowser(languages: string[], stored?: string) {
  const store = new Map<string, string>(stored ? [[LOCALE_STORAGE_KEY, stored]] : []);
  const html = { lang: 'de' };
  Object.assign(globalThis, {
    window: { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } } },
    navigator: { languages, language: languages[0] },
    document: { documentElement: html },
  });
  return { store, html };
}
function noBrowser() {
  for (const key of ['window', 'navigator', 'document']) delete (globalThis as Record<string, unknown>)[key];
  runtime.resetLocaleForTests();
}

test('without a browser (the server) the language is always German', () => {
  noBrowser();
  assert.equal(runtime.initLocaleFromDevice(), 'de');
  assert.equal(runtime.t('gate.signIn'), 'Anmelden');
});

test('the browser language decides until the player chooses; the choice is stored on this device and sets <html lang>', () => {
  const { store, html } = fakeBrowser(['en-GB', 'de-CH']);
  assert.equal(runtime.initLocaleFromDevice(), 'en');
  assert.equal(html.lang, 'en');
  assert.equal(runtime.t('gate.signIn'), 'Sign in');
  assert.equal(store.size, 0, 'nothing is stored before a choice');
  assert.equal(runtime.chooseLocale('de'), true);
  assert.equal(store.get(LOCALE_STORAGE_KEY), 'de');
  assert.equal(html.lang, 'de');
  assert.equal(runtime.chooseLocale('fr'), false, 'a language that is not enabled is refused');
  assert.equal(runtime.currentLocale(), 'de');
  // The stored choice wins over the browser language after a reload.
  const again = fakeBrowser(['en-US'], 'de');
  runtime.resetLocaleForTests();
  assert.equal(runtime.initLocaleFromDevice(), 'de');
  assert.equal(again.html.lang, 'de');
  // A French browser without a choice gets German (the fallback), a broken stored value too.
  fakeBrowser(['fr-CH'], 'klingonisch');
  runtime.resetLocaleForTests();
  assert.equal(runtime.initLocaleFromDevice(), 'de');
  noBrowser();
});

test('server answers and constants written in German appear in the chosen language; unknown texts stay as they are', async () => {
  fakeBrowser(['en-GB']);
  runtime.initLocaleFromDevice();
  assert.equal(runtime.localizeText('Dieser Benutzername ist schon vergeben.'), 'This username is already taken.');
  assert.equal(runtime.localizeText('Auf einem anderen Gerät wurde inzwischen weitergespielt.'), 'The game was continued on another device in the meantime.');
  assert.equal(runtime.localizeText('Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann nochmal.'), 'Too many attempts. Please wait a few minutes and try again.');
  // Constants computed in German at import (cloud-sync STORAGE_FULL_MESSAGE equals this text, tests/i18n.test.ts).
  assert.equal(runtime.localizeText(de['sync.storageFull']), en['sync.storageFull']);
  assert.equal(runtime.localizeText('Ein Satz, den der Katalog nicht kennt.'), 'Ein Satz, den der Katalog nicht kennt.');
  assert.equal(runtime.localizeText(''), '');
  assert.equal(runtime.localizeText(undefined), '');
  // Validation messages in the form follow the chosen language, numbers included.
  const rules = await import('../app/profile-rules.ts');
  assert.equal(rules.usernameError('ab'), 'The username needs at least 3 characters.');
  runtime.chooseLocale('de');
  assert.equal(rules.usernameError('ab'), 'Der Benutzername braucht mindestens 3 Zeichen.');
  assert.equal(runtime.localizeText('Dieser Benutzername ist schon vergeben.'), 'Dieser Benutzername ist schon vergeben.');
  noBrowser();
});

test('every key the interface uses exists in German and English with the same placeholders', () => {
  assert.deepEqual(catalogGaps('en'), { missing: [], unknown: [] });
  const used = new Set<string>();
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) for (const match of readFileSync(path, 'utf8').matchAll(/(?<![.\w])t\(\s*["'`]([\w.]+)["'`]/g)) used.add(match[1]);
    }
  })('app');
  assert.ok(used.size > 100, `the interface uses many catalogue texts (${used.size})`);
  for (const key of used) {
    assert.ok(key in de, `${key} is in the German catalogue`);
    assert.ok(key in en, `${key} is in the English catalogue`);
  }
});
