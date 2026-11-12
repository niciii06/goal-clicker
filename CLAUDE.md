# Goal Clicker

Spielcode, Prüfbefehle und Projektstruktur stehen in `README.md`.

## "Was ist neu"

Einträge in `app/whats-new.ts` gibt es **nur, wenn der Nutzer ausdrücklich darum bittet**. Updates bekommen nicht automatisch einen Eintrag.

Wenn ein Eintrag gewünscht ist:

* Er kommt **oben** in die Liste; `id` beginnt mit dem Datum (`JJJJ-MM-TT-stichwort`) und ist neu.
* Kurzer Titel und 2 bis 6 kurze Punkte auf Deutsch, mit Umlauten, ohne Gedankenstriche, aus Sicht der Spieler.
* Jeder Spieler sieht den neuesten Eintrag genau einmal; der Gesehen Status reist mit dem Cloud Spielstand des Kontos. Ganz neue Spieler sehen kein Fenster.

## Balance

`npx tsx scripts/balance/simulate-economy.mts` zeigt passives Einkommen pro Liga, Amortisation der Upgrades, wie lange ein Pack beim Freischalten zum Ansparen braucht (Median und P90, passiv, aktiv und Koop, mit VAR und Ereignissen), den tatsächlichen Mehrertrag der Klickupgrades und ganze Karrieren mit Packkäufen und Partien (`scripts/balance/progression-model.ts`). `tests/rebalance.test.ts` und `tests/balance-review.test.ts` halten die Grenzen fest (siehe `docs/balance-update.md`). Grundpreise der Upgrades und Packpreise sind runde Beträge (1 / 1,5 / 2 / 2,5 / 3 / 4 / 5 / 6 / 7,5 / 8 mal einer Zehnerpotenz). Die Preise der weiteren Upgradestufen sind auf zwei signifikante Stellen gerundet (z.B. 12, 150, 4800, 1,2 Mio) und steigen von Stufe zu Stufe streng an.

## Frontend

Bei jeder neuen oder geänderten Oberfläche gelten die Apple Human Interface Guidelines als Designgrundlage (Skill `/apple-design`, wenn verfügbar):

* Klare visuelle Hierarchie und konsistente Navigation, Handy, Tablet und Desktop prüfen.
* Touch Ziele von mindestens 44 Punkten, lesbare Typografie, Textkontrast von mindestens 4,5 zu 1 in Hell und Dunkel.
* Sichtbarer Tastaturfokus, `prefers-reduced-motion` respektieren, Animationen nur mit `transform` und `opacity`.
* Browser Titel und App Icons ohne Emojis, Farben aus den Tokens in `app/globals.css`.
* Bestehende Ansichten werden bei der nächsten Bearbeitung des betroffenen Bereichs angeglichen, nicht auf Vorrat umgebaut.
