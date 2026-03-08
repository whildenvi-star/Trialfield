---
phase: 30-insurance-decision-tool-ui
plan: "02"
subsystem: glomalin-portal/insurance
tags: [insurance, pdf, payout-simulator, react-pdf, nextjs, dynamic-import]
dependency-graph:
  requires:
    - 30-01-SUMMARY.md (InsuranceWorkspace, coverage-matrix, computeInsurancePolicy)
    - lib/fsa/calc.ts (computeInsurancePolicy, InsurancePolicy, PricingEntry types)
    - @react-pdf/renderer (pre-installed in Phase 28)
  provides:
    - PayoutSimulator (yield+price slider with instant indemnity recalc)
    - InsurancePdfDocument (react-pdf Document with policy table + matrix snapshot)
    - InsurancePdfButton (PDFDownloadLink wrapper, SSR-guarded)
  affects:
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx (wires simulator + PDF button)
tech-stack:
  added: []
  patterns:
    - useMemo keyed on [policy, pricing, simYield, simPrice] for <100ms slider recalculation
    - dynamic({ ssr: false }) with named export pattern (.then(m => ({ default: m.NamedExport })))
    - @react-pdf/renderer isolation: only insurance-pdf.tsx and insurance-pdf-button.tsx import it
    - PDFDownloadLink children render function ({ loading }) for button loading state
    - fixed position PageDisclaimer in PDF renders on every page
key-files:
  created:
    - glomalin-portal/src/components/insurance/payout-simulator.tsx
    - glomalin-portal/src/components/insurance/insurance-pdf.tsx
    - glomalin-portal/src/components/insurance/insurance-pdf-button.tsx
  modified:
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
decisions:
  - "PayoutSimulator adjusts both spring_price and fall_price to simPrice for uniform market scenario — models 'what if price is X' cleanly without split spring/fall ambiguity"
  - "InsurancePdfDocument renders Page 2 (coverage matrix) conditionally only when pricing.length > 0 — avoids blank/misleading page when no pricing data loaded"
  - "@react-pdf/renderer isolation enforced: insurance-workspace.tsx uses dynamic() not direct import; only comment references the library name"
  - "PDF disclaimer appears as fixed footer on every page via react-pdf fixed prop — matches INS-08 requirement for disclaimer on all outputs"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-05"
  tasks: 2
  files_created: 3
  files_modified: 1
---

# Phase 30 Plan 02: Payout Simulator + Insurance PDF Summary

**One-liner:** Client-side payout simulator with yield/price sliders recomputing indemnity via computeInsurancePolicy, plus react-pdf insurance summary with policy table and 8x3 coverage matrix snapshot behind SSR-guarded dynamic import.

## What Was Built

### Task 1: PayoutSimulator with Yield and Price Sliders

**payout-simulator.tsx** (`'use client'`):
- Props: `policy: InsurancePolicy`, `pricing: PricingEntry[]`
- Finds matching pricing entry by case-insensitive crop name match
- `simYield` initialized to `policy.actual` if > 0, else `policy.guarantee`
- `simPrice` initialized to `max(spring_price, fall_price)` from matching entry, or 5.00 fallback
- Yield slider: min=0, max=ceil(guarantee × 1.5), step=1 (defaults to 200 if guarantee=0)
- Price slider: min=0, max=ceil(defaultPrice × 2 × 20)/20 (rounded to $0.05), step=0.05
- `result` via `useMemo` keyed on [policy, pricing, simYield, simPrice]:
  - Creates `adjustedPricing` with both spring/fall prices overridden to `simPrice` for the matching crop
  - Calls `computeInsurancePolicy({ ...policy, actual: simYield }, adjustedPricing)`
- Disclaimer banner above results: italic, text-xs, text-soil-muted
- Results grid (grid-cols-3): Effective Guarantee, Est. Indemnity (yellow when >0), Projected Revenue
- No-pricing fallback message rendered instead of sliders when crop has no pricing entry
- Wired into InsuranceWorkspace below Coverage Matrix section (same conditional: shown only when policy selected)

### Task 2: Insurance PDF Report + SSR-Guarded Dynamic Import

**insurance-pdf.tsx** (no `'use client'`):
- Imports: Document, Page, Text, View, StyleSheet from `@react-pdf/renderer`
- Imports: `computeInsurancePolicy`, `InsurancePolicy`, `PricingEntry` from `@/lib/fsa/calc`
- Page 1 (Landscape LETTER): Policy summary table
  - Columns: Farm, Crop, Plan Type, Coverage%, Planted Ac, Guarantee, Actual, Alert
  - Alternating row background for readability
- Page 2 (conditional on pricing.length > 0): Coverage matrix snapshot
  - Per-policy label, then 8-row × 3-column mini-table (COVERAGE_LEVELS × PLAN_TYPES)
  - RP-HPE/YP use spring_price for fall_price (mirrors CoverageMatrix component logic)
  - Current coverage level marked with asterisk
- Disclaimer footer on every page via `fixed` prop on Text element

**insurance-pdf-button.tsx** (no `'use client'`):
- Imports `PDFDownloadLink` from `@react-pdf/renderer`
- Props: `policies: InsurancePolicy[]`, `pricing: PricingEntry[]`
- Named export: `InsurancePdfButton`
- PDFDownloadLink with fileName `insurance-summary-2026.pdf`
- Children render function: "Generating..." when loading, "Export PDF" when ready
- Soil accent button styling consistent with acreage-pdf-button.tsx pattern

**InsuranceWorkspace updates**:
- `dynamic()` import at top of file (outside component) with `ssr: false`
- Named export pattern: `.then(m => ({ default: m.InsurancePdfButton }))`
- Loading fallback: disabled button with "Loading..." text
- Replaced placeholder `<div id="insurance-pdf-button-slot" />` with `<InsurancePdfButton policies={policies} pricing={initialPricing} />`
- Passes current `policies` state (not `initialPolicies`) so PDF reflects CRUD changes

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] payout-simulator.tsx exists — FOUND
- [x] payout-simulator.tsx contains 'use client' — FOUND
- [x] payout-simulator.tsx imports computeInsurancePolicy — FOUND
- [x] insurance-pdf.tsx exists (no 'use client') — FOUND
- [x] insurance-pdf.tsx exports InsurancePdfDocument — FOUND
- [x] insurance-pdf.tsx imports Document from @react-pdf/renderer — FOUND
- [x] insurance-pdf-button.tsx exists (no 'use client') — FOUND
- [x] insurance-pdf-button.tsx exports InsurancePdfButton — FOUND
- [x] insurance-pdf-button.tsx imports PDFDownloadLink — FOUND
- [x] insurance-workspace.tsx uses dynamic() import — FOUND
- [x] dynamic import uses named export pattern (.then(m => ...)) — FOUND
- [x] InsurancePdfButton wired in page header replacing placeholder slot — FOUND
- [x] @react-pdf/renderer only imported in insurance-pdf.tsx and insurance-pdf-button.tsx (workspace has comment only) — VERIFIED
- [x] TypeScript noEmit passes (zero real errors, only stale .next/types pre-existing) — PASSED
- [x] Next.js build succeeds (✓ Compiled successfully) — PASSED

## Self-Check: PASSED
