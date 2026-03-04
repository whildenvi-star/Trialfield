# Phase 17: Input & Seed Compilation + NOP Compliance - Research

**Researched:** 2026-03-02
**Domain:** Input mapper, seed pull, Prisma upsert (Material + MaterialUsage + SeedLot + SeedUsage), NOP compliance rules, unresolved materials UI, data source badges
**Confidence:** HIGH

---

## Summary

Phase 17 builds directly on the compile engine infrastructure from Phase 16. The data shape is already understood: farm-budget exposes products via `GET /api/products` and field-level input applications as `field.inputs[]` (each with `productName`, `quantity`, `season`). Seeds are stored as `field.seed = { variety, population }` per field, with full brand/supplier data available via `GET /api/seeds`. The organic-cert schema already has `Material`, `SeedLot`, `MaterialUsage`, and `SeedUsage` models — no new Prisma models are required, but the schema needs a `budgetProductName String?` field on `Material` for stable source tracking, and a `nopResolved Boolean @default(false)` field to distinguish "user has assigned NOP status" from "defaulted to APPROVED without review".

The central design insight: farm-budget products are named strings (e.g., `"0-0-50 OMRI"`, `"TeraFed"`, `"Tulls manure"`) that map to organic-cert `Material` records by name match. The mapper resolves `productName` → `Material` via `@@unique([farmId, name])`. When no Material record exists for a product name, it must be created as "unresolved" — the user assigns NOP status once, and it persists. MaterialUsage and SeedUsage records are then upserted (not re-entered manually) on every compile.

NOP compliance rules run exclusively against resolved materials. The rule engine is simple: (1) PROHIBITED status is a hard fail; (2) RESTRICTED status requires annotation (e.g. raw manure 90/120-day rule — already implemented in `day-rule-calc.ts`); (3) APPROVED and EXEMPT pass; (4) unresolved shows "needs review". No new library needed — `date-fns` is already installed and used by `day-rule-calc.ts`.

Source badges (farm-budget / grain-tickets / Case IH / manual) require adding a `dataSource` field to `MaterialUsage` and `SeedUsage`. The `DataSource` enum (`MANUAL | SYNCED`) already exists in the schema, but the MaterialUsage model does not currently carry it. A migration adding `dataSource DataSource @default(MANUAL)` to both `MaterialUsage` and `SeedUsage` covers the badge requirement.

**Primary recommendation:** Two plans as specified. Plan 01 = `input-mapper.ts` + seed pull logic + budget-client extensions (`getBudgetProducts`, `getBudgetFieldsWithInputs`) + POST `/api/compile/[year]/inputs` and `/api/compile/[year]/seeds` routes + Prisma schema migration. Plan 02 = Unresolved materials UI + `nop-compliance.ts` rule engine + data source badges on compile page.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMP-03 | User can compile input application data from farm-budget into organic-cert material usage records | `input-mapper.ts` fetches `GET /api/products` + field.inputs[] for organic fields, resolves productName → Material (create if missing as unresolved), then upserts MaterialUsage via `@@index` (no compound unique on MaterialUsage — use findFirst + upsert-by-id pattern). POST `/api/compile/[year]/inputs` route. |
| CMP-04 | User can compile seed data from farm-budget into organic-cert seed source records | Seed pull fetches `GET /api/seeds` for brand/supplier, field.seed.variety for per-field usage. Resolves to SeedLot by `(farmId, crop+variety)` — no `@@unique` on SeedLot, so use findFirst + create-if-missing pattern. POST `/api/compile/[year]/seeds` route. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | 6.x (installed) | Upsert Material, MaterialUsage, SeedLot, SeedUsage; migration for new fields | Already installed, matches organic-cert exactly |
| Next.js App Router | 16.x (installed) | POST `/api/compile/[year]/inputs` and `/api/compile/[year]/seeds` route handlers | Existing pattern for all compile routes |
| Native fetch + AbortController | built-in (Node 18+) | Extend budget-client.ts with `getBudgetProducts()` and `getBudgetFieldsWithInputs()` | Already used in budget-client.ts with `fetchWithTimeout` helper |
| date-fns | 4.x (installed) | `differenceInDays` for NOP 90/120 day manure rule | Already used in `day-rule-calc.ts` |
| React useState/useEffect | 19.x (installed) | Unresolved materials UI, source badges on compile page | Already used in compile page.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | installed | Status badges (green/yellow/red/amber), source badge styling | All UI in this project uses Tailwind |
| lucide-react | installed | Badge icons (check, alert-circle, clock) for NOP status display | Existing icon library in project |
| Zod | 4.x (installed) | Runtime shape validation on POST body (`{year, farmId}`) | Already used in other routes for request validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `nopResolved Boolean` on Material | New `MaterialNopStatus.UNRESOLVED` enum value | Boolean is simpler — unresolved means "not yet reviewed", not a permanent status; avoids polluting the NopStatus enum used for compliance verdicts |
| productName-string matching | budgetProductId FK | farm-budget has no stable integer PKs exposed for products; name is the only reliable join key and is already `@@unique([farmId, name])` on Material |
| Separate "unresolved" collection | Filtering `nopResolved = false` on Material | Single table with a boolean flag is simpler than a separate entity; resolving just flips the flag and records the status |
| date-fns for day calc | Custom day diff | `differenceInDays` is already used in `day-rule-calc.ts` — no reason to diverge |

