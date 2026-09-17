# Where fields, enterprises, passes and geometry actually live

Read-only survey, 2026-09-17. Nothing was written.

## The one-line version

**The parcel is farm-registry. The enterprise is farm-budget. The passes are farm-budget. The
geometry is Supabase — and Supabase already has a zone model with polygons that nothing else knows
about.**

---

## Store by store

### farm-registry — `farm-registry/data/data.json`, port 3005

The **parcel**, and the only canonical field id.

| | |
|---|---|
| `fields[]` | 53. `id` (`fld_027`), `name`, `aliases[]`, `reportingAcres`, `organicAcres`, `ownership`, `active`, `geometry` (real MultiPolygon/Polygon), `farmId`, `totalRentDollars` |
| `farms[]` | `farm_027`, `fsaTractNumbers[]` |
| also | `growers[]`, `crops[]` |

`fld_NNN` is the join key everything else uses. Aliases are what makes DeLong's "Philhower" find our
"Phillhower".

### farm-budget — `farm-budget/data/data.json`, ports 3001 (2026) and 3011 (2027)

The **enterprise** and the **passes**. This is the working book.

| | |
|---|---|
| `fields[]` | 63 rows — **one row per field × crop × year, i.e. one row IS one enterprise**. `registryFieldId` → farm-registry. `crop`, `cropType` (`SINGLE CROP` / `DBL CROP`), `acres`, `plantedAcres`, `seeds[]`, `seedTrait` (new), `tillage`, `dblPartnerFieldId`, `dblSharedAcres`, `rentPerAcre` |
| `fields[].inputs[]` | **the passes** — 969 rows, one per product per pass. `passStatus` (`confirmed`/planned), `operationGroup`, `season`, `quantity` (planned rate), `actualQuantity` (applied rate, in the PRODUCT's unit), and the invoice side: `invoiceNumber`, `invoiceDate`, `invoiceAcres`, `invoiceQtyTotal`, `invoiceCostTotal`, `invoiceLineIndex` |
| `fields[].machinery[]` | implement passes by `implementName` — **not** by implement id |
| `fields[].geometry` | **on 6 rows only, and they are placeholders** — Carrol's is a four-corner lat/long box. Do not treat as boundaries. |
| reference | `products[]`, `implements[]`, `programs[]`, `productCropRules[]` (new), `overheadPools[]`, `marketingPrices` |
| evidence | `data/documents/` — uploaded invoice PDFs + `ledger.json` (6 documents), holding the matcher's stored proposals |

### fsa-acres — `fsa-acres/data/data.json`, port 3002

FSA reporting and insurance. **No geometry at all** (zero `coordinates`), and it does **not** use
`fld_NNN` — it keys on farm number / tract / CLU.

`cluRecords[]` 444 (farmNumber, tractNumber, clu, crop, fsaAcres, irrigated, organic, doubleCrop) ·
`gcsEnrollments[]` 149 · `insurancePolicies[]` 3 · `farms[]` 10 · `pricing[]` 22

### organic-cert — local Postgres `glomalin` on the droplet, port 3004

The **certification and traceability** view of the same enterprises, plus the marketing API.

`Field` (`registryId` → farm-registry, `farmBudgetFieldName`) · **`FieldEnterprise`** (`fieldId`,
`cropYear`, `crop`, `variety`, `plantedAcres`, `lotNumber`, `organicStatus`, `enterpriseType`,
target/actual yield) · `MaterialUsage`, `FieldOperation`, `HarvestEvent`, `SeedUsage`, `ScoutingLog`,
`ManagementAction`, `FertilityEvent`, `CropLot` — all keyed by `fieldEnterpriseId` · `BufferZone`,
`AdjacentLandUse` · `CropRotation` and `FieldHistory` — **both empty**

`FieldEnterprise` has **no geometry column**. It is the same grain as a farm-budget row, kept in sync
by `sync-macro`.

### Supabase — the portal's own Postgres (remote), port 3000

**PostGIS is installed** (`spatial_ref_sys`), and this is the only store with real spatial types.

| table | rows | what |
|---|---|---|
| `field_boundaries` | 53 (51 with geometry) | `registry_field_id`, `geojson`, `geometry`, `centroid_lat/lng`, `total_acres`, `source`, `last_edited_*`, `is_deleted` |
| `clu_boundaries` | 814 | FSA CLU polygons |
| **`management_zones`** | **135 across 17 fields, all with geometry** | `registry_field_id`, `name`, **`geometry`**, `organic_default`, `irrigated_default` |
| **`zone_year_attributes`** | **74, all crop_year 2026** | `zone_id`, `crop_year`, `crop`, `variety`, `irrigated`, `organic`, `intended_use`, `tillage`, `cover_crop` |
| `rotation_rules`, `field_observations`, `practice_ledger` | **0** | defined, never populated |
| also | | `aph_records`, `claims`, `insurance_policies`, `gcs_enrollments`, `clu_records`, `commodities`, `crop_variants`, `commodity_pricing`, `sale_instruments`, `profiles`, `role_permissions`, `module_access` |

---

## What this means for Phase 2

**The zone model you sketched already exists, in Supabase, and nothing else knows about it.**
`management_zones` is a named polygon on a registry field; `zone_year_attributes` is that zone's crop,
variety, tillage, irrigated and organic flags **for a given crop year**. That is the mockup's "zone"
almost exactly, and it is the one place with PostGIS to do an overlay against `clu_boundaries`.

I told you earlier that per-zone polygons don't exist. That was wrong about Supabase — they exist
there. It was right about farm-budget and organic-cert, which is where the enterprise and its costs
live. **That gap is the actual Phase 2 problem:** the polygon and the money are in different
databases, joined only by `registry_field_id`, and nothing links a `management_zone` to a
`FieldEnterprise` or to a farm-budget row.

Three facts that constrain the design:

1. **There is no zone → enterprise key anywhere.** A zone knows its field and its crop-year crop; an
   enterprise knows its field and its crop. They can be matched on (field, year, crop) — which works
   only while a field has one enterprise per crop. Wes has two soybean enterprises in 2026.
2. **The zone data is partial and needs cleaning first**: 17 of 53 fields, and the sample shows
   duplicate names on `fld_003` and several **zero-area** polygons.
3. **`plantedAcres` is the costing basis, not the geometry** (see below). If zone polygons become
   authoritative for acres, every per-acre figure in the budget moves. That has to be a deliberate
   decision, not a side effect.

The unsigned FSA Phase 2 verdict bears on this: `clu_boundaries` (814) and `field_boundaries` (53)
already coexist, and the handoff's rule — production geometry independent of CLU, FSA acres derived
by overlay — is buildable here and nowhere else in the stack.

---

## Appendix: what the acreage fields mean

Three different numbers, routinely confused:

| field | on | meaning |
|---|---|---|
| `acres` | enterprise row | **the parcel.** Reference only — `calc.js` exposes it as `fieldAcres` and never costs against it except as a fallback |
| `plantedAcres` | enterprise row | **the enterprise footprint, and the costing basis.** `calc.js:419`: `acres = plantedAcres > 0 ? plantedAcres : acres` — rent, inputs and every per-acre figure use this |
| `invoiceAcres` | input row | **what the sprayer billed on that pass.** Legitimately differs from both |
| `reportingAcres` | registry field | the parcel, as reported |
| `fsaAcres` | fsa-acres CLU record | FSA's figure per CLU |

So on a shared parcel every enterprise carries the **same** `acres` (the parcel) and its **own**
`plantedAcres`. Gessert: three rows all `acres` 364.8, planted 254.1 / 111 / 114.8. Buchanon: both
rows `acres` 48, planted 38 and 10.

### Which answers the Wes question

The four Wes rows read `acres` **90** because 90 is the parcel — registry `fld_056.reportingAcres`.
Before this week three of them read 143 and the double crop read 25, which was simply wrong: 143 is
not any Wes number, and 25 was the double crop's own size sitting in the parcel field.

**The double-crop row reads `acres` 90 and `plantedAcres` 39, and 39 is the one that spends money.**
Nothing costs against the 90.

The double crop is also the one case where two enterprises deliberately share ground, and `calc.js`
splits the rent rather than charging it twice:

- the **DBL CROP** row pays **0.5×** rent and overhead on all its acres — 39 ac at half rate
- the **base** row carries `dblSharedAcres` (maintained server-side from `dblPartnerFieldId`) and
  pays full rate on its exclusive acres, half on the shared: barley is `(55 − 0.5 × 39) / 55` = **0.645×**

Which comes to 1.0× rent on the 39 shared acres — paid half by the barley and half by the beans —
and full rate on barley's other 16. I checked after this week's write: barley now carries
`dblSharedAcres = 39`, so the pairing updated correctly.

The planted figures sum to 55 + 34.7 + 1 = **90.7** against a 90-acre parcel, with the 39 riding on
top of the barley rather than adding to it. The 0.7 over is normal — FSA planted acres and parcel
acres never agree, and they should not be reconciled.
