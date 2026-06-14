// Enterprise view — card view + field-by-field budget grid
(function () {
  'use strict';

  var currentEntId = null;
  var fieldsData = [];
  var currentView = 'cards';
  var isLoading = false;
  var loadSerial = 0;
  var batchMode = false;
  var selectedFieldIds = new Set();

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'enterprise') {
      var idx = e.detail.enterpriseIdx || 0;
      var ent = window.refData.enterprises[idx];
      if (ent) {
        currentEntId = ent.id;
        document.getElementById('ent-title').textContent = ent.name;
        // Reset batch mode when switching enterprises
        batchMode = false;
        selectedFieldIds.clear();
        var batchBtn = document.getElementById('ent-batch-mode-btn');
        if (batchBtn) { batchBtn.classList.remove('active'); batchBtn.textContent = 'Batch'; }
        closeBatchPanels();
        updateBatchBar();
        loadEnterprise(ent.id);
      }
    }
  });

  document.getElementById('ent-add-field').addEventListener('click', function () {
    if (!currentEntId) return;
    var ent = window.refData.enterprises.find(function (e) { return e.id === currentEntId; });
    window.openFieldEditor(null, currentEntId, ent ? ent.systemCodes[0] : 'CON');
  });

  // ── BATCH MODE ──────────────────────────────────────────────────────────────

  document.getElementById('ent-batch-mode-btn').addEventListener('click', function () {
    batchMode = !batchMode;
    selectedFieldIds.clear();
    this.classList.toggle('active', batchMode);
    this.textContent = batchMode ? 'Batch: ON' : 'Batch';
    closeBatchPanels();
    updateBatchBar();
    renderCurrentView();
  });

  function closeBatchPanels() {
    ['ent-batch-prog-panel', 'ent-batch-variety-panel', 'ent-qp-panel', 'ent-scenario-panel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function updateBatchBar() {
    var bar = document.getElementById('ent-batch-bar');
    if (!bar) return;
    var count = selectedFieldIds.size;
    document.getElementById('ent-batch-count').textContent = count + ' field' + (count !== 1 ? 's' : '') + ' selected';
    bar.style.display = batchMode ? 'flex' : 'none';
    var applyBtn = document.getElementById('ent-batch-apply-prog');
    var varBtn = document.getElementById('ent-batch-swap-variety');
    var qpBtn = document.getElementById('ent-batch-quick-plan');
    var cmpBtn = document.getElementById('ent-batch-compare');
    if (applyBtn) applyBtn.disabled = count === 0;
    if (varBtn) varBtn.disabled = count === 0;
    if (qpBtn) qpBtn.disabled = count === 0;
    if (cmpBtn) cmpBtn.disabled = count === 0;
  }

  // Select all / clear
  document.getElementById('ent-batch-select-all').addEventListener('click', function () {
    document.querySelectorAll('#ent-cards .field-select-cb').forEach(function (cb) {
      cb.checked = true;
      selectedFieldIds.add(cb.getAttribute('data-field-id'));
    });
    updateBatchBar();
  });

  document.getElementById('ent-batch-select-none').addEventListener('click', function () {
    document.querySelectorAll('#ent-cards .field-select-cb').forEach(function (cb) {
      cb.checked = false;
    });
    selectedFieldIds.clear();
    updateBatchBar();
  });

  // ── APPLY PROGRAM ────────────────────────────────────────────────────────────

  document.getElementById('ent-batch-apply-prog').addEventListener('click', function () {
    if (!selectedFieldIds.size) return;
    var panel = document.getElementById('ent-batch-prog-panel');
    document.getElementById('ent-batch-prog-count').textContent = selectedFieldIds.size;

    var programs = window.refData.programs || [];

    // Filter to programs matching the crops of selected fields
    var selectedCrops = new Set();
    selectedFieldIds.forEach(function (fid) {
      var f = fieldsData.find(function (x) { return x.id === fid; });
      if (f && f.crop) selectedCrops.add(f.crop);
    });
    var relevant = programs.filter(function (p) {
      if (!p.crop) return true; // un-tagged programs always show
      return selectedCrops.has(p.crop);
    });
    if (!relevant.length) relevant = programs; // fallback: show all if no match

    var html = '';
    if (!relevant.length) {
      html = '<p style="color:var(--text-light);font-size:0.85rem;padding:0.5rem">No programs yet. Create one in the Programs tab first.</p>';
    } else {
      relevant.forEach(function (prog) {
        var inputCount = (prog.inputs || []).length;
        var machCount  = (prog.machinery || []).length;
        var seeds = prog.seeds && prog.seeds.length > 0 ? prog.seeds : (prog.seed ? [prog.seed] : []);
        var variety = seeds.length > 0 ? (seeds[0].variety || '--') : '--';
        var yld = prog.yieldPerAcre ? util.formatNum(prog.yieldPerAcre, 0) + ' ' + (prog.yieldUnit || 'Bu') + '/ac' : '';
        html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:0.65rem 0.75rem">' +
          '<div style="font-weight:600;font-size:0.88rem;margin-bottom:0.15rem">' + util.escHtml(prog.name) + '</div>' +
          '<div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.15rem">' +
            util.escHtml(prog.crop || 'any crop') + ' &middot; ' + util.escHtml(prog.systemCode || '') +
          '</div>' +
          '<div style="font-size:0.75rem;color:var(--text-light);margin-bottom:0.4rem">' +
            inputCount + ' inputs &middot; ' + machCount + ' implements' +
            (variety !== '--' ? ' &middot; ' + util.escHtml(variety) : '') +
            (yld ? ' &middot; ' + util.escHtml(yld) : '') +
          '</div>' +
          '<button class="btn-primary btn-sm prog-pick-apply" data-prog-id="' + prog.id + '" data-prog-name="' + util.escHtml(prog.name) + '" style="font-size:0.75rem">Apply to ' + selectedFieldIds.size + ' Field(s)</button>' +
          '</div>';
      });
    }

    document.getElementById('ent-batch-prog-list').innerHTML = html;
    document.getElementById('ent-batch-variety-panel').classList.add('hidden');
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    document.querySelectorAll('.prog-pick-apply').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var progId = btn.getAttribute('data-prog-id');
        var progName = btn.getAttribute('data-prog-name');
        var fieldIds = Array.from(selectedFieldIds);
        if (!confirm('Apply "' + progName + '" to ' + fieldIds.length + ' field(s)?\n\nInputs, machinery, seed, and yield will be overwritten. Name, acres, and rent are kept.')) return;

        api.post('/api/programs/' + progId + '/apply-bulk', { fieldIds: fieldIds })
          .then(function (result) {
            util.showToast('Applied "' + progName + '" to ' + result.updated + ' field(s)');
            closeBatchPanels();
            selectedFieldIds.clear();
            updateBatchBar();
            loadEnterprise(currentEntId);
            if (typeof window.reloadPrograms === 'function') window.reloadPrograms();
          })
          .catch(function (err) { util.showToast('Error: ' + err.message); });
      });
    });
  });

  document.getElementById('ent-batch-prog-cancel').addEventListener('click', function () {
    document.getElementById('ent-batch-prog-panel').classList.add('hidden');
  });

  // ── SWAP VARIETY ─────────────────────────────────────────────────────────────

  document.getElementById('ent-batch-swap-variety').addEventListener('click', function () {
    if (!selectedFieldIds.size) return;
    document.getElementById('ent-batch-variety-count').textContent = selectedFieldIds.size;

    // Populate datalist from seed reference, filtered by selected field crops
    var seeds = window.refData.seeds || [];
    var selectedCrops = new Set();
    selectedFieldIds.forEach(function (fid) {
      var f = fieldsData.find(function (x) { return x.id === fid; });
      if (f && f.crop) selectedCrops.add(f.crop);
    });
    var relevantSeeds = selectedCrops.size > 0
      ? seeds.filter(function (s) { return selectedCrops.has(s.crop); })
      : seeds;

    document.getElementById('ent-batch-variety-datalist').innerHTML =
      relevantSeeds.map(function (s) { return '<option value="' + util.escHtml(s.variety) + '">'; }).join('');

    document.getElementById('ent-batch-variety-input').value = '';
    document.getElementById('ent-batch-pop-input').value = '';
    document.getElementById('ent-batch-prog-panel').classList.add('hidden');
    document.getElementById('ent-batch-variety-panel').classList.remove('hidden');
    document.getElementById('ent-batch-variety-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(function () { document.getElementById('ent-batch-variety-input').focus(); }, 100);
  });

  document.getElementById('ent-batch-variety-apply').addEventListener('click', function () {
    var variety = document.getElementById('ent-batch-variety-input').value.trim();
    var popRaw  = document.getElementById('ent-batch-pop-input').value.trim();
    var population = popRaw !== '' ? (parseInt(popRaw, 10) || 0) : 0;
    if (!variety) { util.showToast('Enter a variety name'); return; }

    var fieldIds = Array.from(selectedFieldIds);
    var popNote = (population > 0) ? ', pop ' + population : ' (existing population kept)';
    if (!confirm('Set variety "' + variety + '"' + popNote + ' on ' + fieldIds.length + ' field(s)?\n\nOnly seed variety is changed — inputs and machinery are untouched.')) return;

    api.post('/api/fields/batch-variety', { fieldIds: fieldIds, variety: variety, population: population })
      .then(function (result) {
        util.showToast('Variety updated on ' + result.updated + ' field(s)');
        closeBatchPanels();
        selectedFieldIds.clear();
        updateBatchBar();
        loadEnterprise(currentEntId);
      })
      .catch(function (err) { util.showToast('Error: ' + err.message); });
  });

  document.getElementById('ent-batch-variety-cancel').addEventListener('click', function () {
    document.getElementById('ent-batch-variety-panel').classList.add('hidden');
  });

  // Allow Enter key to submit variety swap
  document.getElementById('ent-batch-variety-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('ent-batch-variety-apply').click();
  });

  // ── QUICK PLAN WIZARD ────────────────────────────────────────────────────────

  var qpState = { crop: null, variant: null, tillage: null, entry: null };

  function qpShow(id) { var el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
  function qpHide(id) { var el = document.getElementById(id); if (el) el.classList.add('hidden'); }

  function qpReset() {
    qpState = { crop: null, variant: null, tillage: null, entry: null };
    qpHide('ent-qp-step1'); qpHide('ent-qp-step2'); qpHide('ent-qp-step3');
    qpHide('ent-qp-preview'); qpHide('ent-qp-actions'); qpHide('ent-qp-empty');
    document.getElementById('ent-qp-crops').innerHTML = '';
    document.getElementById('ent-qp-variants').innerHTML = '';
    document.getElementById('ent-qp-tillages').innerHTML = '';
    document.getElementById('ent-qp-preview').innerHTML = '';
    var confirmBtn = document.getElementById('ent-qp-confirm');
    if (confirmBtn) confirmBtn.disabled = true;
  }

  function qpBuildRadios(containerId, values, onSelect) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';
    values.forEach(function (val) {
      var label = document.createElement('label');
      label.className = 'qp-radio-label';
      var displayVal = val === '' ? '(no variant)' : val;
      label.innerHTML = '<input type="radio" name="' + containerId + '" value="' + val + '"> ' + displayVal;
      label.querySelector('input').addEventListener('change', function () { onSelect(val); });
      container.appendChild(label);
    });
  }

  function qpRenderStep1(config) {
    var crops = config.map(function (c) { return c.crop; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    qpBuildRadios('ent-qp-crops', crops, function (crop) {
      qpState.crop = crop;
      qpState.variant = null; qpState.tillage = null; qpState.entry = null;
      qpHide('ent-qp-step2'); qpHide('ent-qp-step3'); qpHide('ent-qp-preview'); qpHide('ent-qp-actions');
      qpRenderStep2(config, crop);
    });
    qpShow('ent-qp-step1');
  }

  function qpRenderStep2(config, crop) {
    var variants = config
      .filter(function (c) { return c.crop === crop; })
      .map(function (c) { return c.variant || ''; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    if (variants.length === 1) {
      // auto-skip
      qpState.variant = variants[0];
      qpRenderStep3(config, crop, variants[0]);
      return;
    }
    qpBuildRadios('ent-qp-variants', variants, function (variant) {
      qpState.variant = variant;
      qpState.tillage = null; qpState.entry = null;
      qpHide('ent-qp-step3'); qpHide('ent-qp-preview'); qpHide('ent-qp-actions');
      qpRenderStep3(config, crop, variant);
    });
    qpShow('ent-qp-step2');
  }

  function qpRenderStep3(config, crop, variant) {
    var tillages = config
      .filter(function (c) { return c.crop === crop && (c.variant || '') === variant; })
      .map(function (c) { return c.tillage; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    if (tillages.length === 1) {
      qpState.tillage = tillages[0];
      qpRenderPreview(config);
      return;
    }
    qpBuildRadios('ent-qp-tillages', tillages, function (tillage) {
      qpState.tillage = tillage;
      qpState.entry = null;
      qpHide('ent-qp-preview'); qpHide('ent-qp-actions');
      qpRenderPreview(config);
    });
    qpShow('ent-qp-step3');
  }

  function qpRenderPreview(config) {
    var entry = config.find(function (c) {
      return c.crop === qpState.crop &&
        (c.variant || '') === (qpState.variant || '') &&
        c.tillage === qpState.tillage;
    });
    qpState.entry = entry || null;
    if (!entry) return;
    var inputProg = (window.refData.programs || []).find(function (p) { return p.id === entry.inputProgramId; });
    var machProg = (window.refData.machineryPrograms || []).find(function (p) { return p.id === entry.machineryProgramId; });
    var inputName = inputProg ? inputProg.name : (entry.inputProgramId ? entry.inputProgramId : 'none');
    var machName = machProg ? machProg.name : (entry.machineryProgramId ? entry.machineryProgramId : 'none');
    var preview = document.getElementById('ent-qp-preview');
    preview.innerHTML = '<strong>Inputs:</strong> ' + inputName + '&nbsp;&nbsp;&nbsp;<strong>Machinery:</strong> ' + machName;
    qpShow('ent-qp-preview');
    qpShow('ent-qp-actions');
    var confirmBtn = document.getElementById('ent-qp-confirm');
    if (confirmBtn) confirmBtn.disabled = false;
  }

  document.getElementById('ent-batch-quick-plan').addEventListener('click', function () {
    var config = window.refData.quickPlanConfig || [];
    var panel = document.getElementById('ent-qp-panel');
    closeBatchPanels();
    panel.classList.remove('hidden');
    var countEl = document.getElementById('ent-qp-count');
    if (countEl) countEl.textContent = selectedFieldIds.size;
    qpReset();
    if (config.length === 0) {
      qpShow('ent-qp-empty');
      return;
    }
    qpRenderStep1(config);
  });

  document.getElementById('ent-qp-cancel').addEventListener('click', function () {
    document.getElementById('ent-qp-panel').classList.add('hidden');
  });

  document.getElementById('ent-qp-reset').addEventListener('click', function () {
    var config = window.refData.quickPlanConfig || [];
    qpReset();
    if (config.length === 0) { qpShow('ent-qp-empty'); return; }
    qpRenderStep1(config);
  });

  document.getElementById('ent-qp-confirm').addEventListener('click', function () {
    var entry = qpState.entry;
    if (!entry) return;
    var fieldIds = Array.from(selectedFieldIds);
    var label = qpState.crop + (qpState.variant ? ' / ' + qpState.variant : '') + ' / ' + qpState.tillage;
    if (!confirm('Apply "' + label + '" to ' + fieldIds.length + ' field(s)?\n\nInputs, seed, crop, and yield will be updated. Machinery will be replaced if a machinery program is set.')) return;

    var confirmBtn = document.getElementById('ent-qp-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Applying...';

    var inputCall = entry.inputProgramId
      ? api.post('/api/programs/' + entry.inputProgramId + '/apply-bulk', {
          fieldIds: fieldIds,
          sections: ['inputs', 'seed', 'crop', 'yield']
        })
      : Promise.resolve({ updated: 0 });

    inputCall.then(function () {
      var machCall = entry.machineryProgramId
        ? api.post('/api/machinery-programs/' + entry.machineryProgramId + '/push', { fieldIds: fieldIds })
        : Promise.resolve({ updated: 0 });
      return machCall;
    }).then(function () {
      util.showToast('Quick Plan applied to ' + fieldIds.length + ' field(s)');
      document.getElementById('ent-qp-panel').classList.add('hidden');
      selectedFieldIds.clear();
      updateBatchBar();
      loadEnterprise(currentEntId);
      window.reloadRefDataSelective('quick-plan-config');
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = '\u2713 Apply to Fields';
    });
  });

  // ── PRINT PLAN ───────────────────────────────────────────────────────────────

  document.getElementById('ent-print-plan').addEventListener('click', function () {
    // Must open window synchronously (inside click handler) to avoid popup blocker
    var win = window.open('', '_blank');
    if (!win) { util.showToast('Popup blocked — allow popups for this site'); return; }

    var ent = (window.refData.enterprises || []).find(function (e) { return e.id === currentEntId; });
    var entName = ent ? ent.name : 'Enterprise';
    var fields = (fieldsData || []).slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    function progName(id, list) {
      if (!id) return '—';
      var p = (list || []).find(function (x) { return x.id === id; });
      return p ? p.name : id;
    }

    var totalAcres = 0;
    var rows = fields.map(function (f) {
      var acres = parseFloat(f.acres) || 0;
      totalAcres += acres;
      var cropLabel = [f.crop, f.variety].filter(Boolean).join(' — ');
      var system = f.systemCode || (f.tillage || '');
      var inputProg = progName(f.templateId, window.refData.programs);
      var machProg = progName(f.machineryProgramId, window.refData.machineryPrograms);
      return '<tr><td>' + (f.name || '') + '</td><td>' + cropLabel + '</td><td>' + system +
        '</td><td>' + inputProg + '</td><td>' + machProg + '</td><td style="text-align:right">' +
        (acres > 0 ? acres.toFixed(1) : '—') + '</td><td>' + (f.notes || '') + '</td></tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<title>Field Plan — ' + entName + '</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;font-size:10.5pt;margin:0;padding:0.5in}' +
      'h1{font-size:13pt;margin:0 0 4px}' +
      '.sub{font-size:9pt;color:#555;margin:0 0 12px}' +
      'table{width:100%;border-collapse:collapse}' +
      'th,td{border:1px solid #ccc;padding:4px 6px;vertical-align:top}' +
      'thead{background:#f0f0f0}' +
      'thead th{font-size:9pt;font-weight:bold}' +
      'tfoot td{font-weight:bold;background:#f0f0f0}' +
      'tr:nth-child(even){background:#fafafa}' +
      '@media print{@page{size:landscape;margin:0.4in}body{margin:0}}' +
      '</style></head><body>' +
      '<h1>Field Plan &mdash; ' + entName + '</h1>' +
      '<p class="sub">Printed ' + new Date().toLocaleDateString() + '</p>' +
      '<table>' +
      '<thead><tr><th>Field</th><th>Crop / Variety</th><th>System</th>' +
      '<th>Input Program</th><th>Machinery Program</th><th>Acres</th><th>Notes</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="5">Total</td><td style="text-align:right">' + totalAcres.toFixed(1) + '</td><td></td></tr></tfoot>' +
      '</table></body></html>';

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.print();
  });

  // ── SCENARIO COMPARISON ──────────────────────────────────────────────────────

  function scPopulateDropdowns() {
    var config = window.refData.quickPlanConfig || [];
    var opts = '<option value="">— choose —</option>' + config.map(function (c) {
      var label = c.crop + (c.variant ? ' / ' + c.variant : '') + ' / ' + c.tillage;
      return '<option value="' + c.id + '">' + label + '</option>';
    }).join('');
    ['ent-sc-a', 'ent-sc-b', 'ent-sc-c'].forEach(function (id) {
      var sel = document.getElementById(id);
      if (sel) sel.innerHTML = opts;
    });
  }

  function scApplyPlanToField(field, entry, programs, machProgs) {
    var mock = JSON.parse(JSON.stringify(field));
    var inputProg = programs.find(function (p) { return p.id === entry.inputProgramId; });
    var machProg = machProgs.find(function (p) { return p.id === entry.machineryProgramId; });
    if (inputProg) {
      if (inputProg.inputs) mock.inputs = JSON.parse(JSON.stringify(inputProg.inputs));
      if (inputProg.seeds && inputProg.seeds.length) mock.seeds = JSON.parse(JSON.stringify(inputProg.seeds));
      if (inputProg.seed) mock.seed = JSON.parse(JSON.stringify(inputProg.seed));
      if (inputProg.yieldTarget) mock.yieldPerAcre = inputProg.yieldTarget;
      if (inputProg.crop) mock.crop = inputProg.crop;
      mock.templateId = inputProg.id;
    }
    if (machProg && machProg.machinery) {
      mock.machinery = JSON.parse(JSON.stringify(machProg.machinery));
      mock.machineryProgramId = machProg.id;
    }
    return mock;
  }

  function scComputeScenario(entry, fields, refs, settings) {
    var mocked = fields.map(function (f) {
      return scApplyPlanToField(f, entry, refs.programs || [], refs.machineryPrograms || []);
    });
    return Calc.computeEnterpriseSummary(mocked, refs, settings);
  }

  function scFmt(n) { return util.formatMoney(n); }
  function scFmtDelta(n) {
    if (n === null || n === undefined) return '';
    var s = (n >= 0 ? '+' : '') + util.formatMoney(n);
    var color = n > 0 ? 'var(--success)' : (n < 0 ? 'var(--danger)' : 'var(--text-light)');
    return '<span style="color:' + color + '">' + s + '</span>';
  }

  function scBest(vals, higherBetter) {
    // Return index of best value (highest profit/revenue, lowest cost)
    var best = null;
    vals.forEach(function (v, i) {
      if (v === null || v === undefined) return;
      if (best === null || (higherBetter ? v > vals[best] : v < vals[best])) best = i;
    });
    return best;
  }

  function scRenderTable(scenarios) {
    // scenarios: array of { label, entry, totals }
    var labels = scenarios.map(function (s) { return s.label; });
    var totals = scenarios.map(function (s) { return s.totals; });
    var acresArr = totals.map(function (t) { return t.acres; });

    function perAcre(key, t) { return t.acres > 0 ? Calc.round2(t[key] / t.acres) : 0; }

    var rows = [
      { label: 'Acres', vals: acresArr, fmt: function (v) { return v.toFixed(1); }, higher: null, unit: 'ac', group: 'info' },
      { label: 'Inputs $/ac', vals: totals.map(function (t) { return perAcre('fert', t); }), fmt: scFmt, higher: false, group: 'cost' },
      { label: 'Machinery $/ac', vals: totals.map(function (t) { return perAcre('machinery', t); }), fmt: scFmt, higher: false, group: 'cost' },
      { label: 'Seed $/ac', vals: totals.map(function (t) { return perAcre('seed', t); }), fmt: scFmt, higher: false, group: 'cost' },
      { label: 'Fuel $/ac', vals: totals.map(function (t) { return perAcre('fuel', t); }), fmt: scFmt, higher: false, group: 'cost' },
      { label: 'Labor & OH $/ac', vals: totals.map(function (t) { return perAcre('laborOverhead', t); }), fmt: scFmt, higher: false, group: 'cost' },
      { label: 'Interest $/ac', vals: totals.map(function (t) { return perAcre('interest', t); }), fmt: scFmt, higher: false, group: 'cost' },
      { label: 'Rent $/ac', vals: totals.map(function (t) { return perAcre('rent', t); }), fmt: scFmt, higher: null, group: 'cost' },
      { label: 'Total Cost $/ac', vals: totals.map(function (t) { return perAcre('expTotal', t); }), fmt: scFmt, higher: false, group: 'total', bold: true },
      { label: 'Yield (bu/ac)', vals: totals.map(function (t) { return t.acres > 0 ? Calc.round2(t.totalYield / t.acres) : 0; }), fmt: function (v) { return v.toFixed(1); }, higher: true, group: 'revenue' },
      { label: 'Price ($/bu)', vals: totals.map(function (t, i) { return scenarios[i].pricePerUnit || 0; }), fmt: scFmt, higher: null, group: 'revenue' },
      { label: 'Revenue $/ac', vals: totals.map(function (t) { return perAcre('cropIncome', t); }), fmt: scFmt, higher: true, group: 'revenue' },
      { label: 'Net Profit $/ac', vals: totals.map(function (t) { return perAcre('cropProfit', t); }), fmt: scFmt, higher: true, group: 'profit', bold: true, highlight: true },
      { label: 'Total Net Profit $', vals: totals.map(function (t) { return t.cropProfit; }), fmt: scFmt, higher: true, group: 'profit', bold: true },
    ];

    // Header
    var thCols = labels.map(function (l, i) {
      var colors = ['var(--primary)', 'var(--text)', '#7A9E7E'];
      return '<th style="color:' + colors[i] + '">' + l + '</th>';
    }).join('');
    // Delta columns: A vs B (always), A vs C (if 3 plans)
    var deltaHeaders = '';
    if (scenarios.length >= 2) deltaHeaders += '<th style="font-size:0.78rem">A vs B</th>';
    if (scenarios.length >= 3) deltaHeaders += '<th style="font-size:0.78rem">A vs C</th>';
    document.getElementById('ent-sc-thead').innerHTML =
      '<tr><th>Metric</th>' + thCols + deltaHeaders + '</tr>';

    var groups = { info: '', cost: '', total: '', revenue: '', profit: '' };
    var groupOrder = ['info', 'cost', 'total', 'revenue', 'profit'];

    var tbody = rows.map(function (row) {
      var bestIdx = row.higher !== null ? scBest(row.vals, row.higher) : null;
      var cells = row.vals.map(function (v, i) {
        var formatted = row.fmt(v);
        var isBest = bestIdx === i && row.higher !== null;
        var style = (row.bold ? 'font-weight:600;' : '');
        if (isBest) style += 'color:' + (row.higher ? 'var(--success)' : 'var(--danger)') + ';';
        return '<td style="text-align:right;' + style + '">' + formatted + '</td>';
      }).join('');

      var deltaCells = '';
      if (scenarios.length >= 2) {
        var dAB = row.higher !== null ? Calc.round2(row.vals[0] - row.vals[1]) : null;
        deltaCells += '<td style="text-align:right;font-size:0.82rem">' + (dAB !== null ? scFmtDelta(dAB) : '—') + '</td>';
      }
      if (scenarios.length >= 3) {
        var dAC = row.higher !== null ? Calc.round2(row.vals[0] - row.vals[2]) : null;
        deltaCells += '<td style="text-align:right;font-size:0.82rem">' + (dAC !== null ? scFmtDelta(dAC) : '—') + '</td>';
      }

      var rowStyle = row.highlight ? 'background:var(--highlight);' : '';
      var label = row.bold ? '<strong>' + row.label + '</strong>' : row.label;
      return '<tr style="' + rowStyle + '"><td>' + label + '</td>' + cells + deltaCells + '</tr>';
    }).join('');

    document.getElementById('ent-sc-tbody').innerHTML = tbody;
    document.getElementById('ent-sc-result').classList.remove('hidden');
  }

  document.getElementById('ent-batch-compare').addEventListener('click', function () {
    var config = window.refData.quickPlanConfig || [];
    closeBatchPanels();
    document.getElementById('ent-scenario-panel').classList.remove('hidden');
    var basis = selectedFieldIds.size + ' field' + (selectedFieldIds.size !== 1 ? 's' : '') + ' selected';
    document.getElementById('ent-sc-basis').textContent = basis;
    document.getElementById('ent-sc-result').classList.add('hidden');
    if (config.length === 0) {
      document.getElementById('ent-sc-empty').classList.remove('hidden');
      document.getElementById('ent-sc-selectors').classList.add('hidden');
      document.getElementById('ent-sc-run').classList.add('hidden');
    } else {
      document.getElementById('ent-sc-empty').classList.add('hidden');
      document.getElementById('ent-sc-selectors').classList.remove('hidden');
      document.getElementById('ent-sc-run').classList.remove('hidden');
      scPopulateDropdowns();
    }
  });

  document.getElementById('ent-sc-cancel').addEventListener('click', function () {
    document.getElementById('ent-scenario-panel').classList.add('hidden');
  });

  document.getElementById('ent-sc-run').addEventListener('click', function () {
    var config = window.refData.quickPlanConfig || [];
    var refs = window.refData;
    var settings = refs.settings || {};

    var selectedIds = ['ent-sc-a', 'ent-sc-b', 'ent-sc-c']
      .map(function (id) { return document.getElementById(id).value; })
      .filter(Boolean);

    if (selectedIds.length < 2) { util.showToast('Pick at least 2 plans to compare'); return; }

    var selectedFields = fieldsData.filter(function (f) { return selectedFieldIds.has(f.id); });
    if (!selectedFields.length) { util.showToast('No fields selected — use batch mode to pick fields first'); return; }

    var scenarios = selectedIds.map(function (id, i) {
      var entry = config.find(function (c) { return c.id === id; });
      if (!entry) return null;
      var label = String.fromCharCode(65 + i) + ': ' + entry.crop + (entry.variant ? ' / ' + entry.variant : '') + ' / ' + entry.tillage;
      var summary = scComputeScenario(entry, selectedFields, refs, settings);
      // Compute avg price for display
      var mocked = selectedFields.map(function (f) {
        return scApplyPlanToField(f, entry, refs.programs || [], refs.machineryPrograms || []);
      });
      var priceSum = 0;
      mocked.forEach(function (f) {
        var pricing = Calc.computeFieldBudget(f, refs, settings);
        priceSum += pricing.pricePerUnit || 0;
      });
      var avgPrice = mocked.length ? Calc.round2(priceSum / mocked.length) : 0;
      return { label: label, entry: entry, totals: summary.totals, pricePerUnit: avgPrice };
    }).filter(Boolean);

    if (scenarios.length < 2) { util.showToast('Could not build scenarios — check your config'); return; }

    scRenderTable(scenarios);
  });

  // ── END BATCH MODE ───────────────────────────────────────────────────────────

  // View toggle — scope to enterprise controls only
  var entControls = document.querySelector('.enterprise-controls');
  entControls.querySelectorAll('.toggle-btn[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentView = btn.getAttribute('data-view');
      entControls.querySelectorAll('.toggle-btn[data-view]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      updateViewVisibility();
      renderCurrentView();
    });
  });

  // Sort control
  document.getElementById('ent-sort').addEventListener('change', function () {
    renderCurrentView();
  });

  function sortFields(fields) {
    var mode = document.getElementById('ent-sort').value;
    return fields.slice().sort(function (a, b) {
      if (mode === 'profit') {
        var pa = a._computed ? a._computed.profitPerAcre || 0 : 0;
        var pb = b._computed ? b._computed.profitPerAcre || 0 : 0;
        return pb - pa;
      } else if (mode === 'crop') {
        return (a.crop || '').localeCompare(b.crop || '');
      } else if (mode === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });
  }

  function renderCurrentView() {
    if (!fieldsData.length) return;
    var sorted = sortFields(fieldsData);
    if (currentView === 'cards') renderCards(sorted);
    else if (currentView === 'grid') renderGrid(sorted);
    else if (currentView === 'modules') renderModules(sorted);
  }

  function updateViewVisibility() {
    var cards = document.getElementById('ent-cards');
    var grid = document.getElementById('ent-grid-view');
    var modules = document.getElementById('ent-module-view');
    cards.classList.add('hidden');
    grid.classList.add('hidden');
    modules.classList.add('hidden');
    if (currentView === 'cards') cards.classList.remove('hidden');
    else if (currentView === 'grid') grid.classList.remove('hidden');
    else if (currentView === 'modules') modules.classList.remove('hidden');
  }

  function loadEnterprise(entId) {
    isLoading = true;
    var serial = ++loadSerial;
    var savedScrollY = window.scrollY;
    // Auto-sync acres & rent from farm registry, then load fields
    api.post('/api/fields/sync-registry', {}).then(function () {
      return api.get('/api/fields?enterpriseId=' + entId);
    }).catch(function () {
      // Registry unavailable — load fields with current data
      return api.get('/api/fields?enterpriseId=' + entId);
    }).then(function (fields) {
      if (serial !== loadSerial) return; // stale — a newer request superseded this one
      fieldsData = fields;
      isLoading = false;
      renderSummaryBar(fields);
      renderCurrentView();
      updateViewVisibility();
      window.scrollTo(0, savedScrollY);
    }).catch(function () {
      isLoading = false;
    });
  }

  function renderSummaryBar(fields) {
    var totalAcres = 0;
    var totalExpense = 0;
    var totalIncome = 0;
    var totalProfit = 0;
    var weightedExp = 0;
    var weightedProfit = 0;

    fields.forEach(function (f) {
      var b = f._computed || {};
      var a = b.effectiveAcres !== undefined ? b.effectiveAcres : ((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0);
      totalAcres += a;
      totalExpense += b.expTotal || 0;
      totalIncome += b.cropIncomeTotal || 0;
      totalProfit += b.profitFarmWithoutPayments || 0;
      weightedExp += (b.expPerAcre || 0) * a;
      weightedProfit += (b.profitPerAcre || 0) * a;
    });

    var avgExp = totalAcres > 0 ? weightedExp / totalAcres : 0;
    var avgProfit = totalAcres > 0 ? weightedProfit / totalAcres : 0;

    var profitCls = avgProfit >= 0 ? 'profit-pos' : 'profit-neg';
    var totalProfitCls = totalProfit >= 0 ? 'profit-pos' : 'profit-neg';

    var sumHtml =
      '<div class="summary-item"><span class="summary-label">Fields</span><span class="summary-value">' + fields.length + '</span></div>' +
      '<div class="summary-item"><span class="summary-label">Total Acres</span><span class="summary-value">' + util.formatNum(totalAcres, 1) + '</span></div>';
    if (window.APP_ROLE !== 'operator') {
      sumHtml += '<div class="summary-item"><span class="summary-label">Avg Expense/AC</span><span class="summary-value">' + util.formatMoney(avgExp) + '</span></div>';
    }
    if (window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office') {
      sumHtml +=
        '<div class="summary-item"><span class="summary-label">Avg Profit/AC</span><span class="summary-value ' + profitCls + '">' + util.formatMoney(avgProfit) + '</span></div>' +
        '<div class="summary-item"><span class="summary-label">Total Profit</span><span class="summary-value ' + totalProfitCls + '">' + util.formatMoney(totalProfit, 0) + '</span></div>';
    }
    document.getElementById('ent-summary-bar').innerHTML = sumHtml;
  }

  function renderFieldCard(f) {
    var b = f._computed || {};
    var profitPerAcre = b.profitPerAcre || 0;
    var profitCls = profitPerAcre >= 0 ? 'profit-positive' : 'profit-negative';
    var profitColor = profitPerAcre >= 0 ? 'profit-pos' : 'profit-neg';

    var foBadge = f._fieldops ? ' <span class="fieldops-badge" title="Synced from FieldOps">FO</span>' : '';

    // Abbreviate a program name: drop trailing "Program #", cap at 14 chars
    function abbrevProg(name) {
      return name.replace(/\s*program\s*\d*$/i, '').replace(/\s+/g, ' ').trim().substring(0, 14).trim();
    }
    // Fallback label from crop name when no named program is linked
    function cropLabel(crop) {
      return (crop || 'custom').substring(0, 12).trim();
    }

    var progBadge = '';
    if (f.templateId) {
      var prog = (window.refData.programs || []).find(function (p) { return p.id === f.templateId; });
      if (prog) progBadge = ' <span class="prog-badge" title="Inputs: ' + util.escHtml(prog.name) + '">🧴</span>';
    }
    if (!progBadge && f.inputs && f.inputs.length > 0) {
      progBadge = ' <span class="prog-badge" title="' + f.inputs.length + ' inputs loaded">🧴</span>';
    }

    var machBadge = '';
    if (f.machineryProgramId) {
      var mProg = (window.refData.machineryPrograms || []).find(function (p) { return p.id === f.machineryProgramId; });
      if (mProg) machBadge = ' <span class="mach-prog-badge" title="Machinery: ' + util.escHtml(mProg.name) + '">🚜</span>';
    }
    if (!machBadge && f.machinery && f.machinery.length > 0) {
      machBadge = ' <span class="mach-prog-badge" title="' + f.machinery.length + ' passes loaded">🚜</span>';
    }

    var cbHtml = batchMode
      ? '<input type="checkbox" class="field-select-cb" data-field-id="' + f.id + '"' +
        (selectedFieldIds.has(f.id) ? ' checked' : '') +
        ' style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;flex-shrink:0;margin-right:0.35rem">'
      : '';

    return '<div class="field-card ' + profitCls + (batchMode ? ' batch-selectable' : '') + '" data-field-id="' + f.id + '">' +
      '<div class="field-card-header">' +
        cbHtml +
        '<h4>' + util.escHtml(f.name) + foBadge + progBadge + machBadge + '</h4>' +
        (function () {
          // Use registryCropId for color lookup when available (canonical cross-module ID)
          var cc = typeof CropColors !== 'undefined' ? CropColors.getCropColor(f.crop, f.registryCropId) : '#283828';
          var tc = typeof CropColors !== 'undefined' ? CropColors.textColorFor(cc) : 'var(--text-light)';
          return '<span class="field-crop-badge" style="background:' + cc + ';color:' + tc + '" data-registry-crop-id="' + (f.registryCropId || '') + '">' + util.escHtml(f.crop) + '</span>';
        })() +
      '</div>' +
      '<div class="field-card-metrics">' +
        '<div class="metric"><span class="metric-label">Acres</span><span class="metric-value">' + util.formatNum((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0, 1) + '</span></div>' +
        '<div class="metric"><span class="metric-label">Variety</span><span class="metric-value" style="font-size:0.8rem">' + util.escHtml(f.seeds && f.seeds.length > 1 ? f.seeds.length + ' varieties' : (f.seed ? f.seed.variety || '--' : '--')) + '</span></div>' +
        (window.APP_ROLE !== 'operator' ? '<div class="metric"><span class="metric-label">Expense/AC</span><span class="metric-value">' + util.formatMoney(b.expPerAcre) + '</span></div>' : '') +
        (window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office' ? '<div class="metric"><span class="metric-label">Income/AC</span><span class="metric-value">' + util.formatMoney(b.cropIncomePerAcre) + '</span></div>' : '') +
        (window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office' ? '<div class="metric"><span class="metric-label">Profit/AC</span><span class="metric-value ' + profitColor + '">' + util.formatMoney(profitPerAcre) + '</span></div>' : '') +
        '<div class="metric"><span class="metric-label">Yield/AC</span><span class="metric-value">' + util.formatNum(b.yieldPerAcre, 1) + ' ' + util.escHtml(b.yieldUnit || '') + '</span></div>' +
        (window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office' ? '<div class="metric"><span class="metric-label">COP</span><span class="metric-value">' + util.formatMoney(b.cop) + '</span></div>' : '') +
      '</div>' +
      '<div class="field-card-footer">' +
        '<span>' + util.escHtml(f.systemCode || '') + ' &middot; ' + util.escHtml(f.cropType || '') + '</span>' +
        '<span style="display:inline-flex;gap:0.75rem;align-items:center">' +
          '<span class="field-delete-btn" data-field-id="' + f.id + '" style="color:var(--danger);cursor:pointer">Delete</span>' +
          '<span style="color:var(--blue);cursor:pointer">Edit &rarr;</span>' +
        '</span>' +
      '</div>' +
    '</div>';
  }

  function renderCards(fields) {
    if (!fields.length) {
      document.getElementById('ent-cards').innerHTML = '<p style="color:var(--text-light)">No fields in this enterprise. Click "+ Add Field" to create one.</p>';
      return;
    }

    // Group split fields, keep standalone fields as-is
    var splitGroups = {};
    var standalone = [];
    var groupOrder = [];
    fields.forEach(function (f) {
      if (f.splitGroupId) {
        if (!splitGroups[f.splitGroupId]) {
          splitGroups[f.splitGroupId] = [];
          groupOrder.push(f.splitGroupId);
        }
        splitGroups[f.splitGroupId].push(f);
      } else {
        standalone.push(f);
      }
    });

    var html = '';

    // Render split groups with headers
    groupOrder.forEach(function (sgId) {
      var group = splitGroups[sgId];
      var regName = group[0].registryFieldName || group[0].name;
      var totalAcres = group.reduce(function (sum, f) { return sum + (f.acres || 0); }, 0);
      html += '<div class="split-group-header" style="padding:0.5rem 0.75rem;margin:0.5rem 0 0.25rem;background:#1a2a1a;border:1px solid #2d4a2d;border-radius:4px;font-size:0.8rem;display:flex;align-items:center;gap:0.5rem">' +
        '<span style="color:var(--primary);font-weight:600">' + util.escHtml(regName) + '</span>' +
        '<span style="color:var(--text-light)">' + util.formatNum(totalAcres, 1) + ' ac total</span>' +
        '<span style="color:#888;font-size:0.7rem">(' + group.length + ' sub-fields)</span>' +
      '</div>';
      html += '<div class="split-group-cards" style="padding-left:1rem;border-left:2px solid #2d4a2d;margin-left:0.5rem;margin-bottom:0.75rem">';
      group.forEach(function (f) {
        html += renderFieldCard(f);
      });
      html += '</div>';
    });

    // Render standalone fields
    standalone.forEach(function (f) {
      html += renderFieldCard(f);
    });

    document.getElementById('ent-cards').innerHTML = html;

    // Attach click handlers
    document.querySelectorAll('.field-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (isLoading) return;
        var fid = card.getAttribute('data-field-id');
        if (batchMode) {
          // In batch mode, card click toggles selection (checkbox handles its own clicks)
          if (e.target.classList.contains('field-select-cb')) return;
          if (e.target.classList.contains('field-delete-btn')) return;
          var cb = card.querySelector('.field-select-cb');
          if (cb) {
            cb.checked = !cb.checked;
            if (cb.checked) selectedFieldIds.add(fid);
            else selectedFieldIds.delete(fid);
            updateBatchBar();
          }
          return;
        }
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (field) window.openFieldEditor(field, null, null, null, fieldsData);
      });
    });

    // Checkbox change handler (covers direct checkbox clicks)
    document.querySelectorAll('.field-select-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var fid = cb.getAttribute('data-field-id');
        if (cb.checked) selectedFieldIds.add(fid);
        else selectedFieldIds.delete(fid);
        updateBatchBar();
      });
    });

    // Attach delete handlers
    document.querySelectorAll('.field-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var fid = btn.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (!field) return;
        if (!confirm('Delete "' + field.name + '"? This cannot be undone.')) return;
        fetch('/api/fields/' + fid, { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function () { loadEnterprise(currentEntId); });
      });
    });
  }

  // Helper: get effective acres for a field
  function fieldAcres(f) {
    if (f._computed && f._computed.effectiveAcres !== undefined) return f._computed.effectiveAcres;
    return (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
  }

  // Helper: compute category subtotal for a group of fields
  function catSubtotal(row, catFields) {
    var isPerAcre = row.key.endsWith('PerAcre') || row.key === 'pricePerUnit' || row.key === 'cop';
    if (isPerAcre) {
      var sw = 0, sa = 0;
      catFields.forEach(function (f) {
        var a = fieldAcres(f);
        var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
        sw += (parseFloat(v) || 0) * a;
        sa += a;
      });
      return sa > 0 ? sw / sa : 0;
    } else {
      var sum = 0;
      catFields.forEach(function (f) {
        var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
        sum += parseFloat(v) || 0;
      });
      return sum;
    }
  }

  function renderGrid(fields) {
    if (!fields.length) {
      document.getElementById('ent-thead').innerHTML = '';
      document.getElementById('ent-tbody').innerHTML = '<tr><td>No fields in this enterprise. Click "+ Add Field" to create one.</td></tr>';
      return;
    }

    // Group fields by systemCode — sort to cluster categories
    var codeOrder = {};
    var codeIndex = 0;
    fields.forEach(function (f) {
      var code = f.systemCode || 'OTHER';
      if (!(code in codeOrder)) codeOrder[code] = codeIndex++;
    });
    var sortedFields = fields.slice().sort(function (a, b) {
      var ca = a.systemCode || 'OTHER', cb = b.systemCode || 'OTHER';
      return (codeOrder[ca] || 0) - (codeOrder[cb] || 0);
    });

    // Build category groups: [{code, fields}]
    var categories = [];
    var catMap = {};
    sortedFields.forEach(function (f) {
      var code = f.systemCode || 'OTHER';
      if (!catMap[code]) {
        catMap[code] = { code: code, fields: [] };
        categories.push(catMap[code]);
      }
      catMap[code].fields.push(f);
    });
    var multiCat = categories.length > 1;

    // Total columns: field columns + (category subtotal columns if >1 cat) + grand total
    var totalCols = sortedFields.length + (multiCat ? categories.length : 0) + 2; // +1 label, +1 grand total

    // Build header row
    var thead = '<tr><th>Budget Item</th>';
    categories.forEach(function (cat) {
      cat.fields.forEach(function (f) {
        thead += '<th class="field-name-header" data-field-id="' + f.id + '">' +
          util.escHtml(f.name) + '<br><small>' + util.escHtml(f.crop) + '</small></th>';
      });
      if (multiCat) {
        thead += '<th class="cat-subtotal-header">' + util.escHtml(cat.code) + '</th>';
      }
    });
    thead += '<th class="total-row">TOTALS</th></tr>';
    document.getElementById('ent-thead').innerHTML = thead;

    // Add click handlers on field names
    document.querySelectorAll('.field-name-header').forEach(function (th) {
      th.addEventListener('click', function () {
        var fid = th.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (field) window.openFieldEditor(field, null, null, null, fieldsData);
      });
    });

    // Build body rows
    // Keys hidden for office (no income/profit rows, keep expenses + yield)
    var _officeHideKeys = ['pricePerUnit', 'cropIncomePerAcre', 'cropIncomeTotal', 'govPaymentsPerAcre', 'profitPerAcre', 'profitFarmWithPayments', 'cop'];
    var _officeHideHeaders = ['INCOME', 'PROFIT'];

    var rows = [
      { label: 'Acres', key: 'effectiveAcres', src: 'budget', num: true, dec: 1 },
      { type: 'header', label: 'EXPENSES' },
      { label: 'Rent / AC', key: 'rentPerCropAcre', src: 'budget', num: true, money: true },
      { label: 'Rent Total', key: 'rentTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Spring Fert / AC', key: 'springFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Fall Fert / AC', key: 'fallFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Other Inputs / AC', key: 'unassignedFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Total Fert / AC', key: 'totalFertPerAcre', src: 'budget', num: true, money: true },
      { label: 'Fert Total', key: 'totalFertCost', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Seed / AC', key: 'seedCostPerAcre', src: 'budget', num: true, money: true },
      { label: 'Seed Total', key: 'seedTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Machinery / AC', key: 'machineryPerAcre', src: 'budget', num: true, money: true },
      { label: 'Mach Total', key: 'machineryTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Labor / AC', key: 'laborPerAcre', src: 'budget', num: true, money: true },
      { label: 'Overhead / AC', key: 'overheadPerAcre', src: 'budget', num: true, money: true },
      { label: 'L&O Total', key: 'laborOverheadTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Fuel / AC', key: 'fuelPerAcre', src: 'budget', num: true, money: true },
      { label: 'Fuel Total', key: 'fuelTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Drying / AC', key: 'dryingPerAcre', src: 'budget', num: true, money: true },
      { label: 'Drying Total', key: 'dryingTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Interest / AC', key: 'interestPerAcre', src: 'budget', num: true, money: true },
      { label: 'Interest Total', key: 'interestTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'Crop Ins / AC', key: 'cropInsurancePerAcre', src: 'budget', num: true, money: true },
      { label: 'Ins Total', key: 'cropInsuranceTotal', src: 'budget', num: true, money: true, subtotal: true },
      { label: 'EXP / AC', key: 'expPerAcre', src: 'budget', num: true, money: true, highlight: true },
      { label: 'EXP TOTAL', key: 'expTotal', src: 'budget', num: true, money: true, highlight: true },
      { type: 'header', label: 'INCOME' },
      { label: 'Yield / AC', key: 'yieldPerAcre', src: 'budget', num: true, dec: 1 },
      { label: 'Total Yield', key: 'totalYield', src: 'budget', num: true, dec: 0 },
      { label: 'Price / Unit', key: 'pricePerUnit', src: 'budget', num: true, money: true },
      { label: 'Income / AC', key: 'cropIncomePerAcre', src: 'budget', num: true, money: true },
      { label: 'Income Total', key: 'cropIncomeTotal', src: 'budget', num: true, money: true },
      { label: 'Gov Payments / AC', key: 'govPaymentsPerAcre', src: 'budget', num: true, money: true },
      { type: 'header', label: 'PROFIT' },
      { label: 'Profit / AC', key: 'profitPerAcre', src: 'budget', num: true, money: true, highlight: true, profit: true },
      { label: 'Profit Farm (w/ Payments)', key: 'profitFarmWithPayments', src: 'budget', num: true, money: true, highlight: true, profit: true },
      { label: 'COP', key: 'cop', src: 'budget', num: true, money: true }
    ];

    // Filter rows based on role
    if (window.APP_ROLE === 'operator') {
      // Operators see only Acres, Yield/AC, and Total Yield
      rows = rows.filter(function (r) {
        return r.key === 'effectiveAcres' || r.key === 'yieldPerAcre' || r.key === 'totalYield';
      });
    } else if (window.APP_ROLE === 'office') {
      // Office sees expenses + yield but not income/profit sections
      rows = rows.filter(function (r) {
        if (r.type === 'header' && _officeHideHeaders.indexOf(r.label) !== -1) return false;
        if (r.key && _officeHideKeys.indexOf(r.key) !== -1) return false;
        return true;
      });
    }

    var html = '';
    rows.forEach(function (row) {
      if (row.type === 'header') {
        html += '<tr class="row-group-header"><td colspan="' + totalCols + '">' + row.label + '</td></tr>';
        return;
      }

      var trClasses = [];
      if (row.highlight) trClasses.push('row-highlight');
      if (row.subtotal) trClasses.push('row-subtotal');
      var cls = trClasses.length ? ' class="' + trClasses.join(' ') + '"' : '';
      html += '<tr' + cls + '><td class="row-label">' + row.label + '</td>';

      var grandTotal = 0;
      var isPerAcre = row.key.endsWith('PerAcre') || row.key === 'pricePerUnit' || row.key === 'cop';

      // Render field cells grouped by category, with subtotal column after each group
      categories.forEach(function (cat) {
        cat.fields.forEach(function (f) {
          var val;
          if (row.src === 'field') {
            val = f[row.key];
          } else {
            val = f._computed ? f._computed[row.key] : '';
          }

          var cellContent;
          if (row.money) {
            cellContent = util.formatMoney(val);
          } else if (row.num) {
            cellContent = util.formatNum(val, row.dec !== undefined ? row.dec : 2);
          } else {
            cellContent = util.escHtml(String(val || ''));
          }

          var profitCls = row.profit ? ' ' + util.profitClass(val) : '';
          html += '<td class="number' + profitCls + '">' + cellContent + '</td>';
        });

        // Category subtotal column
        if (multiCat && row.num) {
          var sv = catSubtotal(row, cat.fields);
          var formatted = row.money ? util.formatMoney(sv, isPerAcre ? undefined : 0) : util.formatNum(sv, row.dec || (isPerAcre ? 2 : 0));
          var profitCls4 = row.profit ? ' ' + util.profitClass(sv) : '';
          html += '<td class="number bold cat-subtotal-cell' + profitCls4 + '">' + formatted + '</td>';
        } else if (multiCat) {
          html += '<td class="cat-subtotal-cell"></td>';
        }
      });

      // Grand totals column
      if (row.num) {
        var grandVal;
        if (isPerAcre) {
          var sw = 0, sa = 0;
          sortedFields.forEach(function (f) {
            var a = fieldAcres(f);
            var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
            sw += (parseFloat(v) || 0) * a;
            sa += a;
          });
          grandVal = sa > 0 ? sw / sa : 0;
          var formatted2 = row.money ? util.formatMoney(grandVal) : util.formatNum(grandVal, row.dec || 2);
          var profitCls5 = row.profit ? ' ' + util.profitClass(grandVal) : '';
          html += '<td class="number bold' + profitCls5 + '">' + formatted2 + '</td>';
        } else {
          sortedFields.forEach(function (f) {
            var v = row.src === 'field' ? f[row.key] : (f._computed ? f._computed[row.key] : 0);
            grandTotal += parseFloat(v) || 0;
          });
          var formatted3 = row.money ? util.formatMoney(grandTotal, 0) : util.formatNum(grandTotal, row.dec || 0);
          var profitCls6 = row.profit ? ' ' + util.profitClass(grandTotal) : '';
          html += '<td class="number bold' + profitCls6 + '">' + formatted3 + '</td>';
        }
      } else {
        html += '<td></td>';
      }

      html += '</tr>';
    });

    document.getElementById('ent-tbody').innerHTML = html;
  }

  // === MODULE VIEW ===
  function renderModules(fields) {
    var container = document.getElementById('ent-module-view');
    if (!fields.length) {
      container.innerHTML = '<p style="color:var(--text-light);padding:2rem">No fields in this enterprise.</p>';
      return;
    }

    var html = '<div class="module-fields-list">';
    fields.forEach(function (f) {
      var b = f._computed || {};
      var profitCls = util.profitClass(b.profitPerAcre || 0);
      // COP coloring: red when COP > price (losing money), green when profitable
      var copCls = (b.cop || 0) > 0 ? (b.cop > (b.pricePerUnit || 0) ? 'profit-neg' : 'profit-pos') : '';

      html += '<div class="module-field-card" data-field-id="' + f.id + '">';

      // Header
      html += '<div class="module-field-header">';
      html += '<div class="module-field-name">' + util.escHtml(f.name) + '</div>';
      html += (function () {
            var cc = typeof CropColors !== 'undefined' ? CropColors.getCropColor(f.crop) : '#283828';
            var tc = typeof CropColors !== 'undefined' ? CropColors.textColorFor(cc) : 'var(--text-light)';
            return '<span class="field-crop-badge" style="background:' + cc + ';color:' + tc + '">' + util.escHtml(f.crop) + '</span>';
          })();
      if (f.templateId) {
        var mProg = (window.refData.programs || []).find(function (p) { return p.id === f.templateId; });
        if (mProg) html += '<span class="prog-badge">' + util.escHtml(mProg.name) + '</span>';
      }
      html += '<span class="module-field-acres">' + util.formatNum((f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0, 1) + ' ac</span>';
      html += '<span class="module-field-code">' + util.escHtml(f.systemCode || '') + '</span>';
      html += '</div>';

      // Module grid: 3 columns x 2 rows + full-width bottom
      html += '<div class="module-grid">';

      // Row 1: Land & Rent | Seed | Fertilizer
      // Land & Rent
      html += '<div class="mod-card mod-land">';
      html += '<div class="mod-header">Land & Rent</div>';
      html += '<div class="mod-row"><span>Rent/AC</span><span>' + util.formatMoney(b.rentPerCropAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Rent Total</span><span>' + util.formatMoney(b.rentTotal) + '</span></div>';
      html += '</div>';

      // Seed (supports multi-variety)
      html += '<div class="mod-card mod-seed">';
      html += '<div class="mod-header">Seed</div>';
      var seedEntries = f.seeds && f.seeds.length > 0 ? f.seeds : (f.seed ? [f.seed] : []);
      if (seedEntries.length === 0) {
        html += '<div class="mod-row"><span>Variety</span><span>--</span></div>';
      } else {
        seedEntries.forEach(function (se) {
          var label = se.variety || '--';
          if (se.acres > 0) label += ' (' + util.formatNum(se.acres, 1) + 'ac)';
          html += '<div class="mod-row"><span class="mod-val-sm">' + util.escHtml(label) + '</span><span>' + util.formatNum(se.population || 0, 0) + ' pop</span></div>';
        });
      }
      html += '<div class="mod-row"><span>Cost/AC</span><span>' + util.formatMoney(b.seedCostPerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total</span><span>' + util.formatMoney(b.seedTotal) + '</span></div>';
      html += '</div>';

      // Fertilizer
      html += '<div class="mod-card mod-fert">';
      html += '<div class="mod-header">Fertilizer</div>';
      html += '<div class="mod-row"><span>Spring/AC</span><span>' + util.formatMoney(b.springFertPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Fall/AC</span><span>' + util.formatMoney(b.fallFertPerAcre) + '</span></div>';
      if (b.unassignedFertPerAcre > 0) {
        html += '<div class="mod-row"><span>Other/AC</span><span>' + util.formatMoney(b.unassignedFertPerAcre) + '</span></div>';
      }
      html += '<div class="mod-row mod-total"><span>Total/AC</span><span>' + util.formatMoney(b.totalFertPerAcre) + '</span></div>';
      html += '</div>';

      // Row 2: Machinery | Labor & Overhead | Other Costs
      // Machinery
      html += '<div class="mod-card mod-mach">';
      html += '<div class="mod-header">Machinery</div>';
      (b.machineryDetails || []).forEach(function (md) {
        var hireTag = md.isHire ? ' <small style="opacity:0.7">(hire)</small>' : '';
        html += '<div class="mod-row mod-row-sm">' +
          '<span>' + util.escHtml(md.implementName) + ' ' + md.passes + '×' + hireTag + '</span>' +
          '<span>' + util.formatMoney(md.costPerAcre) + '</span></div>';
      });
      html += '<div class="mod-row"><span>Fuel</span><span>' + util.formatNum(b.fuelGallonsPerAcre, 1) + ' gal · ' + util.formatMoney(b.fuelPerAcre) + '/AC</span></div>';
      html += '<div class="mod-row mod-total"><span>Total/AC</span><span>' + util.formatMoney((b.machineryPerAcre || 0) + (b.fuelPerAcre || 0)) + '</span></div>';
      html += '</div>';

      // Labor & Overhead
      html += '<div class="mod-card mod-labor">';
      html += '<div class="mod-header">Labor & Overhead</div>';
      if (b.laborHoursPerAcre > 0) {
        html += '<div class="mod-row"><span>Hours/AC</span><span>' + util.formatNum(b.laborHoursPerAcre, 2) + '</span></div>';
      }
      html += '<div class="mod-row"><span>Labor/AC</span><span>' + util.formatMoney(b.laborPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Overhead/AC</span><span>' + util.formatMoney(b.overheadPerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total/AC</span><span>' + util.formatMoney((b.laborPerAcre || 0) + (b.overheadPerAcre || 0)) + '</span></div>';
      html += '</div>';

      // Other Costs
      html += '<div class="mod-card mod-other">';
      html += '<div class="mod-header">Other Costs</div>';
      html += '<div class="mod-row"><span>Drying/AC</span><span>' + util.formatMoney(b.dryingPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Interest/AC</span><span>' + util.formatMoney(b.interestPerAcre) + '</span></div>';
      html += '<div class="mod-row"><span>Crop Ins/AC</span><span>' + util.formatMoney(b.cropInsurancePerAcre) + '</span></div>';
      html += '<div class="mod-row mod-total"><span>Total</span><span>' + util.formatMoney((b.dryingPerAcre || 0) + (b.interestPerAcre || 0) + (b.cropInsurancePerAcre || 0)) + '</span></div>';
      html += '</div>';

      // Full-width: Income & Profit (filtered by role)
      html += '<div class="mod-card mod-income" style="grid-column:1/-1">';
      html += '<div class="mod-header">' + (window.APP_ROLE === 'office' ? 'Yield' : (window.APP_ROLE === 'operator' ? 'Yield' : 'Income & Profit')) + '</div>';
      html += '<div class="mod-income-row">';
      html += '<div class="mod-income-item"><span class="mod-income-label">Yield/AC</span><span class="mod-income-val">' + util.formatNum(b.yieldPerAcre, 1) + ' ' + util.escHtml(b.yieldUnit || 'Bu') + '</span></div>';
      if (window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office') {
        html += '<div class="mod-income-item"><span class="mod-income-label">Price</span><span class="mod-income-val">' + util.formatMoney(b.pricePerUnit) + '</span></div>';
        html += '<div class="mod-income-item"><span class="mod-income-label">Income/AC</span><span class="mod-income-val">' + util.formatMoney(b.cropIncomePerAcre) + '</span></div>';
      }
      if (window.APP_ROLE !== 'operator') {
        html += '<div class="mod-income-item"><span class="mod-income-label">EXP/AC</span><span class="mod-income-val">' + util.formatMoney(b.expPerAcre) + '</span></div>';
      }
      if (window.APP_ROLE !== 'operator' && window.APP_ROLE !== 'office') {
        html += '<div class="mod-income-item"><span class="mod-income-label">Profit/AC</span><span class="mod-income-val ' + profitCls + '" style="font-weight:700">' + util.formatMoney(b.profitPerAcre) + '</span></div>';
        html += '<div class="mod-income-item"><span class="mod-income-label">COP</span><span class="mod-income-val ' + copCls + '">' + util.formatMoney(b.cop) + '</span></div>';
      }
      html += '</div>';
      html += '</div>';

      html += '</div>'; // module-grid
      html += '</div>'; // module-field-card
    });

    html += '</div>'; // module-fields-list
    container.innerHTML = html;

    // Click handlers
    container.querySelectorAll('.module-field-header').forEach(function (header) {
      header.style.cursor = 'pointer';
      header.addEventListener('click', function () {
        var card = header.closest('.module-field-card');
        var fid = card.getAttribute('data-field-id');
        var field = fieldsData.find(function (f) { return f.id === fid; });
        if (field) window.openFieldEditor(field, null, null, null, fieldsData);
      });
    });
  }

  // Expose reload for field editor
  window.reloadEnterprise = function () {
    if (currentEntId) loadEnterprise(currentEntId);
  };
})();
