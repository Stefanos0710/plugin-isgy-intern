// The MCP tools. Each returns plain German text that reads well for both the model and the user,
// with enough context (date, times, teachers, what's due) that the model rarely needs a second call.
import { db } from './db.js';
import { BASE, loadPdfjs, PortalError } from './portal.js';
import { TIMES, DAYS, today, nowMinutes, addDays, isWeekend, weekday, diffDays, deDate, label, fromDe, parseDay, nextSchoolDay, rel, short, lessonTime, lessonStart } from './dates.js';

// Bad arguments from the model: reported back as tool error, not logged.
export class InputError extends Error {}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const multiline = (s) => String(s ?? '').replace(/\r/g, '').replace(/\n\s*\n+/g, '\n').trim();
const indent = (s, pre) => multiline(s).replace(/\n/g, '\n' + pre);
const lessonsOf = (s) => {
  const [a, b] = String(s).split('-').map((x) => parseInt(x, 10));
  return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
};
const classMatch = (k, cls) => String(k).split(/[,\s]+/).some((t) => t === cls || t.startsWith(cls + '_'));
const dayPlan = (sp, ds) => (weekday(ds) >= 1 && weekday(ds) <= 5 ? sp.plan?.[weekday(ds) - 1] || [] : []);
const range = (a, b) => (a === b ? `${a}.` : `${a}.–${b}.`);
const span = (a, b) => { const s = lessonTime(a), e = lessonTime(b); return s && e ? `${s.slice(0, 5)}–${e.slice(6)}` : ''; };
const clamp = (v, def, min, max) => Math.min(Math.max(parseInt(v ?? def, 10) || def, min), max);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Runs fn over items with at most `limit` in flight (keeps the school server happy).
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

function teacherFn(kz) {
  return (code, fallback = '') => {
    const c = clean(code);
    const n = kz[c];
    return n ? `${n} (${c})` : clean(fallback) || c;
  };
}

// Same matching as the extension's dashboard: what a substitution changes.
function subInfo(v, teacher) {
  const kind = clean(v.info_2) || 'Änderung';
  const neuT = clean(v.user_neu_kurz) ? teacher(v.user_neu_kurz, v.user_neu_title) : clean(v.user_neu_title);
  const neu = neuT && neuT !== 'XXX' ? neuT : '';
  const neuF = clean(v.fach_neu) && clean(v.fach_neu) !== clean(v.fach_alt) ? clean(v.fach_neu_kurz || v.fach_neu) : '';
  const neuR = clean(v.raum_neu) && clean(v.raum_neu) !== clean(v.raum_alt) ? clean(v.raum_neu) : '';
  const cancel = /entf|fällt aus|frei/i.test(kind) || neuT === 'XXX';
  const parts = [neu && `Lehrkraft: ${neu}`, neuF && `Fach: ${neuF}`, neuR && `Raum: ${neuR}`, clean(v.info_1)].filter(Boolean);
  return { cancel, text: `${cancel ? 'ENTFÄLLT' : kind.toUpperCase()}${parts.length ? ' – ' + parts.join(', ') : ''}` };
}

async function context(portal) {
  if (!portal) throw new InputError('In deinem ISGY-KI-Konto ist noch kein isgy-intern-Zugang hinterlegt. Entweder auf der Kontoseite (/konto) Benutzername und Passwort bzw. einen Verbindungscode speichern, oder die Erweiterung „ISGY Intern Plus“ mit dem Konto verbinden und isgy-intern.de einmal öffnen. Notizen und Aufgaben (Tool notizen) gehen auch ohne.');
  const [sp, kz] = await Promise.all([portal.stundenplan(), portal.kuerzelSafe()]);
  if (!sp || !Array.isArray(sp.plan)) throw new Error('Der Stundenplan konnte nicht gelesen werden.');
  return { sp, cls: clean(sp.active), teacher: teacherFn(kz), kz };
}

async function safe(promise, fallback) {
  try { return { v: await promise }; } catch (e) { return { v: fallback, err: e.message }; }
}

// ---------- subjects ----------
const subjectsOf = (sp) => [...new Set(sp.plan.flat(2).map((s) => clean(s?.subject)).filter(Boolean))].sort();
const ALIASES = {
  mathe: 'M', mathematik: 'M', deutsch: 'D', englisch: 'E', französisch: 'F', franzoesisch: 'F', latein: 'L', spanisch: 'Spa', italienisch: 'It',
  griechisch: 'Gr', physik: 'Ph', chemie: 'C', biologie: 'B', bio: 'B', geschichte: 'G', geographie: 'Geo', erdkunde: 'Geo', informatik: 'Inf',
  musik: 'Mu', kunst: 'Ku', sport: 'Sp', ethik: 'Eth', evangelisch: 'Ev', 'evangelische religionslehre': 'Ev', katholisch: 'K',
  'katholische religionslehre': 'K', religion: 'K', wirtschaft: 'WR', 'wirtschaft und recht': 'WR', sozialkunde: 'Sk', politik: 'PuG',
  'politik und gesellschaft': 'PuG', 'natur und technik': 'NuT',
};
// Map what the model passes ("Mathe", "m", "M_1", "Mathematik") to subject codes present in the timetable.
function resolveSubject(input, subjects) {
  const s = clean(input).toLowerCase();
  if (!s) return [];
  const exact = subjects.filter((x) => x.toLowerCase() === s);
  if (exact.length) return exact;
  const base = (x) => x.toLowerCase().split(/[_\s]/)[0];
  const byBase = subjects.filter((x) => base(x) === s);
  if (byBase.length) return byBase;
  const alias = ALIASES[s];
  if (alias) { const a = subjects.filter((x) => base(x) === alias.toLowerCase()); if (a.length) return a; }
  return subjects.filter((x) => x.toLowerCase().startsWith(s));
}
const subjectMatches = (entrySubject, wanted) => wanted.some((w) => clean(entrySubject) === w || clean(entrySubject).split('_')[0] === w);
function requireSubject(input, sp) {
  const all = subjectsOf(sp);
  const wanted = resolveSubject(input, all);
  if (!wanted.length) throw new InputError(`Fach „${input}“ nicht im Stundenplan gefunden. Fächer der Klasse: ${all.join(', ')}`);
  return wanted;
}

function dateArg(input, name = 'datum') {
  const d = parseDay(input);
  if (!d) throw new InputError(`Unbekanntes Datum für „${name}“: ${input}. Erlaubt: YYYY-MM-DD, TT.MM.JJJJ, heute, morgen, übermorgen, Wochentag.`);
  return d;
}

// Free days as Map date → name: "Ferien"/"Feiertag" events from the class calendar …
const FREE_RE = /ferien|feiertag|unterrichtsfrei|schulfrei|ferientag/i;
function freeDaysOf(events) {
  const free = new Map();
  for (const e of events || []) {
    if (!FREE_RE.test(`${e.title} ${e.fach_title || ''}`) || isExam(e)) continue;
    for (let d = e.dateStart, i = 0; d && d <= (e.dateEnd || e.dateStart) && i < 60; d = addDays(d, 1), i++) free.set(d, eventTitle(e, ''));
  }
  return free;
}
// … plus the holidays the class diary reports for each day (also for future days, so this is the reliable source).
async function freeDays(portal, events, diary = [], until = addDays(today(), 21)) {
  const free = freeDaysOf(events);
  for (const x of diary) if (x.holiday) free.set(x.d, x.holiday);
  const days = [];
  for (let d = addDays(today(), 1); d <= until && days.length < 60; d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
  const res = await mapLimit(days, 6, (d) => portal.tagebuchDay(d, 43200).catch(() => null));
  days.forEach((d, i) => { if (res[i]?.holiday) free.set(d, res[i].holiday); });
  return free;
}

// Attachments of a diary entry, with the ref for datei_lesen.
const entryFiles = (e, d) => (e.publicFiles || []).filter((f) => f?.id).map((f) => `${clean(f.name)} [datei_lesen ref „tb:${d}:${f.id}“]`);

// Message HTML → readable text (links kept as "text (url)").
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', euro: '€', ndash: '–', mdash: '—', bdquo: '„', ldquo: '“', rdquo: '”' };
const htmlText = (h) => multiline(String(h ?? '')
  .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, href, t) => (t.replace(/<[^>]+>/g, '').trim() === href ? href : `${t} (${href})`))
  .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/ul|\/ol)\b[^>]*>/gi, '\n').replace(/<li\b[^>]*>/gi, '- ').replace(/<[^>]+>/g, '')
  .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m))
  .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n'));

// Text of a PDF (page by page, capped).
async function pdfText(buf, maxChars) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  let out = '', pages = 0;
  for (let p = 1; p <= doc.numPages && out.length < maxChars; p++, pages++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items;
    out += `\n--- Seite ${p} ---\n` + items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
  }
  const total = doc.numPages;
  await doc.destroy();
  return { text: out.slice(0, maxChars).trim(), pages, total, cut: out.length > maxChars || pages < total };
}
// Does the Vertretungsplan cancel every lesson of the subject on that day?
function cancelledOn(vp, cls, ds, wanted) {
  const vs = (vp || []).filter((v) => fromDe(v.date) === ds && classMatch(v.klasse, cls) && subjectMatches(v.fach_alt, wanted));
  return vs.length > 0 && vs.every((v) => subInfo(v, (x) => clean(x)).cancel);
}
const hoursOf = (sp, ds, wanted) => dayPlan(sp, ds).map((slots, h) => ((slots || []).some((s) => subjectMatches(s.subject, wanted)) ? h + 1 : 0)).filter(Boolean);

