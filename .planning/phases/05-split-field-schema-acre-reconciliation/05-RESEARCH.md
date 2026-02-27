# Phase 5: Split-Field Schema & Acre Reconciliation - Research

**Researched:** 2026-02-27
**Domain:** Prisma schema evolution, PostgreSQL unique-constraint changes, Next.js API validation, TypeScript type propagation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Enterprise Identity**
- Crop is the primary identifier — "Kopps - Corn 2026", "Kopps - Soybeans 2026"
- Variety distinguishes same-crop enterprises (e.g., Pioneer P63ME80 vs DeKalb DKC64-34), but variety is optional and often filled in after planting
- Freeform label (optional) needed only when the same crop appears twice on a field — user types something like "Corn - North" or "Corn 2" to distinguish
- Single-enterprise fields don't need any label — they work exactly as today
- Uniqueness: [fieldId, cropYear, crop, label] where label defaults to null for single-crop fields

**Acre Validation**
- Over-allocation (enterprise sum > field total): yellow warning but allow save — FSA acres don't always match reality, rounding happens
- Under-allocation (enterprise sum < field total): show "X ac unallocated" as informational text on the field, not a forced fallow enterprise
- Field totalAcres can be updated from the enterprise view if the total was wrong
- Acre utilization display ("120 of 160 ac") only on multi-enterprise fields; single-enterprise fields show total like today

**Fallow/Idle Tracking**
- User creates fallow enterprises manually when they want to track idle land costs
- No auto-creation of fallow enterprises from unallocated acres

### Claude's Discretion
- Fallow enterprise schema fields (cost amount, cost category, notes) — exact field types and naming
- Migration strategy for existing single-enterprise data
- Whether to use a separate `enterpriseType` enum (CROP/FALLOW) or just a special crop value like "Fallow"
- API response shape for acre reconciliation data

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHEMA-01 | A field can have multiple enterprises for the same crop year (remove the current `[fieldId, cropYear, crop]` unique constraint) | Prisma: replace `@@unique([fieldId, cropYear, crop])` with `@@unique([fieldId, cropYear, crop, label])` using `@@unique` with nullable column semantics |
| SCHEMA-02 | Each enterprise has a label or position identifier (e.g., "North 40", "South 80") to distinguish splits within the same field and crop year | Add `label String?` to FieldEnterprise; null = single-enterprise (backward compatible) |
| SCHEMA-03 | An enterprise can be typed as fallow/idle with optional overhead cost fields (cost amount, cost category, notes) | Add `isFallow Boolean @default(false)`, `fallowCostAmount Float?`, `fallowCostCategory String?` — discretion fields |
| SCHEMA-04 | Existing single-enterprise fields continue to work without modification (backward compatible) | Null label + `isFallow false` defaults ensure all existing records remain valid with zero data changes |
| ACRE-01 | Enterprise `plantedAcres` sum validated against field `totalAcres` — warn when sum exceeds total, allow save | Pure API logic in POST/PUT field-enterprises: query siblings, sum, compare to field.totalAcres, return warning field in response |
| ACRE-02 | Field index shows acre utilization ("120 of 160 ac planted") when multiple enterprises exist | Computed in GET /api/fields response; only emitted when enterprise count > 1 for a given field+year |
| ACRE-03 | Fallow/idle acres calculated as field total minus sum of planted enterprise acres | Pure arithmetic: `fallowAcres = field.totalAcres - sum(enterprises.plantedAcres)` — returned in API response, not stored |
</phase_requirements>

---

## Summary

This phase is entirely within the existing Prisma + Next.js API stack — no new libraries needed. The core work is three tightly coupled changes: (1) a Prisma schema edit to `FieldEnterprise` that swaps one unique constraint for another and adds three new optional fields, (2) a `prisma db push` to apply those schema changes to the live database, and (3) validation logic added to the existing `POST /api/field-enterprises` and `PUT /api/field-enterprises/[id]` routes.

