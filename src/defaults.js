// Shared by content script and options page.
const ISGY_DEFAULTS = {
  hideOriginalDashboard: true,
  kuerzelFormat: 'name-code', // 'name-code' | 'name' | 'off'
  kuerzelPdfUrl: 'index.php?page=ext_downloads&view=default&task=download&id=80&file=K%C3%BCrzel-%20und%20E-Mail-Liste%20ab%2010.08.2026.pdf',
  hiddenSubjects: '', // comma separated, e.g. "Ev, Eth"
  eventDays: 21,
  lookbackDays: 42,
  showNotes: true,
  shortcutsEnabled: true,
  paletteKey: 'ctrl+k',
  // "g" followed by key → page
  gotoKeys:
    'd=index.php?page=ext_dashboard&view=default\n' +
    's=index.php?page=ext_stundenplan\n' +
    'v=index.php?page=ext_vplan\n' +
    't=index.php?page=ext_tagebuch&view=default\n' +
    'k=index.php?page=ext_klassenkalender\n' +
    'w=index.php?page=ext_wochenplan&view=default\n' +
    'n=index.php?page=ext_news\n' +
    'm=index.php?page=ext_inbox\n' +
    'f=index.php?page=ext_downloads&view=default',
  accent: '#e8730c',
  modernTheme: true, // restyle all portal pages (src/theme.css)
  pins: [], // [{href, label}]
};
