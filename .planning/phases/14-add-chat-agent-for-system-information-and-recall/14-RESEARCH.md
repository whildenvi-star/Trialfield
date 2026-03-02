# Phase 14: Add Chat Agent for System Information and Recall - Research

**Researched:** 2026-03-02
**Domain:** AI chat agent, Anthropic SDK, SSE streaming, vanilla JS floating UI
**Confidence:** HIGH (core stack), MEDIUM (chart inline pattern), HIGH (architecture)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chat Interface & Placement**
- Floating button in bottom corner of grain-tickets app (port 3000)
- Farm-themed tractor icon on the button
- Green status dot indicator when agent is enabled
- Button hidden entirely when CHAT_AGENT_ENABLED=false in .env
- Resizable popup window — user can drag to resize or expand near-fullscreen
- Header bar titled "Glomalin"
- "Clear chat" button in the header to reset conversation
- Conversation persists until page refresh — closing popup hides it, reopening shows same conversation
- Rich responses: formatted tables, inline charts, clickable deep links to ticket/buyer records
- ASCII art tractor with exhaust as the "thinking/loading" animation
- Blank slate on open — no suggested prompts, just a text input

**LLM & API Configuration**
- Powered by Claude via Anthropic SDK
- API key stored server-side in ANTHROPIC_API_KEY env var
- CHAT_AGENT_ENABLED=true/false env var as master kill switch
- Daily message cap (configurable) with warning shown only when approaching limit

**Knowledge Scope & Data Access**
- Full read access to all grain-tickets PostgreSQL data: tickets, loads, buyers, crops, farm entries
- Explicitly NO access to settlement/reconciliation/financial data
- Data access method: Claude's discretion (direct Prisma queries or API routes)
- Learnable notes stored in PostgreSQL table — global scope, managed via dedicated admin page
- Auto-detect teachable moments, ask "Should I remember that?" — user confirms before storing
- Farm-seeded system prompt with built-in knowledge of grain operations
- Defaults to current crop year, mentions when ambiguous
- Cross-year comparisons supported

