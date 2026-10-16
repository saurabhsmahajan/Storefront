// Step F hooks for the Agent SDK Router. Pure decision functions plus the SDK wiring.
//
// 1. PreToolUse: tool ordering (reuses agents/mcp/prerequisites.mjs).
// 2. PreToolUse: execute_refund is a stub that needs a HUMAN approval for that order.
//    The approval comes from the host application (the `approvals` set), never from
//    the model's tool input, so the model cannot approve its own refund.
// 3. PostToolUse: redact payment details from any tool result before the model sees it.
//    Defence in depth: the MCP server already omits these fields.
import {
  bareName,
  checkPrerequisites,
  loadState,
  recordSuccess,
  resultSucceeded,
  saveState,
} from "../mcp/prerequisites.mjs";

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const REDACTED = "[redacted]";

// Keys are compared after lower-casing and removing "_" and "-".
const SENSITIVE_KEYS = new Set([
  "authorisationcode",
  "authorizationcode",
  "authcode",
  "cardlastfour",
  "lastfour",
  "cardlast4",
  "last4",
  "cardsummary",
  "expirydate",
  "expiry",
  "expirymonth",
  "expiryyear",
  "refusalreason",
  "refusalreasonraw",
  "rawrefusalreason",
]);
const norm = (k) => String(k).toLowerCase().replace(/[_-]/g, "");

// Returns { value, redactions: string[] } with sensitive keys replaced, at any depth.
export function redactValue(value, pathPrefix = "") {
  const redactions = [];
  const walk = (v, p) => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${p}[${i}]`));
    if (v && typeof v === "object") {
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        const here = p ? `${p}.${k}` : k;
        if (SENSITIVE_KEYS.has(norm(k))) {
          out[k] = REDACTED;
          redactions.push(here);
        } else out[k] = walk(x, here);
      }
      return out;
    }
    return v;
  };
  return { value: walk(value, pathPrefix), redactions };
}

// Takes the MCP content-block list (or an object with .content). Returns
// { response, redactions } where response has the same shape with text blocks cleaned.
// A text block that is not JSON is left alone, since a non-JSON result carries no keys.
export function redactToolResponse(toolResponse) {
  const isList = Array.isArray(toolResponse);
  const blocks = isList ? toolResponse : toolResponse?.content;
  if (!Array.isArray(blocks)) return { response: toolResponse, redactions: [] };
  const redactions = [];
  const cleaned = blocks.map((b) => {
    if (b?.type !== "text") return b;
    try {
      const r = redactValue(JSON.parse(b.text));
      redactions.push(...r.redactions);
      return r.redactions.length ? { ...b, text: JSON.stringify(r.value) } : b;
    } catch {
      return b;
    }
  });
  if (!redactions.length) return { response: toolResponse, redactions };
  return {
    response: isList ? cleaned : { ...toolResponse, content: cleaned },
    redactions,
  };
}

// The JSON body of the first text block (what the model sees), or null.
export function bodyOf(toolResponse) {
  const blocks = Array.isArray(toolResponse)
    ? toolResponse
    : toolResponse?.content;
  const text = Array.isArray(blocks)
    ? blocks.find((b) => b?.type === "text")?.text
    : null;
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Tool results as the escalation rules need them, read from the hook log:
// a successful call is its PostToolUse body; a call that Pre allowed but that never
// succeeded (an error result, a failure event or a crash) counts as one error.
export function toolResultsFromLog(hookLog = []) {
  const results = [];
  const succeeded = new Set();
  for (const e of hookLog) {
    if (e.event === "PostToolUse" && e.succeeded) {
      succeeded.add(e.tool_use_id);
      results.push({ name: e.tool, isError: false, body: e.body });
    }
  }
  for (const e of hookLog) {
    if (e.event === "PreToolUse" && e.allow && !succeeded.has(e.tool_use_id)) {
      results.push({ name: e.tool, isError: true, body: null });
    }
  }
  return results;
}

// Decides one tool call. `approvals` = Set of order ids a human has approved a refund for.
export function decideToolCall(toolName, toolInput, state, approvals) {
  const tool = bareName(toolName);
  if (tool === "execute_refund") {
    const id = toolInput?.order_id;
    if (typeof id !== "string" || !FULL_UUID.test(id)) {
      return {
        allow: false,
        reason: "execute_refund needs a full order_id.",
      };
    }
    if (!approvals?.has(id.toLowerCase())) {
      return {
        allow: false,
        reason: `Blocked: execute_refund for order ${id} needs approval from a human agent, and none has been recorded. Escalate to a human instead.`,
      };
    }
    // An approved refund must still follow a successful eligibility check for this order.
    const checked = (state?.check_refund_eligibility ?? []).includes(
      id.toLowerCase(),
    );
    return checked
      ? { allow: true }
      : {
          allow: false,
          reason: `Blocked: execute_refund for order ${id} may only run after check_refund_eligibility has succeeded for it.`,
        };
  }
  return checkPrerequisites(toolName, toolInput, state);
}

// Builds the `hooks` option for the SDK. `log` receives one entry per decision.
export function buildHooks({ approvals = new Set(), log = () => {} } = {}) {
  const pre = async (input) => {
    const state = loadState(input.session_id);
    const v = decideToolCall(
      input.tool_name,
      input.tool_input,
      state,
      approvals,
    );
    log({
      event: "PreToolUse",
      tool_use_id: input.tool_use_id ?? null,
      tool: input.tool_name,
      input: input.tool_input,
      allow: v.allow,
      reason: v.reason ?? null,
    });
    if (v.allow) return {};
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: v.reason,
      },
    };
  };
  const post = async (input) => {
    const ok = resultSucceeded(input.tool_response);
    saveState(
      input.session_id,
      recordSuccess(
        input.tool_name,
        input.tool_input,
        ok,
        loadState(input.session_id),
      ),
    );
    // An approval is single-use: a successful execute_refund spends it.
    if (ok && bareName(input.tool_name) === "execute_refund") {
      approvals.consume?.(input.tool_input?.order_id);
    }
    const { response, redactions } = redactToolResponse(input.tool_response);
    log({
      event: "PostToolUse",
      tool_use_id: input.tool_use_id ?? null,
      tool: input.tool_name,
      succeeded: ok,
      redactions,
      body: bodyOf(response),
    });
    if (!redactions.length) return {};
    return {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        updatedMCPToolOutput: response,
      },
    };
  };
  const failed = async (input) => {
    log({
      event: "PostToolUseFailure",
      tool_use_id: input.tool_use_id ?? null,
      tool: input.tool_name,
      error: String(input.error ?? "").slice(0, 300),
    });
    return {};
  };
  return {
    PreToolUse: [{ matcher: "mcp__.*", hooks: [pre] }],
    PostToolUse: [{ matcher: "mcp__.*", hooks: [post] }],
    PostToolUseFailure: [{ matcher: "mcp__.*", hooks: [failed] }],
  };
}
