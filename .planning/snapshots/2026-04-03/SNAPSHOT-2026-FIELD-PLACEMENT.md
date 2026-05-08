# 2026 Field & Enterprise Placement Snapshot
**Captured: 2026-04-03 | Source: farm-budget/data/data.json**

This is a complete reference snapshot of all 2026 field placements, enterprise assignments, inputs, machinery, seeds, products, pricing, and rent. Use this to recover data if data.json gets corrupted or a migration goes wrong.

---

## 1. Settings

| Setting | Value |
|---|---|
| Year | 2026 |
| Fuel Price Per Gallon | $5.00 |
| Wage Rate | $25.00/hr |
| Carry Months | 6 |
| Use Fixed Machinery Rate | false |
| Fixed Machinery Rate | $100/ac (inactive) |
| Use Flat Rent Rate | false |

---

## 2. Enterprises (7 Total)

| ID | Name | Short Name | Category | System Codes | Crop Types |
|---|---|---|---|---|---|
| ent_0491 | Conventional Corn | Conv Corn | conventional | CON, CON IRR | Corn |
| ent_0492 | Conventional Small Grain | Conv SM Grain | conventional | CON, CON IRR | Wheat, Rye, Barley, Sorghum, Hay, Kernza |
| ent_1272 | Conventional Soybeans | Conv Soy | conventional | CON, CON IRR | Soybeans, Peas, Vetch, Sunflowers |
| ent_1875 | Conv/Org Canning | Canning | conventional | CANNING CON, CANNING ORG, CANNING CON IRR, CANNING ORG IRR | Sweet Corn, Food Beans |
| ent_2056 | Organic Corn | Org Corn | organic | ORG, ORG IRR | Corn |
| ent_2120 | Organic Small Grain | Org Sm Grain | organic | ORG | Wheat, Rye, Barley, Sorghum, Hay, Kernza |
| ent_2185 | Organic Broadleaf | Org Broadleaf | organic | ORG, ORG IRR | Soybeans, Peas, Vetch, Sunflowers, Hemp |

---

## 3. Overhead Rates by System Code

| System Code | Labor/Ac | Overhead/Ac | Crop Ins | Prop Tax | Mgmt | Util | Misc |
|---|---|---|---|---|---|---|---|
| CON | $17.50 | $170 | $30 | $30 | $30 | $30 | $50 |
| ORG | $27.50 | $180 | $30 | $30 | $30 | $30 | $60 |
| CON IRR | $22.50 | $170 | $30 | $30 | $30 | $30 | $50 |
| ORG IRR | $32.50 | $180 | $30 | $30 | $30 | $30 | $60 |
| CANNING ORG | $15.00 | $180 | $30 | $30 | $30 | $30 | $60 |
| CANNING CON | $10.00 | $180 | $30 | $30 | $30 | $30 | $60 |
| CANNING ORG IRR | $17.50 | $180 | $30 | $30 | $30 | $30 | $60 |
| CANNING CON IRR | $12.50 | $180 | $30 | $30 | $30 | $30 | $60 |
| IRR HAY | $10.00 | $180 | $30 | $30 | $30 | $30 | $60 |

---

## 4. Acres Summary

| Enterprise | Total Acres (Budget Fields) |
|---|---|
| Conventional Corn | 1,188.35 |
| Conventional Small Grain | 517.09 |
| Conventional Soybeans | 1,505.33 |
| Conv/Org Canning | 559.68 |
| Organic Small Grain | 250.76 |
| Organic Broadleaf | 596.40 |
| Organic Corn | 345.00 |
| (unassigned) | 40.00 |
| **TOTAL** | **5,002.61** |

---

## 5. Fields (56 Total)

Fields are grouped by enterprise. Each field entry includes: acres, rent/ac, seed variety, yield assumption, gov payments, and full inputs + machinery pass list.

---

### 5A. Conventional Corn (ent_0491) — 1,188 ac

---

#### Blue's
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 134.6 | **Rent/Ac:** $150.82
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 220 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.75 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.25 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| Tulls manure | 7 tons | Fall |
| KWS CC rye | 60 lbs | Fall |
| 0-0-60 Potash | 99 lbs | Fall |
| 0-46-0 Triple Super 15C | 176.96 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Buchanon Little
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 9.107 | **Rent/Ac:** $241.57
- **Seed:** P0035 @ 34,000 pop
- **Yield:** 220 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS CC+NT — $80/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.75 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.25 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 60 lbs | Fall |
| 0-0-60 Potash | 99 lbs | Fall |
| 0-46-0 Triple Super 15C | 176.96 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Carrol
- **System Code:** CON | **Crop:** White corn | **Type:** SINGLE CROP
- **Acres:** 149.8 | **Rent/Ac:** $162.38
- **Seed:** 1306W @ 34,000 pop
- **Yield:** 220 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS CC+NT — $80/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.75 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.25 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| Tulls manure | 7 tons | Fall |
| KWS CC rye | 60 lbs | Fall |
| 0-0-60 Potash | 99 lbs | Fall |
| 0-46-0 Triple Super 15C | 176.96 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Cuffs
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 148.01 | **Rent/Ac:** $199.99
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 200 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.5 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### New Life
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 8.0 | **Rent/Ac:** $343.75
- **Seed:** P0035 @ 34,000 pop
- **Yield:** 200 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 200 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Durango DMA (Bulk) | 36 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| 0-0-60 Potash | 90 lbs | Fall |
| 0-46-0 Triple Super 15C | 160.87 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Fagan
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 10.96 | **Rent/Ac:** $257.26
- **Seed:** P0035 @ 34,000 pop
- **Yield:** 200 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 200 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Durango DMA (Bulk) | 36 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| 0-0-60 Potash | 90 lbs | Fall |
| 18-46-0 DAP | 160.87 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Fox Den
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 8.9 | **Rent/Ac:** $100.00
- **Seed:** P0035 @ 34,000 pop
- **Yield:** 180 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 200 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 135 lbs | Spring |
| 0-0-60 Potash | 81 lbs | Fall |
| 0-46-0 Triple Super 15C | 144.78 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Fox-Kettle
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 47.66 | **Rent/Ac:** $117.33
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 220 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 185 lbs | Spring |
| PowerMax | 33 oz | Spring |
| Application - Post | 1 ac | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 99 lbs | Fall |
| 0-46-0 Triple Super 15C | 176.96 lbs | Fall |