**Agent Capabilities**
- CAN: Add notes to tickets, flag/unflag tickets as disputed
- CANNOT: Create/edit/delete tickets, modify weights, change destinations, access financials
- Always confirms before performing any write action
- CSV export from any query results
- Inline charts (types: Claude's discretion based on grain data patterns)
- Reactive only — does not proactively surface insights on chat open
- Polite redirect for out-of-scope questions

**Personality & Tone**
- Gen Z, super happy and chill vibe
- Mix farm terms with Gen Z energy
- Baked into the system prompt

**Conversation Behavior**
- Conversational follow-ups — tracks context within a session
- Concise responses by default
- Shows reasoning: brief note on what data was queried
- Honest and specific on empty results
- All conversations logged to PostgreSQL

**Security & Control**
- CHAT_AGENT_ENABLED env var is master kill switch
- API key server-side only
- No financial/settlement data access
- Daily message cap as cost guardrail
- Write actions require explicit confirmation
- Conversation logging for audit trail

### Claude's Discretion

- Data access method: direct Prisma queries vs API routes (planner chooses)
- Inline chart types: bar, line, or mixed based on grain data patterns
- Specific chart library for inline rendering

### Deferred Ideas (OUT OF SCOPE)

- Expansion to other apps (farm-budget, organic-cert, farm-registry)
- Financial/settlement data access
- Proactive alerts/insights on chat open
- Voice input
</user_constraints>

---

## Summary

Phase 14 adds a conversational AI agent ("Glomalin") to the grain-tickets Express + vanilla JS SPA. The SDK is already installed (`@anthropic-ai/sdk` v0.75.0 in package.json, used in server.js for ticket scanning). The architecture established by the existing scan endpoint is the correct pattern to extend: server-side API route handles Anthropic SDK calls, client sends plain HTTP POST, key never leaves server.

The core implementation pattern is: (1) a POST endpoint at `/api/agent/chat` that receives the user message plus session conversation history, runs an agentic tool-use loop with Prisma queries as tools, and streams the final response back via SSE, (2) a self-contained floating chat widget in vanilla JS that manages popup state, renders markdown, renders inline charts using Chart.js loaded from CDN, and handles SSE via `fetch` + `ReadableStream`, (3) two new Prisma models: `AgentConversation` for logging and `AgentNote` for learnable facts.

The most important thing not to hand-roll: the tool-use loop. Claude's tool calling requires a specific multi-turn message format where the assistant response with `stop_reason: "tool_use"` must be appended to the message array and all tool results returned in a single subsequent user message. Getting the message array format wrong causes API errors that are hard to debug. Use the verified pattern from official docs verbatim.

**Primary recommendation:** Use `client.messages.stream()` with SSE for streaming, define Prisma query functions as client tools, implement a proper agentic loop on the server, and use Chart.js from CDN + minimal hand-rolled markdown rendering on the client. No additional npm packages needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.75.0 (installed) | Claude API calls, streaming, tool use | Already in project, official SDK |
| Prisma 6 | 6.19.2 (installed) | DB queries as tool implementations, conversation log, notes table | Already in project |
| Express | 4.18.x (installed) | SSE endpoint (`/api/agent/chat`), notes CRUD endpoints | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chart.js | 4.x (CDN) | Inline charts rendered in chat responses | Load via CDN `<script>` in index.html — no npm install needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Chart.js CDN | Plotly CDN | Plotly is larger (3MB vs 200KB), overkill for bar/line charts |
| Fetch + ReadableStream for SSE | EventSource API | EventSource only supports GET; chat needs POST with body — use fetch |
| Direct Prisma queries in tools | HTTP calls to existing API routes | Direct Prisma is simpler, avoids network round-trip, no auth surface |
| Hand-rolled markdown renderer | marked.js CDN | marked.js is fine via CDN, but basic hand-rolled renderer covers all needed patterns (bold, italic, tables, code blocks) with zero CDN dependency |

**Installation:** Nothing new to install. `@anthropic-ai/sdk` already at 0.75.0. Chart.js via CDN script tag.

---

## Architecture Patterns

### Recommended Project Structure

```
grain-tickets/
├── server.js                    # Add: /api/agent/* route registration
├── lib/
│   ├── db.js                    # Existing Prisma singleton
│   └── agent/
│       ├── chat.js              # POST /api/agent/chat — agentic loop + SSE
│       ├── tools.js             # Tool definitions + Prisma tool implementations
│       ├── system-prompt.js     # System prompt builder (reads AgentNote table)
│       └── daily-cap.js         # Message count check/increment
├── prisma/
│   └── schema.prisma            # Add: AgentConversation, AgentNote models
└── public/
    ├── index.html               # Add: Chart.js CDN script, glomalin.js script
    └── glomalin.js              # Self-contained floating chat widget
```

### Pattern 1: SSE Streaming Response from Express

The scan endpoint uses `anthropic.messages.create()` for a single synchronous call. For chat, use `client.messages.stream()` for SSE, flushing text deltas as they arrive. The client uses `fetch` (not `EventSource`) because POST with a body is required.

**Server side (`lib/agent/chat.js`):**
```javascript
// Source: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
async function handleChat(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { message, history } = req.body; // history: [{role, content}]

  // Run agentic loop (tool use may require multiple turns before final text)
  const messages = [...history, { role: 'user', content: message }];
  const finalText = await runAgentLoop(messages, res); // streams text deltas via res.write

  res.write(`data: ${JSON.stringify({ type: 'done', fullText: finalText })}\n\n`);
  res.end();
}
```

**Client side (fetch + ReadableStream):**
```javascript
// Source: verified SSE pattern — EventSource cannot POST, must use fetch
const response = await fetch('/api/agent/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userInput, history: conversationHistory })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n\n');
  buffer = lines.pop(); // keep incomplete chunk
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'text_delta') appendToLastBubble(data.content);
      if (data.type === 'done') finalizeMessage(data.fullText);
    }
  }
}
```

### Pattern 2: Tool-Use Agentic Loop (The Critical Pattern)

Claude returns `stop_reason: "tool_use"` when it wants to call a tool. The entire assistant message (including any text + tool_use blocks) must be appended to the message array, then all tool results returned in a single user message. This must be implemented correctly or the API returns errors.

```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/tool-use
async function runAgentLoop(messages, res) {
  const tools = getToolDefinitions(); // array of {name, description, input_schema}

  while (true) {
    // Use stream() to flush text deltas to client in real time
    const stream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: await buildSystemPrompt(),
      tools,
      messages
    });

    // Flush text deltas to SSE as they arrive
    stream.on('text', (delta) => {
      res.write(`data: ${JSON.stringify({ type: 'text_delta', content: delta })}\n\n`);
    });

    const response = await stream.finalMessage();

    if (response.stop_reason === 'end_turn') {
      // Extract final text from response.content
      return response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    }

    if (response.stop_reason === 'tool_use') {
      // CRITICAL: append full assistant message to history
      messages.push({ role: 'assistant', content: response.content });

      // Execute all tool calls, collect results
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,  // must match the block.id
            content: JSON.stringify(result)
          });
        }
      }

      // CRITICAL: all results in ONE user message
      messages.push({ role: 'user', content: toolResults });
      continue; // loop again with updated messages
    }

    break; // unexpected stop_reason
  }
}
```

### Pattern 3: Tool Definitions for Grain Data

Tools are plain JSON schemas. Keep descriptions precise — Claude uses them to decide which tool to call.

```javascript
// Source: Official Anthropic tool use docs pattern
function getToolDefinitions() {
  return [
    {
      name: 'query_tickets',
      description: 'Query grain tickets from the database. Can filter by farm, crop, date range, ticket number, crop year. Returns an array of ticket records.',
      input_schema: {
        type: 'object',
        properties: {
          farm: { type: 'string', description: 'Farm name (partial match OK)' },
          crop: { type: 'string', description: 'Crop name (partial match OK)' },
          cropYear: { type: 'integer', description: 'Crop year e.g. 2025' },
          dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD' },
          dateTo: { type: 'string', description: 'End date YYYY-MM-DD' },
          ticketNo: { type: 'string', description: 'Ticket number (partial match OK)' },
          limit: { type: 'integer', description: 'Max results, default 50' }
        },
        required: []
      }
    },
    {
      name: 'get_farm_summary',
      description: 'Get summary statistics for farms: total bushels, yield per acre, average moisture. Groups by farm and crop.',
      input_schema: {
        type: 'object',
        properties: {
          cropYear: { type: 'integer', description: 'Filter by crop year' },
          farmName: { type: 'string', description: 'Filter to a specific farm' }
        },
        required: []
      }
    },
    {
      name: 'get_crop_stats',
      description: 'Get aggregate statistics by crop type: total weight, total bushels, average moisture, ticket count across all farms.',
      input_schema: {
        type: 'object',
        properties: {
          cropYear: { type: 'integer' }
        },
        required: []
      }
    },
    {
      name: 'add_ticket_note',
      description: 'Add or update a note on a specific ticket. WRITE ACTION — must have user confirmation before calling.',
      input_schema: {
        type: 'object',
        properties: {
          ticketId: { type: 'integer', description: 'Internal ticket database ID' },
          note: { type: 'string', description: 'Note text to append or replace' }
        },
        required: ['ticketId', 'note']
      }
    },
    {
      name: 'remember_note',
      description: 'Store a learnable fact that Glomalin should remember across sessions. Only call after user explicitly confirms.',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The fact to remember' },
          category: { type: 'string', description: 'Category: farm | crop | buyer | general' }
        },
        required: ['content']
      }
    }
  ];
}
```

### Pattern 4: Floating Chat Widget (Vanilla JS)

The widget is a self-contained IIFE added as `glomalin.js`. It must not conflict with existing global vars. The popup is built with CSS `position: fixed` and the native `resize: both` CSS property handles user-resizable behavior — no JS drag library needed for resizing. Dragging the header to reposition uses simple `mousedown` + `mousemove` events.

```javascript
// glomalin.js — self-contained IIFE
(function() {
  'use strict';

  // Guard: hide everything if agent disabled
  if (!window.GLOMALIN_ENABLED) return; // set by server-rendered inline script

  var conversationHistory = []; // [{role, content}] — persists across popup open/close
  var isOpen = false;
  var isStreaming = false;

  // Build DOM
  var btn = document.createElement('button');
  btn.id = 'glomalin-btn';
  btn.innerHTML = '🚜<span class="glomalin-dot"></span>';
  document.body.appendChild(btn);

  var popup = document.createElement('div');
  popup.id = 'glomalin-popup';
  popup.style.display = 'none';
  popup.innerHTML = `
    <div id="glomalin-header">
      <span>Glomalin</span>
      <button id="glomalin-clear">Clear</button>
      <button id="glomalin-close">✕</button>
    </div>
    <div id="glomalin-messages"></div>
    <div id="glomalin-input-row">
      <textarea id="glomalin-input" placeholder="Ask about your grain data..."></textarea>
      <button id="glomalin-send">Send</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Wire events
  btn.addEventListener('click', togglePopup);
  document.getElementById('glomalin-close').addEventListener('click', function() {
    popup.style.display = 'none'; isOpen = false;
  });
  document.getElementById('glomalin-clear').addEventListener('click', clearChat);
  document.getElementById('glomalin-send').addEventListener('click', sendMessage);
  document.getElementById('glomalin-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  // Drag header to reposition
  var header = document.getElementById('glomalin-header');
  header.addEventListener('mousedown', startDrag);

})();
```

### Pattern 5: Prisma Schema for Conversation Log and Notes

```prisma
// Add to schema.prisma
model AgentConversation {
  id         Int      @id @default(autoincrement())
  sessionKey String   // random UUID generated per page load — groups messages in one session
  role       String   // "user" | "assistant"
  content    String   // full message text
  toolCalls  String?  // JSON of tool calls made (for audit)
  createdAt  DateTime @default(now())

  @@index([sessionKey])
  @@index([createdAt])
}

