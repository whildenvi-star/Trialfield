---
name: Enterprise budgets are the forecast source of truth
description: Farm-budget enterprise/field data is the single source of truth for all downstream app forecasts — seed-inventory, reconciliation, etc.
type: feedback
---

Enterprise budgets filled out at the field level are the source of truth for forecasting across the entire platform.

**Why:** The user's workflow is: set up enterprise programs (templates with default seed/inputs), assign fields to enterprises, then adjust hybrids/rates at the field level as needed. The field-level data IS the plan. All other apps (seed-inventory forecasts, reconciliation, organic-cert) must reflect those field-level totals — not independently maintained data.

**How to apply:**
- When debugging forecast mismatches, check farm-budget field data first — that's the source of truth
- Seed-inventory products/forecasts are derived from farm-budget via sync, never manually authoritative
- Enterprise program defines the template; field-level overrides (e.g. different hybrid) are expected and correct
- Rollup totals (acres, units needed per variety/input) should always be summed from field-level entries in farm-budget
- If downstream data disagrees with farm-budget fields, the downstream data is wrong
