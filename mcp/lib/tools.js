// The MCP tools. Each returns plain German text that reads well for both the model and the user.
import { TIMES, DAYS, today, nowMinutes, addDays, isWeekend, weekday, diffDays, deDate, label, fromDe, parseDay, nextSchoolDay } from './dates.js';

// Bad arguments from the model: reported back as tool error, not logged.
export class InputError extends Error {}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const multiline = (s) => String(s ?? '').replace(/\r/g, '').replace(/\n\s*\n+/g, '\n').trim();
const lessonsOf = (s) => {
  const [a, b] = String(s).split('-').map((x) => parseInt(x, 10));
  return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
};
const classMatch = (k, cls) => String(k).split(/[,\s]+/).some((t) => t === cls || t.startsWith(cls + '_'));
const dayPlan = (sp, ds) => (weekday(ds) >= 1 && weekday(ds) <= 5 ? sp.plan?.[weekday(ds) - 1] || [] : []);
const endOf = (n) => { const [h, m] = (TIMES[n] || '').split(':').map(Number); return isNaN(h) ? null : h * 60 + m + 45; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const range = (a, b) => (a === b ? `${a}.` : `${a}.–${b}.`);

function teacherFn(kz) {
  return (code, fallback = '') => {
    const c = clean(code);
    const n = kz[c];
    return n ? `${n} (${c})` : clean(fallback) || c;
  };
}

// Same matching as the extension's dashboard: which substitution belongs to which lesson.
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

const subjectsOf = (sp) => [...new Set(sp.plan.flat(2).map((s) => clean(s?.subject)).filter(Boolean))].sort();

const ALIASES = {
  mathe: 'M', mathematik: 'M', deutsch: 'D', englisch: 'E', französisch: 'F', franzoesisch: 'F', latein: 'L', spanisch: 'Spa', italienisch: 'It',
  physik: 'Ph', chemie: 'C', biologie: 'B', bio: 'B', geschichte: 'G', geographie: 'Geo', erdkunde: 'Geo', informatik: 'Inf',
  musik: 'Mu', kunst: 'Ku', sport: 'Sp', ethik: 'Eth', evangelisch: 'Ev', katholisch: 'K', religion: 'K', wirtschaft: 'WR', sozialkunde: 'Sk', politik: 'PuG',
};
// Map what the model passes ("Mathe", "m", "M_1") to subject codes present in the timetable.
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

function dateArg(input, name = 'datum') {
  const d = parseDay(input);
  if (!d) throw new InputError(`Unbekanntes Datum für „${name}“: ${input}. Erlaubt: YYYY-MM-DD, TT.MM.JJJJ, heute, morgen, Wochentag.`);
  return d;
}

// ---------- tagesplan ----------
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
      else items.push({ from: n, to: n, slot: s, subs });
    }
  });
  const lines = items.map((it) => {
    const s = it.slot;
    const base = `${range(it.from, it.to)} Std (${TIMES[it.from] || '?'}) ${clean(s.subject)} · ${teacher(s.teacher)}${clean(s.room) ? ' · Raum ' + clean(s.room) : ''}`;
    return [base, ...it.subs.map((v) => '   → ' + subInfo(v, teacher).text)].join('\n');
  });
  const orphans = vp.filter((v) => !used.has(v)).map((v) => `${clean(v.stunde)}. Std ${clean(v.fach_alt)}: ${subInfo(v, teacher).text}`);
  return { items, lines, orphans, subCount: vp.length };
}

