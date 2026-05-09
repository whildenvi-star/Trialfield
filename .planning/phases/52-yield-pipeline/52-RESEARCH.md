# Phase 52: Yield Pipeline - Research

**Researched:** 2026-05-08
**Domain:** Cross-app yield data pipeline — Express → Next.js 14 App Router + Supabase + vanilla JS farm-budget
**Confidence:** HIGH (phase fully implemented and verified; research is retrospective, grounded in actual committed code)

> **NOTE: This is retrospective research.** Phase 52 was fully implemented on 2026-03-25 and verified PASSED (4/4 success criteria). All three plans — 52-01, 52-02, 52-03 — are complete. This RESEARCH.md documents what was actually built so that future phases building on this pipeline have an accurate foundation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Yield computation logic**
- Granularity: per field per crop (using registry_field_id + canonical crop ID)
- Bushel conversion: USDA standard test weights per crop (wheat=60, corn=56, etc.)
- Weight basis: net pounds after buyer deductions (moisture/dockage), not gross scale weight
- Finality: always live — no manual "finalize" step. Yield updates continuously as tickets are added/edited

**Sync trigger & timing**
- Trigger: on every ticket save/edit/delete — yield summary recomputes immediately
- Push direction: grain-tickets pushes yield summaries via API to both portal (insurance) and farm-budget
- No manual "resync all" button — auto-sync on each ticket save is sufficient
- No debounce — immediate recompute on every save

**Sync status display**
- Insurance view: inline badge next to the actual yield value (green "GT" or checkmark), timestamp on hover showing "Synced from grain tickets"
- Budget dashboard: actual yield replaces the budgeted estimate once yield data arrives. Show variance (e.g., "Actual 42 bu/ac vs Budget 45 bu/ac")
- Empty state: muted dash "—" in the yield column with tooltip "No grain tickets recorded for this field/crop yet"

**Mismatch handling**
- Field matching: registry_field_id only — tickets without a registry_field_id are excluded from yield computation with a warning
- Crop matching: canonical crop ID from Phase 50 — both apps already have these IDs
- Unmatched policies: if a field+crop has yield data but no insurance policy, flag it as "no insurance policy found" (still compute and store the yield, just skip the insurance push)
- Acre denominator for bu/ac: use insurance policy acres when pushing to insurance (the number that matters for yield comparison)

### Claude's Discretion
- Push failure/retry strategy when portal or farm-budget API is unreachable
- Staleness warning design (whether to show amber warning or just timestamp)
- Empty state presentation details beyond the muted dash pattern
- Internal yield summary storage schema in grain-tickets

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | Auto yield summary per farm/crop after ticket save | `computeYieldSummaries()` + `pushYieldUpdates()` in grain-tickets/server.js — IMPLEMENTED |
| PIPE-02 | Yield push to portal insurance policies with synced flag | POST /api/insurance/yield-push, planted_acres denominator, registry ID matching — IMPLEMENTED |
| PIPE-03 | Farm-budget dashboard shows grain-ticket actuals without manual entry | `fetchGrainYields()` + variance display overlay in dashboard.js — IMPLEMENTED |
| PIPE-04 | Visual indicator in both UIs; "No yield data yet" when unsynced | GT badge + timestamp in insurance; variance + "(no GT data)" in budget — IMPLEMENTED |
</phase_requirements>

---

## Summary

Phase 52 implements a push-based, fire-and-forget yield pipeline where grain-tickets computes per-field per-crop yield summaries on every ticket save and immediately pushes them to two consumers: the glomalin-portal insurance module and the farm-budget dashboard. The pipeline uses canonical registry IDs (from Phases 49 and 50) as the join key — `Farm.registryId` on the grain-tickets side matches `registry_field_id` on the insurance_policies side, and `Ticket.registryCropId` matches `registry_crop_id`.

The architecture is simple and deliberate: no message queue, no Redis, no scheduled jobs. The yield recompute is a synchronous Prisma query grouped in memory, the push is fire-and-forget with `Promise.allSettled` and `AbortSignal.timeout(5000)`, and the farm-budget consumer holds the last push in a module-level in-memory variable (`_grainYields`). This is appropriate for a 527-ticket dataset on a farm-scale operation — the full recompute runs well under 100ms.

