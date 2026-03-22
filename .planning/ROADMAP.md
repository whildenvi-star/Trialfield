# Roadmap: W. Hughes Farms — Operations Suite

## Milestones

| Milestone | Status | Phases |
|-----------|--------|--------|
| v1.0 — Mobile PWA | Paused | 1–4 (all phases paused; work not started) |
| v2.0 — Projected vs Actual Farm Budget | Shipped 2026-03-22 | 5–8 |

---

<details>
<summary>v2.0 — Projected vs Actual Farm Budget (Phases 5-8) — SHIPPED 2026-03-22</summary>

- [x] Phase 5: Privacy Foundation (2/2 plans) — completed 2026-03-21
- [x] Phase 6: Actuals Entry and Enterprise Budget View (3/3 plans) — completed 2026-03-21
- [x] Phase 6.1: Phase 6 Defect Fixes (1/1 plan) — completed 2026-03-21
- [x] Phase 7: All-Enterprise Sync (2/2 plans) — completed 2026-03-21
- [x] Phase 8: Farm-Wide Budget Summary (2/2 plans) — completed 2026-03-22

Full details: [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)

</details>

## v1.0 — Mobile PWA (Paused)

Phases 1–4 defined but not started. Paused in favor of v2.0 milestone. Phases preserved for future resumption.

### Phases (Paused)

- [ ] **Phase 1: Mobile Shell** - Navigable, touch-friendly mobile layout foundation (paused)
- [ ] **Phase 2: Offline Sync** - Hardened offline layer with visible sync status (paused)
- [ ] **Phase 3: Mobile Dashboard** - Phone-optimized dashboard with module-aware data (paused)
- [x] **Phase 4: Field Data Entry** - Field observation submission with offline queue (completed 2026-03-22)

### Phase Details (Paused)

#### Phase 1: Mobile Shell
**Goal**: Farm team members can open the portal on a phone and navigate between modules without layout breakage or unusably small touch targets
**Depends on**: Nothing (first phase)
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can tap any navigation item from their phone without mis-tapping adjacent items (44px+ targets)
  2. User can navigate between all native module pages using a bottom nav or equivalent mobile-first pattern
  3. All native module pages render in a single-column layout without horizontal scrolling on a 375px viewport
  4. Embedded iframe modules (FSA 578, Insurance, Claims, Macro Rollup) show a graceful fallback on mobile rather than a broken iframe
**Plans**: TBD

#### Phase 2: Offline Sync
**Goal**: Users can see whether they are online or offline and trust that any actions taken offline will sync when connectivity returns
**Depends on**: Phase 1
**Requirements**: MSYNC-01, MSYNC-02
**Success Criteria** (what must be TRUE):
  1. User sees a clear online/offline status indicator that updates when connectivity changes
  2. User sees a count of items queued but not yet synced to the server
  3. Queued items drain automatically when connectivity is restored without user action
  4. Sync does not silently overwrite data — conflicts surface visibly rather than failing silently
**Plans**: TBD

#### Phase 3: Mobile Dashboard
**Goal**: Farm team members open the portal and immediately see the data most relevant to their work, filtered to the modules they can access, in a layout designed for a phone screen
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User sees a dashboard page on their phone with data cards from their accessible modules
  2. User only sees module cards for modules their account has access to
  3. User can tap a quick-action on a dashboard card (e.g., mark task done) without navigating away
**Plans**: TBD

#### Phase 4: Field Data Entry
**Goal**: Farm crew can submit field observations from their phones in the field, including photos, and those submissions reach the office even when connectivity is spotty
**Depends on**: Phase 3
**Requirements**: FIELD-01, FIELD-02, FIELD-03
**Success Criteria** (what must be TRUE):
  1. User can submit a field observation with a text note from their phone
  2. User can attach a photo to a field observation before submitting
  3. Observations submitted while offline queue locally and sync automatically when connectivity returns
  4. User receives confirmation when a queued observation successfully syncs
**Plans**: 2 plans
Plans:
- [ ] 04-01-PLAN.md — Prisma model, API routes, and mobile form with photo capture
- [ ] 04-02-PLAN.md — IndexedDB offline queue with automatic sync on reconnect

---

## Progress

**Execution Order:**
v1.0 phases paused. v2.0 phases shipped.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Mobile Shell | v1.0 | 0/0 | Paused | - |
| 2. Offline Sync | v1.0 | 0/0 | Paused | - |
| 3. Mobile Dashboard | v1.0 | 0/0 | Paused | - |
| 4. Field Data Entry | 2/2 | Complete   | 2026-03-22 | - |
| 5. Privacy Foundation | v2.0 | 2/2 | Complete | 2026-03-21 |
| 6. Actuals Entry and Enterprise Budget View | v2.0 | 3/3 | Complete | 2026-03-21 |
| 6.1. Phase 6 Defect Fixes | v2.0 | 1/1 | Complete | 2026-03-21 |
| 7. All-Enterprise Sync | v2.0 | 2/2 | Complete | 2026-03-21 |
| 8. Farm-Wide Budget Summary | v2.0 | 2/2 | Complete | 2026-03-22 |

---

*v1.0 roadmap created: 2026-03-20*
*v2.0 roadmap created: 2026-03-20*
*v2.0 shipped: 2026-03-22*
