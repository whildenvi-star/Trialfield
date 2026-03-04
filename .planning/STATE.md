# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** Phase 19 IN PROGRESS — Seed & Input Inventory Redesign (farm-budget procurement pipeline).

## Current Position

Phase: 19-seed-input-inventory-redesign — IN PROGRESS
Plan: 2.5 of 3 complete (Plan 03 Tasks 1-2 done, stopped at Task 3 human-verify checkpoint)
Status: Phase 19 Plan 03 Tasks 1-2 shipped — Deliveries tab (form, list, search, order status auto-update) and 5 print reports (Agronomist, Field Plan, Forecast Summary, Order Status, Delivery Log). Awaiting human verification of complete procurement pipeline end-to-end.
Last activity: 2026-03-04 — Phase 19 Plan 03 Tasks 1-2 executed and committed

**v2.0 Grain Traceability:** Phases 9-13 ALL COMPLETE — v2.0 shipped
**Phase 14 (Chat Agent):** Plans 01-02-03 ALL COMPLETE — Phase 14 shipped
**Phase 15 (Foundation Fixes & Ecosystem Client Layer):** Plans 01-02 ALL COMPLETE — Phase 15 shipped
**Phase 16 (Field & Enterprise Compilation):** Plans 01-02 ALL COMPLETE — Phase 16 verified and shipped
**Phase 17 (Input & Seed Compilation + NOP):** Plans 01-02 ALL COMPLETE — Phase 17 shipped
**Phase 18 (Rotation + Harvest + PDF):** Plans 01-02-03 ALL COMPLETE — Phase 18 shipped
**v3.0 Organic Cert Transparency:** Phases 15-18 ALL COMPLETE — v3.0 shipped
**Phase 19 (Seed & Input Inventory Redesign):** Plans 01-02 COMPLETE — server foundation, Forecast Hub UI, Orders tab UI

## Performance Metrics

**Velocity:**
- Total plans completed: 39 (v1.0: 11, v1.1: 8, v2.0: 10, v3.0: 9+1chat)
- v2.0 plans completed: 10
- v3.0 plans completed: 9 (Phase 15 P01 + P02, Phase 16 P01 + P02, Phase 17 P01 + P02, Phase 18 P01 + P02 + P03)

**By Milestone:**

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-13 | 10 | 2026-03-02 |
| v3.0 | 15-18 | 9 | 2026-03-03 |

