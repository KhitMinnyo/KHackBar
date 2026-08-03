// ============================================================
// fuzzer.js - Fuzzer module with AbortController, 300ms delay,
//             Stop button, and safe DOM operations
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Fuzzer = window.KHackBar.Fuzzer || {};

// ---- Dependency guard ----
if (!window.KHackBar.UI) {
  console.error("KHackBar.Fuzzer: KHackBar.UI module missing — cannot proceed");
}
if (!window.KHackBar.Scope) {
  console.error("KHackBar.Fuzzer: KHackBar.Scope module missing — scope checks will fail");
}

/**
 * Initialize the fuzzer module.
 * @param {Object} opts - Configuration object
 * @param {HTMLElement} opts.fuzzerUrl - The fuzzer URL input element
 * @param {HTMLElement} opts.fuzzerPayloads - The payloads textarea element
 * @param {HTMLElement} opts.fuzzerResults - The results container element
 * @param {HTMLElement} opts.btnFuzzerStart - Start button element
 * @param {HTMLElement} opts.btnFuzzerStop - Stop button element
 * @param {HTMLElement} opts.btnFuzzerClear - Clear button element
 * @param {HTMLElement} [opts.fuzzerPreset] - Preset <select> element
 * @param {HTMLElement} [opts.btnFuzzerLoadPreset] - Load preset button element
 * @param {HTMLElement} opts.status - Status text element
 * @param {function} opts.logAudit - Audit logging function (action, target, details)
 */
