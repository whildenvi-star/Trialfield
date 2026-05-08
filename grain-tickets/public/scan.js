// Ticket scanning via camera + Claude Vision OCR
(function () {
  'use strict';

  var scanBtn = document.getElementById('scan-btn');
  var scanInput = document.getElementById('scan-input');
  var scanStatus = document.getElementById('scan-status');

  if (!scanBtn || !scanInput) return;

  scanBtn.addEventListener('click', function () {
    scanInput.click();
  });

  scanInput.addEventListener('change', function () {
    var file = scanInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      showStatus('Please select an image or PDF file.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showStatus('Image too large. Please use a smaller photo.', 'error');
      return;
    }

    uploadAndScan(file);
  });

  function uploadAndScan(file) {
    scanBtn.disabled = true;
    showStatus('Scanning ticket... this may take a few seconds.', 'loading');

    var formData = new FormData();
    formData.append('image', file);

    fetch('/api/scan', {
      method: 'POST',
      body: formData
    })
    .then(function (res) {
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.error || 'Scan failed');
        });
      }
      return res.json();
    })
    .then(function (data) {
      fillForm(data);
      var filled = Object.keys(data).filter(function (k) {
        return data[k] !== null && data[k] !== undefined && data[k] !== '';
      }).length;
      showStatus('Scanned! Filled ' + filled + ' fields. Please review and correct if needed.', 'success');
    })
    .catch(function (err) {
      showStatus('Scan error: ' + err.message, 'error');
    })
    .finally(function () {
      scanBtn.disabled = false;
      scanInput.value = '';
    });
  }

  function fillForm(data) {
    var fieldMap = {
      ticketNo: 'entry-ticketNo',
      netWeight: 'entry-netWeight',
      moisture: 'entry-moisture',
      fm: 'entry-fm',
      date: 'entry-date',
      farm: 'entry-farm',
      crop: 'entry-crop',
      notes: 'entry-notes'
    };

    Object.keys(fieldMap).forEach(function (key) {
      if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
        var el = document.getElementById(fieldMap[key]);
        if (!el) return;

        // For select elements, check if the scanned value matches an option
        if (el.tagName === 'SELECT') {
          var matched = false;
          for (var i = 0; i < el.options.length; i++) {
            if (el.options[i].value.toLowerCase() === String(data[key]).toLowerCase()) {
              el.value = el.options[i].value;
              matched = true;
              break;
            }
          }
          if (!matched) {
            // Add a temporary option so the user can see what was scanned
            var tmp = document.createElement('option');
            tmp.value = '__scanned__';
            tmp.textContent = data[key] + ' (scanned — please select correct option)';
            tmp.style.color = '#b45309';
            el.insertBefore(tmp, el.options[1]);
            el.value = '__scanned__';
            el.style.borderColor = '#f59e0b';
            el.addEventListener('change', function handler() {
              if (el.value !== '__scanned__' && tmp.parentNode) {
                tmp.parentNode.removeChild(tmp);
                el.style.borderColor = '';
              }
              el.removeEventListener('change', handler);
            });
          }
        } else {
          el.value = data[key];
        }

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function showStatus(msg, type) {
    scanStatus.textContent = msg;
    scanStatus.className = 'scan-status ' + type;
  }

})();
