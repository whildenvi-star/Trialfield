# Phase 2: Field Records & History - Research

**Researched:** 2026-02-24
**Domain:** Next.js App Router UI (field-centric timeline) + Prisma queries + manual entry forms
**Confidence:** HIGH (entire stack already exists and is proven in this repo; all Prisma models are in schema.prisma; codebase read directly)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Field History View Layout**
- Vertical timeline grouped by growing season, operations in chronological order within each season
- Summary card per operation (date, type badge, field, key metric), click to expand for full details
- Color-coded badges by operation type: green for applications, amber for harvest, blue for tillage
- Season summary stats at top of each season header: crop planted, total applications count, total acres treated, harvest yield
- Empty seasons displayed with "No operations recorded" message and "Add records" button (important for audit continuity)
- Default 3-year window (current year and 2 prior), with year selector to shift the window for longer history
- Subtle source indicator: sync icon for API-synced records, pencil icon for manual entries
- Expanded card shows approval info: "Approved by [name] on [date]" or "Pending review" for synced records
- Notes/annotations supported on individual records (freeform text for context like "Applied due to pest outbreak")
- Print-friendly view available via "Print" button (basic, feeds into Phase 3 for full reports)
- Responsive design — timeline adapts to mobile with stacked cards, touch-friendly expand/collapse
- View-only timeline; "Edit" button on expanded card opens the manual entry form pre-filled with record data

**Manual Entry Forms**
- Claude's discretion: separate forms per operation type OR unified form with type selector (pick based on field count differences)
- Searchable dropdown for field selection (type-ahead search, supports 50+ fields, shows field name + acres + current crop)
- Smart defaults: pre-fill date to today, default field to last-used, suggest products from recent applications
- Post-save: show success toast, clear form (keep field + date), show "Add Another" button for batch entry
- Same data model as synced records — manual entries use the same underlying FieldOperation/HarvestEvent models

**Record Detail — Applications**
- Product name + application rate + rate unit (lbs/acre, gal/acre, etc.)
- Multiple products per application supported

**Record Detail — Harvests**
- Yield, date, field, auto-generated lot number, equipment used
- Lot number format: cropYear-crop-fieldName (e.g., "2025-Corn-HomePlaceSouth"), auto-generated with manual override option
- Equipment selection: searchable list from Case IH FieldOps fleet (getEquipment API), plus ability to add non-Case IH equipment from other manufacturers. List handles multiple units of same type (multiple combines, multiple articulated tractors, etc.)

**Record Detail — Tillage**
- Operation type only (chisel plow, disk, field cultivator, etc.) plus date and field
- No depth or additional details required

**Compliance**
- No compliance indicators on the history view — compliance analysis deferred to Phase 3 reports

**Navigation & Filtering**
- Primary entry point: field-centric (select a field, then see its history timeline)
- Field index page: cards or rows showing field name, acres, current crop, last operation date, record count
- Field index supports text search + sort by name, acres, last activity date, record count
- History timeline filtering: full filter bar — type, date range, product name, approval status, data source (synced vs manual)
- Season selector already handles the year dimension

### Claude's Discretion
- Form design approach (separate per type vs unified with type selector)
- Exact spacing, typography, card shadow styling
- Loading skeleton design
- Error state handling
- Exact filter bar component layout

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIELD-01 | Farm manager can view 3-year field history per parcel (crops, inputs, dates) | Data exists across FieldEnterprise, FieldOperation, MaterialUsage, HarvestEvent, FertilityEvent tables. Query pattern: GET /api/fields/[id]/history?years=3 with Prisma `include` across enterprises. New route + field-centric page needed. |
| FIELD-02 | Farm manager can view input application records (material, date, rate, field, approval status) | MaterialUsage table has all fields. Approval status derived from SyncedOperation.reviewedByUserId + notes prefix detection. New API route GET /api/fields/[id]/applications and dedicated view section. |
| FIELD-03 | Farm manager can view harvest records (yield, date, field, lot number, equipment) | HarvestEvent table has all fields. Lot number lives on FieldEnterprise or CropLot. CropLot auto-creation on HarvestEvent POST is a gap — must be added in Phase 2. |
| FIELD-04 | Farm manager can view tillage operation records per field | FieldOperation.type = TILLAGE rows already stored. Filtered view of existing FieldOperation API. |
| FIELD-05 | Farm manager can manually enter field records for pre-API or non-synced data | Forms already exist in field-enterprises/[id] page. Need a dedicated field-centric manual entry flow with smart defaults and batch support. Data model is identical to synced records. |
| FIELD-06 | System auto-generates lot numbers for harvest records (cropYear-crop-fieldName) | lot-generator.ts exists. FieldEnterprise.lotNumber auto-generated on enterprise create. HarvestEvent must auto-create CropLot with lot number from parent enterprise. This linkage is missing — POST /api/field-enterprises/[id]/harvest needs CropLot creation step. |
</phase_requirements>

