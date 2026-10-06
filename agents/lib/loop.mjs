import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../config.mjs";

const client = new Anthropic();

export const FALLBACK_REPLY =
  "I'm passing you to a human agent who can help you from here.";

// Generic hand-written loop. Each specialist supplies its own system prompt,
// tool list (the allowlist) and execute function. Every exit returns
// "resolved" or "escalated". The result also reports toolErrors and
// forcedReason, which the escalation rules take as input.
export async function runLoop({
  system,
  tools,
  execute,
  message,
  maxSteps = 6,
  maxTokens = 4096,
}) {
  const allowed = new Set(tools.map((t) => t.name));
  const messages = [{ role: "user", content: message }];
  const steps = [];
  let escalation = null;
  let toolErrors = 0;
  let forcedReason = null;

  const finish = (outcome, reply, extra = {}) => ({
    outcome,
    reply,
    steps,
    escalation,
    toolErrors,
    forcedReason,
    ...extra,
  });
  const forceEscalate = (reason) => {
    forcedReason = reason;
    escalation = escalation ?? { reason, by: "code" };
    return finish("escalated", FALLBACK_REPLY, { forced: true });
  };

  for (let step = 1; step <= maxSteps; step++) {
    let res;
    try {
      res = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        tools,
        messages,
      });
    } catch (err) {
      steps.push({ step, error: err.message });
      return forceEscalate(`api_error: ${err.message}`);
    }

    // Pass the content back unchanged, including thinking blocks.
    messages.push({ role: "assistant", content: res.content });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolCalls = res.content.filter((b) => b.type === "tool_use");
    const log = {
      step,
      stop: res.stop_reason,
      tools: toolCalls.map((b) => ({ name: b.name, input: b.input })),
    };
    steps.push(log);

    if (res.stop_reason === "end_turn") {
      if (!text) return forceEscalate("empty_final_reply");
      return finish(escalation ? "escalated" : "resolved", text);
    }

    if (res.stop_reason === "tool_use") {
      const results = [];
      for (const block of toolCalls) {
        if (!allowed.has(block.name)) {
          toolErrors++;
          (log.violations ??= []).push(block.name);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: "Tool not allowed for this specialist.",
          });
          continue;
        }
        if (block.name === "escalate_to_human") {
          escalation = {
            reason: String(block.input?.reason ?? "no reason given"),
            by: "model",
          };
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify({ status: "escalated" }),
          });
          continue;
        }
        try {
          const out = await execute(block.name, block.input);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(out),
          });
        } catch (err) {
          toolErrors++;
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: err.message,
          });
        }
      }
      log.results = results.map((r) => ({
        is_error: r.is_error ?? false,
        content: String(r.content).slice(0, 600),
      }));
      messages.push({ role: "user", content: results });
      continue;
    }

    return forceEscalate(`unexpected_stop_reason: ${res.stop_reason}`);
  }
  return forceEscalate("step_cap");
}
