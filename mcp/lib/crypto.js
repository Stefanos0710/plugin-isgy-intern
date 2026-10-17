// Stateless tokens: everything the server needs (portal credentials, OAuth codes, client registrations)
// lives inside encrypted (AES-256-GCM) or signed (HMAC) strings, so no database is needed.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

let KEY = null;
function key() {
  if (KEY) return KEY;
  const secret = process.env.MCP_SECRET;
  if (!secret || secret.length < 32) throw new Error('MCP_SECRET fehlt oder ist zu kurz (mindestens 32 Zeichen).');
  KEY = createHash('sha256').update(secret).digest();
  return KEY;
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

// Encrypt a JSON payload. `typ` is bound into the ciphertext so a code can't be used as a token and vice versa.
export function seal(typ, payload, ttlSeconds) {
  const body = { ...payload, typ, exp: ttlSeconds ? Math.floor(Date.now() / 1000) + ttlSeconds : undefined };
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  c.setAAD(Buffer.from(typ));
  const enc = Buffer.concat([c.update(JSON.stringify(body), 'utf8'), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), enc]));
}

// Returns the payload, or null if the string was tampered with, has the wrong type or is expired.
export function unseal(typ, str) {
  try {
    const raw = Buffer.from(String(str), 'base64url');
    if (raw.length < 29) return null;
    const d = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAAD(Buffer.from(typ));
    d.setAuthTag(raw.subarray(12, 28));
    const body = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
    if (body.typ !== typ) return null;
    if (body.exp && body.exp < Date.now() / 1000) return null;
    return body;
  } catch {
    return null;
  }
}

const mac = (data) => createHmac('sha256', key()).update(data).digest();

// Signed (not secret) value, used for client_id so the registered redirect URIs travel with it.
export function sign(payload) {
  const data = b64u(JSON.stringify(payload));
  return `${data}.${b64u(mac(data).subarray(0, 18))}`;
}
export function verify(str) {
  const [data, sig] = String(str).split('.');
  if (!data || !sig) return null;
  const want = mac(data).subarray(0, 18), got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { return null; }
}

export const clientSecretFor = (clientId) => b64u(mac('secret:' + clientId));
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
export const sha256 = (s) => createHash('sha256').update(s).digest();
export const hashKey = (s) => sha256(s).toString('base64url').slice(0, 32);
