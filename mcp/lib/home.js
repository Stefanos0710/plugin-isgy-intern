// Start page (/): the project as a whole – mainly the browser extension, with a pointer to the AI page (/mcp).
// Uses head/nav/footer and the base CSS from pages.js; everything page-specific (mockup, bento, AI band) lives here.
import { SITE, REPO, FIREFOX_XPI, NAME, TITLE, DESCRIPTION, AUTHOR, VERSION, BROWSERS, logoSprite, browserSprite, brandIcon, browserIcon } from './site.js';
import { head, tail, siteHeader, siteFooter, esc, I } from './pages.js';

const CSS = `
:root{--sub-bg:#fff7ed;--sub-tx:#9a4a00;--can-bg:#fef2f2;--can-tx:#b42318;--now:#16a34a;--glow:rgba(232,115,12,.20)}
@media (prefers-color-scheme:dark){:root{--sub-bg:#33220f;--sub-tx:#fdba74;--can-bg:#361615;--can-tx:#fca5a5;--now:#4ade80;--glow:rgba(240,138,44,.16)}}

/* hero */
.hh{position:relative;padding:44px 0 0;text-align:center;overflow-x:clip;isolation:isolate}
@media (min-width:900px){.hh{padding:84px 0 0}}
.hh::before{content:"";position:absolute;inset:-120px -20% auto;height:760px;z-index:-1;pointer-events:none;
  background:radial-gradient(40% 50% at 30% 30%,var(--glow),transparent 70%),radial-gradient(35% 45% at 72% 22%,color-mix(in srgb,var(--accent-2) 18%,transparent),transparent 70%)}
.hh-grid{position:absolute;inset:0 0 auto;height:720px;z-index:-1;pointer-events:none;opacity:.6;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:46px 46px;
  -webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 0%,#000 25%,transparent 75%);mask-image:radial-gradient(ellipse 60% 55% at 50% 0%,#000 25%,transparent 75%)}
.ann{display:inline-flex;align-items:center;gap:10px;padding:5px 14px 5px 5px;border-radius:999px;background:var(--card);border:1px solid var(--line);box-shadow:var(--shadow);font-size:.86rem;font-weight:600;color:var(--muted);text-decoration:none;max-width:100%}
.ann b{background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;border-radius:999px;padding:2px 10px;font-size:.76rem;letter-spacing:.02em;flex:none}
.ann span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ann:hover{color:var(--text);border-color:var(--line-2)}
.ann .ar{transition:transform .2s}.ann:hover .ar{transform:translateX(3px)}
.hh h1{font-size:clamp(2.35rem,8vw,4.6rem);line-height:1.02;letter-spacing:-.045em;margin:22px auto 18px;max-width:12em}
.hh .lead{margin:0 auto 28px;max-width:36em;font-size:clamp(1.04rem,2.4vw,1.2rem)}
.cta-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.btn.lg{padding:14px 22px;font-size:1rem;border-radius:13px}
.btn.lg svg{width:18px;height:18px}
.btn.pri{background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 70%,var(--accent-2)));box-shadow:0 10px 24px -10px rgba(232,115,12,.7),inset 0 1px 0 rgba(255,255,255,.25)}
.btn.sec{background:var(--card);color:var(--text);border:1px solid var(--line-2);box-shadow:var(--shadow)}
.btn.sec:hover{border-color:var(--accent)}
@media (max-width:480px){.cta-row .btn{width:100%}}
.trust{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 18px;margin:20px 0 0;color:var(--muted);font-size:.88rem}
.trust span{display:inline-flex;align-items:center;gap:6px}.trust svg{width:16px;height:16px;color:var(--ok)}

/* browser window mockup */
.stage{position:relative;max-width:1080px;margin:52px auto 0;padding:0 16px}
@media (min-width:640px){.stage{padding:0 28px}}
.stage::before{content:"";position:absolute;inset:8% 10% -4%;z-index:-1;background:radial-gradient(50% 50% at 50% 50%,var(--glow),transparent 70%);filter:blur(30px)}
.bw{background:var(--card);border:1px solid var(--line-2);border-radius:18px;overflow:hidden;text-align:left;
  box-shadow:0 1px 1px rgba(0,0,0,.04),0 30px 60px -20px rgba(24,24,27,.28),0 60px 120px -40px rgba(232,115,12,.25)}
@media (min-width:900px){.bw{transform:perspective(2400px) rotateX(7deg);transform-origin:50% 0;transition:transform 1s cubic-bezier(.2,.7,.2,1)}.stage:hover .bw,.stage.in .bw{transform:perspective(2400px) rotateX(0)}}
.bw-top{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-2);border-bottom:1px solid var(--line)}
.bw-dots{display:flex;gap:6px;flex:none}.bw-dots i{width:11px;height:11px;border-radius:50%;background:#ff5f57}.bw-dots i:nth-child(2){background:#febc2e}.bw-dots i:nth-child(3){background:#28c840}
.addr{flex:1;min-width:0;display:flex;align-items:center;gap:6px;justify-content:center;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:5px 12px;font-size:.78rem;color:var(--muted);white-space:nowrap;overflow:hidden}
.addr svg{width:12px;height:12px;flex:none;color:var(--faint);margin-right:2px}.addr b{color:var(--text);font-weight:600}.addr span{margin-left:-6px;overflow:hidden;text-overflow:ellipsis;color:var(--faint)}
.bw-ext{width:22px;height:22px;border-radius:6px;flex:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 45%,transparent)}
.mk{display:grid;grid-template-columns:minmax(0,1fr);background:var(--bg);font-size:14px;line-height:1.4}
@media (min-width:900px){.mk{grid-template-columns:190px minmax(0,1fr)}}
.mk-nav{display:none;background:var(--card);border-right:1px solid var(--line);padding:16px 10px;font-size:.84rem}
@media (min-width:900px){.mk-nav{display:block}}
.mk-nav p{margin:0 0 6px;padding:0 10px;font-size:.68rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.mk-nav ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:2px}
.mk-nav li{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;color:var(--muted);white-space:nowrap}
.mk-nav li.on{background:var(--accent-soft);color:var(--accent);font-weight:650}
.mk-nav li .pin{margin-left:auto;font-size:.72rem}
.mk-nav li i{width:6px;height:6px;border-radius:50%;background:var(--line-2);flex:none}.mk-nav li.on i{background:var(--accent)}
.mk-main{padding:16px;min-width:0}
@media (min-width:640px){.mk-main{padding:22px 24px 26px}}
.mk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px}
.mk-head small{display:block;color:var(--muted);font-size:.78rem}.mk-head b{font-size:1.35rem;letter-spacing:-.02em}
.mk-search{display:none;align-items:center;gap:22px;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:7px 8px 7px 12px;color:var(--faint);font-size:.8rem}
@media (min-width:640px){.mk-search{display:inline-flex}}
.mk-search kbd{font-size:.7rem}
.mk-cols{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
@media (min-width:760px){.mk-cols{grid-template-columns:minmax(0,1fr) 250px}}
.mk-card{background:var(--card);border-radius:14px;padding:12px;box-shadow:0 1px 2px rgba(16,24,40,.05),0 4px 16px rgba(16,24,40,.04);border:1px solid var(--line);min-width:0}
.mk-card h4{margin:2px 4px 10px;font-size:.88rem}
.mk-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:var(--bg-2);border-radius:11px;margin-bottom:10px}
.mk-tabs span{position:relative;padding:7px 12px;border-radius:8px;color:var(--muted);font-size:.74rem}
.mk-tabs b{display:block;font-size:.88rem;color:var(--text)}
.mk-tabs .on{background:var(--card);box-shadow:0 1px 3px rgba(16,24,40,.12)}.mk-tabs .on b{color:var(--accent)}
.mk-tabs em{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-style:normal;background:var(--sub-bg);color:var(--sub-tx);font-weight:700;font-size:.72rem;border-radius:9px;min-width:20px;height:20px;display:grid;place-items:center;padding:0 6px}
.mk-ls{list-style:none;margin:0;padding:0;display:grid;gap:3px}
.mk-ls li{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 10px;border-radius:10px;transition:background .15s}
.mk-ls li:hover{background:var(--bg-2)}
.mk-ls .n{text-align:center;font-weight:700;font-size:1rem;line-height:1.1}.mk-ls .n small{display:block;font-weight:500;font-size:.68rem;color:var(--muted);font-variant-numeric:tabular-nums}
.mk-ls .s{min-width:0}.mk-ls .s b{display:flex;align-items:center;gap:6px;font-size:.92rem}
.mk-ls .s small{display:block;color:var(--muted);font-size:.78rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-ls .r{font-size:.74rem;color:var(--muted);background:var(--bg-2);padding:2px 9px;border-radius:999px;font-variant-numeric:tabular-nums}
.mk-ls i{font-style:normal;font-size:.62rem;font-weight:750;letter-spacing:.03em;padding:1px 6px;border-radius:999px;background:var(--accent);color:#fff}
.mk-ls i.nw{background:var(--now)}
.mk-ls li.sub{background:var(--sub-bg);box-shadow:inset 3px 0 0 var(--accent)}.mk-ls li.sub .s small{color:var(--sub-tx)}
.mk-ls li.now{box-shadow:inset 3px 0 0 var(--now)}
.mk-ls li.can{background:var(--can-bg);box-shadow:inset 3px 0 0 var(--can-tx)}.mk-ls li.can .s b{text-decoration:line-through;text-decoration-thickness:1px}.mk-ls li.can .s small{color:var(--can-tx)}
.mk-side{display:none;gap:14px;align-content:start}
@media (min-width:760px){.mk-side{display:grid}}
.mk-ev{display:grid;gap:6px;font-size:.82rem}
.mk-ev div{display:flex;align-items:center;gap:10px;padding:6px 4px}
.mk-ev .d{flex:none;width:44px;text-align:center;border-radius:8px;background:var(--bg-2);padding:3px 0;font-size:.66rem;color:var(--muted);line-height:1.15}.mk-ev .d b{display:block;font-size:.95rem;color:var(--text)}
.mk-ev .d.hot{background:var(--can-bg)}.mk-ev .d.hot b{color:var(--can-tx)}
.mk-todo{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:.82rem}
.mk-todo li{display:flex;gap:8px;align-items:flex-start;padding:6px 4px}
.mk-todo .bx{flex:none;width:15px;height:15px;border-radius:5px;border:2px solid var(--line-2);margin-top:1px}
.mk-todo .done{color:var(--faint);text-decoration:line-through}.mk-todo .done .bx{background:var(--accent);border-color:var(--accent)}
.mk-todo em{font-style:normal;font-size:.68rem;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:0 5px;margin-left:4px}
.via{display:inline-flex;align-items:center;gap:4px;font-size:.66rem;color:var(--muted);background:var(--bg-2);border-radius:6px;padding:1px 6px;margin-top:3px}
.via .bi{width:11px;height:11px}
.fl{display:none;position:absolute;z-index:2;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 40px -16px rgba(24,24,27,.35);padding:10px 14px;font-size:.84rem;text-align:left}
@media (min-width:1280px){.fl{display:flex}}
.fl-kz{left:-84px;bottom:9%;align-items:center;gap:8px;animation:bob 6s ease-in-out infinite}
.fl-kz code{font-size:.8rem;text-decoration:line-through;color:var(--faint)}.fl-kz svg{width:14px;height:14px;color:var(--accent)}
.fl-ai{right:-150px;bottom:5%;gap:10px;align-items:flex-start;width:230px;animation:bob 7s ease-in-out -2s infinite}
.fl-ai .bi{width:22px;height:22px;margin-top:2px}
.fl-ai p{margin:0}.fl-ai small{display:block;font-size:.68rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em}
.fl-ai p+p{margin-top:8px;padding-top:8px;border-top:1px solid var(--line)}
@keyframes bob{50%{transform:translateY(-8px)}}

/* browsers */
.brs{margin:56px auto 0;text-align:center}
.brs p{margin:0 0 14px;font-size:.78rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.brs ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;justify-content:center;gap:10px 26px;color:var(--muted)}
.brs li{display:flex;align-items:center;gap:8px;font-weight:650;font-size:.95rem}
.brs .bri{width:22px;height:22px;opacity:.85}

/* stats */
.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:20px;overflow:hidden;margin-top:56px}
@media (min-width:800px){.stats{grid-template-columns:repeat(4,minmax(0,1fr))}}
.stats div{background:var(--card);padding:22px 20px}
.stats b{display:block;font-size:clamp(1.6rem,4vw,2.2rem);letter-spacing:-.03em;line-height:1.1;background:linear-gradient(120deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;color:transparent}
.stats span{color:var(--muted);font-size:.9rem}

/* bento */
.center-head{text-align:center;margin:0 auto 32px;max-width:680px}
.bento{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:720px){.bento{grid-template-columns:repeat(2,minmax(0,1fr))}.span2{grid-column:span 2}}
@media (min-width:1000px){.bento{grid-template-columns:repeat(3,minmax(0,1fr))}.span3{grid-column:span 3}}
.tile{position:relative;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:var(--shadow);overflow:hidden;transition:border-color .2s,transform .2s}
.tile:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
.tile h3{font-size:1.15rem;margin:0 0 6px}
.tile>p{margin:0;color:var(--muted);font-size:.95rem}
.tile .ti{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);margin-bottom:14px}.tile .ti svg{width:20px;height:20px}
.viz{margin-top:20px;background:var(--bg-2);border-radius:14px;padding:14px;font-size:.84rem;flex:1;display:flex;flex-direction:column;justify-content:center;gap:8px;min-width:0}
.viz.split2{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
@media (min-width:560px){.viz.split2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.viz .mk-ls li{background:var(--card)}.viz .mk-ls li.sub{background:var(--sub-bg)}.viz .mk-ls li.can{background:var(--can-bg)}
.kz{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:10px;padding:9px 12px;border:1px solid var(--line)}
.kz code{text-decoration:line-through;color:var(--faint)}.kz svg{width:14px;height:14px;color:var(--accent);flex:none}.kz b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.entry{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.entry .top{display:flex;justify-content:space-between;gap:8px;font-size:.74rem;color:var(--faint);margin-bottom:6px}
.entry p{margin:4px 0 0}.entry .k{font-size:.7rem;font-weight:750;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);margin-right:4px}
.viz .mk-todo,.viz .mk-ev{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px 8px}
.pal{background:var(--card);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 20px 40px -24px rgba(24,24,27,.4);overflow:hidden}
.pal .q{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);color:var(--text)}
.pal .q svg{width:15px;height:15px;color:var(--faint)}.pal .q span::after{content:"";display:inline-block;width:2px;height:1em;background:var(--accent);vertical-align:-2px;margin-left:1px;animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.pal ul{list-style:none;margin:0;padding:6px;display:grid;gap:2px}
.pal li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;color:var(--muted)}
.pal li.on{background:var(--accent-soft);color:var(--text)}
.pal li kbd{margin-left:auto;font-size:.7rem}
.keys{display:grid;gap:8px;align-content:center}
.keys div{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px}
.keys span{color:var(--muted)}.keys kbd{font-size:.72rem}
.pins{list-style:none;margin:0;padding:6px;display:grid;gap:2px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.pins li{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;color:var(--muted)}
.pins li.p{color:var(--text);font-weight:600}.pins li .pn{margin-left:auto;font-size:.75rem}.pins li .k{margin-left:auto}
.pins hr{border:0;border-top:1px solid var(--line);margin:4px 6px}
.look{display:flex;flex-wrap:wrap;align-items:center;gap:14px 24px}
.sw{display:flex;gap:8px}.sw i{width:30px;height:30px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(255,255,255,.35)}
.sw i.on{outline:2px solid var(--text);outline-offset:2px}
.mini-ui{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.mini-ui .btn{padding:6px 12px;font-size:.8rem;border-radius:9px}

/* AI band */
.ai-band{--card:#1c1c20;--bg:#141417;--bg-2:#232328;--text:#f4f4f5;--muted:#b0b0b8;--faint:#7c7c85;--line:#2e2e34;--line-2:#3c3c43;
  --okbg:#10291c;--ok:#6ee7a8;--errbg:#3b1714;--err:#ff9b8f;--accent-soft:#3a2614;
  position:relative;isolation:isolate;overflow:hidden;background:#0e0e11;color:var(--text);border-radius:28px;padding:40px 20px;margin:0 auto}
@media (min-width:640px){.ai-band{padding:56px 48px}}
.ai-band::before{content:"";position:absolute;z-index:-1;inset:auto -10% -40% 30%;height:420px;background:radial-gradient(50% 50% at 50% 50%,rgba(232,115,12,.35),transparent 70%);filter:blur(10px)}
.ai-band::after{content:"";position:absolute;z-index:-1;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:22px 22px;-webkit-mask-image:linear-gradient(120deg,#000,transparent 60%);mask-image:linear-gradient(120deg,#000,transparent 60%)}
.ai-band h2{font-size:clamp(1.8rem,5vw,2.8rem);letter-spacing:-.035em;line-height:1.08}
.ai-band .sub{color:var(--muted);font-size:1.05rem}
.ai-band .split{gap:36px}
.ai-logos{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 26px}
.ai-logos span{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border:1px solid var(--line);border-radius:999px;padding:7px 14px 7px 10px;font-weight:650;font-size:.92rem}
.ai-logos .bi{width:20px;height:20px}
.ai-band .chat{max-width:480px}
.ai-band .btn.sec{background:rgba(255,255,255,.06)}
.ai-band .cta-row{justify-content:flex-start}
.ai-band .btn.lg{padding:13px 18px;font-size:.96rem}

/* install */
.steps3{display:grid;gap:16px;grid-template-columns:minmax(0,1fr);counter-reset:st}
@media (min-width:900px){.steps3{grid-template-columns:repeat(3,minmax(0,1fr))}}
.st3{position:relative;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:var(--shadow);display:flex;flex-direction:column;min-width:0}
.st3::before{counter-increment:st;content:counter(st);width:36px;height:36px;border-radius:12px;display:grid;place-items:center;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 8px 18px -8px rgba(232,115,12,.7);margin-bottom:14px}
.st3 h3{font-size:1.1rem}.st3>p{margin:0;color:var(--muted);font-size:.94rem}
.term{margin-top:16px;background:#16161a;color:#e7e7ea;border-radius:12px;padding:12px 14px;font:500 .8rem/1.6 var(--mono);overflow-x:auto;white-space:pre}
.term .p{color:#f8b26a}.term .ok{color:#9fe0a8}.term .c{color:#77777f}
.toggle{margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg-2);border-radius:12px;padding:12px 14px;font-size:.88rem;font-weight:600}
.toggle i{width:38px;height:22px;border-radius:999px;background:var(--accent);position:relative;flex:none}.toggle i::after{content:"";position:absolute;right:3px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff}
.done-row{margin-top:16px;display:flex;align-items:center;gap:10px;background:var(--okbg);color:var(--ok);border-radius:12px;padding:12px 14px;font-size:.88rem;font-weight:650}
.done-row svg{width:18px;height:18px;flex:none}
.inst-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;margin-top:28px}
.inst-note{text-align:center;color:var(--muted);font-size:.9rem;margin:16px auto 0;max-width:46em}

/* closing CTA */
.final{text-align:center;padding:56px 20px;border-radius:28px;background:linear-gradient(135deg,var(--accent-soft),var(--card));border:1px solid var(--line);position:relative;overflow:hidden}
.final img{width:84px;height:84px;filter:drop-shadow(0 14px 22px rgba(232,115,12,.35))}
.final h2{font-size:clamp(1.7rem,4.6vw,2.5rem);letter-spacing:-.035em;margin:16px 0 8px}
.final .sub{max-width:34em;margin:0 auto 24px}

/* scroll reveal (only with JS and without reduced motion) */
.rv-on .rv{opacity:0;transform:translateY(22px);transition:opacity .8s ease,transform .8s cubic-bezier(.2,.7,.2,1)}
.rv-on .rv.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.fl,.pal .q span::after{animation:none}.bw{transform:none!important}}
`;

