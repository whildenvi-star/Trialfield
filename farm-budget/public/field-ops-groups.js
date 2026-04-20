/**
 * field-ops-groups.js — Field Operations Group Classifier
 *
 * Classifies product names (inputs) and implement names (machinery/passes)
 * into agronomic operation groups for the unified Field Ops panel.
 *
 * Pattern rules derived from real data.json product/implement names.
 *
 * Exports: window.FieldOpsGroups = { GROUP_ORDER, classifyItem }
 */
(function (window) {
  'use strict';

  /**
   * Display order for operation groups.
   * Matches agronomic season sequence: ground work → fertility → planting → weed → fungicide → harvest.
   */
  var GROUP_ORDER = ['Tillage', 'Fertility', 'Planting', 'Pre-emerge', 'Post-emerge', 'Fungicide', 'Harvest', 'Other'];

  /**
   * Rules evaluated in GROUP_ORDER sequence.
   * Each rule has a group name and an array of lowercase substring patterns.
   * First matching rule wins.
   *
   * Patterns derived from actual data.json names:
   *   Implements: Chisle Plow, Combine + Buggy, Cultivator 12, Disk, Drill, Hooded Redball,
   *               Planter, Rotary Hoe 60, Soil Finisher, Spinner, Tine Weed 80, Tine weed 60,
   *               Trucking, Weed Zapper
   *   Products:   0-0-50 OMRI, 0-0-60 Potash, 0-46-0 Triple Super 15C, 10-34-0, 12-0-0-26 Amm Thio,
   *               18-46-0 DAP, 21-0-0-24s AMS Granular, 28% Nitrogen, 32% Nitrogen,
   *               46-0-0 Urea, 46-0-0 SideDress N, Acomplish Max, Application - Liquid Ppi,
   *               Application - Liquid Pre, Application - Post, Armezon, Atrazine 4L,
   *               Basagran, Batallion LFC, BioActive Liquilife +, BioRepel, Boost,
   *               Buccaneer 5 Extra, Chicken Litter, Cobra, Crop Oil, Durango DMA, Eco Tec,
   *               Enlist, Forsyte, Huskie, KWS CC rye, Liberty, Mauler, Miravis ace,
   *               NIS, Outlook, Palisade Maxx, PowerMax, Ppst 120 Inoculant,
   *               Ppst Fst/Ist Seed Treatment, Premium Ams, Prowl H2O, Red Clover,
   *               Resicore XL, Rye seed, S04 30%, Seed Treatment Application,
   *               Sharpen Sc, Sonic, TeraFed, Thunder Master, Tulls manure, Verdict,
   *               Volunteer, Water, Wi Tonnage Tax, Zidua sc
   */
  var RULES = [
    {
      group: 'Tillage',
      patterns: [
        'chisel', 'chisle',            // Chisle Plow
        'disk',                        // Disk
        'soil finisher',               // Soil Finisher
        'cultivat',                    // Cultivator 12
        'rock pick',                   // Rock Picker (not in current data but expected)
        'stalk chop'                   // Stalk chopper
      ]
    },
    {
      group: 'Fertility',
      patterns: [
        // NPK numeric notation patterns from real data
        '0-0-50', '0-0-60',           // 0-0-50 OMRI, 0-0-60 Potash
        '0-46-0',                      // 0-46-0 Triple Super
        '10-34-0',                     // 10-34-0
        '12-0-0',                      // 12-0-0-26 Amm Thio
        '18-46-0',                     // 18-46-0 DAP
        '21-0-0',                      // 21-0-0-24s AMS Granular
        '28%',                         // 28% Nitrogen
        '32%',                         // 32% Nitrogen
        '46-0-0',                      // 46-0-0 Urea / SideDress N
        // Named fertility products
        'potash',
        'anhydrous',
        'urea',
        'ammonia',
        'amm thio',
        ' ams',                        // AMS — space prefix avoids matching "armezon"
        'ams ',
        'dap',
        'sulfur',
        's04',                         // S04 30%
        'chicken litter',              // Chicken Litter
        'tulls manure',                // Tulls manure
        'manure',
        'compost',
        'lime',
        'gypsum',
        'feathermeal',
        'chilean nitrate',
        'boron',
        'zinc',
        'manganese',
        'calcium',
        'terafed',                     // TeraFed
        'eco tec',                     // Eco Tec
        'acomplish max',               // Acomplish Max
        'accomplish max',
        'nitrogen',                    // 28% Nitrogen, 32% Nitrogen
        'sprayable fertilizer',
        'spe-120',                     // SPE-120 dry (fertility supplement)
        'bioactive',                   // BioActive Liquilife + (soil biological)
        'biorepl',                     // BioRepel
        'boost',                       // Boost (biological)
        'mint casting'                 // Mint castings (bio amendment)
      ]
    },
    {
      group: 'Planting',
      patterns: [
        'planter',                     // Planter implement
        'drill',                       // Drill implement
        'custom no till planting',
        'seed treatment application',  // Seed Treatment Application (Unit)
        'inoculant',                   // Ppst 120 Inoculant
        'ppst',                        // Ppst Fst/Ist Seed Treatment
        'rhizoliz',                    // Rhizolizer/Rhizolozer
        'exceed',                      // Exceed inoculant
        'kws cc rye',                  // KWS CC rye — cover crop seed planted with drill
        'red clover',                  // Red Clover — cover crop seed
        'rye seed',                    // Rye seed
        'oats'                         // Oats seed
      ]
    },
    {
      group: 'Pre-emerge',
      patterns: [
        // Custom application types
        'application - liquid ppi',    // Application - Liquid Ppi
        'application - liquid pre',    // Application - Liquid Pre
        'application - burndown',
        'application - vrt',
        'application - spinner',       // Spinner sprayer = Pre-emerge application
        // Herbicide products (pre-emerge mode)
        'prowl',                       // Prowl H2O
        'outlook',                     // Outlook
        'sharpen',                     // Sharpen Sc
        'sonic',                       // Sonic
        'zidua',                       // Zidua sc
        'resicore',                    // Resicore XL
        'authority',
        'verdict',                     // Verdict
        'forsyte',                     // Forsyte 1.88 SL
        'pendimethalin',
        'batallion',                   // Batallion LFC (PPI/Pre-emerge herbicide)
        // Pre-emerge implement types
        'tine weed',                   // Tine Weed 80, Tine weed 60 (mechanical weed ctrl)
        'hooded redball',              // Hooded Redball (inter-row cultivator with herbicide hood)
        'spinner'                      // Spinner implement (spinner-disc sprayer used for pre-emerge)
      ]
    },
    {
      group: 'Post-emerge',
      patterns: [
        // Custom application types
        'application - post',          // Application - Post
        // Post-emerge herbicides from real data
        'liberty',                     // Liberty
        'basagran',                    // Basagran
        'buccaneer',                   // Buccaneer 5 Extra
        'durango',                     // Durango DMA
        'powermax',                    // PowerMax
        'roundup',                     // RoundUp
        'enlist',                      // Enlist
        'armezon',                     // Armezon
        'atrazine',                    // Atrazine 4L
        'status',
        'laudis',
        'callisto',
        'steadfast',
        'distinct',
        'mauler',                      // Mauler
        'cobra',                       // Cobra
        'huskie',                      // Huskie
        'flexstar',
        'raptor',
        'volunteer',                   // Volunteer
        'weed slayer',
        // Post-emerge implements
        'weed zapper',                 // Weed Zapper implement
        'rotary hoe',                  // Rotary Hoe 60 — mechanical post-emerge weed control
        // Adjuvants associated with post-emerge (crop oil, methylated oil)
        'crop oil',                    // Crop Oil, Insource
        'meth oil',                    // Meth Oil, Insource
        'nis',                         // NIS (non-ionic surfactant, post-emerge adjuvant)
        'thunder master'               // Thunder Master (insecticide applied post-emerge timing)
      ]
    },
    {
      group: 'Fungicide',
      patterns: [
        'miravis',                     // Miravis ace
        'palisade',                    // Palisade Maxx
        'headline',
        'veltyma',
        'strobilurin',
        'fungicide',
        'tebuconazole',
        'propiconazole'
      ]
    },
    {
      group: 'Harvest',
      patterns: [
        'combine',                     // Combine + Buggy
        'buggy',                       // grain buggy
        'grain cart',
        'ear picker',
        'trucking',                    // Trucking implement
        'truck',
        'chop',
        'haul',
        'dump cart'
      ]
    }
    // No 'Other' rule needed — catch-all in classifyItem()
  ];

  /**
   * Classify an item name into an operation group.
   *
   * @param {string} name       - productName (for inputs) or implementName (for machinery/passes)
   * @param {string} [itemType] - 'input' | 'pass' | 'custom' — used for tiebreaking
   * @returns {string} One of GROUP_ORDER values, never null.
   */
  function classifyItem(name, itemType) {
    if (!name) return 'Other';
    var lower = name.toLowerCase();

    for (var r = 0; r < RULES.length; r++) {
      var rule = RULES[r];
      var patterns = rule.patterns;
      for (var p = 0; p < patterns.length; p++) {
        if (lower.indexOf(patterns[p]) !== -1) {
          return rule.group;
        }
      }
    }

    return 'Other';
  }

  window.FieldOpsGroups = {
    GROUP_ORDER: GROUP_ORDER,
    classifyItem: classifyItem
  };

})(typeof window !== 'undefined' ? window : this);
