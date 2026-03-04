---
phase: 14-add-chat-agent-for-system-information-and-recall
plan: 01
subsystem: api
tags: [anthropic, claude, sse, prisma, agent, chat, tool-use, postgresql]

# Dependency graph
requires:
  - phase: 11-buyer-registry-ticket-extensions
    provides: Buyer, GrainBin, Ticket Prisma models used by agent tools
  - phase: 13-reconciliation-engine-discrepancy-ui
    provides: Complete grain-tickets server.js that agent routes are wired into

provides:
  - AgentConversation Prisma model for conversation logging
  - AgentNote Prisma model for learnable facts with CRUD API
  - AgentDailyUsage Prisma model for daily message cap tracking
  - lib/agent/tools.js with 9 tool definitions and Prisma executeTool dispatcher
  - lib/agent/system-prompt.js with Glomalin character prompt and AgentNote injection
  - lib/agent/daily-cap.js for daily message cap check+increment
  - lib/agent/chat.js with SSE streaming agentic loop and conversation logging
  - /api/agent/* Express routes with kill-switch middleware
  - window.GLOMALIN_ENABLED injection into index.html

affects:
  - 14-02 (chat widget frontend that connects to these endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE streaming agentic loop with max 10 iterations and tool-use handling
    - Kill-switch middleware pattern for feature flags on route groups
    - cache_control ephemeral on Claude system prompt for cross-turn caching
    - Server-rendered / route injects feature flags into HTML before express.static
    - Write tools include _writeAction: true in result for audit trail

key-files:
  created:
    - grain-tickets/lib/agent/tools.js
    - grain-tickets/lib/agent/system-prompt.js
    - grain-tickets/lib/agent/daily-cap.js
    - grain-tickets/lib/agent/chat.js
    - grain-tickets/prisma/migrations/20260302231314_add_agent_models/migration.sql
  modified:
    - grain-tickets/prisma/schema.prisma
    - grain-tickets/server.js
    - grain-tickets/.env.example

key-decisions:
  - "claude-haiku-4-5-20251001 selected for chat agent — cost-effective for high-frequency grain queries"
  - "Agent deliberately cannot see settlement/reconciliation/financial data — enforced in tool definitions and system prompt"
  - "Write tools (add_ticket_note, flag_ticket, remember_note) include _writeAction: true for audit — confirmation guard in system prompt"
  - "flag_ticket uses [FLAGGED] notes prefix, not settlement matchStatus — keeps financial reconciliation clean"
  - "kill-switch middleware added at router level so a single env var disables all /api/agent/* routes"
  - "checkAndIncrementCap uses Prisma upsert (create-or-increment) — atomic, no race condition on first message of day"
  - "window.GLOMALIN_ENABLED injected server-side so frontend knows agent status before making API calls"

patterns-established:
  - "SSE handler: set headers → flushHeaders() → loop with stream.on('text') → write done event → log to DB → res.end()"
  - "Tool dispatcher: switch(name) → specific implementation function → return result object"

requirements-completed: [CHT-01, AGT-01, AGT-02, AGT-03, AGT-04]

# Metrics
duration: 5min
completed: 2026-03-02
---

# Phase 14 Plan 01: Add Chat Agent Backend Summary

**Glomalin chat agent backend: SSE streaming agentic loop with 9 Prisma-backed tools, conversation logging, daily cap enforcement, and kill-switch middleware on all /api/agent/* routes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-02T23:12:49Z
- **Completed:** 2026-03-02T23:17:34Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Accomplishments
- Added 3 new Prisma models (AgentConversation, AgentNote, AgentDailyUsage) with migration applied to PostgreSQL
- Built 4 lib/agent/ modules: tools (9 definitions + dispatcher), system-prompt (Glomalin character + note injection + cache_control), daily-cap (upsert-based tracking), chat (full SSE agentic loop)
- Wired all /api/agent/* Express routes with CHAT_AGENT_ENABLED kill-switch middleware verified to return 503 when disabled
- Notes CRUD (GET/POST/PUT/DELETE), status endpoint, conversations audit log, and chat SSE endpoint all live

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + migration + lib/agent/ modules** - `4d61548` (feat)
2. **Task 2: Wire /api/agent/* routes in server.js** - `54b9463` (feat)

**Plan metadata:** (docs commit — created below)

## Files Created/Modified
- `grain-tickets/prisma/schema.prisma` - Added AgentConversation, AgentNote, AgentDailyUsage models
- `grain-tickets/prisma/migrations/20260302231314_add_agent_models/migration.sql` - Migration SQL
- `grain-tickets/lib/agent/tools.js` - 9 tool definitions (7 read, 2 write-flagged) + executeTool dispatcher using Prisma + Calc.js
- `grain-tickets/lib/agent/system-prompt.js` - Glomalin Gen Z farmhand character prompt with note injection + cache_control ephemeral
- `grain-tickets/lib/agent/daily-cap.js` - CHAT_DAILY_CAP enforcement via AgentDailyUsage upsert
- `grain-tickets/lib/agent/chat.js` - SSE streaming agentic loop (max 10 iterations), tool-use handling, conversation logging
- `grain-tickets/server.js` - Kill-switch middleware, all /api/agent/* route registrations, GLOMALIN_ENABLED injection into index.html
- `grain-tickets/.env.example` - Added CHAT_AGENT_ENABLED, CHAT_DAILY_CAP, ANTHROPIC_API_KEY docs

## Decisions Made
- Used `claude-haiku-4-5-20251001` for the agent — cost-effective for the high-frequency grain data queries expected in a farm operations setting
- Agent tools deliberately exclude all settlement/reconciliation/financial data (no prices, payments, matchStatus) — enforced at both the tool definition level and system prompt rules
- Write tools (`add_ticket_note`, `flag_ticket`, `remember_note`) return `_writeAction: true` for audit trail; confirmation guard is in the system prompt character rules, not hard-coded in the agentic loop
- `flag_ticket` uses a `[FLAGGED]` prefix in the notes field rather than touching `matchStatus` — keeps settlement reconciliation clean and unambiguous
- `checkAndIncrementCap` uses Prisma upsert (create-with-count-1 or increment-by-1) — single atomic operation, no race condition on the first message of any day
- `window.GLOMALIN_ENABLED` is injected server-side on the `/` route before `express.static` so the frontend widget knows agent status without making an extra API round-trip on page load

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. The ANTHROPIC_API_KEY was already present in grain-tickets/.env from the scan.js barcode feature. Migration applied cleanly. All modules loaded without import errors on first attempt.

## User Setup Required
CHAT_AGENT_ENABLED=true has been added to the grain-tickets/.env file. The ANTHROPIC_API_KEY was already present. The agent is enabled and ready.

To disable the agent: set `CHAT_AGENT_ENABLED=false` in grain-tickets/.env and restart the server.

## Next Phase Readiness
- Backend agent API is complete and tested — POST /api/agent/chat streams SSE events correctly
- Daily cap tracking and conversation logging are live
- Notes CRUD is available for admin management from any HTTP client
- Plan 02 (chat widget frontend) can now connect to these endpoints and build the UI layer
- No blockers

---
*Phase: 14-add-chat-agent-for-system-information-and-recall*
*Completed: 2026-03-02*
