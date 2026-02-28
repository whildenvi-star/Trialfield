# Phase 7: Split-Field PDF Reports - Research

**Researched:** 2026-02-28
**Domain:** @react-pdf/renderer — PDF section layout changes and data assembler updates
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Field List Layout**
- Split fields use indented sub-rows: parent field row shows field name + total acres + enterprise count (e.g., "(3 enterprises)"), then each enterprise indented below
- Sub-rows show: enterprise label + crop + variety + planted acres (e.g., "North 40 | Corn | DKC62-89 | 165 ac")
- Single-enterprise fields render exactly as before — one row, no sub-row, no indentation. Only split fields get parent + sub-row treatment
- Fallow enterprises appear in field list sub-rows for acre accounting

**Field History Grouping**
- Split fields use labeled sub-sections: each enterprise gets a label header (e.g., "North 40 — Corn, 165 ac") followed by its operations, fertility events, and material applications
- Enterprise sub-section styling: lighter/indented — slightly smaller font, indented or italicized, clearly subordinate to field header
- Field header with total acres appears first for multi-enterprise fields (e.g., "Simpson Farm — 200 ac"), then enterprise sub-sections underneath
- Single-enterprise fields render exactly as before — no enterprise sub-header
- Per-year treatment: if a field was single-enterprise in 2024 but split in 2025, each year renders based on its own enterprise count
- Fallow enterprises omitted from history — they have no operations; they're only in field list for acre accounting
- Skip empty enterprises — only show enterprise sub-sections that have at least one operation, fertility event, or harvest
- Just list events chronologically — no summary lines per enterprise
- All inputs (fertility events, material applications) listed under the enterprise they were applied to

**Harvest Log Labeling**
- Harvest log rows show: Field name (Enterprise Label) in one column — e.g., "Simpson Farm (North 40)"
- For single-enterprise fields, just field name with no parenthetical
- Field name column included — inspectors need to trace harvest back to field
- Lot number shown alongside enterprise label for split-field traceability

**Application Log Labeling**
- Application log rows include field + enterprise label per row
- Same format as harvest log: "Field Name (Enterprise Label)" for split fields, just "Field Name" for single-enterprise

**Mass Balance**
- Group by crop name as entered on the enterprise (existing crop field)
- Lot rows show lot number + enterprise label for split-field lots
- Total bushels per lot on the harvested side (individual loads belong in harvest log, not mass balance)
- "Sold" side uses whatever sale delivery data exists in organic-cert
- Mass balance groups by crop across all fields — no per-field breakdown within crop groups

**Operation Overview**
- Keep field-level aggregates — no enterprise-level breakdown in summary stats

### Claude's Discretion
- Exact indentation amount and styling for sub-rows in field list
- Table column widths and layout adjustments for new columns
- How to handle page breaks around multi-enterprise field sections
- Loading skeleton / error state handling

### Deferred Ideas (OUT OF SCOPE)
- Field history spreadsheet import
- Sub-crop data model
- Grain ticket integration for mass balance
- Settlement sheet reconciliation
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | Field List section in PDF shows each enterprise as a sub-row under its parent field (indented or grouped) | Field List currently uses `field.enterprises.find()` (singular) — must switch to multi-enterprise rendering with parent+sub-row layout |
| RPT-02 | Field History section in PDF groups operations by enterprise within each field, clearly labeled | Field History currently uses `field.enterprises.find()` (singular per year) — must iterate all enterprises per year, add label headers, skip fallow+empty |
| RPT-03 | Harvest Log in PDF includes enterprise label alongside lot number for split fields | `HarvestRecord` in assembler lacks `enterpriseLabel` and `isSplitField` — assembler must propagate label; harvest log column format changes to "Field (Label)" |
| RPT-04 | Mass Balance in PDF aggregates correctly across multiple enterprises per field — no double-counting, no omissions | Mass balance already aggregates via `CropLot` (one lot per enterprise), which is correct. Lot rows need enterprise label appended. No double-counting risk with current CropLot architecture. |
</phase_requirements>

---

## Summary

Phase 7 is entirely a rendering and data-plumbing phase — no schema changes, no new API routes. Every section already has the enterprise data available in the `ReportData` payload; the work is changing how that data is shaped (in the assembler) and rendered (in the PDF components).

The root issue is that `report-assembler.ts` was written before split-field enterprises existed as a multi-enterprise feature. The `ApplicationRecord` and `HarvestRecord` flat records carry only `fieldName`, with no `enterpriseLabel` or `isSplitField` indicator. The `FieldHistory` rendering function uses `.find()` (returns at most one enterprise per year). Both must be corrected before the PDF sections can render correctly.

