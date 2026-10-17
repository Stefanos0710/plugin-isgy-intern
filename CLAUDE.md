# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Two parts in one repo:

- **"ISGY Intern Plus"**: a Manifest V3 browser extension (Chromium + Firefox) that augments the school portal isgy-intern.de. Plain JavaScript, no dependencies, no bundler, no linter.
- **[mcp/](mcp/)**: a remote MCP server (Vercel + Supabase) that lets Claude, ChatGPT and Gemini read the portal and the user's notes. Separate Node project with its own tests.

README and UI strings are in German; keep user-facing text German.

## Commands

Extension (repo root):
- `node build.mjs` (or `npm run build`) — Node >= 18. Clears `dist/chromium`, `dist/firefox` and old zips (keeps `dist/signed/`) and writes `dist/chromium/` and `dist/firefox/` plus `isgy-intern-plus-<version>-<target>.zip` (zip is hand-written with `node:zlib`).
- To try changes: load `dist/chromium` as an unpacked extension (or `dist/firefox/manifest.json` via `about:debugging`) and reload after each rebuild. Source files in the repo root are not directly loadable for Firefox. There are no extension unit tests.

MCP server (`cd mcp`):
- `npm install`, `npm test` — end-to-end test (37 checks) with the official MCP SDK against fake portal and fake Supabase; `npm run dev` — local server on :3000 against the real portal.
- Deploys are made to the Vercel project `isgy-intern-mcp` (production alias `isgy-intern-mcp.vercel.app`, root directory `mcp`, region fra1). The repo is not linked to Vercel's git integration, so a push does not deploy: create a deployment from the branch (Vercel MCP `create_deployment` with `gitSource`) and check `/health` afterwards (it reports whether pdf.js loads).

## Extension architecture

