# Feature Research

**Domain:** Grain traceability, settlement reconciliation, buyer management
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH — grain elevator software patterns are well-documented; farm-side reconciliation workflows confirmed by farmer forums and commercial software feature lists. The Hughes Farm workflow is described directly in PROJECT.md. Specific field-to-settlement chain-of-custody at farm scale is less documented in academic literature but well-understood from commercial tools and farmer accounts.

---

## Context: What Already Exists

The grain-tickets app ships with a solid foundation. This milestone adds traceability and settlement reconciliation ON TOP of existing features. These are already built and must not be re-scoped:

- Ticket CRUD (date, farm, netWeight, moisture, crop, ticketNo, notes, FM)
- Farm summary with yield/acre calculations (totalBU, yieldPerAcre, guarantee, coverage, claimThreshold)
- Claude Vision ticket scanning (photo → structured data)
- CSV export for tickets and farms
- Grain calculation engine (moisture shrink, test weight, FM discounts)
- Farm registry integration
- Excel batch import
- PWA with offline support
- Duplicate ticket number detection

The current ticket data model: `ticketNo`, `farm`, `crop`, `netWeight`, `moisture`, `FM`, `date`, `notes`. The `notes` field currently carries destination info in free text (e.g., "HBT# 5652 WR Trk# 41") — structured destination tracking is the primary gap.

---

## The Grain Workflow Being Digitized

Hughes Farm's current workflow, from PROJECT.md:

```
Combine harvest
  → Grain buggy (has scale) → radio net weight + field + crop to semi driver
  → Semi driver writes Hughes Blue Ticket (farm's own record)
  → Semi delivers to co-op/buyer
  → Co-op prints elevator scale ticket
  → Both documents to office
  → Manual Excel entry (was 31 sheets, one per crop/variety)
  → Settlement statements arrive ~1 week later
    (4+ buyers, mixed paper/CSV/PDF)
  → Manual reconciliation vs farm records
```

Scale of operation: 100–500 loads per season. Primary users: farm office staff (daily ticket entry) and farm manager (settlement reconciliation, reporting).

**Where discrepancies arise (based on farmer forum evidence and commercial software documentation):**
1. Missing loads — load delivered but never appears on buyer settlement
2. Weight differences — farm buggy scale vs. elevator scale (0.25–0.5% handling loss is normal; beyond 1% warrants investigation)
3. Moisture disagreements — elevator measures at intake, farm measures at harvest; cold weather or uneven bins cause variance
4. Contract misapplication — load applied to wrong contract or not applied at all (most common real-world error per farmer accounts)
5. Pricing errors — settled at wrong price, wrong basis level, or wrong contract date
6. Share farm confusion — when landlord/tenant loads are commingled and then split at settlement

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the farm office staff assumes exist. Missing these means the milestone is not complete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Destination field on tickets | Every load goes to a specific buyer; free-text notes is fragile and unsearchable | LOW | Add `destinationId` as a first-class FK field referencing a Buyer record. Replaces the current pattern of burying "WR Trk# 41" in notes. |
| Buyer/destination registry | Co-op, elevator, maltster, broker need structured records, not free text | LOW | Simple CRUD: name, type (co-op, elevator, broker, maltster), shortCode, contact, notes. 4–10 records at Hughes Farm. |
| cropYear field on tickets | Settlements are per-season; matching 2024 corn against 2025 corn is wrong | LOW | Add `cropYear` (integer) to tickets. Already implicit in data (date field exists) but needs to be explicit for grouping and matching. |
| Settlement import (CSV/Excel) | Buyers send statements digitally; re-keying 100–500 loads by hand defeats the system | HIGH | Column mapping UI required — every buyer uses different column headers. Must handle missing/extra columns, partial matches, preview before commit. |
| Manual settlement entry | Paper-only buyers and PDF-only statements exist; import alone is insufficient | MEDIUM | Form-based entry for individual settlement lines. Required for any buyer who does not provide a digital file. |
| Ticket-to-settlement matching | Core of reconciliation: link each farm ticket to the corresponding buyer settlement line | HIGH | Primary match key: ticket number (exact). Secondary: date + weight fuzzy match for tickets without a number on the settlement. Match within same buyer and cropYear. |
| Discrepancy detection | Flag loads that appear only on one side — the missing load problem | MEDIUM | Three states: matched, farm-only (not on settlement), settlement-only (not in farm records). Auto-flag on import. A JasBo user found one missing load that "paid for the software itself." |
| Reconciliation status per ticket | Farm office needs to know: paid, unpaid, disputed — at a glance | LOW | Enum on ticket: `unreconciled`, `matched`, `disputed`, `manual-override`. Color coding in list view. |
| Settlement summary view | Total bushels, total net $, average price per crop/buyer/season | MEDIUM | Aggregate across matched records. Compare farm-calculated bushels vs buyer-settled bushels side by side. This is the "did we get paid correctly?" view. |