// Next (dir = 1) or previous (dir = -1) date with a lesson in one of the subjects (max. 3 weeks), per the timetable.
// `opt` = { free, vp, cls }: skips holidays and lessons the Vertretungsplan cancels; `skipped` lists those.
function findLesson(sp, wanted, fromDs, dir, opt = {}) {
  const skipped = [];
  for (let i = 1; i <= 21; i++) {
    const d = addDays(fromDs, dir * i);
    const hours = hoursOf(sp, d, wanted);
    if (!hours.length) continue;
    if (opt.free?.has(d)) { skipped.push({ d, why: opt.free.get?.(d) || 'unterrichtsfrei' }); continue; }
    if (opt.vp && cancelledOn(opt.vp, opt.cls, d, wanted)) { skipped.push({ d, why: 'entfällt' }); continue; }
    return { d, hours, skipped };
  }
  return null;
}
const nextLesson = (sp, wanted, afterDs, opt) => findLesson(sp, wanted, afterDs, 1, opt);
const prevLesson = (sp, wanted, beforeDs, opt) => findLesson(sp, wanted, beforeDs, -1, opt);

// Explicit due date in a homework text, relative to the day it was given:
// "bis 23.10.", "zum 23.10.2026", "bis Freitag", "für Montag", "bis morgen". Vague "nächste Woche" → { vague }.
const WD_NUM = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5 };
function textDue(hw, givenDs) {
  const s = clean(hw).toLowerCase();
  let m = s.match(/\b(?:bis|zum|zur|für|fuer|am|abgabe)\s+(?:(?:den|zum|spätestens)\s+)?(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?/);
  if (m) {
    const y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : Number(givenDs.slice(0, 4));
    let d = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    if (!m[3] && d < givenDs) d = `${y + 1}${d.slice(4)}`;
    if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) return { d };
  }
  m = s.match(/\b(?:bis|zum|zur|für|fuer|am)\s+(?:(?:nächsten?|naechsten?|kommenden?|den)\s+)?(montag|dienstag|mittwoch|donnerstag|freitag)\b/);
  if (m) { let d = addDays(givenDs, 1); while (weekday(d) !== WD_NUM[m[1]]) d = addDays(d, 1); return { d }; }
  if (/\bbis\s+morgen\b/.test(s)) return { d: nextSchoolDay(givenDs, false) };
  if (/n(ä|ae)chste\s+woche|in\s+(einer|zwei|2|drei|3)\s+wochen/.test(s)) return { vague: s.match(/n(ä|ae)chste\s+woche|in\s+(einer|zwei|2|drei|3)\s+wochen/)[0] };
  return null;
}

// All homework from the diary with its due date: explicit date in the text, else the next lesson of the subject
// (skipping holidays and cancelled lessons). Sorted by due date.
function homeworkItems(sp, diary, opt, wanted = null) {
  const items = [];
  for (const { d, es } of diary) for (const e of es) {
    if (!clean(e.homework) || (wanted && !subjectMatches(e.subject, wanted))) continue;
    const subj = clean(e.subject);
    const td = textDue(e.homework, d);
    const nx = nextLesson(sp, [subj], d, opt);
    const due = td?.d || nx?.d || '';
    items.push({ d, e, subj, due, how: td?.d ? 'Datum im Text' : nx ? 'nächste Stunde' : '', vague: td?.vague, nx });
  }
  return items.sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || a.subj.localeCompare(b.subj));
}

// What is due on `ds`, per subject that has a lesson that day. The homework for a lesson is normally given in the
// subject's PREVIOUS lesson – so we look there, not at the diary of `ds` itself.
// Returns lines for the output; `day` is buildDay(ds, …), `diary` must reach back ~3 weeks before ds.
function homeworkDueOn(ds, day, sp, diary, opt, wanted = null) {
  const out = [];
  const shown = new Set(); // `${d}|${homework}` already listed
  const subjects = [...new Set(day.items.map((it) => clean(it.slot.subject)))].filter((s) => !wanted || subjectMatches(s, wanted));
  const parallel = new Set(dayPlan(sp, ds).filter((slots) => (slots || []).length > 1).flatMap((slots) => slots.map((s) => clean(s.subject))));
  const entriesOn = (d, subj) => (diary.find((x) => x.d === d)?.es || []).filter((e) => subjectMatches(e.subject, [subj]));
  const hwText = (es) => [...new Set(es.filter((e) => clean(e.homework)).map((e) => multiline(e.homework)))].join('\n');
  for (const subj of subjects) {
    const tag = parallel.has(subj) ? ' (Wahlfach/Gruppe – gilt nur, wenn du es hast)' : '';
    const its = day.items.filter((it) => clean(it.slot.subject) === subj);
    if (its.every((it) => it.cancel)) {
      const nx = nextLesson(sp, [subj], ds, opt);
      out.push(`- ${subj}${tag}: Stunde ENTFÄLLT laut Vertretungsplan – Hausaufgaben dafür werden vermutlich erst ${nx ? `zur nächsten Stunde am ${label(nx.d)}` : 'zur nächsten Stunde'} fällig.`);
      continue;
    }
    const prev = prevLesson(sp, [subj], ds, { free: opt.free });
    if (!prev) continue;
    if (prev.d > today()) { out.push(`- ${subj}${tag}: Hausaufgaben dafür werden erst in der Stunde am ${label(prev.d)} aufgegeben.`); continue; }
    const es =entriesOn(prev.d, subj).filter((e) => !e.cancelled);
    if (es.length) {
      es.forEach((e) => shown.add(`${prev.d}|${e.homework}`));
      const hw = hwText(es);
      const later = hw && textDue(hw, prev.d)?.d;
      out.push(!hw ? `- ${subj}${tag}: keine Hausaufgabe eingetragen (Stunde davor, ${short(prev.d)})`
        : later && later > ds ? `- ${subj}${tag}: nichts fällig – die Hausaufgabe vom ${short(prev.d)} ist laut Text erst am ${label(later)} fällig: ${indent(hw, '  ')}`
          : `- ${subj}${tag}: ${indent(hw, '  ')}  (aufgegeben in der Stunde davor, ${short(prev.d)})`);
      const files = es.flatMap((e) => entryFiles(e, prev.d));
      if (files.length) out.push(`  Anhänge: ${files.join('; ')}`);
      continue;
    }
    // No entry for the previous lesson: not entered yet, or the lesson was cancelled. Show the latest homework, flagged.
    const last = diary.find((x) => x.d < ds && x.d < prev.d && entriesOn(x.d, subj).length);
    const why = prev.d === today() ? 'die heutige Stunde ist noch nicht im Tagebuch eingetragen' : entriesOn(prev.d, subj).length ? 'die Stunde ist ausgefallen' : 'kein Tagebucheintrag – ausgefallen oder noch nicht eingetragen';
    const lastHw = last ? hwText(entriesOn(last.d, subj)) : '';
    if (last) entriesOn(last.d, subj).forEach((e) => shown.add(`${last.d}|${e.homework}`));
    out.push(`- ${subj}${tag}: Für die Stunde davor (${short(prev.d)}) ${why}.` +
      (lastHw ? ` Letzte eingetragene Hausaufgabe (vom ${short(last.d)}): ${indent(lastHw, '  ')} – die war eigentlich schon am ${short(prev.d)} fällig; ist die Stunde ausgefallen, ist sie jetzt fällig.` : ''));
  }
  // Homework from other lessons with this exact date in the text ("bis Freitag", "bis 23.10.").
  for (const it of homeworkItems(sp, diary, opt, wanted)) {
    if (it.how !== 'Datum im Text' || it.due !== ds || it.d >= ds || shown.has(`${it.d}|${it.e.homework}`)) continue;
    out.push(`- ${it.subj}: ${indent(it.e.homework, '  ')}  (aufgegeben ${short(it.d)}, im Text steht dieser Termin)`);
  }
  return out;
}

// ---------- class diary ----------
const dedupe = (entries) => {
  const seen = new Set();
  return entries.filter((e) => { const k = `${clean(e.subject)}|${e.topic}|${e.homework}`; if (seen.has(k)) return false; seen.add(k); return true; });
};
const sortEntries = (es) => [...es].sort((a, b) => Number(a.lesson) - Number(b.lesson));
const ttlFor = (ds) => (ds < addDays(today(), -2) ? 3600 : 300);

// The last `count` school days up to and including `end` (never in the future), newest first, with their entries.
async function diaryDays(portal, end, count) {
  let d = end > today() ? today() : end;
  const days = [];
  for (; days.length < count; d = addDays(d, -1)) if (!isWeekend(d)) days.push(d);
  const lists = await mapLimit(days, 6, (x) => portal.tagebuchDay(x, ttlFor(x)));
  return days.map((x, i) => ({ d: x, es: dedupe(sortEntries(lists[i].entries)), holiday: lists[i].holiday }));
}

function formatEntry(e, teacher, { withSubject = true, pre = '', d = '' } = {}) {
  const flags = [e.substitution && 'Vertretung', e.cancelled && 'entfallen'].filter(Boolean);
  const lines = [`${pre}${withSubject ? clean(e.subject) + ' · ' : ''}${clean(e.lesson)}. Std · ${teacher(e.teacher)}${flags.length ? ' · ' + flags.join(', ') : ''}`];
  if (clean(e.topic)) lines.push(`${pre}  Thema: ${indent(e.topic, pre + '         ')}`);
  lines.push(clean(e.homework) ? `${pre}  Hausaufgabe: ${indent(e.homework, pre + '               ')}` : `${pre}  Hausaufgabe: keine eingetragen`);
  if (clean(e.notes)) lines.push(`${pre}  Notiz: ${indent(e.notes, pre + '         ')}`);
  const files = d ? entryFiles(e, d) : [];
  if (files.length) lines.push(`${pre}  Anhänge: ${files.join('; ')}`);
  return lines.join('\n');
}

// ---------- calendar ----------
const LNW_RE = /schulaufgabe|stegreif|\bex\b|kurzarbeit|klausur|leistungsnachweis|\btest\b|prüfung|referat/i;
const isExam = (e) => !!e.lnw || LNW_RE.test(`${e.title} ${e.fach_title || ''}`);
const eventTitle = (e, cls) => clean(e.title).replace(new RegExp('^' + reEsc(cls) + ':\\s*'), '');

