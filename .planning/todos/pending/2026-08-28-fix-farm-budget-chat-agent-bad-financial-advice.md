---
created: 2026-08-29T04:02:40Z
title: Fix farm-budget chat agent bad financial advice + auth hole
area: farm-budget
files:
  - farm-budget/server.js:2341-2769 (entire /api/chat handler)
  - farm-budget/server.js:2374-2377 (the /ac unit bug)
  - farm-budget/public/calc.js:485-495 (proof: cropProfit is a total; avgProfitPerAcre is the real per-acre key)
  - farm-budget/server.js:2353 + farm-budget/public/app.js:9-10 (client-supplied role, defaults admin)
  - farm-budget/server.js:86-96 (EMBED_TOKEN auth is optional)
  - farm-budget/server.js:2615-2635 (silent cross-module fetch failure)
  - grain-tickets/lib/agent/ (the good agent pattern to port)
---

## Problem

The "Glomalin terminal" chat agent in farm-budget (`POST /api/chat`) gives bad
financial advice on "why isn't this farm profitable" / "compare enterprises".
Investigated 2026-08-28; root causes confirmed:

1. **Unit-label bug (the big one).** Enterprise summary lines label
   whole-enterprise dollar totals (`t.cropProfit`, `t.profitWithPayments`,
   accumulated with `+=` across fields in calc.js:485-487) with a hardcoded
   `/ac` suffix. The real per-acre value `totals.avgProfitPerAcre`
   (calc.js:494) is never sent to the model. A 1,200-ac enterprise reads as
   "profit $486000/ac" instead of ~$405/ac — error factor = acreage, so
   enterprise comparisons rank by size, not performance. Field-level (:2432)
   and crop-level (:2386) lines use correct per-acre keys, so the prompt
   contains contradictory numbers.

2. **Context freshness/honesty.** Dashboard computed with
   `yieldMode: 'projected'` but nothing tells the model these are forecasts —
   it states projections as actuals. Cross-module fetches (farm-registry :3005,
   grain-tickets :3000, fsa-acres :3002) fail silently — the catch at :2628
   swallows errors and omits the section with no marker, while the prompt still
   claims "live data from the entire Glomalin network". Futures up to 15 min
   stale, no timestamp. `max_tokens: 512` truncates answers.

3. **Security.** Chat role is trusted from the request body and defaults to
   `admin` at both hops (server.js:2353, app.js:9-10 reads `?role=` from URL) —
   all financial redaction defeated by omitting one field. The `/api` auth gate
   only exists if `EMBED_TOKEN` is set; unset, /api/chat is an unauthenticated,
   unmetered Anthropic proxy exposing full financials. No conversation logging,
   no rate limit, no daily cost cap (grain-tickets agent has all three).

## Solution

PHASE 1 SHIPPED 2026-08-30 (commits f9e6644, 463bedc; deployed to droplet,
verified live: no-auth 403, v2-grant role enforcement, per-acre answers
correct, chat-log.jsonl capturing). Voice layer in farm-budget/lib/voice.js.
Grant format now v1 + v2 (v2 = role in signed payload); portal mints v2 for
farm-budget only — sibling app verifiers are still v1-only, roll v2 out
per-app if wanted. REMAINING: Phase 2 below.

Phase 1 (afternoon, quick fixes):
- Send `avgProfitPerAcre` (and/or correctly-labeled totals) in enterprise
  summary; drop the bogus `/ac` suffix on totals.
- Prompt hardening: label projections as projections, timestamp sections,
  emit "SECTION UNAVAILABLE" markers when a cross-module fetch fails, raise
  max_tokens.
- Derive role server-side (portal session/token, not request body), make
  EMBED_TOKEN mandatory, add kill switch + daily cap + conversation logging
  (copy grain-tickets patterns: daily-cap.js, AgentConversation).

Voice requirement (added 2026-08-28): the agent should speak in
glomalinguild's own rhetorical tone — users should feel like they're talking
directly to them, not to a generic assistant. Per their instruction
(2026-08-29): NO sample-gathering session, NO email mining — build the voice
spec from existing material only (their chat messages to Claude + the
Mansfield Files CLAUDE.md prose). Bake it into the system prompt as a
distinct layer applied across all three role personas (admin/office/operator
at server.js:2660-2687), kept in its own prompt file so it can be tuned
without touching handler code.

Draft voice spec (distilled 2026-08-29 from live conversation while the
samples were in context — refine this, don't re-derive from scratch):

- Two registers. Quick-command register (chat): lowercase, terse, ellipses
  stringing thoughts together, imperative, zero ceremony ("ok... put it in
  the to do list"). Explaining register (Mansfield CLAUDE.md prose):
  compressed declaratives, semicolon pivots, dry humor doing load-bearing
  work, concrete imagery over abstraction ("software and steel are the same
  material viewed from different rooms"; "we don't specialize; we
  metabolize"). Financial answers should blend the two: lead with the number
  in quick-command rhythm, explain in Mansfield register.
- Answer first, context second. Never pad, never apologize, never corporate
  hedge. Blunt assessments are in-voice — call a losing field a losing
  field.
- Uncertainty handled by stating it flat, not softening around it ("don't
  know yet" beats "it's difficult to say with certainty").
- Short lines. The existing terminal-style constraint in the prompt already
  fits the voice — keep it.
- Do NOT replicate typos or force lowercase everywhere — capture rhythm and
  bluntness, not transcription errors. That's caricature, not voice.

Phase 2 (real phase, discuss first): port the grain-tickets tool-based agent
pattern (grain-tickets/lib/agent/ — agentic loop, typed tools, strict system
prompt) to farm-budget with tools like get_enterprise_summary,
get_field_budget, compare_enterprises that call Calc directly at answer time,
replacing the pre-stuffed context blob.
