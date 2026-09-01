// Side panel behavior on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  // ---------- Context Menus ----------
  chrome.contextMenus.create({
    id: 'khackbar_parent',
    title: 'KHackBar',
    contexts: ['editable']
  });

  chrome.contextMenus.create({
    id: 'inject_sqli',
    parentId: 'khackbar_parent',
    title: "Inject SQLi (' OR 1=1-- -)",
    contexts: ['editable']
  });

  chrome.contextMenus.create({
    id: 'inject_xss',
    parentId: 'khackbar_parent',
    title: "Inject XSS (<script>alert(1)</script>)",
    contexts: ['editable']
  });

  chrome.contextMenus.create({
    id: 'b64_encode',
    parentId: 'khackbar_parent',
    title: 'Base64 Encode',
    contexts: ['editable']
  });

  chrome.contextMenus.create({
    id: 'b64_decode',
    parentId: 'khackbar_parent',
    title: 'Base64 Decode',
    contexts: ['editable']
  });
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ---------- Context Menu Click Handler ----------
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  switch (info.menuItemId) {
    case 'inject_sqli':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (payload) => {
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value || el.textContent || '';
            el.value = val.substring(0, start) + payload + val.substring(end);
            el.selectionStart = el.selectionEnd = start + payload.length;
            el.focus();
          }
        },
        args: ["' OR 1=1-- -"]
      }).catch(err => console.error('KHackBar: inject_sqli error', err));
      break;

    case 'inject_xss':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (payload) => {
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value || el.textContent || '';
            el.value = val.substring(0, start) + payload + val.substring(end);
            el.selectionStart = el.selectionEnd = start + payload.length;
            el.focus();
          }
        },
        args: ["<script>alert(1)</script>"]
      }).catch(err => console.error('KHackBar: inject_xss error', err));
      break;

    case 'b64_encode':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value || el.textContent || '';
            const selectedText = val.substring(start, end);
            if (selectedText) {
              const encoded = btoa(unescape(encodeURIComponent(selectedText)));
              el.value = val.substring(0, start) + encoded + val.substring(end);
              el.selectionStart = el.selectionEnd = start + encoded.length;
              el.focus();
            }
          }
        }
      }).catch(err => console.error('KHackBar: b64_encode error', err));
      break;

    case 'b64_decode':
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const val = el.value || el.textContent || '';
            const selectedText = val.substring(start, end);
            if (selectedText) {
              try {
                const decoded = decodeURIComponent(escape(atob(selectedText)));
                el.value = val.substring(0, start) + decoded + val.substring(end);
                el.selectionStart = el.selectionEnd = start + decoded.length;
                el.focus();
              } catch (e) {
                console.error('KHackBar: Base64 decode failed', e);
              }
            }
          }
        }
      }).catch(err => console.error('KHackBar: b64_decode error', err));
      break;
  }
});

// ---------- Header Injection via declarativeNetRequest ----------
const HEADER_RULE_PREFIX = 'custom_header_rule_';
let ruleCounter = 1;

