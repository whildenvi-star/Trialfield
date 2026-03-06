---
phase: 33-cross-module-integration-dashboard
plan: "01"
subsystem: glomalin-portal
tags: [cross-module, fsa, insurance, claims, navigation, prevented-planting]
dependency_graph:
  requires:
    - 32-02 (ClaimDrawer + POST /api/claims)
    - 30-01 (InsuranceWorkspace + policy CRUD)
    - 28-01 (CluCard + CluWorkspace)
  provides:
    - CLU-to-Policy navigation link in CluCard expanded view
    - Prevented Planting claim creation prompt in CluCard
    - Insurance-to-Claims navigation via File Claim button
    - URL-based policy highlighting (?highlight=id) and drawer open (?action=create)
  affects:
    - glomalin-portal/src/components/fsa/clu-card.tsx
    - glomalin-portal/src/components/fsa/clu-workspace.tsx
    - glomalin-portal/src/components/fsa/farm-accordion.tsx
    - glomalin-portal/src/components/fsa/tract-accordion.tsx
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx
tech_stack:
  added:
    - scripts/migrate-33.ts (ALTER TABLE clu_records ADD COLUMN prevented_planting)
  patterns:
    - useEffect on isExpanded for lazy policy fetch (fetch /api/insurance/policies with farm_number+crop+year)
    - dismissedPpIds Set threaded through CluWorkspace > FarmAccordion > TractAccordion > CluCard
    - Suspense boundary wrapping useSearchParams component (Next.js 14 requirement)
    - handleCreateClaim uses POST /api/claims + router.push('/app/claims') (same pattern as CluCard PP claim)
key_files:
  created:
    - glomalin-portal/scripts/migrate-33.ts
  modified:
    - glomalin-portal/src/lib/fsa/calc.ts
    - glomalin-portal/src/app/api/fsa/clu-records/[id]/route.ts
    - glomalin-portal/src/app/api/insurance/policies/route.ts
    - glomalin-portal/src/components/fsa/clu-card.tsx
    - glomalin-portal/src/components/fsa/clu-workspace.tsx
    - glomalin-portal/src/components/fsa/farm-accordion.tsx
    - glomalin-portal/src/components/fsa/tract-accordion.tsx
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx
decisions:
  - "[33-01]: dismissedPpIds state managed at CluWorkspace level (not card-local) — survives expand/collapse cycles within a session per Research pitfall 4"
  - "[33-01]: Linked policy fetch uses undefined as loading sentinel (undefined=loading, null=not-found, {id}=found) — avoids flash of 'No policy' while fetching"
  - "[33-01]: PP prompt shows based on draft.prevented_planting OR record.prevented_planting — user sees prompt immediately on checkbox change before Save"
  - "[33-01]: InsuranceWorkspace useEffect dependency array is [] (mount-only) — searchParams for highlight/action only read once at load, not re-read on nav"
metrics:
  duration_minutes: 5
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 9
  completed_date: "2026-03-06"
---

# Phase 33 Plan 01: Cross-Module Navigation Links Summary

**One-liner:** CLU-to-policy cross-nav with prevented planting claim trigger and insurance-to-claims File Claim button wired via URL params and shared API calls.

## What Was Built

Connected the three modules (FSA, Insurance, Claims) into a coherent workflow:

1. **CluCard expanded view now shows insurance policy link** — fetches `/api/insurance/policies?farm_number=&crop=&year=` on expand, displays "View Insurance Policy" link (routes to `/app/insurance?highlight=<id>`) or "No policy -- Add one" (routes to `/app/insurance?action=create&farm=&crop=`).

2. **Prevented Planting checkbox + prompt** — Added `prevented_planting` field to CluCard draft state and PATCH body. When checked, an amber inline banner appears offering to create a claim directly (POST `/api/claims`) or add a policy first if none is linked. Dismiss state persists in `CluWorkspace` across expand/collapse cycles.

3. **InsuranceWorkspace File Claim button** — Added `+ Claim` button per policy row in the Actions column. Calls `handleCreateClaim` which POSTs to `/api/claims` with policy_id and navigates to `/app/claims` on success.

4. **URL param navigation** — InsuranceWorkspace reads `?highlight=<id>` (selects that policy row) and `?action=create` (opens the create drawer) on mount via `useSearchParams`. Insurance page wrapped in `<Suspense>` to satisfy Next.js 14 requirement.

5. **Schema** — `prevented_planting BOOLEAN NOT NULL DEFAULT false` added to `CluRecord` interface (was already on `InsurancePolicy`). `migrate-33.ts` script created to ALTER TABLE clu_records. EDITABLE_FIELDS updated to accept `prevented_planting` in PATCH handler.

## Tasks

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Insurance policy filter API + prevented_planting to CluRecord | 3345d19 | Complete |
| 2 | Wire CluCard cross-nav + prevented planting prompt + InsuranceWorkspace File Claim | 741a89b | Complete |

## Deviations from Plan

None - plan executed exactly as written. The insurance-workspace.tsx file had some extra state vars added by the linter/editor (`syncingId`, `syncFeedback`, `filingPolicy`, etc.) that were pre-existing in the file and did not conflict with the implementation.

## Self-Check: PASSED

- FOUND: glomalin-portal/scripts/migrate-33.ts
- FOUND: glomalin-portal/src/components/fsa/clu-card.tsx
- FOUND: glomalin-portal/src/components/insurance/insurance-workspace.tsx
- FOUND: .planning/phases/33-cross-module-integration-dashboard/33-01-SUMMARY.md
- FOUND: commit 3345d19 (feat(33-01): add insurance policy filter API)
- FOUND: commit 741a89b (feat(33-01): wire CluCard cross-nav + prevented planting prompt)
- TypeScript: compiles cleanly (npx tsc --noEmit — no errors)