**Machinery:** Disk x0.5; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Fox-Lemans
- **System Code:** CON IRR | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 14.14 | **Rent/Ac:** $105.02
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 200 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Durango DMA (Bulk) | 36 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Larson
- **System Code:** CON IRR | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 56.2 | **Rent/Ac:** $200.11
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 200 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 90 lbs | Fall |
| 0-46-0 Triple Super 15C | 160.87 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Noss, Jeff
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 31.0 | **Rent/Ac:** $151.31
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 200 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.75 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 90 lbs | Fall |
| 0-46-0 Triple Super 15C | 160.87 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Noss, Sid
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 102.0 | **Rent/Ac:** $199.31
- **Seed:** P05081 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.75 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Schwellenbach
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 29.16 | **Rent/Ac:** $174.90
- **Seed:** P08527 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Schultz
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 95.01 | **Rent/Ac:** $175.64
- **Seed:** P08527 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| SideDress N 46-0-0 | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Delong-Christpherson
- **System Code:** CON IRR | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 59.8 | **Rent/Ac:** $130.43
- **Seed:** P0720 @ 34,000 pop
- **Yield:** 220 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| KWS CC rye | 50 lbs | Spring |
| 0-0-60 Potash | 99 lbs | Fall |
| 0-46-0 Triple Super 15C | 176.96 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Gessley
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 200.0 | **Rent/Ac:** $235.00
- **Seed:** P08527 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** GOVT PMT / AC — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 220 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 50 lbs | Spring |
| Verdict (Bulk) | 13 oz | Spring |
| Outlook (Bulk) | 8 oz | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 200 lbs | Spring |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Noss, Jessie
- **System Code:** CON | **Crop:** Yellow Corn | **Type:** SINGLE CROP
- **Acres:** 84.0 | **Rent/Ac:** $207.43
- **Seed:** P08527 @ 34,000 pop
- **Yield:** 210 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Practical farmers SmGr Cost share — $0/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 200 lbs | Spring |
| 10-34-0 | 5 gal | Spring |
| Batallion LFC (2x2.5 Gal) | 11 oz | Spring |
| Application - Liquid Pre | 1 ac | Spring |
| 12-0-0-26 Amm Thio | 55.5 lbs | Spring |
| Resicore XL (Bulk) | 2.75 qt | Spring |
| Water | 5 gal | Spring |
| Armezon (6x32 Oz) | 0.75 oz | Spring |
| Meth Oil, Insource (2.25 Gal) | 1 pt | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Atrazine 4L | 1 pt | Spring |
| Application - Post | 1 ac | Spring |
| 46-0-0 SideDress N | 165 lbs | Spring |
| Tulls manure | 15 tons | Fall |
| 0-0-60 Potash | 94.5 lbs | Fall |
| 0-46-0 Triple Super 15C | 168.91 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Spinner x3; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

### 5B. Conventional Small Grain (ent_0492) — 517 ac

---

#### Buchanon Big
- **System Code:** CON | **Crop:** Hybrid Seed Rye | **Type:** SINGLE CROP
- **Acres:** 38.96 | **Rent/Ac:** $200.21
- **Seed:** Serafino @ 750,000 pop
- **Yield:** 80 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** STRAW — $30/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 180 lbs | Spring |
| 21-0-0-24s AMS Granular | 106.44 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Huskie (2x2.5 Gal) | 11 oz | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| NIS | 0.1 qt | Spring |
| Wi Tonnage Tax | 0.13 tons | Spring |
| Palisade Maxx (2x2.5 Gal) | 14 oz | Spring |
| Application - Post | 1 ac | Spring |
| Miravis ace (2x2.5 gal) | 13 oz | Spring |
| 0-0-60 Potash | 40 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Soil Finisher x1; Drill x1; Disk x1; Spinner x2; Trucking x1; Combine + Buggy x1

---

#### Elwood's
- **System Code:** CON | **Crop:** Hybrid Seed Rye | **Type:** SINGLE CROP
- **Acres:** 68.07 | **Rent/Ac:** $256.06
- **Seed:** ProGas @ 750,000 pop
- **Yield:** 80 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 180 lbs | Spring |
| 21-0-0-24s AMS Granular | 106.44 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Huskie (2x2.5 Gal) | 11 oz | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| NIS | 0.1 qt | Spring |
| Wi Tonnage Tax | 0.13 tons | Spring |
| Palisade Maxx (2x2.5 Gal) | 14 oz | Spring |
| Application - Post | 1 ac | Spring |
| Miravis ace (2x2.5 gal) | 13 oz | Spring |
| 0-0-60 Potash | 40 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Soil Finisher x1; Drill x1; Disk x1; Spinner x2; Trucking x1; Combine + Buggy x1

---

#### Townline Farms
- **System Code:** CON | **Crop:** Hybrid Seed Rye | **Type:** SINGLE CROP
- **Acres:** 267.06 | **Rent/Ac:** $250.00
- **Seed:** Serafino @ 750,000 pop
- **Yield:** 85 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 180 lbs | Spring |
| 21-0-0-24s AMS Granular | 106.44 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Huskie (2x2.5 Gal) | 11 oz | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| NIS | 0.1 qt | Spring |
| Wi Tonnage Tax | 0.13 tons | Spring |
| Palisade Maxx (2x2.5 Gal) | 14 oz | Spring |
| Application - Post | 1 ac | Spring |
| Miravis ace (2x2.5 gal) | 13 oz | Spring |
| KWS CC rye | 50 lbs | Fall |
| 0-0-60 Potash | 40 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x2; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

#### Wes's
- **System Code:** CON | **Crop:** Seed grade Winter Barley | **Type:** SINGLE CROP
- **Acres:** 143.0 | **Rent/Ac:** $125.87
- **Seed:** SB151 @ 1,500,000 pop
- **Yield:** 95 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $60/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| 46-0-0 Urea | 180 lbs | Spring |
| 21-0-0-24s AMS Granular | 106.44 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Huskie (2x2.5 Gal) | 11 oz | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| NIS | 0.1 qt | Spring |
| Wi Tonnage Tax | 0.13 tons | Spring |
| Miravis ace (2x2.5 gal) | 13 oz | Spring |
| Application - Post | 1 ac | Spring |
| KWS CC rye | 50 lbs | (season blank) |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x2; Trucking x1; Combine + Buggy x1; Chisle Plow x1

---

### 5C. Conventional Soybeans (ent_1272) — 1,505 ac

---

#### Airport
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 235.32 | **Rent/Ac:** $54.18
- **Seed:** 16Z25E @ 140,000 pop
- **Yield:** 50 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** GOVT PMT / AC — $80/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 140 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Planter x1; Combine + Buggy x1; Trucking x1; Spinner x1

---

#### Bakke
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 26.9 | **Rent/Ac:** $200.74
- **Seed:** 16Z25E @ 135,000 pop
- **Yield:** 70 Bu/ac | **Crop Insurance:** $40/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 128.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 95.65 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2; Spinner x1

---

#### Daun
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 11.0 | **Rent/Ac:** $125.00
- **Seed:** 16Z25E @ 140,000 pop
- **Yield:** 52 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 121.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 90.43 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2; Weed Zapper x2; Hooded Redball x1; Spinner x1

---

#### Delong-Meyer
- **System Code:** CON | **Crop:** High Oil Soybeans | **Type:** SINGLE CROP
- **Acres:** 59.26 | **Rent/Ac:** $122.85
- **Seed:** DF 262 @ 140,000 pop
- **Yield:** 60 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Outlook (Bulk) | 10 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| PowerMax | 22 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 140 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x1; Weed Zapper x1

---

#### Gessert East 250
- **System Code:** CON | **Crop:** Soybeans | **Type:** SINGLE CROP
- **Acres:** 250.0 | **Rent/Ac:** $281.81
- **Seed:** DF 214 @ 140,000 pop
- **Yield:** 70 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** GOVT PMT / AC — $0/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer (2x2.5 Gal) | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Outlook (Bulk) | 10 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| PowerMax | 22 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 163.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 121.74 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x1; Weed Zapper x2; Hooded Redball x1

---