### Differentiators (Competitive Advantage)

Features that make this system more useful than a spreadsheet or generic farm tool.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Unmatched load alert dashboard | One screen showing all farm-only tickets and all settlement-only lines — the "what's missing?" view | MEDIUM | The highest-value single view. Commercial tools generate a printout for manual comparison; this shows it automatically. |
| Weight discrepancy tolerance flag | Normal variance is 0.25–0.5%; flag loads where buyer weight differs from farm weight beyond a configurable threshold | MEDIUM | Per-crop configurable tolerance (default 1%). Auto-flag on match. Show variance in lbs and %. Distinguishes normal handling loss from actual discrepancies. |
| Buyer column map persistence | After mapping a buyer's CSV columns once, remember the mapping — don't ask again next season | MEDIUM | Store column map per buyer. Detect column headers on re-import, apply saved map automatically. Major time saver after first import cycle. |
| Settlement total vs farm total | After import: "Farm says 12,400 bu @ $5.10 = $63,240. Buyer settled 12,380 bu @ $5.10 = $63,138. Difference: -$102." | LOW | Pure arithmetic once matching is done. High value for farm manager's end-of-settlement verification. |
| Disputed ticket workflow | When a discrepancy can't be auto-resolved, mark as disputed, add notes, track resolution | LOW | Add `disputedNote` and `resolvedAt` fields. Simple status progression: unreconciled → disputed → resolved. No complex workflow needed. |
| Multi-buyer season summary | All 4+ buyers on one screen: crop, bushels settled, avg price, total payment per buyer | LOW | Aggregate query once data model exists. Farm manager's primary end-of-season view. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full elevator-side software | "Track storage, contracts, shrink tables like GrainTrac" | That is the elevator's job. Hughes Farm is the seller. Building elevator features doubles scope with zero user value to a farm-side system. | Track only what the farm needs: what was delivered, what was settled, what the discrepancy is. |
| Real-time futures price integration | "Pull current CME prices" | Prices are set by contracts already signed. Futures integration requires a paid market data API, creates a trading tool UX, and adds unreliable external dependency. | Store the price from the settlement statement as received. Let the farmer compare to their contracts manually. |
| Full contract management (forward, basis, HTA) | Farm has forward contracts; wants to track delivery against them | Contract management is a separate domain with complex pricing models (Hedge to Arrive, Basis Fixed, etc.). Scope creep risk is extreme. | Store contract number as a notes field on settlement. Full contract management is a future milestone. |
| Automated PDF settlement parsing | "Import PDFs from buyers who don't send CSV" | PDF parsing is brittle, format varies wildly, OCR adds infrastructure complexity. Small number of paper-only buyers don't justify the investment. | Manual entry form for paper/PDF buyers. Fast form with autocomplete fields. Claude Vision already exists for ticket scanning — extending it to settlement PDFs is possible but not validated as needed yet. |
| Automatic moisture correction reconciliation | "Auto-adjust farm weight to match elevator's moisture reading" | Farm doesn't control the elevator's moisture test. Auto-adjusting farm records to match buyer records destroys the traceability evidence and masks real discrepancies. | Show the variance. Let the farmer decide if it is within normal tolerance or worth disputing. Never auto-modify farm records to match buyer records. |
| Push notifications / email alerts for discrepancies | "Alert me when a new discrepancy is found" | This is an internal office tool used during a defined reconciliation workflow, not a real-time monitoring system. Notifications add infrastructure (email/SMS service) with marginal value. | Dashboard with a "X items need attention" badge. Sufficient for the use case. |

