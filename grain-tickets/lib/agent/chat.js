'use strict';

// Agentic loop + SSE streaming handler for the Glomalin chat agent.
// Uses Claude claude-haiku-4-5-20251001 with tool-use. Streams text deltas via SSE.
// Logs each conversation turn to AgentConversation table.

const Anthropic = require('@anthropic-ai/sdk');
const { getToolDefinitions, executeTool } = require('./tools');
const { buildSystemPrompt } = require('./system-prompt');
const { checkAndIncrementCap } = require('./daily-cap');
const prisma = require('../db');

// Singleton Anthropic client — uses ANTHROPIC_API_KEY from environment
const anthropic = new Anthropic.default();

// Helper: write a single SSE event
function writeSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function handleChat(req, res) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { message, history = [], sessionKey = 'unknown' } = req.body;

    if (!message || !message.trim()) {
      writeSSE(res, { type: 'error', error: 'Message is required' });
      return res.end();
    }

    // --- Daily cap check ---
    const capResult = await checkAndIncrementCap();
    if (!capResult.allowed) {
      writeSSE(res, {
        type: 'error',
        error: 'Daily message limit reached',
        count: capResult.count,
        remaining: 0
      });
      return res.end();
    }
    if (capResult.nearLimit) {
      writeSSE(res, {
        type: 'warning',
        message: 'Approaching daily limit',
        remaining: capResult.remaining
      });
    }

    // Build messages array for this turn
    const messages = [...history, { role: 'user', content: message }];

    // --- Agentic loop (max 10 iterations) ---
    const MAX_ITERATIONS = 10;
    let finalText = '';
    let allToolCalls = [];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const systemPrompt = await buildSystemPrompt();
      const tools = getToolDefinitions();

      // Stream this iteration
      const stream = anthropic.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages
      });

      // Stream text deltas to client
      stream.on('text', delta => {
        writeSSE(res, { type: 'text_delta', content: delta });
      });

      // Await final message from this iteration
      const response = await stream.finalMessage();

      if (response.stop_reason === 'end_turn') {
        // Extract final text from content blocks
        for (const block of response.content) {
          if (block.type === 'text') {
            finalText += block.text;
          }
        }
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Push assistant turn to messages
        messages.push({ role: 'assistant', content: response.content });

        // Execute all tool calls in this response
        const toolResults = [];
        for (const block of response.content) {
          if (block.type === 'tool_use') {
            // Notify client which tool is being called
            writeSSE(res, { type: 'tool_call', tool: block.name });

            // Execute tool
            let result;
            try {
              result = await executeTool(block.name, block.input);
            } catch (toolErr) {
              console.error(`Tool execution error [${block.name}]:`, toolErr);
              result = { error: `Tool error: ${toolErr.message}` };
            }

            // Track for audit logging
            allToolCalls.push({ tool: block.name, input: block.input, result });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          }
        }

        // Push tool results as next user message
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      if (response.stop_reason === 'max_tokens') {
        // Extract any text we got so far and stop
        for (const block of response.content) {
          if (block.type === 'text') {
            finalText += block.text;
          }
        }
        break;
      }

      // Unknown stop reason — break safely
      break;
    }

    // --- Send done event ---
    writeSSE(res, { type: 'done', fullText: finalText });

    // --- Log conversation to DB ---
    const toolCallsJson = allToolCalls.length > 0 ? JSON.stringify(allToolCalls) : null;
    try {
      await prisma.agentConversation.createMany({
        data: [
          {
            sessionKey,
            role: 'user',
            content: message,
            toolCalls: null
          },
          {
            sessionKey,
            role: 'assistant',
            content: finalText,
            toolCalls: toolCallsJson
          }
        ]
      });
    } catch (logErr) {
      // Conversation logging failure is non-fatal
      console.error('Failed to log conversation:', logErr);
    }

    res.end();
  } catch (err) {
    console.error('Chat handler error:', err);
    try {
      writeSSE(res, { type: 'error', error: 'Something went wrong' });
      res.end();
    } catch (writeErr) {
      // Response may already be closed
    }
  }
}

module.exports = { handleChat };
