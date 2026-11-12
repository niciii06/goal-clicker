# Datenbank Profil: Abfragen und Egress im Multiplayer

Stand 12. November 2026, Branch `claude/determined-cannon-6u5msx`. Gemessen mit den **echten API Handlern** (`app/api/multiplayer/route.ts`, Cloud Save aus `app/account-api.ts`, Rangliste aus `app/leaderboard-api.ts`) gegen eine **lokale Wegwerf PostgreSQL 16.15** mit synthetischen Welten. Keine Verbindung zu Neon, keine Codeänderung an Datenbank oder Route.

**Was die Zahlen bedeuten:** Anzahl Abfragen und Bytes sind auf Neon gleich (gleiche Abfragen, gleiches Protokoll). Die Millisekunden sind lokal ohne Netzwerk gemessen und dienen nur zum Vergleich der Abfragen untereinander; auf Neon kommen Netzwerk, Pooler und kalte Compute hinzu.

## Ausführen

```bash
scripts/db-rehearsal/local-cluster.sh start
```

```bash
PROFILE_DATABASE_URL=postgres://tester@127.0.0.1:55432/postgres npx tsx scripts/db-profile/profile.mts
```

```bash
PROFILE_DATABASE_URL=postgres://tester@127.0.0.1:55432/postgres npx tsx scripts/db-profile/profile.mts --with-0009
```

Das Skript verweigert jeden nicht lokalen Server, legt eine eigene Datenbank `gc_profile_*` an und löscht sie am Ende. Die Bytes zählt ein lokaler TCP Relay zwischen Handler und PostgreSQL (Egress = Server zum Client, das rechnet Neon ab). Abfragen und Zeiten kommen aus `pg_stat_statements`.

## Testwelt

Eine späte Koopwelt: alle Karten im Besitz, Karrierewerte, 30 Verlaufseinträge, so gespeichert wie die Route speichert. Features **570 KB**, Backup Kopie **571 KB**. Dazu 2000 kleine Welten für Liste und Rangliste und ein Cloud Spielstand von **191 KB**.

## Ergebnisse je Anfrage

| Szenario | Abfragen | DB Egress | DB Ingress | DB Zeit ohne 0009 | DB Zeit mit 0009 |
| --- | --- | --- | --- | --- | --- |
| Poll Warteraum, Features bekannt (alle 1,5 s) | 1 | 2,1 KB | 1,0 KB | 1,2 ms | 0,02 ms |
| Live Tick, Features bekannt (alle 1,5 s) | 1 | 2,1 KB | 1,0 KB | 1,2 ms | 0,02 ms |
| Poll ohne Features, warme Instanz | 1 | 2,1 KB | 1,0 KB | 1,3 ms | 0,04 ms |
| Poll ohne Features, kalte Instanz | 2 | **575 KB** | 2,1 KB | 2,3 ms | 0,8 ms |
| Klickbatch | 1,9 | 4,1 KB | 2,9 KB | 2,9 ms | 1,1 ms |
| Spielaktion mit Featureänderung | 2,1 | 33 KB | **1,14 MB** | 14,9 ms | 15,5 ms |
| Weltenliste (alle 15 s) | 1 | 2,5 KB | 1,3 KB | 0,03 ms | 0,03 ms |
| Rangliste (2000 Welten) | 1 | 4,1 KB | 0,6 KB | 0,9 bis 1,2 ms | gleich |
| Cloud Save unverändert prüfen (`since`) | 1 | 0,3 KB | 0,3 KB | < 0,01 ms | gleich |
| Cloud Save vollständig laden | 1 | 191 KB | 0,3 KB | 0,3 ms | gleich |
| Cloud Save hochladen | 1,1 | 0,3 KB | 191 KB | 2,1 ms | gleich |

Hochgerechnet für **einen aktiven Koopspieler** (Poll oder Tick alle 1,5 s, also 2400 pro Stunde): rund **5 MB Egress pro Stunde** und **2,9 s DB Rechenzeit pro Stunde nur für md5** über die Features (ohne 0009). Mit 0009 fällt der md5 Anteil auf etwa 0,05 s.

## Befunde

