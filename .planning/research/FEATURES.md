# Feature Research

**Domain:** Projected vs actual farm budget — role-filtered views, actuals entry, variance comparison for internal farm operations tool
**Researched:** 2026-03-20
**Confidence:** HIGH — based on direct codebase inspection (schema, RBAC, budget-summary route, sync-macro route), project requirements in PROJECT.md, and verified patterns from ERP/farm management industry research.

---

## Context: What Already Exists

This milestone adds a layer on top of existing infrastructure. Understanding what is already built is essential for scoping what is new.

**Already in schema:**
- `FieldEnterprise` — has `targetYieldPerAcre`, `targetPricePerUnit` (projected revenue fields synced from farm-budget)
- `FieldOperation` — has `passStatus` (PLANNED | CONFIRMED), `costPerAcre`, `totalCost`, `dataSource` (MANUAL | SYNCED)
- `MaterialUsage` — has `unitCost`, `totalCost`, `dataSource`
- `SeedUsage` — has `dataSource`
- `HarvestEvent` — records actual yield per acre, moisture, test weight
- `SaleDelivery` — records actual price per unit, net revenue
- `AuditLog` — full change trail

**Already in API:**
- `GET /api/field-enterprises/[id]/budget-summary` — computes projected seed/material/operation costs and revenue projection on the fly from PLANNED+CONFIRMED ops combined; does NOT separate projected from actual

**Already in RBAC (`src/lib/rbac.ts`):**
- ADMIN: all permissions including `sale:read`, `enterprise:lock`
- OFFICE: nearly identical to ADMIN — currently has `sale:read` and `sale:write` (this needs restricting for financial privacy)
- CREW: field operation writes only
- AUDITOR: read-only

**Gap identified:** OFFICE role currently has `sale:read` — budget privacy requires this to be stripped or a new permission layer applied at the data field level, not just at the route level.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features Sandy (OFFICE) and the farm manager (ADMIN) will assume work correctly. Missing any of these makes the v2.0 milestone feel incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Role-filtered budget API responses — financial fields stripped for OFFICE/CREW | Sandy must never see rental rates, overhead, labor, sale prices, profit/acre — this is the foundational privacy constraint for the entire milestone | MEDIUM | Not a new route — modify existing budget-summary response to omit `revenueProjection`, `targetPricePerUnit`, margin fields based on session role. Requires session auth in the GET handler (currently unauthenticated). |
| Role-filtered enterprise detail page — Budget tab hides revenue/margin for OFFICE | The Budget tab on the field enterprise detail page shows revenue projection and gross margin — these must be invisible to OFFICE | LOW | UI conditional render based on role from session. Already have session available via `useSession()`. |
| Projected vs actual column layout on Budget tab | Industry standard: Projected | Actual | Variance columns side by side. Any other layout pattern is unfamiliar and slows interpretation. | MEDIUM | The budget-summary API needs a parallel "actuals" calculation path. Actuals = CONFIRMED ops + confirmed material costs + actual harvest yield + actual sale price. |
| Actuals entry for field operations — confirm planned passes as they occur | PLANNED ops are the projection. Office records the actual date, equipment, acres worked to CONFIRM them. This is the primary actuals entry workflow for equipment costs. | LOW | `passStatus` toggle (PLANNED → CONFIRMED) already exists in the schema and UI. Verify the edit flow works cleanly. May be complete already. |
| Actuals entry for material inputs — record actual invoice quantities and costs | The as-applied rate and actual invoice price often differ from the budget. OFFICE enters the real numbers when invoices arrive. | MEDIUM | `MaterialUsage` already has `unitCost` and `totalCost` fields. Need a clear edit form that Sandy can use to update these after the projected values are synced in. Need to distinguish synced (projected) from edited (actual). |
| Actuals entry for harvest yield — enter actual yield per acre from scale tickets | Actual yield is the most important actual data point. It drives actual revenue and actual margin calculations. | LOW | `HarvestEvent` already has `yieldPerAcre`, `acresHarvested`. The harvest entry form likely exists. Verify it is accessible and usable for OFFICE role. |
| All-enterprise sync (organic + conventional) | Current sync only pulls organic enterprises. The farm budget covers the entire operation. ADMIN needs projected vs actual for all crops. | MEDIUM | `sync-macro` route filters to organic-category enterprises. Remove the category filter or add a parameter to include all. Conventional enterprises need the same `targetYieldPerAcre`, `targetPricePerUnit` sync treatment. |
| Enterprise-level budget summary page with projected vs actual | Each field enterprise detail's Budget tab shows side-by-side projected vs actual for that enterprise. This is the primary consumer view. | MEDIUM | Extend `budget-summary` route to return both projected totals (from PLANNED ops / synced costs) and actual totals (from CONFIRMED ops / edited costs / harvest events). |
| Farm-wide budget summary view — all enterprises in one view | ADMIN needs to see the whole farm at once, not click into each enterprise. Mirrors the Macro Rollup layout Sandy already knows. | HIGH | New page/component. Aggregates budget-summary data across all enterprises for a crop year. Requires a new API route or batched calls. Financial columns (revenue, margin) hidden for OFFICE. |