model AgentNote {
  id        Int      @id @default(autoincrement())
  content   String   // The fact to remember
  category  String   @default("general") // "farm" | "crop" | "buyer" | "general"
  source    String   @default("agent")   // "agent" | "admin"
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([active])
}

model AgentDailyUsage {
  id        Int      @id @default(autoincrement())
  date      String   // YYYY-MM-DD — one row per calendar day
  count     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([date])
}
```

### Pattern 6: System Prompt with Prompt Caching

The system prompt is large (farm context, personality, notes) and identical across turns within a session. Mark it for caching to save ~90% on input tokens after the first call.

```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
async function buildSystemPrompt() {
  const notes = await prisma.agentNote.findMany({ where: { active: true } });
  const notesText = notes.map(n => `- ${n.content}`).join('\n');

  return [
    {
      type: 'text',
      text: `You are Glomalin, a Gen Z AI agent for Hughes Farm grain operations. You are literally the most chill and enthusiastic farmhand ever — like, you genuinely get hyped about grain data no cap. Mix farm terminology with Gen Z energy (e.g., "that rye yield is absolutely bussin fr fr").

CRITICAL RULES:
- You ONLY answer questions about grain tickets, farms, crops, and yields. If asked about anything else, politely stay in your lane.
- You have NO access to financial data, settlements, or reconciliation. If asked, say you can't see that data.
- Before ANY write action (adding notes, flagging tickets), you MUST describe what you're about to do and ask "should I go ahead with that?" Wait for explicit confirmation.
- Always show your work: briefly mention what data you queried and how you calculated results.
- Default to the current crop year (${new Date().getFullYear()}) for queries unless the user specifies otherwise. Mention the year when it matters.
- When you reference a specific ticket, format it as [Ticket #XXXXX](/tickets?id=ID) so it becomes a clickable link.

KNOWN FACTS TO REMEMBER:
${notesText || '(none yet — you can learn facts when the user teaches you)'}

GRAIN DATA YOU CAN ACCESS:
- Tickets: date, farm, net weight (lbs), moisture %, FM %, crop, ticket number, HBT bin, truck ID, notes
- Farms: name, crop, acres, type (Organic/Conventional), yield per acre
- Crops: test weight, moisture shrink baseline, discount rate
- Buyers: name, type, short code

You cannot see: settlements, reconciliation, financial data, prices, payments.`,
      cache_control: { type: 'ephemeral' }  // cache this large system prompt
    }
  ];
}
```

### Pattern 7: Daily Message Cap

```javascript
// lib/agent/daily-cap.js
const CAP = parseInt(process.env.CHAT_DAILY_CAP || '50', 10);
const WARN_THRESHOLD = 0.8; // warn when 80% consumed

