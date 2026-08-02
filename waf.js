// ============================================================
// waf.js - WAF Bypass panel renderer
// ============================================================
// The WAF panel behaves differently from every other payload panel:
// instead of just inserting a fixed string at the cursor, its buttons
// act on whatever text you've already selected in the URL box.
//
//   1. Select a keyword/value in the URL box (e.g. "UNION SELECT").
//   2. Click a bypass button (e.g. "/*!{{SEL}}*/").
//   3. The selection is wrapped/transformed in place
//      (e.g. becomes "/*!UNION SELECT*/").
//
// If nothing is selected, "wrap" buttons insert their template at the
// cursor with a "STRING" placeholder pre-selected so you can type over
// it immediately. "Transform" buttons (case randomizer, space encoding,
// etc.) need an actual selection to operate on, since there's nothing
// to transform otherwise.

window.KHackBar = window.KHackBar || {};
window.KHackBar.Waf = window.KHackBar.Waf || {};

/**
 * Render the WAF bypass panel.
 * @param {HTMLElement} panel - The waf_panel container element
 * @param {HTMLElement} urlBox - The URL textarea element
 * @param {function} [setStatus] - Optional status text callback
 */
window.KHackBar.Waf.render = function (panel, urlBox, setStatus) {
  if (!panel || !urlBox) return;
  if (!window.KHackBar.UI || !window.KHackBar.Payloads) return;

  var notify = typeof setStatus === 'function' ? setStatus : function () {};

  while (panel.firstChild) panel.removeChild(panel.firstChild);
  panel.style.flexDirection = 'column';

  var hint = document.createElement('div');
  hint.style.width = '100%';
  hint.style.fontSize = '10px';
  hint.style.color = '#a3a3a3';
  hint.style.marginBottom = '8px';
  hint.textContent = 'Select text in the URL box, then click a technique below to wrap/transform it in place. With nothing selected, wrap buttons insert a "STRING" placeholder you can type over.';
  panel.appendChild(hint);

  function makeSectionHeading(title) {
    var heading = document.createElement('div');
    heading.className = 'settings-section-title';
    heading.textContent = title;
    return heading;
  }

  function makeButtonRow() {
    var row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexWrap = 'wrap';
    row.style.gap = '4px';
    row.style.marginBottom = '8px';
    row.style.width = '100%';
    return row;
  }

  // ---- Wrap-template groups (Comment Injection, Keyword Bypass, Concat) ----
  var templates = window.KHackBar.Payloads.wafTemplates || {};
  Object.keys(templates).forEach(function (groupName) {
    var section = document.createElement('div');
    section.style.width = '100%';
    section.appendChild(makeSectionHeading(groupName));

    var row = makeButtonRow();
    templates[groupName].forEach(function (item) {
      var btn = document.createElement('button');
      btn.className = 'small-btn';
      btn.textContent = item.label;
      btn.title = item.value.indexOf('{{SEL}}') !== -1
        ? 'Wraps your selection: ' + item.value.replace('{{SEL}}', '<selection>')
        : 'Replaces your selection with: ' + item.value;
      btn.onclick = function () {
        window.KHackBar.UI.wrapSelectionWithTemplate(urlBox, item.value);
      };
      row.appendChild(btn);
    });
    section.appendChild(row);
    panel.appendChild(section);
  });

  // ---- Transform groups (Whitespace/Encoding, Case/Numeric) ----
  var transforms = window.KHackBar.Payloads.wafTransforms || {};
  Object.keys(transforms).forEach(function (groupName) {
    var section = document.createElement('div');
    section.style.width = '100%';
    section.appendChild(makeSectionHeading(groupName));

    var row = makeButtonRow();
    transforms[groupName].forEach(function (item) {
      var btn = document.createElement('button');
      btn.className = 'small-btn';
      btn.textContent = item.label;
      btn.title = 'Select text in the URL box first, then click to apply this transform to it.';
      btn.onclick = function () {
        var applied = window.KHackBar.UI.transformSelection(urlBox, item.fn);
        if (!applied) {
          notify('[!] Select text in the URL box first.');
        }
      };
      row.appendChild(btn);
    });
    section.appendChild(row);
    panel.appendChild(section);
  });

  // ---- One-shot extraction payloads (plain insert-at-cursor) ----
  var oneShot = window.KHackBar.Payloads.wafOneShot || [];
  if (oneShot.length > 0) {
    var section = document.createElement('div');
    section.style.width = '100%';
    section.appendChild(makeSectionHeading('One-Shot Extraction'));

    var row = makeButtonRow();
    oneShot.forEach(function (item) {
      var btn = window.KHackBar.UI.createPayloadButton(item.label, item.value, 'waf_panel', urlBox);
      row.appendChild(btn);
    });
    section.appendChild(row);
    panel.appendChild(section);
  }
};
