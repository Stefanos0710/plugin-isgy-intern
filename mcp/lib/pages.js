// HTML pages: login (OAuth authorize), personal access key, start page with setup instructions.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
:root{--accent:#e8730c;--bg:#f6f5f2;--card:#fff;--text:#1d1d1f;--muted:#6b6b70;--line:#e3e1dc;--err:#b42318;--errbg:#fdecea;--ok:#067647}
@media (prefers-color-scheme:dark){:root{--bg:#141415;--card:#1f1f21;--text:#f2f2f3;--muted:#a1a1a8;--line:#333336;--errbg:#3a1714;--err:#ff8a7a;--ok:#5fd39b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:34rem;margin:0 auto;padding:2.5rem 1rem 4rem}main.wide{max-width:46rem}
.brand{display:flex;align-items:center;gap:.6rem;font-weight:700;font-size:1.05rem;margin-bottom:1.25rem}
.brand i{display:inline-grid;place-items:center;width:2rem;height:2rem;border-radius:.6rem;background:var(--accent);color:#fff;font-style:normal}
.card{background:var(--card);border:1px solid var(--line);border-radius:1rem;padding:1.5rem;margin-bottom:1rem}
h1{font-size:1.4rem;margin:0 0 .4rem}h2{font-size:1.1rem;margin:1.5rem 0 .5rem}p{margin:.4rem 0}.muted{color:var(--muted);font-size:.92rem}
label{display:block;font-weight:600;font-size:.92rem;margin:1rem 0 .3rem}
input[type=text],input[type=password],textarea{width:100%;padding:.7rem .8rem;border:1px solid var(--line);border-radius:.6rem;background:var(--bg);color:var(--text);font:inherit}
textarea{min-height:6rem;font-family:ui-monospace,monospace;font-size:.8rem;word-break:break-all}
input:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:1px}
button{margin-top:1.2rem;width:100%;padding:.8rem;border:0;border-radius:.6rem;background:var(--accent);color:#fff;font:inherit;font-weight:700;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}
.auth>input{position:absolute;opacity:0;pointer-events:none}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:.3rem;background:var(--bg);border:1px solid var(--line);border-radius:.7rem;padding:.25rem;margin:1rem 0 .25rem}
.tabs label{margin:0;text-align:center;padding:.5rem;border-radius:.5rem;cursor:pointer;font-size:.9rem}
#t-pw:checked~.tabs [for=t-pw],#t-code:checked~.tabs [for=t-code]{background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.12)}
#t-pw:focus-visible~.tabs [for=t-pw],#t-code:focus-visible~.tabs [for=t-code]{outline:2px solid var(--accent)}
.pane{display:none}#t-pw:checked~.p-pw,#t-code:checked~.p-code{display:block}
.err{background:var(--errbg);color:var(--err);border-radius:.6rem;padding:.7rem .9rem;margin:1rem 0 0;font-size:.92rem}
.who{display:flex;gap:.5rem;align-items:center;font-size:.92rem;color:var(--muted)}.who b{color:var(--text)}
ol{padding-left:1.2rem;margin:.4rem 0}li{margin:.25rem 0}
code,pre{font-family:ui-monospace,monospace;font-size:.85rem;background:var(--bg);border:1px solid var(--line);border-radius:.4rem}
code{padding:.05rem .3rem}pre{padding:.8rem;overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.url{display:flex;gap:.5rem;align-items:center}.url code{flex:1;padding:.6rem .7rem;font-size:.95rem;overflow-x:auto;white-space:nowrap}
.url button{width:auto;margin:0;padding:.6rem 1rem}
a{color:var(--accent)}footer{margin-top:2rem;font-size:.8rem;color:var(--muted);text-align:center}
`;

const COPY_JS = `document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>{navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent.trim());b.textContent='Kopiert ✓';setTimeout(()=>b.textContent='Kopieren',1500)}));
document.querySelectorAll('form[data-busy]').forEach(f=>f.addEventListener('submit',()=>{const b=f.querySelector('button[type=submit]');if(b){b.disabled=true;b.textContent='Anmelden …'}}));`;

export function layout(title, body, { wide = false } = {}) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}</style></head>
<body><main${wide ? ' class="wide"' : ''}><div class="brand"><i>IS</i>ISGY Intern für KI-Assistenten</div>${body}
<footer>Inoffiziell, kein Angebot des Gymnasiums Ismaning. Nur Lesezugriff auf deine eigenen Portal-Daten.</footer></main>
<script>${COPY_JS}</script></body></html>`;
}