// Listen for messages from popup to set/clear header rules
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'apply_headers') {
    applyHeaderRules(message.urlPattern, message.headers)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'clear_headers') {
    clearHeaderRules()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'set_capture_post_enabled') {
    const enabled = !!message.enabled;
    // Source of truth is storage — the webRequest listeners read it freshly
    // rather than relying on a module variable that resets when the MV3
    // service worker sleeps.
    chrome.storage.local.set({ capture_post_enabled: enabled });
    sendResponse({ success: true, enabled: enabled });
    return false;
  }

  if (message.type === 'set_capture_traffic_enabled') {
    const enabled = !!message.enabled;
    // Same storage-is-the-source-of-truth discipline as
    // set_capture_post_enabled above. Deliberately a SEPARATE flag from
    // capture_post_enabled: opting into POST capture (e.g. to test one
    // login form) must not silently also opt the user into logging every
    // background API call the active tab makes, and vice versa.
    chrome.storage.local.set({ capture_traffic_enabled: enabled });
    sendResponse({ success: true, enabled: enabled });
    return false;
  }

  // ---- POST captured by the in-page content script ----
  // Reliable even when the service worker was asleep: this very message wakes
  // it. Gate on the stored enabled flag, save, and relay to the panel.
  if (message.type === 'captured_post_from_page') {
    const d = message.data || {};
    console.debug('[KHackBar] captured_post_from_page received:', d.url);
    if (!d.url || !d.body) return false;
    const captured = {
      url: d.url,
      body: d.body,
      contentType: d.contentType || 'application/x-www-form-urlencoded',
      reconstructed: false,
      timeStamp: d.timeStamp || Date.now()
    };
    // PRIVACY: only persist/relay this if capture is actually enabled. This
    // content script observes every POST on every page (that's what makes it
    // reliable — see the note above), so without this gate every login body
    // on every site the user visits — including ones with nothing to do with
    // KHackBar — would end up sitting in extension storage indefinitely.
    // (Previously the storage write ran unconditionally and only the live
    // push was gated; that meant unchecking "Auto-capture" didn't actually
    // stop credentials from being stored, just from being auto-filled.)
    chrome.storage.local.get(['capture_post_enabled'], (res) => {
      if (!res || !res.capture_post_enabled) return;
      chrome.storage.local.set({ last_captured_post: captured });
      chrome.runtime.sendMessage({ type: 'post_captured', data: captured }, () => {
        void chrome.runtime.lastError;
      });
    });
    return false;
  }

  // ---- Traffic Log: any-method fetch/XHR reported by the in-page content
  // script (capture-main.js), relayed here by capture-content.js ----
  // This used to be fed by a second chrome.webRequest.onBeforeRequest
  // listener (network layer, see the "API Traffic Log" section near the end
  // of this file). That missed any GET served from the browser's HTTP cache
  // or from a service worker's Cache Storage — which, structurally, can only
  // ever hold GET responses (Cache.put() throws for other methods) — because
  // a cache hit never reaches the network stack webRequest observes. A
  // revisited SPA route showed nothing. POST looked unaffected only because
  // it's captured here too, at the page's own fetch()/XHR call — before the
  // browser decides whether to serve it from cache — the same reliable
  // mechanism captured_post_from_page above has always used. Reusing it for
  // every method (not just POST) closes the gap.
  if (message.type === 'captured_traffic_from_page') {
    const d = message.data || {};
    if (!d.url) return false;
    const tabId = (sender && sender.tab) ? sender.tab.id : -1;
    // -1 means this isn't tied to a browser tab — shouldn't happen for a
    // content-script sender, but stay consistent with the same guard used
    // elsewhere in this file.
    if (tabId < 0) return false;
    chrome.storage.local.get(['capture_traffic_enabled'], (res) => {
      if (!res || !res.capture_traffic_enabled) return;
      // Only log the currently active/focused tab — avoids silently logging
      // background-tab traffic unrelated to what the user is looking at.
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const activeId = tabs && tabs[0] ? tabs[0].id : null;
        if (activeId !== null && tabId !== activeId) return;
        appendTrafficLogEntry({
          timestamp: d.timeStamp || Date.now(),
          method: (d.method || 'GET').toUpperCase(),
          url: d.url,
          tabId: tabId
        });
      });
    });
    return false;
  }

  if (message.type === 'execute_post') {
    runSimplePost(message).then(sendResponse);
    return true; // keep channel open for async sendResponse
  }

  // ---- API panel: arbitrary-method request with custom headers ----
  if (message.type === 'api_request') {
    runApiRequest(message).then(sendResponse);
    return true;
  }

  // ---- Fuzzer requests ----
  // The Fuzzer used to call fetch() directly from the side panel page,
  // which is subject to that page's own CORS handling and could silently
  // fail against cross-origin targets. Routing it through the background
  // service worker (like execute_post above) uses the extension's
  // host_permissions to fetch cross-origin reliably.
  if (message.type === 'fuzz_request') {
    const controller = new AbortController();
    const timeoutMs = message.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    fetch(message.url, { method: 'GET', signal: controller.signal })
      .then(async (response) => {
        clearTimeout(timeoutId);
        const responseText = await response.text();
        sendResponse({
          success: true,
          status: response.status,
          statusText: response.statusText,
          length: responseText.length
        });
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          sendResponse({ success: false, aborted: true, error: 'Timed out after ' + timeoutMs + 'ms' });
        } else {
          sendResponse({ success: false, error: err.message });
        }
      });
    return true; // keep channel open for async sendResponse
  }

  // ---- Intruder POST/GET fuzz requests (Sniper / Cluster Bomb) ----
  // Like fuzz_request, but lets the Intruder engine choose the HTTP method
  // and (for POST) send a body + Content-Type. Routed through the background
  // worker so the extension's host_permissions handle cross-origin reliably.
  //
  // Cookie injection: fetch() cannot set the forbidden `Cookie` header, so
  // when message.cookie is provided we install a temporary declarativeNetRequest
  // rule that sets the Cookie header for exactly this request URL, fetch, then
  // remove the rule. This gives the target the injected cookie verbatim without
  // touching the user's real cookie jar.
  if (message.type === 'fuzz_post_request') {
    runIntruderRequest(message).then(sendResponse);
    return true; // keep channel open for async sendResponse
  }
});