**Installation:** No new npm packages. Zero installs required.

---

## Architecture Patterns

### Recommended Project Structure
```
organic-cert/src/
├── lib/
│   ├── ecosystem/
│   │   └── budget-client.ts      # Add: getBudgetProducts(), getBudgetFieldsWithInputs()
│   └── compile/
│       ├── types.ts              # Add: InputPreviewRow, SeedPreviewRow, NopCheckResult types (extend Phase 16 types)
│       ├── input-mapper.ts       # NEW: mapInputs(year, farmId) → InputPreviewRow[]
│       ├── seed-mapper.ts        # NEW: mapSeeds(year, farmId) → SeedPreviewRow[]
│       └── nop-compliance.ts     # NEW: checkCompliance(materialId) → NopCheckResult
├── app/api/compile/
│   └── [year]/
│       ├── preview/route.ts      # Already exists (Phase 16) — extend to include inputs/seeds counts
│       ├── inputs/route.ts       # NEW: POST — preview=true for dry run, preview=false to commit
│       └── seeds/route.ts        # NEW: POST — preview=true for dry run, preview=false to commit
└── app/(app)/compile/
    └── page.tsx                  # Extend: inputs section, seeds section, unresolved materials panel
```

### Pattern 1: Input Mapper (input-mapper.ts)
**What:** Fetches all products from farm-budget, fetches organic fields with their inputs[], resolves each input's productName to a Material record (creating stubs for new products), then builds MaterialUsage upsert data.
**When to use:** Called by POST `/api/compile/[year]/inputs` route.
**Example:**
```typescript
// src/lib/compile/input-mapper.ts
import { getBudgetProducts, getBudgetFieldsWithInputs } from "@/lib/ecosystem/budget-client";
import { prisma } from "@/lib/prisma";

export interface InputPreviewRow {
  fieldName: string;
  fieldEnterpriseId: string | null;   // null if Phase 16 not yet committed
  productName: string;                 // from farm-budget field.inputs[].productName
  quantity: number;
  unit: string;
  season: string;
  materialId: string | null;           // null = new unresolved material
  nopResolved: boolean;
  nopStatus: string | null;            // null if unresolved
  action: "new" | "update" | "unchanged" | "skip";
  dataSource: "farm-budget";
}

export async function mapInputs(
  cropYear: number,
  farmId: string,
  organicFieldEnterpriseIds: string[]  // from Phase 16 compile
): Promise<InputPreviewRow[]> {
  const [products, budgetFieldsData] = await Promise.all([
    getBudgetProducts(),
    getBudgetFieldsWithInputs(),         // returns organic fields only
  ]);

  const productMap = new Map(products.map((p) => [p.name, p]));

  const rows: InputPreviewRow[] = [];
  // ... resolve each input application to Material + MaterialUsage
  return rows;
}
```

