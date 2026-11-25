// Start page (/): the project as a whole – mainly the browser extension, with a pointer to the AI page (/mcp).
// Built on the taste-skill kit (assets/kit: system.css, cards, motion, layout, effects, moments), served from /assets/kit
// under its own CSP (same origin only, see START_HEADERS in api/index.js). Fonts are self-hosted (no Google request).
//
// type: software · deal: hero centred, nav-cards, close-word, footer-dark, rhythm space, buttons solid,
// mark: the client's own logo (logo-96.png) · palette: the extension's own orange on warm paper (start.mjs brand),
// type geist · radius round · ground sky · effect fluted-glass (hero frame) · card grounds silk-folds (features)
// moment: pinned-chapters (#installieren; counter-rolls and iris-opens dealt first, re-dealt: no proof figures, one ground)
import { SITE, REPO, FIREFOX_XPI, CHROME_ZIP, FIREFOX_FILE, NAME, TITLE, DESCRIPTION, AUTHOR, VERSION, logoSprite, brandIcon } from './site.js';
import { head, esc, DISCLAIMER, TRADEMARKS } from './pages.js';

const KIT = '/assets/kit';
const LINKS = `<link rel="preload" href="${KIT}/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${KIT}/system.css"><link rel="stylesheet" href="${KIT}/ui/cards.css"><link rel="stylesheet" href="${KIT}/ui/base.css">
<link rel="stylesheet" href="${KIT}/motion/motion.css"><link rel="stylesheet" href="${KIT}/backgrounds/backgrounds.css"><link rel="stylesheet" href="${KIT}/layout/layout.css"><link rel="stylesheet" href="${KIT}/icons/icon.css">
<script>document.documentElement.classList.add('m-enter');setTimeout(function(){document.documentElement.classList.add('m-enter-done')},700)</script>
<script>document.documentElement.classList.add('mo-js');setTimeout(function(){document.documentElement.classList.add('mo-safe')},2500)</script>
<script src="${KIT}/backgrounds/backgrounds.js"></script>
<link rel="modulepreload" href="${KIT}/moments/moments.js"><link rel="modulepreload" href="${KIT}/moments/lib.js"><link rel="modulepreload" href="${KIT}/moments/pinned-chapters/moment.js"><link rel="stylesheet" href="${KIT}/moments/pinned-chapters/moment.css">`;

