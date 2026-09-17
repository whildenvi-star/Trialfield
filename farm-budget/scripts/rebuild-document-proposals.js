#!/usr/bin/env node
'use strict';

// Recompute the stored proposal for every document on file, with the matcher
// as it stands now. Dry-run by default.
//
//   node scripts/rebuild-document-proposals.js [--write]
//
// Why this is needed: GET /api/documents/review-queue reads `ambiguousEnterprise`
// and `cropMismatch` off the proposals SAVED on each document record, and those
// were computed by whichever matcher was running at upload time. A document
// scanned before the enterprise guard and the crop/trait check existed carries a
// proposal that predates both, so the queue reports zero however many lines the
// current rules would refuse. Re-uploading the same scan would fix it — the id
// is the content hash, so it lands on the same record — but that means finding
// the paper again.
//
// This writes ONLY to data/documents/ledger.json. The budget is untouched: a
// proposal is what the matcher WOULD write, never what it has written, and
// already-applied rows keep reading "already on file" because that status is
// recomputed from the budget's own rows.

const path = require('path');
const docStore = require('../lib/docintake/store');
const docMatch = require('../lib/docintake/match');

const WRITE = process.argv.includes('--write');
const store = require(path.join(__dirname, '..', 'data', 'data.json'));

const refs = {
  fields: store.fields,
  products: store.products,
  programs: store.programs,
  productCropRules: store.productCropRules
};

const summaries = docStore.list(500);
console.log((WRITE ? 'REBUILDING' : 'DRY RUN') + ' — ' + summaries.length + ' documents on file\n');

let rebuilt = 0, queued = 0, queuedLines = 0;

summaries.forEach(function (s) {
  const rec = docStore.get(s.id);
  if (!rec) return;
  const invoices = (rec.extracted && rec.extracted.invoices) || [];
  if (!invoices.length) {
    console.log('  ' + s.id + '  ' + (s.filename || '') + ' — no invoices (' + (rec.docKind || '?') + '), skipped');
    return;
  }

  const before = rec.proposals || [];
  const after = invoices.map(function (inv) { return docMatch.proposeInvoice(inv, refs); });

  console.log('  ' + s.id + '  ' + (s.filename || '') + (rec.appliedAt ? '  [applied ' + rec.appliedAt + ']' : ''));
  after.forEach(function (p, i) {
    const b = before[i];
    const flags = [];
    if (p.ambiguousEnterprise) flags.push('ambiguous-enterprise');
    if (p.cropMismatch) flags.push('crop-mismatch');
    const wasField = b ? (b.fieldName || '—') : '—';
    const nowField = p.fieldName || '—';
    const moved = wasField !== nowField;
    console.log('    invoice ' + String(p.invoiceNumber || '?').padEnd(11) +
      (moved ? wasField + ' -> ' + nowField : nowField) +
      (flags.length ? '   ** ' + flags.join(', ') + ' **' : ''));
    if (flags.length) {
      queued++;
      const lines = (p.rows || []).filter(function (r) {
        return r.status === docMatch.STATUS.AMBIGUOUS || r.status === docMatch.STATUS.CROP_MISMATCH;
      });
      queuedLines += lines.length;
      lines.forEach(function (r) {
        console.log('        ' + String(r.description).slice(0, 40).padEnd(42) + r.status);
        if (r.note) console.log('        ' + r.note);
      });
    }
    // status counts, so a rebuild that changes nothing is visible as such
    const counts = {};
    (p.rows || []).forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    console.log('        ' + Object.keys(counts).map(function (k) { return k + ' ' + counts[k]; }).join(', '));
  });

  if (WRITE) {
    docStore.upsert({ id: rec.id, proposals: after });
    rebuilt++;
  }
});

console.log('\n' + (WRITE ? 'rebuilt ' + rebuilt + ' documents. ' : '') +
  'Queue after this: ' + queued + ' invoices, ' + queuedLines + ' lines.');
if (!WRITE) console.log('re-run with --write to apply');
