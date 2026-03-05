# Pitfalls Research

**Domain:** Adding FSA-578 planting workflow, crop insurance decision tool, and claims tracking to an existing Next.js 14 + Supabase portal (glomalin-portal). Cross-module integration with standalone Express apps (fsa-acres port 3002, farm-budget port 3001, farm-registry port 3005).
**Researched:** 2026-03-04
**Confidence:** HIGH for Next.js/Supabase pitfalls (grounded in existing codebase analysis + official docs); HIGH for drag-and-drop hydration (confirmed in dnd-kit GitHub issues + Next.js hydration docs); HIGH for cross-app HTTP pitfalls (confirmed in existing fsa-acres codebase which already implements timeout + cache pattern); MEDIUM for insurance calculation accuracy scope (regulatory sources + domain analysis); MEDIUM for FSA-578 PDF layout (react-pdf known behavior + FSA form structure analysis)

---

## Critical Pitfalls

### Pitfall 1: Drag-and-Drop in Next.js App Router Causes Hydration Mismatch

**What goes wrong:**
The claims Kanban board and the FSA card-based workflow both use drag-and-drop to reorder cards or reassign items. In Next.js App Router, components are server-rendered first, then hydrated on the client. Drag-and-drop libraries (dnd-kit, react-beautiful-dnd) maintain internal state about pointer position, active drag element, and drop zones. The server has no concept of these states, so its rendered HTML never matches what the client library initializes to. This produces a React hydration mismatch error that either causes a console warning (annoying but functional) or a full remount (loses other component state on the page).

react-beautiful-dnd is deprecated and known to have persistent SSR issues. dnd-kit has a documented workaround: SSR must be disabled for the DndContext wrapper component.

**Why it happens:**
Developers mark a component `'use client'` and assume that disables SSR. In Next.js App Router, `'use client'` marks the component as a client boundary but does NOT disable server-side rendering of that component — the server still renders it to HTML for the initial page load. The drag-and-drop library's provider initializes with server-incompatible state.

**How to avoid:**
Wrap DndContext (dnd-kit) in a `dynamic()` import with `{ ssr: false }`:
```tsx
// In the parent Server Component or page
const KanbanBoard = dynamic(() => import('./KanbanBoard'), { ssr: false })
```
The KanbanBoard component itself can still use `'use client'`. The `dynamic(..., { ssr: false })` prevents the server from rendering it at all, eliminating the hydration mismatch entirely.

Do NOT use react-beautiful-dnd — it is deprecated (last release 2023) and has unfixed SSR incompatibilities. Use dnd-kit exclusively.

**Warning signs:**
- Browser console shows "Hydration failed because the initial UI does not match what was rendered on the server"
- Kanban cards flash or disappear briefly on page load before re-rendering
- The drag handle is present in server HTML but positioned incorrectly until client hydrates

**Phase to address:** Claims Kanban phase — the `dynamic({ ssr: false })` wrapper must be the default pattern from the first card rendered. Do not add it later as a fix.

---

### Pitfall 2: Next.js Server Actions Have a 1MB Body Limit — Breaks Claims Document Upload

**What goes wrong:**
Claims documents (adjuster reports, loss notices, field photos, settlement letters) are PDF or image files. A single adjuster report PDF is commonly 2-10MB. If the file upload uses a Next.js Server Action to POST the file body, the request will fail with `Error: Body exceeded 1mb limit` for any file over 1MB — which includes most real-world documents.

The `serverActions.bodySizeLimit` config in `next.config.js` partially addresses this but has documented instability in production. Community reports confirm that it does not reliably apply in all environments.

**Why it happens:**
Next.js Server Actions were designed for form submissions (text, small payloads), not file uploads. The 1MB default limit is intentional for that use case. Developers reach for Server Actions because they are the Next.js 14 App Router pattern for form handling — and file upload looks like a form submission.

**How to avoid:**
Never route file uploads through Next.js Server Actions. Instead, use a two-step pattern:
1. Client calls a Next.js API route (`POST /api/claims/upload-url`) that uses the Supabase service-role client to generate a signed upload URL for the correct storage bucket path.
2. Client uploads the file directly to Supabase Storage using the signed URL, bypassing Next.js entirely.
3. After upload completes, client calls a Server Action or API route to record the file metadata (path, size, name, claim_id) in the `claim_documents` table.

This pattern keeps the large binary out of Next.js entirely. The 1MB limit never applies. Supabase Storage on the free tier allows files up to 50MB; on Pro, up to 500GB.

