# Glomalin Portal — Architecture Notes

## Marketing Position & What-If (Sales module)

Rendered inside the Enterprise Planner's **Sales & Marketing → Contracts** tab via a
same-origin iframe (`/marketing/contracts`, route group `(embed)` — no portal chrome).

### Data sources (server-side, one RSC render)

| Data | Source | Notes |
|---|---|---|
| Contracts / sales | organic-cert Postgres via Prisma, proxied through `fetchCertServiceWithAuth('/api/marketing/contracts')` | **Not Supabase.** Bearer-token proxy; crop identified via `variantId → GrainVariant → HedgeableCommodity` |
| Grain variants + commodity | `/api/marketing/grain-variants` | Provides `commodity.name` and CBOT `symbol` ("C"/"S"/"W") — the join key for grouping |
| Projected production + COP | farm-budget `/api/budget-field-details` (`fetchBudgetService`) | Per-field `acres × yieldPerAcre` → projected bu; `expPerAcre / yieldPerAcre` acre-weighted → break-even $/bu |
| CBOT futures | farm-budget `/api/cbot-fetch?symbol=ZC\|ZS\|ZW` | Yahoo Finance, 15-min cache in farm-budget |

Per-crop rollups happen in pure TypeScript on the server render (no Supabase views —
the contract data doesn't live in Supabase). All fetches are `Promise.allSettled`;
any offline service degrades to `—` values, never fabricated numbers.

### Modules

- `src/lib/marketing/position.ts` — `computePosition()`: contracted/priced/open bu and
  bushel-weighted average price (integer cents). PRICED, FUTURES_FIXED, BASIS_FIXED,
  FOB, MIN_PRICE count as priced.
- `src/lib/marketing/position-by-crop.ts` — pure lib (tested in `position-by-crop.test.ts`):
  - `groupContractsByCommodity()` — contracts → commodity groups via variant lookup
  - `buildCropMarketingDataList()` — per-crop position, variant breakdown, dated sales
    list with running cumulative % sold, budget aggregates (projected bu, total COP,
    break-even), margin locked, overhedged flag. Crops with projected production but
    zero sales still get a card.
  - `applyScenario()` — stackable hypothetical sales → new blended WAP, % sold,
    locked revenue, profit vs total COP, margin/bu. Pure function; the what-if UI
    never writes to the contracts table.
- `src/components/marketing/crop-position-panel.tsx` — client component. One card per
  crop: coverage bar (% of projected sold), stat tiles, expandable sales list, variant
  sub-table, stacked what-if with before → after deltas. "Enter as real contract"
  dispatches `glomalin:open-new-contract` (CustomEvent), which `contract-list.tsx`
  listens for to open the existing create drawer — contract entry logic untouched.

### Semantics

- **% sold** = contracted bushels ÷ projected production (not priced ÷ contracted).
  Uncapped; > 100 % flags **overhedged**.
- **Average sale price** is always bushel-weighted, never a simple average of prices.
- **Break-even** = acre-weighted `expPerAcre / yieldPerAcre` ≡ total COP ÷ projected bu.
- **Missing COP** renders `—` with a pointer to the Budget tab; numbers are never invented.
- Palette: cyan (`glomalin-accent`) = positive/priced; amber/red = below break-even,
  overhedged, warnings. No green in this panel.
