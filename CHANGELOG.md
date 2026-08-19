# Changelog

All notable changes to **KHackBar** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3] — 2026-08-19

A Fuzzer/Intruder usability release: two new ways to build payload sets
(numeric ranges and wordlist files), reliability against rate-limited targets,
directional result sorting, encoders that follow your cursor, and clearer
controls.

### Added
- **Numbers payload generator (Intruder).** Every payload set now has a
  Burp-style **Numbers** row — `from → to  step` with a **Generate** button
  that fills the box with the numeric sequence, one per line. Counts up or down
  and supports decimal steps; capped at 10,000 numbers to keep the UI
  responsive. Ideal for ID/IP sweeps (e.g. `1 → 255` for an SSRF back-end
  scan).
- **Load wordlist from file (Intruder).** A **📁 Load file** button on each
  payload set reads a local wordlist (`.txt`, `.lst`, SecLists, rockyou-style,
  etc.) entirely client-side via `FileReader` — nothing is uploaded — and drops
  each non-empty line into the box. Strips a UTF-8 BOM, blank lines, and
  trailing whitespace; capped at 20 MB / 200,000 lines with a visible count.
- **Clear list button (Intruder).** A **✕ Clear list** button on each payload
  set empties just that payload box (positions, URL, and body are kept), so a
  pasted or loaded list can be swapped without hand-deleting it.

### Changed
- **Result sorting now toggles ascending/descending.** Clicking **Sort by
  length** or **Sort by status** again reverses the direction (a status line
  shows `↑ ascending` / `↓ descending`). Previously sorting was
  descending-only, which buried *shorter* outliers (a short error/redirect that
  marks the interesting response) at the bottom off-screen — making sort look
  like it "did nothing". Ties fall back to original request order for
  stability.
- **Encoders/decoders act on the last-focused field.** The URL/Hex/Base64/
  HTML/Unicode encode & decode buttons now transform the selection (or whole
  value) in whichever editable field you last used — the URL box, the POST
  box, or any Intruder field (URL, request body, cookie) — instead of always
  targeting the URL box. This makes **D-URL** and friends work on a captured
  Intruder request body, which previously left it untouched.
- **Bottom Intruder "Clear" renamed to "Clear Results"** to distinguish it from
  the per-payload **✕ Clear list** and the **Clear §** position control.

### Fixed
- **Intruder requests no longer fail permanently on transient network errors.**
  A burst of concurrent requests can trip a target's rate-limit / connection
  cap (common on PortSwigger labs), which surfaces as a `Failed to fetch`
  `TypeError` rather than a real HTTP response. The background engine now
  retries these with exponential backoff and jitter (up to 6 attempts,
  ≈0.25s → 4s, capped at 5s) so the requests drain through instead of showing
  `[Error: Failed to fetch]`. Real HTTP responses (any status) and genuine
  timeouts are never retried.

---

## [2.2] — 2026-08-18

A hardening and cleanup release: fixes a privileged-context XSS risk, an
unconditional POST-capture privacy leak, and a settings-import
prototype-pollution gap; adds a real scope-enforcement on/off toggle and the
project's first test suite; trims an unused permission and dead code — plus
POST → Tab navigation, a GET-aware CSRF PoC generator, and a decluttered
Fuzzer panel.

### Added
- **POST → Tab.** A new button next to **POST** submits the request as a real
  navigation in the active tab instead of a silent background fetch — same
  technique as the Intruder's CSRF PoC (a self-submitting form for
  urlencoded/multipart bodies, a credentialed `fetch()` for JSON), opened via
  `chrome.tabs.update` on the active tab so redirects, session/cookie changes,
  and the resulting page are all actually visible. The original **POST**
  button is unchanged and still there for silent/background testing.
- **FUZZER panel mode switch.** The URL Fuzzer and Intruder no longer sit
  stacked in the same scroll — a **Fuzzer tool** dropdown at the top of the
  FUZZER tab shows one at a time (Intruder by default).
- **Enforce scope toggle.** The Settings panel's Scope section gets a real
  on/off checkbox (**Enforce scope**) instead of enforcement being
  permanently implied by whatever pattern happens to be saved. `getSavedScope`
  now returns `''` (allow-all) whenever enforcement is off, so every existing
  caller — EXECUTE, POST, Fuzzer, Intruder — honours the toggle automatically.
  Defaults to **on** when unset, so upgrading from an earlier version never
  silently drops scope protection, and the saved pattern text is left
  untouched when you turn enforcement off, so switching it back on later
  doesn't require retyping it.

