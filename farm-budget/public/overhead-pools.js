// Overhead Pools + QuickBooks P&L import — lives on the Labor & Overhead
// reference sub-tab. Pools are annual dollars landed on fields by driver
// (calc.js computeOverheadRates); the P&L import feeds those dollars from
// the chart of accounts through a saved account → destination map.
(function () {
  'use strict';

  var pools = [];
  var rates = null;
  var imports = [];
  var accountMap = [];
  var parsed = null;      // { headers, numericCols, rows: [[cells]] }
  var loaded = false;

  var FIXED_DESTS = [
    { id: 'unmapped', label: '— unmapped —' },
    { id: 'direct',   label: 'A · Already in budget (per field)' },
    { id: 'fieldops', label: 'B · Field operations (calibrates implements)' },
    { id: 'exclude',  label: 'Exclude (not cost of production)' }
  ];

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'reference') loadAll();
  });
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.ref-sub-btn[data-ref-sub="labor"]');
    if (btn) btn.addEventListener('click', function () { if (!loaded) loadAll(); });
    bindStatic();
  });

  function loadAll() {
    return Promise.all([
      api.get('/api/overhead-pools'),
      api.get('/api/overhead-rates'),
      api.get('/api/pl-import'),
      api.get('/api/gl-account-map')
    ]).then(function (r) {
      pools = r[0] || [];
      rates = r[1] || null;
      imports = r[2] || [];
      accountMap = r[3] || [];
      loaded = true;
      renderPools();
      renderImportControls();
      renderAccounts();
    }).catch(function (err) {
      console.warn('[overhead-pools] load failed', err);
    });
  }

  // Refresh everything that depends on overhead: pools, rates, and the cached
  // refData so the Sheet / dashboard recompute with the new allocation.
  function refresh() {
    loaded = false;
    return loadAll().then(function () {
      if (window.reloadRefDataSelective) window.reloadRefDataSelective('overhead-pools,overhead-rates,settings');
    });
  }

  function money(v, d) { return util.formatMoney(v || 0, d === undefined ? 2 : d); }
  function esc(s) { return util.escHtml(s == null ? '' : String(s)); }
  function driverLabel(d) {
    var dr = rates && rates.drivers && rates.drivers[d];
    return dr ? dr.label : d;
  }
  function driverUnit(d) {
    var dr = rates && rates.drivers && rates.drivers[d];
    return dr ? dr.unit : '';
  }

  // === POOLS ===

  function renderPools() {
    var tbody = document.getElementById('ohp-tbody');
    if (!tbody) return;
    var totals = (rates && rates.totals) || {};
    var cropAcres = totals.acres || 0;
    var ratedById = {};
    ((rates && rates.pools) || []).forEach(function (p) { ratedById[p.id] = p; });
    var html = '';
    var sumDollars = 0;
    pools.forEach(function (p) {
      var rp = ratedById[p.id];
      var denom = totals[p.driver] || 0;
      var perUnit = rp ? rp.ratePerUnit : (denom > 0 ? (p.annualDollars || 0) / denom : 0);
      var avgAc = cropAcres > 0 ? (p.annualDollars || 0) / cropAcres : 0;
      sumDollars += p.annualDollars || 0;
      html += '<tr>' +
        '<td class="editable" data-id="' + p.id + '" data-field="name" data-kind="text">' + esc(p.name || '') + '</td>' +
        '<td class="editable" data-id="' + p.id + '" data-field="driver" data-kind="driver">' + esc(driverLabel(p.driver)) + '</td>' +
        '<td class="editable number" data-id="' + p.id + '" data-field="annualDollars" data-kind="num">' + money(p.annualDollars, 0) + '</td>' +
        '<td class="number">' + util.formatNum(denom, 0) + ' <span style="color:var(--text-light);font-size:0.75rem">' + esc(driverUnit(p.driver)) + '</span></td>' +
        '<td class="number">' + money(perUnit, 2) + '</td>' +
        '<td class="number bold">' + money(avgAc, 2) + '</td>' +
        '<td class="editable number" data-id="' + p.id + '" data-field="sourceYear" data-kind="int">' + (p.sourceYear || '--') + '</td>' +
        '<td class="editable" data-id="' + p.id + '" data-field="note" data-kind="text" style="max-width:260px;white-space:normal;font-size:0.8rem">' + esc(p.note || '') + '</td>' +
        '<td><button class="btn-sm" data-del="' + p.id + '" title="Delete pool">×</button></td>' +
        '</tr>';
    });
    if (pools.length) {
      html += '<tr class="bold"><td>All pools</td><td></td><td class="number">' + money(sumDollars, 0) + '</td><td></td><td></td>' +
        '<td class="number">' + money(cropAcres > 0 ? sumDollars / cropAcres : 0, 2) + '</td><td></td><td></td><td></td></tr>';
    }
    tbody.innerHTML = html || '<tr><td colspan="9" style="color:var(--text-light)">No pools yet. Add one per cost group: machinery ownership (pass-acres), irrigation (irrigated acres), general farm (crop acres).</td></tr>';

    var count = document.getElementById('ohp-count');
    if (count) {
      var active = rates && rates.active;
      count.textContent = pools.length + ' pool' + (pools.length !== 1 ? 's' : '') +
        (active ? ' — allocating' : ' — flat Overhead/AC in use') +
        (totals.passAcres ? ' · farm: ' + util.formatNum(totals.acres, 0) + ' ac, ' + util.formatNum(totals.passAcres, 0) + ' pass-ac, ' + util.formatNum(totals.irrAcres, 0) + ' irr ac, ' + util.formatNum(totals.orgAcres, 0) + ' org ac' : '');
    }
    var use = document.getElementById('ohp-use');
    if (use) use.checked = !rates || rates.useOverheadPools !== false;

    var stackEl = document.getElementById('ohp-stack');
    if (stackEl && rates && rates.budgetStack) {
      var st = rates.budgetStack;
      var nonDirect = st.overhead + st.machinery + st.labor + st.fuel;
      stackEl.innerHTML = 'Budget stack now: overhead ' + money(st.overhead, 0) +
        (rates.active ? ' (flat would be ' + money(st.flatOverhead, 0) + ')' : '') +
        ' · machinery ' + money(st.machinery, 0) + ' · labor ' + money(st.labor, 0) + ' · fuel ' + money(st.fuel, 0) +
        ' = <b>' + money(nonDirect, 0) + '</b> on ' + util.formatNum(st.acres, 0) + ' ac (' + money(st.acres > 0 ? nonDirect / st.acres : 0, 0) + '/ac). This is the figure the P&amp;L B + C destinations should reconcile to.';
    }

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () { editPoolCell(td); });
    });
    tbody.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this pool? Accounts mapped to it become unmapped.')) return;
        var id = btn.getAttribute('data-del');
        api.del('/api/overhead-pools/' + id).then(function () {
          var fixes = accountMap.filter(function (m) { return m.destination === id; })
            .map(function (m) { return api.put('/api/gl-account-map/' + m.id, { destination: 'unmapped' }); });
          return Promise.all(fixes);
        }).then(function () { util.showToast('Pool deleted'); refresh(); });
      });
    });
  }

  function editPoolCell(td) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var kind = td.getAttribute('data-kind');
    var pool = pools.find(function (p) { return p.id === id; });
    if (!pool) return;
    td.classList.add('editing');
    var input;
    if (kind === 'driver') {
      input = document.createElement('select');
      var drivers = (rates && rates.drivers) || {};
      Object.keys(drivers).forEach(function (k) {
        var o = document.createElement('option');
        o.value = k; o.textContent = drivers[k].label;
        if (k === pool.driver) o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = (kind === 'num' || kind === 'int') ? 'number' : 'text';
      if (kind === 'num') input.step = '0.01';
      input.value = kind === 'text' ? (pool[field] || '') : (pool[field] || '');
    }
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    if (input.select) input.select();
    var done = false;
    function save() {
      if (done) return; done = true;
      var data = {};
      if (kind === 'num') data[field] = parseFloat(input.value) || 0;
      else if (kind === 'int') data[field] = parseInt(input.value, 10) || null;
      else data[field] = input.value;
      api.put('/api/overhead-pools/' + id, data).then(refresh);
    }
    input.addEventListener('blur', save);
    input.addEventListener('change', function () { if (kind === 'driver') save(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { done = true; renderPools(); }
    });
  }

  // === P&L IMPORT ===

  // RFC-ish CSV parser: quoted fields, embedded commas, CRLF.
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }

  function toNumber(s) {
    if (s == null) return NaN;
    var t = String(s).trim().replace(/[$,\s]/g, '');
    if (!t) return NaN;
    var neg = /^\(.*\)$/.test(t);
    t = t.replace(/[()]/g, '');
    var n = parseFloat(t);
    return isNaN(n) ? NaN : (neg ? -n : n);
  }

  // QuickBooks P&L exports carry section headers (Income, Expenses), subtotal
  // rows (Total Fuel, Gross Profit, Net Income) and indented sub-accounts.
  // Keep leaf rows with a label and a number; drop totals and headers.
  var SKIP_LABEL = /^(total\b|gross profit|net (operating )?income|net other income|income$|expenses?$|cost of goods sold$|other (income|expenses?)$|ordinary income\/expenses?)/i;

  function analyse(rows) {
    var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    var numericCols = [];
    for (var c = 1; c < width; c++) {
      var hits = 0, seen = 0;
      rows.forEach(function (r) {
        if (r[c] && r[c].trim()) { seen++; if (!isNaN(toNumber(r[c]))) hits++; }
      });
      if (seen && hits / seen > 0.6) numericCols.push(c);
    }
    // Header = first row whose numeric cols are non-numeric text
    var headerRow = rows.find(function (r) {
      return numericCols.length && numericCols.every(function (c) { return r[c] && isNaN(toNumber(r[c])); });
    }) || [];
    return { rows: rows, numericCols: numericCols, headers: headerRow };
  }

  function extract(col) {
    var out = [];
    parsed.rows.forEach(function (r) {
      var label = (r[0] || '').trim();
      if (!label && r[1] && isNaN(toNumber(r[1]))) label = r[1].trim(); // some exports put labels in col 2
      if (!label || SKIP_LABEL.test(label)) return;
      var amt = toNumber(r[col]);
      if (isNaN(amt)) return;
      out.push({ account: label.replace(/\s+/g, ' '), amount: amt });
    });
    return out;
  }

  function renderImportControls() {
    var view = document.getElementById('pl-view');
    if (!view) return;
    var cur = view.value;
    view.innerHTML = imports.length
      ? imports.slice().reverse().map(function (im) { return '<option value="' + im.year + '">' + im.year + ' (' + im.rows.length + ' accounts)</option>'; }).join('')
      : '<option value="">no imports yet</option>';
    if (cur && imports.some(function (im) { return String(im.year) === cur; })) view.value = cur;
    var apply = document.getElementById('pl-apply');
    if (apply) apply.disabled = !imports.length || !pools.length;
  }

  function currentImport() {
    var view = document.getElementById('pl-view');
    var yr = view ? parseInt(view.value, 10) : NaN;
    return imports.find(function (im) { return im.year === yr; }) || null;
  }

  function destOptions(selected) {
    var opts = FIXED_DESTS.map(function (d) { return { id: d.id, label: d.label }; });
    pools.forEach(function (p) { opts.push({ id: p.id, label: 'C · ' + (p.name || 'pool') + ' → ' + driverLabel(p.driver) }); });
    return opts.map(function (o) {
      return '<option value="' + o.id + '"' + (o.id === selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
    }).join('');
  }

  function renderAccounts() {
    var tbody = document.getElementById('pl-tbody');
    var summary = document.getElementById('pl-summary');
    if (!tbody) return;
    var im = currentImport();
    if (!im) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-light)">Import a P&amp;L to start mapping accounts.</td></tr>';
      if (summary) summary.innerHTML = '';
      return;
    }
    var mapByAcct = {};
    accountMap.forEach(function (m) { mapByAcct[m.account.toLowerCase()] = m; });
    var sums = {}; var labels = {};
    FIXED_DESTS.forEach(function (d) { labels[d.id] = d.label; });
    pools.forEach(function (p) { labels[p.id] = 'C · ' + (p.name || 'pool'); });
    var html = '';
    im.rows.forEach(function (r) {
      var m = mapByAcct[r.account.toLowerCase()];
      var dest = m ? m.destination : 'unmapped';
      if (!labels[dest]) dest = 'unmapped';
      sums[dest] = (sums[dest] || 0) + r.amount;
      html += '<tr' + (dest === 'unmapped' ? ' style="background:var(--highlight)"' : '') + '>' +
        '<td>' + esc(r.account) + '</td>' +
        '<td class="number">' + money(r.amount, 0) + '</td>' +
        '<td><select data-map="' + (m ? m.id : '') + '" data-account="' + esc(r.account) + '" style="max-width:340px">' + destOptions(dest) + '</select></td>' +
        '</tr>';
    });
    tbody.innerHTML = html;
    tbody.querySelectorAll('select[data-map]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var id = sel.getAttribute('data-map');
        var p = id ? api.put('/api/gl-account-map/' + id, { destination: sel.value })
                   : api.post('/api/gl-account-map', { account: sel.getAttribute('data-account'), destination: sel.value });
        p.then(function () { return api.get('/api/gl-account-map'); }).then(function (m) { accountMap = m; renderAccounts(); });
      });
    });

    // Summary by destination + reconciliation against the budget stack
    if (summary) {
      var order = ['direct', 'fieldops'].concat(pools.map(function (p) { return p.id; })).concat(['exclude', 'unmapped']);
      var s = '<table><thead><tr><th>Destination · ' + im.year + '</th><th>P&amp;L $</th><th>Now in pool</th></tr></thead><tbody>';
      var bc = 0;
      order.forEach(function (d) {
        var amt = sums[d] || 0;
        var pool = pools.find(function (p) { return p.id === d; });
        if (d === 'fieldops' || pool) bc += amt;
        s += '<tr' + (d === 'unmapped' && amt ? ' class="bold"' : '') + '><td>' + esc(labels[d]) + '</td><td class="number">' + money(amt, 0) + '</td>' +
          '<td class="number">' + (pool ? money(pool.annualDollars, 0) + (pool.sourceYear ? ' <span style="color:var(--text-light);font-size:0.75rem">' + pool.sourceYear + '</span>' : '') : '') + '</td></tr>';
      });
      var st = rates && rates.budgetStack;
      if (st) {
        var budget = st.overhead + st.machinery + st.labor + st.fuel;
        var diff = budget - bc;
        s += '<tr class="bold"><td>B + C on the books (' + im.year + ')</td><td class="number">' + money(bc, 0) + '</td><td></td></tr>' +
          '<tr class="bold"><td>Budget stack (overhead + machinery + labor + fuel)</td><td class="number">' + money(budget, 0) + '</td><td></td></tr>' +
          '<tr><td>Difference ÷ ' + util.formatNum(st.acres, 0) + ' ac</td><td class="number ' + (Math.abs(diff) > budget * 0.1 ? 'profit-neg' : '') + '">' + money(diff, 0) + ' → ' + money(st.acres > 0 ? diff / st.acres : 0, 0) + '/ac</td><td></td></tr>';
      }
      s += '</tbody></table>';
      summary.innerHTML = s;
    }
  }

  function bindStatic() {
    var file = document.getElementById('pl-file');
    var col = document.getElementById('pl-col');
    var yearIn = document.getElementById('pl-year');
    var importBtn = document.getElementById('pl-import');
    var preview = document.getElementById('pl-preview');
    var view = document.getElementById('pl-view');
    var apply = document.getElementById('pl-apply');
    var add = document.getElementById('ohp-add');
    var use = document.getElementById('ohp-use');
    if (!file) return;

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        parsed = analyse(parseCsv(String(fr.result)));
        col.innerHTML = parsed.numericCols.map(function (c) {
          var h = (parsed.headers[c] || ('column ' + (c + 1))).trim();
          return '<option value="' + c + '">' + esc(h) + '</option>';
        }).join('');
        col.style.display = parsed.numericCols.length > 1 ? '' : 'none';
        if (parsed.numericCols.length) col.value = parsed.numericCols[parsed.numericCols.length - 1];
        // Guess the year from the chosen header, e.g. "Jan - Dec 2025"
        var guess = ((parsed.headers[col.value] || '') + ' ' + f.name).match(/20\d{2}/);
        if (guess && !yearIn.value) yearIn.value = guess[0];
        showPreview();
      };
      fr.readAsText(f);
    });
    col.addEventListener('change', function () {
      var guess = (parsed.headers[col.value] || '').match(/20\d{2}/);
      if (guess) yearIn.value = guess[0];
      showPreview();
    });
    function showPreview() {
      if (!parsed || !parsed.numericCols.length) {
        preview.textContent = 'No numeric column found in that file.';
        importBtn.disabled = true;
        return;
      }
      var rows = extract(parseInt(col.value, 10));
      var total = rows.reduce(function (a, r) { return a + r.amount; }, 0);
      preview.textContent = rows.length + ' account rows found, ' + money(total, 0) + ' total (subtotal and header rows dropped).';
      importBtn.disabled = !rows.length;
    }
    importBtn.addEventListener('click', function () {
      var year = parseInt(yearIn.value, 10);
      if (!year) { util.showToast('Enter the P&L year first'); return; }
      var rows = extract(parseInt(col.value, 10));
      importBtn.disabled = true;
      api.post('/api/pl-import', { year: year, rows: rows }).then(function (r) {
        util.showToast('Imported ' + r.rows + ' accounts for ' + r.year + (r.newAccounts ? ' (' + r.newAccounts + ' new to map)' : ''));
        file.value = '';
        parsed = null;
        preview.textContent = '';
        return refresh();
      }).then(function () {
        if (view) { view.value = String(year); renderAccounts(); }
      }).catch(function (e) { util.showToast('Import failed: ' + e.message); importBtn.disabled = false; });
    });
    view.addEventListener('change', renderAccounts);
    apply.addEventListener('click', function () {
      var im = currentImport();
      if (!im) return;
      if (!confirm('Set each pool\'s Annual $ to its mapped ' + im.year + ' total?')) return;
      api.post('/api/overhead-pools/apply-import', { year: im.year }).then(function (r) {
        util.showToast('Applied to ' + r.applied.length + ' pool' + (r.applied.length !== 1 ? 's' : ''));
        return refresh();
      });
    });
    add.addEventListener('click', function () {
      var name = prompt('Pool name (e.g. Machinery ownership, Irrigation, General farm):');
      if (!name) return;
      api.post('/api/overhead-pools', { name: name.trim(), driver: 'acres', annualDollars: 0, sourceYear: null, note: '' })
        .then(function () { util.showToast('Pool added — double-click Driver to change it'); return refresh(); });
    });
    use.addEventListener('change', function () {
      api.put('/api/settings', { useOverheadPools: use.checked }).then(refresh);
    });
  }
})();
