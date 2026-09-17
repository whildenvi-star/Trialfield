/* Document intake — upload a DeLong invoice or contract, review what the
 * server read off it, and apply it.
 *
 * Layout is a sheet, not a wizard: the scan's numbers, our planned numbers, and
 * the delta between them all sit on one row so a mis-read is visible without
 * clicking anything. Same reasoning as the "Sheet" strips view.
 */
(function () {
  'use strict';

  var state = {
    doc: null,          // the server's record for the current upload
    contractDiff: null, // last contracts diff result
    busy: false
  };

  // Full field list, fetched lazily — only needed when the operator rejects
  // every candidate the matcher offered.
  var allFields = null;
  function fields() { return allFields || []; }

  var esc = function (s) { return util.escHtml(s); };
  var n2 = function (v) { return v == null || isNaN(v) ? '' : util.formatNum(v, 2); };
  var n3 = function (v) { return v == null || isNaN(v) ? '' : util.formatNum(v, 3); };
  var money = function (v) { return v == null || isNaN(v) ? '' : util.formatMoney(v); };

  // One colour rule across invoices and contracts:
  //   teal  — will write, cleanly
  //   amber — will write, but creates something new; look before ticking
  //   red   — will NOT write; needs a decision from you
  //   grey  — no-op, already on file
  var STATUS_LABEL = {
    'ready': 'Ready',
    'new-line': 'Adds line',
    'unknown-product': 'No product',
    'already-applied': 'Already on file',
    'conflict': 'Conflict',
    'ambiguous-enterprise': 'Which crop?',
    'crop-mismatch': 'Wrong crop?'
  };

  var LEGEND = [
    ['go', 'Ready / new', 'will be written as it stands'],
    ['add', 'Adds a line', 'will be written, and creates a row that was not planned'],
    ['stop', 'Needs you', 'will not be written until you resolve it'],
    ['done', 'Already on file', 'no change — locked so it cannot be entered twice']
  ];

  function legendHtml() {
    return '<div class="di-legend">' + LEGEND.map(function (l) {
      return '<span class="di-legend-item"><span class="di-swatch di-tone-' + l[0] + '"></span>' +
        '<strong>' + esc(l[1]) + '</strong> ' + esc(l[2]) + '</span>';
    }).join('') + '</div>';
  }

  // Which of the four tones a status carries.
  var TONE = {
    'ready': 'go', 'new': 'go',
    'new-line': 'add',
    'unknown-product': 'stop', 'conflict': 'stop', 'differs': 'stop', 'blocked': 'stop',
    'ambiguous-enterprise': 'stop', 'crop-mismatch': 'stop',
    'already-applied': 'done', 'in-sync': 'done', 'not checked': 'done',
    // We already hold this contract, split into amendments — nothing to write,
    // and creating would duplicate it. Grey, with the pieces listed.
    'amended': 'done'
  };
  function tone(status) { return TONE[status] || 'done'; }

  function root() { return document.getElementById('doc-intake-root'); }

  // ── upload ──────────────────────────────────────────────────────
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('Could not read the file')); };
      fr.onload = function () {
        // data:<mime>;base64,<payload>
        var s = String(fr.result);
        var comma = s.indexOf(',');
        resolve({ mediaType: (s.slice(5, s.indexOf(';'))), base64: s.slice(comma + 1) });
      };
      fr.readAsDataURL(file);
    });
  }

  function upload(file) {
    if (state.busy) return;
    state.busy = true;
    render();
    readFile(file).then(function (payload) {
      return api.post('/api/documents', {
        filename: file.name,
        mediaType: payload.mediaType || file.type,
        base64: payload.base64
      });
    }).then(function (doc) {
      state.doc = doc;
      state.contractDiff = null;
      state.busy = false;
      render();
      if (doc.reused) util.showToast('Already read this scan — showing the saved reading', 3500, 'info');
      else if (doc.unreadable) util.showToast('Scan quality is poor — check every number', 6000, 'error');
      loadLedger();
    }).catch(function (e) {
      state.busy = false;
      render();
      util.showToast(e.message || 'Upload failed', 6000, 'error');
    });
  }

  // ── invoice sheet ───────────────────────────────────────────────
  function invoiceHeaderHtml(p, pi) {
    var flags = [];
    if (!p.totalsOk) {
      flags.push('<span class="di-flag di-flag-bad">Lines total ' + money(p.lineSum) +
        ', invoice says ' + money(p.subTotal) + ' — something was mis-read</span>');
    }
    if (p.confidence === 'low') flags.push('<span class="di-flag di-flag-warn">Low-confidence scan</span>');
    if (p.ambiguousEnterprise) {
      flags.push('<span class="di-flag di-flag-bad">Which crop? ' + esc(p.enterpriseReason || '') +
        '</span>');
    } else if (!p.fieldId) {
      flags.push('<span class="di-flag di-flag-bad">Field not matched</span>');
    }
    if ((p.alsoOnFields || []).length) {
      flags.push('<span class="di-flag di-flag-warn">Invoice ' + esc(p.invoiceNumber || '') +
        ' is already on ' + esc(p.alsoOnFields.join(', ')) +
        ' — fine if it covered several fields, a double entry if it did not</span>');
    }

    var fieldSel = '<select class="di-field" data-pi="' + pi + '">' +
      '<option value="">— pick a field —</option>' +
      (p.fieldCandidates || []).map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === p.fieldId ? ' selected' : '') + '>' +
          esc(c.label) + (c.crop ? ' · ' + esc(c.crop) : '') +
          ' (' + Math.round(c.score * 100) + '% · ' + esc(c.why) +
          (c.plansBilled ? ' · plans ' + esc(c.plansBilled.slice(0, 2).join(', ')) : '') +
          ')</option>';
      }).join('') +
      '<option value="__all">— show all fields —</option>' +
      '</select>';

    return '<div class="di-head">' +
      '<div class="di-head-grid">' +
        kv('Vendor', esc(p.vendor || '—')) +
        kv('Invoice #', '<strong>' + esc(p.invoiceNumber || '—') + '</strong>') +
        kv('Date', esc(p.invoiceDate || '—')) +
        kv('Comments', esc(p.comments || '—')) +
        kv('Field', fieldSel) +
        kv('Acres', n2(p.acres)) +
        kv('Sub total', money(p.subTotal)) +
        kv('Prepay used', money(p.prepayUsed)) +
        kv('Amount due', '<strong>' + money(p.amountDue) + '</strong>') +
      '</div>' +
      (flags.length ? '<div class="di-flags">' + flags.join('') + '</div>' : '') +
    '</div>';
  }

  function kv(k, v) {
    return '<div class="di-kv"><span class="di-k">' + esc(k) + '</span><span class="di-v">' + v + '</span></div>';
  }

  function invoiceRowsHtml(p, pi) {
    var head = '<thead><tr>' +
      '<th class="di-tick"></th>' +
      '<th>On the invoice</th>' +
      '<th>Our product</th>' +
      '<th class="di-num">Inv qty</th>' +
      '<th>Unit</th>' +
      '<th class="di-num">Planned rate</th>' +
      '<th class="di-num">Planned total</th>' +
      '<th class="di-num">Δ</th>' +
      '<th class="di-num">Unit $</th>' +
      '<th class="di-num">Line $</th>' +
      '<th>Status</th>' +
      '</tr></thead>';

    var body = (p.rows || []).map(function (r) {
      // An ambiguous line becomes applicable the moment the operator names the
      // enterprise — picking one re-matches the invoice server-side, so by the
      // time p.fieldId is set the row has been rebuilt against that crop and
      // carries a real status. Until then p.fieldId is null and every tick here
      // stays disabled, which is the guard.
      var applicable = r.status === 'ready' || r.status === 'new-line' ||
        r.status === 'ambiguous-enterprise';
      var tick = '<input type="checkbox" class="di-row-tick" data-pi="' + pi + '" data-ri="' + r.lineIndex + '"' +
        (applicable && p.fieldId ? ' checked' : ' disabled') + '>';

      var prodSel = '<select class="di-prod" data-pi="' + pi + '" data-ri="' + r.lineIndex + '">' +
        '<option value="">— none —</option>' +
        (r.productCandidates || []).map(function (c) {
          return '<option value="' + esc(c.id) + '"' + (c.id === r.productId ? ' selected' : '') + '>' +
            esc(c.label) + ' (' + Math.round(c.score * 100) + '%)</option>';
        }).join('') + '</select>';

      // Planned is a rate in the application unit; the invoice bills in the
      // purchase unit. match.js converts before subtracting, so both columns
      // are in the invoice's unit — label them or the numbers invite a misread.
      var deltaCell = '';
      if (r.qtyDelta != null && Math.abs(r.qtyDelta) > 0.0001) {
        var pct = r.qtyDeltaPct != null ? Math.abs(r.qtyDeltaPct)
          : (r.plannedQtyTotal ? Math.abs(r.qtyDelta / r.plannedQtyTotal) : 1);
        deltaCell = '<span class="' + (pct > 0.1 ? 'di-delta-big' : 'di-delta') + '">' +
          (r.qtyDelta > 0 ? '+' : '') + n3(r.qtyDelta) +
          (r.qtyDeltaPct != null ? ' <small>(' + (r.qtyDeltaPct > 0 ? '+' : '') +
            Math.round(r.qtyDeltaPct * 100) + '%)</small>' : '') +
          '</span>';
      }
      var plannedCell = r.plannedQtyTotal == null ? ''
        : n3(r.plannedQtyTotal) + (r.plannedQtyUnit ? ' <small>' + esc(r.plannedQtyUnit) + '</small>' : '');
      var rateCell = r.plannedRate == null ? ''
        : n3(r.plannedRate) + (r.plannedUnit ? ' <small>' + esc(r.plannedUnit) + '/ac</small>' : '') +
          (r.actualRate != null ? '<br><span class="di-delta">as applied ' + n3(r.actualRate) + '</span>' : '');

      return '<tr class="di-row di-tone-row-' + tone(r.status) + '">' +
        '<td class="di-tick">' + tick + '</td>' +
        '<td class="di-desc">' + esc(r.description) + '</td>' +
        '<td>' + prodSel + '</td>' +
        '<td class="di-num">' + n3(r.invoiceQty) + '</td>' +
        '<td>' + esc(r.invoiceUnit || '') + '</td>' +
        '<td class="di-num di-muted">' + rateCell + '</td>' +
        '<td class="di-num di-muted">' + plannedCell + '</td>' +
        '<td class="di-num">' + deltaCell + '</td>' +
        '<td class="di-num di-muted">' + money(r.unitPrice) + '</td>' +
        '<td class="di-num">' + money(r.lineTotal) + '</td>' +
        '<td class="di-status"><span class="di-badge di-tone-' + tone(r.status) + '">' +
          esc(STATUS_LABEL[r.status] || r.status) + '</span>' +
          (r.note ? '<div class="di-note">' + esc(r.note) + '</div>' : '') +
        '</td>' +
      '</tr>';
    }).join('');

    return legendHtml() + '<table class="di-table">' + head + '<tbody>' + body + '</tbody></table>';
  }

  // ── contract sheet ──────────────────────────────────────────────
  function contractsHtml(doc) {
    var contracts = (doc.extracted && doc.extracted.contracts) || [];
    if (!contracts.length) return '';

    var diffByNumber = {};
    ((state.contractDiff && state.contractDiff.results) || []).forEach(function (r) {
      if (r.contractNumber) diffByNumber[r.contractNumber] = r;
    });

    var rows = contracts.map(function (c) {
      var d = diffByNumber[c.contractNumber || ''] || null;
      var status = d ? d.status : 'not checked';
      var detail = '';
      if (d && d.diffs && d.diffs.length) {
        detail = '<div class="di-note">' + d.diffs.map(function (x) {
          return esc(x.field) + ': ours ' + esc(String(x.ours)) + ' · paper ' + esc(String(x.paper));
        }).join('<br>') + '</div>';
      } else if (d && d.blockers && d.blockers.length) {
        detail = '<div class="di-note">' + d.blockers.map(esc).join('<br>') + '</div>';
      }
      if (d && (d.amendments || []).length) {
        detail += '<div class="di-note">already on the book as ' + d.amendments.map(function (a) {
          return esc(a.number) + ' (' + n2(a.contractedBushels) + ' bu)';
        }).join(' + ') + ' — creating would duplicate it</div>';
      }
      return '<tr class="di-row di-tone-row-' + tone(status) + '">' +
        '<td><strong>' + esc(c.contractNumber || '—') + '</strong></td>' +
        '<td>' + esc(c.commodity || '—') + '</td>' +
        '<td class="di-num">' + n2(c.quantity) + ' ' + esc(c.quantityUnit || '') + '</td>' +
        '<td>' + esc(c.instrument || '—') + '</td>' +
        '<td class="di-num">' + n2(c.futuresPrice) + '</td>' +
        '<td>' + esc(c.futuresMonth || '') + '</td>' +
        '<td class="di-num">' + (c.basis == null ? '<span class="di-muted">open</span>' : n2(c.basis)) + '</td>' +
        '<td class="di-num">' + n2(c.cashPrice) + '</td>' +
        '<td>' + esc(c.destination || '') + '</td>' +
        '<td class="di-status"><span class="di-badge di-tone-' + tone(status) + '">' +
          esc(status) + '</span>' + detail + '</td>' +
      '</tr>';
    }).join('');

    var newCount = ((state.contractDiff && state.contractDiff.results) || [])
      .filter(function (r) { return r.status === 'new'; }).length;

    return '<section class="di-section">' +
      '<h3 class="di-h">Contracts on this document</h3>' +
      '<p class="di-sub">Checked against the marketing book. Contracts already on file are never ' +
      'overwritten here — a difference is a finding to act on, not something to auto-apply.</p>' +
      legendHtml() +
      '<div class="di-scroll"><table class="di-table"><thead><tr>' +
        '<th>Contract #</th><th>Commodity</th><th class="di-num">Quantity</th><th>Instrument</th>' +
        '<th class="di-num">Futures</th><th>Month</th><th class="di-num">Basis</th>' +
        '<th class="di-num">Cash</th><th>Destination</th><th>Against our book</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="di-actions">' +
        '<button class="btn btn-secondary" id="di-contract-diff">Check against the book</button>' +
        '<button class="btn btn-primary" id="di-contract-create"' +
          (newCount ? '' : ' disabled') + '>Create ' + newCount + ' new contract' +
          (newCount === 1 ? '' : 's') + '</button>' +
      '</div>' +
    '</section>';
  }

  // ── render ──────────────────────────────────────────────────────
  function render() {
    var el = root();
    if (!el) return;

    var uploader =
      '<section class="di-section">' +
        '<h3 class="di-h">Read a document</h3>' +
        '<p class="di-sub">A DeLong agronomy invoice confirms which products went on which field. ' +
        'A signed grain contract checks the sale is recorded the way it was papered. ' +
        'Phone photos are fine — PDF, JPEG or PNG, up to 20MB.</p>' +
        '<label class="di-drop' + (state.busy ? ' di-drop-busy' : '') + '" id="di-drop">' +
          '<input type="file" id="di-file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden>' +
          '<span>' + (state.busy ? 'Reading the document…' : 'Choose a file, or drop one here') + '</span>' +
        '</label>' +
      '</section>';

    var docHtml = '';
    if (state.doc) {
      var d = state.doc;
      var proposals = d.proposals || [];

      docHtml += '<section class="di-section">' +
        '<h3 class="di-h">' + esc(d.filename) +
        ' <a class="di-link" href="' + (window.__BASE || '') + '/api/documents/' + esc(d.id) +
        '/original" target="_blank" rel="noopener">view original</a></h3>';

      if (d.docKind === 'unrecognised') {
        docHtml += '<p class="di-sub">Nothing recognisable as an invoice or a contract was found on this file.</p>';
      }

      proposals.forEach(function (p, pi) {
        var applicable = (p.rows || []).filter(function (r) {
          return r.status === 'ready' || r.status === 'new-line';
        }).length;
        docHtml +=
          '<div class="di-invoice" data-pi="' + pi + '">' +
            invoiceHeaderHtml(p, pi) +
            '<div class="di-scroll">' + invoiceRowsHtml(p, pi) + '</div>' +
            '<div class="di-actions">' +
              '<span class="di-sub">' + applicable + ' of ' + (p.rows || []).length +
              ' lines can be applied.</span>' +
              '<button class="btn btn-primary di-apply" data-pi="' + pi + '"' +
                (applicable && p.fieldId ? '' : ' disabled') + '>Confirm ticked passes</button>' +
            '</div>' +
          '</div>';
      });

      docHtml += '</section>';
      docHtml += contractsHtml(d);
    }

    el.innerHTML = uploader + docHtml + '<section class="di-section" id="di-ledger"></section>';
    wire();
    renderLedger();
  }

  // ── ledger ──────────────────────────────────────────────────────
  var ledger = [];
  function loadLedger() {
    api.get('/api/documents?limit=25').then(function (r) {
      ledger = r.documents || [];
      renderLedger();
    }).catch(function () { /* the ledger is a convenience, not the record */ });
  }

  function renderLedger() {
    var el = document.getElementById('di-ledger');
    if (!el) return;
    if (!ledger.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<h3 class="di-h">Documents read</h3><div class="di-scroll"><table class="di-table">' +
      '<thead><tr><th>File</th><th>Kind</th><th>What it held</th><th>Read</th><th>Applied</th><th></th></tr></thead><tbody>' +
      ledger.map(function (d) {
        return '<tr><td>' + esc(d.filename) + '</td>' +
          '<td>' + esc(d.docKind || '') + '</td>' +
          '<td class="di-muted">' + esc(d.summary || '') + '</td>' +
          '<td class="di-muted">' + esc((d.uploadedAt || '').slice(0, 10)) + '</td>' +
          '<td>' + (d.appliedCount ? d.appliedCount + ' row(s)' : '<span class="di-muted">—</span>') + '</td>' +
          '<td><a class="di-link" href="' + (window.__BASE || '') + '/api/documents/' + esc(d.id) +
            '/original" target="_blank" rel="noopener">original</a></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // ── wiring ──────────────────────────────────────────────────────
  function wire() {
    var drop = document.getElementById('di-drop');
    var input = document.getElementById('di-file');
    if (drop && input) {
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) upload(input.files[0]);
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('di-drop-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('di-drop-over'); });
      });
      drop.addEventListener('drop', function (e) {
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) upload(f);
      });
    }

    // Changing the field re-matches that invoice against the newly chosen field.
    Array.prototype.forEach.call(document.querySelectorAll('.di-field'), function (sel) {
      sel.addEventListener('change', function () {
        var pi = parseInt(sel.getAttribute('data-pi'), 10);
        var p = state.doc.proposals[pi];
        if (sel.value === '__all') { expandFieldList(sel, p); return; }
        var chosen = sel.value || null;
        if (!chosen) {
          p.fieldId = null;
          render();
          return;
        }
        // Re-match against the chosen enterprise rather than just relabelling.
        // Swapping the id alone left every row pointing at the previous field's
        // planned lines, so a hand-picked field always added lines instead of
        // confirming the ones already planned on it.
        sel.disabled = true;
        api.post('/api/documents/' + state.doc.id + '/repropose', { index: pi, fieldId: chosen })
          .then(function (r) {
            state.doc.proposals[pi] = r.proposal;
            render();
          })
          .catch(function (e) {
            sel.disabled = false;
            util.showToast(e.message || 'Could not re-match that field', 5000, 'error');
          });
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.di-prod'), function (sel) {
      sel.addEventListener('change', function () {
        var pi = parseInt(sel.getAttribute('data-pi'), 10);
        var ri = parseInt(sel.getAttribute('data-ri'), 10);
        var row = state.doc.proposals[pi].rows.find(function (r) { return r.lineIndex === ri; });
        if (!row) return;
        row.productId = sel.value || null;
        var tick = document.querySelector('.di-row-tick[data-pi="' + pi + '"][data-ri="' + ri + '"]');
        if (tick) tick.disabled = !row.productId;
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.di-apply'), function (btn) {
      btn.addEventListener('click', function () { applyInvoice(parseInt(btn.getAttribute('data-pi'), 10)); });
    });

    var diffBtn = document.getElementById('di-contract-diff');
    if (diffBtn) diffBtn.addEventListener('click', function () { contractsCall('diff'); });
    var createBtn = document.getElementById('di-contract-create');
    if (createBtn) createBtn.addEventListener('click', function () { contractsCall('create'); });
  }

  // The candidate list is deliberately short. When none of them is right, this
  // swaps in every field so the operator is never stuck.
  function expandFieldList(sel, p) {
    var fill = function () {
      sel.innerHTML = '<option value="">— pick a field —</option>' +
        fields().map(function (f) {
          return '<option value="' + esc(f.id) + '">' + esc(f.name) + ' \u00b7 ' +
            n2(f.plantedAcres > 0 ? f.plantedAcres : f.acres) + ' ac \u00b7 ' + esc(f.crop || '') + '</option>';
        }).join('');
      sel.value = p.fieldId || '';
    };
    if (allFields) return fill();
    api.get('/api/fields').then(function (r) {
      allFields = Array.isArray(r) ? r : (r.fields || []);
      fill();
    }).catch(function () { util.showToast('Could not load the field list', 4000, 'error'); });
  }

  function applyInvoice(pi) {
    var p = state.doc.proposals[pi];
    if (!p || !p.fieldId) return;

    var rows = [];
    Array.prototype.forEach.call(
      document.querySelectorAll('.di-row-tick[data-pi="' + pi + '"]:checked'),
      function (tick) {
        var ri = parseInt(tick.getAttribute('data-ri'), 10);
        var r = p.rows.find(function (x) { return x.lineIndex === ri; });
        if (!r || !r.productId) return;
        rows.push({
          fieldId: p.fieldId,
          productId: r.productId,
          // Line identity — lets the server tell a repeat apply from an
          // invoice that genuinely bills the same product twice.
          lineIndex: r.lineIndex,
          // A row whose product the operator changed no longer points at the
          // originally matched line — let the server add a fresh one.
          inputId: r.status === 'ready' ? r.inputId : null,
          invoiceQty: r.invoiceQty,
          invoiceUnit: r.invoiceUnit,
          lineTotal: r.lineTotal,
          description: r.description
        });
      }
    );
    if (!rows.length) return util.showToast('Nothing ticked', 2500, 'info');

    api.post('/api/documents/' + state.doc.id + '/apply', {
      confirmedBy: window.APP_USER_FIRST || null,
      invoices: [{
        invoiceNumber: p.invoiceNumber,
        invoiceVendor: p.vendor,
        invoiceDate: p.invoiceDate,
        acres: p.acres,
        rows: rows
      }]
    }).then(function (res) {
      util.showToast('Applied ' + res.applied + ' line(s) to ' + (p.fieldName || 'the field'), 4000, 'success');
      // The server re-matched against what it just wrote, so the applied rows
      // now read "already on file" — a second click cannot double-apply.
      if (res.document) state.doc = res.document;
      loadLedger();
      render();
    }).catch(function (e) {
      util.showToast(e.message || 'Apply failed', 6000, 'error');
    });
  }

  function contractsCall(mode) {
    api.post('/api/documents/' + state.doc.id + '/contracts', { mode: mode })
      .then(function (res) {
        state.contractDiff = res;
        render();
        if (mode === 'create') {
          util.showToast('Created ' + ((res.created || []).length) + ' contract(s)', 4000, 'success');
        } else {
          var differs = (res.results || []).filter(function (r) { return r.status === 'differs'; }).length;
          util.showToast(differs ? differs + ' contract(s) differ from the paper' : 'Book matches the paper', 4500,
            differs ? 'error' : 'success');
        }
      })
      .catch(function (e) { util.showToast(e.message || 'Contract check failed', 6000, 'error'); });
  }

  // ── boot ────────────────────────────────────────────────────────
  window.addEventListener('tab-activate', function (e) {
    if (e.detail && e.detail.tab === 'documents') {
      var el = root();
      if (!el) return;
      if (!el.innerHTML) render();
      loadLedger();
    }
  });

  window.DocIntake = { render: render, state: state };
})();
