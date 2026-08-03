# Changelog

All notable changes to **KHackBar** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0] — 2026-08-03

A major release: a full Burp-style **Intruder** (Sniper & Cluster Bomb) with
concurrency, cookie injection, response-length outlier detection, CSRF PoC
generation, reliable POST auto-capture, and a larger, more readable UI.


### Added
- **Intruder — Sniper & Cluster Bomb.** A new Intruder section under the FUZZER tab
  brings Burp-style multi-position attacks to `POST` (and `GET`) requests.
  - Position markers use the Burp syntax **`§value§`** — wrap each injection point,
    then click **Detect positions** to generate the payload inputs.
  - **Sniper** — one payload set; each position is fuzzed one at a time while the
    others keep their base value (`requests = positions × payloads`).
  - **Cluster Bomb** — one payload set per position; every combination is tried,
    i.e. the cartesian product (`requests = set₁ × set₂ × …`).
  - Method selector (`POST` / `GET`), `Content-Type` selector
    (form-urlencoded / JSON / multipart), and an optional **URL-encode payloads** toggle.
  - **Add § position** button — select text in the URL or body and click to wrap
    it in `§§` (Burp's "Add §"); with no selection it drops a `§STRING§` placeholder
    to type over. A **Clear §** button strips all markers.
  - **Wordlist picker** on every payload set — load any built-in preset (directory/
    file, SQLi, XSS, LFI, NoSQL, SSTI, OSCI, SSRF, Blind SQLi) with one click.
  - **Cookie injection** — a Cookie header field (with `§§` positions and a
    **Load tab cookies** button) lets you fuzz cookie values alongside URL/body in
    the same payload vector. Because `fetch()` cannot set the forbidden `Cookie`
    header, each request installs a temporary `declarativeNetRequest` rule to set
    the header for that exact URL, then removes it — the target receives the
    injected cookie verbatim and your real cookie jar is never modified.
  - **Load captured POST** button — pulls the last request grabbed by the v1.8
    POST auto-capture straight into the Intruder (URL, body, content-type), so a
    login you just submitted is fuzzable in one click.
  - Live results showing HTTP status, status text, and response length per request.
  - **Concurrent execution (speed).** A configurable **Threads** control (1–50,
    default 10) runs many requests in parallel via a worker pool — closing the
    speed gap with Burp instead of the old one-at-a-time-with-300ms-pause loop.
    An optional **Delay (ms)** throttles per request when needed, and the status
    line shows live throughput (req/s) and total time. Rows are pre-created in
    request order so display order stays stable regardless of which worker
    finishes first. Cookie-injection runs fall back to sequential (1 thread)
    because the per-request Cookie header rule can't be shared safely.
  - **Generate CSRF PoC** (Burp-style) — one click turns the Intruder's URL + body
    + method + content-type into a self-submitting HTML page. Form-urlencoded and
    multipart requests become an auto-submitting `<form>` (values are decoded so
    the browser re-encodes them identically); JSON/raw bodies become a credentialed
    `fetch()` PoC with a CORS caveat noted inline. Copy, download `.html`, or open
    it in a new tab.
  - **Larger, readable Intruder fields** — all FUZZER-panel text, dropdowns, buttons,
    labels and helper text are now 15px, with the Request body at 16px, plus the POST
    section's content-type dropdown and buttons at 15px — comfortable on large /
    high-DPI screens.
  - **Response-length outlier highlighting** — on completion the Intruder finds
    the most common response length (the mode) and highlights every response that
    differs, with a `⭐ differs (±N bytes)` marker and a summary line. This is the
    Burp trick for username enumeration / login checks: the failures are byte-for-
    byte identical, so the valid case stands out instantly. **Sort by length /
    status / original order** buttons re-order the results to surface it fast.
- **`fuzz_post_request` background handler.** Intruder requests are routed through
  the background service worker (like `execute_post`) so cross-origin targets are
  reached reliably via the extension's `host_permissions`.

### Fixed
- **POST auto-capture now works reliably.** The webRequest-based capture could
  miss logins entirely because an MV3 service worker sleeps after ~30s and its
  observational `webRequest` listeners don't reliably run while it's stopped
  (and the guards also read module state that wasn't initialised yet on wake).
  Capture is now primarily done by **in-page content scripts** (`capture-content.js`
  in the isolated world for native `<form>` submissions; `capture-main.js` in the
  MAIN world hooking `fetch`/`XMLHttpRequest` for AJAX/SPA logins), which report
  via `chrome.runtime.sendMessage` — a message that itself wakes the worker, so
  nothing is dropped. The webRequest path is kept as a secondary source, hardened
  to capture unconditionally and defer the enabled/active-tab decision to
  `onSendHeaders`.
- Capture is **auto-enabled while the KHackBar panel is open**, so logging in on
  the active tab fills the POST fields automatically (still toggleable off).

### Security / Safety
- Intruder honours the existing **scope guard** — attacks only run against
  in-scope, authorized targets.
- Added a **5,000-request safety cap** to prevent runaway combinatorial blasts,
  plus a per-request delay, a **Stop** button (AbortController), and **Clear**.

---

## [1.8] — 2026-08-02

### Added
- **POST Capture (Burp-style auto-fill).** Toggle *Auto-capture POST from active tab*
  to observe the active tab's POST requests (form submissions and fetch/XHR) via the
  read-only `webRequest` API and auto-fill the URL, POST data, and content-type.
  The last capture is saved and restorable via **Load last capture**.
- **Load default payloads** dropdown for the Fuzzer — ready-made wordlists for
  directory/file fuzzing, SQLi, XSS, LFI, NoSQL, SSTI, OSCI, SSRF, and Blind SQLi.
- **Column-Count-Aware UNION Generator.** The UNION tab builds matching
  `UNION SELECT` payloads from a supplied column count, with per-column text/numeric
  marking and raw-function column overrides (e.g. `2:database(),3:@@version`).

### Changed
- **Rebuilt WAF-Bypass panel** — techniques now wrap/transform the selected text in
  the URL box (comment injection, keyword bypass, concat bypass, whitespace/encoding,
  case/numeric, one-shot extraction) instead of inserting fixed strings.
- **Corrected PostgreSQL DIOS** — replaced the mis-ported MySQL `COUNT()`/`RAND()`
  duplicate-key trick with genuine Postgres error-based extraction via
  `CAST(... AS int)` type-cast errors, so MySQL DIOS, PostgreSQL DIOS, and LocDIOS
  are now meaningfully distinct techniques.

### Fixed
- Fuzz requests are now routed through the background service worker, fixing silent
  failures against cross-origin targets; response length is shown alongside status.
- The Fuzzer target URL now accepts a bare `FUZZ` marker (ffuf-style) in addition to
  `[FUZZ]` — no more silent rejection for URLs without brackets.
- Category menus (including WAF) could silently fail to open on click due to a
  toggle state-tracking bug; every menu now opens/closes reliably.

---

## [1.3] — 2026-05-15

### Added
- Initial public release with the Pro feature set: right-click context menu,
  advanced payload library (SQLi, XSS, LFI, SSRF, SSTI, NoSQL, OSCI), custom header
  injection via `declarativeNetRequest`, interactive cookie editor, versatile POST
  execution, encoders/decoders, scope enforcement, and audit logging — all in a
  side-panel, Red Team-themed UI on Manifest V3.

[2.0]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v2.0
[1.8]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v1.8
[1.3]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v1.3
