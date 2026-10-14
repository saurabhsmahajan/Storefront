// Fails if any value from .env (8+ characters) appears in a file tracked by git.
// Prints only the variable name and the file, never the value.
// Run from the repo root: node scripts/check-env-values-not-committed.mjs [envFile]
import fs from "node:fs";
import { execFileSync } from "node:child_process";

// Public by design: the project web address is shipped to every browser by the frontend
// and appears in evidence as the function address. Everything else is treated as secret.
const PUBLIC_BY_DESIGN = new Set(["SUPABASE_URL"]);

const envFile = process.argv[2] ?? ".env";
if (!fs.existsSync(envFile)) {
  console.error(`No ${envFile} here. Nothing to check against.`);
  process.exit(2);
}
const secrets = [];
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
  );
  if (!m) continue;
  const value = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  if (value.length >= 8 && !PUBLIC_BY_DESIGN.has(m[1]))
    secrets.push([m[1], value]);
}
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => !f.endsWith("package-lock.json") && fs.existsSync(f));
const hits = [];
for (const f of files) {
  let text;
  try {
    text = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }
  for (const [name, value] of secrets) {
    if (text.includes(value)) hits.push(`${name} found in ${f}`);
  }
}
console.log(
  `Skipped as public by design: ${[...PUBLIC_BY_DESIGN].join(", ")}.`,
);
console.log(
  `Checked ${secrets.length} values from ${envFile} against ${files.length} tracked files.`,
);
if (hits.length) {
  console.error("SECRET VALUES IN GIT:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("No .env value appears in any tracked file.");
