# Project Research Summary

**Project:** organic-cert v2.0 — Projected vs Actual Farm Budget
**Domain:** Role-filtered budget comparison with actuals data entry for internal farm operations tool
**Researched:** 2026-03-20
**Confidence:** HIGH — all findings grounded in direct codebase inspection; no speculative infrastructure claims

## Executive Summary

This milestone adds a projected vs actual budget comparison layer on top of an existing, validated Next.js 16 app (`organic-cert`). The codebase already has all the data it needs — `FieldEnterprise` holds projected plan data, `FieldOperation` tracks PLANNED vs CONFIRMED passes via `passStatus`, `MaterialUsage` has `dataSource` (SYNCED/MANUAL) fields, and `HarvestEvent` / `SaleDelivery` already store actual yield and revenue. The gap is entirely in the API layer (no role filtering on budget routes, no projected/actual computation split in `budget-summary`) and the UI layer (no two-column layout, no actuals entry forms). One new npm dependency is needed: `recharts` via the shadcn `chart` component. Four new Prisma models will store granular actuals records in a parallel layer alongside the projected plan, keeping the two sources cleanly separated and the projected plan immutable.

The most important architectural decision for this milestone is keeping actuals as a parallel data layer and never overwriting projected records. The farm manager's projected crop plan (synced from the farm-budget service) must remain immutable so projected vs actual variance is always computable. The second most important decision is enforcing financial privacy at the API route layer, not in the UI — sale prices, gross margins, and profit-per-acre must be stripped from API responses before they reach the wire for OFFICE and CREW callers. Client-side conditional rendering is insufficient because any API response is visible in browser DevTools.

The single largest risk is the `getAuthContext()` auth fallback, which silently returns the first ADMIN user when no session cookie is present. This was built for an iframe embedding scenario and currently makes all role filtering vacuous — every request is treated as ADMIN regardless of who is logged in. This must be resolved before any role-filtered view is built. Without fixing this, all permission logic, response shaping, and UI conditionals are decorative. Fix the auth fallback first; everything else follows cleanly from that.

---

## Key Findings

### Recommended Stack

The existing stack (Next.js 16.1.6, PostgreSQL + Prisma 6.19.2, NextAuth v5 beta.30, shadcn/ui, Zod 4.3.6, sonner 2.0.7, date-fns 4.1.0) covers everything needed. The only net-new dependency is `recharts` (installed via `npx shadcn@latest add chart`), which provides the grouped bar chart for the projected vs actual comparison view. All other work is code changes: Prisma schema additions (four new `Actual*` models), RBAC permission additions (`budget:read`, `budget:financial`), and API route modifications. No new auth library, ORM, form library, or infrastructure is required.

See [STACK.md](.planning/research/STACK.md) for full details.

**Core technologies:**
- `recharts` ^2.15.0 (via shadcn `chart.tsx`): projected vs actual bar chart — only new npm dependency; matches the shadcn ecosystem already in use; install via `npx shadcn@latest add chart`
- `Actual*` Prisma models: actuals data layer — additive schema migration, zero risk to existing data, keeps projected plan immutable from OFFICE perspective
- `getAuthContext()` + `hasPermission()`: role enforcement — existing pattern from `/api/admin/*` routes now applied to budget routes that currently have no auth check
- Existing `passStatus` (PLANNED/CONFIRMED) and `dataSource` (SYNCED/MANUAL) fields: projected vs actual split — already in schema; the budget-summary computation just needs to use them

**Critical version note:** recharts version should be verified via `npm view recharts version` before install — training data cutoff is August 2025.

### Expected Features

The feature boundary for v2.0 is tightly bounded by what the data model already supports. All projected data already exists in the schema; the work is wiring it through role-filtered APIs and a two-column UI. No Prisma schema migrations are strictly required for the projected vs actual computation — `passStatus`, `dataSource`, `HarvestEvent`, and `SaleDelivery` already hold the data. However, ARCHITECTURE.md correctly recommends four new `Actual*` models as a parallel layer rather than overloading existing models; this keeps the projected plan immutable and sync-safe.

See [FEATURES.md](.planning/research/FEATURES.md) for full prioritization matrix and role-based data visibility matrix.

