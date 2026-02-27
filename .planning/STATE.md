# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** A farm manager can pull Case IH field data and hand an inspector a complete, print-ready audit report with zero manual data entry.
**Current focus:** Milestone v1.1 — Split-Field Enterprises

## Current Position

Phase: 5 of 7 (Split-Field Schema & Acre Reconciliation)
Plan: 1 of 2 complete
Status: In progress — Plan 01 complete, Plan 02 pending
Last activity: 2026-02-27 — Phase 5, Plan 01 complete (schema evolution)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
v1.0 decisions archived to milestones/v1.0-ROADMAP.md.

**Phase 5, Plan 01 decisions (2026-02-27):**
- Use label String? (nullable) not required — single-enterprise fields keep working with label=null, no migration needed
- Use isFallow Boolean @default(false) not an enum — binary distinction is simpler, avoids enum migration complexity
- Fallow enterprises store acreage in plantedAcres — acre math consistent (sum of all enterprise plantedAcres = total allocated)
- Partial unique index FieldEnterprise_no_label_unique needed — PostgreSQL treats NULL as distinct in unique constraints

### Pending Todos

1. Work on grain ticket system enhancements (general) — TBD scope

### Blockers/Concerns

- CNH FieldOps staging API has no audience registered — mock data mode active. Need production credentials or staging audience from CNH support.

## Session Continuity

Last session: 2026-02-27
Stopped at: Phase 5, Plan 01 complete — ready for Plan 02
Resume file: .planning/phases/05-split-field-schema-acre-reconciliation/05-01-SUMMARY.md
