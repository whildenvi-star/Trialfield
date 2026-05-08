---
name: Macro Roll-Up Rebuild (2026-03-31)
description: Phase 1-3 of macro roll-up rebuild — data audit, layout rebuild, clutter removal
type: project
---

Completed full macro roll-up rebuild session (2026-03-31).

**Why:** The old roll-up showed FSA acreage/insurance/claims — wrong question entirely. The goal was "am I making money per field?"

**What was built:**
- `ROLLUP_DATA_AUDIT.md` — full data audit, all source tables mapped
- `PARKING_LOT.md` — 8 parked items for future sessions
- `glomalin-portal/src/app/(protected)/app/macro-rollup/page.tsx` — rebuilt (Server Component, 3-layer layout)
- `glomalin-portal/src/components/macro/field-table.tsx` — new client component, click-to-expand rows

**How to apply:** Costs come from `farm-budget /api/budget-field-details` (real data). Revenue comes from `grain_contracts` Supabase table (currently empty — 0 rows). When contracts exist, hero flips from "BUDGET POSITION" to "NET POSITION" automatically.

**Key finding — claims schema broken:** `migrate-fsa.ts` (Phase 27) and `migrate-31.ts` (Phase 31) created conflicting `claims` tables. Phase 31 columns (`stage`, `coverage_type`, `effective_guarantee`, `deadline_at`) were never added. Needs `ALTER TABLE claims ADD COLUMN IF NOT EXISTS` migration. Parked.

**Next parked session:** crop-plans/[fieldId]/page.tsx refactor (1,552-line God Component — see PARKING_LOT.md).