// The :root block as start.mjs brand printed it (the extension's orange, warm paper, Geist), plus the self-hosted faces.
const CSS = `
@font-face{font-family:"Geist";src:url(${KIT}/fonts/geist.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Geist Mono";src:url(${KIT}/fonts/geist-mono.woff2) format("woff2");font-weight:100 900;font-display:swap}
:root {
  --p-bg: #f7f6f3; --p-surface: #ebe9e6; --p-ink: #1c1917; --p-muted: #666461;
  --p-accent: #e8730c; --p-accent-ink: #111111; --p-action: #cf6309; --p-action-ink: #111111;
  --p-inv-bg: #1c1917; --p-inv-surface: #292623; --p-inv-ink: #f7f6f3; --p-inv-muted: #9c9997;
  --p-inv-accent: #e8730c; --p-inv-accent-ink: #111111; --p-inv-action: #cf6309; --p-inv-action-ink: #111111;
  --font-display: "Geist", system-ui, sans-serif;
  --font-text: "Geist", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --display-weight: 500;
  --display-tracking: -0.035em;
  --display-tracking-xl: -0.045em;
}
.hero--centred .hero__lead{color:var(--ink)}
.nav__logo img{width:28px;height:28px;border-radius:7px;margin-right:10px;flex:none}
.footer .hero--centred .hero__lead{color:var(--ink)}
.nav__logo img{width:.8em;height:.8em;border-radius:.2em;margin-right:.2em;vertical-align:-.06em}

/* ---- page CSS inside the visuals only ---- */
/* the portal as the extension draws it (a picture of the product, true size) */
.pw{--u-r:12px;overflow:hidden;border-radius:14px;background:#fff;color:#15171a;font:400 13px/1.4 var(--font-text);box-shadow:var(--u-shadow);border:1px solid rgb(0 0 0 / .1);font-feature-settings:"tnum" 1}
.pw__bar{display:flex;align-items:center;gap:10px;height:40px;padding:0 14px;background:#f4f3f0;border-bottom:1px solid rgb(0 0 0 / .07);color:#6b6965}
.pw__dots{display:flex;gap:6px}.pw__dots i{width:10px;height:10px;border-radius:50%;background:#dcdad5}
.pw__addr{flex:1;min-width:0;display:flex;justify-content:center;gap:4px;white-space:nowrap;overflow:hidden}.pw__addr b{font-weight:500;color:#15171a}
.pw__ext{width:20px;height:20px;border-radius:5px;box-shadow:0 0 0 2px rgb(232 115 12 / .45)}
.pw__body{display:grid;grid-template-columns:172px minmax(0,1fr)}
/* the portal's sidebar as the extension's theme draws it: ink, the current page marked */
.pw__side{padding:14px 8px;background:#17191d;display:grid;align-content:start;gap:2px;color:#a3a8b0}
.pw__side p{margin:6px 0 4px;padding:0 10px;font-size:11px;color:#6b7079}
.pw__side span{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;white-space:nowrap}
.pw__side span.is-on{background:rgb(255 255 255 / .08);color:#fff;box-shadow:inset 2px 0 0 #e8730c}
.pw__side svg{width:12px;height:12px;flex:none;opacity:.7}
.pw__main{padding:18px 20px 20px;min-width:0;background:#f4f4f5}
.pw__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
.pw__head small{display:block;color:#666b73;font-size:12px}.pw__head b{display:block;font-size:24px;font-weight:600;letter-spacing:-.04em;line-height:1.1;margin-top:2px}
.pw__st{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;font-size:12px;color:#666b73}
.pw__st span{display:inline-flex;align-items:center;gap:6px}.pw__st span::before{content:"";width:5px;height:5px;border-radius:50%;background:#9a9fa7}
.pw__st .is-live{color:#15171a}.pw__st .is-live::before{background:#17a34a;box-shadow:0 0 0 3px rgb(23 163 74 / .2)}
.pw__st .is-warn{color:#8a4508}.pw__st .is-warn::before{background:#e8730c}
.pw__kbd{flex:none;border:1px solid rgb(0 0 0 / .12);border-radius:99px;background:#fff;padding:5px 12px;color:#8a8782;font-size:12px}
.pw__cols{display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:12px;align-items:start}
.pw__cols>*{min-width:0}.pw__card{background:#fff;border:1px solid rgb(21 23 26 / .08);border-radius:14px;padding:6px 8px 8px}
.pw__tabs{display:flex;gap:2px;padding:0 6px;border-bottom:1px solid rgb(21 23 26 / .08);margin-bottom:4px}
.pw__tabs span{position:relative;padding:8px 10px 9px;color:#9a9fa7;font-size:11px}.pw__tabs b{display:block;font-weight:600;font-size:13px;color:#666b73}
.pw__tabs .is-on b{color:#15171a}.pw__tabs .is-on::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:2px;background:#15171a}
.pw__tabs i{position:absolute;top:5px;right:-2px;min-width:14px;height:14px;border-radius:7px;background:#e8730c;color:#fff;font:600 9px/14px var(--font-text);text-align:center;font-style:normal}
/* lessons: time, a subject-coloured bar, room */
.ls{list-style:none;margin:0;padding:0;display:grid}
.ls li{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 8px;border-radius:10px}
.ls li+li{box-shadow:inset 0 1px 0 rgb(21 23 26 / .07)}
.ls .n{font-weight:600;font-size:13px;line-height:1.15}.ls .n small{display:block;font-weight:500;font-size:10px;color:#666b73}
.ls .s{min-width:0;padding-left:10px;border-left:3px solid var(--c,#d0d2d6)}.ls .s b{display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px;letter-spacing:-.015em}
.ls .s small{display:block;color:#666b73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
.ls .r{font-size:11px;font-weight:500;color:#666b73;border:1px solid rgb(21 23 26 / .14);padding:1px 8px;border-radius:7px}
.ls i{font-style:normal;font-size:10px;font-weight:600;padding:0 6px;border-radius:5px;background:#f5f5f6;border:1px solid rgb(21 23 26 / .08);color:#666b73}
.ls i.now{background:none;border:0;color:#11753a;padding:0;display:inline-flex;align-items:center;gap:4px}.ls i.now::before{content:"";width:6px;height:6px;border-radius:50%;background:#17a34a}
.ls .is-sub,.ls .is-sub+li,.ls .is-now,.ls .is-now+li,.ls .is-can,.ls .is-can+li{box-shadow:none}
.ls .is-sub{background:#fdf3ea}.ls .is-sub .n{color:#8a4508}.ls .is-sub .s small{color:#8a4508}
.ls .is-now{background:#effaf3}.ls .is-now .n{color:#11753a}
.ls .is-can{background:#fbf3f3}.ls .is-can .n{color:#a8362b}.ls .is-can .s{border-color:#d0d2d6}.ls .is-can .s b{text-decoration:line-through;text-decoration-thickness:1px;color:#666b73}.ls .is-can .s small{color:#a8362b}
.pw__box{background:#fff;border:1px solid rgb(21 23 26 / .08);border-radius:14px;padding:12px;display:grid;gap:10px}
.pw__box h4{margin:0;font-size:12px;font-weight:600;color:#15171a}
.ev{display:flex;gap:10px;align-items:flex-start}.ev .d{flex:none;width:26px;font-size:10px;color:#666b73;line-height:1.15}.ev .d b{display:block;font-size:16px;font-weight:600;letter-spacing:-.03em;color:#15171a}
.ev small{display:block;color:#666b73;font-size:11px}.ev .t{font-size:9px;font-weight:600;border-radius:4px;padding:0 4px;margin-right:4px;background:#fbe5e2;color:#9b2c1f}.ev .t.kl{background:#ececee;color:#40444b}
.todo{list-style:none;margin:0;padding:0;display:grid;gap:7px}.todo li{display:flex;gap:8px;align-items:flex-start}
.todo .bx{flex:none;width:14px;height:14px;border-radius:50%;border:1.5px solid #c9cbd0;margin-top:2px}
.todo .is-done{color:#9a9fa7;text-decoration:line-through}.todo .is-done .bx{background:#15171a;border-color:#15171a}
.todo em{font-style:normal;font-size:11px;color:#8a4508;background:#fdf3ea;border-radius:5px;padding:0 5px;margin-left:4px}
.via{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#6b6965;background:#f4f3f0;border-radius:5px;padding:0 6px;margin-top:3px}.via svg{width:11px;height:11px}
@media (max-width:1023px){.pw__side{display:none}.pw__body{grid-template-columns:minmax(0,1fr)}}
@media (max-width:760px){.pw__cols{grid-template-columns:minmax(0,1fr)}.pw__cols>aside{display:none}.pw__kbd{display:none}}
@media (max-width:639px){.pw__addr span{display:none}.pw__main{padding:14px 12px}}

/* small pieces of the extension on the card panels */
.fr{background:#fff;color:#15171a;border-radius:14px;border:1px solid rgb(0 0 0 / .1);box-shadow:var(--u-shadow);font:400 13px/1.4 var(--font-text);padding:8px}
.card .fr,.mo-pc__visual--lit .fr{font-size:14px;line-height:1.45;padding:10px}
.kz{display:grid;grid-template-columns:44px 18px minmax(0,1fr);align-items:center;gap:8px;padding:9px 10px;border-radius:9px}
.kz+.kz{border-top:1px solid rgb(0 0 0 / .06)}
.kz code{font:500 12px var(--font-mono);color:#8a8782;text-decoration:line-through}.kz svg{width:14px;height:14px;color:#8a8782}.kz b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kz.is-on{background:#f5f5f6}.kz.is-on svg{color:#15171a}.kz.is-on b{font-weight:600}
.en{padding:6px 8px;display:grid;gap:6px}.en__top{display:flex;justify-content:space-between;color:#6b6965;font-size:12px}.en__top b{color:#1c1917;font-weight:500;font-size:13px}
.en p{margin:0}.en .k{display:inline-block;min-width:52px;font-size:12px;color:#8a8782}
.en mark{background:#fdf3ea;color:#8a4508;border-radius:6px;padding:1px 6px}
.pal__q{display:flex;align-items:center;gap:8px;padding:8px 10px 10px;border-bottom:1px solid rgb(0 0 0 / .07);font-size:14px}.pal__q svg{width:15px;height:15px;color:#8a8782}
.pal ul{list-style:none;margin:0;padding:6px 0 0;display:grid;gap:2px}.pal li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;color:#4a4744}
.pal li.is-on{background:#f5f5f6;color:#15171a;box-shadow:inset 2px 0 0 #e8730c}.pal kbd{margin-left:auto;font:500 11px var(--font-mono);border:1px solid rgb(0 0 0 / .12);border-bottom-width:2px;border-radius:5px;padding:0 5px;color:#6b6965}
.fr .todo{padding:6px 8px;gap:9px}
/* the AI exchange */
.chat{padding:14px;display:grid;gap:10px}
.chat__top{display:flex;align-items:center;gap:8px;padding:2px 2px 10px;border-bottom:1px solid rgb(0 0 0 / .07);color:#6b6965;font-size:12px}.chat__top b{color:#1c1917;font-weight:500}.chat__top svg{width:18px;height:18px}
.chat__on{margin-left:auto;color:#067647}
.msg{max-width:86%;padding:9px 12px;border-radius:14px;line-height:1.45}
.msg--me{justify-self:end;background:#1c1917;color:#fff;border-bottom-right-radius:5px}
.msg--ai{padding:2px 0;max-width:100%}.msg--ai ul{margin:6px 0;padding-left:18px}
.tool{display:inline-flex;justify-self:start;align-items:center;gap:6px;font:500 12px var(--font-mono);color:#6b6965;border:1px dashed rgb(0 0 0 / .18);border-radius:7px;padding:3px 8px}
.tag{font-size:11px;font-weight:500;background:#fdf0e4;color:#7a3c06;border-radius:5px;padding:0 5px}
/* install steps */
.term{background:#1c1917;color:#e7e5e2;border-radius:12px;padding:14px 16px;font:400 13px/1.7 var(--font-mono);white-space:pre;box-shadow:var(--u-shadow)}
.term .p{color:#f8b26a}.term .ok{color:#9fe0a8}
.ext{display:grid;gap:10px}.ext__row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.ext__row+.ext__row{padding-top:10px;border-top:1px solid rgb(0 0 0 / .07)}.ext__row b{font-weight:500}.ext__row small{display:block;color:#6b6965;font-size:12px}
.sw{width:36px;height:20px;border-radius:99px;background:#1c1917;position:relative;flex:none}.sw::after{content:"";position:absolute;right:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff}
.ext__btn{display:inline-flex;justify-self:start;border:1px solid rgb(0 0 0 / .14);border-radius:8px;padding:5px 10px;font-weight:500}
.ext__btn.is-on{background:#fdf0e4;border-color:#e8730c}
.ai-logos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s-3);margin-top:var(--s-5)}
.ai-logos span{display:flex;justify-content:center;align-items:center;gap:8px;height:44px;padding:0 10px;border-radius:99px;background:var(--p-surface);font-weight:500}
.ai-logos svg{width:20px;height:20px}
.facts{list-style:none;margin:var(--s-5) 0 0;padding:0;display:grid;gap:var(--s-2)}
.facts li{padding-bottom:var(--s-2);border-bottom:1px solid var(--line)}
#funktionen .panel{--p-h:300px}
/* the close's name, hand-set to run from line to line (16 letters, about 6.7em wide in Geist 500) */
.close__word{font-size:min(190px,calc((100vw - 2 * var(--gut)) / 6.8));line-height:1.1;white-space:nowrap}
@media (min-width:1024px){#ki .frame,#datenschutz .frame{--ratio:96%}}
/* the steps stand static on a phone (the moment pins only from 1024): two whole phone screens */
@media (max-width:639px){main > #installieren[data-moment]:not(.is-live){min-height:calc(2 * 100lvh)}}
/* the 2x2 at the tablet: each card across the row, so a screen holds the h2 and two cards */
@media (min-width:640px) and (max-width:1023px){#funktionen .grid > .card{grid-column:1 / -1}#funktionen .panel{--p-h:clamp(190px, calc(190px + (100svh - 1024px) * .65), 300px)}}
/* the steps stand static below 1024 (the moment pins only from there): two whole screens */
@media (min-width:640px) and (max-width:1023px){main > #installieren[data-moment]:not(.is-live){min-height:calc(2 * 100svh)}}
/* live, the pinned stage starts its h2 on the section's top line like every other section */
main > #installieren.is-live > .mo-pc__grid{align-content:start;padding-top:var(--padt)}
/* the phone keeps each section on its screens: the lists that repeat the lead go, the AI section takes two */
@media (max-width:639px){#ki .facts,#ki .link,#datenschutz .facts,.faq-head > p,.faq__item:nth-child(-n+2),.footer__lede{display:none}#ki .frame,#datenschutz .frame{--ratio:80%}}
.inst-lead{margin:var(--s-5) 0 var(--s-4)}
/* the three downloads: Firefox across, Chrome and Android side by side */
.inst-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--s-3);margin-bottom:var(--s-6)}.inst-dl .btn{justify-content:center;min-width:0;width:auto;white-space:normal;text-align:center}.inst-dl .btn--primary{grid-column:1 / -1}
@media (max-width:639px){.inst-lead{display:none}.inst-dl{margin-top:var(--s-5)}}
.mo-pc__visual--lit .fr,.mo-pc__visual--lit .term{width:min(100%,460px)}
.mo-pc__visual--lit .fr{display:grid}
/* the extension's settings, as its options page draws them */
.opt{padding:6px 10px;display:grid}.opt h4{margin:4px 0 8px;font-size:15px;font-weight:500}
.opt__row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgb(0 0 0 / .07)}
.opt__row small{display:block;color:#6b6965;font-size:12px}.opt__row b{font-weight:500}
.chip{font-size:12px;border-radius:99px;padding:2px 9px;background:#f4f3f0;color:#4a4744;white-space:nowrap}.chip.is-ok{background:#e7f6ee;color:#067647}
@media (max-width:639px){#funktionen .panel{--p-h:112px}}
`;

