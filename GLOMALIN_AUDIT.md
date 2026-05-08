# GLOMALIN PLATFORM AUDIT

**Date:** 2026-03-24
**Scope:** Full codebase review — 8 modules, 3 databases, 40+ API surfaces
**Reviewers:** UX/UI Designer, Product Manager, Full-Stack Engineer, Data Architect, Grain Marketing Expert, Crop Insurance Expert, Agronomy Expert, Organic Certification Expert

---

## 1. WHAT EACH MODULE ACTUALLY DOES TODAY

### farm-registry (port 3005) — Field Acre Registry
**Actually does:** Stores 56 fields with reporting acres, organic acres, ownership, aliases, landlord info, rent, and shapefiles. Serves as the canonical acre source for all other apps via client library (`FarmRegistry.autocomplete()`, `getFields()`). Proxies FSA CLU records from fsa-acres for side-by-side comparison. Supports shapefile upload with Turf.js acre computation.

**Does NOT do:** Track acre changes over time (no history). Validate that registry acres match FSA acres (shows delta but takes no action). Handle multi-grower operations. Auto-update rent when acres change.

### farm-budget (port 3001) — Single-Season Enterprise Planner
**Actually does:** Manages 6 enterprises (3 organic, 3 conventional) across 56 fields with per-field input/seed/machinery assignments, 10-category cost breakdowns, and projected profit. Fetches CBOT futures prices. Generates 5 HTML reports. Syncs field boundaries from Case IH FieldOps (mock mode). Pushes forecast data to seed-inventory via webhook. Has an Anthropic Claude chat agent for budget questions.

**Does NOT do:** Track multi-year budgets (rebuilt annually). Connect to QuickBooks for actual expenses. Auto-sync yields from grain-tickets into budget actuals. Generate crop plans that operators can view in the field.

### grain-tickets (port 3007) — Grain Traceability & Settlement
**Actually does:** Records grain tickets with moisture/FM/weight calculations, groups by farm, supports OCR scanning via Claude Vision, imports/exports CSV. Full settlement reconciliation: parse buyer CSV/Excel, auto-match by ticket number, fuzzy-match unmatched lines, dispute flagging with resolution tracking. Has a Claude chat agent ("Glomalin") with Gen Z personality. PostgreSQL + Prisma.

**Does NOT do:** Push yield data back to farm-budget or insurance. Export settlement reports. Connect to elevator APIs for automatic settlement import. Track grain storage inventory levels over time.

### fsa-acres (port 3002) — FSA Reporting & Insurance Tracker
**Actually does:** Manages CLU records for acreage reporting, crop insurance policies with indemnity calculations, USDA RMA price scraping, GCS conservation enrollment tracking. Cross-app seasonal dashboard pulling from all 4 Express apps. CSV/HTML reports. Enterprise-to-FSA crop reconciliation with fuzzy matching.

**Does NOT do:** File actual insurance claims (only tracks status). Connect to RMA for policy data (manual entry only). Auto-populate CLU records from FSA online (manual Excel import). Handle prevented planting calculations. Support SCO/ECO coverage types.

### seed-inventory (port 3006) — Procurement & Delivery Tracking
**Actually does:** Syncs product forecasts from farm-budget, manages suppliers, purchase orders, delivery receipts (with Claude Vision scanning of packing slips), returns/credits, and reconciliation (forecast vs ordered vs delivered vs returned). Exports organic reconciliation CSV. Multi-product batch deliveries with delivery group IDs.

**Does NOT do:** Auto-create orders from forecasts. Track lot-level organic chain-of-custody. Connect to organic-cert for seed lot verification. Alert when deliveries fall behind schedule.

### organic-cert (port 3004) — NOP Audit Trail System
**Actually does:** Full OCIA/NOP compliance tracking across C1.0-C19.0 categories. Compilation engine pulls live data from farm-budget, farm-registry, and grain-tickets (read-only "leech" pattern). Field enterprises with lot numbers, seed/material usage, field operations, fertility events, scouting logs, harvest events, storage/cleanout/loadout tracking, mass balance. Case IH FieldOps OAuth2 integration with operation staging/approval. Prisma 6 + PostgreSQL.

**Does NOT do:** Generate the complete OSP audit packet PDF (in progress). Auto-detect NOP violations (only records data). Connect to OCIA Integrity Database for buyer cert lookup. Handle split-operation fields automatically.

### meristem-malt (port 3003) — Malt Cost Calculator
**Actually does:** Break-even pricing calculator for micro-malting. Configurable variable/fixed/equipment/forgotten costs with what-if sliders (batches/year, batch size, selling price). Scenario comparison (pessimistic/base/optimistic). Organic vs conventional pricing for 8 grain types.

**Does NOT do:** Track actual production batches. Connect to grain-tickets for grain cost actuals. Generate invoices or sales records. Export reports.

### glomalin-portal (port 3010) — Unified Portal & FSA/Insurance/Claims
**Actually does:** Next.js 14 hub with Supabase auth, RBAC (admin/agronomist/operator/viewer), module access control. Native modules: FSA-578 CLU workspace, insurance policy management with coverage matrix and payout simulator, claims Kanban with drag-drop stage management and deadline tracking, macro rollup dashboard. Embeds all Express apps via iframe. PWA with offline crop plan viewer (IndexedDB cache). ASCII banner strip with seasonal drone animation.

**Does NOT do:** Provide a unified search across modules. Show a single timeline of all farm activity. Connect the FSA module to the fsa-acres Express app (separate data stores). Auto-sync insurance yields from grain-tickets reliably.

---

## 2. EVERY BROKEN OR MISSING CONNECTION BETWEEN MODULES

### CRITICAL: Duplicate Data Stores (Portal vs Express)

| Data | Portal (Supabase) | Express App | Connected? |
|------|-------------------|-------------|------------|
| CLU records | `clu_records` table | `fsa-acres/data/data.json` | **NO** — two independent copies |
| Insurance policies | `insurance_policies` table | `fsa-acres/data/data.json` | **NO** — two independent copies |
| Insurance pricing | `insurance_pricing` table | `fsa-acres/data/data.json` | **NO** — two independent copies |
| GCS enrollments | `gcs_enrollments` table | `fsa-acres/data/data.json` | **NO** — two independent copies |
| Fields | `farm-registry/data/data.json` | `farm-budget/data/data.json` | Partial — manual "Sync from Registry" button |
| Farms | `grain-tickets` Prisma DB | `fsa-acres/data/data.json` | **NO** — separate farm lists |