### Pattern 2: Material Upsert with nopResolved Flag
**What:** `Material` has `@@unique([farmId, name])` — use `upsert` with `where: { farmId_name: { farmId, name } }`. New Materials are created with `nopResolved: false` (unresolved). Existing Materials with `nopResolved: true` are NOT overwritten — user resolution persists.
**Example:**
```typescript
// Upsert Material — never overwrite nopStatus if already resolved
const material = await prisma.material.upsert({
  where: { farmId_name: { farmId, name: productName } },
  create: {
    farmId,
    name: productName,
    nopStatus: "APPROVED",   // default only — overridden by user resolution
    nopResolved: false,       // must be set true by user before compliance check runs
    category: "OTHER",
    notes: `Compiled from farm-budget — assign NOP status before use`,
  },
  update: {
    // Only update fields that don't involve user-assigned NOP status
    // Never set: nopStatus, nopResolved (those are user territory)
  },
});
```

### Pattern 3: MaterialUsage Upsert Pattern
**What:** `MaterialUsage` has NO compound unique constraint — it uses `@@index([fieldEnterpriseId, applicationDate])`. This means `prisma.materialUsage.upsert()` cannot be called directly without a unique key. Use `findFirst + create` pattern for preview, and a `deleteMany + createMany` within a transaction for commit to avoid duplicating applications per compile run.
**When to use:** POST `/api/compile/[year]/inputs` commit path.
**Example:**
```typescript
// Transactional replace: delete all compiled-from-budget usages for this enterprise+year, then re-insert
await prisma.$transaction(async (tx) => {
  // Remove previously compiled (not manually entered) MaterialUsage records
  await tx.materialUsage.deleteMany({
    where: {
      fieldEnterpriseId: { in: enterpriseIds },
      dataSource: "SYNCED",   // only delete auto-compiled ones; preserve MANUAL entries
    },
  });
  // Re-insert current compile
  await tx.materialUsage.createMany({
    data: newMaterialUsages,
    skipDuplicates: true,    // PostgreSQL supports this
  });
});
```

### Pattern 4: Seed Pull (seed-mapper.ts)
**What:** Fetches `GET /api/seeds` from farm-budget for brand/supplier details, then reads `field.seed.variety` per organic field. Joins variety string to seeds master list by variety name match (best-effort — not all varieties guaranteed to match). Creates SeedLot stubs for matched seeds.
**Key data shapes confirmed:**
- `field.seed = { variety: "T1081J", population: 34000 }` — no seedId FK
- `data.seeds[i] = { id, crop, brand, variety, pricePerUnit, seedsPerUnit, supplierId }` — variety is join key
- Variety-to-SeedLot match: `field.seed.variety` matched to `seeds[].variety` — 9/12 organic fields had matches (verified in codebase); 2 fields have CANNING variety not in seeds master list
- SeedLot has no `@@unique` — use `findFirst({ where: { farmId, crop, variety } })` + create-if-missing

### Pattern 5: NOP Compliance Rule Engine (nop-compliance.ts)
**What:** Stateless functions that evaluate a resolved Material and optional application context (date, harvestDate for manure) and return a compliance verdict. Rules only run when `material.nopResolved === true`.
**NOP rules relevant to this codebase (7 CFR 205):**
1. **PROHIBITED materials**: Hard fail — any `nopStatus === "PROHIBITED"` returns fail verdict regardless of other conditions.
2. **Raw manure 90/120-day rule** (§205.203): Already implemented in `day-rule-calc.ts`. Calls `checkManureDayRule()` when `material.category === "FERTILIZER"` and application context has `isComposted: false` + harvest date.
3. **Seed treatment prohibition** (§205.204): Seeds must be organic or untreated non-organic if organic unavailable. If `seedLot.isOrganic === false && seedLot.isUntreated === false`, flag for commercial availability documentation.
4. **OMRI-listed check**: `material.omriListed` is tracked in schema — can surface as "OMRI Listed" badge alongside NOP status.
5. **RESTRICTED materials**: Show restriction annotation but do not auto-fail — user must confirm compliance condition is met.
**Example:**
```typescript
// src/lib/compile/nop-compliance.ts
export interface NopCheckResult {
  materialId: string;
  materialName: string;
  verdict: "pass" | "fail" | "restricted" | "needs-review";
  reasons: string[];
}

export function checkMaterialCompliance(
  material: { id: string; name: string; nopStatus: string; nopResolved: boolean; omriListed: boolean },
  context?: { applicationDate?: Date; harvestDate?: Date; isComposted?: boolean; cropContactsSoil?: boolean }
): NopCheckResult {
  if (!material.nopResolved) {
    return { materialId: material.id, materialName: material.name, verdict: "needs-review", reasons: ["NOP status not yet assigned"] };
  }
  if (material.nopStatus === "PROHIBITED") {
    return { materialId: material.id, materialName: material.name, verdict: "fail", reasons: ["Material is PROHIBITED under NOP"] };
  }
  if (material.nopStatus === "RESTRICTED" && context?.applicationDate && context?.harvestDate) {
    const dayRule = checkManureDayRule(context.applicationDate, context.harvestDate, context.isComposted ?? false, context.cropContactsSoil ?? true);
    if (!dayRule.isCompliant) {
      return { materialId: material.id, materialName: material.name, verdict: "fail", reasons: [dayRule.warning ?? "Day rule violation"] };
    }
    return { materialId: material.id, materialName: material.name, verdict: "restricted", reasons: ["Restricted — verify condition is met"] };
  }
  return { materialId: material.id, materialName: material.name, verdict: "pass", reasons: [] };
}
```

