// ============================================================
// headers.js - Header management functions
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Headers = window.KHackBar.Headers || {};

/**
 * Render header rows from saved header data.
 * @param {HTMLElement} container - The header_rows container element
 * @param {Array} headers - Array of {header, value, operation} objects
 * @param {string} urlPattern - The URL pattern
 */
window.KHackBar.Headers.renderRows = function (container, headers, urlPattern) {
  if (!container) return;

  // Clear existing
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  headers.forEach(function (h, index) {
    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '4px';
    row.style.alignItems = 'center';
    row.style.width = '100%';

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Header Name';
    nameInput.value = h.header || '';
    nameInput.style.flex = '1';
    nameInput.style.background = '#0a0a0a';
    nameInput.style.color = '#ef4444';
    nameInput.style.border = '1px solid #3f3f3f';
    nameInput.style.padding = '4px';
    nameInput.style.borderRadius = '4px';
    nameInput.style.fontSize = '10px';
    nameInput.style.outline = 'none';
    nameInput.style.fontFamily = 'inherit';

    var valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = 'Value';
    valueInput.value = h.value || '';
    valueInput.style.flex = '2';
    valueInput.style.background = '#0a0a0a';
    valueInput.style.color = '#ef4444';
    valueInput.style.border = '1px solid #3f3f3f';
    valueInput.style.padding = '4px';
    valueInput.style.borderRadius = '4px';
    valueInput.style.fontSize = '10px';
    valueInput.style.outline = 'none';
    valueInput.style.fontFamily = 'inherit';

    var opSelect = document.createElement('select');
    opSelect.style.background = '#0a0a0a';
    opSelect.style.color = '#ef4444';
    opSelect.style.border = '1px solid #3f3f3f';
    opSelect.style.padding = '4px';
    opSelect.style.borderRadius = '4px';
    opSelect.style.fontSize = '10px';
    opSelect.style.outline = 'none';
    opSelect.style.fontFamily = 'inherit';
    ['set', 'remove'].forEach(function (op) {
      var opt = document.createElement('option');
      opt.value = op;
      opt.textContent = op;
      if (op === (h.operation || 'set')) opt.selected = true;
      opSelect.appendChild(opt);
    });

    var removeBtn = document.createElement('button');
    removeBtn.className = 'small-btn';
    removeBtn.textContent = 'X';
    removeBtn.style.fontSize = '9px';
    removeBtn.onclick = function () {
      headers.splice(index, 1);
      window.KHackBar.Headers.renderRows(container, headers, urlPattern);
    };

    row.appendChild(nameInput);
    row.appendChild(valueInput);
    row.appendChild(opSelect);
    row.appendChild(removeBtn);
    container.appendChild(row);

    // Update data on change
    nameInput.oninput = function () { h.header = nameInput.value; };
    valueInput.oninput = function () { h.value = valueInput.value; };
    opSelect.onchange = function () { h.operation = opSelect.value; };
  });
};

/**
 * Load saved headers from chrome.storage.local and render them.
 * @param {HTMLElement} container - The header_rows container element
 * @param {HTMLElement} urlPatternInput - The URL pattern input element
 */
window.KHackBar.Headers.loadSavedHeaders = function (container, urlPatternInput) {
  chrome.storage.local.get(['custom_headers', 'header_url_pattern'], function (result) {
    var headers = result.custom_headers || [{ header: '', value: '', operation: 'set' }];
    var pattern = result.header_url_pattern || '';
    if (urlPatternInput) urlPatternInput.value = pattern;
    window.KHackBar.Headers.renderRows(container, headers, pattern);
  });
};

/**
 * Save headers from UI inputs to chrome.storage.local and send to background.
 * @param {HTMLElement} container - The header_rows container element
 * @param {string} urlPattern - The URL pattern string
 * @param {Array} headers - The headers array (mutable)
 * @param {HTMLElement} statusEl - Status text element
 */
window.KHackBar.Headers.saveHeaders = function (container, urlPattern, headers, statusEl) {
  // Gather current data from UI
  var inputs = container.querySelectorAll('input');
  var selects = container.querySelectorAll('select');
  var updatedHeaders = [];
  for (var i = 0; i < inputs.length; i += 2) {
    if (i + 1 < inputs.length) {
      var headerName = inputs[i].value.trim();
      var headerValue = inputs[i + 1].value;
      var operation = selects[Math.floor(i / 2)] ? selects[Math.floor(i / 2)].value : 'set';
      if (headerName) {
        updatedHeaders.push({ header: headerName, value: headerValue, operation: operation });
      }
    }
  }

  // Save to storage
  chrome.storage.local.set({
    custom_headers: updatedHeaders,
    header_url_pattern: urlPattern
  }, function () {
    // Send to background service worker for declarativeNetRequest
    chrome.runtime.sendMessage({
      type: 'apply_headers',
      urlPattern: urlPattern || '*://*/*',
      headers: updatedHeaders
    }, function (response) {
      if (statusEl) {
        if (response && response.success) {
          statusEl.textContent = '[+] Headers applied (' + updatedHeaders.length + ' rules).';
        } else if (response && response.error) {
          statusEl.textContent = '[!] Header error: ' + response.error;
        } else {
          statusEl.textContent = '[+] Headers saved.';
        }
      }
    });
  });
};