const JS = `
(function(){if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var els=document.querySelectorAll('.rv');document.documentElement.classList.add('rv-on');
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -6% 0px'});
els.forEach(function(el){io.observe(el)})})();
`;

const ICON = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 13h3M8 16h6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  cmd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22Z"/><circle cx="7.5" cy="10.5" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="10.5" r="1"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>',
  laptop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/></svg>',
  nope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
};

const FAQ = [
  ['Was ist ISGY Intern Plus?', 'ISGY Intern Plus ist eine kostenlose Browser-Erweiterung für isgy-intern.de, das Schulportal des Gymnasiums Ismaning. Sie ersetzt das Dashboard durch „Mein Tag“ mit Stundenplan, Vertretungen und Entfällen, zeigt Lehrernamen statt Kürzel, den letzten Tagebucheintrag per Klick, Termine und Prüfungen sowie eigene Aufgaben & Notizen. Dazu gibt es einen MCP-Server, über den Claude, ChatGPT und Gemini dein Schulportal lesen können.'],
  ['Ist das ein offizielles Angebot der Schule?', 'Nein. ISGY Intern Plus ist ein inoffizielles Schülerprojekt und steht in keiner Verbindung zum Gymnasium Ismaning oder zum Betreiber des Portals. Es nutzt ausschließlich deinen eigenen Zugang und liest nur deine eigenen Daten.'],
  ['Kostet das etwas?', 'Nein. ISGY Intern Plus ist kostenlos und Open Source – ohne Werbung, ohne Tracking und ohne Abo.'],
  ['In welchen Browsern funktioniert die Erweiterung?', 'In Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Arc und allen anderen Chromium-Browsern sowie in Firefox – dort mit einem Klick über addons.mozilla.org, von Mozilla signiert und mit automatischen Updates. Safari lässt sich auf dem Mac über Apples Konverter nutzen.'],
  ['Gibt es die Erweiterung im Chrome Web Store?', 'Noch nicht. Derzeit installierst du sie direkt aus dem Quellcode auf GitHub: einmal „node build.mjs“ ausführen und den Ordner im Entwicklermodus laden – das dauert etwa zwei Minuten. Die Anleitung steht im Abschnitt „Installieren“.'],
  ['Werden meine Daten irgendwohin geschickt?', 'Ohne KI-Konto nicht: Die Erweiterung liest nur von isgy-intern.de und speichert alles lokal in deinem Browser. Die Kürzel-Liste der Schule wird im Speicher ausgelesen, gespeichert wird nur die Zuordnung Kürzel → Name. Erst wenn du dich mit einem KI-Konto verbindest, werden deine Aufgaben & Notizen (und bei Office-365-Login die Portal-Sitzung) an den Server übertragen.'],
  ['Funktioniert das auch auf dem Handy?', 'Die Erweiterung braucht einen Desktop-Browser. Auf dem Handy nutzt du am besten die KI-Anbindung: Einmal in Claude oder ChatGPT eingerichtet, fragst du in der App einfach „Was habe ich morgen?“.'],
  ['Muss ich die KI-Funktion nutzen?', 'Nein. Die Erweiterung funktioniert komplett ohne KI und ohne Konto. Die Anbindung an Claude, ChatGPT und Gemini ist ein optionales Extra.'],
];

