// Account pages (/konto…) and the extension API (/api/ext/…).
import { register, login, accountFor, loadAccount, forget, credOf, saveCred, webToken, webPayload, extToken, extPayload, AccountError, WEB_DAYS } from './accounts.js';
import { db, DbError, dbEnabled } from './db.js';
import { credentialsFromForm, sessionCred, loginErrorText } from './oauth.js';
import { Portal, AuthError, PortalError } from './portal.js';
import { accountAuthPage, accountPage, errorPage } from './pages.js';

const html = (status, body, extra = {}) => ({ status, html: body, ...extra });
const json = (status, body) => ({ status, json: body });
const redirect = (location, extra = {}) => ({ status: 303, location, ...extra });

const cookie = (origin, value, maxAge) => `isgy_s=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${origin.startsWith('https:') ? '; Secure' : ''}`;
const signIn = (origin, acc) => cookie(origin, webToken(acc), WEB_DAYS * 86400);
const signOut = (origin) => cookie(origin, '', 0);
// Only same-site paths that belong to the login flows may be used as "next".
const safeNext = (n) => (/^\/(authorize|schluessel)(\?|$)/.test(String(n || '')) ? String(n) : '');

const known = (e) => e instanceof AccountError || e instanceof DbError || e instanceof AuthError || e instanceof PortalError;
const logUnknown = (where, e) => { if (!known(e)) console.error(`[${where}]`, e); };

async function me(cookieHeader) {
  try { return await accountFor(webPayload(cookieHeader)); } catch { return null; }
}

async function dashboard(origin, acc, extra = {}) {
  let notes = [];
  try { notes = await db.notes(acc.id); } catch (e) { logUnknown('notes', e); }
  return html(200, accountPage({ origin, acc, cred: credOf(acc), notes, ...extra }));
}

export async function kontoGet(origin, q, cookieHeader) {
  if (!dbEnabled()) return html(503, errorPage('Konten nicht verfügbar', 'Auf diesem Server sind keine Konten eingerichtet.'));
  const acc = await me(cookieHeader);
  if (!acc) return html(200, accountAuthPage({ register: !!q.neu, next: safeNext(q.next) }));
  return dashboard(origin, acc, { message: q.ok === 'zugang' ? 'isgy-intern-Zugang gespeichert.' : q.ok === 'neu' ? 'Konto erstellt. Hinterlege jetzt deinen isgy-intern-Zugang oder verbinde die Erweiterung.' : '' });
}

export async function kontoPost(origin, action, form, cookieHeader) {
  if (!dbEnabled()) return html(503, errorPage('Konten nicht verfügbar', 'Auf diesem Server sind keine Konten eingerichtet.'));
  const next = safeNext(form.next);

  if (action === 'anmelden' || action === 'registrieren') {
    try {
      const a = action === 'anmelden' ? await login(form.email, form.password) : await register(form.email, form.password, form.password2);
      return redirect(next || (action === 'registrieren' ? '/konto?ok=neu' : '/konto'), { cookie: signIn(origin, a) });
    } catch (e) {
      logUnknown('konto', e);
      return html(200, accountAuthPage({ register: action === 'registrieren', email: form.email, next, error: loginErrorText(e) }));
    }
  }

  const acc = await me(cookieHeader);
  if (!acc) return redirect('/konto');
  switch (action) {
    case 'abmelden':
      return redirect('/', { cookie: signOut(origin) });
    case 'zugang':
      try {
        await saveCred(acc.id, await credentialsFromForm(form));
        return redirect('/konto?ok=zugang');
      } catch (e) {
        logUnknown('zugang', e);
        return dashboard(origin, await loadAccount(acc.id, { fresh: true }), { error: loginErrorText(e), mode: form.mode });
      }
    case 'zugang-entfernen':
      await saveCred(acc.id, null);
      return redirect('/konto');
    case 'ueberall-abmelden':
      await db.updateAccount(acc.id, { bump: true });
      forget(acc.id);
      return redirect('/konto', { cookie: signOut(origin) });
    case 'loeschen':
      if (form.confirm !== '1') return dashboard(origin, acc, { error: 'Bitte das Häkchen setzen, um das Konto zu löschen.' });
      await db.deleteAccount(acc.id);
      forget(acc.id);
      return redirect('/?geloescht=1', { cookie: signOut(origin) });
    default:
      return html(404, errorPage('Nicht gefunden', 'Diese Seite gibt es nicht.'));
  }
}

// ---------- extension API ----------
const NOTE_FIELDS = (n) => ({
  id: Number(n.id), type: n.type === 'note' ? 'note' : 'todo', text: String(n.text ?? '').slice(0, 5000),
  date: /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? n.date : null, done: !!n.done, deleted: !!n.deleted,
  updated: Number(n.updated) || 0, source: 'ext',
});

export async function extApi(action, body, authHeader) {
  if (!dbEnabled()) return json(503, { error: 'Konten sind auf diesem Server nicht eingerichtet.' });
  if (action === 'login') {
    try {
      const a = await login(body?.email, body?.password);
      const acc = await loadAccount(a.id, { fresh: true });
      return json(200, { token: extToken(acc), email: acc.email });
    } catch (e) {
      logUnknown('ext-login', e);
      return json(e instanceof AccountError ? 401 : 500, { error: loginErrorText(e) });
    }
  }
  const acc = await accountFor(extPayload(authHeader));
  if (!acc) return json(401, { error: 'Nicht (mehr) angemeldet. Bitte in den Einstellungen der Erweiterung neu anmelden.' });

  if (action === 'sync') {
    const out = { email: acc.email };
    // Fresh browser session → store it, unless the account uses a portal password (that one re-logs in by itself).
    if (body?.session && acc.cred_kind !== 'pw') {
      const cred = sessionCred(body.session);
      if (Object.keys(cred.c).length || cred.s) {
        if (JSON.stringify(credOf(acc)) === JSON.stringify(cred)) out.session = 'unverändert';
        else {
          try {
            await new Portal(cred).stundenplan();
            await saveCred(acc.id, cred);
            out.session = 'gespeichert';
          } catch (e) {
            logUnknown('ext-session', e);
            out.session = e instanceof AuthError ? 'ungültig' : 'fehler';
          }
        }
      }
    }
    try {
      const notes = Array.isArray(body?.notes) ? body.notes.slice(0, 1000).map(NOTE_FIELDS).filter((n) => Number.isSafeInteger(n.id) && n.id > 0) : null;
      out.notes = notes?.length ? await db.upsertNotes(acc.id, notes) : await db.notes(acc.id);
      await db.updateAccount(acc.id, { ext_seen: true });
    } catch (e) {
      logUnknown('ext-sync', e);
      return json(500, { error: loginErrorText(e) });
    }
    out.credKind = (await loadAccount(acc.id, { fresh: true }))?.cred_kind || null;
    return json(200, out);
  }
  return json(404, { error: 'Unbekannte Aktion.' });
}
