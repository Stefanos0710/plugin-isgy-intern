// HTML pages: start page with setup instructions, login (OAuth authorize), personal access key, errors.
// Self-contained (inline CSS/JS, inline SVG), so the strict CSP in api/index.js holds. Light + dark, mobile first.
import { SITE, REPO, NAME, TITLE, DESCRIPTION, OG_ALT, AUTHOR, UPDATED, logoSprite, brandIcon, brandOf } from './site.js';
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
:root{
  --accent:#e8730c;--accent-2:#f59e0b;--accent-ink:#fff;--accent-soft:#fdf0e4;
  --bg:#f7f6f3;--bg-2:#efede8;--card:#fff;--text:#18181b;--muted:#5f5f68;--faint:#8b8b94;--line:#e6e3dc;--line-2:#d9d5cc;
  --err:#b42318;--errbg:#fdecea;--ok:#067647;--okbg:#e7f6ee;
  --shadow:0 1px 2px rgba(24,24,27,.04),0 8px 24px -12px rgba(24,24,27,.12);
  --r:16px;--mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --accent:#f08a2c;--accent-soft:#3a2614;--bg:#111113;--bg-2:#18181b;--card:#1c1c1f;--text:#f4f4f5;--muted:#a8a8b0;--faint:#77777f;
  --line:#2c2c31;--line-2:#3a3a40;--err:#ff9b8f;--errbg:#3b1714;--ok:#6ee7a8;--okbg:#10291c;--shadow:0 1px 2px rgba(0,0,0,.3),0 12px 32px -16px rgba(0,0,0,.6);
}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:var(--accent);text-underline-offset:2px}
.wrap{width:100%;max-width:1080px;margin:0 auto;padding:0 16px}
@media (min-width:640px){.wrap{padding:0 28px}}

/* nav */
.nav{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);border-bottom:1px solid transparent}
.nav.scrolled{border-bottom-color:var(--line)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:60px;gap:12px}
.logo{display:flex;align-items:center;gap:10px;font-weight:750;letter-spacing:-.01em;color:var(--text);text-decoration:none;white-space:nowrap}
.mark{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;font-size:13px;font-weight:800;letter-spacing:-.02em;box-shadow:0 4px 12px -4px rgba(232,115,12,.55)}
.logo small{font-weight:600;color:var(--faint);font-size:.82rem}
.nav-links{display:flex;gap:4px}
.nav-links a{color:var(--muted);text-decoration:none;font-size:.9rem;font-weight:550;padding:7px 10px;border-radius:8px}
.nav-links a:hover{background:var(--bg-2);color:var(--text)}
@media (max-width:560px){.nav-links .hide-sm,.logo small{display:none}}

