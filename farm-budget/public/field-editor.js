// Field editor — slide-in panel for editing individual field budgets
(function () {
  'use strict';

  var overlay = document.getElementById('field-editor-overlay');
  var currentField = null;
  var isNew = false;

  window.openFieldEditor = function (field, enterpriseId, defaultSystemCode) {
    if (field) {
      currentField = JSON.parse(JSON.stringify(field)); // deep copy
      isNew = false;
      document.getElementById('editor-title').textContent = 'Edit: ' + field.name;
    } else {
      currentField = {
        enterpriseId: enterpriseId,
        name: '',
        systemCode: defaultSystemCode || 'CON',
        crop: '',
        cropType: 'SINGLE CROP',
        acres: 0,
        rentPerAcre: 0,
        inputs: [],
        seed: null,
        seeds: [],
        machinery: [],
        yieldPerAcre: 0,
        yieldUnit: 'Bu',
        cropInsurancePerAcre: 0,
        insuranceIncomePerAcre: 0,
        auxPayments: [],
        harvestMoisture: 0,
        buyerId: ''
      };
      isNew = true;
      document.getElementById('editor-title').textContent = 'New Field';
    }
    // Ensure crop & seed dropdowns are populated (guards against cached JS or event timing)
    populateDropdowns();
    populateForm();
    updatePreview();
    updateNavBadges();
    updateSplitBanner();
    // Reset nav to Field Info on open
    var navItems = document.querySelectorAll('.ed-nav-item');
    var panels = document.querySelectorAll('.editor-section-panel');
    navItems.forEach(function (li) { li.classList.remove('active'); });
    panels.forEach(function (p) { p.classList.remove('active'); });
    var firstNav = document.querySelector('.ed-nav-item[data-section="identity"]');
    var firstPanel = document.querySelector('.editor-section-panel[data-section="identity"]');
    if (firstNav) firstNav.classList.add('active');
    if (firstPanel) firstPanel.classList.add('active');
    overlay.style.display = 'flex';
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });

    // Load FieldOps data if the field has been synced
    var foAppsContainer = document.getElementById('ed-fieldops-applications');
    var foYieldContainer = document.getElementById('ed-fieldops-yield-history');
    if (field && field.id && field._fieldops) {
      if (window.loadFieldApplications) window.loadFieldApplications(field.id, foAppsContainer);
      if (window.loadFieldYieldHistory) window.loadFieldYieldHistory(field.id, foYieldContainer);
    } else {
      if (foAppsContainer) foAppsContainer.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem">No FieldOps data for this field.</p>';
      if (foYieldContainer) foYieldContainer.innerHTML = '';
    }

    // Populate program template dropdown
    populateProgramDropdown();
  };

  document.getElementById('editor-close').addEventListener('click', closeEditor);
  document.getElementById('editor-cancel').addEventListener('click', closeEditor);

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeEditor();
  });

  function closeEditor() {
    overlay.classList.remove('visible');
    setTimeout(function () {
      overlay.style.display = 'none';
    }, 350);
    currentField = null;
    // Clear form fields to prevent stale values showing on next open
    document.getElementById('ed-plantedAcres').value = '';
    document.getElementById('ed-acres').value = '';
    document.getElementById('ed-rentPerAcre').value = '';
    document.getElementById('ed-yield').value = '';
    var plantedHint = document.getElementById('ed-plantedAcres-hint');
    if (plantedHint) plantedHint.style.display = 'none';
  }

  // --- Registry crop list cache ---
  // Fetched once from /api/registry/crops (proxied from farm-registry)
  var _registryCrops = null; // array of { id, name, category, organic }

  function fetchRegistryCrops(callback) {
    if (_registryCrops) { callback(_registryCrops); return; }
    fetch('/api/registry/crops')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (crops) {
        if (crops && crops.length > 0) {
          _registryCrops = crops;
          // Provide registry colors to CropColors if available
          if (typeof CropColors !== 'undefined' && CropColors.setRegistryCropColors) {
            CropColors.setRegistryCropColors(crops);
          }
          callback(crops);
        }
        // If unavailable, fall back to cropTypes (registry down = visible failure in dropdown)
      })
      .catch(function () {
        // Registry down — dropdown will be empty (no local fallback per user decision)
      });
  }

  // --- Populate crop dropdown + seed datalist ---
  function populateDropdowns() {
    var cropSelect = document.getElementById('ed-crop');

    // Try to populate from registry first
    fetchRegistryCrops(function (registryCrops) {
      var cropHtml = '<option value="">— select crop —</option>';
      // Group by category
      var groups = {};
      var groupOrder = [];
      registryCrops.forEach(function (c) {
        var cat = c.category || 'Other';
        if (!groups[cat]) { groups[cat] = []; groupOrder.push(cat); }
        groups[cat].push(c);
      });
      groupOrder.forEach(function (cat) {
        cropHtml += '<optgroup label="' + util.escHtml(cat) + '">';
        groups[cat].forEach(function (c) {
          var displayName = c.organic ? 'Organic ' + c.name : c.name;
          cropHtml += '<option value="' + util.escHtml(c.name) + '" data-registry-crop-id="' + util.escHtml(c.id) + '" data-organic="' + (c.organic ? '1' : '0') + '">' + util.escHtml(displayName) + '</option>';
        });
        cropHtml += '</optgroup>';
      });
      cropSelect.innerHTML = cropHtml;
      // Re-apply current field crop value after repopulating
      if (currentField && currentField.crop) {
        cropSelect.value = currentField.crop;
      }
    });

    // Initial HTML while registry fetch is in flight
    var cropHtml = '<option value="">— loading crops… —</option>';
    // Fallback: populate from cropTypes if already loaded (will be replaced when registry responds)
    if (window.refData.cropTypes && window.refData.cropTypes.length > 0) {
      cropHtml = '<option value="">— select crop —</option>';
      window.refData.cropTypes.forEach(function (ct) {
        cropHtml += '<optgroup label="' + util.escHtml(ct.name) + '">';
        (ct.subCrops || []).forEach(function (sc) {
          cropHtml += '<option value="' + util.escHtml(sc.name) + '">' + util.escHtml(sc.name) + '</option>';
        });
        cropHtml += '</optgroup>';
      });
    }
    cropSelect.innerHTML = cropHtml;

    // Seed dropdowns are built dynamically per-row in renderSeedRows()
  }

  window.addEventListener('ref-data-loaded', populateDropdowns);

  // --- Field Name Autocomplete from Farm Registry ---
  var acInstance = null;
  function initAutocomplete() {
    if (typeof FarmRegistry === 'undefined') return;
    if (acInstance) return; // already initialized
    var nameInput = document.getElementById('ed-name');
    acInstance = FarmRegistry.autocomplete(nameInput, {
      onSelect: function (regField) {
        // Fill name
        nameInput.value = regField.name;
        if (currentField) currentField.name = regField.name;

        // Fill acres
        if (regField.reportingAcres > 0) {
          document.getElementById('ed-acres').value = regField.reportingAcres;
          if (currentField) currentField.acres = regField.reportingAcres;
          var hint = document.getElementById('ed-acres-hint');
          hint.textContent = 'From registry: ' + regField.name + ' — ' + regField.reportingAcres + ' ac';
          hint.style.display = 'block';
          hint.style.color = '#4af626';
        }

        // Fetch rent rate from registry. Rate = totalRentDollars / reportingAcres (stable).
        // DBL CROP fields pass cropType + fieldName so the server returns the halved rate.
        var rentHint = document.getElementById('ed-rent-hint');
        if (regField.totalRentDollars > 0) {
          var excludeParam = (currentField && currentField.id) ? '&excludeFieldId=' + encodeURIComponent(currentField.id) : '';
          var dblParams = '';
          if (currentField && (currentField.cropType || '').toUpperCase() === 'DBL CROP') {
            dblParams = '&cropType=' + encodeURIComponent(currentField.cropType) +
                        '&fieldName=' + encodeURIComponent(currentField.name || '');
          }
          api.get('/api/fields/rent-rate?registryFieldId=' + encodeURIComponent(regField.id) + excludeParam + dblParams).then(function (rr) {
            if (!rr || !rr.found || !rr.rentPerAcre) { rentHint.style.display = 'none'; return; }
            document.getElementById('ed-rentPerAcre').value = rr.rentPerAcre;
            if (currentField) currentField.rentPerAcre = rr.rentPerAcre;
            var denomLabel = util.formatNum(rr.registryReportingAcres, 2) + ' ac';
            var dblNote = rr.dblDivisor > 1 ? ' ÷ ' + rr.dblDivisor + ' crops' : '';
            rentHint.innerHTML = 'From registry: $' + util.formatNum(rr.totalRentDollars, 0) +
              ' / ' + denomLabel + dblNote + ' = <strong>$' + util.formatNum(rr.rentPerAcre, 2) + '/ac</strong>';
            rentHint.style.display = 'block';
            rentHint.style.color = '#4af626';
            updatePreview();
          }).catch(function () { rentHint.style.display = 'none'; });
        } else {
          rentHint.style.display = 'none';
        }

        updatePreview();
      }
    });
  }

  // Initialize autocomplete after page load (FarmRegistry script may load async)
  window.addEventListener('ref-data-loaded', function () {
    setTimeout(initAutocomplete, 500);
  });
  // Also try immediately
  setTimeout(initAutocomplete, 1000);


  function populateForm() {
    var f = currentField;
    document.getElementById('ed-name').value = f.name || '';
    document.getElementById('ed-systemCode').value = f.systemCode || 'CON';
    // Clear autocomplete hints
    var acresHint = document.getElementById('ed-acres-hint');
    var rentHint = document.getElementById('ed-rent-hint');
    var reassignHint = document.getElementById('ed-crop-reassign-hint');
    var plantedHint = document.getElementById('ed-plantedAcres-hint');
    if (acresHint) acresHint.style.display = 'none';
    if (rentHint) rentHint.style.display = 'none';
    if (plantedHint) plantedHint.style.display = 'none';
    if (typeof resetYieldMode === 'function') resetYieldMode();
    document.getElementById('ed-crop').value = f.crop || '';
    // Show current enterprise assignment
    if (reassignHint && f.enterpriseId) {
      var ent = (window.refData.enterprises || []).find(function (e) { return e.id === f.enterpriseId; });
      if (ent) {
        reassignHint.textContent = 'Enterprise: ' + ent.name;
        reassignHint.style.color = '#4af626';
        reassignHint.style.display = 'block';
      } else {
        reassignHint.style.display = 'none';
      }
    } else if (reassignHint) {
      reassignHint.style.display = 'none';
    }
    document.getElementById('ed-cropType').value = f.cropType || 'SINGLE CROP';
    document.getElementById('ed-tillage').value = f.tillage || 'Till';
    document.getElementById('ed-notes').value = f.notes || '';
    document.getElementById('ed-acres').value = f.acres || '';
    // Planted acres
    document.getElementById('ed-plantedAcres').value = f.plantedAcres || '';
    updatePlantedAcresHint();
    document.getElementById('ed-rentPerAcre').value = f.rentPerAcre || '';

    // Auto-apply rent rate from registry. Rate = totalRentDollars / reportingAcres (stable).
    // For DBL CROP fields, rate is halved (or divided by crop count) automatically.
    if (f.name) {
      var capturedFieldId = f.id || null;
      var rentNameParam = f.registryFieldId
        ? 'registryFieldId=' + encodeURIComponent(f.registryFieldId)
        : 'name=' + encodeURIComponent(f.name);
      var rentDblParams = '';
      if ((f.cropType || '').toUpperCase() === 'DBL CROP') {
        rentDblParams = '&cropType=' + encodeURIComponent(f.cropType) +
                        '&fieldName=' + encodeURIComponent(f.name) +
                        '&excludeFieldId=' + encodeURIComponent(f.id || '');
      }
      api.get('/api/fields/rent-rate?' + rentNameParam + rentDblParams).then(function (rr) {
        if (!currentField || currentField.id !== capturedFieldId) return;
        var rh = document.getElementById('ed-rent-hint');
        if (rr && rr.found && rr.rentPerAcre > 0) {
          document.getElementById('ed-rentPerAcre').value = rr.rentPerAcre;
          currentField.rentPerAcre = rr.rentPerAcre;
          var denomLabel = util.formatNum(rr.registryReportingAcres, 2) + ' ac';
          var dblNote = rr.dblDivisor > 1 ? ' ÷ ' + rr.dblDivisor + ' crops' : '';
          rh.innerHTML = '<span style="color:#4af626">$' +
            util.formatNum(rr.totalRentDollars, 0) + ' / ' + denomLabel + dblNote + '</span>';
          rh.style.display = 'block';
          updatePreview();
        } else if (rr && rr.found) {
          rh.innerHTML = '<span style="color:#888">No rent set in registry</span>';
          rh.style.display = 'block';
        }
      }).catch(function () { /* registry unavailable, use cached value */ });
    }
    document.getElementById('ed-yield').value = f.yieldPerAcre || '';
    document.getElementById('ed-yieldUnit').value = f.yieldUnit || 'Bu';
    document.getElementById('ed-cropIns').value = f.cropInsurancePerAcre || '';
    document.getElementById('ed-insIncome').value = f.insuranceIncomePerAcre || '';

    // Harvest Moisture & Buyer
    document.getElementById('ed-harvestMoisture').value = f.harvestMoisture || '';
    var buyerSelect = document.getElementById('ed-buyer');
    buyerSelect.innerHTML = '<option value="">— none —</option>';
    (window.refData.buyers || []).forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      if (b.id === f.buyerId) opt.selected = true;
      buyerSelect.appendChild(opt);
    });

    // Seeds — migrate legacy single seed to array
    if (!f.seeds || !f.seeds.length) {
      f.seeds = f.seed ? [{ variety: f.seed.variety || '', population: f.seed.population || 0, acres: 0 }] : [];
    }
    renderSeedRows();

    renderInputRows();
    renderMachRows();
    renderFieldOpsPanel();
    renderAuxRows();
  }

  // --- Product Autocomplete ---
  function initProductAutocomplete(input) {
    var idx = parseInt(input.getAttribute('data-idx'));
    var dropdown = input.parentElement.querySelector('.prod-ac-dropdown');
    var timer = null;
    var selIdx = -1;
    var matches = [];

    function showDropdown(items) {
      matches = items;
      selIdx = -1;
      if (!items.length) { dropdown.style.display = 'none'; return; }
      var html = items.map(function (p, i) {
        var price = Calc.computeApplicationPrice(p);
        return '<div class="prod-ac-item" data-i="' + i + '">' +
          '<span style="font-weight:500">' + util.escHtml(p.name) + '</span>' +
          '<span class="prod-ac-item-meta">' +
          util.escHtml(p.unit || '') + ' · $' + util.formatNum(price, 4) + '/' + util.escHtml(p.unit || 'unit') +
          '</span></div>';
      }).join('');
      dropdown.innerHTML = html;
      var rect = input.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 2) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = Math.max(320, rect.width) + 'px';
      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.prod-ac-item').forEach(function (el) {
        el.addEventListener('mousedown', function (e) {
          e.preventDefault();
          selectProduct(parseInt(el.getAttribute('data-i')));
        });
      });
    }

    function selectProduct(i) {
      var p = matches[i];
      if (!p) return;
      input.value = p.name;
      currentField.inputs[idx].productName = p.name;
      dropdown.style.display = 'none';
      renderInputRows();
      updatePreview();
    }

    function highlightItem(i) {
      dropdown.querySelectorAll('.prod-ac-item').forEach(function (el, j) {
        el.style.background = j === i ? 'var(--highlight)' : '';
      });
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = input.value.trim().toLowerCase();
        if (q.length < 1) { dropdown.style.display = 'none'; return; }
        var words = q.split(/\s+/).filter(Boolean);
        var filtered = (window.refData.products || []).filter(function (p) {
          var name = p.name.toLowerCase();
          return words.every(function (w) { return name.indexOf(w) !== -1; });
        }).slice(0, 12);
        showDropdown(filtered);
      }, 150);
    });

    input.addEventListener('keydown', function (e) {
      if (!matches.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, matches.length - 1); highlightItem(selIdx); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); highlightItem(selIdx); }
      else if (e.key === 'Enter' && selIdx >= 0) { e.preventDefault(); selectProduct(selIdx); }
      else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
    });

    input.addEventListener('blur', function () {
      setTimeout(function () {
        dropdown.style.display = 'none';
        // Snap to canonical product name on blur (case-insensitive match)
        var typed = input.value.trim().toLowerCase();
        if (typed) {
          var match = (window.refData.products || []).find(function (p) {
            return p.name.trim().toLowerCase() === typed;
          });
          if (match && input.value !== match.name) {
            input.value = match.name;
            currentField.inputs[idx].productName = match.name;
          }
        }
      }, 200);
    });

    input.addEventListener('focus', function () {
      if (input.value.trim().length >= 1) input.dispatchEvent(new Event('input'));
    });
  }

  // --- Input Products Table ---
  function renderInputRows() {
    var tbody = document.getElementById('ed-inputs-tbody');
    var html = '';
    (currentField.inputs || []).forEach(function (inp, idx) {
      var product = window.refData.products.find(function (p) {
        return p.name.toLowerCase() === (inp.productName || '').toLowerCase();
      });
      var appPrice = product ? Calc.computeApplicationPrice(product) : 0;
      var cost = (inp.quantity || 0) * appPrice;
      var unitLabel = product ? (product.unit || '') : '';

      html += '<tr data-drag-idx="' + idx + '">' +
        '<td class="drag-handle" title="Drag to reorder">⠿</td>' +
        '<td style="position:relative"><input type="text" value="' + util.escHtml(inp.productName || '') + '" data-idx="' + idx + '" data-field="productName" class="ed-inp-field prod-ac-input" style="width:180px" placeholder="Type to search...">' +
        '<div class="prod-ac-dropdown" data-idx="' + idx + '"></div></td>' +
        '<td><input type="number" value="' + (inp.quantity || '') + '" data-idx="' + idx + '" data-field="quantity" class="ed-inp-field" step="0.1" min="0" style="width:70px"></td>' +
        '<td class="unit-cell" style="font-size:0.78rem;color:var(--text-light);white-space:nowrap">' + util.escHtml(unitLabel) + '</td>' +
        '<td><select data-idx="' + idx + '" data-field="season" class="ed-inp-field" style="width:80px">' +
        '<option value=""' + (!inp.season ? ' selected' : '') + '>--</option>' +
        '<option value="Spring"' + (inp.season === 'Spring' ? ' selected' : '') + '>Spring</option>' +
        '<option value="Fall"' + (inp.season === 'Fall' ? ' selected' : '') + '>Fall</option>' +
        '</select></td>' +
        '<td class="number">' + util.formatMoney(cost) + '</td>' +
        '<td><button class="btn-danger ed-remove-inp" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    updateNavBadges();

    // Product autocomplete
    tbody.querySelectorAll('.prod-ac-input').forEach(function (input) {
      initProductAutocomplete(input);
    });

    // Event listeners for non-product fields
    tbody.querySelectorAll('.ed-inp-field:not(.prod-ac-input)').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        var val = el.value;
        if (field === 'quantity') val = parseFloat(val) || 0;
        currentField.inputs[idx][field] = val;
        renderInputRows();
        updatePreview();
      });
    });

    tbody.querySelectorAll('.ed-remove-inp').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'));
        currentField.inputs.splice(idx, 1);
        renderInputRows();
        updatePreview();
      });
    });

    makeRowsSortable(tbody, function () { return currentField.inputs; }, function () {
      renderInputRows();
      updatePreview();
    });
  }

  document.getElementById('ed-add-input').addEventListener('click', function () {
    if (!currentField) return;
    currentField.inputs.push({
      id: util.generateId('inp'),
      productName: '',
      quantity: 0,
      season: 'Spring'
    });
    renderInputRows();
  });

  // --- Machinery Table ---
  function renderMachRows() {
    var tbody = document.getElementById('ed-mach-tbody');
    var html = '';
    (currentField.machinery || []).forEach(function (m, idx) {
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

      html += '<tr data-drag-idx="' + idx + '">' +
        '<td class="drag-handle" title="Drag to reorder">⠿</td>' +
        '<td><input type="text" value="' + util.escHtml(m.implementName) + '" data-idx="' + idx + '" data-field="implementName" class="ed-mach-field" list="impl-search-list" style="width:150px"></td>' +
        '<td><input type="number" value="' + (m.passes || '') + '" data-idx="' + idx + '" data-field="passes" class="ed-mach-field" step="0.1" min="0" style="width:60px"></td>' +
        '<td class="number">' + util.formatMoney(cost) + '</td>' +
        (hasHireOption ?
          '<td class="ed-mach-mode" data-idx="' + idx + '"><span class="status-badge ' + modeCls + '" style="font-size:0.7rem">' + modeLabel + '</span></td>' :
          '<td></td>') +
        '<td><button class="btn-danger ed-remove-mach" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    updateNavBadges();

    tbody.querySelectorAll('.ed-mach-field').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        var val = el.value;
        if (field === 'passes') val = parseFloat(val) || 0;
        currentField.machinery[idx][field] = val;
        renderMachRows();
        updatePreview();
      });
    });

    // Mode toggle (own/hire)
    tbody.querySelectorAll('.ed-mach-mode').forEach(function (td) {
      td.addEventListener('click', function () {
        var idx = parseInt(td.getAttribute('data-idx'));
        var m = currentField.machinery[idx];
        var impl = window.refData.implements.find(function (i) {
          return i.name.toLowerCase() === (m.implementName || '').toLowerCase();
        });
        var currentlyHire = m.useHire !== undefined ? m.useHire :
          (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0);
        m.useHire = !currentlyHire;
        renderMachRows();
        updatePreview();
      });
    });

    tbody.querySelectorAll('.ed-remove-mach').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'));
        currentField.machinery.splice(idx, 1);
        renderMachRows();
        updatePreview();
      });
    });

    makeRowsSortable(tbody, function () { return currentField.machinery; }, function () {
      renderMachRows();
      updatePreview();
    });
  }

  document.getElementById('ed-add-mach').addEventListener('click', function () {
    if (!currentField) return;
    currentField.machinery.push({
      id: util.generateId('mach'),
      implementName: '',
      passes: 1
    });
    renderMachRows();
  });

  // --- Field Ops Unified Panel ---
  function renderFieldOpsPanel() {
    var container = document.getElementById('fo-groups-container');
    var grandTotalEl = document.getElementById('fo-grand-total');
    var grandValEl = document.getElementById('fo-grand-val');
    var grandFieldEl = document.getElementById('fo-grand-total-field');
    if (!container || !currentField) return;

    var acres = currentField.acres || currentField.plantedAcres || 0;

    // Build unified item list
    var allItems = [];

    // Add inputs
    (currentField.inputs || []).forEach(function (inp, idx) {
      var name = inp.productName || '';
      var itemType = 'input';
      // Custom coop application charges: name starts with "Application -"
      if (name.toLowerCase().indexOf('application -') === 0) {
        itemType = 'custom';
      }
      var product = (window.refData.products || []).find(function (p) {
        return p.name.toLowerCase() === name.toLowerCase();
      });
      var appPrice = product ? Calc.computeApplicationPrice(product) : 0;
      var costPerAcre = (inp.quantity || 0) * appPrice;
      var unitLabel = product ? (product.unit || '') : '';
      var rateDisplay = (inp.quantity || 0) + (unitLabel ? ' ' + unitLabel : '');
      allItems.push({
        name: name,
        itemType: itemType,
        sourceType: 'input',
        sourceIdx: idx,
        costPerAcre: costPerAcre,
        rateDisplay: rateDisplay
      });
    });

    // Add machinery
    (currentField.machinery || []).forEach(function (m, idx) {
      var name = m.implementName || '';
      var impl = (window.refData.implements || []).find(function (i) {
        return i.name.toLowerCase() === name.toLowerCase();
      });
      var useHire = m.useHire !== undefined ? m.useHire :
        (impl && impl.defaultMode === 'hire' && impl.customHireRate > 0);
      var costPerAcre;
      if (useHire && impl && impl.customHireRate > 0) {
        costPerAcre = impl.customHireRate * (m.passes || 1);
      } else {
        costPerAcre = impl ? impl.costPerAcre * (m.passes || 1) : 0;
      }
      var passes = m.passes || 1;
      var rateDisplay = passes + (passes === 1 ? ' pass' : ' passes');
      allItems.push({
        name: name,
        itemType: 'pass',
        sourceType: 'machinery',
        sourceIdx: idx,
        costPerAcre: costPerAcre,
        rateDisplay: rateDisplay
      });
    });

    // Add seeds as display-only rows
    (currentField.seeds || []).forEach(function (s, idx) {
      if (!s.variety) return;
      allItems.push({
        name: s.variety,
        itemType: 'seed',
        sourceType: 'seed',
        sourceIdx: idx,
        costPerAcre: 0, // see Seed tab
        rateDisplay: s.population ? s.population + ' seeds' : '—'
      });
    });

    // Classify each item using FieldOpsGroups
    if (!window.FieldOpsGroups) {
      container.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem">FieldOpsGroups module not loaded.</p>';
      return;
    }

    // Build groups map
    var groupsMap = {};
    window.FieldOpsGroups.GROUP_ORDER.forEach(function (g) { groupsMap[g] = []; });

    allItems.forEach(function (item, globalIdx) {
      // Check operationGroup override first (set by cross-group DnD or inline add)
      var sourceArr = item.sourceType === 'input' ? (currentField.inputs || []) :
        item.sourceType === 'machinery' ? (currentField.machinery || []) : [];
      var sourceItem = sourceArr[item.sourceIdx];
      var group = (sourceItem && sourceItem.operationGroup)
        ? sourceItem.operationGroup
        : window.FieldOpsGroups.classifyItem(item.name, item.itemType);
      item.globalIdx = globalIdx;
      item.group = group;
      // Ensure group is a known group — fall back to Other if override is stale/unknown
      if (!groupsMap[group]) group = 'Other';
      item.group = group;
      groupsMap[group].push(item);
    });

    // Render groups
    var html = '';
    var grandTotal = 0;

    window.FieldOpsGroups.GROUP_ORDER.forEach(function (groupName) {
      var items = groupsMap[groupName];
      if (!items.length) return;

      var groupSubtotal = 0;
      items.forEach(function (item) { groupSubtotal += item.costPerAcre; });
      grandTotal += groupSubtotal;
      var groupFieldTotal = Calc.round2(groupSubtotal * acres);
      var subtotalDisplay = '$' + util.formatNum(Calc.round2(groupSubtotal), 2) + '/ac';

      var rowsHtml = '';
      items.forEach(function (item) {
        var fieldTotal = Calc.round2(item.costPerAcre * acres);
        var isSeed = item.itemType === 'seed';
        var dragTd = isSeed ? '<td></td>' : '<td class="drag-handle">&#8287;</td>';
        var removeTd = isSeed
          ? '<td style="text-align:center"><span style="font-size:0.65rem;color:var(--text-light)">Seed tab</span></td>'
          : '<td><button class="btn-danger fo-remove" data-item-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '" style="font-size:0.68rem">X</button></td>';
        var costDisplay = item.itemType === 'seed'
          ? '<span style="font-size:0.7rem;color:var(--text-light)">see Seed tab</span>'
          : '$' + util.formatNum(Calc.round2(item.costPerAcre), 2);
        var totalDisplay = item.itemType === 'seed' ? '—' : '$' + util.formatNum(fieldTotal, 2);
        rowsHtml += '<tr data-global-idx="' + item.globalIdx + '" data-item-type="' + item.itemType + '" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '"' + (!isSeed ? ' data-drag-idx="' + item.sourceIdx + '"' : '') + '>' +
          dragTd +
          '<td style="font-size:0.78rem">' + util.escHtml(item.name || '—') + '</td>' +
          '<td><span class="fo-type-badge fo-badge-' + item.itemType + '">' + item.itemType + '</span></td>' +
          '<td class="number" style="font-size:0.75rem">' + util.escHtml(item.rateDisplay) + '</td>' +
          '<td class="number" style="font-size:0.78rem">' + costDisplay + '</td>' +
          '<td class="number" style="font-size:0.78rem">' + totalDisplay + '</td>' +
          removeTd +
          '</tr>';
      });

      html += '<div class="fo-group" data-group="' + util.escHtml(groupName) + '">' +
        '<div class="fo-group-header fo-group-toggle" data-group="' + util.escHtml(groupName) + '">' +
        '<span class="fo-group-chevron">&#9662;</span>' +
        '<span class="fo-group-name">' + util.escHtml(groupName) + '</span>' +
        '<span class="fo-group-subtotal">' + subtotalDisplay + '</span>' +
        '</div>' +
        '<div class="fo-group-body">' +
        '<table class="compact-table fo-table" style="width:100%">' +
        '<thead><tr><th></th><th>Name</th><th>Type</th><th>Rate</th><th>$/ac</th><th>Total $</th><th></th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
        '<button class="btn-sm fo-add-item" data-group="' + util.escHtml(groupName) + '" style="margin-top:0.4rem;font-size:0.72rem">+ Add to ' + util.escHtml(groupName) + '</button>' +
        '</div>' +
        '</div>';
    });

    container.innerHTML = html || '<p style="color:var(--text-light);font-size:0.8rem;padding:0.5rem">No inputs or machinery on this field.</p>';

    // Grand total
    var grandPerAc = Calc.round2(grandTotal);
    var grandField = Calc.round2(grandTotal * acres);
    if (grandTotalEl) {
      grandTotalEl.style.display = grandTotal > 0 ? 'flex' : 'none';
      if (grandValEl) grandValEl.textContent = '$' + util.formatNum(grandPerAc, 2) + '/ac';
      if (grandFieldEl) grandFieldEl.textContent = 'Field: $' + util.formatNum(grandField, 2);
    }

    // Wire collapse toggles
    container.querySelectorAll('.fo-group-toggle').forEach(function (header) {
      header.addEventListener('click', function () {
        var group = header.closest('.fo-group');
        if (!group) return;
        var isCollapsed = group.classList.toggle('fo-collapsed');
        var chevron = header.querySelector('.fo-group-chevron');
        if (chevron) chevron.innerHTML = isCollapsed ? '&#9656;' : '&#9662;';
      });
    });

    // Wire expand-all / collapse-all
    var expandBtn = document.getElementById('fo-expand-all');
    var collapseBtn = document.getElementById('fo-collapse-all');
    if (expandBtn) {
      expandBtn.onclick = function () {
        container.querySelectorAll('.fo-group').forEach(function (g) {
          g.classList.remove('fo-collapsed');
          var ch = g.querySelector('.fo-group-chevron');
          if (ch) ch.innerHTML = '&#9662;';
        });
      };
    }
    if (collapseBtn) {
      collapseBtn.onclick = function () {
        container.querySelectorAll('.fo-group').forEach(function (g) {
          g.classList.add('fo-collapsed');
          var ch = g.querySelector('.fo-group-chevron');
          if (ch) ch.innerHTML = '&#9656;';
        });
      };
    }

    // Wire remove buttons
    container.querySelectorAll('.fo-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sourceType = btn.getAttribute('data-item-type');
        var sourceIdx = parseInt(btn.getAttribute('data-source-idx'), 10);
        if (sourceType === 'input' || sourceType === 'custom') {
          if (currentField.inputs && currentField.inputs[sourceIdx] !== undefined) {
            currentField.inputs.splice(sourceIdx, 1);
          }
        } else if (sourceType === 'machinery') {
          if (currentField.machinery && currentField.machinery[sourceIdx] !== undefined) {
            currentField.machinery.splice(sourceIdx, 1);
          }
        }
        renderFieldOpsPanel();
        updatePreview();
      });
    });

    // Add impl-search-list datalist for inline add form (if not already in DOM)
    if (!document.getElementById('impl-search-list')) {
      var implDatalist = document.createElement('datalist');
      implDatalist.id = 'impl-search-list';
      (window.refData.implements || []).forEach(function (impl) {
        var opt = document.createElement('option');
        opt.value = impl.name || '';
        implDatalist.appendChild(opt);
      });
      var foBody = document.getElementById('ed-fieldops-unified-body');
      if (foBody) foBody.appendChild(implDatalist);
    }

    // Wire add-item buttons — inline add form
    container.querySelectorAll('.fo-add-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var groupName = btn.getAttribute('data-group');
        // Close any existing open add rows
        container.querySelectorAll('.fo-add-row').forEach(function (row) { row.remove(); });
        container.querySelectorAll('.fo-add-item').forEach(function (b) { b.style.display = ''; });
        btn.style.display = 'none';

        // Find the tbody for this group
        var groupDiv = container.querySelector('.fo-group[data-group="' + groupName + '"]');
        if (!groupDiv) return;
        var tbody = groupDiv.querySelector('tbody');
        if (!tbody) return;

        var addRow = document.createElement('tr');
        addRow.className = 'fo-add-row';
        addRow.setAttribute('data-adding-group', groupName);
        addRow.innerHTML = '<td></td>' +
          '<td colspan="5">' +
          '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;padding:0.25rem 0">' +
          '<select class="fo-add-type" style="font-size:0.75rem;width:90px">' +
          '<option value="input">Input</option>' +
          '<option value="pass">Pass</option>' +
          '</select>' +
          '<input type="text" class="fo-add-name" placeholder="Product or implement name..." ' +
          'style="font-size:0.75rem;flex:1;min-width:140px" list="prod-search-list">' +
          '<input type="number" class="fo-add-qty" placeholder="Qty/Passes" step="0.1" min="0" ' +
          'style="font-size:0.75rem;width:75px">' +
          '<button class="btn-sm btn-primary fo-add-confirm" style="font-size:0.72rem;padding:0.2rem 0.5rem">Add</button>' +
          '<button class="btn-sm fo-add-cancel" style="font-size:0.72rem;padding:0.2rem 0.5rem">&#x2715;</button>' +
          '</div>' +
          '</td>' +
          '<td></td>';
        tbody.appendChild(addRow);

        // Toggle list attr when type changes
        var typeSelect = addRow.querySelector('.fo-add-type');
        var nameInput = addRow.querySelector('.fo-add-name');
        typeSelect.addEventListener('change', function () {
          nameInput.setAttribute('list', typeSelect.value === 'pass' ? 'impl-search-list' : 'prod-search-list');
        });
        nameInput.focus();

        // Cancel
        addRow.querySelector('.fo-add-cancel').addEventListener('click', function () {
          addRow.remove();
          btn.style.display = '';
        });

        // Confirm
        addRow.querySelector('.fo-add-confirm').addEventListener('click', function () {
          var type = typeSelect.value;
          var name = nameInput.value.trim();
          var qty = parseFloat(addRow.querySelector('.fo-add-qty').value) || 0;
          if (!name) { nameInput.focus(); return; }

          if (type === 'input') {
            if (!currentField.inputs) currentField.inputs = [];
            currentField.inputs.push({
              id: util.generateId('inp'),
              productName: name,
              quantity: qty,
              season: 'Spring',
              operationGroup: groupName
            });
          } else {
            if (!currentField.machinery) currentField.machinery = [];
            currentField.machinery.push({
              id: util.generateId('mach'),
              implementName: name,
              passes: qty || 1,
              operationGroup: groupName
            });
          }
          renderFieldOpsPanel();
          updatePreview();
        });
      });
    });

    // Wire cross-group drag-and-drop
    makeFoGroupsDraggable();
  }

  function makeFoGroupsDraggable() {
    var container = document.getElementById('fo-groups-container');
    if (!container) return;
    var dragSrc = null; // { sourceType, sourceIdx, origGroup }

    container.querySelectorAll('.fo-table tbody tr[data-drag-idx]').forEach(function (row) {
      var handle = row.querySelector('.drag-handle');
      if (!handle) return;

      handle.addEventListener('mousedown', function () { row.draggable = true; });
      handle.addEventListener('mouseup', function () { row.draggable = false; });

      row.addEventListener('dragstart', function (e) {
        dragSrc = {
          sourceType: row.getAttribute('data-source-type'),
          sourceIdx: parseInt(row.getAttribute('data-source-idx'), 10),
          origGroup: row.closest('.fo-group') ? row.closest('.fo-group').getAttribute('data-group') : null
        };
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('drag-src');
      });

      row.addEventListener('dragend', function () {
        row.draggable = false;
        row.classList.remove('drag-src');
        container.querySelectorAll('.fo-group').forEach(function (g) {
          g.classList.remove('fo-drop-target');
        });
        dragSrc = null;
      });
    });

    // Group-level drop zones for cross-group drops
    container.querySelectorAll('.fo-group').forEach(function (group) {
      var targetGroup = group.getAttribute('data-group');

      group.addEventListener('dragover', function (e) {
        if (!dragSrc) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrc.origGroup !== targetGroup) {
          group.classList.add('fo-drop-target');
        }
      });

      group.addEventListener('dragleave', function (e) {
        if (!e.relatedTarget || !group.contains(e.relatedTarget)) {
          group.classList.remove('fo-drop-target');
        }
      });

      group.addEventListener('drop', function (e) {
        e.preventDefault();
        group.classList.remove('fo-drop-target');
        if (!dragSrc || dragSrc.origGroup === targetGroup) return; // same group — within-group handled by row dragover

        // Cross-group: set operationGroup override on source item
        var arr = dragSrc.sourceType === 'machinery'
          ? currentField.machinery
          : currentField.inputs;
        if (!arr || dragSrc.sourceIdx >= arr.length) return;
        arr[dragSrc.sourceIdx].operationGroup = targetGroup;
        renderFieldOpsPanel();
        updatePreview();
      });
    });
  }

  // --- AUX Payments Table ---
  function renderAuxRows() {
    var tbody = document.getElementById('ed-aux-tbody');
    if (!tbody) return;
    if (!currentField.auxPayments) currentField.auxPayments = [];
    var html = '';
    var total = 0;
    currentField.auxPayments.forEach(function (ap, idx) {
      total += ap.perAcre || 0;
      html += '<tr>' +
        '<td><input type="text" value="' + util.escHtml(ap.label || '') + '" data-idx="' + idx + '" data-field="label" class="ed-aux-field" style="width:200px" placeholder="e.g. CRP Payment"></td>' +
        '<td><input type="number" value="' + (ap.perAcre || '') + '" data-idx="' + idx + '" data-field="perAcre" class="ed-aux-field" step="0.01" min="0" style="width:80px"></td>' +
        '<td><button class="btn-danger ed-remove-aux" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    updateNavBadges();

    var totalEl = document.getElementById('ed-aux-total');
    if (totalEl) {
      totalEl.textContent = currentField.auxPayments.length > 0
        ? 'Total: ' + util.formatMoney(total) + '/ac'
        : '';
    }

    tbody.querySelectorAll('.ed-aux-field').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        var val = el.value;
        if (field === 'perAcre') val = parseFloat(val) || 0;
        currentField.auxPayments[idx][field] = val;
        renderAuxRows();
        updatePreview();
      });
    });

    tbody.querySelectorAll('.ed-remove-aux').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'));
        currentField.auxPayments.splice(idx, 1);
        renderAuxRows();
        updatePreview();
      });
    });
  }

  document.getElementById('ed-add-aux').addEventListener('click', function () {
    if (!currentField) return;
    if (!currentField.auxPayments) currentField.auxPayments = [];
    currentField.auxPayments.push({ label: '', perAcre: 0 });
    renderAuxRows();
  });

  // --- Seed Varieties Table ---
  function renderSeedRows() {
    var tbody = document.getElementById('ed-seeds-tbody');
    if (!tbody || !currentField) return;
    if (!currentField.seeds) currentField.seeds = [];
    var fieldAcres = currentField.plantedAcres > 0 ? currentField.plantedAcres : (currentField.acres || 0);
    var html = '';
    var totalSeedAcres = 0;

    currentField.seeds.forEach(function (s, idx) {
      var seedRef = (window.refData.seeds || []).find(function (sr) {
        return (sr.variety || '').toLowerCase() === (s.variety || '').toLowerCase();
      });
      var costPerAcre = 0;
      if (seedRef && seedRef.seedsPerUnit > 0 && s.population > 0) {
        costPerAcre = (s.population / seedRef.seedsPerUnit) * seedRef.pricePerUnit;
      }
      var seedAcres = s.acres > 0 ? s.acres : fieldAcres;
      totalSeedAcres += s.acres > 0 ? s.acres : 0;

      html += '<tr>' +
        '<td><select data-idx="' + idx + '" data-field="variety" class="ed-seed-field" style="width:160px">' +
        buildSeedOptions(s.variety) + '</select></td>' +
        '<td><input type="number" value="' + (s.population || '') + '" data-idx="' + idx + '" data-field="population" class="ed-seed-field" step="1" min="0" style="width:70px"></td>' +
        '<td><input type="number" value="' + (s.acres || '') + '" data-idx="' + idx + '" data-field="acres" class="ed-seed-field" step="0.1" min="0" style="width:70px" placeholder="all"></td>' +
        '<td class="number" style="font-size:0.78rem">$' + util.formatNum(costPerAcre, 2) + '</td>' +
        '<td><button class="btn-danger ed-remove-seed" data-idx="' + idx + '">X</button></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    updateNavBadges();

    // Acre allocation hint
    var hint = document.getElementById('ed-seeds-acre-hint');
    if (hint && currentField.seeds.length > 1) {
      if (totalSeedAcres > 0) {
        var remaining = fieldAcres - totalSeedAcres;
        hint.innerHTML = 'Allocated: ' + util.formatNum(totalSeedAcres, 1) + ' of ' +
          util.formatNum(fieldAcres, 1) + ' ac' +
          (Math.abs(remaining) > 0.05
            ? ' <span style="color:' + (remaining < 0 ? '#ff6e40' : '#ffab40') + '">(' +
              (remaining > 0 ? '+' : '') + util.formatNum(remaining, 1) + ' unassigned)</span>'
            : ' <span style="color:#4af626">&#10003;</span>');
        hint.style.display = 'block';
      } else {
        hint.textContent = 'Tip: assign acres to each variety';
        hint.style.display = 'block';
      }
    } else if (hint) {
      hint.style.display = 'none';
    }

    // Event listeners
    tbody.querySelectorAll('.ed-seed-field').forEach(function (el) {
      el.addEventListener('change', function () {
        var idx = parseInt(el.getAttribute('data-idx'));
        var field = el.getAttribute('data-field');
        var val = el.value;
        if (field === 'population' || field === 'acres') val = parseFloat(val) || 0;
        currentField.seeds[idx][field] = val;
        renderSeedRows();
        updatePreview();
      });
    });

    tbody.querySelectorAll('.ed-remove-seed').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'));
        currentField.seeds.splice(idx, 1);
        renderSeedRows();
        updatePreview();
      });
    });
  }

  function buildSeedOptions(selectedVariety) {
    var seedsByCrop = {};
    (window.refData.seeds || []).forEach(function (s) {
      var crop = s.crop || 'Other';
      if (!seedsByCrop[crop]) seedsByCrop[crop] = [];
      seedsByCrop[crop].push(s);
    });
    var html = '<option value="">— select seed —</option>';
    Object.keys(seedsByCrop).sort().forEach(function (crop) {
      html += '<optgroup label="' + util.escHtml(crop) + '">';
      seedsByCrop[crop].forEach(function (s) {
        var label = (s.brand ? s.brand + ' - ' : '') + s.variety;
        var sel = (s.variety || '').toLowerCase() === (selectedVariety || '').toLowerCase() ? ' selected' : '';
        html += '<option value="' + util.escHtml(s.variety) + '"' + sel + '>' + util.escHtml(label) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  document.getElementById('ed-add-seed').addEventListener('click', function () {
    if (!currentField) return;
    if (!currentField.seeds) currentField.seeds = [];
    currentField.seeds.push({ variety: '', population: 0, acres: 0 });
    renderSeedRows();
  });

  // --- Yield Mode Toggle (Projected / Actual) ---
  var edYieldMode = 'projected';
  var projectedYield = 0; // stash for switching back

  document.querySelectorAll('#ed-yield-mode-toggle .toggle-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      edYieldMode = btn.getAttribute('data-yield-mode');
      document.querySelectorAll('#ed-yield-mode-toggle .toggle-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      applyYieldMode();
    });
  });

  function applyYieldMode() {
    var yieldInput = document.getElementById('ed-yield');
    var hint = document.getElementById('ed-yield-source-hint');

    if (edYieldMode === 'actual') {
      // Stash current projected yield
      projectedYield = parseFloat(yieldInput.value) || 0;
      // Look up actual yield from FieldOps
      var actualYield = 0;
      var found = false;
      if (currentField && currentField._fieldops && currentField._fieldops.yieldHistory) {
        var targetSeason = String((window.refData.settings.year || 2026) - 1);
        var fieldCrop = (currentField.crop || '').trim().toLowerCase();
        currentField._fieldops.yieldHistory.forEach(function (yh) {
          if (found) return;
          var yhCrop = (yh.crop || '').trim().toLowerCase();
          var cropMatch = fieldCrop === yhCrop ||
            fieldCrop.indexOf(yhCrop) !== -1 || yhCrop.indexOf(fieldCrop) !== -1;
          if (yh.season === targetSeason && cropMatch && yh.yieldPerAcre > 0) {
            actualYield = yh.yieldPerAcre;
            found = true;
          }
        });
      }
      if (found) {
        yieldInput.value = actualYield;
        yieldInput.readOnly = true;
        yieldInput.style.background = '#f0f8f0';
        hint.textContent = 'From FieldOps (' + targetSeason + ')';
        hint.style.color = '#4af626';
      } else {
        yieldInput.readOnly = true;
        yieldInput.style.background = '#1a1408';
        hint.textContent = 'No actual data — keeping projected';
        hint.style.color = '#e65100';
      }
    } else {
      // Restore projected
      yieldInput.value = projectedYield;
      yieldInput.readOnly = false;
      yieldInput.style.background = '';
      hint.textContent = '';
    }
    syncAndPreview();
  }

  // Reset yield mode when editor opens (called from populateForm)
  function resetYieldMode() {
    edYieldMode = 'projected';
    projectedYield = 0;
    document.querySelectorAll('#ed-yield-mode-toggle .toggle-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    document.querySelector('#ed-yield-mode-toggle .toggle-btn[data-yield-mode="projected"]').classList.add('active');
    var yieldInput = document.getElementById('ed-yield');
    yieldInput.readOnly = false;
    yieldInput.style.background = '';
    document.getElementById('ed-yield-source-hint').textContent = '';
  }

  // --- Live Preview ---
  var previewFields = [
    'ed-name', 'ed-systemCode', 'ed-crop', 'ed-cropType', 'ed-acres',
    'ed-rentPerAcre', 'ed-yield', 'ed-yieldUnit', 'ed-cropIns',
    'ed-insIncome', 'ed-harvestMoisture', 'ed-buyer'
  ];
  previewFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', syncAndPreview);
      el.addEventListener('change', syncAndPreview);
    }
  });

  // --- Planted Acres hint ---
  function updatePlantedAcresHint() {
    var hint = document.getElementById('ed-plantedAcres-hint');
    if (!hint || !currentField) return;
    var planted = parseFloat(document.getElementById('ed-plantedAcres').value) || 0;
    var fieldAcres = parseFloat(document.getElementById('ed-acres').value) || 0;
    if (planted > 0 && fieldAcres > 0) {
      var pct = Math.round((planted / fieldAcres) * 100);
      var msg = planted + ' of ' + fieldAcres + ' ac (' + pct + '%)';
      if (planted < fieldAcres) {
        msg += ' — rent on ' + fieldAcres + 'ac, inputs on ' + planted + 'ac';
      }
      hint.textContent = msg;
      hint.style.display = 'block';
      hint.style.color = planted > fieldAcres ? '#ff6e40' : '#4af626';
    } else {
      hint.style.display = 'none';
    }
  }

  document.getElementById('ed-plantedAcres').addEventListener('input', function () {
    updatePlantedAcresHint();
    syncAndPreview();
  });

  // Tillage and notes are not in previewFields so need their own listeners
  document.getElementById('ed-tillage').addEventListener('change', function () {
    if (currentField) currentField.tillage = this.value;
  });
  document.getElementById('ed-notes').addEventListener('input', function () {
    if (currentField) currentField.notes = this.value;
  });

  // Update planted acres hint when the acres field changes
  document.getElementById('ed-acres').addEventListener('input', function () {
    updatePlantedAcresHint();
  });

  // --- System code change: re-evaluate enterprise assignment ---
  document.getElementById('ed-systemCode').addEventListener('change', function () {
    if (!currentField) return;
    var crop = document.getElementById('ed-crop').value;
    if (!crop) return;
    var systemCode = document.getElementById('ed-systemCode').value;
    var matchEnt = findMatchingEnterprise(crop, systemCode);
    var reassignHint = document.getElementById('ed-crop-reassign-hint');
    if (matchEnt && matchEnt.id !== currentField.enterpriseId) {
      currentField.enterpriseId = matchEnt.id;
      reassignHint.textContent = 'Enterprise: ' + matchEnt.name;
      reassignHint.style.color = '#4af626';
      reassignHint.style.display = 'block';
    }
  });

  // --- Auto-assign enterprise on crop change ---
  function getCropTypeName(cropName) {
    if (!cropName) return null;
    var key = cropName.trim().toLowerCase();
    var cropTypes = window.refData.cropTypes || [];
    for (var i = 0; i < cropTypes.length; i++) {
      var subs = cropTypes[i].subCrops || [];
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].name.toLowerCase() === key) return cropTypes[i].name;
      }
    }
    return null;
  }

  function findMatchingEnterprise(cropName, systemCode) {
    if (!cropName) return null;
    var key = cropName.trim().toLowerCase();
    var cropTypes = window.refData.cropTypes || [];
    var enterprises = window.refData.enterprises || [];

    // Primary: look up sub-crop directly and use its enterpriseId
    for (var i = 0; i < cropTypes.length; i++) {
      var subs = cropTypes[i].subCrops || [];
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].name.toLowerCase() === key && subs[j].enterpriseId) {
          var ent = enterprises.find(function (e) { return e.id === subs[j].enterpriseId; });
          if (ent) return ent;
        }
      }
    }

    // Fallback: match by crop type name + system code category
    var cropTypeName = getCropTypeName(cropName);
    if (!cropTypeName) return null;
    var isCanning = /CANNING/i.test(systemCode);
    var isOrganic = /ORG/i.test(systemCode) && !isCanning;
    var targetCategory = isOrganic ? 'organic' : 'conventional';

    if (isCanning) {
      for (var i = 0; i < enterprises.length; i++) {
        var ent = enterprises[i];
        if (ent.cropTypeNames && ent.cropTypeNames.indexOf(cropTypeName) !== -1 &&
            (ent.name || '').toLowerCase().indexOf('canning') !== -1) {
          return ent;
        }
      }
    }

    for (var i = 0; i < enterprises.length; i++) {
      var ent = enterprises[i];
      if (ent.cropTypeNames && ent.cropTypeNames.indexOf(cropTypeName) !== -1 &&
          ent.category === targetCategory) {
        return ent;
      }
    }
    return null;
  }

  // --- Auto-fill moisture on crop change + auto-reassign enterprise ---
  document.getElementById('ed-crop').addEventListener('change', function () {
    if (!currentField) return;
    var crop = document.getElementById('ed-crop').value;

    // Auto-reassign enterprise
    var systemCode = document.getElementById('ed-systemCode').value;
    var matchEnt = findMatchingEnterprise(crop, systemCode);
    var reassignHint = document.getElementById('ed-crop-reassign-hint');
    if (matchEnt) {
      currentField.enterpriseId = matchEnt.id;
      reassignHint.textContent = 'Enterprise: ' + matchEnt.name;
      reassignHint.style.color = '#4af626';
      reassignHint.style.display = 'block';
    } else if (reassignHint) {
      reassignHint.style.display = 'none';
    }

    // Auto-fill moisture (existing logic)
    var currentMoisture = parseFloat(document.getElementById('ed-harvestMoisture').value) || 0;
    if (crop && currentMoisture === 0) {
      // Try cropTypes first, fall back to cropPricing
      var found = typeof CropColors !== 'undefined' ? CropColors.findCropType(crop) : null;
      var moisture = found ? found.cropType.defaultMoisture : 0;
      if (!moisture) {
        var pricing = (window.refData.cropPricing || []).find(function (cp) {
          return cp.crop === crop;
        });
        moisture = pricing ? pricing.defaultMoisture : 0;
      }
      if (moisture > 0) {
        document.getElementById('ed-harvestMoisture').value = moisture;
        if (currentField) currentField.harvestMoisture = moisture;
      }
    }
  });

  // --- Nav badges + identity ---
  function updateNavBadges() {
    if (!currentField) return;
    var counts = {
      inputs: (currentField.inputs || []).length,
      machinery: (currentField.machinery || []).length,
      seed: (currentField.seeds || []).length,
      aux: (currentField.auxPayments || []).length
    };
    Object.keys(counts).forEach(function (key) {
      var el = document.getElementById('badge-' + key);
      if (!el) return;
      var n = counts[key];
      el.textContent = n > 0 ? n : '';
    });
    // Field Ops unified badge — combined inputs + machinery count
    var foUnifiedBadge = document.getElementById('badge-fieldops-unified');
    if (foUnifiedBadge) {
      var foCount = (currentField.inputs || []).length + (currentField.machinery || []).length;
      foUnifiedBadge.textContent = foCount > 0 ? foCount : '';
    }
    var nameEl = document.getElementById('ed-nav-name');
    var metaEl = document.getElementById('ed-nav-meta');
    if (nameEl) nameEl.textContent = currentField.name || '—';
    if (metaEl) {
      var crop = currentField.crop || '';
      var acres = currentField.acres || 0;
      metaEl.textContent = crop + (acres > 0 ? ' · ' + acres + ' ac' : '');
    }
  }

  function syncAndPreview() {
    if (!currentField) return;
    currentField.name = document.getElementById('ed-name').value;
    // enterpriseId is auto-assigned from crop + system code, not from a dropdown
    currentField.systemCode = document.getElementById('ed-systemCode').value;
    currentField.crop = document.getElementById('ed-crop').value;
    // Capture registryCropId from selected option's data attribute
    var cropSelect = document.getElementById('ed-crop');
    var selectedOption = cropSelect.options[cropSelect.selectedIndex];
    if (selectedOption && selectedOption.dataset && selectedOption.dataset.registryCropId) {
      currentField.registryCropId = selectedOption.dataset.registryCropId;
    }
    currentField.cropType = document.getElementById('ed-cropType').value;
    currentField.tillage = document.getElementById('ed-tillage').value;
    currentField.acres = parseFloat(document.getElementById('ed-acres').value) || 0;
    currentField.plantedAcres = parseFloat(document.getElementById('ed-plantedAcres').value) || 0;
    currentField.rentPerAcre = parseFloat(document.getElementById('ed-rentPerAcre').value) || 0;
    currentField.yieldPerAcre = parseFloat(document.getElementById('ed-yield').value) || 0;
    currentField.yieldUnit = document.getElementById('ed-yieldUnit').value;
    currentField.cropInsurancePerAcre = parseFloat(document.getElementById('ed-cropIns').value) || 0;
    currentField.insuranceIncomePerAcre = parseFloat(document.getElementById('ed-insIncome').value) || 0;
    currentField.harvestMoisture = parseFloat(document.getElementById('ed-harvestMoisture').value) || 0;
    currentField.buyerId = document.getElementById('ed-buyer').value || '';

    // Sync legacy seed from seeds array for backward compat
    if (currentField.seeds && currentField.seeds.length > 0) {
      var first = currentField.seeds[0];
      currentField.seed = first.variety ? { variety: first.variety, population: first.population || 0 } : null;
    } else {
      currentField.seed = null;
    }

    updateNavBadges();
    updatePreview();
  }

  function updatePreview() {
    if (!currentField) return;
    var refs = {
      products: window.refData.products,
      implements: window.refData.implements,
      cropPricing: window.refData.cropPricing,
      cropTypes: window.refData.cropTypes,
      laborOverhead: window.refData.laborOverhead,
      seeds: window.refData.seeds,
      buyers: window.refData.buyers || []
    };
    var budget = Calc.computeFieldBudget(currentField, refs, window.refData.settings);

    // Labor detail string
    var laborDetail = '';
    if (budget.laborHoursPerAcre > 0) {
      laborDetail = ' (' + Calc.round2(budget.laborHoursPerAcre) + ' hrs × $' + (window.refData.settings.wageRate || 25) + '/hr)';
    }

    // Drying detail string
    var dryingDetail = '';
    if (budget.dryingMethod === 'moisture' && currentField.harvestMoisture > 0) {
      dryingDetail = ' (' + currentField.harvestMoisture + '% FM)';
    }

    function renderItem(label, perAcre, total, cls) {
      var c = cls ? ' ' + cls : '';
      return '<div class="prev-item' + c + '">' +
        '<span class="label">' + label + '</span>' +
        '<span class="val">' + util.formatMoney(perAcre) + '</span>' +
        '<span class="val val-total">' + util.formatMoney(total) + '</span>' +
        '</div>';
    }

    function renderSubtotal(perAcre, total) {
      return '<div class="prev-item prev-group-subtotal">' +
        '<span class="label">Subtotal</span>' +
        '<span class="val">' + util.formatMoney(perAcre) + '</span>' +
        '<span class="val val-total">' + util.formatMoney(total) + '</span>' +
        '</div>';
    }

    // Show effective rent per crop acre (accounts for rent on full field spread over crop acres)
    var rentLabel = 'Rent';
    if (budget.rentAcres > budget.effectiveAcres) {
      rentLabel = 'Rent (' + util.formatNum(budget.rentAcres, 1) + 'ac)';
    }
    var acresHeader = '<div class="prev-col-headers"><span></span><span>/ac</span><span>total</span></div>';

    // All /ac display values divide by rentAcres (field acres) so every column is consistent
    // and line items add up to the expense/profit totals.
    var dispAc = function(total) { return budget.rentAcres > 0 ? Calc.round2(total / budget.rentAcres) : 0; };

    var unassignedFertTotal = Calc.round2(budget.unassignedFertPerAcre * budget.effectiveAcres);

    // Build inputs items — include unassigned fert if any exist
    var inputItems = [
      renderItem('Spring Fert', dispAc(budget.springFertTotal), budget.springFertTotal),
      renderItem('Fall Fert', dispAc(budget.fallFertTotal), budget.fallFertTotal)
    ];
    if (budget.unassignedFertPerAcre > 0) {
      inputItems.push(renderItem('Other Inputs', dispAc(unassignedFertTotal), unassignedFertTotal));
    }
    inputItems.push(renderItem('Seed', dispAc(budget.seedTotal), budget.seedTotal));

    var inputsSubtotal = budget.totalFertCost + budget.seedTotal;
    var opsSubtotal = budget.machineryTotal + budget.laborTotal + budget.overheadTotal + budget.fuelTotal;
    var otherSubtotal = budget.dryingTotal + budget.interestTotal + budget.cropInsuranceTotal;

    var groups = [
      { name: 'Land', items: [
        renderItem(rentLabel, dispAc(budget.rentTotal), budget.rentTotal)
      ], subtotalPerAcre: dispAc(budget.rentTotal), subtotalTotal: budget.rentTotal },
      { name: 'Inputs', items: inputItems,
        subtotalPerAcre: dispAc(inputsSubtotal),
        subtotalTotal: inputsSubtotal },
      { name: 'Operations', items: [
        renderItem('Machinery', dispAc(budget.machineryTotal), budget.machineryTotal),
        renderItem('Labor' + laborDetail, dispAc(budget.laborTotal), budget.laborTotal),
        renderItem('Overhead', dispAc(budget.overheadTotal), budget.overheadTotal),
        renderItem('Fuel (' + budget.fuelGallonsPerAcre + ' gal)', dispAc(budget.fuelTotal), budget.fuelTotal)
      ], subtotalPerAcre: dispAc(opsSubtotal), subtotalTotal: opsSubtotal },
      { name: 'Other', items: [
        renderItem('Drying' + dryingDetail, dispAc(budget.dryingTotal), budget.dryingTotal),
        renderItem('Interest', dispAc(budget.interestTotal), budget.interestTotal),
        renderItem('Insurance', dispAc(budget.cropInsuranceTotal), budget.cropInsuranceTotal)
      ], subtotalPerAcre: dispAc(otherSubtotal), subtotalTotal: otherSubtotal }
    ];

    var html = acresHeader;
    html += groups.map(function (g) {
      return '<div class="prev-group"><div class="prev-group-label">' + g.name + '</div>' +
        '<div class="prev-group-items">' + g.items.join('') +
        renderSubtotal(g.subtotalPerAcre, g.subtotalTotal) +
        '</div></div>';
    }).join('');

    // COP coloring: red when COP > price (losing money), green when COP < price
    var copClass = '';
    if (budget.cop > 0 && budget.pricePerUnit > 0) {
      copClass = budget.cop > budget.pricePerUnit ? 'profit-neg' : 'profit-pos';
    }

    // Totals section
    var isOffice = window.APP_ROLE === 'office';
    html += '<div class="prev-group prev-totals"><div class="prev-group-label">Totals</div><div class="prev-group-items">' +
      renderItem('Expense', budget.expPerAcre, budget.expTotal, 'highlight') +
      (isOffice ? '' : renderItem('Income', dispAc(budget.cropIncomeTotal), budget.cropIncomeTotal)) +
      (isOffice ? '' : renderItem('AUX Payments', dispAc(budget.totalGovPayments), budget.totalGovPayments)) +
      (isOffice ? '' : renderItem('Profit', budget.profitPerAcre, budget.profitFarmWithoutPayments, 'highlight ' + util.profitClass(budget.profitPerAcre))) +
      (isOffice ? '' : renderItem('Profit (w/ Pay)', dispAc(budget.profitFarmWithPayments), budget.profitFarmWithPayments, 'highlight ' + util.profitClass(budget.profitFarmWithPayments))) +
      (isOffice ? '' : renderItem('COP', budget.cop, budget.cop, copClass)) +
      '</div></div>';

    document.getElementById('ed-preview-grid').innerHTML = html;

    // Render cost detail panel
    renderCostDetail(budget);

    // Update KPI strip in sidebar
    var kpiExp = document.getElementById('kpi-exp');
    var kpiInc = document.getElementById('kpi-inc');
    var kpiProfit = document.getElementById('kpi-profit');
    var kpiCop = document.getElementById('kpi-cop');
    if (kpiExp) kpiExp.textContent = util.formatMoney(budget.expPerAcre);
    if (kpiInc) kpiInc.textContent = util.formatMoney(dispAc(budget.cropIncomeTotal));
    if (kpiProfit) {
      kpiProfit.textContent = util.formatMoney(budget.profitPerAcre);
      kpiProfit.className = 'ed-kpi-val ' + util.profitClass(budget.profitPerAcre);
    }
    if (kpiCop) kpiCop.textContent = util.formatMoney(budget.cop);
  }

  // --- Row drag-to-reorder helper ---
  // Only activates when the user grabs the .drag-handle cell — inputs/selects are unaffected.
  function makeRowsSortable(tbody, getArray, onReorder) {
    var dragSrcIdx = null;

    function clearIndicators() {
      tbody.querySelectorAll('tr').forEach(function (r) {
        r.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    }

    tbody.querySelectorAll('.drag-handle').forEach(function (handle) {
      var row = handle.closest('tr');

      // Only enable drag when pointer is on the handle
      handle.addEventListener('mousedown', function () { row.draggable = true; });
      handle.addEventListener('mouseup',   function () { row.draggable = false; });

      row.addEventListener('dragstart', function (e) {
        dragSrcIdx = parseInt(row.getAttribute('data-drag-idx'));
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('drag-src');
      });

      row.addEventListener('dragend', function () {
        row.draggable = false;
        row.classList.remove('drag-src');
        clearIndicators();
        dragSrcIdx = null;
      });

      row.addEventListener('dragover', function (e) {
        if (dragSrcIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var targetIdx = parseInt(row.getAttribute('data-drag-idx'));
        if (targetIdx === dragSrcIdx) return;
        clearIndicators();
        var rect = row.getBoundingClientRect();
        row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
      });

      row.addEventListener('dragleave', function () {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragSrcIdx === null) return;
        var targetIdx = parseInt(row.getAttribute('data-drag-idx'));
        if (targetIdx === dragSrcIdx) return;
        var arr = getArray();
        var rect = row.getBoundingClientRect();
        var insertAfter = e.clientY >= rect.top + rect.height / 2;
        var item = arr.splice(dragSrcIdx, 1)[0];
        var dest = targetIdx > dragSrcIdx ? (insertAfter ? targetIdx - 1 : targetIdx - 1) : (insertAfter ? targetIdx + 1 : targetIdx);
        arr.splice(dest, 0, item);
        onReorder();
      });
    });
  }

  // --- Cost Detail panel ---
  function renderCostDetail(budget) {
    var el = document.getElementById('ed-cost-detail-body');
    if (!el) return;
    var s = window.refData ? window.refData.settings : {};
    var fuelPrice = s.fuelPricePerGal || 5;
    var wageRate = s.wageRate || 25;
    var carryMonths = s.carryMonths || 6;

    function cdCard(title, rows, footer) {
      var rowsHtml = rows.map(function (r) {
        return '<div class="cd-row">' +
          '<span class="cd-row-label">' + r[0] + '</span>' +
          '<span class="cd-row-val' + (r[2] ? ' ' + r[2] : '') + '">' + r[1] + '</span>' +
          '</div>';
      }).join('');
      var footerHtml = footer ? '<div class="cd-footer">' + footer + '</div>' : '';
      return '<div class="cd-card"><div class="cd-card-title">' + title + '</div>' +
        '<div class="cd-card-body">' + rowsHtml + '</div>' + footerHtml + '</div>';
    }

    var html = '';

    // --- FUEL ---
    var fuelRows = [];
    var details = budget.machineryDetails || [];
    details.forEach(function (d) {
      if (d.fuelGalPerAcre > 0) {
        fuelRows.push([
          d.implementName + (d.passes > 1 ? ' ×' + d.passes : ''),
          Calc.round2(d.fuelGalPerAcre) + ' gal/ac'
        ]);
      }
    });
    if (fuelRows.length === 0) fuelRows.push(['No fuel-bearing implements', '—']);
    fuelRows.push(['Total', budget.fuelGallonsPerAcre + ' gal/ac', 'cd-row-sub']);
    fuelRows.push(['Rate', '$' + fuelPrice + '/gal', 'cd-row-sub']);
    html += cdCard('Fuel',
      fuelRows,
      budget.fuelGallonsPerAcre + ' gal/ac × $' + fuelPrice + ' = <strong>' + util.formatMoney(budget.fuelPerAcre) + '/ac</strong>'
    );

    // --- LABOR ---
    var laborRows = [];
    if (budget.laborHoursPerAcre > 0) {
      details.forEach(function (d) {
        var impl = (window.refData.implements || []).find ? (window.refData.implements || []).find(function (i) { return i.name === d.implementName; }) : null;
        if (impl && impl.laborHoursPerAcre > 0) {
          var hrs = Calc.round4(impl.laborHoursPerAcre * d.passes);
          laborRows.push([
            d.implementName + (d.passes > 1 ? ' ×' + d.passes : ''),
            hrs + ' hrs/ac'
          ]);
        }
      });
      laborRows.push(['Total hours', Calc.round2(budget.laborHoursPerAcre) + ' hrs/ac', 'cd-row-sub']);
      laborRows.push(['Wage rate', '$' + wageRate + '/hr', 'cd-row-sub']);
      html += cdCard('Labor',
        laborRows,
        Calc.round2(budget.laborHoursPerAcre) + ' hrs × $' + wageRate + ' = <strong>' + util.formatMoney(budget.laborPerAcre) + '/ac</strong>'
      );
    } else {
      // Flat-rate labor from laborOverhead table
      var loEntry = (window.refData.laborOverhead || []).filter ? (window.refData.laborOverhead || []).filter(function (lo) { return lo.systemCode === (currentField && currentField.systemCode); })[0] : null;
      laborRows.push(['Source', 'Flat rate — ' + (currentField ? currentField.systemCode : '') + ' schedule']);
      if (loEntry) laborRows.push(['Schedule rate', util.formatMoney(loEntry.laborPerAcre) + '/ac']);
      laborRows.push(['Crop type mult.', budget.cropTypeMultiplier !== undefined ? budget.cropTypeMultiplier + '×' : '1×']);
      html += cdCard('Labor',
        laborRows,
        'Flat rate: <strong>' + util.formatMoney(budget.laborPerAcre) + '/ac</strong>'
      );
    }

    // --- OVERHEAD ---
    var loEntry2 = (window.refData.laborOverhead || []).filter ? (window.refData.laborOverhead || []).filter(function (lo) { return lo.systemCode === (currentField && currentField.systemCode); })[0] : null;
    var ohRows = [];
    ohRows.push(['System code', currentField ? currentField.systemCode : '—']);
    if (loEntry2) ohRows.push(['Schedule rate', util.formatMoney(loEntry2.overheadPerAcre) + '/ac']);
    if (budget.cropType === 'DBL CROP') ohRows.push(['Crop type mult.', '0.5× (double crop)']);
    html += cdCard('Overhead',
      ohRows,
      'Total: <strong>' + util.formatMoney(budget.overheadPerAcre) + '/ac</strong>'
    );

    // --- DRYING ---
    var dryRows = [];
    dryRows.push(['Method', budget.dryingMethod === 'moisture' ? 'Moisture-tiered (buyer schedule)' : 'Flat rate (crop pricing)']);
    dryRows.push(['Yield', (budget.yieldPerAcre || 0) + ' ' + (currentField ? currentField.yieldUnit || 'Bu' : 'Bu') + '/ac']);
    if (budget.dryingMethod === 'moisture' && currentField && currentField.harvestMoisture > 0) {
      dryRows.push(['Harvest moisture', currentField.harvestMoisture + '%']);
      dryRows.push(['Buyer', currentField.buyerId || '—']);
    } else {
      var flatRate = budget.yieldPerAcre > 0 && budget.dryingPerAcre > 0 ? Calc.round4(budget.dryingPerAcre / budget.yieldPerAcre) : 0;
      dryRows.push(['Drying rate', '$' + flatRate + '/Bu']);
    }
    html += cdCard('Drying',
      dryRows,
      'Total: <strong>' + util.formatMoney(budget.dryingPerAcre) + '/ac</strong>'
    );

    // --- INTEREST ---
    var intRate = (s.interestRate != null) ? s.interestRate : (function () {
      var pricing = (window.refData.cropPricing || []).find ? (window.refData.cropPricing || []).find(function (p) { return p.crop === (currentField && currentField.crop); }) : null;
      return pricing ? pricing.interestRate : 0.06;
    })();
    var intRows = [];
    intRows.push(['Rent × 50%', util.formatMoney(Calc.round2(budget.rentPerCropAcre * 0.5)) + '/ac']);
    intRows.push(['Spring fert', util.formatMoney(budget.springFertPerAcre) + '/ac']);
    intRows.push(['Seed', util.formatMoney(budget.seedCostPerAcre) + '/ac']);
    var opsBase = Calc.round2((budget.laborPerAcre + budget.overheadPerAcre + budget.fuelPerAcre) * 0.5);
    intRows.push(['Ops (labor+OH+fuel) × 50%', util.formatMoney(opsBase) + '/ac']);
    var intBase = Calc.round2(budget.rentPerCropAcre * 0.5 + budget.springFertPerAcre + budget.seedCostPerAcre + opsBase);
    intRows.push(['Interest base', util.formatMoney(intBase) + '/ac', 'cd-row-sub']);
    intRows.push(['Rate', (intRate * 100).toFixed(1) + '%', 'cd-row-sub']);
    intRows.push(['Carry period', carryMonths + ' mo (' + Calc.round2(carryMonths / 12 * 100) + '% yr)', 'cd-row-sub']);
    html += cdCard('Interest',
      intRows,
      intBase + ' × ' + (intRate * 100).toFixed(1) + '% × ' + Calc.round2(carryMonths / 12) + ' = <strong>' + util.formatMoney(budget.interestPerAcre) + '/ac</strong>'
    );

    el.innerHTML = html;
  }

  // --- Machinery Template Dropdown ---
  window.populateMachProgDropdown = function () {
    var sel = document.getElementById('ed-mach-template');
    if (!sel) return;
    var progs = (window.refData && window.refData.machineryPrograms) || [];
    var html = '<option value="">-- Load Machinery Template --</option>';
    progs.forEach(function (p) {
      html += '<option value="' + util.escHtml(p.id) + '">' + util.escHtml(p.name) + '</option>';
    });
    sel.innerHTML = html;
  };

  // Populate on ref-data load
  window.addEventListener('ref-data-loaded', window.populateMachProgDropdown);

  // Apply machinery template button
  (function () {
    var btn = document.getElementById('ed-load-mach-template');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var sel = document.getElementById('ed-mach-template');
      if (!sel || !sel.value) return;
      var progs = (window.refData && window.refData.machineryPrograms) || [];
      var prog = progs.find(function (p) { return p.id === sel.value; });
      if (!prog || !currentField) return;
      if (currentField.machinery && currentField.machinery.length > 0) {
        if (!confirm('Replace current machinery list with "' + prog.name + '"?')) return;
      }
      currentField.machinery = (prog.machinery || []).map(function (m) {
        return { id: util.generateId('mach'), implementName: m.implementName, passes: m.passes || 1, useHire: m.useHire };
      });
      currentField.machineryProgramId = prog.id;
      sel.value = '';
      renderMachRows();
      updateNavBadges();
      updatePreview();
      util.showToast('Applied: ' + prog.name);
    });
  })();

  // --- Nav tab switching ---
  (function () {
    var navList = document.getElementById('ed-nav-list');
    if (!navList) return;
    navList.addEventListener('click', function (e) {
      var item = e.target.closest('.ed-nav-item');
      if (!item) return;
      var section = item.getAttribute('data-section');
      if (!section) return;
      navList.querySelectorAll('.ed-nav-item').forEach(function (li) { li.classList.remove('active'); });
      item.classList.add('active');
      document.querySelectorAll('.editor-section-panel').forEach(function (p) { p.classList.remove('active'); });
      var panel = document.querySelector('.editor-section-panel[data-section="' + section + '"]');
      if (panel) panel.classList.add('active');
    });
  })();

  // --- Expand / fullscreen toggle ---
  (function () {
    var btn = document.getElementById('editor-expand');
    var panel = document.getElementById('field-editor');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var full = panel.classList.toggle('fullscreen');
      btn.textContent = full ? '⤡' : '⤢';
    });
  })();

  // --- Sync Acres & Rent from Registry ---
  document.getElementById('ed-sync-acres').addEventListener('click', function () {
    if (!currentField) return;
    var fieldName = currentField.name || document.getElementById('ed-name').value;
    if (!fieldName) {
      util.showToast('Enter a field name first');
      return;
    }
    api.get('/api/registry/search?q=' + encodeURIComponent(fieldName)).then(function (results) {
      if (!results || !results.length) {
        util.showToast('No match in registry for "' + fieldName + '"');
        return;
      }
      // Use first match (best prefix match)
      var match = results[0];

      // Sync acres + update registry ID so Sync-All uses the correct match going forward
      document.getElementById('ed-acres').value = match.reportingAcres;
      currentField.acres = match.reportingAcres;
      currentField.registryFieldId = match.id;
      var hint = document.getElementById('ed-acres-hint');
      hint.textContent = 'Synced from registry: ' + match.name + ' — ' + match.reportingAcres + ' ac';
      hint.style.display = 'block';
      hint.style.color = '#4af626';

      // Sync rent: fetch prorated rate — totalRentDollars / total budget crop acres for this
      // farm (not registry reportingAcres) so gross rent is fully recovered across all
      // enterprises sharing the same farm.
      var rentHint = document.getElementById('ed-rent-hint');
      var rrParam = match.id
        ? 'registryFieldId=' + encodeURIComponent(match.id)
        : 'name=' + encodeURIComponent(match.name);
      api.get('/api/fields/rent-rate?' + rrParam).then(function (rr) {
        if (rr && rr.found && rr.rentPerAcre > 0) {
          document.getElementById('ed-rentPerAcre').value = rr.rentPerAcre;
          currentField.rentPerAcre = rr.rentPerAcre;
          var denomLabel = rr.totalBudgetAcres > 0
            ? util.formatNum(rr.totalBudgetAcres, 2) + ' crop ac'
            : util.formatNum(rr.registryReportingAcres, 2) + ' ac';
          rentHint.innerHTML = 'Synced from registry: $' + util.formatNum(rr.totalRentDollars, 0) +
            ' / ' + denomLabel + ' = <strong>$' + util.formatNum(rr.rentPerAcre, 2) + '/ac</strong>';
          rentHint.style.display = 'block';
          rentHint.style.color = '#4af626';
        } else {
          rentHint.style.display = 'none';
        }
        updatePreview();
      }).catch(function () { rentHint.style.display = 'none'; });

      updatePreview();
      util.showToast('Synced acres & rent from registry');
    }).catch(function () {
      util.showToast('Could not reach Farm Registry');
    });
  });

  // --- Save ---
  document.getElementById('editor-save').addEventListener('click', function () {
    if (!currentField) return;
    syncAndPreview();

    // Remove _computed before saving
    var toSave = JSON.parse(JSON.stringify(currentField));
    delete toSave._computed;

    var promise;
    if (isNew) {
      promise = api.post('/api/fields', toSave);
    } else {
      promise = api.put('/api/fields/' + toSave.id, toSave);
    }

    promise.then(function () {
      util.showToast(isNew ? 'Field created!' : 'Field saved!');
      var savedEntId = currentField.enterpriseId;
      closeEditor();
      // Navigate to the field's enterprise (handles enterprise changes correctly)
      var enterprises = window.refData ? (window.refData.enterprises || []) : [];
      var newEntIdx = -1;
      for (var i = 0; i < enterprises.length; i++) {
        if (enterprises[i].id === savedEntId) { newEntIdx = i; break; }
      }
      if (newEntIdx >= 0 && typeof window.activateEnterprise === 'function') {
        window.activateEnterprise(newEntIdx);
      } else if (window.reloadEnterprise) {
        window.reloadEnterprise();
      }
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
    });
  });

  // --- Program Template Integration ---
  function populateProgramDropdown() {
    var select = document.getElementById('ed-apply-program');
    select.innerHTML = '<option value="">-- Select a program --</option>';
    (window.refData.programs || []).forEach(function (prog) {
      var opt = document.createElement('option');
      opt.value = prog.id;
      opt.textContent = prog.name + ' (' + (prog.crop || '--') + ' / ' + (prog.systemCode || '') + ')';
      if (currentField && currentField.templateId === prog.id) {
        opt.textContent += ' [current]';
      }
      select.appendChild(opt);
    });
    // Pre-select current template if set
    if (currentField && currentField.templateId) {
      select.value = currentField.templateId;
    }
  }

  document.getElementById('ed-apply-program-btn').addEventListener('click', function () {
    var progId = document.getElementById('ed-apply-program').value;
    if (!progId) { util.showToast('Select a program first'); return; }
    var prog = (window.refData.programs || []).find(function (p) { return p.id === progId; });
    if (!prog) return;

    if (!confirm('Apply "' + prog.name + '" to this field? This overwrites inputs, machinery, seed, yield, and crop data.')) return;

    // Copy agronomic data from program into currentField (in-memory)
    currentField.crop = prog.crop || '';
    currentField.systemCode = prog.systemCode || currentField.systemCode;
    currentField.cropType = prog.cropType || currentField.cropType;
    currentField.inputs = JSON.parse(JSON.stringify(prog.inputs || []));
    currentField.inputs.forEach(function (inp) { inp.id = util.generateId('inp'); });
    currentField.seed = prog.seed ? JSON.parse(JSON.stringify(prog.seed)) : null;
    currentField.seeds = prog.seeds ? JSON.parse(JSON.stringify(prog.seeds))
      : (prog.seed ? [{ variety: prog.seed.variety || '', population: prog.seed.population || 0, acres: 0 }] : []);
    currentField.machinery = JSON.parse(JSON.stringify(prog.machinery || []));
    currentField.machinery.forEach(function (m) { m.id = util.generateId('mach'); });
    currentField.yieldPerAcre = prog.yieldPerAcre || 0;
    currentField.yieldUnit = prog.yieldUnit || 'Bu';
    currentField.cropInsurancePerAcre = prog.cropInsurancePerAcre || 0;
    currentField.harvestMoisture = prog.harvestMoisture || 0;
    currentField.buyerId = prog.buyerId || '';
    currentField.templateId = prog.id;

    populateForm();
    updatePreview();
    util.showToast('Program "' + prog.name + '" applied!');
  });

  document.getElementById('ed-save-as-program').addEventListener('click', function () {
    if (!currentField) return;
    syncAndPreview();

    var defaultName = (currentField.crop || 'New') + ' Program';
    var name = prompt('Program name:', defaultName);
    if (!name) return;

    // Build program data from current field state
    var progData = {
      name: name,
      description: 'Created from ' + (currentField.name || 'field editor'),
      crop: currentField.crop || '',
      systemCode: currentField.systemCode || 'CON',
      cropType: currentField.cropType || 'SINGLE CROP',
      inputs: JSON.parse(JSON.stringify(currentField.inputs || [])),
      seed: currentField.seed ? JSON.parse(JSON.stringify(currentField.seed)) : null,
      seeds: currentField.seeds ? JSON.parse(JSON.stringify(currentField.seeds)) : [],
      machinery: JSON.parse(JSON.stringify(currentField.machinery || [])),
      yieldPerAcre: currentField.yieldPerAcre || 0,
      yieldUnit: currentField.yieldUnit || 'Bu',
      cropInsurancePerAcre: currentField.cropInsurancePerAcre || 0,
      harvestMoisture: currentField.harvestMoisture || 0,
      buyerId: currentField.buyerId || '',
      createdFromFieldId: currentField.id || ''
    };

    api.post('/api/programs', progData).then(function (newProg) {
      util.showToast('Program "' + name + '" created!');
      currentField.templateId = newProg.id;
      // Refresh refData so the dropdown updates
      window.reloadRefData().then(function () {
        populateProgramDropdown();
      });
    }).catch(function (err) {
      util.showToast('Error: ' + err.message);
    });
  });

  // --- Split Group Awareness ---
  function updateSplitBanner() {
    var banner = document.getElementById('ed-split-banner');
    var splitBtn = document.getElementById('ed-split-field');
    var mergeBtn = document.getElementById('ed-merge-split');
    if (!banner || !currentField) {
      if (banner) banner.style.display = 'none';
      if (splitBtn) splitBtn.style.display = '';
      if (mergeBtn) mergeBtn.style.display = 'none';
      return;
    }

    if (!currentField.splitGroupId) {
      banner.style.display = 'none';
      if (splitBtn) splitBtn.style.display = '';
      if (mergeBtn) mergeBtn.style.display = 'none';
      return;
    }

    // Show banner and merge button, hide split button
    if (splitBtn) splitBtn.style.display = 'none';
    if (mergeBtn) mergeBtn.style.display = '';

    document.getElementById('ed-split-registry-name').textContent =
      'Part of: ' + (currentField.registryFieldName || '?');

    // Fetch siblings to show allocation
    api.get('/api/fields?splitGroupId=' + currentField.splitGroupId).then(function (siblings) {
      var alloc = document.getElementById('ed-split-allocation');
      if (!alloc) return;
      var parts = siblings.map(function (s) { return s.acres || 0; });
      var total = parts.reduce(function (a, b) { return a + b; }, 0);
      var regName = currentField.registryFieldName || '?';

      // Try to get registry total
      if (typeof FarmRegistry !== 'undefined' && regName !== '?') {
        FarmRegistry.searchFields(regName).then(function (results) {
          if (!results || !results.length) {
            alloc.textContent = siblings.map(function (s) { return s.name + ': ' + (s.acres || 0); }).join(' + ') +
              ' = ' + util.formatNum(total, 2) + ' ac';
            return;
          }
          var regAcres = results[0].reportingAcres;
          var delta = Math.round((total - regAcres) * 100) / 100;
          var parts = siblings.map(function (s) { return util.formatNum(s.acres || 0, 1); });
          alloc.innerHTML = parts.join(' + ') + ' = ' +
            '<strong>' + util.formatNum(total, 2) + '</strong> of ' +
            util.formatNum(regAcres, 2) + ' ac ' +
            (Math.abs(delta) < 0.02
              ? '<span style="color:#4af626">&#10003;</span>'
              : '<span style="color:#ff6e40">' + (delta > 0 ? '+' : '') + delta + ' ac</span>');
        }).catch(function () {
          alloc.textContent = util.formatNum(total, 2) + ' ac allocated';
        });
      } else {
        alloc.textContent = util.formatNum(total, 2) + ' ac allocated';
      }
    }).catch(function () {
      document.getElementById('ed-split-allocation').textContent = '';
    });

    banner.style.display = '';
  }

  // --- Split Field Button ---
  document.getElementById('ed-split-field').addEventListener('click', function () {
    if (!currentField || !currentField.id) {
      util.showToast('Save the field first before splitting');
      return;
    }
    if (currentField.splitGroupId) {
      util.showToast('Field is already split. Merge first to re-split.');
      return;
    }

    var countStr = prompt('Split into how many sub-fields?', '2');
    if (!countStr) return;
    var count = parseInt(countStr) || 2;
    if (count < 2 || count > 10) {
      util.showToast('Enter a number between 2 and 10');
      return;
    }

    var names = [];
    for (var i = 0; i < count; i++) {
      var n = prompt('Name for sub-field ' + (i + 1) + ':', currentField.name + ' #' + (i + 1));
      if (n === null) return; // cancelled
      names.push(n);
    }

    if (!confirm('Split "' + currentField.name + '" (' + currentField.acres + ' ac) into ' + count + ' sub-fields? The original field will be replaced.')) return;

    api.post('/api/fields/' + currentField.id + '/split', { count: count, names: names }).then(function (result) {
      util.showToast('Field split into ' + result.length + ' sub-fields!');
      closeEditor();
      if (window.reloadEnterprise) window.reloadEnterprise();
    }).catch(function (err) {
      util.showToast('Error: ' + (err.message || 'Split failed'));
    });
  });

  // --- Merge Split Button ---
  document.getElementById('ed-merge-split').addEventListener('click', function () {
    if (!currentField || !currentField.splitGroupId) return;

    if (!confirm('Merge all sub-fields of "' + (currentField.registryFieldName || currentField.name) + '" back into one field? Agronomic data from the first sub-field will be kept.')) return;

    api.post('/api/fields/merge-split', { splitGroupId: currentField.splitGroupId }).then(function () {
      util.showToast('Fields merged!');
      closeEditor();
      if (window.reloadEnterprise) window.reloadEnterprise();
    }).catch(function (err) {
      util.showToast('Error: ' + (err.message || 'Merge failed'));
    });
  });
})();
