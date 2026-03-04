# Requirements: Farm Operations Platform

**Defined:** 2026-03-02
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.

## v3.0 Requirements

Requirements for organic cert transparency + procurement pipeline milestone. Each maps to roadmap phases.

### Foundation Fixes

- [x] **FIX-01**: Sync Acres button on Fields page works without runtime crash
- [x] **FIX-02**: Enterprise query returns all enterprises per field (no truncation at 3)
- [x] **FIX-03**: Partial unique index captured in schema.prisma for environment rebuild safety

### Ecosystem Data Pull

- [x] **ECO-01**: User can see live organic-designated field data pulled from farm-budget
- [x] **ECO-02**: User can see live field identities and acres pulled from farm-registry
- [x] **ECO-03**: User can see live delivery records pulled from grain-tickets for organic fields
- [x] **ECO-04**: User can map farm-budget field names to organic-cert field records when automatic name matching fails
- [x] **ECO-05**: Ecosystem pull degrades gracefully when a source app is not running (shows which sources are unavailable)

### Compilation Engine

- [x] **CMP-01**: User can preview compiled data before committing (see exactly what will be written from each source)
- [x] **CMP-02**: User can compile enterprise/field data from farm-budget into organic-cert field records
- [x] **CMP-03**: User can compile input application data from farm-budget into organic-cert material usage records
- [x] **CMP-04**: User can compile seed data from farm-budget into organic-cert seed source records
- [x] **CMP-05**: User can see a compilation readiness dashboard showing completeness per NOP section

### Rotation History

- [x] **ROT-01**: User can take a yearly rotation snapshot capturing field-crop-acre assignments from farm-budget
- [x] **ROT-02**: Rotation snapshots accumulate to provide 3-year NOP field history
- [x] **ROT-03**: User sees a warning when no snapshot exists for the current crop year

### Harvest Data

- [x] **HRV-01**: User can compile harvest/delivery records from grain-tickets into organic-cert harvest events
- [x] **HRV-02**: Harvest compilation normalizes crop names between grain-tickets and organic-cert

### PDF Report Refresh

- [x] **PDF-01**: 8-section NOP inspection PDF renders correctly from compiled ecosystem data
- [x] **PDF-02**: PDF handles null/missing compiled data gracefully (no rendering artifacts)

### Procurement Pipeline (Phase 19)

- [x] **INV-01**: Forecast Hub shows farm-wide product needs grouped by Seed/Fertilizer/Chemical, live-computed from Macro Roll-Up data, with expandable field breakdowns and visual % ordered status bars
- [x] **INV-02**: User can create orders from forecast selections (grouped by supplier), record multiple deliveries per order, and order status auto-transitions (ordered/partial/complete)
- [x] **INV-03**: Five print-optimized HTML reports accessible from Forecast tab: Agronomist Order Sheet, Field-Level Input Plan, Forecast Summary, Order Status Report, Delivery Receipt Log
- [x] **INV-04**: Navigation restructured to Forecasts/Orders/Deliveries/Seeds top-level tabs with existing Products/Implements/Suppliers/Labor moved to Reference tab
- [x] **INV-05**: Day/night mode with sun/moon toggle, CSS custom properties for light/dark palettes, persisted in localStorage

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 15 | Complete |
| FIX-02 | Phase 15 | Complete |
| FIX-03 | Phase 15 | Complete |
| ECO-01 | Phase 15 | Complete |
| ECO-02 | Phase 15 | Complete |
| ECO-05 | Phase 15 | Complete |
| ECO-03 | Phase 16 | Complete |
| ECO-04 | Phase 16 | Complete |
| CMP-01 | Phase 16 | Complete |
| CMP-02 | Phase 16 | Complete |
| CMP-05 | Phase 16 | Complete |
| CMP-03 | Phase 17 | Complete |
| CMP-04 | Phase 17 | Complete |
| ROT-01 | Phase 18 | Complete |
| ROT-02 | Phase 18 | Complete |
| ROT-03 | Phase 18 | Complete |
| HRV-01 | Phase 18 | Complete |
| HRV-02 | Phase 18 | Complete |
| PDF-01 | Phase 18 | Complete |
| PDF-02 | Phase 18 | Complete |
| INV-01 | Phase 19 | Complete |
| INV-02 | Phase 19 | Complete |
| INV-03 | Phase 19 | Complete |
| INV-04 | Phase 19 | Complete |
| INV-05 | Phase 19 | Complete |

**v3.0 Coverage:**
- v3.0 requirements: 25 total
- Complete: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-04 — v2.0 requirements archived*
