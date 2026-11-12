// German source catalog. Every key of every language comes from here; German wording must stay exactly as the game
// shows it today (tests/i18n.test.ts compares each entry with the constant it will replace).
//
// A message is a text with {placeholders}, or plural forms chosen by Intl.PluralRules (one, other, …) for {count}.
export const de = {
  "sync.storageFull": "Gerätespeicher voll. Bitte Speicher freigeben oder Spielstand als Datei sichern.",
  "sync.saveTooLarge": "Der Spielstand ist zu gross für die Cloud und wird nur auf diesem Gerät gespeichert. Bitte sichere ihn als Datei.",
  "update.newerSave": "Neue Version verfügbar, bitte neu laden. Dein Spielstand wurde mit einer neueren Version gespeichert und bleibt unverändert.",
  "update.multiplayer": "Eine neue Goal Clicker Version ist verfügbar. Lade die Seite einmal neu. Dein Raum und Spielstand bleiben vollständig erhalten.",
  "pack.fragmentsBack": "+{amount} Fragmente zurück.",
  // Account and cloud save answers of app/account-api.ts.
  "account.invalidLogin": "Benutzername oder Passwort stimmt nicht.",
  "request.invalid": "Die Anfrage ist ungültig.",
  "account.authUnavailable": "Die Anmeldung kann gerade nicht geprüft werden. Bitte versuche es gleich nochmal.",
  "server.unavailable": "Der Server ist gerade nicht erreichbar. Bitte versuche es gleich nochmal.",
  "account.notConfigured": "Der Login ist auf diesem Server nicht eingerichtet.",
  "request.crossSite": "Nicht erlaubt.",
  "account.loginRequired": "Bitte melde dich an.",
  "account.notSignedIn": "Nicht angemeldet.",
  "account.usernameTaken": "Dieser Benutzername ist schon vergeben.",
  "account.profileExists": "Dein Konto hat schon ein Profil.",
  "account.profileMissing": "Lege zuerst ein Profil an.",
  "account.usernameTooSoon": "Den Benutzernamen kannst du nur alle 30 Tage ändern.",
  "account.deleted": "Profil und Spielstand sind gelöscht. Dein Login ist gesperrt und wird vom Besitzer des Spiels endgültig entfernt.",
  "account.setupRequired": "Dieser Login gehört zu keinem Spielerkonto.",
  "account.confirmRequired": "Zur Bestätigung den Benutzernamen eintippen.",
  "request.rateLimited": "Zu viele Versuche. Bitte warte ein paar Minuten.",
  "account.signupFailed": "Das Konto konnte nicht erstellt werden.",
  "account.recoveryNotConfigured": "Dein Konto muss einmalig übernommen werden, das ist gerade nicht möglich. Bitte melde dich beim Besitzer des Spiels.",
  "account.recoveryUnreachable": "Dein Konto muss einmalig übernommen werden, die sichere Passwortübernahme ist gerade nicht erreichbar. Bitte versuche es später nochmal.",
  "account.recoveryFailed": "Die Übernahme deines Kontos hat nicht geklappt. Es wurde nichts verändert. Bitte versuche es nochmal.",
  "account.recoveryExpired": "Die Übernahme ist abgelaufen. Bitte melde dich nochmal an.",
  "account.invalidCode": "Benutzername oder Wiederherstellungscode stimmt nicht.",
  "account.alreadyRecovered": "Dieses Konto hat schon einen Login. Melde dich normal an.",
  "account.gone": "Dieses Konto gibt es nicht mehr. Bitte melde dich neu an.",
  "account.playerTaken": "Diese Spieler-ID gehört bereits zu einem anderen Konto.",
  "save.versionMissing": "Die Spielstand Version fehlt.",
  "save.incomplete": "Der Spielstand ist unvollständig.",
  "save.schemaNewer": "Dein Spielstand wurde mit einer neueren Version gespeichert. Bitte lade die Seite neu.",
  "save.conflict": "Auf einem anderen Gerät wurde inzwischen weitergespielt.",
  // Validation of usernames, display names and passwords (app/profile-rules.ts), on the server and in the form.
  "profile.usernameTooShort": "Der Benutzername braucht mindestens {min} Zeichen.",
  "profile.usernameTooLong": "Der Benutzername darf höchstens {max} Zeichen haben.",
  "profile.usernameCharacters": "Erlaubt sind nur Buchstaben ohne Umlaute, Zahlen und _.",
  "profile.usernameReserved": "Dieser Benutzername ist reserviert.",
  "profile.displayNameTooShort": "Der Anzeigename braucht mindestens {min} Zeichen.",
  "profile.displayNameTooLong": "Der Anzeigename darf höchstens {max} Zeichen haben.",
  "profile.passwordTooShort": "Das Passwort braucht mindestens {min} Zeichen.",
  "profile.passwordTooLong": "Das Passwort darf höchstens {max} Zeichen haben.",
  "season.matchesLeft": { one: "Noch {count} Spiel", other: "Noch {count} Spiele" },
} as const satisfies Record<string, Message>;

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralForms;
export type MessageKey = keyof typeof de;
