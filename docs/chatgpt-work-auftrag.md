# Auftrag an ChatGPT Work: Staging für den Neon und Netlify Umzug

Rolle: Du übernimmst nur Anbieter Einstellungen und Prüfungen auf Staging. Code ändert Claude im Branch `claude/affectionate-lovelace-vgli3d` von `niciii06/goal-clicker`. Lies zuerst `docs/neon-netlify-migration.md` in diesem Branch.

Harte Regeln:

* Keine Umstellung der Produktion, kein Entfernen des Netlify Zugangsschutzes, keine Planänderung, kein Löschen des Supabase Projekts `iocdsjgmgkqdkojmciyx`, keine Änderung an Neon Branch `production` (`br-aged-voice-b406g740`) ausser lesend.
* Keine Secrets oder vollständigen Verbindungs URLs in Chat, Logs, Commits oder Berichten. Wurde eine automatische Freigabe abgelehnt: nicht umgehen, den Besitzer fragen.
* Staging Daten sind eine Kopie echter Spielerdaten und bleiben privat.
* Netlify mit der Verbindung `Arbeit` (Konto bern.ch) verwalten, nicht mit dem Google Konto des Browsers.

## Schritte

1. **Netlify Staging Deployment** für Site `goalglicker` (`a598db88-81d8-4d9d-b244-7f98b1f12fd6`): Branch Deploy des Branches `claude/affectionate-lovelace-vgli3d`. Die Site ist mit GitHub verbunden (für PR 10 entstand automatisch das Deploy Preview `deploy-preview-10--goalglicker.netlify.app`, das ist **kein** Staging). Branch Deploys für diesen Branch einschalten. Die von Netlify gemeldete Branch Deploy Adresse notieren (nicht erfinden).
2. **Umgebungsvariablen nur für diesen Branch Kontext** (Werte nie ausgeben, nur Namen und Scope bestätigen):
   * `NEON_AUTH_BASE_URL` = Auth URL von `migration-staging` (Wert aus der Neon-Konfiguration übernehmen; keine konkrete URL im Repository speichern)
   * `NEON_AUTH_COOKIE_SECRET` = neu erzeugt, mindestens 32 Zeichen, nur für Staging
   * `DATABASE_URL` = Pooler Host `ep-long-shadow-b4ngl6x8-pooler.c-6.us-east-2.aws.neon.tech`, Datenbank `neondb`, `?sslmode=require`, Rolle `goal_clicker_app` (Schritt 4)
   * `LEGACY_SUPABASE_URL` und `LEGACY_SUPABASE_PUBLISHABLE_KEY` des Supabase Projekts (öffentlicher Schlüssel)
   * Bestätigen, dass Produktion und Deploy Previews diese Werte **nicht** bekommen und dass der Branch Kontext sie wirklich erhält.
3. **Neon Auth Staging** (`br-lingering-unit-b4elxjkp`): Trusted Origin = genau die Staging Adresse aus Schritt 1. Google bleibt mit geteilten Zugangsdaten. (Geprüft am 2. November: `delete-user` gibt es in Managed Better Auth nicht; das Spiel nutzt dafür einen Löschauftrag, nichts einzustellen.)
4. **Datenbank Staging:** Migration 0007, Import der 9 alten Logins und die Rolle `goal_clicker_app` hat Claude am 2. November schon eingespielt (Prüfsummen gleich wie Supabase und Neon Produktion). Offen ist nur: **Passwort für `goal_clicker_app` setzen** (Neon Console > Branch `migration-staging` > Roles, oder `\password goal_clicker_app` in psql), dann die Pooler URL mit dieser Rolle als `DATABASE_URL` des Staging Kontexts.
5. **Pooler prüfen:** mit der Pooler URL als `goal_clicker_app` `select 1` und eine Schreibprobe in `rate_limits` (Schlüssel `pooler-check`, danach löschen). Ergebnis melden.
6. **Deploy auslösen** (Branch Deploy, kein Produktionsdeploy) und prüfen: Login Seite erscheint, `GET /api/account` liefert `configured: true`.
7. **Prüfungen auf Staging** mit Testkonten und, mit Zustimmung der Spieler oder des Besitzers, mindestens einem echten Originalkonto pro Art: neue Google Anmeldung, neues Benutzername Konto, altes Google Konto, altes Benutzername Konto (normal anmelden), Profil und Spielstand sichtbar, Neuladen, zweites Gerät, Welt erstellen, mit zweitem Konto beitreten, gleichzeitig klicken, gemeinsamer Kauf, Session Widerruf (in Neon Auth), Verbindung trennen und wieder verbinden, Neuladen im Multiplayer, fremde Welt ohne Sitz verweigert, Rate Limit beim Login (mehr als 20 Versuche pro Minute), Abmelden. `scripts/migration/verify-accounts.mts` danach: Übernahmestand.
8. **Verbrauch messen:** Netlify Function Logs (Anzahl Aufrufe, Dauer), Netlify Credits vorher und nachher, Neon Transfer und CU Stunden für den Testzeitraum.
9. **Sicherung:** verschlüsselter `pg_dump` von Supabase und Neon `production` ausserhalb der Anbieter, eine Testwiederherstellung in eine Scratch Datenbank; Snapshot `snap-crimson-dawn-b4uf6sbi` testweise in einen neuen Branch wiederherstellen und danach wieder löschen.

## Bericht zurück

Pro Schritt: erledigt oder blockiert (mit Grund), welche Variablen in welchem Scope gesetzt sind (nur Namen), Staging Adresse, Ergebnis Pooler, Ergebnis `delete-user`, Ausgabe von `verify-accounts.mts` (enthält keine persönlichen Daten), Fehler mit Zeitpunkt und Route, gemessene Verbrauchswerte. Keine Freigabe der Produktion ohne ausdrückliche Zustimmung des Besitzers.
