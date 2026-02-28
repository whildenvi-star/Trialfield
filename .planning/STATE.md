# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.
**Current focus:** Milestone v1.1 — Split-Field Enterprises

## Current Position

Phase: 7 of 7 (Split-Field PDF Reports)
Plan: 1 of 3 complete
Status: Phase 7 in progress — Plan 01 executed
Last activity: 2026-02-28 — Phase 7, Plan 01 complete (assembler enterprise identity fields, Field List split-field parent+sub-row rendering)

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

**Phase 7, Plan 01 decisions (2026-02-28):**
- formatFieldLabel utility placed in report-assembler.ts (not a pdf helper) — shared by Plans 02 and 03
- splitFieldYears computed from farm.fields (raw Prisma data) before the mapped fields array — same data, cleaner ordering
- Single-enterprise field-list path unchanged — exact backward compatibility preserved
- Sub-row column widths mirror parent row: label(25%), acres(15%), empty(15%), crop(20%), variety(25%)

### Pending Todos

1. Work on grain ticket system enhancements (general) — TBD scope

### Blockers/Concerns

- CNH FieldOps staging API has no audience registered — mock data mode active. Need production credentials or staging audience from CNH support.

## Session Continuity

Last session: 2026-02-28
Stopped at: Phase 7, Plan 01 complete — assembler + Field List split-field rendering done
Resume file: .planning/phases/07-split-field-pdf-reports/07-02-PLAN.md
