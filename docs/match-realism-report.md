# Goal Clicker: Umsetzungs- und Prüfbericht

> Historischer Stand. Aktuelle Regeln und Freigabe: [Release verification](release-match-realism.md) und [Sites project knowledge](chatgpt-sites-knowledge.md).

Stand: 16. Oktober 2026. Branch: `feat/match-realism-cup-travel`.

**Status: Teilumsetzung, noch nicht zur Produktionsfreigabe bereit.** Die Kernregeln
sind implementiert und die vollständige Testsuite besteht. Der gesamte Masterprompt
ist damit noch nicht vollständig erfüllt.

## 1. Implementierte Funktionen

- Neue Cup-Partien durchgehend auswärts; Finale des anhand der Konfiguration
  höchsten Cups in Wembley, neutral und mit Anreise. Liga-Spielplanung erhalten.
- Pfuschi: Rating 1, alle vorhandenen Attribute 1, keine Position, ☠️, nur Bank.
  Di Certo: Rating 100, ZM/ZDM. Beide im vorhandenen Spezialkarten-Zug enthalten;
  keine automatische Vergabe.
- Gegnerische direkte Platzverweise und zweite Verwarnungen; mehrere Platzverweise,
  persistente Gegner-IDs und Entfernung aus aktiven Akteuren und Aktionsauswahl.
- Persistenter Reisekader; neue Karten bleiben ausserhalb der Nominierung.
  Fabrizio und Ereignisplaner pausieren ab Abfahrt; Restzeiten werden nach
  Matchabschluss einmalig wiederhergestellt. Neuladen behält diese Regeln bei.
- Mehrere Wechsel mit Drag-/Tap-Bedienung vormerken und gemeinsam bestätigen;
  Ausführung am Unterbruch, maximal fünf Spieler und drei reguläre Fenster;
  Halbzeitwechsel verbrauchen kein Fenster.
- Neue Ligaspiele 210 Sekunden, höchste Ligen 240 Sekunden; Cups 240/270/300
  Sekunden nach Wettbewerb. Zusätzliche Pausen zählen nicht als aktive Spielzeit.
- Gespeicherte 4000-ms-Toranzeige nach dem sichtbaren Schuss sowie automatische
  10000-ms-Halbzeit bei Minute 45; Wechseloberfläche bleibt erreichbar.
- Taktik-Selektoren und ihre Stärke-/Fitness-Modifikatoren entfernt.
- Vereinsfarben für bekannte Club-Aliasse und kontrastreiche Ausweichfarben.
- Abseitsregeln mit gespeicherten Passmoment-Aufnahmen, Torwartattribute bei
  Paraden, Standardursprünge und begrenzte Ballbewegung zwischen Animationsbildern.
- Karte scrollt einmal pro Reise über eine Komponentenreferenz ins Sichtfeld.
  Geschätzte Verbindungen werden als „Routenverlauf geschätzt“ gekennzeichnet.
- 35 Schweizer und acht internationale Standortprüfungen mit kartierten
  Fussballfeld-Polygonen; reale Berner Plätze für die fünf fiktiven Clubs.
  Eindeutig gekennzeichnete Ausweichplätze statt erfundener Präzisionsangaben.

## 2. Wiederverwendete Systeme

Spielengine in `app/feature-data.ts`, Broadcast-/Canvas-Ansicht, Spieler- und
Spezialkarten-Katalog, Sekundärpositionen, Karriereberichte, bestehende
Multiplayer-Revisionsprüfung, Solo-Reisebelege, OSM-Routencache, Zeitfaktor 60
und bisherige Spielstand-Normalisierung.

## 3. Architekturänderungen

Persistente Kader-Snapshots und Timer-Restzeiten; gespeicherte Zeitpausen,
Wechselfenster und Wechselpakete; gemeinsame Validierung für Solo und Koop;
separate Fussball-Regelhelfer und Vereinsfarben. Bestehende Fahrten behalten
Zeitstempel und Geometrie. Neue Fahrten verwenden korrigierte Ziele und können
geprüfte Strassenkorridore mit ausdrücklich geschätzten Schlussverbindungen
kombinieren. Keine kostenpflichtigen APIs oder neuen Pflichtschlüssel.

## 4. Behobene Fehler

Gegnerische rote Karten verloren zuvor ihre Spieler-ID bei Normalisierung.
Cup-Heimspiele verhinderten Anreisen in jeder Runde. Ausserhalb des Reisekaders
liegende Karten konnten nach Abfahrt eingesetzt werden. Die kurze Toranzeige
hielt die Engine nicht an. Ein verlorener Solo-Startbeleg konnte einen erneuten
Matchstart verhindern. Die neue Belegabfrage ist wiederholbar; Karriereberichte
verwenden eine stabile Partien-ID. Nach Zeitpausen werden bestehende Tore nicht
erneut animiert oder gezählt.

## 5. Ausgeführte Tests und Build

