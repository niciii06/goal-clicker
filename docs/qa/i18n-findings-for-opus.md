# Fehlende englische Texte: Fundstellen für Opus (Übersetzungsticket)

Stand: gemeinsamer Kandidat `39ffbd2` (Etappe 3), geprüft am 14. November 2026 im Browser mit englischer Oberfläche. **Nur Befund, in diesem Branch nicht geändert.** Sonnet hat dafür keine Katalogschlüssel angelegt und keine Texte umgestellt, damit sich die Arbeitsbranches nicht überschneiden.

Belegt im Browser (englische Oberfläche): der Tooltip der Formkästchen zeigt «Spieltag 1 · Heim · … 2:1 …», die Aria Beschriftung beginnt mit «Sieg:», die Zeile der seltenen Karte endet auf «Seltene Karte für deinen Club.».

| Bereich | Fundstelle (Stand `39ffbd2`) | Deutscher Text im Code |
|---|---|---|
| Saison: Tooltip der Formkästchen | `app/qol/season-insights.ts` Zeile 29 (`formMatchLabel`) | `Spieltag {n} · Heim/Auswärts · {Club} {a}:{b} {Club}` |
| Saison: Aria Label der Formkästchen | `app/season-panel.tsx` Zeile 51 | `"Sieg"` und `"Niederlage"` fest eingebaut (Unentschieden kommt schon aus dem Katalog) |
| Saison: Aufstiegsausblick über der Tabelle | `app/qol/season-insights.ts` Zeilen 46 bis 58 (`promotionOutlook`) | «noch 1 Spiel» / «noch n Spiele», «Aufstieg sicher», «Hall of Fame sicher», «Aufstiegsplatz · …», «… nicht mehr möglich · …», «Abstiegsplatz · n Punkte bis Platz n · …», «n Punkt(e) Rückstand auf Platz n · …» |
| Kader: Fixieren | `app/game-app.tsx` Zeile 3809 (`starxi-pin-button`) | `"Fixieren"` (das Gegenstück «Fixierung lösen» kommt aus dem Katalog `squad.unpin`) |
| Kader: Lücken, Bank, Startelf | `app/game-app.tsx` Zeile 3809 (`starxi-squad-tools`, `starxi-best-button`) | «Lücken füllen ({n})», «Beste Bank», «★ Beste Startelf» |
| Kartenenthüllung, seltene Karte (80 bis 85) | `app/game-app.tsx` Zeile 3944 | `${openedBy} hat ${Aktion}.`, «Doppelt gezogen. Du bekommst automatisch … Fragmente für Custom-Karten.», «… · Rating n. Seltene Karte für deinen Club.» (die Walkout Variante nutzt schon `reveal.duplicateBody` und `reveal.walkoutBody`) |
| Kartenenthüllung, weitere Zusammenfassung | `app/game-app.tsx` Zeile 3952 | `${openedBy} hat ${Aktion}.` |

Hinweise zur Übernahme:
* Die Reihenfolge der Spalten, Buchstaben und Farben der Formkästchen darf sich durch die Übersetzung nicht ändern (Notion Ticket «Saisontabelle»), nur Tooltip und Aria Text.
* `tests/browser/sonnet-acceptance.test.ts` vergleicht bewusst keine Texte, es prüft die Funktion in Deutsch und Englisch. Ein Textvergleich auf Deutsch in `tests/qol-season.test.ts` (Ausblick) bleibt gültig, solange der deutsche Wortlaut unverändert in den Katalog wandert.
* Diese Liste ist nicht vollständig für die ganze Oberfläche, sie umfasst nur die Bereiche der vier Sonnet Abnahmen (Saisontabelle, Kartenenthüllung, Bestes Team, Auf und Abstieg).