**Must have (table stakes):**
- Budget API role filtering — strip financial fields (revenue projection, gross margin, sale prices, rental rates) for OFFICE/CREW; privacy foundation, nothing else ships without this
- All-enterprise sync expansion — remove organic-only filter so conventional enterprises sync alongside organic ones; farm-wide view is incomplete without this
- Projected vs actual split in `budget-summary` API — return `projected` and `actual` objects separately; unified totals currently double-count confirmed passes
- Updated Budget tab with Projected | Actual | Variance columns per section — primary daily-use view for OFFICE and ADMIN
- Farm-wide budget summary page listing all enterprises for a crop year — ADMIN's primary season overview, mirroring Macro Rollup layout
- Actuals entry for material inputs — OFFICE enters invoice costs against projected rates; primary OFFICE workflow
- Harvest actuals entry verified accessible for OFFICE role — HarvestEvent form exists; needs role audit to confirm no price fields shown to OFFICE

**Should have (v2.x after validation):**
- Variance column with favorable/unfavorable color indicator (green/red) — instant visual read on over/under budget
- DataSource badge (Projected/Actual) on line items — Sandy knows which material costs still need invoice updating
- Bulk operation confirmation ("Confirm all planned passes" in one action) — reduces repetitive OFFICE workflow
- Inline actuals editing on Budget tab — faster invoice processing without navigating to separate edit form
- Crop-year selector on farm-wide summary — year-to-year comparison once first full season of actuals data exists

**Defer (v3+):**
- Actuals sync back to farm-budget service — explicitly out of scope per PROJECT.md; creates two sources of truth
- Invoice PDF attachment on material usages — file storage infrastructure not in scope
- Approval workflow for actuals — explicitly ruled out in PROJECT.md; AuditLog provides the change trail

### Architecture Approach

The architecture is a parallel data layer added to the existing Next.js App Router app. Four new Prisma models (`ActualFieldOperation`, `ActualMaterialUsage`, `ActualSeedUsage`, `ActualYield`) sit alongside the existing projected models with `fieldEnterpriseId` as the FK anchor — actuals entry never touches `FieldOperation`, `MaterialUsage`, or `SeedUsage`. Role enforcement happens exclusively at the API route (never client-only), using two new RBAC permissions: `budget:read` (costs, rates, yield quantities — ADMIN and OFFICE) and `budget:financial` (sale prices, margins, revenue — ADMIN only). The `BudgetTab` component must be extracted from `[id]/page.tsx` before any dual-view logic is added, because the detail page already exceeds safe file size (25k+ tokens) and cannot be safely extended in-place.

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full component structure, data flow diagrams, anti-patterns, and the recommended 8-step build order.

**Major components:**
1. `rbac.ts` (modified) — add `budget:read` and `budget:financial` permissions; grant `budget:read` to OFFICE+ADMIN, `budget:financial` to ADMIN only
2. `budget-summary/route.ts` (modified) — add `getAuthContext()` guard; strip `revenueProjection` for non-ADMIN; split projected vs actual computation paths (PLANNED for projected, CONFIRMED for actual)
3. `Actual*` Prisma models (new migration) — `ActualFieldOperation`, `ActualMaterialUsage`, `ActualSeedUsage`, `ActualYield` with FK to `FieldEnterprise`; additive, zero-risk migration
4. `actuals/route.ts` + `actuals/[recordId]/route.ts` (new) — OFFICE+ADMIN reads and writes for all four actual record types, dispatched by `type` body param
5. `actuals-summary/route.ts` (new) — ADMIN-only computed comparison of projected vs actual totals; feeds the comparison view; uses `src/lib/actuals-summary.ts`
6. `BudgetTab.tsx` (extracted + extended) — receives `role` prop; renders OFFICE actuals-entry view or ADMIN comparison view; extraction is a hard prerequisite
7. `ActualsEntryForm.tsx` (new) — inline entry form for OFFICE to record invoice costs and yield
8. `sync-macro/route.ts` (modified) — remove organic-only filter; update upsert match key to include `organicStatus` from budget enterprise `category`

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for full pitfall analysis with warning signs, recovery strategies, and phase-to-pitfall mapping.