const ARROW = '<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>';
const TO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// One lit card ground per panel (silk-folds, sky palette, held still), a new seed each.
const GROUND = (seed) => `data-fx="silk-folds" data-fx-seed="${seed}" data-fx-palette='{"bg":"#c6d3df","surface":"#d6e0e9","ink":"#25303a","accent":"#7f9fbd"}' data-fx-params='{"drift":0,"speed":0,"tone":1}'`;

// Every answer is open on the page and repeated in the FAQPage JSON-LD.
const FAQ = [
  ['Was ist ISGY Intern Plus?', 'Eine kostenlose Browser-Erweiterung für isgy-intern.de, das Schulportal des Gymnasiums Ismaning, plus ein MCP-Server für Claude, ChatGPT und Gemini.'],
  ['Ist das ein offizielles Angebot der Schule?', 'Nein. Es ist ein inoffizielles Schülerprojekt und nutzt nur deinen eigenen Zugang.'],
  ['In welchen Browsern läuft die Erweiterung?', 'Firefox mit einem Klick. Chrome, Edge, Brave, Opera, Vivaldi und Arc über die ZIP-Datei: entpacken und im Entwicklermodus laden. Auf Android in Firefox.'],
  ['Werden meine Daten irgendwohin geschickt?', 'Ohne KI-Konto nicht. Mit KI-Konto gehen deine Aufgaben und Notizen an den Server, bei Office-365-Login auch die Portal-Sitzung.'],
  ['Funktioniert das auf dem Handy?', 'Auf Android ja, in Firefox: „Datei für Android“ laden, dann in Firefox unter Einstellungen › Über Firefox fünfmal aufs Logo tippen, zurück und „Erweiterung aus Datei installieren“. Auf dem iPhone erlaubt Apple keine solchen Erweiterungen. Dort fragst du Claude oder ChatGPT: „Was habe ich morgen?“'],
];

