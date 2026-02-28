# Phase 6: Multi-Enterprise Field Views - Research

**Researched:** 2026-02-28
**Domain:** React 19 client components, Next.js 16 App Router pages, shadcn/Radix UI, consolidated-view UX patterns
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIEW-01 | Field index page shows consolidated field cards with enterprise count badge when > 1 enterprise exists | Modify `fields/page.tsx` field cards: add enterprise count badge + acreUtilization display using data already returned by GET /api/fields |
| VIEW-02 | Field detail/history page defaults to consolidated view showing all enterprises for the field | Refactor `fields/[id]/history/page.tsx`: currently uses `enterpriseByYear.get(year)` which returns ONE enterprise per year — change to return ALL enterprises per year, render multiple enterprise rows per season card |
| VIEW-03 | User can drill down from consolidated view to a single enterprise's operations and history in isolation | Already exists at `/field-enterprises/[id]` — add link from consolidated view enterprise rows to this page; ensure breadcrumb navigates back to field history |
| VIEW-04 | Season cards in field history display multiple enterprise rows when a field was split that year | Extend season card rendering in `fields/[id]/history/page.tsx` to iterate over array of enterprises per year instead of single enterprise per year |
| VIEW-05 | Enterprise creation form supports adding multiple enterprises to the same field and crop year | Extend enterprise creation dialog in `field-enterprises/page.tsx` to include `label` and `isFallow` fields; handle acreWarning from API response; allow form to stay open for "Save & Add Another" |
</phase_requirements>

---

## Summary

Phase 6 is a pure frontend phase. All backend infrastructure is already in place from Phase 5: the schema supports multiple enterprises per field per season (with `label`, `isFallow`, fallow cost fields), the API returns `acreUtilization` and `acreWarning`, and lot numbers incorporate label suffixes. The work is entirely in three React client components (`fields/page.tsx`, `fields/[id]/history/page.tsx`, `field-enterprises/page.tsx` + `field-enterprises/[id]/page.tsx`) and potentially one API adjustment to the history endpoint.

The core challenge is that the existing field history page (`fields/[id]/history/page.tsx`) was built with a **one-enterprise-per-year assumption**: the `enterpriseByYear` map uses `Map<number, Enterprise>` (singular), and the season card renders a single crop/variety header per year. This must change to `Map<number, Enterprise[]>` (array), and each season card must iterate over multiple enterprise rows. The field index page (`fields/page.tsx`) already receives enterprise data from the API but displays only field-level info — adding an enterprise count badge and acre utilization display is straightforward since the data is already there.

The enterprise detail page (`field-enterprises/[id]/page.tsx`) already provides a complete single-enterprise view with tabbed sections for operations, applications, harvest, fertility, and seed usage. It requires no structural changes — only the addition of `label` display and a breadcrumb back to the parent field's history page. The drill-down link (VIEW-03) is essentially a `Link` from the consolidated season card to `/field-enterprises/{id}`.

**Primary recommendation:** Modify three existing page components and one API route — no new pages, no new libraries, no new API routes needed. Add `label` and `isFallow` to the enterprise creation form, add enterprise count/utilization badges to field cards, and refactor the field history page's enterprise-per-year data structure from singular to array.

---

## Standard Stack

### Core (already in project -- no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Client component rendering | Project's existing UI framework |
| Next.js App Router | 16.1.6 | Page routing + API routes | Established project pattern |
| shadcn/Radix UI | radix-ui 1.4.3 | Card, Badge, Dialog, Select, Tabs components | Every existing page uses these |
| Tailwind CSS | 4.x | Styling | Project's CSS framework |
| lucide-react | 0.575.0 | Icons (Sprout, MapPin, Plus, etc.) | All existing pages use lucide icons |
| sonner | 2.0.7 | Toast notifications | Used in all existing forms for success/error feedback |
| date-fns | 4.1.0 | Date formatting | Used in field history timeline |
| cmdk | 1.1.1 | Command palette / combobox | Used in equipment selector in history page |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.3.6 | API request validation | If adding new API validation for enterprise creation with label/isFallow |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline enterprise rows in season cards | Separate "consolidated view" page | Extra page adds navigation complexity; inline rows match the "just the information needed" UX goal |
| Accordion for enterprise drill-down | Navigate to `/field-enterprises/[id]` | Enterprise detail page already exists and is comprehensive; duplicating it inline would bloat the history page |
| Tab-per-enterprise in season card | Enterprise rows with click-through | Tabs don't scale visually when there are 5+ enterprises per field; rows are simpler |

