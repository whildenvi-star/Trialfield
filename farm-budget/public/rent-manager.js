// Rent Manager — CRUD for land parcels
(function () {
  'use strict';

  var allRent = [];
  var loaded = false;

  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab === 'rent' && !loaded) loadRent();
  });

  function loadRent() {
    api.get('/api/rent').then(function (data) {
      allRent = data;
      renderTable(data);
      loaded = true;
    });
  }

  document.getElementById('rent-search').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = allRent.filter(function (r) {
      return (r.fieldName || '').toLowerCase().includes(q);
    });
    renderTable(filtered);
  });

  document.getElementById('rent-add').addEventListener('click', function () {
    api.post('/api/rent', {
      fieldName: 'New Field',
      acres: 0,
      active: true,
      rentRate: 0,
      totalRent: 0
    }).then(function () {
      loaded = false;
      loadRent();
      util.showToast('Parcel added');
    });
  });

  function getLandlordName(id) {
    if (!id) return '--';
    var suppliers = window.refData.suppliers || [];
    var sup = suppliers.find(function (s) { return s.id === id; });
    return sup ? sup.name : '--';
  }

  function renderTable(items) {
    var tbody = document.getElementById('rent-tbody');
    var html = '';
    var totalAcres = 0;
    var totalRent = 0;
    items.forEach(function (r) {
      totalAcres += r.acres || 0;
      totalRent += r.totalRent || (r.acres * r.rentRate) || 0;
      var landlordName = getLandlordName(r.landlordId);
      html += '<tr>' +
        '<td class="editable" data-id="' + r.id + '" data-field="fieldName">' + util.escHtml(r.fieldName) + '</td>' +
        '<td class="landlord-cell" data-id="' + r.id + '" data-landlord-id="' + (r.landlordId || '') + '" style="cursor:pointer">' + util.escHtml(landlordName) + '</td>' +
        '<td class="editable number" data-id="' + r.id + '" data-field="acres">' + util.formatNum(r.acres, 2) + '</td>' +
        '<td class="active-toggle" data-id="' + r.id + '" data-active="' + (r.active !== false) + '">' +
          '<span class="status-badge ' + (r.active !== false ? 'status-done' : 'status-open') + '">' +
          (r.active !== false ? 'Active' : 'Inactive') + '</span></td>' +
        '<td class="editable number" data-id="' + r.id + '" data-field="rentRate">' + util.formatMoney(r.rentRate) + '</td>' +
        '<td class="number">' + util.formatMoney(r.totalRent || (r.acres * r.rentRate)) + '</td>' +
        '<td><button class="btn-danger" data-del-id="' + r.id + '">Del</button></td>' +
        '</tr>';
    });
    html += '<tr class="total-row"><td>TOTAL</td>' +
      '<td></td>' +
      '<td class="number">' + util.formatNum(totalAcres, 1) + '</td>' +
      '<td></td><td></td>' +
      '<td class="number">' + util.formatMoney(totalRent, 0) + '</td>' +
      '<td></td></tr>';
    tbody.innerHTML = html;

    tbody.querySelectorAll('td.editable').forEach(function (td) {
      td.addEventListener('dblclick', function () { startEdit(td); });
    });

    tbody.querySelectorAll('[data-del-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Delete this parcel?')) return;
        api.del('/api/rent/' + btn.getAttribute('data-del-id')).then(function () {
          loaded = false;
          loadRent();
          util.showToast('Parcel deleted');
        });
      });
    });

    tbody.querySelectorAll('.active-toggle').forEach(function (td) {
      td.addEventListener('click', function () {
        var id = td.getAttribute('data-id');
        var currentlyActive = td.getAttribute('data-active') === 'true';
        api.put('/api/rent/' + id, { active: !currentlyActive }).then(function () {
          loaded = false;
          loadRent();
          util.showToast(currentlyActive ? 'Parcel deactivated' : 'Parcel activated');
        });
      });
    });

    // Landlord select
    tbody.querySelectorAll('.landlord-cell').forEach(function (td) {
      td.addEventListener('dblclick', function () {
        if (td.classList.contains('editing')) return;
        td.classList.add('editing');
        var id = td.getAttribute('data-id');
        var currentVal = td.getAttribute('data-landlord-id') || '';
        var suppliers = (window.refData.suppliers || []).filter(function (s) { return s.type === 'landlord'; });

        var select = document.createElement('select');
        select.style.width = '140px';
        select.innerHTML = '<option value="">— none —</option>';
        suppliers.forEach(function (s) {
          var opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          if (s.id === currentVal) opt.selected = true;
          select.appendChild(opt);
        });
        var addOpt = document.createElement('option');
        addOpt.value = '__add__';
        addOpt.textContent = '+ Add New';
        select.appendChild(addOpt);

        td.textContent = '';
        td.appendChild(select);
        select.focus();

        function save() {
          var val = select.value;
          if (val === '__add__') {
            var name = prompt('New landlord name:');
            if (!name) { loaded = false; loadRent(); return; }
            api.post('/api/suppliers', { name: name, type: 'landlord', contact: '', notes: '' }).then(function (newSup) {
              return api.put('/api/rent/' + id, { landlordId: newSup.id });
            }).then(function () {
              window.reloadRefData().then(function () { loaded = false; loadRent(); });
              util.showToast('Landlord created & assigned');
            });
            return;
          }
          api.put('/api/rent/' + id, { landlordId: val }).then(function () {
            loaded = false;
            loadRent();
          });
        }

        select.addEventListener('change', save);
        select.addEventListener('blur', function () {
          if (select.parentNode === td) { loaded = false; loadRent(); }
        });
      });
    });

    document.getElementById('rent-count').textContent = items.length + ' parcels';
  }

  function startEdit(td) {
    if (td.classList.contains('editing')) return;
    var id = td.getAttribute('data-id');
    var field = td.getAttribute('data-field');
    var oldVal = td.textContent.replace(/[$,]/g, '').trim();

    td.classList.add('editing');
    var input = document.createElement('input');
    var isNum = (field === 'acres' || field === 'rentRate');
    input.type = isNum ? 'number' : 'text';
    if (isNum) input.step = '0.01';
    input.value = oldVal;
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function save() {
      var data = {};
      data[field] = isNum ? (parseFloat(input.value) || 0) : input.value;
      api.put('/api/rent/' + id, data).then(function () {
        loaded = false;
        loadRent();
      });
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { loaded = false; loadRent(); }
    });
  }
})();