The `CropLot` architecture is inherently correct for mass balance: one lot per enterprise (`CropLot.fieldEnterpriseId` → `FieldEnterprise`), so there is no risk of double-counting harvest weight. The only change needed there is surfacing the enterprise label on lot rows in the PDF. The field history assembler (`buildEnterpriseRows`) must filter applications and harvests by enterprise ID (not just `fieldName + cropYear`) once multiple enterprises exist per field+year to avoid misattribution.

**Primary recommendation:** Update the assembler first (add `enterpriseLabel`, `enterpriseId`, `isSplitField` fields to flat records; fix field-history filtering from field-name-match to enterprise-ID-match), then update each PDF section to consume the new fields. The sections are independent after the assembler is fixed, so they can be planned as separate tasks.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | ^4.3.2 | PDF generation — `Document`, `Page`, `View`, `Text`, `StyleSheet` | Already installed; all 8 PDF sections use it |
| @ag-media/react-pdf-table | ^2.0.3 | Table helpers | Already installed but NOT used in the sections being modified (they use manual flex rows) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^4.1.0 | Date formatting in PDF rows | Already used in all sections |
| TypeScript | ^5 | Type safety for new assembler fields | Already used throughout |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual flex rows (current) | @ag-media/react-pdf-table | Table library not needed — existing manual flex pattern is already working and consistent across all sections. Don't change the rendering strategy for this phase. |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes needed. All changes are within:

```
organic-cert/src/lib/
├── report-assembler.ts         # Step 1: add enterpriseLabel/enterpriseId/isSplitField to flat records
├── pdf/
│   ├── sections/
│   │   ├── field-list.tsx      # Step 2: parent+sub-row layout for split fields
│   │   ├── field-history.tsx   # Step 3: multi-enterprise per year, label headers
│   │   ├── application-log.tsx # Step 4: "Field (Label)" column
│   │   ├── harvest-log.tsx     # Step 5: "Field (Label)" column
│   │   └── mass-balance.tsx    # Step 6: enterprise label on lot rows
│   └── styles.ts               # Step 2 only: add sub-row style
```

### Pattern 1: Backward-Compatible Single/Split Branching

**What:** All sections check whether a field has multiple enterprises for the relevant year before applying split-field rendering. Single-enterprise fields fall through to the existing rendering path unchanged.

**When to use:** Every section modified in this phase.

**Example (field list branching):**
```typescript
// In FieldList section
const currentEnterprises = field.enterprises.filter(e => e.cropYear === cropYear);
const isSplit = currentEnterprises.length > 1;

if (!isSplit) {
  // Render exactly as before — single row, no sub-rows
  return <TableRow cells={[...]} />;
}

// Multi-enterprise: parent row + sub-rows
return (
  <>
    <View> {/* parent row */}
      <Text>{field.name}</Text>
      <Text>{field.totalAcres.toFixed(2)}</Text>
      <Text>{formatOrganicStatus(field.organicStatus)}</Text>
      <Text>({currentEnterprises.length} enterprises)</Text>
    </View>
    {currentEnterprises.map(e => (
      <View key={e.id} style={subRowStyle}> {/* indented sub-row */}
        <Text>{e.label ?? e.crop}</Text>
        <Text>{e.crop}</Text>
        <Text>{e.variety ?? "—"}</Text>
        <Text>{e.plantedAcres.toFixed(2)}</Text>
      </View>
    ))}
  </>
);
```

### Pattern 2: Assembler — Add enterpriseLabel and isSplitField to Flat Records

**What:** The assembler must carry enterprise identity on every flat `ApplicationRecord` and `HarvestRecord`. This allows the PDF sections to format "Field (Label)" without re-joining against the field list.

**Why this matters:** `allApplications` and `allHarvests` are sorted flat arrays. The PDF sections consume them without access to enterprise structure. Adding `enterpriseLabel` (string | null) and `isSplitField` (boolean) to each record lets any section format the display string in one line.

**What to add to `ApplicationRecord`:**
```typescript
export interface ApplicationRecord {
  fieldName: string;
  enterpriseLabel: string | null;   // NEW — null for single enterprise
  isSplitField: boolean;            // NEW — true when field has 2+ enterprises for that cropYear
  cropYear: number;
  date: Date;
  materialName: string;
  rate: number;
  rateUnit: string;
  acres: number;
  nopStatus: MaterialNopStatus;
  applicator: string | null;
}
```

