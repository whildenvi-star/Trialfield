# Phase 16: Field & Enterprise Compilation - Research

**Researched:** 2026-03-02
**Domain:** Compile engine, field mapper, NOP filter, Prisma upsert, grain-tickets delivery read
**Confidence:** HIGH

## Summary

Phase 16 builds on the ecosystem client layer shipped in Phase 15. The core work is three TypeScript modules in `organic-cert/src/lib/compile/` — a field mapper (resolves budget field names to organic-cert Fields by name/alias/stored mapping), an NOP filter (keeps only organic enterprises), and a compile engine (joins the two data sources into preview diff rows). Two Next.js API routes expose preview (GET, no DB writes) and commit (POST, Prisma upsert). The compile page is rebuilt from its Phase 15 scaffold into a full workflow: year selector, readiness dashboard, preview diff table with inline field-mapping dropdowns, and commit button with confirmation dialog.

The key schema concern: there is currently no column to store persisted budget-field-name → organic-cert-field mappings on the `Field` model. The plan must include a Prisma migration adding `farmBudgetFieldName String?` to `Field` before the compile engine can persist and reuse user-supplied mappings. The grain-tickets delivery pull (ECO-03) requires a new function in `tickets-client.ts` that calls `GET /api/tickets?cropYear=N` — tickets carry a free-text `farm` field, so the matching is by field name (case-insensitive), not by a foreign key.

**Primary recommendation:** Implement in two plans: Plan 01 = schema migration + three lib modules + preview API route only (no DB writes). Plan 02 = commit API route + full compile page UI with diff table, mapping resolution, readiness dashboard, and delivery view. This matches the phase plan structure already specified.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Preview Diff Display
- Table grouped by field — one section per field, enterprise rows underneath
- Detailed rows: enterprise name/crop, acres (from farm-registry), source app attribution, and exactly what changed if updating
- Updated records show field-level diffs with old value → new value and color highlighting
- Grain-tickets deliveries: inline summary row per field showing total loads and total lbs delivered, with a link/toggle to expand full ticket list

#### Field Mapping Resolution
- Inline dropdown per unmatched field directly in the preview table — stays in context, no separate panel
- Dropdown only shows existing organic-cert fields (no create-new option; user must create field separately first)
- Mappings auto-persist silently — next compile, previously mapped fields resolve automatically
- A simple list somewhere on the compile page shows saved mappings with ability to delete/edit them

#### Compile Page Workflow
- Single page layout: year selector at top, readiness dashboard below, then preview table, commit button at bottom
- No multi-step wizard — everything scrollable on one page
- Confirmation dialog before commit: "This will create X records and update Y records. Proceed?"
- Allow partial commits — user can commit matched fields and skip unmatched ones; unmatched fields remain for next compile
- After successful commit: refresh preview to show current state (previously "New" records now show as "Unchanged", unmatched fields still visible)

#### Readiness Dashboard
- Section at top of compile page, above the preview table
- Color-coded table: fields as rows, NOP sections as columns (Enterprises, Inputs, Seeds)
- Green/yellow/red cells for completeness status
- Only organic fields shown (conventional fields filtered out — not relevant to NOP)
- Inputs and Seeds columns shown as grayed-out placeholders now (those are Phase 17), giving user a preview of what's coming

