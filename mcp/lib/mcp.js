// Minimal MCP server over Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch)
// and gets a plain JSON response. No server-initiated messages, so no SSE stream is needed.
import { TOOLS, PROMPTS, InputError } from './tools.js';
import { nowLabel, lessonTime, TIMES } from './dates.js';
import { portalFor, AuthError, PortalError } from './portal.js';
import { credOf } from './accounts.js';
import { DbError } from './db.js';

export const SERVER_INFO = { name: 'isgy-intern', title: 'ISGY Intern', version: '1.3.0' };
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `ISGY Intern: Lesezugriff auf das Schulportal isgy-intern.de des Gymnasiums Ismaning (Bayern) für den angemeldeten Schüler bzw. das Elternteil – Stundenplan, Vertretungsplan, Klassentagebuch (Themen + Hausaufgaben), Klassenkalender (Prüfungen, Termine) und Lehrerkürzel.

Welches Tool wofür:
- Offene Fragen („Was steht an?“, Gesprächsbeginn) → uebersicht
- Ein bestimmter Tag („Was habe ich morgen?“, „Was ist am Freitag fällig?“) → tagesplan
- „Hausaufgaben für morgen/Montag/…“, „Was ist auf?“ → hausaufgaben mit faellig=<Tag>. NICHT tagebuch für diesen Tag: Hausaufgaben für morgen wurden in der vorherigen Stunde des Fachs aufgegeben, morgen steht noch nichts im Tagebuch.
- Alle offenen Hausaufgaben → hausaufgaben ohne Parameter; ein Fach → hausaufgaben mit fach, letzter_eintrag oder fach
- Schulaufgaben/Exen/Tests und Lernstoff dafür → pruefungen
- Alles zu einem Fach → fach; verpasster Stoff → tagebuch
- Vertretungen gezielt → vertretungen; Wochenplan → stundenplan; Termine → termine; Kürzel → lehrer
- Eigene Aufgaben & Notizen des Nutzers (aus der Browser-Erweiterung, nur mit ISGY-KI-Konto) → notizen; neue anlegen → notiz_anlegen; abhaken → aufgabe_erledigt; löschen → notiz_loeschen

Wissenswertes:
- Jede Antwort beginnt mit „Stand: …“ (aktuelles Datum und Uhrzeit in Deutschland). Relative Angaben wie „morgen“ immer darauf beziehen.
- Stundenzeiten: ${Object.keys(TIMES).map((n) => `${n}. ${lessonTime(n)}`).join(', ')}.
- Fächer werden als Kürzel angegeben (M = Mathe, D = Deutsch, E = Englisch, Ph = Physik, …; „_1“ o. Ä. = Kurs/Gruppe). Die Tools verstehen auch ausgeschriebene Namen.
- Bayerische Begriffe: Schulaufgabe = große angekündigte Klassenarbeit, Ex (Stegreifaufgabe) = unangekündigter Kurztest, Kurzarbeit = angekündigter kurzer Test.
- Hausaufgaben stehen im Klassentagebuch beim Tag, an dem sie aufgegeben wurden; fällig sind sie meist zur nächsten Stunde des Fachs, außer im Text steht ein Termin („bis Freitag“). Fällt die nächste Stunde aus (Entfall, Ferien), verschiebt sich die Fälligkeit. Die Tools rechnen das schon aus – nimm ihre Fälligkeiten, statt selbst zu rechnen.
- Fehlt der Tagebucheintrag für eine Stunde, ist sie ausgefallen oder noch nicht eingetragen – sag das dem Nutzer, statt eine ältere Hausaufgabe als sicher fällig darzustellen.
- Parallel stehende Fächer (Wahlfächer, Sprachen, Religion/Ethik) betreffen den Nutzer nur, wenn er das Fach hat.
- Der Vertretungsplan wird meist nur für die nächsten Tage veröffentlicht; fehlende Einträge für spätere Tage heißen nicht, dass nichts ausfällt.
- Aufgaben/Notizen, die du anlegst, erscheinen sofort im „Mein Tag“-Dashboard der Erweiterung. Lege nur an, was der Nutzer möchte, und nenne kurz, was du gespeichert hast.
- Alle Daten sind privat und gehören dem Nutzer; nichts davon an Dritte weitergeben.
Antworte auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache. Fasse zusammen statt Rohdaten zu wiederholen.`;

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// auth: {cred, acc, origin}. Account tokens use the login stored in the account (kept fresh by the extension).
async function callTool(auth, params) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) return { error: [-32602, `Unbekanntes Tool: ${params?.name}`] };
  const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
  const cred = auth.cred || credOf(auth.acc);
  const ctx = { acc: auth.acc, origin: auth.origin, portal: cred ? portalFor(cred) : null };
  try {
    const text = `Stand: ${nowLabel()}\n\n` + await tool.run(ctx.portal, args, ctx);
    return { result: { content: [{ type: 'text', text }] } };
  } catch (e) {
    let text = e.message || String(e);
    if (e instanceof AuthError) {
      if (cred?.m === 'pw') text += ' Die gespeicherte isgy-intern-Anmeldung funktioniert nicht mehr (Passwort geändert?).' + (auth.acc ? ` Bitte auf ${auth.origin}/konto den Zugang neu hinterlegen.` : ' Bitte die Verbindung zu „ISGY Intern“ trennen und neu verbinden.');
      else if (auth.acc) text += ` Die gespeicherte Browser-Sitzung ist abgelaufen. Einfach isgy-intern.de im Browser öffnen (mit der Erweiterung „ISGY Intern Plus“, die mit deinem Konto verbunden ist) – dann wird sie automatisch erneuert. Alternativ auf ${auth.origin}/konto ein Portal-Passwort hinterlegen.`;
      else text += ' Bitte in der Erweiterung „ISGY Intern Plus“ einen neuen Verbindungscode erzeugen und die Verbindung zu „ISGY Intern“ neu herstellen.';
    } else if (!(e instanceof PortalError || e instanceof InputError || e instanceof DbError)) console.error('[tool]', params.name, e);
    return { result: { content: [{ type: 'text', text }], isError: true } };
  }
}

