'use strict';

// Document intake — matching layer.
//
// Pure functions: takes the transcribed document plus the live data.json
// reference lists, and proposes what to write. Nothing here mutates data and
// nothing here decides on the operator's behalf — every row comes back with a
// status and a ranked candidate list so the review grid can show its work.

const Calc = require('../../public/calc.js');

// ── text normalising ────────────────────────────────────────────
// Invoice text and our product list disagree in predictable ways:
//   "Ester 2,4-D LV6 (265 Gal)"  vs  "Ester 2,4-D LV (2x2.5 Gal)"
//   "Veracity Elite II (2x2.5 Gal)" vs "Veracity Elite II"
// Pack size is a purchase detail, not part of the product's identity, so the
// core comparison happens with the parentheticals stripped.
function normalize(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[*†]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripPack(s) {
  return String(s == null ? '' : s).replace(/\([^)]*\)/g, ' ');
}

function coreName(s) {
  return normalize(stripPack(s));
}

// DeLong prints Field ID and Farm ID as a joined pair, and they are usually the
// same string ("PhilEast Philhower East PhilEast Philhower East"). Dedupe the
// whole token set, not just adjacent runs — leaving the repeat in place inflates
// the token count and drags every score down by half.
function dedupeTokens(s) {
  const seen = [];
  const has = {};
  normalize(s).split(' ').forEach(function (t) {
    if (!t || has[t]) return;
    has[t] = true;
    seen.push(t);
  });
  return seen.join(' ');
}

// Levenshtein distance, iterative with a single row. Only ever run on short
// name tokens, so the O(n*m) cost is irrelevant.
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

// How alike two name tokens are, 0..1. Farm paperwork misspells names — the
// invoice says "Philhower", our register says "Phillhower" — and a strict
// equality test scores that pair zero, which is how the right field stopped
// being offered at all. Below 0.72 the pair is treated as unrelated, so this
// tolerates a slip without inventing matches between genuinely different names.
function tokenSim(a, b) {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (!max) return 0;
  const sim = 1 - levenshtein(a, b) / max;
  return sim >= 0.72 ? sim : 0;
}

// Token-overlap score in 0..1, each token credited by its best fuzzy partner.
// A shared leading token counts extra — farm and product names lead with the
// distinguishing word.
function tokenScore(a, b) {
  const at = a.split(' ').filter(Boolean);
  const bt = b.split(' ').filter(Boolean);
  if (!at.length || !bt.length) return 0;
  let credit = 0;
  at.forEach(function (t) {
    let best = 0;
    bt.forEach(function (u) { const s = tokenSim(t, u); if (s > best) best = s; });
    credit += best;
  });
  const overlap = credit / Math.max(at.length, bt.length);
  const leadBonus = tokenSim(at[0], bt[0]) >= 0.72 ? 0.15 : 0;
  return Math.min(1, overlap + leadBonus);
}

// Ranked candidates over a list, using a label accessor. Returns
// [{ item, score, why }] sorted best-first, only above `floor`.
function rank(list, label, query, floor) {
  const qCore = coreName(query);
  const qFull = normalize(query);
  const out = [];
  list.forEach(function (item) {
    const raw = label(item);
    if (!raw) return;
    const cCore = coreName(raw);
    const cFull = normalize(raw);
    let score = 0;
    let why = '';
    if (cFull === qFull) { score = 1; why = 'exact'; }
    else if (cCore === qCore) { score = 0.95; why = 'exact ignoring pack size'; }
    else if (cCore && qCore && (cCore.indexOf(qCore) === 0 || qCore.indexOf(cCore) === 0)) {
      score = 0.85; why = 'name prefix';
    } else {
      score = tokenScore(qCore, cCore) * 0.8;
      why = 'partial word match';
    }
    if (score >= (floor == null ? 0.34 : floor)) out.push({ item: item, score: Math.round(score * 100) / 100, why: why });
  });
  out.sort(function (a, b) { return b.score - a.score; });
  return out.slice(0, 5);
}

