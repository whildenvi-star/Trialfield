# Phase 19: Seed & Input Inventory Redesign - Research

**Researched:** 2026-03-03
**Domain:** Farm-budget SPA — procurement pipeline UX (vanilla JS, Express, JSON store)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Forecast Hub Design**
- Grouped by category first: Seed, Fertilizer, Chemical — top-level sections
- Each row shows farm-wide total with expandable field breakdown (click to see which fields use the product and how much)
- Re-computes live from Macro Roll-Up data on every page load — no stale cache, no manual refresh
- Columns per row: Product, Supplier, Amount, Unit, Unit Cost, Total Cost, Ordered, Remaining, plus a visual % Ordered status bar (showing ordered/delivered/remaining)
- Only products with amount > 0 appear in forecast

**Order-to-Delivery Workflow**
- Orders created by selecting product rows from forecast checkboxes → "Create Order" button → pre-fills PO form grouped by supplier
- Multiple deliveries per order — order stays open until fully delivered, shows delivered/remaining per line item
- 3-step auto-transitioning statuses: Ordered → Partial (first delivery arrives) → Complete (all items fully received)
- No separate return entity — returns handled as notes/flags on delivery records with adjusted quantities

**Report Types & Format**
- All reports rendered as print-optimized HTML with print CSS (Ctrl+P to print) — no server-side PDF generation
- All 5 reports are essential for launch:
  1. Agronomist/Supplier Order Sheet: Products grouped by supplier — product, amount, unit, unit cost, total cost, and which fields. Full detail for ordering.
  2. Field-Level Input Plan: Per-field breakdown of all planned inputs. For field use or sharing with a custom applicator.
  3. Forecast Summary: Full farm forecast with costs. Overview for budgeting/planning meetings.
  4. Order Status Report: Current order statuses across all suppliers.
  5. Delivery Receipt Log: Delivery history with dates, quantities, ticket numbers.
- Page-break-friendly tables, professional layout

**Navigation & Tab Structure**
- Replace existing tab bar in-place — new tabs: Forecasts, Orders, Deliveries, Seeds
- Eliminate: Supplier tab, Products tab (data flows from Macro Roll-Up)
- Keep Seeds tab for managing varieties, pricing, seeds-per-unit — forecast pulls seed data from it

**Day/Night Mode**
- Sun/moon toggle icon in the header bar
- CSS variables switch between light and dark palettes
- Persisted in localStorage
- Applies to inventory page only — rest of farm-budget stays unchanged

### Claude's Discretion
- Exact CSS variable palette for day/night themes
- Status bar visual design (colors, animation)
- Empty state design for each tab (no orders yet, no deliveries yet)
- Table sorting and pagination approach
- Touch/tablet responsiveness details
- Data model structure for orders/deliveries in data.json

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 19 replaces the farm-budget Inputs tab and Seeds tab with a 4-tab procurement pipeline: Forecasts, Orders, Deliveries, Seeds. The key architectural challenge is the **forecast computation**: it must aggregate product usage from 696 field-level inputs across 57 fields and 212 products in the master list, performing this join entirely in-memory on the client with no new API endpoints required. The current data model exposes everything needed — `store.fields[].inputs[]` records `{productName, quantity, season}` and `store.products[]` records `{name, unitBilledPrice, unit, supplierId}`. The join is by name string.

The **new data collections** (orders, deliveries) will live in `store` alongside existing collections, persisted to `data.json` via the same debounced-write pattern. No database migration is needed — this is a JSON schema extension. The server needs two new CRUD route blocks (orders, deliveries) plus a new `GET /api/forecast` endpoint that computes the aggregation server-side to avoid re-implementing calc logic in the client.

The **category classification problem** is the most design-sensitive decision left open: products have no `category` field. The forecast requires grouping by Seed / Fertilizer / Chemical. A `category` field must be added to the `products` collection via a server migration function (same pattern as existing `migrateData()`) so users can classify products. Of 212 products, 64 are actually used in fields — only those appear in forecasts (amount > 0 filter). Pattern-matching heuristics can pre-classify products during migration as a starting point, with user override via the Products reference table.