- [manifest.json](manifest.json) is the Chromium manifest and the single source of truth. [build.mjs](build.mjs) derives the Firefox manifest from it (service worker → `background.scripts`, `options_page` → `options_ui`, adds gecko id). Bump the version in manifest.json only (package.json version is separate). Permissions: `storage`, `cookies` (only for the AI connection code / KI-Konto).
- [src/content.js](src/content.js) — the bulk of the logic; one async IIFE injected on every isgy-intern.de page (after [src/defaults.js](src/defaults.js)). It handles the "Mein Tag" dashboard, teacher-code (Kürzel) replacement, last-diary-entry popups, sidebar pins, the "Aufgaben & Notizen" card, and the command palette / `g`-prefixed keyboard shortcuts. Styling in [src/content.css](src/content.css), accent via the `--ip-accent` CSS variable.
- [src/defaults.js](src/defaults.js) defines `ISGY_DEFAULTS`, shared by the content script and [options.js](options.js) as a global (not a module). Add new settings there; the options page generates its form from these keys (every key except `pins`), so matching field ids in [options.html](options.html) are needed. `ISGY_AI_SERVER` (URL of the MCP server) is a separate const in the same file and deliberately not part of `ISGY_DEFAULTS`.
- [src/background.js](src/background.js) handles messages from content script and options page: `'open-options'`, `'portal-cookies'` (reads the HttpOnly portal cookies for the AI connection code), `{type: 'ai-login'}` and `{type: 'ai-sync'}` (talk to the MCP server's `/api/ext/*`, adding the cookies to the session it uploads).
- Storage split: user settings and pins in `chrome.storage.sync`; everything else in `chrome.storage.local` — caches (`kuerzel` map, `apiKey`, `cache`), `notes`, and the KI-Konto state (`aiAccount` = `{server, token, email, error, lastSync, credKind}`, `aiLastSync`, `notesDeleted`).
- Notes ↔ KI-Konto sync (`saveNotes()` / `aiSync()` in content.js): `saveNotes()` stamps every changed note with `updated` (ms) and records deletions as tombstones in `notesDeleted`. `aiSync()` runs on page load (throttled to 2 min) and after each change (debounced), sends all notes plus tombstones, and replaces the local list with the merged list the server returns (newer `updated` wins). The browser session (localStorage `session`, app key, cookies) is only included on logged-in pages (`.su-sidebar-nav` present). After a merge the card redraws via the `ip-notes-synced` event. Palette commands: „🤖 KI-Verbindungscode kopieren“ (account-less path), „🔄 Mit KI-Konto synchronisieren“.
- Portal data access: the content script calls the portal's REST endpoints (vplan, klassenkalender) using the app key scraped from an inline script on the page (`KEY_RE` / `apiKey()`) and the session from `localStorage`. Auth headers are `auth-app` and `auth-session`. Fetches use relative URLs, so they rely on same-origin execution.
- Kürzel → names: the school's PDF is fetched with the user's session, parsed in memory with the vendored pdf.js in [lib/](lib/) (dynamically imported through `chrome.runtime.getURL`, hence `web_accessible_resources`), and only the code → name map is cached. The PDF is never stored. [lib/](lib/) holds minified third-party code — don't edit it.

## MCP server architecture ([mcp/](mcp/))

- One Vercel function [mcp/api/index.js](mcp/api/index.js) routes everything (vercel.json rewrites all paths): `/mcp` (Streamable HTTP, stateless JSON-RPC), OAuth 2.1 endpoints (`/.well-known/*`, `/register`, `/authorize`, `/token`), `/schluessel` (personal access key), `/konto` + `/konto/<action>` (account pages), `/api/ext/login|sync` (extension API), `/health`. MCP and OAuth are implemented by hand (no SDK): [lib/mcp.js](mcp/lib/mcp.js), [lib/oauth.js](mcp/lib/oauth.js) (DCR + PKCE, client ids are signed, codes/tokens are sealed).
- Statelessness: [lib/crypto.js](mcp/lib/crypto.js) `seal(type, payload, ttl)` = AES-256-GCM with the type bound as AAD, keyed from `MCP_SECRET`. Token types: `req`, `code`, `at` (24 h), `rt` (1 y), `key` (180 d, personal access key), `web` (cookie `isgy_s`, 30 d), `ext` (extension, 1 y), `cred` (portal login stored in the database). A token carries either `{cred}` (no account; the portal login itself) or `{acc, tv}` (account id + `token_version`; the login is looked up per request). Bumping `token_version` ("Überall abmelden") invalidates all of them. Changing `MCP_SECRET` logs everyone out and makes stored logins unreadable.
- Portal access: [lib/portal.js](mcp/lib/portal.js) mirrors the extension's calls server-side. Credential kinds: `{m:'pw', u, p}` (logs in via `index.php?page=login&authorize=1`, re-logs in when the session dies) and `{m:'s', c, s, k}` (browser session handed over by the extension or the connection code — for Office-365 accounts, which have no portal password). `Portal` instances are pooled per credential while the function instance is warm. Kürzel PDF parsing is the same as in the extension; keep both in sync. Dependencies: `pdfjs-dist` and `@napi-rs/canvas` (DOMMatrix for pdf.js, imported explicitly in `loadPdfjs()` so Vercel bundles it).
- Accounts (optional): [lib/accounts.js](mcp/lib/accounts.js) (scrypt passwords, tokens), [lib/konto.js](mcp/lib/konto.js) (pages + extension API), [lib/db.js](mcp/lib/db.js) (Supabase RPC, no client library). Enabled only when `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_API_SECRET` are set (`dbEnabled()`). The extension only overwrites the stored session when the account's `cred_kind` is not `pw`.
- Supabase (project `isgy-intern`, ref `anefqzgupquuhefftsvz`, eu-central-1): tables live in schema `private` (not exposed by the Data API) and are reached only through security-definer functions `api_*` that check `SUPABASE_API_SECRET` against the hash in `private.config`. [mcp/supabase/0001_accounts_notes.sql](mcp/supabase/0001_accounts_notes.sql) is the full definition; schema changes go into a new numbered file and must be applied manually (SQL editor), and [test/mock-supabase.mjs](mcp/test/mock-supabase.mjs) must mirror any function change.
- Tools: [lib/tools.js](mcp/lib/tools.js) (`TOOLS`, `PROMPTS`). Read tools take `(portal, args, ctx)`; the note tools (`notizen`, `notiz_anlegen`, `aufgabe_erledigt`, `notiz_loeschen`, marked `write: true`) need `ctx.acc` and use `db`. Every response starts with „Stand: <date, time>“; dates are Europe/Berlin ([lib/dates.js](mcp/lib/dates.js); `ISGY_NOW` pins the clock in tests). User-facing tool output and error messages are German and written for the model to relay.
- Pages: [lib/pages.js](mcp/lib/pages.js) renders all HTML (inline CSS/JS, strict CSP in api/index.js, light + dark, mobile first). POSTs to `/authorize`, `/schluessel` and `/konto*` reject foreign `Origin`s.
- Tests: [test/run.mjs](mcp/test/run.mjs) drives the real handler with the official MCP SDK client; [test/mock-portal.mjs](mcp/test/mock-portal.mjs) and [test/mock-supabase.mjs](mcp/test/mock-supabase.mjs) are in-memory fakes.

## Privacy rules

- Never commit secrets, the Kürzel/e-mail PDF, or real credentials. [.gitignore](.gitignore) excludes `dist/`, `*.pdf`, `*.zip`, `.env*` and `release/`. Server secrets (`MCP_SECRET`, `SUPABASE_API_SECRET`) exist only in Vercel's environment settings.
- Without a KI-Konto the extension sends nothing to any server. With one, only notes and (for non-password accounts) the portal session go to the MCP server. Keep README's Datenschutz section true when changing this.
