// Single Vercel function; vercel.json rewrites every path here. Also used by dev-server.mjs.
import { handleRpc } from '../lib/mcp.js';
import { protectedResource, authServer, register, authorizeGet, authorizePost, token, credFromBearer, keyGet, keyPost } from '../lib/oauth.js';
import { homePage, errorPage } from '../lib/pages.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};
const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
};

function origin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http')).split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host).split(',')[0].trim();
  return `${proto}://${host}`;
}

async function readBody(req) {
  // Vercel's Node runtime already parses JSON and form bodies into req.body.
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return parse(req, req.body.toString('utf8'));
    return typeof req.body === 'string' ? parse(req, req.body) : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 1e6) throw new Error('Body zu groß'); chunks.push(c); }
  return parse(req, Buffer.concat(chunks).toString('utf8'));
}
function parse(req, text) {
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  if (!text) return {};
  try { return JSON.parse(text); } catch { return type.includes('json') ? Symbol.for('bad-json') : Object.fromEntries(new URLSearchParams(text)); }
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries({ ...CORS, ...headers })) res.setHeader(k, v);
  if (body === null || body === undefined) return res.end();
  if (typeof body === 'string') return res.end(body);
  if (!headers['Content-Type']) res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
const sendResult = (res, r) => {
  if (r.location) return send(res, r.status, null, { Location: r.location, 'Cache-Control': 'no-store' });
  if (r.html) return send(res, r.status, r.html, PAGE_HEADERS);
  return send(res, r.status, r.json, { 'Cache-Control': 'no-store', Pragma: 'no-cache' });
};

export default async function handler(req, res) {
  const o = origin(req);
  const url = new URL(req.url, o);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const q = Object.fromEntries(url.searchParams);
  const m = req.method;
  try {
    if (m === 'OPTIONS') return send(res, 204, null);

    // ----- MCP endpoint -----
    if (path === '/mcp' || path === '/sse') {
      const cred = credFromBearer(req.headers.authorization);
      if (!cred) {
        return send(res, 401, { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Anmeldung erforderlich' } }, {
          'WWW-Authenticate': `Bearer realm="isgy-intern", resource_metadata="${o}/.well-known/oauth-protected-resource", scope="isgy"`,
        });
      }
      if (m === 'GET' || m === 'DELETE') return send(res, 405, null, { Allow: 'POST' });
      if (m !== 'POST') return send(res, 405, null, { Allow: 'POST' });
      const body = await readBody(req);
      if (typeof body === 'symbol') return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      const [status, out] = await handleRpc(body, cred);
      return send(res, status, out);
    }

    // ----- OAuth metadata (also the path-suffixed variants some clients try) -----
    if (path.startsWith('/.well-known/oauth-protected-resource')) return send(res, 200, protectedResource(o), { 'Cache-Control': 'public, max-age=3600' });
    if (path.startsWith('/.well-known/oauth-authorization-server') || path.startsWith('/.well-known/openid-configuration')) return send(res, 200, authServer(o), { 'Cache-Control': 'public, max-age=3600' });

    if (path === '/register' && m === 'POST') return sendResult(res, register(await readBody(req)));
    if (path === '/authorize' && m === 'GET') return sendResult(res, authorizeGet(q));
    if (path === '/authorize' && m === 'POST') return sendResult(res, await authorizePost(await readBody(req)));
    if (path === '/token' && m === 'POST') {
      const body = await readBody(req);
      return sendResult(res, token(typeof body === 'object' ? body : {}, req.headers.authorization));
    }

    if (path === '/schluessel' && m === 'GET') return sendResult(res, keyGet(o));
    if (path === '/schluessel' && m === 'POST') return sendResult(res, await keyPost(o, await readBody(req)));

    if (path === '/' && m === 'GET') return send(res, 200, homePage(o), PAGE_HEADERS);
    if (path === '/health') return send(res, 200, { ok: true });
    if (path === '/favicon.ico') return send(res, 204, null);
    return send(res, 404, errorPage('Nicht gefunden', 'Diese Seite gibt es nicht.'), PAGE_HEADERS);
  } catch (e) {
    console.error('[handler]', path, e);
    if (path === '/mcp') return send(res, 500, { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Interner Serverfehler' } });
    return send(res, 500, errorPage('Serverfehler', e.message?.startsWith('MCP_SECRET') ? e.message : 'Unerwarteter Fehler.'), PAGE_HEADERS);
  }
}
