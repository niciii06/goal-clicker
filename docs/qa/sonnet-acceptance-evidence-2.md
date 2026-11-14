# Sonnet Abnahmen: Matchpausen, Prämienpacks, Willkommens Walkout

Basis: Kandidat 39ffbd2 plus Tabellen Fix 18399c6 (Branch `sonnet/fix-joint-39ffbd2`). Nichts an main oder am gemeinsamen Kandidaten geändert.

## Matchpausen bei 90 und 105 Minuten
Befund: erfüllt, kein Fehler gefunden.

| Kriterium | Beleg |
| --- | --- |
| Pause bei 90 und 105 Minuten, Uhr steht | `tests/extra-time-pauses.test.ts` (Simulationszeit 5400 und 6300 s, `matchPaused`), Browser `tests/browser/match-flow.test.ts` (Desktop und Handy, nach 3,5 s und nach Neuladen gleiche Minute) |
| Wechsel wie in der Halbzeit, Wechselfenster nicht verbraucht | `tests/extra-time-pauses.test.ts` (`substitutionsUsed` plus 1, `subWindowsUsed` unverändert, keine doppelte Pause) |
| Zeitleiste verschiebt sich um die Pausendauer | `tests/extra-time-pauses.test.ts` (Ende plus 20 Minuten nach 20 Minuten Pause, Simulationszeit unverändert) |
| Grenzen (5 Wechsel, doppelte Spieler, abgelehnter Entwurf ändert nichts) | `tests/extra-time-pauses.test.ts`, bestehend `tests/interactive-match.test.ts` |
| Weiterspielen ab dieser Minute | Browser: Wechselfenster schliessen setzt fort, Karte verschwindet, Zeit ab Minute |
| Alte laufende Partien ohne Simulation | `tests/extra-time-pauses.test.ts` (keine neue Pause, Ende oder Elfmeterschiessen) |

Hinweis: Das Schliessen des Wechselfensters setzt die Partie fort, genau wie in der Halbzeit (gewollt, `onCancel` ruft `onResume`). Alte Partien ohne Simulation lassen Ligaspiele in die Verlängerung gehen (bereits früher so, betrifft nur schon laufende Partien).

## Entfernte Prämienpacks
Befund: erfüllt.

| Kriterium | Beleg |
| --- | --- |
| Solo: Ligaspiel endet ohne neues Pack, alter Zähler 3 bleibt 3 | Browser `tests/browser/match-flow.test.ts` (letztes Spiel) |
| Koop: Siege, Remis, Niederlagen geben kein Pack, gespeichertes Pack bleibt, kein Matchstempel Eintrag | `tests/league-no-reward-packs.test.ts` (mindestens 12 abgeschlossene Spiele) |
| Bereits verdiente Packs lassen sich weiter öffnen | `tests/league-no-reward-packs.test.ts` (zweiter Test), `tests/rewards-api.test.ts` |
| Balance ohne Prämienpacks | `tests/balance-review.test.ts` |

## Willkommens Walkout
Befund: erfüllt mit vorhandenen Tests, keine neuen nötig.
Belege: `tests/tutorial.test.ts` (Zustände pending, available, claimed, forfeited und Tutorialschritte), `tests/browser/smoke.test.ts` (Willkommens- und Tutorialablauf), `tests/rewards-api.test.ts`.

## Läufe auf dieser Basis
Neu: `extra-time-pauses` 7, `league-no-reward-packs` 2, Browser `match-flow` 5, alle grün, 6 Wiederholungen stabil. Zusammen mit interactive-match, balance-review, tutorial, rewards-api 71 Tests grün. Volle Suite von 18399c6 (unit 791 plus 43, Smoke 36, Abnahme 12, Konto 16, DB 32) unverändert gültig. tsc ohne Fehler, eslint ohne Warnungen in den neuen Dateien.

## Offen (braucht echte Geräte oder Livesystem)
iPhone/iPad Kopfzeile (kein WebKit hier), Busanimation auf echtem Gerät, Live Prüfungen (Live läuft ältere Version), Zertifikat, Neon und AdSense.