/* hero */
.hero{padding:40px 0 24px;position:relative;overflow-x:clip}
.hero::before{content:"";position:absolute;inset:-60px 0 auto 0;height:420px;background:radial-gradient(60% 60% at 70% 20%,color-mix(in srgb,var(--accent) 16%,transparent),transparent 70%);pointer-events:none;z-index:-1}
.hero-grid{display:grid;gap:36px;align-items:center}
@media (min-width:900px){.hero{padding:72px 0 40px}.hero-grid{grid-template-columns:1.05fr .95fr;gap:56px}}
.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:999px;background:var(--card);border:1px solid var(--line);font-size:.82rem;font-weight:600;color:var(--muted);box-shadow:var(--shadow)}
.eyebrow .dots{display:flex}.eyebrow .dots i{width:20px;height:20px;border-radius:50%;border:2px solid var(--card);display:grid;place-items:center;font-style:normal;font-size:10px;font-weight:800;color:#fff;margin-left:-6px}
.eyebrow .dots i:first-child{margin-left:0}
h1{font-size:clamp(2rem,6.4vw,3.3rem);line-height:1.06;letter-spacing:-.035em;margin:18px 0 14px;font-weight:800}
h1 .hl{background:linear-gradient(120deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:clamp(1.02rem,2.4vw,1.15rem);color:var(--muted);max-width:34em;margin:0 0 24px}
.copybox{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line-2);border-radius:14px;padding:6px 6px 6px 14px;box-shadow:var(--shadow);max-width:520px}
.copybox code{flex:1;min-width:0;font:600 .92rem/1.3 var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:none;border:0;padding:0}
.copybox .lbl{font-size:.72rem;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;margin-right:4px;white-space:nowrap}
.hero-grid>*{min-width:0}
@media (max-width:480px){.copybox{flex-wrap:wrap;padding:12px}.copybox .lbl{width:100%;margin:0}.copybox code{white-space:normal;overflow-wrap:anywhere;flex-basis:100%;font-size:.8rem;padding:2px 0 4px}.copybox .btn{width:100%;padding:12px}}
.hero-cta{margin:14px 0 0;font-size:.92rem;font-weight:600;color:var(--faint)}.hero-cta a{text-decoration:none}
.badges{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:18px;color:var(--muted);font-size:.88rem}
.badges span{display:inline-flex;align-items:center;gap:6px}
.badges svg{width:16px;height:16px;color:var(--ok);flex:none}

/* chat preview */
.chat{background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);padding:16px;display:flex;flex-direction:column;gap:12px;max-width:520px;width:100%;justify-self:center}
.chat-top{display:flex;align-items:center;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--line);font-size:.82rem;color:var(--faint);font-weight:600}
.chat-top b{color:var(--text)}.chat-top .pill{margin-left:auto;background:var(--okbg);color:var(--ok);padding:2px 9px;border-radius:999px;font-size:.74rem}
.msg{max-width:88%;padding:10px 14px;border-radius:16px;font-size:.93rem;line-height:1.5}
.msg.me{align-self:flex-end;background:var(--accent);color:#fff;border-bottom-right-radius:5px}
.msg.ai{align-self:flex-start;background:var(--bg-2);border-bottom-left-radius:5px}
.tool{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;font:600 .76rem var(--mono);color:var(--muted);background:var(--bg);border:1px dashed var(--line-2);border-radius:8px;padding:4px 9px}
.tool svg{width:13px;height:13px;color:var(--accent)}
.msg ul{margin:6px 0 0;padding-left:18px}.msg li{margin:2px 0}
.tag{display:inline-block;font-size:.72rem;font-weight:700;padding:1px 7px;border-radius:6px;vertical-align:1px}
.tag.red{background:var(--errbg);color:var(--err)}.tag.org{background:var(--accent-soft);color:var(--accent)}

/* sections */
section{padding:44px 0}
@media (min-width:900px){section{padding:64px 0}}
.sec-head{max-width:640px;margin-bottom:24px}
.kicker{font-size:.78rem;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
h2{font-size:clamp(1.5rem,4vw,2.1rem);letter-spacing:-.025em;line-height:1.15;margin:6px 0 8px}
h3{font-size:1.05rem;margin:0 0 6px;letter-spacing:-.01em}
.sub{color:var(--muted);margin:0}

/* client tabs */
.tabs{background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);overflow:hidden}
.tabs>input{position:absolute;opacity:0;pointer-events:none}
.tab-bar{display:flex;gap:4px;padding:8px;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none;background:var(--bg-2)}
.tab-bar::-webkit-scrollbar{display:none}
@media (max-width:560px){.tab-bar{display:grid;grid-template-columns:1fr 1fr;overflow:visible}.tab-bar label{flex:none;padding:10px 8px}}
.tab-bar label{flex:1 0 auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:9px 14px;border-radius:11px;font-weight:650;font-size:.92rem;color:var(--muted);cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}
.tab-bar label:hover{color:var(--text)}
.tab-bar .ico{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;color:#fff;font-size:11px;font-weight:800}
.panel{display:none;padding:22px 18px 24px}
@media (min-width:640px){.panel{padding:28px 32px 32px}}
${['claude', 'chatgpt', 'gemini', 'andere'].map((k) => `#t-${k}:checked~.tab-bar [for=t-${k}]{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.1)}#t-${k}:focus-visible~.tab-bar [for=t-${k}]{outline:2px solid var(--accent);outline-offset:-2px}#t-${k}:checked~.p-${k}{display:block}`).join('\n')}
.steps{list-style:none;margin:0;padding:0;counter-reset:s;display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
.steps li{counter-increment:s;position:relative;padding-left:44px;min-height:30px;min-width:0}
.steps li::before{content:counter(s);position:absolute;left:0;top:-1px;width:30px;height:30px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-weight:800;font-size:.9rem;display:grid;place-items:center}
.note{margin-top:18px;padding:12px 14px;border-radius:12px;background:var(--bg-2);color:var(--muted);font-size:.9rem}
.note b{color:var(--text)}

/* cards grid */
.grid{display:grid;gap:14px;grid-template-columns:1fr}
@media (min-width:640px){.grid{grid-template-columns:repeat(2,1fr)}}
@media (min-width:960px){.grid.g3{grid-template-columns:repeat(3,1fr)}}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:20px;box-shadow:var(--shadow)}
.ask{display:flex;flex-direction:column;gap:10px}
.ask q{font-weight:650;font-size:1.02rem;quotes:"„" "“"}
.ask p{margin:0;color:var(--muted);font-size:.92rem}
.ask code{align-self:flex-start}
.feat-ico{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);margin-bottom:12px}
.feat-ico svg{width:20px;height:20px}
.card p{margin:0;color:var(--muted);font-size:.94rem}
.feature-wide{display:flex;gap:16px;align-items:flex-start}.feature-wide .feat-ico{flex:none;margin:0}
@media (max-width:560px){.feature-wide{flex-direction:column}}

/* code */
code,pre{font-family:var(--mono);font-size:.84em}
code{background:var(--bg-2);border:1px solid var(--line);border-radius:6px;padding:1px 6px;word-break:break-word}
pre{background:#16161a;color:#e7e7ea;border-radius:12px;padding:14px 16px;overflow-x:auto;margin:12px 0 0;line-height:1.55;font-size:.84rem}
pre .k{color:#f8b26a}pre .s{color:#9fe0a8}
kbd{font:600 .8em var(--mono);background:var(--card);border:1px solid var(--line-2);border-bottom-width:2px;border-radius:6px;padding:1px 6px}

/* buttons */
.btn{appearance:none;border:0;cursor:pointer;font:inherit;font-weight:700;border-radius:11px;padding:10px 16px;background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;transition:transform .08s,filter .15s;white-space:nowrap}
.btn:hover{filter:brightness(1.06)}.btn:active{transform:translateY(1px)}
.btn:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 45%,transparent);outline-offset:2px}
.btn.block{width:100%;padding:14px 16px;font-size:1rem}
.btn.ghost{background:var(--bg-2);color:var(--text)}
.btn:disabled{opacity:.65;cursor:progress}
.btn svg{width:16px;height:16px}

/* footer */
footer{border-top:1px solid var(--line);padding:28px 0 40px;color:var(--faint);font-size:.85rem}
footer .wrap{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:space-between}

/* auth pages */
.auth-page{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}
.auth-page .nav{position:static;background:none;backdrop-filter:none;-webkit-backdrop-filter:none}
.auth-main{flex:1;display:flex;align-items:flex-start;justify-content:center;padding:20px 16px 40px}
@media (min-width:640px){.auth-main{align-items:center;padding:40px 24px 64px}}
.auth-card{width:100%;max-width:460px;background:var(--card);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);padding:24px 20px}
@media (min-width:640px){.auth-card{padding:32px 32px 28px}}
.auth-card.wide{max-width:720px}
.connect{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 18px}
.connect .av{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-weight:800;font-size:1.1rem;color:#fff;background:#52525b;box-shadow:var(--shadow)}
.connect .av.isgy{background:linear-gradient(135deg,var(--accent),var(--accent-2));font-size:.95rem}
.connect .link{display:flex;gap:4px}.connect .link i{width:5px;height:5px;border-radius:50%;background:var(--line-2)}
.auth-card h1{font-size:1.45rem;text-align:center;margin:0 0 6px;letter-spacing:-.02em}
.auth-card .intro{text-align:center;color:var(--muted);margin:0 0 20px;font-size:.95rem}
.auth-card .intro b{color:var(--text)}
.scope{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px;background:var(--bg-2);border-radius:14px;padding:12px 14px;margin:0 0 20px;font-size:.86rem;color:var(--muted)}
.scope span{display:flex;align-items:center;gap:6px}.scope svg{width:15px;height:15px;color:var(--ok);flex:none}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:13px;background:var(--bg-2);border:1px solid var(--line);margin-bottom:6px}
.auth>input{position:absolute;opacity:0;pointer-events:none}
.seg label{margin:0;text-align:center;padding:9px 6px;border-radius:10px;font-size:.88rem;font-weight:650;color:var(--muted);cursor:pointer;line-height:1.25}
.seg label small{display:block;font-weight:500;font-size:.74rem;color:var(--faint)}
#m-pw:checked~.seg [for=m-pw],#m-code:checked~.seg [for=m-code]{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.12)}
#m-pw:focus-visible~.seg [for=m-pw],#m-code:focus-visible~.seg [for=m-code]{outline:2px solid var(--accent)}
.pane{display:none;padding-top:8px}#m-pw:checked~.p-pw,#m-code:checked~.p-code{display:block}
.field{margin-top:14px}
.field label{display:block;font-weight:650;font-size:.88rem;margin-bottom:6px}
.input{width:100%;padding:12px 14px;border:1px solid var(--line-2);border-radius:12px;background:var(--bg);color:var(--text);font:inherit;font-size:16px;transition:border-color .15s,box-shadow .15s}
.input:focus{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 18%,transparent);outline:none}
textarea.input{min-height:96px;resize:vertical;font:13px/1.45 var(--mono);word-break:break-all}
.pw{position:relative}.pw .input{padding-right:84px}
.pw button{position:absolute;right:6px;top:50%;transform:translateY(-50%);border:0;background:none;color:var(--muted);font:600 .82rem system-ui;padding:8px 10px;border-radius:8px;cursor:pointer}
.pw button:hover{background:var(--bg-2);color:var(--text)}
.hint{color:var(--muted);font-size:.86rem;margin:10px 0 0}
.mini{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:8px;font-size:.88rem;color:var(--muted)}
.mini li{display:flex;gap:10px;align-items:flex-start}
.mini li b.n{flex:none;width:22px;height:22px;border-radius:50%;background:var(--accent-soft);color:var(--accent);font-size:.75rem;display:grid;place-items:center;margin-top:1px}
.alert{display:flex;gap:10px;align-items:flex-start;background:var(--errbg);color:var(--err);border-radius:12px;padding:12px 14px;margin:16px 0 0;font-size:.9rem;font-weight:550}
.alert svg{width:18px;height:18px;flex:none;margin-top:2px}
.fine{display:flex;gap:8px;align-items:flex-start;color:var(--faint);font-size:.8rem;margin:16px 0 0;line-height:1.45}
.fine svg{width:14px;height:14px;flex:none;margin-top:2px}
.auth-card .btn.block{margin-top:20px}
.keybox{display:flex;flex-direction:column;gap:10px;margin:16px 0 4px}
.keybox code{display:block;padding:12px 14px;border-radius:12px;font-size:.8rem;line-height:1.5;word-break:break-all;max-height:140px;overflow:auto}
.center{text-align:center}
.auth>input,.auth .p-login,.auth .p-reg,.auth .p-acct{}
#m-acct:checked~.seg [for=m-acct],#m-login:checked~.seg [for=m-login],#m-reg:checked~.seg [for=m-reg]{background:var(--card);color:var(--text);box-shadow:0 1px 3px rgba(0,0,0,.12)}
#m-acct:focus-visible~.seg [for=m-acct],#m-login:focus-visible~.seg [for=m-login],#m-reg:focus-visible~.seg [for=m-reg]{outline:2px solid var(--accent)}
#m-acct:checked~.p-acct,#m-login:checked~.p-login,#m-reg:checked~.p-reg{display:block}
.me-box{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line-2);border-radius:14px;background:var(--bg)}
.me-av{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;font-weight:800}
.me-av.big{width:48px;height:48px;font-size:1.2rem}
.me-txt{flex:1;min-width:0;font-size:.82rem;color:var(--muted);line-height:1.3}.me-txt b{display:block;color:var(--text);font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.or{display:flex;align-items:center;gap:10px;color:var(--faint);font-size:.8rem;margin:16px 0 4px}.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}
.muted-i{color:var(--muted);font-weight:400;font-size:.85em}
.acct-head{display:flex;align-items:center;gap:14px;margin-bottom:8px;flex-wrap:wrap}
.block{border-top:1px solid var(--line);padding:20px 0 4px;margin-top:16px}
.bh{display:flex;align-items:center;gap:8px;font-size:1.05rem;margin:0 0 10px;letter-spacing:-.01em}.bh svg{width:18px;height:18px;color:var(--accent)}
.bh .count{margin-left:auto;font-size:.8rem;font-weight:600;color:var(--faint)}
.st{display:inline-flex;align-items:flex-start;gap:8px;font-size:.93rem}.st svg{width:18px;height:18px;flex:none;margin-top:2px}
.st.ok svg{color:var(--ok)}.st.warn svg{color:var(--accent)}
details summary{cursor:pointer;font-weight:650;color:var(--accent);margin:8px 0;list-style:none}details summary::-webkit-details-marker{display:none}
details summary::before{content:"▸";display:inline-block;margin-right:6px;transition:transform .15s}details[open] summary::before{transform:rotate(90deg)}
.linkbtn{background:none;border:0;padding:0;margin-top:10px;color:var(--muted);font:inherit;font-size:.86rem;text-decoration:underline;cursor:pointer}
.nlist{list-style:none;padding:0;margin:0;display:grid;gap:6px}
.nlist li{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-radius:10px;background:var(--bg);font-size:.92rem}
.nlist .box{flex:none;width:16px;height:16px;border:2px solid var(--line-2);border-radius:5px;margin-top:3px}
.nlist em{font-style:normal;font-size:.78rem;font-weight:700;color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:1px 6px;margin-left:4px}
.danger{margin-top:24px;border-top:1px solid var(--line);padding-top:12px}.danger summary{color:var(--muted)}
.chk{display:flex;gap:8px;align-items:center;font-size:.9rem;margin:10px 0}
.danger-btn{background:var(--err);color:#fff}
.alert.ok{background:var(--okbg);color:var(--ok)}
.auth-card .copybox{max-width:none}
@media (max-width:480px){.auth-card .copybox{flex-wrap:wrap;padding:12px}.auth-card .copybox code{white-space:normal;overflow-wrap:anywhere;flex-basis:100%;font-size:.8rem}.auth-card .copybox .btn{width:100%}}
.skip{position:absolute;left:-9999px;top:8px;background:var(--card);color:var(--text);padding:8px 14px;border-radius:8px;z-index:50;font-weight:700}.skip:focus{left:8px}
.mark-img{width:32px;height:32px;border-radius:9px;box-shadow:0 4px 12px -4px rgba(232,115,12,.55);display:block}
.bi{flex:none;display:inline-block;vertical-align:middle}.bi-openai{color:var(--text)}
.eyebrow .dots i{background:var(--card);border:2px solid var(--card);box-shadow:0 0 0 1px var(--line)}
.eyebrow .dots i .bi{width:14px;height:14px}
.tab-bar .ico{background:none!important;width:22px;height:22px}.tab-bar .ico .bi{width:20px;height:20px}
.tab-bar .ico.other{background:var(--faint)!important;border-radius:6px;font-size:11px}
.works{display:flex;flex-wrap:wrap;gap:12px 14px;margin-top:6px}
.works .w{display:flex;align-items:center;gap:12px;padding:14px 20px;border:1px solid var(--line);border-radius:14px;background:var(--card);box-shadow:var(--shadow);font-weight:700;font-size:1.05rem}
.works .w .bi{width:28px;height:28px}
.works .w small{display:block;font-weight:500;font-size:.8rem;color:var(--muted)}
.tm{color:var(--faint);font-size:.78rem;margin-top:14px;line-height:1.5}
.split{display:grid;gap:28px;align-items:center}
@media (min-width:860px){.split{grid-template-columns:1fr 1fr;gap:48px}}
.split img{width:100%;max-width:320px;height:auto;filter:drop-shadow(0 22px 30px rgba(232,115,12,.35));justify-self:center}
.checks{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:8px}
.checks li{display:flex;gap:10px;align-items:flex-start;font-size:.97rem}.checks svg{width:18px;height:18px;color:var(--ok);flex:none;margin-top:3px}
.faq{display:grid;gap:12px;margin:0;padding:0}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 18px;box-shadow:var(--shadow)}
.faq summary{padding:14px 0;margin:0;color:var(--text);font-size:1.02rem;font-weight:650;cursor:pointer}
.faq summary::before{content:"+";margin-right:10px;color:var(--accent);font-weight:800}
.faq details[open] summary::before{content:"–";transform:none}
.faq p{margin:0 0 16px;color:var(--muted);font-size:.96rem}
.faq p a{color:var(--accent)}
.connect .av.brand{background:var(--card);border:1px solid var(--line)}.connect .av.brand .bi{width:28px;height:28px}
.connect img.av{padding:0;background:none;object-fit:cover}
.foot-mini{text-align:center;color:var(--faint);font-size:.8rem;padding:0 16px 28px}
.foot-mini a{color:var(--faint)}
`;

const JS = `
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var t=document.getElementById(b.dataset.copy).textContent.trim();var done=function(){var o=b.innerHTML;b.textContent='Kopiert ✓';setTimeout(function(){b.innerHTML=o},1600)};if(navigator.clipboard)navigator.clipboard.writeText(t).then(done,function(){});else{var r=document.createRange();r.selectNodeContents(document.getElementById(b.dataset.copy));getSelection().removeAllRanges();getSelection().addRange(r)}})});
document.querySelectorAll('form[data-busy]').forEach(function(f){f.addEventListener('submit',function(){var b=f.querySelector('button[type=submit]');if(b){b.disabled=true;b.dataset.l=b.textContent;b.textContent='Bitte warten …'}})});
document.querySelectorAll('[data-reveal]').forEach(function(b){b.addEventListener('click',function(){var i=document.getElementById(b.dataset.reveal);var s=i.type==='password';i.type=s?'text':'password';b.textContent=s?'Verbergen':'Anzeigen'})});
var nav=document.querySelector('.nav');if(nav){var f=function(){nav.classList.toggle('scrolled',scrollY>8)};addEventListener('scroll',f,{passive:true});f()}
window.addEventListener('pageshow',function(){document.querySelectorAll('button[data-l]').forEach(function(b){b.disabled=false;b.textContent=b.dataset.l})});
`;

const I = {
  check: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.86a.75.75 0 0 0-1.22-.88l-3.3 4.6-1.84-1.84a.75.75 0 1 0-1.06 1.06l2.47 2.47a.75.75 0 0 0 1.14-.09l3.81-5.32Z" clip-rule="evenodd"/></svg>',
  lock: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/></svg>',
  db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="m4 4 16 16"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  alert: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></svg>',
};
function head(title, { description = DESCRIPTION, path = '', index = false, jsonld = [] } = {}) {
  const url = SITE + (path || '/');
  const robots = index ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,nofollow';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"><meta name="robots" content="${robots}">
${index ? `<link rel="canonical" href="${url}"><link rel="alternate" hreflang="de" href="${url}"><link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${NAME}"><meta property="og:locale" content="de_DE">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/og.png"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SITE}/assets/og.png"><meta name="twitter:image:alt" content="${esc(OG_ALT)}">
<meta name="author" content="${AUTHOR.name}"><meta name="application-name" content="${NAME}"><meta name="apple-mobile-web-app-title" content="ISGY Plus">
` : ''}<meta name="theme-color" content="#f7f6f3" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#111113" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark"><meta name="format-detection" content="telephone=no">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
<style>${CSS}</style></head>`;
}
const tail = `<script>${JS}</script></body></html>`;
const logo = (href = '/') => `<a class="logo" href="${href}"><img class="mark-img" src="/assets/logo-96.png" width="32" height="32" alt="">ISGY Intern <small>Plus</small></a>`;
const DISCLAIMER = 'Inoffiziell – kein Angebot des Gymnasiums Ismaning. Nur Lesezugriff auf deine eigenen Portal-Daten.';
const TRADEMARKS = 'Claude ist eine Marke von Anthropic, ChatGPT und OpenAI sind Marken von OpenAI, Gemini ist eine Marke von Google. Die Logos dienen nur der Kennzeichnung der unterstützten Dienste; es besteht keine Verbindung zu den Unternehmen.';

