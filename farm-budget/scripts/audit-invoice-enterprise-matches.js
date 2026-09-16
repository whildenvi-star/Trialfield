#!/usr/bin/env node
'use strict';

// Read-only audit: which invoice-sourced passes may have landed on the wrong
// crop enterprise.
//
// Writes nothing. Opens data.json read-only, prints a report, exits.
//
// Background: until the enterprise guard in lib/docintake/match.js, an invoice
// whose parcel carried more than one crop enterprise was resolved by taking the
// top-scoring row — and because sibling rows share a name and an acreage, the
// ranking could not separate them. This lists every pass written through that
// path so the ones that landed wrong can be found.
//
// Usage:
//   node scripts/audit-invoice-enterprise-matches.js [--data path] [--recon dir] [--json]
//
//   --data   data.json to read (default: ./data/data.json)
//   --recon  delong-recon-bundle directory; joins invoice comments by invoice
//            number so the crop named on the page can be compared with the crop
//            of the enterprise the pass landed on
//   --json   emit JSON instead of the printed report

const fs = require('fs');
const path = require('path');
const match = require('../lib/docintake/match');

// ── args ────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}
const DATA = path.resolve(arg('data', path.join(__dirname, '..', 'data', 'data.json')));
const RECON = arg('recon', null);
const AS_JSON = argv.includes('--json');

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const fields = data.fields || [];
const programs = data.programs || [];

// ── recon comments (optional) ───────────────────────────────────
// Minimal CSV reader: the recon export quotes any field containing a comma.
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift() || [];
  return rows.filter(function (r) { return r.length > 1; }).map(function (r) {
    const o = {};
    head.forEach(function (h, i) { o[h] = r[i]; });
    return o;
  });
}

const invoiceMeta = {}; // invoiceNumber -> { comments, fieldName, acres }
if (RECON) {
  const f = path.join(path.resolve(RECON), 'invoices.csv');
  if (fs.existsSync(f)) {
    readCsv(f).forEach(function (r) {
      if (!r.invoice_no) return;
      invoiceMeta[String(r.invoice_no).trim()] = {
        comments: r.comments || '',
        fieldName: r.field_name || '',
        acres: r.header_acres || '',
        isPassCandidate: String(r.is_pass_candidate).toLowerCase() === 'true'
      };
    });
  } else {
    console.error('! no invoices.csv under ' + RECON + ' — continuing without comments');
  }
}

// ── crop vocabulary ─────────────────────────────────────────────
// Every word that appears in a crop name anywhere in the book. Used to decide
// whether a comments line is naming a crop at all — "Post Beans" is, "Fall 25
// Fert Elwood Buchanon Wess" is not.
const cropWords = Object.create(null);
fields.forEach(function (f) {
  match.normalize(f.crop || '').split(' ').filter(Boolean).forEach(function (w) {
    if (w.length >= 4) cropWords[w] = true;
  });
});

function cropWordsIn(text) {
  const seen = [];
  match.normalize(text).split(' ').filter(Boolean).forEach(function (w) {
    if (cropWords[w] && seen.indexOf(w) < 0) seen.push(w);
  });
  return seen;
}

// Crop words agree on the family, not the string. The page writes "Pre Beans"
// for a pass on High Oil Soybeans and "Post Food Beans" for one on food beans —
// both are beans, and comparing tokens strictly calls every one of them a
// contradiction. Match when either word ends with the other, which unites
// beans/soybeans and corn/seedcorn while still keeping beans and corn apart.
function sameCropFamily(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.endsWith(b) || b.endsWith(a);
}

// A removal-replacement invoice names the crop that came OFF, not the crop the
// pass is for: "Fall 25 P&K Removal Blend Beans" is potash and triple super
// replacing what last year's beans took out, spread on ground that grows corn
// next season. The crop word in those comments points backwards, so comparing
// it with the enterprise's crop reports a contradiction on every correctly
// placed fall fertility line — 20-odd of them, which buries the real findings.
function isRemovalReplacement(comments) {
  return /removal/i.test(String(comments || ''));
}