```typescript
// Step 1: Generate signed URL server-side
const { data } = await supabaseAdmin.storage
  .from('claims-documents')
  .createSignedUploadUrl(`${claimId}/${filename}`)

// Step 2: Client uploads directly to Supabase
await fetch(data.signedUrl, { method: 'PUT', body: file })
```

**Warning signs:**
- File uploads work in dev for small test files but fail silently for real PDFs
- Network tab shows a 413 or 500 response from `/api/...` when uploading files over 1MB
- Users report "upload failed" with no other error message

**Phase to address:** Claims document management phase — design the signed URL pattern from the start. Never let a file byte touch a Server Action.

---

### Pitfall 3: Supabase Storage RLS on Claims Bucket Silently Rejects Presigned Upload URLs

**What goes wrong:**
Even when a signed upload URL is generated server-side using the `service_role` key, the upload can fail with a 403 "new row violates row-level security policy" error. This is a documented Supabase issue: generating a signed URL bypasses auth for URL creation, but the actual upload still runs the bucket's INSERT RLS policy against the request context — which may not include the user's session.

**Why it happens:**
Supabase Storage RLS policies on INSERT run at upload time, not at URL creation time. If the INSERT policy requires `auth.uid() = owner_id` and the upload request arrives without a valid JWT (because the client used the signed URL directly), the policy evaluates `auth.uid()` as null and rejects the insert. This contradicts the expectation that a presigned URL grants upload permission without further auth.

**How to avoid:**
Choose one of two approaches and apply it consistently to the claims bucket:

Option A (recommended): Set the bucket INSERT policy to allow uploads where `auth.role() = 'service_role'` — but route ALL uploads through a Next.js API route that uses the admin client server-side. The file never goes directly from client to Supabase; it proxies through the API route. This adds latency but eliminates the RLS edge case. Acceptable for claims documents where upload frequency is low.

Option B (for larger files): Set the INSERT policy to allow uploads using `(storage.foldername(name))[1] = auth.uid()::text` — the path prefix acts as the authorization check. Generate the signed URL with the user's `auth.uid()` as the folder name, and include the user's access token in the upload request header. This is more complex but keeps uploads direct to Supabase.

**Warning signs:**
- Signed URL generation succeeds (returns a URL) but the actual PUT request returns 403
- Supabase logs show "new row violates row-level security policy" for storage.objects INSERT
- Upload works when tested with the service_role key directly but fails in the browser

**Phase to address:** Claims document management phase — test the full upload cycle (URL generation → client upload → metadata record) in the very first document upload plan. Do not assume presigned URLs bypass RLS.

---

### Pitfall 4: Cross-App HTTP from Next.js to Express Apps Has No Timeout in App Router Route Handlers

**What goes wrong:**
The FSA module needs CLU/field data from fsa-acres (port 3002), field names from farm-registry (port 3005), and enterprise/crop data from farm-budget (port 3001). When these calls are made from Next.js API routes using `fetch()`, Node.js's built-in `fetch` has no default timeout. If any Express app is slow (large data.json being read from disk) or not running, the Next.js route hangs indefinitely — the user sees a spinner that never resolves.

The fsa-acres Express app already implements this correctly: its cross-app fetch uses a 5-second timeout via AbortController (server.js line 80: `FETCH_TIMEOUT = 5000`). The glomalin-portal Next.js routes do not inherit this pattern — they must implement it explicitly.

**Why it happens:**
Developers test the portal with all Express apps running. The timeout problem never appears in development. In production (or when farm-budget is idle and needs to load its JSON), slow responses cause invisible hangs.

**How to avoid:**
Wrap every cross-app `fetch()` in an AbortController timeout. Create a shared utility in `glomalin-portal/src/lib/cross-app.ts`:

```typescript
export async function fetchWithTimeout(url: string, ms = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 0 } })
    return res
  } finally {
    clearTimeout(timer)
  }
}
```

Use `Promise.allSettled()` — not `Promise.all()` — when calling multiple source apps. If farm-budget is down, fsa-acres data should still load. Never let one unreachable Express app block the entire page.

Return structured errors identifying which source was unreachable, so the UI can show "farm-budget unavailable — showing partial data" rather than a blank page.

**Warning signs:**
- A portal page takes 30+ seconds to load and eventually returns a generic error
- Network tab shows a pending request to `/api/fsa/...` that never resolves
- No timeout is set on `fetch()` calls in any glomalin-portal API route

**Phase to address:** FSA workflow phase — the `fetchWithTimeout` utility must be created before the first cross-app call is written.

---

### Pitfall 5: Insurance Calculation Engine Produces Numbers Users Treat as Official — Scope Must Be Explicit