// Simple centered page for login, keys, account and errors.
export function layout(title, body, { wide = false } = {}) {
  return `${head(title)}<body class="auth-page">${logoSprite()}
<header class="nav"><div class="wrap">${logo()}<nav class="nav-links"><a href="/#einrichten" class="hide-sm">Einrichten</a><a href="/konto">Konto</a></nav></div></header>
<main class="auth-main"><div class="auth-card${wide ? ' wide' : ''}">${body}</div></main>
<p class="foot-mini">${DISCLAIMER}</p>${tail}`;
}

// ---------- login form (OAuth authorize, personal key, saving the portal login in the account) ----------
const MODES = {
  acct: ['Konto', 'empfohlen'],
  pw: ['Passwort', 'isgy-intern'],
  code: ['Office 365', 'Code'],
};
export function loginForm({ action, hidden = {}, error = '', mode, username = '', email = '', button = 'Verbinden', modes = ['pw', 'code'], fine = true }) {
  const fields = Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  const active = modes.includes(mode) ? mode : modes[0];
  const panes = {
    acct: `<div class="pane p-acct">
<div class="field"><label for="e">E-Mail</label><input class="input" type="email" id="e" name="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${esc(email)}"></div>
<div class="field"><label for="ap">Passwort deines ISGY-KI-Kontos</label><div class="pw"><input class="input" type="password" id="ap" name="account_password" autocomplete="current-password"><button type="button" data-reveal="ap">Anzeigen</button></div></div>
<p class="hint">Noch kein Konto? <a href="/konto?neu=1">Jetzt kostenlos erstellen</a> – dann musst du dein isgy-intern-Passwort nur einmal hinterlegen und deine Notizen aus der Erweiterung sind auch dabei.</p>
</div>`,
    pw: `<div class="pane p-pw">
<div class="field"><label for="u">Benutzername</label><input class="input" type="text" id="u" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" value="${esc(username)}" placeholder="wie auf isgy-intern.de"></div>
<div class="field"><label for="p">Passwort</label><div class="pw"><input class="input" type="password" id="p" name="password" autocomplete="current-password"><button type="button" data-reveal="p">Anzeigen</button></div></div>
</div>`,
    code: `<div class="pane p-code">
<p class="hint">Mit „Login mit Office 365“ gibt es kein Portal-Passwort. Hol dir stattdessen einen Verbindungscode:</p>
<ol class="mini">
<li><b class="n">1</b><span>Browser-Erweiterung <a href="${REPO}#installation" target="_blank" rel="noopener"><b>ISGY Intern Plus</b></a> (ab 1.2) installieren</span></li>
<li><b class="n">2</b><span>Auf <a href="https://www.isgy-intern.de" target="_blank" rel="noopener">isgy-intern.de</a> anmelden, „Angemeldet bleiben“ anhaken</span></li>
<li><b class="n">3</b><span><kbd>Strg</kbd> + <kbd>K</kbd> → <b>„🤖 KI-Verbindungscode kopieren“</b> und hier einfügen</span></li>
</ol>
<div class="field"><label for="c">Verbindungscode</label><textarea class="input" id="c" name="code" placeholder="isgy1.…" spellcheck="false" autocapitalize="none"></textarea></div>
</div>`,
  };
  const seg = modes.length > 1
    ? `${modes.map((m) => `<input type="radio" name="mode" id="m-${m}" value="${m}"${m === active ? ' checked' : ''}>`).join('')}
<div class="seg" style="grid-template-columns:repeat(${modes.length},1fr)" role="radiogroup" aria-label="Anmeldeart">${modes.map((m) => `<label for="m-${m}">${MODES[m][0]}<small>${MODES[m][1]}</small></label>`).join('')}</div>`
    : `<input type="radio" name="mode" id="m-${active}" value="${active}" checked>`;
  return `<form method="post" action="${esc(action)}" data-busy novalidate>${fields}
<div class="auth">${seg}${modes.map((m) => panes[m]).join('')}</div>
${error ? `<div class="alert" role="alert">${I.alert}<span>${esc(error)}</span></div>` : ''}
<button class="btn block" type="submit">${I.lock}${esc(button)}</button>
</form>${fine ? `
<p class="fine">${I.shield}<span>Zugangsdaten werden nur verschlüsselt gespeichert (AES-256). Der Server kann damit ausschließlich lesen.</span></p>` : ''}`;
}

