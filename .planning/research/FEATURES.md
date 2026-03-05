# Feature Research

**Domain:** FSA-578 Planting Workflow, Crop Insurance Decision Tool, Claims Tracking — v6.0
**Researched:** 2026-03-04
**Confidence:** HIGH for FSA-578 form field requirements and insurance formulas (verified against official USDA sources); MEDIUM for UX workflow patterns (derived from existing codebase + domain knowledge); HIGH for claims lifecycle stages (verified against RMA official claims process documentation).

---

## Context: What v6.0 Is and Is Not

v6.0 transforms three distinct but interconnected government-program workflows from flat spreadsheets into structured, guided tooling inside the Glomalin Portal (Next.js 14 + Supabase). The scope is:

1. **FSA-578 Planting Workflow** — Replace the fsa-acres Express app's flat table with a card-based CLU assignment workflow that validates, templates, and exports print-ready FSA-578 acreage reports.
2. **Crop Insurance Decision Tool** — Replace the existing flat insurance policy table with a comparison matrix, payout simulator, and APH/historical performance tracker.
3. **Claims Tracking System** — Add a Kanban-style lifecycle tracker for crop insurance claims that does not exist in any form today.

**What already exists in fsa-acres (port 3002) that informs what NOT to rebuild:**
- CLU record CRUD table with all FSA-578 data fields (farmNumber, tractNumber, clu, crop, fsaAcres, irrigated, organic, doubleCrop, coverCrop, grainPlantDate, use, tillage codes, cc species, aph, unitNumber, reported)
- Dashboard rollups by farm, crop, field; tillage and cover crop summaries; reporting progress
- Validation engine (missing crop, missing plant date, missing prices, no insurance, unreported records)
- Insurance policy table with claim status stepper (none → potential → filed → paid → denied)
- Grain ticket yield bridge (cross-port lookup from grain-tickets at port 3000)
- Pricing table (springPrice, fallPrice per crop, USDA RMA fetch)
- GCS enrollment tracker (practices 329, 340, 345)
- Reports: FSA acreage report, insurance summary, reporting checklist, CSV export
- Insurance calc engine: `computeInsurancePolicy()` — effectiveGuarantee, shortfall, indemnity, claimStatus auto-detection

The new portal build reuses these data fields and calc formulas but delivers them through a proper workflow UI instead of a flat spreadsheet table.

---

## FSA-578 Form: Required Data Elements

Source: USDA FSA-578 Manual (official form), farmers.gov acreage reporting documentation, FSA 2-CP Handbook.

### Header / Producer Section
- Farm serial number (assigned by County Office)
- Operator name and address
- County and state
- Program year

### Per-CLU Crop Entry (one row per crop per CLU)
| Field | Required | Notes |
|-------|----------|-------|
| Farm number | Yes | Assigned by FSA County Office |
| Tract number | Yes | Sub-unit of farm |
| Field/CLU number | Yes | May include subdivision (1a, 1b) |
| Crop name | Yes | Max 12 characters, must match FSA crop codes |
| Crop type | Yes | E.g., Yellow (corn), Hard Red Spring (wheat) |
| Practice code | Yes | I = Irrigated, N = Non-irrigated, O = Other |
| Intended use | Yes | Grain, forage, silage, seed — once certified, cannot be revised |
| Planting date | Yes (most crops) | MM-DD-YYYY; some perennials exempt |
| Total acres | Yes | To hundredths for precision |
| Producer's share % | Yes | Operator's risk share in this crop |
| Status code | Yes | Initial (I), Subsequent (S), Failed (F), Prevented (P), Double-crop (D), and combinations |
| Organic indicator | Required if organic | |
| Double crop indicator | Required if double-cropped | Second crop on same acres within 12-month period |
| Prevented planting indicator | Required if prevented | Acres that could not be planted due to natural disaster |

### Conservation Practice Data (separate GCS tracking)
- Practice 329 (No-Till)
- Practice 340 (Cover Crop)
- Practice 345 (Reduced Tillage)
- New Practice vs. Early Adopter designation
- Cover crop species and planting date

---

## Insurance Formula Reference

Source: Iowa State Extension Ag Decision Maker (verified), USDA RMA official documentation.

### Revenue Protection (RP)
```
Revenue Guarantee = APH Yield × Coverage Level % × max(Spring Price, Harvest Price)
Actual Revenue = Actual Yield × Harvest Price
Indemnity = max(0, Revenue Guarantee - Actual Revenue)
```
Key: Guarantee uses the **higher** of spring or harvest price. This is the most common plan.

