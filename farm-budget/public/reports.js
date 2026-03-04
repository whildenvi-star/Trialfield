// Reports — print-optimized HTML reports for procurement pipeline
// Phase 19 Wave 1: shell placeholder — report implementations in Wave 2
(function () {
  'use strict';

  var PRINT_CSS = [
    'body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; margin: 0; }',
    'table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }',
    'th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }',
    'th { background: #f0f0f0; font-weight: bold; }',
    'h1 { font-size: 14pt; margin-bottom: 0.25rem; }',
    'h2 { font-size: 12pt; page-break-before: always; margin-top: 1.5rem; }',
    'h2:first-of-type { page-break-before: avoid; }',
    '.report-meta { color: #666; font-size: 9pt; margin-bottom: 1rem; }',
    'tr { page-break-inside: avoid; }',
    'thead { display: table-header-group; }',
    'tfoot { display: table-footer-group; }',
    '.no-print { display: none; }',
    '@page { margin: 1in; size: letter; }'
  ].join('\n');

  // Utility: open a new window and write print-ready HTML
  window.printReport = function (title, bodyHtml) {
    var win = window.open('', '_blank');
    if (!win) {
      if (window.util && util.showToast) util.showToast('Enable popups to print reports', 4000, 'error');
      return;
    }
    win.document.write(
      '<!DOCTYPE html><html><head>' +
      '<title>' + (util ? util.escHtml(title) : title) + '</title>' +
      '<style>' + PRINT_CSS + '</style>' +
      '</head><body>' + bodyHtml + '</body></html>'
    );
    win.document.close();
    win.focus();
    win.print();
  };

  // Wire up print menu button on Forecasts tab (populated by inventory.js in Wave 2)
  window.addEventListener('tab-activate', function (e) {
    if (e.detail.tab !== 'forecasts') return;
    var btn = document.getElementById('fc-print-menu');
    if (!btn || btn._reportsBound) return;
    btn._reportsBound = true;
    btn.addEventListener('click', function (evt) {
      evt.stopPropagation();
      // Wave 2: dropdown with all 5 report types
      // For now, print a placeholder summary
      printReport('Forecast Summary', '<h1>Forecast Summary</h1><p class="report-meta">Generated: ' + new Date().toLocaleDateString() + '</p><p>Full report available in Phase 19 Wave 2.</p>');
    });
  });
})();
