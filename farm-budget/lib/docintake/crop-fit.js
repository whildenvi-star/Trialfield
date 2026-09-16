'use strict';

// Does this product belong on this enterprise?
//
// The enterprise guard in match.js only fires where a parcel carries more than
// one crop enterprise. Every dollar of confirmed misplacement found so far was
// on a parcel with exactly ONE enterprise — Carrol and Delong Christopherson
// each had only a corn row, so a bean pass landed on corn with nothing to
// disagree with. This check runs everywhere, and it reads the one thing that
// actually separates a bean pass from a corn pass: the product.
//
// Two facts decide it:
//
//   1. the crop family of the enterprise (corn, soybean, small grain, pea …)
//   2. for soybeans, the SEED TRAIT — Enlist E3, LibertyLink, conventional.
//      Family alone is not enough: Wes's carries Enlist E3 double-crop beans
//      and conventional DF 262 food beans in the same season, and Enlist One
//      would kill the food beans.
//
// The rules themselves are DATA, not code: `store.productCropRules`, which the
// owner maintains from the product labels. What lives here is only the engine
// that applies them. RULE_SEED below is the starting table, used when the store
// has none — it is a seed, not the authority.
//
// A rule never places a line and never silently blocks one. It returns a
// verdict, and the caller sends anything other than `ok` to the review queue
// with the reason attached.

// ── crop families ───────────────────────────────────────────────
// Matched against the enterprise's crop name, longest pattern first, so
// "ORG Seed Corn" resolves before "corn".
const CROP_FAMILIES = [
  { family: 'soybean', match: ['soybean', 'natto bean', 'seed grade bean', 'food bean', 'edible bean'] },
  { family: 'corn', match: ['corn', 'maize'] },
  { family: 'smallgrain', match: ['wheat', 'barley', 'rye', 'oat', 'triticale', 'kernza'] },
  { family: 'pea', match: ['pea'] },
  { family: 'snapbean', match: ['snap bean'] },
  { family: 'limabean', match: ['lima bean'] },
  { family: 'mint', match: ['mint', 'peppermint', 'spearmint'] },
  { family: 'alfalfa', match: ['alfalfa', 'clover'] }
];

// Soybean seed traits. `TRAIT_UNKNOWN` is a first-class value: an enterprise
// that has not been told its trait cannot be checked against a trait-dependent
// product, and that is a review-queue answer, not a pass.
const TRAITS = ['ENLIST_E3', 'LIBERTYLINK', 'XTENDFLEX', 'RR2Y', 'CONVENTIONAL', 'ORGANIC'];
const TRAIT_UNKNOWN = null;

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Snap beans and lima beans are not soybeans, and both contain "bean" — test
// the specific families before the generic ones.
function cropFamily(crop) {
  const c = normalize(crop);
  if (!c) return null;
  if (/snap bean/.test(c)) return 'snapbean';
  if (/lima bean/.test(c)) return 'limabean';
  for (let i = 0; i < CROP_FAMILIES.length; i++) {
    const f = CROP_FAMILIES[i];
    for (let j = 0; j < f.match.length; j++) {
      if (c.indexOf(f.match[j]) >= 0) return f.family;
    }
  }
  return null;
}

// Organic ground is its own answer: no synthetic pesticide belongs there
// whatever the trait says.
function isOrganicEnterprise(field) {
  const c = normalize(field && field.crop);
  return /\borg\b|organic/.test(c) || !!(field && field.organic);
}

// The trait the enterprise records. `seedTrait` on the field row is the answer
// when it is set; nothing is inferred from the crop name, because inference is
// what put a bean pass on a corn row in the first place. The one exception is
// organic, which the crop name states outright.
function enterpriseTrait(field) {
  if (!field) return TRAIT_UNKNOWN;
  if (field.seedTrait && TRAITS.indexOf(field.seedTrait) >= 0) return field.seedTrait;
  if (isOrganicEnterprise(field)) return 'ORGANIC';
  return TRAIT_UNKNOWN;
}

// What the crop name would suggest, used ONLY to report a missing trait and to
// propose a value for the owner to confirm. Never used to allow a pass.
function suggestTrait(field) {
  const c = normalize(field && field.crop);
  const seeds = ((field && field.seeds) || []).map(function (s) { return normalize(s.variety || s.name); }).join(' ');
  if (isOrganicEnterprise(field)) return 'ORGANIC';
  if (/enlist/.test(c)) return 'ENLIST_E3';
  if (/\be3\b|z\d+e\b|\d+z\d+e\b/.test(seeds)) return 'ENLIST_E3';
  if (/non gmo|food bean|seed grade bean|natto/.test(c)) return 'CONVENTIONAL';
  if (/liberty|ll\b/.test(c)) return 'LIBERTYLINK';
  if (/xtend/.test(c)) return 'XTENDFLEX';
  return TRAIT_UNKNOWN;
}