#### Hoff
- **System Code:** CON | **Crop:** DF seed beans | **Type:** SINGLE CROP
- **Acres:** 74.24 | **Rent/Ac:** $272.54
- **Seed:** DF 262 @ 135,000 pop
- **Yield:** 55 Bu/ac | **Crop Insurance:** $23.68/ac
- **Gov Payment:** GOVT PMT / AC — $0/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer (2x2.5 Gal) | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Zidua sc | 2 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Boost | 1 gal | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| PowerMax | 20 oz | Spring |
| Liberty | 5 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 128.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 95.65 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x1; Weed Zapper x2; Hooded Redball x1

---

#### Inman
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 154.8 | **Rent/Ac:** $209.60
- **Seed:** 16Z25E @ 140,000 pop
- **Yield:** 70 Bu/ac | **Crop Insurance:** $40/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 128.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 95.65 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2; Spinner x1

---

#### Inman Brad's
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 47.9 | **Rent/Ac:** $236.51
- **Seed:** 16Z25E @ 135,000 pop
- **Yield:** 60 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** Delong GCS CC+ NT — $80/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Buccaneer 5 Extra | 32 oz | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 140 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Planter x1; Combine + Buggy x1; Trucking x1; Spinner x1

---

#### Klug North
- **System Code:** CON | **Crop:** High Oil Soybeans | **Type:** SINGLE CROP
- **Acres:** 79.0 | **Rent/Ac:** $175.00
- **Seed:** DF 262 @ 135,000 pop
- **Yield:** 58 Bu/ac | **Crop Insurance:** $23.68/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer | 10 oz | Spring |
| Zidua sc | 2 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.8 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 0.96 pack | Spring |
| Ppst 120 (140K) Inoculant | 0.96 pack | Spring |
| Seed Treatment Application (Unit) | 0.96 unit | Spring |
| PowerMax | 20 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 135.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 100.87 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x1; Weed Zapper x2; Hooded Redball x1; Spinner x1

---

#### Klug/Davis South
- **System Code:** CON | **Crop:** High Oil Soybeans | **Type:** SINGLE CROP
- **Acres:** 136.01 | **Rent/Ac:** $170.36
- **Seed:** DF 262 @ 135,000 pop
- **Yield:** 58 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Zidua sc | 2 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 0.96 pack | Spring |
| Ppst 120 (140K) Inoculant | 0.96 pack | Spring |
| Seed Treatment Application (Unit) | 0.96 unit | Spring |
| PowerMax | 20 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 135.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 100.87 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2; Weed Zapper x2; Hooded Redball x1; Spinner x1

---

#### Lake
- **System Code:** CON | **Crop:** High Oil Soybeans | **Type:** SINGLE CROP
- **Acres:** 17.0 | **Rent/Ac:** $158.12
- **Seed:** DF 262 @ 135,000 pop
- **Yield:** 55 Bu/ac | **Crop Insurance:** $40/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Zidua sc | 2 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 0.96 pack | Spring |
| Ppst 120 (140K) Inoculant | 0.96 pack | Spring |
| Seed Treatment Application (Unit) | 0.96 unit | Spring |
| PowerMax | 20 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 128.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 95.65 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2; Weed Zapper x2; Hooded Redball x1

---

#### Murray
- **System Code:** CON | **Crop:** High Oil Soybeans | **Type:** SINGLE CROP
- **Acres:** 135.0 | **Rent/Ac:** $168.18
- **Seed:** DF 262 @ 135,000 pop
- **Yield:** 55 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Zidua sc | 2 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 0.96 pack | Spring |
| Ppst 120 (140K) Inoculant | 0.96 pack | Spring |
| Seed Treatment Application (Unit) | 0.96 unit | Spring |
| PowerMax | 20 oz | Fall |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 128.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 95.65 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2; Weed Zapper x2

---

#### Noss. Torkelson
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 79.4 | **Rent/Ac:** $181.36
- **Seed:** 16Z25E @ 140,000 pop
- **Yield:** 60 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 140 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x0.2

---

#### phillhower west
- **System Code:** CON | **Crop:** Soybeans | **Type:** SINGLE CROP
- **Acres:** 154.0 | **Rent/Ac:** $201.30
- **Seed:** DF 214 @ 135,000 pop
- **Yield:** 60 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer (2x2.5 Gal) | 8 oz | Spring |
| Cobra (2x2.5 Gal) | 12.5 oz | Spring |
| Zidua sc | 2 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 0.96 pack | Spring |
| Ppst 120 (140K) Inoculant | 0.96 pack | Spring |
| Seed Treatment Application (Unit) | 0.96 unit | Spring |
| PowerMax | 20 oz | Fall |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 140 lbs | Fall |
| 0-46-0 Triple Super 15C | 104.35 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Combine + Buggy x2; Trucking x0.2; Weed Zapper x2

---

#### suiter
- **System Code:** CON | **Crop:** RR Soybeans | **Type:** SINGLE CROP
- **Acres:** 14.0 | **Rent/Ac:** $135.71
- **Seed:** 16Z25E @ 135,000 pop
- **Yield:** 60 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| PowerMax | 22 oz | Spring |
| Enlist | 1.4 pts | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 0.5 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 1 pack | Spring |
| Ppst 120 (140K) Inoculant | 1 pack | Spring |
| Seed Treatment Application (Unit) | 1 unit | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 116.67 lbs | Fall |
| 0-46-0 Triple Super 15C | 86.96 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Combine + Buggy x2; Trucking x0.2; Weed Zapper x2

---

#### Twist dry
- **System Code:** CON | **Crop:** Soybeans | **Type:** SINGLE CROP
- **Acres:** 31.5 | **Rent/Ac:** $200.00
- **Seed:** DF 214 @ 140,000 pop
- **Yield:** 52 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:**

| Product | Qty | Season |
|---|---|---|
| Application - Liquid Pre | 1 ac | Spring |
| Mauler (2x2.5 Gal) | 6 oz | Spring |
| Sonic (2x7.5 Lb) | 0.31 lbs | Spring |
| Application - Post | 1 ac | Spring |
| Volunteer | 8 oz | Spring |
| Forsyte 1.88 SL (2x2.5 Gal) | 1.25 pts | Spring |
| Zidua sc | 2 oz | Spring |
| Crop Oil, Insource (2x2.5 Gal) | 1.27 pts | Spring |
| Premium Ams (51 Lb) | 2 lbs | Spring |
| Ppst Fst/Ist (140K) Seed Treatment | 0.96 pack | Spring |
| Ppst 120 (140K) Inoculant | 0.96 pack | Spring |
| Seed Treatment Application (Unit) | 0.96 unit | Spring |
| PowerMax | 20 oz | Spring |
| Wi Tonnage Tax | 0.1 tons | Fall |
| 0-0-60 Potash | 121.33 lbs | Fall |
| 0-46-0 Triple Super 15C | 90.43 lbs | Fall |

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Combine + Buggy x2; Trucking x0.2; Weed Zapper x2

---

### 5D. Conv/Org Canning (ent_1875) — 560 ac (double-cropped fields count twice)

Note: "Gessert west 111" and "phillhower east" are DBL CROP fields — each has a Peas crop and a Snap Beans crop budgeted separately. The 559.68 total includes each split counted once at the field level.

---

