# Architecture Research

**Domain:** Projected vs Actual Farm Budget — Integration with Existing Organic-Cert App
**Researched:** 2026-03-20
**Confidence:** HIGH — based on direct reading of the existing codebase (schema, rbac, auth, budget route, detail page)

---

## Context: What Already Exists

This is a subsequent milestone on an existing Next.js 16 app (`organic-cert`). The
architecture below focuses entirely on how the actuals data layer and role-filtered views
**integrate with existing models**. Nothing here rebuilds what already works.

### Current Projected Data Layer

```
FieldEnterprise (source of truth for admin's crop plan)
├── targetYieldPerAcre / targetPricePerUnit  — projected revenue inputs
├── SeedUsage[]       — projected seed (rate, variety, acres, purchasePrice via SeedLot)
├── MaterialUsage[]   — projected inputs (rate, unitCost, totalCost)
├── FieldOperation[]  — projected field passes (passStatus: PLANNED or CONFIRMED)
└── /api/field-enterprises/[id]/budget-summary  — computes cost totals on-the-fly
```

The budget-summary route is purely computed — no stored aggregate. It reads the projected
relations, calculates totals, and returns `revenueProjection` (yield × price × acres
− costs). This is where role filtering must be applied.

### Current RBAC State

`src/lib/rbac.ts` has a flat permission matrix. ADMIN and OFFICE currently have identical
permissions. There is no budget-specific permission. The route-level guard uses
`getAuthContext()` from `src/lib/auth.ts`, which has an important fallback: when no
session cookie is present (e.g., the cert tracker running inside an iframe), it returns
the first active ADMIN user from the DB. This fallback must be accounted for when writing
budget route guards — do not assume no session means unauthenticated.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        UI Layer (Client Components)                   │
├──────────────────────┬──────────────────────┬────────────────────────┤
│  Budget Tab          │  Budget Tab          │  Budget Tab            │
│  (OFFICE view)       │  (ADMIN view)        │  (CREW/AUDITOR)        │
│  Agronomic data only │  Full projected vs   │  No budget tab shown   │
│  Actuals entry forms │  actual comparison   │                        │
└──────────┬───────────┴──────────┬───────────┴────────────────────────┘
           │                      │
┌──────────▼──────────────────────▼───────────────────────────────────┐
│                          API Routes Layer                             │
│  /api/field-enterprises/[id]/budget-summary   MODIFY: role filter   │
│  /api/field-enterprises/[id]/actuals          NEW: OFFICE+ write    │
│  /api/field-enterprises/[id]/actuals/[id]     NEW: PUT/DELETE       │
│  /api/field-enterprises/[id]/actuals-summary  NEW: ADMIN read only  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──────────────────────────────────┐
│                       Data Layer (Prisma / PostgreSQL)               │
│                                                                      │
│  ── EXISTING (read-only from OFFICE perspective) ──────────────────  │
│  FieldEnterprise → SeedUsage, MaterialUsage, FieldOperation          │
│  HarvestEvent (organic traceability — unchanged)                     │
│                                                                      │
│  ── NEW (actuals layer) ────────────────────────────────────────── │
│  ActualSeedUsage       linked to FieldEnterprise                     │
│  ActualMaterialUsage   linked to FieldEnterprise + Material?         │
│  ActualFieldOperation  linked to FieldEnterprise                     │
│  ActualYield           linked to FieldEnterprise                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `ActualFieldOperation` | Records an actual field pass (date, cost, applicator) | New Prisma model, FK to `FieldEnterprise` |
| `ActualMaterialUsage` | Records an as-applied invoice line (product, rate, actual cost) | New Prisma model, optional FK to `Material` for catalog linkage |
| `ActualSeedUsage` | Records actual seed purchased and applied (variety, actual price) | New Prisma model, optional FK to `SeedLot` for catalog linkage |
| `ActualYield` | Records actual harvest yield; contains admin-only sale price fields | New Prisma model, agronomic fields visible to OFFICE, financial fields ADMIN-only |
| `actuals/route.ts` | OFFICE and ADMIN reads + writes for all actual record types | New route; dispatches by `type` body param or sub-routes per type |
| `actuals-summary/route.ts` | ADMIN-only computed comparison of projected vs actual totals | New route; ADMIN guard; calls `actuals-summary.ts` compute function |
| `budget-summary/route.ts` | Modified to strip financial fields for non-ADMIN callers | Existing route; add `getAuthContext()` + role check |
| `src/lib/actuals-summary.ts` | Compute actual cost totals from the 4 Actual* models | New lib file; mirrors reduce-and-sum pattern from budget-summary route |
| `BudgetTab.tsx` (extracted) | Renders projected-only (OFFICE) or dual comparison (ADMIN) | Extracted from `[id]/page.tsx`; receives `role` prop |
| `ActualsEntryForm.tsx` | Inline form for OFFICE to record invoices, yields | New component; used inside `BudgetTab` |

