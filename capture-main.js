// ============================================================
// capture-main.js — POST capture (MAIN world)
// ============================================================
// Runs in the page's own JavaScript world (not the isolated content-script
// world), so it can wrap the page's real fetch() and XMLHttpRequest and see
// SPA / AJAX logins. It cannot use chrome.* APIs, so it reports captures via
// window.postMessage; capture-content.js (isolated world) relays them to the
// background worker.

(function () {
  'use strict';

  function report(url, body, contentType) {
    if (typeof body !== 'string' || !body) return; // only readable string bodies
    try {
      console.debug('[KHackBar] captured POST (main world):', url, body.slice(0, 120));
      window.postMessage({
        __khackbar_post: true,
        url: String(url || location.href),
        body: body,
        contentType: contentType || 'application/x-www-form-urlencoded'
      }, '*');
    } catch (e) {}
  }

  function headerValue(headers, name) {
    if (!headers) return null;
    try {
      if (headers instanceof Headers) return headers.get(name);
      if (Array.isArray(headers)) {
        for (var i = 0; i < headers.length; i++) {
          if (String(headers[i][0]).toLowerCase() === name) return headers[i][1];
        }
        return null;
      }
      for (var k in headers) {
        if (String(k).toLowerCase() === name) return headers[k];
      }
    } catch (e) {}
    return null;
  }

  // ---- fetch() ----
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url);
        var method = (init && init.method) || (input && input.method) || 'GET';
        if (String(method).toUpperCase() === 'POST') {
          var body = init && init.body;
          var ct = headerValue(init && init.headers, 'content-type');
          report(url, body, ct);
        }
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }

  // ---- Programmatic form.submit() ----
  // Critical for ASP.NET / __doPostBack and any JS that calls theForm.submit():
  // calling form.submit() directly does NOT fire the 'submit' event, so the
  // isolated-world submit listener never sees these. Hook it here in the MAIN
  // world (where the page's real HTMLFormElement lives) to catch them.
  function serializeForm(form) {
    var parts = [];
    try {
      var fd = new FormData(form);
      fd.forEach(function (value, key) {
        var v = (value && typeof value === 'object' && value.name != null) ? value.name : value;
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(v));
      });
    } catch (e) {}
    return parts.join('&');
  }

  var FormProto = window.HTMLFormElement && window.HTMLFormElement.prototype;
  if (FormProto && FormProto.submit) {
    var origFormSubmit = FormProto.submit;
    FormProto.submit = function () {
      try {
        if ((this.method || 'GET').toUpperCase() === 'POST') {
          report(this.action || location.href, serializeForm(this),
                 this.enctype || 'application/x-www-form-urlencoded');
        }
      } catch (e) {}
      return origFormSubmit.apply(this, arguments);
    };
  }

  // ---- XMLHttpRequest ----
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var origOpen = XHR.prototype.open;
    var origSetHeader = XHR.prototype.setRequestHeader;
    var origSend = XHR.prototype.send;

    XHR.prototype.open = function (method, url) {
      this.__khb_method = method;
      this.__khb_url = url;
      this.__khb_ct = null;
      return origOpen.apply(this, arguments);
    };
    XHR.prototype.setRequestHeader = function (name, value) {
      try {
        if (String(name).toLowerCase() === 'content-type') this.__khb_ct = value;
      } catch (e) {}
      return origSetHeader.apply(this, arguments);
    };
    XHR.prototype.send = function (body) {
      try {
        if (this.__khb_method && String(this.__khb_method).toUpperCase() === 'POST') {
          report(this.__khb_url, body, this.__khb_ct);
        }
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  }
})();
