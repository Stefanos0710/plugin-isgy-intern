// Fake isgy-intern.de for tests. Behaves like the real portal as far as the MCP server relies on it.
import { createServer } from 'node:http';
import { today, addDays, deDate, isWeekend } from '../lib/dates.js';

export const USER = { username: 'max.muster', password: 'geheim' };
export const APP_KEY = 'AppKey123';
const sessions = new Set();
export const clearSessions = () => sessions.clear();
let n = 0;

// Minimal PDF with a "Kürzel | Person | Tätigkeit" table (WinAnsi encoding: ü = \374, ä = \344).
function kuerzelPdf() {
  const rows = [['K\\374rzel', 'Person', 'T\\344tigkeit'], ['Mm', 'Max Mustermann', 'Lehrer'], ['Sw', 'Sabine Weber', 'Lehrerin'], ['Hb', 'Hans Bauer', 'Lehrer'],
    ['Kl', 'Karl Klein', 'Lehrer'], ['Ro', 'Rosa Ott', 'Lehrerin'], ['Fu', 'Frieda Uhl', 'Lehrerin']];
  const text = rows.map((r, i) => r.map((c, j) => `BT /F1 10 Tf ${[40, 86, 260][j]} ${780 - i * 14} Td (${c}) Tj ET`).join('\n')).join('\n');
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

const plan = [
  [[{ subject: 'M', teacher: 'Mm', room: '204' }], [{ subject: 'M', teacher: 'Mm', room: '204' }], [{ subject: 'D', teacher: 'Sw', room: '101' }], [{ subject: 'E_1', teacher: 'Hb', room: '102' }], [], []],
  [[{ subject: 'Ph', teacher: 'Kl', room: 'P1' }], [{ subject: 'D', teacher: 'Sw', room: '101' }], [{ subject: 'Ev', teacher: 'Ro', room: '9' }, { subject: 'Eth', teacher: 'Fu', room: '10' }]],
  [[{ subject: 'E_1', teacher: 'Hb', room: '102' }], [{ subject: 'M', teacher: 'Mm', room: '204' }]],
  [[{ subject: 'D', teacher: 'Sw', room: '101' }], [{ subject: 'Ph', teacher: 'Kl', room: 'P1' }]],
  [[{ subject: 'M', teacher: 'Mm', room: '204' }], [{ subject: 'E_1', teacher: 'Hb', room: '102' }]],
];
const nextSchool = (d) => { while (isWeekend(d)) d = addDays(d, 1); return d; };
export const D1 = nextSchool(addDays(today(), 1));
let last = today();
while (isWeekend(last)) last = addDays(last, -1);
export const LAST = last;

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const html = (res, body) => { res.writeHead(200, { 'content-type': 'text/html; charset=UTF-8' }); res.end(body); };
const sid = (req) => (String(req.headers.cookie || '').match(/PHPSESSID=(\w+)/) || [])[1];
const LOGIN = '<html><script>window.loginConfig = {"siteName":"ISGYintern"};</script></html>';

export function startMock(port) {
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const page = url.searchParams.get('page');
    const authed = sessions.has(sid(req));
    let body = '';
    for await (const c of req) body += c;
    if (url.pathname === '/index.php' && page === 'login' && req.method === 'POST') {
      const ok = body.includes(`name="username"\r\n\r\n${USER.username}\r\n`) && body.includes(`name="password"\r\n\r\n${USER.password}\r\n`);
      if (!ok) return json(res, 200, { success: false, errorMessage: 'Unbekannter Benutzer oder falsches Passwort!  ', captchaHTML: '' });
      const s = 'S' + (++n) + 'x'.repeat(20);
      sessions.add(s);
      res.setHeader('set-cookie', [`PHPSESSID=${s}; path=/; HttpOnly`]);
      return json(res, 200, { success: true });
    }
    if (url.pathname === '/index.php') {
      if (!authed) return html(res, LOGIN);
      if (page === 'ext_klassenkalender') return html(res, `<script>window.globals={apiKey: "${APP_KEY}"};</script>`);
      if (page === 'ext_downloads' && url.searchParams.get('task') === 'download') {
        if (url.searchParams.get('id') !== '80') { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end(kuerzelPdf());
      }
      return html(res, '<html>dashboard</html>');
    }
    if (url.pathname.startsWith('/rest.php/')) {
      const ep = url.pathname.slice('/rest.php/'.length);
      if (ep === 'vplan/getList' || ep.startsWith('klassenkalender/')) {
        // Header auth: the session token is the cookie value (like the extension's localStorage value).
        if (req.headers['auth-app'] !== APP_KEY || !sessions.has(req.headers['auth-session'])) return json(res, 401, { error: 1, errorText: 'App Auth Failed ' });
        if (ep === 'vplan/getList') return json(res, 200, { heute: { data: [
          { date: deDate(D1), stunde: '3', klasse: '10b', fach_alt: 'D', user_alt_kurz: 'Sw', fach_neu: 'D', user_neu_kurz: 'Mm', user_neu_title: '', raum_alt: '101', raum_neu: '204', info_1: 'Arbeitsauftrag', info_2: 'Vertretung' },
          { date: deDate(D1), stunde: '4', klasse: '10b', fach_alt: 'E_1', user_alt_kurz: 'Hb', fach_neu: '', user_neu_kurz: '', user_neu_title: 'XXX', raum_alt: '102', raum_neu: '', info_1: '', info_2: 'Entfall' },
          { date: deDate(D1), stunde: '1-2', klasse: '9a', fach_alt: 'M', user_alt_kurz: 'Mm', user_neu_kurz: 'Kl', raum_alt: '1', info_2: 'Vertretung' },
        ] }, morgen: null });
        if (ep === 'klassenkalender/getKalenders') return json(res, 200, [{ id: 7, title: '10b' }, { id: 8, title: 'Schule', preSelect: false }]);
        if (ep === 'klassenkalender/getEvents') {
          if (!/name="kalenders"\r\n\r\n7\r\n/.test(body)) return json(res, 200, []);
          return json(res, 200, [{ title: '10b: Schulaufgabe', dateStart: D1, dateEnd: D1, timeStart: '00:00', fach_title: 'Mathematik', stunde: '1', lnw: { short: 'SA', title: 'Schulaufgabe' } },
            { title: '10b: Wandertag', dateStart: addDays(D1, 10), dateEnd: addDays(D1, 10), place: 'Ebersberger Forst' }]);
        }
      }
      if (!authed) return json(res, 401, []);
      if (ep === 'stundenplan/getStundenplan') return json(res, 200, { plan, active: '10b', currentStunde: 0 });
      const m = ep.match(/^tagebuch\/getList\/(\d{4}-\d{2}-\d{2})$/);
      if (m) {
        const d = m[1];
        const entries = isWeekend(d) ? [] : [
          { subject: 'M', lesson: 1, teacher: 'Mm', topic: `Quadratische Funktionen (${d})`, homework: d === LAST ? 'S. 42 Nr. 3a–c\n\nbis Freitag' : '', notes: '', substitution: false, cancelled: false },
          { subject: 'M', lesson: 2, teacher: 'Mm', topic: `Quadratische Funktionen (${d})`, homework: d === LAST ? 'S. 42 Nr. 3a–c\n\nbis Freitag' : '', notes: '' },
          { subject: 'E_1', lesson: 4, teacher: 'Hb', topic: 'Reported speech', homework: 'Vocab unit 3', notes: '' },
        ];
        return json(res, 200, { data: { entries } });
      }
    }
    res.writeHead(404); res.end();
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
