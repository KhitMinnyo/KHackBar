'use strict';
// ============================================================
// test/fuzzer-intruder.test.js - unit tests for fuzzer.js's
// §value§ marker parsing (parseMarked / fillTemplate), the core
// of Intruder's Sniper/Cluster Bomb payload substitution.
//
// Note: these tests deliberately never hand-type the TOK_A/TOK_B
// placeholder delimiters themselves (they are invisible Unicode
// Private-Use-Area characters, / - see the comment
// above their declaration in fuzzer.js). Instead every test drives
// parseMarked/fillTemplate through their public input/output
// contract (bases, next, and round-tripping through fillTemplate),
// which is both safer to write and a better black-box test of the
// documented behaviour.
// ============================================================
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadInWindow } = require('./load-in-window');

// Pre-seed window.KHackBar.UI / .Scope so fuzzer.js's dependency
// guards (console.error on missing module) stay quiet - they're not
// needed to exercise parseMarked/fillTemplate.
const window = loadInWindow('fuzzer.js', {
  window: { KHackBar: { UI: {}, Scope: {} } },
});
const { MARKER, parseMarked, fillTemplate } = window.KHackBar.Fuzzer;

test('MARKER is the Burp-style § position marker', () => {
  assert.equal(MARKER, '§');
});

describe('parseMarked: single position', () => {
  const parsed = parseMarked('user=§admin§&pass=x', 0);

  test('extracts the marked value into bases', () => {
    assert.deepEqual(parsed.bases, ['admin']);
  });

  test('advances next past the one position consumed', () => {
    assert.equal(parsed.next, 1);
  });

  test('the template no longer contains a literal §', () => {
    assert.equal(parsed.template.includes('§'), false);
  });

  test('fillTemplate with the original bases reconstructs the source text', () => {
    assert.equal(fillTemplate(parsed.template, parsed.bases), 'user=admin&pass=x');
  });

  test('fillTemplate with a missing rendered value substitutes empty string', () => {
    assert.equal(fillTemplate(parsed.template, []), 'user=&pass=x');
  });
});

describe('parseMarked: multiple positions', () => {
  const parsed = parseMarked('user=§admin§&pass=§secret§', 0);

  test('extracts both marked values in order', () => {
    assert.deepEqual(parsed.bases, ['admin', 'secret']);
  });

  test('advances next past both positions consumed', () => {
    assert.equal(parsed.next, 2);
  });

  test('fillTemplate reconstructs both substitutions', () => {
    assert.equal(fillTemplate(parsed.template, parsed.bases), 'user=admin&pass=secret');
  });
});

describe('parseMarked: startIdx lets url/body/cookie share one index space', () => {
  test('a non-zero startIdx is reflected in next', () => {
    const parsed = parseMarked('§foo§', 5);
    assert.deepEqual(parsed.bases, ['foo']);
    assert.equal(parsed.next, 6);
  });

  test('filling requires a rendered array indexed by the absolute position', () => {
    const parsed = parseMarked('§foo§', 5);
    const rendered = [];
    rendered[5] = 'BAR';
    assert.equal(fillTemplate(parsed.template, rendered), 'BAR');
    // A rendered array that doesn't cover index 5 yields empty string,
    // not the literal placeholder or an exception.
    assert.equal(fillTemplate(parsed.template, []), '');
  });

  test('a full url+body round trip shares one continuous position index space', () => {
    const url = parseMarked('https://site.test/§a§', 0);
    const body = parseMarked('user=§b§', url.next);

    assert.deepEqual(url.bases, ['a']);
    assert.deepEqual(body.bases, ['b']);
    assert.equal(url.next, 1);
    assert.equal(body.next, 2);

    const rendered = [];
    rendered[0] = 'A';
    rendered[1] = 'B';
    assert.equal(fillTemplate(url.template, rendered), 'https://site.test/A');
    assert.equal(fillTemplate(body.template, rendered), 'user=B');
  });
});

describe('parseMarked: no markers present', () => {
  test('text with no § is returned unchanged with no bases consumed', () => {
    const input = 'plain text no markers';
    const parsed = parseMarked(input, 0);
    assert.deepEqual(parsed.bases, []);
    assert.equal(parsed.next, 0);
    assert.equal(parsed.template, input);
  });
});

describe('parseMarked: unmatched trailing § falls back to literal text', () => {
  test('an odd, unclosed § is preserved literally rather than consumed', () => {
    const input = 'user=§admin';
    const parsed = parseMarked(input, 0);
    assert.deepEqual(parsed.bases, []);
    assert.equal(parsed.next, 0);
    assert.equal(parsed.template, input);
    assert.equal(parsed.template.includes('§'), true);
  });
});

describe('fillTemplate: text with no placeholder tokens', () => {
  test('is returned unchanged regardless of the rendered array', () => {
    assert.equal(fillTemplate('no tokens here', ['x', 'y']), 'no tokens here');
    assert.equal(fillTemplate('no tokens here', []), 'no tokens here');
  });
});