1. **Polls und Ticks sind schon schlank.** Eine Abfrage, rund 2 KB, keine Features und nie das Backup. Kein N+1 gefunden. Die bestehenden Optimierungen (leichte Felder, `featuresKey`, `since` beim Cloud Save, Cache je Instanz) wirken wie dokumentiert; hier nichts doppelt bauen.
2. **md5 über die Features bei jedem Poll** ist der grösste DB Rechenanteil im Dauerbetrieb (1,2 ms je Poll bei 570 KB, linear mit der Weltgrösse). Migration 0009 (gespeicherter Schlüssel per Trigger) senkt das auf 0,02 ms. Egress ändert sich dadurch nicht. 0009 ist vorbereitet und in `docs/db-rehearsal.md` lokal geprobt (idempotent, Rollback exakt, Code läuft mit und ohne).
3. **Kalte Instanz liest die ganzen Features** (575 KB pro erster Anfrage je Welt und Instanz). Wie oft das passiert, hängt davon ab, wie viele Serverinstanzen ChatGPT Sites startet. Das lässt sich nur auf Neon messen (Egress Grafik gegen Anzahl aktiver Welten).
4. **Jede Spielaktion mit Featureänderung schreibt 1,14 MB** (Features und vollständige Backup Kopie) und braucht rund 15 ms DB Zeit (TOAST Kompression). Ingress ist bei Neon kein Egress, erzeugt aber WAL und damit Verlaufsspeicher und Rechenzeit.
5. **Rangliste:** sequentieller Scan mit Top N Sortierung, weil der Gleichstand nach `code` sortiert und der vorhandene Index `coop_rooms_total_goals_idx` dafür nicht passt. Lokal gemessen: 2000 Welten 0,8 ms, 20 000 Welten 7 ms, 100 000 Welten 16 ms. Mit 30 Aufrufen pro Minute und Adresse vorerst unkritisch.
6. **Weltenliste** nutzt die vier Sitz Indizes (BitmapOr), gut.
7. **Klickbatches** brauchen lokal rund 30 ms, davon nur etwa 3 ms in der Datenbank; der Rest ist JSON Verarbeitung der 570 KB Features im Handler. Die 429 Antworten im Lauf sind der gewollte Klickschutz (`CLICK_MIN_INTERVAL_MS`), weil das Skript schneller als ein Mensch klickt.
8. **Pooling:** `prepare: false`, `max` 3, `idle_timeout` 20 s passt zum Neon Pooler im Transaktionsmodus. Ob die Site wirklich den `-pooler` Host nutzt, lässt sich nur in den Site Variablen prüfen; nicht ungetestet erhöhen.

## Entscheidungen für Nicolas

**A. Migration 0009 anwenden?**
1. Empfohlen: zuerst auf einem Neon Testbranch mit `psql -f`, `schema-drift.mts` prüfen, dann Live. Spart rund 98 % der DB Zeit pro Poll, ändert keine Daten, Rollback steht im Dateikopf.
2. Noch warten, bis die Neon Rechenzeit tatsächlich drückt.

**B. Backup Kopie bei jeder Featureänderung?** (halbiert Schreibvolumen, berührt aber die Wiederherstellung)
1. So lassen (sicherste Variante, doppeltes Schreiben).
2. Backup nur noch alle paar Minuten oder bei Saisonende schreiben; braucht Anpassung in `gameColumns` und neue Tests für `readGame`.
3. Backup Spalte abschaffen und auf Neon PITR verlassen; erst nach einem echten Restore Test sinnvoll.

**C. Index für die Rangliste?**
1. Empfohlen: jetzt nicht. Erst ab etwa 20 000 Welten oder spürbarer Latenz.
2. Später Migration mit Index `(shared_total_goals desc, code)` und einem für die Ligasortierung, idempotent wie 0009.

## Was offen bleibt

* Messung auf Neon selbst: Egress und Compute Zeit pro Tag aus der Neon Konsole, Anzahl Welten und Weltgrössen mit `scripts/migration/verify-accounts.mts` (nur lesend, gibt Grössen aus). Das kann nur der Besitzer.
* Login Pfad (`/api/account`) nicht gemessen: er ruft Neon Auth über das Netz, das lokal nicht nachstellbar ist. Die Kontosuche selbst ist eine Abfrage mit Cache (`lookupAccount`).
* Keine Codeänderung an `db/index.ts` oder der Multiplayer Route: Sonnet arbeitet gerade an der Route, und jede Optimierung braucht laut Ticket gesonderte Zustimmung.