function schema() {
  const author = { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url };
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: NAME, description: DESCRIPTION, inLanguage: 'de-DE', publisher: author },
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${SITE}/#extension`, name: NAME, alternateName: 'ISGY Intern Plus Browser-Erweiterung', description: DESCRIPTION,
      applicationCategory: 'EducationalApplication', applicationSubCategory: 'Browser-Erweiterung', operatingSystem: 'Chrome, Microsoft Edge, Brave, Opera, Vivaldi, Arc, Firefox', softwareVersion: VERSION, inLanguage: 'de',
      image: `${SITE}/assets/logo-512.png`, screenshot: `${SITE}/assets/og.png`, downloadUrl: REPO, installUrl: `${REPO}#installation`, url: `${SITE}/`, isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' }, author, sameAs: [REPO],
      featureList: ['„Mein Tag“-Dashboard mit Vertretungen und Entfällen', 'Lehrernamen statt Kürzel', 'Letzter Tagebucheintrag per Klick', 'Termine und Prüfungen aus dem Klassenkalender', 'Aufgaben & Notizen mit Sync', 'Befehlspalette und Tastenkürzel', 'Angepinnte Seiten', 'KI-Anbindung an Claude, ChatGPT und Gemini'] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
}

const lessons = (rows) => `<ul class="mk-ls">${rows.map(([cls, n, t, subj, tag, who, room]) => `<li${cls ? ` class="${cls}"` : ''}><span class="n">${n}<small>${t}</small></span><span class="s"><b>${subj}${tag}</b><small>${who}</small></span><span class="r">${room}</span></li>`).join('')}</ul>`;
const HA = '<i>HA</i>';