### Claude's Discretion
- Exact color palette for status cells (green/yellow/red shades)
- How the expandable grain-tickets detail renders (accordion, popover, etc.)
- Loading states and error handling for ecosystem HTTP calls
- Exact confirmation dialog styling

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ECO-03 | User can see live delivery records pulled from grain-tickets for organic fields | New `getTicketsForField()` function in tickets-client.ts calls `GET /api/tickets?cropYear=N`, filters by field name match. Ticket shape confirmed: `{farm, crop, netWeight, cropYear, date, ticketNo, ...}`. Display as summary row (totalLoads, totalLbs) with expand toggle per field. |
| ECO-04 | User can map farm-budget field names to organic-cert field records when automatic name matching fails | Requires: (1) `farmBudgetFieldName String?` column on `Field` schema (new Prisma migration), (2) field-mapper.ts `resolveField()` function checks name → alias → stored mapping in priority order, (3) compile page shows inline dropdown for unmatched fields, (4) PATCH /api/fields/[id] endpoint saves the mapping (already exists via /api/fields/[id]/route.ts). |
| CMP-01 | User can preview compiled data before committing | GET /api/compile/[year]/preview route calls compile engine (no DB writes), returns CompilePreview shape with new/updated/unchanged/unmatched rows. |
| CMP-02 | User can compile enterprise/field data from farm-budget into organic-cert field records | POST /api/compile/[year] commit route runs Prisma upsert on FieldEnterprise using unique constraint `@@unique([fieldId, cropYear, crop, label])`. Partial commit: only commits matched fields (skips unmapped). |
| CMP-05 | User can see a compilation readiness dashboard showing completeness per NOP section | Readiness query: for each organic Field, check if any FieldEnterprise exists for cropYear (Enterprises column green/red), MaterialUsage exists (Inputs — grayed Phase 17 placeholder), SeedUsage exists (Seeds — grayed Phase 17 placeholder). |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | 6.x (installed) | Upsert FieldEnterprise, query Field/FieldEnterprise for readiness, save farmBudgetFieldName | Already installed, matches organic-cert exactly |
| Next.js App Router | 16.x (installed) | API routes GET /api/compile/[year]/preview and POST /api/compile/[year] | Existing pattern for all organic-cert routes |
| Native fetch + AbortController | built-in | Ecosystem HTTP calls in tickets-client.ts | Already used in budget-client.ts and registry-client.ts |
| Promise.allSettled | built-in | Parallel source fetches with independent failure handling | Already used in fields-preview route |
| React useState/useEffect | 19.x (installed) | Compile page client state | Already used in compile page.tsx |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | installed | Status cell colors, diff highlighting, dropdown styling | All UI in this project uses Tailwind |
| lucide-react | installed | Icons for diff status (plus/minus/equals), expand toggles | Existing icon library in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma upsert on FieldEnterprise | DELETE + INSERT | Upsert preserves child records (SeedUsage, MaterialUsage); delete+insert would orphan them |
| farmBudgetFieldName on Field | Separate BudgetFieldMapping table | Column on Field is simpler — one mapping per field, which matches the 1:1 relationship |
| Inline dropdown on page | Modal/panel for mapping | Inline stays in context per locked decision; simpler to implement |

**Installation:** No new packages required. Zero new npm installs.

---

## Architecture Patterns

### Recommended Project Structure
```
organic-cert/src/
├── lib/
│   └── compile/
│       ├── types.ts          # CompilePreview, PreviewRow, FieldDiff, ReadinessRow types
│       ├── nop-filter.ts     # filterOrganicEnterprises() — keeps category === "organic"
│       ├── field-mapper.ts   # resolveField() — name → alias → farmBudgetFieldName priority
│       └── compile-engine.ts # buildPreview(year) — joins budget + registry + organic-cert DB
├── app/api/compile/
│   ├── sources/route.ts         # already exists (Phase 15)
│   ├── fields-preview/route.ts  # already exists (Phase 15)
│   └── [year]/
│       ├── preview/route.ts  # GET — calls compile-engine, no DB writes (Plan 01)
│       └── route.ts          # POST — commit upsert (Plan 02)
└── app/(app)/compile/
    └── page.tsx              # Rebuilt in Plan 02 with full UI
```

### Pattern 1: Field Mapper Resolution Priority
**What:** `resolveField()` tries three strategies in order and returns the first match.
**When to use:** Called by compile-engine.ts for every budget field name.
**Example:**
```typescript
// src/lib/compile/field-mapper.ts
export interface FieldMatch {
  fieldId: string;
  fieldName: string;
  matchMethod: "name" | "alias" | "stored-mapping";
}

export function resolveField(
  budgetFieldName: string,
  localFields: Array<{ id: string; name: string; farmBudgetFieldName: string | null }>,
  registryAliasMap: Map<string, string> // lc alias → field id
): FieldMatch | null {
  const lc = budgetFieldName.toLowerCase();

  // 1. Exact name match (case-insensitive)
  const byName = localFields.find((f) => f.name.toLowerCase() === lc);
  if (byName) return { fieldId: byName.id, fieldName: byName.name, matchMethod: "name" };

  // 2. Registry alias match (aliases already lowercased in map)
  const aliasId = registryAliasMap.get(lc);
  if (aliasId) {
    const byAlias = localFields.find((f) => f.id === aliasId);
    if (byAlias) return { fieldId: byAlias.id, fieldName: byAlias.name, matchMethod: "alias" };
  }

  // 3. Stored mapping (farmBudgetFieldName persisted from prior manual resolution)
  const byStored = localFields.find(
    (f) => f.farmBudgetFieldName?.toLowerCase() === lc
  );
  if (byStored) return { fieldId: byStored.id, fieldName: byStored.name, matchMethod: "stored-mapping" };

  return null;
}
```