/**
 * Execute the plain POST from the POST section. Runs in the background worker
 * so the extension's host_permissions handle cross-origin. Hardened over the
 * original bare fetch: timeout, credentials (session cookies), no clobbering of
 * multipart boundaries, and a diagnostic error message.
 */
async function runSimplePost(message) {
  const timeoutMs = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = (message.url || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    clearTimeout(timeoutId);
    return { success: false, error: 'URL must start with http:// or https:// (got: "' + url.slice(0, 40) + '").' };
  }

  const init = {
    method: 'POST',
    signal: controller.signal,
    credentials: 'include', // send the site's cookies, like a real browser POST
    body: message.data != null ? message.data : ''
  };
  const ct = (message.contentType || 'application/x-www-form-urlencoded');
  // For multipart, a manual Content-Type without a boundary makes the body
  // unparseable — only set an explicit header for non-multipart types.
  if (ct.toLowerCase().indexOf('multipart/form-data') === -1) {
    init.headers = { 'Content-Type': ct };
  }

  try {
    const response = await fetch(url, init);
    clearTimeout(timeoutId);
    const responseText = await response.text();
    // Include a capped copy of the body so the panel can show the response and
    // extract fields (e.g. an auth token) from it — the silent POST used to
    // return only status/length, which hid login tokens.
    const BODY_CAP = 256 * 1024;
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      length: responseText.length,
      body: responseText.slice(0, BODY_CAP),
      bodyTruncated: responseText.length > BODY_CAP
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Timed out after ' + timeoutMs + 'ms — the host did not respond.' };
    }
    let hint = '';
    if ((err.message || '').indexOf('Failed to fetch') !== -1) {
      hint = ' — host may be unreachable or expired (e.g. a closed PortSwigger lab), DNS failed, or the URL is wrong. Open the URL in a normal tab to confirm it is live.';
    }
    return { success: false, error: (err.message || 'Unknown error') + hint };
  }
}

/**
 * Execute an arbitrary-method API request for the API panel. Supports
 * GET/POST/PUT/PATCH/DELETE, a chosen Content-Type, and extra custom headers.
 * Runs in the background worker (host_permissions handle cross-origin) with
 * credentials so cookies flow, and returns the response body so the panel can
 * display it. Any header injected via the HEADERS/Login rule (e.g. the auth
 * token) is applied by declarativeNetRequest and rides along automatically.
 */
