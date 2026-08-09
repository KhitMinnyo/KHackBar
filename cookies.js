// ============================================================
// cookies.js - Interactive cookie editor (view / edit / inject / delete)
// ============================================================
// Renders the current tab's cookies with an editable value box + Save/Delete,
// plus an "Add / inject cookie" form. Editing a value and clicking Save writes
// the live browser cookie via chrome.cookies.set — so you can inject a payload
// (e.g.  ' OR 1=1-- -) straight into a session/role cookie and browse with it.

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Cookies = window.KHackBar.Cookies || {};

(function () {
  var IN_STYLE = 'flex:1; min-width:0; background:#0a0a0a; color:#ef4444; border:1px solid #3f3f3f; padding:5px; border-radius:4px; font-size:13px; outline:none; font-family:inherit;';
  var BTN = 'small-btn';

  // Build a usable URL for chrome.cookies.set/remove from a cookie object.
  function cookieUrl(cookie) {
    var scheme = cookie.secure ? 'https' : 'http';
    var host = (cookie.domain || '').replace(/^\./, '');
    return scheme + '://' + host + (cookie.path || '/');
  }

  // Assemble chrome.cookies.set params that preserve the cookie's attributes.
  function setParamsFrom(cookie, newValue) {
    var params = {
      url: cookieUrl(cookie),
      name: cookie.name,
      value: newValue,
      path: cookie.path || '/',
      secure: !!cookie.secure,
      httpOnly: !!cookie.httpOnly,
      storeId: cookie.storeId
    };
    if (cookie.sameSite && cookie.sameSite !== 'unspecified') params.sameSite = cookie.sameSite;
    if (!cookie.session && cookie.expirationDate) params.expirationDate = cookie.expirationDate;
    // host-only cookies must NOT carry a domain; domain cookies keep theirs
    if (!cookie.hostOnly && cookie.domain) params.domain = cookie.domain;
    return params;
  }

  function badge(text, title) {
    var b = document.createElement('span');
    b.textContent = text;
    b.title = title || '';
    b.style.cssText = 'font-size:9px; color:#0a0a0a; background:#f59e0b; border-radius:3px; padding:0 4px; margin-left:4px;';
    return b;
  }

  /**
   * Load cookies from the current tab and render the editor.
   * @param {HTMLElement} cookiesList
   * @param {HTMLElement} cookiesStatus
   */
  window.KHackBar.Cookies.loadFromCurrentTab = function (cookiesList, cookiesStatus) {
    if (!cookiesList || !cookiesStatus) return;

    while (cookiesList.firstChild) cookiesList.removeChild(cookiesList.firstChild);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0] || !tabs[0].url) {
        cookiesStatus.textContent = 'No active tab found.';
        return;
      }
      var tabUrl = tabs[0].url;
      var domain;
      try { domain = new URL(tabUrl).hostname; }
      catch (e) { cookiesStatus.textContent = 'Invalid tab URL: ' + tabUrl; return; }

      // ---- Add / inject cookie form (always shown at the top) ----
      renderAddForm(cookiesList, cookiesStatus, tabUrl, domain);

      chrome.cookies.getAll({ url: tabUrl }, function (cookies) {
        if (chrome.runtime.lastError) {
          cookiesStatus.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }
        if (!cookies || cookies.length === 0) {
          cookiesStatus.textContent = 'No cookies for ' + domain + ' — use the form above to add/inject one.';
          return;
        }
        cookiesStatus.textContent = cookies.length + ' cookie(s) for ' + domain + ' — edit a value and Save to inject it live.';
        cookies.forEach(function (cookie) {
          cookiesList.appendChild(renderRow(cookie, cookiesList, cookiesStatus));
        });
      });
    });
  };

  function renderAddForm(cookiesList, cookiesStatus, tabUrl, domain) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%; border:1px dashed #3f3f3f; border-radius:4px; padding:6px; margin-bottom:8px;';

    var title = document.createElement('div');
    title.textContent = '➕ Add / inject cookie (' + domain + ')';
    title.style.cssText = 'font-size:11px; color:#22c55e; margin-bottom:4px;';
    wrap.appendChild(title);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:4px; width:100%;';
    var nameIn = document.createElement('input');
    nameIn.placeholder = 'name';
    nameIn.style.cssText = IN_STYLE + ' flex:0 0 34%;';
    var valIn = document.createElement('input');
    valIn.placeholder = "value  (e.g.  ' OR 1=1-- -)";
    valIn.style.cssText = IN_STYLE;
    var setBtn = document.createElement('button');
    setBtn.className = BTN;
    setBtn.textContent = 'Set';
    setBtn.style.cssText = 'font-size:11px; flex:0 0 auto;';
    setBtn.onclick = function () {
      var name = nameIn.value.trim();
      if (!name) { cookiesStatus.textContent = '[!] Enter a cookie name.'; return; }
      chrome.cookies.set({ url: tabUrl, name: name, value: valIn.value, path: '/' }, function (c) {
        if (chrome.runtime.lastError || !c) {
          cookiesStatus.textContent = '[!] Set failed: ' + (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'unknown');
          return;
        }
        cookiesStatus.textContent = '[+] Cookie set: ' + name;
        window.KHackBar.Cookies.loadFromCurrentTab(cookiesList, cookiesStatus);
      });
    };
    row.appendChild(nameIn);
    row.appendChild(valIn);
    row.appendChild(setBtn);
    wrap.appendChild(row);
    cookiesList.appendChild(wrap);
  }

  function renderRow(cookie, cookiesList, cookiesStatus) {
    var row = document.createElement('div');
    row.style.cssText = 'width:100%; border-bottom:1px solid #3f3f3f; padding:5px 2px;';

    // top line: name + flag badges + Delete
    var top = document.createElement('div');
    top.style.cssText = 'display:flex; align-items:center; gap:4px; margin-bottom:4px;';
    var nameSpan = document.createElement('span');
    nameSpan.textContent = cookie.name;
    nameSpan.style.cssText = 'color:#22c55e; font-weight:bold; font-size:13px; word-break:break-all;';
    top.appendChild(nameSpan);
    if (cookie.httpOnly) top.appendChild(badge('HttpOnly', 'Cookie is HttpOnly'));
    if (cookie.secure) top.appendChild(badge('Secure', 'Cookie is Secure'));

    var delBtn = document.createElement('button');
    delBtn.className = BTN;
    delBtn.textContent = 'Del';
    delBtn.style.cssText = 'font-size:10px; flex:0 0 auto; margin-left:auto;';
    delBtn.onclick = function () {
      chrome.cookies.remove({ url: cookieUrl(cookie), name: cookie.name, storeId: cookie.storeId }, function () {
        cookiesStatus.textContent = '[+] Deleted cookie: ' + cookie.name;
        window.KHackBar.Cookies.loadFromCurrentTab(cookiesList, cookiesStatus);
      });
    };
    top.appendChild(delBtn);
    row.appendChild(top);

    // bottom line: editable value + Save + Copy
    var bottom = document.createElement('div');
    bottom.style.cssText = 'display:flex; gap:4px; width:100%;';
    var valIn = document.createElement('input');
    valIn.value = cookie.value;
    valIn.style.cssText = IN_STYLE;

    var saveBtn = document.createElement('button');
    saveBtn.className = BTN;
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'font-size:10px; flex:0 0 auto;';
    saveBtn.onclick = function () {
      chrome.cookies.set(setParamsFrom(cookie, valIn.value), function (c) {
        if (chrome.runtime.lastError || !c) {
          cookiesStatus.textContent = '[!] Save failed: ' + (chrome.runtime.lastError ? chrome.runtime.lastError.message : 'unknown (Secure/SameSite may require https)');
          return;
        }
        cookiesStatus.textContent = '[+] Injected "' + cookie.name + '" = ' + valIn.value;
      });
    };

    var copyBtn = document.createElement('button');
    copyBtn.className = BTN;
    copyBtn.textContent = 'Copy';
    copyBtn.style.cssText = 'font-size:10px; flex:0 0 auto;';
    copyBtn.onclick = function () {
      navigator.clipboard.writeText(cookie.name + '=' + valIn.value)
        .then(function () { cookiesStatus.textContent = 'Copied: ' + cookie.name + '=' + valIn.value; })
        .catch(function () { cookiesStatus.textContent = 'Copy failed.'; });
    };

    bottom.appendChild(valIn);
    bottom.appendChild(saveBtn);
    bottom.appendChild(copyBtn);
    row.appendChild(bottom);
    return row;
  }
})();
