---
phase: 56-structured-aph-database
plan: "02"
subsystem: glomalin-portal/insurance
tags: [aph, insurance, ui, react]
dependency_graph:
  requires: [aph_records table (56-01), CRUD API (56-01), insurance-workspace.tsx (Phase 30)]
  provides: [AphPanel component, APH History section in insurance workspace]
  affects: [glomalin-portal insurance module UI]
tech_stack:
  added: []
  patterns: [useCallback fetch pattern, onGuaranteeChange callback for state sync, strikethrough disaster rows]
key_files:
  created:
    - glomalin-portal/src/components/insurance/aph-panel.tsx
  modified:
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
decisions:
  - "AphPanel uses useCallback for fetchData — policyId change triggers refetch while onGuaranteeChange fires after every CRUD operation"
  - "Disaster rows use opacity-60 + line-through on yield value — muted display without hiding the row"
  - "SourceBadge renders GT (green), IMP (blue), MAN (gray) matching the GT badge style from the policy table"
metrics:
  duration: "5 minutes"
  completed: "2026-03-28"
  tasks_completed: 2
  files_changed: 2
---

# Phase 56 Plan 02: APH Management UI Panel Summary

APH management panel with year-by-year yield table, source badges, disaster-year exclusion toggles, inline add/delete, and auto-calculated guarantee display wired into the insurance workspace.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | APH management panel component | 414c4e3 | aph-panel.tsx |
| 2 | Wire APH panel into insurance workspace | 4959a7e | insurance-workspace.tsx |

## What Was Built

### Task 1: AphPanel Component

**aph-panel.tsx** — 'use client' component (300+ lines) providing full APH year management:

**Year table columns:**
- Year — crop year integer, muted when disaster
- Actual Yield (bu/ac) — value with line-through + muted on disaster rows
- Source — `SourceBadge` renders GT (green `bg-green-800/50`), IMP (blue `bg-blue-800/50`), MAN (gray `bg-glomalin-border/50`) badges
- Disaster Year — checkbox toggle; PATCH /api/insurance/aph/[id] on change, refetch on success
- Actions — "x" delete button; confirm dialog then DELETE /api/insurance/aph/[id], refetch on success

**Computed APH summary (above table):**
- Large accent text: `{computedAph} bu/ac`
- Muted count: `from N of M years, K excluded`
- Guarantee line: `Guarantee at {coverageLevel}%: {guarantee} bu/ac`
- Formula string: `APH = avg(y1 + y2 + ...) = {computedAph}`

**Add year form (below table):**
- Crop year number input (2010-2026 range, default current year - 1)
- Actual yield number input (step 0.1, non-negative)
- Source select: manual / grain-tickets / import
- POST /api/insurance/aph; 409 → "Year already exists" inline error; success clears form + refetches
- `onGuaranteeChange(guarantee)` fires after every successful fetch

### Task 2: InsuranceWorkspace Integration

**insurance-workspace.tsx additions:**
- `import { AphPanel } from './aph-panel'`
- `handleGuaranteeChange(newGuarantee)` — maps over `policies` state and updates matching policy's `guarantee` field, making the policy table guarantee column reflect APH-derived value immediately
- APH History section rendered when `selectedPolicy !== null`, positioned between the policy table and the Coverage Matrix section
- Section header matches existing Coverage Comparison / Payout Simulator pattern (font-mono, glomalin-accent, muted subtitle)

## Verification

1. AphPanel component exists with all required columns and source badges — PASSED
2. InsuranceWorkspace imports AphPanel and renders below policy table — PASSED
3. handleGuaranteeChange updates policy table guarantee via setPolicies callback — PASSED
4. npx tsc --noEmit — no TypeScript errors — PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created/exist:
- FOUND: glomalin-portal/src/components/insurance/aph-panel.tsx
- FOUND: glomalin-portal/src/components/insurance/insurance-workspace.tsx

Commits exist:
- 414c4e3 feat(56-02): APH management panel component
- 4959a7e feat(56-02): wire AphPanel into insurance workspace
