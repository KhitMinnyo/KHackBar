# 🎯 KHackBar — The Ultimate Web Security Auditor's Sidekick

> **Built on Manifest V3** • Red Team Ready • Lightweight & Professional • **v1.8 Pro**

**KHackBar** is a modular, side-panel-based web security testing extension for Google Chrome. Designed for penetration testers, bug bounty hunters, and security researchers, it provides a comprehensive arsenal of payloads, encoders, request modifiers, and cookie manipulation tools — all within a sleek Red Team-themed interface. The extension follows a modular architecture where feature-specific logic is split into dedicated files, keeping the codebase maintainable and reducing the risk of large single-file bugs.

---

## 🔥 Key Features

### 📦 Advanced Payload Library
Categorized payloads for rapid injection testing across multiple attack vectors:

| Category | Description |
|----------|-------------|
| **SQLi** | Advanced DIOS & WAF bypass strings for database fingerprinting and exploitation |
| **XSS** | Cross-Site Scripting vectors (reflected, stored, DOM-based) |
| **LFI** | Local File Inclusion traversal sequences and wrappers |
| **SSRF** | Cloud metadata endpoints, protocol smuggling (Gopher / Dict) |
| **SSTI** | Server-Side Template Injection payloads (Jinja2, Twig, etc.) |
| **NoSQL** | NoSQL authentication bypass and injection vectors |
| **OSCI** | Operating System Command Injection payloads for RCE testing |

### 🧪 Custom Header Injection
Leverages the **`declarativeNetRequest`** API to:
- Bypass restrictive security headers (`Content-Security-Policy`, `X-Frame-Options`, etc.)
- Spoof request origins and `Referer` headers
- Inject custom headers on-the-fly for testing backend validation logic

### 🍪 Interactive Cookie Editor
View, edit, create, and delete cookies in real-time using the **`cookies`** API:
- Inspect all cookies for the current domain
- Modify cookie values, paths, expiration, and security flags
- Instantly apply changes to test session handling and authentication flows

### 🌐 Versatile POST Execution
Craft and send HTTP POST requests directly from the extension with support for:
- **JSON** (`application/json`)
- **URL-encoded** (`application/x-www-form-urlencoded`)
- **Multipart** (`multipart/form-data`)

### 🔐 Encoders & Decoders
Built-in encoding/decoding tools for quick payload transformation:
- **Hex** encode/decode
- **Base64** encode/decode
- **HTML Entity** encode/decode
- **Unicode** escape/unescape
- **URL** encode/decode

---

## 🆕 What's New in v1.8

### 🎣 POST Capture (Burp-style auto-fill)
Check **🔴 Auto-capture POST from active tab** below the POST fields, then just use the site normally (e.g. log in) — the exact request shows up automatically:
- Watches POST requests from the active tab only (form submissions and fetch/XHR calls), via read-only `webRequest` observation — it never blocks, delays, or modifies the real request
- Auto-fills the URL, POST data, and (where recognizable) the content-type dropdown
- The last capture is saved, so **Load last capture** can restore it even if the panel was closed when it happened
- Turn the toggle off when you don't need it — capture only runs while enabled

### 🛡️ Rebuilt WAF Bypass Panel
The **WAF-BYPASS** tab no longer just inserts fixed strings — it now wraps whatever text you select in the URL box:
- Select a keyword (e.g. `UNION SELECT`) and click a technique (`/*!{{SEL}}*/`, whitespace/encoding swaps, case randomizer, etc.) to wrap or transform it in place
- Grouped into Comment Injection, Keyword Bypass, Concat Bypass, Whitespace/Encoding, Case/Numeric, and One-Shot Extraction sections
- No selection? Wrap buttons insert a pre-selected `STRING` placeholder you can type straight over

### 🎯 Column-Count-Aware UNION Generator
The **UNION** tab is now a generator instead of a fixed `1,2,3...` list:
- Enter the column count you found (e.g. via an `ORDER BY` probe) and it builds matching `UNION SELECT` payloads
- Mark specific column positions as text/string instead of numeric (important for strict engines like PostgreSQL)
- Drop a raw extraction function into a specific column via **Column overrides** (e.g. `2:database(),3:@@version`)
- Generates variants for common injection contexts: numeric, `'`, `"`, `')`, `")`, `'))`, and comment styles

### 🔧 Fuzzer Reliability Fixes
- Fuzz requests are now routed through the background service worker (like POST already was), fixing silent failures against cross-origin targets
- Response length is now shown alongside status code, as originally intended
- The target URL now accepts a bare `FUZZ` marker (ffuf-style) in addition to `[FUZZ]` — no more silent rejection for URLs without brackets
- **Load default payloads** dropdown adds ready-made wordlists (directory/file fuzzing, SQLi, XSS, LFI, NoSQL, SSTI, OSCI, SSRF, Blind SQLi) so you're not stuck typing or pasting payloads by hand