### Pattern 2: NOP Filter
**What:** `filterOrganicEnterprises()` reduces farm-budget enterprises to those with `category === "organic"`.
**When to use:** Called by compile-engine.ts immediately after fetching from budget-client.
**Example:**
```typescript
// src/lib/compile/nop-filter.ts
import type { BudgetEnterprise, BudgetField } from "@/lib/ecosystem/types";

export interface OrganicEnterprise {
  enterprise: BudgetEnterprise;
  fields: BudgetField[];
}

export function filterOrganicEnterprises(
  enterprises: BudgetEnterprise[],
  fields: BudgetField[]
): OrganicEnterprise[] {
  const organic = enterprises.filter((e) => e.category === "organic");
  const organicIds = new Set(organic.map((e) => e.id));
  return organic.map((e) => ({
    enterprise: e,
    fields: fields.filter((f) => organicIds.has(f.enterpriseId)),
  }));
}
```

### Pattern 3: Compile Engine Preview (no DB writes)
**What:** `buildPreview(cropYear)` loads from all three sources, maps fields, compares against existing FieldEnterprise rows, and returns a diff.
**When to use:** Called by GET /api/compile/[year]/preview.
**Example:**
```typescript
// src/lib/compile/compile-engine.ts
export type RowStatus = "new" | "update" | "unchanged" | "unmatched";

export interface EnterpriseRow {
  budgetFieldName: string;
  budgetEnterpriseName: string;
  crop: string;
  plantedAcres: number;          // from farm-registry (falls back to budget)
  registryAcres: number | null;
  fieldId: string | null;        // null if unmatched
  fieldName: string | null;
  matchMethod: "name" | "alias" | "stored-mapping" | null;
  existingEnterpriseId: string | null;
  status: RowStatus;
  diff: FieldDiff | null;        // populated for "update" rows
}

export interface FieldDiff {
  crop?: { old: string; new: string };
  plantedAcres?: { old: number; new: number };
}

export interface CompilePreview {
  cropYear: number;
  rows: EnterpriseRow[];
  summary: { new: number; update: number; unchanged: number; unmatched: number };
  deliveries: Record<string, TicketSummary>;  // keyed by fieldId
  readiness: ReadinessRow[];
}
```

### Pattern 4: Prisma Upsert on FieldEnterprise
**What:** Uses `upsert` with the composite unique `[fieldId, cropYear, crop, label]` as the where clause.
**When to use:** POST /api/compile/[year] commit route, for each matched row in the preview.
**Example:**
```typescript
// In POST /api/compile/[year]/route.ts
await prisma.fieldEnterprise.upsert({
  where: {
    fieldId_cropYear_crop_label: {
      fieldId: row.fieldId,
      cropYear,
      crop: row.crop,
      label: null,   // NOP enterprises: one enterprise per field per year per crop
    },
  },
  create: {
    fieldId: row.fieldId,
    cropYear,
    crop: row.crop,
    plantedAcres: row.plantedAcres,
    organicStatus: "ORGANIC",
    lotNumber: generateLotNumber(cropYear, row.crop, row.fieldName ?? ""),
  },
  update: {
    plantedAcres: row.plantedAcres,
    crop: row.crop,
  },
});
```

NOTE: Prisma composite unique where clause name follows the pattern `fieldId_cropYear_crop_label` — verify this matches the auto-generated name from `@@unique([fieldId, cropYear, crop, label])` in schema.prisma. The label null case must be handled: Prisma treats null as part of the unique key (partial index was added in Phase 15 for label IS NULL). Confirm the migration for the partial unique index is in place.

### Pattern 5: Schema Migration for farmBudgetFieldName
**What:** Add `farmBudgetFieldName String?` to the `Field` model via a new Prisma migration.
**When to use:** Plan 01 Task 1 — must ship before field-mapper.ts can use it.
**Example:**
```bash
# In organic-cert/:
npx prisma migrate dev --name add_farm_budget_field_name
```
The migration SQL will be:
```sql
ALTER TABLE "Field" ADD COLUMN "farmBudgetFieldName" TEXT;
```
After migration, the PATCH /api/fields/[id] route needs to accept `farmBudgetFieldName` as an updatable field (currently it does not — check `/api/fields/[id]/route.ts`).