| Prüfung | Ergebnis |
| --- | --- |
| Ausgangsstand `npm test` | 158 TypeScript-Tests + 41 JavaScript-Tests bestanden |
| Abschliessendes `npm test` | Exit 0; 178 TypeScript-Tests + 41 JavaScript-Tests bestanden |
| Abschliessendes `npm run typecheck` | Exit 0; keine TypeScript-Diagnosen |
| Produktionsbuild innerhalb `npm test` | Exit 0; `Build complete` |
| Artefaktprüfung | `Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.` |
| `git diff --check` | Keine Fehler |

Die Suite enthält zusätzlich Kader-/Timer-Wiederherstellung, Cup-Spielorte,
Spezialkarten, gegnerische Platzverweise, Wechselpakete und Fenster, exakte
Pausengrenzen, Abseits, Torwartvergleiche, Ballbewegung und Standortmigration.
Die 900 Balance-Simulationen durchlaufen jetzt die gesamte reguläre Partie
inklusive Zeitpausen. Bestehende Tests wurden angepasst, wo sie ausdrücklich
abgelöste Regeln wie sechs Minuten, Taktikboni oder wechselnde Cup-Heimspiele
voraussetzten. Keine Tests wurden als bestanden angegeben, ohne sie auszuführen.

## 6. Visuelle Prüfung

Der Produktions-Canvas-Renderer erzeugte 480 Animationsbilder. Das Kontaktbild
wurde auf Markierungen, Abstände, Nummern, Kontrast und Schussausgänge geprüft:
[Canvas-Kontaktbild](qa/match-canvas.png).

**Keine vollständige Browserprüfung:** Playwright war vorhanden, Chromium fehlte.
Der Installationsversuch lieferte wiederholt leere/defekte ZIP-Dateien und brach
mit `End of central directory record signature not found` ab. Daher sind weder
Desktop-/Handy-Browserinteraktionen noch die responsive Darstellung der neuen
HTML-Overlays visuell bestätigt. Canvas-Bilder ersetzen diese Prüfung nicht.

## 7. Spielstände und Multiplayer

Normalisierungstests erhalten Sammlung, abgeschlossene Resultate, aktive Fahrten,
Spieler-IDs, Pausen und vorgemerkte Wechsel. Neue optionale Felder haben sichere
Standardwerte. Koop- und Solo-Handler nutzen dieselben Kader-/Wechselregeln.
Reisezeitstempel werden serverseitig geprüft. Vorhandene Revisionsprüfungen
verhindern konkurrierende Koop-Schreibvorgänge. Bestehende Spielstände wurden
nicht zurückgesetzt. Es gab keinen Zugriff auf laufende Produktions-Spielstände.

## 8. Offene Punkte und Grenzen

- Der vollständige Stadion-Audit ist offen: 30 Schweizer und 33 internationale
  Datensätze konnten nach HTTP-509-Antworten nicht frisch anhand eines
  Fussballfeld-Polygons geprüft werden. Einige besitzen bereits dokumentierte
  Stadionanker; Gemeinde-Näherungen bleiben ausdrücklich als solche markiert.
  Alle Ergebnisse und offenen Datensätze stehen in `app/stadium-audit.json`.
- Die umfassende Stufe-3-Realismus-Anforderung ist teilweise umgesetzt. Die
  bestehende Engine bleibt ereignisbasiert. Abseits-Aufnahmen entstehen aus
  formationsbasierten Ereignispositionen; es gibt keine dauerhaft simulierten
  22 Körper mit vollständiger Kollisionsphysik. Vollständig kausale Angriffe,
  alle verlangten zusätzlichen Schussvarianten und Vereinsfarben für jeden
  einzelnen Club benötigen weitere Arbeit und Browserprüfung.
- Fehlende Strassen-/Bahngeometrien bleiben als geschätzte Verbindungen sichtbar;
  es wird keine direkte Linie als verifizierte Infrastruktur ausgegeben.
- Phase 7 ist wegen der offenen Vollständigkeits- und Browserprüfung nicht
  abgenommen. Dieser Branch bleibt ein prüfbarer Zwischenstand.

## 9. Phasen-Commits auf GitHub

| Phase | Commit | Stand |
| --- | --- | --- |
| 1: Audit und Ausgangstests | `6c496a13a9a3bce6827d511581026214d61e1065` | abgeschlossen |
| 2: Cup, Karten, Kader, Timer | `dd0a7776d01e16b2508ea3b6b1cd5e9932b66ee1` | Kernregeln implementiert |
| 3: Wechselpakete und Fenster | `e26dc7c0670a767751f4f39355e0ebbbe09631d3` | implementiert und getestet |
| 4: Uhr, Pausen, Taktiken, Farben | `4b3ff613f5f0cd6febd51b0f79e0cd0fac756e6f` | implementiert; Browserprüfung offen |
| 5: Fussballregeln und Bewegung | `bdd1f8192d9319c6ad648a1dd0f30ee58486f620` | Realismus teilweise umgesetzt |
| 6: Reise und Stadion-Audit | `0b9e39fed9d4dbe5c68b8dbb130e9acb676576b9` | Teilumsetzung; externe Datengrenze |

Die über GitHub gespeicherten Quellbäume wurden mit den getesteten lokalen
Git-Bäumen verglichen. Alle Datei- und Baum-Hashes stimmen überein.

## 10. Veröffentlichung

**Keine Produktionsbereitstellung und kein Merge nach main ausgeführt.**