#### Gessert west 111 — Peas (DBL CROP, first crop)
- **System Code:** CANNING CON IRR | **Crop:** Peas | **Type:** DBL CROP
- **Acres:** 111.0 | **Rent/Ac:** $140.91
- **Seed:** SEED CORN @ 200,000 pop
- **Yield:** 1.5 Tons/ac | **Crop Insurance:** $76/ac
- **Gov Payment:** DL CSC — $0/ac

**Inputs:** Application - Liquid Pre [1 ac]; Prowl H2O (2x2.5 Gal) [1.5 pts]; Sharpen Sc (2x1 Gal) [1 oz]; 32% Nitrogen [3 gal]; 12-0-0-26 Amm Thio [50 lbs]; 0-46-0 Triple Super 15C [75 lbs] (Fall); 0-0-60 Potash [60 lbs] (Fall); Wi Tonnage Tax [0.1] (Fall); Basagran (2x2.5 Gal) [31.57 oz] (Spring); Application - Post [1 ac]

**Machinery:** Disk x1; Soil Finisher x2; Chisle Plow x1; Drill x1

---

#### Gessert west 111 — Snap Beans (DBL CROP, second crop)
- **System Code:** CANNING CON IRR | **Crop:** Snap Beans | **Type:** DBL CROP
- **Acres:** 111.0 | **Yield:** 5 Tons/ac | **Crop Insurance:** $81/ac

**Inputs:** 12-0-0-26 Amm Thio [55 lbs]; 28% Nitrogen [25 gal]; Prowl H2O [1 pt]; Thunder Master [36 oz]; Basagran [19.85 oz]; Crop Oil [26.45 pts]; Premium Ams [1.63 lbs]; Application - Post [0.82 ac]; 0-46-0 Triple Super 15C [75 lbs] (Fall); 0-0-60 Potash [60 lbs] (Fall); Wi Tonnage Tax [0.1] (Fall); PowerMax [22] (Fall); Basagran [31.57 oz] (Spring); Application - Post [1 ac]; KWS CC rye [50 lbs] (Spring)

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Hooded Redball x1; Weed Zapper x1; Chisle Plow x1

---

#### Home
- **System Code:** CANNING CON | **Crop:** Lima Beans | **Type:** SINGLE CROP
- **Acres:** 45.0 | **Rent/Ac:** $194.44
- **Seed:** CANNING @ 200,000 pop
- **Yield:** 1.2 Tons/ac | **Crop Insurance:** $62.85/ac
- **Gov Payment:** GOVT PMT / AC — $0/ac

**Inputs:** 32% Nitrogen [22.62 gal]; 12-0-0-26 Amm Thio [50 lbs]; Prowl H2O (2x2.5 Gal) [2.5 pts]; Thunder Master [36 oz]; Application - Liquid Ppi [1 ac]; 18-46-0 DAP [39 lbs] (Fall); 0-0-60 Potash [75 lbs] (Fall); Wi Tonnage Tax [0.1] (Fall); PowerMax [22] (Fall); Basagran [31.57 oz] (Spring); Application - Post [1 ac]

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Hooded Redball x1; Weed Zapper x1

---

#### Jehovah
- **System Code:** CANNING CON | **Crop:** Lima Beans | **Type:** SINGLE CROP
- **Acres:** 22.28 | **Rent/Ac:** $148.11
- **Yield:** 1.2 Tons/ac | **Crop Insurance:** $62.85/ac
- **Gov Payment:** GOVT PMT / AC — $0/ac

**Inputs:** (same inputs as Home above)

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Hooded Redball x1; Weed Zapper x1

---

#### phillhower east — Peas (DBL CROP, first crop)
- **System Code:** CANNING CON IRR | **Crop:** Peas | **Type:** DBL CROP
- **Acres:** 135.2 | **Rent/Ac:** $199.70
- **Seed:** CANNING @ 200,000 pop
- **Yield:** 2 Tons/ac | **Crop Insurance:** $76/ac
- **Gov Payment:** DL CSC — $0/ac

**Inputs:** Application - Liquid Pre [1 ac]; Prowl H2O (2x2.5 Gal) [1.5 pts]; Sharpen Sc (2x1 Gal) [1 oz]; 32% Nitrogen [3 gal]; 12-0-0-26 Amm Thio [50 lbs]; 0-46-0 Triple Super 15C [75 lbs] (Fall); 0-0-60 Potash [60 lbs] (Fall); Wi Tonnage Tax [0.1] (Fall); Basagran [31.57 oz] (Spring); Application - Post [1 ac]

**Machinery:** Disk x1; Soil Finisher x2; Chisle Plow x1; Drill x1

---

#### phillhower east — Snap Beans (DBL CROP, second crop)
- **System Code:** CANNING CON IRR | **Crop:** Snap Beans | **Type:** DBL CROP
- **Acres:** 135.2 | **Yield:** 5 Tons/ac | **Crop Insurance:** $81/ac

**Inputs:** (same as Gessert west 111 Snap Beans)

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Hooded Redball x1; Weed Zapper x1; Chisle Plow x1

---

### 5E. Organic Small Grain (ent_2120) — 251 ac

---

#### Caravilla
- **System Code:** ORG | **Crop:** ORG Wheat | **Type:** SINGLE CROP
- **Acres:** 14.0 | **Rent/Ac:** $0.07 (essentially free/owned)
- **Seed:** 801 @ 1,500,000 pop
- **Yield:** 70 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:** Mint castings [15 tons] (Spring); S04 30% [100 lbs] (Spring)

**Machinery:** Disk x2; Soil Finisher x1; Drill x1; Combine + Buggy x1; Trucking x0.2; Tine Weed 80 x1; Spinner x1

---

#### Fletcher-Cribben
- **System Code:** ORG | **Crop:** ORG Wheat | **Type:** SINGLE CROP
- **Acres:** 116.58 | **Rent/Ac:** $225.08
- **Seed:** 801 @ 1,500,000 pop
- **Yield:** 65 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:** S04 30% [80 lbs] (Spring); Mint castings [15 tons] (Fall)

**Machinery:** Disk x2; Soil Finisher x1; Drill x1; Combine + Buggy x1; Trucking x0.1; Tine Weed 80 x1; Spinner x1

---

#### OM1
- **System Code:** ORG | **Crop:** ORG Wheat | **Type:** SINGLE CROP
- **Acres:** 32.18 | **Rent/Ac:** $224.86
- **Seed:** 801 @ 1,500,000 pop
- **Yield:** 65 Bu/ac | **Crop Insurance:** $20/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:** S04 30% [80 lbs] (Spring); Tulls manure [25 tons] (Fall); Red Clover [8 lbs] (Spring)

**Machinery:** Disk x2; Soil Finisher x1; Drill x1; Combine + Buggy x1; Trucking x1; Tine Weed 80 x1; Spinner x1

---

#### OM2
- **System Code:** ORG | **Crop:** ORG Wheat | **Type:** SINGLE CROP
- **Acres:** 48.0 | **Rent/Ac:** $55.24
- **Seed:** 801 @ 1,500,000 pop
- **Yield:** 65 Bu/ac | **Crop Insurance:** $45/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:** S04 30% [80 lbs] (Spring); Mint castings [15 tons] (Fall)

**Machinery:** Disk x2; Soil Finisher x1; Drill x1; Combine + Buggy x1; Trucking x0.2; Tine Weed 80 x1; Spinner x1

---

