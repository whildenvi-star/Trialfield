/* insurance.js — Performance tracker with slide-in editor, claim alerts, enriched table */
(function () {
  'use strict';

  var policies = [];
  var sortCol = 'farmName';
  var sortDir = 'asc';

  document.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'insurance') load();
  });

  function load() {
    api.get('/api/insurance').then(function (data) {
      policies = data;
      applyFilters();
      populateAddFromFarm();
    });
  }

  function applyFilters() {
    var search = util.$('ins-search').value.toLowerCase();
    var statusFilter = util.$('ins-status-filter').value;

    var filtered = policies.filter(function (p) {
      var status = (p._computed && p._computed.claimStatus) || p.claimStatus || 'none';
      if (statusFilter && status !== statusFilter) return false;
      if (search) {
        var hay = ((p.farmName || '') + ' ' + (p.farmNumber || '') + ' ' + (p.crop || '') + ' ' + (p.lineNumber || '') + ' ' + (p.policyNumber || '')).toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });

    // Sort
    filtered.sort(function (a, b) {
      var va = a[sortCol] || '';
      var vb = b[sortCol] || '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    renderAlert(policies);
    renderSummary(policies);
    renderTable(filtered);
    renderPerfSummary(policies);
  }

  // ===== Alert banner =====
  function renderAlert(data) {
    var potential = data.filter(function (p) {
      return p._computed && p._computed.claimStatus === 'potential';
    });
    var el = util.$('ins-alert');
    if (potential.length > 0) {
      el.innerHTML = '<span class="alert-banner-icon">&#9888;</span>' +
        '<span class="alert-banner-text">' + potential.length + ' potential claim' + (potential.length > 1 ? 's' : '') +
        ' detected — actual yield below guarantee</span>' +
        '<span class="alert-banner-link" id="ins-show-potential">Show</span>';
      el.classList.remove('hidden');
      setTimeout(function () {
        var link = util.$('ins-show-potential');
        if (link) link.addEventListener('click', function () {
          util.$('ins-status-filter').value = 'potential';
          applyFilters();
        });
      }, 0);
    } else {
      el.classList.add('hidden');
    }
  }

  // ===== Summary bar =====
  function renderSummary(data) {
    var totalGuarantee = 0, totalIndemnity = 0, totalPremium = 0, potentialCount = 0, filedCount = 0, paidCount = 0;
    data.forEach(function (p) {
      var c = p._computed || {};
      totalGuarantee += c.dollarGuarantee || 0;
      totalIndemnity += c.indemnity || 0;
      totalPremium += c.totalPremium || 0;
      var status = c.claimStatus || p.claimStatus || 'none';
      if (status === 'potential') potentialCount++;
      if (status === 'filed') filedCount++;
      if (status === 'paid') paidCount++;
    });
    util.$('ins-summary').innerHTML =
      si('Policies', data.length) +
      si('Total $ Guaranteed', util.dollar(totalGuarantee)) +
      si('Total Premium', util.dollar(totalPremium)) +
      si('Total Indemnity', util.dollar(totalIndemnity), totalIndemnity > 0 ? 'orange' : '') +
      si('Potential Claims', potentialCount, potentialCount > 0 ? 'orange' : '') +
      si('Filed', filedCount, 'blue') +
      si('Paid', paidCount, 'green');
  }

  function si(label, value, cls) {
    return '<div class="summary-item"><span class="summary-label">' + label +
      '</span><span class="summary-value' + (cls ? ' ' + cls : '') + '">' + value + '</span></div>';
  }

  // ===== Table =====
  function renderTable(data) {
    var html = '';
    data.forEach(function (p) {
      var c = p._computed || {};
      var status = c.claimStatus || p.claimStatus || 'none';
      var rowClass = status === 'potential' ? 'row-claim-potential' :
                     status === 'filed' ? 'row-claim-filed' :
                     status === 'paid' ? 'row-claim-paid' :
                     status === 'denied' ? 'row-claim-denied' : '';

      var statusBadge = '<span class="badge claim-' + status + ' ins-status-toggle" data-id="' + p.id + '" data-status="' + status + '">' +
        statusLabel(status) + '</span>';

      var shortfall = c.shortfall || 0;
      var shortfallClass = shortfall > 0 ? ' profit-neg bold' : '';

      html += '<tr class="ins-row ' + rowClass + '" data-id="' + p.id + '">' +
        '<td>' + util.esc(p.farmName || p.farmNumber) + '</td>' +
        '<td>' + util.esc(p.lineNumber) + '</td>' +
        '<td>' + util.esc(p.crop) + '</td>' +
        '<td class="number">' + (p.coverageLevel || 75) + '%</td>' +
        '<td>' + util.esc(p.unitType || '') + '</td>' +
        '<td class="number">' + util.comma(p.plantedAcres) + '</td>' +
        '<td class="number">' + util.comma(c.fsaAcres) + '</td>' +
        '<td class="number">' + util.comma(p.guarantee) + '</td>' +
        '<td class="number">' + util.comma(c.effectiveGuarantee) + '</td>' +
        '<td class="number">' + util.comma(p.actual) + '</td>' +
        '<td class="number' + shortfallClass + '">' + util.comma(shortfall) + '</td>' +
        '<td class="number">' + util.dollar(c.dollarGuarantee) + '</td>' +
        '<td class="number">' + util.comma(c.springPrice) + '</td>' +
        '<td class="number">' + util.comma(c.fallPrice) + '</td>' +
        '<td class="number bold">' + util.comma(c.highestPrice) + '</td>' +
        '<td class="number' + (c.indemnity > 0 ? ' profit-neg bold' : '') + '">' + util.dollar(c.indemnity) + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="max-width:150px;overflow:hidden;text-overflow:ellipsis">' + util.esc(p.notes) + '</td>' +
        '<td><button class="btn-danger ins-del" data-id="' + p.id + '">Del</button></td>' +
        '</tr>';
    });
    util.$('ins-tbody').innerHTML = html;
    bindTableEvents();
  }

  function statusLabel(s) {
    if (s === 'potential') return 'Potential';
    if (s === 'filed') return 'Filed';
    if (s === 'paid') return 'Paid';
    if (s === 'denied') return 'Denied';
    return 'No Claim';
  }

  function nextStatus(s) {
    if (s === 'none') return 'potential';
    if (s === 'potential') return 'filed';
    if (s === 'filed') return 'paid';
    if (s === 'denied') return 'none';
    return 'none';
  }

  function bindTableEvents() {
    // Status toggle
    util.$('ins-tbody').querySelectorAll('.ins-status-toggle').forEach(function (badge) {
      badge.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-id');
        var current = this.getAttribute('data-status');
        var next = nextStatus(current);
        api.put('/api/insurance/' + id, { claimStatus: next }).then(function () {
          showToast('Status: ' + statusLabel(next));
          load();
        });
      });
    });

    // Row click → open editor
    util.$('ins-tbody').querySelectorAll('.ins-row').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('.ins-status-toggle') || e.target.closest('.ins-del')) return;
        var id = tr.getAttribute('data-id');
        var pol = policies.find(function (p) { return p.id === id; });
        if (pol) openInsEditor(pol);
      });
    });

    // Delete
    util.$('ins-tbody').querySelectorAll('.ins-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Delete this policy?')) return;
        api.del('/api/insurance/' + this.getAttribute('data-id')).then(function () {
          showToast('Deleted');
          load();
        });
      });
    });
  }

  // ===== Insurance Editor =====
  var insOverlay = util.$('ins-editor-overlay');
  var insEditId = null;
  var insEditIsNew = false;

  function openInsEditor(pol) {
    insEditId = pol.id || null;
    insEditIsNew = !pol.id;

    // Populate farm dropdown
    var farmSel = util.$('ied-farmNumber');
    farmSel.innerHTML = '<option value="">--</option>';
    refData.farms.forEach(function (f) {
      farmSel.innerHTML += '<option value="' + f.farmNumber + '">' + f.farmNumber + '</option>';
    });

    // Populate crop dropdown
    var cropSel = util.$('ied-crop');
    cropSel.innerHTML = '<option value="">--</option>';
    refData.cropNames.forEach(function (c) {
      cropSel.innerHTML += '<option value="' + util.esc(c) + '">' + util.esc(c) + '</option>';
    });

    // Set field values
    var fields = {
      farmNumber: pol.farmNumber || '',
      farmName: pol.farmName || '',
      policyNumber: pol.policyNumber || '',
      lineNumber: pol.lineNumber || '',
      crop: pol.crop || '',
      policyYear: pol.policyYear || 2026,
      unitType: pol.unitType || '',
      agentName: pol.agentName || '',
      coverageLevel: pol.coverageLevel || 75,
      plantedAcres: pol.plantedAcres || '',
      fsaAcresManual: pol.fsaAcresManual || '',
      guarantee: pol.guarantee || '',
      premiumPerAcre: pol.premiumPerAcre || '',
      actual: pol.actual || '',
      claimStatus: pol.claimStatus || 'none',
      claimFiledDate: pol.claimFiledDate || '',
      claimPaidDate: pol.claimPaidDate || '',
      claimPaidAmount: pol.claimPaidAmount || '',
      claimNumber: pol.claimNumber || '',
      adjusterName: pol.adjusterName || '',
      adjusterPhone: pol.adjusterPhone || '',
      lossType: pol.lossType || '',
      preventedPlanting: pol.preventedPlanting ? 'true' : 'false',
      preventedPlantingAcres: pol.preventedPlantingAcres || '',
      notes: pol.notes || ''
    };

    Object.keys(fields).forEach(function (f) {
      var el = util.$('ied-' + f);
      if (el) {
        if (el.tagName === 'SELECT') el.value = String(fields[f]);
        else if (el.tagName === 'TEXTAREA') el.value = fields[f];
        else el.value = fields[f];
      }
    });

    // Computed fields
    var c = pol._computed || {};
    util.$('ied-totalPremium').value = util.dollar((pol.premiumPerAcre || 0) * (pol.plantedAcres || 0));
    util.$('ied-effectiveGuarantee').value = c.effectiveGuarantee || 0;
    util.$('ied-shortfall').value = c.shortfall || 0;
    util.$('ied-indemnity').value = c.indemnity ? util.dollar(c.indemnity) : '$0.00';
    util.$('ied-fsaAcresComputed').value = c.fsaAcres || 0;

    renderStatusStepper(pol.claimStatus || 'none');
    lookupCluAph();
    lookupGrainYield();

    util.$('ins-editor-title').textContent = insEditIsNew ? 'New Policy' : 'Edit Policy';
    insOverlay.classList.add('visible');
  }

  // Auto-calc total premium on change
  ['ied-premiumPerAcre', 'ied-plantedAcres'].forEach(function (id) {
    util.$(id).addEventListener('input', function () {
      var premium = Number(util.$('ied-premiumPerAcre').value) || 0;
      var acres = Number(util.$('ied-plantedAcres').value) || 0;
      util.$('ied-totalPremium').value = util.dollar(premium * acres);
    });
  });

  function closeInsEditor() {
    insOverlay.classList.remove('visible');
    insEditId = null;
  }

  // --- Status stepper ---
  function renderStatusStepper(current) {
    var steps = [
      { key: 'none', label: 'No Claim' },
      { key: 'potential', label: 'Potential' },
      { key: 'filed', label: 'Filed' },
      { key: 'paid', label: 'Paid' }
    ];
    var reached = false;
    var html = '';
    steps.forEach(function (step) {
      var isActive = step.key === current;
      var isPast = !reached && !isActive;
      if (isActive) reached = true;
      if (current === 'none') { isPast = false; isActive = step.key === 'none'; }
      if (current === 'denied') { isPast = false; isActive = false; }
      var cls = isActive ? 'step-active' : (isPast ? 'step-past' : 'step-future');
      html += '<div class="status-step ' + cls + '">' + step.label + '</div>';
    });
    if (current === 'denied') {
      html += '<div class="status-step step-denied">Denied</div>';
    }
    util.$('ied-status-stepper').innerHTML = html;
  }

  util.$('ied-claimStatus').addEventListener('change', function () {
    renderStatusStepper(this.value);
  });

  // --- APH lookup from CLU data ---
  function lookupCluAph() {
    var crop = util.$('ied-crop').value;
    var farmNumber = util.$('ied-farmNumber').value;
    var helper = util.$('ied-aph-helper');
    if (!crop) { helper.textContent = ''; return; }

    var url = '/api/clu-aph?crop=' + encodeURIComponent(crop);
    if (farmNumber) url += '&farmNumber=' + encodeURIComponent(farmNumber);

    api.get(url).then(function (d) {
      if (d.avgAph > 0) {
        helper.textContent = 'CLU APH avg: ' + d.avgAph + ' bu/ac (' + d.count + ' of ' + d.totalRecords + ' CLUs have APH)';
        helper.style.color = 'var(--success, #16a34a)';
        var gEl = util.$('ied-guarantee');
        if (!gEl.value || Number(gEl.value) === 0) {
          gEl.value = d.avgAph;
          updateEffectiveGuarantee();
        }
      } else {
        helper.textContent = d.totalRecords > 0
          ? d.totalRecords + ' CLU records found — no APH values set'
          : 'No matching CLU records';
        helper.style.color = 'var(--text-light)';
      }
    }).catch(function () { helper.textContent = ''; });
  }

  util.$('ied-crop').addEventListener('change', lookupCluAph);
  util.$('ied-farmNumber').addEventListener('change', lookupCluAph);

  // --- Live effective guarantee ---
  function updateEffectiveGuarantee() {
    var g = Number(util.$('ied-guarantee').value) || 0;
    var cl = Number(util.$('ied-coverageLevel').value) || 75;
    util.$('ied-effectiveGuarantee').value = Math.round(g * (cl / 100) * 100) / 100;
  }

  ['ied-coverageLevel', 'ied-guarantee'].forEach(function (id) {
    util.$(id).addEventListener('input', updateEffectiveGuarantee);
  });

  // --- Grain ticket yield bridge (port 3000) ---
  var grainYieldCache = null;

  function normName(n) {
    return (n || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  function cropContains(gtCrop, insCrop) {
    if (!gtCrop || !insCrop) return false;
    var a = normName(gtCrop);
    var b = normName(insCrop);
    return a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  function lookupGrainYield() {
    var helper = util.$('ied-grain-helper');
    var sel = util.$('ied-grain-select');
    var farmName = util.$('ied-farmName').value;
    var crop = util.$('ied-crop').value;

    function doMatch(data) {
      var insFarm = normName(farmName);
      var insCrop = normName(crop);

      // Score each grain-ticket farm
      var scored = data.map(function (f) {
        var gtFarm = normName(f.farm);
        var nameMatch = insFarm && gtFarm && (insFarm.indexOf(gtFarm) !== -1 || gtFarm.indexOf(insFarm) !== -1);
        var cropMatch = insCrop && cropContains(f.crop, crop);
        var score = 0;
        if (nameMatch && cropMatch) score = 3;
        else if (cropMatch) score = 2;
        else if (nameMatch) score = 1;
        return { farm: f, score: score };
      });

      // Best matches first
      scored.sort(function (a, b) { return b.score - a.score; });
      var best = scored.filter(function (s) { return s.score >= 2; });

      if (best.length > 0) {
        var top = best[0].farm;
        var yield_ = Math.round(top.yieldPerAcre * 100) / 100;
        helper.innerHTML = '<span style="color:var(--success)">Grain tickets: <strong>' + yield_ +
          ' bu/ac</strong> from ' + top.ticketCount + ' tickets (' + util.esc(top.farm) + ' — ' + util.esc(top.crop) + ', ' +
          top.acres + ' ac)</span> <a href="#" id="ied-grain-use" style="margin-left:0.5rem;font-weight:600;color:var(--primary)">[Use]</a>';
        if (best.length > 1) {
          helper.innerHTML += ' <a href="#" id="ied-grain-browse" style="margin-left:0.25rem;font-size:0.78rem;color:var(--text-light)">[More]</a>';
        }
        sel.classList.add('hidden');
        bindGrainUse(yield_);
        if (best.length > 1) bindGrainBrowse(scored, sel);
      } else {
        helper.innerHTML = (insCrop || insFarm)
          ? '<span style="color:var(--text-light)">No auto-match — browse grain ticket farms below</span>'
          : '<span style="color:var(--text-light)">Set farm name or crop to match grain tickets</span>';
        populateGrainSelect(scored, sel);
        sel.classList.remove('hidden');
      }
    }

    if (grainYieldCache) {
      doMatch(grainYieldCache);
      return;
    }

    helper.textContent = 'Loading grain ticket data...';
    sel.classList.add('hidden');
    api.get('/api/grain-yield').then(function (data) {
      grainYieldCache = data;
      doMatch(data);
    }).catch(function () {
      helper.innerHTML = '<span style="color:var(--text-light)">Grain ticket service unavailable</span>';
      sel.classList.add('hidden');
    });
  }

  function bindGrainUse(yield_) {
    setTimeout(function () {
      var btn = util.$('ied-grain-use');
      if (btn) btn.addEventListener('click', function (e) {
        e.preventDefault();
        util.$('ied-actual').value = yield_;
        showToast('Actual yield set from grain tickets');
      });
    }, 0);
  }

  function bindGrainBrowse(scored, sel) {
    setTimeout(function () {
      var btn = util.$('ied-grain-browse');
      if (btn) btn.addEventListener('click', function (e) {
        e.preventDefault();
        populateGrainSelect(scored, sel);
        sel.classList.remove('hidden');
      });
    }, 0);
  }

  function populateGrainSelect(scored, sel) {
    var html = '<option value="">Browse grain ticket farms...</option>';
    var withYield = scored.filter(function (s) { return s.farm.yieldPerAcre > 0; });
    withYield.forEach(function (s) {
      var f = s.farm;
      var yield_ = Math.round(f.yieldPerAcre * 100) / 100;
      var label = f.farm + ' — ' + f.crop + ' — ' + yield_ + ' bu/ac (' + f.ticketCount + ' tickets)';
      html += '<option value="' + yield_ + '">' + util.esc(label) + '</option>';
    });
    sel.innerHTML = html;
  }

  util.$('ied-grain-select').addEventListener('change', function () {
    var val = Number(this.value);
    if (val > 0) {
      util.$('ied-actual').value = val;
      showToast('Actual yield set from grain tickets');
    }
  });

  // Fire grain lookup when farmName or crop changes
  util.$('ied-farmName').addEventListener('input', debounce(lookupGrainYield, 400));
  util.$('ied-crop').addEventListener('change', lookupGrainYield);

  // ===== Bulk Grain Ticket Sync =====
  var syncPanel = util.$('ins-grain-sync');
  var syncBody = util.$('ins-grain-sync-body');
  var syncMatches = []; // { policyId, policyLabel, gtFarm, yield, status }

  util.$('ins-sync-grain-btn').addEventListener('click', function () {
    syncPanel.classList.remove('hidden');
    syncBody.innerHTML = '<span style="color:var(--text-light)">Loading grain ticket data...</span>';
    util.$('ins-grain-apply-all').disabled = true;

    var fetchGrain = grainYieldCache
      ? Promise.resolve(grainYieldCache)
      : api.get('/api/grain-yield').then(function (d) { grainYieldCache = d; return d; });

    fetchGrain.then(function (gtFarms) {
      renderSyncPreview(gtFarms);
    }).catch(function () {
      syncBody.innerHTML = '<span style="color:var(--danger)">Grain ticket service unavailable — is port 3000 running?</span>';
    });
  });

  util.$('ins-grain-close').addEventListener('click', function () {
    syncPanel.classList.add('hidden');
  });

  function findBestGrainMatch(policy, gtFarms) {
    var pFarm = normName(policy.farmName);
    var pCrop = normName(policy.crop);
    var best = null;
    var bestScore = 0;

    gtFarms.forEach(function (f) {
      var gtFarm = normName(f.farm);
      var nameMatch = pFarm && gtFarm && (pFarm.indexOf(gtFarm) !== -1 || gtFarm.indexOf(pFarm) !== -1);
      var cropMatch = pCrop && cropContains(f.crop, policy.crop);
      var score = 0;
      if (nameMatch && cropMatch) score = 3;
      else if (cropMatch) score = 2;
      else if (nameMatch) score = 1;
      if (score > bestScore && f.yieldPerAcre > 0) {
        bestScore = score;
        best = f;
      }
    });

    return { match: best, score: bestScore };
  }

  function renderSyncPreview(gtFarms) {
    syncMatches = [];
    var matchCount = 0;

    var html = '<table class="grain-sync-table"><thead><tr>' +
      '<th></th><th>Policy</th><th>Crop</th><th>Current Actual</th>' +
      '<th>Grain Ticket Match</th><th>GT Yield</th><th>Tickets</th><th></th>' +
      '</tr></thead><tbody>';

    policies.forEach(function (p) {
      var result = findBestGrainMatch(p, gtFarms);
      var label = util.esc(p.farmName || p.lineNumber || p.id);
      var cropLabel = util.esc(p.crop || '—');
      var currentActual = p.actual || 0;
      var row = { policyId: p.id, yield: 0, status: 'none' };

      html += '<tr>';

      if (result.match && result.score >= 2) {
        var gt = result.match;
        var yield_ = Math.round(gt.yieldPerAcre * 100) / 100;
        row.yield = yield_;

        if (currentActual > 0 && Math.abs(currentActual - yield_) < 0.5) {
          row.status = 'already';
          html += '<td class="sync-icon">&#10003;</td>';
          html += '<td>' + label + '</td>';
          html += '<td>' + cropLabel + '</td>';
          html += '<td class="number">' + currentActual + '</td>';
          html += '<td style="color:var(--text-light)">' + util.esc(gt.farm) + '</td>';
          html += '<td class="number" style="color:var(--text-light)">' + yield_ + '</td>';
          html += '<td class="number" style="color:var(--text-light)">' + gt.ticketCount + '</td>';
          html += '<td><span class="badge claim-paid" style="font-size:0.7rem">Match</span></td>';
        } else {
          row.status = 'ready';
          matchCount++;
          var delta = currentActual > 0 ? ' (was ' + currentActual + ')' : '';
          html += '<td><input type="checkbox" class="sync-check row-checkbox" data-pid="' + p.id + '" checked></td>';
          html += '<td style="font-weight:600">' + label + '</td>';
          html += '<td>' + cropLabel + '</td>';
          html += '<td class="number">' + (currentActual || '—') + '</td>';
          html += '<td style="color:var(--success);font-weight:500">' + util.esc(gt.farm) + ' — ' + util.esc(gt.crop) + '</td>';
          html += '<td class="number" style="color:var(--success);font-weight:700">' + yield_ + '</td>';
          html += '<td class="number">' + gt.ticketCount + '</td>';
          html += '<td><span class="badge claim-potential" style="font-size:0.7rem">Update' + delta + '</span></td>';
        }
      } else {
        row.status = 'nomatch';
        html += '<td class="sync-icon" style="color:var(--text-light)">—</td>';
        html += '<td style="color:var(--text-light)">' + label + '</td>';
        html += '<td style="color:var(--text-light)">' + cropLabel + '</td>';
        html += '<td class="number" style="color:var(--text-light)">' + (currentActual || '—') + '</td>';
        html += '<td colspan="3" style="color:var(--text-light);font-style:italic">No matching grain ticket farm</td>';
        html += '<td></td>';
      }

      html += '</tr>';
      syncMatches.push(row);
    });

    html += '</tbody></table>';

    var summary = matchCount > 0
      ? '<div style="margin-bottom:0.5rem;font-size:0.85rem"><strong>' + matchCount + '</strong> policies ready to update from grain tickets</div>'
      : '<div style="margin-bottom:0.5rem;font-size:0.85rem;color:var(--text-light)">No new matches found — actual yields already set or no crop/name overlap</div>';

    syncBody.innerHTML = summary + html;
    util.$('ins-grain-apply-all').disabled = matchCount === 0;
  }

  util.$('ins-grain-apply-all').addEventListener('click', function () {
    var checks = syncPanel.querySelectorAll('.sync-check:checked');
    var ids = [];
    checks.forEach(function (cb) { ids.push(cb.getAttribute('data-pid')); });
    if (ids.length === 0) { showToast('No policies selected', 'info'); return; }

    var promises = [];
    ids.forEach(function (pid) {
      var row = syncMatches.find(function (r) { return r.policyId === pid; });
      if (row && row.yield > 0) {
        promises.push(api.put('/api/insurance/' + pid, { actual: row.yield }));
      }
    });

    Promise.all(promises).then(function () {
      showToast(promises.length + ' policies updated with grain ticket yields');
      syncPanel.classList.add('hidden');
      load();
    }).catch(function () {
      showToast('Some updates failed', 'error');
    });
  });

  util.$('ins-editor-close').addEventListener('click', closeInsEditor);
  util.$('ins-editor-cancel').addEventListener('click', closeInsEditor);
  insOverlay.addEventListener('click', function (e) {
    if (e.target === insOverlay) closeInsEditor();
  });

  util.$('ins-editor-save').addEventListener('click', function () {
    var numFields = ['plantedAcres', 'fsaAcresManual', 'guarantee', 'actual',
      'coverageLevel', 'premiumPerAcre', 'policyYear', 'claimPaidAmount', 'preventedPlantingAcres'];
    var strFields = ['farmNumber', 'farmName', 'policyNumber', 'lineNumber', 'crop',
      'unitType', 'agentName', 'claimStatus', 'claimFiledDate', 'claimPaidDate',
      'claimNumber', 'adjusterName', 'adjusterPhone', 'lossType'];
    var boolFields = ['preventedPlanting'];

    var data = {};
    strFields.forEach(function (f) {
      var el = util.$('ied-' + f);
      if (el) data[f] = el.value;
    });
    numFields.forEach(function (f) {
      var el = util.$('ied-' + f);
      if (el) data[f] = Number(el.value) || 0;
    });
    boolFields.forEach(function (f) {
      var el = util.$('ied-' + f);
      if (el) data[f] = el.value === 'true';
    });
    var notesEl = util.$('ied-notes');
    if (notesEl) data.notes = notesEl.value;

    var promise;
    if (insEditIsNew) {
      promise = api.post('/api/insurance', data);
    } else {
      promise = api.put('/api/insurance/' + insEditId, data);
    }

    promise.then(function () {
      showToast(insEditIsNew ? 'Policy created' : 'Policy saved');
      closeInsEditor();
      load();
    }).catch(function () {
      showToast('Save failed', 'error');
    });
  });

  // ===== Performance summary =====
  function renderPerfSummary(data) {
    var totalPlanted = 0, totalGuarantee = 0, totalActual = 0, totalIndemnity = 0, totalPremium = 0;
    var totalPPAcres = 0;
    var withData = 0;
    data.forEach(function (p) {
      var c = p._computed || {};
      if (p.plantedAcres > 0) {
        totalPlanted += p.plantedAcres;
        withData++;
      }
      if (p.guarantee > 0) totalGuarantee += p.guarantee * (p.plantedAcres || 0);
      if (p.actual > 0) totalActual += p.actual * (p.plantedAcres || 0);
      totalIndemnity += c.indemnity || 0;
      totalPremium += c.totalPremium || 0;
      if (p.preventedPlanting) totalPPAcres += p.preventedPlantingAcres || 0;
    });

    var avgGuarantee = totalPlanted > 0 ? totalGuarantee / totalPlanted : 0;
    var avgActual = totalPlanted > 0 ? totalActual / totalPlanted : 0;

    util.$('ins-perf-summary').innerHTML =
      '<h3>Performance Summary</h3>' +
      '<div class="summary-bar" style="margin:0;box-shadow:none;padding:0">' +
      si('Policies', data.length) +
      si('Total Planted Ac', util.comma(totalPlanted)) +
      si('Avg Guarantee', util.comma(avgGuarantee)) +
      si('Avg Actual', util.comma(avgActual), avgActual < avgGuarantee ? 'red' : 'green') +
      si('Total Premium', util.dollar(totalPremium)) +
      si('Total Potential Recovery', util.dollar(totalIndemnity), totalIndemnity > 0 ? 'orange' : '') +
      (totalPPAcres > 0 ? si('Prevented Planting Ac', util.comma(totalPPAcres), 'orange') : '') +
      '</div>';
  }

  // ===== Sort headers =====
  util.$('ins-table').querySelector('thead').addEventListener('click', function (e) {
    var th = e.target.closest('th[data-sort]');
    if (!th) return;
    var col = th.getAttribute('data-sort');
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'asc'; }
    util.$('ins-table').querySelectorAll('th').forEach(function (h) { h.classList.remove('sort-asc', 'sort-desc'); });
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    applyFilters();
  });

  // ===== Filter listeners =====
  util.$('ins-search').addEventListener('input', debounce(applyFilters, 300));
  util.$('ins-status-filter').addEventListener('change', applyFilters);

  // ===== Add policy =====
  util.$('ins-add-btn').addEventListener('click', function () {
    openInsEditor({
      farmName: '', farmNumber: '', lineNumber: '', crop: '', plantedAcres: 0,
      fsaAcresManual: 0, guarantee: 0, actual: 0, claimStatus: 'none', notes: '',
      policyNumber: '', coverageLevel: 0, unitType: '', premiumPerAcre: 0,
      agentName: '', policyYear: 2026, claimFiledDate: '', claimPaidDate: '', claimPaidAmount: 0
    });
    insEditIsNew = true;
  });

  // ===== Add from Farm =====
  function populateAddFromFarm() {
    var sel = util.$('ins-add-from-farm');
    sel.innerHTML = '<option value="">Add from Farm...</option>';
    refData.farms.forEach(function (f) {
      sel.innerHTML += '<option value="' + f.farmNumber + '">' + f.farmNumber + '</option>';
    });
  }

  util.$('ins-add-from-farm').addEventListener('change', function () {
    var fn = this.value;
    if (!fn) return;
    this.value = '';
    // Find crops for this farm from CLU records
    api.get('/api/clu-records?farmNumber=' + encodeURIComponent(fn)).then(function (records) {
      var cropAcres = {};
      records.forEach(function (r) {
        if (r.crop && r.crop.trim()) {
          var key = r.crop.trim();
          if (!cropAcres[key]) cropAcres[key] = 0;
          cropAcres[key] += (r.fsaAcres || 0);
        }
      });
      var crops = Object.keys(cropAcres);
      if (crops.length === 0) { showToast('No crops found for farm ' + fn, 'info'); return; }

      // Create a policy for each crop on this farm
      var promises = crops.map(function (crop) {
        return api.post('/api/insurance', {
          farmNumber: fn, farmName: '', crop: crop,
          plantedAcres: Math.round(cropAcres[crop] * 100) / 100,
          guarantee: 0, actual: 0, claimStatus: 'none', notes: '',
          policyNumber: '', lineNumber: '', coverageLevel: 0, unitType: '',
          premiumPerAcre: 0, agentName: '', policyYear: 2026
        });
      });
      Promise.all(promises).then(function () {
        showToast(crops.length + ' policies created for farm ' + fn);
        load();
      });
    });
  });

  function debounce(fn, ms) {
    var timer;
    return function () { clearTimeout(timer); timer = setTimeout(fn, ms); };
  }

})();
