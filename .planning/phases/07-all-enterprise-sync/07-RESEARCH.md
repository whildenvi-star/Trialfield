# Phase 7: All-Enterprise Sync - Research

**Researched:** 2026-03-21
**Domain:** Farm-budget sync expansion — FieldEnterprise upsert logic, organic/conventional type flag, on-page-load sync pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Enterprise matching**
- Pull ALL enterprise tabs from the Macro Rollup workbook — skip utility/summary tabs (Claude determines which are non-enterprise)
- Each enterprise tab in the Macro Rollup maps to a separate FieldEnterprise record
- Add an organic/conventional type flag to the FieldEnterprise model
- Type flag is derived from the farm-registry service's explicit organic flag on fields — NOT from the farm-budget service's conventional/organic array classification
- Fields are dedicated organic OR conventional per crop year — never both simultaneously
- No deduplication needed between organic and conventional for the same field

**Sync behavior**
- On-page-load sync — no manual sync buttons, no scheduled jobs
- Fetch fresh projected data from farm-budget service each time someone navigates to the Budget tab
- If farm-budget service is unavailable, show last known data from database with a stale indicator (e.g., "last updated X ago")
- Projected numbers update silently even if Sandy has already entered actuals against old projections — actuals are never touched
- Variance recalculates automatically against updated projections
- Current crop year only — do not sync historical years

**Data mapping**
- Conventional and organic enterprise tabs have identical column structure — same cost categories, same line items
- Expect 1-5 conventional enterprise tabs alongside the existing organic ones
- Some conventional-specific cost categories may exist (e.g., synthetic inputs) — researcher should check actual tab data
- Enterprises grouped by type in the UI: organic section and conventional section displayed separately

**Sync triggering and access**
- No sync buttons — data appears automatically via page-load fetch
- Sandy (OFFICE role) sees ALL enterprises — both organic and conventional
- Sandy can enter actuals for ALL enterprises (organic + conventional) — consistent workflow
- New enterprises from the Macro Rollup appear silently on next page load — no notification needed
- Move away from explicit "sync" UX — things should just be current

### Claude's Discretion
- Which tabs in the Macro Rollup are utility/non-enterprise (detection logic)
- How to handle the on-page-load sync without blocking UI rendering
- Stale data indicator design and placement
- Error handling for partial sync failures (some tabs succeed, some fail)
- How to handle enterprise tabs with no matching field in the registry

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-01 | All enterprises (organic + conventional) sync from farm-budget service | The existing sync at `/api/fields/sync-macro` filters to `category === "organic"` only. Removing that filter and iterating all enterprises is the core change. The match key `@@unique([fieldId, cropYear, crop, label])` does not include organic/conventional type — a new `enterpriseType` column is needed to disambiguate records (same field, same year, same crop name may appear in both organic and conventional tabs in edge cases) |
| SYNC-02 | Existing organic enterprise data (including any actuals entered in Phase 6) is preserved when sync expands to all enterprises | Actuals live on `SeedUsage.actualPricePerUnit`, `MaterialUsage.actualTotalCost`, and `FieldEnterprise.actualYieldPerAcre`. The sync only touches projected-source records and never touches these actual fields. The upsert pattern (find-first, then create-or-update only changed projected fields) already preserves actuals. The main risk is the match key collision noted in STATE.md — if not addressed, conventional records may overwrite organic ones. |
</phase_requirements>

---

## Summary

Phase 7 expands the farm-budget sync to pull ALL enterprises (organic + conventional) into FieldEnterprise records. The existing sync at `/api/fields/sync-macro` already handles the organic side completely — it fetches enterprises, fields, seeds, products, and settings from farm-budget, then for each organic field creates/updates a FieldEnterprise with its seed, material, and machinery plan.

The core work is: (1) remove the organic-only filter from the sync, (2) add an `enterpriseType` enum field to FieldEnterprise so the unique key includes type and records can't collide, (3) derive organic/conventional type from the farm-registry field's `organicAcres > 0` flag (not from the budget enterprise category), and (4) move the sync trigger from an explicit sync button to an on-load fetch when the Budget tab is navigated to, with stale fallback if farm-budget is unreachable.

