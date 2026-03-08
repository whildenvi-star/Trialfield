# Phase 22: FSA Crop Sync Improvement - Research

**Researched:** 2026-03-04
**Domain:** Cross-module data aggregation, side-by-side comparison UI, vanilla JS SPA
**Confidence:** HIGH — all findings verified directly from source files

## Summary

The FSA crop sync feature already exists and is partially functional. The current `/api/sync-crops/preview` endpoint on the fsa-acres server (port 3002) fetches farm-budget fields from `/api/fields` and fuzzy-matches them to CLU records by field name, then proposes crop changes. The existing modal shows field-by-field proposals in a one-column-at-a-time view (current crop → proposed crop per CLU).

What the requirements call for is fundamentally different in scope: pull enterprise-level rollup data (not field-by-field data) from the farm-budget `/api/dashboard` endpoint, and build a crop-level side-by-side table showing FSA CLU acres vs farm-budget enterprise acres **per crop**. This is an aggregation view, not a field-by-field matching view. The new preview lives alongside the existing sync modal — it adds a new "acres comparison" panel, not a replacement.

The critical domain insight is that the farm-budget `/api/dashboard` response already contains `cropRows` arrays inside each `enterpriseSummaries` entry, where each `cropRow` has `{ crop, acres, unit, ... }`. These acre totals are the "macro rollup" referenced in the requirements. The FSA side already has `/api/rollup/by-crop` which returns crop-level acre totals from CLU records. The comparison is therefore: `dashboard.enterpriseSummaries[].cropRows[].acres` (budget) vs `rollupByCrop[].totalAcres` (FSA), grouped and summed by crop name.

The filtering requirements (exclude grass/non-crop CLUs, exclude reported CLUs) must be applied to the FSA side before computing FSA crop acre totals. The current `rollupByCrop` endpoint does not filter — it includes all CLU records. The server needs to compute a filtered rollup specifically for the sync preview.

