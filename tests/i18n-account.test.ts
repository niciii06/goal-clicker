// Account and cloud save messages read the translation catalog (app/i18n). German answers must stay byte for byte
// what they were (frozen below from main 383421b); English exists in the catalog but is not switched on.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { de } from '../app/i18n/messages/de.ts';
import { en } from '../app/i18n/messages/en.ts';
import { placeholders } from '../app/i18n/translate.ts';
import { getCloudSaveResponse, putCloudSaveResponse } from '../app/account-api.ts';
import { STORAGE_KEY } from '../app/game/constants.ts';
import { displayNameError, passwordError, usernameError } from '../app/profile-rules.ts';

const FROZEN_GERMAN: Record<string, string> = {
  'account.invalidLogin': "Benutzername oder Passwort stimmt nicht.",
  'request.invalid': "Die Anfrage ist ungültig.",
  'account.authUnavailable': "Die Anmeldung kann gerade nicht geprüft werden. Bitte versuche es gleich nochmal.",
  'server.unavailable': "Der Server ist gerade nicht erreichbar. Bitte versuche es gleich nochmal.",
  'account.notConfigured': "Der Login ist auf diesem Server nicht eingerichtet.",
  'request.crossSite': "Nicht erlaubt.",
  'account.loginRequired': "Bitte melde dich an.",
  'account.notSignedIn': "Nicht angemeldet.",
  'account.usernameTaken': "Dieser Benutzername ist schon vergeben.",
  'account.profileExists': "Dein Konto hat schon ein Profil.",
  'account.profileMissing': "Lege zuerst ein Profil an.",
  'account.usernameTooSoon': "Den Benutzernamen kannst du nur alle 30 Tage ändern.",
  'account.deleted': "Profil und Spielstand sind gelöscht. Dein Login ist gesperrt und wird vom Besitzer des Spiels endgültig entfernt.",
  'account.setupRequired': "Dieser Login gehört zu keinem Spielerkonto.",
  'account.confirmRequired': "Zur Bestätigung den Benutzernamen eintippen.",
  'request.rateLimited': "Zu viele Versuche. Bitte warte ein paar Minuten.",
  'account.signupFailed': "Das Konto konnte nicht erstellt werden.",
  'account.recoveryNotConfigured': "Dein Konto muss einmalig übernommen werden, das ist gerade nicht möglich. Bitte melde dich beim Besitzer des Spiels.",
  'account.recoveryUnreachable': "Dein Konto muss einmalig übernommen werden, die sichere Passwortübernahme ist gerade nicht erreichbar. Bitte versuche es später nochmal.",
  'account.recoveryFailed': "Die Übernahme deines Kontos hat nicht geklappt. Es wurde nichts verändert. Bitte versuche es nochmal.",
  'account.recoveryExpired': "Die Übernahme ist abgelaufen. Bitte melde dich nochmal an.",
  'account.invalidCode': "Benutzername oder Wiederherstellungscode stimmt nicht.",
  'account.alreadyRecovered': "Dieses Konto hat schon einen Login. Melde dich normal an.",
  'account.gone': "Dieses Konto gibt es nicht mehr. Bitte melde dich neu an.",
  'account.playerTaken': "Diese Spieler-ID gehört bereits zu einem anderen Konto.",
  'save.versionMissing': "Die Spielstand Version fehlt.",
  'save.incomplete': "Der Spielstand ist unvollständig.",
  'save.schemaNewer': "Dein Spielstand wurde mit einer neueren Version gespeichert. Bitte lade die Seite neu.",
  'save.conflict': "Auf einem anderen Gerät wurde inzwischen weitergespielt.",
  'profile.usernameTooShort': "Der Benutzername braucht mindestens {min} Zeichen.",
  'profile.usernameTooLong': "Der Benutzername darf höchstens {max} Zeichen haben.",
  'profile.usernameCharacters': "Erlaubt sind nur Buchstaben ohne Umlaute, Zahlen und _.",
  'profile.usernameReserved': "Dieser Benutzername ist reserviert.",
  'profile.displayNameTooShort': "Der Anzeigename braucht mindestens {min} Zeichen.",
  'profile.displayNameTooLong': "Der Anzeigename darf höchstens {max} Zeichen haben.",
  'profile.passwordTooShort': "Das Passwort braucht mindestens {min} Zeichen.",
  'profile.passwordTooLong': "Das Passwort darf höchstens {max} Zeichen haben.",
};

