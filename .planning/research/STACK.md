# Stack Research

**Domain:** Projected vs Actual Farm Budget — Role-filtered views, actuals data entry, comparison UI
**Researched:** 2026-03-20
**Confidence:** HIGH — all recommendations are extensions of the already-validated stack; no new infrastructure

---

## Context: What Already Exists (Do NOT Re-Research)

The `organic-cert` app at `~/Desktop/my-project-one/organic-cert/` already has:

- **Next.js 16.1.6** with App Router — all routing, server components, API routes
- **PostgreSQL + Prisma 6.19.2** — schema, migrations, `prisma.ts` singleton
- **NextAuth v5 (beta.30)** — JWT sessions, `getAuthContext()` returns `{ role, farmId, ... }`
- **shadcn/ui** — `table.tsx`, `tabs.tsx`, `badge.tsx`, `dialog.tsx`, `input.tsx`, `select.tsx`, `card.tsx`, `sheet.tsx` already installed
- **Zod 4.3.6** — request validation already in use
- **sonner 2.0.7** — toast notifications already installed
- **date-fns 4.1.0** — date utilities already available
- **Existing RBAC** — `src/lib/rbac.ts` with `hasPermission(role, permission)`, roles: ADMIN, OFFICE, CREW, AUDITOR
- **Auth guard pattern** — `getAuthContext()` + `if (user.role !== "ADMIN") return 403` pattern in all `/api/admin/*` routes
- **Budget summary route** — `GET /api/field-enterprises/[id]/budget-summary` computes costs + revenue projection on-the-fly; currently has NO auth guard

Research below covers only the **gaps**: role-filtered API responses, new actuals data model, comparison view charting, and sync expansion.

---

## What Needs to Change (New Additions Only)

### 1. Role-Filtered API Responses — No New Library

The existing `getAuthContext()` + role check pattern is sufficient. The pattern needed is **response shaping**, not a new library.

**Problem:** `budget-summary` route exposes `revenueProjection` (target price, gross margin, margin/acre) to all roles. OFFICE has `sale:read` permission but must not see financial performance data.

**Solution:** Add `getAuthContext()` call to `budget-summary` and strip financial fields before returning if role is not ADMIN.

```typescript
// In /api/field-enterprises/[id]/budget-summary/route.ts
const user = await getAuthContext();
const isAdmin = user?.role === "ADMIN";

// Strip from response if not admin:
// - revenueProjection (target price, gross margin, margin/acre)
// - costPerAcre (reveals rental/overhead allocation indirectly)
// - individual operation costPerAcre (labor/equipment rates)
```

This is a code change, not a library addition. Apply the same pattern to any future budget-layer API routes.

### 2. Actuals Data Model — Prisma Schema Extension Only

No new ORM or DB library. Extend the existing Prisma schema with:

**New enum:**
```prisma
enum BudgetLayer {
  PROJECTED
  ACTUAL
}
```

**New model: `EnterpriseActual`**

