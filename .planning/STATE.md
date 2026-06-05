---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Mobile PWA
status: shipped
stopped_at: v1.0 milestone archived — all 5 phases complete, git tagged
last_updated: "2026-06-05T00:00:00.000Z"
last_activity: 2026-06-05
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05)

**Core value:** Farm operations data flows accurately from planning through execution — the farm manager plans, the office team records reality, and the full picture is always available to those who need it
**Current focus:** v1.0 shipped — start next milestone with /gsd:new-milestone

## Current Position

Phase: All 5 complete
Plan: All 15 complete
Status: Milestone shipped
Last activity: 2026-06-05

Progress: [>>>>>>>>>>] 100% (all phases complete)

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

**01-02 decisions:**

- grantedModules null (admin) mapped to all MODULES IDs for MobileBottomNav — avoids null prop in client component
- enterprise-summary fetches role via Supabase inline — standalone server component, no prop drilling needed
- Financial columns crew-gated in mobile cards using role === 'admin' || role === 'office'
- Mobile fallback for embed modules uses CSS-only md:hidden (Option A) — avoids UA detection

**01-01 decisions:**

- Purely presentational MobileHeader — no pathname reading inside component; layout derives pageTitle from pathname
- More sheet uses translate-y transition matching SideNav animation pattern — no custom CSS keyframes
- Sheet closes on navigation via pathname useEffect as well as explicit close button and backdrop tap
- --sidebar-w set to 0px in MobileBottomNav useEffect as belt-and-suspenders per Pitfall 6
- Farm Info = /app/field-history, Field Passes = /app/field-ops per Claude discretion in RESEARCH.md open questions

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

**02-01 decisions:**

- pendingCount sums offlineQueue + observationQueue — banner reflects full outstanding work across both queue types
- observationQueue imported from @/lib/offline/observation-queue (not db.ts — it is not re-exported from there)
- SyncResult extended with conflicts: ConflictRecord[] in sync-engine.ts — required for hook to reference result.conflicts
- CustomEvent dispatch pattern (sync:completed, sync:conflicts) keeps useSyncStatus decoupled from drawer/banner components

**02-02 decisions:**

- QueueDetailSheet implemented as native fixed bottom sheet — @radix-ui/react-dialog not in project dependencies
- SyncStatusProvider uses useRef(createClient()) for stable Supabase browser client across renders
- getToken uses getUser() + getSession() pattern (validate session, then read token) — consistent with crop-plans page
- Banner placed after MobileHeader inside md:hidden div — banner below header, above content on mobile

**05-03 decisions:**

- Corn-specific INI sections (CornDetector, StemAvoidance, FrameLogging) validated only when algorithm=corn via CORN_REQUIRED_CONFIG merged into working_config
- corn_brightness_min local variable used in hoot() corn branch to avoid shadowing self.brightness_min (GreenOnBrown threshold)
- log_detection() extended with optional frame/log_frames_dir params; image_path key always present in detection queue (None for non-corn)

**02-03 decisions:**

- 409 body parsed in replayOperation: serverPayload/serverVersion key presence distinguishes true conflict from already-confirmed 409 skip
- serverPayload returned in ReplayResult so processQueue can write ConflictRecord without re-reading consumed response body
- Resolution marks resolved:1 locally only — no server reconciliation call in Phase 2 (field observations rarely conflict; safety net not merge engine)

**02-04 decisions:**

- Human approval on portal.whughesfarms.com accepted after visual inspection — all five test scenarios passed; no gap closure needed

**03-03 decisions:**

- Human approval on portal.whughesfarms.com — all 6 visual verification checks passed; no gap closure needed

**03-02 decisions:**

- plan.fieldId used as fieldId in offlineQueue.add — CachedCropPlan.fieldId is the farm-registry ID needed for server replay; fieldName is display only
- operatorId/operatorName set to empty string in FieldOpsCard — client component has no user prop; sync engine fills in from auth session on replay
- PendingPass typed as interface with plan + pass tuple — avoids any, gives handleMarkDone full type context for both plan.fieldId and pass.id/type

**03-01 decisions:**

- Module order fixed at ['field-ops','field-history','weather','maps','observations','enterprise-summary','compliance','marketing','farm-budget'] — consistent and predictable for daily use
- module.route used for href prop (Module interface has route, not href — plan had a typo; auto-fixed)
- Admin role short-circuits module_access query: admin gets all MODULES.map(m=>m.id) without a DB filter
- Background sync wrapped in silent catch {} — IDB data always shown; refresh failure is non-fatal

### Roadmap Evolution

- Phase 5 added: Corn-specialized weed detection with stem avoidance training

### Pending Todos

(Cleared — v2.0 complete)

### Blockers/Concerns

(Cleared — 01-03 SSH deploy blocker resolved; phase 01 complete)

### Tech Debt Carried Forward

- sync-macro endpoint unguarded (medium)
- Sidebar budget-summary link visible to CREW (low)
- Seed ActualCell label mismatch (cosmetic)
- SUMMARY frontmatter missing requirements-completed (documentation)

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-05:

| Category | Item | Status |
|----------|------|--------|
| debug | acres-budget-math-wrong | investigating |

## Session Continuity

Last session: 2026-06-05
Stopped at: 03-03 complete — mobile dashboard production deploy verified; phase 3 done
Resume file: None