---

## Feature Dependencies

```
Buyer registry
    └──required by──> Destination field on tickets
    └──required by──> Settlement import (column map stored per buyer)
    └──required by──> Ticket-to-settlement matching (match within same buyer)
    └──required by──> Multi-buyer season summary

cropYear on tickets
    └──required by──> Ticket-to-settlement matching (avoid cross-season matches)
    └──required by──> Settlement summary view (per-season totals)
    └──required by──> Unmatched load alert dashboard (scoped to season)

Database migration (Prisma + PostgreSQL)
    └──required by──> ALL new features — relational joins across tickets, buyers,
                       settlements are not possible in flat JSON

Settlement import (CSV/Excel)
    └──required by──> Ticket-to-settlement matching
    └──required by──> Discrepancy detection
    └──requires──>    Buyer registry (import is always for a specific buyer)
    └──requires──>    Buyer column map (or UI to create one on first import)

Manual settlement entry
    └──required by──> Ticket-to-settlement matching (paper buyers must enter this way)
    └──requires──>    Buyer registry

Ticket-to-settlement matching
    └──required by──> Discrepancy detection
    └──required by──> Reconciliation status per ticket
    └──required by──> Settlement total vs farm total
    └──required by──> Unmatched load alert dashboard

Reconciliation status per ticket
    └──required by──> Disputed ticket workflow
    └──required by──> Unmatched load alert dashboard (filter on status)

Buyer column map persistence
    └──enhances──>    Settlement import (re-import without re-mapping)
    └──requires──>    Buyer registry (map stored per buyer)
```

### Dependency Notes

- **Buyer registry must be first.** Every other new entity references a buyer. Build buyer CRUD before destination field, import, or matching.
- **cropYear must be added to tickets before matching is built.** Without it, matching is ambiguous across seasons.
- **Database migration is the prerequisite gate.** Flat JSON cannot serve cross-entity queries. All new features are blocked until Prisma + PostgreSQL is in place.
- **Manual settlement entry is not optional.** At least one buyer at Hughes Farm sends paper-only statements. Without a manual entry path, that buyer is unreconciled forever.
- **Exact ticket number match is sufficient for MVP.** Most co-op and elevator settlement CSVs include the scale ticket number. Fuzzy match (date + weight) is a v2.x enhancement, needed only if evidence from real import cycles shows unmatched tickets that have no number on the buyer's statement.

---

## MVP Definition

### Launch With (v2.0 — this milestone)

What must exist for the milestone to deliver its core value: "tracks every load from combine to settlement, reconciles against buyer payments, and flags discrepancies immediately."

- [ ] Database migration (Express + Prisma + PostgreSQL, preserve existing UI and PWA) — prerequisite for everything
- [ ] Buyer/destination registry — 4–10 records, simple CRUD, shortCode for UI display
- [ ] Destination field on tickets — structured FK to buyer registry, replaces free-text destination in notes
- [ ] cropYear field on tickets — integer, enables season scoping
- [ ] Settlement import (CSV with column mapping UI) — primary digital buyer path; preview before commit
- [ ] Manual settlement entry — form-based for paper/PDF buyers; all fields that appear on settlement statements
- [ ] Ticket-to-settlement matching by ticket number — exact match first, same buyer and cropYear
- [ ] Reconciliation status per ticket — unreconciled / matched / disputed / manual-override
- [ ] Unmatched load alert dashboard — farm-only tickets and settlement-only lines, filterable by buyer and cropYear
- [ ] Settlement summary view — farm total vs buyer settled total per crop/buyer/season

