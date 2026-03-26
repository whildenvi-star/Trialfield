---
created: 2026-03-04T12:00:00.000Z
title: v4.0 scoping questions for user review
area: general
files: []
---

## Questions

These questions came up during autonomous v4.0 scoping. Review when back.

### 1. Grain ticket enhancements — is settlement closure the right focus?

The original todo "work on grain ticket system enhancements" was vague. I scoped it as **settlement reconciliation closure** (REC-01..04: configurable tolerances, fuzzy matching, dispute workflow, multi-buyer summary). Are there other grain-ticket improvements you wanted? Examples:
- Ticket status field (currently always blank in the Ticket Log)
- Better scan/OCR workflow
- Crop type category grouping in Farm Summary
- Something else entirely?

### 2. Seed/input inventory rework todo — consider it done?

The "rework seed & input inventory" todo was created 2026-03-03, BEFORE v3.0 shipped. v3.0 delivered most of it: Forecasts, Orders, Deliveries, 5 print reports, Seeds/Reference tabs, unit/pack system, day/night theme. The remaining gap is that the **Orders and Deliveries tabs are hidden** (display:none in HTML). I included unhiding them as BUD-03/BUD-04. Is there anything else from that original todo that v3.0 didn't cover?

### 3. Any other cross-module improvements?

I focused v4.0 on the 5 pending todos. Are there other improvements you've been thinking about across any module? Examples from the deferred list I did NOT include:
- Mobile-friendly responsive design
- Audit infrastructure (tamper-evidence, viewer, export)
- Photo evidence attachment