Stores actuals at the enterprise level — a parallel record to the projected values already on `FieldEnterprise`. Keeps the projected plan (admin's crop plan) immutable while actuals record reality separately.

```prisma
model EnterpriseActual {
  id                  String          @id @default(cuid())
  fieldEnterpriseId   String
  fieldEnterprise     FieldEnterprise @relation(fields: [fieldEnterpriseId], references: [id])
  recordedById        String?
  recordedBy          User?           @relation(fields: [recordedById], references: [id])

  // Actuals: inputs (invoices)
  actualSeedCost      Float?          // total seed invoice cost
  actualMaterialCost  Float?          // total input invoice cost
  actualOperationCost Float?          // total field ops / custom hire invoices
  actualOverheadCost  Float?          // rental, insurance, other overhead — ADMIN-only field
  notes               String?

  // Actuals: yield (can also come from existing HarvestEvent records)
  actualYieldPerAcre  Float?
  actualYieldUnit     String?

  // Actuals: revenue — ADMIN-only fields
  actualPricePerUnit  Float?
  actualGrossRevenue  Float?

  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@unique([fieldEnterpriseId])
  @@index([fieldEnterpriseId])
}
```

**Why a separate model rather than flag on FieldEnterprise:** FieldEnterprise is the projected plan (admin's source of truth, synced from farm-budget service). Modifying it for actuals would mix concerns and risk sync overwriting actuals data. A linked `EnterpriseActual` record is clean, optional (null = no actuals entered yet), and keeps the sync layer untouched.

**What NOT to add:** Do not add a `BudgetLayer` flag to existing `MaterialUsage`, `FieldOperation`, or `SeedUsage` models. Those already use `PassStatus (PLANNED/CONFIRMED)` and `DataSource (MANUAL/SYNCED)` which serve as the projected/actual distinction for line-item records. Adding another layer enum would create ambiguity with existing patterns.

**For invoice-level actuals** (if granular invoice tracking is needed beyond totals): Add `ActualInvoice` model linked to `EnterpriseActual`. Start with totals on `EnterpriseActual` first — if granularity is needed, add the invoice model in a sub-phase.

### 3. Comparison UI — One Chart Library Addition

The existing shadcn/ui components cover forms, tables, tabs, and badges. The comparison view needs one new capability: a **bar chart** for projected vs actual side-by-side.

**Recommended: `recharts` ^2.15.0**

| Why Recharts | Rationale |
|---|---|
| Ships with shadcn/ui chart component | shadcn docs use Recharts as the underlying library for `chart.tsx`; install once, get the shadcn wrapper |
| React-native | No D3 dependency; composable component API fits App Router pattern cleanly |
| Already in shadcn ecosystem | shadcn `chart.tsx` uses `recharts` under the hood — consistent with existing component style |
| Lightweight for this use case | A simple grouped bar (projected vs actual per category) needs no specialized charting library |

**Install path:** Add the shadcn `chart` component (which adds `recharts` as peer dependency), then use the shadcn `<ChartContainer>` + `<BarChart>` pattern.

```bash
# Adds recharts + generates src/components/ui/chart.tsx
npx shadcn@latest add chart
```

**Confidence:** HIGH — shadcn chart component documentation at ui.shadcn.com confirms recharts dependency; recharts 2.15.x is current stable as of early 2026.

**What NOT to use:**
- `chart.js` / `react-chartjs-2` — canvas-based, worse accessibility, heavier for this scale
- `victory` — less maintained, different API style from shadcn ecosystem
- `@tremor/react` — full component library, overkill when only one chart type is needed
- `d3` directly — too low-level for a simple bar chart; no React abstractions

### 4. All-Enterprise Sync — Code Change Only

The `sync-macro` route filters to organic enterprises via:
```typescript
const organicEnterprises = enterprises.filter(
  (e) => e.category === "organic" || e.systemCodes.some((c) => c.includes("ORG"))
);
```

Expanding to all enterprises removes this filter. No new library. The existing `BudgetEnterprise` / `BudgetField` interfaces and HTTP fetch pattern cover conventional enterprises identically. The only schema concern is ensuring `FieldEnterprise.organicStatus` is set correctly for conventional fields (it defaults to `ORGANIC` — the sync must set it from the budget enterprise's category).

---

## Recommended Stack — New Additions Summary

### New Libraries (Install)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `recharts` | ^2.15.0 | Projected vs actual comparison bar chart | Underlying library for shadcn `chart.tsx`; install via `npx shadcn add chart` to get the typed wrapper component |

**That is the only new npm dependency for this milestone.**

### New shadcn Components (Generate, No Install)

| Component | How to Add | Purpose |
|-----------|-----------|---------|
| `chart.tsx` | `npx shadcn@latest add chart` | Adds `recharts` + typed `<ChartContainer>`, `<ChartTooltip>` wrappers |

### Prisma Schema Changes (No New Library)

| Change | Type | Purpose |
|--------|------|---------|
| `EnterpriseActual` model | New model | Stores actuals (costs, yield, revenue) per enterprise, separate from projected plan |
| `BudgetLayer` enum | New enum | Optional — may be needed for future multi-layer queries; add with `EnterpriseActual` migration |

### Code-Only Changes (No New Library)

| Change | Location | Purpose |
|--------|----------|---------|
| Add `getAuthContext()` + role check | `budget-summary` route | Strip financial fields from OFFICE/CREW responses |
| Add role guard to all new actuals routes | New `/api/field-enterprises/[id]/actuals/*` routes | Consistent with admin/sync guard pattern |
| Remove organic-only filter | `sync-macro` route | Expand to all enterprises |
| `organicStatus` mapping on sync | `sync-macro` route | Set ORGANIC/CONVENTIONAL based on budget enterprise category |

---

## Installation

```bash
# Only new dependency
npx shadcn@latest add chart
# This installs recharts and generates src/components/ui/chart.tsx
```

```bash
# After schema changes
npx prisma migrate dev --name add-enterprise-actuals
npx prisma generate
```

No other packages needed. Everything else (forms, tables, tabs, toasts, zod validation, date formatting) is already in the project.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `recharts` (via shadcn chart) | `chart.js` / `react-chartjs-2` | If canvas rendering performance matters at scale (>1000 data points); not relevant for a per-enterprise comparison with ~5 cost categories |
| Separate `EnterpriseActual` model | Add `isActual: Boolean` flag to existing cost models | Only if granular per-line actuals (individual invoice records) are needed from day one; totals model is simpler to build and validate first |
| Response shaping in route handler | Prisma-level row filtering | Prisma filtering works for row access (e.g., hide other farms' records); field-level stripping (hide specific JSON keys from same row) must happen in application code |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new auth library | NextAuth v5 + `getAuthContext()` already returns role; the guard pattern is established | Existing `getAuthContext()` + role check in each route |
| `react-hook-form` | Overkill for the scale of actuals entry forms (5-10 fields); adds learning overhead for Sandy's simple invoice entry | Controlled components with `useState` + Zod validation on submit, consistent with existing form patterns in the app |
| `@tanstack/react-table` | The existing shadcn `table.tsx` + manual column rendering is already in use for all data tables in the app | Extend the existing table pattern for projected vs actual side-by-side columns |
| New ORM or query builder | Prisma 6.x with direct queries handles all required joins and filtering | Raw Prisma queries, same as all existing routes |
| Separate `actuals` database schema | Single database, single Prisma client; no isolation needed for this scale | `EnterpriseActual` model in the same schema |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `recharts` ^2.15.0 | React 19.x, Next.js 16 | React 19 compat confirmed in recharts 2.x changelog; shadcn chart component handles the React.createContext patterns correctly |
| `prisma` ^6.19.2 (existing) | PostgreSQL 14+ | No version change needed; `EnterpriseActual` migration is additive |
| `next-auth` beta.30 (existing) | Next.js 16 | No change; `getAuthContext()` is the stable integration point |

---

## Integration Points With Existing Stack

**How role filtering plugs in:**
- `getAuthContext()` returns `{ role: "ADMIN" | "OFFICE" | "CREW" | "AUDITOR" }` — call it at the top of each budget route
- Shape the response object before `NextResponse.json()` — strip keys conditionally based on `role === "ADMIN"`
- No middleware needed; route-level checks are consistent with the existing `/api/admin/*` pattern

**How `EnterpriseActual` plugs into existing budget-summary:**
- Extend `budget-summary` GET to also `include: { actualData: true }` when fetching the enterprise
- Return a `{ projected: {...}, actual: {...} | null }` response shape instead of flat fields
- OFFICE role sees the `actual` layer (costs, yield) but not `projected.revenueProjection` or `actual.actualGrossRevenue`

**How comparison UI plugs in:**
- Existing `tabs.tsx` provides the Projected / Actual / Comparison tab navigation
- shadcn `chart.tsx` (recharts) renders the grouped bar chart in the Comparison tab
- Existing `table.tsx` handles the detailed row-by-row breakdown within each tab

---

## Sources

- Codebase read: `src/lib/rbac.ts`, `src/lib/auth.ts`, `src/app/api/field-enterprises/[id]/budget-summary/route.ts`, `src/app/api/fields/sync-macro/route.ts`, `src/app/api/admin/sync/route.ts`, `prisma/schema.prisma`, `package.json` — HIGH confidence (direct source read)
- [shadcn/ui chart component](https://ui.shadcn.com/docs/components/chart) — confirms recharts ^2.x as underlying library; `npx shadcn add chart` install pattern — HIGH confidence
- [recharts npm](https://www.npmjs.com/package/recharts) — 2.15.x as current stable — MEDIUM confidence (version from training data; verify before install)
- Prisma schema extension patterns — additive model addition via migration is standard Prisma workflow — HIGH confidence

---
*Stack research for: Projected vs Actual Farm Budget — organic-cert v2.0 milestone*
*Researched: 2026-03-20*
