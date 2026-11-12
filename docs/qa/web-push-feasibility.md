# iPhone Mitteilungen ohne Zusatzkosten: Machbarkeit

Stand 12. November 2026, Ticket «iPhone Spielstatus ohne Zusatzkosten: Web Push». Nur Analyse am Code, nichts implementiert, nichts aktiviert. Kostenrahmen laut Ticket: CHF 0 zusätzlich.

## Was es schon gibt

* **Lokale Mitteilungen** (`app/qol/notifications.ts`): Solange Goal Clicker offen ist (Hintergrundtab oder installierte App im Hintergrund), zeigt die Seite selbst eine Mitteilung für Reise angekommen, Tagesbelohnung, Turnierpause vorbei, Angebot und Pressekonferenz. Pro Gerät freiwillig, es wird nichts versendet. Dazu das Zahlenzeichen am App Symbol.
* Der Service Worker (`public/sw.js`) hat **keinen** `push` Handler, es gibt keine Push Abonnements, keine VAPID Schlüssel und keinen Sender.

## Frage 1: Erkennt der Server die Ereignisse, wenn die App zu ist?

| Ereignis | Server weiss es? | Begründung |
|---|---|---|
| Live Spielstand eines Matches | **Nein** | Die Matchsimulation läuft im Browser (`advanceCupMatch` im Client). Solospiele liegen im Browser, nicht auf dem Server. Ein Live Stand ausserhalb der App wäre erfunden. |
| Spiel beendet | Nein | Gleicher Grund; der Server kennt nur das Ergebnis nach dem nächsten Speichern. |
| Sparziel erreicht | **Nein** | Das Sparziel liegt als Einstellung auf dem Gerät (`goal-clicker-savings-goal`). Der Kontostand wächst im Browser. Eine Prognose ist keine Zielerreichung. |
| Reise angekommen | Ja, teilweise | `/api/travel` führt ein serverseitiges Journal mit Ankunftszeit. |
| Koop Ereignisse | Teilweise | Die Koop Welt liegt auf dem Server, sie hat aber auch keinen Zeitgeber. |

## Frage 2: Was wäre nötig, und was kostet es?

Echtes Web Push (iOS ab 16.4, nur für zum Home Bildschirm hinzugefügte Web Apps, ohne Apple Developer Mitgliedschaft) braucht:

1. VAPID Schlüsselpaar und eine Abonnement Tabelle (Datenbank, Einwilligung pro Gerät).
2. Einen Sender, der **zum Zeitpunkt des Ereignisses** läuft: ein Zeitgeber (Cron) oder Hintergrundjob, der Ankunftszeiten prüft und pro Nachricht eine Anfrage an den Push Dienst von Apple schickt.
3. Für Sparziel und Match: Der Server müsste Kontostand und Produktion zuverlässig kennen, also Spielstände dauernd synchron halten. Das würde Neon Zugriffe und Egress deutlich erhöhen (siehe die offenen Neon Tickets).

Punkt 2 und 3 sind die Kostenfrage: Ein Zeitgeber ist bei Gratisplänen meist stark begrenzt oder nicht vorhanden, und dauerndes Synchronisieren belastet das Gratisbudget der Datenbank. Ob das im vorhandenen Plan ohne Gebühren geht, lässt sich **nur mit Zugriff auf Hosting und Datenbank prüfen**, nicht aus dem Code.

## Ergebnis

* **Nicht umsetzen ohne Rücksprache.** Für Sparziel und Matchstand gibt es keine korrekte Datengrundlage auf dem Server; ohne neue Infrastruktur wäre eine Mitteilung erfunden oder verspätet. Das widerspricht der Kostenbedingung und der Vorgabe «keine erfundenen Ereignisse».
* **Am ehesten machbar** wäre allein «Reise angekommen» per Push, weil der Server die Ankunftszeit kennt. Dafür braucht es trotzdem einen Zeitgeber und eine Abonnement Tabelle; der Nutzen ist klein.
* **Kostenlos und sofort verfügbar** ist die Variante innerhalb der offenen App (Fortschrittsanzeige, Matchscore) und die bestehenden lokalen Mitteilungen im Hintergrund. Ein Dynamic Island Widget geht nicht ohne native App und ist ausgeschlossen.

## Vergleich unter der Bedingung CHF 0 (bestätigt von Nicolas, absolut)

Verbindlich: keine bezahlten Dienste, keine Upgrades, keine neue Infrastruktur, keine Live Änderung.

| | Lokale Mitteilungen (vorhanden) | Nur «Reise angekommen» per Push |
|---|---|---|
| Zusätzliche Kosten | CHF 0, nichts wird versendet | **nicht belegbar** |
| Neue Infrastruktur | keine | Zeitgeber oder Hintergrundjob, Abonnement Tabelle (Datenbank), VAPID Schlüssel, Versand an den Apple Push Dienst |
| Funktioniert bei geschlossener App | **Nein**, die Seite muss laufen. iOS hält Web Apps im Hintergrund nach kurzer Zeit an; die Mitteilung kommt zuverlässig nur, solange die App offen oder gerade erst verlassen ist. | Ja, das wäre der Gewinn |
| Datengrundlage | lokal, korrekt | Ankunftszeit aus dem Reisejournal, korrekt |
| Aus dem Code belegt | ja (`app/qol/notifications.ts`) | nur die Datengrundlage, nicht die Kosten |

**Fehlende Belege für den Push, die nur mit Zugriff auf Hosting und Datenbank zu klären sind:**

1. Bietet ChatGPT Sites (die Produktionsplattform laut README) geplante Aufgaben oder Hintergrundjobs im jetzigen Plan, und gehören sie zu den Gratis Leistungen? Im Repo gibt es dafür keine Konfiguration (weder Cron noch Scheduler), und die Plattform Grenzen sind aus dem Code nicht lesbar.
2. Darf ein Serverteil ausgehende Verbindungen zum Apple Push Dienst aufbauen und Schlüssel speichern?
3. Wie viel Spielraum hat das Neon Gratisbudget (Rechenzeit, Egress) für die zusätzliche Tabelle und die Prüfläufe? Das ist Teil der offenen Neon Tickets.

**Empfehlung:** Keine Implementierung. Der Nachweis, dass der Push innerhalb der vorhandenen Gratis Leistungen liegt, fehlt, also bleibt das Ticket eine Idee. Die lokalen Mitteilungen bleiben, wie sie sind. Ein Auslöser ohne Server, etwa der Notification Trigger der Browser, ist auf dem iPhone nicht verfügbar und kommt nicht in Frage.

## Entscheidung für Nicolas

1. Reicht dir der Stand mit lokalen Mitteilungen (offene oder installierte App im Hintergrund)? Dann bleibt alles wie es ist.
2. Sollen die drei fehlenden Belege oben bei Gelegenheit mit deinem Zugang geklärt werden? Erst wenn alle drei mit «ja, ohne Kosten» beantwortet sind, wäre ein Push nur für «Reise angekommen» eine Umsetzung wert.
