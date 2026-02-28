# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.
**Current focus:** Milestone v1.1 — Split-Field Enterprises

## Current Position

Phase: 6 of 7 (Multi-Enterprise Field Views)
Plan: 2 of 2 complete
Status: Phase 6 complete — both plans executed
Last activity: 2026-02-28 — Phase 6, Plan 02 complete (enterprise form label/fallow fields, breadcrumb navigation)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1.0 decisions archived to milestones/v1.0-ROADMAP.md.

**Phase 5, Plan 01 decisions (2026-02-27):**
- Use label String? (nullable) not required — single-enterprise fields keep working with label=null, no migration needed
- Use isFallow Boolean @default(false) not an enum — binary distinction is simpler, avoids enum migration complexity
- Fallow enterprises store acreage in plantedAcres — acre math consistent (sum of all enterprise plantedAcres = total allocated)
- Partial unique index FieldEnterprise_no_label_unique needed — PostgreSQL treats NULL as distinct in unique constraints

**Phase 5, Plan 02 decisions (2026-02-27):**
- Over-allocation: yellow warning (acreWarning string), saves allowed — not blocked
- acreUtilization only on fields with 2+ enterprises in current crop year; single-enterprise gets null
- generateLotNumber label suffix: strip non-alphanumeric, 4-char uppercase — "North 40" -> "NORT"
- PUT route regenerates lotNumber whenever label, crop, or cropYear changes in the update body

**Phase 6, Plan 01 decisions (2026-02-28):**
- Enterprise count computed client-side from enterprises array filtered by current crop year
- Multi-enterprise season cards show consolidated header with EnterpriseRow components, not inline timeline
- Single-enterprise seasons render exactly as before for backward compatibility
- EnterpriseRow drill-down uses window.location.href to /field-enterprises/{id}
- Fallow enterprises shown with italic/muted styling in enterprise rows

**Phase 6, Plan 02 decisions (2026-02-28):**
- Use Switch component for fallow toggle (cleaner UX than checkbox for boolean toggle)
- Fallow enterprises send crop="Fallow" to API (required field in schema)
- Save & Add Another preserves fieldId and cropYear while clearing other fields
- Breadcrumb links to /fields/{id}/history not /fields/{id} for direct access to enterprise list

### Pending Todos

1. Work on grain ticket system enhancements (general) — TBD scope

### Blockers/Concerns

- CNH FieldOps staging API has no audience registered — mock data mode active. Need production credentials or staging audience from CNH support.

## Session Continuity

Last session: 2026-02-28
Stopped at: Phase 6 complete — all plans executed (Plan 01 field views + Plan 02 enterprise form)
Resume file: .planning/phases/06-multi-enterprise-field-views/06-02-SUMMARY.md