#### Turkey Deer
- **System Code:** ORG IRR | **Crop:** ORG Wheat | **Type:** SINGLE CROP
- **Acres:** 40.0 | **Rent/Ac:** $220.50
- **Seed:** 801 @ 1,500,000 pop
- **Yield:** 65 Bu/ac | **Crop Insurance:** $45/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:** Mint castings [7 tons] (Spring); S04 30% [80 lbs] (Spring); Tulls manure [13 tons] (Spring)

**Machinery:** Disk x2; Soil Finisher x1; Drill x1; Combine + Buggy x1; Trucking x0.2; Tine Weed 80 x1; Spinner x1

---

### 5F. Organic Broadleaf (ent_2185) — 596 ac

---

#### Goat pasture
- **System Code:** ORG | **Crop:** ORG Natto Beans | **Type:** SINGLE CROP
- **Acres:** 104.0 | **Rent/Ac:** $270.79
- **Seed:** PS151 @ 200,000 pop
- **Yield:** 40 Bu/ac | **Crop Insurance:** $36/ac
- **Gov Payment:** GOVT PMT / AC — $0/ac

**Inputs:** 0-0-50 OMRI [140 lbs] (Fall); S04 30% [80 lbs] (Spring); BioActive Liquilife + [2.5 gal] (Spring); TeraFed [2.5 gal] (Spring); Rye seed [1 bu] (Fall)

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x2; Rotary Hoe 60 x1; Tine weed 60 x2; Cultivator 12 x3; Weed Zapper x2; Combine + Buggy x1; Trucking x1

---

#### Kopp Soybeans
- **System Code:** ORG | **Crop:** ORG Soybeans | **Type:** SINGLE CROP
- **Acres:** 128.0 | **Rent/Ac:** $270.15
- **Yield:** 45 Bu/ac | **Crop Insurance:** $36/ac
- **Gov Payment:** (none) — $0/ac
- **Note:** No inputs or machinery entered in budget

---

#### OMNI BIG SOUTH
- **System Code:** ORG IRR | **Crop:** ORG Soybeans | **Type:** SINGLE CROP
- **Acres:** 320.0 | **Rent/Ac:** $273.42
- **Seed:** VIKING 2155 @ 190,000 pop
- **Yield:** 45 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** Delong GCS — $70/ac

**Inputs:** 0-0-50 OMRI [140 lbs] (Spring); S04 30% [80 lbs] (Spring); BioActive Liquilife + [2.5 gal] (Spring); TeraFed [2.5 gal] (Spring)

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x1; Tine Weed 80 x2; Rotary Hoe 60 x1; Cultivator 12 x2; Weed Zapper x3; Combine + Buggy x1; Trucking x0.07

---

#### Simpsons Soybeans
- **System Code:** ORG | **Crop:** GA ORG SEED BEANS | **Type:** SINGLE CROP
- **Acres:** 44.4 | **Rent/Ac:** $250.72
- **Seed:** SG 223OR @ 180,000 pop
- **Yield:** 35 Bu/ac | **Crop Insurance:** $36/ac
- **Gov Payment:** (none) — $0/ac

**Inputs:** 0-0-50 OMRI [140 lbs] (Spring); S04 30% [80 lbs] (Fall); BioActive Liquilife + [2.5 gal] (Spring); TeraFed [2.5 gal] (Spring)

**Machinery:** Disk x2; Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x1; Tine weed 60 x2; Spinner x1; Weed Zapper x3; Cultivator 12 x3

---

### 5G. Organic Corn (ent_2056) — 345 ac

---

#### Kopp Seed Corn
- **System Code:** ORG | **Crop:** ORG Seed Corn | **Type:** SINGLE CROP
- **Acres:** 90.0 | **Rent/Ac:** $270.15
- **Yield:** 40 Bu/ac | **Crop Insurance:** $36/ac
- **Gov Payment:** (none) — $0/ac

**Inputs:** 0-0-50 OMRI [140 lbs] (Fall); S04 30% [80 lbs] (Spring); BioActive Liquilife + [2.5 gal] (Spring); TeraFed [2.5 gal] (Spring); Rye seed [1 bu] (Spring)

**Machinery:** Disk x2; Soil Finisher x2; Planter x1; Combine + Buggy x1; Trucking x1; Cultivator 12 x2; Weed Zapper x2; Tine weed 60 x2

---

#### Omni GRASSY KNOLL
- **System Code:** ORG IRR | **Crop:** ORG Blue Corn | **Type:** SINGLE CROP
- **Acres:** 90.0 | **Rent/Ac:** $273.42
- **Seed:** T1081J @ 32,000 pop
- **Yield:** 120 Bu/ac | **Crop Insurance:** $25/ac
- **Gov Payment:** GOVT PMT / AC — $0/ac

**Inputs:** 0-0-50 OMRI [140 lbs] (Spring); S04 30% [80 lbs] (Spring); BioActive Liquilife + [2.5 gal] (Spring); TeraFed [2.5 gal] (Spring); [blank product] [2.6] (Spring)

**Machinery:** Disk x1; Soil Finisher x2; Planter x1; Spinner x1; Tine Weed 80 x1; Tine weed 60 x2; Cultivator 12 x3; Weed Zapper x2; Combine + Buggy x1; Trucking x1

---

#### Simpsons Seed Corn
- **System Code:** ORG IRR | **Crop:** ORG Seed Corn | **Type:** SINGLE CROP
- **Acres:** 165.0 | **Rent/Ac:** $250.72
- **Yield:** 40 Bu/ac | **Crop Insurance:** $0/ac
- **Gov Payment:** (none) — $0/ac

**Inputs:** Chicken Litter [2 tons] (Spring); SPE-120 dry [1 oz] (Spring); S04 30% [150 lbs] (Spring); Tulls manure [25 tons] (Spring); BioActive Liquilife + [2.5 gal] (Spring); TeraFed [2.5 gal] (Spring); BioRepel [2 oz] (Spring); Eco Tec [6 oz] (Spring); SPE-120 dry [1 oz] (Spring); Acomplish Max [25 oz] (Spring); Red Clover [10 lbs] (Fall)

**Machinery:** Disk x2; Soil Finisher x2; Planter x1; Tine weed 60 x2; Spinner x1; Cultivator 12 x3; Combine + Buggy x1; Trucking x1; Chisle Plow x1

---

### 5H. Unassigned Fields

#### New South 40
- **Enterprise:** (none) | **System Code:** (none) | **Crop:** (none)
- **Acres:** 40.0 | **Rent/Ac:** $0.00
- No inputs or machinery — placeholder field

---

## 6. Seeds (29 Entries)

