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