### Differentiators (Competitive Advantage)

Features that make this tool distinctly more useful than a spreadsheet or generic farm management app for W. Hughes Farms specifically.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Variance column with favorable/unfavorable indicator | Variance = Actual − Projected. Color and sign (green/favorable, red/unfavorable) give instant read on whether costs are running over or under. Industry standard in ERP budget reports. | LOW | Computed client-side from projected and actual totals. Favorable = actual cost < projected cost (saved money) OR actual yield > projected yield. |
| DataSource badge on individual line items (SYNCED vs edited) | Sandy can see at a glance which material usages still have synced/projected costs vs which have been updated with real invoice numbers. Prevents confusion about what's real vs estimated. | LOW | `dataSource` field already exists on `MaterialUsage` and `SeedUsage`. Render a subtle "Projected" vs "Actual" badge on each line in the Budget tab detail. |
| Macro Rollup-style layout on farm-wide summary | Sandy already knows the Macro Rollup layout from the farm-budget service. Mirror that column structure (crop, acres, seed cost, input cost, equipment cost, yield, [revenue — admin only]) so the mental model transfers. | MEDIUM | Design work, not data work. Study Macro Rollup layout and match it. Financial columns conditionally rendered. |
| Inline actuals editing from Budget tab | OFFICE can click a line item's cost to update it without navigating to a separate edit form. Faster workflow for invoice processing. | MEDIUM | Inline edit pattern: click → input appears → save on blur/enter. Applies to `MaterialUsage.unitCost` and `FieldOperation.costPerAcre`. |
| Bulk operation confirmation (confirm all planned passes in one action) | At season-end, all planned ops become confirmed. One-click "Confirm all operations for this enterprise" saves Sandy from confirming each one individually. | LOW | POST to a new route `/api/field-enterprises/[id]/operations/confirm-all` — sets all PLANNED to CONFIRMED with today's date. Add admin confirmation prompt. |
| Crop-year filter on farm-wide summary | Budget comparisons are always year-specific. Crop year selector at top of farm-wide view lets admin jump between years without navigating away. | LOW | UI select control. Already have `cropYear` on `FieldEnterprise`. Standard pattern. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately not build for this milestone.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Approval workflow for actuals entry | Sounds like a good audit trail — Sandy enters data, admin approves | PROJECT.md explicitly rules this out. Sandy's entries record immediately; admin trusts the team. An approval gate adds friction and blocks the office workflow. | AuditLog already captures every change with user, timestamp, old/new data. Admin can review changes in audit trail if needed. |
| Syncing actuals back to farm-budget service | Seems natural — actuals should flow back to the source | PROJECT.md explicitly marks this as out of scope for this milestone. The farm-budget service is the source of truth for projections; organic-cert records reality alongside it, not inside it. Reverse sync creates a two-way dependency that complicates both systems. | Manual reconciliation by admin at season end. Future milestone if needed. |
| Invoice attachment / document storage for actuals | Sandy would attach the invoice PDF to each material usage so there's a paper trail | Useful eventually, but adds file storage complexity (uploads, paths, serving files) that is not needed for projected vs actual comparisons. Scope creep risk for this milestone. | `Attachment` model already exists in schema for future use. Note in description field for now. |
| Real-time multi-user editing of actuals | If farm manager and Sandy are both in the same enterprise at the same time | Two writers on the same record causes last-write-wins data loss with no conflict UI. Small team, low probability, high complexity to handle properly. | Page-level locking (show "Sandy is editing this" via optimistic UI) or simply accept last-write-wins — the team is small enough that conflicts are very rare. |
| Percent-complete / progress tracking per enterprise | Shows how far through the season each enterprise is | Not how farm operations work. PLANNED vs CONFIRMED is sufficient signal for "what has happened vs what is planned." A percentage is a manufactured metric that will be wrong whenever reality diverges from the plan. | CONFIRMED operation count vs PLANNED count gives a factual ratio if needed. |
| Budget forecasting / re-forecasting | Updating the projected budget mid-season based on actuals | This is the farm-budget service's job. Organic-cert records actuals against the static plan — it does not update the plan. Re-forecasting in organic-cert would duplicate farm-budget functionality and create two sources of truth for projected data. | Re-forecast in farm-budget service, then re-sync to organic-cert. |
| Per-acre profitability map / heat map | Visual, map-based view of which fields are most profitable | Requires GIS rendering (MapBox, Leaflet, etc.), adds heavy dependency, and the farm manager already knows their fields by name. Premium complexity for minimal gain. | Tabular farm-wide summary with per-acre margin column (admin only) achieves the same analytical goal. |

