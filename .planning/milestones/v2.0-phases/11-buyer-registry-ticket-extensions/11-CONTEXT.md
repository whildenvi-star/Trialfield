# Phase 11: Buyer Registry & Ticket Extensions - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Buyers become first-class entities referenced by grain tickets. Every ticket delivery links to a buyer (from farm-budget) or an on-farm grain bin via FK. Tickets gain a cropYear field for season scoping. Per-buyer column mapping config is stored for Phase 12 settlement imports. Buyer CRUD happens in farm-budget (Macro Roll Up) — grain-tickets is read-only for buyer data.

</domain>

<decisions>
## Implementation Decisions

### Buyer data source
- Buyers come from farm-budget's Macro Roll Up via cross-app API call (same pattern as farm-registry)
- farm-budget runs on port 3001, endpoint: `/api/buyers`
- grain-tickets stores the farm-budget buyer ID on each ticket (FK reference, not cached name)
- No buyer CRUD in grain-tickets — all buyer management happens in farm-budget's Sales tab
- ShortCode field to be added to farm-budget's buyer model so grain-tickets can display abbreviated buyer names
- Some delivery destinations are missing from farm-budget today — user will add them there before or during Phase 11

### Grain bins as destinations
- GrainBin table in grain-tickets Prisma schema (id, name, capacity) — minimal model for destination reference only
- Bins appear alongside buyers in a single destination dropdown (bins prefixed, e.g., "[BIN] Bin #3")
- Currently 4 bins at 3,700 bu each (smooth wall cone bottom), but model should support growth
- No bin ledger, in/out tracking, or cleanout log in this phase — just destination references

### Ticket entry form changes
- Single "Destination" dropdown lists both buyers and grain bins
- Destination is required on all new tickets
- Dropdown remembers last-used destination (sticky via localStorage or similar)
- cropYear auto-derived from ticket date using harvest-season logic: June-Dec = that year, Jan-May = prior year (late delivery from prior harvest)
- cropYear is NOT a visible/editable field on the form — derived automatically
- Old tickets (pre-Phase 11) keep free-text destination field as-is, no migration of legacy destination text
- Destination field placement in form layout — Claude's discretion

### Ticket list filtering
- New "Destination" dropdown filter in ticket log filter bar, alongside existing Farm and Crop dropdowns
- New "Crop Year" dropdown filter with available years
- Whether to add a Destination column to the ticket table — Claude's discretion

### Farm Summary enhancements
- Farm Summary tab gets buyer/destination breakdown — show bushels per buyer per farm

### Column mapping storage
- Every buyer has a unique settlement format — different columns, order, naming
- Per-buyer column mapping config stored in grain-tickets' own PostgreSQL database (BuyerColumnMap or similar model)
- Mapping covers standard settlement fields (SET-04): ticket number, date, net weight, moisture, net bushels, price, deductions, net payment
- When/how column mapping is configured (advance setup vs during first import) — Claude's discretion

### Claude's Discretion
- Destination field placement in ticket entry form
- Whether to show Destination column in ticket log table
- Column mapping configuration timing (advance vs first-import discovery)
- BuyerColumnMap model design and storage approach
- How buyer list is cached/refreshed from farm-budget API (fetch on load, cache duration, etc.)

</decisions>

<specifics>
## Specific Ideas

- Destination dropdown pattern: single dropdown showing both buyers and bins — bins prefixed with "[BIN]"
- Sticky destination remembers last entry for faster bulk data entry during hauling
- Harvest-season cropYear logic: the farming calendar doesn't follow calendar year — loads in January are almost always from prior year's harvest
- Farm-budget already has buyer API at `/api/buyers` with CRUD routes — grain-tickets just needs to consume it
- User wants shortCodes visible in grain-tickets for compact display (ticket log columns, filters)

</specifics>

<deferred>
## Deferred Ideas

- **Smart grain bin monitoring** — IoT sensors, real-time fill levels, temperature monitoring — future phase
- **Full grain handling facility** — dryer, wet bin, scalehouse, multiple storage structures, employee operations app — future milestone
- **Grain bin per-bin ledger** — volume/crop/date in-out tracking, cleanout log, employee mobile entry — future phase
- **Bin data integration with Macro Roll Up Sales tab** — bin inventory feeding into sales/marketing decisions — future phase

</deferred>

---

*Phase: 11-buyer-registry-ticket-extensions*
*Context gathered: 2026-03-02*