**Installation:** No new packages required.

---

## Architecture Patterns

### Existing Project Structure (files to modify)

```
organic-cert/src/
├── app/(app)/
│   ├── fields/
│   │   ├── page.tsx                    # VIEW-01: Add enterprise count badge + acreUtilization
│   │   └── [id]/history/page.tsx       # VIEW-02, VIEW-04: Refactor to multi-enterprise per year
│   └── field-enterprises/
│       ├── page.tsx                    # VIEW-05: Add label, isFallow to creation form
│       └── [id]/page.tsx              # VIEW-03: Add label display + breadcrumb to parent field
├── app/api/
│   └── fields/[id]/history/route.ts   # May need to return enterprises[] grouped, not single
└── components/ui/                      # No changes — use existing Badge, Card, Dialog, etc.
```

### Pattern 1: Enterprise Count Badge on Field Cards (VIEW-01)

**What:** Show "3 enterprises" badge and "120 of 160 ac" utilization text on field cards when multi-enterprise.

**When to use:** Field index page, when `acreUtilization` is non-null (means 2+ enterprises exist for current year).

**Current field card structure (fields/page.tsx line ~297-365):**
```tsx
// CURRENT: Shows field name, total acres, organic status, activity date
<Card>
  <CardHeader>
    <CardTitle>{f.name}</CardTitle>
    <p>{f.totalAcres} acres {f.currentCrop && <span>{f.currentCrop}</span>}</p>
  </CardHeader>
  <CardContent>
    <Badge>{f.organicStatus}</Badge>
    <Badge>{f.totalRecords} records</Badge>
  </CardContent>
</Card>
```

**Target modification:**
```tsx
// AFTER: Add enterprise count and utilization when multi-enterprise
<Card>
  <CardHeader>
    <CardTitle>{f.name}</CardTitle>
    <p>
      {f.acreUtilization
        ? `${f.acreUtilization.planted.toFixed(1)} of ${f.acreUtilization.total.toFixed(1)} ac`
        : `${f.totalAcres.toFixed(1)} acres`}
      {f.currentCrop && <span> · {f.currentCrop}</span>}
    </p>
  </CardHeader>
  <CardContent>
    <Badge>{f.organicStatus}</Badge>
    {f.enterpriseCount > 1 && (
      <Badge variant="outline" className="text-xs">
        {f.enterpriseCount} enterprises
      </Badge>
    )}
    {f.acreUtilization?.isOverAllocated && (
      <Badge variant="outline" className="text-xs text-yellow-700 border-yellow-300 bg-yellow-50">
        Over-allocated
      </Badge>
    )}
  </CardContent>
</Card>
```

**Data availability:** GET /api/fields already returns `acreUtilization` (from Phase 5 Plan 02). The `Field` interface in `fields/page.tsx` needs to be extended to include `acreUtilization` and enterprise count.

### Pattern 2: Multi-Enterprise Season Cards (VIEW-02, VIEW-04)

**What:** Season cards show multiple enterprise rows when a field has split enterprises for that year.

**Current data structure (fields/[id]/history/page.tsx line ~1880-1887):**
```typescript
// CURRENT: One enterprise per year — Map<number, Enterprise>
const enterpriseByYear = useMemo(() => {
  const map = new Map<number, Enterprise>();
  for (const e of data.field.enterprises) {
    map.set(e.cropYear, e);  // PROBLEM: Overwrites if multiple exist for same year
  }
  return map;
}, [data]);
```

**Target refactoring:**
```typescript
// AFTER: Multiple enterprises per year — Map<number, Enterprise[]>
const enterprisesByYear = useMemo(() => {
  const map = new Map<number, Enterprise[]>();
  for (const e of data.field.enterprises) {
    const existing = map.get(e.cropYear) || [];
    existing.push(e);
    map.set(e.cropYear, existing);
  }
  return map;
}, [data]);
```

