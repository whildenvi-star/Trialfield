# Requirements: Projected vs Actual Farm Budget

**Defined:** 2026-03-20
**Core Value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it

## v2.0 Requirements

Requirements for projected vs actual milestone. Each maps to roadmap phases.

### Privacy & Auth

- [x] **PRIV-01**: Budget API strips financial fields (revenue, margin, sale prices, profit/acre) from responses for non-ADMIN roles
- [x] **PRIV-02**: `getAuthContext()` ADMIN fallback is removed — unauthenticated requests return error, not admin access
- [x] **PRIV-03**: New RBAC permissions `budget:read` (ADMIN + OFFICE) and `budget:financial` (ADMIN only) are enforced
- [x] **PRIV-04**: OFFICE role `sale:read` permission is removed

### Actuals Entry

- [ ] **ACT-01**: OFFICE user can update material input costs with actual invoice amounts
- [ ] **ACT-02**: OFFICE user can confirm planned field operations as completed with actual dates
- [ ] **ACT-03**: OFFICE user can enter actual harvest yield per acre
- [ ] **ACT-04**: OFFICE user can update seed costs with actual purchase prices
- [x] **ACT-05**: Actuals entries are recorded immediately without approval

### Budget Views

- [ ] **VIEW-01**: Enterprise Budget tab shows projected and actual columns side by side
- [ ] **VIEW-02**: Variance column shows difference between projected and actual with favorable/unfavorable color coding
- [ ] **VIEW-03**: DataSource badges on line items indicate whether data is projected (synced) or actual (entered)
- [ ] **VIEW-04**: Farm-wide budget summary page aggregates all enterprises for a crop year
- [ ] **VIEW-05**: Farm-wide view mirrors Macro Rollup layout stylistically
- [x] **VIEW-06**: Financial columns (revenue, margin, profit) visible only to ADMIN on all views

### Sync

- [ ] **SYNC-01**: All enterprises (organic + conventional) sync from farm-budget service
- [ ] **SYNC-02**: Existing organic enterprise data is preserved when sync expands to all enterprises

## v1.0 Requirements (Paused — Mobile PWA)

### Mobile Dashboard

- [ ] **DASH-01**: User can view a mobile-optimized dashboard with key data from accessible modules
- [ ] **DASH-02**: User can perform one-tap quick actions on dashboard cards
- [ ] **DASH-03**: Dashboard shows only modules the user has access to

### Mobile UX

- [ ] **UX-01**: All mobile forms use touch-friendly controls (44px+ tap targets, single-column layout)
- [ ] **UX-02**: User can navigate the mobile experience with a bottom nav or similar mobile-first pattern

### Field Data

- [ ] **FIELD-01**: User can submit a field observation with text notes from their phone
- [ ] **FIELD-02**: User can attach a photo to a field observation
- [ ] **FIELD-03**: Field observations queue offline and sync when connectivity returns

### Sync (Mobile)

- [ ] **MSYNC-01**: User sees a clear online/offline status indicator
- [ ] **MSYNC-02**: User sees a count of pending unsynced items

## v3.0 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Workflow Enhancements

- **WF-01**: Bulk operation confirmation — one-click confirm all planned operations for an enterprise
- **WF-02**: Inline actuals editing on Budget tab — click-to-edit cost fields without navigating to separate form
- **WF-03**: Crop-year selector on farm-wide summary view

### Integration

- **INT-01**: Actuals sync back to farm-budget service
- **INT-02**: Invoice attachment / document storage for material usages

## Out of Scope

| Feature | Reason |
|---------|--------|
| Approval workflow for actuals entry | Admin trusts team; AuditLog already captures every change. Approval gate adds friction. |
| Syncing actuals back to farm-budget service | Farm-budget is source of truth for projections; organic-cert records reality alongside, not inside it |
| Invoice attachment / document storage | Adds file storage complexity not needed for projected vs actual comparison |
| Real-time multi-user editing | Small team, low conflict probability, high implementation complexity |
| Budget re-forecasting | That's the farm-budget service's job — organic-cert records actuals against the static plan |
| Per-acre profitability map / heat map | Requires GIS rendering; tabular farm-wide summary achieves same analytical goal |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

### v2.0 Requirements

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRIV-01 | Phase 5 | Complete |
| PRIV-02 | Phase 5 | Complete |
| PRIV-03 | Phase 5 | Complete |
| PRIV-04 | Phase 5 | Complete |
| ACT-01 | Phase 6 | Pending |
| ACT-02 | Phase 6 | Pending |
| ACT-03 | Phase 6 | Pending |
| ACT-04 | Phase 6 | Pending |
| ACT-05 | Phase 6 | Complete |
| VIEW-01 | Phase 6 | Pending |
| VIEW-02 | Phase 6 | Pending |
| VIEW-03 | Phase 6 | Pending |
| VIEW-06 | Phase 6 | Complete |
| SYNC-01 | Phase 7 | Pending |
| SYNC-02 | Phase 7 | Pending |
| VIEW-04 | Phase 8 | Pending |
| VIEW-05 | Phase 8 | Pending |

**Coverage:**
- v2.0 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

### v1.0 Requirements (Paused)

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 1 | Paused |
| UX-02 | Phase 1 | Paused |
| MSYNC-01 | Phase 2 | Paused |
| MSYNC-02 | Phase 2 | Paused |
| DASH-01 | Phase 3 | Paused |
| DASH-02 | Phase 3 | Paused |
| DASH-03 | Phase 3 | Paused |
| FIELD-01 | Phase 4 | Paused |
| FIELD-02 | Phase 4 | Paused |
| FIELD-03 | Phase 4 | Paused |

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 — v2.0 traceability complete; all 17 requirements mapped to phases 5–8*
