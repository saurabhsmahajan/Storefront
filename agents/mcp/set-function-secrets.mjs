// Sets the three secrets storefront-mcp needs, from .env, without printing values.
// Run from the repo root: node --env-file=.env agents/mcp/set-function-secrets.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const e = process.env;
const wanted = {
  REFUND_AGENT_PASSWORD: e.REFUND_AGENT_PASSWORD,
  DECLINE_AGENT_PASSWORD: e.DECLINE_AGENT_PASSWORD,
  STOREFRONT_PUBLISHABLE_KEY: e.SUPABASE_PUBLISHABLE_KEY,
};
const missing = Object.entries(wanted)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(
    `Not set. Nothing was changed. Missing in .env (STOREFRONT_PUBLISHABLE_KEY comes from SUPABASE_PUBLISHABLE_KEY): ${missing.join(", ")}`,
  );
  process.exit(1);
}
const file = path.join(os.tmpdir(), `sf-mcp-secrets-${process.pid}.env`);
fs.writeFileSync(
  file,
  Object.entries(wanted)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);
try {
  const r = spawnSync(
    "npx",
    ["supabase", "secrets", "set", "--env-file", file],
    {
      stdio: "inherit",
      shell: true,
    },
  );
  process.exitCode = r.status ?? 1;
} finally {
  fs.rmSync(file, { force: true });
}
