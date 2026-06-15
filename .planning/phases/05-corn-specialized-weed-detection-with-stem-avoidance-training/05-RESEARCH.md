# Phase 5: Corn-Specialized Weed Detection with Stem Avoidance Training - Research

**Researched:** 2026-03-23
**Domain:** YOLOv8 model training, TensorRT deployment on Jetson Orin, stem avoidance logic, detection logging
**Confidence:** MEDIUM (core stack HIGH, synthetic data generation MEDIUM, TensorRT Orin specifics MEDIUM)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Training data strategy**
- Synthetic + real images combined for training dataset
- Real captures from both OWL-mounted camera (production angle) and phone/handheld (quick augmentation)
- Bounding box annotation (not segmentation masks)
- Roboflow for labeling and dataset management
- Export in format compatible with YOLOv8

**Stem avoidance behavior**
- Fixed buffer zone radius around each detected corn stem
- Buffer radius configurable via INI config file (buffer_radius_inches parameter) — adjustable per field or crop stage without retraining
- Weeds detected inside the buffer zone are skipped entirely — crop protection always takes priority over weed kill rate
- Low-confidence detections (below threshold) treated as corn — when in doubt, protect it

**Detection scope**
- Binary classification: corn vs not-corn (everything not corn is a target)
- Protect all corn-looking plants regardless of position — no volunteer corn removal
- YOLOv8 nano architecture for inference on Jetson Orin (TensorRT export)
- Training on cloud/desktop GPU, deploy optimized model to Orin for inference only

**Field condition handling**
- Target growth stages: early season only (V2-V6) — when mechanical weed control is most effective
- Poor visibility (heavy shadow, dawn/dusk, lens obstruction): pause actuation and alert operator — no blind actuation
- Heavy data augmentation during training: brightness, contrast, shadow, blur, rotation for field robustness
- Log every detection with full image frame and bounding boxes for post-run review and model refinement

### Claude's Discretion
- Exact confidence threshold value (e.g., 70% vs 80%)
- Synthetic data generation approach and tooling
- TensorRT optimization parameters (FP16 vs INT8)
- Detection logging storage format and rotation policy
- Exact augmentation parameters and ratios

### Deferred Ideas (OUT OF SCOPE)
- Multi-crop support (soybeans, wheat, etc.) — future phase per crop type
- Specific weed species identification — could be layered on later for agronomic reporting
- Position-aware volunteer corn removal — requires row position tracking not yet in OWL
- Full-season detection (V6 through tassel/canopy closure) — separate training effort
</user_constraints>

---

## Summary

This phase replaces the OWL codebase's existing `GreenOnGreen` class (which uses an SSD MobileNet TFLite model via `pycoral`) with a YOLOv8 nano model trained specifically to distinguish corn stems from weeds. The Jetson Orin runs Ultralytics YOLO inference (Python) against a TensorRT-optimized `.engine` file, while the GPU training step runs on a desktop or cloud machine. The `detector.py` heuristic classifier and the `GreenOnGreen` TFLite path are both replaced by a new `CornDetector` module that fits the existing `detect()` → `detections list` interface.

The core workflow is: (1) build a labeled Roboflow dataset in YOLOv8 format, (2) train `yolov8n.pt` with heavy augmentation on a GPU host, (3) export to TensorRT `.engine` on the Orin itself (TensorRT engines are device-specific — export must happen on the target hardware), (4) wire the new model into the `hoot()` loop via a new `[CornDetector]` INI section, (5) add buffer zone logic in the actuator decision path, and (6) extend `LogManager` to persist annotated frames alongside detection JSONL.

Research confirms YOLOv8 nano with TensorRT FP16 achieves ~26ms per frame on Jetson Orin Nano (≈38 FPS) — sufficient for a field sprayer at normal operating speeds. INT8 is faster (23ms) but requires calibration data and a 1% accuracy tradeoff; given the safety-critical nature of crop protection, FP16 is the recommended export mode.

