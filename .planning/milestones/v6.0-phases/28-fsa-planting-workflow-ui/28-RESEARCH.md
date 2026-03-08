# Phase 28: FSA Planting Workflow UI — Research

**Researched:** 2026-03-05
**Domain:** Next.js 14 App Router — client-interactive data table UI with inline editing, bulk actions, PDF generation, and CSV export on top of an existing Supabase data layer
**Confidence:** HIGH (stack is well-understood, Phase 27 outputs are fully read, all decisions locked)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Card Layout & Grouping**
- Farm → Tract accordion structure with collapsible sections
- Standard card density: field name, crop, practice, planting date, acres, organic flag, status badge (2-3 lines per card)
- Stacked badges: status badge (Reported/Unreported) + separate warning badge if validation issues exist — both visible simultaneously
- Smart default expand: sections with warnings or unreported CLUs start expanded, clean sections start collapsed

**Editing Experience**
- Inline card expand: click a card → it expands in-place to show editable fields, no drawer or modal
- Save button per card: user reviews changes on the expanded card, then clicks Save to commit
- Inline field validation: red text below the specific field with the issue (standard form validation pattern)
- Crop field uses type-ahead search populated from farm-budget macro rollup crops + a predefined FSA crop list (handles crops not yet in farm-budget)

**Bulk Actions & Selection**
- Checkbox per card (corner checkbox), with Select All at tract level and farm level
- Sticky bottom action bar when cards are selected: shows "N selected" + action buttons (Gmail/Notion pattern)
- Confirmation dialog with count before bulk actions: "Mark 12 CLUs as reported to FSA?" with Cancel/Confirm
- Two bulk actions supported: Mark as Reported/Unreported + Bulk Crop Assign (set same crop on multiple CLUs)

**Export & PDF Design**
- PDF: table-based report grouped by Farm/Tract with columns for CLU, crop, practice, acres, planting date, organic, status
- PDF totals: full breakdown — per-farm subtotals, per-crop subtotals, organic/conventional split, grand total at bottom
- Export buttons: top-right of page header, always visible ("Export PDF" and "Export CSV" as separate buttons)
- CSV: full data dump — all CLU record fields including IDs, timestamps, validation flags, share %. Power-user export for spreadsheet analysis

### Claude's Discretion
- Exact card spacing, border radius, shadow depth
- Accordion animation/transition behavior
- Loading states and skeleton design
- Error state handling for failed saves
- CSV filename format and encoding
- PDF header/footer design and page break logic

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FSA-02 | User can view CLU records as cards grouped by Farm/Tract/CLU with status badges | Client component with accordion grouping, data fetched from GET /api/fsa/clu-records, grouping logic client-side |
| FSA-03 | User can edit crop, practice, planting date, and organic flag on a CLU card | Inline card expand pattern, PATCH /api/fsa/clu-records/[id] route, Supabase .update() with .select() |
| FSA-04 | User can bulk-select CLUs and mark as reported to FSA | useState for selectedIds Set, POST /api/fsa/clu-records/bulk-update route, sticky action bar component |
| FSA-07 | User can generate a print-ready FSA Acreage Reporting Summary PDF | @react-pdf/renderer with dynamic({ssr:false}), PDFDownloadLink or usePDF hook, client component |
| FSA-08 | User can export CLU records as CSV | Client-side CSV generation via Blob + URL.createObjectURL, no library needed |
</phase_requirements>

---

## Summary

Phase 28 replaces the stub `/app/fsa-578/page.tsx` (currently a Server Component with 4 stat cards) with a full interactive CLU management workflow. The page must become a Client Component (or have a Server Component shell with a Client Component child) because it needs local state for card selection, accordion open/closed state, inline editing, and the sticky bulk-action bar.

The entire data layer from Phase 27 is ready: `GET /api/fsa/clu-records?year=2026` returns all 444 CLU records ordered by farm/tract/clu, the `CluRecord` TypeScript interface is exported from `src/lib/fsa/calc.ts`, and the validation API (`GET /api/fsa/validation`) returns structured warnings keyed by type. Phase 28 adds two new write routes (PATCH for single-record edit, POST for bulk update), then builds the UI on top.