### 🐘 Corrected PostgreSQL DIOS Technique
**PostgreSQL DIOS** previously reused MySQL's `COUNT()`/`RAND()` GROUP BY duplicate-key error trick with Postgres function names swapped in — a technique that's specific to MySQL's implementation and doesn't actually error the same way on PostgreSQL. It's been replaced with genuine Postgres error-based extraction via `CAST(...AS int)` type-cast errors, so **MySQL DIOS**, **PostgreSQL DIOS**, and **LocDIOS** are now meaningfully different techniques rather than the same boilerplate under three headings.

### 🖱️ Menu Display Fix
Category menus (including WAF) could silently fail to open on click due to a state-tracking bug in the toggle logic. Fixed so every menu opens/closes reliably.

---

## 🚀 New Pro Features (v1.3+)

### 🖱️ Right-Click Context Menu
Supercharge your workflow with instant right-click access:
- Right-click on **any input field** or **highlighted text** on a web page to open the KHackBar context menu
- **Inject Payloads** directly into input fields without manually copying/pasting
- **Base64 Encode/Decode** selected text on the fly
- Streamlines testing by eliminating context-switching between tabs

### ⚡ Automated Fuzzer / Repeater
The new **Fuzzer** tab turns KHackBar into a powerful automated testing engine:
- Use a `FUZZ` or `[FUZZ]` marker in your target URL to designate the injection point (both styles are accepted, case-insensitive)
- Load a default wordlist (directory/file fuzzing, SQLi, XSS, LFI, NoSQL, SSTI, OSCI, SSRF, Blind SQLi) from the **Load default payloads** dropdown instead of typing/pasting your own
- Paste multiple payloads (one per line) into the payloads text area
- Click **Start Fuzzing** to automatically fire each payload at the target
- **Real-time logs** display Status Code and Response Length for each request
- Instantly spot anomalies (different status codes, unusual response sizes) that signal vulnerabilities
- Click **Clear Results** to reset the output panel

### 🎯 Target Scoping & Safety
Prevent accidental testing on unauthorized domains with the new **Scoping** feature:
- Found under the **Settings** tab
- Add allowed domains to your scope list (e.g., `*.example.com`)
- Enable scoping to block requests to any domain not in your allowed list
- Adds a crucial safety layer during live engagements — no more embarrassing misfires on production systems
- Scope rules are persisted via the `storage` API and survive browser restarts

### 💾 Configuration Management
Backup and restore your entire KHackBar configuration with a single click:
- **Export** saves all your headers, scope rules, and settings as a downloadable **JSON** file
- **Import** restores a previously exported configuration from a JSON file
- Perfect for team collaboration — share standardized configs across your red team
- No more re-entering custom headers or scope rules between sessions

---

## 🎨 Enhanced Visual Identity (v1.3+)

The extension has been fully re-skinned with a **Red Team / Hacker aesthetic** and further optimized for a professional experience:
- 🔴 Dark red and black color palette (`#dc2626`, `#1a1a2e`, `#0f0f1a`)
- ⚡ Optimized **inline SVG icons** for a lightweight, crisp experience
- 🖥️ Distracted-font-style status indicators and terminal-inspired UI elements
- 🧩 **Dedicated panels** for Fuzzing, Headers, Cookies, and Settings — keeping the interface clean and organized
- 🚫 No external dependencies — all assets are bundled within the extension

---

## 📦 Installation Guide

### Step 1: Download or Clone
```bash
git clone https://github.com/KhitMinnyo/KHackBar.git
cd KHackBar
```

### Step 2: Open Chrome Extensions
Open Google Chrome and navigate to:
```
chrome://extensions/
```

### Step 3: Enable Developer Mode
Toggle **"Developer mode"** in the top right corner of the Extensions page.

### Step 4: Load Unpacked
Click **"Load unpacked"** and select the project folder (`KHackBar`).

### Step 5: Pin to Toolbar
Click the puzzle piece icon (Extensions menu) in the Chrome toolbar, find **KHackBar**, and click the pin icon 📌 to pin it for quick access.

---

## 🚀 How to Use

### Basic Usage
1. **Click the KHackBar icon** in your Chrome toolbar to open the Side Panel.
2. **Navigate to a target website** — the extension will activate automatically.
3. **Select an attack vector** from the payload library dropdown.
4. **Inject, encode, or modify** requests using the built-in tools.
5. **Inspect and manipulate cookies** in the Cookie Editor tab.
6. **Execute POST requests** with custom headers and body types.

### 🔒 Setting Up Scope (Before Starting a Pentest)
1. Open the **Settings** tab in the KHackBar side panel.
2. In the **Target Scope** section, add domains you are authorized to test (e.g., `*.example.com` or `https://testsite.local/*`).
3. Toggle scoping **ON** to activate the restriction.
4. Any request to a domain **not** in your scope list will be blocked — keeping your testing safe and compliant.
5. Scope rules are automatically saved and will persist across browser sessions.

