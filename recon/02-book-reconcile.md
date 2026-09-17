# Every invoice row against the DeLong book

**The proposal below was approved and APPLIED on 2026-09-17 — see the last section for what landed
and what changed in the writing. The figures in the body are as they stood before the write.**

`farm-budget/scripts/audit-invoice-book-reconcile.js --recon ~/delong-recon-bundle`

The bundle holds **210 PDFs and 210 parsed invoices, 847 lines** — one for one, so it is the
paperwork. That means the defects left over from Phase 0 (the rate-as-total costs, the invoice
numbers) can be settled from the book rather than by finding paper. Run against production,
2026-09-17, 585 invoice-bearing rows.

Rows are paired to book lines with the matcher's own name ranking, because exact names disagree in
predictable ways — the book says "Enlist One (250 Gal)" where we say "Enlist", "Crop Oil (Tote)"
where we say "Crop Oil, Insource". Using the matcher's logic rather than a second, stricter opinion
took unmatched rows from 117 to 15.

---

## 1. Invoice numbers — 23 strays, 18 of them identifiable

A stored number that is not in the book is not automatically a typo: **other vendors exist.** So
rather than guessing by edit distance, each stray was matched by *content* — the enterprise, the
date, and whether a book invoice carries every one of its products.

**Resolved, same day, every product accounted for** (the number is a keying slip):

| stored | → | invoice | date | comment |
|---|---|---|---|---|
| `162001` | → | 1062001 | same day | Fall 25 P&K Corn Yield Removal |
| `800312` | → | 8003212 | same day | Post Corn |
| `802974` | → | 8002974 | same day | PPI Peas |
| `802977` | → | 8002977 | same day | Pre Beans |
| `803346` | → | 8003346 | same day | Post Food Beans |
| `1061817` | → | 1061814 | same day | Fall 25 P&K |
| `1762812` | → | 1062812 | same day | VRA Removal Beans Fall 25 |
| `7032812` | → | 1062812 | same day | VRA Removal Beans Fall 25 |
| `8003206` (**5 rows**) | → | 8003207 | same day | Post Corn |
| `8022883` | → | 8002283 | same day | Pre Verdict Outlook |
| `10.50` | → | 8003271 | same day | Post Corn — a unit price in the number field |

**Resolved within a few days** (worth a glance, the date on the row is also wrong):

| stored | → | invoice | gap | comment |
|---|---|---|---|---|
| `802788` | → | 8002788 | 2 d | Pre Verdict Outlook |
| `800593` | → | 8004593 | 4 d | Fungicide |
| `80019684` | → | 8001984 | 1 d | Pre Resicore |
| `89001984` | → | 8001984 | 1 d | Pre Resicore |
| `980044183` | → | 8004183 | 5 d | Post Beans |
| `8001856qz` | → | 8001856 | 5 d | Pre Beans |
| `800188` | → | 8001888 | **28 d** | Mint urea — the weakest of the set, check this one |

**Not resolved — and probably not DeLong at all:**

| stored | field | rows | reading |
|---|---|---|---|
| `2712` | OM1 | 1 | Tulls manure — a manure hauler, not DeLong |
| `Delong` | Brad Inman's | 1 | the vendor name typed into the number field |
| `1061348` | phillhower east | 2 | fall lime + VRT; no book invoice carries both |
| `1061365` | Airport | 4 | a fall burndown — Veracity, Buccaneer, ester 2,4-D, application |
| `1061856` | Noss Torkelson West | 2 | fall P&K |

Those five are the interesting ones: if they are real DeLong invoices, **they are missing from the
export**, which matters for the $451k still unattached. If they are other vendors, they are fine as
they stand and the audit should stop calling them strays.

---

## 2. Cost stored as the unit price — 17 rows, $4,639.90 understated

The line's per-unit price landed in the cost column instead of the extended amount. Every one of
these is settled by the book:

| invoice | field | product | stored | book |
|---|---|---|---|---|
| 8001888 | Phillhower West | 21-0-0-24s AMS Granular | $580.00 | **$3,420.26** |
| 8002674 | Klug Davis | Sonic | $51.00 | **$1,252.05** |
| 8002274 | Wes's | Application - Liquid Pre | $9.75 | **$331.50** |
| 8002977 | suiter | Sonic | $64.63 | $275.32 |
| 8002275 | Twist Farm | Mauler | $164.42 | $221.97 |
| 8002274 | Wes's | Mauler | $164.42 | $261.43 |
| 8002283 | Jehovah | Outlook | $125.00 | $222.50 |
| 8001933 | Daun | Application - Liquid Pre | $9.75 | $106.28 |
| 8001857 | Lake | Ester 2,4-D | $36.00 | $62.28 |
| 8003352 | Daun | Crop Oil | $23.05 | $37.80 |
| 8001933 | Daun | Ester 2,4-D | $36.00 | $36.72 |
| 8002286 | Fox-Lemans | 12-0-0-26 Amm Thio | $395.00 | $155.24 ↓ |
| 8001857 | Lake | Veracity Elite II | $39.31 | $36.17 ↓ |
| 8001933 | Daun | Veracity Elite II | $39.31 | $21.62 ↓ |
| 8002283 | Jehovah | Dicamba DMA | $50.28 | $35.70 ↓ |
| 8002281 | Wes's | Dicamba DMA | $50.28 | $1.51 ↓ |
| 8002283 | Jehovah | Wi Tonnage Tax | $0.67 | $0.42 ↓ |

Five go **down**, because the quantity was under one unit. $4,639.90 is the net.

## 3. Cost disagrees for another reason — 24 rows, $6,587.63 net

Not the unit price, just wrong. The big one is plain:

| invoice | field | product | stored | book |
|---|---|---|---|---|
| 8001984 | Noss, Sid | Resicore XL (Bulk) | $669.50 | **$4,517.21** |
| 8002282 | Buchanon | 12-0-0-26 Amm Thio | $385.00 | $124.03 |
| 8002286 | Fox-Lemans | Application - Liquid Pre | $0.26 | $139.43 |
| 1062267 | Cuffs | 0-0-60 Potash | $4,960.60 | $4,930.60 |
| 1061998 | Schultz | 0-46-0 Triple Super | $4,626.73 | $4,526.73 |
| 8003267 | Larson | Premium Ams | $91.82 | $61.82 |
| 8003207 | Noss, Jeff | Meth Oil | $76.50 | $68.00 |

plus a tail of cent-level differences (Armezon $2,148.04 vs $2,148.30, 18-46-0 $13,175.73 vs
$13,175.76) that are rounding, not errors.

## 4. Quantity disagrees — 32 rows

Mostly transposed digits, and one that is off by a hundred:

| invoice | field | product | stored | book |
|---|---|---|---|---|
| 1062000 | Fox-Kettle | Wi Tonnage Tax | 490 | **4.9** Tons |
| 8004455 | Carrol | Approach Prima | 136 | **7.25** Gal (the acreage, not the quantity) |
| 8003075 | Buchanon | Miravis ace | 4.6 | 4.06 Gal |
| 8003156 | Carrol | Atrazine 4L | 17.5 | 17.05 Gal |
| 8003260 | Blue's | Atrazine 4L | 16.68 | 16.88 Gal |
| 8003524 | Elwood's | Application - Post | 68.07 | 67 Acre |
| 8002284 | Fagan | Application - Liquid Pre | 11.3 | 11.13 Acre |

## 5. invoiceAcres — 2 real typos, 77 legitimate

| invoice | field | stored | book |
|---|---|---|---|
| 1061968 | Carrol | 1299 | **129.9** |
| 8002474 | Schultz | 983.08 | **98.08** |

The other 77 are the ordinary disagreement between what the sprayer billed and what the enterprise
measures — Cuffs at 148.01 against a header of 148.1. **Not defects, and they must not be
"corrected" into one.** The audit separates them by magnitude for exactly this reason.

## 6. 15 rows have no matching line on their invoice

