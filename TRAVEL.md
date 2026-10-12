# Auswärtsreisen

Heimstadion und Abfahrt: Bümplizstrasse 45, 3027 Bern (46.94689, 7.39373).
Die Adresse ist über die Kontaktseite der Geoinformation Stadt Bern verifiziert;
Koordinaten sind der Gebäudeanker der Adresse, auf fünf Dezimalstellen gerundet.

Die 15 bestehenden Divisionen bleiben erhalten. Regionen: 1–2 Stadt Bern,
3–4 Kanton Bern, 5 Deutschschweiz, 6 Schweiz, 7 Nachbarländer, 8 Mitteleuropa,
9–10 Europa, 11–12 europäische Elite, 13–14 international, 15 Weltelite.
Bestehende Tabellenpunkte, historische Gegnernamen und laufende Matches bleiben
bestehen. Neue Saisonstarttabellen verwenden die geografischen Gegnerpools.
Saisonspiele wechseln bei jedem Spieltag zwischen Heim und Auswärts.
Spieltage 1, 3, 5, 7 und 9 sind Heimspiele; 2, 4, 6, 8 und 10 sind auswärts.
Turnierrunden wechseln Auswärts/Heim ab, beginnend auswärts. Die bestehenden
Turnierregeln, Stärken, Auslosungspools und Pausen bleiben erhalten.

Jeder Trip hat eine gespeicherte Fixture-ID, Server-Startzeit, Ankunftszeit,
Transportart, Gegnerplanung und höchstens zwei einmal ausgewählte Ereignisse.
Ankunft startet kein Match. Ein weiterer Klick führt zum bestehenden Simulator.
Die Matchberechtigung wird bei Abfahrt und erneut beim Anpfiff geprüft.

Zeitbereiche pro Region: 10–20, 20–35, 35–50, 45–60, 60–90, 75–110,
90–130, 110–150, 130–170, 150–180 Sekunden. Innerhalb des Bereichs skaliert
die Luftliniendistanz; Zug und Flug bekommen einen kleinen Transportaufschlag.
Bus unter 80 km, Zug unter 700 km, sonst Flugzeug. Einschliesslich Ereignissen
bleibt jede Reise zwischen 10 und 180 Sekunden. Ereignisse wirken zu etwa 50 %
der Reisen, in etwa 15 % dieser Fälle sind es zwei. Zeitänderungen werden am
Ereigniszeitpunkt sichtbar, der Fahrzeugfortschritt bleibt dabei kontinuierlich.
Es gibt keine Änderung von Form, Ratings, Verletzungen oder Matchleistung.

Gemeinsame Welten speichern Reise und Reisestatistik in shared_features_json
mit dem vorhandenen optimistischen Versionsvergleich. Alte Clients werden mit
Multiplayer-Protokoll 4 zum Reload aufgefordert. Einzelspieler verwendet die
neue D1-Tabelle solo_travel als serverseitiges Reisezeit-Ledger mit eindeutigem
Schlüssel (owner, fixture_id). Mehrere Abfahrtsklicks erzeugen denselben Beleg.
Die bestehende Einzelspieler-Sicherung bleibt lokal; geräteübergreifende
Spielstände werden weiterhin über gemeinsame Welten unterstützt. Die bestehende
Player-ID-Capability bleibt das Zugriffsmodell. Das lokale Einzelspiel wird
hierdurch nicht insgesamt zu einer serverautoritativen Simulation.

Die React/SVG-Karte benötigt keine neue Bibliothek oder bezahlte API. Sie lädt
sichtbare OpenStreetMap-Kacheln mit Attribution und dem Browsercache, bietet
Verschieben, Zoom, Routenansicht und Fahrzeugverfolgung. Linien am Boden sind
klar als schematische Verbindungen beschriftet; Flugwege folgen Grosskreisen.
Ausfallende Kartenkacheln lassen Route, Timer und Matchstart funktionstüchtig.
Stadionanker stehen zentral in travel-geography.ts; fiktive Clubs teilen reale
Stadien. Distanzen und Statistiken sind ausdrücklich Luftlinienkilometer.

Validierung: npm test (126 Tests, einschliesslich 20 Reisetests), TypeScript,
Produktionsbuild, Artefaktprüfung und ESLint ohne Fehler. Zwei bestehende
Warnungen im generierten worker-runtime.d.ts bleiben bestehen. Browser-QA
für echte Kachelladung, Pointer-Gesten und Desktop/Mobile war in dieser
Arbeitsumgebung mangels Browser-Steuerung nicht verfügbar.