async function runApiRequest(message) {
  const timeoutMs = 30000;
  const method = (message.method || 'GET').toUpperCase();
  const url = (message.url || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return { success: false, error: 'URL must start with http:// or https:// (got: "' + url.slice(0, 40) + '").' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const init = { method: method, signal: controller.signal, credentials: 'include' };
  const headers = {};
  const ct = (message.contentType || '').trim();
  const sendsBody = method !== 'GET' && method !== 'HEAD';
  if (sendsBody) {
    if (ct) headers['Content-Type'] = ct;
    init.body = message.body != null ? message.body : '';
  }
  // Extra per-request headers from the panel (plain {name: value} object).
  if (message.headers && typeof message.headers === 'object') {
    for (const k in message.headers) {
      if (Object.prototype.hasOwnProperty.call(message.headers, k)) headers[k] = message.headers[k];
    }
  }
  if (Object.keys(headers).length) init.headers = headers;

  try {
    const response = await fetch(url, init);
    clearTimeout(timeoutId);
    const responseText = await response.text();
    const BODY_CAP = 512 * 1024;
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      length: responseText.length,
      body: responseText.slice(0, BODY_CAP),
      bodyTruncated: responseText.length > BODY_CAP
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return { success: false, error: 'Timed out after ' + timeoutMs + 'ms — the host did not respond.' };
    }
    let hint = '';
    if ((err.message || '').indexOf('Failed to fetch') !== -1) {
      hint = ' — host unreachable, DNS failed, or blocked by CORS/mixed-content. Confirm the URL is live in a normal tab.';
    }
    return { success: false, error: (err.message || 'Unknown error') + hint };
  }
}

// Reserved DNR rule id for the Intruder's per-request Cookie injection.
const FUZZ_COOKIE_RULE_ID = 900001;

async function runIntruderRequest(message) {
  const method = (message.method || 'POST').toUpperCase();
  const timeoutMs = message.timeout || 30000;
  const hasCookie = message.cookie != null && message.cookie !== '';
  let ruleInstalled = false;

  try {
    if (hasCookie) {
      // updateDynamicRules resolves only once the rule is actually applied,
      // so the immediately following fetch is guaranteed to carry the header.
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [FUZZ_COOKIE_RULE_ID],
        addRules: [{
          id: FUZZ_COOKIE_RULE_ID,
          priority: 100,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header: 'cookie', operation: 'set', value: message.cookie }]
          },
          condition: {
            urlFilter: message.url,
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'other', 'script', 'stylesheet']
          }
        }]
      });
      ruleInstalled = true;
    }

    // Retry transient network failures. Under rapid concurrent fire (e.g. an
    // Intruder run with many threads), targets like the PortSwigger labs reset
    // or refuse connections, which surfaces as a "Failed to fetch" TypeError.
    // These are not real HTTP responses — a short backoff and retry recovers
    // them instead of marking the request permanently failed. A real HTTP
    // response (any status, even 500) is returned immediately without retry;
    // a genuine timeout (AbortError) is also not retried.
    const MAX_ATTEMPTS = 6;
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const init = { method: method, signal: controller.signal };
      if (method !== 'GET' && method !== 'HEAD') {
        init.headers = { 'Content-Type': message.contentType || 'application/x-www-form-urlencoded' };
        init.body = message.data != null ? message.data : '';
      }

      try {
        const response = await fetch(message.url, init);
        clearTimeout(timeoutId);
        const responseText = await response.text();
        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          length: responseText.length,
          retries: attempt - 1
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          return { success: false, aborted: true, error: 'Timed out after ' + timeoutMs + 'ms' };
        }
        lastErr = err;
        // Exponential backoff with jitter. A burst of concurrent requests can
        // trip a target's rate-limit / connection cap (classic on PortSwigger
        // labs), and that cooldown can last a few seconds — a short fixed delay
        // isn't enough. Growing waits (≈0.25s→0.5s→1s→2s→4s, capped at 5s) plus
        // jitter spread the retries out so the workers stop re-bursting in
        // lockstep and the requests drain through.
        if (attempt < MAX_ATTEMPTS) {
          const base = Math.min(5000, 250 * Math.pow(2, attempt - 1));
          const backoff = base + Math.floor(Math.random() * 250);
          await new Promise(r => setTimeout(r, backoff));
        }
      }
    }
    return {
      success: false,
      error: (lastErr && lastErr.message ? lastErr.message : 'Network error') +
             ' (after ' + MAX_ATTEMPTS + ' attempts — try lowering Threads or raising Delay if this persists)'
    };
  } finally {
    if (ruleInstalled) {
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [FUZZ_COOKIE_RULE_ID],
          addRules: []
        });
      } catch (e) { /* best-effort cleanup */ }
    }
  }
}

