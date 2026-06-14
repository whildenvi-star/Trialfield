// Field editor — slide-in panel for editing individual field budgets
(function () {
  'use strict';

  var overlay = document.getElementById('field-editor-overlay');
  var currentField = null;
  var isNew = false;
  var foActiveFilter = 'all'; // 'all' | 'planned' | 'confirmed' | 'disregarded'
  var foViewMode = 'perAcre'; // 'perAcre' | 'perField'

  window.openFieldEditor = function (field, enterpriseId, defaultSystemCode, defaultSection) {
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
    // Reset nav — jump to defaultSection if provided, otherwise Field Info
    var navItems = document.querySelectorAll('.ed-nav-item');
    var panels = document.querySelectorAll('.editor-section-panel');
    navItems.forEach(function (li) { li.classList.remove('active'); });
    panels.forEach(function (p) { p.classList.remove('active'); });
    var startSection = defaultSection || 'identity';
    var startNav = document.querySelector('.ed-nav-item[data-section="' + startSection + '"]') ||
                   document.querySelector('.ed-nav-item[data-section="identity"]');
    var startPanel = document.querySelector('.editor-section-panel[data-section="' + startSection + '"]') ||
                     document.querySelector('.editor-section-panel[data-section="identity"]');
    if (startNav) startNav.classList.add('active');
    if (startPanel) startPanel.classList.add('active');
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

  // --- Field Ops add-item autocomplete (products for Input, implements for Pass) ---
  function initFoAddAutocomplete(nameInput, typeSelect, dropdown) {
    var timer = null;
    var selIdx = -1;
    var matches = [];

    function getItems(q) {
      var words = q.split(/\s+/).filter(Boolean);
      if (typeSelect.value === 'pass') {
        return (window.refData.implements || []).filter(function (impl) {
          var name = (impl.name || '').toLowerCase();
          return words.every(function (w) { return name.indexOf(w) !== -1; });
        }).slice(0, 12);
      }
      return (window.refData.products || []).filter(function (p) {
        var name = p.name.toLowerCase();
        return words.every(function (w) { return name.indexOf(w) !== -1; });
      }).slice(0, 12);
    }

    function showDropdown(items) {
      matches = items;
      selIdx = -1;
      if (!items.length) { dropdown.style.display = 'none'; return; }
      var html;
      if (typeSelect.value === 'pass') {
        html = items.map(function (impl, i) {
          var cost = impl.costPerAcre || 0;
          var mode = impl.defaultMode === 'hire' ? 'Hire' : 'Own';
          return '<div class="prod-ac-item" data-i="' + i + '">' +
            '<span style="font-weight:500">' + util.escHtml(impl.name || '') + '</span>' +
            '<span class="prod-ac-item-meta">$' + util.formatNum(cost, 2) + '/ac · ' + mode + '</span>' +
            '</div>';
        }).join('');
      } else {
        html = items.map(function (p, i) {
          var price = Calc.computeApplicationPrice(p);
          return '<div class="prod-ac-item" data-i="' + i + '">' +
            '<span style="font-weight:500">' + util.escHtml(p.name) + '</span>' +
            '<span class="prod-ac-item-meta">' + util.escHtml(p.unit || '') + ' · $' + util.formatNum(price, 4) + '/' + util.escHtml(p.unit || 'unit') + '</span>' +
            '</div>';
        }).join('');
      }
      dropdown.innerHTML = html;
      var rect = nameInput.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 2) + 'px';
      dropdown.style.left = rect.left + 'px';
      dropdown.style.width = Math.max(280, rect.width) + 'px';
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.prod-ac-item').forEach(function (el) {
        el.addEventListener('mousedown', function (e) {
          e.preventDefault();
          selectItem(parseInt(el.getAttribute('data-i')));
        });
      });
    }

    function selectItem(i) {
      var item = matches[i];
      if (!item) return;
      nameInput.value = item.name || '';
      dropdown.style.display = 'none';
      var qtyInput = nameInput.closest('tr') ? nameInput.closest('tr').querySelector('.fo-add-qty') : null;
      if (qtyInput) { qtyInput.focus(); qtyInput.select(); }
    }

    function highlightItem(i) {
      dropdown.querySelectorAll('.prod-ac-item').forEach(function (el, j) {
        el.style.background = j === i ? 'var(--highlight)' : '';
      });
    }

    nameInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var q = nameInput.value.trim().toLowerCase();
        if (q.length < 1) { dropdown.style.display = 'none'; return; }
        showDropdown(getItems(q));
      }, 150);
    });

    nameInput.addEventListener('keydown', function (e) {
      if (!matches.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, matches.length - 1); highlightItem(selIdx); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); highlightItem(selIdx); }
      else if (e.key === 'Enter' && selIdx >= 0) { e.preventDefault(); selectItem(selIdx); }
      else if (e.key === 'Escape') { dropdown.style.display = 'none'; }
    });

    nameInput.addEventListener('blur', function () {
      setTimeout(function () { dropdown.style.display = 'none'; }, 200);
    });

    nameInput.addEventListener('focus', function () {
      if (nameInput.value.trim().length >= 1) nameInput.dispatchEvent(new Event('input'));
    });

    typeSelect.addEventListener('change', function () {
      dropdown.style.display = 'none';
      matches = [];
      selIdx = -1;
      if (nameInput.value.trim().length >= 1) nameInput.dispatchEvent(new Event('input'));
    });
  }

  // --- Input Products Table ---
  function renderInputRows() {
    var tbody = document.getElementById('ed-inputs-tbody');
    var html = '';
    (currentField.inputs || []).forEach(function (inp, idx) {
      var product = window.refData.products.find(function (p) {
        return p.name.trim().toLowerCase() === (inp.productName || '').trim().toLowerCase();
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

    var acres = (currentField.plantedAcres > 0 ? currentField.plantedAcres : currentField.acres) || 0;

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
        return p.name.trim().toLowerCase() === name.trim().toLowerCase();
      });
      var appPrice = product ? Calc.computeApplicationPrice(product) : 0;
      var costPerAcre = (inp.quantity || 0) * appPrice;
      var unitLabel = product ? (product.unit || '') : '';
      var purchaseUnit = product ? (product.purchaseUnit || unitLabel) : unitLabel;
      var conversionRate = product ? (product.conversionRate || 1) : 1;
      var rateDisplay = (inp.quantity || 0) + (unitLabel ? ' ' + unitLabel : '');
      allItems.push({
        name: name,
        itemType: itemType,
        sourceType: 'input',
        sourceIdx: idx,
        costPerAcre: costPerAcre,
        rateDisplay: rateDisplay,
        unitLabel: unitLabel,
        purchaseUnit: purchaseUnit,
        conversionRate: conversionRate,
        passStatus: inp.passStatus || 'planned',
        confirmedDate: inp.confirmedDate || null,
        confirmedBy: inp.confirmedBy || null,
        actualQuantity: inp.actualQuantity !== undefined ? inp.actualQuantity : null,
        statusNote: inp.statusNote || null,
        invoiceCostTotal: inp.invoiceCostTotal != null ? inp.invoiceCostTotal : null,
        invoiceQtyTotal: inp.invoiceQtyTotal != null ? inp.invoiceQtyTotal : null,
        invoiceAcres: inp.invoiceAcres != null ? inp.invoiceAcres : null,
        invoiceNumber: inp.invoiceNumber || null,
        invoiceVendor: inp.invoiceVendor || null,
        invoiceDate: inp.invoiceDate || null,
        invoiceUnit: inp.invoiceUnit || null,
        foSortOrder: inp.foSortOrder != null ? inp.foSortOrder : null
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
        rateDisplay: rateDisplay,
        passStatus: m.passStatus || 'planned',
        confirmedDate: m.confirmedDate || null,
        confirmedBy: m.confirmedBy || null,
        statusNote: m.statusNote || null,
        foSortOrder: m.foSortOrder != null ? m.foSortOrder : null
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

    // Compute status counts for toolbar summary (over all items before filter)
    var statusCounts = { planned: 0, confirmed: 0, disregarded: 0 };
    allItems.forEach(function (item) {
      if (item.itemType === 'seed') return;
      var s = item.passStatus || 'planned';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
    });
    var summaryEl = document.getElementById('fo-status-summary');
    if (summaryEl) {
      var parts = [];
      if (statusCounts.confirmed > 0) parts.push(statusCounts.confirmed + ' confirmed');
      if (statusCounts.planned > 0) parts.push(statusCounts.planned + ' planned');
      if (statusCounts.disregarded > 0) parts.push(statusCounts.disregarded + ' disregarded');
      summaryEl.textContent = parts.join(' · ');
    }
    // Sync filter select to current foActiveFilter
    var filterSel = document.getElementById('fo-filter-select');
    if (filterSel && filterSel.value !== foActiveFilter) filterSel.value = foActiveFilter;

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
      // Apply filter (seeds always shown regardless of filter)
      if (foActiveFilter !== 'all' && item.itemType !== 'seed' && item.passStatus !== foActiveFilter) return;
      groupsMap[group].push(item);
    });

    // Sort each group by foSortOrder (items without it preserve insertion order via globalIdx)
    window.FieldOpsGroups.GROUP_ORDER.forEach(function (g) {
      groupsMap[g].sort(function (a, b) {
        var aOrd = a.foSortOrder != null ? a.foSortOrder : Infinity;
        var bOrd = b.foSortOrder != null ? b.foSortOrder : Infinity;
        return aOrd !== bOrd ? aOrd - bOrd : a.globalIdx - b.globalIdx;
      });
    });

    // Render groups
    var html = '';
    var grandTotal = 0;
    var isOperator = window.APP_ROLE === 'operator';

    window.FieldOpsGroups.GROUP_ORDER.forEach(function (groupName) {
      var items = groupsMap[groupName];
      if (!items.length) return;

      var groupSubtotal = 0;
      items.forEach(function (item) { groupSubtotal += item.costPerAcre; });
      grandTotal += groupSubtotal;
      var groupFieldTotal = Calc.round2(groupSubtotal * acres);
      var subtotalDisplay = isOperator ? '' : '$' + util.formatNum(Calc.round2(groupSubtotal), 2) + '/ac';

      var nonSeedItems = items.filter(function (i) { return i.itemType !== 'seed'; });
      var confirmedInGroup = nonSeedItems.filter(function (i) { return i.passStatus === 'confirmed'; }).length;
      var allConfirmed = nonSeedItems.length > 0 && confirmedInGroup === nonSeedItems.length;
      var progressHtml = confirmedInGroup > 0
        ? '<span class="fo-group-progress" style="' + (allConfirmed ? 'color:var(--primary)' : '') + '">' +
          (allConfirmed ? '&#10003; done' : confirmedInGroup + '/' + nonSeedItems.length + ' confirmed') +
          '</span>'
        : '';

      var rowsHtml = '';
      items.forEach(function (item) {
        var fieldTotal = Calc.round2(item.costPerAcre * acres);
        var isSeed = item.itemType === 'seed';
        var status = item.passStatus || 'planned';
        var rowClass = isSeed ? '' : (status === 'confirmed' ? ' class="fo-row-confirmed"' : status === 'disregarded' ? ' class="fo-row-disregarded"' : '');

        // Status chip (not for seeds)
        var chipHtml = '';
        if (!isSeed) {
          if (status === 'confirmed') {
            var dateStr = item.confirmedDate ? item.confirmedDate.slice(0, 10) : '';
            var byStr = item.confirmedBy ? ' · ' + util.escHtml(item.confirmedBy) : '';
            var invStr = item.invoiceNumber ? ' · #' + util.escHtml(item.invoiceNumber) : '';
            var vendorTitle = item.invoiceVendor ? ' title="' + util.escHtml(item.invoiceVendor) + '"' : '';
            chipHtml = '<span class="fo-status-chip fo-chip-confirmed" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '"' + vendorTitle + '>&#10003; ' + util.escHtml(dateStr) + byStr + invStr + '</span>';
          } else if (status === 'disregarded') {
            chipHtml = '<span class="fo-status-chip fo-chip-disregarded" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '">&#8212; disregarded</span>';
          } else {
            chipHtml = '<span class="fo-status-chip fo-chip-planned" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '">&#9675; planned</span>';
          }
        }

        // Delta display for confirmed inputs where actual differs from planned
        var deltaHtml = '';
        var sourceInp = (item.sourceType === 'input' || item.sourceType === 'custom') ? (currentField.inputs || [])[item.sourceIdx] : null;
        if (status === 'confirmed' && item.actualQuantity !== null && sourceInp) {
          var plannedQ = sourceInp.quantity || 0;
          if (foViewMode === 'perField' && item.invoiceQtyTotal != null) {
            var plannedFieldQty = Calc.round2(plannedQ * acres);
            if (Math.abs(item.invoiceQtyTotal - plannedFieldQty) > 0.01) {
              deltaHtml = '<br><span style="font-size:0.65rem;color:var(--text-light)">planned: ' + plannedFieldQty + ', inv: ' + item.invoiceQtyTotal + '</span>';
            }
          } else if (foViewMode === 'perAcre' && Math.abs(item.actualQuantity - plannedQ) > 0.001) {
            deltaHtml = '<br><span style="font-size:0.65rem;color:var(--text-light)">planned: ' + plannedQ + ', actual: ' + item.actualQuantity + '</span>';
          }
        }

        var dragTd = isSeed ? '<td></td>' : '<td class="drag-handle" title="Drag to reorder">⠿</td>';
        var removeTd = isSeed
          ? '<td style="text-align:center"><span style="font-size:0.65rem;color:var(--text-light)">Seed tab</span></td>'
          : '<td><button class="btn-danger fo-remove" data-item-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '" style="font-size:0.68rem">X</button></td>';
        // Per-field view: derive field-level qty and use invoice cost when available
        var rateDisplayFinal, costDisplay, totalDisplay;
        if (foViewMode === 'perField' && !isSeed) {
          if (item.sourceType === 'input' || item.sourceType === 'custom') {
            var fConverted;
            if (item.invoiceQtyTotal != null) {
              fConverted = { qty: item.invoiceQtyTotal, unit: item.invoiceUnit || item.purchaseUnit || item.unitLabel };
            } else {
              var rawFieldQty = Calc.round2((sourceInp ? (sourceInp.quantity || 0) : 0) * acres);
              var cr = item.conversionRate || 1;
              fConverted = { qty: Math.round(rawFieldQty / cr * 1000) / 1000, unit: item.purchaseUnit || item.unitLabel };
            }
            rateDisplayFinal = util.formatNum(fConverted.qty, 3) + (fConverted.unit ? ' ' + fConverted.unit : '');
          } else {
            rateDisplayFinal = item.rateDisplay;
          }
          var fieldCost = item.invoiceCostTotal != null ? item.invoiceCostTotal : fieldTotal;
          costDisplay = '$' + util.formatNum(fieldCost, 2);
          totalDisplay = '<span style="font-size:0.7rem;color:var(--text-light)">$' + util.formatNum(Calc.round2(item.costPerAcre), 2) + '/ac</span>';
        } else {
          rateDisplayFinal = item.rateDisplay;
          costDisplay = item.itemType === 'seed'
            ? '<span style="font-size:0.7rem;color:var(--text-light)">see Seed tab</span>'
            : '$' + util.formatNum(Calc.round2(item.costPerAcre), 2);
          totalDisplay = item.itemType === 'seed' ? '—' : '$' + util.formatNum(fieldTotal, 2);
        }
        rowsHtml += '<tr' + rowClass + ' data-global-idx="' + item.globalIdx + '" data-item-type="' + item.itemType + '" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '"' + (!isSeed ? ' data-drag-idx="' + item.sourceIdx + '"' : '') + '>' +
          dragTd +
          (isSeed
            ? '<td style="font-size:0.78rem">' + util.escHtml(item.name || '—') + '</td>'
            : '<td class="fo-name-cell" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '" style="font-size:0.78rem;cursor:pointer;text-decoration:underline dotted" title="Click to swap product">' + util.escHtml(item.name || '—') + '</td>') +
          '<td><span class="fo-type-badge fo-badge-' + item.itemType + '">' + item.itemType + '</span></td>' +
          '<td>' + chipHtml + '</td>' +
          (isSeed
            ? '<td class="number" style="font-size:0.75rem">' + util.escHtml(item.rateDisplay) + '</td>'
            : '<td class="number fo-rate-cell" data-source-type="' + item.sourceType + '" data-source-idx="' + item.sourceIdx + '" style="font-size:0.75rem;cursor:pointer;text-decoration:underline dotted" title="Click to edit rate">' + util.escHtml(rateDisplayFinal) + deltaHtml + '</td>') +
          (isOperator ? '' : '<td class="number" style="font-size:0.78rem">' + costDisplay + '</td>') +
          (isOperator ? '' : '<td class="number" style="font-size:0.78rem">' + totalDisplay + '</td>') +
          removeTd +
          '</tr>';
      });

      html += '<div class="fo-group' + (allConfirmed ? ' fo-collapsed' : '') + '" data-group="' + util.escHtml(groupName) + '">' +
        '<div class="fo-group-header fo-group-toggle" data-group="' + util.escHtml(groupName) + '">' +
        '<span class="fo-group-chevron">&#9662;</span>' +
        '<span class="fo-group-name">' + util.escHtml(groupName) + '</span>' +
        progressHtml +
        '<span class="fo-group-subtotal">' + subtotalDisplay + '</span>' +
        '</div>' +
        '<div class="fo-group-body">' +
        '<table class="compact-table fo-table" style="width:100%">' +
        '<thead><tr><th></th><th>Name</th><th>Type</th><th>Status</th>' +
        (foViewMode === 'perField' ? '<th>Field Qty</th>' : '<th>Rate</th>') +
        (isOperator ? '' : (foViewMode === 'perField' ? '<th>Field $</th><th>$/ac</th>' : '<th>$/ac</th><th>Total $</th>')) +
        '<th></th></tr></thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
        '<button class="btn-sm fo-add-item" data-group="' + util.escHtml(groupName) + '" style="margin-top:0.4rem;font-size:0.72rem">+ Add to ' + util.escHtml(groupName) + '</button>' +
        (items.some(function(i) { return (i.sourceType === 'input' || i.sourceType === 'custom') && i.passStatus === 'planned'; })
          ? '<button class="btn-sm fo-enter-invoice" data-group="' + util.escHtml(groupName) + '" style="margin-top:0.4rem;margin-left:0.5rem;font-size:0.72rem">&#128203; Enter Invoice</button>'
          : '') +
        '</div>' +
        '</div>';
    });

    if (!html) {
      var emptyStateHtml = '<p style="color:var(--text-light);font-size:0.8rem;padding:0.25rem 0 0.75rem">No inputs or passes yet — add items by operation type:</p>';
      window.FieldOpsGroups.GROUP_ORDER.forEach(function (g) {
        emptyStateHtml +=
          '<div class="fo-group" data-group="' + util.escHtml(g) + '" style="margin-bottom:0.5rem">' +
          '<div class="fo-group-header"><span class="fo-group-name">' + util.escHtml(g) + '</span></div>' +
          '<div class="fo-group-body">' +
          '<table class="compact-table fo-table" style="width:100%"><thead><tr></tr></thead><tbody></tbody></table>' +
          '<button class="btn-sm fo-add-item" data-group="' + util.escHtml(g) + '" style="margin-top:0.25rem;font-size:0.72rem">+ Add to ' + util.escHtml(g) + '</button>' +
          '</div></div>';
      });
      html = emptyStateHtml;
    }
    container.innerHTML = html;

    // Grand total
    var grandPerAc = Calc.round2(grandTotal);
    var grandField = Calc.round2(grandTotal * acres);
    if (grandTotalEl) {
      grandTotalEl.style.display = (grandTotal > 0 && !isOperator) ? 'flex' : 'none';
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

    // Wire rate cell inline edit
    container.querySelectorAll('.fo-rate-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        if (cell.querySelector('input')) return; // already open
        container.querySelectorAll('.fo-confirm-form-row').forEach(function (r) { r.remove(); });

        var sourceType = cell.getAttribute('data-source-type');
        var sourceIdx = parseInt(cell.getAttribute('data-source-idx'), 10);
        var arr = sourceType === 'machinery' ? (currentField.machinery || []) : (currentField.inputs || []);
        var sourceItem = arr[sourceIdx];
        if (!sourceItem) return;

        var isInputType = sourceType !== 'machinery';
        var usePerField = foViewMode === 'perField' && isInputType;
        var currentVal, label, perFieldCr, perFieldAcres;
        if (sourceType === 'machinery') {
          currentVal = sourceItem.passes || 1;
          label = 'passes';
        } else if (usePerField) {
          var pfProduct = (window.refData.products || []).find(function (p) {
            return p.name.trim().toLowerCase() === (sourceItem.productName || '').trim().toLowerCase();
          });
          perFieldCr    = pfProduct ? (pfProduct.conversionRate || 1) : 1;
          var pfUnit    = pfProduct ? (pfProduct.purchaseUnit || pfProduct.unit || '') : '';
          perFieldAcres = (currentField.plantedAcres > 0 ? currentField.plantedAcres : currentField.acres) || 0;
          var rawFQ     = Calc.round2((sourceItem.quantity || 0) * perFieldAcres);
          currentVal    = Math.round(rawFQ / perFieldCr * 1000) / 1000;
          label         = pfUnit || 'total';
        } else {
          currentVal = sourceItem.quantity || 0;
          label = 'qty';
        }
        var origHtml = cell.innerHTML;

        cell.innerHTML = '<input type="number" class="fo-rate-input" value="' + currentVal + '" step="0.1" min="0" ' +
          'style="width:60px;font-size:0.75rem;padding:0.1rem 0.2rem;text-align:right">' +
          '<span style="font-size:0.65rem;color:var(--text-light);margin-left:2px">' + label + '</span>';

        var input = cell.querySelector('.fo-rate-input');
        input.focus();
        input.select();

        function applyEdit() {
          var newVal = parseFloat(input.value);
          if (!isNaN(newVal) && newVal >= 0) {
            if (sourceType === 'machinery') {
              sourceItem.passes = newVal;
            } else if (usePerField) {
              if (perFieldAcres > 0) {
                sourceItem.quantity = Calc.round2((newVal * perFieldCr) / perFieldAcres);
              }
            } else {
              sourceItem.quantity = newVal;
            }
            renderFieldOpsPanel();
            updatePreview();
          } else {
            cell.innerHTML = origHtml;
          }
        }

        input.addEventListener('blur', applyEdit);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { input.blur(); }
          if (e.key === 'Escape') { input.removeEventListener('blur', applyEdit); cell.innerHTML = origHtml; }
        });
      });
    });

    // Wire name cell inline swap
    container.querySelectorAll('.fo-name-cell').forEach(function (cell) {
      cell.addEventListener('click', function () {
        if (cell.querySelector('input')) return;
        container.querySelectorAll('.fo-confirm-form-row').forEach(function (r) { r.remove(); });

        var sourceType = cell.getAttribute('data-source-type');
        var sourceIdx = parseInt(cell.getAttribute('data-source-idx'), 10);
        var arr = sourceType === 'machinery' ? (currentField.machinery || []) : (currentField.inputs || []);
        var sourceItem = arr[sourceIdx];
        if (!sourceItem) return;

        var currentName = sourceType === 'machinery' ? (sourceItem.implementName || '') : (sourceItem.productName || '');
        var listId = sourceType === 'machinery' ? 'impl-search-list' : 'prod-search-list';
        var origHtml = cell.innerHTML;

        cell.innerHTML = '<input type="text" class="fo-name-input" value="' + util.escHtml(currentName) + '" ' +
          'list="' + listId + '" style="font-size:0.75rem;width:130px;padding:0.1rem 0.2rem">';

        var input = cell.querySelector('.fo-name-input');
        input.focus();
        input.select();

        function applyNameEdit() {
          var newName = input.value.trim();
          if (newName && newName !== currentName) {
            if (sourceType === 'machinery') {
              sourceItem.implementName = newName;
            } else {
              sourceItem.productName = newName;
            }
            renderFieldOpsPanel();
            updatePreview();
          } else {
            cell.innerHTML = origHtml;
          }
        }

        input.addEventListener('blur', applyNameEdit);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { input.blur(); }
          if (e.key === 'Escape') { input.removeEventListener('blur', applyNameEdit); cell.innerHTML = origHtml; }
        });
      });
    });

    // Wire filter select
    var filterSelect = document.getElementById('fo-filter-select');
    if (filterSelect) {
      filterSelect.onchange = function () {
        foActiveFilter = filterSelect.value;
        renderFieldOpsPanel();
      };
    }

    // Wire per-ac / per-field view toggle
    var viewAcBtn = document.getElementById('fo-view-perac');
    var viewFieldBtn = document.getElementById('fo-view-perfield');
    if (viewAcBtn && viewFieldBtn) {
      function syncViewBtns() {
        viewAcBtn.style.background    = foViewMode === 'perAcre'  ? 'var(--primary)' : '';
        viewAcBtn.style.color         = foViewMode === 'perAcre'  ? 'var(--bg)'      : '';
        viewFieldBtn.style.background = foViewMode === 'perField' ? 'var(--primary)' : '';
        viewFieldBtn.style.color      = foViewMode === 'perField' ? 'var(--bg)'      : '';
      }
      viewAcBtn.onclick = function () {
        foViewMode = 'perAcre';
        syncViewBtns();
        renderFieldOpsPanel();
      };
      viewFieldBtn.onclick = function () {
        foViewMode = 'perField';
        syncViewBtns();
        renderFieldOpsPanel();
      };
      syncViewBtns();
    }

    // Wire status chip clicks — confirm/disregard/revert form
    container.querySelectorAll('.fo-status-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var sourceType = chip.getAttribute('data-source-type');
        var sourceIdx = parseInt(chip.getAttribute('data-source-idx'), 10);
        var arr = sourceType === 'machinery' ? (currentField.machinery || []) : (currentField.inputs || []);
        var sourceItem = arr[sourceIdx];
        if (!sourceItem) return;
        var currentStatus = sourceItem.passStatus || 'planned';

        // Close any existing confirm forms
        container.querySelectorAll('.fo-confirm-form-row').forEach(function (r) { r.remove(); });

        var parentRow = chip.closest('tr');
        if (!parentRow) return;

        var today = new Date().toISOString().slice(0, 10);
        var isInputType = sourceType === 'input' || sourceType === 'custom';
        var plannedQty = isInputType ? (sourceItem.quantity || 0) : null;
        var sourceProduct = isInputType ? (window.refData.products || []).find(function (p) {
          return p.name.trim().toLowerCase() === (sourceItem.productName || '').trim().toLowerCase();
        }) : null;
        var sourceUnit = sourceProduct ? (sourceProduct.unit || '') : '';
        var fieldAcresForForm = currentField.acres || 0;
        var cropAcresForForm = currentField.plantedAcres > 0 ? currentField.plantedAcres : fieldAcresForForm;
        var sourcePurchaseUnit = sourceProduct ? (sourceProduct.purchaseUnit || sourceUnit) : sourceUnit;
        var sourceConvRate = sourceProduct ? (sourceProduct.conversionRate || 1) : 1;
        var hintQtyRaw = isInputType ? Calc.round2((sourceItem.quantity || 0) * cropAcresForForm) : 0;
        var hintQtyTotal = sourceConvRate !== 1 ? Math.round(hintQtyRaw / sourceConvRate * 1000) / 1000 : hintQtyRaw;
        var hintUnit = sourcePurchaseUnit;

        var formRow = document.createElement('tr');
        formRow.className = 'fo-confirm-form-row';

        var formHtml = '<td colspan="8"><div class="fo-confirm-form-inner">';
        if (currentStatus !== 'planned') {
          // Confirmed — show edit invoice form pre-filled with existing values
          if (currentStatus === 'confirmed' && isInputType) {
            var eDate   = sourceItem.confirmedDate || today;
            var eBy     = sourceItem.confirmedBy || '';
            var eNote   = sourceItem.statusNote || '';
            var eInvNum = sourceItem.invoiceNumber || '';
            var eVendor = sourceItem.invoiceVendor || '';
            var eAcres  = sourceItem.invoiceAcres != null ? sourceItem.invoiceAcres : cropAcresForForm;
            var eQty    = sourceItem.invoiceQtyTotal != null ? sourceItem.invoiceQtyTotal : (hintQtyTotal || '');
            var eCost   = sourceItem.invoiceCostTotal != null ? sourceItem.invoiceCostTotal : '';
            var eUnit   = sourceItem.invoiceUnit || sourcePurchaseUnit || sourceUnit;
            formHtml +=
              '<span style="font-size:0.72rem;color:var(--text-light)">Date:</span>' +
              '<input type="date" class="fo-cf-date" value="' + util.escHtml(eDate) + '" style="font-size:0.75rem;padding:0.15rem">' +
              '<span style="font-size:0.72rem;color:var(--text-light)">Invoice #:</span>' +
              '<input type="text" class="fo-cf-inv-num" value="' + util.escHtml(eInvNum) + '" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
              '<span style="font-size:0.72rem;color:var(--text-light)">Vendor:</span>' +
              '<input type="text" class="fo-cf-inv-vendor" value="' + util.escHtml(eVendor) + '" style="font-size:0.75rem;width:80px;padding:0.15rem">' +
              '<span style="font-size:0.72rem;color:var(--text-light)">Inv. Acres:</span>' +
              '<input type="number" class="fo-cf-inv-acres" value="' + eAcres + '" step="0.1" style="font-size:0.75rem;width:55px;padding:0.15rem">' +
              '<span style="font-size:0.72rem;color:var(--text-light)">Field Qty:</span>' +
              '<input type="number" class="fo-cf-inv-qty" value="' + eQty + '" step="0.001" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
              '<span style="font-size:0.8rem;font-weight:600;margin-left:2px;min-width:28px;display:inline-block">' + util.escHtml(eUnit) + '</span>' +
              '<span style="font-size:0.72rem;color:var(--text-light)">Total $:</span>' +
              '<input type="number" class="fo-cf-inv-cost" value="' + eCost + '" step="0.01" style="font-size:0.75rem;width:70px;padding:0.15rem">' +
              '<span style="font-size:0.72rem;color:var(--text-light)">By:</span>' +
              '<input type="text" class="fo-cf-by" value="' + util.escHtml(eBy) + '" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
              '<span style="font-size:0.72rem;color:var(--text-light)">Note:</span>' +
              '<input type="text" class="fo-cf-note" value="' + util.escHtml(eNote) + '" style="font-size:0.75rem;width:80px;padding:0.15rem">' +
              '<button class="btn-sm btn-primary fo-cf-confirm" style="font-size:0.72rem">&#10003; Save</button>' +
              '<button class="btn-sm fo-cf-revert" style="font-size:0.72rem">&#8629; Revert</button>' +
              '<button class="btn-sm fo-cf-cancel" style="font-size:0.72rem">Cancel</button>';
          } else {
            // Disregarded or non-input confirmed — revert only
            formHtml += '<span style="font-size:0.75rem;color:var(--text-light)">Marked as <strong>' + util.escHtml(currentStatus) + '</strong></span>' +
              '<button class="btn-sm fo-cf-revert" style="font-size:0.72rem">&#8629; Revert to Planned</button>' +
              '<button class="btn-sm fo-cf-cancel" style="font-size:0.72rem">Cancel</button>';
          }
        } else if (foViewMode === 'perField' && isInputType) {
          // Invoice (per-field) entry form
          formHtml +=
            '<span style="font-size:0.72rem;color:var(--text-light)">Date:</span>' +
            '<input type="date" class="fo-cf-date" value="' + today + '" style="font-size:0.75rem;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">Invoice #:</span>' +
            '<input type="text" class="fo-cf-inv-num" placeholder="optional" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">Vendor:</span>' +
            '<input type="text" class="fo-cf-inv-vendor" placeholder="optional" style="font-size:0.75rem;width:80px;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">Inv. Acres:</span>' +
            '<input type="number" class="fo-cf-inv-acres" value="' + cropAcresForForm + '" step="0.1" style="font-size:0.75rem;width:55px;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">Field Qty:</span>' +
            '<input type="number" class="fo-cf-inv-qty" value="' + (hintQtyTotal || '') + '" step="0.001" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
            '<span style="font-size:0.8rem;font-weight:600;margin-left:2px;min-width:28px;display:inline-block">' + util.escHtml(hintUnit || '') + '</span>' +
            '<span style="font-size:0.72rem;color:var(--text-light)">Total $:</span>' +
            '<input type="number" class="fo-cf-inv-cost" placeholder="0.00" step="0.01" style="font-size:0.75rem;width:70px;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">Note:</span>' +
            '<input type="text" class="fo-cf-note" placeholder="optional" style="font-size:0.75rem;width:80px;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">By:</span>' +
            '<input type="text" class="fo-cf-by" placeholder="name" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
            '<button class="btn-sm btn-primary fo-cf-confirm" style="font-size:0.72rem">&#10003; Confirm</button>' +
            '<button class="btn-sm fo-cf-disregard" style="font-size:0.72rem">&#8212; Disregard</button>' +
            '<button class="btn-sm fo-cf-cancel" style="font-size:0.72rem">Cancel</button>';
        } else {
          formHtml += '<span style="font-size:0.72rem;color:var(--text-light)">Date:</span>' +
            '<input type="date" class="fo-cf-date" value="' + today + '" style="font-size:0.75rem;padding:0.15rem">';
          if (isInputType) {
            formHtml += '<span style="font-size:0.72rem;color:var(--text-light)">Actual qty:</span>' +
              '<input type="number" class="fo-cf-qty" value="' + plannedQty + '" step="0.1" style="font-size:0.75rem;width:70px;padding:0.15rem">';
          }
          formHtml += '<span style="font-size:0.72rem;color:var(--text-light)">Note:</span>' +
            '<input type="text" class="fo-cf-note" placeholder="optional" style="font-size:0.75rem;width:90px;padding:0.15rem">' +
            '<span style="font-size:0.72rem;color:var(--text-light)">By:</span>' +
            '<input type="text" class="fo-cf-by" placeholder="name" style="font-size:0.75rem;width:65px;padding:0.15rem">' +
            '<button class="btn-sm btn-primary fo-cf-confirm" style="font-size:0.72rem">&#10003; Confirm</button>' +
            '<button class="btn-sm fo-cf-disregard" style="font-size:0.72rem">&#8212; Disregard</button>' +
            '<button class="btn-sm fo-cf-cancel" style="font-size:0.72rem">Cancel</button>';
        }
        formHtml += '</div></td>';
        formRow.innerHTML = formHtml;
        parentRow.insertAdjacentElement('afterend', formRow);

        formRow.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var btn = formRow.querySelector('.fo-cf-confirm');
            if (btn) btn.click();
          }
        });

        formRow.querySelector('.fo-cf-cancel').addEventListener('click', function () { formRow.remove(); });

        var confirmBtn = formRow.querySelector('.fo-cf-confirm');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', function () {
            var date = formRow.querySelector('.fo-cf-date').value;
            var note = formRow.querySelector('.fo-cf-note').value.trim();
            var by = formRow.querySelector('.fo-cf-by').value.trim();
            sourceItem.passStatus = 'confirmed';
            sourceItem.confirmedDate = date || today;
            sourceItem.statusNote = note || null;
            sourceItem.confirmedBy = by || null;
            var invCostEl = formRow.querySelector('.fo-cf-inv-cost');
            if (invCostEl) {
              // Per-field invoice entry
              var invNum = (formRow.querySelector('.fo-cf-inv-num').value || '').trim();
              var invVendor = (formRow.querySelector('.fo-cf-inv-vendor').value || '').trim();
              var invDate = formRow.querySelector('.fo-cf-inv-date') ? formRow.querySelector('.fo-cf-inv-date').value : (date || today);
              var invAcres = parseFloat(formRow.querySelector('.fo-cf-inv-acres').value) || fieldAcresForForm;
              var invQty = parseFloat(formRow.querySelector('.fo-cf-inv-qty').value) || 0;
              var invCost = parseFloat(invCostEl.value) || 0;
              sourceItem.invoiceNumber = invNum || null;
              sourceItem.invoiceVendor = invVendor || null;
              sourceItem.invoiceDate = invDate || null;
              sourceItem.invoiceAcres = invAcres || null;
              sourceItem.invoiceQtyTotal = invQty || null;
              sourceItem.invoiceCostTotal = invCost || null;
              sourceItem.invoiceUnit = sourcePurchaseUnit || sourceUnit;
              sourceItem.actualQuantity = invAcres > 0 && invQty > 0 ? Calc.round2(invQty / invAcres) : (sourceItem.quantity || 0);
            } else {
              var qtyInput = formRow.querySelector('.fo-cf-qty');
              if (isInputType && qtyInput) sourceItem.actualQuantity = parseFloat(qtyInput.value) || sourceItem.quantity;
            }
            renderFieldOpsPanel();
            updatePreview();
          });
        }

        var disregardBtn = formRow.querySelector('.fo-cf-disregard');
        if (disregardBtn) {
          disregardBtn.addEventListener('click', function () {
            var note = formRow.querySelector('.fo-cf-note').value.trim();
            var by = formRow.querySelector('.fo-cf-by').value.trim();
            sourceItem.passStatus = 'disregarded';
            sourceItem.confirmedDate = null;
            sourceItem.actualQuantity = null;
            sourceItem.statusNote = note || null;
            sourceItem.confirmedBy = by || null;
            renderFieldOpsPanel();
            updatePreview();
          });
        }

        var revertBtn = formRow.querySelector('.fo-cf-revert');
        if (revertBtn) {
          revertBtn.addEventListener('click', function () {
            sourceItem.passStatus = 'planned';
            sourceItem.confirmedDate = null;
            sourceItem.actualQuantity = null;
            sourceItem.statusNote = null;
            sourceItem.confirmedBy = null;
            sourceItem.invoiceCostTotal = null;
            sourceItem.invoiceQtyTotal = null;
            sourceItem.invoiceAcres = null;
            sourceItem.invoiceNumber = null;
            sourceItem.invoiceVendor = null;
            sourceItem.invoiceDate = null;
            sourceItem.invoiceUnit = null;
            renderFieldOpsPanel();
            updatePreview();
          });
        }
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
          '<div style="position:relative;flex:1;min-width:140px">' +
          '<input type="text" class="fo-add-name" placeholder="Product or implement name..." ' +
          'style="font-size:0.75rem;width:100%">' +
          '<div class="prod-ac-dropdown fo-add-ac-dropdown"></div>' +
          '</div>' +
          '<input type="number" class="fo-add-qty" placeholder="Qty/Passes" step="0.1" min="0" ' +
          'style="font-size:0.75rem;width:75px">' +
          '<button class="btn-sm btn-primary fo-add-confirm" style="font-size:0.72rem;padding:0.2rem 0.5rem">Add</button>' +
          '<button class="btn-sm fo-add-cancel" style="font-size:0.72rem;padding:0.2rem 0.5rem">&#x2715;</button>' +
          '</div>' +
          '</td>' +
          '<td></td>';
        tbody.appendChild(addRow);

        var typeSelect = addRow.querySelector('.fo-add-type');
        var nameInput = addRow.querySelector('.fo-add-name');
        var acDropdown = addRow.querySelector('.fo-add-ac-dropdown');
        initFoAddAutocomplete(nameInput, typeSelect, acDropdown);
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

    // Wire "Enter Invoice" batch form buttons
    container.querySelectorAll('.fo-enter-invoice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var groupName = btn.getAttribute('data-group');
        var groupEl = btn.closest('.fo-group');
        if (!groupEl) return;

        // Toggle: close if already open
        var existing = groupEl.querySelector('.fo-invoice-batch-form');
        if (existing) { existing.remove(); return; }

        var today = new Date().toISOString().slice(0, 10);
        var fieldAcres = currentField.acres || 0;
        var cropAcres  = currentField.plantedAcres > 0 ? currentField.plantedAcres : fieldAcres;

        // Collect planned input/custom items in this group, respecting foSortOrder
        var plannedItems = [];
        (currentField.inputs || []).forEach(function (inp, idx) {
          if (inp.passStatus && inp.passStatus !== 'planned') return;
          var iType = (inp.productName || '').toLowerCase().indexOf('application -') === 0 ? 'custom' : 'input';
          var grp = inp.operationGroup || window.FieldOpsGroups.classifyItem(inp.productName || '', iType);
          if (grp !== groupName) return;
          var prod = (window.refData.products || []).find(function (p) {
            return p.name.trim().toLowerCase() === (inp.productName || '').trim().toLowerCase();
          });
          var rawUnit = prod ? (prod.unit || '') : '';
          var batchCr = prod ? (prod.conversionRate || 1) : 1;
          var batchPu = prod ? (prod.purchaseUnit || rawUnit) : rawUnit;
          var hintRaw = Calc.round2((inp.quantity || 0) * fieldAcres);
          var hintQty = batchCr !== 1 ? Math.round(hintRaw / batchCr * 1000) / 1000 : hintRaw;
          plannedItems.push({ idx: idx, name: inp.productName || '', hintQty: hintQty, unit: batchPu, sortOrder: inp.foSortOrder != null ? inp.foSortOrder : idx * 100 });
        });
        plannedItems.sort(function (a, b) { return a.sortOrder - b.sortOrder; });
        if (!plannedItems.length) return;

        var rowsHtml = plannedItems.map(function (pi) {
          return '<tr data-inp-idx="' + pi.idx + '">' +
            '<td style="font-size:0.78rem;padding:0.2rem 0.4rem;white-space:nowrap">' + util.escHtml(pi.name) + '</td>' +
            '<td style="padding:0.2rem 0.2rem"><input type="number" class="fo-inv-item-qty" value="' + (pi.hintQty || '') + '" step="0.001" style="width:62px;font-size:0.75rem;padding:0.15rem"></td>' +
            '<td style="padding:0.2rem 0.2rem"><input type="text" class="fo-inv-item-unit" value="' + util.escHtml(pi.unit) + '" style="width:40px;font-size:0.75rem;padding:0.15rem"></td>' +
            '<td style="padding:0.2rem 0.2rem"><input type="number" class="fo-inv-item-cost" placeholder="0.00" step="0.01" style="width:70px;font-size:0.75rem;padding:0.15rem"></td>' +
            '</tr>';
        }).join('');

        var batchHtml =
          '<div class="fo-invoice-batch-form" style="margin-top:0.5rem;padding:0.6rem;border:1px solid var(--border);border-radius:4px;background:var(--surface-2,var(--surface))">' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;align-items:center;margin-bottom:0.5rem">' +
          '<span style="font-size:0.72rem;color:var(--text-light)">Invoice #:</span>' +
          '<input type="text" class="fo-inv-num" style="width:70px;font-size:0.75rem;padding:0.15rem">' +
          '<span style="font-size:0.72rem;color:var(--text-light)">Vendor:</span>' +
          '<input type="text" class="fo-inv-vendor" placeholder="e.g. DeLong Co." style="width:100px;font-size:0.75rem;padding:0.15rem">' +
          '<span style="font-size:0.72rem;color:var(--text-light)">Date:</span>' +
          '<input type="date" class="fo-inv-date" value="' + today + '" style="font-size:0.75rem;padding:0.15rem">' +
          '<span style="font-size:0.72rem;color:var(--text-light)">Inv. Acres:</span>' +
          '<input type="number" class="fo-inv-acres" value="' + fieldAcres + '" step="0.1" style="width:55px;font-size:0.75rem;padding:0.15rem">' +
          '<span style="font-size:0.7rem;color:var(--text-light)">(crop ac: ' + cropAcres + ')</span>' +
          '<span style="font-size:0.72rem;color:var(--text-light)">By:</span>' +
          '<input type="text" class="fo-inv-by" style="width:65px;font-size:0.75rem;padding:0.15rem">' +
          '<span style="font-size:0.72rem;color:var(--text-light)">Note:</span>' +
          '<input type="text" class="fo-inv-note" style="width:90px;font-size:0.75rem;padding:0.15rem">' +
          '</div>' +
          '<table style="width:auto;font-size:0.78rem;margin-bottom:0.5rem;border-collapse:collapse">' +
          '<thead><tr>' +
          '<th style="text-align:left;padding:0.2rem 0.4rem;font-size:0.7rem;color:var(--text-light);font-weight:normal">Product</th>' +
          '<th style="padding:0.2rem 0.2rem;font-size:0.7rem;color:var(--text-light);font-weight:normal">Field Qty</th>' +
          '<th style="padding:0.2rem 0.2rem;font-size:0.7rem;color:var(--text-light);font-weight:normal">Unit</th>' +
          '<th style="padding:0.2rem 0.2rem;font-size:0.7rem;color:var(--text-light);font-weight:normal">Total $</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
          '</table>' +
          '<div style="display:flex;gap:0.4rem">' +
          '<button class="btn-sm fo-inv-confirm-all" style="font-size:0.72rem;background:var(--primary);color:var(--bg)">&#10003; Confirm All</button>' +
          '<button class="btn-sm fo-inv-cancel" style="font-size:0.72rem">Cancel</button>' +
          '</div></div>';

        var wrapper = document.createElement('div');
        wrapper.innerHTML = batchHtml;
        btn.parentElement.appendChild(wrapper.firstElementChild);

        var batchForm = groupEl.querySelector('.fo-invoice-batch-form');

        batchForm.querySelector('.fo-inv-cancel').addEventListener('click', function () { batchForm.remove(); });

        batchForm.querySelector('.fo-inv-confirm-all').addEventListener('click', function () {
          var invNum    = batchForm.querySelector('.fo-inv-num').value.trim();
          var invVendor = batchForm.querySelector('.fo-inv-vendor').value.trim();
          var invDate   = batchForm.querySelector('.fo-inv-date').value;
          var invAcres  = parseFloat(batchForm.querySelector('.fo-inv-acres').value) || fieldAcres;
          var invBy     = batchForm.querySelector('.fo-inv-by').value.trim();
          var invNote   = batchForm.querySelector('.fo-inv-note').value.trim();
          var today2    = new Date().toISOString().slice(0, 10);

          batchForm.querySelectorAll('tbody tr[data-inp-idx]').forEach(function (row) {
            var inpIdx = parseInt(row.getAttribute('data-inp-idx'), 10);
            var inp = (currentField.inputs || [])[inpIdx];
            if (!inp) return;
            var qty  = parseFloat(row.querySelector('.fo-inv-item-qty').value) || null;
            var unit = row.querySelector('.fo-inv-item-unit').value.trim() || null;
            var cost = parseFloat(row.querySelector('.fo-inv-item-cost').value) || null;
            inp.passStatus       = 'confirmed';
            inp.confirmedDate    = invDate || today2;
            inp.confirmedBy      = invBy || null;
            inp.statusNote       = invNote || null;
            inp.invoiceNumber    = invNum || null;
            inp.invoiceVendor    = invVendor || null;
            inp.invoiceDate      = invDate || null;
            inp.invoiceAcres     = invAcres || null;
            inp.invoiceQtyTotal  = qty;
            inp.invoiceUnit      = unit;
            inp.invoiceCostTotal = cost;
            inp.actualQuantity   = (invAcres > 0 && qty) ? Calc.round2(qty / invAcres) : inp.quantity;
          });

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

    function clearRowIndicators() {
      container.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(function (r) {
        r.classList.remove('drag-over-top', 'drag-over-bottom');
      });
    }

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
        clearRowIndicators();
        container.querySelectorAll('.fo-group').forEach(function (g) {
          g.classList.remove('fo-drop-target');
        });
        dragSrc = null;
      });

      // Within-group row reorder
      row.addEventListener('dragover', function (e) {
        if (!dragSrc) return;
        var rowGroup = row.closest('.fo-group') ? row.closest('.fo-group').getAttribute('data-group') : null;
        if (dragSrc.origGroup !== rowGroup) return;
        var isSelf = row.getAttribute('data-source-type') === dragSrc.sourceType &&
          parseInt(row.getAttribute('data-source-idx'), 10) === dragSrc.sourceIdx;
        if (isSelf) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        clearRowIndicators();
        var rect = row.getBoundingClientRect();
        row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
      });

      row.addEventListener('dragleave', function () {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!dragSrc) return;
        var rowGroup = row.closest('.fo-group') ? row.closest('.fo-group').getAttribute('data-group') : null;
        if (dragSrc.origGroup !== rowGroup) return;
        var tgtType = row.getAttribute('data-source-type');
        var tgtIdx = parseInt(row.getAttribute('data-source-idx'), 10);
        if (tgtType === dragSrc.sourceType && tgtIdx === dragSrc.sourceIdx) return;

        var rect = row.getBoundingClientRect();
        var insertAfter = e.clientY >= rect.top + rect.height / 2;

        // Build current ordered list from DOM rows in this group
        var groupEl = row.closest('.fo-group');
        var domRows = Array.from(groupEl.querySelectorAll('tbody tr[data-source-type]'));
        var ordered = domRows.map(function (r) {
          return { sourceType: r.getAttribute('data-source-type'), sourceIdx: parseInt(r.getAttribute('data-source-idx'), 10) };
        });

        var srcPos = ordered.findIndex(function (i) { return i.sourceType === dragSrc.sourceType && i.sourceIdx === dragSrc.sourceIdx; });
        var tgtPos = ordered.findIndex(function (i) { return i.sourceType === tgtType && i.sourceIdx === tgtIdx; });
        if (srcPos === -1 || tgtPos === -1) return;

        var moved = ordered.splice(srcPos, 1)[0];
        var dest = tgtPos > srcPos ? tgtPos - 1 : tgtPos;
        ordered.splice(insertAfter ? dest + 1 : dest, 0, moved);

        // Write foSortOrder back to backing arrays
        ordered.forEach(function (item, order) {
          var arr = item.sourceType === 'machinery' ? currentField.machinery : currentField.inputs;
          if (arr && arr[item.sourceIdx]) arr[item.sourceIdx].foSortOrder = order;
        });

        renderFieldOpsPanel();
        updatePreview();
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
    var previewField = JSON.parse(JSON.stringify(currentField));
    (previewField.inputs || []).forEach(function(inp) { delete inp.invoiceCostTotal; });
    var budget = Calc.computeFieldBudget(previewField, refs, window.refData.settings);

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
      if (section === 'fieldops-unified') renderFieldOpsPanel();
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
    select.innerHTML = '<option value="">-- Load Template --</option>';

    var qpcs = window.refData.quickPlanConfig || [];
    var programs = window.refData.programs || [];

    // Quick Plan Config entries first (formatted as crop — tillage)
    if (qpcs.length) {
      var qpcGroup = document.createElement('optgroup');
      qpcGroup.label = 'Templates';
      qpcs.forEach(function (qpc) {
        var label = [qpc.crop, qpc.variant && qpc.variant !== '—' ? qpc.variant : null, qpc.tillage]
          .filter(Boolean).join(' — ');
        var opt = document.createElement('option');
        opt.value = 'qpc:' + qpc.id;
        opt.textContent = label;
        qpcGroup.appendChild(opt);
      });
      select.appendChild(qpcGroup);
    }

    // Raw programs as fallback
    if (programs.length) {
      var progGroup = document.createElement('optgroup');
      progGroup.label = 'Programs';
      programs.forEach(function (prog) {
        var opt = document.createElement('option');
        opt.value = 'prog:' + prog.id;
        opt.textContent = prog.name + ' (' + (prog.crop || '--') + ')';
        if (currentField && currentField.templateId === prog.id) {
          opt.textContent += ' [current]';
        }
        progGroup.appendChild(opt);
      });
      select.appendChild(progGroup);
    }

    // Pre-select current template if set (raw program only)
    if (currentField && currentField.templateId) {
      select.value = 'prog:' + currentField.templateId;
    }
  }

  document.getElementById('ed-apply-program-btn').addEventListener('click', function () {
    var val = document.getElementById('ed-apply-program').value;
    if (!val) { util.showToast('Select a template first'); return; }

    var inputProg, machineryProg, templateName;

    if (val.indexOf('qpc:') === 0) {
      var qpcId = val.slice(4);
      var qpc = (window.refData.quickPlanConfig || []).find(function (c) { return c.id === qpcId; });
      if (!qpc) { util.showToast('Template not found'); return; }
      inputProg = (window.refData.programs || []).find(function (p) { return p.id === qpc.inputProgramId; });
      machineryProg = (window.refData.machineryPrograms || []).find(function (p) { return p.id === qpc.machineryProgramId; });
      templateName = [qpc.crop, qpc.variant && qpc.variant !== '—' ? qpc.variant : null, qpc.tillage]
        .filter(Boolean).join(' — ');
    } else {
      var progId = val.slice(5); // strip "prog:"
      inputProg = (window.refData.programs || []).find(function (p) { return p.id === progId; });
      machineryProg = null;
      templateName = inputProg ? inputProg.name : '';
    }

    if (!inputProg) { util.showToast('Program not found'); return; }

    if (!confirm('Load inputs and passes from "' + templateName + '"?\nYield, seed, and crop settings will not be changed.')) return;

    // Copy inputs from input program only
    currentField.inputs = JSON.parse(JSON.stringify(inputProg.inputs || []));
    currentField.inputs.forEach(function (inp) { inp.id = util.generateId('inp'); });

    // Copy machinery: prefer machineryProg, fall back to inputProg
    var machSource = (machineryProg || inputProg);
    currentField.machinery = JSON.parse(JSON.stringify(machSource.machinery || []));
    currentField.machinery.forEach(function (m) { m.id = util.generateId('mach'); });

    currentField.templateId = inputProg.id;

    // seed, yield, crop, cropType, systemCode, buyerId — never touched

    populateForm();
    updatePreview();
    util.showToast('Loaded "' + templateName + '" — inputs and passes updated');
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