### Revenue Protection with Harvest Price Exclusion (RP-HPE)
```
Revenue Guarantee = APH Yield × Coverage Level % × Spring Price (only)
Actual Revenue = Actual Yield × Harvest Price
Indemnity = max(0, Revenue Guarantee - Actual Revenue)
```
Key: Guarantee is capped at spring price even if harvest price rises. Lower premium than RP.

### Yield Protection (YP)
```
Yield Guarantee = APH Yield × Coverage Level %
Indemnity = max(0, Yield Guarantee - Actual Yield) × Spring Price
```
Key: Price-only protection — no revenue upside. Harvest price irrelevant. Lowest premium.

### Supplemental Coverage Option (SCO) — area-level add-on
```
SCO Payment Limit = Farm Expected Crop Value × (86% - Underlying Coverage Level %)
Farm Expected Crop Value = Spring Price × Farm APH Yield
SCO Indemnity = Farm Expected Crop Value × (86% - [Actual County Revenue / Expected County Revenue])
                [capped at SCO Payment Limit]
```
Covers the gap from your underlying coverage level up to 86%. Triggered by county-level losses.
2025 OBBB Act raised premium subsidy from 65% to 80%.

### Enhanced Coverage Option (ECO) — area-level add-on
```
ECO Payment Limit = Farm Expected Crop Value × (Selected Trigger % - 86%)
ECO Indemnity = Farm Expected Crop Value × (Selected Trigger % - [Actual County Revenue / Expected County Revenue])
                [capped at ECO Payment Limit]
```
Trigger: 90% or 95% (farmer selects). Covers the band from 86% up to trigger level.
ECO premium subsidy also raised to 80% by OBBB Act.

### Prevented Planting
Coverage = Selected percentage of farm-level guarantee (percentage varies by crop, published in RMA Actuarial Information Browser). Common range: 55–60% of the standing guarantee.

### Dollar Guarantee (for comparison display)
```
Dollar Guarantee = Effective Guarantee × Highest Price × Planted Acres
```
Where Effective Guarantee = APH × Coverage Level, Highest Price = max(Spring, Harvest).

---

## Claims Lifecycle Stages

Source: USDA RMA Claims Process documentation, AgriSompo deadline guidance, CFRA Crop Insurance 101.

| Stage | Description | Deadline / Trigger |
|-------|-------------|-------------------|
| **Potential** | System detects actual yield below effective guarantee; farm manager should notify agent | Detected at harvest time |
| **Notice of Loss** | Written notice filed with crop insurance agent | Within 72 hours of initial damage discovery; no later than 15 days after end of insurance period |
| **Adjuster Assigned** | Loss adjuster dispatched by insurance company to inspect damaged crop | Insurance company initiates after receiving notice |
| **Field Inspection** | Adjuster visits field, appraises crop, documents damage | Before crop is harvested or destroyed (timing critical) |
| **Production Records Submitted** | Farm provides scale tickets, yield records, field maps | At harvest or per adjuster request |
| **Loss Statement** | Adjuster completes FSA/RMA loss forms with indemnity calculation | After all production data gathered |
| **Filed** | Formal claim submitted to insurance company | After loss statement complete |
| **Under Review** | Insurance company processes claim | Varies by company; typically 30–60 days |
| **Approved / Denied** | Decision issued with payment amount or denial reason | Required within policy timeframe |
| **Paid** | Indemnity check issued (may be reduced for outstanding premium, interest, fees) | After approval |

**Delayed Notice of Loss (DNOL):**
- Revenue policies: accepted up to 60 days after EOIP or 60 days after harvest price release date, whichever is later
- Non-revenue policies: accepted up to 60 days after EOIP (End of Insurance Period)

---

## Feature Landscape

