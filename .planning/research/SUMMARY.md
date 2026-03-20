# Project Research Summary

**Project:** organic-cert v2.0 — Projected vs Actual Farm Budget
**Domain:** Role-filtered budget comparison with actuals data entry for internal farm operations tool
**Researched:** 2026-03-20
**Confidence:** HIGH

## Executive Summary

This milestone adds a projected vs actual budget comparison layer on top of an existing, validated Next.js 16 app (organic-cert). The codebase already has all the data it needs — `FieldEnterprise` holds projected plan data, `FieldOperation` tracks PLANNED vs CONFIRMED passes, `MaterialUsage` has `dataSource` fields, and `HarvestEvent` / `SaleDelivery` hold actual yield and revenue. The gap is entirely in the API layer (no role filtering, no projected/actual split in the budget-summary computation) and the UI layer (no two-column layout, no actuals entry forms). One new npm dependency is needed: `recharts` via the shadcn `chart` component. Four new Prisma models will hold granular actuals records alongside the projected plan, keeping the two layers cleanly separated.

The most important architectural decision is keeping actuals as a parallel data layer, never overwriting projected records. The farm manager's projected crop plan (synced from farm-budget) must remain immutable so that projected vs actual variance is always computable. The second most important decision is enforcing financial privacy at the API route, not just the UI — sale prices, gross margins, and profit-per-acre must be stripped from responses before they reach the wire for OFFICE and CREW callers.

The single largest risk is the `getAuthContext()` auth fallback, which silently returns the first ADMIN user when no session cookie is present. This fallback was built for an iframe embedding scenario and currently makes all role filtering pointless — every request is treated as ADMIN. This must be resolved before any role-filtered view is built. Without fixing this, all the permission logic, response shaping, and UI conditionals are decorative. Fix the auth fallback first; everything else follows cleanly from that.

---

## Key Findings

### Recommended Stack

The existing stack covers everything needed. The only net-new dependency is `recharts` (installed via `npx shadcn@latest add chart`), which provides the grouped bar chart for the projected vs actual comparison view. All other work is code changes: Prisma schema additions (four new Actual* models), RBAC permission additions (`budget:read`, `budget:financial`), and API route modifications. No new auth library, ORM, form library, or infrastructure is required.

See [STACK.md](.planning/research/STACK.md) for full details.

**Core technologies:**
- `recharts` ^2.15.0 (via shadcn `chart.tsx`): projected vs actual bar chart — only new npm dependency; matches the shadcn ecosystem already in use
- `EnterpriseActual` / `Actual*` Prisma models: actuals data layer — additive schema migration, zero risk to existing data
- `getAuthContext()` + `hasPermission()`: role enforcement — existing pattern applied consistently to budget routes that currently have no auth check
- Existing `passStatus` (PLANNED/CONFIRMED) and `dataSource` (SYNCED/MANUAL) fields: projected vs actual split — already in schema, just not used by the budget-summary computation

### Expected Features

The feature boundary for v2.0 is tightly bounded by what the data model already supports. All projected data already exists in the schema; the work is wiring it through role-filtered APIs and a two-column UI.

See [FEATURES.md](.planning/research/FEATURES.md) for full prioritization matrix and role-based visibility matrix.

**Must have (table stakes):**
- Budget API role filtering — strip financial fields (revenue projection, gross margin, sale prices) from responses for OFFICE/CREW; privacy foundation, nothing else ships without this
- All-enterprise sync expansion — remove organic-only filter so conventional enterprises sync alongside organic ones
- Projected vs actual split in budget-summary API — return `projected` and `actual` objects separately so the UI can render two columns
- Updated Budget tab with Projected | Actual | Variance columns per section — primary daily-use view for OFFICE and ADMIN
- Farm-wide budget summary page listing all enterprises for a crop year — ADMIN's season overview
- Actuals entry for material inputs — OFFICE enters invoice costs against projected rates
- Harvest actuals entry verified accessible for OFFICE role

**Should have (v2.x after validation):**
- Variance column with favorable/unfavorable color indicator (green/red)
- DataSource badge (Projected/Actual) on line items
- Bulk operation confirmation ("Confirm all planned passes" in one action)
- Inline actuals editing on Budget tab
- Crop-year selector on farm-wide summary

**Defer (v3+):**
- Actuals sync back to farm-budget service — explicitly out of scope per PROJECT.md
- Invoice PDF attachment on material usages — file storage not in scope
- Approval workflow for actuals — explicitly ruled out in PROJECT.md

### Architecture Approach

The architecture is a parallel data layer added to the existing Next.js App Router app. Four new Prisma models (`ActualFieldOperation`, `ActualMaterialUsage`, `ActualSeedUsage`, `ActualYield`) sit alongside the existing projected models with `fieldEnterpriseId` as the FK anchor — actuals entry never touches `FieldOperation`, `MaterialUsage`, or `SeedUsage`. Role enforcement happens exclusively at the API route (never client-only), using two new RBAC permissions: `budget:read` (costs, rates, yield quantities — ADMIN and OFFICE) and `budget:financial` (sale prices, margins, revenue — ADMIN only). The `BudgetTab` component must be extracted from `[id]/page.tsx` before any dual-view logic is added, because the detail page already exceeds safe file size.

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full component structure, data flow diagrams, and suggested build order.