**Primary recommendation:** Train `yolov8n` on a Roboflow-managed binary dataset (corn / not-corn), export to TensorRT FP16 on the Orin, slot into existing OWL `hoot()` loop via a new `CornDetector` class that mirrors the `GreenOnGreen` inference interface.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ultralytics | >=8.3.0 | YOLOv8 training + inference Python API | Official Ultralytics package; provides `YOLO` class for train/export/predict |
| torch | >=2.0 (CUDA) | PyTorch backend for training GPU host | Required by ultralytics; GPU host uses CUDA wheels |
| opencv-python | >=4.8 | Frame capture, blur detection, annotation drawing | Already in OWL codebase |
| roboflow | >=1.1 | Dataset download via Python API | Official Roboflow Python SDK; enables `rf.workspace().project().version().download("yolov8")` |
| albumentations | >=1.4 | Extended augmentation pipeline | Auto-detected by Ultralytics; no config needed if installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tensorrt | Jetson system pkg | TensorRT runtime for Orin inference | Installed via JetPack; do NOT pip install — use system TRT |
| numpy | already in OWL | Buffer zone geometry math | Already present |
| Pillow | >=11.2.1 | Image save for frame logging | Already pinned in OWL requirements.txt |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| YOLOv8n TensorRT FP16 | INT8 quantization | INT8 is ~12% faster but needs calibration dataset + ~1% mAP drop. FP16 safer for crop-protection safety margin |
| YOLOv8n TensorRT FP16 | ONNX Runtime | ONNX lacks Jetson GPU optimization; TRT is the correct choice for Orin |
| Roboflow Python API | Manual wget export | API download reproducible and scriptable; wget requires browser login |
| albumentations auto | Custom augmentation script | Auto-detection is simpler; custom only needed for domain-specific transforms not covered by YOLO defaults |

### Installation (Training Host — GPU machine, NOT Orin)

```bash
pip install ultralytics>=8.3.0 roboflow>=1.1 albumentations>=1.4
```

### Installation (Jetson Orin — inference only)

```bash
# TensorRT is installed via JetPack — do NOT pip install tensorrt
pip install ultralytics>=8.3.0
# Export .engine on the Orin itself (device-specific, cannot cross-compile)
yolo export model=corn_detector.pt format=engine half=True device=0 imgsz=640
```

---

## Architecture Patterns

### Recommended Project Structure

```
owl-orin/
├── models/
│   ├── corn_detector.pt          # YOLOv8n trained weights (GPU host artifact)
│   └── corn_detector.engine      # TensorRT FP16 export (Orin-generated, .gitignore)
├── training/
│   ├── dataset/                  # Roboflow download lands here (data.yaml + images/)
│   ├── train_corn.py             # Training script (runs on GPU host, not Orin)
│   └── export_engine.py          # TRT export script (runs on Orin)
├── utils/
│   ├── corn_detector.py          # NEW: CornDetector class (replaces GreenOnGreen)
│   ├── stem_avoidance.py         # NEW: buffer zone geometry logic
│   ├── frame_quality.py          # NEW: Laplacian blur/darkness check
│   └── log_manager.py            # EXTEND: add frame save to log_detection()
├── config/
│   └── CORN_DETECT.ini           # NEW config with [CornDetector] section
└── logs/
    ├── detections.jsonl           # Existing — extend with image_path field
    └── frames/                    # NEW: annotated frame JPEGs, dated subdirs
```

### Pattern 1: CornDetector Drop-In Replacement

**What:** A new class that mirrors the `GreenOnGreen.inference()` return signature so `owl.py`'s `hoot()` loop requires minimal changes.

**When to use:** Whenever the algorithm is set to `'corn'` in the INI `[System]` section.

**Example:**

