import Groq from 'groq-sdk';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { toolDefinitions, executeToolCall } from '../tools/index.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MAX_TOOL_ITERATIONS = 6;

/**
 * Strip null/undefined values recursively from an object.
 * Models often pass null for optional parameters.
 */
function stripNulls(obj) {
  if (Array.isArray(obj)) return obj.filter(v => v !== null && v !== undefined).map(stripNulls);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, stripNulls(v)])
    );
  }
  return obj;
}

/**
 * Run the agent loop for a conversation.
 * @param {Array} userMessages - array of {role, content} objects
 * @returns {{ content: string, tool_calls_made: string[] }}
 */
export async function agentLoop(userMessages) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...userMessages,
  ];

  const toolCallsMade = [];
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    let response;
    try {
      response = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        temperature: 0.05,
        max_tokens: 4096,
      });
    } catch (err) {
      // Groq tool_use_failed: model passed invalid args (usually nulls for optional params)
      const errBody = err?.error?.error || {};
      const errMsg = errBody.message || err.message || String(err);
      
      if (errBody.code === 'tool_use_failed' && errBody.failed_generation) {
        console.warn('[agent] Tool call validation failed — extracting and cleaning args from failed_generation');
        try {
          // Parse the failed generation to get name + args
          const fg = JSON.parse(errBody.failed_generation);
          const toolName = fg.name;
          const rawArgs = fg.arguments || {};
          const cleanArgs = stripNulls(rawArgs);
          console.log(`[agent] Retrying ${toolName} with cleaned args:`, JSON.stringify(cleanArgs).slice(0, 200));
          
          toolCallsMade.push(toolName);
          let result;
          try {
            result = await executeToolCall(toolName, cleanArgs);
          } catch (toolErr) {
            result = { error: `Tool ${toolName} failed: ${toolErr.message}` };
          }
          
          // Remove the bad assistant message we pushed, add a synthetic tool result
          messages.pop(); // remove the bad assistant message
          // Add a user message asking to synthesize from the tool result
          messages.push({
            role: 'user',
            content: `Here is the data from the ${toolName} tool call:\n\n${JSON.stringify(result, null, 2)}\n\nPlease answer the original question using this data.`,
          });
          // Continue to next iteration to get final answer
          iteration++;
          continue;
        } catch (parseErr) {
          console.error('[agent] Could not parse failed_generation:', parseErr.message);
        }
      }
      
      // Generic error — add error message and let the loop try to recover or exit
      if (errMsg.includes('tool call validation')) {
        messages.push({
          role: 'user',
          content: 'There was a tool call error. Please answer the question without using any tools, based on your general knowledge of the data structure.',
        });
        iteration++;
        continue;
      }
      throw err;

    }

    const message = response.choices[0].message;
    messages.push(message);

    // No more tool calls — final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return {
        content: message.content || '(No response generated)',
        tool_calls_made: toolCallsMade,
      };
    }

    // Execute all tool calls
    for (const toolCall of message.tool_calls) {
      const name = toolCall.function.name;
      let args = {};
      try {
        const parsed = JSON.parse(toolCall.function.arguments || '{}');
        // Strip null/undefined values — models sometimes pass null for optional params
        args = stripNulls(parsed);
      } catch {
        args = {};
      }

      toolCallsMade.push(name);
      console.log(`[tool] ${name}(${JSON.stringify(args).slice(0, 150)})`);

      let result;
      try {
        result = await executeToolCall(name, args);
      } catch (err) {
        result = { error: `Tool ${name} failed: ${err.message}` };
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }

    iteration++;
  }

  return {
    content: 'I reached the maximum number of reasoning steps for this query. Please try rephrasing or breaking it into smaller questions.',
    tool_calls_made: toolCallsMade,
  };
}
