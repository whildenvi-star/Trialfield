---
phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training
verified: 2026-03-23T12:00:00Z
status: gaps_found
score: 5/7 goal truths verified
re_verification: false
gaps:
  - truth: "Requirement IDs CORN-01 through CORN-07 are defined in REQUIREMENTS.md and traceable to this phase"
    status: failed
    reason: "CORN-01 through CORN-07 do not exist anywhere in REQUIREMENTS.md. The file defines v2 requirements as PLAT-01/02/03, CAM-01/02/03, GPIO-01/02/03, INF-01/02/03, ACT-01/02/03, SETUP-01/02/03. No CORN-* namespace exists. These IDs were claimed by the invoker but are phantom."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "No CORN-* requirements defined. Closest functional neighbors are INF-01 (TensorRT backend) and MLT-01/MLT-02 (deferred to v3.0+)"
    missing:
      - "Add CORN-01 through CORN-07 to REQUIREMENTS.md under a new section, or map phase deliverables to existing requirement IDs (INF-01, INF-02 are the closest match)"
      - "Update REQUIREMENTS.md traceability table to include this phase"

  - truth: "Phase 05 planning artifacts exist in the phase directory"
    status: failed
    reason: "The phase directory contains only a .gitkeep placeholder. No 05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md, or any SUMMARY files exist. All other completed phases (01, 02, 03) have full PLAN + SUMMARY files."
    artifacts:
      - path: ".planning/phases/05-corn-specialized-weed-detection-with-stem-avoidance-training/"
        issue: "Directory contains only .gitkeep — no PLAN.md or SUMMARY.md files"
    missing:
      - "05-01-PLAN.md, 05-01-SUMMARY.md (training scripts)"
      - "05-02-PLAN.md, 05-02-SUMMARY.md (CornDetector + frame_quality + stem_avoidance)"
      - "05-03-PLAN.md, 05-03-SUMMARY.md (owl.py integration + config + log_manager)"
human_verification:
  - test: "Run python owl.py --config config/CORN_DETECT.ini on a machine with a trained models/corn_detector.pt or .engine present"
    expected: "OWL starts, logs platform/algorithm, frame quality gate fires on dark/blurry frames with PAUSED overlay, buffer zone suppresses weeds near corn, frame JPEGs land in logs/frames/YYYY-MM-DD/"
    why_human: "Requires a trained model file which cannot be committed (large binary). Cannot verify end-to-end inference path without hardware or model artifact."
  - test: "Run python training/train_corn.py on a GPU host with ROBOFLOW_API_KEY set and dataset downloaded"
    expected: "Training completes, models/corn_detector.pt is created, mAP50 is printed"
    why_human: "Requires GPU hardware and Roboflow API key. Cannot verify training output programmatically."
---

# Phase 5: Corn Specialized Weed Detection with Stem Avoidance Training — Verification Report

**Phase Goal:** Train and deploy a YOLOv8n corn detection model for the OWL inter-row actuator, with stem avoidance buffer zones, frame quality gating, and detection logging for post-run review
**Verified:** 2026-03-23T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Critical Finding: Requirement ID Mismatch

The invoker specified requirement IDs CORN-01 through CORN-07 for cross-reference against REQUIREMENTS.md. **None of these IDs exist in REQUIREMENTS.md.** The v2.0 requirements document defines requirements in these namespaces only: PLAT, CAM, GPIO, INF, ACT, SETUP. There is no CORN namespace.

The closest existing requirement IDs to this phase's actual deliverables:
- INF-01 (TensorRT backend loads .engine, returns detections) — partially satisfied by this phase
- INF-02 (ONNX-to-engine compilation runs on Jetson via setup script) — partially satisfied
- MLT-01/MLT-02 (Train YOLO from v1.0 data, fine-tune on field images) — listed as "Future Requirements (Deferred to v3.0+)"

This phase was executed outside the established roadmap sequence. ROADMAP.md defines Phase 5 as "GStreamer CSI Camera" (CAM-01/02/03). The work done here is real and valuable, but it has no traceability anchor in the requirements document.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | YOLOv8n training pipeline exists (download, train, export scripts) | VERIFIED | `training/download_dataset.py`, `training/train_corn.py`, `training/export_engine.py` — all substantive, non-stub |
| 2 | CornDetector wraps YOLO and mirrors GreenOnGreen.inference() return signature | VERIFIED | `utils/corn_detector.py` lines 46-100 — returns `(None, boxes, weed_centres, image_out)` exactly matching existing interface |
| 3 | Frame quality gate rejects dark and blurry frames before inference | VERIFIED | `utils/frame_quality.py` — Laplacian variance + mean brightness checks; 16/16 unit tests pass |
| 4 | Stem avoidance buffer zone filters weeds near corn from actuation | VERIFIED | `utils/stem_avoidance.py` — `filter_weeds_for_actuation()` returns (actionable, suppressed) tuple; inclusive boundary; 16/16 unit tests pass |
| 5 | Detection logging saves annotated frames to dated directories for post-run review | VERIFIED | `utils/log_manager.py` — `log_detection()` extended with frame/log_frames_dir params; `purge_old_frames()` enforces retention; JPEG to `logs/frames/YYYY-MM-DD/frame_XXXXXXXX.jpg` |
| 6 | Requirement IDs CORN-01 through CORN-07 are defined and traceable in REQUIREMENTS.md | FAILED | CORN-* namespace does not exist in REQUIREMENTS.md. Zero matches for `CORN-0[1-7]` across entire codebase. |
| 7 | Phase planning artifacts exist in the phase directory | FAILED | Phase directory contains only `.gitkeep`. No PLAN.md or SUMMARY.md files for any of the 3 plans executed. |