The real-data farm-budget store has 7 enterprises: 3 conventional (Conventional Corn, Conventional Small Grain, Conventional Soybeans), 1 mixed-category (Conv/Org Canning, category=`conventional` with both ORG and CON system codes), and 3 organic (Organic Corn, Organic Small Grain, Organic Broadleaf). Field names across organic and conventional are distinct in the current data (no overlap between the 12 organic fields and the 44 conventional fields), but the schema must handle potential overlap to be safe.

**Primary recommendation:** Add `enterpriseType` enum (`ORGANIC` | `CONVENTIONAL`) to FieldEnterprise, update the unique constraint to include it, set value from farm-registry `organicAcres`, remove the organic filter from sync-macro, and trigger sync via `useEffect` on Budget tab mount.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma (existing) | Current in project | Schema migration + DB upsert | Already the ORM for all FieldEnterprise operations |
| Next.js API Routes (existing) | 14.x | Sync endpoint + budget-summary | All API work already in this pattern |
| React useEffect (existing) | 18.x | On-page-load sync trigger | Already used on the enterprise detail page for data loading |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner toast (existing) | Current | Stale indicator notification | Used throughout the app for status messages |
| date-fns (existing) | Current | Timestamp formatting for "last updated X ago" | Already imported in the detail page |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useEffect on Budget tab mount | SWR / TanStack Query with revalidate | SWR would give cleaner stale-while-revalidate UX but is not in the current stack; not worth adding for one endpoint |
| Server-side per-request sync in `budget-summary` GET | Client-triggered sync then fetch | Server-side would add latency to every budget-summary call; client-side fire-and-forget is cleaner and non-blocking |

---

## Architecture Patterns

### Existing Sync Architecture (Verified from Source)

The current sync lives at:
- **API endpoint:** `src/app/api/fields/sync-macro/route.ts` — POST handler, fetches farm-budget, upserts FieldEnterprise records
- **Trigger:** Manual button in `src/app/(app)/fields/page.tsx` (`handleSyncMacro()`)
- **Filter:** Lines 165-169 filter to `category === "organic" || systemCodes.some(c => c.includes("ORG"))` — this is the exact filter to remove/expand

### Current FieldEnterprise Unique Constraint

```prisma
@@unique([fieldId, cropYear, crop, label])
```

**Problem:** `crop` values from organic and conventional enterprises that farm the same field will differ (e.g., "ORG Soybeans" vs "RR Soybeans") so collisions are unlikely today. But after adding `enterpriseType`, the constraint becomes explicit and correct. STATE.md also flags: "conventional and organic crop of the same type on same field in the same crop year will create duplicates" if type isn't in the key.

### New FieldEnterprise Unique Constraint (Phase 7)

```prisma
@@unique([fieldId, cropYear, crop, label, enterpriseType])
```