| ID | Crop | Brand | Variety | Price/Unit | Seeds/Unit | Organic? |
|---|---|---|---|---|---|---|
| seed_0323 | Barley | Albert Lea | SB151 | $15.00 | 672,000 | No |
| seed_0324 | Blue_Corn | Kentucky Blue Corn | T1081J | $325.00 | 80,000 | No |
| seed_0326 | Soybeans | DF seeds | DF 262 | $50.00 | 140,000 | No |
| seed_0327 | Soybeans | DF seeds | DF 214 | $47.84 | 140,000 | No |
| seed_0331 | Hybrid Rye | KWS | ProGas | $175.00 | 1,000,000 | No |
| seed_0332 | Hybrid_Rye | KWS | Receptor | $175.00 | 750,000 | No |
| seed_0333 | Hybrid_Rye | KWS | Serafino | $125.00 | 750,000 | No |
| seed_0340 | SEED_CORN | (blank) | SEED CORN | ~$0 | 80,000 | No |
| seed_0343 | Soybeans | Pioneer | 16Z25E | $55.76 | 140,000 | No |
| seed_0344 | Soybeans | Pioneer | 21A20 | $44.16 | 140,000 | No |
| seed_0345 | Soybeans | Pioneer | 26A20 | $48.91 | 140,000 | No |
| seed_0347 | Soybeans | Pioneer | P26Z86E | $53.04 | 140,000 | No |
| seed_0348 | Soybeans | viking | VIKING 2155 | $51.00 | 140,000 | No |
| seed_0349 | Soybeans | puris | PS151 | $39.00 | 140,000 | No |
| seed_0350 | soybeans | Viking | O.2418 | $52.25 | 140,000 | No |
| seed_0353 | soybeans | GRO ALLIANCE | SG 202OR | $51.00 | 140,000 | No |
| seed_0354 | soybeans | GRO ALLIANCE | SG 155OR | $51.00 | 140,000 | No |
| seed_0355 | soybeans | GRO ALLIANCE | SG 223OR | $51.00 | 140,000 | No |
| seed_0356 | Sunflowers | Pioneer | P63HE920 | $224.11 | 200,000 | No |
| seed_0362 | Wheat | Viking | 844 | $31.00 | 750,000 | No |
| seed_0363 | Wheat | Viking | 801 | $31.00 | 750,000 | No |
| seed_0365 | White_Corn | Pioneer | 1306W | $207.40 | 80,000 | No |
| seed_0369 | Yellow_Corn | Pioneer | P0157 | $175.50 | 80,000 | No |
| seed_0370 | Yellow_Corn | Pioneer | P0075 | $201.50 | 80,000 | No |
| seed_0371 | Yellow_Corn | Pioneer | P0720 | $211.20 | 80,000 | No |
| seed_0372 | Yellow_Corn | Pioneer | P05081 | $217.80 | 80,000 | No |
| seed_0373 | Yellow_Corn | Pioneer | P08527 | $208.00 | 80,000 | No |
| seed_0380 | Yellow_Corn | Pioneer | P1185 | $227.04 | 80,000 | No |
| seed_0381 | Yellow_Corn | Pioneer | P0035 | $217.80 | 80,000 | No |

---

## 7. Products (205 Total)

Note: No products have costPerUnit populated in this data — costs are pulled live from supplier quotes. The product list serves as the input catalog.

### Fertilizer (48 products)
0-0-5-10Ca-2.5Mg-12.4S (Lbs) | 0-0-50-17s (Lbs) | 0-0-50 OMRI (Lbs) | 0-0-60 Potash (Lbs) | 0-1-25-11S (Lbs) | 0-20-0 OMRI (OZ) | 0-46-0 Triple Super 15C (Lbs) | 10-34-0 (Gal) | 12-0-0-26 Amm Thio (Lbs) | 13-0-0-15 Zn (Gal) (Gal) | 18-46-0 DAP (Lbs) | 21-0-0-24s AMS Granular (Lbs) | 28% Nitrogen (Gal) | 32% Nitrogen (Gal) | 46-0-0 Urea (Lbs) | 50/50 Blend feather meal+Pellets (Tons) | 6-0-8-5S + Micro (Lbs) | 98G (Lbs) | AER Boron (Gal) | Ag Lime (Lbs) | Allganic Liquid 15-0-2 (Lbs) | Application - Tons Of Lime Applied (Tons) | Boost (Gal) | Boron O (Quart) | Chick Magic Pellets (Lbs) | Chicken crumbles (Tons) | chicken crumbles OMRI (Lbs) | Chicken Litter (Tons) | chilean nitrate (Lbs) | compost tea LLC (Gal) | copper sulfate fine ground (Lbs) | copper sulfate granular (Lbs) | Coron (Gal) | custom compost hauling (Tons) | Daluge Manure (Gal) | Dramm E (Gal) | Dramm O (fish) (Gal) | DRAMM ONE (Gal) | ESN 44-0-0 (Lbs) | feathermeal (Lbs) | Forti-Cal (Lbs) | Forti-Phos (Lbs) | gold oaks compost (Tons) | Gypsum (Tons) | Janesville complete compost (Tons) | Jason litter/compost mix (Tons) | Magnesium Sulfate (Lbs) | Manganese L (Quart) | MBA Custom Hughes Blend 0-0-5-10.8C-2.5MG-12.5 (Lbs) | MicroHum (Lbs) | Mint castings (Tons) | non organic s04 (Lbs) | Organical (Lbs) | Pell Lime (Lbs) | Premium Ams (51 Lb) (Lbs) | Purple Cow Classic Compost (Tons) | S04 30% (Lbs) | 46-0-0 SideDress N (lbs) | Sustane (Lbs) | TeraFed (Gal) | Tulls manure (Tons) | Zone N Plus (Lbs) | Zone Tr-3 (OZ) | Zinc L (Quart) | Zinc-Ammoniated 15% (qt) | 15-0-1 AMINO15 (Gal) | Zinc-Citric Chelate 10% (Delong) (oz)

### Chemical (74 products)
Accent Q (18 oz) | Accuquest WM (2x2.5 Gal) | Armezon (6x32 Oz) | Atrazine 4L | Atrazine 90DF (25 lb) | Authority First DF (2x10 Lb) | Backstop | Basagran (2x2.5 Gal) | Batallion LFC (2x2.5 Gal) | Blazer 94x1 Gal) | Buccaneer 5 Extra | Butyrac 200 (2x2.5 Gal) | Calisto | Capture LFR (2x2.5 Gal) | Cavallo | Ceridian 2 EC (2x2.5 Gal) | Clarity (2x2.5 Gal) | Cobra (2x2.5 Gal) | cortes MAXX insecticide | Crop Oil, Insource (2x2.5 Gal) | Demize Herbicide and Adjuvant | Dicamba | Dicamba DMA | Distinct (2x7.5 Lb) | Durango DMA (2X2.5 Gal) | Durango DMA (Bulk) | Enlist | Ester 2,4-D LV (2x2.5 Gal) | Flexstar (2x2.5 Gal) | Forsyte 1.88 SL (2x2.5 Gal) | Headline amp | Hexus D (5x12 Lb) | Homeplate | Huskie (2x2.5 Gal) | Ilevo Nematicide/SDS (140K) | Inflame 280SL (265 Gal) | Laudis (4x128 oz) | Liberty | Mauler (2x2.5 Gal) | Meth Oil (265 Gal) | Meth Oil, Insource (2.25 Gal) | Miravis ace (2x2.5 gal) | Mustang MAX | NIS | Outlook (Bulk) | Palisade Maxx (2x2.5 Gal) | Pantego | Plexus II (2x2.5 Gal) | PowerMax | Prowl H20 (Bulk) | Prowl H2O (2x2.5 Gal) | Raptor (2x1 Gal) | Resicore XL (Bulk) | RoundUp | Sharpen Sc (2x1 Gal) | Soil suppliment | Sonic (2x7.5 Lb) | Status (4x125 Oz) | Surfactant, Insource | Thunder Master (2x2.5 Gal) | Ultim-ST | Valor Sx (4x5 Lb) | Veltyma (2x2.5 Gal) | Verdict (Bulk) | Volunteer (2x2.5 Gal) | Water | Weedone LV-4 EC (Ester) (2x2.5 Gal) | Zidua pro | Zidua sc | Pemex (2x1 Gal) | Sandea (24x10 oz) | Strellius II (265 gal) | Satellite HydroCAP | Steadfast Q (60 oz) | Veracity Elite II | Interline (250 Gal) | TriCor 4F (2x2.5 Gal)