**What to add to `HarvestRecord`:**
```typescript
export interface HarvestRecord {
  fieldName: string;
  enterpriseLabel: string | null;   // NEW — null for single enterprise
  isSplitField: boolean;            // NEW — true when field has 2+ enterprises for that cropYear
  cropYear: number;
  crop: string;
  date: Date;
  lotNumber: string | null;
  acresHarvested: number;
  yieldPerAcre: number | null;
  yieldUnit: string | null;
  netWeight: number | null;
  equipmentName: string | null;
  dataSource: string;
}
```

**How to compute `isSplitField`:** Pre-compute a Set of fieldId+cropYear combinations that have 2+ enterprises, then look up each record during flattening:

```typescript
// In assembleReportData(), before the flattening loops:
const splitFieldYears = new Set<string>();
for (const field of farm.fields) {
  const yearCounts = new Map<number, number>();
  for (const e of field.enterprises) {
    yearCounts.set(e.cropYear, (yearCounts.get(e.cropYear) ?? 0) + 1);
  }
  for (const [year, count] of yearCounts) {
    if (count > 1) splitFieldYears.add(`${field.id}:${year}`);
  }
}

// Then during flattening:
const isSplitField = splitFieldYears.has(`${field.id}:${enterprise.cropYear}`);
```

### Pattern 3: Field History — Filter Applications by Enterprise ID

**What:** `buildEnterpriseRows()` currently matches applications using `fieldName + cropYear`. With multiple enterprises per field+year, this would pull every application made to ANY enterprise on that field into each enterprise's section — incorrect.

**Fix:** Add `enterpriseId` to `ApplicationRecord` and `HarvestRecord`, and filter by `enterpriseId` in `buildEnterpriseRows()`:

```typescript
export interface ApplicationRecord {
  // ... existing fields ...
  enterpriseId: string;             // NEW — for correct filtering in field history
}
export interface HarvestRecord {
  // ... existing fields ...
  enterpriseId: string;             // NEW — for correct filtering in field history
}
```

In `buildEnterpriseRows()`:
```typescript
// BEFORE (wrong for split fields):
const fieldApps = allApplications.filter(
  (a) => a.fieldName === fieldName && a.cropYear === enterprise.cropYear
);

// AFTER (correct):
const fieldApps = allApplications.filter(
  (a) => a.enterpriseId === enterprise.id
);
```

### Pattern 4: Field History — Multi-Enterprise Year Sections

**What:** The year loop in `FieldHistory` currently calls `field.enterprises.find()` which returns at most one enterprise. For split years, it must iterate all enterprises for that year, render a label header per enterprise, skip fallow, and skip enterprises with no operations.

**Current code (problematic):**
```typescript
const enterprise = field.enterprises.find((e) => e.cropYear === year);
```

**Replacement pattern:**
```typescript
const yearEnterprises = field.enterprises.filter((e) => e.cropYear === year);
const isSplitYear = yearEnterprises.length > 1;

if (yearEnterprises.length === 0) {
  // render "No crop recorded" as before
}

if (!isSplitYear) {
  // single enterprise — render exactly as before (no label header)
  const enterprise = yearEnterprises[0];
  // existing rendering...
} else {
  // split year — field header, then per-enterprise sub-sections
  // "Simpson Farm — 200 ac"
  // For each non-fallow enterprise with at least one operation:
  //   "  North 40 — Corn, 165 ac" label header
  //   then operations table
}
```

### Pattern 5: Mass Balance — Label on Lot Rows

**What:** The mass balance section renders lot rows from `MassBalanceByCrop.lots`. The `MassBalanceLot` interface must carry an optional enterprise label so the lot column can show "2024-SRWW-KOPP (North 40)" for split-field lots.

**What to add to `MassBalanceLot`:**
```typescript
export interface MassBalanceLot {
  lotNumber: string;
  enterpriseLabel: string | null;   // NEW — null for single enterprise lots
  harvestedLbs: number;
  soldLbs: number;
  hasSales: boolean;
}
```

**In assembler mass balance section**, the `cropLots` query already includes `fieldEnterprise` via the where clause. Add a join to pull label:

```typescript
const cropLots = await prisma.cropLot.findMany({
  where: { ... },
  include: {
    harvestEvent: true,
    fieldEnterprise: {           // NEW include
      select: { label: true, fieldId: true, cropYear: true }
    },
    loadoutEvents: { ... },
  },
  orderBy: [{ crop: "asc" }, { lotNumber: "asc" }],
});
```