### Pattern 6: Unresolved Materials UI
**What:** A panel (or section) on the compile page listing all `Material` records with `nopResolved === false`. User selects NOP status from a dropdown, clicks Save. A single PATCH to `/api/materials/[id]` sets `{ nopStatus: value, nopResolved: true }`.
**Implementation:** Uses existing `/api/materials/[id]` route (already exists — `PUT /api/materials/[id]`). The compile page section fetches `GET /api/materials?farmId=X` filtered client-side to `nopResolved === false`. No new API endpoints needed.
**Key constraint:** NOP compliance indicators appear ONLY after `nopResolved: true`. Before that, the UI shows "needs review" — not a verdict.

### Pattern 7: Data Source Badges
**What:** `MaterialUsage.dataSource` and `SeedUsage.dataSource` use the existing `DataSource` enum (`MANUAL | SYNCED`). The compile routes set `dataSource: "SYNCED"` on all compiled records. The compile page renders a small badge showing the origin. The schema does NOT yet carry `dataSource` on `MaterialUsage` — the migration must add it.
**Source attribution taxonomy:**
- `"SYNCED"` from farm-budget → badge: "farm-budget"
- `"SYNCED"` from grain-tickets → badge: "grain-tickets" (Phase 18)
- `"SYNCED"` from Case IH → badge: "Case IH" (existing FieldOperation.plannedSource)
- `"MANUAL"` → badge: "manual"
**For Phase 17 specifically:** all compiled MaterialUsage and SeedUsage records carry `dataSource: "SYNCED"`, rendered as "farm-budget" badge (since all Phase 17 compiled data originates from farm-budget). A `compiledFrom String?` field could store the exact source name, but given zero-new-packages constraint and simplicity, this is optional — the SYNCED badge is sufficient to distinguish from manual entry.

### Anti-Patterns to Avoid
- **Never overwrite user-resolved NOP status on re-compile.** The `upsert.update` block for Material must NOT include `nopStatus` or `nopResolved`. Once a user assigns status, it persists.
- **Never run NOP compliance against unresolved materials.** The rule engine must check `material.nopResolved` first. Returning a verdict for an unresolved material would be misleading.
- **Never use upsert() on MaterialUsage.** It has no unique constraint the compiler can rely on. Use `deleteMany(SYNCED) + createMany` transaction pattern instead.
- **Never assume variety string uniquely identifies a seed across crops.** The same variety name (e.g., "801") can exist for different crops. Always match on `(crop, variety)` together.
- **Never silently drop unmapped products.** If a productName from farm-budget has no matching Material, create an unresolved stub. The unresolved panel shows it to the user.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NOP 90/120-day manure rule | Custom date diff | `checkManureDayRule()` from `day-rule-calc.ts` + `differenceInDays` from date-fns | Already implemented and tested in this codebase |
| Material upsert by compound key | Custom find-then-create | `prisma.material.upsert({ where: { farmId_name: { farmId, name } } })` | Prisma 6 supports compound unique where on `@@unique([farmId, name])` as `farmId_name` key |
| Bulk insert with conflict skip | Loop of individual upserts | `prisma.materialUsage.createMany({ skipDuplicates: true })` in a transaction | PostgreSQL-native, avoids N round trips; confirmed available in Prisma 6 for PostgreSQL |
| Variety matching logic | Fuzzy string search library | Exact `(crop, variety)` string match via `prisma.seedLot.findFirst({ where: { farmId, crop, variety } })` | Real-world organic seed variety names are precise codes ("T1081J", "PS151"); fuzzy matching would create false matches |
| NOP status categories | Custom enum | Use existing `MaterialNopStatus` enum: `APPROVED | RESTRICTED | PROHIBITED | EXEMPT` | Already in schema and used across the codebase |