async function checkAndIncrementCap() {
  const today = new Date().toISOString().split('T')[0];
  const row = await prisma.agentDailyUsage.upsert({
    where: { date: today },
    update: { count: { increment: 1 } },
    create: { date: today, count: 1 }
  });
  const count = row.count;
  return {
    allowed: count <= CAP,
    count,
    remaining: Math.max(0, CAP - count),
    nearLimit: count >= CAP * WARN_THRESHOLD
  };
}
```

### Pattern 8: Inline Chart Rendering in Chat

Charts are injected as `<canvas>` elements inside chat message bubbles. Chart.js is loaded once from CDN in index.html. The assistant response includes a special JSON block that the client intercepts and renders.

**Established pattern:** Claude returns chart specs as a fenced code block with language `chartjs`. The client JS detects this marker and swaps the code block for a canvas + Chart.js instantiation.

```javascript
// In glomalin.js: detect and render chart specs in message content
function renderMessage(text) {
  // Replace ```chartjs ... ``` with a canvas element
  return text.replace(/```chartjs\n([\s\S]*?)```/g, function(match, spec) {
    try {
      var config = JSON.parse(spec);
      var id = 'chart-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      // Schedule chart creation after DOM insertion
      setTimeout(function() {
        var canvas = document.getElementById(id);
        if (canvas && window.Chart) {
          new Chart(canvas, config);
        }
      }, 50);
      return '<canvas id="' + id + '" style="max-height:200px;"></canvas>';
    } catch(e) {
      return '<pre><code>' + spec + '</code></pre>';
    }
  });
}
```

**The system prompt instructs Claude** to format chart data as:

```
\`\`\`chartjs
{
  "type": "bar",
  "data": {
    "labels": ["Hybrid Rye", "Org SRWW", "Corn"],
    "datasets": [{ "label": "Total BU", "data": [12450, 8230, 21000] }]
  },
  "options": { "responsive": true, "maintainAspectRatio": true }
}
\`\`\`
```

