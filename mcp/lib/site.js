// Site-wide constants, static assets and the generated SEO files (robots.txt, sitemap.xml, web manifest, llms.txt).
import { readFileSync } from 'node:fs';

export const SITE = (process.env.SITE_URL || 'https://isgy-intern-plus.vercel.app').replace(/\/+$/, '');
export const SITE_HOST = new URL(SITE).host;
// Older addresses that answer too (existing connections keep working); only the start page redirects to SITE.
export const LEGACY_HOSTS = (process.env.LEGACY_HOSTS ?? 'isgy-intern-mcp.vercel.app').split(',').map((h) => h.trim()).filter(Boolean);
export const REPO = 'https://github.com/Stefanos0710/plugin-isgy-intern';
// Signed Firefox build on addons.mozilla.org (one click, updates itself).
export const FIREFOX_XPI = 'https://addons.mozilla.org/firefox/downloads/file/5134563/isgy_intern_plus-1.3.3.xpi';
export const AUTHOR = { name: 'Stefanos0710', url: 'https://github.com/Stefanos0710' };
// Bump when the start page content changes (sitemap <lastmod>).
export const UPDATED = '2026-10-17';

// Who runs the site (Impressum / Datenschutz). Kept in environment variables (not in the public repository).
export const operator = () => ({
  name: process.env.OPERATOR_NAME || '',
  street: process.env.OPERATOR_STREET || '',
  city: process.env.OPERATOR_CITY || '',
  email: process.env.OPERATOR_EMAIL || '',
});
// Search-engine ownership checks (Google Search Console / Bing Webmaster): set the value shown there as an env var.
// A vercel.app address can't be verified via DNS, so the HTML-tag or HTML-file method is used.
export const verification = () => ({
  google: process.env.GOOGLE_SITE_VERIFICATION || '',
  bing: process.env.BING_SITE_VERIFICATION || '',
  googleFile: process.env.GOOGLE_VERIFICATION_FILE || '', // e.g. google1234abcd5678ef90.html
});
export const LEGAL_UPDATED = '17. Oktober 2026';

export const NAME = 'ISGY Intern Plus';
// Start page (/): the project as a whole, mainly the browser extension.
export const TITLE = 'ISGY Intern Plus – isgy-intern.de, endlich übersichtlich';
export const DESCRIPTION = 'Kostenlose Browser-Erweiterung für isgy-intern.de: „Mein Tag“ mit Vertretungen, Lehrernamen statt Kürzel, Aufgaben & Notizen – und dein Schulportal im KI-Chat.';
// AI page (/mcp, also the MCP server URL).
export const MCP_TITLE = 'ISGY Intern im KI-Chat – für Claude, ChatGPT & Gemini';
export const MCP_DESCRIPTION = 'Frag Claude, ChatGPT oder Gemini nach Stundenplan, Vertretungen, Hausaufgaben & Prüfungen von isgy-intern.de. Kostenloser MCP-Server, in einer Minute verbunden.';
export const OG_ALT = 'ISGY Intern Plus: Dein Schulportal im KI-Chat – für Claude, ChatGPT und Gemini';
export const VERSION = '1.3.1'; // extension version shown on the site (manifest.json)

// ---------- static assets (assets/ is bundled with the function, see vercel.json includeFiles) ----------
const TYPES = { png: 'image/png', svg: 'image/svg+xml', ico: 'image/x-icon', webp: 'image/webp' };
const cache = new Map();
export function asset(name) {
  if (!/^[a-z0-9-]+\.(png|svg|ico|webp)$/.test(name)) return null;
  if (!cache.has(name)) {
    try { cache.set(name, { body: readFileSync(new URL(`../assets/${name}`, import.meta.url)), type: TYPES[name.split('.').pop()] }); }
    catch { cache.set(name, null); }
  }
  return cache.get(name);
}
const text = (name) => asset(name)?.body.toString('utf8') ?? '';

