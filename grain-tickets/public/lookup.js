// Ticket lookup by number
(function () {
  'use strict';

  var input = document.getElementById('lookup-input');
  var btn = document.getElementById('lookup-btn');
  var results = document.getElementById('lookup-results');

  function doSearch() {
    var q = input.value.trim();
    if (!q) return;

    api.get('/api/tickets/search?ticketNo=' + encodeURIComponent(q)).then(function (tickets) {
      if (!tickets.length) {
        results.innerHTML = '<p class="no-results">No tickets found for "' + q + '"</p>';
        return;
      }

      var html = '';
      tickets.forEach(function (t) {
        var c = t._computed || {};
        html += '<div class="ticket-card">';
        html += '<h3>Ticket ' + (t.ticketNo || '') + '</h3>';
        html += '<div class="detail-grid">';
        html += item('Date', t.date);
        html += item('Farm', (t.farm || '').trim());
        html += item('Crop', (t.crop || '').trim());
        html += item('Net Weight', util.formatNum(t.netWeight, 0) + ' lbs');
        html += item('Moisture', util.formatNum(t.moisture, 1) + '%');
        html += item('FM', util.formatNum(t.fm, 2));
        html += item('Notes', t.notes || '--');
        html += item('Test Weight', util.formatNum(c.testWeight, 0));
        html += item('Moisture Shrink', util.formatNum(c.moistureShrink, 0) + '%');
        html += item('Discount', util.formatNum(c.discount, 2));
        html += item('FM Discount Factor', util.formatNum(c.fmDiscountFactor, 4));
        html += item('Gross BU', util.formatNum(c.grossBU, 2));
        html += item('Net BU If Sold', '<strong>' + util.formatNum(c.netBU, 2) + '</strong>');
        html += '</div>';
        html += '</div>';
      });
      results.innerHTML = html;
    });
  }

  function item(label, value) {
    return '<div class="item"><span class="label">' + label + '</span><span class="value">' + (value || '--') + '</span></div>';
  }

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch();
  });

})();