**Season card rendering changes (line ~2110-2199):**
```tsx
// CURRENT: Single enterprise per season card
{years.map((year) => {
  const enterprise = enterpriseByYear.get(year);
  // ... renders single enterprise header and timeline
})}

// AFTER: Array of enterprises per season card
{years.map((year) => {
  const yearEnterprises = enterprisesByYear.get(year) || [];

  if (yearEnterprises.length === 0) {
    return <EmptySeasonCard year={year} />;
  }

  if (yearEnterprises.length === 1) {
    // Single enterprise — render exactly as today for backward compatibility
    return <SingleEnterpriseSeasonCard enterprise={yearEnterprises[0]} year={year} />;
  }

  // Multiple enterprises — consolidated view
  return (
    <Card key={year}>
      <CardHeader>
        <h2>Growing Season {year}</h2>
        <p>{yearEnterprises.length} enterprises · {totalPlantedAcres} of {field.totalAcres} ac</p>
      </CardHeader>
      <CardContent>
        {yearEnterprises.map((ent) => (
          <EnterpriseRow
            key={ent.id}
            enterprise={ent}
            onDrillDown={() => router.push(`/field-enterprises/${ent.id}`)}
          />
        ))}
      </CardContent>
    </Card>
  );
})}
```

### Pattern 3: Enterprise Row Component (new sub-component)

**What:** A compact row showing one enterprise within a multi-enterprise season card. Shows label, crop, acres, status, operation count, and a drill-down link.

**Design:**
```tsx
function EnterpriseRow({ enterprise, onDrillDown }: { enterprise: Enterprise; onDrillDown: () => void }) {
  const allItems = buildTimelineItems(enterprise);
  return (
    <div
      className="flex items-center justify-between p-3 border border-stone-200 rounded-lg hover:border-[#2d5a27]/30 cursor-pointer transition-colors"
      onClick={onDrillDown}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="font-medium text-stone-900">
            {enterprise.isFallow ? "Fallow" : enterprise.crop}
            {enterprise.label && (
              <span className="text-stone-500 ml-1">({enterprise.label})</span>
            )}
          </span>
          <span className="text-xs text-stone-500">
            {enterprise.plantedAcres} ac · {allItems.length} operations
            {enterprise.variety && ` · ${enterprise.variety}`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={statusColor[enterprise.organicStatus]}>
          {enterprise.organicStatus}
        </Badge>
        <ChevronRight size={16} className="text-stone-400" />
      </div>
    </div>
  );
}
```

### Pattern 4: Enterprise Creation Form with Label and Fallow (VIEW-05)

**What:** Extend the enterprise creation dialog in `field-enterprises/page.tsx` to include `label` (optional text input) and `isFallow` (checkbox/toggle). Show `acreWarning` toast when API returns one.

**Current form fields (field-enterprises/page.tsx line ~57-64):**
```typescript
const [form, setForm] = useState({
  fieldId: "",
  cropYear: new Date().getFullYear().toString(),
  crop: "",
  variety: "",
  plantedAcres: "",
  organicStatus: "ORGANIC",
});
```

**Target form state:**
```typescript
const [form, setForm] = useState({
  fieldId: "",
  cropYear: new Date().getFullYear().toString(),
  crop: "",
  variety: "",
  plantedAcres: "",
  organicStatus: "ORGANIC",
  label: "",           // NEW: optional split-field label
  isFallow: false,     // NEW: fallow enterprise toggle
  fallowCostAmount: "",     // NEW: shown only when isFallow
  fallowCostCategory: "",   // NEW: shown only when isFallow
});
```

**acreWarning handling in save response:**
```typescript
async function handleSave() {
  // ... existing validation ...
  const body = {
    ...existingFields,
    label: form.label || null,
    isFallow: form.isFallow,
    ...(form.isFallow ? {
      fallowCostAmount: form.fallowCostAmount ? parseFloat(form.fallowCostAmount) : null,
      fallowCostCategory: form.fallowCostCategory || null,
    } : {}),
  };

  const res = await fetch("/api/field-enterprises", { method: "POST", body: JSON.stringify(body) });
  const data = await res.json();

  if (data.acreWarning) {
    toast.warning(data.acreWarning);  // Yellow warning from sonner
  }
  toast.success("Enterprise created");
  // ... rest of save logic ...
}
```

