<p align="center"><img src="logo-plus.png" width="128" alt="ISGY Intern Plus"></p>

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

### 1. Paket bauen
Du brauchst nur [Node.js](https://nodejs.org) (ab Version 18), sonst nichts.

```bash
node build.mjs
```

Danach liegt im Ordner `dist/` alles, was du brauchst:

| Ordner / Datei | Für |
| --- | --- |
| `dist/chromium/` und `dist/isgy-intern-plus-<version>-chromium.zip` | Chrome, Edge, Brave, Opera, Vivaldi, Arc und alle anderen Chromium-Browser |
| `dist/firefox/` und `dist/isgy-intern-plus-<version>-firefox.zip` | Firefox |

### 2. Im Browser hinzufügen

**Chrome / Brave / Vivaldi / Arc**
1. `chrome://extensions` öffnen (Brave: `brave://extensions`)
2. Oben rechts den **Entwicklermodus** einschalten
3. **„Entpackte Erweiterung laden“** klicken und den Ordner `dist/chromium` auswählen

**Microsoft Edge**
1. `edge://extensions` öffnen
2. Links unten **Entwicklermodus** einschalten
3. **„Entpackte Erweiterung laden“** klicken und `dist/chromium` auswählen

**Opera**
1. `opera://extensions` öffnen und **Entwicklermodus** einschalten
2. **„Entpackte Erweiterung laden“** klicken und `dist/chromium` auswählen

**Firefox (dauerhaft)**

Firefox lädt nur von Mozilla signierte Erweiterungen dauerhaft. Das Signieren ist kostenlos, geht automatisch und die Erweiterung wird dabei **nicht veröffentlicht** (Kanal „unlisted“, nur für dich).

Einmalig:
1. Kostenloses Konto auf [addons.mozilla.org](https://addons.mozilla.org) erstellen und einloggen
2. Unter [API-Schlüssel](https://addons.mozilla.org/developers/addon/api/key/) „Neue Zugangsdaten erzeugen“ klicken. Du bekommst einen **JWT-Aussteller** (`user:…`) und ein **JWT-Geheimnis**. Beides nicht weitergeben und nicht ins Repo schreiben.

Signieren: die Schlüssel in eine Datei `.env` im Projektordner schreiben (Vorlage: `.env.example`, die Datei ist in `.gitignore` und landet nie auf GitHub):
```
WEB_EXT_API_KEY=user:12345:67
WEB_EXT_API_SECRET=dein-geheimnis
```
und ausführen:
```bash
npm run sign:firefox
```
Nach etwa einer Minute liegt die signierte Datei in `dist/signed/` (`….xpi`). Dann in Firefox:
1. `about:addons` öffnen
2. Zahnrad ⚙ → **„Add-on aus Datei installieren …“** → die `.xpi` auswählen

Die Erweiterung bleibt jetzt auch nach dem Schließen von Firefox installiert.

Bei einem Update: `version` in `manifest.json` erhöhen (Mozilla signiert jede Versionsnummer nur einmal), erneut `npm run sign:firefox` ausführen und die neue `.xpi` installieren.

**Firefox (nur zum Ausprobieren)**
1. `about:debugging#/runtime/this-firefox` öffnen
2. **„Temporäres Add-on laden …“** → `dist/firefox/manifest.json` auswählen
3. Verschwindet beim Schließen von Firefox.

**Safari** wird nicht direkt unterstützt. Auf einem Mac lässt sich der Chromium-Ordner mit `xcrun safari-web-extension-converter dist/chromium` in ein Safari-Projekt umwandeln.

### 3. Benutzen
isgy-intern.de öffnen und einloggen. Das Dashboard erscheint jetzt als „Mein Tag“. Beim ersten Besuch wird die Kürzel-Liste einmalig geladen.

### Aktualisieren
Neue Version holen (`git pull`), erneut `node build.mjs` ausführen und die Erweiterung auf der Erweiterungsseite des Browsers neu laden (Pfeil-Symbol).

## Datenschutz

- Die Kürzel- und E-Mail-Liste der Schule ist **nicht** in diesem Repository und darf hier auch nie landen (`*.pdf` steht in `.gitignore`).
- Die Erweiterung lädt die PDF **einmal** mit deiner eigenen Anmeldung direkt von isgy-intern.de, liest sie im Speicher aus und speichert **nur die Zuordnung Kürzel → Name** lokal in deinem Browser (`chrome.storage.local`). Die PDF selbst und die E-Mail-Adressen werden nicht gespeichert.
- Notizen bleiben lokal in deinem Browser. Pins und Einstellungen werden über `chrome.storage.sync` mit deinem Browser-Profil synchronisiert.
- Die Erweiterung sendet nichts an fremde Server. Sie liest nur Daten von isgy-intern.de (Stundenplan, Vertretungsplan, Tagebuch, Klassenkalender) und schreibt dort nichts.

## Aufbau

```
build.mjs            Baut die Pakete für Chromium-Browser und Firefox (dist/)
manifest.json        Erweiterungs-Manifest (MV3)
src/defaults.js      Standard-Einstellungen
src/content.js       Läuft auf isgy-intern.de: Dashboard, Kürzel, Pins, Befehle
src/content.css      Styles
src/background.js    Öffnet die Einstellungsseite
options.html/.js     Einstellungsseite
icons/               Erweiterungs-Icons (ISGY-Logo + „Plus“)
lib/                 pdf.js (Mozilla, Apache-2.0) zum Lesen der Kürzel-PDF
```

Genutzte Schnittstellen der Seite: `rest.php/stundenplan/getStundenplan`, `rest.php/vplan/getList`, `rest.php/tagebuch/getList/<datum>`, `rest.php/klassenkalender/getKalenders|getEvents`.
