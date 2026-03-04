---
created: 2026-03-03T03:41:21.620Z
title: Rework Seed & Input Inventory with forecasts, orders, and reports
area: farm-budget
files:
  - farm-budget/public/seed-manager.js
  - farm-budget/public/inputs-manager.js
  - farm-budget/public/enterprise.js
  - farm-budget/server.js
  - farm-budget/data/data.json
  - farm-budget/public/style.css
  - farm-budget/public/index.html
---

## Problem

The Seed & Input Inventory page (localhost:3006) needs a complete rework across UI, data model, and operational workflow:

1. **UI doesn't match Glomalin project style** — needs redesign to be consistent with grain-tickets, organic-cert, and other Glomalin modules (day/night theme, layout patterns, typography, color system).

2. **Unit/packaging system is too rigid** — no way to add custom units like tote, probox, pallet, bag, unit. No way to describe pack size (e.g., "40 unit tote" vs "50 unit tote", "50 lb bag" vs "80 lb bag"). The receiving manager needs to know exactly what packaging to expect.

3. **Seeds, inputs, and suppliers are managed standalone** — should pull the available list from upstream Macro Roll-Up. When seeds are entered in the Seeds tab or inputs in the Reference tab of the Macro, they should automatically become available downstream in the inventory sheet.

4. **No product demand table** — the receiving manager needs an always-up-to-date forecast showing how much of each product is expected, in what packaging, from which supplier. This is their operational dashboard for planning warehouse space and receiving dock schedules.

5. **No order/delivery tracking pipeline** — missing Forecasts → Orders → Deliveries → Returns workflow with status tracking and print reports.

## Solution

### UI Redesign
- Match Glomalin project design language (consistent with grain-tickets, organic-cert)
- Day/night mode with CSS custom properties
- Touch-friendly for tablet use in the field/warehouse
- Responsive layout, accessible color coding

### Unit & Pack Size System
- Extensible unit list: tote, probox, pallet, bag, unit, bushel, ton, gallon, etc.
- User can add new units on-the-fly
- Pack size descriptor field: "40 unit tote", "50 lb bag", "80 lb bag"
- Pack quantity tracking (how many packs, not just raw units)

### Upstream Data Pull (Macro Roll-Up → Inventory)
- Seeds entered in Macro Seeds tab → available in inventory
- Inputs entered in Macro Reference tab → available in inventory
- Suppliers flow downstream automatically
- No duplicate data entry — Macro is source of truth

### Product Demand Table (Receiving Manager View)
- Real-time forecast of expected product quantities
- Grouped by supplier, category (seed/fertilizer/chemical)
- Shows: product name, supplier, expected qty, unit, pack size, estimated arrival
- Printable format for warehouse/dock planning

### Order & Delivery Pipeline
- Forecasts page: reactive roll-up from Macro field edit tabs
- Orders CRUD: purchase orders against forecasted products (Ordered → Confirmed → Shipped → Delivered)
- Deliveries CRUD: log incoming against orders, track discrepancies
- Returns CRUD: damaged/wrong/excess linked to deliveries
- 5 print reports: Agronomist Order Sheet, Field-Level Input Plan, Forecast Summary, Order Status, Delivery Receipt Log

### Execution Order
1. UI redesign to match Glomalin project style
2. Build unit/pack size system with extensible list
3. Wire upstream data pull from Macro Roll-Up (seeds, inputs, suppliers)
4. Build Product Demand Table for receiving manager
5. Build Forecasts page with reactive Macro data pipeline
6. Build Orders → Deliveries → Returns CRUD pipeline
7. Build print/report system (all 5 report types)
8. End-to-end test: Macro field edit → Forecast → Demand Table → Order → Delivery → Print