---

## Summary

Phase 2 is primarily a **UI and query layer** built on top of a database schema that already exists in full. All the Prisma models needed — `FieldEnterprise`, `FieldOperation`, `HarvestEvent`, `MaterialUsage`, `FertilityEvent`, `CropLot` — are already defined in `schema.prisma` and working. The `lot-generator.ts` for FIELD-06 is already written and used. The main deliverables are: (1) a new field-centric history timeline page at `/fields/[id]/history`, (2) a field index page upgrade to show last operation date and record count, (3) manual entry forms accessible from the timeline, and (4) one schema/API gap fix: `HarvestEvent` creation must auto-create a linked `CropLot` row.

The existing `field-enterprises/[id]/page.tsx` already shows operations, applications, and harvests per enterprise. Phase 2 reorganizes this into a field-centric view (one field across multiple years/enterprises rather than one enterprise at a time) and adds the timeline/season grouping UI. The filter bar, source indicator (synced vs manual), and approval provenance display require a data source tagging approach — currently, the only signal is whether `FieldOperation.notes` starts with `"Imported from Case IH FieldOps"`. Adding an explicit `dataSource` enum column to `FieldOperation` and `HarvestEvent` is the correct fix and requires a Prisma migration.

The key architectural insight: manual entry forms should write directly to `FieldOperation`/`HarvestEvent` (same as Phase 1 established), while the timeline view merges all record types from multiple `FieldEnterprise` rows under one field. The Prisma query for the history timeline is: `Field → enterprises (3 years) → each enterprise's operations, applications, harvests, fertility events`, merged and sorted chronologically.

**Primary recommendation:** Build `/fields/[id]/history` as the main Phase 2 page. Add `dataSource` field to schema. Fix CropLot auto-creation gap. Use separate forms per operation type (tillage, application, harvest) — field counts differ enough (tillage: 3 fields vs harvest: 8+ fields) that a unified form with conditional sections creates more confusion than separate forms. Reuse existing UI components (`shadcn/ui` Card, Badge, Dialog, Sheet, Select) throughout.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.6 | Page routing, API routes | Already in use. All pages follow `(app)/[route]/page.tsx` pattern. |
| Prisma Client | ^6.19.2 | All DB queries for history timeline | Already installed. Query pattern: `findMany` with nested `include` across enterprise hierarchy. |
| shadcn/ui | ^3.8.5 | Card, Badge, Dialog, Sheet, Select, Tabs | Already installed. Style: `new-york`, base color: `neutral`. All components in `src/components/ui/`. |
| Tailwind CSS | ^4 | Styling | Already in use. Brand green: `#2d5a27`. Stone palette for backgrounds/text. |
| `date-fns` | ^4.1.0 | Date formatting, season boundary calculation | Already installed. Use `format`, `getYear`, `parseISO`, `startOfYear`, `endOfYear`. |
| `lucide-react` | ^0.575.0 | Icons: RefreshCw (sync), Pencil (manual), Wheat, FlaskConical, Tractor | Already installed. |
| `sonner` | ^2.0.7 | Toast on form save | Already installed. Pattern: `toast.success("Record saved")`. |
| `cmdk` | ^1.1.1 | Searchable field/equipment dropdown (50+ fields/equipment) | Already installed. Used in Phase 1 matching UI. Same need here for field selector and equipment selector. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Form validation on manual entry | Already installed. Use `z.object()` to validate POST body in API routes. |
| `next-auth` v5 | ^5.0.0-beta.30 | Session for `operatorId` on manual records | Already installed. Use `auth()` in API routes to get current user. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate forms per operation type | Unified form with type selector | Separate forms: cleaner UX for each type (no conditional field hiding), easier to validate per type. Unified form: single route for all manual entry. RECOMMENDATION: separate forms — field counts differ significantly (tillage: ~3 vs harvest: 8+). |
| Inline notes field on existing notes column | New `dataSource` schema column | notes prefix detection is fragile (anyone could manually type "Imported from..."). `dataSource` enum is authoritative. RECOMMENDATION: add `dataSource` column. |
| `cmdk` for field/equipment search | Standard `<select>` | Standard select breaks at 50+ items. `cmdk` provides type-ahead, keyboard navigation, accessible. Already installed. |

**Installation:**
```bash
# No new packages needed — all libraries already installed in organic-cert
# Only change: Prisma migration to add dataSource field
```

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 2 (existing files in parentheses):

