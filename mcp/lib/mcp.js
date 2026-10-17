// Minimal MCP server over Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch)
// and gets a plain JSON response. No server-initiated messages, so no SSE stream is needed.
import { TOOLS, PROMPTS, InputError } from './tools.js';
import { nowLabel, lessonTime, TIMES } from './dates.js';
import { portalFor, AuthError, PortalError } from './portal.js';

export const SERVER_INFO = { name: 'isgy-intern', title: 'ISGY Intern', version: '1.1.0' };
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `ISGY Intern: Lesezugriff auf das Schulportal isgy-intern.de des Gymnasiums Ismaning (Bayern) für den angemeldeten Schüler bzw. das Elternteil – Stundenplan, Vertretungsplan, Klassentagebuch (Themen + Hausaufgaben), Klassenkalender (Prüfungen, Termine) und Lehrerkürzel.

Welches Tool wofür:
- Offene Fragen („Was steht an?“, Gesprächsbeginn) → uebersicht
- Ein bestimmter Tag („Was habe ich morgen?“, „Was ist am Freitag fällig?“) → tagesplan
- Hausaufgaben → hausaufgaben; ein Fach → letzter_eintrag oder fach
- Schulaufgaben/Exen/Tests und Lernstoff dafür → pruefungen
- Alles zu einem Fach → fach; verpasster Stoff → tagebuch
- Vertretungen gezielt → vertretungen; Wochenplan → stundenplan; Termine → termine; Kürzel → lehrer

Wissenswertes:
- Jede Antwort beginnt mit „Stand: …“ (aktuelles Datum und Uhrzeit in Deutschland). Relative Angaben wie „morgen“ immer darauf beziehen.
- Stundenzeiten: ${Object.keys(TIMES).map((n) => `${n}. ${lessonTime(n)}`).join(', ')}.
- Fächer werden als Kürzel angegeben (M = Mathe, D = Deutsch, E = Englisch, Ph = Physik, …; „_1“ o. Ä. = Kurs/Gruppe). Die Tools verstehen auch ausgeschriebene Namen.
- Bayerische Begriffe: Schulaufgabe = große angekündigte Klassenarbeit, Ex (Stegreifaufgabe) = unangekündigter Kurztest, Kurzarbeit = angekündigter kurzer Test.
- Hausaufgaben stehen im Klassentagebuch beim Tag, an dem sie aufgegeben wurden; fällig sind sie meist zur nächsten Stunde des Fachs.
- Der Vertretungsplan wird meist nur für die nächsten Tage veröffentlicht; fehlende Einträge für spätere Tage heißen nicht, dass nichts ausfällt.
- Alle Daten sind privat und gehören dem Nutzer; nichts davon an Dritte weitergeben.
Antworte auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache. Fasse zusammen statt Rohdaten zu wiederholen.`;

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function callTool(cred, params) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) return { error: [-32602, `Unbekanntes Tool: ${params?.name}`] };
  const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
  try {
    const text = `Stand: ${nowLabel()}\n\n` + await tool.run(portalFor(cred), args);
    return { result: { content: [{ type: 'text', text }] } };
  } catch (e) {
    let text = e.message || String(e);
    if (e instanceof AuthError) text += cred.m === 'pw'
      ? ' Die gespeicherte Anmeldung funktioniert nicht mehr (Passwort geändert?). Bitte trenne die Verbindung zu „ISGY Intern“ und verbinde dich neu.'
      : ' Bitte erzeuge in der Erweiterung „ISGY Intern Plus“ einen neuen Verbindungscode, trenne die Verbindung zu „ISGY Intern“ und verbinde dich neu.';
    else if (!(e instanceof PortalError || e instanceof InputError)) console.error('[tool]', params.name, e);
    return { result: { content: [{ type: 'text', text }], isError: true } };
  }
}

async function handleOne(msg, cred) {
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
      const r = await callTool(cred, params);
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
export async function handleRpc(body, cred) {
  if (Array.isArray(body)) {
    if (!body.length) return [400, fail(null, -32600, 'Invalid Request')];
    const out = (await Promise.all(body.map((m) => handleOne(m, cred)))).filter(Boolean);
    return out.length ? [200, out] : [202, null];
  }
  const out = await handleOne(body, cred);
  return out ? [200, out] : [202, null];
}
