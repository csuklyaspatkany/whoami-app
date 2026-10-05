# WhoAmI

A single page that shows what your browser tells every website it visits without asking: user agent, screen size, time zone, language, hardware hints, preferences, and the request headers the server receives. At the end it combines all of these into a fingerprint hash, which shows how a site could recognize your browser again without cookies.

Every value also gets a privacy rating: **G** (green, fine as is), **A** (amber, could be tightened to protect your privacy) or **R** (red, exposes personal data). Each row has a third column that says why it got that rating and how to fix it in the browser you're using. A legend at the top explains what each rating means and counts the rows for it. Each rating is also a toggle: switch one off to hide those rows, for example to see only the amber and red items. Every red item gets a link in a "Top fixes" list.

Nothing leaves your machine. The server listens on `127.0.0.1` only and just echoes your own request back to you.

## Run it

You need [Node.js](https://nodejs.org/) 18 or newer. There are no dependencies to install.

```bash
node server.js
```

Then open <http://localhost:3000>.

To use a different port, set `PORT`:

```bash
PORT=8080 node server.js
```

## Run the tests

The tests use Node's built-in test runner, so there's nothing to install:

```bash
npm test
```

They start the server on a random free port, so they work even while the app is running on port 3000. GitHub Actions runs them on every pull request.

## Files

- `server.js`: a small HTTP server with no dependencies. It serves the page and exposes `/api/request`, which returns the IP, port, HTTP version, and headers it saw for your request.
- `index.html`: the page markup.
- `styles.css`: the page styles, including dark mode.
- `app.js`: the page logic. It reads standard browser APIs, calls `/api/request`, and renders the results.
- `ratings.js`: the privacy rating rules, one per row, with fix notes per browser.
- `test/server.test.js`: HTTP tests for every route the server handles.
- `test/ratings.test.js`: tests for the rating rules.

## Notes

- Chromium browsers send extra User-Agent Client Hints (platform version, architecture, model) because the server asks for them with an `Accept-CH` header.
- Which values appear depends on your browser. Values a browser doesn't expose show as `n/a`.
- The fingerprint shown is the first 32 hex characters of a SHA-256 hash over every value on the page.
