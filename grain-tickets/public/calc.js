// Grain Ticket Calculation Engine
// Shared between client (browser) and server (Node.js)

(function (exports) {
  'use strict';

  /**
   * Compute derived fields for a single ticket.
   * @param {Object} ticket - { netWeight, moisture, fm, crop }
   * @param {Object} cropConfig - { [cropName]: { discount, testWeight, moistureShrink } }
   * @returns {Object} { fmDiscountFactor, testWeight, moistureShrink, discount, grossBU, netBU }
   */
  function computeTicket(ticket, cropConfig) {
    var config = cropConfig[ticket.crop];
    if (!config) {
      // Try trimmed match as fallback
      var trimmed = (ticket.crop || '').trim();
      for (var key in cropConfig) {
        if (key.trim() === trimmed) {
          config = cropConfig[key];
          break;
        }
      }
    }
    if (!config) {
      config = { discount: 0, testWeight: 56, moistureShrink: 0 };
    }

    var testWeight = config.testWeight;
    var moistureShrink = config.moistureShrink;
    var discount = config.discount;
    var moisture = parseFloat(ticket.moisture) || 0;
    var netWeight = parseFloat(ticket.netWeight) || 0;
    var fm = parseFloat(ticket.fm) || 0;

    // FM discount factor: if FM >= 1, factor = (FM - 1) / 100, else 0
    var fmDiscountFactor = fm >= 1 ? (fm - 1) / 100 : 0;

    // Gross BU = (((100 - ((moisture - moistureShrink) * discount)) * netWeight) / testWeight) / 100
    // This matches the spreadsheet formula exactly: moisture adjustment is part of Gross BU
    var grossBU = 0;
    if (testWeight > 0) {
      grossBU = (((100 - ((moisture - moistureShrink) * discount)) * netWeight) / testWeight) / 100;
    }

    // Net BU If Sold = Gross BU * (1 - fmDiscountFactor)
    var netBU = grossBU * (1 - fmDiscountFactor);

    return {
      fmDiscountFactor: round(fmDiscountFactor, 6),
      testWeight: testWeight,
      moistureShrink: moistureShrink,
      discount: discount,
      grossBU: round(grossBU, 6),
      netBU: round(netBU, 6)
    };
  }

  /**
   * Compute farm summaries by aggregating tickets.
   * @param {Array} tickets - all tickets
   * @param {Array} farms - farm metadata
   * @param {Object} cropConfig
   * @returns {Array} farms with totalBU and yieldPerAcre computed
   */
  function computeFarmSummaries(tickets, farms, cropConfig) {
    // Build lookup: lowercase farm name -> sum of netBU
    var farmBU = {};
    tickets.forEach(function (t) {
      var computed = computeTicket(t, cropConfig);
      var key = (t.farm || '').trim().toLowerCase();
      if (!farmBU[key]) farmBU[key] = 0;
      farmBU[key] += computed.netBU;
    });

    return farms.map(function (f) {
      var key = (f.farm || '').trim().toLowerCase();
      var totalBU = round(farmBU[key] || 0, 6);
      var acres = parseFloat(f.acres) || 0;
      var yieldPerAcre = acres > 0 ? round(totalBU / acres, 6) : 0;
      return Object.assign({}, f, {
        totalBU: totalBU,
        yieldPerAcre: yieldPerAcre
      });
    });
  }

  function round(val, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  }

  /**
   * USDA standard test weights (lbs/bu) for canonical crop names.
   * Used as fallback when per-farm CropConfig is unavailable.
   * Source: USDA Handbook No. 15, standard grades and weight limits.
   */
  var USDA_TEST_WEIGHTS = {
    wheat:      60,
    corn:       56,
    soybeans:   60,
    oats:       32,
    barley:     48,
    rye:        56,
    sorghum:    56,
    sunflower:  28,
    flax:       56,
    peas:       60
  };

  exports.computeTicket = computeTicket;
  exports.computeFarmSummaries = computeFarmSummaries;
  exports.USDA_TEST_WEIGHTS = USDA_TEST_WEIGHTS;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Calc = {}));
