// The MCP tools. Each returns plain German text that reads well for both the model and the user,
// with enough context (date, times, teachers, what's due) that the model rarely needs a second call.
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

// Next date after `afterDs` (max. 3 weeks) with a lesson in one of the subjects, per the regular timetable.
function nextLesson(sp, wanted, afterDs) {
  for (let i = 1; i <= 21; i++) {
    const d = addDays(afterDs, i);
    const hours = dayPlan(sp, d).map((slots, h) => ((slots || []).some((s) => subjectMatches(s.subject, wanted)) ? h + 1 : 0)).filter(Boolean);
    if (hours.length) return { d, hours };
  }
  return null;
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
  const lists = await mapLimit(days, 6, (x) => portal.tagebuch(x, ttlFor(x)));
  return days.map((x, i) => ({ d: x, es: dedupe(sortEntries(lists[i])) }));
}

function formatEntry(e, teacher, { withSubject = true, pre = '' } = {}) {
  const flags = [e.substitution && 'Vertretung', e.cancelled && 'entfallen'].filter(Boolean);
  const lines = [`${pre}${withSubject ? clean(e.subject) + ' · ' : ''}${clean(e.lesson)}. Std · ${teacher(e.teacher)}${flags.length ? ' · ' + flags.join(', ') : ''}`];
  if (clean(e.topic)) lines.push(`${pre}  Thema: ${indent(e.topic, pre + '         ')}`);
  lines.push(clean(e.homework) ? `${pre}  Hausaufgabe: ${indent(e.homework, pre + '               ')}` : `${pre}  Hausaufgabe: keine eingetragen`);
  if (clean(e.notes)) lines.push(`${pre}  Notiz: ${indent(e.notes, pre + '         ')}`);
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

// For each subject of a day: the homework from its most recent diary entry before that day.
function dueHomework(day, diary, ds) {
  const subjects = [...new Set(day.items.filter((it) => !it.cancel).map((it) => clean(it.slot.subject)))];
  const out = [];
  for (const subj of subjects) {
    const hit = diary.find(({ d, es }) => d < ds && es.some((e) => subjectMatches(e.subject, [subj])));
    if (!hit) continue;
    const hw = hit.es.filter((e) => subjectMatches(e.subject, [subj]) && clean(e.homework)).map((e) => multiline(e.homework));
    out.push(hw.length ? `- ${subj}: ${indent([...new Set(hw)].join('\n'), '  ')}  (aufgegeben ${short(hit.d)})` : `- ${subj}: keine Hausaufgabe im letzten Eintrag (${short(hit.d)})`);
  }
  return out;
}

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
async function tagesplan(portal, args) {
  const { sp, cls, teacher } = await context(portal);
  const ds = args.datum ? dateArg(args.datum) : defaultDay(sp);
  const [vp, kal, diary] = await Promise.all([
    safe(portal.vplan(), []), safe(portal.kalender(cls), { events: [] }),
    ds >= today() && !isWeekend(ds) ? safe(diaryDays(portal, addDays(ds, -1), 15), []) : { v: [] },
  ]);
  const day = buildDay(ds, sp, vp.v, cls, teacher);
  const out = [`${label(ds)} (${rel(ds)}) – Klasse ${cls}`];
  if (isWeekend(ds)) out.push('Wochenende – kein Unterricht.', `Nächster Schultag: ${label(nextSchoolDay(ds))}.`);
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
  const hw = diary.v?.length ? dueHomework(day, diary.v, ds) : [];
  if (hw.length) out.push('', 'Hausaufgaben für diesen Tag (jeweils aus dem letzten Tagebucheintrag des Fachs):', ...hw);
  const soon = kal.v.events.filter((e) => isExam(e) && inRange(e, addDays(ds, 1), addDays(ds, 7))).sort(byStart);
  if (soon.length) out.push('', 'Prüfungen in den Tagen danach:', ...soon.map((e) => '- ' + formatEvent(e, cls)));
  return out.join('\n');
}

// ---------- uebersicht ----------
async function uebersicht(portal) {
  const { sp, cls, teacher } = await context(portal);
  const t = today();
  const [vp, kal, diary] = await Promise.all([safe(portal.vplan(), []), safe(portal.kalender(cls), { events: [] }), safe(diaryDays(portal, t, 10), [])]);
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
  const hwDue = diary.v?.length ? dueHomework(day, diary.v, ds) : [];
  if (hwDue.length) out.push('', `HAUSAUFGABEN FÜR ${short(ds).toUpperCase()}:`, ...hwDue);

  const allHw = (diary.v || []).slice(0, 5).flatMap(({ d, es }) => es.filter((e) => clean(e.homework)).map((e) => ({ d, e })));
  if (allHw.length) {
    out.push('', 'ALLE HAUSAUFGABEN DER LETZTEN 5 SCHULTAGE:');
    for (const { d, e } of allHw) {
      const nx = nextLesson(sp, [clean(e.subject)], d);
      out.push(`- ${clean(e.subject)} (${short(d)}): ${indent(e.homework, '  ')}${nx ? `  → nächste Stunde ${short(nx.d)}` : ''}`);
    }
  }
  const evs = kal.v.events.filter((e) => inRange(e, t, addDays(t, 21))).sort(byStart);
  const exams = evs.filter(isExam), other = evs.filter((e) => !isExam(e) && inRange(e, t, addDays(t, 10)));
  if (exams.length) out.push('', 'PRÜFUNGEN (nächste 3 Wochen):', ...exams.map((e) => '- ' + formatEvent(e, cls)));
  if (other.length) out.push('', 'WEITERE TERMINE (nächste 10 Tage):', ...other.map((e) => '- ' + formatEvent(e, cls)));
  if (kal.err) out.push('', `(Klassenkalender nicht verfügbar: ${kal.err})`);
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
  if (diffDays(von, bis) > 31) throw new InputError('Höchstens 31 Tage auf einmal.');
  const wanted = args.fach ? requireSubject(args.fach, sp) : null;
  const days = [];
  for (let d = von; d <= bis && d <= today(); d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
  const lists = await mapLimit(days, 6, (d) => portal.tagebuch(d, ttlFor(d)));
  const out = [];
  days.forEach((d, i) => {
    const es = dedupe(sortEntries(lists[i].filter((e) => !wanted || subjectMatches(e.subject, wanted))));
    if (es.length) out.push(`${label(d)} (${rel(d)}):`, ...es.map((e) => formatEntry(e, teacher, { pre: '  ' })), '');
  });
  const what = `${wanted ? ' für ' + wanted.join('/') : ''} ${von === bis ? 'am ' + label(von) : `von ${deDate(von)} bis ${deDate(bis)}`}`;
  if (!out.length) return `Keine Tagebucheinträge${what}.${bis > today() ? ' (Für zukünftige Tage gibt es noch keine Einträge.)' : ''}`;
  return [`Klassentagebuch${what}:`, '', ...out].join('\n').trim();
}

// ---------- hausaufgaben ----------
async function hausaufgaben(portal, args) {
  const { sp, teacher } = await context(portal);
  const n = clamp(args.tage, 7, 1, 30);
  const wanted = args.fach ? requireSubject(args.fach, sp) : null;
  const diary = await diaryDays(portal, today(), n);
  const out = [];
  for (const { d, es } of diary) {
    const hw = es.filter((e) => clean(e.homework) && (!wanted || subjectMatches(e.subject, wanted)));
    if (!hw.length) continue;
    out.push(`${label(d)} (${rel(d)}):`);
    for (const e of hw) {
      const nx = nextLesson(sp, [clean(e.subject)], d);
      out.push(`- ${clean(e.subject)} bei ${teacher(e.teacher)}: ${indent(e.homework, '  ')}`);
      if (nx) out.push(`  → nächste ${clean(e.subject)}-Stunde laut Stundenplan: ${label(nx.d)} (${rel(nx.d)}), ${nx.hours[0]}. Std`);
    }
    out.push('');
  }
  if (!out.length) return `In den letzten ${n} Schultagen wurde${wanted ? ' für ' + wanted.join('/') : ''} keine Hausaufgabe ins Klassentagebuch eingetragen.`;
  return [`Hausaufgaben aus dem Klassentagebuch (letzte ${n} Schultage, neueste zuerst).`,
    'Fällig ist eine Hausaufgabe normalerweise zur nächsten Stunde des Fachs, außer im Text steht ein anderes Datum.', '', ...out].join('\n').trim();
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
  const out = found.map(({ d, es }) => `${label(d)} (${rel(d)}):\n${es.map((e) => formatEntry(e, teacher, { pre: '  ' })).join('\n')}`);
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
    description: 'Alle Hausaufgaben aus dem Klassentagebuch der letzten Schultage, nach Tag gruppiert, jeweils mit der nächsten Stunde des Fachs (= übliche Fälligkeit). Optional nur ein Fach.',
    inputSchema: { type: 'object', properties: { tage: { type: 'integer', minimum: 1, maximum: 30, description: 'Wie viele Schultage zurück (Standard 7).' }, fach: FACH }, additionalProperties: false },
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
    name: 'lehrer',
    title: 'Lehrkräfte',
    description: 'Löst Lehrerkürzel in Namen auf bzw. sucht Lehrkräfte nach Namen (Kürzel-Liste der Schule). Ohne Suchbegriff: alle. In den anderen Tools sind Namen schon aufgelöst.',
    inputSchema: { type: 'object', properties: { suche: { type: 'string', description: 'Kürzel (z. B. „Mm“) oder Teil des Namens.' } }, additionalProperties: false },
    run: lehrer,
  },
].map((t) => ({ ...t, annotations: { title: t.title, ...ro } }));

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
    text: () => 'Hole mit dem Tool „hausaufgaben“ von ISGY Intern die Hausaufgaben der letzten 7 Schultage und mache mir daraus eine To-do-Liste, sortiert nach Fälligkeit (nächste Stunde des Fachs). Markiere, was bis morgen fällig ist.',
  },
  {
    name: 'lernplan',
    title: 'Lernplan für eine Prüfung',
    description: 'Lernplan bis zur nächsten Prüfung in einem Fach, mit den Themen aus dem Unterricht.',
    arguments: [{ name: 'fach', description: 'Fach, z. B. Mathe', required: true }],
    text: (a) => `Rufe das Tool „pruefungen“ von ISGY Intern mit fach="${clean(a.fach) || 'Mathe'}" auf. Erstelle mir für die nächste Prüfung in diesem Fach einen realistischen Lernplan bis zum Prüfungstag (täglich 20–45 Minuten, Wochenenden eingeschlossen), basierend auf den Unterrichtsthemen aus dem Klassentagebuch. Schlage zu jedem Thema konkrete Übungen vor und plane am Ende eine Wiederholung ein.`,
  },
];
