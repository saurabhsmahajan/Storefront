// Ordering rules for the storefront tools, enforced in code (not in a prompt).
// A tool listed here may only be called for an order after each prerequisite tool
// has succeeded for that same order in the same session.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PREREQUISITES = {
  check_refund_eligibility: ["get_order"],
};

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "mcp__storefront__get_order" -> "get_order"
export const bareName = (toolName) =>
  String(toolName).replace(/^mcp__[^_]+(?:_[^_]+)*?__/, "");

const normId = (input) => {
  const id = input?.order_id;
  return typeof id === "string" && FULL_UUID.test(id) ? id.toLowerCase() : null;
};

// state: { [toolName]: string[] of order ids that succeeded }
export function checkPrerequisites(toolName, input, state = {}) {
  const tool = bareName(toolName);
  const needs = PREREQUISITES[tool];
  if (!needs) return { allow: true };
  const id = normId(input);
  // Fail closed: a call we cannot tie to one order does not pass.
  if (!id) {
    return {
      allow: false,
      reason: `${tool} needs a full order_id before it can run.`,
    };
  }
  const missing = needs.filter((n) => !(state[n] ?? []).includes(id));
  if (missing.length) {
    return {
      allow: false,
      reason: `Blocked: ${tool} may only run after ${missing.join(" and ")} has succeeded for order ${id}. Call ${missing[0]} first.`,
    };
  }
  return { allow: true };
}

// Returns a new state with this call recorded, only when the call succeeded.
export function recordSuccess(toolName, input, succeeded, state = {}) {
  const tool = bareName(toolName);
  const id = normId(input);
  if (!succeeded || !id) return state;
  const seen = state[tool] ?? [];
  return seen.includes(id) ? state : { ...state, [tool]: [...seen, id] };
}

// A tool result is a success when its JSON has no top-level "error".
// Accepts the MCP content-block list that hooks receive, or an object with .content.
export function resultSucceeded(toolResponse) {
  const blocks = Array.isArray(toolResponse)
    ? toolResponse
    : toolResponse?.content;
  if (toolResponse?.isError === true || !Array.isArray(blocks)) return false;
  const text = blocks.find((b) => b?.type === "text")?.text;
  try {
    const body = JSON.parse(text);
    return body !== null && typeof body === "object" && !("error" in body);
  } catch {
    return false;
  }
}

// --- state kept between hook calls (one small file per session) ---
const dir = () => path.join(os.tmpdir(), "storefront-prereq");
const file = (sessionId) =>
  path.join(dir(), `${String(sessionId).replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

export function loadState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(file(sessionId), "utf8"));
  } catch {
    return {};
  }
}
export function saveState(sessionId, state) {
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(file(sessionId), JSON.stringify(state));
}
export function clearState(sessionId) {
  fs.rmSync(file(sessionId), { force: true });
}
