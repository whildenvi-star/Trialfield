---
phase: 32-claims-lifecycle-ui
plan: "01"
subsystem: glomalin-portal/claims-kanban
tags: [dnd-kit, kanban, drag-drop, deadline-alerts, optimistic-update, client-state]
dependency_graph:
  requires: [31-02-SUMMARY.md, lib/claims/calc.ts, api/claims/[id]/route.ts]
  provides: [ClaimsWorkspace, ClaimsKanban, ClaimColumn, ClaimCard, DeadlineAlertBanner]
  affects: [glomalin-portal/src/app/(protected)/app/claims/page.tsx]
tech_stack:
  added: ["@dnd-kit/core@^6.3.1", "@dnd-kit/sortable@^10.0.0", "@dnd-kit/utilities@^3.2.2", "react-dropzone@^15.0.0"]
  patterns: [dynamic-ssr-false, optimistic-update-with-revert, server-to-client-handoff, useDroppable-column, useSortable-card]
key_files:
  created:
    - glomalin-portal/src/components/claims/claims-workspace.tsx
    - glomalin-portal/src/components/claims/claims-kanban.tsx
    - glomalin-portal/src/components/claims/claim-column.tsx
    - glomalin-portal/src/components/claims/claim-card.tsx
    - glomalin-portal/src/components/claims/deadline-alert-banner.tsx
  modified:
    - glomalin-portal/src/lib/claims/calc.ts
    - glomalin-portal/src/app/(protected)/app/claims/page.tsx
    - glomalin-portal/package.json
decisions:
  - "STAGE_ORDER uses CONTEXT.md visual order (notice_of_loss → filed → under_review → adjuster_assigned → settled → closed), not DB enum order"
  - "settled stage displays as 'Settled / Approved' — DB has `settled` not `approved_denied`"
  - "Optimistic revert: captures previousClaims before setClaims, restores on non-ok PATCH response"
  - "Note prompt is bottom-right floating (not modal), 10s auto-dismiss, non-blocking — skippable per CONTEXT.md"
  - "SortableContext items array built overdue-first to match visual rendered order (anti-pitfall 3)"
  - "isOverdue calls normalize deadline_at ?? null to avoid undefined vs null type mismatch at TypeScript boundary"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-06"
  tasks_completed: 2
  files_created: 5
  files_modified: 3
---

# Phase 32 Plan 01: Claims Kanban Board — Summary

**One-liner:** dnd-kit multi-container Kanban with STAGE_ORDER columns, optimistic PATCH stage changes, overdue pinning, and persistent deadline alert banner using dynamic({ ssr: false }) guard from first commit.

## What Was Built

### Task 1: Packages + calc.ts extensions
Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, and `react-dropzone` into glomalin-portal. Extended `src/lib/claims/calc.ts` with six new exports without modifying the existing four:

- `STAGE_ORDER` — 6-item const array in CONTEXT.md visual order
- `STAGE_LABELS` — display name map with `settled` → "Settled / Approved"
- `getDeadlineDaysRemaining(deadlineAt, stage)` — days remaining (negative = overdue), null for closed/no deadline
- `getDeadlineBorderClass(deadlineAt, stage)` — Tailwind classes: green (>30d), amber (7-30d), red (<7d), pulsing red (overdue)
- `getDeadlineCountdown(deadlineAt, stage)` — "14d left", "Due today", "3d overdue", or null
- `isOverdue(claim)` — boolean from getDeadlineDaysRemaining

Commit: `66ec347`

### Task 2: All Kanban components + page.tsx rewrite
**page.tsx** replaced with clean server-to-client handoff: `supabase.from('claims').select('*').order(...)` → `<ClaimsWorkspace initialClaims={data ?? []} />`.

