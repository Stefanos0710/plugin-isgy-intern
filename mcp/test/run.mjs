// End-to-end test with the official MCP SDK client against a fake portal: node test/run.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startMock, USER, D1, clearSessions } from './mock-portal.mjs';

process.env.ISGY_BASE_URL = 'http://127.0.0.1:4100';
process.env.MCP_SECRET = 'test-secret-0123456789-0123456789-abcdef';
const { default: handler } = await import('../api/index.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { UnauthorizedError } = await import('@modelcontextprotocol/sdk/client/auth.js');

const mock = await startMock(4100);
const server = createServer(handler).listen(3100);
const BASE = 'http://localhost:3100';
const MCP = new URL(BASE + '/mcp');
let failures = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); } catch (e) { failures++; console.log('✗', name, '\n ', e.stack || e); }
};

// Logs in through the real HTML form, like a user would.
async function submitLogin(authUrl, fields) {
  const page = await (await fetch(authUrl)).text();
  const req = page.match(/name="req" value="([^"]+)"/)?.[1];
  assert.ok(req, 'login page has req field:\n' + page.slice(0, 500));
  const r = await fetch(BASE + '/authorize', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ req, ...fields }) });
  return r;
}

function provider(fields) {
  const s = {};
  return {
    s,
    get redirectUrl() { return 'http://localhost:7777/oauth/callback'; },
    get clientMetadata() { return { client_name: 'Test Client', redirect_uris: ['http://localhost:7777/oauth/callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }; },
    clientInformation: () => s.client,
    saveClientInformation: (c) => { s.client = c; },
    tokens: () => s.tokens,
    saveTokens: (t) => { s.tokens = t; },
    saveCodeVerifier: (v) => { s.verifier = v; },
    codeVerifier: () => s.verifier,
    redirectToAuthorization: async (url) => {
      const r = await submitLogin(url.href, fields);
      assert.equal(r.status, 302, 'login redirects');
      const loc = new URL(r.headers.get('location'));
      assert.equal(loc.searchParams.get('state'), url.searchParams.get('state'));
      s.code = loc.searchParams.get('code');
    },
  };
}

async function connect(p) {
  let t = new StreamableHTTPClientTransport(MCP, { authProvider: p });
  const client = new Client({ name: 'test', version: '1.0.0' });
  try { await client.connect(t); }
  catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e;
    await t.finishAuth(p.s.code);
    t = new StreamableHTTPClientTransport(MCP, { authProvider: p });
    await client.connect(t);
  }
  return client;
}
const text = (r) => r.content.map((c) => c.text).join('\n');

await step('401 + WWW-Authenticate without token', async () => {
  const r = await fetch(MCP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 401);
  assert.match(r.headers.get('www-authenticate'), /resource_metadata="http:\/\/localhost:3100\/.well-known\/oauth-protected-resource"/);
  const meta = await (await fetch(BASE + '/.well-known/oauth-authorization-server')).json();
  assert.equal(meta.token_endpoint, BASE + '/token');
});

let client, prov;
await step('OAuth flow with password + initialize', async () => {
  prov = provider({ mode: 'pw', ...USER });
  client = await connect(prov);
  assert.equal(client.getServerVersion().name, 'isgy-intern');
  assert.ok(client.getInstructions().includes('tagesplan'));
});

await step('tools/list', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), ['tagesplan', 'stundenplan', 'vertretungen', 'hausaufgaben', 'tagebuch', 'letzter_eintrag', 'termine', 'lehrer']);
  assert.ok(tools.every((t) => t.annotations.readOnlyHint));
});

