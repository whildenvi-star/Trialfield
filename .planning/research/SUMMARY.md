# Project Research Summary

**Project:** Glomalin Portal — v6.0 FSA Acres, Insurance & Claims
**Domain:** Government farm program compliance tooling — FSA-578 planting workflow, crop insurance decision tool, claims lifecycle tracker
**Researched:** 2026-03-04
**Confidence:** HIGH

## Executive Summary

v6.0 is a workflow UX upgrade, not a data model redesign. The existing fsa-acres Express app (port 3002) already contains the correct data model, calculation engine, and business logic. All three target features — FSA-578 planting workflow, crop insurance decision tool, and claims tracking — are built on data that already exists in `fsa-acres/data/data.json`. The migration-first principle is the single most important architectural decision: the fsa-acres JSON data must be imported into Supabase before any portal UI is built, or operational data will split across two systems with no reconciliation path.

The recommended approach is a linear three-module build inside the existing glomalin-portal (Next.js 14 + Supabase), delivered in strict dependency order: FSA data foundation first (CLU records are the anchor that insurance policies reference for FSA acres), insurance module second (policies must exist before claims have meaning via FK), and claims module third. Each module follows the established portal pattern — React Server Component shell with client feature islands, all data mutations through API route handlers, Express app data proxied through Next.js with timeout and graceful fallback. The payout simulator is the one exception where client-side calculation is required: the RP/YP/RP-HPE indemnity formulas must run in the browser for sub-100ms slider feedback.

Three risks dominate this build. First, the fsa-acres data migration must happen before the UI, not after — the skip-and-add-later pattern never works in practice and leaves users re-entering 2026 data that already exists. Second, claims document uploads must bypass Next.js Server Actions entirely (1MB hard limit breaks most real adjuster PDFs) using a signed URL pattern direct to Supabase Storage. Third, the insurance simulator must be scoped explicitly as a "decision support" tool, not a premium calculator — wrong SCO/ECO formulas using farm APH instead of county yields produce plausible-looking but incorrect numbers that create liability exposure.

---

## Key Findings

### Recommended Stack

The glomalin-portal scaffold (Next.js 14.2.35, Supabase, Tailwind, React Flow) requires 8 new packages for v6.0 features. shadcn/ui is the foundation — install first since it provides Card, Badge, Checkbox, Select, Slider, Dialog, and Popover used across all three modules. The remaining packages are feature-specific with no overlap or conflict.

Full version compatibility notes, installation commands, and alternatives considered in `.planning/research/STACK.md`.

**Core technologies (new installs only):**
- `shadcn/ui` (CLI): Component library — generates owned source code, Tailwind-styled, already proven in organic-cert; install before all others
- `recharts ^3.4.1`: Line/bar/area charts for insurance performance history — 13.8M weekly downloads, simple `"use client"` wrapper pattern for Next.js 14
- `@nivo/heatmap ^0.99.0`: Coverage level comparison matrix — the only React-native true color-scaled matrix without D3 overhead; install standalone package only (not full Nivo meta-package)
- `@dnd-kit/core ^6.3.1` + `@dnd-kit/sortable ^10.0.0` + `@dnd-kit/utilities ^3.2.2`: Claims Kanban drag-and-drop — only actively maintained React DnD library in 2025; react-beautiful-dnd is deprecated (GitHub archived August 2025)
- `framer-motion ^12.x`: Card entrance animations and Kanban column transitions — scope to micro-interactions only; do NOT use AnimatePresence for route transitions (known App Router incompatibility)
- `react-dropzone ^14.2.3`: Claims document upload zone — pairs directly with Supabase Storage `.upload()` API
- `@react-pdf/renderer ^4.3.2`: FSA acreage summary export — already proven in organic-cert for government-form-adjacent layouts; install fresh in glomalin-portal
- `date-fns ^4.1.0`: Deadline calculations and urgency badge logic — already in organic-cert; install fresh in glomalin-portal for monorepo consistency

**Critical version notes:** dnd-kit requires `dynamic({ ssr: false })` wrapper in Next.js App Router. Recharts and @nivo/heatmap require `"use client"` directive. @react-pdf/renderer runs server-side only in Route Handlers.

### Expected Features

The three modules share a clear MVP boundary. Feature tables with complexity ratings and dependency graph in `.planning/research/FEATURES.md`.