---

## Feature Dependencies

```
[All-Enterprise Sync]
    └──required by──> [Farm-Wide Budget Summary]
    └──required by──> [Projected vs Actual — Conventional Enterprises]

[Budget API Role Filtering]
    └──required by──> [Farm-Wide Budget Summary (OFFICE view)]
    └──required by──> [Enterprise Budget Tab (OFFICE view)]
    └──required before──> [Any budget UI renders — privacy constraint]

[Projected vs Actual Budget Summary API]
    └──requires──> [DataSource differentiation on MaterialUsage/FieldOperation]
    └──requires──> [HarvestEvent actuals readable from budget-summary route]
    └──feeds──> [Variance Column Display]

[Variance Column Display]
    └──requires──> [Projected vs Actual Budget Summary API]
    └──enhances──> [Enterprise Budget Tab]
    └──enhances──> [Farm-Wide Budget Summary]

[Farm-Wide Budget Summary View]
    └──requires──> [All-Enterprise Sync]
    └──requires──> [Budget API Role Filtering]
    └──requires──> [Projected vs Actual Budget Summary API]

[Actuals Entry — Material Inputs]
    └──enhances──> [Projected vs Actual Budget Summary API] (replaces SYNCED cost with real invoice cost)
    └──depends on──> [DataSource badge] (Sandy knows what still needs updating)

[Actuals Entry — Field Operations (confirm planned passes)]
    └──leverages──> [Existing PassStatus PLANNED→CONFIRMED toggle] (may already work)
    └──enhances──> [Projected vs Actual Budget Summary API]

[Actuals Entry — Harvest Yield]
    └──leverages──> [Existing HarvestEvent model and entry form]
    └──feeds──> [Actual Revenue Calculation (ADMIN only)]

[Bulk Operation Confirmation]
    └──enhances──> [Actuals Entry — Field Operations]
    └──requires──> [Existing FieldOperation PLANNED/CONFIRMED model]

[Inline Actuals Editing]
    └──enhances──> [Actuals Entry — Material Inputs]
    └──enhances──> [Enterprise Budget Tab UX]
```