// One-click "continue as …" when already signed in on this site.
const continueAs = (action, hidden, me, button) => `<form method="post" action="${esc(action)}" class="me-box" data-busy>${Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
<input type="hidden" name="mode" value="web"><span class="me-av">${esc(me.charAt(0).toUpperCase())}</span><span class="me-txt">Angemeldet als<b>${esc(me)}</b></span><button class="btn" type="submit">${esc(button)}</button></form>
<p class="or"><span>oder anders anmelden</span></p>`;

const SCOPE = `<div class="scope"><span>${I.check}Stundenplan</span><span>${I.check}Vertretungen</span><span>${I.check}Hausaufgaben</span><span>${I.check}Prüfungen &amp; Notizen</span></div>`;
const loginModes = (accounts) => (accounts ? ['acct', 'pw', 'code'] : ['pw', 'code']);

export function authorizePage({ client, redirectHost, req, error, mode, username, email, accounts, me }) {
  const initial = esc(String(client || '?').trim().charAt(0).toUpperCase() || '?');
  const brand = brandOf(client, redirectHost);
  const clientAv = brand ? `<span class="av brand">${brandIcon(brand, 28)}</span>` : `<span class="av">${initial}</span>`;
  return layout('Mit ISGY Intern verbinden', `
<div class="connect" aria-hidden="true">${clientAv}<span class="link"><i></i><i></i><i></i></span><img class="av" src="/assets/logo-96.png" width="48" height="48" alt=""></div>
<h1>Mit ISGY Intern verbinden</h1>
<p class="intro"><b>${esc(client)}</b> möchte Zugriff auf deine Daten von isgy-intern.de.<br><span style="font-size:.85rem">Danach geht es zurück zu ${esc(redirectHost)}.</span></p>
${SCOPE}${me ? continueAs('/authorize', { req }, me, 'Verbinden') : ''}${loginForm({ action: '/authorize', hidden: { req }, error, mode, username, email, modes: loginModes(accounts) })}`);
}