---

## Recommended Project Structure

Only new and modified paths. Existing paths stay where they are.

```
src/
├── lib/
│   ├── actuals-summary.ts          NEW: compute actual totals (same pattern as budget-summary)
│   └── rbac.ts                     MODIFY: add budget:read, budget:financial permissions
│
├── app/
│   └── api/
│       └── field-enterprises/
│           └── [id]/
│               ├── budget-summary/
│               │   └── route.ts    MODIFY: apply role filter on revenueProjection
│               ├── actuals/
│               │   ├── route.ts    NEW: GET list, POST new actual (all 4 types)
│               │   └── [recordId]/
│               │       └── route.ts NEW: PUT/DELETE individual actual record
│               └── actuals-summary/
│                   └── route.ts    NEW: ADMIN-only projected vs actual comparison
│
└── components/
    └── field-enterprise/
        ├── BudgetTab.tsx           NEW (extracted): receives role + both budget + actuals data
        └── ActualsEntryForm.tsx    NEW: inline entry form for OFFICE role
```

### Structure Rationale

- **`actuals-summary` as a separate route:** The projected budget-summary route already
  has a clear shape. The comparison view needs both projected totals AND actual totals
  merged into a single response. Keeping them as separate fetch calls that the `BudgetTab`
  component merges client-side is cleaner than complicating the budget-summary route.

- **Extracting `BudgetTab.tsx`:** The detail page (`[id]/page.tsx`) already exceeds the
  token read limit at 25k+ tokens. It cannot be safely extended in its current form.
  Extracting the Budget tab is a structural prerequisite, not optional cleanup.

- **`actuals/route.ts` dispatching all 4 types:** Rather than four separate sub-routes
  (`/actuals/seed`, `/actuals/material`, etc.), a single route with a `type` field in the
  POST body keeps the API surface small. The route's internal switch handles which model
  to write. This matches the existing pattern used by `operations/route.ts`.

---

## Architectural Patterns

### Pattern 1: Actuals as a Parallel Layer, Not Modifications to Projected

**What:** Four new Prisma models (`ActualSeedUsage`, `ActualMaterialUsage`,
`ActualFieldOperation`, `ActualYield`) sit alongside the existing projected models. Each
has a `fieldEnterpriseId` FK. Actuals entry never touches `SeedUsage`, `MaterialUsage`,
or `FieldOperation`.

**When to use:** Always — for every actual record type. The farm manager's projected plan
must be immutable from OFFICE's perspective.

**Trade-offs:** More models, but clean separation. The projected records cannot be
corrupted by actuals entry. The budget sync re-run from farm-budget will not overwrite
actual invoice data. Audits remain clean.

**Prisma additions (condensed to key fields):**

