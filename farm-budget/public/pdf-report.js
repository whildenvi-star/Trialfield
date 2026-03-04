// PDF Report Generation using jsPDF + autoTable
(function () {
  'use strict';

  var GREEN = [45, 90, 39];
  var WHITE = [255, 255, 255];

  function addHeader(doc, title, landscape) {
    var w = landscape ? 297 : 210;
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.rect(0, 0, w, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(title, 10, 12);
    doc.setFontSize(8);
    doc.text(new Date().toLocaleDateString(), w - 10, 12, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  function addFooter(doc) {
    var pages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Macro Roll Up — Generated ' + new Date().toLocaleDateString(), 10,
        doc.internal.pageSize.height - 5);
      doc.text('Page ' + i + ' of ' + pages,
        doc.internal.pageSize.width - 10, doc.internal.pageSize.height - 5, { align: 'right' });
    }
  }

  function profitColor(val) {
    return val >= 0 ? [34, 120, 34] : [180, 40, 40];
  }

  function fmt(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: dec || 0,
      maximumFractionDigits: dec || 0
    });
  }

  function money(n, dec) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    var v = Number(n);
    var d = dec === undefined ? 2 : dec;
    var abs = Math.abs(v).toLocaleString('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
    return v < 0 ? '($' + abs + ')' : '$' + abs;
  }

  function parseMoneyVal(str) {
    if (!str || str === '--') return 0;
    return parseFloat(String(str).replace(/[$,]/g, '')) || 0;
  }

  // =============================================
  // DASHBOARD PDF
  // =============================================
  window.generateDashboardPDF = function () {
    api.get('/api/dashboard').then(function (data) {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var year = window.refData.settings.year || 2026;

      addHeader(doc, 'Macro Roll Up Dashboard — ' + year, true);
      var yPos = 24;

      // Conventional crops
      if (data.conventional.length) {
        doc.setFontSize(11);
        doc.text('Conventional', 10, yPos);
        yPos += 2;

        var convRows = [];
        data.conventional.forEach(function (entry) {
          entry.cropRows.forEach(function (r) {
            convRows.push([
              r.crop, fmt(r.acres, 1), fmt(r.avgYield, 1), fmt(r.projectedTotal, 0),
              money(r.avgMachinery), money(r.profitPerAcre), money(r.cop), r.unit
            ]);
          });
        });

        doc.autoTable({
          startY: yPos,
          head: [['Crop', 'Acres', 'Avg Yield', 'Proj Total', 'Mach/AC', 'Profit/AC', 'COP', 'Unit']],
          body: convRows,
          theme: 'striped',
          headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 1.5 },
          columnStyles: {
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }
          },
          didParseCell: function (hookData) {
            if (hookData.column.index === 5 && hookData.section === 'body') {
              var val = parseMoneyVal(convRows[hookData.row.index][5]);
              hookData.cell.styles.textColor = profitColor(val);
            }
          }
        });
        yPos = doc.lastAutoTable.finalY + 6;
      }

      // Organic crops
      if (data.organic.length) {
        doc.setFontSize(11);
        doc.text('Organic', 10, yPos);
        yPos += 2;

        var orgRows = [];
        data.organic.forEach(function (entry) {
          entry.cropRows.forEach(function (r) {
            orgRows.push([
              r.crop, fmt(r.acres, 1), fmt(r.avgYield, 1), fmt(r.projectedTotal, 0),
              money(r.avgMachinery), money(r.profitPerAcre), money(r.cop), r.unit
            ]);
          });
        });

        doc.autoTable({
          startY: yPos,
          head: [['Crop', 'Acres', 'Avg Yield', 'Proj Total', 'Mach/AC', 'Profit/AC', 'COP', 'Unit']],
          body: orgRows,
          theme: 'striped',
          headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 1.5 },
          columnStyles: {
            1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
            4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }
          },
          didParseCell: function (hookData) {
            if (hookData.column.index === 5 && hookData.section === 'body') {
              var val = parseMoneyVal(orgRows[hookData.row.index][5]);
              hookData.cell.styles.textColor = profitColor(val);
            }
          }
        });
        yPos = doc.lastAutoTable.finalY + 6;
      }

      // Cost category rollup
      doc.setFontSize(11);
      doc.text('Cost Category Rollup', 10, yPos);
      yPos += 2;

      var enterprises = data.enterpriseSummaries;
      var rollupHead = ['Category'];
      enterprises.forEach(function (es) { rollupHead.push(es.enterprise.shortName); });
      rollupHead.push('TOTAL');

      var categories = [
        { label: 'Acres', key: 'acres' },
        { label: 'Rent', key: 'rent' },
        { label: 'Fertilizer', key: 'fert' },
        { label: 'Seed', key: 'seed' },
        { label: 'Machinery', key: 'machinery' },
        { label: 'Labor + OH', key: 'laborOverhead' },
        { label: 'Fuel', key: 'fuel' },
        { label: 'Drying', key: 'drying' },
        { label: 'Interest', key: 'interest' },
        { label: 'Insurance', key: 'insurance' },
        { label: 'Total Expense', key: 'expTotal' },
        { label: 'Income + Pay', key: 'incomeWithPayments' },
        { label: 'Profit', key: 'profitWithPayments' }
      ];

      var rollupRows = categories.map(function (cat) {
        var row = [cat.label];
        var total = 0;
        enterprises.forEach(function (es) {
          var val = es.totals[cat.key] || 0;
          total += val;
          row.push(cat.key === 'acres' ? fmt(val, 1) : money(val, 0));
        });
        row.push(cat.key === 'acres' ? fmt(total, 1) : money(total, 0));
        return row;
      });

      doc.autoTable({
        startY: yPos,
        head: [rollupHead],
        body: rollupRows,
        theme: 'striped',
        headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: (function () {
          var cs = {};
          for (var i = 1; i <= enterprises.length + 1; i++) cs[i] = { halign: 'right' };
          return cs;
        })(),
        didParseCell: function (hookData) {
          if (hookData.section === 'body') {
            var rowIdx = hookData.row.index;
            if (categories[rowIdx] && categories[rowIdx].key === 'profitWithPayments' && hookData.column.index > 0) {
              var val = parseMoneyVal(hookData.cell.raw);
              hookData.cell.styles.textColor = profitColor(val);
              hookData.cell.styles.fontStyle = 'bold';
            }
            if (categories[rowIdx] && (categories[rowIdx].key === 'expTotal' || categories[rowIdx].key === 'profitWithPayments')) {
              hookData.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      addFooter(doc);
      doc.save('Farm_Dashboard_' + year + '.pdf');
      util.showToast('Dashboard PDF downloaded');
    });
  };

  // =============================================
  // ENTERPRISE PDF
  // =============================================
  window.generateEnterprisePDF = function (entId) {
    api.get('/api/fields?enterpriseId=' + entId).then(function (fields) {
      var ent = window.refData.enterprises.find(function (e) { return e.id === entId; });
      var entName = ent ? ent.name : 'Enterprise';
      var year = window.refData.settings.year || 2026;

      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      addHeader(doc, entName + ' — ' + year, true);

      // Summary bar
      var totalAcres = 0, totalExp = 0, totalProfit = 0;
      fields.forEach(function (f) {
        var b = f._computed || {};
        totalAcres += (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
        totalExp += b.expTotal || 0;
        totalProfit += b.profitFarmWithPayments || 0;
      });
      var avgExp = totalAcres > 0 ? totalExp / totalAcres : 0;
      var avgProfit = totalAcres > 0 ? totalProfit / totalAcres : 0;

      doc.setFontSize(9);
      doc.text(fields.length + ' fields  |  ' + fmt(totalAcres, 1) + ' acres  |  Avg Exp/AC: ' + money(avgExp) +
        '  |  Avg Profit/AC: ' + money(avgProfit) + '  |  Total Profit: ' + money(totalProfit, 0), 10, 24);

      // Field-by-field budget table
      var head = ['Budget Item'];
      fields.forEach(function (f) { head.push(f.name); });
      head.push('AVG/TOTAL');

      var budgetRows = [
        { label: 'Acres', key: 'effectiveAcres', dec: 1 },
        { label: 'Rent/AC', key: 'rentPerAcre' },
        { label: 'Fert/AC', key: 'totalFertPerAcre' },
        { label: 'Seed/AC', key: 'seedCostPerAcre' },
        { label: 'Mach/AC', key: 'machineryPerAcre' },
        { label: 'Labor/AC', key: 'laborPerAcre' },
        { label: 'OH/AC', key: 'overheadPerAcre' },
        { label: 'Fuel/AC', key: 'fuelPerAcre' },
        { label: 'Drying/AC', key: 'dryingPerAcre' },
        { label: 'Interest/AC', key: 'interestPerAcre' },
        { label: 'Ins/AC', key: 'cropInsurancePerAcre' },
        { label: 'EXP/AC', key: 'expPerAcre', bold: true },
        { label: 'EXP Total', key: 'expTotal', total: true },
        { label: 'Yield/AC', key: 'yieldPerAcre', dec: 1, noMoney: true },
        { label: 'Income/AC', key: 'cropIncomePerAcre' },
        { label: 'Profit/AC', key: 'profitPerAcre', profit: true, bold: true },
        { label: 'Profit w/Pay', key: 'profitFarmWithPayments', profit: true, total: true },
        { label: 'COP', key: 'cop' }
      ];

      var bodyRows = budgetRows.map(function (row) {
        var r = [row.label];
        var sumW = 0, sumA = 0, sumT = 0;
        fields.forEach(function (f) {
          var val;
          if (row.src === 'field') {
            val = f[row.key] || 0;
          } else {
            val = f._computed ? f._computed[row.key] || 0 : 0;
          }
          r.push(row.noMoney ? fmt(val, row.dec || 0) : money(val));
          var _ea = (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0;
          sumW += val * _ea;
          sumA += _ea;
          sumT += val;
        });
        if (row.total) {
          r.push(row.noMoney ? fmt(sumT, 0) : money(sumT, 0));
        } else {
          var avg = sumA > 0 ? sumW / sumA : 0;
          r.push(row.noMoney ? fmt(avg, row.dec || 0) : money(avg));
        }
        return r;
      });

      doc.autoTable({
        startY: 28,
        head: [head],
        body: bodyRows,
        theme: 'striped',
        headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 6, cellPadding: 1 },
        styles: { fontSize: 6, cellPadding: 1 },
        columnStyles: (function () {
          var cs = {};
          for (var i = 1; i <= fields.length + 1; i++) cs[i] = { halign: 'right' };
          return cs;
        })(),
        didParseCell: function (hookData) {
          if (hookData.section === 'body') {
            var rowDef = budgetRows[hookData.row.index];
            if (rowDef && rowDef.bold) {
              hookData.cell.styles.fontStyle = 'bold';
            }
            if (rowDef && rowDef.profit && hookData.column.index > 0) {
              var val = parseMoneyVal(hookData.cell.raw);
              hookData.cell.styles.textColor = profitColor(val);
            }
          }
        }
      });

      addFooter(doc);
      doc.save(entName.replace(/\s+/g, '_') + '_' + year + '.pdf');
      util.showToast(entName + ' PDF downloaded');
    });
  };

  // =============================================
  // PDF BUTTON BINDINGS
  // =============================================
  document.getElementById('dash-download-pdf').addEventListener('click', function () {
    window.generateDashboardPDF();
  });

  document.getElementById('ent-download-pdf').addEventListener('click', function () {
    var ent = window.refData.enterprises[window.getEnterpriseIdx()];
    if (ent) {
      window.generateEnterprisePDF(ent.id);
    } else {
      util.showToast('Select an enterprise first', 2000, 'error');
    }
  });
})();
