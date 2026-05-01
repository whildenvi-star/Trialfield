// Programs Manager — agronomic template CRUD + deploy
(function () {
  'use strict';

  var allPrograms = [];
  var allFields = [];
  var currentProgram = null;
  var isNewProgram = false;
  var bulkProgId = null;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'programs') loadPrograms();
  });

  function loadPrograms() {
    Promise.all([
      api.get('/api/programs'),
      api.get('/api/fields?all=true')
    ]).then(function (results) {
      allPrograms = results[0];
      allFields = results[1];
      window.refData.programs = allPrograms;
      renderProgramCards(allPrograms);
      renderSuggestions(allPrograms, allFields);
      document.getElementById('prog-count').textContent = allPrograms.length + ' programs';
    });
  }

  // ========================
  // SUGGESTIONS
  // ========================
  function renderSuggestions(programs, fields) {
    var container = document.getElementById('prog-suggestions');
    if (!container) return;

    var enterprises = window.refData.enterprises || [];
    if (!enterprises.length) { container.innerHTML = ''; return; }

    var suggestions = [];

    // 1. Enterprise/crop combos without a matching program
    var progKeys = {};
    programs.forEach(function (p) {
      progKeys[(p.systemCode || '').toLowerCase() + '|' + (p.crop || '').toLowerCase()] = p;
    });

    var entCropCounts = {};
    fields.forEach(function (f) {
      if (!f.crop || !f.systemCode) return;
      var key = f.systemCode.toLowerCase() + '|' + f.crop.toLowerCase();
      if (!entCropCounts[key]) entCropCounts[key] = { crop: f.crop, systemCode: f.systemCode, count: 0, acres: 0 };
      entCropCounts[key].count++;
      entCropCounts[key].acres += f.acres || 0;
    });

    Object.keys(entCropCounts).forEach(function (key) {
      if (!progKeys[key]) {
        var info = entCropCounts[key];
        suggestions.push({
          type: 'create',
          text: 'Create a program for ' + info.crop + ' (' + info.systemCode + ')',
          detail: info.count + ' fields, ' + util.formatNum(info.acres, 0) + ' acres',
          crop: info.crop,
          systemCode: info.systemCode
        });
      }
    });

    // 2. Programs that could be deployed to unlinked matching fields
    programs.forEach(function (prog) {
      var unlinked = fields.filter(function (f) {
        return !f.templateId &&
          f.crop && f.crop.toLowerCase() === (prog.crop || '').toLowerCase() &&
          f.systemCode && f.systemCode.toLowerCase() === (prog.systemCode || '').toLowerCase();
      });
      if (unlinked.length > 0) {
        suggestions.push({
          type: 'deploy',
          text: 'Deploy "' + prog.name + '" to ' + unlinked.length + ' unlinked ' + prog.crop + ' field' + (unlinked.length !== 1 ? 's' : ''),
          detail: util.formatNum(unlinked.reduce(function (s, f) { return s + (f.acres || 0); }, 0), 0) + ' acres unlinked',
          progId: prog.id
        });
      }
    });

    if (!suggestions.length) { container.innerHTML = ''; return; }

    var html = '<div class="prog-suggest-panel">';
    html += '<h4 class="prog-suggest-toggle" style="margin:0;font-size:0.9rem;color:var(--text-light);cursor:pointer;user-select:none">' +
      '<span class="prog-suggest-arrow" style="display:inline-block;transition:transform 0.2s;margin-right:0.3rem;font-size:0.7rem">&#9654;</span>' +
      'Suggestions <span style="font-size:0.78rem;opacity:0.7">(' + suggestions.length + ')</span></h4>';
    html += '<div class="prog-suggest-body" style="display:none;margin-top:0.5rem">';
    suggestions.forEach(function (s) {
      html += '<div class="prog-suggest-item" data-type="' + s.type + '"' +
        (s.progId ? ' data-prog-id="' + s.progId + '"' : '') +
        (s.crop ? ' data-crop="' + util.escHtml(s.crop) + '"' : '') +
        (s.systemCode ? ' data-system-code="' + util.escHtml(s.systemCode) + '"' : '') +
        '>';
      html += '<span class="prog-suggest-icon">' + (s.type === 'create' ? '+' : '&#8674;') + '</span>';
      html += '<span class="prog-suggest-text">' + util.escHtml(s.text) + '</span>';
      html += '<span class="prog-suggest-detail">' + util.escHtml(s.detail) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    container.innerHTML = html;

    // Toggle suggestions collapse
    var toggle = container.querySelector('.prog-suggest-toggle');
    var body = container.querySelector('.prog-suggest-body');
    var arrow = container.querySelector('.prog-suggest-arrow');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(90deg)';
      });
    }

    // Wire click handlers
    container.querySelectorAll('.prog-suggest-item').forEach(function (item) {
      item.addEventListener('click', function () {
        if (item.getAttribute('data-type') === 'create') {
          var newProg = {
            name: item.getAttribute('data-crop') + ' (' + item.getAttribute('data-system-code') + ')',
            description: '', crop: item.getAttribute('data-crop'),
            systemCode: item.getAttribute('data-system-code'),
            cropType: 'SINGLE CROP', inputs: [], seed: null, machinery: [],
            yieldPerAcre: 0, yieldUnit: 'Bu', cropInsurancePerAcre: 0,
            harvestMoisture: 0, buyerId: ''
          };
          openProgramEditor(newProg);
        } else if (item.getAttribute('data-type') === 'deploy') {
          openBulkDeploy(item.getAttribute('data-prog-id'));
        }
      });
    });
  }

  // ========================
  // PROGRAM CARDS
  // ========================
  function renderProgramCards(programs) {
    var container = document.getElementById('prog-cards');
    if (!programs.length) {
      container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-light)">' +
        '<p style="font-size:1.1rem;margin-bottom:0.5rem">No programs yet</p>' +
        '<p style="font-size:0.85rem">Create a program to define a reusable agronomic package, or save one from an existing field in the field editor.</p>' +
        '</div>';
      return;
    }

    var refs = {
      products: window.refData.products,
      implements: window.refData.implements,
      cropPricing: window.refData.cropPricing,
      cropTypes: window.refData.cropTypes,
      laborOverhead: window.refData.laborOverhead,
      seeds: window.refData.seeds,
      buyers: window.refData.buyers || []
    };

    var html = '';
    programs.forEach(function (prog) {
      var linkedCount = allFields.filter(function (f) { return f.templateId === prog.id; }).length;

      // Compute budget preview via pseudo-field (1 acre, no rent)
      var pseudoField = {
        acres: 1, rentPerAcre: 0, crop: prog.crop, systemCode: prog.systemCode,
        cropType: prog.cropType, inputs: prog.inputs || [], seed: prog.seed,
        machinery: prog.machinery || [], yieldPerAcre: prog.yieldPerAcre || 0,
        yieldUnit: prog.yieldUnit || 'Bu', cropInsurancePerAcre: prog.cropInsurancePerAcre || 0,
        harvestMoisture: prog.harvestMoisture || 0, buyerId: prog.buyerId || '',
        insuranceIncomePerAcre: 0, govPaymentsPerAcre: 0, tariffsPerAcre: 0
      };
      var budget = Calc.computeFieldBudget(pseudoField, refs, window.refData.settings);

      html += '<div class="prog-card" data-prog-id="' + prog.id + '">' +
        '<div class="prog-card-header">' +
          '<h4>' + util.escHtml(prog.name) + '</h4>' +
          '<span class="field-crop-badge">' + util.escHtml(prog.crop || '--') + '</span>' +
          '<span style="font-size:0.75rem;opacity:0.7">' + util.escHtml(prog.systemCode || '') + '</span>' +
        '</div>' +
        '<div class="prog-card-body">' +
          '<div class="prog-stat"><span>Inputs</span><span>' + (prog.inputs || []).length + '</span></div>' +
          '<div class="prog-stat"><span>Machinery</span><span>' + (prog.machinery || []).length + '</span></div>' +
          '<div class="prog-stat"><span>Seed</span><span>' + (prog.seed ? util.escHtml(prog.seed.variety || '--') : '--') + '</span></div>' +
          '<div class="prog-stat"><span>Yield Target</span><span>' + util.formatNum(prog.yieldPerAcre, 0) + ' ' + util.escHtml(prog.yieldUnit || 'Bu') + '</span></div>' +
          '<div class="prog-stat"><span>Est. EXP/AC</span><span>' + util.formatMoney(budget.expPerAcre) + '</span></div>' +
          '<div class="prog-stat"><span>Linked Fields</span><span>' + linkedCount + '</span></div>' +
        '</div>' +
        (prog.description ? '<div style="padding:0 1rem 0.5rem;font-size:0.8rem;color:var(--text-light)">' + util.escHtml(prog.description) + '</div>' : '') +
        '<div class="prog-card-actions">' +
          '<button class="btn-sm prog-edit" data-prog-id="' + prog.id + '">Edit</button>' +
          '<button class="btn-sm prog-deploy" data-prog-id="' + prog.id + '">Deploy</button>' +
          '<button class="btn-danger prog-delete" data-prog-id="' + prog.id + '" style="font-size:0.75rem">Del</button>' +
        '</div>' +
      '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.prog-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var prog = allPrograms.find(function (p) { return p.id === btn.getAttribute('data-prog-id'); });
        if (prog) openProgramEditor(prog);
      });
    });

    container.querySelectorAll('.prog-deploy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openBulkDeploy(btn.getAttribute('data-prog-id'));
      });
    });

    container.querySelectorAll('.prog-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this program? Linked fields will keep their data but lose the program reference.')) return;
        api.del('/api/programs/' + btn.getAttribute('data-prog-id')).then(function () {
          loadPrograms();
          util.showToast('Program deleted');
        });
      });
    });
  }

  document.getElementById('prog-add').addEventListener('click', function () {
    openProgramEditor(null);
  });

  // ========================
  // PROGRAM EDITOR OVERLAY
  // ========================
  var overlay = document.getElementById('program-editor-overlay');

  function openProgramEditor(prog) {
    if (prog && prog.id) {
      currentProgram = JSON.parse(JSON.stringify(prog));
      isNewProgram = false;
      document.getElementById('prog-editor-title').textContent = 'Edit: ' + prog.name;
    } else {
      currentProgram = {
        name: '', description: '', crop: '', systemCode: 'CON',
        cropType: 'SINGLE CROP', inputs: [], seed: null, machinery: [],
        yieldPerAcre: 0, yieldUnit: 'Bu', cropInsurancePerAcre: 0,
        harvestMoisture: 0, buyerId: ''
      };
      // Merge pre-filled fields from suggestion
      if (prog) {
        Object.keys(prog).forEach(function (k) { currentProgram[k] = prog[k]; });
      }
      isNewProgram = true;
      document.getElementById('prog-editor-title').textContent = 'New Program';
    }
    populateProgramForm();
    updateProgramPreview();
    overlay.style.display = 'flex';
    requestAnimationFrame(function () { overlay.classList.add('visible'); });
  }

  // Expose for external use (from field editor "Save as Program")
  window.openProgramEditor = openProgramEditor;

  function closeProgramEditor() {
    overlay.classList.remove('visible');
    setTimeout(function () { overlay.style.display = 'none'; }, 350);
    currentProgram = null;
  }

  document.getElementById('prog-editor-close').addEventListener('click', closeProgramEditor);
  document.getElementById('prog-editor-cancel').addEventListener('click', closeProgramEditor);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeProgramEditor(); });

  function populateProgramForm() {
    var p = currentProgram;
    document.getElementById('ped-name').value = p.name || '';
    document.getElementById('ped-description').value = p.description || '';
    document.getElementById('ped-systemCode').value = p.systemCode || 'CON';
    document.getElementById('ped-crop').value = p.crop || '';
    document.getElementById('ped-cropType').value = p.cropType || 'SINGLE CROP';
    document.getElementById('ped-yield').value = p.yieldPerAcre || '';
    document.getElementById('ped-yieldUnit').value = p.yieldUnit || 'Bu';
    document.getElementById('ped-cropIns').value = p.cropInsurancePerAcre || '';
    document.getElementById('ped-harvestMoisture').value = p.harvestMoisture || '';

    // Buyer dropdown
    var buyerSelect = document.getElementById('ped-buyer');
    buyerSelect.innerHTML = '<option value="">-- none --</option>';
    (window.refData.buyers || []).forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      if (b.id === p.buyerId) opt.selected = true;
      buyerSelect.appendChild(opt);
    });

    // Seed
    document.getElementById('ped-seed-variety').value = p.seed ? p.seed.variety || '' : '';
    document.getElementById('ped-seed-pop').value = p.seed ? p.seed.population || '' : '';

    renderProgInputRows();
    renderProgMachRows();
  }

  // --- Input Products Table ---
  function renderProgInputRows() {
    var tbody = document.getElementById('ped-inputs-tbody');
    var html = '';
    (currentProgram.inputs || []).forEach(function (inp, idx) {
      var product = window.refData.products.find(function (p) {
        return p.name.toLowerCase() === (inp.productName || '').toLowerCase();
      });
      var appPrice = product ? Calc.computeApplicationPrice(product) : 0;
      var cost = (inp.quantity || 0) * appPrice;

      html += '<tr>' +
        '<td><input type="text" value="' + util.escHtml(inp.productName) + '" data-idx="' + idx + '" data-field="productName" class="ped-inp-field" list="prod-search-list" style="width:180px"></td>' +
        '<td><input type="number" value="' + (inp.quantity || '') + '" data-idx="' + idx + '" data-field="quantity" class="ped-inp-field" step="0.1" min="0" style="width:70px"></td>' +
        '<td><select data-idx="' + idx + '" data-field="season" class="ped-inp-field" style="width:80px">' +
          '<option value=""' + (!inp.season ? ' selected' : '') + '>--</option>' +
          '<option value="Spring"' + (inp.season === 'Spring' ? ' selected' : '') + '>Spring</option>' +
          '<option value="Fall"' + (inp.season === 'Fall' ? ' selected' : '') + '>Fall</option>' +
        '</select></td>' +
        '<td class="number">' + util.formatMoney(cost) + '</td>' +
        '<td><button class="btn-danger ped-remove-inp" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll('.ped-inp-field').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        var val = el.value;
        if (field === 'quantity') val = parseFloat(val) || 0;
        currentProgram.inputs[idx][field] = val;
        renderProgInputRows();
        updateProgramPreview();
      });
    });

    tbody.querySelectorAll('.ped-remove-inp').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentProgram.inputs.splice(parseInt(btn.getAttribute('data-idx')), 1);
        renderProgInputRows();
        updateProgramPreview();
      });
    });
  }

  document.getElementById('ped-add-input').addEventListener('click', function () {
    if (!currentProgram) return;
    currentProgram.inputs.push({ id: util.generateId('inp'), productName: '', quantity: 0, season: 'Spring' });
    renderProgInputRows();
  });

  // --- Machinery Table ---
  function renderProgMachRows() {
    var tbody = document.getElementById('ped-mach-tbody');
    var html = '';
    (currentProgram.machinery || []).forEach(function (m, idx) {
      var impl = window.refData.implements.find(function (i) {
        return i.name.toLowerCase() === (m.implementName || '').toLowerCase();
      });
      var useHire = m.useHire !== undefined ? m.useHire :
        (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0);
      var cost;
      if (useHire && impl && impl.customHireRate > 0) {
        cost = impl.customHireRate * (m.passes || 1);
      } else {
        cost = impl ? impl.costPerAcre * (m.passes || 1) : 0;
      }
      var hasHireOption = impl && impl.customHireRate > 0;
      var modeLabel = useHire ? 'Hire' : 'Own';
      var modeCls = useHire ? 'status-open' : 'status-done';

      html += '<tr>' +
        '<td><input type="text" value="' + util.escHtml(m.implementName) + '" data-idx="' + idx + '" data-field="implementName" class="ped-mach-field" list="impl-search-list" style="width:150px"></td>' +
        '<td><input type="number" value="' + (m.passes || '') + '" data-idx="' + idx + '" data-field="passes" class="ped-mach-field" step="0.1" min="0" style="width:60px"></td>' +
        '<td class="number">' + util.formatMoney(cost) + '</td>' +
        (hasHireOption ?
          '<td class="ped-mach-mode" data-idx="' + idx + '"><span class="status-badge ' + modeCls + '" style="font-size:0.7rem">' + modeLabel + '</span></td>' :
          '<td></td>') +
        '<td><button class="btn-danger ped-remove-mach" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll('.ped-mach-field').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        var val = el.value;
        if (field === 'passes') val = parseFloat(val) || 0;
        currentProgram.machinery[idx][field] = val;
        renderProgMachRows();
        updateProgramPreview();
      });
    });

    tbody.querySelectorAll('.ped-mach-mode').forEach(function (td) {
      td.addEventListener('click', function () {
        var idx = parseInt(td.getAttribute('data-idx'));
        var m = currentProgram.machinery[idx];
        var impl = window.refData.implements.find(function (i) {
          return i.name.toLowerCase() === (m.implementName || '').toLowerCase();
        });
        var currentlyHire = m.useHire !== undefined ? m.useHire :
          (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0);
        m.useHire = !currentlyHire;
        renderProgMachRows();
        updateProgramPreview();
      });
    });

    tbody.querySelectorAll('.ped-remove-mach').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentProgram.machinery.splice(parseInt(btn.getAttribute('data-idx')), 1);
        renderProgMachRows();
        updateProgramPreview();
      });
    });
  }

  document.getElementById('ped-add-mach').addEventListener('click', function () {
    if (!currentProgram) return;
    currentProgram.machinery.push({ id: util.generateId('mach'), implementName: '', passes: 1 });
    renderProgMachRows();
  });

  // --- Live Preview ---
  var previewFields = [
    'ped-name', 'ped-systemCode', 'ped-crop', 'ped-cropType', 'ped-yield',
    'ped-yieldUnit', 'ped-cropIns', 'ped-harvestMoisture', 'ped-buyer',
    'ped-seed-variety', 'ped-seed-pop'
  ];
  previewFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', syncProgAndPreview);
      el.addEventListener('change', syncProgAndPreview);
    }
  });

  function syncProgAndPreview() {
    if (!currentProgram) return;
    currentProgram.name = document.getElementById('ped-name').value;
    currentProgram.description = document.getElementById('ped-description').value;
    currentProgram.systemCode = document.getElementById('ped-systemCode').value;
    currentProgram.crop = document.getElementById('ped-crop').value;
    currentProgram.cropType = document.getElementById('ped-cropType').value;
    currentProgram.yieldPerAcre = parseFloat(document.getElementById('ped-yield').value) || 0;
    currentProgram.yieldUnit = document.getElementById('ped-yieldUnit').value;
    currentProgram.cropInsurancePerAcre = parseFloat(document.getElementById('ped-cropIns').value) || 0;
    currentProgram.harvestMoisture = parseFloat(document.getElementById('ped-harvestMoisture').value) || 0;
    currentProgram.buyerId = document.getElementById('ped-buyer').value || '';

    var seedVar = document.getElementById('ped-seed-variety').value.trim();
    var seedPop = parseFloat(document.getElementById('ped-seed-pop').value) || 0;
    currentProgram.seed = seedVar ? { variety: seedVar, population: seedPop } : null;

    updateProgramPreview();
  }

  function updateProgramPreview() {
    if (!currentProgram) return;
    var refs = {
      products: window.refData.products,
      implements: window.refData.implements,
      cropPricing: window.refData.cropPricing,
      cropTypes: window.refData.cropTypes,
      laborOverhead: window.refData.laborOverhead,
      seeds: window.refData.seeds,
      buyers: window.refData.buyers || []
    };
    var pseudoField = {
      acres: 1, rentPerAcre: 0, crop: currentProgram.crop,
      systemCode: currentProgram.systemCode, cropType: currentProgram.cropType,
      inputs: currentProgram.inputs, seed: currentProgram.seed,
      machinery: currentProgram.machinery,
      yieldPerAcre: currentProgram.yieldPerAcre, yieldUnit: currentProgram.yieldUnit,
      cropInsurancePerAcre: currentProgram.cropInsurancePerAcre,
      harvestMoisture: currentProgram.harvestMoisture, buyerId: currentProgram.buyerId,
      insuranceIncomePerAcre: 0, govPaymentsPerAcre: 0, tariffsPerAcre: 0
    };
    var budget = Calc.computeFieldBudget(pseudoField, refs, window.refData.settings);

    var items = [
      { label: 'Spring Fert / AC', val: budget.springFertPerAcre },
      { label: 'Fall Fert / AC', val: budget.fallFertPerAcre },
      { label: 'Total Fert / AC', val: budget.totalFertPerAcre },
      { label: 'Seed / AC', val: budget.seedCostPerAcre },
      { label: 'Machinery / AC', val: budget.machineryPerAcre },
      { label: 'Labor / AC', val: budget.laborPerAcre },
      { label: 'Overhead / AC', val: budget.overheadPerAcre },
      { label: 'Fuel / AC (' + budget.fuelGallonsPerAcre + ' gal)', val: budget.fuelPerAcre },
      { label: 'Drying / AC', val: budget.dryingPerAcre },
      { label: 'Interest / AC', val: budget.interestPerAcre },
      { label: 'Insurance / AC', val: budget.cropInsurancePerAcre },
      { label: 'EXP / AC (excl. rent)', val: budget.expPerAcre, cls: 'highlight' },
      { label: 'Income / AC', val: budget.cropIncomePerAcre },
      { label: 'COP (excl. rent)', val: budget.cop }
    ];

    var html = items.map(function (item) {
      return '<div><span class="label">' + item.label + ':</span></div>' +
        '<div class="' + (item.cls || '') + '">' + util.formatMoney(item.val) + '</div>';
    }).join('');

    document.getElementById('ped-preview-grid').innerHTML = html;
  }

  // --- Save Program ---
  document.getElementById('prog-editor-save').addEventListener('click', function () {
    if (!currentProgram) return;
    syncProgAndPreview();

    if (!currentProgram.name.trim()) {
      util.showToast('Please enter a program name');
      return;
    }

    var toSave = JSON.parse(JSON.stringify(currentProgram));
    delete toSave._computed;

    var promise;
    if (isNewProgram) {
      promise = api.post('/api/programs', toSave);
    } else {
      promise = api.put('/api/programs/' + toSave.id, toSave);
    }

    promise.then(function () {
      util.showToast(isNewProgram ? 'Program created!' : 'Program saved!');
      closeProgramEditor();
      loadPrograms();
      window.reloadRefData();
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
    });
  });

  // ========================
  // BULK DEPLOY
  // ========================
  function openBulkDeploy(progId) {
    bulkProgId = progId;
    var prog = allPrograms.find(function (p) { return p.id === progId; });
    if (!prog) return;

    document.getElementById('prog-bulk-title').textContent = 'Deploy: ' + prog.name;
    document.getElementById('prog-bulk-panel').classList.remove('hidden');

    // Populate enterprise filter
    var entSelect = document.getElementById('prog-bulk-enterprise');
    entSelect.innerHTML = '<option value="">All Enterprises</option>';
    (window.refData.enterprises || []).forEach(function (e) {
      entSelect.innerHTML += '<option value="' + e.id + '">' + util.escHtml(e.name) + '</option>';
    });

    renderBulkFieldList('');

    // Count linked fields for the "Push to Linked" button
    var linkedCount = allFields.filter(function (f) { return f.templateId === progId; }).length;
    var linkedBtn = document.getElementById('prog-bulk-linked');
    linkedBtn.textContent = 'Push to ' + linkedCount + ' Linked';
    linkedBtn.style.display = linkedCount > 0 ? '' : 'none';
  }

  function renderBulkFieldList(entFilter) {
    var container = document.getElementById('prog-bulk-field-list');
    var fields = allFields;
    if (entFilter) {
      fields = fields.filter(function (f) { return f.enterpriseId === entFilter; });
    }

    // Group by enterprise
    var groups = {};
    fields.forEach(function (f) {
      var ent = (window.refData.enterprises || []).find(function (e) { return e.id === f.enterpriseId; });
      var entName = ent ? ent.name : 'Unknown';
      if (!groups[entName]) groups[entName] = [];
      groups[entName].push(f);
    });

    var html = '';
    Object.keys(groups).sort().forEach(function (entName) {
      html += '<div style="font-weight:600;font-size:0.8rem;padding:0.4rem 0.25rem;color:var(--primary);border-bottom:1px solid var(--border)">' + util.escHtml(entName) + '</div>';
      groups[entName].forEach(function (f) {
        var isLinked = f.templateId === bulkProgId;
        html += '<label class="prog-bulk-field-item">' +
          '<input type="checkbox" value="' + f.id + '"' + (isLinked ? ' checked' : '') + '> ' +
          '<span>' + util.escHtml(f.name) + '</span>' +
          '<span style="font-size:0.75rem;color:var(--text-light)">' + util.escHtml(f.crop || '--') + ' &middot; ' + util.formatNum(f.acres, 0) + ' ac</span>' +
          (isLinked ? '<span class="prog-badge" style="font-size:0.6rem">linked</span>' : '') +
          '</label>';
      });
    });

    container.innerHTML = html;
  }

  document.getElementById('prog-bulk-enterprise').addEventListener('change', function () {
    renderBulkFieldList(this.value);
  });

  document.getElementById('prog-bulk-select-all').addEventListener('click', function () {
    document.querySelectorAll('#prog-bulk-field-list input[type="checkbox"]').forEach(function (cb) {
      cb.checked = true;
    });
  });

  document.getElementById('prog-bulk-select-none').addEventListener('click', function () {
    document.querySelectorAll('#prog-bulk-field-list input[type="checkbox"]').forEach(function (cb) {
      cb.checked = false;
    });
  });

  function closeBulkPanel() {
    document.getElementById('prog-bulk-panel').classList.add('hidden');
    bulkProgId = null;
  }

  function getSelectedSections() {
    var sections = [];
    ['inputs', 'machinery', 'seed', 'yield', 'crop'].forEach(function (sec) {
      var cb = document.getElementById('bsec-' + sec);
      if (cb && cb.checked) sections.push(sec);
    });
    return sections;
  }

  function buildSectionLabel(sections) {
    var labels = { inputs: 'Inputs', machinery: 'Machinery', seed: 'Seed & Varieties', yield: 'Yield Target', crop: 'Crop Info' };
    return sections.map(function (s) { return labels[s] || s; }).join(', ');
  }

  document.getElementById('prog-bulk-cancel').addEventListener('click', closeBulkPanel);
  document.getElementById('prog-bulk-cancel2').addEventListener('click', closeBulkPanel);

  document.getElementById('prog-bulk-apply').addEventListener('click', function () {
    if (!bulkProgId) return;
    var fieldIds = [];
    document.querySelectorAll('#prog-bulk-field-list input[type="checkbox"]:checked').forEach(function (cb) {
      fieldIds.push(cb.value);
    });
    if (!fieldIds.length) { util.showToast('Select at least one field'); return; }
    var sections = getSelectedSections();
    if (!sections.length) { util.showToast('Select at least one section to apply'); return; }
    if (!confirm('Push ' + buildSectionLabel(sections) + ' to ' + fieldIds.length + ' field(s)?')) return;

    api.post('/api/programs/' + bulkProgId + '/apply-bulk', { fieldIds: fieldIds, sections: sections }).then(function (result) {
      util.showToast('Updated ' + result.updated + ' field(s)!');
      closeBulkPanel();
      loadPrograms();
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
    });
  });

  document.getElementById('prog-bulk-linked').addEventListener('click', function () {
    if (!bulkProgId) return;
    var linkedFieldIds = allFields
      .filter(function (f) { return f.templateId === bulkProgId; })
      .map(function (f) { return f.id; });
    if (!linkedFieldIds.length) { util.showToast('No linked fields'); return; }
    var sections = getSelectedSections();
    if (!sections.length) { util.showToast('Select at least one section to apply'); return; }
    if (!confirm('Push ' + buildSectionLabel(sections) + ' to all ' + linkedFieldIds.length + ' linked field(s)?')) return;

    api.post('/api/programs/' + bulkProgId + '/apply-bulk', { fieldIds: linkedFieldIds, sections: sections }).then(function (result) {
      util.showToast('Pushed to ' + result.updated + ' linked field(s)!');
      closeBulkPanel();
      loadPrograms();
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
    });
  });

  // Expose reload
  window.reloadPrograms = loadPrograms;
})();