This is the safe key. Two FieldEnterprise records for the same field + year + crop are only possible if they differ by `enterpriseType` (which can only happen if the farm-budget data has the same field in both an organic and conventional enterprise — currently they don't, but the schema must be defensive).

### Recommended Project Structure

No new directories needed. Changes are contained to:

```
prisma/
└── schema.prisma               # Add enterpriseType field + update @@unique

src/app/api/fields/
└── sync-macro/route.ts         # Remove organic filter; derive type from registry

src/app/(app)/field-enterprises/[id]/
└── page.tsx                    # Move sync trigger to Budget tab mount via useEffect

src/components/budget/
└── BudgetTab.tsx               # Accept syncedAt prop; show stale indicator if set
```

### Pattern 1: Removing the Organic Filter

**What:** Change the filter in `sync-macro/route.ts` from organic-only to all enterprises.
**When to use:** The single code change that satisfies SYNC-01.

```typescript
// BEFORE (lines 165-169 of sync-macro/route.ts):
const organicEnterprises = enterprises.filter(
  (e) => e.category === "organic" || e.systemCodes.some((c) => c.includes("ORG"))
);
const organicEntIds = new Set(organicEnterprises.map((e) => e.id));
const organicFields = fields.filter((f) => organicEntIds.has(f.enterpriseId));

// AFTER:
// All enterprises — no filter; type derived from registry (see Pattern 2)
const allFields = fields; // iterate all 56 fields
```

### Pattern 2: Deriving enterpriseType from Farm Registry

**What:** Look up the matched local Field's `organicStatus` to determine enterpriseType, not the budget enterprise's category.
**When to use:** Every FieldEnterprise upsert in the expanded sync.

```typescript
// In sync loop, after matching bf.name → matchedField:
const enterpriseType = matchedField.organicStatus === "ORGANIC" ? "ORGANIC" : "CONVENTIONAL";
// Use enterpriseType in upsert data and as part of the find-first key
```

**Why not use budget category:** The CONTEXT.md decision is clear: "Type flag is derived from the farm-registry service's explicit organic flag on fields." The farm-registry `organicAcres > 0` maps to `Field.organicStatus === "ORGANIC"` in the local DB (set during `sync-registry`). This is the source of truth.

### Pattern 3: On-Page-Load Sync via Budget Tab Mount

**What:** Fire the sync when the Budget tab becomes active, not via a button.
**When to use:** This replaces the manual sync button in the fields page for budget data.

```typescript
// In enterprise detail page, inside the Budget tab's onValueChange or via useEffect:
useEffect(() => {
  if (activeTab === "budget" && canSeeBudget) {
    // Fire-and-forget: POST /api/fields/sync-macro
    // Then re-fetch budget-summary
    triggerBudgetSync();
  }
}, [activeTab]);

async function triggerBudgetSync() {
  setSyncState("syncing");
  try {
    const res = await fetch("/api/fields/sync-macro", { method: "POST" });
    if (res.ok) {
      setSyncedAt(new Date());
      await refreshBudget();
    } else {
      setSyncState("stale"); // show "last updated X ago" from previous syncedAt
    }
  } catch {
    setSyncState("stale");
  }
  setSyncState("idle");
}
```

**Non-blocking UX:** The budget tab should render with existing DB data immediately (from the already-loaded `budgetSummary` state). The sync runs in the background; data refreshes when it completes. A small "Syncing..." indicator replaces the stale indicator while in progress.

### Pattern 4: Stale Indicator

**What:** When farm-budget is unreachable, show last-sync timestamp rather than an error.
**Design:** Small text label near the Budget tab header: `Last synced 3 hours ago` in muted color. Use `formatDistanceToNow` from date-fns.

```typescript
import { formatDistanceToNow } from "date-fns";

// In BudgetTab or parent:
{syncState === "stale" && syncedAt && (
  <span className="text-xs text-muted-foreground ml-2">
    Last synced {formatDistanceToNow(syncedAt, { addSuffix: true })}
  </span>
)}
```

### Pattern 5: Prisma Migration for enterpriseType

**What:** Add new column with enum + update unique constraint.

```prisma
// In schema.prisma — FieldEnterprise model:
enum EnterpriseType {
  ORGANIC
  CONVENTIONAL
}

model FieldEnterprise {
  // ... existing fields ...
  enterpriseType EnterpriseType @default(ORGANIC)  // default preserves existing organic records

  @@unique([fieldId, cropYear, crop, label, enterpriseType])  // replaces existing @@unique
}
```

**Migration strategy:** Default to `ORGANIC` so all existing FieldEnterprise records keep their current type without data migration. New conventional records get `CONVENTIONAL` from the sync.

### Anti-Patterns to Avoid

- **Using budget `category` field for enterpriseType:** The budget service returns `category: "conventional"` for the Conv/Org Canning enterprise, which has both organic and conventional fields. Using registry organic status is correct.
- **Syncing all crop years:** The CONTEXT.md decision is current year only. The sync already gets `cropYear` from `settings.year`. Keep that as the scope.
- **Blocking UI on sync:** Never `await` the sync before showing budget data. Show existing DB data immediately; refresh after sync completes.
- **Touching actuals during sync:** The existing upsert pattern only updates projected fields (`plantedAcres`, `variety`, `targetYieldPerAcre`). The actual fields (`actualYieldPerAcre`, `SeedUsage.actualPricePerUnit`, `MaterialUsage.actualTotalCost`) are never in the `updates` object.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique key management | Custom duplicate-detection logic | Prisma `@@unique` constraint + `findFirst` with all key fields | Prisma enforces uniqueness at DB level; race conditions handled |
| Timestamp formatting | Custom "X hours ago" string | `date-fns formatDistanceToNow` | Already in the project (date-fns imported in detail page) |
| Non-blocking fetch | Custom queuing/worker | `fetch` fire-and-forget pattern with local state | Simple async call sufficient for single-user scenario |

**Key insight:** The sync logic itself is already complete — the only structural changes are removing a filter, adding a field to the schema, and moving the trigger location.

---

## Common Pitfalls

### Pitfall 1: Match Key Collision Without enterpriseType
**What goes wrong:** Two FieldEnterprise records for the same `{fieldId, cropYear, crop, label}` — one organic, one conventional. Without `enterpriseType` in the key, the `findFirst` call in the sync returns the wrong record (first one found), and the upsert may update an organic record with conventional data or vice versa.
**Why it happens:** STATE.md explicitly flags this: "sync upsert match key collision." The current key `{fieldId, cropYear, crop, label}` does not include type.
**How to avoid:** Add `enterpriseType` to the Prisma `@@unique` and to every `findFirst` call in the sync.
**Warning signs:** Organic enterprises losing their projected data after first sync expansion run.

### Pitfall 2: Deriving Type from Budget Category Instead of Registry
**What goes wrong:** Conv/Org Canning enterprise has `category: "conventional"` in farm-budget but contains both certified organic and conventional fields. Deriving type from the enterprise category would wrongly mark all canning fields as CONVENTIONAL.
**Why it happens:** The budget enterprise category reflects the enterprise's primary classification, not each individual field's certification status.
**How to avoid:** Always look up `matchedField.organicStatus` in the local DB (set during sync-registry from farm-registry data) to set `enterpriseType`.
**Warning signs:** Organic canning fields appearing in the conventional section of the UI.

### Pitfall 3: Breaking Existing Organic Records on Migration
**What goes wrong:** Adding `enterpriseType` with no default causes existing FieldEnterprise rows to fail validation or require a manual backfill.
**Why it happens:** Postgres requires either a default or a migration script for non-null columns added to existing tables.
**How to avoid:** Use `@default(ORGANIC)` in the Prisma schema. All existing FieldEnterprise records are organic, so the default is correct. No backfill script needed.
**Warning signs:** Migration fails with "column cannot be null" or existing records appear with NULL enterpriseType.

### Pitfall 4: Sync Blocks Budget Tab Render
**What goes wrong:** User clicks Budget tab; nothing renders for 3+ seconds while sync completes.
**Why it happens:** Awaiting the sync POST before fetching budget-summary means the user waits for a full farm-budget round-trip before seeing any data.
**How to avoid:** Render the budget data from the already-loaded `budgetSummary` state immediately. Fire the sync in the background; call `refreshBudget()` only after sync completes.
**Warning signs:** Budget tab has a visible loading spinner that takes 3+ seconds on every navigation.

### Pitfall 5: Syncing the Conv/Org Canning Enterprise Incorrectly
**What goes wrong:** The canning enterprise (`ent_1875`) has `category: "conventional"` but contains fields that may be certified organic. The systemCodes include both `CANNING CON` and `CANNING ORG`.
**Why it happens:** This is a hybrid enterprise in the budget — one enterprise covers both certified and conventional canning ground.
**How to avoid:** Don't use the enterprise's systemCodes or category to determine field type. Use the local field's `organicStatus` from the registry sync. Each canning field will be ORGANIC or CONVENTIONAL based on its registry record, not its budget enterprise.
**Warning signs:** All canning fields showing the same enterpriseType regardless of which fields are certified organic.

---

## Code Examples

### Current Upsert Find Key (sync-macro/route.ts, verified from source)

```typescript
// Source: /Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/fields/sync-macro/route.ts
let enterprise = await prisma.fieldEnterprise.findFirst({
  where: { fieldId: matchedField.id, cropYear, crop: bf.crop, label: null },
});
```

**Phase 7 change:** Add `enterpriseType` to the `where` clause:

```typescript
const enterpriseType = matchedField.organicStatus === "ORGANIC" ? "ORGANIC" : "CONVENTIONAL";
let enterprise = await prisma.fieldEnterprise.findFirst({
  where: { fieldId: matchedField.id, cropYear, crop: bf.crop, label: null, enterpriseType },
});
// And in the create data:
data: {
  fieldId: matchedField.id,
  cropYear,
  crop: bf.crop,
  enterpriseType,
  organicStatus: matchedField.organicStatus, // keep OrganicStatus on FieldEnterprise too
  // ... rest unchanged
}
```

### Existing Organic-Only Filter to Remove (sync-macro/route.ts lines 165–169)

```typescript
// Source: /Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/fields/sync-macro/route.ts
// REMOVE these 4 lines:
const organicEnterprises = enterprises.filter(
  (e) => e.category === "organic" || e.systemCodes.some((c) => c.includes("ORG"))
);
const organicEntIds = new Set(organicEnterprises.map((e) => e.id));
const organicFields = fields.filter((f) => organicEntIds.has(f.enterpriseId));
// REPLACE with:
const allFields = fields; // iterate all 56 fields
```

### Enterprise Detail Page — Budget Tab Sync Trigger

```typescript
// Source: /Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx
// Add to existing state:
const [syncState, setSyncState] = useState<"idle" | "syncing" | "stale">("idle");
const [syncedAt, setSyncedAt] = useState<Date | null>(null);

// Add useEffect that fires when Budget tab becomes active:
useEffect(() => {
  if (activeTab === "budget" && canSeeBudget) {
    triggerBudgetSync();
  }
}, [activeTab, canSeeBudget]);

async function triggerBudgetSync() {
  setSyncState("syncing");
  try {
    const res = await fetch("/api/fields/sync-macro", { method: "POST" });
    if (res.ok) {
      setSyncedAt(new Date());
      await refreshBudget(); // re-fetch budget-summary after sync
    } else {
      setSyncState("stale");
      return;
    }
  } catch {
    setSyncState("stale");
    return;
  }
  setSyncState("idle");
}
```

---

## Real Data Findings

### Actual Enterprise Data (farm-budget data.json, verified 2026-03-21)

| Enterprise | Category | systemCodes | Fields |
|-----------|----------|-------------|--------|
| Conventional Corn | conventional | CON, CON IRR | 20+ fields |
| Conventional Small Grain | conventional | CON, CON IRR | ~7 fields |
| Conventional Soybeans | conventional | CON, CON IRR | 16 fields |
| Conv/Org Canning | conventional | CANNING CON, CANNING ORG, CANNING CON IRR, CANNING ORG IRR | 6 fields |
| Organic Corn | organic | ORG, ORG IRR | 3 fields (Omni Grassy Knoll, Kopp Seed Corn, Simpsons Seed Corn) |
| Organic Small Grain | organic | ORG | 5 fields |
| Organic Broadleaf | organic | ORG, ORG IRR | 4 fields |

Total: 56 fields. Organic fields: 12. Conventional fields: 44.

### Key Finding: No Field Name Overlap Between Organic and Conventional

In the current data, organic field names (e.g., "Fletcher-Cribben", "OM1", "OMNI BIG SOUTH", "Kopp Seed Corn") do not overlap with conventional field names. This means the `@@unique` collision scenario (same field name in both organic and conventional) is a theoretical risk, not a current reality. However, the schema change is still necessary to prevent future data integrity issues as the farm's crop plan evolves.

### Key Finding: Conv/Org Canning Needs Special Attention

The `Conv/Org Canning` enterprise uses `category: "conventional"` but has both ORG and CON system codes. Its 6 fields (Gessert west 111, Home, Jehovah, phillhower east) need to have `enterpriseType` derived from the local Field's `organicStatus`, not from the enterprise category. This is correctly handled by Pattern 2 above.

### Conventional-Specific Cost Categories

Based on inspection of the farm-budget data, conventional enterprises use the same cost category structure as organic (seed, materials/inputs, machinery). Conventional-specific inputs include `RR Soybeans` seed varieties and synthetic crop protection products (in the `inputs` array). The existing category-keyword matching in `budget-summary/route.ts` (fertilizer, chemical, custom) handles these without change — they will appear in the appropriate category rows in the BudgetTab UI.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual sync button in Fields page | On-page-load sync when Budget tab activated | Phase 7 | User never clicks sync; data is always current on Budget tab navigation |
| Organic-only sync filter | All enterprises synced | Phase 7 | Conventional enterprises appear alongside organic in the database |

**Deprecated/outdated:**
- The `handleSyncMacro` button in `src/app/(app)/fields/page.tsx`: Phase 7 moves the sync trigger to the Budget tab. The fields page button can remain for admin use but is no longer the primary sync path.

---

## Open Questions

1. **Does the Conv/Org Canning enterprise have organic-certified fields?**
   - What we know: Its 6 canning fields (peas, snap beans, lima beans) have names not found in current organic field list. The enterprise has both ORG and CON system codes.
   - What's unclear: Whether any of these fields are registered as organic with the farm-registry service (i.e., whether their local `Field.organicStatus` is `ORGANIC`).
   - Recommendation: Use local `Field.organicStatus` as the decision point. If those fields were imported via sync-registry as `ORGANIC`, they'll get `enterpriseType: ORGANIC`. If not, they get `CONVENTIONAL`. No special-casing needed.

2. **Does the fields page Sync Macro button stay or go?**
   - What we know: Phase 7 moves sync trigger to Budget tab navigation. The fields page has a manual "Sync from Macro Roll Up" button.
   - What's unclear: Whether the user wants to keep it as an admin escape hatch.
   - Recommendation: Keep it in place — it's an admin tool and doesn't conflict with the on-load sync. Don't remove unless the user asks.

3. **How many fields are currently in the organic-cert local DB that will match conventional budget fields?**
   - What we know: The sync matches by `bf.name.toLowerCase()` against `fieldNameMap`. Conventional fields have 44 entries in farm-budget. How many of those have corresponding local `Field` records is unknown without querying the DB.
   - What's unclear: Whether conventional fields were already imported via sync-registry.
   - Recommendation: The sync gracefully handles unmatched fields (adds to `results.unmatched`). First run will reveal unmatched count in the response.

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/fields/sync-macro/route.ts` — complete read, verified filter logic, upsert pattern, match key
- `prisma/schema.prisma` lines 291-328 — FieldEnterprise model, @@unique constraint, OrganicStatus enum
- `src/app/api/field-enterprises/[id]/budget-summary/route.ts` — complete read, verified actuals never touched in projected sync
- `farm-budget/data/data.json` — direct inspection of real enterprise and field data
- `src/lib/ecosystem/budget-client.ts` — complete read, getBudgetEnterprises(), getBudgetOrganicFields() patterns
- `src/lib/ecosystem/registry-client.ts` — getRegistryFields() with organicAcres field
- `src/app/(app)/field-enterprises/[id]/page.tsx` — verified existing useEffect load pattern, refreshBudget, Budget tab trigger
- `.planning/STATE.md` — confirmed "Sync upsert match key collision" as a known Phase 7 concern

### Secondary (MEDIUM confidence)
- `src/lib/ecosystem/types.ts` — RegistryField.organicAcres confirmed as organic indicator field
- `src/app/(app)/fields/page.tsx` — confirmed manual sync button location and handleSyncMacro implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies, no new installs needed
- Architecture: HIGH — read actual source of every file involved, verified upsert pattern, real data inspected
- Pitfalls: HIGH — match key collision explicitly flagged in STATE.md; other pitfalls derived from real data inspection
- Conventional data shape: HIGH — inspected actual farm-budget data.json; confirmed same column structure as organic

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable architecture, 30-day validity)
