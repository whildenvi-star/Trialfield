# Phase 72: Acreage Reconciliation Tool - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 13 (new + modified)
**Analogs found:** 13 / 13

**IMPORTANT — read RESEARCH.md's "Summary" and "Existing Infrastructure" sections first.** This phase is brownfield, not greenfield: a working FSA-578 reconciliation system already exists at `glomalin-portal/src/components/fsa/` and `src/app/api/fsa/`. Every pattern below is drawn from that existing system. Do not invent a parallel architecture — extend the exact files and RPC conventions cited here.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/compliance/acreage-tab.tsx` (modify) | component (tab shell) | request-response | itself (existing `view` state + dynamic-import pattern) | exact |
| `src/components/fsa/reconciliation-view.tsx` (promote from orphan) | component (view container) | request-response | itself — already built, currently unwired | exact |
| `src/components/fsa/merge-panel.tsx` (new) | component (form/panel) | CRUD | `src/components/fsa/split-panel.tsx` | exact (mirror UX) |
| `src/components/fsa/clu-boundary-import.tsx` (new) | component (upload UI) | file-I/O | `src/components/maps/boundary-import.tsx` | exact |
| `src/app/api/fsa/clu-boundaries/import/route.ts` (new) | route (API) | file-I/O | `src/app/api/maps/import/route.ts` | exact |
| `src/app/api/fsa/clu-records/merge/route.ts` (new) | route (API) | CRUD | `src/app/api/fsa/clu-records/[id]/split/route.ts` | exact |
| `supabase/migrations/038_manual_spatial_editing.sql` (new) | migration (RPC) | CRUD | `supabase/migrations/032_clu_split_support.sql` | exact |
| `src/lib/fsa/thresholds.ts` (new) | utility (config-driven engine) | transform | `src/lib/fsa/reconciliation.ts` (`deltaStatus`/`deltaCause`) + `src/lib/fsa/calc.ts` (`reconciliationStatus`/`attributeCause`) | role-match (duplicate to retire) |
| `src/app/api/fsa/admin/acreage-thresholds/route.ts` (new) | route (API, CRUD config) | CRUD | `src/app/api/fsa/clu-records/route.ts` (CRUD route shape) + `src/app/api/fsa/export-shapefile/route.ts` (guard pattern) | role-match |
| `src/app/api/fsa/export-shapefile/route.ts` (modify — extend DBF schema) | route (file export) | file-I/O | itself | exact |
| `supabase/migrations/012_reconciliation_rpc.sql` → new migration extending `get_farm_reconciliation` (or new RPC) to fold in `coverage_events` | migration (RPC) | CRUD | `supabase/migrations/033_clu_overlay_intersections.sql` (`get_clu_overlay_intersections`, already does the 3-way CLU∩zone∩coverage intersection at single-CLU level) | exact |
| `src/lib/fsa/adapters/fieldview.ts` (modify — activate live OAuth path, no structural change) | service (adapter) | event-driven / request-response | itself (`CoverageAdapter` interface, `FieldOpsAdapter` as the sibling implementation to model `createFieldViewAdapter` against) | exact |
| `vercel.json` `crons[]` + `src/app/api/fsa/fieldview/sync/route.ts` (new) | route (scheduled job) | batch | `src/app/api/fsa/fieldview/dat-import/route.ts` (adapter invocation + `import_coverage_event` RPC write pattern) | role-match |

## Pattern Assignments

### `src/components/compliance/acreage-tab.tsx` (component, request-response)

**Analog:** itself — `glomalin-portal/src/components/compliance/acreage-tab.tsx` (126 lines, read in full)

This file is the thing being modified, not a separate analog — the pattern to copy is its own existing structure for adding a 6th view.

**Dynamic-import pattern for map-bearing views** (lines 12–21):
```typescript
// CRITICAL: ssr: false required — map components use maplibre-gl which requires `window`
const ReportingMap = dynamic(
  () => import('@/components/fsa/reporting-map').then((m) => m.ReportingMap),
  { ssr: false }
)

const OverlayMap = dynamic(
  () => import('@/components/fsa/overlay-map').then((m) => m.OverlayMap),
  { ssr: false }
)
```
Add a third: `const ReconciliationView = dynamic(() => import('@/components/fsa/reconciliation-view').then((m) => m.ReconciliationView), { ssr: false })` — `ReconciliationView` itself lazy-loads `ReconciliationMap` internally, so this outer dynamic-import is for consistency with the other map-bearing tabs, not strictly required (ReconciliationView has no top-level maplibre import), but keep the pattern uniform.

