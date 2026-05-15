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
    { name: 'KHackBar.Settings', key: 'Settings' }
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

  var btnLoad = document.getElementById('btn_load');
  var btnSplit = document.getElementById('btn_split');
  var btnExecute = document.getElementById('btn_execute');
  var btnExecutePost = document.getElementById('btn_execute_post');

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
  if (encBtns.url) {
    encBtns.url.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.url.encode(urlBox.value);
    };
  }
  if (encBtns.durl) {
    encBtns.durl.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.url.decode(urlBox.value);
    };
  }
  if (encBtns.hex) {
    encBtns.hex.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.hex.encode(urlBox.value);
    };
  }
  if (encBtns.dhex) {
    encBtns.dhex.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.hex.decode(urlBox.value);
    };
  }
  if (encBtns.b64) {
    encBtns.b64.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.b64.encode(urlBox.value);
    };
  }
  if (encBtns.db64) {
    encBtns.db64.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.b64.decode(urlBox.value);
    };
  }
  if (encBtns.html) {
    encBtns.html.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.html.encode(urlBox.value);
    };
  }
  if (encBtns.dhtml) {
    encBtns.dhtml.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.html.decode(urlBox.value);
    };
  }
  if (encBtns.durl2) {
    encBtns.durl2.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.durl.encode(urlBox.value);
    };
  }
  if (encBtns.ddurl2) {
    encBtns.ddurl2.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.durl.decode(urlBox.value);
    };
  }
  if (encBtns.uni) {
    encBtns.uni.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.uni.encode(urlBox.value);
    };
  }
  if (encBtns.duni) {
    encBtns.duni.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.uni.decode(urlBox.value);
    };
  }
  if (encBtns.reverse) {
    encBtns.reverse.onclick = function () {
      urlBox.value = KHackBar.UI.encoder.reverse(urlBox.value);
    };
  }

  // ============================================================
  // 3. LOAD / SPLIT / EXECUTE / POST buttons
  // ============================================================

  // LOAD: Send the URL to the active tab
  if (btnLoad) {
    btnLoad.onclick = function () {
      var target = urlBox.value.replace(/\n/g, '').trim();
      if (!target) {
        setStatus('[!] URL box is empty.');
        return;
      }
      // Check scope
      KHackBar.Scope.getSavedScope(function (scopePattern) {
        var scopeCheck = KHackBar.Scope.checkScope(target, scopePattern);
        if (!scopeCheck.allowed) {
          setStatus('[!] ' + scopeCheck.reason);
          return;
        }
        chrome.tabs.update({ url: target });
        setStatus('[+] Loaded: ' + target);
        logAudit('load', target, 'URL loaded into tab');
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

  // EXECUTE: Send GET request to the URL
  if (btnExecute) {
    btnExecute.onclick = function () {
      var target = urlBox.value.replace(/\n/g, '').trim();
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
      var target = urlBox.value.replace(/\n/g, '').trim();
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
            setStatus('[+] POST response received (' + response.status + ').');
          } else if (response && response.error) {
            setStatus('[!] POST error: ' + response.error);
          }
        });
      });
    };
  }

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

  // ============================================================
  // 5. Menu toggle logic (payload panels)
  // ============================================================
  categories.forEach(function (cat) {
    var menuItem = document.getElementById(cat.menuId);
    var panel = document.getElementById(cat.panelId);
    if (!menuItem || !panel) return;

    menuItem.onclick = function () {
      // Toggle active state
      var isActive = panel.style.display === 'flex' || panel.style.display === '';
      document.querySelectorAll('.menu-item').forEach(function (m) {
        m.classList.remove('active');
      });
      document.querySelectorAll('.panel').forEach(function (p) {
        p.style.display = 'none';
      });

      if (!isActive) {
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
      var isActive = panel.style.display === 'flex' || panel.style.display === '';
      document.querySelectorAll('.menu-item').forEach(function (m) { m.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.style.display = 'none'; });
      if (!isActive) {
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
    status: status,
    logAudit: logAudit
  });

  // ============================================================
  // 9. Settings module initialization
  // ============================================================
  var settingsApi = KHackBar.Settings.init({
    scopeInput: document.getElementById('scope_input'),
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
        var isActive = settingsPanel.style.display === 'flex' || settingsPanel.style.display === '';
        document.querySelectorAll('.menu-item').forEach(function (m) { m.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function (p) { p.style.display = 'none'; });
        if (!isActive) {
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
    headerTitle.textContent = 'KHackBar v1.5 Pro';
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
    if (urlBox && urlBox.value) chrome.tabs.update({ url: urlBox.value.replace(/\n/g, '') });
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    if (urlBox && document.activeElement !== urlBox) urlBox.focus();
  }
}, true);