function schema() {
  const author = { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url };
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: NAME, description: DESCRIPTION, inLanguage: 'de-DE', publisher: author },
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${SITE}/#extension`, name: NAME, alternateName: 'ISGY Intern Plus Browser-Erweiterung', description: DESCRIPTION,
      applicationCategory: 'EducationalApplication', applicationSubCategory: 'Browser-Erweiterung', operatingSystem: 'Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Arc, Firefox, Firefox für Android', softwareVersion: VERSION, inLanguage: 'de',
      image: `${SITE}/assets/logo-512.png`, screenshot: `${SITE}/assets/og.png`, downloadUrl: CHROME_ZIP, installUrl: `${REPO}#installation`, url: `${SITE}/`, isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }, author, sameAs: [REPO],
      featureList: ['„Mein Tag“-Dashboard mit Vertretungen und Entfällen', 'Lehrernamen statt Kürzel', 'Letzter Tagebucheintrag per Klick', 'Termine und Prüfungen aus dem Klassenkalender', 'Aufgaben & Notizen mit Sync', 'Befehlspalette und Tastenkürzel', 'Angepinnte Seiten', 'KI-Anbindung an Claude, ChatGPT und Gemini'] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
}

// One lesson row as the extension draws it: start time over the period, a bar in the subject's colour, the room.
const lessons = (rows) => `<ul class="ls">${rows.map(([cls, n, t, subj, tag, who, room, c]) => `<li${cls ? ` class="${cls}"` : ''}><span class="n">${t}<small>${n}. Std</small></span><span class="s" style="--c:${c}"><b>${subj}${tag}</b><small>${who}</small></span><span class="r">${room}</span></li>`).join('')}</ul>`;
const HA = '<i>HA</i>';
const NOW = '<i class="now">jetzt</i>';
const PIN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 3l5 5-2 1-3 3v4l-2 2-4-4-5 5-1-1 5-5-4-4 2-2h4l3-3z"/></svg>';

