---
phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training
plan: 02
subsystem: ml-inference
tags: [yolo, ultralytics, opencv, numpy, pytest, corn-detection, stem-avoidance, frame-quality]

# Dependency graph
requires:
  - phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training
    provides: CONTEXT.md and RESEARCH.md with class IDs, confidence defaults, buffer zone patterns

provides:
  - CornDetector class wrapping ultralytics YOLO with GreenOnGreen-compatible return signature
  - stem_avoidance module with buffer zone geometry (pixels_per_inch, is_in_buffer, filter_weeds_for_actuation)
  - frame_quality_ok gate for blur and darkness detection
  - 16 unit tests covering all edge cases (boundary, no-corn, no-weeds, dark/blurry)

affects:
  - 05-03 (hoot() loop integration consumes these modules)

# Tech tracking
tech-stack:
  added: [ultralytics YOLO, numpy (test frames), pytest]
  patterns:
    - Mirror GreenOnGreen.inference() return signature (None, boxes, weed_centres, image_out) for drop-in swap
    - Buffer zone boundary is inclusive (<=) — crop protection priority over weed kill rate
    - Frame quality checked darkness-first, then blur — fail fast on most common rejection reason
    - Expose corn_centers and all_detections as instance attributes for cross-module access

key-files:
  created:
    - Projects/owl-orin/utils/corn_detector.py
    - Projects/owl-orin/utils/stem_avoidance.py
    - Projects/owl-orin/utils/frame_quality.py
    - Projects/owl-orin/tests/test_corn_detector.py
  modified: []

key-decisions:
  - "CORN_CLASS_ID=0, WEED_CLASS_ID=1 per data.yaml order confirmed in CONTEXT.md"
  - "Default confidence 0.75 per RESEARCH.md discretion recommendation (high precision over recall)"
  - "is_in_buffer uses <= boundary: weed exactly at radius distance is suppressed (crop protection priority)"
  - "filter_weeds_for_actuation returns (actionable, suppressed) tuple so caller can log suppressed weeds"
  - "frame_quality_ok checks darkness before blur: dark frames skip the more expensive Laplacian computation"

patterns-established:
  - "Buffer zone geometry: pixels_per_inch(frame_width_px, fov_inches) converts radius from inches to pixels"
  - "Detection dict schema: {bbox: (x1,y1,bw,bh), label: str, conf: float, center: (cx,cy)}"
  - "CornDetector.all_detections holds full detection list with labels for stem avoidance consumption"

requirements-completed: [CORN-02, CORN-03, CORN-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 5 Plan 02: Corn Detection Modules Summary

**YOLOv8n CornDetector with GreenOnGreen-compatible API, inclusive buffer zone stem avoidance, and Laplacian/brightness frame quality gate — 16 unit tests all passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T13:52:27Z
- **Completed:** 2026-03-23T13:56:07Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- CornDetector wraps ultralytics YOLO and returns (None, boxes, weed_centres, image_out) matching GreenOnGreen exactly — hoot() loop swap requires minimal code changes in Plan 03
- Buffer zone geometry is self-contained: pixels_per_inch converts field measurements to pixel scale, is_in_buffer uses inclusive <= boundary to enforce crop protection priority, filter_weeds_for_actuation returns both actionable and suppressed lists for logging
- Frame quality gate rejects dark frames before computing Laplacian variance, preventing expensive blur computation on near-black images; all thresholds are overridable per deployment

## Task Commits

Each task was committed atomically (in the owl-orin repo):

1. **Task 1: Create CornDetector and frame quality modules** - `4ae091f` (feat)
2. **Task 2: Create stem avoidance module and unit tests** - `9f21747` (feat)

**Plan metadata:** committed to planning repo after self-check

## Files Created/Modified

- `Projects/owl-orin/utils/corn_detector.py` - CornDetector class, CORN_CLASS_ID=0, default conf 0.75, exposes corn_centers and all_detections
- `Projects/owl-orin/utils/stem_avoidance.py` - pixels_per_inch, is_in_buffer (<=), filter_weeds_for_actuation returning (actionable, suppressed)
- `Projects/owl-orin/utils/frame_quality.py` - frame_quality_ok(frame, blur_threshold=100, brightness_min=40) -> tuple[bool, str]
- `Projects/owl-orin/tests/test_corn_detector.py` - 16 unit tests for buffer geometry and frame quality, no model dependency

## Decisions Made

- Buffer boundary is inclusive (<=): a weed exactly at the configured radius from a corn plant is suppressed. Errs on side of crop protection as required by locked decision.
- filter_weeds_for_actuation returns both lists (actionable AND suppressed) rather than just actionable — caller can log suppressed detections for field review without losing information.
- frame_quality_ok evaluates darkness before blur: near-black frames (mean < brightness_min) skip the more expensive Laplacian computation.

## Deviations from Plan

None — plan executed exactly as written. The four extra tests added beyond the seven specified in the plan (test_pixels_per_inch_exact_division, test_weed_just_outside_boundary_not_suppressed, test_is_in_buffer_ignores_non_corn_detections, test_filter_corn_not_included_in_output, test_custom_thresholds_respected, test_frame_quality_returns_reason_string) were added inline for completeness; they do not deviate from plan intent.

## Issues Encountered

- System python3 lacked pytest — installed via pip3 (no venv in this project), tests ran successfully with full python3 path `/Library/Developer/CommandLineTools/usr/bin/python3 -m pytest`.

## User Setup Required

None — no external service configuration required. Model file (.pt or .engine) is provided at runtime by the caller; no path is hardcoded.

## Next Phase Readiness

- All three modules ready for Plan 03 hoot() loop integration
- CornDetector.inference() drop-in matches GreenOnGreen.inference() — minimal hoot() changes required
- stem_avoidance.filter_weeds_for_actuation() takes all_detections directly from CornDetector instance attribute
- frame_quality_ok() signal needs actuation-pause logic in hoot() per locked decision on poor visibility

---
*Phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training*
*Completed: 2026-03-23*

## Self-Check: PASSED

- FOUND: Projects/owl-orin/utils/corn_detector.py
- FOUND: Projects/owl-orin/utils/stem_avoidance.py
- FOUND: Projects/owl-orin/utils/frame_quality.py
- FOUND: Projects/owl-orin/tests/test_corn_detector.py
- FOUND: .planning/phases/05-corn-specialized-weed-detection-with-stem-avoidance-training/05-02-SUMMARY.md
- FOUND: commit 4ae091f (Task 1)
- FOUND: commit 9f21747 (Task 2)