function mockup() {
  return `<div class="stage rv">
<div class="bw" role="img" aria-label="Vorschau: das „Mein Tag“-Dashboard von ISGY Intern Plus mit Stundenplan, Vertretung, Entfall, Terminen und Aufgaben.">
<div class="bw-top"><span class="bw-dots"><i></i><i></i><i></i></span><span class="addr">${I.lock}<b>isgy-intern.de</b><span>/index.php?page=dashboard</span></span><img class="bw-ext" src="/assets/logo-96.png" width="22" height="22" alt=""></div>
<div class="mk">
<div class="mk-nav"><p>Angepinnt</p><ul><li><i></i>Vertretungsplan<span class="pin">📌</span></li><li><i></i>Klassenkalender<span class="pin">📌</span></li></ul>
<p>Portal</p><ul><li class="on"><i></i>Mein Tag</li><li><i></i>Stundenplan</li><li><i></i>Klassentagebuch</li><li><i></i>Wochenplan</li><li><i></i>Nachrichten</li><li><i></i>Dokumente</li></ul></div>
<div class="mk-main">
<div class="mk-head"><div><small>Donnerstag, 16. Oktober</small><b>Mein Tag</b></div><span class="mk-search">Suchen … <kbd>Strg K</kbd></span></div>
<div class="mk-cols">
<div class="mk-card"><div class="mk-tabs"><span class="on"><b>Heute</b>Do, 16.10.<em>2</em></span><span><b>Morgen</b>Fr, 17.10.</span></div>
${lessons([
    ['', '1–2', '07:55', 'Mathematik', HA, 'Max Mustermann', '112'],
    ['sub', '3', '09:45', 'Deutsch', '', 'Vertretung: Anna Weber · statt Lena Krüger', '204'],
    ['now', '4', '10:30', 'Englisch', '<i class="nw">jetzt</i>', 'Laura Schmidt', '015'],
    ['can', '5', '11:35', 'Physik', '', 'Entfall – Lehrkraft auf Fortbildung', 'E12'],
    ['', '6', '12:20', 'Biologie', HA, 'Jonas Becker', '108'],
  ])}</div>
<div class="mk-side">
<div class="mk-card"><h4>Termine</h4><div class="mk-ev"><div><span class="d hot"><b>17</b>Okt</span><span><b>Mathe-Schulaufgabe</b><br><small>morgen · 1.–2. Stunde</small></span></div><div><span class="d"><b>22</b>Okt</span><span><b>Bio-Kurzarbeit</b><br><small>Mittwoch</small></span></div></div></div>
<div class="mk-card"><h4>Aufgaben &amp; Notizen</h4><ul class="mk-todo"><li><span class="bx"></span><span>Mathe S. 42 Nr. 3<em>Fr</em></span></li><li class="done"><span class="bx"></span><span>Vokabeln Unit 3</span></li><li><span class="bx"></span><span>Bio-Referat vorbereiten<br><span class="via">${brandIcon('claude', 11)}über Claude angelegt</span></span></li></ul></div>
</div>
</div>
</div>
</div>
</div>
<div class="fl fl-kz" aria-hidden="true"><code>Mm</code>${ICON.arrow}<b>Max Mustermann</b></div>
<div class="fl fl-ai" aria-hidden="true">${brandIcon('claude', 22)}<div><p><small>Du</small>Fällt heute was aus?</p><p><small>Claude</small>Ja – Physik in der 5. Stunde entfällt. Bis morgen noch Mathe S. 42 Nr. 3.</p></div></div>
</div>`;
}

