/* season.js — Seasonal Flow Dashboard: cross-app status with Chart.js visuals */
(function () {
  'use strict';

  // --- Chart.js setup ---
  var charts = {};

  var centerLabelPlugin = {
    id: 'centerLabel',
    afterDraw: function (chart) {
      var cfg = chart.config.options.plugins.centerLabel;
      if (!cfg || !cfg.text) return;
      var ctx = chart.ctx;
      var cx = (chart.chartArea.left + chart.chartArea.right) / 2;
      var cy = (chart.chartArea.top + chart.chartArea.bottom) / 2;
      ctx.save();
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.text, cx, cy);
      ctx.restore();
    }
  };

  if (typeof Chart !== 'undefined') {
    Chart.register(centerLabelPlugin);
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }

  function upsertChart(key, canvasId, type, chartData, opts) {
    var canvas = util.$(canvasId);
    if (!canvas || typeof Chart === 'undefined') return null;
    if (charts[key]) {
      charts[key].data = chartData;
      if (opts.plugins && opts.plugins.centerLabel) {
        charts[key].options.plugins.centerLabel = opts.plugins.centerLabel;
      }
      charts[key].update('none');
      return charts[key];
    }
    charts[key] = new Chart(canvas.getContext('2d'), {
      type: type,
      data: chartData,
      options: opts
    });
    return charts[key];
  }

  var COLORS = {
    success: '#2e7d32',
    primary: '#3d6b35',
    orange: '#e65100',
    danger: '#c62828',
    blue: '#1565c0',
    purple: '#7b1fa2',
    teal: '#00695c',
    yellow: '#f9a825',
    grey: '#455a64',
    brown: '#6d4c41',
    muted: '#e0ddd5'
  };

  // --- Tab activation ---
  document.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'season') load();
  });

  function load() {
    api.get('/api/season/status').then(function (data) {
      renderSummary(data);
      renderConnectivity(data.connectivity);
      renderEarlySeason(data.earlySeason);
      renderPlanting(data.planting);
      renderMidSeason(data.midSeason);
      renderHarvest(data.harvest);
      renderPostHarvest(data.postHarvest);
    }).catch(function () {
      util.$('season-summary').innerHTML = '<span style="color:var(--danger)">Failed to load season status</span>';
    });
  }

  // --- Helpers ---
  function stat(label, value) {
    return '<div class="season-phase-stat"><span class="season-stat-label">' +
      util.esc(label) + '</span><span class="season-stat-value">' + value + '</span></div>';
  }

  function flag(type, msg) {
    var icons = { warn: '!', ok: '&#10003;', info: '&#8505;' };
    return '<div class="season-flag season-flag-' + type + '"><span class="season-flag-icon">' +
      (icons[type] || '') + '</span>' + util.esc(msg) + '</div>';
  }

  function divider() { return '<hr class="season-divider">'; }

  function si(label, value, cls) {
    return '<div class="summary-item"><span class="summary-label">' + label +
      '</span><span class="summary-value' + (cls ? ' ' + cls : '') + '">' + value + '</span></div>';
  }

  function na() { return '<span style="color:var(--text-light)">--</span>'; }

  function pctColor(pct) {
    return pct >= 80 ? COLORS.success : pct >= 40 ? COLORS.orange : COLORS.danger;
  }

  function doughnutOpts(centerText) {
    return {
      responsive: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        centerLabel: { text: centerText }
      }
    };
  }

  // --- Summary bar (big numbers) ---
  function renderSummary(data) {
    var el = util.$('season-summary');
    el.className = 'summary-bar summary-bar--season';
    var html = si('Crop Year', data.cropYear, 'blue');
    html += si('Registry Fields', data.registryFieldCount !== null ? data.registryFieldCount : '--');
    if (data.earlySeason.budgetFieldCount !== null) {
      html += si('Budget Fields', util.commaInt(data.earlySeason.budgetFieldCount));
    }
    html += si('FSA Records', util.commaInt(data.midSeason.cluTotal));
    if (data.harvest.grainFarmCount !== null) {
      html += si('Grain Farms', util.commaInt(data.harvest.grainFarmCount));
    }
    html += si('Insurance', data.midSeason.insurancePolicyCount + ' policies');
    el.innerHTML = html;
  }

  // --- Connectivity badges (status only, no navigation links) ---
  function renderConnectivity(conn) {
    var apps = [
      { key: 'farmBudget', label: 'Farm Budget' },
      { key: 'seedInventory', label: 'Seed Inventory' },
      { key: 'fsaAcres', label: 'FSA Acres' },
      { key: 'farmRegistry', label: 'Farm Registry' },
      { key: 'grainTickets', label: 'Grain Tickets' }
    ];
    var html = '';
    apps.forEach(function (a) {
      var up = conn[a.key];
      var cls = up ? 'season-conn-up' : 'season-conn-down';
      var dot = up ? '&#9679;' : '&#9675;';
      html += '<span class="season-conn ' + cls + '">' + dot + ' ' + util.esc(a.label) + '</span>';
    });
    util.$('season-connectivity').innerHTML = html;
  }

  // --- Phase 1: Early Season ---
  function renderEarlySeason(es) {
    var statsEl = document.querySelector('#season-early-body .season-panel-stats');
    var chartEl = document.querySelector('#season-early-body .season-panel-chart');
    var html = '';

    if (es.budgetFieldCount !== null) {
      html += stat('Crop Plan', es.budgetFieldCount + ' fields planned');
      html += stat('Total Plan Acres', es.budgetTotalAcres !== null ? util.comma(es.budgetTotalAcres) + ' ac' : na());
    } else {
      html += stat('Crop Plan', na());
    }
    html += divider();
    if (es.seedProductCount !== null) {
      html += stat('Seed Products', util.commaInt(es.seedProductCount));
      html += stat('Orders Placed', util.commaInt(es.seedOrderCount));
      html += stat('Delivery', es.seedDeliveryPct + '%');
    } else {
      html += stat('Seed Inventory', na());
    }
    if (es.forecastCount !== null && es.forecastCount !== undefined) {
      html += stat('Forecasts', util.commaInt(es.forecastCount));
    }
    es.flags.forEach(function (f) { html += flag(f.type, f.msg); });
    statsEl.innerHTML = html;

    // Doughnut: seed delivery progress
    if (es.seedDeliveryPct !== undefined && es.seedDeliveryPct !== null) {
      chartEl.style.display = '';
      var pct = es.seedDeliveryPct;
      upsertChart('earlyDelivery', 'chart-early-delivery', 'doughnut', {
        labels: ['Delivered', 'Remaining'],
        datasets: [{ data: [pct, 100 - pct], backgroundColor: [pctColor(pct), COLORS.muted], borderWidth: 0 }]
      }, doughnutOpts(pct + '%'));
    } else {
      chartEl.style.display = 'none';
    }
  }

  // --- Phase 2: Planting ---
  function renderPlanting(pl) {
    var statsEl = document.querySelector('#season-planting-body .season-panel-stats');
    var chartEl = document.querySelector('#season-planting-body .season-panel-chart');
    var html = '';

    if (pl.totalBudgetFields !== null) {
      html += stat('Fields with Crop', pl.fieldsWithCrop + ' / ' + pl.totalBudgetFields);
      html += stat('Plan Acres', pl.totalBudgetAcres !== null ? util.comma(pl.totalBudgetAcres) + ' ac' : na());
    }
    html += divider();
    html += stat('CLU Plant Dates', pl.cluWithPlantDate + ' / ' + pl.cluTotal + ' recorded');
    pl.flags.forEach(function (f) { html += flag(f.type, f.msg); });
    statsEl.innerHTML = html;

    // Doughnut: plant date coverage
    var pct = pl.cluTotal > 0 ? Math.round((pl.cluWithPlantDate / pl.cluTotal) * 100) : 0;
    chartEl.style.display = '';
    upsertChart('plantingCoverage', 'chart-planting-coverage', 'doughnut', {
      labels: ['Recorded', 'Pending'],
      datasets: [{ data: [pl.cluWithPlantDate, pl.cluTotal - pl.cluWithPlantDate], backgroundColor: [COLORS.primary, COLORS.muted], borderWidth: 0 }]
    }, doughnutOpts(pct + '%'));
  }

  // --- Phase 3: Mid-Season ---
  function renderMidSeason(ms) {
    var statsEl = document.querySelector('#season-midseason-body .season-panel-stats');
    var chartEl = document.querySelector('#season-midseason-body .season-panel-chart');
    var html = '';

    html += stat('FSA Reported', ms.cluReported + ' / ' + ms.cluTotal + ' CLU');
    html += stat('Progress', ms.reportingPct + '%');
    html += divider();
    html += stat('Insurance Policies', ms.insurancePolicyCount);
    html += stat('Crops Insured', ms.cropsInsured);
    html += stat('Missing Actual Yield', ms.policiesMissingActual);
    ms.flags.forEach(function (f) { html += flag(f.type, f.msg); });
    statsEl.innerHTML = html;

    // Doughnut: FSA reporting progress
    chartEl.style.display = '';
    upsertChart('midReporting', 'chart-midseason-reporting', 'doughnut', {
      labels: ['Reported', 'Unreported'],
      datasets: [{ data: [ms.cluReported, ms.cluTotal - ms.cluReported], backgroundColor: [pctColor(ms.reportingPct), COLORS.muted], borderWidth: 0 }]
    }, doughnutOpts(ms.reportingPct + '%'));
  }

  // --- Phase 4: Harvest ---
  function renderHarvest(hv) {
    var statsEl = document.querySelector('#season-harvest-body .season-panel-stats');
    var chartEl = document.querySelector('#season-harvest-body .season-panel-chart');
    var html = '';

    if (hv.grainFarmCount !== null) {
      html += stat('Grain Tickets', util.commaInt(hv.grainTicketCount));
      html += stat('Farm Entries', util.commaInt(hv.grainFarmCount));
      if (hv.avgMoisture) html += stat('Avg Moisture', hv.avgMoisture + '%');
      html += divider();
      html += stat('Insurance Yield Synced', hv.insuranceSynced);
      html += stat('Insurance Yield Pending', hv.insurancePending);
      if (hv.cropDetails && hv.cropDetails.length > 0) {
        html += divider();
        hv.cropDetails.slice(0, 5).forEach(function (c) {
          html += stat(c.crop, util.commaInt(Math.round(c.totalBU)) + ' BU <span style="color:var(--text-light);font-size:0.75rem">(' + c.ticketCount + ' tickets, ' + c.farmCount + ' farms)</span>');
        });
      }
    } else {
      html += stat('Grain Tickets', na());
    }
    hv.flags.forEach(function (f) { html += flag(f.type, f.msg); });
    statsEl.innerHTML = html;

    // Horizontal bar: top crops by BU
    if (hv.cropSummary && hv.cropSummary.length > 0) {
      chartEl.style.display = '';
      var palette = [COLORS.primary, COLORS.success, COLORS.blue, COLORS.orange, COLORS.purple, COLORS.teal, COLORS.yellow, COLORS.danger, COLORS.grey, COLORS.brown];
      upsertChart('harvestCrops', 'chart-harvest-crops', 'bar', {
        labels: hv.cropSummary.map(function (c) { return c.crop; }),
        datasets: [{
          data: hv.cropSummary.map(function (c) { return c.totalBU; }),
          backgroundColor: hv.cropSummary.map(function (_, i) { return palette[i % palette.length]; }),
          borderWidth: 0,
          borderRadius: 3
        }]
      }, {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          centerLabel: false,
          tooltip: {
            callbacks: {
              label: function (ctx) { return util.commaInt(ctx.raw) + ' BU'; }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              callback: function (v) { return v >= 1000 ? Math.round(v / 1000) + 'k' : v; },
              color: '#666',
              font: { size: 11 }
            },
            grid: { color: '#f0f0ea' }
          },
          y: {
            ticks: { color: '#333', font: { size: 11 } },
            grid: { display: false }
          }
        }
      });
    } else {
      chartEl.style.display = 'none';
    }
  }

  // --- Phase 5: Post-Harvest ---
  function renderPostHarvest(ph) {
    var body = util.$('season-postharvest-body');
    var total = ph.claimsPotential + ph.claimsFiled + ph.claimsPaid + ph.claimsDenied;

    var cards = [
      { label: 'Potential', value: ph.claimsPotential, color: COLORS.orange },
      { label: 'Filed', value: ph.claimsFiled, color: COLORS.blue },
      { label: 'Paid', value: ph.claimsPaid, color: COLORS.success },
      { label: 'Denied', value: ph.claimsDenied, color: COLORS.danger }
    ];

    var html = '<div class="season-panel-body">';
    html += '<div class="postharvest-cards">';
    cards.forEach(function (c) {
      html += '<div class="postharvest-card" style="border-left-color:' + c.color + '">' +
        '<div class="ph-label">' + c.label + '</div>' +
        '<div class="ph-value">' + c.value + '</div></div>';
    });
    html += '</div>';

    if (total > 0) {
      html += '<div class="season-panel-chart"><canvas id="chart-postharvest-claims" width="140" height="140"></canvas></div>';
    }
    html += '</div>';

    ph.flags.forEach(function (f) { html += flag(f.type, f.msg); });
    body.innerHTML = html;

    // Conditional doughnut (only if claims exist)
    if (charts['postharvestClaims']) {
      charts['postharvestClaims'].destroy();
      delete charts['postharvestClaims'];
    }
    if (total > 0) {
      upsertChart('postharvestClaims', 'chart-postharvest-claims', 'doughnut', {
        labels: ['Potential', 'Filed', 'Paid', 'Denied'],
        datasets: [{
          data: [ph.claimsPotential, ph.claimsFiled, ph.claimsPaid, ph.claimsDenied],
          backgroundColor: [COLORS.orange, COLORS.blue, COLORS.success, COLORS.danger],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      }, {
        responsive: false,
        cutout: '50%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
          centerLabel: false
        }
      });
    }
  }

  // --- Crop Plan Viewer (read-only operational view) ---
  var cropPlanFields = [];
  var cropPlanOpen = false;

  util.$('btn-crop-plan').addEventListener('click', function () {
    var editor = util.$('crop-plan-editor');
    cropPlanOpen = !cropPlanOpen;
    if (cropPlanOpen) {
      editor.classList.remove('hidden');
      this.textContent = 'Close Crop Plan';
      loadCropPlan();
    } else {
      editor.classList.add('hidden');
      this.textContent = 'View Crop Plan';
    }
  });

  function loadCropPlan() {
    var editor = util.$('crop-plan-editor');
    editor.innerHTML = '<span style="color:var(--text-light)">Loading crop plan...</span>';

    api.get('/api/budget/fields').then(function (fields) {
      cropPlanFields = fields;
      renderCropPlan();
    }).catch(function () {
      editor.innerHTML = '<div class="season-flag season-flag-warn"><span class="season-flag-icon">!</span>Farm budget app not running</div>';
    });
  }

  function renderCropPlan() {
    var editor = util.$('crop-plan-editor');

    var sorted = cropPlanFields.slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    var totalAcres = 0;
    sorted.forEach(function (f) { totalAcres += (f.acres || 0); });

    var html = '<div class="crop-plan-wrap"><table class="crop-plan-table"><thead><tr>';
    html += '<th>Field</th><th>Crop</th><th class="number">Acres</th><th class="number">Yield/Ac</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(function (f) {
      html += '<tr>';
      html += '<td class="field-name">' + util.esc(f.name || '') + '</td>';
      html += '<td>' + util.esc(f.crop || '') + '</td>';
      html += '<td class="number">' + util.fmtNum(f.acres, 1) + '</td>';
      html += '<td class="number">' + util.fmtNum(f.yieldPerAcre, 1) + '</td>';
      html += '</tr>';
    });

    html += '<tr class="cp-totals"><td><strong>TOTALS (' + sorted.length + ' fields)</strong></td>';
    html += '<td></td>';
    html += '<td class="number"><strong>' + util.fmtNum(totalAcres, 1) + '</strong></td>';
    html += '<td></td></tr>';

    html += '</tbody></table></div>';
    html += '<div class="cp-actions"></div>';

    editor.innerHTML = html;
  }

  // --- Field Name Crosswalk (loaded on demand) ---
  var crosswalkLoaded = false;
  util.$('season-crosswalk-toggle').addEventListener('click', function () {
    var body = util.$('season-crosswalk-body');
    if (body.classList.contains('hidden')) {
      body.classList.remove('hidden');
      if (!crosswalkLoaded) {
        body.innerHTML = '<span style="color:var(--text-light)">Loading field crosswalk...</span>';
        api.get('/api/season/field-crosswalk').then(function (data) {
          crosswalkLoaded = true;
          renderCrosswalk(data);
        }).catch(function () {
          body.innerHTML = '<span style="color:var(--danger)">Could not load crosswalk</span>';
        });
      }
    } else {
      body.classList.add('hidden');
    }
  });

  function renderCrosswalk(data) {
    var cw = data.crosswalk || [];
    var um = data.unmatched || {};
    var sm = data.summary || {};

    var summaryLine = '<div style="font-size:0.82rem;margin-bottom:0.75rem;color:var(--text-light)">' +
      '<strong>' + (sm.registryFields || 0) + '</strong> registry fields' +
      (sm.unmatchedBudget ? ' &middot; <strong>' + sm.unmatchedBudget + '</strong> unmatched budget fields' : '') +
      (sm.unmatchedGrainTicket ? ' &middot; <strong>' + sm.unmatchedGrainTicket + '</strong> unmatched grain ticket farms' : '') +
      '</div>';

    var html = summaryLine;
    html += '<table class="season-crosswalk-table"><thead><tr>' +
      '<th>Field</th><th class="number">Registry Ac</th>' +
      '<th>Budget</th><th>FSA CLU</th><th>Grain Tickets</th><th>Issues</th>' +
      '</tr></thead><tbody>';

    cw.forEach(function (row) {
      html += '<tr>';
      html += '<td style="font-weight:600">' + util.esc(row.canonical) + '</td>';
      html += '<td class="number">' + (row.registryAcres ? util.comma(row.registryAcres) : '--') + '</td>';

      if (row.budget) {
        html += '<td>' + util.esc(row.budget.name) + ' <span style="color:var(--text-light);font-size:0.75rem">' + util.esc(row.budget.crop || '') + '</span></td>';
      } else {
        html += '<td style="color:var(--text-light)">--</td>';
      }

      if (row.fsa) {
        html += '<td>' + util.esc(row.fsa.name) + ' <span style="color:var(--text-light);font-size:0.75rem">' + row.fsa.records + ' rec, ' + util.comma(row.fsa.acres) + ' ac</span></td>';
      } else {
        html += '<td style="color:var(--text-light)">--</td>';
      }

      if (row.grainTicket) {
        html += '<td>' + util.esc(row.grainTicket.name) + ' <span style="color:var(--text-light);font-size:0.75rem">' + util.esc(row.grainTicket.crop || '') + '</span></td>';
      } else {
        html += '<td style="color:var(--text-light)">--</td>';
      }

      if (row.issues && row.issues.length > 0) {
        html += '<td class="issue-cell">' + row.issues.join('; ') + '</td>';
      } else {
        html += '<td style="color:var(--success)">&#10003;</td>';
      }
      html += '</tr>';
    });

    html += '</tbody></table>';

    if ((um.budget && um.budget.length > 0) || (um.grainTicket && um.grainTicket.length > 0)) {
      html += '<div style="margin-top:1rem;font-size:0.82rem;color:var(--text-light)">';
      if (um.budget && um.budget.length > 0) {
        html += '<div style="margin-bottom:0.5rem"><strong>Unmatched Budget Fields:</strong> ';
        html += um.budget.map(function (f) { return util.esc(f.name || f.farm || ''); }).join(', ');
        html += '</div>';
      }
      if (um.grainTicket && um.grainTicket.length > 0) {
        html += '<div><strong>Unmatched Grain Ticket Farms:</strong> ';
        html += um.grainTicket.map(function (f) { return util.esc(f.farm || ''); }).join(', ');
        html += '</div>';
      }
      html += '</div>';
    }

    util.$('season-crosswalk-body').innerHTML = html;
  }

})();
