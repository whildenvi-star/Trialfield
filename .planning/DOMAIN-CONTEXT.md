# Domain Context: Agricultural Operations Platform

## Who Uses This System

**Primary user:** A farm operations manager (Randy) running a 5,000+ acre diversified grain operation (W. Hughes Farms) across ~56 fields in the Upper Midwest. The operation is split between organic-certified and conventional acres, with specialty crops (malt barley, hybrid rye) alongside commodity grain (corn, soybeans, wheat). Randy wears every hat: agronomist, truck driver, bookkeeper, FSA reporter, and organic audit preparer.

**Secondary users:** On-site USDA NOP organic inspectors (read-only audit review), office staff (data entry), crew (field reference), and potentially a specialty malt buyer (Meristem Malt).

**Key insight:** This is NOT enterprise SaaS. It's a single-operator tool suite. Performance at scale matters less than getting the right answer for ONE farm. Every screen should feel like a well-organized spreadsheet — farmers think in spreadsheets.

---

## The Farming Year: A Seasonal Cycle

Everything in agriculture orbits the crop year. The system must understand time as cyclical, not linear.

### Pre-Season (Jan–Mar)
- **Budget planning**: Field-by-field cost projections (inputs, seed, machinery, rent, crop insurance)
- **FSA reporting**: Certify intended acres to USDA Farm Service Agency (CLU records)
- **Crop insurance enrollment**: Choose coverage levels, report intended plantings
- **Organic audit prep**: Assemble 3-year field history for upcoming OCIA inspection
- **Seed ordering**: Organic seed sourcing with commercial availability documentation

### Planting Season (Apr–Jun)
- **Field operations begin**: Tillage, planting, fertilizer application
- **Case IH FieldOps data flows in**: GPS-logged tractor operations sync via API
- **Split-field decisions finalized**: Which crop goes on which part of which field
- **Cover crop termination**: Previous season's cover crops terminated before planting

### Growing Season (Jun–Sep)
- **Scouting**: Pest/weed monitoring with severity thresholds
- **Management actions**: Cultural → mechanical → biological → material (NOP hierarchy)
- **Fertility events**: Manure/compost applications with days-to-harvest tracking
- **Mid-season adjustments**: Replanting, prevented planting, crop insurance claims

### Harvest (Sep–Nov)
- **Grain tickets generated**: Every truckload gets a scale ticket at the elevator
- **Yield data captured**: Weight, moisture, test weight, foreign matter
- **Storage decisions**: Which bin, cleanout verification, lot tracking
- **CropLot creation**: Traceable lot numbers (e.g., "2024-SRWW-KOPP") link field → storage → sale

### Post-Harvest (Nov–Jan)
- **Cover crop planting**: Winter cover for soil health and NOP compliance
- **Grain marketing/sales**: Contract fulfillment, spot sales, basis tracking
- **Year-end reconciliation**: Actual vs. budget, yield analysis, insurance settlement
- **Organic audit**: Inspector visits, reviews reports, verifies records

---

## Core Domain Concepts

### Field ≠ Simple Rectangle
A field is a named land unit (e.g., "Simpson North", "Kopps", "Airport") with a history. Key attributes:
- **Multiple acre measurements**: total, rented, owned, FSA-reported, GIS-measured, organic, transition, non-tillable — these NEVER all agree
- **ONE reporting acre**: The canonical number used for auditor consistency across all apps
- **Organic status**: ORGANIC, TRANSITIONAL (3-year clock), CONVENTIONAL, or SPLIT
- **Adjacent land use**: Drift risk from neighboring conventional fields (NOP buffer zone requirement ≥25 ft)
- **Aliases**: The same field has different names across systems ("Blue's" = "Blues", "Kopp" = "Kopps" = "Kopp East")

### Field Enterprise = The Real Unit of Work
A FieldEnterprise is one crop on one field in one year. This is the primary audit unit.
- A 200-acre field might have 3 enterprises: 165ac corn + 30ac soybeans + 5ac fallow
- Fallow/idle land still carries rent, overhead, and property tax — it's a real enterprise
- Double-cropping: two crops sequentially on the same land in one year (e.g., winter wheat harvested June → soybeans planted July)
- Enterprise acres within a field should reconcile against the field's total acres
- Lot numbers auto-generate from enterprise: `YEAR-CROP-FIELDABBREV`

### Grain Ticket = Atomic Unit of Harvest
Every time a truck crosses a scale at a grain elevator, a ticket is generated:
- Net weight (lbs), moisture %, foreign matter %, test weight
- Bushel calculation: `grossBU = (((100 - ((moisture - shrink) * discount)) * netWeight) / testWeight) / 100`
- One field's harvest = many tickets over several days
- The master grain ticket spreadsheet is the farmer's "source of truth" for what was actually harvested

### Chain of Custody (Organic Traceability)
Organic certification requires traceable chain from seed → field → bin → truck → buyer:
```
SeedLot → SeedUsage → FieldEnterprise → HarvestEvent → CropLot → StorageTransfer → LoadoutEvent → SaleDelivery
```
Every link must be documented. Equipment shared between organic and conventional fields requires cleanout verification (PASS/FAIL) at each transition.

### Mass Balance = The Audit's Bottom Line
For each crop: `total harvested lbs ≈ total sold lbs + storage inventory + shrink/loss`
If the numbers don't balance, the auditor flags it. This is the single most important calculation in the organic-cert module.

