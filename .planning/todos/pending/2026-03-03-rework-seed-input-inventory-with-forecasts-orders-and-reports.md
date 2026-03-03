---
created: 2026-03-03T03:41:21.620Z
title: Rework Seed & Input Inventory with forecasts, orders, and reports
area: farm-budget
files:
  - farm-budget/public/seed-manager.js
  - farm-budget/public/inputs-manager.js
  - farm-budget/server.js
  - farm-budget/data/data.json
---

## Problem

The Seed & Input Inventory page (localhost:3006) needs a complete rework. Currently it has standalone Supplier and Product tabs that duplicate data already managed in the Macro Roll-Up. The inventory sheet should be a lean operational extension of the Macro Roll-Up — consuming forecasted data from field edit tabs, not managing its own product/supplier data.

Key gaps:
- No Forecasts page that rolls up all planned inputs from Macro Roll-Up field edit tabs
- No Orders tracking (purchase orders against forecasted products with status workflow)
- No Deliveries tracking (logging incoming deliveries against orders, flagging discrepancies)
- No Returns management (damaged/wrong/excess product returns linked to deliveries)
- No printable reports (agronomist order sheets, field-level input plans, forecast summaries, order status, delivery logs)
- Supplier and Product tabs exist but should be eliminated — that data flows from Macro

## Solution

### Architecture
- **Forecasts Page (Hub):** Reactive roll-up of all products from Macro Roll-Up field edit tabs. Shows product name, supplier, forecasted amount (correct unit: tons/gallons/bags/etc.), and cost. Only products with amount > 0. Groups by category (seed, fertilizer, chemical).
- **Orders CRUD:** Create purchase orders against forecasted products. Status workflow: Ordered → Confirmed → Shipped → Delivered. Show ordered vs. forecasted variance.
- **Deliveries CRUD:** Log deliveries against orders. Track date, quantity, condition, ticket #. Running tally: delivered vs. ordered vs. forecasted.
- **Returns CRUD:** Track returns linked to deliveries. Status: Initiated → Picked Up → Credited. Impact available inventory.
- **5 Report Types:** Agronomist/Supplier Order Sheet, Field-Level Input Plan, Full Forecast Summary, Orders Status Report, Delivery Receipt Log. Clean print CSS, professional layout, page-break-friendly tables.

### Tabs to Eliminate
- ❌ Supplier Tab (data flows from Macro)
- ❌ Products Tab (data flows from Macro)

### UI Requirements
- Day/night mode with CSS variables, persisted via localStorage
- Touch-friendly for tablet use in the field
- Consistent design language with Macro Roll-Up
- Accessible color coding (not just red/green)

### Data Models
- ForecastItem: productId, name, category, supplier, amount, unit, unitCost, totalCost, fields[]
- Order: orderId, supplier, items[], status, orderDate, expectedDeliveryDate, notes
- Delivery: deliveryId, orderId, items[], receivedDate, ticketNumber, notes
- Return: returnId, deliveryId, items[], status, returnDate, creditAmount, notes

### Execution Order
1. Map existing codebase and data flow from Macro field tabs
2. Eliminate Supplier and Product tabs
3. Build Forecasts page with reactive data pipeline from Macro
4. Build Orders tracking with CRUD
5. Build Deliveries tracking linked to Orders
6. Build Returns management linked to Deliveries
7. Build print/report system (all 5 report types)
8. Polish UI — day/night mode, responsive, empty states
9. Test full flow: Macro field edit → Forecast updates → Order → Delivery → Return → Print