```prisma
model ActualFieldOperation {
  id                String          @id @default(cuid())
  fieldEnterpriseId String
  fieldEnterprise   FieldEnterprise @relation(fields: [fieldEnterpriseId], references: [id])
  type              FieldOpType
  operationDate     DateTime
  description       String?
  acresWorked       Float?
  actualCostPerAcre Float?
  actualTotalCost   Float?
  invoiceNumber     String?
  vendorName        String?
  enteredById       String?
  notes             String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([fieldEnterpriseId, operationDate])
}

model ActualMaterialUsage {
  id                String          @id @default(cuid())
  fieldEnterpriseId String
  fieldEnterprise   FieldEnterprise @relation(fields: [fieldEnterpriseId], references: [id])
  materialId        String?         // optional — link to Material catalog if known
  material          Material?       @relation(fields: [materialId], references: [id])
  productName       String          // free-text — invoice line may not match catalog name
  applicationDate   DateTime
  rate              Float?
  rateUnit          String?
  acres             Float?
  actualUnitCost    Float?
  actualTotalCost   Float?
  invoiceNumber     String?
  vendorName        String?
  enteredById       String?
  notes             String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([fieldEnterpriseId, applicationDate])
}

model ActualSeedUsage {
  id                String          @id @default(cuid())
  fieldEnterpriseId String
  fieldEnterprise   FieldEnterprise @relation(fields: [fieldEnterpriseId], references: [id])
  seedLotId         String?         // optional — link to SeedLot catalog if known
  seedLot           SeedLot?        @relation(fields: [seedLotId], references: [id])
  variety           String
  plantingDate      DateTime?
  rate              Float?
  rateUnit          String?
  acres             Float?
  actualPricePerUnit Float?
  actualTotalCost   Float?
  invoiceNumber     String?
  vendorName        String?
  enteredById       String?
  notes             String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}

model ActualYield {
  id                  String          @id @default(cuid())
  fieldEnterpriseId   String
  fieldEnterprise     FieldEnterprise @relation(fields: [fieldEnterpriseId], references: [id])
  harvestDate         DateTime?
  yieldPerAcre        Float?
  yieldUnit           String?         // "Bu", "lbs"
  acres               Float?
  // ADMIN-only fields — stripped by API for non-ADMIN callers:
  actualSalePrice     Float?
  actualSalePriceUnit String?
  actualGrossRevenue  Float?
  enteredById         String?
  notes               String?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
}
```

Also add the back-relations on `FieldEnterprise`:
```prisma
// In FieldEnterprise model, add:
actualSeedUsages       ActualSeedUsage[]
actualMaterialUsages   ActualMaterialUsage[]
actualFieldOperations  ActualFieldOperation[]
actualYields           ActualYield[]
```

### Pattern 2: Role Filter Applied at the API Route, Not in the Client

**What:** Every budget-related API route calls `getAuthContext()` and returns different
JSON shapes depending on the caller's role. Financial fields never reach the wire for
non-ADMIN callers.

**When to use:** Always. Client-side hiding is cosmetic only — browser DevTools exposes
any data the client receives. The API route is the only trustworthy enforcement point.

**RBAC changes to `src/lib/rbac.ts`:**

```typescript
// Add two new permissions:
// budget:read — can see cost totals, material rates, field operations, yield quantities
// budget:financial — can see rental rates, sale price, gross margin, profit/acre

// ADMIN permissions — add:
"budget:read", "budget:financial"

// OFFICE permissions — add:
"budget:read"
// Note: budget:financial intentionally absent

// CREW, AUDITOR — no budget permissions added
```

**Modified `budget-summary/route.ts` guard pattern:**

```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  // getAuthContext() returns ADMIN fallback when no session — that's fine
  // CREW and AUDITOR have no budget:read — return 403
  if (!ctx || !hasPermission(ctx.role as Role, "budget:read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const isAdmin = hasPermission(ctx.role as Role, "budget:financial");

  // ... existing computation ...

  return NextResponse.json({
    seedCosts,
    materialCosts,
    operationCosts,
    totalSeedCost,
    totalMaterialCost,
    totalOperationCost,
    totalCostOfProduction,
    costPerAcre,
    // Only returned to callers with budget:financial permission
    revenueProjection: isAdmin ? revenueProjection : null,
    acres,
  });
}
```

**New `actuals/route.ts` guard:**

