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
    capturePostEnabled = !!message.enabled;
    chrome.storage.local.set({ capture_post_enabled: capturePostEnabled });
    sendResponse({ success: true, enabled: capturePostEnabled });
    return false;
  }

  if (message.type === 'execute_post') {
    fetch(message.url, {
      method: 'POST',
      headers: { 'Content-Type': message.contentType },
      body: message.data
    })
      .then(async (response) => {
        const responseText = await response.text();
        sendResponse({
          success: true,
          status: response.status,
          statusText: response.statusText,
          length: responseText.length
        });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
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
});

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
// When enabled via the toggle in the POST section, watches POST requests
// made by the currently active tab (form submissions, fetch/XHR calls) and
// pushes the URL + body + content-type to the side panel so it can
// auto-fill the POST fields — e.g. log into a site normally in the browser
// and the exact request shows up in KHackBar without manual copy/paste.
//
// This only OBSERVES traffic via the non-blocking webRequest API (MV3
// still fully supports this — only the *blocking* variant is restricted),
// it never modifies or delays the real request.
let capturePostEnabled = false;
let activeTabId = null;
const pendingPostCaptures = new Map(); // requestId -> { url, body, reconstructed, timeStamp }

chrome.storage.local.get(['capture_post_enabled'], (result) => {
  capturePostEnabled = !!result.capture_post_enabled;
});

chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  if (tabs && tabs[0]) activeTabId = tabs[0].id;
});
chrome.tabs.onActivated.addListener((info) => {
  activeTabId = info.tabId;
});

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
    if (!capturePostEnabled) return;
    if (details.method !== 'POST') return;
    if (details.tabId !== activeTabId) return;

    cleanupStalePostCaptures();

    const decoded = decodePostBody(details.requestBody);
    if (!decoded) return;

    pendingPostCaptures.set(details.requestId, {
      url: details.url,
      body: decoded.body,
      reconstructed: decoded.reconstructed,
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
  },
  { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame', 'xmlhttprequest'] },
  ['requestHeaders']
);

// Clean up if a pending capture's request errors out before headers are sent.
chrome.webRequest.onErrorOccurred.addListener(
  (details) => { pendingPostCaptures.delete(details.requestId); },
  { urls: ['<all_urls>'] }
);