### Pattern 5: Drill-Down Breadcrumb (VIEW-03)

**What:** Enterprise detail page (`field-enterprises/[id]/page.tsx`) needs a breadcrumb that links back to the parent field's history page.

**Current back link (field-enterprises/[id]/page.tsx line ~372):**
```tsx
<Link href="/field-enterprises" className="...">
  <ArrowLeft size={14} /> Back to Field Enterprises
</Link>
```

**Target: Context-aware back link:**
```tsx
<div className="flex items-center gap-2 text-sm text-stone-500">
  <Link href="/fields" className="hover:text-stone-700">Fields</Link>
  <ChevronRight size={12} />
  <Link href={`/fields/${ent.field.id}/history`} className="hover:text-stone-700">
    {ent.field.name}
  </Link>
  <ChevronRight size={12} />
  <span className="text-stone-700">
    {ent.crop} {ent.label ? `(${ent.label})` : ""} {ent.cropYear}
  </span>
</div>
```

### Anti-Patterns to Avoid

- **Creating a new "consolidated field view" page separate from the existing history page:** The field history page already IS the field detail page. Adding a new route would split context and confuse navigation. Modify the existing page to handle multiple enterprises.
- **Loading all enterprises for all fields on the field index page:** The GET /api/fields already limits to `take: 3` enterprises per field. Don't fetch full enterprise detail for the card view — use the existing `acreUtilization` and enterprise count.
- **Putting the enterprise creation form on the field history page:** Keep enterprise creation on the dedicated `field-enterprises/page.tsx` — this matches the existing navigation mental model. Add a "New Enterprise" button on the history page that links to the enterprise creation dialog with the field pre-selected.
- **Collapsing/hiding the timeline for multi-enterprise season cards by default:** Users need to see operations at a glance. Keep timelines visible; the drill-down to individual enterprise is for isolated detail.
- **Duplicating timeline building logic:** The `buildTimelineItems()` function already works per-enterprise. Re-use it for each enterprise row in consolidated view.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion/collapsible enterprise sections | Custom expand/collapse with manual state | shadcn Collapsible or just CSS `details/summary` | Already have shadcn; but for this use case, simple always-visible rows are better UX than accordions |
| Badge component | Custom styled span | `Badge` from `@/components/ui/badge` | Already in every page in the project |
| Toast notifications for acreWarning | Custom notification UI | `toast.warning()` from sonner | Already used throughout the app for success/error feedback |
| Enterprise grouping by year | Manual array manipulation | Simple `Map<number, Enterprise[]>` with reduce/forEach | Standard JS; no library needed |
| Enterprise count in field card | Separate API call to count | Use `enterprises.length` or add `_count` in existing GET | Prisma `_count` is already used in the GET /api/fields route |

**Key insight:** All the UI infrastructure is already in place. This phase is purely about rearranging existing components and data structures to handle the many-to-one relationship that Phase 5 enabled.

---

## Common Pitfalls

### Pitfall 1: enterpriseByYear Map Overwrite Bug

**What goes wrong:** The current `enterpriseByYear` uses `Map<number, Enterprise>` and calls `map.set(e.cropYear, e)`. When a field has two enterprises in the same year, the second overwrites the first — silently losing data. The user sees only one enterprise per season.

**Why it happens:** The original design was one-enterprise-per-field-per-year. Phase 5 removed that constraint at the data level, but the UI still assumes it.

**How to avoid:** Change to `Map<number, Enterprise[]>`. This is the single most critical change in this phase. Use `map.get(year) || []` followed by `push()`.

**Warning signs:** After creating two enterprises for the same field and year, only one appears in the history view.

### Pitfall 2: Field Interface Missing acreUtilization

**What goes wrong:** The `Field` interface in `fields/page.tsx` (line 37-49) doesn't include `acreUtilization`. Even though the API returns it (from Phase 5 Plan 02), TypeScript won't surface it and the field card won't render the utilization display.