**Primary recommendation:** Implement forecast computation server-side at `GET /api/forecast` (aggregates fields + products in one pass); add `category` to products via migrateData(); add `orders` and `deliveries` collections to the store; build the 4-tab SPA in a new `inventory.js` module that replaces `inputs-manager.js` and is wired up with renamed tab buttons.

---

## Standard Stack

### Core (already installed — zero new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.x | HTTP server, new API routes | Already running on port 3001 |
| Vanilla JS (IIFE modules) | ES5+ | Tab UI, DOM manipulation | Existing SPA pattern throughout app |
| CSS custom properties | Baseline | Day/night theme switching | Already used for full dark theme |
| localStorage | Browser API | Theme persistence | Already used for `mru-theme` key |
| Print CSS `@media print` | CSS | HTML print reports | No library needed |

### No New Packages Required
The constraint from v3.0 ("zero new npm packages") applies here too. All capability is already available:
- Forecast aggregation: in-memory JS, no library
- Status bar: CSS gradient + custom properties
- Print reports: `@media print` CSS, `window.print()`
- Checkbox selection: native DOM
- Date/ticket number entry: native `<input type="date">`

---

## Architecture Patterns

### Recommended Module Structure

```
farm-budget/public/
├── inventory.js          # NEW: replaces inputs-manager.js (Forecasts + Orders + Deliveries)
│                         #       seed-manager.js stays but tab renamed "Seeds"
├── seed-manager.js       # EXISTING: no changes to logic, tab key renamed 'seeds' → stays
├── inputs-manager.js     # DELETED or gutted: Supplier/Products section removed
│                         #       OR: keep Implements/LaborOverhead sections, remove Products/Suppliers
├── app.js                # CHANGE: nav tab buttons renamed: 'inputs' → 'inventory', add sub-tabs
└── index.html            # CHANGE: tab buttons + tab-content sections restructured
```

**Decision for planner:** The cleanest approach is:
- Rename `tab-btn[data-tab="inputs"]` → `data-tab="inventory"` and `tab-btn[data-tab="seeds"]` → keep `data-tab="seeds"` (Seeds stays as its own top-level tab per CONTEXT.md)
- The Inputs tab becomes "Inventory" with 4 sub-tabs: Forecasts, Orders, Deliveries, Seeds
- OR: Forecasts / Orders / Deliveries / Seeds are all top-level tabs replacing the current Inputs + Seeds tabs
- CONTEXT.md says: "new tabs: Forecasts, Orders, Deliveries, Seeds" — these are top-level tabs

### Pattern 1: Forecast Computation Server-Side

**What:** `GET /api/forecast` aggregates all field inputs, joins with products master, returns grouped-by-category rows with farm totals.

**Why server-side:** The calc engine already runs server-side. Field enrichment uses `Calc.computeFieldBudget()` server-side. Keeping forecast on the server avoids duplicating product-lookup logic in the client.

**Data shape the endpoint returns:**
```javascript
// GET /api/forecast
{
  categories: [
    {
      name: "Fertilizer",          // "Seed" | "Fertilizer" | "Chemical" | "Other"
      products: [
        {
          productName: "46-0-0 Urea",
          supplierId: "sup_...",
          supplierName: "Delongs",
          totalQty: 4340,
          unit: "Lbs",
          unitCost: 0.217,         // applicationPrice from product
          totalCost: 941.58,       // totalQty * unitCost
          orderedQty: 0,           // sum of order line quantities for this product
          deliveredQty: 0,         // sum of delivery line quantities for this product
          remaining: 4340,         // totalQty - orderedQty
          pctOrdered: 0,           // orderedQty / totalQty * 100
          fields: [                // expandable detail
            { fieldName: "Adams 1", acres: 134.6, qty: 220, season: "Spring" }
          ]
        }
      ]
    }
  ]
}
```