**Major components:**
1. `budget-summary/route.ts` (modified) — add role guard, strip `revenueProjection` for non-ADMIN, split projected vs actual computation paths
2. `actuals/route.ts` (new) — OFFICE+ADMIN reads and writes for all four actual record types, dispatched by `type` body param
3. `actuals-summary/route.ts` (new) — ADMIN-only computed comparison of projected vs actual totals, feeds the comparison view
4. `BudgetTab.tsx` (extracted + extended) — receives `role` prop; renders OFFICE actuals-entry view or ADMIN comparison view
5. `ActualsEntryForm.tsx` (new) — inline entry form for OFFICE to record invoice costs and yield
6. `sync-macro/route.ts` (modified) — remove organic-only filter; update upsert match key to include `organicStatus`

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for full pitfall analysis, warning signs, recovery strategies, and phase-to-pitfall mapping.

1. **`getAuthContext()` ADMIN fallback makes all role filtering pointless** — resolve iframe auth before building any role-filtered view; the fallback returns ADMIN silently when no session exists, meaning every OFFICE login is treated as ADMIN. Fix: pass a user-scoped token in `X-Auth-Token` header from the portal iframe, or change the fallback to return `null` and 401. Verify with `curl --no-cookie` that the budget-summary route returns 401 before proceeding.

2. **`budget-summary` route has no auth check and returns full financial data to any caller** — add `getAuthContext()` + role check before any other budget work; the main enterprise GET route (`/api/field-enterprises/[id]`) also returns `targetPricePerUnit` without an auth check and must be audited alongside it.

3. **Budget-summary computation mixes PLANNED and CONFIRMED operations** — split computation before actuals entry goes live; once Sandy confirms passes, the current code double-counts (projected PLANNED + actual CONFIRMED summed together). Fix: filter `fieldOperations` by `passStatus` — PLANNED for projected totals, CONFIRMED for actual totals.

4. **Expanding sync without updating the upsert match key creates duplicate enterprises** — the current match key `{fieldId, cropYear, crop, label}` does not include `organicStatus`; conventional and organic crops of the same type on the same field collide. Fix: update match key to include `organicStatus` derived from the budget enterprise's `category`; run a dry-run before going live.

5. **UI-only financial field hiding is insufficient** — `revenueProjection` and `targetPricePerUnit` must be stripped at the API route, not just conditionally rendered in JSX. Browser DevTools exposes any JSON the client receives regardless of UI conditionals. Both layers are required.

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: RBAC and Auth Foundation
**Rationale:** Auth fallback and missing route guards make all downstream role-filtering work meaningless. Every other phase depends on `getAuthContext()` returning the actual caller's role. Six of the eight critical pitfalls are in this phase's scope — landing this cleanly is the prerequisite for everything.
**Delivers:** Trustworthy role enforcement across all budget routes; OFFICE cannot see financial data through any vector (API, DevTools, or UI); audit of all routes returning financial fields completes here
**Addresses:** Budget API role filtering (P1 table stakes); `sale:read` OFFICE permission audit; `budget:read` / `budget:financial` additions to `rbac.ts`
**Avoids:** Pitfalls 1, 2, 5, 6 — auth fallback bypass, unguarded financial routes, UI-only hiding, sale price leak through OFFICE permissions

### Phase 2: Actuals Entry and Dual-Layer Budget Computation
**Rationale:** With auth enforced, the actuals data layer and the two-column budget view can be built safely. The projected/actual computation split in `budget-summary` must happen before actuals entry goes live — otherwise confirmed passes inflate the projected totals. `BudgetTab.tsx` extraction is a structural prerequisite because the detail page is already too large to safely extend.
**Delivers:** OFFICE can enter invoice costs and yield actuals; ADMIN sees Projected | Actual | Variance columns on the enterprise Budget tab; projected totals are frozen and isolated from actuals entry
**Uses:** `recharts` via `npx shadcn@latest add chart`; four new Actual* Prisma models; `BudgetTab.tsx` extraction
**Implements:** Actuals parallel layer, dual-layer budget computation, OFFICE actuals entry forms, ADMIN comparison view
**Avoids:** Pitfall 4 (merged projected+actual totals); anti-pattern of overwriting projected records with actuals

### Phase 3: All-Enterprise Sync Expansion
**Rationale:** Expanding the sync is independent of the actuals layer but must come after Phase 1 (auth in place for sync routes) and after Phase 2 is stable (so the database state is known-good before adding conventional enterprises). The match key collision risk demands dry-run verification — building this last minimizes the blast radius if something goes wrong.
**Delivers:** Conventional enterprises sync alongside organic ones; projected budget data flows in for the full farm operation; all enterprises are available for the farm-wide summary view
**Avoids:** Pitfall 3 (duplicate enterprises from match key collision); dry-run verification is a deliverable, not an option

