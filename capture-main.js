// ============================================================
// capture-main.js — POST capture + Traffic Log (MAIN world)
// ============================================================
// Runs in the page's own JavaScript world (not the isolated content-script
// world), so it can wrap the page's real fetch() and XMLHttpRequest and see
// SPA / AJAX logins — and, separately, every fetch()/XHR call regardless of
// method, for the Traffic Log. It cannot use chrome.* APIs, so it reports
// captures via window.postMessage; capture-content.js (isolated world)
// relays them to the background worker.
//
// Wrapping fetch/XHR here means a call is seen the moment the page makes
// it — before the browser (or a service worker) decides whether to serve it
// from cache. That's what makes the Traffic Log side of this cache-immune:
// a chrome.webRequest listener, by contrast, never fires for a request that
// never reaches the network stack.

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

  // Cap on the body text carried in a Traffic Log entry — keeps a single
  // large payload (e.g. a big JSON blob) from bloating chrome.storage.local
  // across 300 entries. background.js applies the same cap independently
  // (defense in depth, in case this one changes later) — see the comment
  // there.
  var TRAFFIC_BODY_MAX_CHARS = 8192;

  // Traffic Log: reports EVERY fetch()/XHR call (any method) so the
  // Settings-panel log can show it — independent of, and in addition to,
  // the POST-only report() above, which feeds a different feature (the
  // single-slot "last captured POST" used for auto-fill/replay). Body is
  // included only when it's a plain string (same "only readable string
  // bodies" rule report() already uses — FormData/Blob/binary bodies won't
  // show one). Called unconditionally before the real fetch/XHR fires.
  function reportTraffic(url, method, body, contentType) {
    try {
      var msg = {
        __khackbar_traffic: true,
        url: String(url || location.href),
        method: String(method || 'GET').toUpperCase()
      };
      if (typeof body === 'string' && body) {
        msg.body = body.length > TRAFFIC_BODY_MAX_CHARS
          ? body.slice(0, TRAFFIC_BODY_MAX_CHARS) + '… [truncated]'
          : body;
        if (contentType) msg.contentType = contentType;
      }
      window.postMessage(msg, '*');
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

        if (init && typeof init.body !== 'undefined') {
          // Common case: fetch(url, {method, body, headers, ...}).
          var body = init.body;
          var ct = headerValue(init.headers, 'content-type');
          reportTraffic(url, method, body, ct);
          if (String(method).toUpperCase() === 'POST') {
            report(url, body, ct);
          }
        } else if (input && typeof input === 'object' && typeof input.clone === 'function') {
          // fetch(new Request(url, {method, body, headers})) instead of
          // fetch(url, {...}) — common when a page wraps fetch to inject
          // an auth header by constructing/cloning a Request. Its body
          // lives as a stream on the Request object itself, not on `init`
          // (absent/bodyless here), so it can't be read synchronously the
          // way init.body can above — this is exactly why method capture
          // worked (it falls back to input.method) while body silently
          // didn't (no such fallback existed). Clone before reading:
          // .clone() gives an independent copy, so consuming it here,
          // async via .text(), can never race or interfere with the real
          // fetch's own consumption of the original body via
          // origFetch.apply() below. Traffic Log only — deliberately not
          // wired into report()/POST-replay, keeping this fix scoped to
          // the reported gap.
          try {
            var reqCt = (input.headers && typeof input.headers.get === 'function')
              ? input.headers.get('content-type') : null;
            input.clone().text().then(function (text) {
              reportTraffic(url, method, text, reqCt);
            }).catch(function () {});
          } catch (e) {}
        } else {
          reportTraffic(url, method);
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
        reportTraffic(this.__khb_url, this.__khb_method, body, this.__khb_ct);
        if (this.__khb_method && String(this.__khb_method).toUpperCase() === 'POST') {
          report(this.__khb_url, body, this.__khb_ct);
        }
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  }
})();
