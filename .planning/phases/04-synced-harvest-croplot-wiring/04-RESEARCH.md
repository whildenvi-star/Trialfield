# Phase 4: Synced Harvest CropLot Wiring — Research

**Researched:** 2026-02-26
**Domain:** Prisma transaction wiring, yield-unit conversion, CropLot generation, report assembler integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lot Number Generation**
- Same format as manual harvests: `YEAR-CROP-FIELDABBREV` (e.g., 2024-SRWW-KOPP)
- No sync prefix or origin indicator — a lot number is a lot number
- Field abbreviation derived from Field.name (first 4–6 chars, uppercase)
- If a CropLot already exists for the FieldEnterprise, accumulate into it (don't create a second lot)
- CropLot.quantityLbs auto-sums all linked HarvestEvent net weights — always computed, never manual

**Approve Flow Behavior**
- CropLot creation happens in the same Prisma transaction as HarvestEvent creation — atomic, no orphaned harvests
- Batch approval supported — select multiple staged ops, approve all at once
- Partial-field harvests (acresHarvested < plantedAcres) create/update CropLot regardless — no special handling
- After batch approval, show a summary toast/banner: "3 HarvestEvents approved, 2 new CropLots created, 1 existing CropLot updated"
- Approval blocked if no FieldEnterprise exists for the staged op's crop+year — user must create the enterprise first

**Report Display for Synced Data**
- Synced harvests look identical to manual harvests in the PDF — no origin indicator
- Missing data (moisture %, test weight) shows as dashes (—) in report columns
- Mass balance sums ALL harvested lbs per crop regardless of source — one interchangeable total
- Convert Case IH yield from bushels/acre to lbs at approval time using standard test weights (corn 56 lb/bu, wheat 60 lb/bu, soybeans 60 lb/bu)

**Edge Cases & Conflicts**
- Manual and synced HarvestEvents for the same FieldEnterprise are both valid — accumulate into the same CropLot
- Re-sync bringing already-approved operations: skip silently (existing dedup by fieldopsExternalId)
- Unmatched staged ops (no field mapping): show in review queue but disable the approve button with "No field mapping" indicator

### Claude's Discretion
- Exact field abbreviation algorithm (how to truncate/abbreviate field names for lot numbers)
- Toast/banner component choice and styling
- How to display the "blocked — no enterprise" state in the approve UI
- Transaction rollback behavior on partial batch failures

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIELD-06 | System auto-generates lot numbers for harvest records (cropYear-crop-fieldName) | `generateLotNumber()` utility in `src/lib/lot-generator.ts` already exists and is fully functional — needs to be called in the approve flow |
| RPT-03 | Report includes input application log and harvest log with lot numbers | `HarvestLog` PDF section at `src/lib/pdf/sections/harvest-log.tsx` already renders `harvest.lotNumber ?? "—"` — gap is that SYNCED HarvestEvents currently have no CropLot, so `lotNumber` is always `null` for them |
| RPT-04 | Report includes mass balance summary (harvested vs. sold per crop/lot) | `MassBalance` PDF section at `src/lib/pdf/sections/mass-balance.tsx` already renders from `massBalance` data — gap is SYNCED CropLots are never created so they don't appear in `massBalance` |
</phase_requirements>

---

## Summary

Phase 4 is a pure backend wiring phase. The UI, PDF renderer, lot-number generator, and report assembler are all finished. The gap is that the approve handler in `src/app/api/admin/staged-ops/[id]/route.ts` creates a `HarvestEvent` but never creates a `CropLot` — so SYNCED harvests are invisible to every downstream consumer (report assembler, harvest log, mass balance).

The fix is tightly scoped: wrap `HarvestEvent.create` + `CropLot.create/update` in a single Prisma transaction, convert Case IH bushel yields to lbs at that boundary, and update the bulk-approve summary toast. No new pages, no new Prisma models, no PDF changes — just wiring the missing link.

The critical implementation constraint is that CropLot accumulation semantics differ from the manual path. The manual harvest route creates one CropLot per HarvestEvent (with suffix -2, -3…). The user decision for synced harvests is: if a CropLot already exists for the FieldEnterprise, update `quantityLbs` by adding the new harvest's net weight — do NOT create a second CropLot. This is a behavior change from the manual path and must be implemented carefully to avoid breaking existing manual lot behavior.

**Primary recommendation:** Refactor the harvest-side of the approve handler (`[id]/route.ts`) to run a Prisma `$transaction` that creates the HarvestEvent, then either creates or updates the CropLot for the enterprise. Extract the bu→lbs conversion into a small shared utility. Update the bulk-approve toast to report new vs. updated CropLots.

---

## Standard Stack

### Core (already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | ^6.19.2 | ORM, transaction API | Already in project; `$transaction` is the correct atomic primitive |
| Next.js API Routes | 16.1.6 | Server-side approve endpoint | Existing route at `[id]/route.ts` — modify in place |
| sonner | ^2.0.7 | Toast notifications | Already used in review/page.tsx for approve/reject feedback |
| TypeScript | ^5 | Type safety across conversion utilities | Existing project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@prisma/client` `$transaction` | ^6.19.2 | Atomic HarvestEvent + CropLot write | Always for the approve path — never split across separate awaits |
| `date-fns` | ^4.1.0 | Date formatting in toast summary (if needed) | Already used in review page |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma `$transaction([...])` | Sequential `await` calls | Sequential calls risk orphaned HarvestEvents if CropLot creation fails — violates atomicity requirement |
| Accumulate CropLot.quantityLbs directly | Re-compute from all HarvestEvents | Re-computing from all events is more correct but adds a query; direct increment is simpler and correct given CropLot has one-to-many HarvestEvents |

**Installation:** No new packages required.

---

## Architecture Patterns

### Where the Gap Lives

```
src/
├── app/api/admin/staged-ops/
│   └── [id]/route.ts           # <-- MODIFY: add CropLot create/update inside $transaction
├── lib/
│   ├── lot-generator.ts        # REUSE as-is — generateLotNumber() already correct
│   ├── report-assembler.ts     # NO CHANGE — already queries CropLot correctly
│   └── yield-converter.ts      # CREATE: bu→lbs conversion utility (new file)
└── app/(app)/admin/fieldops/
    └── review/page.tsx         # MODIFY: update bulk-approve toast message format
```

### Pattern 1: Prisma `$transaction` for Atomic HarvestEvent + CropLot

**What:** Wrap both writes in a single interactive transaction so either both succeed or both roll back. This matches the user decision "CropLot creation happens in the same Prisma transaction as HarvestEvent creation."

**When to use:** Any time a HarvestEvent (SYNCED) is approved.

**Example:**

```typescript
// Inside the approve handler, replace the standalone harvestEvent.create + syncedOperation.update
const result = await prisma.$transaction(async (tx) => {
  // 1. Convert yield to lbs
  const netWeightLbs = convertYieldToLbs(
    productsData?.yield as number | null,
    productsData?.yieldUnit as string | null,
    stagedOp.acresWorked ?? fieldEnterprise.plantedAcres,
    fieldEnterprise.crop
  );

  // 2. Create HarvestEvent
  const harvestEvent = await tx.harvestEvent.create({
    data: {
      fieldEnterpriseId,
      harvestDate: stagedOp.operationDate ?? new Date(),
      acresHarvested: stagedOp.acresWorked ?? fieldEnterprise.plantedAcres,
      yieldPerAcre: typeof productsData?.yield === "number" ? productsData.yield : null,
      yieldUnit: typeof productsData?.yieldUnit === "string" ? productsData.yieldUnit : null,
      netWeight: netWeightLbs,
      dataSource: "SYNCED",
      notes: `Imported from Case IH FieldOps (syncRunId: ${stagedOp.syncRunId})`,
    },
  });

  // 3. Find or create CropLot for this enterprise
  const existingLot = await tx.cropLot.findFirst({
    where: { fieldEnterpriseId },
  });

  let cropLot;
  let lotIsNew: boolean;

  if (existingLot) {
    // Accumulate into existing lot — user decision: one lot per enterprise for synced data
    cropLot = await tx.cropLot.update({
      where: { id: existingLot.id },
      data: {
        quantityLbs: { increment: netWeightLbs ?? 0 },
        // harvestEventId stays as the first harvest's link (don't overwrite)
      },
    });
    lotIsNew = false;
  } else {
    // First harvest for this enterprise — generate new lot number
    const field = await tx.field.findUnique({ where: { id: fieldEnterprise.fieldId } });
    const lotNumber = generateLotNumber(fieldEnterprise.cropYear, fieldEnterprise.crop, field!.name);

    cropLot = await tx.cropLot.create({
      data: {
        fieldEnterpriseId,
        harvestEventId: harvestEvent.id,
        lotNumber,
        crop: fieldEnterprise.crop,
        organicStatus: fieldEnterprise.organicStatus,
        quantityLbs: netWeightLbs ?? 0,
      },
    });
    lotIsNew = true;
  }

  // 4. Mark staged op approved (inside same transaction)
  await tx.syncedOperation.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedByUserId: userId ?? null,
    },
  });

  return { harvestEvent, cropLot, lotIsNew };
});
```

### Pattern 2: Bu→Lbs Conversion Utility (`src/lib/yield-converter.ts`)

**What:** Stateless pure function that converts Case IH yield (bu/ac * acres) to lbs using USDA standard test weights.

**When to use:** At approve time, before HarvestEvent.create.

**Example:**

```typescript
// src/lib/yield-converter.ts

