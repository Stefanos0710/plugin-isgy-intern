// Supabase access. The tables are in a schema the Data API doesn't expose; the server calls security-definer
// functions (supabase/0001_accounts_notes.sql) that check SUPABASE_API_SECRET. No dependency, just PostgREST RPC.
export class DbError extends Error {}

const cfg = () => ({ url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), key: process.env.SUPABASE_KEY, secret: process.env.SUPABASE_API_SECRET });
export const dbEnabled = () => { const c = cfg(); return !!(c.url && c.key && c.secret); };

async function rpc(fn, args) {
  const c = cfg();
  if (!dbEnabled()) throw new DbError('Konten sind auf diesem Server nicht eingerichtet.');
  let res;
  try {
    res = await fetch(`${c.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: c.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_secret: c.secret, ...args }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new DbError(`Datenbank nicht erreichbar (${e.message}).`);
  }
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = body?.message || text || String(res.status);
    if (/email_taken/.test(msg)) throw new DbError('email_taken');
    console.error('[db]', fn, res.status, msg);
    throw new DbError(res.status === 404 && /function/i.test(msg) ? 'Die Datenbank ist noch nicht eingerichtet.' : 'Datenbankfehler.');
  }
  return body;
}

const one = (rows) => (Array.isArray(rows) ? rows[0] || null : rows);

export const db = {
  createAccount: (email, pwHash) => rpc('api_account_create', { p_email: email, p_pw_hash: pwHash }),
  accountByEmail: async (email) => one(await rpc('api_account_by_email', { p_email: email })),
  account: async (id) => one(await rpc('api_account_get', { p_id: id })),
  updateAccount: (id, patch) => rpc('api_account_update', { p_id: id, p_patch: patch }),
  deleteAccount: (id) => rpc('api_account_delete', { p_id: id }),
  notes: (id) => rpc('api_notes_list', { p_id: id }),
  upsertNotes: (id, notes) => rpc('api_notes_upsert', { p_id: id, p_notes: notes }),
};
