// Price source — answers "what $/bu is this field using, and why?"
//
// Two lines per field, both derived, never edited here:
//   1. Budget price: Calc.explainCropPrice — the number computeFieldBudget
//      actually used (CBOT ± basis / flat / contract) and where it lives.
//   2. Marketing: the pooled position for the crop's marketing variant — WAP
//      of current sales, % sold, pooled price for this variant, F-IT — from
//      the portal's enterprise rollup (same rows the dashboard widget shows).
//      Only reachable when MACRO runs inside the portal (same-origin under
//      /embed/), so standalone falls back to line 1 alone.
//
// Consumers: field-editor.js (Yield & Income) and field-strips.js (Sheet).
(function () {
  'use strict';

  var state = 'idle';       // idle | loading | ready
  var rollup = null;        // { rows, cropYear, isOwner } or null when unavailable
  var futures = [];         // /api/futures-config — labels the CBOT contract
  var readyCbs = [];

  function embedded() {
    return !!window.__BASE || document.body.classList.contains('in-iframe');
  }

  function load() {
    if (state !== 'idle') return;
    state = 'loading';
    var year = ((window.refData && window.refData.settings) || {}).year;
    var pF = api.get('/api/futures-config')
      .then(function (d) { futures = Array.isArray(d) ? d : []; })
      .catch(function () { futures = []; });
    var pR = Promise.resolve();
    if (embedded()) {
      // Absolute path on purpose: resolves to the portal root, not /embed/farm-budget/.
      pR = fetch('/marketing/position/data' + (year ? '?year=' + year : ''), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { rollup = d && Array.isArray(d.rows) ? d : null; })
        .catch(function () { rollup = null; });
    }
    Promise.all([pF, pR]).then(function () {
      state = 'ready';
      var cbs = readyCbs.slice();
      readyCbs = [];
      cbs.forEach(function (fn) { try { fn(); } catch (e) { console.error('[price-source]', e); } });
    });
  }

  // Registers a repaint callback. Does NOT start the fetch — the first
  // explain() does, after refData (and its settings.year) has loaded.
  function onReady(fn) {
    if (state === 'ready') { fn(); return; }
    readyCbs.push(fn);
  }

  // Marketing variant for a farm-budget crop line, via the rollup's crosswalk.
  function forCrop(crop) {
    if (!rollup) return null;
    var key = (crop || '').trim().toLowerCase();
    if (!key) return null;
    for (var i = 0; i < rollup.rows.length; i++) {
      var row = rollup.rows[i];
      var vs = row.variants || [];
      for (var j = 0; j < vs.length; j++) {
        var names = vs[j].budgetCropNames || [];
        for (var k = 0; k < names.length; k++) {
          if (String(names[k]).toLowerCase() === key) return { row: row, variant: vs[j] };
        }
      }
    }
    return null;
  }

  function m2(v) { return '$' + (Math.round(v * 100) / 100).toFixed(2); }
  function bu(v) { return Math.round(v).toLocaleString() + ' bu'; }
  function pct(v) { return Math.round(v * 100) + '%'; }

  // Marketing line. Office rows arrive without financial keys, so those
  // callers get volumes only ("45% sold") and never a price.
  function marketing(crop) {
    var hit = forCrop(crop);
    if (!hit) return null;
    var row = hit.row, v = hit.variant;
    var isOwner = !!rollup.isOwner;
    var sold = v.soldBu || 0;
    var proj = v.projectedBu;
    var parts = [];
    var short = '';

    if (sold > 0) {
      parts.push(v.pctSold != null ? pct(v.pctSold) + ' sold (' + bu(sold) + ')' : bu(sold) + ' sold');
    } else {
      parts.push(proj > 0 ? 'nothing sold of ' + bu(proj) + ' projected' : 'nothing sold');
    }

    var wap = isOwner && v.wapCents > 0 ? v.wapCents / 100 : null;
    var pooled = isOwner && v.pooledPriceCents != null ? v.pooledPriceCents / 100 : null;
    var fit = isOwner && v.blendedIfSoldTodayCents != null ? v.blendedIfSoldTodayCents / 100 : null;
    var poolWap = isOwner && row.poolWapCents != null ? row.poolWapCents / 100 : null;

    if (wap != null) parts.push('WAP of sales ' + m2(wap));
    if (pooled != null && (wap == null || Math.abs(pooled - wap) >= 0.005)) {
      parts.push('pooled ' + m2(pooled) + (v.premiumPerBu ? ' incl. ' + (v.premiumPerBu > 0 ? '+' : '') + m2(v.premiumPerBu) + ' premium' : ''));
    }
    if (fit != null) parts.push('F-IT ' + m2(fit));
    if (isOwner && row.cbotPriceDollars != null && wap == null && pooled == null) {
      parts.push('CBOT ' + (row.cbotContract ? row.cbotContract.replace(/\.CBT$/i, '') + ' ' : '') + m2(row.cbotPriceDollars));
    }

    if (wap != null) short = (v.pctSold != null ? pct(v.pctSold) + ' sold · ' : '') + 'WAP ' + m2(wap);
    else if (pooled != null) short = (v.pctSold != null ? pct(v.pctSold) + ' sold · ' : '') + 'pooled ' + m2(pooled);
    else short = parts[0];

    return {
      commodity: row.commodityName,
      variant: v.variantName,
      tier: row.tier,
      pctSold: v.pctSold,
      soldBu: sold,
      projectedBu: proj,
      wap: wap,
      pooled: pooled,
      poolWap: poolWap,
      fit: fit,
      text: row.commodityName + ' pool · ' + v.variantName + ': ' + parts.join(' · '),
      short: short
    };
  }

  // Full explanation for a field. `refs` is the same object the caller hands
  // to Calc.computeFieldBudget so the price agrees with the budget.
  function explain(field, refs) {
    if (state === 'idle') load();
    var src = Calc.explainCropPrice(field, refs, futures);
    var mkt = null;
    var mktText = '';
    if (rollup) {
      mkt = marketing(field.crop);
      if (mkt) mktText = mkt.text;
      else if (field.crop) mktText = 'Not tracked in marketing — "' + field.crop + '" has no crosswalk to a marketing variant';
    }
    return {
      price: src.price,
      source: src,
      sourceText: src.text,
      sourceShort: src.short,
      mkt: mkt,
      mktText: mktText,
      mktShort: mkt ? mkt.short : '',
      marketingAvailable: !!rollup
    };
  }

  window.PriceSource = { explain: explain, onReady: onReady, load: load, forCrop: forCrop };
})();
