# ISGY Intern Plus

Browser-Erweiterung (Chrome / Edge / Brave, Manifest V3) für [isgy-intern.de](https://www.isgy-intern.de), die das Portal aufräumt und praktischer macht.

## Funktionen

- **„Mein Tag“-Dashboard**: zeigt statt der vielen Widgets nur den Stundenplan von **heute und dem nächsten Schultag**, inklusive
  - **Vertretungen deiner Klasse** direkt an der jeweiligen Stunde (Vertreter, Raum, Fach, Info)
  - **letzter Tagebucheintrag** pro Fach (Thema + Hausaufgabe) per Klick auf die Stunde; ein **HA**-Badge zeigt, ob zuletzt Hausaufgaben eingetragen wurden
  - **Termine aus dem Klassenkalender** (Schulaufgaben, Kurzarbeiten …) der nächsten Tage
  - **Notizen** (optional mit Datum, sie erscheinen dann beim passenden Tag)
  - Doppelstunden werden zusammengefasst; Fächer, die du nicht hast (z. B. Ev/Eth), kannst du ausblenden
  - Mit „Original-Dashboard anzeigen“ kommt das alte Dashboard jederzeit zurück
- **Kürzel → Namen**: Lehrerkürzel werden im Stundenplan und im Dashboard durch Namen ersetzt, z. B. „Max Mustermann (Mm)“
- **Letzter Tagebucheintrag im normalen Stundenplan**: Klick auf eine Stunde öffnet den letzten Eintrag des Fachs
- **Anpinnen in der Seitenleiste**: mit der Maus über einen Menüpunkt fahren und auf 📌 klicken. Angepinnte Seiten stehen dann ganz oben.
- **Tastatur & Befehle**
  - `Strg+K` oder `/`: Befehlspalette (alle Seiten + Aktionen durchsuchen)
  - `g` dann `d` / `s` / `v` / `t` / `k` / `w` / `n` / `m` / `f`: Dashboard, Stundenplan, Vertretungsplan, Tagebuch, Klassenkalender, Wochenplan, News, Nachrichten, Dokumente
  - `Alt+1` … `Alt+9`: angepinnte Seiten
  - `?`: Übersicht aller Tastenkürzel
- **Einstellungen** (⚙ im Dashboard oder Rechtsklick auf das Erweiterungs-Icon → Optionen): Kürzel-Anzeige, ausgeblendete Fächer, Vorschau-Tage, Tastenkürzel (frei belegbar), Akzentfarbe und mehr

## Installation

1. Repo herunterladen (`Code → Download ZIP`) und entpacken, oder `git clone` ausführen
2. `chrome://extensions` öffnen (in Edge: `edge://extensions`)
3. Oben rechts den **Entwicklermodus** aktivieren
4. **„Entpackte Erweiterung laden“** klicken und den Ordner mit der `manifest.json` auswählen
5. isgy-intern.de öffnen und einloggen

## Datenschutz

- Die Kürzel- und E-Mail-Liste der Schule ist **nicht** in diesem Repository und darf hier auch nie landen (`*.pdf` steht in `.gitignore`).
- Die Erweiterung lädt die PDF **einmal** mit deiner eigenen Anmeldung direkt von isgy-intern.de, liest sie im Speicher aus und speichert **nur die Zuordnung Kürzel → Name** lokal in deinem Browser (`chrome.storage.local`). Die PDF selbst und die E-Mail-Adressen werden nicht gespeichert.
- Notizen bleiben lokal in deinem Browser. Pins und Einstellungen werden über `chrome.storage.sync` mit deinem Browser-Profil synchronisiert.
- Die Erweiterung sendet nichts an fremde Server. Sie liest nur Daten von isgy-intern.de (Stundenplan, Vertretungsplan, Tagebuch, Klassenkalender) und schreibt dort nichts.

## Aufbau

```
manifest.json        Erweiterungs-Manifest (MV3)
src/defaults.js      Standard-Einstellungen
src/content.js       Läuft auf isgy-intern.de: Dashboard, Kürzel, Pins, Befehle
src/content.css      Styles
src/background.js    Öffnet die Einstellungsseite
options.html/.js     Einstellungsseite
lib/                 pdf.js (Mozilla, Apache-2.0) zum Lesen der Kürzel-PDF
```

Genutzte Schnittstellen der Seite: `rest.php/stundenplan/getStundenplan`, `rest.php/vplan/getList`, `rest.php/tagebuch/getList/<datum>`, `rest.php/klassenkalender/getKalenders|getEvents`.