```python
# utils/corn_detector.py
# Source: Ultralytics docs https://docs.ultralytics.com/usage/python/

from ultralytics import YOLO
import cv2

CORN_CLASS_ID = 0  # class 0 = corn, class 1 = weed (per data.yaml order)

class CornDetector:
    def __init__(self, model_path: str, confidence: float = 0.75):
        self.model = YOLO(model_path)  # accepts .pt or .engine
        self.confidence = confidence

    def inference(self, frame, confidence=None):
        conf = confidence or self.confidence
        results = self.model.predict(frame, conf=conf, verbose=False)[0]

        boxes = []
        corn_centers = []

        for box in results.boxes:
            cls_id = int(box.cls)
            score = float(box.conf)
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            bw, bh = x2 - x1, y2 - y1
            cx, cy = x1 + bw // 2, y1 + bh // 2

            label = "corn" if cls_id == CORN_CLASS_ID else "weed"
            boxes.append({"bbox": (x1, y1, bw, bh), "label": label,
                          "conf": score, "center": (cx, cy)})
            if label == "corn":
                corn_centers.append([cx, cy])

        return None, boxes, corn_centers, results.plot()
```

### Pattern 2: Stem Avoidance Buffer Zone

**What:** Compute a pixel-radius exclusion zone around each corn detection center. Any weed center inside that radius is suppressed — actuator is not triggered.

**When to use:** After `CornDetector.inference()` returns; before relay actuation decision.

**Example:**

```python
# utils/stem_avoidance.py

import math

def pixels_per_inch(frame_width_px: int, fov_inches: float) -> float:
    """Convert config buffer_radius_inches to pixels given known camera FOV."""
    return frame_width_px / fov_inches

def is_in_buffer(weed_center, corn_detections, buffer_radius_px: float) -> bool:
    wx, wy = weed_center
    for det in corn_detections:
        if det["label"] != "corn":
            continue
        cx, cy = det["center"]
        if math.hypot(wx - cx, wy - cy) <= buffer_radius_px:
            return True
    return False

def filter_weeds_for_actuation(detections, corn_detections, buffer_radius_px):
    """Return only weed detections outside all corn buffer zones."""
    return [
        d for d in detections
        if d["label"] == "weed"
        and not is_in_buffer(d["center"], corn_detections, buffer_radius_px)
    ]
```

### Pattern 3: Frame Quality Gate (Blur / Darkness Detection)

**What:** Laplacian variance check on each frame before running detection. If variance is below threshold OR mean brightness is below a minimum, return a "poor visibility" signal that pauses actuation.

**When to use:** At the top of the `hoot()` loop, before `weed_detector.inference()`.

**Example:**

```python
# utils/frame_quality.py
# Source: Blur detection via Laplacian variance — PyImageSearch (2015, still standard)

import cv2
import numpy as np

def frame_quality_ok(frame, blur_threshold=100, brightness_min=40) -> tuple[bool, str]:
    """
    Returns (ok, reason). If ok=False, reason explains why.
    - blur_threshold: Laplacian variance below this = blurry. Tune per field conditions.
    - brightness_min: mean pixel value below this = too dark.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    mean_bright = np.mean(gray)

    if mean_bright < brightness_min:
        return False, f"dark (mean={mean_bright:.1f})"
    if lap_var < blur_threshold:
        return False, f"blurry (laplacian_var={lap_var:.1f})"
    return True, "ok"
```

### Pattern 4: INI Config Extension

**What:** New `[CornDetector]` section in config file, read by `owl.py`. New `buffer_radius_inches` parameter in `[System]` or a dedicated `[StemAvoidance]` section.

**Example:**

```ini
# config/CORN_DETECT.ini additions

[System]
algorithm = corn

[CornDetector]
model_path = models/corn_detector.engine
confidence = 0.75
# poor visibility gates
blur_threshold = 100
brightness_min = 40

[StemAvoidance]
buffer_radius_inches = 3.0
# camera_fov_inches must match physical camera mount for px conversion
camera_fov_inches = 24.0
```

ConfigValidator must be extended to recognize `algorithm = corn` as valid and add `[CornDetector]` and `[StemAvoidance]` to `REQUIRED_CONFIG`.

### Pattern 5: Extend LogManager for Frame Logging

