// ============================================================
// capture-content.js — POST capture + Traffic Log (isolated world)
// ============================================================
// Runs in every page at document_start. Captures POST requests (for replay)
// and, separately, every fetch()/XHR call's method+URL (for the read-only
// Traffic Log), forwarding both to the background worker. This in-page
// approach is reliable even when the MV3 service worker was asleep, because
// chrome.runtime.sendMessage wakes it — and, for the Traffic Log
// specifically, even when the browser (or a service worker) serves the
// request from cache: the page still calls fetch()/XHR either way, so
// capture-main.js (which wraps them) still sees it, unlike a
// chrome.webRequest listener, which never fires for a request the network
// stack never actually makes.
//
// Sources covered:
//   1. Native <form method="POST"> submissions — captured here via the
//      bubbling 'submit' event (the classic login-form case).
//   2. fetch() / XMLHttpRequest calls — captured by capture-main.js, which
//      runs in the page's MAIN world (it can see the page's own fetch/XHR)
//      and hands the data to us via window.postMessage: POST bodies for
//      replay, and every call's method+URL for the Traffic Log.

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

  function sendTraffic(url, method, body, contentType) {
    var absolute = url;
    try { absolute = new URL(url, location.href).href; } catch (e) {}
    try {
      var data = { url: absolute, method: method || 'GET', timeStamp: Date.now() };
      if (typeof body === 'string' && body) {
        data.body = body;
        if (contentType) data.contentType = contentType;
      }
      chrome.runtime.sendMessage({
        type: 'captured_traffic_from_page',
        data: data
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
    if (!d) return;
    if (d.__khackbar_post === true) {
      send(d.url, d.body, d.contentType);
      return;
    }
    if (d.__khackbar_traffic === true) {
      sendTraffic(d.url, d.method, d.body, d.contentType);
    }
  }, false);
})();