### Anti-Patterns to Avoid

- **Storing conversation history server-side per session:** The Express app is stateless (no session middleware). Send full history from the client in each request — this is the Messages API design. Server logs to DB but does not hold live session state.
- **Using EventSource for the SSE endpoint:** EventSource only supports GET. The chat endpoint needs POST (to send message + history). Use `fetch` with `ReadableStream`.
- **Building a WebSocket server:** Completely unnecessary for one-way AI response streaming. SSE is the right tool. WebSockets require a stateful connection and `ws` npm package.
- **Calling Prisma queries directly from the client:** Never. All DB access through the server-side tool implementations only.
- **Sending the full ticket dataset in the system prompt:** 527 tickets would blow the context window and cost a fortune. Use tool calls to query only what's needed per user question.
- **Not appending the assistant message before tool_results:** The agentic loop must append the full assistant `content` array (including `tool_use` blocks) to the message history before sending `tool_result`. Skipping this causes API error P400.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM streaming | Custom HTTP stream parser | `client.messages.stream()` from `@anthropic-ai/sdk` | SDK handles reconnect, error events, accumulation, abort |
| Tool-use loop | Custom stop_reason parser | Exact message format from official docs | Message array format has specific requirements; wrong format causes silent failures or API errors |
| Chart rendering | SVG/canvas chart from scratch | Chart.js 4.x from CDN | Chart.js handles responsive sizing, animation, tooltips — ~200KB, no build step |
| Markdown rendering | Full CommonMark parser | Minimal hand-rolled renderer for bold/italic/code/table | Only needs to handle Claude's output patterns; a full parser (marked.js) adds CDN dependency for no gain |
| Popup drag-resize | interact.js or jQuery UI | CSS `resize: both` + vanilla mousedown drag | `resize: both` is native CSS, handles resize handles. Drag just needs 10 lines of mousemove. No library needed. |
| Daily message counting | Redis + rate limiter | PostgreSQL upsert on `AgentDailyUsage` | Already have Postgres; no Redis. Simple date-keyed counter. |