### Budget = Per-Field P&L Projection
For each field enterprise:
```
Revenue = (yield/ac × price) + crop insurance + gov payments
Expenses = rent + inputs + seed + machinery + labor + overhead + fuel + insurance
Profit = Revenue - Expenses
COP (Cost of Production) = Total Expenses / yield
```
Farmers think in "per acre" terms. Every cost and revenue line should be expressible as $/acre.

---

## Government Programs & Compliance

### USDA NOP (National Organic Program)
- 3-year transition period before land can be certified organic
- Annual inspection by accredited certifier (OCIA International)
- Requires: 3-year field history, input records, seed sourcing docs, buffer zones, pest management documentation
- Pest management hierarchy: cultural → mechanical → biological → material (must document escalation)
- Materials must be OMRI-listed or NOP-approved (APPROVED, RESTRICTED, PROHIBITED, EXEMPT)
- Compost C:N ratio and days-to-harvest rules

### FSA (Farm Service Agency)
- Annual acre reporting by CLU (Common Land Unit = smallest FSA-tracked parcel)
- Hierarchy: Farm Number → Tract Number → CLU Number
- Reports: crop planted, acres, organic status, irrigation, double-crop, cover crop
- Conservation practices tracked: no-till (329), residue tillage (345), cover crop (340)

### Crop Insurance (USDA RMA)
- Guarantee = APH (Actual Production History) × coverage level × spring price
- Indemnity = max(0, guarantee - actual) × harvest price
- Spring and fall (harvest) commodity prices set by USDA RMA
- Unit types affect how fields are grouped for claims

---

## Data Sources & Trust Hierarchy

1. **Case IH FieldOps API** (highest precision): GPS-logged tractor operations, yield monitor data, field boundaries
   - OAuth2 client_credentials flow via CNH Industrial
   - Known limitation: linked dealer accounts return empty field arrays silently
   - Data staged (SyncedOperation) → human review → approve/reject

2. **Scale tickets / grain elevator records**: Certified weights, official moisture tests
   - Can be OCR'd via Claude Vision or entered manually

3. **Farm manager spreadsheets**: The operational truth — budget projections, rent rolls, FSA filings
   - Excel files are the starting point; apps should match or improve on them, never lose data

4. **Manual entry**: Field observations, scouting logs, cleanout records
   - Lower precision but captures information no API provides

**Critical rule:** Manual data always wins over synced data. If a farmer manually entered an operation and the API sync finds the same event, the manual record takes precedence (409 conflict).

---

## System Architecture Principles

### Each Module = One Concern
| Module | Core Job | Storage |
|--------|----------|---------|
| farm-registry | Field/farm master data, acre consistency | JSON file |
| grain-tickets | Harvest load tracking, bushel calculations | JSON file |
| farm-budget | Per-field financial projections | JSON file |
| fsa-acres | Government acre reporting, crop insurance | JSON file |
| meristem-malt | Specialty malt batch costing | JSON file |
| organic-cert | USDA NOP audit prep, PDF reports | PostgreSQL (Prisma) |

### Farm Registry = The Acre Anchor
All modules should reference farm-registry for field names, aliases, and reporting acres. ONE number, everywhere. When acre disagreements arise, farm-registry's `reportingAcres` is authoritative.

### Think in Spreadsheets
The farmer's mental model is a spreadsheet with fields as columns and cost/revenue line items as rows. UI should feel like a well-organized spreadsheet, not a Silicon Valley dashboard. Dense data display is a feature, not a bug.

### Calculation Engines Are Shared
`calc.js` modules run in both Node.js and browser (UMD pattern). Business logic lives here, not in API routes. This means the same bushel formula, budget rollup, or insurance calculation can run client-side for instant feedback and server-side for reports.

### Import First, Build UI Second
Every module started with an Excel import script. The real-world data shapes the schema, not the other way around. When designing new features, start by looking at what the spreadsheet already tracks.

---

## Common Pitfalls for AI Agents Working on This Project

1. **Don't normalize field names** — "Kopp", "Kopps", and "Kopp East" might all be valid and mean different things. Use the alias system, don't collapse them.

2. **Don't assume one crop per field** — Split-field enterprises are the norm for large operations. Always design for multiple enterprises per field per year.

3. **Don't ignore fallow land** — Idle/fallow acres carry real costs (rent, property tax, overhead). They're enterprises too.

4. **Acres never agree** — FSA acres, GIS acres, surveyed acres, rented acres, and planted acres are all different numbers for the same field. This is normal. Don't try to "fix" it.

5. **Moisture and test weight matter** — A 60,000 lb load of corn at 18% moisture is worth significantly less than at 15%. The bushel calculation isn't optional — it's the foundation of grain commerce.

6. **Organic traceability is non-negotiable** — Every material, every seed lot, every equipment cleanout must be documented. Missing one link in the chain of custody can jeopardize the entire farm's certification.

7. **The PDF report IS the product** — For organic-cert, the print-ready PDF is what the inspector sees. Screen UI is for data entry; the PDF is the deliverable.

8. **Manual entry > API data** — Farmers manually enter data they trust. API synced data is convenient but must be reviewed before it becomes part of the audit record.

9. **Think per-acre** — Costs, revenues, yields, applications — everything should be reducible to a per-acre figure. That's how farmers compare and decide.

10. **Seasonal timing matters** — Don't design features that ignore the crop calendar. A "planting date" in December is almost certainly wrong. A cover crop planted in July makes no sense in the Upper Midwest.
