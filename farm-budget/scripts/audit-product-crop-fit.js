#!/usr/bin/env node
'use strict';

// Read-only audit: every input row already on the books, checked against the
// product-to-crop/trait rules in lib/docintake/crop-fit.js.
//
// Writes nothing. Opens data.json read-only, prints a report, exits.
//
// This is the check that would have caught the Carrol and Christopherson bean
// passes: both landed on a parcel carrying exactly one enterprise, so the
// enterprise guard in match.js had nothing to disagree with, but an Enlist One
// line on a White corn row is wrong on the product alone.
//
// Usage:
//   node scripts/audit-product-crop-fit.js [--data path] [--json] [--traits]
//
//   --data    data.json to read (default: ./data/data.json)
//   --json    emit JSON instead of the printed report
//   --traits  also list every soybean enterprise and its recorded seed trait

const fs = require('fs');
const path = require('path');
const fit = require('../lib/docintake/crop-fit');

const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const DATA = path.resolve(arg('data', path.join(__dirname, '..', 'data', 'data.json')));
const AS_JSON = argv.includes('--json');
const SHOW_TRAITS = argv.includes('--traits');

const store = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const fields = store.fields || [];

const money = n => '$' + Number(n || 0).toFixed(2);

// ── the sweep ───────────────────────────────────────────────────
const hits = [];
let checked = 0, neutral = 0, invoiced = 0;

fields.forEach(function (f, fi) {
  (f.inputs || []).forEach(function (r, ri) {
    if (r.invoiceNumber) invoiced++;
    if (fit.isNeutral(r.productName)) { neutral++; return; }
    checked++;
    const v = fit.checkRow(store, f, r, { comments: r.statusNote });
    if (v.verdict === 'ok') return;
    hits.push({
      verdict: v.verdict,
      rule: v.rule,
      reason: v.reason,
      fieldIndex: fi,
      fieldId: f.id,
      registryFieldId: f.registryFieldId || null,
      fieldName: f.name,
      crop: f.crop,
      seedTrait: f.seedTrait || null,
      rowIndex: ri,
      inputId: r.id,
      productName: r.productName,
      invoiceNumber: r.invoiceNumber || null,
      invoiceDate: r.invoiceDate || null,
      invoiceAcres: r.invoiceAcres != null ? r.invoiceAcres : null,
      operationGroup: r.operationGroup || null,
      passStatus: r.passStatus || null,
      cost: Number(r.invoiceCostTotal || 0)
    });
  });
});

// ── soybean enterprises and their traits ────────────────────────
const beanRows = fields
  .filter(function (f) { return fit.cropFamily(f.crop) === 'soybean'; })
  .map(function (f) {
    return {
      fieldId: f.id, name: f.name, crop: f.crop,
      registryFieldId: f.registryFieldId || null,
      plantedAcres: f.plantedAcres, acres: f.acres,
      seeds: ((f.seeds || []).map(function (s) { return s.variety || s.name; }).filter(Boolean)).join(' / '),
      seedTrait: f.seedTrait || null,
      suggested: fit.suggestTrait(f)
    };
  });

if (AS_JSON) {
  console.log(JSON.stringify({
    data: DATA,
    counts: { fields: fields.length, invoicedRows: invoiced, checked: checked, neutral: neutral, hits: hits.length },
    ruleTableSource: (store.productCropRules && store.productCropRules.length) ? 'store.productCropRules' : 'RULE_SEED (built-in)',
    hits: hits,
    soybeanEnterprises: beanRows
  }, null, 2));
  process.exit(0);
}

console.log('Product-against-enterprise audit');
console.log('  data:  ' + DATA);
console.log('  rules: ' + ((store.productCropRules && store.productCropRules.length)
  ? store.productCropRules.length + ' rows from store.productCropRules'
  : fit.RULE_SEED.length + ' rows from the built-in seed table (store has none yet)'));
