# Phase 5: Corn-specialized weed detection with stem avoidance training - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Train and deploy a corn-specialized weed detection model for the OWL inter-row actuator system. The model distinguishes corn stems from weeds so the actuator knows when to retract (protect corn) vs extend (kill weeds). Covers training data pipeline, model training, stem avoidance logic, and detection logging. Does NOT include new actuator hardware, new crop types beyond corn, or portal integration.

</domain>

<decisions>
## Implementation Decisions

### Training data strategy
- Synthetic + real images combined for training dataset
- Real captures from both OWL-mounted camera (production angle) and phone/handheld (quick augmentation)
- Bounding box annotation (not segmentation masks)
- Roboflow for labeling and dataset management
- Export in format compatible with YOLOv8

### Stem avoidance behavior
- Fixed buffer zone radius around each detected corn stem
- Buffer radius configurable via INI config file (buffer_radius_inches parameter) — adjustable per field or crop stage without retraining
- Weeds detected inside the buffer zone are skipped entirely — crop protection always takes priority over weed kill rate
- Low-confidence detections (below threshold) treated as corn — when in doubt, protect it

### Detection scope
- Binary classification: corn vs not-corn (everything not corn is a target)
- Protect all corn-looking plants regardless of position — no volunteer corn removal
- YOLOv8 nano architecture for inference on Jetson Orin (TensorRT export)
- Training on cloud/desktop GPU, deploy optimized model to Orin for inference only

### Field condition handling
- Target growth stages: early season only (V2-V6) — when mechanical weed control is most effective
- Poor visibility (heavy shadow, dawn/dusk, lens obstruction): pause actuation and alert operator — no blind actuation
- Heavy data augmentation during training: brightness, contrast, shadow, blur, rotation for field robustness
- Log every detection with full image frame and bounding boxes for post-run review and model refinement

### Claude's Discretion
- Exact confidence threshold value (e.g., 70% vs 80%)
- Synthetic data generation approach and tooling
- TensorRT optimization parameters
- Detection logging storage format and rotation policy
- Exact augmentation parameters and ratios

</decisions>

<specifics>
## Specific Ideas

- OWL already has an SSD MobileNet TFLite model in the codebase — YOLOv8 nano replaces this for corn-specific detection
- Existing JSONL detection logging in owl-orin should be extended (not replaced) to include image frames
- The feathered actuator physics from v1.0 simulation maps to real-world actuator timing — buffer zone works with this
- Roboflow's auto-labeling assist can speed up initial annotation of large capture batches

</specifics>

<deferred>
## Deferred Ideas

- Multi-crop support (soybeans, wheat, etc.) — future phase per crop type
- Specific weed species identification — could be layered on later for agronomic reporting
- Position-aware volunteer corn removal — requires row position tracking not yet in OWL
- Full-season detection (V6 through tassel/canopy closure) — separate training effort

</deferred>

---

*Phase: 05-corn-specialized-weed-detection-with-stem-avoidance-training*
*Context gathered: 2026-03-23*
