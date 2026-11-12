# Übersetzungen: Fundament und Plan

Stand 12. November 2026, Branch `claude/determined-cannon-6u5msx`. Notion: «Zentrales Übersetzungssystem: Englisch zuerst, später FR und ES» (Opus, P1).

**Was es jetzt gibt:** ein kleines, eigenes Übersetzungsfundament, mit Tests, und als erster Schritt laufen alle Meldungen der Konto und Cloud Save API, die Prüfmeldungen für Benutzername, Anzeigename und Passwort sowie die Sync und Update Meldungen über den Katalog. **Was es nicht gibt:** keine Sprachwahl und keine englische Oberfläche. Deutsch ist die einzige eingeschaltete Sprache; jede Meldung ist Byte für Byte dieselbe wie vorher.

## Schritt 1: Konto, Cloud Save und Prüfmeldungen (Branch `claude/opus-i18n-account-messages`)

| Datei | Änderung |
| --- | --- |
| `app/account-api.ts` | 29 verschiedene Meldungen lesen den Katalog (`t("account.…")`, `t("save.…")`, `t("request.…")`); Fehlercodes und Statuscodes unverändert. |
| `app/profile-rules.ts` | 8 Prüfmeldungen mit Platzhaltern (`{min}`, `{max}`); Server und Formular teilen sie wie bisher. |
| `app/cloud-sync.ts`, `app/game/save-schema.ts`, `app/multiplayer-protocol.ts` | Die vier gemeinsamen Meldungskonstanten lesen den Katalog. |
| `app/i18n/messages/de.ts`, `en.ts` | Die Meldungen auf Deutsch (Quelle) und Englisch. |
| `tests/i18n-account.test.ts` | Deutsche Texte eingefroren aus `main` 383421b, Englisch vollständig mit gleichen Platzhaltern, keine eigenen deutschen Meldungen mehr in den zwei Dateien, Antworten der Save API und Prüfungen unverändert. |

Nachweise beim Umbau: `account-api.ts` mit den Katalogtexten zurückersetzt ist Byte für Byte gleich der Datei auf `main`; `profile-rules.ts` alt und neu liefern auf 57 Eingaben dieselben Meldungen; die vier Konstanten sind gleich.

Diese Dateien sind auf Sonnets Branch (Stand `28416b4`) nicht geändert.

## Dateien

| Datei | Zweck |
| --- | --- |
| `app/i18n/locales.ts` | Sprachen `de`, `en`, `fr`, `es`; eingeschaltet nur `de`. Auflösung gespeicherte Wahl, dann Browsersprache, dann Deutsch. Speichern der Wahl, robust gegen gesperrten oder vollen Speicher. |
| `app/i18n/messages/de.ts` | Deutscher Quellkatalog. Jeder Schlüssel jeder Sprache kommt von hier. |
| `app/i18n/messages/en.ts` | Englischer Katalog (britisches Englisch), nur für die Startschlüssel. |
| `app/i18n/translate.ts` | `translate`, `translator`: Platzhalter `{name}`, Mehrzahl über `Intl.PluralRules`, Zahlen im Format der Sprache, Rückfall auf Deutsch je Schlüssel, Lückenbericht je Sprache. |
| `tests/i18n.test.ts` | 8 Tests, siehe unten. |
| `tests/i18n-account.test.ts` | 5 Tests für Schritt 1. |
| `scripts/i18n/inventory.mjs` | Schätzt, wie viele deutsche Texte noch direkt im Code stehen und welche in Spielstände geschrieben werden. |

```bash
node --import tsx --test tests/i18n.test.ts tests/i18n-account.test.ts
```

```bash
node scripts/i18n/inventory.mjs --all
```

Die Tests prüfen:

* Die deutschen Einträge sind **wortgleich** mit den Konstanten, die sie später ersetzen (`STORAGE_FULL_MESSAGE`, `SAVE_TOO_LARGE_MESSAGE`, `NEWER_VERSION_MESSAGE`, `MULTIPLAYER_UPDATE_MESSAGE`) und mit dem Zahlenformat de-CH.
* Mit nur Deutsch eingeschaltet schaltet keine gespeicherte Wahl und keine Browsersprache um.
* Sobald eine Sprache eingeschaltet wäre: gespeicherte Wahl vor Browser vor Deutsch; nicht eingeschaltete Sprachen werden nie gezeigt.
* Fehlende Übersetzungen fallen je Schlüssel auf Deutsch zurück, samt deutschem Zahlenformat.
* Mehrzahl richtig für Deutsch und Englisch; ein fehlender Wert bleibt als `{count}` sichtbar statt zu verschwinden.
* Kein Katalog hat Schlüssel, die Deutsch nicht kennt, und jede Übersetzung behält die Platzhalter.
* Ausserhalb von `app/i18n` liest oder speichert nichts eine Sprache, und wer übersetzt, übersetzt nur in die Quellsprache. `page.tsx`, `game-app.tsx` und `layout.tsx` importieren das Fundament nicht.

