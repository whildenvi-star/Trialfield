---
status: resolved
trigger: "farm-budget-rent-rate-calculation"
created: 2026-03-29T00:00:00Z
updated: 2026-03-29T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. Rent rate is calculated using registry.reportingAcres as denominator, but the correct denominator is the sum of all farm-budget field acres that map to the same registry farm.
test: Implemented fix in server.js sync-registry and field-editor.js
expecting: Rate = totalRentDollars / (sum of all budget field acres for that registry farm)
next_action: Apply and verify fix

## Symptoms

expected: Rental rate = Total gross rent / Total crop acres for that farm (summed across ALL enterprises). Example: $10,000 gross rent, field has 80ac soybeans + 19ac corn = 99 total crop acres. Rate = $10,000/99 = $101.01/ac for BOTH enterprises. The gross rent number comes from the farm registry page.
actual: Enterprises are getting wrong rental rates. Gesserts, Kopps, and Omni farms are "losing hundreds of dollars" - suggesting rent is being divided by individual enterprise acres rather than total crop acres across all enterprises for that farm.
errors: No explicit error messages — the numbers just come out wrong.
reproduction: 1. Have a farm with multiple enterprises (e.g., corn + soybeans). 2. Each enterprise has field entries for the same farm. 3. Check the rental rate shown per enterprise. 4. Bug: rate uses only that enterprise's acres, not total crop acres for the farm
timeline: Recurring issue ("again") — has been broken before
farms_affected: Gesserts, Kopps, Omni

## Eliminated

- hypothesis: Rate divided by per-enterprise acres only (isolation bug)
  evidence: Code shows rate = totalRentDollars / registryField.reportingAcres, applied uniformly to all matching fields
  timestamp: 2026-03-29

## Evidence

- timestamp: 2026-03-29
  checked: farm-budget/server.js:744-749 (sync-registry endpoint)
  found: rate = Math.round((match.totalRentDollars / match.reportingAcres) * 100) / 100 — uses registry reportingAcres as denominator
  implication: denominator is always the full registry-defined acreage, not the sum of farm-budget crop acres

- timestamp: 2026-03-29
  checked: farm-budget/public/field-editor.js:184, 252, 1095 (autocomplete and manual sync)
  found: Same formula: rate = totalRentDollars / regField.reportingAcres
  implication: All client-side paths also use registry acres as denominator

- timestamp: 2026-03-29
  checked: farm-registry/data/data.json for Omni
  found: Omni registry = 440ac, $120,304.80 total rent. Farm-budget has OMNI BIG SOUTH (320ac) + Omni GRASSY KNOLL (90ac) = 410ac total
  implication: Current rate = 120304.80/440 = $273.42/ac. Total allocated = 410 * 273.42 = $112,102.20. MISSING $8,202.60 from budget.

- timestamp: 2026-03-29
  checked: farm-registry/data/data.json for Kopp
  found: Kopp registry = 218ac. Farm-budget: Kopp Seed Corn (90ac) + Kopp Soybeans (128ac) = 218ac. Acres match exactly.
  implication: Kopp is fine (registry and budget acres match). Gap only appears when registry acres != budget-tracked acres.

- timestamp: 2026-03-29
  checked: farm-registry/data/data.json for Gessert
  found: Gessert registry = 364.8ac (aliases: Gessert, Gessert East, Gessert west). Farm-budget: Gessert East 250 (250ac) + Gessert west 111 (111ac, DBL CROP) = 361ac unique. Stored rentPerAcre = 140.91 (which is half of 281.81 — suggesting manual adjustment for DBL CROP).
  implication: Gap of 3.8ac between registry and budget. Minor but same root cause.

## Resolution

root_cause: In farm-budget/server.js sync-registry and field-editor.js client-side sync paths, the rent rate denominator was `registryField.reportingAcres` (the registry's total acre count for the farm). When a registry farm is split across multiple farm-budget enterprise entries whose combined acres differ from registry total, the per-acre rate is wrong. For Omni: 440 registry ac vs 410 budget ac → old rate $273.42/ac → $8,202 of gross rent lost from budget. The correct denominator is the sum of all budget field acres resolving to the same registry farm.
fix: |
  1. server.js sync-registry: Added pre-pass to build totalBudgetAcresForRegField map. Non-split fields use this sum as denominator. Split groups now use allocatedAcres as denominator (was registryReportingAcres).
  2. server.js: New GET /api/fields/rent-rate endpoint. Accepts registryFieldId or name (with prefix fallback matching), sums budget field acres via prefix matching + name-deduplication (handles DBL CROP), returns prorated rate.
  3. field-editor.js: All 3 rent sync paths (autocomplete onSelect, populateForm auto-apply, manual sync button) now call /api/fields/rent-rate instead of computing totalRentDollars/reportingAcres directly.
verification: |
  Omni: OLD $273.42/ac (410ac → $112,102 of $120,305 gross rent = $8,202 lost)
        NEW $293.43/ac (410ac → $120,306 ≈ $120,305 gross rent, rounding diff $1.50 only) ✓
  Gessert: OLD $281.81/ac, NEW $284.78/ac (361 unique ac of 364.8 registry) ✓
  Kopp: unchanged $270.15/ac (split sub-fields, 218ac = 218 registry ac) ✓
files_changed:
  - farm-budget/server.js
  - farm-budget/public/field-editor.js
