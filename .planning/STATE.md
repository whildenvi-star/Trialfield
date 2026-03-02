# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v3.0 Organic Cert Transparency — Phase 15 (Foundation Fixes & Ecosystem Client Layer) ready to plan

## Current Position

Phase: 15 (not started)
Plan: —
Status: v3.0 roadmap created — Phase 15 is next
Last activity: 2026-03-02 — v3.0 roadmap written (phases 15-18, 20 requirements mapped)

**v2.0 Grain Traceability:** Phases 9-10 complete, Phases 11-13 planned (not started)
**v3.0 Organic Cert Transparency:** Phases 15-18 planned (not started)

## Performance Metrics

**Velocity:**
- Total plans completed: 22 (v1.0: 11, v1.1: 8, v2.0: 3)
- v2.0 plans completed: 3
- v3.0 plans completed: 0

**By Milestone:**

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-13 | TBD | - |
| v3.0 | 15-18 | TBD | - |

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
- [Phase 10-migration-cutover]: No farm summary caching — PostgreSQL fast enough for 527 tickets, eliminates cache invalidation complexity
- [Phase 10-migration-cutover]: dbFarmToJson maps Farm.name -> farm field for client backward compatibility without schema change

v3.0 architectural decisions:
- Leech pattern: organic-cert reads from farm-budget/farm-registry/grain-tickets, never writes back
- Zero new npm packages — all capability (native fetch, react/cache, Zod, Prisma upsert, @react-pdf/renderer) already installed
- Preview before commit: every compile operation shows a diff before any DB write — built into Phase 16 API contract, not retrofitted
- Ecosystem clients: AbortController 8-second timeout + Promise.allSettled — one unavailable source never blocks others
- Field identity mismatch: explicit mapping step in Phase 16 (not silent string comparison) — store confirmed farmBudgetFieldName on organic-cert Field row
- NOP compliance rules run against resolved materials only — unresolved materials show "needs review", not a compliance verdict
- Rotation snapshot is non-deferrable: must ship before farm-budget is rebuilt for next season (calendar-gated hard deadline)
- Harvest compilation may ship as a documented stub if grain-tickets Phase 11+ field linkage is not complete

### Roadmap Evolution

- Phase 14 added: Add chat agent for system information and recall
- Phases 15-18 added: v3.0 Organic Cert Transparency (2026-03-02)

### Pending Todos

4 pending todos:
- **Work on grain ticket system enhancements** (general)
- **Fix field registry acres and ownership save bug** (farm-registry)
- **Add field editor category totals and red negative profit** (farm-budget)
- **Sync crop plan from macro rollup into FSA acres report** (fsa-acres)

### Blockers/Concerns

v2.0:
- Phase 12 (Settlement Import): Actual settlement file samples from each Hughes Farm buyer needed before column mapping UI can be built. Collect from farm office staff before Phase 12 planning.
- Phase 13 (Reconciliation): Weight discrepancy thresholds and per-buyer shrink methods need farm manager input before Phase 13 design.
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert. Not blocking v2.0.

v3.0:
- Phase 17 (NOP Compliance): NOP rule specifics for manure application windows, transition day counts, and buffer zone requirements should be verified against USDA NOP 7 CFR 205 before rule implementation. Research-phase recommended during Phase 17 planning.
- Phase 18 (Harvest Mapper): Crop name normalization table requires running both farm-budget and grain-tickets APIs and auditing actual crop name values — empirical task, not external research.
- Phase 18 (Prior-year history): FieldHistory table must have records for 2024 and 2025 for NOP 3-year history to be complete. Verify row counts before Phase 18 planning.
- Phase 18 (Harvest dependency): harvest-mapper.ts depends on grain-tickets Phase 11+ field linkage. If not complete, harvest compilation ships as a documented stub.

## Session Continuity

Last session: 2026-03-02
Stopped at: v3.0 roadmap created — phases 15-18, 20 requirements mapped, files written
Resume file: .planning/ROADMAP.md
Next action: Run /gsd:plan-phase 15 to begin foundation fixes and ecosystem client layer