**View-state union + toggle bar** (lines 32, 76–88):
```typescript
const [view, setView] = useState<'clu' | 'map' | 'zones' | 'overlay' | 'coverage'>('map')
...
{(['map', 'clu', 'zones', 'overlay', 'coverage'] as const).map((v, i) => {
  const labels = { map: 'Map View', clu: 'CLU Records', zones: 'Zone Setup', overlay: 'Overlay', coverage: 'As-Applied' }
  return (
    <button key={v} onClick={() => setView(v)} className={...}>{labels[v]}</button>
  )
})}
```
Add `'reconciliation'` to the union type and to the array literal, plus a `reconciliation: 'Reconciliation'` label entry. Do NOT add a new top-level nav item (D-01) — this is purely an addition to the existing tab-internal toggle.

**View render block pattern** (lines 111–123):
```typescript
{view === 'overlay' && (
  <div className="flex-1 min-h-0">
    <OverlayMap cropYear={CURRENT_CROP_YEAR} />
  </div>
)}

{view === 'coverage' && (
  <CoverageImportPanel cropYear={CURRENT_CROP_YEAR} />
)}
```
Add: `{view === 'reconciliation' && <ReconciliationView cropYear={CURRENT_CROP_YEAR} />}` — `ReconciliationView` already accepts `cropYear` as an optional prop defaulting to `CURRENT_CROP_YEAR` (see below), so this is a direct drop-in.

**wrapClass viewport-sizing rule** (lines 51–55) — extend the ternary to include `'reconciliation'` alongside `'overlay'`/`'map'` since `ReconciliationView` also needs full remaining-viewport height (it has an internal three-panel flex layout, not a scrolling card list):
```typescript
const wrapClass = (view === 'overlay' || view === 'map')
  ? 'flex flex-col h-[calc(100vh-280px)] min-h-[520px]'
  : 'max-w-7xl mx-auto px-0'
```

---

### `src/components/fsa/reconciliation-view.tsx` (component, request-response) — PROMOTE, don't rebuild

**Analog:** itself — already fully built (205 lines), just not imported anywhere. Read in full above.

**Structure to preserve and extend:**
- Farm picker → parallel fetch of `/api/fsa/reconciliation` + `/api/fsa/clu-records` (lines 63–98)
- Three-panel layout: zone map (30%) / reconciliation table (40%) / CLU map (30%) (lines 156–195)
- `SummaryBar` component reading `{ total, ok, flagged, unresolved }` (lines 27–43)
- Export buttons (CSV via plain `<a href>` anchor + PDF via dynamic `Form578Button`) (lines 135–153)

**Required extension points for Phase 72 (D-11–14, D-20, D-21):**
1. The `Summary` interface (`{ total, ok, flagged, unresolved }`) and the `deltaStatus()`/`deltaCause()` calls inside `groupRpcRows()` (in `reconciliation.ts`) must switch from the hardcoded 0.1ac/1.0ac cutoffs to the new `evaluateThreshold()` in `thresholds.ts` (see Pattern 3 below) — this is the wiring point, not a new component.
2. `cluFeatureCollection`/`zoneFeatureCollection` (in `reconciliation.ts`, lines 164–210) already carry a `status` property per feature for map coloring — this is the existing hook for D-20's Green/Yellow/Red map ring/fill; no new map-coloring plumbing needed, only the status values need to come from the new threshold engine.
3. `ReconciliationRow` (in `reconciliation.ts`, lines 40–60) currently only has `zones: ZoneIntersection[]` (CLU×zone) — extend with a `coverage: CoverageIntersection[]` array (CLU×as-planted) fed by the extended/new farm-reconciliation RPC, mirroring the `zones` shape exactly.

---

### `src/components/fsa/merge-panel.tsx` (new component, CRUD)

**Analog:** `glomalin-portal/src/components/fsa/split-panel.tsx` (234 lines, read in full above)

