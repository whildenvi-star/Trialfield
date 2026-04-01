# Computed Budget Audit — Org Corn / Omni GRASSY KNOLL

**Date:** 2026-03-31  
**Trigger:** User reported computed budget numbers "not reality" for Omni GRASSY KNOLL in the Organic Corn enterprise.

---

## What the Budget Shows (Current)

**Omni GRASSY KNOLL — 90 ac — ORG Blue Corn — System Code: ORG IRR**

| Line | /ac | Total |
|------|-----|-------|
| Rent | $273.42 | $24,607.80 |
| Spring Fert | $100.79 | $9,071.36 |
| Seed (T1081J 32k pop) | $130.00 | $11,700.00 |
| Machinery (10 passes) | $123.00 | $11,070.00 |
| Labor (ORG IRR) | $32.50 | $2,925.00 |
| Overhead (ORG IRR) | $180.00 | $16,200.00 |
| Fuel | $40.25 | $3,622.50 |
| Drying (120bu × $0.30) | $36.00 | $3,240.00 |
| Interest | $14.82 | $1,333.46 |
| **Insurance (explicit)** | **$25.00** | **$2,250.00** |
| **TOTAL** | **$955.78** | **$86,020.12** |

Income: $1,800.00/ac (120bu × $15.00/bu)  
Profit: $844.22/ac

---

## Bug #1 — CONFIRMED: Crop Insurance Double-Counted

This is the concrete error the user is hitting.

**The Overhead line ($180/ac) already contains crop insurance.**

The `laborOverhead` table for system code `ORG IRR` stores five sub-components that sum to `overheadPerAcre`:

| Sub-component | $/ac |
|---|---|
| Crop Insurance | **$30** |
| Property Tax | $30 |
| Management | $30 |
| Utilities | $30 |
| Misc | $60 |
| **overheadPerAcre total** | **$180** |

**Then the calc also adds `field.cropInsurancePerAcre = $25` as a separate Insurance line.**

Result: Omni GRASSY KNOLL is being charged **$55/ac for crop insurance** — $30 buried in Overhead + $25 on the Insurance line — when only one should exist.

Same problem on all three Organic Corn fields:

| Field | In Overhead | Explicit Ins line | Total charged | Should be |
|---|---|---|---|---|
| Omni GRASSY KNOLL | $30 | $25 | **$55** | $25 or $30 |
| Kopp Seed Corn | $30 | $36 | **$66** | $36 or $30 |
| Simpsons Seed Corn | $30 | $0 | $30 | $30 ✓ |

**Root cause:** The overhead table was designed with crop insurance as one of its components. But the field editor also exposes a separate "Crop Insurance" field per field. Both paths feed `expTotal`.

### Fix — Two options, pick one:

**Option A (Recommended): Remove crop insurance from the overhead table**  
Edit `laborOverhead` records — reduce `overheadPerAcre` by the `cropInsurance` sub-component, and zero out the `cropInsurance` sub-component. Each field then carries its own insurance via `field.cropInsurancePerAcre`.

Changes needed in the laborOverhead table:

| System Code | Current overheadPerAcre | Crop ins sub | New overheadPerAcre |
|---|---|---|---|
| CON | $170 | $30 | **$140** |
| ORG | $180 | $30 | **$150** |
| CON IRR | $170 | $30 | **$140** |
| ORG IRR | $180 | $30 | **$150** |
| CANNING ORG | $180 | $30 | **$150** |
| CANNING CON | $180 | $30 | **$150** |
| CANNING ORG IRR | $180 | $30 | **$150** |
| CANNING CON IRR | $180 | $30 | **$150** |
| IRR HAY | $180 | $30 | **$150** |

Then verify every field that should carry crop insurance has a realistic `cropInsurancePerAcre` set.

**Option B: Remove explicit Insurance line from all fields**  
Set `field.cropInsurancePerAcre = 0` for all fields and rely entirely on the overhead table's $30 rate. Only correct if $30 is accurate for every field in a system code group.

---

