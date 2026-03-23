---
phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training
plan: 01
subsystem: ml-training
tags: [yolov8, tensorrt, roboflow, ultralytics, jetson-orin, corn-detection]

# Dependency graph
requires: []
provides:
  - training/download_dataset.py — Roboflow YOLOv8 dataset download with data.yaml path fix
  - training/train_corn.py — YOLOv8n training script with corn-specific augmentation
  - training/export_engine.py — TensorRT FP16 export script for Jetson Orin
  - training/README.md — full 3-step pipeline documentation
affects:
  - 05-02 (CornDetector module will load the models/corn_detector.engine produced here)
  - 05-03 (logging and integration depend on model artifacts this pipeline produces)

# Tech tracking
tech-stack:
  added:
    - ultralytics>=8.3.0 (YOLOv8 training + TensorRT export via YOLO Python API)
    - roboflow>=1.1 (dataset download and version management)
    - albumentations>=1.4 (auto-detected by Ultralytics for extended augmentation)
    - tensorrt via JetPack (Orin inference — system package, not pip)
  patterns:
    - GPU-host-only training scripts with explicit docstring warnings about machine context
    - Relative data.yaml paths via post-download rewrite (avoids Pitfall 2 across machines)
    - FP16 export over INT8 for crop-protection safety margin
    - .gitignore exclusions for device-specific and large generated artifacts

key-files:
  created:
    - Projects/owl-orin/training/download_dataset.py
    - Projects/owl-orin/training/train_corn.py
    - Projects/owl-orin/training/export_engine.py
    - Projects/owl-orin/training/README.md
  modified:
    - Projects/owl-orin/.gitignore (added *.engine, training/dataset/, runs/)

key-decisions:
  - "FP16 (half=True) over INT8 for TensorRT export — ~26ms/frame on Orin Nano, avoids 1% mAP drop risk for crop-protection safety"
  - "data.yaml paths rewritten to relative after Roboflow download — prevents FileNotFoundError when training on different machines (Pitfall 2)"
  - "ROBOFLOW_API_KEY via env var only — never hardcoded; parser errors if key is missing"
  - "training/ directory with 3 distinct scripts rather than a single monolith — separates GPU-host-only from Orin-only execution contexts"

patterns-established:
  - "Machine context docstrings: every training script explicitly states which hardware it runs on in the module docstring"
  - "Post-download data.yaml fixup: always rewrite Roboflow absolute paths to relative immediately after download"
  - "FP16 safety principle: prefer FP16 over INT8 for any safety-critical agricultural inference"

requirements-completed: [CORN-01, CORN-07]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 5 Plan 01: Corn Detection Training Pipeline Summary

**YOLOv8n training pipeline with Roboflow download, field augmentation overrides, and TensorRT FP16 export targeting Jetson Orin at ~26ms/frame**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T13:52:20Z
- **Completed:** 2026-03-23T13:55:19Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Three-script pipeline (download -> train -> export) covering full model lifecycle from Roboflow dataset to Orin-ready .engine file
- download_dataset.py auto-fixes Roboflow's absolute data.yaml paths to relative, preventing cross-machine FileNotFoundError
- train_corn.py applies research-validated augmentation overrides (hsv_v=0.5, degrees=10, flipud=0.0, blur=0.01) with automatic best.pt copy to models/
- export_engine.py exports TensorRT FP16 with explicit docstring and README warning that export must run ON the Orin
- .gitignore updated with *.engine, training/dataset/, and runs/ to prevent large device-specific artifacts from hitting git

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Roboflow dataset download and YOLOv8n training scripts** - `d7f952a` (feat)
2. **Task 2: Create TensorRT export script and training README** - `26704ce` (feat)

## Files Created/Modified

- `Projects/owl-orin/training/download_dataset.py` — Roboflow SDK download with argparse, env-var API key, data.yaml path rewrite, nc=2/names verification
- `Projects/owl-orin/training/train_corn.py` — YOLOv8n training from COCO pretrained weights with corn-specific augmentation, copies best.pt to models/
- `Projects/owl-orin/training/export_engine.py` — TensorRT FP16 export for Orin; docstring and README explicitly forbid cross-compiling
- `Projects/owl-orin/training/README.md` — 3-step workflow with exact commands, machine context table, JetPack version note, FP16 rationale
- `Projects/owl-orin/.gitignore` — Added *.engine, training/dataset/, runs/

## Decisions Made

- **FP16 over INT8:** ~26ms/frame on Orin Nano is sufficient for field sprayer speeds; INT8's ~3ms savings not worth calibration data requirement and 1% mAP drop on a crop-protection safety boundary
- **Relative data.yaml paths:** Roboflow writes absolute paths by default. Post-download rewrite via regex substitution makes the dataset portable across GPU training hosts
- **Env-var API key only:** argparse defaults to `os.environ.get("ROBOFLOW_API_KEY", "")` with an explicit error if empty — no risk of a key appearing in scripts or git history
- **3 distinct scripts vs. 1 monolith:** Download and train run on GPU host; export runs on Orin. Keeping them separate enforces the machine-context constraint and makes each step independently rerunnable

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

To use the pipeline, users need a Roboflow API key:
1. Log into roboflow.com, go to Settings > API
2. Copy the API key
3. Set `export ROBOFLOW_API_KEY=your_key` in shell environment (or .env on training host)

Then run the 3 steps documented in `training/README.md`.

## Next Phase Readiness

- Pipeline scripts are ready; no model artifacts exist yet (require actual Roboflow dataset and GPU run)
- 05-02 will build the CornDetector module that loads the .engine file produced by export_engine.py
- The models/corn_detector.pt path is the handoff: train_corn.py writes it, export_engine.py reads it, CornDetector will load the resulting .engine

## Self-Check: PASSED

All created files confirmed present on disk. Task commits d7f952a and 26704ce verified in git log.

---
*Phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training*
*Completed: 2026-03-23*
