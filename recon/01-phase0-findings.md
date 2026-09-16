# Phase 0 — data correctness: findings and proposed writes

**Status: matcher fix DEPLOYED. Steps 2, 3 and 4 are DONE — 3 and 4 by a concurrent session while
this ran. I have written nothing to any data store. Steps 5, 6 and 7 are open.**

> **Read this first.** Production moved under this analysis. A second session — your other Claude —
> created both bean enterprises and repointed Brad Inman's registry id at **17:25**, between my
> 16:31 snapshot and this write-up. I re-pulled and re-verified everything; the sections below are
> against production as of 17:30. The independent check in Step 6 confirms their work landed
> correctly: the Carrol and Christopherson hits are gone from the sweep.

Backup taken before anything: `/var/backups/farm-ops/pre-phase0-20260916-163037/` on the droplet
(14 MB — all five JSON stores, `data-2027.json`, the documents tree as a tarball, and fresh
`grain_tickets` + `organic-cert` dumps; the Supabase dump is the 02:00 copy).

Production is the source: prod `data.json` carries **573** invoice-bearing input rows against the
local checkout's **539**, which matches the handoff. All analysis below ran against a read-only
copy of the production file pulled at 16:31 on 2026-09-16.

---

## Step 1 — matcher fix: DONE

The droplet was running the pre-fix matcher (verified by hash: `ef8f066c…` = `HEAD~1`). Deployed the
five files from commit `3ca74d2` — `lib/docintake/match.js`, `server.js`, `public/doc-intake.js`,
`public/index.html`, `scripts/audit-invoice-enterprise-matches.js` — and restarted `farm-budget`
and `farm-budget-2027`.

`GET /api/documents/review-queue` → **200**, `{"queued":0,"lines":0}`.

**The queue is empty for a structural reason, not because nothing is ambiguous.** The endpoint reads
`ambiguousEnterprise` off *stored* proposals, and every stored proposal was computed by the old
matcher. The document ledger holds only 6 documents and 2 proposals in total — the 573 invoice rows
came in through a bulk import, not through document intake. So:

- nothing is waiting for you to clear;
- the 12 invoices the commit message counted as "now queued" were a **replay**, not stored records;
- the queue will populate from the next upload onward.

If you want those 12 in the queue now, that needs a backfill script that recomputes proposals for
stored documents and persists them — a write to the documents ledger, not to the budget. Say the
word and I will write it.

**Deviation from the handoff:** I deployed with `scp` of those five files rather than
`scripts/sync-code.sh`. macOS now ships `openrsync`, which printed no file list on a `--dry-run`
and gave me no way to confirm the `.rsyncignore` exclusions were honoured. Given the July 3 clobber,
copying five named code files was the safer move. The droplet's copies matched `HEAD~1` exactly
beforehand, so nothing droplet-side was overwritten.

---

## Step 2 — Daun (`fld_1801`): ALREADY DONE

The enterprise exists and all three invoices are on it. Nothing to create, nothing to move.