### Phase 4: Farm-Wide Budget Summary View
**Rationale:** This view requires all enterprises to be synced (Phase 3) and the projected vs actual API to be working (Phase 2). It is the highest implementation cost item in P1 features and is appropriately last once all prior phases are stable and verified.
**Delivers:** ADMIN sees all enterprises for a crop year in one view with projected vs actual totals; mirrors the Macro Rollup layout Sandy already knows; financial columns hidden for OFFICE
**Implements:** New farm-wide aggregation API route, new farm-wide summary page/component

---

### Phase Ordering Rationale

- Auth must precede everything: building role-filtered views on top of a broken auth fallback produces code that appears to work but leaks financial data through any unauthenticated request.
- Schema migration and actuals computation split must precede actuals entry: the four Actual* models must exist before any route can write to them, and the budget-summary computation must be split before confirmed passes corrupt projected totals.
- Sync expansion comes after actuals layer: the database must be in a stable, known-good state before expanding the sync filter. A bad sync run can corrupt existing organic enterprise data.
- Farm-wide view is last because it is the highest-complexity aggregation and depends on the three preceding phases being verified in production.

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** Established guard pattern already in use for `/api/admin/*` routes; RBAC additions are code changes with no ambiguity; all patterns are direct extensions of verified existing code
- **Phase 2:** Actuals parallel layer follows standard additive schema pattern; `recharts` via shadcn chart is documented at ui.shadcn.com; component extraction is structural refactoring with no novel patterns
- **Phase 4:** Farm-wide aggregation follows the same reduce-and-sum pattern as the existing budget-summary route

Phases that may benefit from additional research before planning:
- **Phase 3:** The sync match key collision risk and the budget service's exact `category` field values for conventional enterprises should be verified against the live farm-budget service (port 3001) before writing the expanded sync logic. The category values the sync currently checks for (`"organic"`, `"ORG"` system codes) may not cover all conventional enterprise categories accurately.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on direct codebase inspection + shadcn official docs; one new dependency (`recharts`) with confirmed React 19 compatibility; all other stack elements are verified existing packages |
| Features | HIGH | Based on direct schema inspection, PROJECT.md constraints, and RBAC audit; feature scope is tightly bounded by what the data model already supports; anti-features grounded in explicit PROJECT.md rules |
| Architecture | HIGH | Based on direct reading of all relevant source files (`auth.ts`, `rbac.ts`, `budget-summary` route, `sync-macro` route, detail page, schema); all patterns are extensions of verified existing patterns |
| Pitfalls | HIGH | All pitfalls grounded in specific line numbers and direct code inspection; no speculative pitfalls; warning signs and recovery strategies are concrete |

**Overall confidence:** HIGH

### Gaps to Address

- **Iframe auth token mechanism:** The preferred fix for the `getAuthContext()` ADMIN fallback is passing a user-scoped token in `X-Auth-Token` from the portal. Whether the portal can emit a per-user signed token for the iframe needs confirmation before Phase 1 is fully scoped.
- **Budget service `category` field values for conventional enterprises:** The sync filter currently checks for `"organic"` and `"ORG"` system codes. The exact values the farm-budget service uses for conventional enterprises have not been confirmed from source. Verify against the live farm-budget service (port 3001) before writing Phase 3 sync logic.
- **`recharts` version verification:** Research cites `recharts` ^2.15.x as current stable. Confirm exact version before install — training data has an August 2025 cutoff and the package may have moved.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/app/api/field-enterprises/[id]/budget-summary/route.ts`, `src/app/api/fields/sync-macro/route.ts`, `src/app/(app)/field-enterprises/[id]/page.tsx`, `prisma/schema.prisma`, `package.json` — all architecture and pitfall findings
- `.planning/PROJECT.md` — feature constraints, role definitions, anti-features, milestone scope

### Secondary (MEDIUM confidence)
- [shadcn/ui chart component docs](https://ui.shadcn.com/docs/components/chart) — recharts as underlying library, `npx shadcn add chart` install pattern
- [Budget vs Actual Analysis — Qubit Capital](https://qubit.capital/blog/budget-vs-actual) — dual-column layout conventions
- [Plan vs Actual Analysis — LivePlan](https://www.liveplan.com/blog/managing/how-to-conduct-plan-vs-actual-financial-analysis) — projected vs actual column conventions
- [Actuals in Accounting — NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/actuals-in-accounting.shtml) — actuals workflow patterns in ERP
- [Agworld farm management platform](https://www.agworld.com/us/) — projected vs actual feature benchmarking
- [Budget vs Actual Dashboard — Bold BI](https://www.boldbi.com/dashboard-examples/finance/budget-vs-actual-dashboard/) — variance visualization conventions

### Tertiary (LOW confidence — validate before relying on)
- `recharts` npm — version 2.15.x cited as current stable; verify before install

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
