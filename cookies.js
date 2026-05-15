// ============================================================
// cookies.js - Cookie management functions
// ============================================================

// ---- Namespace ----
window.KHackBar = window.KHackBar || {};
window.KHackBar.Cookies = window.KHackBar.Cookies || {};

/**
 * Load cookies from the current tab and display them in the cookies panel.
 * @param {HTMLElement} cookiesList - The container for cookie entries
 * @param {HTMLElement} cookiesStatus - The status text element
 */
window.KHackBar.Cookies.loadFromCurrentTab = function (cookiesList, cookiesStatus) {
  if (!cookiesList || !cookiesStatus) return;

  // Clear existing cookies display
  while (cookiesList.firstChild) {
    cookiesList.removeChild(cookiesList.firstChild);
  }

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0] || !tabs[0].url) {
      cookiesStatus.textContent = 'No active tab found.';
      return;
    }

    var tabUrl = tabs[0].url;
    try {
      var urlObj = new URL(tabUrl);
      var domain = urlObj.hostname;

      chrome.cookies.getAll({ url: tabUrl }, function (cookies) {
        if (chrome.runtime.lastError) {
          cookiesStatus.textContent = 'Error: ' + chrome.runtime.lastError.message;
          return;
        }

        if (!cookies || cookies.length === 0) {
          cookiesStatus.textContent = 'No cookies found for ' + domain;
          return;
        }

        cookiesStatus.textContent = cookies.length + ' cookie(s) for ' + domain;
        cookiesList.style.flexDirection = 'column';

        cookies.forEach(function (cookie) {
          var row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '4px';
          row.style.padding = '4px';
          row.style.borderBottom = '1px solid #3f3f3f';
          row.style.fontSize = '10px';

          var nameSpan = document.createElement('span');
          nameSpan.style.color = '#22c55e';
          nameSpan.style.fontWeight = 'bold';
          nameSpan.style.minWidth = '80px';
          nameSpan.textContent = cookie.name;

          var valueSpan = document.createElement('span');
          valueSpan.style.color = '#a3a3a3';
          valueSpan.style.wordBreak = 'break-all';
          valueSpan.style.flex = '1';
          valueSpan.textContent = cookie.value;

          var copyBtn = document.createElement('button');
          copyBtn.className = 'small-btn';
          copyBtn.textContent = 'Copy';
          copyBtn.style.fontSize = '9px';
          copyBtn.onclick = function () {
            navigator.clipboard.writeText(cookie.name + '=' + cookie.value)
              .then(function () {
                cookiesStatus.textContent = 'Copied: ' + cookie.name + '=' + cookie.value;
              })
              .catch(function () {
                cookiesStatus.textContent = 'Failed to copy.';
              });
          };

          row.appendChild(nameSpan);
          row.appendChild(valueSpan);
          row.appendChild(copyBtn);
          cookiesList.appendChild(row);
        });
      });
    } catch (e) {
      cookiesStatus.textContent = 'Invalid tab URL: ' + tabUrl;
    }
  });
};
