# Phase 72: Acreage Reconciliation Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 72-acreage-reconciliation-tool
**Areas discussed:** Data source, Visual representation, Layer model, Scope of operations, Portal location, Phase scope, n8n role, FieldView API status, Design language, RMA unit numbers

---

## Initial Phase Concept

Phase 72 was initially conceived as "As-Applied Data Overlay" on the existing field map. The user interrupted the initial gray area questions to provide a complete specification, reframing the phase entirely.

**User's freeform spec (key points):**
- "The compliance app" must ingest three data sources and produce reconciled crop insurance reporting outputs
- Automated overlay is the fast path, but full manual control is mandatory — "anything a person could do with a paper map and pencil"
- Stack: Next.js 14 + Supabase/PostGIS + Vercel + n8n; MapLibre or Leaflet with draw plugin; spatial ops in PostGIS
- Three sources: FSA CLU shapefiles, Glomalin farm registry, FieldView API as-planted
- Acreage thresholds: Green ±2%/±0.5ac, Yellow 2–5%/0.5–2.0ac, Red >5%/>2.0ac (all configurable)
- Manual ops: select, split CLU, merge CLU, draw from scratch, manual acreage override
- RMA output schema fully specified
- Three outputs: map overlay, tabular report, output .shp
- Design: specified as navy/cyan but then deferred to separate conversation

---

## Portal Location

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade Acreage tab in /app/compliance | Extends Phase 68 compliance hub — no new nav entry | ✓ |
| New top-level module /app/acreage-report | Standalone sidebar entry | |
| New module inside /app/maps | Reconciliation mode as a map toggle | |

**User's choice:** Upgrade the Acreage tab in /app/compliance (Recommended)
**Notes:** Keeps the Phase 68 ComplianceShell, tab routing, and shared farm/crop filter intact. Only the Acreage tab content is replaced.

---

## Phase Scope

| Option | Description | Selected |
|--------|-------------|----------|
| One phase, multiple plans | 4–6 sequential plans, ships together | ✓ |
| Split into sub-phases | Phase 72 = engine, 73 = editor, 74 = outputs | |

**User's choice:** One phase, multiple plans (Recommended)
**Notes:** Automated path and manual editor ship together — manual is not a stretch goal.

---

## n8n Role

| Option | Description | Selected |
|--------|-------------|----------|
| FieldView sync scheduling only | Nightly/on-demand FieldView → Supabase; portal routes handle rest | ✓ |
| Full ingest orchestration | n8n handles FieldView + FSA shapefile processing | |
| Skip n8n — portal API routes only | Next.js API routes + Vercel cron, no orchestrator | |

**User's choice:** FieldView sync scheduling only (Recommended)
**Notes:** Researcher to confirm n8n availability on VPS droplet; Vercel cron is the fallback.

---

## Design Language

| Option | Description | Selected |
|--------|-------------|----------|
| This module gets its own design identity | Navy/cyan distinct from amber/earth portal palette | |
| Portal-wide rebrand starting here | First module in navy/cyan direction | |
| You decide | Pick what keeps scope cleanest | |

**User's choice:** "disregard. doing design spec in another convo"
**Notes:** Design specification being handled separately. Phase 72 inherits current portal design system until that spec is provided.

---

## FieldView API Status

| Option | Description | Selected |
|--------|-------------|----------|
| Live — OAuth configured | Connection active, data coming in | |
| Stubbed / not yet connected | Routes exist but OAuth not configured | ✓ |
| Partially — DAT works, API sync doesn't | DAT upload works, automated API pull not connected | |

**User's choice:** Stubbed / not yet connected
**Notes:** DAT file upload works. Phase 72 includes establishing the live FieldView OAuth connection.

---

## RMA Unit Numbers

| Option | Description | Selected |
|--------|-------------|----------|
| User enters manually | AIP/agent assigns; tool provides entry field per unit | ✓ |
| Auto-generate from farm#/tract#/CLU | Tool derives unit number as default, user can override | |
| Out of scope — leave blank | Agent adds unit numbers when processing shapefile | |

**User's choice:** User enters them manually (Recommended)
**Notes:** RMA unit numbers are assigned by the AIP/crop insurance agent, not the grower. Tool provides an editable field per reporting unit.

---

## Claude's Discretion

- MapLibre GL Draw vs Leaflet + Leaflet.draw — researcher evaluates against Phase 70's existing MapLibre infrastructure
- PostGIS spatial index strategy
- n8n workflow structure vs Vercel cron fallback — whichever is confirmed available on VPS
- Supabase schema for reconciliation records table (beyond RMA schema minimum)
- FieldView API rate limits and caching strategy

## Deferred Ideas

- 3D terrain / panopticon rendering — long-term vision in FIELD-MAP-VISION.md
- Design language migration (navy/cyan portal-wide) — separate design conversation
- RMA unit number auto-generation — deferred; manual entry for now
- Basemap style toggle, full-screen mode — still deferred from Phase 70