// ── field matching ──────────────────────────────────────────────
// The invoice names a field in the vendor's words. Three signals, in order of
// how much they can be trusted: the name, the crop named in the Comments line,
// and acres.
//
// The crop matters more than it looks. A split field appears once per crop
// under ONE parcel name with identical acreage — "phillhower east" is both Peas
// and Snap Beans at 135.2 ac — so name and acres together cannot separate them.
// The Comments line ("Post Snap Beans With Basagran") is the only thing on the
// page that can, and reading it is the difference between confirming the right
// pass and inventing new lines on the wrong crop.
function cropSignal(invoice) {
  return normalize(
    (invoice.comments || '') + ' ' + (invoice.fieldLabel || '') + ' ' + (invoice.farmLabel || '')
  );
}

// Does the invoice's comment name this field's crop? Compared token-wise and
// fuzzily so "Snap Beans" finds "snap beans" and "Soybeans" does not.
function cropMentioned(signal, crop) {
  const ct = normalize(crop).split(' ').filter(Boolean);
  if (!ct.length) return false;
  const st = signal.split(' ').filter(Boolean);
  if (!st.length) return false;
  let hit = 0;
  ct.forEach(function (t) {
    if (t.length < 3) { hit++; return; } // ignore noise words like "rr"
    if (st.some(function (u) { return tokenSim(t, u) >= 0.85; })) hit++;
  });
  return hit === ct.length;
}

// Crop words belong to a family, not a spelling. The page writes "Pre Beans"
// for a pass on Soybeans and "Post Food Beans" for one on food beans; a strict
// token test calls "beans" distinct from "soybeans" and then confidently hands
// a soybean pass to the Snap Beans row sharing that parcel. Treating one word
// as the other's family when either ends with the other keeps beans with
// soybeans, and still keeps beans apart from corn.
function sameCropFamily(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return a.endsWith(b) || b.endsWith(a);
}

function matchFields(fields, invoice) {
  const label = (invoice.fieldLabel || '') + ' ' + (invoice.farmLabel || '');
  const query = dedupeTokens(label);
  if (!query) return [];
  const cands = rank(fields, function (f) { return f.name; }, query, 0.3);

  const signal = cropSignal(invoice);
  const invAcres = Number(invoice.acres);

  cands.forEach(function (c) {
    const acres = (c.item.plantedAcres > 0 ? c.item.plantedAcres : c.item.acres) || 0;
    c.acres = acres;
    c.crop = c.item.crop || null;

    if (cropMentioned(signal, c.item.crop)) {
      c.score = Math.min(1, c.score + 0.3);
      c.why += ', invoice names ' + c.item.crop;
    }

    // Acres stays a tiebreaker, never a veto. On this paperwork it is often
    // the sprayed area rather than the parcel or the planted acreage — 108 ac
    // treated on a 135.2 ac field with 91.7 ac of the crop — so a large
    // penalty here would sink a field the name and crop both agree on.
    if (invAcres > 0 && acres > 0) {
      const drift = Math.abs(acres - invAcres) / invAcres;
      if (drift <= 0.01) { c.score = Math.min(1, c.score + 0.2); c.why += ', acres match'; }
      else if (drift <= 0.1) { c.score = Math.min(1, c.score + 0.05); c.why += ', acres close'; }
      else { c.score = Math.max(0, c.score - 0.08); c.why += ', acres differ (' + acres + ' vs ' + invAcres + ')'; }
    }
    c.score = Math.round(c.score * 100) / 100;
  });
  cands.sort(function (a, b) { return b.score - a.score; });
  return cands;
}

function matchProducts(products, description) {
  return rank(products, function (p) { return p.name; }, description, 0.34);
}

// ── enterprise resolution ───────────────────────────────────────
// A parcel is the piece of ground. Several budget rows can share it — one row
// per crop enterprise — and those rows carry the SAME name and the SAME acreage
// (all four Wes's rows say 143 ac), so name and acres together cannot separate
// them. Whichever row happened to sort first used to win, silently. That is how
// invoices 8004409 and 8004410 — both post-bean passes — ended up confirmed on
// corn rows at Carrol and Delong Christopherson.
//
// registryFieldId is the parcel's canonical id; fall back to the name for rows
// that predate it. Note the two disagree in useful ways: fld_042 carries "Omni",
// "OMNI BIG SOUTH" and "Omni GRASSY KNOLL", which the name test would treat as
// three parcels and the registry id correctly treats as one.
function parcelKey(field) {
  if (!field) return null;
  return field.registryFieldId ? 'reg:' + field.registryFieldId : 'name:' + normalize(field.name);
}