### Biological (21 products)
01-YS (OZ) | Acomplish Max (OZ) | AER MVP (Gal) | beneficial nematoads (Acre) | Bio-Cal (Lbs) | BioActive Liquilife + (Gal) | BioRepel (OZ) | chitosan (OZ) | Eco Tec (OZ) | ENDO 25 (OZ) | living carbon (lbs) | Mt-17 (Gal) | MVP (Gal) | MycoGold (OZ) | N-Fix (OZ) | Oroboost (Gal) | Regalia RX (Quart) | Rhizolizer Duo OMRI (OZ) | Rhizolozer DUO (OZ) | Rhizolozer Prime (OZ) | SBB-2.5 dry (OZ) | SPE-120 dry (OZ) | Utrisha (OZ)

### Seed (11 products)
KWS CC rye (Lbs) | Oats Ogle (50 lb.) (Tons) | Oats Ogle (Bulk) (Tons) | Ppst Fst (140K) Seed Treatment (Pack) | Ppst Fst/Ist (140K) Seed Treatment (Pack) | Red Clover (Lbs) | Rye seed (Bu) | Seed Pro Box (Tons) | Seed Treatment Application (Unit) (UNIT) | Seed tratment application (Each)

### Other (51 products)
AER K-Sulfate (Gal) | Aerial application (Acre) | Application - Burndown (Acre) | Application - Liquid Ppi (Acre) | Application - Liquid Pre (Acre) | Application - Post (Acre) | Application - Spinner (Acre) | Application - Vrt (Acre) | Application - VRT Spinner (Acre) | Custom Application (Acre) | Enerpex (OZ) | Exceed Dry bean (OZ) | Exceed Soy Inoculant (30 Unit) (UNIT) | Fall 22 Kutz Litter (Tons) | Grid Sampling (2.5 ac.) (Acre) | Grid Sampling (5 ac.) (Acre) | Jumbo Bagd (Each) | MCPA (Tons) | Micro Sampling (Each) | Mixing charge (Lbs) | Ms-Crystals (OZ) | Other (Tons) | Plexus II (Tons) | Ppst 120 (140K) Inoculant (Pack) | savy crew (Acre) | Tenesse brown (OZ) | Weed Slayer (Gal) | Wi Tonnage Tax (Tons)

---

## 8. Crop Pricing (51 Entries)

| Crop | $/Unit | Basis | Unit | Default Moisture |
|---|---|---|---|---|
| CBOT Corn | $4.58 | $0.00 | Bu | 15.5% |
| Yellow Corn | $4.30 | -$0.28 | Bu | 15.5% |
| RR Soybeans | $10.17 | -$0.75 | Bu | 13% |
| Soybeans | $12.42 | +$1.50 | Bu | 13% |
| High Oil Soybeans | $13.07 | +$2.15 | Bu | 13% |
| CBOT beans | $10.92 | $0.00 | Bu | 13% |
| Wheat | $5.44 | $0.00 | Bu | 13.5% |
| MIlling Rye | $5.00 | $0.00 | Bu | 13.5% |
| Hybrid Seed Rye | $11.50 | $0.00 | Bu | 13.5% |
| IRR Sweet Corn | $85.00 | $0.00 | Tons | 15.5% |
| Lima Beans | $625.00 | $0.00 | Tons | 13% |
| Peas | $337.00 | $0.00 | Tons | 13% |
| Snap Beans | $115.00 | $0.00 | Tons | 13% |
| Hemp | $0.52 | $0.00 | Lbs | 10% |
| White Sorghum | $6.08 | +$1.50 | Bu | 13% |
| Red Sorghum | $5.58 | +$1.00 | Bu | 13% |
| Seed Corn | $4.58 | +$4.58 | Bu | 15.5% |
| Hay/ ton DM | $170.00 | $0.00 | Tons | 15% |
| ORG Yellow Corn | $8.00 | $0.00 | Bu | 15.5% |
| ORG White Corn | $11.00 | $0.00 | Bu | 15.5% |
| ORG Blue Corn | $15.00 | $0.00 | Bu | 15.5% |
| ORG Soybeans | $21.75 | $0.00 | Bu | 13% |
| ORG Wheat | $7.75 | $0.00 | Bu | 13.5% |
| ORG Rye | $8.00 | $0.00 | Bu | 13.5% |
| ORG Sunflowers | $0.45 | $0.00 | Lbs | 10% |
| ORG snap beans | $360.00 | $0.00 | Tons | 13% |
| ORG feed barley | $7.00 | $0.00 | Bu | 13.5% |
| ORG Peas | $580.00 | $0.00 | Tons | 13% |
| RR Corn | $4.23 | -$0.35 | Bu | 15.5% |
| ORG Hemp | $1.35 | $0.00 | Lbs | 10% |
| ORG Sorghum | $6.00 | $0.00 | Bu | 13% |
| ORG Hay | $100.00 | $0.00 | Tons | 15% |
| ORG Seed Corn | $45.00 | $0.00 | Bu | 15.5% |
| ORG Hairy Vetch | $1.25 | $0.00 | Lbs | 12% |
| ORG Barley | $8.98 | $0.00 | Bu | 13.5% |
| ORG seed wheat | $10.00 | $0.00 | Bu | 13.5% |
| ORG Food Corn | $10.25 | $0.00 | Bu | 15.5% |
| ORG KERNZA | $6.00 | $0.00 | Bu | 13% |
| ORG Field Peas | $20.25 | $0.00 | Bu | 13% |
| ORG FOOD BEANS | $25.00 | $0.00 | Bu | 13% |
| Org sweet Corn | $238.00 | $0.00 | Tons | 15.5% |
| GA ORG SEED BEANS | $27.50 | $0.00 | Bu | 13% |
| ORG SEED BEANS | $27.50 | $0.00 | Bu | 13% |
| DRY Land sweetcorn | $84.00 | $0.00 | Tons | 15.5% |
| comp white corn | $6.79 | $0.00 | Bu | 15.5% |
| comp yellow | $3.90 | $0.00 | Bu | 0% |
| comp soybeans | $16.07 | $0.00 | Bu | 13% |
| comp sorghum | $5.65 | +$1.75 | Bu | 13% |
| Seed grade Winter Barley | $8.50 | $0.00 | Bu | 13.5% |
| DF seed beans | $14.05 | $0.00 | Bu | 13% |
| Japan beans | $28.75 | $0.00 | Bu | 13% |

Interest rate: 6% on all crops. Drying rates vary (0.30/Bu for corn, 0.20/Bu for rye, 0.002 for sunflowers, etc.).

---

## 9. Buyers (5)

| ID | Name |
|---|---|
| buy_0479 | United Ethanol – Milton |
| buy_0480 | DeLong – Clinton (NON-GMO) |
| buy_0481 | Farm City – Brodhead |
| buy_0482 | ALCIVIA – Evansville |
| buy_0483 | DeLong – Avalon |

