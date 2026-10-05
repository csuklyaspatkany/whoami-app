// Starts the real server on a random free port and checks each route over HTTP.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const server = require("../server");

let base;

before(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise(resolve => server.close(resolve)));

for (const route of ["/", "/index.html"]) {
  test(`GET ${route} serves the page`, async () => {
    const res = await fetch(base + route);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert.match(await res.text(), /<title>WhoAmI<\/title>/);
  });
}

test("GET / asks for detailed User-Agent Client Hints", async () => {
  const res = await fetch(base + "/");
  await res.text();
  const hints = res.headers.get("accept-ch").split(",").map(h => h.trim());
  assert.deepEqual(hints, [
    "Sec-CH-UA-Platform-Version",
    "Sec-CH-UA-Arch",
    "Sec-CH-UA-Model",
    "Sec-CH-UA-Full-Version-List",
  ]);
});

test("GET /api/request describes the request as JSON", async () => {
  const res = await fetch(base + "/api/request", { headers: { "X-Test": "hello" } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json");

  const body = await res.json();
  assert.equal(body.remoteAddress, "127.0.0.1");
  assert.equal(typeof body.remotePort, "number");
  assert.equal(body.httpVersion, "1.1");
  assert.equal(body.method, "GET");
  assert.equal(body.headers["x-test"], "hello");
  assert.ok(Math.abs(Date.parse(body.serverTime) - Date.now()) < 60_000);
});

test("/api/request reports the HTTP method used", async () => {
  const res = await fetch(base + "/api/request", { method: "POST" });
  assert.equal((await res.json()).method, "POST");
});

test("unknown paths return 404", async () => {
  const res = await fetch(base + "/nope");
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "text/plain");
  assert.equal(await res.text(), "Not found");
});