export function errorPage(title, message) {
  return layout(title, `<div class="connect" aria-hidden="true"><span class="av" style="background:var(--err)">!</span></div>
<h1>${esc(title)}</h1><p class="intro">${esc(message)}</p><a class="btn ghost block" href="/">Zur Startseite</a>`);
}

export function keyPage({ origin, error, mode, username, email, accounts, me }) {
  return layout('Persönlicher Zugriffsschlüssel', `
<div class="connect" aria-hidden="true"><img class="av" src="/assets/logo-96.png" width="48" height="48" alt=""></div>
<h1>Persönlicher Zugriffsschlüssel</h1>
<p class="intro">Nur für Programme <b>ohne</b> OAuth-Anmeldung. Claude, ChatGPT und Gemini CLI brauchen das nicht – dort einfach <code>${esc(origin)}/mcp</code> eintragen.</p>
${me ? continueAs('/schluessel', {}, me, 'Schlüssel erstellen') : ''}${loginForm({ action: '/schluessel', error, mode, username, email, button: 'Schlüssel erstellen', modes: loginModes(accounts) })}`);
}

export function keyResultPage({ origin, key, days }) {
  return layout('Dein Zugriffsschlüssel', `
<div class="connect" aria-hidden="true"><span class="av" style="background:var(--ok)">✓</span></div>
<h1>Dein Zugriffsschlüssel</h1>
<p class="intro">Gültig für ${days} Tage. Behandle ihn wie ein Passwort – wer ihn hat, kann deine Portal-Daten lesen.</p>
<div class="keybox"><code id="k">${esc(key)}</code><button class="btn" type="button" data-copy="k">${I.copy}Schlüssel kopieren</button></div>
<p class="hint">Im Client als HTTP-Header eintragen: <code>Authorization: Bearer &lt;Schlüssel&gt;</code>, Server-URL <code>${esc(origin)}/mcp</code>.</p>
<pre><span class="k">"isgy-intern"</span>: {
  <span class="k">"httpUrl"</span>: <span class="s">"${esc(origin)}/mcp"</span>,
  <span class="k">"headers"</span>: { <span class="k">"Authorization"</span>: <span class="s">"Bearer ${esc(key.slice(0, 12))}…"</span> }
}</pre>`, { wide: true });
}

// ---------- account ----------
export function accountAuthPage({ error, email = '', register = false, next = '' }) {
  const hidden = next ? `<input type="hidden" name="next" value="${esc(next)}">` : '';
  const err = error ? `<div class="alert" role="alert">${I.alert}<span>${esc(error)}</span></div>` : '';
  return layout(register ? 'Konto erstellen' : 'Anmelden', `
<div class="connect" aria-hidden="true"><img class="av" src="/assets/logo-96.png" width="48" height="48" alt=""></div>
<h1>${register ? 'Konto erstellen' : 'Bei deinem Konto anmelden'}</h1>
<p class="intro">${register ? 'Einmal dein isgy-intern-Login hinterlegen – danach verbinden sich KI-Assistenten und die Erweiterung nur noch mit diesem Konto.' : 'Dein ISGY-KI-Konto: gespeichertes isgy-intern-Login, Notizen aus der Erweiterung, Verbindungen.'}</p>
<div class="auth">
<input type="radio" name="tab" id="m-login"${register ? '' : ' checked'}><input type="radio" name="tab" id="m-reg"${register ? ' checked' : ''}>
<div class="seg" role="tablist"><label for="m-login">Anmelden</label><label for="m-reg">Registrieren</label></div>
<div class="pane p-login"><form method="post" action="/konto/anmelden" data-busy novalidate>${hidden}
<div class="field"><label for="le">E-Mail</label><input class="input" type="email" id="le" name="email" autocomplete="email" autocapitalize="none" value="${esc(email)}"></div>
<div class="field"><label for="lp">Passwort</label><div class="pw"><input class="input" type="password" id="lp" name="password" autocomplete="current-password"><button type="button" data-reveal="lp">Anzeigen</button></div></div>
${register ? '' : err}<button class="btn block" type="submit">${I.lock}Anmelden</button></form></div>
<div class="pane p-reg"><form method="post" action="/konto/registrieren" data-busy novalidate>${hidden}
<div class="field"><label for="re">E-Mail</label><input class="input" type="email" id="re" name="email" autocomplete="email" autocapitalize="none" value="${esc(email)}"></div>
<div class="field"><label for="rp">Passwort <span class="muted-i">(mind. 8 Zeichen, nicht dein isgy-intern-Passwort)</span></label><div class="pw"><input class="input" type="password" id="rp" name="password" autocomplete="new-password" minlength="8"><button type="button" data-reveal="rp">Anzeigen</button></div></div>
<div class="field"><label for="rp2">Passwort wiederholen</label><input class="input" type="password" id="rp2" name="password2" autocomplete="new-password"></div>
${register ? err : ''}<button class="btn block" type="submit">${I.key}Konto erstellen</button>
<p class="hint">Es gibt keine Passwort-Zurücksetzung per E-Mail. Wenn du dein Passwort vergisst, erstelle einfach ein neues Konto.</p></form></div>
</div>
<p class="fine">${I.shield}<span>Gespeichert wird nur: E-Mail, Passwort-Hash, dein isgy-intern-Login (verschlüsselt) und deine Notizen. Konto jederzeit löschbar.</span></p>`);
}

const ago = (d) => {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 90) return 'gerade eben';
  if (s < 5400) return `vor ${Math.round(s / 60)} Minuten`;
  if (s < 129600) return `vor ${Math.round(s / 3600)} Stunden`;
  return `vor ${Math.round(s / 86400)} Tagen`;
};
const status = (ok, text) => `<span class="st ${ok ? 'ok' : 'warn'}">${ok ? I.check : I.alert}${text}</span>`;

