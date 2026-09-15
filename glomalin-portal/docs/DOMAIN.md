# Glomalin — Domain Definitions

**Status:** authoritative. This file settles the questions that kept getting
re-litigated. Code must match this file; where they disagree, this file is right
and the code is a bug.

**Source:** three interview rounds with the farm operator, 2026-09-09.


**Rule for any future session:** read this file before writing code that touches acres,
bushels, prices, or costs. If a definition you need is missing, ask — do not invent one.
Every duplicate definition in this codebase was invented in good faith by someone who
didn't have this file.

---

## 1. Acres

**The acre number is the crop acres on the field record in farm-registry.**

- If planted acres differ from tillable acres, **planted acres are the authority**.
- Every per-acre figure — cost, yield, revenue, application rate — divides by this number.
- **FSA farm / tract / CLU acres are not the operational acre number.** They are a
  reporting projection, used only at 578 time to express how the acres are divided
  between farms, tracts and CLUs.

**Consequences for the code:**
- `clu_records.fsa_acres` must not feed any per-acre business figure. It feeds the 578
  and nothing else.
- `insurance_policies.planted_acres` should be sourced from the registry crop acres, not
  keyed by hand. Manual entry there is a divergence waiting to happen.
- A mismatch between registry crop acres and the sum of CLU acres for the same ground is
  a **reporting** warning, not a cost error. Surface it on the FSA screen, not the
  cost screen.

## 2. Grain contracts

**The system of record is the organic-cert service.** Contracts are entered through
Marketing Command Center → Add Contract.

- Supabase `sale_instruments` is **deprecated**. It is a parallel store that predates the
  cert service and is still read by the dashboard, field scorecard and performance page.
  Those readers get repointed; the table gets retired.
- Contract document upload exists today as a separate action. Target state: uploading a
  contract PDF is part of the New Contract flow, not a second step.

## 3. Priced bushels

One definition. Everything that reports position uses it.

| Instrument (cert) | Counts as priced? |
|---|---|
| `PRICED` | Yes |
| `FUTURES_FIXED` (labelled **HTA** in the UI) | **Yes** — futures locked is priced |
| `BASIS_FIXED` | Yes |
| `FOB` | Yes |
| `MIN_PRICE` | Yes |
| `PRICED_LATER` (PTF) | No — open |
| `SPOT` | No — open |
| `ACCUMULATOR` | **Not until modelled** — see below |

**HTA counts as priced.** Futures are locked; the basis leg being open does not make the
bushels unsold. Basis exposure is reported separately, on its own panel.

**Accumulators and options are in use and are not yet modelled correctly.**

The current Supabase implementation (`lib/marketing/queries.ts:28-46`) prorates an
accumulator by **elapsed time** — half the window gone means half the bushels priced.
That is wrong in both directions: it ignores the knock-out barrier, the double-up
trigger, and the leverage ratio, even though `ko_level`, `ki_level` and `leverage_ratio`
are already columns on the table. An accumulator that knocked out months ago still
reports bushels as priced; one that is doubling up reports half what it should.

**Until accumulators are modelled against live CBOT prices and real contract terms, they
must be shown as their own line and never folded into the priced total.** A wrong number
inside "priced bushels" is worse than a visible gap, because it silently changes how much
you think you have left to sell.

**UI requirement:** accumulators and options must carry plain-language explanations at
the point of use. Assume the reader does not know what a knock-out or a double-up is.
The explanation is part of the feature, not documentation.

## 4. Cost

**Every cost figure carries its provenance: `Actual` or `Budget`.** Never show an
unlabelled cost next to a labelled actual revenue. This is the single most important rule
in this file — see finding C-1 in the plan.

**Cost per bushel divisor:** estimated yield until harvest, then actual harvested
bushels once grain tickets land. **The UI must say which one is in use.** A $/bu that
silently switches basis mid-season is not comparable to itself.

**Where actual spend lives today:**

| Source | Structured? | Usable now? |
|---|---|---|
| Seed inventory receipts (Input Receiving) | Yes | **Yes** |
| Accounting software (QuickBooks or similar) | Yes, externally | Needs an export path |
| Paper / PDF invoices | No | Needs a capture path |

This is why "actual cost" cannot simply be switched on — see the plan.

## 5. Crop plans

**No versioning. Current plan only.** Explicit decision: once a plan changes, the old
plan is not retained.

Do not build plan history. If a future session proposes versioning
`zone_year_attributes`, this decision overrides it.

Note the boundary this draws: **cost comes from actuals, not from plans.** Actual spend
is recorded against what was received and applied, so replacing a plan never erases cost
that was already incurred. That is what makes "current plan only" safe.

## 6. Crop year

`CURRENT_CROP_YEAR` (`lib/config.ts`) is the only source. It rolls to the next year in
November.

**No hardcoded year lists anywhere.** `lib/fsa/calc.ts:564` and `:633` currently pin
`[2024, 2025]`, which is why tillage and cover-crop summaries are blank in the 2026 crop
year. Year-suffixed columns (`tillage_2024`, `cc_2025`) are the same mistake at the
schema level and should move to `zone_year_attributes`, which is already keyed by
`crop_year`.

## 7. Field and machine data

All three platforms are live on this farm:

| Source | Adapter status |
|---|---|
| Climate FieldView | Built, but **token refresh is not implemented** — expires and stops |
| CNH FieldOps | Built and working |
| **John Deere Ops Center** | **No adapter at all** — manual file export only |

Applied rates arrive with the source platform's own units and are stored unnormalized.
**A canonical unit must be chosen and enforced at the adapter boundary** before any
report compares or sums rates across sources.

## 8. Open decisions

Recorded so they are not silently invented later.

1. **How actual non-seed costs get captured.** QuickBooks export, invoice keying, or
   PDF extraction. Blocks the actual-cost chain.
2. **Canonical rate unit** for `coverage_events.rate` (lb/ac assumed, not confirmed).
3. **Contract price units** from the cert service — cents or dollars. The code assumes
   cents and rounds to whole cents, which would introduce roughly 3% error if the service
   returns dollars.
