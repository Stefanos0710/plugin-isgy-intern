# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"ISGY Intern Plus": a Manifest V3 browser extension (Chromium + Firefox) that augments the school portal isgy-intern.de. Plain JavaScript, no dependencies, no bundler, no tests, no linter. README and UI strings are in German; keep user-facing text German.

## Commands

- `node build.mjs` (or `npm run build`) — Node >= 18. Clears `dist/chromium`, `dist/firefox` and old zips (keeps `dist/signed/`) and writes `dist/chromium/` and `dist/firefox/` plus `isgy-intern-plus-<version>-<target>.zip` (zip is hand-written with `node:zlib`).
- To try changes: load `dist/chromium` as an unpacked extension (or `dist/firefox/manifest.json` via `about:debugging`) and reload after each rebuild. Source files in the repo root are not directly loadable for Firefox.

## Architecture

- [manifest.json](manifest.json) is the Chromium manifest and the single source of truth. [build.mjs](build.mjs) derives the Firefox manifest from it (service worker → `background.scripts`, `options_page` → `options_ui`, adds gecko id). Bump the version in manifest.json only (package.json version is separate).
- [src/content.js](src/content.js) — the bulk of the logic; one async IIFE injected on every isgy-intern.de page (after [src/defaults.js](src/defaults.js)). It handles the "Mein Tag" dashboard, teacher-code (Kürzel) replacement, last-diary-entry popups, sidebar pins, and the command palette / `g`-prefixed keyboard shortcuts. Styling in [src/content.css](src/content.css), accent via the `--ip-accent` CSS variable.
- [src/defaults.js](src/defaults.js) defines `ISGY_DEFAULTS`, shared by the content script and [options.js](options.js) as a global (not a module). Add new settings there; the options page generates its form from these keys (every key except `pins`), so matching field ids in [options.html](options.html) are needed.
- [src/background.js](src/background.js) only exists to open the options page on behalf of content scripts (`'open-options'` message).
- Storage split: user settings and pins in `chrome.storage.sync`; caches (`kuerzel` map, `apiKey`) in `chrome.storage.local`.
- Portal data access: the content script calls the portal's REST endpoints (vplan, klassenkalender) using the app key scraped from an inline script on the page (`KEY_RE` / `apiKey()`) and the session from `localStorage`. Auth headers are `auth-app` and `auth-session`. Fetches use relative URLs, so they rely on same-origin execution.
- Kürzel → names: the school's PDF is fetched with the user's session, parsed in memory with the vendored pdf.js in [lib/](lib/) (dynamically imported through `chrome.runtime.getURL`, hence `web_accessible_resources`), and only the code → name map is cached. The PDF is never stored. [lib/](lib/) holds minified third-party code — don't edit it.
- [.gitignore](.gitignore) excludes `dist/`, `*.pdf`, `*.zip`, and the local Kürzel/e-mail list so personal school data is never committed.