const calls = [
  ['tagesplan', { datum: D1 }, [/Klasse 10b/, /ENTFÄLLT/, /Lehrkraft: Max Mustermann \(Mm\)/, /Raum: 204/, /Schulaufgabe/]],
  ['tagesplan', {}, [/Klasse 10b/]],
  ['stundenplan', {}, [/Montag:/, /1\.–2\. Std \(07:55\) M · Max Mustermann \(Mm\) · Raum 204/]],
  ['vertretungen', {}, [/Vertretungen \(Klasse 10b\)/, /3\. Std D \(Sabine Weber \(Sw\)\)/]],
  ['vertretungen', { alle_klassen: true }, [/9a/]],
  ['hausaufgaben', { tage: 3 }, [/S\. 42 Nr\. 3a–c/, /Vocab unit 3/]],
  ['tagebuch', { fach: 'Mathe' }, [/Quadratische Funktionen/]],
  ['tagebuch', { fach: 'Latein' }, [/nicht im Stundenplan gefunden/]],
  ['letzter_eintrag', { fach: 'englisch', anzahl: 2 }, [/Reported speech/]],
  ['termine', { tage: 30 }, [/Schulaufgabe/, /Wandertag/, /Ebersberger Forst/]],
  ['lehrer', { suche: 'weber' }, [/Sw: Sabine Weber/]],
  ['tagesplan', { datum: 'quatsch' }, [/Unbekanntes Datum/]],
];
for (const [name, args, res] of calls) {
  await step(`tools/call ${name} ${JSON.stringify(args)}`, async () => {
    const r = await client.callTool({ name, arguments: args });
    const t = text(r);
    for (const re of res) assert.match(t, re, t);
    if (process.env.VERBOSE) console.log(t.replace(/^/gm, '    '));
  });
}

await step('refresh token grant', async () => {
  const r = await fetch(BASE + '/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: prov.s.tokens.refresh_token, client_id: prov.s.client.client_id }) });
  const j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.ok(j.access_token && j.refresh_token);
});

await step('wrong password shows portal error on the login page', async () => {
  const reg = await (await fetch(BASE + '/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude' }) })).json();
  const url = `${BASE}/authorize?response_type=code&client_id=${reg.client_id}&redirect_uri=${encodeURIComponent('https://claude.ai/api/mcp/auth_callback')}&code_challenge=abc&code_challenge_method=S256&state=xyz`;
  const r = await submitLogin(url, { mode: 'pw', username: USER.username, password: 'falsch' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Unbekannter Benutzer oder falsches Passwort/);
  const bad = await fetch(url.replace('claude.ai', 'evil.example'));
  assert.equal(bad.status, 400);
});

await step('connection code (Office 365 path)', async () => {
  // What the extension produces: the browser's cookies + localStorage session + app key.
  const login = await fetch('http://127.0.0.1:4100/index.php?page=login&authorize=1', { method: 'POST', body: (() => { const f = new FormData(); f.set('username', USER.username); f.set('password', USER.password); return f; })() });
  const s = login.headers.getSetCookie()[0].match(/PHPSESSID=(\w+)/)[1];
  const code = 'isgy1.' + Buffer.from(JSON.stringify({ c: { PHPSESSID: s }, s, k: 'AppKey123' })).toString('base64url');
  const p = provider({ mode: 'code', code });
  const c2 = await connect(p);
  const r = await c2.callTool({ name: 'vertretungen', arguments: { datum: D1 } });
  assert.match(text(r), /ENTFÄLLT/);
  const bad = provider({ mode: 'code', code: 'isgy1.' + Buffer.from(JSON.stringify({ c: { PHPSESSID: 'nope' } })).toString('base64url') });
  await assert.rejects(connect(bad));
});

await step('expired portal session → automatic re-login (password)', async () => {
  clearSessions();
  assert.match(text(await client.callTool({ name: 'stundenplan', arguments: {} })), /Montag:/);
  clearSessions();
  const r = await client.callTool({ name: 'vertretungen', arguments: { datum: D1 } });
  assert.ok(!r.isError, text(r));
  assert.match(text(r), /ENTFÄLLT/);
});

await step('personal key page', async () => {
  const r = await fetch(BASE + '/schluessel', { method: 'POST', body: new URLSearchParams({ mode: 'pw', ...USER }) });
  const page = await r.text();
  const key = page.match(/<code id="k">([^<]+)<\/code>/)?.[1];
  assert.ok(key, page.slice(0, 300));
  const rpc = await fetch(MCP, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'lehrer', arguments: { suche: 'Mm' } } }) });
  const j = await rpc.json();
  assert.match(j.result.content[0].text, /Max Mustermann/);
});

await step('home page', async () => {
  const r = await fetch(BASE + '/');
  assert.match(await r.text(), /http:\/\/localhost:3100\/mcp/);
});

server.close(); mock.close();
console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden.');
process.exit(failures ? 1 : 0);