function cropAgrees(commentCrops, cropName) {
  const mine = match.normalize(cropName || '').split(' ').filter(Boolean);
  return commentCrops.some(function (w) {
    return mine.some(function (m) { return sameCropFamily(m, w); });
  });
}

// ── parcels ─────────────────────────────────────────────────────
const parcels = {};
fields.forEach(function (f) {
  const k = match.parcelKey(f);
  (parcels[k] = parcels[k] || []).push(f);
});
const multi = Object.keys(parcels).filter(function (k) { return parcels[k].length > 1; });

// ── walk the confirmed invoice rows ─────────────────────────────
const findings = [];
let totalInvoiceRows = 0;

multi.forEach(function (key) {
  const siblings = parcels[key];
  siblings.forEach(function (f) {
    const plannedHere = match.plannedProductNames(f, programs);
    (f.inputs || []).forEach(function (inp) {
      if (!inp.invoiceNumber) return;
      totalInvoiceRows++;

      const core = match.coreName(inp.productName || '');

      // apply.js creates a row it had no plan for as { quantity: 0 }. A zero
      // planned quantity alongside an invoice number therefore means this pass
      // was ADDED by the invoice, not confirmed against something the
      // enterprise had planned — the weaker of the two provenances.
      const wasAdded = Number(inp.quantity) === 0;

      // Does a sibling enterprise plan this product when this one does not?
      // That is the shape of a pass that landed on the wrong crop.
      const sibsPlanning = siblings.filter(function (s) {
        if (s.id === f.id) return false;
        return !!match.plannedProductNames(s, programs)[core];
      }).map(function (s) { return s.crop; });

      const meta = invoiceMeta[String(inp.invoiceNumber).trim()] || null;
      const removal = meta ? isRemovalReplacement(meta.comments) : false;
      const commentCrops = meta && !removal ? cropWordsIn(meta.comments) : [];
      const commentAgrees = commentCrops.length ? cropAgrees(commentCrops, f.crop) : null;
      // The comments name a crop, and it is not this enterprise's. On a parcel
      // with siblings, that is the page disagreeing with the book about which
      // crop got the pass.
      const commentContradicts = commentCrops.length > 0 && commentAgrees === false;

      // Two rows on one parcel growing the SAME crop (fld_027 carries "Brad
      // Inman's" and "Inman", both RR Soybeans). The matcher cannot choose
      // between them and neither can a human reading the invoice — it is a
      // duplicate enterprise, not a mis-homed pass.
      const twinCrop = siblings.some(function (s) {
        return s.id !== f.id && match.normalize(s.crop || '') === match.normalize(f.crop || '');
      });

      const flags = [];
      if (wasAdded && sibsPlanning.length && !twinCrop) flags.push('SIBLING-PLANS-IT');
      if (commentContradicts) flags.push('COMMENTS-DISAGREE');
      if (twinCrop) flags.push('duplicate-enterprise');
      if (removal) flags.push('removal-replacement');
      if (wasAdded && !sibsPlanning.length) flags.push('added-unplanned');
      if (inp.invoiceLineIndex == null) flags.push('pre-lineindex');

      findings.push({
        parcel: f.registryFieldId || f.name,
        fieldId: f.id,
        fieldName: f.name,
        crop: f.crop,
        siblingCrops: siblings.filter(function (s) { return s.id !== f.id; })
          .map(function (s) { return s.crop; }),
        product: inp.productName,
        invoiceNumber: inp.invoiceNumber,
        invoiceDate: inp.invoiceDate || inp.confirmedDate || null,
        invoiceAcres: inp.invoiceAcres,
        qtyTotal: inp.invoiceQtyTotal,
        costTotal: inp.invoiceCostTotal,
        plannedQty: inp.quantity,
        wasAdded: wasAdded,
        plannedHere: !!plannedHere[core],
        siblingsPlanning: sibsPlanning,
        comments: meta ? meta.comments : null,
        commentCrops: commentCrops,
        commentContradicts: commentContradicts,
        flags: flags,
        suspect: flags.indexOf('SIBLING-PLANS-IT') >= 0 || flags.indexOf('COMMENTS-DISAGREE') >= 0
      });
    });
  });
});