### Dependency Notes

- **Budget API role filtering must ship before any budget UI:** Exposing the budget tab to OFFICE before financial fields are stripped violates the privacy constraint in PROJECT.md. This is the first thing to implement.
- **All-enterprise sync is a prerequisite for farm-wide summary:** A farm-wide view that only shows organic enterprises is misleading. Fix the sync filter first, then build the aggregation view.
- **Projected vs actual API split requires DataSource awareness:** The budget-summary route currently mixes PLANNED and CONFIRMED costs into one total. Splitting these (projected = SYNCED/PLANNED, actual = CONFIRMED/edited) is the core data modeling work for this milestone.
- **HarvestEvent actuals are already stored — they just aren't consumed by budget-summary:** Actual yield and actual revenue from `HarvestEvent` and `SaleDelivery` are in the database but not included in the budget-summary calculation. Wiring these in is straightforward but must be intentional about role gating (`SaleDelivery.pricePerUnit` is ADMIN-only).

---

## MVP Definition

This milestone (v2.0) is the MVP. The full scope is the minimum to make projected vs actual useful.

### Launch With (v2.0 core)

Minimum needed for ADMIN to see projected vs actual and for OFFICE to enter actuals without seeing financial data.

- [ ] **Budget API role filtering** — strip financial fields (revenue projection, gross margin, sale prices, rental rates) from responses for OFFICE/CREW roles. Must ship first — it's the privacy foundation.
- [ ] **All-enterprise sync expansion** — remove organic-only filter in sync-macro so conventional enterprises sync with the same projected data fields. Without this, the farm-wide view is missing half the operation.
- [ ] **Projected vs actual split in budget-summary API** — return `projected` and `actual` objects separately so the UI can render two columns. Projected = SYNCED/PLANNED cost basis. Actual = CONFIRMED ops + edited material costs + harvest actuals.
- [ ] **Updated Budget tab on enterprise detail page** — render Projected | Actual | Variance columns. Show DataSource badge (Projected/Actual) on line items. Hide revenue/margin rows for OFFICE role.
- [ ] **Farm-wide budget summary page** — new page listing all enterprises for a crop year with projected vs actual totals per enterprise. Financial columns ADMIN only. Mirrors Macro Rollup column structure.
- [ ] **Actuals entry for material inputs** — edit form that lets Sandy update `unitCost` and `totalCost` on a `MaterialUsage` when the invoice arrives. Updates `dataSource` to MANUAL on save.
- [ ] **Verify harvest actuals entry works for OFFICE role** — HarvestEvent form exists; confirm OFFICE role can enter yield without seeing price/revenue fields.

### Add After Validation (v2.x)

Add once core projected vs actual comparison is working and being used.

- [ ] **Bulk operation confirmation** — "Confirm all planned operations" button on enterprise detail. Trigger: Sandy reports confirming passes one by one is tedious.
- [ ] **Inline actuals editing on Budget tab** — click-to-edit cost fields without navigating to separate form. Trigger: Sandy finds the current edit flow disruptive.
- [ ] **Variance highlighting with color indicators** — green/favorable, amber/watch, red/over budget color coding on variance column. Trigger: admin requests faster visual scan of performance.
- [ ] **Crop-year selector on farm-wide summary** — compare different years. Trigger: after first full year of actuals data is available.

### Future Consideration (v3+)

Defer until v2.0 actuals workflow is stable and the team is using it regularly.