**Key insight:** The hardest part is NOT the compliance rules — NOP rules are simple boolean checks against status fields. The hardest part is the upsert lifecycle: creating unresolved Material stubs on first compile, preserving user resolution across subsequent compiles, and using the right transaction pattern for MaterialUsage (which lacks a unique constraint).

---

## Common Pitfalls

### Pitfall 1: Overwriting User-Resolved NOP Status on Re-compile
**What goes wrong:** The `upsert.update` block for Material includes `nopStatus` or `nopResolved`, resetting user assignments every time compile runs.
**Why it happens:** Template code sets the same fields in both `create` and `update` blocks.
**How to avoid:** The `update` block for Material upsert must be an empty object `{}` (or only update non-NOP fields like `notes`). Only `create` sets `nopResolved: false`.
**Warning signs:** User assigns NOP status → clicks Compile again → status resets to APPROVED/unresolved.

### Pitfall 2: Duplicate MaterialUsage on Multiple Compiles
**What goes wrong:** Each compile appends new MaterialUsage rows instead of replacing them, resulting in N copies after N compiles.
**Why it happens:** `MaterialUsage` has no unique constraint, so naive `createMany` creates duplicates. Using `skipDuplicates` without first deleting stale records still accumulates.
**How to avoid:** Use `deleteMany({ where: { fieldEnterpriseId: { in: ids }, dataSource: "SYNCED" } })` before `createMany` — inside a transaction. This atomically replaces compiled records without touching `MANUAL` entries.
**Warning signs:** Compliance report shows 2x or 3x the expected application totals.

### Pitfall 3: Compound Unique Key Naming in Prisma for Material
**What goes wrong:** Attempting `prisma.material.upsert({ where: { farmId_name: ... } })` fails because the compound key name is wrong.
**Why it happens:** Prisma derives the compound unique key name from the field names listed in `@@unique([farmId, name])` joined with underscores. The exact key is `farmId_name`.
**How to avoid:** Verify the derived key name matches before coding. If in doubt, check Prisma generated client types at `src/generated/prisma/models/Material.ts`.
**Warning signs:** TypeScript error on the `where` field of the upsert call.

### Pitfall 4: SeedLot Has No Unique Constraint — Cannot Use upsert()
**What goes wrong:** Attempting `prisma.seedLot.upsert()` fails because SeedLot has no `@@unique` constraint to match on.
**Why it happens:** The schema was designed without a unique constraint on `(farmId, crop, variety)`.
**How to avoid:** Use `findFirst({ where: { farmId, crop, variety } })` → if null, create; if exists, optionally update. Or add `@@unique([farmId, crop, variety])` via a migration in Plan 01 to enable standard upsert pattern. Adding the unique constraint is the cleaner solution and enables idempotent compiles.
**Warning signs:** TypeScript error or runtime P2002 when attempting SeedLot upsert.

### Pitfall 5: Variety String Mismatch Between Field and Seeds Master List
**What goes wrong:** `field.seed.variety = "CANNING"` has no match in `data.seeds[].variety`, so SeedLot stubs are created with no brand/supplier information.
**Why it happens:** Some varieties are farm-saved seed or legacy names not in the seeds master list (confirmed: 2 of 12 organic fields have unmatched varieties).
**How to avoid:** The seed mapper must handle `masterSeed === undefined` gracefully — create SeedLot with variety + crop from field data, leave brand/supplier null. Do not fail the entire compile.
**Warning signs:** SeedLot records with null brand for fields expected to have brand information.

### Pitfall 6: Phase 16 FieldEnterprise Records May Not Exist Yet
**What goes wrong:** Input mapper tries to create MaterialUsage records linked to `fieldEnterpriseId`, but Phase 16 compile has not been committed yet — no FieldEnterprise records exist for the current year.
**Why it happens:** Phase 17 depends on Phase 16 (compile page infrastructure), but users may try to compile inputs before committing enterprises.
**How to avoid:** The POST `/api/compile/[year]/inputs` route must check for at least one FieldEnterprise for the target year+farmId before proceeding. Return a clear error: "Compile enterprises first (Phase 16) before compiling inputs."
**Warning signs:** Foreign key constraint violation on `MaterialUsage.fieldEnterpriseId`.