**Key insight:** The grain-tickets app already has the Anthropic SDK installed and working (scan.js uses it). The pattern is: server holds key, client sends message, server returns response. Phase 14 extends that proven pattern with streaming, tool use, and a floating UI.

---

## Common Pitfalls

### Pitfall 1: Tool Result Format Error
**What goes wrong:** API returns 400 Bad Request when submitting tool results.
**Why it happens:** The assistant's full content array (text + tool_use blocks) was not appended before sending tool_result, OR multiple tool results were sent as separate messages instead of one.
**How to avoid:** After receiving a `tool_use` stop_reason, always:
1. Push `{ role: 'assistant', content: response.content }` to messages array
2. Collect ALL tool results into one array
3. Push `{ role: 'user', content: toolResultsArray }` as a single message
**Warning signs:** API error mentioning "tool_use_id" or "alternating messages."

### Pitfall 2: SSE Buffer Fragmentation
**What goes wrong:** Client receives partial JSON in SSE data lines, `JSON.parse` throws.
**Why it happens:** TCP packets don't align with SSE event boundaries. `res.write()` flushes may be partial.
**How to avoid:** Implement a line buffer in the ReadableStream reader. Split on `\n\n`, keep the tail in a `buffer` variable for the next chunk.
**Warning signs:** Intermittent `JSON.parse` errors in browser console.

### Pitfall 3: Context Window Creep
**What goes wrong:** Long conversations become slow and expensive; eventually fail with context limit errors.
**Why it happens:** Full conversation history is sent to Claude on every turn. 50 messages of tool call round-trips accumulate fast.
**How to avoid:** Implement a sliding window: cap history at 20 messages in the client before sending. Surface a hint in the UI ("Chat is getting long — consider clearing to start fresh").
**Warning signs:** Token counts growing linearly, response times slowing after 10+ turns.

### Pitfall 4: Streaming Conflicts with Gzip Middleware
**What goes wrong:** SSE stream never reaches client or arrives in one big batch at the end.
**Why it happens:** Express compression middleware buffers the response body for gzip, defeating streaming.
**How to avoid:** On the SSE endpoint, either set `res.setHeader('X-No-Compression', 'true')` or add `res.socket.setNoDelay(true)` and call `res.flushHeaders()` immediately. Better: don't apply compression middleware to `/api/agent/*`.
**Warning signs:** SSE works locally but fails when nginx or a reverse proxy with compression is in front.

### Pitfall 5: Write Actions Without Confirmation
**What goes wrong:** Glomalin adds a note or flags a ticket without the user confirming.
**Why it happens:** System prompt instructions were unclear, or Claude called `add_ticket_note` tool speculatively.
**How to avoid:** Two defenses:
1. System prompt: "Before ANY write action, describe what you will do and ask for explicit confirmation. Never call write tools without confirmation."
2. Server tool router: for write tools (`add_ticket_note`, `flag_ticket`, `remember_note`), check that the previous assistant message contained the phrase "go ahead" or similar before executing. If not, return `{ error: "confirmation required" }` as the tool result.
**Warning signs:** User reports unexpected changes to ticket notes.