- [ ] **Actuals sync back to farm-budget service** — PROJECT.md marks this out of scope; defer until farm-budget service is ready to receive actuals.
- [ ] **Invoice attachment on material usages** — attach PDF invoices to records. Defer: file storage infrastructure not in scope.
- [ ] **Per-enterprise profitability report PDF export** — printable season-end report. Defer: reporting module already exists; extend it later.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Budget API role filtering (strip financial fields) | HIGH | MEDIUM | P1 — privacy foundation, nothing else ships without this |
| All-enterprise sync expansion | HIGH | LOW | P1 — without this, farm-wide view is incomplete |
| Projected vs actual split in budget-summary API | HIGH | MEDIUM | P1 — core data model for all UI features |
| Updated Budget tab (two-column layout) | HIGH | MEDIUM | P1 — primary daily-use view for OFFICE and ADMIN |
| Farm-wide budget summary page | HIGH | HIGH | P1 — ADMIN's primary season overview |
| Actuals entry for material inputs | HIGH | MEDIUM | P1 — OFFICE's primary data entry workflow |
| Harvest actuals entry verification (OFFICE role) | HIGH | LOW | P1 — verifying existing functionality works correctly |
| Bulk operation confirmation | MEDIUM | LOW | P2 |
| Inline actuals editing | MEDIUM | MEDIUM | P2 |
| Variance color indicators | MEDIUM | LOW | P2 |
| Crop-year filter on farm-wide summary | LOW | LOW | P2 |
| Invoice attachment support | LOW | HIGH | P3 |
| Actuals sync back to farm-budget | LOW | HIGH | P3 |

**Priority key:**
- P1: Required for v2.0 launch — ADMIN cannot do projected vs actual comparison without these
- P2: Should have — meaningfully improves daily usability
- P3: Nice to have — defer to future milestone

---

## Existing Model Mapping to Feature Areas

This section maps the new v2.0 features to the Prisma models they read/write, to clarify what schema changes (if any) are needed.

| Feature | Primary Model(s) | Schema Change Needed? |
|---------|----------------|-----------------------|
| Role-filtered API responses | Session (NextAuth) + budget-summary route | No schema change — API response transformation |
| Projected costs (PLANNED/SYNCED) | `FieldOperation` (passStatus=PLANNED), `MaterialUsage` (dataSource=SYNCED), `SeedUsage` (dataSource=SYNCED) | No — fields exist |
| Actual costs (CONFIRMED/MANUAL) | `FieldOperation` (passStatus=CONFIRMED), `MaterialUsage` (dataSource=MANUAL, edited unitCost) | No — fields exist |
| Actual yield | `HarvestEvent.yieldPerAcre`, `acresHarvested` | No — fields exist |
| Actual revenue (ADMIN only) | `SaleDelivery.pricePerUnit`, `netRevenue` | No — fields exist |
| All-enterprise sync | `FieldEnterprise.organicStatus` — currently only ORGANIC synced | No schema change — remove category filter in sync-macro route |
| Farm-wide aggregation | Aggregate across `FieldEnterprise` for a `cropYear` | No — new API route, no new model |
| DataSource badge | `MaterialUsage.dataSource`, `SeedUsage.dataSource`, `FieldOperation.dataSource` | No — fields exist |

**Conclusion:** No Prisma schema migrations are required for v2.0. All data fields needed for projected vs actual comparison already exist. The work is in API layer (splitting projected vs actual in budget-summary, adding role filtering) and UI layer (new two-column layout, farm-wide summary page).

---

## Role-Based Data Visibility Matrix

Defines what each role sees in budget-related views. This is the specification for API filtering.

| Data Field | ADMIN | OFFICE | CREW | AUDITOR |
|-----------|-------|--------|------|---------|
| Seed cost (projected) | YES | YES | NO | YES (read-only) |
| Material input cost (projected) | YES | YES | NO | YES |
| Equipment/operation cost (projected) | YES | YES | NO | YES |
| Actual seed cost | YES | YES | NO | YES |
| Actual material cost | YES | YES | NO | YES |
| Actual operation cost | YES | YES | NO | YES |
| Projected yield (bu/ac) | YES | YES | NO | YES |
| Actual yield (bu/ac) | YES | YES | NO | YES |
| Target price per unit ($/bu) | YES | NO | NO | NO |
| Projected gross revenue | YES | NO | NO | NO |
| Projected gross margin / profit | YES | NO | NO | NO |
| Actual sale price ($/bu) | YES | NO | NO | NO |
| Actual net revenue | YES | NO | NO | NO |
| Variance (cost) | YES | YES | NO | YES |
| Variance (revenue/margin) | YES | NO | NO | NO |
| Cost per acre | YES | YES | NO | YES |
| Profit per acre | YES | NO | NO | NO |

