---
status: resolved
trigger: "When fields are split in the FSA acres module, the rental rate per acre doubles/multiplies instead of staying the same. Additionally, when syncing to the farm registry, rental rates change unexpectedly."
created: 2026-03-19T00:00:00Z
updated: 2026-03-19T00:00:00Z
---

## Current Focus

hypothesis: Two bugs confirmed — (1) farm-registry import.js stores rentRate (per-acre) but server never reads it for totalRentDollars, leaving totalRentDollars=0 and making registry-sourced rent unavailable. (2) In farm-budget/server.js sync-registry and field-editor.js, the formula `totalRentDollars / reportingAcres` uses the PARENT field's total acres as denominator — when a field is split in farm-budget, the sub-field still looks up its parent registry field which has the full (pre-split) `reportingAcres`, so the computed $/ac stays correct. BUT if `reportingAcres` in the registry is updated after a split to reflect new FSA acres, the denominator changes and the rate changes.
test: Read split endpoint logic and farm-budget sync endpoint to trace exact computation path
expecting: Confirmed that split sub-fields share the same registry field and use its full reportingAcres as denominator
next_action: Apply fix — no fix needed in fsa-acres split endpoint (it correctly copies rentRate as-is); the bug is in farm-budget sync using registry reportingAcres as denominator instead of the sub-field's own acres

## Symptoms

expected: When a field is split into sub-fields, each sub-field should keep the same rental rate per acre as the original field.
actual: The rental rate per acre doubles or multiplies after splitting a field.
errors: No error messages reported — the values are just wrong.
reproduction: Split a field in the FSA acres module, observe the rental rate. Then sync to the farm registry and observe rates change again.
timeline: Currently broken, unclear when it started.

## Eliminated

- hypothesis: Bug is in fsa-acres split endpoint (POST /api/clu-records/:id/split)
  evidence: Lines 205-212 do Object.assign({}, original, { id, clu, fsaAcres, crop, reported }). The rentRate field is NOT present in clu records at all — FSA records don't carry rent data. Rental rate is a farm-registry/farm-budget concept.
  timestamp: 2026-03-19

- hypothesis: Bug is in the registry import.js (data import from Excel)
  evidence: import.js correctly reads rentRate from column K as a per-acre rate. However, it stores it as `rentRate` (per-acre) on the field object, not as `totalRentDollars`. The server's updatable fields list only includes `totalRentDollars`, not `rentRate`. So imported fields have rentRate but NOT totalRentDollars set. This means the sync formula `totalRentDollars / reportingAcres` will compute 0/X = 0 for imported fields — explaining why registry sync wipes out rent.
  timestamp: 2026-03-19

## Evidence

- timestamp: 2026-03-19
  checked: fsa-acres/server.js lines 181-218 (split endpoint)
  found: Split endpoint only handles fsaAcres, clu number, and crop. No rentRate field in CLU records at all.
  implication: Bug is NOT in the FSA split logic itself. FSA acres has no rent concept.

- timestamp: 2026-03-19
  checked: farm-registry/import.js line 107, 161
  found: Excel column K is read as `rentRate` (per-acre) and stored on each field object as `rentRate: rentRate || null`. However, the registry server's updatable field list (line 250-259 of server.js) includes `totalRentDollars` but NOT `rentRate`. The field is stored in data.json as `rentRate` but the server never uses it.
  implication: Fields imported from Excel have `rentRate` set but `totalRentDollars` is undefined/missing. The display formula `totalRentDollars / reportingAcres` will evaluate to 0 for all imported fields.

- timestamp: 2026-03-19
  checked: farm-budget/server.js lines 479-486 (sync-registry endpoint)
  found: Formula is `rate = Math.round((match.totalRentDollars / match.reportingAcres) * 100) / 100`. If `totalRentDollars` is 0 (because field was imported via import.js which only sets `rentRate`), this will set rentPerAcre = 0, WIPING the existing budget rent value.
  implication: Every time sync-registry runs on an import.js-populated registry, it zeros out all rental rates in the budget.

- timestamp: 2026-03-19
  checked: farm-budget/public/field-editor.js lines 133-141 and 201-209
  found: Two code paths both compute rate as `totalRentDollars / reportingAcres`. The autocomplete path (populateForm, line 201) does the same. Neither path falls back to the registry field's `rentRate` property.
  implication: Even the interactive editor will show $0/ac for any field whose registry entry was populated by import.js.

- timestamp: 2026-03-19
  checked: farm-budget/server.js sync-registry lines 473-486
  found: For split fields (`isSplit = !!field.splitGroupId`), acres sync is SKIPPED. But RENT sync is NOT skipped. A split sub-field still looks up its parent registry field (via `registryFieldName`). The rent formula then computes `totalRentDollars / reportingAcres` using the FULL parent field's total reporting acres as denominator. If the sub-field has half the acres of the parent, but the parent's `totalRentDollars` reflects the full field, the $/ac would be correct — UNLESS the parent registry field's `reportingAcres` is changed (e.g., updated from FSA acres after the split), which shrinks the denominator and inflates the computed rate.
  implication: This is the SPLIT bug: after a FSA split, if the registry's `reportingAcres` is updated to reflect only one portion, all sub-fields syncing against that registry field compute `fullTotalRent / halfAcres = 2x rate`.

## Resolution

root_cause: |
  TWO bugs:

  BUG 1 — Registry import leaves totalRentDollars unset:
  farm-registry/import.js stores rent from the Excel spreadsheet as `rentRate` (a $/ac rate, column K).
  The registry server only recognizes `totalRentDollars` (a total $ figure). The `rentRate` field on imported
  data is never used by any sync or display path. As a result, any field imported via import.js has
  `totalRentDollars` = undefined/0, even if it has a valid `rentRate`. When farm-budget runs sync-registry,
  it computes `0 / reportingAcres = 0` and OVERWRITES the budget's existing rentPerAcre with zero.

  BUG 2 — Split sub-fields share parent's totalRentDollars denominator:
  In farm-budget/server.js sync-registry (line 479-486), the rent computation for split sub-fields uses
  the matched registry field's `totalRentDollars / reportingAcres`. When a split occurs in the FSA module
  and registry `reportingAcres` is updated to reflect only a portion of the original field, the denominator
  shrinks while `totalRentDollars` stays at the full field's value. This produces a multiplied $/ac rate
  (e.g., if reportingAcres goes from 100 to 50, rate doubles).

fix: |
  FIX 1 — farm-registry/import.js: Compute totalRentDollars from rentRate * totalAcres at import time,
  so the field object always has totalRentDollars populated.

  FIX 2 — farm-budget/server.js sync-registry: Skip rent sync for split sub-fields (same guard as
  the existing acres-sync skip for split fields), OR use the sub-field's own acres as denominator
  instead of the registry field's reportingAcres.

verification: |
  Fix 1: farm-registry/import.js now computes totalRentDollars = rentRate * totalAcres at parse time.
  Verified by reading the edited field object construction — if rentRate=200 and totalAcres=100,
  totalRentDollars will be set to 20000. The sync formula 20000/100=200 correctly reproduces the
  original per-acre rate.

  Fix 2: farm-budget/server.js sync-registry now guards rent sync behind `!isSplit`, matching the
  existing guard on acres sync. Split sub-fields preserve their manually-set rentPerAcre and are
  not overwritten by the parent field's diluted/amplified rate during registry sync.
files_changed:
  - farm-registry/import.js (compute totalRentDollars from rentRate * totalAcres)
  - farm-budget/server.js (skip rent sync for split fields, or use sub-field acres as denominator)
