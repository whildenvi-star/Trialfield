# management_zones cleanup — plan

Read-only analysis, 2026-09-17. **No cleanup writes. Nothing here runs without your approval.**

Backup taken first: `~/FarmOpsBackups/geo-pre-import-lock-20260917/` and
`/var/backups/farm-ops/geo-pre-import-lock-20260917-161400/` — all four tables, custom-format dumps
plus a readable `all-four.sql.gz`, MD5-verified both ends.

---

## What the analysis changed about the diagnosis

I previously called the 64 unlinked rows "field boundaries loaded into the zone table". Matching
them **spatially** against `field_boundaries` — name matching is useless here, the zone table says
"Blues" and "Brads" where the registry says "Blue's" and "Brad Inman's" — splits them three ways:

| | count | what they are |
|---|---|---|
| **identical to a field boundary** (IoU 100%) | **41** | genuinely misfiled whole-field boundaries → archive |
| **close but smaller** (IoU 82–96%) | **9** | **real production zones**, mostly irrigated extents — Hoff Irrigation, Jones Irrigation, Gessley Irrigation, Christopherson Irr, KoppEastIrrBound, TownlineRdIrrBound, PhilhowerRdIrrBoun, OM1SHOP, Cuff |
| **materially different** (IoU 3–70%) | **14** | **real sub-field zones** — Gessert Irrigation, Klug-Davis, Peas26, Simpson Irrigation, East, Murray, SimpSouthSeed26, Simpsons, Buchanon, Gessert, SimpTrianSeed26, plus 3 zero-area |

So **only 41 of the 64 are misfiled boundaries. About 20 are real zones that were never linked** —
the irrigated portions of fields and the 2026 seed-production blocks. Those want linking, not
archiving, and they are exactly the sub-field geometry Phase 2 needs.

A second fact makes the whole job safer than it looked:

> **64 of the 74 `zone_year_attributes` rows sit on the unlinked zones, and all 64 are entirely
> blank** — no crop, no variety, no tillage, no intended use. The 10 rows carrying real content all
> sit on linked zones.

So the attribute rows at risk of orphaning are empty placeholders. Nothing of substance is lost by
archiving an unlinked zone; the 10 rows that matter are not in the firing line at all.

---

## Mechanism: archive, never delete

`field_boundaries` already has `is_deleted`, so the convention exists. For `management_zones` the
equivalent is three nullable columns and no data loss:

```
archived_at      timestamptz   -- null = live
archived_reason  text          -- 'misfiled-boundary' | 'duplicate' | 'sliver' | 'junk'
archive_batch    uuid          -- one cleanup run, so the whole thing reverses together
```

Every read filters `archived_at is null`. Reversing a step is one `UPDATE … SET archived_at = null`
against a batch id. **No row is ever removed.** The same three columns on `field_boundaries` would
let the two Schultz junk rows be quarantined the same way, rather than relying on `is_deleted`,
which currently means "hidden" and has never been used.

That is a schema addition, so it needs your go-ahead separately from the cleanup itself.

---

## Step 1 — repair validity first (25 rows)

Nothing spatial is trustworthy until this runs: the invalid geometries **broke the intersection
query outright** (`TopologyException: side location conflict`) until I wrapped everything in
`ST_MakeValid` for the analysis. All 25 invalid rows are among the unlinked 64.

`ST_MakeValid` on each, keeping the original in the archive. **14 of 25 move acres by more than 1%,
every one of them downward** — self-intersections inflate area, and repairing them shrinks it:

| zone | before | after | change |
|---|---|---|---|
| Torkelson East | 76.97 | 72.90 | **−5.29%** |
| Murray | 55.35 | 52.69 | −4.81% |
| Jessie Noss | 86.75 | 82.62 | −4.77% |
| Fox Kettle | 48.51 | 46.37 | −4.41% |
| Sid Noss | 105.06 | 100.65 | −4.19% |
| Gessley | 200.35 | 192.90 | −3.72% |
| Cuff | 134.89 | 130.07 | −3.57% |
| Twist | 31.00 | 29.97 | −3.33% |
| Schwallenbach | 30.15 | 29.18 | −3.22% |
| **Gessert Irrigation** | 262.09 | 254.21 | −3.01% |
| Fletcher Cribben | 119.90 | 116.58 | −2.77% |
| Brads | 48.93 | 47.93 | −2.05% |
| Larson | 54.34 | 53.37 | −1.79% |
| Schultz | 105.61 | 104.45 | −1.09% |
| the other 11 | | | under 1%, mostly 0.00% |

Most of these are in the archive-anyway group, so the repaired acreage never matters. **Gessert
Irrigation, Cuff and Klug-Davis are the exceptions** — real zones whose acreage changes on repair,
so those three are the ones to look at.

## Step 2 — the 41 misfiled boundaries → archive