```
organic-cert/
├── prisma/
│   └── schema.prisma               # EXTEND: add dataSource enum + field to FieldOperation, HarvestEvent
│                                   # EXTEND: HarvestEvent create triggers CropLot auto-creation
├── src/
│   ├── lib/
│   │   └── (lot-generator.ts)      # EXISTING — generateLotNumber already works
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── fields/
│   │   │   │   ├── (page.tsx)      # EXISTING — upgrade: add lastActivity, record count columns
│   │   │   │   └── [id]/
│   │   │   │       └── history/
│   │   │   │           └── page.tsx # NEW: field-centric 3-year timeline
│   │   │   └── records/
│   │   │       └── new/
│   │   │           └── page.tsx    # NEW: manual entry hub (or embed in history page as sheet)
│   │   └── api/
│   │       ├── fields/
│   │       │   ├── (route.ts)      # EXISTING
│   │       │   └── [id]/
│   │       │       ├── (route.ts)  # EXISTING
│   │       │       └── history/
│   │       │           └── route.ts # NEW: GET 3-year history aggregated per field
│   │       └── field-enterprises/
│   │           └── [id]/
│   │               ├── (harvest/route.ts) # EXTEND: auto-create CropLot after HarvestEvent
│   │               ├── (operations/route.ts) # EXTEND: set dataSource = MANUAL on create
│   │               └── (applications/route.ts) # EXTEND: set dataSource = MANUAL on create
```

### Pattern 1: Field History Query — Prisma Aggregation

**What:** Query a single field's complete 3-year operation history by joining through `FieldEnterprise`. Returns all operation types merged into a timeline.

**When to use:** `GET /api/fields/[id]/history` route handler.

**Example:**
```typescript
// Source: schema.prisma — Field → enterprises → operations/harvest/applications
// In /api/fields/[id]/history/route.ts

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

const field = await prisma.field.findUnique({
  where: { id: fieldId },
  include: {
    enterprises: {
      where: { cropYear: { in: years } },
      orderBy: { cropYear: "desc" },
      include: {
        fieldOperations: {
          include: { equipment: true, operator: true },
          orderBy: { operationDate: "asc" },
        },
        materialUsages: {
          include: { material: true },
          orderBy: { applicationDate: "asc" },
        },
        harvestEvents: {
          include: { equipment: true, operator: true, cropLots: true },
          orderBy: { harvestDate: "asc" },
        },
        fertilityEvents: {
          orderBy: { applicationDate: "asc" },
        },
      },
    },
  },
});
```

**Key insight:** Season headers = one `FieldEnterprise` per `cropYear`. Empty seasons = years with no `FieldEnterprise` row. The timeline view must synthesize both.

### Pattern 2: Season Gap Detection

**What:** The 3-year window is `[currentYear, currentYear-1, currentYear-2]`. For each year, check if a `FieldEnterprise` row exists. If not, render an empty season card with "No operations recorded" + "Add Records" button.

**When to use:** In the history page `page.tsx` when rendering the timeline.

**Example:**
```typescript
// In fields/[id]/history/page.tsx (client component)
const years = [currentYear, currentYear - 1, currentYear - 2];

return (
  <div className="space-y-6">
    {years.map((year) => {
      const enterprise = enterprises.find((e) => e.cropYear === year);
      if (!enterprise) {
        return (
          <SeasonEmptyCard
            key={year}
            year={year}
            fieldId={fieldId}
          />
        );
      }
      return <SeasonCard key={year} enterprise={enterprise} />;
    })}
  </div>
);
```

### Pattern 3: Data Source Tagging — Schema Extension

**What:** Add a `DataSource` enum and `dataSource` field to `FieldOperation` and `HarvestEvent`. Set `MANUAL` when created via form submission. Set `SYNCED` when created via staged-ops approval flow.

**When to use:** Every `FieldOperation.create` and `HarvestEvent.create` call.

**Schema extension:**
```prisma
// In schema.prisma — ADD to existing models

enum DataSource {
  MANUAL
  SYNCED
}

model FieldOperation {
  // ... existing fields ...
  dataSource    DataSource  @default(MANUAL)
}

model HarvestEvent {
  // ... existing fields ...
  dataSource    DataSource  @default(MANUAL)
}
```

**Migration:** Run `prisma migrate dev --name add-datasource-field`. Default of `MANUAL` ensures all historical records remain valid.

**Update staged-ops approval route:** Change from notes-string detection to explicit field:
```typescript
// In staged-ops/[id]/route.ts — CHANGE existing harvest create:
const harvestEvent = await prisma.harvestEvent.create({
  data: {
    // ... existing fields ...
    dataSource: "SYNCED",  // ADD THIS
    notes: `Imported from Case IH FieldOps (syncRunId: ${stagedOp.syncRunId})`,
  },
});
```

### Pattern 4: CropLot Auto-Creation on HarvestEvent

