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
