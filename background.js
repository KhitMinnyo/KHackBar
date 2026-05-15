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
