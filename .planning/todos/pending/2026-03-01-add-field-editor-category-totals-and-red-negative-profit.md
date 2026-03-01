---
created: 2026-03-01T13:21:13.531Z
title: Add field editor category totals and red negative profit
area: farm-budget
files:
  - farm-budget/public/field-editor.js:669-742
  - farm-budget/public/calc.js
---

## Problem

The field editor preview panel only shows per-acre costs for each budget category (Rent, Fertilizer, Seed, Machinery, Labor, Overhead, Fuel, Drying, Interest, Insurance). Users want to see BOTH per-acre AND total field cost for each category — e.g. "Rent: $137.43/ac | $1,924.02 total".

Specific requests:
1. Show total (not just /AC) for every category in the field editor preview: rent total, fert total, seed total, machinery total, overhead total, etc.
2. Seed section should show both seed cost/AC and total seed cost for the field
3. If Profit/AC is negative, display it in red (currently no color distinction)
4. Same red treatment for Profit (w/ Payments) when negative

## Solution

In `field-editor.js` `updatePreview()` function (~line 669):
- Modify `renderItem()` to accept an optional total value and display it alongside per-acre
- Add red color class for negative profit values (use existing `profit-neg` CSS class or `color: var(--danger)`)
- Budget object already has all totals computed (rentTotal, totalFertCost, seedTotal, machineryTotal, etc.) — just need to display them