### Module A: FSA-578 Planting Workflow

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Card-based CLU list with crop assignment | Farm manager expects to see every CLU and assign crop — current flat table exists but is dense; card layout is standard for workflow UIs | MEDIUM | Group CLUs by farm/tract. Each card shows farmNumber, tractNumber, CLU#, fsaAcres, current crop assignment, status badges. Click to edit inline or open detail. |
| Inline crop, practice, planting date editing | Core data entry — current app supports inline edit via dblclick; new portal should maintain this efficiency | MEDIUM | Edit directly on card or in slide-out panel. Practice dropdown (I/N/O), crop dropdown from FSA crop code list, planting date picker with seasonal validation. |
| Reporting status badge (Reported / Unreported) | Farm manager tracks which CLUs are marked as reported to FSA — existing fsa-acres feature | LOW | Status is a boolean `reported` flag. Green badge = reported, orange badge = unreported. |
| Validation warnings dashboard | Existing validation engine catches: missing crop, missing plant date, missing prices, uninsured acres, unreported records — must carry forward | LOW | Port existing `validateRecords()` from calc.js. Display in a warnings panel. Clickable warnings jump to the affected CLUs. |
| Bulk mark-as-reported action | Farm manager reports CLUs in batches at the FSA office — needs bulk operations | MEDIUM | Checkbox select + "Mark Reported" bulk action. Also: select all in a farm, select unreported only. |
| Year filter | FSA reporting is annual; must scope data to a crop year | LOW | Year selector in page header. Default to current year (2026). Show year-over-year toggle. |
| Auto-population from farm-budget macro rollup | Existing fsa-acres already has FSA crop sync from farm-budget (v4.0 feature); new portal must carry this forward | MEDIUM | Pull crop assignments from farm-budget macro rollup. Side-by-side preview before applying. Match CLUs to fields via farm-registry aliases. |
| Print-ready FSA acreage report | Existing reports.js generates printable HTML FSA report; new portal needs PDF or printable view | MEDIUM | Generate FSA-578-style report grouped by Farm → Tract → CLU. Include signature lines, producer header, total acres. Use React PDF or browser print stylesheet. |
| CSV export | Current app has CSV export via `/api/export/fsa` | LOW | Export CLU records as CSV with all FSA-578 columns. Used for spreadsheet backup and FSA office submission support. |

#### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Year-over-year CLU comparison | See last year's crop assignment alongside current year for each CLU — critical for rotation planning and FSA conversation | HIGH | Side-by-side column showing prior year crop, current year crop, and practice. Color-code rotations (corn after soybeans = green; corn after corn = yellow flag). Requires multi-year data schema. |
| Crop assignment templates | Common rotation patterns (corn/soybeans alternating, organic rye every other year) applied to groups of CLUs in one action | HIGH | Template library: define a rotation pattern, apply to a farm/tract group. Preview shows what changes before applying. Farm-specific templates saveable. |
| CNH FieldOps as-planted auto-fill | Auto-populate planting date from Case IH FieldOps API once planting operation is synced — eliminates date entry | HIGH | Blocked on FieldOps API having planting operations available for the field. Existing farm-budget OAuth2 code is portable. Date auto-fills when operation matches CLU field name via farm-registry. |
| Validation with FSA deadline countdown | "Reporting deadline: July 15, 2026 (87 days away). 23 CLUs still unreported." — urgency visible | LOW | Static deadline per crop year. Compute days remaining. Show warning when < 30 days. |
| Duplicate crop/CLU detection | Flags when same CLU has two crop entries for the same year — a data integrity error that causes FSA office rejection | LOW | Check for duplicate farm+tract+CLU+year combos. Flag immediately on save. |
| Cover crop tracking tied to CLU | Track cover crop species and planting date per CLU in same workflow — existing gcs.js is separate; merge into CLU cards | MEDIUM | Add cc species and plant date fields to CLU card. Power existing GCS practice 340 rollup from the same data rather than separate entry. |

#### Anti-Features (Avoid These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Direct FSA eAuth electronic submission | "Why can't we submit directly to FSA CARS/eAuth?" | FSA eAuth API access requires USDA partnership agreements and federal compliance review. ACRSI electronic submission is available only to approved third-party providers. Scope mismatch. | Generate print-ready FSA-578 report for producer to take to FSA office or submit manually via eAuth portal. This is how the existing fsa-acres app works and is sufficient. |
| GIS/polygon-based CLU boundaries | "Show the field on a map with CLU outlines" | USDA CLU spatial data is restricted (not publicly accessible for display); implementing GIS adds react-map-gl/Mapbox dependency for marginal gain | Farm-Tract-Field hierarchy plus acreage numbers is the operative data. Map view is a nice-to-have for v7+, not v6 core. |
| Automatic crop code lookup from USDA | "Auto-complete FSA crop codes from USDA's master list" | FSA crop codes change annually; maintaining sync to USDA's Crop/Commodity list adds maintenance burden | Provide a curated dropdown of crops this farm actually grows (derived from existing CLU records and farm-budget enterprises). 80% of FSA reporters use the same 10-20 crops. |

---

