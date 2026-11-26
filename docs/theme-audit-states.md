# Light/Dark Audit: späte Spielzustände und Konten (Stand `fc6c3c7` plus Korrekturen)

Notion Ticket «Gesamtes Goal Clicker: Vollständiger Light-/Dark-Mode UI-Audit». Dieser Schritt deckt die Zustände ab, die die acht Haupttab Rauchtests und die früheren Einzelprüfungen nicht messen. Basis ist der exakte grüne Prüfstand #38 (`fc6c3c7`).

## Was auf `fc6c3c7` schon abgedeckt ist

| Beleg | Auf `fc6c3c7` enthalten |
|---|---|
| Pausenleiste «Spiel pausiert» folgt dem Theme (`a819942`) | ja, die Regel steht in `app/styles/match.css` (Zeilen `.gc-interactive-pause`, Tokens statt festem `#f4f7f4`); der Commit selbst ist anders gebündelt, `git cherry` zeigt ihn deshalb als «nicht gleich» |
| Match Steuerknöpfe ohne feste weisse Fläche (`16665e7`) | ja (gleicher Patch, `git cherry` «-») |
| Kopfzeile nach Prestige, Pokalraum Abzeichen (`d426b7f`) | ja (gleicher Patch, `git cherry` «-») |
| Kombinierte Match UI (#21, `43749aa`) | ja, Vorfahre |

## Messverfahren

`tests/browser/theme-audit-all-states.test.ts` (lokale Spielstände) und `tests/browser/theme-audit-account-states.test.ts` (Konten, mit dem Neon Auth Ersatz und leerer Testdatenbank) messen jeden Zustand in **beiden Themes** auf einem **390 px Touch Handy** und einem **1280 px Desktop** mit `tests/browser/theme-measure.ts`:

* Textkontrast gegen den zusammengesetzten Hintergrund (WCAG 4,5 zu 1, grosser Text 3 zu 1);
* grosse deckende Flächen mit dem falschen Helligkeitsmuster (helle Fläche im Dark Mode, dunkle im Light Mode);
* horizontaler Überlauf der Seite.

Von Hand nach `npm run build` gestartet (nicht Teil von `npm run test:browser`). Mit `THEME_AUDIT_REPORT=1` druckt der Lauf alle Funde. **Grenzen:** Text auf Farbverläufen oder Bildern lässt sich so nicht messen (Zähler «not measured» im Bericht); gesperrte Bedienelemente sind nach WCAG 1.4.3 ausgenommen; Emojis zählen nicht als Text.

## Ergebnis pro Zustand

Vor der Korrektur: 16 von 20 Fällen der lokalen Zustände rot. Nach der Korrektur: alle grün.

| Zustand | Handy hell | Handy dunkel | Desktop hell | Desktop dunkel | Anmerkung |
|---|---|---|---|---|---|
| Pausenleiste (Live Match) | bestanden | bestanden | bestanden | bestanden | hell: dunkle Stadionbühne, siehe «Gestaltungsentscheid» |
| Prestige Dialog | bestanden | bestanden | bestanden | bestanden | vorher hell: Prestige Chip 4,40 zu 1 |
| Elfmeterschiessen | bestanden | bestanden | bestanden | bestanden | dunkle Vollbild Übernahme, Text auf Verlauf nicht messbar (19 Elemente) |
| Trophäe (Titelfeier) | bestanden | bestanden | bestanden | bestanden | vorher: Glockenzähler 3,55 zu 1, «Weiter zum Kader» 4,40 zu 1 |
| Zufallsereignis | bestanden | bestanden | bestanden | bestanden | hell: dunkles Meldungsband, siehe «Gestaltungsentscheid» |
| Gast: Startbildschirm | bestanden | bestanden | bestanden | bestanden | |
| Gast: im Spiel | bestanden | bestanden | bestanden | bestanden | Preisfeld gesperrter Kaufknöpfe ist ausgenommen |
| Gast: Koop Sperre («Koop braucht ein Konto») | bestanden | bestanden | bestanden | bestanden | |
| Gast: Anmelden mit Gast Spielstand | bestanden | bestanden | bestanden | bestanden | |
| Koop Welt mit zwei Sitzen, Host und Mitspieler | bestanden | bestanden | bestanden | bestanden | beide Sitze aus zwei Konten, Welt über den Raumcode betreten |

Gefundene und behobene Mängel (alle messbar, alle in dauerhaft sichtbaren Elementen, in den Zuständen nur sichtbar):

| Element | Vorher | Nachher |
|---|---|---|
| «TORE» in der Kopfzeile (hell) | 4,40 zu 1 | über 4,5 |
| Aktiver Tab Name, z. B. «Spiele» / «Home» (hell) | 4,20 zu 1 | über 4,5 |
| Prestige Chip «Prestige 2 · +20 % Tore» (hell) | 4,40 zu 1 | über 4,5 |
| Sekundäre Knöpfe «Weiter zum Kader», «Ansicht bearbeiten» (hell) | 4,40 und 4,06 zu 1 | über 4,5 |
| «LIVE» Marke im Tab (beide Themes) | 3,55 zu 1 | 5,4 zu 1 |
| Zahl am Glocken Symbol (beide Themes) | 3,55 zu 1 | 5,4 zu 1 |

Ursache und Korrektur (nur CSS, kein Spielstand, keine Mechanik):

* Der Akzent `#0a7d43` erreicht auf den getönten Pillen der Kopfzeile und der Tableiste nur 4,2 bis 4,4 zu 1. Neues Token `--accent-ink` (hell `#086a38`, dunkel wie der Akzent `#3ddc84`) für Akzent Text auf diesen Tönungen: `.header-goals small`, `.section-navigation button.active`, `.header-prestige`, `.mode-secondary` (Ruhe und Hover). Flächen und Rahmen behalten den Akzent.
* Weisser Text auf dem iOS Rot `#ff3b30` (3,55 zu 1) bei `.tab-live-badge` und `.bell-count`: Hintergrund `#d70015`.

## Gestaltungsentscheid für Nicolas (nicht als Fehler behandelt)

Zwei dunkle Flächen im Light Mode sind lesbar (heller Text, Kontrast hoch), aber bewusst gestaltet und deshalb nicht geändert. Sie stehen im Test als «bewusst» (`DELIBERATE`):

1. **Live Match Ansicht** (`section.gc-match-viewer`, Spielfeld, Canvas): eine dunkle Stadionbühne in beiden Themes; im Dark Mode folgen die Leisten dem Theme. Pausenleiste und Steuerknöpfe sind schon theme-gerecht.
2. **Meldungsband von Zufallsereignissen** (`div.gc-notification`): ein dunkles Banner im iOS Stil mit weisser Schrift.
3. **Elfmeterschiessen** (Vollbild Übernahme) und **Titelfeier**: dunkle Inszenierung mit Verlauf, in beiden Themes gleich.

Wenn diese im Light Mode hell werden sollen, ist das ein Designauftrag, kein Fehler dieses Audits.

## Echte Geräte: Anleitung für die Abnahme von Hand (weiterhin blockiert)

WebKit/Safari startet in dieser Umgebung nicht und es gibt keine physischen Geräte. Zu prüfen, auf einem iPhone (Safari) und einem iPad (Safari, hoch und quer), jeweils zuerst in **Einstellungen → Anzeige & Helligkeit** auf «Hell» und danach auf «Dunkel», sowie mit der Spieleinstellung «Hell», «Dunkel», «Automatisch»:

1. **Kopfzeile und Tableiste:** Seite öffnen, einige Sekunden scrollen. Die Beschriftungen «TORE», der aktive Tab und der Prestige Chip müssen im Hell Modus klar lesbar sein (kein blasses Grün auf Mintgrün); die Kopfzeile bleibt beim Scrollen lesbar, Blur und Notch Bereich ohne Farbsprung.
2. **«LIVE» und Glocke:** Ein Spiel starten (Tab «Spiele») und prüfen: die rote «LIVE» Marke und die Zahl am Glocken Symbol sind weiss auf kräftigem Rot gut lesbar.
3. **Pausenleiste:** Im laufenden Spiel pausieren. Im Dark Mode ist die Leiste dunkel mit grünem Knopf, im Hell Modus hell auf der dunklen Bühne. Mit dem Systemschalter während der Pause wechseln: sie folgt sofort.
4. **Prestige:** Mit einem Spielstand in der Hall of Fame «Prestige starten» antippen; Dialogtexte und Knöpfe in beiden Themes lesen.
5. **Elfmeterschiessen und Titelfeier:** Auf einem Testspielstand ein Elfmeterschiessen und die Titelfeier erreichen; Text, Punkte und Knöpfe lesbar, nichts abgeschnitten (iPhone Notch und Home Balken).
6. **Zufallsereignis:** Ein Ereignisband abwarten; weisse Schrift auf dunklem Band, nicht von der Statusleiste verdeckt.
7. **Gast und Konto:** Ohne Anmeldung «Als Gast fortfahren», dann «Koop Multiplayer» antippen (Hinweis «Koop braucht ein Konto»), «Anmelden» (Hinweis auf den Gast Spielstand) in beiden Themes.
8. **Koop:** Mit zwei Konten auf zwei Geräten eine Welt erstellen und mit dem Raumcode beitreten; beide Sitze sichtbar, «1 Mitspieler online» lesbar.
9. **Wechsel im Betrieb:** Das Systemdesign wechseln, während ein Dialog offen ist; der Dialog bleibt lesbar, kein weisses Rechteck bleibt im Dunkeln und umgekehrt.

Zu jedem Punkt Foto oder Bildschirmaufnahme und Gerät, iOS Version und Einstellung notieren.

## Befehle

```bash
npm run build
node --import tsx --test --test-concurrency=1 tests/browser/theme-audit-all-states.test.ts
TEST_DATABASE_URL=postgres://... node --import tsx --test --test-concurrency=1 tests/browser/theme-audit-account-states.test.ts
```
