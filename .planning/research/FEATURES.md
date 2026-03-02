# Feature Research

**Domain:** NOP organic crop certification — compilation engine, cross-app data aggregation, inspection packet generation
**Researched:** 2026-03-01
**Confidence:** HIGH — existing codebase and PROJECT.md fully characterize the domain; NOP regulatory requirements confirmed via Oregon Tilth recordkeeping guide, USDA NOP eCFR 7 CFR Part 205, and USDA organic certification documentation. Competitor landscape verified via web search (MEDIUM confidence for competitor specifics).

---

## Context: What This Milestone Is Not

v3.0 is NOT adding new NOP record types or building a better data-entry experience. The data-entry problem was solved in v1.0 and v1.1. v3.0 is rewiring the data flow: organic-cert stops being a standalone data-entry app and becomes a **compilation engine** that reads from the rest of the ecosystem.

**The double-entry problem today:**
Farm plan built in farm-budget (crops on fields, inputs assigned, enterprises set to organic) → same data re-keyed manually into organic-cert → inspector reviews organic-cert PDF. Two entry points for the same facts. Any change in farm-budget requires a corresponding manual update in organic-cert, or they drift.

**What v3.0 eliminates:**
Manual re-entry of field/enterprise plans, inputs, seed varieties, yields, and acreage from farm-budget into organic-cert. These are pulled live from the ecosystem APIs. Organic-cert adds only what the ecosystem does not provide: NOP compliance decisions, buffer zone documentation, narrative sections, and the act of compiling into a final inspection PDF.

---

## What Already Exists in organic-cert (Do Not Re-scope)

From the v1.0 and v1.1 audit trail in PROJECT.md and the existing source code:

- 8-section NOP inspection PDF (cover, field list, field history, application log, harvest log, mass balance, seed sources, equipment)
- Case IH FieldOps API integration (OAuth2, staged-ops review, approve/reject workflow)
- Split-field enterprise support (multiple enterprises per field per season)
- Field CRUD with 3-year history tracking
- Input application records with NOP status tagging (APPROVED/RESTRICTED/PROHIBITED/EXEMPT)
- Harvest records with yield, lot numbers, equipment, data source
- Mass balance computation (harvested lbs = sold lbs + storage ± transfers)
- OCIA C2.0 module (36-month field histories, acreage summary, cert requests)
- Registry sync: `POST /api/fields/sync-registry` pulls from farm-registry
- CropCertRequest table (crops being certified, projected yields)
- Attached seed lots, material CRUD, buyer CRUD, storage location CRUD
- Full Prisma schema: Farm, Field, FieldEnterprise, FieldHistory, FieldOperation, FertilityEvent, HarvestEvent, CropLot, SeedLot, SeedUsage, etc.

The schema is comprehensive. The gap is that most of the data in these tables currently requires manual entry — the connection to farm-budget and grain-tickets is missing.

---

## What the Ecosystem Provides (Sources for Auto-Pull)

### farm-budget (port 3001, JSON-backed, Express)

Available via `/api/*` endpoints — confirmed from `import.js` data model and `c2-assembler.ts` which already reads `BUDGET_API`:

- `/api/fields` — field name, acres, systemCode (ORG/CON), crop, crop type, enterprise category
- `/api/seeds` — crop, brand, variety, pricePerUnit, supplierId
- `/api/products` — input products with unit, p205, k20, OMRI status (inferred from organic enterprise context)
- `/api/enterprises` — enterprise definitions with organic/conventional category
- Fields include: `inputs` array (productName, quantity, season), `seed` (variety, population), `machinery` (implements, passes), `yieldPerAcre`, `cropInsurancePerAcre`

The key: farm-budget's fields tagged with `category: 'organic'` or systemCode `ORG` are the fields to pull for the inspection packet. This is the crop plan as Randy actually built it.

### grain-tickets (port 3000, Express + Prisma + PostgreSQL)

After v2.0 completion (phases 11-13), the grain-tickets API will expose:
- Actual harvest weights per field/crop/season (grain tickets linked to fields)
- Delivery records per buyer
- Settlement data (what was sold, to whom, when)

This provides ground-truth harvest data that makes the organic-cert harvest log accurate without manual entry.

### farm-registry (port 3005, Express + JSON)

Already partially integrated via `POST /api/fields/sync-registry`. Provides:
- Authoritative field names and aliases (56 fields, 5,155 ac)
- `reportingAcres` — the canonical acre number used consistently across all apps
- `organicAcres`, ownership, landlord info
- Organic/transitional/conventional breakdown per field (cert matrix)