// The login form, used for the OAuth flow and for creating a personal access key.
export function loginForm({ action, hidden = {}, error = '', mode = 'pw', username = '', heading, intro, button = 'Verbinden' }) {
  const fields = Object.entries(hidden).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');
  return `<div class="card"><h1>${esc(heading)}</h1>${intro}
<form method="post" action="${esc(action)}" data-busy>${fields}
<div class="auth">
<input type="radio" name="mode" id="t-pw" value="pw"${mode === 'pw' ? ' checked' : ''}><input type="radio" name="mode" id="t-code" value="code"${mode === 'code' ? ' checked' : ''}>
<div class="tabs"><label for="t-pw">Benutzername &amp; Passwort</label><label for="t-code">Office 365 (Schüler)</label></div>
<div class="pane p-pw">
<p class="muted" style="margin-top:.8rem">Für Konten mit eigenem Portal-Passwort (z.&nbsp;B. Eltern). Dieselben Daten wie auf isgy-intern.de.</p>
<label for="u">Benutzername</label><input type="text" id="u" name="username" autocomplete="username" autocapitalize="none" value="${esc(username)}">
<label for="p">Passwort</label><input type="password" id="p" name="password" autocomplete="current-password">
</div>
<div class="pane p-code">
<p class="muted" style="margin-top:.8rem">Wer sich mit „Login mit Office 365“ anmeldet, hat kein Portal-Passwort. Dann so:</p>
<ol class="muted"><li>Browser-Erweiterung <b>ISGY Intern Plus</b> (ab Version 1.2) installieren.</li>
<li>Auf <a href="https://www.isgy-intern.de" target="_blank" rel="noopener">isgy-intern.de</a> normal anmelden und <b>„Angemeldet bleiben“</b> anhaken.</li>
<li><kbd>Strg</kbd>+<kbd>K</kbd> drücken → <b>„🤖 KI-Verbindungscode kopieren“</b>.</li>
<li>Code hier einfügen.</li></ol>
<label for="c">Verbindungscode</label><textarea id="c" name="code" placeholder="isgy1.…" spellcheck="false"></textarea>
</div></div>
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
<button type="submit">${esc(button)}</button>
</form>
<p class="muted" style="margin-top:1rem">Deine Zugangsdaten werden nirgends gespeichert, sondern nur verschlüsselt in dem Zugriffsschlüssel, den dein KI-Assistent bekommt. Der Server kann damit ausschließlich lesen.</p></div>`;
}

export function authorizePage({ client, redirectHost, req, error, mode, username }) {
  return layout('Mit ISGY Intern verbinden', loginForm({
    action: '/authorize', hidden: { req }, error, mode, username,
    heading: 'Mit ISGY Intern verbinden',
    intro: `<p class="who"><span><b>${esc(client)}</b> möchte deinen Stundenplan, Vertretungsplan, Hausaufgaben und Termine lesen.</span></p>
<p class="muted">Weiterleitung danach an <b>${esc(redirectHost)}</b>.</p>`,
  }));
}

export function errorPage(title, message) {
  return layout(title, `<div class="card"><h1>${esc(title)}</h1><p>${esc(message)}</p></div>`);
}

