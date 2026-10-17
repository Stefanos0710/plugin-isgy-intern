// Talks to isgy-intern.de on behalf of one user. Mirrors what the browser extension does (src/content.js):
// stundenplan + tagebuch use the login cookies, vplan + klassenkalender additionally need the
// `auth-app` / `auth-session` headers.
//
// Two kinds of credentials (both only ever stored encrypted inside the user's OAuth token):
//   { m: 'pw', u, p }          portal username + password → the server logs in itself, and again when the session expires
//   { m: 's', c, s, k }        a browser session handed over from the extension (cookies, localStorage session, app key);
//                              needed for Office-365 accounts, which have no portal password
import { hashKey } from './crypto.js';

export const BASE = (process.env.ISGY_BASE_URL || 'https://www.isgy-intern.de').replace(/\/+$/, '');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 ISGY-Intern-MCP/1.0';
const KEY_RE = /(?:apiKey["']?\s*[:=]\s*|_widget_vplan_apiKey\s*=\s*)["']([0-9a-zA-Z]{6,})["']/;
const SESSION_RES = [
  /localStorage\.setItem\(\s*["']session["']\s*,\s*["'`](?:__q_strn\|)?([^"'`\s]{8,})["'`]/,
  /["']?(?:auth-session|authSession|session(?:Id|ID|_id|Key)?)["']?\s*[:=]\s*["'](?:__q_strn\|)?([A-Za-z0-9_\-]{16,})["']/,
];
const LOGIN_PAGE_RE = /window\.loginConfig\s*=/;

export class PortalError extends Error {}
// The stored login no longer works; the user has to reconnect.
export class AuthError extends PortalError {}

const parseSetCookie = (line) => {
  const [pair, ...attrs] = line.split(';');
  const i = pair.indexOf('=');
  if (i < 1) return null;
  const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
  const a = attrs.map((x) => x.trim().toLowerCase());
  const gone = !value || value === 'deleted' || a.some((x) => x === 'max-age=0' || (x.startsWith('expires=') && Date.parse(x.slice(8)) < Date.now()));
  return { name, value, gone };
};

// School-wide data shared by all users of a warm instance: app key and the Kürzel → name map.
const shared = { appKey: process.env.ISGY_APP_KEY || '', kuerzel: null, kuerzelAt: 0, kuerzelPromise: null };

export class Portal {
  constructor(cred) {
    this.cred = cred;
    this.jar = new Map(Object.entries(cred.m === 's' ? cred.c || {} : {}));
    this.loggedIn = cred.m === 's';
    this.session = cred.m === 's' ? cred.s || '' : '';
    this.appKey = cred.m === 's' ? cred.k || '' : '';
    this.cache = new Map();
    this.lastUsed = Date.now();
  }

  storeCookies(res) {
    for (const line of res.headers.getSetCookie?.() || []) {
      const c = parseSetCookie(line);
      if (!c) continue;
      if (c.gone) this.jar.delete(c.name);
      else this.jar.set(c.name, c.value);
    }
  }

  async raw(path, { method = 'GET', body, headers = {} } = {}) {
    let url = /^https?:/.test(path) ? path : `${BASE}/${path.replace(/^\/+/, '')}`;
    for (let hop = 0; hop < 6; hop++) {
      const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
      let res;
      try {
        res = await fetch(url, {
          method, body, redirect: 'manual', signal: AbortSignal.timeout(20000),
          headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9', ...(cookie ? { Cookie: cookie } : {}), ...headers },
        });
      } catch (e) {
        throw new PortalError(`isgy-intern.de ist gerade nicht erreichbar (${e.name === 'TimeoutError' ? 'Zeitüberschreitung' : e.message}).`);
      }
      this.storeCookies(res);
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        url = new URL(loc, url).href;
        if (new URL(url).origin !== new URL(BASE).origin) throw new AuthError('Die Sitzung ist abgelaufen (Weiterleitung zur Anmeldung).');
        if (res.status !== 307 && res.status !== 308) { method = 'GET'; body = undefined; }
        continue;
      }
      return res;
    }
    throw new PortalError('Zu viele Weiterleitungen von isgy-intern.de.');
  }

  // Portal login, same request the login page makes. Throws AuthError with the portal's own message.
  async login() {
    if (this.cred.m !== 'pw') throw new AuthError('Die übernommene Browser-Sitzung ist abgelaufen.');
    this.jar.clear();
    this.session = '';
    this.appKey = '';
    this.cache.clear();
    await this.raw('index.php'); // picks up the session cookie the form is posted with
    const fd = new FormData();
    fd.set('username', this.cred.u);
    fd.set('password', this.cred.p);
    fd.set('keepLogin', '1');
    const res = await this.raw('index.php?page=login&authorize=1', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new PortalError(`Anmeldung fehlgeschlagen: Server antwortet mit ${res.status}.`);
    let data;
    try { data = JSON.parse(await res.text()); } catch { throw new PortalError('Anmeldung fehlgeschlagen: unerwartete Antwort von isgy-intern.de.'); }
    if (!data.success) {
      const msg = String(data.errorMessage || 'Benutzername oder Passwort sind nicht korrekt.').replace(/<[^>]+>/g, '').trim();
      throw new AuthError(data.captchaHTML
        ? `${msg} Das Portal verlangt jetzt eine Rechenaufgabe (zu viele Fehlversuche). Bitte melde dich einmal normal im Browser auf isgy-intern.de an und versuche es danach erneut.`
        : msg);
    }
    this.loggedIn = true;
  }

  async ready() {
    if (!this.loggedIn) await this.login();
    this.lastUsed = Date.now();
  }

  // Runs fn; if the portal says the session is gone and we have a password, log in again once and retry.
  async withRelogin(fn) {
    await this.ready();
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof AuthError) || this.cred.m !== 'pw') throw e;
      this.loggedIn = false;
      await this.login();
      return fn();
    }
  }

  async html(path) {
    const res = await this.raw(path);
    const text = await res.text();
    if (LOGIN_PAGE_RE.test(text)) throw new AuthError('Die Sitzung ist abgelaufen.');
    return text;
  }

  async apiKey() {
    if (this.appKey) return this.appKey;
    if (shared.appKey) return (this.appKey = shared.appKey);
    for (const page of ['index.php?page=ext_klassenkalender', 'index.php?page=ext_vplan', 'index.php']) {
      const html = await this.html(page);
      this.scanForSession(html);
      const m = html.match(KEY_RE);
      if (m) return (this.appKey = shared.appKey = m[1]);
    }
    throw new PortalError('Der App-Schlüssel von isgy-intern.de wurde nicht gefunden.');
  }

  scanForSession(html) {
    if (this.sessionCandidates) for (const re of SESSION_RES) {
      const m = html.match(re);
      if (m && !this.sessionCandidates.includes(m[1])) this.sessionCandidates.unshift(m[1]);
    }
  }

  // The `auth-session` header value. The extension reads it from localStorage; with a password login we look for it
  // in the pages and fall back to the session cookies, keeping the first value the vplan endpoint accepts.
  async sessionToken() {
    if (this.session) return this.session;
    this.sessionCandidates = [];
    const key = await this.apiKey();
    for (const page of ['index.php', 'index.php?page=ext_vplan']) this.scanForSession(await this.html(page));
    for (const [, v] of this.jar) if (v.length >= 16 && !this.sessionCandidates.includes(v)) this.sessionCandidates.push(v);
    for (const s of this.sessionCandidates.slice(0, 8)) {
      const res = await this.raw('rest.php/vplan/getList', { headers: { 'auth-app': key, 'auth-session': s, Accept: 'application/json' } });
      await res.arrayBuffer();
      if (res.ok) return (this.session = s);
    }
    throw new PortalError('Vertretungsplan und Klassenkalender sind mit dieser Anmeldung nicht abrufbar. Verbinde dich stattdessen mit dem Verbindungscode aus der Erweiterung „ISGY Intern Plus“.');
  }

  async authHeaders() {
    return { 'auth-app': await this.apiKey(), 'auth-session': await this.sessionToken() };
  }

  // JSON from rest.php. `auth` adds the app/session headers (vplan, klassenkalender).
  async json(path, { method = 'GET', form, auth = false, ttl = 0 } = {}) {
    const ck = `${method} ${path} ${form ? new URLSearchParams(form).toString() : ''}`;
    const hit = this.cache.get(ck);
    if (ttl && hit && Date.now() - hit.t < ttl * 1000) return hit.v;
    const v = await this.withRelogin(async () => {
      let body;
      if (form) { body = new FormData(); for (const [k, x] of Object.entries(form)) body.set(k, String(x)); }
      else if (method === 'POST') body = new FormData();
      const headers = { Accept: 'application/json', ...(auth ? await this.authHeaders() : {}) };
      const res = await this.raw(path, { method, body, headers });
      const text = await res.text();
      if (res.status === 401 || res.status === 403 || LOGIN_PAGE_RE.test(text)) {
        if (auth && this.cred.m === 'pw') this.session = '';
        let detail = '';
        try { detail = JSON.parse(text).errorText || ''; } catch {}
        throw new AuthError(`Kein Zugriff (${res.status}${detail ? ': ' + String(detail).trim() : ''}). Die Sitzung ist vermutlich abgelaufen.`);
      }
      if (!res.ok) throw new PortalError(`isgy-intern.de antwortet mit Fehler ${res.status} (${path.split('?')[0]}).`);
      try { return JSON.parse(text); } catch { throw new PortalError(`Unerwartete Antwort von isgy-intern.de (${path.split('?')[0]}).`); }
    });
    if (ttl) this.cache.set(ck, { t: Date.now(), v });
    return v;
  }

  // ---------- endpoints ----------
  stundenplan() { return this.json('rest.php/stundenplan/getStundenplan', { method: 'POST', ttl: 600 }); }

  async tagebuch(ds, ttl = 600) {
    const j = await this.json(`rest.php/tagebuch/getList/${ds}`, { ttl });
    return j?.data?.entries || [];
  }

  async vplan() {
    const j = await this.json('rest.php/vplan/getList', { auth: true, ttl: 300 });
    return Object.values(j || {}).flatMap((x) => (x && Array.isArray(x.data) ? x.data : []));
  }

  async kalender(cls) {
    const kals = await this.json('rest.php/klassenkalender/getKalenders', { auth: true, ttl: 3600 });
    const list = Array.isArray(kals) ? kals : [];
    const ids = list.filter((k) => k.title === cls || k.preSelect).map((k) => k.id);
    if (!ids.length) return { kalender: list, events: [] };
    const ev = await this.json('rest.php/klassenkalender/getEvents', { method: 'POST', form: { kalenders: ids.join(',') }, auth: true, ttl: 600 });
    return { kalender: list.filter((k) => ids.includes(k.id)), events: Array.isArray(ev) ? ev : [] };
  }

  // Kürzel → name map from the school's PDF (parsed in memory, never stored), shared for 12 h.
  async kuerzel() {
    if (shared.kuerzel && Date.now() - shared.kuerzelAt < 12 * 36e5) return shared.kuerzel;
    shared.kuerzelPromise ??= this.withRelogin(() => loadKuerzel(this)).then((map) => {
      shared.kuerzel = map; shared.kuerzelAt = Date.now(); return map;
    }).finally(() => { shared.kuerzelPromise = null; });
    return shared.kuerzelPromise;
  }

  // Never fails: without the list, codes are shown as they are.
  async kuerzelSafe() {
    try { return await this.kuerzel(); } catch (e) { console.warn('[kuerzel]', e.message); return shared.kuerzel || {}; }
  }
}

