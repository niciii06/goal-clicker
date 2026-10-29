# Goal Clicker

Spielcode, Prüfbefehle und Projektstruktur stehen in `README.md`.

## "Was ist neu" bei jedem Update

Jedes Update, das Spieler bemerken (neue Inhalte, Balance, Regeln, deaktivierte Funktionen), bekommt einen neuen Eintrag **oben** in `app/whats-new.ts`:

* `id` beginnt mit dem Datum (`JJJJ-MM-TT-stichwort`) und ist neu; die neueste `id` steht immer an erster Stelle.
* Kurzer Titel und 2 bis 6 kurze Punkte auf Deutsch, mit Umlauten, ohne Gedankenstriche, aus Sicht der Spieler.
* Jeder Spieler sieht den neuesten Eintrag genau einmal; der Gesehen Status reist mit dem Cloud Spielstand des Kontos. Ganz neue Spieler sehen kein Fenster.
* Reine interne Änderungen (Tests, Refactoring, Doku) brauchen keinen Eintrag.

## Balance

`npx tsx scripts/balance/simulate-economy.mts` zeigt Einkommen pro Liga, Amortisation der Upgrades und Packpreise in Minuten Einkommen; `tests/rebalance.test.ts` hält die Grenzen fest (siehe `docs/balance-update.md`).