### Module B: Crop Insurance Decision Tool

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Policy list with coverage summary | Farm manager expects to see all policies in one view with key numbers: coverage level, guarantee, actual yield, indemnity — existing fsa-acres insurance tab delivers this | LOW | Port existing insurance table from fsa-acres. Columns: policy#, line#, farm, crop, coverage%, planted acres, APH guarantee, actual yield, shortfall, dollar guarantee, indemnity, status. |
| Claim status stepper per policy | Existing fsa-acres has none → potential → filed → paid → denied stepper — must carry forward | LOW | Status badge clickable to advance. Visual stepper in detail view. |
| APH yield auto-detect from CLU records | Existing insurance editor looks up APH from CLU records and pre-fills guarantee field | LOW | Port `lookupCluAph()` from insurance.js. On policy creation, compute APH average from CLU `aph` fields for same crop + farm. |
| Grain ticket yield bridge | Existing fsa-acres pulls actual yield from grain-tickets (port 3000) for post-harvest actual comparison | MEDIUM | Port grain yield bridge. Cross-module HTTP call to grain-tickets `/api/farm-summary`. Fuzzy match on farm name + crop. One-click "Use this yield" to set actual. |
| Premium calculation (per-acre × planted acres) | Farm manager needs to see total premium cost per policy and across all policies | LOW | Total Premium = premiumPerAcre × plantedAcres. Display alongside indemnity. Net position = indemnity - totalPremium. |
| Potential claim detection | Auto-flag when actual yield < effective guarantee — existing calc engine does this | LOW | Port `computeInsurancePolicy()` from calc.js. If shortfall > 0 and plantedAcres > 0 and price > 0: claimStatus = 'potential'. Alert banner when potential claims detected. |
| Export insurance summary | Print-ready insurance summary report and CSV export — existing reports.js delivers this | LOW | Port existing `generateInsurance()` function. Group by farm, show totals. |
| Policy CRUD | Add, edit, delete insurance policies | LOW | Slide-out editor panel like existing fsa-acres. Fields: policy#, line#, farm, crop, policyYear, coverage level, unit type, agent name, planted acres, APH yield, premiumPerAcre, actual yield. |
| Add-from-Farm shortcut | Create policies for all crops on a farm in one action from CLU data — existing fsa-acres feature | MEDIUM | Port `populateAddFromFarm()`. Select farm → system finds all crops with acres → creates policy stubs for each crop. |

#### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Coverage level comparison matrix | Side-by-side grid: rows = coverage levels (50%–85%), columns = plan types (RP, RP-HPE, YP). Cells show: premium cost, dollar guarantee, and breakeven yield for this farm's APH. Heat-map shading by cost/benefit ratio. | HIGH | This is what crop insurance agents show farmers on paper. Embedding it in the portal eliminates the back-and-forth. Data: use the existing pricing table (springPrice, fallPrice) + user's APH yield + planted acres. No external API needed — all local calculation. |
| Payout scenario simulator | Interactive sliders: actual yield, harvest price. Real-time display of indemnity under RP, RP-HPE, and YP for the selected policy. Shows breakeven yield (yield at which payout triggers) as a threshold line. | HIGH | Key insight: RP breakeven yield = (APH × coverage level) × (spring price / harvest price). When harvest price < spring price, breakeven yield increases. Farmers understand this intuitively but rarely see it calculated. |
| SCO/ECO layer visualization | Show how SCO and ECO fill the coverage gap above the farm-level policy, with county-level loss trigger shown as a dashed threshold | HIGH | Requires county APH data (not in current system — must be entered or fetched from USDA RMA). The band visualization is high-value for enrollment decisions. |
| Historical performance dashboard | Multi-year view: APH yield vs. actual yield per crop per farm. Premium paid per year vs. indemnity received. Cumulative net insurance position (paid in minus received). Loss ratio. | HIGH | Requires multi-year policy data (new schema). Year-over-year bars with indemnity overlaid. Cumulative net line chart. This is what a farm manager actually wants to know: "Has insurance paid off for this farm?" |
| Policy tracker with premium schedule | Show premium billing dates, total annual premium, and whether premium has been paid. Flag unpaid premiums (they reduce indemnity payments). | MEDIUM | Premium due date is typically September 30 for spring crops. Alert when premium due within 30 days and not marked paid. |
| Unit structure comparison | Show premium cost difference between enterprise, basic, and optional unit structures for the same crop+farm+coverage level | MEDIUM | Enterprise units have 80% subsidy (flat) vs. 38–67% for optional at 85% coverage. Cost difference can be $30+/acre. Display as a simple comparison table for each policy. |
| Bulk grain ticket sync | Existing fsa-acres "Sync Grain Tickets" bulk operation — update actual yields across all policies from grain-tickets in one step | MEDIUM | Port existing `renderSyncPreview()` and apply-all. Preview table: policy, current actual, grain ticket match, yield, update status. Confirm before applying. |
| USDA RMA projected price auto-fetch | Fetch current spring/fall RMA projected prices per crop automatically — existing fsa-acres pricing.js has scrape button | MEDIUM | Port existing pricing scrape. RMA releases projected prices in February; harvest prices in October. Auto-trigger fetch at those dates or manual "Refresh RMA Prices" button. |

