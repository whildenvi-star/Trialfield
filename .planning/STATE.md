# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** Planning v11.0 Domain Features & Workflow Automation

## Current Position

Phase: Between milestones — v9.0 + v10.0 shipped, v11.0 not yet started
Status: Ready for `/gsd:new-milestone`
Last activity: 2026-03-26 — v9.0 and v10.0 milestones archived. Phases 55-61 deferred to v11.0.

Progress: v9.0 [██████████] SHIPPED | v10.0 [██████████] SHIPPED | v11.0 [░░░░░░░░░░] planned

## Performance Metrics

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 | 1-4 | 11 | 2026-02-26 |
| v1.1 | 5-8 | 8 | 2026-03-01 |
| v2.0 | 9-14 | 13 | 2026-03-04 |
| v3.0 | 15-19 | 12 | 2026-03-04 |
| v4.0 | 20-23 | 7 | 2026-03-04 |
| v5.0 | 24-26 | 9 | 2026-03-05 |
| v6.0 | 27-34 | 15 | 2026-03-06 |
| v7.0 | 35-39 | 8 | 2026-03-08 |
| v8.0 | 40-43 | 9 | 2026-03-08 |
| v9.0 | 44-48 | 11 | 2026-03-26 |
| v10.0 | 49-54 | 20 | 2026-03-26 |
| **Total** | **54** | **115** | |
| Phase 49 P02 | 3 | 2 tasks | 4 files |
| Phase 49-canonical-field-ids P03 | 7 | 2 tasks | 9 files |
| Phase 50-canonical-crop-registry P01 | 2 | 2 tasks | 2 files |
| Phase 50-canonical-crop-registry P02 | 5 | 2 tasks | 6 files |
| Phase 50 P03 | 12 | 3 tasks | 14 files |
| Phase 51 P01 | 4 | 2 tasks | 4 files |
| Phase 51 P03 | 15 | 2 tasks | 4 files |
| Phase 51-fsa-insurance-data-consolidation P02 | 20 | 2 tasks | 5 files |
| Phase 46 P01 | 3 | 2 tasks | 6 files |
| Phase 46-field-pass-logger P02 | 4 | 1 task | 2 files |
| Phase 46-field-pass-logger P02 | 5 | 2 tasks | 2 files |
| Phase 52 P01 | 5 | 2 tasks | 3 files |
| Phase 46-field-pass-logger P03 | 3 | 1 tasks | 1 files |
| Phase 52 P02 | 16 | 2 tasks | 6 files |
| Phase 52 P03 | 5 | 1 tasks | 2 files |
| Phase 47 P01 | 4 | 2 tasks | 5 files |
| Phase 47 P02 | 6 | 2 tasks | 3 files |
| Phase 53 P01 | 6 | 2 tasks | 5 files |
| Phase 53 P02 | 7 | 2 tasks | 6 files |
| Phase 53 P03 | 8 | 2 tasks | 4 files |
| Phase 53 P04 | 3 | 2 tasks | 4 files |
| Phase 48 P02 | 25 | 2 tasks | 4 files |
| Phase 48-grain-tickets-pwa-dashboard-caching P01 | 5 | 2 tasks | 4 files |
| Phase 54 P02 | 15 | 2 tasks | 4 files |
| Phase 54 P01 | 18 | 2 tasks | 20 files |
| Phase 54 P04 | 5 | 2 tasks | 0 files |

## Accumulated Context

### Decisions

