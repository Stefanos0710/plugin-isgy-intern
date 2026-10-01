const $ = (id) => document.getElementById(id);
const FIELDS = Object.keys(ISGY_DEFAULTS).filter((k) => k !== 'pins');

async function load() {
  const s = Object.assign({}, ISGY_DEFAULTS, await chrome.storage.sync.get(null));
  for (const k of FIELDS) {
    const el = $(k);
    if (el.type === 'checkbox') el.checked = s[k];
    else el.value = s[k];
  }
  const pins = $('pins');
  pins.replaceChildren(...(s.pins || []).map((p, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'ghost'; b.textContent = 'lösen';
    b.onclick = async () => { s.pins.splice(i, 1); await chrome.storage.sync.set({ pins: s.pins }); load(); };
    li.append(`${p.label} `, b);
    return li;
  }));
  if (!s.pins?.length) pins.textContent = 'Keine.';
  document.documentElement.style.setProperty('--accent', s.accent);
  const { kuerzel, kuerzelLoaded, stundenplan } = await chrome.storage.local.get(['kuerzel', 'kuerzelLoaded', 'stundenplan']);
  renderTimetable(stundenplan, kuerzel || {});
  $('kzInfo').textContent = kuerzel ? `${Object.keys(kuerzel).length} Kürzel gespeichert (geladen ${new Date(kuerzelLoaded).toLocaleString('de-DE')}).` : 'Noch keine Kürzel geladen.';
}

// Timetable saved by the content script; click a subject to toggle it in hiddenSubjects (saved right away).
const hiddenSet = () => new Set($('hiddenSubjects').value.split(',').map((x) => x.trim()).filter(Boolean));
function renderTimetable(sp, kz) {
  const box = $('tt');
  const plan = (sp?.plan || []).slice(0, 5);
  if (!plan.some((d) => d?.length)) {
    box.innerHTML = '<p>Noch kein Stundenplan gespeichert. Öffne einmal das Dashboard auf isgy-intern.de und lade diese Seite dann neu.</p>';
    return;
  }
  const hidden = hiddenSet();
  const hours = Math.max(...plan.map((d) => d?.length || 0));
  const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  const table = el('table', 'tt', el('tr', '', el('th', ''), ...['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((d) => el('th', '', d))));
  for (let i = 0; i < hours; i++) {
    const tr = el('tr', '', el('th', '', String(i + 1)));
    for (const day of plan) {
      const td = el('td', '');
      for (const slot of day?.[i] || []) {
        const subj = String(slot.subject || '').trim();
        if (!subj) continue;
        const t = String(slot.teacher || '').trim();
        const chip = el('button', 'chip' + (hidden.has(subj) ? ' off' : ''), subj, el('small', '', kz[t] || t));
        chip.type = 'button';
        chip.dataset.subject = subj;
        chip.title = hidden.has(subj) ? `${subj} wieder einblenden` : `Ich habe ${subj} nicht`;
        td.append(chip);
      }
      tr.append(td);
    }
    table.append(tr);
  }
  if (sp.cls) box.replaceChildren(el('small', '', `Klasse ${sp.cls}`), table);
  else box.replaceChildren(table);
}
$('tt').onclick = async (e) => {
  const subj = e.target.closest('.chip')?.dataset.subject;
  if (!subj) return;
  const hidden = hiddenSet();
  hidden.has(subj) ? hidden.delete(subj) : hidden.add(subj);
  $('hiddenSubjects').value = [...hidden].join(', ');
  await chrome.storage.sync.set({ hiddenSubjects: $('hiddenSubjects').value });
  for (const c of document.querySelectorAll('.chip[data-subject]')) {
    const off = hidden.has(c.dataset.subject);
    c.classList.toggle('off', off);
    c.title = off ? `${c.dataset.subject} wieder einblenden` : `Ich habe ${c.dataset.subject} nicht`;
  }
};

$('save').onclick = async () => {
  const out = {};
  for (const k of FIELDS) {
    const el = $(k);
    out[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || ISGY_DEFAULTS[k] : el.value;
  }
  await chrome.storage.sync.set(out);
  $('status').textContent = 'Gespeichert ✓';
  setTimeout(() => ($('status').textContent = ''), 2000);
};
$('reset').onclick = async () => {
  const { pins } = await chrome.storage.sync.get('pins');
  await chrome.storage.sync.clear();
  if (pins) await chrome.storage.sync.set({ pins });
  load();
};
$('kzReset').onclick = async () => { await chrome.storage.local.remove(['kuerzel', 'kuerzelLoaded', 'kuerzelFailed', 'cache']); load(); };
$('exportNotes').onclick = async () => {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' }));
  a.download = 'isgy-notizen.json';
  a.click();
};
load();
