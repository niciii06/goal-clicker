# Datenbank Proben: Restore, PITR, Mehrgeräte, Migrationen

Stand 12. November 2026, Branch `claude/determined-cannon-6u5msx`. Alles hier lief auf einer **lokalen Wegwerf PostgreSQL 16.15** mit **synthetischen Daten**. Keine Verbindung zu Neon, keine Produktionsdaten, keine Migration auf einer echten Datenbank.

**Wichtig:** Eine lokale Probe zeigt, dass Sicherung, Wiederherstellung, WAL Replay und der Code mit einer zurückgesetzten Datenbank richtig umgehen. Sie beweist **nicht**, dass ein Neon Restore (Branch Restore oder Point in Time Restore) funktioniert, wie weit Neons Verlauf auf dem aktuellen Plan zurückreicht oder wie lange ein Restore dauert. Das muss der Besitzer einmal auf einem Neon Testbranch ausführen (Ablauf unten).

## Befehle

```bash
scripts/db-rehearsal/local-cluster.sh start
```

```bash
TEST_DATABASE_URL=postgres://tester@127.0.0.1:55432/postgres node --import tsx --test tests/db-rehearsal.test.ts
```

```bash
TEST_DATABASE_URL=postgres://tester@127.0.0.1:55432/postgres npm run test:db
```

```bash
scripts/db-rehearsal/local-cluster.sh pitr
```

```bash
scripts/db-rehearsal/local-cluster.sh stop
```

`tests/db-rehearsal.test.ts` verweigert jede URL, die nicht auf `localhost`, `127.0.0.1` oder `::1` zeigt. Alle Datenbanken, die der Test anlegt, heissen `gc_rehearsal_*` und werden am Ende gelöscht. Der Cluster liegt unter `/var/tmp/gc-db-rehearsal` (als root läuft der Server als Systembenutzer `postgres`).

## Ergebnisse vom 12. November 2026

| Probe | Ergebnis |
| --- | --- |
| `npm run test:db` (bestehende 32 Tests) auf leerer lokaler DB | 32 von 32 bestanden |
| `tests/db-rehearsal.test.ts` | 6 von 6 bestanden |
| `local-cluster.sh pitr` | Stand vor dem Vorfall exakt wiederhergestellt (Prüfsummen aller Spieltabellen gleich) |
| `drizzle-kit check` und `drizzle-kit generate` gegen eine Kopie von `drizzle/` | Kein Unterschied zwischen `db/schema.ts` und Snapshot 0007 |
| `schema-drift.mts` lokal | kein Drift bei sauberer DB, Drift erkannt bei absichtlich verändertem Schema (Exit 1) |

### Sicherung und Wiederherstellung (logisch)

`pg_dump -Fc` und `pg_restore` in eine neue Datenbank: Schema, RLS, Policies der Laufzeitrolle, Grants, alle Zeilen aller zehn Tabellen (md5 je Tabelle), UTF‑8 in Spielständen und grosse Zahlen (1,5e15) kommen identisch zurück. Rollen sind in `pg_dump` nicht enthalten (sie gehören dem Cluster); bei Neon bleiben sie im Branch erhalten, bei einem Umzug auf einen anderen Anbieter braucht es zusätzlich `pg_dumpall --globals-only` und neue Passwörter.

### Point in Time Recovery (lokal)

Basissicherung, danach weiter gespielt (Version 2 aller Spielstände), Zielzeitpunkt gemerkt, dann Vorfall (Spielstände und Welt gelöscht, Profile überschrieben). Wiederherstellung in einen **neuen** Cluster bis zum Zielzeitpunkt: alles nach der Basissicherung bis zum Zielzeitpunkt ist da, der Vorfall nicht. Das entspricht dem Vorgehen bei Neon (Restore in einen neuen Branch, nicht über den laufenden), ist aber nicht dasselbe System.

### Mehrere Geräte nach einem Restore

Laptop und Handy spielen abwechselnd auf einem Konto bis Version 3 (300 Tore). Die Datenbank wird auf die Sicherung bei Version 2 (200 Tore) zurückgesetzt. Ergebnis mit dem echten Code (`planInitialSync`, `putCloudSave`):

* Beide Geräte mit Version 3 und 300 Toren behalten ihren Stand (`keep-local`), egal ob seitdem gespielt.
* Ein drittes Gerät, zuletzt bei Version 1 und seitdem nicht gespielt, übernimmt den wiederhergestellten Cloud Stand (`use-cloud`).
* Schreiben beide Geräte gleichzeitig zurück, gewinnt genau eines; das andere bekommt dieselben 300 Tore als Konflikt zurück. Danach steht die Cloud wieder bei 300 Toren und beide Geräte machen normal weiter.
* Ein Gerät mit einer alten Version kann den neueren Stand nicht überschreiben (Konflikt).