// ---------- Kürzel PDF (same parsing as the extension) ----------
const DEFAULT_PDF = 'index.php?page=ext_downloads&view=default&task=download&id=80&file=K%C3%BCrzel-%20und%20E-Mail-Liste%20ab%2010.08.2026.pdf';

function parseKuerzelPage(items) {
  const head = Object.fromEntries(items.filter((i) => /^(Kürzel|Person|Tätigkeit)$/.test(i.str.trim())).map((i) => [i.str.trim(), i.transform[4]]));
  const nameFrom = (head.Person ?? 76) - 10, nameTo = (head['Tätigkeit'] ?? 236) - 5;
  const rows = {};
  for (const i of items) {
    if (!i.str.trim()) continue;
    const y = Math.round(i.transform[5]), x = i.transform[4];
    const r = (rows[y] ??= { k: '', n: '' });
    if (x < nameFrom) r.k += i.str;
    else if (x < nameTo) r.n += i.str;
  }
  return Object.values(rows);
}
function rowsToMap(rows) {
  const map = {};
  for (const { k, n } of rows) if (/^[A-ZÄÖÜ][a-zäöüß]{0,2}$/.test(k.trim()) && n.trim()) map[k.trim()] = n.trim().replace(/\s+/g, ' ');
  return map;
}