**What:** `LogManager.log_detection()` currently accepts detection dicts but does NOT save image frames. Extend it to optionally accept a `frame` (numpy array) and save a JPEG to a dated subdirectory.

**When to use:** Every frame where detection runs (not just weed hits — log everything for model refinement).

**Example:**

```python
# Extension to LogManager.log_detection()
# Keep backward-compatible signature

import cv2
from pathlib import Path
from datetime import datetime

def log_detection_with_frame(self, frame_id: int, detections: dict,
                               frame=None, log_frames_dir: Path = None) -> None:
    image_path = None
    if frame is not None and log_frames_dir is not None:
        date_dir = log_frames_dir / datetime.utcnow().strftime("%Y-%m-%d")
        date_dir.mkdir(parents=True, exist_ok=True)
        image_path = date_dir / f"frame_{frame_id:08d}.jpg"
        cv2.imwrite(str(image_path), frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

    self.detection_queue.put({
        'timestamp': time(),
        'frame_id': frame_id,
        'detections': detections,
        'image_path': str(image_path) if image_path else None
    })
```

### Anti-Patterns to Avoid

- **Cross-compiling TensorRT engines:** TRT `.engine` files are device-specific. Never export on the training host and copy to Orin — it will fail silently or crash. Export must run on the Orin with `device=0`.
- **Using `pycoral`/TFLite for the new model:** The existing `GreenOnGreen` class imports `pycoral`. The new `CornDetector` uses `ultralytics` directly. Do not mix the two runtimes.
- **Committing `.engine` files to git:** TRT engine files are large and device-specific. Add `*.engine` to `.gitignore`.
- **Running `model.export()` from the training host for Orin deployment:** Export must happen on Orin. Ship `corn_detector.pt`, then run `export_engine.py` on the device.
- **Setting `confidence = 1.0` or treating confidence as boolean:** The decision to treat low-confidence as corn is policy logic in `stem_avoidance.py`, not a model threshold. Keep `conf` at 0.75 (recommend) and handle sub-threshold in the actuator decision.
- **Logging full uncompressed frames:** At 30 FPS this fills storage in minutes. Log JPEG at 85% quality, and use dated subdirectory rotation with a configurable max-days purge.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Object detection inference | Custom ONNX session | `ultralytics.YOLO` | Handles pre/post-processing, NMS, coordinate scaling, TRT backend automatically |
| TensorRT optimization | Manual TRT builder Python | `yolo export format=engine` | Ultralytics handles workspace, FP16 flags, calibration hooks correctly |
| Dataset augmentation pipeline | Custom image transforms loop | Ultralytics built-in augmentation + albumentations | Handles bounding box coordinate transforms on geometric ops; hand-rolling breaks bbox coords |
| Annotation format conversion | Script to convert bbox CSV → YOLO txt | Roboflow export `format="yolov8"` | Roboflow handles train/val/test split, generates `data.yaml`, label files |
| Blur detection algorithm | FFT-based sharpness | OpenCV Laplacian variance | `cv2.Laplacian(gray, cv2.CV_64F).var()` is one line, fast, well-calibrated |

**Key insight:** The Ultralytics `YOLO` class is the single integration point for train → export → predict. Bypassing it for any step (custom ONNX, custom TRT builder, custom augmentation) introduces correctness risk without benefit.

---

## Common Pitfalls

### Pitfall 1: TensorRT Engine Is Not Portable

**What goes wrong:** The `.engine` file trained/exported on the GPU host (or a different Jetson) is copied to the Orin and causes crash or silent wrong results at inference time.
**Why it happens:** TensorRT optimizes for the exact GPU SM architecture and TRT version on the target device. Mismatches are not always caught with a clear error.
**How to avoid:** Always run `export_engine.py` ON the Orin after copying `corn_detector.pt`. The PT file is portable; the engine file is not.
**Warning signs:** `RuntimeError: CUDA error` on first `model.predict()` call, or detection results are all zeros.

### Pitfall 2: `data.yaml` Path Mismatch Breaks Training