**Implementation pattern:** The budget-summary API route checks session role and either includes or omits `revenueProjection` and related fields in the response. The UI Budget tab renders based on what the API returns — if `revenueProjection` is absent, the revenue/margin rows simply do not render. No separate UI role check needed beyond what the API enforces.

---

## Competitor Feature Analysis

Scoped to projected vs actual and role-filtered budget patterns, not general farm management features.

| Feature | Granular Insights | Agworld | Ag Decision Maker (ISU) | Our Approach |
|---------|------------------|---------|------------------------|--------------|
| Projected vs actual comparison | Yes — real-time forecasts vs actuals by crop/field | Yes — plan vs actual costs in-season | Spreadsheet templates (not software) | Side-by-side columns per enterprise and farm-wide table |
| Role-based financial visibility | Yes — custom role permissions per user | Limited — advisor/grower distinction | N/A | Hard-coded role matrix: ADMIN sees all financial data, OFFICE sees agronomic data only |
| Actuals entry workflow | Syncs from equipment telematics and grain elevator | Manual entry or agronomist input | Manual spreadsheet | Manual entry by OFFICE role; planned pass confirmation for ops |
| Farm-wide aggregation view | Yes — enterprise-level and farm-level dashboards | Yes — field and farm dashboards | Partial budget templates | Farm-wide summary page mirroring Macro Rollup layout |
| Variance indicators | Yes — dashboard with color coding | Limited | Manual | Color-coded variance column (v2.x, after core is stable) |

**Takeaway:** Commercial farm management platforms treat projected vs actual as a first-class feature with dashboard-level visibility. The W. Hughes Farms approach is simpler (no telematics sync, manual actuals entry) but the data model is already correct — the gap is entirely in the API and UI layer.

---

## Sources

- Direct codebase inspection: `prisma/schema.prisma`, `src/lib/rbac.ts`, `src/app/api/field-enterprises/[id]/budget-summary/route.ts`, `src/app/api/fields/sync-macro/route.ts`, `src/lib/ecosystem/budget-client.ts` — HIGH confidence
- `.planning/PROJECT.md` — project requirements and constraints — HIGH confidence
- [Budget vs Actual Analysis: Variance, Examples, and Tools — Qubit Capital](https://qubit.capital/blog/budget-vs-actual) — dual-column layout, variance display conventions — MEDIUM confidence
- [How to Conduct a Plan vs Actual Analysis — LivePlan](https://www.liveplan.com/blog/managing/how-to-conduct-plan-vs-actual-financial-analysis) — projected vs actual patterns, column conventions — MEDIUM confidence
- [Agworld farm management platform](https://www.agworld.com/us/) — farm management projected vs actual feature set — MEDIUM confidence
- [Actuals in Accounting — NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/actuals-in-accounting.shtml) — actuals workflow patterns in ERP — MEDIUM confidence
- [Budget vs Actual Dashboard — Bold BI](https://www.boldbi.com/dashboard-examples/finance/budget-vs-actual-dashboard/) — variance visualization conventions — MEDIUM confidence
- [Budgeting and Forecasting with ERP — Soft Engine](https://softengine.com/budgeting-and-forecasting-with-erp/) — role-based financial visibility patterns — MEDIUM confidence

---

*Feature research for: Projected vs Actual Farm Budget — v2.0 milestone (W. Hughes Farms organic-cert app)*
*Researched: 2026-03-20*