### Migrationen

* Leere DB: Journal 0000 bis 0007, danach 0008 und 0009 von Hand, jeweils zweimal: Schema identisch nach dem ersten und zweiten Lauf (idempotent), keine Zeile verändert.
* Rollback von 0009 laut Kopfkommentar stellt das Schema exakt wieder her, keine Zeile geht verloren; erneutes Anwenden ergibt wieder dasselbe Schema.
* Der Code läuft vor und nach 0009 gleich; der Trigger hält `features_key` aktuell, neue Reisen bekommen `created_at`.
* **Branch ohne Journal (wie Neon):** `db:migrate` scheitert sofort an `CREATE TABLE "coop_rooms"` (42P07) und rollt vollständig zurück; Schema und Daten bleiben unverändert. Gefährlich ist es trotzdem: es ist kein Schutzmechanismus, sondern Zufall, dass 0000 nicht idempotent ist.
* **Vorschlag Baseline** (`scripts/db-rehearsal/baseline-drizzle-journal.sql`): trägt 0000 bis 0007 mit denselben Hashes und Zeitstempeln ein, die Drizzle selbst schreiben würde. Danach ist `db:migrate` ein No‑op, und eine spätere Migration 0010 läuft genau einmal. Die Datei prüft vorher, ob das Schema von 0007 vollständig da ist, und verweigert sonst.

## Empfohlene Migrationsstrategie (nicht umgesetzt, braucht Freigabe)

1. **Zuerst lesen:** `DATABASE_URL=<direkte Verbindung des Branches> npx tsx scripts/db-rehearsal/schema-drift.mts` auf dem Neon Testbranch, dann auf dem Live Branch. Die Sitzung ist nur lesend. Ergebnis im Ticket festhalten. Welcher Branch live ist, steht in den Variablen der Site (`HOSTING.md`).
2. **0008 und 0009 bleiben ausserhalb des Journals.** 0008 ist administrativ (eigenes Schema, eigene Rolle) und gehört nicht in eine Timeline, die jede Testumgebung automatisch durchläuft. 0009 bleibt von Hand, solange es nicht auf allen Branches angewendet ist. Spätere Migrationen nummerieren ab **0010**, damit sie nicht mit den Dateinamen 0008/0009 kollidieren (`drizzle-kit generate` würde sonst wieder `0008_...` erzeugen; vor dem Commit umbenennen und den Journal Tag anpassen).
3. **Baseline nur nach Freigabe:** auf einem frischen Neon Branch vom Live Branch (Kopie) zuerst `baseline-drizzle-journal.sql`, dann `drizzle-kit migrate` (muss No‑op sein), dann `schema-drift.mts`. Erst danach auf dem Live Branch, und nur, wenn künftig wirklich `db:migrate` statt `psql -f` verwendet werden soll. Bis dahin gilt weiter: neue Migrationen idempotent schreiben und mit `psql -f` einspielen.
4. **Jede neue Migration:** idempotent (`IF NOT EXISTS`), Rollback im Kopf, Code muss mit und ohne sie laufen, Probe mit `tests/db-rehearsal.test.ts` auf leerer DB und auf einer Kopie des Staging Schemas, erst Testbranch, dann Live.

## Was offen bleibt (nur der Besitzer kann es prüfen)

* **Echter Neon Restore:** auf einem Testbranch Zeitpunkt merken, Testdaten ändern, Restore in einen **neuen** Branch auf den gemerkten Zeitpunkt, dann `scripts/migration/verify-accounts.mts` auf beiden Branches vergleichen. Notieren: Verlaufsfenster des Plans, Dauer, ob Rollen und Passwörter der Laufzeitrolle mitkommen.
* **Wiederanmeldung mit zwei echten Geräten** auf goalclicker.ch (Neon Auth, Cookies, PWA). Die lokale Probe deckt nur die Datenbank und die Entscheidungslogik ab, nicht den Login.
* **Koop Welten nach einem Restore:** Welten liegen nur auf dem Server; Fortschritt zwischen Sicherung und Restore ist dort verloren (kein Gerät hält eine Kopie wie bei Solo Spielständen). Zusätzlich ignoriert ein offener Tab Antworten mit kleinerer Revision (`mergeCoopSessionRoom` in `app/game-app.tsx`), bis neu geladen wird oder die Serverrevision wieder höher ist; in der gespeicherten Weltenliste bleibt die alte Kopie mit höherer Revision stehen (`upsertSavedRoom`). Kein Datenverlust auf dem Server, aber nach einem Restore sollten Spieler die Seite neu laden. Nicht geändert, weil Koop Code eng gekoppelt ist.
* `tests/db-rehearsal.test.ts` steht noch nicht in `npm run test:db`, weil `package.json` gerade auf einem anderen Branch geändert wird. Nachtragen, sobald der zusammengeführt ist.
