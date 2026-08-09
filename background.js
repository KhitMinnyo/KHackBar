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
    // Always store the latest capture so "Load captured POST" works regardless
    // of the toggle state. The toggle only gates the live auto-fill push below.
    chrome.storage.local.set({ last_captured_post: captured });
    chrome.storage.local.get(['capture_post_enabled'], (res) => {
      if (res && res.capture_post_enabled) {
        chrome.runtime.sendMessage({ type: 'post_captured', data: captured }, () => {
          void chrome.runtime.lastError;
        });
      }
    });
    return false;
  }

  if (message.type === 'execute_post') {
    runSimplePost(message).then(sendResponse);
    return true; // keep channel open for async sendResponse
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
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      length: responseText.length
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
        length: responseText.length
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return { success: false, aborted: true, error: 'Timed out after ' + timeoutMs + 'ms' };
      }
      return { success: false, error: err.message };
    }
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