function clientDocs(origin, key) {
  const url = `${origin}/mcp`;
  const header = key ? `"headers": { "Authorization": "Bearer ${esc(key)}" }` : '';
  return `
<h2>Claude (claude.ai, Desktop, Handy)</h2>
<ol><li><b>Einstellungen → Connectors</b> (bzw. „Konnektoren“) → <b>Benutzerdefinierten Connector hinzufügen</b>.</li>
<li>Name: <code>ISGY Intern</code>, URL: <code>${esc(url)}</code> → Hinzufügen → <b>Verbinden</b>.</li>
<li>Im sich öffnenden Fenster anmelden. Fertig – im Chat einfach fragen, z.&nbsp;B. „Was habe ich morgen?“.</li></ol>
<p class="muted">Claude Code: <code>claude mcp add --transport http isgy-intern ${esc(url)}</code>, dann <code>/mcp</code> → Anmelden.</p>

<h2>ChatGPT</h2>
<ol><li><b>Einstellungen → Apps &amp; Connectors → Erweitert</b> → <b>Entwicklermodus</b> einschalten (Plus/Pro/Business).</li>
<li><b>Apps &amp; Connectors → Erstellen</b>: Name <code>ISGY Intern</code>, MCP-Server-URL <code>${esc(url)}</code>, Authentifizierung <b>OAuth</b>.</li>
<li>„Ich vertraue dieser Anwendung“ anhaken → Erstellen → anmelden. Im Chat über <b>+ → Mehr → ISGY Intern</b> aktivieren.</li></ol>

<h2>Gemini</h2>
<p><b>Gemini CLI</b> – in <code>~/.gemini/settings.json</code>:</p>
<pre>{
  "mcpServers": {
    "isgy-intern": {
      "httpUrl": "${esc(url)}"${key ? `,\n      ${header}` : ''}
    }
  }
}</pre>
${key ? '' : `<p class="muted">Beim ersten Start öffnet sich die Anmeldung automatisch (sonst <code>/mcp auth isgy-intern</code>).</p>`}
<p class="muted">Gemini in der App bzw. auf gemini.google.com: Falls deine Version das Hinzufügen eigener MCP-Server/Connectors anbietet, dort dieselbe URL eintragen. Sonst Gemini CLI verwenden.</p>

<h2>Andere Clients (Cursor, VS Code, LM Studio …)</h2>
<p class="muted">Server-URL <code>${esc(url)}</code>, Transport „Streamable HTTP“. Mit OAuth meldet sich der Client selbst an; Clients ohne OAuth bekommen einen <a href="/schluessel">persönlichen Zugriffsschlüssel</a> als Header <code>Authorization: Bearer …</code>.</p>`;
}

export function homePage(origin) {
  return layout('ISGY Intern MCP', `<div class="card"><h1>ISGY Intern für Claude, ChatGPT &amp; Gemini</h1>
<p>Dieser MCP-Server gibt deinem KI-Assistenten Lesezugriff auf <b>deinen</b> Stundenplan, den Vertretungsplan, das Klassentagebuch (Themen &amp; Hausaufgaben) und die Termine aus dem Klassenkalender von isgy-intern.de.</p>
<p class="muted">Server-URL zum Einfügen:</p>
<div class="url"><code id="u">${esc(origin)}/mcp</code><button type="button" data-copy="u">Kopieren</button></div>
</div>
<div class="card">${clientDocs(origin)}</div>`, { wide: true });
}

export function keyPage({ origin, error, mode, username }) {
  return layout('Persönlicher Zugriffsschlüssel', loginForm({
    action: '/schluessel', error, mode, username, button: 'Schlüssel erstellen',
    heading: 'Persönlicher Zugriffsschlüssel',
    intro: `<p class="muted">Nur für Programme ohne OAuth-Anmeldung. Claude, ChatGPT und Gemini CLI brauchen das nicht – dort einfach <code>${esc(origin)}/mcp</code> eintragen.</p>`,
  }));
}

export function keyResultPage({ origin, key, days }) {
  return layout('Dein Zugriffsschlüssel', `<div class="card"><h1>Dein Zugriffsschlüssel</h1>
<p>Gültig für ${days} Tage. Behandle ihn wie ein Passwort: Wer ihn hat, kann deine Portal-Daten lesen.</p>
<div class="url"><code id="k">${esc(key)}</code><button type="button" data-copy="k">Kopieren</button></div>
<p class="muted">Als HTTP-Header: <code>Authorization: Bearer &lt;Schlüssel&gt;</code></p></div>
<div class="card">${clientDocs(origin, key)}</div>`, { wide: true });
}