**What goes wrong:** Roboflow download writes absolute paths into `data.yaml`. Training on a different machine or after moving the dataset directory fails with FileNotFoundError.
**Why it happens:** Roboflow SDK writes `train:`, `val:`, `test:` as absolute paths by default.
**How to avoid:** After `rf.download()`, rewrite `data.yaml` path values to be relative: `train: images/train`, `val: images/val`. Or always train from the exact download directory.
**Warning signs:** `FileNotFoundError: [Errno 2] No such file or directory` immediately on `model.train()`.

### Pitfall 3: Buffer Zone in Pixels Not Calibrated to Physical Distance

**What goes wrong:** `buffer_radius_inches = 3.0` is set in the INI but the pixel conversion uses a wrong assumed FOV, so the buffer is either too small (corn gets hit) or so large half the row is suppressed.
**Why it happens:** The camera FOV in inches at ground-level varies by mounting height, lens focal length, and resolution. It is NOT a universal constant.
**How to avoid:** Measure the actual ground FOV width for the OWL camera mount at its installed height. Set `camera_fov_inches` in INI to match. Verify with a tape measure in the field.
**Warning signs:** Actuator never fires (buffer too large) or corn is struck despite detections showing it correctly.

### Pitfall 4: Frame Logging Fills Storage During Long Runs

**What goes wrong:** Every frame is logged as a JPEG during a 4-hour field run at 15 FPS → ~216,000 images → tens of GB consumed.
**Why it happens:** The log_detection extension saves every frame unconditionally.
**How to avoid:** Add a `log_every_N_frames` config parameter (e.g., log 1 in 30). Implement dated subdirectory rotation with a `max_log_days` purge on startup (mirror the `purgeOld()` pattern from Phase 04).
**Warning signs:** Disk full alarm mid-run, or `cv2.imwrite()` silently returns False.

### Pitfall 5: Confidence Threshold Too Low Causes Corn-as-Weed Misclassifications

**What goes wrong:** Model returns a corn detection at 0.45 confidence. Per the locked decision, sub-threshold results should be treated as corn (protect). But if the threshold is set to 0.4 in the INI, those detections ARE used, and the label field from the model is "weed" — wrong outcome.
**Why it happens:** Conflation of model confidence threshold (what YOLO passes to NMS) with the safety policy (treat uncertain = corn).
**How to avoid:** Run model at the configured confidence threshold. Separately, detections below threshold are NOT returned by YOLO at all (NMS drops them). The safety policy means: if YOLO returns no corn detection in an area, assume corn is there and buffer conservatively. This is implemented in the actuator decision, not by lowering the threshold.
**Warning signs:** Corn rows show unexplained weed actuations near detected corn bboxes.

### Pitfall 6: V2-V6 Stage Validation Is Not Automated

**What goes wrong:** The model is deployed in V7+ fields where canopy closure changes appearance drastically, causing high false negative rates on corn.
**Why it happens:** The growth stage constraint is a human/operational guardrail, not something the model can self-check.
**How to avoid:** Add a `vstage_warning` config field and log a startup warning if the date is past the expected V6 window for the farm's planting date. This is a soft reminder, not a hard stop.

---

## Code Examples

Verified patterns from official sources:

### Training a YOLOv8 Nano Model

```python
# train_corn.py — runs on GPU host (NOT on Orin)
# Source: https://docs.ultralytics.com/usage/python/

from ultralytics import YOLO

model = YOLO("yolov8n.pt")  # start from COCO pretrained nano weights

results = model.train(
    data="training/dataset/data.yaml",
    epochs=100,
    imgsz=640,
    batch=16,
    # Augmentation overrides for field robustness
    hsv_h=0.015,      # default
    hsv_s=0.7,        # default
    hsv_v=0.4,        # default — captures dawn/dusk brightness variation
    degrees=10.0,     # row-mounted camera sees slight pitch variation
    scale=0.5,        # crop/zoom augmentation
    fliplr=0.5,       # horizontal flip — corn is symmetric
    flipud=0.0,       # DO NOT flip vertically — sky/ground orientation matters
    mosaic=1.0,       # 4-image mosaic helps small object detection
    mixup=0.1,        # light mixup for generalization
    blur=0.01,        # add blur augmentation (albumentations, if installed)
    project="runs/corn_detect",
    name="yolov8n_corn_v1",
    device=0          # CUDA GPU
)

# Best weights at: runs/corn_detect/yolov8n_corn_v1/weights/best.pt
```