### BROKEN: One-Way Data Flows That Should Be Two-Way

1. **grain-tickets → farm-budget:** Grain tickets have actual yields per farm/crop. Farm-budget has a "yieldMode=actual" toggle but fetches from portal, not grain-tickets directly. The pipeline is: grain-tickets → (manual) → portal insurance `actual` field → (fetch) → farm-budget. Farmers must manually update yields in 2-3 places.

2. **grain-tickets → insurance (portal):** The portal has a "Sync Yield" button on insurance policies that calls `/api/insurance/yield-sync`, but the matching is fuzzy (farm name + crop) and doesn't reliably connect because grain-tickets farms and portal insurance farms use different naming conventions.

3. **farm-budget → organic-cert:** The compilation engine reads from farm-budget, but only organic enterprises. If an enterprise category is wrong or a field is miscategorized, the compile silently skips it — no warning to the user.

4. **fsa-acres → portal FSA module:** The portal's FSA-578 module and the fsa-acres Express app store CLU records in completely separate databases. Changes in one don't appear in the other. A farmer editing CLU data in the portal will not see those changes when opening the embedded fsa-acres app.

5. **seed-inventory → organic-cert:** Endpoints exist (`/api/organic/seed-lots`, `/api/organic/materials`) but organic-cert never calls them. Organic-cert compiles seed data from farm-budget instead, missing lot numbers, cert numbers, and delivery verification data that only seed-inventory has.

### MISSING: Connections That Don't Exist

6. **grain-tickets → organic-cert harvest:** The compilation engine reads grain-ticket data for harvest events, but only by HTTP fetch at compile time. There's no live feed — if tickets are added after compilation, the organic-cert harvest data is stale until the next manual compile.

7. **farm-budget programs → fsa-acres crops:** Farm-budget has "programs" (agronomic templates by enterprise/crop) that define what gets planted where. FSA-acres has a separate crop assignment workflow. These should be the same data but aren't connected.

8. **farm-registry rent → farm-budget rent:** Farm-registry stores `totalRentDollars` per field. Farm-budget stores `rentPerAcre` per field. The "Sync from Registry" button copies acres but not rent calculations — rent data can drift between apps.

9. **portal claims → fsa-acres insurance:** The portal has a full claims Kanban workflow. The fsa-acres insurance tab has a separate `claimStatus` field (none/potential/filed/paid). These are disconnected — filing a claim in the portal doesn't update fsa-acres.

10. **meristem-malt → grain-tickets:** Malt grain cost is manually entered. Should pull organic barley/rye prices from grain-tickets settlement data.

---

## 3. EVERY PLACE A FARMER WOULD GET STUCK OR CONFUSED

### Navigation & Discovery
1. **Two FSA systems:** A farmer opens the portal, sees the "FSA Acres" module card, and enters CLU data. Later they open the embedded fsa-acres app (also accessible from portal) and see completely different CLU data. Which is correct? Neither knows about the other.

2. **Insurance in three places:** Insurance policies exist in the portal's native Insurance module, in the embedded fsa-acres Insurance tab, and partially referenced in farm-budget's `cropInsurancePerAcre` field. A farmer updating coverage in one place has no idea the other two exist.

3. **Module embed confusion:** Clicking "Farm Budget" in the portal opens an iframe to port 3001. The iframe has its own header, tabs, and navigation. The portal's back button doesn't work inside the iframe. The farmer is now in a UI-within-a-UI with no clear way to get back except the browser back button.

4. **No unified search:** A farmer wants to find "Schultz 80" — which app has it? They must open farm-registry, grain-tickets farm summary, farm-budget field editor, and fsa-acres separately to find all references.

### Data Entry Pain
5. **Manual yield entry across modules:** After harvest, a farmer enters ticket weights in grain-tickets. Then they must manually enter actual yields in fsa-acres insurance. Then they must manually enter actual yields in the portal insurance module. Three separate entries of the same harvest data.

6. **Field name mismatches:** Farm-registry calls it "Blue's", farm-budget calls it "Blues", grain-tickets might call it "BLUES" or "Blue's 80". The alias system in farm-registry helps, but each app has its own fuzzy-matching implementation with different tolerance levels.

7. **Crop name inconsistency:** FSA uses "CORN", farm-budget uses "Yellow Corn", grain-tickets uses "Conv Corn", insurance uses "Corn". The sync-crops fuzzy matcher in fsa-acres tries to bridge this but requires manual review of every match.

8. **New field setup requires touching 4 apps:** To add a field, a farmer must: (1) add to farm-registry, (2) sync in farm-budget, (3) add CLU records in fsa-acres AND/OR portal FSA module, (4) create a farm entry in grain-tickets. There's no single "add field" workflow.

### Workflow Dead Ends
9. **Insurance claim filed, now what?** The portal claims Kanban lets you drag a claim through stages (notice → filed → adjuster → review → settled → closed), but there's no integration with actual insurance company processes. No document templates, no adjuster contact forms, no settlement calculation verification.

10. **Organic compile with missing data:** The compilation engine silently skips fields that don't match by name/alias. A farmer runs compile, sees 40 of 56 fields — where are the other 16? No error log, no "unmatched fields" list in the UI.

11. **Settlement reconciliation doesn't close the loop:** Grain-tickets reconciliation identifies variance between farm weights and buyer weights, but there's no workflow to resolve the variance (e.g., file a weight discrepancy claim with the elevator).

12. **Prevented planting checkbox with no calculation:** Both portal and fsa-acres have a "prevented planting" toggle on CLU records and insurance policies, but neither app calculates the prevented planting indemnity (which uses a different formula than yield loss).