// The portal with the extension: "Mein Tag" in a browser window (the product, whole).
const portal = () => `<div class="pw ui ui-portal" aria-hidden="true">
<div class="pw__bar"><span class="pw__dots"><i></i><i></i><i></i></span><span class="pw__addr"><b>isgy-intern.de</b><span>/index.php?page=dashboard</span></span><img class="pw__ext" src="/assets/logo-96.png" width="20" height="20" alt=""></div>
<div class="pw__body">
<div class="pw__side"><p>Angepinnt</p><span>${PIN}Vertretungsplan</span><span>${PIN}Klassenkalender</span><p>Portal</p><span class="is-on">Dashboard</span><span>Stundenplan</span><span>Klassentagebuch</span><span>Nachrichten</span><span>Dokumente</span></div>
<div class="pw__main">
<div class="pw__head"><div><small>Donnerstag, 16. Oktober</small><b>Guten Morgen, Lena</b>
<div class="pw__st"><span>Klasse 9a</span><span class="is-live">Jetzt Englisch bis 11:15</span><span class="is-warn">2 Vertretungen heute</span></div></div><span class="pw__kbd">Suchen &nbsp;Strg K</span></div>
<div class="pw__cols"><div class="pw__card">
<div class="pw__tabs"><span class="is-on"><b>Heute</b>Do, 16.10.<i>2</i></span><span><b>Morgen</b>Fr, 17.10.</span><span><b>Montag</b>Mo, 20.10.</span></div>
${lessons([
    ['', '1.–2', '07:55', 'Mathematik', HA, 'Max Mustermann', '112', '#3a9a6a'],
    ['is-sub', '3', '09:45', 'Deutsch', '', 'Vertretung: Anna Weber', '204', '#d9653b'],
    ['is-now', '4', '10:30', 'Englisch', NOW, 'Laura Schmidt', '015', '#2f7fd1'],
    ['is-can', '5', '11:30', 'Physik', '', 'Entfall: Lehrkraft auf Fortbildung', 'E12', '#1f9aa6'],
    ['', '6', '12:15', 'Biologie', HA, 'Jonas Becker', '108', '#5f8a2e'],
  ])}</div>
<aside class="pw__box"><h4>Termine</h4><div class="ev"><span class="d"><b>17</b>Fr</span><span><span class="t">SA</span>Mathematik<small>Max Mustermann · 1.–2. Std</small></span></div><div class="ev"><span class="d"><b>22</b>Mi</span><span><span class="t kl">KL</span>Biologie<small>Jonas Becker · 6. Std</small></span></div>
<h4>Aufgaben &amp; Notizen</h4><ul class="todo"><li><span class="bx"></span><span>Mathe S. 42 Nr. 3<em>Fr</em></span></li><li class="is-done"><span class="bx"></span><span>Vokabeln Unit 3</span></li><li><span class="bx"></span><span>Bio-Referat vorbereiten<br><span class="via">${brandIcon('claude', 11)}über Claude angelegt</span></span></li></ul></aside>
</div></div></div></div>`;

// A feature card of the 2x2: title, two lines, a panel on its own still ground holding one piece of the extension.
const card = (seed, title, text, piece, label) => `<article class="card card--row card--open span-6 m-nolift">
<h3>${title}</h3><p>${text}</p>
<div class="panel" ${GROUND(seed)} role="img" aria-label="${esc(label)}"><div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:460px;--ax:max(24px, 50% - 230px);--ay:44px;--ay-sm:20px">${piece}</div></div></div>
</article>`;

const kuerzel = `<div class="fr ui ui-frag" aria-hidden="true">${[['Mm', 'Max Mustermann', 1], ['Wb', 'Anna Weber'], ['Sch', 'Laura Schmidt'], ['Bk', 'Jonas Becker'], ['Hf', 'Tim Hoffmann']]
  .map(([k, n, on]) => `<div class="kz${on ? ' is-on' : ''}"><code>${k}</code>${TO}<b>${n}</b></div>`).join('')}</div>`;
const entry = `<div class="fr en ui ui-frag" aria-hidden="true"><div class="en__top"><b>Deutsch · letzte Stunde</b><span>Di, 14.10.</span></div>
<p><span class="k">Thema</span>Gedichtanalyse „Der Panther“</p><p><span class="k">HA</span><mark>S. 87, Nr. 2 schriftlich</mark></p><p><span class="k">Datei</span>Arbeitsblatt_Rilke.pdf</p><p><span class="k">Lehrkraft</span>Lena Krüger</p></div>`;
const todos = `<div class="fr ui ui-frag" aria-hidden="true"><ul class="todo"><li><span class="bx"></span><span>Mathe S. 42 Nr. 3<em>Fr</em></span></li><li><span class="bx"></span><span>Bio-Referat vorbereiten<em>Mi</em><br><span class="via">${brandIcon('claude', 11)}über Claude angelegt</span></span></li><li class="is-done"><span class="bx"></span><span>Vokabeln Unit 3</span></li><li><span class="bx"></span><span>Sportsachen mitnehmen<em>Do</em></span></li><li><span class="bx"></span><span>Elternbrief unterschreiben lassen</span></li></ul></div>`;
const palette = `<div class="fr pal ui ui-frag" aria-hidden="true"><div class="pal__q">${SEARCH}<span>vert</span></div><ul><li class="is-on">Vertretungsplan<kbd>g v</kbd></li><li>Klassenkalender<kbd>g k</kbd></li><li>Stundenplan<kbd>g s</kbd></li><li>Mit KI-Konto synchronisieren</li><li>Original-Dashboard anzeigen</li></ul></div>`;
const chat = `<div class="fr chat ui ui-frag" aria-hidden="true"><div class="chat__top">${brandIcon('claude', 18)}<b>Claude</b> · ISGY Intern<span class="chat__on">verbunden</span></div>
<div class="msg msg--me">Was muss ich bis Montag machen?</div><div class="tool">hausaufgaben(faellig: "Montag")</div>
<div class="msg msg--ai">Bis Montag sind fällig:<ul><li><b>Mathe</b>: S. 42 Nr. 3 <span class="tag">morgen</span></li><li><b>Deutsch</b>: Gedichtanalyse, S. 87 Nr. 2</li><li><b>Bio</b>: Referat vorbereiten</li></ul>Soll ich dir das in „Mein Tag“ eintragen?</div>
<div class="msg msg--me">Ja, bitte.</div></div>`;

