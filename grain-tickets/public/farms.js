// Farm summary dashboard
(function () {
  'use strict';

  var allFarms = [];
  var filteredFarms = [];
  var sortCol = 'farm';
  var sortDir = 'asc';
  var loaded = false;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'farms' && !loaded) {
      loadFarms();
    }
  });

  function loadFarms() {
    Promise.all([
      api.get('/api/farms'),
      api.get('/api/tickets'),
      fetch('http://localhost:3001/api/fields').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    ]).then(function (results) {
      allFarms = results[0];
      var allTickets = results[1];
      var budgetFields = results[2];
      var destinations = (window.refData && window.refData.destinations) ? window.refData.destinations : [];

      // Build budget lookup: lowercase field name → { crop, yieldPerAcre }
      var budgetLookup = {};
      budgetFields.forEach(function (bf) {
        var key = (bf.name || '').trim().toLowerCase();
        if (!budgetLookup[key]) {
          budgetLookup[key] = { crop: bf.crop || '', yieldPerAcre: bf.yieldPerAcre || 0 };
        }
      });

      // Build buyer/destination breakdown per farm: group tickets by farm name + destination
      var farmTicketMap = {};
      allTickets.forEach(function (t) {
        var farmKey = (t.farm || '').trim().toLowerCase();
        if (!farmTicketMap[farmKey]) farmTicketMap[farmKey] = [];
        farmTicketMap[farmKey].push(t);
      });

      allFarms.forEach(function (f) {
        var farmKey = (f.farm || '').trim().toLowerCase();
        var tickets = farmTicketMap[farmKey] || [];
        var byDest = {};

        tickets.forEach(function (t) {
          var destKey = null;
          var destLabel = null;

          if (t.buyerId) {
            destKey = 'buyer:' + t.buyerId;
            var buyer = destinations.find(function (d) { return d.type === 'buyer' && d.id === t.buyerId; });
            destLabel = buyer ? (buyer.shortCode || buyer.name) : ('Buyer#' + t.buyerId);
          } else if (t.grainBinId) {
            destKey = 'bin:' + t.grainBinId;
            var bin = destinations.find(function (d) { return d.type === 'bin' && d.id === t.grainBinId; });
            destLabel = bin ? ('[BIN] ' + bin.name) : ('Bin#' + t.grainBinId);
          } else if (t.destination) {
            destKey = 'legacy:' + t.destination;
            destLabel = t.destination;
          }

          if (destKey && destLabel) {
            if (!byDest[destKey]) byDest[destKey] = { label: destLabel, netBU: 0, count: 0 };
            var netBU = (t._computed && t._computed.netBU) ? t._computed.netBU : 0;
            byDest[destKey].netBU += netBU;
            byDest[destKey].count += 1;
          }
        });

        f.buyerBreakdown = Object.values(byDest).sort(function (a, b) {
          return b.netBU - a.netBU;
        });

        // Attach budget estimate (crop + yield) from macro rollup
        var budgetKey = farmKey;
        var match = budgetLookup[budgetKey];
        f.budgetCrop = match ? match.crop : '';
        f.budgetYield = match ? match.yieldPerAcre : 0;
      });

      loaded = true;
      // Overlay registry acres if FarmRegistry is available
      overlayRegistryAcres(function () {
        applyFilters();
      });
    });
  }

  // Fetch registry fields and replace local acres with registry reportingAcres
  function overlayRegistryAcres(cb) {
    if (typeof FarmRegistry === 'undefined') return cb();
    FarmRegistry.getFields().then(function (fields) {
      if (!fields || !fields.length) return cb();
      // Build lookup: lowercase name + aliases → reportingAcres
      var lookup = {};
      fields.forEach(function (f) {
        lookup[f.name.toLowerCase()] = f.reportingAcres;
        (f.aliases || []).forEach(function (a) {
          lookup[a.toLowerCase()] = f.reportingAcres;
        });
      });
      // Overlay acres and recompute yield
      allFarms.forEach(function (f) {
        var key = (f.farm || '').trim().toLowerCase();
        if (lookup[key] !== undefined) {
          f.acres = lookup[key];
          f.yieldPerAcre = f.acres > 0 ? f.totalBU / f.acres : 0;
          f._registryAcres = true;
        }
      });
      cb();
    }).catch(function () { cb(); });
  }

  // Filters
  ['farm-filter-search', 'farm-filter-type'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });

  function applyFilters() {
    var search = document.getElementById('farm-filter-search').value.toLowerCase();
    var type = document.getElementById('farm-filter-type').value;

    filteredFarms = allFarms.filter(function (f) {
      if (type && f.type !== type) return false;
      if (search) {
        var haystack = [f.farm, f.crop, f.type, f.driver].join(' ').toLowerCase();
        if (haystack.indexOf(search) === -1) return false;
      }
      return true;
    });

    sortFarms();
    renderTable();
  }

  function sortFarms() {
    filteredFarms.sort(function (a, b) {
      var va = a[sortCol];
      var vb = b[sortCol];
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
  document.querySelectorAll('#farm-table th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var col = th.getAttribute('data-sort');
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      document.querySelectorAll('#farm-table th').forEach(function (h) {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      sortFarms();
      renderTable();
    });
  });

  function renderTable() {
    var tbody = document.getElementById('farm-tbody');
    var totalAcres = 0;
    var totalBU = 0;

    var html = '';
    filteredFarms.forEach(function (f) {
      totalAcres += (f.acres || 0);
      totalBU += (f.totalBU || 0);

      // Build destinations summary text: "UE — 1,234.56 BU (15) | ADM — 2,345.67 BU (22)"
      var destSummary = '';
      if (f.buyerBreakdown && f.buyerBreakdown.length) {
        destSummary = f.buyerBreakdown.map(function (d) {
          return d.label + ' \u2014 ' + util.formatNum(d.netBU, 1) + ' BU (' + d.count + ')';
        }).join(' | ');
      }

      html += '<tr>';
      html += '<td class="number">' + util.formatNum(f.acres, 1) + (f._registryAcres ? ' <span style="color:#2d5a27;font-size:0.7rem;" title="From Farm Registry">R</span>' : '') + '</td>';
      html += '<td>' + (f.crop || '').trim() + '</td>';
      html += '<td><a href="#" class="farm-link" data-farm="' + (f.farm || '') + '">' + (f.farm || '').trim() + '</a></td>';
      html += '<td class="number" style="font-weight:600">' + util.formatNum(f.totalBU, 2) + '</td>';
      html += '<td>' + (f.unit || 'BU') + '</td>';
      html += '<td class="number">' + util.formatNum(f.yieldPerAcre, 2) + '</td>';
      html += '<td>' + (f.type || '') + '</td>';
      html += '<td style="font-size:0.75rem; color:#555;">' + destSummary + '</td>';
      html += '<td style="font-size:0.8rem;">' + (f.budgetCrop || '<span style="color:#888;">—</span>') + '</td>';
      html += '<td class="number" style="font-size:0.8rem;">' + (f.budgetYield ? util.formatNum(f.budgetYield, 1) : '<span style="color:#888;">—</span>') + '</td>';
      html += '<td class="number">' + util.formatNum(f.guarantee, 0) + '</td>';
      html += '<td class="number">' + util.formatNum(f.coverage, 0) + '</td>';
      html += '<td class="number">' + util.formatNum(f.claimThreshold, 0) + '</td>';
      html += '<td class="number">' + util.formatNum(f.discount, 2) + '</td>';
      html += '<td class="number">' + util.formatNum(f.testWeight, 0) + '</td>';
      html += '</tr>';
    });

    // Totals row
    html += '<tr style="font-weight:700; background:#f0f0ea;">';
    html += '<td class="number">' + util.formatNum(totalAcres, 1) + '</td>';
    html += '<td></td>';
    html += '<td>TOTALS (' + filteredFarms.length + ' farms)</td>';
    html += '<td class="number">' + util.formatNum(totalBU, 2) + '</td>';
    html += '<td colspan="11"></td>';
    html += '</tr>';

    tbody.innerHTML = html;
  }

  // Click farm name to switch to ticket log filtered by that farm
  document.getElementById('farm-tbody').addEventListener('click', function (e) {
    var link = e.target.closest('.farm-link');
    if (!link) return;
    e.preventDefault();
    var farmName = link.getAttribute('data-farm');

    // Switch to ticket list tab and set farm filter
    document.querySelector('.tab-btn[data-tab="list"]').click();
    document.getElementById('filter-farm').value = farmName;
    document.getElementById('filter-farm').dispatchEvent(new Event('change'));
  });

  // --- CSV Export ---
  document.getElementById('export-farms-btn').addEventListener('click', function () {
    window.location.href = '/api/export/farms';
  });

  // Invalidate cache when tickets change
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'farms') {
      loadFarms(); // Always reload for fresh data
    }
  });

})();
