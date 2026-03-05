---
phase: 30-insurance-decision-tool-ui
plan: "01"
subsystem: glomalin-portal/insurance
tags: [insurance, crud, ui, coverage-matrix, react, nextjs]
dependency-graph:
  requires:
    - 29-02-SUMMARY.md (insurance_policies table with PATCH endpoint)
    - lib/fsa/calc.ts (computeInsurancePolicy, InsurancePolicy, PricingEntry types)
  provides:
    - POST /api/insurance/policies (policy creation)
    - DELETE /api/insurance/policies/[id] (policy removal)
    - InsuranceWorkspace (client orchestrator with CRUD state)
    - PolicyDrawer (slide-out create/edit form)
    - CoverageMatrix (8x3 CSS grid heat-map)
    - migrate-30.ts (plan_type column migration)
  affects:
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx (refactored to thin server component)
tech-stack:
  added: []
  patterns:
    - Server component passes initialPolicies + initialPricing to client InsuranceWorkspace
    - translate-x-full/translate-x-0 CSS transition for slide-out drawer
    - useMemo keyed on [policy, pricing] for 24-cell coverage matrix computation
    - rgba(200, 134, 10, 0.1 + intensity * 0.5) for heat-map coloring
    - RP-HPE/YP simplification: fall_price = spring_price for decision-support comparison
key-files:
  created:
    - glomalin-portal/scripts/migrate-30.ts
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
    - glomalin-portal/src/components/insurance/policy-drawer.tsx
    - glomalin-portal/src/components/insurance/coverage-matrix.tsx
  modified:
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx
    - glomalin-portal/src/app/api/insurance/policies/route.ts
    - glomalin-portal/src/app/api/insurance/policies/[id]/route.ts
    - glomalin-portal/src/lib/fsa/calc.ts
decisions:
  - "InsuranceWorkspace manages policy list state client-side — no full page reload on CRUD"
  - "RP-HPE and YP both use spring_price for fall_price in coverage matrix — simplification documented in code comment"
  - "Delete uses browser confirm() as specified — no custom ConfirmDialog for insurance (unlike FSA module)"
  - "Coverage matrix renders all 24 cells always — toggling selection shows/hides the whole matrix section"
metrics:
  duration: "~25 minutes"
  completed: "2026-03-05"
  tasks: 2
  files_created: 4
  files_modified: 4
---

# Phase 30 Plan 01: Insurance CRUD + Coverage Matrix Summary

**One-liner:** Interactive insurance policy CRUD with slide-out drawer and 8x3 CSS grid coverage matrix comparing RP/RP-HPE/YP at 50-85% coverage levels with heat-map coloring.

## What Was Built

### Task 1: Schema Migration + API Routes + Type Update

**migrate-30.ts** — Phase 30 migration script following exact pattern from migrate-29.ts:
- Prints `ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS plan_type TEXT;`
- Attempts exec_sql RPC, falls back to manual SQL editor instructions
- Verifies column exists via select after migration

**POST /api/insurance/policies** — Creates new policies with:
- Auth check (same pattern as GET)
- Validation: `planted_acres` required and positive
- Synthetic `legacy_id: ins_manual_${Date.now()}`
- Defaults: policy_year=2026, guarantee=0, actual=0, coverage_level=75, claim_alert='none', actual_synced_from_grain=false
- Returns 201 with `{ policy }`

**DELETE /api/insurance/policies/[id]** — Removes policies:
- Auth check, await params (Next.js 15+ async params)
- Returns `{ deleted: id }`

**PATCH expanded** — PolicyPatch now includes: farm_name, farm_number, crop, planted_acres, unit_type, premium_per_acre, agent_name, plan_type, prevented_planting, prevented_planting_acres

**InsurancePolicy type in calc.ts** updated with:
- `plan_type?: string | null` (Phase 30)
- `agent_name?: string | null`, `notes?: string | null`
- `aph_computed`, `aph_clu_count`, `actual_synced_from_grain`, `claim_alert` (Phase 29, optional)
- `line_number`, `policy_number` (optional)

### Task 2: UI Components + Refactored Page

**insurance/page.tsx** (refactored to thin server component):
- Fetches `insurance_policies` + `insurance_pricing` via Promise.all
- Passes `initialPolicies` and `initialPricing` to `InsuranceWorkspace`

**InsuranceWorkspace** (`'use client'` orchestrator):
- Local state: policies, selectedPolicyId, drawerOpen, drawerMode, editingPolicy
- Page header with "Add Policy" button + PDF placeholder slot
- 3 stat cards: Policies, Crops Insured, Claim Alerts
- Disclaimer banner
- Policy table: Farm, Crop, Plan Type, Coverage%, Guarantee, Actual, Alert, Actions
  - Selected row: border-l-2 border-soil-accent highlight
  - VERIFY badge: orange styling preserved
- Coverage Matrix section: shown when policy is selected, with header showing policy identity
- CRUD handlers: POST create, PATCH update, DELETE with confirm()
- Notes section for flagged policies

**PolicyDrawer** (`'use client'` slide-out panel):
- Fixed right panel, 480px wide, z-50
- backdrop z-40 bg-black/40, closes on click
- Slide animation: translate-x-full (closed) to translate-x-0 (open) with duration-200
- Three form sections: Policy Details, Acres & Yields, Other
- Plan Type select: RP / RP-HPE / YP with "(RP is most common)" hint
- Coverage Level select: 50-85% in 5% increments, default 75
- All inputs: soil design tokens (bg-soil-bg, border-soil-border, text-soil-text, focus:border-soil-accent)
- Pre-fills in edit mode from policy prop
- Submit: "Create Policy" or "Save Changes"

**CoverageMatrix** (`'use client'` CSS grid):
- Props: `policy: InsurancePolicy`, `pricing: PricingEntry[]`
- Constants: COVERAGE_LEVELS [50,55,60,65,70,75,80,85], PLAN_TYPES ['RP','RP-HPE','YP']
- `computeCell()`: RP uses pricing as-is; RP-HPE/YP set fall_price = spring_price
- Calls `computeInsurancePolicy()` 24 times (8 × 3)
- Heat-map: `rgba(200, 134, 10, 0.1 + intensity * 0.5)` where intensity = indemnity/maxIndemnity
- Current coverage level row: border-l-2 border-soil-accent highlight
- Active plan type column: border-b-2 border-soil-accent on header
- If no plan_type set: shows note "Select a plan type via Edit to highlight the active column"
- useMemo keyed on [policy, pricing] for performance
- Footer disclaimer: "Figures are illustrative — verify with your agent."

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] migrate-30.ts exists with ALTER TABLE — FOUND
- [x] POST handler in policies/route.ts returns 201 — FOUND
- [x] DELETE handler in [id]/route.ts returns { deleted: id } — FOUND
- [x] InsuranceWorkspace contains 'use client' — FOUND
- [x] PolicyDrawer contains translate-x — FOUND
- [x] CoverageMatrix calls computeInsurancePolicy — FOUND
- [x] TypeScript noEmit passes — PASSED
- [x] Next.js build succeeds — PASSED (✓ Compiled successfully, /app/insurance route appears)

## Self-Check: PASSED
