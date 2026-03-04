# Changelog

## 2026-03-04 — Inputs & Seeds Platform Overhaul

### Task 1: UI Redesign
- Added sub-navigation within the Reference tab, splitting content into five focused sections: Products, Implements, Suppliers, Unit/Packs, and Labor & Overhead. Eliminates long scroll through all reference data.
- Added sub-navigation within the Forecasts tab, splitting into Forecast Hub and Product Demand views.
- Unhid the Forecasts tab in main navigation (was previously hidden with `style="display:none"`).
- Added CSS for `.ref-sub-nav` / `.ref-sub-btn` sub-tab system matching the Glomalin terminal aesthetic — monospace font, lowercase text-transform, primary green active underline, no border-radius.
- Added demand table styles with status badges (color-coded by Pending/Ordered/Received) and type badges (Seed vs Input).
- All new components use existing Glomalin design tokens (`--primary`, `--card`, `--border`, `--font-mono`, etc.) — no new design patterns introduced.

### Task 2: Flexible Unit & Pack Quantity System
- Added `unitPacks` collection to the data store (`server.js`) with 11 default pack definitions:
  - Bag (50 lb, 80 lb), Tote (40 unit), ProBox (50 lb, 80 lb), Pallet (2000 lb), Jug (2.5 gal), Drum (55 gal), Bin (2000 lb), Unit, Each
- Each unit/pack entry stores: `name`, `packQty`, `packDesc` (free text), `packUom` (lbs, gallons, units, etc.)
- Added CRUD API endpoint `/api/unit-packs` via the existing `crudRoutes` factory.
- Added Unit & Pack Definitions management section in the Reference tab under the "Unit/Packs" sub-tab with inline editing and search/filter.
- Replaced hardcoded `PURCHASE_UNITS` and `APP_UNITS` arrays in `inputs-manager.js` with dynamic `getPurchaseUnits()` / `getAppUnits()` functions that merge default units with configured unit-pack names from `refData.unitPacks`.
- Added `unitPacks` to the app-wide reference data loading (`app.js`) — fetched on startup and available for selective reload via `reloadRefDataSelective('unit-packs')`.

### Task 3: Upstream Data Pull (Seeds, Inputs, Suppliers)
- Seeds entered in the Seeds tab are immediately available in the field-editor's seed variety dropdown. The existing `ref-data-loaded` event system already triggers `populateDropdowns()` which rebuilds the seed `<select>` from `window.refData.seeds`.
- Products entered in the Reference tab are immediately available in the field-editor's input product autocomplete. The autocomplete reads from `window.refData.products` which is updated on every `reloadRefDataSelective` call.
- Suppliers flow from the same upstream source via `window.refData.suppliers`, filtered by type (product/seed/landlord) at point of use.
- Added `seeds-data-changed` and `inputs-data-changed` custom events dispatched after mutations for downstream consumers.
- No manual sync or refresh required — data flows reactively through the `refData` system.

### Task 4: Product Demand Forecast Table
- Added `/api/demand` server endpoint that aggregates field inputs + seed assignments into a receiving manager view with order/delivery status enrichment.
- Created `demand-manager.js` — new module implementing the Product Demand Table UI.
- Table columns: Product Name, Type (Seed/Input badge), Supplier, Unit/Pack, Pack Qty, Total Units Expected, Ordered, Delivered, Delivery Window, Status.
- Status badges (Pending → Ordered → Received) are clickable to cycle through states.
- Filtering: search by product/supplier name, filter by status, filter by type (seed/input).
- Refresh button triggers a fresh `/api/demand` fetch.
- CSV Export: generates a date-stamped CSV file with all demand rows.
- Print View: opens a formatted HTML report in a new window with `window.print()` support for physical receiving area use.
- Demand quantities are derived from active field plans — input quantities × field acres for products, and population × acres / seedsPerUnit for seeds.

### Files Modified
- `server.js` — Added `unitPacks` to store, `/api/unit-packs` CRUD, `/api/demand` endpoint, default unit-pack seeding
- `public/app.js` — Added `unitPacks` to refData loading (12th API call), added to selective reload map, added sub-nav switching for Reference and Forecast tabs
- `public/index.html` — Restructured Reference tab with sub-navigation, added Unit/Pack section, restructured Forecasts tab with demand table, unhid Forecasts nav button
- `public/inputs-manager.js` — Replaced hardcoded units with dynamic functions, added unit-pack CRUD UI, added reactive data events
- `public/seed-manager.js` — Added reactive `seeds-data-changed` event dispatch
- `public/style.css` — Added sub-navigation styles, demand table styles, status/type badge styles
- `public/demand-manager.js` — New file: demand forecast table with filters, CSV export, print view

### Assumptions & TODOs
- `TODO`: Delivery window in demand table is derived from order dates when available; currently shows '--' for items without orders. Consider adding expected delivery dates to the order schema.
- `TODO`: Status cycling on demand table badges is client-side only (not persisted). To persist status overrides, add a `demandOverrides` collection to the data store.
- Pack quantity for input products defaults to 1 when no `unitPackId` is set on the product. Products can be linked to unit-pack definitions via `unitPackId` field (schema ready, UI linkage deferred).
