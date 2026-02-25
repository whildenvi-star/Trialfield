# Roadmap: Organic Audit System

## Overview

This roadmap delivers the v1.0 Data Ingestion & Reports milestone: a complete pipeline from Case IH field operation data to print-ready USDA NOP inspection reports. Phase 1 establishes the data connection and ingestion from Case IH FieldOps via OAuth2. Phase 2 builds the field record views and manual entry screens that let the farm manager validate and supplement synced data. Phase 3 assembles everything into inspector-ready PDF reports. Each phase produces a coherent, verifiable capability that gates the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Case IH API Integration** - Connect to Case IH FieldOps, pull field operations, normalize into structured records (completed 2026-02-24)
- [x] **Phase 2: Field Records & History** - View, browse, and manually enter field operation records with lot number generation (completed 2026-02-25)
- [ ] **Phase 3: Inspection Report Generation** - Produce print-ready USDA NOP inspection reports as PDF

## Phase Details

### Phase 1: Case IH API Integration
**Goal**: Farm manager can connect their Case IH account and pull normalized field operation data into the system
**Depends on**: Nothing (first phase)
**Requirements**: API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. Farm manager can connect their Case IH FieldOps account via OAuth2 and see a confirmation of successful connection
  2. Farm manager can trigger a data sync and see field operations (tillage, planting, application, harvest) appear as structured records in the system
  3. Farm manager can see the sync status and last-sync timestamp for each field after a sync completes
  4. Farm manager receives a clear alert if their Case IH account returns no data due to a Linked Account limitation
  5. System normalizes raw Case IH API responses into typed operation records (tillage, planting, application, harvest) without manual intervention
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Schema extensions, FieldOps TypeScript client, mock data, and Zod-validated normalizer
- [x] 01-02-PLAN.md — Sync orchestration service and all ADMIN-gated API routes
- [x] 01-03-PLAN.md — FieldOps connection hub, field matching UI, sync trigger, and staged operations review pages

### Phase 2: Field Records & History
**Goal**: Farm manager can review all field operation records (synced and manual) with complete 3-year history per parcel
**Depends on**: Phase 1
**Requirements**: FIELD-01, FIELD-02, FIELD-03, FIELD-04, FIELD-05, FIELD-06
**Success Criteria** (what must be TRUE):
  1. Farm manager can view a 3-year field history per parcel showing crops, inputs, and dates across growing seasons
  2. Farm manager can view input application records showing material, date, rate, field, and approval status for each application
  3. Farm manager can view harvest records with yield, date, field, auto-generated lot number, and equipment used
  4. Farm manager can view tillage operation records per field with dates and operation types
  5. Farm manager can manually enter field records (for pre-API historical data or non-synced operations) using the same forms and data model as synced records
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Schema migration (DataSource enum), history API route, field index API upgrade, CropLot auto-creation, staged-ops dataSource update
- [x] 02-02-PLAN.md — Field index page upgrade with activity stats and 3-year history timeline page with season grouping, operation cards, and filter bar
- [x] 02-03-PLAN.md — Manual entry Sheet forms (tillage, application, harvest) with smart defaults, batch entry, equipment selector, and end-to-end verification

### Phase 3: Inspection Report Generation
**Goal**: Farm manager can generate and download a complete, print-ready USDA NOP inspection report as PDF with zero manual data assembly
**Depends on**: Phase 2
**Requirements**: RPT-01, RPT-02, RPT-03, RPT-04
**Success Criteria** (what must be TRUE):
  1. Farm manager can generate a print-ready USDA NOP inspection report as a downloadable PDF
  2. Generated report includes an operation overview, complete field list, and 3-year field history per parcel
  3. Generated report includes input application log with materials and rates, and harvest log with lot numbers
  4. Generated report includes mass balance summary showing harvested vs. sold quantities per crop and lot
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Schema (GeneratedReport), Next.js config, report data assembler, shared PDF components (styles, page wrapper, table row)
- [ ] 03-02-PLAN.md — All 8 PDF report sections (cover, TOC, overview, field list, field history, application log, harvest log, mass balance) and top-level InspectionReport Document
- [ ] 03-03-PLAN.md — API routes (generate, list, download), Reports page UI with crop year selector and report history, end-to-end verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Case IH API Integration | 3/3 | Complete   | 2026-02-24 |
| 2. Field Records & History | 3/3 | Complete   | 2026-02-25 |
| 3. Inspection Report Generation | 1/3 | In progress | - |
