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
 * @param {HTMLElement} opts.status - Status text element
 * @param {function} opts.logAudit - Audit logging function
 */
window.KHackBar.Settings.init = function (opts) {
  var scopeInput = opts.scopeInput;
  var btnSaveScope = opts.btnSaveScope;
  var btnExportConfig = opts.btnExportConfig;
  var importConfigFile = opts.importConfigFile;
  var btnImportConfig = opts.btnImportConfig;
  var btnClearLogs = opts.btnClearLogs;
  var auditLogContainer = opts.auditLogContainer;
  var status = opts.status;
  var logAudit = opts.logAudit || function () {};

  // ---- Load saved scope ----
  window.KHackBar.Scope.getSavedScope(function (scope) {
    if (scopeInput) scopeInput.value = scope;
  });

  // ---- Save Scope ----
  if (btnSaveScope && scopeInput) {
    btnSaveScope.onclick = function () {
      var pattern = scopeInput.value.trim();
      window.KHackBar.Scope.saveScope(pattern, function () {
        window.KHackBar.UI.setText(status, '[+] Scope saved: ' + (pattern || '(none)'));
        logAudit('scope_save', pattern, 'Scope pattern updated');
      });
    };
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
          if (config && config.data) {
            chrome.storage.local.set(config.data, function () {
              window.KHackBar.UI.setText(status, '[+] Config imported successfully. Reloading...');
              logAudit('config_import', '', 'Configuration imported');
              // Reload the popup to apply settings
              setTimeout(function () { location.reload(); }, window.KHackBar.Config.CONFIG_RELOAD_DELAY);
            });
          } else {
            window.KHackBar.UI.setText(status, '[!] Invalid config file format.');
          }
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

  // Expose refresh function for the menu click handler
  return {
    refreshAuditLogDisplay: refreshAuditLogDisplay
  };
};