---

## What NOP Inspectors Actually Review

Based on verified NOP requirements (7 CFR 205, Oregon Tilth recordkeeping guide, USDA crop documentation forms):

**Five mandatory record categories for annual inspection:**

1. **Seeds, Seedlings & Planting Stock** — Purchase receipts/invoices, organic certificates from suppliers, documentation of treatments, Commercial Availability Search records for any non-organic seed (must be untreated and non-GMO), planting population.

2. **Field Activities** — Planting dates, tillage operations, cultivation, mowing, weed/pest monitoring, crop rotation with field maps.

3. **Input Materials** — Every application: crop/field/date/rate/method/reason. Purchase receipts for all inputs. Manure: source, quantity, C:N ratio, days-to-harvest interval (NOP 205.203). Custom applicator cleanout documentation.

4. **Harvest, Handling & Storage** — Harvest dates, quantities by crop and field, post-harvest cleaning procedures, storage location and inventory, clean transport affidavits for shared equipment.

5. **Sales & Transactions** — Crop type, quantity, sale date, buyer. Buyers must have organic certification number (verifiable on USDA Organic Integrity Database).

**Two critical audit checks:**

- **Mass Balance**: Total organic crops harvested = total sold + storage inventory ± transfers. Discrepancies must be explainable. This is the single most-scrutinized calculation in any NOP inspection.
- **Yield Plausibility**: Harvest amounts must be consistent with planting records. Implausible yields (too high relative to planted acres) flag potential contamination/fraud.

**Additional NOP requirements that map directly to existing organic-cert schema:**

- Buffer zones (≥25 ft from adjacent conventional land) — `BufferZone` model exists
- Adjacent land use documentation — `AdjacentLandUse` model exists
- Equipment cleanout log (date, method, inspector, PASS/FAIL) when shared with conventional — `CleanoutEvent` model exists
- 3-year field history showing all crops and substances — `FieldHistory` model exists
- Crop rotation documentation — `CropRotation` model exists
- Pest management hierarchy documentation (cultural → mechanical → biological → material) — `ManagementAction` model with `hierarchicalStep` exists

The schema is already complete for NOP compliance. The gap is **data population**.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features an inspector or farm manager expects to exist. Missing these means the inspection packet is incomplete or the double-entry problem is not solved.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pull organic enterprises from farm-budget | Core promise of v3.0: no re-entry of the crop plan | MEDIUM | Call `GET /api/fields?category=organic` from farm-budget. Map to organic-cert FieldEnterprise records. Match by registry field name/alias. Create or update, do not overwrite manual records. |
| Pull input plans from farm-budget | Inputs are assigned in farm-budget per field; re-entering them in organic-cert is the primary pain point today | MEDIUM | Each farm-budget field has an `inputs` array (productName, quantity, season). Map product names to organic-cert Material records. Create MaterialUsage drafts tagged as "budget-import" for review before commit. |
| Pull seed varieties from farm-budget | Seed sourcing documentation is required by NOP; seeds are already in farm-budget | LOW | Farm-budget `/api/seeds` provides crop, brand, variety, supplierId. Map to organic-cert SeedLot records. Flag any variety not marked organic for commercial availability search. |
| Pull harvest weights from grain-tickets | Actual harvest pounds are the foundation of mass balance; grain-tickets has the certified scale weights | MEDIUM | After grain-tickets v2.0: call grain-tickets API by field + crop + cropYear. Populate HarvestEvent records. Tag dataSource as SYNCED. Real weight from scale tickets, not estimated yield. |
| Pull field identities from farm-registry | Authoritative field names, aliases, acres, organic status — already partially built | LOW | Already implemented in `POST /api/fields/sync-registry`. Fix the runtime crash (data.unmatched undefined, known tech debt). Run on demand before each compilation. |
| Yearly rotation snapshot | farm-budget is rebuilt each season; organic-cert needs to accumulate 3-year history from single-season data | MEDIUM | At end-of-season (or on demand): read current-year enterprises and lock them into FieldHistory records. This is how year-over-year crop rotation evidence is preserved when farm-budget is wiped and rebuilt for next year. |
| Pre-flight compilation status dashboard | Before generating the PDF, show: which fields are ready, which are missing data, what gaps exist | MEDIUM | "Compilation readiness" view: field list with green/yellow/red status. Green = all required sections populated. Yellow = partial (e.g., no buffer zone documentation). Red = blocking gaps (e.g., no field history). |
| Compiled inspection PDF from live data | The current PDF draws from organic-cert's own database. After v3.0 the database is populated from the ecosystem. The PDF itself does not change — but its data source does. | LOW | No PDF code change needed. The report assembler already reads from Prisma. Once the ecosystem data populates the Prisma tables, the PDF reflects it automatically. |
| Data source transparency in UI | Inspector asks "where did this input record come from?" Farm manager must be able to answer | LOW | DataSource enum (MANUAL / SYNCED) already on FieldOperation. Extend to MaterialUsage and HarvestEvent. Show "from farm-budget" or "from grain-tickets" badges in the UI. Mark rows pulled from the ecosystem so they are never confused with manually-entered records. |
| Manual override capability | Some data exists only in organic-cert (buffer zones, pest scouting narratives). Must coexist with pulled data | LOW | Already by design: the leech pattern means organic-cert reads from ecosystem but never writes back. Manual records are preserved. Pulled records fill gaps. Manual records always win on conflict (existing policy). |

