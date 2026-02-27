# Requirements: Organic Audit System — v1.1 Split-Field Enterprises

**Defined:** 2026-02-27
**Core Value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.
**Milestone Value:** A single physical field can carry multiple crop enterprises in the same season — split planting, double-cropping, and fallow tracking all reflected accurately in history views and PDF reports.

## v1.1 Requirements

### Schema (SCHEMA)

- [x] **SCHEMA-01**: A field can have multiple enterprises for the same crop year (remove the current `[fieldId, cropYear, crop]` unique constraint)
- [x] **SCHEMA-02**: Each enterprise has a label or position identifier (e.g., "North 40", "South 80") to distinguish splits within the same field and crop year
- [x] **SCHEMA-03**: An enterprise can be typed as fallow/idle with optional overhead cost fields (cost amount, cost category, notes)
- [x] **SCHEMA-04**: Existing single-enterprise fields continue to work without modification (backward compatible)

### Acre Reconciliation (ACRE)

- [x] **ACRE-01**: Enterprise `plantedAcres` sum is validated against the field's `totalAcres` — warn when sum exceeds total, allow when under (fallow remainder)
- [x] **ACRE-02**: Field index shows acre utilization (e.g., "120 of 160 ac planted") when multiple enterprises exist
- [x] **ACRE-03**: Fallow/idle acres are calculated as field total minus sum of planted enterprise acres

### Field Views (VIEW)

- [ ] **VIEW-01**: Field index page shows consolidated field cards with enterprise count badge when > 1 enterprise exists
- [ ] **VIEW-02**: Field detail/history page defaults to consolidated view showing all enterprises for the field
- [ ] **VIEW-03**: User can drill down from consolidated view to a single enterprise's operations and history
- [ ] **VIEW-04**: Season cards in field history show multiple enterprise rows when a field is split that year
- [ ] **VIEW-05**: Enterprise creation form supports adding multiple enterprises to the same field and crop year

### Reports (RPT)

- [ ] **RPT-01**: Field List section in PDF shows each enterprise as a sub-row under its parent field (indented or grouped)
- [ ] **RPT-02**: Field History section in PDF groups operations by enterprise within each field, clearly labeled
- [ ] **RPT-03**: Harvest Log in PDF includes enterprise label alongside lot number for split fields
- [ ] **RPT-04**: Mass Balance in PDF aggregates correctly across multiple enterprises per field — no double-counting, no omissions

## Out of Scope

| Feature | Reason |
|---------|--------|
| GIS/map-based split definition | Geometry-based splitting adds complexity; label-based is sufficient for NOP audit |
| Enterprise-level organic status (different from field) | NOP certifies at field level; enterprise splits don't change organic status |
| Cross-field enterprise merging | A single enterprise spanning multiple fields is a different model; not needed for split-field |
| Automated split detection from Case IH data | Case IH doesn't report sub-field splits; user defines them manually |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 5 | Complete (05-01) |
| SCHEMA-02 | Phase 5 | Complete (05-01) |
| SCHEMA-03 | Phase 5 | Complete (05-01) |
| SCHEMA-04 | Phase 5 | Complete (05-01) |
| ACRE-01 | Phase 5 | Complete (05-02) |
| ACRE-02 | Phase 5 | Complete (05-02) |
| ACRE-03 | Phase 5 | Complete (05-02) |
| VIEW-01 | Phase 6 | Pending |
| VIEW-02 | Phase 6 | Pending |
| VIEW-03 | Phase 6 | Pending |
| VIEW-04 | Phase 6 | Pending |
| VIEW-05 | Phase 6 | Pending |
| RPT-01 | Phase 7 | Pending |
| RPT-02 | Phase 7 | Pending |
| RPT-03 | Phase 7 | Pending |
| RPT-04 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 — ACRE-01, ACRE-02, ACRE-03 marked complete after 05-02 execution; Phase 5 fully complete*