---

## Code Examples

Verified patterns from official sources and this codebase:

### Material Upsert by Compound Unique (Prisma 6, PostgreSQL)
```typescript
// Source: Prisma docs (prisma.io/docs/orm/prisma-client/queries/crud) + schema.prisma @@unique([farmId, name])
const material = await prisma.material.upsert({
  where: {
    farmId_name: { farmId, name: budgetProductName },
  },
  create: {
    farmId,
    name: budgetProductName,
    nopStatus: "APPROVED",      // placeholder — user must resolve
    nopResolved: false,          // NEW FIELD: added in Phase 17 migration
    category: inferCategory(budgetProductName),
    notes: "Compiled from farm-budget — assign NOP status",
  },
  update: {
    // Intentionally empty: do not overwrite user-assigned NOP status or resolved flag
    // Only update non-user-owned fields if needed (e.g., manufacturerName from products API)
  },
});
```

### MaterialUsage Transactional Replace Pattern
```typescript
// Source: Prisma docs (createMany + deleteMany in $transaction)
await prisma.$transaction(async (tx) => {
  // Step 1: Remove all previously compiled applications for these enterprises
  await tx.materialUsage.deleteMany({
    where: {
      fieldEnterpriseId: { in: targetEnterpriseIds },
      dataSource: "SYNCED",   // only compiled records; MANUAL entries untouched
    },
  });
  // Step 2: Insert fresh compiled applications
  await tx.materialUsage.createMany({
    data: compiledUsages.map((u) => ({
      materialId: u.materialId,
      fieldEnterpriseId: u.fieldEnterpriseId,
      applicationDate: u.applicationDate,
      rate: u.rate,
      rateUnit: u.rateUnit,
      acres: u.acres,
      dataSource: "SYNCED",   // NEW FIELD: added in Phase 17 migration
      notes: `Compiled from farm-budget season:${u.season}`,
    })),
    skipDuplicates: true,     // PostgreSQL-native; safe belt-and-suspenders
  });
});
```

### NOP Compliance Check (calling existing day-rule-calc.ts)
```typescript
// Source: organic-cert/src/lib/day-rule-calc.ts (existing)
import { checkManureDayRule } from "@/lib/day-rule-calc";

function checkCompliance(
  material: { nopStatus: string; nopResolved: boolean; category: string },
  context?: { applicationDate: Date; harvestDate: Date; isComposted: boolean }
): { verdict: "pass" | "fail" | "restricted" | "needs-review"; reason: string | null } {
  if (!material.nopResolved) {
    return { verdict: "needs-review", reason: "NOP status not yet assigned by farm manager" };
  }
  if (material.nopStatus === "PROHIBITED") {
    return { verdict: "fail", reason: "Material is PROHIBITED under NOP (7 CFR 205.601/602)" };
  }
  if (material.nopStatus === "RESTRICTED" && context && material.category === "FERTILIZER") {
    const rule = checkManureDayRule(
      context.applicationDate,
      context.harvestDate,
      context.isComposted,
      true // grain crops contact soil
    );
    if (!rule.isCompliant) return { verdict: "fail", reason: rule.warning };
    return { verdict: "restricted", reason: "Restricted — condition verified" };
  }
  return { verdict: "pass", reason: null };
}
```

### SeedLot findFirst + create-if-missing Pattern
```typescript
// Source: Prisma docs (findFirst + conditional create) + schema.prisma SeedLot model
async function findOrCreateSeedLot(
  farmId: string,
  crop: string,
  variety: string,
  masterSeed: { brand?: string; supplier?: string } | null
): Promise<string> {  // returns SeedLot.id
  const existing = await prisma.seedLot.findFirst({
    where: { farmId, crop, variety },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.seedLot.create({
    data: {
      farmId,
      crop,
      variety,
      brand: masterSeed?.brand ?? null,
      supplier: masterSeed?.supplier ?? null,
      isOrganic: true,     // assume organic until user corrects
      isUntreated: true,   // assume untreated — user corrects if treated
      commercialAvailDoc: false,
      notes: "Compiled from farm-budget",
    },
    select: { id: true },
  });
  return created.id;
}
```

