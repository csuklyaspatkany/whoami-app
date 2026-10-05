// Checks the privacy rating rules in ratings.js with sample values.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { rate } = require("../ratings");

const chrome = { browser: "Chrome", language: "en-US" };
const status = (title, label, value, ctx = chrome) => rate(title, label, value, ctx).status;

test("every result has a status, a reason and a fix", () => {
  for (const [title, label, value] of [
    ["Browser", "User agent", "Mozilla/5.0"],
    ["What the server sees", "Your IP", "203.0.113.7"],
    ["What the server sees", "x-unknown", "1"],
    ["Fingerprint", "Hash", ""],
  ]) {
    const res = rate(title, label, value, chrome);
    assert.match(res.status, /^[GAR]$/);
    assert.equal(typeof res.why, "string");
    assert.equal(typeof res.fix, "string");
  }
});

test("the IP is Red, with a local-address remark only for loopback", () => {
  assert.equal(status("What the server sees", "Your IP", "203.0.113.7"), "R");
  assert.doesNotMatch(rate("What the server sees", "Your IP", "203.0.113.7", chrome).why, /local address/);
  assert.match(rate("What the server sees", "Your IP", "127.0.0.1", chrome).why, /local address/);
  assert.match(rate("What the server sees", "Your IP", "::1", chrome).why, /local address/);
});

test("referrers are Red only when they carry a path or query", () => {
  assert.equal(status("Browser", "Referrer", "n/a"), "G");
  assert.equal(status("Browser", "Referrer", "https://example.com/"), "G");
  assert.equal(status("Browser", "Referrer", "https://example.com/search?q=me"), "R");
  assert.equal(status("What the server sees", "referer", "https://example.com/account"), "R");
});

test("Global Privacy Control on is Green, off is Amber", () => {
  assert.equal(status("Browser", "Global Privacy Control", "yes"), "G");
  assert.equal(status("Browser", "Global Privacy Control", "no"), "A");
  assert.equal(status("Browser", "Global Privacy Control", "n/a"), "A");
});

test("an unmasked GPU is Amber, a generic one Green", () => {
  assert.equal(status("Hardware", "Renderer", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)"), "A");
  assert.equal(status("Hardware", "Renderer", "WebKit WebGL"), "G");
  assert.equal(status("Hardware", "Renderer", "n/a"), "G");
});

test("common screens are Green, unusual ones Amber", () => {
  assert.equal(status("Screen & window", "Screen", "1920 × 1080"), "G");
  assert.equal(status("Screen & window", "Screen", "1707 × 1067"), "A");
  assert.equal(status("Screen & window", "Device pixel ratio", "1.25"), "A");
});

test("headers that carry an IP are Red; unknown headers are Green", () => {
  assert.equal(status("What the server sees", "x-forwarded-for", "203.0.113.7"), "R");
  assert.equal(status("What the server sees", "via", "1.1 proxy"), "R");
  assert.equal(status("What the server sees", "sec-ch-ua-platform-version", '"19.0.0"'), "A");
  assert.equal(status("What the server sees", "accept", "*/*"), "G");
});

test("rows without a rule are flagged", () => {
  assert.match(rate("Browser", "Something new", "x", chrome).why, /No rating rule/);
});

test("fixes are tailored to the browser", () => {
  const fix = browser => rate("Browser", "Cookies enabled", "yes", { browser, language: "en" }).fix;
  assert.match(fix("Firefox"), /Enhanced Tracking Protection/);
  assert.match(fix("Microsoft Edge"), /Cookies and site permissions/);
  assert.match(fix("Opera"), /privacy settings/);
});
