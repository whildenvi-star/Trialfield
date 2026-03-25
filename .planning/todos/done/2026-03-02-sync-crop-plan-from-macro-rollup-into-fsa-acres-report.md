---
created: 2026-03-02T04:24:27.087Z
title: Sync crop plan from macro rollup into FSA acres report
area: fsa-acres
files:
  - fsa-acres/
  - farm-budget/
---

## Problem

The FSA acres report needs integration with the farm-budget macro rollup crop plan. Currently there's no way to pull cropping decisions made in the farm-budget macro rollup into the FSA acre report, forcing manual re-entry.

Key requirements:
- Identify which CLUs in the FSA acre report are "tillable" crop acres (irrigated and non-irrigated cropland — corn, soy, lima beans, etc.)
- Non-crop CLUs (grass left standing, non-cropped land) should be left alone / ignored
- CLUs already marked as "reported" should also be ignored during sync
- Workflow: User creates crop plan in farm-budget macro rollup → when ready, pulls that cropping information into the FSA acres report
- Only tillable CLUs with actual crop assignments get synced from the macro crop plan

## Solution

Build an integration layer between farm-budget macro rollup and fsa-acres:
1. Add a "tillable" or crop-type flag to CLUs in the FSA acres data model so the system knows which CLUs are cropland vs. grass/non-crop
2. Create an import/sync mechanism that reads the macro rollup crop plan and maps crops to matching CLUs
3. Skip CLUs already marked as reported and non-crop CLUs
4. Provide a UI action (button or menu) in the FSA acres report to trigger the sync
5. Show a preview/confirmation before applying changes