**Drawer + form-row pattern to mirror** (lines 1–52, 104–131):
```typescript
'use client'
import { useState } from 'react'
import { Drawer } from '@/components/compliance/ui/drawer'
import { CropTypeahead } from '@/components/fsa/crop-typeahead'
import { INTENDED_USE_VALUES } from '@/lib/fsa/calc'

export interface MergeProposal {
  parent_ids: string[]        // selected CLU/sub-CLU record IDs to merge
  merged_label: string        // new reporting-unit label
  acres: number                // ST_Union acreage, computed server-side, read-only display
  crop: string
  irrigated: boolean
  organic: boolean
  intended_use: string
}
```
Reuse `SplitPanel`'s acres-sum-mismatch warning UX (lines 53–55, 118–125) inverted: for merge, warn if the union acreage differs significantly from the sum of the input parcels' `fsa_acres` (sliver/gap detection), not from a single parent's declared acres.

**Submit handler pattern to copy verbatim (adapt URL + payload shape)** (lines 57–102):
```typescript
async function handleConfirm() {
  setError(null)
  // client-side validation (crop required, ≥2 parent_ids, etc.)
  setSaving(true)
  try {
    const res = await fetch(`/api/fsa/clu-records/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_ids: proposal.parent_ids, merged_label: proposal.merged_label, crop: proposal.crop, irrigated: proposal.irrigated, organic: proposal.organic, intended_use: proposal.intended_use || null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`)
    }
    onMergeComplete()
    onClose()
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error')
  } finally {
    setSaving(false)
  }
}
```
Footer buttons, error display, and "original records preserved" undo note (lines 205–231) should be copied verbatim — the merge RPC should mark inputs `superseded` exactly like split does, never delete.

**Selection trigger to mirror:** `split-panel.tsx` is opened from `overlay-map.tsx`'s "Split by zones"/"Split by coverage" buttons and the draw-mode flow (see Pattern 2 below). `merge-panel.tsx` should be opened the same way — from a new "Select CLUs to merge" multi-select mode on the same overlay map, not a separate map component.

---

### `src/components/fsa/clu-boundary-import.tsx` (new component, file-I/O)

**Analog:** `glomalin-portal/src/components/maps/boundary-import.tsx` (195 lines, read in full above)

**Copy verbatim, changing only the endpoint and result-summary fields:**
```typescript
'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  accept: { 'application/zip': ['.zip'] },
  maxFiles: 1,
  onDrop,
  disabled: status === 'uploading',
})
```
Full drag-drop → `FormData` → `fetch(..., { method: 'POST', body: formData })` → status state machine (`idle`/`uploading`/`complete`/`error`) is the exact shape to copy (lines 21–63). Change `ImportResult` fields from `{ matched, updated, unmatched, noGeometry, farmCenter }` (field-boundary semantics) to something like `{ imported, farms: string[], tracts: string[], multiPolygonNormalized: number, errors: string[] }` (CLU-boundary semantics — see Pitfall 2 below on MultiPolygon handling).

---

### `src/app/api/fsa/clu-boundaries/import/route.ts` (new route, file-I/O)

**Analog:** `glomalin-portal/src/app/api/maps/import/route.ts` (267 lines, read in full above)

**Auth + admin-guard pattern to copy** (lines 70–90) — note this route uses a bespoke inline admin check rather than `requireModuleAccess`; for the new CLU-boundary import route, prefer the project-wide `requireModuleAccess('fsa-578')` guard (used by every other `/api/fsa/*` route) over duplicating this inline check:
```typescript
const guard = await requireModuleAccess('fsa-578')
if (isGuardError(guard)) return guard
const { supabase } = guard
```

**shpjs parse pattern to copy verbatim** (lines 92–126):
```typescript
let formData: FormData
try { formData = await request.formData() } catch { return NextResponse.json({ error: 'Could not parse multipart form data' }, { status: 400 }) }
const file = formData.get('file')
if (!file || !(file instanceof File)) return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 })
if (!file.name.toLowerCase().endsWith('.zip')) return NextResponse.json({ error: 'Only .zip shapefile bundles are accepted' }, { status: 400 })

const arrayBuffer = await file.arrayBuffer()
let geojson: ReturnType<typeof shp> extends Promise<infer T> ? T : never
try { geojson = await shp(arrayBuffer) } catch (err) {
  const detail = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ error: 'Shapefile parse failed', detail }, { status: 422 })
}
const rawFeatures: GeoJSON.Feature[] = Array.isArray(geojson) ? geojson.flatMap((fc) => fc.features) : geojson.features
```