### Exporting to TensorRT (Run on Orin)

```python
# export_engine.py — runs ON the Jetson Orin
# Source: https://docs.ultralytics.com/modes/export/ and https://wiki.seeedstudio.com/YOLOv8-TRT-Jetson/

from ultralytics import YOLO

model = YOLO("models/corn_detector.pt")

model.export(
    format="engine",
    half=True,       # FP16 — ~26ms/frame on Orin Nano, safer than INT8 for crop protection
    imgsz=640,
    device=0
)
# Produces: models/corn_detector.engine
```

### Roboflow Dataset Download

```python
# Source: https://docs.roboflow.com/datasets/download-a-dataset

from roboflow import Roboflow

rf = Roboflow(api_key="YOUR_API_KEY")  # set via env var ROBOFLOW_API_KEY, not hardcoded
project = rf.workspace("whughesfarms").project("corn-weed-detection")
version = project.version(1)
dataset = version.download("yolov8")  # downloads to ./corn-weed-detection-1/

# Fix absolute paths in data.yaml after download (see Pitfall 2)
```

### data.yaml Format for Binary Classification

```yaml
# training/dataset/data.yaml
# Source: Ultralytics YOLOv8 format per Roboflow export

path: .          # relative to where training script runs
train: images/train
val: images/val
test: images/test

nc: 2
names:
  0: corn
  1: weed
```

### INI Config Extension for ConfigValidator

The existing `config_manager.py` `REQUIRED_CONFIG` dict must be extended to recognize `algorithm = corn` as valid and add new sections:

