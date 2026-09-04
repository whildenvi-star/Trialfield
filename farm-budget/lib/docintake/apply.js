'use strict';

// Document intake — apply layer.
//
// Writes the operator-approved rows onto the field's input lines. The write
// semantics are deliberately identical to the confirm popover in
// public/field-strips.js — this is a faster way to reach the same state, not a
// second way of recording a pass.

const Calc = require('../../public/calc.js');

function findField(data, fieldId) {
  return (data.fields || []).find(function (f) { return f.id === fieldId; }) || null;
}

function findProduct(data, productId) {
  return (data.products || []).find(function (p) { return p.id === productId; }) || null;
}

function newInputId() {
  return 'inp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

// decision: { fieldId, productId, inputId|null, invoiceQty, invoiceUnit,
//             lineTotal, description }
// header:   { invoiceNumber, invoiceVendor, invoiceDate, acres, confirmedBy }
//
// Returns { ok, action, inputId, reason }.
function applyRow(data, header, decision) {
  const field = findField(data, decision.fieldId);
  if (!field) return { ok: false, reason: 'Field ' + decision.fieldId + ' not found' };

  const product = findProduct(data, decision.productId);
  if (!product) return { ok: false, reason: 'Product ' + decision.productId + ' not found' };

  const acres = Number(header.acres) > 0
    ? Number(header.acres)
    : ((field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0);

  field.inputs = field.inputs || [];
  let item = decision.inputId
    ? field.inputs.find(function (i) { return i.id === decision.inputId; })
    : null;

  let action = 'confirmed';
  if (!item) {
    // Re-entry guard. Before adding a line, look for one this same invoice
    // LINE already produced. Keying on (invoiceNumber, lineIndex) rather than
    // the invoice number alone is deliberate: an invoice that bills the same
    // product twice must still produce two rows, but applying the same line a
    // second time must not.
    if (header.invoiceNumber != null && decision.lineIndex != null) {
      item = field.inputs.find(function (i) {
        return i.invoiceNumber && String(i.invoiceNumber) === String(header.invoiceNumber) &&
          i.invoiceLineIndex === decision.lineIndex;
      }) || null;
    }
  }

  if (!item) {
    // No planned line for this product on this field — the invoice is evidence
    // the pass happened anyway, so record it rather than lose it.
    item = {
      id: newInputId(),
      productName: product.name,
      quantity: 0,
      season: null
    };
    field.inputs.push(item);
    action = 'added';
  }

  const purchaseUnit = product.purchaseUnit || product.unit || '';
  const qty = decision.invoiceQty != null ? Number(decision.invoiceQty) : null;
  const cost = decision.lineTotal != null ? Number(decision.lineTotal) : null;

  item.passStatus = 'confirmed';
  item.confirmedDate = header.invoiceDate || null;
  item.confirmedBy = header.confirmedBy || item.confirmedBy || null;
  item.invoiceNumber = header.invoiceNumber || null;
  item.invoiceVendor = header.invoiceVendor || null;
  item.invoiceDate = header.invoiceDate || null;
  item.invoiceAcres = acres || null;
  // Round before writing: derived floats have to compare equal on the next
  // sync pass or the cert bridge rewrites rows that never changed.
  item.invoiceQtyTotal = qty != null ? Calc.round4(qty) : null;
  item.invoiceCostTotal = cost != null ? Calc.round2(cost) : null;
  item.invoiceUnit = decision.invoiceUnit || purchaseUnit;
  // Which line of which invoice this row came from — the key that makes a
  // repeat apply idempotent without collapsing two genuine same-product lines.
  if (decision.lineIndex != null) item.invoiceLineIndex = decision.lineIndex;

  const rate = Calc.invoiceRatePerAcre(product, qty, acres, decision.invoiceUnit || purchaseUnit);
  item.actualQuantity = rate != null ? rate : (item.quantity || 0);

  return { ok: true, action: action, inputId: item.id, fieldName: field.name, productName: product.name };
}

// Apply a whole reviewed invoice. Rows the operator did not tick are skipped,
// and nothing is written unless every ticked row resolves — a half-applied
// invoice is harder to clean up than one that refused.
function applyInvoice(data, header, decisions) {
  const errors = [];
  decisions.forEach(function (d, i) {
    if (!findField(data, d.fieldId)) errors.push('row ' + (i + 1) + ': unknown field');
    else if (!findProduct(data, d.productId)) errors.push('row ' + (i + 1) + ': unknown product');
  });
  if (errors.length) return { ok: false, errors: errors, results: [] };

  // Two ticked rows must never resolve onto the same planned line — that would
  // write one over the other and lose a line without saying so.
  const seenInput = {};
  for (let i = 0; i < decisions.length; i++) {
    const id = decisions[i].inputId;
    if (!id) continue;
    if (seenInput[id]) {
      return {
        ok: false,
        errors: ['rows ' + seenInput[id] + ' and ' + (i + 1) + ' both target the same planned line — ' +
                 'point one of them at a different line, or leave it to be added'],
        results: []
      };
    }
    seenInput[id] = i + 1;
  }

  const results = decisions.map(function (d) { return applyRow(data, header, d); });
  return {
    ok: true,
    errors: [],
    results: results,
    confirmed: results.filter(function (r) { return r.action === 'confirmed'; }).length,
    added: results.filter(function (r) { return r.action === 'added'; }).length
  };
}

module.exports = { applyInvoice, applyRow };
