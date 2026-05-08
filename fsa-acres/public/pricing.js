/* pricing.js — Price table, inline edit, add/delete */
(function () {
  'use strict';

  var prices = [];

  document.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'pricing') load();
  });

  function load() {
    api.get('/api/pricing').then(function (data) {
      prices = data;
      render();
    });
  }

  function render() {
    util.$('pricing-info').textContent = prices.length + ' crops';

    var html = '';
    prices.forEach(function (p) {
      var highest = Math.max(p.springPrice || 0, p.fallPrice || 0);
      html += '<tr>' +
        '<td class="editable" data-id="' + p.id + '" data-field="crop">' + util.esc(p.crop) + '</td>' +
        '<td class="number editable" data-id="' + p.id + '" data-field="springPrice">' + util.comma(p.springPrice) + '</td>' +
        '<td class="number editable" data-id="' + p.id + '" data-field="fallPrice">' + util.comma(p.fallPrice) + '</td>' +
        '<td class="number bold">' + util.comma(highest) + '</td>' +
        '<td><input type="checkbox" class="override-cb" data-id="' + p.id + '"' + (p.manualOverride ? ' checked' : '') + '></td>' +
        '<td><button class="btn-danger price-del" data-id="' + p.id + '">Del</button></td>' +
        '</tr>';
    });
    util.$('pricing-tbody').innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    // Inline edit
    util.$('pricing-tbody').querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        startEdit(td);
      });
    });

    // Override checkbox
    util.$('pricing-tbody').querySelectorAll('.override-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = this.getAttribute('data-id');
        api.put('/api/pricing/' + id, { manualOverride: this.checked }).then(function () {
          showToast('Override ' + (cb.checked ? 'on' : 'off'));
        });
      });
    });

    // Delete
    util.$('pricing-tbody').querySelectorAll('.price-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this price entry?')) return;
        api.del('/api/pricing/' + this.getAttribute('data-id')).then(function () {
          showToast('Deleted');
          load();
        });
      });
    });
  }

  function startEdit(td) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var currentVal = td.textContent.trim().replace(/,/g, '');

    td.classList.add('editing');
    var input = document.createElement('input');
    input.type = (field === 'springPrice' || field === 'fallPrice') ? 'number' : 'text';
    if (input.type === 'number') input.step = '0.01';
    input.value = currentVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var newVal = input.value;
      td.classList.remove('editing');
      var update = {};
      if (field === 'springPrice' || field === 'fallPrice') {
        update[field] = Number(newVal) || 0;
        td.textContent = util.comma(update[field]);
      } else {
        update[field] = newVal;
        td.textContent = newVal;
      }

      api.put('/api/pricing/' + id, update).then(function () {
        showToast('Saved');
        load(); // refresh to update highest
      }).catch(function () {
        showToast('Save failed', 'error');
        td.textContent = currentVal;
      });
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { td.classList.remove('editing'); td.textContent = currentVal; }
    });
  }

  // Scrape USDA RMA prices
  util.$('pricing-scrape-btn').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Fetching...';
    api.post('/api/pricing/scrape', {}).then(function (result) {
      btn.disabled = false;
      btn.textContent = 'Fetch USDA Prices';
      if (result.ok) {
        showToast(result.message);
      } else {
        showToast(result.message || 'Scrape failed', 'error');
      }
      load();
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = 'Fetch USDA Prices';
      showToast('Scrape failed — check server logs', 'error');
    });
  });

  // Add crop
  util.$('pricing-add-btn').addEventListener('click', function () {
    var crop = prompt('Crop name:');
    if (!crop) return;
    api.post('/api/pricing', { crop: crop, springPrice: 0, fallPrice: 0, manualOverride: false }).then(function () {
      showToast('Added');
      load();
    });
  });

})();