function enterprisesOnParcel(fields, field) {
  const key = parcelKey(field);
  if (!key) return field ? [field] : [];
  return fields.filter(function (f) { return parcelKey(f) === key; });
}

// What this enterprise plans to put on, as a set of core product names.
//
// Two sources, because neither alone covers the book. The field's own input
// lines are the working answer — applying a program flattens its rows onto the
// field, so a planned enterprise already carries its products. The linked
// program is consulted as well so an enterprise whose lines have not been built
// out yet can still be recognised by the program it was planned from. Only 12
// of 61 fields carry a templateId, so the input lines do most of the work.
function plannedProductNames(field, programs) {
  const names = Object.create(null);
  (field.inputs || []).forEach(function (i) {
    if (i.productName) names[coreName(i.productName)] = true;
  });
  if (field.templateId) {
    const prog = (programs || []).find(function (p) { return p.id === field.templateId; });
    if (prog) {
      (prog.inputs || []).forEach(function (i) {
        if (i.productName) names[coreName(i.productName)] = true;
      });
    }
  }
  return names;
}

// Decide which enterprise on a shared parcel an invoice belongs to.
//
// The rule is that a multi-enterprise parcel is never resolved on name and
// acres alone. Two signals are allowed to decide it, in order of how much they
// can be trusted, and if neither does the line goes to the review queue rather
// than being guessed at:
//
//   1. the crop named in the Comments line ("Post Snap Beans With Basagran")
//   2. which enterprise's program plans the products being billed
//
// Both must select exactly one enterprise. Two enterprises that each plan
// Roundup is not a resolution, it is a coin toss, and a coin toss is what this
// function exists to refuse.
function resolveEnterprise(fields, invoice, cands, lineProducts, programs) {
  const best = cands.length ? cands[0] : null;
  if (!best || best.score < 0.6) {
    return { field: null, ambiguous: false, contenders: [], reason: null };
  }

  const siblings = enterprisesOnParcel(fields, best.item);
  if (siblings.length <= 1) {
    return { field: best.item, ambiguous: false, contenders: [], reason: null };
  }

  // Score every enterprise on the parcel, not just the ones the name matcher
  // happened to surface — "Gessert west 111" and "Gessert" are one parcel, and
  // the review grid has to offer both.
  const byId = {};
  cands.forEach(function (c) { byId[c.item.id] = c; });
  const contenders = siblings.map(function (f) {
    const c = byId[f.id];
    return {
      item: f,
      score: c ? c.score : 0,
      why: c ? c.why : 'same parcel (' + (f.registryFieldId || f.name) + ')',
      acres: (f.plantedAcres > 0 ? f.plantedAcres : f.acres) || 0,
      crop: f.crop || null
    };
  });

  // A removal-replacement invoice names the crop that came OFF, not the crop
  // the pass is for: "VRA Removal Beans Fall 25" is potash replacing what last
  // year's beans took out, spread on ground that grows corn next season. The
  // crop word points backwards, so on a parcel that now carries both a corn and
  // a bean enterprise it would confidently pick the wrong one. Withhold the
  // crop signal entirely and let the program or acreage decide, or let it queue.
  const backwardLooking = /removal/i.test(String(invoice.comments || ''));
  const signal = backwardLooking ? '' : cropSignal(invoice);

  // Between siblings the useful test is not "does the page spell this crop
  // out in full" — it never does; the comment says "Post Rye", not "Post
  // Hybrid Seed Rye". What separates them is the word only one of them owns.
  // Tokens shared by two contenders (both soybean rows on Wes's) carry no
  // information and are dropped, which is what keeps this from resolving a
  // parcel it cannot actually tell apart.
  const tokensOf = contenders.map(function (c) {
    return normalize(c.item.crop || '').split(' ').filter(function (t) { return t.length >= 3; });
  });
  const shared = Object.create(null);
  tokensOf.forEach(function (ts, i) {
    ts.forEach(function (t) {
      if (tokensOf.some(function (other, j) {
        return j !== i && other.some(function (u) { return sameCropFamily(t, u); });
      })) shared[t] = true;
    });
  });
  const signalTokens = signal.split(' ').filter(Boolean);
  const named = [];
  contenders.forEach(function (c, i) {
    const distinctive = tokensOf[i].filter(function (t) { return !shared[t]; });
    const hit = distinctive.filter(function (t) {
      return signalTokens.some(function (u) { return tokenSim(t, u) >= 0.85 || sameCropFamily(t, u); });
    });
    if (hit.length) named.push({ c: c, word: hit[0] });
  });
  if (named.length === 1) {
    return {
      field: named[0].c.item,
      ambiguous: false,
      contenders: contenders,
      reason: 'the invoice says "' + named[0].word + '", which on this parcel only ' +
        named[0].c.item.crop + ' answers to'
    };
  }

  // Whole-crop-name match, kept as a second pass: it can still separate two
  // contenders that share every distinctive word but differ in full name.
  const namedCrop = contenders.filter(function (c) { return cropMentioned(signal, c.item.crop); });
  if (namedCrop.length === 1) {
    return {
      field: namedCrop[0].item,
      ambiguous: false,
      contenders: contenders,
      reason: 'the invoice names ' + namedCrop[0].item.crop
    };
  }

  const wanted = [];
  const seenProd = Object.create(null);
  lineProducts.forEach(function (p) {
    if (!p) return;
    const k = coreName(p.name);
    if (seenProd[k]) return;
    seenProd[k] = true;
    wanted.push({ key: k, name: p.name });
  });

  if (wanted.length) {
    const planning = [];
    contenders.forEach(function (c) {
      const planned = plannedProductNames(c.item, programs);
      const hits = wanted.filter(function (w) { return planned[w.key]; });
      c.programHits = hits.length;
      c.programMatched = hits.map(function (w) { return w.name; });
      if (hits.length) planning.push(c);
    });
    if (planning.length === 1) {
      return {
        field: planning[0].item,
        ambiguous: false,
        contenders: contenders,
        reason: planning[0].item.crop + ' is the only enterprise on this parcel that plans ' +
          planning[0].programMatched.slice(0, 3).join(', ')
      };
    }
  }

  // Acres, last, and only when they are decisive rather than a tiebreaker.
  // Rows that genuinely share ground carry identical acreage — all four Wes's
  // rows say 143, both phillhower east rows say 135.2 — so acres can never
  // separate those. But fld_027 carries "Brad Inman's" at 47.8 and "Inman" at
  // 154.8: different parcels that share a registry id by mistake, and an
  // invoice for 47 acres plainly is not the 154.8 one. Requiring one close
  // match and every rival far off keeps this from firing on true siblings.
  // Both acreages are tried: a row carries a planted figure and a parcel
  // figure, and DeLong bills against whichever the sprayer recorded. Inman's
  // planted 146.9 against an invoice for 154.82 is 5% out and proves nothing,
  // but its parcel acreage of 154.8 is the same number.
  const invAcres = Number(invoice.acres);
  if (invAcres > 0) {
    const drift = contenders.map(function (c) {
      const opts = [c.item.plantedAcres, c.item.acres]
        .map(Number).filter(function (a) { return a > 0; });
      if (!opts.length) return { c: c, d: Infinity, a: null };
      let best = Infinity, bestA = null;
      opts.forEach(function (a) {
        const dd = Math.abs(a - invAcres) / invAcres;
        if (dd < best) { best = dd; bestA = a; }
      });
      return { c: c, d: best, a: bestA };
    });
    const near = drift.filter(function (x) { return x.d <= 0.02; });
    const far = drift.filter(function (x) { return x.d > 0.1; });
    if (near.length === 1 && far.length === contenders.length - 1) {
      return {
        field: near[0].c.item,
        ambiguous: false,
        contenders: contenders,
        reason: 'the only enterprise on this parcel whose acreage matches the invoice (' +
          near[0].a + ' vs ' + invAcres + ')'
      };
    }
  }

  const crops = contenders.map(function (c) { return c.item.crop || '(no crop)'; });
  return {
    field: null,
    ambiguous: true,
    contenders: contenders,
    reason: contenders.length + ' enterprises share ' + (best.item.name) + ' — ' +
      crops.join(', ') + '. The comments do not name one crop and ' +
      (wanted.length
        ? 'the billed products do not sit on a single enterprise’s program'
        : 'no product on this invoice was recognised') +
      ', so this needs you to say which.'
  };
}

