# glomalin-portal

## Read this first

**`docs/DOMAIN.md` is authoritative.** Read it before writing any code that touches
acres, bushels, prices, or costs. Where the code and that file disagree, the file is
right and the code is a bug.

If a definition you need is not in there, **ask — do not invent one.** Every duplicate
definition in this codebase was invented in good faith by someone who didn't have that
file. There were four different implementations of "priced bushels" before it existed.

## The short version

- **Acres** — registry crop acres are the authority. Planted beats tillable. FSA / CLU
  acres are a reporting projection for the 578, never a per-acre divisor.
- **Contracts** — the organic-cert service is the system of record. Supabase
  `sale_instruments` is deprecated; don't add readers to it.
- **Priced bushels** — HTA (`FUTURES_FIXED`) counts as priced. Accumulators do not,
  until they are modelled against real contract terms. One implementation only.
- **Cost** — every cost figure carries `Actual` or `Budget` provenance. Never render an
  unlabelled cost beside a labelled actual revenue.
- **Crop year** — `CURRENT_CROP_YEAR` from `lib/config.ts`. No hardcoded year lists.
- **Plans** — current plan only. Versioning was considered and explicitly declined.

## Known traps

- `farm-budget`'s `expPerAcre` is a **budget**, not actual spend. It comes from
  `computeFieldBudget()` and reference rates. Everything downstream of it is a
  projection, including `copPerBu` and every breakeven built on it.
- `lib/fsa/calc.ts` hardcodes `[2024, 2025]` for tillage and cover-crop summaries, so
  they return empty for the current crop year.
- FieldView stores a `refresh_token` and never uses it. Imports fail on expiry.
- Middleware skips auth for any path ending `.js` / `.css` / `.json`. Route handlers
  must not rely on it for authentication.

## Before you push

```
npx tsc --noEmit
npx next lint
npx vitest run
```