### Visual/UX Confusion
13. **Inconsistent color schemes:** The portal uses dark navy (#080a0f) with teal (#14b8a6) accent. Farm-budget uses dark slate with neon green (#4af626) accent. Fsa-acres uses dark soil (#080604) with amber (#C8860A). Three different dark themes across one platform.

14. **No breadcrumb or context trail:** In the portal, navigating from Dashboard → FSA → CLU detail → Insurance cross-link opens insurance with a `?highlight=` param, but there's no breadcrumb showing where you came from or how to get back to the CLU you were editing.

15. **Dashboard shows module cards, not farm status:** The portal dashboard shows "FSA Acres Reporting" and "Insurance Management" as cards. A farmer wants to see "What do I need to do today?" — but the dashboard doesn't surface actionable items like overdue claims, unreconciled settlements, or unreported CLUs.

---

## 4. EVERY PLACE DATA IS ENTERED MANUALLY THAT SHOULD BE AUTOMATIC

| Manual Entry | Where | Should Come From | Why It's Not |
|---|---|---|---|
| Actual yield per insurance policy | Portal insurance + fsa-acres insurance | grain-tickets farm summaries | Fuzzy farm name matching unreliable |
| CLU records | Portal FSA module (manual add) | USDA FSA online acreage reporting system | No API exists (USDA provides Excel only) |
| Insurance policy details | Portal insurance + fsa-acres insurance | Agent's policy declarations page (PDF/email) | No OCR/import for policy docs |
| Crop assignment per field | fsa-acres, farm-budget, portal FSA | Farm-budget enterprise/crop assignment (single source) | Three separate crop assignment UIs |
| Field acres in farm-budget | Farm-budget field editor | Farm-registry (sync button exists but manual) | Could auto-sync on registry save |
| Farm metadata in grain-tickets | Grain-tickets farm summary | Farm-registry fields | Separate farm model, manual creation |
| Grain prices in meristem-malt | Meristem-malt pricing table | Grain-tickets settlement average prices | No connection |
| Seed lot/cert numbers for organic | Organic-cert seed management | Seed-inventory receipts with lot numbers | Endpoint exists, not called |
| Insurance pricing (spring/fall) | Portal `insurance_pricing` + fsa-acres pricing | USDA RMA (fsa-acres has scraper, portal doesn't) | Portal duplicated data without scraper |
| Crop insurance per acre in budget | Farm-budget field editor | Portal insurance `premium_per_acre` | No connection |
| GCS enrollment data | Portal `gcs_enrollments` + fsa-acres GCS tab | FSA/NRCS enrollment records | Manual entry in both places |
| Buyer list in grain-tickets | Grain-tickets proxies from farm-budget | Should be shared reference data | Proxy works but buyers owned by farm-budget |

---

## 5. SCHEMA PROBLEMS CAUSING THE SCATTERED DATA FEELING

### Problem 1: Three Database Technologies, No Shared Schema
- **Supabase PostgreSQL** (portal): profiles, module_access, clu_records, insurance_policies, claims, gcs_enrollments, field_observations
- **Local PostgreSQL + Prisma** (grain-tickets, organic-cert): tickets, farms, settlements, field_enterprises, harvest_events, etc.
- **JSON files** (farm-budget, farm-registry, fsa-acres, seed-inventory, meristem-malt): each with its own field/farm/crop model

There is no shared field ID, farm ID, or crop ID across any of these systems. Connections rely on **string name matching** with app-specific fuzzy matchers.

### Problem 2: Field Identity Crisis
A single physical field has up to 6 different representations:
- `farm-registry`: `{ id: "fld_0533", name: "Blue's", aliases: ["Blues", "Blue's"] }`
- `farm-budget`: `{ id: "fld_0533", name: "Blues", registryFieldName: "" }` (registryFieldName often empty)
- `fsa-acres`: `{ fieldName: "Blues", farmNumber: "1", tractNumber: "1", clu: "1" }`
- `grain-tickets`: `{ farm: "Blues" }` (loose text field, no FK)
- `portal clu_records`: `{ field_name: "Blues", farm_number: "1", tract_number: "1", clu: "1" }`
- `organic-cert`: `{ name: "Blues", registryId: "fld_0533" }` (sometimes linked)

### Problem 3: Crop Identity Crisis
No canonical crop list. Each app defines crops differently:
- `farm-budget`: cropTypes hierarchy (Corn → Yellow Corn, Organic Corn, etc.)
- `grain-tickets`: cropConfig per year (Hybrid Rye, Org SRWW, etc.)
- `fsa-acres`: free-text crop field with `FSA_CROP_LIST` suggestions
- `portal`: 44-item `FSA_CROP_LIST` array for typeahead
- `organic-cert`: inherited from farm-budget enterprises

### Problem 4: Duplicated FSA/Insurance Data
The portal (v6.0) rebuilt FSA and insurance modules in Supabase, but the original fsa-acres Express app still exists and is embedded in the portal via iframe. Both are actively used. Neither syncs to the other. This is the single biggest source of user confusion.

### Problem 5: No Temporal Dimension
- Farm-budget is rebuilt every year (single-season). No historical budgets.
- Farm-registry has no acre history (current snapshot only).
- Grain-tickets has `cropYear` but no cross-year analysis.
- Insurance policies have `policy_year` but no multi-year APH tracking.
- Organic-cert tries to build 3-year NOP history from annual compilation snapshots, but depends on farm-budget which has no history.

### Problem 6: Inconsistent Farm/Grower Model
- Farm-registry: single grower (`W. Hughes Farms`), fields belong to grower
- Farm-budget: no grower concept, just enterprises and fields
- Grain-tickets: `Farm` model with name/crop/acres (overlaps with fields)
- Fsa-acres: `farms` array with farmNumber/farmName
- Portal: no farm model — CLU records have farm_number/farm_name as text

"Farm" means different things in each app: sometimes it's the whole operation, sometimes it's a named field, sometimes it's an FSA farm number.

---

## 6. DOMAIN GAPS — THINGS A REAL FARMER NEEDS THAT DON'T EXIST

### Grain Marketing Expert Assessment
1. **No contract position tracking:** Farm-budget has a Sales tab with grain contracts, but there's no "position" view showing: total production estimate → contracted bushels → unpriced bushels → delivery schedule. A grain marketer needs to see their exposure at a glance.

2. **No basis tracking over time:** Buyers offer different basis at different times. There's no historical basis data to inform marketing decisions. The current sales tab captures a single basis per contract.

3. **No delivery scheduling:** Contracts have delivery windows, but there's no calendar showing when grain needs to move and which bin/elevator it should go to.

4. **No settlement P&L per contract:** Settlements reconcile weights, but there's no per-contract financial summary showing: contract price × delivered bushels - deductions = net revenue.

### Crop Insurance Expert Assessment
5. **No APH database:** Actual Production History is the foundation of crop insurance. The system has `aph` as a field on CLU records but no structured APH database tracking 4-10 years of actual yields per unit. The `computeAphFromClus()` function just averages whatever CLU aph values exist.

6. **No unit structure management:** Insurance units (basic, optional, enterprise, whole-farm) determine how APH is calculated. The system has `unit_type` as a text field with no structural implications — it doesn't group fields into units or compute unit-level APH.

7. **No premium calculation:** The system stores `premium_per_acre` as a manual entry. Real premium depends on coverage level, unit type, APH, commodity price, county rate — none of which are computed.

8. **No multi-peril support:** Only RP, RP-HPE, and YP plan types exist. No support for prevented planting endorsement, replant payment, quality adjustment, or late planting provisions — all of which affect real claims.

### Agronomy Expert Assessment
9. **No field activity timeline:** Farm-budget has `machinery` (planned passes) and organic-cert has `FieldOperation` (confirmed passes), but there's no unified timeline showing: "Field X: planted corn April 15, sprayed herbicide May 2, side-dressed nitrogen June 1, combined October 5." The v9.0 mobile app plans to address this but isn't built yet.

10. **No variable-rate prescription management:** Fields have flat rate inputs (220 lbs/ac of urea across the whole field). No support for management zones, variable-rate prescriptions, or yield-map-based fertility recommendations.

11. **No soil test tracking:** Soil tests drive fertility decisions. There's no place to record soil test results (pH, P, K, OM, CEC) and tie them to input decisions.

12. **No weather integration:** No growing degree day tracking, rainfall monitoring, or frost alerts. Weather drives nearly every agronomic decision.

### Organic Certification Expert Assessment
13. **No buffer zone enforcement:** organic-cert has `BufferZone` and `AdjacentLandUse` models, but there's no spatial validation that organic fields actually maintain required 25ft+ buffers. Would require shapefile/geometry analysis.

14. **No input compliance checking:** Materials have `nopStatus` (allowed/prohibited/restricted) but the system doesn't prevent application of prohibited materials to organic fields. A restricted material applied without documented necessity would be a compliance violation.

15. **No transaction certificate generation:** When selling organic grain, buyers require a Transaction Certificate (TC) showing lot number, quantity, organic status, and certification. The system has lot numbers and CropLot records but no TC generation workflow.

16. **No split-operation audit trail:** For fields transitioning between organic and conventional (or vice versa), the audit trail must clearly document the transition timeline. The system stores `certStatus` as a point-in-time value with no transition history.

---

## 7. TOP 15 PROBLEMS RANKED BY OPERATIONAL IMPACT

| Rank | Problem | Impact | Affects |
|------|---------|--------|---------|
| **1** | **Duplicate FSA/Insurance data stores** (portal Supabase vs fsa-acres JSON) | Farmer enters data in wrong place, gets wrong answers, makes wrong insurance decisions | FSA reporting, Insurance, Claims |
| **2** | **No automatic yield flow** from grain-tickets to insurance/budget | Manual triple-entry of harvest data; delayed/wrong insurance claim decisions | Insurance, Budget, Grain Tickets |
| **3** | **Field identity fragmentation** across 6 apps with string matching | Sync failures, unmatched records, farmer re-enters field data per app | All modules |
| **4** | **No actionable dashboard** — portal dashboard shows module cards, not farm status | Farmer doesn't know what needs attention today; misses deadlines, unreported CLUs | Portal, all workflows |
| **5** | **Crop name inconsistency** across apps with no canonical list | Fuzzy matching fails for edge cases; crop-level reports aggregate incorrectly | Budget, FSA, Insurance, Grain Tickets |
| **6** | **No grain marketing position view** (contracted vs unpriced bushels) | Farmer can't see price exposure; makes marketing decisions without full picture | Budget Sales, Grain Tickets |
| **7** | **No structured APH database** for crop insurance | Insurance guarantees based on guesswork, not 4-10 year production history | Insurance, FSA |
| **8** | **Iframe embed UX breaks navigation** — no breadcrumbs, nested headers, broken back button | Farmer gets lost in UI-within-UI, abandons task, loses trust in platform | Portal + all embeds |
| **9** | **No field activity timeline** combining planned passes, confirmed operations, and FieldOps data | Organic-cert can't verify NOP compliance; agronomist can't see what actually happened vs what was planned | Organic-cert, Budget, Mobile |
| **10** | **seed-inventory organic data not connected to organic-cert** | Organic-cert compiles seed data from farm-budget (missing lot numbers, cert numbers, delivery verification) | Organic-cert, Seed Inventory |
| **11** | **No prevented planting calculation** despite toggle existing in UI | Farmer toggles prevented planting, expects indemnity estimate, gets nothing | Insurance, FSA |
| **12** | **Three inconsistent color schemes** across portal and embedded apps | Visual jarring when switching modules; feels like 3 different products, not one platform | All UI |
| **13** | **Adding a new field requires touching 4 apps** | 15+ minutes of duplicated data entry per field; error-prone, usually skipped for some apps | Registry, Budget, FSA, Grain Tickets |
| **14** | **No settlement financial summary** linking grain contracts to settlement payments | Farmer can reconcile weights but can't answer "did I get paid correctly on my HTA contract?" | Grain Tickets, Budget Sales |
| **15** | **Meristem-malt disconnected** from grain prices and production data | Malt cost estimates use stale manual prices; no feedback loop from actual production | Meristem Malt, Grain Tickets |

---

## 8. GSD PROMPT FOR EACH OF THE TOP 15 FIXES

### Fix 1: Consolidate FSA/Insurance to Single Data Store

```
/gsd:add-phase

Phase Name: Consolidate FSA & Insurance Data — Single Source of Truth
Phase Goal: Eliminate the duplicate FSA/insurance data stores by making the portal's Supabase tables the single source of truth and converting fsa-acres into a read-only view that queries the portal API.

Context:
- Portal has clu_records, insurance_policies, insurance_pricing, gcs_enrollments in Supabase
- fsa-acres has the same data in data/data.json
- Both are actively used — farmer doesn't know which is correct
- fsa-acres has features the portal doesn't: USDA RMA price scraper, seasonal dashboard, crop sync, GCS management, reports
- Portal has features fsa-acres doesn't: claims Kanban, coverage matrix, payout simulator

Plan approach:
1. Add missing fsa-acres features to portal API routes (USDA scraper, GCS CRUD, seasonal dashboard, reports)
2. Migrate fsa-acres data.json records to Supabase (one-time script with duplicate detection)
3. Convert fsa-acres Express app to read from Supabase API (replace local JSON reads with fetch calls to portal)
4. Remove write endpoints from fsa-acres server.js — all writes go through portal
5. Keep fsa-acres UI for backwards compatibility but it now reads/writes portal data
6. Add data migration verification: row counts, acre totals, field checksums

Success criteria:
- Zero duplicate records across portal and fsa-acres
- All FSA/insurance writes go through one API
- fsa-acres seasonal dashboard + reports still work (reading from portal)
- USDA RMA scraper updates portal insurance_pricing table
```

### Fix 2: Automatic Yield Pipeline (Grain Tickets → Insurance → Budget)

```
/gsd:add-phase

Phase Name: Automatic Yield Pipeline — Grain Tickets to Insurance to Budget
Phase Goal: When grain tickets are entered/updated, automatically compute farm-level actual yields and push them to insurance policies and farm-budget, eliminating triple manual entry.

Context:
- grain-tickets has Ticket model with farm, crop, netWeight, cropYear + calc.js computing netBU
- Portal insurance_policies has 'actual' field (yield per acre) and 'actual_synced_from_grain' boolean
- Farm-budget has yieldPerAcre per field and yieldMode=actual toggle
- Current "Sync Yield" button in portal does fuzzy matching but is unreliable due to name mismatches
- grain-tickets farm model has reportingAcres (from farm-registry) for yield/acre calc

Plan approach:
1. Add farm-registry field ID to grain-tickets Farm model (registryId FK) — enables exact matching
2. Create yield summary endpoint in grain-tickets: GET /api/yield-summary?cropYear=2026 returning { fieldId, registryFieldName, crop, totalBU, acres, yieldPerAcre }
3. Add webhook in grain-tickets server.js: after ticket save, POST yield summary to portal /api/insurance/yield-sync-webhook
4. Portal yield-sync-webhook: match by registryFieldName → farm_name on insurance_policies, update actual + set actual_synced_from_grain=true
5. Farm-budget: change /api/actuals-from-portal to also accept direct grain-tickets yield data, prefer grain-tickets as source
6. Add visual indicator in all three UIs: "Yield synced from grain tickets ✓ [timestamp]"

Success criteria:
- Entering a grain ticket auto-updates insurance policy actual yield within 5 seconds
- Farm-budget dashboard shows actual yields from grain-tickets without manual entry
- Zero manual yield entry required after harvest
```

### Fix 3: Canonical Field Registry with Shared IDs

```
/gsd:add-phase

Phase Name: Canonical Field Identity — Registry IDs Everywhere
Phase Goal: Every module references fields by farm-registry ID (not string name), eliminating fuzzy matching failures and enabling reliable cross-module joins.

Context:
- farm-registry has 56 fields with stable IDs (fld_0001 through fld_0056) and aliases
- farm-budget has registryFieldName (often empty) — should be registryFieldId FK
- grain-tickets Farm model has registryId (exists but not populated)
- fsa-acres CLU records have fieldName (text, no FK)
- portal clu_records have field_name (text, no FK)
- organic-cert Field has registryId (sometimes linked)

Plan approach:
1. farm-budget: populate registryFieldId on all 56 fields using name/alias matching (one-time backfill script)
2. grain-tickets: populate Farm.registryId for all farms using name/alias matching (one-time script)
3. portal clu_records: add registry_field_id column (uuid), backfill from farm-registry name match
4. fsa-acres: add registryFieldId to CLU records (backfill script)
5. organic-cert: verify all Field.registryId values are populated (backfill gaps)
6. All cross-module fetches: switch from name matching to ID-based joins
7. farm-registry client library: add getFieldById(registryId) method
8. New field workflow: farm-registry POST creates field → returns ID → other apps use ID

Success criteria:
- Every field record in every app has a registryFieldId that maps to farm-registry
- Cross-module data joins use ID, not string name
- Adding a new field in farm-registry auto-propagates to other apps via ID
```

### Fix 4: Actionable Farm Dashboard

```
/gsd:add-phase

Phase Name: Actionable Dashboard — What Needs Attention Today
Phase Goal: Replace the portal's module-card dashboard with a unified action-oriented view showing overdue items, upcoming deadlines, data gaps, and key metrics across all modules.

Context:
- Current dashboard: 3 summary cards (FSA reported count, insurance alerts, open claims) + module grid
- Farmer opens dashboard and sees "Insurance Management — coming soon" cards, not actionable status
- fsa-acres has a "Season" tab that aggregates cross-app status — portal dashboard should do the same
- Data available: CLU reporting progress, claim deadlines, unreconciled settlements, stale yields, unreported fields, delivery shortfalls

Plan approach:
1. Create portal API: GET /api/dashboard/actions that aggregates:
   - Unreported CLU records (count, list of farm/field)
   - Claims with approaching/overdue deadlines (from claims table)
   - Insurance policies with potential claims (actual < guarantee)
   - Unreconciled grain ticket weight (from grain-tickets /api/reconciliation/season-summary)
   - Seed delivery progress (from seed-inventory /api/reconciliation)
   - Stale field data (registryFieldId missing, no current-year CLU)
2. Redesign dashboard page: action cards at top (red/amber/green urgency), metrics row, then module shortcuts
3. Each action card links to the relevant module with context (e.g., "3 claims overdue" → claims page filtered to overdue)
4. Add "last 7 days activity" feed (recent ticket entries, claim stage changes, CLU reports)
5. Promise.allSettled across all data sources — graceful degradation if an app is down

Success criteria:
- Farmer sees top 5 action items within 2 seconds of login
- Every action item links directly to the fix (not just the module)
- Dashboard works even if 1-2 Express apps are offline (shows available data)
```

### Fix 5: Canonical Crop Registry

```
/gsd:add-phase

Phase Name: Canonical Crop List — Single Source for All Apps
Phase Goal: Create a shared crop registry in farm-registry (or portal) that all apps reference, eliminating crop name mismatches across FSA, budget, insurance, and grain tickets.

Context:
- farm-budget has cropTypes hierarchy (name, color, cbotSymbol, pricingMode)
- grain-tickets has CropConfig per year (cropName, testWeight, moistureShrink, discount)
- fsa-acres has FSA_CROP_LIST (44 strings)
- portal has FSA_CROP_LIST (same 44 strings) in fsa-crop-list.ts
- organic-cert inherits crop names from farm-budget enterprises
- Each app uses different names for the same crop (e.g., "Yellow Corn" vs "Corn" vs "CORN" vs "Conv Corn")

Plan approach:
1. Define canonical crop model in farm-registry: { id, canonicalName, fsaName, budgetNames[], grainTicketNames[], category: "row_crop"|"small_grain"|"forage"|"specialty", organic: boolean }
2. Populate with all known crop name variants mapped to canonical entries
3. Add farm-registry endpoint: GET /api/crops (returns canonical list with all aliases)
4. Each app: replace hardcoded crop lists with fetch from farm-registry /api/crops
5. Each app: store canonical crop ID alongside display name
6. Cross-module queries: join on canonical crop ID, not display name

Success criteria:
- Single place to add/rename a crop — all apps reflect the change
- Cross-module crop aggregation (FSA acres by crop, insurance by crop, yield by crop) all use same grouping
- No more fuzzy crop name matching needed
```

### Fix 6: Grain Marketing Position View

```
/gsd:add-phase

Phase Name: Grain Marketing Position Dashboard
Phase Goal: Build a marketing position view in farm-budget (Sales tab) showing production estimate → contracted → unpriced → delivery schedule per crop, with real-time CBOT pricing.

Context:
- farm-budget Sales tab: has grain contracts (crop, buyer, basis, cbotPrice, complete status) but no position summary
- farm-budget calc.js: computes total production per enterprise (yieldPerAcre × acres)
- grain-tickets: has actual delivered bushels per buyer per crop
- farm-budget futures: fetches live CBOT prices (ZCZ26, ZSX26, ZWN26)
- Missing: "How many bushels of corn do I have left to price?"

Plan approach:
1. Add position summary component to Sales tab: per-crop table showing:
   - Estimated production (from enterprise budgets: yieldPerAcre × acres)
   - Contracted (sum of sales by crop, grouped by contract type)
   - Delivered (sum from grain-tickets via proxy)
   - Unpriced = Estimated - Contracted
   - Current value of unpriced = Unpriced × current CBOT price
2. Add contract type support: cash, accumulator, HTA, options, min-price, basis
3. Add delivery schedule: per-contract delivery window with calendar view
4. Add basis history: track basis offered per buyer over time
5. Wire to existing hedging.js module (currently receives hedging-data-ready event)

Success criteria:
- Farmer sees unpriced bushels per crop at a glance
- Dollar exposure calculated from live CBOT prices
- Delivery schedule shows what needs to move and when
```

### Fix 7: Structured APH Database

```
/gsd:add-phase

Phase Name: Structured APH Database for Crop Insurance
Phase Goal: Build a proper APH (Actual Production History) tracking system that maintains 4-10 years of yield records per unit, computes insurance guarantees, and feeds the existing insurance workflow.

Context:
- Current: clu_records have a single 'aph' numeric field (point-in-time snapshot)
- Insurance guarantee = APH × coverage_level × price — but APH is just a manually-entered number
- Real APH: 4-10 year actual yield history per insurance unit, with substitution rules for low-yield years
- grain-tickets has actual yields (could backfill historical APH from past crop years)
- Needed: multi-year yield records, unit grouping, computed APH with proper RMA substitution formulas

Plan approach:
1. Create Supabase table: aph_records { id, farm_number, unit_number, crop, crop_year, actual_yield, acres_planted, acres_harvested, cause_of_loss, approved_yield, source (manual|grain_tickets|agent) }
2. Create Supabase table: aph_summaries { id, farm_number, unit_number, crop, computed_aph, yield_count, last_computed, method (simple_avg|transitional) }
3. Backfill from grain-tickets: query yield per farm per crop per year for available history
4. APH calculation engine: simple average (exclude zero-yield disaster years), transitional yield floor (RMA T-yield by county/crop)
5. Wire to insurance policy creation: auto-populate guarantee from aph_summaries
6. UI: APH management page showing yield history table per unit with trend chart

Success criteria:
- APH computed from actual yield history, not manually guessed
- Insurance guarantee auto-calculated from APH × coverage level
- Adding grain tickets for a new crop year auto-updates APH
```

### Fix 8: Eliminate Iframe Navigation Problems

```
/gsd:add-phase

Phase Name: Embed Navigation — Breadcrumbs, Back Button, Unified Header
Phase Goal: Fix the iframe embed UX so farmers can navigate between portal and embedded apps without getting lost, seeing duplicate headers, or losing their place.

Context:
- Portal embeds 6 Express apps via iframe at /embed/* paths
- Each Express app has its own header bar with title + theme toggle (duplicate chrome)
- Browser back button navigates iframe history, not portal history
- No breadcrumbs showing portal > module > current view
- Clicking portal nav while inside embed doesn't reliably exit the iframe context

Plan approach:
1. Express apps: detect iframe context via window.parent !== window or ?embed=true query param
2. When embedded: hide app header bar (title + theme toggle) — portal header is sufficient
3. Portal embed-frame.tsx: add breadcrumb bar above iframe showing [Dashboard > Module Name]
4. Portal embed-frame.tsx: add "back to portal" escape hatch button (fixed position, always visible)
5. Express apps: post message to parent on internal navigation (window.parent.postMessage({ type: 'nav', path: '...' }))
6. Portal: listen for postMessage nav events, update breadcrumb
7. Unified theme: Express apps inherit portal theme via postMessage or query param (already partially implemented via ?theme=)

Success criteria:
- No duplicate header bars when embedded
- Breadcrumb always shows where you are relative to portal
- "Back to Dashboard" always visible and works in one click
- Browser back button returns to portal, not iframe history
```

### Fix 9: Unified Field Activity Timeline

```
/gsd:add-phase

Phase Name: Unified Field Activity Timeline
Phase Goal: Create a single chronological timeline per field showing all activities (planned passes from budget, confirmed operations from organic-cert, FieldOps machine data, and grain ticket deliveries) in one view.

Context:
- farm-budget: field.machinery[] = planned passes (implementId, season, passes count)
- organic-cert: FieldOperation model (date, type, operator, equipment, passStatus PLANNED|CONFIRMED)
- farm-budget/fieldops: synced applications and yield history from Case IH
- grain-tickets: ticket records with date, farm, crop (harvest events)
- v9.0 mobile app: intended to be the field pass confirmation UI but not built yet
- No single view combining all of these

Plan approach:
1. Define activity union type: { date, type (planting|application|tillage|harvest|scouting|delivery), source (budget|organic-cert|fieldops|grain-tickets|mobile), fieldRegistryId, details, status (planned|confirmed|synced) }
2. Create portal API: GET /api/fields/:registryId/timeline?year=2026 that aggregates from all sources via Promise.allSettled
3. Render as chronological feed on field detail page (portal native page, not iframe)
4. Color-code by source; icon by activity type
5. Click to expand: show source-specific details (e.g., grain ticket shows weight/moisture, budget shows input name/rate)
6. This becomes the foundation for v9.0 mobile field pass confirmation

Success criteria:
- Single page shows every recorded activity for a field in chronological order
- Planned activities (from budget) appear with "planned" badge until confirmed
- Data from all 4 sources appears without manual re-entry
```

### Fix 10: Connect Seed-Inventory to Organic-Cert

```
/gsd:add-phase

Phase Name: Seed-Inventory → Organic-Cert Lot & Certificate Pipeline
Phase Goal: Organic-cert compilation engine reads seed lot numbers, OMRI certificates, and delivery verification data from seed-inventory instead of farm-budget, providing complete NOP seed documentation.

Context:
- seed-inventory has: lot numbers (from receipts), organic cert numbers (from product overlays), OMRI flags, delivery verification (Claude Vision scan), supplier details
- organic-cert has: SeedLot model (certNumber, supplier, lotNumber, organic boolean) and SeedUsage (linking seed to field enterprises)
- Currently: organic-cert compiles seed data from farm-budget (only has variety/price, no lot/cert numbers)
- seed-inventory already exposes: GET /api/organic/seed-lots and GET /api/organic/materials (unused)

Plan approach:
1. organic-cert ecosystem client: add seed-inventory HTTP client (port 3006, with embed token)
2. Compilation engine: replace farm-budget seed source with seed-inventory /api/organic/seed-lots
3. Map seed-inventory lot records to organic-cert SeedLot model (certNumber, lotNumber, supplier, organic, omriListed)
4. Compilation preview: show seed lot details with cert numbers and verification status
5. NOP C9.0 report section: auto-populate from seed-inventory data (variety, source, organic status, commercial availability documentation)
6. Add "unverified seeds" warning if any organic seed receipt lacks cert number

Success criteria:
- Organic-cert seed section shows lot numbers and cert numbers from actual deliveries
- NOP C9.0 audit section auto-populated from seed-inventory
- No manual re-entry of seed lot data in organic-cert
```

### Fix 11: Prevented Planting Calculation

```
/gsd:add-phase

Phase Name: Prevented Planting Indemnity Calculation
Phase Goal: When a farmer marks a CLU as "prevented planting" in the portal, auto-calculate the prevented planting indemnity using RMA rules (60% of guarantee for most crops, 55% for some).

Context:
- Portal clu_records: has prevented_planting boolean
- Portal insurance_policies: has prevented_planting boolean + prevented_planting_acres numeric
- fsa-acres insurance: has preventedPlanting boolean + preventedPlantingAcres
- Neither calculates prevented planting indemnity
- RMA rules: PP payment = PP coverage factor × guarantee × price × PP acres
- PP coverage factor: 60% for most crops, 55% for some (soybeans in some counties)

Plan approach:
1. Add PP constants to portal fsa/calc.ts: PP_COVERAGE_FACTOR = { default: 0.60, soybeans: 0.55 }
2. computeInsurancePolicy: if prevented_planting, calculate ppIndemnity = ppFactor × guarantee × highestPrice × ppAcres
3. Portal insurance UI: show PP indemnity estimate when prevented_planting toggled on
4. Portal CLU workspace: when prevented_planting toggled on a CLU, cross-reference linked insurance policy and show estimated payment
5. Add prevented_planting_factor to insurance_policies table (allow override for county-specific rules)

Success criteria:
- Toggling prevented planting shows estimated payment instantly
- Calculation uses correct RMA coverage factors
- PP indemnity appears in insurance PDF report
```

### Fix 12: Unified Design Tokens Across All Apps

```
/gsd:add-phase

Phase Name: Unified Color Scheme — One Theme Across All Apps
Phase Goal: Align all 8 apps to a single dark theme (portal's navy/teal) using shared platform-tokens.css, so the platform feels like one product.

Context:
- Portal: bg #080a0f, accent #14b8a6 (teal), text #cbd5e1
- Farm-budget: bg #080a0f, accent #4af626 (neon green), text #e0e0e0
- Fsa-acres/farm-registry/meristem-malt: bg #080604, accent #C8860A (amber), text #e8d8c0
- All apps already load platform-tokens.css (shared file) but each overrides with local style.css
- settings-panel.js already handles day/night toggle across apps

Plan approach:
1. Update platform-tokens.css: set canonical dark theme (portal values: bg #080a0f, surface #0c1015, border #1e293b, accent #14b8a6, text #cbd5e1)
2. Update platform-tokens.css: set canonical light theme values
3. Each Express app style.css: remove local color variable overrides, inherit from platform-tokens.css
4. Each Express app: ensure CSS custom property usage (var(--bg), var(--accent)) instead of hardcoded hex
5. Farm-budget: change neon green accent to teal
6. Fsa-acres, farm-registry, meristem-malt: change amber accent to teal
7. Test light/dark toggle in all apps — both modes should match portal

Success criteria:
- Switching between portal and any embedded app shows zero color jarring
- All 8 apps use identical bg, surface, border, accent, and text colors
- Day/night toggle produces consistent results everywhere
```

### Fix 13: Single "Add Field" Workflow

```
/gsd:add-phase

Phase Name: Single Add-Field Workflow with Auto-Propagation
Phase Goal: Adding a field in farm-registry automatically creates corresponding records in farm-budget, grain-tickets, and portal CLU — eliminating the need to touch 4 apps.

Context:
- Current: adding a field requires manual creation in farm-registry, then manual sync/creation in farm-budget, grain-tickets, fsa-acres/portal
- farm-budget has POST /api/fields/sync-registry (syncs acres, not creates)
- grain-tickets Farm model has registryId field (exists but not used for auto-creation)
- portal clu_records: no auto-creation from registry

Plan approach:
1. farm-registry server.js: after POST /api/fields (create), fire webhooks to:
   a. farm-budget POST /api/fields (create new field with registryFieldId, name, acres, ownership)
   b. grain-tickets POST /api/farms (create farm with registryId, name, acres)
   c. portal API (optional): create stub CLU records for new field (farm_number, field_name, registry_field_id)
2. Webhooks: fire-and-forget with 5s timeout, log failures, retry once
3. farm-budget: handle new field creation from webhook (assign to default enterprise based on organic status)
4. grain-tickets: handle new farm creation from webhook
5. UI: farm-registry "Add Field" form shows success message with links to new records in other apps

Success criteria:
- Adding one field in farm-registry creates records in all 3 downstream apps within 5 seconds
- Downstream records have correct registryFieldId for future syncs
- Failed webhook doesn't block farm-registry save (async, logged)
```

### Fix 14: Settlement Financial Summary

```
/gsd:add-phase

Phase Name: Settlement Financial Summary — Contract-Level P&L
Phase Goal: Add financial summary to grain-tickets showing per-contract and per-crop revenue from settlements, linking contract prices to delivered bushels and net payments.

Context:
- grain-tickets has: settlements with netPayment per line, linked to tickets
- farm-budget Sales tab has: contracts with cbotPrice, basis, crop
- grain-tickets reconciliation shows weight variance but no financial summary
- Farmers need: "On my 50,000 bu corn contract at $5.75 basis, I delivered 48,200 bu, got paid $X, deductions were $Y, net was $Z"

Plan approach:
1. grain-tickets: add GET /api/settlements/financial-summary?cropYear=2026 endpoint
   - Group settlement lines by buyer + crop
   - Sum: delivered bushels, gross payment (netBushels × price), deductions, net payment
   - Compare to contract terms (from farm-budget /api/sales proxy)
2. grain-tickets settlements.js: add "Financial Summary" sub-tab
   - Table: buyer, crop, contracted BU, delivered BU, contract price, avg settlement price, gross, deductions, net, variance
   - Totals row per crop
3. Link back to farm-budget sales: "View Contract" deep link
4. Export: CSV financial summary report

Success criteria:
- Farmer sees total revenue per buyer per crop from actual settlements
- Contract price vs settlement price variance highlighted
- Deductions itemized and totaled
```

### Fix 15: Connect Meristem-Malt to Grain Prices

```
/gsd:add-phase

Phase Name: Meristem-Malt — Live Grain Prices from Grain Tickets
Phase Goal: Meristem-malt grain cost pulls actual prices from grain-tickets settlement data instead of manual entry, ensuring malt cost estimates reflect real market prices.

Context:
- meristem-malt: grainCostPerBushel is manually entered per grain type (conv_barley, org_barley, etc.)
- grain-tickets: settlements have price per bushel for each crop
- grain-tickets: GET /api/reconciliation/season-summary returns per-crop averages
- meristem-malt has 8 grain types: conv/org × corn/barley/wheat/rye

Plan approach:
1. meristem-malt server.js: add proxy endpoint GET /api/grain-prices that fetches from grain-tickets /api/reconciliation/season-summary
2. Map grain-tickets crop names to meristem-malt grain types (e.g., "Org Barley" → org_barley)
3. UI: "Sync Grain Prices" button on pricing table that pulls latest settlement averages
4. Auto-fill grainCostPerBushel from settlement data (manual override flag to prevent overwrite)
5. Show "last synced from grain tickets" timestamp on pricing table
6. Fallback: if grain-tickets unavailable, keep manual entry (graceful degradation)

Success criteria:
- Malt cost calculator uses actual grain prices from settlement data
- Manual override available for hypothetical pricing scenarios
- Price source visible (manual vs grain-tickets) in UI
```

---

## APPENDIX: MODULE CONNECTIVITY MAP

```
                    ┌──────────────────────────────────┐
                    │      GLOMALIN PORTAL (3010)       │
                    │   Supabase Auth + RBAC + PWA      │
                    │                                    │
                    │  Native: FSA, Insurance, Claims,   │
                    │          Macro Rollup, Crop Plans   │
                    │  Embeds: all 6 Express apps        │
                    └──────────┬───────────────────────┘
                               │ iframe + API
          ┌────────────────────┼────────────────────────┐
          │                    │                         │
    ┌─────▼──────┐     ┌──────▼────────┐       ┌───────▼──────┐
    │farm-budget │────▶│seed-inventory │       │organic-cert  │
    │  (3001)    │webhook│   (3006)     │       │   (3004)     │
    │ Enterprise │     │ Procurement   │       │ NOP Audit    │
    │ Planning   │     │ & Delivery    │       │ Compilation  │
    └──┬───┬─────┘     └──────────────┘       └──┬──────┬────┘
       │   │                                      │      │
       │   │reads                           reads │      │reads
       │   ▼                                      ▼      ▼
    ┌──▼──────────┐                    ┌──────────────────────┐
    │farm-registry│◀───────────────────│   (reads all three)  │
    │   (3005)    │                    └──────────────────────┘
    │ Field Acres │
    └──┬──────────┘
       │reads
       ▼
    ┌────────────┐     ┌────────────┐     ┌───────────────┐
    │grain-tickets│     │ fsa-acres  │     │meristem-malt  │
    │   (3007)   │     │   (3002)   │     │    (3003)     │
    │ Grain Flow │     │ FSA + Ins  │     │ Malt Costing  │
    └────────────┘     └────────────┘     └───────────────┘
         ▲                   ▲                    │
         │                   │                    │
         └── DISCONNECTED ───┘                    │
         (duplicate FSA/ins data)         DISCONNECTED
                                         (manual grain prices)
```

**Legend:** Solid arrows = working data flow. "DISCONNECTED" = data exists in both places with no sync.
