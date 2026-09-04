'use strict';

// Document intake — matching layer.
//
// Pure functions: takes the transcribed document plus the live data.json
// reference lists, and proposes what to write. Nothing here mutates data and
// nothing here decides on the operator's behalf — every row comes back with a
// status and a ranked candidate list so the review grid can show its work.

const Calc = require('../../public/calc.js');

// ── text normalising ────────────────────────────────────────────
// Invoice text and our product list disagree in predictable ways:
//   "Ester 2,4-D LV6 (265 Gal)"  vs  "Ester 2,4-D LV (2x2.5 Gal)"
//   "Veracity Elite II (2x2.5 Gal)" vs "Veracity Elite II"
// Pack size is a purchase detail, not part of the product's identity, so the
// core comparison happens with the parentheticals stripped.
function normalize(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[*†]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripPack(s) {
  return String(s == null ? '' : s).replace(/\([^)]*\)/g, ' ');
}

function coreName(s) {
  return normalize(stripPack(s));
}

// "Bakke Bakke" — DeLong prints Field ID and Farm ID as a joined pair and often
// repeats the same word. Collapse runs of the identical token.
function dedupeTokens(s) {
  const seen = [];
  normalize(s).split(' ').forEach(function (t) {
    if (t && seen[seen.length - 1] !== t) seen.push(t);
  });
  return seen.join(' ');
}

// Token-overlap score in 0..1, weighted so a shared leading token counts most —
// farm and product names lead with the distinguishing word.
function tokenScore(a, b) {
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  if (!at.length || !bt.length) return 0;
  const bSet = new Set(bt);
  let hit = 0;
  at.forEach(function (t) { if (bSet.has(t)) hit++; });
  const overlap = hit / Math.max(at.length, bt.length);
  const leadBonus = at[0] === bt[0] ? 0.15 : 0;
  return Math.min(1, overlap + leadBonus);
}