### Add After Validation (v2.x)

After the first full season of use reveals real usage patterns:

- [ ] Weight discrepancy tolerance flagging — add once real variance data from first import cycle is available
- [ ] Buyer column map persistence — add after first import cycle shows re-mapping burden
- [ ] Disputed ticket workflow (notes + resolvedAt) — add when farm manager reports needing to track resolution
- [ ] Multi-buyer season summary — add once all buyers are loaded and a full season has been reconciled

### Future Consideration (v3+)

- [ ] Crop insurance yield report with reconciled totals — requires understanding FSA/insurance workflow; existing guarantee/coverage/claimThreshold fields in farm-summary provide the foundation
- [ ] Fuzzy settlement matching (date + weight) — only if exact ticket number matching leaves significant unmatched loads
- [ ] Contract tracking (forward, basis, HTA) — separate milestone, significant domain complexity
- [ ] Settlement PDF parsing via Claude Vision — only if paper buyer volume justifies engineering cost vs manual entry

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Database migration | HIGH (prerequisite) | MEDIUM | P1 |
| Buyer registry | HIGH | LOW | P1 |
| Destination field on tickets | HIGH | LOW | P1 |
| cropYear on tickets | HIGH | LOW | P1 |
| Settlement import CSV with column mapping | HIGH | HIGH | P1 |
| Manual settlement entry | HIGH | MEDIUM | P1 |
| Ticket-to-settlement matching | HIGH | HIGH | P1 |
| Reconciliation status per ticket | HIGH | LOW | P1 |
| Unmatched load alert dashboard | HIGH | MEDIUM | P1 |
| Settlement summary view | HIGH | LOW | P1 |
| Weight discrepancy tolerance flag | MEDIUM | MEDIUM | P2 |
| Buyer column map persistence | MEDIUM | MEDIUM | P2 |
| Disputed ticket workflow | MEDIUM | LOW | P2 |
| Multi-buyer season summary | MEDIUM | LOW | P2 |
| Crop insurance yield report | MEDIUM | MEDIUM | P3 |
| Fuzzy match (date + weight) | LOW-MEDIUM | MEDIUM | P3 |
| Contract management | LOW (this scope) | HIGH | defer |

**Priority key:**
- P1: Must have for milestone launch
- P2: Add in v2.x patch after first-season validation
- P3: Future milestone consideration

---

## Settlement Statement Reality

Based on PROJECT.md workflow description, farmer forum accounts, and commercial grain software documentation:

**What a buyer settlement statement typically contains:**

| Field | Notes |
|-------|-------|
| Ticket/scale number | Primary match key — always present on elevator-printed tickets |
| Date received | May differ from farm delivery date by 1–2 days |
| Gross weight, tare weight, net weight | Elevator's measurement — may differ from farm buggy weight by 0.25–0.5% |
| Moisture % | Measured at elevator intake — may differ from farm's field reading |
| Test weight (lbs/bu) | Used for grade and price adjustment |
| Net bushels (after shrink) | Key figure — this is what gets paid |
| Price per bushel | From contract or spot price |
| Deductions | Drying charge, FM dock, handling, freight, storage |
| Net payment | Gross - deductions |
| Contract number | Which pricing contract this load applies to |

**Format variation is the real challenge:**
- Large co-ops: CSV or Excel download — importable with column mapping
- Maltsters (Meristem Malt in this ecosystem): likely custom format
- Specialty buyers: often PDF or paper — manual entry required
- Grain elevators: may provide portal download or email PDF