**CRITICAL DEVIATION from this analog — see RESEARCH.md Pitfall 2:** `clu_boundaries.geometry` is declared `geometry(Polygon, 4326)`, not MultiPolygon. Unlike `field_boundaries` (which this analog writes to and which may already be widened), the new CLU import route must either (a) widen `clu_boundaries.geometry` to `geometry(MultiPolygon, 4326)` in the same migration that adds import support (matching `015_widen_zone_geometry.sql` / `019_widen_coverage_geometry.sql`), or (b) call `ST_Multi()`/split MultiPolygon features into separate single-Polygon rows before insert. Do not hand this straight to `ST_GeomFromGeoJSON` without one of these two steps.

**Attribute extraction to add (not in the analog, since field-boundary import doesn't need it):** extract `farm_number`/`tract_number`/`clu_label`/`fsa_acres` from shapefile DBF attributes (property keys vary — same "try common property keys" pattern as lines 163–164 of the analog) rather than matching by field name against the registry.

**Service-role client pattern to copy verbatim** (lines 204–211):
```typescript
const adminClient =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : supabase
```

---

### `src/app/api/fsa/clu-records/merge/route.ts` (new route, CRUD)

**Analog:** `glomalin-portal/src/app/api/fsa/clu-records/[id]/split/route.ts` (155 lines, read in full above)

**Full request/validate/RPC/rollback shape to mirror:**
```typescript
const guard = await requireModuleAccess('fsa-578')
if (isGuardError(guard)) return guard
const { supabase } = guard

let body: { parent_ids: string[]; merged_label: string; crop: string; irrigated: boolean; organic: boolean; intended_use: string | null }
try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

if (!Array.isArray(body.parent_ids) || body.parent_ids.length < 2) {
  return NextResponse.json({ error: 'At least 2 CLU records are required to merge' }, { status: 400 })
}

// Validate all parents exist and are not already superseded (mirror lines 83-99 of split/route.ts)
const { data: parents, error: parentErr } = await supabase
  .from('clu_records')
  .select('id, superseded, farm_number, tract_number, crop_year')
  .in('id', body.parent_ids)
if (parentErr || !parents || parents.length !== body.parent_ids.length) {
  return NextResponse.json({ error: 'One or more CLU records not found' }, { status: 404 })
}
if (parents.some((p) => p.superseded)) {
  return NextResponse.json({ error: 'One or more selected records are already split/merged' }, { status: 409 })
}

const { data: newId, error: mergeErr } = await supabase.rpc('merge_reporting_units', {
  p_parent_ids: body.parent_ids,
  p_merged_label: body.merged_label,
  p_crop: body.crop,
  p_irrigated: body.irrigated,
  p_organic: body.organic,
  p_intended_use: body.intended_use,
})
if (mergeErr) return NextResponse.json({ error: 'Merge failed', details: mergeErr.message }, { status: 500 })

// Mark all parents superseded (mirror lines 129-142 — rollback the new row if this fails)
const { error: supersedeErr } = await supabase.from('clu_records').update({ superseded: true }).in('id', body.parent_ids)
if (supersedeErr) {
  await supabase.from('clu_records').delete().eq('id', newId as string)
  return NextResponse.json({ error: 'Failed to supersede merged records', details: supersedeErr.message }, { status: 500 })
}

return NextResponse.json({ merged_id: newId, superseded_ids: body.parent_ids })
```
Note the split route commits N children in a loop and rolls back on partial failure (lines 104–127) — the merge route is the inverse (N parents → 1 child) but should use the same "rollback on partial failure, never leave orphaned state" discipline.

---

### `supabase/migrations/038_manual_spatial_editing.sql` (new migration, CRUD)

**Analog:** `glomalin-portal/supabase/migrations/032_clu_split_support.sql` (253 lines, read in full above)

**SECURITY DEFINER function shape to mirror exactly** (lines 65–169):
```sql
CREATE OR REPLACE FUNCTION merge_reporting_units(
  p_parent_ids   uuid[],
  p_merged_label text,
  p_crop         text,
  p_irrigated    boolean,
  p_organic      boolean,
  p_intended_use text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_id      uuid;
  merged_geom geometry(Polygon, 4326);
  merged_ac   numeric(10, 2);
  first_row   clu_records%ROWTYPE;
BEGIN
  -- Validate all inputs exist and are not already superseded
  IF (SELECT COUNT(*) FROM clu_records WHERE id = ANY(p_parent_ids) AND NOT superseded) <> array_length(p_parent_ids, 1) THEN
    RAISE EXCEPTION 'One or more parent CLU records not found or already superseded';
  END IF;

  SELECT * INTO first_row FROM clu_records WHERE id = p_parent_ids[1];

  -- ST_Union via ST_Collect for >2 inputs, ST_MakeValid guard per Pitfall 4
  SELECT ST_Multi(ST_Union(ST_MakeValid(COALESCE(split_geometry, (SELECT geometry FROM clu_boundaries cb WHERE cb.farm_number = cr.farm_number AND cb.tract_number = cr.tract_number AND cb.clu_label = cr.clu AND cb.crop_year = cr.crop_year)))))
    INTO merged_geom
    FROM clu_records cr WHERE cr.id = ANY(p_parent_ids);

  merged_ac := ROUND(CAST(ST_Area(merged_geom::geography) / 4046.856422 AS numeric), 2);

  INSERT INTO clu_records (
    crop_year, farm_number, tract_number, clu, field_name, farm_name,
    fsa_acres, sub_label, split_geometry, merged_from_ids,
    crop, irrigated, organic, use, superseded
  ) VALUES (
    first_row.crop_year, first_row.farm_number, first_row.tract_number, p_merged_label, first_row.field_name, first_row.farm_name,
    merged_ac, NULL, merged_geom, p_parent_ids,
    p_crop, p_irrigated, p_organic, p_intended_use, false
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;
```
**Schema addition needed:** add `merged_from_ids uuid[]` column to `clu_records` in this same migration (mirrors `parent_clu_id uuid` from migration 032, but as an array since merge is many→one rather than split's one→many) — this is the schema decision RESEARCH.md flags as "a schema decision for the planner"; the array-column approach is recommended to avoid a join table for a rarely-multi-valued relationship.

**GiST index + `ST_MakeValid` convention to copy** (migration 032 lines 43–45, and Pitfall 4 in RESEARCH.md):
```sql
CREATE INDEX IF NOT EXISTS idx_cr_split_geometry ON clu_records USING GIST (split_geometry) WHERE split_geometry IS NOT NULL;
```
Every geometry input to the merge RPC must be wrapped in `ST_MakeValid()` before `ST_Union` — this is non-negotiable per the codebase's established defensive pattern (migrations 017, 033 do this for every intersection).

---

### `src/lib/fsa/thresholds.ts` (new utility, transform) — retires two duplicate implementations

**Analog (to retire, not extend):** `glomalin-portal/src/lib/fsa/reconciliation.ts` lines 138–156 (`deltaStatus`/`deltaCause`) AND `glomalin-portal/src/lib/fsa/calc.ts` lines 772–792 (`reconciliationStatus`/`attributeCause`) — read in full above, both hardcode `0.1`/`1.0` absolute-acre cutoffs:
```typescript
// reconciliation.ts — TO BE REPLACED
export function deltaStatus(delta: number): ReconciliationStatus {
  const abs = Math.abs(delta)
  if (abs <= 0.1) return 'ok'
  if (abs <= 1.0) return 'flagged'
  return 'unresolved'
}

// calc.ts — TO BE REPLACED (near-identical duplicate)
export function reconciliationStatus(delta: number): ReconciliationStatus {
  if (Math.abs(delta) <= 0.1) return 'ok'
  if (Math.abs(delta) <= 1.0) return 'flagged'
  return 'unresolved'
}
```

**New function to build, per RESEARCH.md Pattern 3** (implements D-11–14's configurable %+ac Green/Yellow/Red, reading from a new `acreage_thresholds` config table via a route or server component, not hardcoded):
```typescript
export interface ThresholdConfig {
  green_pct: number; green_ac: number
  yellow_pct: number; yellow_ac: number
  red_sliver_ac: number
}

export function evaluateThreshold(delta: number, fsaAcres: number, config: ThresholdConfig): 'green' | 'yellow' | 'red' {
  const absDelta = Math.abs(delta)
  const pctDelta = fsaAcres > 0 ? (absDelta / fsaAcres) * 100 : 0
  if (absDelta <= Math.max(config.green_ac, fsaAcres * config.green_pct / 100)) return 'green'
  if (absDelta <= Math.max(config.yellow_ac, fsaAcres * config.yellow_pct / 100) || (pctDelta > config.green_pct && pctDelta <= config.yellow_pct)) return 'yellow'
  return 'red'
}
```
Keep the existing `ReconciliationStatus`/`ReconciliationCause` type names in `calc.ts` if other files import them, but redirect their computation through this one function — do not add a third parallel implementation (RESEARCH.md Anti-Pattern, explicit).

---

### `supabase/migrations/012_reconciliation_rpc.sql` → extend `get_farm_reconciliation` (or add sibling RPC)

**Analog:** `glomalin-portal/supabase/migrations/033_clu_overlay_intersections.sql` — `get_clu_overlay_intersections()` already performs the exact CLU∩zone∩coverage triple intersection this phase needs, just scoped to a single CLU rather than farm-wide.

**Geography-cast acreage convention (copy exactly, this divisor is used project-wide):**
```sql
-- Source: glomalin-portal/supabase/migrations/012_reconciliation_rpc.sql
ROUND(
  CAST(ST_Area(ST_Intersection(cb.geometry::geography, mz.geometry::geography)) / 4046.856422 AS numeric),
  2
) AS intersection_ac
```
Extend `get_farm_reconciliation(farm, year)` (or create `get_farm_reconciliation_v2`) to LEFT JOIN `coverage_events` the same way it currently joins `management_zones`, using `ST_MakeValid()` on both sides of every intersection per Pitfall 4. Return an additional `coverage_id`, `coverage_geojson`, `coverage_crop`, `coverage_acres` row-set analogous to the existing `zone_id`/`zone_geojson`/`zone_crop` columns, so `groupRpcRows()` in `reconciliation.ts` can push into a new `coverage: CoverageIntersection[]` array exactly like it currently pushes into `zones`.

---

### `src/lib/fsa/adapters/fieldview.ts` (modify — activate, not rebuild)

**Analog:** itself — the `FieldOpsAdapter` implementation in the same file (lines 1–60+ read above) is the sibling pattern `createFieldViewAdapter()` should already be following (confirmed by RESEARCH.md as "fully implemented," not stubbed at the code level).

**Interface contract to preserve, do not change signatures:**
```typescript
export interface CoverageAdapter {
  id:            string
  name:          string
  isConfigured:  () => boolean
  fetchEvents:   (cropYear: number) => Promise<NormalizedCoverageEvent[]>
}
```
`fieldopsConfigured()` (lines 46–53) is the exact pattern `createFieldViewAdapter().isConfigured()` should already mirror for `FIELDVIEW_CLIENT_ID`/`FIELDVIEW_CLIENT_SECRET`/`FIELDVIEW_API_KEY`. **This is a `checkpoint:human-verify` task (RESEARCH.md Pitfall 5), not new code** — the credential registration with Climate/Bayer is the actual blocker, not the adapter.

---

### `src/app/api/fsa/fieldview/sync/route.ts` (new, batch/scheduled)

**Analog:** `glomalin-portal/src/app/api/fsa/fieldview/dat-import/route.ts` (adapter-invocation + `import_coverage_event` RPC write pattern — same file family, not separately re-read since `coverage-import/route.ts` shares the identical RPC-call shape already documented in RESEARCH.md) and `src/app/api/fsa/export-shapefile/route.ts`'s guard pattern for the auth style, swapped for a cron-secret header check (Vercel's standard pattern) instead of session auth, since this route is scheduler-invoked:
```typescript
const cronSecret = request.headers.get('authorization')
if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Internally, call `createFieldViewAdapter().fetchEvents(cropYear)` then loop-insert via the existing `import_coverage_event` RPC — same as the manual DAT import path, just triggered by `vercel.json` `crons[]` instead of a user click.

## Shared Patterns

### Access Guard (apply to every new `/api/fsa/*` route)
**Source:** `glomalin-portal/src/app/api/fsa/export-shapefile/route.ts` lines 3, 223–225 (pattern used identically across all ~20 existing `/api/fsa/*` routes)
```typescript
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
const guard = await requireModuleAccess('fsa-578')
if (isGuardError(guard)) return guard
const { supabase } = guard
```
Apply to: `clu-boundaries/import`, `clu-records/merge`, `admin/acreage-thresholds`. The `fieldview/sync` cron route is the one exception — use the cron-secret header check instead, since there's no user session at cron invocation time.

### Server-side spatial RPC via `SECURITY DEFINER`
**Source:** `glomalin-portal/supabase/migrations/032_clu_split_support.sql` lines 65–169 (`create_clu_split`)
**Apply to:** every new migration in this phase (`merge_reporting_units`, extended `get_farm_reconciliation`, any threshold-eval-in-SQL variant). Never compute geometry/acreage in TypeScript — `ROUND(CAST(ST_Area(geom::geography) / 4046.856422 AS numeric), 2)` is the fixed project-wide acreage formula, and `ST_MakeValid()` must wrap every geometry sourced from an import or user draw before any intersection/union/difference call.

### Service-role client for admin geometry writes
**Source:** `glomalin-portal/src/app/api/maps/import/route.ts` lines 204–211
```typescript
const adminClient =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : supabase
```
**Apply to:** `clu-boundaries/import/route.ts` (bypasses RLS for bulk geometry insert), any admin-only threshold-config write route.

### Dynamic import for MapLibre-dependent components
**Source:** `glomalin-portal/src/components/compliance/acreage-tab.tsx` lines 12–21, and the draw-tool activation in `glomalin-portal/src/components/fsa/overlay-map.tsx` lines 260–314
```typescript
const SomeMapComponent = dynamic(() => import('@/components/fsa/some-map').then((m) => m.SomeMapComponent), { ssr: false })
// inside the component itself, for the draw plugin specifically:
const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default
// @ts-expect-error — no type declarations for the CSS sub-path
await import('@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css')
```
**Apply to:** any new map component; and the merge-select-mode / draw-from-scratch mode added to `overlay-map.tsx`, which should reuse this exact dynamic-import + `IControl` registration + fallback-alert-on-failure pattern (lines 305–313) rather than a new draw integration.

### DBF field-name 10-char limit (RESEARCH.md Pitfall 6)
**Source:** `glomalin-portal/src/app/api/fsa/export-shapefile/route.ts` lines 291–310
**Apply to:** the DBF_FIELDS extension for the RMA schema — reserve `RMA_UNIT` (8), `GROWER` (6), `SHARE_PCT` (9), `POLICY_NO` (9), `FAILED_AC` (9), all ≤10 chars, following the existing `FARM_NBR`/`TRACT_NBR`/`GLM_ZONE` naming convention exactly. `buildDbf()`'s truncation via `Buffer.from(f.name.substring(0, 10))` (line 184) does not error on collision — verify no two new field names collide after truncation.

## No Analog Found

None. Every file in this phase's scope has a direct, concrete analog already in `glomalin-portal` per the table above — this is the core finding of RESEARCH.md: Phase 72 is an extend-and-fill-gaps phase, not greenfield work.

## Metadata

**Analog search scope:** `glomalin-portal/src/components/fsa/`, `src/components/compliance/`, `src/components/maps/`, `src/app/api/fsa/`, `src/app/api/maps/`, `src/lib/fsa/`, `supabase/migrations/010–036`
**Files scanned:** 13 target files against ~60 existing FSA/map files; 10 read in full or targeted-range for pattern extraction (`acreage-tab.tsx`, `split-panel.tsx`, `reconciliation-view.tsx`, `reconciliation.ts`, `calc.ts` [2 ranges], `export-shapefile/route.ts`, `overlay-map.tsx` [lines 240–339], `boundary-import.tsx`, `migrations/032`, `maps/import/route.ts`, `clu-records/[id]/split/route.ts`, `fieldview.ts` [lines 1–60], `reconciliation/route.ts`)
**Pattern extraction date:** 2026-08-01