Then check `isSplitField` using the pre-computed `splitFieldYears` set and populate `enterpriseLabel`.

### Pattern 6: Sub-Row Styling in @react-pdf/renderer

**What:** Indented sub-rows in the field list need a distinct style. In @react-pdf/renderer, indentation is achieved via `paddingLeft` on a `View`, not via CSS `text-indent`.

**Recommended sub-row style:**
```typescript
const subRow: Style = {
  flexDirection: "row",
  borderBottomWidth: 1,
  borderBottomColor: colors.borderColor,
  padding: "2 8 2 24",   // 24pt left padding for visual indent
  minHeight: 14,
  backgroundColor: colors.altRowBg,
};

const subRowText: Style = {
  fontSize: 7.5,          // slightly smaller than normal row (8pt)
  color: colors.textSecondary,
};
```

**Enterprise label header in field history:**
```typescript
const enterpriseLabelHeader: Style = {
  fontSize: 8.5,
  fontWeight: "bold",
  color: colors.textSecondary,
  fontStyle: "italic",
  backgroundColor: "#f0f4ef",  // very light green tint
  padding: "2 8 2 16",         // indented 16pt under field header
  marginBottom: 2,
};
```

### Anti-Patterns to Avoid

- **Filtering allApplications/allHarvests by fieldName+cropYear in field history:** With split enterprises, this pulls all applications from any enterprise on the field. Must filter by `enterpriseId` after the assembler change.
- **Using .find() instead of .filter() for enterprises per year:** `.find()` silently drops all but the first enterprise in a split year. Always `.filter()` then branch on count.
- **Rendering sub-rows outside `wrap={false}`:** Large multi-enterprise fields can push a row onto a new page mid-enterprise-group. Use `wrap={false}` on each data row; consider `wrap={false}` on enterprise label headers too.
- **Applying isSplitField based on all enterprises across all years:** The `isSplitField` flag must be computed per `cropYear`. A field that was split in 2025 but single in 2024 should render the 2024 section as a single enterprise.
- **Modifying the MassBalance crop-level aggregation logic:** The totals (`totalHarvestedLbs`, `totalSoldLbs`) are computed correctly from CropLots. Do not re-aggregate from HarvestEvents — that path risks double-counting if multiple HarvestEvents exist per enterprise.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF pagination around enterprise sections | Custom page-break calculation | `wrap={false}` on View + React PDF's automatic pagination | @react-pdf/renderer handles page breaks; `wrap={false}` keeps rows atomic |
| Table rendering | New table abstraction | Existing manual flex pattern (tableRow / altTableRow / headerCol / col) | Consistent with all other sections; don't introduce a third approach |
| Enterprise label computation | Inline logic in each PDF section | Compute in assembler, pass as fields | Sections should be dumb renderers; keep business logic in assembler |

**Key insight:** The assembler is the correct place for all split-field logic. The PDF sections should receive pre-shaped data and render it. Do not re-join enterprise data inside PDF components.

---

## Common Pitfalls

### Pitfall 1: Application/Harvest Misattribution in Field History
**What goes wrong:** After adding multiple enterprises per field+year, `buildEnterpriseRows()` pulls applications filtered by `fieldName + cropYear` — this puts ALL field applications under EVERY enterprise in a split year.
**Why it happens:** The existing filter was sufficient when one enterprise per field+year was enforced.
**How to avoid:** Add `enterpriseId: string` to `ApplicationRecord` and `HarvestRecord` in the assembler, and filter by `enterpriseId` in `buildEnterpriseRows()`. This is the most important correctness fix in the phase.
**Warning signs:** During testing, a split field shows the same application in both enterprise sub-sections.

### Pitfall 2: isSplitField Must Be Per CropYear, Not Per Field
**What goes wrong:** Computing "is this a split field?" at the field level (any year) marks fields as split even in years they were single enterprise. This adds spurious "(Label)" suffixes to historical harvest log rows.
**Why it happens:** Easy to iterate enterprises without filtering by year.
**How to avoid:** Build the `splitFieldYears` set as `fieldId:cropYear` keys (as shown in Pattern 2).
**Warning signs:** Harvest log rows for 2023 show "(North 40)" when the field was single enterprise that year.

