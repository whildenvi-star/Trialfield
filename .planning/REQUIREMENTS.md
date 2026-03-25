# Requirements: Farm Operations Platform

**Defined:** 2026-03-24
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## v10.0 Requirements

Requirements for Platform Consolidation & Data Integrity. Each maps to roadmap phases.

### Data Consolidation

- [ ] **CONS-01**: Portal Supabase is the single data store for FSA CLU records — fsa-acres Express app reads/writes through portal API, not local JSON
- [ ] **CONS-02**: Portal Supabase is the single data store for insurance policies and pricing — fsa-acres reads/writes through portal API
- [ ] **CONS-03**: USDA RMA price scraper available in portal (migrated from fsa-acres) and updates insurance_pricing table
- [ ] **CONS-04**: fsa-acres seasonal dashboard, reports, and GCS features continue working against consolidated data
- [ ] **CONS-05**: One-time data migration script moves fsa-acres JSON records to Supabase with duplicate detection and verification
- [x] **CONS-06**: Every field record in every app has a registry_field_id that maps to farm-registry
- [x] **CONS-07**: Cross-module data joins use registry field ID, not string name matching
- [x] **CONS-08**: Backfill scripts populate registry_field_id in farm-budget, grain-tickets, portal clu_records, and fsa-acres
- [x] **CONS-09**: Canonical crop registry in farm-registry with crop ID, canonical name, and per-app name aliases
- [ ] **CONS-10**: All apps fetch crop list from farm-registry instead of hardcoded local arrays
- [x] **CONS-11**: Cross-module crop aggregation uses canonical crop ID, not display name

### Data Pipelines

- [ ] **PIPE-01**: Grain-tickets automatically computes yield summary per farm/crop after ticket save
- [ ] **PIPE-02**: Yield summary auto-pushes to portal insurance policies (updates actual yield, sets synced flag)
- [ ] **PIPE-03**: Farm-budget dashboard shows actual yields from grain-tickets without manual entry
- [ ] **PIPE-04**: Visual indicator in insurance and budget UIs shows "Yield synced from grain tickets" with timestamp
- [ ] **PIPE-05**: Organic-cert compilation engine reads seed lot numbers and cert numbers from seed-inventory instead of farm-budget
- [ ] **PIPE-06**: NOP C9.0 audit section auto-populated from seed-inventory delivery data (lot, cert, OMRI, supplier)
- [ ] **PIPE-07**: Meristem-malt grain cost pulls actual settlement prices from grain-tickets
- [ ] **PIPE-08**: Meristem-malt pricing table shows "synced from grain tickets" with manual override flag

### UX & Navigation

- [ ] **UXN-01**: Portal dashboard shows actionable items (overdue claims, unreported CLUs, unreconciled settlements, delivery shortfalls) instead of module cards
- [ ] **UXN-02**: Each dashboard action item links directly to the relevant module with context (filter/highlight)
- [ ] **UXN-03**: Dashboard works when 1-2 Express apps are offline (Promise.allSettled with graceful degradation)
- [ ] **UXN-04**: Embedded Express apps hide their header bar when inside portal iframe
- [ ] **UXN-05**: Portal shows breadcrumb bar above iframe embeds showing current navigation path
- [ ] **UXN-06**: "Back to Dashboard" escape hatch always visible when inside an embed
- [ ] **UXN-07**: All 8 apps use identical color tokens (bg, surface, border, accent, text) from shared platform-tokens.css
- [ ] **UXN-08**: Day/night toggle produces consistent results across portal and all embedded apps
- [ ] **UXN-09**: Switching between portal and any embedded app shows zero visual color jarring

### Domain Features

- [ ] **DOM-01**: Grain marketing position view shows estimated production, contracted bushels, and unpriced bushels per crop
- [ ] **DOM-02**: Unpriced bushel dollar exposure calculated from live CBOT futures prices
- [ ] **DOM-03**: Contract type support: cash, accumulator, HTA, options, min-price, basis
- [ ] **DOM-04**: APH records table stores 4-10 years of actual yield per farm/unit/crop with source tracking
- [ ] **DOM-05**: APH computed from yield history using simple average (excluding zero-yield disaster years)
- [ ] **DOM-06**: Insurance guarantee auto-calculated from computed APH × coverage level
- [ ] **DOM-07**: Unified field activity timeline shows all activities for a field in chronological order (budget planned passes, organic-cert confirmed ops, FieldOps machine data, grain-ticket deliveries)
- [ ] **DOM-08**: Timeline entries color-coded by source with expandable details
- [ ] **DOM-09**: Toggling prevented planting on a CLU/policy shows estimated PP indemnity using RMA coverage factors
- [ ] **DOM-10**: PP indemnity appears in insurance PDF report
- [ ] **DOM-11**: Settlement financial summary shows per-buyer per-crop revenue (delivered BU, price, deductions, net payment)
- [ ] **DOM-12**: Settlement financial summary compares contract price vs actual settlement price with variance

### Workflow Automation

- [ ] **AUTO-01**: Adding a field in farm-registry auto-creates corresponding records in farm-budget, grain-tickets, and portal
- [ ] **AUTO-02**: Downstream records have correct registry_field_id for future syncs
- [ ] **AUTO-03**: Webhook failures don't block farm-registry save (async, logged, retry once)

## v11.0+ Requirements (Deferred)

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
| CONS-06 | Phase 49 | Complete |
| CONS-07 | Phase 49 | Complete |
| CONS-08 | Phase 49 | Complete |
| CONS-09 | Phase 50 | Complete |
| CONS-10 | Phase 50 | Pending |
| CONS-11 | Phase 50 | Complete |
| CONS-01 | Phase 51 | Pending |
| CONS-02 | Phase 51 | Pending |
| CONS-03 | Phase 51 | Pending |
| CONS-04 | Phase 51 | Pending |
| CONS-05 | Phase 51 | Pending |
| PIPE-01 | Phase 52 | Pending |
| PIPE-02 | Phase 52 | Pending |
| PIPE-03 | Phase 52 | Pending |
| PIPE-04 | Phase 52 | Pending |
| PIPE-05 | Phase 53 | Pending |
| PIPE-06 | Phase 53 | Pending |
| PIPE-07 | Phase 53 | Pending |
| PIPE-08 | Phase 53 | Pending |
| UXN-04 | Phase 54 | Pending |
| UXN-05 | Phase 54 | Pending |
| UXN-06 | Phase 54 | Pending |
| UXN-07 | Phase 54 | Pending |
| UXN-08 | Phase 54 | Pending |
| UXN-09 | Phase 54 | Pending |
| UXN-01 | Phase 55 | Pending |
| UXN-02 | Phase 55 | Pending |
| UXN-03 | Phase 55 | Pending |
| DOM-04 | Phase 56 | Pending |
| DOM-05 | Phase 56 | Pending |
| DOM-06 | Phase 56 | Pending |
| DOM-01 | Phase 57 | Pending |
| DOM-02 | Phase 57 | Pending |
| DOM-03 | Phase 57 | Pending |
| DOM-07 | Phase 58 | Pending |
| DOM-08 | Phase 58 | Pending |
| DOM-09 | Phase 59 | Pending |
| DOM-10 | Phase 59 | Pending |
| DOM-11 | Phase 60 | Pending |
| DOM-12 | Phase 60 | Pending |
| AUTO-01 | Phase 61 | Pending |
| AUTO-02 | Phase 61 | Pending |
| AUTO-03 | Phase 61 | Pending |

**Coverage:**
- v10.0 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 — traceability populated after v10.0 roadmap creation*
