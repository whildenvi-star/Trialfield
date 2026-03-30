# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on.
**Current focus:** v11.0 Gap Closure — Phase 63: Crop Autocomplete Server Proxy

## Current Position

Phase: 63 of 63 (Crop Autocomplete Server Proxy) — COMPLETE
Plan: 1 of 1 complete
Status: Phase 63 complete — /api/registry/crops proxy route created, contract-drawer.tsx localhost URL removed. MKT-01 satisfied.
Last activity: 2026-03-30 — Phase 63 Plan 01 complete. Crop autocomplete now works on VPS via server-side proxy.

Progress: v9.0 [██████████] SHIPPED | v10.0 [██████████] SHIPPED | v11.0 [██████████] COMPLETE

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
| Phase 55 P01 | 2 | 2 tasks | 3 files |
| Phase 55 P02 | 2 | 2 tasks | 2 files |
| Phase 55 P03 | 5 | 1 task | 2 files |
| Phase 56 P01 | 2 | 2 tasks | 4 files |
| Phase 56 P02 | 5 | 2 tasks | 2 files |
| Phase 57 P01 | 2 | 2 tasks | 5 files |
| Phase 57 P02 | 4 | 2 tasks | 4 files |
| Phase 57 P03 | 65 | 2 tasks | 3 files |
| Phase 59 P02 | 2 | 2 tasks | 2 files |
| Phase 58-field-activity-timeline P01 | 184 | 3 tasks | 4 files |
| Phase 58-field-activity-timeline P02 | 313 | 2 tasks | 8 files |
| Phase 57.1-marketing-yield-summaries-production-fix P01 | 1 | 2 tasks | 1 files |
| Phase 60-settlement-financial-summary P01 | 12 | 1 tasks | 1 files |
| Phase 60-settlement-financial-summary P02 | 8 | 1 tasks | 2 files |
| Phase 61-auto-field-propagation P01 | 2 | 1 tasks | 1 files |
| Phase 61 P02 | 2 | 2 tasks | 3 files |
| Phase 62-portal-webhook-auth-fix P01 | 1 | 2 tasks | 3 files |
| Phase 63-crop-autocomplete-server-proxy P01 | 2 | 2 tasks | 2 files |
| Phase 63 P01 | 2 | 2 tasks | 2 files |

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
- [v11.0 roadmap]: Phase 60 depends on Phase 57 (grain contracts table) for contract vs actual price variance — settlement summary needs contract prices to compare against
- [v11.0 roadmap]: Phase 57 depends on Phase 52 (yield pipeline) for estimated production totals, not just Phase 50 — production baseline comes from grain-tickets yield compute
- [v11.0 roadmap]: PP-01/PP-02 requirement IDs replaced incorrect DOM-09/DOM-10 placeholder IDs throughout roadmap
- [v11.0 roadmap]: DASH, APH, MKT, FLD, PP, SET, AUTO requirement IDs are now correctly mapped in phase details — previous version used wrong DOM-XX and UXN-XX IDs
- [Phase 55]: Supabase group failures silently skip (no offline flag) — Supabase outages are rare vs Express apps that genuinely go down during dev
- [Phase 55]: Empty online groups excluded from action-items response — only groups with items or offline=true are returned
- [Phase 55]: SSR pre-fetch is Supabase-only — Express data loads client-side on mount, avoiding slow SSR for offline Express apps
- [Phase 55-03]: MODULE_SOURCES keys must match MODULES array ids exactly — 'fsa-578' not 'fsa', 'farm-budget' not 'budget'
- [Phase 56]: computeAphFromRecords uses simple average (not acre-weighted) — consistent with computeAphFromClus pattern in same file
- [Phase 56]: PATCH APH [id] sets updated_at server-side — client cannot set arbitrary timestamps
- [Phase 56]: DELETE APH [id] returns 404 when Supabase returns empty array — no match treated as not found
- [Phase 56]: AphPanel uses useCallback for fetchData — policyId change triggers refetch while onGuaranteeChange fires after every CRUD operation
- [Phase 57]: CBOT price endpoint returns manual-fallback when BARCHART_API_KEY not set — UI always works without an API key
- [Phase 57]: Commodity canonical names match Phase 50 registry: Yellow Corn, Soybeans, Soft Red Winter Wheat, Oats
- [Phase 57]: PATCH updated_at set server-side for grain_contracts — consistent with Phase 56 APH records precedent
- [Phase 57-02]: computePositions duplicated in page.tsx (SSR) and marketing-workspace.tsx (client) — avoids shared import across server/client boundary
- [Phase 57-02]: Array.from(positionMap) used for Map iteration to satisfy TypeScript downlevelIteration without tsconfig change
- [Phase 57-03]: yieldSummaries passed as prop from SSR page.tsx to client MarketingWorkspace — useState(initialYieldSummaries) ensures CRUD recompute uses real yield data
- [Phase 57-03]: marketing module placed after claims in MODULES array — follows native portal module grouping (fsa-578, insurance, claims, marketing, macro-rollup)
- [Phase 59]: PP_COVERAGE_FACTOR = 0.60 exported as named constant from insurance/calc.ts — RMA standard for most crops; single source for UI and future PDF
- [Phase 59]: PricingEntryForPp is a module-private interface in insurance/calc.ts — avoids cross-lib import while shape-compatible with PricingEntry from fsa/calc
- [Phase 59]: PP indemnity estimated client-side via inline IIFE in JSX — no additional state needed, recalculates reactively on every form change
- [Phase 59]: pricing prop added to PolicyDrawer (not fetched inside) — consistent with workspace-owns-data-fetching pattern
- [Phase 59-02]: PP cell uses inline IIFE in JSX — avoids extra state, matches Phase 59-01 PolicyDrawer pattern
- [Phase 59-02]: Conditional PDF page: ppPolicies.length > 0 gate wraps entire Page element — same pattern as hasPricing gate on Page 2
- [Phase 58-01]: Per-source endpoint always returns HTTP 200 with error field — graceful degradation pattern
- [Phase 58-01]: fetchFieldOpsActivities returns [] when no cert enterprise exists — avoids errors for non-organic fields
- [Phase 58-01]: SOURCE_PRIORITY sort order: cert > fieldops > budget > grain — confirmed operations sort before planned for same date
- [Phase 58-02]: field-timeline-client.tsx is separate from page.tsx — Suspense boundary required for useSearchParams() in Next.js 14 App Router
- [Phase 58-02]: pairedMap computed after all sources resolve (isAnyLoading=false) — budget+cert pairing requires both source sets present
- [Phase 58-02]: SOURCE_COLORS defined in timeline-workspace.tsx and exported — single source of truth for entry cards and filter chips
- [Phase 58-02]: TimelineExport receives already-filtered entries as props — no additional aggregated API call at export time
- [Phase 57.1]: fetchGrainService proxy is the single source of truth for grain-tickets base URL — never hardcode localhost:3007 in SSR page.tsx files
- [Phase 60-01]: avgPricePerBushel uses (netPayment + totalDeductions) / deliveredBushels — gross revenue before deductions divided by bushels gives true $/bu for contract comparison
- [Phase 60-01]: contractsAvailable boolean in settlement-summary response — UI can distinguish portal-down vs no-contracts-entered
- [Phase 60-01]: Matching contracts filtered to price_per_bushel != null before weighted avg — basis-only contracts excluded from contract reference price
- [Phase 60-02]: Settlement summary container placed before sub-nav at top of settlements tab — immediate scannable view without extra click
- [Phase 60-02]: Style block injected at init time via createElement — self-contained module, no separate CSS file needed
- [Phase 61-01]: propagateField uses EMBED_TOKEN query param for farm-budget and grain-tickets; portal webhook handles its own auth (Plan 02)
- [Phase 61-01]: In-memory propagationLog capped at 100 entries — no persistence needed, debug tool only
- [Phase 61-02]: farm-budget idempotency uses exact registryFieldId match — no name matching needed for fields
- [Phase 61-02]: grain-tickets name-match wiring upgrades existing farms to carry registryId before propagation existed
- [Phase 61-02]: CLU placeholder record uses farm_number=0, tract_number=0, clu=field_name — user fills in real FSA numbers via portal UI
- [Phase 62-01]: propagateField() portal target now appends tokenQuery — symmetric with farm-budget and grain-tickets
- [Phase 62-01]: PORTAL_URL and PORTAL_ORIGIN coexist in farm-registry/.env — CORS origin check vs fetch base URL are different code paths
- [Phase 63]: New route at /api/registry/crops (no -autocomplete suffix) — calls /api/crops/autocomplete with ?q= filtering; distinct from crops-autocomplete route used by CropTypeahead
- [Phase 63]: fetchRegistryService proxy pattern for client components: use portal-relative /api/registry/* routes instead of hardcoded localhost URLs

### Pending Todos

None active.

### Blockers/Concerns

None active. v11.0 roadmap complete. Ready to plan Phase 55.

## Session Continuity

Last session: 2026-03-30
Stopped at: Completed 63-01-PLAN.md — crop autocomplete server proxy, contract-drawer localhost URL removed
Resume file: —
Next action: Phase 63 complete — MKT-01 satisfied, all phases complete
