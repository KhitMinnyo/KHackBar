// ============================================================
// capture-content.js — POST capture (isolated world)
// ============================================================
// Runs in every page at document_start. Captures POST requests directly in
// the page and forwards them to the background worker. This is reliable even
// when the MV3 service worker was asleep, because chrome.runtime.sendMessage
// wakes it — unlike webRequest observation, which can miss requests entirely
// while the worker is stopped.
//
// Two sources are covered:
//   1. Native <form method="POST"> submissions — captured here via the
//      bubbling 'submit' event (the classic login-form case).
//   2. fetch() / XMLHttpRequest POSTs — captured by capture-main.js, which
//      runs in the page's MAIN world (it can see the page's own fetch/XHR)
//      and hands the data to us via window.postMessage.

(function () {
  'use strict';

  function send(url, body, contentType) {
    var absolute = url;
    try { absolute = new URL(url, location.href).href; } catch (e) {}
    try {
      console.debug('[KHackBar] sending captured POST to background:', absolute);
      chrome.runtime.sendMessage({
        type: 'captured_post_from_page',
        data: {
          url: absolute,
          body: body || '',
          contentType: contentType || 'application/x-www-form-urlencoded',
          timeStamp: Date.now()
        }
      }, function () { void chrome.runtime.lastError; });
    } catch (e) { /* extension context gone — ignore */ }
  }

  // ---- 1. Native form submissions ----
  document.addEventListener('submit', function (e) {
    try {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      if ((form.method || 'GET').toUpperCase() !== 'POST') return;

      var enctype = (form.enctype || 'application/x-www-form-urlencoded').toLowerCase();
      var fd = new FormData(form);
      var body;
      if (enctype.indexOf('multipart/form-data') !== -1) {
        // Serialize as urlencoded anyway (readable + re-sendable for fuzzing);
        // file fields are represented by their filename.
        var partsM = [];
        fd.forEach(function (value, key) {
          var v = (value && value.name != null && typeof value === 'object') ? value.name : value;
          partsM.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
        });
        body = partsM.join('&');
        enctype = 'application/x-www-form-urlencoded';
      } else {
        var parts = [];
        fd.forEach(function (value, key) {
          parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        });
        body = parts.join('&');
      }

      send(form.action || location.href, body, enctype);
    } catch (err) { /* never break the page */ }
  }, true);

  // ---- 2. Relay fetch/XHR reports from the MAIN world ----
  window.addEventListener('message', function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.__khackbar_post !== true) return;
    send(d.url, d.body, d.contentType);
  }, false);
})();