**What goes wrong:**
The coverage comparison matrix and payout scenario simulator will produce dollar amounts for RP, RP-HPE, YP, SCO, and ECO scenarios. Users will treat these numbers as authoritative. If the calculations are wrong — wrong APH, wrong coverage level applied to county yields for SCO/ECO, wrong RP "higher of spring or harvest price" logic — users may make real insurance decisions based on bad numbers. This is not a software bug; it is a liability exposure.

The critical distinction: SCO and ECO use county-level average yields (not farm APH), while RP/YP use farm-level APH. Confusing these in the calculation engine produces plausible-looking but wrong numbers for SCO/ECO scenarios.

**Why it happens:**
Insurance calculation formulas are well-documented in university extension resources but have edge cases:
- RP indemnity = max(0, (APH × CoverageLevel × SpringPrice) - (ActualYield × max(SpringPrice, HarvestPrice)))
- RP-HPE indemnity = max(0, (APH × CoverageLevel × SpringPrice) - (ActualYield × SpringPrice))
- SCO/ECO trigger on county yields, not farm yields — separate data source required
- SCO triggers between the underlying policy coverage level and 86%; ECO triggers between 86% and 95%
- ARC/PLC interactions with insurance premiums are intentionally out of scope (too complex)

Developers implementing these formulas from extension publications may miss the "higher of spring or harvest price" distinction between RP and RP-HPE, or apply farm APH to SCO/ECO scenarios.

**How to avoid:**
Label the tool explicitly as a "decision support simulator" — not a premium calculator and not a claim estimate. Add a prominent disclaimer on every output: "Calculations are illustrative only. Actual premiums and indemnities are determined by your crop insurance policy, USDA-RMA data, and your insurance agent."

Do not attempt to calculate actual premiums — premium calculation requires RMA actuarial data by county, crop, coverage level, and unit structure. This data is not available without an RMA API integration. Instead, allow users to enter their quoted premium per acre from their agent and use that as input.

Implement only RP and YP for the initial release. SCO/ECO require county-level yield data as a separate input, which cannot be pulled from farm systems. Defer SCO/ECO to a later phase or require manual county data entry.

Verify the RP formula against ISU Extension publication FM-1849 or Kansas State's crop insurance decision tools before shipping.

**Warning signs:**
- The simulator shows the same indemnity for RP and RP-HPE scenarios (the "higher of" logic is missing)
- SCO/ECO payout uses farm APH instead of county average yield
- Users ask "why does this match exactly what my agent quoted?" — it should not match exactly

**Phase to address:** Insurance decision tool phase — the accuracy scope (what is simulated vs. what requires the agent) must be defined before any formula is written.

---

### Pitfall 6: FSA-578 PDF Layout Cannot Be Reproduced Pixel-Perfect With @react-pdf/renderer

**What goes wrong:**
The FSA-578 is a government form with specific column widths, checkboxes in precise positions, multi-line text cells, and a specific columnar layout for CLU records. @react-pdf/renderer uses a flexbox-based layout model that does not map cleanly to fixed-position form fields. Attempting to replicate the exact FSA-578 government form visually will take 3-5x longer than expected and will still not produce a form that an FSA office would accept as an official submission (which requires the actual USDA-generated form).

**Why it happens:**
Developers see "PDF export" in the requirements and assume it means producing a replica of the official FSA-578 form that FSA offices accept. But FSA offices submit acreage reports through their own USDA systems (FSA-578 is generated by the FSA office, not the farmer). The farmer's obligation is to provide the data; the FSA office produces the official form.

**How to avoid:**
Build a "print-ready summary" — not an FSA-578 replica. The print output should contain all the data that would appear on an FSA-578 (farm number, tract, CLU, crop, acres, practice, planting dates) in a clean tabular format suitable for bringing to the FSA office appointment. Label it "FSA Acreage Reporting Summary — for FSA-578 preparation" — not "FSA-578."

This reframe eliminates the pixel-perfect positioning problem entirely. A clean table with the right columns is more useful to the farmer than a poorly-replicated government form that doesn't align correctly.

If a true FSA-578 PDF replica is required in a future phase, evaluate PDFKit (direct PDF coordinate system) over @react-pdf/renderer for fixed-position form layout.

**Warning signs:**
- Development time on PDF layout exceeds one full day
- The checkbox column is misaligned because @react-pdf/renderer doesn't support position:absolute
- The form breaks across pages at the wrong point because react-pdf's page break logic doesn't account for the FSA table's header

**Phase to address:** FSA export phase — reframe the deliverable as "FSA acreage summary" not "FSA-578 replica" before any PDF work begins.

