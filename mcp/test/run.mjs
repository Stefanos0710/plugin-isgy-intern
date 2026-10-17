// End-to-end test with the official MCP SDK client against a fake portal: node test/run.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startMock, USER, D1, clearSessions } from './mock-portal.mjs';
import { startSupabase, state as dbState, API_SECRET, KEY } from './mock-supabase.mjs';

process.env.ISGY_BASE_URL = 'http://127.0.0.1:4100';
process.env.SUPABASE_URL = 'http://127.0.0.1:4200';
process.env.SUPABASE_KEY = KEY;
process.env.SUPABASE_API_SECRET = API_SECRET;
process.env.MCP_SECRET = 'test-secret-0123456789-0123456789-abcdef';
const { default: handler } = await import('../api/index.js');
const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { UnauthorizedError } = await import('@modelcontextprotocol/sdk/client/auth.js');

const mock = await startMock(4100);
const supa = await startSupabase(4200);
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
  assert.deepEqual(tools.map((t) => t.name).sort(), ['aufgabe_erledigt', 'fach', 'hausaufgaben', 'lehrer', 'letzter_eintrag', 'notiz_anlegen', 'notiz_loeschen', 'notizen', 'pruefungen', 'stundenplan', 'tagebuch', 'tagesplan', 'termine', 'uebersicht', 'vertretungen']);
  assert.equal(tools.find((t) => t.name === 'notiz_loeschen').annotations.destructiveHint, true);
  assert.ok(tools.filter((t) => !/^(notiz_|aufgabe_)/.test(t.name)).every((t) => t.annotations.readOnlyHint));
  assert.ok(!tools.find((t) => t.name === 'notiz_anlegen').annotations.readOnlyHint);
});

