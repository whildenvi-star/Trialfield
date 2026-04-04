---
phase: 68-compliance-hub-redesign
plan: 03
subsystem: ui
tags: [next.js, tailwind, supabase, compliance, tab-routing, insurance, claims]

# Dependency graph
requires:
  - 68-01 (ComplianceShell, ActionButton, compliance UI primitives)
  - 68-02 (AcreageTab pattern established)
provides:
  - InsuranceTab wrapper with farm/crop filter and File Claim cross-tab navigation button
  - ClaimsTab wrapper with farm/crop filter mounting ClaimsWorkspace
  - /app/insurance redirect to /app/compliance?tab=insurance
  - /app/claims redirect to /app/compliance?tab=claims
affects:
  - 68-04 (Overview tab will use same ComplianceShell with now-complete insurance/claims props)
  - 68-05 (Calendar tab, nav consolidation)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Thin wrapper pattern: filter at array level before passing to unmodified workspace components
    - useMemo filtering: farm/crop text filter applied via useMemo to avoid re-renders on unrelated state changes
    - Cross-tab navigation: navigateTab prop passed through shell to InsuranceTab; File Claim button lives in wrapper not workspace
    - Server-side redirect(): Next.js redirect() in server component page files for legacy route migration
    - Extended Promise.all: compliance page.tsx fetches all module data in single Promise.all for all tabs

key-files:
  created:
    - glomalin-portal/src/components/compliance/insurance-tab.tsx
    - glomalin-portal/src/components/compliance/claims-tab.tsx
  modified:
    - glomalin-portal/src/components/compliance/compliance-shell.tsx
    - glomalin-portal/src/app/(protected)/app/compliance/page.tsx
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx
    - glomalin-portal/src/app/(protected)/app/claims/page.tsx

key-decisions:
  - "InsuranceWorkspace has a built-in File Claim modal that routes to /app/claims — the new InsuranceTab wrapper adds a separate File Claim button above the workspace that navigates to the Claims tab via navigateTab(); both coexist without modifying workspace"
  - "Claim type uses [key: string]: unknown index signature — farm_name/farm_number fields accessed via (c as any) cast per plan spec"
  - "TAB_PLACEHOLDERS type narrowed from Exclude<TabId,'acreage'> to Exclude<TabId,'acreage'|'insurance'|'claims'> as those tabs now have real implementations"
  - "Promise.all in page.tsx extended with 4 additional fetches (policies, pricing, lastScraped, claims) — all fetched in parallel, no waterfall"

patterns-established:
  - "Same filter-at-wrapper pattern as AcreageTab — farm/crop filter applied via useMemo before passing initialX prop to workspace"
  - "Cross-tab File Claim navigation via navigateTab() callback passed through ComplianceShell props chain"

requirements-completed: [COMP-04, COMP-05]

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 68 Plan 03: Insurance Tab + Claims Tab + Redirects Summary

**InsuranceWorkspace and ClaimsWorkspace mounted inside ComplianceShell tabs with array-level farm/crop filtering; legacy /app/insurance and /app/claims routes redirect to compliance hub**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T04:05:09Z
- **Completed:** 2026-04-04T04:07:12Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created InsuranceTab wrapper: useMemo farm/crop filtering, File Claim button above InsuranceWorkspace (workspace not modified), navigateTab cross-tab callback wired
- Created ClaimsTab wrapper: useMemo farm/crop filtering, ClaimsWorkspace mounted with filtered claims array
- Updated ComplianceShell: added 4 new props (policies, pricing, lastScraped, claimsData), renderTabContent handles 'insurance' and 'claims' cases
- Updated compliance page.tsx: extended Promise.all with 4 additional Supabase fetches for insurance and claims data, passes all to ComplianceShell
- Replaced /app/insurance/page.tsx and /app/claims/page.tsx with Next.js server-side redirects to /app/compliance?tab=insurance and ?tab=claims respectively

## Task Commits

1. **Task 1: Insurance tab + Claims tab wrappers with filter and shell wiring** - `092ca2e` (feat)
2. **Task 2: Redirect /app/insurance and /app/claims to compliance tabs** - `728ac5e` (feat)

## Files Created/Modified
- `glomalin-portal/src/components/compliance/insurance-tab.tsx` - Thin wrapper with farm/crop useMemo filter and File Claim cross-tab navigation button; mounts InsuranceWorkspace unchanged
- `glomalin-portal/src/components/compliance/claims-tab.tsx` - Thin wrapper with farm/crop useMemo filter; mounts ClaimsWorkspace unchanged
- `glomalin-portal/src/components/compliance/compliance-shell.tsx` - Added 4 new props; renderTabContent now handles insurance and claims tabs via InsuranceTab/ClaimsTab; TAB_PLACEHOLDERS type narrowed
- `glomalin-portal/src/app/(protected)/app/compliance/page.tsx` - Extended Promise.all with insurance_policies, insurance_pricing, lastScraped, claims fetches; passes new props to ComplianceShell
- `glomalin-portal/src/app/(protected)/app/insurance/page.tsx` - Replaced with server-side redirect to /app/compliance?tab=insurance
- `glomalin-portal/src/app/(protected)/app/claims/page.tsx` - Replaced with server-side redirect to /app/compliance?tab=claims

## Decisions Made
- InsuranceTab adds a wrapper-level File Claim button calling navigateTab('claims'); InsuranceWorkspace's own built-in File Claim modal (which still routes to /app/claims) also remains — both coexist since the workspace is not modified per CONTEXT.md constraint
- Claim interface already has [key: string]: unknown index so (c as any) cast is belt-and-suspenders per plan spec
- TAB_PLACEHOLDERS type narrowed to exclude insurance and claims now that they have real implementations
- Promise.all in page.tsx extended with 4 fetches in parallel — no waterfall, no separate loading states needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Self-Check

- [x] insurance-tab.tsx exists at correct path
- [x] claims-tab.tsx exists at correct path
- [x] /app/insurance/page.tsx is a redirect
- [x] /app/claims/page.tsx is a redirect
- [x] TypeScript compiles clean (0 errors)
- [x] Commits 092ca2e and 728ac5e exist

## Self-Check: PASSED

---
*Phase: 68-compliance-hub-redesign*
*Completed: 2026-04-04*
