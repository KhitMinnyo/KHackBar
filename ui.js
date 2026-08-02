// ============================================================
// ui.js - DOM utility functions and encoding helpers
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.UI = window.KHackBar.UI || {};

/**
 * Safely set text content of an element (prevents innerHTML XSS).
 */
window.KHackBar.UI.setText = function (el, text) {
  if (el) el.textContent = text;
};

/**
 * Insert text at the cursor position in a textarea/input.
 */

window.KHackBar.UI.insertAtCursor = function (textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
};

/**
 * Wrap the currently selected text in a textarea/input with a template.
 * Used by the WAF panel: a template like "/*!{{SEL}}*\/" turns a selection
 * of "UNION SELECT" into "/*!UNION SELECT*\/". If the template has no
 * {{SEL}} marker, the selection is simply replaced by the template
 * (useful for fixed keyword-obfuscation swaps, e.g. selecting "ORDER BY"
 * and replacing it with "/**\/ORDER/**\/BY/**\/").
 * If nothing is selected, the template is inserted at the cursor with the
 * {{SEL}} portion replaced by a "STRING" placeholder that is immediately
 * selected, so the user can type over it right away.
 * @param {HTMLElement} textarea
 * @param {string} template
 */
window.KHackBar.UI.wrapSelectionWithTemplate = function (textarea, template) {
  if (!textarea) return;
  var value = textarea.value;
  // Clamp defensively in case callers ever pass stale/out-of-range indices.
  var start = Math.max(0, Math.min(textarea.selectionStart, value.length));
  var end = Math.max(start, Math.min(textarea.selectionEnd, value.length));
  var selectedText = value.substring(start, end);
  var hasMarker = template.indexOf('{{SEL}}') !== -1;
  var insertText;
  var placeholderInserted = false;

  if (selectedText) {
    insertText = template.split('{{SEL}}').join(selectedText);
  } else if (hasMarker) {
    insertText = template.split('{{SEL}}').join('STRING');
    placeholderInserted = true;
  } else {
    insertText = template;
  }

  textarea.value = value.substring(0, start) + insertText + value.substring(end);

  if (placeholderInserted) {
    var markerIndex = insertText.indexOf('STRING');
    if (markerIndex !== -1) {
      textarea.selectionStart = start + markerIndex;
      textarea.selectionEnd = start + markerIndex + 'STRING'.length;
    } else {
      textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
    }
  } else {
    textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
  }
  textarea.focus();
};

/**
 * Apply a pure string transform function to the currently selected text
 * in a textarea/input, replacing the selection with the result.
 * Returns false (and does nothing) if there is no selection, since a
 * transform has nothing to operate on.
 * @param {HTMLElement} textarea
 * @param {function(string): string} fn
 * @returns {boolean} whether the transform was applied
 */
window.KHackBar.UI.transformSelection = function (textarea, fn) {
  if (!textarea) return false;
  var value = textarea.value;
  var start = Math.max(0, Math.min(textarea.selectionStart, value.length));
  var end = Math.max(start, Math.min(textarea.selectionEnd, value.length));
  if (start === end) return false;
  var selected = value.substring(start, end);
  var replaced = fn(selected);
  textarea.value = value.substring(0, start) + replaced + value.substring(end);
  textarea.selectionStart = start;
  textarea.selectionEnd = start + replaced.length;
  textarea.focus();
  return true;
};

/**
 * Randomize the case of the currently selected text (a classic WAF
 * bypass technique against case-sensitive signature matching).
 * @param {HTMLElement} textarea
 * @returns {boolean} whether the randomization was applied
 */
window.KHackBar.UI.randomizeCaseInSelection = function (textarea) {
  return window.KHackBar.UI.transformSelection(textarea, function (str) {
    return str.split('').map(function (ch) {
      if (/[a-z]/.test(ch)) return Math.random() < 0.5 ? ch.toUpperCase() : ch;
      if (/[A-Z]/.test(ch)) return Math.random() < 0.5 ? ch.toLowerCase() : ch;
      return ch;
    }).join('');
  });
};

/**
 * Create a payload button element.
 * @param {string} label - Button text
 * @param {string} payload - Payload value to insert
 * @param {string} panelId - Panel ID to close after insertion
 * @param {HTMLElement} urlBox - The URL textarea element
 * @returns {HTMLElement} The button element
 */
window.KHackBar.UI.createPayloadButton = function (label, payload, panelId, urlBox) {
  const btn = document.createElement('button');
  btn.className = 'small-btn';
  btn.textContent = label;
  btn.title = payload;
  btn.onclick = function () {
    window.KHackBar.UI.insertAtCursor(urlBox, payload);
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = 'none';
    document.querySelectorAll('.menu-item').forEach(function (m) {
      m.classList.remove('active');
    });
  };
  return btn;
};

// ============================================================
// Encoding / Decoding functions
// ============================================================
window.KHackBar.UI.encoder = {
  url: {
    encode: function (str) { return encodeURIComponent(str); },
    decode: function (str) {
      try { return decodeURIComponent(str); } catch (e) { return str; }
    }
  },
  hex: {
    encode: function (str) {
      return '0x' + str.split('').map(function (c) {
        return c.charCodeAt(0).toString(16).padStart(2, '0');
      }).join('');
    },
    decode: function (str) {
      try {
        var hex = str.replace(/^0x/i, '');
        var out = '';
        for (var i = 0; i < hex.length; i += 2) {
          out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        }
        return out;
      } catch (e) { return str; }
    }
  },
  b64: {
    encode: function (str) {
      try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return str; }
    },
    decode: function (str) {
      try { return decodeURIComponent(escape(atob(str))); } catch (e) { return str; }
    }
  },
  html: {
    encode: function (str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    decode: function (str) {
      const div = document.createElement('div');
      div.innerHTML = str;
      return div.textContent || div.innerText || '';
    }
  },
  durl: {
    encode: function (str) { return encodeURIComponent(encodeURIComponent(str)); },
    decode: function (str) {
      try { return decodeURIComponent(decodeURIComponent(str)); } catch (e) { return str; }
    }
  },
  uni: {
    encode: function (str) {
      return str.split('').map(function (c) {
        return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
      }).join('');
    },
    decode: function (str) {
      try { return unescape(str.replace(/\\u/g, '%u')); } catch (e) { return str; }
    }
  },
  reverse: function (str) {
    return str.split('').reverse().join('');
  }
};