**Why it happens:** TypeScript interfaces in client components are hand-written, not auto-generated from Prisma or the API.

**How to avoid:** Add `acreUtilization` to the `Field` interface:
```typescript
interface Field {
  // ... existing fields ...
  acreUtilization?: {
    planted: number;
    total: number;
    fallow: number;
    isOverAllocated: boolean;
  } | null;
}
```

**Warning signs:** No TypeScript error, but `f.acreUtilization` is always `undefined` in the template because it's not in the interface.

### Pitfall 3: Enterprise Detail Missing label Field

**What goes wrong:** The `Enterprise` interface in `field-enterprises/[id]/page.tsx` (line 52-70) doesn't include `label`, `isFallow`, `fallowCostAmount`, or `fallowCostCategory`. These were added to the schema in Phase 5 but the client-side interface was never updated.

**Why it happens:** Phase 5 updated the Prisma schema and `EnterpriseWithOperations` in `report-assembler.ts` (for forward compatibility), but didn't update the client-side TypeScript interfaces since they're hand-written and Phase 5 was backend-only.

**How to avoid:** Add Phase 5 fields to ALL client-side Enterprise interfaces:
- `fields/[id]/history/page.tsx` Enterprise interface (line 116)
- `field-enterprises/[id]/page.tsx` Enterprise interface (line 52)
- `field-enterprises/page.tsx` FieldEnterprise interface (line 33)

**Warning signs:** `ent.label` returns `undefined` even though the API returns it; form won't send `label` in the POST body because it's not in the interface.

### Pitfall 4: FieldEnterprise Table Missing label Column

**What goes wrong:** The field enterprises table in `field-enterprises/page.tsx` doesn't show the `label` column. After a user creates two "Corn" enterprises for the same field (one labeled "North", one labeled "South"), they see two identical rows with no way to distinguish them.

**Why it happens:** The table predates split-field support and only shows Year, Field, Crop, Variety, Acres, Lot, Status.

**How to avoid:** Add a "Label" column after "Crop" in the table. Show "---" when label is null. For fallow enterprises, show "Fallow" as the crop with a different styling.

**Warning signs:** Two rows that look identical in the enterprise list.

### Pitfall 5: History API Returns Enterprises But enterpriseByYear Loses Multi-Enterprise

**What goes wrong:** The GET `/api/fields/[id]/history` route already returns all enterprises for the field within the 3-year window (no limit on enterprise count per year). The data is correct at the API level. The bug is ONLY in the client-side `enterpriseByYear` map that flattens to a single enterprise per year.

**Why it happens:** Developers may think the API needs fixing, but it doesn't — the API is already correct. The fix is purely on the client side.

**How to avoid:** Verify the API returns multiple enterprises per year by checking the raw JSON response. Then fix ONLY the client-side map construction.

**Warning signs:** Wasting time modifying the API when the client-side map is the real problem.

### Pitfall 6: "Save & Add Another" Form Doesn't Clear Label

**What goes wrong:** After adding "Corn - North 40" on a field, the user clicks "Save & Add Another" to add "Corn - South 80". If the form doesn't clear the `label` field, the second enterprise gets created with the same label, causing a unique constraint violation.

**Why it happens:** The existing enterprise creation dialog resets `crop`, `variety`, and `plantedAcres` on "Save & Add Another" but doesn't know about `label` (new field).

**How to avoid:** Clear `label` (and `isFallow`, `fallowCostAmount`, `fallowCostCategory`) in the form reset logic alongside the existing field resets.

**Warning signs:** P2002 unique constraint error from Prisma when creating a second enterprise with the same `[fieldId, cropYear, crop, label]`.

### Pitfall 7: Season Card Add Record Button — Wrong Enterprise Pre-selection

**What goes wrong:** In multi-enterprise season cards, the "Add Record" button per-enterprise-row needs to pre-select THAT enterprise in the form sheet. The current implementation pre-selects by year, not by specific enterprise ID.

**Why it happens:** The existing `openAddRecord(enterprise.id)` works for single-enterprise seasons. For multi-enterprise, the enterprise selector in the form sheet must default to the clicked enterprise, not just the first one for that year.