### Pitfall 3: Fallow Enterprises in Field History
**What goes wrong:** Fallow enterprises have no `fieldOperations`, `fertilityEvents`, or material applications. If included in field history, they produce an empty enterprise sub-section (just a label header with "No operations recorded").
**Why it happens:** The "skip empty enterprises" decision requires explicit filtering.
**How to avoid:** In field history, filter enterprises to exclude fallow (`!e.isFallow`) AND to require at least one operation/event (`buildEnterpriseRows().length > 0`). Per locked decision, fallow only appears in field list.
**Warning signs:** Field history shows "Fallow — 0 ac" sub-sections with no operations.

### Pitfall 4: Summary Row Calculation in Field List
**What goes wrong:** After adding sub-rows, the summary row "Total (N fields)" must count parent field rows only, not sub-rows. The total acres sum must still be from `field.totalAcres`, not the sum of enterprise `plantedAcres` (enterprises may not fully allocate acres).
**Why it happens:** Easy to accidentally loop over rendered rows rather than the fields array.
**How to avoid:** Keep summary computation on `fields` array, not on rendered output. `totalAcres = fields.reduce((sum, f) => sum + f.totalAcres, 0)` — unchanged.

### Pitfall 5: Mass Balance Double-Counting Risk (CropLot Architecture)
**What goes wrong (hypothetical):** If mass balance were built by summing `HarvestEvent.netWeight` grouped by crop, split-field enterprises producing multiple HarvestEvents for the same CropLot could be double-counted.
**Why it won't happen here:** The current assembler correctly uses `CropLot.quantityLbs` as the harvest weight. Each CropLot belongs to exactly one FieldEnterprise (`CropLot.fieldEnterpriseId`). No double-counting is possible with the current architecture.
**How to confirm:** The `cropLots` Prisma query in `assembleReportData()` fetches `CropLot` records directly — this is correct. Do not change this to use `HarvestEvent.netWeight`.

### Pitfall 6: Column Width Adjustments for New "Field (Label)" Display
**What goes wrong:** The Field column in Harvest Log is currently 18% — wide enough for a plain field name. Adding "(Enterprise Label)" in the same column needs more width, or long entries will be truncated (React PDF truncates with `...` at the cell boundary by default).
**How to avoid:** Increase the Field column width (e.g., from 18% to 22-25%) and reduce narrower columns accordingly. This is within Claude's discretion for styling. Total must equal 100%.

---

## Code Examples

Verified from codebase inspection:

### Current Field List — What Exists (single enterprise assumption)
```typescript
// /organic-cert/src/lib/pdf/sections/field-list.tsx
const currentEnterprise = field.enterprises.find(
  (e) => e.cropYear === cropYear
);  // BUG: silently picks first enterprise when multiple exist
const currentCrop = currentEnterprise?.crop ?? "—";
const variety = currentEnterprise?.variety ?? "—";

return (
  <TableRow
    key={field.id}
    isAlt={index % 2 === 1}
    cells={[
      { value: field.name, width: "25%" },
      { value: field.totalAcres.toFixed(2), width: "15%" },
      { value: formatOrganicStatus(field.organicStatus), width: "15%" },
      { value: currentCrop, width: "20%" },
      { value: variety, width: "25%" },
    ]}
  />
);
```

### Current Field History — What Exists (single enterprise per year)
```typescript
// /organic-cert/src/lib/pdf/sections/field-history.tsx
const enterprise = field.enterprises.find(
  (e) => e.cropYear === year
);  // BUG: returns at most one enterprise per year
let rows: HistoryRow[] = [];
if (enterprise) {
  rows = buildEnterpriseRows(enterprise, allApplications, allHarvests, field.name);
}
```

### Current Application Filtering in buildEnterpriseRows — The Bug
```typescript
// CURRENT — wrong for split fields (applies to ALL enterprises on that field/year):
const fieldApps = allApplications.filter(
  (a) => a.fieldName === fieldName && a.cropYear === enterprise.cropYear
);

// FIXED — filter by enterprise ID:
const fieldApps = allApplications.filter(
  (a) => a.enterpriseId === enterprise.id
);
```

### Assembler Field Label Display Utility
```typescript
// Utility function for "Field (Label)" formatting (shared across 3 sections):
export function formatFieldLabel(fieldName: string, enterpriseLabel: string | null, isSplitField: boolean): string {
  if (!isSplitField || !enterpriseLabel) return fieldName;
  return `${fieldName} (${enterpriseLabel})`;
}
```

