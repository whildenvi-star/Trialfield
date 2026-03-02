# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v2.0 Grain Traceability — Phase 10: Migration & Cutover

## Current Position

Phase: 10 of 13 (Migration & Cutover)
Plan: 1 of 2 in current phase (COMPLETE)
Status: Phase 10 plan 01 complete — JSON migrated to PostgreSQL; ready for Phase 10 plan 02 (server cutover)
Last activity: 2026-03-02 — Phase 10 plan 01 executed (migrate-json.js, 527 tickets + 63 farms + 37 crop configs migrated)

Progress: [█████████░░░░░░░░░░░] Phase 10 in progress (v1.0 + v1.1 shipped, Phase 9 done, Phase 10 plan 01 done)

## Performance Metrics

**Velocity:**
- Total plans completed: 21 (v1.0: 11, v1.1: 8, v2.0: 2)
- v2.0 plans completed: 2

**By Milestone:**

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-13 | TBD | - |
| Phase 10-migration-cutover P01 | 2 | 2 tasks | 2 files |

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
- [Phase 10-migration-cutover]: Noon UTC anchoring (T12:00:00.000Z) for date-only strings prevents timezone shift in all negative-offset zones
- [Phase 10-migration-cutover]: Migration script uses own PrismaClient (not singleton) — one-shot process outside server lifecycle
- [Phase 10-migration-cutover]: Data anomalies migrate as-is (warnings only, no rejection) per prior user decision — 527 tickets preserved intact

### Roadmap Evolution

- Phase 14 added: Add chat agent for system information and recall

### Pending Todos

4 pending todos:
- **Work on grain ticket system enhancements** (general)
- **Fix field registry acres and ownership save bug** (farm-registry)
- **Add field editor category totals and red negative profit** (farm-budget)
- **Sync crop plan from macro rollup into FSA acres report** (fsa-acres) ← NEW

### Blockers/Concerns

- **ACTIVE BLOCKER:** grain-tickets server.js will crash on startup — data.json is now archived and server still reads from flat file. Phase 10 plan 02 (server cutover to Prisma) must be completed before grain-tickets can serve requests.
- Phase 12 (Settlement Import): Actual settlement file samples from each Hughes Farm buyer needed before column mapping UI can be built. Collect from farm office staff before Phase 12 planning.
- Phase 13 (Reconciliation): Weight discrepancy thresholds and per-buyer shrink methods need farm manager input before Phase 13 design.
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert. Not blocking v2.0.

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 10-01-PLAN.md — JSON to PostgreSQL migration complete; grain-tickets server needs Phase 10 plan 02 cutover before it can start
Resume file: .planning/phases/10-migration-cutover/10-02-PLAN.md
