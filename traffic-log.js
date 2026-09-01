// ============================================================
// traffic-log.js - API traffic log read/clear (Settings panel)
// ============================================================
// Read/clear side ONLY for the capped `traffic_logs` list that
// background.js's webRequest listener writes into (see the "API Traffic
// Log" section near the end of background.js). There is deliberately no
// logEvent()-style write function here, unlike audit.js: the only writer
// is background.js's service worker, which cannot load this file — a
// service worker has no `window` global, so the `window.KHackBar.TrafficLog
// = ...` line below would throw there, and background.js does not
// importScripts() any popup-side KHackBar.* module. background.js instead
// writes directly to chrome.storage.local via its own local
// appendTrafficLogEntry() helper.

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.TrafficLog = window.KHackBar.TrafficLog || {};

/**
 * Get all traffic-log entries from chrome.storage.local.
 * @param {function} callback - Called with the entries array, each
 *   { timestamp, method, url, tabId }, in the order they were captured
 *   (oldest first).
 */
window.KHackBar.TrafficLog.getLog = function (callback) {
  chrome.storage.local.get(['traffic_logs'], function (result) {
    callback(result.traffic_logs || []);
  });
};

/**
 * Clear all traffic-log entries from chrome.storage.local.
 * @param {function} [callback]
 */
window.KHackBar.TrafficLog.clearLog = function (callback) {
  chrome.storage.local.set({ traffic_logs: [] }, callback || function () {});
};