IoU 100% against an existing `field_boundaries` row, so the boundary already exists and this is a
duplicate in the wrong table. Archive with `reason='misfiled-boundary'`, recording the matched
`registry_field_id` in the archive so the link is not lost. Their blank attribute rows go with them.

A sample of the 41, with the field each matched: Fox Den→fld_018, Airport→fld_002, Carrol→fld_009,
Schultz→fld_047, Brads→**fld_028**, Conventional→**fld_027** (Inman), Christophersons→fld_013,
Philhower Rd→fld_045, Townline Rd→fld_053, Blues→fld_006, Jeff Noss→fld_038, Sid Noss→fld_039,
Jessie Noss→fld_041, Torkelson East→fld_040.

Worth noting: "Conventional" is Inman and "Brads" is Brad Inman's — the same two parcels that were
mis-linked in farm-budget last week, distinguished correctly here by geometry.

## Step 3 — the ~20 real unlinked zones → link, do not archive

The 9 close and 14 differing rows are production zones. For each, propose
`registry_field_id` from the spatial match and **hold for your confirmation** — several are
irrigation extents whose name says which field they belong to, but three are zero-area
(`BlueCorn26`, `Avalon`, `Omni`) and belong in the sliver bucket instead.

This is the step that needs your eye. It is also the step that gives Phase 2 its first real zone
layer.

## Step 4 — the 22 duplicate pairs → keep newer, archive the other

**The re-pointing rule never fires: both sides of all 22 pairs have zero attribute rows.** So there
is nothing to move, and the rule reduces to a tiebreak. `created_at` is populated and distinct on
all 135 rows, so "keep the newer" is deterministic.

All 22 are linked, `Field – Parcel N` rows on: fld_003 Avalon Road (4), fld_021 Gessert (4),
fld_010 Cuffs (3), fld_036 Murray (3), fld_007 Buchanon (2), fld_032 Klug Davis (2),
fld_042 Omni (2), fld_043 OM1 (2).

If a future re-run finds attributes on the side being archived, it re-points them first and says so
— the rule stays in the script even though it is a no-op today.

## Step 5 — the 14 slivers → archive, with one exception each way

Under 0.1 acre. Four carry an attribute row, and those attribute rows are blank except one:

| zone | field | acres | attrs |
|---|---|---|---|
| Avalon Road – Parcel 1/2/3 (×2 each) | fld_003 | 0.0000–0.0001 | 0 |
| **Omni – BLUECORN26 1 2026** | fld_042 | 0.0000 | **1, crop = corn** |
| BlueCorn26 | (unlinked) | 0.0000 | 1, blank |
| Avalon | (unlinked) | 0.0001 | 1, blank |
| Omni | (unlinked) | 0.0003 | 1, blank |
| Phillhower East – Irrigation 2 | fld_045 | 0.0002 | 0 |
| Omni – Parcel 1 (×2) | fld_042 | 0.0003 | 0 |
| Gessley – Irrigation 2 | fld_022 | 0.0013 | 0 |

**`Omni – BLUECORN26 1 2026` is the one to stop on**: a zero-area polygon carrying the only
attribute row with a real crop on it. Archiving it loses the only record that blue corn was zoned on
Omni in 2026. That one needs a decision — re-draw the polygon, or keep the attribute and archive
only the geometry.

## Step 6 — the two Schultz junk rows → quarantine

In `field_boundaries`, not `management_zones`: `schultz-field-1` / `schultz-field-3`, named
"Schultz 1" and "Schultz 3", imported **2026-05-08**, **no geometry**, and ids that are not the
`fld_NNN` convention. Registry's real Schultz is `fld_047` and it has a proper boundary.

They are also the evidence that the destructive import never ran — this route's `DELETE` would have
removed them — so they are worth keeping in the archive rather than dropping.

---

## Order, and what each step depends on

1. **validity repair** — everything spatial depends on it; the analysis could not run without it
2. **archive the 41 misfiled boundaries** — removes most of the noise
3. **link the ~20 real zones** ← *needs your confirmation, field by field*
4. **archive the 22 duplicates** — mechanical once 1–3 are settled
5. **archive the 14 slivers** ← *one decision: `Omni – BLUECORN26 1 2026`*
6. **quarantine the 2 Schultz rows**

After 1–6: **135 zones → about 55 live**, all linked, all valid, none duplicated, none a sliver —
and the unique index from the import scope (`one current shape per field per layer`) becomes
creatable. It cannot be created today; the 22 duplicates would violate it.

## What I am not proposing

- No hard deletes anywhere.
- No acre changes outside `management_zones` — `reportingAcres` and `plantedAcres` are untouched, and
  the repaired zone acreages are reported, not propagated.
- No change to the 10 attribute rows that carry real content.
- No linking decided by name similarity. Every proposed link comes from geometry, and every one is
  yours to confirm.
