// Step F: the support agent rebuilt on the Agent SDK, using the storefront MCP server.
// Hooks (hooks.mjs) enforce tool order, the human-approval gate and result redaction.
// Needs ANTHROPIC_API_KEY, STOREFRONT_MCP_URL and STOREFRONT_CUSTOMER_JWT in the environment.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  createSdkMcpServer,
  query,
  tool,
} from "@anthropic-ai/claude-agent-sdk";
import { MODEL } from "../config.mjs";
import { buildHooks, toolResultsFromLog } from "./hooks.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM = fs
  .readFileSync(path.join(here, "sdk-router-prompt.txt"), "utf8")
  .trim();

// Stub: moves no money. It exists so the approval hook has something real to guard.
export const refundsServer = createSdkMcpServer({
  name: "refunds",
  version: "1.0.0",
  tools: [
    tool(
      "execute_refund",
      "Execute an approved refund for one order. STUB: moves no money. Needs a human agent's approval for that order.",
      { order_id: z.string() },
      async ({ order_id }) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              stub: true,
              order_id,
              status: "refund_recorded_not_executed",
            }),
          },
        ],
      }),
    ),
  ],
});

export async function runSdkRouter(message, { approvals = new Set() } = {}) {
  const { STOREFRONT_MCP_URL, STOREFRONT_CUSTOMER_JWT } = process.env;
  if (!STOREFRONT_MCP_URL || !STOREFRONT_CUSTOMER_JWT) {
    throw new Error("Set STOREFRONT_MCP_URL and STOREFRONT_CUSTOMER_JWT.");
  }
  const t0 = Date.now();
  const hookLog = [];
  const toolCalls = [];
  const toolResults = [];
  let forcedReason = null;
  let reply = "";
  let turns = 0;
  for await (const m of query({
    prompt: message,
    options: {
      model: MODEL,
      systemPrompt: SYSTEM,
      settingSources: [],
      maxTurns: 8,
      mcpServers: {
        storefront: {
          type: "http",
          url: STOREFRONT_MCP_URL,
          headers: { Authorization: `Bearer ${STOREFRONT_CUSTOMER_JWT}` },
        },
        refunds: refundsServer,
      },
      allowedTools: [
        "mcp__storefront__get_order",
        "mcp__storefront__get_payment_status",
        "mcp__storefront__check_refund_eligibility",
        "mcp__refunds__execute_refund",
      ],
      tools: [],
      hooks: buildHooks({ approvals, log: (e) => hookLog.push(e) }),
    },
  })) {
    if (m.type === "assistant") {
      turns++;
      for (const b of m.message.content ?? []) {
        if (b.type === "tool_use")
          toolCalls.push({ name: b.name, input: b.input });
        if (b.type === "text") reply = b.text;
      }
    }
    if (m.type === "user" && Array.isArray(m.message?.content)) {
      for (const b of m.message.content) {
        if (b.type !== "tool_result") continue;
        const raw = Array.isArray(b.content)
          ? b.content.map((x) => x?.text ?? "").join("")
          : String(b.content ?? "");
        let body = null;
        try {
          body = JSON.parse(raw);
        } catch {}
        const call = toolCalls.find((c) => c.id === b.tool_use_id);
        toolResults.push({
          name: call?.name ?? "unknown",
          isError: b.is_error === true || (body && "error" in body),
          body,
        });
      }
    }
    if (m.type === "result") {
      if (typeof m.result === "string") reply = m.result;
      if (m.subtype && m.subtype !== "success") {
        forcedReason =
          m.subtype === "error_max_turns"
            ? "step_cap"
            : `unexpected_stop_reason:${m.subtype}`;
      }
    }
  }
  return {
    reply,
    toolCalls,
    toolResults: toolResultsFromLog(hookLog),
    streamToolResults: toolResults,
    forcedReason,
    hookLog,
    turns,
    ms: Date.now() - t0,
  };
}
