/* ISGY Intern Plus – content script. Runs on every isgy-intern.de page. */
(async () => {
  'use strict';
  if (window.__isgyPlus) return;
  window.__isgyPlus = true;

  const sync = chrome.storage.sync;
  const local = chrome.storage.local;
  const S = Object.assign({}, ISGY_DEFAULTS, await sync.get(null));
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'sync') return;
    for (const [k, { newValue }] of Object.entries(ch)) S[k] = newValue ?? ISGY_DEFAULTS[k];
    if (ch.pins) renderPins();
  });
  document.documentElement.style.setProperty('--ip-accent', S.accent);
  const page = new URLSearchParams(location.search).get('page') || '';

  // ---------- helpers ----------
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== '') el.append(c instanceof Node ? c : String(c));
    return el;
  }
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deShort = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  const deFull = (d) => `${deShort(d)}${d.getFullYear()}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const TIMES = { 1: '07:55', 2: '08:40', 3: '09:45', 4: '10:30', 5: '11:30', 6: '12:15', 7: '13:55', 8: '14:40' };
  const clean = (s) => String(s ?? '').trim();
  const getJSON = async (url, opt) => {
    const r = await fetch(url, opt);
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  };

  // The site's REST endpoints for vplan/klassenkalender want the app key that the page embeds in an inline script.
  const KEY_RE = /(?:apiKey["']?\s*[:=]\s*|_widget_vplan_apiKey\s*=\s*)["']([0-9a-zA-Z]{6,})["']/;
  async function apiKey() {
    let m = [...document.scripts].map((s) => s.textContent).join('\n').match(KEY_RE);
    if (!m) {
      const { apiKey: cached } = await local.get('apiKey');
      if (cached) return cached;
      m = (await (await fetch('index.php?page=ext_klassenkalender')).text()).match(KEY_RE);
    }
    if (m) local.set({ apiKey: m[1] });
    return m ? m[1] : '';
  }
  const authHeaders = async () => ({
    'auth-app': await apiKey(),
    'auth-session': (localStorage.getItem('session') || '').replace('__q_strn|', ''),
  });

  // ---------- Kürzel (teacher codes) ----------
  // The PDF is fetched from the school server with the user's session, parsed in memory,
  // and only the code → name map is kept in chrome.storage.local. The PDF itself is never stored.
  let KZ = (await local.get('kuerzel')).kuerzel || null;

  function parseKuerzelPage(items) {
    const head = Object.fromEntries(items.filter((i) => /^(Kürzel|Person|Tätigkeit)$/.test(i.str.trim())).map((i) => [i.str.trim(), i.transform[4]]));
    const nameFrom = (head.Person ?? 76) - 10, nameTo = (head['Tätigkeit'] ?? 236) - 5;
    const rows = {};
    for (const i of items) {
      if (!i.str.trim()) continue;
      const y = Math.round(i.transform[5]), x = i.transform[4];
      const r = (rows[y] ??= { k: '', n: '' });
      if (x < nameFrom) r.k += i.str;
      else if (x < nameTo) r.n += i.str;
    }
    return Object.values(rows);
  }
  function rowsToMap(rows) {
    const map = {};
    for (const { k, n } of rows) if (/^[A-ZÄÖÜ][a-zäöüß]{0,2}$/.test(k.trim()) && n.trim()) map[k.trim()] = n.trim().replace(/\s+/g, ' ');
    return map;
  }
  async function loadKuerzel(force = false) {
    if (KZ && !force) return KZ;
    const pdfjs = await import(chrome.runtime.getURL('lib/pdf.min.mjs'));
    // Run the pdf.js worker on the main thread: a cross-origin Worker can't be created from a content script.
    globalThis.pdfjsWorker ??= await import(chrome.runtime.getURL('lib/pdf.worker.min.mjs'));
    pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');
    const res = await fetch(S.kuerzelPdfUrl);
    if (!res.ok || !(res.headers.get('content-type') || '').includes('pdf')) throw new Error('Kürzel-PDF nicht gefunden – URL in den Einstellungen prüfen.');
    const doc = await pdfjs.getDocument({ data: await res.arrayBuffer(), isEvalSupported: false }).promise;
    const rows = [];
    for (let p = 1; p <= doc.numPages; p++) rows.push(...parseKuerzelPage((await (await doc.getPage(p)).getTextContent()).items));
    await doc.destroy();
    const map = rowsToMap(rows);
    if (Object.keys(map).length < 5) throw new Error('Kürzel-PDF konnte nicht gelesen werden.');
    KZ = map;
    await local.set({ kuerzel: KZ, kuerzelLoaded: new Date().toISOString() });
    return KZ;
  }
  const teacher = (code) => {
    const n = KZ?.[clean(code)];
    if (!n || S.kuerzelFormat === 'off') return clean(code);
    return S.kuerzelFormat === 'name' ? n : `${n} (${clean(code)})`;
  };

  // Replace codes inside the site's own timetable slots. Only the text node's value is changed so Vue keeps control of it.
  function replaceCodes() {
    if (!KZ || S.kuerzelFormat === 'off') return;
    for (const el of document.querySelectorAll('.stundenplan-slot-meta')) {
      const tn = [...el.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      const code = tn && tn.nodeValue.trim();
      if (code && KZ[code]) { tn.nodeValue = teacher(code); el.title = code; }
    }
  }
  let rafQueued = false;
  new MutationObserver(() => {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(() => { rafQueued = false; replaceCodes(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // ---------- Tagebuch ----------
  const dayCache = new Map();
  const tagebuchDay = (ds) => {
    if (!dayCache.has(ds)) dayCache.set(ds, getJSON(`rest.php/tagebuch/getList/${ds}`).then((j) => j.data?.entries || []).catch(() => []));
    return dayCache.get(ds);
  };
  const subjectCache = new Map();
  function lastEntry(subject) {
    if (!subjectCache.has(subject)) subjectCache.set(subject, (async () => {
      const days = [];
      for (let i = 0; i <= S.lookbackDays; i++) { const d = addDays(today(), -i); if (!isWeekend(d)) days.push(d); }
      for (let i = 0; i < days.length; i += 5) {
        const chunk = days.slice(i, i + 5);
        const lists = await Promise.all(chunk.map((d) => tagebuchDay(iso(d))));
        for (let j = 0; j < chunk.length; j++) {
          const es = lists[j].filter((e) => e.subject === subject);
          if (es.length) return { date: chunk[j], entries: es };
        }
      }
      return null;
    })());
    return subjectCache.get(subject);
  }
  function entryView(res, subject) {
    if (!res) return h('div', { class: 'ip-muted' }, `Kein Tagebucheintrag für ${subject} in den letzten ${S.lookbackDays} Tagen.`);
    const seen = new Set();
    return h('div', { class: 'ip-entry' },
      h('div', { class: 'ip-entry-head' }, `Letzter Eintrag: ${DAYS[res.date.getDay()]}, ${deShort(res.date)}`),
      res.entries.map((e) => {
        const key = e.topic + '|' + e.homework;
        if (seen.has(key)) return null;
        seen.add(key);
        return h('div', { class: 'ip-entry-item' },
          h('div', { class: 'ip-muted' }, `${e.lesson}. Std · ${teacher(e.teacher)}${e.substitution ? ' · Vertretung' : ''}${e.cancelled ? ' · entfallen' : ''}`),
          e.topic && h('p', {}, h('b', {}, 'Thema: '), e.topic),
          clean(e.homework) ? h('p', { class: 'ip-hw' }, h('b', {}, 'Hausaufgabe: '), clean(e.homework).replace(/(\r?\n\s*)+/g, '\n')) : h('p', { class: 'ip-muted' }, 'Keine Hausaufgabe eingetragen.'),
          e.notes && h('p', {}, h('b', {}, 'Notiz: '), e.notes));
      }),
      h('a', { class: 'ip-link', href: `index.php?page=ext_tagebuch&view=default&date=${iso(res.date)}` }, 'Im Tagebuch öffnen →'));
  }
  function showModal(title, body) {
    const dlg = h('dialog', { class: 'ip-modal', onclose: () => dlg.remove() },
      h('div', { class: 'ip-modal-head' }, h('b', {}, title), h('button', { class: 'ip-x', onclick: () => dlg.close(), 'aria-label': 'Schließen' }, '×')),
      body);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    dlg.showModal();
    return dlg;
  }
  async function showLastEntry(subject) {
    const body = h('div', {}, h('div', { class: 'ip-muted' }, 'Suche letzten Eintrag …'));
    showModal(subject, body);
    body.replaceChildren(entryView(await lastEntry(subject), subject));
  }
  // Click on any timetable slot of the site (Stundenplan page + original dashboard widget).
  document.addEventListener('click', (e) => {
    const slot = e.target.closest('.stundenplan-slot');
    if (!slot || e.target.closest('a,button')) return;
    const subj = clean(slot.querySelector('.stundenplan-slot-subject')?.textContent);
    if (subj) showLastEntry(subj);
  });

  // ---------- Notes ----------
  let notes = (await local.get('notes')).notes || [];
  const saveNotes = () => local.set({ notes });

  // ---------- Dashboard ----------
  const lessonsOf = (s) => {
    const [a, b] = String(s).split('-').map((x) => parseInt(x, 10));
    return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
  };
  const classMatch = (k, cls) => String(k).split(/[,\s]+/).some((t) => t === cls || t.startsWith(cls + '_'));

  // Dashboard shows just the name (code in tooltip) to keep rows calm.
  const teacherName = (code) => (S.kuerzelFormat !== 'off' && KZ?.[clean(code)]) || clean(code);

  function subLine(v) {
    const kind = clean(v.info_2) || 'Änderung';
    const parts = [];
    const neu = clean(v.user_neu_kurz) ? teacherName(v.user_neu_kurz) : clean(v.user_neu_title);
    if (neu && neu !== 'XXX') parts.push(neu);
    if (clean(v.fach_neu) && clean(v.fach_neu) !== clean(v.fach_alt)) parts.push(clean(v.fach_neu_kurz || v.fach_neu));
    if (clean(v.raum_neu) && clean(v.raum_neu) !== clean(v.raum_alt)) parts.push('Raum ' + clean(v.raum_neu));
    if (clean(v.info_1)) parts.push(clean(v.info_1));
    const cancel = /entf|fällt aus|frei/i.test(kind) || neu === 'XXX';
    return { cancel, el: h('div', { class: 'ip-sub' }, h('b', {}, kind), parts.length ? ' · ' + parts.join(' · ') : '') };
  }

  function hideSubject(subject) {
    S.hiddenSubjects = [...new Set([...S.hiddenSubjects.split(','), subject].map((s) => s.trim()).filter(Boolean))].join(', ');
    sync.set({ hiddenSubjects: S.hiddenSubjects });
    document.getElementById('isgy-plus')?.remove();
    dashboard();
  }

  function lessonRow(it, isNow) {
    const { slot } = it;
    const subs = it.subs.map(subLine);
    const cancelled = subs.some((s) => s.cancel);
    const detail = h('div', { class: 'ip-detail', hidden: true, onclick: (e) => e.stopPropagation() });
    const hw = h('span', { class: 'ip-pill', hidden: true, title: 'Im letzten Eintrag steht eine Hausaufgabe' }, 'HA');
    const row = h('div', {
      class: 'ip-lesson' + (subs.length ? ' is-sub' : '') + (cancelled ? ' is-cancel' : '') + (isNow ? ' is-now' : ''),
      tabindex: 0, role: 'button', 'aria-expanded': 'false',
      onclick: async (e) => {
        if (e.target.closest('a')) return;
        detail.hidden = !detail.hidden;
        row.setAttribute('aria-expanded', String(!detail.hidden));
        if (!detail.hidden && !detail.childElementCount) {
          detail.append(h('div', { class: 'ip-muted' }, 'Suche letzten Tagebucheintrag …'));
          detail.replaceChildren(entryView(await lastEntry(slot.subject), slot.subject),
            h('button', { class: 'ip-textbtn', title: 'Rückgängig in den Einstellungen', onclick: () => hideSubject(slot.subject) }, `Ich habe ${slot.subject} nicht – ausblenden`));
        }
      },
      onkeydown: (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); row.click(); } },
    },
    h('div', { class: 'ip-when' },
      h('div', { class: 'ip-num' }, it.from === it.to ? it.from : `${it.from}–${it.to}`),
      h('div', { class: 'ip-time' }, TIMES[it.from] || '')),
    h('div', { class: 'ip-what' },
      h('div', { class: 'ip-subj' }, slot.subject, hw, isNow ? h('span', { class: 'ip-pill ip-pill-now' }, 'jetzt') : null),
      h('div', { class: 'ip-teacher', title: clean(slot.teacher) }, teacherName(slot.teacher)),
      subs.map((s) => s.el)),
    h('div', { class: 'ip-room' }, slot.room),
    detail);
    lastEntry(slot.subject).then((r) => { if (r?.entries.some((e) => clean(e.homework))) hw.hidden = false; });
    return row;
  }

  function dayView(date, sp, vplan, hidden) {
    const plan = sp.plan?.[(date.getDay() + 6) % 7] || [];
    const vp = vplan.filter((v) => v.date === deFull(date));
    const items = [];
    const used = new Set();
    plan.forEach((slots, i) => {
      const n = i + 1;
      const subsHere = vp.filter((v) => lessonsOf(v.stunde).includes(n));
      const shown = slots.filter((s) => !hidden.has(s.subject));
      for (const s of shown) {
        const subs = subsHere.filter((v) => clean(v.fach_alt) === s.subject || clean(v.user_alt_kurz) === s.teacher || shown.length === 1);
        subs.forEach((v) => used.add(v));
        // Merge double lessons (same slot in consecutive hours, no substitution on either).
        const prev = items.find((it) => it.to === n - 1 && it.slot.subject === s.subject && it.slot.teacher === s.teacher && it.slot.room === s.room);
        if (prev && !prev.subs.length && !subs.length) prev.to = n;
        else items.push({ from: n, to: n, slot: s, subs });
      }
    });
    const now = iso(date) === iso(today()) ? Number(sp.currentStunde) : -1;
    const orphan = vp.filter((v) => !used.has(v));
    const dayNotes = notes.filter((x) => x.date === iso(date) && !x.done);
    return {
      subCount: vp.length,
      el: h('div', { class: 'ip-day' },
        dayNotes.map((x) => h('div', { class: 'ip-callout' }, x.text)),
        items.length ? h('div', { class: 'ip-lessons' }, items.map((it) => lessonRow(it, now >= it.from && now <= it.to))) : h('div', { class: 'ip-empty' }, 'Kein Unterricht.'),
        orphan.length ? h('div', { class: 'ip-lessons ip-orphans' }, h('div', { class: 'ip-label' }, 'Weitere Vertretungen'),
          orphan.map((v) => {
            const s = subLine(v);
            return h('div', { class: 'ip-lesson is-sub' + (s.cancel ? ' is-cancel' : '') },
              h('div', { class: 'ip-when' }, h('div', { class: 'ip-num' }, clean(v.stunde))),
              h('div', { class: 'ip-what' }, h('div', { class: 'ip-subj' }, clean(v.fach_alt)), s.el));
          })) : null),
    };
  }

  async function eventsCard(cls) {
    const list = h('div', { class: 'ip-events' }, h('div', { class: 'ip-muted' }, 'Lade …'));
    const card = h('section', { class: 'ip-card' }, h('h3', {}, 'Termine'), list);
    try {
      const H = await authHeaders();
      const kals = await getJSON('rest.php/klassenkalender/getKalenders', { headers: H });
      const ids = kals.filter((k) => k.title === cls || k.preSelect).map((k) => k.id);
      const fd = new FormData();
      fd.append('kalenders', ids.join(','));
      const ev = await getJSON('rest.php/klassenkalender/getEvents', { method: 'POST', body: fd, headers: H });
      const from = iso(today()), to = iso(addDays(today(), S.eventDays));
      const items = (Array.isArray(ev) ? ev : []).filter((e) => (e.dateEnd || e.dateStart) >= from && e.dateStart <= to)
        .sort((a, b) => (a.dateStart + a.timeStart).localeCompare(b.dateStart + b.timeStart));
      list.replaceChildren(...items.map((e) => {
        const d = new Date(e.dateStart + 'T00:00');
        const title = clean(e.title).replace(new RegExp('^' + cls + ':\\s*'), '');
        return h('div', { class: 'ip-event' },
          h('div', { class: 'ip-datebox' }, h('b', {}, d.getDate()), h('span', {}, DAYS[d.getDay()].slice(0, 2))),
          h('div', { class: 'ip-ev-body' },
            h('div', { class: 'ip-ev-title' }, e.lnw ? h('span', { class: 'ip-tag', style: `--tag:${e.lnw.color || '#888'}`, title: e.lnw.title }, e.lnw.short) : null, e.fach_title || title),
            h('div', { class: 'ip-muted' }, [e.fach_title && title, e.stunde && `${e.stunde}. Std`, e.place].filter(Boolean).join(' · '))));
      }));
      if (!items.length) list.replaceChildren(h('div', { class: 'ip-empty' }, `Keine Termine in den nächsten ${S.eventDays} Tagen.`));
    } catch (err) {
      list.replaceChildren(h('div', { class: 'ip-empty' }, 'Klassenkalender nicht erreichbar.'));
      console.warn('[ISGY Plus]', err);
    }
    return card;
  }

  function notesCard() {
    const list = h('div', { class: 'ip-notes' });
    const text = h('input', { type: 'text', placeholder: 'Notiz hinzufügen …', class: 'ip-input', 'aria-label': 'Neue Notiz' });
    const date = h('input', { type: 'date', class: 'ip-input ip-date-in is-empty', oninput: () => date.classList.toggle('is-empty', !date.value), title: 'Optional: Tag, an dem die Notiz im Stundenplan erscheint', 'aria-label': 'Datum (optional)' });
    const add = () => {
      if (!text.value.trim()) return;
      notes.push({ id: Date.now(), text: text.value.trim(), date: date.value || '', done: false });
      text.value = ''; date.value = ''; date.classList.add('is-empty');
      saveNotes(); draw();
    };
    text.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    function draw() {
      const sorted = [...notes].sort((a, b) => a.done - b.done || (a.date || '9').localeCompare(b.date || '9') || a.id - b.id);
      list.replaceChildren(...sorted.map((n) => h('label', { class: 'ip-note' + (n.done ? ' is-done' : '') },
        h('input', { type: 'checkbox', checked: n.done, onchange: (e) => { n.done = e.target.checked; saveNotes(); draw(); } }),
        h('span', { class: 'ip-note-text' }, n.text, n.date ? h('small', {}, deShort(new Date(n.date + 'T00:00'))) : null),
        h('button', { class: 'ip-x', title: 'Löschen', onclick: (e) => { e.preventDefault(); notes = notes.filter((x) => x !== n); saveNotes(); draw(); } }, '×'))));
      if (!notes.length) list.append(h('div', { class: 'ip-empty' }, 'Noch nichts notiert.'));
    }
    draw();
    return h('section', { class: 'ip-card' }, h('h3', {}, 'Notizen'),
      h('div', { class: 'ip-note-add' }, text, date, h('button', { class: 'ip-btn', onclick: add, 'aria-label': 'Hinzufügen' }, '+')), list);
  }

  async function dashboard() {
    const main = document.querySelector('main.dashboard-front-main') || document.querySelector('main');
    if (!main) return;
    const toggleBtn = h('button', { class: 'ip-textbtn' });
    const setHidden = (v) => {
      main.classList.toggle('ip-hide-original', v);
      toggleBtn.textContent = v ? 'Altes Dashboard anzeigen' : 'Altes Dashboard ausblenden';
    };
    toggleBtn.onclick = () => { S.hideOriginalDashboard = !S.hideOriginalDashboard; sync.set({ hideOriginalDashboard: S.hideOriginalDashboard }); setHidden(S.hideOriginalDashboard); };

    const tabs = h('div', { class: 'ip-tabs', role: 'tablist' });
    const dayBox = h('div', {}, h('div', { class: 'ip-empty' }, 'Lade Stundenplan …'));
    const side = h('div', { class: 'ip-side' });
    const panel = h('div', { id: 'isgy-plus' },
      h('header', { class: 'ip-head' },
        h('div', {},
          h('h2', {}, 'Mein Tag'),
          h('div', { class: 'ip-muted' }, new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }))),
        h('div', { class: 'ip-actions' },
          h('button', { class: 'ip-search', onclick: openPalette, title: 'Seiten & Befehle suchen' }, 'Suchen', h('kbd', {}, 'Strg K')),
          h('button', { class: 'ip-icon', title: 'Einstellungen', 'aria-label': 'Einstellungen', onclick: openOptions }, '⚙'))),
      h('div', { class: 'ip-layout' },
        h('section', { class: 'ip-card ip-main' }, tabs, dayBox),
        side),
      h('footer', { class: 'ip-foot' }, h('span', {}, 'Stunde anklicken für den letzten Tagebucheintrag · ', h('kbd', {}, '?'), ' Tastenkürzel'), toggleBtn));
    main.prepend(panel);
    setHidden(S.hideOriginalDashboard);

    try {
      const sp = await getJSON('rest.php/stundenplan/getStundenplan', { method: 'POST', body: new FormData() });
      const cls = sp.active;
      const hidden = new Set(S.hiddenSubjects.split(',').map((s) => s.trim()).filter(Boolean));
      let vplan = [];
      try {
        const vl = await getJSON('rest.php/vplan/getList', { headers: await authHeaders() });
        vplan = Object.values(vl).flatMap((x) => x?.data || []).filter((v) => classMatch(v.klasse, cls));
      } catch (err) { console.warn('[ISGY Plus] vplan', err); }
      const days = [];
      for (let d = today(); days.length < 2; d = addDays(d, 1)) if (!isWeekend(d)) days.push(d);
      const label = (d) => { const diff = Math.round((d - today()) / 864e5); return diff === 0 ? 'Heute' : diff === 1 ? 'Morgen' : DAYS[d.getDay()]; };
      const views = days.map((d) => dayView(d, sp, vplan, hidden));
      // After the last lesson of today, open the next day first.
      const lastToday = (sp.plan?.[(days[0].getDay() + 6) % 7] || []).reduce((m, x, i) => (x.length ? i + 1 : m), 0);
      const start = iso(days[0]) === iso(today()) && Number(sp.currentStunde) > lastToday ? 1 : 0;
      const btns = days.map((d, i) => h('button', { class: 'ip-tab', role: 'tab', onclick: () => select(i) },
        h('b', {}, label(d)), h('span', {}, `${DAYS[d.getDay()].slice(0, 2)}, ${deShort(d)}`),
        views[i].subCount ? h('span', { class: 'ip-count', title: `${views[i].subCount} Vertretung(en)` }, views[i].subCount) : null));
      const select = (i) => {
        btns.forEach((b, j) => { b.classList.toggle('is-active', j === i); b.setAttribute('aria-selected', String(j === i)); });
        dayBox.replaceChildren(views[i].el);
      };
      tabs.replaceChildren(...btns);
      select(start);
      if (S.showNotes) side.append(notesCard());
      side.append(await eventsCard(cls));
    } catch (err) {
      dayBox.replaceChildren(h('div', { class: 'ip-empty' }, 'Stundenplan konnte nicht geladen werden: ' + err.message));
    }
  }

  // ---------- Sidebar pins ----------
  const linkLabel = (a) => clean([...a.childNodes].filter((n) => !(n.classList?.contains('ip-pin-btn'))).map((n) => n.textContent).join(''));
  const navList = () => document.querySelector('.su-sidebar-nav__list');
  function togglePin(href, label) {
    const pins = S.pins || [];
    S.pins = pins.some((p) => p.href === href) ? pins.filter((p) => p.href !== href) : [...pins, { href, label }];
    sync.set({ pins: S.pins });
    renderPins();
  }
  function renderPins() {
    const list = navList();
    if (!list) return;
    list.querySelectorAll('.ip-pinned').forEach((x) => x.remove());
    const pinned = new Set((S.pins || []).map((p) => p.href));
    list.querySelectorAll('.ip-pin-btn').forEach((b) => b.classList.toggle('is-pinned', pinned.has(b.dataset.href)));
    if (!S.pins?.length) return;
    const items = S.pins.map((p, i) => {
      const orig = list.querySelector(`a.su-sidebar-nav__link[href="${CSS.escape(p.href)}"] i`);
      return h('li', { class: 'su-sidebar-nav__item ip-pinned' },
        h('a', { class: 'su-sidebar-nav__link', href: p.href, title: i < 9 ? `Alt+${i + 1}` : null },
          orig ? orig.cloneNode(true) : h('i', { class: 'fas fa-thumbtack' }), h('span', {}, ' ' + p.label),
          h('span', { class: 'ip-pin-btn is-pinned', title: 'Lösen', onclick: (e) => { e.preventDefault(); e.stopPropagation(); togglePin(p.href); } }, '✕')));
    });
    const header = h('li', { class: 'su-sidebar-nav__header ip-pinned' }, h('b', {}, '📌 Angepinnt'));
    const first = list.querySelector('.su-sidebar-nav__header');
    (first ? first.after.bind(first) : list.prepend.bind(list))(header, ...items);
  }
  function sidebar() {
    const list = navList();
    if (!list) return;
    for (const a of list.querySelectorAll('a.su-sidebar-nav__link[href]')) {
      const href = a.getAttribute('href');
      a.append(h('span', { class: 'ip-pin-btn', 'data-href': href, title: 'Anpinnen / lösen', onclick: (e) => { e.preventDefault(); e.stopPropagation(); togglePin(href, linkLabel(a)); } }, '📌'));
    }
    renderPins();
  }

  // ---------- Command palette & shortcuts ----------
  function openOptions() { chrome.runtime.sendMessage('open-options'); }
  const gotoMap = () => Object.fromEntries(String(S.gotoKeys).split('\n').map((l) => l.split('=')).filter((p) => p.length >= 2 && p[0].trim()).map(([k, ...v]) => [k.trim(), v.join('=').trim()]));
  function commands() {
    const seen = new Set();
    const nav = [...document.querySelectorAll('.su-sidebar-nav a[href]')].map((a) => ({ label: linkLabel(a), href: a.getAttribute('href') }))
      .filter((c) => c.label && !c.href.startsWith('#') && !seen.has(c.href) && seen.add(c.href));
    const current = location.pathname.slice(1) + location.search;
    const pageTitle = clean(document.querySelector('h1, .content-header h1, main h2')?.textContent) || document.title;
    return [
      ...(S.pins || []).map((p) => ({ label: '📌 ' + p.label, href: p.href })),
      ...nav.map((c) => ({ ...c, label: '→ ' + c.label })),
      { label: '⚙ Einstellungen öffnen', run: openOptions },
      { label: '📌 Aktuelle Seite anpinnen / lösen', run: () => togglePin(current, pageTitle) },
      { label: '📝 Notiz hinzufügen', run: () => { const t = prompt('Notiz:'); if (t) { notes.push({ id: Date.now(), text: t, date: '', done: false }); saveNotes(); } } },
      { label: '🔍 Letzten Tagebucheintrag für Fach suchen …', run: () => { const s = prompt('Fach-Kürzel (z. B. M_1, D, E_1):'); if (s) showLastEntry(s.trim()); } },
      { label: '🔄 Kürzel-Liste neu laden', run: async () => { try { await loadKuerzel(true); alert(`${Object.keys(KZ).length} Kürzel geladen.`); location.reload(); } catch (e) { alert(e.message); } } },
      { label: '⌨ Tastenkürzel anzeigen', run: showHelp },
    ];
  }
  function openPalette() {
    if (document.querySelector('.ip-palette')) return;
    const all = commands();
    let sel = 0, shown = all;
    const input = h('input', { class: 'ip-input', placeholder: 'Seite oder Befehl suchen …' });
    const list = h('div', { class: 'ip-pal-list' });
    const draw = () => {
      list.replaceChildren(...shown.map((c, i) => h('div', { class: 'ip-pal-item' + (i === sel ? ' is-sel' : ''), onmousedown: (e) => { e.preventDefault(); run(c); } }, c.label)));
      list.children[sel]?.scrollIntoView({ block: 'nearest' });
    };
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const filter = () => { const q = norm(input.value).split(/\s+/).filter(Boolean); shown = all.filter((c) => q.every((w) => norm(c.label).includes(w))); sel = 0; draw(); };
    const dlg = showModal('Befehle', h('div', { class: 'ip-palette' }, input, list));
    const run = (c) => { dlg.close(); if (c.href) location.href = c.href; else c.run(); };
    input.addEventListener('input', filter);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, shown.length - 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === 'Enter' && shown[sel]) run(shown[sel]);
    });
    draw();
    input.focus();
  }
  function showHelp() {
    const rows = [
      [S.paletteKey + '  oder  /', 'Befehlspalette (Seiten & Aktionen suchen)'],
      ['Alt+1 … Alt+9', 'Angepinnte Seite 1–9 öffnen'],
      ...Object.entries(gotoMap()).map(([k, v]) => ['g dann ' + k, v.replace(/^index\.php\?page=(ext_)?/, '')]),
      ['?', 'Diese Hilfe'],
    ];
    showModal('Tastenkürzel', h('table', { class: 'ip-help' }, rows.map(([k, v]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, v)))));
  }
  const keyMatches = (e, spec) => {
    const parts = String(spec).toLowerCase().split('+').map((s) => s.trim());
    const key = parts.pop();
    return e.key.toLowerCase() === key && (parts.includes('ctrl') === (e.ctrlKey || e.metaKey)) && parts.includes('alt') === e.altKey && parts.includes('shift') === e.shiftKey;
  };
  const typing = (t) => t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  let gAt = 0;
  document.addEventListener('keydown', (e) => {
    if (!S.shortcutsEnabled || document.querySelector('dialog[open]')) return;
    if (keyMatches(e, S.paletteKey)) { e.preventDefault(); openPalette(); return; }
    if (typing(e.target)) return;
    if (e.altKey && !e.ctrlKey && /^Digit[1-9]$/.test(e.code)) {
      const p = S.pins?.[+e.code.slice(5) - 1];
      if (p) { e.preventDefault(); location.href = p.href; }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (gAt && Date.now() - gAt < 1500) {
      gAt = 0;
      const url = gotoMap()[e.key];
      if (url) { e.preventDefault(); location.href = url; }
      return;
    }
    if (e.key === 'g') gAt = Date.now();
    else if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (e.key === '?') { e.preventDefault(); showHelp(); }
  });

  // ---------- boot ----------
  sidebar();
  if (page === 'ext_dashboard') dashboard();
  if (!KZ && S.kuerzelFormat !== 'off') {
    loadKuerzel().then(() => { replaceCodes(); if (page === 'ext_dashboard') { document.getElementById('isgy-plus')?.remove(); dashboard(); } })
      .catch((err) => console.warn('[ISGY Plus] Kürzel', err));
  }
  replaceCodes();
})();
