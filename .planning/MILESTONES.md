# Milestones

## v1.0 — Mobile PWA

**Shipped:** 2026-06-05
**Phases:** 1–5 | **Plans:** 15
**Portal code:** 42 files modified, +1,601 / -123 TypeScript/TSX
**OWL Orin code:** 15 files modified, +1,250 / -5 Python
**Planning commits:** 28
**Timeline:** 2026-03-22 → 2026-06-05 (75 days, non-contiguous — v2.0 built in the gap)
**Requirements:** UX-01/02, MSYNC-01/02, DASH-01/02/03, FIELD-01/02/03, CORN-01–07 — all delivered
**Known deferred items at close:** 1 (see STATE.md Deferred Items — acres-budget-math-wrong, v2.0 budget concern, unrelated to v1.0)

**Delivered:** Farm team members can open portal.whughesfarms.com on a phone and navigate with a bottom tab bar, work offline with visible sync status and conflict resolution, submit field observations with photos from the field, and see a role-gated mobile dashboard with quick-actions; OWL Orin gains a corn-specialized weed detector with stem avoidance buffer zones and frame quality gating.

**Key Accomplishments:**
1. MobileHeader + MobileBottomNav with 4-tab bar and More overflow sheet — zero new dependencies, live on portal
2. All native module pages audited for 375px single-column layout with 44px+ touch targets — human-verified
3. Offline sync layer with conflict detection, ConflictDrawer, and queue count badge — human-verified on mobile
4. Phone-optimized dashboard with module-gated CropPlanCard and FieldOpsCard with Mark Done quick-actions — human-verified
5. Field observation form with photo capture (1200px JPEG resize) and offline-first IDB queue with sync-on-reconnect
6. YOLOv8n corn detection pipeline for OWL Orin: training → TensorRT FP16 → stem avoidance → frame quality gating

**Tech Debt Carried Forward:**
- sync-macro endpoint unguarded (medium)
- Sidebar budget-summary link visible to CREW (low)
- Phase 4 field observations: no production deploy/verification plan
- ConflictDrawer resolution local-only — no server reconciliation

**Archive:** [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

---

## v2.0 — Projected vs Actual Farm Budget

**Shipped:** 2026-03-22
**Phases:** 5–8 (including 6.1 inserted) | **Plans:** 10 | **Code commits:** 12
**Files modified:** 19 | **Lines:** +3,492 / -273
**Timeline:** 2 days (2026-03-20 → 2026-03-22)
**Requirements:** 17/17 satisfied (PRIV-01–04, ACT-01–05, VIEW-01–06, SYNC-01–02)
**Audit:** Passed with tech_debt status (4 non-blocking items)

**Delivered:** OFFICE role can record actual costs, field operations, and harvest yields against the farm manager's projected crop plan; ADMIN sees projected vs actual across all enterprises in a farm-wide summary; financial data is invisible to non-ADMIN through every access vector.

**Key Accomplishments:**
1. RBAC privacy foundation with API field stripping and UI silent omission — financial data invisible to non-ADMIN
2. Inline actuals entry for material costs, seed costs, field operations, and harvest yields with immediate save
3. Dual-column budget view with projected + actual + variance and DataSource badges
4. All-enterprise sync (organic + conventional) with type-aware upsert preserving existing data
5. Farm-wide budget summary aggregating all enterprises, mirroring Macro Rollup layout
6. Phase 6.1 inserted to fix auth guard, seed formula, and category alignment defects

**Tech Debt Carried Forward:**
- sync-macro endpoint unguarded (medium)
- Sidebar budget-summary link visible to CREW (low)
- Seed ActualCell label mismatch (cosmetic)
- SUMMARY frontmatter missing requirements-completed (documentation)

**Archive:** [v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) | [v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md) | [v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md)

---
*Last updated: 2026-03-22*