### Pattern 6: Grain-Tickets Delivery Pull (ECO-03)
**What:** `getTicketsForCropYear(cropYear)` fetches all tickets for a season, caller groups by field name.
**When to use:** compile-engine.ts calls this to populate delivery summaries per field.
**Example:**
```typescript
// src/lib/ecosystem/tickets-client.ts — new function
export interface TicketRecord {
  id: number;
  farm: string;     // field name in grain-tickets (free-text)
  crop: string;
  netWeight: number;
  cropYear: number;
  date: string;
  ticketNo: string;
}

export async function getTicketsForCropYear(cropYear: number): Promise<TicketRecord[]> {
  const res = await fetchWithTimeout(
    `${TICKETS_URL}/api/tickets?cropYear=${cropYear}`,
    "grain-tickets",
    FRIENDLY,
    FIX
  );
  if (!res.ok) {
    throw new EcosystemError("grain-tickets", `HTTP ${res.status}`, "grain-tickets error", FRIENDLY, FIX);
  }
  const raw: unknown[] = await res.json();
  return (raw as TicketRecord[]).map((t) => ({
    id: Number(t.id),
    farm: String((t as Record<string, unknown>).farm ?? ""),
    crop: String((t as Record<string, unknown>).crop ?? ""),
    netWeight: Number((t as Record<string, unknown>).netWeight ?? 0),
    cropYear: Number((t as Record<string, unknown>).cropYear ?? 0),
    date: String((t as Record<string, unknown>).date ?? ""),
    ticketNo: String((t as Record<string, unknown>).ticketNo ?? ""),
  }));
}
```
Matching tickets to organic-cert fields: after fetching, `compile-engine.ts` groups tickets by `t.farm.toLowerCase()` and joins to resolved fields by name. Alias-matching is done at the compile-engine level (not in tickets-client).

### Pattern 7: Readiness Dashboard Query
**What:** For each organic Field in the farm, count FieldEnterprise rows for the given cropYear.
**When to use:** Called by compile-engine.ts or directly by preview route.
**Example:**
```typescript
// In compile-engine.ts
const organicFields = await prisma.field.findMany({
  where: { farmId: farm.id, organicStatus: { not: "CONVENTIONAL" } },
  include: {
    enterprises: {
      where: { cropYear },
      select: { id: true },
    },
  },
});

const readiness: ReadinessRow[] = organicFields.map((f) => ({
  fieldId: f.id,
  fieldName: f.name,
  enterprises: f.enterprises.length > 0 ? "compiled" : "missing",
  inputs: "pending",   // Phase 17
  seeds: "pending",    // Phase 17
}));
```

### Anti-Patterns to Avoid
- **Using `create` instead of `upsert` on FieldEnterprise:** Running compile twice on the same year would violate the unique constraint. Always use `upsert`.
- **Deleting all FieldEnterprise before re-creating:** This destroys child records (SeedUsage, MaterialUsage, FieldOperation). Upsert preserves them.
- **Writing DB during preview:** The preview route is explicitly NO-DB-WRITE. Any accidental Prisma mutation in the preview path breaks the preview-before-commit contract.
- **Blocking commit on unmatched fields:** Partial commit is a locked decision — matched fields commit, unmatched fields stay in preview for next time.
- **Case-sensitive field name matching:** Budget field names like "Koppsite" vs "Koppsite" — always `.toLowerCase()` before comparing.
- **Assuming `label: null` upsert works without partial index:** The partial unique index for `label IS NULL` was added in Phase 15 migration `20260303025533_add_partial_unique_enterprise_label_null`. Confirm it's applied before running compile upserts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Composite upsert matching | Manual find + conditional create/update | `prisma.fieldEnterprise.upsert()` | Atomic, handles race conditions, correct composite key semantics |
| Field name alias lookup | Custom trie or fuzzy matcher | Simple Map built from registry aliases + lowercasing | Aliases are already in RegistryField.aliases from registry-client |
| Confirmation dialog | Custom modal from scratch | Native `window.confirm()` OR simple inline state-driven JSX | App already uses simple state patterns; no modal library installed |
| Partial commit tracking | Server-side session state | Client sends explicit list of fieldIds to commit | Stateless API, simpler |
| Readiness completeness % | Complex heuristic | Binary green/missing per section for Phase 16 (Phase 17 fills in inputs/seeds) | Simpler now, phases fill in later |

