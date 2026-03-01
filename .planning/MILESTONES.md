# Milestones

## v1.0 Data Ingestion & Reports (Shipped: 2026-02-26)

**Phases completed:** 4 phases, 11 plans
**Timeline:** 3 days (2026-02-24 → 2026-02-26)
**Stats:** 53 files changed, 11,287 insertions, 1,194 deletions

**Key accomplishments:**
- Case IH FieldOps API integration with OAuth2 client, Zod-validated normalizer, and mock data mode
- Admin sync hub with cmdk field matching, staged ops review, approve/reject workflow
- Field records with 3-year history timeline, season grouping, filter bar, and activity stats
- Manual entry forms (tillage, application, harvest) with equipment selector and batch entry
- Print-ready USDA NOP inspection reports as 8-section PDF (cover through mass balance)
- Synced harvest CropLot wiring with atomic lot creation and lot numbers in all reports

**Archive:** [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

---


## v1.1 Split-Field Enterprises (Shipped: 2026-03-01)

**Delivered:** A single physical field can carry multiple crop enterprises in the same season — split planting, double-cropping, and fallow tracking all reflected accurately in history views and PDF reports.

**Phases completed:** 5-8 (8 plans total)
**Timeline:** 3 days (2026-02-27 → 2026-03-01)
**Stats:** 10 files changed, 2,683 insertions, 77 deletions (~85K LOC TypeScript total)

**Key accomplishments:**
- Split-field schema: FieldEnterprise with label, isFallow, and fallow cost fields; composite unique constraint enabling multiple enterprises per field per season
- Acre reconciliation API: acreWarning on over-allocation, acreUtilization for multi-enterprise fields, fallow remainder calculation
- Multi-enterprise field views: consolidated field cards with enterprise count badge, drill-down season cards, breadcrumb navigation, enterprise creation with "Save & Add Another"
- PDF reports updated for split-field reality: parent+sub-row field list, enterprise-filtered history, labeled harvest and application logs, correct mass balance aggregation
- Fallow enterprise edit fix: openEdit() pre-fill and handleSave() serialization to prevent silent cost data loss (INT-01 closure)

**Git range:** `feat(05-01)` → `fix(08-01)` (10 commits in organic-cert)

**What's next:** TBD — grain ticket enhancements or next organic-cert feature milestone

**Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md) | [milestones/v1.1-MILESTONE-AUDIT.md](milestones/v1.1-MILESTONE-AUDIT.md)

---