// Ranked candidates over a list, using a label accessor. Returns
// [{ item, score, why }] sorted best-first, only above `floor`.
function rank(list, label, query, floor) {
  const qCore = coreName(query);
  const qFull = normalize(query);
  const out = [];
  list.forEach(function (item) {
    const raw = label(item);
    if (!raw) return;
    const cCore = coreName(raw);
    const cFull = normalize(raw);
    let score = 0;
    let why = '';
    if (cFull === qFull) { score = 1; why = 'exact'; }
    else if (cCore === qCore) { score = 0.95; why = 'exact ignoring pack size'; }
    else if (cCore && qCore && (cCore.indexOf(qCore) === 0 || qCore.indexOf(cCore) === 0)) {
      score = 0.85; why = 'name prefix';
    } else {
      score = tokenScore(qCore, cCore) * 0.8;
      why = 'partial word match';
    }
    if (score >= (floor == null ? 0.34 : floor)) out.push({ item: item, score: Math.round(score * 100) / 100, why: why });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out.slice(0, 5);
}

// ── field matching ──────────────────────────────────────────────
// The invoice names a field in the vendor's words; acres is the tiebreaker,
// which is what actually separates split fields sharing a parcel name.
function matchFields(fields, invoice) {
  const label = (invoice.fieldLabel || '') + ' ' + (invoice.farmLabel || '');
  const query = dedupeTokens(label);
  if (!query) return [];
  const cands = rank(fields, function (f) { return f.name; }, query, 0.3);

  const invAcres = Number(invoice.acres);
  cands.forEach(function (c) {
    const acres = (c.item.plantedAcres > 0 ? c.item.plantedAcres : c.item.acres) || 0;
    c.acres = acres;
    if (invAcres > 0 && acres > 0) {
      const drift = Math.abs(acres - invAcres) / invAcres;
      if (drift <= 0.01) { c.score = Math.min(1, c.score + 0.2); c.why += ', acres match'; }
      else if (drift <= 0.1) { c.score = Math.min(1, c.score + 0.05); c.why += ', acres close'; }
      else { c.score = Math.max(0, c.score - 0.15); c.why += ', acres differ (' + acres + ' vs ' + invAcres + ')'; }
      c.score = Math.round(c.score * 100) / 100;
    }
  });
  cands.sort(function (a, b) { return b.score - a.score; });
  return cands;
}

function matchProducts(products, description) {
  return rank(products, function (p) { return p.name; }, description, 0.34);
}

// ── invoice → proposal ──────────────────────────────────────────
// One row per invoice line. `status` drives the review grid:
//   ready          — a planned input row is waiting; confirming it is the write
//   new-line       — product is known but this field has no planned row for it
//   unknown-product— the description matches nothing in the product list
//   already-applied— this exact invoice is already on that row (idempotent re-run)
//   conflict       — the row carries a DIFFERENT invoice number
const READY = 'ready';
const NEW_LINE = 'new-line';
const UNKNOWN_PRODUCT = 'unknown-product';
const ALREADY = 'already-applied';
const CONFLICT = 'conflict';

function proposeInvoice(invoice, refs) {
  const fields = refs.fields || [];
  const products = refs.products || [];

  const fieldCands = matchFields(fields, invoice);
  const field = fieldCands.length && fieldCands[0].score >= 0.6 ? fieldCands[0].item : null;
  const acres = invoice.acres != null
    ? Number(invoice.acres)
    : (field ? ((field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0) : 0);

  const rows = (invoice.lines || []).map(function (line, i) {
    const prodCands = matchProducts(products, line.description);
    const product = prodCands.length && prodCands[0].score >= 0.6 ? prodCands[0].item : null;

    const row = {
      lineIndex: i,
      description: line.description,
      invoiceQty: line.quantity,
      invoiceUnit: line.unit,
      unitPrice: line.unitPrice,
      lineTotal: line.total,
      paid: !!line.paid,
      productCandidates: prodCands.map(toCand('name')),
      productId: product ? product.id : null,
      productName: product ? product.name : null,
      inputId: null,
      plannedRate: null,
      plannedQtyTotal: null,
      actualRate: null,
      qtyDelta: null,
      status: UNKNOWN_PRODUCT,
      note: null
    };

    if (!product) {
      row.note = 'No product in the reference list matches this description.';
      return row;
    }
    if (!field) {
      row.status = NEW_LINE;
      row.note = 'Field not matched — pick one above before applying.';
      return row;
    }

    // Find the planned input row for this product on this field. A field can
    // carry the same product twice (two passes); prefer an unconfirmed row, and
    // among those the one whose season matches the invoice date.
    const inputs = field.inputs || [];
    const hits = inputs
      .map(function (inp, idx) { return { inp: inp, idx: idx }; })
      .filter(function (h) { return coreName(h.inp.productName) === coreName(product.name); });

    const sameInvoice = hits.find(function (h) {
      return h.inp.invoiceNumber && String(h.inp.invoiceNumber) === String(invoice.invoiceNumber);
    });
    if (sameInvoice) {
      row.status = ALREADY;
      row.inputId = sameInvoice.inp.id;
      row.plannedRate = sameInvoice.inp.quantity;
      row.actualRate = sameInvoice.inp.actualQuantity;
      row.note = 'Already confirmed from invoice ' + invoice.invoiceNumber + '.';
      return row;
    }

    const open = hits.filter(function (h) { return h.inp.passStatus !== 'confirmed'; });
    const target = open.length ? open[0] : null;

    if (!target) {
      if (hits.length) {
        row.status = CONFLICT;
        row.inputId = hits[0].inp.id;
        row.note = 'Row already confirmed under invoice ' +
          (hits[0].inp.invoiceNumber || '(none)') + ' — resolve by hand.';
        return row;
      }
      row.status = NEW_LINE;
      row.note = 'No planned line for this product on ' + field.name + '; applying adds one.';
      return row;
    }

    row.status = READY;
    row.inputId = target.inp.id;
    row.plannedRate = target.inp.quantity;
    row.plannedQtyTotal = acres > 0 && target.inp.quantity != null
      ? Calc.round4(Number(target.inp.quantity) * acres)
      : null;
    row.actualRate = Calc.invoiceRatePerAcre(product, line.quantity, acres, line.unit);
    if (row.plannedQtyTotal != null && line.quantity != null) {
      row.qtyDelta = Calc.round4(Number(line.quantity) - row.plannedQtyTotal);
    }
    return row;
  });

  // The invoice's own arithmetic is the first check that the transcription is
  // sound — if the lines don't add to the printed subtotal, something was misread.
  const lineSum = rows.reduce(function (s, r) { return s + (Number(r.lineTotal) || 0); }, 0);
  const subTotal = Number(invoice.subTotal);
  const totalsOk = !(subTotal > 0) || Math.abs(lineSum - subTotal) <= 0.02;

  return {
    invoiceNumber: invoice.invoiceNumber,
    vendor: invoice.vendor,
    invoiceDate: invoice.invoiceDate,
    comments: invoice.comments,
    acres: acres,
    subTotal: invoice.subTotal,
    prepayUsed: invoice.prepayUsed,
    amountDue: invoice.amountDue,
    confidence: invoice.confidence || 'medium',
    fieldId: field ? field.id : null,
    fieldName: field ? field.name : null,
    fieldCandidates: fieldCands.map(toCand('name')),
    totalsOk: totalsOk,
    lineSum: Calc.round2(lineSum),
    rows: rows
  };
}

function toCand(labelKey) {
  return function (c) {
    return {
      id: c.item.id,
      label: c.item[labelKey],
      score: c.score,
      why: c.why,
      acres: c.acres != null ? c.acres : undefined
    };
  };
}

module.exports = {
  normalize: normalize,
  coreName: coreName,
  dedupeTokens: dedupeTokens,
  matchFields: matchFields,
  matchProducts: matchProducts,
  proposeInvoice: proposeInvoice,
  STATUS: { READY: READY, NEW_LINE: NEW_LINE, UNKNOWN_PRODUCT: UNKNOWN_PRODUCT, ALREADY: ALREADY, CONFLICT: CONFLICT }
};