**Key insight:** The field-mapper, nop-filter, and compile-engine are pure TypeScript functions with no side effects. They should be in `src/lib/compile/` not in route files — this makes them independently testable and callable from multiple routes.

---

## Common Pitfalls

### Pitfall 1: Prisma Composite Unique Key Name for Null Label
**What goes wrong:** `prisma.fieldEnterprise.upsert({ where: { fieldId_cropYear_crop_label: { ..., label: null } } })` may fail or match incorrectly without the partial unique index.
**Why it happens:** PostgreSQL treats `NULL != NULL` in standard unique constraints. The partial index added in Phase 15 (`UNIQUE WHERE label IS NULL`) is what makes upsert-on-null-label work.
**How to avoid:** Verify the Phase 15 migration `20260303025533_add_partial_unique_enterprise_label_null` is applied. Run `npx prisma migrate status` in organic-cert to confirm.
**Warning signs:** `upsert` throws a unique constraint violation on second compile, or creates duplicate rows.

### Pitfall 2: farm-budget fieldNames vs. fields Array
**What goes wrong:** `BudgetEnterprise.fieldNames` is built from `enterprise.fields[].name` in budget-client.ts. But the `/api/fields?all=true` endpoint returns fields with `enterpriseId` — the matcher also uses `organicEntIds.has(f.enterpriseId)`. If an enterprise has no `fields` array in the JSON but has fields linked by enterpriseId, `fieldNames` will be empty but the field will still be returned.
**Why it happens:** farm-budget stores enterprises and fields as separate arrays in data.json; the link is `field.enterpriseId`.
**How to avoid:** compile-engine.ts should use `BudgetField.enterpriseId` (not `fieldNames` from BudgetEnterprise) as the primary join key between enterprises and fields. The `fieldNames` on BudgetEnterprise is a convenience that may not be populated for all enterprise types.
**Warning signs:** Organic fields missing from compile preview even when farm-budget is running.

### Pitfall 3: Grain-Tickets Farm Field is Free-Text (not FK)
**What goes wrong:** Matching grain-tickets deliveries to organic-cert fields by `ticket.farm === field.name` fails for naming variations like "Kopps" vs "Kopp's" or "Simpson North" vs "Simpson N".
**Why it happens:** Grain-tickets `farm` column is a free-text string. There is no FK to any organic-cert or farm-registry record.
**How to avoid:** For Phase 16, use case-insensitive exact match first. Include registry aliases as fallback. Document in the UI when a delivery field name doesn't match any organic field (show as unattached deliveries).
**Warning signs:** Delivery section shows zero loads for all fields even when grain-tickets is running and has tickets for the crop year.

### Pitfall 4: PATCH /api/fields/[id] Does Not Accept farmBudgetFieldName Yet
**What goes wrong:** The compile page sends a PATCH to save the user's manual mapping, but the route only updates the fields in its current allowlist.
**Why it happens:** The `/api/fields/[id]/route.ts` was written before this mapping concept existed.
**How to avoid:** Plan 01 must add `farmBudgetFieldName` to the PATCH route's updatable fields list, alongside adding the schema column.
**Warning signs:** PATCH returns 200 but `farmBudgetFieldName` is null on next compile.

### Pitfall 5: organic-cert is a Nested Git Repo
**What goes wrong:** Running `git commit` from project root does not commit organic-cert changes.
**Why it happens:** organic-cert has its own `.git` directory (confirmed in STATE.md Phase 15-02 decisions).
**How to avoid:** All commits for organic-cert changes use `cd organic-cert && git add -p && git commit ...` from within the organic-cert directory.
**Warning signs:** `git status` at project root shows no changes even though files were modified.

### Pitfall 6: Year Selector Requires Knowing the Current Crop Year
**What goes wrong:** The compile page year selector has nothing to default to if `farm-budget` settings aren't fetched.
**Why it happens:** farm-budget stores the current season year in `store.settings.year` (currently 2026). The compile page needs this to show the right default year.
**How to avoid:** Add `getBudgetSettings()` to budget-client.ts. The preview API route returns the current budget year in its response. Or: default to `new Date().getFullYear()` as a safe fallback — the user can change it via the year selector.
**Warning signs:** Year selector shows wrong year or is empty on load.

---

## Code Examples

Verified from reading actual codebase files:

### FieldEnterprise Unique Constraint (from schema.prisma)
```prisma
// @@unique([fieldId, cropYear, crop, label])
// Prisma-generated where key name: fieldId_cropYear_crop_label
model FieldEnterprise {
  ...
  @@unique([fieldId, cropYear, crop, label])
  @@index([fieldId, cropYear])
}
```

### Existing Field Model — columns available for mapping
```prisma
model Field {
  id              String        @id @default(cuid())
  farmId          String
  name            String
  totalAcres      Float
  organicStatus   OrganicStatus @default(CONVENTIONAL)
  registryId      String?       // farm-registry cross-reference
  ownership       String?
  organicAcres    Float         @default(0)
  // farmBudgetFieldName String? — MISSING, must add in Phase 16 Plan 01 migration
  @@unique([farmId, name])
}
```

### Ticket Shape from grain-tickets /api/tickets
```javascript
// grain-tickets dbTicketToJson returns:
{
  id: number,          // integer PK
  date: "YYYY-MM-DD",
  farm: string,        // free-text field name (e.g., "Kopps", "Simpson North")
  netWeight: number,   // lbs
  moisture: number,
  fm: number,
  crop: string,        // e.g., "Org SRWW", "Org Peas", "Organic Yellow Corn"
  ticketNo: string,
  notes: string,
  hbtBinNo: string | null,
  truckId: string | null,
  buyerId: number | null,
  grainBinId: number | null,
  destination: string | null,
  cropYear: number,
  _reconciliation: { status: string, lineCount: number }
}
```

### /api/tickets filtering support (grain-tickets server.js)
```javascript
// GET /api/tickets supports query params:
// ?buyerId=N   — filter by buyer
// ?grainBinId=N — filter by bin
// ?cropYear=N  — filter by crop year (e.g., ?cropYear=2025)
// No farm-name filter exists — must filter client-side after fetch
```

### farm-budget Enterprise Shape (from data.json + budget-client.ts)
```typescript
// BudgetEnterprise (from ecosystem/types.ts):
{
  id: "ent_2056",
  name: "Organic Corn",
  category: "organic",          // "organic" | "conventional"
  systemCodes: ["ORG", "ORG IRR"],
  fieldNames: string[],         // built from enterprise.fields[].name
  acres: number,
}

// BudgetField (from ecosystem/types.ts):
{
  id: string,
  name: string,                 // field name, e.g., "Kopps"
  crop: string,                 // e.g., "Yellow Corn", "Organic SRWW"
  acres: number,
  enterpriseId: string,         // links to BudgetEnterprise.id
}
```

### Existing compile page pattern (Phase 15 scaffold to rebuild)
```typescript
// organic-cert/src/app/(app)/compile/page.tsx — "use client"
// Already has: useEffect for loadSources + loadPreview, SourceStatusBar component
// Phase 16 replaces the placeholder sections with real enterprise diff table
// Year selector: add <select> with options built from current budget year ± 2
```