### 🔁 Using the Fuzzer with `FUZZ` / `[FUZZ]` Syntax
1. Navigate to the **Fuzzer** tab.
2. In the **Target URL** field, enter your URL with `FUZZ` or `[FUZZ]` as the injection marker (both work).  
   *Example:* `https://example.com/page?id=FUZZ&debug=false`
3. In the **Payloads** text area, enter one payload per line, or pick a ready-made list from the **Load default payloads** dropdown (directory/file fuzzing, SQLi, XSS, LFI, NoSQL, SSTI, OSCI, SSRF, Blind SQLi) instead of typing your own.  
   *Example:*  
   ```
   1' OR '1'='1
   1" OR 1=1--
   <script>alert(1)</script>
   ```
4. Click **Start Fuzzing** to begin. The results panel will show real-time logs with **Status Code** and **Response Length** for each payload.
5. Review the results — payloads that produce unique responses (different status codes or response sizes) are worth investigating further.
6. Click **Clear Results** to reset before your next round.

> ⚡ **Pro Tip:** Combine Header Injection with custom payloads to bypass WAFs and test edge-case server logic.

---

## 💻 Technical Requirements

| Requirement | Details |
|-------------|---------|
| **Browser** | Google Chrome (v88+ recommended) |
| **Manifest** | Manifest V3 |
| **Permissions** | `tabs`, `activeTab`, `scripting`, `sidePanel`, `storage`, `cookies`, `declarativeNetRequest`, `contextMenus`, `webRequest` |
| **Permissions** | `sidePanel` — to operate within Chrome's Side Panel UI |
| **Permissions** | `storage` — for persisting scope rules, headers, and configuration data |
| **Permissions** | `contextMenus` — for right-click context menu integration |
| **Permissions** | `webRequest` — read-only observation used by POST Capture (non-blocking; never modifies traffic) |
| **Host Access** | `<all_urls>` — required for payload injection and network request modification |

---

## ⚠️ Professional Disclaimer

> **This tool is for authorized penetration testing and educational purposes only.**
>
> Unauthorized use of this extension against systems you do not own or have explicit written permission to test is **illegal** and **unethical**. The developers assume **no liability** for any misuse or damage caused by this software.
>
> By using KHackBar, you agree to:
> - Only test systems you own or have written authorization to test
> - Comply with all applicable local, state, and federal laws
> - Use the tool responsibly and ethically in accordance with industry best practices (e.g., OWASP, PTES)

---

## 🧬 Repository Structure

```
KHackBar/
├── manifest.json          # Chrome Extension Manifest V3 config
├── background.js          # Service worker for background tasks
├── popup.html             # Side Panel UI markup
├── popup.js               # Main initializer
├── payloads.js            # Payload library definitions
├── ui.js                  # UI rendering, menu switching, DOM helpers
├── waf.js                 # WAF Bypass panel (selection-based wrap/transform templates)
├── union.js               # UNION SELECT generator (column-count aware)
├── scope.js               # Target scope validation
├── audit.js               # Audit log storage and rendering helpers
├── fuzzer.js              # Fuzzer / repeater logic
├── headers.js             # Custom header management
├── cookies.js             # Cookie viewer/editor logic
├── settings.js            # Scope, config import/export, audit settings
└── README.md              # Documentation
```

---

## 🧩 Modular Architecture

KHackBar follows a clean modular architecture to keep the codebase organized and maintainable:

| Module | Responsibility |
|--------|---------------|
| **`popup.js`** | Application initializer — wires together all modules on startup |
| **`payloads.js`** | Defines the categorized payload library (SQLi, XSS, LFI, etc.) |
| **`ui.js`** | Handles UI rendering, menu switching, DOM manipulation helpers |
| **`waf.js`** | Renders the WAF Bypass panel — wraps/transforms the URL box selection using bypass templates instead of inserting fixed strings |
| **`union.js`** | Renders the UNION panel — asks for column count and text-column positions, generates matching `UNION SELECT` payloads |
| **`scope.js`** | Validates target URLs against the allowed scope list |
| **`audit.js`** | Manages audit log storage and renders audit entries |
| **`fuzzer.js`** | Implements the automated fuzzer / repeater engine |
| **`headers.js`** | Manages custom header injection via `declarativeNetRequest` |
| **`cookies.js`** | Provides cookie viewing, editing, and creation logic |
| **`settings.js`** | Handles scope configuration, config import/export, and audit settings |

Each module encapsulates a distinct feature domain and communicates through well-defined interfaces. This separation of concerns improves maintainability, makes testing easier, and significantly reduces the risk of large single-file bugs — such as the critical XSS vulnerability that was recently patched in the HTML encoder.

---

<p align="center">
  <sub>Crafted with 🩸 for the Red Team community.</sub>
  <br>
  <sub>🔴 **KHackBar** — Audit hard. Stay legal.</sub>
</p>
