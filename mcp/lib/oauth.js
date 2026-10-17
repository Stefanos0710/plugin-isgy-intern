// OAuth 2.1 authorization server for the MCP endpoint (what Claude, ChatGPT and Gemini CLI expect):
// protected-resource + authorization-server metadata, dynamic client registration, authorize (login page) and token.
// Fully stateless: clients, codes and tokens are signed/encrypted strings (see crypto.js).
import { seal, unseal, sign, verify, clientSecretFor, safeEqual, sha256 } from './crypto.js';
import { Portal, AuthError, PortalError } from './portal.js';
import { AccountError, login as accountLogin, accountFor, webPayload } from './accounts.js';
import { DbError, dbEnabled } from './db.js';
import { authorizePage, errorPage, keyPage, keyResultPage } from './pages.js';

const ACCESS_TTL = 24 * 3600;
const REFRESH_TTL = 365 * 24 * 3600;
const CODE_TTL = 300;
export const KEY_DAYS = 180;

export const protectedResource = (origin) => ({
  resource: `${origin}/mcp`,
  authorization_servers: [origin],
  bearer_methods_supported: ['header'],
  scopes_supported: ['isgy'],
  resource_name: 'ISGY Intern',
  resource_documentation: origin,
});

export const authServer = (origin) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/authorize`,
  token_endpoint: `${origin}/token`,
  registration_endpoint: `${origin}/register`,
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
  scopes_supported: ['isgy'],
  service_documentation: origin,
});

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
function validRedirect(uri) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    return u.protocol === 'https:' || (u.protocol === 'http:' && LOOPBACK.has(u.hostname)) || !/^(https?|javascript|data|file|vbscript):$/.test(u.protocol);
  } catch { return false; }
}
// Loopback redirects may use any port (RFC 8252 §7.3).
function redirectAllowed(registered, uri) {
  if (registered.includes(uri)) return true;
  try {
    const u = new URL(uri);
    if (!LOOPBACK.has(u.hostname)) return false;
    return registered.some((r) => { const x = new URL(r); return LOOPBACK.has(x.hostname) && x.protocol === u.protocol && x.pathname === u.pathname; });
  } catch { return false; }
}

const oauthError = (error, error_description, status = 400) => ({ status, json: { error, error_description } });

// ---------- dynamic client registration (RFC 7591) ----------
export function register(body) {
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 10 || !uris.every(validRedirect)) return oauthError('invalid_redirect_uri', 'redirect_uris fehlen oder sind ungültig.');
  const method = ['client_secret_post', 'client_secret_basic'].includes(body.token_endpoint_auth_method) ? body.token_endpoint_auth_method : 'none';
  const name = String(body.client_name || '').slice(0, 80) || new URL(uris[0]).host || 'Unbekannte Anwendung';
  const client_id = sign({ r: uris, n: name, a: method === 'none' ? 0 : 1 });
  return {
    status: 201,
    json: {
      client_id,
      ...(method !== 'none' ? { client_secret: clientSecretFor(client_id), client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: method,
      scope: 'isgy',
    },
  };
}

// ---------- authorize ----------
function checkAuthorizeParams(q) {
  const client = verify(q.client_id || '');
  if (!client) return { fatal: 'Unbekannte Anwendung (client_id ungültig). Bitte die Verbindung im KI-Assistenten neu hinzufügen.' };
  if (!q.redirect_uri || !redirectAllowed(client.r, q.redirect_uri)) return { fatal: 'Die Weiterleitungsadresse dieser Anwendung ist nicht registriert.' };
  const back = (error, desc) => ({ redirect: withParams(q.redirect_uri, { error, error_description: desc, state: q.state }) });
  if (q.response_type !== 'code') return back('unsupported_response_type', 'Nur response_type=code wird unterstützt.');
  if (!q.code_challenge || (q.code_challenge_method && q.code_challenge_method !== 'S256')) return back('invalid_request', 'PKCE (S256) ist erforderlich.');
  return { client };
}

function withParams(uri, params) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
  return u.href;
}

const html = (status, body) => ({ status, html: body });

// What a token stands for: either the portal login itself ({cred}) or an account ({acc, tv}),
// whose stored login is looked up on every request (so an updated session from the extension is used right away).
const sessOf = (x) => (x?.acc ? { acc: x.acc, tv: x.tv } : x?.cred ? { cred: x.cred } : null);

async function webAccount(cookieHeader) {
  if (!dbEnabled()) return null;
  try { return await accountFor(webPayload(cookieHeader)); } catch { return null; }
}

export async function authorizeGet(q, cookieHeader) {
  const c = checkAuthorizeParams(q);
  if (c.fatal) return html(400, errorPage('Verbindung nicht möglich', c.fatal));
  if (c.redirect) return { status: 302, location: c.redirect };
  const req = seal('req', { client_id: q.client_id, redirect_uri: q.redirect_uri, state: q.state || '', code_challenge: q.code_challenge, scope: q.scope || 'isgy' }, 3600);
  const me = await webAccount(cookieHeader);
  return html(200, authorizePage({ client: c.client.n, redirectHost: new URL(q.redirect_uri).host, req, accounts: dbEnabled(), me: me?.email, mode: dbEnabled() ? 'acct' : 'pw' }));
}

// Turns the portal part of a login form into credentials and checks them against the portal.
export async function credentialsFromForm(form) {
  if (form.mode === 'code') {
    const raw = String(form.code || '').trim().replace(/\s+/g, '');
    let data = null;
    try { data = JSON.parse(Buffer.from(raw.replace(/^isgy1\./, ''), 'base64url').toString('utf8')); } catch {}
    if (!raw.startsWith('isgy1.') || !data || typeof data.c !== 'object') throw new AuthError('Das ist kein gültiger Verbindungscode. Bitte in der Erweiterung neu kopieren (Strg+K → „KI-Verbindungscode kopieren“).');
    const cred = sessionCred(data);
    const portal = new Portal(cred);
    try { await portal.stundenplan(); } catch (e) {
      if (e instanceof AuthError) throw new AuthError('Mit diesem Verbindungscode klappt die Anmeldung nicht (abgelaufen?). Bitte auf isgy-intern.de neu anmelden und den Code neu kopieren.');
      throw e;
    }
    return cred;
  }
  const u = String(form.username || '').trim(), p = String(form.password || '');
  if (!u || !p) throw new AuthError('Bitte Benutzername und Passwort eingeben.');
  const cred = { m: 'pw', u, p };
  await new Portal(cred).login();
  return cred;
}

// A browser session as the extension sends it: {c: cookies, s: localStorage session, k: app key}.
export function sessionCred(data) {
  const cookies = Object.fromEntries(Object.entries(data?.c || {}).filter(([k, v]) => /^[\w.\-]+$/.test(k) && typeof v === 'string' && v.length < 4096).slice(0, 30));
  return { m: 's', c: cookies, s: String(data?.s || '').slice(0, 512), k: String(data?.k || '').slice(0, 128) };
}

export const loginErrorText = (e) => (e instanceof AuthError || e instanceof PortalError || e instanceof AccountError || e instanceof DbError ? e.message : 'Unerwarteter Fehler bei der Anmeldung. Bitte später erneut versuchen.');

// Login form → token session. mode: acct (account e-mail/password), web (already signed in on this site), pw, code.
async function sessionFromForm(form, cookieHeader) {
  if (form.mode === 'web') {
    const acc = await webAccount(cookieHeader);
    if (!acc) throw new AccountError('Du bist nicht mehr angemeldet. Bitte erneut anmelden.');
    return { acc: acc.id, tv: acc.token_version };
  }
  if (form.mode === 'acct') {
    const a = await accountLogin(form.email, form.account_password);
    return { acc: a.id, tv: a.tv };
  }
  return { cred: await credentialsFromForm(form) };
}

export async function authorizePost(form, cookieHeader) {
  const r = unseal('req', form.req);
  if (!r) return html(400, errorPage('Sitzung abgelaufen', 'Die Anmeldeseite war zu lange offen. Bitte die Verbindung im KI-Assistenten erneut starten.'));
  const client = verify(r.client_id);
  if (!client) return html(400, errorPage('Verbindung nicht möglich', 'Unbekannte Anwendung.'));
  let sess;
  try {
    sess = await sessionFromForm(form, cookieHeader);
  } catch (e) {
    if (!(e instanceof AuthError || e instanceof PortalError || e instanceof AccountError || e instanceof DbError)) console.error('[authorize]', e);
    const me = form.mode === 'web' ? null : await webAccount(cookieHeader);
    return html(200, authorizePage({ client: client.n, redirectHost: new URL(r.redirect_uri).host, req: form.req, error: loginErrorText(e), accounts: dbEnabled(), me: me?.email,
      mode: ['code', 'pw', 'acct'].includes(form.mode) ? form.mode : 'acct', username: form.username, email: form.email }));
  }
  const code = seal('code', { ...sess, cid: r.client_id, ru: r.redirect_uri, cc: r.code_challenge, sc: r.scope }, CODE_TTL);
  return { status: 302, location: withParams(r.redirect_uri, { code, state: r.state }) };
}

// ---------- token ----------
function issue(sess, cid, scope = 'isgy') {
  return {
    access_token: seal('at', { ...sess, cid }, ACCESS_TTL),
    token_type: 'Bearer',
    expires_in: ACCESS_TTL,
    refresh_token: seal('rt', { ...sess, cid }, REFRESH_TTL),
    scope,
  };
}

function clientAuth(form, authHeader) {
  let id = form.client_id, secret = form.client_secret;
  const m = /^Basic\s+(.+)$/i.exec(authHeader || '');
  if (m) {
    const [a, b] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
    id = decodeURIComponent(a || ''); secret = decodeURIComponent(b || '');
  }
  const client = verify(id || '');
  if (!client) return { error: oauthError('invalid_client', 'Unbekannte client_id.', 401) };
  if (client.a && !(secret && safeEqual(secret, clientSecretFor(id)))) return { error: oauthError('invalid_client', 'client_secret fehlt oder ist falsch.', 401) };
  return { id, client };
}

export async function token(form, authHeader) {
  const ca = clientAuth(form, authHeader);
  if (ca.error) return ca.error;
  if (form.grant_type === 'authorization_code') {
    const c = unseal('code', form.code);
    if (!c) return oauthError('invalid_grant', 'Code ungültig oder abgelaufen.');
    if (c.cid !== ca.id) return oauthError('invalid_grant', 'Code gehört zu einer anderen Anwendung.');
    if (form.redirect_uri && form.redirect_uri !== c.ru) return oauthError('invalid_grant', 'redirect_uri passt nicht.');
    if (!form.code_verifier || sha256(form.code_verifier).toString('base64url') !== c.cc) return oauthError('invalid_grant', 'PKCE-Prüfung fehlgeschlagen.');
    return { status: 200, json: issue(sessOf(c), c.cid, c.sc) };
  }
  if (form.grant_type === 'refresh_token') {
    const r = unseal('rt', form.refresh_token);
    if (!r) return oauthError('invalid_grant', 'Refresh-Token ungültig oder abgelaufen.');
    if (r.cid !== ca.id) return oauthError('invalid_grant', 'Refresh-Token gehört zu einer anderen Anwendung.');
    // Account tokens die with the account or after "überall abmelden".
    if (r.acc && !(await accountFor(r))) return oauthError('invalid_grant', 'Konto gelöscht oder abgemeldet.');
    return { status: 200, json: issue(sessOf(r), r.cid) };
  }
  return oauthError('unsupported_grant_type', 'Nur authorization_code und refresh_token.');
}

// ---------- bearer check for /mcp ----------
// Returns {cred, acc} for a valid token, null otherwise. `acc` is the account row for account tokens.
export async function authFromBearer(authHeader) {
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader || '');
  if (!m) return null;
  const t = unseal('at', m[1]) || unseal('key', m[1]);
  if (!t) return null;
  if (t.acc) {
    const acc = await accountFor(t);
    return acc ? { acc, cred: null } : null;
  }
  return t.cred ? { cred: t.cred, acc: null } : null;
}

// ---------- personal access key (for clients without OAuth) ----------
export const keyGet = async (origin, cookieHeader) => html(200, keyPage({ origin, accounts: dbEnabled(), me: (await webAccount(cookieHeader))?.email, mode: dbEnabled() ? 'acct' : 'pw' }));
export async function keyPost(origin, form, cookieHeader) {
  try {
    const sess = await sessionFromForm(form, cookieHeader);
    return html(200, keyResultPage({ origin, key: seal('key', sess, KEY_DAYS * 86400), days: KEY_DAYS }));
  } catch (e) {
    if (!(e instanceof AuthError || e instanceof PortalError || e instanceof AccountError || e instanceof DbError)) console.error('[key]', e);
    return html(200, keyPage({ origin, error: loginErrorText(e), accounts: dbEnabled(), mode: ['code', 'pw', 'acct'].includes(form.mode) ? form.mode : 'acct', username: form.username, email: form.email }));
  }
}