// ========================
// MACHINERY PROGRAMS
// ========================
(function () {
  'use strict';

  var currentMachProg = null;
  var isNewMachProg = false;

  // Reload when programs tab activates
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'programs') loadMachProgs();
  });

  function loadMachProgs() {
    api.get('/api/machinery-programs').then(function (progs) {
      window.refData.machineryPrograms = progs;
      renderMachProgCards(progs);
      var countEl = document.getElementById('mach-prog-count');
      if (countEl) countEl.textContent = progs.length + ' templates';
      // Refresh field editor dropdown if open
      if (typeof populateMachProgDropdown === 'function') populateMachProgDropdown();
    });
  }

  function renderMachProgCards(progs) {
    var container = document.getElementById('mach-prog-cards');
    if (!container) return;
    if (!progs.length) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-light)">No machinery templates yet. Create one to quickly apply implement lists to fields.</div>';
      return;
    }

    // Compute cost per template using reference implements
    var impls = window.refData.implements || [];
    function implCost(m) {
      var impl = impls.find(function (i) { return i.name === m.implementName; });
      if (!impl) return 0;
      var useHire = m.useHire && impl.customHireRate > 0;
      return (useHire ? impl.customHireRate : impl.costPerAcre) * (m.passes || 1);
    }

    var html = '<div class="mach-prog-grid">';
    progs.forEach(function (p) {
      var totalCost = (p.machinery || []).reduce(function (s, m) { return s + implCost(m); }, 0);
      var totalFuel = (p.machinery || []).reduce(function (s, m) {
        var impl = impls.find(function (i) { return i.name === m.implementName; });
        return s + (impl ? (impl.fuelGalPerAcre || 0) * (m.passes || 1) : 0);
      }, 0);
      var machLines = (p.machinery || []).map(function (m) {
        return '<span class="mp-impl">' + util.escHtml(m.implementName) + (m.passes !== 1 ? ' <em>×' + m.passes + '</em>' : '') + '</span>';
      }).join('');
      html += '<div class="mp-card" data-id="' + p.id + '">' +
        '<div class="mp-card-header">' +
          '<span class="mp-card-name">' + util.escHtml(p.name) + '</span>' +
          '<div class="mp-card-actions">' +
            '<button class="btn-sm btn-primary mp-push" data-id="' + p.id + '" style="font-size:0.72rem">Push to Fields</button>' +
            '<button class="btn-sm mp-edit" data-id="' + p.id + '">Edit</button>' +
          '</div>' +
        '</div>' +
        (p.description ? '<div class="mp-card-desc">' + util.escHtml(p.description) + '</div>' : '') +
        '<div class="mp-impl-list">' + machLines + '</div>' +
        '<div class="mp-card-footer">' +
          '<span class="mp-stat">' + (p.machinery || []).length + ' implements</span>' +
          '<span class="mp-stat">' + util.formatMoney(totalCost) + '/ac</span>' +
          '<span class="mp-stat">' + Calc.round2(totalFuel) + ' gal/ac</span>' +
        '</div>' +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.mp-edit').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var prog = progs.find(function (p) { return p.id === btn.getAttribute('data-id'); });
        if (prog) openMachProgEditor(prog);
      });
    });
  }

  // --- Editor ---
  function openMachProgEditor(prog) {
    currentMachProg = JSON.parse(JSON.stringify(prog));
    isNewMachProg = false;
    document.getElementById('mpe-title').textContent = 'Edit: ' + prog.name;
    document.getElementById('mpe-name').value = prog.name || '';
    document.getElementById('mpe-description').value = prog.description || '';
    document.getElementById('mpe-delete').style.display = '';
    renderMpeRows();
    openMpeOverlay();
  }

  function openMachProgEditorNew() {
    currentMachProg = { id: null, name: '', description: '', machinery: [] };
    isNewMachProg = true;
    document.getElementById('mpe-title').textContent = 'New Machinery Template';
    document.getElementById('mpe-name').value = '';
    document.getElementById('mpe-description').value = '';
    document.getElementById('mpe-delete').style.display = 'none';
    renderMpeRows();
    openMpeOverlay();
  }

  function openMpeOverlay() {
    var ov = document.getElementById('mach-prog-editor-overlay');
    ov.style.display = 'flex';
    requestAnimationFrame(function () { ov.classList.add('visible'); });
  }

  function closeMpeOverlay() {
    var ov = document.getElementById('mach-prog-editor-overlay');
    ov.classList.remove('visible');
    setTimeout(function () { ov.style.display = 'none'; }, 250);
  }

  function renderMpeRows() {
    var tbody = document.getElementById('mpe-mach-tbody');
    var impls = window.refData.implements || [];
    var html = '';
    (currentMachProg.machinery || []).forEach(function (m, idx) {
      var impl = impls.find(function (i) { return i.name === m.implementName; });
      var cost = impl ? impl.costPerAcre * (m.passes || 1) : 0;
      html += '<tr>' +
        '<td><input type="text" value="' + util.escHtml(m.implementName || '') + '" data-idx="' + idx + '" data-field="implementName" class="mpe-mach-input" list="impl-search-list" style="width:150px"></td>' +
        '<td><input type="number" value="' + (m.passes || 1) + '" data-idx="' + idx + '" data-field="passes" class="mpe-mach-input" step="0.5" min="0" style="width:60px"></td>' +
        '<td class="number">' + util.formatMoney(cost) + '</td>' +
        '<td><button class="btn-danger mpe-remove" data-idx="' + idx + '" style="font-size:0.7rem;padding:0.2rem 0.4rem">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    tbody.querySelectorAll('.mpe-mach-input').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        currentMachProg.machinery[idx][field] = field === 'passes' ? (parseFloat(el.value) || 1) : el.value;
        renderMpeRows();
        updateMpeCostTotal();
      });
    });
    tbody.querySelectorAll('.mpe-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentMachProg.machinery.splice(parseInt(btn.getAttribute('data-idx')), 1);
        renderMpeRows();
        updateMpeCostTotal();
      });
    });
    updateMpeCostTotal();
  }

  function updateMpeCostTotal() {
    var el = document.getElementById('mpe-cost-total');
    if (!el || !currentMachProg) return;
    var impls = window.refData.implements || [];
    var total = (currentMachProg.machinery || []).reduce(function (s, m) {
      var impl = impls.find(function (i) { return i.name === m.implementName; });
      return s + (impl ? impl.costPerAcre * (m.passes || 1) : 0);
    }, 0);
    var fuel = (currentMachProg.machinery || []).reduce(function (s, m) {
      var impl = impls.find(function (i) { return i.name === m.implementName; });
      return s + (impl ? (impl.fuelGalPerAcre || 0) * (m.passes || 1) : 0);
    }, 0);
    el.textContent = 'Total: ' + util.formatMoney(total) + '/ac  ·  ' + Calc.round2(fuel) + ' gal/ac';
  }

  document.getElementById('mpe-add-mach').addEventListener('click', function () {
    if (!currentMachProg) return;
    currentMachProg.machinery.push({ implementName: '', passes: 1 });
    renderMpeRows();
  });

  document.getElementById('mpe-save').addEventListener('click', function () {
    if (!currentMachProg) return;
    currentMachProg.name = document.getElementById('mpe-name').value.trim();
    currentMachProg.description = document.getElementById('mpe-description').value.trim();
    if (!currentMachProg.name) { util.showToast('Enter a template name'); return; }
    var req = isNewMachProg
      ? api.post('/api/machinery-programs', currentMachProg)
      : api.put('/api/machinery-programs/' + currentMachProg.id, currentMachProg);
    req.then(function () {
      closeMpeOverlay();
      loadMachProgs();
      util.showToast('Template saved');
    });
  });

  document.getElementById('mpe-delete').addEventListener('click', function () {
    if (!currentMachProg || !currentMachProg.id) return;
    if (!confirm('Delete "' + currentMachProg.name + '"?')) return;
    api.del('/api/machinery-programs/' + currentMachProg.id).then(function () {
      closeMpeOverlay();
      loadMachProgs();
      util.showToast('Template deleted');
    });
  });

  document.getElementById('mpe-close').addEventListener('click', closeMpeOverlay);
  document.getElementById('mpe-cancel').addEventListener('click', closeMpeOverlay);
  document.getElementById('mach-prog-editor-overlay').addEventListener('click', function (e) {
    if (e.target === this) closeMpeOverlay();
  });

  document.getElementById('mach-prog-add').addEventListener('click', openMachProgEditorNew);

  // ========================
  // PUSH TO FIELDS
  // ========================
  var machPushProgId = null;
  var machPushAllFields = [];

  function openMachPushPanel(progId) {
    machPushProgId = progId;
    var prog = (window.refData.machineryPrograms || []).find(function (p) { return p.id === progId; });
    if (!prog) return;

    document.getElementById('mach-push-title').textContent = 'Push "' + prog.name + '" to Fields';

    // Populate enterprise filter
    var entSelect = document.getElementById('mach-push-enterprise');
    entSelect.innerHTML = '<option value="">All Enterprises</option>';
    var enterprises = window.refData.enterprises || [];
    enterprises.forEach(function (e) {
      entSelect.innerHTML += '<option value="' + e.id + '">' + util.escHtml(e.name) + '</option>';
    });

    // Load fields fresh then render
    api.get('/api/fields?all=true').then(function (fields) {
      machPushAllFields = fields;
      renderMachPushFieldList('');
    });

    document.getElementById('mach-push-panel').classList.remove('hidden');
    document.getElementById('mach-push-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderMachPushFieldList(entFilter) {
    var container = document.getElementById('mach-push-field-list');
    var fields = machPushAllFields;
    if (entFilter) {
      fields = fields.filter(function (f) { return f.enterpriseId === entFilter; });
    }

    // Group by enterprise name
    var enterprises = window.refData.enterprises || [];
    var groups = {};
    fields.forEach(function (f) {
      var ent = enterprises.find(function (e) { return e.id === f.enterpriseId; });
      var entName = ent ? ent.name : 'Unassigned';
      if (!groups[entName]) groups[entName] = [];
      groups[entName].push(f);
    });

    var html = '';
    Object.keys(groups).sort().forEach(function (entName) {
      html += '<div style="font-weight:600;font-size:0.8rem;padding:0.4rem 0.25rem;color:var(--primary);border-bottom:1px solid var(--border)">' + util.escHtml(entName) + '</div>';
      groups[entName].forEach(function (f) {
        html += '<label class="prog-bulk-field-item">' +
          '<input type="checkbox" value="' + f.id + '"> ' +
          '<span>' + util.escHtml(f.name) + '</span>' +
          '<span style="font-size:0.75rem;color:var(--text-light)">' + util.escHtml(f.crop || '--') + ' &middot; ' + util.formatNum(f.acres, 0) + ' ac</span>' +
          '</label>';
      });
    });

    if (!html) html = '<div style="color:var(--text-light);padding:0.5rem">No fields found.</div>';
    container.innerHTML = html;
  }

  document.getElementById('mach-push-enterprise').addEventListener('change', function () {
    renderMachPushFieldList(this.value);
  });

  document.getElementById('mach-push-select-all').addEventListener('click', function () {
    document.querySelectorAll('#mach-push-field-list input[type="checkbox"]').forEach(function (cb) {
      cb.checked = true;
    });
  });

  document.getElementById('mach-push-select-none').addEventListener('click', function () {
    document.querySelectorAll('#mach-push-field-list input[type="checkbox"]').forEach(function (cb) {
      cb.checked = false;
    });
  });

  function closeMachPushPanel() {
    document.getElementById('mach-push-panel').classList.add('hidden');
    machPushProgId = null;
    machPushAllFields = [];
  }

  document.getElementById('mach-push-cancel').addEventListener('click', closeMachPushPanel);
  document.getElementById('mach-push-cancel2').addEventListener('click', closeMachPushPanel);

  document.getElementById('mach-push-apply').addEventListener('click', function () {
    if (!machPushProgId) return;
    var fieldIds = [];
    document.querySelectorAll('#mach-push-field-list input[type="checkbox"]:checked').forEach(function (cb) {
      fieldIds.push(cb.value);
    });
    if (!fieldIds.length) {
      util.showToast('Select at least one field');
      return;
    }
    if (!confirm('Replace machinery on ' + fieldIds.length + ' field(s) with this template? Only the machinery list is replaced.')) return;

    api.post('/api/machinery-programs/' + machPushProgId + '/push', { fieldIds: fieldIds }).then(function (result) {
      util.showToast('Machinery pushed to ' + result.updated + ' field(s)!');
      closeMachPushPanel();
      loadMachProgs();
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
    });
  });

  // Wire "Push to Fields" buttons on cards (event delegation on container)
  document.getElementById('mach-prog-cards').addEventListener('click', function (e) {
    var btn = e.target.closest('.mp-push');
    if (!btn) return;
    e.stopPropagation();
    openMachPushPanel(btn.getAttribute('data-id'));
  });

})();

