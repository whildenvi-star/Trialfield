# Parking Lot

Ideas and scope items that came up during the Macro Roll-Up rebuild session.
**Do not build these during this session.**

---

## From discuss-phase session (2026-04-17)

### Platform UX Consolidation — post-v12.0 milestone

The user described a feeling of fragmentation from jumping between farm-budget (port 3001) and glomalin-portal (port 3010). Farm-budget is the most mature module (15+ years of refinement from Excel/Lotus roots), but the portal is accumulating new features without a clear unification path.

**Long-term direction:** Portal becomes the single face of the platform. Farm-budget transitions to a data backend (API server), with its UI gradually absorbed into the portal under the existing macro-rollup and maps modules.

**Candidate milestone:** "Portal-First" — after v12.0. Scope TBD, but likely includes:
- Portal-native macro rollup replacing farm-budget iframe embeds
- Farm-budget stripped to API-only (no UI served)
- Unified navigation with no cross-app context switches

---

## From Data Audit (2026-03-31)

### Claims schema fix
`migrate-fsa.ts` (Phase 27) and `migrate-31.ts` (Phase 31) created two incompatible versions of the `claims` table. Phase 31's `stage`, `coverage_type`, `effective_guarantee`, `deadline_at` columns were never added because `CREATE TABLE IF NOT EXISTS` was a no-op. Needs a targeted `ALTER TABLE claims ADD COLUMN IF NOT EXISTS` migration to add the missing Phase 31 columns to the existing table.

### Grain contracts data entry
`grain_contracts` table exists (Phase 57) but has zero rows. Revenue on the roll-up is entirely blocked on someone entering actual contracts. A lightweight data-entry flow (add contract: crop, bushels, price, buyer, delivery window) would unlock the revenue half of the NET POSITION.

### `insurance_policies.guarantee` / `premium_per_acre` verification
These may be `0` (default) rather than real values. Worth a direct DB query to confirm before trusting Insurance Coverage numbers.

### GCS enrollment data quality
149 rows in `gcs_enrollments` but `cc340_acres`, `rt345_acres`, `nt329_acres` may be `0` on most rows if not actually enrolled. Worth verifying aggregate sums before displaying.

### crop-plans/[fieldId]/page.tsx refactor
1,552-line God Component. Agreed to clean up in a follow-up session. Priorities:
- Extract 8 inline SVG icons to `components/icons.tsx`
- Extract `BottomSheet` to `components/ui/bottom-sheet.tsx`
- Extract `AddPassSheet` and `EditPassSheet` as sub-components with their own state
- Move 57 inline `style={{}}` hex values to Tailwind config tokens

### farm-budget proxy: `/api/budget-field-details`
This endpoint returns per-field cost + budget revenue — exactly what the roll-up needs. It's currently only consumed by organic-cert. Adding a Glomalin proxy route for it in Phase 2 is the right call. The endpoint already exists; just needs a new `/api/macro/field-rollup/route.ts` to wrap it.

### CBOT live prices integration
`/api/marketing/cbot-prices` exists. Could feed the "uncontracted bushels × current price" revenue estimate on the roll-up. Useful once grain_contracts has data.

### Planned-vs-actual toggle (explicitly excluded from Phase 2)
Brief says: remove planned-vs-actual toggle. Noted here so it can be considered for v10+.

### Insurance premium / APH sync
`claim_alert` column is always `'none'` — the APH sync that populates it has never been run. Phase 29 logic exists. Would need a manual trigger or scheduled job to run it.
