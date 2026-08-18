'use strict';
// ============================================================
// test/scope.test.js - unit tests for scope.js's checkScope()
// domain-matching logic (the gate in front of EXECUTE / POST /
// Fuzzer / Intruder requests).
// ============================================================
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadInWindow } = require('./load-in-window');

const window = loadInWindow('scope.js');
const { checkScope } = window.KHackBar.Scope;

describe('checkScope: empty pattern = allow-all', () => {
  test('undefined pattern allows any URL', () => {
    const result = checkScope('https://example.com/anything', undefined);
    assert.deepEqual(result, { allowed: true });
  });

  test('empty-string pattern allows any URL', () => {
    const result = checkScope('https://totally-different.org/x', '');
    assert.deepEqual(result, { allowed: true });
  });
});

describe('checkScope: exact host match', () => {
  test('bare domain pattern matches the exact same host', () => {
    const result = checkScope('https://example.com/login.php', 'example.com');
    assert.equal(result.allowed, true);
  });

  test('matching is case-insensitive on both sides', () => {
    const result = checkScope('HTTPS://Example.COM/Login', 'EXAMPLE.com');
    assert.equal(result.allowed, true);
  });

  test('different host is rejected with a reason', () => {
    const result = checkScope('https://notexample.com/', 'example.com');
    assert.equal(result.allowed, false);
    assert.match(result.reason, /Scope mismatch/);
  });
});

describe('checkScope: subdomain boundary (bare pattern)', () => {
  test('a real subdomain matches via the dot boundary', () => {
    const result = checkScope('https://api.example.com/v1', 'example.com');
    assert.equal(result.allowed, true);
  });

  test('"evil-example.com" must NOT match "example.com" (no dot boundary)', () => {
    const result = checkScope('https://evil-example.com/', 'example.com');
    assert.equal(result.allowed, false);
  });

  test('a totally unrelated domain that merely ends with the pattern text is rejected', () => {
    const result = checkScope('https://notanexample.com/', 'example.com');
    assert.equal(result.allowed, false);
  });
});

describe('checkScope: *.domain wildcard pattern', () => {
  test('a subdomain matches the wildcard', () => {
    const result = checkScope('https://api.example.com/', '*.example.com');
    assert.equal(result.allowed, true);
  });

  test('the bare domain itself also matches the wildcard', () => {
    const result = checkScope('https://example.com/', '*.example.com');
    assert.equal(result.allowed, true);
  });

  test('an unrelated domain does not match the wildcard', () => {
    const result = checkScope('https://evil.com/', '*.example.com');
    assert.equal(result.allowed, false);
  });
});

describe('checkScope: URL-form patterns are normalized to a host pattern', () => {
  test('"https://example.com/*" behaves like the bare host', () => {
    const result = checkScope('https://example.com/page', 'https://example.com/*');
    assert.equal(result.allowed, true);
  });

  test('"http://example.com/*" behaves like the bare host regardless of scheme', () => {
    const result = checkScope('https://example.com/page', 'http://example.com/*');
    assert.equal(result.allowed, true);
  });

  test('"https://*.example.com/*" behaves like the *.domain wildcard', () => {
    const result = checkScope('https://sub.example.com/x', 'https://*.example.com/*');
    assert.equal(result.allowed, true);
  });

  test('"*://*.example.com/*" (protocol-relative) behaves like the *.domain wildcard', () => {
    const result = checkScope('https://sub.example.com/x', '*://*.example.com/*');
    assert.equal(result.allowed, true);
  });
});

describe('checkScope: invalid input handling', () => {
  test('an unparseable target URL is rejected with an explanatory reason', () => {
    const result = checkScope('not a url at all', 'example.com');
    assert.equal(result.allowed, false);
    assert.match(result.reason, /Invalid target URL/);
  });
});