- [v10.0]: Pause v9.0 mobile work, do consolidation first — canonical field IDs and unified data make mobile work cleaner
- [v10.0]: All 42 requirements in scope (CONS, PIPE, UXN, DOM, AUTO) — full consolidation
- [v10.0]: Merged small related phases: PIPE-05..08 combined (53), UXN-04..09 combined (54) — 13 phases total
- [v9.0]: PWA approach (not native app) — @serwist/next, no app store
- [v10.0]: Phase 49 (canonical field IDs) is the dependency root — all cross-module joins depend on it
- [49-01]: Migration numbered 004 not 003 — 003-field-observations.sql already existed
- [49-01]: grain-tickets Farm.registryId is the existing canonical field ID linkage — no Prisma change needed
- [49-01]: fsa-acres uses Object.assign without allowlist — registryFieldId accepted implicitly, documented with comments
- [Phase 49-02]: Self-contained backfill scripts — normalize+alias matching logic duplicated across 4 scripts (not shared module) for independent runability
- [Phase 49-02]: grain-tickets backfill script reads .env manually (no dotenv dep) to load DATABASE_URL for Prisma
- [Phase 49-03]: grain-tickets had no registry sync — added POST /api/farms/sync-registry with ID-first/name-fallback pattern matching farm-budget
- [Phase 49-03]: portal CLU card registry selector uses select dropdown (not autocomplete) — 56 fields fit comfortably, simpler implementation
- [Phase 50-01]: Organic flag is boolean attribute on crop record (not baked into name) — "Yellow Corn" with organic=true, not "ORG Yellow Corn"
- [Phase 50-01]: Seed Beans and Natto Beans kept as separate records from Soybeans — fundamentally different markets, not just organic premium
- [Phase 50-01]: 38 crop records across 13 categories covering all platform crops; FSA land-use categories excluded
- [Phase 50-02]: farm-budget enterprises use cropTypeNames (category names), not individual crop strings — backfill targets fields[].crop and cropTypes[].subCrops[].name instead
- [Phase 50-02]: fsa-acres non-crop FSA categories (NC, idle, gls, MIXED FORAGE/HAY) flagged as expected-unmatched, not errors
- [Phase 50-02]: grain-tickets Ticket.registryCropId updated in bulk by crop name string match via updateMany
- [Phase Phase 50-03]: farm-budget crop dropdown is in field-editor.js not enterprise.js — both files modified to ensure registry references
- [Phase Phase 50-03]: FSA land-use categories (Idle/Fallow/CRP/Cover Crop) kept as FSA_LAND_USE_CATEGORIES local constant — not registry crops, merged at point of use
- [Phase 51-01]: GCS enrollments skipped in migration — program discontinued, not migrated to Supabase
- [Phase 51-01]: ins_482 flagged as potentially corrupt (no farm/crop, actual=40000)
- [Phase 51-01]: Claims skipped in migration — Phase 31 claims schema incompatible with legacy format
- [Phase 51-01]: data.json renamed to data.json.migrated after verified migration (read-only backup)
- [Phase 51-03]: Scraper scope from clu_records.crop — adapts to planted crops automatically
- [Phase 51-03]: manual_override pricing rows never overwritten by scraper
- [Phase 51-03]: Daily cron deferred — manual Refresh Prices button is the priority for CONS-03
- [Phase 51-02]: data/settings.json stores app settings locally (not in Supabase) — settings are app config not farm data
- [Phase 51-02]: Conservation practice fields mapped as individual Supabase columns — confirmed by migration script schema, no JSONB needed
- [Phase 51-02]: fsa-acres .gitignore created — node_modules must not be committed (Rule 2 auto-fix)
- [Phase 46]: resolveFieldEnterpriseId uses two cert calls (fields + enterprises) — acceptable for 56 fields, no caching needed
- [Phase 46]: crop-plans/[fieldId] graceful degradation — planned-only fallback when organic-cert unavailable to support offline mobile use
- [Phase 46-02]: Inline undo toast/bottom sheets with no external UI libs — consistent with Phase 45 pattern, inline CSS transitions
- [Phase 46-02]: Flush-before-start for pending confirmations — tap second pass while toast showing commits first immediately then starts new
- [Phase 46-02]: tokenRef stores auth token — useRef prevents stale closure in 5s setTimeout confirm callbacks
- [Phase 52-01]: Weight basis for yield is netWeight (net lbs after buyer deductions) — already on tickets, consistent across buyers
- [Phase 52-01]: Acre denominator for yieldPerAcre uses Farm.acres in grain-tickets; Plan 02 uses insurance planted_acres when pushing to portal
- [Phase 46-03]: Pre-existing TypeScript errors in enterprise-grid.tsx are out of scope (not caused by this change, different file)
- [Phase 52-02]: Crop-name matching used in farm-budget dashboard — cropRows aggregated by crop name with no registryCropId at render time
- [Phase 52-02]: GT badge uses CSS group-hover tooltip — enables formatted multi-line timestamp display
- [Phase 47]: SW uses raw IndexedDB API for Background Sync replay — idb library not available in SW bundle context
- [Phase 47]: Network errors (TypeError, AbortError) queued silently; HTTP errors re-thrown — only true offline failures are intercepted
- [Phase 47-02]: getLastSyncTimestamp reads from sync-config IDB store — same store used by setSyncToken, no schema change needed
- [Phase 47-02]: pending-sync detection uses fieldOperationId.startsWith('pending-') — set by confirmPass when offline, no separate tracking needed
- [Phase 47-02]: writeLastSyncTimestamp fires when synced > 0 OR skipped.length > 0 — conflicts count as sync activity
- [Phase 53-01]: seed-inventory is primary NOP compliance source for seed lots; farm-budget seed catalog is fallback only — eliminates double-entry
- [Phase 53-01]: organic-cert is a nested git repo — commits to organic-cert files must be made inside that directory
- [Phase 53-01]: SeedLot certNumber/lotNumber only overwritten on update when sourceApp=seed-inventory — preserves user edits from the UI
- [Phase 53]: gtUrl() helper defaults GRAIN_TICKETS_TOKEN to EMBED_TOKEN so no extra config needed in single-token setups
- [Phase 53]: Crop name mapping (hybrid barley -> barley, srww/hrw -> wheat) handled at sync time without canonical crop registry ID
- [Phase 53]: Manual override auto-set when user edits price cell — implicit lock, no extra UX step
- [Phase 53-03]: SeedCompliance rendered in landscape orientation — 9-column table fits at 8pt font; omriListed defaults false until compile pipeline populates it
- [Phase 53-04]: omriListed in SeedLot upsert create block for all sources; update block only for seed-inventory — same guard as certNumber/lotNumber to preserve user edits
- [Phase 48-01]: grain-tickets-v7 — cache name bumped; window.ticketQueue in app.js for cross-tab access; Background Sync _manualSync fallback; pending rows inline in tbody; edit modal reused for pending via data-pending flag
- [Phase 53-04]: uniqueSeeds Map type must explicitly carry omriListed field — Prisma client type checks upsert create/update shapes strictly, implicit fields cause TS2339
- [Phase 48-02]: Dashboard API route (/api/dashboard/summary) created so SW can cache a single cacheable JSON endpoint rather than intercepting Supabase SSR calls
- [Phase 48-02]: SW timestamp companion pattern: store {url}__timestamp alongside cached responses for staleness checks without a separate IDB store
- [Phase 48-01]: grain-tickets-v7 — cache name bumped; window.ticketQueue in app.js for cross-tab access; Background Sync _manualSync fallback; pending rows inline in tbody; edit modal reused for pending via data-pending flag
- [Phase 54-03]: postMessage uses '*' origin wildcard — cosmetic theme-only message, namespaced by type field, safe for dev/prod
- [Phase 54-02]: EmbedBreadcrumb uses fixed positioning (not sticky) to escape layout.tsx main wrapper — same escape mechanism as EmbedFrame
- [Phase 54-02]: --embed-breadcrumb-h: 36px CSS variable defined in globals.css :root — single source, referenced by breadcrumb height and EmbedFrame top calc
- [Phase 54-01]: CSS load order fixed in all 6 Express index.html files — platform-tokens.css was loading after style.css (Rule 3 auto-fix)
- [Phase 54-01]: platform-tokens.css is now single source of truth for all 16 platform color tokens across all 7 apps; style.css retains only app-specific non-color tokens

### Pending Todos

None active.

### Blockers/Concerns

- v9.0 phase 48 Plan 01 complete; Plan 02 (dashboard caching) remains before milestone is done
- Phase 51 (FSA/Insurance consolidation) is the riskiest — migrating live data between stores
- Phase 49 touches all 8 apps — backfill scripts need careful field name matching before writing IDs

## Session Continuity

Last session: 2026-03-26
Stopped at: Completed 54-02-PLAN.md — EmbedBreadcrumb component with persistent "Dashboard > Module" path and "Back to Dashboard" link above all portal iframe embeds.
Resume file: —
Next action: Phase 54 Plan 03 or next phase
Resume file: —
Next action: Phase 54 Plan 04 (next plan in iframe-embed-navigation-design-tokens phase)