The insurance_policies table gained four columns via `migrate-52.ts`: `registry_field_id`, `registry_crop_id`, `yield_synced_at`, and `actual_synced_from_grain`. The portal's yield-push endpoint uses these for matching and tracks the sync provenance. UI indicators in both applications follow the project's dark soil aesthetic and CSS-only tooltip patterns.

**Primary recommendation:** Future phases that extend yield data flow (APH computation, marketing position, settlement reconciliation) must read from the existing `GET /api/yield-summaries` endpoint or the `insurance_policies` columns — do NOT re-implement yield computation logic. The yield engine is the single source of truth in grain-tickets.

---

## Standard Stack

### Core

| Library/Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Node.js native `fetch` | Built-in (Node 18+) | Cross-app HTTP push | No extra dep; grain-tickets server uses this pattern throughout |
| `AbortSignal.timeout(5000)` | Node 18+ built-in | 5-second timeout on all cross-app calls | Platform-standard pattern: consistent with existing cross-app fetch in portal |
| `Promise.allSettled` | ES2020 built-in | Parallel push to portal + farm-budget without short-circuit | Allows independent push failures; established project pattern |
| Prisma (grain-tickets) | Existing project version | Ticket + Farm queries for yield computation | Already the ORM for grain-tickets |
| `@supabase/supabase-js` `createClient` with service_role | Existing project version | Service-role writes in yield-push route (bypasses RLS) | Machine-to-machine writes need service_role; established in other portal API routes |

### Supporting

| Library/Tool | Version | Purpose | When to Use |
|---|---|---|---|
| `computeClaimAlert()` from `@/lib/insurance/calc` | Project internal | Recompute claim alert after actual yield updated | Called inside yield-push route after updating `actual` field — keeps claim_alert consistent |
| USDA_TEST_WEIGHTS in `calc.js` | N/A (constants) | Standard lb/bu for bushel conversion fallback | Used by computeYieldSummaries when per-farm CropConfig data is unavailable |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| In-memory `_grainYields` in farm-budget | PostgreSQL or Supabase yield table | Persistence across restarts; not needed for small ops — in-memory is simpler |
| Fire-and-forget push | pg-boss background job queue | Guaranteed delivery with retry; overkill for this scale, adds complexity |
| Synchronous recompute on every save | Incremental delta update | Simpler correctness model — always recompute all = no stale aggregates from missed events |

**Installation:** No new packages installed in Phase 52. All dependencies were pre-existing.

---

## Architecture Patterns

### Recommended Project Structure

```
grain-tickets/
├── server.js                         # computeYieldSummaries(), pushYieldUpdates(), GET /api/yield-summaries
├── public/calc.js                    # USDA_TEST_WEIGHTS constant, computeTicket() (reused by yield engine)
└── .env.example                      # PORTAL_ORIGIN, BUDGET_API_URL, EMBED_TOKEN

glomalin-portal/
├── src/app/api/insurance/yield-push/
│   └── route.ts                      # POST endpoint — receives bulk yield summaries, updates insurance_policies
├── src/components/insurance/
│   └── insurance-workspace.tsx       # GT badge, yield_synced_at tooltip, "No yield data yet" empty state
└── scripts/migrate-52.ts             # ALTER TABLE insurance_policies — adds registry columns

farm-budget/
├── server.js                         # POST/GET /api/yield-from-grain — in-memory yield cache
└── public/dashboard.js               # fetchGrainYields(), findGrainYieldForCrop(), variance overlay
```

### Pattern 1: Fire-and-Forget Yield Push After HTTP Response

**What:** Call `pushYieldUpdates()` after `res.json()` is sent — the push never delays the ticket save response.

**When to use:** Any time a grain-ticket mutation occurs (POST, PUT, DELETE). Also the template for future cross-app notifications.

**Example:**
```javascript
// grain-tickets/server.js — POST /api/tickets (lines 720-724 approx)
const ticket = await prisma.ticket.create({ data: newTicket });
res.json({ ok: true, ticket });
// Fire-and-forget AFTER response — push failures never block the caller
pushYieldUpdates(cropYear).catch(err => console.error('pushYieldUpdates (POST) error:', err));
```

### Pattern 2: Parallel Independent Push with Promise.allSettled

**What:** Push to portal and farm-budget in parallel; both succeed or fail independently without blocking each other.