| | |
|---|---|
| row | `fld_1801`, registry `fld_011` |
| crop | **Enlist Soybeans** |
| acres / plantedAcres | 11 / **11.4** ← your number |
| seed | 16Z25E (= the DeLong sheet's Pioneer 16Z25E) |
| tillage | No-Till (= the DeLong sheet) |
| inputs | 26 |
| invoiced cost | $1,886.02 |

Daun is the only enterprise on `fld_011`, so there is nowhere else on this parcel for any of the 26
rows to go. Where each belongs:

| rows | invoice | date | ac | what | verdict |
|---|---|---|---|---|---|
| 0,1,2,3,4,13 | 8001933 | 04/22/26 | 11 | Pre — Buccaneer, Ester 2,4-D, Sonic, Veracity, AMS, application | correct |
| 5,6,12,14,16,17,18 | 8003352 | 06/04/26 | 10.9 | Post — Enlist One, Interline, Volunteer, crop oil, AMS, water, application | correct |
| 19,20,21,22,23,24 | 8004183 | 07/01/26 | 10.9 | 2nd post — same program | correct |
| 25 | **980044183** | 07/01/26 | 10.9 | Premium AMS, $20.27 | correct row, **invoice number is a typo** for 8004183 |
| 10,11,15 | 1062004 | 10/31/25 | 12 | Fall P&K + tonnage tax | correct (fall-applied for the 2026 crop) |
| 7,8,9 | — | — | — | seed treatment, inoculant, treatment application | planned rows, no invoice; billed on the seed invoice |

Three defects, all cosmetic-to-arithmetic, none structural:

1. **row 25** invoice number `980044183` → `8004183`.
2. **row 20** product name `Inter` → `Interline (250 Gal)` ($79.99, no unit recorded).
3. **rate-as-total costs on 8001933**: Buccaneer 2.72 gal at $23.00, Sonic 3.41 lb at $51.00,
   Ester 1.02 gal at $36.00, application 11 ac at $9.75, AMS 21.8 lb at $0.55. Those are unit
   prices sitting in the cost column. Same family as the 38 known rate-as-total rows.
4. `acres` = 11 against `plantedAcres` = 11.4, and registry `reportingAcres` = 11. The planted
   figure is larger than the parcel. One of the three numbers is wrong.

---

## Step 3 — Carrol and Delong Christopherson: DONE at 17:25 by the other session

At 16:31 neither bean enterprise existed and both post-bean invoices were still confirmed onto the
corn rows. At 17:25 both were created and the rows moved — not copied, which is the part that
mattered:

| | Carrol | Delong Christopherson |
|---|---|---|
| new row | `fld_mu4cuu70_jrww` | `fld_mu4cuu70_s2wy` |
| crop | Enlist Soybeans | Enlist Soybeans |
| plantedAcres | **16.5** | **25.4** |
| seed | P23Z82E (new to the book) | 16Z25E |
| rows moved | 7 (8004409, $699.51) | 7 (8004410, $547.05) |
| corn row | White corn, inputs 28 → 21, planted 137.1 → **135.6** | Yellow Corn, inputs 30 → 23, planted 47.7 → **47.1** |

So the acreage questions I was going to ask you are answered: 16.5 at Carrol and 25.4 at
Christopherson, your official figures, which deliberately push both parcels past their `acres`
value. Noted — FSA planted acres and parcel acres never agree and should not be "reconciled".

**Two fields did not come along with the rows.** On all 14 moved rows:

- `invoiceAcres` still carries the **corn** enterprise's footprint — 137.1 on Carrol's seven rows,
  47.7 on Christopherson's. The passes were billed on 15 and 17 acres.
- `invoiceQtyTotal` still carries the **acreage** rather than the product quantity: every line on
  8004409 says 15 and every line on 8004410 says 17. The book says 4.25 gal Enlist One, 4.25 gal
  Interline, 1.06 gal Volunteer, 2.55 gal crop oil, 34 lb AMS.

Left alone, every per-acre figure on both bean enterprises is wrong by the ratio of those two
acreages, and the quantities cannot be checked against the label rates that proved the 17 acres in
the first place. This is the one piece of Step 3 still outstanding.

<details>
<summary>The rows as they were before the move, for the record</summary>

### 8004409 on Carrol's White corn — 7 rows, $699.51

| in[] | product | qty | unit | cost | invAc |
|---|---|---|---|---|---|
| 21 | Water | 15 | Gal | — | 137.1 |
| 22 | Interline (250 Gal) | 15 | Gal | $109.88 | 137.1 |
| 23 | Enlist | 15 | Gal | $283.16 | 137.1 |
| 24 | Volunteer (2x2.5 Gal) | 15 | Gal | $54.21 | 137.1 |
| 25 | Crop Oil, Insource | 15 | Gal | $51.86 | 137.1 |
| 26 | Premium Ams (51 Lb) | 15 | Lbs | $27.90 | 137.1 |
| 27 | Application - Post | 15 | Acre | $172.50 | 137.1 |

### 8004410 on Christopherson's Yellow Corn — 7 rows, $547.05

| in[] | product | qty | unit | cost | invAc |
|---|---|---|---|---|---|
| 8 | Meth Oil, Insource | 17 | Gal | $58.76 | 47.7 |
| 10 | Application - Post | 17 | Acre | $195.50 | 47.7 |
| 14 | Premium Ams (51 Lb) | 17 | Lbs | $31.62 | 47.7 |
| 17 | Water | 17 | Gal | — | 47.7 |
| 18 | Interline (250 Gal) | 17 | Gal | $124.53 | 47.7 |
| 19 | Enlist | 17 | Gal | $75.51 | 47.7 |
| 20 | Volunteer (2x2.5 Gal) | 17 | Gal | $61.13 | 47.7 |

The stored $547.05 on Christopherson is short of the $792.48 the earlier recon quoted, because the
per-line costs are a mix of rates and extendeds.

</details>

Still unanswered, and it is agronomic rather than arithmetic: Resicore Rev went on 145 ac at Carrol
on 4/23 but only 136.4 ended as corn, so roughly 8.6 ac of mesotrione/clopyralid ground may have
gone to beans. Both carry soybean rotational restrictions measured in months. That belongs in the
enterprise record whichever way it went.

---

## Step 4 — `fld_027`: no split was needed. Done in `data.json`, still open in `data-2027.json`.

The handoff asks how to split the registry id and reassign 35 rows. **No split was needed**, and no
rows moved. The registry, the portal and organic-cert already treated these as two separate fields:

| store | Inman | Brad Inman's |
|---|---|---|
| farm-registry | `fld_027`, 154.8 ac, geometry (MultiPolygon, 4 parts), `farm_027` (FSA tracts 12161/12162/15205) | `fld_028`, 47.8 ac, geometry (Polygon, 3 parts), `farm_028` (no tracts) |
| organic-cert `Field` | `cmmwuii2q000v…` registryId `fld_027` | `cmmwuii2q000x…` registryId `fld_028` |
| organic-cert `FieldEnterprise` | Enlist Soybeans, 154.8, 16Z25E | Enlist Soybeans, 47.8, 16Z25E |
| DeLong book | "Inman" — 8002672, 8003145, 8003466, 8004181, 1061996 | "Brads" — 8002671, 8003351, 8004182, 1061994 |

The single defect is that farm-budget row `fld_1462` "Brad Inman's" carries
`registryFieldId: "fld_027"` instead of `fld_028`. This is finding F4 from the earlier recon,
unfixed.

**The 35 invoice rows do not move.** They are already correctly divided — 16 on `fld_1462`
(8002671, 8003351, 1061994) and 19 on `fld_1836` (8002672, 8003145, 8003466, 1061996). The
registry pointer is the only thing pointing at the wrong ground.

### What was done, and what is left

`data.json` now reads `fld_1462.registryFieldId: "fld_028"` — done at 17:25. Verified: one `fld_027`
reference and one `fld_028` reference where there used to be two and none.

**`data-2027.json` was not touched: it still carries two `fld_027` references and no `fld_028`.**
The 2027 plan has the same two rows and the same mis-link, so next year's plan still points Brad
Inman's at Inman's ground. One field, one file — it needs the same edit, and it is droplet-only
(rsync-guarded), so it has to be done there.

Nothing else in any store references `fld_027`: `fsa-acres`, `seed-inventory` and `meristem-malt`
have zero references, and grain-tickets keys farms by name, not registry id.

**Side effect worth knowing:** `match.js` currently leans on `fld_027` carrying both rows — the
acreage tiebreaker's comment cites "Brad Inman's at 47.8 and Inman at 154.8" as its example. After
the fix they become two parcels, each single-enterprise, and the matcher resolves them by parcel
without needing acres at all. Strictly better; the comment goes stale.

---

## Step 5 — Wes: all four enterprises already exist. Acreages and two invoices are wrong.

| row | crop | acres | plantedAcres | seed | your number | gap |
|---|---|---|---|---|---|---|
| `fld_1156` | Seed grade Winter Barley | **143** | 55 | EQUINOX 31 ac + ORBIT 24 ac | 55 | `acres` wrong |
| `fld_moblero3_b3gb` | High Oil Soybeans | **143** | 34.4 | DF 262 | **34.7**, "DF 262 food beans, full season, non-GMO" | `acres` wrong; planted 34.4→34.7; **crop name says High Oil, you say non-GMO food bean** |
| `fld_mq71nmdz_35ah` | Yellow Corn | **143** | 1 | P0035 | ~1 | `acres` wrong |
| `fld_mtam6v2c_izkh` | Enlist Soybeans (DBL CROP → barley) | 25 | **0** | P26Z86E | **~39** | acres 25→39, planted 0→39 |

Registry `reportingAcres` for `fld_056` is 90. 55 + 34.7 + 1 = 90.7. The `acres` = 143 on three
rows is finding F5, still unfixed.

**1061713 "Post Rye", 65 ac, $1,524.30 — already on the winter barley row**, rows 2, 3, 4, 10. You
were right that rye and barley share the program. Two things:

- **Billed at 65 ac against 55 ac planted.** Ten acres over. Flagged as you asked.
- Row 2 carries the invoice number as **`10061713`** — a typo, and it is why the placement report
  shows this invoice on the barley row twice under two numbers.
- Huskie is stored at $218.53; the book's extended is **$666.52** ($218.53/gal × 3.05 gal). Another
  rate-as-total.

### Every other Wes invoice, and where it belongs

| inv | date | ac | comments | where it is | proposal |
|---|---|---|---|---|---|
| 8002274 | 05/04/26 | 34 | Pre Beans | DF 262 row, 3 rows, $225.17 | correct. `invoiceAcres` says **143**, should be 34; row 0 `invoiceQtyTotal` is **14334**, should be 34 |
| 8002281 | 05/05/26 | 1 | Pre Verdict Outlook | Yellow Corn, 7 rows | correct |
| 8002350 | 05/06/26 | 56 | **Fungicde on Barley**, $2,208.89 | **nowhere** | → winter barley: Miravis Ace 5.69 gal $1,536.30, Surfactant 1.40 gal $28.59, application 56 ac $644.00 |
| 8003075 | 05/21/26 | 40 | Buchanon's **rye** fungicide | **on the barley row**, rows 7, 8, 11, $1,576.62, carrying Buchanon's quantities | **remove** — this is F3, the same invoice confirmed on two enterprises. It stays on Buchanon's rye row where it belongs |
| 8003208 | 05/29/26 | 1 | Post Corn | Yellow Corn, 6 rows | correct |
| 8003275 | 06/02/26 | 34 | Post Food Beans | DF 262 row, 7 rows, $865.08 | correct. Zidua sc stored at $0.53 — rate-as-total |
| 8004257 | 07/08/26 | 25 | 2nd Post Trip, $1,021.99 | **nowhere** | → **double-crop Enlist beans**. That row has exactly this pass planned (Enlist One, PowerMax-class glyphosate, crop oil, AMS) and nothing confirmed. Sprayed 25 ac against your ~39 |
| 8004735 | 08/10/26 | 31 | Post Harvest Burndown, $839.53 | **nowhere** | → **winter barley**, as the cleanup on the barley ground that did *not* go to double-crop beans (31 + 25 = 56 ≈ the barley footprint). Confirm — it could equally be ground prep charged to the double crop |
| 1063019 | 12/10/25 | 129 | 2025 Soil Sampling, $675.00 | **nowhere** | a service, not a pass, and 129 ac is the whole farm. Overhead, or split across the enterprises by acres. Your call |
| 8001578 / 8001579 / 8001617 | 04/04–07/26 | 180/180/112 | Urea/AMS blend on small grains — **Elwood, Buchanon-Big, Wes, Townline** | **nowhere**, $32,330.08 combined | four farms on one invoice. Wes's share goes on winter barley; needs an allocation rule before it can be split |

Net effect on Wes's barley if all of this lands: **−$1,576.62** (Buchanon's fungicide off)
**+$2,208.89** (Wes's own fungicide on) **+$839.53** (burndown) = **+$1,471.80**, and the fungicide
line finally carries its own invoice number.

---

## Step 6 — product-against-enterprise check: built, run read-only

Two new files, nothing wired into the matcher yet:

- `farm-budget/lib/docintake/crop-fit.js` — the engine. The rules are **data**:
  `store.productCropRules`, maintained from the labels. `RULE_SEED` in the file is a ten-row
  starting table used only until the store has one.
- `farm-budget/scripts/audit-product-crop-fit.js` — read-only sweep, writes nothing.

Each rule names the active ingredient, the crop families it may go on, the soybean **seed traits**
it may go on, and whether it is label-legal as a pre-plant burndown. The verdicts are `wrong-crop`,
`wrong-trait`, `unknown-trait` and `organic`; anything other than `ok` goes to the review queue with
the reason attached, and nothing is ever silently placed or silently blocked.

Trait is read from a new `seedTrait` field on the enterprise and is **never inferred**. An
enterprise with no trait plus a trait-dependent product is `unknown-trait` — a review-queue answer,
not a pass. Inference is what put a bean pass on a corn row in the first place.

### The read-only run against production

950 input rows, 573 invoiced, 339 crop-relevant after skipping neutral lines (water, AMS, crop oil,
application, fertiliser, tonnage tax, seed treatment).

**`wrong-crop` — 2 invoiced rows, $2,874.36.** Run against the 16:31 snapshot it found 8 rows worth
$3,582.78; run again after the 17:25 writes, the Carrol and Christopherson hits are gone. That is
the check independently confirming the other session's fix, having been written before it happened
and knowing nothing about it.

| enterprise | invoice | rows | $ | verdict |
|---|---|---|---|---|
| ~~Carrol / White corn~~ | 8004409 | Interline, Enlist, Volunteer | $447.25 | **cleared at 17:25.** Volunteer is clethodim — it kills corn |
| ~~Delong Christopherson / Yellow Corn~~ | 8004410 | Interline, Enlist, Volunteer | $261.17 | **cleared at 17:25** |
| Townline / Hybrid Seed Rye | 8004732 | Durango DMA, Interline | $2,874.36 | **open, and it is a labelling defect, not a misplacement** |

Townline is worth a look: 8004732 *is* Townline's "Post Harvest Burndown" and it *is* on the right
enterprise, but all six rows are stored with `operationGroup: "Post-emerge"`. A post-harvest
burndown filed as an in-crop pass. At intake the invoice comment would have exempted it; on the
stored rows the group is the only context, and the group is wrong. Two more defects on that invoice:
row 23's quantity is 16.17 gal against the book's 16.710, and line 7 (DeLco Hammer Down, $131.65)
was never entered.

**`wrong-trait` — 0 rows. `organic` — 0 rows.** No synthetic pesticide is sitting on organic
ground, and no in-crop trait-dependent chemistry is on a food-bean enterprise. The DF 262 and
DF 214 programs run on Forsyte, Zidua, Volunteer and Cobra, all of which are conventional-safe.
That is a clean result and worth stating plainly.

**`unknown-trait` — 24 invoiced rows, $20,519.29** (20 / $19,926.21 before the two new bean
enterprises arrived). Every one is Enlist One or glyphosate on an enterprise named "Enlist
Soybeans" — Airport, Brad Inman's, Torkelson East, suiter, Daun, Inman, Bakke, and now Carrol and
Christopherson. They are almost certainly fine; they flag because **0 of 22 soybean enterprises
record a seed trait**. Setting the trait clears all 24.

### The trait table you need to fill

| enterprise | crop | seed | proposed trait |
|---|---|---|---|
| Airport, Brad Inman's, Torkelson East, suiter, Daun, Inman, Bakke, Wes's dbl-crop, **Carrol**, **Christopherson** | Enlist Soybeans | 16Z25E / P26Z86E / P23Z82E | `ENLIST_E3` |
| OMNI BIG SOUTH, Simpsons, Kopp | ORG Soybeans | VIKING 2155 | `ORGANIC` |
| Goat pasture | ORG Natto Beans | PS162 | `ORGANIC` |
| Hoff | Non-GMO Seed Grade Beans | SG1499H | `CONVENTIONAL` |
| **Delong-Meyer, Klug Davis, Lake, Murray, Twist Farm, Wes's** | **High Oil Soybeans** | **DF 262** | **? — you said DF 262 is non-GMO food beans, which makes it `CONVENTIONAL`. Confirm, because it decides whether glyphosate may ever be confirmed on these six** |
| **Gessert** | **Soybeans** | **DF 214** | **?** |

Also note the "RR Soybeans" labelling problem has already been half-fixed: the rows now read "Enlist
Soybeans", which is right, but the crop name is doing a job the trait field should do. Once
`seedTrait` exists the crop name can go back to describing the crop.

### Two rule-table calls for you

1. **Enlist One is labelled on field corn.** Your rule as stated ("2,4-D choline → Enlist soybeans
   only") is what I implemented, and it is the right rule for catching a bean pass on corn. It will
   also flag a legitimate 2,4-D choline pass on corn, if you ever make one, and you would clear that
   from the queue by hand or add an exemption row.
2. **Pre-plant and burndown passes are exempt** from the trait test, because the crop is not up.
   Without that exemption the sweep produced six false hits (ester 2,4-D ahead of beans at Daun,
   Bakke, Brad Inman's, Lake, Hoff, Airport — all `Pre-emerge`, all legal). A row whose group says
   "Post-emerge" gets no exemption, which is exactly what kept Townline visible.

---

## Step 7 — grain-tickets bushel total: done in code, not deployed

`grain-tickets/public/farms.js:183` read:

```js
'Total: <strong>' + util.formatNum(totalBU, 2) + ' BU</strong>'
```

summing `f.totalBU` across every farm in the filter. Against live production data that header reads:

```
OLD:  46 farms | 3,733.3 acres | Total: 45,010.77 BU
NEW:  46 farms | 3,733.3 acres | Hybrid Rye 33,370 BU   Organic Wheat 5,115 BU
                                 Seed Barley 4,710 BU   Organic Seed Wheat 1,710 BU   Peas 106 TON
```

Rebuilt from the tickets' own `crop`, so the filters still apply, and the per-crop figures add back
to 45,010.77 exactly — nothing is lost, it is only kept apart. There is no combined total in the
strip.

**The peas are what makes the old number indefensible.** `CropConfig` has `Peas` at `testWeight`
2000, because canning peas sell by the ton — so 106 of those "bushels" are **tons**, and the old
header was adding 106 tons of peas to 33,370 bushels of rye. Since the crop config carries no unit
column, the new code reads the unit off the test weight: 2000 → `TON`, 1 → `LB` (hay, bypassed),
anything else → `BU`. Sweet Corn and Snap Beans are configured the same way as Peas and will label
correctly the first time either delivers.

**One thing beyond the handoff, same rule:** the per-farm cards carry a "Total BU" stat with the
same defect. Omni is the live case — Organic Wheat 1,401 and Organic Seed Wheat 849 — so a card for
a multi-crop farm now shows one stat per crop instead of a single blended one, each with its own
unit. Single-crop farms are unchanged, `BU/AC` included.

The handoff says 7 crops; production currently has **5** in the `Ticket` table (52 tickets). The
principle is the same either way.

Changed: `grain-tickets/public/farms.js`, `public/style.css` (one class), `public/index.html`
(`farms.js?v=20260916a`, `style.css?v=4` — per the asset-version rule).

---

## What I need from you

**One number**

1. DF 262 and DF 214 seed trait — `CONVENTIONAL`, or something else? It decides whether glyphosate
   or glufosinate may ever be confirmed on seven enterprises (Delong-Meyer, Klug Davis, Lake,
   Murray, Twist Farm, Wes's, Gessert). Nothing wrong is on them today.

**Approvals, each independent**

2. **Step 3 leftovers:** correct `invoiceAcres` (137.1 → 15, 47.7 → 17) and `invoiceQtyTotal`
   (acreage → book quantities) on the 14 moved rows.
3. **Step 4 leftover:** the same `fld_027` → `fld_028` edit in `data-2027.json` on the droplet.
4. **Step 5:** Wes's acreage corrections; remove 8003075 from the barley row ($1,576.62 of
   Buchanon's fungicide, double-counted); add 8002350 ($2,208.89), 8004257 ($1,021.99), 8004735
   ($839.53). Plus a decision on 1063019 (soil sampling) and the three small-grain blend invoices.
5. **Step 6:** write the rule table and `seedTrait` into the store, then wire the check into
   `match.js` so mismatches reach the review queue.
6. **Step 6 side finding:** Townline 8004732 — regroup the six rows from "Post-emerge" to a burndown
   group, fix row 23's quantity (16.17 → 16.710 gal), and add the missing DeLco Hammer Down line
   ($131.65).
7. **Step 7:** deploy the grain-tickets change (committed, not deployed).
8. Optional: the backfill that recomputes stored document proposals so the review queue reflects
   the new matcher.

**Also unfixed, from the earlier recon, and none of it blocking**

- Invoice-number typos on 26 stored numbers: `10061713`, `980044183`, `802788`, `800593`, `802974`,
  `7032812`, `1762812`, `802977`, `803346`, `8001856qz`, `800188`, `800312`, `162001`, `2712`,
  `10.50`, `2.470`, `Delong`, and others.
- `plantedAcres` = 0 on Schwellenbach corn, Philhower East peas, Elwood's rye, Townline rye, Murray,
  Hoff, Airport and others.
- Wrong `invoiceDate` values: Christopherson in[3] 2026-08-11 and in[4] 2025-05-11, Wes barley in[11]
  2026-01-21, and the rest of F8.
- **The reconciliation gap overall**: the DeLong book holds 210 invoices / $995,909.94. Attached:
  $544,907.61. Unattached: **$451,002.33**, of which $396,053.52 is non-pass fertiliser, seed and
  service invoices — including the $32,330 of small-grain urea/AMS above and `1062228`
  ("Extra Sent here used at Carrols ????", $8,025.40). 26 unattached invoices are pass candidates.