#### Anti-Features (Avoid These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automated premium quotes from insurance companies | "Pull live premium quotes from insurance providers" | Insurance premium APIs are proprietary and require AIP (Approved Insurance Provider) agreements. No public API exists. The RMA Actuarial Information Browser has county data but not individual farm premiums. | Use agent-provided premiumPerAcre as manual input. The comparison matrix still works with manually entered premiums. Accurate enough for decision-making. |
| Real-time CME futures integration | "Show live corn futures to update spring/fall prices automatically" | Live CME data requires paid market data subscription (Barchart, DTN, etc.). The spring and harvest prices for crop insurance are monthly averages released by USDA RMA — not live futures. Conflating live futures with RMA prices creates confusion. | Manual price entry + USDA RMA price scrape on release dates. Two prices, two dates per year — low-frequency enough that automation adds no value. |
| Auto-file insurance claims | "When actual yield drops below guarantee, auto-file notice of loss" | Notice of Loss must be producer-certified and submitted to the specific insurance agent/AIP. Automated filing without producer review creates liability. The claim may be for a specific loss type that requires human assessment. | Alert panel flagging potential claims. One-click "Copy notice of loss details" or template generation for producer to submit to their agent. |

---

### Module C: Claims Tracking System

#### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Claims Kanban board | Visual pipeline showing all active claims across stages. Without this, claim status lives only in the farm manager's memory or a spreadsheet. | MEDIUM | Columns: Potential → Notice Filed → Adjuster Assigned → Under Review → Approved / Denied / Paid. Cards show: crop, farm, policy, amount at stake. Drag-and-drop to advance stages. |
| Claim detail view | Each claim needs: policy reference, loss type, loss date, affected acres, adjuster name/phone, claim number, filed date, documents checklist, timeline log | MEDIUM | Slide-out or dedicated page. Timeline at bottom shows all status changes with dates. Document checklist (scale tickets, field photos, yield records) with upload or mark-as-submitted. |
| Deadline alerts | Notice of Loss must be filed within 72 hours of discovery; final settlement deadlines vary. Missing a deadline can void a claim. | MEDIUM | Calculate deadline from loss date. Alert banner on Kanban column when a claim's deadline is within 7 days. Red highlight when overdue. |
| Claim-to-policy linkage | Each claim references a specific insurance policy. Dollar amounts, coverage level, and guarantee come from the policy record. | LOW | Foreign key relationship: Claim → Policy. On claim creation, pre-fill crop, farm, coverage level, and dollar guarantee from the linked policy. |
| Loss type categorization | Adjuster and insurance company need to know: drought, flooding, hail, prevented planting, disease, wildlife, etc. | LOW | Dropdown: Drought, Flooding, Hail, Excess Moisture, Prevented Planting, Disease/Pest, Other. This matches existing `lossType` field in fsa-acres insurance data. |
| Adjuster contact information | Farm manager needs adjuster name and phone number on every claim for quick follow-up calls | LOW | Fields: adjusterName, adjusterPhone. Pre-fill from policy agent info when available. |
| Claim notes / timeline log | Every conversation with the adjuster, every document submitted, every status change should have a timestamped note | MEDIUM | Append-only notes log on each claim. Each entry: timestamp, author (from Supabase session), text. No editing of prior notes. |
| Analytics summary | Total potential indemnity across all active claims, total paid YTD, average time-to-settlement | LOW | Aggregate from claim records. Dashboard card in Glomalin Portal: "$142,000 in active claims across 3 policies." |

#### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Document checklist per claim stage | At each stage, show exactly what documents are needed. "For Notice of Loss: planting records, field map, initial yield estimate." At Loss Statement: "scale tickets, APH yield history, all production records." | MEDIUM | Stage-specific document checklist template. Each item: description, required/optional, submitted (checkbox), file reference or note. Reduces the "what do they need from me now?" anxiety. |
| Deadline calendar view | Calendar showing all upcoming FSA reporting deadlines, crop insurance sales closing dates, notice of loss deadlines, and premium due dates across all active policies | HIGH | Monthly calendar with colored event types. Not just claims deadlines — also FSA July 15 acreage report deadline, February sales closing dates, September premium due. This is the "what do I need to do this month for government programs" view. |
| FSA to Insurance to Claims flow | When a CLU record is marked "Prevented Planting" in the FSA workflow, automatically suggest creating a prevented planting insurance claim linked to the matching policy | HIGH | Cross-module trigger: FSA record with status code 'P' (prevented) → check for matching insurance policy → prompt "Create prevented planting claim?" with pre-filled details. This is the cross-module integration that makes v6.0 cohesive. |
| Settlement vs. budget variance | When a claim is paid, compare the indemnity received against the crop insurance per-acre estimate in farm-budget → show the delta | MEDIUM | Requires farm-budget API call. Pull `cropInsurancePerAcre × acres` from farm-budget for the field. Compare against actual indemnity. Display in claim detail: "Budgeted: $18,400. Received: $21,200. Variance: +$2,800." |
| Claim template from policy | One-click create claim: pre-fill all claim fields from the insurance policy (crop, farm, acres, guarantee, coverage level, adjuster contact) — farm manager only adds loss date and description | LOW | Policy → Claim shortcut. "File Claim" button on policy card creates claim pre-populated from policy data. |

#### Anti-Features (Avoid These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Document storage / file uploads | "Attach scale tickets and field photos to the claim" | Document storage requires S3/Supabase Storage, file size limits, MIME type handling, access control, and retention policies. For a single-operator farm, documents live in a folder on the office computer. | Document checklist with "mark as submitted" checkboxes and text notes. Farm manager notes where the file lives ("scale tickets in grain-tickets app, folder: 2026/Hughes Farm"). Physical document management stays physical. |
| Integration with insurance company portals | "Sync claim status from AgriSompo or RMA systems" | Each AIP (Approved Insurance Provider) has a different portal and no public API for claim status sync. RMA does not expose claim data via public API. | Manual status advancement in the Kanban board with notes log. Farm manager updates status after each call with the adjuster. |
| Multi-policy aggregate claim | "One claim covering losses across multiple policies" | Each crop insurance policy is a separate legal contract with a separate insurance company potentially. Claims are filed per-policy, per-unit. Aggregating them would misrepresent the insurance structure. | Show all claims in the Kanban with a portfolio summary (total at stake, total paid) without merging the underlying claim records. |

---

## Feature Dependencies

```
[Farm Registry] ──provides──> [CLU field identity matching]
    └──required by──> FSA-578 Planting Workflow (CLU ↔ field name matching)
    └──required by──> Insurance payout simulator (acres per field from registry)

[Farm-Budget Macro Rollup] ──provides──> [Crop plans per field]
    └──required by──> FSA crop auto-population (which crop on which CLU)
    └──required by──> Insurance budgeted per-acre comparison

[Grain Tickets (port 3000)] ──provides──> [Actual yield per crop/farm]
    └──required by──> Insurance actual yield auto-fill
    └──required by──> Insurance bulk grain sync
    └──required by──> Historical performance: actual vs. APH chart

[FSA-578 CLU records] ──provides──> [CLU data with acres, crop, practice]
    └──required by──> Insurance APH auto-detect (sum fsaAcres per crop per farm)
    └──required by──> Insurance add-from-farm shortcut
    └──required by──> Claims coverage verification (confirm CLU acreage matches policy)

[Insurance Policies] ──provides──> [Coverage terms, guarantee, premium]
    └──required by──> Claims tracking (claim links to policy)
    └──required by──> Dollar guarantee calculation
    └──required by──> Payout scenario simulator
    └──required by──> Prevented planting claim trigger

[FSA CLU Prevented Planting status] ──triggers──> [Claims workflow]
    └──requires──> FSA-578 Planting Workflow (status code 'P' on CLU)
    └──suggests──> Create prevented planting claim for matching policy

[RMA Pricing (spring/fall prices)] ──required by──> [Insurance indemnity calculation]
    └──required by──> Coverage comparison matrix
    └──required by──> Payout scenario simulator
    └──required by──> Historical performance P&L

[Claims] ──provides──> [Indemnity received]
    └──enhances──> Farm-budget variance (budgeted insurance vs. actual indemnity)
    └──feeds──> Historical performance loss ratio chart
```

### Dependency Notes