### Added — tooling
- **First test suite.** A zero-dependency suite (`node:test`, no external
  packages — run with `npm test`) covering `scope.js`'s `checkScope` domain
  matching (exact host, `*.domain` wildcard, the `evil-example.com` vs
  `example.com` subdomain-boundary case, case-insensitivity, URL-form
  patterns, invalid target URLs) and `fuzzer.js`'s `§value§` marker parser
  (`parseMarked` / `fillTemplate`): multi-position parsing, the shared
  URL/body/cookie index space, unmatched-marker fallback to literal text, and
  round-trip reconstruction. `parseMarked`/`fillTemplate` were hoisted out of
  `initIntruder`'s closure to module scope and exposed on
  `window.KHackBar.Fuzzer` to make this possible, with no behavior change —
  `initIntruder` resolves the identical functions via normal closure scoping.

### Changed
- **POST status now shows response length**, matching Fuzzer/Intruder results
  (`[+] POST response received (200, 1234 bytes).`) instead of status alone.

### Removed
- **Dead code.** Dropped two unused, unreferenced objects from `payloads.js`
  (`extractionHandlers`, `promptLogic`) and their exports — confirmed dead via
  a full-codebase reference search.
- **Unused `activeTab` permission.** The manifest's standing
  `host_permissions: ["<all_urls>"]` already covers every
  `chrome.scripting.executeScript` call the extension makes, so `activeTab`
  added nothing but review-surface noise. README's permissions table updated
  to match.

### Fixed
- **Generate CSRF PoC dropped every query param for GET requests.** The GET
  branch built a form with no fields, and a GET `<form>` submission replaces
  the action URL's query string with the form's own fields — so submitting
  the generated PoC silently stripped all query params (e.g. DVWA's CSRF
  challenge, `?password_new=...&password_conf=...`) instead of reproducing
  the request. Query params are now parsed into hidden inputs, same as the
  POST branch does for the body.

### Security / Safety
- **HTML-entity decoding could execute attacker HTML in the extension's
  privileged context.** The decoder used `div.innerHTML = str` on a `<div>`
  that was never attached to the document — but Chromium still loads/runs
  `<img src=x onerror=...>`-style handlers on detached nodes, so decoding
  attacker-controlled text (e.g. a captured request) could execute script with
  the extension's full permissions. Replaced with
  `DOMParser().parseFromString(str, 'text/html')`, which decodes entities
  without executing scripts or loading any resources.
- **POST auto-capture wrote to storage even while its own toggle was off.**
  The capture handler's `chrome.storage.local.set` call (and the relay to the
  open panel) ran unconditionally, so a request's URL/body/cookies could be
  persisted regardless of the *Auto-capture POST* checkbox — and the checkbox
  itself was silently forced back **on** every time the panel was reopened.
  Both the storage write and the relay now re-check `capture_post_enabled`
  first, and the checkbox reads (and respects) its saved state instead of
  overriding it.
- **Settings import had no shape validation or prototype-pollution guard.**
  Importing a settings JSON file merged it into `chrome.storage.local`
  directly, so a crafted file could plant unexpected keys — including
  `__proto__` / `constructor` / `prototype`, a prototype-pollution vector.
  Added per-key type validation and a dangerous-key guard; import now strips
  invalid or dangerous entries individually (reporting which ones) instead of
  trusting the file wholesale, and aborts cleanly if nothing valid remains.

---

## [2.1] — 2026-08-09

A major release. A full Burp-style **Intruder** (Sniper & Cluster Bomb) with
concurrency, cookie injection, response-length outlier detection, CSRF PoC
generation, reliable POST auto-capture, and a larger, more readable UI — plus a
payload-quality overhaul: **pure (context-free) payloads** across the SQLi tabs,
a **fingerprint-driven SSTI** panel, an **interactive cookie editor/injector**,
and a **Copy as sqlmap** export.


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

### Added — tooling
- **Encoders/decoders now work on the selection.** The encoder bar (URL, Hex,
  Base64, HTML, 2×URL, Unicode, Reverse and their decoders) transforms the
  *selected* text in the URL box instead of the whole box — so you can, e.g.,
  Unicode-escape only the injection string. The result stays selected, so the
  matching **D-*** button decodes it straight back; with nothing selected it
  falls back to the whole box (the old behaviour), with a status hint either way.