**Score: 5/7 truths verified**

---

## Required Artifacts

| Artifact | Purpose | Exists | Substantive | Wired | Status |
|----------|---------|--------|-------------|-------|--------|
| `training/download_dataset.py` | Roboflow dataset download + data.yaml path fix | Yes | Yes (167 lines, argparse CLI, yaml rewrite, nc=2 verify) | N/A (standalone script) | VERIFIED |
| `training/train_corn.py` | YOLOv8n training with field augmentation | Yes | Yes (144 lines, augmentation overrides, copies best.pt to models/) | N/A (standalone script) | VERIFIED |
| `training/export_engine.py` | TRT FP16 engine export, runs ON Orin | Yes | Yes (103 lines, half=True documented rationale, device-specific warning) | N/A (standalone script) | VERIFIED |
| `training/README.md` | 3-step workflow documentation | Yes | Yes (125 lines, machine context, file output table, FP16 vs INT8 rationale) | N/A (documentation) | VERIFIED |
| `utils/corn_detector.py` | CornDetector class wrapping YOLO | Yes | Yes (101 lines, GreenOnGreen interface match, corn_centers + all_detections exposed) | Imported in owl.py line 341 | VERIFIED |
| `utils/frame_quality.py` | frame_quality_ok() gate | Yes | Yes (60 lines, Laplacian + brightness, returns (bool, reason)) | Imported in owl.py line 343; called line 426 | VERIFIED |
| `utils/stem_avoidance.py` | Buffer zone geometry | Yes | Yes (115 lines, pixels_per_inch, is_in_buffer, filter_weeds_for_actuation) | Imported in owl.py line 342; called line 441 | VERIFIED |
| `utils/log_manager.py` | Detection logging with frame save | Yes | Yes — extended with log_detection(frame, log_frames_dir) and purge_old_frames() | Called in owl.py lines 449-454, 366 | VERIFIED |
| `config/CORN_DETECT.ini` | Corn algorithm config file | Yes | Yes (106 lines, CornDetector + StemAvoidance + FrameLogging sections) | Validated by ConfigValidator when algorithm=corn | VERIFIED |
| `utils/config_manager.py` | Config validation with corn support | Yes | Yes — CORN_REQUIRED_CONFIG dict; VALID_ALGORITHMS includes 'corn'; load_and_validate_config merges corn sections | Called in owl.py startup | VERIFIED |
| `tests/test_corn_detector.py` | Unit tests for geometry + quality | Yes | Yes (199 lines, 16 tests, all pass) | Run via pytest | VERIFIED |
| `.planning/phases/05-.../05-0N-PLAN.md` | Phase planning artifacts | No | — | — | MISSING |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `owl.py:hoot()` | `utils/corn_detector.CornDetector` | `import` at line 341, `weed_detector = CornDetector(...)` line 357 | WIRED | Model path and confidence read from `[CornDetector]` INI section |
| `owl.py:hoot()` | `utils/frame_quality.frame_quality_ok` | `import` at line 343, called line 426 | WIRED | Poor visibility: actuation paused, weed_centres set to [] |
| `owl.py:hoot()` | `utils/stem_avoidance.filter_weeds_for_actuation` | `import` at line 342, called line 441 | WIRED | weed_centres overridden with actionable-only list before actuation loop at line 477 |
| `owl.py:hoot()` | `utils/log_manager.LogManager.log_detection` | Called line 449 with frame + log_frames_dir | WIRED | Every `log_frame_every` frames; frame=image_out includes annotations |
| `owl.py:hoot()` | `utils/log_manager.LogManager.purge_old_frames` | Called line 366 on startup | WIRED | Deletes YYYY-MM-DD dirs older than `log_frame_retention_days` |
| `utils/config_manager.py` | `CORN_REQUIRED_CONFIG` | `load_and_validate_config` merges at line 484 when `algorithm == 'corn'` | WIRED | CornDetector, StemAvoidance, FrameLogging sections required only for corn configs |
| `weed_centres` (post-buffer) | Actuation loop | Line 443 overrides `weed_centres` then loop at line 477 consumes it | WIRED | Buffer-suppressed weeds never reach relay controller |
| CORN-01 through CORN-07 | REQUIREMENTS.md | No link exists | NOT_WIRED | Requirement IDs have no definition in REQUIREMENTS.md |