function formatEvent(e, cls) {
  const title = clean(e.title).replace(new RegExp('^' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*'), '');
  const when = e.dateEnd && e.dateEnd !== e.dateStart ? `${deDate(e.dateStart)} – ${deDate(e.dateEnd)}` : label(e.dateStart);
  const extra = [e.lnw?.title || e.lnw?.short, e.stunde && `${clean(e.stunde)}. Std`, clean(e.timeStart) && clean(e.timeStart) !== '00:00' && `${clean(e.timeStart).slice(0, 5)} Uhr`, clean(e.place)].filter(Boolean);
  return `${when}: ${e.fach_title ? clean(e.fach_title) + ' – ' : ''}${title}${extra.length ? ' (' + extra.join(', ') + ')' : ''}`;
}

async function safe(promise, fallback) {
  try { return { v: await promise }; } catch (e) { return { v: fallback, err: e.message }; }
}

async function tagesplan(portal, args) {
  const { sp, cls, teacher } = await context(portal);
  let ds;
  if (args.datum) ds = dateArg(args.datum);
  else {
    // After the last lesson of today, show the next school day (like the extension's dashboard).
    ds = nextSchoolDay(today());
    if (ds === today()) {
      const last = dayPlan(sp, ds).reduce((m, x, i) => (x?.length ? i + 1 : m), 0);
      const end = endOf(last);
      if (end != null && nowMinutes() > end) ds = nextSchoolDay(today(), false);
    }
  }
  const [vp, kal] = await Promise.all([safe(portal.vplan(), []), safe(portal.kalender(cls), { events: [] })]);
  const day = buildDay(ds, sp, vp.v, cls, teacher);
  const out = [`${label(ds)} – Klasse ${cls}`];
  if (isWeekend(ds)) out.push('Wochenende – kein Unterricht.');
  else if (!day.lines.length) out.push('Laut Stundenplan kein Unterricht.');
  else out.push('', ...day.lines);
  if (day.orphans.length) out.push('', 'Weitere Vertretungen:', ...day.orphans.map((x) => '- ' + x));
  if (vp.err) out.push('', `(Vertretungsplan nicht verfügbar: ${vp.err})`);
  else if (!day.subCount && !isWeekend(ds)) out.push('', 'Keine Vertretungen für diesen Tag eingetragen' + (diffDays(today(), ds) > 7 ? ' (der Vertretungsplan ist evtl. noch nicht veröffentlicht).' : '.'));
  const evs = kal.v.events.filter((e) => e.dateStart <= ds && (e.dateEnd || e.dateStart) >= ds);
  if (evs.length) out.push('', 'Termine:', ...evs.map((e) => '- ' + formatEvent(e, cls)));
  if (kal.err) out.push(`(Klassenkalender nicht verfügbar: ${kal.err})`);
  return out.join('\n');
}

// ---------- stundenplan ----------
async function stundenplan(portal) {
  const { sp, cls, teacher } = await context(portal);
  const out = [`Stundenplan Klasse ${cls} (regulär, ohne Vertretungen)`];
  sp.plan.slice(0, 5).forEach((hours, d) => {
    out.push('', DAYS[d + 1] + ':');
    const items = [];
    (hours || []).forEach((slots, i) => (slots || []).forEach((s) => {
      const prev = items.find((it) => it.to === i && it.s.subject === s.subject && it.s.teacher === s.teacher && it.s.room === s.room);
      if (prev) prev.to = i + 1; else items.push({ from: i + 1, to: i + 1, s });
    }));
    if (!items.length) out.push('  kein Unterricht');
    for (const it of items) out.push(`  ${range(it.from, it.to)} Std (${TIMES[it.from] || '?'}) ${clean(it.s.subject)} · ${teacher(it.s.teacher)}${clean(it.s.room) ? ' · Raum ' + clean(it.s.room) : ''}`);
  });
  out.push('', 'Stundenzeiten: ' + Object.entries(TIMES).map(([n, t]) => `${n}. ${t}`).join(', '));
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
  if (!list.length) {
    return `Keine Vertretungen für ${scope}${ds ? ' am ' + label(ds) : ' ab heute'}.` + (dates.length ? `\nVeröffentlichte Tage im Vertretungsplan: ${dates.map(deDate).join(', ')}` : '');
  }
  const byDay = new Map();
  for (const v of list) { const d = fromDe(v.date); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(v); }
  const out = [`Vertretungen (${scope}):`];
  for (const [d, vs] of [...byDay].sort(([a], [b]) => a.localeCompare(b))) {
    out.push('', label(d) + ':');
    vs.sort((a, b) => lessonsOf(a.stunde)[0] - lessonsOf(b.stunde)[0]);
    for (const v of vs) {
      const who = clean(v.user_alt_kurz) ? teacher(v.user_alt_kurz) : '';
      out.push(`- ${clean(v.stunde)}. Std${args.alle_klassen ? ' ' + clean(v.klasse) : ''} ${clean(v.fach_alt)}${who ? ' (' + who + ')' : ''}${clean(v.raum_alt) ? ', Raum ' + clean(v.raum_alt) : ''}: ${subInfo(v, teacher).text}`);
    }
  }
  return out.join('\n');
}

// ---------- tagebuch ----------
function formatEntry(e, teacher, withSubject = true) {
  const flags = [e.substitution && 'Vertretung', e.cancelled && 'entfallen'].filter(Boolean);
  const lines = [`${withSubject ? clean(e.subject) + ' · ' : ''}${clean(e.lesson)}. Std · ${teacher(e.teacher)}${flags.length ? ' · ' + flags.join(', ') : ''}`];
  if (clean(e.topic)) lines.push(`  Thema: ${multiline(e.topic).replace(/\n/g, '\n         ')}`);
  lines.push(clean(e.homework) ? `  Hausaufgabe: ${multiline(e.homework).replace(/\n/g, '\n               ')}` : '  Hausaufgabe: keine eingetragen');
  if (clean(e.notes)) lines.push(`  Notiz: ${multiline(e.notes)}`);
  return lines.join('\n');
}
const dedupe = (entries) => {
  const seen = new Set();
  return entries.filter((e) => { const k = `${clean(e.subject)}|${e.topic}|${e.homework}`; if (seen.has(k)) return false; seen.add(k); return true; });
};
const sortEntries = (es) => [...es].sort((a, b) => Number(a.lesson) - Number(b.lesson));
const ttlFor = (ds) => (ds < addDays(today(), -2) ? 3600 : 300);

async function tagebuch(portal, args) {
  const { sp, teacher } = await context(portal);
  // Default: today, or the last school day on weekends.
  let von = args.datum ? dateArg(args.datum) : today();
  if (!args.datum) while (isWeekend(von)) von = addDays(von, -1);
  const bis = args.bis ? dateArg(args.bis, 'bis') : von;
  if (bis < von) throw new InputError('„bis“ liegt vor „datum“.');
  if (diffDays(von, bis) > 31) throw new InputError('Höchstens 31 Tage auf einmal.');
  const wanted = args.fach ? resolveSubject(args.fach, subjectsOf(sp)) : null;
  if (wanted && !wanted.length) return `Fach „${args.fach}“ nicht im Stundenplan gefunden. Fächer: ${subjectsOf(sp).join(', ')}`;
  const days = [];
  for (let d = von; d <= bis; d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
  const lists = await Promise.all(days.map((d) => portal.tagebuch(d, ttlFor(d))));
  const out = [];
  days.forEach((d, i) => {
    const es = dedupe(sortEntries(lists[i].filter((e) => !wanted || subjectMatches(e.subject, wanted))));
    if (es.length) out.push(`${label(d)}:`, ...es.map((e) => formatEntry(e, teacher)), '');
  });
  if (!out.length) return `Keine Tagebucheinträge${wanted ? ' für ' + wanted.join('/') : ''} ${von === bis ? 'am ' + label(von) : `von ${deDate(von)} bis ${deDate(bis)}`}.`;
  return out.join('\n').trim();
}

// ---------- hausaufgaben ----------
async function hausaufgaben(portal, args) {
  const { teacher } = await context(portal);
  const n = Math.min(Math.max(parseInt(args.tage ?? 7, 10) || 7, 1), 30);
  const days = [];
  for (let d = today(); days.length < n; d = addDays(d, -1)) if (!isWeekend(d)) days.push(d);
  const lists = await Promise.all(days.map((d) => portal.tagebuch(d, ttlFor(d))));
  const out = [];
  days.forEach((d, i) => {
    const es = dedupe(sortEntries(lists[i].filter((e) => clean(e.homework))));
    if (es.length) out.push(`${label(d)}:`, ...es.map((e) => `- ${clean(e.subject)} (${teacher(e.teacher)}): ${multiline(e.homework).replace(/\n/g, '\n  ')}`), '');
  });
  if (!out.length) return `In den letzten ${n} Schultagen wurden keine Hausaufgaben ins Klassentagebuch eingetragen.`;
  return [`Hausaufgaben aus dem Klassentagebuch (letzte ${n} Schultage, neueste zuerst; Fälligkeit steht im Text, sofern die Lehrkraft sie angegeben hat):`, '', ...out].join('\n').trim();
}

// ---------- letzter_eintrag ----------
async function letzterEintrag(portal, args) {
  const { sp, teacher } = await context(portal);
  const subjects = subjectsOf(sp);
  const wanted = resolveSubject(args.fach, subjects);
  if (!wanted.length) return `Fach „${args.fach}“ nicht im Stundenplan gefunden. Fächer: ${subjects.join(', ')}`;
  const from = args.vor ? addDays(dateArg(args.vor, 'vor'), -1) : today();
  const count = Math.min(Math.max(parseInt(args.anzahl ?? 1, 10) || 1, 1), 10);
  const days = [];
  for (let i = 0; i <= 60; i++) { const d = addDays(from, -i); if (!isWeekend(d)) days.push(d); }
  const found = [];
  for (let i = 0; i < days.length && found.length < count; i += 6) {
    const chunk = days.slice(i, i + 6);
    const lists = await Promise.all(chunk.map((d) => portal.tagebuch(d, ttlFor(d))));
    chunk.forEach((d, j) => {
      const es = dedupe(sortEntries(lists[j].filter((e) => subjectMatches(e.subject, wanted))));
      if (es.length && found.length < count) found.push({ d, es });
    });
  }
  if (!found.length) return `Kein Tagebucheintrag für ${wanted.join('/')} in den letzten 60 Tagen${args.vor ? ' vor ' + deDate(dateArg(args.vor)) : ''}.`;
  return found.map(({ d, es }) => `${label(d)}:\n${es.map((e) => formatEntry(e, teacher)).join('\n')}`).join('\n\n');
}

// ---------- termine ----------
async function termine(portal, args) {
  const { cls } = await context(portal);
  const from = args.ab ? dateArg(args.ab, 'ab') : today();
  const n = Math.min(Math.max(parseInt(args.tage ?? 21, 10) || 21, 1), 366);
  const to = addDays(from, n);
  const { kalender, events } = await portal.kalender(cls);
  const items = events.filter((e) => (e.dateEnd || e.dateStart) >= from && e.dateStart <= to)
    .sort((a, b) => (a.dateStart + (a.timeStart || '')).localeCompare(b.dateStart + (b.timeStart || '')));
  const src = kalender.map((k) => clean(k.title)).filter(Boolean).join(', ');
  if (!items.length) return `Keine Termine von ${deDate(from)} bis ${deDate(to)}${src ? ' (Kalender: ' + src + ')' : ''}.`;
  return [`Termine ${deDate(from)} – ${deDate(to)}${src ? ' (Kalender: ' + src + ')' : ''}:`, ...items.map((e) => '- ' + formatEvent(e, cls))].join('\n');
}

// ---------- lehrer ----------
async function lehrer(portal, args) {
  const kz = await portal.kuerzel();
  const q = clean(args.suche).toLowerCase();
  const all = Object.entries(kz).sort(([a], [b]) => a.localeCompare(b));
  const hits = q ? all.filter(([k, n]) => k.toLowerCase() === q || n.toLowerCase().includes(q)) : all;
  if (!hits.length) return `Keine Lehrkraft zu „${args.suche}“ gefunden.`;
  return hits.slice(0, 300).map(([k, n]) => `${k}: ${n}`).join('\n');
}

// ---------- registry ----------
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const DATUM = { type: 'string', description: 'Datum: YYYY-MM-DD, TT.MM.JJJJ, „heute“, „morgen“ oder ein Wochentag (z. B. „Montag“ = nächster Montag).' };

export const TOOLS = [
  {
    name: 'tagesplan',
    title: 'Tagesplan',
    description: 'Unterricht eines Tages mit eingearbeiteten Vertretungen/Entfällen und Terminen aus dem Klassenkalender. Ohne Datum: heute, nach Unterrichtsende der nächste Schultag. Beste Wahl für Fragen wie „Was habe ich morgen?“ oder „Fällt heute etwas aus?“.',
    inputSchema: { type: 'object', properties: { datum: DATUM }, additionalProperties: false },
    run: tagesplan,
  },
  {
    name: 'stundenplan',
    title: 'Stundenplan',
    description: 'Regulärer Wochenstundenplan der eigenen Klasse (Montag–Freitag) mit Fächern, Lehrkräften (Name und Kürzel), Räumen und Stundenzeiten.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: stundenplan,
  },
  {
    name: 'vertretungen',
    title: 'Vertretungsplan',
    description: 'Vertretungsplan: Vertretungen, Entfälle und Raumänderungen. Ohne Datum alle veröffentlichten Tage ab heute; standardmäßig nur die eigene Klasse.',
    inputSchema: { type: 'object', properties: { datum: DATUM, alle_klassen: { type: 'boolean', description: 'true = Vertretungen aller Klassen statt nur der eigenen.' } }, additionalProperties: false },
    run: vertretungen,
  },
  {
    name: 'hausaufgaben',
    title: 'Hausaufgaben',
    description: 'Alle Hausaufgaben, die in den letzten Schultagen ins Klassentagebuch eingetragen wurden, nach Tag gruppiert.',
    inputSchema: { type: 'object', properties: { tage: { type: 'integer', minimum: 1, maximum: 30, description: 'Wie viele Schultage zurück (Standard 7).' } }, additionalProperties: false },
    run: hausaufgaben,
  },
  {
    name: 'tagebuch',
    title: 'Klassentagebuch',
    description: 'Einträge im Klassentagebuch (Thema, Hausaufgabe, Notiz, Lehrkraft) für einen Tag oder Zeitraum, optional nur für ein Fach.',
    inputSchema: {
      type: 'object',
      properties: {
        datum: { ...DATUM, description: DATUM.description + ' Standard: heute (am Wochenende der letzte Schultag). Bei Zeitraum der erste Tag.' },
        bis: { ...DATUM, description: 'Optional: letzter Tag des Zeitraums (max. 31 Tage).' },
        fach: { type: 'string', description: 'Optional: Fach, z. B. „M“, „Mathe“, „E_1“ oder „Deutsch“.' },
      },
      additionalProperties: false,
    },
    run: tagebuch,
  },
  {
    name: 'letzter_eintrag',
    title: 'Letzter Tagebucheintrag',
    description: 'Der neueste Tagebucheintrag (Thema + Hausaufgabe) eines Fachs, z. B. um herauszufinden, was zuletzt in Mathe gemacht wurde oder was als Hausaufgabe aufgegeben wurde. Sucht bis zu 60 Tage zurück.',
    inputSchema: {
      type: 'object',
      properties: {
        fach: { type: 'string', description: 'Fach, z. B. „M“, „Mathe“, „Englisch“ oder „E_1“.' },
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
    description: 'Termine aus dem Klassenkalender (Schulaufgaben, Kurzarbeiten, Ausflüge …).',
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
    description: 'Löst Lehrerkürzel in Namen auf bzw. sucht Lehrkräfte nach Namen (aus der Kürzel-Liste der Schule). Ohne Suchbegriff: alle.',
    inputSchema: { type: 'object', properties: { suche: { type: 'string', description: 'Kürzel (z. B. „Mm“) oder Teil des Namens.' } }, additionalProperties: false },
    run: lehrer,
  },
].map((t) => ({ ...t, annotations: { title: t.title, ...ro } }));
