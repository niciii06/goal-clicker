# Gameplay, travel and stadium update

Datum: 19. Oktober 2026 · Branch `claude/relaxed-faraday-p37h5g`

| Nr. | Thema | Umsetzung | Wichtigste Dateien |
|---:|---|---|---|
| 1 | Reisekarte Folgen und Zoom | Kamera als reiner Zustand (Zoom, Zentrum, Folgen getrennt). Zoom per Knopf, Mausrad und Pinch beendet Folgen nie, Folgen behält den Zoom, nur Verschieben beendet Folgen. Fahrzeug und Kamera bewegen sich pro Bildschirmbild ohne React Render. | `app/travel-map.tsx`, `app/travel-map-geometry.ts` |
| 2 | Taktiken entfernt | Auswahl im Wechseleditor, Taktikwerte in der Engine und im Entwurf entfernt. Alte Spielstände mit `strategyId` laden weiter, der Wert wird ignoriert. | `app/interactive-match-panel.tsx`, `app/match-commands.ts`, `app/interactive-match.ts` |
| 3 | Spielintelligenz | Neues Modul mit Teamform je Rolle und Spielphase, Anspielstationen, Tiefenläufen, Pressing und Deckung. Ballführende bewerten Schuss, Pässe und Dribblings; bessere Spieler entscheiden und treffen besser. Jede Aktion ist physikalisch durchgehend (Ball endet, wo die Aktion ihn hinspielt). | `app/match-ai.ts`, `app/interactive-match.ts` |
| 4 | Stadien nach Clubgrösse | Sechs Kategorien vom Amateurplatz bis zum Elitestadion, bekannte Kapazitäten (gerundet) oder als geschätzt markierte Werte; Heimstadion wächst mit der Liga; San Siro mit Türmen und roten Trägern. | `app/stadium-profiles.ts`, `app/stadium-ambience.ts`, `app/match-stadium.ts` |
| 5 | Spezialkarten-Pack | Eigener Pack im Packshop, 25'000 Fragmente, gleicher Kartenpool, Kaufbelege gegen Doppelkäufe; die frühere Fragmentsektion ist entfernt. | `app/feature-data.ts`, `app/page.tsx`, `app/api/multiplayer/route.ts` |
| 6 | Pfuschi | 67 OVR, sonst unverändert. | `app/feature-data.ts` |
| 7 | Liga statt Saison | Freischaltungen über die beste erreichte Liga (Liga 15 Einstieg, Liga 1 Spitze), zentral in einem Modul, Anzeige und Prüfung identisch (Client und Server). | `app/season-progression.ts` |
| 8 | Halbzeit | Deckende Halbzeitkarte über dem ganzen Stadion, darunter stehen bereits die Anstosspositionen; Ausblenden nach dem Wiederanpfiff. | `app/interactive-match-panel.tsx`, `app/interactive-frame-data.ts` |
| 9 | Namenszusatz | Zehn Importnamen mit künstlichem «1» bereinigt, IDs bleiben eindeutig. | `app/fc26-player-pool.ts` |
| 10 | Spielerstatistik | Spiele, Tore, Assists (Karriere oder laufende Saison) neben den Meilensteinen. | `app/career-panels.tsx` |
| 11 | Gelbsperren | 3 Gelbe pro Ligasaison, 2 pro Turnierlauf, getrennt geführt, einmalige Verarbeitung pro Spiel. | `app/discipline.ts`, `app/career-data.ts` |
| 12 | Flugrouten | Grosskreis mit Wegpunkten höchstens etwa alle 40 km, Start und Landung mit Beschleunigung, Flughöhe als Symbolgrösse. | `app/travel-geography.ts`, `app/travel-map-geometry.ts` |
| 13 | Clubpass | Reisepass als «Clubpass» im Clubbereich. | `app/travel-panel.tsx`, `app/page.tsx` |

## Hinweise

- Keine Datenbankmigration nötig: neue Felder (`purchaseReceipts`, `discipline`) werden beim Laden mit Standardwerten ergänzt. Frühere Gelbe Karten werden nicht nachträglich erfunden.
- Reisezeiten bleiben wie bisher (Echtzeit geteilt durch 60). Eine weltweite Obergrenze von drei Minuten gibt es im Spiel nicht und wurde nicht eingeführt.
- Spielstärken: 100 Simulationen ergeben im Mittel gut zwei Tore pro Spiel; stärkere Teams gewinnen klar häufiger, Aussenseitersiege bleiben möglich.