---

## 10. Rent Records (96 records, 49 active)

**Active records only** (active=true):

| Field Name | Short Code | Acres | Rate/Ac | Total Rent |
|---|---|---|---|---|
| Airport | AIR | 230.00 | $54.86 | $12,617.80 |
| Bakke | BAK | 26.9 | $200.74 | $5,400.00 |
| Blues | (blank) | 134.6 | $150.82 | $20,300.00 |
| Buchanon Little | BUCH | 9.107 | $241.57 | $2,200.00 |
| Caravilla | CARA | 14.66 | $131.24 | $1,924.00 |
| Carrol | CARR | 151.67 | $160.38 | $24,325.00 |
| Cuffs | CUFF | 147.53 | $200.64 | $29,600.00 |
| Daun | DAUN | 10.9 | $126.15 | $1,375.00 |
| Delong- Christpherson | DLCH | 64.32 | $121.27 | $7,800.00 |
| Delong-Avon | AVON | 41.77 | $127.60 | $5,330.00 |
| Delong-Meyer | MEYE | 64.6 | $112.69 | $7,280.00 |
| Elwood's | ELWO | 67.63 | $257.72 | $17,429.76 |
| Fagan | FAGAN | 11.13 | $253.33 | $2,819.52 |
| Fletcher-Cribben | CRIB | 116.58 | $223.00 | $26,239.50 |
| Fox Den | FDEN | 8.925 | $0.00 | $0.00 |
| Fox-Kettle | KETT | 44.0 | $127.09 | $5,592.00 |
| Fox-Lemans | LEM | 14.3 | $103.85 | $1,485.00 |
| Gessert High oil beans | GSRT | 265.0 | $276.53 | $72,456.30 |
| Gessert total | GSRT | 361.06 | $276.53 | $102,805.92 |
| Gessley | GESS | 188.0 | $250.00 | $47,000.00 |
| Goat pasture | GOAT | 103.0 | $276.53 | $28,162.26 |
| Hoff | HOFF | 74.0 | $276.53 | $20,233.08 |
| Home | HOME | 37.6 | $232.71 | $8,750.00 |
| Inman | INMNC | 154.82 | $209.57 | $32,445.50 |
| Inman Brad's | INMNO | 47.9 | $236.51 | $11,328.75 |
| Jehovah | JEHO | 22.82 | $144.61 | $3,300.00 |
| Klug/Davis South | KLUG | 136.01 | $170.36 | $23,170.00 |
| Kopp East | KOPP | 87.81 | $276.53 | $24,009.01 |
| Kopp west | KOPP | 127.58 | $276.53 | $34,882.92 |
| Lake | LAKE | 18.07 | $148.75 | $2,688.00 |
| Larson | LARS | 56.2 | $200.11 | $11,246.00 |
| Murray | MURRA | 130.85 | $173.51 | $22,704.00 |
| New Life | (blank) | 11.0 | $250.00 | $2,750.00 |
| Noss, Jeff | JNOSS | 30.65 | $153.03 | $4,690.50 |
| Noss, Jessie | WTORK | 84.0 | $207.43 | $17,424.00 |
| Noss, Sid | SNOSS | 98.7 | $205.98 | $20,330.00 |
| Noss. Torkelson | ETORK | 79.4 | $181.36 | $14,400.00 |
| OM1 | OM1 | 32.6 | $223.00 | $7,236.00 |
| OM2 | OM2 | 48.24 | $54.97 | $2,651.66 |
| OMNI BIG SOUTH | OMNI | 320.0 | $276.53 | $90,228.60 |
| Omni GRASSY KNOLL | OMNI | 120.0 | $276.53 | $30,076.20 |
| phillhower east | (blank) | 135.2 | $199.70 | $27,000.00 |
| phillhower west | (blank) | 154.0 | $201.30 | $31,000.00 |
| Schultz | SCHU | 98.1 | $170.11 | $16,688.00 |
| Schwellenbach | SCHW | 28.6 | $178.32 | $5,100.00 |
| Simpsons | sim | 210.0 | $250.00 | $52,500.00 |
| suiter | SUIT | 15.1 | $125.83 | $1,900.00 |
| Turkey Deer | TURK | 37.88 | $223.00 | $8,820.00 |
| Wes's | WES | 98.0 | $183.67 | $18,000.00 |

**Active Rent Totals: 4,570.81 acres | $967,694.28 total annual rent**

**Inactive records** (active=false, 47 records) include: Big North Dryland, Big North IRR, Blue's North, Blue's South, Buchanon Big, Fox-Kettle Little field, Gessert DRY bottom, Gessert DRY Triangle, Gessert East 250, Gessert IRR, Gessert west 111, Gesslet buffer, Gessley Seed, Glen Erin, Jones, Juniors big field, Juniors little fields, Klug North, knillans Rd., Kopp west buffer, Kopp west East of Irr, Kopps, OMNI BALANCE 1, OMNI BALANCE 2, OMNI BUFFER, OMNI GRASSY PIVOT, OMNI SEED, Avalon Rd, Ryan Office, Simpson (multiple), Simpsons seed, Swag, test farm, test omni, Townline Farms, Townline road north, Townline road south, Twist dry, Willie's triangle, Yoss

---

## 11. Programs / Templates (24)

| ID | Name |
|---|---|
| prog_mm89sody_v8u6 | Hybrid Seed Rye Program |
| prog_mm9lahyn_fb4k | Foodbean Program - Outlook |
| prog_mm9lcoao_kk12 | RR Soybeans Program |
| prog_mmbjot25_oikz | ORG Corn Program |
| prog_mmbjwp5x_kqsb | ORG Seed Corn Program |
| prog_mmbk0539_dkql | ORG Seed Corn Program 1 |
| prog_mmbkoz1m_6zyv | Enlist Soybeans Program |
| prog_mmbmhxil_y0vu | IRR Organic wheat Program |
| prog_mmcyolgs_hg2w | Yellow Corn (CON) |
| prog_mmfx3tbf_27hm | White corn (CON) |
| prog_mmfx3wom_sk1c | Yellow Corn (CON IRR) |
| prog_mmfx3zta_1ukx | Seed grade Winter Barley (CON) |
| prog_mmfx42zj_m171 | Soybeans (CON) |
| prog_mmfx45ty_t8o7 | DF seed beans (CON) |
| prog_mmfx48u6_fued | Peas (CANNING CON IRR) |
| prog_mmfx4c08_mphz | Peas (CANNING CON IRR) |
| prog_mmfx4fe8_opa1 | Snap Beans (CANNING CON IRR) |
| prog_mmfx4wqj_s6tt | ORG Wheat (ORG) |
| prog_mmfx4zwr_fkra | ORG Soybeans (ORG IRR) |
| prog_mmfx542g_kqh9 | ORG Natto Beans (ORG IRR) |
| prog_mmfx58as_1voa | GA ORG SEED BEANS (ORG) |
| prog_mmfx5cu7_qw9c | ORG Soybeans (ORG) |
| prog_mmfx5fv5_uvy5 | Lima Beans (CANNING CON) |
| prog_mmky0hcs_nwrg | ORG Peas |

---

*End of snapshot. Source: /farm-budget/data/data.json as of 2026-04-03.*
