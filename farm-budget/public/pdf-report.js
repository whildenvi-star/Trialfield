// PDF Report Generation using jsPDF + autoTable
(function () {
  'use strict';

  var GREEN = [45, 90, 39];
  var WHITE = [255, 255, 255];

  function addHeader(doc, title, landscape, subtitle) {
    var w = landscape ? 297 : 210;
    doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
    doc.rect(0, 0, w, subtitle ? 22 : 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(title, w / 2, subtitle ? 10 : 12, { align: 'center' });
    if (subtitle) {
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(subtitle, w / 2, 18, { align: 'center' });
    }
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(new Date().toLocaleDateString(), w - 10, 8, { align: 'right' });
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
      var pageW = 297;
      var DARK = [30, 30, 30];
      var GRAY_LINE = [180, 180, 180];
      var LIGHT_BG = [245, 245, 240];

      // =============================================
      // PAGE 1: Crop Production Summary
      // =============================================
      addHeader(doc, 'Farm Macro Roll Up — ' + year, true, 'Crop Production Summary');
      var yPos = 26;

      var cropTableStyles = {
        theme: 'grid',
        headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 8, halign: 'center', fontStyle: 'bold', cellPadding: 2 },
        styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.25 },
        alternateRowStyles: { fillColor: LIGHT_BG },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 45 },
          1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
          4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' },
          7: { halign: 'center' }
        }
      };

      // Conventional crops
      if (data.conventional.length) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text('CONVENTIONAL ENTERPRISES', pageW / 2, yPos, { align: 'center' });
        yPos += 1;
        doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
        doc.setLineWidth(0.5);
        doc.line(30, yPos, pageW - 30, yPos);
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

        var convOpts = JSON.parse(JSON.stringify(cropTableStyles));
        convOpts.startY = yPos;
        convOpts.head = [['Crop', 'Acres', 'Avg Yield', 'Proj Total', 'Mach/AC', 'Profit/AC', 'COP', 'Unit']];
        convOpts.body = convRows;
        convOpts.didParseCell = function (hookData) {
          if (hookData.column.index === 5 && hookData.section === 'body') {
            var val = parseMoneyVal(convRows[hookData.row.index][5]);
            hookData.cell.styles.textColor = profitColor(val);
            hookData.cell.styles.fontStyle = 'bold';
          }
        };
        doc.autoTable(convOpts);
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // Organic crops
      if (data.organic.length) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(DARK[0], DARK[1], DARK[2]);
        doc.text('ORGANIC ENTERPRISES', pageW / 2, yPos, { align: 'center' });
        yPos += 1;
        doc.setDrawColor(GRAY_LINE[0], GRAY_LINE[1], GRAY_LINE[2]);
        doc.setLineWidth(0.5);
        doc.line(30, yPos, pageW - 30, yPos);
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

        var orgOpts = JSON.parse(JSON.stringify(cropTableStyles));
        orgOpts.startY = yPos;
        orgOpts.head = [['Crop', 'Acres', 'Avg Yield', 'Proj Total', 'Mach/AC', 'Profit/AC', 'COP', 'Unit']];
        orgOpts.body = orgRows;
        orgOpts.didParseCell = function (hookData) {
          if (hookData.column.index === 5 && hookData.section === 'body') {
            var val = parseMoneyVal(orgRows[hookData.row.index][5]);
            hookData.cell.styles.textColor = profitColor(val);
            hookData.cell.styles.fontStyle = 'bold';
          }
        };
        doc.autoTable(orgOpts);
      }

      // =============================================
      // PAGE 2: Cost Category Rollup (forced page break)
      // =============================================
      doc.addPage('a4', 'landscape');
      addHeader(doc, 'Farm Macro Roll Up — ' + year, true, 'Cost Category Rollup by Enterprise');
      yPos = 28;

      var enterprises = data.enterpriseSummaries;
      var rollupHead = ['CATEGORY'];
      enterprises.forEach(function (es) { rollupHead.push(es.enterprise.shortName.toUpperCase()); });
      rollupHead.push('TOTAL');

      var categories = [
        // --- LAND ---
        { label: 'Acres', key: 'acres', section: 'LAND' },
        { label: 'Rent', key: 'rent' },
        // --- CROP INPUTS ---
        { label: 'Spring Fertilizer', key: 'springFert', section: 'CROP INPUTS', indent: true },
        { label: 'Fall Fertilizer', key: 'fallFert', indent: true },
        { label: 'Total Fertilizer', key: 'fert', bold: true },
        { label: 'Seed', key: 'seed' },
        // --- FIELD OPERATIONS ---
        { label: 'Machinery', key: 'machinery', section: 'FIELD OPERATIONS' },
        { label: 'Labor & Overhead', key: 'laborOverhead' },
        { label: 'Fuel', key: 'fuel' },
        { label: 'Drying', key: 'drying' },
        // --- CARRYING COSTS ---
        { label: 'Interest', key: 'interest', section: 'CARRYING COSTS' },
        { label: 'Crop Insurance Premiums', key: 'insurance' },
        // --- EXPENSE SUMMARY ---
        { label: 'TOTAL EXPENSES', key: 'expTotal', section: 'SUMMARY', bold: true, highlight: true },
        { label: 'Gross Crop Income', key: 'cropIncome', bold: true },
        { label: 'OPERATING PROFIT', key: 'cropProfit', bold: true, profit: true, highlight: true },
        // --- SUPPLEMENTAL PAYMENTS ---
        { label: 'Crop Insurance Claim Payments', key: 'insIncome', section: 'SUPPLEMENTAL PAYMENTS' },
        { label: 'AUX Payments (Gov / Conservation)', key: 'govPayments' },
        { label: 'PROFIT WITH ALL PAYMENTS', key: 'profitWithPayments', bold: true, profit: true, highlight: true }
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

      // Insert section separator rows
      var finalRows = [];
      var sectionIdx = [];
      for (var ri = 0; ri < categories.length; ri++) {
        if (categories[ri].section) {
          var sepRow = [categories[ri].section];
          for (var ci = 0; ci < enterprises.length + 1; ci++) sepRow.push('');
          finalRows.push(sepRow);
          sectionIdx.push(finalRows.length - 1);
        }
        finalRows.push(rollupRows[ri]);
      }

      // Map original category index to finalRows index for styling
      var catMap = [];
      var offset = 0;
      for (var mi = 0; mi < categories.length; mi++) {
        if (categories[mi].section) offset++;
        catMap.push(mi + offset);
      }

      doc.autoTable({
        startY: yPos,
        head: [rollupHead],
        body: finalRows,
        theme: 'grid',
        headStyles: { fillColor: GREEN, textColor: WHITE, fontSize: 8, halign: 'center', fontStyle: 'bold', cellPadding: 2 },
        styles: { fontSize: 8, cellPadding: 1.8, lineColor: [200, 200, 200], lineWidth: 0.25 },
        alternateRowStyles: { fillColor: LIGHT_BG },
        columnStyles: (function () {
          var cs = { 0: { cellWidth: 55 } };
          for (var i = 1; i <= enterprises.length + 1; i++) cs[i] = { halign: 'center' };
          return cs;
        })(),
        didParseCell: function (hookData) {
          if (hookData.section !== 'body') return;
          var rowIdx = hookData.row.index;

          // Section separator rows — dark bar with white text
          if (sectionIdx.indexOf(rowIdx) !== -1) {
            hookData.cell.styles.fillColor = [60, 60, 55];
            hookData.cell.styles.textColor = [255, 255, 255];
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fontSize = 7;
            hookData.cell.styles.cellPadding = 1.2;
            return;
          }

          // Find which category this row maps to
          var catIdx = -1;
          for (var k = 0; k < catMap.length; k++) {
            if (catMap[k] === rowIdx) { catIdx = k; break; }
          }
          if (catIdx === -1) return;
          var cat = categories[catIdx];

          // Highlight rows (expenses, operating profit, final profit) — light green tint
          if (cat.highlight) {
            hookData.cell.styles.fillColor = [230, 240, 225];
          }

          if (cat.bold) {
            hookData.cell.styles.fontStyle = 'bold';
          }
          if (cat.indent && hookData.column.index === 0) {
            hookData.cell.styles.textColor = [100, 100, 100];
            hookData.cell.styles.fontStyle = 'italic';
          }
          if (cat.profit && hookData.column.index > 0) {
            var val = parseMoneyVal(hookData.cell.raw);
            hookData.cell.styles.textColor = profitColor(val);
            hookData.cell.styles.fontStyle = 'bold';
            hookData.cell.styles.fontSize = 9;
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