**Must have (P1 — v6.0 core):**
- Supabase schema migration from fsa-acres data.json — foundation for everything else
- Card-based CLU list grouped by Farm/Tract with inline crop, practice, planting date editing
- Validation warnings panel (port existing `validateRecords()` from fsa-acres calc.js)
- Bulk mark-as-reported with farm-level filter
- Print-ready FSA acreage summary export (labeled "summary" — NOT an FSA-578 replica)
- Farm-budget crop auto-population (port existing FSA sync from v4.0)
- Insurance policy CRUD with slide-out editor
- Coverage-level comparison matrix (RP/RP-HPE/YP across 65%–85% coverage levels)
- Interactive payout scenario simulator with yield/price sliders
- APH auto-detect from CLU records + grain ticket yield bridge for actual yield
- Potential claim auto-detection when actual yield < effective guarantee
- Claims Kanban board with 6 pipeline stages
- Claim detail view with timeline log and deadline alerts

**Should have (P2 — add after core validated):**
- Year-over-year CLU comparison (requires cropYear per-record, multi-year schema)
- Crop assignment templates for common rotation patterns
- Historical insurance performance dashboard (multi-year premium vs. indemnity)
- Bulk grain ticket sync across all insurance policies
- USDA RMA projected price auto-fetch
- Stage-specific document checklist per claim

**Defer to v7+:**
- SCO/ECO layer visualization (requires county-level yield data not in farm systems)
- Consolidated deadline calendar (FSA + insurance + claims combined)
- CNH FieldOps as-planted date auto-fill (blocked on FieldOps API access)
- GIS/map CLU boundaries (USDA CLU spatial data restricted)
- Direct FSA eAuth electronic submission (requires USDA partnership agreement)
- Automated insurance premium quotes (requires AIP agreements — no public API)

**Anti-features (never build):**
- Pixel-perfect FSA-578 government form replica (react-pdf flexbox cannot achieve it; farm manager brings data to FSA office, FSA generates the form)
- Live CME futures integration (confuses live futures with USDA RMA monthly average prices)
- Auto-file insurance claims without producer review (liability exposure)

### Architecture Approach

Three separate modules (`fsa-578`, `insurance`, `claims`) registered in `lib/modules.ts`, each independently RBAC-gated via the existing middleware. All follow the Server Component shell + client feature islands pattern established in v5.0. Express app reads proxy through Next.js API routes with 60-second TTL cache and `AbortSignal.timeout(5000)` — never from browser code. The `_computed` fields on fsa-acres insurance policies are server-derived ephemeral values that must not be copied to Supabase; recalculate via `lib/insurance/calc.ts` (TypeScript port of `computeInsurancePolicy()`).

