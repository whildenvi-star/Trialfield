// Sales & Marketing — Hedging Dashboard, Instruments, Variant Setup
(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  var commodities = [];
  var variants = [];
  var instruments = [];
  var cbotPrices = [];
  var positions = [];
  var loaded = false;

  // ── Sub-tab switching ─────────────────────────────────────────────────────
  document.querySelectorAll('.mkt-tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mkt-tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.mtab-content').forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-mtab');
      var panel = document.getElementById('mtab-' + tab);
      if (panel) panel.classList.add('active');
    });
  });

  // ── Load on tab-activate ──────────────────────────────────────────────────
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'sales') {
      if (!loaded) loadAll();
    }
  });

  function loadAll() {
    Promise.all([
      api.get('/api/marketing/commodities'),
      api.get('/api/marketing/variants'),
      api.get('/api/marketing/instruments'),
      api.get('/api/cbot-fetch').catch(function () { return { prices: [] }; })
    ]).then(function (results) {
      commodities = results[0] || [];
      variants = results[1] || [];
      instruments = results[2] || [];
      var cbotResp = results[3] || {};
      cbotPrices = cbotResp.prices || [];
      loaded = true;
      recompute();
      renderDashboard();
      renderInstruments();
      renderVariants();
    }).catch(function (err) {
      console.error('[sales-marketing] load failed', err);
    });
  }

  function reload() {
    loaded = false;
    loadAll();
  }

  // ── Position computation ──────────────────────────────────────────────────
  function instrumentPricedBu(inst) {
    var t = inst.instrument_type;
    if (t === 'cash' || t === 'forward_contract') return Number(inst.bushels) || 0;
    if (t === 'option') {
      if (inst.option_type === 'put' && inst.option_side === 'long') return Number(inst.bushels) || 0;
      return 0;
    }
    if (t === 'accumulator') {
      if (inst.delivered_bu > 0) return Number(inst.delivered_bu);
      var start = inst.accumulation_start ? new Date(inst.accumulation_start) : null;
      var end = inst.accumulation_end ? new Date(inst.accumulation_end) : null;
      var now = new Date();
      if (!start) return 0;
      var effectiveEnd = end && end < now ? end : now;
      if (effectiveEnd <= start) return 0;
      if (inst.daily_bu) {
        var days = Math.floor((effectiveEnd - start) / 86400000);
        return days * Number(inst.daily_bu) * (Number(inst.leverage_ratio) || 1);
      }
      if (inst.weekly_bu) {
        var weeks = Math.floor((effectiveEnd - start) / (7 * 86400000));
        return weeks * Number(inst.weekly_bu) * (Number(inst.leverage_ratio) || 1);
      }
    }
    return 0;
  }

  function recompute() {
    var cbotMap = {};
    cbotPrices.forEach(function (p) { if (p.symbol) cbotMap[p.symbol] = Number(p.price) || 0; });

    positions = commodities.map(function (comm) {
      var commVariants = variants.filter(function (v) { return v.commodity_id === comm.id; });
      var commInstruments = instruments.filter(function (i) { return i.commodity_id === comm.id; });

      var variantPositions = commVariants.map(function (v) {
        var varInst = commInstruments.filter(function (i) { return i.variant_id === v.id; });
        var pricedBu = varInst.reduce(function (s, i) { return s + instrumentPricedBu(i); }, 0);
        var estBu = Number(v.estimated_bu) || 0;
        var unpricedBu = Math.max(0, estBu - pricedBu);
        var pctPriced = estBu > 0 ? Math.min(100, (pricedBu / estBu) * 100) : 0;

        // WAP: cash + forward only
        var wapInst = varInst.filter(function (i) {
          return (i.instrument_type === 'cash' || i.instrument_type === 'forward_contract') && i.price_per_bushel != null;
        });
        var wapBu = wapInst.reduce(function (s, i) { return s + (Number(i.bushels) || 0); }, 0);
        var wapVal = wapInst.reduce(function (s, i) { return s + (Number(i.bushels) || 0) * (Number(i.price_per_bushel) || 0); }, 0);
        var wap = wapBu > 0 ? wapVal / wapBu : null;

        return { variant: v, instruments: varInst, pricedBu: pricedBu, unpricedBu: unpricedBu, pctPriced: pctPriced, wap: wap };
      });

      var totalEstBu = commVariants.reduce(function (s, v) { return s + (Number(v.estimated_bu) || 0); }, 0);
      var totalPricedBu = variantPositions.reduce(function (s, vp) { return s + vp.pricedBu; }, 0);
      var pctPriced = totalEstBu > 0 ? Math.min(100, (totalPricedBu / totalEstBu) * 100) : 0;
      var unpricedBu = Math.max(0, totalEstBu - totalPricedBu);
      var cbotPrice = comm.cbot_symbol ? (cbotMap[comm.cbot_symbol] || null) : null;
      var unpricedExposure = cbotPrice && unpricedBu > 0 ? unpricedBu * cbotPrice : null;

      // WAP roll-up
      var allWapInst = commInstruments.filter(function (i) {
        return (i.instrument_type === 'cash' || i.instrument_type === 'forward_contract') && i.price_per_bushel != null;
      });
      var allWapBu = allWapInst.reduce(function (s, i) { return s + (Number(i.bushels) || 0); }, 0);
      var allWapVal = allWapInst.reduce(function (s, i) { return s + (Number(i.bushels) || 0) * (Number(i.price_per_bushel) || 0); }, 0);
      var wap = allWapBu > 0 ? allWapVal / allWapBu : null;

      // Instrument mix
      var mix = { cash: 0, forward_contract: 0, option: 0, accumulator: 0 };
      commInstruments.forEach(function (i) {
        var pb = instrumentPricedBu(i);
        if (mix[i.instrument_type] !== undefined) mix[i.instrument_type] += pb;
      });

      return {
        commodity: comm,
        variants: variantPositions,
        totalEstBu: totalEstBu,
        totalPricedBu: totalPricedBu,
        pctPriced: pctPriced,
        unpricedBu: unpricedBu,
        unpricedExposure: unpricedExposure,
        cbotPrice: cbotPrice,
        wap: wap,
        mix: mix,
        instruments: commInstruments,
      };
    });
  }

  // ── Hedging Dashboard ─────────────────────────────────────────────────────
  function renderDashboard() {
    var root = document.getElementById('mkt-dashboard-root');
    if (!root) return;

    if (commodities.length === 0) {
      root.innerHTML = '<p class="edit-hint" style="margin-top:1rem">No commodities found. Check Supabase connection.</p>';
      return;
    }

    var totalEst = positions.reduce(function (s, p) { return s + p.totalEstBu; }, 0);
    var totalPriced = positions.reduce(function (s, p) { return s + p.totalPricedBu; }, 0);
    var totalExposure = positions.reduce(function (s, p) { return s + (p.unpricedExposure || 0); }, 0);
    var farmPct = totalEst > 0 ? Math.min(100, (totalPriced / totalEst) * 100) : 0;
    var instCount = instruments.length;

    var html = '<div class="mkt-summary-strip">' +
      '<div class="mkt-summary-item"><span class="mkt-summary-label">Farm-wide % Priced</span>' +
        '<span class="mkt-summary-val">' + util.formatNum(farmPct, 1) + '%</span></div>' +
      '<div class="mkt-summary-item"><span class="mkt-summary-label">Priced Bushels</span>' +
        '<span class="mkt-summary-val">' + util.formatNum(totalPriced, 0) + ' bu</span></div>' +
      '<div class="mkt-summary-item"><span class="mkt-summary-label">Unpriced Exposure</span>' +
        '<span class="mkt-summary-val ' + (totalExposure > 500000 ? 'text-amber' : '') + '">' +
          (totalExposure > 0 ? util.formatMoney(totalExposure) : '—') + '</span></div>' +
      '<div class="mkt-summary-item"><span class="mkt-summary-label">Instruments</span>' +
        '<span class="mkt-summary-val">' + instCount + '</span></div>' +
      '</div>';

    html += '<div class="mkt-cards">';
    positions.forEach(function (pos) {
      var comm = pos.commodity;
      var isAllContracted = pos.variants.length > 0 && pos.variants.every(function (vp) { return vp.variant.is_contracted; });

      if (!comm.is_hedgeable || isAllContracted) {
        html += renderPrecontractedCard(pos);
        return;
      }

      var barPct = Math.min(100, pos.pctPriced);
      var barColor = barPct >= 80 ? 'var(--primary)' : barPct >= 50 ? 'var(--primary)' : '#f59e0b';
      var cbotLabel = comm.cbot_symbol ? ' (' + comm.cbot_symbol + ')' : '';
      var cbotPriceStr = pos.cbotPrice ? '$' + util.formatNum(pos.cbotPrice, 4) : '—';
      var wapDelta = pos.wap && pos.cbotPrice ? pos.wap - pos.cbotPrice : null;

      html += '<div class="mkt-card">';
      html += '<div class="mkt-card-header">' +
        '<span class="mkt-card-title">' + util.escHtml(comm.name) + '<span class="mkt-card-symbol">' + util.escHtml(cbotLabel) + '</span></span>' +
        '<span class="mkt-card-cbot">' + cbotPriceStr + '</span>' +
        '</div>';

      html += '<div class="mkt-progress-track"><div class="mkt-progress-fill" style="width:' + barPct + '%;background:' + barColor + '"></div></div>';
      html += '<div class="mkt-progress-label">' + util.formatNum(pos.totalPricedBu, 0) + ' / ' + util.formatNum(pos.totalEstBu, 0) + ' bu &nbsp;&middot;&nbsp; ' + util.formatNum(barPct, 1) + '% priced</div>';

      if (pos.wap) {
        var deltaClass = wapDelta !== null ? (wapDelta >= 0 ? 'text-cyan' : 'text-amber') : '';
        var deltaStr = wapDelta !== null ? (wapDelta >= 0 ? '+' : '') + '$' + util.formatNum(Math.abs(wapDelta), 4) + ' vs CBOT' : '';
        html += '<div class="mkt-wap-row"><span>WAP <strong>$' + util.formatNum(pos.wap, 4) + '</strong></span>' +
          (deltaStr ? '<span class="' + deltaClass + '">' + deltaStr + '</span>' : '') + '</div>';
      }

      html += renderMixStrip(pos.mix);

      if (pos.unpricedExposure) {
        html += '<div class="mkt-unpriced-row">' + util.formatNum(pos.unpricedBu, 0) + ' bu unpriced — ' +
          '<span class="' + (pos.unpricedExposure > 500000 ? 'text-amber' : '') + '">' + util.formatMoney(pos.unpricedExposure) + ' exposure at CBOT</span></div>';
      }

      html += '</div>';
    });
    html += '</div>';

    root.innerHTML = html;
  }

  function renderPrecontractedCard(pos) {
    var comm = pos.commodity;
    var totalBu = pos.variants.reduce(function (s, vp) { return s + (Number(vp.variant.estimated_bu) || 0); }, 0);
    return '<div class="mkt-card mkt-card-contracted">' +
      '<div class="mkt-card-header">' +
        '<span class="mkt-card-title">' + util.escHtml(comm.name) + '</span>' +
        '<span class="type-badge type-badge-forward">Pre-contracted</span>' +
      '</div>' +
      '<div class="mkt-card-stat">' + util.formatNum(totalBu, 0) + ' bu committed</div>' +
      '</div>';
  }

  function renderMixStrip(mix) {
    var total = mix.cash + mix.forward_contract + mix.option + mix.accumulator;
    if (total <= 0) return '';
    var colors = { cash: '#14b8a6', forward_contract: '#3b82f6', option: '#8b5cf6', accumulator: '#f59e0b' };
    var strips = '';
    ['cash','forward_contract','option','accumulator'].forEach(function (t) {
      if (mix[t] <= 0) return;
      var pct = (mix[t] / total) * 100;
      strips += '<div class="mix-strip-seg" style="width:' + pct + '%;background:' + colors[t] + '" title="' + t + ': ' + util.formatNum(mix[t], 0) + ' bu"></div>';
    });
    return '<div class="mix-strip">' + strips + '</div>';
  }

  // ── Instruments tab ───────────────────────────────────────────────────────
  function renderInstruments() {
    var root = document.getElementById('mkt-instruments-root');
    if (!root) return;

    var html = '<div class="mkt-toolbar">' +
      '<button class="btn-primary btn-sm" id="mkt-add-instrument">+ Add Instrument</button>' +
      '</div>';

    if (positions.length === 0) {
      html += '<p class="edit-hint">No commodities set up. Add variants first.</p>';
      root.innerHTML = html;
      bindInstrumentToolbar();
      return;
    }

    html += '<div class="mkt-inst-table">';
    positions.forEach(function (pos) {
      if (pos.instruments.length === 0 && pos.variants.length === 0) return;
      html += '<div class="mkt-comm-row" data-comm-id="' + util.escHtml(pos.commodity.id) + '">' +
        '<span class="mkt-expand-toggle">&#9654;</span>' +
        '<span class="mkt-comm-name">' + util.escHtml(pos.commodity.name) + '</span>' +
        '<span class="mkt-comm-stats">' + util.formatNum(pos.totalPricedBu, 0) + ' / ' + util.formatNum(pos.totalEstBu, 0) + ' bu &middot; ' + util.formatNum(pos.pctPriced, 1) + '%</span>' +
        '</div>';
      html += '<div class="mkt-comm-children" data-comm-id="' + util.escHtml(pos.commodity.id) + '" style="display:none">';
      pos.variants.forEach(function (vp) {
        html += '<div class="mkt-variant-row" data-var-id="' + util.escHtml(vp.variant.id) + '">' +
          '<span class="mkt-expand-toggle">&#9654;</span>' +
          '<span class="mkt-variant-name">' + util.escHtml(vp.variant.name) + '</span>' +
          (vp.variant.is_contracted ? '<span class="type-badge type-badge-forward">Pre-sold</span>' : '') +
          '<span class="mkt-variant-stats">' + util.formatNum(vp.pricedBu, 0) + ' / ' + util.formatNum(Number(vp.variant.estimated_bu) || 0, 0) + ' bu' +
            (vp.wap ? ' &middot; WAP $' + util.formatNum(vp.wap, 4) : '') + '</span>' +
          '</div>';
        html += '<div class="mkt-inst-children" data-var-id="' + util.escHtml(vp.variant.id) + '" style="display:none">';
        if (vp.instruments.length === 0) {
          html += '<div class="mkt-inst-empty">No instruments — click "+ Add Instrument" above.</div>';
        }
        vp.instruments.forEach(function (inst) {
          html += renderInstrumentRow(inst);
        });
        html += '</div>';
      });

      // Instruments not assigned to any variant
      var unassigned = pos.instruments.filter(function (i) { return !i.variant_id; });
      if (unassigned.length > 0) {
        html += '<div class="mkt-variant-row"><span class="mkt-expand-toggle">&#9654;</span><span class="mkt-variant-name mkt-muted">Unassigned</span></div>';
        html += '<div class="mkt-inst-children" style="display:none">';
        unassigned.forEach(function (inst) { html += renderInstrumentRow(inst); });
        html += '</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    root.innerHTML = html;
    bindInstrumentToolbar();
    bindExpandToggles(root);
  }

  function renderInstrumentRow(inst) {
    var typeColors = { cash: 'type-badge-cash', forward_contract: 'type-badge-forward', option: 'type-badge-option', accumulator: 'type-badge-accum' };
    var typeLabels = { cash: 'Cash', forward_contract: 'Forward', option: 'Option', accumulator: 'Accum' };
    var badge = '<span class="type-badge ' + (typeColors[inst.instrument_type] || '') + '">' + (typeLabels[inst.instrument_type] || inst.instrument_type) + '</span>';
    var detail = '';
    if (inst.instrument_type === 'cash' || inst.instrument_type === 'forward_contract') {
      detail = util.formatNum(inst.bushels, 0) + ' bu @ $' + util.formatNum(inst.price_per_bushel, 4);
      if (inst.delivery_start) detail += ' &middot; ' + inst.delivery_start.slice(0, 7);
    } else if (inst.instrument_type === 'option') {
      detail = (inst.option_side || '') + ' ' + (inst.option_type || '') + ' &middot; strike $' + util.formatNum(inst.strike_price, 4);
      if (inst.expiry_date) detail += ' &middot; exp ' + inst.expiry_date.slice(0, 7);
    } else if (inst.instrument_type === 'accumulator') {
      detail = 'KO $' + util.formatNum(inst.ko_level, 4);
      if (inst.daily_bu) detail += ' &middot; ' + util.formatNum(inst.daily_bu, 0) + ' bu/day';
      if (inst.weekly_bu) detail += ' &middot; ' + util.formatNum(inst.weekly_bu, 0) + ' bu/wk';
    }
    return '<div class="mkt-inst-row" data-inst-id="' + util.escHtml(inst.id) + '">' +
      badge +
      '<span class="mkt-inst-buyer">' + util.escHtml(inst.buyer || '—') + '</span>' +
      '<span class="mkt-inst-detail">' + detail + '</span>' +
      '<span class="mkt-inst-actions">' +
        '<button class="btn-link mkt-edit-inst" data-inst-id="' + util.escHtml(inst.id) + '">Edit</button>' +
        '<button class="btn-link mkt-del-inst text-danger" data-inst-id="' + util.escHtml(inst.id) + '">Delete</button>' +
      '</span>' +
      '</div>';
  }

  function bindExpandToggles(root) {
    root.querySelectorAll('.mkt-comm-row').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.getAttribute('data-comm-id');
        var children = root.querySelector('.mkt-comm-children[data-comm-id="' + id + '"]');
        var tog = row.querySelector('.mkt-expand-toggle');
        if (!children) return;
        var open = children.style.display !== 'none';
        children.style.display = open ? 'none' : 'block';
        if (tog) tog.innerHTML = open ? '&#9654;' : '&#9660;';
      });
    });
    root.querySelectorAll('.mkt-variant-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        var id = row.getAttribute('data-var-id');
        var children = id
          ? root.querySelector('.mkt-inst-children[data-var-id="' + id + '"]')
          : row.nextElementSibling;
        var tog = row.querySelector('.mkt-expand-toggle');
        if (!children) return;
        var open = children.style.display !== 'none';
        children.style.display = open ? 'none' : 'block';
        if (tog) tog.innerHTML = open ? '&#9654;' : '&#9660;';
      });
    });
    root.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.mkt-edit-inst');
      var delBtn = e.target.closest('.mkt-del-inst');
      if (editBtn) {
        var id = editBtn.getAttribute('data-inst-id');
        var inst = instruments.find(function (i) { return i.id === id; });
        if (inst) openInstrumentForm(inst);
      }
      if (delBtn) {
        var id2 = delBtn.getAttribute('data-inst-id');
        if (confirm('Delete this instrument?')) {
          api.del('/api/marketing/instruments/' + id2).then(function () {
            util.showToast('Instrument deleted');
            reload();
          }).catch(function () { util.showToast('Delete failed', 'error'); });
        }
      }
    });
  }

  function bindInstrumentToolbar() {
    var btn = document.getElementById('mkt-add-instrument');
    if (btn && !btn._mktBound) {
      btn._mktBound = true;
      btn.addEventListener('click', function () { openInstrumentForm(null); });
    }
  }

  // ── Instrument drawer ─────────────────────────────────────────────────────
  var drawerEl = null;

  function openInstrumentForm(inst) {
    closeDrawer();
    var overlay = document.createElement('div');
    overlay.className = 'mkt-overlay';
    overlay.addEventListener('click', closeDrawer);

    var drawer = document.createElement('div');
    drawer.className = 'mkt-drawer';
    drawer.innerHTML = buildInstrumentFormHtml(inst);
    drawer.addEventListener('click', function (e) { e.stopPropagation(); });

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);
    drawerEl = { overlay: overlay, drawer: drawer };

    requestAnimationFrame(function () { drawer.classList.add('open'); });
    bindInstrumentForm(drawer, inst);
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.overlay.remove();
    drawerEl.drawer.remove();
    drawerEl = null;
  }

  function buildInstrumentFormHtml(inst) {
    var isEdit = !!inst;
    var t = inst ? inst.instrument_type : 'cash';
    var val = function (k, def) { return inst ? (inst[k] != null ? inst[k] : (def || '')) : (def || ''); };

    var commOptions = commodities.map(function (c) {
      var sel = (inst && inst.commodity_id === c.id) ? ' selected' : '';
      return '<option value="' + util.escHtml(c.id) + '"' + sel + '>' + util.escHtml(c.name) + '</option>';
    }).join('');

    var variantOptions = buildVariantOptions(inst ? inst.commodity_id : null, inst ? inst.variant_id : null);

    var types = ['cash','forward_contract','option','accumulator'];
    var typeLabels = { cash: 'Cash Sale', forward_contract: 'Forward Contract', option: 'Option', accumulator: 'Accumulator' };
    var typeBtns = types.map(function (tp) {
      return '<button type="button" class="mkt-type-btn' + (t === tp ? ' active' : '') + '" data-type="' + tp + '">' + typeLabels[tp] + '</button>';
    }).join('');

    return '<div class="mkt-drawer-header">' +
        '<h3>' + (isEdit ? 'Edit Instrument' : 'Add Instrument') + '</h3>' +
        '<button type="button" class="mkt-drawer-close">&times;</button>' +
      '</div>' +
      '<div class="mkt-drawer-body">' +
        '<div class="form-group"><label>Commodity</label>' +
          '<select id="mkt-f-commodity">' + commOptions + '</select></div>' +
        '<div class="form-group"><label>Variant</label>' +
          '<select id="mkt-f-variant">' + variantOptions + '</select>' +
          '<button type="button" class="btn-link" id="mkt-new-variant-btn" style="margin-top:4px;font-size:0.75rem">+ New Variant</button>' +
          '<div id="mkt-new-variant-form" style="display:none;margin-top:6px">' +
            '<input type="text" id="mkt-new-variant-name" placeholder="Variant name" style="width:100%;margin-bottom:4px">' +
            '<button type="button" class="btn-sm btn-primary" id="mkt-create-variant-btn">Create</button>' +
            '<button type="button" class="btn-sm" id="mkt-cancel-variant-btn" style="margin-left:6px">Cancel</button>' +
          '</div>' +
        '</div>' +
        '<div class="form-group"><label>Instrument Type</label>' +
          '<div class="mkt-type-btns">' + typeBtns + '</div></div>' +
        '<div id="mkt-f-common">' +
          '<div class="form-group"><label>Buyer / Counterparty</label><input type="text" id="mkt-f-buyer" value="' + util.escHtml(val('buyer')) + '"></div>' +
          '<div class="form-group"><label>Notes</label><input type="text" id="mkt-f-notes" value="' + util.escHtml(val('notes')) + '"></div>' +
        '</div>' +
        '<div id="mkt-f-type-fields">' + buildTypeFields(t, inst) + '</div>' +
      '</div>' +
      '<div class="mkt-drawer-footer">' +
        '<button type="button" class="btn-sm" id="mkt-drawer-cancel">Cancel</button>' +
        '<button type="button" class="btn-primary btn-sm" id="mkt-drawer-save">' + (isEdit ? 'Save Changes' : 'Add Instrument') + '</button>' +
      '</div>';
  }

  function buildVariantOptions(commId, selectedVariantId) {
    var filtered = commId ? variants.filter(function (v) { return v.commodity_id === commId; }) : variants;
    var opts = '<option value="">— No variant —</option>';
    opts += filtered.map(function (v) {
      var sel = selectedVariantId === v.id ? ' selected' : '';
      return '<option value="' + util.escHtml(v.id) + '"' + sel + '>' + util.escHtml(v.name) + '</option>';
    }).join('');
    return opts;
  }

  function buildTypeFields(t, inst) {
    var val = function (k, def) { return inst ? (inst[k] != null ? inst[k] : (def || '')) : (def || ''); };
    if (t === 'cash' || t === 'forward_contract') {
      return '<div class="form-row">' +
          '<div class="form-group"><label>Bushels</label><input type="number" id="mkt-f-bushels" min="0" step="100" value="' + val('bushels') + '"></div>' +
          '<div class="form-group"><label>Price / Bu</label><input type="number" id="mkt-f-price" min="0" step="0.01" value="' + val('price_per_bushel') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Basis</label><input type="number" id="mkt-f-basis" step="0.01" value="' + val('basis') + '"></div>' +
          '<div class="form-group"><label>Futures Ref</label><input type="number" id="mkt-f-futures-ref" step="0.01" value="' + val('futures_reference') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Delivery Start</label><input type="date" id="mkt-f-del-start" value="' + val('delivery_start') + '"></div>' +
          '<div class="form-group"><label>Delivery End</label><input type="date" id="mkt-f-del-end" value="' + val('delivery_end') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Delivered Bu</label><input type="number" id="mkt-f-delivered-bu" min="0" step="100" value="' + val('delivered_bu', 0) + '"></div>' +
          (t === 'forward_contract' ? '<div class="form-group"><label>Contract #</label><input type="text" id="mkt-f-contract-no" value="' + util.escHtml(val('contract_number')) + '"></div>' : '') +
        '</div>';
    }
    if (t === 'option') {
      var optType = val('option_type', 'put');
      var optSide = val('option_side', 'long');
      return '<div class="form-group"><label>Type</label>' +
          '<div class="mkt-toggle-group">' +
            '<button type="button" class="mkt-toggle-btn' + (optType === 'put' ? ' active' : '') + '" data-opt-type="put">Put</button>' +
            '<button type="button" class="mkt-toggle-btn' + (optType === 'call' ? ' active' : '') + '" data-opt-type="call">Call</button>' +
          '</div></div>' +
        '<div class="form-group"><label>Side</label>' +
          '<div class="mkt-toggle-group">' +
            '<button type="button" class="mkt-toggle-btn' + (optSide === 'long' ? ' active' : '') + '" data-opt-side="long">Long</button>' +
            '<button type="button" class="mkt-toggle-btn' + (optSide === 'short' ? ' active' : '') + '" data-opt-side="short">Short</button>' +
          '</div></div>' +
        '<input type="hidden" id="mkt-f-opt-type" value="' + optType + '">' +
        '<input type="hidden" id="mkt-f-opt-side" value="' + optSide + '">' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Bushels</label><input type="number" id="mkt-f-bushels" min="0" step="100" value="' + val('bushels') + '"></div>' +
          '<div class="form-group"><label>Strike Price</label><input type="number" id="mkt-f-strike" min="0" step="0.01" value="' + val('strike_price') + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Premium Paid</label><input type="number" id="mkt-f-premium" min="0" step="0.01" value="' + val('premium_paid') + '"></div>' +
          '<div class="form-group"><label>Expiry Date</label><input type="date" id="mkt-f-expiry" value="' + val('expiry_date') + '"></div>' +
        '</div>';
    }
    if (t === 'accumulator') {
      var cadence = inst && inst.weekly_bu ? 'weekly' : 'daily';
      return '<div class="form-row">' +
          '<div class="form-group"><label>KO Level</label><input type="number" id="mkt-f-ko" step="0.01" value="' + val('ko_level') + '"></div>' +
          '<div class="form-group"><label>KI Level (opt)</label><input type="number" id="mkt-f-ki" step="0.01" value="' + val('ki_level') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>Cadence</label>' +
          '<div class="mkt-toggle-group">' +
            '<button type="button" class="mkt-toggle-btn' + (cadence === 'daily' ? ' active' : '') + '" data-cadence="daily">Daily</button>' +
            '<button type="button" class="mkt-toggle-btn' + (cadence === 'weekly' ? ' active' : '') + '" data-cadence="weekly">Weekly</button>' +
          '</div></div>' +
        '<input type="hidden" id="mkt-f-cadence" value="' + cadence + '">' +
        '<div class="form-row">' +
          '<div class="form-group"><label id="mkt-f-bu-label">Bu / Day</label><input type="number" id="mkt-f-accum-bu" min="0" step="10" value="' + (inst ? (cadence === 'daily' ? val('daily_bu') : val('weekly_bu')) : '') + '"></div>' +
          '<div class="form-group"><label>Leverage Ratio</label><input type="number" id="mkt-f-leverage" min="1" step="0.5" value="' + val('leverage_ratio', 1) + '"></div>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>Start Date</label><input type="date" id="mkt-f-accum-start" value="' + val('accumulation_start') + '"></div>' +
          '<div class="form-group"><label>End Date</label><input type="date" id="mkt-f-accum-end" value="' + val('accumulation_end') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>Delivered Bu</label><input type="number" id="mkt-f-delivered-bu" min="0" step="100" value="' + val('delivered_bu', 0) + '"></div>';
    }
    return '';
  }

  function bindInstrumentForm(drawer, inst) {
    drawer.querySelector('.mkt-drawer-close').addEventListener('click', closeDrawer);
    drawer.querySelector('#mkt-drawer-cancel').addEventListener('click', closeDrawer);

    // Commodity change → refresh variant dropdown
    var commSel = drawer.querySelector('#mkt-f-commodity');
    commSel.addEventListener('change', function () {
      drawer.querySelector('#mkt-f-variant').innerHTML = buildVariantOptions(commSel.value, null);
    });

    // Inline new variant
    drawer.querySelector('#mkt-new-variant-btn').addEventListener('click', function () {
      drawer.querySelector('#mkt-new-variant-form').style.display = 'block';
    });
    drawer.querySelector('#mkt-cancel-variant-btn').addEventListener('click', function () {
      drawer.querySelector('#mkt-new-variant-form').style.display = 'none';
    });
    drawer.querySelector('#mkt-create-variant-btn').addEventListener('click', function () {
      var name = drawer.querySelector('#mkt-new-variant-name').value.trim();
      var commId = drawer.querySelector('#mkt-f-commodity').value;
      if (!name || !commId) { util.showToast('Enter variant name and select commodity', 'error'); return; }
      api.post('/api/marketing/variants', { commodity_id: commId, name: name }).then(function (newVar) {
        variants.push(newVar);
        drawer.querySelector('#mkt-f-variant').innerHTML = buildVariantOptions(commId, newVar.id);
        drawer.querySelector('#mkt-new-variant-form').style.display = 'none';
        util.showToast('Variant created');
      }).catch(function () { util.showToast('Failed to create variant', 'error'); });
    });

    // Type buttons
    drawer.querySelectorAll('.mkt-type-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        drawer.querySelectorAll('.mkt-type-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        drawer.querySelector('#mkt-f-type-fields').innerHTML = buildTypeFields(btn.getAttribute('data-type'), null);
        bindToggleButtons(drawer);
      });
    });

    bindToggleButtons(drawer);

    drawer.querySelector('#mkt-drawer-save').addEventListener('click', function () {
      saveInstrument(drawer, inst);
    });
  }

  function bindToggleButtons(drawer) {
    drawer.querySelectorAll('[data-opt-type]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        drawer.querySelectorAll('[data-opt-type]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var h = drawer.querySelector('#mkt-f-opt-type');
        if (h) h.value = btn.getAttribute('data-opt-type');
      });
    });
    drawer.querySelectorAll('[data-opt-side]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        drawer.querySelectorAll('[data-opt-side]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var h = drawer.querySelector('#mkt-f-opt-side');
        if (h) h.value = btn.getAttribute('data-opt-side');
      });
    });
    drawer.querySelectorAll('[data-cadence]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        drawer.querySelectorAll('[data-cadence]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var h = drawer.querySelector('#mkt-f-cadence');
        if (h) h.value = btn.getAttribute('data-cadence');
        var lbl = drawer.querySelector('#mkt-f-bu-label');
        if (lbl) lbl.textContent = btn.getAttribute('data-cadence') === 'daily' ? 'Bu / Day' : 'Bu / Week';
      });
    });
  }

  function saveInstrument(drawer, inst) {
    var activeTypeBtn = drawer.querySelector('.mkt-type-btn.active');
    var t = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'cash';
    var g = function (id) { var el = drawer.querySelector('#' + id); return el ? el.value : null; };

    var payload = {
      commodity_id: g('mkt-f-commodity'),
      variant_id: g('mkt-f-variant') || null,
      instrument_type: t,
      buyer: g('mkt-f-buyer') || null,
      notes: g('mkt-f-notes') || null,
    };

    if (t === 'cash' || t === 'forward_contract') {
      Object.assign(payload, {
        bushels: g('mkt-f-bushels'), price_per_bushel: g('mkt-f-price'),
        basis: g('mkt-f-basis'), futures_reference: g('mkt-f-futures-ref'),
        delivery_start: g('mkt-f-del-start') || null, delivery_end: g('mkt-f-del-end') || null,
        delivered_bu: g('mkt-f-delivered-bu') || 0,
        contract_number: g('mkt-f-contract-no') || null,
      });
    } else if (t === 'option') {
      Object.assign(payload, {
        option_type: g('mkt-f-opt-type'), option_side: g('mkt-f-opt-side'),
        bushels: g('mkt-f-bushels'), strike_price: g('mkt-f-strike'),
        premium_paid: g('mkt-f-premium'), expiry_date: g('mkt-f-expiry') || null,
      });
    } else if (t === 'accumulator') {
      var cadence = g('mkt-f-cadence');
      var bu = g('mkt-f-accum-bu');
      Object.assign(payload, {
        ko_level: g('mkt-f-ko'), ki_level: g('mkt-f-ki') || null,
        daily_bu: cadence === 'daily' ? bu : null,
        weekly_bu: cadence === 'weekly' ? bu : null,
        leverage_ratio: g('mkt-f-leverage') || 1,
        accumulation_start: g('mkt-f-accum-start') || null,
        accumulation_end: g('mkt-f-accum-end') || null,
        delivered_bu: g('mkt-f-delivered-bu') || 0,
      });
    }

    var saveBtn = drawer.querySelector('#mkt-drawer-save');
    saveBtn.disabled = true;

    var promise = inst
      ? api.put('/api/marketing/instruments/' + inst.id, payload)
      : api.post('/api/marketing/instruments', payload);

    promise.then(function () {
      util.showToast(inst ? 'Instrument updated' : 'Instrument added');
      closeDrawer();
      reload();
    }).catch(function (err) {
      util.showToast('Save failed: ' + (err.message || 'unknown error'), 'error');
      saveBtn.disabled = false;
    });
  }

  // ── Variant Setup tab ─────────────────────────────────────────────────────
  function renderVariants() {
    var root = document.getElementById('mkt-variants-root');
    if (!root) return;

    var html = '<div class="mkt-toolbar">' +
      '<button class="btn-sm btn-primary" id="mkt-sync-budget">&#8635; Sync from Budget</button>' +
      '</div>';

    if (commodities.length === 0) {
      html += '<p class="edit-hint">No commodities configured.</p>';
      root.innerHTML = html;
      return;
    }

    html += '<table class="mkt-variant-table"><thead><tr>' +
      '<th>Variant Name</th><th>Commodity</th><th>Est. Bushels</th><th>Pre-sold</th><th></th>' +
      '</tr></thead><tbody id="mkt-variant-tbody">';

    commodities.forEach(function (comm) {
      var commVariants = variants.filter(function (v) { return v.commodity_id === comm.id; });
      if (commVariants.length === 0) {
        html += '<tr class="mkt-variant-add-row"><td colspan="5">' +
          '<button class="btn-link mkt-add-variant-btn" data-comm-id="' + util.escHtml(comm.id) + '" data-comm-name="' + util.escHtml(comm.name) + '">' +
            '+ Add variant for ' + util.escHtml(comm.name) +
          '</button></td></tr>';
      } else {
        commVariants.forEach(function (v) {
          html += '<tr data-var-id="' + util.escHtml(v.id) + '">' +
            '<td><input class="mkt-vi mkt-vi-name" type="text" value="' + util.escHtml(v.name) + '" data-var-id="' + util.escHtml(v.id) + '"></td>' +
            '<td class="mkt-muted">' + util.escHtml(comm.name) + '</td>' +
            '<td><input class="mkt-vi mkt-vi-bu" type="number" min="0" step="1000" value="' + (v.estimated_bu != null ? v.estimated_bu : '') + '" placeholder="0" data-var-id="' + util.escHtml(v.id) + '"></td>' +
            '<td style="text-align:center"><input class="mkt-vi-contracted" type="checkbox"' + (v.is_contracted ? ' checked' : '') + ' data-var-id="' + util.escHtml(v.id) + '"></td>' +
            '<td><button class="btn-link text-danger mkt-del-variant" data-var-id="' + util.escHtml(v.id) + '">✕</button></td>' +
            '</tr>';
        });
        html += '<tr class="mkt-variant-add-row"><td colspan="5">' +
          '<button class="btn-link mkt-add-variant-btn" data-comm-id="' + util.escHtml(comm.id) + '" data-comm-name="' + util.escHtml(comm.name) + '">' +
            '+ Add variant for ' + util.escHtml(comm.name) +
          '</button></td></tr>';
      }
    });

    html += '</tbody></table>' +
      '<button class="btn-primary btn-sm" id="mkt-save-variants" style="margin-top:1rem">Save All Changes</button>';

    root.innerHTML = html;
    bindVariantSetup(root);
  }

  function bindVariantSetup(root) {
    root.querySelector('#mkt-sync-budget').addEventListener('click', function () {
      syncFromBudget(root);
    });

    root.querySelectorAll('.mkt-add-variant-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var commId = btn.getAttribute('data-comm-id');
        var commName = btn.getAttribute('data-comm-name');
        var name = prompt('Variant name for ' + commName + ':');
        if (!name || !name.trim()) return;
        api.post('/api/marketing/variants', { commodity_id: commId, name: name.trim() }).then(function (v) {
          variants.push(v);
          util.showToast('Variant added');
          renderVariants();
          bindVariantSetup(root);
        }).catch(function () { util.showToast('Failed to add variant', 'error'); });
      });
    });

    root.querySelectorAll('.mkt-del-variant').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-var-id');
        var v = variants.find(function (x) { return x.id === id; });
        if (!v) return;
        if (!confirm('Delete variant "' + v.name + '"?')) return;
        api.del('/api/marketing/variants/' + id).then(function () {
          variants = variants.filter(function (x) { return x.id !== id; });
          util.showToast('Variant deleted');
          renderVariants();
        }).catch(function () { util.showToast('Delete failed', 'error'); });
      });
    });

    var saveBtn = root.querySelector('#mkt-save-variants');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var patches = [];
        root.querySelectorAll('.mkt-vi-name').forEach(function (inp) {
          var id = inp.getAttribute('data-var-id');
          var buInp = root.querySelector('.mkt-vi-bu[data-var-id="' + id + '"]');
          var checkInp = root.querySelector('.mkt-vi-contracted[data-var-id="' + id + '"]');
          patches.push(api.put('/api/marketing/variants/' + id, {
            name: inp.value.trim(),
            estimated_bu: buInp && buInp.value !== '' ? Number(buInp.value) : null,
            is_contracted: checkInp ? checkInp.checked : false,
          }));
        });
        saveBtn.disabled = true;
        Promise.all(patches).then(function () {
          util.showToast('Variants saved');
          reload();
        }).catch(function () {
          util.showToast('Some saves failed', 'error');
          saveBtn.disabled = false;
        });
      });
    }
  }

  function syncFromBudget(root) {
    // Read enterprises from refData to get crop/acres data
    var ents = (window.refData && window.refData.enterprises) ? window.refData.enterprises : [];
    var buByCrop = {};
    ents.forEach(function (ent) {
      if (!ent.name) return;
      var key = ent.name.toLowerCase().trim();
      var acres = Number(ent.acres) || 0;
      buByCrop[key] = (buByCrop[key] || 0) + acres;
    });

    var tbody = root.querySelector('#mkt-variant-tbody');
    if (!tbody) return;
    var matched = 0;
    tbody.querySelectorAll('.mkt-vi-bu').forEach(function (inp) {
      if (inp.value !== '') return; // don't overwrite existing
      var id = inp.getAttribute('data-var-id');
      var v = variants.find(function (x) { return x.id === id; });
      if (!v) return;
      var vKey = v.name.toLowerCase();
      for (var cropKey in buByCrop) {
        if (vKey.includes(cropKey.split(' ')[0]) || cropKey.includes(vKey.split(' ')[0])) {
          inp.value = Math.round(buByCrop[cropKey]);
          matched++;
          break;
        }
      }
    });
    if (matched === 0) {
      util.showToast('No matches found — enter estimates manually', 'error');
    } else {
      util.showToast('Pre-filled ' + matched + ' variant(s) from budget data');
    }
  }

})();
