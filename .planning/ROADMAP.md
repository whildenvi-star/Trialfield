# Roadmap: Farm Operations Platform

## Milestones

- ✅ **v1.0 Data Ingestion & Reports** — Phases 1-4 (shipped 2026-02-26) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Split-Field Enterprises** — Phases 5-8 (shipped 2026-03-01) — [archive](milestones/v1.1-ROADMAP.md)
- ✅ **v2.0 Grain Traceability + Chat Agent** — Phases 9-14 (shipped 2026-03-04) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 Organic Cert Transparency + Procurement** — Phases 15-19 (shipped 2026-03-04) — [archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Cross-Module Polish & Settlement Closure** — Phases 20-23 (shipped 2026-03-04)
- ✅ **v5.0 Glomalin Portal — Next.js + Supabase Scaffold** — Phases 24-26 (shipped 2026-03-05) — [archive](milestones/v5.0-ROADMAP.md)
- 🚧 **v6.0 FSA Acres, Insurance & Claims** — Phases 27-34 (in progress)

## Phases

<details>
<summary>✅ v1.0 Data Ingestion & Reports (Phases 1-4) — SHIPPED 2026-02-26</summary>

- [x] Phase 1: Case IH API Integration (3/3 plans) — completed 2026-02-24
- [x] Phase 2: Field Records & History (3/3 plans) — completed 2026-02-25
- [x] Phase 3: Inspection Report Generation (3/3 plans) — completed 2026-02-25
- [x] Phase 4: Synced Harvest CropLot Wiring (2/2 plans) — completed 2026-02-26

</details>

<details>
<summary>✅ v1.1 Split-Field Enterprises (Phases 5-8) — SHIPPED 2026-03-01</summary>

- [x] Phase 5: Split-Field Schema & Acre Reconciliation (2/2 plans) — completed 2026-02-27
- [x] Phase 6: Multi-Enterprise Field Views (2/2 plans) — completed 2026-02-28
- [x] Phase 7: Split-Field PDF Reports (3/3 plans) — completed 2026-02-28
- [x] Phase 8: Fallow Enterprise Edit Fix (1/1 plan) — completed 2026-03-01

</details>

<details>
<summary>✅ v2.0 Grain Traceability + Chat Agent (Phases 9-14) — SHIPPED 2026-03-04</summary>

- [x] Phase 9: Database Foundation (1/1 plan) — completed 2026-03-02
- [x] Phase 10: Migration & Cutover (2/2 plans) — completed 2026-03-02
- [x] Phase 11: Buyer Registry & Ticket Extensions (2/2 plans) — completed 2026-03-02
- [x] Phase 12: Settlement Import & Manual Entry (2/2 plans) — completed 2026-03-02
- [x] Phase 13: Reconciliation Engine & Discrepancy UI (3/3 plans) — completed 2026-03-02
- [x] Phase 14: Chat Agent — Glomalin (3/3 plans) — completed 2026-03-03

</details>

<details>
<summary>✅ v3.0 Organic Cert Transparency + Procurement (Phases 15-19) — SHIPPED 2026-03-04</summary>

- [x] Phase 15: Foundation Fixes & Ecosystem Client Layer (2/2 plans) — completed 2026-03-03
- [x] Phase 16: Field & Enterprise Compilation (2/2 plans) — completed 2026-03-03
- [x] Phase 17: Input & Seed Compilation + NOP Compliance (2/2 plans) — completed 2026-03-03
- [x] Phase 18: Rotation Snapshot & Harvest Compilation & PDF (3/3 plans) — completed 2026-03-03
- [x] Phase 19: Seed & Input Inventory Redesign (3/3 plans) — completed 2026-03-04

</details>

<details>
<summary>✅ v4.0 Cross-Module Polish & Settlement Closure (Phases 20-23) — SHIPPED 2026-03-04</summary>

- [x] Phase 20: Farm-Registry Bug Fix (1/1 plan) — completed 2026-03-04
- [x] Phase 21: Farm-Budget Field Editor Polish (2/2 plans) — completed 2026-03-04
- [x] Phase 22: FSA Crop Sync Improvement (1/1 plan) — completed 2026-03-04
- [x] Phase 23: Settlement Closure (3/3 plans) — completed 2026-03-04

</details>

<details>
<summary>✅ v5.0 Glomalin Portal — Next.js + Supabase Scaffold (Phases 24-26) — SHIPPED 2026-03-05</summary>

- [x] Phase 24: Project Scaffold + Supabase Foundation (3/3 plans) — completed 2026-03-05
- [x] Phase 25: Auth + Middleware + Route Protection (4/4 plans) — completed 2026-03-05
- [x] Phase 26: Portal UI (2/2 plans) — completed 2026-03-05

</details>

### 🚧 v6.0 FSA Acres, Insurance & Claims (In Progress)

**Milestone Goal:** Transform the FSA Acres module from a flat spreadsheet into an intuitive, guided workflow — then extend with an interactive crop insurance decision tool and a structured claims tracking system. All built inside glomalin-portal/ (Next.js 14 + Supabase), following the strict FK dependency chain: CLU records anchor insurance policies, which anchor claims.

- [x] **Phase 27: FSA Data Foundation + Migration** (2 plans) - Migrate fsa-acres data.json to Supabase, register fsa-578 module, build validation and auto-populate API layer (completed 2026-03-05)
- [x] **Phase 28: FSA Planting Workflow UI** - Card-based CLU editor with bulk actions, validation panel, PDF acreage summary export, and CSV export (completed 2026-03-05)
- [x] **Phase 29: Insurance Tables + Calculation Engine** (2 plans) - Schema migration + calc engine + policies API, APH auto-detect + yield bridge + claim alerts (completed 2026-03-05)
- [x] **Phase 30: Insurance Decision Tool UI** - Policy CRUD, coverage matrix, payout simulator, insurance summary report (completed 2026-03-05)
- [x] **Phase 31: Claims Tables + API** - Supabase schema, Storage bucket, route handlers for claims/documents/timeline, create-from-policy API (completed 2026-03-05)
- [x] **Phase 32: Claims Lifecycle UI** - Kanban board, drag-and-drop pipeline, claim detail view, document upload, deadline alerts, timeline notes (completed 2026-03-06)
- [ ] **Phase 34: Insurance & Claims UI Wiring** - Wire APH auto-populate, Sync Yield button, File Claim button into existing UI (gap closure)
- [ ] **Phase 33: Cross-Module Integration + Dashboard** - FSA-Insurance-Claims navigation links, prevented planting trigger, dashboard summary cards

## Phase Details

### Phase 27: FSA Data Foundation + Migration
**Goal**: CLU records from fsa-acres live in Supabase and the portal can read, validate, and auto-populate FSA crop assignments from farm-budget
**Depends on**: Phase 26 (portal scaffold with auth + module system)
**Requirements**: FSA-01, FSA-05, FSA-06
**Success Criteria** (what must be TRUE):
  1. User can open the portal fsa-578 module and see all CLU records from the 2026 crop year (migrated from fsa-acres/data/data.json, matching record count)
  2. Validation logic runs server-side and returns structured warnings (missing crop, missing date, unreported) for the CLU dataset
  3. User can trigger auto-populate from farm-budget macro rollup and see a preview of proposed crop assignments before any changes are committed
  4. All Express proxy route handlers respond with correct data and fall back gracefully when fsa-acres app is offline
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md — Supabase schema + migration script + fsa-578 module registration + CLU read API
- [ ] 27-02-PLAN.md — TypeScript calc port + validation API + auto-populate preview proxy

### Phase 28: FSA Planting Workflow UI
**Goal**: Users can manage all CLU records through a card-based workflow — edit assignments inline, bulk-mark as reported, view validation warnings, and export a print-ready acreage summary
**Depends on**: Phase 27
**Requirements**: FSA-02, FSA-03, FSA-04, FSA-07, FSA-08
**Success Criteria** (what must be TRUE):
  1. User can view CLU records as cards grouped by Farm/Tract/CLU with status badges (reported, unreported, warnings)
  2. User can edit crop, practice, planting date, and organic flag directly on a CLU card and save without leaving the page
  3. User can bulk-select multiple CLUs and mark them as reported to FSA in one action
  4. User can generate and download a print-ready FSA Acreage Reporting Summary PDF labeled explicitly as a summary (not a government form replica)
  5. User can export the full CLU dataset as a CSV file
**Plans**: 2 plans

Plans:
- [ ] 28-01-PLAN.md — API routes (PATCH + bulk-update) + CluWorkspace + Farm/Tract accordions + CluCard inline editing + BulkActionBar + CropTypeahead
- [ ] 28-02-PLAN.md — Install @react-pdf/renderer + Acreage Reporting Summary PDF + CSV export wired into page header

### Phase 29: Insurance Tables + Calculation Engine
**Goal**: Insurance policies live in Supabase with APH auto-detected from CLU records, actual yields bridged from grain-tickets, and potential claim conditions automatically flagged
**Depends on**: Phase 27 (clu_records must exist as FK anchor for APH auto-compute)
**Requirements**: INS-01, INS-05, INS-06, INS-07
**Success Criteria** (what must be TRUE):
  1. User can open the portal insurance module and see all policies migrated from fsa-acres (matching record count, no _computed ephemeral fields carried over)
  2. APH yield is auto-populated on each policy from the linked CLU record without manual entry
  3. User can sync actual yield from grain-tickets for a policy and see the updated value reflected immediately
  4. When actual yield falls below the effective guarantee, the system flags a potential claim alert visible on the policy card
**Plans**: 2 plans

Plans:
- [ ] 29-01-PLAN.md — Schema migration (ALTER TABLE) + lib/insurance/calc.ts engine + insurance module registration + GET /api/insurance/policies + shell page
- [ ] 29-02-PLAN.md — APH lookup endpoint + grain-ticket yield sync + PATCH policy with claim alert recompute

### Phase 30: Insurance Decision Tool UI
**Goal**: Users can create and manage insurance policies, compare coverage options side-by-side, simulate payout scenarios interactively, and generate an insurance summary report
**Depends on**: Phase 29
**Requirements**: INS-02, INS-03, INS-04, INS-08
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete insurance policies via a slide-out editor without leaving the insurance module
  2. User can see a coverage level comparison matrix showing RP, RP-HPE, and YP side-by-side at 50%-85% coverage levels with heat-map cell coloring
  3. User can move yield and price sliders and see payout recalculate in under 100ms with a disclaimer that results are illustrative only
  4. User can generate and download an insurance summary report as a PDF
**Plans**: 2 plans

Plans:
- [ ] 30-01-PLAN.md — Schema migration (plan_type column) + POST/DELETE API routes + InsuranceWorkspace + PolicyDrawer + CoverageMatrix
- [ ] 30-02-PLAN.md — PayoutSimulator (client-side yield/price sliders) + Insurance summary PDF with SSR-guarded dynamic import

### Phase 31: Claims Tables + API
**Goal**: Claims, documents, and timeline data live in Supabase Storage with the full signed-URL upload pattern verified and all route handlers ready for the UI phase
**Depends on**: Phase 29 (insurance_policies must exist; claims.policy_id is a FK)
**Requirements**: CLM-04, CLM-07
**Success Criteria** (what must be TRUE):
  1. The claims Supabase schema (claims, claim_documents, claim_timeline) and Storage bucket (claim-documents, private) exist and enforce correct RLS policies
  2. A document can be uploaded to a claim via the signed URL pattern (server generates URL, client PUT to Storage, client posts metadata) without routing file bytes through a Server Action
  3. A new claim can be created pre-filled from an insurance policy via the API (policy_id, crop, coverage level, and effective guarantee carried over)
**Plans**: 2 plans

Plans:
- [ ] 31-01-PLAN.md — Migration script (3 tables + enum + RLS + Storage bucket) + deadline calc helpers + claims CRUD routes + timeline route + module registration + shell page
- [ ] 31-02-PLAN.md — Signed URL upload endpoint + document metadata CRUD + download URL generation

### Phase 32: Claims Lifecycle UI
**Goal**: Users can manage the full claims pipeline — dragging claims between stages on a Kanban board, reviewing claim detail with timeline history and documents, and seeing deadline alerts before they miss filing windows
**Depends on**: Phase 31
**Requirements**: CLM-01, CLM-02, CLM-03, CLM-05, CLM-06
**Success Criteria** (what must be TRUE):
  1. User can view all claims as a Kanban board with 6 pipeline stages and each claim card showing crop, policy, and deadline at a glance
  2. User can drag a claim card to a different stage and the stage change persists (no hydration error on first render)
  3. User can open a claim detail view and see the full timeline of status changes and notes, all uploaded documents, and financial totals
  4. User can add a timestamped note to a claim timeline without refreshing the page
  5. User sees a deadline alert banner when any claim has an approaching filing deadline
**Plans**: 2 plans

Plans:
- [ ] 32-01-PLAN.md — Install dnd-kit + react-dropzone, extend calc.ts, ClaimsWorkspace + ClaimsKanban + ClaimColumn + ClaimCard + DeadlineAlertBanner + page.tsx rewrite
- [ ] 32-02-PLAN.md — ClaimDrawer slide-over (Timeline + Documents + Financials tabs), TimelineFeed with inline notes, DocumentUpload with signed URL flow

### Phase 34: Insurance & Claims UI Wiring
**Goal**: Wire existing backend APIs into the UI — APH auto-populate displays on policies, Sync Yield button triggers grain-ticket comparison, File Claim button enables claim creation from insurance policies
**Depends on**: Phase 30, Phase 31
**Requirements**: INS-05, INS-06, CLM-07
**Gap Closure:** Closes 3 partial requirements and 2 integration gaps from v6.0 audit
**Success Criteria** (what must be TRUE):
  1. When a policy is opened in the PolicyDrawer, APH yield is auto-fetched from the CLU record and displayed without manual entry (INS-05)
  2. User can click a "Sync Yield" button on a policy row and see actual yield updated from grain-tickets (INS-06)
  3. User can click a "File Claim" button on a policy and be taken to claim creation pre-filled with policy data (CLM-07)
**Plans**: 1 plan

Plans:
- [ ] 34-01-PLAN.md — APH auto-populate fetch in PolicyDrawer + Sync Yield button + File Claim button

### Phase 33: Cross-Module Integration + Dashboard
**Goal**: The three modules (FSA, Insurance, Claims) form a coherent workflow — users can navigate from CLU to policy to claim in one path, the portal dashboard shows live summary cards for all three, and the prevented planting trigger closes the FSA-to-Claims loop automatically
**Depends on**: Phase 28, Phase 30, Phase 32 (all three module UIs complete)
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. User can click a CLU card in the FSA module and navigate directly to the related insurance policy (or be offered policy creation if none exists)
  2. User can click an insurance policy and navigate to create a new claim pre-filled from that policy
  3. When a user marks a CLU as Prevented Planting, a prompt appears offering to create a claim with the relevant policy and CLU data pre-filled
  4. The portal dashboard shows three summary cards — FSA reporting progress, Insurance coverage status, Claims pipeline count — each reflecting live data without a page reload
**Plans**: TBD

Plans:
- [ ] 33-01: FSA-Insurance-Claims navigation links + prevented planting trigger
- [ ] 33-02: Dashboard summary cards (FSA + Insurance + Claims)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Case IH API Integration | v1.0 | 3/3 | Complete | 2026-02-24 |
| 2. Field Records & History | v1.0 | 3/3 | Complete | 2026-02-25 |
| 3. Inspection Report Generation | v1.0 | 3/3 | Complete | 2026-02-25 |
| 4. Synced Harvest CropLot Wiring | v1.0 | 2/2 | Complete | 2026-02-26 |
| 5. Split-Field Schema & Acre Reconciliation | v1.1 | 2/2 | Complete | 2026-02-27 |
| 6. Multi-Enterprise Field Views | v1.1 | 2/2 | Complete | 2026-02-28 |
| 7. Split-Field PDF Reports | v1.1 | 3/3 | Complete | 2026-02-28 |
| 8. Fallow Enterprise Edit Fix | v1.1 | 1/1 | Complete | 2026-03-01 |
| 9. Database Foundation | v2.0 | 1/1 | Complete | 2026-03-02 |
| 10. Migration & Cutover | v2.0 | 2/2 | Complete | 2026-03-02 |
| 11. Buyer Registry & Ticket Extensions | v2.0 | 2/2 | Complete | 2026-03-02 |
| 12. Settlement Import & Manual Entry | v2.0 | 2/2 | Complete | 2026-03-02 |
| 13. Reconciliation Engine & Discrepancy UI | v2.0 | 3/3 | Complete | 2026-03-02 |
| 14. Chat Agent (Glomalin) | v2.0 | 3/3 | Complete | 2026-03-03 |
| 15. Foundation Fixes & Ecosystem Client Layer | v3.0 | 2/2 | Complete | 2026-03-03 |
| 16. Field & Enterprise Compilation | v3.0 | 2/2 | Complete | 2026-03-03 |
| 17. Input & Seed Compilation + NOP Compliance | v3.0 | 2/2 | Complete | 2026-03-03 |
| 18. Rotation Snapshot & Harvest Compilation & PDF | v3.0 | 3/3 | Complete | 2026-03-03 |
| 19. Seed & Input Inventory Redesign | v3.0 | 3/3 | Complete | 2026-03-04 |
| 20. Farm-Registry Bug Fix | v4.0 | 1/1 | Complete | 2026-03-04 |
| 21. Farm-Budget Field Editor Polish | v4.0 | 2/2 | Complete | 2026-03-04 |
| 22. FSA Crop Sync Improvement | v4.0 | 1/1 | Complete | 2026-03-04 |
| 23. Settlement Closure | v4.0 | 3/3 | Complete | 2026-03-04 |
| 24. Project Scaffold + Supabase Foundation | v5.0 | 3/3 | Complete | 2026-03-05 |
| 25. Auth + Middleware + Route Protection | v5.0 | 4/4 | Complete | 2026-03-05 |
| 26. Portal UI | v5.0 | 2/2 | Complete | 2026-03-05 |
| 27. FSA Data Foundation + Migration | 2/2 | Complete   | 2026-03-05 | - |
| 28. FSA Planting Workflow UI | 2/2 | Complete    | 2026-03-05 | - |
| 29. Insurance Tables + Calculation Engine | 2/2 | Complete    | 2026-03-05 | - |
| 30. Insurance Decision Tool UI | 2/2 | Complete    | 2026-03-05 | - |
| 31. Claims Tables + API | 2/2 | Complete    | 2026-03-05 | - |
| 32. Claims Lifecycle UI | 2/2 | Complete   | 2026-03-06 | - |
| 34. Insurance & Claims UI Wiring | v6.0 | 0/1 | Not started | - |
| 33. Cross-Module Integration + Dashboard | v6.0 | 0/2 | Not started | - |