- **CLU records are the FSA-578 foundation.** Every other feature references CLU data. The CLU schema from fsa-acres (farmNumber, tractNumber, clu, crop, fsaAcres, irrigated, organic, aph) must be migrated to Supabase first.
- **Insurance policies require CLU data for APH lookup.** The APH auto-detect (`lookupCluAph`) sums the `aph` field from CLU records filtered by crop + farmNumber. CLU data must exist before insurance setup is useful.
- **Claims require insurance policies.** A claim is a child record of a policy — it inherits crop, farm, coverage level, and adjuster info. Insurance module must be functional before claims are meaningful.
- **Grain ticket yield bridge is cross-service.** The existing grain-tickets app (port 3000) must be running for the yield bridge to work. This is a soft dependency — insurance works without it, but actual yield must be manually entered if grain-tickets is unavailable.
- **Year-over-year CLU comparison requires multi-year schema.** The new Supabase schema must store CLU records with a cropYear field (already exists in fsa-acres as a setting, needs to become per-record). Without this, year-over-year comparison is impossible.
- **Claims cross-module trigger (FSA prevented planting → claim) is a Phase 3+ feature.** It requires both FSA workflow and Insurance modules to be complete and linked before the trigger logic can be built.

---

## MVP Definition

### Launch With (v6.0 Phase 1 — FSA Foundation)

Minimum viable: migrate CLU data to Supabase, deliver card-based workflow, basic validation.

- [ ] Supabase schema for CLU records, insurance policies, and claims (with cropYear scoping)
- [ ] Import existing fsa-acres JSON data into Supabase
- [ ] Card-based CLU list grouped by Farm → Tract → CLU with crop assignment
- [ ] Inline edit: crop, practice, planting date, organic flag, reported flag
- [ ] Validation warnings panel (missing crop, missing date, unreported)
- [ ] Bulk mark-as-reported action with farm-level filter
- [ ] Print-ready FSA acreage report (FSA-578 layout) with CSV export
- [ ] Auto-populate from farm-budget macro rollup (port existing FSA sync from v4.0)

### Add After FSA Foundation Validated (v6.0 Phase 2 — Insurance)

- [ ] Insurance policy CRUD with slide-out editor
- [ ] Coverage-level comparison matrix (RP vs. RP-HPE vs. YP, 50–85%)
- [ ] Payout scenario simulator with yield/price sliders
- [ ] APH auto-detect from CLU records
- [ ] Grain ticket yield bridge for actual yield
- [ ] Bulk grain ticket sync
- [ ] RMA spring/fall price fetch
- [ ] Premium schedule and potential claim detection

### Add After Insurance Module Validated (v6.0 Phase 3 — Claims)

- [ ] Claims Kanban board with stage columns
- [ ] Claim detail view with timeline log and document checklist
- [ ] Deadline alert system per claim
- [ ] Claims analytics summary cards
- [ ] Year-over-year CLU comparison view
- [ ] Crop assignment templates
- [ ] FSA prevented planting → insurance claim cross-trigger

### Future Consideration (v7+)

- [ ] Historical performance dashboard (multi-year loss ratio, cumulative net P&L)
- [ ] SCO/ECO layer visualization with county APH data
- [ ] Deadline calendar (consolidated FSA + insurance + claims dates)
- [ ] Settlement vs. farm-budget variance tracking
- [ ] CNH FieldOps as-planted date auto-fill
- [ ] Unit structure comparison matrix

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Supabase schema + CLU import | HIGH (foundation) | LOW | P1 |
| Card-based CLU workflow | HIGH (core UX upgrade) | MEDIUM | P1 |
| Validation warnings panel | HIGH (existing in fsa-acres) | LOW | P1 |
| Bulk mark-as-reported | HIGH (saves time) | LOW | P1 |
| FSA-578 print report | HIGH (required for FSA office) | MEDIUM | P1 |
| Farm-budget crop sync | HIGH (existing v4.0 feature) | MEDIUM | P1 |
| Insurance policy CRUD | HIGH (core data) | LOW | P1 |
| Coverage comparison matrix | HIGH (decision support) | HIGH | P1 |
| Payout scenario simulator | HIGH (novel value) | HIGH | P1 |
| APH auto-detect from CLU | MEDIUM (convenience) | LOW | P1 |
| Grain ticket yield bridge | HIGH (accuracy) | MEDIUM | P1 |
| Potential claim detection | HIGH (prevents missed claims) | LOW | P1 |
| Claims Kanban board | HIGH (missing entirely today) | MEDIUM | P1 |
| Claim detail + deadline alerts | HIGH (compliance risk) | MEDIUM | P1 |
| Year-over-year CLU comparison | HIGH (rotation planning) | HIGH | P2 |
| Crop assignment templates | MEDIUM (convenience) | HIGH | P2 |
| Historical performance dashboard | HIGH (long-term value) | HIGH | P2 |
| SCO/ECO layer visualization | MEDIUM (niche) | HIGH | P2 |
| Deadline calendar view | MEDIUM (useful) | HIGH | P2 |
| Document storage (file uploads) | LOW (paper works fine) | HIGH | P3 (defer) |
| Insurance company portal sync | LOW (no API exists) | HIGH | Out of scope |
| GIS/map CLU boundaries | LOW (USDA data restricted) | HIGH | Out of scope |