**Phase 12 metrics:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 12-settlement-import-manual-entry | 01 | 270s | 2 | 6 |
| 12-settlement-import-manual-entry | 02 | 327s | 2 | 5 |
| 13-reconciliation-engine-discrepancy-ui | 01 | 3min | 1 | 1 |
| Phase 13 P02 | 420 | 2 tasks | 5 files |
| 13-reconciliation-engine-discrepancy-ui | 03 | 5min | 2 | 2 |
| Phase 14-add-chat-agent-for-system-information-and-recall P01 | 285 | 2 tasks | 7 files |
| Phase 14-add-chat-agent-for-system-information-and-recall P02 | 410 | 2 tasks | 4 files |
| Phase 14-add-chat-agent-for-system-information-and-recall P03 | 10 | 2 tasks | 1 files |
| Phase 15-foundation-fixes-ecosystem-client-layer P01 | 302 | 2 tasks | 4 files |
| Phase 15-foundation-fixes-ecosystem-client-layer P02 | ~10 | 3 tasks | 11 files |
| Phase 16-field-enterprise-compilation P01 | 372 | 2 tasks | 10 files |
| Phase 16-field-enterprise-compilation P02 | 280 | 2 tasks | 2 files |
| Phase 17-input-seed-compilation-nop-compliance P01 | 354 | 2 tasks | 9 files |
| Phase 17-input-seed-compilation-nop-compliance P02 | 291 | 2 tasks | 4 files |
| Phase 18-rotation-snapshot-harvest-compilation-pdf P01 | 658 | 2 tasks | 7 files |
| Phase 18-rotation-snapshot-harvest-compilation-pdf P02 | 418 | 2 tasks | 4 files |
| Phase 18-rotation-snapshot-harvest-compilation-pdf P03 | 139 | 2 tasks | 5 files |
| Phase 19-seed-input-inventory-redesign P01 | 6 | 2 tasks | 8 files |
| Phase 19-seed-input-inventory-redesign P01 | 15 | 2 tasks | 10 files |
| Phase 19-seed-input-inventory-redesign P02 | 173 | 2 tasks | 2 files |
| Phase 19-seed-input-inventory-redesign P03 | 232 | 2 tasks | 3 files |

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
- [Phase 13-03]: All three verification wiring bugs were mechanical field-name corrections — no design choices required; gap closure executed exactly as written
- [Phase 14-add-chat-agent-for-system-information-and-recall]: claude-haiku-4-5-20251001 for Glomalin chat agent — cost-effective for high-frequency grain queries
- [Phase 14-add-chat-agent-for-system-information-and-recall]: Agent tools exclude all settlement/financial data — enforced at tool definition and system prompt level
- [Phase 14-add-chat-agent-for-system-information-and-recall]: flag_ticket uses [FLAGGED] notes prefix not matchStatus — keeps settlement reconciliation clean
- [Phase 14-add-chat-agent-for-system-information-and-recall]: CHAT_AGENT_ENABLED kill-switch: single env var disables all /api/agent/* routes via middleware
- [Phase 14-02]: Hand-rolled markdown renderer in glomalin.js — no library, bounded feature set sufficient for grain data responses
- [Phase 14-02]: Chart.js 4.x downloaded locally to chart.min.js — no CDN dependency for offline farm office use
- [Phase 14-02]: defer loading order for chart.min.js + glomalin.js — DOM position guarantees Chart.js available when widget renders chart blocks
- [Phase 14-02]: window._glomalinNav global for deep link navigation — avoids tight coupling to app module internals
- [Phase 15-foundation-fixes-ecosystem-client-layer]: Prisma baseline approach: migrate diff --from-empty generates init SQL, migrate resolve --applied marks it without touching DB
- [Phase 15-foundation-fixes-ecosystem-client-layer]: Partial unique index created as raw SQL in migration (Prisma schema.prisma does not support partial index syntax)
- [Phase 15-02]: organic-cert nested git repo: commits go into organic-cert/.git not project root — all ecosystem commits use cd organic-cert && git commit
- [Phase 15-02]: ecosystem client BUDGET_API_URL strips /api suffix — sync-macro uses base+/api but ecosystem client appends per-endpoint, avoiding double-path
- [Phase 16-01]: Manual migration + migrate resolve --applied reused for all organic-cert schema changes — Prisma drift from modified init migration blocks migrate dev; workaround is manual SQL + resolve (established pattern)
- [Phase 16-01]: PATCH /api/fields/[id] accepts only farmBudgetFieldName — other fields ignored for safety; dedicated endpoint for compile mapping, not a full field update
- [Phase 16-01]: getBudgetSettings() returns null on failure — compile engine degrades gracefully to current year for suggestedYear field
- [Phase 16-01]: Delivery matching uses ticket.farm case-insensitive vs local field name — unmatched ticket farms silently excluded (not NOP-relevant organic-cert fields)
- [Phase 16-01]: Readiness checks ORGANIC and TRANSITIONAL fields only — CONVENTIONAL and SPLIT excluded from NOP readiness tracking
- [Phase 16-02]: Prisma upsert label:null workaround — generated FieldEnterpriseFieldIdCropYearCropLabelCompoundUniqueInput requires label:string; cast prisma.fieldEnterprise as any to supply label:null; partial index handles DB uniqueness
- [Phase 16-02]: Partial commits via fieldIds array — POST accepts explicit fieldIds rather than "commit all matched" boolean; enables future per-field granular selection without API change
- [Phase 16-02]: Commit button disabled when summary.new + summary.update === 0 — prevents redundant no-op commits
- [Phase 17-01]: nopResolved flag added to Material: upsert update:{} means re-compile NEVER overwrites user-assigned NOP status
- [Phase 17-01]: seasonToDate(): Fall -> Oct 15 prior year, Spring -> Apr 1 crop year — noon UTC for timezone safety
- [Phase 17-01]: normalizeCropName() strips ORG/IRR/CONV prefixes; seed matching tries both space and underscore variants (Blue Corn vs Blue_Corn)
- [Phase 17-01]: Readiness dashboard replaced hardcoded pending with real SYNCED count queries using batch findMany+distinct to avoid N+1
- [Phase 17-02]: checkMaterialCompliance and checkSeedCompliance are pure functions — no Prisma imports, callable from client components without server boundary
- [Phase 17-02]: Compile All fetches inputs + seeds in parallel via Promise.all — single user action triggers both endpoints
- [Phase 17-02]: Save All re-runs handleCompileAll after successful batch-resolve — NOP badges refresh immediately without manual re-compile
- [Phase 17-02]: loadMaterials() fetches /api/materials without farmId filter — single-farm app, materials list serves both materialMap (OMRI) and unresolved panel
- [Phase 18-01]: snapshot-taker.ts groups FieldEnterprise by fieldId using Map; split fields produce concatenated crop string and notes detail
- [Phase 18-01]: Rotation snapshot lazy-loads on Fields page expand — avoids API call overhead for users who never open the section
- [Phase 18-02]: Harvest matching uses case-insensitive field name (field.name or farmBudgetFieldName) and normalizeCropName() — reuses Phase 17 normalizer
- [Phase 18-02]: handleCompileAll extended with harvest fetch (best-effort) — 503 sets unavailability message but does not fail Compile All for inputs/seeds
- [Phase 18-03]: CompileChecklist derived from already-fetched farm query data + 2 COUNT queries (fieldHistory, seedUsage) — avoids reloading large nested query just to check booleans
- [Phase 18-03]: Cover page compile checklist renders between crop year and generated date — data completeness visible above administrative timestamp
- [Phase 18-03]: field-list empty guard wraps entire table block (header + rows + summary) — prevents orphaned header rendering when fields array is empty
- [Phase 19-01]: Forecast endpoint is server-side (GET /api/forecast) — avoids re-implementing Calc.computeApplicationPrice client-side
- [Phase 19-01]: Deliveries use custom routes (not crudRoutes factory) to enable recalcOrderStatus() on every write
- [Phase 19-01]: Old Inputs Manager content moved to Reference tab — element IDs preserved, inputs-manager.js listener updated from 'inputs' to 'reference'
- [Phase 19-01]: Sun/moon Unicode glyphs (U+263C/U+263E) replace [day]/[night] text in theme toggle button
- [Phase 19-seed-input-inventory-redesign]: Deliveries use custom routes (not crudRoutes factory) to enable recalcOrderStatus() auto-transition on every write
- [Phase 19-seed-input-inventory-redesign]: Reference tab preserves all element IDs — old Inputs content moved intact, inputs-manager.js listener updated from 'inputs' to 'reference' only
- [Phase 19-seed-input-inventory-redesign]: calc.js rent uses full field acres (landlord obligation); inputs/seed/machinery use plantedAcres when set (crop cost allocation for partial-planted fields)
- [Phase 19-02]: Forecast reloads on every tab-activate (no loaded guard) — live procurement data must reflect latest delivery changes
- [Phase 19-02]: Create Order navigates to Orders tab via location.hash + manual tab-activate dispatch — no tight coupling to app.js internals
- [Phase 19-02]: Delivery cache keyed by orderId, invalidated on qty edit or forecast-changed event — prevents stale totals in expanded rows
- [Phase 19-03]: Popup-safe report pattern: synchronous window.open() in event handler, then write HTML after Promise.all resolves — avoids popup blocker without sacrificing data freshness
- [Phase 19-03]: pendingOrderId persists orderId across tab navigation (set before hash change, consumed on tab-activate) — handles race where Deliveries tab not active when start-delivery fires
- [Phase 19-03]: Delivery line items pre-fill with orderedQty by default (most deliveries are full shipments) — user adjusts down for partials

### Roadmap Evolution

- Phase 14 added: Add chat agent for system information and recall
- Phases 15-18 added: v3.0 Organic Cert Transparency (2026-03-02)
- Phase 19 added: Seed & Input Inventory Redesign (farm-budget)

### Pending Todos

5 pending todos in `.planning/todos/pending/`:
- Rework Seed & Input Inventory with forecasts, orders, and reports (farm-budget)
- Sync crop plan from macro rollup into FSA acres report (fsa-acres)
- Fix field registry acres and ownership save bug (farm-registry)
- Add field editor category totals and red negative profit (farm-budget)
- Work on grain ticket system enhancements (general)

### Blockers/Concerns

v2.0: COMPLETE (2026-03-02) — Phases 9-13 all shipped.
- CNH FieldOps staging API no audience registered — mock mode active in organic-cert. Not blocking v3.0.

v3.0:
- Phase 17 (NOP Compliance): NOP rule specifics for manure application windows, transition day counts, and buffer zone requirements should be verified against USDA NOP 7 CFR 205 before rule implementation. Research-phase recommended during Phase 17 planning.
- Phase 18 (Harvest Mapper): Crop name normalization table requires running both farm-budget and grain-tickets APIs and auditing actual crop name values — empirical task, not external research.
- Phase 18 (Prior-year history): FieldHistory table must have records for 2024 and 2025 for NOP 3-year history to be complete. Verify row counts before Phase 18 planning.
- Phase 18 (Harvest dependency): harvest-mapper.ts depends on grain-tickets Phase 11+ field linkage. If not complete, harvest compilation ships as a documented stub.

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed 19-seed-input-inventory-redesign Plan 02 — Forecast Hub and Orders tab UI shipped
Resume file: Phase 19 Plan 02 complete — Forecast Hub with category tables, Create Order flow, Orders tab with inline edit and delivery aggregation
Next action: Phase 19 Plan 03 (Deliveries tab UI and print reports) per roadmap