Full file tree, SQL schemas, data flow diagrams, and anti-patterns in `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. `lib/fsa/calc.ts` — TypeScript port of calc.js rollup/validation engine; runs server-side for dashboard summary cards
2. `lib/insurance/calc.ts` — TypeScript port of `computeInsurancePolicy()`; runs client-side in payout simulator for sub-100ms feedback
3. `app/api/fsa/`, `app/api/insurance/`, `app/api/claims/` — Route handlers for all mutations and Express proxy calls with TTL cache + graceful fallback
4. `components/fsa/`, `components/insurance/`, `components/claims/` — Domain-grouped UI components; no cross-domain dependencies
5. Supabase tables: `clu_records`, `insurance_policies`, `insurance_pricing`, `claims`, `claim_documents`, `claim_timeline`, `gcs_enrollments`
6. Supabase Storage bucket `claim-documents` — private; all access via signed read URLs (1-hour expiry)

**Non-negotiable patterns:**
- Three modules as separate RBAC-gated routes — NOT one tab-based fsa-reporting page (cannot independently grant/revoke access per sub-feature if combined)
- Import script runs before any portal UI — `fsa-acres/data/data.json` → Supabase, verified by record count match
- `Promise.allSettled()` for all parallel Express app fetches — never `Promise.all()`
- `{ next: { revalidate: 0 } }` on all cross-app fetch calls — Next.js App Router caches fetch responses by default and will serve stale data otherwise

### Critical Pitfalls

Full pitfall catalog with warning signs, recovery strategies, and "looks done but isn't" verification checklist in `.planning/research/PITFALLS.md`.

1. **Drag-and-drop SSR hydration mismatch** — Wrap ClaimsKanban in `dynamic(() => import('./ClaimsKanban'), { ssr: false })` from the first card rendered. `'use client'` alone does NOT disable SSR in App Router. Confirmed in dnd-kit GitHub issue #285.

2. **fsa-acres data never migrated** — Build the `fsa-acres/data/data.json` → Supabase import script as the first task in Phase 1, before any UI. Verify by record count match. The portal must not launch with an empty Supabase while real 2026 data lives in the Express app.

3. **Server Actions 1MB file upload limit** — Claims documents (adjuster reports, field photos, settlement letters) exceed 1MB routinely. Use signed upload URL pattern: server generates URL via admin client → client uploads direct to Supabase Storage → client posts metadata to route handler. Never route file bytes through a Server Action. Confirmed in Next.js GitHub Discussion #57973.

4. **Supabase Storage RLS rejects signed upload URLs** — The `claim-documents` bucket INSERT RLS policy runs at upload time, not URL-generation time. Test the full upload cycle (URL generation → client PUT → metadata record) in the first document upload plan before assuming presigned URLs bypass RLS. Confirmed in Supabase storage-js GitHub issue #186.

5. **Insurance calculation scope liability** — The payout simulator is a decision support tool, not a premium calculator. SCO/ECO requires county-level yield data that is not in farm systems. Ship only RP, RP-HPE, and YP for v6.0. Apply disclaimer "Illustrative only — not a premium calculator" to every simulator output. Wrong numbers create real user liability.

6. **Next.js fetch cache stales cross-app data** — App Router caches `fetch()` by default. Add `{ next: { revalidate: 0 } }` or `cache: 'no-store'` to every cross-app fetch. Without this, CLU edits in fsa-acres Express will not appear in the portal until cache expires.

7. **FSA-578 PDF scope mismatch** — Do not attempt to replicate the government form pixel-for-pixel. Build a "FSA Acreage Reporting Summary" (all required data in clean tabular format, labeled explicitly as a summary). This eliminates the react-pdf fixed-positioning problem entirely and is more useful to the farmer.

---

## Implications for Roadmap

Architecture research defines a strict 7-phase build order driven by FK dependencies. Phases 1, 3, and 5 are database+API work; Phases 2, 4, and 6 are the corresponding UI phases; Phase 7 is cross-module integration. Do not build UI before the backing data is in Supabase.

### Phase 1: FSA Data Foundation + Migration

**Rationale:** `clu_records` is the anchor table. Insurance policies reference it for FSA acres auto-computation via APH lookup. The import script must run and be verified before any UI is built — this prevents the split-data-store failure mode that is unrecoverable in practice.

**Delivers:** Supabase schema for `clu_records`, `insurance_pricing`, `gcs_enrollments`; one-shot import script from `fsa-acres/data/data.json`; TypeScript port of calc.js rollup/validation engine into `lib/fsa/calc.ts`; Express proxy route handlers for farm-registry and farm-budget with timeout + cache; `fsa-578` registered in `lib/modules.ts`

**Addresses features:** Supabase schema migration (P1 prerequisite), year-scoped CLU data, auto-populate-from-farm-budget groundwork

**Avoids:** fsa-acres data split (Pitfall 9 in PITFALLS.md), Next.js fetch cache staling cross-app data, cross-app timeout hangs

**Research flag:** Standard patterns — direct port of known Express code to TypeScript. No research-phase needed.

---

### Phase 2: FSA Planting Workflow UI

**Rationale:** UI follows verified data foundation. Replaces the "Coming Soon" placeholder with the full CLU card workflow. All data mutations have route handlers from Phase 1 to call.

**Delivers:** `CluCardGrid`, `CluEditorDrawer`, `BulkActionBar`, `FsaDashboardMetrics`, budget sync preview UI, FSA acreage summary PDF export via `@react-pdf/renderer`

**Addresses features:** Card-based CLU workflow (P1), inline editing, bulk mark-as-reported, validation warnings panel, print-ready export, farm-budget crop sync

**Avoids:** FSA-578 government form replica scope (label output "Acreage Reporting Summary"), bulk action without confirmation dialog, tablet layout failure (test on 1024×768 before marking complete)

**Research flag:** Established shadcn/ui + react-pdf patterns. No research-phase needed.

---

### Phase 3: Insurance Tables + Calculation Engine

**Rationale:** Insurance policies must exist in Supabase before the simulator UI is built. The calculation accuracy scope (simulator vs. premium calculator) must be defined before any formula is written — this is a liability decision, not a coding decision.

**Delivers:** `insurance_policies` Supabase table; migration from `fsa-acres/data/data.json` `insurancePolicies[]`; `lib/insurance/calc.ts` TypeScript port of `computeInsurancePolicy()`; route handlers for policies, pricing, USDA RMA price scrape, grain-ticket yield bridge; `insurance` registered in `lib/modules.ts`

**Addresses features:** Insurance policy CRUD foundation, APH auto-detect from CLU records, potential claim detection groundwork

**Avoids:** Insurance calculation liability scope (Pitfall 5 — define simulator-not-calculator before any formula is written), `_computed` fields copied from Express (recalculate via lib/insurance/calc.ts instead)

**Research flag:** Verify RP formula against ISU Extension FM-1849 before implementing `lib/insurance/calc.ts`. The "higher of spring or harvest price" distinction between RP and RP-HPE is subtle and a wrong implementation produces plausible-looking incorrect numbers. One-hour verification task — not a full research phase.

---

### Phase 4: Insurance Decision Tool UI

**Rationale:** The coverage comparison matrix and payout simulator are the highest-value differentiators in v6.0 — they are worth nothing without the Phase 3 data foundation. The coverage matrix must use CSS grid/table cells (not SVG) from the start; retrofitting the approach after SVG performance problems appear is expensive.

**Delivers:** `PolicyCard`, `PolicyEditorDrawer`, `CoverageMatrix` (CSS grid — NOT SVG or chart library), `PayoutSimulator` (client-side sliders via `lib/insurance/calc.ts`), `PerformanceSummary` aggregate, `ClaimStatusStepper`, bulk grain ticket sync, RMA price fetch

**Addresses features:** Coverage-level comparison matrix (P1 differentiator), payout scenario simulator (P1 differentiator), grain ticket yield bridge, premium schedule, potential claim detection alert

**Avoids:** SVG heat map performance degradation (Pitfall 8 — CSS grid cells render instantly for 300+ cells), insurance scope creep (disclaimer required on all simulator outputs), installing full Nivo meta-package when only `@nivo/heatmap` is needed

**Research flag:** No — CSS grid matrix is simpler than any chart library; calc formulas are known and verified in Phase 3.

---

### Phase 5: Claims Tables + API

**Rationale:** `claims.policy_id` is a FK to `insurance_policies`. Building claims before insurance would require retrofitting real FK relationships. The document upload RLS behavior in this specific Supabase project must be tested before the upload UI is built.

**Delivers:** `claims`, `claim_documents`, `claim_timeline` Supabase tables; Supabase Storage bucket `claim-documents` (private, RLS configured); all claims route handlers (CRUD, documents, timeline); `claims` registered in `lib/modules.ts`

**Addresses features:** Claims lifecycle data foundation, document storage metadata, append-only audit trail

**Avoids:** Server Actions 1MB limit (Pitfall 2 — signed URL pattern from the start, never file bytes through Server Actions), Supabase Storage RLS on signed URLs (Pitfall 3 — test full upload cycle before UI phase), claims documents in a public bucket (security mistake)

**Research flag:** Spike the signed upload URL + RLS behavior before Phase 6. Test the full cycle (URL generation → client PUT → metadata record insert) with this project's Supabase configuration. Two-hour spike, not a full research phase.

---

### Phase 6: Claims Lifecycle UI

**Rationale:** UI follows the data foundation. The Kanban board is the most interactive component in the entire v6.0 build — the SSR hydration fix must be the default pattern from the first card, not added as a fix after hydration errors appear in production.

**Delivers:** `ClaimsKanban` (wrapped in `dynamic({ ssr: false })` from the start), `ClaimCard`, `ClaimDetail`, `DocumentUpload`, `DeadlineAlertBanner`, document list with signed read URLs, claims analytics summary cards

**Addresses features:** Claims Kanban board (P1), claim detail + timeline log, deadline alerts with urgency badges, document checklist, claims portfolio summary

**Avoids:** DnD SSR hydration mismatch (Pitfall 1 — `dynamic({ ssr: false })` is the default, not a retrofit), Kanban re-render on every drag event (React.memo on static card content), claims documents in a public bucket

**Research flag:** No — dnd-kit multi-container Kanban is the library's primary documented use case. Standard patterns.

---

### Phase 7: Cross-Module Integration + Dashboard Summary Cards

**Rationale:** Integration features require both source and target modules to be fully functional with real data. Building them earlier creates circular dependencies and requires mock data that obscures real integration failures.

**Delivers:** 3 new portal dashboard cards (FSA reporting progress, Insurance status, Claims pipeline summary), FSA CLU → Insurance policy click-through, Insurance policy → create claim shortcut, FSA prevented planting status → claims cross-trigger prompt, shared validation warnings across modules

**Addresses features:** FSA-to-insurance-to-claims integration flow, cross-module cohesion, prevented planting → claims automation

**Avoids:** One-giant-fsa-reporting-module anti-pattern (three modules remain independently RBAC-gated), write-back to Express apps (Supabase is the source of truth, fsa-acres Express becomes read-only reference)

**Research flag:** No — cross-module linking is internal portal navigation with Supabase FK lookups. No new technology.

---

### Phase Ordering Rationale

- **Dependency chain is a database constraint, not a preference.** `clu_records` must exist before `insurance_policies` (APH auto-compute FK lookup). `insurance_policies` must exist before `claims` (policy_id FK). This order cannot be changed.
- **Data phases before UI phases.** Each data+API phase (1, 3, 5) must produce a verified record count before the corresponding UI phase (2, 4, 6) begins. This prevents the "portal launches empty" failure mode and ensures route handlers exist before components try to call them.
- **Three separate modules, not one tab page.** The existing middleware `isModuleRoute()` already handles any `/app/{slug}` path. Three separate module IDs (`fsa-578`, `insurance`, `claims`) enable independent RBAC grants — a farm bookkeeper can be given claims access without insurance access.
- **Migration before UI is a hard rule.** The fsa-acres Express app has real 2026 operational data. If the portal launches before the import script runs, users have two live data stores with no merge path.

### Research Flags

Phases likely needing deeper investigation during planning:

- **Phase 3 (Insurance Calculation Engine):** Verify the RP vs. RP-HPE formula before writing `lib/insurance/calc.ts`. The distinction ("higher of spring or harvest price" for RP vs. spring price only for RP-HPE) is subtle. Wrong formulas produce liability exposure. One-hour verification task against ISU Extension FM-1849.
- **Phase 5 (Claims Document Upload):** Spike the Supabase Storage signed upload URL + RLS behavior in this project's specific Supabase instance before the upload UI is built. The service_role vs. anon key upload path behavior differs and is project-configuration-dependent.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Direct TypeScript port of known Express code. AbortController timeout, Promise.allSettled, Supabase SQL migrations are standard.
- **Phase 2:** shadcn/ui components + @react-pdf/renderer for tabular export. Organic-cert has existing precedent for both.
- **Phase 4:** CSS grid coverage matrix is simpler than any SVG chart library. Client-side calc with useState is standard React.
- **Phase 6:** dnd-kit multi-container Kanban is the library's primary documented use case with extensive examples.
- **Phase 7:** Internal navigation + Supabase FK lookups. No new technology introduced.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against npm registry and official docs. Version compatibility with Next.js 14 App Router confirmed via official docs and GitHub issues. react-beautiful-dnd deprecation confirmed (GitHub repo archived August 2025). Package versions pinned to verified latest. |
| Features | HIGH | FSA-578 required fields verified against official USDA form PDF. RP/RP-HPE/YP formulas verified against ISU Extension A1-54. Claims lifecycle stages verified against USDA RMA documentation. Existing fsa-acres codebase (`calc.js`, `insurance.js`, `data.json`) is primary ground-truth for data model and business logic. |
| Architecture | HIGH | Based on direct codebase inspection of glomalin-portal (all source files), fsa-acres (server.js, calc.js, insurance.js, data.json), and all integration points. Component boundaries, SQL schemas, and data flows derived from actual running code, not assumptions. Build order grounded in actual FK constraints. |
| Pitfalls | HIGH | dnd-kit SSR hydration mismatch: confirmed in GitHub issue #285. Server Actions 1MB limit: confirmed in Next.js GitHub Discussion #57973. Storage RLS + signed URL conflict: confirmed in Supabase storage-js GitHub issue #186. Cross-app fetch timeout: confirmed by existing fsa-acres implementation pattern. RLS subquery performance: confirmed in Supabase official docs. |

**Overall confidence: HIGH**

### Gaps to Address

- **SCO/ECO county yield data source:** SCO and ECO indemnity calculations require county-level average yield, which is not available in any farm system. Research recommendation is to defer SCO/ECO to v7+ or require manual county data entry with explicit labeling. If SCO/ECO is required in v6.0, a manual county APH entry field must be added to insurance module schema and UI before Phase 4. Decision needed during Phase 3 planning.

- **USDA RMA price scrape endpoint stability:** The existing `fsa-acres/public/pricing.js` scrapes `public-rma.fpac.usda.gov/apps/PriceDiscovery`. This is not a documented public API. The Phase 3 plan must include a manual price override fallback (already in the `insurance_pricing.manual_override` field in the schema) so the module continues to function if the scrape endpoint changes format.

- **Prior-year CLU data availability for year-over-year comparison:** Year-over-year CLU comparison requires historical CLU records with a `cropYear` field. The Phase 1 import script migrates current 2026 data. Whether prior-year (2025) fsa-acres data exists as a backup or archived file is unknown. Verify during Phase 1 planning — if no prior-year data exists, year-over-year comparison effectively becomes a v7+ feature for this deployment.

- **Tablet testing hardware:** PITFALLS.md identifies iPad (1024×768) testing as required for every UI phase. Confirm whether a physical iPad is available in the farm office or whether browser DevTools viewport emulation is the testing method. This affects verification criteria for Phases 2, 4, and 6.

---

## Sources

### Primary (HIGH confidence)
- `fsa-acres/server.js`, `public/calc.js`, `public/insurance.js`, `data/data.json` — ground-truth data model, existing business logic, cross-app proxy patterns, cachedFetch() implementation
- `glomalin-portal/src/middleware.ts` — auth + RBAC + module access middleware; confirmed no code changes needed for new module slugs
- `glomalin-portal/src/lib/modules.ts` — existing MODULES registry structure
- `glomalin-portal/package.json` — confirmed existing dependencies (no PDF library, no dnd-kit, no recharts yet installed)
- `glomalin-portal/src/app/(protected)/dashboard/page.tsx` — server component pattern with Supabase data fetch
- USDA FSA-578 Manual 2025 (fsa.usda.gov) — required form fields, practice codes, status codes, confirmed FSA generates the official form
- USDA RMA Claims Process (rma.usda.gov) — 72-hour notice of loss deadline, adjuster process, DNOL rules
- dnd-kit GitHub issue #285 — SSR hydration mismatch and `dynamic({ ssr: false })` fix confirmed
- Next.js GitHub Discussion #57973 — 1MB Server Actions body limit, bodySizeLimit config unreliability confirmed
- Supabase storage-js GitHub issue #186 — signed URL + INSERT RLS conflict confirmed
- Supabase Docs — RLS Performance Best Practices, Storage File Limits (50MB free tier)
- https://nivo.rocks/heatmap/ — Nivo heatmap API and ResponsiveHeatMapCanvas variant confirmed
- https://docs.dndkit.com/introduction/installation — dnd-kit official installation, multi-container Kanban pattern

### Secondary (MEDIUM confidence)
- Iowa State Extension A1-54 — RP, RP-HPE, YP guarantee and indemnity formulas (academic source, confirmed against existing fsa-acres calc.js)
- Iowa State Extension A1-44 — SCO/ECO 86% trigger, county-level yield requirement, payment limit and indemnity formulas
- USDA One Big Beautiful Bill Act 2025 — SCO/ECO premium subsidy increase to 80% (multiple secondary sources; not verified against Federal Register)
- AgriSompo Claim Deadlines — 15-day EOIP deadline, DNOL rules
- npm registry + community sources — recharts 3.4.1, framer-motion 12.x, react-dropzone 14.2.3 version confirmations

### Tertiary (LOW confidence)
- Visual Heatmap / canvas-heatmap GitHub — WebGL/Canvas threshold for dense heat maps (coverage matrix will never reach the scale where this matters; CSS grid is correct approach regardless)

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
