# Roadmap: W. Hughes Farms — Operations Suite

## Milestones

| Milestone | Status | Phases |
|-----------|--------|--------|
| v1.0 — Mobile PWA | Paused | 1–4 (all phases paused; work not started) |
| v2.0 — Projected vs Actual Farm Budget | Active | 5–8 |

---

## v1.0 — Mobile PWA (Paused)

Phases 1–4 defined but not started. Paused in favor of v2.0 milestone. Phases preserved for future resumption.

### Phases (Paused)

- [ ] **Phase 1: Mobile Shell** - Navigable, touch-friendly mobile layout foundation (paused)
- [ ] **Phase 2: Offline Sync** - Hardened offline layer with visible sync status (paused)
- [ ] **Phase 3: Mobile Dashboard** - Phone-optimized dashboard with module-aware data (paused)
- [ ] **Phase 4: Field Data Entry** - Field observation submission with offline queue (paused)

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
**Plans**: TBD

---

## v2.0 — Projected vs Actual Farm Budget (Active)

**Goal:** Enable the office manager to record actuals against the farm manager's projected crop plan, while keeping financial performance data private to admin.

**Requirements:** 17 total (PRIV-01–04, ACT-01–05, VIEW-01–06, SYNC-01–02)

### Phases

**Phase Numbering:**
- Integer phases (5, 6, 7, 8): Planned v2.0 milestone work
- Decimal phases (5.1, 5.2): Urgent insertions between integers (marked INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 5: Privacy Foundation** - Role enforcement locked down before any role-filtered view is built (completed 2026-03-21)
- [x] **Phase 6: Actuals Entry and Enterprise Budget View** - OFFICE can record actuals; enterprise Budget tab shows projected/actual/variance (completed 2026-03-21)
- [x] **Phase 6.1: Phase 6 Defect Fixes** - Auth guard, seed variance unit fix, category alignment (INSERTED — gap closure) (completed 2026-03-21)
- [ ] **Phase 7: All-Enterprise Sync** - Conventional enterprises sync alongside organic; full farm operation in database
- [ ] **Phase 8: Farm-Wide Budget Summary** - ADMIN sees all enterprises for a crop year in one aggregated view

### Phase Details

#### Phase 5: Privacy Foundation
**Goal**: Financial performance data is invisible to OFFICE and CREW through every access vector — API response, browser DevTools, and UI — before any role-filtered feature is built
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: PRIV-01, PRIV-02, PRIV-03, PRIV-04
**Success Criteria** (what must be TRUE):
  1. An OFFICE-authenticated request to the budget-summary API returns cost and yield data but contains no revenue, margin, sale price, or profit fields — confirmed via curl or DevTools Network tab
  2. A request with no session cookie to any budget API route receives a 401 error, not ADMIN-level data
  3. Sandy (OFFICE) can log in and view the enterprise Budget tab without seeing rental rates, overhead, labor, sale prices, or profit/acre anywhere in the page — including page source
  4. New `budget:read` and `budget:financial` permissions exist in rbac.ts and are enforced on the budget-summary route
**Plans:** 2/2 plans complete
Plans:
- [ ] 05-01-PLAN.md — Auth foundation + RBAC permissions + API field stripping
- [ ] 05-02-PLAN.md — UI role-conditional rendering + end-to-end verification

#### Phase 6: Actuals Entry and Enterprise Budget View
**Goal**: Sandy can record invoice costs, field operation confirmations, and harvest yields against the projected plan; the enterprise Budget tab shows projected and actual values side by side with variance
**Depends on**: Phase 5
**Requirements**: ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, VIEW-01, VIEW-02, VIEW-03, VIEW-06
**Success Criteria** (what must be TRUE):
  1. Sandy can open an enterprise Budget tab and enter an actual material invoice cost — the entry saves immediately without a confirmation step
  2. Sandy can mark a planned field operation as completed with an actual date — the operation status changes to CONFIRMED
  3. Sandy can enter an actual harvest yield per acre for an enterprise
  4. Sandy can update a seed cost with the actual purchase price
  5. The enterprise Budget tab shows Projected, Actual, and Variance columns for each cost category; favorable variances display in green, unfavorable in red
  6. Each line item shows a badge indicating whether its value is projected (synced from farm-budget) or actual (entered by OFFICE)
  7. Financial columns (revenue projection, gross margin, profit/acre) are visible to ADMIN on the Budget tab and absent entirely for Sandy's session
**Plans:** 3/3 plans complete
Plans:
- [ ] 06-01-PLAN.md — BudgetTab extraction + schema migration + budget:write RBAC
- [ ] 06-02-PLAN.md — Budget-summary dual computation + actuals PATCH/POST API routes
- [ ] 06-03-PLAN.md — Dual-column Budget tab UI with inline editing + human verification

#### Phase 6.1: Phase 6 Defect Fixes (INSERTED — Gap Closure)
**Goal**: Fix high-severity defects discovered by milestone audit in completed Phase 6 work — auth guard, seed variance units, and category alignment
**Depends on**: Phase 6
**Requirements**: ACT-02 (re-verify), VIEW-01 (re-verify), VIEW-02 (re-verify)
**Gap Closure:** Closes integration and flow gaps from v2.0 audit
**Success Criteria** (what must be TRUE):
  1. `POST /api/import-plan/confirm` returns 401 for unauthenticated requests and 403 for users without `budget:write` — same pattern as all other Phase 6 write routes
  2. Seed rows on the enterprise Budget tab show actual cost per acre (not price per unit) in the Actual column — variance is meaningful and unit-consistent with the Projected column
  3. The unplanned-expense category dropdown contains exactly the categories accepted by the API — no silent failures when selecting any option
**Plans:** 1/1 plans complete
Plans:
- [x] 06.1-01-PLAN.md — Auth guard + seed formula fix + category alignment

#### Phase 7: All-Enterprise Sync
**Goal**: The farm-budget sync pulls in all enterprises — organic and conventional — so the full farm operation is represented in the database before the farm-wide view is built
**Depends on**: Phase 6
**Requirements**: SYNC-01, SYNC-02
**Success Criteria** (what must be TRUE):
  1. After running sync, conventional enterprises appear in the database alongside existing organic enterprises
  2. Existing organic enterprise data (including any actuals entered in Phase 6) is unchanged after the expanded sync completes
  3. No duplicate enterprises are created when a conventional and organic crop of the same type exist on the same field in the same crop year
**Plans:** 2 plans
Plans:
- [ ] 07-01-PLAN.md — Schema migration (EnterpriseType enum) + sync-macro all-enterprise expansion
- [ ] 07-02-PLAN.md — On-load sync trigger + stale indicator + human verification

#### Phase 8: Farm-Wide Budget Summary
**Goal**: ADMIN can view all enterprises for a crop year in a single aggregated page that mirrors the Macro Rollup layout, showing projected vs actual totals across the full farm operation
**Depends on**: Phase 7
**Requirements**: VIEW-04, VIEW-05
**Success Criteria** (what must be TRUE):
  1. ADMIN can navigate to a farm-wide budget summary page and see all enterprises for the current crop year listed with projected and actual totals
  2. The page layout and column structure mirrors the Macro Rollup layout Sandy already knows
  3. Financial columns (revenue, margin, profit) are visible to ADMIN on this page and absent for any OFFICE user who can access the page
**Plans**: TBD

---

## Progress

**Execution Order:**
v2.0 phases execute in numeric order: 5 → 6 → 6.1 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Privacy Foundation | 2/2 | Complete    | 2026-03-21 |
| 6. Actuals Entry and Enterprise Budget View | 3/3 | Complete    | 2026-03-21 |
| 6.1. Phase 6 Defect Fixes | 1/1 | Complete   | 2026-03-21 |
| 7. All-Enterprise Sync | 0/2 | Planned | - |
| 8. Farm-Wide Budget Summary | 0/TBD | Not started | - |

---

*v1.0 roadmap created: 2026-03-20*
*v2.0 roadmap created: 2026-03-20*