```python
# In ConfigValidator:

VALID_ALGORITHMS = {'exg', 'exgr', 'maxg', 'nexg', 'exhsv', 'hsv', 'gndvi', 'gog', 'corn'}  # add 'corn'

REQUIRED_CONFIG['CornDetector'] = {
    'required_keys': {'model_path', 'confidence'},
    'optional_keys': {'blur_threshold', 'brightness_min'}
}

REQUIRED_CONFIG['StemAvoidance'] = {
    'required_keys': {'buffer_radius_inches', 'camera_fov_inches'},
    'optional_keys': set()
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SSD MobileNet TFLite via pycoral (EdgeTPU) | YOLOv8n via Ultralytics + TensorRT | ~2023 | YOLOv8 is 2-5x more accurate on small objects; no Edge TPU required |
| Manual annotation in CVAT/LabelImg | Roboflow with auto-label assist + web UI | ~2022 | 5-10x faster annotation; built-in dataset versioning and augmentation |
| GreenOnBrown HSV heuristic | YOLOv8n binary classifier (corn/weed) | This phase | Eliminates color-based false positives; handles corn stem visual context |
| FP32 PyTorch inference | TensorRT FP16 | JetPack 5+ | 2-5x speedup on Orin; 26ms/frame FP16 vs ~60ms FP32 |

**Deprecated/outdated:**
- `pycoral` / `make_interpreter` / `run_inference`: The existing `greenongreen.py` imports these for EdgeTPU. The `CornDetector` replacement does NOT use pycoral — it uses `ultralytics.YOLO`. The pycoral path can be retained for backward compat but is not used by the `corn` algorithm.
- `filter_id=63` in `GreenOnGreen.inference()`: This was a COCO class filter for the generic SSD model. The new binary model has no such filter — class 0 is corn, class 1 is weed.

---

## Existing Codebase Integration Points

These are the specific files in `owl-orin/` that this phase touches:

| File | Change Type | What Changes |
|------|-------------|--------------|
| `utils/config_manager.py` | Extend | Add `'corn'` to `VALID_ALGORITHMS`; add `[CornDetector]` and `[StemAvoidance]` to `REQUIRED_CONFIG` |
| `owl.py` `hoot()` | Extend | Add `elif algorithm == 'corn':` branch that instantiates `CornDetector` and calls buffer zone filter before relay actuation |
| `utils/log_manager.py` | Extend | Add `frame` parameter to `log_detection()` and save JPEG to `logs/frames/` |
| `config/CORN_DETECT.ini` | Create new | New INI with `[CornDetector]`, `[StemAvoidance]` sections |
| `utils/corn_detector.py` | Create new | `CornDetector` class wrapping `ultralytics.YOLO` |
| `utils/stem_avoidance.py` | Create new | Buffer zone geometry; `filter_weeds_for_actuation()` |
| `utils/frame_quality.py` | Create new | Laplacian blur + darkness check; returns `(ok, reason)` |
| `training/train_corn.py` | Create new | Training script (GPU host only) |
| `training/export_engine.py` | Create new | TensorRT export script (Orin only) |
| `requirements.txt` (Orin) | Extend | Add `ultralytics>=8.3.0` |
| `non_rpi_requirements.txt` (dev) | Extend | Add `ultralytics>=8.3.0 roboflow>=1.1 albumentations>=1.4` |

**Key constraint from existing code:** The `hoot()` loop uses `weed_centres` (list of `[cx, cy]`) as the return from `inference()`. The `CornDetector` should return `corn_centers` in the same position in the tuple to minimize `owl.py` changes. The actuator decision logic then runs buffer zone filtering before passing to `relay_controller.receive()`.

---

## Discretion Recommendations (Claude's Decision Areas)

### Confidence Threshold
**Recommend 0.75.** Agricultural YOLOv8 deployments targeting safety-critical suppression decisions commonly use 0.70-0.80. Below 0.70 risks false weed classification of corn in partial occlusion. Above 0.80 may miss small corn seedlings at V2. Start at 0.75; tune after first field validation run using logged frames.

### Synthetic Data Generation
**Recommend Roboflow's built-in synthetic augmentation first.** Roboflow offers background swap and copy-paste augmentation in-platform. This is faster than setting up Blender-based procedural generation (which showed a 10% sim-to-real gap in 2025 research). Use Roboflow's augmentations during dataset version creation, then supplement with real OWL-captured frames during actual field data collection passes (disable_detection mode in existing OWL).

### TensorRT Optimization Parameters
**Recommend FP16 (`half=True`), not INT8.** FP16 on Orin Nano achieves ~26ms/frame (38 FPS) per 2025 benchmark data. INT8 saves ~3ms but requires calibration data and risks ~1% mAP drop — unacceptable for a crop-protection safety boundary. Use `imgsz=640` (default). Workspace is handled automatically by Ultralytics export.

### Detection Logging Storage Format
**Recommend:** JSONL for detection metadata (extending existing `detections.jsonl`), JPEG at quality=85 for frames saved to `logs/frames/YYYY-MM-DD/frame_{:08d}.jpg`. Add `image_path` field to existing detection dict. Rotation: purge frame directories older than 14 days on startup (configurable via `log_frame_retention_days` in INI). Log every Nth frame, not every frame — recommend `log_frame_every = 30` (1 per second at 30 FPS).

### Augmentation Parameters
**Recommend these overrides from Ultralytics defaults:**
- `degrees=10.0` (default is 0.0) — row-mounted cameras have slight pitch variation
- `flipud=0.0` — keep at 0; vertically flipped corn makes no field sense
- `fliplr=0.5` — keep default; corn is symmetric left-right
- `hsv_v=0.5` — increase from default 0.4 to capture dawn/dusk brightness range
- `blur=0.01` — enable via albumentations for lens contamination simulation
- All others: keep Ultralytics defaults (mosaic=1.0, scale=0.5)

---

## Open Questions

1. **Camera FOV calibration for buffer zone pixel conversion**
   - What we know: `buffer_radius_inches` is configurable in INI; pixel conversion requires `camera_fov_inches` at actual mounting height
   - What's unclear: The OWL's current mounting height and lens specs are not documented in the codebase
   - Recommendation: Add a field calibration step (place tape measure in frame, verify FOV measurement) before first production run; document measured value in CORN_DETECT.ini comments

2. **Jetson Orin JetPack version on the actual device**
   - What we know: TensorRT export requires JetPack 5.1.1+; `ultralytics` requires JetPack 5+ for CUDA support
   - What's unclear: The actual installed JetPack version on the farm's Orin is not confirmed in project docs
   - Recommendation: Run `cat /etc/nv_tegra_release` on the Orin before starting; if below JetPack 5.1.1, upgrade before proceeding

3. **`non_rpi_requirements.txt` is for development — does the Orin use a venv or system Python?**
   - What we know: `owl.py` checks for `VIRTUAL_ENV`; setup docs reference `workon owl`
   - What's unclear: Whether the Orin runs in the same virtualenv setup as the Pi, or a separate conda/venv
   - Recommendation: Verify virtualenv name on Orin; ensure `ultralytics` installs into that env, not system Python

4. **Frame log write performance at inference speed**
   - What we know: `cv2.imwrite()` for 640x480 JPEG at q=85 is typically <5ms
   - What's unclear: Whether the Orin's storage (SD card vs NVMe vs SanDisk USB) can sustain the I/O at even 1 FPS log rate
   - Recommendation: Implement log_manager frame write on the existing background `_process_detection_queue` thread (already async) to avoid blocking inference loop

---

## Sources

### Primary (HIGH confidence)

- Ultralytics docs — `https://docs.ultralytics.com/modes/export/` — TensorRT export parameters, FP16/INT8 options
- Ultralytics docs — `https://docs.ultralytics.com/usage/cfg/` — Augmentation hyperparameter defaults (hsv_h, degrees, flipud, etc.)
- Ultralytics docs — `https://docs.ultralytics.com/usage/python/` — YOLO Python API: train, predict, export
- Roboflow docs — `https://docs.roboflow.com/datasets/download-a-dataset` — YOLOv8 format download
- Seeed Studio Wiki — `https://wiki.seeedstudio.com/YOLOv8-TRT-Jetson/` — JetPack 5.1.1+ requirement; FP16 export command on Jetson
- OWL codebase (read directly): `owl.py`, `utils/greenongreen.py`, `utils/log_manager.py`, `utils/config_manager.py`, `actuator.py`, `detector.py`