---

### Pitfall 7: Supabase RLS on Cross-Table Queries Adds Compounding Overhead

**What goes wrong:**
The FSA module will have several related tables: `fsa_records` (CLU-level planting data), `insurance_policies`, `claims`, `claim_documents`. Queries that join these tables — for example, "get all claims for fields where crop = corn and coverage level > 70%" — run RLS checks against every row in every joined table. If the join table (`fsa_records`) has its own RLS policy, Postgres evaluates that policy for every row that the join touches, not just the rows that match the filter.

A query joining three tables can multiply RLS policy evaluations by 3x. With 500+ FSA records, 50 insurance policies, and 30 claims, this remains fast. But the query plan changes significantly if RLS policies use `IN (SELECT ...)` subqueries instead of indexed lookups.

**Why it happens:**
Developers write RLS policies that check access via subquery: `auth.uid() IN (SELECT user_id FROM module_access WHERE module = 'fsa-reporting')`. This pattern is documented by Supabase as a performance problem because the subquery executes for every row being evaluated. The existing `module_access` table structure in glomalin-portal uses exactly this pattern.

**How to avoid:**
Rewrite RLS policies to filter from the user perspective first, not the row perspective. Prefer:
```sql
-- Efficient: filter user's access first
user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM module_access
  WHERE user_id = auth.uid() AND module = 'fsa-reporting' AND granted = true
)
```

Alternatively, use a Postgres security-definer function that caches the module access check:
```sql
CREATE FUNCTION check_module_access(module_name text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM module_access
    WHERE user_id = auth.uid() AND module = module_name AND granted = true
  )
$$;
```

Index `module_access(user_id, module)` — this composite index is critical for RLS performance. The existing v5.0 Supabase schema should have this index; verify before adding FSA tables.

**Warning signs:**
- Loading the FSA dashboard takes 800ms+ even with few records
- EXPLAIN ANALYZE shows sequential scans on `module_access` during FSA queries
- Adding more FSA records linearly increases page load time (indicates RLS is not using indexes)

**Phase to address:** FSA database schema phase — verify RLS policy performance with EXPLAIN ANALYZE before adding any data.

---

### Pitfall 8: Heat Map for Coverage Matrix Uses SVG at Scale — Hits Performance Limit in the Browser

**What goes wrong:**
The crop insurance coverage comparison matrix is described as a "heat map" showing payout scenarios across coverage levels (70%-85%) and price scenarios. If this heat map is rendered with SVG (the default for most React chart libraries), and the matrix has more than ~500 cells (e.g., 16 coverage levels × 20 price scenarios × multiple crops), SVG rendering becomes slow and the browser's layout engine must recalculate the SVG DOM on every interaction.

More practically: if the heat map is built using a standard React charting library (Recharts, Victory) that uses SVG internally, adding interactivity (hover to see exact payout, click to drill down) will be sluggish at larger matrix sizes.

**Why it happens:**
SVG is the correct choice for small interactive charts. It becomes the wrong choice when the chart is a dense grid with many cells. Developers reach for familiar React chart libraries without checking the rendering backend.

**How to avoid:**
For the coverage matrix specifically, use an HTML table or CSS grid — not a chart library. Each cell is a colored div with the payout value. CSS `background-color` on a `<td>` achieves the heat map visual effect with zero SVG overhead. This is actually simpler to implement and faster to render than any SVG-based chart library.

For contour-style heat maps showing geographic coverage variation, use Canvas rendering. Libraries like react-heatmap-grid (table-based) handle this scenario well for a 20×20 matrix. WebGL-based libraries (SciChart.js) are only needed for 10,000+ data points, which this project will never reach.

The coverage matrix in fsa-acres/public/insurance.js is already implemented as an HTML table with computed styling. Port that pattern directly to React.

**Warning signs:**
- The heat map uses an SVG-based chart library (Recharts, Victory, D3.js with SVG) for a grid-style visualization
- Adding hover interactions causes the entire chart to re-render
- Performance degrades noticeably when showing 3+ crops simultaneously

**Phase to address:** Insurance decision tool phase — choose the CSS-grid/table approach before any charting library is installed.

---

### Pitfall 9: fsa-acres JSON Data Cannot Be Shared Directly With Supabase — Requires a Migration/Import Step

**What goes wrong:**
The existing fsa-acres module stores all data in `fsa-acres/data/data.json` — CLU records, insurance policies, GCS enrollments, farm settings, and pricing. The glomalin-portal v6.0 will store FSA/insurance/claims data in Supabase. These are two separate stores with no sync mechanism.

