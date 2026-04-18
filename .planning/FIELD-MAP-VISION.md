# Field Map Vision — The Panopticon

*Captured from conversation with Will, 2026-04-17*

---

## The Dream

The ultimate expression of the Maps tab is a **field panopticon** — an interactive, immersive representation of Rock County that makes the invisible visible. Not a spreadsheet with rows. Not a dashboard with numbers. A sensory and visual experience that helps the operator *understand* what happened out in the fields — and *communicate* it to others.

The long-term vision: select a field on a 3D terrain model of Rock County, and enter a realm of visualizations. Everything that occurred there — what was planted, what was applied, what was harvested, what the cert record says — rendered in a way that feels as real as the land itself.

Will said: *"It is SUCH a hard thing to conceptualize."*

That's the point. It isn't supposed to be easy to conceptualize — it's supposed to close the gap between the complexity of farming and the simplicity of understanding it.

---

## Why This Matters

Will spent 15 years perfecting a Google Sheets document called **the Macro** — tracking his father's operation, lifting early formulas from Excel files, which came from Lotus. It taught him everything he knows about farm budget tracking.

The farm-budget app is the digital expression of that document. It is Will's most complete thought about this platform. It is also, now, one of two places a user has to go — and that split is starting to feel like a problem.

The Maps tab is where both threads converge. It is not just a feature. It is the answer to the question: *what does it actually look like to run this farm?*

---

## Platform Feeling

Will described a feeling of **dissatisfaction** — not with any single feature, but with the user experience of the whole. Two platforms. Two ports. Two mental models. The glomalin portal has been accumulating new capabilities, but the experience of jumping between farm-budget and the portal creates friction that is felt but hard to articulate.

*"It takes me much more effort to generate a thought."*

That friction is the enemy of the panopticon. The goal is the opposite: a platform where understanding is effortless, where a farmer can walk an agronomist or a landowner through their entire operation without switching apps, without explaining the interface, without apologizing for how it looks.

---

## The Foundation

Phase 70 is not the panopticon. It is the foundation layer:

- 56 fields rendered as real polygons on satellite imagery
- Color-coded by crop and organic status
- Click a field, see what's planted there

But it must be built knowing where it's going. Every decision in Phase 70 — the map library, the data model, the component architecture — should leave the door open to:

- 3D terrain rendering
- Time-lapse animations (planting → emergence → harvest)
- Yield heat maps overlaid on field polygons
- Rotation history rendered as a visual timeline per field
- Weather and soil data layered on top

---

## Post-v12.0: Portal-First Milestone

The long-term technical path is a **Portal-First migration**: the glomalin portal becomes the single face of the platform. Farm-budget transitions to a data backend — an API server — with its UI gradually absorbed into the portal under macro-rollup, maps, and field ops modules.

This is not v12.0 work. But it is the direction. The maps module is where the portal starts to *feel* like it has a center of gravity.

---

*This vision is background context for the product, not a specification for any single phase.*
*For Phase 70 implementation decisions, see: `.planning/phases/70-interactive-field-map/70-CONTEXT.md`*
