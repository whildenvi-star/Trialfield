// Ticket entry form and ticket log table
(function () {
  'use strict';

  var PAGE_SIZE = 50;
  var allTickets = [];
  var filteredTickets = [];
  var currentPage = 0;
  var sortCol = 'date';
  var sortDir = 'desc';
  var listLoaded = false;

  // --- Populate dropdowns when ref data loads ---
  window.addEventListener('ref-data-loaded', function () {
    var cropSelect = document.getElementById('entry-crop');
    var crops = Object.keys(refData.cropConfig).sort();
    crops.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c.trim();
      cropSelect.appendChild(opt);
    });

    var farmList = document.getElementById('farm-list');
    refData.farmNames.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f;
      farmList.appendChild(opt);
    });

    // Also populate filter dropdowns
    var filterFarm = document.getElementById('filter-farm');
    refData.farmNames.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f.trim();
      filterFarm.appendChild(opt);
    });

    var filterCrop = document.getElementById('filter-crop');
    crops.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c.trim();
      filterCrop.appendChild(opt);
    });

    // --- Populate destination dropdown (buyers + grain bins) ---
    var destSelect = document.getElementById('entry-destination');
    if (destSelect && refData.destinations && refData.destinations.length) {
      var bins = refData.destinations.filter(function (d) { return d.type === 'bin'; });
      var buyers = refData.destinations.filter(function (d) { return d.type === 'buyer'; });

      if (bins.length) {
        var binGroup = document.createElement('optgroup');
        binGroup.label = 'Grain Bins';
        bins.forEach(function (b) {
          var opt = document.createElement('option');
          opt.value = 'bin:' + b.id;
          opt.textContent = '[BIN] ' + b.name;
          binGroup.appendChild(opt);
        });
        destSelect.appendChild(binGroup);
      }

      if (buyers.length) {
        var buyerGroup = document.createElement('optgroup');
        buyerGroup.label = 'Buyers';
        buyers.forEach(function (b) {
          var opt = document.createElement('option');
          opt.value = 'buyer:' + b.id;
          opt.textContent = (b.shortCode ? b.shortCode + ' \u2014 ' : '') + b.name;
          buyerGroup.appendChild(opt);
        });
        destSelect.appendChild(buyerGroup);
      }

      // Restore sticky last-used destination
      var lastDest = localStorage.getItem('lastDestination');
      if (lastDest) {
        var found = destSelect.querySelector('option[value="' + lastDest + '"]');
        if (found) destSelect.value = lastDest;
      }
    }

    // --- Populate destination filter dropdown ---
    var filterDest = document.getElementById('filter-destination');
    if (filterDest && refData.destinations && refData.destinations.length) {
      var dBins = refData.destinations.filter(function (d) { return d.type === 'bin'; });
      var dBuyers = refData.destinations.filter(function (d) { return d.type === 'buyer'; });

      dBins.forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = 'bin:' + b.id;
        opt.textContent = '[BIN] ' + b.name;
        filterDest.appendChild(opt);
      });

      dBuyers.forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = 'buyer:' + b.id;
        opt.textContent = (b.shortCode ? b.shortCode + ' \u2014 ' : '') + b.name;
        filterDest.appendChild(opt);
      });
    }

    // --- Farm Registry autocomplete (enhances the datalist fallback) ---
    if (typeof FarmRegistry !== 'undefined') {
      var farmInput = document.getElementById('entry-farm');
      // Remove datalist binding so FarmRegistry dropdown takes over
      farmInput.removeAttribute('list');
      FarmRegistry.autocomplete(farmInput, {
        onSelect: function (field) {
          console.log('[FarmRegistry] Selected:', field.name, field.reportingAcres + ' ac');
        }
      });
      console.log('[FarmRegistry] Autocomplete attached to farm entry');
    }
  });

  // --- Live Preview ---
  var formFields = ['entry-netWeight', 'entry-moisture', 'entry-fm', 'entry-crop'];
  formFields.forEach(function (id) {
    document.getElementById(id).addEventListener('input', updatePreview);
    document.getElementById(id).addEventListener('change', updatePreview);
  });

  function updatePreview() {
    var crop = document.getElementById('entry-crop').value;
    if (!crop || !refData.cropConfig) {
      setPreview({});
      return;
    }

    var ticket = {
      netWeight: document.getElementById('entry-netWeight').value,
      moisture: document.getElementById('entry-moisture').value,
      fm: document.getElementById('entry-fm').value,
      crop: crop
    };

    var computed = Calc.computeTicket(ticket, refData.cropConfig);
    setPreview(computed);
  }

  function setPreview(c) {
    document.getElementById('prev-testWeight').textContent = c.testWeight || '--';
    document.getElementById('prev-moistureShrink').textContent = c.moistureShrink !== undefined ? c.moistureShrink + '%' : '--';
    document.getElementById('prev-discount').textContent = c.discount !== undefined ? c.discount : '--';
    document.getElementById('prev-fmDiscount').textContent = c.fmDiscountFactor !== undefined ? c.fmDiscountFactor : '--';
    document.getElementById('prev-grossBU').textContent = c.grossBU !== undefined ? util.formatNum(c.grossBU, 2) : '--';
    document.getElementById('prev-netBU').textContent = c.netBU !== undefined ? util.formatNum(c.netBU, 2) : '--';
  }

  // --- Form Submission ---
  document.getElementById('ticket-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;

    // Parse destination select value — composite key e.g. "buyer:5" or "bin:2"
    var destVal = document.getElementById('entry-destination').value;
    var destParts = destVal ? destVal.split(':') : [];
    var destType = destParts[0]; // "buyer" or "bin"
    var destId = destParts[1] ? parseInt(destParts[1], 10) : null;

    var body = {
      date: form.date.value,
      farm: form.farm.value,
      netWeight: form.netWeight.value,
      moisture: form.moisture.value,
      crop: form.crop.value,
      ticketNo: form.ticketNo.value,
      notes: form.notes.value,
      fm: form.fm.value,
      buyerId: destType === 'buyer' ? destId : null,
      grainBinId: destType === 'bin' ? destId : null
      // cropYear is derived server-side from date — not sent from client
    };

    // Pre-submit validation
    if (!body.crop) {
      util.showToast('Please select a crop', 3000, 'warning');
      return;
    }
    if (!body.farm.trim()) {
      util.showToast('Please enter a farm name', 3000, 'warning');
      return;
    }
    if (parseFloat(body.netWeight) <= 0) {
      util.showToast('Net weight must be greater than 0', 3000, 'warning');
      return;
    }
    if (!destVal) {
      util.showToast('Please select a destination', 3000, 'warning');
      return;
    }

    api.post('/api/tickets', body).then(function (result) {
      // Save sticky destination for next entry
      localStorage.setItem('lastDestination', destVal);
      util.showToast('Ticket ' + result.ticketNo + ' saved! Net BU: ' + util.formatNum(result._computed.netBU, 2));
      form.reset();
      // Re-set date to today
      document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
      // Restore sticky destination after form.reset() clears it
      document.getElementById('entry-destination').value = destVal;
      setPreview({});
      listLoaded = false; // Force reload on next tab switch
    }).catch(function (err) {
      if (err.status === 409) {
        util.showToast(err.data ? err.data.message : 'Duplicate ticket number', 5000, 'warning');
      } else if (err.status === 400 && err.data && err.data.messages) {
        util.showToast('Validation: ' + err.data.messages.join(', '), 5000, 'warning');
      } else {
        util.showToast('Error: ' + err.message, 5000, 'warning');
      }
    });
  });

  // Set default date to today
  document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];

  // --- Ticket Log ---
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'list' && !listLoaded) {
      loadTickets();
    }
  });

  function loadTickets() {
    api.get('/api/tickets').then(function (data) {
      allTickets = data;
      listLoaded = true;

      // Populate crop year filter from available ticket data
      var yearSelect = document.getElementById('filter-crop-year');
      var currentYear = yearSelect.value; // Preserve current selection
      // Clear existing year options (keep the "All Years" default)
      while (yearSelect.options.length > 1) yearSelect.remove(1);
      var years = [];
      allTickets.forEach(function (t) {
        if (t.cropYear && years.indexOf(t.cropYear) === -1) years.push(t.cropYear);
      });
      years.sort(function (a, b) { return b - a; }); // Descending
      years.forEach(function (y) {
        var opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      });
      if (currentYear) yearSelect.value = currentYear;

      applyFilters();
    });
  }

  // Filters
  ['filter-search', 'filter-farm', 'filter-crop', 'filter-destination', 'filter-crop-year', 'filter-date-from', 'filter-date-to'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  function applyFilters() {
    var search = document.getElementById('filter-search').value.toLowerCase();
    var farm = document.getElementById('filter-farm').value;
    var crop = document.getElementById('filter-crop').value;
    var destFilter = document.getElementById('filter-destination').value; // '' or 'buyer:5' or 'bin:2'
    var cropYearFilter = document.getElementById('filter-crop-year').value; // '' or '2025'
    var dateFrom = document.getElementById('filter-date-from').value;
    var dateTo = document.getElementById('filter-date-to').value;

    filteredTickets = allTickets.filter(function (t) {
      if (farm && t.farm !== farm) return false;
      if (crop && t.crop !== crop) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (destFilter) {
        var parts = destFilter.split(':');
        var dtype = parts[0];
        var did = parseInt(parts[1], 10);
        if (dtype === 'buyer' && t.buyerId !== did) return false;
        if (dtype === 'bin' && t.grainBinId !== did) return false;
      }
      if (cropYearFilter && t.cropYear !== parseInt(cropYearFilter, 10)) return false;
      if (search) {
        var haystack = [t.date, t.farm, t.netWeight, t.moisture, t.crop, t.ticketNo, t.notes, t.fm].join(' ').toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });

    sortTickets();
    currentPage = 0;
    renderTable();
  }

  function sortTickets() {
    filteredTickets.sort(function (a, b) {
      var va = util.getNestedVal(a, sortCol);
      var vb = util.getNestedVal(b, sortCol);
      if (va == null) va = '';
      if (vb == null) vb = '';
      var cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  // Sort headers
  document.querySelectorAll('#ticket-table th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var col = th.getAttribute('data-sort');
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      // Update header classes
      document.querySelectorAll('#ticket-table th').forEach(function (h) {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      sortTickets();
      renderTable();
    });
  });

  function renderTable() {
    var tbody = document.getElementById('ticket-tbody');
    var start = currentPage * PAGE_SIZE;
    var page = filteredTickets.slice(start, start + PAGE_SIZE);
    var totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));

    var totalBU = filteredTickets.reduce(function (sum, t) { return sum + (t._computed ? t._computed.netBU : 0); }, 0);
    document.getElementById('ticket-count').textContent = filteredTickets.length + ' tickets';
    document.getElementById('ticket-total-bu').textContent = 'Total Net BU: ' + util.formatNum(totalBU, 2);

    // Summary stats
    var totalMoisture = 0;
    var totalFm = 0;
    filteredTickets.forEach(function (t) {
      totalMoisture += (t.moisture || 0);
      totalFm += (t.fm || 0);
    });
    var count = filteredTickets.length;
    document.getElementById('stat-avg-moisture').textContent = count > 0 ? util.formatNum(totalMoisture / count, 1) : '--';
    document.getElementById('stat-avg-fm').textContent = count > 0 ? util.formatNum(totalFm / count, 2) : '--';
    document.getElementById('stat-avg-bu').textContent = count > 0 ? util.formatNum(totalBU / count, 2) : '--';

    var html = '';
    page.forEach(function (t) {
      var c = t._computed || {};

      // Resolve destination name from refData.destinations
      var destName = '';
      if (t.buyerId && refData.destinations) {
        var buyer = refData.destinations.find(function (d) { return d.type === 'buyer' && d.id === t.buyerId; });
        destName = buyer ? (buyer.shortCode || buyer.name) : 'Buyer #' + t.buyerId;
      } else if (t.grainBinId && refData.destinations) {
        var bin = refData.destinations.find(function (d) { return d.type === 'bin' && d.id === t.grainBinId; });
        destName = bin ? '[BIN] ' + bin.name : 'Bin #' + t.grainBinId;
      } else if (t.destination) {
        destName = t.destination; // legacy free-text for old tickets
      }

      html += '<tr data-id="' + t.id + '">';
      html += '<td><input type="checkbox" class="ticket-checkbox" data-id="' + t.id + '"></td>';
      html += '<td class="editable" data-field="date">' + (t.date || '') + '</td>';
      html += '<td class="editable" data-field="farm">' + (t.farm || '') + '</td>';
      html += '<td class="editable number" data-field="netWeight">' + util.formatNum(t.netWeight, 0) + '</td>';
      html += '<td class="editable number" data-field="moisture">' + util.formatNum(t.moisture, 1) + '</td>';
      html += '<td class="editable" data-field="crop">' + (t.crop || '').trim() + '</td>';
      html += '<td class="editable" data-field="ticketNo">' + (t.ticketNo || '') + '</td>';

      // Reconciliation status badge
      var reconStatus = (t._reconciliation && t._reconciliation.status) ? t._reconciliation.status : 'unreconciled';
      var reconLabels = { unreconciled: 'Unreconciled', matched: 'Matched', disputed: 'Disputed', manual: 'Manual' };
      var reconLabel = reconLabels[reconStatus] || 'Unreconciled';
      html += '<td><span class="badge badge-' + reconStatus + '">' + reconLabel + '</span></td>';

      html += '<td class="editable" data-field="notes">' + (t.notes || '') + '</td>';
      html += '<td>' + destName + '</td>';
      html += '<td class="editable number" data-field="fm">' + util.formatNum(t.fm, 2) + '</td>';
      html += '<td class="number">' + util.formatNum(c.grossBU, 2) + '</td>';
      html += '<td class="number" style="font-weight:600">' + util.formatNum(c.netBU, 2) + '</td>';
      html += '<td class="number">' + util.formatNum(c.discount, 2) + '</td>';
      html += '<td class="number">' + util.formatNum(c.testWeight, 0) + '</td>';
      html += '<td class="number">' + util.formatNum(c.moistureShrink, 0) + '</td>';
      html += '<td><button class="btn-danger" onclick="deleteTicket(\'' + t.id + '\')">Del</button></td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;

    // Pagination
    document.getElementById('page-info').textContent = 'Page ' + (currentPage + 1) + ' of ' + totalPages;
    document.getElementById('page-prev').disabled = currentPage === 0;
    document.getElementById('page-next').disabled = currentPage >= totalPages - 1;
  }

  // Pagination buttons
  document.getElementById('page-prev').addEventListener('click', function () {
    if (currentPage > 0) { currentPage--; renderTable(); }
  });
  document.getElementById('page-next').addEventListener('click', function () {
    var totalPages = Math.ceil(filteredTickets.length / PAGE_SIZE);
    if (currentPage < totalPages - 1) { currentPage++; renderTable(); }
  });

  // --- Inline Editing ---
  document.getElementById('ticket-tbody').addEventListener('dblclick', function (e) {
    var td = e.target.closest('td.editable');
    if (!td || td.classList.contains('editing')) return;

    var field = td.getAttribute('data-field');
    var tr = td.closest('tr');
    var id = tr.getAttribute('data-id');
    var ticket = allTickets.find(function (t) { return t.id === id; });
    if (!ticket) return;

    var oldVal = ticket[field];
    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = (field === 'date') ? 'date' : 'text';
    input.value = oldVal !== undefined && oldVal !== null ? oldVal : '';
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var newVal = input.value;
      td.classList.remove('editing');

      if (newVal === String(oldVal)) {
        // No change, just re-render
        renderTable();
        return;
      }

      var body = {};
      body[field] = newVal;
      api.put('/api/tickets/' + id, body).then(function (updated) {
        // Update local data
        var idx = allTickets.findIndex(function (t) { return t.id === id; });
        if (idx !== -1) allTickets[idx] = updated;
        applyFilters();
      });
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { input.blur(); }
      if (e.key === 'Escape') { td.classList.remove('editing'); renderTable(); }
    });
  });

  // --- Date Presets ---
  document.querySelectorAll('.preset-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var preset = btn.getAttribute('data-preset');
      var today = new Date();
      var from = '';
      var to = today.toISOString().split('T')[0];

      if (preset === 'week') {
        var dayOfWeek = today.getDay();
        var monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        from = monday.toISOString().split('T')[0];
      } else if (preset === 'month') {
        from = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
      } else if (preset === '30') {
        var d = new Date(today);
        d.setDate(d.getDate() - 30);
        from = d.toISOString().split('T')[0];
      } else {
        from = '';
        to = '';
      }

      document.getElementById('filter-date-from').value = from;
      document.getElementById('filter-date-to').value = to;
      applyFilters();
    });
  });

  // --- CSV Export ---
  document.getElementById('export-tickets-btn').addEventListener('click', function () {
    var params = [];
    var farm = document.getElementById('filter-farm').value;
    var crop = document.getElementById('filter-crop').value;
    var destFilter = document.getElementById('filter-destination').value;
    var cropYearFilter = document.getElementById('filter-crop-year').value;
    var dateFrom = document.getElementById('filter-date-from').value;
    var dateTo = document.getElementById('filter-date-to').value;
    if (farm) params.push('farm=' + encodeURIComponent(farm));
    if (crop) params.push('crop=' + encodeURIComponent(crop));
    if (destFilter) {
      var parts = destFilter.split(':');
      if (parts[0] === 'buyer') params.push('buyerId=' + parts[1]);
      if (parts[0] === 'bin') params.push('grainBinId=' + parts[1]);
    }
    if (cropYearFilter) params.push('cropYear=' + cropYearFilter);
    if (dateFrom) params.push('dateFrom=' + dateFrom);
    if (dateTo) params.push('dateTo=' + dateTo);
    var url = '/api/export/tickets' + (params.length ? '?' + params.join('&') : '');
    window.location.href = url;
  });

  // --- Delete ---
  window.deleteTicket = function (id) {
    if (!confirm('Delete this ticket?')) return;
    api.del('/api/tickets/' + id).then(function () {
      allTickets = allTickets.filter(function (t) { return t.id !== id; });
      applyFilters();
    });
  };

  // --- Batch Select / Delete ---
  document.getElementById('select-all-tickets').addEventListener('change', function () {
    var checked = this.checked;
    document.querySelectorAll('.ticket-checkbox').forEach(function (cb) { cb.checked = checked; });
    updateBatchBar();
  });

  document.getElementById('ticket-tbody').addEventListener('change', function (e) {
    if (e.target.classList.contains('ticket-checkbox')) {
      updateBatchBar();
    }
  });

  function updateBatchBar() {
    var checked = document.querySelectorAll('.ticket-checkbox:checked');
    var bar = document.getElementById('batch-bar');
    if (checked.length > 0) {
      bar.classList.remove('hidden');
      document.getElementById('batch-count').textContent = checked.length + ' selected';
    } else {
      bar.classList.add('hidden');
    }
  }

  document.getElementById('batch-delete-btn').addEventListener('click', function () {
    var checked = document.querySelectorAll('.ticket-checkbox:checked');
    var ids = [];
    checked.forEach(function (cb) { ids.push(cb.getAttribute('data-id')); });
    if (ids.length === 0) return;
    if (!confirm('Delete ' + ids.length + ' ticket(s)? This cannot be undone.')) return;

    fetch('/api/tickets/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids })
    })
    .then(function (r) { return r.json(); })
    .then(function (result) {
      allTickets = allTickets.filter(function (t) { return ids.indexOf(t.id) === -1; });
      document.getElementById('select-all-tickets').checked = false;
      applyFilters();
      util.showToast('Deleted ' + result.deleted + ' ticket(s)');
    });
  });

})();