**When to use:** Any multi-consumer push scenario where one consumer's failure must not prevent the other from receiving data.

**Example:**
```javascript
// grain-tickets/server.js pushYieldUpdates()
const [portalResult, budgetResult] = await Promise.allSettled([
  fetch(portalUrl + '/api/insurance/yield-push', {
    method: 'POST', headers, body: payload,
    signal: AbortSignal.timeout(5000)
  }).then(r => r.ok ? `ok (${r.status})` : `http-${r.status}`),
  fetch(budgetUrl + '/api/yield-from-grain', {
    method: 'POST', headers, body: payload,
    signal: AbortSignal.timeout(5000)
  }).then(r => r.ok ? `ok (${r.status})` : `http-${r.status}`)
]);
```

### Pattern 3: Ecosystem Token for Server-to-Server Auth

**What:** Machine-to-machine API calls use `x-ecosystem-token` header matching `EMBED_TOKEN` env var. No user session involved.

**When to use:** Any server-to-server push where the caller is another platform app (not a user browser). Established in yield-push route and farm-budget receiver.

**Example:**
```typescript
// glomalin-portal/src/app/api/insurance/yield-push/route.ts
const token = request.headers.get('x-ecosystem-token')
const expected = process.env.EMBED_TOKEN
if (!expected || token !== expected) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Pattern 4: Registry ID Composite Key for Cross-App Joins

**What:** `registryFieldId::registryCropId` composite key (string concatenation) used for grouping in memory within grain-tickets. In Supabase, the join is two separate `.eq()` conditions.

**When to use:** Any cross-app data join involving field + crop combination. The composite index on `(registry_field_id, registry_crop_id)` on `insurance_policies` makes these queries fast.

**Example:**
```javascript
// grain-tickets/server.js computeYieldSummaries()
const key = `${farm.registryId}::${t.registryCropId}`;
if (!groups[key]) {
  groups[key] = { registryFieldId: farm.registryId, registryCropId: t.registryCropId, ... };
}
```

### Pattern 5: Crop-Name Matching in farm-budget (No Registry IDs at Render Time)

**What:** farm-budget dashboard.js `cropRows` are crop-level aggregates keyed by crop name string — no `registryCropId` is available in the render loop. The grain yield overlay uses `findGrainYieldForCrop(cropName)` which matches by lowercase crop name string.

**When to use:** When building on the farm-budget dashboard — do NOT expect registry IDs to be available in client-side render data. Name matching is the practical join key there.

**When it breaks:** If a crop name in grain-tickets doesn't exactly match the crop name in farm-budget cropRows. Currently handled by lowercase normalization. Future phases that want strict registry-ID matching in farm-budget would need to propagate `registryCropId` into the cropRows aggregation API response.

### Pattern 6: Insurance Policy Columns for Yield Sync State

**What:** Four columns on `insurance_policies` track yield sync provenance: `registry_field_id` (join key), `registry_crop_id` (join key), `yield_synced_at` (timestamp), `actual_synced_from_grain` (boolean flag).

**When to use:** Any UI that needs to distinguish "this actual came from grain tickets" vs "this actual was manually entered". The flag is set to `true` ONLY by the yield-push route — manual edits via the insurance form do not set it.

### Anti-Patterns to Avoid

- **Awaiting pushYieldUpdates before responding:** Adding `await` before the push call will add 1-5 seconds to every ticket save. The fire-and-forget pattern is intentional.
- **Re-implementing yield computation in another app:** The yield engine in `grain-tickets/server.js` is the single source of truth. Call `GET /api/yield-summaries` instead.
- **Using grain-tickets Farm.acres as insurance denominator:** The insurance yield comparison must use `planted_acres` from the insurance policy, not grain-tickets farm acres. These numbers differ.
- **Crop-name matching in portal (Supabase) context:** In the portal, always join on `registry_crop_id` — name matching is only acceptable in the farm-budget vanilla JS context where registry IDs are absent.
- **Making the farm-budget GET /api/yield-from-grain authenticated:** Grain yield aggregates are not sensitive. Auth here would break the iframe context where there's no token propagation mechanism.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Bushel conversion | Custom lb/bu lookup table | `USDA_TEST_WEIGHTS` in `grain-tickets/public/calc.js` + `Calc.computeTicket()` | Already handles moisture/fm deductions; the canonical per-crop constants are defined once |
| Claim alert recompute after yield update | Custom threshold logic | `computeClaimAlert()` from `@/lib/insurance/calc` | Single source for the guarantee × coverage_level × actual formula |
| Supabase writes that bypass RLS | Workarounds or user-session client | `createClient(url, serviceKey)` with service_role key | Machine-to-machine writes need service_role; RLS blocks anon/user-session keys for bulk updates |
| Cross-app timeout enforcement | setTimeout + manual cleanup | `AbortSignal.timeout(5000)` | Native, clean, already the platform standard |

**Key insight:** The yield computation and push pipeline was designed to be extended, not replaced. Any future APH, marketing, or settlement phase that needs yield data should read from the pipeline's outputs, not recompute independently.

---

## Common Pitfalls

### Pitfall 1: Missing EMBED_TOKEN Skips All Pushes Silently

**What goes wrong:** `pushYieldUpdates()` logs a warning and returns early if `EMBED_TOKEN` is not set. No error thrown, no push happens.

**Why it happens:** The env var check is intentional (prevents unauthenticated pushes in misconfigured envs), but it's easy to miss in dev.

**How to avoid:** Always set `EMBED_TOKEN` in grain-tickets `.env`. The `.env.example` documents it. Verify with: `grep EMBED_TOKEN grain-tickets/.env`.

**Warning signs:** `pushYieldUpdates: EMBED_TOKEN not set — skipping push` in grain-tickets console after a ticket save.

### Pitfall 2: Tickets Excluded from Yield Because Farm Has No registryId

**What goes wrong:** A farm in grain-tickets has no `registryId` set — all its tickets are excluded from yield computation with a warning logged.

**Why it happens:** The farm was created before Phase 49 canonical field IDs were backfilled, or the sync-registry script was never run for that farm.

**How to avoid:** Run the grain-tickets registry sync (`POST /api/farms/sync-registry`) and verify `Farm.registryId` is populated for all active farms. Check: `grep "has no registryId" <grain-tickets-console-output>`.

**Warning signs:** `Yield pipeline: tickets excluded — farm "X" has no registryId` in the console. The `excludedTickets.noFieldId` count in the `/api/yield-summaries` response will be non-zero.

### Pitfall 3: Insurance Policies Not Updated Because registry_field_id / registry_crop_id Columns Are Null

**What goes wrong:** The yield-push route matches on `registry_field_id` and `registry_crop_id` columns on `insurance_policies`. If `migrate-52.ts` was never run, those columns don't exist and the query fails.

**Why it happens:** The migration is a manual step documented in the 52-01-SUMMARY.md "User Setup Required" section. It's easy to overlook in production deployment.

**How to avoid:** Run `cd glomalin-portal && npx tsx scripts/migrate-52.ts` after deploy. The script is idempotent (`IF NOT EXISTS`).

**Warning signs:** `yield-push` route returns 500 or Supabase reports column not found errors.

### Pitfall 4: Yield Push Succeeds but Insurance Policies Show No Update

**What goes wrong:** Push returns `{ matched: 0, skipped: N }` — all summaries are skipped because no insurance_policies rows match the field+crop+year combination.

**Why it happens:** The `registry_field_id` and `registry_crop_id` columns on `insurance_policies` have not been populated. The columns exist after migration, but existing rows still have NULL values. These must be populated either through the insurance UI or a backfill.

**How to avoid:** When creating or editing an insurance policy in the portal, populate `registry_field_id` and `registry_crop_id`. A backfill script may be needed for existing policies.

**Warning signs:** Yield-push route returns `matched: 0, skipped: N` where N equals the number of summaries.

### Pitfall 5: farm-budget Yield Data Lost on Server Restart

**What goes wrong:** `_grainYields` is a module-level in-memory variable in farm-budget `server.js`. On restart, it resets to `null`. The dashboard shows "(no GT data)" for all crops until the next ticket save triggers a push.

**Why it happens:** Intentional design choice — in-memory is sufficient for this scale and avoids a persistence dependency.

**How to avoid:** Acceptable in production because the next ticket save triggers a repush. If restarts need to pre-populate, consider adding a startup fetch from grain-tickets `/api/yield-summaries` on farm-budget boot.

**Warning signs:** After a farm-budget restart, dashboard shows "(no GT data)" for all crops until a ticket is saved.

---

## Code Examples

Verified patterns from actual committed code:

### Yield Computation Engine (grain-tickets/server.js)
```javascript
// Source: grain-tickets/server.js — computeYieldSummaries()
async function computeYieldSummaries(cropYear) {
  const year = cropYear || new Date().getFullYear();
  const dbTickets = await prisma.ticket.findMany({
    where: { cropYear: year },
    select: { id:true, farm:true, netWeight:true, moisture:true, fm:true,
              crop:true, registryCropId:true, cropYear:true }
  });
  const dbFarms = await prisma.farm.findMany({
    select: { id:true, name:true, registryId:true, acres:true }
  });
  const farmByName = {};
  dbFarms.forEach(f => { farmByName[(f.name||'').trim().toLowerCase()] = f; });
  const cropConfig = await buildCropConfigObject(year);
  const groups = {};
  dbTickets.forEach(t => {
    const farm = farmByName[(t.farm||'').trim().toLowerCase()];
    if (!farm || !farm.registryId) { /* warn + skip */ return; }
    if (!t.registryCropId) { /* warn + skip */ return; }
    const key = `${farm.registryId}::${t.registryCropId}`;
    if (!groups[key]) groups[key] = { ...defaults };
    groups[key].totalNetLbs += t.netWeight;
    const computed = Calc.computeTicket({ crop:t.crop, netWeight:t.netWeight,
                                          moisture:t.moisture, fm:t.fm }, cropConfig);
    groups[key].totalNetBU += computed.netBU || 0;
    groups[key].ticketCount++;
  });
  return { summaries: Object.values(groups).map(g => ({...g, yieldPerAcre: g.acres>0 ? totalNetBU/g.acres : 0})),
           excludedTickets: { noFieldId: ..., noCropId: ... } };
}
```

### Insurance Yield-Push Receiver (glomalin-portal/src/app/api/insurance/yield-push/route.ts)
```typescript
// Source: glomalin-portal/src/app/api/insurance/yield-push/route.ts
// Key section: planted_acres as denominator (not grain-tickets Farm.acres)
for (const policy of policies) {
  const plantedAcres = policy.planted_acres ?? 0
  const yieldPerAcre = plantedAcres > 0 ? totalNetBU / plantedAcres : 0
  const claimAlert = computeClaimAlert({
    guarantee: policy.guarantee ?? 0,
    actual: yieldPerAcre,
    coverage_level: policy.coverage_level ?? 75,
  })
  await supabase.from('insurance_policies').update({
    actual: yieldPerAcre,
    actual_synced_from_grain: true,
    yield_synced_at: new Date().toISOString(),
    claim_alert: claimAlert,
  }).eq('id', policy.id)
}
```

### GT Badge in Insurance UI (insurance-workspace.tsx)
```tsx
// Source: glomalin-portal/src/components/insurance/insurance-workspace.tsx lines 407-432
{policy.actual_synced_from_grain ? (
  <span className="relative group">
    <span className="bg-green-800/50 text-green-300 text-xs px-1.5 py-0.5 rounded cursor-default">GT</span>
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                     bg-glomalin-surface border border-glomalin-border text-glomalin-text text-xs
                     rounded px-2 py-1 whitespace-nowrap z-10">
      Synced from grain tickets
      {policy.yield_synced_at && (
        <span className="block text-glomalin-muted">
          {new Date(policy.yield_synced_at).toLocaleString('en-US', { ... })}
        </span>
      )}
    </span>
  </span>
) : (
  <span className="text-glomalin-muted" title="No yield data yet">—</span>
)}
```

### In-Memory Yield Cache in farm-budget (server.js + dashboard.js)
```javascript
// Source: farm-budget/server.js
let _grainYields = { data: null, updatedAt: null };