**Column header variation examples (same data, different headers):**
- Net weight: "Net Wt", "NET WEIGHT", "Net Pounds", "NET LBS"
- Ticket number: "Ticket", "Scale Ticket", "Ticket No", "TICKET #", "Ticket Number"
- Net bushels: "Net Bu", "NET BUSHELS", "Bushels", "NET BU"

This is why column mapping persistence per buyer is valuable after the first import cycle.

---

## Competitor Feature Analysis

This is a farm-side system (seller/producer perspective), not an elevator system (buyer/receiver perspective). Most commercial grain software is elevator-facing. The relevant comparison is against farm management tools with settlement tracking.

| Feature | JasBo Technologies | GrainFlow | Spreadsheet (current) | Our Approach |
|---------|-------------------|-----------|-----------------------|--------------|
| Settlement import | Not described | Not described | Manual entry | CSV import with column mapping UI |
| Discrepancy detection | User finds missing loads manually | Printout to compare vs statement | Manual line-by-line | Automated: flag farm-only and settlement-only on import |
| Buyer management | Not described | Not described | Named tabs per crop | First-class buyer registry |
| Multi-buyer | Not described | Not described | 31 separate sheets | Unified view across all buyers |
| Manual entry | Required for paper | Required for paper | Default method | Form for paper/PDF buyers |
| Weight tolerance | Not described | Manual comparison | Manual check | Configurable threshold flag |

Key insight: Commercial farm-side tools generate a comparison printout that the farmer reconciles manually. The gap is automation — matching and flagging automatically so the farmer reviews only exceptions, not every line.

---

## Sources

- [Grain Farm Software | Vertical Software](https://www.verticalsoftware.net/grain-farm-software/) — settlement tracking, contract balance, ticket-to-settlement matching patterns (MEDIUM confidence — vendor marketing)
- [Ag software: JasBo Technologies | Farm Progress](https://www.farmprogress.com/technology/ag-software-grain-management-with-jasbo-technologies-) — missing load discovery, settlement reconciliation workflow; finding one missing load "paid for the software itself" (MEDIUM confidence — trade press)
- [Grain settlement checks thread | NewAgTalk forum](https://talk.newagtalk.com/forums/thread-view.asp?tid=542304&DisplayType=nested&setCookie=1) — real farmer accounts: missing loads, contract misapplication, payment errors, manual defensive tracking (HIGH confidence for user behavior patterns — direct user reports)
- [Settlements in Grain | Agvance Help Center](https://helpcenter.agvance.net/home/settlements-in-grain) — settlement data model, destination types, contract types, deduction types (MEDIUM confidence — vendor docs)
- [GMS Grain Management — Ticket Entry Fields](https://www.gmsgrain.com/2022/04/03/on-line-ticket-entry/) — complete ticket field list: gross/tare/net weight, moisture, FM, test weight, commodity, farm/field, truck ID, contract number (HIGH confidence — vendor documentation of actual system fields)
- [Understanding Grain Discount Schedules | Penn State Extension](https://extension.psu.edu/understanding-grain-discount-schedules) — moisture shrink mechanics, FM discounts, test weight (HIGH confidence — university extension)
- [Dynamics 365 for Grain Management | Stoneridge Software](https://stoneridgesoftware.com/dynamics-365-for-grain-management-solutions/) — automated ticket integration, contract matching patterns (MEDIUM confidence — vendor)
- [Grain Settlement FAQs | The Andersons](https://www.andersonsgrain.com/tools/settlement/) — buyer-side settlement fields and process (MEDIUM confidence — actual grain buyer)
- [Top 7 Grain Management Software 2025 | SafetyCulture](https://safetyculture.com/apps/grain-management-software) — ecosystem overview (LOW-MEDIUM confidence — aggregator)

---

*Feature research for: grain traceability and settlement reconciliation (grain-tickets v2.0 milestone)*
*Researched: 2026-03-01*