1. **`getAuthContext()` ADMIN fallback makes all role filtering pointless** — The fallback returns the first active ADMIN user when no session cookie is present (the iframe embedding scenario at port 3001). Every role filter added while this is active fires silently as ADMIN. Fix: pass a user-scoped token in `X-Auth-Token` header from the portal iframe, or change the fallback to return `null` and 401. Verify with `curl --no-cookie` that the budget-summary route returns 401 before proceeding to Phase 2.

2. **`budget-summary` and main enterprise GET routes have no auth check and return full financial data to any HTTP caller** — Add `getAuthContext()` + role check to both routes as the first task of Phase 1. Also strip `targetPricePerUnit`, `targetPriceUnit`, and `fallowCostAmount` from the enterprise GET response for non-ADMIN callers. Neither route currently imports `getAuthContext`.

3. **Budget-summary computation mixes PLANNED and CONFIRMED operations into one total** — Once Sandy starts confirming passes, the current code double-counts (projected PLANNED costs summed with actual CONFIRMED costs). Must be split before actuals entry goes live: filter `fieldOperations` by `passStatus === "PLANNED"` for the projected path, `passStatus === "CONFIRMED"` for the actual path.

4. **Removing the organic-only sync filter without updating the upsert match key creates duplicate enterprises** — The current match key `{fieldId, cropYear, crop, label: null}` does not include `organicStatus`. Conventional and organic crops of the same type on the same field in the same year are indistinguishable. Fix: update match key to include `organicStatus` derived from the budget enterprise's `category` field; run a dry-run before going live; verify zero `GROUP BY fieldId, cropYear, crop, label HAVING COUNT(*) > 1` after sync.

5. **OFFICE role has `sale:read` — sale prices may leak through routes outside the budget tab** — `/api/field-enterprises/[id]` returns `targetPricePerUnit` with no role check. Audit all routes that return financial fields as a Phase 1 deliverable. Hiding the budget tab in the UI does not protect data accessible through other API routes.

---

## Implications for Roadmap

Research shows four phases with clear dependency ordering. Phase 1 is the privacy and auth foundation that gates everything else. Phase 2 is the actuals data layer and computation split. Phase 3 is the UI comparison view and OFFICE actuals entry workflow. Phase 4 is the sync expansion, which is independent but should follow Phase 3 so the farm-wide view it enables has the full comparison UI available.

### Phase 1: RBAC and Auth Foundation

**Rationale:** Six of the eight critical pitfalls fall in this phase's scope. The `getAuthContext()` fallback makes all downstream role filtering vacuous — building actuals entry or comparison views before fixing this produces features that appear to work but silently expose financial data through any unauthenticated request. This is the non-negotiable first phase; no other phase is meaningful without it.

**Delivers:** Trustworthy role enforcement across all budget-related routes; OFFICE callers cannot see financial data through any vector (API response, DevTools, or UI); financial field audit of all field-enterprise routes completes here; `budget:read` and `budget:financial` permissions in `rbac.ts`

**Addresses:** Budget API role filtering (P1 table stakes); `sale:read` OFFICE audit; RBAC permission additions

**Avoids:** Pitfalls 1, 2, 5, 6 — auth fallback bypass, unguarded financial routes, UI-only field hiding, sale price leakage through OFFICE-accessible routes

**Key tasks:** Fix iframe auth fallback; add `budget:read` and `budget:financial` to `rbac.ts`; guard `budget-summary` and enterprise GET routes; strip financial fields for non-ADMIN; audit all `sale:read` routes; gate Budget tab visibility in UI

### Phase 2: Actuals Data Layer and Dual-Layer Computation

**Rationale:** With auth enforced, the schema and API layer can be built safely. The projected/actual computation split in `budget-summary` must happen here, before actuals entry goes live — confirming a single field pass currently inflates projected totals because PLANNED and CONFIRMED ops are summed together. `BudgetTab.tsx` extraction is a structural prerequisite for Phase 3; doing it here while building the API layer avoids a risky in-place extension of the already-oversized detail page.

**Delivers:** Four `Actual*` Prisma models with migration; `actuals/route.ts` and `actuals/[recordId]/route.ts` for CRUD; `actuals-summary/route.ts` for ADMIN comparison endpoint; budget-summary split into separate `projected` and `actual` response objects; `BudgetTab.tsx` extracted (pure refactor, no functional change yet)

