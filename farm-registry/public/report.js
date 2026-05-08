(function () {
  'use strict';

  // Set report date
  document.getElementById('report-date').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  function formatNum(n, decimals) {
    if (n === null || n === undefined || n === 0) return '-';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Derive certStatus and tillable values for fields that haven't been
  // re-saved since those columns were added.
  function deriveField(f) {
    var acres = f.reportingAcres || 0;
    var org = f.organicAcres || 0;

    // certStatus: use stored value if set, otherwise infer from organicAcres
    if (!f.certStatus) {
      if (org > 0 && Math.abs(org - acres) < 0.01) {
        f.certStatus = 'organic';
      } else if (org > 0) {
        f.certStatus = 'split';
      } else {
        f.certStatus = 'conventional';
      }
    }

    // Tillable breakdown: use stored values if any were filled in,
    // otherwise derive from ownership + reportingAcres
    var hasStored = (f.rentedTillable || 0) > 0 || (f.ownedTillable || 0) > 0;
    if (!hasStored && acres > 0) {
      if (f.ownership === 'rented') {
        f.rentedTillable = acres;
        f.ownedTillable = 0;
      } else if (f.ownership === 'owned') {
        f.ownedTillable = acres;
        f.rentedTillable = 0;
      }
      // mixed: leave as-is (0/0) since we can't guess the split
    }

    return f;
  }

  function normName(n) {
    return n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  // Fetch fields and FSA CLU records in parallel
  Promise.all([
    fetch('/api/fields').then(function (r) { return r.json(); }),
    fetch('/api/fsa/clu-records').then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (results) {
    var fields = results[0];
    var cluRecords = results[1];

    // Non-crop codes (case-insensitive)
    var NON_CROP = ['nc', 'crp', 'gls', 'idle', 'grass'];
    function isNonCrop(crop) {
      return NON_CROP.indexOf((crop || '').trim().toLowerCase()) !== -1;
    }

    // Build FSA acres lookup: normalized field name → { crop, other }
    var fsaByField = {};
    cluRecords.forEach(function (clu) {
      if (!clu.fieldName) return;
      var key = normName(clu.fieldName);
      if (!fsaByField[key]) fsaByField[key] = { crop: 0, other: 0 };
      var acres = clu.fsaAcres || 0;
      if (isNonCrop(clu.crop)) {
        fsaByField[key].other += acres;
      } else {
        fsaByField[key].crop += acres;
      }
    });

    // Helper: get FSA totals for a field using name + aliases
    function getFsaTotals(f) {
      var names = [f.name].concat(f.aliases || []);
      for (var i = 0; i < names.length; i++) {
        var key = normName(names[i]);
        if (fsaByField[key] !== undefined) return fsaByField[key];
      }
      return null;
    }
      // Filter active only, derive missing data, sort by name
      var active = fields
        .filter(function (f) { return f.active; })
        .map(deriveField)
        .sort(function (a, b) { return a.name.localeCompare(b.name); });

      // Compute totals
      var totalAcres = 0, totalOrganic = 0;
      var rented = 0, owned = 0, mixed = 0;
      var totalRentedTill = 0, totalOwnedTill = 0, totalNonTill = 0;
      var totalFsaCrop = 0, totalFsaOther = 0;

      active.forEach(function (f) {
        totalAcres += f.reportingAcres || 0;
        totalOrganic += f.organicAcres || 0;
        totalRentedTill += f.rentedTillable || 0;
        totalOwnedTill += f.ownedTillable || 0;
        totalNonTill += f.nonTillable || 0;
        var fsa = getFsaTotals(f);
        f._fsa = fsa;
        if (fsa) { totalFsaCrop += fsa.crop; totalFsaOther += fsa.other; }
        if (f.ownership === 'rented') rented++;
        else if (f.ownership === 'owned') owned++;
        else if (f.ownership === 'mixed') mixed++;
      });

      // Render summary
      document.getElementById('summary-bar').innerHTML =
        summaryCard('Fields', active.length) +
        summaryCard('Total Acres', formatNum(totalAcres, 2)) +
        summaryCard('Organic', formatNum(totalOrganic, 2), 'organic') +
        summaryCard('Rented', rented) +
        summaryCard('Owned', owned) +
        summaryCard('Mixed', mixed);

      // Render table rows
      var tbody = document.getElementById('report-tbody');
      var html = '';

      active.forEach(function (f) {
        var ownerBadge = '<span class="badge badge-' + (f.ownership || 'rented') + '">' + (f.ownership || 'rented') + '</span>';
        var cert = f.certStatus || 'conventional';
        var certBadge = '<span class="cert-badge cert-' + cert + '">' + cert + '</span>';

        var shpCell;
        if (f.shapefiles && f.shapefiles.length > 0) {
          shpCell = '<img class="shp-thumb" src="/api/fields/' + f.id + '/shapefile/preview" onerror="this.outerHTML=\'<span class=shp-none>-</span>\'">';
        } else {
          shpCell = '<span class="shp-none">-</span>';
        }

        html += '<tr>';
        html += '<td style="font-weight:500;">' + esc(f.name) + '</td>';
        html += '<td class="number">' + formatNum(f.reportingAcres, 2) + '</td>';
        html += '<td>' + ownerBadge + '</td>';
        html += '<td>' + certBadge + '</td>';
        html += '<td class="number">' + formatNum(f.rentedTillable, 2) + '</td>';
        html += '<td class="number">' + formatNum(f.ownedTillable, 2) + '</td>';
        html += '<td class="number">' + formatNum(f.nonTillable, 2) + '</td>';

        // FSA crop, other, delta (delta compares registry vs FSA crop only)
        if (f._fsa) {
          var delta = f._fsa.crop - (f.reportingAcres || 0);
          var absDelta = Math.abs(delta);
          var sign = delta > 0 ? '+' : '';
          var cls = absDelta < 1 ? 'delta-ok' : 'delta-warn';
          html += '<td class="number">' + formatNum(f._fsa.crop, 2) + '</td>';
          html += '<td class="number">' + formatNum(f._fsa.other, 2) + '</td>';
          html += '<td class="number ' + cls + '">' + sign + delta.toFixed(2) + '</td>';
        } else {
          html += '<td class="number shp-none">-</td>';
          html += '<td class="number shp-none">-</td>';
          html += '<td class="number shp-none">-</td>';
        }

        html += '<td>' + shpCell + '</td>';
        html += '</tr>';
      });

      // Totals row
      html += '<tr class="totals-row">';
      html += '<td>' + active.length + ' fields</td>';
      html += '<td class="number">' + formatNum(totalAcres, 2) + '</td>';
      html += '<td></td>';
      html += '<td></td>';
      html += '<td class="number">' + formatNum(totalRentedTill, 2) + '</td>';
      html += '<td class="number">' + formatNum(totalOwnedTill, 2) + '</td>';
      html += '<td class="number">' + formatNum(totalNonTill, 2) + '</td>';
      var totalDelta = totalFsaCrop - totalAcres;
      var totalSign = totalDelta > 0 ? '+' : '';
      var totalCls = Math.abs(totalDelta) < 1 ? 'delta-ok' : 'delta-warn';
      html += '<td class="number">' + formatNum(totalFsaCrop, 2) + '</td>';
      html += '<td class="number">' + formatNum(totalFsaOther, 2) + '</td>';
      html += '<td class="number ' + totalCls + '">' + totalSign + totalDelta.toFixed(2) + '</td>';
      html += '<td></td>';
      html += '</tr>';

      tbody.innerHTML = html;
      document.getElementById('loading').style.display = 'none';
      document.getElementById('report-table').style.display = '';
    });

  function summaryCard(label, value, cls) {
    return '<div class="summary-card"><div class="label">' + label +
      '</div><div class="value' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';
  }
})();
