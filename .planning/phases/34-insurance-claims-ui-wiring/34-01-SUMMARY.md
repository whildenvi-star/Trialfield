---
phase: 34-insurance-claims-ui-wiring
plan: "01"
subsystem: glomalin-portal/insurance
tags: [insurance, claims, ui, aph, yield-sync, file-claim]
dependency_graph:
  requires: [29-01, 29-02, 31-01, 31-02]
  provides: [INS-05, INS-06, CLM-07]
  affects: [insurance-workspace, policy-drawer, claims-page]
tech_stack:
  added: []
  patterns: [useEffect-fetch, optimistic-update, modal-pattern, router-push]
key_files:
  created: []
  modified:
    - glomalin-portal/src/components/insurance/policy-drawer.tsx
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
decisions:
  - "APH display is purely informational — avgAph is never added to PolicyFormData or included in onSave"
  - "syncFeedback auto-clears after 5 seconds using setTimeout with functional updater to avoid stale closure"
  - "handleFileClaim navigates to /app/claims only after confirming res.ok — not optimistically"
  - "File Claim modal requires date_of_loss (required) and accepts description (optional, sends null if empty)"
  - "Sync Yield uses full policy row replacement from API response (not partial merge) to capture recomputed claim_alert"
metrics:
  duration: "2 minutes"
  completed: "2026-03-06"
  tasks_completed: 2
  files_modified: 2
---

# Phase 34 Plan 01: Insurance Claims UI Wiring Summary

Wire three backend APIs into Insurance module UI: APH auto-populate in PolicyDrawer (INS-05), Sync Yield button with inline feedback (INS-06), and File Claim modal with date_of_loss input navigating to /app/claims (CLM-07).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | APH auto-populate in PolicyDrawer | 6e20cee | policy-drawer.tsx |
| 2 | Sync Yield + File Claim modal in InsuranceWorkspace | 4d85e20 | insurance-workspace.tsx |

## What Was Built

**Task 1 — APH Auto-Populate (INS-05)**

`policy-drawer.tsx` received:
- `aphData` state (`{ avgAph, count, totalRecords } | null`) and `aphLoading` boolean
- `useEffect` on `[open, policy?.crop, policy?.farm_name]` that fetches `/api/insurance/aph-lookup` with `crop` (required) and `farmName` (optional) query params
- Read-only APH info box placed after the "Actual (bu/ac)" field and before the "Other" section header
- Three display states: loading spinner text, value with count, CLU-found-but-no-APH message, no-match message
- APH is NOT added to `PolicyFormData` — it never leaks into form submission

**Task 2 — Sync Yield + File Claim (INS-06, CLM-07)**

`insurance-workspace.tsx` received:
- `syncingId`, `syncFeedback`, `filingPolicy`, `claimDate`, `claimDesc`, `claimSubmitting` state variables
- `handleSyncYield(policyId)`: POSTs to `/api/insurance/yield-sync`, replaces full policy row in state on match, shows inline success/error feedback that auto-clears after 5 seconds
- `handleFileClaim()`: POSTs to `/api/claims` with `{ policy_id, date_of_loss, description }`, navigates to `/app/claims` on `res.ok`
- Updated Actions column: Edit | Sync Yield | File Claim | Delete buttons
- Sync feedback rendered inside the Actions `<td>` below the button row
- File Claim modal: backdrop + card with policy context header, date input (required), textarea (optional), Cancel/Submit buttons

## Deviations from Plan

### Pre-existing Modifications Discovered

**[Rule 1 - Pre-existing] `insurance-workspace.tsx` already had partial implementation**
- Found during: Task 2 setup
- Issue: The file had already been modified (by a prior session or linter) with `useRouter`, `useSearchParams`, `useEffect` for URL param handling (`?highlight=` and `?action=create`), and a simplified `handleCreateClaim` function with a `+ Claim` button
- Fix: Kept the URL param `useEffect` (legitimate cross-module navigation feature), replaced the simplified `handleCreateClaim` + `+ Claim` button with the full `handleSyncYield` + `handleFileClaim` functions and proper modal per plan spec
- Files modified: insurance-workspace.tsx

No additional deviations — plan executed as specified.

## Verification

- `npx tsc --noEmit` — zero type errors (verified twice: after Task 1 and Task 2)
- APH info box: renders below Actual field in edit mode only (guarded by `open && policy`)
- Sync Yield: full policy replacement from API response with recomputed `claim_alert`; `data.error` checked even on HTTP 200 (grain-tickets offline pattern)
- File Claim: modal with required date_of_loss, optional description, navigates after `res.ok`
- No new API routes, no new packages, no schema changes

## Self-Check: PASSED

Files exist:
- FOUND: glomalin-portal/src/components/insurance/policy-drawer.tsx
- FOUND: glomalin-portal/src/components/insurance/insurance-workspace.tsx

Commits exist:
- FOUND: 6e20cee (APH auto-fetch in PolicyDrawer)
- FOUND: 4d85e20 (Sync Yield + File Claim modal in InsuranceWorkspace)