If the import step is skipped or deferred, the portal starts empty while the fsa-acres Express app has real 2026 data. Users will have to re-enter everything. Worse: if both systems are used in parallel (portal for new entries, Express app for existing data), the data splits across two stores with no reconciliation path.

**Why it happens:**
The migration/import is unglamorous, takes time to design (JSON schema → Supabase table schema mapping), and is easy to defer. Teams ship the portal UI first and plan to "add import later" — which never happens in practice.

**How to avoid:**
Build the import as the first task in the FSA phase, before any UI. The import reads `fsa-acres/data/data.json` and writes to Supabase. Include:
- CLU records → `fsa_records` table
- Insurance policies → `insurance_policies` table
- Run it once, log which records were imported, and disable the fsa-acres Express app for those data types

The import does not need to be a production-quality tool — a one-shot Node.js script that reads the JSON and uses the Supabase service-role client to insert is sufficient. Test it on the real data before the portal UI is built.

Verify the existing fsa-acres data structure: the server's in-memory store has `cluRecords`, `insurancePolicies`, `gcsEnrollments`, `farms`, `pricing` — these map directly to Supabase tables.

**Warning signs:**
- The FSA portal phase plan has no "migrate fsa-acres data" task
- The fsa-acres Express app is still being actively used after the portal is built
- Users manually re-enter data into the portal that already exists in fsa-acres

**Phase to address:** First task of FSA database schema phase — the import script must run and be verified before any portal UI is built.

---

### Pitfall 10: Tablet Responsive Layout Breaks When Sidebar + Card Grid + Detail Panel Are All Visible

**What goes wrong:**
The FSA workflow has three UI zones: a sidebar (field/farm selection), a card grid (CLU cards), and a detail panel (planting data editor). On desktop this is a three-column layout. On tablet (768px-1024px) all three cannot fit simultaneously. The typical mistake is hiding the sidebar on tablet, which forces users to navigate blind — they cannot see which farm they are editing while editing a CLU.

Claims Kanban has a similar problem: the pipeline columns (Potential → Filed → Adjuster → Paid → Denied) are too wide for tablet at 5 columns. A horizontal scroll Kanban is unusable on a touchscreen.

**Why it happens:**
Developers build on desktop and test on desktop. Tablet behavior is set with Tailwind breakpoints (`md:`, `lg:`) without actually testing on a physical tablet at arm's length in a farm office.

**How to avoid:**
Design the tablet breakpoint (768px-1024px) as a first-class layout — not a degraded desktop. Specific patterns:
- FSA card grid: on tablet, collapse to two columns. Detail panel opens as a full-screen slide-over (not a side panel). Farm selector stays visible as a top bar, not a sidebar.
- Claims Kanban: on tablet, show 2-3 columns with horizontal scroll disabled. Use a "swimlane" vertical layout grouped by status instead of horizontal columns, or show one status at a time with a status filter.
- Card touch targets: minimum 44px height for CLU cards. The existing fsa-acres has click-only interactions; the portal needs touch-friendly tap targets.

Test specifically on an iPad (1024×768) before shipping any FSA or Claims phase.

**Warning signs:**
- The layout has `hidden md:flex` on the sidebar but no replacement navigation for tablet
- Cards are 280px wide on a 768px screen (only 2.7 columns visible, cutting the third)
- The claims Kanban has 5 full-width columns that require horizontal scroll on iPad

