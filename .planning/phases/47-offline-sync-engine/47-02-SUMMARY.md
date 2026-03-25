---
phase: 47-offline-sync-engine
plan: "02"
subsystem: glomalin-portal/pwa
tags: [offline, sync, pwa, ui, idb, conflict-detection]
requirements: [OSE-03, OSE-04]

dependency_graph:
  requires: ["47-01"]
  provides: ["sync-status-panel", "pending-sync-ui", "conflict-detection-v2"]
  affects: ["glomalin-portal/crop-plans"]

tech_stack:
  added: []
  patterns:
    - "IDB sync-config store for last-sync timestamp persistence"
    - "10s polling interval for queue count badge freshness"
    - "online event + 2s delay for Background Sync coordination"
    - "fieldOperationId.startsWith('pending-') as pending-sync signal"

key_files:
  created:
    - glomalin-portal/src/components/pwa/sync-status-panel.tsx
  modified:
    - glomalin-portal/src/lib/offline/sync-engine.ts
    - glomalin-portal/src/app/(protected)/crop-plans/[fieldId]/page.tsx

decisions:
  - "getLastSyncTimestamp reads from sync-config IDB store — same store used by setSyncToken, no schema change needed"
  - "pending-sync detection uses fieldOperationId.startsWith('pending-') — set by confirmPass when offline, no separate tracking needed"
  - "refreshQueueState polls every 10s on component mount — lightweight IDB read, covers Background Sync decrement case"
  - "handleCancelPendingPass matches queued ops by fieldId + passId — handles both confirmed-pass and queued IDs"
  - "SyncStatusPanel uses same BottomSheet pattern as Phase 46 — CSS transform translateY, no external UI libs"
  - "writeLastSyncTimestamp fires when synced > 0 OR skipped.length > 0 — skipped (conflicts) count as sync activity"

metrics:
  duration_seconds: 336
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  completed_date: "2026-03-25"
---

# Phase 47 Plan 02: Sync Status UI and Pending-Sync Indicators Summary

**One-liner:** Conflict-aware replay with IDB timestamp persistence, SyncStatusPanel bottom sheet, and amber pending-sync badges with cancel action in the field detail page.

## What Was Built

### Task 1: Conflict detection additions to sync-engine.ts + SyncStatusPanel

**sync-engine.ts additions:**
- `writeLastSyncTimestamp()` — writes ISO timestamp to `sync-config` IDB store key `'last-sync'` after processQueue succeeds (synced > 0 or skipped > 0)
- `getLastSyncTimestamp()` — reads `'last-sync'` from sync-config, returns null if never synced
- `getQueueSummary()` — returns `{ pending, failed, total, lastSync }` from IDB queue + sync-config
- `processQueue` updated to call `writeLastSyncTimestamp()` at end of run when items were processed

**SyncStatusPanel (513 lines):**
- Slide-up bottom sheet (200ms ease-out translateY animation)
- Header: "Sync Status" title + `{lastSync ? relativeTime(ts) : 'Never synced'}` + Sync Now button with spinner + X close
- Pending items list: each row shows field+description, amber clock icon, X cancel button
- Failed items list: each row shows field+description, error message, per-item Retry button + "Retry All" at top
- Empty state when no pending or failed items
- Sync Now: calls `processQueue(getToken)`, refreshes summary, fires `onSyncComplete` callback
- Retry All: resets all failed ops to pending (retryCount 0) then triggers sync
- Per-item Retry: resets single failed op then triggers sync
- Per-item Cancel (pending): calls `offlineQueue.delete(op.id)` then refreshes

### Task 2: Field detail page updates

**New state:**
- `showSyncPanel: boolean` — controls SyncStatusPanel open state
- `pendingQueueCount: number` — drives badge on sync icon
- `lastSyncTimestamp: string | null` — drives "Last updated: X ago" header text

**New effects:**
- `refreshQueueState` (useCallback): reads pending count + lastSync from IDB on demand
- Polling `useEffect`: calls refreshQueueState every 10s while mounted
- Online event `useEffect`: on browser coming online, waits 2s then re-fetches plan via `syncCropPlanDetail` and refreshes queue state

**New handler:** `handleCancelPendingPass` — finds matching queued op in IDB by fieldId + passId, deletes it, reverts pass status to PLANNED in local state, refreshes queue state

**Header changes:**
- Back arrow + sync icon (two-arrows SVG) in a flex row with space-between
- Sync icon: amber when pendingQueueCount > 0, muted (#6a5a4a) when 0
- Amber numeric badge (top-right of icon) showing count when > 0
- "Last updated: {relativeTime(ts)}" or "Last updated: never" below field name/enterprise

**Pass row changes:**
- `isPendingSync = isConfirmed && pass.fieldOperationId?.startsWith('pending-')`
- Pending-sync passes: amber check-circle icon (vs green), amber "Pending sync" badge with clock icon, status shows amber "Confirmed" + X cancel button
- Normal confirmed passes: unchanged green check-circle, green "Confirmed" badge, tap to edit
- `handleConfirmTap`: when confirmPass returns `{ queued: true }`, sets `fieldOperationId` on pass and refreshes queue state

**SyncStatusPanel integration:**
- Rendered at bottom of return with `open={showSyncPanel}`, `getToken={async () => tokenRef.current}`, `onSyncComplete={handleSyncComplete}`
- `handleSyncComplete`: refreshes queue state + re-fetches plan from API

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: 0 errors in modified files (`src/lib/offline/sync-engine.ts`, `src/components/pwa/sync-status-panel.tsx`, `src/app/(protected)/crop-plans/[fieldId]/page.tsx`)
- Pre-existing errors in `scripts/backfill-*.ts`, `clu-card.tsx`, `insurance-workspace.tsx` — out of scope, not caused by these changes
- SyncStatusPanel: 513 lines (min_lines 100 requirement met)
- Field detail page contains "pending" (42 occurrences — requirement met)
- `processQueue` called from Sync Now button in sync-status-panel.tsx
- `SyncStatusPanel` rendered from sync icon tap in field detail page
- 409 / "already confirmed" responses treated as conflict/skip in processQueue (inherited from Plan 01)
- Last sync timestamp written after successful queue processing

## Self-Check: PASSED

- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/components/pwa/sync-status-panel.tsx` — FOUND
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/lib/offline/sync-engine.ts` — FOUND (modified)
- `/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/src/app/(protected)/crop-plans/[fieldId]/page.tsx` — FOUND (modified)
- Commit `db9f674` (Task 1) — FOUND
- Commit `3c15d3a` (Task 2) — FOUND
