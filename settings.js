// ============================================================
// settings.js - Settings, config import/export, audit log viewer
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Settings = window.KHackBar.Settings || {};

// ---- Dependency guards ----
if (!window.KHackBar.Scope) {
  console.error("KHackBar.Settings: KHackBar.Scope module missing — scope features disabled");
}
if (!window.KHackBar.UI) {
  console.error("KHackBar.Settings: KHackBar.UI module missing — UI feedback disabled");
}
if (!window.KHackBar.Audit) {
  console.error("KHackBar.Settings: KHackBar.Audit module missing — audit log features disabled");
}
if (!window.KHackBar.TrafficLog) {
  console.error("KHackBar.Settings: KHackBar.TrafficLog module missing — traffic log features disabled");
}

/**
 * Initialize the settings module.
 * @param {Object} opts - Configuration object
 * @param {HTMLElement} opts.scopeInput - Scope input element
 * @param {HTMLElement} opts.btnSaveScope - Save scope button
 * @param {HTMLElement} opts.btnExportConfig - Export config button
 * @param {HTMLElement} opts.importConfigFile - Import config file input
 * @param {HTMLElement} opts.btnImportConfig - Import config button
 * @param {HTMLElement} opts.btnClearLogs - Clear logs button
 * @param {HTMLElement} opts.auditLogContainer - Audit log container element
 * @param {HTMLElement} [opts.chkCaptureTraffic] - Traffic-log capture toggle checkbox
 * @param {HTMLElement} [opts.btnClearTrafficLog] - Clear traffic log button
 * @param {HTMLElement} [opts.trafficLogContainer] - Traffic log container element
 * @param {HTMLElement} opts.status - Status text element
 * @param {function} opts.logAudit - Audit logging function
 */