console.log('  rows:  ' + fields.reduce(function (n, f) { return n + (f.inputs || []).length; }, 0) +
  ' input rows, ' + invoiced + ' carrying an invoice number');
console.log('  swept: ' + checked + ' crop-relevant rows (' + neutral + ' neutral rows skipped)');
console.log('');

// A row with no invoice number is a PLANNED line — the budget's intention, not
// a pass DeLong billed. The matcher never sees those, so they are reported
// separately rather than mixed in with money that has actually moved.
const invoicedHits = hits.filter(function (h) { return h.invoiceNumber; });
const plannedHits = hits.filter(function (h) { return !h.invoiceNumber; });

const byVerdict = {};
invoicedHits.forEach(function (h) { (byVerdict[h.verdict] = byVerdict[h.verdict] || []).push(h); });

const ORDER = ['wrong-crop', 'wrong-trait', 'organic', 'unknown-trait'];
ORDER.filter(function (v) { return byVerdict[v]; }).forEach(function (v) {
  const list = byVerdict[v];
  const dollars = list.reduce(function (s, h) { return s + h.cost; }, 0);
  console.log('── ' + v + ' — ' + list.length + ' rows, ' + money(dollars) + ' ─────────────────────');
  // group by enterprise so a whole misplaced pass reads as one thing
  const groups = {};
  list.forEach(function (h) {
    const k = h.fieldId + '|' + (h.invoiceNumber || '-');
    (groups[k] = groups[k] || []).push(h);
  });
  Object.keys(groups).forEach(function (k) {
    const g = groups[k], h0 = g[0];
    console.log('  [' + h0.fieldIndex + '] ' + h0.fieldName + ' / ' + h0.crop +
      '   invoice ' + (h0.invoiceNumber || '(none)') + (h0.invoiceDate ? ' ' + h0.invoiceDate : '') +
      '   ' + g.length + ' row' + (g.length > 1 ? 's' : '') + ', ' +
      money(g.reduce(function (s, x) { return s + x.cost; }, 0)));
    g.forEach(function (h) {
      console.log('      in[' + h.rowIndex + '] ' + String(h.productName).padEnd(34) +
        ' ' + money(h.cost).padStart(10) + '   ' + h.rule);
    });
    console.log('      ' + h0.reason);
  });
  console.log('');
});

if (!invoicedHits.length) console.log('No product/enterprise mismatches on invoiced rows.\n');

if (plannedHits.length) {
  console.log('── planned rows (no invoice — the matcher never sees these) ───');
  plannedHits.forEach(function (h) {
    console.log('  [' + h.fieldIndex + '] ' + String(h.fieldName).slice(0, 26).padEnd(28) +
      String(h.crop).slice(0, 24).padEnd(26) + 'in[' + h.rowIndex + '] ' +
      String(h.productName).slice(0, 24).padEnd(26) + h.verdict);
  });
  console.log('');
}

if (SHOW_TRAITS) {
  console.log('── soybean enterprises and their seed trait ──────────────────');
  console.log('  field                          crop                        planted  seed          trait        suggested');
  beanRows.forEach(function (b) {
    console.log('  ' + String(b.name).slice(0, 28).padEnd(30) + String(b.crop).slice(0, 26).padEnd(28) +
      String(b.plantedAcres).padStart(7) + '  ' + String(b.seeds).slice(0, 12).padEnd(14) +
      String(b.seedTrait || '—').padEnd(13) + String(b.suggested || '—'));
  });
  const missing = beanRows.filter(function (b) { return !b.seedTrait; }).length;
  console.log('\n  ' + missing + ' of ' + beanRows.length + ' soybean enterprises have no recorded seed trait.');
}

console.log('Total: ' + invoicedHits.length + ' invoiced rows flagged, ' +
  money(invoicedHits.reduce(function (s, h) { return s + h.cost; }, 0)) + ' of invoiced cost' +
  (plannedHits.length ? ', plus ' + plannedHits.length + ' planned rows.' : '.'));