/**
 * Remove all previously installed custom header rules.
 */
async function clearHeaderRules() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const idsToRemove = existingRules
    .filter(r => r.id >= 1000) // use id >= 1000 for our custom rules
    .map(r => r.id);
  if (idsToRemove.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: idsToRemove,
      addRules: []
    });
  }
}

/**
 * Apply new header modification rules.
 * @param {string} urlPattern - A URL filter pattern e.g. "*://*.example.com/*"
 * @param {Array<{header: string, value: string, operation?: string}>} headers
 */
async function applyHeaderRules(urlPattern, headers) {
  // First, clear existing custom rules
  await clearHeaderRules();

  // Build request header modification objects
  const requestHeaders = headers.map(h => {
    const op = h.operation || 'set';
    return {
      header: h.header,
      value: h.value,
      operation: op === 'remove' ? 'remove' : 'set'
    };
  });

  // Build the dynamic rule
  const rule = {
    id: Date.now() % 100000 + 1000, // unique id >= 1000
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: requestHeaders
    },
    condition: {
      urlFilter: urlPattern || '*://*/*',
      resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'other']
    }
  };

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [],
    addRules: [rule]
  });
}

// ---------- POST Capture (Burp-style auto-fill) ----------
// Observes POST requests from the active tab (form submissions, fetch/XHR)
// and pushes URL + body + content-type to the side panel so it can auto-fill
// the POST / Intruder fields — log in normally and the exact request appears
// in KHackBar without manual copy/paste. Non-blocking observation only; the
// real request is never modified or delayed.
//
// MV3 correctness note: the service worker sleeps and is WOKEN by the request
// event itself, so any module-level state (an "enabled" flag, the active tab
// id) is NOT reliably initialised at the instant onBeforeRequest fires — the
// async storage.get / tabs.query that would populate it hasn't run yet. The
// old version guarded onBeforeRequest on those uninitialised variables, so it
// silently dropped the first login after every sleep (i.e. nearly always).
//
// Fix: capture every POST body unconditionally here (cheap, just a Map insert),
// then defer the "is capture enabled? is this the active tab?" decision to
// onSendHeaders, where we read both freshly from storage / tabs.query.
const pendingPostCaptures = new Map(); // requestId -> { url, body, reconstructed, tabId, timeStamp }

/**
 * Reconstruct a readable body string from webRequest's requestBody details.
 * Native <form> submissions (the common login-form case) populate
 * `formData`; fetch()/XHR calls with a raw body (e.g. JSON) populate `raw`.
 */
function decodePostBody(requestBody) {
  if (!requestBody) return null;

  if (requestBody.formData) {
    const parts = [];
    for (const key in requestBody.formData) {
      requestBody.formData[key].forEach((value) => {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      });
    }
    return { body: parts.join('&'), reconstructed: true };
  }

  if (requestBody.raw && requestBody.raw.length > 0) {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = requestBody.raw
        .filter((chunk) => chunk.bytes)
        .map((chunk) => decoder.decode(chunk.bytes))
        .join('');
      return { body: text, reconstructed: false };
    } catch (e) {
      return null;
    }
  }

  return null;
}

