(function () {
  'use strict';

  // --- API helper ---
  var B = window.__BASE || '';
  function api(method, url, body) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    return fetch(B + url, opts).then(function (r) { return r.json(); });
  }

  // --- State ---
  var allFields = [];
  var filteredFields = [];
  var sortCol = 'name';
  var sortDir = 'asc';
  var selectedId = null;

  // --- Load fields ---
  function loadFields() {
    api('GET', '/api/fields?_t=' + Date.now()).then(function (data) {
      allFields = data;
      renderStats();
      applyFilters();
      if (selectedId) {
        var field = allFields.find(function (f) { return f.id === selectedId; });
        if (field) showEdit(field);
      }
    });
  }

  // --- Stats ---
  function renderStats() {
    var totalAcres = 0, organicAcres = 0, rented = 0, owned = 0, mixed = 0;
    allFields.forEach(function (f) {
      if (!f.active) return;
      totalAcres += f.reportingAcres || 0;
      organicAcres += f.organicAcres || 0;
      if (f.ownership === 'rented') rented++;
      else if (f.ownership === 'owned') owned++;
      else if (f.ownership === 'mixed') mixed++;
    });

    document.getElementById('stats-bar').innerHTML =
      statCard('Fields', allFields.filter(function (f) { return f.active; }).length) +
      statCard('Total Acres', formatNum(totalAcres, 2)) +
      statCard('Organic', formatNum(organicAcres, 2), 'organic') +
      statCard('Rented', rented) +
      statCard('Owned', owned) +
      statCard('Mixed', mixed);
  }

  function statCard(label, value, cls) {
    return '<div class="stat-card"><div class="label">' + label +
      '</div><div class="value' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';
  }

  // --- Filters ---
  ['search', 'filter-ownership', 'filter-organic'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  function applyFilters() {
    var search = document.getElementById('search').value.toLowerCase();
    var ownership = document.getElementById('filter-ownership').value;
    var organic = document.getElementById('filter-organic').value;

    filteredFields = allFields.filter(function (f) {
      if (!f.active) return false;
      if (ownership && f.ownership !== ownership) return false;
      if (organic === 'organic' && !(f.organicAcres > 0)) return false;
      if (organic === 'conventional' && f.organicAcres > 0) return false;
      if (search) {
        var haystack = [f.name].concat(f.aliases || []).join(' ').toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });

    sortFields();
    renderTable();
  }

  // --- Sorting ---
  function sortFields() {
    filteredFields.sort(function (a, b) {
      var va = a[sortCol], vb = b[sortCol];
      if (va == null) va = '';
      if (vb == null) vb = '';
      var cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  document.querySelectorAll('#field-table th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var col = th.getAttribute('data-sort');
      if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
      else { sortCol = col; sortDir = 'asc'; }
      document.querySelectorAll('#field-table th').forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      sortFields();
      renderTable();
    });
  });

  // --- Render table ---
  function renderTable() {
    var tbody = document.getElementById('field-tbody');
    var editPanel = document.getElementById('edit-panel');
    var editForm = document.getElementById('edit-form');

    // Park the form in the hidden holder before wiping innerHTML
    if (editForm && editForm.parentNode !== editPanel) {
      editPanel.appendChild(editForm);
    }

    var totalAcres = 0, totalOrganic = 0, totalRent = 0;
    var html = '';

    filteredFields.forEach(function (f) {
      totalAcres += f.reportingAcres || 0;
      totalOrganic += f.organicAcres || 0;
      totalRent += f.totalRentDollars || 0;
      var sel = f.id === selectedId ? ' selected' : '';
      var badge = '<span class="badge badge-' + f.ownership + '">' + f.ownership + '</span>';
      var rentDisplay = f.totalRentDollars > 0 ? '$' + formatNum(f.totalRentDollars, 0) : '-';

      html += '<tr class="field-row' + sel + '" data-id="' + f.id + '">';
      html += '<td><div style="display:flex;align-items:center;gap:7px;">' +
        buildSvgThumb(f.geometry || null, 30) +
        '<span style="font-weight:500;">' + esc(f.name) + '</span>' +
        '</div></td>';
      html += '<td class="number">' + formatNum(f.reportingAcres, 2) + '</td>';
      html += '<td class="number">' + (f.organicAcres > 0 ? '<span style="color:var(--organic);">' + formatNum(f.organicAcres, 2) + '</span>' : '-') + '</td>';
      html += '<td>' + badge + '</td>';
      html += '<td class="number rent-cell" data-id="' + f.id + '">' + rentDisplay + '</td>';
      html += '</tr>';
    });

    html += '<tr class="totals-row">';
    html += '<td>' + filteredFields.length + ' fields</td>';
    html += '<td class="number">' + formatNum(totalAcres, 2) + '</td>';
    html += '<td class="number" style="color:var(--organic);">' + formatNum(totalOrganic, 2) + '</td>';
    html += '<td></td>';
    html += '<td class="number" style="font-weight:600;">$' + formatNum(totalRent, 0) + '</td>';
    html += '</tr>';

    tbody.innerHTML = html;

    // Inject edit form as inline expansion
    if (editForm && (selectedId || isNew)) {
      var targetRow;
      if (isNew) {
        // New field form floats above all rows
        targetRow = null;
      } else {
        targetRow = tbody.querySelector('tr[data-id="' + selectedId + '"]');
      }

      if (targetRow || isNew) {
        var expTr = document.createElement('tr');
        expTr.className = 'expansion-row';
        var expTd = document.createElement('td');
        expTd.colSpan = 5;
        expTd.className = 'expansion-cell';
        expTd.appendChild(editForm);
        expTr.appendChild(expTd);

        if (isNew) {
          // Insert before first field row (or before totals if no rows)
          var firstRow = tbody.querySelector('tr.field-row') || tbody.querySelector('tr.totals-row');
          if (firstRow) {
            tbody.insertBefore(expTr, firstRow);
          } else {
            tbody.appendChild(expTr);
          }
        } else {
          targetRow.insertAdjacentElement('afterend', expTr);
        }
        editForm.style.display = 'block';
      }
    }

    // Inline edit for rent cells
    tbody.querySelectorAll('.rent-cell').forEach(function (td) {
      td.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        if (td.querySelector('input')) return;
        var fieldId = td.getAttribute('data-id');
        var field = allFields.find(function (f) { return f.id === fieldId; });
        if (!field) return;

        var input = document.createElement('input');
        input.type = 'number';
        input.step = '1';
        input.min = '0';
        input.value = field.totalRentDollars || 0;
        input.style.width = '80px';
        input.style.fontSize = '0.82rem';
        input.style.textAlign = 'right';
        td.textContent = '';
        td.appendChild(input);
        input.focus();
        input.select();

        function saveRent() {
          var val = parseFloat(input.value) || 0;
          field.totalRentDollars = val;
          fetch('/api/fields/' + fieldId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totalRentDollars: val })
          }).then(function () {
            renderTable();
          });
        }
        input.addEventListener('blur', saveRent);
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') input.blur();
          if (ev.key === 'Escape') renderTable();
        });
      });
    });
  }

  // --- Row click → toggle inline expansion ---
  document.getElementById('field-tbody').addEventListener('click', function (e) {
    // Ignore clicks inside the expansion cell (inputs, buttons, etc.)
    if (e.target.closest('.expansion-cell')) return;
    var row = e.target.closest('.field-row');
    if (!row) return;
    var id = row.getAttribute('data-id');
    if (!id) return;

    // Same row → collapse
    if (id === selectedId) {
      selectedId = null;
      isNew = false;
      renderTable();
      return;
    }

    var field = allFields.find(function (f) { return f.id === id; });
    if (field) showEdit(field);
  });

  // --- Show edit panel ---
  function showEdit(field) {
    selectedId = field.id;
    isNew = false;

    document.getElementById('edit-empty').style.display = 'none';
    document.getElementById('edit-form').style.display = 'block';
    document.getElementById('edit-title').textContent = field.name;
    document.getElementById('btn-delete').style.display = '';

    document.getElementById('shp-acres-banner').style.display = 'none';
    document.getElementById('edit-name').value = field.name;
    document.getElementById('edit-ownership').value = field.ownership || 'rented';
    document.getElementById('edit-reporting').value = field.reportingAcres || 0;
    document.getElementById('edit-cert-status').value = field.certStatus || 'conventional';
    document.getElementById('edit-notes').value = field.notes || '';

    // Tillable breakdown
    document.getElementById('edit-rented-tillable').value = field.rentedTillable || 0;
    document.getElementById('edit-owned-tillable').value = field.ownedTillable || 0;
    document.getElementById('edit-non-tillable').value = field.nonTillable || 0;

    // Certification acres by ownership
    document.getElementById('edit-organic-rented').value = field.organicRented || 0;
    document.getElementById('edit-organic-owned').value = field.organicOwned || 0;
    document.getElementById('edit-conv-rented').value = field.conventionalRented || 0;
    document.getElementById('edit-conv-owned').value = field.conventionalOwned || 0;
    document.getElementById('edit-trans-rented').value = field.transitionalRented || 0;
    document.getElementById('edit-trans-owned').value = field.transitionalOwned || 0;

    // Landlord
    document.getElementById('edit-landlord-name').value = field.landlordName || '';
    document.getElementById('edit-landlord-contact').value = field.landlordContact || '';

    // Rent
    document.getElementById('edit-rent-total').value = field.totalRentDollars || '';
    updateRentRate();

    renderAliases(field.aliases || []);
    renderShapefile(field);
    renderFsaSection(field);
    updateFormVisibility();
    updateAcreSums();
    renderTable();
  }

  // --- Aliases ---
  function renderAliases(aliases) {
    var container = document.getElementById('alias-list');
    container.innerHTML = aliases.map(function (a) {
      return '<span class="alias-tag">' + esc(a) +
        ' <button class="remove-alias" data-alias="' + esc(a) + '">&times;</button></span>';
    }).join('');
  }

  document.getElementById('alias-list').addEventListener('click', function (e) {
    if (!e.target.classList.contains('remove-alias')) return;
    var alias = e.target.getAttribute('data-alias');
    var field = allFields.find(function (f) { return f.id === selectedId; });
    if (!field) return;
    field.aliases = (field.aliases || []).filter(function (a) { return a !== alias; });
    renderAliases(field.aliases);
  });

  document.getElementById('btn-add-alias').addEventListener('click', function () {
    var input = document.getElementById('alias-input');
    var val = input.value.trim();
    if (!val) return;
    var field = allFields.find(function (f) { return f.id === selectedId; });
    if (!field) return;
    if (!field.aliases) field.aliases = [];
    if (!field.aliases.includes(val)) {
      field.aliases.push(val);
      renderAliases(field.aliases);
    }
    input.value = '';
  });

  document.getElementById('alias-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btn-add-alias').click();
    }
  });

  // --- Add new field ---
  var isNew = false;

  document.getElementById('btn-add-field').addEventListener('click', function () {
    isNew = true;
    selectedId = null;

    document.getElementById('edit-title').textContent = 'New Field';

    document.getElementById('edit-name').value = '';
    document.getElementById('edit-ownership').value = 'rented';
    document.getElementById('edit-reporting').value = '';
    document.getElementById('edit-cert-status').value = 'conventional';
    document.getElementById('edit-notes').value = '';
    document.getElementById('btn-delete').style.display = 'none';

    // Clear tillable breakdown
    document.getElementById('edit-rented-tillable').value = '0';
    document.getElementById('edit-owned-tillable').value = '0';
    document.getElementById('edit-non-tillable').value = '0';

    // Clear certification acres
    document.getElementById('edit-organic-rented').value = '0';
    document.getElementById('edit-organic-owned').value = '0';
    document.getElementById('edit-conv-rented').value = '0';
    document.getElementById('edit-conv-owned').value = '0';
    document.getElementById('edit-trans-rented').value = '0';
    document.getElementById('edit-trans-owned').value = '0';

    // Clear landlord
    document.getElementById('edit-landlord-name').value = '';
    document.getElementById('edit-landlord-contact').value = '';

    // Clear rent
    document.getElementById('edit-rent-total').value = '';
    updateRentRate();

    renderAliases([]);
    renderShapefile({ shapefiles: [] });
    updateFormVisibility();
    updateAcreSums();
    renderTable();
    document.getElementById('edit-name').focus();
  });

  // --- Delete field ---
  document.getElementById('btn-delete').addEventListener('click', function () {
    if (!selectedId) return;
    var field = allFields.find(function (f) { return f.id === selectedId; });
    if (!field) return;
    if (!confirm('Delete "' + field.name + '"? This cannot be undone.')) return;

    api('DELETE', '/api/fields/' + selectedId).then(function () {
      selectedId = null;
      isNew = false;
      loadFields();
    });
  });

  // --- Save (create or update) ---
  document.getElementById('btn-save').addEventListener('click', function () {
    var name = document.getElementById('edit-name').value.trim();
    if (!name) { alert('Field name is required'); return; }

    var ownership = document.getElementById('edit-ownership').value;
    var certStatus = document.getElementById('edit-cert-status').value;
    var reporting = val('edit-reporting');

    // Validate only visible sections
    if (reporting > 0) {
      if (ownership === 'mixed') {
        var tillDiff = Math.abs(getVisibleTillableSum() - reporting);
        if (tillDiff >= 0.005) {
          alert('Tillable breakdown (' + getVisibleTillableSum().toFixed(2) + ') does not equal acres (' + reporting.toFixed(2) + ').');
          return;
        }
      }
      if (certStatus === 'split') {
        var certDiff = Math.abs(getVisibleCertSum() - reporting);
        if (certDiff >= 0.005) {
          alert('Certification acres (' + getVisibleCertSum().toFixed(2) + ') does not equal acres (' + reporting.toFixed(2) + ').');
          return;
        }
      }
    }

    var field = selectedId ? allFields.find(function (f) { return f.id === selectedId; }) : null;
    var aliases = field ? field.aliases : [name];

    // Auto-compute tillable breakdown for non-mixed ownership
    var rentedTillable, ownedTillable, nonTillable;
    if (ownership === 'rented') {
      nonTillable = Math.min(val('edit-non-tillable'), reporting);
      rentedTillable = reporting - nonTillable;
      ownedTillable = 0;
    } else if (ownership === 'owned') {
      nonTillable = Math.min(val('edit-non-tillable'), reporting);
      ownedTillable = reporting - nonTillable;
      rentedTillable = 0;
    } else {
      rentedTillable = val('edit-rented-tillable');
      ownedTillable = val('edit-owned-tillable');
      nonTillable = val('edit-non-tillable');
    }

    // Rented vs owned totals for cert assignment
    var rentedTotal = rentedTillable;
    var ownedTotal = ownedTillable;

    // Auto-compute cert acres for non-split status
    var organicRented = 0, organicOwned = 0;
    var conventionalRented = 0, conventionalOwned = 0;
    var transitionalRented = 0, transitionalOwned = 0;

    if (certStatus === 'split') {
      organicRented = val('edit-organic-rented');
      organicOwned = val('edit-organic-owned');
      conventionalRented = val('edit-conv-rented');
      conventionalOwned = val('edit-conv-owned');
      transitionalRented = val('edit-trans-rented');
      transitionalOwned = val('edit-trans-owned');
    } else if (certStatus === 'organic') {
      organicRented = rentedTotal;
      organicOwned = ownedTotal;
    } else if (certStatus === 'conventional') {
      conventionalRented = rentedTotal;
      conventionalOwned = ownedTotal;
    } else if (certStatus === 'transitional') {
      transitionalRented = rentedTotal;
      transitionalOwned = ownedTotal;
    }

    var body = {
      name: name,
      ownership: ownership,
      certStatus: certStatus,
      reportingAcres: reporting,
      organicAcres: organicRented + organicOwned,
      notes: document.getElementById('edit-notes').value.trim(),
      aliases: aliases,
      growerId: (allFields[0] && allFields[0].growerId) || 'grw_001',
      rentedTillable: rentedTillable,
      ownedTillable: ownedTillable,
      nonTillable: nonTillable,
      organicRented: organicRented,
      organicOwned: organicOwned,
      conventionalRented: conventionalRented,
      conventionalOwned: conventionalOwned,
      transitionalRented: transitionalRented,
      transitionalOwned: transitionalOwned,
      landlordName: document.getElementById('edit-landlord-name').value.trim(),
      landlordContact: document.getElementById('edit-landlord-contact').value.trim(),
      totalRentDollars: parseFloat(document.getElementById('edit-rent-total').value) || 0
    };

    var method = isNew ? 'POST' : 'PUT';
    var url = isNew ? '/api/fields' : '/api/fields/' + selectedId;

    var btn = document.getElementById('btn-save');
    var originalText = btn.textContent;
    btn.textContent = 'Saving...';
    btn.disabled = true;

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(function (res) {
      btn.textContent = originalText;
      btn.disabled = false;
      if (!res.ok) return res.json().then(function (err) { throw err; });
      return res.json();
    })
    .then(function (saved) {
      var toast = document.getElementById('save-toast');
      toast.textContent = isNew ? 'Field created' : 'Saved';
      toast.className = 'save-toast';
      toast.classList.remove('hidden');
      setTimeout(function () { toast.classList.add('hidden'); }, 2000);
      isNew = false;
      selectedId = saved.id;
      document.getElementById('btn-delete').style.display = '';
      loadFields();
    })
    .catch(function (err) {
      btn.textContent = originalText;
      btn.disabled = false;
      var toast = document.getElementById('save-toast');
      var msg = 'Save failed';
      if (err && err.errors && err.errors.length) {
        msg = err.errors.map(function (e) { return e.message; }).join('. ');
      }
      toast.textContent = msg;
      toast.className = 'save-toast save-toast-error';
      toast.classList.remove('hidden');
      setTimeout(function () { toast.classList.add('hidden'); }, 4000);
      // Do NOT call loadFields() — retain user's form edits so they can fix and retry
    });
  });

  // --- Shapefile UI ---
  function renderShapefile(field) {
    var status = document.getElementById('shp-status');
    var removeBtn = document.getElementById('btn-shp-remove');
    var downloadBtn = document.getElementById('btn-shp-download');
    var files = field.shapefiles || [];
    if (files.length > 0) {
      status.textContent = files.join(', ');
      status.className = 'shp-status has-file';
      removeBtn.style.display = '';
      downloadBtn.style.display = '';
      downloadBtn.href = '/api/fields/' + field.id + '/shapefile';
    } else {
      status.textContent = 'No file uploaded';
      status.className = 'shp-status';
      removeBtn.style.display = 'none';
      downloadBtn.style.display = 'none';
    }
  }

  document.getElementById('shp-upload').addEventListener('change', function () {
    if (!selectedId || !this.files.length) return;
    var formData = new FormData();
    for (var i = 0; i < this.files.length; i++) {
      formData.append('files', this.files[i]);
    }
    fetch('/api/fields/' + selectedId + '/shapefile', {
      method: 'POST',
      body: formData
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.ok) {
        var toast = document.getElementById('save-toast');
        toast.textContent = 'Shapefile uploaded';
        toast.classList.remove('hidden');
        setTimeout(function () { toast.classList.add('hidden'); }, 2000);
        loadFields();

        // Show computed acres banner if available
        var banner = document.getElementById('shp-acres-banner');
        if (data.computedAcres != null) {
          banner.innerHTML = 'Shapefile: <strong>' + data.computedAcres.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
            ' acres</strong> <button class="btn btn-sm btn-primary shp-use-btn" type="button">Use</button>';
          banner.style.display = '';
          banner.querySelector('.shp-use-btn').onclick = function () {
            document.getElementById('edit-reporting').value = data.computedAcres;
            banner.style.display = 'none';
          };
        } else {
          banner.style.display = 'none';
        }
      }
    });
    this.value = '';
  });

  document.getElementById('btn-shp-remove').addEventListener('click', function () {
    if (!selectedId) return;
    if (!confirm('Remove shapefile for this field?')) return;
    api('DELETE', '/api/fields/' + selectedId + '/shapefile').then(function () {
      loadFields();
    });
  });

  // --- FSA Reporting Section ---
  function renderFsaSection(field) {
    var loading = document.getElementById('fsa-loading');
    var empty = document.getElementById('fsa-empty');
    var error = document.getElementById('fsa-error');
    var dataDiv = document.getElementById('fsa-data');
    var tbody = document.getElementById('fsa-tbody');
    var comparison = document.getElementById('fsa-comparison');

    loading.style.display = '';
    empty.style.display = 'none';
    error.style.display = 'none';
    dataDiv.style.display = 'none';

    // Normalize: lowercase, strip punctuation, collapse whitespace
    function normName(n) {
      return n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    }
    var names = [field.name].concat(field.aliases || []).map(normName);

    fetch('/api/fsa/clu-records')
      .then(function (r) { return r.json(); })
      .then(function (records) {
        loading.style.display = 'none';

        // Match CLU records by field name (normalized)
        var matched = records.filter(function (clu) {
          return clu.fieldName && names.indexOf(normName(clu.fieldName)) !== -1;
        });

        if (!matched.length) {
          empty.style.display = '';
          return;
        }

        // Sort by farm #, tract, CLU
        matched.sort(function (a, b) {
          var c = String(a.farmNumber || '').localeCompare(String(b.farmNumber || ''));
          if (c !== 0) return c;
          c = String(a.tractNumber || '').localeCompare(String(b.tractNumber || ''));
          if (c !== 0) return c;
          return Number(a.clu || 0) - Number(b.clu || 0);
        });

        // Non-crop codes
        var NON_CROP = ['nc', 'crp', 'gls', 'idle', 'grass'];
        function isNonCrop(crop) {
          return NON_CROP.indexOf((crop || '').trim().toLowerCase()) !== -1;
        }

        // Render table — dim non-crop rows
        var html = '';
        var fsaCrop = 0, fsaOther = 0;
        matched.forEach(function (clu) {
          var acres = clu.fsaAcres || 0;
          var nonCrop = isNonCrop(clu.crop);
          if (nonCrop) { fsaOther += acres; } else { fsaCrop += acres; }
          html += '<tr' + (nonCrop ? ' class="fsa-noncrop"' : '') + '>';
          html += '<td>' + esc(String(clu.farmNumber || '')) + '</td>';
          html += '<td>' + esc(String(clu.tractNumber || '')) + '</td>';
          html += '<td>' + esc(String(clu.clu || '')) + '</td>';
          html += '<td>' + esc(String(clu.crop || '')) + '</td>';
          html += '<td class="number">' + (acres ? acres.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-') + '</td>';
          html += '<td>' + (clu.irrigated ? '<span class="fsa-badge fsa-irr">Irr</span>' : '<span class="fsa-badge fsa-dry">Dry</span>') + '</td>';
          html += '<td>' + (clu.organic ? '<span class="fsa-badge fsa-org">Org</span>' : '<span class="fsa-badge fsa-conv">Conv</span>') + '</td>';
          html += '</tr>';
        });
        tbody.innerHTML = html;

        // Comparison — delta is registry vs FSA crop only
        function fmt(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
        var regAcres = field.reportingAcres || 0;
        var delta = fsaCrop - regAcres;
        var absDelta = Math.abs(delta);
        var deltaClass = absDelta < 1 ? 'fsa-delta-ok' : 'fsa-delta-warn';
        var sign = delta > 0 ? '+' : '';
        comparison.innerHTML =
          '<span>FSA Crop: <strong>' + fmt(fsaCrop) + '</strong></span>' +
          '<span class="fsa-sep">|</span>' +
          '<span class="fsa-other-label">Other: <strong>' + fmt(fsaOther) + '</strong></span>' +
          '<span class="fsa-sep">|</span>' +
          '<span>Registry: <strong>' + fmt(regAcres) + '</strong></span>' +
          '<span class="fsa-sep">|</span>' +
          '<span class="' + deltaClass + '">Delta: <strong>' + sign + fmt(delta) + '</strong></span>';

        dataDiv.style.display = '';
      })
      .catch(function () {
        loading.style.display = 'none';
        error.style.display = '';
      });
  }

  // --- Ownership + cert status driven visibility ---
  // All sections show for every ownership type so owned fields can track
  // opportunity-cost rent and landlord info the same way rented fields do.
  function updateFormVisibility() {
    var certStatus = document.getElementById('edit-cert-status').value;

    // Tillable section: always visible — all fields get rented/owned/non-tillable breakdown
    document.getElementById('section-tillable').style.display = '';
    document.getElementById('group-rented-tillable').style.display = '';
    document.getElementById('group-owned-tillable').style.display = '';
    document.getElementById('group-non-tillable').style.display = '';

    // Cert section: hidden unless "split"
    document.getElementById('section-cert').style.display = (certStatus === 'split') ? '' : 'none';
    // Within cert table: always show both rented/owned columns
    document.querySelectorAll('#cert-acres-table .col-rented').forEach(function (el) {
      el.style.display = '';
    });
    document.querySelectorAll('#cert-acres-table .col-owned').forEach(function (el) {
      el.style.display = '';
    });

    // Landlord section: always visible
    document.getElementById('section-landlord').style.display = '';

    // Rent section: always visible (owned fields use it for opportunity-cost tracking)
    document.getElementById('section-rent').style.display = '';

    // Tillable balance: always visible
    document.getElementById('tillable-sum').style.display = '';
    // Cert balance: only for split
    document.getElementById('cert-sum').style.display = (certStatus === 'split') ? '' : 'none';
  }

  document.getElementById('edit-ownership').addEventListener('change', function () {
    updateFormVisibility();
    updateAcreSums();
  });

  document.getElementById('edit-cert-status').addEventListener('change', function () {
    updateFormVisibility();
    updateAcreSums();
  });

  // --- Acre balance validation ---
  function val(id) { return parseFloat(document.getElementById(id).value) || 0; }

  function getVisibleTillableSum() {
    var ownership = document.getElementById('edit-ownership').value;
    if (ownership === 'mixed') {
      return val('edit-rented-tillable') + val('edit-owned-tillable') + val('edit-non-tillable');
    }
    // For rented/owned, nonTillable is the only user-editable part
    return val('edit-non-tillable');
  }

  function getVisibleCertSum() {
    var ownership = document.getElementById('edit-ownership').value;
    var sum = 0;
    if (ownership === 'rented' || ownership === 'mixed') {
      sum += val('edit-organic-rented') + val('edit-conv-rented') + val('edit-trans-rented');
    }
    if (ownership === 'owned' || ownership === 'mixed') {
      sum += val('edit-organic-owned') + val('edit-conv-owned') + val('edit-trans-owned');
    }
    return sum;
  }

  function updateAcreSums() {
    var reporting = val('edit-reporting');
    var ownership = document.getElementById('edit-ownership').value;
    var certStatus = document.getElementById('edit-cert-status').value;

    function renderSum(el, sum, target) {
      if (target === 0 && sum === 0) {
        el.textContent = '';
        el.className = 'acre-sum';
        return;
      }
      var diff = Math.abs(sum - target);
      var balanced = diff < 0.005;
      el.textContent = sum.toFixed(2) + ' of ' + target.toFixed(2) + ' ac' + (balanced ? ' \u2713' : ' (\u00B1' + diff.toFixed(2) + ')');
      el.className = 'acre-sum ' + (balanced ? 'acre-sum-ok' : 'acre-sum-err');
    }

    if (ownership === 'mixed') {
      renderSum(document.getElementById('tillable-sum'), getVisibleTillableSum(), reporting);
    } else if (reporting > 0) {
      // For rented/owned, show auto-computed tillable vs non-tillable
      var nt = val('edit-non-tillable');
      var tillable = reporting - nt;
      var el = document.getElementById('tillable-sum');
      if (nt > 0) {
        el.textContent = 'Tillable: ' + Math.max(0, tillable).toFixed(2) + ' ac | Non-tillable: ' + nt.toFixed(2) + ' ac';
        el.className = 'acre-sum ' + (nt <= reporting ? 'acre-sum-ok' : 'acre-sum-err');
      } else {
        el.textContent = '';
        el.className = 'acre-sum';
      }
    }
    if (certStatus === 'split') {
      renderSum(document.getElementById('cert-sum'), getVisibleCertSum(), reporting);
    }
  }

  // Listen on all acre inputs
  ['edit-reporting', 'edit-rented-tillable', 'edit-owned-tillable', 'edit-non-tillable',
   'edit-organic-rented', 'edit-organic-owned', 'edit-conv-rented', 'edit-conv-owned',
   'edit-trans-rented', 'edit-trans-owned'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', updateAcreSums);
  });

  // --- Rent rate computation ---
  function updateRentRate() {
    var totalRent = parseFloat(document.getElementById('edit-rent-total').value) || 0;
    var acres = parseFloat(document.getElementById('edit-reporting').value) || 0;
    var display = document.getElementById('rent-rate-display');
    if (totalRent > 0 && acres > 0) {
      var rate = totalRent / acres;
      display.innerHTML = '<strong>' + formatNum(rate, 2) + '</strong>/ac' +
        ' <span style="opacity:0.7;font-size:0.85em;">($' + formatNum(totalRent, 0) + ' / ' + formatNum(acres, 2) + ' ac)</span>';
      display.style.color = 'var(--text)';
    } else {
      display.textContent = '\u2014';
      display.style.color = '';
    }
  }

  document.getElementById('edit-rent-total').addEventListener('input', updateRentRate);
  document.getElementById('edit-reporting').addEventListener('input', updateRentRate);

  // Rent section always visible (owned fields track opportunity-cost rent)
  function updateRentVisibility() {
    // no-op: rent section stays visible for all ownership types
  }

  document.getElementById('edit-ownership').addEventListener('change', updateRentVisibility);

  // --- Field boundary SVG thumbnail ---
  function buildSvgThumb(geometry, size) {
    size = size || 32;
    if (!geometry || !geometry.coordinates) return thumbPlaceholder(size);

    var allBbox = [];
    function collectRing(ring) {
      for (var i = 0; i < ring.length; i++) allBbox.push(ring[i]);
    }
    if (geometry.type === 'Polygon') {
      if (geometry.coordinates[0]) collectRing(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      for (var pi = 0; pi < geometry.coordinates.length; pi++) {
        if (geometry.coordinates[pi][0]) collectRing(geometry.coordinates[pi][0]);
      }
    } else {
      return thumbPlaceholder(size);
    }

    if (!allBbox.length) return thumbPlaceholder(size);

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < allBbox.length; i++) {
      var c = allBbox[i];
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
    }

    var dX = maxX - minX || 0.001;
    var dY = maxY - minY || 0.001;
    var pad = size * 0.1;
    var usable = size - 2 * pad;
    var scale = Math.min(usable / dX, usable / dY);
    var offX = pad + (usable - dX * scale) / 2;
    var offY = pad + (usable - dY * scale) / 2;

    function project(coord) {
      return [
        (offX + (coord[0] - minX) * scale).toFixed(1),
        ((size - offY) - (coord[1] - minY) * scale).toFixed(1)
      ];
    }

    function ringPath(ring) {
      return ring.map(function (c, j) {
        var pt = project(c);
        return (j === 0 ? 'M' : 'L') + pt[0] + ' ' + pt[1];
      }).join(' ') + ' Z';
    }

    var paths = [];
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach(function (ring) { paths.push(ringPath(ring)); });
    } else {
      geometry.coordinates.forEach(function (poly) {
        poly.forEach(function (ring) { paths.push(ringPath(ring)); });
      });
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;flex-shrink:0;">' +
      '<path d="' + paths.join(' ') + '" fill="rgba(139,115,85,0.13)" stroke="#8B7355"' +
      ' stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd"/>' +
      '</svg>';
  }

  function thumbPlaceholder(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size +
      '" style="display:block;flex-shrink:0;opacity:0.25;">' +
      '<rect x="4" y="4" width="' + (size - 8) + '" height="' + (size - 8) +
      '" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>' +
      '</svg>';
  }

  // --- Utilities ---
  function formatNum(n, decimals) {
    if (n === null || n === undefined) return '-';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Init ---
  loadFields();
})();
