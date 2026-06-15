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

      // Build buyer/destination breakdown per farm
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

        // Attach budget estimate from macro rollup
        var budgetKey = farmKey;
        var match = budgetLookup[budgetKey];
        f.budgetCrop = match ? match.crop : '';
        f.budgetYield = match ? match.yieldPerAcre : 0;
      });

      loaded = true;
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
      var lookup = {};
      fields.forEach(function (f) {
        lookup[f.name.toLowerCase()] = f.reportingAcres;
        (f.aliases || []).forEach(function (a) {
          lookup[a.toLowerCase()] = f.reportingAcres;
        });
      });
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
    renderCards();
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

  // Sort via select dropdown
  var farmSortSelect = document.getElementById('farm-sort-select');
  if (farmSortSelect) {
    farmSortSelect.addEventListener('change', function () {
      var parts = this.value.split(':');
      sortCol = parts[0];
      sortDir = parts[1] || 'asc';
      sortFarms();
      renderCards();
    });
  }

  function renderCards() {
    var grid = document.getElementById('farm-card-grid');
    var totalsStrip = document.getElementById('farm-totals-strip');
    if (!grid) return;

    var totalAcres = 0;
    var totalBU = 0;
    filteredFarms.forEach(function (f) {
      totalAcres += (f.acres || 0);
      totalBU += (f.totalBU || 0);
    });

    if (totalsStrip) {
      totalsStrip.innerHTML =
        '<strong>' + filteredFarms.length + '</strong> farms &nbsp;|&nbsp; ' +
        '<strong>' + util.formatNum(totalAcres, 1) + '</strong> acres &nbsp;|&nbsp; ' +
        'Total: <strong>' + util.formatNum(totalBU, 2) + ' BU</strong>';
    }

    if (filteredFarms.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-light);padding:1rem;">No farms match the current filter.</p>';
      return;
    }

    var html = '';
    filteredFarms.forEach(function (f) {
      var yieldPct = (f.budgetYield && f.budgetYield > 0 && f.yieldPerAcre != null)
        ? Math.min(100, Math.round((f.yieldPerAcre / f.budgetYield) * 100))
        : 0;
      var hasEstimate = !!(f.budgetYield && f.budgetYield > 0);

      var destHtml = '';
      if (f.buyerBreakdown && f.buyerBreakdown.length) {
        destHtml = f.buyerBreakdown.map(function (d) {
          return '<span>' + d.label + ' — ' + util.formatNum(d.netBU, 0) + ' BU</span>';
        }).join('<br>');
      }

      var typeBadge = '<span class="type-badge' + (f.type === 'Organic' ? ' organic' : '') + '">' + (f.type || 'Conv') + '</span>';
      var registryBadge = f._registryAcres ? '<span class="registry-badge" title="Acres from Farm Registry">R</span>' : '';

      html += '<div class="farm-card">';
      html += '<div class="farm-card-header">';
      html += '<div>';
      html += '<div class="farm-card-name"><a href="#" class="farm-link" data-farm="' + (f.farm || '') + '">' + (f.farm || '').trim() + '</a></div>';
      html += '<div class="farm-card-crop">' + (f.crop || '').trim() + '</div>';
      html += '</div>';
      html += '<div class="farm-card-badges">' + typeBadge + registryBadge + '</div>';
      html += '</div>';

      if (hasEstimate) {
        html += '<div class="yield-bar-wrap">';
        html += '<div class="yield-bar-label"><span>Yield vs. estimate</span><span class="yield-bar-pct">' + yieldPct + '%</span></div>';
        html += '<div class="yield-bar-track"><div class="yield-bar-fill" style="width:' + yieldPct + '%"></div></div>';
        html += '</div>';
      }

      html += '<div class="farm-card-stats">';
      html += '<div class="farm-stat"><span class="farm-stat-value">' + util.formatNum(f.acres, 1) + '</span><span class="farm-stat-label">Acres</span></div>';
      html += '<div class="farm-stat"><span class="farm-stat-value">' + util.formatNum(f.totalBU, 0) + '</span><span class="farm-stat-label">Total BU</span></div>';
      html += '<div class="farm-stat"><span class="farm-stat-value">' + util.formatNum(f.yieldPerAcre, 1) + '</span><span class="farm-stat-label">BU/AC</span></div>';
      html += '</div>';

      if (destHtml) {
        html += '<div class="farm-card-destinations">' + destHtml + '</div>';
      }

      var hasInsurance = f.guarantee || f.coverage || f.claimThreshold;
      if (hasInsurance) {
        html += '<details class="farm-card-insurance">';
        html += '<summary>Insurance &amp; Overrides</summary>';
        html += '<div class="farm-insurance-grid">';
        if (f.guarantee) html += '<div class="farm-insurance-row"><span class="farm-insurance-label">Guarantee</span><span class="farm-insurance-value">' + f.guarantee + '</span></div>';
        if (f.coverage) html += '<div class="farm-insurance-row"><span class="farm-insurance-label">Coverage</span><span class="farm-insurance-value">' + f.coverage + '%</span></div>';
        if (f.claimThreshold) html += '<div class="farm-insurance-row"><span class="farm-insurance-label">Claim Thr.</span><span class="farm-insurance-value">' + f.claimThreshold + '</span></div>';
        if (f.discount) html += '<div class="farm-insurance-row"><span class="farm-insurance-label">Discount</span><span class="farm-insurance-value">' + f.discount + '</span></div>';
        if (f.testWeight) html += '<div class="farm-insurance-row"><span class="farm-insurance-label">Test Wt</span><span class="farm-insurance-value">' + f.testWeight + '</span></div>';
        html += '</div></details>';
      }

      html += '</div>';
    });

    grid.innerHTML = html;
  }

  // Click farm name card to switch to ticket log filtered by that farm
  document.getElementById('farm-card-grid').addEventListener('click', function (e) {
    var link = e.target.closest('.farm-link');
    if (!link) return;
    e.preventDefault();
    var farmName = link.getAttribute('data-farm');
    document.querySelector('.tab-btn[data-tab="list"]').click();
    document.getElementById('filter-farm').value = farmName;
    document.getElementById('filter-farm').dispatchEvent(new Event('change'));
  });

  // --- CSV Export ---
  document.getElementById('export-farms-btn').addEventListener('click', function () {
    window.location.href = '/api/export/farms';
  });

  // Always reload for fresh data when tab activates
  window.addEventListener('tab-activate', function (e) {
    if (e.detail === 'farms') {
      loadFarms();
    }
  });

})();