**What:** When a `HarvestEvent` is created (manual or synced), auto-create a linked `CropLot` row with the lot number derived from the parent `FieldEnterprise`.

**When to use:** `POST /api/field-enterprises/[id]/harvest` route. Also in the staged-ops approval path for yield-type operations.

**Example:**
```typescript
// In /api/field-enterprises/[id]/harvest/route.ts — EXTEND existing POST handler

// After creating harvestEvent, load the enterprise for lot number
const enterprise = await prisma.fieldEnterprise.findUnique({
  where: { id },
  include: { field: true },
});

if (enterprise?.lotNumber && record.acresHarvested) {
  // Compute net weight for CropLot quantity
  const netWeightLbs = body.netWeight
    ?? (body.yieldPerAcre && body.yieldUnit === "bu"
       ? body.yieldPerAcre * record.acresHarvested * 56  // bu to lbs (corn = 56 lbs/bu)
       : null);

  await prisma.cropLot.create({
    data: {
      fieldEnterpriseId: id,
      harvestEventId: record.id,
      lotNumber: enterprise.lotNumber,  // from FieldEnterprise
      crop: enterprise.crop,
      organicStatus: enterprise.organicStatus,
      quantityLbs: netWeightLbs ?? 0,
      notes: body.notes ?? null,
    },
  });
}
```

**Important:** `CropLot.lotNumber` has a `@unique` constraint. If the enterprise already has a CropLot (from a prior harvest on the same enterprise), the second harvest needs a variant lot number (e.g., `2025-CORN-KOPP-2`). Handle uniqueness with try/catch and append a suffix counter.

### Pattern 5: Manual Entry Form with Smart Defaults

**What:** Separate forms per operation type (tillage, application, harvest). Each form pre-fills date to today and remembers last-used field via `localStorage`. After save: toast + form reset (retain field + date) + "Add Another" button stays visible.

**When to use:** Manual entry accessible from the history timeline via a "Add Record" button or "+ New Record" in the field index.

**Recommended form design:** Use `Sheet` (slide-over panel) from shadcn/ui rather than `Dialog` for forms — forms with 5+ fields need more vertical space than a centered modal, and a sheet gives a natural "fill in details" UX without losing timeline context.

```typescript
// Pattern for smart defaults in manual entry form
const [form, setForm] = useState({
  fieldId: lastUsedFieldId ?? "",   // from localStorage
  date: format(new Date(), "yyyy-MM-dd"),  // today
  // ... other fields
});

// After successful save:
function resetAfterSave() {
  const savedFieldId = form.fieldId;
  const savedDate = form.date;
  setForm(defaultForm());
  setForm((f) => ({ ...f, fieldId: savedFieldId, date: savedDate }));
  toast.success("Record saved");
}
```

### Pattern 6: Field Index Upgrade

**What:** Extend `GET /api/fields` to include `lastActivityDate` and `recordCount` computed from `FieldOperation + HarvestEvent + MaterialUsage`. Used by the field index page for sorting and display.

**When to use:** Fields index page at `/fields`.

**API query extension:**
```typescript
// Extend GET /api/fields to compute activity stats
const fields = await prisma.field.findMany({
  include: {
    enterprises: {
      include: {
        _count: {
          select: { fieldOperations: true, harvestEvents: true, materialUsages: true },
        },
        fieldOperations: { orderBy: { operationDate: "desc" }, take: 1 },
        harvestEvents: { orderBy: { harvestDate: "desc" }, take: 1 },
        materialUsages: { orderBy: { applicationDate: "desc" }, take: 1 },
      },
    },
  },
  orderBy: { name: "asc" },
});

// Compute lastActivityDate and totalRecords in the route handler
// before returning JSON
```

### Anti-Patterns to Avoid

- **Querying all enterprises and filtering client-side:** Always filter by `cropYear: { in: years }` in Prisma — not in JavaScript after fetching. Large farms have many enterprise rows.
- **Relying on notes string to detect data source:** The `notes` prefix `"Imported from Case IH FieldOps..."` is fragile — anyone can type it. Use the `dataSource` enum column instead.
- **Creating CropLot without uniqueness handling:** `CropLot.lotNumber` is `@unique`. Multiple harvests on the same enterprise in one season collide. Use a suffix counter pattern.
- **Using `Dialog` for multi-field forms:** Forms with more than 4 fields (harvest has 8+) need `Sheet` (slide-over) for readable layout on both desktop and mobile.
- **Fetching equipment list in the form component on every render:** Fetch once at page load and cache in component state. Equipment list changes rarely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Searchable field/equipment dropdown | Custom filtered `<select>` with debounce | `cmdk` Command component (already installed) | Handles 50+ items with keyboard nav, accessible, consistent with Phase 1 field matching UI |
| Date formatting | Custom date utils | `date-fns` `format`, `parseISO`, `getYear` | Already installed, handles locale, timezone edge cases |
| Lot number generation | Custom string concat | `lot-generator.ts` `generateLotNumber()` | Already written, has crop + field name abbreviation tables for all farm fields |
| Toast notifications | Custom alert state | `sonner` `toast.success()` / `toast.error()` | Already installed, used throughout the app |
| Type-safe form validation | Manual field checks | Zod schemas in API routes | Already installed, consistent pattern from Phase 1 |
| Season/year boundary dates | Custom date arithmetic | `date-fns` `startOfYear`, `endOfYear` | Already installed, handles leap years and DST correctly |

