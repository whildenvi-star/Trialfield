# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v2.0 Grain Traceability — Phase 12 complete (both plans shipped), Phase 13 (Reconciliation) next

## Current Position

Phase: 13-reconciliation-engine-discrepancy-ui
Plan: 1 of 2 complete
Status: Phase 13 Plan 01 complete — reconciliation matching engine + 5 API routes + ticket status enrichment shipped
Last activity: 2026-03-02 — Phase 13 Plan 01: normalizeTicketNo, runMatch, auto-match on commit, reconciliation API routes, _reconciliation on tickets

**v2.0 Grain Traceability:** Phases 9-12 complete, Phase 13 Plan 01 complete (Plan 02 next: discrepancy UI)
**v3.0 Organic Cert Transparency:** Phases 15-18 planned (not started)

## Performance Metrics

**Velocity:**
- Total plans completed: 26 (v1.0: 11, v1.1: 8, v2.0: 7)
- v2.0 plans completed: 7
- v3.0 plans completed: 0

**By Milestone:**

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-13 | TBD | - |
| v3.0 | 15-18 | TBD | - |

**Phase 12 metrics:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 12-settlement-import-manual-entry | 01 | 270s | 2 | 6 |
| 12-settlement-import-manual-entry | 02 | 327s | 2 | 5 |
| 13-reconciliation-engine-discrepancy-ui | 01 | 3min | 1 | 1 |
| Phase 13 P02 | 420 | 2 tasks | 5 files |

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

Phase 11 decisions (11-01):
- Grain bins are local to grain-tickets (not synced from farm-budget) — they represent on-farm storage, not external buyers
- Buyer proxy returns raw farm-budget JSON array OR {_source: 'unavailable', buyers: []} — client checks _source field for status message
- GET /api/destinations sorts bins first then buyers alphabetically — client handles display prefix labels
- Cache-Control: no-store on /api/tickets and /api/destinations to prevent stale filter results when switching destination filters
- shortCode patched directly in farm-budget/data/data.json since farm-budget uses file-backed store (restart picks up changes)

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
- [Phase 11-02]: Destination dropdown uses composite key (buyer:5 / bin:2) so client can distinguish type + id in one select value without hidden fields
- [Phase 11-02]: Sticky destination: save localStorage.lastDestination on submit success, restore after dropdown is populated in ref-data-loaded (survives form.reset())
- [Phase 11-02]: Farm summary buyer breakdown uses inline Destinations column text rather than collapsible rows — fits existing table layout
- [Phase 11-02]: Crop year filter populated client-side from allTickets after load — no dedicated /api/crop-years endpoint needed
- [Phase 12-01]: filePath String? added to Settlement via migration — clean parse-to-commit handoff that survives server restart without overloading Settlement.notes
- [Phase 12-01]: Two-step import (parse/commit) with multer diskStorage — file persists between requests for column mapping review before DB write
- [Phase 12-02]: null sourceFile + null filePath distinguishes manual settlements from file imports in the same Settlement table
- [Phase 12-02]: manualSettlementId module-level state persists active session for rapid multi-line entry without re-selecting buyer
- [Phase 12-02]: formatDate() uses UTC getters for timezone-safe YYYY-MM-DD display from ISO date strings
- [Phase 13-01]: normalizeTicketNo returns null for all-zero inputs (H000 → null) — prevents spurious matches on blank/placeholder ticket numbers
- [Phase 13-01]: runMatch scoped to buyerId+cropYear — never global; skips manual/disputed lines to preserve user flags
- [Phase 13-01]: runMatch called synchronously in commit endpoint — latency acceptable for 100-500 lines per settlement
- [Phase 13-01]: _reconciliation always present on ticket responses (status=unreconciled when no lines) — client never needs null check
- [Phase 13-01]: varianceLbs = farmLbs - buyerLbs (positive = farm weighed more = potential underpayment)
- [Phase 13-01]: dispute endpoint restricted to matched/manual/disputed lines — unmatched lines have nothing to dispute
- [Phase 13]: showSettlementToast uses dedicated #settlement-toast element separate from entry-toast to avoid z-index conflicts
- [Phase 13]: Inline dispute replaces cells in-place (no modal) per plan spec — textarea in notes cell, Save/Cancel in action cell

### Roadmap Evolution

- Phase 14 added: Add chat agent for system information and recall
- Phases 15-18 added: v3.0 Organic Cert Transparency (2026-03-02)

### Pending Todos

1 pending todo:
- **Phase 13 Plan 02 — Discrepancy UI** (grain-tickets) — reconciliation dashboard, unmatched loads view, dispute/link workflows

Completed this session (2026-03-02):
- ~~Sync crop plan from macro rollup into FSA acres report~~ → shipped: CLU land classification + crop sync from Macro Roll Up
- ~~Fix field registry acres and ownership save bug~~ → fixed: nonTillable no longer zeroed for rented/owned, ownedTillable deducts nonTillable
- ~~Add field editor category totals and red negative profit~~ → shipped: grid view groups by systemCode with subtotal columns, collapsed preview profit colored red/green
- ~~Work on grain ticket system enhancements~~ → identified as Phase 13 Plan 02 (above)

### Blockers/Concerns

v2.0:
- Phase 12 COMPLETE: Settlement import (Plan 01) + manual entry + detail view (Plan 02) shipped. Actual settlement file samples not yet collected but UI handles any column names generically.
- Phase 13 (Reconciliation): Weight discrepancy thresholds and per-buyer shrink methods need farm manager input before Phase 13 design.
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert. Not blocking v2.0.

v3.0:
- Phase 17 (NOP Compliance): NOP rule specifics for manure application windows, transition day counts, and buffer zone requirements should be verified against USDA NOP 7 CFR 205 before rule implementation. Research-phase recommended during Phase 17 planning.
- Phase 18 (Harvest Mapper): Crop name normalization table requires running both farm-budget and grain-tickets APIs and auditing actual crop name values — empirical task, not external research.
- Phase 18 (Prior-year history): FieldHistory table must have records for 2024 and 2025 for NOP 3-year history to be complete. Verify row counts before Phase 18 planning.
- Phase 18 (Harvest dependency): harvest-mapper.ts depends on grain-tickets Phase 11+ field linkage. If not complete, harvest compilation ships as a documented stub.

## Session Continuity

Last session: 2026-03-02
Stopped at: Pending todos cleared — registry save bug fixed, enterprise grid category subtotals added, field editor profit color fixed
Resume file: .planning/phases/13-reconciliation-engine-discrepancy-ui/13-01-SUMMARY.md
Next action: Phase 13 Plan 02 — Discrepancy UI (frontend for reconciliation routes)