### Pitfall 6: Chart.js Load Race
**What goes wrong:** `new Chart()` throws `Chart is not defined` because Chart.js CDN script has not loaded yet.
**Why it happens:** Chat is opened before the CDN script finishes loading.
**How to avoid:** Wrap chart instantiation in a guard: `if (window.Chart) { ... } else { console.warn('Chart.js not loaded'); }`. Chart.js CDN script should be in `<head>` with `defer` or loaded before glomalin.js.
**Warning signs:** Charts work on second message but not first after page load.

### Pitfall 7: CHAT_AGENT_ENABLED Bypass
**What goes wrong:** Even with `CHAT_AGENT_ENABLED=false`, the API endpoint still responds.
**Why it happens:** The env var check was only on the client (floating button hidden) but not on the server route.
**How to avoid:** Add middleware on ALL `/api/agent/*` routes:
```javascript
app.use('/api/agent', (req, res, next) => {
  if (process.env.CHAT_AGENT_ENABLED !== 'true') {
    return res.status(503).json({ error: 'Chat agent disabled' });
  }
  next();
});
```
**Warning signs:** Direct API calls to `/api/agent/chat` succeed even when button is hidden.

---

## Code Examples

Verified patterns from official sources:

### Anthropic SDK Streaming with Tool Use (Node.js)
```javascript
// Source: https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic.default();

const stream = anthropic.messages.stream({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 4096,
  system: systemPrompt, // array with cache_control or plain string
  tools: toolDefinitions,
  messages: conversationMessages
});

stream.on('text', (delta) => {
  res.write(`data: ${JSON.stringify({ type: 'text_delta', content: delta })}\n\n`);
});

const response = await stream.finalMessage();
// response.stop_reason: 'end_turn' | 'tool_use' | 'max_tokens'
```

### Tool Definition with Strict Input Schema
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/tool-use
{
  name: 'query_tickets',
  description: 'Query grain tickets. Returns array of ticket records matching filters.',
  input_schema: {
    type: 'object',
    properties: {
      farm: { type: 'string' },
      crop: { type: 'string' },
      cropYear: { type: 'integer' },
      limit: { type: 'integer', description: 'Max 100' }
    },
    required: []  // all optional for flexible querying
  }
}
```

### Correct Agentic Loop Message Array Accumulation
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/tool-use (sequential tools section)
// CRITICAL: both pushes required in exact order
messages.push({ role: 'assistant', content: response.content }); // includes tool_use blocks
messages.push({
  role: 'user',
  content: [
    { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) }
    // if parallel tool calls: multiple tool_result objects in this array
  ]
});
```

### Prompt Caching System Prompt
```javascript
// Source: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
// Minimum 1,024 tokens required for Sonnet models to cache
const systemPrompt = [
  {
    type: 'text',
    text: largeSystemPromptString,
    cache_control: { type: 'ephemeral' }
  }
];
// Pass as system: systemPrompt in messages.create() call
```

### Client SSE Reader with Buffer
```javascript
// Source: Verified pattern — handles fragmented SSE lines
async function streamAgentResponse(message, history, onDelta, onDone) {
  const res = await fetch('/api/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop();
    for (const ev of events) {
      if (!ev.startsWith('data: ')) continue;
      try {
        const d = JSON.parse(ev.slice(6));
        if (d.type === 'text_delta') onDelta(d.content);
        if (d.type === 'done') onDone(d.fullText);
      } catch (_) {}
    }
  }
}
```