**Key insight:** The data models and utility functions are already built. Phase 2 is primarily a UI/query exercise — the domain logic (lot numbers, operation types, sync approval) is done.

---

## Common Pitfalls

### Pitfall 1: CropLot Uniqueness Collision

**What goes wrong:** A field has two harvest events in one growing season (partial harvest in August, final harvest in October). Both try to create `CropLot` with the same `lotNumber` from the parent `FieldEnterprise`. The second create throws a Prisma unique constraint violation.

**Why it happens:** `CropLot.lotNumber` has `@unique` constraint. The enterprise lot number is `2025-CORN-KOPP` — the same for both harvests.

**How to avoid:** In the harvest API route, check if a `CropLot` already exists for this `fieldEnterpriseId`. If so, append a suffix: `2025-CORN-KOPP-2`, `2025-CORN-KOPP-3`, etc. Generate suffix by counting existing `CropLot` rows for this enterprise.

**Warning signs:** `POST /api/field-enterprises/[id]/harvest` returns 500 with `Unique constraint failed on the fields: (lotNumber)`.

### Pitfall 2: Empty Season Gaps Hidden From Inspector

**What goes wrong:** The timeline only renders years with `FieldEnterprise` rows. A year with no planting (fallow, cover crop year) shows nothing. The organic inspector asks "what happened in 2023?" — no answer.

**Why it happens:** Loop over `enterprises` instead of loop over `years`.

**How to avoid:** Always loop over `years = [currentYear, currentYear - 1, currentYear - 2]` as the primary iterator. For each year, find or fall back to an empty-state card. The empty state must say "No operations recorded" and show an "Add Records" button (user decision, not optional).

**Warning signs:** Timeline shows 1 or 2 seasons when you expect 3.

### Pitfall 3: Data Source Display Relies on Notes String Parsing

**What goes wrong:** `FieldOperation.notes.startsWith("Imported from Case IH FieldOps")` is used to show the sync icon. But notes are freeform text — a user could write anything. Or a record imported via CSV import has a different note prefix. The icon displays wrong.

**Why it happens:** No explicit `dataSource` column exists before the Phase 2 migration.

**How to avoid:** Add `DataSource` enum (`MANUAL | SYNCED`) to `FieldOperation` and `HarvestEvent`. Update the staged-ops approval route to set `dataSource: "SYNCED"`. The migration defaults all existing records to `MANUAL` — that's correct since they were all entered before Case IH sync existed, or they were synced via the notes-based path which is fine to treat as the correct state for the timeline display.

**Warning signs:** Sync icon appears on manually-entered records, or pencil icon appears on synced records.

### Pitfall 4: Approval Provenance Display Gap

**What goes wrong:** The timeline should show "Approved by [name] on [date]" for synced records. But `FieldOperation` and `HarvestEvent` don't store approval info — that lives on `SyncedOperation`. After a `SyncedOperation` is approved, the link back to it is only via the `notes` string (which contains the `syncRunId`).

**Why it happens:** The Phase 1 approval route writes to `FieldOperation` with notes containing the syncRunId, but doesn't store the reviewer's identity on the domain record.

**How to avoid:** Two options:
1. **Simple (recommended for Phase 2):** Parse the `syncRunId` from the notes string and query `SyncedOperation` to get `reviewedByUserId` and `reviewedAt`. This is a join that happens only in the expanded card view (not the collapsed list), so performance is acceptable.
2. **Correct:** Add `approvedByUserId`, `approvedAt` columns to `FieldOperation` and `HarvestEvent` and populate them in the approval route. Cleaner but requires schema migration and changes to Phase 1's route.

**Recommendation:** Use option 1 (query `SyncedOperation` by `syncRunId` from notes) for Phase 2 — avoids a second migration. Note it as technical debt for Phase 3 refactor.

**Warning signs:** Expanded card shows "Approved by Unknown on Unknown date" for all synced records.

### Pitfall 5: Field Index Performance with Per-Field Record Counts

**What goes wrong:** The field index page tries to show `recordCount` for each field. With 50+ fields, each having multiple enterprises and operation types, the query fetches too much data and the page loads slowly.