**Phase to address:** Every UI phase — responsive tablet design must be verified in each phase, not added at the end.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use react-beautiful-dnd instead of dnd-kit | Familiar API for some developers | Deprecated library; persistent SSR hydration bugs in Next.js App Router; no active maintenance | Never — use dnd-kit only |
| Route file uploads through Server Actions | Simpler code (no signed URL step) | 1MB hard limit breaks most real claim documents; unreliable bodySizeLimit config | Never for files — always use signed URL pattern |
| Skip fsa-acres data migration, build portal on fresh Supabase | Faster to start UI | Users must re-enter 2026 data; parallel data stores split operational records | Never — migrate first |
| Replicate FSA-578 government form in react-pdf | Looks impressive in demo | 3-5x development time; form alignment is not achievable with react-pdf's flexbox model | Never — build summary report instead |
| Calculate actual crop insurance premiums | More complete tool | Requires RMA actuarial data by county; wrong numbers create liability | Never — allow users to enter quoted premiums |
| PUT all claims document bytes through a Next.js API route (no signed URL) | Simpler flow | Files >1MB fail; 50MB max Supabase limit means most real adjuster PDFs hit Next.js limit first | Acceptable only for proof-of-concept or files guaranteed <1MB |
| Build RLS policies with `IN (SELECT ...)` subquery pattern | Conceptually clear | Sequential scan on module_access for every row in every query; grows linearly with data | MVP acceptable if data is small; must fix before 1000+ FSA records |
| Implement SCO/ECO alongside RP/YP in first release | Feature-complete | SCO/ECO require county-level yield data not available in farm systems; likely to be wrong | Acceptable only if county yields are entered manually with clear labeling |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| fsa-acres Express (port 3002) | Calling `GET /api/clu-records` without timeout from Next.js | Always use `fetchWithTimeout(url, 5000)` — fsa-acres loads a potentially large data.json on each request |
| fsa-acres `_computed` fields on insurance policies | Treating `_computed.indemnity` as a stored value | `_computed` is derived at query time by the Express server's calc.js — it is not persisted. Supabase schema should compute this via database functions or client-side, not copy the `_computed` object. |
| farm-registry (port 3005) for field names | Calling farm-registry on every FSA card render | Cache field names from farm-registry in a Supabase table or React state at page load; do not call farm-registry on every individual card interaction |
| grain-tickets (port 3000) for actual yield | Calling grain-tickets from the portal without fallback | grain-tickets may not be running during insurance decision sessions; show "grain-ticket yield unavailable" and allow manual entry, do not block the workflow |
| Supabase storage signed upload URLs | Calling `createSignedUploadUrl` without checking bucket existence | Bucket must exist before URL generation; bucket creation is one-time setup but if not present, `createSignedUploadUrl` returns a confusing error |
| Supabase `module_access` table | Querying FSA tables without confirming module access RLS is on | The existing middleware checks module access via the `module_access` table, but Supabase RLS on the FSA data tables must separately enforce this — middleware protection and table-level RLS are both required |
| Next.js `revalidate` cache on cross-app reads | Using `fetch(url)` with default Next.js caching in App Router | Next.js App Router caches `fetch()` responses by default. Always use `next: { revalidate: 0 }` or `cache: 'no-store'` for live Express app data that changes outside the Next.js cache lifecycle |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Next.js App Router caches cross-app fetch responses | FSA data shows stale CLU records after edits in fsa-acres Express app | Add `{ next: { revalidate: 0 } }` to all cross-app fetch calls in Server Components | First time a user edits fsa-acres and reloads the portal page — stale data is invisible until noticed |
| Loading all 500+ CLU records on FSA dashboard without pagination | Dashboard takes 2-3 seconds to render card grid; filter interactions are slow | Load by farm or by tract; paginate or virtualize card list using react-window for grids above 100 cards | Noticeable at 200+ cards; severe at 500+ cards on tablet hardware |
| Fetching cross-app data sequentially in a Server Component (fsa-acres then farm-registry then farm-budget) | Page waits for each source in series — 3× slower than parallel | Use `Promise.allSettled()` to fan out all source fetches in parallel; typical response time drops from 3s to 1s | Every page load when multiple Express apps are involved |
| Re-rendering the entire Kanban board on every drag event | Drag interaction is choppy; cards visually stutter while dragging | Memoize static card content with `React.memo`; only re-render the dragged card and its target column | Noticeable with 20+ claims cards; severe with 50+ |
| Storing claim documents as base64 in Supabase database rows instead of Supabase Storage | Database row size inflates; queries slow down; storage quota exceeded | Always store files in Supabase Storage; store only the file path in the database table | First large document (>100KB) embedded in a database row |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Supabase `service_role` key to the client | Full RLS bypass — any user can read/write any data | service_role key must only be used in Next.js API routes (server-side); anon key for client-side Supabase client |
| FSA module API routes without module_access check | Any authenticated user can read FSA data even without fsa-reporting access | Every `/api/fsa/...` route must verify module access via Supabase server client before returning data — middleware protects pages but not API routes |
| Claims documents in a public Supabase Storage bucket | Adjuster reports, loss assessments, and financial documents are publicly accessible by URL | Claims bucket must be private; all document access must use signed read URLs with short expiry (1 hour) |
| Insurance policy data (coverage levels, premiums, indemnities) accessible to viewer role | Financial data leaked to farm employees who should only see operational data | Add a `data_sensitivity` column to module_access or create a separate `insurance_access` check; restrict insurance and claims data to admin and agronomist roles by default |
| Cross-app Express requests without origin validation | glomalin-portal can call any Express app on localhost; no CSRF-equivalent for server-to-server | Acceptable for single-machine deployment; if farm network is multi-machine, add shared-secret API key validation to Express apps |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bulk assignment of practices to CLUs (no confirmation step) | User accidentally marks all 200 CLU records as "corn" when selecting a template — no undo | Show a preview diff ("This will update 47 CLU records — proceed?") before any bulk action commits |
| Year-over-year comparison puts 2025 and 2026 data in side-by-side columns without visual grouping | User cannot tell which column is current year when scrolling the card grid | Use background color tinting or a sticky header that always shows the year labels regardless of scroll position |
| Insurance payout scenarios show only dollar totals without per-acre context | Farm manager cannot evaluate if a $40,000 indemnity is good or bad without knowing it is across 2,000 acres ($20/ac) | Always show both total dollar and per-acre amounts; farmers think in per-acre terms |
| Claims Kanban provides no deadline visibility on cards | Adjuster deadline passes unnoticed because the card shows only the claim number and status | Show deadline date on every card; highlight in amber if within 7 days, red if past due — deadlines are the most critical piece of claims management |
| Card-based FSA workflow allows saving incomplete records (missing crop, missing planting date) | FSA office rejects the report because required fields are blank | Validate before save: crop and planting date are required for a "reported" CLU; unreported CLUs can be saved incomplete but not submitted |
| Document upload shows only "uploading..." with no progress | Users with slow connections upload large PDFs and cannot tell if it is working or stalled | Show upload progress percentage using XMLHttpRequest (fetch does not support upload progress); show file size and estimated time |

