// ============================================================
// scope.js - Scope validation utilities
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Scope = window.KHackBar.Scope || {};

/**
 * Normalize a scope pattern to a simple host/domain pattern.
 *
 * Supported input formats:
 *   example.com                 → example.com
 *   *.example.com               → *.example.com
 *   https://example.com/*       → example.com
 *   http://example.com/*        → example.com
 *   https://*.example.com/*     → *.example.com
 *   *://*.example.com/*         → *.example.com
 *
 * @param {string} raw - The raw scope pattern string
 * @returns {string} Normalized host pattern
 */
function normalizeScopePattern(raw) {
  if (!raw) return '';
  let p = raw.trim();

  // If it looks like a URL (contains ://), extract the host part.
  // We parse it as a URL, then return hostname (with possible wildcard prefix).
  if (p.indexOf('://') !== -1) {
    try {
      // Use a dummy base for protocol-relative patterns like *://
      let url = new URL(p.replace(/^\*:\/\//, 'https://'));
      let hostname = url.hostname.toLowerCase();
      // If the original pattern had *. in the host part, prepend *.
      if (p.toLowerCase().indexOf('*.') !== -1 && hostname.indexOf('*') === -1) {
        hostname = '*.' + hostname;
      }
      return hostname;
    } catch (e) {
      // If URL parsing fails, fall back to manual extraction
      p = p.replace(/^.*:\/\//, '').replace(/\/+$/, '').replace(/\/\*$/, '');
      return p.toLowerCase();
    }
  }

  // Strip trailing /* if present (for bare host patterns)
  p = p.replace(/\/\*$/, '');
  return p.toLowerCase();
}

/**
 * Check if a target URL is in scope relative to the configured scope pattern.
 * Uses strict domain matching so "evil-example.com" does NOT match "example.com".
 * @param {string} targetUrl - The URL to check
 * @param {string} scopePattern - The raw scope pattern (supports multiple formats)
 * @returns {{ allowed: boolean, reason?: string }}
 */
window.KHackBar.Scope.checkScope = function (targetUrl, scopePattern) {
  if (!scopePattern) {
    return { allowed: true };
  }

  let targetHost;
  try {
    targetHost = new URL(targetUrl).hostname.toLowerCase();
  } catch (e) {
    return { allowed: false, reason: 'Invalid target URL: ' + e.message };
  }

  const pattern = normalizeScopePattern(scopePattern);

  // If the pattern is an exact match, allow
  if (targetHost === pattern) {
    return { allowed: true };
  }

  // If the pattern starts with *. then match the domain
  if (pattern.startsWith('*.')) {
    const domain = pattern.slice(2);
    if (targetHost === domain || targetHost.endsWith('.' + domain)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'Scope mismatch: "' + targetHost + '" does not match pattern "' + pattern + '"'
    };
  }

  // For subdomain matching, require a dot before the pattern to prevent
  // "evil-example.com" matching "example.com"
  if (targetHost.endsWith('.' + pattern)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Scope mismatch: "' + targetHost + '" does not match pattern "' + pattern + '"'
  };
}

/**
 * Get the saved scope from chrome.storage.local. When scope enforcement has
 * been explicitly turned off (scope_enabled === false), this returns '' —
 * the same "no pattern" value checkScope already treats as allow-everything
 * — regardless of what pattern is stored, so every existing caller (EXECUTE,
 * POST, Fuzzer, Intruder) automatically honours the toggle with no changes
 * on their end. The saved pattern text itself is left untouched, so turning
 * enforcement back on doesn't require retyping it.
 *
 * scope_enabled defaults to true when unset, so upgrading from a version
 * without this toggle does not silently drop existing scope protection.
 * @param {function} callback - Called with the effective scope string
 */
window.KHackBar.Scope.getSavedScope = function (callback) {
  chrome.storage.local.get(['scope_pattern', 'scope_enabled'], function (result) {
    var enabled = result.scope_enabled !== false;
    callback(enabled ? (result.scope_pattern || '') : '');
  });
}

/**
 * Save the scope pattern to chrome.storage.local.
 * @param {string} pattern
 * @param {function} [callback]
 */
window.KHackBar.Scope.saveScope = function (pattern, callback) {
  chrome.storage.local.set({ scope_pattern: pattern }, callback || function () {});
};

/**
 * Get whether scope enforcement is enabled (defaults to true when unset).
 * @param {function} callback - Called with a boolean
 */
window.KHackBar.Scope.getScopeEnabled = function (callback) {
  chrome.storage.local.get(['scope_enabled'], function (result) {
    callback(result.scope_enabled !== false);
  });
};

/**
 * Save whether scope enforcement is enabled.
 * @param {boolean} enabled
 * @param {function} [callback]
 */
window.KHackBar.Scope.saveScopeEnabled = function (enabled, callback) {
  chrome.storage.local.set({ scope_enabled: !!enabled }, callback || function () {});
};