// ── the rule table (seed) ───────────────────────────────────────
// One row per product family, keyed by what the invoice calls it. Fields:
//
//   id          stable key, so an edited row keeps its identity
//   ai          active ingredient, for the reason text
//   products    substrings matched against the invoice description / product
//               name, lower-cased. A rule with no match never fires.
//   families    crop families the product may be applied to. [] = none.
//   traits      for the soybean family, the traits it may be applied to.
//               null = any trait (the product is trait-blind, e.g. a residual)
//   burndownOk  true when the product is labelled as a pre-plant burndown, in
//               which case the trait does not apply — glufosinate ahead of
//               planting is legal on any crop, on the label's interval.
//   note        why, in the owner's words
const RULE_SEED = [
  {
    id: 'rule_24d_choline', ai: '2,4-D choline',
    products: ['enlist one', 'enlist'],
    families: ['soybean'], traits: ['ENLIST_E3'], burndownOk: true,
    note: 'Enlist One is the E3 trait product. On any other bean it is the pass that kills the crop.'
  },
  {
    id: 'rule_glufosinate', ai: 'glufosinate',
    products: ['liberty', 'interline', 'forfeit', 'cheetah'],
    families: ['soybean'], traits: ['ENLIST_E3', 'LIBERTYLINK'], burndownOk: true,
    note: 'Glufosinate needs the LibertyLink or E3 trait in-crop. Legal as a burndown before planting.'
  },
  {
    id: 'rule_glyphosate', ai: 'glyphosate',
    products: ['powermax', 'buccaneer', 'durango', 'roundup', 'glyphosate', 'cornerstone'],
    families: ['soybean', 'corn'], traits: ['ENLIST_E3', 'LIBERTYLINK', 'XTENDFLEX', 'RR2Y'], burndownOk: true,
    note: 'In-crop glyphosate needs a Roundup-Ready trait. Burndown and pre-plant are fine anywhere.'
  },
  {
    id: 'rule_dicamba', ai: 'dicamba',
    products: ['dicamba', 'xtendimax', 'engenia', 'status', 'clarity'],
    families: ['corn', 'smallgrain'], traits: ['XTENDFLEX'], burndownOk: true,
    note: 'Dicamba in beans needs XtendFlex. Status and Clarity are corn products here.'
  },
  {
    id: 'rule_24d_ester', ai: '2,4-D ester',
    products: ['ester 2 4 d', 'ester 2,4-d', '2 4 d lv', 'butyrac'],
    families: ['corn', 'smallgrain'], traits: [], burndownOk: true,
    note: 'Ester 2,4-D is a burndown ahead of beans, never over the top of them.'
  },
  {
    id: 'rule_atrazine', ai: 'atrazine',
    products: ['atrazine', 'resicore', 'verdict', 'armezon', 'sparrow', 'batallion', 'accent', 'calisto', 'callisto', 'acuron', 'lumax', 'lexar'],
    families: ['corn'], traits: [], burndownOk: false,
    note: 'Corn herbicides. On a bean enterprise this is a misplaced corn pass.'
  },
  {
    id: 'rule_bean_residual', ai: 'soybean residual / post',
    products: ['sonic', 'mauler', 'zidua', 'forsyte', 'cobra', 'tricor', 'metribuzin', 'flexstar', 'warrant', 'authority', 'pursuit', 'raptor'],
    families: ['soybean', 'pea', 'snapbean', 'limabean'], traits: null, burndownOk: true,
    note: 'Soybean and canning-bean chemistry. On corn this is a misplaced bean pass.'
  },
  {
    id: 'rule_clethodim', ai: 'clethodim',
    products: ['volunteer', 'select max', 'clethodim', 'assure'],
    families: ['soybean', 'pea', 'snapbean', 'limabean', 'mint', 'alfalfa'], traits: null, burndownOk: true,
    note: 'A grass herbicide. It kills corn — a clethodim line on a corn enterprise is always wrong.'
  },
  {
    id: 'rule_bentazon', ai: 'bentazon',
    products: ['basagran'], families: ['snapbean', 'limabean', 'pea', 'soybean', 'mint'], traits: null, burndownOk: true,
    note: 'Bentazon is a canning-crop and mint product; not labelled on corn or small grain.'
  },
  {
    id: 'rule_smallgrain_post', ai: 'small-grain post',
    products: ['huskie', 'axial', 'osprey', 'harmony'],
    families: ['smallgrain'], traits: [], burndownOk: false,
    note: 'Cereal herbicides. Anywhere else it is a misplaced small-grain pass.'
  }
];

// Products that carry no crop opinion at all. Checking them produces noise and
// hides the lines that matter: water, AMS, crop oil, the application service
// line, fertiliser, tonnage tax, seed treatment.
const NEUTRAL = [
  'water', 'premium ams', 'ams', 'crop oil', 'meth oil', 'surfactant', 'nis',
  'application', 'tonnage tax', 'seed treatment', 'inoculant', 'potash',
  'triple super', 'urea', 'amm thio', '10-34-0', '18-46-0', 'sidedress',
  'nitrogen', 'lime', 'manure', 'litter', 'castings', 's04', 'omri', 'dap',
  'ppst', 'wi tonnage'
];

