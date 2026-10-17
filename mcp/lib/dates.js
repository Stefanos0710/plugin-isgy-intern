// Calendar days as 'YYYY-MM-DD' strings in school time (Europe/Berlin); the server itself runs in UTC.
export const TZ = 'Europe/Berlin';
export const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const TIMES = { 1: '07:55', 2: '08:40', 3: '09:45', 4: '10:30', 5: '11:30', 6: '12:15', 7: '13:55', 8: '14:40' };

const pad = (n) => String(n).padStart(2, '0');
const parts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  .formatToParts(d).map((p) => [p.type, p.value]));

export function today() {
  const p = parts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}
export function nowMinutes() {
  const p = parts(new Date());
  return Number(p.hour) * 60 + Number(p.minute);
}
const toDate = (ds) => { const [y, m, d] = ds.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDays = (ds, n) => { const d = toDate(ds); d.setUTCDate(d.getUTCDate() + n); return fromDate(d); };
export const weekday = (ds) => toDate(ds).getUTCDay(); // 0 = Sunday
export const isWeekend = (ds) => weekday(ds) === 0 || weekday(ds) === 6;
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
export const deDate = (ds) => { const [y, m, d] = ds.split('-'); return `${d}.${m}.${y}`; };
export const label = (ds) => `${DAYS[weekday(ds)]}, ${deDate(ds)}`;
// Portal format 'dd.mm.yyyy' → 'YYYY-MM-DD'
export const fromDe = (s) => { const m = String(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : ''; };
export function nextSchoolDay(ds, includeSelf = true) {
  let d = includeSelf ? ds : addDays(ds, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

const WD = { mo: 1, montag: 1, di: 2, dienstag: 2, mi: 3, mittwoch: 3, do: 4, donnerstag: 4, fr: 5, freitag: 5, sa: 6, samstag: 6, so: 0, sonntag: 0 };

// Accepts 'YYYY-MM-DD', 'DD.MM.YYYY', 'DD.MM.', 'heute', 'morgen', 'übermorgen', 'gestern', weekday names (next occurrence)
// and English today/tomorrow/yesterday. Returns '' for unparseable input.
export function parseDay(input, fallback = today()) {
  if (input == null || String(input).trim() === '') return fallback;
  const s = String(input).trim().toLowerCase();
  const t = today();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);
  if (m) {
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : Number(t.slice(0, 4));
    let d = `${y}-${pad(m[2])}-${pad(m[1])}`;
    if (!m[3] && diffDays(t, d) < -183) d = `${y + 1}-${pad(m[2])}-${pad(m[1])}`;
    return d;
  }
  const rel = { heute: 0, today: 0, morgen: 1, tomorrow: 1, 'übermorgen': 2, uebermorgen: 2, gestern: -1, yesterday: -1, vorgestern: -2 };
  if (s in rel) return addDays(t, rel[s]);
  const w = s.replace(/^(nächsten?|naechsten?|kommenden?|am)\s+/, '');
  if (w in WD) {
    let d = t;
    for (let i = 0; i < 7 && weekday(d) !== WD[w]; i++) d = addDays(d, 1);
    return d;
  }
  return '';
}