Worth a look individually; several are probably product-name aliases the ranking still misses.

---

## What I would do, on your say-so

1. **The 18 identified invoice numbers** — evidence is same-day plus every product. `800188` is the
   one I would look at first.
2. **The 17 rate-as-total costs** — the book settles each one. +$4,639.90 net.
3. **The 2 acreage typos and the 100× tonnage quantity** — unambiguous.
4. **Noss Sid's Resicore, $669.50 → $4,517.21** — the largest single gap in the book.

That is 38 rows and roughly **$11,200** of cost currently missing or misstated, all of it settled by
paperwork already in hand.

What I would **not** do without you: the 77 acreage drifts (not defects), the cent-level rounding,
and the five strays that may be other vendors — or may be invoices missing from DeLong's export.

---

# APPLIED — 2026-09-17

46 corrections written to production. Backup: `/var/backups/farm-ops/data.json.pre-bookfix-20260917-141126`.
farm-budget stopped around the write, as before.

The apply step consumes the audit's **own JSON output** and addresses rows by input id, not by
index — so what was written is what was reviewed, and a row the operator moved in the meantime is
skipped rather than mis-targeted.

| class | before | after |
|---|---|---|
| invoice numbers resolvable on content | 18 | **0** |
| cost stored as the unit price | 19 | **0** |
| acreage off by a factor of ten | 2 | **0** |
| quantity off by a factor of ten | 2 | **0** |
| Noss Sid's Resicore | $669.50 | **$4,517.21** |

**Recorded invoice cost: $523,817.48 → $533,302.13, up $9,484.65** across 585 rows, none added or
removed. Where it landed:

| enterprise | |
|---|---|
| Noss, Sid / Yellow Corn | **+$4,802.43** |
| Phillhower West / Peppermint | **+$2,840.26** |
| Klug Davis / High Oil Soybeans | +$1,201.05 |
| Wes's / High Oil Soybeans | +$418.76 |
| suiter, Jehovah, Daun, Twist Farm, Lake | +$410.68 between them |
| Fox-Lemans / Yellow Corn | −$239.76 |
| Wes's / Yellow Corn | −$48.77 |

Two go down, because the quantity was under one unit and the rate exceeded the line.

The crop/trait sweep still reads **0 invoiced rows flagged** afterwards.

## Two things I changed my mind about mid-write

**Invoice dates are not wrong, and I nearly overwrote 18 of them.** Correcting a number, it seemed
natural to take the book's date too. Checking first: **161 rows sit one to six days BEFORE their
invoice date** — 79 of them exactly one day. That is not drift, it is the stored date being the
**application** date, with DeLong billing a few days after the sprayer runs. Overwriting it would
have traded the date the pass happened for the date it was billed. The apply step now changes the
number only.

The genuine date outliers are a separate, small class: 3 rows exactly 365 days out (a year typed
wrong) and 3 rows around `0025-09-11`. Six rows, not 161.

**Fixing the numbers uncovered more than the report predicted.** Once `8022883` became `8002283`,
its Jehovah rows could be compared against the book for the first time — which is why the
rate-as-total class grew from 17 to 19 and the net from $4,639.90 to $5,636.94 between the report
and the write. The same effect lifted the untouched classes: cost gaps 24 → 29, quantity 32 → 37.
Those are newly *visible*, not newly broken.

## Still open

- **29 cost gaps** and **37 quantity disagreements** that are not the unit price and not a slipped
  decimal — mostly transposed digits (`4.6` for `4.06`, `17.5` for `17.05`). Each needs a glance;
  none is mechanical.
- **15 rows with no matching line** on their invoice.
- **5 strays that do not resolve**: `2712` (Tulls manure — a hauler, not DeLong), `Delong` (a vendor
  name in the number field), and `1061348`, `1061365`, `1061856` — three fall invoices no book entry
  matches. If those are real DeLong paper they are **missing from the export**, which bears on the
  $451k still unattached.
- **6 genuine date outliers** (3 off by a year, 3 with a year of `0025`).
