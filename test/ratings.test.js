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

test("fingerprinting probes are Amber when exposed and Green when protected", () => {
  const probe = (label, v) => status("Advanced fingerprinting", label, v);
  assert.equal(probe("Canvas", "9f2c4d1e8a7b6c50"), "A");
  assert.equal(probe("Canvas", "noise added"), "G");
  assert.equal(probe("Canvas", "blocked"), "G");
  assert.equal(probe("Audio", "124.04347527"), "A");
  assert.equal(probe("Audio", "randomized each time"), "G");
  assert.equal(probe("Audio", "n/a"), "G");
  assert.equal(probe("DOM rects", "9f2c4d1e8a7b6c50"), "A");
  assert.equal(probe("DOM rects", "randomized each time"), "G");
});

test("fonts are Amber once more than a few are visible", () => {
  assert.equal(status("Advanced fingerprinting", "Fonts", "0 of 49 tested"), "G");
  assert.equal(status("Advanced fingerprinting", "Fonts", "3 of 49 tested: Arial, Verdana, Georgia"), "G");
  assert.equal(status("Advanced fingerprinting", "Fonts", "27 of 49 tested: Arial, Calibri"), "A");
});

test("an exposed WebRTC local IP is Red; hidden or unavailable is Green", () => {
  const probe = v => status("Advanced fingerprinting", "WebRTC local IP", v);
  assert.equal(probe("192.168.1.23"), "R");
  assert.equal(probe("192.168.1.23, fe80::1"), "R");
  for (const v of ["hidden (mDNS)", "none found", "blocked", "n/a"]) assert.equal(probe(v), "G", v);
});

test("ad blocker and storage rows", () => {
  assert.equal(status("Advanced fingerprinting", "Ad/tracker blocker", "detected"), "G");
  assert.equal(status("Advanced fingerprinting", "Ad/tracker blocker", "not detected"), "A");
  assert.equal(status("Capabilities", "Storage APIs", "none"), "G");
  assert.equal(status("Capabilities", "Storage APIs", "localStorage, sessionStorage, IndexedDB"), "A");
});

test("new rows get fixes tailored to the browser", () => {
  const fix = (title, label, v, browser) => rate(title, label, v, { browser, language: "en" }).fix;
  assert.match(fix("Advanced fingerprinting", "WebRTC local IP", "10.0.0.5", "Firefox"), /media\.peerconnection/);
  assert.match(fix("Advanced fingerprinting", "WebRTC local IP", "10.0.0.5", "Brave"), /WebRTC IP handling policy/);
  assert.match(fix("Advanced fingerprinting", "Ad/tracker blocker", "not detected", "Safari"), /content blocker/);
  assert.match(fix("Capabilities", "Storage APIs", "localStorage", "Opera"), /third-party cookies/i);
});
