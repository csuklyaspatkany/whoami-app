# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

No dependencies and no build step. Node.js 18+ only.

- Run the app: `npm start` (or `node server.js`), then open http://localhost:3000. Set `PORT` to change the port.
- Run all tests: `npm test` (Node's built-in `node --test`)
- Run a single test by name: `node --test --test-name-pattern="404" test/server.test.js` (pass the file, not the `test/` directory)

CI (`.github/workflows/test.yml`) runs `npm test` on Node 18, 20, 22 and 24, so don't use APIs newer than Node 18.

## Architecture

WhoAmI is a single page showing what a browser reveals to websites, ending in a fingerprint hash. It has three parts:

- `server.js`: a zero-dependency `http` server with exactly four behaviors: serve `index.html` on `/` and `/index.html` (with an `Accept-CH` header requesting detailed User-Agent Client Hints from Chromium), serve `styles.css`, `ratings.js` and `app.js` from an explicit allowlist (`assets`; add new page files there or they 404), return the request's IP, port, HTTP version, method and headers as JSON on `/api/request`, and return a plain-text 404 for everything else. It binds to `127.0.0.1` only, and only calls `listen()` when run directly (`require.main === module`); otherwise it exports the server unstarted.
- `index.html` (markup), `styles.css`, `ratings.js` and `app.js` (all client logic, a classic `defer` script, not a module). In `app.js`, each `section(title, rows)` call renders a card and also records every value into the `all` object, keyed `"<title>.<label>"`, except values listed in the `volatile` set (keys or whole section titles), which are shown greyed out and left out so the fingerprint stays the same across reloads. After all sections render, the fingerprint is the first 32 hex chars of SHA-256 over `JSON.stringify(all)`. So adding, renaming or reordering any non-volatile row changes every user's fingerprint, and a new row whose value changes between visits must go in `volatile`. Missing values (`undefined`, `null`, `""`) show as `n/a`. The "Advanced fingerprinting" card comes from probe functions in `app.js` (`canvasProbe`, `audioProbe`, `fontsProbe`, `rectsProbe`, `webrtcProbe`, `adBlockProbe`, plus `storageApis`). Each returns a short string (a hash, a count, or a word like `blocked`, `noise added` or `randomized each time`) and makes no network requests, which the constraints below require, so don't add probes that contact a STUN server or other host. A probe whose value changes between visits (like the WebRTC address) goes in `volatile`.
- `ratings.js` (a classic script loaded before `app.js`, and also `require`-able by the tests) defines `rate(title, label, value, ctx)`, which returns `{ status, why, fix }` with status `G`, `A` or `R`. Rules are keyed `"<title>.<label>"`, like `all`. Rows in "What the server sees" without a rule fall back to rules by header name. `fix` can differ per browser (`ctx.browser`, from `browserName()` or `"Brave"`). `section()` renders each row as three grid columns (label with rating badge, value, an always-visible Why/Fix note `<dd>`), shows the card's worst status in its title, and `scorecard()` fills `#score` with the legend: one toggle button per rating (`aria-pressed`) that calls `applyFilter()`, which sets `hide-R/A/G` classes on `#grid` (each row's three cells carry a `row-<status>` class) and hides cards with no visible rows. Ratings never go into `all`, so they don't affect the fingerprint. Every new row needs a rule: without one it is rated Amber with "No rating rule for this row yet".

`test/ratings.test.js` checks the rating rules with sample values. Tests (`test/server.test.js`) `require` the exported server and listen on port 0, so they run fine while the app is running on 3000. The `Accept-CH` test asserts the exact header list and order, so update it when changing the hints.

## Constraints

- Keep it dependency-free (no npm packages) on both server and page.
- Nothing leaves the machine: the server only echoes the request back, and the page makes no third-party requests.