`tests/i18n.test.ts` und `tests/i18n-account.test.ts` stehen noch nicht in `npm run test:unit`, weil `package.json` auf Sonnets Branch geändert ist. Nachtragen nach dem Zusammenführen.

## Umfang laut Inventar

Rund **1760 deutsche Texte in 88 Dateien** (Schätzung; Spielernamen in den Kartenpools zählen teils fälschlich mit). Am meisten in `game-app.tsx` (rund 400), `feature-data.ts`, `press-conference.ts`, der Multiplayer Route und `career-panels.tsx`. Mehrere dieser Dateien sind auf Sonnets Branch geändert (`page.tsx`, `feature-data.ts`, `app/api/multiplayer/route.ts`, `season-panel.tsx`, `tutorial.ts`, `account-gate.tsx` und weitere); sie habe ich nicht angefasst.

## Blocker für eine echte Umstellung

1. **Deutscher Text wird in Spielstände und Welten geschrieben.** Verlaufseinträge (`addHistory`, rund 57 Stellen), Zeitungsschlagzeilen und Pressetexte landen als fertiger deutscher Satz im Spielstand und in `coop_rooms.shared_features_json`. Ein englischer Spieler sähe alte Einträge weiter auf Deutsch, und in einer Koopwelt mit zwei Sprachen schreibt jeder in seiner. Lösung braucht eine Formatentscheidung (Schlüssel plus Werte statt Text speichern, alte Einträge bleiben Text) und eine Migration im Spielstand.
2. **Server schickt deutsche Fehlermeldungen.** `account-api.ts` liest sie jetzt aus dem Katalog, liefert aber weiter den deutschen Satz. Derselbe `errorCode` steht teils für verschiedene Sätze (zum Beispiel `INVALID` für «Die Spielstand Version fehlt.» und «Der Spielstand ist unvollständig.»), und manche Antworten haben keinen Code («Die Anfrage ist ungültig.», «Der Server ist gerade nicht erreichbar.»). Die Multiplayer Route (rund 140 Texte) ist auf Sonnets Branch geändert und noch nicht umgestellt.
3. **Gekoppelte Dateien.** Die grossen Textmengen liegen in Dateien, an denen Sonnet arbeitet. Eine schrittweise Umstellung geht erst nach dem Zusammenführen ohne Konflikte.
4. **Englischer Fussballwortschatz und Ton** sind nicht festgelegt (Liga, Pokal, Fragmente, Packnamen).

## Entscheidungen für Nicolas

**A. Wo wird die Sprachwahl gespeichert?**
1. Empfohlen: auf dem Gerät (`goalClickerLocaleV1`) und zusätzlich im Cloud Spielstand des Kontos, wie der «Was ist neu» Status; so gilt sie auf allen Geräten.
2. Nur auf dem Gerät (einfacher, aber pro Gerät neu wählen).

**B. Verlauf und Schlagzeilen im Spielstand?**
1. Empfohlen: neue Einträge als Schlüssel plus Werte speichern, beim Anzeigen übersetzen; alte Einträge bleiben deutscher Text.
2. Weiter Text speichern, in der Sprache des Schreibenden (Koopwelten werden gemischt).

**C. Fehlermeldungen vom Server?**
1. Empfohlen: eindeutiger `errorCode` je Meldung, die Oberfläche übersetzt; der deutsche Satz bleibt als Rückfall im Antworttext.
2. Server übersetzt anhand der Sprachwahl in der Anfrage.

**D. Englische Variante:** britisch (`en-GB`, «match», «fixture») wie im Fundament angelegt, oder amerikanisch.

**E. Eigene kleine Schicht oder Bibliothek** (zum Beispiel `next-intl`)? Das Fundament ist ohne Abhängigkeit gebaut, weil `package.json` gerade auf Sonnets Branch geändert ist. Für das Spiel (eine Seite, viele dynamische Texte) reicht die eigene Schicht; eine Bibliothek lohnt sich erst mit Sprachrouten oder serverseitigem Rendern pro Sprache.

## Vorgeschlagene Reihenfolge nach Freigabe

1. Kleine, gemeinsame Texte zuerst. Erledigt in Schritt 1: Sync und Update Meldungen, Konto und Save API, Prüfmeldungen. Offen: Bestätigungsdialoge, `account-panel.tsx`, `account-gate.tsx` (Sonnet).
2. Fehlercodes vereinheitlichen (Entscheidung C).
3. Speicherformat für Verlauf und Schlagzeilen (Entscheidung B) mit Migration und Tests für alte Spielstände.
4. Grosse Oberflächen (`game-app.tsx`, Karriere, Saison, Reise) Datei für Datei.
5. Erst wenn `catalogGaps('en').missing` leer ist: Sprachwahl in den Einstellungen gestalten (Apple Design Richtlinien, mobile Breiten prüfen) und `en` in `ENABLED_LOCALES` aufnehmen.
6. Französisch und Spanisch: eigene Kataloge `fr.ts` und `es.ts`; das Fundament fällt bis dahin auf Deutsch zurück und Mehrzahlregeln sind schon vorhanden.