// ========================
// QUICK PLAN CONFIG
// ========================
(function () {
  'use strict';

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'programs') loadQuickPlanConfig();
  });

  function loadQuickPlanConfig() {
    Promise.all([
      api.get('/api/quick-plan-config'),
      api.get('/api/programs'),
      api.get('/api/machinery-programs')
    ]).then(function (results) {
      window.refData.quickPlanConfig = results[0] || [];
      window.refData.programs = results[1] || [];
      window.refData.machineryPrograms = results[2] || [];
      renderQuickPlanConfig();
      populateQpcDropdowns();
    });
  }

  function renderQuickPlanConfig() {
    var config = window.refData.quickPlanConfig || [];
    var programs = window.refData.programs || [];
    var machProgs = window.refData.machineryPrograms || [];
    var tbody = document.getElementById('qpc-tbody');
    if (!tbody) return;
    var countEl = document.getElementById('qpc-count');
    if (countEl) countEl.textContent = config.length + ' combination' + (config.length !== 1 ? 's' : '');

    if (!config.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-light);text-align:center;padding:1rem">No combinations yet. Click "+ Add Combination" to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = config.map(function (c) {
      var inputProg = programs.find(function (p) { return p.id === c.inputProgramId; });
      var machProg = machProgs.find(function (p) { return p.id === c.machineryProgramId; });
      return '<tr>' +
        '<td>' + util.escHtml(c.crop || '') + '</td>' +
        '<td>' + util.escHtml(c.variant || '—') + '</td>' +
        '<td>' + util.escHtml(c.tillage || '') + '</td>' +
        '<td>' + (inputProg ? util.escHtml(inputProg.name) : '<span style="color:var(--text-light)">none</span>') + '</td>' +
        '<td>' + (machProg ? util.escHtml(machProg.name) : '<span style="color:var(--text-light)">none</span>') + '</td>' +
        '<td><button class="btn-sm qpc-delete-btn" data-id="' + c.id + '" style="color:var(--danger);font-size:0.75rem">Delete</button></td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('.qpc-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this combination?')) return;
        api.del('/api/quick-plan-config/' + btn.getAttribute('data-id')).then(function () {
          util.showToast('Combination deleted');
          loadQuickPlanConfig();
          window.reloadRefDataSelective('quick-plan-config');
        });
      });
    });
  }

  function populateQpcDropdowns() {
    var programs = window.refData.programs || [];
    var machProgs = window.refData.machineryPrograms || [];
    var cropNames = window.refData.cropNames || [];

    var inputSel = document.getElementById('qpc-input-prog');
    var machSel = document.getElementById('qpc-mach-prog');
    var cropDl = document.getElementById('qpc-crop-datalist');
    if (!inputSel || !machSel) return;

    inputSel.innerHTML = '<option value="">— none —</option>' +
      programs.map(function (p) { return '<option value="' + p.id + '">' + util.escHtml(p.name) + '</option>'; }).join('');
    machSel.innerHTML = '<option value="">— none —</option>' +
      machProgs.map(function (p) { return '<option value="' + p.id + '">' + util.escHtml(p.name) + '</option>'; }).join('');
    if (cropDl) {
      cropDl.innerHTML = cropNames.map(function (n) { return '<option value="' + util.escHtml(n) + '">'; }).join('');
    }
  }

  document.getElementById('qpc-add').addEventListener('click', function () {
    document.getElementById('qpc-form-panel').classList.remove('hidden');
    populateQpcDropdowns();
    document.getElementById('qpc-crop').value = '';
    document.getElementById('qpc-variant').value = '';
    document.getElementById('qpc-tillage').value = 'No-Till';
    document.getElementById('qpc-input-prog').value = '';
    document.getElementById('qpc-mach-prog').value = '';
  });

  document.getElementById('qpc-cancel').addEventListener('click', function () {
    document.getElementById('qpc-form-panel').classList.add('hidden');
  });

  document.getElementById('qpc-save').addEventListener('click', function () {
    var crop = document.getElementById('qpc-crop').value.trim();
    var variant = document.getElementById('qpc-variant').value.trim();
    var tillage = document.getElementById('qpc-tillage').value;
    var inputProgramId = document.getElementById('qpc-input-prog').value || null;
    var machineryProgramId = document.getElementById('qpc-mach-prog').value || null;

    if (!crop) { util.showToast('Crop is required'); return; }
    if (!tillage) { util.showToast('Tillage is required'); return; }

    // Client-side duplicate check
    var config = window.refData.quickPlanConfig || [];
    var dup = config.find(function (c) {
      return c.crop === crop && (c.variant || '') === variant && c.tillage === tillage;
    });
    if (dup) {
      util.showToast('A combination for ' + crop + ' / ' + (variant || 'no variant') + ' / ' + tillage + ' already exists');
      return;
    }

    api.post('/api/quick-plan-config', {
      crop: crop, variant: variant, tillage: tillage,
      inputProgramId: inputProgramId, machineryProgramId: machineryProgramId
    }).then(function () {
      util.showToast('Combination saved');
      document.getElementById('qpc-form-panel').classList.add('hidden');
      loadQuickPlanConfig();
      window.reloadRefDataSelective('quick-plan-config');
    }).catch(function (err) { util.showToast('Error: ' + err.message); });
  });

})();