## Bug #2 — CONFIRMED (dormant): `expPerAcre` Uses Wrong Denominator

**File:** [farm-budget/public/calc.js:361](farm-budget/public/calc.js#L361)

```js
// CURRENT — WRONG when plantedAcres > 0
result.expPerAcre = rentAcres > 0 ? round2(result.expTotal / rentAcres) : 0;
```

All individual cost totals (fert, seed, machinery, labor, etc.) are computed using `effectiveAcres` (`plantedAcres` when set, otherwise `acres`). But `expPerAcre` divides by `rentAcres` (always `field.acres`).

**When this bites you:** Any field where `plantedAcres` is set to less than `acres`. Example — if you set `plantedAcres = 60` on a 90-acre field:
- Fert total = $100.79 × 60ac = $6,047.40
- expPerAcre = $6,047.40 ÷ 90ac = **$67.19/ac (wrong)**
- Correct: $6,047.40 ÷ 60ac = $100.79/ac

Currently all fields have `plantedAcres = 0` (so effectiveAcres = acres), which is why the UI isn't visibly broken today. But the moment anyone sets a planted acreage, all per-acre numbers will be understated.

**Fix — [farm-budget/public/calc.js:361](farm-budget/public/calc.js#L361) and [397](farm-budget/public/calc.js#L397):**

```js
// Line 361 — fix expPerAcre
result.expPerAcre = acres > 0 ? round2(result.expTotal / acres) : 0;

// Line 397 — fix profitPerAcre
result.profitPerAcre = acres > 0 ? round2((result.cropIncomeTotal - result.expTotal) / acres) : 0;
```

---

## Data Observations (Not Bugs — Review Needed)

### Omni GRASSY KNOLL inputs
All four inputs are correctly stored per-acre for this field only — they are NOT spread across the farm:
- 0-0-50 OMRI: 140 lbs × $0.43 = **$60.20/ac**
- S04 30%: 80 lbs × $0.1505 = **$12.04/ac**
- BioActive Liquilife +: 2.5 gal × $7.83 = **$19.58/ac**
- TeraFed: 2.5 gal × $3.59 = **$8.98/ac**
- *(blank product, 2.6 qty)* = **$0/ac** — dirty entry, should be deleted

Total fert: **$100.79/ac** — this number is correct given the input table.

If the real-world cost for these inputs is different, the discrepancy is in the product prices in the **Products** reference table, not in the budget logic.

### Simpsons Seed Corn — very high fert: $386.54/ac
- Chicken Litter: 2 Tons × $80/ton = **$160/ac**
- Tulls manure: 25 Tons × $4.50/ton = **$112.50/ac**
- Red Clover: 10 lbs × $3.41/lb = **$34.10/ac**
- Plus biologicals: ~$80/ac

Total $386/ac fert on 165 acres = $63,779. This seems intentional given the organic inputs, but confirm quantities are per-acre (not whole-field totals accidentally entered per-acre).

### Overhead $180/ac — this IS "divided across the farm"
The overhead of $180/ac (after removing the crop insurance component, $150/ac) is a **flat rate applied to every ORG IRR field regardless of actual property tax or management cost**. This is by design — it's a system-code average. If the actual overhead for a specific landlord parcel is significantly different, the system currently has no per-field override for overhead (only rent and crop insurance are field-specific).

---

## Priority Fix Order

1. **Do now:** Edit `laborOverhead` table in the farm-budget settings — reduce each system code's `overheadPerAcre` by $30 (remove the embedded crop insurance), and set `cropInsurance` sub-component to 0.
2. **Do now:** Verify `field.cropInsurancePerAcre` is set correctly on all fields that need it.
3. **Code fix (low risk):** Change lines 361 and 397 in `calc.js` to use `acres` instead of `rentAcres` as denominator for `expPerAcre` and `profitPerAcre`.
4. **Data cleanup:** Delete the blank input entry on Omni GRASSY KNOLL.
5. **Verify:** Confirm Simpsons Seed Corn manure quantities are per-acre, not whole-field.
