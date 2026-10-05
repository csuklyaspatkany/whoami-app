# WhoAmI

A single page that shows what your browser tells every website it visits without asking: user agent, screen size, time zone, language, hardware hints, preferences, and the request headers the server receives. At the end it combines all of these into a fingerprint hash, which shows how a site could recognize your browser again without cookies.

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

## Files

- `server.js`: a small HTTP server with no dependencies. It serves the page and exposes `/api/request`, which returns the IP, port, HTTP version, and headers it saw for your request.
- `index.html`: the page. It reads standard browser APIs, calls `/api/request`, and renders the results.

## Notes

- Chromium browsers send extra User-Agent Client Hints (platform version, architecture, model) because the server asks for them with an `Accept-CH` header.
- Which values appear depends on your browser. Values a browser doesn't expose show as `n/a`.
- The fingerprint shown is the first 32 hex characters of a SHA-256 hash over every value on the page.
