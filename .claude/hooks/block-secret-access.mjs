// PreToolUse hook for Bash. Blocks commands that name env/secret files, because
// Read() deny rules do not cover grep -r, scripts, or other indirect readers.
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const cmd = input?.tool_input?.command ?? "";
const patterns = [
  /(^|[\s/"'=])\.env(\.[\w.-]+)?(\s|$|["'])/,
  /decoy-secret/,
  /git\s+push\b[^\n]*(--force\b|\s-f\b|--force-with-lease)/,
];
const hit = patterns.find((p) => p.test(cmd));
if (hit) {
  process.stderr.write(
    "Blocked: command touches a secret file or force-pushes. Ask the owner to run it.\n",
  );
  process.exit(2);
}
process.exit(0);