const calls = [
  ['uebersicht', {}, [/^Stand: /, /Überblick für Klasse 10b/, /PRÜFUNGEN/, /Schulaufgabe/, /S\. 42 Nr\. 3a–c/, /nächste Stunde/]],
  ['pruefungen', {}, [/📝 .*Schulaufgabe/, /Themen im Unterricht \(M/, /Quadratische Funktionen/]],
  ['pruefungen', { fach: 'Englisch' }, [/Keine Prüfungen in E_1/]],
  ['fach', { fach: 'Mathe' }, [/Fach M – Klasse 10b/, /Lehrkraft: Max Mustermann \(Mm\)/, /Wochenstunden: 4/, /Anstehende Prüfungen/, /Nächste Stunden/]],
  ['tagesplan', { datum: 'morgen' }, [/Klasse 10b/]],
  ['tagesplan', { datum: D1 }, [/Klasse 10b/, /ENTFÄLLT/, /Lehrkraft: Max Mustermann \(Mm\)/, /Raum: 204/, /Schulaufgabe/, /Unterricht 07:55–10:30/, /Hausaufgaben für diesen Tag/, /- M: S\. 42/]],
  ['tagesplan', {}, [/Klasse 10b/]],
  ['stundenplan', {}, [/Montag:/, /1\.–2\. Std 07:55–09:25  M · Max Mustermann \(Mm\) · Raum 204/, /Wochenstunden je Fach: .*M 4/]],
  ['vertretungen', {}, [/Vertretungen \(Klasse 10b\)/, /3\. Std \(09:45–10:30\): D bei Sabine Weber \(Sw\), Raum 101 → VERTRETUNG/, /Veröffentlichte Tage/]],
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

await step('prompts', async () => {
  const { prompts } = await client.listPrompts();
  assert.ok(prompts.some((p) => p.name === 'lernplan'));
  const r = await client.getPrompt({ name: 'lernplan', arguments: { fach: 'Physik' } });
  assert.match(r.messages[0].content.text, /fach="Physik"/);
});

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


// ---------- accounts ----------
const jar = { c: '' };
const web = async (path, form) => {
  const r = await fetch(BASE + path, { method: form ? 'POST' : 'GET', redirect: 'manual', headers: { cookie: jar.c, origin: BASE }, body: form ? new URLSearchParams(form) : undefined });
  const sc = r.headers.get('set-cookie');
  if (sc) jar.c = sc.split(';')[0].replace(/^isgy_s=$/, '');
  return r;
};
const EMAIL = 'Max@Example.org', PW = 'kontopasswort1';
let acctClient, acctProv, extToken;

await step('register account + cookie session', async () => {
  let r = await web('/konto/registrieren', { email: EMAIL, password: PW, password2: 'anders123' });
  assert.match(await r.text(), /stimmen nicht überein/);
  r = await web('/konto/registrieren', { email: EMAIL, password: PW, password2: PW });
  assert.equal(r.status, 303);
  assert.ok(jar.c.startsWith('isgy_s='));
  const page = await (await web('/konto')).text();
  assert.match(page, /max@example\.org/);
  assert.match(page, /Noch kein isgy-intern-Login hinterlegt/);
  r = await web('/konto/registrieren', { email: 'max@example.org', password: PW, password2: PW });
  assert.match(await r.text(), /gibt es schon ein Konto/);
  // pw hash, not the password, is stored
  const acc = [...dbState.accounts.values()][0];
  assert.ok(acc.pw_hash.startsWith('scrypt$') && !acc.pw_hash.includes(PW));
});

await step('store isgy-intern login in the account (encrypted)', async () => {
  let r = await web('/konto/zugang', { mode: 'pw', username: USER.username, password: 'falsch' });
  assert.match(await r.text(), /Unbekannter Benutzer/);
  r = await web('/konto/zugang', { mode: 'pw', username: USER.username, password: USER.password });
  assert.equal(r.status, 303);
  const page = await (await web('/konto?ok=zugang')).text();
  assert.match(page, /Passwort für <b>max\.muster<\/b> gespeichert/);
  const acc = [...dbState.accounts.values()][0];
  assert.equal(acc.cred_kind, 'pw');
  assert.ok(!acc.cred.includes(USER.password) && !acc.cred.includes(USER.username));
});

await step('cross-site form post is rejected', async () => {
  const r = await fetch(BASE + '/konto/loeschen', { method: 'POST', redirect: 'manual', headers: { cookie: jar.c, origin: 'https://evil.example' }, body: new URLSearchParams({ confirm: '1' }) });
  assert.equal(r.status, 403);
});

await step('OAuth with account → tools use the stored login', async () => {
  acctProv = provider({ mode: 'acct', email: EMAIL, account_password: PW });
  acctClient = await connect(acctProv);
  const r = await acctClient.callTool({ name: 'tagesplan', arguments: { datum: D1 } });
  assert.match(text(r), /ENTFÄLLT/);
  assert.ok(!acctProv.s.tokens.access_token.includes(USER.username));
  const bad = provider({ mode: 'acct', email: EMAIL, account_password: 'falsch!!' });
  await assert.rejects(connect(bad));
});

await step('one-click connect when signed in on the site', async () => {
  const reg = await (await fetch(BASE + '/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude' }) })).json();
  const url = `/authorize?response_type=code&client_id=${reg.client_id}&redirect_uri=${encodeURIComponent('https://claude.ai/api/mcp/auth_callback')}&code_challenge=abc&code_challenge_method=S256&state=s9`;
  const page = await (await web(url)).text();
  assert.match(page, /Angemeldet als<b>max@example\.org<\/b>/);
  const req = page.match(/name="req" value="([^"]+)"/)[1];
  const r = await web('/authorize', { req, mode: 'web' });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /^https:\/\/claude\.ai\/api\/mcp\/auth_callback\?code=.+&state=s9$/);
});

await step('notes tools via MCP', async () => {
  let r = await acctClient.callTool({ name: 'notiz_anlegen', arguments: { text: 'Bio-Referat fertig machen', faellig: D1 } });
  assert.match(text(r), /Aufgabe gespeichert/);
  r = await acctClient.callTool({ name: 'notiz_anlegen', arguments: { text: 'Pinsel kaufen', art: 'notiz' } });
  r = await acctClient.callTool({ name: 'notizen', arguments: {} });
  const t = text(r);
  assert.match(t, /\[ \] Bio-Referat fertig machen – fällig/);
  assert.match(t, /Pinsel kaufen/);
  const id = t.match(/Bio-Referat.*\(id (\d+)\)/)[1];
  r = await acctClient.callTool({ name: 'tagesplan', arguments: { datum: D1 } });
  assert.match(text(r), /Eigene offene Aufgaben bis zu diesem Tag/);
  r = await acctClient.callTool({ name: 'aufgabe_erledigt', arguments: { id } });
  assert.match(text(r), /als erledigt abgehakt/);
  r = await acctClient.callTool({ name: 'notizen', arguments: { art: 'alle' } });
  assert.match(text(r), /\[x\] Bio-Referat/);
  r = await client.callTool({ name: 'notizen', arguments: {} });
  assert.ok(r.isError && /nur mit einem ISGY-KI-Konto/.test(text(r)));
});