**How to avoid:** Pass the specific `enterprise.id` through `openAddRecord()` and ensure it flows into `preselectedEnterpriseId`.

**Warning signs:** User clicks "Add Record" on the soybeans enterprise row, but the form opens with the corn enterprise pre-selected.

---

## Code Examples

Verified patterns from direct codebase inspection:

### API Response Shape: GET /api/fields (already implemented in Phase 5)

```typescript
// Source: organic-cert/src/app/api/fields/route.ts lines 76-99
// This is ALREADY WORKING — no changes needed
{
  id: "...",
  name: "Kopps",
  totalAcres: 160,
  organicStatus: "ORGANIC",
  enterprises: [...],
  lastActivityDate: "2026-02-15T...",
  totalRecords: 24,
  acreUtilization: {        // null when single enterprise
    planted: 145,
    total: 160,
    fallow: 15,
    isOverAllocated: false,
  }
}
```

### API Response Shape: POST /api/field-enterprises (already implemented in Phase 5)

```typescript
// Source: organic-cert/src/app/api/field-enterprises/route.ts lines 87-99
// This is ALREADY WORKING — UI just needs to consume acreWarning
{
  ...enterprise,
  acreWarning: "Planted acres (175.0) exceed field total (160.0 ac)",  // or null
  acreReconciliation: {
    totalPlanted: 175,
    fieldTotal: 160,
    fallowAcres: 0,
    isOverAllocated: true,
  }
}
```

### History API Response Shape: GET /api/fields/[id]/history (already multi-enterprise)

```typescript
// Source: organic-cert/src/app/api/fields/[id]/history/route.ts lines 30-65
// The API already returns ALL enterprises per year — no changes needed
{
  field: {
    id: "...",
    name: "Kopps",
    totalAcres: 160,
    organicStatus: "ORGANIC",
    enterprises: [
      { id: "e1", cropYear: 2026, crop: "Corn", label: "North 40", plantedAcres: 100, ... },
      { id: "e2", cropYear: 2026, crop: "Soybeans", label: "South 60", plantedAcres: 60, ... },
      { id: "e3", cropYear: 2025, crop: "Wheat", label: null, plantedAcres: 160, ... },
    ]
  },
  years: [2026, 2025, 2024]
}
```

### Existing Enterprise Detail Page Structure

```typescript
// Source: organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx
// The page already has:
// - Hero header with field name, crop, variety, year, lot number
// - Season timeline (Pre-Plant -> Planted -> Growing -> Harvest -> Complete)
// - Tabbed sections: Operations, Applications, Harvest, Fertility, Seed Usage
// - Notes editor
// - Dialog forms for adding records
// VIEW-03 only needs: add label display in header + breadcrumb to parent field
```

### Client-Side Enterprise Interface Updates Required

```typescript
// fields/[id]/history/page.tsx — add to Enterprise interface (line 116-127)
interface Enterprise {
  id: string;
  cropYear: number;
  crop: string;
  label: string | null;              // NEW from Phase 5
  isFallow: boolean;                 // NEW from Phase 5
  fallowCostAmount: number | null;   // NEW from Phase 5
  fallowCostCategory: string | null; // NEW from Phase 5
  variety: string | null;
  plantedAcres: number;
  organicStatus: string;
  fieldOperations: FieldOperationRecord[];
  materialUsages: MaterialUsageRecord[];
  harvestEvents: HarvestEventRecord[];
  fertilityEvents: FertilityEventRecord[];
}

// field-enterprises/page.tsx — add to FieldEnterprise interface (line 33-43)
interface FieldEnterprise {
  id: string;
  cropYear: number;
  crop: string;
  label: string | null;              // NEW
  isFallow: boolean;                 // NEW
  variety: string | null;
  plantedAcres: number;
  lotNumber: string | null;
  organicStatus: string;
  locked: boolean;
  field: { id: string; name: string };
}

// field-enterprises/[id]/page.tsx — add to Enterprise interface (line 52-70)
interface Enterprise {
  // ... existing fields ...
  label: string | null;              // NEW
  isFallow: boolean;                 // NEW
  fallowCostAmount: number | null;   // NEW
  fallowCostCategory: string | null; // NEW
}
```