**Why it happens:** Naively fetching all nested records to count them in JavaScript.

**How to avoid:** Use Prisma's `_count` select to compute counts in the database. Do NOT fetch all operation rows just to `.length` them in JavaScript.

```typescript
// CORRECT: use _count
enterprises: {
  include: {
    _count: { select: { fieldOperations: true, harvestEvents: true, materialUsages: true } }
  }
}
// totalRecords = sum of _count values across enterprises
```

**Warning signs:** Fields page takes > 2 seconds to load with 50 fields.

### Pitfall 6: Season Selector Beyond 3 Years Uses Wrong Year Offsets

**What goes wrong:** The "year selector to shift the window" uses fixed years (2023, 2024, 2025) instead of computing relative to the current year. In crop year 2027, the selector still shows 2023-2025.

**Why it happens:** Hard-coded year arrays instead of `new Date().getFullYear()` as base.

**How to avoid:** Always derive the default 3-year window from `currentYear = new Date().getFullYear()`. The year selector shifts `windowOffset` (default 0), computing `years = [currentYear - offset, currentYear - offset - 1, currentYear - offset - 2]`.

---

## Code Examples

Verified patterns from existing codebase and official Prisma docs:

### History API Route — Field with 3-Year Enterprises

```typescript
// Source: schema.prisma Field model + existing /api/fields/route.ts pattern
// File: /api/fields/[id]/history/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const currentYear = new Date().getFullYear();
  const years = [
    currentYear - offset,
    currentYear - offset - 1,
    currentYear - offset - 2,
  ];

  const field = await prisma.field.findUnique({
    where: { id },
    include: {
      enterprises: {
        where: { cropYear: { in: years } },
        orderBy: { cropYear: "desc" },
        include: {
          fieldOperations: {
            include: { equipment: true, operator: true },
            orderBy: { operationDate: "asc" },
          },
          materialUsages: {
            include: { material: true },
            orderBy: { applicationDate: "asc" },
          },
          harvestEvents: {
            include: { equipment: true, cropLots: true },
            orderBy: { harvestDate: "asc" },
          },
          fertilityEvents: {
            orderBy: { applicationDate: "asc" },
          },
        },
      },
    },
  });

  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  return NextResponse.json({ field, years });
}
```

### Lot Number Generation (already exists, use as-is)

```typescript
// Source: src/lib/lot-generator.ts — EXISTING, do not modify
import { generateLotNumber } from "@/lib/lot-generator";

// In harvest route, after creating HarvestEvent:
const lotNumber = generateLotNumber(
  enterprise.cropYear,    // e.g. 2025
  enterprise.crop,        // e.g. "Corn" → "CORN"
  enterprise.field.name   // e.g. "Kopps" → "KOPP"
);
// Result: "2025-CORN-KOPP"
```

### CropLot Auto-Creation with Collision Handling

```typescript
// Source: schema.prisma CropLot model + lot-generator.ts
// Extension to /api/field-enterprises/[id]/harvest/route.ts

async function createCropLotForHarvest(
  fieldEnterpriseId: string,
  harvestEventId: string,
  enterprise: { cropYear: number; crop: string; organicStatus: string; field: { name: string } },
  quantityLbs: number
) {
  const baseLotNumber = generateLotNumber(
    enterprise.cropYear,
    enterprise.crop,
    enterprise.field.name
  );

  // Count existing CropLots for this enterprise to generate suffix
  const existingCount = await prisma.cropLot.count({
    where: { fieldEnterpriseId },
  });

  const lotNumber = existingCount === 0
    ? baseLotNumber
    : `${baseLotNumber}-${existingCount + 1}`;

  return prisma.cropLot.create({
    data: {
      fieldEnterpriseId,
      harvestEventId,
      lotNumber,
      crop: enterprise.crop,
      organicStatus: enterprise.organicStatus as "ORGANIC" | "TRANSITIONAL" | "CONVENTIONAL" | "SPLIT",
      quantityLbs,
    },
  });
}
```

### DataSource Schema Addition

```prisma
// In schema.prisma — ADD before FieldOperation model

enum DataSource {
  MANUAL
  SYNCED
}

// Extend FieldOperation — ADD field:
model FieldOperation {
  // ... all existing fields ...
  dataSource    DataSource  @default(MANUAL)
  // ... rest of model
}

// Extend HarvestEvent — ADD field:
model HarvestEvent {
  // ... all existing fields ...
  dataSource    DataSource  @default(MANUAL)
  // ... rest of model
}
```

```bash
# Migration command from organic-cert directory:
npx prisma migrate dev --name add-datasource-field
```

### Timeline Badge Colors (from CONTEXT.md decisions)