---

## Requirements Coverage

| Requirement ID | Claimed By Invoker | Found in REQUIREMENTS.md | Status |
|---------------|-------------------|--------------------------|--------|
| CORN-01 | Yes | No | MISSING — ID does not exist |
| CORN-02 | Yes | No | MISSING — ID does not exist |
| CORN-03 | Yes | No | MISSING — ID does not exist |
| CORN-04 | Yes | No | MISSING — ID does not exist |
| CORN-05 | Yes | No | MISSING — ID does not exist |
| CORN-06 | Yes | No | MISSING — ID does not exist |
| CORN-07 | Yes | No | MISSING — ID does not exist |

**Nearest existing requirements partially addressed by this phase:**

| Existing Requirement | Phase Assigned In ROADMAP | How This Phase Addresses It |
|---------------------|--------------------------|----------------------------|
| INF-01 (TensorRT backend loads .engine, returns detections) | Phase 7 | `utils/corn_detector.py` accepts .engine files; returns bounding boxes, centres, confidence |
| INF-02 (ONNX-to-engine compilation via setup script) | Phase 7 | `training/export_engine.py` provides standalone export; not yet integrated into `jetson_setup.sh` |
| MLT-01 (Train YOLO from v1.0 bot army JSONL data) | Deferred v3.0+ | `training/train_corn.py` trains from Roboflow dataset, not v1.0 JSONL data |

**Orphaned requirements check:** REQUIREMENTS.md maps no requirements to a Phase 5 or "corn" phase. ROADMAP.md assigns Phase 5 to CAM-01/02/03 (GStreamer CSI Camera). This phase executed a body of work that does not appear in the requirements traceability table at all.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `utils/stem_avoidance.py` | 98 | Comment says "sprayer" (`actionable_weeds: Weeds outside all corn buffer zones — safe to actuate the sprayer`) | Info | OWL is an inter-row actuating tool, not a sprayer — minor terminology drift from project core value |
| None | — | No TODO/FIXME/placeholder comments in any phase 5 artifact | — | Clean |
| None | — | No empty implementations (`return null`, `return {}`) | — | Clean |

No blocker or warning anti-patterns found in code artifacts.

---

## Human Verification Required

### 1. End-to-End Corn Detection Run

**Test:** Copy a trained `models/corn_detector.pt` to the project, run `python owl.py --config config/CORN_DETECT.ini` against a video of corn rows with weeds.
**Expected:** Frame quality gate triggers on dark/blurry frames with red "PAUSED" overlay; weeds within 3 inches of corn stems are suppressed (logged but not actuated); annotated JPEGs appear in `logs/frames/YYYY-MM-DD/`; detections logged to `logs/detections.jsonl`.
**Why human:** Requires trained model binary (not committed) and video feed. Cannot verify inference output without a model artifact.

### 2. TensorRT Export on Jetson Orin

**Test:** Copy `models/corn_detector.pt` to Jetson, run `python training/export_engine.py`.
**Expected:** `models/corn_detector.engine` is created; file size is reported (~5-15 MB for YOLOv8n FP16); OWL accepts the engine file at startup with `algorithm=corn`.
**Why human:** TensorRT compilation is Jetson-hardware-specific. Cannot run or verify without the target device.

### 3. Buffer Zone Suppression Field Calibration

**Test:** In a corn field at typical spray timing, measure crown diameter. Set `buffer_radius_inches` in `CORN_DETECT.ini` to crown radius plus 1-inch safety margin. Run OWL and observe suppressed weed count in logs.
**Expected:** Log entries show suppressed weeds near corn positions; actuator does not fire for suppressed weeds.
**Why human:** `camera_fov_inches` in `[StemAvoidance]` requires physical tape measure calibration per camera mount. Default value of 24.0 inches is an estimate.

---

## Gaps Summary

Two gaps block full verification:

**Gap 1 — Phantom requirement IDs.** The requirement IDs CORN-01 through CORN-07 do not exist in REQUIREMENTS.md. This phase was executed with a requirement namespace that was never defined. The code itself satisfies real functional goals, but there is no requirements traceability for it. The fix is either: (a) add CORN-01 through CORN-07 to REQUIREMENTS.md and the traceability table, or (b) map the phase deliverables to the closest existing requirement IDs (INF-01, INF-02) and note that MLT-01/MLT-02 were pulled forward from v3.0+ deferred scope.

**Gap 2 — Missing phase planning artifacts.** The phase directory contains only a `.gitkeep`. All three plans (05-01, 05-02, 05-03) were executed and committed without creating PLAN.md or SUMMARY.md files in `.planning/phases/05-.../`. Every other completed phase (01, 02, 03) has full planning artifacts. This breaks the audit trail for future reference and for the GSD orchestration system.

The code artifacts are well-implemented, fully wired, and all unit tests pass. The gaps are documentation and traceability failures, not implementation failures.

---

_Verified: 2026-03-23T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