function formatEvent(e, cls, { relative = true } = {}) {
  const multi = e.dateEnd && e.dateEnd !== e.dateStart;
  const when = multi ? `${short(e.dateStart)}–${short(e.dateEnd)}` : `${label(e.dateStart)}`;
  const extra = [e.lnw?.title || e.lnw?.short, e.stunde && `${clean(e.stunde)}. Std`, clean(e.timeStart) && clean(e.timeStart) !== '00:00' && `${clean(e.timeStart).slice(0, 5)} Uhr`, clean(e.place)].filter(Boolean);
  return `${when}${relative ? ` (${rel(e.dateStart)})` : ''}: ${e.fach_title ? clean(e.fach_title) + ' – ' : ''}${eventTitle(e, cls)}${extra.length ? ' [' + extra.join(', ') + ']' : ''}`;
}
const inRange = (e, from, to) => (e.dateEnd || e.dateStart) >= from && e.dateStart <= to;
const byStart = (a, b) => (a.dateStart + (a.timeStart || '')).localeCompare(b.dateStart + (b.timeStart || ''));
// Which timetable subject an exam belongs to (by fach code or subject title).
function examSubject(e, subjects) {
  for (const cand of [e.fach_kurz, e.fach, e.fach_title, e.lnw && eventTitle(e, '').split(/[\s:–-]/)[0]]) {
    if (!clean(cand)) continue;
    const r = resolveSubject(cand, subjects);
    if (r.length) return r;
  }
  return [];
}

// ---------- one day ----------
function buildDay(ds, sp, vplanAll, cls, teacher) {
  const plan = dayPlan(sp, ds);
  const vp = vplanAll.filter((v) => fromDe(v.date) === ds && classMatch(v.klasse, cls));
  const items = [];
  const used = new Set();
  plan.forEach((slots, i) => {
    const n = i + 1;
    const subsHere = vp.filter((v) => lessonsOf(v.stunde).includes(n));
    for (const s of slots || []) {
      const subs = subsHere.filter((v) => clean(v.fach_alt) === clean(s.subject) || clean(v.user_alt_kurz) === clean(s.teacher) || slots.length === 1);
      subs.forEach((v) => used.add(v));
      const prev = items.find((it) => it.to === n - 1 && it.slot.subject === s.subject && it.slot.teacher === s.teacher && it.slot.room === s.room);
      if (prev && !prev.subs.length && !subs.length) prev.to = n;
      else items.push({ from: n, to: n, slot: s, subs, cancel: subs.some((v) => subInfo(v, teacher).cancel) });
    }
  });
  const isToday = ds === today();
  const now = nowMinutes();
  const lines = [];
  let lastTo = 0;
  for (const it of items) {
    if (lastTo && it.from > lastTo + 1) lines.push(`${range(lastTo + 1, it.from - 1)} Std frei`);
    lastTo = Math.max(lastTo, it.to);
    const s = it.slot;
    let state = '';
    if (isToday) {
      const st = lessonStart(it.from), en = lessonStart(it.to) + 45;
      if (st != null && now >= st && now < en) state = '  ◀ JETZT';
      else if (st != null && now >= en) state = '  (vorbei)';
    }
    lines.push(`${range(it.from, it.to)} Std ${span(it.from, it.to)}  ${clean(s.subject)} · ${teacher(s.teacher)}${clean(s.room) ? ' · Raum ' + clean(s.room) : ''}${state}`);
    for (const v of it.subs) lines.push('     → ' + subInfo(v, teacher).text);
  }
  const orphans = vp.filter((v) => !used.has(v)).map((v) => `${clean(v.stunde)}. Std ${clean(v.fach_alt)}: ${subInfo(v, teacher).text}`);
  const real = items.filter((it) => !it.cancel);
  const first = real.length ? Math.min(...real.map((x) => x.from)) : 0, last = real.length ? Math.max(...real.map((x) => x.to)) : 0;
  const planned = items.length ? Math.max(...items.map((x) => x.to)) : 0;
  return { items, lines, orphans, subCount: vp.length, first, last, planned };
}

function dayHeader(day) {
  if (!day.items.length) return 'Laut Stundenplan kein Unterricht.';
  if (!day.last) return 'Alle Stunden entfallen!';
  const early = day.last < day.planned ? ` – früher aus als sonst (regulär bis ${span(day.planned, day.planned).slice(6)})` : '';
  return `Unterricht ${span(day.first, day.last)} (${day.first}.–${day.last}. Stunde)${early}`;
}

// '→ fällig Mi, 21.10. (in 3 Tagen)' for a homeworkItems() entry.
function dueLabel(it) {
  if (!it.due) return it.vague ? `Termin laut Text: „${it.vague}“` : 'Fälligkeit unklar';
  const skipped = it.how === 'nächste Stunde' && it.nx?.skipped.length ? `; übersprungen: ${it.nx.skipped.map((s) => `${short(s.d)} ${s.why}`).join(', ')}` : '';
  return `fällig ${label(it.due)} (${rel(it.due)}${it.how === 'Datum im Text' ? ', Datum aus dem Text' : ', nächste Stunde'}${skipped})${it.vague ? ` – im Text: „${it.vague}“` : ''}`;
}
const HW_DUE_HEAD = 'Hausaufgaben, die an diesem Tag fällig sind (je Fach aus der Stunde davor – dort werden sie aufgegeben):';

function defaultDay(sp) {
  // After the last lesson of today, show the next school day (like the extension's dashboard).
  let ds = nextSchoolDay(today());
  if (ds === today()) {
    const last = dayPlan(sp, ds).reduce((m, x, i) => (x?.length ? i + 1 : m), 0);
    const st = lessonStart(last);
    if (st != null && nowMinutes() > st + 45) ds = nextSchoolDay(today(), false);
  }
  return ds;
}

// ---------- tagesplan ----------
async function tagesplan(portal, args, ctx) {
  const { sp, cls, teacher } = await context(portal);
  const ds = args.datum ? dateArg(args.datum) : defaultDay(sp);
  const [vp, kal, diary, todos] = await Promise.all([
    safe(portal.vplan(), []), safe(portal.kalender(cls), { events: [] }),
    ds >= today() && !isWeekend(ds) ? safe(diaryDays(portal, addDays(ds, -1), 15), []) : { v: [] },
    openTodos(ctx),
  ]);
  const day = buildDay(ds, sp, vp.v, cls, teacher);
  const free = await freeDays(portal, kal.v.events, diary.v, addDays(ds, 7));
  const out = [`${label(ds)} (${rel(ds)}) – Klasse ${cls}`];
  if (isWeekend(ds)) out.push('Wochenende – kein Unterricht.', `Nächster Schultag: ${label(nextSchoolDay(ds))}.`);
  else if (free.has(ds)) out.push(`Unterrichtsfrei: ${free.get(ds)} – kein Unterricht.`);
  else {
    out.push(dayHeader(day));
    if (day.lines.length) out.push('', ...day.lines);
  }
  if (day.orphans.length) out.push('', 'Weitere Vertretungen für die Klasse:', ...day.orphans.map((x) => '- ' + x));
  if (vp.err) out.push('', `(Vertretungsplan nicht verfügbar: ${vp.err})`);
  else if (!day.subCount && !isWeekend(ds)) out.push('', 'Keine Vertretungen eingetragen' + (diffDays(today(), ds) > 3 ? ' (für weiter entfernte Tage ist der Vertretungsplan oft noch nicht veröffentlicht).' : '.'));
  const evs = kal.v.events.filter((e) => inRange(e, ds, ds)).sort(byStart);
  if (evs.length) out.push('', 'Termine an diesem Tag:', ...evs.map((e) => `- ${isExam(e) ? '📝 ' : ''}${formatEvent(e, cls, { relative: false })}`));
  if (kal.err) out.push(`(Klassenkalender nicht verfügbar: ${kal.err})`);
  const hw = diary.v?.length && !free.has(ds) ? homeworkDueOn(ds, day, sp, diary.v, { free, vp: vp.v, cls }) : [];
  if (hw.length) out.push('', HW_DUE_HEAD, ...hw);
  const soon = kal.v.events.filter((e) => isExam(e) && inRange(e, addDays(ds, 1), addDays(ds, 7))).sort(byStart);
  if (soon.length) out.push('', 'Prüfungen in den Tagen danach:', ...soon.map((e) => '- ' + formatEvent(e, cls)));
  const mine = (todos || []).filter((n) => n.date && n.date <= ds);
  if (mine.length) out.push('', 'Eigene offene Aufgaben bis zu diesem Tag (aus der Erweiterung):', ...mine.map(todoLine));
  return out.join('\n');
}