```typescript
// Consistent with existing statusColor pattern in fields/page.tsx and field-enterprises/page.tsx
const opTypeBadgeColor: Record<string, string> = {
  // Applications — green
  SPRAYING: "bg-green-100 text-green-800",
  // Harvest — amber
  HARVEST: "bg-amber-100 text-amber-800",
  // Tillage — blue
  TILLAGE: "bg-blue-100 text-blue-800",
  CULTIVATION: "bg-blue-100 text-blue-800",
  // Planting — purple
  PLANTING: "bg-purple-100 text-purple-800",
  // Other
  IRRIGATION: "bg-cyan-100 text-cyan-800",
  MOWING: "bg-stone-100 text-stone-800",
  FLAMING: "bg-orange-100 text-orange-800",
  OTHER: "bg-stone-100 text-stone-800",
};

// Data source icons
// import { RefreshCw, Pencil } from "lucide-react";
// SYNCED: <RefreshCw size={12} className="text-stone-400" />
// MANUAL: <Pencil size={12} className="text-stone-400" />
```

### Field Index with Activity Stats

```typescript
// Source: Prisma _count pattern — existing /api/fields/route.ts extended
// Extend GET /api/fields to compute activity stats efficiently

const fields = await prisma.field.findMany({
  include: {
    enterprises: {
      orderBy: { cropYear: "desc" },
      take: 3,  // Only 3 most recent years for stats
      include: {
        _count: {
          select: {
            fieldOperations: true,
            harvestEvents: true,
            materialUsages: true,
            fertilityEvents: true,
          },
        },
        fieldOperations: {
          orderBy: { operationDate: "desc" },
          take: 1,
          select: { operationDate: true },
        },
        harvestEvents: {
          orderBy: { harvestDate: "desc" },
          take: 1,
          select: { harvestDate: true },
        },
      },
    },
  },
  orderBy: { name: "asc" },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Enterprise-centric view (`/field-enterprises/[id]`) | Field-centric timeline (`/fields/[id]/history`) | Phase 2 (new) | Inspector needs field story across years, not per-enterprise tabs |
| Notes string to detect synced vs manual | `DataSource` enum field | Phase 2 migration | Reliable source indicator for timeline icons |
| No CropLot auto-creation on harvest | Auto-create CropLot in harvest POST | Phase 2 (gap fix) | FIELD-06 requires lot numbers on harvest records |
| Field index without activity stats | Field index with last activity date + record count | Phase 2 (upgrade) | Farm manager needs quick field health at a glance |

**Already done (do not re-implement):**
- `generateLotNumber()` in `src/lib/lot-generator.ts` — crop and field abbreviation tables already populated for all known farm fields
- `FieldEnterprise.lotNumber` auto-generation in `POST /api/field-enterprises` — works correctly
- `FieldOperation`, `HarvestEvent`, `MaterialUsage`, `FertilityEvent` CRUD routes — all exist at `/api/field-enterprises/[id]/...`
- `AuditLog` creation via `logAudit()` — already called in all write routes; continue using this pattern
- Equipment CRUD at `/api/equipment` — equipment list for harvest form is a `GET /api/equipment` call

---

## Open Questions

1. **Approval provenance: parse syncRunId from notes vs add explicit columns?**
   - What we know: `SyncedOperation` has `reviewedByUserId` and `reviewedAt`. `FieldOperation.notes` contains `syncRunId` as a string. No direct FK between `FieldOperation` and `SyncedOperation`.
   - What's unclear: Whether we add `approvedByUserId` / `approvedAt` columns to `FieldOperation` + `HarvestEvent` (clean, requires schema change) or parse `syncRunId` from notes and join `SyncedOperation` only on expanded card view (simpler, fragile long-term).
   - Recommendation: Parse `syncRunId` from notes for Phase 2 (no additional migration). Document as technical debt. Phase 3 refactor can clean this up when adding the full audit trail report.

2. **Multiple products per application (CONTEXT.md requirement)**
   - What we know: `MaterialUsage` model is one-product-per-application-record (one `materialId` per row). The CONTEXT.md says "multiple products per application supported."
   - What's unclear: The current data model requires one `MaterialUsage` row per product. Creating one "application event" with multiple products means multiple `MaterialUsage` rows with the same `applicationDate`. There's no `ApplicationEvent` grouping table.
   - Recommendation: For Phase 2, represent multi-product applications as multiple `MaterialUsage` rows with the same date. The UI groups rows by date as a "single application event." This matches the existing data model without a schema change. If the inspector requires a single grouped log entry, Phase 3 can add an `ApplicationEvent` grouping table.

3. **Non-Case IH equipment in harvest form**
   - What we know: CONTEXT.md says "ability to add non-Case IH equipment from other manufacturers." The `Equipment` model already exists with `name`, `type`, `isShared` — and the create flow exists at `POST /api/equipment`. The equipment list GET is at `GET /api/equipment`.
   - What's unclear: Whether the harvest form should have an inline "Add new equipment" flow or redirect to `/reference/equipment`.
   - Recommendation: Inline "Add Equipment" mini-form within the harvest Sheet panel. A redirect breaks the batch entry workflow (farmer loses form state). Use a nested `Dialog` inside the `Sheet` for the quick-add equipment flow. Equipment model fields needed: `name` (required), `type` (required, from `EquipmentType` enum), `farmId` (from session).

4. **Print-friendly view scope**
   - What we know: CONTEXT.md says "Print-friendly view available via 'Print' button (basic, feeds into Phase 3 for full reports)."
   - What's unclear: Whether this means `window.print()` with a CSS `@media print` stylesheet, or a separate print route that renders simplified HTML.
   - Recommendation: `window.print()` with `@media print` CSS. Add `print:hidden` to sidebar/header, `print:block` to timeline content. This is the lowest-complexity approach and the CONTEXT.md explicitly says "basic." Phase 3 handles the real PDF report via `@react-pdf/renderer`.

---

## Sources

### Primary (HIGH confidence)

- `organic-cert/prisma/schema.prisma` — All data models: `FieldOperation`, `HarvestEvent`, `MaterialUsage`, `FertilityEvent`, `CropLot`, `FieldEnterprise`, `Field`, `Equipment`. Enums: `FieldOpType`, `DataSource` (to be added). Read directly from file 2026-02-24.
- `organic-cert/src/lib/lot-generator.ts` — `generateLotNumber()`, `abbreviateCrop()`, `abbreviateField()`. All farm field and crop abbreviations present. Read directly 2026-02-24.
- `organic-cert/src/app/(app)/fields/page.tsx` — Existing fields index page pattern. UI components: Card, Input, Badge, Select, Dialog, Button. Pattern for search + filter + table. Read directly 2026-02-24.
- `organic-cert/src/app/(app)/field-enterprises/page.tsx` — Existing enterprise list pattern with year filter. Shows how enterprise-centric view works today. Read directly 2026-02-24.
- `organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` — Existing per-enterprise detail page with operations, applications, harvest tabs. Shows all form patterns for manual entry. 74KB — confirms all record types have working forms. Read directly 2026-02-24.
- `organic-cert/src/app/api/field-enterprises/[id]/harvest/route.ts` — Current harvest POST. No CropLot creation — confirmed gap. Read directly 2026-02-24.
- `organic-cert/src/app/api/field-enterprises/[id]/applications/route.ts` — Material usage POST pattern. Read directly 2026-02-24.
- `organic-cert/src/app/api/admin/staged-ops/[id]/route.ts` — Confirms `dataSource` is currently tracked only via notes string. `reviewedByUserId` and `reviewedAt` are on `SyncedOperation`, not on `FieldOperation`. Read directly 2026-02-24.
- `organic-cert/package.json` — All installed packages confirmed: next@16.1.6, react@19.2.3, prisma@6.19.2, shadcn@3.8.5, date-fns@4.1.0, lucide-react@0.575.0, sonner@2.0.7, cmdk@1.1.1, zod@4.3.6. Read directly 2026-02-24.
- `organic-cert/components.json` — shadcn/ui config: style=new-york, baseColor=neutral. All UI component aliases confirmed. Read directly 2026-02-24.
- `organic-cert/src/components/ui/` — Available components: Badge, Button, Card, Command, Dialog, Input, Label, Select, Separator, Sheet, Tabs, Textarea, Tooltip. All available without installation. Read directly 2026-02-24.

### Secondary (MEDIUM confidence)

- Prisma `_count` aggregation pattern — standard Prisma query feature for computing record counts without fetching all rows. HIGH confidence from Prisma docs, applied to this schema.
- `Sheet` component from shadcn/ui for slide-over forms — `sheet.tsx` exists in `/components/ui/`. Using for multi-field forms is a standard shadcn pattern. HIGH confidence from shadcn docs.

### Tertiary (LOW confidence)

- CropLot suffix numbering strategy — custom pattern not found in any library. LOW confidence: the collision approach (count existing CropLots + append suffix) is logical but untested in this codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library is already installed; no new dependencies needed
- Architecture: HIGH — data models fully understood from schema.prisma; all API patterns established in Phase 1
- Pitfalls: HIGH — CropLot uniqueness is a Prisma constraint (verified); notes-based source tracking is confirmed fragile (verified from staged-ops route); season gap display is a logic issue (verified)
- Data source tracking gap: HIGH — confirmed by reading staged-ops route: no `dataSource` column exists
- CropLot auto-creation gap: HIGH — confirmed by reading harvest route: no CropLot creation code

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (30 days — stack is stable; no moving parts)