```typescript
// POST — OFFICE and ADMIN can write
const ctx = await getAuthContext();
if (!ctx || !hasPermission(ctx.role as Role, "budget:read")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**New `actuals-summary/route.ts` guard (ADMIN only):**

```typescript
const ctx = await getAuthContext();
if (!ctx || !hasPermission(ctx.role as Role, "budget:financial")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**`ActualYield` financial field stripping in `actuals/route.ts` GET:**

```typescript
// When returning ActualYield records to OFFICE callers:
const sanitized = actualYields.map(y => {
  const { actualSalePrice, actualSalePriceUnit, actualGrossRevenue, ...safe } = y;
  return isAdmin ? y : safe;
});
```

### Pattern 3: Dual-View in Existing Budget Tab via Role Prop

**What:** Extract the Budget tab JSX from `[id]/page.tsx` into a `BudgetTab.tsx` component.
Pass `role` as a prop. Inside `BudgetTab`, conditionally fetch and render:
- OFFICE: budget-summary (no financial fields) + actuals list + entry forms
- ADMIN: budget-summary + actuals-summary (comparison) + actuals list + entry forms

**When to use:** The detail page is already over the safe file size. Extraction is a
pre-condition, not optional. Do it first before adding any dual-view logic.

**Trade-offs:** Adds a component file. Eliminates risk of corrupting the large detail
page while adding dual-view logic. Role prop instead of reading from a global store keeps
the component testable in isolation.

**Proposed Budget tab layout (ADMIN comparison view):**

```
Budget Tab
├── Summary cards row
│   ├── Projected Cost/acre  |  Actual Cost/acre   |  Variance
│   ├── Projected Yield      |  Actual Yield        |  (agronomic, not financial)
│   └── Projected Margin     |  Actual Margin       |  (ADMIN only)
│
├── Seed section
│   ├── Projected row (variety, rate, price/unit, total)
│   └── Actual row (variety, actual price, invoice #, total)
│
├── Materials section
│   ├── Projected row (product, rate, unit cost, total)
│   └── Actual row (product, actual cost, invoice, vendor)
│
├── Field Operations section
│   ├── Projected row (type, date, cost/acre, total)
│   └── Actual row (type, date, actual cost, vendor)
│
└── Actual Yield section
    ├── Actual yield/acre, acres (visible to OFFICE)
    └── Actual sale price, gross revenue (ADMIN only)
```

**OFFICE view (same tab, filtered data):**

```
Budget Tab
├── Agronomic summary only (no prices, no margin)
│
├── Actual Seed — "Record Actual" inline form
│   (variety, planting date, rate, acres, actual price, invoice #, vendor)
│
├── Actual Materials — "Record Invoice" inline form
│   (product name, date, rate, acres, actual cost, invoice #, vendor)
│
├── Actual Field Operations — "Record Pass" inline form
│   (type, date, acres, actual cost, vendor)
│
└── Actual Yield — "Record Yield" inline form
    (harvest date, yield/acre, acres — NO sale price field)
```

---

## Data Flow

### Actuals Entry Flow (OFFICE)

```
Sandy opens enterprise detail page (role=OFFICE)
    ↓
BudgetTab renders with role="OFFICE"
    ↓
Parallel fetch:
  GET /api/field-enterprises/[id]/budget-summary
    → returns costs/rates, revenueProjection: null
  GET /api/field-enterprises/[id]/actuals
    → returns existing actual records (sale price stripped from ActualYield)
    ↓
Sandy clicks "Record Invoice" in Materials section
    ↓
ActualsEntryForm opens inline
    ↓
POST /api/field-enterprises/[id]/actuals
  body: { type: "MATERIAL", productName, applicationDate, ... }
    ↓
Route checks: OFFICE has budget:read → allowed
    ↓
Creates ActualMaterialUsage in DB
    ↓
Returns new record → BudgetTab refreshes actuals list
```

### Projected vs Actual Comparison Flow (ADMIN)

```
Admin opens enterprise detail page (role=ADMIN)
    ↓
BudgetTab renders with role="ADMIN"
    ↓
Parallel fetch:
  GET /api/field-enterprises/[id]/budget-summary
    → full response including revenueProjection
  GET /api/field-enterprises/[id]/actuals-summary
    → actualTotalSeedCost, actualTotalMaterialCost, actualTotalOperationCost,
      actualYield, actualGrossRevenue, variance fields vs projected
    ↓
BudgetTab merges the two responses
    ↓
Renders comparison rows: Projected | Actual | Variance
```

### Role Filter Data Flow

```
Request hits any budget API route
    ↓
getAuthContext() → { role, farmId, ... }
    │
    ├── ADMIN → hasPermission("budget:financial") = true
    │     → full payload including revenueProjection, sale price, margin
    │
    ├── OFFICE → hasPermission("budget:read") = true, "budget:financial" = false
    │     → cost/rate fields returned; revenueProjection: null; ActualYield sale price stripped
    │
    └── CREW / AUDITOR / null → hasPermission("budget:read") = false
          → 403 Forbidden
```

---

## Integration Points

### Existing Models — No Changes Needed

| Model | How Actuals Layer Uses It |
|-------|--------------------------|
| `FieldEnterprise` | FK anchor for all 4 Actual* models via `fieldEnterpriseId` |
| `Material` | Optional FK on `ActualMaterialUsage.materialId` — OFFICE can link invoice to catalog product |
| `SeedLot` | Optional FK on `ActualSeedUsage.seedLotId` — enables future cross-reference to projected seed |
| `FieldOperation` (PLANNED) | Read-only — displayed alongside `ActualFieldOperation` in ADMIN comparison view |
| `HarvestEvent` | Coexists with `ActualYield` — `HarvestEvent` serves organic traceability; `ActualYield` serves budget actuals. They are separate concerns and should stay separate. |
| `AuditLog` | All actuals writes should call `logAudit()` using the existing pattern |

### Existing Models — Modifications Needed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 4 new Actual* models; add back-relations on `FieldEnterprise` |
| `src/lib/rbac.ts` | Add `budget:read` and `budget:financial` permissions; grant appropriately per role |
| `budget-summary/route.ts` | Add `getAuthContext()` call; strip `revenueProjection` for non-ADMIN |
| `[id]/page.tsx` | Extract `BudgetTab` JSX into `src/components/field-enterprise/BudgetTab.tsx` |

### New Files to Create

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` (migration) | New Actual* models |
| `src/lib/actuals-summary.ts` | Compute actual totals — mirrors budget-summary reduce-and-sum pattern |
| `src/app/api/field-enterprises/[id]/actuals/route.ts` | GET list + POST new actual (dispatched by `type`) |
| `src/app/api/field-enterprises/[id]/actuals/[recordId]/route.ts` | PUT/DELETE individual actual record |
| `src/app/api/field-enterprises/[id]/actuals-summary/route.ts` | ADMIN-only computed comparison response |
| `src/components/field-enterprise/BudgetTab.tsx` | Extracted + extended budget tab component |
| `src/components/field-enterprise/ActualsEntryForm.tsx` | Inline entry form for OFFICE actuals |

---

## Suggested Build Order

Dependencies between pieces determine the order. Role filtering must be in place before
actuals data is exposed. Schema migration must land before any route can write.

1. **Schema migration** — Add 4 Actual* models and back-relations to `FieldEnterprise`.
   Run `prisma migrate dev`. No UI changes yet. Zero risk to existing functionality.

2. **RBAC update + budget-summary role filter** — Add `budget:read` / `budget:financial`
   permissions to `rbac.ts`. Modify `budget-summary/route.ts` to call `getAuthContext()`
   and strip `revenueProjection` for non-ADMIN. This is the privacy gate — it must be
   in place and verified before any actuals UI is built.

3. **Actuals API routes** — Build `actuals/route.ts` (GET + POST) and
   `actuals/[recordId]/route.ts` (PUT + DELETE). Verify with curl before touching UI.

4. **Actuals-summary API route** — Build the ADMIN-only comparison endpoint. This computes
   actual totals using `src/lib/actuals-summary.ts` and returns a projected vs actual
   shape that `BudgetTab` will consume.

5. **BudgetTab extraction** — Extract the Budget tab section from `[id]/page.tsx` into
   `src/components/field-enterprise/BudgetTab.tsx`. No functional change — pure
   structural refactor. This is a hard prerequisite for steps 6 and 7 because the detail
   page file is already too large to safely extend.

6. **OFFICE actuals entry UI** — Add `ActualsEntryForm` components inside `BudgetTab`
   for `role !== "ADMIN"`. Renders entry forms for each actual type.

7. **ADMIN comparison view** — Add projected vs actual side-by-side rendering inside
   `BudgetTab` for `role === "ADMIN"`. Fetches `actuals-summary` in parallel with
   `budget-summary`.

8. **All-enterprise sync expansion** — Modify the macro sync to pull all enterprises
   (not just organic). This is independent of the actuals layer and can be done at any
   step after 3 without blocking anything else.

---

## Scaling Considerations

This is a 3-5 person internal tool on a single DigitalOcean Droplet. Scaling is not a
concern. The meaningful operational constraints:

| Concern | Approach |
|---------|----------|
| Privacy enforcement | API route is the only trustworthy enforcement point — never depend on client-side field hiding |
| Audit trail | Use existing `logAudit()` from `src/lib/audit-logger.ts` for all actuals writes |
| Schema migrations | All additive — new models, no changes to existing columns. Zero downtime. |
| `getAuthContext()` fallback | The fallback returns first ADMIN user when no session exists; budget routes must check `hasPermission()` explicitly rather than checking for `null` alone |

---

## Anti-Patterns

### Anti-Pattern 1: Modifying Projected Records to Record Actuals

**What people do:** Update `MaterialUsage.unitCost` or `FieldOperation.costPerAcre` with
the actual invoice value after the fact.

**Why it's wrong:** Destroys the projected plan. The admin can no longer compare planned
versus actual. A subsequent budget sync from farm-budget would overwrite the actual data.

**Do this instead:** Always write actuals to the new `Actual*` models. The projected
records are logically read-only from OFFICE's perspective.

### Anti-Pattern 2: Filtering Financial Data Only in the Client

**What people do:** Fetch the full budget-summary JSON (including `revenueProjection`)
and conditionally hide margin/revenue rows in JSX based on the user's role.

**Why it's wrong:** The financial data is still sent over the network. Any user who opens
browser DevTools or intercepts the API response can see sale prices and gross margins.

**Do this instead:** Strip financial fields in the API route before sending the response.
The client never receives data it is not authorized to see.

### Anti-Pattern 3: Putting Projected vs Actual on Separate Tabs

**What people do:** Add a second "Actuals" tab next to the existing "Budget" tab so the
user switches back and forth to compare numbers.

**Why it's wrong:** Context-switching between tabs to compare a projected row to an
actual row is poor UX for the farm manager. The whole value of the comparison view is
seeing variance at a glance without navigating.

**Do this instead:** One "Budget" tab with an inline two-column layout (Projected |
Actual) per section. This mirrors the Macro Rollup layout Sandy is familiar with.

### Anti-Pattern 4: Storing Computed Totals on FieldEnterprise

**What people do:** Add `actualTotalCostOfProduction` or `actualYieldPerAcre` columns
to `FieldEnterprise` and update them on every actuals write.

**Why it's wrong:** Denormalized computed columns drift out of sync when records are
updated or deleted. They require careful update triggers and add migration complexity.
The existing system deliberately computes on-the-fly — the budget-summary route is proof
this approach works.

**Do this instead:** Compute actual totals in `actuals-summary/route.ts` using the same
reduce-and-sum pattern already in `budget-summary/route.ts`. Performance is more than
adequate for a single enterprise at this scale.

---

## Sources

- Direct reading of `prisma/schema.prisma` — existing models, enums, indexes, relations
- Direct reading of `src/lib/rbac.ts` — permission matrix per role (verified ADMIN and OFFICE currently identical, no budget-specific permissions)
- Direct reading of `src/lib/auth.ts` — `getAuthContext()` pattern, including ADMIN fallback when no session
- Direct reading of `src/app/api/field-enterprises/[id]/budget-summary/route.ts` — on-the-fly computation pattern, full response shape
- Direct reading of `src/app/(app)/field-enterprises/[id]/page.tsx` — existing tab structure, BudgetSummary interface, client component data fetching
- Direct reading of `src/app/api/field-enterprises/[id]/route.ts` — existing route guard (absence of role check in current routes confirmed)
- `PROJECT.md` milestone context — privacy requirements, role definitions (Sandy = OFFICE), Macro Rollup layout parity goal, no approval gate for actuals

---

*Architecture research for: Projected vs Actual Farm Budget — organic-cert app v2.0*
*Researched: 2026-03-20*
