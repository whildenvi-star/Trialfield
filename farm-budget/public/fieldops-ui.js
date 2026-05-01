// FieldOps Integration UI — sync status, history, application & yield viewers
(function () {
  'use strict';

  var statusEl = document.getElementById('fieldops-status');
  var syncBtn = document.getElementById('fieldops-sync-btn');
  var historyEl = document.getElementById('fieldops-history-list');

  // --- Sync Status Badge ---
  function loadSyncStatus() {
    api.get('/api/fieldops/status').then(function (status) {
      var modeLabel = status.useMock ? 'Mock Data' : (status.configured ? 'Live API' : 'Not Configured');
      var statusLabel = status.lastStatus || 'never synced';
      var timeLabel = status.lastSync
        ? new Date(status.lastSync).toLocaleString()
        : 'Never';

      var badgeCls = status.lastStatus === 'success' ? 'fieldops-status-ok'
        : status.lastStatus === 'error' ? 'fieldops-status-err' : '';

      statusEl.innerHTML =
        '<span class="fieldops-mode">' + util.escHtml(modeLabel) + '</span> ' +
        '<span class="fieldops-status-badge ' + badgeCls + '">' + util.escHtml(statusLabel) + '</span> ' +
        '<span class="fieldops-time">Last sync: ' + util.escHtml(timeLabel) + '</span>';

      if (status.syncEnabled) {
        statusEl.innerHTML += ' <span class="fieldops-time">(auto: every ' + status.syncIntervalMinutes + ' min)</span>';
      }

      if (status.lastError) {
        statusEl.innerHTML += '<div class="fieldops-error">' + util.escHtml(status.lastError) + '</div>';
      }
    }).catch(function () {
      statusEl.innerHTML = '<span class="fieldops-mode">Unavailable</span>';
    });
  }

  // --- Manual Sync Button ---
  if (syncBtn) {
    syncBtn.addEventListener('click', function () {
      syncBtn.disabled = true;
      syncBtn.textContent = 'Syncing...';
      api.post('/api/fieldops/sync', {}).then(function (result) {
        var msg = 'FieldOps sync: ' + result.fieldsMatched + ' matched, ' +
          result.fieldsCreated + ' created, ' + result.applicationsImported + ' applications';
        util.showToast(msg, 4000);
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Now';
        loadSyncStatus();
        loadSyncHistory();
        window.reloadRefData();
      }).catch(function (err) {
        util.showToast('Sync failed: ' + (err.message || err), 5000, 'error');
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync Now';
        loadSyncStatus();
      });
    });
  }

  // --- Sync History Table ---
  function loadSyncHistory() {
    if (!historyEl) return;
    api.get('/api/fieldops/history').then(function (history) {
      if (!history || !history.length) {
        historyEl.innerHTML = '<tr><td colspan="6" style="color:var(--text-light);text-align:center">No sync history yet</td></tr>';
        return;
      }
      historyEl.innerHTML = history.slice(0, 10).map(function (h) {
        var statusCls = h.status === 'success' ? 'fieldops-status-ok' : 'fieldops-status-err';
        return '<tr>' +
          '<td style="white-space:nowrap">' + new Date(h.date).toLocaleString() + '</td>' +
          '<td><span class="fieldops-status-badge ' + statusCls + '">' + util.escHtml(h.status) + '</span></td>' +
          '<td class="number">' + h.fieldsMatched + '</td>' +
          '<td class="number">' + h.fieldsCreated + '</td>' +
          '<td class="number">' + h.applicationsImported + '</td>' +
          '<td>' + (h.errors && h.errors.length ? util.escHtml(h.errors.join(', ')) : '--') + '</td>' +
          '</tr>';
      }).join('');
    });
  }

  // --- Field Applications Viewer (called from field-editor.js) ---
  window.loadFieldApplications = function (fieldId, containerEl) {
    if (!containerEl) return;
    api.get('/api/fieldops/applications/' + fieldId).then(function (apps) {
      if (!apps || !apps.length) {
        containerEl.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem">No application data synced from FieldOps.</p>';
        return;
      }
      var html = '<table class="compact-table"><thead><tr>' +
        '<th>Date</th><th>Type</th><th>Products</th><th>Rate</th><th>Applicator</th><th>Notes</th>' +
        '</tr></thead><tbody>';
      apps.forEach(function (app) {
        var prodNames = (app.products || []).map(function (p) {
          return util.escHtml(p.name);
        }).join(', ');
        var prodRates = (app.products || []).map(function (p) {
          return p.rate + ' ' + util.escHtml(p.unit);
        }).join(', ');
        var typeCls = app.type === 'FERTILIZER' ? 'fieldops-type-fert'
          : app.type === 'HERBICIDE' ? 'fieldops-type-herb'
          : app.type === 'INSECTICIDE' ? 'fieldops-type-insect'
          : app.type === 'PLANTING' ? 'fieldops-type-plant'
          : '';
        html += '<tr>' +
          '<td style="white-space:nowrap">' + util.escHtml(app.date) + '</td>' +
          '<td><span class="fieldops-app-type ' + typeCls + '">' + util.escHtml(app.type) + '</span></td>' +
          '<td>' + prodNames + '</td>' +
          '<td style="white-space:nowrap">' + prodRates + '</td>' +
          '<td>' + util.escHtml(app.applicator || '') + '</td>' +
          '<td>' + util.escHtml(app.notes || '') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      containerEl.innerHTML = html;
    }).catch(function () {
      containerEl.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem">Could not load application data.</p>';
    });
  };

  // --- Yield History Viewer (called from field-editor.js) ---
  window.loadFieldYieldHistory = function (fieldId, containerEl) {
    if (!containerEl) return;
    api.get('/api/fieldops/yield-history/' + fieldId).then(function (yields) {
      if (!yields || !yields.length) {
        containerEl.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem">No yield history from FieldOps.</p>';
        return;
      }
      var html = '<table class="compact-table"><thead><tr>' +
        '<th>Season</th><th>Crop</th><th>Yield/AC</th><th>Moisture %</th><th>Harvest Date</th>' +
        '</tr></thead><tbody>';
      yields.forEach(function (y) {
        html += '<tr>' +
          '<td>' + util.escHtml(y.season) + '</td>' +
          '<td>' + util.escHtml(y.crop || '') + '</td>' +
          '<td class="number">' + util.formatNum(y.yieldPerAcre, 1) + '</td>' +
          '<td class="number">' + util.formatNum(y.moisture, 1) + '</td>' +
          '<td>' + util.escHtml(y.harvestDate || '') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      containerEl.innerHTML = html;
    }).catch(function () {
      containerEl.innerHTML = '<p style="color:var(--text-light);font-size:0.8rem">Could not load yield history.</p>';
    });
  };

  // --- Init on data load ---
  window.addEventListener('ref-data-loaded', function () {
    loadSyncStatus();
    loadSyncHistory();
  });
})();