async function fetchPdf(portal, path) {
  const res = await portal.raw(path);
  const buf = new Uint8Array(await res.arrayBuffer());
  const isPdf = (res.headers.get('content-type') || '').includes('pdf') || Buffer.from(buf.subarray(0, 5)).toString() === '%PDF-';
  if (res.ok && isPdf) return buf;
  if (LOGIN_PAGE_RE.test(Buffer.from(buf).toString('utf8'))) throw new AuthError('Die Sitzung ist abgelaufen.');
  return null;
}

// pdf.js needs DOMMatrix in Node and gets it from @napi-rs/canvas via a require() that Vercel's bundler can't see,
// so load it here explicitly. The worker runs on the main thread (no worker file lookup at runtime).
export async function loadPdfjs() {
  if (!globalThis.DOMMatrix) {
    const canvas = await import('@napi-rs/canvas');
    globalThis.DOMMatrix = canvas.DOMMatrix;
    globalThis.ImageData ??= canvas.ImageData;
    globalThis.Path2D ??= canvas.Path2D;
  }
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  globalThis.pdfjsWorker ??= await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  return pdfjs;
}

async function loadKuerzel(portal) {
  let data = await fetchPdf(portal, process.env.ISGY_KUERZEL_PDF || DEFAULT_PDF);
  if (!data) {
    // The file name changes every school year: look for the current list on the downloads page.
    const html = await portal.html('index.php?page=ext_downloads&view=default');
    const links = [...html.matchAll(/(?:href=|["'])([^"'\s>]*task=download[^"'\s>]*)/g)].map((m) => m[1].replace(/&amp;/g, '&'));
    const link = links.find((l) => /k(%C3%BC|ü|ue)rzel/i.test(decodeURIComponent(l)) || /k(%C3%BC|ü|ue)rzel/i.test(l));
    if (link) data = await fetchPdf(portal, link);
  }
  if (!data) throw new PortalError('Kürzel-PDF nicht gefunden.');
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  const rows = [];
  for (let p = 1; p <= doc.numPages; p++) rows.push(...parseKuerzelPage((await (await doc.getPage(p)).getTextContent()).items));
  await doc.destroy();
  const map = rowsToMap(rows);
  if (Object.keys(map).length < 5) throw new PortalError('Kürzel-PDF konnte nicht gelesen werden.');
  return map;
}

// ---------- per-user instances, reused while the function instance is warm ----------
const POOL = new Map();
export function portalFor(cred) {
  const id = hashKey(JSON.stringify(cred));
  let p = POOL.get(id);
  if (!p || Date.now() - p.lastUsed > 30 * 60e3) {
    p = new Portal(cred);
    POOL.set(id, p);
    if (POOL.size > 300) for (const [k, v] of POOL) if (Date.now() - v.lastUsed > 10 * 60e3 || POOL.size > 300) POOL.delete(k);
  }
  return p;
}
