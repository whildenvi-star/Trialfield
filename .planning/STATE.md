# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** Planning next milestone

## Current Position

Phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training — Plan 2/3 complete
Plan: 05-02 complete (CORN-02, CORN-03, CORN-04 satisfied) — CornDetector, stem avoidance, frame quality modules
Status: Phase 5 in progress — plan 2 of 3 executed
Last activity: 2026-03-23 — 05-02 complete (corn_detector.py, stem_avoidance.py, frame_quality.py, 16 unit tests)

Progress: [######....] 67% (phase 5: 2/3 plans done)

## Performance Metrics

**v2.0 Summary:**
- Phases: 5 (including 6.1 inserted)
- Plans: 10
- Code commits: 12
- Files modified: 19
- Lines: +3,492 / -273
- Timeline: 2 days

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
All v2.0 decisions marked with outcomes — see PROJECT.md.

**04-01 decisions:**
- Used (app) route group for observations page (not (protected) as plan stated — doesn't exist in this codebase)
- Photo serve route guarded with getAuthContext() — consistent with API pattern
- CREW sees only own observations; ADMIN/OFFICE see all farm observations
- JSON submission when no photo, multipart when photo present — avoids FormData overhead for text-only
- [Phase 04-field-data-entry]: Queue-first IDB write before upload guarantees no data loss on network failure
- [Phase 04-field-data-entry]: Safari Private Mode fallback: openObservationDB returns null, direct-upload path prevents crashes
- [Phase 04-field-data-entry]: field_observations uses Supabase RLS — users see only own observations via auth.uid() = submitted_by
- [Phase 04-field-data-entry]: JSON for text-only submit, multipart FormData for text+photo — avoids FormData overhead for text-only
- [Phase 04-field-data-entry]: Migration SQL created at supabase/migrations/003-field-observations.sql for manual application — no DB password in env

**04-02 decisions:**
- synced stored as 0|1 number not boolean — IDB indexes on boolean false are browser-inconsistent, number 0 is reliable
- DB_VERSION bumped from 1 to 2 with version-gated upgrade — preserves existing operation-queue and crop-plan-cache stores
- Queue-first: IDB write happens before upload attempt — guarantees no data loss even if network dies mid-submission
- Direct upload fallback when IDB unavailable — Safari Private Mode won't crash the form
- purgeOld(7) fires on mount fire-and-forget — keeps IDB from growing unbounded without blocking UI

**05-01 decisions:**
- FP16 (half=True) over INT8 for TensorRT export — ~26ms/frame on Orin Nano, avoids 1% mAP drop for crop-protection safety
- data.yaml paths rewritten to relative after Roboflow download — prevents FileNotFoundError across machines (Pitfall 2 from RESEARCH.md)
- ROBOFLOW_API_KEY via env var only — never hardcoded; argparse errors if missing
- 3 distinct training scripts vs. monolith — enforces GPU-host vs Orin-only execution context separation

**05-02 decisions:**
- CORN_CLASS_ID=0, WEED_CLASS_ID=1 per data.yaml order confirmed in CONTEXT.md
- Default confidence 0.75 per RESEARCH.md discretion recommendation (high precision over recall)
- is_in_buffer uses <= boundary: weed exactly at radius distance is suppressed (crop protection priority)
- filter_weeds_for_actuation returns (actionable, suppressed) tuple so caller can log suppressed weeds
- frame_quality_ok checks darkness before blur: dark frames skip the more expensive Laplacian computation

### Roadmap Evolution

- Phase 5 added: Corn-specialized weed detection with stem avoidance training

### Pending Todos

(Cleared — v2.0 complete)

### Blockers/Concerns

(Cleared — v2.0 complete)

### Tech Debt Carried Forward

- sync-macro endpoint unguarded (medium)
- Sidebar budget-summary link visible to CREW (low)
- Seed ActualCell label mismatch (cosmetic)
- SUMMARY frontmatter missing requirements-completed (documentation)

## Session Continuity

Last session: 2026-03-23
Stopped at: Completed 05-02-PLAN.md — CornDetector, stem avoidance, frame quality modules with 16 unit tests
Resume file: None
