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

  // Build crop autocomplete from farm-registry /api/registry/crops
  // Cache fetched crops for the session
  var _registryCrops = null; // Array of { id, name, category, organic }

  function fetchRegistryCrops(callback) {
    if (_registryCrops) { callback(_registryCrops); return; }
    fetch('/api/registry/crops')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (crops) {
        if (crops && crops.length > 0) {
          _registryCrops = crops;
          // Cache for offline use
          if (window.ticketQueue) window.ticketQueue.cacheRef('registryCrops', crops);
        } else {
          // Registry returned empty — use empty list (no local fallback per user decision)
          _registryCrops = [];
        }
        callback(_registryCrops);
      })
      .catch(function () {
        // Try IDB cache before giving up
        if (window.ticketQueue) {
          window.ticketQueue.getRef('registryCrops').then(function (cached) {
            _registryCrops = cached || [];
            callback(_registryCrops);
          });
        } else {
          _registryCrops = [];
          callback(_registryCrops);
        }
      });
  }

  function attachCropAutocomplete(inputEl) {
    var allCrops = []; // { name, cropType (category), registryCropId }
    var dropdown = null;
    var selectedIdx = -1;
    var selectableItems = [];

    function buildCropList(registryCrops) {
      allCrops = [];
      // Configured crops (CropConfig for the active crop year) are the ONLY names
      // the server accepts — offer exactly those so entry stays consistent.
      // Registry crops enrich them with category grouping + registryCropId.
      var configNames = Object.keys((window.refData && refData.cropConfig) || {});
      var registryByName = {};
      (registryCrops || []).forEach(function (c) {
        registryByName[(c.name || '').trim().toLowerCase()] = c;
      });
      if (configNames.length > 0) {
        configNames.sort().forEach(function (name) {
          var reg = registryByName[name.trim().toLowerCase()];
          allCrops.push({
            name: name,
            cropType: reg ? (reg.category || 'Other') : 'Other',
            registryCropId: reg ? reg.id : null
          });
        });
      } else if (registryCrops && registryCrops.length > 0) {
        // Fallback when crop config is unavailable (e.g. offline cold start)
        registryCrops.forEach(function (c) {
          allCrops.push({ name: c.name, cropType: c.category || 'Other', registryCropId: c.id });
        });
      }
    }

    // Create dropdown container
    dropdown = document.createElement('div');
    dropdown.className = 'crop-ac-dropdown';
    dropdown.style.display = 'none';
    var wrapper = inputEl.parentNode;
    if (getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }
    wrapper.appendChild(dropdown);

    // Pre-fetch registry crops so dropdown is ready when user focuses the input
    fetchRegistryCrops(function () { /* crops loaded into _registryCrops */ });

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function filterAndRender(query) {
      buildCropList(_registryCrops || []);
      var q = (query || '').toLowerCase();
      var matched = allCrops.filter(function (c) {
        return !q || c.name.toLowerCase().indexOf(q) !== -1;
      });

      if (matched.length === 0) {
        dropdown.innerHTML = '<div class="crop-ac-empty">No match — crop must exist in this year\'s crop config</div>';
        dropdown.style.display = 'block';
        selectableItems = [];
        selectedIdx = -1;
        positionDropdown();
        return;
      }

      // Group by cropType
      var groups = {};
      var groupOrder = [];
      matched.forEach(function (c) {
        var key = c.cropType || 'Other';
        if (!groups[key]) {
          groups[key] = [];
          groupOrder.push(key);
        }
        groups[key].push(c);
      });

      var html = '';
      selectableItems = [];
      groupOrder.forEach(function (gName) {
        html += '<div class="crop-ac-group">' + escapeHtml(gName) + '</div>';
        groups[gName].forEach(function (c) {
          var idx = selectableItems.length;
          html += '<div class="crop-ac-item" data-idx="' + idx + '">' + escapeHtml(c.name) + '</div>';
          selectableItems.push(c);
        });
      });

      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
      selectedIdx = -1;
      positionDropdown();
    }

    function positionDropdown() {
      var rect = inputEl.getBoundingClientRect();
      var wrapRect = wrapper.getBoundingClientRect();
      dropdown.style.left = (rect.left - wrapRect.left) + 'px';
      dropdown.style.top = (rect.bottom - wrapRect.top) + 'px';
      dropdown.style.width = rect.width + 'px';
    }

    function highlightItem(idx) {
      var items = dropdown.querySelectorAll('.crop-ac-item');
      items.forEach(function (el, i) {
        el.classList.toggle('highlighted', i === idx);
      });
      selectedIdx = idx;
      // Scroll highlighted item into view
      if (idx >= 0 && items[idx]) {
        items[idx].scrollIntoView({ block: 'nearest' });
      }
    }

    function selectItem(idx) {
      if (idx >= 0 && idx < selectableItems.length) {
        inputEl.value = selectableItems[idx].name;
        // Store registryCropId on the input element for form submission
        inputEl.dataset.registryCropId = selectableItems[idx].registryCropId || '';
        dropdown.style.display = 'none';
        if (inputEl.id === 'entry-crop') updatePreview();
      }
    }

    function closeDropdown() {
      dropdown.style.display = 'none';
      selectedIdx = -1;
    }

    // Show all crops on focus/click
    inputEl.addEventListener('focus', function () {
      filterAndRender(inputEl.value);
    });
    inputEl.addEventListener('click', function () {
      if (dropdown.style.display === 'none') {
        filterAndRender(inputEl.value);
      }
    });

    inputEl.addEventListener('input', function () {
      filterAndRender(inputEl.value);
    });

    inputEl.addEventListener('keydown', function (e) {
      if (dropdown.style.display === 'none') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightItem(Math.min(selectedIdx + 1, selectableItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightItem(Math.max(selectedIdx - 1, 0));
      } else if (e.key === 'Enter') {
        if (selectedIdx >= 0) {
          e.preventDefault();
          selectItem(selectedIdx);
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
      } else if (e.key === 'Tab') {
        closeDropdown();
      }
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.crop-ac-item');
      if (!item) return;
      selectItem(parseInt(item.getAttribute('data-idx')));
    });

    dropdown.addEventListener('mouseover', function (e) {
      var item = e.target.closest('.crop-ac-item');
      if (!item) return;
      highlightItem(parseInt(item.getAttribute('data-idx')));
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) {
        closeDropdown();
      }
    });

    // Snap typed text to the canonical configured name (case/space-insensitive)
    // so "organic wheat " saves as "Organic Wheat". Delayed so a dropdown click
    // can land first.
    inputEl.addEventListener('blur', function () {
      setTimeout(function () {
        var typed = (inputEl.value || '').trim().toLowerCase();
        if (!typed) return;
        buildCropList(_registryCrops || []);
        for (var i = 0; i < allCrops.length; i++) {
          if (allCrops[i].name.trim().toLowerCase() === typed) {
            if (inputEl.value !== allCrops[i].name) {
              inputEl.value = allCrops[i].name;
              if (inputEl.id === 'entry-crop') updatePreview();
            }
            inputEl.dataset.registryCropId = allCrops[i].registryCropId || '';
            return;
          }
        }
      }, 200);
    });
  }

  // Attach a simple flat-list autocomplete to a text input for filters
  function attachFilterAutocomplete(inputEl, getItems, onSelect) {
    var dropdown = document.createElement('div');
    dropdown.className = 'crop-ac-dropdown';
    dropdown.style.display = 'none';
    var wrapper = inputEl.parentNode;
    if (getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative';
    }
    wrapper.appendChild(dropdown);

    var selectedIdx = -1;
    var currentItems = [];

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function filterAndRender(query) {
      var items = getItems();
      var q = (query || '').toLowerCase();
      currentItems = items.filter(function (item) {
        return !q || item.label.toLowerCase().indexOf(q) !== -1;
      });

      if (currentItems.length === 0) {
        dropdown.innerHTML = '<div class="crop-ac-empty">No matches</div>';
        dropdown.style.display = 'block';
        selectedIdx = -1;
        positionDropdown();
        return;
      }

      var html = '';
      currentItems.forEach(function (item, i) {
        var detail = item.detail ? '<span class="crop-ac-detail">' + escapeHtml(item.detail) + '</span>' : '';
        html += '<div class="crop-ac-item" data-idx="' + i + '">' + escapeHtml(item.label) + detail + '</div>';
      });
      dropdown.innerHTML = html;
      dropdown.style.display = 'block';
      selectedIdx = -1;
      positionDropdown();
    }

    function positionDropdown() {
      var rect = inputEl.getBoundingClientRect();
      var wrapRect = wrapper.getBoundingClientRect();
      dropdown.style.left = (rect.left - wrapRect.left) + 'px';
      dropdown.style.top = (rect.bottom - wrapRect.top) + 'px';
      dropdown.style.width = Math.max(rect.width, 220) + 'px';
    }

    function highlightItem(idx) {
      var items = dropdown.querySelectorAll('.crop-ac-item');
      items.forEach(function (el, i) { el.classList.toggle('highlighted', i === idx); });
      selectedIdx = idx;
      if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
    }

    function selectItem(idx) {
      if (idx >= 0 && idx < currentItems.length) {
        inputEl.value = currentItems[idx].label;
        dropdown.style.display = 'none';
        if (onSelect) onSelect(currentItems[idx]);
        applyFilters();
      }
    }

    function closeDropdown() { dropdown.style.display = 'none'; selectedIdx = -1; }

    inputEl.addEventListener('focus', function () { filterAndRender(inputEl.value); });
    inputEl.addEventListener('click', function () {
      if (dropdown.style.display === 'none') filterAndRender(inputEl.value);
    });
    inputEl.addEventListener('input', function () { filterAndRender(inputEl.value); });
    inputEl.addEventListener('keydown', function (e) {
      if (dropdown.style.display === 'none') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlightItem(Math.min(selectedIdx + 1, currentItems.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlightItem(Math.max(selectedIdx - 1, 0)); }
      else if (e.key === 'Enter') { if (selectedIdx >= 0) { e.preventDefault(); selectItem(selectedIdx); } }
      else if (e.key === 'Escape') { closeDropdown(); }
      else if (e.key === 'Tab') { closeDropdown(); }
    });
    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.crop-ac-item');
      if (item) selectItem(parseInt(item.getAttribute('data-idx')));
    });
    dropdown.addEventListener('mouseover', function (e) {
      var item = e.target.closest('.crop-ac-item');
      if (item) highlightItem(parseInt(item.getAttribute('data-idx')));
    });
    document.addEventListener('click', function (e) {
      if (!wrapper.contains(e.target)) closeDropdown();
    });
  }

  // Farm autocomplete data source — Farm Registry fields (with local fallback)
  var registryFields = null; // cached after first load
  function getFarmItems() {
    // Use cached Farm Registry fields if available
    if (registryFields) {
      return registryFields.map(function (f) {
        return {
          label: f.name,
          detail: f.reportingAcres ? f.reportingAcres + ' ac' : ''
        };
      });
    }
    // Fallback to local farm names from ticket data
    return (refData.farmNames || []).map(function (n) {
      return { label: n, detail: '' };
    });
  }

  // Load Farm Registry fields for autocomplete
  function loadRegistryFields() {
    if (typeof FarmRegistry !== 'undefined') {
      FarmRegistry.getFields().then(function (fields) {
        registryFields = fields;
      }).catch(function () {
        registryFields = null; // stay on fallback
      });
    }
  }

  // Crop filter data source — grouped from macro
  function getCropFilterItems() {
    var cropTypes = refData.cropTypes || [];
    var items = [];
    if (cropTypes.length > 0) {
      cropTypes.forEach(function (ct) {
        (ct.subCrops || []).forEach(function (sc) {
          items.push({ label: sc.name, detail: ct.name });
        });
      });
    } else {
      Object.keys(refData.cropConfig).sort().forEach(function (c) {
        items.push({ label: c, detail: '' });
      });
    }
    return items;
  }

  window.addEventListener('ref-data-loaded', function () {
    // --- Entry form autocompletes ---
    attachCropAutocomplete(document.getElementById('entry-crop'));
    // Edit dialog gets the same configured-crop dropdown so edits stay consistent
    var editCropEl = document.getElementById('edit-crop');
    if (editCropEl) attachCropAutocomplete(editCropEl);

    var farmList = document.getElementById('farm-list');
    refData.farmNames.forEach(function (f) {
      var opt = document.createElement('option');
      opt.value = f;
      farmList.appendChild(opt);
    });

    // --- Filter autocompletes (farm from Registry, crop from macro) ---
    loadRegistryFields();
    attachFilterAutocomplete(document.getElementById('filter-farm'), getFarmItems);
    attachFilterAutocomplete(document.getElementById('filter-crop'), getCropFilterItems);

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

    // --- Farm Registry autocomplete on entry form ---
    if (typeof FarmRegistry !== 'undefined') {
      var farmInput = document.getElementById('entry-farm');
      farmInput.removeAttribute('list');
      FarmRegistry.autocomplete(farmInput, {
        onSelect: function (field) {
          console.log('[FarmRegistry] Selected:', field.name, field.reportingAcres + ' ac');
        }
      });
      // Patch FarmRegistry dropdown highlight colors for dark theme
      var frDropdown = farmInput.parentNode.querySelector('.fr-autocomplete-dropdown');
      if (frDropdown) {
        frDropdown.addEventListener('mouseover', function (e) {
          var item = e.target.closest('.fr-ac-item');
          if (!item) return;
          frDropdown.querySelectorAll('.fr-ac-item').forEach(function (el) {
            el.style.background = '';
          });
          item.style.background = '';
          item.classList.add('fr-highlighted');
        });
        frDropdown.addEventListener('mouseleave', function () {
          frDropdown.querySelectorAll('.fr-ac-item').forEach(function (el) {
            el.style.background = '';
            el.classList.remove('fr-highlighted');
          });
        });
      }
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
    var scaleEl = document.getElementById('prev-scaleBU');
    if (scaleEl) scaleEl.textContent = c.scaleBU !== undefined ? util.formatNum(c.scaleBU, 2) : '--';
    document.getElementById('prev-grossBU').textContent = c.grossBU !== undefined ? util.formatNum(c.grossBU, 2) : '--';
    document.getElementById('prev-netBU').textContent = c.netBU !== undefined ? util.formatNum(c.netBU, 2) : '--';
    // Explain the gap between the paper scale ticket and payable bushels
    var lineEl = document.getElementById('prev-discount-line');
    if (lineEl) {
      if (c.scaleBU > 0 && c.netBU !== undefined && c.scaleBU - c.netBU > 0.005) {
        var diff = c.scaleBU - c.netBU;
        var pct = (diff / c.scaleBU) * 100;
        lineEl.textContent = 'Scale ticket ' + util.formatNum(c.scaleBU, 2) + ' bu − ' +
          util.formatNum(diff, 2) + ' bu discounts (' + util.formatNum(pct, 1) + '%)';
      } else {
        lineEl.textContent = '';
      }
    }
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

    var cropInput = form.crop;
    var body = {
      date: form.date.value,
      farm: form.farm.value,
      netWeight: form.netWeight.value,
      moisture: form.moisture.value,
      crop: form.crop.value,
      ticketNo: form.ticketNo.value,
      notes: form.notes.value,
      fm: form.fm.value,
      testWeight: form.testWeight.value || null,
      buyerId: destType === 'buyer' ? destId : null,
      grainBinId: destType === 'bin' ? destId : null
      // cropYear is derived server-side from date — not sent from client
    };
    // Include registryCropId if set by autocomplete selection
    if (cropInput.dataset && cropInput.dataset.registryCropId) {
      body.registryCropId = cropInput.dataset.registryCropId;
    }

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
      // Network failure (TypeError) — queue for offline sync
      if (err instanceof TypeError || (err.message && err.message.indexOf('Failed to fetch') !== -1) || (err.message && err.message.indexOf('NetworkError') !== -1)) {
        if (window.ticketQueue) {
          window.ticketQueue.add(body).then(function () {
            window.ticketQueue.requestSync();
            util.showToast('Ticket queued \u2014 will sync when online', 4000, 'warning');
            form.reset();
            document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
            document.getElementById('entry-destination').value = destVal;
            setPreview({});
            listLoaded = false;
          });
        } else {
          util.showToast('Network error \u2014 offline queuing unavailable', 5000, 'warning');
        }
        return;
      }

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

  // Pending tickets from IDB queue (shown in list alongside API tickets)
  var pendingTickets = [];

  function loadPendingTickets() {
    if (!window.ticketQueue) { pendingTickets = []; return Promise.resolve(); }
    return window.ticketQueue.getAll().then(function (entries) {
      pendingTickets = entries;
    }).catch(function () {
      pendingTickets = [];
    });
  }

  function loadTickets() {
    var apiPromise = api.get('/api/tickets').then(function (data) {
      allTickets = data;
      listLoaded = true;
    });

    var pendingPromise = loadPendingTickets();

    Promise.all([apiPromise, pendingPromise]).then(function () {
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
    }).catch(function () {
      // API may be unavailable when offline — still show pending tickets
      loadPendingTickets().then(function () { applyFilters(); });
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
      if (farm && (t.farm || '').toLowerCase().indexOf(farm.toLowerCase()) === -1) return false;
      if (crop && (t.crop || '').toLowerCase().indexOf(crop.toLowerCase()) === -1) return false;
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

  // Column visibility toggle
  var showAllCols = false;
  var toggleColsBtn = document.getElementById('toggle-cols-btn');
  if (toggleColsBtn) {
    toggleColsBtn.addEventListener('click', function () {
      showAllCols = !showAllCols;
      document.body.classList.toggle('show-all-cols', showAllCols);
      toggleColsBtn.textContent = showAllCols ? 'Show fewer columns' : 'Show all columns';
    });
  }

  var TOTAL_COLS = 16; // primary (7) + secondary (8) + actions = 16

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

  // Escape HTML for safe rendering
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // Resolve destination name from refData.destinations
  function resolveDestName(t) {
    if (t.buyerId && refData.destinations) {
      var buyer = refData.destinations.find(function (d) { return d.type === 'buyer' && d.id === t.buyerId; });
      return buyer ? (buyer.shortCode || buyer.name) : 'Buyer #' + t.buyerId;
    } else if (t.grainBinId && refData.destinations) {
      var bin = refData.destinations.find(function (d) { return d.type === 'bin' && d.id === t.grainBinId; });
      return bin ? '[BIN] ' + bin.name : 'Bin #' + t.grainBinId;
    } else if (t.destination) {
      return t.destination; // legacy free-text for old tickets
    }
    return '';
  }

  function renderTable() {
    var tbody = document.getElementById('ticket-tbody');
    var start = currentPage * PAGE_SIZE;
    var page = filteredTickets.slice(start, start + PAGE_SIZE);
    var totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));

    var totalBU = filteredTickets.reduce(function (sum, t) { return sum + (t._computed ? t._computed.netBU : 0); }, 0);
    var pendingCount = pendingTickets.length;
    document.getElementById('ticket-count').textContent = filteredTickets.length + ' tickets' + (pendingCount > 0 ? ' + ' + pendingCount + ' pending' : '');
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

    // --- Render pending/conflict tickets first (page 1 only) ---
    if (currentPage === 0 && pendingTickets.length > 0) {
      var conflicts = pendingTickets.filter(function (e) { return e.status === 'conflict'; });
      var pending = pendingTickets.filter(function (e) { return e.status === 'pending' || e.status === 'failed'; });
      var allPending = conflicts.concat(pending).sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

      allPending.forEach(function (entry) {
        var b = entry.body || {};
        var isConflict = entry.status === 'conflict';
        var isFailed = entry.status === 'failed';
        var rowClass = isConflict ? 'conflict-row' : 'pending-row';
        var statusBadge = '';
        if (isConflict) {
          statusBadge = '<span class="conflict-badge" onclick="toggleConflictPanel(\'' + escapeHtml(entry.id) + '\')">Duplicate \u2014 tap to resolve</span>';
        } else if (isFailed) {
          statusBadge = '<span class="pending-sync-badge" style="border-color:var(--danger);color:var(--danger)">Failed</span>';
        } else {
          statusBadge = '<span class="pending-sync-badge">\u23F3 Pending</span>';
        }

        var destName = '';
        if (b.buyerId && refData.destinations) {
          var buyerDest = refData.destinations.find(function (d) { return d.type === 'buyer' && d.id === parseInt(b.buyerId); });
          destName = buyerDest ? (buyerDest.shortCode || buyerDest.name) : 'Buyer #' + b.buyerId;
        } else if (b.grainBinId && refData.destinations) {
          var binDest = refData.destinations.find(function (d) { return d.type === 'bin' && d.id === parseInt(b.grainBinId); });
          destName = binDest ? '[BIN] ' + binDest.name : 'Bin #' + b.grainBinId;
        }

        var ticketLabel = b.ticketNo ? escapeHtml(b.ticketNo) : '<em style="color:var(--text-light)">no #</em>';

        html += '<tr class="' + rowClass + '" data-pending-id="' + escapeHtml(entry.id) + '">';
        html += '<td></td>';
        html += '<td>' + escapeHtml(b.date || '') + '</td>';
        html += '<td>' + escapeHtml(b.farm || '') + '</td>';
        html += '<td>' + escapeHtml((b.crop || '').trim()) + '</td>';
        html += '<td class="net-bu-cell"><span style="color:var(--text-light);font-size:var(--size-xs)">pending</span></td>';
        html += '<td class="number">' + util.formatNum(b.moisture, 1) + '</td>';
        html += '<td>' + statusBadge + '</td>';
        html += '<td class="col-secondary">' + ticketLabel + '</td>';
        html += '<td class="col-secondary number">' + util.formatNum(b.netWeight, 0) + '</td>';
        html += '<td class="col-secondary number">' + util.formatNum(b.fm, 2) + '</td>';
        html += '<td class="col-secondary" colspan="4" style="color:var(--text-light);font-size:var(--size-xs)">not yet synced</td>';
        html += '<td>';
        if (!isConflict) {
          html += '<button class="btn-edit" onclick="openPendingEditModal(\'' + escapeHtml(entry.id) + '\')">Edit</button> ';
          html += '<button class="btn-danger" onclick="deletePendingTicket(\'' + escapeHtml(entry.id) + '\')">Del</button>';
          if (isFailed) {
            html += ' <button class="btn-sm" onclick="retryPendingTicket(\'' + escapeHtml(entry.id) + '\')" style="color:var(--amber);border-color:var(--amber)">Retry</button>';
          }
        }
        html += '</td>';
        html += '</tr>';

        if (isConflict) {
          html += '<tr class="conflict-panel-row" id="conflict-panel-' + escapeHtml(entry.id) + '" style="display:none"><td colspan="' + TOTAL_COLS + '">';
          html += renderConflictPanel(entry);
          html += '</td></tr>';
        }
      });
    }

    // --- Render normal API tickets, grouped by date ---
    var dateGroups = {};
    var dateOrder = [];
    page.forEach(function (t) {
      var d = t.date || 'Unknown';
      if (!dateGroups[d]) { dateGroups[d] = []; dateOrder.push(d); }
      dateGroups[d].push(t);
    });

    dateOrder.forEach(function (date) {
      var group = dateGroups[date];
      var chevronSvg = '<svg class="dg-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

      html += '<tr class="date-group-header-row"><td colspan="' + TOTAL_COLS + '">';
      html += '<button class="date-group-toggle" data-date-group="' + escapeHtml(date) + '">';
      html += '<span class="dg-date">' + escapeHtml(date) + '</span>';
      html += '<span class="dg-count">' + group.length + ' ticket' + (group.length !== 1 ? 's' : '') + '</span>';
      html += chevronSvg;
      html += '</button></td></tr>';

      group.forEach(function (t) {
        var c = t._computed || {};
        var destName = resolveDestName(t);
        var reconStatus = (t._reconciliation && t._reconciliation.status) ? t._reconciliation.status : 'unreconciled';
        var reconLabels = { unreconciled: 'Unreconciled', matched: 'Matched', disputed: 'Disputed', manual: 'Manual' };
        var reconLabel = reconLabels[reconStatus] || 'Unreconciled';

        html += '<tr data-id="' + escapeHtml(String(t.id)) + '" data-date-group="' + escapeHtml(date) + '">';
        html += '<td><input type="checkbox" class="ticket-checkbox" data-id="' + escapeHtml(String(t.id)) + '"></td>';
        html += '<td class="editable" data-field="date">' + escapeHtml(t.date || '') + '</td>';
        html += '<td class="editable" data-field="farm">' + escapeHtml(t.farm || '') + '</td>';
        html += '<td class="editable" data-field="crop">' + escapeHtml((t.crop || '').trim()) + '</td>';
        html += '<td class="net-bu-cell">' + util.formatNum(c.netBU, 2) + '</td>';
        html += '<td class="editable number" data-field="moisture">' + util.formatNum(t.moisture, 1) + '</td>';
        html += '<td><span class="status-pill badge badge-' + reconStatus + '">' + reconLabel + '</span></td>';

        // Secondary columns
        html += '<td class="col-secondary editable" data-field="ticketNo">' + escapeHtml(t.ticketNo || '') + '</td>';
        html += '<td class="col-secondary editable number" data-field="netWeight">' + util.formatNum(t.netWeight, 0) + '</td>';
        html += '<td class="col-secondary editable number" data-field="fm">' + util.formatNum(t.fm, 2) + '</td>';
        html += '<td class="col-secondary number">' + util.formatNum(c.testWeight, 0) + '</td>';
        html += '<td class="col-secondary number">' + util.formatNum(c.grossBU, 2) + '</td>';
        html += '<td class="col-secondary number">' + util.formatNum(c.discount, 2) + '</td>';
        html += '<td class="col-secondary">' + escapeHtml(destName) + '</td>';
        html += '<td class="col-secondary editable" data-field="notes">' + escapeHtml(t.notes || '') + '</td>';

        html += '<td><button class="btn-edit" onclick="openEditModal(\'' + escapeHtml(String(t.id)) + '\')">Edit</button> <button class="btn-danger" onclick="deleteTicket(\'' + escapeHtml(String(t.id)) + '\')">Del</button></td>';
        html += '</tr>';
      });
    });

    tbody.innerHTML = html;

    // Wire date group collapse toggles
    document.querySelectorAll('.date-group-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var date = btn.getAttribute('data-date-group');
        var rows = document.querySelectorAll('tr[data-date-group="' + date + '"]');
        var collapsed = btn.classList.toggle('collapsed');
        rows.forEach(function (r) { r.style.display = collapsed ? 'none' : ''; });
      });
    });

    // Pagination
    document.getElementById('page-info').textContent = 'Page ' + (currentPage + 1) + ' of ' + totalPages;
    document.getElementById('page-prev').disabled = currentPage === 0;
    document.getElementById('page-next').disabled = currentPage >= totalPages - 1;
  }

  // --- Conflict resolution panel HTML ---
  function renderConflictPanel(entry) {
    var b = entry.body || {};
    var cd = entry.conflictData || {};
    var id = entry.id;

    function fieldRow(label, yourVal, existingVal) {
      return '<div class="conflict-field"><span class="conflict-field-name">' + escapeHtml(label) + '</span>' +
        '<span>' + escapeHtml(String(yourVal || '--')) + '</span></div>';
    }

    var yourFields = fieldRow('Date', b.date) +
      fieldRow('Farm', b.farm) +
      fieldRow('Ticket #', b.ticketNo) +
      fieldRow('Crop', b.crop) +
      fieldRow('Net Wt', b.netWeight ? util.formatNum(b.netWeight, 0) + ' lbs' : '');

    var existingMsg = cd.message || (cd.error || 'Already exists on server');

    var html = '<div class="conflict-panel">';
    html += '<div class="conflict-panel-inner">';
    html += '<div class="yours"><div class="conflict-panel-label">Your entry</div>' + yourFields + '</div>';
    html += '<div class="existing"><div class="conflict-panel-label">Existing ticket</div>';
    html += '<div style="font-size:0.8rem;color:var(--text-light);padding:0.25rem 0">' + escapeHtml(existingMsg) + '</div>';
    html += '</div>';
    html += '</div>';
    html += '<div class="conflict-actions">';
    html += '<button class="btn-conflict-resolve" onclick="resolveConflictKeepMine(\'' + escapeHtml(id) + '\')">Keep mine (new ticket #)</button>';
    html += '<button class="btn-conflict-discard" onclick="resolveConflictDiscard(\'' + escapeHtml(id) + '\')">Keep existing</button>';
    html += '<button class="btn-conflict-resolve" onclick="openPendingEditModal(\'' + escapeHtml(id) + '\')">Edit &amp; retry</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  // --- Conflict panel toggle ---
  window.toggleConflictPanel = function (id) {
    var row = document.getElementById('conflict-panel-' + id);
    if (!row) return;
    row.style.display = (row.style.display === 'none' || !row.style.display) ? '' : 'none';
  };

  // --- Pending ticket actions ---

  window.deletePendingTicket = function (id) {
    if (!confirm('Remove this pending ticket from the queue?')) return;
    if (window.ticketQueue) {
      window.ticketQueue.delete(id).then(function () {
        util.showToast('Pending ticket removed');
        loadPendingTickets().then(function () { renderTable(); });
      });
    }
  };

  window.retryPendingTicket = function (id) {
    if (!window.ticketQueue) return;
    // Reset status back to pending and trigger sync
    window.ticketQueue.update(id, { status: 'pending', retryCount: 0, errorMessage: null }).then(function () {
      window.ticketQueue.requestSync();
      util.showToast('Retrying sync...', 3000);
    });
  };

  window.resolveConflictKeepMine = function (id) {
    if (!window.ticketQueue) return;
    var newNo = prompt('Enter a new ticket number (different from the existing one):');
    if (!newNo || !newNo.trim()) return;
    window.ticketQueue.getAll().then(function (entries) {
      var entry = entries.find(function (e) { return e.id === id; });
      if (!entry) return;
      var updatedBody = Object.assign({}, entry.body, { ticketNo: newNo.trim() });
      window.ticketQueue.update(id, { body: updatedBody, status: 'pending', retryCount: 0, conflictData: null }).then(function () {
        window.ticketQueue.requestSync();
        util.showToast('Queued with new ticket # \u2014 syncing...', 3000);
        loadPendingTickets().then(function () { renderTable(); });
      });
    });
  };

  window.resolveConflictDiscard = function (id) {
    if (!confirm('Discard your entry and keep the existing ticket?')) return;
    if (window.ticketQueue) {
      window.ticketQueue.delete(id).then(function () {
        util.showToast('Conflict resolved \u2014 existing ticket kept');
        loadPendingTickets().then(function () { renderTable(); });
      });
    }
  };

  // --- Pending ticket edit modal ---

  window.openPendingEditModal = function (id) {
    if (!window.ticketQueue) return;
    window.ticketQueue.getAll().then(function (entries) {
      var entry = entries.find(function (e) { return e.id === id; });
      if (!entry) return;
      var b = entry.body || {};

      populateEditDestinations();

      // Add a notice to the modal
      var modal = document.getElementById('edit-modal');
      var modalCard = modal.querySelector('.modal-card');

      var existingNotice = modalCard.querySelector('.pending-modal-notice');
      if (!existingNotice) {
        var notice = document.createElement('div');
        notice.className = 'pending-modal-notice';
        notice.textContent = 'Editing queued ticket \u2014 changes saved locally until synced';
        modalCard.insertBefore(notice, modalCard.querySelector('form'));
      }

      // Store pending ID for save handler
      document.getElementById('edit-id').value = id;
      document.getElementById('edit-id').setAttribute('data-pending', 'true');
      document.getElementById('edit-date').value = b.date || '';
      document.getElementById('edit-farm').value = b.farm || '';
      document.getElementById('edit-crop').value = b.crop || '';
      document.getElementById('edit-ticketNo').value = b.ticketNo || '';
      document.getElementById('edit-netWeight').value = b.netWeight != null ? b.netWeight : '';
      document.getElementById('edit-moisture').value = b.moisture != null ? b.moisture : '';
      document.getElementById('edit-fm').value = b.fm != null ? b.fm : '';
      document.getElementById('edit-notes').value = b.notes || '';

      var destVal = '';
      if (b.buyerId) destVal = 'buyer:' + b.buyerId;
      else if (b.grainBinId) destVal = 'bin:' + b.grainBinId;
      document.getElementById('edit-destination').value = destVal;

      modal.classList.remove('hidden');
    });
  };

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

  // --- Edit Ticket Modal ---
  var editModal = document.getElementById('edit-modal');
  var editForm = document.getElementById('edit-ticket-form');

  function populateEditDestinations() {
    var sel = document.getElementById('edit-destination');
    // Clear all but the first "-- None --" option
    while (sel.options.length > 1) sel.remove(1);

    if (!refData.destinations || !refData.destinations.length) return;

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
      sel.appendChild(binGroup);
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
      sel.appendChild(buyerGroup);
    }
  }

  window.openEditModal = function (id) {
    var ticket = allTickets.find(function (t) { return String(t.id) === String(id); });
    if (!ticket) return;

    populateEditDestinations();

    document.getElementById('edit-id').value = ticket.id;
    document.getElementById('edit-date').value = ticket.date || '';
    document.getElementById('edit-farm').value = ticket.farm || '';
    document.getElementById('edit-crop').value = ticket.crop || '';
    document.getElementById('edit-ticketNo').value = ticket.ticketNo || '';
    document.getElementById('edit-netWeight').value = ticket.netWeight != null ? ticket.netWeight : '';
    document.getElementById('edit-moisture').value = ticket.moisture != null ? ticket.moisture : '';
    document.getElementById('edit-fm').value = ticket.fm != null ? ticket.fm : '';
    document.getElementById('edit-testWeight').value = ticket.testWeight != null ? ticket.testWeight : '';
    document.getElementById('edit-notes').value = ticket.notes || '';

    // Set destination select value
    var destVal = '';
    if (ticket.buyerId) destVal = 'buyer:' + ticket.buyerId;
    else if (ticket.grainBinId) destVal = 'bin:' + ticket.grainBinId;
    document.getElementById('edit-destination').value = destVal;

    editModal.classList.remove('hidden');
  };

  function closeEditModal() {
    editModal.classList.add('hidden');
    // Clean up pending-specific state
    var idField = document.getElementById('edit-id');
    idField.removeAttribute('data-pending');
    var notice = editModal.querySelector('.pending-modal-notice');
    if (notice) notice.parentNode.removeChild(notice);
  }

  document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);
  editModal.addEventListener('click', function (e) {
    if (e.target === editModal) closeEditModal();
  });

  editForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var idField = document.getElementById('edit-id');
    var id = idField.value;
    var isPending = idField.getAttribute('data-pending') === 'true';

    var editCropInput = document.getElementById('edit-crop');
    var body = {
      date: document.getElementById('edit-date').value,
      farm: document.getElementById('edit-farm').value,
      crop: editCropInput.value,
      ticketNo: document.getElementById('edit-ticketNo').value,
      netWeight: document.getElementById('edit-netWeight').value,
      moisture: document.getElementById('edit-moisture').value,
      fm: document.getElementById('edit-fm').value,
      testWeight: document.getElementById('edit-testWeight').value || null,
      notes: document.getElementById('edit-notes').value
    };
    // Include registryCropId if set by autocomplete selection
    if (editCropInput.dataset && editCropInput.dataset.registryCropId) {
      body.registryCropId = editCropInput.dataset.registryCropId;
    }

    // Parse destination select
    var destVal = document.getElementById('edit-destination').value;
    if (destVal.indexOf('buyer:') === 0) {
      body.buyerId = destVal.replace('buyer:', '');
      body.grainBinId = null;
    } else if (destVal.indexOf('bin:') === 0) {
      body.grainBinId = destVal.replace('bin:', '');
      body.buyerId = null;
    } else {
      body.buyerId = null;
      body.grainBinId = null;
    }

    if (isPending && window.ticketQueue) {
      // Save edits back to IDB queue (re-enable sync if it was failed/conflict)
      window.ticketQueue.update(id, { body: body, status: 'pending', retryCount: 0, conflictData: null }).then(function () {
        window.ticketQueue.requestSync();
        loadPendingTickets().then(function () {
          applyFilters();
          closeEditModal();
          util.showToast('Pending ticket updated \u2014 syncing...');
        });
      });
    } else {
      api.put('/api/tickets/' + id, body).then(function (updated) {
        var idx = allTickets.findIndex(function (t) { return String(t.id) === String(id); });
        if (idx !== -1) allTickets[idx] = updated;
        applyFilters();
        closeEditModal();
        util.showToast('Ticket updated');
      }).catch(function (err) {
        alert('Error saving: ' + (err.message || 'Unknown error'));
      });
    }
  });


  // --- Sync completion: refresh list when tickets sync ---
  window.addEventListener('tickets-synced', function () {
    listLoaded = false;
    // Only auto-reload if currently on the list tab
    var listTab = document.getElementById('tab-list');
    if (listTab && listTab.classList.contains('active')) {
      loadTickets();
    }
  });

  // --- Online event: trigger sync if pending tickets exist ---
  window.addEventListener('app-online', function () {
    if (window.ticketQueue) {
      window.ticketQueue.getPending().then(function (pending) {
        if (pending.length > 0) {
          window.ticketQueue.requestSync();
        }
      });
    }
  });

})();
