# Phase 46: Field Pass Logger - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators confirm planned field passes and add unplanned passes from their phones in the field. Confirmations write to organic-cert's FieldOperation table with `plannedSource: "mobile-logger"` for NOP 3-year audit history. This phase builds on top of Phase 45's crop plan viewer and pass checklist.

</domain>

<decisions>
## Implementation Decisions

### Confirmation Interaction
- Tap checkbox to confirm — instant confirm, no intermediate sheet
- Defaults to today's date and logged-in user (no picker on confirm)
- Brief undo toast (~5 seconds) after confirming — cancel window before write commits
- Tap a confirmed pass to edit date/operator after the fact (e.g., backdating yesterday's pass)

### Unplanned Pass Flow
- Floating action button (FAB) in bottom-right to add unplanned passes
- Field pre-selected from current view (changeable if needed)
- Minimal form: operation type (dropdown) + date (default today) + optional notes
- Operator auto-filled from logged-in user, field auto-filled from current view
- Operation type is a fixed list: Tillage, Planting, Herbicide, Fertilizer, Harvest, Scouting, Other

### Operator Selector
- Each operator logs in with their own Supabase account — identity comes from auth
- Operator can confirm on behalf of someone else via override picker
- Override picker shows all users with operator/agronomist/admin roles from Supabase profiles
- Always resets to logged-in user after each confirmation (no "sticky" override)

### Pass List Presentation
- Status differentiation: green check (confirmed), gray unchecked (planned/pending), blue badge (unplanned)
- Each row shows: operation type + confirmation date (or dash) + operator name
- Progress bar at top of each field's pass list ("3 of 7 passes complete")
- Sorted by agronomic operation sequence (Tillage → Planting → Herbicide → Fertilizer → Scouting → Harvest), not chronological
- Unplanned passes appear inline in the list with blue badge, sorted by their operation type within the sequence

### Claude's Discretion
- Exact styling/spacing of pass rows and progress bar
- Bottom sheet implementation details for editing confirmed passes
- Toast/snackbar library choice and animation
- FAB positioning relative to mobile safe areas
- How "Other" operation type sorts in the sequence

</decisions>

<specifics>
## Specific Ideas

- Confirmation should be as fast as possible — operators have gloved hands and are in the field
- The undo toast pattern (like Gmail's undo send) is the safety net instead of confirmation dialogs
- Agronomic sequence order matches the natural farming flow operators already think in

</specifics>

<deferred>
## Deferred Ideas

- **Geofenced auto-prompting** — Track operator GPS location, detect when they enter a field boundary and stay 5+ minutes, then prompt to confirm a field pass. Requires GPS tracking, geofence boundaries from shapefiles, background location permissions, and battery management. New capability for a future phase.
- Photo attachment on passes — would need Supabase Storage (noted in v9.0 vision as deferred)
- Push notifications — requires VAPID setup (noted in v9.0 vision as deferred)

</deferred>

---

*Phase: 46-field-pass-logger*
*Context gathered: 2026-03-25*
