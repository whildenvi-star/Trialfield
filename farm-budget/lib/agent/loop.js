'use strict';

// Agentic loop for the MACRO chat agent, on raw fetch.
//
// farm-budget has no Anthropic SDK dependency (node_modules is excluded from
// the droplet rsync, so a new dep means an npm install on a <1GB box). The
// streaming tool-use protocol is small enough to parse directly, and the SSE
// contract to the browser stays exactly what it was: {text}, {error}, [DONE],
// plus an optional {status} the terminal shows while a tool runs.

const { toolsForRole, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./prompt');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_ITERATIONS = 6;

// One streaming turn. Relays text deltas through onText as they arrive and
// returns the assembled content blocks plus the stop reason.
async function streamTurn(apiKey, body, onText) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    const err = new Error('Claude API ' + resp.status);
    err.detail = errText.slice(0, 300);
    throw err;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const blocks = [];
  let buf = '';
  let stopReason = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();

    for (const line of lines) {
      if (line.indexOf('data: ') !== 0) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;

      let evt;
      try { evt = JSON.parse(payload); } catch (e) { continue; }

      if (evt.type === 'content_block_start') {
        const cb = evt.content_block || {};
        if (cb.type === 'text') {
          blocks[evt.index] = { type: 'text', text: cb.text || '' };
        } else if (cb.type === 'tool_use') {
          blocks[evt.index] = { type: 'tool_use', id: cb.id, name: cb.name, input: {}, _json: '' };
        }
      } else if (evt.type === 'content_block_delta') {
        const b = blocks[evt.index];
        if (!b || !evt.delta) continue;
        if (evt.delta.type === 'text_delta') {
          b.text += evt.delta.text;
          onText(evt.delta.text);
        } else if (evt.delta.type === 'input_json_delta') {
          b._json += evt.delta.partial_json || '';
        }
      } else if (evt.type === 'content_block_stop') {
        const b = blocks[evt.index];
        if (b && b.type === 'tool_use') {
          try { b.input = b._json ? JSON.parse(b._json) : {}; } catch (e) { b.input = {}; }
          delete b._json;
        }
      } else if (evt.type === 'message_delta') {
        if (evt.delta && evt.delta.stop_reason) stopReason = evt.delta.stop_reason;
      } else if (evt.type === 'error') {
        throw new Error(evt.error && evt.error.message ? evt.error.message : 'stream error');
      }
    }
  }

  return { stopReason, content: blocks.filter(Boolean) };
}

/**
 * Run the agent. `ctx` carries the live data handles (store, getRefs,
 * futuresCache, getLatestAudit, getCropYear); `emit` writes one SSE payload.
 * Returns { text, toolCalls } for the audit log.
 */
async function runAgent(opts) {
  const { apiKey, message, history, role, ctx, emit } = opts;

  const messages = [];
  history.forEach((m) => {
    if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content) {
      messages.push({ role: m.role, content: m.content });
    }
  });
  messages.push({ role: 'user', content: message });

  const system = buildSystemPrompt(role, ctx.getCropYear());
  const tools = toolsForRole(role);
  const toolCalls = [];
  let fullText = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const turn = await streamTurn(apiKey, {
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      system,
      tools,
      messages
    }, (delta) => {
      fullText += delta;
      emit({ text: delta });
    });

    const uses = turn.content.filter((b) => b.type === 'tool_use');

    if (turn.stopReason !== 'tool_use' || !uses.length) {
      if (turn.stopReason === 'max_tokens') emit({ text: '\n[response truncated]' });
      break;
    }

    messages.push({ role: 'assistant', content: turn.content });

    // If the model wrote a preamble before calling a tool, close the line so
    // its answer doesn't run into it.
    if (fullText && !/\n$/.test(fullText)) {
      fullText += '\n';
      emit({ text: '\n' });
    }

    const results = [];
    for (const use of uses) {
      emit({ status: use.name });
      let result;
      try {
        result = await executeTool(use.name, use.input, ctx, role);
      } catch (e) {
        console.error('[Chat] Tool error [' + use.name + ']:', e.message);
        result = { error: 'Tool failed: ' + e.message };
      }
      toolCalls.push({ tool: use.name, input: use.input });
      results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result) });
    }

    messages.push({ role: 'user', content: results });

    if (i === MAX_ITERATIONS - 1) {
      emit({ text: '\n[stopped: too many lookups for one question]' });
    }
  }

  return { text: fullText, toolCalls };
}

module.exports = { runAgent };