// ── invoice → proposal ──────────────────────────────────────────
// One row per invoice line. `status` drives the review grid:
//   ready          — a planned input row is waiting; confirming it is the write
//   new-line       — product is known but this field has no planned row for it
//   unknown-product— the description matches nothing in the product list
//   already-applied— this exact invoice is already on that row (idempotent re-run)
//   conflict       — the row carries a DIFFERENT invoice number
//   ambiguous-enterprise
//                  — the parcel carries more than one crop enterprise and
//                    nothing on the page says which. Goes to the review queue;
//                    no pass is created until the operator picks.
const READY = 'ready';
const NEW_LINE = 'new-line';
const UNKNOWN_PRODUCT = 'unknown-product';
const ALREADY = 'already-applied';
const CONFLICT = 'conflict';
const AMBIGUOUS = 'ambiguous-enterprise';

function proposeInvoice(invoice, refs) {
  const fields = refs.fields || [];
  const products = refs.products || [];

  const programs = refs.programs || [];

  // Products are matched first, because which enterprise this invoice belongs
  // to is partly answered by what it bills — an enterprise is recognised by the
  // program it plans.
  const lineMatches = (invoice.lines || []).map(function (line) {
    const prodCands = matchProducts(products, line.description);
    return {
      line: line,
      prodCands: prodCands,
      product: prodCands.length && prodCands[0].score >= 0.6 ? prodCands[0].item : null
    };
  });

  const fieldCands = matchFields(fields, invoice);

  // The operator picking an enterprise by hand is the resolution the review
  // queue is waiting for, so it overrides the matcher outright. Re-running the
  // whole proposal against their choice — rather than just swapping the id —
  // is what lets the planned-row matching, the rate disambiguation and the
  // double-entry guards below apply to the enterprise actually chosen.
  const forced = refs.forceFieldId
    ? fields.find(function (f) { return f.id === refs.forceFieldId; }) || null
    : null;
  const resolved = forced
    ? { field: forced, ambiguous: false, contenders: [], reason: 'chosen by the operator' }
    : resolveEnterprise(
        fields, invoice, fieldCands,
        lineMatches.map(function (m) { return m.product; }),
        programs
      );
  const field = resolved.field;
  const acres = invoice.acres != null
    ? Number(invoice.acres)
    : (field ? ((field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0) : 0);

  // Where else this invoice number already appears. A DeLong invoice covering
  // two fields is a real pattern (#8003075 does), so this is a note, not a
  // block — but landing the same invoice on the wrong field twice is exactly
  // the double entry we're trying to prevent, so it has to be visible.
  const elsewhere = [];
  if (invoice.invoiceNumber) {
    fields.forEach(function (f) {
      if (field && f.id === field.id) return;
      const hit = (f.inputs || []).some(function (i) {
        return i.invoiceNumber && String(i.invoiceNumber) === String(invoice.invoiceNumber);
      });
      if (hit) elsewhere.push(f.name);
    });
  }

  // Each line claims its OWN planned row. 91 of our fields carry the same
  // product on two input lines (two passes), and an invoice can bill the same
  // product twice — without this, both lines grab the first open row and one
  // silently overwrites the other.
  const claimed = {};

  const rows = lineMatches.map(function (m, i) {
    const line = m.line;
    const prodCands = m.prodCands;
    const product = m.product;

    const row = {
      lineIndex: i,
      description: line.description,
      invoiceQty: line.quantity,
      invoiceUnit: line.unit,
      unitPrice: line.unitPrice,
      lineTotal: line.total,
      paid: !!line.paid,
      productCandidates: prodCands.map(toCand('name')),
      productId: product ? product.id : null,
      productName: product ? product.name : null,
      inputId: null,
      plannedRate: null,
      plannedQtyTotal: null,
      actualRate: null,
      qtyDelta: null,
      status: UNKNOWN_PRODUCT,
      note: null
    };

    // The enterprise question comes before the product question. An invoice we
    // cannot place on one enterprise cannot write anything, whatever it bills,
    // and saying so is more useful than reporting a product miss on a line that
    // was never going to be applied.
    if (resolved.ambiguous) {
      row.status = AMBIGUOUS;
      row.note = resolved.reason;
      return row;
    }
    if (!product) {
      row.note = 'No product in the reference list matches this description.';
      return row;
    }
    if (!field) {
      row.status = NEW_LINE;
      row.note = 'Field not matched — pick one above before applying.';
      return row;
    }

    // Find the planned input row for this product on this field. A field can
    // carry the same product twice (two passes); prefer an unconfirmed row, and
    // among those the one whose season matches the invoice date.
    const inputs = field.inputs || [];
    const hits = inputs
      .map(function (inp, idx) { return { inp: inp, idx: idx }; })
      .filter(function (h) { return coreName(h.inp.productName) === coreName(product.name); });

    // Already on file? Prefer an exact line-level match — a row written by this
    // pipeline records which invoice line it came from, so an invoice that
    // bills the same product twice maps to two rows, not one. Rows entered by
    // hand before this existed have no line index, so fall back to the invoice
    // number alone.
    const sameLine = hits.find(function (h) {
      return h.inp.invoiceNumber && String(h.inp.invoiceNumber) === String(invoice.invoiceNumber) &&
        h.inp.invoiceLineIndex === i;
    });
    const sameInvoiceLegacy = hits.find(function (h) {
      return h.inp.invoiceNumber && String(h.inp.invoiceNumber) === String(invoice.invoiceNumber) &&
        h.inp.invoiceLineIndex == null && !claimed[h.inp.id];
    });
    const sameInvoice = sameLine || sameInvoiceLegacy;
    if (sameInvoice) {
      claimed[sameInvoice.inp.id] = true;
      row.status = ALREADY;
      row.inputId = sameInvoice.inp.id;
      row.plannedRate = sameInvoice.inp.quantity;
      row.actualRate = sameInvoice.inp.actualQuantity;
      row.note = 'Already confirmed from invoice ' + invoice.invoiceNumber + '.';
      return row;
    }

    const open = hits.filter(function (h) {
      return h.inp.passStatus !== 'confirmed' && !claimed[h.inp.id];
    });

    // A field can plan the same product twice at different rates — phillhower
    // east has Basagran at 19.85 and at 31.57 OZ/ac. The invoice's as-applied
    // rate says which pass it is (32 OZ/ac is the 31.57 row, not the 19.85
    // one), so when several rows are open, take the one whose planned rate
    // sits closest to what was actually put on.
    let target = open.length ? open[0] : null;
    let ratePicked = false;
    if (open.length > 1) {
      const asApplied = Calc.invoiceRatePerAcre(product, line.quantity, acres, line.unit);
      if (asApplied != null) {
        open.sort(function (a, b) {
          const da = a.inp.quantity != null ? Math.abs(Number(a.inp.quantity) - asApplied) : Infinity;
          const db = b.inp.quantity != null ? Math.abs(Number(b.inp.quantity) - asApplied) : Infinity;
          return da - db;
        });
        target = open[0];
        ratePicked = true;
      }
    }

    if (!target) {
      const unclaimed = hits.filter(function (h) { return !claimed[h.inp.id]; });
      if (unclaimed.length) {
        claimed[unclaimed[0].inp.id] = true;
        row.status = CONFLICT;
        row.inputId = unclaimed[0].inp.id;
        row.note = 'Row already confirmed under invoice ' +
          (unclaimed[0].inp.invoiceNumber || '(none)') + ' — resolve by hand.';
        return row;
      }
      row.status = NEW_LINE;
      row.note = hits.length
        ? 'This invoice bills ' + product.name + ' more than once and every planned row on ' +
          field.name + ' is spoken for; applying adds another line.'
        : 'No planned line for this product on ' + field.name + '; applying adds one.';
      return row;
    }

    claimed[target.inp.id] = true;
    row.status = READY;
    row.inputId = target.inp.id;
    row.plannedRate = target.inp.quantity;
    row.plannedUnit = product.unit || null;
    if (ratePicked) {
      row.note = 'Field plans this product more than once — matched the pass whose planned rate (' +
        target.inp.quantity + ') is closest to what was applied.';
    }

    // The planned figure is a rate in the APPLICATION unit (Basagran is
    // 19.85 OZ/ac); the invoice bills in the PURCHASE unit (27 Gal). Comparing
    // them raw reported a delta of -2116.8 on a line that was really 16.75 Gal
    // planned against 27 billed. Convert the plan into whatever unit the
    // invoice used before subtracting — the mirror of Calc.invoiceRatePerAcre,
    // which multiplies by conversionRate going the other way.
    const appUnit = product.unit || '';
    const invUnit = line.unit || product.purchaseUnit || '';
    const conv = Number(product.conversionRate) || 1;
    const sameUnit = normalize(invUnit) === normalize(appUnit);

    if (acres > 0 && target.inp.quantity != null) {
      const plannedApp = Number(target.inp.quantity) * acres;
      row.plannedQtyTotal = Calc.round4(sameUnit ? plannedApp : plannedApp / conv);
      row.plannedQtyUnit = invUnit || null;
    } else {
      row.plannedQtyTotal = null;
      row.plannedQtyUnit = null;
    }

    row.actualRate = Calc.invoiceRatePerAcre(product, line.quantity, acres, line.unit);
    if (row.plannedQtyTotal != null && line.quantity != null) {
      row.qtyDelta = Calc.round4(Number(line.quantity) - row.plannedQtyTotal);
      if (row.plannedQtyTotal > 0) {
        row.qtyDeltaPct = Calc.round4(row.qtyDelta / row.plannedQtyTotal);
      }
    }
    return row;
  });

  // The invoice's own arithmetic is the first check that the transcription is
  // sound — if the lines don't add to the printed subtotal, something was misread.
  const lineSum = rows.reduce(function (s, r) { return s + (Number(r.lineTotal) || 0); }, 0);
  const subTotal = Number(invoice.subTotal);
  const totalsOk = !(subTotal > 0) || Math.abs(lineSum - subTotal) <= 0.02;

  return {
    invoiceNumber: invoice.invoiceNumber,
    vendor: invoice.vendor,
    invoiceDate: invoice.invoiceDate,
    comments: invoice.comments,
    acres: acres,
    subTotal: invoice.subTotal,
    prepayUsed: invoice.prepayUsed,
    amountDue: invoice.amountDue,
    confidence: invoice.confidence || 'medium',
    fieldId: field ? field.id : null,
    fieldName: field ? field.name : null,
    fieldCrop: field ? (field.crop || null) : null,
    // When the parcel carries several enterprises the candidate list becomes
    // the enterprise list — every crop on that ground, whether or not the name
    // matcher surfaced it — because that is the choice being asked for.
    fieldCandidates: (resolved.contenders.length ? resolved.contenders : fieldCands).map(toCand('name')),
    ambiguousEnterprise: !!resolved.ambiguous,
    enterpriseReason: resolved.reason || null,
    alsoOnFields: elsewhere,
    totalsOk: totalsOk,
    lineSum: Calc.round2(lineSum),
    rows: rows
  };
}

function toCand(labelKey) {
  return function (c) {
    return {
      id: c.item.id,
      label: c.item[labelKey],
      score: c.score,
      why: c.why,
      acres: c.acres != null ? c.acres : undefined,
      crop: c.crop != null ? c.crop : undefined,
      // Which of the billed products this enterprise actually plans — the
      // evidence behind the choice, shown so the operator can check it rather
      // than take the ranking on trust.
      plansBilled: c.programMatched && c.programMatched.length ? c.programMatched : undefined
    };
  };
}

module.exports = {
  normalize: normalize,
  coreName: coreName,
  dedupeTokens: dedupeTokens,
  matchFields: matchFields,
  matchProducts: matchProducts,
  proposeInvoice: proposeInvoice,
  parcelKey: parcelKey,
  enterprisesOnParcel: enterprisesOnParcel,
  plannedProductNames: plannedProductNames,
  resolveEnterprise: resolveEnterprise,
  STATUS: {
    READY: READY, NEW_LINE: NEW_LINE, UNKNOWN_PRODUCT: UNKNOWN_PRODUCT,
    ALREADY: ALREADY, CONFLICT: CONFLICT, AMBIGUOUS: AMBIGUOUS
  }
};