### Secondary (MEDIUM confidence)

- arxiv 2025 paper `https://arxiv.org/pdf/2502.15737` — YOLOv8n INT8=23ms, FP16=26ms benchmark on Orin Nano (peer-reviewed, 2025)
- Springer 2025 — `https://link.springer.com/article/10.1007/s11554-025-01742-7` — YOLOv8-GAS corn-weed detection; augmentation strategy findings
- arxiv Nov 2025 — `https://arxiv.org/abs/2511.02417` — Synthetic crop-weed image generation; Blender pipeline; 10% sim-to-real gap finding
- PyImageSearch — blur detection via Laplacian variance (established method, widely reproduced)

### Tertiary (LOW confidence)

- WebSearch community reports: `filter_id=63` in existing `greenongreen.py` is COCO "broccoli" class — inferred from COCO label map, not verified from OWL commit history

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Ultralytics, Roboflow, OpenCV are official packages with current docs
- Architecture: HIGH — Based on direct reading of OWL codebase; integration points are concrete
- TensorRT FP16 performance on Orin: MEDIUM — Based on 2025 peer-reviewed benchmark; exact ms may vary by Orin model variant (Nano vs NX)
- Synthetic data approach: MEDIUM — Based on 2025 research; sim-to-real gap finding is from one paper
- Buffer zone calibration: LOW — Physical FOV is not documented in OWL; requires field measurement

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (Ultralytics releases frequently; re-check TRT export API if using a new ultralytics version)