---

## "Looks Done But Isn't" Checklist

- [ ] **Drag-and-drop SSR disabled:** Kanban board component is wrapped in `dynamic({ ssr: false })`; no hydration mismatch warnings in browser console; drag works without page flash.
- [ ] **File upload bypasses Server Actions:** Network tab shows file bytes going directly from client to Supabase storage URL (not to `/api/...`); 10MB PDF uploads successfully.
- [ ] **fsa-acres data imported:** Supabase `fsa_records` table has the same record count as `store.cluRecords` in `fsa-acres/data/data.json`; insurance policies match.
- [ ] **Timeout on cross-app fetch:** With farm-budget stopped, the FSA dashboard loads (with a "farm-budget unavailable" notice) within 6 seconds — not a 30-second hang.
- [ ] **Next.js fetch cache disabled:** After editing a CLU record in fsa-acres Express, reloading the glomalin-portal FSA page shows the updated data (not the cached version).
- [ ] **Claims documents in private bucket:** A claim document's storage URL returns 400 when accessed without a signed URL; signed URLs expire after 1 hour.
- [ ] **Insurance tool disclaimer visible:** The payout simulator shows "Illustrative only — not a premium calculator" prominently before displaying any dollar amounts.
- [ ] **FSA-578 export is a summary, not a replica:** The PDF is labeled "FSA Acreage Reporting Summary" and does not claim to be an FSA-578 form.
- [ ] **Tablet layout tested:** The FSA card grid and claims Kanban are usable on 1024×768 viewport without horizontal scrolling.
- [ ] **RLS on FSA API routes:** Calling `/api/fsa/records` with a user token for a user without fsa-reporting module access returns 403 — not 200 with data.
- [ ] **Bulk action confirmation:** Selecting all CLU records and applying a crop template shows a "47 records will be updated — confirm" dialog before any writes.
- [ ] **Claims deadline highlighting:** A claim with a deadline 3 days from now shows the deadline in amber on the Kanban card.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hydration mismatch breaks Kanban (react-beautiful-dnd) | MEDIUM | Swap to dnd-kit; wrap in `dynamic({ ssr: false })`; re-implement drag handlers using dnd-kit API (different but similar concepts) |
| File uploads fail for all real claim documents (>1MB) | MEDIUM | Switch to signed URL pattern; update client upload logic; test with 10MB PDF before re-deployment |
| fsa-acres data not migrated — portal launched empty | HIGH | Write and run migration script against existing data.json; validate record counts; notify users that historical data is now available |
| Wrong insurance formula (RP vs RP-HPE confused) | HIGH | Correct the formula; identify all sessions where users viewed wrong calculations; add audit log to track when simulator was viewed and what inputs were used; notify affected users |
| Claims documents in public bucket — data exposed | HIGH | Move bucket to private; regenerate signed read URLs for all existing documents; audit access logs for unauthorized reads; notify if sensitive documents were accessed |
| RLS missing on FSA API routes — data accessible to wrong users | HIGH | Add server-side module_access check to all FSA routes; audit which users accessed which records during the exposure window |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Drag-and-drop SSR hydration | Claims Kanban phase (first card rendered) | No hydration warnings in console; drag works on first page load |
| Server Actions 1MB file upload limit | Claims document management phase (first upload plan) | 10MB PDF uploads successfully via signed URL |
| Supabase Storage RLS on signed URLs | Claims document management phase | Upload from browser using signed URL returns 200; without session token returns 403 |
| Cross-app fetch timeout | FSA workflow phase (first cross-app call) | With fsa-acres stopped, portal loads within 6s with "source unavailable" notice |
| Insurance calculation scope | Insurance decision tool phase (before formula is written) | Disclaimer present on all simulator outputs; no attempt to calculate official premiums |
| FSA-578 PDF replica scope | FSA export phase (before any PDF work) | Deliverable is labeled "summary" not "FSA-578"; no pixel-level form replication |
| Supabase RLS compounding overhead | FSA database schema phase | EXPLAIN ANALYZE on FSA queries shows index scans (not seq scans) on module_access |
| Heat map SVG performance | Insurance decision tool phase (before charting library selected) | Coverage matrix uses CSS grid/table cells, not SVG; renders instantly with 300+ cells |
| fsa-acres data migration | FSA database schema phase (first task) | Supabase CLU record count matches fsa-acres data.json before any UI is built |
| Tablet responsive layout | Every UI phase | Each phase verified on 1024×768 viewport before marked complete |
| Next.js fetch caching of cross-app data | FSA workflow phase (first Server Component with cross-app fetch) | `revalidate: 0` present on all cross-app fetch calls; stale data test passes |

