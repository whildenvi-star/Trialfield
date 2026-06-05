# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — Mobile PWA

**Shipped:** 2026-06-05
**Phases:** 5 | **Plans:** 15 | **Timeline:** 75 days non-contiguous (v2.0 built in the gap)

### What Was Built

- Mobile shell: MobileHeader + MobileBottomNav 4-tab bar with More overflow sheet — zero new dependencies
- All native module pages audited and fixed for 375px layout with 44px+ touch targets
- Offline sync layer: IDB v4 with conflicts store, useSyncStatus hook, SyncStatusBanner, ConflictDrawer — human-verified
- Role-gated mobile dashboard: CropPlanCard and FieldOpsCard with Mark Done quick-action, IDB-first loading
- Field observation submission with camera capture, 1200px JPEG resize, and offline-first queue with auto-drain
- OWL Orin corn detection pipeline: YOLOv8n training → TensorRT FP16 → stem avoidance buffer zones → frame quality gate

### What Worked

- **CSS-only dual shell pattern** — md:hidden / hidden md:block gives each viewport its own DOM subtree with zero runtime cost; no UA detection or conditional rendering needed
- **Queue-first IDB writes** — writing to IDB before attempting upload guaranteed no data loss across both offline sync and observation queues; the pattern is reusable for any future submission
- **Human verification checkpoints** — building explicit deploy + visual verification plans into the phase forced production testing rather than leaving it implicit
- **CustomEvent pub/sub for sync state** — decoupled useSyncStatus from all consumers cleanly; adding new sync-aware UI required zero changes to the hook
- **Researching before planning** — RESEARCH.md files prevented multiple foreseeable dead ends (IDB boolean index bug, Safari Private Mode crash, TensorRT precision tradeoff)

### What Was Inefficient

- **Phase 4 skipped production deploy plan** — field data entry completed without a 04-03 deploy/verify plan, leaving production verification undone; this was caught and deferred rather than caught and fixed
- **Non-sequential execution** — phases 4 and 5 done in March, then phases 1-3 resumed in May-June after v2.0 shipped; this created planning doc fragmentation and made the milestone timeline unintuitive (75 days but only ~3 weeks of active work)
- **Stale debug file not closed** — acres-budget-math-wrong.md from March 2026 was carried forward unresolved through v1.0 close; should have been acknowledged or marked resolved when v2.0 shipped
- **ROADMAP progress table had malformed rows** — milestone column and plan count columns were out of sync in several rows, required cleanup at milestone close

### Patterns Established

- **Human verification as a first-class plan** — plan N+1 in a phase is the production deploy + visual verification; this makes verification non-negotiable rather than an afterthought
- **IDB queue-first pattern** — IDB write before upload; direct-upload fallback for Safari Private Mode; purge-old on mount fire-and-forget; all three elements together constitute the complete pattern
- **CSS-only mobile/desktop split** — md:hidden / hidden md:block as dual DOM subtrees rather than responsive CSS on shared elements; use for entire page layout, not just individual components

### Key Lessons

1. **Non-sequential milestones need explicit milestone labels** — when phases are executed out of order, the progress table rows must carry the milestone column or they're ambiguous at close time
2. **Verification plans must be in scope at the start, not added when a gap is noticed** — phase 4 having no 04-03 deploy plan was a scope decision that should have been made explicitly, not discovered at close
3. **Debug files are planning state** — an investigating debug file is as much open work as an unfinished plan; close them or mark them deferred when the related milestone ships
4. **Zero-dependency components age better** — MobileHeader and MobileBottomNav built with inline SVGs and CSS transitions have no upgrade exposure; every new dependency is a future maintenance obligation

### Cost Observations

- Model mix: Not tracked per-session for this milestone
- Sessions: Phases executed across ~6 sessions (non-contiguous over 75 days)
- Notable: Phase 5 (OWL Orin) and Phase 4 (Field Data Entry) were both fully planned and executed in single sessions each — shorter phases with tight scope execute cleanly

---

## Milestone: v2.0 — Projected vs Actual Farm Budget

**Shipped:** 2026-03-22
**Phases:** 5 (including 6.1 inserted) | **Plans:** 10 | **Timeline:** 2 days

### What Was Built

- RBAC privacy foundation: API field stripping + UI silent omission — financial data invisible to non-ADMIN at every access vector
- Inline actuals entry for material costs, seed costs, field operations, and harvest yields with immediate save
- Dual-column budget view with projected + actual + variance and DataSource badges
- All-enterprise sync (organic + conventional) with EnterpriseType-aware upsert
- Farm-wide budget summary at `/budget-summary` aggregating all enterprises

### What Worked

- **Spread-conditional field stripping** — absent keys rather than null values means no trace of financial data in DevTools even for non-ADMIN requests; clean and defensible
- **Phase 6.1 insertion** — catching three defects post-execution and inserting a decimal phase for gap closure rather than leaving bugs in production was the right call
- **Milestone audit before close** — the v2.0 audit caught 4 non-blocking tech debt items that were formally recorded rather than forgotten

### What Was Inefficient

- **sync-macro endpoint left unguarded** — a medium-severity security gap carried forward from v2.0; should have been a 6.1 fix item

### Patterns Established

- **Decimal phase insertion** — Phase 6.1 pattern for urgent defect fixes after phase execution; avoids disrupting overall phase numbering

### Key Lessons

1. **API-level field stripping is defense-in-depth, not optional** — UI-level hiding alone is insufficient; spread-conditional omission at the API layer is the standard for sensitive data

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Plans | Active Days | Key Change |
|-----------|-------|-------------|------------|
| v2.0 | 10 | 2 | Establish baseline — decimal phase insertion for defects |
| v1.0 | 15 | ~21 active | Human verification as first-class plan; queue-first IDB pattern established |

### Top Lessons (Verified Across Milestones)

1. **Verification plans must be scheduled, not assumed** — both milestones showed that production verification only happens when it's an explicit plan in the phase scope
2. **Decimal phase insertion is the right tool for post-execution defects** — cleaner than reopening a phase, preserves audit trail
3. **Defense-in-depth on sensitive data** — API stripping + UI omission; neither alone is sufficient