// Standard USDA test weights (lbs/bu)
const STANDARD_TEST_WEIGHTS: Record<string, number> = {
  corn: 56,
  "field corn": 56,
  "blue corn": 56,
  wheat: 60,
  "soft red winter wheat": 60,
  "winter wheat": 60,
  "spring wheat": 60,
  soybeans: 60,
  soybean: 60,
  barley: 48,
  oats: 32,
  rye: 56,
  sorghum: 56,
  "grain sorghum": 56,
};

export function getTestWeight(crop: string): number | null {
  return STANDARD_TEST_WEIGHTS[crop.toLowerCase().trim()] ?? null;
}

/**
 * Convert a Case IH yield reading to net weight in lbs.
 * Returns null if conversion cannot be performed.
 */
export function convertYieldToLbs(
  yieldPerAcre: number | null,
  yieldUnit: string | null,
  acres: number,
  crop: string
): number | null {
  if (yieldPerAcre == null || acres == null) return null;

  const unit = (yieldUnit ?? "bu").toLowerCase();

  if (unit === "lbs" || unit === "lb" || unit === "lbs/ac") {
    // Already in lbs — just multiply by acres
    return yieldPerAcre * acres;
  }

  if (unit === "bu" || unit === "bu/ac" || unit === "bushels") {
    const testWeight = getTestWeight(crop);
    if (testWeight == null) return null; // unknown crop — don't guess
    return yieldPerAcre * acres * testWeight;
  }

  return null; // unexpected unit
}
```

### Pattern 3: Bulk-Approve Summary Toast

**What:** After bulk approve loop completes, report created vs. updated CropLots to the user.

**When to use:** In `handleBulkApprove` in `review/page.tsx`, the response from each approve call returns `{ lotIsNew: boolean }` — tally these.

**Example:**

```typescript
// In review/page.tsx handleBulkApprove
let newLots = 0;
let updatedLots = 0;
// ... in the loop:
if (res.ok) {
  const json = await res.json();
  approved++;
  if (json.lotIsNew) newLots++;
  else if (json.domainRecordType === "HarvestEvent") updatedLots++;
}
// ... after loop:
const parts = [];
if (approved > 0) parts.push(`${approved} HarvestEvent${approved !== 1 ? "s" : ""} approved`);
if (newLots > 0) parts.push(`${newLots} new CropLot${newLots !== 1 ? "s" : ""} created`);
if (updatedLots > 0) parts.push(`${updatedLots} existing CropLot${updatedLots !== 1 ? "s" : ""} updated`);
toast.success(parts.join(", "));
```

### Pattern 4: "No Enterprise" Blocked State in UI

**What:** When approve is blocked because no FieldEnterprise exists (API returns 400 with specific error text), show an inline disabled button with tooltip linking to the enterprise creation page.

**When to use:** The API already returns 400 with `"No active crop enterprise found for this field"`. The UI currently shows a generic `toast.error`. Upgrade to a more actionable UI state: link to `/field-enterprises`.

**Example:**

```typescript
// In handleApprove (review/page.tsx):
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  if (err.error?.includes("No active crop enterprise")) {
    toast.error("No enterprise for this field — create one first", {
      action: { label: "Create Enterprise", onClick: () => router.push("/field-enterprises") },
    });
  } else {
    toast.error(err.error ?? "Approve failed");
  }
  return;
}
```

### Anti-Patterns to Avoid

- **Splitting HarvestEvent.create and CropLot.create across separate awaits:** If the CropLot create fails, you get a HarvestEvent with no lot number — orphaned and invisible to reports. Always use `$transaction`.
- **Re-implementing lot number generation in the approve handler:** `generateLotNumber()` already exists in `src/lib/lot-generator.ts`. Import and reuse — do not duplicate format logic.
- **Using `prisma.cropLot.upsert` with `lotNumber` as the key:** The `CropLot` unique constraint is on `lotNumber`, not on `fieldEnterpriseId`. Multiple enterprises on a farm could generate the same lot number for different years/crops. Use `findFirst({ where: { fieldEnterpriseId } })` then branch to create vs. update — this is safer and matches actual schema constraints.
- **Overwriting `harvestEventId` on update:** When updating an existing CropLot, leave `harvestEventId` pointing to the first harvest. The schema allows multiple HarvestEvents per CropLot via the `CropLot[]` relation on `HarvestEvent`.
- **Running unit conversion inside the PDF assembler:** Convert at write time (approve), not at read time. The PDF should display stored lbs, not re-derive them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lot number generation | Custom `YEAR-CROP-FIELD` formatter | `generateLotNumber()` in `src/lib/lot-generator.ts` | Already handles crop abbreviations (24 crops), field name lookup table (25 known fields), and the 4-char fallback — duplication will diverge |
| Atomic writes | Sequential `await` chains with try/catch rollback | Prisma `$transaction(async tx => {...})` | Interactive transactions guarantee atomicity and roll back automatically on throw |
| Bu→lbs conversion | Hardcoded inline multipliers | `convertYieldToLbs()` in new `src/lib/yield-converter.ts` | Centralized test weights, testable, prevents drift as more crops are added |
| Toast notifications | Custom banner component | `sonner` `toast.success()` — already installed and used in review page | Consistent with existing UX patterns |

**Key insight:** This phase is entirely a wiring exercise. Every piece of infrastructure already exists. The planner should assign zero tasks for building new UI, new schemas, or new report sections.

---

## Common Pitfalls

### Pitfall 1: CropLot Accumulation vs. Manual Lot Suffix Behavior

**What goes wrong:** Developer reads the manual harvest route, sees the `-2`, `-3` suffix pattern, and applies it to the synced path. Result: every synced harvest creates a new CropLot with a suffix, breaking mass balance (harvested lbs are split across multiple lots instead of accumulated).

**Why it happens:** The manual route deliberately creates one CropLot per HarvestEvent. The user decision for Phase 4 is different: synced harvests for the same enterprise share a CropLot (upsert-style with increment).

**How to avoid:** The approve handler must `findFirst({ where: { fieldEnterpriseId } })` before deciding to create or update. Never use the suffix pattern in the synced path.

**Warning signs:** Mass balance shows the same crop with multiple lot numbers for the same field/year, each with a small quantity.

### Pitfall 2: Yield Unit Ambiguity from Case IH Data

**What goes wrong:** Case IH returns `yieldUnit: "bu"` sometimes and `"bu/ac"` or nothing other times. If the conversion is a simple `=== "bu"` check, it silently produces `null` for legitimate yield values with different unit strings.

**Why it happens:** The Case IH API schema is undocumented (per existing project decision: "CNH API schema is undocumented, defensive parsing required").

**How to avoid:** The `convertYieldToLbs` utility should normalize unit strings (strip `/ac`, case-insensitive) and include all known variants before falling through to null. Log the raw unit when returning null so issues are detectable.

**Warning signs:** SYNCED HarvestEvents in the report show `netWeight: null` even though Case IH sent yield data.

### Pitfall 3: FieldEnterprise.cropYear vs. StagedOp.operationDate Year Mismatch

**What goes wrong:** The approve handler finds the "most recent" FieldEnterprise by `orderBy: { cropYear: "desc" }` — this can match a 2025 enterprise for a 2024 harvest operation if the user hasn't scoped the search by year.

**Why it happens:** The existing handler already has this behavior (it was the Phase 1 decision to use the latest enterprise). For non-harvest ops this is acceptable. For harvests with CropLot generation, it could assign a 2024 harvest to a 2025 lot number.

**How to avoid:** When the `operationDate` year is known, prefer finding a FieldEnterprise where `cropYear` matches `operationDate.getFullYear()`. Fall back to the latest enterprise only if no year-matched enterprise exists.

**Warning signs:** Lot numbers contain the wrong year (e.g., `2025-CORN-SIMP` for a harvest dated 2024-10-15).

### Pitfall 4: `$transaction` Scope Leaks — Reading Outside `tx`

**What goes wrong:** Inside the `$transaction` callback, mixing `tx.*` calls with `prisma.*` calls. The read outside `tx` won't be included in the transaction's snapshot and can lead to stale reads.

**Why it happens:** Copy-paste from existing code that uses `prisma.` directly.

**How to avoid:** Inside a `$transaction(async (tx) => {...})` callback, use `tx` for every database operation — reads and writes alike. The `prisma` client reference should not appear inside the callback body.

### Pitfall 5: Broken Bulk-Approve Toast When No HarvestEvents Return Lot Info

**What goes wrong:** The bulk-approve loop ignores the `lotIsNew` field in the API response. The toast says "3 approved" but gives no information about CropLots — user doesn't know if the lots were created.

**Why it happens:** The API currently returns `{ success: true, domainRecordType, domainRecordId }`. The `lotIsNew` field doesn't exist yet — it must be added to the response alongside `cropLot`.

**How to avoid:** Extend the approve endpoint response for the harvest path to include `{ ..., cropLot: { id, lotNumber, isNew: boolean } }`. The UI then reads this to populate the toast summary.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing: generateLotNumber (reuse as-is)

```typescript
// Source: src/lib/lot-generator.ts
export function generateLotNumber(
  year: number,
  crop: string,
  fieldName: string
): string {
  return `${year}-${abbreviateCrop(crop)}-${abbreviateField(fieldName)}`;
}
// Example: generateLotNumber(2024, "Corn", "Kopps") => "2024-CORN-KOPP"
// Example: generateLotNumber(2024, "Soft Red Winter Wheat", "Simpson N") => "2024-SRWW-SMPN"
```

### Existing: Prisma $transaction Pattern (Prisma 6)

```typescript
// Source: Prisma v6 docs — interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const a = await tx.modelA.create({ data: { ... } });
  const b = await tx.modelB.create({ data: { ..., aId: a.id } });
  return { a, b };
});
// If either throws, both roll back automatically
```

### Existing: CropLot Schema Constraints

```prisma
// Source: prisma/schema.prisma
model CropLot {
  id                String          @id @default(cuid())
  fieldEnterpriseId String
  fieldEnterprise   FieldEnterprise @relation(fields: [fieldEnterpriseId], references: [id])
  harvestEventId    String?
  harvestEvent      HarvestEvent?   @relation(fields: [harvestEventId], references: [id])
  lotNumber         String          @unique   // ← global unique, not per-enterprise
  crop              String
  organicStatus     OrganicStatus
  quantityLbs       Float
  notes             String?
  ...
}
```

The `@unique` on `lotNumber` is global — so `generateLotNumber` must produce a unique string. For synced harvests on the same enterprise, we UPDATE rather than create a new one with a suffix.

### Existing: How the Report Assembler Gets Lot Numbers

```typescript
// Source: src/lib/report-assembler.ts (lines 268-285)
for (const harvest of enterprise.harvestEvents) {
  // Get the primary lot number from associated CropLots
  const lotNumber = harvest.cropLots[0]?.lotNumber ?? null;

  allHarvests.push({
    ...
    lotNumber,       // null → "—" in PDF
    netWeight: harvest.netWeight,   // null → "—" in PDF
    ...
  });
}
```

This means: `HarvestEvent.cropLots[0]` is the join path. For a SYNCED HarvestEvent to show a lot number in the PDF, it must have at least one `CropLot` linked via `harvestEventId`. The `harvestEventId` on CropLot must point to THIS HarvestEvent — which is only true for the first harvest that creates the CropLot. Subsequent harvests that update the existing CropLot will NOT have `harvestEventId` pointing to them.

**Implication for report assembler:** The current query includes `cropLots` via `include: { harvestEvents: { include: { cropLots: ... } } }`. A SYNCED HarvestEvent that updated an existing CropLot (rather than creating one) will have `cropLots: []` — which means `lotNumber: null` in the report.

**Fix required:** The `HarvestRecord` assembler must look up the CropLot by `fieldEnterpriseId` for any harvest with `cropLots.length === 0`. OR: when updating an existing CropLot, add the harvestEvent via the relation (CropLot has `harvestEventId` but HarvestEvent has `CropLot[]` — the relation is one HarvestEvent → many CropLots, but the schema allows multiple CropLots per HarvestEvent, not the reverse). The cleanest fix is to update `report-assembler.ts` to look up the enterprise's CropLot by `fieldEnterpriseId` when the harvest has no direct CropLot link.

### Existing: Mass Balance Query Path

```typescript
// Source: src/lib/report-assembler.ts (lines 295-335)
const cropLots = await prisma.cropLot.findMany({
  where: {
    fieldEnterprise: {
      field: { farmId, ... },
      cropYear,
    },
  },
  include: { harvestEvent: true, loadoutEvents: { include: { saleDelivery: true } } },
});
```

Mass balance is assembled directly from `CropLot` records — it does NOT go through `HarvestEvent`. This means: once a CropLot exists for an enterprise, synced data will automatically appear in mass balance with the correct `quantityLbs`. No changes to `report-assembler.ts` are needed for mass balance, only for the harvest log lot number lookup.

### Existing: sonner Toast API (review page pattern)

```typescript
// Source: src/app/(app)/admin/fieldops/review/page.tsx (line 275)
toast.success(`Bulk approve: ${parts.join(", ")}`);