const settings = `<div class="fr opt ui ui-frag" aria-hidden="true"><h4>Einstellungen · ${NAME}</h4>
<div class="opt__row"><span><b>KI-Konto</b><small>Aufgaben und Notizen synchronisieren</small></span><span class="chip">nicht verbunden</span></div>
<div class="opt__row"><span><b>Kürzel</b><small>Zuordnung Kürzel zu Name</small></span><span class="chip is-ok">nur in diesem Browser</span></div>
<div class="opt__row"><span><b>Notizen</b><small>Aufgaben &amp; Notizen aus „Mein Tag“</small></span><span class="chip is-ok">nur in diesem Browser</span></div>
<div class="opt__row"><span><b>Meine Fächer</b><small>Fächer, die du nicht hast, ausblenden</small></span><span class="chip">12 von 14</span></div>
<div class="opt__row"><span><b>Angepinnte Seiten</b><small>Vertretungsplan, Klassenkalender</small></span><span class="chip">2</span></div>
<div class="opt__row"><span><b>Tastatur &amp; Befehle</b><small>Befehlspalette und g-Kürzel</small></span><span class="chip">Strg K</span></div>
<div class="opt__row"><span><b>Notizen exportieren</b><small>als JSON-Datei</small></span><span class="chip">Export</span></div></div>`;

const menuCard = (title, line, piece) => `<a class="menu-card span-4" href="#funktionen"><div class="panel" ${GROUND(title.length)}><div class="stage stage--fade-br"><div class="at-corner" style="--ax:24px;--ay:24px">${piece}</div></div></div><span class="t-card">${title}</span><span class="t-small muted">${line}</span></a>`;