function cleanupStalePostCaptures() {
  const cutoff = Date.now() - 30000;
  for (const [id, entry] of pendingPostCaptures) {
    if (entry.timeStamp < cutoff) pendingPostCaptures.delete(id);
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Capture unconditionally — the enabled/active-tab decision happens later
    // in onSendHeaders, where the required state can be read reliably even on
    // a freshly-woken service worker.
    if (details.method !== 'POST') return;

    const decoded = decodePostBody(details.requestBody);
    if (!decoded) return;

    cleanupStalePostCaptures();

    pendingPostCaptures.set(details.requestId, {
      url: details.url,
      body: decoded.body,
      reconstructed: decoded.reconstructed,
      tabId: details.tabId,
      timeStamp: details.timeStamp || Date.now()
    });
  },
  { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] },
  ['requestBody']
);

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    const pending = pendingPostCaptures.get(details.requestId);
    if (!pending) return;
    pendingPostCaptures.delete(details.requestId);

    let contentType = 'application/x-www-form-urlencoded';
    if (details.requestHeaders) {
      const header = details.requestHeaders.find(
        (h) => h.name.toLowerCase() === 'content-type'
      );
      if (header && header.value) contentType = header.value;
    }

    // Decide whether to keep this capture using freshly-read state. This is a
    // non-blocking observer, so doing async work here is fine — the request is
    // already on its way.
    chrome.storage.local.get(['capture_post_enabled'], (res) => {
      if (!res || !res.capture_post_enabled) return;

      // -1 tabId means the request isn't tied to a tab (e.g. a background
      // fetch) — skip those. Otherwise only keep the tab the user is looking at.
      if (pending.tabId < 0) return;

      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const activeId = tabs && tabs[0] ? tabs[0].id : null;
        if (activeId !== null && pending.tabId !== activeId) return;

        const captured = {
          url: pending.url,
          body: pending.body,
          contentType: contentType,
          reconstructed: pending.reconstructed,
          timeStamp: pending.timeStamp
        };

        chrome.storage.local.set({ last_captured_post: captured });
        chrome.runtime.sendMessage({ type: 'post_captured', data: captured }, () => {
          // No listener means the side panel isn't open — that's fine, the
          // capture is already saved in storage for next time it opens.
          void chrome.runtime.lastError;
        });
      });
    });
  },
  { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] },
  ['requestHeaders']
);

// Clean up if a pending capture's request errors out before headers are sent.
chrome.webRequest.onErrorOccurred.addListener(
  (details) => { pendingPostCaptures.delete(details.requestId); },
  { urls: ['<all_urls>'] }
);

// ============================================================
// API Traffic Log
// ============================================================
// Surfaces the REAL backend URL an SPA calls behind the scenes — e.g. the
// address bar shows /app/profile/5 while the page's own fetch()/XHR
// actually hits /api/v1/users/5. That real URL is invisible today (POST
// Capture above only ever looks at POST); this logs method+URL for every
// background request the active tab makes, of any method.
//
// The actual capture happens in the 'captured_traffic_from_page' handler
// above — fed by capture-main.js/capture-content.js, the same in-page
// content-script mechanism POST Capture uses — NOT a chrome.webRequest
// listener. An earlier version of this feature used a second
// onBeforeRequest listener here; see the comment on that handler above for
// why that missed cache-served GETs and was replaced.
//
// Note: a request is logged the moment it's *attempted*, even if it later
// fails (CORS-blocked, aborted, DNS error). For a recon tool that's a
// feature, not a bug — "the frontend tried to call X and got blocked" is
// exactly the kind of hidden-surface signal this panel exists to show.

// Kept numerically in sync with Config.MAX_TRAFFIC_LOG_ENTRIES in config.js
// by hand — duplicated, not shared, because this file cannot load config.js
// (see the comment there).
const TRAFFIC_LOG_MAX_ENTRIES = 300;

function appendTrafficLogEntry(entry) {
  chrome.storage.local.get(['traffic_logs'], (res) => {
    const logs = (res && res.traffic_logs) || [];
    logs.push(entry);
    chrome.storage.local.set({
      traffic_logs: logs.length > TRAFFIC_LOG_MAX_ENTRIES
        ? logs.slice(logs.length - TRAFFIC_LOG_MAX_ENTRIES)
        : logs
    });
  });
}
