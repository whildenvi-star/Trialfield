# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v2.0 Grain Traceability — Phase 10: Migration & Cutover

## Current Position

Phase: 9 of 13 (Database Foundation)
Plan: 1 of 1 in current phase (COMPLETE)
Status: Phase 9 complete — ready for Phase 10
Last activity: 2026-03-02 — Phase 9 plan 01 executed (Prisma setup, schema, migration, lib/db.js)

Progress: [█████████░░░░░░░░░░░] 9 of 13 phases complete (v1.0 + v1.1 shipped, Phase 9 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 20 (v1.0: 11, v1.1: 8, v2.0: 1)
- v2.0 plans completed: 1

**By Milestone:**

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-13 | TBD | - |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1.0 decisions archived to milestones/v1.0-ROADMAP.md.
v1.1 decisions archived to milestones/v1.1-ROADMAP.md.

Recent decisions affecting v2.0:
- Keep Express for grain-tickets (not migrating to Next.js) — working PWA with solid UI
- Add Prisma 6.19.2 + PostgreSQL (match organic-cert exactly — no split ORM burden)
- Reconcile on net weight in pounds (not derived bushels — each buyer computes bushels differently)
- Write-lock cutover required during migration — 2-5 minute window, verify row counts

Phase 9 decisions (09-01):
- ticketNo uses @@index (non-unique) not @unique — 14 known duplicate ticket numbers in 527-ticket dataset
- hbtBinNo and truckId are first-class Ticket columns — extracted from notes in Phase 10 migration
- CropConfig has @@unique([cropYear, cropName]) — enables per-season config evolution
- Decimal type for SettlementLine.price/deductions/netPayment — financial precision required
- legacyId on Ticket and Farm preserves JSON string IDs for Phase 10 migration cross-referencing
- Prisma Studio on port 5556 — avoids conflict with organic-cert's Studio on 5555

### Roadmap Evolution

- Phase 14 added: Add chat agent for system information and recall

### Pending Todos

4 pending todos:
- **Work on grain ticket system enhancements** (general)
- **Fix field registry acres and ownership save bug** (farm-registry)
- **Add field editor category totals and red negative profit** (farm-budget)
- **Sync crop plan from macro rollup into FSA acres report** (fsa-acres) ← NEW

### Blockers/Concerns

- Phase 12 (Settlement Import): Actual settlement file samples from each Hughes Farm buyer needed before column mapping UI can be built. Collect from farm office staff before Phase 12 planning.
- Phase 13 (Reconciliation): Weight discrepancy thresholds and per-buyer shrink methods need farm manager input before Phase 13 design.
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert. Not blocking v2.0.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 09-01-PLAN.md — Phase 9 database foundation complete
Resume file: .planning/phases/10-migration/10-01-PLAN.md (when planned)
