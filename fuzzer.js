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
  var status = opts.status;
  var logAudit = opts.logAudit || function () {};

  if (!fuzzerUrl || !fuzzerPayloads || !fuzzerResults || !btnFuzzerStart) return;

  var fuzzerAbortController = null;
  var fuzzerStopped = false;

  // ---- Start Fuzzing ----
  btnFuzzerStart.onclick = async function () {
    var baseUrl = fuzzerUrl.value.trim();
    var payloadText = fuzzerPayloads.value.trim();

    if (!baseUrl) {
      window.KHackBar.UI.setText(status, '[!] Please enter a target URL with [FUZZ] marker.');
      return;
    }
    if (!payloadText) {
      window.KHackBar.UI.setText(status, '[!] Please enter payloads (one per line).');
      return;
    }
    if (baseUrl.indexOf('[FUZZ]') === -1) {
      window.KHackBar.UI.setText(status, '[!] URL must contain [FUZZ] marker.');
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
      var fuzzedUrl = baseUrl.replace('[FUZZ]', encodeURIComponent(payload));

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

      // Set timeout via AbortController signal with configurable timeout per request
      var timeoutId = setTimeout(function () {
        if (fuzzerAbortController) fuzzerAbortController.abort();
      }, window.KHackBar.Config.REQUEST_TIMEOUT);

      try {
        var response = await fetch(fuzzedUrl, {
          signal: signal,
          method: 'GET'
        });
        clearTimeout(timeoutId);

        statusSpan.textContent = ' [' + response.status + ' ' + response.statusText + ']';
        statusSpan.style.color = response.ok ? '#22c55e' : '#ef4444';
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          statusSpan.textContent = ' [Aborted]';
          statusSpan.style.color = '#f59e0b';
        } else {
          statusSpan.textContent = ' [Error: ' + err.message + ']';
          statusSpan.style.color = '#ef4444';
        }
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