**Uses:** Additive Prisma schema migration (zero risk to existing data); `src/lib/actuals-summary.ts` mirrors existing reduce-and-sum pattern

**Implements:** Actuals parallel layer; dual-layer budget computation; `budget:read` / `budget:financial` permission gates on all new routes

**Avoids:** Pitfall 4 (PLANNED+CONFIRMED totals inflation); anti-pattern of modifying projected records; anti-pattern of storing computed totals as columns on `FieldEnterprise`

### Phase 3: Comparison UI and OFFICE Actuals Entry

**Rationale:** With the data layer verified via curl tests, UI components can be built against it. The `BudgetTab` extraction (done in Phase 2) is a hard prerequisite for this phase. OFFICE actuals entry and ADMIN comparison view ship together because they use the same extracted component with role-conditional rendering.

**Delivers:** OFFICE actuals entry forms (material inputs, field operations, yield) inside `BudgetTab`; ADMIN projected vs actual side-by-side comparison (Projected | Actual | Variance columns); DataSource badge on line items; farm-wide budget summary page with financial columns gated to ADMIN; comparison bar chart via `recharts`

**Uses:** `recharts` via `npx shadcn@latest add chart` (only new npm dependency); existing `tabs.tsx`, `table.tsx`, `card.tsx` shadcn components

**Addresses:** Updated Budget tab (P1); farm-wide budget summary page (P1); harvest actuals entry verification (P1); DataSource badge (P2 should-have)

**Avoids:** Anti-pattern of putting projected and actual on separate tabs (use inline dual-column layout); UX pitfall of showing all-zero actuals before Sandy has entered any data (show comparison only when at least one actual exists)

### Phase 4: All-Enterprise Sync Expansion

**Rationale:** Independent of the actuals layer and can technically run in parallel with Phase 3, but should follow it. The farm-wide summary page built in Phase 3 is incomplete without conventional enterprises; placing this phase last ensures the UI is ready before the additional enterprises appear. The match key collision risk demands a dry-run gate — running this last minimizes blast radius if a sync error occurs and gives Phase 2 data a stable state to protect.

**Delivers:** Conventional enterprises sync alongside organic ones; `organicStatus` correctly set from budget enterprise `category`; farm-wide summary shows the full farm operation; dry-run mode as a built-in safety gate before live sync

**Addresses:** All-enterprise sync expansion (P1 table stakes); farm-wide budget summary completeness

**Avoids:** Pitfall 3 (duplicate enterprises from upsert match key collision); inadvertent deletion of organic PLANNED operations during re-sync

---

### Phase Ordering Rationale

- Auth precedes everything: the ADMIN fallback is a systemic vulnerability; features built on top of broken auth are security theater regardless of how correct the logic appears
- Schema and computation split precede actuals entry UI: the four `Actual*` models must exist before any route writes to them, and the budget-summary computation must be split before confirmed passes corrupt projected totals
- API routes verified before UI: every API endpoint should pass a `curl` test before a UI component is built against it; this avoids debugging API issues through the browser
- Sync expansion is last: the database must be in a stable, known-good state before the sync filter is expanded; a bad sync run with the wrong match key can create duplicate enterprises that require a data migration to recover from

### Research Flags

Phases with standard patterns (skip `research-phase` during planning):
- **Phase 1:** The guard pattern is already in use in `/api/admin/*` routes; adding `getAuthContext()` + `hasPermission()` to budget routes is a direct copy-and-adapt of existing code; RBAC additions are code changes with no ambiguity
- **Phase 2:** Additive schema extension follows standard Prisma migration workflow; `actuals-summary.ts` reduce-and-sum mirrors the existing `budget-summary` computation exactly; `BudgetTab` extraction is structural refactoring with no novel patterns
- **Phase 3:** `recharts` via shadcn chart is documented at ui.shadcn.com; dual-column table layout uses existing `table.tsx`; no new patterns