export function accountPage({ origin, acc, cred, notes = [], error, message, mode }) {
  const credText = !cred
    ? status(false, 'Noch kein isgy-intern-Login hinterlegt')
    : cred.m === 'pw'
      ? status(true, `Passwort für <b>${esc(cred.u)}</b> gespeichert`)
      : status(true, `Browser-Sitzung aus der Erweiterung · aktualisiert ${ago(acc.cred_updated)}`);
  const open = notes.filter((n) => n.type === 'todo' && !n.done);
  const memos = notes.filter((n) => n.type === 'note');
  const fmt = (ds) => (ds ? `${ds.slice(8, 10)}.${ds.slice(5, 7)}.` : '');
  return layout('Dein Konto', `
<div class="acct-head"><span class="me-av big">${esc(acc.email.charAt(0).toUpperCase())}</span><div><h1 style="text-align:left;margin:0">Dein Konto</h1><p class="muted-i" style="margin:0">${esc(acc.email)}</p></div>
<form method="post" action="/konto/abmelden" style="margin-left:auto"><button class="btn ghost" type="submit">Abmelden</button></form></div>
${message ? `<div class="alert ok" role="status">${I.check}<span>${esc(message)}</span></div>` : ''}
${error ? `<div class="alert" role="alert">${I.alert}<span>${esc(error)}</span></div>` : ''}

<div class="block">
<h2 class="bh">${I.key}isgy-intern-Zugang</h2>
<p>${credText}</p>
${cred?.m === 's' ? '<p class="hint">Die Erweiterung erneuert die Sitzung automatisch, sobald du isgy-intern.de im Browser öffnest.</p>' : ''}
<details${cred ? '' : ' open'}><summary>${cred ? 'Zugang ändern' : 'Zugang hinterlegen'}</summary>
${loginForm({ action: '/konto/zugang', mode, button: 'Zugang speichern', fine: false })}
<p class="hint">Schüler mit Office-365-Login: am einfachsten die Erweiterung mit diesem Konto verbinden (siehe unten) – sie hinterlegt die Sitzung dann von selbst.</p>
</details>
${cred ? `<form method="post" action="/konto/zugang-entfernen"><button class="linkbtn" type="submit">Gespeicherten Zugang entfernen</button></form>` : ''}
</div>

<div class="block">
<h2 class="bh">${I.swap}Browser-Erweiterung</h2>
<p>${acc.ext_seen ? status(true, `Verbunden · zuletzt synchronisiert ${ago(acc.ext_seen)}`) : status(false, 'Noch nicht verbunden')}</p>
<ol class="mini"><li><b class="n">1</b><span><a href="${REPO}#installation" target="_blank" rel="noopener"><b>ISGY Intern Plus</b></a> ab Version 1.3 installieren</span></li>
<li><b class="n">2</b><span>Einstellungen der Erweiterung → <b>KI-Konto</b> → mit dieser E-Mail und deinem Konto-Passwort anmelden</span></li>
<li><b class="n">3</b><span>Fertig: Notizen und Aufgaben werden synchronisiert und die isgy-intern-Sitzung bleibt aktuell</span></li></ol>
</div>

<div class="block">
<h2 class="bh">${I.pen}Aufgaben &amp; Notizen <span class="count">${open.length} offen · ${memos.length} Notizen</span></h2>
${notes.length ? `<ul class="nlist">${open.slice(0, 12).map((n) => `<li><span class="box"></span><span>${esc(n.text)}${n.date ? ` <em>${fmt(n.date)}</em>` : ''}</span></li>`).join('')}${memos.slice(0, 6).map((n) => `<li class="memo"><span>📝</span><span>${esc(n.text.length > 160 ? n.text.slice(0, 160) + '…' : n.text)}</span></li>`).join('')}</ul>`
    : '<p class="hint">Noch keine. Sie kommen aus dem „Mein Tag“-Dashboard der Erweiterung – oder du sagst deinem KI-Assistenten „Schreib mir auf: …“.</p>'}
</div>

<div class="block">
<h2 class="bh">${I.bolt}KI-Assistenten verbinden</h2>
<div class="copybox"><code id="url">${esc(origin)}/mcp</code><button class="btn" type="button" data-copy="url">${I.copy}Kopieren</button></div>
<p class="hint">URL in Claude, ChatGPT oder Gemini CLI eintragen und bei der Anmeldung <b>„Konto“</b> wählen. <a href="/#einrichten">Anleitung</a></p>
</div>

<details class="danger"><summary>Sicherheit &amp; Konto löschen</summary>
<form method="post" action="/konto/ueberall-abmelden"><p class="hint">Meldet alle KI-Assistenten und die Erweiterung ab (z. B. wenn ein Gerät verloren ging).</p><button class="btn ghost" type="submit">Überall abmelden</button></form>
<form method="post" action="/konto/loeschen" style="margin-top:16px"><p class="hint">Löscht das Konto, den gespeicherten Zugang und alle Notizen endgültig.</p>
<label class="chk"><input type="checkbox" name="confirm" value="1" required> Ja, alles endgültig löschen</label>
<button class="btn danger-btn" type="submit">Konto löschen</button></form>
</details>`, { wide: true });
}

// ---------- start page ----------
const ASK = [
  ['Was habe ich morgen – und fällt was aus?', 'Stunden mit Uhrzeit, Raum und Lehrkraft, Vertretungen und Entfälle direkt eingearbeitet.', 'tagesplan'],
  ['Was muss ich bis Montag machen?', 'Hausaufgaben je Fach aus dem Klassentagebuch, mit der Stunde, zu der sie fällig sind.', 'hausaufgaben'],
  ['Mach mir einen Lernplan für die Mathe-Schulaufgabe.', 'Prüfungstermine aus dem Klassenkalender plus die Unterrichtsthemen der letzten Wochen.', 'pruefungen'],
  ['Was haben wir am Dienstag in Deutsch gemacht?', 'Themen, Hausaufgaben und Notizen aus dem Tagebuch – perfekt, wenn du gefehlt hast.', 'tagebuch'],
  ['Wer ist eigentlich „Mm“?', 'Lehrerkürzel werden überall automatisch in Namen übersetzt.', 'lehrer'],
  ['Was steht diese Woche an?', 'Alles auf einen Blick: laufende Stunde, nächster Schultag, Hausaufgaben, Prüfungen.', 'uebersicht'],
  ['Schreib mir auf: Bio-Referat bis Freitag.', 'Mit Konto: Aufgaben und Notizen landen direkt im „Mein Tag“-Dashboard der Erweiterung.', 'notiz_anlegen'],
  ['Was steht noch auf meiner To-do-Liste?', 'Liest deine Aufgaben und Notizen aus der Erweiterung – inklusive Fälligkeit.', 'notizen'],
  ['Hab ich alles für morgen erledigt?', 'Vergleicht fällige Hausaufgaben mit deinen erledigten Aufgaben.', 'tagesplan'],
];

function setupTabs(url) {
  const tab = (id, label, icon, checked) => [`<input type="radio" name="client" id="t-${id}"${checked ? ' checked' : ''}>`, `<label for="t-${id}"><span class="ico ${id === 'andere' ? 'other' : ''}">${icon}</span>${label}</label>`];
  const tabs = [tab('claude', 'Claude', brandIcon('claude', 20), true), tab('chatgpt', 'ChatGPT', brandIcon('openai', 20)), tab('gemini', 'Gemini', brandIcon('gemini', 20)), tab('andere', 'Andere', '⋯')];
  const u = esc(url);
  return `<div class="tabs">${tabs.map((t) => t[0]).join('')}
<div class="tab-bar" role="tablist" aria-label="KI-Assistent">${tabs.map((t) => t[1]).join('')}</div>
<div class="panel p-claude"><ol class="steps">
<li><b>Einstellungen → Connectors</b> öffnen (claude.ai, Desktop-App oder Handy-App).</li>
<li><b>„Benutzerdefinierten Connector hinzufügen“</b>: Name <code>ISGY Intern</code>, URL <code>${u}</code>.</li>
<li>Auf <b>Verbinden</b> tippen und im Fenster anmelden. Fertig – einfach losfragen.</li>
</ol><div class="note"><b>Claude Code:</b> <code>claude mcp add --transport http isgy-intern ${u}</code>, dann <code>/mcp</code> → Anmelden.</div></div>
<div class="panel p-chatgpt"><ol class="steps">
<li><b>Einstellungen → Apps &amp; Connectors → Erweitert</b> → <b>Entwicklermodus</b> einschalten (Plus, Pro, Business).</li>
<li><b>Erstellen</b>: Name <code>ISGY Intern</code>, MCP-Server-URL <code>${u}</code>, Authentifizierung <b>OAuth</b>.</li>
<li>„Ich vertraue dieser Anwendung“ bestätigen, anmelden und im Chat über <b>+ → Mehr</b> einschalten.</li>
</ol></div>
<div class="panel p-gemini"><ol class="steps">
<li><b>Gemini CLI</b> installieren und <code>~/.gemini/settings.json</code> öffnen.</li>
<li>Den Server eintragen:<pre>{
  <span class="k">"mcpServers"</span>: {
    <span class="k">"isgy-intern"</span>: {
      <span class="k">"httpUrl"</span>:
        <span class="s">"${u}"</span>
    }
  }
}</pre></li>
<li>Gemini CLI starten – die Anmeldung öffnet sich automatisch (sonst <code>/mcp auth isgy-intern</code>).</li>
</ol><div class="note">Falls deine Gemini-App eigene MCP-Server bzw. Connectors erlaubt, trägst du dort dieselbe URL ein.</div></div>
<div class="panel p-andere"><ol class="steps">
<li>Cursor, VS Code, LM Studio & Co.: neuen MCP-Server vom Typ <b>Streamable HTTP</b> mit der URL <code>${u}</code> anlegen.</li>
<li>Kann der Client OAuth, öffnet sich die Anmeldung von selbst.</li>
<li>Sonst einen <a href="/schluessel">persönlichen Zugriffsschlüssel</a> erstellen und als Header <code>Authorization: Bearer …</code> eintragen.</li>
</ol></div>
</div>`;
}

