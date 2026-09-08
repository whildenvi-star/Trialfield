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

// DeLong prints Field ID and Farm ID as a joined pair, and they are usually the
// same string ("PhilEast Philhower East PhilEast Philhower East"). Dedupe the
// whole token set, not just adjacent runs — leaving the repeat in place inflates
// the token count and drags every score down by half.
function dedupeTokens(s) {
  const seen = [];
  const has = {};
  normalize(s).split(' ').forEach(function (t) {
    if (!t || has[t]) return;
    has[t] = true;
    seen.push(t);
  });
  return seen.join(' ');
}

// Levenshtein distance, iterative with a single row. Only ever run on short
// name tokens, so the O(n*m) cost is irrelevant.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// How alike two name tokens are, 0..1. Farm paperwork misspells names — the
// invoice says "Philhower", our register says "Phillhower" — and a strict
// equality test scores that pair zero, which is how the right field stopped
// being offered at all. Below 0.72 the pair is treated as unrelated, so this
// tolerates a slip without inventing matches between genuinely different names.
function tokenSim(a, b) {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  const sim = 1 - levenshtein(a, b) / max;
  return sim >= 0.72 ? sim : 0;
}

// Token-overlap score in 0..1, each token credited by its best fuzzy partner.
// A shared leading token counts extra — farm and product names lead with the
// distinguishing word.
function tokenScore(a, b) {
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  if (!at.length || !bt.length) return 0;
  let credit = 0;
  at.forEach(function (t) {
    let best = 0;
    bt.forEach(function (u) { const s = tokenSim(t, u); if (s > best) best = s; });
    credit += best;
  });
  const overlap = credit / Math.max(at.length, bt.length);
  const leadBonus = tokenSim(at[0], bt[0]) >= 0.72 ? 0.15 : 0;
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
// The invoice names a field in the vendor's words. Three signals, in order of
// how much they can be trusted: the name, the crop named in the Comments line,
// and acres.
//
// The crop matters more than it looks. A split field appears once per crop
// under ONE parcel name with identical acreage — "phillhower east" is both Peas
// and Snap Beans at 135.2 ac — so name and acres together cannot separate them.
// The Comments line ("Post Snap Beans With Basagran") is the only thing on the
// page that can, and reading it is the difference between confirming the right
// pass and inventing new lines on the wrong crop.
function cropSignal(invoice) {
  return normalize(
    (invoice.comments || '') + ' ' + (invoice.fieldLabel || '') + ' ' + (invoice.farmLabel || '')
  );
}

// Does the invoice's comment name this field's crop? Compared token-wise and
// fuzzily so "Snap Beans" finds "snap beans" and "Soybeans" does not.
function cropMentioned(signal, crop) {
  const ct = normalize(crop).split(' ').filter(Boolean);
  if (!ct.length) return false;
  const st = signal.split(' ').filter(Boolean);
  if (!st.length) return false;
  let hit = 0;
  ct.forEach(function (t) {
    if (t.length < 3) { hit++; return; } // ignore noise words like "rr"
    if (st.some(function (u) { return tokenSim(t, u) >= 0.85; })) hit++;
  });
  return hit === ct.length;
}

function matchFields(fields, invoice) {
  const label = (invoice.fieldLabel || '') + ' ' + (invoice.farmLabel || '');
  const query = dedupeTokens(label);
  if (!query) return [];
  const cands = rank(fields, function (f) { return f.name; }, query, 0.3);

  const signal = cropSignal(invoice);
  const invAcres = Number(invoice.acres);

  cands.forEach(function (c) {
    const acres = (c.item.plantedAcres > 0 ? c.item.plantedAcres : c.item.acres) || 0;
    c.acres = acres;
    c.crop = c.item.crop || null;

    if (cropMentioned(signal, c.item.crop)) {
      c.score = Math.min(1, c.score + 0.3);
      c.why += ', invoice names ' + c.item.crop;
    }

    // Acres stays a tiebreaker, never a veto. On this paperwork it is often
    // the sprayed area rather than the parcel or the planted acreage — 108 ac
    // treated on a 135.2 ac field with 91.7 ac of the crop — so a large
    // penalty here would sink a field the name and crop both agree on.
    if (invAcres > 0 && acres > 0) {
      const drift = Math.abs(acres - invAcres) / invAcres;
      if (drift <= 0.01) { c.score = Math.min(1, c.score + 0.2); c.why += ', acres match'; }
      else if (drift <= 0.1) { c.score = Math.min(1, c.score + 0.05); c.why += ', acres close'; }
      else { c.score = Math.max(0, c.score - 0.08); c.why += ', acres differ (' + acres + ' vs ' + invAcres + ')'; }
    }
    c.score = Math.round(c.score * 100) / 100;
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

  // Where else this invoice number already appears. A DeLong invoice covering
  // two fields is a real pattern (#8003075 does), so this is a note, not a
  // block — but landing the same invoice on the wrong field twice is exactly
  // the double entry we're trying to prevent, so it has to be visible.
  const elsewhere = [];
  if (invoice.invoiceNumber) {
    fields.forEach(function (f) {
      if (field && f.id === field.id) return;
      const hit = (f.inputs || []).some(function (i) {
        return i.invoiceNumber && String(i.invoiceNumber) === String(invoice.invoiceNumber);
      });
      if (hit) elsewhere.push(f.name);
    });
  }

  // Each line claims its OWN planned row. 91 of our fields carry the same
  // product on two input lines (two passes), and an invoice can bill the same
  // product twice — without this, both lines grab the first open row and one
  // silently overwrites the other.
  const claimed = {};

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

    // Already on file? Prefer an exact line-level match — a row written by this
    // pipeline records which invoice line it came from, so an invoice that
    // bills the same product twice maps to two rows, not one. Rows entered by
    // hand before this existed have no line index, so fall back to the invoice
    // number alone.
    const sameLine = hits.find(function (h) {
      return h.inp.invoiceNumber && String(h.inp.invoiceNumber) === String(invoice.invoiceNumber) &&
        h.inp.invoiceLineIndex === i;
    });
    const sameInvoiceLegacy = hits.find(function (h) {
      return h.inp.invoiceNumber && String(h.inp.invoiceNumber) === String(invoice.invoiceNumber) &&
        h.inp.invoiceLineIndex == null && !claimed[h.inp.id];
    });
    const sameInvoice = sameLine || sameInvoiceLegacy;
    if (sameInvoice) {
      claimed[sameInvoice.inp.id] = true;
      row.status = ALREADY;
      row.inputId = sameInvoice.inp.id;
      row.plannedRate = sameInvoice.inp.quantity;
      row.actualRate = sameInvoice.inp.actualQuantity;
      row.note = 'Already confirmed from invoice ' + invoice.invoiceNumber + '.';
      return row;
    }

    const open = hits.filter(function (h) {
      return h.inp.passStatus !== 'confirmed' && !claimed[h.inp.id];
    });
    const target = open.length ? open[0] : null;

    if (!target) {
      const unclaimed = hits.filter(function (h) { return !claimed[h.inp.id]; });
      if (unclaimed.length) {
        claimed[unclaimed[0].inp.id] = true;
        row.status = CONFLICT;
        row.inputId = unclaimed[0].inp.id;
        row.note = 'Row already confirmed under invoice ' +
          (unclaimed[0].inp.invoiceNumber || '(none)') + ' — resolve by hand.';
        return row;
      }
      row.status = NEW_LINE;
      row.note = hits.length
        ? 'This invoice bills ' + product.name + ' more than once and every planned row on ' +
          field.name + ' is spoken for; applying adds another line.'
        : 'No planned line for this product on ' + field.name + '; applying adds one.';
      return row;
    }

    claimed[target.inp.id] = true;
    row.status = READY;
    row.inputId = target.inp.id;
    row.plannedRate = target.inp.quantity;
    row.plannedUnit = product.unit || null;

    // The planned figure is a rate in the APPLICATION unit (Basagran is
    // 19.85 OZ/ac); the invoice bills in the PURCHASE unit (27 Gal). Comparing
    // them raw reported a delta of -2116.8 on a line that was really 16.75 Gal
    // planned against 27 billed. Convert the plan into whatever unit the
    // invoice used before subtracting — the mirror of Calc.invoiceRatePerAcre,
    // which multiplies by conversionRate going the other way.
    const appUnit = product.unit || '';
    const invUnit = line.unit || product.purchaseUnit || '';
    const conv = Number(product.conversionRate) || 1;
    const sameUnit = normalize(invUnit) === normalize(appUnit);

    if (acres > 0 && target.inp.quantity != null) {
      const plannedApp = Number(target.inp.quantity) * acres;
      row.plannedQtyTotal = Calc.round4(sameUnit ? plannedApp : plannedApp / conv);
      row.plannedQtyUnit = invUnit || null;
    } else {
      row.plannedQtyTotal = null;
      row.plannedQtyUnit = null;
    }

    row.actualRate = Calc.invoiceRatePerAcre(product, line.quantity, acres, line.unit);
    if (row.plannedQtyTotal != null && line.quantity != null) {
      row.qtyDelta = Calc.round4(Number(line.quantity) - row.plannedQtyTotal);
      if (row.plannedQtyTotal > 0) {
        row.qtyDeltaPct = Calc.round4(row.qtyDelta / row.plannedQtyTotal);
      }
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
    alsoOnFields: elsewhere,
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
      acres: c.acres != null ? c.acres : undefined,
      crop: c.crop != null ? c.crop : undefined
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