Phase that may benefit from additional validation before planning:
- **Phase 4:** The exact `category` field values the farm-budget service returns for conventional enterprises are not confirmed from source. The organic filter currently checks for `"organic"` string and `"ORG"` system codes — conventional values are unverified. Validate against the live farm-budget service at port 3001 before writing the upsert match key logic. The iframe auth fix mechanism (Phase 1) also needs architectural confirmation about what the portal can emit for an embed token.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection of `package.json`, `prisma/schema.prisma`, and all relevant route files; shadcn chart docs confirm recharts dependency; only version gap is recharts current stable (verify before install) |
| Features | HIGH | Based on direct schema inspection confirming existing fields; feature scoping grounded in PROJECT.md explicit constraints; role-based visibility matrix derived from direct `rbac.ts` read |
| Architecture | HIGH | All patterns are extensions of patterns already in production in this codebase; parallel actuals layer, on-the-fly computation, and route-level role guard are all proven approaches visible in existing code |
| Pitfalls | HIGH | All pitfalls identified via direct code inspection with specific file and line references; warning signs and recovery strategies are concrete and actionable; no speculative warnings |

**Overall confidence:** HIGH

### Gaps to Address

- **Iframe auth token mechanism:** The preferred fix for `getAuthContext()` ADMIN fallback is passing a user-scoped token in `X-Auth-Token` from the portal. Whether the portal can emit a per-user signed token for the iframe embed context needs confirmation before Phase 1 is fully scoped. This is the most architecturally uncertain decision in the milestone.
- **Farm-budget service `category` values for conventional enterprises:** The sync filter checks for `"organic"` and `"ORG"` system codes. The exact string values used for conventional enterprises in the farm-budget service (port 3001) are unverified. Confirm against the live service before writing Phase 4 upsert match key logic.
- **`recharts` current version:** Research cites ^2.15.x as current stable based on training data with August 2025 cutoff. Run `npm view recharts version` before installing.
- **OFFICE `sale:read` scope:** The full set of routes protected by `sale:read` that return price or margin fields has not been enumerated. Phase 1 must include a complete route audit to surface any financial field exposure beyond the two confirmed routes (`budget-summary` and enterprise GET).

---

## Sources

### Primary (HIGH confidence)
- Direct codebase: `src/lib/auth.ts` — `getAuthContext()` fallback behavior (lines 78–109)
- Direct codebase: `src/lib/rbac.ts` — permission matrix per role; ADMIN and OFFICE currently identical, no budget-specific permissions
- Direct codebase: `src/app/api/field-enterprises/[id]/budget-summary/route.ts` — on-the-fly computation pattern, absence of auth check, full response shape
- Direct codebase: `src/app/api/field-enterprises/[id]/route.ts` — absence of auth check, financial fields in full row response
- Direct codebase: `src/app/api/fields/sync-macro/route.ts` — organic filter (lines 165–169), upsert match key pattern
- Direct codebase: `src/app/(app)/field-enterprises/[id]/page.tsx` — existing tab structure, absence of role check, 25k+ token file size constraint
- Direct codebase: `prisma/schema.prisma` — existing models, `PassStatus` enum, `DataSource` enum, `@@unique` constraints
- Direct codebase: `package.json` — installed dependencies and versions
- `.planning/PROJECT.md` — milestone requirements, privacy constraints, Sandy's role (OFFICE), Macro Rollup layout parity goal, explicit out-of-scope items

### Secondary (MEDIUM confidence)
- [shadcn/ui chart component docs](https://ui.shadcn.com/docs/components/chart) — recharts as underlying library; `npx shadcn add chart` install pattern
- [Budget vs Actual Analysis — Qubit Capital](https://qubit.capital/blog/budget-vs-actual) — dual-column layout conventions, variance display patterns
- [Plan vs Actual Analysis — LivePlan](https://www.liveplan.com/blog/managing/how-to-conduct-plan-vs-actual-financial-analysis) — projected vs actual column conventions, favorable/unfavorable indicators
- [Actuals in Accounting — NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/actuals-in-accounting.shtml) — actuals workflow patterns in ERP
- [Agworld farm management platform](https://www.agworld.com/us/) — projected vs actual feature set for benchmarking
- [Budget vs Actual Dashboard — Bold BI](https://www.boldbi.com/dashboard-examples/finance/budget-vs-actual-dashboard/) — variance visualization conventions

### Tertiary (LOW confidence — validate before relying on)
- `recharts` npm — version 2.15.x cited from training data; run `npm view recharts version` to confirm before install

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