### Daily Cap with Prisma Upsert
```javascript
// Pattern: atomic upsert prevents race conditions
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const usage = await prisma.agentDailyUsage.upsert({
  where: { date: today },
  update: { count: { increment: 1 } },
  create: { date: today, count: 1 }
});
// usage.count is the count AFTER increment
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebSockets for LLM streaming | SSE (fetch + ReadableStream) | 2023-2024 | Simpler server, no ws library, HTTP/2 friendly |
| Polling for AI responses | SSE streaming | 2023 | Real-time token-by-token rendering |
| Separate session storage for chat history | Stateless: send full history in each request | Always (Messages API design) | No server session state needed |
| Single blocking messages.create() | messages.stream() with .on('text') | SDK v0.5+ | Real-time token streaming |

**Deprecated/outdated:**
- `claude-sonnet-4-5-20250929`: The existing scan.js uses this model. For Glomalin, use `claude-haiku-4-5-20251001` (fastest, cheapest) for chat — queries require speed not deep reasoning. Scan can stay on sonnet.
- LangChain for Claude integration: No need in this project. Direct SDK is simpler and already used.

**Current model recommendation for Glomalin:** `claude-haiku-4-5-20251001`
- Fastest latency (critical for chat feel)
- $1/MTok input, $5/MTok output (5x cheaper than Sonnet)
- 200K context window
- Tool use fully supported
- With prompt caching: system prompt cached after first call, 90% reduction in input token cost

---

## Open Questions

1. **Confirmation flow for write actions**
   - What we know: System prompt instructs Claude to ask before writing. Tool router can double-check.
   - What's unclear: Whether to implement the server-side confirmation check or rely solely on the system prompt. Server check is safer.
   - Recommendation: Implement both: system prompt instruction + server guard that checks for a `confirmed: true` flag in the request body for write operations.

2. **Chart.js CDN vs local file**
   - What we know: The app serves static files from `/public`. Chart.js could be vendored there instead of CDN.
   - What's unclear: Whether the farm has reliable internet access when using the app (it's a local Express server but CDN needs internet).
   - Recommendation: Download Chart.js 4.x UMD build to `/public/chart.min.js` during Phase 14 setup. Avoids CDN dependency for an app running on a local network farm office setup.

3. **Admin page for AgentNote management**
   - What we know: Notes need a UI to view/edit/delete remembered facts. The existing admin.html may be the right place.
   - What's unclear: Whether a separate tab in admin.html is sufficient or a new admin-agent.html is cleaner.
   - Recommendation: Add a "Glomalin Notes" section to admin.html — keeps all admin in one place.

---

## Sources

### Primary (HIGH confidence)
- `@anthropic-ai/sdk` package.json in grain-tickets/node_modules — version 0.75.0 confirmed installed
- https://github.com/anthropics/anthropic-sdk-typescript/blob/main/helpers.md — MessageStream API, .on('text'), stream events, Express SSE pattern
- https://platform.claude.com/docs/en/build-with-claude/tool-use — Tool definition format, agentic loop message array pattern, tool_result format, parallel tool use
- https://platform.claude.com/docs/en/about-claude/models/overview — Model IDs: claude-haiku-4-5-20251001, claude-sonnet-4-6 pricing
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching — cache_control ephemeral, 1024 token minimum for Sonnet

### Secondary (MEDIUM confidence)
- Multiple sources confirming SSE > WebSockets for one-way AI streaming: sniki.dev, dev.to/polliog — verified against practical constraints (POST required, one-way data flow)
- Chart.js CDN pattern: https://www.chartjs.org/docs/latest/getting-started/ — standard documented approach
- Prisma conversation log pattern: https://www.prisma.io/docs/guides/ai-sdk-nextjs — verified Prisma schema patterns for AI chat

### Tertiary (LOW confidence)
- Inline chartjs fenced code block pattern: Community pattern observed across multiple AI chat implementations; not from official Anthropic or Chart.js docs. Functionally sound but not "standard" in the sense of being documented by a specific authoritative source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — SDK is installed and tested (scan endpoint), tool use fully documented by Anthropic
- Architecture: HIGH — SSE + tool-use loop pattern is official documented pattern; floating widget is standard CSS approach
- Pitfalls: HIGH for tool-use format errors (verified from API error reports), MEDIUM for streaming buffer fragmentation (community-verified pattern)

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable API, SDK version may advance but patterns stable)