export function homePage() {
  return `${head(TITLE, { index: true, path: '/', jsonld: schema(), css: CSS })}<body>${logoSprite()}${browserSprite()}
${siteHeader('home')}
<main id="inhalt">
<div class="hh"><div class="hh-grid" aria-hidden="true"></div><div class="wrap">
<a class="ann" href="/mcp"><b>Neu</b><span>Frag Claude, ChatGPT oder Gemini nach deinem Stundenplan</span><svg class="ar" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
<h1>isgy-intern.de, <span class="hl">endlich übersichtlich.</span></h1>
<p class="lead"><strong>ISGY Intern Plus</strong> ist die kostenlose Browser-Erweiterung für das Schulportal des Gymnasiums Ismaning: dein Tag auf einen Blick, Lehrernamen statt Kürzel, Hausaufgaben mit einem Klick – und wenn du willst, fragst du einfach deinen KI-Assistenten.</p>
<div class="cta-row"><a class="btn lg pri" href="#installieren">${ICON.dl}Kostenlos installieren</a><a class="btn lg sec" href="/mcp">${brandIcon('claude', 18)}KI-Assistent verbinden</a></div>
<div class="trust"><span>${I.check}Kostenlos &amp; Open Source</span><span>${I.check}Keine Werbung, kein Tracking</span><span>${I.check}Daten bleiben im Browser</span></div>
</div>
${mockup()}
<div class="wrap brs rv"><p>Läuft in deinem Browser</p><ul>${BROWSERS.map(([id, name]) => `<li>${browserIcon(id, 22)}${name}</li>`).join('')}<li>+ Edge</li></ul></div>
</div>

<div class="wrap"><div class="stats rv">
<div><b>0 €</b><span>kostenlos &amp; Open Source</span></div>
<div><b>0 Tracker</b><span>keine Werbung, keine Analyse</span></div>
<div><b>~2 Min.</b><span>bis zur fertigen Installation</span></div>
<div><b>15 Werkzeuge</b><span>für deinen KI-Assistenten</span></div>
</div></div>

<section id="funktionen" aria-labelledby="h-feat"><div class="wrap">
<div class="center-head rv"><span class="kicker">Funktionen</span><h2 id="h-feat">Alles, was dem Portal gefehlt hat.</h2><p class="sub">Die Erweiterung legt sich über isgy-intern.de – gleiche Daten, gleiche Anmeldung, nur viel angenehmer.</p></div>
<div class="bento">

<article class="tile span2 rv"><div class="ti">${I.cal}</div><h3>„Mein Tag“ statt Widget-Chaos</h3><p>Heute und der nächste Schultag auf einen Blick. Vertretungen und Entfälle stehen direkt an der Stunde, Doppelstunden sind zusammengefasst, und Fächer, die du nicht hast, blendest du aus.</p>
<div class="viz split2">${lessons([
    ['sub', '3', '09:45', 'Deutsch', '', 'Vertretung: Anna Weber', '204'],
    ['can', '5', '11:35', 'Physik', '', 'Entfall', 'E12'],
  ])}${lessons([
    ['now', '4', '10:30', 'Englisch', '<i class="nw">jetzt</i>', 'Laura Schmidt', '015'],
    ['', '6', '12:20', 'Biologie', HA, 'Jonas Becker', '108'],
  ])}</div></article>

<article class="tile rv"><div class="ti">${ICON.user}</div><h3>Namen statt Kürzel</h3><p>„Mm“? Da steht jetzt einfach der Name – im Stundenplan, Vertretungsplan und Dashboard.</p>
<div class="viz"><div class="kz"><code>Mm</code>${ICON.arrow}<b>Max Mustermann</b></div><div class="kz"><code>Wb</code>${ICON.arrow}<b>Anna Weber</b></div><div class="kz"><code>Sch</code>${ICON.arrow}<b>Laura Schmidt</b></div></div></article>

<article class="tile rv"><div class="ti">${I.book}</div><h3>Letzter Tagebucheintrag</h3><p>Ein Klick auf die Stunde zeigt Thema und Hausaufgabe der letzten Stunde – perfekt, wenn du gefehlt hast.</p>
<div class="viz"><div class="entry"><div class="top"><b>Deutsch</b><span>Di, 14.10.</span></div><p><span class="k">Thema</span>Gedichtanalyse „Der Panther“</p><p><span class="k">HA</span>S. 87, Nr. 2 schriftlich</p></div></div></article>

<article class="tile rv"><div class="ti">${I.pen}</div><h3>Aufgaben &amp; Notizen</h3><p>To-dos mit Fälligkeit erscheinen am richtigen Tag. Mit KI-Konto auf allen Geräten synchron.</p>
<div class="viz"><ul class="mk-todo"><li><span class="bx"></span><span>Mathe S. 42 Nr. 3<em>Fr</em></span></li><li class="done"><span class="bx"></span><span>Vokabeln Unit 3</span></li><li><span class="bx"></span><span>Bio-Referat<br><span class="via">${brandIcon('claude', 11)}über Claude angelegt</span></span></li></ul></div></article>

<article class="tile rv"><div class="ti">${ICON.sun}</div><h3>Prüfungen im Blick</h3><p>Schulaufgaben, Kurzarbeiten und Termine der nächsten Tage – direkt im Dashboard.</p>
<div class="viz"><div class="mk-ev"><div><span class="d hot"><b>17</b>Okt</span><span><b>Mathe-Schulaufgabe</b><br><small>morgen</small></span></div><div><span class="d"><b>22</b>Okt</span><span><b>Bio-Kurzarbeit</b><br><small>Mittwoch</small></span></div></div></div></article>

<article class="tile span2 rv"><div class="ti">${ICON.cmd}</div><h3>Befehlspalette &amp; Tastenkürzel</h3><p><kbd>Strg</kbd> + <kbd>K</kbd> öffnet jede Seite und Aktion in Sekunden. Mit <kbd>g</kbd> <kbd>v</kbd> zum Vertretungsplan, <kbd>Alt</kbd> + <kbd>1</kbd> zur ersten angepinnten Seite – alles frei belegbar.</p>
<div class="viz split2"><div class="pal"><div class="q">${ICON.cmd}<span>vert</span></div><ul><li class="on">Vertretungsplan<kbd>g v</kbd></li><li>Klassenkalender<kbd>g k</kbd></li><li>🔄 Mit KI-Konto synchronisieren</li></ul></div>
<div class="keys"><div><span>Stundenplan</span><kbd>g s</kbd></div><div><span>Tagebuch</span><kbd>g t</kbd></div><div><span>Alle Kürzel</span><kbd>?</kbd></div></div></div></article>

<article class="tile rv"><div class="ti">${ICON.pin}</div><h3>Anpinnen</h3><p>Über einen Menüpunkt fahren, 📌 klicken – deine wichtigsten Seiten stehen ganz oben.</p>
<div class="viz"><ul class="pins"><li class="p">Vertretungsplan<span class="pn">📌</span></li><li class="p">Klassenkalender<span class="pn">📌</span></li><hr><li>Stundenplan<kbd class="k">g s</kbd></li><li>Nachrichten</li></ul></div></article>

<article class="tile span3 rv"><div class="ti">${ICON.palette}</div><h3>Dein Portal, dein Look</h3><p>Aufgeräumtes, modernes Design mit eigener Akzentfarbe und frei belegbaren Tastenkürzeln. Das Original-Dashboard ist trotzdem immer nur einen Klick entfernt.</p>
<div class="viz"><div class="look"><div class="sw" aria-hidden="true"><i class="on" style="background:#e8730c"></i><i style="background:#2563eb"></i><i style="background:#16a34a"></i><i style="background:#7c3aed"></i><i style="background:#db2777"></i></div>
<div class="mini-ui"><span>Original-Dashboard anzeigen</span><span class="btn ghost">Umschalten</span></div></div></div></article>
</div>
</div></section>

<section id="ki" aria-labelledby="h-ai" style="padding-top:8px"><div class="wrap"><div class="ai-band rv">
<div class="split">
<div>
<span class="kicker">KI-Anbindung · optional</span>
<h2 id="h-ai">Keine Lust zu klicken? Frag einfach.</h2>
<p class="sub">Verbinde isgy-intern.de mit deinem KI-Assistenten und frag „Was habe ich morgen?“, „Was muss ich bis Montag machen?“ oder „Mach mir einen Lernplan für die Schulaufgabe“. Der Assistent liest Stundenplan, Vertretungen, Hausaufgaben und Prüfungen – und legt auf Wunsch Aufgaben in „Mein Tag“ an.</p>
<div class="ai-logos"><span>${brandIcon('claude', 20)}Claude</span><span>${brandIcon('openai', 20)}ChatGPT</span><span>${brandIcon('gemini', 20)}Gemini</span></div>
<div class="cta-row"><a class="btn lg pri" href="/mcp">KI-Assistent verbinden${ICON.arrow}</a><a class="btn lg sec" href="/konto?neu=1">KI-Konto erstellen</a></div>
</div>
<div class="chat" role="img" aria-label="Beispiel: Der KI-Assistent beantwortet die Frage nach den Hausaufgaben bis Montag.">
<div class="chat-top">${brandIcon('claude', 20)}<b>Claude</b> · ISGY Intern<span class="pill">● verbunden</span></div>
<div class="msg me">Was muss ich bis Montag machen?</div>
<div class="tool">${I.bolt}hausaufgaben(bis: "Montag")</div>
<div class="msg ai">Bis Montag sind fällig:
<ul><li><b>Mathe</b>: S. 42 Nr. 3 <span class="tag org">morgen</span></li><li><b>Deutsch</b>: Gedichtanalyse, S. 87 Nr. 2</li><li><b>Bio</b>: Referat vorbereiten</li></ul>
Soll ich dir das als Aufgaben in „Mein Tag“ eintragen?</div>
</div>
</div>
</div></div></section>

<section id="installieren" aria-labelledby="h-inst"><div class="wrap">
<div class="center-head rv"><span class="kicker">Installieren</span><h2 id="h-inst">In zwei Minuten startklar.</h2><p class="sub">Du brauchst nur <a href="https://nodejs.org" rel="noopener">Node.js</a> (ab Version 18) und einen Desktop-Browser.</p></div>
<div class="steps3">
<div class="st3 rv"><h3>Herunterladen &amp; bauen</h3><p>Quellcode von GitHub laden (<b>Code → Download ZIP</b> oder <code>git clone</code>) und im Ordner einmal ausführen:</p>
<div class="term"><span class="p">$</span> node build.mjs
<span class="ok">✓</span> dist/chromium
<span class="ok">✓</span> dist/firefox</div></div>
<div class="st3 rv"><h3>Im Browser laden</h3><p><code>chrome://extensions</code> öffnen, <b>Entwicklermodus</b> einschalten, <b>„Entpackte Erweiterung laden“</b> und <code>dist/chromium</code> wählen. <b>Firefox</b>: einfach <a href="${FIREFOX_XPI}" rel="noopener">hier installieren</a> – ohne Bauen.</p>
<div class="toggle"><span>Entwicklermodus</span><i aria-hidden="true"></i></div></div>
<div class="st3 rv"><h3>isgy-intern.de öffnen</h3><p>Ganz normal einloggen – dein Dashboard heißt jetzt „Mein Tag“. Einstellungen findest du unter ⚙.</p>
<div class="done-row">${I.check}Fertig. Viel Spaß mit dem neuen Portal!</div></div>
</div>
<div class="inst-foot rv"><a class="btn lg pri" href="${FIREFOX_XPI}" rel="noopener">${browserIcon('firefox', 18)}Für Firefox installieren</a><a class="btn lg sec" href="${REPO}#installation" rel="noopener">Anleitung für Chrome &amp; Co.${ICON.arrow}</a><a class="btn lg sec" href="${REPO}" rel="noopener">${ICON.code}Quellcode auf GitHub</a></div>
<p class="inst-note">Updates: In Firefox automatisch. Sonst <code>git pull</code>, erneut <code>node build.mjs</code> und die Erweiterung neu laden. Safari auf dem Mac geht über Apples Konverter.</p>
</div></section>

<section id="datenschutz" aria-labelledby="h-priv" style="background:var(--bg-2)"><div class="wrap">
<div class="center-head rv"><span class="kicker">Datenschutz</span><h2 id="h-priv">Deine Daten bleiben bei dir.</h2></div>
<div class="grid g3">
<div class="card rv"><div class="feat-ico">${ICON.laptop}</div><h3>Läuft in deinem Browser</h3><p>Die Erweiterung liest nur von isgy-intern.de und speichert alles lokal. Von der Kürzel-Liste bleibt nur die Zuordnung Kürzel → Name – die PDF selbst wird nie gespeichert.</p></div>
<div class="card rv"><div class="feat-ico">${ICON.nope}</div><h3>Kein Tracking, keine Werbung</h3><p>Keine Analyse-Tools, keine Werbung, kein Verkauf von Daten. Ohne KI-Konto spricht die Erweiterung mit keinem anderen Server.</p></div>
<div class="card rv"><div class="feat-ico">${ICON.code}</div><h3>Offener Quellcode</h3><p>Jede Zeile ist auf <a href="${REPO}" rel="noopener">GitHub</a> einsehbar. Was mit KI-Konto gespeichert wird, steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p></div>
</div>
</div></section>

<section id="faq" aria-labelledby="h-faq"><div class="wrap">
<div class="center-head rv"><span class="kicker">FAQ</span><h2 id="h-faq">Häufige Fragen</h2></div>
<div class="faq" style="max-width:820px;margin:0 auto">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</div></section>

<section aria-labelledby="h-final" style="padding-top:0"><div class="wrap"><div class="final rv">
<img src="/assets/logo-192.png" width="84" height="84" alt="" loading="lazy" decoding="async">
<h2 id="h-final">Mach isgy-intern.de zu deinem Portal.</h2>
<p class="sub">Kostenlos, ohne Konto, in zwei Minuten installiert.</p>
<div class="cta-row"><a class="btn lg pri" href="#installieren">${ICON.dl}Jetzt installieren</a><a class="btn lg sec" href="/mcp">KI-Assistent verbinden</a></div>
</div></div></section>
</main>
${siteFooter()}
${tail(JS)}`;
}
