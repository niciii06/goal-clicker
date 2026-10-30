# Goal Clicker

Spielcode, Prüfbefehle und Projektstruktur stehen in `README.md`.

## "Was ist neu"

Einträge in `app/whats-new.ts` gibt es **nur, wenn der Nutzer ausdrücklich darum bittet**. Updates bekommen nicht automatisch einen Eintrag.

Wenn ein Eintrag gewünscht ist:

* Er kommt **oben** in die Liste; `id` beginnt mit dem Datum (`JJJJ-MM-TT-stichwort`) und ist neu.
* Kurzer Titel und 2 bis 6 kurze Punkte auf Deutsch, mit Umlauten, ohne Gedankenstriche, aus Sicht der Spieler.
* Jeder Spieler sieht den neuesten Eintrag genau einmal; der Gesehen Status reist mit dem Cloud Spielstand des Kontos. Ganz neue Spieler sehen kein Fenster.

## Balance

`npx tsx scripts/balance/simulate-economy.mts` zeigt passives Einkommen pro Liga, Amortisation der Upgrades, wie lange ein Pack beim Freischalten zum Ansparen braucht (Median und P90, passiv, aktiv und Koop, mit VAR und Ereignissen), den tatsächlichen Mehrertrag der Klickupgrades und ganze Karrieren mit Packkäufen und Partien (`scripts/balance/progression-model.ts`). `tests/rebalance.test.ts` und `tests/balance-review.test.ts` halten die Grenzen fest (siehe `docs/balance-update.md`). Alle Preise sind runde Beträge (1 / 1,5 / 2 / 2,5 / 3 / 4 / 5 / 6 / 7,5 / 8 mal einer Zehnerpotenz).
