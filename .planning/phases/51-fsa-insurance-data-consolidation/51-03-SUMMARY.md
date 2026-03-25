---
phase: 51-fsa-insurance-data-consolidation
plan: 03
subsystem: glomalin-portal/insurance
tags: [rma-scraper, insurance-pricing, usda, staleness-badge, refresh-button]
dependency_graph:
  requires: [insurance_pricing table in Supabase, clu_records table, requireModuleAccess guard]
  provides: [POST /api/insurance/pricing/scrape, PricingStalenessBadge component]
  affects: [glomalin-portal insurance UI]
tech_stack:
  added: []
  patterns: [native fetch with AbortSignal.timeout, supabase upsert with onConflict, client-side staleness computation]
key_files:
  created:
    - glomalin-portal/src/app/api/insurance/pricing/scrape/route.ts
    - glomalin-portal/src/components/insurance/pricing-staleness-badge.tsx
  modified:
    - glomalin-portal/src/app/(protected)/app/insurance/page.tsx
    - glomalin-portal/src/components/insurance/insurance-workspace.tsx
decisions:
  - Scraper scope determined dynamically from clu_records.crop — adapts automatically to what crops are planted
  - manual_override rows in insurance_pricing are never overwritten by the scraper
  - Failed scrape returns ok:false with status 200 (not 500) so UI can display message gracefully
  - Daily cron job deferred — documented as TODO comment in route file
  - lastScraped queried server-side in page.tsx and passed as prop to workspace (no client-side fetch on load)
metrics:
  duration: ~15 minutes
  completed: 2026-03-25
  tasks: 2
  files: 4
---

# Phase 51 Plan 03: Portal RMA Price Scraper + Staleness Badge Summary

Portal API route for USDA RMA price scraping, with manual refresh button and staleness warning badge in the insurance UI.

## What Was Built

**POST /api/insurance/pricing/scrape**
- Auth-gated via `requireModuleAccess('insurance')` — same pattern as all insurance routes
- Queries `clu_records` for distinct crops to determine scrape scope (dynamic, adapts to what's planted)
- Fetches from `https://public-rma.fpac.usda.gov/apps/PriceDiscovery/Services/RevenuePriceDataService.svc/RevenuePrices`
- Parses `data.d` (OData) or top-level array from RMA response
- Upserts `insurance_pricing` on crop conflict key, skipping rows with `manual_override = true`
- On any failure (network, parse, DB): returns `{ ok: false, error, message }` with status 200 — never clears existing data

**PricingStalenessBadge component**
- Client component accepting `lastScraped: string | null`
- Stale threshold: >7 days or null shows amber warning badge
- Fresh (<= 7 days) shows subtle green "Updated Xd ago" text
- "Refresh Prices" button triggers the scrape endpoint with loading spinner
- Inline success/error feedback auto-clears after 6 seconds
- Updates displayed staleness in-place on successful refresh (no page reload required)

**Insurance page + workspace updates**
- Page now queries `insurance_pricing.last_scraped` (most recent, descending order) via `maybeSingle()`
- Passes `lastScraped` to InsuranceWorkspace as a prop
- Badge rendered above stat cards in the workspace header area
- All existing functionality preserved — purely additive changes

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- glomalin-portal/src/app/api/insurance/pricing/scrape/route.ts — FOUND
- glomalin-portal/src/components/insurance/pricing-staleness-badge.tsx — FOUND
- Commit 59ef373 (scrape route) — FOUND
- Commit 5cded83 (badge + UI) — FOUND
