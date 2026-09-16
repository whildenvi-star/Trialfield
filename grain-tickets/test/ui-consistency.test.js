// test/ui-consistency.test.js
// Phase 17-03 — structural gate over public/index.html, public/tickets.js,
// public/style.css and public/platform-tokens.css. Fails loudly if the
// Marketing Sync column's header count, TOTAL_COLS bookkeeping, pill CSS
// class coverage, token definitions, or cache-bust versions ever drift
// apart from each other. Uses Node's built-in test runner (`node --test`),
// zero new dependencies — same convention as test/marketing-sync.test.js.

'use strict';

const fs = require('fs');
const path = require('path');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// Single source of truth for the marketing-sync status list. If a seventh
// state is ever added to tickets.js/style.css without updating this array
// (or vice versa), the coverage assertions below fail loudly rather than
// silently passing on a subset.
const STATUSES = ['no-buyer', 'pending', 'applied', 'unapplied', 'skipped', 'error'];

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function read(file) {
  return fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
}

describe('ticket table header/column geometry', () => {
  test('#ticket-table thead has 17 th elements', () => {
    const html = read('index.html');
    const start = html.indexOf('id="ticket-table"');
    assert.ok(start !== -1, 'expected to find #ticket-table in index.html');
    const theadClose = html.indexOf('</thead>', start);
    assert.ok(theadClose !== -1, 'expected a closing </thead> after #ticket-table');
    const theadSlice = html.slice(start, theadClose);
    const thCount = (theadSlice.match(/<th[ >]/g) || []).length;
    assert.equal(thCount, 17, `expected 17 <th> in #ticket-table thead, found ${thCount}`);
  });

  test('index.html declares a Marketing Sync header', () => {
    const html = read('index.html');
    assert.match(html, /<th>Marketing Sync<\/th>/);
  });

  test('tickets.js TOTAL_COLS is 17', () => {
    const js = read('tickets.js');
    const m = js.match(/TOTAL_COLS\s*=\s*(\d+)/);
    assert.ok(m, 'expected to find a TOTAL_COLS assignment in tickets.js');
    assert.equal(Number(m[1]), 17, `expected TOTAL_COLS === 17, found ${m[1]}`);
  });
});

describe('marketing sync pill status coverage', () => {
  test('every status in the STATUSES list is present in tickets.js msLabels map', () => {
    const js = read('tickets.js');
    const blockMatch = js.match(/var msLabels\s*=\s*\{([\s\S]*?)\n\s*\};/);
    assert.ok(blockMatch, 'expected to find a msLabels object literal in tickets.js');
    const block = blockMatch[1];
    STATUSES.forEach((status) => {
      const keyPattern = new RegExp("(^|[\\s,{])'?" + status + "'?\\s*:");
      assert.ok(keyPattern.test(block), `expected msLabels to define a '${status}' key`);
    });
  });

  test('every status in the STATUSES list has a matching .status-pill.badge-mktsync-<status> rule in style.css', () => {
    const css = read('style.css');
    const found = new Set();
    const ruleRe = /\.status-pill\.badge-mktsync-([a-z-]+)\s*\{/g;
    let m;
    while ((m = ruleRe.exec(css)) !== null) {
      found.add(m[1]);
    }
    STATUSES.forEach((status) => {
      assert.ok(found.has(status), `expected style.css to define .status-pill.badge-mktsync-${status}`);
    });
    // Symmetry check: the css rule count must equal STATUSES.length so a
    // rule added for an undocumented 7th state (or one removed) fails here
    // instead of silently passing a subset match above.
    assert.equal(found.size, STATUSES.length,
      `expected exactly ${STATUSES.length} badge-mktsync-* rules in style.css, found ${found.size} (${[...found].sort().join(', ')})`);
  });

  test('mktsync-contract label rule exists in style.css', () => {
    const css = read('style.css');
    assert.match(css, /\.mktsync-contract\s*\{/);
  });
});

describe('marketing sync CSS custom-property coverage', () => {
  test('every --pill-mktsync-* variable referenced by style.css is defined in platform-tokens.css', () => {
    const css = read('style.css');
    const tokens = read('platform-tokens.css');

    const referenced = new Set();
    const refRe = /var\((--pill-mktsync-[a-zA-Z0-9-]+)\)/g;
    let m;
    while ((m = refRe.exec(css)) !== null) {
      referenced.add(m[1]);
    }
    assert.ok(referenced.size > 0, 'expected style.css to reference at least one --pill-mktsync-* variable');

    referenced.forEach((varName) => {
      const defPattern = new RegExp('(^|\\s)' + varName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*:');
      assert.ok(defPattern.test(tokens), `expected platform-tokens.css to define ${varName}`);
    });
  });
});

describe('cache-bust discipline (2026-08-05 stale-asset incident precedent)', () => {
  test('index.html no longer references the pre-phase asset versions', () => {
    const html = read('index.html');
    assert.ok(!html.includes('tickets.js?v=20260806b'), 'stale tickets.js?v=20260806b still referenced');
    assert.ok(!html.includes('style.css?v=2'), 'stale style.css?v=2 still referenced');
    assert.ok(!html.includes('platform-tokens.css?v=2'), 'stale platform-tokens.css?v=2 still referenced');
  });
});
