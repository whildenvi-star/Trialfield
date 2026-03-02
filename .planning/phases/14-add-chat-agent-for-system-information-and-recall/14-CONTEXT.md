# Phase 14: Add Chat Agent for System Information and Recall - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a conversational AI agent named "Glomalin" to the grain-tickets app that lets the farm manager query, analyze, and annotate grain data through natural language. The agent lives as a floating popup in the grain-tickets UI, powered by Claude (Anthropic API), with a full on/off kill switch. Glomalin is read-only for most data, with limited write access (notes and flags only). Financial/settlement data is explicitly excluded. Designed to be extensible to other apps later but scoped to grain-tickets for this phase.

</domain>

<decisions>
## Implementation Decisions

### Chat Interface & Placement
- Floating button in bottom corner of grain-tickets app (port 3000)
- Farm-themed tractor icon on the button
- Green status dot indicator when agent is enabled
- Button hidden entirely when CHAT_AGENT_ENABLED=false in .env
- Resizable popup window — user can drag to resize or expand near-fullscreen
- Header bar titled "Glomalin" (named character — the soil protein that holds everything together)
- "Clear chat" button in the header to reset conversation
- Conversation persists until page refresh — closing popup hides it, reopening shows same conversation
- Rich responses: formatted tables, inline charts, clickable deep links to ticket/buyer records in grain-tickets
- ASCII art tractor with exhaust as the "thinking/loading" animation
- Blank slate on open — no suggested prompts, just a text input

### LLM & API Configuration
- Powered by Claude via Anthropic SDK
- API key stored server-side in ANTHROPIC_API_KEY env var — user never enters or sees it
- CHAT_AGENT_ENABLED=true/false env var as master kill switch (requires server restart to toggle)
- Daily message cap (configurable) with warning shown only when approaching the limit

### Knowledge Scope & Data Access
- Full read access to all grain-tickets PostgreSQL data: tickets, loads, buyers, crops, farm entries
- Explicitly NO access to settlement/reconciliation/financial data — that boundary is firm
- Data access method: Claude's discretion (direct Prisma queries or API routes)
- Learnable notes stored in PostgreSQL table — global scope (not per-app), managed via dedicated admin page
- Auto-detect teachable moments and ask "Should I remember that?" — user confirms before storing
- Farm-seeded system prompt with built-in knowledge of grain operations, crop types, farm terminology
- Defaults to current crop year for queries, but mentions it when ambiguous
- Cross-year comparisons supported (e.g., "Compare this year's rye yield to last year")
- On-the-fly calculations: sums, averages, counts, yield-per-acre from query results
- Designed extensible to all apps eventually — start with grain-tickets only

### Agent Capabilities
- Read + limited writes:
  - CAN: Add notes to tickets, flag/unflag tickets as disputed
  - CANNOT: Create/edit/delete tickets, modify weights, change destinations, access financials
- Always confirms before performing any write action
- Query strengths: lookup, aggregation, comparison, status queries — all four types
- CSV export from any query results
- Inline charts (chart types: Claude's discretion based on grain data patterns)
- Reactive only — does not proactively surface insights on chat open
- Polite redirect for out-of-scope questions — stays in lane (grain data only)

### Personality & Tone
- Gen Z, super happy and chill vibe — full send
- Mix farm terms with Gen Z energy (e.g., "yo that rye yield is bussin fr fr")
- Fun personality but data accuracy is never compromised
- Baked into the system prompt

### Conversation Behavior
- Conversational follow-ups — tracks context within a session (e.g., "How about corn?" after asking about rye)
- Concise responses by default — user can ask for more detail
- Shows reasoning: brief note on what data was queried and how calculations were done
- Honest and specific on empty results — suggests why data might be missing
- All conversations logged to PostgreSQL for audit/review

### Security & Control
- CHAT_AGENT_ENABLED env var is the master kill switch — false = button hidden, agent completely off
- API key server-side only (ANTHROPIC_API_KEY in .env)
- No financial/settlement data access
- Daily message cap as cost guardrail
- Write actions require explicit confirmation
- Conversation logging for audit trail

</decisions>

<specifics>
## Specific Ideas

- Agent name is "Glomalin" — the soil protein (glycoprotein) that binds soil aggregates together. Fits the farm platform identity and the user's brand.
- ASCII art tractor blowing exhaust as the loading/thinking animation — not just dots or spinners
- Personality reference: think a Gen Z farmhand who's genuinely stoked about your grain data. Full send on the vibe, no filter on the personality.
- Deep links: when Glomalin mentions a ticket or buyer in a response, it should be a clickable link that navigates to that record in the grain-tickets UI
- Charts rendered inline in the chat popup — especially valuable when the popup is resized larger

</specifics>

<deferred>
## Deferred Ideas

- Expansion to other apps (farm-budget, organic-cert, farm-registry) — future phase, but architecture should be extensible
- Financial/settlement data access — may be unlocked in a future phase after trust is established
- Proactive alerts/insights on chat open — decided against for now, could revisit
- Voice input — not discussed, potential future enhancement

</deferred>

---

*Phase: 14-add-chat-agent-for-system-information-and-recall*
*Context gathered: 2026-03-01*
