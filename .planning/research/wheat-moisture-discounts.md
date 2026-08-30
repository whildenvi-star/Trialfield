# Wheat Moisture Discounts & Shrink Schedules — Verified Research

**Date:** 2026-08-29
**Method:** Deep-research workflow — 5 search angles, 18 sources fetched, 87 claims extracted, 25 adversarially verified by 3-vote panels (24 confirmed, 1 refuted). Run `wf_f8d6e3d5-559`.
**Full cited report:** https://claude.ai/code/artifact/7d406996-fa17-4d2c-973d-6e0cf7be909b
**Relevant to:** grain-tickets settlement math, `wheat_moisture_discount.xlsx`, glomalin-portal harvest views, MACRO revenue projections.

## The verified facts

1. **13.5% is the wheat base moisture, everywhere examined** (18–0 votes).
   USDA FSA/CCC loan eligibility, university extension, and every real elevator
   schedule (upper-Midwest HRS and eastern SRW alike) use 13.5%, typically at
   58 lb/bu test weight (60 lb/bu statutory). A few terminal/export thresholds
   tighten to 13.0%. For comparison: corn 15.5%, soybeans 13.0%, sorghum 14.0%.

2. **Shrink math** (12–0). Pure water-loss shrink = `100 / (100 − base)` =
   **1.156%/pt** for wheat at 13.5% base. Posted schedules run higher —
   **1.6–3.0%/pt** — because they bundle a ~0.5% handling-loss allowance.
   (Purdue's oft-cited 1.2–1.5%/pt range is from the *corn* handbook; wheat
   schedules run above it.)

3. **Schedule structure** (21–0, three tables verified verbatim):
   graduated shrink % in **half-point moisture brackets**, plus a **separate
   per-bushel drying charge**. Rates and drying-charge onset vary by elevator:

   | Elevator | Region/class | Shrink above 13.5% | Drying charge |
   |---|---|---|---|
   | CHS Ag Services (Warren MN, eff. 9/2025) | Upper Midwest HRS | 0.75% first ½-pt, +0.80%/½-pt (~1.6%/pt) | $0.03/bu per ½-pt from first bracket ($0.06/pt, to $0.45 @ 21%) |
   | Beardsley Farmers Elevator (MN, posted 2020) | Upper Midwest spring wheat | 1.5% per ½-pt (~3.0%/pt) | $0.05/pt/bu above 13.5% |
   | Deerfield Ag Services (OH, SRW) | Eastern SRW | 1.00% @ 13.6–14.0, +0.80%/½-pt (~1.6%/pt) | None until >18.0%, then $0.05–$0.24/dry bu |

   Cross-checks: Cargill Owensboro (SRW) matches Deerfield's rate; CHS Southwest
   Grain (ND) runs one schedule for spring/winter/durum (0.70% @ 14.0%, 1.8%/pt).

4. **Clamped at base — no dry premium, ever** (14–1). No schedule or source
   pays a premium or applies an expansion factor below 13.5%. Over-dried wheat
   forfeits water weight (~4% less pay at 10% MC).
   **This validates grain-tickets commit `8af478c`** ("clamp moisture shrink at
   base — dry grain earns no bonus bushels"). Trade-wide practice, not one
   elevator's quirk.

5. **No national standard** (6–0). NGFA Grain Trade Rules (Oct 2025, 30 rules)
   contain ZERO occurrences of "moisture," "shrink," "wheat," or "drying."
   Rule 12 leaves off-grade discounts to negotiation; "prevailing discounts"
   apply at mechanical-sampler unloads. Every schedule is local elevator
   practice — always model per-buyer, never hardcode one schedule.

## Refuted — do not use

A specific **CCC per-point dollar schedule** ($0.01/bu @ 13.6–13.7% stepping
to $1.30/bu @ 25.0%) attributed to the FSA grain-loan handbook was killed 0–3
in verification. If those figures appear in `wheat_moisture_discount.xlsx`,
treat them as unsourced. Only the CCC 13.5% eligibility standard survived.

## Implications for the platform

- **grain-tickets:** the clamp fix is correct and final. If we ever model full
  elevator settlement, the missing half is the **drying charge as a separate
  $/bu-per-point line** — half-point brackets, configurable onset (immediately
  above base vs. only above 18%), stacked on top of shrink, per buyer.
- **Schema shape suggested by real schedules:** per-buyer, per-crop-year
  discount schedule = base MC + ordered brackets of
  `(mcLow, mcHigh, shrinkPct, dryingChargePerBu)`.
- **MACRO / marketing:** shrink assumptions for wheat revenue projections
  should use ~1.6%/pt as the typical figure, not the 1.156% water-only number.

## Open questions

- Mill & terminal schedules unverified (do mills reject >13.0% instead of
  discounting?). All three verbatim examples are country elevators.
- HRW houses in KS/OK/TX not directly sourced.
- Interaction between moisture schedules and spring-wheat protein scales
  (CHS posts both) unexamined.
- Elevator schedules change at will — CHS figures effective Aug–Sep 2025,
  Beardsley's is from 2020. Re-verify before hardcoding numbers.

## Key sources

- Univ. of Arkansas Extension FSA-1078 (shrink math, handling loss) — uaex.uada.edu/publications/pdf/FSA-1078.pdf
- UA Extension wheat drying & storage (13.5% base, no dry compensation)
- USDA FSA Handbook 2-LP Grain (13.5% moisture standard)
- NGFA Grain Trade Rules Oct 2025 — ngfa.org
- CHS Ag Services / Beardsley / Deerfield / CHS Southwest Grain posted schedules
