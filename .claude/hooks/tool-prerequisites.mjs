// Claude Code hook: enforces tool ordering for the storefront MCP tools.
// PostToolUse records successful lookups. PreToolUse blocks a call whose prerequisite
// has not succeeded for the same order in this session (exit code 2 blocks the call).
import { readFileSync } from "node:fs";
import {
  checkPrerequisites,
  loadState,
  recordSuccess,
  resultSucceeded,
  saveState,
} from "../../agents/mcp/prerequisites.mjs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // Cannot read the call: block rather than let an unchecked call through.
  process.stderr.write(
    "tool-prerequisites: unreadable hook input, call blocked.\n",
  );
  process.exit(2);
}
const {
  hook_event_name: event,
  session_id: session,
  tool_name: tool,
  tool_input,
} = input;

if (event === "PostToolUse") {
  const state = loadState(session);
  saveState(
    session,
    recordSuccess(
      tool,
      tool_input,
      resultSucceeded(input.tool_response),
      state,
    ),
  );
  process.exit(0);
}
if (event === "PreToolUse") {
  const verdict = checkPrerequisites(tool, tool_input, loadState(session));
  if (!verdict.allow) {
    process.stderr.write(verdict.reason + "\n");
    process.exit(2);
  }
}
process.exit(0);