const FAQ = [
  ['Was ist ISGY Intern Plus?', `ISGY Intern Plus besteht aus zwei Teilen: einer kostenlosen Browser-Erweiterung, die das Schulportal isgy-intern.de des Gymnasiums Ismaning aufräumt („Mein Tag“-Dashboard, Lehrernamen statt Kürzel, letzte Tagebucheinträge), und einem MCP-Server, über den Claude, ChatGPT und Gemini deinen Stundenplan, Vertretungen, Hausaufgaben und Prüfungen lesen können.`],
  ['Wie verbinde ich isgy-intern.de mit Claude, ChatGPT oder Gemini?', 'Trage die Server-URL (oben auf dieser Seite) als eigenen Connector bzw. MCP-Server ein und melde dich einmal an. In Claude geht das unter Einstellungen → Connectors, in ChatGPT im Entwicklermodus unter Apps & Connectors, in Gemini über die Gemini CLI. Die Schritt-für-Schritt-Anleitung steht im Abschnitt „Einrichten“.'],
  ['Kostet das etwas?', 'Nein, ISGY Intern Plus ist kostenlos. Für eigene Connectors brauchen die KI-Dienste teils ein Bezahl-Abo (z. B. ChatGPT Plus für den Entwicklermodus); das ist unabhängig von dieser Seite.'],
  ['Ist das ein offizielles Angebot der Schule?', 'Nein. ISGY Intern Plus ist ein inoffizielles Projekt und steht in keiner Verbindung zum Gymnasium Ismaning oder zum Betreiber des Portals. Es nutzt ausschließlich deinen eigenen Zugang und liest nur deine eigenen Daten.'],
  ['Funktioniert es mit dem Office-365-Login?', 'Ja. Wer sich im Portal über Office 365 anmeldet, hat kein Portal-Passwort. Mit der Browser-Erweiterung und einem KI-Konto übergibt die Erweiterung deine Sitzung automatisch; ohne Konto kopierst du mit Strg+K einen Verbindungscode.'],
  ['Wie sicher sind meine Daten?', 'Von isgy-intern.de wird nur gelesen. Ohne Konto wird nichts gespeichert; mit Konto liegt dein isgy-intern-Zugang AES-256-verschlüsselt in der Datenbank (Supabase, Frankfurt). Du kannst jederzeit überall abmelden oder das Konto samt Notizen löschen.'],
  ['Kann die KI im Portal etwas ändern?', 'Nein. Der KI-Assistent kann nur lesen. Schreiben kann er ausschließlich deine eigenen Aufgaben und Notizen im „Mein Tag“-Dashboard – zum Beispiel „Schreib mir auf: Bio-Referat bis Freitag“.'],
];

const FEATURES = ['„Mein Tag“: Stundenplan von heute und dem nächsten Schultag mit Vertretungen und Entfällen', 'Lehrernamen statt Kürzel – überall im Portal', 'Letzter Tagebucheintrag mit Hausaufgabe per Klick auf die Stunde', 'Termine & Prüfungen aus dem Klassenkalender', 'Aufgaben & Notizen, optional mit KI-Konto synchronisiert', 'Befehlspalette (Strg+K) und Tastenkürzel, angepinnte Seiten'];