function isNeutral(name) {
  const n = normalize(name);
  if (!n) return true;
  return NEUTRAL.some(function (k) { return n.indexOf(normalize(k)) >= 0; });
}

// Burndown and pre-plant passes are trait-blind: the crop is not up yet, so
// nothing it carries can be killed by the tank. Ester 2,4-D ahead of Enlist
// beans at Daun and Bakke is exactly this — a legal pre-plant on the label's
// interval — and flagging it would bury the real hits under six false ones.
//
// The operation group is the field's own record of the context; the invoice
// comment ("Post Harvest Burndown") is the other half, and is what the matcher
// has at intake time. Note what is NOT included: a row whose group says
// "Post-emerge" gets no exemption, which is how Townline's August glyphosate
// stays visible — either that pass is mis-grouped or it is misplaced, and both
// are worth a look.
function isBurndownContext(row, invoice) {
  const g = normalize(row && (row.operationGroup || row.category));
  const c = normalize(invoice && (invoice.comments || invoice.fieldLabel));
  return /burndown|pre plant|preplant|pre emerge|preemerge|ppi|^pre$/.test(g) ||
    /burndown|pre plant|preplant/.test(c);
}

function rulesFor(store) {
  const t = store && store.productCropRules;
  return (Array.isArray(t) && t.length) ? t : RULE_SEED;
}

function matchRule(rules, productName) {
  const n = normalize(productName);
  if (!n) return null;
  let best = null, bestLen = 0;
  rules.forEach(function (r) {
    (r.products || []).forEach(function (p) {
      const pat = normalize(p);
      if (pat && n.indexOf(pat) >= 0 && pat.length > bestLen) { best = r; bestLen = pat.length; }
    });
  });
  return best;
}

// ── the check ───────────────────────────────────────────────────
// Returns one of:
//   { verdict: 'ok' }
//   { verdict: 'wrong-crop',    rule, reason }   product not labelled on this family
//   { verdict: 'wrong-trait',   rule, reason }   right family, wrong seed trait
//   { verdict: 'unknown-trait', rule, reason }   trait-dependent, trait not recorded
//   { verdict: 'organic',       rule, reason }   synthetic on organic ground
// Anything but 'ok' belongs in the review queue.
function checkRow(store, field, row, invoice) {
  const name = (row && (row.productName || row.description)) || '';
  if (isNeutral(name)) return { verdict: 'ok' };

  const rules = rulesFor(store);
  const rule = matchRule(rules, name);
  if (!rule) return { verdict: 'ok' };

  const family = cropFamily(field && field.crop);
  const trait = enterpriseTrait(field);
  const crop = (field && field.crop) || '(no crop)';

  if (trait === 'ORGANIC') {
    return {
      verdict: 'organic', rule: rule.id,
      reason: name + ' is a synthetic ' + rule.ai + ' and ' + crop + ' is organic ground.'
    };
  }

  const burndown = isBurndownContext(row, invoice);

  if (family && (rule.families || []).indexOf(family) < 0) {
    if (burndown && rule.burndownOk) return { verdict: 'ok' };
    return {
      verdict: 'wrong-crop', rule: rule.id,
      reason: name + ' (' + rule.ai + ') is not labelled on ' + crop + '. ' + rule.note
    };
  }

  // Trait only governs soybeans; a corn or cereal enterprise has no trait to
  // check against.
  if (family === 'soybean' && rule.traits) {
    if (burndown && rule.burndownOk) return { verdict: 'ok' };
    if (trait === TRAIT_UNKNOWN) {
      return {
        verdict: 'unknown-trait', rule: rule.id,
        reason: name + ' (' + rule.ai + ') only goes on ' + rule.traits.join(' or ') +
          ' beans, and ' + crop + ' does not record a seed trait. Set the trait on the enterprise and this resolves itself.'
      };
    }
    if (rule.traits.indexOf(trait) < 0) {
      return {
        verdict: 'wrong-trait', rule: rule.id,
        reason: name + ' (' + rule.ai + ') needs ' + rule.traits.join(' or ') + ' beans; ' +
          crop + ' is ' + trait + '. ' + rule.note
      };
    }
  }

  return { verdict: 'ok' };
}

module.exports = {
  RULE_SEED: RULE_SEED,
  TRAITS: TRAITS,
  cropFamily: cropFamily,
  enterpriseTrait: enterpriseTrait,
  suggestTrait: suggestTrait,
  isNeutral: isNeutral,
  isOrganicEnterprise: isOrganicEnterprise,
  checkRow: checkRow,
  rulesFor: rulesFor
};