export function homePage() {
  const year = new Date().getFullYear();
  return `${head(TITLE, { index: true, path: '/', jsonld: schema(), css: CSS, base: false, pre: LINKS,
    attrs: ' data-type="software" data-radius="round" data-ground="sky" data-buttons="solid" data-motion',
    meta: '<meta name="site-kind" content="software"><meta name="page-type" content="software">' })}<body>${logoSprite()}
<!-- type: software · deal: hero centred, nav-cards, close-word, footer-dark, rhythm space, buttons solid, mark: the client's logo, ground sky
     effect: fluted-glass (hero frame) · card grounds: silk-folds · moment: pinned-chapters (#installieren) -->
<header class="nav">
  <div class="wrap nav__bar">
    <a class="skip-link" href="#top">Zum Inhalt</a>
    <a class="nav__logo" href="#top"><img src="/assets/logo-96.png" width="28" height="28" alt="">${NAME}</a>
    <nav class="nav__links" aria-label="Hauptnavigation">
      <div class="nav__item">
        <a class="nav__link" href="#funktionen">Funktionen ${CHEV}</a>
        <div class="nav__menu"><div class="wrap grid">
          ${menuCard('Mein Tag', 'Stundenplan, Vertretungen und Entfälle', `<div class="fr ui ui-frag" style="width:300px" aria-hidden="true">${lessons([['is-sub', '3', '09:45', 'Deutsch', '', 'Vertretung: Anna Weber', '204', '#d9653b'], ['is-can', '5', '11:30', 'Physik', '', 'Entfall', 'E12', '#1f9aa6']])}</div>`)}
          ${menuCard('Namen statt Kürzel', 'Lehrernamen überall im Portal', `<div style="width:260px">${kuerzel}</div>`)}
          ${menuCard('Befehlspalette', 'Jede Seite mit Strg K', `<div style="width:280px">${palette}</div>`)}
        </div></div>
      </div>
      <div class="nav__item"><a class="nav__link" href="#ki">KI</a></div>
      <div class="nav__item"><a class="nav__link" href="#datenschutz">Datenschutz</a></div>
      <div class="nav__item"><a class="nav__link" href="#faq">Fragen</a></div>
    </nav>
    <div class="nav__actions">
      <a class="nav__link" href="/konto">KI-Konto</a>
      <a class="btn btn--primary" href="#installieren">Erweiterung installieren</a>
    </div>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-label="Menü"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
  </div>
</header>

<main id="top">
  <section class="hero hero--centred" data-enter aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text">
      <div class="hero__c">
        <h1 id="hero-h">Die Erweiterung für isgy-intern.de</h1>
        <p class="hero__lead">„Mein Tag“ zeigt Stundenplan, Vertretungen und Entfälle auf einen Blick, statt Kürzeln stehen Lehrernamen da. Kostenlos für Firefox, Chrome, Edge und Firefox auf Android.</p>
        <div class="btn-row"><a class="btn btn--primary" href="#installieren">Erweiterung installieren${ARROW}</a><a class="btn btn--secondary" href="/mcp">KI-Assistent verbinden</a></div>
      </div>
      <div class="hero__window" data-fx="fluted-glass" data-fx-seed="7">
        <div class="ly-piece" role="img" aria-label="„Mein Tag“ im Schulportal: sechs Stunden des Tages, eine Vertretung in Deutsch, ein Entfall in Physik, dazu Termine und Aufgaben.">${portal()}</div>
      </div>
    </div></div>
  </section>

  <section class="section g2" id="funktionen" aria-labelledby="funktionen-h">
    <div class="wrap">
      <div class="group">
        <div class="section-head"><h2 id="funktionen-h">Das Schulportal, aufgeräumt. <span class="muted">Gleiche Daten, gleiche Anmeldung.</span></h2></div>
        <div class="grid">
          ${card(21, 'Zeigt Lehrernamen statt Kürzel', 'Aus „Mm“ wird Max Mustermann, im Stundenplan, im Vertretungsplan und in „Mein Tag“.', kuerzel, 'Kürzel wie Mm, Wb und Sch, daneben die vollen Namen der Lehrkräfte.')}
          ${card(34, 'Zeigt Hausaufgaben der letzten Stunde', 'Ein Klick auf die Stunde öffnet den letzten Tagebucheintrag mit Thema und Hausaufgabe. Praktisch, wenn du gefehlt hast.', entry, 'Der letzte Tagebucheintrag in Deutsch mit Thema, Hausaufgabe und Arbeitsblatt.')}
        </div>
      </div>
      <div class="grid">
        ${card(47, 'Sammelt Aufgaben und Notizen', 'To-dos mit Datum stehen am richtigen Tag in „Mein Tag“. Mit KI-Konto auf jedem Gerät gleich.', todos, 'Eine Aufgabenliste mit Fälligkeiten, eine Aufgabe wurde über Claude angelegt.')}
        ${card(58, 'Öffnet jede Seite im Schulportal mit Strg K', 'Die Befehlspalette findet Seiten und Aktionen. g v springt zum Vertretungsplan, Alt 1 zur ersten angepinnten Seite.', palette, 'Die Befehlspalette mit der Suche „vert“ und dem Treffer Vertretungsplan.')}
      </div>
    </div>
  </section>

  <section class="section" id="ki" aria-labelledby="ki-h">
    <div class="wrap">
      <div class="grid">
        <div class="span-5">
          <h2 id="ki-h">Dein Stundenplan im KI-Chat</h2>
          <p class="t-lead" style="margin-top:var(--s-5)">Verbinde isgy-intern.de mit deinem KI-Assistenten und frag: „Was habe ich morgen?“ Er liest Stundenplan, Vertretungen, Hausaufgaben und Prüfungen.</p>
          <div class="ai-logos"><span>${brandIcon('claude', 20)}Claude</span><span>${brandIcon('openai', 20)}ChatGPT</span><span>${brandIcon('gemini', 20)}Gemini</span></div>
          <ul class="facts"><li>Nur Lesezugriff auf das Portal</li><li>19 Werkzeuge, von Hausaufgaben bis Lehrerkürzel</li><li>Aufgaben anlegen nur mit KI-Konto</li></ul>
          <p style="margin-top:var(--s-5)"><a class="link" href="/mcp">Anleitung für deinen Assistenten lesen</a></p>
        </div>
        <div class="frame frame--split frame--lit span-6 start-7" role="img" aria-label="Claude beantwortet die Frage nach den Hausaufgaben bis Montag mit drei Einträgen aus dem Klassentagebuch.">
          <div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:440px;--ax:max(24px, 50% - 220px);--ay:56px;--ay-sm:24px">${chat}</div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="datenschutz" aria-labelledby="datenschutz-h">
    <div class="wrap">
      <div class="grid">
        <div class="span-5">
          <h2 id="datenschutz-h">Deine Daten bleiben im Browser</h2>
          <p class="t-lead" style="margin-top:var(--s-5)">Ohne KI-Konto spricht die Erweiterung nur mit isgy-intern.de. Von der Kürzel-Liste der Schule bleibt nur die Zuordnung Kürzel zu Name, die PDF wird nie gespeichert.</p>
          <ul class="facts"><li>Keine Werbung, keine Analyse-Tools</li><li>Jede Zeile Quellcode offen auf GitHub</li><li>Mit KI-Konto: was gespeichert wird, steht in der Datenschutzerklärung</li></ul>
          <p style="margin-top:var(--s-5)"><a class="link" href="/datenschutz">Datenschutzerklärung lesen</a></p>
        </div>
        <div class="frame frame--split frame--lit span-6 start-7" role="img" aria-label="Die Einstellungen der Erweiterung: kein KI-Konto verbunden, Kürzel und Notizen nur in diesem Browser gespeichert.">
          <div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:440px;--ax:max(24px, 50% - 220px);--ay:56px;--ay-sm:24px">${settings}</div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="faq" aria-labelledby="fragen-h">
    <div class="wrap">
      <div class="grid">
        <div class="span-5 stack-4 faq-head">
          <h2 id="fragen-h">Fragen zur Browser-Erweiterung</h2>
          <p class="t-lead">Was fehlt? Melde es auf GitHub.</p>
          <p><a class="link" href="${REPO}/issues" rel="noopener">Frage auf GitHub stellen</a></p>
        </div>
        <div class="faq span-6 start-7">${FAQ.map(([q, a]) => `<div class="faq__item"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join('')}</div>
      </div>
    </div>
  </section>

  <section class="section" id="installieren" style="--h: 2; --hm: 2" data-moment="pinned-chapters" aria-labelledby="installieren-h">
    <div class="wrap mo-pc__grid">
      <div class="mo-pc__text">
        <h2 id="installieren-h">In 3 Schritten installiert</h2>
        <p class="t-lead inst-lead">Kein Bauen, kein Terminal. Auf Android läuft es in Firefox.</p>
        <div class="btn-row inst-dl"><a class="btn btn--primary" href="${FIREFOX_XPI}">Für Firefox installieren</a><a class="btn btn--secondary" href="${CHROME_ZIP}" rel="noopener">ZIP für Chrome &amp; Co.</a><a class="btn btn--secondary" href="${FIREFOX_FILE}" rel="noopener">Datei für Android</a></div>
        <ol class="mo-pc__steps">
          <li class="mo-pc__step">
            <h3>Herunterladen</h3>
            <p>Firefox: „Für Firefox installieren“ und „Zulassen“ – fertig. Chrome, Edge, Brave, Opera: ZIP laden und entpacken.</p>
            <figure class="mo-pc__visual mo-pc__visual--lit" role="img" aria-label="Die Downloads: ein Klick für Firefox, eine ZIP-Datei für Chrome und Co."><span class="fr ext ui ui-ext" aria-hidden="true"><span class="ext__row"><span><b>Firefox</b><small>Computer, mit einem Klick</small></span><span class="ext__btn is-on">Installieren</span></span><span class="ext__row"><span><b>Chrome, Edge, Brave, Opera</b><small>isgy-intern-plus-chromium.zip</small></span><span class="ext__btn">Laden</span></span><span class="ext__row"><span><b>Android</b><small>Firefox für Android</small></span><span class="ext__btn">Laden</span></span></span></figure>
          </li>
          <li class="mo-pc__step">
            <h3>Im Browser laden</h3>
            <p>Unter chrome://extensions den Entwicklermodus einschalten, „Entpackte Erweiterung laden“ und den entpackten Ordner wählen.</p>
            <figure class="mo-pc__visual mo-pc__visual--lit" role="img" aria-label="Die Erweiterungsseite des Browsers mit eingeschaltetem Entwicklermodus."><span class="fr ext ui ui-ext" aria-hidden="true"><span class="ext__row"><span><b>Entwicklermodus</b><small>chrome://extensions</small></span><span class="sw"></span></span><span class="ext__btn is-on">Entpackte Erweiterung laden</span></span></figure>
          </li>
          <li class="mo-pc__step">
            <h3>isgy-intern.de öffnen</h3>
            <p>Ganz normal einloggen: Dein Dashboard heißt jetzt „Mein Tag“. Die Einstellungen findest du unter ⚙.</p>
            <figure class="mo-pc__visual mo-pc__visual--lit" role="img" aria-label="Die Erweiterung ISGY Intern Plus ist aktiv."><span class="fr ext ui ui-ext" aria-hidden="true"><span class="ext__row"><span style="display:flex;gap:10px;align-items:center"><img src="/assets/logo-96.png" width="28" height="28" alt="" loading="lazy" style="border-radius:7px"><span><b>${NAME}</b><small>Version ${VERSION}</small></span></span><span class="sw"></span></span></span></figure>
          </li>
        </ol>
      </div>
      <div class="mo-pc__visuals frame"></div>
    </div>
  </section>
