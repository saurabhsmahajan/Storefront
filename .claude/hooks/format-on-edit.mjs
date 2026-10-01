// PostToolUse hook: runs Prettier on the file Claude Code just edited.
// Always exits 0 so a formatting problem never blocks the edit itself.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname } from "node:path";

// Extensions Prettier formats out of the box. Anything else (notably .sql,
// which Prettier has no parser for) is skipped.
const SUPPORTED = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".json",
  ".jsonc",
  ".json5",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".vue",
  ".md",
  ".mdx",
  ".yaml",
  ".yml",
  ".graphql",
  ".gql",
]);

function main() {
  let filePath;
  try {
    filePath = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
  } catch {
    return;
  }
  if (typeof filePath !== "string" || !existsSync(filePath)) return;

  const ext = extname(filePath).toLowerCase();
  if (!SUPPORTED.has(ext)) {
    console.log(
      `format-on-edit: skipped ${filePath} (${ext || "no extension"} not supported)`,
    );
    return;
  }

  // shell: true so npx resolves to npx.cmd on Windows; the path is quoted
  // because it may contain spaces.
  const result = spawnSync(`npx prettier --write "${filePath}"`, {
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status === 0) {
    console.log(`format-on-edit: formatted ${filePath}`);
  } else {
    const reason = (result.stderr || result.error?.message || "").trim();
    console.log(
      `format-on-edit: prettier failed on ${filePath}${reason ? ` (${reason.split("\n")[0]})` : ""}`,
    );
  }
}

try {
  main();
} catch {
  // never block the edit
}
process.exit(0);