- **SSTI tab rebuilt into a fingerprint-driven panel.** New `ssti.js` renderer:
  detection probes (`{{7*7}}`, `${7*7}`, `<%= 7*7 %>`, `#{7*7}`, `@(7*7)`, a
  polyglot), a **fingerprint reference** mapping the response to the engine
  (e.g. `{{7*'7'}}` → `7777777` = Jinja2 vs `49` = Twig; `${7*7}` = FreeMarker/EL;
  `<%= 7*7 %>` = ERB/EJS; `@(7*7)` = Razor), and per-engine exploitation sections
  (Jinja2, Twig, FreeMarker, Velocity, Smarty, ERB, Mako, Node) for config-read
  and RCE.
- **Blind SQLi tab rebuilt as pure payloads.** Dropped the `1'`/`'`/`-- -`
  wrappers and the duplicate `SLEEP(5/10/15)` / `BENCHMARK` variants for 15 pure
  building blocks: boolean, time-based (MySQL `SLEEP`, PostgreSQL `pg_sleep`,
  MSSQL `WAITFOR`), boolean data-extraction, and conditional time-based extraction.
- **PostgreSQL / LocalDIOS / MsSQL / ERROR tabs rebuilt as pure payloads.**
  Dropped the `'`/`1'` prefixes and `-- -` comments across all four so each entry
  is a pure building block you add context to: PostgreSQL → `CAST(… AS int)` and
  `::int` cast-error forms; LocalDIOS → bare `LOAD_FILE(…)` (UNION column), plus a
  hex-path and error-based form; MsSQL → boolean/UNION/error/time/stacked blocks
  with a single `ORDER BY 1` probe (no auth-bypass quote strings); ERROR → bare
  quote/backslash probes, one each of `ORDER BY`/`GROUP BY`/`HAVING`, and pure
  MySQL/MSSQL/PostgreSQL error-extraction expressions. Redundant near-duplicates
  removed throughout.
- **MySQL DIOS rebuilt as pure, diverse payloads.** The MySqlDIOS tab dropped the
  12 near-identical `' OR (COUNT/RAND…)-- -` strings for 19 **pure** expressions
  (no leading quote, no trailing comment) across four real techniques: true DIOS
  one-shot accumulator, `GROUP_CONCAT` schema/table/column/credential enumeration,
  scalar server-info subqueries, error-based `extractvalue`/`updatexml`, and the
  `COUNT()/RAND() GROUP BY` error trick — drop each into your own context.
- **More MySQL comment-injection WAF bypasses.** The WAF tab's *Comment Injection
  (MySQL)* group grew from 5 to 18 techniques: extra versioned comments
  (`/*!30000…*/`, `/*!00000…*/`, `/*!99999…*/`), spaced (`/*! … */`), nested
  (`/*!/*!…*/*/`), before/after-only `/**/`, empty versioned comments around the
  selection, and trailing `-- -` / `%23` / `%00` terminators.
- **Pure UNION SELECT variant.** The UNION generator now offers a plain
  `UNION SELECT 1,2,3,4` (no context prefix like `')`, no trailing comment) as
  the first option, for manual column probing where you supply the surrounding
  context yourself. The column-count / text-column / overrides logic still applies.
- **WAFuNiON is now a generator too.** The WAF UNION tab was a fixed payload
  list; it's now the same column-count generator producing **pure WAF-bypass**
  UNION SELECT variants (inline `/**/` comments, `/*!…*/` and `/*!50000…*/`
  versioned comments, `%0a`/`%09` whitespace, `UNION(SELECT …)`, `UNION ALL/DISTINCT`,
  mixed case) — all with no context prefix and no trailing comment, so you add
  your own context as the target needs.
- **Interactive Cookie editor / injector.** The COOKIES tab is no longer view-only:
  each cookie's value is editable with **Save** (writes the live cookie via
  `chrome.cookies.set`, preserving path/secure/httpOnly/sameSite) and **Delete**,
  plus an **Add / inject cookie** form — so you can drop a payload (e.g.
  `' OR 1=1-- -`) straight into a session/role cookie and browse with it.
- **Copy as sqlmap command.** The POST section can turn the current URL + POST
  data + content-type + the live cookies for that host into a ready-to-run
  `sqlmap -u "…" --data="…" --cookie="…" --batch --level=2 --risk=2` command
  (JSON bodies add the matching `--headers`). Copies to clipboard and shows the
  command for manual copy. The same request can be pulled into the Intruder via
  **Load captured POST** — it's the identical POST data.

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

[2.2]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v2.2
[2.1]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v2.1
[1.8]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v1.8
[1.3]: https://github.com/KhitMinnyo/KHackBar/releases/tag/v1.3
