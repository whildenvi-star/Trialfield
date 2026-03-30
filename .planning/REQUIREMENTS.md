# Requirements: Farm Operations Platform

**Defined:** 2026-03-26
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## v11.0 Requirements

Requirements for Domain Features & Workflow Automation. Each maps to roadmap phases. Builds on v10.0's consolidated data platform (canonical IDs, single data stores, pipelines).

### Dashboard & Navigation

- [x] **DASH-01**: Portal dashboard shows actionable items (overdue claims, unreported CLUs, unreconciled settlements, delivery shortfalls) instead of static module cards
- [x] **DASH-02**: Each dashboard action item links directly to the relevant module with context (filter/highlight the specific item)
- [x] **DASH-03**: Dashboard works when 1-2 Express apps are offline (Promise.allSettled with graceful degradation)

### Insurance & APH

- [x] **APH-01**: APH records table stores 4-10 years of actual yield per farm/unit/crop with source tracking
- [x] **APH-02**: APH computed from yield history using simple average (excluding zero-yield disaster years)
- [x] **APH-03**: Insurance guarantee auto-calculated from computed APH × coverage level
- [x] **PP-01**: Toggling prevented planting on a CLU/policy shows estimated PP indemnity using RMA coverage factors
- [x] **PP-02**: PP indemnity appears in insurance PDF report

### Grain Marketing

- [x] **MKT-01**: Grain marketing position view shows estimated production, contracted bushels, and unpriced bushels per crop
- [x] **MKT-02**: Unpriced bushel dollar exposure calculated from live CBOT futures prices
- [x] **MKT-03**: Contract type support: cash, accumulator, HTA, options, min-price, basis

### Field Operations

- [x] **FLD-01**: Unified field activity timeline shows all activities for a field in chronological order (budget planned passes, organic-cert confirmed ops, FieldOps machine data, grain-ticket deliveries)
- [x] **FLD-02**: Timeline entries color-coded by source with expandable details

### Settlement & Revenue

- [x] **SET-01**: Settlement financial summary shows per-buyer per-crop revenue (delivered BU, price, deductions, net payment)
- [x] **SET-02**: Settlement financial summary compares contract price vs actual settlement price with variance

### Workflow Automation

- [x] **AUTO-01**: Adding a field in farm-registry auto-creates corresponding records in farm-budget, grain-tickets, and portal
- [x] **AUTO-02**: Downstream records have correct registry_field_id for future syncs
- [x] **AUTO-03**: Webhook failures don't block farm-registry save (async, logged, retry once)

## v12.0+ Requirements (Deferred)

### Future Enhancements
- **FUT-01**: Delivery schedule calendar for grain contracts (delivery windows, bin assignments)
- **FUT-02**: Basis history tracking per buyer over time
- **FUT-03**: SCO/ECO insurance coverage types
- **FUT-04**: Buffer zone spatial validation using shapefile geometry
- **FUT-05**: NOP input compliance checking (prevent prohibited material application to organic fields)
- **FUT-06**: Transaction certificate generation for organic grain sales
- **FUT-07**: Soil test result tracking tied to fertility input decisions
- **FUT-08**: Weather/GDD integration for agronomic decisions
- **FUT-09**: QBO (QuickBooks Online) integration for actual expense tracking
- **FUT-10**: Variable-rate prescription management with management zones

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewrite Express apps to Next.js | Working apps — consolidation is data-level, not framework-level |
| Multi-farm/multi-grower support | Single farm operation — complexity not justified |
| Real-time collaboration/conflict resolution | 6-15 users, low concurrency — not needed |
| USDA FSA online system API integration | No public API exists; Excel import is only option |
| Insurance premium calculation engine | "Decision support" only — agent handles actual premium quotes |
| Elevator-side APIs for settlement import | Elevator formats vary wildly; manual CSV/Excel import sufficient |
| Native mobile app | PWA approach chosen (v9.0) — no app store needed |
| Automated NOP violation detection | Inspector makes the call; we provide records |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 55 | Complete |
| DASH-02 | Phase 55 | Complete |
| DASH-03 | Phase 55 | Complete |
| APH-01 | Phase 56 | Complete |
| APH-02 | Phase 56 | Complete |
| APH-03 | Phase 56 | Complete |
| MKT-01 | Phase 57, 57.1, 63 | Pending |
| MKT-02 | Phase 57, 57.1 | Complete |
| MKT-03 | Phase 57 | Complete |
| FLD-01 | Phase 58 | Complete |
| FLD-02 | Phase 58 | Complete |
| PP-01 | Phase 59 | Complete |
| PP-02 | Phase 59 | Complete |
| SET-01 | Phase 60 | Complete |
| SET-02 | Phase 60 | Complete |
| AUTO-01 | Phase 62 | Complete |
| AUTO-02 | Phase 62 | Complete |
| AUTO-03 | Phase 61 | Complete |

**Coverage:**
- v11.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-29 after v11.0 gap closure phases 62-63 created*