---

## Sources

- Codebase analysis — `fsa-acres/server.js` lines 76-80: `FETCH_CACHE_TTL`, `FETCH_TIMEOUT = 5000`, AbortController pattern already implemented in Express — ported to glomalin-portal as well. HIGH confidence.
- Codebase analysis — `fsa-acres/public/insurance.js`: insurance policy calculation, `_computed` pattern, grain ticket bridge — confirms what must be ported to Supabase. HIGH confidence.
- Codebase analysis — `glomalin-portal/src/middleware.ts`: module access checked at route level; confirmed RLS must also be enforced at API route level independently. HIGH confidence.
- Codebase analysis — `glomalin-portal/package.json`: `@xyflow/react` already installed (React Flow); dnd-kit and PDF libraries not yet installed. HIGH confidence.
- Next.js official docs — [React Hydration Error](https://nextjs.org/docs/messages/react-hydration-error): confirms server/client HTML mismatch causes. HIGH confidence.
- dnd-kit GitHub issue #285 — [Warning with Next.js 10.2.0 and SSR](https://github.com/clauderic/dnd-kit/issues/285): confirms SSR hydration problem with DndContext; `dynamic({ ssr: false })` is the documented fix. HIGH confidence.
- Next.js GitHub Discussion #57973 — [Size Limitation for Server Actions in Next.js 14](https://github.com/vercel/next.js/discussions/57973): confirms 1MB body limit for Server Actions; `bodySizeLimit` config is unreliable in production. HIGH confidence.
- Supabase Docs — [File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits): 50MB free tier limit; 500GB Pro. HIGH confidence.
- Supabase GitHub issue — [New row violates row-level security policy with presigned upload URLs](https://github.com/supabase/storage-js/issues/186): documents the signed URL + RLS conflict; service_role workarounds described. HIGH confidence.
- Supabase Docs — [RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv): `IN (SELECT ...)` subquery pattern documented as performance problem; index requirements for RLS. HIGH confidence.
- ISU Extension — [ECO and SCO coverage](https://www.extension.iastate.edu/agdm/crops/html/a1-44.html): SCO/ECO use county-level yields not farm APH; triggers between 86% and 95%. MEDIUM confidence (domain source, not code).
- AgManager.info — [2025 SCO and ECO Payment Calculator](https://agmanager.info/crop-insurance/crop-insurance-papers-and-information/2025-supplemental-coverage-option-sco-and): "Calculations are for example only. Actual crop insurance calculations will vary." — justification for simulator-not-calculator scope. MEDIUM confidence.
- Visual Heatmap / canvas-heatmap GitHub — WebGL/Canvas required for 500K+ data points; table/CSS approach sufficient for the coverage matrix use case. MEDIUM confidence.
- USDA FSA — [FSA-578 Manual 2025](https://www.fsa.usda.gov/sites/default/files/2025-03/FSA-578.pdf): confirmed form structure; FSA generates the official form, not the farmer. HIGH confidence.

---
*Pitfalls research for: v6.0 FSA Acres, Insurance & Claims — Next.js 14 + Supabase*
*Researched: 2026-03-04*