window.KHackBar.Fuzzer.init = function (opts) {
  var fuzzerUrl = opts.fuzzerUrl;
  var fuzzerPayloads = opts.fuzzerPayloads;
  var fuzzerResults = opts.fuzzerResults;
  var btnFuzzerStart = opts.btnFuzzerStart;
  var btnFuzzerStop = opts.btnFuzzerStop;
  var btnFuzzerClear = opts.btnFuzzerClear;
  var fuzzerPreset = opts.fuzzerPreset;
  var btnFuzzerLoadPreset = opts.btnFuzzerLoadPreset;
  var status = opts.status;
  var logAudit = opts.logAudit || function () {};

  if (!fuzzerUrl || !fuzzerPayloads || !fuzzerResults || !btnFuzzerStart) return;

  // ---- Default payload presets (directory fuzzing, SQLi, XSS, etc.) ----
  // Lets the user load a ready-made wordlist instead of typing/pasting
  // payloads by hand every time.
  if (fuzzerPreset && btnFuzzerLoadPreset && window.KHackBar.Payloads && window.KHackBar.Payloads.fuzzerPresets) {
    window.KHackBar.Payloads.fuzzerPresets.forEach(function (preset) {
      var opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.label + ' (' + preset.list.length + ')';
      fuzzerPreset.appendChild(opt);
    });

    btnFuzzerLoadPreset.onclick = function () {
      var presetId = fuzzerPreset.value;
      if (!presetId) {
        window.KHackBar.UI.setText(status, '[!] Choose a preset first.');
        return;
      }
      var preset = window.KHackBar.Payloads.fuzzerPresets.filter(function (p) { return p.id === presetId; })[0];
      if (!preset) return;

      fuzzerPayloads.value = preset.list.join('\n');
      window.KHackBar.UI.setText(status, '[+] Loaded ' + preset.list.length + ' payloads: ' + preset.label + ' (replaced previous content).');
      logAudit('fuzzer_load_preset', presetId, 'Loaded ' + preset.list.length + ' payloads (' + preset.label + ')');
    };
  }

  var fuzzerAbortController = null;
  var fuzzerStopped = false;

  // Fuzz requests are sent via the background service worker rather than
  // fetch() directly from this page. A fetch() called here is subject to
  // this page's own CORS handling and silently fails against most
  // cross-origin targets; the background worker can use the extension's
  // host_permissions to fetch any origin reliably (the same reason
  // execute_post in background.js already worked this way).
  function sendFuzzRequest(url, timeoutMs) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ type: 'fuzz_request', url: url, timeout: timeoutMs }, function (response) {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response from background worker.' });
      });
    });
  }

  // Accept both the bracketed "[FUZZ]" marker (HackBar-style) and a bare
  // "FUZZ" marker (ffuf-style, case-insensitive) — many users coming from
  // other fuzzing tools type the URL as ".../id=FUZZ" with no brackets and
  // were getting rejected even though that's a perfectly standard
  // convention. Returns the exact substring to replace, or null if no
  // marker is present at all.
  function findFuzzMarker(url) {
    if (url.indexOf('[FUZZ]') !== -1) return '[FUZZ]';
    var match = url.match(/FUZZ/i);
    return match ? match[0] : null;
  }

  // ---- Start Fuzzing ----
  btnFuzzerStart.onclick = async function () {
    var baseUrl = fuzzerUrl.value.trim();
    var payloadText = fuzzerPayloads.value.trim();

    if (!baseUrl) {
      window.KHackBar.UI.setText(status, '[!] Please enter a target URL with a FUZZ marker.');
      return;
    }
    if (!payloadText) {
      window.KHackBar.UI.setText(status, '[!] Please enter payloads (one per line).');
      return;
    }
    if (!findFuzzMarker(baseUrl)) {
      window.KHackBar.UI.setText(status, '[!] URL must contain a FUZZ marker, e.g. .../page?id=FUZZ or .../page?id=[FUZZ].');
      return;
    }

    // Check scope
    window.KHackBar.Scope.getSavedScope(function (scopePattern) {
      var scopeCheck = window.KHackBar.Scope.checkScope(baseUrl, scopePattern);
      if (!scopeCheck.allowed) {
        window.KHackBar.UI.setText(status, '[!] ' + scopeCheck.reason);
        return;
      }

      // Proceed with fuzzing
      doFuzz(baseUrl, payloadText);
    });
  };

  async function doFuzz(baseUrl, payloadText) {
    var payloads = payloadText.split('\n').map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 0; });

    if (payloads.length === 0) {
      window.KHackBar.UI.setText(status, '[!] No valid payloads found.');
      return;
    }

    var marker = findFuzzMarker(baseUrl);
    if (!marker) {
      // Already validated before doFuzz was called, but guard here too
      // in case baseUrl is ever passed in some other way in the future.
      window.KHackBar.UI.setText(status, '[!] URL must contain a FUZZ marker.');
      return;
    }

    fuzzerStopped = false;

    // Create new AbortController for this fuzz run
    fuzzerAbortController = new AbortController();
    var signal = fuzzerAbortController.signal;

    // Disable start button, enable stop button
    btnFuzzerStart.disabled = true;
    btnFuzzerStart.style.opacity = '0.5';
    btnFuzzerStart.style.cursor = 'not-allowed';
    if (btnFuzzerStop) {
      btnFuzzerStop.disabled = false;
      btnFuzzerStop.style.opacity = '1';
      btnFuzzerStop.style.cursor = 'pointer';
    }

    window.KHackBar.UI.setText(status, '[+] Fuzzing started (' + payloads.length + ' payloads)...');
    logAudit('fuzzer_start', baseUrl, 'Fuzzing with ' + payloads.length + ' payloads');

    // Clear previous results safely
    while (fuzzerResults.firstChild) {
      fuzzerResults.removeChild(fuzzerResults.firstChild);
    }

    for (var i = 0; i < payloads.length; i++) {
      if (fuzzerStopped) break;
      if (signal.aborted) break;

      var payload = payloads[i];
      var fuzzedUrl = baseUrl.replace(marker, encodeURIComponent(payload));

      var resultDiv = document.createElement('div');
      resultDiv.style.padding = '3px';
      resultDiv.style.borderBottom = '1px solid #3f3f3f';

      var labelSpan = document.createElement('span');
      labelSpan.style.color = '#6b7280';
      labelSpan.textContent = '#' + (i + 1) + ' ';

      var urlSpan = document.createElement('span');
      urlSpan.style.color = '#ef4444';
      urlSpan.textContent = fuzzedUrl;

      var statusSpan = document.createElement('span');

      resultDiv.appendChild(labelSpan);
      resultDiv.appendChild(urlSpan);
      resultDiv.appendChild(statusSpan);
      fuzzerResults.appendChild(resultDiv);

      try {
        var response = await sendFuzzRequest(fuzzedUrl, window.KHackBar.Config.REQUEST_TIMEOUT);
        if (response && response.success) {
          statusSpan.textContent = ' [' + response.status + ' ' + response.statusText + ' | ' + response.length + ' bytes]';
          statusSpan.style.color = (response.status >= 200 && response.status < 400) ? '#22c55e' : '#ef4444';
        } else if (response && response.aborted) {
          statusSpan.textContent = ' [Timeout]';
          statusSpan.style.color = '#f59e0b';
        } else {
          statusSpan.textContent = ' [Error: ' + (response && response.error ? response.error : 'Unknown error') + ']';
          statusSpan.style.color = '#ef4444';
        }
      } catch (err) {
        statusSpan.textContent = ' [Error: ' + err.message + ']';
        statusSpan.style.color = '#ef4444';
      }

      fuzzerResults.scrollTop = fuzzerResults.scrollHeight;

      // Delay between requests (unless stopped)
      if (!fuzzerStopped && !signal.aborted) {
        await new Promise(function (r) { return setTimeout(r, window.KHackBar.Config.FUZZ_DELAY); });
      }
    }

    // Re-enable start button, disable stop button
    btnFuzzerStart.disabled = false;
    btnFuzzerStart.style.opacity = '1';
    btnFuzzerStart.style.cursor = 'pointer';
    if (btnFuzzerStop) {
      btnFuzzerStop.disabled = true;
      btnFuzzerStop.style.opacity = '0.5';
      btnFuzzerStop.style.cursor = 'not-allowed';
    }

    if (!fuzzerStopped && !signal.aborted) {
      window.KHackBar.UI.setText(status, '[+] Fuzzing completed.');
      logAudit('fuzzer_completed', baseUrl, 'Fuzzing completed with ' + payloads.length + ' payloads');
    }
  }

  // ---- Stop Fuzzing ----
  if (btnFuzzerStop) {
    btnFuzzerStop.onclick = function () {
      fuzzerStopped = true;
      if (fuzzerAbortController) {
        fuzzerAbortController.abort();
      }
      window.KHackBar.UI.setText(status, '[!] Stopping fuzzer...');
    };
  }

  // ---- Clear Results ----
  if (btnFuzzerClear && fuzzerResults) {
    btnFuzzerClear.onclick = function () {
      while (fuzzerResults.firstChild) {
        fuzzerResults.removeChild(fuzzerResults.firstChild);
      }
      window.KHackBar.UI.setText(status, '[+] Results cleared.');
    };
  }
};