### @react-pdf/renderer StyleSheet for Sub-Rows
```typescript
// Source: codebase styles.ts pattern + @react-pdf/renderer StyleSheet API
import { StyleSheet } from "@react-pdf/renderer";

const subRowStyles = StyleSheet.create({
  subRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderColor,
    padding: "2 8 2 24",    // left indent = 24pt
    minHeight: 14,
    backgroundColor: colors.altRowBg,
  },
  subRowCell: {
    fontSize: 7.5,
    color: colors.textSecondary,
  },
  enterpriseLabelHeader: {
    fontSize: 8.5,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.textSecondary,
    backgroundColor: "#f0f4ef",
    padding: "2 8 2 16",
    marginBottom: 2,
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single enterprise per field+year enforced via unique constraint | Multiple enterprises via `@@unique([fieldId, cropYear, crop, label])` | Phase 5 (complete) | PDF sections must now handle 0, 1, or N enterprises per field per year |
| Field history filtered by `fieldName + cropYear` | Must filter by `enterpriseId` | This phase | Required to prevent misattribution of applications in split fields |

**Deprecated/outdated:**
- `field.enterprises.find(e => e.cropYear === year)` in FieldHistory: was correct pre-split-fields, now incorrect. Replace with `.filter()` + count check.
- `field.enterprises.find(e => e.cropYear === cropYear)` in FieldList: same issue.

---

## Open Questions

1. **Column layout for field list sub-rows**
   - What we know: Parent row uses 5 columns (Field Name 25%, Total Acres 15%, Organic Status 15%, Current Crop 20%, Variety 25%). Sub-rows show: enterprise label + crop + variety + planted acres.
   - What's unclear: Sub-rows have 4 data points but span 5 columns. The natural choice is to align enterprise data under the crop/variety/acres columns and leave the first column as indented label space.
   - Recommendation (Claude's discretion): Sub-rows indent under the "Field Name" column width and use the remaining 4 columns for enterprise label, crop, variety, planted acres. Or: span the entire row with pipe-delimited text ("North 40 | Corn | DKC62-89 | 165 ac") in a single wide cell. The pipe-delimited single-cell approach is simpler to implement and avoids column alignment issues.

2. **Column width for "Field (Label)" in Harvest Log and Application Log**
   - What we know: Current Field column = 18% in Harvest Log, 15% in Application Log.
   - What's unclear: How much space "Simpson Farm (North 40)" needs vs. plain "Simpson Farm". Field names can be 15-25 chars, labels 5-10 chars.
   - Recommendation: Harvest Log: increase Field column from 18% to 24%, reduce Equipment from 10% to 8% and Net Wt from 10% to 8% (savings from lower-use columns). Application Log: increase Field from 15% to 20%, reduce Notes from 8% to 3%.

3. **Enterprise sub-section empty check timing**
   - What we know: "Skip empty enterprises" means skip if no operations, fertility events, OR harvests.
   - What's unclear: Should `buildEnterpriseRows()` be called first (to check length > 0), or should the check happen before calling it? The former is cleaner but calls the function unnecessarily.
   - Recommendation: Call `buildEnterpriseRows()` first; if `rows.length === 0 && !enterprise.isFallow`, skip the enterprise sub-section. Performance is not a concern for a small farm dataset.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `/organic-cert/src/lib/report-assembler.ts` (all types and assembler logic, confirmed current)
- Direct codebase inspection — `/organic-cert/src/lib/pdf/sections/*.tsx` (all 5 sections that need changes, confirmed current)
- Direct codebase inspection — `/organic-cert/src/lib/pdf/styles.ts` (StyleSheet patterns)
- Direct codebase inspection — `/organic-cert/src/lib/pdf/components/table-row.tsx`, `page-wrapper.tsx`
- Direct codebase inspection — `/organic-cert/prisma/schema.prisma` (FieldEnterprise model, CropLot model)
- Direct codebase inspection — `/organic-cert/package.json` (confirmed @react-pdf/renderer 4.3.2, @ag-media/react-pdf-table 2.0.3)

### Secondary (MEDIUM confidence)
- @react-pdf/renderer documentation pattern knowledge — `StyleSheet.create()`, `wrap={false}`, `paddingLeft` for indent — consistent with version 4.x API used in existing code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both libraries are installed, versions confirmed from package.json
- Architecture: HIGH — all changes derived from direct code reading; no inference required
- Pitfalls: HIGH — all pitfalls identified from actual code bugs in the current sections (`.find()` vs `.filter()`, field-name filtering vs enterprise-ID filtering)

**Research date:** 2026-02-28
**Valid until:** 2026-04-28 (stable library, no expected API changes in @react-pdf/renderer 4.x)
