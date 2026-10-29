# Goal Clicker

Spielcode, Prüfbefehle und Projektstruktur stehen in `README.md`.

## "Was ist neu"

Einträge in `app/whats-new.ts` gibt es **nur, wenn der Nutzer ausdrücklich darum bittet**. Updates bekommen nicht automatisch einen Eintrag.

Wenn ein Eintrag gewünscht ist:

* Er kommt **oben** in die Liste; `id` beginnt mit dem Datum (`JJJJ-MM-TT-stichwort`) und ist neu.
* Kurzer Titel und 2 bis 6 kurze Punkte auf Deutsch, mit Umlauten, ohne Gedankenstriche, aus Sicht der Spieler.
* Jeder Spieler sieht den neuesten Eintrag genau einmal; der Gesehen Status reist mit dem Cloud Spielstand des Kontos. Ganz neue Spieler sehen kein Fenster.

## Balance

`npx tsx scripts/balance/simulate-economy.mts` zeigt Einkommen pro Liga, Amortisation der Upgrades und Packpreise in Minuten Einkommen; `tests/rebalance.test.ts` hält die Grenzen fest (siehe `docs/balance-update.md`).
