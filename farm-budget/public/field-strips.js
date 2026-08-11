// Field Strips ("Sheet") view — spreadsheet-style vertical strips, one per field.
// Recreates the old one-column-per-field budget spreadsheet: every input,
// machinery pass, and economic line visible at once, editable in place,
// rollups recomputed live via Calc.computeFieldBudget. Deep edits (splits,
// invoices, registry sync) stay in the field-editor modal ("details" link).
(function () {
  'use strict';

  var root = null;
  var ctx = {};
  var stripFields = [];
  var dirtyIds = {};    // fieldId -> true while local edits await a save
  var saveTimers = {};
  var saveStates = {};  // fieldId -> '' | 'dirty' | 'saving' | 'saved' | 'error'
  var pendingFocus = null; // { fid, cell } or { fid, sel } — cell to reopen after a strip re-render

  var SEASON_CYCLE = ['spring', 'fall', ''];
  var SEASON_LABEL = { spring: 'SPR', fall: 'FALL', '': '—' };

  function esc(s) { return util.escHtml(String(s == null ? '' : s)); }

  function buildRefs() {
    return {
      products: window.refData.products,
      implements: window.refData.implements,
      cropPricing: window.refData.cropPricing,
      cropTypes: window.refData.cropTypes,
      laborOverhead: window.refData.laborOverhead,
      seeds: window.refData.seeds,
      buyers: window.refData.buyers || []
    };
  }

  function budgetOf(field) {
    return Calc.computeFieldBudget(field, buildRefs(), window.refData.settings);
  }

  function getField(fid) {
    return stripFields.find(function (f) { return f.id === fid; });
  }

  function stripOf(el) {
    var strip = el.closest('.fs-strip');
    return strip ? strip.getAttribute('data-fid') : null;
  }

  function showMoney() { return window.APP_ROLE !== 'operator'; }
  function showProfit() { return window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office'; }

  // Trim trailing zeros for rate display: 180 -> "180", 106.44 -> "106.44"
  function rate(v) { return String(Math.round((parseFloat(v) || 0) * 1000) / 1000); }

  // ── RENDER ──────────────────────────────────────────────────────────────────

  function render(containerEl, fields, context) {
    root = containerEl;
    ctx = context || {};
    stripFields = fields;

    if (!fields.length) {
      root.innerHTML = '<p class="fs-empty">No fields in this enterprise. Click "+ Add Field" to create one.</p>';
      return;
    }

    // Cluster by systemCode (same approach as the enterprise grid)
    var codeOrder = {};
    var codeIndex = 0;
    fields.forEach(function (f) {
      var code = f.systemCode || 'OTHER';
      if (!(code in codeOrder)) codeOrder[code] = codeIndex++;
    });
    var sorted = fields.slice().sort(function (a, b) {
      var ca = a.systemCode || 'OTHER', cb = b.systemCode || 'OTHER';
      return (codeOrder[ca] || 0) - (codeOrder[cb] || 0);
    });

    var seedOptions = (window.refData.seedVarieties || []).map(function (s) {
      return '<option value="' + esc(s.variety) + '">';
    }).join('');

    var html = '<datalist id="fs-seed-list">' + seedOptions + '</datalist><div class="fs-scroll">';
    sorted.forEach(function (f) { html += stripHtml(f); });
    html += '</div>';
    root.innerHTML = html;
    wire();
  }

  function stripHtml(f) {
    var b;
    try { b = budgetOf(f); } catch (e) { b = f._computed || {}; }
    var cellN = { n: 0 };
    return '<div class="fs-strip" data-fid="' + esc(f.id) + '">' +
      headHtml(f, b) +
      bodyHtml(f, b, cellN) +
      '</div>';
  }

  function headHtml(f, b) {
    var state = saveStates[f.id] || '';
    return '<div class="fs-head">' +
      '<div class="fs-head-top">' +
        '<span class="fs-fname" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
        '<span class="fs-dot" data-state="' + state + '" title="' + dotTitle(state) + '"></span>' +
      '</div>' +
      '<div class="fs-head-sub">' +
        '<span class="fs-sys">' + esc(f.systemCode || '') + '</span>' +
        '<span class="fs-crop" title="' + esc(f.crop) + '">' + esc(f.crop || '') + '</span>' +
        '<span class="fs-acres">' + util.formatNum(b.effectiveAcres || 0, 1) + ' ac</span>' +
        '<button class="fs-details" title="Open full field editor (splits, invoices, registry sync)">details ↗</button>' +
      '</div>' +
    '</div>';
  }

  function dotTitle(state) {
    if (state === 'dirty') return 'Unsaved changes';
    if (state === 'saving') return 'Saving…';
    if (state === 'saved') return 'Saved';
    if (state === 'error') return 'Save failed — click to retry';
    return '';
  }

  // Numeric editable cell. kind: iqty|mpasses|spop|fkey (+ data-idx or data-key)
  function editCell(cellN, kind, idxOrKey, text, cls) {
    var n = cellN.n++;
    var dataAttr = kind === 'fkey'
      ? 'data-key="' + esc(idxOrKey) + '"'
      : 'data-idx="' + idxOrKey + '"';
    return '<span class="fs-edit ' + (cls || '') + '" data-cell="' + n + '" data-kind="' + kind + '" ' +
      dataAttr + ' title="Click to edit">' + text + '</span>';
  }

  function kvRow(label, valueHtml, cls) {
    return '<div class="fs-row fs-krow ' + (cls || '') + '">' +
      '<span class="fs-klabel">' + label + '</span>' +
      '<span class="fs-kval">' + valueHtml + '</span></div>';
  }

  function bodyHtml(f, b, cellN) {
    var money = showMoney();
    var profit = showProfit();
    var h = '<div class="fs-body">';

    // RENT
    if (money) {
      h += kvRow('Rent /AC',
        editCell(cellN, 'fkey', 'rentPerAcre', util.formatMoney(b.rentPerCropAcre || 0)) +
        ' <span class="fs-sub">' + util.formatMoney(b.rentTotal || 0, 0) + '</span>');
    }

    // INPUT BANDS by season (original index preserved)
    var buckets = { spring: [], fall: [], other: [] };
    (f.inputs || []).forEach(function (inp, j) {
      var s = (inp.season || '').toLowerCase();
      var key = s === 'spring' ? 'spring' : (s === 'fall' ? 'fall' : 'other');
      buckets[key].push(j);
    });
    var details = b.inputDetails || [];

    h += inputBand(f, details, cellN, 'SPRING FERT', buckets.spring, 'spring',
      money ? util.formatMoney(b.springFertPerAcre || 0) + '/ac' : '');
    h += inputBand(f, details, cellN, 'FALL FERT', buckets.fall, 'fall',
      money ? util.formatMoney(b.fallFertPerAcre || 0) + '/ac' : '');
    h += inputBand(f, details, cellN, 'OTHER INPUTS', buckets.other, '',
      money ? util.formatMoney(b.unassignedFertPerAcre || 0) + '/ac' : '');

    // SEED
    h += '<div class="fs-band fs-band-seed">' +
      '<div class="fs-band-head"><span>SEED</span><span class="fs-band-roll">' +
      (money ? util.formatMoney(b.seedCostPerAcre || 0) + '/ac' : '') + '</span></div>';
    var fieldSeeds = (f.seeds && f.seeds.length > 0) ? f.seeds : [];
    fieldSeeds.forEach(function (s, j) {
      h += '<div class="fs-row fs-irow">' +
        '<span class="fs-name fs-seedname" data-kind="seed" data-idx="' + j + '" title="' + esc(s.variety) + ' — click to swap">' + esc(s.variety || '—') + '</span>' +
        editCell(cellN, 'spop', j, util.formatNum(s.population || 0, 0), 'fs-pop') +
        '<span class="fs-del" data-kind="seed" data-idx="' + j + '" title="Remove">×</span>' +
      '</div>';
    });
    if (!fieldSeeds.length && f.seed && f.seed.variety) {
      // legacy singular seed — read-only here; modal migrates it
      h += '<div class="fs-row fs-irow fs-dim"><span class="fs-seedname">' + esc(f.seed.variety) +
        '</span><span class="fs-pop">' + util.formatNum(f.seed.population || 0, 0) + '</span></div>';
    }
    h += '<div class="fs-add" data-kind="seed" title="Add seed variety">+ add variety</div></div>';

    // MACHINERY
    h += '<div class="fs-band fs-band-mach">' +
      '<div class="fs-band-head"><span>MACHINERY</span><span class="fs-band-roll">' +
      (money ? util.formatMoney(b.machineryPerAcre || 0) + '/ac' : '') + '</span></div>';
    var mDetails = b.machineryDetails || [];
    (f.machinery || []).forEach(function (m, j) {
      var md = mDetails[j] || {};
      var dim = m.passStatus === 'disregarded';
      h += '<div class="fs-row fs-irow' + (dim ? ' fs-dim' : '') + '">' +
        chkHtml('mach', j, m) +
        editCell(cellN, 'mpasses', j, rate(m.passes || 1), 'fs-qty') +
        '<span class="fs-unit">×</span>' +
        '<span class="fs-name" data-kind="mach" data-idx="' + j + '" title="' + esc(m.implementName) + ' — click to swap">' + esc(m.implementName || '') + '</span>' +
        (money ? '<span class="fs-cost">' + util.formatMoney(md.costPerAcre || 0) + '</span>' : '') +
        '<span class="fs-del" data-kind="mach" data-idx="' + j + '" title="Remove">×</span>' +
      '</div>';
    });
    h += '<div class="fs-add" data-kind="mach" title="Add machinery pass">+ add pass</div></div>';

    // FIXED COSTS
    if (money) {
      h += '<div class="fs-band fs-band-fixed">' +
        '<div class="fs-band-head"><span>FIXED /AC</span><span></span></div>' +
        kvRow('Labor', util.formatMoney(b.laborPerAcre || 0)) +
        kvRow('Overhead', util.formatMoney(b.overheadPerAcre || 0)) +
        kvRow('Fuel', util.formatMoney(b.fuelPerAcre || 0)) +
        kvRow('Drying', util.formatMoney(b.dryingPerAcre || 0)) +
        kvRow('Interest', util.formatMoney(b.interestPerAcre || 0)) +
        kvRow('Crop Ins', editCell(cellN, 'fkey', 'cropInsurancePerAcre', util.formatMoney(b.cropInsurancePerAcre || 0))) +
        '</div>';
      h += kvRow('EXP /AC', util.formatMoney(b.expPerAcre || 0), 'fs-hl');
    }

    // INCOME
    h += '<div class="fs-band fs-band-income">' +
      '<div class="fs-band-head"><span>INCOME</span><span></span></div>' +
      kvRow('Yield /AC',
        editCell(cellN, 'fkey', 'yieldPerAcre', util.formatNum(f.yieldPerAcre || 0, 1)) +
        ' <span class="fs-unit">' + esc(b.yieldUnit || 'Bu') + '</span>');
    if (profit) {
      h += kvRow('Price /Unit', util.formatMoney(b.pricePerUnit || 0)) +
        kvRow('Income /AC', util.formatMoney(b.cropIncomePerAcre || 0)) +
        kvRow('Gov Pmt /AC', editCell(cellN, 'fkey', 'govPaymentsPerAcre', util.formatMoney(f.govPaymentsPerAcre || 0)));
    }
    h += '</div>';

    // PROFIT + TOTALS
    if (profit) {
      var p = b.profitPerAcre || 0;
      h += kvRow('PROFIT /AC', util.formatMoney(p), 'fs-hl ' + (p >= 0 ? 'fs-pos' : 'fs-neg'));
      h += kvRow('Breakeven', util.formatMoney(b.cop || 0) + ' <span class="fs-unit">/' + esc(b.yieldUnit || 'Bu') + '</span>');
      h += '<div class="fs-band fs-band-totals">' +
        '<div class="fs-band-head"><span>FIELD TOTALS</span><span></span></div>' +
        kvRow('Expense', util.formatMoney(b.expTotal || 0, 0)) +
        kvRow('Income', util.formatMoney((b.cropIncomeTotal || 0), 0)) +
        kvRow('Profit w/ Pmts', util.formatMoney(b.profitFarmWithPayments || 0, 0),
          (b.profitFarmWithPayments || 0) >= 0 ? 'fs-pos' : 'fs-neg') +
        '</div>';
    } else if (money) {
      h += '<div class="fs-band fs-band-totals">' +
        '<div class="fs-band-head"><span>FIELD TOTALS</span><span></span></div>' +
        kvRow('Expense', util.formatMoney(b.expTotal || 0, 0)) +
        '</div>';
    }

    h += '</div>';
    return h;
  }

  function inputBand(f, details, cellN, title, idxList, season, rollup) {
    var money = showMoney();
    var h = '<div class="fs-band fs-band-fert">' +
      '<div class="fs-band-head"><span>' + title + '</span><span class="fs-band-roll">' + rollup + '</span></div>';
    idxList.forEach(function (j) {
      var inp = f.inputs[j];
      var d = details[j] || {};
      var dim = inp.passStatus === 'disregarded';
      h += '<div class="fs-row fs-irow' + (dim ? ' fs-dim' : '') + '">' +
        chkHtml('input', j, inp) +
        editCell(cellN, 'iqty', j, rate(inp.quantity), 'fs-qty') +
        '<span class="fs-unit">' + esc(d.unit || '') + '</span>' +
        '<span class="fs-name" data-kind="input" data-idx="' + j + '" title="' + esc(inp.productName) + ' — click to swap">' + esc(inp.productName || '') + '</span>' +
        (money ? '<span class="fs-cost">' + util.formatMoney(d.costPerAcre || 0) + '</span>' : '') +
        '<span class="fs-season fs-season-' + (season || 'none') + '" data-idx="' + j + '" title="Season: click to cycle spring → fall → none">' +
          SEASON_LABEL[(inp.season || '').toLowerCase() === 'spring' ? 'spring' : ((inp.season || '').toLowerCase() === 'fall' ? 'fall' : '')] + '</span>' +
        '<span class="fs-del" data-kind="input" data-idx="' + j + '" title="Remove">×</span>' +
      '</div>';
    });
    h += '<div class="fs-add" data-kind="input" data-season="' + season + '" title="Add product">+ add product</div></div>';
    return h;
  }

  function chkHtml(kind, idx, item) {
    var st = item.passStatus || 'planned';
    if (st === 'disregarded') {
      return '<span class="fs-chk-skip" title="Disregarded — change in field editor">⊘</span>';
    }
    return '<input type="checkbox" class="fs-chk" data-kind="' + kind + '" data-idx="' + idx + '"' +
      (st === 'confirmed' ? ' checked' : '') + ' title="' +
      (st === 'confirmed' ? 'Confirmed ' + esc((item.confirmedDate || '').slice(0, 10)) + ' — uncheck to revert to planned' : 'Mark applied/confirmed') + '">';
  }

  // ── EVENT WIRING (one delegated listener) ───────────────────────────────────

  function wire() {
    if (root._fsWired) return;
    root._fsWired = true;

    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('.fs-edit'))) return openNumeric(t);
      if ((t = e.target.closest('.fs-name'))) return openName(t);
      if ((t = e.target.closest('.fs-add'))) return openAdd(t);
      if ((t = e.target.closest('.fs-del'))) return doDelete(t);
      if ((t = e.target.closest('.fs-season'))) return cycleSeason(t);
      if ((t = e.target.closest('.fs-details'))) {
        var f = getField(stripOf(t));
        if (f && ctx.openEditor) ctx.openEditor(f);
        return;
      }
      if ((t = e.target.closest('.fs-dot'))) {
        if (t.getAttribute('data-state') === 'error') doSave(stripOf(t));
        return;
      }
    });

    root.addEventListener('change', function (e) {
      var t = e.target.closest('.fs-chk');
      if (t) toggleConfirm(t);
    });
  }

  function rerenderStrip(fid) {
    var f = getField(fid);
    var el = root.querySelector('.fs-strip[data-fid="' + fid + '"]');
    if (!f || !el) return;
    el.outerHTML = stripHtml(f);
    focusPending();
  }

  function focusPending() {
    if (!pendingFocus) return;
    var pf = pendingFocus;
    pendingFocus = null;
    var strip = root.querySelector('.fs-strip[data-fid="' + pf.fid + '"]');
    if (!strip) return;
    var target = pf.sel
      ? strip.querySelector(pf.sel)
      : strip.querySelector('.fs-edit[data-cell="' + pf.cell + '"]');
    if (target) openNumeric(target);
  }

  // ── NUMERIC EDIT ────────────────────────────────────────────────────────────

  function readNum(f, kind, idx, key) {
    if (kind === 'iqty') return (f.inputs[idx] || {}).quantity || 0;
    if (kind === 'mpasses') return (f.machinery[idx] || {}).passes || 1;
    if (kind === 'spop') return (f.seeds[idx] || {}).population || 0;
    return parseFloat(f[key]) || 0;
  }

  function writeNum(f, kind, idx, key, v) {
    if (kind === 'iqty') { if (f.inputs[idx]) f.inputs[idx].quantity = v; return; }
    if (kind === 'mpasses') { if (f.machinery[idx]) f.machinery[idx].passes = v; return; }
    if (kind === 'spop') { if (f.seeds[idx]) f.seeds[idx].population = v; return; }
    f[key] = v;
  }

  function openNumeric(span) {
    if (span.querySelector('input')) return;
    var fid = stripOf(span);
    var f = getField(fid);
    if (!f) return;
    var kind = span.getAttribute('data-kind');
    var idx = parseInt(span.getAttribute('data-idx') || '-1', 10);
    var key = span.getAttribute('data-key') || '';
    var cellNo = parseInt(span.getAttribute('data-cell'), 10);
    var cur = readNum(f, kind, idx, key);
    var origHtml = span.innerHTML;

    span.classList.add('fs-editing');
    span.innerHTML = '<input type="number" class="fs-input" step="any" min="0" value="' + cur + '">';
    var input = span.querySelector('input');
    input.focus();
    input.select();

    var done = false;
    function commit(advance) {
      if (done) return;
      done = true;
      var v = parseFloat(input.value);
      var changed = !isNaN(v) && v >= 0 && v !== cur;
      if (changed) {
        writeNum(f, kind, idx, key, v);
        markDirty(fid);
        if (advance) pendingFocus = { fid: fid, cell: cellNo + advance };
        rerenderStrip(fid);
      } else {
        span.classList.remove('fs-editing');
        span.innerHTML = origHtml;
        if (advance) {
          pendingFocus = { fid: fid, cell: cellNo + advance };
          focusPending();
        }
      }
    }

    input.addEventListener('blur', function () { commit(0); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(1); }
      else if (e.key === 'Tab') { e.preventDefault(); commit(e.shiftKey ? -1 : 1); }
      else if (e.key === 'Escape') {
        done = true;
        span.classList.remove('fs-editing');
        span.innerHTML = origHtml;
      }
    });
  }

  // ── NAME SWAP (datalist-backed, same lists the modal uses) ──────────────────

  function listFor(kind) {
    if (kind === 'mach') return 'impl-search-list';
    if (kind === 'seed') return 'fs-seed-list';
    return 'prod-search-list';
  }

  function openName(span) {
    if (span.querySelector('input')) return;
    var fid = stripOf(span);
    var f = getField(fid);
    if (!f) return;
    var kind = span.getAttribute('data-kind');
    var idx = parseInt(span.getAttribute('data-idx'), 10);
    var item = kind === 'mach' ? f.machinery[idx] : (kind === 'seed' ? f.seeds[idx] : f.inputs[idx]);
    if (!item) return;
    var curName = kind === 'mach' ? (item.implementName || '') : (kind === 'seed' ? (item.variety || '') : (item.productName || ''));
    var origHtml = span.innerHTML;

    span.classList.add('fs-editing');
    span.innerHTML = '<input type="text" class="fs-input fs-input-name" list="' + listFor(kind) + '" value="' + esc(curName) + '">';
    var input = span.querySelector('input');
    input.focus();
    input.select();

    var done = false;
    function commit() {
      if (done) return;
      done = true;
      var name = input.value.trim();
      if (name && name !== curName) {
        if (kind === 'mach') item.implementName = name;
        else if (kind === 'seed') item.variety = name;
        else item.productName = name;
        markDirty(fid);
        rerenderStrip(fid);
      } else {
        span.classList.remove('fs-editing');
        span.innerHTML = origHtml;
      }
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') {
        done = true;
        span.classList.remove('fs-editing');
        span.innerHTML = origHtml;
      }
    });
  }

  // ── ADD ROW ─────────────────────────────────────────────────────────────────

  function openAdd(div) {
    if (div.querySelector('input')) return;
    var fid = stripOf(div);
    var f = getField(fid);
    if (!f) return;
    var kind = div.getAttribute('data-kind');
    var season = div.getAttribute('data-season') || '';
    var origHtml = div.innerHTML;
    var placeholder = kind === 'mach' ? 'implement…' : (kind === 'seed' ? 'variety…' : 'product…');

    div.innerHTML = '<input type="text" class="fs-input fs-input-name" list="' + listFor(kind) + '" placeholder="' + placeholder + '">';
    var input = div.querySelector('input');
    input.focus();

    var done = false;
    function commit() {
      if (done) return;
      done = true;
      var name = input.value.trim();
      if (!name) { div.innerHTML = origHtml; return; }
      if (kind === 'mach') {
        f.machinery = f.machinery || [];
        f.machinery.push({ id: util.generateId('mach'), implementName: name, passes: 1, passStatus: 'planned' });
        pendingFocus = { fid: fid, sel: '.fs-edit[data-kind="mpasses"][data-idx="' + (f.machinery.length - 1) + '"]' };
      } else if (kind === 'seed') {
        f.seeds = f.seeds || [];
        f.seeds.push({ variety: name, population: 0 });
        pendingFocus = { fid: fid, sel: '.fs-edit[data-kind="spop"][data-idx="' + (f.seeds.length - 1) + '"]' };
      } else {
        f.inputs = f.inputs || [];
        f.inputs.push({ id: util.generateId('inp'), productName: name, quantity: 0, season: season, passStatus: 'planned' });
        pendingFocus = { fid: fid, sel: '.fs-edit[data-kind="iqty"][data-idx="' + (f.inputs.length - 1) + '"]' };
      }
      markDirty(fid);
      rerenderStrip(fid);
    }

    input.addEventListener('blur', function () {
      // let datalist mousedown land first
      setTimeout(commit, 150);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { done = true; div.innerHTML = origHtml; }
    });
  }

  // ── DELETE / SEASON / CONFIRM ───────────────────────────────────────────────

  function doDelete(t) {
    var fid = stripOf(t);
    var f = getField(fid);
    if (!f) return;
    var kind = t.getAttribute('data-kind');
    var idx = parseInt(t.getAttribute('data-idx'), 10);
    var arr = kind === 'mach' ? f.machinery : (kind === 'seed' ? f.seeds : f.inputs);
    if (!arr || arr[idx] === undefined) return;
    arr.splice(idx, 1);
    markDirty(fid);
    rerenderStrip(fid);
  }

  function cycleSeason(t) {
    var fid = stripOf(t);
    var f = getField(fid);
    if (!f) return;
    var idx = parseInt(t.getAttribute('data-idx'), 10);
    var inp = (f.inputs || [])[idx];
    if (!inp) return;
    var cur = (inp.season || '').toLowerCase();
    if (cur !== 'spring' && cur !== 'fall') cur = '';
    inp.season = SEASON_CYCLE[(SEASON_CYCLE.indexOf(cur) + 1) % SEASON_CYCLE.length];
    markDirty(fid);
    rerenderStrip(fid);
  }

  function toggleConfirm(chk) {
    var fid = stripOf(chk);
    var f = getField(fid);
    if (!f) return;
    var kind = chk.getAttribute('data-kind');
    var idx = parseInt(chk.getAttribute('data-idx'), 10);
    var item = kind === 'mach' ? (f.machinery || [])[idx] : (f.inputs || [])[idx];
    if (!item) return;
    if (item.passStatus === 'confirmed') {
      if (item.invoiceCostTotal != null) {
        chk.checked = true;
        util.showToast('Has invoice data — revert it in the field editor');
        return;
      }
      item.passStatus = 'planned';
      item.confirmedDate = null;
      item.actualQuantity = null;
    } else {
      item.passStatus = 'confirmed';
      item.confirmedDate = new Date().toISOString().slice(0, 10);
    }
    markDirty(fid);
    rerenderStrip(fid);
  }

  // ── SAVE QUEUE ──────────────────────────────────────────────────────────────

  function setDot(fid, state) {
    saveStates[fid] = state;
    var dot = root.querySelector('.fs-strip[data-fid="' + fid + '"] .fs-dot');
    if (dot) {
      dot.setAttribute('data-state', state);
      dot.setAttribute('title', dotTitle(state));
    }
    if (state === 'saved') {
      setTimeout(function () {
        if (saveStates[fid] === 'saved') setDot(fid, '');
      }, 2000);
    }
  }

  function markDirty(fid) {
    dirtyIds[fid] = true;
    setDot(fid, 'dirty');
    clearTimeout(saveTimers[fid]);
    saveTimers[fid] = setTimeout(function () { doSave(fid); }, 600);
  }

  function doSave(fid) {
    var f = getField(fid);
    if (!f) return;
    dirtyIds[fid] = false;
    setDot(fid, 'saving');
    api.put('/api/fields/' + fid, f).then(function (updated) {
      if (dirtyIds[fid]) return; // newer local edits pending — their save reconciles
      Object.keys(updated).forEach(function (k) { f[k] = updated[k]; });
      setDot(fid, 'saved');
      rerenderStrip(fid);
      if (ctx.onFieldSaved) ctx.onFieldSaved(f);
    }).catch(function () {
      dirtyIds[fid] = true;
      setDot(fid, 'error');
    });
  }

  window.FieldStrips = { render: render };
})();
