// Minimal MCP server over Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch)
// and gets a plain JSON response. No server-initiated messages, so no SSE stream is needed.
import { TOOLS, InputError } from './tools.js';
import { portalFor, AuthError, PortalError } from './portal.js';

export const SERVER_INFO = { name: 'isgy-intern', title: 'ISGY Intern', version: '1.0.0' };
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Zugriff auf das Schulportal isgy-intern.de (Gymnasium Ismaning) des angemeldeten Schülers bzw. Elternteils.
Alle Daten sind nur lesbar. Datumsangaben beziehen sich auf deutsche Zeit (Europe/Berlin).
- „Was habe ich heute/morgen?“, „Fällt etwas aus?“ → tagesplan
- Vertretungen allgemein → vertretungen; Wochenplan → stundenplan
- Hausaufgaben → hausaufgaben (Überblick) oder letzter_eintrag (ein Fach)
- Schulaufgaben, Exen, Ausflüge → termine
- Lehrerkürzel → lehrer
Antworte dem Nutzer auf Deutsch, sofern er nicht eine andere Sprache verwendet.`;

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

async function callTool(cred, params) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) return { error: [-32602, `Unbekanntes Tool: ${params?.name}`] };
  const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
  try {
    const text = await tool.run(portalFor(cred), args);
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
        capabilities: { tools: { listChanged: false } },
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
      return ok(id, { prompts: [] });
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