</main>

<footer class="footer closing footer--dark ground-inverse g2m" id="contact" aria-labelledby="close-h">
  <div class="wrap">
    <div class="closing__cta close--word">
      <div class="section-head--split">
        <div><h2 id="close-h">Erweiterung installieren</h2><p class="t-lead">Kostenlos, ohne Konto, in zwei Minuten eingerichtet.</p></div>
        <a class="btn btn--primary" href="#installieren">Erweiterung installieren${ARROW}</a>
      </div>
      <p class="close__word" aria-hidden="true">ISGY Intern Plus</p>
    </div>
    <div class="closing__links">
      <div class="grid">
        <div class="span-4 stack-4"><a class="nav__logo" href="#top"><img src="/assets/logo-96.png" width="28" height="28" alt="" loading="lazy">${NAME}</a><p class="footer__lede">Die inoffizielle Erweiterung für das Schulportal des Gymnasiums Ismaning.</p></div>
        <div class="span-2 footer__col"><h3>Produkt</h3><ul><li><a href="/#funktionen">Funktionen</a></li><li><a href="/#ki">KI-Anbindung</a></li><li><a href="/#installieren">Installieren</a></li></ul></div>
        <div class="span-2 footer__col"><h3>KI</h3><ul><li><a href="/mcp">Assistent verbinden</a></li><li><a href="/konto">KI-Konto</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Projekt</h3><ul><li><a href="${REPO}" rel="noopener">GitHub</a></li><li><a href="${REPO}/issues" rel="noopener">Fehler melden</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Rechtliches</h3><ul><li><a href="/impressum">Impressum</a></li><li><a href="/datenschutz">Datenschutz</a></li></ul></div>
      </div>
      <div class="footer__legal">
        <span>&copy; ${year} ${NAME} · Version ${VERSION} · ${DISCLAIMER}</span>
        <span>${TRADEMARKS}</span>
      </div>
    </div>
  </div>
</footer>
<nav class="actionbar" aria-label="Schnellzugriff"><a class="btn btn--primary" href="#installieren">Erweiterung installieren</a></nav>
<script type="module" src="${KIT}/system.js"></script>
<script type="module" src="${KIT}/motion/motion.js"></script>
<script type="module" src="${KIT}/layout/layout.js"></script>
</body></html>`;
}
