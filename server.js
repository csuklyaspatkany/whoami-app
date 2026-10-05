// Tiny zero-dependency server: serves the page and echoes back what the
// server can see about each request (IP, headers). Nothing leaves your machine.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const page = path.join(__dirname, "index.html");

const server = http.createServer((req, res) => {
  if (req.url === "/api/request") {
    const body = {
      remoteAddress: req.socket.remoteAddress,
      remotePort: req.socket.remotePort,
      httpVersion: req.httpVersion,
      method: req.method,
      headers: req.headers,
      serverTime: new Date().toISOString(),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(body, null, 2));
  }
  if (req.url === "/" || req.url === "/index.html") {
    // Ask Chromium browsers to send their detailed User-Agent Client Hints.
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Accept-CH": "Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Model, Sec-CH-UA-Full-Version-List",
    });
    return fs.createReadStream(page).pipe(res);
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// Only listen when run directly; tests require() the server and pick their own port.
if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`WhoAmI running at http://localhost:${PORT}`);
  });
}

module.exports = server;
