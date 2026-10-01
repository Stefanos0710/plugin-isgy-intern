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
  const { kuerzel, kuerzelLoaded } = await chrome.storage.local.get(['kuerzel', 'kuerzelLoaded']);
  $('kzInfo').textContent = kuerzel ? `${Object.keys(kuerzel).length} Kürzel gespeichert (geladen ${new Date(kuerzelLoaded).toLocaleString('de-DE')}).` : 'Noch keine Kürzel geladen.';
}

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
$('kzReset').onclick = async () => { await chrome.storage.local.remove(['kuerzel', 'kuerzelLoaded']); load(); };
$('exportNotes').onclick = async () => {
  const { notes = [] } = await chrome.storage.local.get('notes');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' }));
  a.download = 'isgy-notizen.json';
  a.click();
};
load();