// sonner supports action buttons for actionable errors:
toast.error("No enterprise for this field", {
  action: {
    label: "Create Enterprise",
    onClick: () => router.push("/field-enterprises"),
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential `await` for writes | `$transaction(async tx => {...})` | Prisma 4.7 interactive transactions | Atomicity guaranteed; `tx` client used throughout |
| `prisma.$transaction([op1, op2])` (array form) | `prisma.$transaction(async (tx) => {...})` (interactive) | Prisma 4.7 | Interactive form allows conditional logic (findFirst then branch); array form does not |

**Prisma 6 interactive transaction notes (HIGH confidence):**
- Default timeout: 5 seconds. The approve flow has multiple operations — should complete well under this limit.
- `tx` is a scoped Prisma client — use it for all DB calls inside the callback.
- Nesting `$transaction` is not supported — the approve handler has one level of transaction, which is correct.

---

## Open Questions

1. **Harvest Log Lot Number for "accumulated" HarvestEvents**
   - What we know: HarvestEvent has `cropLots: CropLot[]` (one-to-many). The report assembler reads `harvest.cropLots[0]?.lotNumber`. For the FIRST synced harvest that creates a CropLot, `harvestEventId` is set and `cropLots[0]` exists. For subsequent synced harvests that UPDATE the same CropLot, the CropLot's `harvestEventId` still points to the first harvest — so the second harvest has `cropLots: []` → `lotNumber: null` → "—" in the PDF.
   - What's unclear: Is it acceptable for multiple HarvestEvent rows for the same enterprise to show the same lot number in the Harvest Log? (They share one lot.) Or should each event show the enterprise's lot regardless of whether it's the "creating" harvest?
   - Recommendation: Update `report-assembler.ts` to use a fallback: if `harvest.cropLots.length === 0`, look up the CropLot by `fieldEnterpriseId` and use its `lotNumber`. This ensures every HarvestEvent for an enterprise shows the enterprise's lot number. Add this as a task in the plan.

2. **FieldEnterprise Year Matching Precision**
   - What we know: The current approve handler selects the "most recent" enterprise regardless of crop year alignment with operationDate.
   - What's unclear: Is the current behavior (latest enterprise wins) acceptable in production? For 2024 harvest ops, do users always have a 2024 enterprise, or might only a 2025 one exist?
   - Recommendation: Add year-matched enterprise lookup as a secondary query. If `operationDate` year is known, prefer `cropYear === operationDate.getFullYear()`. This is a ~3-line change and prevents lot number year bugs.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts` — current approve handler; gap identified at line 181 (HarvestEvent created, no CropLot created)
- `organic-cert/src/app/api/field-enterprises/[id]/harvest/route.ts` — manual harvest CropLot creation pattern; reuse for synced path
- `organic-cert/src/lib/lot-generator.ts` — `generateLotNumber()`, `abbreviateCrop()`, `abbreviateField()` — ready to import
- `organic-cert/src/lib/report-assembler.ts` — shows how lotNumber and massBalance data flows; lines 268-285 (harvest log), 295-335 (mass balance)
- `organic-cert/src/lib/pdf/sections/harvest-log.tsx` — renders `harvest.lotNumber ?? "—"`; no PDF changes needed once data flows
- `organic-cert/src/lib/pdf/sections/mass-balance.tsx` — renders from `massBalance` data; no PDF changes needed once CropLots exist
- `organic-cert/prisma/schema.prisma` — `CropLot.lotNumber @unique` (global), `CropLot.harvestEventId` (optional FK), `HarvestEvent.cropLots CropLot[]`
- `organic-cert/src/app/(app)/admin/fieldops/review/page.tsx` — bulk approve loop, toast patterns, sonner import

### Secondary (MEDIUM confidence)

- Prisma v6 `$transaction` interactive mode — consistent with Prisma 4.7+ docs; no breaking changes in v6 for this API
- USDA test weights (corn 56, wheat 60, soybeans 60, barley 48, oats 32, rye 56) — documented in CONTEXT.md specifics section, consistent with public USDA standards

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new dependencies
- Architecture: HIGH — gap is precisely identified in two call sites; fix is straightforward
- Pitfalls: HIGH — derived from direct schema inspection and existing code behavior; not speculative
- Report integration: HIGH — PDF sections verified to already handle null lot numbers; gap is entirely upstream in data creation

**Research date:** 2026-02-26
**Valid until:** 2026-04-26 (stable stack — Next.js 16, Prisma 6; no known breaking changes pending)
