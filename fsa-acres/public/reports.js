/* reports.js — Printable reports: FSA acreage, insurance summary, reporting checklist, CSV export */
(function () {
  'use strict';

  document.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'reports') populateFarmSelect();
  });

  function populateFarmSelect() {
    api.get('/api/farm-numbers').then(function (farms) {
      var sel = util.$('rpt-farm-select');
      sel.innerHTML = '<option value="">All Farms</option>';
      farms.forEach(function (f) {
        sel.innerHTML += '<option value="' + f.farmNumber + '">' + f.farmNumber + '</option>';
      });
    });
  }

  util.$('rpt-generate-btn').addEventListener('click', generate);

  function generate() {
    var type = util.$('rpt-type').value;
    var farm = util.$('rpt-farm-select').value;
    if (type === 'fsa') generateFSA(farm);
    else if (type === 'intentions') generateIntentions(farm);
    else if (type === 'insurance') generateInsurance();
    else if (type === 'checklist') generateChecklist(farm);
  }

  // ===== FSA Acreage Report =====
  function generateFSA(farmNumber) {
    var url = '/api/clu-records' + (farmNumber ? '?farmNumber=' + encodeURIComponent(farmNumber) : '');
    Promise.all([api.get(url), api.get('/api/settings')]).then(function (res) {
      var records = res[0];
      var settings = res[1];

      // Sort by farm, tract, clu
      records.sort(function (a, b) {
        var cmp = (a.farmNumber || '').localeCompare(b.farmNumber || '');
        if (cmp !== 0) return cmp;
        cmp = (a.tractNumber || '').localeCompare(b.tractNumber || '');
        if (cmp !== 0) return cmp;
        return (a.clu || '').localeCompare(b.clu || '');
      });

      var totalAcres = 0;
      records.forEach(function (r) { totalAcres += r.fsaAcres || 0; });

      var html = '<div class="report-header">' +
        '<h2>FSA Acreage Report</h2>' +
        '<div class="report-meta">' +
        (farmNumber ? 'Farm #' + util.esc(farmNumber) + ' | ' : 'All Farms | ') +
        (settings.producerName ? util.esc(settings.producerName) + ' | ' : '') +
        util.esc(settings.county) + ' County, ' + util.esc(settings.state) + ' | ' +
        settings.year + '</div></div>';

      html += '<table style="width:100%"><thead><tr>' +
        '<th>Farm#</th><th>Tract</th><th>CLU</th><th>Field</th><th>Crop</th>' +
        '<th class="number">Acres</th><th>IRR</th><th>ORG</th><th>Plant Date</th><th>Use</th><th>Status</th>' +
        '</tr></thead><tbody>';

      records.forEach(function (r) {
        html += '<tr>' +
          '<td>' + util.esc(r.farmNumber) + '</td>' +
          '<td>' + util.esc(r.tractNumber) + '</td>' +
          '<td>' + util.esc(r.clu) + '</td>' +
          '<td>' + util.esc(r.fieldName) + '</td>' +
          '<td>' + util.esc(r.crop) + '</td>' +
          '<td class="number">' + util.comma(r.fsaAcres) + '</td>' +
          '<td>' + (r.irrigated ? 'Yes' : '') + '</td>' +
          '<td>' + (r.organic ? 'Yes' : '') + '</td>' +
          '<td>' + util.esc(r.grainPlantDate) + '</td>' +
          '<td>' + util.esc(r.use) + '</td>' +
          '<td>' + (r.reported ? '<span class="badge badge-reported">Reported</span>' : '<span class="badge badge-unreported">Unreported</span>') + '</td>' +
          '</tr>';
      });

      html += '<tr class="total-row"><td colspan="5">TOTAL</td><td class="number">' + util.comma(totalAcres) + '</td>' +
        '<td colspan="5">' + records.length + ' records</td></tr>';
      html += '</tbody></table>';

      html += '<div class="report-footer">' +
        '<div class="sig-line">Producer Signature</div>' +
        '<div class="sig-line">Date</div>' +
        '</div>';

      util.$('rpt-output').innerHTML = html;
    });
  }

  // ===== Cropping Intentions by Tract/Unit/CLU =====
  function generateIntentions(farmNumber) {
    var url = '/api/cropping-intentions' + (farmNumber ? '?farmNumber=' + encodeURIComponent(farmNumber) : '');
    api.get(url).then(function (data) {
      var rows = data.rows;

      var html = '<div class="report-header">' +
        '<h2>Cropping Intentions by Tract / Unit / CLU</h2>' +
        '<div class="report-meta">' +
        (farmNumber ? 'Farm #' + util.esc(farmNumber) + ' | ' : 'All Farms | ') +
        (data.producerName ? util.esc(data.producerName) + ' | ' : '') +
        util.esc(data.county) + ' County, ' + util.esc(data.state) + ' | ' +
        data.year + '</div></div>';

      // Group by farm → tract
      var farms = {};
      rows.forEach(function (r) {
        var fk = r.farmNumber || 'Unknown';
        if (!farms[fk]) farms[fk] = {};
        var tk = r.tractNumber || 'Unknown';
        if (!farms[fk][tk]) farms[fk][tk] = [];
        farms[fk][tk].push(r);
      });

      var grandTotalFsa = 0;
      var grandTotalBudget = 0;
      var grandCount = 0;
      var unmatchedCount = 0;

      Object.keys(farms).sort().forEach(function (farmNum) {
        var tracts = farms[farmNum];
        html += '<h3 style="margin-top:1.25rem;margin-bottom:0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.25rem">Farm #' + util.esc(farmNum) + '</h3>';

        html += '<table style="width:100%;margin-bottom:1rem"><thead><tr>' +
          '<th>Tract</th><th>Unit</th><th>CLU</th><th>Field</th><th>Class</th>' +
          '<th>FSA Crop</th><th class="number">FSA Ac</th>' +
          '<th>Budget Crop</th><th class="number">Budget Ac</th>' +
          '<th>Enterprise</th><th>ORG</th><th>Plant Date</th>' +
          '</tr></thead><tbody>';

        var farmTotalFsa = 0;
        var farmTotalBudget = 0;
        var farmCount = 0;

        Object.keys(tracts).sort().forEach(function (tractNum) {
          var cluRows = tracts[tractNum];
          cluRows.forEach(function (r, idx) {
            var mismatch = r.matched && r.fsaCrop && r.budgetCrop &&
              r.fsaCrop.toLowerCase() !== r.budgetCrop.toLowerCase();
            var rowClass = !r.matched ? ' class="row-unmatched"' : mismatch ? ' class="row-mismatch"' : '';
            html += '<tr' + rowClass + '>' +
              '<td>' + (idx === 0 ? util.esc(r.tractNumber) : '') + '</td>' +
              '<td>' + util.esc(r.unitNumber) + '</td>' +
              '<td>' + util.esc(r.clu) + '</td>' +
              '<td>' + util.esc(r.fieldName) + '</td>' +
              '<td>' + util.esc(r.landClass) + '</td>' +
              '<td>' + util.esc(r.fsaCrop) + '</td>' +
              '<td class="number">' + util.comma(r.fsaAcres) + '</td>' +
              '<td>' + (r.matched ? util.esc(r.budgetCrop) : '<span style="color:var(--text-light)">—</span>') + '</td>' +
              '<td class="number">' + (r.matched ? util.comma(r.budgetAcres) : '') + '</td>' +
              '<td>' + util.esc(r.enterprise) + '</td>' +
              '<td>' + (r.organic ? 'Yes' : '') + '</td>' +
              '<td>' + util.esc(r.plantDate) + '</td>' +
              '</tr>';
            farmTotalFsa += r.fsaAcres || 0;
            farmTotalBudget += r.matched ? (r.budgetAcres || 0) : 0;
            farmCount++;
            if (!r.matched) unmatchedCount++;
          });
        });

        html += '<tr class="total-row"><td colspan="6">Farm #' + util.esc(farmNum) + ' Total</td>' +
          '<td class="number">' + util.comma(farmTotalFsa) + '</td>' +
          '<td></td><td class="number">' + util.comma(farmTotalBudget) + '</td>' +
          '<td colspan="3">' + farmCount + ' CLUs</td></tr>';
        html += '</tbody></table>';

        grandTotalFsa += farmTotalFsa;
        grandTotalBudget += farmTotalBudget;
        grandCount += farmCount;
      });

      // Summary footer
      html += '<div style="margin-top:1rem;padding:0.75rem;border:1px solid var(--border);border-radius:4px">' +
        '<strong>Summary:</strong> ' + grandCount + ' CLUs | ' +
        'FSA Acres: ' + util.comma(grandTotalFsa) + ' | ' +
        'Budget Acres: ' + util.comma(grandTotalBudget);
      if (unmatchedCount > 0) {
        html += ' | <span style="color:#e57373">' + unmatchedCount + ' CLUs with no budget match</span>';
      }
      html += '</div>';

      // Legend
      html += '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-light)">' +
        '<span style="display:inline-block;width:12px;height:12px;background:rgba(229,115,115,0.15);border:1px solid rgba(229,115,115,0.3);margin-right:4px;vertical-align:middle"></span> No budget match &nbsp; ' +
        '<span style="display:inline-block;width:12px;height:12px;background:rgba(255,183,77,0.15);border:1px solid rgba(255,183,77,0.3);margin-right:4px;vertical-align:middle"></span> Crop mismatch (FSA vs Budget)' +
        '</div>';

      html += '<div class="report-footer">' +
        '<div class="sig-line">Producer Signature</div>' +
        '<div class="sig-line">Date</div>' +
        '</div>';

      util.$('rpt-output').innerHTML = html;
    });
  }

  // ===== Insurance Summary Report =====
  function generateInsurance() {
    api.get('/api/insurance').then(function (data) {
      var html = '<div class="report-header">' +
        '<h2>Crop Insurance Summary</h2>' +
        '<div class="report-meta">All Policies | ' + new Date().toLocaleDateString() + '</div></div>';

      html += '<table style="width:100%"><thead><tr>' +
        '<th>Policy#</th><th>Line</th><th>Farm#</th><th>Crop</th>' +
        '<th class="number">Planted</th><th class="number">Cov%</th>' +
        '<th class="number">Guarantee</th><th class="number">Actual</th><th class="number">Shortfall</th>' +
        '<th class="number">$ Guarantee</th><th class="number">Indemnity</th><th>Status</th>' +
        '</tr></thead><tbody>';

      var totalPlanted = 0, totalDollarGuarantee = 0, totalIndemnity = 0;

      data.forEach(function (p) {
        var c = p._computed || {};
        var status = c.claimStatus || p.claimStatus || 'none';
        var rowClass = status === 'potential' ? 'row-claim-potential' :
                       status === 'filed' ? 'row-claim-filed' :
                       status === 'paid' ? 'row-claim-paid' : '';

        html += '<tr class="' + rowClass + '">' +
          '<td>' + util.esc(p.policyNumber) + '</td>' +
          '<td>' + util.esc(p.lineNumber) + '</td>' +
          '<td>' + util.esc(p.farmNumber || p.farmName) + '</td>' +
          '<td>' + util.esc(p.crop) + '</td>' +
          '<td class="number">' + util.comma(p.plantedAcres) + '</td>' +
          '<td class="number">' + (p.coverageLevel || '') + '</td>' +
          '<td class="number">' + util.comma(p.guarantee) + '</td>' +
          '<td class="number">' + util.comma(p.actual) + '</td>' +
          '<td class="number' + (c.shortfall > 0 ? ' profit-neg bold' : '') + '">' + util.comma(c.shortfall) + '</td>' +
          '<td class="number">' + util.dollar(c.dollarGuarantee) + '</td>' +
          '<td class="number' + (c.indemnity > 0 ? ' profit-neg bold' : '') + '">' + util.dollar(c.indemnity) + '</td>' +
          '<td><span class="badge claim-' + status + '">' + statusLabel(status) + '</span></td>' +
          '</tr>';

        totalPlanted += p.plantedAcres || 0;
        totalDollarGuarantee += c.dollarGuarantee || 0;
        totalIndemnity += c.indemnity || 0;
      });

      html += '<tr class="total-row"><td colspan="4">TOTAL</td>' +
        '<td class="number">' + util.comma(totalPlanted) + '</td>' +
        '<td colspan="4"></td>' +
        '<td class="number">' + util.dollar(totalDollarGuarantee) + '</td>' +
        '<td class="number">' + util.dollar(totalIndemnity) + '</td>' +
        '<td>' + data.length + ' policies</td></tr>';
      html += '</tbody></table>';

      util.$('rpt-output').innerHTML = html;
    });
  }

  // ===== Reporting Checklist =====
  function generateChecklist(farmNumber) {
    var url = '/api/clu-records' + (farmNumber ? '?farmNumber=' + encodeURIComponent(farmNumber) : '');
    api.get(url).then(function (records) {
      // Group by farm
      var farms = {};
      records.forEach(function (r) {
        var fn = r.farmNumber || 'Unknown';
        if (!farms[fn]) farms[fn] = [];
        farms[fn].push(r);
      });

      var html = '<div class="report-header">' +
        '<h2>FSA Reporting Checklist</h2>' +
        '<div class="report-meta">' +
        (farmNumber ? 'Farm #' + util.esc(farmNumber) : 'All Farms') +
        ' | ' + new Date().toLocaleDateString() + '</div></div>';

      Object.keys(farms).sort().forEach(function (fn) {
        var recs = farms[fn];
        recs.sort(function (a, b) {
          return (a.fieldName || '').localeCompare(b.fieldName || '');
        });

        html += '<h3 style="margin-top:1rem;margin-bottom:0.5rem;border-bottom:1px solid var(--border);padding-bottom:0.25rem">Farm #' + util.esc(fn) + '</h3>';
        html += '<table style="width:100%;margin-bottom:1rem"><thead><tr>' +
          '<th style="width:30px"></th><th>Field</th><th>Tract</th><th>CLU</th><th>Crop</th>' +
          '<th class="number">Acres</th><th>Status</th></tr></thead><tbody>';

        recs.forEach(function (r) {
          var checked = r.reported ? ' checked disabled' : '';
          html += '<tr>' +
            '<td><input type="checkbox"' + checked + ' class="row-checkbox"></td>' +
            '<td>' + util.esc(r.fieldName) + '</td>' +
            '<td>' + util.esc(r.tractNumber) + '</td>' +
            '<td>' + util.esc(r.clu) + '</td>' +
            '<td>' + util.esc(r.crop) + '</td>' +
            '<td class="number">' + util.comma(r.fsaAcres) + '</td>' +
            '<td>' + (r.reported ? '<span class="badge badge-reported">Done</span>' : '<span class="badge badge-unreported">Pending</span>') + '</td>' +
            '</tr>';
        });

        var farmTotal = 0;
        recs.forEach(function (r) { farmTotal += r.fsaAcres || 0; });
        html += '<tr class="total-row"><td></td><td colspan="4">Subtotal</td><td class="number">' + util.comma(farmTotal) + '</td><td>' + recs.length + ' CLUs</td></tr>';
        html += '</tbody></table>';
      });

      util.$('rpt-output').innerHTML = html;
    });
  }

  function statusLabel(s) {
    if (s === 'potential') return 'Potential';
    if (s === 'filed') return 'Filed';
    if (s === 'paid') return 'Paid';
    return 'No Claim';
  }

  // ===== CSV Export =====
  util.$('rpt-csv-btn').addEventListener('click', function () {
    var type = util.$('rpt-type').value;
    var farm = util.$('rpt-farm-select').value;

    var url;
    if (type === 'intentions') {
      url = '/api/export/intentions' + (farm ? '?farmNumber=' + encodeURIComponent(farm) : '');
    } else if (type === 'fsa' || type === 'checklist') {
      url = '/api/export/fsa' + (farm ? '?farmNumber=' + encodeURIComponent(farm) : '');
    } else {
      url = '/api/export/insurance';
    }

    // Trigger download
    var a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('CSV download started');
  });

})();