### Differentiators (What Makes This Better Than the Status Quo)

Features that make this materially better than a standalone data-entry app and justify the compilation engine investment.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero re-entry for the crop plan | Farm manager enters crop plan once in farm-budget; organic-cert inspection packet is ready without additional input | HIGH (overall arch) | This is the milestone's entire thesis. Individual pulls (fields, inputs, seeds, harvest) each add a piece. Full zero-re-entry requires all pulls working together. |
| Rotation snapshot mechanism | farm-budget is single-season and rebuilt yearly; this is the only way to accumulate NOP-required 3-year field history automatically | MEDIUM | Snapshot triggered at season close: read all FieldEnterprise records for cropYear, write to FieldHistory. Guard: do not overwrite existing FieldHistory records (they may have more detail). Mark snapshot records as "auto-generated from YYYY plan". |
| Compilation readiness gate | Inspector shows up in March; farm manager knows 2 weeks earlier which fields need attention | MEDIUM | Per-field checklist driven by required NOP record types. Not compliance scoring (inspector does that) — just presence/absence of required record categories. |
| Linked inspection audit trail | Every record in the packet shows its source (manually entered, from farm-budget, from grain-tickets, synced from Case IH) | LOW | Extends existing DataSource tracking. Provides traceability that answers the inspector's "how do you know this?" question. |
| Mass balance from real scale weights | Current: harvest records entered manually, often estimated. v3.0: grain-tickets provides actual certified scale weights. Mass balance becomes accurate. | MEDIUM | Depends on grain-tickets v2.0 field-linkage being complete. High value: a tight mass balance (within 2% tolerance) significantly reduces inspection scrutiny. |
| Input plan vs. actual application diff | After pulling the crop plan from farm-budget, show where actual Case IH-synced applications diverged from the plan | HIGH | "Planned: 2 gal/ac CX-1 on Kopps. Actual: 1.8 gal/ac on June 14." This is the kind of documentation that turns a routine inspection into a smooth one. Builds on existing SyncedOperation / staged-ops infrastructure. |

