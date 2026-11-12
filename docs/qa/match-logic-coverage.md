# Saison und Matchlogik: Testabdeckung

Stand 12. November 2026, Ticket «Saison und Matchlogik durch Regressionstests absichern». Es wurden keine Regeln geändert. Die Regeln sind bereits durch Tests belegt; dieses Dokument ordnet jedes Akzeptanzkriterium den Tests zu und hält fest, wie sie ausgeführt wurden.

Nachweis: 15 Testdateien (unten), 166 Tests, zweimal hintereinander ausgeführt, beide Läufe 166 von 166 grün (Node 24, lokal):

```bash
node --import tsx --test tests/discipline.test.ts tests/red-card-competition.test.ts tests/availability-transfers.test.ts tests/availability-coop.test.ts tests/goalkeeper.test.ts tests/match-changes.test.ts tests/tournament-abandon.test.ts tests/interactive-match.test.ts tests/prestige-reset.test.ts tests/prestige.test.ts tests/football-rules.test.ts tests/match-timing.test.ts tests/match-squad-editor.test.ts tests/season-tie-break.test.ts tests/game-balance.test.ts
```

| Kriterium | Wo abgesichert |
|---|---|
| Spielende bei 120′ (auch mit angeforderter Änderung, mit den Pausen bei 90′ und 105′) | `interactive-match.test.ts`: «a five minute match with extra time reaches the final whistle at 120 minutes…», «a drawn knockout match pauses at 90…», «extra time pauses once more at 105…» |
| Rote Karten (Liga und Turnier getrennt, Altspielstände) | `red-card-competition.test.ts`, `discipline.test.ts` (zwei Gelbe in einem Spiel sind Rot) |
| Sperren (Gelb Summen, Wettbewerbe getrennt, Reload und Wiederholung erzeugen keine zweite Sperre) | `discipline.test.ts`, `availability-transfers.test.ts` (Verkauf entfernt Sperre und Gelb) |
| Bank (12er Bank), Torwart, Torwart Ersatz | `game-balance.test.ts` (Bank hat `STAR_XI_BENCH_SIZE` = 12 Plätze), `goalkeeper.test.ts`, `match-squad-editor.test.ts`, `availability-transfers.test.ts` (Formation füllt Lücken aus der Bank) |
| Wechsel: Fenster, Atomarität, Momentum | `match-changes.test.ts` (drei Fenster, fünf Wechsel, serverseitige Ablehnung), `game-balance.test.ts` («substitutions update both live OVR and match momentum») |
| Verletzungen | `availability-transfers.test.ts` (verletzte, gesperrte und verliehene Karten bleiben draussen), `match-changes.test.ts` |
| Transfers erst nach dem Match | `availability-transfers.test.ts` («an offer that would run out during a home match waits for the final whistle»), `availability-coop.test.ts` (Koop sperrt Annehmen und Ablehnen während des Spiels) |
| Turnierpause, Turnierabbruch | `tournament-abandon.test.ts`, `availability-transfers.test.ts` (Turnierpause bleibt mit Countdown), `match-timing.test.ts` |
| Prestige | `prestige-reset.test.ts` (Zurücksetzen, behaltene Karte, Leihe, Koop, Wiederholung, Reload), `prestige.test.ts` |

## Grenzen

* Die Browser Abdeckung (Smoke und Konto) lief lokal ebenfalls grün, siehe `docs/qa/` und die CI. Sie gehört nicht zu diesem Ticket.
* Neue Tests wurden hier bewusst nicht hinzugefügt: Jedes Kriterium hat bereits mindestens einen gezielten Test. Eine Dopplung würde nur die Laufzeit erhöhen.
* Ein Test ersetzt keine Spielbeobachtung: Die Taktung (Sekunden bis zur Verlängerung) ist nur synthetisch geprüft.