### PATCH /api/fields/[id] — where to add farmBudgetFieldName
```typescript
// organic-cert/src/app/api/fields/[id]/route.ts — PATCH handler
// Currently updates: totalAcres, organicStatus, notes, transitionDate, etc.
// Must add: farmBudgetFieldName to the updatable fields list
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual data entry in organic-cert | Compile engine pulls from farm-budget | Phase 16 (this phase) | Single source of truth for organic enterprises |
| Free-text field name matching | Three-tier: name → alias → stored mapping | Phase 16 | Handles naming variations without silent data loss |
| No mapping persistence | farmBudgetFieldName column on Field | Phase 16 | Users resolve mismatches once; compile auto-resolves thereafter |

---

## Open Questions

1. **Does `/api/fields/[id]/route.ts` need a dedicated PATCH endpoint or does PUT serve?**
   - What we know: The route file exists at `organic-cert/src/app/api/fields/[id]/route.ts`. The sync-registry route uses `prisma.field.update()` directly.
   - What's unclear: Whether the existing route handler accepts PATCH vs PUT, and what fields it currently allows.
   - Recommendation: Read `/api/fields/[id]/route.ts` at plan time and add `farmBudgetFieldName` to whatever update handler exists. If only PUT exists, that's fine — the client can send PUT with just the mapping field.

2. **How does the compile page know which crop year farm-budget is configured for?**
   - What we know: farm-budget `/api/settings` returns `{ year: 2026, ... }`. budget-client.ts has `pingBudget()` using this endpoint.
   - What's unclear: Whether the preview route should include the budget year in its response or if the client should default to current year.
   - Recommendation: Add `getBudgetSettings()` to budget-client.ts (fetches `/api/settings`), include budget year in the preview API response as `suggestedYear`. Client defaults year selector to `suggestedYear` or `new Date().getFullYear()` if unavailable.

3. **How many tickets will `getTicketsForCropYear()` return and is pagination needed?**
   - What we know: 527 tickets total in data.json, 100-500 loads per season, the API has no pagination.
   - What's unclear: Exact count for 2025 crop year only.
   - Recommendation: No pagination needed. 500 tickets at ~400 bytes each = ~200KB payload. Acceptable for a server-to-server call with 8-second timeout. If slow, reduce AbortController timeout to 5s instead of 8s for this endpoint.

4. **Does `label: null` in the upsert where clause work with Prisma and the partial unique index?**
   - What we know: The partial unique index was added in Phase 15 migration `20260303025533_add_partial_unique_enterprise_label_null`. The Prisma schema has `@@unique([fieldId, cropYear, crop, label])`.
   - What's unclear: Whether Prisma 6.x correctly uses the partial index when `label: null` is the where clause.
   - Recommendation: Test with a simple upsert in a throwaway script before the full commit route. If Prisma doesn't use null in the where clause correctly, fall back to `findFirst` + conditional `create`/`update` pattern.

---

## Validation Architecture

> workflow.nyquist_validation is not present in .planning/config.json — section omitted.

---

## Implementation Sequence (for Planner)

The two plans map cleanly:

**Plan 01 (lib + preview API only):**
1. Prisma migration: `farmBudgetFieldName String?` on Field + add to PATCH /api/fields/[id]
2. `src/lib/compile/types.ts` — all Phase 16 types
3. `src/lib/compile/nop-filter.ts` — filterOrganicEnterprises()
4. `src/lib/compile/field-mapper.ts` — resolveField() with three-tier resolution
5. `src/lib/compile/compile-engine.ts` — buildPreview(cropYear) — reads DB + ecosystem, no writes
6. `src/lib/ecosystem/tickets-client.ts` — add getTicketsForCropYear()
7. `src/app/api/compile/[year]/preview/route.ts` — GET, calls buildPreview, returns CompilePreview

**Plan 02 (commit route + full page UI):**
1. `src/app/api/compile/[year]/route.ts` — POST commit, Prisma upsert FieldEnterprise
2. `src/app/(app)/compile/page.tsx` — full rebuild: year selector, readiness dashboard, preview diff table with inline mapping dropdowns, grain-tickets delivery rows, commit button + confirmation dialog, saved mappings list

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `organic-cert/prisma/schema.prisma` — Field model, FieldEnterprise model, unique constraints
- Direct file reads: `organic-cert/src/lib/ecosystem/` — all 5 client files, confirmed API shapes
- Direct file reads: `organic-cert/src/app/(app)/compile/page.tsx` — Phase 15 scaffold
- Direct file reads: `organic-cert/src/app/api/compile/fields-preview/route.ts` — Promise.allSettled pattern
- Direct file reads: `grain-tickets/server.js` — /api/tickets endpoint, dbTicketToJson shape, ?cropYear query param
- Direct file reads: `farm-budget/server.js` + `farm-budget/data/data.json` — enterprise/field shapes, /api/settings endpoint
- Direct file reads: `organic-cert/src/app/api/fields/sync-registry/route.ts` — existing field upsert pattern
- Direct file reads: `organic-cert/src/app/api/field-enterprises/route.ts` — existing FieldEnterprise create pattern
- Direct file reads: `.planning/STATE.md` — organic-cert nested git repo decision, Phase 15 decisions

### Secondary (MEDIUM confidence)
- Prisma documentation pattern for composite unique upsert with null — based on known Prisma 6.x behavior + partial index in schema. Validate with `npx tsc --noEmit` after implementation.

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed, no new packages needed
- Architecture: HIGH — file-mapper/nop-filter/compile-engine pattern is directly modeled on existing sync-registry and fieldops-normalizer patterns in the codebase
- Pitfalls: HIGH — all pitfalls identified from actual code reads (null label upsert, free-text farm field, nested git repo, PATCH allowlist)
- ECO-03 (grain-tickets delivery): HIGH — confirmed /api/tickets endpoint, ?cropYear param, ticket shape

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable stack, low churn)