### Anti-Features (Avoid These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Writing back to farm-budget from organic-cert | "If organic-cert rejects an input, update farm-budget to reflect that" | Violates the leech pattern. Organic-cert is a read-only consumer of farm-budget data. Bidirectional sync is a two-way data integrity nightmare. farm-budget is the source of planning truth; it should not be modified by organic-cert's compliance layer. | The NOP compliance flag (APPROVED/RESTRICTED/PROHIBITED) lives in organic-cert's Material table. A "prohibited material in plan" alert in organic-cert is sufficient. |
| Auto-compliance scoring | "Tell me if I pass or fail before the inspector comes" | The inspector makes the compliance determination. An automated pass/fail score creates liability and false confidence. NOP violations are contextual and require human judgment. | Show data completeness (what's missing) and flag prohibited materials. Never emit a compliance verdict. |
| Real-time sync to farm-budget on every page load | "Keep organic-cert always in sync with farm-budget" | farm-budget is JSON-backed and not designed for high-frequency polling. Real-time sync creates tight coupling between apps, dependency on farm-budget uptime for organic-cert functionality, and stale-data confusion when farm-budget is offline. | On-demand pull triggered by the farm manager: "Refresh from farm-budget" button on the compilation dashboard. Pre-inspection workflow does not need millisecond latency. |
| Replacing manual data entry entirely | "Make organic-cert fully automatic — no manual input at all" | NOP requires farm-specific documentation that no API provides: buffer zone measurements, adjacent land owner contacts, pest scouting observations, narrative descriptions of practices. These are the farm manager's knowledge, not data. | Eliminate re-entry of ecosystem data (inputs, fields, seeds, harvests). Preserve manual entry for NOP-specific documentation that only the farm manager can provide. |
| Inspector portal / digital inspection workflow | "Let the inspector log in and review records digitally" | Inspectors work on-site with printed packets. A digital portal requires inspector identity management, access control for external parties, mobile-optimized UI, and offline capability. None of this adds value for an operation that hands the inspector a 30-page PDF. | Print-ready PDF packet. This is established in PROJECT.md as the correct UX decision (v1.0 rationale). |
| Multi-certifier support (EU, state programs) | "We might get EU certified someday" | Different certifiers have different form requirements, field history lengths, and material approval lists. Supporting multiple simultaneously doubles the compliance layer complexity. | USDA NOP only for v3.0. The architecture does not preclude future multi-certifier support — the certPrograms JSON field on CropCertRequest already accommodates it. |
| Automated PDF parsing of organic certificates | "Auto-import OMRI listing PDFs to populate the material database" | OMRI listing PDFs are inconsistently formatted. The value is low — the farm uses a small, stable set of ~20 approved materials. Parsing infrastructure adds complexity for a one-time setup task. | Manual material setup for the ~20 materials in the farm-budget product list. The farm-budget pull auto-creates Material stubs; NOP status is annotated once by the farm manager. |

---

## Feature Dependencies

```
farm-registry sync (already built, needs crash fix)
    └──required by──> Pull organic enterprises from farm-budget (need field ID matching)
    └──required by──> Pull harvest weights from grain-tickets (need field ID matching)
    └──required by──> Compilation readiness dashboard (need canonical field list)

Pull organic enterprises from farm-budget
    └──required by──> Pull input plans from farm-budget (enterprise must exist to attach inputs)
    └──required by──> Pull seed varieties from farm-budget (need enterprise context)
    └──required by──> Rotation snapshot mechanism (must have enterprise records to snapshot)
    └──required by──> Compilation readiness dashboard (fields/enterprises are the unit of review)
    └──requires──>    farm-registry sync (field name matching)
    └──requires──>    farm-budget /api/fields endpoint (already exists)

Pull input plans from farm-budget
    └──required by──> Pre-flight compilation status (input coverage per field)
    └──requires──>    Pull organic enterprises from farm-budget
    └──requires──>    Material records in organic-cert (create stubs on first pull)

Pull seed varieties from farm-budget
    └──required by──> Seed sources section in PDF (no manual re-entry)
    └──requires──>    Pull organic enterprises from farm-budget

Rotation snapshot mechanism
    └──required by──> 3-year field history in PDF (accurate after 2nd and 3rd season)
    └──requires──>    Pull organic enterprises from farm-budget (current year data must exist)
    └──required by──> OCIA C2.0 module (already uses FieldHistory)

Pull harvest weights from grain-tickets
    └──required by──> Mass balance from real scale weights
    └──requires──>    grain-tickets v2.0 field-linkage complete (phases 11-13)
    └──requires──>    farm-registry sync (field name matching across apps)

Compilation readiness dashboard
    └──required by──> Compilation workflow gate (don't generate PDF with gaps)
    └──requires──>    Pull organic enterprises from farm-budget (fields list)
    └──requires──>    farm-registry sync

Input plan vs. actual application diff
    └──requires──>    Pull input plans from farm-budget
    └──requires──>    Case IH FieldOps staged-ops (already built in v1.0)
    └──enhances──>    Compilation readiness dashboard

Data source transparency in UI
    └──enhances──>    All pulled data features (shows origin of each record)
    └──requires──>    DataSource enum extension to MaterialUsage and HarvestEvent
```

### Dependency Notes

- **farm-registry sync must be fixed first.** The existing `POST /api/fields/sync-registry` has a known runtime crash (`data.unmatched undefined`). This is the field-matching foundation. Fix it before building any new ecosystem pulls.
- **farm-budget pull comes before grain-tickets pull.** The farm-budget pull establishes the FieldEnterprise records that grain-tickets harvest data attaches to. Attempting grain-tickets integration without enterprises in place creates orphaned harvest records.
- **Rotation snapshot is time-sensitive.** It must run before farm-budget is wiped and rebuilt for the next season. This means the snapshot workflow needs a clear trigger and documentation of when to run it (end of harvest, before December).
- **grain-tickets v2.0 field-linkage is a prerequisite for harvest pull.** The grain-tickets app currently lacks field IDs on ticket records (they're freetext farm names). Phase 11-13 of v2.0 must add structured field linkage before the organic-cert harvest pull is feasible.
- **Data source transparency is not a gate** — it can be added incrementally as each pull is implemented, one entity type at a time.

---

## MVP Definition

### v3.0 Core (This Milestone)

What delivers the stated goal: "pulls from farm-budget, farm-registry, grain-tickets — compiles NOP inspection packet with zero double-entry."

- [ ] Fix farm-registry sync crash — prerequisite for all field matching
- [ ] Pull organic enterprises from farm-budget — crops, fields, acres come in automatically
- [ ] Pull input plans from farm-budget — MaterialUsage records created from budget inputs, tagged "budget-import", staged for review
- [ ] Pull seed varieties from farm-budget — SeedLot stubs created, farm manager annotates NOP status once
- [ ] Rotation snapshot mechanism — end-of-season one-button snapshot writes current enterprises to FieldHistory
- [ ] Compilation readiness dashboard — per-field status: what's complete, what's missing, what's blocking
- [ ] Data source badges in UI — show where each record came from (farm-budget / grain-tickets / Case IH / manual)

### After grain-tickets v2.0 Field Linkage

- [ ] Pull harvest weights from grain-tickets — real certified scale weights replace estimated yields in HarvestEvent records
- [ ] Mass balance from real scale weights — tight mass balance with verified numbers

### After First Full Inspection Cycle

- [ ] Input plan vs. actual application diff — "planned vs. actual" view; valuable but requires a full season of Case IH sync data to be meaningful
- [ ] Compilation readiness refinement — tune the completeness checks based on what the inspector actually asked for

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Fix farm-registry sync crash | HIGH (blocks field matching) | LOW (bug fix, known location) | P1 |
| Pull organic enterprises from farm-budget | HIGH (core of double-entry elimination) | MEDIUM | P1 |
| Pull input plans from farm-budget | HIGH (biggest manual re-entry pain) | MEDIUM | P1 |
| Pull seed varieties from farm-budget | MEDIUM (smaller but still re-entry) | LOW | P1 |
| Rotation snapshot mechanism | HIGH (NOP 3-year history requirement) | MEDIUM | P1 |
| Compilation readiness dashboard | HIGH (confidence before inspection) | MEDIUM | P1 |
| Data source badges in UI | MEDIUM (transparency for inspector Q&A) | LOW | P1 |
| Pull harvest weights from grain-tickets | HIGH (mass balance accuracy) | MEDIUM (blocked on grain-tickets v2.0) | P2 |
| Input plan vs. actual diff | MEDIUM (nice for inspection prep) | HIGH (requires full Case IH season) | P2 |
| Multi-certifier support | LOW (future need, not current) | HIGH | P3 |
| Inspector digital portal | LOW (paper PDF is sufficient) | HIGH | defer |

**Priority key:**
- P1: Must ship in v3.0
- P2: Add when prerequisite system is ready
- P3: Future milestone
- defer: Out of scope per PROJECT.md

---

## Compilation Readiness: What Constitutes "Complete" Per Field

Based on NOP inspection requirements, a field enterprise is considered inspection-ready when:

| Record Type | Required? | Source After v3.0 |
|-------------|-----------|-------------------|
| Field identity (name, acres, organic status) | Required | farm-registry sync |
| Current-year enterprise (crop, planted acres) | Required | farm-budget pull |
| 3-year field history (crop, substances, year) | Required | Rotation snapshots + manual |
| At least one seed usage record | Required | farm-budget pull |
| Input applications (if any inputs used) | Required if inputs used | farm-budget pull → review |
| Harvest record (date, weight, lot number) | Required | grain-tickets pull or manual |
| Buffer zone documentation (≥25 ft) | Required for organic fields | Manual entry only |
| Adjacent land use documentation | Required | Manual entry only |
| Equipment cleanout record (if shared equipment) | Required if shared | Manual entry only |

Buffer zones, adjacent land use, and equipment cleanout are the last remaining manual-entry requirements that no API in the ecosystem can fill. These are field-specific physical observations that only the farm manager can document.

---

## Rotation Snapshot: Design Notes

The rotation snapshot is a critical and non-obvious feature. Rationale from PROJECT.md:

> Farm-budget is single-season (rebuilt yearly); organic-cert must accumulate rotation history via annual snapshots.

**What triggers a snapshot:**
- Farm manager clicks "Lock [year] rotation" on the compilation dashboard
- Can also trigger automatically at a configurable date (e.g., December 1)
- Must be repeatable without data loss (idempotent)

**What a snapshot writes:**
For each FieldEnterprise in the given cropYear:
- Writes a FieldHistory record: `{fieldId, year: cropYear, crop, organicStatus, yieldPerAcre, yieldUnit, coverCrop (if present), substances (summary of inputs applied)}`
- Guard: if FieldHistory already exists for this `[fieldId, year]`, do not overwrite (it may have been manually augmented)
- Logs snapshot action to AuditLog

**Why this works:**
After 3 seasons of snapshots, every field has 3 years of FieldHistory records. The C2.0 assembler and PDF report assembler already read FieldHistory for the 3-year rotation table — they require no changes.

**Risk:** If the snapshot is not run before farm-budget is rebuilt, the history for that year is lost. The compilation dashboard should warn: "farm-budget data for [year] detected. No rotation snapshot exists. Lock rotation before updating farm-budget."

---

## Ecosystem API Gap Analysis

Known gaps that must be resolved in each source app before the pull can work:

| Gap | Source App | Resolution |
|-----|-----------|------------|
| `farm-budget /api/fields` does not expose organic/conventional category in a queryable way | farm-budget | Filter on `systemCode` containing "ORG" or enterprise `category === 'organic'`. Both exist in the data.json fields. API endpoint `/api/fields?category=organic` or filter client-side after `/api/fields?all=true`. |
| `grain-tickets` ticket records have no structured field ID linkage | grain-tickets | Blocked until grain-tickets v2.0 phases 11-13 add field FK. Do not attempt this pull in v3.0 if those phases are incomplete. |
| `farm-registry sync` crashes on `data.unmatched undefined` | organic-cert | Known tech debt from v1.1 audit. Fix before v3.0 work starts. One-line null check. |
| `farm-budget /api/products` does not expose OMRI listing or NOP approval status | farm-budget | NOP status is owned by organic-cert. On pull, create Material stubs with `nopStatus: null` (pending annotation). Farm manager sets status once. After that, the annotation persists across seasons because Material is reused. |
| `farm-budget /api/seeds` does not expose `isOrganic` or `certNumber` | farm-budget | Same pattern as materials: create SeedLot stubs with `isOrganic: null` pending annotation. Farm manager flags organic/non-organic once. Provenance flag is a one-time annotation, not re-entered each season. |

---

## Sources

- **Oregon Tilth — The Trail of Records: Mastering Recordkeeping for Crop Organic Operations** — five record categories, mass balance audit, yield plausibility check; HIGH confidence (accredited certifier documentation)
- **USDA NOP eCFR 7 CFR 205.103** — recordkeeping requirements for certified operations, 5-year retention, audit trail; HIGH confidence (federal regulation)
- **USDA 7 CFR 205.201** — organic system plan requirements; HIGH confidence (federal regulation)
- **USDA NOP Strengthening Organic Enforcement rule (effective March 2024)** — codified mock audit requirement, enhanced traceability; HIGH confidence (Federal Register)
- **OCIA C2.0 Crop Production Overview** — 36-month field histories, acreage summary, crops requested for certification; HIGH confidence (certifier documentation, already implemented in organic-cert C2 module)
- **USDA AMS buffer zone guidance (NOP)** — ≥25 ft buffer requirement, inspector review of buffer documentation; HIGH confidence (USDA guidance document)
- **PROJECT.md / DOMAIN-CONTEXT.md** — ecosystem architecture, farm-budget data model, grain workflow, rotation snapshot decision rationale; HIGH confidence (primary source)
- **organic-cert source code** — existing schema, assemblers, API routes; HIGH confidence (ground truth)
- **farm-budget import.js / public/seed-manager.js** — farm-budget data structure and available API fields; HIGH confidence (ground truth)

---

*Feature research for: organic-cert v3.0 compilation engine (NOP inspection packet from ecosystem data)*
*Researched: 2026-03-01*
