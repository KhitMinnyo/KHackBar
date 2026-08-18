'use strict';
// ============================================================
// test/load-in-window.js - tiny helper to unit-test KHackBar's
// browser-style modules without a real DOM/extension runtime.
//
// KHackBar's source files are plain scripts that attach themselves
// to a global `window` object (e.g. `window.KHackBar.Scope = ...`)
// rather than using module.exports. This loads a given source file
// into an isolated vm context with a stub `window` (and optionally
// a stub `chrome`), then hands back that context's `window` so
// tests can reach the functions it attached.
// ============================================================
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * @param {string} relPath - path to the script, relative to the repo root
 *   (the parent directory of this test/ folder), e.g. "scope.js".
 * @param {object} [opts]
 * @param {object} [opts.window] - initial contents of the global `window`
 *   object, set before the script runs (e.g. pre-seed `window.KHackBar`
 *   so dependency-guard checks don't warn).
 * @param {object} [opts.chrome] - stub `chrome.*` API surface, exposed
 *   as the global `chrome`.
 * @returns {object} the `window` object after the script ran.
 *
 * Deliberately runs via vm.runInThisContext() (the current V8 realm)
 * rather than vm.createContext()/runInContext() (a fresh realm). A fresh
 * realm gives the script its own distinct Array/Object intrinsics, so
 * e.g. an array literal it builds would have a different Array.prototype
 * than this test file's arrays - assert.deepStrictEqual then fails with
 * "same structure but not reference-equal" even when the content matches.
 * Running in this context keeps intrinsics shared, at the cost of
 * touching the real `global.window`/`global.chrome` for the duration of
 * the call (restored afterward).
 */
function loadInWindow(relPath, opts) {
  opts = opts || {};
  const filePath = path.join(__dirname, '..', relPath);
  const code = fs.readFileSync(filePath, 'utf8');

  const hadWindow = Object.prototype.hasOwnProperty.call(global, 'window');
  const hadChrome = Object.prototype.hasOwnProperty.call(global, 'chrome');
  const previousWindow = global.window;
  const previousChrome = global.chrome;

  global.window = opts.window || {};
  if (opts.chrome) global.chrome = opts.chrome;

  try {
    vm.runInThisContext(code, { filename: filePath });
    return global.window;
  } finally {
    if (hadWindow) global.window = previousWindow; else delete global.window;
    if (hadChrome) global.chrome = previousChrome; else if (opts.chrome) delete global.chrome;
  }
}

module.exports = { loadInWindow };
