# Milestones

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