// ---------- uebersicht ----------
async function uebersicht(portal, args, ctx) {
  const { sp, cls, teacher } = await context(portal);
  const t = today();
  const [vp, kal, diary, todos] = await Promise.all([safe(portal.vplan(), []), safe(portal.kalender(cls), { events: [] }), safe(diaryDays(portal, t, 10), []), openTodos(ctx)]);
  const out = [`Überblick für Klasse ${cls}`];
  const now = nowMinutes();

  // Today, while school is running: current and next lesson.
  if (!isWeekend(t)) {
    const day = buildDay(t, sp, vp.v, cls, teacher);
    const running = day.items.find((it) => !it.cancel && now >= lessonStart(it.from) && now < lessonStart(it.to) + 45);
    const next = day.items.find((it) => !it.cancel && lessonStart(it.from) > now);
    if (running || next) {
      out.push('', 'JETZT:');
      if (running) out.push(`- läuft: ${range(running.from, running.to)} Std ${clean(running.slot.subject)} bei ${teacher(running.slot.teacher)}, Raum ${clean(running.slot.room) || '?'} (bis ${span(running.to, running.to).slice(6)})`);
      if (next) out.push(`- als Nächstes: ${range(next.from, next.to)} Std ${clean(next.slot.subject)} um ${TIMES[next.from] || '?'}, Raum ${clean(next.slot.room) || '?'}${next.subs.length ? ' → ' + subInfo(next.subs[0], teacher).text : ''}`);
      if (day.last) out.push(`- Schulschluss heute: ${span(day.last, day.last).slice(6)} Uhr`);
    }
  }

  const ds = defaultDay(sp);
  const day = buildDay(ds, sp, vp.v, cls, teacher);
  out.push('', `${ds === t ? 'HEUTE' : 'NÄCHSTER SCHULTAG'}: ${label(ds)} (${rel(ds)})`, dayHeader(day), ...day.lines.map((l) => '  ' + l));
  if (day.orphans.length) out.push(...day.orphans.map((x) => '  ' + x));
  if (vp.err) out.push(`  (Vertretungsplan nicht verfügbar: ${vp.err})`);
  const opt = { free: await freeDays(portal, kal.v.events, diary.v), vp: vp.v, cls };
  const hwDue = diary.v?.length ? homeworkDueOn(ds, day, sp, diary.v, opt) : [];
  if (hwDue.length) out.push('', `HAUSAUFGABEN FÄLLIG ${short(ds).toUpperCase()} (je Fach aus der Stunde davor):`, ...hwDue);

  const open = homeworkItems(sp, (diary.v || []).slice(0, 7), opt).filter((it) => !it.due || it.due > ds);
  if (open.length) {
    out.push('', 'SPÄTER FÄLLIGE HAUSAUFGABEN:');
    for (const it of open) out.push(`- ${it.subj} (aufgegeben ${short(it.d)}): ${indent(it.e.homework, '  ')}  → ${dueLabel(it)}`);
  }
  const evs = kal.v.events.filter((e) => inRange(e, t, addDays(t, 21))).sort(byStart);
  const exams = evs.filter(isExam), other = evs.filter((e) => !isExam(e) && inRange(e, t, addDays(t, 10)));
  if (exams.length) out.push('', 'PRÜFUNGEN (nächste 3 Wochen):', ...exams.map((e) => '- ' + formatEvent(e, cls)));
  if (other.length) out.push('', 'WEITERE TERMINE (nächste 10 Tage):', ...other.map((e) => '- ' + formatEvent(e, cls)));
  if (kal.err) out.push('', `(Klassenkalender nicht verfügbar: ${kal.err})`);
  if (todos?.length) {
    const sorted = [...todos].sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
    out.push('', `EIGENE OFFENE AUFGABEN (${todos.length}, aus der Erweiterung):`, ...sorted.slice(0, 15).map(todoLine));
  }
  return out.join('\n');
}

// ---------- stundenplan ----------
async function stundenplan(portal) {
  const { sp, cls, teacher } = await context(portal);
  const out = [`Regulärer Stundenplan Klasse ${cls} (ohne Vertretungen – dafür tagesplan/vertretungen)`];
  const hours = {};
  sp.plan.slice(0, 5).forEach((day, d) => {
    out.push('', DAYS[d + 1] + ':');
    const items = [];
    (day || []).forEach((slots, i) => (slots || []).forEach((s) => {
      hours[clean(s.subject)] = (hours[clean(s.subject)] || 0) + 1;
      const prev = items.find((it) => it.to === i && it.s.subject === s.subject && it.s.teacher === s.teacher && it.s.room === s.room);
      if (prev) prev.to = i + 1; else items.push({ from: i + 1, to: i + 1, s });
    }));
    if (!items.length) out.push('  kein Unterricht');
    for (const it of items) out.push(`  ${range(it.from, it.to)} Std ${span(it.from, it.to)}  ${clean(it.s.subject)} · ${teacher(it.s.teacher)}${clean(it.s.room) ? ' · Raum ' + clean(it.s.room) : ''}`);
  });
  out.push('', 'Wochenstunden je Fach: ' + Object.entries(hours).sort(([a], [b]) => a.localeCompare(b)).map(([s, n]) => `${s} ${n}`).join(', '));
  out.push('Stundenzeiten: ' + Object.keys(TIMES).map((n) => `${n}. ${lessonTime(n)}`).join(', '));
  out.push('Hinweis: Parallel stehende Fächer in derselben Stunde (z. B. Ev/K/Eth oder Sprachen) sind Wahlfächer – der Schüler hat nur eines davon.');
  return out.join('\n');
}

// ---------- vertretungen ----------
async function vertretungen(portal, args) {
  const { cls, teacher } = await context(portal);
  const all = await portal.vplan();
  const ds = args.datum ? dateArg(args.datum) : '';
  const list = all.filter((v) => (args.alle_klassen || classMatch(v.klasse, cls)) && (!ds || fromDe(v.date) === ds) && (ds || fromDe(v.date) >= today()));
  const dates = [...new Set(all.map((v) => fromDe(v.date)).filter(Boolean))].sort();
  const scope = args.alle_klassen ? 'alle Klassen' : `Klasse ${cls}`;
  const published = dates.length ? `Veröffentlichte Tage im Vertretungsplan: ${dates.map((d) => `${short(d)} (${rel(d)})`).join(', ')}` : 'Der Vertretungsplan enthält gerade keine Tage.';
  if (!list.length) return `Keine Vertretungen für ${scope}${ds ? ' am ' + label(ds) : ' ab heute'}.\n${published}`;
  const byDay = new Map();
  for (const v of list) { const d = fromDe(v.date); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(v); }
  const out = [`Vertretungen (${scope}):`];
  for (const [d, vs] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    out.push('', `${label(d)} (${rel(d)}):`);
    vs.sort((a, b) => lessonsOf(a.stunde)[0] - lessonsOf(b.stunde)[0] || clean(a.klasse).localeCompare(clean(b.klasse)));
    for (const v of vs) {
      const who = clean(v.user_alt_kurz) ? teacher(v.user_alt_kurz) : '';
      const n = lessonsOf(v.stunde);
      out.push(`- ${clean(v.stunde)}. Std (${span(n[0], n.at(-1)) || '?'})${args.alle_klassen ? ' Klasse ' + clean(v.klasse) : ''}: ${clean(v.fach_alt)}${who ? ' bei ' + who : ''}${clean(v.raum_alt) ? ', Raum ' + clean(v.raum_alt) : ''} → ${subInfo(v, teacher).text}`);
    }
  }
  out.push('', published);
  return out.join('\n');
}

