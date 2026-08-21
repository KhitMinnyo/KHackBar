// ============================================================
// popup.js - Main initializer for KHackBar
// ============================================================
// This file wires together all modules after DOMContentLoaded.
// Modules are loaded via separate <script> tags and expose
// their functions/objects via the KHackBar namespace.

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // ============================================================
  // 0. Module startup verification
  // ============================================================
  var REQUIRED_MODULES = [
    { name: 'KHackBar.UI',       key: 'UI' },
    { name: 'KHackBar.Scope',    key: 'Scope' },
    { name: 'KHackBar.Audit',    key: 'Audit' },
    { name: 'KHackBar.Payloads', key: 'Payloads' },
    { name: 'KHackBar.Headers',  key: 'Headers' },
    { name: 'KHackBar.Cookies',  key: 'Cookies' },
    { name: 'KHackBar.Fuzzer',   key: 'Fuzzer' },
    { name: 'KHackBar.Settings', key: 'Settings' },
    { name: 'KHackBar.Waf',      key: 'Waf' },
    { name: 'KHackBar.Union',    key: 'Union' }
  ];

  var allOk = true;
  REQUIRED_MODULES.forEach(function (mod) {
    if (!window.KHackBar || !window.KHackBar[mod.key]) {
      console.error('KHackBar startup: ' + mod.name + ' is missing — some features will not work');
      allOk = false;
    }
  });

  if (!allOk) {
    console.warn('KHackBar startup: One or more modules failed to load. The extension may have limited functionality.');
  }

  // ---- DOM References ----

  var urlBox = document.getElementById('url_box');
  var postBox = document.getElementById('post_box');
  var status = document.getElementById('status');
  var contentType = document.getElementById('content_type');
  var postResponse = document.getElementById('post_response');
  var btnLoginAuth = document.getElementById('btn_login_auth');

  // ---- Helper: show a response body in the readonly post_response box ----
  function showPostResponse(text) {
    if (!postResponse) return;
    postResponse.style.display = 'block';
    postResponse.value = (text == null ? '' : String(text));
  }

  var btnLoad = document.getElementById('btn_load');
  var btnSplit = document.getElementById('btn_split');
  var btnExecute = document.getElementById('btn_execute');
  var btnExecutePost = document.getElementById('btn_execute_post');
  var btnExecutePostTab = document.getElementById('btn_execute_post_tab');

  // ---- Encoding buttons ----
  var encBtns = {
    url: document.getElementById('btn_enc_url'),
    durl: document.getElementById('btn_dec_url'),
    hex: document.getElementById('btn_enc_hex'),
    dhex: document.getElementById('btn_dec_hex'),
    b64: document.getElementById('btn_enc_b64'),
    db64: document.getElementById('btn_dec_b64'),
    html: document.getElementById('btn_enc_html'),
    dhtml: document.getElementById('btn_dec_html'),
    durl2: document.getElementById('btn_enc_durl'),
    ddurl2: document.getElementById('btn_dec_durl'),
    uni: document.getElementById('btn_enc_uni'),
    duni: document.getElementById('btn_dec_uni'),
    reverse: document.getElementById('btn_reverse')
  };

  // ---- Helper: set status text safely ----
  function setStatus(msg) {
    KHackBar.UI.setText(status, msg);
  }

  // ---- Helper: log audit event ----
  function logAudit(action, target, details) {
    KHackBar.Audit.logEvent(action, target, details);
  }

  // ============================================================
  // 1. Load current tab URL into urlBox
  // ============================================================
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs && tabs[0] && tabs[0].url) {
      urlBox.value = tabs[0].url;
    }
  });

  // ============================================================
  // 2. Encoding buttons
  // ============================================================
  // Each encoder/decoder works on the SELECTED text in whichever editable field
  // you were last typing/selecting in — the URL box, the POST box, or any of the
  // Intruder fields (URL / request body / cookie). This lets you transform just a
  // payload (e.g. URL-decode only the captured POST value) instead of mangling the
  // whole field. The transformed text stays selected, so clicking the matching
  // D-* button decodes it straight back. With nothing selected it falls back to
  // the whole field (the old behaviour).
  //
  // We track the last-focused field because clicking an encode button moves focus
  // to the button itself, so document.activeElement is no longer the textarea by
  // the time the click handler runs.
  var lastEditField = urlBox;
  function isEditableField(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (el.tagName === 'INPUT') {
      var t = (el.type || 'text').toLowerCase();
      return (t === 'text' || t === 'search' || t === 'url') && !el.readOnly && !el.disabled;
    }
    return false;
  }
  document.addEventListener('focusin', function (e) {
    if (isEditableField(e.target)) lastEditField = e.target;
  });

  function applyEnc(fn, label) {
    var field = isEditableField(lastEditField) ? lastEditField : urlBox;
    var name = field === urlBox ? 'URL box' : 'field';
    var appliedToSelection = KHackBar.UI.transformSelection(field, fn);
    if (!appliedToSelection) {
      field.value = fn(field.value);
      setStatus('[+] ' + label + ' applied to the whole ' + name + ' (select text first to target just a payload).');
    } else {
      setStatus('[+] ' + label + ' applied to selection.');
    }
  }

  function wireEnc(btn, fn, label) {
    if (btn) btn.onclick = function () { applyEnc(fn, label); };
  }

  var E = KHackBar.UI.encoder;
  wireEnc(encBtns.url,    E.url.encode,   'URL encode');
  wireEnc(encBtns.durl,   E.url.decode,   'URL decode');
  wireEnc(encBtns.hex,    E.hex.encode,   'Hex encode');
  wireEnc(encBtns.dhex,   E.hex.decode,   'Hex decode');
  wireEnc(encBtns.b64,    E.b64.encode,   'Base64 encode');
  wireEnc(encBtns.db64,   E.b64.decode,   'Base64 decode');
  wireEnc(encBtns.html,   E.html.encode,  'HTML encode');
  wireEnc(encBtns.dhtml,  E.html.decode,  'HTML decode');
  wireEnc(encBtns.durl2,  E.durl.encode,  'Double-URL encode');
  wireEnc(encBtns.ddurl2, E.durl.decode,  'Double-URL decode');
  wireEnc(encBtns.uni,    E.uni.encode,   'Unicode encode');
  wireEnc(encBtns.duni,   E.uni.decode,   'Unicode decode');
  wireEnc(encBtns.reverse, E.reverse,     'Reverse');

  // ============================================================
  // 3. LOAD / SPLIT / EXECUTE / POST buttons
  // ============================================================

  // LOAD: Read the current active tab URL into urlBox (no navigation)
  if (btnLoad) {
    btnLoad.onclick = function () {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0] && tabs[0].url) {
          urlBox.value = tabs[0].url;
          setStatus('[+] URL loaded from active tab.');
          logAudit('load', tabs[0].url, 'URL loaded into urlBox from active tab');
        } else {
          setStatus('[!] No active tab or URL found.');
        }
      });
    };
  }

  // SPLIT: Split URL parameters into new lines
  if (btnSplit) {
    btnSplit.onclick = function () {
      var val = urlBox.value;
      var qIndex = val.indexOf('?');
      if (qIndex === -1) {
        setStatus('[!] No query string to split.');
        return;
      }
      var base = val.substring(0, qIndex + 1);
      var qs = val.substring(qIndex + 1);
      var params = qs.split('&');
      urlBox.value = base + params.join('\n');
      setStatus('[+] URL split into ' + params.length + ' lines.');
    };
  }

  // ---- Helper: collapse a (possibly SPLIT'd) multi-line URL back into one line ----
  // SPLIT turns "page?a=1&b=2" into "page?a=1\nb=2" (one param per line).
  // Joining with '&' restores the query string correctly; a plain '' join
  // (the old behavior) glued params together with no separator and broke the URL.
  function collapseUrl(value) {
    return value.split('\n').map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; })
      .join('&');
  }

  // ---- Helper: build a tiny self-submitting HTML page that replays the POST
  // as a REAL browser navigation (used by "POST -> Tab" below). Same technique
  // as the Intruder's "Generate CSRF PoC": a plain <form> for urlencoded/
  // multipart bodies, so the tab performs a normal top-level POST with full
  // cookie/session handling — redirects and the resulting page are all
  // visible, exactly as if the user had submitted the form themselves.
  function htmlEscapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildPostSelfSubmitHtml(url, body, contentType) {
    var ctype = (contentType || 'application/x-www-form-urlencoded').split(';')[0].trim().toLowerCase();

    if (ctype === 'application/x-www-form-urlencoded' || ctype === 'multipart/form-data') {
      var enctypeAttr = ctype === 'multipart/form-data' ? ' enctype="multipart/form-data"' : '';
      var inputs = '';
      (body || '').split('&').forEach(function (pair) {
        if (!pair) return;
        var eq = pair.indexOf('=');
        var rawK = eq === -1 ? pair : pair.slice(0, eq);
        var rawV = eq === -1 ? '' : pair.slice(eq + 1);
        var k, v;
        try { k = decodeURIComponent(rawK.replace(/\+/g, ' ')); } catch (e) { k = rawK; }
        try { v = decodeURIComponent(rawV.replace(/\+/g, ' ')); } catch (e) { v = rawV; }
        inputs += '      <input type="hidden" name="' + htmlEscapeAttr(k) + '" value="' + htmlEscapeAttr(v) + '">\n';
      });
      return '<!DOCTYPE html>\n<html>\n  <body>\n    <form action="' + htmlEscapeAttr(url) + '" method="POST"' + enctypeAttr + '>\n' +
             inputs +
             '    </form>\n    <script>document.forms[0].submit();</script>\n  </body>\n</html>\n';
    }

    // JSON / raw body — a native <form> can't set this content-type, so fall
    // back to a credentialed fetch inside the tab and print the result there.
    // Cross-origin this triggers a CORS preflight, so it only works against
    // targets that don't enforce CORS (same-origin/local targets are fine).
    return '<!DOCTYPE html>\n<html>\n  <body style="font:12px monospace; background:#0a0a0a; color:#22c55e; padding:16px; white-space:pre-wrap;">Submitting POST to ' + htmlEscapeAttr(url) + ' …\n' +
           '    <script>\n' +
           '      fetch(' + JSON.stringify(url) + ', {\n' +
           '        method: "POST",\n' +
           '        credentials: "include",\n' +
           '        headers: { "Content-Type": ' + JSON.stringify(ctype) + ' },\n' +
           '        body: ' + JSON.stringify(body || '') + '\n' +
           '      }).then(function (r) { return r.text().then(function (t) { document.body.textContent += "\\n\\nStatus: " + r.status + "\\n\\n" + t; }); })\n' +
           '        .catch(function (e) { document.body.textContent += "\\n\\nRequest failed: " + e.message; });\n' +
           '    </script>\n  </body>\n</html>\n';
  }

  // EXECUTE: Send GET request to the URL
  if (btnExecute) {
    btnExecute.onclick = function () {
      var target = collapseUrl(urlBox.value);
      if (!target) {
        setStatus('[!] URL box is empty.');
        return;
      }
      KHackBar.Scope.getSavedScope(function (scopePattern) {
        var scopeCheck = KHackBar.Scope.checkScope(target, scopePattern);
        if (!scopeCheck.allowed) {
          setStatus('[!] ' + scopeCheck.reason);
          return;
        }
        setStatus('[+] Executing GET: ' + target);
        logAudit('execute_get', target, 'GET request executed');
        // Check scope and execute
        var tabUrl = target;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.update(tabs[0].id, { url: tabUrl });
          } else {
            chrome.tabs.create({ url: tabUrl });
          }
        });
      });
    };
  }

  // POST: Send POST request
  if (btnExecutePost) {
    btnExecutePost.onclick = function () {
      var target = collapseUrl(urlBox.value);
      var postData = postBox ? postBox.value.trim() : '';
      var ct = contentType ? contentType.value : 'application/x-www-form-urlencoded';

      if (!target) {
        setStatus('[!] URL box is empty.');
        return;
      }
      KHackBar.Scope.getSavedScope(function (scopePattern) {
        var scopeCheck = KHackBar.Scope.checkScope(target, scopePattern);
        if (!scopeCheck.allowed) {
          setStatus('[!] ' + scopeCheck.reason);
          return;
        }
        setStatus('[+] Executing POST: ' + target);
        logAudit('execute_post', target, 'POST request with content-type: ' + ct);

        // Send POST via background script
        chrome.runtime.sendMessage({
          type: 'execute_post',
          url: target,
          data: postData,
          contentType: ct
        }, function (response) {
          if (response && response.success) {
            var lengthNote = (typeof response.length === 'number') ? (', ' + response.length + ' bytes') : '';
            setStatus('[+] POST response received (' + response.status + lengthNote + ').');
            if (typeof response.body === 'string') {
              showPostResponse(response.body + (response.bodyTruncated ? '\n\n[…truncated…]' : ''));
            }
          } else if (response && response.error) {
            setStatus('[!] POST error: ' + response.error);
          }
        });
      });
    };
  }

  // 🔑 Login & Set Auth: send the POST (a JSON login), pull a field out of the
  // JSON response (the token), and inject it as a request header on the target
  // host — the curl `TOKEN=$(... | jq -r '.token')` + `-H "Authorization: ..."`
  // flow, without leaving the panel.
  function getByPath(obj, path) {
    // Dotted path with optional [n] array indices, e.g. "data.tokens[0].value".
    var parts = String(path || '').replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  if (btnLoginAuth) {
    btnLoginAuth.onclick = function () {
      var target = collapseUrl(urlBox.value);
      var postData = postBox ? postBox.value.trim() : '';
      var ct = contentType ? contentType.value : 'application/json';
      var tokenPath = (document.getElementById('auth_token_path') || {}).value || 'token';
      var headerName = ((document.getElementById('auth_header_name') || {}).value || 'Authorization').trim();
      var prefix = (document.getElementById('auth_prefix') || {}).value;
      if (prefix == null) prefix = '';
      var patternInput = ((document.getElementById('auth_url_pattern') || {}).value || '').trim();

      if (!target) { setStatus('[!] URL box is empty.'); return; }
      if (!/^https?:\/\//i.test(target)) { setStatus('[!] URL must start with http:// or https://.'); return; }
      if (!headerName) { setStatus('[!] Header name is empty.'); return; }

      // Default the injection scope to the login URL's host if none was given.
      var urlPattern = patternInput;
      if (!urlPattern) {
        try { urlPattern = '*://' + new URL(target).host + '/*'; }
        catch (e) { urlPattern = '*://*/*'; }
      }

      KHackBar.Scope.getSavedScope(function (scopePattern) {
        var scopeCheck = KHackBar.Scope.checkScope(target, scopePattern);
        if (!scopeCheck.allowed) { setStatus('[!] ' + scopeCheck.reason); return; }

        setStatus('[+] Logging in: ' + target + ' …');
        logAudit('login_auth', target, 'Login POST to extract "' + tokenPath + '" → header ' + headerName);

        chrome.runtime.sendMessage({
          type: 'execute_post',
          url: target,
          data: postData,
          contentType: ct
        }, function (response) {
          if (!response || !response.success) {
            setStatus('[!] Login failed: ' + ((response && response.error) || 'no response') + '.');
            return;
          }
          if (typeof response.body === 'string') {
            showPostResponse(response.body + (response.bodyTruncated ? '\n\n[…truncated…]' : ''));
          }
          var token;
          try {
            var json = JSON.parse(response.body);
            token = getByPath(json, tokenPath);
          } catch (e) {
            setStatus('[!] Login returned ' + response.status + ' but the body was not valid JSON — check the response below.');
            return;
          }
          if (token == null || token === '') {
            setStatus('[!] No value found at "' + tokenPath + '" in the response (status ' + response.status + '). Check the field path against the body below.');
            return;
          }
          if (typeof token !== 'string') token = String(token);

          var headerValue = prefix + token;
          var headerObj = { header: headerName, value: headerValue, operation: 'set' };

          // Persist so the HEADERS panel reflects it, then apply the DNR rule.
          chrome.storage.local.set({
            custom_headers: [headerObj],
            header_url_pattern: urlPattern
          }, function () {
            chrome.runtime.sendMessage({
              type: 'apply_headers',
              urlPattern: urlPattern,
              headers: [headerObj]
            }, function (applyResp) {
              if (applyResp && applyResp.success) {
                var shown = token.length > 16 ? (token.slice(0, 12) + '…') : token;
                setStatus('[+] Auth set — ' + headerName + ': ' + prefix + shown + ' now injected on ' + urlPattern + '. (See HEADERS panel.)');
                logAudit('login_auth_applied', urlPattern, headerName + ' header applied from token "' + tokenPath + '"');
              } else {
                setStatus('[!] Extracted the token but failed to apply the header: ' + ((applyResp && applyResp.error) || 'unknown') + '.');
              }
            });
          });
        });
      });
    };
  }

  // POST -> Tab: submit the POST as a real navigation in the active tab,
  // like EXECUTE does for GET, instead of an invisible background fetch.
  // The plain "POST" button above is still there for silent/background
  // testing (checking status codes without disturbing the tab); this one is
  // for when you want to actually see the result — a login redirecting to a
  // dashboard, a CSRF PoC's real effect, etc.
  if (btnExecutePostTab) {
    btnExecutePostTab.onclick = function () {
      var target = collapseUrl(urlBox.value);
      var postData = postBox ? postBox.value.trim() : '';
      var ct = contentType ? contentType.value : 'application/x-www-form-urlencoded';

      if (!target) {
        setStatus('[!] URL box is empty.');
        return;
      }
      if (!/^https?:\/\//i.test(target)) {
        setStatus('[!] URL must start with http:// or https://.');
        return;
      }
      KHackBar.Scope.getSavedScope(function (scopePattern) {
        var scopeCheck = KHackBar.Scope.checkScope(target, scopePattern);
        if (!scopeCheck.allowed) {
          setStatus('[!] ' + scopeCheck.reason);
          return;
        }

        var html = buildPostSelfSubmitHtml(target, postData, ct);
        var blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs && tabs[0] && tabs[0].id) {
            chrome.tabs.update(tabs[0].id, { url: blobUrl });
            setStatus('[+] Submitting POST in the active tab: ' + target);
            logAudit('execute_post_tab', target, 'POST submitted as a real tab navigation, content-type: ' + ct);
          } else {
            setStatus('[!] No active tab found.');
          }
        });
      });
    };
  }

  // ---- Copy as sqlmap command ----
  // Turns the current POST section (URL + POST data + content-type + the live
  // cookies for that host) into a ready-to-run sqlmap command.
  (function () {
    var btnSqlmap = document.getElementById('btn_copy_sqlmap');
    var sqlmapOut = document.getElementById('sqlmap_output');
    if (!btnSqlmap) return;

    function shq(s) { return '"' + String(s).replace(/(["$`\\])/g, '\\$1') + '"'; }

    btnSqlmap.onclick = function () {
      var url = collapseUrl(urlBox.value);
      if (!/^https?:\/\//i.test(url)) { setStatus('[!] Enter a full http(s) URL first.'); return; }
      var data = postBox ? postBox.value.trim() : '';
      var ct = contentType ? contentType.value : '';

      function build(cookieStr) {
        var cmd = 'sqlmap -u ' + shq(url);
        if (data) cmd += ' --data=' + shq(data);
        if (cookieStr) cmd += ' --cookie=' + shq(cookieStr);
        // JSON bodies: hint sqlmap to treat the data as-is.
        if (ct && ct.toLowerCase().indexOf('json') !== -1) cmd += ' --headers=' + shq('Content-Type: application/json');
        cmd += ' --batch --level=2 --risk=2';
        if (sqlmapOut) { sqlmapOut.style.display = 'block'; sqlmapOut.value = cmd; }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(cmd)
            .then(function () { setStatus('[+] sqlmap command copied to clipboard.'); })
            .catch(function () { if (sqlmapOut) sqlmapOut.select(); setStatus('[!] Copy failed — command shown below, press Ctrl+C.'); });
        } else {
          if (sqlmapOut) sqlmapOut.select();
          setStatus('[+] sqlmap command generated (select + copy below).');
        }
      }

      // Pull the live cookies for the target so authenticated SQLi works.
      try {
        chrome.cookies.getAll({ url: url }, function (cookies) {
          var cookieStr = (!chrome.runtime.lastError && cookies && cookies.length)
            ? cookies.map(function (c) { return c.name + '=' + c.value; }).join('; ') : '';
          build(cookieStr);
        });
      } catch (e) {
        build('');
      }
    };
  })();

  // ============================================================
  // 3b. POST Capture (Burp-style auto-fill)
  // ============================================================
  (function () {
    var chkCapturePost = document.getElementById('chk_capture_post');
    var capturePostStatus = document.getElementById('capture_post_status');
    var btnLoadLastCapture = document.getElementById('btn_load_last_capture');

    if (!chkCapturePost) return;

    function describeCapture(data) {
      var when = data.timeStamp ? new Date(data.timeStamp).toLocaleTimeString() : '';
      return '[captured ' + when + '] ' + data.url;
    }

    function applyCapture(data, announce) {
      urlBox.value = data.url;
      postBox.value = data.body;

      // Try to match the captured content-type to one of the dropdown's
      // presets; the real header often has extra params (e.g. multipart's
      // "; boundary=..."), so compare just the base type.
      var baseType = (data.contentType || '').split(';')[0].trim().toLowerCase();
      var matched = false;
      if (contentType) {
        for (var i = 0; i < contentType.options.length; i++) {
          if (contentType.options[i].value === baseType) {
            contentType.value = baseType;
            matched = true;
            break;
          }
        }
      }

      if (capturePostStatus) capturePostStatus.textContent = describeCapture(data);

      if (announce) {
        var note = matched ? '' : (' (original content-type: ' + data.contentType + ')');
        if (data.reconstructed && !matched) {
          note = ' (reconstructed as urlencoded; original content-type: ' + data.contentType + ')';
        }
        setStatus('[+] Captured POST from active tab: ' + data.url + note);
        logAudit('post_captured', data.url, 'Auto-captured' + (data.reconstructed ? ' (reconstructed form fields)' : ''));
      }
    }

    // Restore the user's last explicit choice instead of forcing capture back
    // on every time the panel opens — auto-re-enabling silently defeated
    // turning it off (unchecking it wouldn't stick past a panel reopen, and
    // capture-content.js/capture-main.js run on every site regardless, so
    // this flag is the only thing standing between "off" and every POST body
    // on every page getting captured). Fresh installs (never toggled before)
    // default to OFF: capturing credentials from unrelated sites should be
    // opt-in, not opt-out.
    chrome.storage.local.get(['last_captured_post', 'capture_post_enabled'], function (result) {
      var enabled = !!result.capture_post_enabled;
      chkCapturePost.checked = enabled;
      chrome.runtime.sendMessage({ type: 'set_capture_post_enabled', enabled: enabled }, function () {
        void chrome.runtime.lastError;
      });
      if (result.last_captured_post) {
        capturePostStatus.textContent = describeCapture(result.last_captured_post);
      }
    });

    chkCapturePost.onchange = function () {
      var enabled = chkCapturePost.checked;
      chrome.runtime.sendMessage({ type: 'set_capture_post_enabled', enabled: enabled }, function () {
        setStatus(enabled
          ? '[+] Capturing POST requests from the active tab — submit a form to auto-fill.'
          : '[+] POST capture stopped.');
      });
    };

    if (btnLoadLastCapture) {
      btnLoadLastCapture.onclick = function () {
        chrome.storage.local.get(['last_captured_post'], function (result) {
          if (result.last_captured_post) {
            applyCapture(result.last_captured_post, true);
          } else {
            setStatus('[!] No captured POST request yet.');
          }
        });
      };
    }

    // Live updates while the panel is open and capture is enabled.
    chrome.runtime.onMessage.addListener(function (message) {
      if (message && message.type === 'post_captured' && message.data) {
        applyCapture(message.data, true);
      }
    });
  })();

  // ============================================================
  // 4. Payload panel population
  // ============================================================
  var categories = [
    { id: 'sql', menuId: 'menu_sql', panelId: 'sql_panel' },
    { id: 'union', menuId: 'menu_union', panelId: 'union_panel' },
    { id: 'wafunion', menuId: 'menu_wafunion', panelId: 'wafunion_panel' },
    { id: 'waf', menuId: 'menu_waf', panelId: 'waf_panel' },
    { id: 'mysqldios', menuId: 'menu_mysqldios', panelId: 'mysqldios_panel' },
    { id: 'postgredios', menuId: 'menu_postgredios', panelId: 'postgredios_panel' },
    { id: 'localdios', menuId: 'menu_localdios', panelId: 'localdios_panel' },
    { id: 'mssql', menuId: 'menu_mssql', panelId: 'mssql_panel' },
    { id: 'error', menuId: 'menu_error', panelId: 'error_panel' },
    { id: 'xss', menuId: 'menu_xss', panelId: 'xss_panel' },
    { id: 'lfi', menuId: 'menu_lfi', panelId: 'lfi_panel' },
    { id: 'nosql', menuId: 'menu_nosql', panelId: 'nosql_panel' },
    { id: 'ssrf', menuId: 'menu_ssrf', panelId: 'ssrf_panel' },
    { id: 'ssrf_rce', menuId: 'menu_ssrf_rce', panelId: 'ssrf_rce_panel' },
    { id: 'ssti', menuId: 'menu_ssti', panelId: 'ssti_panel' },
    { id: 'blind', menuId: 'menu_blind', panelId: 'blind_panel' },
    { id: 'replace', menuId: 'menu_replace', panelId: 'replace_panel' },
    { id: 'osci', menuId: 'menu_osci', panelId: 'osci_panel' }
  ];

  categories.forEach(function (cat) {
    // 'waf', 'union' and 'wafunion' are populated separately by their own
    // renderers (see waf.js / union.js) — they use generated/selection-based
    // buttons instead of a flat list of fixed payloads.
    if (cat.id === 'waf' || cat.id === 'union' || cat.id === 'wafunion' || cat.id === 'ssti') return;

    var panel = document.getElementById(cat.panelId);
    if (!panel) return;

    var payloads = KHackBar.Payloads.predatorData[cat.id];
    if (!payloads) return;

    // Clear panel and populate with buttons
    while (panel.firstChild) {
      panel.removeChild(panel.firstChild);
    }

    payloads.forEach(function (payload) {
      var btn = KHackBar.UI.createPayloadButton(
        payload.length > 25 ? payload.substring(0, 22) + '...' : payload,
        payload,
        cat.panelId,
        urlBox
      );
      panel.appendChild(btn);
    });
  });

  // WAF panel: selection-based bypass templates/transforms (see waf.js)
  KHackBar.Waf.render(document.getElementById('waf_panel'), urlBox, setStatus);

  // UNION panel: column-count-aware UNION SELECT generator (see union.js)
  KHackBar.Union.render(document.getElementById('union_panel'), urlBox);

  // WAFuNiON panel: same generator, PURE WAF-bypass UNION SELECT variants
  KHackBar.Union.renderWaf(document.getElementById('wafunion_panel'), urlBox);

  // SSTI panel: detection probes + fingerprint table + per-engine exploitation
  if (KHackBar.Ssti) KHackBar.Ssti.render(document.getElementById('ssti_panel'), urlBox);

  // ============================================================
  // 5. Menu toggle logic (payload panels)
  // ============================================================
  categories.forEach(function (cat) {
    var menuItem = document.getElementById(cat.menuId);
    var panel = document.getElementById(cat.panelId);
    if (!menuItem || !panel) return;

    menuItem.onclick = function () {
      // Toggle active state. NOTE: we track "already open" via the menu
      // item's 'active' class, not panel.style.display — most panels never
      // get an inline style set (they rely on the CSS default of
      // display:none), so style.display starts out as '' rather than
      // 'none'. Checking style.display === '' as "already open" caused
      // those panels (BASIC, WAF, WAFuNiON, XSS, etc.) to never open.
      var wasActive = menuItem.classList.contains('active');
      document.querySelectorAll('.menu-item').forEach(function (m) {
        m.classList.remove('active');
      });
      document.querySelectorAll('.panel').forEach(function (p) {
        p.style.display = 'none';
      });

      if (!wasActive) {
        menuItem.classList.add('active');
        panel.style.display = 'flex';
      }
    };
  });

  // ============================================================
  // 5b. Special menu toggles (HEADERS, COOKIES, FUZZER, SETTINGS)
  // ============================================================
  function setupMenuToggle(menuId, panelId) {
    var menuItem = document.getElementById(menuId);
    var panel = document.getElementById(panelId);
    if (!menuItem || !panel) return;
    menuItem.onclick = function () {
      var wasActive = menuItem.classList.contains('active');
      document.querySelectorAll('.menu-item').forEach(function (m) { m.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.style.display = 'none'; });
      if (!wasActive) {
        menuItem.classList.add('active');
        panel.style.display = 'flex';
      }
    };
  }
  setupMenuToggle('menu_headers', 'headers_panel');
  setupMenuToggle('menu_cookies', 'cookies_panel');
  setupMenuToggle('menu_fuzzer', 'fuzzer_panel');
  setupMenuToggle('menu_settings', 'settings_panel');

  // ============================================================
  // 6. Headers module initialization
  // ============================================================
  (function () {
    var headerRows = document.getElementById('header_rows');
    var headerUrlPattern = document.getElementById('header_url_pattern');
    var btnAddHeader = document.getElementById('btn_add_header');
    var btnApplyHeaders = document.getElementById('btn_apply_headers');
    var btnClearHeaders = document.getElementById('btn_clear_headers');

    if (headerRows) {
      // Load saved headers
      KHackBar.Headers.loadSavedHeaders(headerRows, headerUrlPattern);

      // Add header row
      if (btnAddHeader) {
        btnAddHeader.onclick = function () {
          // Get current headers from existing rows
          var currentHeaders = [];
          var inputs = headerRows.querySelectorAll('input');
          for (var i = 0; i < inputs.length; i += 2) {
            if (i + 1 < inputs.length) {
              currentHeaders.push({
                header: inputs[i].value,
                value: inputs[i + 1].value,
                operation: 'set'
              });
            }
          }
          currentHeaders.push({ header: '', value: '', operation: 'set' });
          KHackBar.Headers.renderRows(headerRows, currentHeaders, headerUrlPattern ? headerUrlPattern.value : '');
        };
      }

      // Apply headers
      if (btnApplyHeaders && headerUrlPattern) {
        btnApplyHeaders.onclick = function () {
          var headers = [];
          var inputs = headerRows.querySelectorAll('input');
          var selects = headerRows.querySelectorAll('select');
          for (var i = 0; i < inputs.length; i += 2) {
            if (i + 1 < inputs.length) {
              var headerName = inputs[i].value.trim();
              var headerValue = inputs[i + 1].value;
              var operation = selects[Math.floor(i / 2)] ? selects[Math.floor(i / 2)].value : 'set';
              if (headerName) {
                headers.push({ header: headerName, value: headerValue, operation: operation });
              }
            }
          }
          KHackBar.Headers.saveHeaders(headerRows, headerUrlPattern.value, headers, status);
          logAudit('headers_apply', headerUrlPattern.value, headers.length + ' header(s) applied');
        };
      }

      // Clear headers
      if (btnClearHeaders && headerUrlPattern) {
        btnClearHeaders.onclick = function () {
          chrome.storage.local.remove(['custom_headers', 'header_url_pattern'], function () {
            chrome.runtime.sendMessage({ type: 'clear_headers' }, function () {
              setStatus('[+] Headers cleared.');
              logAudit('headers_clear', '', 'All custom headers removed');
              // Reset UI
              headerUrlPattern.value = '';
              KHackBar.Headers.renderRows(headerRows, [{ header: '', value: '', operation: 'set' }], '');
            });
          });
        };
      }
    }
  })();

  // ============================================================
  // 7. Cookies module initialization
  // ============================================================
  (function () {
    var cookiesList = document.getElementById('cookies_list');
    var cookiesStatus = document.getElementById('cookies_status');
    var btnRefreshCookies = document.getElementById('btn_refresh_cookies');

    if (btnRefreshCookies) {
      btnRefreshCookies.onclick = function () {
        KHackBar.Cookies.loadFromCurrentTab(cookiesList, cookiesStatus);
        logAudit('cookies_refresh', '', 'Cookies refreshed from current tab');
      };
    }
  })();

  // ============================================================
  // 8. Fuzzer module initialization
  // ============================================================
  KHackBar.Fuzzer.init({
    fuzzerUrl: document.getElementById('fuzzer_url'),
    fuzzerPayloads: document.getElementById('fuzzer_payloads'),
    fuzzerResults: document.getElementById('fuzzer_results'),
    btnFuzzerStart: document.getElementById('btn_fuzzer_start'),
    btnFuzzerStop: document.getElementById('btn_fuzzer_stop'),
    btnFuzzerClear: document.getElementById('btn_fuzzer_clear'),
    fuzzerPreset: document.getElementById('fuzzer_preset'),
    btnFuzzerLoadPreset: document.getElementById('btn_fuzzer_load_preset'),
    status: status,
    logAudit: logAudit
  });

  // ---- Intruder (Sniper / Cluster Bomb) ----
  if (KHackBar.Fuzzer.initIntruder) {
    KHackBar.Fuzzer.initIntruder({
      attackType: document.getElementById('intruder_attack'),
      method: document.getElementById('intruder_method'),
      url: document.getElementById('intruder_url'),
      contentType: document.getElementById('intruder_ctype'),
      body: document.getElementById('intruder_body'),
      cookie: document.getElementById('intruder_cookie'),
      btnLoadCookies: document.getElementById('btn_intruder_loadcookies'),
      btnLoadCapture: document.getElementById('btn_intruder_loadcapture'),
      capture: document.getElementById('intruder_capture'),
      urlencode: document.getElementById('intruder_urlencode'),
      threads: document.getElementById('intruder_threads'),
      delay: document.getElementById('intruder_delay'),
      btnCsrf: document.getElementById('btn_intruder_csrf'),
      csrfWrap: document.getElementById('intruder_csrf_wrap'),
      csrfOutput: document.getElementById('intruder_csrf_output'),
      btnCsrfCopy: document.getElementById('btn_intruder_csrf_copy'),
      btnCsrfDownload: document.getElementById('btn_intruder_csrf_download'),
      btnCsrfOpen: document.getElementById('btn_intruder_csrf_open'),
      payloadSetsWrap: document.getElementById('intruder_payload_sets'),
      btnDetect: document.getElementById('btn_intruder_detect'),
      btnAddPos: document.getElementById('btn_intruder_addpos'),
      btnClearPos: document.getElementById('btn_intruder_clearpos'),
      btnStart: document.getElementById('btn_intruder_start'),
      btnStop: document.getElementById('btn_intruder_stop'),
      btnClear: document.getElementById('btn_intruder_clear'),
      results: document.getElementById('intruder_results'),
      summary: document.getElementById('intruder_summary'),
      btnSortLen: document.getElementById('btn_intruder_sort_len'),
      btnSortStatus: document.getElementById('btn_intruder_sort_status'),
      btnSortIdx: document.getElementById('btn_intruder_sort_idx'),
      status: status,
      logAudit: logAudit
    });
  }

  // ---- Fuzzer panel mode switch ----
  // The FUZZER tab holds two distinct tools (the simple single-wordlist URL
  // fuzzer, and the full Intruder). Showing both stacked at once meant
  // scrolling past whichever one you didn't want. This shows only the
  // selected tool; Intruder is the default (see the "selected" option in
  // popup.html) since it's the one most people reach for.
  (function () {
    var modeSelect = document.getElementById('fuzzer_mode');
    var simpleSection = document.getElementById('fuzzer_mode_simple');
    var intruderSection = document.getElementById('fuzzer_mode_intruder');
    if (!modeSelect || !simpleSection || !intruderSection) return;

    function applyFuzzerMode() {
      var isIntruder = modeSelect.value === 'intruder';
      intruderSection.style.display = isIntruder ? 'flex' : 'none';
      simpleSection.style.display = isIntruder ? 'none' : 'flex';
    }

    modeSelect.onchange = applyFuzzerMode;
    applyFuzzerMode();
  })();

  // ============================================================
  // 9. Settings module initialization
  // ============================================================
  var settingsApi = KHackBar.Settings.init({
    scopeInput: document.getElementById('scope_input'),
    scopeEnabledInput: document.getElementById('scope_enabled_input'),
    btnSaveScope: document.getElementById('btn_save_scope'),
    btnExportConfig: document.getElementById('btn_export_config'),
    importConfigFile: document.getElementById('import_config_file'),
    btnImportConfig: document.getElementById('btn_import_config'),
    btnClearLogs: document.getElementById('btn_clear_logs'),
    auditLogContainer: document.getElementById('audit_log_container'),
    status: status,
    logAudit: logAudit
  });

  // Override settings menu to also refresh audit logs on open
  (function () {
    var menuSettings = document.getElementById('menu_settings');
    var settingsPanel = document.getElementById('settings_panel');
    if (menuSettings && settingsPanel) {
      menuSettings.onclick = function () {
        var wasActive = menuSettings.classList.contains('active');
        document.querySelectorAll('.menu-item').forEach(function (m) { m.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function (p) { p.style.display = 'none'; });
        if (!wasActive) {
          menuSettings.classList.add('active');
          settingsPanel.style.display = 'flex';
          setTimeout(function () {
            if (settingsApi && settingsApi.refreshAuditLogDisplay) settingsApi.refreshAuditLogDisplay();
          }, window.KHackBar.Config.AUDIT_REFRESH_DELAY);
        }
      };
    }
  })();

  // ============================================================
  // 10. Update version display
  // ============================================================
  var headerTitle = document.querySelector('.header h3');
  if (headerTitle) {
    headerTitle.textContent = 'KHackBar v2.3 Pro';
  }

  // Initial status
  setStatus('Engine Ready. ' + new Date().toLocaleTimeString());
});

// ============================================================
// Shortcut Keys (global, not inside DOMContentLoaded)
// ============================================================
window.addEventListener('keydown', function (e) {
  var urlBox = document.getElementById('url_box');
  if (e.altKey && e.key.toLowerCase() === 'x') {
    e.preventDefault();
    if (urlBox && urlBox.value) {
      var collapsed = urlBox.value.split('\n').map(function (l) { return l.trim(); })
        .filter(function (l) { return l.length > 0; })
        .join('&');
      chrome.tabs.update({ url: collapsed });
    }
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    if (urlBox && document.activeElement !== urlBox) urlBox.focus();
  }
}, true);