**ClaimsWorkspace** (`claims-workspace.tsx`):
- `useState<Claim[]>(initialClaims)` owns all claims state
- `dynamic(() => import('./claims-kanban').then(m => ({default: m.ClaimsKanban})), {ssr: false})` — SSR guard applied at first commit (architectural requirement)
- `handleStageChange`: captures `previousClaims`, optimistic `setClaims`, PATCH `/api/claims/${id}`, reverts on non-ok
- Post-drag note prompt: bottom-right fixed z-50 toast, `pendingNoteClaimId` state, 10s auto-dismiss via setTimeout/useEffect, POST to `/api/claims/${id}/timeline` on submit, skip clears state
- `selectedClaimId` + `drawerOpen` states prepared for Plan 32-02 ClaimDrawer

**ClaimsKanban** (`claims-kanban.tsx`):
- `DndContext` with `closestCorners`, `PointerSensor` (distance: 8), `KeyboardSensor`
- `onDragEnd`: `STAGE_ORDER.includes(over.id)` → column drop; else `over.data.current.stage` → card drop (per anti-pitfall 2)
- 6 `<ClaimColumn>` in STAGE_ORDER, `DragOverlay` renders `<ClaimCard isDragOverlay>`

**ClaimColumn** (`claim-column.tsx`):
- `useDroppable({ id: stage })` — column is a drop target, highlights amber on `isOver`
- Builds `sortedClaims = [...overdueClaims, ...activeClaims]` — same array used for `SortableContext items` and rendering (anti-pitfall 3)
- Empty state: subtle "No claims" text, `min-h-[120px]` ensures empty columns remain droppable

**ClaimCard** (`claim-card.tsx`):
- `useSortable({ id, data: { stage, claim } })` — stage in data enables cross-container detection
- Left border from `getDeadlineBorderClass`, background `bg-red-900/10` when overdue
- Countdown pill color-matched to border urgency level
- `isDragOverlay` prop: skips ref/style/listeners, adds `rotate-1 shadow-xl` for drag ghost effect
- Click fires `onCardClick(id)` but not when `isDragOverlay`

**DeadlineAlertBanner** (`deadline-alert-banner.tsx`):
- Filters `getDeadlineDaysRemaining <= 7` on client
- Returns null when no approaching claims
- Red + animate-pulse if any overdue; amber otherwise
- `expanded` state toggles claim list (crop, deadline date, countdown)
- No dismiss button — persistent per CONTEXT.md

Commit: `a75721a`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript: deadline_at undefined vs null mismatch**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `Claim.deadline_at` typed as `string | null | undefined` but `isOverdue` expects `{ deadline_at: string | null }` — `undefined` not assignable to `string | null`
- **Fix:** Normalized at call sites in `claim-column.tsx` and `deadline-alert-banner.tsx` using `??` null coalescing: `isOverdue({ deadline_at: c.deadline_at ?? null, stage: c.stage })`
- **Files modified:** `claim-column.tsx`, `deadline-alert-banner.tsx`
- **Commit:** included in `a75721a`

## Requirements Satisfied

| Requirement | Evidence |
|-------------|----------|
| CLM-01 | 6 Kanban columns in STAGE_ORDER, claim cards show crop/coverage/deadline/amount |
| CLM-02 | Drag-and-drop via dnd-kit, PATCH /api/claims/[id], optimistic revert, dynamic({ssr:false}) prevents hydration error |
| CLM-05 | DeadlineAlertBanner at page top, persistent, click-to-expand, not dismissible, color-coded by urgency |

## Self-Check: PASSED

### Files created/exist
- FOUND: glomalin-portal/src/components/claims/claims-workspace.tsx
- FOUND: glomalin-portal/src/components/claims/claims-kanban.tsx
- FOUND: glomalin-portal/src/components/claims/claim-column.tsx
- FOUND: glomalin-portal/src/components/claims/claim-card.tsx
- FOUND: glomalin-portal/src/components/claims/deadline-alert-banner.tsx
- FOUND: glomalin-portal/src/lib/claims/calc.ts
- FOUND: glomalin-portal/src/app/(protected)/app/claims/page.tsx
- FOUND: glomalin-portal/package.json

### Commits verified
- FOUND: 66ec347 (Task 1 — packages + calc.ts)
- FOUND: a75721a (Task 2 — Kanban components + page.tsx)

### TypeScript
- npx tsc --noEmit: CLEAN (no errors)
