// Privacy rating for each row on the page: G = fine as is, A = could be tightened,
// R = exposes personal data. rate(title, label, value, ctx) returns
// { status, why, fix }, with fix already picked for ctx.browser.
// A classic script loaded before app.js; also exported for the Node tests.
const rate = (() => {
  const r = (status, why, fix) => ({ status, why, fix });
  const ok = why => r("G", why, "Nothing to do.");
  const na = v => v === "n/a";

  // Fixes that differ per browser. Keys match ctx.browser; "default" covers the rest.
  const FIX = {
    resist: {
      Firefox: "Set privacy.resistFingerprinting to true in about:config, or use Tor Browser.",
      Brave: "Shields → Fingerprinting blocking: Strict.",
      Safari: "Settings → Advanced → Use advanced tracking and fingerprinting protection: in all browsing.",
      default: "Use a browser with fingerprinting protection, such as Brave, Firefox with resistFingerprinting, or Tor Browser.",
    },
    cookies: {
      Chrome: "Settings → Privacy and security → Third-party cookies → Block third-party cookies.",
      "Microsoft Edge": "Settings → Cookies and site permissions → Manage and delete cookies and site data → Block third-party cookies.",
      Firefox: "Settings → Privacy & Security → Enhanced Tracking Protection: Strict.",
      Safari: "Settings → Privacy → Prevent cross-site tracking.",
      Brave: "Shields → Block cookies: Cross-site.",
      default: "Block third-party cookies in your browser's privacy settings.",
    },
    gpc: {
      Firefox: "Settings → Privacy & Security → Website Privacy Preferences → Tell websites not to sell or share my data.",
      Brave: "Brave sends GPC by default; check brave://settings/privacy.",
      default: "This browser has no built-in switch. An extension such as Privacy Badger or DuckDuckGo Privacy Essentials sends GPC; Firefox and Brave support it natively.",
    },
    hints: {
      Brave: "Brave already trims these; keep Shields on.",
      default: "Only Chromium browsers (Chrome, Edge, Opera) send these, and only when a site asks. Firefox and Safari don't; Brave trims them.",
    },
    chromiumOnly: {
      Firefox: "Firefox doesn't expose this.",
      Safari: "Safari doesn't expose this.",
      Brave: "Brave limits this; keep Shields on.",
      default: "Only Chromium browsers expose this without asking. Firefox, Safari and Brave don't.",
    },
    fonts: {
      Firefox: "Set privacy.resistFingerprinting to true in about:config, which limits the fonts sites can see to a standard set.",
      Brave: "Shields → Fingerprinting blocking: Strict.",
      Safari: "Safari already limits web-visible fonts to a standard set; update Safari and keep advanced fingerprinting protection on.",
      default: "Use a browser with fingerprinting protection (Brave, Firefox with resistFingerprinting, or Tor Browser), which limits the fonts sites can see.",
    },
    webrtc: {
      Firefox: "Set media.peerconnection.ice.default_address_only to true in about:config, or media.peerconnection.enabled to false (this breaks video calls).",
      Brave: "Settings → Privacy and security → WebRTC IP handling policy: Disable non-proxied UDP.",
      Chrome: "Install uBlock Origin and turn on Settings → Privacy → Prevent WebRTC from leaking local IP addresses.",
      "Microsoft Edge": "Install uBlock Origin and turn on Settings → Privacy → Prevent WebRTC from leaking local IP addresses.",
      default: "Turn off WebRTC, or restrict it to the proxy, in your browser or with a privacy extension such as uBlock Origin.",
    },
    adblock: {
      Brave: "Shields → Trackers & ads blocking: Aggressive.",
      Firefox: "Settings → Privacy & Security → Enhanced Tracking Protection: Strict, and add uBlock Origin.",
      Safari: "Add a content blocker from the App Store, and keep Prevent cross-site tracking on.",
      default: "Install uBlock Origin, or use a browser with built-in blocking such as Brave.",
    },
    storage: {
      Firefox: "Settings → Privacy & Security → Enhanced Tracking Protection: Strict (turns on Total Cookie Protection), and tick Delete cookies and site data when Firefox is closed.",
      Chrome: "Settings → Privacy and security → Third-party cookies: Block, and under Site settings → Cookies turn on Clear cookies and site data when you close all windows.",
      "Microsoft Edge": "Settings → Cookies and site permissions → Manage and delete cookies and site data: turn on Block third-party cookies and Clear on exit.",
      Safari: "Settings → Privacy → Prevent cross-site tracking, and clear website data now and then.",
      Brave: "Shields → Block cookies: Cross-site, and Settings → Cookies and other site data → Clear cookies and site data when you close all windows.",
      default: "Block third-party cookies, and clear site data when you close the browser.",
    },
    vpn: { default: "Use a VPN, Tor Browser, or a relay such as iCloud Private Relay, so sites see the relay's address instead of yours." },
    referrer: {
      Firefox: "Firefox trims cross-site referrers to the origin by default; to send only the origin everywhere, set network.http.referer.XOriginTrimmingPolicy to 2 in about:config.",
      default: "Modern browsers trim cross-site referrers to the origin by default, but a site can override that. A tracker-blocking extension or Brave strips them.",
    },
  };
  const pick = (fix, browser) => fix[browser] || fix.default;

  const COMMON_SCREENS = new Set([
    "1920 × 1080", "1366 × 768", "1536 × 864", "1440 × 900", "1280 × 720", "2560 × 1440",
    "1600 × 900", "1280 × 800", "1280 × 1024", "1680 × 1050", "3840 × 2160",
    "390 × 844", "393 × 852", "414 × 896", "375 × 667", "360 × 800", "412 × 915",
  ]);
  const GENERIC_GPU = /^(n\/a|Mozilla|WebKit|WebKit WebGL|Apple GPU|Apple Inc\.|Brave)$/;
  const lang = s => String(s).split("-")[0].toLowerCase();

  // A referrer or referer header leaks where you came from when it carries a path or query.
  const referrer = v => {
    if (na(v)) return ok("No previous page is shared.");
    try {
      const u = new URL(v);
      if (u.pathname === "/" && !u.search) return ok("Only the site name is shared, not the page.");
    } catch {}
    return r("R", "The full address of the page you came from is shared, including any path or search terms.", "referrer");
  };
  const fingerprint = why => r("A", why, "resist");
  const hint = why => r("A", why, "hints");
  // Accessibility settings: rare ones narrow you down, but they matter more than privacy.
  const rarePref = v => v === "yes"
    ? r("A", "Few people turn this on, so it narrows you down.", { default: "Keep it if you need it. Your accessibility matters more than this small signal." })
    : ok("The default, shared by most people.");
  const carriesIp = () => r("R", "This header carries your IP address on to the site.", "vpn");

  const rules = {
    "Browser.User agent": () => fingerprint("Shows your exact browser version and operating system, a large part of your fingerprint."),
    "Browser.Vendor": () => ok("Shared by everyone using the same browser engine."),
    "Browser.Platform": () => ok("A broad value shared by most people on the same OS."),
    "Browser.Cookies enabled": v => v === "yes"
      ? r("A", "Cookies are needed for logins, but third-party cookies let trackers follow you across sites.", "cookies")
      : ok("Cookies are off. Expect many sites to break."),
    "Browser.Do Not Track": v => v === "1"
      ? r("A", "Do Not Track is retired and ignored by most sites, and having it on makes you rarer. Global Privacy Control replaced it.", "gpc")
      : ok("Do Not Track is retired; leaving it off is fine."),
    "Browser.Global Privacy Control": v => v === "yes"
      ? ok("You're telling sites not to sell or share your data, and some laws (such as California's) require them to listen.")
      : r("A", "Global Privacy Control is off. With it on, sites in some jurisdictions must not sell or share your data.", "gpc"),
    "Browser.PDF viewer": () => ok("Shared by almost every desktop browser."),
    "Browser.Automated (webdriver)": v => v === "yes"
      ? r("A", "Sites can see this browser is under automation and may treat it differently.", { default: "Expected while testing; normal browsing shows no." })
      : ok("A normal, non-automated browser."),
    "Browser.Referrer": referrer,
    "Browser.History length": () => ok("Only counts pages in this tab, not which pages they were."),

    "User-Agent Client Hints.Brands": () => ok("Low-detail hint sent by every Chromium browser."),
    "User-Agent Client Hints.Mobile": () => ok("Low-detail hint sent by every Chromium browser."),
    "User-Agent Client Hints.Platform": () => ok("Low-detail hint sent by every Chromium browser."),
    "User-Agent Client Hints.Platform version": v => na(v) ? ok("Not shared.") : hint("Your exact OS version, handed over because the site asked."),
    "User-Agent Client Hints.Architecture": v => na(v) ? ok("Not shared.") : hint("Your CPU architecture, handed over because the site asked."),
    "User-Agent Client Hints.Bitness": v => na(v) ? ok("Not shared.") : hint("Your OS bitness, handed over because the site asked."),
    "User-Agent Client Hints.Model": v => na(v) ? ok("No device model is shared.") : hint("Your exact device model, handed over because the site asked."),
    "User-Agent Client Hints.Full versions": v => na(v) ? ok("Not shared.") : hint("Your full browser build number, handed over because the site asked."),

    "Screen & window.Screen": v => COMMON_SCREENS.has(v) ? ok("A very common resolution, so it says little about you.") : fingerprint("An uncommon resolution narrows down who you are."),
    "Screen & window.Available": () => fingerprint("The gap to the full screen reveals your taskbar or dock size and position."),
    "Screen & window.Viewport": () => ok("Changes whenever you resize the window."),
    "Screen & window.Device pixel ratio": v => ["1", "2", "3"].includes(v) ? ok("A common pixel ratio.") : fingerprint("A fractional ratio reveals your display scaling setting."),
    "Screen & window.Color depth": () => ok("Almost every screen reports the same value."),
    "Screen & window.Orientation": () => ok("Changes as you rotate the device."),
    "Screen & window.Touch points": () => ok("Says only whether you have a touch screen."),
    "Screen & window.Pointer": () => ok("Says only mouse or touch."),
    "Screen & window.HDR": v => v === "yes" ? fingerprint("HDR displays are still uncommon, so this narrows you down.") : ok("Most screens report no."),

    "Locale & time.Language": () => ok("Needed to show pages in your language."),
    "Locale & time.Languages": v => v.split(", ").length > 1
      ? fingerprint("Your full list of languages is unusual and can hint at your background.")
      : ok("A single language is common."),
    "Locale & time.Time zone": () => r("A", "Reveals your rough location, and shows when a VPN's location doesn't match.", "resist"),
    "Locale & time.UTC offset": () => ok("Repeats what the time zone already says."),
    "Locale & time.Locale": (v, ctx) => lang(v) === lang(ctx.language) ? ok("Matches your language.") : fingerprint("Your system locale differs from your browser language, which is rare."),
    "Locale & time.Calendar": v => v === "gregory" ? ok("The most common calendar.") : fingerprint("A less common calendar narrows you down."),
    "Locale & time.Numbering": v => v === "latn" ? ok("The most common numbering system.") : fingerprint("A less common numbering system narrows you down."),
    "Locale & time.Local time": () => ok("Changes every second."),
    "Locale & time.Number format": () => ok("Follows your language."),

    "Hardware.CPU threads": v => Number(v) > 8 ? fingerprint("A high thread count is less common and narrows you down.") : ok("A common thread count."),
    "Hardware.Memory (approx.)": v => parseFloat(v) > 8 ? fingerprint("A large memory value is less common and narrows you down.") : ok("Rounded to a common value."),
    "Hardware.Vendor": v => GENERIC_GPU.test(v) ? ok("A generic value, hiding your graphics hardware.") : fingerprint("Names your graphics card's maker."),
    "Hardware.Renderer": v => GENERIC_GPU.test(v) ? ok("A generic value, hiding your graphics hardware.") : fingerprint("Names your exact graphics card and driver, a strong fingerprint signal."),
    "Hardware.WebGL version": () => ok("The same for everyone on this browser."),
    "Hardware.Max texture size": () => ok("Shared by most graphics cards."),

    "Network & power.Online": () => ok("Says only whether you're online."),
    "Network & power.Connection type": v => na(v) ? ok("Not shared.") : r("A", "Shares your connection quality without asking.", "chromiumOnly"),
    "Network & power.Downlink (approx.)": v => na(v) ? ok("Not shared.") : r("A", "Shares your connection speed without asking.", "chromiumOnly"),
    "Network & power.Round-trip (approx.)": v => na(v) ? ok("Not shared.") : r("A", "Shares your connection latency without asking.", "chromiumOnly"),
    "Network & power.Data saver": () => ok("A single on/off preference."),
    "Network & power.Battery": v => na(v) ? ok("Not shared.") : r("A", "Battery level has been used to link visits across sites over short periods.", "chromiumOnly"),
    "Network & power.Charging": v => na(v) ? ok("Not shared.") : r("A", "Charging state adds to the battery signal above.", "chromiumOnly"),

    "Preferences.Color scheme": () => ok("Light and dark are both common."),
    "Preferences.Reduced motion": v => rarePref(v),
    "Preferences.Increased contrast": v => rarePref(v),
    "Preferences.Forced colors": v => rarePref(v),
    "Preferences.Reduced transparency": v => rarePref(v),

    "Capabilities.Service workers": () => ok("Supported by every modern browser."),
    "Capabilities.WebAssembly": () => ok("Supported by every modern browser."),
    "Capabilities.WebGPU": v => v === "yes" ? fingerprint("WebGPU can reveal details about your graphics card.") : ok("Not available, so nothing more is revealed."),
    "Capabilities.Bluetooth API": () => ok("Present, but sites must ask before using it."),
    "Capabilities.USB API": () => ok("Present, but sites must ask before using it."),
    "Capabilities.Media devices": () => ok("Only counts are shared; names stay hidden until you grant camera or microphone access."),
    "Capabilities.Storage quota": v => na(v) ? ok("Not shared.") : r("A", "Storage size reflects your disk size and can reveal private browsing.", "resist"),

    "Capabilities.Storage APIs": v => v === "none"
      ? ok("Web storage is blocked, so sites can't keep an identifier on your device. Many sites will break.")
      : r("A", "Sites can keep an identifier in this storage, which lasts until you clear site data and can be used to recognise you again.", "storage"),

    "Advanced fingerprinting.Canvas": v => /^(noise added|blocked)$/.test(v)
      ? ok(v === "blocked" ? "This browser refuses canvas readback, so it can't be used to track you." : "This browser adds noise to canvas readback, so the result isn't a reliable ID.")
      : fingerprint("Sites draw hidden text and shapes and hash the result. Tiny differences from your graphics card, drivers and fonts make it a lasting ID that needs no cookies."),
    "Advanced fingerprinting.Audio": v => /^(randomized each time|blocked|n\/a)$/.test(v)
      ? ok(v === "n/a" ? "Not available, so nothing is revealed." : "This browser blocks or randomizes audio processing, so the result isn't a reliable ID.")
      : fingerprint("Sites render a silent sound and hash the output. Small differences in your audio stack make it a lasting ID."),
    "Advanced fingerprinting.Fonts": v => Number(/^(\d+) of/.exec(v)?.[1] ?? 0) <= 4
      ? ok("Few fonts are visible, which matches a browser that limits the font list.")
      : r("A", "Sites can tell which fonts are installed by measuring text. Your list of installed fonts is a highly unique signature.", "fonts"),
    "Advanced fingerprinting.DOM rects": v => v === "randomized each time"
      ? ok("This browser jitters layout measurements, so the result isn't a reliable ID.")
      : fingerprint("Sub-pixel layout measurements differ slightly between browser engines, systems and font settings, and sites can hash them."),
    "Advanced fingerprinting.WebRTC local IP": v => /^(n\/a|blocked|hidden \(mDNS\)|none found)$/.test(v)
      ? ok(v === "hidden (mDNS)"
        ? "Your local address is hidden behind a random .local name. This page doesn't contact a STUN server, so it can't check your public address behind a VPN."
        : "No local network address is exposed.")
      : r("R", "WebRTC hands out your local network address without asking, and sites can also use it to find your real public address behind a VPN. This page doesn't contact a STUN server, so it only checks the local address.", "webrtc"),
    "Advanced fingerprinting.Ad/tracker blocker": v => v === "detected"
      ? ok("A content blocker is hiding ad elements, so many trackers can't load. The blocker itself is slightly identifying, but the protection is worth it.")
      : r("A", "Nothing is hiding ad elements, so most ad and tracking scripts can run.", "adblock"),

    "What the server sees.Your IP": v => r("R",
      "Every site you visit sees this address. It reveals your internet provider and rough location, and links your visits across sites."
      + (/^(127\.|::1$|::ffff:127\.)/.test(v) ? " Here it's a local address because the app runs on this machine; a site on the internet sees your public one." : ""),
      "vpn"),
    "What the server sees.Port": () => ok("Picked at random for each connection."),
    "What the server sees.HTTP version": () => ok("The same for everyone on this browser."),

    "Fingerprint.Hash": () => fingerprint("Sites can combine the values above into a stable ID like this one, which survives clearing cookies. This page can't tell how unique yours is without comparing it with other visitors."),
  };

  // The server echoes request headers back, so those rows are rated by header name.
  const HIGH_ENTROPY_HINTS = /^sec-ch-ua-(platform-version|arch|bitness|model|full-version|full-version-list|wow64)$/;
  const headers = (name, v, ctx) => {
    if (name === "user-agent") return rules["Browser.User agent"]();
    if (HIGH_ENTROPY_HINTS.test(name)) return v === '""' ? ok("Not shared.") : hint("A detailed hint, handed over because the site asked.");
    if (name === "accept-language") return v.includes(",") ? fingerprint("Your full list of languages is unusual and can hint at your background.") : ok("A single language is common.");
    if (name === "referer") return referrer(v);
    if (name === "cookie") return r("A", "Cookies let this site recognise you. That's expected for sites you log in to, but clear them for sites you don't trust.", "cookies");
    if (name === "dnt") return rules["Browser.Do Not Track"](v);
    if (name === "sec-gpc") return v === "1" ? rules["Browser.Global Privacy Control"]("yes") : ok("Standard header.");
    if (/^(x-forwarded-for|x-real-ip|forwarded|via|true-client-ip|cf-connecting-ip)$/.test(name)) return carriesIp();
    return ok("A standard header every browser sends.");
  };

  return (title, label, value, ctx) => {
    const rule = rules[`${title}.${label}`];
    const res = rule ? rule(value, ctx)
      : title === "What the server sees" ? headers(label, value, ctx)
      : r("A", "No rating rule for this row yet.", { default: "Add a rule in ratings.js." });
    if (typeof res.fix === "string" && FIX[res.fix]) res.fix = FIX[res.fix];
    if (typeof res.fix === "object") res.fix = pick(res.fix, ctx.browser);
    return res;
  };
})();

if (typeof module !== "undefined") module.exports = { rate };
