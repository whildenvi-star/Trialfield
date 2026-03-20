# Requirements: Glomalin Portal Mobile PWA

**Defined:** 2026-03-20
**Core Value:** Farm team members can view critical operations data and submit field observations from their phones, even with spotty connectivity

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Mobile Dashboard

- [ ] **DASH-01**: User can view a mobile-optimized dashboard with key data from accessible modules
- [ ] **DASH-02**: User can perform one-tap quick actions on dashboard cards (e.g., mark task done)
- [ ] **DASH-03**: Dashboard shows only modules the user has access to

### Mobile UX

- [ ] **UX-01**: All mobile forms use touch-friendly controls (44px+ tap targets, single-column layout)
- [ ] **UX-02**: User can navigate the mobile experience with a bottom nav or similar mobile-first pattern

### Field Data

- [ ] **FIELD-01**: User can submit a field observation with text notes from their phone
- [ ] **FIELD-02**: User can attach a photo to a field observation
- [ ] **FIELD-03**: Field observations queue offline and sync when connectivity returns

### Sync

- [ ] **SYNC-01**: User sees a clear online/offline status indicator
- [ ] **SYNC-02**: User sees a count of pending unsynced items

## v2 Requirements

### Layout

- **LAYOUT-01**: Responsive layouts for individual module pages (FSA, Insurance, Claims, Macro Rollup)

### Offline

- **OFFLINE-01**: Offline read access for dashboard and crop plan data
- **OFFLINE-02**: Hardened sync with conflict detection and connectivity probe

### PWA

- **PWA-01**: Improved PWA install prompt (Android beforeinstallprompt + iOS manual instructions)
- **PWA-02**: Push notifications for deadline alerts (insurance, claims)

### Accessibility

- **A11Y-01**: High-contrast outdoor display mode for field use

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS/Android app | PWA approach is cheaper, reuses existing code, no app store overhead |
| Real-time collaborative editing | Merge conflict complexity far exceeds value for 2-5 person team |
| In-app chat / messaging | Duplicates existing communication tools team already uses |
| Full module feature parity on mobile | Dashboard-first approach; link to desktop for deep module work |
| GPS / location tagging | Low ROI for small team on known property; manual text input sufficient |
| Rich analytics on mobile | Farm analytics need large tables/charts — desktop workflow |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | Phase 1 | Pending |
| UX-02 | Phase 1 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| FIELD-01 | Phase 4 | Pending |
| FIELD-02 | Phase 4 | Pending |
| FIELD-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