**Priority key:**
- P1: Must ship in v6.0
- P2: Add after core validated, within v6.0 if capacity allows
- P3: Defer to v7+
- Out of scope: Do not build

---

## Competitor / Reference Analysis

| Feature | Existing fsa-acres (port 3002) | FCSAmerica Insurance Tool | farmdoc Crop Insurance Decision Tool | Our v6.0 Approach |
|---------|-------------------------------|--------------------------|--------------------------------------|-------------------|
| CLU crop assignment | Flat table, inline edit | Not applicable | Not applicable | Card-based grouped by farm/tract |
| FSA validation | `validateRecords()` in calc.js | Not applicable | Not applicable | Ported + enhanced with deadline countdown |
| Coverage matrix | Not present (flat table only) | Shows all options for farm's numbers | Shows RP/RP-HPE/YP comparison | Interactive matrix with heat-map shading |
| Payout simulator | Basic indemnity calculation | Not present | Loss Estimation Worksheet | Sliders for yield/price with real-time recalc |
| Claims tracking | Status toggle (none/potential/filed/paid) | Not applicable | Not applicable | Full Kanban + timeline + deadline alerts |
| Year-over-year CLU | Not present | Not applicable | Not applicable | Side-by-side prior/current year per CLU |
| Grain ticket bridge | Existing in fsa-acres | Not applicable | Not applicable | Ported from fsa-acres |

The existing fsa-acres app has the best raw data structure in the industry (tight CLU data model, insurance calc engine, grain ticket bridge). The v6.0 build is not a redesign of the data model — it is a workflow UX upgrade that makes the existing functionality discoverable and guided.

---

## Sources

- **USDA FSA-578 Manual Instructions** (forms.sc.egov.usda.gov) — per-CLU required fields, practice codes, status codes, share percentage; MEDIUM confidence (PDF rendered from binary; field list confirmed against existing fsa-acres data model)
- **Farmers.gov Crop Acreage Reports** — FSA hierarchy (Farm → Tract → CLU), reporting deadlines, ACRSI electronic submission requirements; HIGH confidence (official USDA)
- **Iowa State Extension — Revenue Protection Crop Insurance (A1-54)** — RP, RP-HPE, YP guarantee and indemnity formulas; HIGH confidence (verified academic source, confirmed against existing fsa-acres calc.js)
- **Iowa State Extension — SCO and ECO (A1-44)** — SCO 86% trigger, ECO 90%/95% trigger, payment limit and indemnity formulas; HIGH confidence (academic source)
- **USDA One Big Beautiful Bill Act (OBBB) 2025** — SCO and ECO premium subsidy increase to 80%; MEDIUM confidence (found in multiple secondary sources, not yet verified against official Federal Register)
- **USDA RMA Claims Process** (rma.usda.gov) — 72-hour notice of loss deadline, adjuster process, DNOL (delayed notice) rules, indemnity deductions; HIGH confidence (official USDA RMA)
- **AgriSompo Claim Deadlines** — 15-day end-of-insurance-period deadline, revenue vs. non-revenue DNOL rules; MEDIUM confidence (insurance company documentation)
- **UW-Extension — Crop Insurance Coverage Levels and Insurance Units** — enterprise vs. optional vs. basic unit structure, premium subsidy rates per unit type; HIGH confidence (UW academic extension)
- **fsa-acres/public/*.js** (existing codebase) — calc.js, insurance.js, dashboard.js, gcs.js, pricing.js, reports.js — ground-truth data model and existing business logic; HIGH confidence (primary source)
- **fsa-acres/data/data.json** — actual CLU schema with all field names; HIGH confidence (ground truth)
- **PROJECT.md, DOMAIN-CONTEXT.md** — domain context, farming calendar, government program descriptions; HIGH confidence (primary documentation)

---

*Feature research for: v6.0 FSA-578 Planting Workflow, Crop Insurance Decision Tool, Claims Tracking*
*Researched: 2026-03-04*