test('every account, save and validation message is the German text of before', () => {
  for (const [key, text] of Object.entries(FROZEN_GERMAN)) assert.equal((de as Record<string, unknown>)[key], text, key);
});

test('English has every one of these messages with the same placeholders', () => {
  for (const key of Object.keys(FROZEN_GERMAN)) {
    const english = (en as Record<string, unknown>)[key] as string | undefined;
    assert.ok(english, `English lacks ${key}`);
    assert.notEqual(english, FROZEN_GERMAN[key], `${key} is still German`);
    assert.deepEqual(placeholders(english), placeholders(FROZEN_GERMAN[key]), key);
  }
});

test('account-api.ts and profile-rules.ts keep no German message of their own', () => {
  for (const file of ['app/account-api.ts', 'app/profile-rules.ts']) {
    const code = readFileSync(file, 'utf8').split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*\*)/.test(line)).join('\n');
    for (const text of Object.values(FROZEN_GERMAN)) assert.ok(!code.includes(text.split('{')[0].slice(0, 24)), `${file} still holds: ${text}`);
  }
});

test('validation answers are unchanged, numbers included', () => {
  assert.equal(usernameError('ab'), 'Der Benutzername braucht mindestens 3 Zeichen.');
  assert.equal(usernameError('x'.repeat(21)), 'Der Benutzername darf höchstens 20 Zeichen haben.');
  assert.equal(usernameError('Jürg'), 'Erlaubt sind nur Buchstaben ohne Umlaute, Zahlen und _.');
  assert.equal(usernameError('Striker_7'), null);
  assert.equal(displayNameError('x'.repeat(19)), 'Der Anzeigename darf höchstens 18 Zeichen haben.');
  assert.equal(passwordError('kurz'), 'Das Passwort braucht mindestens 8 Zeichen.');
  assert.equal(passwordError('p'.repeat(73)), 'Das Passwort darf höchstens 72 Zeichen haben.');
});

test('the cloud save API answers with the same German text and codes as before', async () => {
  const session = { issuer: 'https://auth.example.test', subject: 's', email: 'a@example.test', name: 'A', cookie: '' };
  const deps = (over: Record<string, unknown> = {}) => ({
    getSession: async () => session, lookupAccount: async () => ({ ok: true, accountId: 'acc', method: 'email', created: false }),
    db: () => ({ putCloudSave: async () => ({ conflict: null }), getCloudSaveSince: async () => null }), configured: () => true, now: () => new Date(0),
    ...over,
  }) as never;
  const put = async (body: unknown, over?: Record<string, unknown>) => {
    const r = await putCloudSaveResponse(new Request('http://localhost/api/save', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), deps(over));
    return { status: r.status, body: await r.json() as { error?: string; errorCode?: string } };
  };
  assert.deepEqual(await put({ baseVersion: -1, keys: {} }), { status: 400, body: { error: 'Die Spielstand Version fehlt.', errorCode: 'INVALID' } });
  assert.deepEqual(await put({ baseVersion: 1, keys: {} }), { status: 400, body: { error: 'Der Spielstand ist unvollständig.', errorCode: 'INVALID' } });
  const conflict = await put({ baseVersion: 1, keys: { [STORAGE_KEY]: JSON.stringify({ goals: 5, totalGoals: 5 }) } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error, 'Auf einem anderen Gerät wurde inzwischen weitergespielt.');
  assert.equal(conflict.body.errorCode, 'SAVE_CONFLICT');
  const signedOut = await getCloudSaveResponse(new Request('http://localhost/api/save'), deps({ getSession: async () => null }));
  assert.deepEqual([signedOut.status, await signedOut.json()], [401, { error: 'Bitte melde dich an.', errorCode: 'LOGIN_REQUIRED' }]);
  const off = await getCloudSaveResponse(new Request('http://localhost/api/save'), deps({ configured: () => false }));
  assert.deepEqual([off.status, await off.json()], [503, { error: 'Der Login ist auf diesem Server nicht eingerichtet.', errorCode: 'AUTH_NOT_CONFIGURED' }]);
});