The primary technical challenge is the PDF generation. `@react-pdf/renderer` is not installed yet — it must be added to the portal, imported with `dynamic({ ssr: false })`, and used either as a `PDFDownloadLink` or via the `usePDF` hook for the download trigger. The existing `next.config.mjs` is empty and may need `serverComponentsExternalPackages` for the react-pdf Node.js bindings to avoid App Router crashes. CSV export requires no library — a client-side `Blob` with `URL.createObjectURL` is sufficient and idiomatic.

**Primary recommendation:** Build the page as a thin Server Component shell that fetches initial CLU data and passes it as props to a `'use client'` `CluWorkspace` component. The client component owns all interactive state. New API routes handle writes. PDF and CSV are client-only. Zero new npm packages are needed except `@react-pdf/renderer`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 14.2.35 (already installed) | Page structure, Server/Client boundary, API routes | Already in project |
| Supabase JS | ^2.98.0 (already installed) | Read CLU records in Server Component, write via API routes from client | Already in project |
| @react-pdf/renderer | ^4.x (to install) | PDF generation client-side — Table, View, Text, Page, Document primitives | Only viable React PDF library; required by v6.0 design context |
| TypeScript + Tailwind | Already installed | Component typing, soil design tokens | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js `dynamic()` | Built-in | Wrap PDF components with `ssr: false` | Required for @react-pdf/renderer — SSR will crash without it |
| `URL.createObjectURL` | Browser API | Trigger CSV download without library | CSV is a simple Blob write |
| `Array.from()` wrapper | TypeScript compat | Iterate Sets/Maps safely | Already established in Phase 27 (tsconfig has no explicit target → defaults ES3) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | jsPDF + html2canvas | react-pdf produces consistent, programmatic output; html2canvas is screenshot-based and fragile with dark themes |
| @react-pdf/renderer | Puppeteer/server-side PDF | Server-side PDF requires a route handler — App Router + react-pdf server-side throws "Component is not a constructor" error (confirmed GitHub issue #2350, #2891); client-side is the correct path |
| Client-side CSV Blob | papaparse / csv-stringify | Overkill; native Blob handles a flat array of objects with no complex escaping needed |
| shadcn/ui Accordion | Custom details/summary | shadcn/ui is planned for v6.0 (noted in MEMORY.md) but NOT yet installed; building with native Tailwind avoids a mid-phase dependency add |

**Installation (only new package needed):**
```bash
cd glomalin-portal && npm install @react-pdf/renderer
```

---

## Architecture Patterns

### Recommended File Structure

```
glomalin-portal/src/
├── app/
│   ├── (protected)/app/fsa-578/
│   │   └── page.tsx                    # MODIFIED: thin Server Component shell — fetches records, passes to CluWorkspace
│   └── api/fsa/
│       ├── clu-records/
│       │   ├── route.ts                # EXISTING: GET — read all records
│       │   └── [id]/route.ts           # NEW: PATCH — update single CLU record
│       └── clu-records/bulk-update/
│           └── route.ts                # NEW: POST — bulk mark reported/unreported + bulk crop assign
├── components/fsa/
│   ├── clu-workspace.tsx               # NEW: 'use client' — top-level state container
│   ├── farm-accordion.tsx              # NEW: Farm-level accordion section
│   ├── tract-accordion.tsx             # NEW: Tract-level accordion section
│   ├── clu-card.tsx                    # NEW: Individual CLU card with inline expand
│   ├── bulk-action-bar.tsx             # NEW: Sticky bottom bar (appears when selection > 0)
│   ├── confirm-dialog.tsx              # NEW: Generic confirmation modal
│   ├── crop-typeahead.tsx              # NEW: Combobox for crop field with FSA list fallback
│   └── acreage-pdf.tsx                 # NEW: PDF document component (dynamic-imported)
└── lib/fsa/
    ├── calc.ts                         # EXISTING — CluRecord type imported by all new files
    └── fsa-crop-list.ts                # NEW: Static FSA crop name list for typeahead fallback
```

### Pattern 1: Server Component Shell → Client Component for State

**What:** The fsa-578 page remains a Server Component (no `'use client'` at page level). It fetches initial CLU records from Supabase using the server Supabase client and passes them as `initialRecords` prop to the `CluWorkspace` client component. The client component owns all interactive state.

**Why:** Server Component fetch avoids an extra client-side waterfall. `initialRecords` prop gives instant hydration — no loading flash. The client component still has a `useEffect`-free data path for the initial render.

**When to use:** Any Next.js App Router page where data is read-only on load but interactive after. This is the established pattern in this codebase (see `dashboard/page.tsx`).

```typescript
// src/app/(protected)/app/fsa-578/page.tsx — Server Component (no 'use client')
import { createClient } from '@/lib/supabase/server'
import CluWorkspace from '@/components/fsa/clu-workspace'
import type { CluRecord } from '@/lib/fsa/calc'

export default async function FsaPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clu_records')
    .select('*')
    .eq('crop_year', 2026)
    .order('farm_number')
    .order('tract_number')
    .order('clu')

  const records: CluRecord[] = data ?? []

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <CluWorkspace initialRecords={records} loadError={error?.message ?? null} />
    </div>
  )
}
```

### Pattern 2: Client State Management Without External Library

**What:** `CluWorkspace` holds three pieces of state: `records` (full array, updated optimistically on save), `selectedIds` (a `Set<string>` of checked CLU IDs), and `expandedId` (the currently expanded card or null). A `Map<string, ValidationWarning[]>` derived from the validation API response (fetched once on mount) maps clu_id to its warnings for O(1) badge lookup.

**Why:** No Zustand, Jotai, or Context needed. The data set is ~444 records. All state lives in one component. This is consistent with the project's zero-extra-dependency discipline.

```typescript
// src/components/fsa/clu-workspace.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import type { CluRecord, ValidationWarning } from '@/lib/fsa/calc'

export default function CluWorkspace({
  initialRecords,
  loadError,
}: {
  initialRecords: CluRecord[]
  loadError: string | null
}) {
  const [records, setRecords] = useState<CluRecord[]>(initialRecords)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<ValidationWarning[]>([])

  useEffect(() => {
    fetch('/api/fsa/validation')
      .then(r => r.json())
      .then(d => setWarnings(d.warnings ?? []))
      .catch(() => {}) // warnings are non-blocking
  }, [])

  // Group records by farm → tract for accordion rendering
  const grouped = useMemo(() => groupByFarmTract(records), [records])

  // ...
}
```

### Pattern 3: Inline Card Expand with Save

**What:** Each `CluCard` holds its own `editDraft` state (a partial `CluRecord`). When the card is in expanded state (`expandedId === record.id`), the card renders editable fields bound to `editDraft`. Clicking Save calls `PATCH /api/fsa/clu-records/[id]` and on success calls a parent `onSave(updated: CluRecord)` callback that replaces the record in the parent array.

**Why:** Edit state is local to the card — no lifted draft state in the workspace. The parent only learns about a save when it succeeds. This prevents cross-card state pollution.

```typescript
// src/components/fsa/clu-card.tsx
'use client'

import { useState } from 'react'
import type { CluRecord } from '@/lib/fsa/calc'

export function CluCard({
  record,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onSave,
}: {
  record: CluRecord
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: () => void
  onToggleSelect: () => void
  onSave: (updated: CluRecord) => void
}) {
  const [draft, setDraft] = useState<Partial<CluRecord>>({})
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/fsa/clu-records/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      const { record: updated } = await res.json()
      onSave(updated)
    } else {
      // surface field-level errors from response
    }
    setSaving(false)
  }
  // ...
}
```

### Pattern 4: PATCH Route for Single Record Update

**What:** `PATCH /api/fsa/clu-records/[id]` accepts a partial `CluRecord` body, validates that only editable fields are present (crop, irrigated, organic, grain_plant_date, use), calls Supabase `.update().eq('id', id).select().single()`, and returns the updated record.

**Why:** Phase 27 established auth-check-first in all FSA route handlers. The `[id]` dynamic segment keeps routes RESTful.

```typescript
// src/app/api/fsa/clu-records/[id]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EDITABLE_FIELDS = ['crop', 'irrigated', 'organic', 'grain_plant_date', 'use'] as const

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Strip any non-editable fields from the body
  const updates: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('clu_records')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}
```

### Pattern 5: Bulk Update Route

**What:** `POST /api/fsa/clu-records/bulk-update` accepts `{ ids: string[], action: 'mark-reported' | 'mark-unreported' | 'assign-crop', crop?: string }` and calls Supabase `.update().in('id', ids)`. Returns updated records.

**Why:** Bulk actions are atomic from the DB perspective. Using `.in()` is idiomatic Supabase for multi-row update by PK array.

```typescript
// src/app/api/fsa/clu-records/bulk-update/route.ts
const { data, error } = await supabase
  .from('clu_records')
  .update(updatePayload)
  .in('id', ids)
  .select()
```

### Pattern 6: PDF Generation — Client-Only with dynamic()

**What:** The PDF document component (`acreage-pdf.tsx`) uses `@react-pdf/renderer` primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`). The download button component is wrapped with `dynamic({ ssr: false })` to prevent App Router from trying to render it on the server (which crashes with "Component is not a constructor").

**Why:** Confirmed by GitHub issues #2350 and #2891 for react-pdf + Next.js App Router route handlers: server-side rendering is not supported. The `ssr: false` dynamic import is the only viable path. Next.js 14.2.35 is past the 14.1.1 fix point — no additional config workaround needed, but `dynamic()` is still required.

```typescript
// In clu-workspace.tsx
import dynamic from 'next/dynamic'

const AcreagePdfButton = dynamic(
  () => import('@/components/fsa/acreage-pdf-button'),
  { ssr: false, loading: () => <span className="text-soil-muted font-mono text-sm">Loading PDF...</span> }
)

// src/components/fsa/acreage-pdf-button.tsx — this file may NOT have 'use client' forced by dynamic
import { PDFDownloadLink } from '@react-pdf/renderer'
import { AcreagePdfDocument } from './acreage-pdf'

export default function AcreagePdfButton({ records }: { records: CluRecord[] }) {
  return (
    <PDFDownloadLink
      document={<AcreagePdfDocument records={records} />}
      fileName="acreage-reporting-summary.pdf"
    >
      {({ loading }) => (
        <button className="...">
          {loading ? 'Generating...' : 'Export PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
```

### Pattern 7: CSV Export — Client-Side Blob

**What:** On "Export CSV" click, the handler builds a CSV string from the current records array and triggers a download via `Blob` + `URL.createObjectURL`. No library needed.

**Why:** Flat data, simple strings. No nested objects or complex escaping. A 20-line helper is idiomatic and avoids a new dependency.

```typescript
function exportCsv(records: CluRecord[]) {
  const headers = [
    'id', 'legacy_id', 'farm_number', 'tract_number', 'clu', 'field_name',
    'farm_name', 'fsa_acres', 'crop', 'irrigated', 'organic', 'double_crop',
    'cover_crop', 'grain_plant_date', 'use', 'reported', 'aph',
    'tillage_2024', 'tillage_2025',
  ]
  const rows = records.map(r =>
    headers.map(h => {
      const v = (r as Record<string, unknown>)[h]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clu-records-2026-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

### Pattern 8: Accordion Smart Default State

**What:** The initial open/closed state of each Farm/Tract accordion is computed once from `initialRecords` before any user interaction. A Farm accordion starts expanded if ANY of its CLUs are unreported or have warnings. A Tract accordion inside an open Farm starts expanded if ANY of its CLUs are unreported.

**Why:** Decision from CONTEXT.md — "sections with warnings or unreported CLUs start expanded, clean sections start collapsed." This must be computed before first render to avoid layout shift.

```typescript
// Computed inside CluWorkspace with useMemo
const defaultExpandedFarms = useMemo(() => {
  const expanded = new Set<string>()
  for (const [farmKey, tracts] of Object.entries(grouped)) {
    const allClusInFarm = Object.values(tracts).flat()
    if (allClusInFarm.some(r => !r.reported)) expanded.add(farmKey)
  }
  return expanded
}, []) // intentionally no deps — only computed from initialRecords snapshot
```

### Pattern 9: Sticky Bulk Action Bar

**What:** A fixed-position div at `bottom-0` with `z-50`, visible only when `selectedIds.size > 0`. Uses the project's soil design tokens. Contains "N selected", "Mark Reported", "Mark Unreported", "Assign Crop", and "Clear" buttons.

**Why:** Gmail/Notion pattern from CONTEXT.md. Fixed positioning ensures it's always visible regardless of scroll position.

```tsx
{selectedIds.size > 0 && (
  <div className="fixed bottom-0 left-0 right-0 z-50 bg-soil-surface border-t border-soil-accent px-6 py-3 flex items-center gap-4">
    <span className="text-soil-accent font-mono text-sm font-bold">
      {selectedIds.size} selected
    </span>
    <button onClick={() => handleBulkAction('mark-reported')} className="...">
      Mark Reported
    </button>
    {/* ... */}
  </div>
)}
```

### Anti-Patterns to Avoid

- **Mutating `records` array in place:** Always call `setRecords(prev => prev.map(...))` — never push/splice the array in state.
- **Fetching CLU records client-side on mount:** The Server Component shell handles the initial fetch; client component receives `initialRecords` as props. No `useEffect` fetch on mount for the main data.
- **Importing @react-pdf/renderer in a Server Component:** Will throw "Component is not a constructor" in Next.js App Router. Any file that imports from `@react-pdf/renderer` must be client-only and wrapped with `dynamic({ ssr: false })` at the usage site.
- **Using `renderToBuffer` in an API route:** Confirmed broken in Next.js App Router (GitHub #2350). Client-side PDF download is the only supported path.
- **Adding `serverComponentsExternalPackages` to next.config:** Not needed for our pattern (client-only PDF). Only needed if attempting server-side PDF generation, which is not our approach.
- **Calling `.update()` without `.select()`:** Supabase `.update()` alone returns no data. Always chain `.select()` to get the updated record back for optimistic UI reconciliation.
- **`Set` / `Map` iteration without `Array.from()`:** Established in Phase 27 — tsconfig defaults to ES3 target; direct `for...of` on Set/Map fails TypeScript compilation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF document generation | Custom HTML-to-PDF conversion | @react-pdf/renderer | Browser print APIs don't guarantee column alignment; canvas-based approaches are fragile with dark CSS themes |
| Crop type-ahead search | Full combobox from scratch | Native `<datalist>` or minimal controlled input with filtered dropdown | The crop list is static (< 200 FSA crops); a datalist or filtered `<ul>` is sufficient; no headless UI library needed |
| Confirmation dialog | Custom modal with portal/focus-trap | Simple `<dialog>` element or inline conditional render with backdrop | Phase scope is narrow; no accessibility-heavy dialog needed for a two-button confirm |
| FSA crop list | Database query or API | Static array in `src/lib/fsa/fsa-crop-list.ts` | The FSA crop name list is stable and fixed; 50-100 entries; a hard-coded constant avoids a network round-trip |

**Key insight:** The project has a strong zero-extra-dependency discipline. The only new package is `@react-pdf/renderer` (required for PDF). Everything else — accordion, checkboxes, sticky bar, CSV, typeahead — is achievable with Tailwind + vanilla React state.

---

## Common Pitfalls

### Pitfall 1: react-pdf Crashes App Router Server Rendering

**What goes wrong:** Importing any symbol from `@react-pdf/renderer` in a file that Next.js attempts to render on the server causes a runtime crash: "TypeError: Component is not a constructor."

**Why it happens:** react-pdf uses browser-only APIs (canvas, font loading) internally. Next.js App Router treats all components as potentially server-renderable unless explicitly opted out.

**How to avoid:** Create a dedicated `acreage-pdf-button.tsx` file that contains all react-pdf imports. Never import react-pdf symbols in `page.tsx` or any Server Component. Use `dynamic(() => import('./acreage-pdf-button'), { ssr: false })` at the call site in `clu-workspace.tsx` (already a `'use client'` component).

**Warning signs:** Any import of `@react-pdf/renderer` appearing outside of a file that is exclusively loaded via `dynamic({ ssr: false })`.

### Pitfall 2: Supabase Update Without `.select()` Returns No Data

**What goes wrong:** `supabase.from('clu_records').update(updates).eq('id', id)` resolves with `data: null` — the update succeeded but no rows are returned.

**Why it happens:** Supabase PostgREST `.update()` returns no rows by default. You must chain `.select()` (and optionally `.single()`) to get the updated row back.

**How to avoid:** Always write `.update(payload).eq('id', id).select().single()` in PATCH routes. Return `{ record: data }` to the client.

**Warning signs:** PATCH handler returns `{ record: null }` — the card doesn't refresh even though the DB was updated.

### Pitfall 3: `Set` / `Map` Iteration Fails TypeScript Compilation

**What goes wrong:** `for (const id of selectedIds)` or `for (const [k, v] of recordMap)` fails with "Type 'IterableIterator<...>' is not an array type" (TS2548).

**Why it happens:** The portal's tsconfig has no explicit `target` (defaults to ES3). `Set` and `Map` iteration requires at least ES6/ES2015 target or `--downlevelIteration`.

**How to avoid:** Always use `Array.from(selectedIds)`, `Array.from(recordMap.entries())`, etc. This pattern is already established in Phase 27 (`calc.ts` and `auto-populate-preview/route.ts`).

**Warning signs:** TypeScript build errors on any `for...of` loop over a Set or Map.

### Pitfall 4: Accordion Default State Computed Too Late (Layout Shift)

**What goes wrong:** Accordion sections that should start expanded render as collapsed on first paint, then snap open — visible layout shift.

**Why it happens:** Computing default expanded state inside a `useEffect` runs after hydration, causing a second render cycle.

**How to avoid:** Initialize `expandedFarms` state from `initialRecords` inside `useState(() => computeDefaultExpanded(initialRecords))` — the lazy initializer runs synchronously during render, not after.

```typescript
const [expandedFarms, setExpandedFarms] = useState<Set<string>>(
  () => computeDefaultExpandedFarms(initialRecords)
)
```

### Pitfall 5: Sticky Bar Covered by Page Footer or Safe Area

**What goes wrong:** The sticky bottom action bar overlaps page content at the bottom, or is cut off on iOS Safari.

**Why it happens:** `fixed bottom-0` without padding for content below, and no safe area inset.

**How to avoid:** Add `pb-16` (or equivalent) to the main content wrapper when `selectedIds.size > 0`. The bar itself should have `pb-safe` (env safe-area-inset-bottom) if mobile support matters. For this project (farm management, desktop-primary), simple `bottom-0` with enough height on the bar is sufficient.

### Pitfall 6: PDF Table Layout with Large Datasets

**What goes wrong:** react-pdf renders all rows on one page, cutting off the last rows beyond the page height.

**Why it happens:** react-pdf does NOT automatically paginate table rows. `<View>` elements overflow a `<Page>` silently — content is clipped.

**How to avoid:** Use `<View break>` at logical page break points (after each Farm section), or use the `wrap` prop on `<View>`. For the acreage summary, break pages between Farm sections. Test with the full 444-record dataset, not a stub.

---

## Code Examples

Verified patterns from official documentation and Phase 27 codebase:

### Supabase `.update()` with return (PATCH route pattern)

```typescript
// Source: https://supabase.com/docs/reference/javascript/update
const { data, error } = await supabase
  .from('clu_records')
  .update({ crop: 'Corn', organic: true })
  .eq('id', '...')
  .select()
  .single()
```

### Supabase `.update()` with `.in()` for bulk (bulk-update route pattern)

```typescript
// Source: https://supabase.com/docs/reference/javascript/update
const { data, error } = await supabase
  .from('clu_records')
  .update({ reported: true })
  .in('id', ['uuid-1', 'uuid-2', 'uuid-3'])
  .select()
```

### react-pdf dynamic import (prevents SSR crash)

```typescript
// Source: https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515
// Source: GitHub diegomura/react-pdf issues #2350, #2891
import dynamic from 'next/dynamic'

const AcreagePdfButton = dynamic(
  () => import('@/components/fsa/acreage-pdf-button'),
  { ssr: false }
)
```

### react-pdf document skeleton

```typescript
// Source: https://react-pdf.org/advanced
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica' },
  table: { display: 'flex', flexDirection: 'column' },
  row: { flexDirection: 'row', borderBottom: '1pt solid #ccc' },
  cell: { padding: '4pt 6pt', fontSize: 9 },
})

export function AcreagePdfDocument({ records }: { records: CluRecord[] }) {
  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={{ fontSize: 14, marginBottom: 8 }}>
          Acreage Reporting Summary — Crop Year 2026
        </Text>
        {/* Farm/Tract grouped rows */}
      </Page>
    </Document>
  )
}
```

### Grouping records for accordion (client-side)

```typescript
// Derived from rollupByFarm / rollupByTract patterns in src/lib/fsa/calc.ts
function groupByFarmTract(records: CluRecord[]) {
  const grouped: Record<string, Record<string, CluRecord[]>> = {}
  for (const r of records) {
    const farm = r.farm_number || 'Unknown'
    const tract = r.tract_number || 'Unknown'
    if (!grouped[farm]) grouped[farm] = {}
    if (!grouped[farm][tract]) grouped[farm][tract] = []
    grouped[farm][tract].push(r)
  }
  return grouped
}
```

### FSA crop list (static constant)

```typescript
// src/lib/fsa/fsa-crop-list.ts — static, no API needed
// Source: USDA FSA Handbook 2-CP (common crop type codes)
export const FSA_CROP_LIST: string[] = [
  'Corn', 'Soybeans', 'Winter Wheat', 'Spring Wheat', 'Oats', 'Barley',
  'Sorghum', 'Sunflowers', 'Canola', 'Flax', 'Cotton', 'Rice', 'Peanuts',
  'Alfalfa', 'Clover', 'Timothy', 'Fescue', 'Orchardgrass',
  'Rye', 'Triticale', 'Millet', 'Buckwheat',
  'Field Peas', 'Dry Beans', 'Lentils', 'Chickpeas',
  'Potatoes', 'Sugarbeets', 'Sweet Corn', 'Popcorn',
  'Cover Crop', 'CRP', 'Idle', 'Fallow',
  // Rock County / operation-specific additions
  'Organic Corn', 'Organic Soybeans', 'Organic Winter Wheat',
  'Hybrid Rye', 'Organic Rye',
]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `renderToBuffer` in API route handler | Client-side `PDFDownloadLink` with `dynamic({ ssr: false })` | Next.js 13/14 App Router era | Server-side react-pdf in App Router route handlers is broken; client-only is the supported pattern |
| Global `useOptimistic` for all records | Local component state (`useState` in parent, callback prop to child) | React 18 + App Router | For 444 records with no real-time requirement, `useState` in the workspace component is simpler and sufficient; `useOptimistic` adds complexity with no benefit here |
| Full shadcn/ui component suite | Tailwind utility classes with minimal custom components | v6.0 decision (not yet installed) | shadcn/ui is planned but not yet installed; Phase 28 builds without it; it can be added in a later phase without breaking existing patterns |

**Deprecated/outdated:**
- `createClientComponentClient` (older Supabase SSR approach): The project uses `createClient` from `@/lib/supabase/browser` (the `@supabase/ssr` pattern). Never use the deprecated `createClientComponentClient`.
- `experimental.serverComponentsExternalPackages` in next.config: Only needed if attempting server-side react-pdf rendering — not our approach; client-only avoids this entirely.

---

## Open Questions

1. **Supabase RLS on UPDATE operations**
   - What we know: Phase 27 created RLS on clu_records table with the script. The migration script uses `service_role` to bypass RLS. The existing GET route uses server Supabase client (which uses `anon` key with user session for auth).
   - What's unclear: Whether the RLS policy on `clu_records` permits UPDATE from the user's session (anon key + authenticated user). Phase 27 only validated SELECT.
   - Recommendation: The PATCH and bulk-update routes use `createClient()` (server client with user session). If RLS blocks UPDATE, add a Supabase policy: `CREATE POLICY "authenticated users can update clu_records" ON clu_records FOR UPDATE USING (auth.role() = 'authenticated')`. Plan the first task to verify UPDATE permission with a test call.

2. **Crop typeahead data source merge**
   - What we know: The auto-populate-preview API already fetches farm-budget enterprise summaries. The crop names from that are the "exact/suggested" matches. The CONTEXT.md says "type-ahead search populated from farm-budget macro rollup crops + a predefined FSA crop list."
   - What's unclear: Whether the typeahead should call the auto-populate-preview API on every keystroke, or cache the farm-budget crop list once.
   - Recommendation: Fetch the farm-budget crop list once on component mount (same `AbortSignal.timeout(5000)` pattern, cache in component state). Merge with the static FSA_CROP_LIST. Filter client-side on keystroke. No live API call per keystroke.

3. **next.config update needed for react-pdf**
   - What we know: Next.js 14.2.35 is past the 14.1.1 crash fix. The `dynamic({ ssr: false })` pattern is the correct approach without config changes.
   - What's unclear: Whether the Next.js build will warn about react-pdf during module resolution.
   - Recommendation: Install `@react-pdf/renderer` and build first. If build warnings appear, add `serverComponentsExternalPackages: ['@react-pdf/renderer']` to `next.config.mjs` as a fallback. This is a low-risk mitigation not a required step.

---

## Validation Architecture

> workflow.nyquist_validation is NOT present in .planning/config.json — this section is OMITTED per instructions.

(The config.json has `"workflow": { "research": true, "plan_check": true, "verifier": true }` but no `nyquist_validation` key. Treating as false — Validation Architecture section omitted.)

---

## Sources

### Primary (HIGH confidence)
- Phase 27 SUMMARY files (27-01-SUMMARY.md, 27-02-SUMMARY.md) — established patterns: Array.from() for Set/Map, auth check pattern, cross-app fetch pattern, Supabase upsert shape
- `src/lib/fsa/calc.ts` — CluRecord interface (all fields confirmed), rollup function patterns used in groupByFarmTract
- `src/app/api/fsa/clu-records/route.ts` — GET route shape; PATCH route follows same structure
- `glomalin-portal/package.json` — confirmed: Next.js 14.2.35, no react-pdf installed, no shadcn/ui installed
- `tailwind.config.ts` — soil design tokens confirmed (soil-bg, soil-surface, soil-border, soil-accent, soil-text, soil-muted, soil-green)
- Official Supabase docs (https://supabase.com/docs/reference/javascript/update) — `.update().select()` pattern

### Secondary (MEDIUM confidence)
- https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515 — dynamic import SSR disable pattern, confirmed by multiple GitHub issues
- https://github.com/diegomura/react-pdf/issues/2350 — renderToBuffer broken in App Router (multiple confirmations)
- https://github.com/diegomura/react-pdf/issues/2891 — ongoing App Router compatibility discussion
- MEMORY.md project context — v6.0 packages list includes @react-pdf/renderer (confirmed as intended dependency)

### Tertiary (LOW confidence)
- WebSearch result re: Next.js `useOptimistic` hook — research supports decision to NOT use it for this phase; simple useState is sufficient for 444 records with no real-time requirement

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Next.js 14, Supabase, Tailwind already in project; only @react-pdf/renderer is new and its dynamic import pattern is confirmed by official discussion + multiple sources
- Architecture: HIGH — Server Component shell → Client Component pattern is established in this codebase (dashboard/page.tsx); all Phase 27 APIs are readable in full detail
- Pitfalls: HIGH for react-pdf SSR crash (confirmed GitHub issues); HIGH for Supabase update pattern (official docs); MEDIUM for RLS UPDATE permission (open question)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (react-pdf is active project, check for breaking changes in minor versions; Next.js 14 is stable)
