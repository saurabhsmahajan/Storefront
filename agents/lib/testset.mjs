import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

export function fill(message) {
  return message.replace(
    /\{ORD_(\d{3}|MISSING)\}/g,
    (_, n) => `5eed0000-0000-4000-8000-000000000${n === "MISSING" ? "999" : n}`,
  );
}

export function loadTestSet() {
  const text = fs.readFileSync(
    path.join(root, "evidence", "test-set-2026-10-04.md"),
    "utf8",
  );
  const section = text.split("## Messages")[1].split("## Known limits")[0];
  const rows = section
    .split("\n")
    .filter((line) => /^\|\s*\d+\s*\|/.test(line))
    .map((line) => line.split("|").map((c) => c.trim()))
    .map((c) => ({ id: c[1], category: c[2], message: fill(c[3]) }));
  if (rows.length !== 21) {
    throw new Error(`Expected 21 messages, parsed ${rows.length}`);
  }
  return rows;
}