// ---------- brand logos (real logos, inlined once per page as an SVG sprite) ----------
// AI logos: MIT-licensed from @lobehub/icons-static-svg. Browser logos: CC0 from simple-icons (single-colour marks).
const BRANDS = { claude: 'claude.svg', openai: 'openai.svg', gemini: 'gemini.svg' };
export const BROWSERS = [['chrome', 'Chrome'], ['brave', 'Brave'], ['firefox', 'Firefox'], ['opera', 'Opera'], ['vivaldi', 'Vivaldi'], ['arc', 'Arc']];
const inner = (file) => text(file).replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[^<]*<\/title>/, '');
const spriteOf = (symbols) => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>`;
let sprite, browsers;
export function logoSprite() {
  sprite ??= spriteOf(Object.entries(BRANDS).map(([id, file]) =>
    // OpenAI's mark is a single black shape: let it follow the page's text colour (white in dark mode).
    `<symbol id="ai-${id}" viewBox="0 0 24 24">${id === 'openai' ? `<g fill="currentColor" fill-rule="evenodd">${inner(file)}</g>` : inner(file)}</symbol>`).join(''));
  return sprite;
}
// Only the start page shows browser logos; they follow the text colour (greyscale logo row).
export function browserSprite() {
  browsers ??= spriteOf(BROWSERS.map(([id]) => `<symbol id="br-${id}" viewBox="0 0 24 24"><g fill="currentColor">${inner(`browser-${id}.svg`)}</g></symbol>`).join(''));
  return browsers;
}
export const brandIcon = (id, size = 24, cls = '') => `<svg class="bi bi-${id} ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ai-${id}"/></svg>`;
export const browserIcon = (id, size = 24) => `<svg class="bri" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#br-${id}"/></svg>`;

// Which assistant is connecting? From the registered client name or the redirect host.
export function brandOf(name = '', host = '') {
  const s = `${name} ${host}`.toLowerCase();
  if (/claude|anthropic/.test(s)) return 'claude';
  if (/chatgpt|openai|oaiusercontent/.test(s)) return 'openai';
  if (/gemini|google|bard/.test(s)) return 'gemini';
  return '';
}

// ---------- generated files ----------
export const robotsTxt = () => `# ISGY Intern Plus
User-agent: *
Allow: /
Allow: /assets/
Disallow: /api/
Disallow: /authorize
Disallow: /token
Disallow: /register
Disallow: /konto
Disallow: /schluessel
Disallow: /sse

Sitemap: ${SITE}/sitemap.xml
`;

export const sitemapXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${UPDATED}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
    <image:image><image:loc>${SITE}/assets/og.png</image:loc><image:title>${NAME}</image:title><image:caption>${OG_ALT}</image:caption></image:image>
    <image:image><image:loc>${SITE}/assets/logo-512.png</image:loc><image:title>${NAME} Logo</image:title></image:image>
  </url>
  <url>
    <loc>${SITE}/mcp</loc>
    <lastmod>${UPDATED}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`;

export const manifestJson = () => JSON.stringify({
  name: NAME,
  short_name: 'ISGY Plus',
  description: DESCRIPTION,
  lang: 'de',
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: '#f7f6f3',
  theme_color: '#e8730c',
  categories: ['education', 'productivity'],
  icons: [
    { src: '/assets/logo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/assets/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/assets/logo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);

// https://llmstxt.org – a short, link-rich summary for AI crawlers and assistants.
export const llmsTxt = () => `# ISGY Intern Plus

> Inoffizielle Browser-Erweiterung und MCP-Server für das Schulportal isgy-intern.de des Gymnasiums Ismaning. Claude, ChatGPT und Gemini können damit Stundenplan, Vertretungsplan, Klassentagebuch (Hausaufgaben), Klassenkalender (Prüfungen, Termine) und die eigenen Aufgaben & Notizen lesen. Kostenlos, nur Lesezugriff auf das Portal.

## Nutzen
- [Startseite](${SITE}/): Browser-Erweiterung („Mein Tag“-Dashboard, Lehrernamen statt Kürzel, Aufgaben & Notizen, Befehlspalette)
- [KI-Assistenten verbinden](${SITE}/mcp): Anleitung für Claude, ChatGPT und Gemini. Dieselbe Adresse ist die MCP-Server-URL (Streamable HTTP, OAuth) für den eigenen Connector
- [KI-Konto](${SITE}/konto): optional, speichert den isgy-intern-Zugang verschlüsselt und synchronisiert Aufgaben & Notizen

## Quellcode & Doku
- [GitHub: ISGY Intern Plus](${REPO}): Browser-Erweiterung (Chrome, Edge, Brave, Opera, Vivaldi, Arc, Firefox)
- [MCP-Server-Doku](${REPO}/blob/HEAD/mcp/README.md): Tools, Anmeldung, Datenschutz

## Tools des MCP-Servers
uebersicht, tagesplan, hausaufgaben, pruefungen, fach, vertretungen, stundenplan, tagebuch, letzter_eintrag, termine, lehrer, notizen, notiz_anlegen, aufgabe_erledigt, notiz_loeschen
`;
