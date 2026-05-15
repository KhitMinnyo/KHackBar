// ============================================================
// audit.js - Audit logging functions
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Audit = window.KHackBar.Audit || {};

/**
 * Log an audit event to chrome.storage.local.
 * @param {string} action - The action name (e.g., 'execute', 'fuzzer_start')
 * @param {string} target - The target URL
 * @param {string} details - Optional details string
 */
window.KHackBar.Audit.logEvent = function (action, target, details) {
  const entry = {
    timestamp: Date.now(),
    action: action,
    target: target || '',
    details: details || ''
  };

  chrome.storage.local.get(['audit_logs'], function (result) {
    var logs = result.audit_logs || [];
    logs.push(entry);
    // Keep only the last N entries (configurable via Config.MAX_AUDIT_LOGS)
    var maxLogs = window.KHackBar.Config ? window.KHackBar.Config.MAX_AUDIT_LOGS : 500;
    if (logs.length > maxLogs) {
      logs = logs.slice(logs.length - maxLogs);
    }
    chrome.storage.local.set({ audit_logs: logs });
  });
};

/**
 * Get all audit logs from chrome.storage.local.
 * @param {function} callback - Called with the logs array
 */
window.KHackBar.Audit.getLogs = function (callback) {
  chrome.storage.local.get(['audit_logs'], function (result) {
    callback(result.audit_logs || []);
  });
};

/**
 * Clear all audit logs from chrome.storage.local.
 * @param {function} [callback]
 */
window.KHackBar.Audit.clearLogs = function (callback) {
  chrome.storage.local.set({ audit_logs: [] }, callback || function () {});
};
