# Requirements: Farm Operations Platform

**Defined:** 2026-03-05
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## v6.0 Requirements

Requirements for milestone v6.0 FSA Acres, Insurance & Claims. Each maps to roadmap phases.

### FSA Planting Workflow

- [x] **FSA-01**: User can see existing CLU records (migrated from fsa-acres) in the portal, scoped by crop year
- [x] **FSA-02**: User can view CLU records as cards grouped by Farm/Tract/CLU with status badges
- [x] **FSA-03**: User can edit crop, practice, planting date, and organic flag on a CLU card
- [x] **FSA-04**: User can bulk-select CLUs and mark as reported to FSA
- [x] **FSA-05**: User can see validation warnings (missing crop, date, unreported) with clickable links
- [x] **FSA-06**: User can auto-populate CLU crop assignments from farm-budget macro rollup with preview
- [x] **FSA-07**: User can generate a print-ready FSA Acreage Reporting Summary PDF
- [x] **FSA-08**: User can export CLU records as CSV

### Insurance Decision Tool

- [x] **INS-01**: User can see existing insurance policies (migrated from fsa-acres) in the portal
- [x] **INS-02**: User can create, edit, and delete insurance policies with slide-out editor
- [x] **INS-03**: User can see a coverage level comparison matrix across RP, RP-HPE, and YP at 50-85%
- [x] **INS-04**: User can simulate payout scenarios with interactive yield and price sliders
- [x] **INS-05**: User can see APH yield auto-populated from CLU records
- [x] **INS-06**: User can sync actual yield from grain-tickets for post-harvest comparison
- [x] **INS-07**: User can see potential claim alerts when actual yield < effective guarantee
- [x] **INS-08**: User can generate an insurance summary report

### Claims Tracking

- [x] **CLM-01**: User can view claims as a Kanban board with pipeline stages
- [x] **CLM-02**: User can advance claims between stages via drag-and-drop
- [x] **CLM-03**: User can view claim detail with timeline, documents, and financials
- [x] **CLM-04**: User can upload documents to a claim via Supabase Storage
- [x] **CLM-05**: User can see deadline alerts for approaching filing deadlines
- [x] **CLM-06**: User can add timestamped notes to a claim timeline
- [x] **CLM-07**: User can create a claim pre-filled from an insurance policy

### Cross-Module Integration

- [x] **INT-01**: User can navigate from FSA CLU to related insurance policy
- [x] **INT-02**: User can navigate from insurance policy to create a claim
- [x] **INT-03**: User sees prompted claim creation when CLU marked Prevented Planting
- [x] **INT-04**: User can see FSA, Insurance, and Claims summary cards on portal dashboard

## Future Requirements

Deferred to v7+. Tracked but not in current roadmap.

### FSA Enhancements

- **FSA-09**: Year-over-year CLU comparison (side-by-side prior/current crop per CLU)
- **FSA-10**: Crop assignment templates (save/apply common rotation patterns)
- **FSA-11**: FSA reporting deadline countdown with urgency warnings
- **FSA-12**: CNH FieldOps as-planted date auto-fill

### Insurance Enhancements

- **INS-09**: Historical insurance performance dashboard (multi-year premium vs indemnity, loss ratio)
- **INS-10**: SCO/ECO layer visualization with county APH data
- **INS-11**: Unit structure comparison matrix (enterprise vs basic vs optional)
- **INS-12**: Bulk grain ticket sync across all policies
- **INS-13**: USDA RMA projected price auto-fetch

### Claims Enhancements

- **CLM-08**: Claims analytics dashboard (claims by year, recovery rate, cycle time)
- **CLM-09**: Consolidated deadline calendar (FSA + insurance + claims dates combined)
- **CLM-10**: Stage-specific document checklist per claim type
- **CLM-11**: Settlement vs farm-budget variance tracking

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Pixel-perfect FSA-578 government form PDF replica | react-pdf flexbox cannot achieve it; FSA generates the official form; we provide a summary report |
| Direct FSA eAuth electronic submission | Requires USDA partnership agreements and federal compliance review |
| GIS/map-based CLU boundaries | USDA CLU spatial data restricted; Farm-Tract-Field hierarchy sufficient |
| Automated premium quotes from insurance companies | Insurance premium APIs are proprietary; no public API exists |
| Live CME futures price integration | Confuses live futures with USDA RMA monthly average prices |
| Auto-file insurance claims without producer review | Liability exposure; producer must certify and submit |
| Insurance company portal sync | Each AIP has different portal; no public API for claim status |
| Multi-policy aggregate claims | Each insurance policy is a separate legal contract |
| Full-stack rewrite of fsa-acres Express app | Keep existing app as data source; portal is the new UI |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FSA-01 | Phase 27 | Complete |
| FSA-02 | Phase 28 | Complete |
| FSA-03 | Phase 28 | Complete |
| FSA-04 | Phase 28 | Complete |
| FSA-05 | Phase 27 | Complete |
| FSA-06 | Phase 27 | Complete |
| FSA-07 | Phase 28 | Complete |
| FSA-08 | Phase 28 | Complete |
| INS-01 | Phase 29 | Complete |
| INS-02 | Phase 30 | Complete |
| INS-03 | Phase 30 | Complete |
| INS-04 | Phase 30 | Complete |
| INS-05 | Phase 34 | Complete |
| INS-06 | Phase 34 | Complete |
| INS-07 | Phase 29 | Complete |
| INS-08 | Phase 30 | Complete |
| CLM-01 | Phase 32 | Complete |
| CLM-02 | Phase 32 | Complete |
| CLM-03 | Phase 32 | Complete |
| CLM-04 | Phase 31 | Complete |
| CLM-05 | Phase 32 | Complete |
| CLM-06 | Phase 32 | Complete |
| CLM-07 | Phase 34 | Complete |
| INT-01 | Phase 33 | Complete |
| INT-02 | Phase 33 | Complete |
| INT-03 | Phase 33 | Complete |
| INT-04 | Phase 33 | Complete |

**Coverage:**
- v6.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 — traceability populated after roadmap creation*
