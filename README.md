<p align="center"><img src="logo-plus.png" width="128" alt="ISGY Intern Plus"></p>

# ISGY Intern Plus

Browser-Erweiterung (Chrome / Edge / Brave, Manifest V3) für [isgy-intern.de](https://www.isgy-intern.de), die das Portal aufräumt und praktischer macht.

## Funktionen

- **„Mein Tag“-Dashboard**: zeigt statt der vielen Widgets nur den Stundenplan von **heute und dem nächsten Schultag**, inklusive
  - **Vertretungen deiner Klasse** direkt an der jeweiligen Stunde (Vertreter, Raum, Fach, Info)
  - **letzter Tagebucheintrag** pro Fach (Thema + Hausaufgabe) per Klick auf die Stunde; ein **HA**-Badge zeigt, ob zuletzt Hausaufgaben eingetragen wurden
  - **Termine aus dem Klassenkalender** (Schulaufgaben, Kurzarbeiten …) der nächsten Tage
  - **Aufgaben & Notizen**: To-dos mit Häkchen (optional mit Datum, sie erscheinen dann beim passenden Tag) und freie Notizen. Mit einem [KI-Konto](#ki-assistenten--ki-konto) werden sie mit deinem KI-Assistenten und anderen Geräten synchronisiert
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
  - In der Befehlspalette außerdem: „🔄 Mit KI-Konto synchronisieren“ und „🤖 KI-Verbindungscode kopieren“
- **KI-Assistenten** (Claude, ChatGPT, Gemini): Dein KI-Assistent kann Stundenplan, Vertretungen, Hausaufgaben, Prüfungen und deine Aufgaben & Notizen lesen – siehe [KI-Assistenten & KI-Konto](#ki-assistenten--ki-konto).
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
isgy-intern.de öffnen und einloggen. Das Dashboard erscheint jetzt als „Mein Tag“. Beim ersten Besuch wird die Kürzel-Liste einmalig geladen. Optional: [KI-Konto einrichten](#ki-assistenten--ki-konto).

### Aktualisieren
Neue Version holen (`git pull`), erneut `node build.mjs` ausführen und die Erweiterung auf der Erweiterungsseite des Browsers neu laden (Pfeil-Symbol).

## KI-Assistenten & KI-Konto

Der [MCP-Server](mcp/README.md) (`https://isgy-intern-plus.vercel.app/mcp`) verbindet Claude, ChatGPT und Gemini CLI mit isgy-intern.de. Fragen wie „Was habe ich morgen?“, „Fällt was aus?“, „Mach mir einen Lernplan für die Mathe-Schulaufgabe“ oder „Schreib mir auf: Bio-Referat bis Freitag“ beantwortet der Assistent dann mit deinen echten Daten. Von isgy-intern.de wird nur gelesen; schreiben kann der Assistent nur deine eigenen Aufgaben & Notizen.

### Einrichten (empfohlen: mit Konto)

1. **Konto erstellen** auf <https://isgy-intern-plus.vercel.app/konto> (Tab „Registrieren“).
2. **Erweiterung verbinden**: Einstellungen der Erweiterung (⚙ im Dashboard) → **KI-Konto** → mit E-Mail und Konto-Passwort anmelden. Danach isgy-intern.de öffnen: Aufgaben & Notizen werden synchronisiert, und bei Office-365-Login hinterlegt die Erweiterung deine Sitzung automatisch im Konto.
   *Alternative für Konten mit Portal-Passwort (z. B. Eltern):* auf der Kontoseite unter „Zugang hinterlegen“ Benutzername und Passwort von isgy-intern eintragen.
3. **KI-Assistenten verbinden**: die Server-URL in Claude (Einstellungen → Connectors), ChatGPT (Apps & Connectors, Entwicklermodus) oder Gemini CLI eintragen und bei der Anmeldung den Tab **„Konto“** wählen. Die Schritte für jeden Assistenten stehen auf der Startseite des Servers.

### Welche Zugangsdaten wohin?

| Wo | Was eintragen |
| --- | --- |
| Konto erstellen · Erweiterung („KI-Konto“) · Anmeldung beim KI-Assistenten, Tab „Konto“ | **E-Mail** und ein **neues Konto-Passwort** (mind. 8 Zeichen, *nicht* dein isgy-intern-Passwort) |
| Kontoseite „Zugang hinterlegen“ · Tab „Passwort“ beim Anmelden ohne Konto | der **Benutzername**, mit dem du dich auf isgy-intern.de anmeldest, und dein **Portal-Passwort** |
| Anmeldung über **Office 365** (Schüler) | nichts davon – die Erweiterung übergibt die Sitzung (mit Konto) oder du fügst einen **Verbindungscode** ein (ohne Konto: `Strg+K` → „🤖 KI-Verbindungscode kopieren“) |

Ein Passwort-Zurücksetzen gibt es nicht; wer es vergisst, erstellt ein neues Konto. Auf der Kontoseite kannst du den gespeicherten Zugang entfernen, **überall abmelden** (alle KI-Assistenten und die Erweiterung) und das Konto samt Notizen löschen.

## Datenschutz

- Die Kürzel- und E-Mail-Liste der Schule ist **nicht** in diesem Repository und darf hier auch nie landen (`*.pdf` steht in `.gitignore`).
- Die Erweiterung lädt die PDF **einmal** mit deiner eigenen Anmeldung direkt von isgy-intern.de, liest sie im Speicher aus und speichert **nur die Zuordnung Kürzel → Name** lokal in deinem Browser (`chrome.storage.local`). Die PDF selbst und die E-Mail-Adressen werden nicht gespeichert.
- Aufgaben & Notizen liegen in `chrome.storage.local` und bleiben ohne KI-Konto nur in deinem Browser. Pins und Einstellungen werden über `chrome.storage.sync` mit deinem Browser-Profil synchronisiert.
- **Ohne KI-Konto** sendet die Erweiterung nichts an fremde Server. Sie liest nur Daten von isgy-intern.de (Stundenplan, Vertretungsplan, Tagebuch, Klassenkalender) und schreibt dort nichts. Der KI-Verbindungscode wird nur in deine Zwischenablage kopiert.
- **Nur wenn du dich in den Einstellungen mit einem KI-Konto anmeldest**, schickt die Erweiterung deine Aufgaben & Notizen und (bei Office-365-Login) die isgy-intern-Sitzung an den MCP-Server. Abmelden unter „KI-Konto“ beendet das sofort.
- Im Konto (Supabase, Frankfurt) liegen: E-Mail, der Hash deines Konto-Passworts, dein isgy-intern-Zugang **verschlüsselt** (AES-256, nur der Server kann ihn entschlüsseln) und deine Aufgaben & Notizen. Details: [mcp/README.md](mcp/README.md#datenschutz--sicherheit).
- Die Berechtigung „Cookies“ braucht die Erweiterung nur für Verbindungscode und KI-Konto (die Sitzungs-Cookies von isgy-intern.de).

## Aufbau

```
build.mjs            Baut die Pakete für Chromium-Browser und Firefox (dist/)
manifest.json        Erweiterungs-Manifest (MV3)
src/defaults.js      Standard-Einstellungen
src/content.js       Läuft auf isgy-intern.de: Dashboard, Kürzel, Pins, Befehle
src/content.css      Styles
src/background.js    Einstellungsseite öffnen, Portal-Cookies lesen, KI-Konto-Anmeldung und -Sync
options.html/.js     Einstellungsseite (inkl. KI-Konto)
icons/               Erweiterungs-Icons (ISGY-Logo + „Plus“)
lib/                 pdf.js (Mozilla, Apache-2.0) zum Lesen der Kürzel-PDF
mcp/                 MCP-Server für KI-Assistenten (Vercel), siehe mcp/README.md
```

Genutzte Schnittstellen der Seite: `rest.php/stundenplan/getStundenplan`, `rest.php/vplan/getList`, `rest.php/tagebuch/getList/<datum>`, `rest.php/klassenkalender/getKalenders|getEvents`.
