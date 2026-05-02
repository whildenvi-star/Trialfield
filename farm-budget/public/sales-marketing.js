// Sales & Marketing — Crop Type Pools + Instrument Tracking
(function () {
  'use strict';

  var cropTypes    = [];
  var instruments  = [];
  var cbotMap      = {};
  var pools        = [];
  var flatEntries  = [];
  var loaded       = false;
  var activeCropYear = new Date().getFullYear();
  var currentSettingsYear = activeCropYear; // the "official" season year from settings

  // ── Sub-tab switching ─────────────────────────────────────────────────────
  document.querySelectorAll('.mkt-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mkt-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.mtab-content').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var panel = document.getElementById('mtab-' + btn.getAttribute('data-mtab'));
      if (panel) panel.classList.add('active');
      if (btn.getAttribute('data-mtab') === 'croptypes') renderCropTypes();
    });
  });

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'sales' && !loaded) loadAll();
  });

  // ── Year selector ─────────────────────────────────────────────────────────
  function initYearSelector() {
    var lbl  = document.getElementById('mkt-year-label');
    var prev = document.getElementById('mkt-year-prev');
    var next = document.getElementById('mkt-year-next');
    if (!lbl) return;
    updateYearLabel();
    if (prev) prev.addEventListener('click', function () { setYear(activeCropYear - 1); });
    if (next) next.addEventListener('click', function () { setYear(activeCropYear + 1); });
  }

  function updateYearLabel() {
    var lbl = document.getElementById('mkt-year-label');
    if (!lbl) return;
    var isFwd = activeCropYear !== currentSettingsYear;
    lbl.innerHTML = (isFwd
      ? '<span style="color:var(--warning,#f59e0b)">' + activeCropYear + ' ⚑</span>'
      : '<span>' + activeCropYear + '</span>');
    lbl.title = isFwd ? 'Forward year — tracking against ' + activeCropYear + ' production' : 'Current season';
  }

  function setYear(y) {
    activeCropYear = y;
    updateYearLabel();
    api.get('/api/marketing/instruments?cropYear=' + y).then(function (data) {
      instruments = data || [];
      buildPools({});
      // Rebuild with last known dashBu — simplified: just reload everything
      reload();
    }).catch(function () {
      instruments = [];
      buildPools({});
      renderDashboard();
      renderInstruments();
      renderCropTypes();
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  function loadAll() {
    Promise.all([
      api.get('/api/crop-types'),
      api.get('/api/dashboard'),
      api.get('/api/marketing/instruments?cropYear=' + activeCropYear),
      api.get('/api/cbot-fetch').catch(function () { return { prices: [] }; })
    ]).then(function (res) {
      cropTypes  = res[0] || [];
      var dash   = res[1] || {};
      instruments = res[2] || [];

      // Sync activeCropYear to settings year on first load
      if (dash.year) {
        activeCropYear = dash.year;
        currentSettingsYear = dash.year;
      }
      initYearSelector();

      var dashBu = {};
      (dash.enterpriseSummaries || []).forEach(function (es) {
        (es.cropRows || []).forEach(function (cr) {
          if (!cr.crop || !(cr.projectedTotal > 0)) return;
          var k = cr.crop.toLowerCase().trim();
          dashBu[k] = (dashBu[k] || 0) + cr.projectedTotal;
        });
      });

      cbotMap = {};
      ((res[3] || {}).prices || []).forEach(function (p) {
        if (p.symbol) cbotMap[p.symbol] = Number(p.price) || 0;
      });

      buildPools(dashBu);
      loaded = true;
      renderDashboard();
      renderInstruments();
    }).catch(function (err) {
      console.error('[sales-marketing] load failed', err);
      var root = document.getElementById('mkt-dashboard-root');
      if (root) root.innerHTML = '<p style="padding:1rem;color:var(--danger)">Failed to load marketing data — check server logs.</p>';
    });
  }

  function reload() {
    Promise.all([
      api.get('/api/crop-types'),
      api.get('/api/dashboard'),
      api.get('/api/marketing/instruments?cropYear=' + activeCropYear),
      api.get('/api/cbot-fetch').catch(function () { return { prices: [] }; })
    ]).then(function (res) {
      cropTypes   = res[0] || [];
      var dash    = res[1] || {};
      instruments = res[2] || [];

      var dashBu = {};
      (dash.enterpriseSummaries || []).forEach(function (es) {
        (es.cropRows || []).forEach(function (cr) {
          if (!cr.crop || !(cr.projectedTotal > 0)) return;
          var k = cr.crop.toLowerCase().trim();
          dashBu[k] = (dashBu[k] || 0) + cr.projectedTotal;
        });
      });

      cbotMap = {};
      ((res[3] || {}).prices || []).forEach(function (p) {
        if (p.symbol) cbotMap[p.symbol] = Number(p.price) || 0;
      });

      buildPools(dashBu);
      renderDashboard();
      renderInstruments();
      // Re-render crop types tab if active
      var ct = document.getElementById('mtab-croptypes');
      if (ct && ct.classList.contains('active')) renderCropTypes();
    }).catch(function (err) {
      console.error('[sales-marketing] reload failed', err);
    });
  }

  // ── Pool computation ──────────────────────────────────────────────────────
  function buildPools(dashBu) {
    pools = [];
    flatEntries = [];

    cropTypes.forEach(function (ct) {
      if (!ct.subCrops || !ct.subCrops.length) return;

      // Check per-year pricing override
      var yp = (ct.yearPricing || {})[activeCropYear];
      var yearMode = yp ? yp.mode : null; // 'cbot_basis' | 'flat' | null

      var cbotSubs, flatSubs;
      if (yearMode === 'flat') {
        cbotSubs = [];
        flatSubs = ct.subCrops.slice();
      } else if (yearMode === 'cbot_basis') {
        cbotSubs = ct.subCrops.slice();
        flatSubs = [];
      } else {
        cbotSubs = ct.subCrops.filter(function (sc) { return sc.pricingMode === 'cbot'; });
        flatSubs = ct.subCrops.filter(function (sc) { return sc.pricingMode !== 'cbot'; });
      }

      // CBOT pool
      if (cbotSubs.length) {
        var subCropData = cbotSubs.map(function (sc) {
          return {
            name: sc.name,
            basisDefault: sc.basisDefault || 0,
            estimatedBu: dashBu[sc.name.toLowerCase().trim()] || 0
          };
        });

        var totalEst = subCropData.reduce(function (s, sc) { return s + sc.estimatedBu; }, 0);
        var poolInst = instruments.filter(function (i) { return i.crop_type_id === ct.id; });

        var sym = ct.cbotSymbol || '';
        var cbotPrice = cbotMap[sym] || cbotMap[sym.slice(0, 2)] || ct.cbotPrice || 0;

        var pricedBu = 0, wapBu = 0, wapVal = 0;
        var mix = { cash: 0, forward_contract: 0, hta: 0, option: 0, accumulator: 0 };

        poolInst.forEach(function (inst) {
          var bu = instrumentPricedBu(inst, cbotPrice);
          pricedBu += bu;
          if ((inst.instrument_type === 'cash' || inst.instrument_type === 'forward_contract') &&
              inst.price_per_bushel && bu > 0) {
            wapBu += bu;
            wapVal += bu * Number(inst.price_per_bushel);
          }
          if (inst.instrument_type === 'hta' && inst.futures_reference != null && bu > 0) {
            wapBu += bu;
            wapVal += bu * (Number(inst.futures_reference) + (Number(inst.basis) || 0));
          }
          if (inst.instrument_type in mix) mix[inst.instrument_type]++;
        });

        var unpricedBu = Math.max(0, totalEst - pricedBu);
        // Exposure: CBOT + optional year basis offset
        var basisOffset = (yearMode === 'cbot_basis' && yp && yp.basis != null) ? Number(yp.basis) : 0;
        var exposure = unpricedBu * (cbotPrice + basisOffset);

        pools.push({
          id: ct.id,
          name: ct.name,
          cbotSymbol: sym,
          cbotPrice: cbotPrice,
          subCrops: subCropData,
          totalEst: totalEst,
          instruments: poolInst,
          pricedBu: pricedBu,
          wap: wapBu > 0 ? wapVal / wapBu : null,
          pctPriced: totalEst > 0 ? Math.min(100, (pricedBu / totalEst) * 100) : 0,
          unpricedBu: unpricedBu,
          exposure: exposure,
          mix: mix
        });
      }

      // Flat / pre-contracted
      flatSubs.forEach(function (sc) {
        var bu = dashBu[sc.name.toLowerCase().trim()] || 0;
        if (bu <= 0) return;
        // Use year flat price if set, otherwise fall back to subCrop price
        var yp2 = (ct.yearPricing || {})[activeCropYear];
        var price = (yp2 && yp2.mode === 'flat' && yp2.price != null) ? Number(yp2.price) : (sc.pricePerUnit || 0);
        var unit  = (yp2 && yp2.unit) || sc.unit || ct.unit || 'Bu';
        flatEntries.push({
          cropTypeName: ct.name,
          name: sc.name,
          pricingMode: sc.pricingMode,
          pricePerUnit: price,
          estimatedBu: bu,
          unit: unit
        });
      });
    });
  }

  function instrumentPricedBu(inst, cbotPrice) {
    var t = inst.instrument_type;
    if (t === 'cash' || t === 'forward_contract' || t === 'hta') return Number(inst.bushels) || 0;
    if (t === 'option') {
      return (inst.option_type === 'put' && inst.option_side === 'long') ? (Number(inst.bushels) || 0) : 0;
    }
    if (t === 'accumulator') {
      if (inst.delivered_bu > 0) return Number(inst.delivered_bu);
      var start = inst.accumulation_start ? new Date(inst.accumulation_start) : null;
      var end   = inst.accumulation_end   ? new Date(inst.accumulation_end)   : null;
      var now   = new Date();
      if (!start) return 0;
      var eff = (end && end < now) ? end : now;
      if (eff <= start) return 0;
      var leverage = Number(inst.leverage_ratio) || 1;
      if (inst.ki_level && cbotPrice > 0 && cbotPrice < Number(inst.ki_level)) leverage = 2;
      if (inst.daily_bu)  return Math.floor((eff - start) / 86400000)  * Number(inst.daily_bu)  * leverage;
      if (inst.weekly_bu) return Math.floor((eff - start) / 604800000) * Number(inst.weekly_bu) * leverage;
    }
    return 0;
  }

  // ── Hedging Dashboard ─────────────────────────────────────────────────────
  function renderDashboard() {
    var root = document.getElementById('mkt-dashboard-root');
    if (!root) return;

    var totalEst    = pools.reduce(function (s, p) { return s + p.totalEst; }, 0);
    var totalPriced = pools.reduce(function (s, p) { return s + p.pricedBu; }, 0);
    var totalExp    = pools.reduce(function (s, p) { return s + p.exposure; }, 0);
    var farmPct     = totalEst > 0 ? (totalPriced / totalEst) * 100 : 0;

    var html =
      '<div class="mkt-summary-strip">' +
        '<div class="mkt-summary-item"><span class="mkt-summary-val">' + util.formatNum(farmPct, 1) + '%</span><span class="mkt-summary-lbl">Farm % Priced</span></div>' +
        '<div class="mkt-summary-item"><span class="mkt-summary-val">' + util.formatNum(totalPriced, 0) + ' bu</span><span class="mkt-summary-lbl">Priced Bushels</span></div>' +
        '<div class="mkt-summary-item' + (totalExp > 500000 ? ' mkt-summary-warn' : '') + '"><span class="mkt-summary-val">' + util.formatMoney(totalExp, 0) + '</span><span class="mkt-summary-lbl">Unpriced Exposure</span></div>' +
        '<div class="mkt-summary-item"><span class="mkt-summary-val">' + instruments.length + '</span><span class="mkt-summary-lbl">Instruments</span></div>' +
      '</div>';

    if (!pools.length && !flatEntries.length) {
      root.innerHTML = html + util.emptyState('', 'No crop data', 'Ensure enterprises are set up and crop types have subCrops');
      return;
    }

    html += '<div class="mkt-cards">';

    pools.forEach(function (pool) {
      if (pool.totalEst <= 0 && !pool.instruments.length) return;

      var pct      = pool.pctPriced;
      var barColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? '#ffb800' : 'var(--danger)';

      html += '<div class="mkt-card">';

      html +=
        '<div class="mkt-card-header">' +
          '<span class="mkt-card-title">' + util.escHtml(pool.name) + '</span>' +
          (pool.cbotSymbol ? '<span class="mkt-card-symbol">' + util.escHtml(pool.cbotSymbol) + '</span>' : '') +
          (pool.cbotPrice > 0 ? '<span class="mkt-card-cbot">CBOT ' + util.formatMoney(pool.cbotPrice) + '</span>' : '') +
        '</div>';

      html += '<div class="mkt-progress-track"><div class="mkt-progress-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div>';
      html += '<div class="mkt-progress-label">' + util.formatNum(pool.pricedBu, 0) + ' / ' + util.formatNum(pool.totalEst, 0) + ' bu &nbsp;·&nbsp; ' + util.formatNum(pct, 1) + '% priced</div>';

      if (pool.wap !== null) {
        var delta = pool.cbotPrice > 0 ? pool.wap - pool.cbotPrice : null;
        html += '<div class="mkt-wap-row">WAP <strong>' + util.formatMoney(pool.wap) + '</strong>';
        if (delta !== null) {
          html += ' <span class="' + (delta >= 0 ? 'text-cyan' : 'text-amber') + '">' +
            '(' + (delta >= 0 ? '+' : '') + util.formatMoney(delta) + ' vs CBOT)</span>';
        }
        html += '</div>';
      }

      var totalMix = Object.values(pool.mix).reduce(function (s, n) { return s + n; }, 0);
      if (totalMix > 0) {
        var mixColors = { cash: '#14b8a6', forward_contract: '#3b82f6', hta: '#6366f1', option: '#8b5cf6', accumulator: '#f59e0b' };
        html += '<div class="mix-strip">';
        Object.keys(pool.mix).forEach(function (t) {
          if (!pool.mix[t]) return;
          html += '<div class="mix-strip-seg" style="width:' + ((pool.mix[t] / totalMix) * 100) + '%;background:' + mixColors[t] + '" title="' + t + ': ' + pool.mix[t] + '"></div>';
        });
        html += '</div>';
      }

      if (pool.unpricedBu > 0) {
        html += '<div class="mkt-unpriced-row">' + util.formatNum(pool.unpricedBu, 0) + ' bu unpriced &nbsp;·&nbsp; ' + util.formatMoney(pool.exposure, 0) + ' exposure</div>';
      }

      var accumsWithKI = pool.instruments.filter(function (i) {
        return i.instrument_type === 'accumulator' && i.ki_level;
      });
      if (accumsWithKI.length > 0) {
        var maxDoubleUpBu = accumsWithKI.reduce(function (s, i) { return s + (Number(i.bushels) || 0) * 2; }, 0);
        var kiActive = pool.cbotPrice > 0 && accumsWithKI.some(function (i) { return pool.cbotPrice < Number(i.ki_level); });
        var kiLevels = accumsWithKI.map(function (i) { return util.formatMoney(Number(i.ki_level)); }).join(', ');
        html += '<div class="mkt-double-up-row' + (kiActive ? ' active' : '') + '">' +
          '<span class="mkt-ki-badge' + (kiActive ? ' active' : '') + '">' +
          (kiActive ? '&#9888; Double-up ACTIVE' : 'Double-up risk') +
          '</span> Max ' + util.formatNum(maxDoubleUpBu, 0) + ' bu' +
          '<span class="mkt-double-up-meta"> &middot; KI: ' + kiLevels + '</span>' +
          '</div>';
      }

      var htasWithOpenBasis = pool.instruments.filter(function (i) {
        return i.instrument_type === 'hta' && (i.basis == null || i.basis === '');
      });
      if (htasWithOpenBasis.length > 0) {
        var openBu = htasWithOpenBasis.reduce(function (s, i) { return s + (Number(i.bushels) || 0); }, 0);
        html += '<div class="mkt-basis-open-row">' +
          '<span class="mkt-basis-open-badge">&#9675; Basis Open</span> ' +
          util.formatNum(openBu, 0) + ' bu HTA — basis not yet set' +
          '</div>';
      }

      var visSubs = pool.subCrops.filter(function (sc) { return sc.estimatedBu > 0; });
      if (visSubs.length > 1 || (visSubs.length === 1 && visSubs[0].basisDefault !== 0)) {
        html += '<table class="mkt-variety-table"><thead><tr><th>Variety</th><th class="number">Est Bu</th><th class="number">Basis</th><th class="number">Effective</th></tr></thead><tbody>';
        visSubs.forEach(function (sc) {
          var eff = pool.wap !== null ? pool.wap + sc.basisDefault : null;
          var basisCls = sc.basisDefault >= 0 ? 'text-cyan' : 'text-amber';
          var basisStr = (sc.basisDefault >= 0 ? '+' : '') + util.formatMoney(sc.basisDefault);
          html +=
            '<tr>' +
              '<td>' + util.escHtml(sc.name) + '</td>' +
              '<td class="number">' + util.formatNum(sc.estimatedBu, 0) + '</td>' +
              '<td class="number ' + basisCls + '">' + basisStr + '</td>' +
              '<td class="number">' + (eff !== null ? util.formatMoney(eff) : '—') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table>';
      }

      html += '</div>'; // .mkt-card
    });

    if (flatEntries.length > 0) {
      var byType = {};
      flatEntries.forEach(function (fe) {
        (byType[fe.cropTypeName] = byType[fe.cropTypeName] || []).push(fe);
      });

      html += '<div class="mkt-card mkt-card-contracted">';
      html += '<div class="mkt-card-header"><span class="mkt-card-title">Pre-Contracted / Organic</span><span class="type-badge type-badge-forward" style="font-size:0.7rem">Pre-contracted</span></div>';
      html += '<table class="mkt-variety-table"><thead><tr><th>Crop</th><th>Type</th><th class="number">Est Bu</th><th class="number">Price</th></tr></thead><tbody>';
      Object.keys(byType).sort().forEach(function (tn) {
        byType[tn].forEach(function (fe) {
          html +=
            '<tr>' +
              '<td>' + util.escHtml(fe.name) + '</td>' +
              '<td><span class="mkt-card-symbol">' + util.escHtml(fe.pricingMode) + '</span></td>' +
              '<td class="number">' + util.formatNum(fe.estimatedBu, 0) + '</td>' +
              '<td class="number">' + util.formatMoney(fe.pricePerUnit) + '</td>' +
            '</tr>';
        });
      });
      html += '</tbody></table></div>';
    }

    html += '</div>'; // .mkt-cards
    root.innerHTML = html;
  }

  // ── Instruments ───────────────────────────────────────────────────────────
  function renderInstruments() {
    var root = document.getElementById('mkt-instruments-root');
    if (!root) return;

    var isFwd = activeCropYear !== currentSettingsYear;
    var yearNote = isFwd
      ? '<span class="mkt-year-note">Showing <strong>' + activeCropYear + '</strong> instruments — forward year</span>'
      : '';

    var html = '<div class="mkt-toolbar"><button class="btn-primary btn-sm" id="mkt-add-inst-btn">+ Add Instrument</button>' + yearNote + '</div>';

    if (!instruments.length) {
      root.innerHTML = html + util.emptyState('', 'No instruments for ' + activeCropYear, 'Add a cash sale, forward contract, option, or accumulator');
    } else {
      var grouped = {};
      instruments.forEach(function (i) {
        var k = i.crop_type_id || '__none__';
        (grouped[k] = grouped[k] || []).push(i);
      });

      var mixColors = { cash: '#14b8a6', forward_contract: '#3b82f6', hta: '#6366f1', option: '#8b5cf6', accumulator: '#f59e0b' };
      var typeLabel = { cash: 'Cash', forward_contract: 'Fwd', hta: 'HTA', option: 'Opt', accumulator: 'Accum' };

      pools.forEach(function (pool) {
        var group = grouped[pool.id] || [];
        html += '<div class="mkt-inst-group">';
        html += '<div class="mkt-inst-group-hdr">' + util.escHtml(pool.name) +
          ' <span class="mkt-inst-count">' + group.length + '</span>' +
          ' <a href="#" class="mkt-add-for-pool" data-ct-id="' + util.escHtml(pool.id) + '">+ add</a></div>';

        if (group.length) {
          html += '<table class="mkt-inst-table"><tbody>';
          group.forEach(function (inst) { html += renderInstRow(inst, mixColors, typeLabel); });
          html += '</tbody></table>';
        } else {
          html += '<div class="mkt-inst-empty">No instruments for this pool.</div>';
        }
        html += '</div>';
      });

      var unassigned = grouped['__none__'] || [];
      if (unassigned.length) {
        html += '<div class="mkt-inst-group"><div class="mkt-inst-group-hdr" style="color:var(--danger)">⚠ Unassigned (' + unassigned.length + ')</div><table class="mkt-inst-table"><tbody>';
        unassigned.forEach(function (inst) { html += renderInstRow(inst, mixColors, typeLabel); });
        html += '</tbody></table></div>';
      }
      root.innerHTML = html;
    }

    var addBtn = root.querySelector('#mkt-add-inst-btn');
    if (addBtn) addBtn.addEventListener('click', function () { openInstrumentForm(null, null); });

    root.querySelectorAll('.mkt-add-for-pool').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openInstrumentForm(null, a.getAttribute('data-ct-id'));
      });
    });

    root.querySelectorAll('.mkt-edit-inst').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inst = instruments.find(function (i) { return i.id === btn.getAttribute('data-iid'); });
        if (inst) openInstrumentForm(inst, null);
      });
    });

    root.querySelectorAll('.mkt-del-inst').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-iid');
        if (!confirm('Delete this instrument?')) return;
        api.del('/api/marketing/instruments/' + id)
          .then(function () { util.showToast('Deleted'); reload(); })
          .catch(function () { util.showToast('Delete failed', 'error'); });
      });
    });
  }

  function renderInstRow(inst, mixColors, typeLabel) {
    var color = mixColors[inst.instrument_type] || '#6b7280';
    var lbl   = typeLabel[inst.instrument_type] || inst.instrument_type;
    var detail = '';
    if (inst.instrument_type === 'cash' || inst.instrument_type === 'forward_contract') {
      detail = util.formatNum(inst.bushels, 0) + ' bu @ ' + util.formatMoney(inst.price_per_bushel);
      if (inst.delivery_start) detail += ' · ' + String(inst.delivery_start).slice(0, 7);
    } else if (inst.instrument_type === 'hta') {
      detail = util.formatNum(inst.bushels, 0) + ' bu · Fut ' + util.formatMoney(inst.futures_reference);
      if (inst.basis != null && inst.basis !== '') {
        detail += ' · Basis ' + (Number(inst.basis) >= 0 ? '+' : '') + util.formatMoney(inst.basis);
      } else {
        detail += ' · <span style="color:#f59e0b">[Basis Open]</span>';
      }
      if (inst.delivery_start) detail += ' · ' + String(inst.delivery_start).slice(0, 7);
    } else if (inst.instrument_type === 'option') {
      detail = (inst.option_side || '') + ' ' + (inst.option_type || '') + ' · strike ' + util.formatMoney(inst.strike_price);
      if (inst.expiry_date) detail += ' · exp ' + String(inst.expiry_date).slice(0, 7);
    } else if (inst.instrument_type === 'accumulator') {
      detail = 'KO ' + util.formatMoney(inst.ko_level);
      if (inst.ki_level) {
        var pool = pools.find(function (p) { return p.id === inst.crop_type_id; });
        var cbotP = pool ? pool.cbotPrice : 0;
        var kiActive = cbotP > 0 && cbotP < Number(inst.ki_level);
        detail += ' · KI ' + util.formatMoney(inst.ki_level) + (kiActive ? ' ⚠' : '');
      }
      if (inst.daily_bu) detail += ' · ' + util.formatNum(inst.daily_bu, 0) + ' bu/day';
      else if (inst.weekly_bu) detail += ' · ' + util.formatNum(inst.weekly_bu, 0) + ' bu/wk';
    }

    // Year badge for forward-year instruments
    var yearBadge = (inst.crop_year && inst.crop_year !== currentSettingsYear)
      ? '<span class="mkt-year-badge">' + inst.crop_year + '</span>'
      : '';

    return '<tr class="mkt-inst-row">' +
      '<td style="width:56px"><span class="type-badge" style="background:' + color + '20;color:' + color + ';padding:2px 6px">' + lbl + '</span></td>' +
      '<td class="mkt-inst-buyer">' + util.escHtml(inst.buyer || inst.counterparty || '—') + yearBadge + '</td>' +
      '<td class="mkt-inst-detail">' + util.escHtml(detail) + '</td>' +
      '<td class="mkt-inst-actions">' +
        '<button class="btn-link mkt-edit-inst" data-iid="' + inst.id + '">Edit</button>' +
        '<button class="btn-link mkt-del-inst" style="color:var(--danger)" data-iid="' + inst.id + '">Del</button>' +
      '</td>' +
    '</tr>';
  }

  // ── Crop Types Tab ────────────────────────────────────────────────────────
  function renderCropTypes() {
    var root = document.getElementById('mkt-croptypes-root');
    if (!root) return;

    if (!cropTypes.length) {
      root.innerHTML = util.emptyState('', 'No crop types', 'Add crop types in the Reference tab');
      return;
    }

    var html = '<div class="mkt-ct-header">Per-year pricing for <strong>' + activeCropYear + '</strong> &nbsp;—&nbsp; <span class="mkt-ct-hint">Changes here only affect the selected year</span></div>';
    html += '<table class="mkt-ct-table"><thead><tr>' +
      '<th>Crop Type</th>' +
      '<th>Pricing Mode</th>' +
      '<th>Price / Basis</th>' +
      '<th>Unit</th>' +
      '<th>Notes</th>' +
      '<th></th>' +
    '</tr></thead><tbody>';

    cropTypes.forEach(function (ct) {
      var yp    = (ct.yearPricing || {})[activeCropYear] || {};
      var mode  = yp.mode || 'cbot_basis';
      var price = yp.price != null ? yp.price : (yp.basis != null ? yp.basis : '');
      var unit  = yp.unit || 'per_bu';
      var notes = yp.notes || '';

      html += '<tr class="mkt-ct-row" data-ctid="' + util.escHtml(ct.id) + '">' +
        '<td class="mkt-ct-name">' + util.escHtml(ct.name) + '</td>' +
        '<td>' +
          '<div class="mkt-ct-mode-toggle">' +
            '<button type="button" class="mkt-ct-mode-btn' + (mode === 'cbot_basis' ? ' active' : '') + '" data-mode="cbot_basis">CBOT Basis</button>' +
            '<button type="button" class="mkt-ct-mode-btn' + (mode === 'flat' ? ' active' : '') + '" data-mode="flat">Flat</button>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<input type="number" class="mkt-ct-price form-control-sm" step="0.01" value="' + util.escHtml(String(price)) + '" ' +
            'placeholder="' + (mode === 'flat' ? '15.00' : '−0.15') + '" style="width:80px">' +
          '<span class="mkt-ct-price-lbl" style="margin-left:4px;font-size:0.75rem;color:var(--muted)">' +
            (mode === 'flat' ? '$/unit' : '$/bu basis') +
          '</span>' +
        '</td>' +
        '<td>' +
          '<select class="mkt-ct-unit form-control-sm" style="' + (mode !== 'flat' ? 'visibility:hidden' : '') + '">' +
            '<option value="per_bu"' + (unit === 'per_bu' ? ' selected' : '') + '>per bu</option>' +
            '<option value="per_ton"' + (unit === 'per_ton' ? ' selected' : '') + '>per ton</option>' +
            '<option value="per_cwt"' + (unit === 'per_cwt' ? ' selected' : '') + '>per cwt</option>' +
          '</select>' +
        '</td>' +
        '<td><input type="text" class="mkt-ct-notes form-control-sm" value="' + util.escHtml(notes) + '" placeholder="optional" style="width:120px"></td>' +
        '<td><button type="button" class="btn-primary btn-sm mkt-ct-save-btn" data-ctid="' + util.escHtml(ct.id) + '">Save</button></td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    html += '<div class="mkt-ct-footer">CBOT Basis: unpriced exposure = unpriced bu × (CBOT + basis). &nbsp;Flat: exposure = unpriced bu × flat price (no CBOT lookup).</div>';

    root.innerHTML = html;
    bindCropTypeEvents(root);
  }

  function bindCropTypeEvents(root) {
    // Mode toggle buttons
    root.querySelectorAll('.mkt-ct-mode-toggle').forEach(function (tog) {
      tog.querySelectorAll('.mkt-ct-mode-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          tog.querySelectorAll('.mkt-ct-mode-btn').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var row  = btn.closest('.mkt-ct-row');
          var mode = btn.getAttribute('data-mode');
          var lbl  = row.querySelector('.mkt-ct-price-lbl');
          var unit = row.querySelector('.mkt-ct-unit');
          var priceInput = row.querySelector('.mkt-ct-price');
          if (lbl)  lbl.textContent  = mode === 'flat' ? '$/unit' : '$/bu basis';
          if (unit) unit.style.visibility = mode === 'flat' ? '' : 'hidden';
          if (priceInput) priceInput.placeholder = mode === 'flat' ? '15.00' : '−0.15';
        });
      });
    });

    // Save buttons
    root.querySelectorAll('.mkt-ct-save-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ctId = btn.getAttribute('data-ctid');
        var ct   = cropTypes.find(function (c) { return c.id === ctId; });
        if (!ct) return;

        var row   = btn.closest('.mkt-ct-row');
        var mode  = (row.querySelector('.mkt-ct-mode-btn.active') || {}).getAttribute('data-mode') || 'cbot_basis';
        var price = parseFloat(row.querySelector('.mkt-ct-price').value);
        var unit  = row.querySelector('.mkt-ct-unit').value;
        var notes = row.querySelector('.mkt-ct-notes').value.trim();

        var updated = Object.assign({}, ct);
        updated.yearPricing = Object.assign({}, ct.yearPricing || {});
        updated.yearPricing[activeCropYear] = {
          mode: mode,
          price: mode === 'flat' ? (isNaN(price) ? null : price) : null,
          basis: mode === 'cbot_basis' ? (isNaN(price) ? null : price) : null,
          unit: unit,
          notes: notes
        };

        btn.disabled = true;
        btn.textContent = '…';

        api.put('/api/crop-types/' + ctId, updated).then(function () {
          // Update local copy
          var idx = cropTypes.findIndex(function (c) { return c.id === ctId; });
          if (idx >= 0) cropTypes[idx] = updated;
          util.showToast('Saved');
          btn.disabled = false;
          btn.textContent = 'Save';
          // Rebuild pools to reflect new pricing
          buildPools({});
        }).catch(function (err) {
          util.showToast('Save failed: ' + (err.message || 'error'), 'error');
          btn.disabled = false;
          btn.textContent = 'Save';
        });
      });
    });
  }

  // ── Instrument Drawer ─────────────────────────────────────────────────────
  function openInstrumentForm(inst, preCtId) {
    var overlay = document.createElement('div');
    overlay.className = 'mkt-overlay';
    var drawer = document.createElement('div');
    drawer.className = 'mkt-drawer';

    var selCtId  = (inst && inst.crop_type_id) || preCtId || (pools[0] && pools[0].id) || '';
    var curType  = (inst && inst.instrument_type) || 'cash';
    var instYear = (inst && inst.crop_year) || activeCropYear;
    var poolOpts = pools.map(function (p) {
      return '<option value="' + util.escHtml(p.id) + '"' + (p.id === selCtId ? ' selected' : '') + '>' + util.escHtml(p.name) + '</option>';
    }).join('');
    var typeBtns = ['cash', 'forward_contract', 'hta', 'option', 'accumulator'].map(function (t) {
      var lbl = { cash: 'Cash', forward_contract: 'Forward', hta: 'HTA', option: 'Option', accumulator: 'Accumulator' }[t];
      return '<button type="button" class="mkt-type-btn' + (t === curType ? ' active' : '') + '" data-type="' + t + '">' + lbl + '</button>';
    }).join('');

    var isFwd = instYear !== currentSettingsYear;
    var yearHint = isFwd
      ? '<div class="mkt-year-hint">Tracked against ' + instYear + ' production</div>'
      : '';

    drawer.innerHTML =
      '<div class="mkt-drawer-header">' +
        '<span>' + (inst ? 'Edit Instrument' : 'Add Instrument') + '</span>' +
        '<button class="mkt-drawer-close">✕</button>' +
      '</div>' +
      '<div class="mkt-drawer-body">' +
        '<label class="form-label">Pool<select id="mkt-form-pool" class="form-control">' + poolOpts + '</select></label>' +
        '<label class="form-label">Crop Year' +
          '<input type="number" id="mkt-form-year" class="form-control" value="' + instYear + '" min="2020" max="2040" step="1">' +
        '</label>' +
        '<div id="mkt-year-hint-box">' + yearHint + '</div>' +
        '<label class="form-label">Buyer / Counterparty<input type="text" id="mkt-form-buyer" class="form-control" value="' + util.escHtml((inst && (inst.buyer || inst.counterparty)) || '') + '"></label>' +
        '<div class="mkt-type-btns" style="margin:0.75rem 0">' + typeBtns + '</div>' +
        '<div id="mkt-type-fields">' + buildTypeFields(curType, inst) + '</div>' +
        '<label class="form-label">Notes<input type="text" id="mkt-form-notes" class="form-control" value="' + util.escHtml((inst && inst.notes) || '') + '"></label>' +
      '</div>' +
      '<div class="mkt-drawer-footer">' +
        '<button class="btn-secondary" id="mkt-cancel-btn">Cancel</button>' +
        '<button class="btn-primary" id="mkt-save-btn">Save</button>' +
      '</div>';

    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { drawer.classList.add('open'); });

    function close() { overlay.remove(); }
    overlay.addEventListener('click', close);
    drawer.addEventListener('click', function (e) { e.stopPropagation(); });
    drawer.querySelector('.mkt-drawer-close').addEventListener('click', close);
    drawer.querySelector('#mkt-cancel-btn').addEventListener('click', close);

    // Year input → update hint
    drawer.querySelector('#mkt-form-year').addEventListener('input', function () {
      var y = parseInt(this.value) || currentSettingsYear;
      var hintBox = drawer.querySelector('#mkt-year-hint-box');
      if (hintBox) {
        hintBox.innerHTML = (y !== currentSettingsYear)
          ? '<div class="mkt-year-hint">Tracked against ' + y + ' production</div>'
          : '';
      }
    });

    drawer.querySelectorAll('.mkt-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        drawer.querySelectorAll('.mkt-type-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        drawer.querySelector('#mkt-type-fields').innerHTML = buildTypeFields(btn.getAttribute('data-type'), null);
        bindToggles(drawer);
      });
    });

    bindToggles(drawer);
    drawer.querySelector('#mkt-save-btn').addEventListener('click', function () {
      saveInstrument(drawer, inst, close);
    });
  }

  function buildTypeFields(type, inst) {
    var v = inst || {};
    if (type === 'cash' || type === 'forward_contract') {
      return fld('Bushels', 'number', 'mkt-form-bu', v.bushels, 'step="100"') +
        fld('Price / Bu', 'number', 'mkt-form-price', v.price_per_bushel, 'step="0.01"') +
        fld('Basis', 'number', 'mkt-form-basis', v.basis, 'step="0.01"') +
        fld('Delivery Start', 'date', 'mkt-form-del-start', v.delivery_start) +
        fld('Delivery End', 'date', 'mkt-form-del-end', v.delivery_end) +
        (type === 'forward_contract' ? fld('Contract #', 'text', 'mkt-form-contract-no', v.contract_number) : '');
    }
    if (type === 'hta') {
      return fld('Bushels', 'number', 'mkt-form-bu', v.bushels, 'step="100"') +
        fld('Futures Price (locked) $/bu', 'number', 'mkt-form-futures-ref', v.futures_reference, 'step="0.01"') +
        fld('Basis (+ = premium, open if blank)', 'number', 'mkt-form-basis', v.basis, 'step="0.01"') +
        fld('Delivery Start', 'date', 'mkt-form-del-start', v.delivery_start) +
        fld('Delivery End', 'date', 'mkt-form-del-end', v.delivery_end) +
        fld('Contract #', 'text', 'mkt-form-contract-no', v.contract_number);
    }
    if (type === 'option') {
      return fld('Bushels', 'number', 'mkt-form-bu', v.bushels, 'step="100"') +
        tog('[data-opt-type]', [['call', 'Call', v.option_type === 'call'], ['put', 'Put', v.option_type !== 'call']]) +
        tog('[data-opt-side]', [['long', 'Long', v.option_side !== 'short'], ['short', 'Short', v.option_side === 'short']]) +
        fld('Strike Price', 'number', 'mkt-form-strike', v.strike_price, 'step="0.01"') +
        fld('Premium Paid', 'number', 'mkt-form-premium', v.premium_paid, 'step="0.01"') +
        fld('Expiry', 'date', 'mkt-form-expiry', v.expiry_date);
    }
    if (type === 'accumulator') {
      return fld('KO Level', 'number', 'mkt-form-ko', v.ko_level, 'step="0.01"') +
        fld('KI Level (opt)', 'number', 'mkt-form-ki', v.ki_level, 'step="0.01"') +
        tog('[data-cadence]', [['daily', 'Daily', !v.weekly_bu], ['weekly', 'Weekly', !!v.weekly_bu]]) +
        fld('Bu / Day', 'number', 'mkt-form-daily-bu', v.daily_bu, 'step="10"') +
        fld('Bu / Week', 'number', 'mkt-form-weekly-bu', v.weekly_bu, 'step="10"') +
        fld('Start', 'date', 'mkt-form-acc-start', v.accumulation_start) +
        fld('End', 'date', 'mkt-form-acc-end', v.accumulation_end) +
        fld('Leverage', 'number', 'mkt-form-leverage', v.leverage_ratio != null ? v.leverage_ratio : 1, 'step="0.1"');
    }
    return '';
  }

  function fld(label, type, id, val, extra) {
    var safe = val != null ? util.escHtml(String(val)) : '';
    return '<label class="form-label">' + label +
      '<input type="' + type + '" id="' + id + '" class="form-control" value="' + safe + '" ' + (extra || '') + '>' +
    '</label>';
  }

  function tog(attrSelector, opts) {
    var attrName = attrSelector.replace(/[\[\]]/g, '');
    return '<div class="mkt-toggle-group" style="margin:0.5rem 0">' +
      opts.map(function (o) {
        return '<button type="button" class="mkt-toggle-btn' + (o[2] ? ' active' : '') + '" ' + attrName + '="' + o[0] + '">' + o[1] + '</button>';
      }).join('') +
    '</div>';
  }

  function bindToggles(ctx) {
    ['[data-opt-type]', '[data-opt-side]', '[data-cadence]'].forEach(function (sel) {
      var btns = ctx.querySelectorAll(sel);
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          btns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
        });
      });
    });
  }

  function saveInstrument(drawer, existing, close) {
    var type = (drawer.querySelector('.mkt-type-btn.active') || {}).getAttribute('data-type') || 'cash';
    var yearVal = parseInt(drawer.querySelector('#mkt-form-year').value) || activeCropYear;
    var payload = {
      crop_type_id:    drawer.querySelector('#mkt-form-pool').value,
      instrument_type: type,
      crop_year:       yearVal,
      buyer:           (drawer.querySelector('#mkt-form-buyer').value || '').trim() || null,
      notes:           (drawer.querySelector('#mkt-form-notes').value || '').trim() || null
    };

    function gv(id) { var el = drawer.querySelector('#' + id); return el ? el.value : ''; }
    function gn(id) { var v = gv(id); return v !== '' ? Number(v) : null; }
    function activeVal(sel, attr) { var el = drawer.querySelector(sel + '.active'); return el ? el.getAttribute(attr) : null; }

    if (type === 'cash' || type === 'forward_contract') {
      payload.bushels          = gn('mkt-form-bu');
      payload.price_per_bushel = gn('mkt-form-price');
      payload.basis            = gn('mkt-form-basis');
      payload.delivery_start   = gv('mkt-form-del-start') || null;
      payload.delivery_end     = gv('mkt-form-del-end') || null;
      if (type === 'forward_contract') payload.contract_number = gv('mkt-form-contract-no') || null;
    } else if (type === 'hta') {
      payload.bushels           = gn('mkt-form-bu');
      payload.futures_reference = gn('mkt-form-futures-ref');
      payload.basis             = gn('mkt-form-basis');
      payload.delivery_start    = gv('mkt-form-del-start') || null;
      payload.delivery_end      = gv('mkt-form-del-end') || null;
      payload.contract_number   = gv('mkt-form-contract-no') || null;
      if (!payload.bushels) { util.showToast('Bushels required', 'error'); return; }
      if (!payload.futures_reference) { util.showToast('Futures price required', 'error'); return; }
    } else if (type === 'option') {
      payload.bushels      = gn('mkt-form-bu');
      payload.option_type  = activeVal('[data-opt-type]', 'data-opt-type') || 'put';
      payload.option_side  = activeVal('[data-opt-side]', 'data-opt-side') || 'long';
      payload.strike_price = gn('mkt-form-strike');
      payload.premium_paid = gn('mkt-form-premium');
      payload.expiry_date  = gv('mkt-form-expiry') || null;
    } else if (type === 'accumulator') {
      payload.ko_level           = gn('mkt-form-ko');
      payload.ki_level           = gn('mkt-form-ki');
      payload.daily_bu           = gn('mkt-form-daily-bu');
      payload.weekly_bu          = gn('mkt-form-weekly-bu');
      payload.accumulation_start = gv('mkt-form-acc-start') || null;
      payload.accumulation_end   = gv('mkt-form-acc-end') || null;
      payload.leverage_ratio     = gn('mkt-form-leverage') || 1;
    }

    var saveBtn = drawer.querySelector('#mkt-save-btn');
    saveBtn.disabled = true;

    (existing
      ? api.put('/api/marketing/instruments/' + existing.id, payload)
      : api.post('/api/marketing/instruments', payload)
    ).then(function () {
      util.showToast(existing ? 'Instrument updated' : 'Instrument added');
      close();
      reload();
    }).catch(function (err) {
      util.showToast('Save failed: ' + (err.message || 'error'), 'error');
      saveBtn.disabled = false;
    });
  }

})();