### Field Card with Enterprise Count Badge

```tsx
// Source pattern: organic-cert/src/app/(app)/fields/page.tsx line 297-365
// The existing card uses Card/CardHeader/CardTitle/CardContent/Badge from shadcn
// This is the target modification pattern:

// In the field card subtitle (after totalAcres):
<p className="text-sm text-stone-500 mt-0.5">
  {f.acreUtilization
    ? <>
        <span className="font-medium">{f.acreUtilization.planted.toFixed(1)}</span> of {f.acreUtilization.total.toFixed(1)} ac
        {f.acreUtilization.isOverAllocated && (
          <span className="text-yellow-600 ml-1">(over-allocated)</span>
        )}
      </>
    : <>{f.totalAcres.toFixed(1)} acres</>
  }
</p>

// In the badge row, add enterprise count:
{f._count && f._count.enterprises > 1 && (
  <Badge variant="outline" className="text-xs flex items-center gap-1">
    <Sprout size={10} />
    {f._count.enterprises} enterprises
  </Badge>
)}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `Map<number, Enterprise>` (one per year) | `Map<number, Enterprise[]>` (multiple per year) | Foundation change enabling all VIEW requirements |
| Single crop/variety in season card header | Multiple enterprise rows per season card | Reflects split-field reality |
| No enterprise count in field cards | Enterprise count badge + acre utilization | Field index instantly shows split-field status |
| Enterprise form: field, year, crop, variety, acres | + label, isFallow, fallow cost fields | Supports full split-field enterprise creation |
| Back link to enterprise list only | Breadcrumb: Fields > Field Name > Enterprise | Navigation flows from field context, not just flat enterprise list |

**Nothing deprecated/outdated:** This phase builds on Phase 5 backend work. All existing patterns remain valid.

---

## Open Questions

1. **Consolidated view: show all enterprise timelines or just summary rows?**
   - What we know: Season cards currently show a full operation timeline for the single enterprise. With 3-4 enterprises per field, showing all timelines inline could be very long.
   - What's unclear: Should the consolidated view show full timelines per enterprise, or just summary rows with a "View details" drill-down?
   - Recommendation: Show summary rows (crop, label, acres, operation count, status) with drill-down to enterprise detail page. This matches the "just the information needed" UX philosophy. Full timeline only on single-enterprise seasons (backward compatible) or on the dedicated enterprise detail page.

2. **Enterprise creation from field history page**
   - What we know: VIEW-05 says "enterprise creation form supports adding multiple enterprises to the same field and crop year." The current "Create Crop Year" button on the history page links to `/field-enterprises`.
   - What's unclear: Should the history page have an inline enterprise creation form, or keep the existing flow (navigate to /field-enterprises, create there, navigate back)?
   - Recommendation: Add a "New Enterprise" button on the field history page that opens the enterprise creation dialog PRE-POPULATED with the current field and year. This keeps the user in context (VIEW-05 says "without leaving the page") while reusing the existing creation form logic. Embed the dialog on the history page with the field pre-selected.

3. **Fallow enterprise display in season cards**
   - What we know: Fallow enterprises have `isFallow=true`, no meaningful crop, and optional cost fields.
   - What's unclear: How should fallow enterprises look in the season card enterprise rows? Different color? Different icon?
   - Recommendation: Use a muted styling for fallow rows (stone-200 border, italic text, "Fallow" label instead of crop name). Show cost amount if present. Use a different icon (e.g., `Pause` or `MinusCircle` from lucide) instead of `Sprout`.

4. **Enterprise count: current year only or all years?**
   - What we know: `acreUtilization` from the API only counts current-year enterprises. The enterprise count badge should match.
   - What's unclear: Should the badge count ALL enterprises or just current year?
   - Recommendation: Count current-year enterprises only — this matches `acreUtilization` behavior and is what the user cares about when looking at the field index. Historical enterprise counts are visible on the history page.

---

## Detailed Task Breakdown Guidance (for Planner)

This phase should decompose into two logical plans:

**Plan 01 — Field Index + History View Changes (VIEW-01, VIEW-02, VIEW-04):**
- Update `Field` interface in `fields/page.tsx` to include `acreUtilization` and enterprise count
- Add enterprise count badge and acre utilization to field cards
- Refactor `enterpriseByYear` from `Map<number, Enterprise>` to `Map<number, Enterprise[]>`
- Create `EnterpriseRow` sub-component for multi-enterprise season cards
- Update season card rendering to handle single vs multi-enterprise
- Update `Enterprise` interface in `fields/[id]/history/page.tsx` to include Phase 5 fields
- Verify: field with 1 enterprise still renders as before (backward compat)
- Verify: field with 2+ enterprises shows consolidated view with enterprise rows

**Plan 02 — Enterprise Forms + Drill-Down (VIEW-03, VIEW-05):**
- Update `FieldEnterprise` and `Enterprise` interfaces in enterprise pages to include Phase 5 fields
- Add `label`, `isFallow`, fallow cost fields to enterprise creation/edit dialog
- Handle `acreWarning` from API response (toast.warning)
- Add "Label" column to enterprise table in `field-enterprises/page.tsx`
- Show fallow badge in enterprise rows
- Add breadcrumb navigation on enterprise detail page (Fields > Field Name > Enterprise)
- Add label display in enterprise detail hero header
- Add "New Enterprise" button on field history page that opens creation dialog with field pre-selected
- Clear label and fallow fields on "Save & Add Another"
- Verify: creating two enterprises on same field/year/crop with different labels succeeds
- Verify: acreWarning toast appears when over-allocated

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `organic-cert/src/app/(app)/fields/page.tsx` — current field index page, Field interface, card rendering
- Direct codebase read — `organic-cert/src/app/(app)/fields/[id]/history/page.tsx` — current history page, enterpriseByYear map, season card rendering, Enterprise interface, timeline building
- Direct codebase read — `organic-cert/src/app/(app)/field-enterprises/page.tsx` — current enterprise list, creation dialog, FieldEnterprise interface
- Direct codebase read — `organic-cert/src/app/(app)/field-enterprises/[id]/page.tsx` — current enterprise detail, tabs, hero header, back navigation
- Direct codebase read — `organic-cert/src/app/api/fields/route.ts` — GET /api/fields with acreUtilization computation (Phase 5)
- Direct codebase read — `organic-cert/src/app/api/fields/[id]/history/route.ts` — history API already returns multiple enterprises per year
- Direct codebase read — `organic-cert/src/app/api/field-enterprises/route.ts` — POST with acreWarning response (Phase 5)
- Direct codebase read — `organic-cert/src/app/api/field-enterprises/[id]/route.ts` — PUT with acreReconciliation (Phase 5)
- Direct codebase read — `organic-cert/prisma/schema.prisma` — FieldEnterprise model with label, isFallow fields
- Direct codebase read — `organic-cert/src/lib/report-assembler.ts` — EnterpriseWithOperations already includes Phase 5 fields
- Direct codebase read — `organic-cert/package.json` — exact versions: React 19.2.3, Next.js 16.1.6, radix-ui 1.4.3
- Direct codebase read — `organic-cert/src/components/ui/` — full shadcn component inventory (Badge, Card, Dialog, Select, Tabs, etc.)
- Direct codebase read — `organic-cert/src/components/layout/sidebar.tsx` — navigation structure

### Secondary (MEDIUM confidence)
- Phase 5 Plan 01 Summary — schema changes, established patterns (label, isFallow, partial index)
- Phase 5 Plan 02 Summary — acreUtilization, acreWarning API shapes, lot number label suffix
- Phase 5 Research — architecture patterns, decisions on fallow plantedAcres semantics

### Tertiary (LOW confidence)
- None — all findings from direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and direct file reads; no new libraries needed
- Architecture patterns: HIGH — all patterns derived from existing codebase; modifications to existing components, not new concepts
- Pitfalls: HIGH — enterpriseByYear overwrite bug identified from direct code inspection (line 1880-1887); all other pitfalls from direct interface comparison
- Code examples: HIGH — all examples based on actual file contents with line numbers

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable stack — same tech as Phase 5, no version changes expected)