function schema() {
  const author = { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url };
  const free = { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' };
  return [
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: NAME, description: DESCRIPTION, inLanguage: 'de-DE', publisher: author },
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${SITE}/#extension`, name: NAME, alternateName: 'ISGY Intern Plus Browser-Erweiterung', description: 'Browser-Erweiterung für das Schulportal isgy-intern.de: „Mein Tag“-Dashboard, Lehrernamen statt Kürzel, letzte Tagebucheinträge, Aufgaben & Notizen.',
      applicationCategory: 'EducationalApplication', operatingSystem: 'Chrome, Microsoft Edge, Brave, Firefox', softwareVersion: '1.3.1', inLanguage: 'de', image: `${SITE}/assets/logo-512.png`, downloadUrl: REPO, installUrl: `${REPO}#installation`, url: `${SITE}/#erweiterung`, isAccessibleForFree: true, offers: free, author },
    { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${SITE}/#mcp`, name: 'ISGY Intern MCP-Server', description: 'MCP-Server, mit dem Claude, ChatGPT und Gemini Stundenplan, Vertretungsplan, Hausaufgaben, Prüfungen und Notizen von isgy-intern.de lesen.',
      applicationCategory: 'EducationalApplication', applicationSubCategory: 'Model Context Protocol (MCP) Server', operatingSystem: 'Web', inLanguage: 'de', image: `${SITE}/assets/logo-512.png`, url: SITE + '/', isAccessibleForFree: true, offers: free, author, sameAs: [REPO] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
}

export function homePage(origin) {
  const url = `${origin}/mcp`;
  return `${head(TITLE, { index: true, path: '/', jsonld: schema() })}<body>${logoSprite()}
<a class="skip" href="#inhalt">Zum Inhalt springen</a>
<header class="nav"><div class="wrap">${logo()}<nav class="nav-links" aria-label="Hauptnavigation"><a href="#fragen" class="hide-sm">Funktionen</a><a href="#einrichten">Einrichten</a><a href="#erweiterung" class="hide-sm">Erweiterung</a><a href="#faq" class="hide-sm">FAQ</a><a href="/konto">Konto</a></nav></div></header>
<main id="inhalt">
<div class="hero"><div class="wrap hero-grid">
<div>
<span class="eyebrow"><span class="dots" aria-hidden="true"><i>${brandIcon('claude', 14)}</i><i>${brandIcon('openai', 14)}</i><i>${brandIcon('gemini', 14)}</i></span>Für Claude, ChatGPT &amp; Gemini</span>
<h1>Dein Schulportal,<br><span class="hl">direkt im KI-Chat.</span></h1>
<p class="lead"><strong>ISGY Intern Plus</strong> verbindet isgy-intern.de (Gymnasium Ismaning) mit deinem KI-Assistenten: Frag einfach „Was habe ich morgen?“ – und bekomme Stundenplan, Vertretungen, Hausaufgaben und Prüfungstermine in Sekunden.</p>
<div class="copybox"><span class="lbl">Server-URL</span><code id="url">${esc(url)}</code><button class="btn" type="button" data-copy="url">${I.copy}Kopieren</button></div>
<p class="hero-cta"><a href="/konto?neu=1">Konto erstellen</a> · <a href="#einrichten">Ohne Konto einrichten</a></p>
<div class="badges"><span>${I.check}Portal nur lesen</span><span>${I.check}Notizen-Sync</span><span>${I.check}Verschlüsselt</span><span>${I.check}Kostenlos</span></div>
</div>
<div class="chat" role="img" aria-label="Beispiel: Auf die Frage „Was habe ich morgen, und fällt was aus?“ antwortet der KI-Assistent mit Stundenplan, Vertretung und Hausaufgaben.">
<div class="chat-top"><img class="mark-img" style="width:24px;height:24px;border-radius:7px" src="/assets/logo-96.png" width="24" height="24" alt=""><b>ISGY Intern</b> verbunden<span class="pill">● aktiv</span></div>
<div class="msg me">Was habe ich morgen, und fällt was aus?</div>
<div class="tool">${I.bolt}tagesplan(datum: "morgen")</div>
<div class="msg ai">Morgen hast du <b>07:55–13:00</b>.
<ul><li>3. Std Deutsch: <span class="tag org">Vertretung</span> bei Fr. Weber, Raum 204</li><li>5. Std Englisch: <span class="tag red">entfällt</span></li></ul>
Fällig ist noch <b>Mathe S. 42 Nr. 3</b>, und am Freitag ist die <b>Mathe-Schulaufgabe</b> – soll ich dir einen Lernplan machen?</div>
</div>
</div></div>

<section id="funktioniert-mit" aria-labelledby="h-works" style="padding-top:8px"><div class="wrap">
<div class="sec-head"><span class="kicker">Kompatibel</span><h2 id="h-works">Funktioniert mit deinem KI-Assistenten</h2></div>
<div class="works">
<div class="w">${brandIcon('claude', 28)}<span>Claude<small>claude.ai, Desktop &amp; App, Claude Code</small></span></div>
<div class="w">${brandIcon('openai', 28)}<span>ChatGPT<small>Plus, Pro &amp; Business (Entwicklermodus)</small></span></div>
<div class="w">${brandIcon('gemini', 28)}<span>Gemini<small>Gemini CLI &amp; MCP-Clients</small></span></div>
</div>
<p class="tm">${esc(TRADEMARKS)}</p>
</div></section>

<section id="fragen" aria-labelledby="h-ask"><div class="wrap">
<div class="sec-head"><span class="kicker">Was du fragen kannst</span><h2 id="h-ask">Einfach fragen wie im Chat.</h2><p class="sub">Der Assistent sucht sich selbst das passende Werkzeug – du brauchst keine Befehle.</p></div>
<div class="grid g3">${ASK.map(([q, p, t]) => `<div class="card ask"><q>${esc(q)}</q><p>${esc(p)}</p><code>${t}</code></div>`).join('')}</div>
</div></section>

<section id="einrichten" aria-labelledby="h-setup" style="background:var(--bg-2)"><div class="wrap">
<div class="sec-head"><span class="kicker">In einer Minute eingerichtet</span><h2 id="h-setup">Verbinden mit deinem KI-Assistenten</h2><p class="sub">Server-URL einfügen, einmal anmelden – fertig.</p></div>
${setupTabs(url)}
</div></section>

<section id="anmeldung" aria-labelledby="h-login"><div class="wrap">
<div class="sec-head"><span class="kicker">Anmeldung</span><h2 id="h-login">Am besten mit Konto</h2><p class="sub">Ein Konto merkt sich dein isgy-intern-Login und deine Notizen – alles andere geht auch ohne.</p></div>
<div class="card feature-wide"><div class="feat-ico">${I.shield}</div><div><h3>ISGY-KI-Konto <span class="tag org">empfohlen</span></h3><p>Einmal registrieren, isgy-intern-Login hinterlegen, fertig. Claude, ChatGPT &amp; Co. melden sich dann nur noch mit E-Mail und Passwort an. Mit der Erweiterung verbunden, bleibt die Office-365-Sitzung automatisch aktuell und deine Aufgaben &amp; Notizen aus „Mein Tag“ werden synchronisiert – der KI-Assistent kann sie lesen und neue anlegen.</p>
<a class="btn" href="/konto?neu=1" style="margin-top:14px">${I.key}Konto erstellen</a></div></div>
<div class="grid" style="margin-top:14px">
<div class="card"><div class="feat-ico">${I.key}</div><h3>Ohne Konto: Portal-Passwort</h3><p>Für Konten mit eigenem Portal-Passwort, z.&nbsp;B. Eltern. Der Server meldet sich selbst an – und automatisch neu, wenn die Sitzung abläuft.</p></div>
<div class="card"><div class="feat-ico">${I.swap}</div><h3>Ohne Konto: Verbindungscode</h3><p>Für Office-365-Logins (Schüler). Mit Microsoft-Login gibt es kein Portal-Passwort. In der Erweiterung <a href="${REPO}#installation"><b>ISGY Intern Plus</b></a> mit <kbd>Strg</kbd>+<kbd>K</kbd> einen Verbindungscode kopieren und beim Anmelden einfügen.</p></div>
</div>
</div></section>

<section id="erweiterung" aria-labelledby="h-ext" style="background:var(--bg-2)"><div class="wrap split">
<div>
<span class="kicker">Browser-Erweiterung</span><h2 id="h-ext">ISGY Intern Plus für Chrome, Edge, Brave &amp; Firefox</h2>
<p class="sub">Die Erweiterung räumt das Schulportal auf und ist die Brücke zwischen deinem Browser und dem KI-Konto.</p>
<ul class="checks">${FEATURES.map((f) => `<li>${I.check}<span>${esc(f)}</span></li>`).join('')}</ul>
<p style="margin-top:20px"><a class="btn" href="${REPO}#installation" rel="noopener">${I.bolt}Erweiterung installieren</a></p>
</div>
<img src="/assets/logo-512.png" width="320" height="320" alt="ISGY Intern Plus – Kreidetafel mit „ISGY Intern“ und orangem PLUS-Badge" loading="lazy" decoding="async">
</div></section>

<section id="datenschutz" aria-labelledby="h-priv"><div class="wrap">
<div class="sec-head"><span class="kicker">Datenschutz</span><h2 id="h-priv">Deine Daten bleiben deine.</h2></div>
<div class="grid g3">
<div class="card"><div class="feat-ico">${I.db}</div><h3>Verschlüsselt</h3><p>Ohne Konto wird nichts gespeichert. Mit Konto liegt dein isgy-intern-Login nur AES-256-verschlüsselt in der Datenbank (Supabase, Frankfurt), dazu deine Notizen.</p></div>
<div class="card"><div class="feat-ico">${I.eye}</div><h3>Portal nur lesen</h3><p>Von isgy-intern.de werden ausschließlich Daten gelesen – dort wird nichts geändert oder abgeschickt. Schreiben kann der Assistent nur deine eigenen Notizen.</p></div>
<div class="card"><div class="feat-ico">${I.shield}</div><h3>Jederzeit löschbar</h3><p>Connector entfernen, „Überall abmelden“ oder das Konto samt Notizen mit einem Klick löschen.</p></div>
</div>
</div></section>

<section id="faq" aria-labelledby="h-faq" style="background:var(--bg-2)"><div class="wrap">
<div class="sec-head"><span class="kicker">FAQ</span><h2 id="h-faq">Häufige Fragen</h2></div>
<div class="faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</div></section>
</main>
<footer><div class="wrap"><span>${DISCLAIMER}</span><nav aria-label="Weitere Links"><a href="${REPO}" rel="noopener" style="color:inherit">GitHub</a> · <a href="${REPO}/blob/HEAD/mcp/README.md" rel="noopener" style="color:inherit">Dokumentation</a> · <a href="/konto" style="color:inherit">Konto</a> · <a href="/schluessel" style="color:inherit">Zugriffsschlüssel</a></nav></div></footer>
${tail}`;
}