// ---------- tagebuch ----------
async function tagebuch(portal, args) {
  const { sp, teacher } = await context(portal);
  // Default: today, or the last school day on weekends.
  let von = args.datum ? dateArg(args.datum) : today();
  if (!args.datum) while (isWeekend(von)) von = addDays(von, -1);
  const bis = args.bis ? dateArg(args.bis, 'bis') : von;
  if (bis < von) throw new InputError('„bis“ liegt vor „datum“.');
  // A future day has no entries yet; whoever asks about it almost always wants what is due then.
  if (von > today()) return `Für ${label(von)} gibt es noch keine Tagebucheinträge (Einträge entstehen erst in der Stunde). Stattdessen, was an dem Tag fällig ist:\n\n` + await hausaufgaben(portal, { faellig: von, fach: args.fach });
  if (diffDays(von, bis) > 31) throw new InputError('Höchstens 31 Tage auf einmal.');
  const wanted = args.fach ? requireSubject(args.fach, sp) : null;
  const days = [];
  for (let d = von; d <= bis && d <= today(); d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
  const lists = await mapLimit(days, 6, (d) => portal.tagebuch(d, ttlFor(d)));
  const out = [];
  days.forEach((d, i) => {
    const es = dedupe(sortEntries(lists[i].filter((e) => !wanted || subjectMatches(e.subject, wanted))));
    if (es.length) out.push(`${label(d)} (${rel(d)}):`, ...es.map((e) => formatEntry(e, teacher, { pre: '  ', d })), '');
  });
  const what = `${wanted ? ' für ' + wanted.join('/') : ''} ${von === bis ? 'am ' + label(von) : `von ${deDate(von)} bis ${deDate(bis)}`}`;
  if (!out.length) return `Keine Tagebucheinträge${what}.${bis > today() ? ' (Für zukünftige Tage gibt es noch keine Einträge.)' : ''}`;
  return [`Klassentagebuch${what}:`, '', ...out].join('\n').trim();
}

// ---------- hausaufgaben ----------
async function hausaufgaben(portal, args) {
  const { sp, cls, teacher } = await context(portal);
  const wanted = args.fach ? requireSubject(args.fach, sp) : null;
  const [vp, kal] = await Promise.all([safe(portal.vplan(), []), safe(portal.kalender(cls), { events: [] })]);
  const notes = [vp.err && 'Vertretungsplan nicht verfügbar – Entfälle sind nicht berücksichtigt.'].filter(Boolean);

  // "Hausaufgaben für morgen" = what is due on that day, not what is entered in the diary on that day.
  if (args.faellig) {
    const asked = dateArg(args.faellig, 'faellig');
    const free = await freeDays(portal, kal.v.events, [], addDays(asked, 28));
    let ds = asked;
    while (isWeekend(ds) || free.has(ds)) ds = addDays(ds, 1);
    const diary = await diaryDays(portal, addDays(ds, -1), 15);
    for (const x of diary) if (x.holiday) free.set(x.d, x.holiday);
    const opt = { free, vp: vp.v, cls };
    const day = buildDay(ds, sp, vp.v, cls, teacher);
    const lines = homeworkDueOn(ds, day, sp, diary, opt, wanted);
    const head = `${ds !== asked ? `${label(asked)} ist schulfrei (${free.get(asked) || 'Wochenende'}) – stattdessen der nächste Schultag. ` : ''}Fällig am ${label(ds)} (${rel(ds)})${wanted ? ' in ' + wanted.join('/') : ''}:`;
    if (!lines.length) return [head, wanted ? `Keine ${wanted.join('/')}-Stunde an diesem Tag.` : 'Laut Stundenplan kein Unterricht.', ...notes].join('\n');
    return [head, 'Je Fach die Hausaufgabe aus der Stunde davor – dort wird sie aufgegeben.', '', ...lines, ...(notes.length ? ['', ...notes] : [])].join('\n');
  }

  const n = clamp(args.tage, 7, 1, 30);
  const diary = await diaryDays(portal, today(), n);
  const opt = { free: await freeDays(portal, kal.v.events, diary), vp: vp.v, cls };
  const items = homeworkItems(sp, diary, opt, wanted);
  if (!items.length) return `In den letzten ${n} Schultagen wurde${wanted ? ' für ' + wanted.join('/') : ''} keine Hausaufgabe ins Klassentagebuch eingetragen.`;
  const t = today();
  const line = (it) => {
    const files = entryFiles(it.e, it.d);
    return `- ${it.subj} bei ${teacher(it.e.teacher)} (aufgegeben ${short(it.d)}): ${indent(it.e.homework, '  ')}\n  → ${dueLabel(it)}${files.length ? '\n  Anhänge: ' + files.join('; ') : ''}`;
  };
  const open = items.filter((it) => !it.due || it.due >= t), past = items.filter((it) => it.due && it.due < t);
  const out = [`Hausaufgaben aus dem Klassentagebuch (letzte ${n} Schultage), nach Fälligkeit sortiert.`,
    'Fällig = Datum aus dem Text, sonst die nächste Stunde des Fachs laut Stundenplan (ohne Ferien und Entfälle).'];
  if (open.length) out.push('', 'NOCH FÄLLIG:', ...open.map(line));
  if (past.length) out.push('', 'SCHON FÄLLIG GEWESEN (vermutlich erledigt bzw. eingesammelt):', ...past.map(line));
  if (notes.length) out.push('', ...notes);
  return out.join('\n');
}

// ---------- letzter_eintrag ----------
async function letzterEintrag(portal, args) {
  const { sp, teacher } = await context(portal);
  const wanted = requireSubject(args.fach, sp);
  const from = args.vor ? addDays(dateArg(args.vor, 'vor'), -1) : today();
  const count = clamp(args.anzahl, 1, 1, 10);
  const found = [];
  for (let chunk = 0; chunk < 6 && found.length < count; chunk++) {
    const days = await diaryDays(portal, addDays(from, -chunk * 14), 10);
    for (const x of days) {
      const es = x.es.filter((e) => subjectMatches(e.subject, wanted));
      if (es.length && found.length < count && !found.some((f) => f.d === x.d)) found.push({ d: x.d, es });
    }
  }
  if (!found.length) return `Kein Tagebucheintrag für ${wanted.join('/')} in den letzten 12 Wochen${args.vor ? ' vor ' + deDate(dateArg(args.vor)) : ''}.`;
  const nx = nextLesson(sp, wanted, today());
  const out = found.map(({ d, es }) => `${label(d)} (${rel(d)}):\n${es.map((e) => formatEntry(e, teacher, { pre: '  ', d })).join('\n')}`);
  if (nx) out.push(`Nächste ${wanted.join('/')}-Stunde laut Stundenplan: ${label(nx.d)} (${rel(nx.d)}), ${nx.hours.map((h) => h + '.').join('/')} Std.`);
  return out.join('\n\n');
}

// ---------- fach ----------
async function fach(portal, args) {
  const { sp, cls, teacher } = await context(portal);
  const wanted = requireSubject(args.fach, sp);
  const t = today();
  const [diary, kal, vp] = await Promise.all([diaryDays(portal, t, 20), safe(portal.kalender(cls), { events: [] }), safe(portal.vplan(), [])]);
  const out = [`Fach ${wanted.join('/')} – Klasse ${cls}`];

  const slots = [];
  sp.plan.slice(0, 5).forEach((day, d) => (day || []).forEach((ss, h) => (ss || []).forEach((s) => { if (subjectMatches(s.subject, wanted)) slots.push({ d, h: h + 1, s }); })));
  const teachers = [...new Set(slots.map((x) => teacher(x.s.teacher)))];
  out.push(`Lehrkraft: ${teachers.join(', ') || '?'}`, `Wochenstunden: ${slots.length}`);
  out.push('Im Stundenplan: ' + slots.map((x) => `${DAYS[x.d + 1].slice(0, 2)} ${x.h}. Std (${TIMES[x.h] || '?'}${clean(x.s.room) ? ', Raum ' + clean(x.s.room) : ''})`).join('; '));

  const upcoming = [];
  for (let d = t; upcoming.length < 3 && d <= addDays(t, 21); d = addDays(d, 1)) {
    const day = buildDay(d, sp, vp.v, cls, teacher);
    for (const it of day.items) if (subjectMatches(it.slot.subject, wanted) && (d > t || lessonStart(it.to) + 45 > nowMinutes())) {
      upcoming.push(`- ${label(d)} (${rel(d)}), ${range(it.from, it.to)} Std${it.subs.length ? ' → ' + it.subs.map((v) => subInfo(v, teacher).text).join('; ') : ''}`);
      break;
    }
  }
  if (upcoming.length) out.push('', 'Nächste Stunden:', ...upcoming);

  const exams = kal.v.events.filter((e) => isExam(e) && inRange(e, t, addDays(t, 90)) && subjectMatches(examSubject(e, subjectsOf(sp))[0] || '', wanted)).sort(byStart);
  out.push('', exams.length ? 'Anstehende Prüfungen:' : 'Keine Prüfung in den nächsten 90 Tagen im Klassenkalender.', ...exams.map((e) => '- ' + formatEvent(e, cls)));

  const entries = diary.flatMap(({ d, es }) => es.filter((e) => subjectMatches(e.subject, wanted)).map((e) => ({ d, e })));
  if (entries.length) {
    out.push('', `Letzte Tagebucheinträge (${entries.length} in den letzten 20 Schultagen, neueste zuerst):`);
    for (const { d, e } of entries.slice(0, 8)) out.push(`- ${short(d)}: ${clean(e.topic) || '(kein Thema)'}${clean(e.homework) ? ` | HA: ${clean(e.homework)}` : ''}`);
  } else out.push('', 'Keine Tagebucheinträge in den letzten 20 Schultagen.');
  return out.join('\n');
}

// ---------- pruefungen ----------
async function pruefungen(portal, args) {
  const { sp, cls, teacher } = await context(portal);
  const t = today();
  const n = clamp(args.tage, 42, 1, 366);
  const weeks = clamp(args.wochen, 6, 1, 12);
  const withTopics = args.themen !== false;
  const { events } = await portal.kalender(cls);
  const wantedFilter = args.fach ? requireSubject(args.fach, sp) : null;
  const subjects = subjectsOf(sp);
  const exams = events.filter((e) => isExam(e) && inRange(e, t, addDays(t, n))).map((e) => ({ e, subj: examSubject(e, subjects) }))
    .filter((x) => !wantedFilter || x.subj.some((s) => wantedFilter.includes(s))).sort((a, b) => byStart(a.e, b.e));
  if (!exams.length) return `Keine Prüfungen${wantedFilter ? ' in ' + wantedFilter.join('/') : ''} in den nächsten ${n} Tagen im Klassenkalender eingetragen.`;
  const diary = withTopics ? await diaryDays(portal, t, weeks * 5) : [];
  const out = [`Prüfungen der nächsten ${n} Tage (Klasse ${cls}):`];
  for (const { e, subj } of exams) {
    out.push('', `📝 ${formatEvent(e, cls)}`);
    if (!withTopics) continue;
    if (!subj.length) { out.push('   (Fach nicht eindeutig zuordenbar – Themen ggf. mit tagebuch/fach abfragen)'); continue; }
    const entries = diary.flatMap(({ d, es }) => es.filter((x) => subjectMatches(x.subject, subj) && clean(x.topic)).map((x) => ({ d, x })));
    if (!entries.length) { out.push(`   Keine ${subj.join('/')}-Tagebucheinträge in den letzten ${weeks} Wochen.`); continue; }
    // Unique topics, newest 30 kept, listed oldest first so the model sees the order they were taught in.
    const seen = new Set();
    const topics = entries.filter(({ x }) => { const k = clean(x.topic).toLowerCase(); return !seen.has(k) && seen.add(k); }).slice(0, 30).reverse();
    out.push(`   Themen im Unterricht (${subj.join('/')}, letzte ${weeks} Wochen, älteste zuerst${topics.length === 30 ? ', nur die neuesten 30' : ''}):`);
    for (const { d, x } of topics) out.push(`   - ${short(d)}: ${clean(x.topic)}${clean(x.homework) ? ` | HA: ${clean(x.homework)}` : ''}`);
    out.push(`   Lehrkraft: ${[...new Set(entries.map(({ x }) => teacher(x.teacher)))].join(', ')}`);
  }
  out.push('', 'Hinweis: Die Themenliste stammt aus dem Klassentagebuch und zeigt, was zuletzt im Unterricht dran war – welcher Stoff genau abgefragt wird, legt die Lehrkraft fest.');
  return out.join('\n');
}

// ---------- termine ----------
async function termine(portal, args) {
  const { cls } = await context(portal);
  const from = args.ab ? dateArg(args.ab, 'ab') : today();
  const n = clamp(args.tage, 21, 1, 366);
  const to = addDays(from, n);
  const { kalender, events } = await portal.kalender(cls);
  const items = events.filter((e) => inRange(e, from, to)).sort(byStart);
  const src = kalender.map((k) => clean(k.title)).filter(Boolean).join(', ');
  if (!items.length) return `Keine Termine von ${deDate(from)} bis ${deDate(to)}${src ? ' (Kalender: ' + src + ')' : ''}.`;
  return [`Termine ${deDate(from)} – ${deDate(to)}${src ? ' (Kalender: ' + src + ')' : ''}; 📝 = Prüfung/Leistungsnachweis:`,
    ...items.map((e) => `- ${isExam(e) ? '📝 ' : ''}${formatEvent(e, cls)}`)].join('\n');
}

// ---------- lehrer ----------
async function lehrer(portal, args) {
  const kz = await portal.kuerzel();
  const q = clean(args.suche).toLowerCase();
  const all = Object.entries(kz).sort(([a], [b]) => a.localeCompare(b));
  const hits = q ? all.filter(([k, n]) => k.toLowerCase() === q || n.toLowerCase().includes(q)) : all;
  if (!hits.length) return `Keine Lehrkraft zu „${args.suche}“ gefunden (${all.length} Einträge in der Kürzel-Liste).`;
  return hits.slice(0, 300).map(([k, n]) => `${k}: ${n}`).join('\n');
}


// ---------- dokumente + datei_lesen ----------
const needPortal = (portal) => { if (!portal) throw new InputError('In deinem ISGY-KI-Konto ist noch kein isgy-intern-Zugang hinterlegt.'); return portal; };
const dlRef = (id, name) => `dl:${id}:${name}`;

async function dokumente(portal, args) {
  const cats = await needPortal(portal).downloads();
  const q = clean(args.suche).toLowerCase(), k = clean(args.kategorie).toLowerCase();
  const out = [];
  let n = 0;
  for (const c of cats) {
    if (k && !clean(c.title).toLowerCase().includes(k)) continue;
    const files = (c.files || []).filter((f) => !q || `${f.title} ${f.info} ${(f.filesObj || []).map((o) => o.name).join(' ')}`.toLowerCase().includes(q));
    if (!files.length) continue;
    out.push('', `${clean(c.title)} (${files.length}):`);
    for (const f of files) {
      n++;
      const names = (f.filesObj || []).map((o) => clean(o.name)).filter(Boolean);
      out.push(`- ${clean(f.title)}${clean(f.published) ? ` (${clean(f.published)})` : ''}${clean(f.info) ? ' – ' + clean(f.info) : ''}`,
        ...names.map((nm) => `  ${nm} [datei_lesen ref „${dlRef(f.id, nm)}“]`));
    }
  }
  if (!n) return `Keine Dokumente${q ? ` zu „${args.suche}“` : ''}${k ? ` in Kategorie „${args.kategorie}“` : ''}. Kategorien: ${cats.map((c) => clean(c.title)).join(', ')}`;
  return [`Dokumente (isgy-intern → Dokumente)${q ? `, Suche „${args.suche}“` : ''}: ${n} Einträge. Inhalt mit datei_lesen und der ref lesen.`, ...out].join('\n');
}

// ref → portal path: dl:<id>:<name> (Dokumente), tb:<YYYY-MM-DD>:<fileId> (Tagebuch-Anhang), msg:<uniqid> (Nachrichten-Anhang).
async function refPath(portal, ref) {
  const s = clean(ref).replace(/^[„"']|[“"']$/g, '');
  let m = s.match(/^dl:(\d+):(.+)$/);
  if (m) {
    const f = (await portal.downloads()).flatMap((c) => c.files || []).find((x) => String(x.id) === m[1]);
    const name = f?.filesObj?.map((o) => o.name).find((x) => x === m[2]);
    if (!name) throw new InputError(`Dokument ${s} nicht gefunden – refs mit dem Tool dokumente abrufen.`);
    return { path: `index.php?page=ext_downloads&view=default&task=download&id=${m[1]}&file=${encodeURIComponent(name)}`, name };
  }
  m = s.match(/^tb:(\d{4}-\d{2}-\d{2}):(\d+)$/);
  if (m) {
    const f = (await portal.tagebuchDay(m[1])).entries.flatMap((e) => e.publicFiles || []).find((x) => String(x.id) === m[2]);
    if (!f?.url) throw new InputError(`Anhang ${s} nicht gefunden.`);
    const u = new URL(f.url, BASE + '/');
    if (u.hostname.replace(/^www\./, '') !== new URL(BASE).hostname.replace(/^www\./, '')) throw new PortalError('Anhang liegt nicht auf isgy-intern.de.');
    return { path: u.pathname.slice(1) + u.search, name: clean(f.name) };
  }
  m = s.match(/^msg:([A-Za-z0-9]+)$/);
  if (m) return { path: `index.php?page=ext_inbox&view=file&fid=${m[1]}`, name: '' };
  throw new InputError(`Unbekannte ref „${ref}“. Erwartet z. B. „dl:32:Hausordnung.pdf“, „tb:2026-10-06:123“ oder „msg:abc123“ – aus den Tools dokumente, tagebuch, hausaufgaben oder nachricht.`);
}

async function dateiLesen(portal, args) {
  const { path, name } = await refPath(needPortal(portal), args.ref);
  const { buf, type } = await portal.file(path);
  const isPdf = type.includes('pdf') || Buffer.from(buf.subarray(0, 5)).toString() === '%PDF-';
  const head = `Datei: ${name || args.ref} (${type || '?'}, ${Math.round(buf.length / 1024)} KB)`;
  if (isPdf) {
    const max = clamp(args.max_zeichen, 30000, 1000, 100000);
    const r = await pdfText(buf, max);
    if (!r.text.replace(/--- Seite \d+ ---/g, '').trim()) return `${head}\nDas PDF enthält keinen auslesbaren Text (vermutlich eingescannt).`;
    return `${head}, ${r.total} Seite(n)${r.cut ? ` – gekürzt auf ${r.pages} Seite(n) / ${max} Zeichen (max_zeichen erhöhen)` : ''}\n\n${r.text}`;
  }
  if (/^text\/|json|xml/.test(type)) return `${head}\n\n${(type.includes('html') ? htmlText : multiline)(Buffer.from(buf).toString('utf8')).slice(0, 30000)}`;
  if (type.startsWith('image/')) return `${head}\nDas ist ein Bild – den Inhalt kann ich als Text nicht lesen. Öffne es auf isgy-intern.de.`;
  return `${head}\nDieses Dateiformat kann ich nicht als Text lesen (nur PDF und Text).`;
}

// ---------- nachrichten (portal messages, read-only) ----------
const FOLDERS = { posteingang: 'Posteingang', eingang: 'Posteingang', gesendet: 'Gesendet', archiv: 'Archive', archive: 'Archive', entwurf: 'Entwurf', entwuerfe: 'Entwurf', entwürfe: 'Entwurf' };
async function folderMessages(portal, ordner, all) {
  const want = FOLDERS[clean(ordner || 'posteingang').toLowerCase()];
  if (!want) throw new InputError(`Unbekannter Ordner „${ordner}“. Erlaubt: Posteingang, Gesendet, Archiv, Entwurf.`);
  const out = [];
  for (const ib of await portal.inboxes()) {
    const f = (ib.folders || []).find((x) => clean(x.title) === want);
    if (f) out.push(...(await portal.messages(ib.id, f.id, all)).map((m) => ({ ...m, inboxTitle: clean(ib.title) })));
  }
  return { want, list: out };
}
const msgLine = (m, sent) => `- [id ${m.id}] ${clean(m.date)} · ${sent ? 'An: ' + (clean(m.receiver) || '?') : 'Von: ' + clean(m.from?.title || m.from?.userName || '?')} · „${clean(m.subject) || '(kein Betreff)'}“${m.isRead ? '' : ' · UNGELESEN'}${m.files ? ` · 📎${m.files}` : ''}${m.isConfirm ? ' · Lesebestätigung erbeten' : ''}`;

async function nachrichten(portal, args) {
  const q = clean(args.suche).toLowerCase();
  const { want, list } = await folderMessages(needPortal(portal), args.ordner, !!q);
  const n = clamp(args.anzahl, 20, 1, 100);
  const hits = list.filter((m) => (!args.nur_ungelesen || !m.isRead) && (!q || `${m.subject} ${m.from?.title} ${m.from?.userName} ${m.receiver}`.toLowerCase().includes(q)));
  const unread = list.filter((m) => !m.isRead).length;
  if (!hits.length) return `Keine Nachrichten${q ? ` zu „${args.suche}“` : ''}${args.nur_ungelesen ? ' (ungelesen)' : ''} im Ordner ${want}.`;
  return [`Nachrichten im Portal – ${want}: ${hits.length} Treffer${q ? '' : ` (neueste ${Math.min(n, hits.length)} gezeigt)`}, ${unread} ungelesen. Text mit dem Tool nachricht und der id lesen.`,
    ...hits.slice(0, n).map((m) => msgLine(m, want === 'Gesendet'))].join('\n');
}

async function nachricht(portal, args) {
  const id = String(args.id ?? '').replace(/\D/g, '');
  if (!id) throw new InputError('id fehlt – mit dem Tool nachrichten abrufen.');
  needPortal(portal);
  // Look the message up first: we must know whether it is unread, so reading it does not mark it as read.
  let meta = null;
  for (const o of ['posteingang', 'gesendet', 'archiv', 'entwurf']) { meta = (await folderMessages(portal, o, false)).list.find((m) => String(m.id) === id); if (meta) break; }
  meta ??= (await folderMessages(portal, 'posteingang', true)).list.find((m) => String(m.id) === id);
  if (!meta) throw new InputError(`Keine Nachricht mit id ${id}.`);
  const m = await portal.message(id, !meta.isRead);
  const to = (Array.isArray(m.to) ? m.to : []).map((t) => `${clean(t.title)}${t.count > 1 ? ` (${t.count})` : ''}`).filter(Boolean);
  const files = (m.files || []).filter((f) => f?.uniqid).map((f) => `${clean(f.name)} [datei_lesen ref „msg:${f.uniqid}“]`);
  return [`Betreff: ${clean(m.subject) || '(kein Betreff)'}`, `Von: ${clean(m.from?.title || m.from?.userName)}`, `Datum: ${clean(m.date)}`,
    to.length ? `An: ${to.join(', ')}` : '', files.length ? `Anhänge: ${files.join('; ')}` : '',
    meta.isRead ? '' : '(War ungelesen und bleibt im Portal ungelesen.)', '', htmlText(m.text) || '(kein Text)'].filter((x, i) => x || i === 6).join('\n');
}

// ---------- notes & to-dos (account only; synced with the extension's "Mein Tag" dashboard) ----------
function needAccount(ctx) {
  if (!ctx?.acc) throw new InputError('Aufgaben und Notizen gibt es nur mit einem ISGY-KI-Konto: auf der Startseite des Servers ein Konto erstellen, die Erweiterung damit verbinden und die Verbindung zu „ISGY Intern“ mit dem Konto neu herstellen.');
  return ctx.acc;
}
const created = (n) => { const d = new Date(Number(n.id)); return isNaN(d) ? '' : d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }); };
const due = (n) => (n.date ? ` – fällig ${label(n.date)} (${rel(n.date)})${n.date < today() && !n.done ? ' ⚠ überfällig' : ''}` : '');
const todoLine = (n) => `- [${n.done ? 'x' : ' '}] ${clean(n.text)}${due(n)}  (id ${n.id})`;

async function openTodos(ctx) {
  if (!ctx?.acc) return null;
  try { return (await db.notes(ctx.acc.id)).filter((n) => n.type === 'todo' && !n.done); } catch { return null; }
}

async function notizen(portal, args, ctx) {
  const acc = needAccount(ctx);
  const all = await db.notes(acc.id);
  const art = args.art || 'offen';
  const todos = all.filter((n) => n.type === 'todo').sort((a, b) => a.done - b.done || (a.date || '9').localeCompare(b.date || '9') || a.id - b.id);
  const memos = all.filter((n) => n.type === 'note').sort((a, b) => b.id - a.id);
  const q = clean(args.suche).toLowerCase();
  const match = (n) => !q || n.text.toLowerCase().includes(q);
  const out = [];
  if (art !== 'notizen') {
    const open = todos.filter((n) => !n.done && match(n)), done = todos.filter((n) => n.done && match(n));
    out.push(`Aufgaben – offen (${open.length}):`, ...(open.length ? open.map(todoLine) : ['  keine']));
    if (art === 'alle' && done.length) out.push('', `Erledigt (${done.length}):`, ...done.map(todoLine));
  }
  if (art !== 'offen' || memos.length) {
    const m = memos.filter(match);
    out.push('', `Notizen (${m.length}):`, ...(m.length ? m.map((n) => `- ${indent(n.text, '  ')}  (vom ${created(n)}, id ${n.id})`) : ['  keine']));
  }
  out.push('', 'Quelle: „Mein Tag“-Dashboard der Erweiterung ISGY Intern Plus (über das Konto synchronisiert).');
  return out.join('\n').trim();
}

async function notizAnlegen(portal, args, ctx) {
  const acc = needAccount(ctx);
  const text = String(args.text || '').trim();
  if (!text) throw new InputError('Text fehlt.');
  if (text.length > 5000) throw new InputError('Höchstens 5000 Zeichen.');
  const type = args.art === 'notiz' ? 'note' : 'todo';
  const date = type === 'todo' && args.faellig ? dateArg(args.faellig, 'faellig') : null;
  const now = Date.now();
  const note = { id: now, type, text, date, done: false, updated: now, source: 'ki' };
  await db.upsertNotes(acc.id, [note]);
  return `${type === 'todo' ? 'Aufgabe' : 'Notiz'} gespeichert (id ${now}): „${text}“${date ? ` – fällig ${label(date)}` : ''}. Sie erscheint beim nächsten Öffnen von isgy-intern.de im „Mein Tag“-Dashboard der Erweiterung.`;
}

async function findNote(acc, id) {
  const all = await db.notes(acc.id);
  const n = all.find((x) => String(x.id) === String(id).replace(/\D/g, ''));
  if (!n) throw new InputError(`Keine Aufgabe/Notiz mit id ${id}. Mit dem Tool notizen die aktuellen ids abrufen.`);
  return n;
}

async function aufgabeErledigt(portal, args, ctx) {
  const acc = needAccount(ctx);
  const n = await findNote(acc, args.id);
  if (n.type !== 'todo') throw new InputError('Das ist eine Notiz, keine Aufgabe.');
  const done = args.erledigt !== false;
  await db.upsertNotes(acc.id, [{ ...n, done, updated: Date.now(), source: 'ki' }]);
  return `Aufgabe „${clean(n.text)}“ ${done ? 'als erledigt abgehakt' : 'wieder als offen markiert'}.`;
}

async function notizLoeschen(portal, args, ctx) {
  const acc = needAccount(ctx);
  const n = await findNote(acc, args.id);
  await db.upsertNotes(acc.id, [{ ...n, deleted: true, updated: Date.now(), source: 'ki' }]);
  return `${n.type === 'todo' ? 'Aufgabe' : 'Notiz'} „${clean(n.text).slice(0, 80)}“ gelöscht.`;
}

// ---------- registry ----------
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const DATUM = { type: 'string', description: 'Datum: YYYY-MM-DD, TT.MM.JJJJ, „heute“, „morgen“, „übermorgen“ oder ein Wochentag (z. B. „Montag“ = nächster Montag).' };
const FACH = { type: 'string', description: 'Fach als Kürzel oder Name, z. B. „M“, „Mathe“, „E_1“, „Englisch“, „Physik“.' };

export const TOOLS = [
  {
    name: 'uebersicht',
    title: 'Überblick',
    description: 'Kompletter Überblick in einem Aufruf: laufende/nächste Stunde, Plan für heute bzw. den nächsten Schultag inkl. Vertretungen, fällige Hausaufgaben, alle Hausaufgaben der letzten Tage, anstehende Prüfungen und Termine. Erste Wahl für offene Fragen wie „Was steht an?“, „Wie sieht meine Woche aus?“ oder zum Gesprächsbeginn.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: uebersicht,
  },
  {
    name: 'tagesplan',
    title: 'Tagesplan',
    description: 'Ein Schultag im Detail: Stunden mit Uhrzeiten, Lehrkräften und Räumen, eingearbeitete Vertretungen/Entfälle, Freistunden, Schulschluss, Termine, die für diesen Tag fälligen Hausaufgaben und Prüfungen der folgenden Woche. Ohne Datum: heute bzw. nach Schulschluss der nächste Schultag. Für „Was habe ich morgen?“, „Fällt am Freitag was aus?“, „Was muss ich bis Montag machen?“.',
    inputSchema: { type: 'object', properties: { datum: DATUM }, additionalProperties: false },
    run: tagesplan,
  },
  {
    name: 'hausaufgaben',
    title: 'Hausaufgaben',
    description: 'Hausaufgaben mit Fälligkeit. Mit „faellig“ (z. B. „morgen“): was an DIESEM Tag abzugeben/zu erledigen ist – für „Was ist für morgen auf?“, „Hausaufgaben für Montag?“. Wichtig: Hausaufgaben für morgen wurden in der jeweils VORHERIGEN Stunde des Fachs aufgegeben, nicht morgen – dieses Tool rechnet das richtig (inkl. Entfälle, Ferien, Datumsangaben im Text). Ohne „faellig“: alle Hausaufgaben der letzten Schultage, nach Fälligkeit sortiert.',
    inputSchema: { type: 'object', properties: { faellig: { ...DATUM, description: 'Tag, an dem die Hausaufgaben fällig sind: „morgen“, „Montag“, YYYY-MM-DD … Für „Hausaufgaben für <Tag>“ immer diesen Parameter nutzen.' }, tage: { type: 'integer', minimum: 1, maximum: 30, description: 'Ohne faellig: wie viele Schultage zurück (Standard 7).' }, fach: FACH }, additionalProperties: false },
    run: hausaufgaben,
  },
  {
    name: 'pruefungen',
    title: 'Prüfungen & Lernstoff',
    description: 'Anstehende Schulaufgaben, Exen, Kurzarbeiten, Tests und Referate aus dem Klassenkalender – zu jeder Prüfung die Unterrichtsthemen der letzten Wochen aus dem Klassentagebuch als Grundlage zum Lernen. Für „Wann ist die nächste Schulaufgabe?“, „Was kommt in der Mathe-Ex dran?“, Lernpläne.',
    inputSchema: {
      type: 'object',
      properties: {
        tage: { type: 'integer', minimum: 1, maximum: 366, description: 'Zeitraum in Tagen (Standard 42).' },
        fach: { ...FACH, description: 'Optional: nur Prüfungen in diesem Fach.' },
        themen: { type: 'boolean', description: 'Unterrichtsthemen dazu laden (Standard true).' },
        wochen: { type: 'integer', minimum: 1, maximum: 12, description: 'Wie viele Wochen Unterrichtsthemen (Standard 6).' },
      },
      additionalProperties: false,
    },
    run: pruefungen,
  },
  {
    name: 'fach',
    title: 'Fach-Steckbrief',
    description: 'Alles zu einem Fach: Lehrkraft, Wochenstunden und Lage im Stundenplan, die nächsten Stunden (mit Vertretungen), anstehende Prüfungen und die letzten Tagebucheinträge mit Themen und Hausaufgaben.',
    inputSchema: { type: 'object', properties: { fach: FACH }, required: ['fach'], additionalProperties: false },
    run: fach,
  },
  {
    name: 'vertretungen',
    title: 'Vertretungsplan',
    description: 'Der Vertretungsplan: Vertretungen, Entfälle, Raumänderungen mit Uhrzeiten. Ohne Datum alle veröffentlichten Tage ab heute; standardmäßig nur die eigene Klasse. Nennt auch, für welche Tage der Plan schon veröffentlicht ist.',
    inputSchema: { type: 'object', properties: { datum: DATUM, alle_klassen: { type: 'boolean', description: 'true = Vertretungen aller Klassen statt nur der eigenen.' } }, additionalProperties: false },
    run: vertretungen,
  },
  {
    name: 'stundenplan',
    title: 'Stundenplan',
    description: 'Regulärer Wochenstundenplan (Mo–Fr) mit Uhrzeiten, Fächern, Lehrkräften (Name + Kürzel), Räumen und Wochenstunden je Fach. Ohne Vertretungen.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: stundenplan,
  },
  {
    name: 'tagebuch',
    title: 'Klassentagebuch',
    description: 'Einträge im Klassentagebuch (Thema, Hausaufgabe, Notiz, Lehrkraft, Vertretung/Entfall) für einen Tag oder Zeitraum, optional nur für ein Fach. Für „Was haben wir am Dienstag in Deutsch gemacht?“ oder um verpassten Stoff nachzuholen.',
    inputSchema: {
      type: 'object',
      properties: {
        datum: { ...DATUM, description: DATUM.description + ' Standard: heute (am Wochenende der letzte Schultag). Bei Zeitraum der erste Tag.' },
        bis: { ...DATUM, description: 'Optional: letzter Tag des Zeitraums (max. 31 Tage).' },
        fach: { ...FACH, description: 'Optional: nur dieses Fach.' },
      },
      additionalProperties: false,
    },
    run: tagebuch,
  },
  {
    name: 'letzter_eintrag',
    title: 'Letzter Tagebucheintrag',
    description: 'Die neuesten Tagebucheinträge eines Fachs (Thema + Hausaufgabe) und wann die nächste Stunde ist. Für „Was war zuletzt in Mathe?“, „Was ist die Englisch-Hausaufgabe?“. Sucht bis zu 12 Wochen zurück.',
    inputSchema: {
      type: 'object',
      properties: {
        fach: FACH,
        anzahl: { type: 'integer', minimum: 1, maximum: 10, description: 'Wie viele Unterrichtstage mit Einträgen (Standard 1).' },
        vor: { ...DATUM, description: 'Optional: nur Einträge vor diesem Datum.' },
      },
      required: ['fach'],
      additionalProperties: false,
    },
    run: letzterEintrag,
  },
  {
    name: 'termine',
    title: 'Termine',
    description: 'Alle Termine aus dem Klassenkalender (Prüfungen markiert, Ausflüge, Projekttage …) für einen Zeitraum.',
    inputSchema: {
      type: 'object',
      properties: {
        tage: { type: 'integer', minimum: 1, maximum: 366, description: 'Zeitraum in Tagen (Standard 21).' },
        ab: { ...DATUM, description: 'Optional: Startdatum (Standard heute).' },
      },
      additionalProperties: false,
    },
    run: termine,
  },
  {
    name: 'dokumente',
    title: 'Dokumente',
    description: 'Dateien aus dem Bereich „Dokumente“ von isgy-intern (Formulare, Hausordnung, Mathe-Grundwissen, Berufsberatung …) nach Kategorien, mit ref zum Lesen über datei_lesen. Für „Gibt es das Formular für …?“, „Was steht in der Hausordnung zu …?“.',
    inputSchema: { type: 'object', properties: { suche: { type: 'string', description: 'Optional: Suchbegriff in Titel/Dateiname.' }, kategorie: { type: 'string', description: 'Optional: Teil des Kategorienamens.' } }, additionalProperties: false },
    run: dokumente,
  },
  {
    name: 'datei_lesen',
    title: 'Datei lesen',
    description: 'Liest den Text einer Datei aus isgy-intern: Dokumente (ref „dl:…“ aus dokumente), Anhänge im Klassentagebuch, z. B. Arbeitsblätter (ref „tb:…“ aus tagebuch/hausaufgaben/letzter_eintrag) und Anhänge von Nachrichten (ref „msg:…“ aus nachricht). PDFs als Text; Bilder können nicht gelesen werden.',
    inputSchema: { type: 'object', properties: { ref: { type: 'string', description: 'Die ref aus einem anderen Tool, z. B. „tb:2026-10-06:123“.' }, max_zeichen: { type: 'integer', minimum: 1000, maximum: 100000, description: 'Höchstens so viele Zeichen Text (Standard 30000).' } }, required: ['ref'], additionalProperties: false },
    run: dateiLesen,
  },
  {
    name: 'nachrichten',
    title: 'Nachrichten (lesen)',
    description: 'Listet die Nachrichten im Postfach von isgy-intern (Posteingang, Gesendet, Archiv, Entwurf) mit Datum, Absender, Betreff, gelesen/ungelesen und Anhängen. Nur Lesen – es wird nichts gesendet, gelöscht oder verschoben. Text einer Nachricht mit dem Tool nachricht.',
    inputSchema: { type: 'object', properties: { ordner: { type: 'string', enum: ['Posteingang', 'Gesendet', 'Archiv', 'Entwurf'], description: 'Standard: Posteingang.' }, suche: { type: 'string', description: 'Optional: Suchbegriff in Betreff/Absender (durchsucht alle Nachrichten).' }, anzahl: { type: 'integer', minimum: 1, maximum: 100, description: 'Wie viele (Standard 20, neueste zuerst).' }, nur_ungelesen: { type: 'boolean', description: 'Nur ungelesene.' } }, additionalProperties: false },
    run: nachrichten,
  },
  {
    name: 'nachricht',
    title: 'Nachricht lesen',
    description: 'Zeigt eine Nachricht aus dem isgy-intern-Postfach vollständig (Absender, Empfänger, Text, Anhänge mit ref für datei_lesen). Nur Lesen: eine ungelesene Nachricht bleibt im Portal ungelesen.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id aus dem Tool nachrichten.' } }, required: ['id'], additionalProperties: false },
    run: nachricht,
  },
  {
    name: 'notizen',
    title: 'Meine Aufgaben & Notizen',
    description: 'Die eigenen Aufgaben (To-dos mit optionalem Fälligkeitsdatum) und Notizen des Nutzers aus dem „Mein Tag“-Dashboard der Browser-Erweiterung, mit ids. Nur mit ISGY-KI-Konto.',
    inputSchema: { type: 'object', properties: { art: { type: 'string', enum: ['offen', 'alle', 'notizen'], description: 'offen = offene Aufgaben + Notizen (Standard), alle = auch erledigte, notizen = nur Notizen.' }, suche: { type: 'string', description: 'Optional: nur Einträge, die diesen Text enthalten.' } }, additionalProperties: false },
    run: notizen,
  },
  {
    name: 'notiz_anlegen',
    title: 'Aufgabe/Notiz anlegen',
    description: 'Legt eine neue Aufgabe (optional mit Fälligkeitsdatum) oder Notiz im „Mein Tag“-Dashboard der Erweiterung an. Für „Schreib mir auf …“, „Erinnere mich an …“. Nur mit ISGY-KI-Konto.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Inhalt, kurz und klar (z. B. „Bio-Referat fertig machen“).' }, art: { type: 'string', enum: ['aufgabe', 'notiz'], description: 'aufgabe (Standard, mit Häkchen) oder notiz (freier Text).' }, faellig: { ...DATUM, description: 'Optional, nur für Aufgaben: fällig am.' } }, required: ['text'], additionalProperties: false },
    run: notizAnlegen,
    write: true,
  },
  {
    name: 'aufgabe_erledigt',
    title: 'Aufgabe abhaken',
    description: 'Hakt eine Aufgabe als erledigt ab (oder mit erledigt=false wieder als offen). id aus dem Tool notizen.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id der Aufgabe' }, erledigt: { type: 'boolean', description: 'Standard true' } }, required: ['id'], additionalProperties: false },
    run: aufgabeErledigt,
    write: true,
  },
  {
    name: 'notiz_loeschen',
    title: 'Aufgabe/Notiz löschen',
    description: 'Löscht eine Aufgabe oder Notiz endgültig (auch in der Erweiterung). Nur auf ausdrücklichen Wunsch des Nutzers. id aus dem Tool notizen.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'id der Aufgabe/Notiz' } }, required: ['id'], additionalProperties: false },
    run: notizLoeschen,
    write: true,
    destructive: true,
  },
  {
    name: 'lehrer',
    title: 'Lehrkräfte',
    description: 'Löst Lehrerkürzel in Namen auf bzw. sucht Lehrkräfte nach Namen (Kürzel-Liste der Schule). Ohne Suchbegriff: alle. In den anderen Tools sind Namen schon aufgelöst.',
    inputSchema: { type: 'object', properties: { suche: { type: 'string', description: 'Kürzel (z. B. „Mm“) oder Teil des Namens.' } }, additionalProperties: false },
    run: lehrer,
  },
].map((t) => ({ ...t, annotations: { title: t.title, ...ro, ...(t.write ? { readOnlyHint: false, idempotentHint: false, openWorldHint: false, destructiveHint: !!t.destructive } : {}) } }));

