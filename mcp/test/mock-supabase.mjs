// Fake Supabase PostgREST for tests: implements the RPC functions of supabase/0001_accounts_notes.sql in memory.
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

export const API_SECRET = 'test-db-secret';
export const KEY = 'sb_publishable_test';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const SECRET_SHA = sha(API_SECRET);

export const state = { accounts: new Map(), notes: new Map(), calls: [] };
const err = (res, status, message) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ code: 'P0001', message })); };
const ok = (res, body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const visible = (id) => [...(state.notes.get(id) || new Map()).values()].filter((n) => !n.deleted).sort((a, b) => a.id - b.id)
  .map(({ id, type, text, date, done, updated, source }) => ({ id, type, text, date, done, updated, source }));

const fns = {
  api_account_create({ p_email, p_pw_hash }) {
    const email = p_email.trim().toLowerCase();
    if ([...state.accounts.values()].some((a) => a.email === email)) throw Object.assign(new Error('email_taken'), { status: 409 });
    const id = randomUUID();
    state.accounts.set(id, { id, email, pw_hash: p_pw_hash, cred: null, cred_kind: null, cred_updated: null, token_version: 1, ext_seen: null, created_at: new Date().toISOString() });
    return id;
  },
  api_account_by_email({ p_email }) {
    const a = [...state.accounts.values()].find((x) => x.email === p_email.trim().toLowerCase());
    return a ? [{ id: a.id, pw_hash: a.pw_hash, token_version: a.token_version }] : [];
  },
  api_account_get({ p_id }) {
    const a = state.accounts.get(p_id);
    if (!a) return [];
    const ns = visible(p_id);
    return [{ ...a, todos_open: ns.filter((n) => n.type === 'todo' && !n.done).length, notes_total: ns.length }];
  },
  api_account_update({ p_id, p_patch }) {
    const a = state.accounts.get(p_id);
    if (!a) return;
    if ('cred' in p_patch) { a.cred = p_patch.cred; a.cred_kind = p_patch.cred_kind; a.cred_updated = new Date().toISOString(); }
    if (p_patch.pw_hash) a.pw_hash = p_patch.pw_hash;
    if ('bump' in p_patch) a.token_version++;
    if ('ext_seen' in p_patch) a.ext_seen = new Date().toISOString();
  },
  api_account_delete({ p_id }) { state.accounts.delete(p_id); state.notes.delete(p_id); },
  api_notes_list({ p_id }) { return visible(p_id); },
  api_notes_upsert({ p_id, p_notes }) {
    if (!state.accounts.has(p_id)) throw Object.assign(new Error('fk'), { status: 409 });
    const m = state.notes.get(p_id) || new Map();
    state.notes.set(p_id, m);
    for (const n of p_notes) {
      if (!/^\d{1,18}$/.test(String(n.id))) continue;
      const row = { id: Number(n.id), type: n.type === 'note' ? 'note' : 'todo', text: String(n.text ?? '').slice(0, 5000), date: /^\d{4}-\d{2}-\d{2}$/.test(n.date || '') ? n.date : null,
        done: !!n.done, deleted: !!n.deleted, updated: Number(n.updated) || 0, source: n.source ?? null };
      const cur = m.get(row.id);
      if (!cur) m.set(row.id, row);
      else if (row.updated > cur.updated) m.set(row.id, { ...row, source: row.source ?? cur.source });
    }
    return visible(p_id);
  },
};

export function startSupabase(port) {
  const srv = createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const m = /^\/rest\/v1\/rpc\/(\w+)$/.exec(req.url);
    if (req.method !== 'POST' || !m) return err(res, 404, 'not found');
    if (req.headers.apikey !== KEY) return err(res, 401, 'Invalid API key');
    const fn = fns[m[1]];
    if (!fn) return err(res, 404, `Could not find the function public.${m[1]}`);
    const args = JSON.parse(body || '{}');
    if (!args.p_secret || sha(args.p_secret) !== SECRET_SHA) return err(res, 401, 'unauthorized');
    state.calls.push(m[1]);
    try { ok(res, fn(args)); } catch (e) { err(res, e.status || 400, e.message); }
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