**Primary recommendation:** Add a new `/api/sync-crops/enterprise-preview` server endpoint that fetches `http://localhost:3001/api/dashboard`, computes a filtered crop acre rollup from CLU records (excluding non-crop and reported), and returns a merged crop-by-crop comparison array. Render this in a new panel in fsa-entry.js above the existing sync proposals.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FSA-01 | Crop sync preview pulls enterprise-level data from farm-budget macro rollup (dashboard endpoint) including crop, acres, and enterprise details | `GET http://localhost:3001/api/dashboard` returns `enterpriseSummaries[].cropRows[]` with `{crop, acres}` per enterprise. Server-side proxy fetch is the established pattern in this codebase. |
| FSA-02 | Sync preview displays side-by-side comparison of FSA CLU acres vs farm-budget enterprise acres by crop | FSA side: filter CLU records client-side from `store.cluRecords`, compute crop totals. Budget side: sum `cropRows[].acres` across all enterprises by crop name. Render as two-column table in a panel. |
| FSA-03 | Only tillable CLUs with actual crop assignments are included in sync proposals (grass/non-crop CLUs excluded) | CLU records have `landClass`, `use`, and `crop` fields. Non-crop identification: `landClass` in `['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC']` OR `crop` in non-crop set (NC, nc, gls, GLS, CRP, idle, MIXED FORAGE/HAY, alfalfa, grass, intermediate wheatgrass). `use === 'forage'` also non-crop. Tillable filter: `landClass === 'Tillable'` OR (`landClass === ''` AND `use === 'grain'` OR `use === 'grain/seed'`). |
| FSA-04 | CLUs already marked as "reported" are excluded from sync proposals | Filter on `clu.reported === false`. Already supported by the data model (`reported` boolean on every CLU record). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | existing | Server-side proxy endpoint | Already in use on port 3002 |
| native fetch | Node built-in | Cross-app HTTP calls to port 3001 | Established pattern in fsa-acres/server.js (`cachedFetch` helper already present) |
| Vanilla JS | existing | Frontend rendering | Project-wide standard, no framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cachedFetch` (existing) | project utility | TTL-cached fetch with timeout and stale-on-error | Use for the dashboard endpoint call — already handles 5s timeout, 60s TTL, stale cache fallback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side proxy | Direct client fetch to port 3001 | Cross-origin blocked in browser; proxy is the established pattern |
| New endpoint | Reuse `/api/sync-crops/preview` | Existing endpoint does field-by-field matching, not crop-level rollup — different data shape |
| New endpoint | Extend `/api/season/status` | Season status is dashboard-only; sync preview needs user-actionable proposal data |

**Installation:** No new packages. All implementation uses existing infrastructure.

## Architecture Patterns

### Pattern 1: Server-Side Proxy with cachedFetch (ESTABLISHED)
**What:** fsa-acres server exposes `/api/budget/*` and `/api/grain-yield` proxy endpoints that server-side fetch from other apps and return merged/transformed data.
**When to use:** Whenever FSA app needs data from another app (port isolation, no CORS issues).
**Example:**
```javascript
// Source: fsa-acres/server.js lines 488-497 (established pattern)
app.get('/api/budget/fields', async function (req, res) {
  try {
    var resp = await fetch('http://localhost:3001/api/fields');
    if (!resp.ok) throw new Error('Farm budget returned ' + resp.status);
    res.json(await resp.json());
  } catch (err) {
    res.status(502).json({ error: 'Farm budget unavailable' });
  }
});
```

### Pattern 2: cachedFetch for Cross-App Calls (ESTABLISHED)
**What:** The `cachedFetch(url, ttlMs)` helper in fsa-acres/server.js handles timeout (5s abort), TTL (60s), and stale-cache-on-error. Use it for the dashboard endpoint.
**When to use:** Any cross-app GET in a server endpoint that may be called repeatedly.
**Example:**
```javascript
// Source: fsa-acres/server.js lines 81-101 (existing helper)
cachedFetch('http://localhost:3001/api/dashboard').then(function(dash) {
  // dash.enterpriseSummaries[].cropRows[] — each has {crop, acres}
  // dash.enterpriseSummaries[].enterprise — has {name, category}
});
```

### Pattern 3: Crop-Level Rollup from CLU Records (ESTABLISHED)
**What:** `rollupByCrop()` in fsa-acres/public/calc.js groups CLU records by crop and sums `fsaAcres`. The sync preview needs a filtered version that excludes non-crop and reported CLUs.
**When to use:** Computing FSA side of the comparison.
**Example:**
```javascript
// Pattern derived from rollupByCrop in fsa-acres/public/calc.js lines 47-68
// Apply filtering BEFORE grouping:
var tillableCrops = store.cluRecords.filter(function(r) {
  if (r.reported) return false;
  // Exclude non-crop land classes
  var NON_CROP_LC = ['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC'];
  if (NON_CROP_LC.indexOf(r.landClass) !== -1) return false;
  // Exclude non-crop use types
  if (r.use === 'forage') return false;
  // Exclude non-crop crops by name
  var NON_CROP_NAMES = ['nc', 'gls', 'crp', 'idle', 'mixed forage / hay', 'alfalfa',
    'grass', 'intermediate wheatgrass'];
  var cropLower = (r.crop || '').trim().toLowerCase();
  if (!cropLower) return false; // no crop = exclude
  if (NON_CROP_NAMES.indexOf(cropLower) !== -1) return false;
  return true;
});
```

### Pattern 4: Sync Preview Panel (ESTABLISHED)
**What:** The existing grain ticket yield sync preview in insurance.js (`ins-grain-sync` panel) shows a similar "preview before apply" pattern — hidden panel that becomes visible on button click, with "Apply All" action.
**When to use:** The new enterprise crop comparison panel should follow the same show/hide panel pattern used for the grain sync.
**Example:**
```javascript
// Source: fsa-acres/public/index.html lines 259-268 (reference pattern)
// Hidden panel that appears on button click:
// <div id="..." class="panel hidden">...</div>
// Revealed with: el.classList.remove('hidden')
```

### Pattern 5: Dashboard API Response Shape
**What:** The farm-budget `/api/dashboard` endpoint returns an object with `enterpriseSummaries[]` where each entry has `{ enterprise: {id, name, category, systemCodes}, cropRows: [{crop, acres, avgYield, unit, ...}], totals: {...} }`.
**When to use:** To extract budget-side crop acres for the comparison.
**Example:**
```javascript
// Source: farm-budget/public/calc.js lines 519-580 (computeDashboard)
// Response structure:
{
  conventional: [...],  // enterprise entries for conventional
  organic: [...],       // enterprise entries for organic
  enterpriseSummaries: [
    {
      enterprise: { id, name, category, systemCodes },
      cropRows: [
        { crop: 'Yellow Corn', acres: 1234.5, avgYield: 180, unit: 'Bu', ... },
        { crop: 'RR Soybeans', acres: 567.8, ... }
      ],
      totals: { acres: 1802.3, ... }
    },
    ...
  ],
  grandTotals: { acres: ... }
}
```

### Recommended Project Structure
```
fsa-acres/
├── server.js         # Add /api/sync-crops/enterprise-preview endpoint
├── public/
│   ├── fsa-entry.js  # Add enterprise preview panel rendering + button handler
│   └── index.html    # Add enterprise preview panel HTML + button
│   └── style.css     # Add .enterprise-preview-table styles if needed
```

### Anti-Patterns to Avoid
- **Fetching /api/fields for rollup:** The existing sync endpoint fetches `/api/fields` (individual field rows). For crop-level totals, fetch `/api/dashboard` instead — it already has the precomputed `cropRows` rollup.
- **Client-side cross-origin fetch:** Do not fetch `http://localhost:3001` directly from the browser — use the server-side proxy pattern.
- **Replacing the existing sync modal:** The new enterprise comparison is an additional panel/view, not a replacement for the field-level crop assignment sync. Both serve different purposes.
- **Fuzzy crop name matching on the client:** Keep crop name normalization (`normName()`) server-side in the endpoint, not duplicated in the frontend.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timeout/retry for cross-app fetch | Custom timeout logic | `cachedFetch()` (already in server.js) | Already handles AbortController, stale-on-error, 60s TTL |
| Crop name normalization | New normalize function | `normName()` (already in server.js line 534) | Already handles case, punctuation, whitespace |
| Crop name matching across sources | Custom matching | `normName()` for comparison, explicit non-crop lists | Crop names between budget and FSA may differ slightly — normalize both sides before comparing |

**Key insight:** The `cachedFetch` helper is already the right tool for the cross-app dashboard call. The `normName()` function is already the right tool for crop name comparison. No new utilities needed.

## Common Pitfalls

### Pitfall 1: Non-Crop CLU Identification
**What goes wrong:** Filtering only on `landClass === 'Tillable'` misses 442 of 444 records (only 2 CLUs have `landClass` set in the actual data). Most CLU records have `landClass: ''`.
**Why it happens:** The landClass field is newly added to the editor but rarely populated in existing data.
**How to avoid:** Use a compound filter: include CLUs where (`use === 'grain'` OR `use === 'grain/seed'`) OR `landClass === 'Tillable'`; exclude CLUs where `landClass` is in non-crop list OR `use === 'forage'` OR crop name is in non-crop name list OR crop is empty.
**Warning signs:** Preview shows 0 FSA acres even though CLU records exist with grain crops.

### Pitfall 2: Crop Name Mismatch Between Budget and FSA
**What goes wrong:** Budget calls the crop "Yellow Corn" while FSA records use "CORN" or "Corn" or leave it blank. Simple string equality fails to match.
**Why it happens:** No enforced vocabulary between the two apps.
**How to avoid:** Apply `normName()` (lowercase, strip punctuation/spaces) when grouping FSA crops and when grouping budget crops, then join on normalized names. Return both `displayName` (original) and `key` (normalized) in the response so the UI can show readable names.
**Warning signs:** Side-by-side shows all zeros on one side despite data existing.

### Pitfall 3: Double-Counting Split Fields
**What goes wrong:** Farm-budget fields with `splitGroupId` may be counted twice if both the parent and child fields are returned by `/api/fields`.
**Why it happens:** Split fields create sub-fields that share acres with a parent field that may still exist.
**How to avoid:** Use the `/api/dashboard` endpoint directly — its `computeDashboard` logic groups by `enterpriseId` which already handles splits correctly at the enterprise level. Do not sum from `/api/fields` directly.
**Warning signs:** Budget crop acres total exceeds known farm total acres.

### Pitfall 4: Dashboard Endpoint Performance
**What goes wrong:** `/api/dashboard` triggers `computeDashboard` which iterates all fields × all enterprises and calls `computeFieldBudget` on each. On 56 fields this is fast, but the preview should still use `cachedFetch` to avoid redundant calls.
**Why it happens:** Multiple clicks on "Sync from Macro" button would hammer the farm-budget server.
**How to avoid:** Use `cachedFetch('http://localhost:3001/api/dashboard', 60000)` — the 60s TTL is appropriate since budget data changes infrequently during a sync session.
**Warning signs:** Slow response or farm-budget server load spikes.

### Pitfall 5: "Reported" CLU Exclusion
**What goes wrong:** All 444 CLU records in the actual data have `reported: false`. FSA-04 says reported CLUs must be excluded — but the filtering must still be coded correctly for when reported = true records exist.
**Why it happens:** The app is actively being used for the 2026 season and nothing has been reported yet.
**How to avoid:** Filter `r.reported === false` explicitly. Do not skip this filter just because the current dataset has no reported records.
**Warning signs:** After user marks CLUs reported, they still appear in sync proposals.

## Code Examples

Verified patterns from source files:

### New Server Endpoint Pattern
```javascript
// Source: fsa-acres/server.js — follows established proxy + cachedFetch pattern
app.get('/api/sync-crops/enterprise-preview', async function (req, res) {
  try {
    var dash = await cachedFetch('http://localhost:3001/api/dashboard');
    if (!dash) throw new Error('Budget unavailable');

    // Build budget crop totals from enterprise summary cropRows
    var budgetByCrop = {};
    (dash.enterpriseSummaries || []).forEach(function (es) {
      var entName = es.enterprise ? es.enterprise.name : 'Unknown';
      var entCat = es.enterprise ? es.enterprise.category : '';
      (es.cropRows || []).forEach(function (cr) {
        var key = normName(cr.crop);
        if (!key) return;
        if (!budgetByCrop[key]) {
          budgetByCrop[key] = { displayName: cr.crop, budgetAcres: 0, enterprises: [] };
        }
        budgetByCrop[key].budgetAcres += cr.acres || 0;
        budgetByCrop[key].enterprises.push({ name: entName, category: entCat, acres: cr.acres });
      });
    });

    // Build FSA crop totals — exclude non-crop and reported CLUs
    var NON_CROP_LC = ['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC'];
    var NON_CROP_NAMES = ['nc', 'gls', 'crp', 'idle', 'mixed forage / hay', 'alfalfa',
      'grass', 'intermediate wheatgrass', ''];
    var fsaByCrop = {};
    store.cluRecords.forEach(function (r) {
      if (r.reported) return;
      if (NON_CROP_LC.indexOf(r.landClass) !== -1) return;
      if (r.use === 'forage') return;
      var cropLower = (r.crop || '').trim().toLowerCase();
      if (NON_CROP_NAMES.indexOf(cropLower) !== -1) return;
      var key = normName(r.crop);
      if (!key) return;
      if (!fsaByCrop[key]) fsaByCrop[key] = { displayName: r.crop, fsaAcres: 0, cluCount: 0 };
      fsaByCrop[key].fsaAcres += r.fsaAcres || 0;
      fsaByCrop[key].cluCount++;
    });

    // Merge into comparison rows
    var allKeys = new Set(Object.keys(budgetByCrop).concat(Object.keys(fsaByCrop)));
    var rows = [];
    allKeys.forEach(function (key) {
      var b = budgetByCrop[key] || {};
      var f = fsaByCrop[key] || {};
      var budgetAcres = round2(b.budgetAcres || 0);
      var fsaAcres = round2(f.fsaAcres || 0);
      rows.push({
        crop: b.displayName || f.displayName || key,
        budgetAcres: budgetAcres,
        fsaAcres: fsaAcres,
        diff: round2(fsaAcres - budgetAcres),
        cluCount: f.cluCount || 0,
        enterprises: b.enterprises || []
      });
    });

    rows.sort(function (a, b) { return b.budgetAcres - a.budgetAcres; });
    res.json({ rows: rows, grandBudgetAcres: round2(dash.grandTotals ? dash.grandTotals.acres : 0) });
  } catch (err) {
    res.status(502).json({ error: 'Farm budget unavailable — is port 3001 running?' });
  }
});
```

### Frontend Preview Rendering Pattern
```javascript
// Source: fsa-acres/public/fsa-entry.js — follows existing openSyncModal() pattern
function renderEnterprisePreview(data) {
  var rows = data.rows || [];
  var html = '<table class="sync-table"><thead><tr>' +
    '<th>Crop</th>' +
    '<th class="number">Budget Acres</th>' +
    '<th class="number">FSA Acres</th>' +
    '<th class="number">Difference</th>' +
    '<th>CLU Records</th>' +
    '</tr></thead><tbody>';

  rows.forEach(function (row) {
    var diffCls = Math.abs(row.diff) > 10 ? 'style="color:var(--danger)"' :
                  Math.abs(row.diff) > 2  ? 'style="color:var(--orange)"' : '';
    html += '<tr>' +
      '<td>' + util.esc(row.crop) + '</td>' +
      '<td class="number">' + util.comma(row.budgetAcres) + '</td>' +
      '<td class="number">' + util.comma(row.fsaAcres) + '</td>' +
      '<td class="number" ' + diffCls + '>' +
        (row.diff >= 0 ? '+' : '') + util.comma(row.diff) +
      '</td>' +
      '<td>' + row.cluCount + '</td>' +
    '</tr>';
  });
  html += '</tbody></table>';
  util.$('enterprise-preview-body').innerHTML = html;
}
```

### Non-Crop Detection Logic (Verified Against Actual Data)
```javascript
// Based on actual data.json analysis: 444 CLU records
// landClass distribution: '' (442), 'Tillable' (2)
// crop values: '' (177), 'NC'/'nc' (138), 'MIXED FORAGE / HAY' (41),
//              'CRP' (22), 'rye'/'organic rye' (22), 'gls'/'GLS' (15),
//              'idle' (8), 'intermediate wheatgrass' (8), 'organic wheat' (8)
// use values: '' (228), 'grain' (147), 'forage' (46), 'grain/seed' (23)

// INCLUDE in sync preview:
function isTillableCropCLU(r) {
  if (r.reported) return false;
  var NON_CROP_LC = ['Grass/GLS', 'CRP', 'Hay/Forage', 'Idle', 'NC'];
  if (NON_CROP_LC.indexOf(r.landClass) !== -1) return false;
  if (r.use === 'forage') return false;
  var crop = (r.crop || '').trim().toLowerCase();
  var NON_CROP_NAMES = ['', 'nc', 'gls', 'crp', 'idle',
    'mixed forage / hay', 'alfalfa', 'grass', 'intermediate wheatgrass'];
  if (NON_CROP_NAMES.indexOf(crop) !== -1) return false;
  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Field-by-field crop matching (existing) | Enterprise-level crop rollup comparison (new) | Phase 22 | Adds macro view — does not replace micro view |
| /api/fields for budget data | /api/dashboard for budget rollup | Phase 22 | Dashboard already has precomputed cropRows — no need to re-aggregate |

**Deprecated/outdated:**
- None — no deprecated patterns detected in this scope.

## Open Questions

1. **Should the enterprise comparison panel replace or augment the existing field-level sync modal?**
   - What we know: The existing sync modal (field-level) and the new enterprise comparison (crop-level) serve different purposes.
   - What's unclear: Whether both should be visible simultaneously or sequentially.
   - Recommendation: Make the enterprise comparison a collapsible panel above the existing sync modal, loaded when "Sync from Macro" is clicked. User sees macro picture first, then proceeds to field-level proposals.

2. **How to handle crops present in FSA but not in budget (and vice versa)?**
   - What we know: FSA has crops like 'rye', 'organic wheat' that may not appear in budget (and budget has crops not yet in FSA).
   - What's unclear: Whether zero-budget or zero-FSA rows should appear in the comparison.
   - Recommendation: Include all rows. Rows with `budgetAcres === 0` indicate crops in FSA not planned in budget. Rows with `fsaAcres === 0` indicate planned crops not yet assigned in CLU records. Both are useful signals.

3. **What acre threshold constitutes a "significant" discrepancy worth flagging?**
   - What we know: Requirements do not specify a threshold.
   - What's unclear: Whether 5-acre, 10-acre, or percentage differences should trigger red/yellow highlighting.
   - Recommendation: Use absolute difference: >10 acres = red (danger), 2-10 acres = orange (warn), ≤2 acres = neutral. These thresholds align with typical FSA measurement precision.

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/server.js` — Full server code, existing sync endpoint (lines 532-685), cachedFetch helper (lines 76-101), normName/syncMatchScore functions (lines 534-555)
- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/data/data.json` — Actual CLU record data (444 records, landClass distribution, crop field values)
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/server.js` — `/api/dashboard` endpoint (line 161) and data model
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/public/calc.js` — `computeDashboard` shape (lines 519-580), `cropRows` structure (lines 451-517)
- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/public/fsa-entry.js` — Existing sync modal (lines 408-519), established UI patterns
- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/public/index.html` — Tab structure, existing sync HTML elements
- `/Users/glomalinguild/Desktop/my-project-one/fsa-acres/public/app.js` — api helper, util, tab system
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/data/data.json` — Actual enterprise data (7 enterprises, 56 fields, crop names)

### Secondary (MEDIUM confidence)
- `/Users/glomalinguild/Desktop/my-project-one/.planning/REQUIREMENTS.md` — FSA-01 through FSA-04 requirements
- `/Users/glomalinguild/Desktop/my-project-one/.planning/STATE.md` — Project state and decisions

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new libraries, all existing infrastructure verified in source files
- Architecture: HIGH — established proxy and panel patterns verified in 3+ existing locations
- Pitfalls: HIGH — non-crop filter and crop name mismatch verified against actual data.json analysis (Python script run against 444 real records)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable — no external dependencies, all vanilla JS/Express)
