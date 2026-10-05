const grid = document.getElementById("grid");
const all = {};
// Values that change between visits (or within one). They're shown but left out
// of the fingerprint, so it stays the same across reloads. A section title here
// excludes the whole section.
const volatile = new Set([
  "Browser.Referrer", "Browser.History length",
  "Screen & window.Viewport", "Screen & window.Orientation",
  "Locale & time.Local time",
  "Network & power.Online", "Network & power.Connection type", "Network & power.Downlink (approx.)",
  "Network & power.Round-trip (approx.)", "Network & power.Battery", "Network & power.Charging",
  "Capabilities.Storage quota",
  "What the server sees",
]);

// Privacy ratings (from ratings.js). They never touch `all`, so the fingerprint is unaffected.
const STATUS = { R: "Red: exposes personal data", A: "Amber: could be tightened", G: "Green: fine as is" };
const ORDER = "GAR";
const ctx = { browser: navigator.brave ? "Brave" : browserName(navigator.userAgent), language: navigator.language };
const rated = [];

function badge(status, label) {
  const b = document.createElement("span");
  b.className = `rag rag-${status}`;
  b.textContent = status;
  b.title = STATUS[status];
  if (label) b.setAttribute("aria-label", label);
  return b;
}

// The note column for one value: why it got this rating, and how to fix it.
function ratedNote(res, tag = "dd") {
  const note = document.createElement(tag);
  note.className = `note note-${res.status}`;
  note.innerHTML = "<strong>Why:</strong> <span></span><br><strong>Fix:</strong> <span></span>";
  const [why, fix] = note.querySelectorAll("span");
  why.textContent = res.why; fix.textContent = res.fix;
  return note;
}

function section(title, rows) {
  const s = document.createElement("section");
  s.innerHTML = `<h2>${title}</h2>`;
  const dl = document.createElement("dl");
  let worst = "G";
  for (const [k, v] of Object.entries(rows)) {
    const val = v === undefined || v === null || v === "" ? "n/a" : String(v);
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = val;
    if (volatile.has(title) || volatile.has(`${title}.${k}`)) {
      dd.className = "volatile";
      dd.title = "Not in fingerprint (changes between visits)";
    } else {
      all[`${title}.${k}`] = val;
    }
    const res = rate(title, k, val, ctx);
    dt.prepend(badge(res.status, STATUS[res.status]));
    const note = ratedNote(res);
    rated.push({ title, label: k, status: res.status, dt });
    if (ORDER.indexOf(res.status) > ORDER.indexOf(worst)) worst = res.status;
    dl.append(dt, dd, note);
  }
  s.querySelector("h2").append(badge(worst, `Worst rating in this card: ${STATUS[worst]}`));
  s.append(dl);
  grid.append(s);
}

// Counts per status, plus a jump link to every Red row.
function scorecard() {
  const el = document.getElementById("score");
  const count = s => rated.filter(x => x.status === s).length;
  el.innerHTML = `<p class="counts"></p>`;
  for (const s of "RAG") {
    const c = document.createElement("span");
    c.append(badge(s), ` ${count(s)} ${STATUS[s].split(":")[0]}`);
    el.firstChild.append(c);
  }
  const reds = rated.filter(x => x.status === "R");
  if (!reds.length) return;
  const h = document.createElement("h2"); h.textContent = "Top fixes";
  const ul = document.createElement("ul");
  for (const x of reds) {
    const a = document.createElement("button");
    a.type = "button"; a.className = "jump";
    a.textContent = `${x.title}: ${x.label}`;
    a.onclick = () => {
      x.dt.scrollIntoView({ behavior: "smooth", block: "center" });
      x.dt.classList.remove("flash"); void x.dt.offsetWidth; x.dt.classList.add("flash");
    };
    const li = document.createElement("li"); li.append(a);
    ul.append(li);
  }
  el.append(h, ul);
}

const mq = q => matchMedia(q).matches;
const yes = b => (b ? "yes" : "no");

function browserName(ua) {
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "a browser";
}

function webgl() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return {};
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      "Vendor": dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      "Renderer": dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      "WebGL version": gl.getParameter(gl.VERSION),
      "Max texture size": gl.getParameter(gl.MAX_TEXTURE_SIZE),
    };
  } catch { return {}; }
}