// ============================================================
// Intruder engine — Burp-style Sniper & Cluster Bomb.
//
// Position markers use the Burp syntax §value§: wrap an injection point
// with a pair of section signs, e.g.  user=§admin§&pass=§secret§.
// The text between the markers is the "base" value (used verbatim for
// positions that aren't being fuzzed in Sniper mode).
//
//   Sniper       : one payload set. Each position is fuzzed one at a time
//                  while the others keep their base value.
//                  total requests = positions × payloads
//   Cluster Bomb : one payload set per position. Every combination is
//                  tried (cartesian product).
//                  total requests = len(set1) × len(set2) × ...
// ============================================================
window.KHackBar.Fuzzer.initIntruder = function (opts) {
  var attackTypeEl = opts.attackType;      // <select> sniper | cluster
  var methodEl     = opts.method;          // <select> GET | POST
  var urlEl        = opts.url;             // URL input (may contain §§)
  var ctypeEl      = opts.contentType;     // <select> content-type
  var bodyEl       = opts.body;            // request body textarea (§§)
  var cookieEl     = opts.cookie;          // Cookie header textarea (§§)
  var btnLoadCookies = opts.btnLoadCookies; // prefill Cookie from active tab
  var btnLoadCapture = opts.btnLoadCapture; // pull last auto-captured POST
  var captureEl    = opts.capture;         // in-Intruder Auto-capture toggle
  var urlencodeEl  = opts.urlencode;       // checkbox: URL-encode payloads
  var setsWrap     = opts.payloadSetsWrap; // container div for payload textareas
  var btnDetect    = opts.btnDetect;
  var btnAddPos    = opts.btnAddPos;       // "Add §" — wrap selection in §§
  var btnClearPos  = opts.btnClearPos;     // strip all § markers
  var btnStart     = opts.btnStart;
  var btnStop      = opts.btnStop;
  var btnClear     = opts.btnClear;
  var results      = opts.results;
  var status       = opts.status;
  var logAudit     = opts.logAudit || function () {};

  if (!attackTypeEl || !urlEl || !bodyEl || !btnStart || !setsWrap) return;

  var MAX_REQUESTS = 5000; // safety cap to avoid runaway combinatorial blasts
  var MARKER = '§';   // §
  var TOK_A = '', TOK_B = ''; // private-use placeholder delimiters

  var payloadInputs = []; // textareas currently rendered in setsWrap
  var abortController = null;
  var stopped = false;

  // Track which markable field (URL or body) the user touched last, so the
  // "Add § position" button wraps the selection in the right place.
  var lastFocused = bodyEl;
  urlEl.addEventListener('focus', function () { lastFocused = urlEl; });
  bodyEl.addEventListener('focus', function () { lastFocused = bodyEl; });
  if (cookieEl) cookieEl.addEventListener('focus', function () { lastFocused = cookieEl; });

  // ---- Parse §value§ markers into a template + list of base values ----
  // startIdx lets URL and body share one continuous position index space.
  function parseMarked(text, startIdx) {
    var bases = [];
    var out = '';
    var i = 0, idx = startIdx;
    while (i < text.length) {
      if (text.charAt(i) === MARKER) {
        var end = text.indexOf(MARKER, i + 1);
        if (end === -1) { out += text.slice(i); break; } // unmatched → literal
        bases.push(text.slice(i + 1, end));
        out += TOK_A + idx + TOK_B;
        idx++;
        i = end + 1;
      } else {
        out += text.charAt(i);
        i++;
      }
    }
    return { template: out, bases: bases, next: idx };
  }

  // Combine URL positions (always), body positions (POST only) and Cookie
  // positions (whenever a Cookie header is supplied) into one shared index
  // space, so a single payload vector can drive all three at once.
  function parseAll() {
    var method = (methodEl && methodEl.value ? methodEl.value : 'POST').toUpperCase();
    var u = parseMarked(urlEl.value, 0);
    var bases = u.bases.slice();
    var next = u.next;

    var bodyParsed = { template: bodyEl.value, bases: [], next: next };
    if (method !== 'GET' && method !== 'HEAD') {
      bodyParsed = parseMarked(bodyEl.value, next);
      bases = bases.concat(bodyParsed.bases);
      next = bodyParsed.next;
    }

    var cookieRaw = cookieEl ? cookieEl.value : '';
    var cookieParsed = { template: cookieRaw, bases: [], next: next };
    if (cookieRaw.trim()) {
      cookieParsed = parseMarked(cookieRaw, next);
      bases = bases.concat(cookieParsed.bases);
      next = cookieParsed.next;
    }

    return {
      method: method,
      urlTemplate: u.template,
      bodyTemplate: bodyParsed.template,
      cookieTemplate: cookieParsed.template,
      bases: bases,
      count: bases.length
    };
  }

  function fillTemplate(template, rendered) {
    var re = new RegExp(TOK_A + '(\\d+)' + TOK_B, 'g');
    return template.replace(re, function (_, n) {
      var v = rendered[parseInt(n, 10)];
      return v == null ? '' : v;
    });
  }

  function encPayload(p) {
    return (urlencodeEl && urlencodeEl.checked) ? encodeURIComponent(p) : p;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // Build a "-- load wordlist --" dropdown + Load button that fills the
  // given textarea from KHackBar.Payloads.fuzzerPresets (same presets the
  // simple Fuzzer offers). Returns null if no presets are available.
  function makePresetRow(targetTa) {
    var presets = (window.KHackBar.Payloads && window.KHackBar.Payloads.fuzzerPresets) || [];
    if (!presets.length) return null;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:4px; width:100%; margin-bottom:4px;';
    var sel = document.createElement('select');
    sel.className = 'content-type-select';
    sel.style.flex = '1';
    var def = document.createElement('option');
    def.value = ''; def.textContent = '-- load wordlist --';
    sel.appendChild(def);
    presets.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id; o.textContent = p.label + ' (' + p.list.length + ')';
      sel.appendChild(o);
    });
    var btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.style.cssText = 'font-size:10px; flex:0 0 auto;';
    btn.textContent = 'Load';
    btn.onclick = function () {
      var pid = sel.value;
      if (!pid) { window.KHackBar.UI.setText(status, '[!] Choose a wordlist first.'); return; }
      var pr = presets.filter(function (x) { return x.id === pid; })[0];
      if (!pr) return;
      targetTa.value = pr.list.join('\n');
      window.KHackBar.UI.setText(status, '[+] Loaded ' + pr.list.length + ' payloads: ' + pr.label);
      logAudit('intruder_load_preset', pid, 'Loaded ' + pr.list.length + ' payloads (' + pr.label + ')');
    };
    row.appendChild(sel);
    row.appendChild(btn);
    return row;
  }

  // ---- Detect positions and render the payload-set textareas ----
  function renderPayloadSets() {
    var parsed = parseAll();
    payloadInputs = [];
    clearChildren(setsWrap);

    if (parsed.count === 0) {
      var warn = document.createElement('div');
      warn.style.cssText = 'font-size:10px; color:#f59e0b;';
      warn.textContent = '[!] No positions found. Wrap injection points with §value§ (e.g. user=§admin§).';
      setsWrap.appendChild(warn);
      window.KHackBar.UI.setText(status, '[!] No §§ positions detected.');
      return;
    }

    var attack = attackTypeEl.value;
    var boxStyle = 'width:100%; height:70px; background:#0a0a0a; color:#ef4444; border:1px solid #3f3f3f; padding:6px; border-radius:4px; font-size:11px; outline:none; font-family:inherit; resize:vertical; margin-bottom:6px;';
    var lblStyle = 'width:100%; margin:4px 0; font-size:10px; color:#ef4444;';

    if (attack === 'sniper') {
      var lbl = document.createElement('div');
      lbl.style.cssText = lblStyle;
      lbl.textContent = 'Payload set — used for all ' + parsed.count + ' position(s), one per line:';
      var ta = document.createElement('textarea');
      ta.style.cssText = boxStyle;
      ta.placeholder = "' OR 1=1-- -\n<script>alert(1)</script>\n../../etc/passwd";
      setsWrap.appendChild(lbl);
      var snipeRow = makePresetRow(ta);
      if (snipeRow) setsWrap.appendChild(snipeRow);
      setsWrap.appendChild(ta);
      payloadInputs.push(ta);
    } else { // cluster bomb — one set per position
      for (var k = 0; k < parsed.count; k++) {
        var l = document.createElement('div');
        l.style.cssText = lblStyle;
        l.textContent = 'Position ' + (k + 1) + ' (base: "' + parsed.bases[k] + '") — payloads, one per line:';
        var t = document.createElement('textarea');
        t.style.cssText = boxStyle;
        t.placeholder = 'payload-a\npayload-b';
        setsWrap.appendChild(l);
        var clusterRow = makePresetRow(t);
        if (clusterRow) setsWrap.appendChild(clusterRow);
        setsWrap.appendChild(t);
        payloadInputs.push(t);
      }
    }
    window.KHackBar.UI.setText(status, '[+] Detected ' + parsed.count + ' position(s) — ' + (attack === 'sniper' ? 'Sniper' : 'Cluster Bomb') + ' mode.');
  }

  function linesOf(textarea) {
    return textarea.value.split('\n')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  // ---- Build the full list of request "value vectors" ----
  // Each vector is { rendered: [...], label: 'desc' } — rendered[k] is the
  // final (encoded/base) string to drop into position k.
  function buildVectors(parsed, attack) {
    var vectors = [];
    if (attack === 'sniper') {
      var list = linesOf(payloadInputs[0]);
      if (list.length === 0) return { error: 'Enter at least one payload.' };
      for (var pos = 0; pos < parsed.count; pos++) {
        for (var pi = 0; pi < list.length; pi++) {
          var rendered = parsed.bases.slice(); // others stay at base value
          rendered[pos] = encPayload(list[pi]);
          vectors.push({ rendered: rendered, label: 'pos#' + (pos + 1) + ' = ' + list[pi] });
        }
      }
      return { vectors: vectors };
    }

    // cluster bomb — cartesian product
    if (payloadInputs.length !== parsed.count) {
      return { error: 'Position count changed. Click "Detect positions" again.' };
    }
    var lists = [];
    for (var i = 0; i < payloadInputs.length; i++) {
      var li = linesOf(payloadInputs[i]);
      if (li.length === 0) return { error: 'Position ' + (i + 1) + ' has no payloads.' };
      lists.push(li);
    }
    var total = lists.reduce(function (a, l) { return a * l.length; }, 1);
    if (total > MAX_REQUESTS) return { error: 'Too many combinations (' + total + '). Cap is ' + MAX_REQUESTS + '.', tooMany: true };

    var indices = lists.map(function () { return 0; });
    for (var c = 0; c < total; c++) {
      var rendered2 = [];
      var labelParts = [];
      for (var j = 0; j < lists.length; j++) {
        var val = lists[j][indices[j]];
        rendered2.push(encPayload(val));
        labelParts.push(val);
      }
      vectors.push({ rendered: rendered2, label: labelParts.join(' | ') });
      // increment odometer
      for (var d = lists.length - 1; d >= 0; d--) {
        indices[d]++;
        if (indices[d] < lists[d].length) break;
        indices[d] = 0;
      }
    }
    return { vectors: vectors };
  }

  function sendReq(method, url, contentType, data, cookie) {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({
        type: 'fuzz_post_request',
        method: method,
        url: url,
        contentType: contentType,
        data: data,
        cookie: cookie || '',
        timeout: window.KHackBar.Config.REQUEST_TIMEOUT
      }, function (response) {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { success: false, error: 'No response from background worker.' });
      });
    });
  }

  function setRunning(running) {
    btnStart.disabled = running;
    btnStart.style.opacity = running ? '0.5' : '1';
    btnStart.style.cursor = running ? 'not-allowed' : 'pointer';
    if (btnStop) {
      btnStop.disabled = !running;
      btnStop.style.opacity = running ? '1' : '0.5';
      btnStop.style.cursor = running ? 'pointer' : 'not-allowed';
    }
  }

  // ---- Run the attack ----
  async function run() {
    var parsed = parseAll();
    if (parsed.count === 0) {
      window.KHackBar.UI.setText(status, '[!] No §§ positions. Add markers then click Detect positions.');
      return;
    }
    if (payloadInputs.length === 0) {
      window.KHackBar.UI.setText(status, '[!] Click "Detect positions" first, then fill the payload sets.');
      return;
    }

    var attack = attackTypeEl.value;
    var built = buildVectors(parsed, attack);
    if (built.error) {
      window.KHackBar.UI.setText(status, '[!] ' + built.error);
      return;
    }
    var vectors = built.vectors;
    if (vectors.length > MAX_REQUESTS) {
      window.KHackBar.UI.setText(status, '[!] ' + vectors.length + ' requests exceeds the ' + MAX_REQUESTS + ' cap. Narrow your payloads.');
      return;
    }

    var probeUrl = fillTemplate(parsed.urlTemplate, parsed.bases);

    window.KHackBar.Scope.getSavedScope(function (scopePattern) {
      var scopeCheck = window.KHackBar.Scope.checkScope(probeUrl, scopePattern);
      if (!scopeCheck.allowed) {
        window.KHackBar.UI.setText(status, '[!] ' + scopeCheck.reason);
        return;
      }
      doRun(parsed, attack, vectors);
    });
  }

  async function doRun(parsed, attack, vectors) {
    stopped = false;
    abortController = new AbortController();
    var signal = abortController.signal;
    setRunning(true);
    clearChildren(results);

    var contentType = ctypeEl && ctypeEl.value ? ctypeEl.value : 'application/x-www-form-urlencoded';
    var modeName = attack === 'sniper' ? 'Sniper' : 'Cluster Bomb';
    window.KHackBar.UI.setText(status, '[+] ' + modeName + ' started — ' + vectors.length + ' request(s)...');
    logAudit('intruder_start', probeUrlFor(parsed), modeName + ': ' + vectors.length + ' requests');

    for (var i = 0; i < vectors.length; i++) {
      if (stopped || signal.aborted) break;
      var vec = vectors[i];
      var finalUrl = fillTemplate(parsed.urlTemplate, vec.rendered);
      var finalBody = (parsed.method === 'GET' || parsed.method === 'HEAD')
        ? '' : fillTemplate(parsed.bodyTemplate, vec.rendered);
      var finalCookie = (parsed.cookieTemplate && parsed.cookieTemplate.trim())
        ? fillTemplate(parsed.cookieTemplate, vec.rendered) : '';

      var row = document.createElement('div');
      row.style.cssText = 'padding:3px; border-bottom:1px solid #3f3f3f;';
      var idxSpan = document.createElement('span');
      idxSpan.style.color = '#6b7280';
      idxSpan.textContent = '#' + (i + 1) + ' ';
      var lblSpan = document.createElement('span');
      lblSpan.style.color = '#ef4444';
      lblSpan.textContent = vec.label;
      var stSpan = document.createElement('span');
      row.appendChild(idxSpan);
      row.appendChild(lblSpan);
      row.appendChild(stSpan);
      results.appendChild(row);

      try {
        var resp = await sendReq(parsed.method, finalUrl, contentType, finalBody, finalCookie);
        if (resp && resp.success) {
          stSpan.textContent = ' [' + resp.status + ' ' + resp.statusText + ' | ' + resp.length + ' bytes]';
          stSpan.style.color = (resp.status >= 200 && resp.status < 400) ? '#22c55e' : '#ef4444';
        } else if (resp && resp.aborted) {
          stSpan.textContent = ' [Timeout]';
          stSpan.style.color = '#f59e0b';
        } else {
          stSpan.textContent = ' [Error: ' + (resp && resp.error ? resp.error : 'Unknown') + ']';
          stSpan.style.color = '#ef4444';
        }
      } catch (err) {
        stSpan.textContent = ' [Error: ' + err.message + ']';
        stSpan.style.color = '#ef4444';
      }

      results.scrollTop = results.scrollHeight;
      if (!stopped && !signal.aborted) {
        await new Promise(function (r) { return setTimeout(r, window.KHackBar.Config.FUZZ_DELAY); });
      }
    }

    setRunning(false);
    if (!stopped && !signal.aborted) {
      window.KHackBar.UI.setText(status, '[+] ' + (attack === 'sniper' ? 'Sniper' : 'Cluster Bomb') + ' completed (' + vectors.length + ' requests).');
      logAudit('intruder_completed', probeUrlFor(parsed), 'Completed ' + vectors.length + ' requests');
    }
  }

  function probeUrlFor(parsed) {
    return fillTemplate(parsed.urlTemplate, parsed.bases);
  }

  // ---- Wire up controls ----
  // "Add § position": wrap the current selection (in whichever of URL/body
  // was last focused) with §§ — Burp's "Add §" button. With no selection it
  // drops a §STRING§ placeholder with STRING pre-selected to type over.
  if (btnAddPos) {
    btnAddPos.onclick = function () {
      var target = (lastFocused === urlEl) ? urlEl : bodyEl;
      window.KHackBar.UI.wrapSelectionWithTemplate(target, MARKER + '{{SEL}}' + MARKER);
      renderPayloadSets();
    };
  }
  if (btnClearPos) {
    btnClearPos.onclick = function () {
      var re = new RegExp(MARKER, 'g');
      urlEl.value = urlEl.value.replace(re, '');
      bodyEl.value = bodyEl.value.replace(re, '');
      clearChildren(setsWrap);
      payloadInputs = [];
      window.KHackBar.UI.setText(status, '[+] Cleared all § markers.');
    };
  }
  // "Load tab cookies": prefill the Cookie field with the live cookies for the
  // target URL (or the active tab) as `name=value; name2=value2`, ready to wrap
  // a value with §§ and fuzz it.
  if (btnLoadCookies && cookieEl) {
    btnLoadCookies.onclick = function () {
      function fill(url) {
        chrome.cookies.getAll({ url: url }, function (cookies) {
          if (chrome.runtime.lastError) {
            window.KHackBar.UI.setText(status, '[!] Cookie read error: ' + chrome.runtime.lastError.message);
            return;
          }
          if (!cookies || !cookies.length) {
            window.KHackBar.UI.setText(status, '[!] No cookies found for ' + url);
            return;
          }
          cookieEl.value = cookies.map(function (c) { return c.name + '=' + c.value; }).join('; ');
          window.KHackBar.UI.setText(status, '[+] Loaded ' + cookies.length + ' cookie(s). Wrap a value with §§ (or use Add § position) to fuzz it.');
        });
      }
      var u = urlEl.value.trim();
      if (/^https?:\/\//i.test(u)) {
        fill(u);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs && tabs[0] && tabs[0].url) fill(tabs[0].url);
          else window.KHackBar.UI.setText(status, '[!] Enter a target URL first.');
        });
      }
    };
  }

  // "Load captured POST": pull the last request captured by the v1.8 POST
  // auto-capture (stored in chrome.storage.local by the background worker) and
  // drop its URL, body and content-type straight into the Intruder, set to
  // POST — so a login you just submitted becomes fuzzable in one click.
  if (btnLoadCapture) {
    btnLoadCapture.onclick = function () {
      chrome.storage.local.get(['last_captured_post'], function (result) {
        var cap = result && result.last_captured_post;
        if (!cap) {
          window.KHackBar.UI.setText(status, '[!] No captured POST yet. Enable "🔴 Auto-capture POST" in the POST section, then submit the login form.');
          return;
        }
        urlEl.value = cap.url || '';
        bodyEl.value = cap.body || '';
        if (methodEl) methodEl.value = 'POST';
        if (ctypeEl && cap.contentType) {
          var baseType = cap.contentType.split(';')[0].trim().toLowerCase();
          for (var i = 0; i < ctypeEl.options.length; i++) {
            if (ctypeEl.options[i].value === baseType) { ctypeEl.value = baseType; break; }
          }
        }
        window.KHackBar.UI.setText(status, '[+] Loaded captured POST: ' + cap.url + ' — now wrap a value with §§ and Detect positions.');
      });
    };
  }

  // In-Intruder "Auto-capture" toggle — a convenience mirror of the checkbox
  // in the POST section so you don't have to scroll up to enable capture. It
  // drives the same background setting + storage key, and stays in sync with
  // the top toggle via storage.onChanged.
  if (captureEl) {
    chrome.storage.local.get(['capture_post_enabled'], function (result) {
      captureEl.checked = !!(result && result.capture_post_enabled);
    });
    captureEl.onchange = function () {
      var enabled = captureEl.checked;
      chrome.runtime.sendMessage({ type: 'set_capture_post_enabled', enabled: enabled }, function () {
        window.KHackBar.UI.setText(status, enabled
          ? '[+] POST capture ON — submit the login form, then click "Load captured POST".'
          : '[+] POST capture stopped.');
      });
    };
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === 'local' && changes.capture_post_enabled) {
          captureEl.checked = !!changes.capture_post_enabled.newValue;
        }
      });
    }
  }

  if (btnDetect) btnDetect.onclick = renderPayloadSets;
  if (attackTypeEl) attackTypeEl.onchange = function () { if (payloadInputs.length) renderPayloadSets(); };
  btnStart.onclick = run;
  if (btnStop) {
    btnStop.onclick = function () {
      stopped = true;
      if (abortController) abortController.abort();
      window.KHackBar.UI.setText(status, '[!] Stopping Intruder...');
    };
  }
  if (btnClear && results) {
    btnClear.onclick = function () {
      clearChildren(results);
      window.KHackBar.UI.setText(status, '[+] Results cleared.');
    };
  }
};