The biggest technical risk is the PostgreSQL behavior of unique constraints involving nullable columns. PostgreSQL (and Prisma's mapping of it) treats each `NULL` as distinct for uniqueness purposes. This means `@@unique([fieldId, cropYear, crop, label])` where `label` is `null` allows **multiple** rows with the same `[fieldId, cropYear, crop, null]` — which would break the intended single-enterprise uniqueness guarantee. The correct solution is a **partial unique index** that enforces `[fieldId, cropYear, crop]` uniqueness only when `label IS NULL`, via a raw `@@index` with a Prisma `@@map` or a raw SQL migration. This is the one place where standard Prisma schema DSL is insufficient and raw SQL (or a Prisma `unsupported` extension) is required.

The second area to watch: `lotNumber` is currently generated as `YEAR-CROP-FIELD` and stored as a **globally unique** field (`@unique` on `CropLot.lotNumber`). When a field has two Corn enterprises in the same year, the current generator would produce the same lot number for both. The lot number generator in `lib/lot-generator.ts` must be updated to incorporate the `label` when present.

**Primary recommendation:** Edit schema, push to db, update two API routes (POST + GET for enterprises and fields), update lot-generator to include label suffix — all in the `organic-cert` Next.js app. No new libraries needed.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.19.2 | Schema definition, db push, generated client | Project's existing ORM |
| @prisma/client | 6.19.2 | Runtime DB queries in API routes | Paired with prisma |
| Zod | ^4.3.6 | Request body validation in API routes | Already used in project patterns |
| Next.js App Router | 16.1.6 | API route handlers (`route.ts`) | Established project pattern |
| TypeScript | ^5 | Type safety throughout | Project language |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | Toast notifications | UI warning feedback for over-allocation |
| date-fns | ^4.1.0 | Date formatting | Already used in enterprise detail page |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma db push | prisma migrate dev | migrate dev creates versioned SQL files; project has no migrations/ dir and uses db push — stay consistent |
| `isFallow Boolean` | `enterpriseType enum` | Enum requires more schema ceremony for a binary distinction; boolean is simpler and less ceremony |
| Partial index via raw SQL | Composite unique with application-level check | PostgreSQL native partial index is authoritative; application-level check has race conditions |

**Installation:** No new packages required.

---

## Architecture Patterns

### Existing Project Structure (organic-cert)

```
organic-cert/
├── prisma/
│   ├── schema.prisma        # Single source of truth — edit here
│   └── seed.js              # Needs update to handle new fields
├── src/
│   ├── app/api/
│   │   ├── field-enterprises/
│   │   │   ├── route.ts              # GET list + POST create — needs acre validation
│   │   │   └── [id]/route.ts         # GET single + PUT update — needs acre validation
│   │   └── fields/
│   │       └── route.ts              # GET list — needs acre utilization computation
│   ├── lib/
│   │   ├── lot-generator.ts          # Needs label-suffix support
│   │   └── report-assembler.ts       # May need label in EnterpriseWithOperations type
│   └── generated/prisma/             # Auto-generated — do not edit
```

### Pattern 1: Prisma Schema Edit + db push

**What:** Edit `prisma/schema.prisma` directly, run `npx prisma db push`, then `npx prisma generate` to regenerate the client.

**When to use:** Project has no `prisma/migrations/` directory — confirmed. This is the established pattern.

**Current `@@unique` to change:**
```prisma
// BEFORE (in FieldEnterprise model):
@@unique([fieldId, cropYear, crop])

// AFTER:
@@unique([fieldId, cropYear, crop, label])
```

**Critical caveat:** PostgreSQL treats NULL as distinct in unique constraints. This means `@@unique([fieldId, cropYear, crop, label])` with `label = null` would allow multiple rows with `[fieldId, cropYear, "Corn", null]`. To enforce the intended rule — "only one null-label enterprise per field+year+crop" — a **partial unique index** must be created. Prisma 6.x supports raw index expressions via `@@index` but NOT partial index WHERE clauses in the schema DSL. The correct approach is a SQL-level partial index added via a `prisma db push` workaround or a direct `psql` command after push:

```sql
-- Run after prisma db push
-- Enforces: only one enterprise with label=NULL per (fieldId, cropYear, crop)
CREATE UNIQUE INDEX IF NOT EXISTS "FieldEnterprise_no_label_unique"
  ON "FieldEnterprise"("fieldId", "cropYear", "crop")
  WHERE "label" IS NULL;
```

Source: PostgreSQL partial index documentation (official) — this is standard PostgreSQL behavior, HIGH confidence.

### Pattern 2: API Route Acre Validation

**What:** On POST/PUT to `/api/field-enterprises`, after writing the record, query all sibling enterprises for the same `[fieldId, cropYear]` and compare their acre sum to `field.totalAcres`.

**When to use:** Every enterprise create and update.

**Example:**
```typescript
// After creating/updating the enterprise, compute acre reconciliation
const siblings = await prisma.fieldEnterprise.findMany({
  where: { fieldId: body.fieldId, cropYear: body.cropYear },
  select: { plantedAcres: true },
});
const sumAcres = siblings.reduce((s, e) => s + e.plantedAcres, 0);
const field = await prisma.field.findUnique({
  where: { id: body.fieldId },
  select: { totalAcres: true },
});
const acreWarning =
  field && sumAcres > field.totalAcres
    ? `Planted acres (${sumAcres.toFixed(1)}) exceed field total (${field.totalAcres.toFixed(1)} ac)`
    : null;

return NextResponse.json(
  { ...enterprise, acreWarning },
  { status: 201 }
);
```

**Response shape recommendation (Claude's discretion):**
```typescript
{
  // all existing enterprise fields...
  acreWarning: string | null,     // non-null = over-allocated, show yellow warning
  fallowAcres: number,            // field.totalAcres - sum(planted) — always computed
  totalPlantedAcres: number,      // sum of all sibling planted acres
}
```

### Pattern 3: Lot Number Collision on Split Fields

**What:** The current `generateLotNumber(year, crop, fieldName)` produces `2026-CORN-KOPP`. Two Corn enterprises on Kopps in 2026 would produce identical lot numbers. `CropLot.lotNumber` has a `@unique` constraint that would throw a database error.

**How to fix:** Append the label slug when a label is present:
```typescript
export function generateLotNumber(
  year: number,
  crop: string,
  fieldName: string,
  label?: string | null
): string {
  const base = `${year}-${abbreviateCrop(crop)}-${abbreviateField(fieldName)}`;
  if (!label) return base;
  // Convert label to a safe suffix: "North 40" → "N40", "Corn 2" → "C2"
  const suffix = label.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase();
  return `${base}-${suffix}`;
}
```

### Anti-Patterns to Avoid

- **Storing fallowAcres in the database:** Fallow acres are derived (field.totalAcres - sum). Storing them creates a synchronization problem. Always compute on read.
- **Enforcing uniqueness at application layer only:** Race conditions in concurrent saves. The partial index is the right place.
- **Using `prisma migrate dev` in this project:** The project uses `db push`. Introducing `migrate` would create a migrations/ directory and change the workflow mid-project.
- **Generating the Prisma client manually in source:** `src/generated/prisma/` is auto-generated. Never edit it directly — re-run `npx prisma generate` after schema changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique constraint with nullable column | Application-level duplicate check | PostgreSQL partial unique index | Race conditions in concurrent API calls; DB constraint is atomic |
| Acre math | Custom arithmetic library | Plain JS arithmetic (sum reduce) | No rounding library needed — Float precision sufficient for acres |
| Type regeneration | Manually update `src/generated/` | `npx prisma generate` | Generated client tracks schema exactly |

**Key insight:** All the infrastructure is already in place. This phase is schema + validation logic, not infrastructure.

---

## Common Pitfalls

### Pitfall 1: NULL Uniqueness in PostgreSQL Composite Indexes

**What goes wrong:** Developer adds `label String?` to the schema and changes `@@unique([fieldId, cropYear, crop])` to `@@unique([fieldId, cropYear, crop, label])`, assuming this enforces "one unlabeled enterprise per crop per field-year." It does not. PostgreSQL treats each NULL as non-equal to other NULLs in unique constraints, so multiple rows with `label = null` and the same `[fieldId, cropYear, crop]` will pass the constraint.

**Why it happens:** SQL standard defines NULL != NULL, including for unique index purposes. This is correct SQL behavior but surprising to most developers.

**How to avoid:** After `prisma db push`, apply the partial index in the same task:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS "FieldEnterprise_no_label_unique"
  ON "FieldEnterprise"("fieldId", "cropYear", "crop")
  WHERE "label" IS NULL;
```
Keep the `@@unique([fieldId, cropYear, crop, label])` in schema.prisma for labeled enterprises (multiple NULLs = distinct rows, which is fine since those are single-enterprise fields with no collision risk). The partial index covers the null case.

**Warning signs:** No DB error when creating a second "Corn" enterprise on a field in the same year without a label.

### Pitfall 2: Lot Number Collision on Split Fields

**What goes wrong:** The existing `generateLotNumber` is called with the same arguments for two Corn enterprises on the same field in the same year. Both get `2026-CORN-KOPP`. When a `CropLot` is created for the second enterprise, Prisma throws a unique constraint violation on `CropLot.lotNumber`.

**Why it happens:** The current lot generator doesn't know about sibling enterprises.

**How to avoid:** Pass `label` into `generateLotNumber` and append a suffix. Update all call sites in `route.ts` to forward the label.

**Warning signs:** `PrismaClientKnownRequestError` with code `P2002` (unique constraint violation) on `CropLot.lotNumber`.

### Pitfall 3: Prisma Client Cache After Schema Change

**What goes wrong:** Developer edits `schema.prisma`, runs `prisma db push` but forgets `prisma generate`. TypeScript type errors disappear in IDE but runtime throws `Unknown field 'label'` because the client is stale.

**Why it happens:** `prisma db push` syncs the DB schema but the generated client in `src/generated/prisma/` is only updated by `prisma generate`.

**How to avoid:** Always run `npx prisma db push && npx prisma generate` as a single command. Restart the Next.js dev server after.

**Warning signs:** IDE shows correct types but runtime API calls fail on the new fields.

### Pitfall 4: report-assembler.ts Type Gap

**What goes wrong:** `EnterpriseWithOperations` interface in `lib/report-assembler.ts` doesn't include `label`, `isFallow`, or fallow cost fields. Report generation fails at TypeScript compile time after schema change.

**Why it happens:** The assembler type definitions are hand-written interfaces, not auto-derived from Prisma types.

**How to avoid:** Update `EnterpriseWithOperations` to include the new optional fields in the same task as the schema change. The report rendering (Phase 7) will use them, but the type must be forward-compatible now.

**Warning signs:** TypeScript error `Property 'label' does not exist on type 'EnterpriseWithOperations'` when Phase 7 work begins.

### Pitfall 5: Acre Validation Query Performance

**What goes wrong:** On every enterprise save, the API queries all siblings and the field — adding 2 DB queries per write. On a large operation import (batch), this degrades performance.

**Why it happens:** Acre reconciliation is computed per-write, not cached.

**How to avoid:** For Phase 5 scope, the overhead is acceptable (farmers don't create enterprises in batch). Use `Promise.all([siblingsQuery, fieldQuery])` to parallelize the two lookups. No caching needed for this phase.

---

## Code Examples

Verified patterns from project source and Prisma 6.x docs:

### Schema Change: FieldEnterprise (schema.prisma)

```prisma
model FieldEnterprise {
  id            String        @id @default(cuid())
  fieldId       String
  field         Field         @relation(fields: [fieldId], references: [id])
  cropYear      Int
  crop          String
  label         String?       // "North 40", "Corn 2" — null for single enterprises
  isFallow      Boolean       @default(false)
  fallowCostAmount   Float?   // optional overhead cost for idle land
  fallowCostCategory String?  // "Overhead", "Land Rent", "Insurance", etc.
  variety       String?
  plantedAcres  Float
  lotNumber     String?       // auto: "2024-SRWW-KOPP", "2024-CORN-KOPP-N40"
  organicStatus OrganicStatus @default(ORGANIC)
  locked        Boolean       @default(false)
  notes         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // ... relations unchanged ...

  // Labeled enterprises: label values are distinct so standard composite unique works
  @@unique([fieldId, cropYear, crop, label])
  // Unlabeled enterprises: partial index handles null case (applied via raw SQL after db push)
}
```

### GET /api/fields — Acre Utilization Addition

```typescript
// In the fieldsWithStats map, add acre utilization for multi-enterprise fields:
const currentYearEnterprises = enterprises.filter(
  (e) => e.cropYear === new Date().getFullYear()
);
const totalPlantedAcres = currentYearEnterprises.reduce(
  (s, e) => s + e.plantedAcres, 0
);
const hasMultipleEnterprises = currentYearEnterprises.length > 1;
const fallowAcres = hasMultipleEnterprises
  ? Math.max(0, fieldData.totalAcres - totalPlantedAcres)
  : null;

return {
  ...fieldData,
  enterprises,
  lastActivityDate,
  totalRecords,
  // New: only present when field has multiple enterprises
  acreUtilization: hasMultipleEnterprises
    ? {
        planted: totalPlantedAcres,
        total: fieldData.totalAcres,
        fallow: fallowAcres,
        isOverAllocated: totalPlantedAcres > fieldData.totalAcres,
      }
    : null,
};
```

### POST /api/field-enterprises — Validation + Warning

```typescript
// After creating the enterprise:
const [siblings, field] = await Promise.all([
  prisma.fieldEnterprise.findMany({
    where: { fieldId: body.fieldId, cropYear: body.cropYear },
    select: { plantedAcres: true },
  }),
  prisma.field.findUnique({
    where: { id: body.fieldId },
    select: { totalAcres: true },
  }),
]);

const totalPlanted = siblings.reduce((s, e) => s + e.plantedAcres, 0);
const acreWarning =
  field && totalPlanted > field.totalAcres
    ? `Planted acres (${totalPlanted.toFixed(1)}) exceed field total (${field.totalAcres.toFixed(1)} ac)`
    : null;

return NextResponse.json(
  {
    ...enterprise,
    acreWarning,
    acreReconciliation: {
      totalPlanted,
      fieldTotal: field?.totalAcres ?? null,
      fallowAcres: field ? Math.max(0, field.totalAcres - totalPlanted) : null,
      isOverAllocated: field ? totalPlanted > field.totalAcres : false,
    },
  },
  { status: 201 }
);
```

### Partial Index SQL (run after db push)

```sql
-- Enforces: at most one enterprise with label=NULL per (fieldId, cropYear, crop)
-- This prevents duplicate unlabeled enterprises on the same field+year+crop
CREATE UNIQUE INDEX IF NOT EXISTS "FieldEnterprise_no_label_unique"
  ON "FieldEnterprise"("fieldId", "cropYear", "crop")
  WHERE "label" IS NULL;
```

### Updated Lot Generator

```typescript
export function generateLotNumber(
  year: number,
  crop: string,
  fieldName: string,
  label?: string | null
): string {
  const base = `${year}-${abbreviateCrop(crop)}-${abbreviateField(fieldName)}`;
  if (!label) return base;
  const suffix = label.replace(/[^a-zA-Z0-9]/g, "").substring(0, 4).toUpperCase();
  return `${base}-${suffix}`;
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@@unique([fieldId, cropYear, crop])` | `@@unique([fieldId, cropYear, crop, label])` + partial index for null case | Allows multiple enterprises per field-year while maintaining intended constraints |
| Single FieldEnterprise per field-year | Multiple FieldEnterprise records per field-year with optional label | Foundation for all split-field features (Views, Reports in Phases 6-7) |
| Lot number: `YEAR-CROP-FIELD` | Lot number: `YEAR-CROP-FIELD[-LABEL]` when label present | Avoids `CropLot.lotNumber` unique constraint violations |

**Deprecated/outdated after this phase:**
- `@@unique([fieldId, cropYear, crop])` — replaced by composite with label + partial index
- Lot generator signature `generateLotNumber(year, crop, fieldName)` — gains optional `label` parameter

---

## Open Questions

1. **Fallow `plantedAcres` handling**
   - What we know: Fallow enterprises have costs but no planted crop. `plantedAcres` is non-nullable on `FieldEnterprise`.
   - What's unclear: Should fallow enterprises have `plantedAcres = 0`? Or should we store the fallow acreage there to aid the unallocated-acres calculation?
   - Recommendation: Store the intended fallow acreage in `plantedAcres` for fallow enterprises — "0 planted, but this acreage is allocated." This keeps the acre reconciliation math consistent: `sum(enterprises.plantedAcres) = total allocated`. Mark fallow via `isFallow = true`. Confirm with user if needed, otherwise proceed with this approach.

2. **Uniqueness when label is present — labeled duplicate crops**
   - What we know: Two "Corn - North" enterprises on the same field in the same year would still collide on `@@unique([fieldId, cropYear, crop, label])`.
   - What's unclear: Is this the intended behavior (yes — label must be unique per field-year-crop group)?
   - Recommendation: Yes, this is correct behavior and what the user described. The uniqueness constraint prevents accidental duplication of labeled enterprises.

3. **`report-assembler.ts` — label exposure timing**
   - What we know: Phase 5 is data-only. PDF changes are Phase 7. But `EnterpriseWithOperations` type is defined in `report-assembler.ts`.
   - What's unclear: Should `label` be added to `EnterpriseWithOperations` in Phase 5 or Phase 7?
   - Recommendation: Add `label: string | null` to `EnterpriseWithOperations` in Phase 5 (forward-compatible, zero cost). Phase 7 will use it without a breaking change.

---

## Detailed Task Breakdown Guidance (for Planner)

This phase should decompose into the following logical waves:

**Wave 1 — Schema (must be first, everything depends on it):**
- Edit `schema.prisma`: add `label`, `isFallow`, `fallowCostAmount`, `fallowCostCategory` fields; swap unique constraint
- Run `prisma db push` — applies schema to database
- Run `prisma generate` — regenerates TypeScript client
- Apply partial index SQL (`CREATE UNIQUE INDEX ... WHERE label IS NULL`)
- Verify: existing seed data loads without errors; all existing enterprises have `label = null`, `isFallow = false`

**Wave 2 — API Validation Logic (requires Wave 1):**
- Update `POST /api/field-enterprises`: require validation of label uniqueness server-side; compute and return `acreWarning` + `acreReconciliation`
- Update `PUT /api/field-enterprises/[id]`: same acre reconciliation on update
- Update lot-generator: add optional `label` parameter; update `POST` route call site
- Update `GET /api/fields`: add `acreUtilization` to response when `enterpriseCount > 1` for a cropYear

**Wave 3 — Type Cleanup (requires Wave 1):**
- Update `EnterpriseWithOperations` in `report-assembler.ts` to include `label`, `isFallow` optional fields
- Update hand-written TypeScript interfaces in `field-enterprises/page.tsx` and `[id]/page.tsx` to reflect new fields
- Verify TypeScript build passes (`npx tsc --noEmit`)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `organic-cert/prisma/schema.prisma` — current FieldEnterprise model confirmed
- Direct codebase read — `organic-cert/src/app/api/field-enterprises/route.ts` — POST/GET patterns confirmed
- Direct codebase read — `organic-cert/src/app/api/fields/route.ts` — GET fields with enterprise stats pattern confirmed
- Direct codebase read — `organic-cert/src/lib/lot-generator.ts` — lot number generation confirmed
- Direct codebase read — `organic-cert/src/lib/report-assembler.ts` — EnterpriseWithOperations type confirmed
- Direct codebase read — `organic-cert/package.json` — Prisma 6.19.2, Next.js 16.1.6, Zod 4.x confirmed
- Direct codebase read — `organic-cert/prisma/schema.prisma` — no migrations/ dir, db push workflow confirmed
- PostgreSQL documentation — NULL uniqueness in composite indexes is standard documented behavior (HIGH confidence, fundamental SQL standard)

### Secondary (MEDIUM confidence)
- Prisma 6.x docs (training knowledge, confirmed by version in package.json) — `prisma db push` workflow, `@@unique` DSL, partial index limitation in Prisma schema DSL

### Tertiary (LOW confidence)
- None — all findings are from direct codebase inspection or authoritative SQL behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and direct file reads
- Architecture patterns: HIGH — all patterns observed directly in existing API routes
- Pitfalls: HIGH — NULL uniqueness is documented PostgreSQL behavior; lot collision is directly verifiable from code; others derived from direct codebase inspection
- Open questions: LOW confidence on fallow plantedAcres semantics — needs confirmation or planner decision

**Research date:** 2026-02-27
**Valid until:** 2026-03-30 (stable stack — Prisma, Next.js, PostgreSQL all stable APIs)
