# ISGY Intern MCP-Server

Ein [MCP](https://modelcontextprotocol.io)-Server, mit dem **Claude, ChatGPT, Gemini CLI** und andere KI-Assistenten deine Daten aus isgy-intern.de lesen können: Stundenplan, Vertretungsplan, Klassentagebuch (Themen & Hausaufgaben), Termine aus dem Klassenkalender und die Lehrerkürzel. Nur Lesezugriff.

**Server-URL:** `https://isgy-intern-plus.vercel.app/mcp`
Auf der Startseite <https://isgy-intern-plus.vercel.app> stehen die Anleitungen für jeden Client noch einmal mit Kopier-Knopf.

## Hinzufügen

**Claude** (claude.ai, Desktop-App, Handy): Einstellungen → Connectors → *Benutzerdefinierten Connector hinzufügen* → Name `ISGY Intern`, URL `https://isgy-intern-plus.vercel.app/mcp` → *Verbinden* → im Fenster anmelden.
Claude Code: `claude mcp add --transport http isgy-intern https://isgy-intern-plus.vercel.app/mcp`, dann `/mcp` → Anmelden.

**ChatGPT** (Plus/Pro/Business): Einstellungen → Apps & Connectors → Erweitert → *Entwicklermodus* an. Dann *Erstellen*: Name `ISGY Intern`, URL `https://isgy-intern-plus.vercel.app/mcp`, Authentifizierung *OAuth* → anmelden. Im Chat über *+ → Mehr* einschalten.

**Gemini CLI**: in `~/.gemini/settings.json`
```json
{ "mcpServers": { "isgy-intern": { "httpUrl": "https://isgy-intern-plus.vercel.app/mcp" } } }
```
Beim ersten Start öffnet sich die Anmeldung (sonst `/mcp auth isgy-intern`).

**Andere Clients** (Cursor, VS Code, …): dieselbe URL, Transport „Streamable HTTP“. Wer kein OAuth kann, holt sich unter `/schluessel` einen persönlichen Zugriffsschlüssel für den Header `Authorization: Bearer …`.

## Anmeldung

Beim Verbinden öffnet sich eine Anmeldeseite mit drei Wegen:

- **Konto (empfohlen)** – auf <https://isgy-intern-plus.vercel.app/konto> mit E-Mail und Passwort registrieren und einmal den isgy-intern-Zugang hinterlegen (Portal-Passwort oder automatisch über die Erweiterung). Danach melden sich KI-Assistenten nur noch mit dem Konto an. Ist man auf der Seite schon angemeldet, reicht ein Klick auf „Verbinden“.
- **Benutzername & Passwort** (ohne Konto) – für Konten mit Portal-Passwort (z. B. Eltern). Der Server meldet sich selbst an und, wenn die Sitzung abläuft, automatisch neu.
- **Office 365 / Verbindungscode** (ohne Konto) – in der Erweiterung `Strg+K` → *🤖 KI-Verbindungscode kopieren* und einfügen.

**Welche Daten wohin?** Bei „Konto“ (und beim Registrieren) gehören **E-Mail** und ein eigenes **Konto-Passwort** hin – nicht das isgy-intern-Passwort. Beim Tab „Passwort“ (und beim Hinterlegen auf der Kontoseite) gehören der **isgy-intern-Benutzername** und das **Portal-Passwort** hin. Wer sich auf isgy-intern.de über Office 365 anmeldet, trägt nichts davon ein, sondern nutzt die Erweiterung (mit Konto) oder den Verbindungscode.

### Konto + Erweiterung

In den Einstellungen der Erweiterung **ISGY Intern Plus** (ab 1.3) unter *KI-Konto* mit E-Mail und Konto-Passwort anmelden. Ab dann, bei jedem Besuch von isgy-intern.de (höchstens alle 2 Minuten und nach jeder Änderung):

- **Aufgaben & Notizen** aus „Mein Tag“ werden in beide Richtungen synchronisiert (neuere Änderung gewinnt, Löschungen werden mitgenommen). Der KI-Assistent kann sie lesen, neue anlegen, abhaken und löschen.
- Bei Konten ohne gespeichertes Portal-Passwort (Office 365) übergibt die Erweiterung die **aktuelle Browser-Sitzung** ans Konto – der KI-Assistent hat also immer eine gültige Sitzung, solange du isgy-intern.de ab und zu im Browser öffnest.

## Tools

Jede Antwort beginnt mit „Stand: <Datum, Uhrzeit>“, damit der Assistent „heute“/„morgen“ richtig einordnet. Lehrerkürzel sind überall schon in Namen aufgelöst.

| Tool | Wofür |
| --- | --- |
| `uebersicht` | alles auf einen Blick: laufende/nächste Stunde, heute bzw. nächster Schultag mit Vertretungen, fällige und alle Hausaufgaben der letzten Tage, Prüfungen und Termine |
| `tagesplan` | ein Tag im Detail: Stunden mit Uhrzeiten, Vertretungen/Entfälle, Freistunden, Schulschluss, die für den Tag fälligen Hausaufgaben, Prüfungen danach |
| `hausaufgaben` | Hausaufgaben der letzten Schultage, je mit der nächsten Stunde des Fachs (= übliche Fälligkeit), optional ein Fach |
| `pruefungen` | Schulaufgaben, Exen, Kurzarbeiten … mit den Unterrichtsthemen der letzten Wochen als Lernstoff |
| `fach` | Steckbrief eines Fachs: Lehrkraft, Wochenstunden, nächste Stunden, Prüfungen, letzte Tagebucheinträge |
| `vertretungen` | Vertretungsplan, eigene Klasse oder alle, und welche Tage schon veröffentlicht sind |
| `stundenplan` | regulärer Wochenplan mit Uhrzeiten und Wochenstunden je Fach |
| `tagebuch` | Tagebucheinträge für Tag/Zeitraum, optional ein Fach |
| `letzter_eintrag` | neueste Einträge eines Fachs und wann die nächste Stunde ist |
| `termine` | Klassenkalender, Prüfungen markiert |
| `lehrer` | Kürzel ↔ Name |
| `notizen` | eigene Aufgaben & Notizen aus der Erweiterung (nur mit Konto) |
| `notiz_anlegen` / `aufgabe_erledigt` / `notiz_loeschen` | Aufgaben/Notizen anlegen, abhaken, löschen – landen direkt in „Mein Tag“ (nur mit Konto) |

Dazu gibt es fertige **Prompts** (in Claude über das „+“-Menü): *Mein Schultag*, *Wochenvorschau*, *Hausaufgaben-Check* und *Lernplan für eine Prüfung*.

## Datenschutz & Sicherheit

- **Ohne Konto** gibt es keine Speicherung: Die Zugangsdaten stecken nur verschlüsselt (AES-256-GCM) im Zugriffstoken, das der KI-Assistent bekommt.
- **Mit Konto** liegen in Supabase (Frankfurt): E-Mail, scrypt-Hash des Konto-Passworts, der isgy-intern-Zugang – vom Server mit `MCP_SECRET` AES-256-GCM-verschlüsselt, also auch in der Datenbank nicht lesbar – und die Aufgaben & Notizen.
- Die Tabellen liegen im Schema `private`, das die Supabase-API nicht ausliefert. Der Server erreicht sie nur über Funktionen, die zusätzlich `SUPABASE_API_SECRET` prüfen; der öffentliche Supabase-Schlüssel allein reicht für nichts.
- Von isgy-intern.de wird nur gelesen. Schreiben kann der KI-Assistent nur die eigenen Notizen.
- Auf der Kontoseite: Zugang entfernen, „Überall abmelden“ (macht alle Tokens von KI-Assistenten und Erweiterung ungültig) und Konto samt Notizen löschen.
- Vollständige Angaben: [Datenschutzerklärung](https://isgy-intern-plus.vercel.app/datenschutz) und [Impressum](https://isgy-intern-plus.vercel.app/impressum).
- Es gibt keine E-Mail-Bestätigung und kein Passwort-Zurücksetzen. Das Ganze ist inoffiziell und kein Angebot der Schule.

## Website & SEO

Die Startseite (`/`) ist die einzige Seite für Suchmaschinen: eigener Titel und Beschreibung, `canonical`, Open Graph / Twitter Cards (Vorschaubild `assets/og.png`), strukturierte Daten (JSON-LD: `WebSite`, `SoftwareApplication`, `FAQPage`), sichtbare FAQ, `robots.txt`, `sitemap.xml` (mit Bildern), `site.webmanifest`, Favicons und eine `llms.txt` für KI-Crawler. Alle anderen Seiten (Anmeldung, Konto, Schlüssel) sind `noindex`. Die alte Adresse `isgy-intern-mcp.vercel.app` leitet nur die Startseite weiter; bestehende Verbindungen laufen weiter.

Logos: Claude, OpenAI und Gemini sind die echten Marken-Logos (MIT-lizenzierte SVGs aus `@lobehub/icons-static-svg`), das ISGY-Logo kommt aus `logo-plus.png`. Alles liegt in `assets/`; das Vorschaubild entsteht aus `scripts/og.html` (1200×630 rendern). Nach Änderungen an der Startseite `UPDATED` in `lib/site.js` hochsetzen.

Nach dem ersten Deploy einmalig in der [Google Search Console](https://search.google.com/search-console) (Property-Typ **„URL-Präfix“** mit `https://isgy-intern-plus.vercel.app/`, Bestätigung per **HTML-Tag** → Wert in `GOOGLE_SITE_VERIFICATION`) und den [Bing Webmaster Tools](https://www.bing.com/webmasters) die Seite hinzufügen und `https://isgy-intern-plus.vercel.app/sitemap.xml` einreichen. Die Property-Art „Domain“ (DNS) funktioniert bei `vercel.app` nicht, weil die DNS-Einträge Vercel gehören.

## Selbst betreiben / entwickeln

Ordner `mcp/` als eigenes Vercel-Projekt (Root Directory `mcp`, Framework „Other“). Umgebungsvariablen:

| Variable | |
| --- | --- |
| `MCP_SECRET` | **Pflicht**, zufällig, ≥ 32 Zeichen (`node -e "console.log(crypto.randomBytes(48).toString('base64url'))"`) |
| `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_API_SECRET` | für Konten: Projekt-URL, publishable/anon key und ein zufälliges Geheimnis. Datenbank einmalig mit [supabase/0001_accounts_notes.sql](supabase/0001_accounts_notes.sql) einrichten und den SHA-256 des Geheimnisses eintragen (`insert into private.config values ('api_secret_sha256', '<hex>')`). Ohne diese Variablen läuft der Server ohne Konten. |
| `ISGY_KUERZEL_PDF` | optional: Pfad der Kürzel-PDF, falls die automatische Suche sie nicht findet |
| `ISGY_BASE_URL`, `PUBLIC_URL` | optional, nur für Tests / eigene Domain |
| `OPERATOR_NAME`, `OPERATOR_STREET`, `OPERATOR_CITY`, `OPERATOR_EMAIL` | Angaben für Impressum und Datenschutzerklärung (`/impressum`, `/datenschutz`). Stehen bewusst nur in der Vercel-Konfiguration, nicht im Repository. |
| `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`, `GOOGLE_VERIFICATION_FILE` | optional: Bestätigung der Website in Google Search Console / Bing (Meta-Tag-Wert bzw. Dateiname `google….html`). Bei einer `vercel.app`-Adresse geht nur „URL-Präfix“ mit HTML-Tag oder HTML-Datei, nicht DNS. |
| `SITE_URL`, `LEGACY_HOSTS` | optional: öffentliche Adresse für `canonical`/Sitemap (Standard `https://isgy-intern-plus.vercel.app`) und ältere Hostnamen, deren Startseite weiterleitet |

```bash
cd mcp
npm install
npm test          # Ende-zu-Ende-Test mit dem offiziellen MCP-SDK gegen ein nachgebautes Portal und Supabase
npm run dev       # http://localhost:3000/mcp  (gegen das echte isgy-intern.de)
```

Aufbau: `api/index.js` (einzige Vercel-Funktion, Routing), `lib/mcp.js` (JSON-RPC/MCP), `lib/oauth.js` (OAuth 2.1 mit dynamischer Client-Registrierung und PKCE, zustandslos), `lib/portal.js` (Zugriff auf isgy-intern.de), `lib/tools.js` (die Tools), `lib/pages.js` (Seiten), `lib/site.js` (Adresse, Logos, robots/sitemap/Manifest), `lib/accounts.js` + `lib/konto.js` (Konten, Kontoseite, Erweiterungs-API `/api/ext/login|sync`), `lib/db.js` (Supabase-RPC).
