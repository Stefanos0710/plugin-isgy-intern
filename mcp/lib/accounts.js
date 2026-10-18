// Accounts: e-mail + password (scrypt), the isgy-intern login stored AES-GCM-encrypted in Supabase,
// and the stateless tokens that point at an account (web cookie, extension token, OAuth tokens).
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { seal, unseal } from './crypto.js';
import { db, DbError } from './db.js';

export class AccountError extends Error {}

const SCRYPT = { N: 16384, r: 8, p: 1, len: 32 };
const kdf = (pw, salt, o = SCRYPT) => new Promise((ok, fail) => scrypt(pw, salt, o.len, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? fail(e) : ok(k))));

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await kdf(pw, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function checkPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(hash, 'base64url');
  const got = await kdf(pw, Buffer.from(salt, 'base64url'), { N: +N, r: +r, p: +p, len: want.length });
  return timingSafeEqual(got, want);
}

export const normEmail = (e) => String(e || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function register(email, pw, pw2) {
  email = normEmail(email);
  if (!EMAIL_RE.test(email) || email.length > 200) throw new AccountError('Bitte eine gültige E-Mail-Adresse eingeben.');
  if (String(pw || '').length < 8) throw new AccountError('Das Passwort muss mindestens 8 Zeichen lang sein.');
  if (pw2 !== undefined && pw !== pw2) throw new AccountError('Die beiden Passwörter stimmen nicht überein.');
  try {
    const id = await db.createAccount(email, await hashPassword(pw));
    return { id, tv: 1 };
  } catch (e) {
    if (e instanceof DbError && e.message === 'email_taken') throw new AccountError('Für diese E-Mail-Adresse gibt es schon ein Konto. Bitte anmelden.');
    throw e;
  }
}

const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export async function login(email, pw) {
  const row = await db.accountByEmail(normEmail(email));
  // Same work for unknown addresses, so the response time doesn't reveal which e-mails have accounts.
  const ok = await checkPassword(String(pw || ''), row?.pw_hash || DUMMY);
  if (!row || !ok) throw new AccountError('E-Mail-Adresse oder Passwort ist falsch.');
  return { id: row.id, tv: row.token_version };
}

// Short cache so one MCP request doesn't hit the database several times.
const CACHE = new Map();
export async function loadAccount(id, { fresh = false } = {}) {
  const hit = CACHE.get(id);
  if (!fresh && hit && Date.now() - hit.t < 30e3) return hit.acc;
  const acc = await db.account(id);
  CACHE.set(id, { t: Date.now(), acc });
  if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value);
  return acc;
}
export const forget = (id) => CACHE.delete(id);

// A token payload {acc, tv} is valid while the account exists and nobody pressed "überall abmelden".
export async function accountFor(payload) {
  if (!payload?.acc) return null;
  const acc = await loadAccount(payload.acc);
  return acc && acc.token_version === payload.tv ? acc : null;
}

export const credOf = (acc) => (acc?.cred ? unseal('cred', acc.cred)?.cred || null : null);
export async function saveCred(id, cred) {
  await db.updateAccount(id, cred ? { cred: seal('cred', { cred }), cred_kind: cred.m } : { cred: null, cred_kind: null });
  forget(id);
}

export const WEB_DAYS = 30;
export const webToken = (acc) => seal('web', { acc: acc.id, tv: acc.tv ?? acc.token_version }, WEB_DAYS * 86400);
export const webPayload = (cookieHeader) => {
  const m = /(?:^|;\s*)isgy_s=([^;]+)/.exec(cookieHeader || '');
  return m ? unseal('web', m[1]) : null;
};
export const EXT_DAYS = 365;
export const extToken = (acc) => seal('ext', { acc: acc.id, tv: acc.tv ?? acc.token_version }, EXT_DAYS * 86400);
export const extPayload = (authHeader) => {
  const m = /^Bearer\s+(\S+)$/i.exec(authHeader || '');
  return m ? unseal('ext', m[1]) : null;
};