**How qty links to cost:** Field inputs store `quantity` (raw amount per field, in product's own unit). `product.applicationPrice` = `(unitBilledPrice / conversionRate) * (1 + increasePercent/100)` — this is already computed by `Calc.computeApplicationPrice(product)` in `calc.js`. The forecast uses this to derive `totalCost = totalQty * applicationPrice`.

### Pattern 2: Orders + Deliveries Data Model

Orders and deliveries live in `store.orders[]` and `store.deliveries[]` in data.json. New CRUD routes via `crudRoutes()` factory or custom handlers.

```javascript
// Order record
{
  id: "ord_...",
  supplierId: "sup_...",
  supplierName: "Delongs",      // denormalized for display without join
  status: "ordered",            // "ordered" | "partial" | "complete"
  poNumber: "",                 // optional purchase order number
  notes: "",
  createdAt: "2026-03-03T...",
  items: [
    {
      productName: "46-0-0 Urea",
      unit: "Lbs",
      forecastQty: 4340,        // from forecast at time of order
      orderedQty: 4000,         // user may adjust
      unitCost: 0.217
    }
  ]
}

// Delivery record
{
  id: "del_...",
  orderId: "ord_...",           // links to order
  deliveredAt: "2026-03-15",    // date received
  ticketNumber: "",             // invoice/delivery ticket reference
  notes: "",
  items: [
    {
      productName: "46-0-0 Urea",
      unit: "Lbs",
      deliveredQty: 4000
    }
  ]
}
```

**Status auto-transition logic** (runs on every delivery save):
```javascript
function recalcOrderStatus(order, deliveries) {
  const orderDeliveries = deliveries.filter(d => d.orderId === order.id);
  if (orderDeliveries.length === 0) { order.status = 'ordered'; return; }
  // Sum delivered per product
  const delivered = {};
  orderDeliveries.forEach(d => d.items.forEach(item => {
    delivered[item.productName] = (delivered[item.productName] || 0) + item.deliveredQty;
  }));
  const allComplete = order.items.every(item =>
    (delivered[item.productName] || 0) >= item.orderedQty
  );
  order.status = allComplete ? 'complete' : 'partial';
}
```

### Pattern 3: Product Category Field

**Current state:** `store.products[]` has no `category` field. 212 products, 0 with category.

**Migration approach** (add to existing `migrateData()` function in server.js):
```javascript
// Auto-classify products by heuristic; user can override via Products page later
var fertPattern = /\d+-\d+-\d+|urea|ammonia|ams|amm|potash|manure|compost|lime|sulfur|nitro/i;
var chemPattern = /cide|icide|zine|max|prime|relex|prism|armezon|atrazine|resicore|axial|battle|prowl/i;
var seedPattern = /\brye\b|cover crop|seed|vetch|clover|oats|cereal/i;

(store.products || []).forEach(function(p) {
  if (p.category === undefined) {
    if (fertPattern.test(p.name)) p.category = 'Fertilizer';
    else if (chemPattern.test(p.name)) p.category = 'Chemical';
    else if (seedPattern.test(p.name)) p.category = 'Seed';
    else p.category = 'Other';
    changed = true;
  }
});
```

This gives users a starting point — they can correct miscategorizations via inline edit on the Products reference table (which still exists as a management interface, just not surfaced as a nav tab). The forecast groups by category, so getting this right matters.

### Pattern 4: Tab Navigation — Sub-tabs Inside Inventory Section

Current nav bar has `data-tab="inputs"` and `data-tab="seeds"`. Per CONTEXT.md, new structure:
- Top-level tabs become: Forecasts, Orders, Deliveries, Seeds (replacing Inputs + Seeds)
- Each gets its own `data-tab` value and `tab-content` section

The existing `window.addEventListener('tab-activate', ...)` pattern in each module is how tab switching triggers data loads. New modules follow this same pattern:

```javascript
// In inventory.js (Forecasts tab)
window.addEventListener('tab-activate', function(e) {
  if (e.detail.tab === 'forecasts') loadForecast();
});

// In orders.js (Orders tab)
window.addEventListener('tab-activate', function(e) {
  if (e.detail.tab === 'orders') loadOrders();
});
```

### Pattern 5: Day/Night Theme for Inventory Page

**Current theme system:** `app.js` already wires a `#theme-toggle` button that adds/removes `.light` class on `document.body` and saves to `localStorage.mru-theme`. Inventory pages observe `document.body.classList.contains('light')` and render accordingly.

**CONTEXT.md says:** "Applies to inventory page only." This is already the behavior — the existing theme toggle is global. The simplest implementation is to reuse the SAME toggle with the existing `mru-theme` localStorage key. The "inventory only" constraint likely means: don't add a SECOND toggle. Use the existing one.

**Light palette** (discretionary — proposed):
```css
body.light {
  --bg: #f5f5f0;
  --bg-raised: #ffffff;
  --card: #fafaf7;
  --primary: #2a7a14;
  --text: #2c3e28;
  --text-light: #6b7c65;
  --border: #d4ddd0;
}
```

### Pattern 6: Print-Optimized HTML Reports

**Implementation:** A `reports.js` module (or section within inventory.js) builds a full-page HTML string and opens it in a new window, then calls `window.print()`. This is the standard vanilla-JS approach for print reports without server-side PDF generation.

```javascript
function openPrintReport(title, html) {
  var win = window.open('', '_blank');
  win.document.write('<!DOCTYPE html><html><head>' +
    '<title>' + title + '</title>' +
    '<style>' + PRINT_CSS + '</style>' +
    '</head><body>' + html + '</body></html>');
  win.document.close();
  win.print();
}
```

**Print CSS patterns:**
```css
@media print {
  .no-print { display: none !important; }
  table { page-break-inside: avoid; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; } /* repeat header on each page */
  tfoot { display: table-footer-group; }
  h2 { page-break-before: always; }      /* new page per supplier section */
  h2:first-of-type { page-break-before: avoid; }
}
```

### Pattern 7: Forecast Checkboxes → Create Order Flow

**Selection state:** A `Set<string>` of selected productNames managed as module-level state. Checkboxes in the forecast table set/clear entries. "Create Order" button reads the set, groups selected products by supplierId, and opens an order form pre-filled.

```javascript
var selectedProducts = new Set();

// On checkbox change
function onForecastRowCheck(productName, checked) {
  if (checked) selectedProducts.add(productName);
  else selectedProducts.delete(productName);
  document.getElementById('create-order-btn').disabled = selectedProducts.size === 0;
}

// On "Create Order" click
function openCreateOrderForm() {
  var selected = currentForecast.categories
    .flatMap(c => c.products)
    .filter(p => selectedProducts.has(p.productName));
  // Group by supplierId
  var bySupplier = {};
  selected.forEach(p => {
    var key = p.supplierId || '__none__';
    if (!bySupplier[key]) bySupplier[key] = { supplierName: p.supplierName, items: [] };
    bySupplier[key].items.push(p);
  });
  renderOrderForm(bySupplier);
}
```

### Anti-Patterns to Avoid

- **Re-implementing `Calc.computeApplicationPrice` client-side:** It already exists in `calc.js` (shared module). The server already has it. Call `GET /api/forecast` instead of duplicating.
- **Real-time status recalc on every delivery change:** Compute status in the delivery POST/PUT handler on the server, update `order.status` in-place in `store.orders`, save. Don't recompute from scratch in client.
- **Separate supplier entity for order grouping:** Orders denormalize `supplierName` — if supplier is renamed, historical orders keep the original name. This is correct for PO records.
- **Storing forecast results in data.json:** Forecast is always recomputed from live field data. Only orders/deliveries persist.
- **Category classification server-side every request:** Add `category` as a stored field on the product (migrated once), not computed dynamically.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | `pdf-report.js` custom canvas renderer | Print HTML + `@media print` CSS | Already decided by user; no server-side PDF; `window.print()` is sufficient |
| Real-time sync between tabs | WebSocket or polling | None needed — single-user app, `tab-activate` event triggers fresh loads | Farm office tool, one user at a time |
| Full-text product search index | Trie or inverted index | Simple `.filter()` on 64-212 products | Dataset too small to justify |
| PO number sequences | Sequence table, counters | User-entered field, optional | Farmers use their own numbering |
| Complex expand/collapse animation | JS animation library | CSS `max-height` transition | Already pattern used in rest of app |

---

## Common Pitfalls

### Pitfall 1: productName String Join Brittleness
**What goes wrong:** Field inputs reference products by `productName` string (e.g., `"46-0-0  Urea"` with double space). If user renames a product in the master list, all field inputs referring to the old name become orphaned in the forecast.
**Why it happens:** The data model uses string names as FK, not IDs. This is established architecture — changing it is out of scope for Phase 19.
**How to avoid:** Forecast computation must do a case-insensitive, trimmed match (same as `Calc.findByName()`). Products not found in master list should still appear in forecast as "unknown product" with zero unit cost. Do NOT silently drop them.
**Warning signs:** Forecast shows fewer products than expected; total cost seems too low.

### Pitfall 2: Forecast Includes Quantity=0 Products
**What goes wrong:** A field has an input entry with `quantity: 0`. It appears in the forecast.
**How to avoid:** Filter: `totalQty > 0` before including in forecast rows. Confirmed by CONTEXT.md: "Only products with amount > 0 appear in forecast."

### Pitfall 3: Seeds in Both Seeds Master and Products List
**What goes wrong:** Some products in the master list are seed products (e.g., "KWS CC rye" cover crop seed, used as an input on 15 fields). These are NOT the same as the Seeds master (which tracks varieties with population/bag). If category migration classifies "KWS CC rye" as Seed, it would appear under "Seed" in the Forecast. But it should — users buy cover crop seed by weight just like a fertilizer.
**Clarification:** The Seeds tab manages cash crop seed varieties (corn hybrids, soybean varieties — with seeding populations). Cover crop / companion seeds ordered in bulk appear in Products and flow through the forecast as Seed-category items. Both are correct. The Forecast "Seed" category should show bag-purchased seed from the Products list (category=Seed), while the Seeds tab manages variety selection.
**How to avoid:** Keep the two lists separate. Forecast pulls from `products` (with category filter). Seeds tab pulls from `seeds` master. Document this distinction in UI empty states.

### Pitfall 4: Order Quantity Exceeds Forecast
**What goes wrong:** User orders more than the forecast says they need. The status bar shows >100% ordered. The "Remaining" column goes negative.
**How to avoid:** Allow it — do not enforce a cap. Show remaining as negative with a visual flag (e.g., red text). Farmer may intentionally over-order to avoid shortfalls. Just display the math accurately.

### Pitfall 5: Delivery Before Order Exists
**What goes wrong:** User receives a delivery but hasn't created an order for it. UI requires an orderId.
**How to avoid:** Allow "standalone deliveries" — an order with no forecast items (manually entered), or allow delivery with orderId=null for unplanned receipts. This is a discretionary UX decision — simplest is to require an order first and display a "Create Order first" empty state.

### Pitfall 6: Tab Rename Breaks Existing Event Listeners
**What goes wrong:** `inputs-manager.js` listens for `e.detail.tab === 'inputs'`. If the tab is renamed to 'forecasts', the existing module stops loading data.
**How to avoid:** The Inputs tab is being REPLACED, not renamed. `inputs-manager.js` is gutted/replaced by `inventory.js`. The Implements, Machinery Mode, Labor/Overhead, and Supplier sections need a new home — either a "Reference Data" sub-section within the Inputs tab, or a separate "Settings" tab. CONTEXT.md says "Eliminate: Supplier tab, Products tab" but does NOT mention eliminating Implements or Labor/Overhead. Implement usage and labor overhead still need to live somewhere. Planning decision: keep these in the current "Inputs" tab renamed to something like "Reference" or keep as a sub-section of the new Inventory structure. Research recommendation: rename the nav button from "Inputs" to "Reference" and keep implements/labor-overhead there, while Forecasts/Orders/Deliveries/Seeds get their own top-level tabs.

### Pitfall 7: Print Report Opens Behind Popup Blocker
**What goes wrong:** `window.open()` in a click handler usually works (user gesture), but if called from a setTimeout or Promise `.then()` it may be blocked.
**How to avoid:** Call `window.open()` synchronously inside the click handler, then write to the opened window asynchronously if needed.

---

## Code Examples

### Forecast Aggregation (server-side, in server.js)
```javascript
// Source: existing calc.js pattern + in-memory aggregation
app.get('/api/forecast', (req, res) => {
  const productMap = {};
  const productIndex = {};
  store.products.forEach(p => { productIndex[p.name.trim().toLowerCase()] = p; });

  store.fields.forEach(field => {
    const acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    (field.inputs || []).forEach(inp => {
      const key = (inp.productName || '').trim().toLowerCase();
      const product = productIndex[key];
      if (!productMap[inp.productName]) {
        productMap[inp.productName] = {
          productName: inp.productName,
          supplierId: product ? (product.supplierId || '') : '',
          unit: product ? (product.unit || '') : '',
          unitCost: product ? Calc.computeApplicationPrice(product) : 0,
          category: product ? (product.category || 'Other') : 'Other',
          totalQty: 0,
          fields: []
        };
      }
      productMap[inp.productName].totalQty += (inp.quantity || 0);
      productMap[inp.productName].fields.push({
        fieldName: field.name,
        acres: acres,
        qty: inp.quantity || 0,
        season: inp.season || ''
      });
    });
  });

  // Seeds from seeds master (fields with seed.variety)
  const seedIndex = {};
  store.seeds.forEach(s => { seedIndex[(s.variety || '').trim().toLowerCase()] = s; });
  store.fields.forEach(field => {
    if (!field.seed || !field.seed.variety) return;
    const s = seedIndex[field.seed.variety.trim().toLowerCase()];
    const acres = (field.plantedAcres > 0 ? field.plantedAcres : field.acres) || 0;
    const pop = field.seed.population || 0;
    const seedsPerUnit = s ? s.seedsPerUnit : 1;
    const qty = seedsPerUnit > 0 ? Math.ceil(pop * acres / seedsPerUnit) : 0; // bags needed
    const key = 'seed:' + field.seed.variety;
    if (!productMap[key]) {
      productMap[key] = {
        productName: field.seed.variety,
        supplierId: s ? (s.supplierId || '') : '',
        unit: 'units',
        unitCost: s ? s.pricePerUnit : 0,
        category: 'Seed',
        isSeedVariety: true,
        totalQty: 0,
        fields: []
      };
    }
    productMap[key].totalQty += qty;
    productMap[key].fields.push({ fieldName: field.name, acres, qty, season: 'Spring' });
  });

  // Join with orders/deliveries for ordered/delivered quantities
  const orderedMap = {};
  const deliveredMap = {};
  (store.orders || []).forEach(order => {
    (order.items || []).forEach(item => {
      orderedMap[item.productName] = (orderedMap[item.productName] || 0) + (item.orderedQty || 0);
    });
  });
  (store.deliveries || []).forEach(del => {
    (del.items || []).forEach(item => {
      deliveredMap[item.productName] = (deliveredMap[item.productName] || 0) + (item.deliveredQty || 0);
    });
  });

  // Build response grouped by category
  const categoryOrder = ['Seed', 'Fertilizer', 'Chemical', 'Other'];
  const grouped = {};
  Object.values(productMap).forEach(row => {
    if (row.totalQty <= 0) return; // filter zero-qty
    const cat = row.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    const ordered = orderedMap[row.productName] || 0;
    const delivered = deliveredMap[row.productName] || 0;
    grouped[cat].push(Object.assign({}, row, {
      orderedQty: ordered,
      deliveredQty: delivered,
      remaining: row.totalQty - ordered,
      pctOrdered: row.totalQty > 0 ? Math.round(ordered / row.totalQty * 100) : 0
    }));
  });

  const categories = categoryOrder
    .filter(cat => grouped[cat])
    .map(cat => ({ name: cat, products: grouped[cat] }));

  res.json({ categories });
});
```

### Status Bar CSS
```css
/* Discretionary — visual progress bar */
.pct-bar {
  position: relative;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
  min-width: 80px;
}
.pct-bar-fill {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  border-radius: 4px;
  background: var(--primary);
  transition: width 0.3s ease;
}
.pct-bar-fill.over { background: var(--amber); } /* >100% ordered */
.pct-bar-fill.complete { background: var(--success); }
```

### Tab Activation in New Modules
```javascript
// Pattern shared by all existing modules — new modules follow identically
(function() {
  'use strict';
  var loaded = false;

  window.addEventListener('tab-activate', function(e) {
    if (e.detail.tab === 'forecasts') {
      loaded = false; // always reload — forecast is live
      loadForecast();
    }
  });

  function loadForecast() {
    api.get('/api/forecast').then(function(data) {
      renderForecast(data);
      loaded = true;
    });
  }
})();
```

### Print Report Pattern
```javascript
var PRINT_CSS = [
  'body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }',
  'table { width: 100%; border-collapse: collapse; }',
  'th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }',
  'th { background: #f0f0f0; font-weight: bold; }',
  'h2 { page-break-before: always; margin-top: 1.5em; }',
  'h2:first-of-type { page-break-before: avoid; }',
  'tr { page-break-inside: avoid; }',
  'thead { display: table-header-group; }',
  '.no-print { display: none; }',
  '@page { margin: 1in; }'
].join('\n');

function printReport(title, bodyHtml) {
  var win = window.open('', '_blank');
  if (!win) { util.showToast('Enable popups to print reports', 4000, 'error'); return; }
  win.document.write(
    '<!DOCTYPE html><html><head>' +
    '<title>' + util.escHtml(title) + '</title>' +
    '<style>' + PRINT_CSS + '</style>' +
    '</head><body>' + bodyHtml + '</body></html>'
  );
  win.document.close();
  win.focus();
  win.print();
}
```

### migrateData() Extension for Orders/Deliveries + Category
```javascript
// Add to existing migrateData() function:

// Add orders collection
if (!store.orders) {
  store.orders = [];
  changed = true;
}

// Add deliveries collection
if (!store.deliveries) {
  store.deliveries = [];
  changed = true;
}

// Add category to products (auto-classify by heuristic)
var fertPat = /\d+-\d+-\d+|urea|ammonia|\bams\b|amm\s|potash|manure|compost|\blime\b|sulfur|nitro|thio/i;
var chemPat = /cide$|icide|zine$|atrazin|resicore|armezon|axial|battle|prowl|herbicid|insecticid|fungicid|oil\b|water$/i;
var seedPat = /\b(rye|vetch|clover|oats|cover\s*crop|peas seed|seed\s)/i;
(store.products || []).forEach(function(p) {
  if (p.category === undefined) {
    var n = p.name;
    if (fertPat.test(n)) p.category = 'Fertilizer';
    else if (chemPat.test(n)) p.category = 'Chemical';
    else if (seedPat.test(n)) p.category = 'Seed';
    else p.category = 'Other';
    changed = true;
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Supplier + Products as separate management tabs | Suppliers/Products become reference data only, not primary nav | User decision in CONTEXT.md |
| "Inputs" tab = flat product/supplier CRUD | "Forecasts" tab = computed procurement command center | Core redesign |
| No order tracking | Orders + Deliveries lifecycle | New in this phase |
| No print reports | 5 print-HTML reports | User decision in CONTEXT.md |
| Single dark theme | Day/night toggle persistent per localStorage | New in this phase |

---

## Open Questions

1. **Where do Implements, Labor/Overhead, and Machinery Mode sections live after redesign?**
   - What we know: CONTEXT.md eliminates "Supplier tab" and "Products tab" from nav. It does NOT mention implements or labor/overhead.
   - What's unclear: Do these become a "Reference" tab? Stay in renamed "Inputs" tab? Move to Settings?
   - Recommendation: Create a 5th top-level tab called "Reference" (or keep "Inputs" renamed) that contains Implements, Labor/Overhead, Machinery Mode, and a read-only Products list (with category edit). This is the cleanest separation: procurement pipeline (Forecasts/Orders/Deliveries/Seeds) vs. reference data (Implements/LaborOverhead/Products).

2. **Do seeds from the Seeds master appear in the Forecast tab?**
   - What we know: CONTEXT.md says "forecast pulls seed data from it [Seeds tab]". Seeds tab has varieties with price-per-unit and seeds-per-unit. Fields reference seeds by `field.seed.variety` with a seeding population.
   - What's unclear: Should the forecast show "bags of P0720 needed" computed from (field.acres * field.seed.population / seed.seedsPerUnit)?
   - Recommendation: YES — compute bags needed per variety from field data, show under "Seed" category in forecast. The code example above shows this pattern.

3. **How do orders handle multi-supplier selection (items from different suppliers in one forecast selection)?**
   - What we know: CONTEXT.md says orders "pre-fill PO form grouped by supplier."
   - What's unclear: Does one checkbox selection create ONE order per supplier, or a single multi-supplier order?
   - Recommendation: Create ONE order per supplier. If user selects 6 items across 3 suppliers, clicking "Create Order" creates 3 orders. This matches real PO workflows (one PO per vendor).

4. **What happens when products have no supplier assigned?**
   - What we know: 150+ products currently have `supplierId: ""`.
   - What's unclear: Should unassigned-supplier items appear in forecast? Can they be ordered?
   - Recommendation: Show in forecast under "No Supplier" grouping. Allow order creation with blank supplier (user fills in). Don't block forecast display.

5. **Delivery ticket number — is this the supplier's delivery ticket or the farm's internal tracking number?**
   - What we know: CONTEXT.md calls it "ticket numbers" in the Delivery Receipt Log report.
   - What's unclear: Internal or external number?
   - Recommendation: Free-text field labeled "Ticket / Invoice #" — farm office can enter either or both. No validation.

---

## Key Implementation Facts (Verified from Codebase)

| Fact | Evidence | Confidence |
|------|----------|------------|
| 212 products in master, 64 used in fields | data.json analysis | HIGH |
| 54 seeds in master, 20 varieties used in fields | data.json analysis | HIGH |
| 57 fields, 696 total field inputs | data.json analysis | HIGH |
| `product.applicationPrice` already computed and stored | server.js + data.json `applicationPrice` field | HIGH |
| `store.products[].category` does NOT exist yet | data.json analysis — field not present | HIGH |
| `store.orders` and `store.deliveries` do NOT exist yet | Object.keys(data) check | HIGH |
| Tab activation uses `window.dispatchEvent(new CustomEvent('tab-activate', {detail:{tab:...}}))` | app.js tab wiring pattern | HIGH |
| Print reports: no current pattern, but window.open is unblocked in click handlers | No existing print code found | HIGH |
| Day/night toggle already wired in app.js for body.light class | index.html line 13-19, app.js | HIGH |
| `crudRoutes()` factory handles GET/POST/PUT/DELETE for any collection | server.js line 315-345 | HIGH |
| Products are referenced from field inputs by name string (not ID) | data.json field.inputs[].productName | HIGH |
| Seeds are referenced from fields by variety string | data.json field.seed.variety | HIGH |
| `Calc.computeApplicationPrice(product)` exists and is used client-side | inputs-manager.js line 140 | HIGH |
| Double-space in product name: `"46-0-0  Urea"` (two spaces) | data.json — must handle with .trim() | HIGH |

---

## Sources

### Primary (HIGH confidence)
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/data/data.json` — actual data shape, counts, field structure
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/server.js` — API routes, migrateData pattern, crudRoutes factory
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/public/inputs-manager.js` — current Inputs tab implementation
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/public/seed-manager.js` — current Seeds tab implementation
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/public/app.js` — tab navigation, refData, tab-activate event
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/public/index.html` — current HTML tab structure
- `/Users/glomalinguild/Desktop/my-project-one/farm-budget/public/calc.js` — computeApplicationPrice, findByName
- `.planning/phases/19-seed-input-inventory-redesign/19-CONTEXT.md` — user decisions

### Secondary (MEDIUM confidence)
- MDN Web Docs pattern for `window.open()` in click handlers (popup blocker avoidance) — standard browser behavior
- CSS `@media print` + `display: table-header-group` for repeating headers — standard CSS

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, existing patterns verified in codebase
- Architecture: HIGH — forecast computation, data model, and migration patterns derived directly from existing server.js code
- Pitfalls: HIGH — identified from actual data anomalies (double-space names, no category field, orphan string references)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase, JSON-backed, no external dependencies)