### Budget Client Extension: getBudgetProducts()
```typescript
// Extends organic-cert/src/lib/ecosystem/budget-client.ts
// Pattern: same fetchWithTimeout helper used by existing functions

export interface BudgetProduct {
  id: string;
  name: string;
  unit: string;
  applicationPrice: number;
  supplierId: string;
}

export async function getBudgetProducts(): Promise<BudgetProduct[]> {
  const res = await fetchWithTimeout(
    `${BUDGET_URL}/api/products`,
    "farm-budget",
    FRIENDLY,
    FIX
  );
  if (!res.ok) throw new EcosystemError("farm-budget", `HTTP ${res.status}`, "farm-budget error", FRIENDLY, FIX);
  return res.json();
}

// getBudgetFieldsWithInputs() fetches /api/fields?all=true
// farm-budget.field.inputs[] is already part of the full field object returned
// (confirmed: Blue's field returns full inputs[] in /api/fields response)
```

### Schema Migration Fields Needed
```prisma
// Additions to schema.prisma — added via Prisma migration in Plan 01

model Material {
  // ... existing fields ...
  nopResolved      Boolean   @default(false)  // NEW: true = user has assigned NOP status
  budgetProductId  String?                    // NEW: farm-budget product id for source tracking (optional)
}

model MaterialUsage {
  // ... existing fields ...
  dataSource  DataSource  @default(MANUAL)    // NEW: SYNCED = compiled, MANUAL = hand-entered
}

model SeedUsage {
  // ... existing fields ...
  dataSource  DataSource  @default(MANUAL)    // NEW: SYNCED = compiled, MANUAL = hand-entered
}

model SeedLot {
  // ... existing fields ...
  @@unique([farmId, crop, variety])  // NEW: enables upsert instead of findFirst+create
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual material entry in organic-cert | Compile from farm-budget via HTTP | Phase 17 | Eliminates double-entry of 55+ organic input applications |
| NOP compliance run against all materials | NOP rules run only after user resolution | Phase 17 design | Prevents misleading verdicts on unreviewed materials |
| DataSource enum on FieldOperation only | DataSource on MaterialUsage + SeedUsage too | Phase 17 migration | Enables source badge display on all compiled records |
| SeedLot without unique constraint | SeedLot with `@@unique([farmId, crop, variety])` | Phase 17 migration | Enables idempotent upsert pattern for seed compilation |

**Deprecated/outdated:**
- Manual re-entry of farm-budget inputs into organic-cert materials: replaced by compile engine

---

## Open Questions

1. **Should `nopResolved` field use a separate `ProductNopMapping` table or a column on `Material`?**
   - What we know: There are 14 unique organic input product names in the current dataset; the set is small and per-farm.
   - What's unclear: Whether the mapping should be keyed on farm-budget product name (stable) or organic-cert Material.id (which could change if Material is deleted).
   - Recommendation: Column on Material (`nopResolved Boolean + nopStatus`) is sufficient. Key the user resolution to `Material.name` which is `@@unique([farmId, name])` — stable, deduped. If Material is deleted and recompiled, it just becomes unresolved again (correct behavior).

2. **What applicationDate to use for MaterialUsage when farm-budget only has `season` (Spring/Fall), not a specific date?**
   - What we know: `field.inputs[].season` is either `"Spring"` or `"Fall"` — no date field in farm-budget inputs.
   - What's unclear: Whether the NOP compliance 90/120-day rule requires a specific date (it does — `differenceInDays` needs an actual date).
   - Recommendation: Use a synthetic date derived from season + cropYear: Spring = `${year}-04-01`, Fall = `${year - 1}-10-15`. Flag manure-category materials as "date estimated — verify" in the compliance output. Store `notes: "Date estimated from season: Spring"` on MaterialUsage.

3. **Does Phase 16's compile page need to be modified to add the inputs/seeds compile buttons?**
   - What we know: Phase 15 compile page has placeholder sections for "inputs (Phase 17)" and "seeds (Phase 17)". Phase 16 plan rebuilds the full compile page.
   - What's unclear: Exactly what compile page state Phase 16 delivers — whether inputs/seeds sections are interactive or still placeholders.
   - Recommendation: Phase 17 Plan 02 extends the compile page regardless. Plan it defensively: import the page, find the placeholder sections, replace with functional compile buttons. Don't assume Phase 16 left them wired.

4. **How granular should the inputs compile route be?**
   - What we know: There are 55 input applications across 12 organic fields, across 14 unique products.
   - What's unclear: Whether to compile all organic fields at once or field-by-field.
   - Recommendation: POST `/api/compile/[year]/inputs` compiles all organic FieldEnterprise records for the year in one transaction. Field-by-field is unnecessarily granular for this dataset size.

---

## Key NOP Compliance Reference (Verified)

These rules are confirmed from 7 CFR Part 205 (via law.cornell.edu) and are the ones relevant to Phase 17:

| Rule | Source | What It Means for Phase 17 |
|------|--------|---------------------------|
| Nonsynthetic materials generally allowed | §205.105 | Default assumption for APPROVED materials |
| Synthetic materials generally prohibited (with exceptions in §205.601) | §205.105 | PROHIBITED status = hard fail in compliance engine |
| Raw manure: 90 days if crop doesn't contact soil, 120 days if it does | §205.203 | RESTRICTED fertilizers get date-based check via existing `day-rule-calc.ts` |
| Organic seed preferred; untreated non-organic allowed if organic unavailable | §205.204 | `SeedLot.isOrganic + isUntreated` — flag if non-organic AND treated |
| OMRI Listed products meet NOP standards | OMRI process | `Material.omriListed` badge — informational, not determinative on its own |
| Synthetic substances allowed in §205.601 list | §205.601 | The "restricted" category — these need condition verification |

---

## Sources

### Primary (HIGH confidence)
- Prisma documentation (prisma.io/docs/orm/prisma-client/queries/crud) — upsert, createMany with skipDuplicates, compound unique where clause syntax
- law.cornell.edu/cfr/text/7/205.105 — NOP general prohibition rule (synthetic vs. nonsynthetic)
- law.cornell.edu/cfr/text/7/205.204 — Seed practice standard: organic seed preference, exceptions for untreated non-organic
- `organic-cert/prisma/schema.prisma` — actual model definitions, confirmed fields and constraints
- `organic-cert/src/lib/day-rule-calc.ts` — existing 90/120-day manure rule implementation
- `farm-budget/data/data.json` — confirmed actual data shapes: 12 organic fields, 55 input applications, 14 unique product names, seed variety matching (9/12 matched, 2/12 CANNING unmatched)
- `organic-cert/src/lib/ecosystem/budget-client.ts` — confirmed `fetchWithTimeout` pattern and BUDGET_URL resolution

### Secondary (MEDIUM confidence)
- eCFR / OMRI FAQ (omri.org) — OMRI Allowed / Allowed with Restrictions / Prohibited category definitions
- Federal Register (federalregister.gov/documents/2024/08/08/2024-17378) — 2025 Sunset Review showing §205.601 list is current
- WebSearch: Prisma 6 compound unique where clause (`farmId_name` key format) — verified against official Prisma docs
- WebSearch: Next.js 16 / React 19 API Route Handlers vs Server Actions — confirmed Route Handlers are correct pattern for compile endpoints

### Tertiary (LOW confidence)
- Specific NOP §205.601 synthetic materials list (full enumeration not retrieved — API access to eCFR was blocked by redirect). The list is long but the project only needs: does a material have user-assigned APPROVED/RESTRICTED/PROHIBITED status? The rule engine does not need to enumerate the full list — that is the human certifier's job. The implementation is correct as designed.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed; patterns are verified in existing codebase
- Architecture: HIGH — data shapes confirmed from actual farm-budget data.json; schema constraints confirmed from schema.prisma
- NOP compliance rules: MEDIUM — rules confirmed from official CFR text; the full §205.601 synthetic list was not retrieved (blocked redirect), but this is not needed for the rule engine design
- Pitfalls: HIGH — all pitfalls are based on confirmed schema constraints (no @@unique on MaterialUsage, no @@unique on SeedLot, existing nopStatus default is APPROVED not unresolved)

**Research date:** 2026-03-02
**Valid until:** 2026-06-02 (stable — NOP regulations change infrequently; Prisma 6 API is stable)
