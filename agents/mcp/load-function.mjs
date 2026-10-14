// The Edge Function is TypeScript for Deno and has no package.json (the Supabase
// bundler should not see one). To test it in Node, copy it to a temp folder that
// has one, and link the SDK from agents/node_modules.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(
  here,
  "..",
  "..",
  "supabase",
  "functions",
  "storefront-mcp",
);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "storefront-mcp-"));
for (const f of fs.readdirSync(src)) {
  if (/\.(ts|json)$/.test(f) && f !== "deno.json")
    fs.copyFileSync(path.join(src, f), path.join(dir, f));
}
fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
fs.symlinkSync(
  path.join(here, "..", "node_modules"),
  path.join(dir, "node_modules"),
  "junction", // a junction needs no admin rights on Windows; ignored on Linux
);

export const load = (name) => import(pathToFileURL(path.join(dir, name)).href);
export const functionDir = dir;