// ── single-enterprise parcels where the page names another crop ──
// Not what the multi-enterprise guard covers, but the same error: invoices
// 8004409 and 8004410 landed on corn rows at parcels that have no bean
// enterprise at all. Reported separately because the fix is different — the
// missing enterprise has to be created before the pass can be re-homed.
const orphans = [];
if (RECON) {
  fields.forEach(function (f) {
    if (parcels[match.parcelKey(f)].length > 1) return;
    (f.inputs || []).forEach(function (inp) {
      if (!inp.invoiceNumber) return;
      const meta = invoiceMeta[String(inp.invoiceNumber).trim()];
      if (!meta) return;
      if (isRemovalReplacement(meta.comments)) return;
      const commentCrops = cropWordsIn(meta.comments);
      if (!commentCrops.length) return;
      if (cropAgrees(commentCrops, f.crop)) return;
      orphans.push({
        fieldName: f.name, crop: f.crop, product: inp.productName,
        invoiceNumber: inp.invoiceNumber, invoiceDate: inp.invoiceDate,
        costTotal: inp.invoiceCostTotal, comments: meta.comments, commentCrops: commentCrops
      });
    });
  });
}

// ── output ──────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(JSON.stringify({ findings: findings, orphans: orphans }, null, 2));
  process.exit(0);
}

function money(v) { return v == null ? '' : '$' + Number(v).toFixed(2); }
function pad(s, n) { s = String(s == null ? '' : s); return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

console.log('');
console.log('Invoice-sourced passes on multi-enterprise parcels');
console.log('data: ' + DATA);
console.log('crop year: ' + ((data.settings && data.settings.year) || '?') +
            (RECON ? '   comments joined from: ' + RECON : '   (no --recon: comments not checked)'));
console.log('');
console.log(multi.length + ' parcels carry more than one crop enterprise; ' +
            totalInvoiceRows + ' invoice-sourced input rows sit on them.');

const suspect = findings.filter(function (f) { return f.suspect; });
console.log(suspect.length + ' of those are flagged for review.');
console.log('');

multi.forEach(function (key) {
  const sibs = parcels[key];
  const ids = sibs.map(function (s) { return s.id; });
  const rows = findings.filter(function (f) { return ids.indexOf(f.fieldId) >= 0; });
  if (!rows.length) return;
  console.log('── ' + sibs[0].name + '  [' + (sibs[0].registryFieldId || 'no registry id') + ']  ' +
              sibs.map(function (s) { return s.crop; }).join(' / '));
  rows.forEach(function (r) {
    const mark = r.suspect ? '  !! ' : '     ';
    console.log(mark + pad(r.crop, 24) + pad(r.product, 34) +
                pad('#' + r.invoiceNumber, 11) + pad(r.invoiceDate || '', 12) +
                pad(money(r.costTotal), 11) +
                (r.flags.length ? '[' + r.flags.join(' ') + ']' : ''));
    if (r.suspect) {
      if (r.siblingsPlanning.length) {
        console.log('          ↳ not planned on ' + r.crop + '; planned on ' + r.siblingsPlanning.join(', '));
      }
      if (r.commentContradicts) {
        console.log('          ↳ invoice comments say "' + r.comments + '" (reads as ' +
                    r.commentCrops.join(', ') + ')');
      }
    }
  });
  console.log('');
});

if (RECON) {
  console.log('');
  console.log('Single-enterprise parcels where the invoice names a different crop');
  console.log('(the guard does not cover these — there is no sibling to choose;');
  console.log(' the enterprise the pass belongs to does not exist yet)');
  console.log('');
  if (!orphans.length) console.log('  none');
  orphans.forEach(function (o) {
    console.log('  !! ' + pad(o.fieldName, 24) + pad('book says ' + o.crop, 26) +
                pad('#' + o.invoiceNumber, 11) + pad(money(o.costTotal), 11));
    console.log('        ↳ ' + o.product + ' · comments "' + o.comments + '"');
  });
  console.log('');
}

console.log('Nothing was modified. ' + suspect.length + ' flagged row(s), ' +
            orphans.length + ' orphaned row(s).');
console.log('');
