# ISGY Intern MCP-Server

Ein [MCP](https://modelcontextprotocol.io)-Server, mit dem **Claude, ChatGPT, Gemini CLI** und andere KI-Assistenten deine Daten aus isgy-intern.de lesen können: Stundenplan, Vertretungsplan, Klassentagebuch (Themen & Hausaufgaben), Termine aus dem Klassenkalender und die Lehrerkürzel. Nur Lesezugriff.

**Server-URL:** `https://isgy-intern-mcp.vercel.app/mcp`
Auf der Startseite <https://isgy-intern-mcp.vercel.app> stehen die Anleitungen für jeden Client noch einmal mit Kopier-Knopf.

## Hinzufügen

**Claude** (claude.ai, Desktop-App, Handy): Einstellungen → Connectors → *Benutzerdefinierten Connector hinzufügen* → Name `ISGY Intern`, URL `https://isgy-intern-mcp.vercel.app/mcp` → *Verbinden* → im Fenster anmelden.
Claude Code: `claude mcp add --transport http isgy-intern https://isgy-intern-mcp.vercel.app/mcp`, dann `/mcp` → Anmelden.

**ChatGPT** (Plus/Pro/Business): Einstellungen → Apps & Connectors → Erweitert → *Entwicklermodus* an. Dann *Erstellen*: Name `ISGY Intern`, URL `https://isgy-intern-mcp.vercel.app/mcp`, Authentifizierung *OAuth* → anmelden. Im Chat über *+ → Mehr* einschalten.

**Gemini CLI**: in `~/.gemini/settings.json`
```json
{ "mcpServers": { "isgy-intern": { "httpUrl": "https://isgy-intern-mcp.vercel.app/mcp" } } }
```
Beim ersten Start öffnet sich die Anmeldung (sonst `/mcp auth isgy-intern`).

**Andere Clients** (Cursor, VS Code, …): dieselbe URL, Transport „Streamable HTTP“. Wer kein OAuth kann, holt sich unter `/schluessel` einen persönlichen Zugriffsschlüssel für den Header `Authorization: Bearer …`.

## Anmeldung

Beim Verbinden öffnet sich eine Anmeldeseite mit zwei Wegen:

- **Benutzername & Passwort** – für Konten mit Portal-Passwort (z. B. Eltern). Der Server meldet sich selbst an und, wenn die Sitzung abläuft, automatisch neu.
- **Office 365 (Schüler)** – Schüler melden sich über Microsoft an und haben kein Portal-Passwort. Dann in der Erweiterung **ISGY Intern Plus** (ab 1.2) auf isgy-intern.de `Strg+K` → *🤖 KI-Verbindungscode kopieren* und den Code einfügen. Er enthält deine Browser-Sitzung; beim Einloggen auf isgy-intern.de „Angemeldet bleiben“ anhaken, damit sie lange hält. Wenn du dich im Browser abmeldest, endet auch die Sitzung des Servers – dann neuen Code holen und neu verbinden.

## Tools

| Tool | Wofür |
| --- | --- |
| `tagesplan` | Unterricht eines Tages mit eingearbeiteten Vertretungen/Entfällen + Termine (ohne Datum: heute bzw. nach Schulschluss der nächste Schultag) |
| `stundenplan` | regulärer Wochenplan mit Lehrkräften, Räumen und Zeiten |
| `vertretungen` | Vertretungsplan, eigene Klasse oder alle |
| `hausaufgaben` | alle Hausaufgaben der letzten Schultage aus dem Klassentagebuch |
| `tagebuch` | Tagebucheinträge für Tag/Zeitraum, optional ein Fach |
| `letzter_eintrag` | neuester Eintrag eines Fachs („Was haben wir zuletzt in Mathe gemacht?“) |
| `termine` | Klassenkalender (Schulaufgaben, Exen, Ausflüge …) |
| `lehrer` | Kürzel ↔ Name |

## Datenschutz & Sicherheit

- Es gibt **keine Datenbank**. Deine Zugangsdaten (Passwort bzw. Browser-Sitzung) stecken nur **verschlüsselt** (AES-256-GCM) im Zugriffstoken, das dein KI-Assistent bekommt. Entschlüsseln kann sie nur dieser Server mit seinem geheimen Schlüssel `MCP_SECRET`.
- Der Server ruft nur lesende Schnittstellen auf (`rest.php/stundenplan`, `vplan`, `tagebuch`, `klassenkalender` und die Kürzel-PDF). Die Kürzel-PDF wird nur im Arbeitsspeicher gelesen; behalten wird nur die Zuordnung Kürzel → Name.
- Verbindung trennen: im KI-Assistenten den Connector entfernen. Alle Verbindungen auf einmal ungültig machen: `MCP_SECRET` in Vercel ändern und neu deployen.
- Das Ganze ist inoffiziell und kein Angebot der Schule.

## Selbst betreiben / entwickeln

Ordner `mcp/` als eigenes Vercel-Projekt (Root Directory `mcp`, Framework „Other“). Umgebungsvariablen:

| Variable | |
| --- | --- |
| `MCP_SECRET` | **Pflicht**, zufällig, ≥ 32 Zeichen (`node -e "console.log(crypto.randomBytes(48).toString('base64url'))"`) |
| `ISGY_KUERZEL_PDF` | optional: Pfad der Kürzel-PDF, falls die automatische Suche sie nicht findet |
| `ISGY_BASE_URL`, `PUBLIC_URL` | optional, nur für Tests / eigene Domain |

```bash
cd mcp
npm install
npm test          # Ende-zu-Ende-Test mit dem offiziellen MCP-SDK gegen ein nachgebautes Portal
npm run dev       # http://localhost:3000/mcp  (gegen das echte isgy-intern.de)
```

Aufbau: `api/index.js` (einzige Vercel-Funktion, Routing), `lib/mcp.js` (JSON-RPC/MCP), `lib/oauth.js` (OAuth 2.1 mit dynamischer Client-Registrierung und PKCE, zustandslos), `lib/portal.js` (Zugriff auf isgy-intern.de), `lib/tools.js` (die Tools), `lib/pages.js` (Anmeldeseiten).