app.post('/api/yield-from-grain', (req, res) => {
  const { summaries, cropYear } = req.body;
  const yieldMap = {};
  summaries.forEach(s => { yieldMap[`${s.registryFieldId}|${s.registryCropId}`] = s; });
  _grainYields = { data: yieldMap, updatedAt: new Date().toISOString() };
  res.json({ ok: true, count: summaries.length });
});

// Source: farm-budget/public/dashboard.js — crop-name matching (no registry IDs available)
function findGrainYieldForCrop(cropName) {
  if (!grainYields) return null;
  const name = (cropName || '').toLowerCase().trim();
  return Object.values(grainYields).find(y => (y.cropName||'').toLowerCase().trim() === name) || null;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Manual yield entry in insurance portal | Auto-sync from grain-tickets on every ticket save | Phase 52 (2026-03-25) | Eliminates triple manual entry |
| insurance_policies has no registry linkage columns | registry_field_id, registry_crop_id, yield_synced_at, actual_synced_from_grain columns | migrate-52.ts | Enables automated yield matching |
| Farm-budget dashboard shows only budgeted yield | Grain-ticket actuals overlaid with variance display | Phase 52 (2026-03-25) | Budget vs actual visible without data re-entry |

**Platform patterns established by this phase:**
- `x-ecosystem-token` header (matching `EMBED_TOKEN`) is the standard for server-to-server pushes between platform apps
- Fire-and-forget `res.json(...); asyncFn().catch(...)` is the standard for cross-app notifications triggered by user mutations
- `Promise.allSettled` with `AbortSignal.timeout(5000)` is the standard for parallel multi-consumer pushes

---

## Open Questions

1. **farm-budget in-memory yield loss on restart**
   - What we know: `_grainYields` resets on farm-budget restart; next ticket save repopulates it
   - What's unclear: Whether this is acceptable in prod or whether a startup fetch from grain-tickets is needed
   - Recommendation: Acceptable for current usage. If zero-downtime yield display is required after restarts, add a startup `GET /api/yield-summaries` call in farm-budget `server.js` to pre-populate `_grainYields`.

2. **APH computation dependency on yield pipeline**
   - What we know: Phase 56 (APH) reads from `insurance_policies.actual` which is now auto-populated by the yield pipeline
   - What's unclear: Whether APH records correctly reflect the planted_acres denominator difference (insurance planted_acres vs grain-tickets Farm.acres) for historical year APH computation
   - Recommendation: When building APH for prior years, always use `insurance_policies.actual` (already using planted_acres denominator) rather than calling `computeYieldSummaries()` directly.

3. **Crop-name matching drift in farm-budget dashboard**
   - What we know: `findGrainYieldForCrop()` does lowercase string match on crop name — works today
   - What's unclear: If crop naming diverges between grain-tickets and farm-budget crop name strings, matches will silently fail
   - Recommendation: Future phases extending farm-budget should propagate `registryCropId` into cropRows API response to enable registry-ID matching instead of name matching.

---

## Sources

### Primary (HIGH confidence)
- `grain-tickets/server.js` (committed 2026-03-25, commits 2e4c953 and c85ee4a) — computeYieldSummaries, pushYieldUpdates, GET /api/yield-summaries
- `glomalin-portal/src/app/api/insurance/yield-push/route.ts` (committed 2026-03-25, commit c85ee4a) — POST receiver, planted_acres denominator, ecosystem token auth
- `farm-budget/server.js` (committed 2026-03-25) — POST/GET /api/yield-from-grain, in-memory cache
- `farm-budget/public/dashboard.js` (committed 2026-03-25) — fetchGrainYields, findGrainYieldForCrop, variance display
- `glomalin-portal/src/components/insurance/insurance-workspace.tsx` (committed 2026-03-25) — GT badge, yield_synced_at, "No yield data yet" empty state
- `glomalin-portal/scripts/migrate-52.ts` (committed 2026-03-25) — registry columns migration
- `.planning/phases/52-yield-pipeline/52-VERIFICATION.md` (verified 2026-03-25) — 4/4 success criteria confirmed

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 52 decisions section (key-decisions captured from plan execution)
- `.planning/phases/52-yield-pipeline/52-01-SUMMARY.md`, `52-02-SUMMARY.md`, `52-03-SUMMARY.md` — plan execution records

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code is committed and verified in production
- Architecture: HIGH — patterns directly from implemented code, no speculation
- Pitfalls: HIGH — identified from actual failure modes documented in verification gaps (SC-4 gap caught and closed in 52-03)

**Research date:** 2026-05-08
**Valid until:** Stable — this reflects completed, verified implementation. Valid until the yield pipeline is extended in a future phase.
