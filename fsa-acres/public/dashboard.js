/* dashboard.js — Summary bar, rollup tables, drilldowns */
(function () {
  'use strict';

  var loaded = false;

  document.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'dashboard') load();
  });

  function load() {
    loaded = true;
    Promise.all([
      api.get('/api/rollup/summary-metrics'),
      api.get('/api/rollup/by-farm'),
      api.get('/api/rollup/by-crop')
    ]).then(function (res) {
      renderSummary(res[0]);
      renderFarmTable(res[1]);
      renderCropTable(res[2]);
    });
    loadTillage();
    loadCoverCrop();
    loadReportingProgress();
    loadValidation();
    populateSelects();
  }

  // ===== Summary bar =====
  function renderSummary(m) {
    util.$('dash-summary').innerHTML =
      si('Total Acres', util.comma(m.totalAcres)) +
      si('Records', util.commaInt(m.recordCount)) +
      si('Farms', m.farmCount) +
      si('Organic', util.comma(m.organicAcres), 'green') +
      si('Irrigated', util.comma(m.irrigatedAcres), 'blue') +
      si('Cover Cropped', util.comma(m.coverCroppedAcres), 'orange') +
      si('Reported', util.comma(m.reportedAcres), 'green');
  }

  function si(label, value, cls) {
    return '<div class="summary-item"><span class="summary-label">' + label +
      '</span><span class="summary-value' + (cls ? ' ' + cls : '') + '">' + value + '</span></div>';
  }

  // ===== Farm table =====
  function renderFarmTable(data) {
    var html = '<thead><tr><th>Farm#</th><th class="number">Total</th>' +
      '<th class="number">Dry</th><th class="number">Irrigated</th><th class="number">Organic</th></tr></thead><tbody>';
    var totals = { total: 0, dry: 0, irr: 0, org: 0 };
    data.forEach(function (f) {
      html += '<tr><td>' + util.esc(f.farmNumber) + '</td>' +
        '<td class="number bold">' + util.comma(f.totalAcres) + '</td>' +
        '<td class="number">' + util.comma(f.dryAcres) + '</td>' +
        '<td class="number">' + util.comma(f.irrigatedAcres) + '</td>' +
        '<td class="number">' + util.comma(f.organicAcres) + '</td></tr>';
      totals.total += f.totalAcres;
      totals.dry += f.dryAcres;
      totals.irr += f.irrigatedAcres;
      totals.org += f.organicAcres;
    });
    html += '<tr class="total-row"><td>TOTAL</td>' +
      '<td class="number">' + util.comma(totals.total) + '</td>' +
      '<td class="number">' + util.comma(totals.dry) + '</td>' +
      '<td class="number">' + util.comma(totals.irr) + '</td>' +
      '<td class="number">' + util.comma(totals.org) + '</td></tr>';
    html += '</tbody>';
    util.$('dash-farm-table').innerHTML = html;
  }

  // ===== Crop table =====
  function renderCropTable(data) {
    var html = '<thead><tr><th>Crop</th><th class="number">Total</th>' +
      '<th class="number">Dry</th><th class="number">Irrigated</th><th class="number">Organic</th></tr></thead><tbody>';
    var totals = { total: 0, dry: 0, irr: 0, org: 0 };
    data.forEach(function (c) {
      html += '<tr><td>' + util.esc(c.crop) + '</td>' +
        '<td class="number bold">' + util.comma(c.totalAcres) + '</td>' +
        '<td class="number">' + util.comma(c.dryAcres) + '</td>' +
        '<td class="number">' + util.comma(c.irrigatedAcres) + '</td>' +
        '<td class="number">' + util.comma(c.organicAcres) + '</td></tr>';
      totals.total += c.totalAcres;
      totals.dry += c.dryAcres;
      totals.irr += c.irrigatedAcres;
      totals.org += c.organicAcres;
    });
    html += '<tr class="total-row"><td>TOTAL</td>' +
      '<td class="number">' + util.comma(totals.total) + '</td>' +
      '<td class="number">' + util.comma(totals.dry) + '</td>' +
      '<td class="number">' + util.comma(totals.irr) + '</td>' +
      '<td class="number">' + util.comma(totals.org) + '</td></tr>';
    html += '</tbody>';
    util.$('dash-crop-table').innerHTML = html;
  }

  // ===== Drilldown selects =====
  function populateSelects() {
    api.get('/api/farm-numbers').then(function (farms) {
      var sel = util.$('dash-farm-select');
      sel.innerHTML = '<option value="">Select a farm...</option>';
      farms.forEach(function (f) {
        sel.innerHTML += '<option value="' + f.farmNumber + '">' + f.farmNumber + '</option>';
      });
    });
    api.get('/api/field-names').then(function (names) {
      var sel = util.$('dash-field-select');
      sel.innerHTML = '<option value="">Select a field...</option>';
      names.forEach(function (n) {
        sel.innerHTML += '<option value="' + util.esc(n) + '">' + util.esc(n) + '</option>';
      });
    });
  }

  util.$('dash-farm-select').addEventListener('change', function () {
    var fn = this.value;
    if (!fn) { util.$('dash-farm-drill').innerHTML = ''; return; }
    api.get('/api/rollup/by-field?farmNumber=' + encodeURIComponent(fn)).then(function (data) {
      var html = '<thead><tr><th>Field</th><th>Crop</th><th class="number">Total</th>' +
        '<th class="number">Dry</th><th class="number">Irrigated</th></tr></thead><tbody>';
      data.forEach(function (f) {
        f.crops.forEach(function (c, i) {
          html += '<tr><td>' + (i === 0 ? util.esc(f.fieldName) : '') + '</td>' +
            '<td>' + util.esc(c.crop) + '</td>' +
            '<td class="number">' + util.comma(c.totalAcres) + '</td>' +
            '<td class="number">' + util.comma(c.dryAcres) + '</td>' +
            '<td class="number">' + util.comma(c.irrigatedAcres) + '</td></tr>';
        });
      });
      html += '</tbody>';
      util.$('dash-farm-drill').innerHTML = html;
    });
  });

  util.$('dash-field-select').addEventListener('change', function () {
    var fn = this.value;
    if (!fn) { util.$('dash-field-drill').innerHTML = ''; return; }
    api.get('/api/clu-records?fieldName=' + encodeURIComponent(fn)).then(function (records) {
      var html = '<thead><tr><th>Farm#</th><th>Tract</th><th>CLU</th><th>Crop</th>' +
        '<th class="number">Acres</th><th>IRR</th><th>ORG</th></tr></thead><tbody>';
      records.forEach(function (r) {
        html += '<tr><td>' + util.esc(r.farmNumber) + '</td><td>' + util.esc(r.tractNumber) + '</td>' +
          '<td>' + util.esc(r.clu) + '</td><td>' + util.esc(r.crop) + '</td>' +
          '<td class="number">' + util.comma(r.fsaAcres) + '</td>' +
          '<td>' + (r.irrigated ? '<span class="badge badge-irr">IRR</span>' : '') + '</td>' +
          '<td>' + (r.organic ? '<span class="badge badge-org">ORG</span>' : '') + '</td></tr>';
      });
      html += '</tbody>';
      util.$('dash-field-drill').innerHTML = html;
    });
  });

  // ===== Tillage summary =====
  function loadTillage() {
    var year = util.$('dash-tillage-year').value;
    api.get('/api/rollup/tillage-summary?year=' + year).then(function (data) {
      var html = '<thead><tr><th>Code</th><th>Practice</th><th class="number">Total Ac</th>' +
        '<th class="number">New Practice</th><th class="number">Early Adopter</th></tr></thead><tbody>';
      var total = 0;
      data.forEach(function (t) {
        html += '<tr><td>' + util.esc(t.code) + '</td><td>' + util.esc(t.name) + '</td>' +
          '<td class="number">' + util.comma(t.totalAcres) + '</td>' +
          '<td class="number">' + util.comma(t.newPracticeAcres) + '</td>' +
          '<td class="number">' + util.comma(t.earlyAdopterAcres) + '</td></tr>';
        total += t.totalAcres;
      });
      html += '<tr class="total-row"><td colspan="2">TOTAL</td>' +
        '<td class="number">' + util.comma(total) + '</td><td></td><td></td></tr>';
      html += '</tbody>';
      util.$('dash-tillage-table').innerHTML = html;
    });
  }

  util.$('dash-tillage-year').addEventListener('change', loadTillage);

  // ===== Cover crop summary =====
  function loadCoverCrop() {
    var year = util.$('dash-cc-year').value;
    api.get('/api/rollup/cover-crop-summary?year=' + year).then(function (data) {
      var html = '<thead><tr><th>Species</th><th class="number">Acres</th></tr></thead><tbody>';
      var total = 0;
      data.forEach(function (c) {
        html += '<tr><td>' + util.esc(c.species) + '</td><td class="number">' + util.comma(c.acres) + '</td></tr>';
        total += c.acres;
      });
      html += '<tr class="total-row"><td>TOTAL</td><td class="number">' + util.comma(total) + '</td></tr>';
      html += '</tbody>';
      util.$('dash-cc-table').innerHTML = html;
    });
  }

  util.$('dash-cc-year').addEventListener('change', loadCoverCrop);

  // ===== Reporting progress =====
  function loadReportingProgress() {
    api.get('/api/rollup/reporting-progress').then(function (data) {
      var html = '<thead><tr><th>Farm#</th><th class="number">Total</th><th class="number">Reported</th>' +
        '<th class="number">Unreported</th><th class="number">%</th><th style="width:120px">Progress</th></tr></thead><tbody>';
      var totals = { total: 0, reported: 0, unreported: 0 };
      data.forEach(function (f) {
        var cls = f.pct >= 100 ? 'progress-green' : f.pct >= 50 ? 'progress-yellow' : 'progress-red';
        html += '<tr><td>' + util.esc(f.farmNumber) + '</td>' +
          '<td class="number">' + f.total + '</td>' +
          '<td class="number">' + f.reported + '</td>' +
          '<td class="number">' + f.unreported + '</td>' +
          '<td class="number bold">' + f.pct + '%</td>' +
          '<td><div class="progress-bar"><div class="progress-fill ' + cls + '" style="width:' + f.pct + '%"></div></div></td></tr>';
        totals.total += f.total;
        totals.reported += f.reported;
        totals.unreported += f.unreported;
      });
      var totalPct = totals.total > 0 ? Math.round(totals.reported / totals.total * 100) : 0;
      html += '<tr class="total-row"><td>TOTAL</td>' +
        '<td class="number">' + totals.total + '</td>' +
        '<td class="number">' + totals.reported + '</td>' +
        '<td class="number">' + totals.unreported + '</td>' +
        '<td class="number">' + totalPct + '%</td>' +
        '<td></td></tr>';
      html += '</tbody>';
      util.$('dash-progress-table').innerHTML = html;
    });
  }

  // ===== Validation warnings =====
  function loadValidation() {
    api.get('/api/validation').then(function (warnings) {
      var el = util.$('dash-warnings');
      if (warnings.length === 0) {
        el.innerHTML = '<div style="padding:1rem;color:var(--success);font-weight:600">All clear — no issues detected</div>';
        return;
      }
      var html = '';
      warnings.forEach(function (w) {
        var icon = w.severity === 'warning' ? '&#9888;' : '&#8505;';
        var cls = w.severity === 'warning' ? 'warning-item-warn' : 'warning-item-info';
        var linkAttr = '';
        if (w.filter) {
          linkAttr = ' class="warning-link" data-filter=\'' + JSON.stringify(w.filter) + '\'';
        }
        html += '<div class="warning-item ' + cls + '"' + linkAttr + '>' +
          '<span class="warning-icon">' + icon + '</span>' +
          '<span class="warning-msg">' + util.esc(w.message) + '</span></div>';
      });
      el.innerHTML = html;

      // Click handlers to jump to FSA tab with filter
      el.querySelectorAll('.warning-link').forEach(function (link) {
        link.addEventListener('click', function () {
          var filter = JSON.parse(this.getAttribute('data-filter'));
          // Switch to FSA Data tab
          document.querySelector('[data-tab="fsa-entry"]').click();
          // Apply filter
          setTimeout(function () {
            if (filter.reported !== undefined) util.$('fsa-reported-filter').value = filter.reported;
            if (filter.crop !== undefined) util.$('fsa-crop-filter').value = filter.crop;
            // Trigger change
            util.$('fsa-reported-filter').dispatchEvent(new Event('change'));
          }, 200);
        });
      });
    });
  }

})();