async function main() {
  const n = navigator, ua = n.userAgent;
  const tz = Intl.DateTimeFormat().resolvedOptions();
  const hour = new Date().getHours();
  const part = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = `${part}, ${browserName(ua)} user 👋`;

  const summary = [browserName(ua), n.userAgentData?.platform || n.platform,
    `${screen.width}×${screen.height}`, tz.timeZone, n.language,
    mq("(prefers-color-scheme: dark)") ? "dark mode" : "light mode"];
  document.getElementById("summary").innerHTML = summary.map(s => `<span class="chip">${s}</span>`).join("");

  section("Browser", {
    "User agent": ua,
    "Vendor": n.vendor,
    "Platform": n.platform,
    "Cookies enabled": yes(n.cookieEnabled),
    "Do Not Track": n.doNotTrack,
    "Global Privacy Control": n.globalPrivacyControl === undefined ? "n/a" : yes(n.globalPrivacyControl),
    "PDF viewer": yes(n.pdfViewerEnabled),
    "Automated (webdriver)": yes(n.webdriver),
    "Referrer": document.referrer,
    "History length": history.length,
  });

  if (n.userAgentData) {
    const hi = await n.userAgentData.getHighEntropyValues(
      ["architecture", "bitness", "model", "platformVersion", "fullVersionList"]).catch(() => ({}));
    section("User-Agent Client Hints", {
      "Brands": n.userAgentData.brands.map(b => `${b.brand} ${b.version}`).join(", "),
      "Mobile": yes(n.userAgentData.mobile),
      "Platform": n.userAgentData.platform,
      "Platform version": hi.platformVersion,
      "Architecture": hi.architecture,
      "Bitness": hi.bitness,
      "Model": hi.model,
      "Full versions": hi.fullVersionList?.map(b => `${b.brand} ${b.version}`).join(", "),
    });
  }

  section("Screen & window", {
    "Screen": `${screen.width} × ${screen.height}`,
    "Available": `${screen.availWidth} × ${screen.availHeight}`,
    "Viewport": `${innerWidth} × ${innerHeight}`,
    "Device pixel ratio": devicePixelRatio,
    "Color depth": `${screen.colorDepth}-bit`,
    "Orientation": screen.orientation?.type,
    "Touch points": n.maxTouchPoints,
    "Pointer": mq("(pointer: fine)") ? "fine (mouse)" : mq("(pointer: coarse)") ? "coarse (touch)" : "none",
    "HDR": yes(mq("(dynamic-range: high)")),
  });

  section("Locale & time", {
    "Language": n.language,
    "Languages": n.languages?.join(", "),
    "Time zone": tz.timeZone,
    "UTC offset": `${-new Date().getTimezoneOffset() / 60} h`,
    "Locale": tz.locale,
    "Calendar": tz.calendar,
    "Numbering": tz.numberingSystem,
    "Local time": new Date().toString(),
    "Number format": (1234567.89).toLocaleString(),
  });

  section("Hardware", {
    "CPU threads": n.hardwareConcurrency,
    "Memory (approx.)": n.deviceMemory ? `${n.deviceMemory} GB` : "n/a",
    ...webgl(),
  });

  let battery = {};
  try {
    const b = await n.getBattery();
    battery = { "Battery": `${Math.round(b.level * 100)}%`, "Charging": yes(b.charging) };
  } catch {}
  const c = n.connection || {};
  section("Network & power", {
    "Online": yes(n.onLine),
    "Connection type": c.effectiveType,
    "Downlink (approx.)": c.downlink ? `${c.downlink} Mbps` : "n/a",
    "Round-trip (approx.)": c.rtt ? `${c.rtt} ms` : "n/a",
    "Data saver": c.saveData === undefined ? "n/a" : yes(c.saveData),
    ...battery,
  });

  section("Preferences", {
    "Color scheme": mq("(prefers-color-scheme: dark)") ? "dark" : "light",
    "Reduced motion": yes(mq("(prefers-reduced-motion: reduce)")),
    "Increased contrast": yes(mq("(prefers-contrast: more)")),
    "Forced colors": yes(mq("(forced-colors: active)")),
    "Reduced transparency": yes(mq("(prefers-reduced-transparency: reduce)")),
  });

  section("Capabilities", {
    "Service workers": yes("serviceWorker" in n),
    "WebAssembly": yes(typeof WebAssembly === "object"),
    "WebGPU": yes("gpu" in n),
    "Bluetooth API": yes("bluetooth" in n),
    "USB API": yes("usb" in n),
    "Media devices": n.mediaDevices ? Object.entries((await n.mediaDevices.enumerateDevices().catch(() => []))
      .reduce((acc, d) => (acc[d.kind] = (acc[d.kind] || 0) + 1, acc), {}))
      .map(([k, v]) => `${v} ${k}`).join(", ") : "n/a",
    "Storage quota": await n.storage?.estimate?.().then(e => `${(e.quota / 1e9).toFixed(1)} GB`).catch(() => "n/a"),
  });

  try {
    const r = await fetch("/api/request").then(r => r.json());
    section("What the server sees", {
      "Your IP": r.remoteAddress,
      "Port": r.remotePort,
      "HTTP version": r.httpVersion,
      ...Object.fromEntries(Object.entries(r.headers).map(([k, v]) => [k, v])),
    });
  } catch {
    section("What the server sees", { "Error": "Could not reach /api/request" });
  }

  scorecard();

  const bytes = new TextEncoder().encode(JSON.stringify(all));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  document.getElementById("fp").textContent =
    [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  const fpLine = document.getElementById("fp-line");
  fpLine.after(ratedNote(rate("Fingerprint", "Hash", "", ctx), "p"));
}
main();