await step('extension: login + two-way note sync + session refresh', async () => {
  const api = (path, body, token) => fetch(BASE + '/api/ext/' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  let r = await api('login', { email: EMAIL, password: 'falsch!!' });
  assert.equal(r.status, 401);
  r = await api('login', { email: EMAIL, password: PW });
  const j = await r.json();
  assert.equal(j.email, 'max@example.org');
  extToken = j.token;
  // local notes: one new to-do, plus an edit of the AI's note, plus deleting the done task
  const server = (await (await api('sync', {}, extToken)).json()).notes;
  const memo = server.find((n) => n.type === 'note'), task = server.find((n) => n.type === 'todo');
  r = await api('sync', { notes: [
    { id: 1700000000000, type: 'todo', text: 'Mathe S. 42', date: '', done: false, updated: Date.now() },
    { ...memo, text: 'Pinsel + Farben kaufen', updated: Date.now() },
    { id: task.id, deleted: true, updated: Date.now() },
    { ...memo, text: 'veraltet', updated: 1 },
  ] }, extToken);
  const out = await r.json();
  assert.deepEqual(out.notes.map((n) => n.text).sort(), ['Mathe S. 42', 'Pinsel + Farben kaufen']);
  const t = text(await acctClient.callTool({ name: 'notizen', arguments: { art: 'alle' } }));
  assert.match(t, /Mathe S\. 42/);
  assert.ok(!/Bio-Referat/.test(t));
  // account uses a portal password → the extension's session is not stored over it
  r = await api('sync', { session: { c: { PHPSESSID: 'x'.repeat(20) }, s: 'y', k: 'AppKey123' } }, extToken);
  assert.equal((await r.json()).credKind, 'pw');
  assert.equal(dbState.accounts.values().next().value.cred_kind, 'pw');
  const page = await (await web('/konto')).text();
  assert.match(page, /Verbunden · zuletzt synchronisiert/);
  assert.match(page, /Mathe S\. 42/);
});

await step('extension session refresh for Office-365 accounts', async () => {
  const api = (path, body, token) => fetch(BASE + '/api/ext/' + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify(body) });
  await web('/konto/zugang-entfernen', {});
  assert.equal(dbState.accounts.values().next().value.cred, null);
  let r = await acctClient.callTool({ name: 'stundenplan', arguments: {} });
  assert.ok(r.isError && /noch kein isgy-intern-Zugang hinterlegt/.test(text(r)));
  r = await api('sync', { session: { c: { PHPSESSID: 'invalidsession123456' }, s: 'x', k: 'AppKey123' } }, extToken);
  assert.equal((await r.json()).session, 'ungültig');
  const login = await fetch('http://127.0.0.1:4100/index.php?page=login&authorize=1', { method: 'POST', body: (() => { const f = new FormData(); f.set('username', USER.username); f.set('password', USER.password); return f; })() });
  const sid = login.headers.getSetCookie()[0].match(/PHPSESSID=(\w+)/)[1];
  r = await api('sync', { session: { c: { PHPSESSID: sid }, s: sid, k: 'AppKey123' } }, extToken);
  assert.equal((await r.json()).session, 'gespeichert');
  r = await api('sync', { session: { c: { PHPSESSID: sid }, s: sid, k: 'AppKey123' } }, extToken);
  assert.equal((await r.json()).session, 'unverändert');
  r = await acctClient.callTool({ name: 'vertretungen', arguments: { datum: D1 } });
  assert.match(text(r), /ENTFÄLLT/);
});

await step('sign out everywhere → all account tokens stop working', async () => {
  await web('/konto/ueberall-abmelden', {});
  assert.equal(jar.c, ''); // cookie cleared
  const r = await fetch(MCP, { method: 'POST', headers: { authorization: 'Bearer ' + acctProv.s.tokens.access_token, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) });
  assert.equal(r.status, 401);
  const e = await fetch(BASE + '/api/ext/sync', { method: 'POST', headers: { authorization: 'Bearer ' + extToken, 'content-type': 'application/json' }, body: '{}' });
  assert.equal(e.status, 401);
  const rt = await fetch(BASE + '/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: acctProv.s.tokens.refresh_token, client_id: acctProv.s.client.client_id }) });
  assert.equal(rt.status, 400);
});

await step('delete account', async () => {
  let r = await web('/konto/anmelden', { email: EMAIL, password: PW });
  assert.equal(r.status, 303);
  r = await web('/konto/loeschen', {});
  assert.match(await r.text(), /Häkchen/);
  r = await web('/konto/loeschen', { confirm: '1' });
  assert.equal(r.status, 303);
  assert.equal(dbState.accounts.size, 0);
  assert.equal(dbState.notes.size, 0);
});

await step('home page', async () => {
  const r = await fetch(BASE + '/');
  assert.match(await r.text(), /http:\/\/localhost:3100\/mcp/);
});

server.close(); mock.close(); supa.close();
console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden.');
process.exit(failures ? 1 : 0);