// ---------- prompts (shown as ready-made actions in clients that support them) ----------
export const PROMPTS = [
  {
    name: 'mein_tag',
    title: 'Mein Schultag',
    description: 'Kurzer Überblick: was heute/morgen ansteht, was ausfällt, welche Hausaufgaben fällig sind.',
    arguments: [],
    text: () => 'Nutze das Tool „uebersicht“ von ISGY Intern und fasse mir meinen Schultag knapp zusammen: was gerade läuft bzw. als Nächstes kommt, was ausfällt oder vertreten wird, welche Hausaufgaben fällig sind und welche Prüfungen bald anstehen. Hebe Wichtiges (Entfall, Prüfung, fällige Hausaufgabe) hervor.',
  },
  {
    name: 'wochenvorschau',
    title: 'Wochenvorschau',
    description: 'Die kommenden Schultage mit Vertretungen, Prüfungen und Terminen.',
    arguments: [],
    text: () => 'Erstelle mir mit den Tools von ISGY Intern (tagesplan für jeden der nächsten 5 Schultage, dazu termine) eine kompakte Vorschau auf die kommende Schulwoche: pro Tag Unterrichtszeit, Entfälle/Vertretungen, Prüfungen und Termine. Schließe mit einer Liste, worauf ich mich vorbereiten muss.',
  },
  {
    name: 'hausaufgaben_check',
    title: 'Hausaufgaben-Check',
    description: 'Welche Hausaufgaben sind offen und bis wann?',
    arguments: [],
    text: () => 'Rufe das Tool „hausaufgaben“ von ISGY Intern einmal ohne Parameter (alle offenen, nach Fälligkeit) und einmal mit faellig="morgen" auf. Mache mir daraus eine To-do-Liste, sortiert nach Fälligkeit, und markiere, was bis morgen fällig ist. Übernimm Hinweise wie „Stunde entfällt“ oder „kein Tagebucheintrag“.',
  },
  {
    name: 'lernplan',
    title: 'Lernplan für eine Prüfung',
    description: 'Lernplan bis zur nächsten Prüfung in einem Fach, mit den Themen aus dem Unterricht.',
    arguments: [{ name: 'fach', description: 'Fach, z. B. Mathe', required: true }],
    text: (a) => `Rufe das Tool „pruefungen“ von ISGY Intern mit fach="${clean(a.fach) || 'Mathe'}" auf. Erstelle mir für die nächste Prüfung in diesem Fach einen realistischen Lernplan bis zum Prüfungstag (täglich 20–45 Minuten, Wochenenden eingeschlossen), basierend auf den Unterrichtsthemen aus dem Klassentagebuch. Schlage zu jedem Thema konkrete Übungen vor und plane am Ende eine Wiederholung ein.`,
  },
];