async function handleOne(msg, auth) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid Request');
  const { id, method, params } = msg;
  const isNotification = id === undefined;
  if (isNotification) return null; // notifications/initialized, notifications/cancelled …
  switch (method) {
    case 'initialize': {
      const wanted = params?.protocolVersion;
      return ok(id, {
        protocolVersion: VERSIONS.includes(wanted) ? wanted : VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, { tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })) });
    case 'tools/call': {
      const r = await callTool(auth, params);
      return r.error ? fail(id, ...r.error) : ok(id, r.result);
    }
    case 'resources/list':
      return ok(id, { resources: [] });
    case 'resources/templates/list':
      return ok(id, { resourceTemplates: [] });
    case 'prompts/list':
      return ok(id, { prompts: PROMPTS.map(({ name, title, description, arguments: a }) => ({ name, title, description, arguments: a })) });
    case 'prompts/get': {
      const p = PROMPTS.find((x) => x.name === params?.name);
      if (!p) return fail(id, -32602, `Unbekannter Prompt: ${params?.name}`);
      return ok(id, { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text(params.arguments || {}) } }] });
    }
    case 'logging/setLevel':
      return ok(id, {});
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

// Returns [status, body|null]
export async function handleRpc(body, auth) {
  if (Array.isArray(body)) {
    if (!body.length) return [400, fail(null, -32600, 'Invalid Request')];
    const out = (await Promise.all(body.map((m) => handleOne(m, auth)))).filter(Boolean);
    return out.length ? [200, out] : [202, null];
  }
  const out = await handleOne(body, auth);
  return out ? [200, out] : [202, null];
}