window.KHackBar.Settings.init = function (opts) {
  var scopeInput = opts.scopeInput;
  var scopeEnabledInput = opts.scopeEnabledInput;
  var btnSaveScope = opts.btnSaveScope;
  var btnExportConfig = opts.btnExportConfig;
  var importConfigFile = opts.importConfigFile;
  var btnImportConfig = opts.btnImportConfig;
  var btnClearLogs = opts.btnClearLogs;
  var auditLogContainer = opts.auditLogContainer;
  var chkCaptureTraffic = opts.chkCaptureTraffic;
  var btnClearTrafficLog = opts.btnClearTrafficLog;
  var trafficLogContainer = opts.trafficLogContainer;
  var status = opts.status;
  var logAudit = opts.logAudit || function () {};

  // ---- Load saved scope ----
  // Read storage directly rather than via Scope.getSavedScope(): that getter
  // returns '' when enforcement is off (the right behavior for callers
  // deciding whether to allow a request), but here we're populating the
  // settings UI itself, so we need the real saved pattern + toggle state to
  // display, not the "effective" value.
  chrome.storage.local.get(['scope_pattern', 'scope_enabled'], function (result) {
    if (scopeInput) scopeInput.value = result.scope_pattern || '';
    if (scopeEnabledInput) scopeEnabledInput.checked = result.scope_enabled !== false;
  });

  // ---- Save Scope (pattern + enforcement toggle together) ----
  function saveScopeState(announce) {
    var pattern = scopeInput ? scopeInput.value.trim() : '';
    var enabled = scopeEnabledInput ? scopeEnabledInput.checked : true;
    window.KHackBar.Scope.saveScope(pattern, function () {
      window.KHackBar.Scope.saveScopeEnabled(enabled, function () {
        if (!announce) return;
        var msg = enabled
          ? '[+] Scope saved: ' + (pattern || '(none — unrestricted)')
          : '[!] Scope saved but enforcement is OFF — requests are NOT being blocked.';
        window.KHackBar.UI.setText(status, msg);
        logAudit('scope_save', pattern, 'Scope pattern updated, enforcement ' + (enabled ? 'ON' : 'OFF'));
      });
    });
  }

  if (btnSaveScope && scopeInput) {
    btnSaveScope.onclick = function () { saveScopeState(true); };
  }
  // The enforcement toggle saves itself immediately on change — a safety
  // control like this shouldn't depend on remembering to also click Save.
  if (scopeEnabledInput) {
    scopeEnabledInput.onchange = function () { saveScopeState(true); };
  }

  // ---- Export Config ----
  if (btnExportConfig) {
    btnExportConfig.onclick = function () {
      chrome.storage.local.get(null, function (data) {
        var config = {
          version: 1,
          exportedAt: new Date().toISOString(),
          data: data
        };
        var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'khackbar_config_' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        window.KHackBar.UI.setText(status, '[+] Config exported.');
        logAudit('config_export', '', 'Configuration exported');
      });
    };
  }

  // ---- Import Config ----
  // A basic schema so a malformed or malicious "shared config" file (the
  // README's own "share configs across your red team" workflow is exactly
  // how one of these could reach someone) can't silently corrupt settings.
  // Known keys are type-checked and dropped individually (not the whole
  // import) if they don't match; unknown keys pass through so this doesn't
  // need updating every time a new setting is added elsewhere.
  var CONFIG_KEY_VALIDATORS = {
    scope_pattern: function (v) { return typeof v === 'string'; },
    scope_enabled: function (v) { return typeof v === 'boolean'; },
    capture_post_enabled: function (v) { return typeof v === 'boolean'; },
    capture_traffic_enabled: function (v) { return typeof v === 'boolean'; },
    header_url_pattern: function (v) { return typeof v === 'string'; },
    custom_headers: function (v) {
      return Array.isArray(v) && v.every(function (h) {
        return h && typeof h === 'object' && typeof h.header === 'string' && typeof h.value === 'string';
      });
    },
    audit_logs: function (v) { return Array.isArray(v); },
    traffic_logs: function (v) {
      return Array.isArray(v) && v.every(function (e) {
        return e && typeof e === 'object' && typeof e.url === 'string' && typeof e.method === 'string' &&
          (e.body === undefined || typeof e.body === 'string') &&
          (e.contentType === undefined || typeof e.contentType === 'string');
      });
    },
    last_captured_post: function (v) {
      return v && typeof v === 'object' && typeof v.url === 'string' && typeof v.body === 'string';
    }
  };
  // Never let an imported key shadow Object.prototype internals.
  var DANGEROUS_KEYS = { '__proto__': true, 'constructor': true, 'prototype': true };

  function sanitizeImportedData(data) {
    var clean = {};
    var skipped = [];
    Object.keys(data).forEach(function (key) {
      if (DANGEROUS_KEYS[key]) { skipped.push(key + ' (unsafe key name)'); return; }
      var validate = CONFIG_KEY_VALIDATORS[key];
      if (validate && !validate(data[key])) { skipped.push(key + ' (wrong type/shape)'); return; }
      clean[key] = data[key];
    });
    return { clean: clean, skipped: skipped };
  }

  if (btnImportConfig && importConfigFile) {
    btnImportConfig.onclick = function () {
      importConfigFile.click();
    };

    importConfigFile.onchange = function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var config = JSON.parse(ev.target.result);
          var isPlainObject = config && typeof config === 'object' && !Array.isArray(config);
          var dataIsPlainObject = isPlainObject && config.data && typeof config.data === 'object' && !Array.isArray(config.data);
          if (!dataIsPlainObject) {
            window.KHackBar.UI.setText(status, '[!] Invalid config file format.');
            return;
          }

          var result = sanitizeImportedData(config.data);
          if (Object.keys(result.clean).length === 0) {
            window.KHackBar.UI.setText(status, '[!] Config file had no valid, recognized settings to import.');
            return;
          }

          chrome.storage.local.set(result.clean, function () {
            var msg = '[+] Config imported successfully.';
            if (result.skipped.length > 0) {
              msg += ' Skipped ' + result.skipped.length + ' invalid field(s): ' + result.skipped.join(', ') + '.';
            }
            msg += ' Reloading...';
            window.KHackBar.UI.setText(status, msg);
            logAudit('config_import', '', 'Configuration imported' + (result.skipped.length ? (' (skipped: ' + result.skipped.join(', ') + ')') : ''));
            // Reload the popup to apply settings
            setTimeout(function () { location.reload(); }, window.KHackBar.Config.CONFIG_RELOAD_DELAY);
          });
        } catch (err) {
          window.KHackBar.UI.setText(status, '[!] Error importing config: ' + err.message);
        }
      };
      reader.readAsText(file);
      // Reset file input so same file can be re-imported
      importConfigFile.value = '';
    };
  }

  // ---- Clear Logs ----
  if (btnClearLogs) {
    btnClearLogs.onclick = function () {
      window.KHackBar.Audit.clearLogs(function () {
        window.KHackBar.UI.setText(status, '[+] Audit logs cleared.');
        if (auditLogContainer) {
          while (auditLogContainer.firstChild) {
            auditLogContainer.removeChild(auditLogContainer.firstChild);
          }
          var emptyMsg = document.createElement('div');
          emptyMsg.style.color = '#a3a3a3';
          emptyMsg.style.fontSize = '10px';
          emptyMsg.style.padding = '4px';
          emptyMsg.textContent = 'No log entries.';
          auditLogContainer.appendChild(emptyMsg);
        }
      });
    };
  }

  // ---- Refresh Audit Log Display ----
  function refreshAuditLogDisplay() {
    if (!auditLogContainer) return;

    window.KHackBar.Audit.getLogs(function (logs) {
      while (auditLogContainer.firstChild) {
        auditLogContainer.removeChild(auditLogContainer.firstChild);
      }

      if (!logs || logs.length === 0) {
        var emptyMsg = document.createElement('div');
        emptyMsg.style.color = '#a3a3a3';
        emptyMsg.style.fontSize = '10px';
        emptyMsg.style.padding = '4px';
        emptyMsg.textContent = 'No log entries.';
        auditLogContainer.appendChild(emptyMsg);
        return;
      }

      // Show latest logs (reversed)
      var reversed = logs.slice().reverse();
      reversed.forEach(function (entry) {
        var row = document.createElement('div');
        row.style.padding = '3px';
        row.style.borderBottom = '1px solid #3f3f3f';
        row.style.fontSize = '9px';
        row.style.lineHeight = '1.4';

        var timeSpan = document.createElement('span');
        timeSpan.style.color = '#6b7280';
        try {
          var d = new Date(entry.timestamp);
          timeSpan.textContent = d.toLocaleTimeString() + ' ';
        } catch (e) {
          timeSpan.textContent = '--:--:-- ';
        }

        var actionSpan = document.createElement('span');
        actionSpan.style.color = '#22c55e';
        actionSpan.style.fontWeight = 'bold';
        actionSpan.textContent = '[' + entry.action + '] ';

        var detailSpan = document.createElement('span');
        detailSpan.style.color = '#a3a3a3';
        detailSpan.textContent = (entry.target || '') + (entry.details ? ' - ' + entry.details : '');

        row.appendChild(timeSpan);
        row.appendChild(actionSpan);
        row.appendChild(detailSpan);
        auditLogContainer.appendChild(row);
      });
    });
  }

  // ---- Traffic Log capture toggle ----
  // Deliberately a separate flag from capture_post_enabled — never
  // auto-syncs with or implies the other toggle, so opting into one
  // doesn't silently opt the user into the other.
  if (chkCaptureTraffic) {
    chrome.storage.local.get(['capture_traffic_enabled'], function (result) {
      chkCaptureTraffic.checked = !!result.capture_traffic_enabled;
    });
    chkCaptureTraffic.onchange = function () {
      var enabled = chkCaptureTraffic.checked;
      chrome.runtime.sendMessage({ type: 'set_capture_traffic_enabled', enabled: enabled }, function () {
        void chrome.runtime.lastError;
        window.KHackBar.UI.setText(status, enabled
          ? '[+] Logging background API calls (fetch/XHR) from the active tab.'
          : '[+] Traffic logging stopped.');
      });
    };
  }

  function emptyTrafficLogPlaceholder() {
    var emptyMsg = document.createElement('div');
    emptyMsg.style.color = '#a3a3a3';
    emptyMsg.style.fontSize = '10px';
    emptyMsg.style.padding = '4px';
    emptyMsg.textContent = 'No traffic captured yet.';
    return emptyMsg;
  }

  // ---- Clear Traffic Log ----
  if (btnClearTrafficLog) {
    btnClearTrafficLog.onclick = function () {
      if (!window.KHackBar.TrafficLog) return;
      window.KHackBar.TrafficLog.clearLog(function () {
        window.KHackBar.UI.setText(status, '[+] Traffic log cleared.');
        if (trafficLogContainer) {
          while (trafficLogContainer.firstChild) {
            trafficLogContainer.removeChild(trafficLogContainer.firstChild);
          }
          trafficLogContainer.appendChild(emptyTrafficLogPlaceholder());
        }
      });
    };
  }

  // ---- Refresh Traffic Log Display ----
  function refreshTrafficLogDisplay() {
    if (!trafficLogContainer || !window.KHackBar.TrafficLog) return;

    window.KHackBar.TrafficLog.getLog(function (logs) {
      while (trafficLogContainer.firstChild) {
        trafficLogContainer.removeChild(trafficLogContainer.firstChild);
      }
      if (!logs || logs.length === 0) {
        trafficLogContainer.appendChild(emptyTrafficLogPlaceholder());
        return;
      }

      // Show latest entries first, same convention as the audit log.
      var reversed = logs.slice().reverse();
      reversed.forEach(function (entry) {
        // A row that has a body gets wrapped together with its (initially
        // collapsed) body block so the divider line lands after the body
        // too, not between the row and its own body. A bodyless row (most
        // GETs) renders identically to before — wrapper is just the row.
        var wrapper = document.createElement('div');
        wrapper.style.borderBottom = '1px solid #3f3f3f';

        var row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '4px';
        row.style.padding = '3px';
        row.style.fontSize = '9px';
        row.style.lineHeight = '1.4';

        var timeSpan = document.createElement('span');
        timeSpan.style.color = '#6b7280';
        timeSpan.style.flex = '0 0 auto';
        try {
          timeSpan.textContent = new Date(entry.timestamp).toLocaleTimeString();
        } catch (e) {
          timeSpan.textContent = '--:--:--';
        }

        var methodSpan = document.createElement('span');
        methodSpan.style.color = '#22c55e';
        methodSpan.style.fontWeight = 'bold';
        methodSpan.style.flex = '0 0 auto';
        methodSpan.textContent = '[' + (entry.method || '?') + ']';

        var urlSpan = document.createElement('span');
        urlSpan.style.color = '#a3a3a3';
        urlSpan.style.flex = '1';
        urlSpan.style.wordBreak = 'break-all';
        urlSpan.textContent = entry.url || '';
        urlSpan.title = entry.url || '';

        var copyBtn = document.createElement('button');
        copyBtn.className = 'small-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.style.fontSize = '9px';
        copyBtn.style.flex = '0 0 auto';
        copyBtn.onclick = function () {
          if (!navigator.clipboard) return;
          var entryUrl = entry.url || '';
          navigator.clipboard.writeText(entryUrl)
            .then(function () { window.KHackBar.UI.setText(status, '[+] Copied: ' + entryUrl); })
            .catch(function () { window.KHackBar.UI.setText(status, '[!] Copy failed.'); });
        };

        row.appendChild(timeSpan);
        row.appendChild(methodSpan);
        row.appendChild(urlSpan);

        // ---- Body preview (PUT/PATCH/POST/etc. with a readable body) ----
        var hasBody = typeof entry.body === 'string' && entry.body.length > 0;
        if (hasBody) {
          var shortType = entry.contentType ? entry.contentType.split(';')[0].trim() : '';
          var label = function (open) { return (open ? '▾ Body' : '▸ Body') + (shortType ? ' (' + shortType + ')' : ''); };

          var bodyBlock = document.createElement('div');
          bodyBlock.style.display = 'none';
          bodyBlock.style.padding = '2px 4px 6px 4px';
          bodyBlock.style.background = '#0a0a0a';

          var bodyPre = document.createElement('pre');
          bodyPre.style.margin = '0 0 4px 0';
          bodyPre.style.whiteSpace = 'pre-wrap';
          bodyPre.style.wordBreak = 'break-all';
          bodyPre.style.color = '#e5e5e5';
          bodyPre.style.fontFamily = 'inherit';
          bodyPre.style.fontSize = '9px';
          bodyPre.style.maxHeight = '150px';
          bodyPre.style.overflowY = 'auto';
          // Pretty-print JSON bodies for readability; anything that isn't
          // valid JSON (including a body truncated mid-object) falls back
          // to the raw text untouched.
          var displayBody = entry.body;
          try {
            if (shortType.toLowerCase().indexOf('json') !== -1) {
              displayBody = JSON.stringify(JSON.parse(entry.body), null, 2);
            }
          } catch (e) { /* not valid JSON — show as-is */ }
          bodyPre.textContent = displayBody;

          var copyBodyBtn = document.createElement('button');
          copyBodyBtn.className = 'small-btn';
          copyBodyBtn.textContent = 'Copy Body';
          copyBodyBtn.style.fontSize = '9px';
          copyBodyBtn.onclick = function () {
            if (!navigator.clipboard) return;
            var entryBody = entry.body || '';
            navigator.clipboard.writeText(entryBody)
              .then(function () { window.KHackBar.UI.setText(status, '[+] Copied body (' + entryBody.length + ' chars).'); })
              .catch(function () { window.KHackBar.UI.setText(status, '[!] Copy failed.'); });
          };

          bodyBlock.appendChild(bodyPre);
          bodyBlock.appendChild(copyBodyBtn);

          var bodyToggleBtn = document.createElement('button');
          bodyToggleBtn.className = 'small-btn';
          bodyToggleBtn.textContent = label(false);
          bodyToggleBtn.style.fontSize = '9px';
          bodyToggleBtn.style.flex = '0 0 auto';
          bodyToggleBtn.onclick = function () {
            var opening = bodyBlock.style.display === 'none';
            bodyBlock.style.display = opening ? 'block' : 'none';
            bodyToggleBtn.textContent = label(opening);
          };

          row.appendChild(bodyToggleBtn);
        }

        row.appendChild(copyBtn);
        wrapper.appendChild(row);
        if (hasBody) wrapper.appendChild(bodyBlock);
        trafficLogContainer.appendChild(wrapper);
      });
    });
  }

  // Expose refresh functions for the menu click handler
  return {
    refreshAuditLogDisplay: refreshAuditLogDisplay,
    refreshTrafficLogDisplay: refreshTrafficLogDisplay
  };
};
